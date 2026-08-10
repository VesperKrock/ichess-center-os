-- F23.3E-P1D: protected typed CRM service operations runtime.
-- Local/backend-only. No browser authority, Auth mutation, network delivery,
-- Edge Function, worker, deployment, remote apply, or final capability resolver.

begin;

set local check_function_bodies = true;

do $f23_3e_p1d_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case') is null
     or pg_catalog.to_regclass('public.consultation_case_assignment') is null
     or pg_catalog.to_regclass('public.crm_care_log') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regclass('public.center_members') is null then
    raise exception 'f23_3e_p1d_missing_schema_prerequisite';
  end if;

  if pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p1c_claim_outbox_batch(text,text,integer,integer)') is null then
    raise exception 'f23_3e_p1d_missing_runtime_prerequisite';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p1d_missing_service_role';
  end if;

  if exists (
    select 1
    from (values
      ('center_id', 'text'::regtype, true),
      ('user_id', 'uuid'::regtype, true),
      ('role', 'text'::regtype, true),
      ('status', 'text'::regtype, true)
    ) as required(attname, atttypid, attnotnull)
    where not exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = 'public.center_members'::regclass
        and a.attname = required.attname
        and a.atttypid = required.atttypid
        and a.attnotnull = required.attnotnull
        and not a.attisdropped
    )
  ) then
    raise exception 'f23_3e_p1d_target_eligibility_catalog_unavailable';
  end if;
end;
$f23_3e_p1d_prerequisites$;

-- These P1A invariant checks are deferred until statement/transaction end. When a
-- P1D RPC is invoked after SET ROLE service_role, the checks therefore execute
-- after the application SECURITY DEFINER frame has returned. Protect the exact
-- inherited checks instead of granting generic CRM table SELECT to service_role.
alter function public.f23_3e_p1a_assert_case_active_assignment() security definer;
alter function public.f23_3e_p1a_assert_assignment_case_root() security definer;

create function public.f23_3e_p1d_internal_is_safe_token(
  p_value text,
  p_max_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $f23_3e_p1d_internal_is_safe_token$
  select p_value is not null
    and p_max_length between 1 and 160
    and pg_catalog.length(p_value) between 1 and p_max_length
    and p_value = pg_catalog.btrim(p_value)
    and p_value ~ '^[a-z][a-z0-9_.-]*$'
$f23_3e_p1d_internal_is_safe_token$;

create function public.f23_3e_p1d_internal_valid_contact_payload(
  p_source_category text,
  p_ciphertext bytea,
  p_crypto_version integer,
  p_lookup_digests bytea[],
  p_normalization_version integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $f23_3e_p1d_internal_valid_contact_payload$
begin
  return public.f23_3e_p1d_internal_is_safe_token(p_source_category, 120)
    and p_ciphertext is not null
    and pg_catalog.octet_length(p_ciphertext) > 0
    and p_crypto_version is not null and p_crypto_version >= 1
    and p_lookup_digests is not null
    and pg_catalog.cardinality(p_lookup_digests) >= 1
    and pg_catalog.array_position(p_lookup_digests, null) is null
    and not exists (
      select 1
      from pg_catalog.unnest(p_lookup_digests) as digest(value)
      where pg_catalog.octet_length(digest.value) <> 32
    )
    and p_normalization_version is not null and p_normalization_version >= 1;
end;
$f23_3e_p1d_internal_valid_contact_payload$;

create function public.f23_3e_p1d_internal_valid_safe_content(p_safe_content text)
returns boolean
language sql
immutable
set search_path = ''
as $f23_3e_p1d_internal_valid_safe_content$
  select p_safe_content is not null
    and pg_catalog.length(pg_catalog.btrim(p_safe_content)) between 1 and 4000
    and p_safe_content !~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    and p_safe_content !~ '(^|[^0-9])((\+?84)|0)[0-9]{8,10}([^0-9]|$)'
$f23_3e_p1d_internal_valid_safe_content$;

create function public.f23_3e_p1d_internal_append_audit_outbox(
  p_center_id text,
  p_event_type text,
  p_actor_user_id uuid,
  p_resource_kind text,
  p_resource_id uuid,
  p_assignment_id uuid,
  p_previous_version integer,
  p_new_version integer,
  p_status text,
  p_safe_reason_code text,
  p_outcome_code text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_internal_append_audit_outbox$
declare
  v_payload jsonb;
begin
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id,
    assignment_id, previous_version, new_version, safe_reason_code, correlation_id
  ) values (
    p_center_id, p_event_type, p_actor_user_id, p_resource_kind, p_resource_id,
    p_assignment_id, p_previous_version, p_new_version, p_safe_reason_code, p_correlation_id
  );

  v_payload := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'event_schema_version', 1,
    'resource_kind', p_resource_kind,
    'resource_id', p_resource_id::text,
    'assignment_id', p_assignment_id::text,
    'previous_version', p_previous_version,
    'new_version', p_new_version,
    'status', p_status,
    'safe_reason_code', p_safe_reason_code,
    'correlation_id', p_correlation_id::text,
    'operation', p_event_type,
    'outcome_code', p_outcome_code
  ));

  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    p_center_id, p_resource_kind, p_resource_id, p_event_type, p_new_version, v_payload
  );
