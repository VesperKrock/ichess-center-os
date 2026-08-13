-- F23.3E-P4A: canonical Contact ingress and lookup normalization foundation.
-- Local/backend only. No browser authority, remote apply, conversion execution,
-- Guardian mutation, or inherited checkpoint rewrite is introduced here.

begin;

set local check_function_bodies = true;

do $f23_3e_p4a_prerequisites$
begin
  if pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.guardian_profile') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_protect_contact_source_evidence(text,uuid,integer,bytea)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_unwrap_contact_source_evidence(text,uuid,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3b_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid)') is null then
    raise exception 'f23_3e_p4a_missing_frozen_prerequisite';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p4a_missing_service_role';
  end if;
  if pg_catalog.to_regclass('public.crm_contact_lookup_control') is not null
     or pg_catalog.to_regclass('public.crm_contact_lookup_evidence') is not null
     or exists (
       select 1 from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'f23_3e_p4a_%'
     ) then
    raise exception 'f23_3e_p4a_runtime_already_exists';
  end if;
end;
$f23_3e_p4a_prerequisites$;

create table public.crm_contact_lookup_control (
  contact_lookup_control_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null unique,
  payload_schema_version integer not null default 1,
  phone_normalization_version integer not null default 1,
  email_normalization_version integer not null default 1,
  digest_contract_version integer not null default 1,
  current_key_epoch integer not null default 1,
  previous_key_epoch integer,
  pending_key_epoch integer,
  rotation_state text not null default 'ACTIVE',
  control_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_contact_lookup_control_center_fkey
    foreign key (center_id) references public.centers(id) on delete cascade,
  constraint crm_contact_lookup_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete cascade,
  constraint crm_contact_lookup_control_versions_check check (
    payload_schema_version = 1
    and phone_normalization_version = 1
    and email_normalization_version = 1
    and digest_contract_version = 1
    and current_key_epoch >= 1
    and control_version >= 1
    and (previous_key_epoch is null or previous_key_epoch >= 1)
    and (pending_key_epoch is null or pending_key_epoch >= 1)
  ),
  constraint crm_contact_lookup_control_state_check check (
    (rotation_state = 'ACTIVE' and previous_key_epoch is null and pending_key_epoch is null)
    or (rotation_state = 'PREPARING' and previous_key_epoch is null
        and pending_key_epoch = current_key_epoch + 1)
    or (rotation_state = 'DUAL_READ' and previous_key_epoch = current_key_epoch - 1
        and pending_key_epoch is null)
    or (rotation_state = 'RETIRING' and previous_key_epoch = current_key_epoch - 1
        and pending_key_epoch is null)
  ),
  constraint crm_contact_lookup_control_rotation_state_check
    check (rotation_state in ('ACTIVE', 'PREPARING', 'DUAL_READ', 'RETIRING')),
  constraint crm_contact_lookup_control_timestamp_check check (updated_at >= created_at)
);

