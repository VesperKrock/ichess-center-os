begin;

-- PH-4A is a forward-only compatibility closure for hosted Supabase.  The
-- Parent-first source-evidence path uses the documented Vault decrypted view
-- only through the already-revoked P4A lookup-key helper, derives a separate
-- per-Contact encryption passphrase, and uses pgcrypto OpenPGP authenticated
-- encryption.  No inherited migration is changed and no conversion path is
-- enabled by this migration.
do $ph_4a_preflight$
begin
  if pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.crm_contact_lookup_control') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_lookup_key(integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_canonical_payload(text[],text[])') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_parse_payload_v1(bytea)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_protect_contact_source_evidence(text,uuid,integer,bytea)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_unwrap_contact_source_evidence(text,uuid,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_assert_projection(text,uuid)') is null
     or pg_catalog.to_regprocedure('public.ph_1_internal_assert_mutable_contact(text,uuid)') is null
     or pg_catalog.to_regprocedure('public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)') is null
     or pg_catalog.to_regprocedure('extensions.pgp_sym_encrypt_bytea(bytea,text,text)') is null
     or pg_catalog.to_regprocedure('extensions.pgp_sym_decrypt_bytea(bytea,text)') is null
     or pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') is null
     or pg_catalog.to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'PH4A_HOSTED_CRYPTO_PREREQUISITE_MISSING';
  end if;

  -- Production reached PH-4A with no CRM Contact business residue.  Keeping
  -- this precondition makes the v2 -> v3 transition explicit and prevents a
  -- mixed-format rollout that might strand existing protected evidence.
  if exists (select 1 from public.crm_contact)
     or exists (select 1 from public.crm_contact_lookup_evidence) then
    raise exception 'PH4A_CONTACT_RESIDUE_REVIEW_REQUIRED';
  end if;
end;
$ph_4a_preflight$;

create function public.ph_4a_internal_read_u32(p_value bytea, p_offset integer)
returns bigint
language plpgsql
immutable
strict
set search_path = ''
as $function$
begin
  if p_offset < 0 or p_offset + 4 > pg_catalog.octet_length(p_value) then
    raise exception 'CONTACT_SOURCE_ENVELOPE_MALFORMED';
  end if;
  return (pg_catalog.get_byte(p_value, p_offset)::bigint << 24)
    + (pg_catalog.get_byte(p_value, p_offset + 1)::bigint << 16)
    + (pg_catalog.get_byte(p_value, p_offset + 2)::bigint << 8)
    + pg_catalog.get_byte(p_value, p_offset + 3)::bigint;
end;
$function$;

create or replace function public.ph_1_update_crm_contact_identity(
  p_center_id text,
  p_crm_contact_id uuid,
  p_expected_contact_version integer,
  p_display_name text,
  p_phones text[],
  p_emails text[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_display_name text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_command record;
  v_contact public.crm_contact%rowtype;
  v_payload record;
  v_current_payload bytea;
  v_current_identity record;
  v_epochs integer[];
  v_epoch integer;
  v_key bytea;
  v_value text;
  v_digest bytea;
  v_digests bytea[] := array[]::bytea[];
  v_envelope bytea;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_crm_contact_id is null or p_expected_contact_version is null
     or p_expected_contact_version < 1
     or v_display_name = '' or pg_catalog.length(v_display_name) > 240
     or v_display_name ~ '[[:cntrl:]]'
     or public.c5_3_contains_protected_identity(v_display_name) then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_payload
  from public.f23_3e_p4a_internal_canonical_payload(p_phones, p_emails);

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'UPDATE_CONTACT_IDENTITY',
    pg_catalog.jsonb_build_object(
      'crm_contact_id', p_crm_contact_id,
      'expected_contact_version', p_expected_contact_version,
      'display_name', v_display_name,
      'phones', v_payload.canonical_phones,
      'emails', v_payload.canonical_emails
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':contact:' || p_crm_contact_id::text, 250803)
  );
  perform c.center_id from public.crm_contact_lookup_control c
  where c.center_id = v_center_id for update;
  if not found then raise exception 'LOOKUP_CONTROL_UNAVAILABLE'; end if;

  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = p_crm_contact_id
  for update;
  if not found or v_contact.contact_status = 'ARCHIVED' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NOT_FOUND';
  end if;
  if v_contact.contact_version <> p_expected_contact_version then
    raise exception using errcode = 'P0001', message = 'CONTACT_VERSION_STALE';
  end if;
  if v_contact.legacy_source_kind is distinct from 'local.parent_consultation.v1'
     or v_contact.contact_methods_crypto_version <> 3
     or v_contact.normalization_version <> 1 then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_UPDATE_UNSUPPORTED';
  end if;

  v_current_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
    v_center_id, p_crm_contact_id, v_contact.contact_version
  );
  select * into strict v_current_identity
  from public.f23_3e_p4a_internal_parse_payload_v1(v_current_payload);

  v_epochs := public.f23_3e_p4a_internal_target_epochs(v_center_id);
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'PHONE', v_value, v_epoch
      );
      v_digests := v_digests || v_digest;
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'EMAIL', v_value, v_epoch
      );
      v_digests := v_digests || v_digest;
    end loop;
  end loop;
  select pg_catalog.array_agg(x order by x) into v_digests
  from (select distinct pg_catalog.unnest(v_digests) x) q;

  for v_digest in select x from pg_catalog.unnest(v_digests) x order by x
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_center_id || ':identity:' || pg_catalog.encode(v_digest, 'hex'), 250804
      )
    );
  end loop;

  if exists (
    select 1
    from public.crm_contact_lookup_evidence e
    join public.crm_contact other
      on other.center_id = e.center_id and other.crm_contact_id = e.crm_contact_id
    where e.center_id = v_center_id
      and e.crm_contact_id <> p_crm_contact_id
      and e.evidence_status = 'ACTIVE'
      and e.lookup_digest = any(v_digests)
  ) then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.crm_contact_lookup_evidence e
    where e.center_id = v_center_id
      and e.crm_contact_id = p_crm_contact_id
      and e.evidence_status = 'RETIRED'
      and e.lookup_digest = any(v_digests)
  ) then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_REACTIVATION_REVIEW_REQUIRED';
  end if;

  -- An unchanged save still passes collision review before its idempotent
  -- committed no-op result is recorded.
  if v_contact.display_name = v_display_name
     and v_current_identity.canonical_phones is not distinct from v_payload.canonical_phones
     and v_current_identity.canonical_emails is not distinct from v_payload.canonical_emails then
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED',
      'operation', 'UPDATE_CONTACT_IDENTITY', 'replayed', false,
      'changed', false, 'crm_contact_id', p_crm_contact_id,
      'contact_version', v_contact.contact_version, 'correlation_id', null
    );
    return public.ph_1_internal_store_command(
      v_center_id, v_command.actor_user_id, p_idempotency_key,
      v_command.intent_digest, v_result
    );
  end if;

  begin
    v_envelope := public.ph_4a_internal_encrypt_contact_source(
      v_center_id,
      p_crm_contact_id,
      public.ph_4a_internal_current_source_key_epoch(v_center_id),
      v_payload.payload
    );
  exception when others then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_PROTECTION_FAILED';
  end;

  perform pg_catalog.set_config('ichess.p4a_lookup_write', 'on', true);
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'PHONE', v_value, v_epoch
      );
      insert into public.crm_contact_lookup_evidence(
        center_id, crm_contact_id, field_kind, normalizer_version,
        digest_contract_version, key_epoch, lookup_digest
      ) values (
        v_center_id, p_crm_contact_id, 'PHONE', 1, 1, v_epoch, v_digest
      ) on conflict do nothing;
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'EMAIL', v_value, v_epoch
      );
      insert into public.crm_contact_lookup_evidence(
        center_id, crm_contact_id, field_kind, normalizer_version,
        digest_contract_version, key_epoch, lookup_digest
      ) values (
        v_center_id, p_crm_contact_id, 'EMAIL', 1, 1, v_epoch, v_digest
      ) on conflict do nothing;
    end loop;
  end loop;
  update public.crm_contact_lookup_evidence e set
    evidence_status = 'RETIRED',
    evidence_version = e.evidence_version + 1
  where e.center_id = v_center_id
    and e.crm_contact_id = p_crm_contact_id
    and e.evidence_status = 'ACTIVE'
    and not (e.lookup_digest = any(v_digests));

  v_previous_version := v_contact.contact_version;
  update public.crm_contact c set
    display_name = v_display_name,
    protected_contact_methods_ciphertext = v_envelope,
    contact_methods_crypto_version = 3,
    normalized_lookup_digests = v_digests,
    normalization_version = 1,
    contact_version = c.contact_version + 1
  where c.center_id = v_center_id and c.crm_contact_id = p_crm_contact_id
  returning * into v_contact;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.contact.identity_updated', v_command.actor_user_id,
    'crm_contact', p_crm_contact_id, null,
    v_previous_version, v_contact.contact_version, v_contact.contact_status,
    'operator-explicit-identity-update', 'CONTACT_IDENTITY_UPDATED', v_correlation_id
  );
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED',
    'operation', 'UPDATE_CONTACT_IDENTITY', 'replayed', false,
    'changed', true, 'crm_contact_id', p_crm_contact_id,
    'contact_version', v_contact.contact_version,
    'correlation_id', v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create or replace function public.ph_1_internal_assert_mutable_contact(
  p_center_id text,
  p_contact_id uuid
)
returns public.crm_contact
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contact public.crm_contact%rowtype;
begin
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
  for share;

  if not found or v_contact.contact_status = 'ARCHIVED' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NOT_FOUND';
  end if;
  if v_contact.legacy_source_kind is distinct from 'local.parent_consultation.v1'
     or v_contact.contact_methods_crypto_version <> 3
     or v_contact.normalization_version <> 1 then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_UPDATE_UNSUPPORTED';
  end if;
  return v_contact;