end;
$f23_3e_p1d_internal_append_audit_outbox$;

create function public.f23_3e_p1d_create_crm_contact(
  p_contact_id uuid,
  p_center_id text,
  p_actor_user_id uuid,
  p_source_category text,
  p_protected_contact_methods_ciphertext bytea,
  p_contact_methods_crypto_version integer,
  p_normalized_lookup_digests bytea[],
  p_normalization_version integer
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_create_crm_contact$
declare
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_contact_id is null or p_center_id is null or pg_catalog.btrim(p_center_id) = ''
     or p_actor_user_id is null
     or not public.f23_3e_p1d_internal_valid_contact_payload(
       p_source_category, p_protected_contact_methods_ciphertext,
       p_contact_methods_crypto_version, p_normalized_lookup_digests,
       p_normalization_version
     ) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CREATE_CONTACT_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = p_center_id
  for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 2. PREALLOCATED_CONTACT_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_contact_id::text, 230810));
  select c.* into v_contact
  from public.crm_contact c
  where c.crm_contact_id = p_contact_id
  for update;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_contact_id, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  insert into public.crm_contact (
    crm_contact_id, center_id, source_category,
    protected_contact_methods_ciphertext, contact_methods_crypto_version,
    normalized_lookup_digests, normalization_version, created_by_user_id
  ) values (
    p_contact_id, p_center_id, p_source_category,
    p_protected_contact_methods_ciphertext, p_contact_methods_crypto_version,
    p_normalized_lookup_digests, p_normalization_version, p_actor_user_id
  ) returning * into v_contact;

  -- 3. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    p_center_id, 'crm.contact.created', p_actor_user_id, 'crm_contact', p_contact_id,
    null, null, 1, 'NEW', null, 'CONTACT_CREATED', v_correlation_id
  );
  -- 4. COMMIT_ATOMIC
  -- CREATE_CONTACT_RUNTIME_ATOMIC_END

  return query select true, 'CONTACT_CREATED', p_contact_id, 1,
    null::uuid, null::integer, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_create_crm_contact$;

create function public.f23_3e_p1d_update_crm_contact(
  p_contact_id uuid,
  p_actor_user_id uuid,
  p_expected_contact_version integer,
  p_source_category text,
  p_protected_contact_methods_ciphertext bytea,
  p_contact_methods_crypto_version integer,
  p_normalized_lookup_digests bytea[],
  p_normalization_version integer
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_update_crm_contact$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_previous_version integer;
begin
  if p_contact_id is null or p_actor_user_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or not public.f23_3e_p1d_internal_valid_contact_payload(
       p_source_category, p_protected_contact_methods_ciphertext,
       p_contact_methods_crypto_version, p_normalized_lookup_digests,
       p_normalization_version
     ) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  select c.center_id into v_center_id
  from public.crm_contact c where c.crm_contact_id = p_contact_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CONTACT_MUTATION_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 2. CRM_CONTACT_ROW
  select c.* into v_contact from public.crm_contact c
  where c.crm_contact_id = p_contact_id for update;
  if not found or v_contact.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_version <> p_expected_contact_version then
    return query select false, 'CONTACT_VERSION_STALE', p_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_status = 'ARCHIVED' then
    return query select false, 'CONTACT_STATE_CONFLICT', p_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  v_previous_version := v_contact.contact_version;
  update public.crm_contact c
  set source_category = p_source_category,
      protected_contact_methods_ciphertext = p_protected_contact_methods_ciphertext,
      contact_methods_crypto_version = p_contact_methods_crypto_version,
      normalized_lookup_digests = p_normalized_lookup_digests,
      normalization_version = p_normalization_version,
      contact_version = c.contact_version + 1
  where c.crm_contact_id = p_contact_id
  returning c.* into v_contact;

  -- 3. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.contact.updated', p_actor_user_id, 'crm_contact', p_contact_id,
    null, v_previous_version, v_contact.contact_version, v_contact.contact_status,
    null, 'CONTACT_UPDATED', v_correlation_id
  );
  -- 4. COMMIT_ATOMIC
  -- CONTACT_MUTATION_RUNTIME_ATOMIC_END

  return query select true, 'CONTACT_UPDATED', p_contact_id, v_contact.contact_version,
    null::uuid, null::integer, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_update_crm_contact$;