create table public.crm_contact_lookup_evidence (
  contact_lookup_evidence_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  crm_contact_id uuid not null,
  field_kind text not null,
  normalizer_version integer not null,
  digest_contract_version integer not null,
  key_epoch integer not null,
  lookup_digest bytea not null,
  evidence_status text not null default 'ACTIVE',
  evidence_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  retired_at timestamptz,
  constraint crm_contact_lookup_evidence_contact_fkey
    foreign key (center_id, crm_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_contact_lookup_evidence_shape_check check (
    field_kind in ('PHONE', 'EMAIL')
    and normalizer_version = 1
    and digest_contract_version = 1
    and key_epoch >= 1
    and pg_catalog.octet_length(lookup_digest) = 32
    and evidence_version >= 1
    and evidence_status in ('ACTIVE', 'RETIRED')
    and ((evidence_status = 'ACTIVE' and retired_at is null)
         or (evidence_status = 'RETIRED' and retired_at is not null))
    and updated_at >= created_at
  ),
  constraint crm_contact_lookup_evidence_tuple_key unique (
    center_id, crm_contact_id, field_kind, normalizer_version,
    digest_contract_version, key_epoch, lookup_digest
  )
);

create index crm_contact_lookup_evidence_active_digest_idx
  on public.crm_contact_lookup_evidence(center_id, lookup_digest, crm_contact_id)
  where evidence_status = 'ACTIVE';
create index crm_contact_lookup_evidence_contact_epoch_idx
  on public.crm_contact_lookup_evidence(center_id, crm_contact_id, key_epoch, evidence_status);

alter table public.crm_contact_lookup_control enable row level security;
alter table public.crm_contact_lookup_control force row level security;
alter table public.crm_contact_lookup_evidence enable row level security;
alter table public.crm_contact_lookup_evidence force row level security;
revoke all on table public.crm_contact_lookup_control from public, anon, authenticated, service_role;
revoke all on table public.crm_contact_lookup_evidence from public, anon, authenticated, service_role;

create function public.f23_3e_p4a_internal_guard_lookup_control()
returns trigger language plpgsql set search_path = ''
as $f23_3e_p4a_internal_guard_lookup_control$
begin
  if pg_catalog.current_setting('ichess.p4a_lookup_write', true) is distinct from 'on' then
    raise exception 'LOOKUP_CONTROL_WRITE_DENIED';
  end if;
  if tg_op = 'INSERT' then
    if new.control_version <> 1 or new.rotation_state <> 'ACTIVE'
       or new.current_key_epoch <> 1 or new.previous_key_epoch is not null
       or new.pending_key_epoch is not null then
      raise exception 'LOOKUP_CONTROL_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'LOOKUP_CONTROL_DELETE_DENIED'; end if;
  if new.center_id is distinct from old.center_id
     or new.contact_lookup_control_id is distinct from old.contact_lookup_control_id
     or new.payload_schema_version is distinct from old.payload_schema_version
     or new.phone_normalization_version is distinct from old.phone_normalization_version
     or new.email_normalization_version is distinct from old.email_normalization_version
     or new.digest_contract_version is distinct from old.digest_contract_version
     or new.created_at is distinct from old.created_at
     or new.control_version <> old.control_version + 1 then
    raise exception 'LOOKUP_CONTROL_IMMUTABLE_OR_VERSION_INVALID';
  end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p4a_internal_guard_lookup_control$;

create trigger f23_3e_p4a_lookup_control_guard
before insert or update or delete on public.crm_contact_lookup_control
for each row execute function public.f23_3e_p4a_internal_guard_lookup_control();

create function public.f23_3e_p4a_internal_guard_lookup_evidence()
returns trigger language plpgsql set search_path = ''
as $f23_3e_p4a_internal_guard_lookup_evidence$
begin
  if pg_catalog.current_setting('ichess.p4a_lookup_write', true) is distinct from 'on' then
    raise exception 'LOOKUP_EVIDENCE_WRITE_DENIED';
  end if;
  if tg_op = 'INSERT' then
    if new.evidence_status <> 'ACTIVE' or new.evidence_version <> 1 then
      raise exception 'LOOKUP_EVIDENCE_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'LOOKUP_EVIDENCE_DELETE_DENIED'; end if;
  if new.center_id is distinct from old.center_id
     or new.crm_contact_id is distinct from old.crm_contact_id
     or new.contact_lookup_evidence_id is distinct from old.contact_lookup_evidence_id
     or new.field_kind is distinct from old.field_kind
     or new.normalizer_version is distinct from old.normalizer_version
     or new.digest_contract_version is distinct from old.digest_contract_version
     or new.key_epoch is distinct from old.key_epoch
     or new.lookup_digest is distinct from old.lookup_digest
     or new.created_at is distinct from old.created_at
     or old.evidence_status <> 'ACTIVE' or new.evidence_status <> 'RETIRED'
     or new.evidence_version <> old.evidence_version + 1 then
    raise exception 'LOOKUP_EVIDENCE_IMMUTABLE_OR_TRANSITION_INVALID';
  end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  new.retired_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p4a_internal_guard_lookup_evidence$;

create trigger f23_3e_p4a_lookup_evidence_guard
before insert or update or delete on public.crm_contact_lookup_evidence
for each row execute function public.f23_3e_p4a_internal_guard_lookup_evidence();

create function public.f23_3e_p4a_internal_provision_lookup_control()
returns trigger language plpgsql security definer set search_path = ''
as $f23_3e_p4a_internal_provision_lookup_control$
begin
  perform pg_catalog.set_config('ichess.p4a_lookup_write', 'on', true);
  insert into public.crm_contact_lookup_control(center_id) values (new.id);
  return new;
end;
$f23_3e_p4a_internal_provision_lookup_control$;

create trigger f23_3e_p4a_provision_lookup_control
after insert on public.centers for each row
execute function public.f23_3e_p4a_internal_provision_lookup_control();

select pg_catalog.set_config('ichess.p4a_lookup_write', 'on', true);
insert into public.crm_contact_lookup_control(center_id)
select c.id from public.centers c order by c.id;

create function public.f23_3e_p4a_internal_normalize_phone_v1(p_value text)
returns text language plpgsql immutable set search_path = ''
as $f23_3e_p4a_internal_normalize_phone_v1$
declare v text; v_digits text;
begin
  if p_value is null or pg_catalog.btrim(p_value, ' ') = '' then return null; end if;
  if pg_catalog.length(p_value) > 64 or pg_catalog.octet_length(p_value) <> pg_catalog.length(p_value)
     or p_value ~ '[[:cntrl:]]' or p_value !~ '^[0-9+ .()\-]+$' then
    raise exception 'CONTACT_PHONE_INVALID';
  end if;
  v := pg_catalog.btrim(p_value, ' ');
  if pg_catalog.length(v) - pg_catalog.length(pg_catalog.replace(v, '+', '')) > 1
     or (pg_catalog.strpos(v, '+') > 0 and pg_catalog.strpos(v, '+') <> 1) then
    raise exception 'CONTACT_PHONE_INVALID';
  end if;
  v_digits := pg_catalog.regexp_replace(v, '[ .()\-]', '', 'g');
  if v_digits ~ '^0[35789][0-9]{8}$' then return '+84' || pg_catalog.substr(v_digits, 2); end if;
  if v_digits ~ '^84[35789][0-9]{8}$' then return '+' || v_digits; end if;
  if v_digits ~ '^\+84[35789][0-9]{8}$' then return v_digits; end if;
  raise exception 'CONTACT_PHONE_INVALID';
end;
$f23_3e_p4a_internal_normalize_phone_v1$;

create function public.f23_3e_p4a_internal_normalize_email_v1(p_value text)
returns text language plpgsql immutable set search_path = ''
as $f23_3e_p4a_internal_normalize_email_v1$
declare v text; v_local text; v_domain text; v_label text;
begin
  if p_value is null or pg_catalog.btrim(p_value, ' ') = '' then return null; end if;
  if pg_catalog.length(p_value) > 254 or pg_catalog.octet_length(p_value) <> pg_catalog.length(p_value)
     or p_value ~ '[[:cntrl:]]' then raise exception 'CONTACT_EMAIL_INVALID'; end if;
  v := pg_catalog.btrim(p_value, ' ');
  if pg_catalog.length(v) > 254 or pg_catalog.length(v) - pg_catalog.length(pg_catalog.replace(v, '@', '')) <> 1 then
    raise exception 'CONTACT_EMAIL_INVALID';
  end if;
  v_local := pg_catalog.split_part(v, '@', 1);
  v_domain := pg_catalog.lower(pg_catalog.split_part(v, '@', 2));
  if pg_catalog.length(v_local) not between 1 and 64
     or v_local !~ '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~.-]+$'
     or v_local ~ '^\.' or v_local ~ '\.$' or v_local ~ '\.\.'
     or pg_catalog.length(v_domain) not between 3 and 189
     or v_domain !~ '^[a-z0-9.-]+$'
     or v_domain !~ '\.' or v_domain ~ '^\.' or v_domain ~ '\.$' or v_domain ~ '\.\.' then
    raise exception 'CONTACT_EMAIL_INVALID';
  end if;
  foreach v_label in array pg_catalog.string_to_array(v_domain, '.') loop
    if pg_catalog.length(v_label) not between 1 and 63
       or v_label !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' and pg_catalog.length(v_label) > 1
       or pg_catalog.length(v_label) = 1 and v_label !~ '^[a-z0-9]$' then
      raise exception 'CONTACT_EMAIL_INVALID';
    end if;
  end loop;
  return v_local || '@' || v_domain;
end;
$f23_3e_p4a_internal_normalize_email_v1$;

create function public.f23_3e_p4a_internal_canonical_payload(
  p_phones text[], p_emails text[]
)
returns table(canonical_phones text[], canonical_emails text[], payload bytea)
language plpgsql immutable set search_path = ''
as $f23_3e_p4a_internal_canonical_payload$
declare v text; v_normal text; v_bytes bytea;
begin
  canonical_phones := array[]::text[];
  canonical_emails := array[]::text[];
  foreach v in array coalesce(p_phones, array[]::text[]) loop
    v_normal := public.f23_3e_p4a_internal_normalize_phone_v1(v);
    if v_normal is not null then canonical_phones := canonical_phones || v_normal; end if;
  end loop;
  foreach v in array coalesce(p_emails, array[]::text[]) loop
    v_normal := public.f23_3e_p4a_internal_normalize_email_v1(v);
    if v_normal is not null then canonical_emails := canonical_emails || v_normal; end if;
  end loop;
  select coalesce(pg_catalog.array_agg(x order by pg_catalog.convert_to(x, 'UTF8')), array[]::text[])
    into canonical_phones from (select distinct pg_catalog.unnest(canonical_phones) x) q;
  select coalesce(pg_catalog.array_agg(x order by pg_catalog.convert_to(x, 'UTF8')), array[]::text[])
    into canonical_emails from (select distinct pg_catalog.unnest(canonical_emails) x) q;
  if pg_catalog.cardinality(canonical_phones) > 5 or pg_catalog.cardinality(canonical_emails) > 5
     or pg_catalog.cardinality(canonical_phones) + pg_catalog.cardinality(canonical_emails) < 1 then
    raise exception 'CONTACT_METHOD_SET_INVALID';
  end if;
  payload := pg_catalog.convert_to('IC4CPV01', 'UTF8')
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u16(pg_catalog.cardinality(canonical_phones));
  foreach v in array canonical_phones loop
    v_bytes := pg_catalog.convert_to(v, 'UTF8');
    payload := payload || public.f23_3e_p3c_internal_u16(pg_catalog.octet_length(v_bytes)) || v_bytes;
  end loop;
  payload := payload || public.f23_3e_p3c_internal_u16(pg_catalog.cardinality(canonical_emails));
  foreach v in array canonical_emails loop
    v_bytes := pg_catalog.convert_to(v, 'UTF8');
    payload := payload || public.f23_3e_p3c_internal_u16(pg_catalog.octet_length(v_bytes)) || v_bytes;
  end loop;
  return next;
end;
$f23_3e_p4a_internal_canonical_payload$;

create function public.f23_3e_p4a_internal_parse_payload_v1(p_payload bytea)
returns table(canonical_phones text[], canonical_emails text[])
language plpgsql immutable strict set search_path = ''
as $f23_3e_p4a_internal_parse_payload_v1$
declare pos integer := 13; cnt integer; len integer; i integer; v text; rebuilt record;
begin
  if pg_catalog.octet_length(p_payload) < 16
     or pg_catalog.substr(p_payload, 1, 8) <> pg_catalog.convert_to('IC4CPV01', 'UTF8')
     or pg_catalog.get_byte(p_payload, 8) <> 1
     or pg_catalog.get_byte(p_payload, 9) <> 1
     or pg_catalog.get_byte(p_payload,10) <> 1
     or pg_catalog.get_byte(p_payload,11) <> 1 then
    raise exception 'CONTACT_PAYLOAD_UNSUPPORTED';
  end if;
  canonical_phones := array[]::text[];
  canonical_emails := array[]::text[];
  cnt := pg_catalog.get_byte(p_payload, pos - 1) * 256 + pg_catalog.get_byte(p_payload, pos); pos := pos + 2;
  if cnt > 5 then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
  for i in 1..cnt loop
    if pos + 1 > pg_catalog.octet_length(p_payload) then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
    len := pg_catalog.get_byte(p_payload,pos - 1) * 256 + pg_catalog.get_byte(p_payload,pos); pos := pos + 2;
    if len < 1 or pos + len - 1 > pg_catalog.octet_length(p_payload) then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
    begin v := pg_catalog.convert_from(pg_catalog.substr(p_payload,pos,len),'UTF8'); exception when others then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end;
    canonical_phones := canonical_phones || v; pos := pos + len;
  end loop;
  if pos + 1 > pg_catalog.octet_length(p_payload) then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
  cnt := pg_catalog.get_byte(p_payload,pos - 1) * 256 + pg_catalog.get_byte(p_payload,pos); pos := pos + 2;
  if cnt > 5 then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
  for i in 1..cnt loop
    if pos + 1 > pg_catalog.octet_length(p_payload) then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
    len := pg_catalog.get_byte(p_payload,pos - 1) * 256 + pg_catalog.get_byte(p_payload,pos); pos := pos + 2;
    if len < 1 or pos + len - 1 > pg_catalog.octet_length(p_payload) then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
    begin v := pg_catalog.convert_from(pg_catalog.substr(p_payload,pos,len),'UTF8'); exception when others then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end;
    canonical_emails := canonical_emails || v; pos := pos + len;
  end loop;
  if pos <> pg_catalog.octet_length(p_payload) + 1 then raise exception 'CONTACT_PAYLOAD_MALFORMED'; end if;
  select * into strict rebuilt from public.f23_3e_p4a_internal_canonical_payload(canonical_phones, canonical_emails);
  if rebuilt.payload is distinct from p_payload then raise exception 'CONTACT_PAYLOAD_NONCANONICAL'; end if;
  return next;
end;
$f23_3e_p4a_internal_parse_payload_v1$;

create function public.f23_3e_p4a_internal_lookup_key(p_key_epoch integer)
returns bytea language plpgsql volatile security definer set search_path = ''
as $f23_3e_p4a_internal_lookup_key$
declare v_name text; v_value text; v_count integer;
begin
  if p_key_epoch is null or p_key_epoch < 1 then raise exception 'LOOKUP_KEY_EPOCH_INVALID'; end if;
  v_name := 'f23_3e_p4a_contact_lookup_epoch_' || p_key_epoch::text;
  select pg_catalog.count(*)::integer, pg_catalog.min(s.decrypted_secret)
    into v_count, v_value from vault.decrypted_secrets s where s.name = v_name;
  if v_count <> 1 or v_value is null or v_value !~ '^[0-9A-Fa-f]{64}$' then
    raise exception 'LOOKUP_KEY_UNAVAILABLE';
  end if;
  return pg_catalog.decode(v_value, 'hex');
end;
$f23_3e_p4a_internal_lookup_key$;

create function public.f23_3e_p4a_internal_lookup_digest(
  p_key bytea, p_center_id text, p_field_kind text,
  p_normalized_value text, p_key_epoch integer
)
returns bytea language plpgsql immutable strict set search_path = ''
as $f23_3e_p4a_internal_lookup_digest$
declare v_domain text;
begin
  if pg_catalog.octet_length(p_key) <> 32 or p_key_epoch < 1 then raise exception 'LOOKUP_KEY_INVALID'; end if;
  if p_field_kind = 'PHONE' then v_domain := 'ichess.crm.contact.phone.lookup.v1';
  elsif p_field_kind = 'EMAIL' then v_domain := 'ichess.crm.contact.email.lookup.v1';
  else raise exception 'LOOKUP_FIELD_KIND_INVALID'; end if;
  return extensions.hmac(
    public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(v_domain,'UTF8'))
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(1)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_center_id,'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_normalized_value,'UTF8')),
    p_key, 'sha256'
  );