end;
$function$;

create function public.ph_4a_internal_source_context(
  p_center_id text,
  p_contact_id uuid,
  p_key_epoch integer
)
returns bytea
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(p_center_id);
begin
  if v_center_id = '' or v_center_id is distinct from p_center_id
     or pg_catalog.length(v_center_id) > 160
     or p_key_epoch < 1 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  return public.f23_3e_p3c_internal_lp32(
      pg_catalog.convert_to('ichess.crm.contact.source-evidence.pgp.v3', 'UTF8')
    )
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(3)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(v_center_id, 'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_contact_id));
end;
$function$;

create function public.ph_4a_internal_source_passphrase(
  p_center_id text,
  p_contact_id uuid,
  p_key_epoch integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_master_key bytea;
  v_context bytea;
begin
  v_master_key := public.f23_3e_p4a_internal_lookup_key(p_key_epoch);
  if pg_catalog.octet_length(v_master_key) <> 32 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_context := public.ph_4a_internal_source_context(
    p_center_id, p_contact_id, p_key_epoch
  );
  return pg_catalog.encode(
    extensions.hmac(
      public.f23_3e_p3c_internal_lp32(
        pg_catalog.convert_to('ichess.crm.contact.source-evidence.key-derivation.v1', 'UTF8')
      ) || v_context,
      v_master_key,
      'sha256'
    ),
    'hex'
  );
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create function public.ph_4a_internal_encode_source_plaintext(
  p_center_id text,
  p_contact_id uuid,
  p_trusted_payload bytea
)
returns bytea
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(p_center_id);
  v_center_bytes bytea;
begin
  if v_center_id = '' or v_center_id is distinct from p_center_id
     or pg_catalog.length(v_center_id) > 160
     or pg_catalog.octet_length(p_trusted_payload) not between 1 and 65536 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_center_bytes := pg_catalog.convert_to(v_center_id, 'UTF8');
  return pg_catalog.convert_to('IP4ACTX1', 'UTF8')
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_center_bytes))
    || v_center_bytes
    || pg_catalog.uuid_send(p_contact_id)
    || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(p_trusted_payload))
    || p_trusted_payload;