create function public.f23_3e_p1d_transition_crm_contact_status(
  p_contact_id uuid,
  p_actor_user_id uuid,
  p_expected_contact_version integer,
  p_target_status text,
  p_safe_reason_code text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_transition_crm_contact_status$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_previous_version integer;
begin
  if p_contact_id is null or p_actor_user_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_target_status is null
     or p_target_status not in ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'ARCHIVED')
     or not public.f23_3e_p1d_internal_is_safe_token(p_safe_reason_code, 160) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  select c.center_id into v_center_id from public.crm_contact c
  where c.crm_contact_id = p_contact_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CONTACT_MUTATION_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CRM_CONTACT_ROW
  select c.* into v_contact from public.crm_contact c
  where c.crm_contact_id = p_contact_id for update;
  if not found or v_contact.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_version <> p_expected_contact_version then
    return query select false, 'CONTACT_VERSION_STALE', p_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_status = p_target_status
     or v_contact.contact_status = 'ARCHIVED'
     or not (
       (v_contact.contact_status = 'NEW' and p_target_status in ('CONTACTED','QUALIFIED','UNQUALIFIED','ARCHIVED'))
       or (v_contact.contact_status = 'CONTACTED' and p_target_status in ('QUALIFIED','UNQUALIFIED','ARCHIVED'))
       or (v_contact.contact_status = 'QUALIFIED' and p_target_status in ('UNQUALIFIED','ARCHIVED'))
       or (v_contact.contact_status = 'UNQUALIFIED' and p_target_status in ('CONTACTED','ARCHIVED'))
     ) then
    return query select false, 'CONTACT_STATE_CONFLICT', p_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  v_previous_version := v_contact.contact_version;
  update public.crm_contact c
  set contact_status = p_target_status,
      archived_at = case when p_target_status = 'ARCHIVED' then pg_catalog.clock_timestamp() else null end,
      contact_version = c.contact_version + 1
  where c.crm_contact_id = p_contact_id
  returning c.* into v_contact;

  -- 3. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.contact.status_changed', p_actor_user_id, 'crm_contact', p_contact_id,
    null, v_previous_version, v_contact.contact_version, p_target_status,
    p_safe_reason_code, 'CONTACT_STATUS_CHANGED', v_correlation_id
  );
  -- 4. COMMIT_ATOMIC
  -- CONTACT_MUTATION_RUNTIME_ATOMIC_END

  return query select true, 'CONTACT_STATUS_CHANGED', p_contact_id, v_contact.contact_version,
    null::uuid, null::integer, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_transition_crm_contact_status$;

create function public.f23_3e_p1d_create_consultation_case(
  p_case_id uuid,
  p_primary_contact_id uuid,
  p_actor_user_id uuid,
  p_expected_contact_version integer
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_create_consultation_case$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_case_id is null or p_primary_contact_id is null or p_actor_user_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1 then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.crm_contact c
  where c.crm_contact_id = p_primary_contact_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CREATE_CASE_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CRM_CONTACT_ROW
  select c.* into v_contact from public.crm_contact c
  where c.crm_contact_id = p_primary_contact_id for update;
  if not found or v_contact.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_version <> p_expected_contact_version then
    return query select false, 'CONTACT_VERSION_STALE', p_primary_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_contact.contact_status = 'ARCHIVED' then
    return query select false, 'CONTACT_STATE_CONFLICT', p_primary_contact_id, v_contact.contact_version,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 3. PREALLOCATED_CONSULTATION_CASE_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_case_id::text, 230810));
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_case_id, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  insert into public.consultation_case (
    consultation_case_id, center_id, primary_contact_id, created_by_user_id
  ) values (p_case_id, v_center_id, p_primary_contact_id, p_actor_user_id)
  returning * into v_case;

  -- 4. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.case.created', p_actor_user_id, 'consultation_case', p_case_id,
    null, null, 1, 'OPEN', null, 'CASE_CREATED', v_correlation_id
  );
  -- 5. COMMIT_ATOMIC
  -- CREATE_CASE_RUNTIME_ATOMIC_END

  return query select true, 'CASE_CREATED', p_case_id, 1,
    p_case_id, 1, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_create_consultation_case$;