end;
$f23_3e_p4a_internal_lookup_digest$;

create function public.f23_3e_p4a_internal_target_epochs(p_center_id text)
returns integer[] language plpgsql stable security definer set search_path = ''
as $f23_3e_p4a_internal_target_epochs$
declare v public.crm_contact_lookup_control%rowtype;
begin
  select c.* into v from public.crm_contact_lookup_control c where c.center_id = p_center_id;
  if not found then raise exception 'LOOKUP_CONTROL_UNAVAILABLE'; end if;
  if v.rotation_state = 'ACTIVE' then return array[v.current_key_epoch]; end if;
  if v.rotation_state = 'PREPARING' then return array[v.current_key_epoch,v.pending_key_epoch]; end if;
  if v.rotation_state = 'DUAL_READ' then return array[v.previous_key_epoch,v.current_key_epoch]; end if;
  if v.rotation_state = 'RETIRING' then return array[v.current_key_epoch]; end if;
  raise exception 'LOOKUP_CONTROL_UNAVAILABLE';
end;
$f23_3e_p4a_internal_target_epochs$;

create function public.f23_3e_p4a_internal_assert_actor(
  p_center_id text, p_actor_user_id uuid, p_admin_only boolean
)
returns void language plpgsql stable security definer set search_path = ''
as $f23_3e_p4a_internal_assert_actor$
declare v_role text;
begin
  if p_center_id is null or p_actor_user_id is null then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select pg_catalog.lower(cm.role) into v_role from public.center_members cm
  join public.centers c on c.id = cm.center_id and pg_catalog.lower(c.status) = 'active'
  join public.center_crm_control r on r.center_id = cm.center_id
    and r.crm_state = 'ACTIVE' and r.feature_flag_state = 'ENABLED'
  where cm.center_id = p_center_id and cm.user_id = p_actor_user_id and cm.status = 'active';
  if not found or v_role not in ('owner','admin','center_admin','qtv','consultant')
     or (p_admin_only and v_role not in ('owner','admin','center_admin','qtv')) then
    raise exception 'RESOURCE_NOT_AVAILABLE';
  end if;
