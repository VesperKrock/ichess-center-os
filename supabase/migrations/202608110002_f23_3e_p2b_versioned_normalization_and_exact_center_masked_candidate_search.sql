-- F23.3E-P2B: protected versioned normalization and exact-center masked
-- candidate search. This migration creates no business table, review,
-- reservation, profile, relationship, approval, or conversion executor.

begin;

set local check_function_bodies = true;

do $f23_3e_p2b_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case') is null
     or pg_catalog.to_regclass('public.consultation_case_candidate_student') is null
     or pg_catalog.to_regclass('public.consultation_case_assignment') is null
     or pg_catalog.to_regclass('public.crm_conversion_request') is null
     or pg_catalog.to_regclass('public.crm_identity_policy_registry') is null
     or pg_catalog.to_regclass('public.crm_identity_match_mutex') is null
     or pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('vault.decrypted_secrets') is null
     or pg_catalog.to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'f23_3e_p2b_missing_protected_prerequisite';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p2b_missing_service_role';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p2b_%'
  ) then
    raise exception 'f23_3e_p2b_runtime_already_exists';
  end if;
end;
$f23_3e_p2b_prerequisites$;

create function public.f23_3e_p2b_internal_digest_key(p_digest_key_epoch integer)
returns bytea
language plpgsql
security definer
stable
set search_path = ''
as $f23_3e_p2b_internal_digest_key$
declare
  v_secret_name text;
  v_secret_value text;
  v_secret_count integer;
begin
  if p_digest_key_epoch is null or p_digest_key_epoch < 1 then
    raise exception 'f23_3e_p2b_key_epoch_invalid';
  end if;

  -- This deterministic label is not key material. The value is provisioned
  -- outside migrations in Supabase Vault; callers can neither supply nor read it.
  v_secret_name := 'f23_3e_p2b_identity_digest_epoch_' || p_digest_key_epoch::text;
  select pg_catalog.count(*)::integer, pg_catalog.min(s.decrypted_secret)
  into v_secret_count, v_secret_value
  from vault.decrypted_secrets s
  where s.name = v_secret_name;

  if v_secret_count <> 1
     or v_secret_value is null
     or v_secret_value !~ '^[0-9A-Fa-f]{64}$' then
    raise exception 'f23_3e_p2b_protected_key_unavailable';
  end if;

  return pg_catalog.decode(v_secret_value, 'hex');
end;
$f23_3e_p2b_internal_digest_key$;

create function public.f23_3e_p2b_internal_normalize_student_name_v1(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $f23_3e_p2b_internal_normalize_student_name_v1$
declare
  v_value text;
begin
  if p_value is null or pg_catalog.length(p_value) > 1024 or p_value ~ '[[:cntrl:]]' then
    raise exception 'f23_3e_p2b_name_evidence_invalid';
  end if;

  -- V1: NFC; canonical apostrophe/dash variants; trim/collapse whitespace;
  -- remove whitespace adjacent to apostrophe/hyphen; locale-backed lowercase.
  -- Vietnamese diacritics are deliberately preserved.
  v_value := normalize(p_value, NFC);
  v_value := pg_catalog.translate(
    v_value,
    U&'\2018\2019\02BC\2010\2011\2012\2013\2014\2212',
    U&'\0027\0027\0027\002D\002D\002D\002D\002D\002D'
  );
  v_value := pg_catalog.regexp_replace(v_value, '[[:space:]]+', ' ', 'g');
  v_value := pg_catalog.btrim(v_value);
  v_value := pg_catalog.regexp_replace(
    v_value,
    $p2b_regex$[[:space:]]*([-'])[[:space:]]*$p2b_regex$,
    $p2b_replacement$\1$p2b_replacement$,
    'g'
  );
  v_value := pg_catalog.lower(v_value);

  if pg_catalog.length(v_value) not between 1 and 240 then
    raise exception 'f23_3e_p2b_name_evidence_invalid';
  end if;
  return v_value;
end;
$f23_3e_p2b_internal_normalize_student_name_v1$;

create function public.f23_3e_p2b_internal_normalize_student_birth_v1(p_value date)
returns text
language plpgsql
stable
set search_path = ''
as $f23_3e_p2b_internal_normalize_student_birth_v1$
begin
  if p_value is null
     or p_value < date '1900-01-01'
     or p_value > current_date then
    raise exception 'f23_3e_p2b_birth_evidence_invalid';
  end if;
  return pg_catalog.to_char(p_value, 'YYYY-MM-DD');
end;
$f23_3e_p2b_internal_normalize_student_birth_v1$;

create function public.f23_3e_p2b_internal_evidence_digest(
  p_key bytea,
  p_normalization_algorithm text,
  p_normalization_version integer,
  p_identity_kind text,
  p_evidence_kind text,
  p_canonical_value text,
  p_digest_key_epoch integer
)
returns bytea
language sql
immutable
set search_path = ''
as $f23_3e_p2b_internal_evidence_digest$
  select extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'digest_schema_version', 1,
      'normalization_algorithm', p_normalization_algorithm,
      'normalization_version', p_normalization_version,
      'identity_kind', p_identity_kind,
      'evidence_kind', p_evidence_kind,
      'canonical_normalized_value', p_canonical_value,
      'digest_key_epoch', p_digest_key_epoch
    )::text, 'UTF8'),
    p_key,
    'sha256'
  )