create function public.f23_3e_p1d_transition_consultation_case_status(
  p_case_id uuid,
  p_actor_user_id uuid,
  p_expected_case_version integer,
  p_target_status text,
  p_safe_reason_code text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_transition_consultation_case_status$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_previous_version integer;
begin
  if p_case_id is null or p_actor_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_target_status is null
     or p_target_status not in ('OPEN','CONSULTING','PAUSED','READY_FOR_CONVERSION','LOST','CANCELLED','ARCHIVED')
     or not public.f23_3e_p1d_internal_is_safe_token(p_safe_reason_code, 160) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CASE_STATUS_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 3. CURRENT_ASSIGNMENT_ROW_IF_ANY
  if v_case.active_assignment_id is not null then
    select a.* into v_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = p_case_id
      and a.assignment_id = v_case.active_assignment_id
    for update;
    if not found or v_assignment.assignment_status <> 'ACTIVE' then
      raise exception 'f23_3e_p1d_case_assignment_pointer_corrupt';
    end if;
  end if;
  if v_case.case_version <> p_expected_case_version then
    return query select false, 'CASE_VERSION_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id,
      case when v_case.active_assignment_id is null then null else v_assignment.assignment_version end,
      null::uuid;
    return;
  end if;
  if v_case.status in ('CONVERTED','LOST','CANCELLED','ARCHIVED')
     or v_case.status = p_target_status
     or not (
       (v_case.status = 'OPEN' and p_target_status in ('CONSULTING','PAUSED','LOST','CANCELLED','ARCHIVED'))
       or (v_case.status = 'CONSULTING' and p_target_status in ('PAUSED','READY_FOR_CONVERSION','LOST','CANCELLED','ARCHIVED'))
       or (v_case.status = 'PAUSED' and p_target_status in ('CONSULTING','LOST','CANCELLED','ARCHIVED'))
       or (v_case.status = 'READY_FOR_CONVERSION' and p_target_status in ('CONSULTING','LOST','CANCELLED'))
     ) then
    return query select false, 'RESOURCE_STATE_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id,
      case when v_case.active_assignment_id is null then null else v_assignment.assignment_version end,
      null::uuid;
    return;
  end if;
  if p_target_status in ('LOST','CANCELLED','ARCHIVED') and v_case.active_assignment_id is not null then
    return query select false, 'ACTIVE_ASSIGNMENT_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, v_assignment.assignment_version,
      null::uuid;
    return;
  end if;

  v_previous_version := v_case.case_version;
  update public.consultation_case c
  set status = p_target_status,
      closed_at = case when p_target_status in ('LOST','CANCELLED','ARCHIVED') then pg_catalog.clock_timestamp() else null end,
      archived_at = case when p_target_status = 'ARCHIVED' then pg_catalog.clock_timestamp() else null end,
      case_version = c.case_version + 1
  where c.consultation_case_id = p_case_id
  returning c.* into v_case;

  -- 4. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.case.status_changed', p_actor_user_id, 'consultation_case', p_case_id,
    null, v_previous_version, v_case.case_version, p_target_status,
    p_safe_reason_code, 'CASE_STATUS_CHANGED', v_correlation_id
  );
  -- 5. COMMIT_ATOMIC
  -- CASE_STATUS_RUNTIME_ATOMIC_END

  return query select true, 'CASE_STATUS_CHANGED', p_case_id, v_case.case_version,
    p_case_id, v_case.case_version, v_case.active_assignment_id,
    case when v_case.active_assignment_id is null then null else v_assignment.assignment_version end,
    v_correlation_id;
end;
$f23_3e_p1d_transition_consultation_case_status$;

create function public.f23_3e_p1d_assign_consultation_case(
  p_assignment_id uuid,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_target_consultant_user_id uuid,
  p_expected_case_version integer
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_assign_consultation_case$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_current_assignment public.consultation_case_assignment%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_membership public.center_members%rowtype;
  v_locked_user_id uuid;
  v_actor_found boolean := false;
  v_target_found boolean := false;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_assignment_id is null or p_case_id is null or p_actor_user_id is null
     or p_target_consultant_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1 then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- ASSIGN_CASE_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 1. AUTH_USER_EXISTENCE_ROWS, actor and target sorted by UUID
  for v_locked_user_id in
    select u.id from auth.users u
    where u.id = any (array[p_actor_user_id, p_target_consultant_user_id])
    order by u.id
    for key share
  loop
    if v_locked_user_id = p_actor_user_id then v_actor_found := true; end if;
    if v_locked_user_id = p_target_consultant_user_id then v_target_found := true; end if;
  end loop;
  if not v_actor_found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if not v_target_found then
    return query select false, 'TARGET_NOT_ELIGIBLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS
  -- center_members is the only applied canonical eligibility source at P1D.
  if pg_catalog.to_regclass('public.center_members') is null then
    return query select false, 'TARGET_ELIGIBILITY_UNAVAILABLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_target_consultant_user_id
  for share;
  if not found or v_membership.status <> 'active' or v_membership.role <> 'consultant' then
    return query select false, 'TARGET_NOT_ELIGIBLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 3. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.case_version <> p_expected_case_version then
    return query select false, 'CASE_VERSION_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;
  if v_case.status in ('CONVERTED','LOST','CANCELLED','ARCHIVED') then
    return query select false, 'RESOURCE_STATE_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;

  -- 4. CURRENT_ASSIGNMENT_ROW_IF_ANY
  if v_case.active_assignment_id is not null then
    select a.* into v_current_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = p_case_id
      and a.assignment_id = v_case.active_assignment_id
    for update;
    if not found or v_current_assignment.assignment_status <> 'ACTIVE' then
      raise exception 'f23_3e_p1d_case_assignment_pointer_corrupt';
    end if;
    return query select false, 'ACTIVE_ASSIGNMENT_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_current_assignment.assignment_id,
      v_current_assignment.assignment_version, null::uuid;
    return;
  end if;

  -- 5. PREALLOCATED_NEW_ASSIGNMENT_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_assignment_id::text, 230810));
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.assignment_id = p_assignment_id for update;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_assignment_id, null::integer,
      p_case_id, v_case.case_version, p_assignment_id, null::integer, null::uuid;
    return;
  end if;

  insert into public.consultation_case_assignment (
    assignment_id, center_id, consultation_case_id, assigned_consultant_user_id,
    assigned_by_user_id, assigned_at
  ) values (
    p_assignment_id, v_center_id, p_case_id, p_target_consultant_user_id,
    p_actor_user_id, pg_catalog.clock_timestamp()
  ) returning * into v_assignment;

  update public.consultation_case c
  set active_assignment_id = p_assignment_id,
      case_version = c.case_version + 1
  where c.consultation_case_id = p_case_id
  returning c.* into v_case;

  -- 6. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.assignment.assigned', p_actor_user_id,
    'consultation_case_assignment', p_assignment_id, p_assignment_id,
    null, 1, 'ACTIVE', null, 'ASSIGNMENT_CREATED', v_correlation_id
  );
  -- 7. COMMIT_ATOMIC
  -- ASSIGN_CASE_RUNTIME_ATOMIC_END

  return query select true, 'ASSIGNMENT_CREATED', p_assignment_id, 1,
    p_case_id, v_case.case_version, p_assignment_id, 1, v_correlation_id;