end;
$f23_3e_p4a_internal_assert_actor$;

create function public.f23_3e_p4a_internal_assert_projection(p_center_id text, p_contact_id uuid)
returns void language plpgsql stable security definer set search_path = ''
as $f23_3e_p4a_internal_assert_projection$
declare v_contact public.crm_contact%rowtype; v_expected bytea[]; v_count integer;
begin
  select c.* into v_contact from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id;
  if not found then return; end if;
  select pg_catalog.count(*)::integer,
         pg_catalog.array_agg(e.lookup_digest order by e.lookup_digest)
    into v_count, v_expected
  from public.crm_contact_lookup_evidence e
  where e.center_id = p_center_id and e.crm_contact_id = p_contact_id
    and e.evidence_status = 'ACTIVE';
  if exists (select 1 from public.crm_contact_lookup_evidence e
             where e.center_id=p_center_id and e.crm_contact_id=p_contact_id)
     and (v_count < 1 or v_contact.normalization_version <> 1
          or v_contact.contact_methods_crypto_version <> 2
          or v_contact.normalized_lookup_digests is distinct from v_expected) then
    raise exception 'LOOKUP_PROJECTION_INVARIANT_VIOLATION';
  end if;
end;
$f23_3e_p4a_internal_assert_projection$;

create function public.f23_3e_p4a_internal_projection_constraint()
returns trigger language plpgsql security definer set search_path = ''
as $f23_3e_p4a_internal_projection_constraint$
begin
  perform public.f23_3e_p4a_internal_assert_projection(
    case when tg_op='DELETE' then old.center_id else new.center_id end,
    case when tg_op='DELETE' then old.crm_contact_id else new.crm_contact_id end
  );
  return null;