end;
$function$;

create function public.ph_4a_internal_decode_source_plaintext(
  p_center_id text,
  p_contact_id uuid,
  p_plaintext bytea
)
returns bytea
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(p_center_id);
  v_center_bytes bytea;
  v_center_length bigint;
  v_payload_length bigint;
  v_payload_offset integer;
begin
  v_center_bytes := pg_catalog.convert_to(v_center_id, 'UTF8');
  if v_center_id = '' or v_center_id is distinct from p_center_id
     or pg_catalog.length(v_center_id) > 160
     or pg_catalog.octet_length(p_plaintext) < 35
     or pg_catalog.substr(p_plaintext, 1, 8) <> pg_catalog.convert_to('IP4ACTX1', 'UTF8')
     or pg_catalog.get_byte(p_plaintext, 8) <> 1 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_center_length := public.ph_4a_internal_read_u32(p_plaintext, 9);
  if v_center_length <> pg_catalog.octet_length(v_center_bytes)
     or v_center_length not between 1 and 640
     or pg_catalog.substr(p_plaintext, 14, v_center_length::integer) <> v_center_bytes
     or pg_catalog.substr(p_plaintext, 14 + v_center_length::integer, 16)
        <> pg_catalog.uuid_send(p_contact_id) then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_payload_length := public.ph_4a_internal_read_u32(
    p_plaintext, 29 + v_center_length::integer
  );
  v_payload_offset := 34 + v_center_length::integer;
  if v_payload_length not between 1 and 65536
     or pg_catalog.octet_length(p_plaintext)
        <> 33 + v_center_length::integer + v_payload_length::integer then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  return pg_catalog.substr(p_plaintext, v_payload_offset, v_payload_length::integer);