end;
$f23_3e_p1d_assign_consultation_case$;

create function public.f23_3e_p1d_reassign_consultation_case(
  p_new_assignment_id uuid,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_target_consultant_user_id uuid,
  p_expected_case_version integer,
  p_expected_current_assignment_id uuid,
  p_expected_current_assignment_version integer,
  p_safe_reason_code text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_reassign_consultation_case$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_old_assignment public.consultation_case_assignment%rowtype;
  v_new_assignment public.consultation_case_assignment%rowtype;
  v_membership public.center_members%rowtype;
  v_locked_user_id uuid;
  v_actor_found boolean := false;
  v_target_found boolean := false;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_new_assignment_id is null or p_case_id is null or p_actor_user_id is null
     or p_target_consultant_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_current_assignment_id is null
     or p_expected_current_assignment_version is null or p_expected_current_assignment_version < 1
     or not public.f23_3e_p1d_internal_is_safe_token(p_safe_reason_code, 160) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- REASSIGN_CASE_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROWS, actor and target sorted by UUID
  for v_locked_user_id in
    select u.id from auth.users u
    where u.id = any (array[p_actor_user_id, p_target_consultant_user_id])
    order by u.id
    for key share
  loop
    if v_locked_user_id = p_actor_user_id then v_actor_found := true; end if;
    if v_locked_user_id = p_target_consultant_user_id then v_target_found := true; end if;
  end loop;
  if not v_actor_found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if not v_target_found then
    return query select false, 'TARGET_NOT_ELIGIBLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS
  if pg_catalog.to_regclass('public.center_members') is null then
    return query select false, 'TARGET_ELIGIBILITY_UNAVAILABLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_target_consultant_user_id
  for share;
  if not found or v_membership.status <> 'active' or v_membership.role <> 'consultant' then
    return query select false, 'TARGET_NOT_ELIGIBLE', null::uuid, null::integer,
      p_case_id, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 3. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.case_version <> p_expected_case_version then
    return query select false, 'CASE_VERSION_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;
  if v_case.status in ('CONVERTED','LOST','CANCELLED','ARCHIVED') then
    return query select false, 'RESOURCE_STATE_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;
  if v_case.active_assignment_id is null
     or v_case.active_assignment_id <> p_expected_current_assignment_id then
    return query select false, 'ASSIGNMENT_IDENTITY_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 4. CURRENT_ASSIGNMENT_ROW
  select a.* into v_old_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = p_case_id
    and a.assignment_id = v_case.active_assignment_id
  for update;
  if not found then
    raise exception 'f23_3e_p1d_case_assignment_pointer_corrupt';
  end if;
  if v_old_assignment.assignment_status <> 'ACTIVE' then
    return query select false, 'RESOURCE_STATE_CONFLICT', v_old_assignment.assignment_id,
      v_old_assignment.assignment_version, p_case_id, v_case.case_version,
      v_old_assignment.assignment_id, v_old_assignment.assignment_version, null::uuid;
    return;
  end if;
  if v_old_assignment.assignment_version <> p_expected_current_assignment_version then
    return query select false, 'ASSIGNMENT_VERSION_STALE', v_old_assignment.assignment_id,
      v_old_assignment.assignment_version, p_case_id, v_case.case_version,
      v_old_assignment.assignment_id, v_old_assignment.assignment_version, null::uuid;
    return;
  end if;
  if v_old_assignment.assigned_consultant_user_id = p_target_consultant_user_id then
    return query select false, 'RESOURCE_STATE_CONFLICT', v_old_assignment.assignment_id,
      v_old_assignment.assignment_version, p_case_id, v_case.case_version,
      v_old_assignment.assignment_id, v_old_assignment.assignment_version, null::uuid;
    return;
  end if;

  -- 5. PREALLOCATED_NEW_ASSIGNMENT_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_new_assignment_id::text, 230810));
  select a.* into v_new_assignment from public.consultation_case_assignment a
  where a.assignment_id = p_new_assignment_id for update;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_new_assignment_id, null::integer,
      p_case_id, v_case.case_version, p_new_assignment_id, null::integer, null::uuid;
    return;
  end if;

  update public.consultation_case_assignment a
  set assignment_status = 'SUPERSEDED',
      assignment_version = a.assignment_version + 1,
      ended_at = v_now,
      end_reason = p_safe_reason_code
  where a.assignment_id = v_old_assignment.assignment_id
  returning a.* into v_old_assignment;

  insert into public.consultation_case_assignment (
    assignment_id, center_id, consultation_case_id, assigned_consultant_user_id,
    assigned_by_user_id, assigned_at
  ) values (
    p_new_assignment_id, v_center_id, p_case_id, p_target_consultant_user_id,
    p_actor_user_id, v_now
  ) returning * into v_new_assignment;

  update public.consultation_case c
  set active_assignment_id = p_new_assignment_id,
      case_version = c.case_version + 1
  where c.consultation_case_id = p_case_id
  returning c.* into v_case;

  -- 6. AUDIT_OUTBOX_ROWS: both pairs share one server correlation ID.
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.assignment.superseded', p_actor_user_id,
    'consultation_case_assignment', v_old_assignment.assignment_id,
    v_old_assignment.assignment_id, p_expected_current_assignment_version,
    v_old_assignment.assignment_version, 'SUPERSEDED', p_safe_reason_code,
    'ASSIGNMENT_REASSIGNED', v_correlation_id
  );
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.assignment.assigned', p_actor_user_id,
    'consultation_case_assignment', p_new_assignment_id, p_new_assignment_id,
    null, 1, 'ACTIVE', null, 'ASSIGNMENT_REASSIGNED', v_correlation_id
  );
  -- 7. COMMIT_ATOMIC
  -- REASSIGN_CASE_RUNTIME_ATOMIC_END

  return query select true, 'ASSIGNMENT_REASSIGNED', p_new_assignment_id, 1,
    p_case_id, v_case.case_version, p_new_assignment_id, 1, v_correlation_id;