end;
$f23_3e_p4a_internal_projection_constraint$;

create constraint trigger f23_3e_p4a_contact_projection_constraint
after insert or update on public.crm_contact deferrable initially deferred
for each row execute function public.f23_3e_p4a_internal_projection_constraint();
create constraint trigger f23_3e_p4a_evidence_projection_constraint
after insert or update or delete on public.crm_contact_lookup_evidence deferrable initially deferred
for each row execute function public.f23_3e_p4a_internal_projection_constraint();

-- External service-only ingress. The future Edge bridge must derive actor and
-- center from an authenticated JWT; the browser never receives service_role.
create function public.f23_3e_p4a_ingress_canonical_contact(
  p_center_id text,
  p_actor_user_id uuid,
  p_source_record_id text,
  p_display_name text,
  p_phones text[],
  p_emails text[]
)
returns table(ok boolean, outcome_code text, replayed boolean,
  crm_contact_id uuid, contact_version integer, correlation_id uuid)
language plpgsql security definer set search_path = ''
as $f23_3e_p4a_ingress_canonical_contact$
declare v_control public.crm_contact_lookup_control%rowtype; v_existing public.crm_contact%rowtype;
  v_payload record; v_existing_payload bytea; v_parsed record; v_contact_id uuid;
  v_epochs integer[]; v_epoch integer; v_key bytea; v_value text; v_digest bytea;
  v_digests bytea[] := array[]::bytea[]; v_version integer; v_corr uuid := pg_catalog.gen_random_uuid();
begin
  if p_source_record_id is null or pg_catalog.length(pg_catalog.btrim(p_source_record_id)) not between 1 and 200
     or p_source_record_id ~ '[[:cntrl:]]'
     or p_display_name is null or pg_catalog.length(pg_catalog.btrim(p_display_name)) not between 1 and 240
     or p_display_name ~ '[[:cntrl:]]' then raise exception 'INVALID_INPUT'; end if;
  perform public.f23_3e_p4a_internal_assert_actor(p_center_id,p_actor_user_id,false);
  perform r.center_id from public.center_crm_control r
    where r.center_id=p_center_id and r.crm_state='ACTIVE' and r.feature_flag_state='ENABLED'
    for update;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select c.* into v_control from public.crm_contact_lookup_control c
    where c.center_id=p_center_id for update;
  if not found then raise exception 'LOOKUP_CONTROL_UNAVAILABLE'; end if;
  select * into strict v_payload from public.f23_3e_p4a_internal_canonical_payload(p_phones,p_emails);
  select c.* into v_existing from public.crm_contact c
  where c.center_id=p_center_id and c.legacy_source_kind='local.parent_consultation.v1'
    and c.legacy_source_id=p_source_record_id for update;
  if found then
    begin
      v_existing_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
        p_center_id,v_existing.crm_contact_id,v_existing.contact_version);
      select * into strict v_parsed from public.f23_3e_p4a_internal_parse_payload_v1(v_existing_payload);
    exception when others then raise exception 'INGRESS_CONFLICT'; end;
    if v_existing.display_name is distinct from pg_catalog.btrim(p_display_name)
       or v_existing.source_category <> 'PARENT_CONSULTATION'
       or v_parsed.canonical_phones is distinct from v_payload.canonical_phones
       or v_parsed.canonical_emails is distinct from v_payload.canonical_emails then
      raise exception 'INGRESS_CONFLICT';
    end if;
    return query select true,'CANONICAL_CONTACT_INGRESSED',true,
      v_existing.crm_contact_id,v_existing.contact_version,null::uuid;
    return;
  end if;
  v_epochs := public.f23_3e_p4a_internal_target_epochs(p_center_id);
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'PHONE',v_value,v_epoch);
      v_digests := v_digests || v_digest;
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'EMAIL',v_value,v_epoch);
      v_digests := v_digests || v_digest;
    end loop;
  end loop;
  select pg_catalog.array_agg(x order by x) into v_digests
    from (select distinct pg_catalog.unnest(v_digests) x) q;
  v_contact_id := pg_catalog.gen_random_uuid();
  perform pg_catalog.set_config('ichess.p4a_lookup_write','on',true);
  insert into public.crm_contact(
    crm_contact_id,center_id,display_name,source_category,
    protected_contact_methods_ciphertext,contact_methods_crypto_version,
    normalized_lookup_digests,normalization_version,legacy_source_kind,
    legacy_source_id,legacy_source_center_id,import_batch_id,created_by_user_id
  ) values (
    v_contact_id,p_center_id,pg_catalog.btrim(p_display_name),'PARENT_CONSULTATION',
    pg_catalog.decode('00','hex'),1,v_digests,1,'local.parent_consultation.v1',
    p_source_record_id,p_center_id,pg_catalog.gen_random_uuid(),p_actor_user_id
  );
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      insert into public.crm_contact_lookup_evidence(center_id,crm_contact_id,field_kind,
        normalizer_version,digest_contract_version,key_epoch,lookup_digest)
      values(p_center_id,v_contact_id,'PHONE',1,1,v_epoch,
        public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'PHONE',v_value,v_epoch));
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      insert into public.crm_contact_lookup_evidence(center_id,crm_contact_id,field_kind,
        normalizer_version,digest_contract_version,key_epoch,lookup_digest)
      values(p_center_id,v_contact_id,'EMAIL',1,1,v_epoch,
        public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'EMAIL',v_value,v_epoch));
    end loop;
  end loop;
  select p.contact_version into strict v_version
  from public.f23_3e_p3c_internal_protect_contact_source_evidence(
    p_center_id,v_contact_id,1,v_payload.payload) p;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id,'crm.contact.canonical_ingressed',p_actor_user_id,'crm_contact',v_contact_id,
    null,null,1,v_version,'NEW','canonical_contact_ingressed',
    'crm.contact.canonical_ingress','CANONICAL_CONTACT_INGRESSED',v_corr);
  return query select true,'CANONICAL_CONTACT_INGRESSED',false,v_contact_id,v_version,v_corr;