$f23_3e_p2b_internal_evidence_digest$;

create function public.f23_3e_p2b_internal_mutex_key(
  p_key bytea,
  p_environment_fingerprint bytea,
  p_center_id text,
  p_identity_kind text,
  p_normalization_version integer,
  p_evidence_digest bytea
)
returns bytea
language sql
immutable
set search_path = ''
as $f23_3e_p2b_internal_mutex_key$
  select extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'mutex_schema_version', 1,
      'environment_fingerprint', pg_catalog.encode(p_environment_fingerprint, 'hex'),
      'center_id', p_center_id,
      'identity_kind', p_identity_kind,
      'normalization_version', p_normalization_version,
      'canonical_normalized_identity_digest', pg_catalog.encode(p_evidence_digest, 'hex')
    )::text, 'UTF8'),
    p_key,
    'sha256'
  )
$f23_3e_p2b_internal_mutex_key$;

create function public.f23_3e_p2b_internal_environment_fingerprint(p_digest_key_epoch integer)
returns bytea
language sql
security definer
stable
set search_path = ''
as $f23_3e_p2b_internal_environment_fingerprint$
  select extensions.hmac(
    pg_catalog.convert_to('f23.3e.p2b/environment-fingerprint/v1', 'UTF8'),
    public.f23_3e_p2b_internal_digest_key(p_digest_key_epoch),
    'sha256'
  )
$f23_3e_p2b_internal_environment_fingerprint$;

create function public.f23_3e_p2b_internal_opaque_uuid(p_digest bytea)
returns uuid
language sql
immutable
set search_path = ''
as $f23_3e_p2b_internal_opaque_uuid$
  select (
    pg_catalog.substr(pg_catalog.encode(p_digest, 'hex'), 1, 8) || '-' ||
    pg_catalog.substr(pg_catalog.encode(p_digest, 'hex'), 9, 4) || '-' ||
    pg_catalog.substr(pg_catalog.encode(p_digest, 'hex'), 13, 4) || '-' ||
    pg_catalog.substr(pg_catalog.encode(p_digest, 'hex'), 17, 4) || '-' ||
    pg_catalog.substr(pg_catalog.encode(p_digest, 'hex'), 21, 12)
  )::uuid
$f23_3e_p2b_internal_opaque_uuid$;