end;
$f23_3e_p1d_reassign_consultation_case$;

create function public.f23_3e_p1d_end_consultation_case_assignment(
  p_case_id uuid,
  p_actor_user_id uuid,
  p_expected_case_version integer,
  p_expected_assignment_id uuid,
  p_expected_assignment_version integer,
  p_safe_reason_code text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_end_consultation_case_assignment$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_case_id is null or p_actor_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_assignment_id is null
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or not public.f23_3e_p1d_internal_is_safe_token(p_safe_reason_code, 160) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- END_REVOKE_ASSIGNMENT_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.case_version <> p_expected_case_version then
    return query select false, 'CASE_VERSION_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;
  if v_case.active_assignment_id is null
     or v_case.active_assignment_id <> p_expected_assignment_id then
    return query select false, 'ASSIGNMENT_IDENTITY_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 3. CURRENT_ASSIGNMENT_ROW
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = p_case_id
    and a.assignment_id = p_expected_assignment_id
  for update;
  if not found then
    raise exception 'f23_3e_p1d_case_assignment_pointer_corrupt';
  end if;
  if v_assignment.assignment_status <> 'ACTIVE' then
    return query select false, 'RESOURCE_STATE_CONFLICT', v_assignment.assignment_id,
      v_assignment.assignment_version, p_case_id, v_case.case_version,
      v_assignment.assignment_id, v_assignment.assignment_version, null::uuid;
    return;
  end if;
  if v_assignment.assignment_version <> p_expected_assignment_version then
    return query select false, 'ASSIGNMENT_VERSION_STALE', v_assignment.assignment_id,
      v_assignment.assignment_version, p_case_id, v_case.case_version,
      v_assignment.assignment_id, v_assignment.assignment_version, null::uuid;
    return;
  end if;

  update public.consultation_case_assignment a
  set assignment_status = 'ENDED',
      assignment_version = a.assignment_version + 1,
      ended_at = pg_catalog.clock_timestamp(),
      end_reason = p_safe_reason_code
  where a.assignment_id = p_expected_assignment_id
  returning a.* into v_assignment;

  update public.consultation_case c
  set active_assignment_id = null,
      case_version = c.case_version + 1
  where c.consultation_case_id = p_case_id
  returning c.* into v_case;

  -- 4. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.assignment.ended', p_actor_user_id,
    'consultation_case_assignment', v_assignment.assignment_id,
    v_assignment.assignment_id, p_expected_assignment_version,
    v_assignment.assignment_version, 'ENDED', p_safe_reason_code,
    'ASSIGNMENT_ENDED', v_correlation_id
  );
  -- 5. COMMIT_ATOMIC
  -- END_REVOKE_ASSIGNMENT_RUNTIME_ATOMIC_END

  return query select true, 'ASSIGNMENT_ENDED', v_assignment.assignment_id,
    v_assignment.assignment_version, p_case_id, v_case.case_version,
    v_assignment.assignment_id, v_assignment.assignment_version, v_correlation_id;
end;
$f23_3e_p1d_end_consultation_case_assignment$;