end;
$function$;

create function public.ph_4a_internal_parse_source_envelope(p_envelope bytea)
returns table(key_epoch integer, cipher_bytes bytea)
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_epoch bigint;
  v_cipher_length bigint;
begin
  if pg_catalog.octet_length(p_envelope) < 51
     or pg_catalog.substr(p_envelope, 1, 8) <> pg_catalog.convert_to('IP4ACSE1', 'UTF8')
     or pg_catalog.get_byte(p_envelope, 8) <> 1
     or pg_catalog.get_byte(p_envelope, 9) <> 1 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_epoch := public.ph_4a_internal_read_u32(p_envelope, 10);
  v_cipher_length := public.ph_4a_internal_read_u32(p_envelope, 14);
  if v_epoch < 1 or v_cipher_length not between 33 and 131072
     or pg_catalog.octet_length(p_envelope) <> 18 + v_cipher_length::integer then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  return query select v_epoch::integer,
    pg_catalog.substr(p_envelope, 19, v_cipher_length::integer);
end;
$function$;

create function public.ph_4a_internal_assert_pgcrypto_ready()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_probe bytea := pg_catalog.convert_to('PH4A_AES256_MDC_RUNTIME_PROBE_V1', 'UTF8');
  v_key text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_wrong_key text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_cipher bytea;
  v_tampered bytea;
  v_decrypted bytea;
  v_wrong_key_rejected boolean := false;
  v_tamper_rejected boolean := false;
begin
  v_cipher := extensions.pgp_sym_encrypt_bytea(
    v_probe, v_key,
    'cipher-algo=aes256,compress-algo=0,disable-mdc=0,sess-key=1'
  );
  if pg_catalog.octet_length(v_cipher) <= pg_catalog.octet_length(v_probe)
     or pg_catalog.strpos(
       pg_catalog.encode(v_cipher, 'hex'), pg_catalog.encode(v_probe, 'hex')
     ) <> 0
     or extensions.pgp_sym_decrypt_bytea(v_cipher, v_key) is distinct from v_probe then
    raise exception 'unsafe cipher';
  end if;

  begin
    v_decrypted := extensions.pgp_sym_decrypt_bytea(v_cipher, v_wrong_key);
  exception when others then
    v_wrong_key_rejected := true;
  end;
  if not v_wrong_key_rejected then raise exception 'wrong key accepted'; end if;

  v_tampered := pg_catalog.set_byte(
    v_cipher,
    pg_catalog.octet_length(v_cipher) - 3,
    pg_catalog.get_byte(v_cipher, pg_catalog.octet_length(v_cipher) - 3) # 1
  );
  begin
    v_decrypted := extensions.pgp_sym_decrypt_bytea(v_tampered, v_key);
  exception when others then
    v_tamper_rejected := true;
  end;
  if not v_tamper_rejected then raise exception 'tamper accepted'; end if;
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create function public.ph_4a_internal_encrypt_contact_source(
  p_center_id text,
  p_contact_id uuid,
  p_key_epoch integer,
  p_trusted_payload bytea
)
returns bytea
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_plaintext bytea;
  v_passphrase text;
  v_wrong_passphrase text;
  v_cipher bytea;
  v_tampered bytea;
  v_decrypted bytea;
  v_wrong_key_rejected boolean := false;
  v_tamper_rejected boolean := false;