create function public.f23_3e_p2b_internal_safe_result(
  p_outcome_code text,
  p_match_outcome text default null,
  p_reason_code text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $f23_3e_p2b_internal_safe_result$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'ok', false,
    'outcome_code', p_outcome_code,
    'match_outcome', p_match_outcome,
    'safe_reason_code', p_reason_code,
    'candidate_projection_version', 1,
    'projection_cache_policy', 'NO_STORE',
    'server_time', pg_catalog.clock_timestamp()
  ))
$f23_3e_p2b_internal_safe_result$;

create function public.f23_3e_p2b_internal_search_masked_candidates(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_identity_kind text,
  p_candidate_student_id uuid,
  p_expected_contact_version integer,
  p_expected_case_version integer,
  p_expected_candidate_version integer,
  p_display_name_evidence text,
  p_birth_date_evidence date,
  p_birth_year_evidence integer,
  p_expected_normalization_version integer,
  p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,
  p_expected_policy_registry_version integer,
  p_expected_adapter_version integer,
  p_detail_opaque_candidate_id uuid,
  p_expected_target_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2b_internal_search_masked_candidates$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_member_role text;
  v_is_manager boolean := false;
  v_is_consultant boolean := false;
  v_key bytea;
  v_name_normalized text;
  v_birth_normalized text;
  v_candidate_name_normalized text;
  v_name_digest bytea;
  v_birth_digest bytea;
  v_environment_fingerprint bytea;
  v_mutex_keys bytea[] := array[]::bytea[];
  v_mutex_key bytea;
  v_mutex_count integer := 0;
  v_evidence_set_digest bytea;
  v_mutex_set_digest bytea;
  v_adapter_material text := '';
  v_adapter_snapshot_digest bytea;
  v_projection_snapshot_digest bytea;
  v_row record;
  v_row_birth date;
  v_row_name text;
  v_row_snapshot_digest bytea;
  v_target_version integer;
  v_target_snapshot_reference uuid;
  v_exact_count integer := 0;
  v_same_name_count integer := 0;
  v_candidates jsonb := '[]'::jsonb;
  v_reason_code text;
  v_match_outcome text;
  v_outcome_code text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_expires_at timestamptz;
begin
  perform pg_catalog.set_config('lock_timeout', '2000ms', true);

  if p_conversion_request_id is null
     or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_identity_kind is null or p_identity_kind not in ('STUDENT', 'GUARDIAN')
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_normalization_version is null or p_expected_normalization_version < 1
     or p_expected_match_policy_version is null or p_expected_match_policy_version < 1
     or p_expected_minimum_evidence_policy_version is null or p_expected_minimum_evidence_policy_version < 1
     or p_expected_policy_registry_version is null or p_expected_policy_registry_version < 1
     or p_expected_adapter_version is null or p_expected_adapter_version < 1
     or ((p_detail_opaque_candidate_id is null) <> (p_expected_target_version is null)) then
    return public.f23_3e_p2b_internal_safe_result('INVALID_INPUT');
  end if;

  -- The unlocked selector supplies only the immutable center key. Authoritative
  -- Request state is re-read after root and sorted mutex acquisition.
  select r.center_id into v_center_id
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  -- 1. CENTER_CRM_CONTROL_ROW.
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  select pg_catalog.lower(m.role) into v_member_role
  from public.center_members m
  where m.center_id = v_center_id
    and m.user_id = p_actor_user_id
    and m.status = 'active'
  order by m.id
  limit 1
  for share;
  if not found then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  v_is_manager := v_member_role in ('owner', 'center_admin');
  v_is_consultant := v_member_role = 'consultant';
  if not v_is_manager and not v_is_consultant then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_is_consultant and not exists (
    select 1
    from public.crm_conversion_request rq
    join public.consultation_case_assignment a
      on a.center_id = rq.center_id
     and a.consultation_case_id = rq.consultation_case_id
     and a.assignment_id = rq.source_assignment_id
    where rq.conversion_request_id = p_conversion_request_id
      and a.assigned_consultant_user_id = p_actor_user_id
      and a.assignment_status = 'ACTIVE'
  ) then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  select p.* into v_policy
  from public.crm_identity_policy_registry p
  where p.center_id = v_center_id
    and p.identity_kind = p_identity_kind
    and p.status = 'CURRENT'
  for share;
  if not found
     or v_policy.center_identity_policy_version <> v_root.identity_policy_version then
    return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE');
  end if;
  -- There is no canonical Guardian target adapter. Fail before interpreting
  -- Student-specific source evidence or creating a Guardian mutex resource.
  if p_identity_kind = 'GUARDIAN' then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  end if;
  if v_policy.normalization_algorithm <> 'p2b.student_identity.nfc_casefold_v1'
     or v_policy.normalization_version <> p_expected_normalization_version then
    return public.f23_3e_p2b_internal_safe_result('NORMALIZER_STALE');
  end if;
  if v_policy.match_policy_version <> p_expected_match_policy_version
     or v_policy.minimum_evidence_policy_version <> p_expected_minimum_evidence_policy_version
     or v_policy.policy_registry_version <> p_expected_policy_registry_version then
    return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE');
  end if;
  if p_expected_adapter_version <> 1 then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  end if;

  if p_candidate_student_id is null
     or p_expected_candidate_version is null or p_expected_candidate_version < 1 then
    return public.f23_3e_p2b_internal_safe_result('INVALID_INPUT');
  end if;

  if p_display_name_evidence is null
     or (p_birth_date_evidence is null and p_birth_year_evidence is not null)
     or p_birth_date_evidence is null then
    return public.f23_3e_p2b_internal_safe_result(
      'INSUFFICIENT_IDENTITY_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'
    );
  end if;

  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_environment_fingerprint := public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  if v_environment_fingerprint is distinct from v_policy.environment_fingerprint then
    return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE');
  end if;

  v_name_normalized := public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence);
  v_birth_normalized := public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence);
  v_name_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    p_identity_kind, 'STUDENT_DISPLAY_NAME', v_name_normalized, v_policy.digest_key_epoch
  );
  v_birth_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    p_identity_kind, 'STUDENT_BIRTH_DATE', v_birth_normalized, v_policy.digest_key_epoch
  );

  v_mutex_keys := array[
    public.f23_3e_p2b_internal_mutex_key(
      v_key, v_environment_fingerprint, v_center_id, p_identity_kind,
      v_policy.normalization_version, v_name_digest
    ),
    public.f23_3e_p2b_internal_mutex_key(
      v_key, v_environment_fingerprint, v_center_id, p_identity_kind,
      v_policy.normalization_version, v_birth_digest
    )
  ];

  select pg_catalog.array_agg(d.key order by d.key), pg_catalog.count(*)::integer
  into v_mutex_keys, v_mutex_count
  from (select distinct pg_catalog.unnest(v_mutex_keys) as key) d;
  if v_mutex_count <> 2 then
    raise exception 'f23_3e_p2b_mutex_domain_collision';
  end if;

  -- 2. SORTED_IDENTITY_MUTEX_ROWS: ensure/touch and then lock bytewise.
  foreach v_mutex_key in array v_mutex_keys loop
    insert into public.crm_identity_match_mutex (
      identity_match_mutex_key, environment_fingerprint, center_id, identity_kind,
      identity_policy_registry_id, normalization_version, digest_key_epoch
    ) values (
      v_mutex_key, v_environment_fingerprint, v_center_id, p_identity_kind,
      v_policy.identity_policy_registry_id, v_policy.normalization_version,
      v_policy.digest_key_epoch
    )
    on conflict (identity_match_mutex_key) do update
    set mutex_version = public.crm_identity_match_mutex.mutex_version + 1
    where public.crm_identity_match_mutex.environment_fingerprint = excluded.environment_fingerprint
      and public.crm_identity_match_mutex.center_id = excluded.center_id
      and public.crm_identity_match_mutex.identity_kind = excluded.identity_kind
      and public.crm_identity_match_mutex.identity_policy_registry_id = excluded.identity_policy_registry_id
      and public.crm_identity_match_mutex.normalization_version = excluded.normalization_version
      and public.crm_identity_match_mutex.digest_key_epoch = excluded.digest_key_epoch
      and public.crm_identity_match_mutex.status = 'ACTIVE';
    if not found then
      raise exception 'f23_3e_p2b_mutex_binding_unavailable';
    end if;
  end loop;
  perform 1
  from public.crm_identity_match_mutex m
  where m.identity_match_mutex_key = any(v_mutex_keys)
  order by m.identity_match_mutex_key
  for update;

  -- 3. REQUEST, CONTACT, CASE, CANDIDATE, ASSIGNMENT authoritative recheck.
  select r.* into v_request
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id
  for update;
  if not found or v_request.center_id <> v_center_id then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_request.request_version <> p_expected_request_version
     or v_request.identity_policy_version <> v_root.identity_policy_version then
    return public.f23_3e_p2b_internal_safe_result('SOURCE_VERSION_STALE');
  end if;

  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_request.source_contact_id
  for share;
  select c.* into v_case
  from public.consultation_case c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_request.consultation_case_id
    and c.primary_contact_id = v_request.source_contact_id
  for share;
  select s.* into v_candidate
  from public.consultation_case_candidate_student s
  where s.center_id = v_center_id
    and s.consultation_case_id = v_request.consultation_case_id
    and s.candidate_student_id = p_candidate_student_id
  for share;
  select a.* into v_assignment
  from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = v_request.consultation_case_id
    and a.assignment_id = v_request.source_assignment_id
  for share;

  if v_contact.crm_contact_id is null or v_case.consultation_case_id is null
     or v_candidate.candidate_student_id is null or v_assignment.assignment_id is null then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_version <> v_request.source_contact_version
     or v_case.case_version <> p_expected_case_version
     or v_case.case_version <> v_request.source_case_version
     or v_candidate.candidate_version <> p_expected_candidate_version
     or v_assignment.assignment_version <> v_request.source_assignment_version then
    return public.f23_3e_p2b_internal_safe_result('SOURCE_VERSION_STALE');
  end if;
  if v_is_consultant and (
    v_assignment.assignment_status <> 'ACTIVE'
    or v_assignment.assigned_consultant_user_id <> p_actor_user_id
  ) then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  v_candidate_name_normalized := public.f23_3e_p2b_internal_normalize_student_name_v1(
    v_candidate.display_name_evidence
  );
  if v_candidate_name_normalized <> v_name_normalized then
    return public.f23_3e_p2b_internal_safe_result('SOURCE_VERSION_STALE');
  end if;

  v_evidence_set_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'schema_version', 1,
      'name', pg_catalog.encode(v_name_digest, 'hex'),
      'birth', pg_catalog.encode(v_birth_digest, 'hex')
    )::text, 'UTF8'), v_key, 'sha256'
  );
  v_mutex_set_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.array_to_string(
      array(select pg_catalog.encode(k, 'hex') from pg_catalog.unnest(v_mutex_keys) k order by k), ','
    ), 'UTF8'), v_key, 'sha256'
  );

  -- 4. TARGET ADAPTER ROWS in stable UUID order. Every live Student row must
  -- match the exact source contract; one malformed/unknown row invalidates the
  -- completeness proof and therefore cannot become NO_MATCH.
  for v_row in
    select e.*
    from public.center_cloud_entities e
    where e.center_id = v_center_id
      and e.entity_type = 'student'
      and e.deleted_at is null
    order by e.id
    for share
  loop
    if v_row.source_module <> 'localStorage'
       or v_row.source_version <> 'c2-online-core-v1'
       or pg_catalog.jsonb_typeof(v_row.payload) <> 'object'
       or pg_catalog.jsonb_typeof(v_row.payload -> 'id') <> 'string'
       or v_row.payload ->> 'id' <> v_row.local_id
       or pg_catalog.jsonb_typeof(v_row.payload -> 'fullName') <> 'string'
       or pg_catalog.jsonb_typeof(v_row.payload -> 'birthDate') <> 'string'
       or (v_row.payload ? 'isDeleted' and pg_catalog.jsonb_typeof(v_row.payload -> 'isDeleted') <> 'boolean')
       or v_row.payload ->> 'birthDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'f23_3e_p2b_student_adapter_incomplete';
    end if;

    begin
      v_row_name := public.f23_3e_p2b_internal_normalize_student_name_v1(v_row.payload ->> 'fullName');
      v_row_birth := (v_row.payload ->> 'birthDate')::date;
      if pg_catalog.to_char(v_row_birth, 'YYYY-MM-DD') <> v_row.payload ->> 'birthDate' then
        raise exception 'f23_3e_p2b_student_adapter_birth_invalid';
      end if;
      perform public.f23_3e_p2b_internal_normalize_student_birth_v1(v_row_birth);
    exception when others then
      raise exception 'f23_3e_p2b_student_adapter_incomplete';
    end;

    v_row_snapshot_digest := extensions.hmac(
      pg_catalog.convert_to(pg_catalog.jsonb_build_object(
        'adapter_namespace', 'legacy.center_cloud_student.readonly.v1',
        'adapter_version', 1,
        'center_id', v_center_id,
        'row_id', v_row.id,
        'local_id', v_row.local_id,
        'source_version', v_row.source_version,
        'updated_at', v_row.updated_at,
        'payload', v_row.payload
      )::text, 'UTF8'), v_key, 'sha256'
    );
    v_target_version := (
      (
        (pg_catalog.get_byte(v_row_snapshot_digest, 0)::bigint * 16777216) +
        (pg_catalog.get_byte(v_row_snapshot_digest, 1)::bigint * 65536) +
        (pg_catalog.get_byte(v_row_snapshot_digest, 2)::bigint * 256) +
        pg_catalog.get_byte(v_row_snapshot_digest, 3)::bigint
      ) % 2147483646 + 1
    )::integer;
    v_target_snapshot_reference := public.f23_3e_p2b_internal_opaque_uuid(v_row_snapshot_digest);
    v_adapter_material := v_adapter_material || pg_catalog.encode(v_row_snapshot_digest, 'hex');

    if coalesce((v_row.payload ->> 'isDeleted')::boolean, false) then
      continue;
    end if;

    if v_row_name = v_name_normalized then
      v_same_name_count := v_same_name_count + 1;
      if pg_catalog.to_char(v_row_birth, 'YYYY-MM-DD') = v_birth_normalized then
        v_exact_count := v_exact_count + 1;
        if v_exact_count <= 10
           and (p_detail_opaque_candidate_id is null or p_detail_opaque_candidate_id = v_row.id) then
          if p_detail_opaque_candidate_id = v_row.id
             and p_expected_target_version <> v_target_version then
            return public.f23_3e_p2b_internal_safe_result('TARGET_VERSION_STALE');
          end if;
          v_candidates := v_candidates || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'candidate_projection_version', 1,
            'identity_kind', 'STUDENT',
            'opaque_candidate_id', v_row.id,
            'opaque_target_id', v_row.id,
            'target_adapter_namespace', 'legacy.center_cloud_student.readonly.v1',
            'target_version', v_target_version,
            'masked_attributes', pg_catalog.jsonb_build_array('IDENTITY_REDACTED'),
            'safe_attributes', pg_catalog.jsonb_build_array('CURRENT_STUDENT_RECORD'),
            'evidence_summary_codes', pg_catalog.jsonb_build_array('DISPLAY_NAME_EXACT', 'BIRTH_DATE_EXACT'),
            'match_reason_codes', pg_catalog.jsonb_build_array('NAME_AND_BIRTH_EXACT_CANDIDATE'),
            'normalization_version', v_policy.normalization_version,
            'match_policy_version', v_policy.match_policy_version,
            'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
            'adapter_snapshot_version', 1,
            'target_snapshot_reference', v_target_snapshot_reference,
            'reuse_eligible', false,
            'create_authority', false
          ));
        end if;
      end if;
    end if;
  end loop;

  if p_detail_opaque_candidate_id is not null and pg_catalog.jsonb_array_length(v_candidates) <> 1 then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  v_adapter_snapshot_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'adapter_namespace', 'legacy.center_cloud_student.readonly.v1',
      'adapter_version', 1,
      'complete', true,
      'ordered_row_snapshots', v_adapter_material
    )::text, 'UTF8'), v_key, 'sha256'
  );

  if v_exact_count > 0 then
    v_outcome_code := 'MATCH_REVIEW_REQUIRED';
    v_match_outcome := 'PROBABLE_MATCH';
    v_reason_code := 'NAME_AND_BIRTH_EXACT_CANDIDATE';
  elsif v_same_name_count > 0 then
    v_outcome_code := 'MATCH_REVIEW_REQUIRED';
    v_match_outcome := 'CONFLICT';
    v_reason_code := 'CONTRADICTORY_EVIDENCE';
  else
    v_outcome_code := 'NO_MATCH';
    v_match_outcome := 'NO_MATCH';
    v_reason_code := 'NO_CANDIDATE_AFTER_COMPLETE_SEARCH';
  end if;

  v_expires_at := v_now + interval '5 minutes';
  v_projection_snapshot_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'projection_schema_version', 1,
      'conversion_request_id', v_request.conversion_request_id,
      'request_version', v_request.request_version,
      'contact_version', v_contact.contact_version,
      'case_version', v_case.case_version,
      'candidate_source_version', v_candidate.candidate_version,
      'assignment_version', v_assignment.assignment_version,
      'policy_registry_id', v_policy.identity_policy_registry_id,
      'policy_registry_version', v_policy.policy_registry_version,
      'normalization_version', v_policy.normalization_version,
      'match_policy_version', v_policy.match_policy_version,
      'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
      'adapter_snapshot', pg_catalog.encode(v_adapter_snapshot_digest, 'hex'),
      'evidence_set', pg_catalog.encode(v_evidence_set_digest, 'hex'),
      'mutex_set', pg_catalog.encode(v_mutex_set_digest, 'hex'),
      'outcome_code', v_outcome_code,
      'match_outcome', v_match_outcome,
      'candidates', v_candidates,
      'expires_at', v_expires_at
    )::text, 'UTF8'), v_key, 'sha256'
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', v_outcome_code,
    'match_outcome', v_match_outcome,
    'review_requirement', case when v_outcome_code = 'MATCH_REVIEW_REQUIRED' then 'MATCH_REVIEW_REQUIRED' else 'REVIEW_STILL_REQUIRED_BEFORE_CREATE' end,
    'safe_reason_code', v_reason_code,
    'candidate_projection_version', 1,
    'identity_kind', p_identity_kind,
    'candidates', v_candidates,
    'candidate_count_capped', least(v_exact_count, 10),
    'candidate_limit', 10,
    'request_version', v_request.request_version,
    'source_contact_version', v_contact.contact_version,
    'source_case_version', v_case.case_version,
    'source_candidate_version', v_candidate.candidate_version,
    'source_assignment_version', v_assignment.assignment_version,
    'normalization_algorithm', v_policy.normalization_algorithm,
    'normalization_version', v_policy.normalization_version,
    'match_policy_version', v_policy.match_policy_version,
    'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
    'identity_policy_registry_id', v_policy.identity_policy_registry_id,
    'identity_policy_registry_version', v_policy.policy_registry_version,
    'digest_key_epoch', v_policy.digest_key_epoch,
    'target_adapter_namespace', 'legacy.center_cloud_student.readonly.v1',
    'target_adapter_version', 1,
    'adapter_snapshot_version', 1,
    'adapter_completeness', 'COMPLETE',
    'adapter_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_adapter_snapshot_digest),
    'evidence_set_reference', public.f23_3e_p2b_internal_opaque_uuid(v_evidence_set_digest),
    'mutex_set_reference', public.f23_3e_p2b_internal_opaque_uuid(v_mutex_set_digest),
    'projection_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_projection_snapshot_digest),
    'expires_at', v_expires_at,
    'projection_cache_policy', 'NO_STORE',
    'reuse_eligible', false,
    'create_authority', false,
    'creates_match_review', false,
    'creates_reservation', false,
    'server_time', v_now
  );