create function public.f23_3e_p1d_revoke_consultation_case_assignment(
  p_case_id uuid,
  p_actor_user_id uuid,
  p_expected_case_version integer,
  p_expected_assignment_id uuid,
  p_expected_assignment_version integer,
  p_safe_reason_code text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_revoke_consultation_case_assignment$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_case_id is null or p_actor_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_assignment_id is null
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or not public.f23_3e_p1d_internal_is_safe_token(p_safe_reason_code, 160) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- END_REVOKE_ASSIGNMENT_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.case_version <> p_expected_case_version then
    return query select false, 'CASE_VERSION_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;
  if v_case.active_assignment_id is null
     or v_case.active_assignment_id <> p_expected_assignment_id then
    return query select false, 'ASSIGNMENT_IDENTITY_STALE', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 3. CURRENT_ASSIGNMENT_ROW
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = p_case_id
    and a.assignment_id = p_expected_assignment_id
  for update;
  if not found then
    raise exception 'f23_3e_p1d_case_assignment_pointer_corrupt';
  end if;
  if v_assignment.assignment_status <> 'ACTIVE' then
    return query select false, 'RESOURCE_STATE_CONFLICT', v_assignment.assignment_id,
      v_assignment.assignment_version, p_case_id, v_case.case_version,
      v_assignment.assignment_id, v_assignment.assignment_version, null::uuid;
    return;
  end if;
  if v_assignment.assignment_version <> p_expected_assignment_version then
    return query select false, 'ASSIGNMENT_VERSION_STALE', v_assignment.assignment_id,
      v_assignment.assignment_version, p_case_id, v_case.case_version,
      v_assignment.assignment_id, v_assignment.assignment_version, null::uuid;
    return;
  end if;

  update public.consultation_case_assignment a
  set assignment_status = 'REVOKED',
      assignment_version = a.assignment_version + 1,
      ended_at = pg_catalog.clock_timestamp(),
      end_reason = p_safe_reason_code
  where a.assignment_id = p_expected_assignment_id
  returning a.* into v_assignment;

  update public.consultation_case c
  set active_assignment_id = null,
      case_version = c.case_version + 1
  where c.consultation_case_id = p_case_id
  returning c.* into v_case;

  -- 4. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.assignment.revoked', p_actor_user_id,
    'consultation_case_assignment', v_assignment.assignment_id,
    v_assignment.assignment_id, p_expected_assignment_version,
    v_assignment.assignment_version, 'REVOKED', p_safe_reason_code,
    'ASSIGNMENT_REVOKED', v_correlation_id
  );
  -- 5. COMMIT_ATOMIC
  -- END_REVOKE_ASSIGNMENT_RUNTIME_ATOMIC_END

  return query select true, 'ASSIGNMENT_REVOKED', v_assignment.assignment_id,
    v_assignment.assignment_version, p_case_id, v_case.case_version,
    v_assignment.assignment_id, v_assignment.assignment_version, v_correlation_id;
end;
$f23_3e_p1d_revoke_consultation_case_assignment$;

create function public.f23_3e_p1d_append_crm_care_log(
  p_care_log_id uuid,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_safe_log_kind text,
  p_safe_content text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_append_crm_care_log$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_care_log public.crm_care_log%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_care_log_id is null or p_case_id is null or p_actor_user_id is null
     or p_safe_log_kind is null
     or p_safe_log_kind not in ('NOTE','CALL_SUMMARY','MESSAGE_SUMMARY','MEETING_SUMMARY','SYSTEM_SAFE')
     or not public.f23_3e_p1d_internal_valid_safe_content(p_safe_content) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CARE_LOG_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.status in ('CONVERTED','LOST','CANCELLED','ARCHIVED') then
    return query select false, 'RESOURCE_STATE_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;

  -- 3. ORIGINAL_CARE_LOG_ROW_IF_CORRECTION (not applicable)
  -- 4. PREALLOCATED_NEW_CARE_LOG_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_care_log_id::text, 230810));
  select l.* into v_care_log from public.crm_care_log l
  where l.care_log_id = p_care_log_id for share;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_care_log_id, null::integer,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  insert into public.crm_care_log (
    care_log_id, center_id, consultation_case_id, author_user_id,
    entry_type, safe_content
  ) values (
    p_care_log_id, v_center_id, p_case_id, p_actor_user_id,
    p_safe_log_kind, p_safe_content
  ) returning * into v_care_log;

  -- 5. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.care_log.appended', p_actor_user_id,
    'crm_care_log', p_care_log_id, null, null, 1, p_safe_log_kind,
    null, 'CARE_LOG_APPENDED', v_correlation_id
  );
  -- 6. COMMIT_ATOMIC
  -- CARE_LOG_RUNTIME_ATOMIC_END

  return query select true, 'CARE_LOG_APPENDED', p_care_log_id, 1,
    p_case_id, v_case.case_version, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_append_crm_care_log$;