end;
$f23_3e_p4a_ingress_canonical_contact$;

create function public.f23_3e_p4a_reingest_canonical_contact(
  p_center_id text, p_actor_user_id uuid, p_contact_id uuid, p_expected_contact_version integer
)
returns table(ok boolean,outcome_code text,replayed boolean,crm_contact_id uuid,
  contact_version integer,correlation_id uuid)
language plpgsql security definer set search_path = ''
as $f23_3e_p4a_reingest_canonical_contact$
declare v_control public.crm_contact_lookup_control%rowtype; v_contact public.crm_contact%rowtype;
  v_payload bytea; v_parsed record; v_epochs integer[]; v_epoch integer; v_key bytea;
  v_value text; v_digest bytea; v_digests bytea[]:=array[]::bytea[];
  v_existing bytea[]; v_corr uuid:=pg_catalog.gen_random_uuid(); v_prev integer;
begin
  if p_contact_id is null or p_expected_contact_version is null or p_expected_contact_version<1 then raise exception 'INVALID_INPUT'; end if;
  perform public.f23_3e_p4a_internal_assert_actor(p_center_id,p_actor_user_id,true);
  perform r.center_id from public.center_crm_control r
    where r.center_id=p_center_id and r.crm_state='ACTIVE' and r.feature_flag_state='ENABLED'
    for update;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select c.* into v_control from public.crm_contact_lookup_control c where c.center_id=p_center_id for update;
  select c.* into v_contact from public.crm_contact c
    where c.center_id=p_center_id and c.crm_contact_id=p_contact_id for update;
  if not found or v_contact.contact_version<>p_expected_contact_version or v_contact.contact_status='ARCHIVED'
     or v_contact.legacy_source_kind<>'local.parent_consultation.v1' then raise exception 'CONTACT_VERSION_STALE'; end if;
  begin
    v_payload:=public.f23_3e_p3c_internal_unwrap_contact_source_evidence(p_center_id,p_contact_id,p_expected_contact_version);
    select * into strict v_parsed from public.f23_3e_p4a_internal_parse_payload_v1(v_payload);
  exception when others then raise exception 'CONTACT_PAYLOAD_UNSUPPORTED'; end;
  v_epochs:=public.f23_3e_p4a_internal_target_epochs(p_center_id);
  foreach v_epoch in array v_epochs loop
    v_key:=public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_parsed.canonical_phones loop
      v_digest:=public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'PHONE',v_value,v_epoch);
      v_digests:=v_digests||v_digest;
    end loop;
    foreach v_value in array v_parsed.canonical_emails loop
      v_digest:=public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'EMAIL',v_value,v_epoch);
      v_digests:=v_digests||v_digest;
    end loop;
  end loop;
  select pg_catalog.array_agg(x order by x) into v_digests from (select distinct pg_catalog.unnest(v_digests)x)q;
  select pg_catalog.array_agg(e.lookup_digest order by e.lookup_digest) into v_existing
    from public.crm_contact_lookup_evidence e where e.center_id=p_center_id
    and e.crm_contact_id=p_contact_id and e.evidence_status='ACTIVE';
  if v_existing is not distinct from v_digests and v_contact.normalized_lookup_digests is not distinct from v_digests then
    return query select true,'CANONICAL_CONTACT_REINGESTED',true,p_contact_id,v_contact.contact_version,null::uuid; return;
  end if;
  perform pg_catalog.set_config('ichess.p4a_lookup_write','on',true);
  foreach v_epoch in array v_epochs loop
    v_key:=public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_parsed.canonical_phones loop
      v_digest:=public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'PHONE',v_value,v_epoch);
      if exists(select 1 from public.crm_contact_lookup_evidence e where e.center_id=p_center_id and e.crm_contact_id=p_contact_id and e.lookup_digest=v_digest and e.evidence_status='RETIRED') then raise exception 'LOOKUP_EVIDENCE_REACTIVATION_DENIED'; end if;
      insert into public.crm_contact_lookup_evidence(center_id,crm_contact_id,field_kind,normalizer_version,digest_contract_version,key_epoch,lookup_digest)
      values(p_center_id,p_contact_id,'PHONE',1,1,v_epoch,v_digest) on conflict do nothing;
    end loop;
    foreach v_value in array v_parsed.canonical_emails loop
      v_digest:=public.f23_3e_p4a_internal_lookup_digest(v_key,p_center_id,'EMAIL',v_value,v_epoch);
      if exists(select 1 from public.crm_contact_lookup_evidence e where e.center_id=p_center_id and e.crm_contact_id=p_contact_id and e.lookup_digest=v_digest and e.evidence_status='RETIRED') then raise exception 'LOOKUP_EVIDENCE_REACTIVATION_DENIED'; end if;
      insert into public.crm_contact_lookup_evidence(center_id,crm_contact_id,field_kind,normalizer_version,digest_contract_version,key_epoch,lookup_digest)
      values(p_center_id,p_contact_id,'EMAIL',1,1,v_epoch,v_digest) on conflict do nothing;
    end loop;
  end loop;
  update public.crm_contact_lookup_evidence e set evidence_status='RETIRED',evidence_version=e.evidence_version+1
   where e.center_id=p_center_id and e.crm_contact_id=p_contact_id and e.evidence_status='ACTIVE'
     and not (e.lookup_digest=any(v_digests));
  v_prev:=v_contact.contact_version;
  update public.crm_contact c set normalized_lookup_digests=v_digests,
    normalization_version=1,contact_version=c.contact_version+1
    where c.crm_contact_id=p_contact_id returning c.contact_version into v_contact.contact_version;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id,'crm.contact.lookup_reingested',p_actor_user_id,'crm_contact',p_contact_id,
    null,null,v_prev,v_contact.contact_version,v_contact.contact_status,'contact_lookup_reingested',
    'crm.contact.lookup_reingest','CANONICAL_CONTACT_REINGESTED',v_corr);
  return query select true,'CANONICAL_CONTACT_REINGESTED',false,p_contact_id,v_contact.contact_version,v_corr;