begin
  perform public.ph_4a_internal_assert_pgcrypto_ready();
  v_plaintext := public.ph_4a_internal_encode_source_plaintext(
    p_center_id, p_contact_id, p_trusted_payload
  );
  v_passphrase := public.ph_4a_internal_source_passphrase(
    p_center_id, p_contact_id, p_key_epoch
  );
  v_wrong_passphrase := pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to('ichess.crm.contact.source-evidence.wrong-key-probe.v1', 'UTF8'),
      pg_catalog.decode(v_passphrase, 'hex'),
      'sha256'
    ),
    'hex'
  );
  v_cipher := extensions.pgp_sym_encrypt_bytea(
    v_plaintext, v_passphrase,
    'cipher-algo=aes256,compress-algo=0,disable-mdc=0,sess-key=1'
  );
  if pg_catalog.octet_length(v_cipher) not between 33 and 131072
     or pg_catalog.strpos(
       pg_catalog.encode(v_cipher, 'hex'), pg_catalog.encode(v_plaintext, 'hex')
     ) <> 0
     or extensions.pgp_sym_decrypt_bytea(v_cipher, v_passphrase)
        is distinct from v_plaintext then
    raise exception 'unsafe ciphertext';
  end if;

  begin
    v_decrypted := extensions.pgp_sym_decrypt_bytea(v_cipher, v_wrong_passphrase);
  exception when others then
    v_wrong_key_rejected := true;
  end;
  if not v_wrong_key_rejected then raise exception 'wrong key accepted'; end if;

  v_tampered := pg_catalog.set_byte(
    v_cipher,
    pg_catalog.octet_length(v_cipher) - 3,
    pg_catalog.get_byte(v_cipher, pg_catalog.octet_length(v_cipher) - 3) # 1
  );
  begin
    v_decrypted := extensions.pgp_sym_decrypt_bytea(v_tampered, v_passphrase);
  exception when others then
    v_tamper_rejected := true;
  end;
  if not v_tamper_rejected then raise exception 'tamper accepted'; end if;

  return pg_catalog.convert_to('IP4ACSE1', 'UTF8')
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_cipher))
    || v_cipher;
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create function public.ph_4a_internal_decrypt_contact_source(
  p_center_id text,
  p_contact_id uuid,
  p_envelope bytea
)
returns bytea
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_parsed record;
  v_passphrase text;
  v_plaintext bytea;