create function public.f23_3e_p1d_correct_crm_care_log(
  p_care_log_id uuid,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_original_care_log_id uuid,
  p_safe_content text
)
returns table (
  ok boolean, outcome_code text, resource_id uuid, resource_version integer,
  case_id uuid, case_version integer, assignment_id uuid,
  assignment_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1d_correct_crm_care_log$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_case public.consultation_case%rowtype;
  v_original public.crm_care_log%rowtype;
  v_care_log public.crm_care_log%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_care_log_id is null or p_case_id is null or p_actor_user_id is null
     or p_original_care_log_id is null or p_care_log_id = p_original_care_log_id
     or not public.f23_3e_p1d_internal_valid_safe_content(p_safe_content) then
    return query select false, 'INVALID_INPUT', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  select c.center_id into v_center_id from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- CARE_LOG_RUNTIME_ATOMIC_BEGIN
  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  -- 2. CONSULTATION_CASE_ROW
  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id for update;
  if not found or v_case.center_id <> v_center_id then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      null::uuid, null::integer, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_case.status in ('CONVERTED','LOST','CANCELLED','ARCHIVED') then
    return query select false, 'RESOURCE_STATE_CONFLICT', p_case_id, v_case.case_version,
      p_case_id, v_case.case_version, v_case.active_assignment_id, null::integer, null::uuid;
    return;
  end if;

  -- 3. ORIGINAL_CARE_LOG_ROW_IF_CORRECTION
  select l.* into v_original from public.crm_care_log l
  where l.care_log_id = p_original_care_log_id for share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', null::uuid, null::integer,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;
  if v_original.center_id <> v_center_id
     or v_original.consultation_case_id <> p_case_id then
    return query select false, 'CROSS_CENTER_CONFLICT', null::uuid, null::integer,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  -- 4. PREALLOCATED_NEW_CARE_LOG_ROW
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_care_log_id::text, 230810));
  select l.* into v_care_log from public.crm_care_log l
  where l.care_log_id = p_care_log_id for share;
  if found then
    return query select false, 'RESOURCE_ALREADY_EXISTS', p_care_log_id, null::integer,
      p_case_id, v_case.case_version, null::uuid, null::integer, null::uuid;
    return;
  end if;

  insert into public.crm_care_log (
    care_log_id, center_id, consultation_case_id, author_user_id,
    entry_type, safe_content, correction_of_care_log_id
  ) values (
    p_care_log_id, v_center_id, p_case_id, p_actor_user_id,
    'CORRECTION', p_safe_content, p_original_care_log_id
  ) returning * into v_care_log;

  -- 5. AUDIT_OUTBOX_ROWS
  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.care_log.corrected', p_actor_user_id,
    'crm_care_log', p_care_log_id, null, null, 1, 'CORRECTION',
    null, 'CARE_LOG_CORRECTED', v_correlation_id
  );
  -- 6. COMMIT_ATOMIC
  -- CARE_LOG_RUNTIME_ATOMIC_END

  return query select true, 'CARE_LOG_CORRECTED', p_care_log_id, 1,
    p_case_id, v_case.case_version, null::uuid, null::integer, v_correlation_id;
end;
$f23_3e_p1d_correct_crm_care_log$;

-- Internal helpers are never directly callable by service_role or browser roles.
revoke all on function public.f23_3e_p1d_internal_is_safe_token(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_internal_valid_contact_payload(text, bytea, integer, bytea[], integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_internal_valid_safe_content(text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_internal_append_audit_outbox(text, text, uuid, text, uuid, uuid, integer, integer, text, text, text, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p1d_create_crm_contact(uuid, text, uuid, text, bytea, integer, bytea[], integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_update_crm_contact(uuid, uuid, integer, text, bytea, integer, bytea[], integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_transition_crm_contact_status(uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_create_consultation_case(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_transition_consultation_case_status(uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_assign_consultation_case(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_reassign_consultation_case(uuid, uuid, uuid, uuid, integer, uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_end_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_revoke_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_append_crm_care_log(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1d_correct_crm_care_log(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.f23_3e_p1d_create_crm_contact(uuid, text, uuid, text, bytea, integer, bytea[], integer)
  to service_role;
grant execute on function public.f23_3e_p1d_update_crm_contact(uuid, uuid, integer, text, bytea, integer, bytea[], integer)
  to service_role;
grant execute on function public.f23_3e_p1d_transition_crm_contact_status(uuid, uuid, integer, text, text)
  to service_role;
grant execute on function public.f23_3e_p1d_create_consultation_case(uuid, uuid, uuid, integer)
  to service_role;
grant execute on function public.f23_3e_p1d_transition_consultation_case_status(uuid, uuid, integer, text, text)
  to service_role;
grant execute on function public.f23_3e_p1d_assign_consultation_case(uuid, uuid, uuid, uuid, integer)
  to service_role;
grant execute on function public.f23_3e_p1d_reassign_consultation_case(uuid, uuid, uuid, uuid, integer, uuid, integer, text)
  to service_role;
grant execute on function public.f23_3e_p1d_end_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)
  to service_role;
grant execute on function public.f23_3e_p1d_revoke_consultation_case_assignment(uuid, uuid, integer, uuid, integer, text)
  to service_role;
grant execute on function public.f23_3e_p1d_append_crm_care_log(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.f23_3e_p1d_correct_crm_care_log(uuid, uuid, uuid, uuid, text)
  to service_role;

comment on function public.f23_3e_p1d_create_crm_contact(uuid, text, uuid, text, bytea, integer, bytea[], integer) is
  'Service-only preallocated Contact create; actor is protected-service attribution, not end-user authority.';
comment on function public.f23_3e_p1d_assign_consultation_case(uuid, uuid, uuid, uuid, integer) is
  'Service-only exact-center Case assignment with locked target membership eligibility; grants no global Contact authority.';
comment on function public.f23_3e_p1d_reassign_consultation_case(uuid, uuid, uuid, uuid, integer, uuid, integer, text) is
  'Service-only all-or-nothing Case reassignment with two correlated Audit/Outbox pairs.';
comment on function public.f23_3e_p1d_correct_crm_care_log(uuid, uuid, uuid, uuid, text) is
  'Service-only append-only Care Log correction; the original row is never updated.';

commit;