end;
$f23_3e_p4a_reingest_canonical_contact$;

create function public.f23_3e_p4a_transition_lookup_key_epoch(
  p_center_id text,p_actor_user_id uuid,p_expected_control_version integer,
  p_transition text,p_new_key_epoch integer
)
returns table(ok boolean,outcome_code text,replayed boolean,rotation_state text,
  current_key_epoch integer,previous_key_epoch integer,pending_key_epoch integer,
  control_version integer,correlation_id uuid)
language plpgsql security definer set search_path = ''
as $f23_3e_p4a_transition_lookup_key_epoch$
declare v public.crm_contact_lookup_control%rowtype; v_prev integer; v_corr uuid:=pg_catalog.gen_random_uuid();
begin
  if p_transition not in ('BEGIN_ROTATION','ACTIVATE_ROTATION','BEGIN_RETIREMENT','COMPLETE_RETIREMENT')
     or p_expected_control_version is null or p_expected_control_version<1 then raise exception 'INVALID_INPUT'; end if;
  perform public.f23_3e_p4a_internal_assert_actor(p_center_id,p_actor_user_id,true);
  perform r.center_id from public.center_crm_control r
    where r.center_id=p_center_id and r.crm_state='ACTIVE' and r.feature_flag_state='ENABLED'
    for update;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select c.* into v from public.crm_contact_lookup_control c where c.center_id=p_center_id for update;
  if not found then raise exception 'LOOKUP_CONTROL_UNAVAILABLE'; end if;
  -- State-bound exact replay is evaluated before the stale expected-version check.
  if (p_transition='BEGIN_ROTATION' and v.rotation_state='PREPARING' and v.pending_key_epoch=p_new_key_epoch)
     or (p_transition='ACTIVATE_ROTATION' and v.rotation_state='DUAL_READ' and v.current_key_epoch=p_new_key_epoch)
     or (p_transition='BEGIN_RETIREMENT' and v.rotation_state='RETIRING' and v.current_key_epoch=p_new_key_epoch)
     or (p_transition='COMPLETE_RETIREMENT' and v.rotation_state='ACTIVE' and v.current_key_epoch=p_new_key_epoch) then
    return query select true,'LOOKUP_EPOCH_TRANSITIONED',true,v.rotation_state,v.current_key_epoch,
      v.previous_key_epoch,v.pending_key_epoch,v.control_version,null::uuid; return;
  end if;
  if v.control_version<>p_expected_control_version then raise exception 'LOOKUP_CONTROL_VERSION_STALE'; end if;
  perform pg_catalog.set_config('ichess.p4a_lookup_write','on',true);
  v_prev:=v.control_version;
  if p_transition='BEGIN_ROTATION' then
    if v.rotation_state<>'ACTIVE' or p_new_key_epoch<>v.current_key_epoch+1 then raise exception 'LOOKUP_ROTATION_STATE_CONFLICT'; end if;
    perform public.f23_3e_p4a_internal_lookup_key(p_new_key_epoch);
    update public.crm_contact_lookup_control c set rotation_state='PREPARING',pending_key_epoch=p_new_key_epoch,
      control_version=c.control_version+1 where c.center_id=p_center_id returning c.* into v;
  elsif p_transition='ACTIVATE_ROTATION' then
    if v.rotation_state<>'PREPARING' or p_new_key_epoch<>v.pending_key_epoch then raise exception 'LOOKUP_ROTATION_STATE_CONFLICT'; end if;
    if exists(
      select 1 from public.crm_contact c
      where c.center_id=p_center_id and c.legacy_source_kind='local.parent_consultation.v1' and c.contact_status<>'ARCHIVED'
      and not exists(select 1 from public.crm_contact_lookup_evidence e where e.center_id=c.center_id and e.crm_contact_id=c.crm_contact_id and e.key_epoch=v.current_key_epoch and e.evidence_status='ACTIVE')
    ) or exists(
      select 1 from public.crm_contact c
      where c.center_id=p_center_id and c.legacy_source_kind='local.parent_consultation.v1' and c.contact_status<>'ARCHIVED'
      and not exists(select 1 from public.crm_contact_lookup_evidence e where e.center_id=c.center_id and e.crm_contact_id=c.crm_contact_id and e.key_epoch=v.pending_key_epoch and e.evidence_status='ACTIVE')
    ) then raise exception 'LOOKUP_ROTATION_REINGEST_INCOMPLETE'; end if;
    update public.crm_contact_lookup_control c set rotation_state='DUAL_READ',previous_key_epoch=c.current_key_epoch,
      current_key_epoch=c.pending_key_epoch,pending_key_epoch=null,control_version=c.control_version+1
      where c.center_id=p_center_id returning c.* into v;
  elsif p_transition='BEGIN_RETIREMENT' then
    if v.rotation_state<>'DUAL_READ' or p_new_key_epoch<>v.current_key_epoch then raise exception 'LOOKUP_ROTATION_STATE_CONFLICT'; end if;
    if exists(
      select 1 from public.guardian_profile g
      where g.center_id=p_center_id and g.guardian_status<>'ARCHIVED'
      and exists(select 1 from public.crm_contact_lookup_evidence e
        where e.center_id=p_center_id and e.key_epoch=v.previous_key_epoch
          and e.lookup_digest=any(g.normalized_lookup_digests))
    ) then raise exception 'LOOKUP_EPOCH_DEPENDENCY_ACTIVE'; end if;
    update public.crm_contact_lookup_control c set rotation_state='RETIRING',control_version=c.control_version+1
      where c.center_id=p_center_id returning c.* into v;
  else
    if v.rotation_state<>'RETIRING' or p_new_key_epoch<>v.current_key_epoch then raise exception 'LOOKUP_ROTATION_STATE_CONFLICT'; end if;
    if exists(
      select 1 from public.guardian_profile g
      where g.center_id=p_center_id and g.guardian_status<>'ARCHIVED'
      and exists(select 1 from public.crm_contact_lookup_evidence e
        where e.center_id=p_center_id and e.key_epoch=v.previous_key_epoch
          and e.lookup_digest=any(g.normalized_lookup_digests))
    ) then raise exception 'LOOKUP_EPOCH_DEPENDENCY_ACTIVE'; end if;
    if exists(select 1 from public.crm_contact_lookup_evidence e where e.center_id=p_center_id and e.key_epoch=v.previous_key_epoch and e.evidence_status='ACTIVE') then raise exception 'LOOKUP_RETIREMENT_REINGEST_INCOMPLETE'; end if;
    update public.crm_contact_lookup_control c set rotation_state='ACTIVE',previous_key_epoch=null,
      control_version=c.control_version+1 where c.center_id=p_center_id returning c.* into v;
  end if;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id,'crm.contact.lookup_epoch_transitioned',p_actor_user_id,'crm_contact_lookup_control',
    v.contact_lookup_control_id,null,null,v_prev,v.control_version,v.rotation_state,
    'contact_lookup_epoch_transitioned','crm.contact.lookup_epoch_transition',
    'LOOKUP_EPOCH_TRANSITIONED',v_corr);
  return query select true,'LOOKUP_EPOCH_TRANSITIONED',false,v.rotation_state,v.current_key_epoch,
    v.previous_key_epoch,v.pending_key_epoch,v.control_version,v_corr;