begin
  select * into strict v_parsed
  from public.ph_4a_internal_parse_source_envelope(p_envelope);
  v_passphrase := public.ph_4a_internal_source_passphrase(
    p_center_id, p_contact_id, v_parsed.key_epoch
  );
  v_plaintext := extensions.pgp_sym_decrypt_bytea(
    v_parsed.cipher_bytes, v_passphrase
  );
  if pg_catalog.strpos(
       pg_catalog.encode(v_parsed.cipher_bytes, 'hex'),
       pg_catalog.encode(v_plaintext, 'hex')
     ) <> 0 then
    raise exception 'unsafe ciphertext';
  end if;
  return public.ph_4a_internal_decode_source_plaintext(
    p_center_id, p_contact_id, v_plaintext
  );
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create function public.ph_4a_internal_current_source_key_epoch(p_center_id text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_control public.crm_contact_lookup_control%rowtype;
begin
  select c.* into v_control
  from public.crm_contact_lookup_control c
  where c.center_id = p_center_id;
  if not found or v_control.current_key_epoch is null
     or v_control.current_key_epoch < 1
     or v_control.rotation_state not in ('ACTIVE', 'PREPARING', 'DUAL_READ', 'RETIRING') then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  return v_control.current_key_epoch;
end;
$function$;

create or replace function public.f23_3e_p3c_internal_protect_contact_source_evidence(
  p_center_id text,
  p_contact_id uuid,
  p_expected_contact_version integer,
  p_trusted_payload bytea
)
returns table(contact_version integer, contact_methods_crypto_version integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contact public.crm_contact%rowtype;
  v_envelope bytea;
  v_key_epoch integer;
begin
  if p_center_id is null or p_contact_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_trusted_payload is null
     or pg_catalog.octet_length(p_trusted_payload) not between 1 and 65536 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
  for update;
  if not found or v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_status = 'ARCHIVED' then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_key_epoch := public.ph_4a_internal_current_source_key_epoch(p_center_id);
  v_envelope := public.ph_4a_internal_encrypt_contact_source(
    p_center_id, p_contact_id, v_key_epoch, p_trusted_payload
  );
  update public.crm_contact c set
    protected_contact_methods_ciphertext = v_envelope,
    contact_methods_crypto_version = 3,
    contact_version = c.contact_version + 1
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
  returning c.contact_version, c.contact_methods_crypto_version
    into contact_version, contact_methods_crypto_version;
  return next;
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create or replace function public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
  p_center_id text,
  p_contact_id uuid,
  p_expected_contact_version integer
)
returns bytea
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contact public.crm_contact%rowtype;
begin
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
  for share;
  if not found or v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_status = 'ARCHIVED'
     or v_contact.contact_methods_crypto_version <> 3 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  return public.ph_4a_internal_decrypt_contact_source(
    p_center_id, p_contact_id, v_contact.protected_contact_methods_ciphertext
  );
exception when others then
  raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
end;
$function$;

create or replace function public.f23_3e_p4a_internal_assert_projection(
  p_center_id text,
  p_contact_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_contact public.crm_contact%rowtype;
  v_expected bytea[];
  v_count integer;
begin
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id;
  if not found then return; end if;
  select pg_catalog.count(*)::integer,
         pg_catalog.array_agg(e.lookup_digest order by e.lookup_digest)
    into v_count, v_expected
  from public.crm_contact_lookup_evidence e
  where e.center_id = p_center_id and e.crm_contact_id = p_contact_id
    and e.evidence_status = 'ACTIVE';
  if exists (
       select 1 from public.crm_contact_lookup_evidence e
       where e.center_id = p_center_id and e.crm_contact_id = p_contact_id
     )
     and (v_count < 1 or v_contact.normalization_version <> 1
          or v_contact.contact_methods_crypto_version <> 3
          or v_contact.normalized_lookup_digests is distinct from v_expected) then
    raise exception 'LOOKUP_PROJECTION_INVARIANT_VIOLATION';
  end if;
end;
$function$;

-- All PH-4A helpers are server-internal.  P3C/P4A callers execute as their
-- owner; browser roles receive no direct crypto or key-derivation capability.
do $ph_4a_revoke_internal$
declare
  v_signature text;
begin
  for v_signature in
    select p.oid::pg_catalog.regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ph_4a_internal_%'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end;
$ph_4a_revoke_internal$;

revoke all on function public.f23_3e_p3c_internal_protect_contact_source_evidence(text,uuid,integer,bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3c_internal_unwrap_contact_source_evidence(text,uuid,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p4a_internal_assert_projection(text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.ph_1_internal_assert_mutable_contact(text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)
  to authenticated;

comment on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid) is
  'Authenticated Owner/Admin exact-center Contact identity update using hosted-compatible protected evidence v3, expected-version, collision review, idempotency, audit and outbox.';
comment on function public.ph_4a_internal_encrypt_contact_source(text,uuid,integer,bytea) is
  'Internal hosted-compatible AES-256 OpenPGP source-evidence protection with per-Contact key derivation, MDC integrity and fail-closed runtime crypto probes.';

-- The migration itself proves the hosted-compatible primitive does not accept
-- a wrong key or modified ciphertext before any Parent center may be resumed.
select public.ph_4a_internal_assert_pgcrypto_ready();

commit;