exception
  when lock_not_available or query_canceled then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  when others then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
end;
$f23_3e_p2b_internal_search_masked_candidates$;

create function public.f23_3e_p2b_search_masked_candidates(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_identity_kind text,
  p_candidate_student_id uuid,
  p_expected_contact_version integer,
  p_expected_case_version integer,
  p_expected_candidate_version integer,
  p_display_name_evidence text,
  p_birth_date_evidence date,
  p_birth_year_evidence integer,
  p_expected_normalization_version integer,
  p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,
  p_expected_policy_registry_version integer,
  p_expected_adapter_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2b_search_masked_candidates$
begin
  perform pg_catalog.set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  return public.f23_3e_p2b_internal_search_masked_candidates(
    p_conversion_request_id, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version,
    p_display_name_evidence, p_birth_date_evidence, p_birth_year_evidence,
    p_expected_normalization_version, p_expected_match_policy_version,
    p_expected_minimum_evidence_policy_version, p_expected_policy_registry_version,
    p_expected_adapter_version, null, null
  );
end;
$f23_3e_p2b_search_masked_candidates$;

create function public.f23_3e_p2b_get_masked_candidate_review_detail(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_identity_kind text,
  p_candidate_student_id uuid,
  p_expected_contact_version integer,
  p_expected_case_version integer,
  p_expected_candidate_version integer,
  p_display_name_evidence text,
  p_birth_date_evidence date,
  p_birth_year_evidence integer,
  p_expected_normalization_version integer,
  p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,
  p_expected_policy_registry_version integer,
  p_expected_adapter_version integer,
  p_opaque_candidate_id uuid,
  p_expected_target_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2b_get_masked_candidate_review_detail$
begin
  perform pg_catalog.set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  return public.f23_3e_p2b_internal_search_masked_candidates(
    p_conversion_request_id, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version,
    p_display_name_evidence, p_birth_date_evidence, p_birth_year_evidence,
    p_expected_normalization_version, p_expected_match_policy_version,
    p_expected_minimum_evidence_policy_version, p_expected_policy_registry_version,
    p_expected_adapter_version, p_opaque_candidate_id, p_expected_target_version
  );
end;
$f23_3e_p2b_get_masked_candidate_review_detail$;

revoke all on function public.f23_3e_p2b_internal_digest_key(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_normalize_student_name_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_normalize_student_birth_v1(date)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_evidence_digest(bytea,text,integer,text,text,text,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_mutex_key(bytea,bytea,text,text,integer,bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_environment_fingerprint(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_opaque_uuid(bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_safe_result(text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_internal_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p2b_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2b_get_masked_candidate_review_detail(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)
  from public, anon, authenticated, service_role;

grant execute on function public.f23_3e_p2b_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer)
  to service_role;
grant execute on function public.f23_3e_p2b_get_masked_candidate_review_detail(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)
  to service_role;

comment on function public.f23_3e_p2b_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer) is
  'Service-role-only exact-center masked identity candidate search. It creates no review, reservation, profile, or authority.';
comment on function public.f23_3e_p2b_get_masked_candidate_review_detail(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer) is
  'Service-role-only masked detail recheck bound to one opaque candidate and expected target version.';

commit;