end;
$f23_3e_p4a_transition_lookup_key_epoch$;

create function public.f23_3e_p4a_read_contact_ingress_status(
  p_center_id text,p_actor_user_id uuid,p_contact_id uuid
)
returns table(ok boolean,outcome_code text,crm_contact_id uuid,contact_version integer,
  contact_status text,normalization_version integer,contact_methods_crypto_version integer,
  active_lookup_evidence_count integer,active_key_epochs integer[])
language plpgsql security definer stable set search_path = ''
as $f23_3e_p4a_read_contact_ingress_status$
declare v public.crm_contact%rowtype;
begin
  perform public.f23_3e_p4a_internal_assert_actor(p_center_id,p_actor_user_id,true);
  select c.* into v from public.crm_contact c where c.center_id=p_center_id and c.crm_contact_id=p_contact_id;
  if not found or v.legacy_source_kind<>'local.parent_consultation.v1' then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  return query select true,'CANONICAL_CONTACT_STATUS_READ',v.crm_contact_id,v.contact_version,
    v.contact_status,v.normalization_version,v.contact_methods_crypto_version,
    (select pg_catalog.count(*)::integer from public.crm_contact_lookup_evidence e where e.center_id=p_center_id and e.crm_contact_id=p_contact_id and e.evidence_status='ACTIVE'),
    (select pg_catalog.array_agg(distinct e.key_epoch order by e.key_epoch) from public.crm_contact_lookup_evidence e where e.center_id=p_center_id and e.crm_contact_id=p_contact_id and e.evidence_status='ACTIVE');
end;
$f23_3e_p4a_read_contact_ingress_status$;

-- Default function privileges are not an authority boundary. Revoke every P4A
-- helper and service RPC first, then expose exactly four service-only RPCs.
do $f23_3e_p4a_revoke_all$
declare v record;
begin
  for v in
    select p.oid::regprocedure as signature from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4a_%'
  loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role',v.signature);
  end loop;
end;
$f23_3e_p4a_revoke_all$;

grant execute on function public.f23_3e_p4a_ingress_canonical_contact(text,uuid,text,text,text[],text[]) to service_role;
grant execute on function public.f23_3e_p4a_reingest_canonical_contact(text,uuid,uuid,integer) to service_role;
grant execute on function public.f23_3e_p4a_transition_lookup_key_epoch(text,uuid,integer,text,integer) to service_role;
grant execute on function public.f23_3e_p4a_read_contact_ingress_status(text,uuid,uuid) to service_role;

comment on function public.f23_3e_p4a_ingress_canonical_contact(text,uuid,text,text,text[],text[]) is
  'Service-only canonical Contact ingress. A trusted server bridge must derive center and actor from Auth truth.';
comment on table public.crm_contact_lookup_evidence is
  'Protected P4A keyed lookup evidence; contains no plaintext phone/email and is never directly exposed.';

commit;
