-- F23.3E-P1B: service-role-only conversion Request draft lifecycle and
-- scoped idempotency with an immutable exact-result snapshot.
-- This is an internal database primitive. It is not a browser endpoint,
-- capability resolver, step-up flow, approval service, or conversion executor.

begin;

set local check_function_bodies = true;

do $f23_3e_p1b_prerequisites$
begin
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'f23_3e_p1b_missing_prerequisite: extensions.digest(bytea,text)';
  end if;

  if pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is null then
    raise exception 'f23_3e_p1b_missing_prerequisite: pg_catalog.gen_random_uuid()';
  end if;

  if pg_catalog.to_regclass('auth.users') is null
     or pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case') is null
     or pg_catalog.to_regclass('public.consultation_case_assignment') is null
     or pg_catalog.to_regclass('public.crm_conversion_request') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null then
    raise exception 'f23_3e_p1b_missing_p1a_prerequisite';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_roles r
    where r.rolname = 'service_role'
  ) then
    raise exception 'f23_3e_p1b_missing_prerequisite: service_role';
  end if;
end;
$f23_3e_p1b_prerequisites$;

-- P1A used event_version as the mutable delivery-row revision. P1B requires
-- event_version to be the immutable aggregate/request version, so delivery
-- revision becomes an independent typed integer.
alter table public.crm_outbox_event
  add column delivery_version integer not null default 1,
  add constraint crm_outbox_event_delivery_version_positive
    check (delivery_version >= 1);

drop trigger f23_3e_p1a_outbox_version on public.crm_outbox_event;
drop trigger f23_3e_p1a_outbox_lifecycle on public.crm_outbox_event;

create function public.f23_3e_p1b_internal_enforce_outbox_delivery_version()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1b_internal_enforce_outbox_delivery_version$
begin
  if new.delivery_version <> old.delivery_version + 1 then
    raise exception 'f23_3e_p1b_outbox_delivery_version_must_increment_by_one';
  end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p1b_internal_enforce_outbox_delivery_version$;

create function public.f23_3e_p1b_internal_guard_outbox_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1b_internal_guard_outbox_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.event_version < 1
       or new.delivery_version <> 1
       or new.delivery_status <> 'PENDING'
       or new.attempt_count <> 0
       or new.claim_id is not null
       or new.claimed_by is not null
       or new.claim_expires_at is not null
       or new.delivered_at is not null then
      raise exception 'f23_3e_p1b_outbox_must_start_pending_at_delivery_version_one';
    end if;
    return new;
  end if;

  if new.outbox_event_id is distinct from old.outbox_event_id
     or new.center_id is distinct from old.center_id
     or new.aggregate_kind is distinct from old.aggregate_kind
     or new.aggregate_id is distinct from old.aggregate_id
     or new.event_type is distinct from old.event_type
     or new.event_version is distinct from old.event_version
     or new.safe_payload is distinct from old.safe_payload
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p1b_outbox_event_identity_version_and_payload_are_immutable';
  end if;

  if old.delivery_status in ('DELIVERED', 'DEAD_LETTER', 'CANCELLED') then
    raise exception 'f23_3e_p1b_terminal_outbox_event_cannot_return_to_pending';
  end if;

  if not (
    (old.delivery_status in ('PENDING', 'RETRY') and new.delivery_status = 'CLAIMED' and new.attempt_count = old.attempt_count + 1)
    or (old.delivery_status in ('PENDING', 'RETRY') and new.delivery_status = 'CANCELLED' and new.attempt_count = old.attempt_count)
    or (old.delivery_status = 'CLAIMED' and new.delivery_status in ('DELIVERED', 'RETRY', 'DEAD_LETTER', 'CANCELLED') and new.attempt_count = old.attempt_count)
  ) then
    raise exception 'f23_3e_p1b_invalid_outbox_transition: % -> %', old.delivery_status, new.delivery_status;
  end if;

  return new;
end;
$f23_3e_p1b_internal_guard_outbox_lifecycle$;

create trigger f23_3e_p1b_outbox_delivery_version
before update on public.crm_outbox_event
for each row execute function public.f23_3e_p1b_internal_enforce_outbox_delivery_version();

create trigger f23_3e_p1b_outbox_lifecycle
before insert or update on public.crm_outbox_event
for each row execute function public.f23_3e_p1b_internal_guard_outbox_lifecycle();

create unique index crm_outbox_event_conversion_request_version_uidx
  on public.crm_outbox_event (center_id, aggregate_kind, aggregate_id, event_version)
  where aggregate_kind = 'crm_conversion_request';

-- P1A stored only the assignment version. A replacement Assignment row starts
-- again at version one, so exact assignment identity must also be snapshotted.
alter table public.crm_conversion_request
  add column source_assignment_id uuid not null,
  add constraint crm_conversion_request_source_assignment_exact_center_fkey
    foreign key (center_id, source_assignment_id)
    references public.consultation_case_assignment(center_id, assignment_id)
    on delete restrict;

-- Bind the operation intent separately from the canonical Request intent and
-- persist the exact prior safe result instead of resolving current row state.
alter table public.crm_idempotency_registry
  add column request_intent_digest bytea,
  add column result_request_id uuid,
  add column result_request_version integer,
  add column result_case_version integer,
  add column result_request_status text,
  add column result_outcome_code text,
  add column result_correlation_id uuid,
  add constraint crm_idempotency_registry_request_intent_digest_check
    check (request_intent_digest is null or pg_catalog.octet_length(request_intent_digest) = 32),
  add constraint crm_idempotency_registry_result_versions_positive
    check (
      (result_request_version is null or result_request_version >= 1)
      and (result_case_version is null or result_case_version >= 1)
    ),
  add constraint crm_idempotency_registry_result_request_status_check
    check (
      result_request_status is null
      or result_request_status in ('DRAFT', 'READY_FOR_REVIEW', 'CANCELLED')
    ),
  add constraint crm_idempotency_registry_result_outcome_code_check
    check (
      result_outcome_code is null
      or result_outcome_code in ('DRAFT_CREATED', 'DRAFT_UPDATED', 'REVIEW_SUBMITTED', 'REQUEST_CANCELLED')
    ),
  add constraint crm_idempotency_registry_completed_result_snapshot_check
    check (
      (
        status = 'COMPLETED'
        and result_request_id is not null
        and result_request_version is not null
        and result_case_version is not null
        and result_request_status is not null
        and result_outcome_code is not null
        and result_correlation_id is not null
      )
      or (
        status <> 'COMPLETED'
        and result_request_id is null
        and result_request_version is null
        and result_case_version is null
        and result_request_status is null
        and result_outcome_code is null
        and result_correlation_id is null
      )
    ),
  add constraint crm_idempotency_registry_result_request_exact_center_fkey
    foreign key (center_id, result_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id)
    on delete restrict
    deferrable initially deferred;

create function public.f23_3e_p1b_internal_guard_idempotency_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1b_internal_guard_idempotency_snapshot$
begin
  if tg_op = 'UPDATE' then
    if new.request_intent_digest is distinct from old.request_intent_digest then
      raise exception 'f23_3e_p1b_idempotency_request_intent_is_immutable';
    end if;

    if old.status in ('COMPLETED', 'CONFLICT', 'EXPIRED') and (
      new.result_request_id is distinct from old.result_request_id
      or new.result_request_version is distinct from old.result_request_version
      or new.result_case_version is distinct from old.result_case_version
      or new.result_request_status is distinct from old.result_request_status
      or new.result_outcome_code is distinct from old.result_outcome_code
      or new.result_correlation_id is distinct from old.result_correlation_id
    ) then
      raise exception 'f23_3e_p1b_terminal_result_snapshot_is_immutable';
    end if;
  end if;
  return new;
end;
$f23_3e_p1b_internal_guard_idempotency_snapshot$;

create trigger f23_3e_p1b_idempotency_snapshot_guard
before insert or update on public.crm_idempotency_registry
for each row execute function public.f23_3e_p1b_internal_guard_idempotency_snapshot();

create function public.f23_3e_p1b_internal_result_digest(
  p_request_id uuid,
  p_request_version integer,
  p_case_version integer,
  p_request_status text,
  p_outcome_code text,
  p_correlation_id uuid
)
returns bytea
language sql
immutable
strict
set search_path = ''
as $f23_3e_p1b_internal_result_digest$
  select extensions.digest(
    pg_catalog.convert_to(
      p_request_id::text || '|' || p_request_version::text || '|' ||
      p_case_version::text || '|' || p_request_status || '|' ||
      p_outcome_code || '|' || p_correlation_id::text,
      'UTF8'
    ),
    'sha256'
  );
$f23_3e_p1b_internal_result_digest$;

-- CREATE_DRAFT_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. AUTH_USER_EXISTENCE_ROW (attribution existence only; not account security)
-- 2. IDEMPOTENCY_REGISTRY_AND_PREALLOCATED_REQUEST_ROWS
-- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
-- 4. CURRENT_ASSIGNMENT_ROW
-- 5. AUDIT_OUTBOX_ROWS, then idempotency completion
-- 6. COMMIT_ATOMIC by the caller transaction
-- CREATE_DRAFT_RUNTIME_ATOMIC_END
create function public.f23_3e_p1b_create_conversion_draft(
  p_consultation_case_id uuid,
  p_actor_user_id uuid,
  p_expected_case_version integer,
  p_expected_contact_version integer,
  p_expected_assignment_version integer,
  p_environment_fingerprint bytea,
  p_idempotency_key_digest bytea,
  p_intent_digest bytea,
  p_action_graph_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  conversion_request_id uuid,
  request_status text,
  request_version integer,
  case_version integer,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1b_create_conversion_draft$
declare
  v_center_id text;
  v_contact_id uuid;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_registry_found boolean := false;
  v_registry_id uuid := pg_catalog.gen_random_uuid();
  v_request_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_conflict text;
begin
  if p_consultation_case_id is null
     or p_actor_user_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_intent_digest is null or pg_catalog.octet_length(p_intent_digest) <> 32
     or p_action_graph_digest is null or pg_catalog.octet_length(p_action_graph_digest) <> 32
     or p_idempotency_expires_at is null
     or p_idempotency_expires_at <= pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at > pg_catalog.transaction_timestamp() + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- Selector read takes no row lock; center authority is derived and rechecked later.
  select c.center_id, c.primary_contact_id
  into v_center_id, v_contact_id
  from public.consultation_case c
  where c.consultation_case_id = p_consultation_case_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 1. AUTH_USER_EXISTENCE_ROW. This is not an account-security control lock.
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 2. IDEMPOTENCY_REGISTRY_AND_PREALLOCATED_REQUEST_ROWS
  select i.* into v_registry
  from public.crm_idempotency_registry i
  where i.environment_fingerprint = p_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'consultation_case'
    and i.resource_scope_id = p_consultation_case_id
    and i.operation = 'crm.conversion.create_draft'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  v_registry_found := found;

  if v_registry_found and (
    v_registry.intent_digest is distinct from p_intent_digest
    or v_registry.request_intent_digest is distinct from p_intent_digest
    or v_registry.action_graph_digest is distinct from p_action_graph_digest
  ) then
    return query select false, 'IDEMPOTENCY_CONFLICT', false, v_registry.result_request_id,
      null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  if not v_registry_found then
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id,
      resource_scope_kind, resource_scope_id, consultation_case_id, operation,
      idempotency_key_digest, intent_digest, request_intent_digest,
      action_graph_digest, request_id, expires_at
    ) values (
      v_registry_id, p_environment_fingerprint, v_center_id,
      'consultation_case', p_consultation_case_id, p_consultation_case_id,
      'crm.conversion.create_draft', p_idempotency_key_digest, p_intent_digest,
      p_intent_digest, p_action_graph_digest, v_request_id, p_idempotency_expires_at
    );
  else
    if v_registry.status <> 'COMPLETED' then
      raise exception 'f23_3e_p1b_unexpected_idempotency_state: %', v_registry.status;
    end if;
    select r.* into strict v_request
    from public.crm_conversion_request r
    where r.center_id = v_center_id
      and r.conversion_request_id = v_registry.result_request_id
    for update;
    v_contact_id := v_request.source_contact_id;
  end if;

  -- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS (Contact, then Case).
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_contact_id
  for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  select c.* into v_case
  from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = p_consultation_case_id
  for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 4. CURRENT_ASSIGNMENT_ROW
  if v_conflict is null then
    select a.* into v_assignment
    from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = v_case.consultation_case_id
      and a.assignment_id = v_case.active_assignment_id
      and a.assignment_status = 'ACTIVE'
    for update;
    if not found or v_assignment.assigned_consultant_user_id <> p_actor_user_id then
      v_conflict := 'ACTOR_NOT_ASSIGNED';
    end if;
  end if;

  if v_registry_found then
    if v_conflict is not null then
      return query select false, v_conflict, false, v_registry.result_request_id,
        null::text, null::integer, null::integer, null::uuid;
      return;
    end if;
    return query select true, v_registry.result_outcome_code, true,
      v_registry.result_request_id, v_registry.result_request_status,
      v_registry.result_request_version, v_registry.result_case_version,
      v_registry.result_correlation_id;
    return;
  end if;

  if v_conflict is null and v_case.primary_contact_id <> v_contact.crm_contact_id then
    v_conflict := 'RESOURCE_NOT_FOUND';
  end if;
  if v_conflict is null and exists (
    select 1 from public.crm_conversion_request r
    where r.center_id = v_center_id
      and r.consultation_case_id = p_consultation_case_id
      and r.status in ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXECUTING', 'COMPENSATION_REQUIRED')
  ) then
    v_conflict := 'ACTIVE_REQUEST_CONFLICT';
  end if;
  if v_conflict is null and v_case.case_version <> p_expected_case_version then
    v_conflict := 'SOURCE_VERSION_STALE';
  end if;
  if v_conflict is null and v_contact.contact_version <> p_expected_contact_version then
    v_conflict := 'SOURCE_VERSION_STALE';
  end if;
  if v_conflict is null and v_assignment.assignment_version <> p_expected_assignment_version then
    v_conflict := 'ASSIGNMENT_VERSION_STALE';
  end if;
  if v_conflict is null and (
    v_case.status not in ('OPEN', 'CONSULTING', 'PAUSED', 'READY_FOR_CONVERSION')
    or v_case.conversion_state <> 'NOT_STARTED'
  ) then
    v_conflict := 'REQUEST_STATE_CONFLICT';
  end if;
  if v_conflict is not null then
    delete from public.crm_idempotency_registry i where i.idempotency_record_id = v_registry_id;
    return query select false, v_conflict, false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  insert into public.crm_conversion_request (
    conversion_request_id, center_id, consultation_case_id, source_contact_id,
    source_case_version, source_contact_version, source_assignment_id, source_assignment_version,
    identity_policy_version, conversion_policy_version, relationship_policy_version,
    student_profile_policy_version, action_graph_digest, idempotency_scope,
    idempotency_key_reference, intent_digest, requested_by_user_id
  ) values (
    v_request_id, v_center_id, p_consultation_case_id, v_contact.crm_contact_id,
    v_case.case_version + 1, v_contact.contact_version,
    v_assignment.assignment_id, v_assignment.assignment_version,
    v_root.identity_policy_version, v_root.conversion_policy_version,
    v_root.relationship_policy_version, v_root.student_profile_policy_version,
    p_action_graph_digest, 'consultation_case', v_registry_id, p_intent_digest,
    p_actor_user_id
  );

  update public.consultation_case c
  set conversion_state = 'DRAFT', case_version = c.case_version + 1
  where c.center_id = v_center_id and c.consultation_case_id = p_consultation_case_id
  returning c.* into v_case;

  -- 5. AUDIT_OUTBOX_ROWS
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id,
    request_id, assignment_id, previous_version, new_version, correlation_id
  ) values (
    v_center_id, 'crm.conversion.draft_created', p_actor_user_id,
    'crm_conversion_request', v_request_id, v_request_id,
    v_assignment.assignment_id, null, 1, v_correlation_id
  );

  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    v_center_id, 'crm_conversion_request', v_request_id,
    'crm.conversion.draft_created', 1,
    pg_catalog.jsonb_build_object(
      'event_schema_version', 1, 'resource_kind', 'crm_conversion_request',
      'resource_id', v_request_id::text, 'request_id', v_request_id::text,
      'assignment_id', v_assignment.assignment_id::text, 'new_version', 1,
      'status', 'DRAFT', 'correlation_id', v_correlation_id::text,
      'operation', 'crm.conversion.create_draft', 'outcome_code', 'DRAFT_CREATED'
    )
  );

  update public.crm_idempotency_registry i
  set status = 'COMPLETED',
      terminal_outcome_digest = public.f23_3e_p1b_internal_result_digest(
        v_request_id, 1, v_case.case_version, 'DRAFT', 'DRAFT_CREATED', v_correlation_id
      ),
      result_request_id = v_request_id,
      result_request_version = 1,
      result_case_version = v_case.case_version,
      result_request_status = 'DRAFT',
      result_outcome_code = 'DRAFT_CREATED',
      result_correlation_id = v_correlation_id,
      idempotency_version = i.idempotency_version + 1,
      completed_at = pg_catalog.transaction_timestamp()
  where i.idempotency_record_id = v_registry_id;

  return query select true, 'DRAFT_CREATED', false, v_request_id, 'DRAFT', 1,
    v_case.case_version, v_correlation_id;
end;
$f23_3e_p1b_create_conversion_draft$;

-- UPDATE_DRAFT_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. AUTH_USER_EXISTENCE_ROW (attribution existence only; not account security)
-- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
-- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
-- 4. CURRENT_ASSIGNMENT_ROW
-- 5. AUDIT_OUTBOX_ROWS, then idempotency completion
-- 6. COMMIT_ATOMIC by the caller transaction
-- UPDATE_DRAFT_RUNTIME_ATOMIC_END
create function public.f23_3e_p1b_update_conversion_draft(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_expected_case_version integer,
  p_expected_contact_version integer,
  p_expected_assignment_version integer,
  p_environment_fingerprint bytea,
  p_idempotency_key_digest bytea,
  p_operation_intent_digest bytea,
  p_new_request_intent_digest bytea,
  p_new_action_graph_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean, outcome_code text, replayed boolean, conversion_request_id uuid,
  request_status text, request_version integer, case_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1b_update_conversion_draft$
declare
  v_center_id text;
  v_case_id uuid;
  v_contact_id uuid;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_registry_found boolean := false;
  v_registry_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_conflict text;
  v_previous_version integer;
begin
  if p_conversion_request_id is null or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_new_request_intent_digest is null or pg_catalog.octet_length(p_new_request_intent_digest) <> 32
     or p_new_action_graph_digest is null or pg_catalog.octet_length(p_new_action_graph_digest) <> 32
     or p_idempotency_expires_at is null
     or p_idempotency_expires_at <= pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at > pg_catalog.transaction_timestamp() + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  select r.center_id, r.consultation_case_id, r.source_contact_id
  into v_center_id, v_case_id, v_contact_id
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = p_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.conversion.update_draft'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  v_registry_found := found;

  if v_registry_found and (
    v_registry.intent_digest is distinct from p_operation_intent_digest
    or v_registry.request_intent_digest is distinct from p_new_request_intent_digest
    or v_registry.action_graph_digest is distinct from p_new_action_graph_digest
  ) then
    return query select false, 'IDEMPOTENCY_CONFLICT', false, v_registry.result_request_id,
      null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  if not v_registry_found then
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id,
      resource_scope_kind, resource_scope_id, consultation_case_id, operation,
      idempotency_key_digest, intent_digest, request_intent_digest,
      action_graph_digest, request_id, expires_at
    ) values (
      v_registry_id, p_environment_fingerprint, v_center_id, 'conversion_request',
      p_conversion_request_id, v_case_id, 'crm.conversion.update_draft',
      p_idempotency_key_digest, p_operation_intent_digest,
      p_new_request_intent_digest, p_new_action_graph_digest,
      p_conversion_request_id, p_idempotency_expires_at
    );
  elsif v_registry.status <> 'COMPLETED' then
    raise exception 'f23_3e_p1b_unexpected_idempotency_state: %', v_registry.status;
  end if;

  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id
  for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_contact_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = v_case_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 4. CURRENT_ASSIGNMENT_ROW
  if v_conflict is null then
    select a.* into v_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id and a.consultation_case_id = v_case_id
      and a.assignment_id = v_case.active_assignment_id and a.assignment_status = 'ACTIVE'
    for update;
    if not found or v_assignment.assigned_consultant_user_id <> p_actor_user_id then
      v_conflict := 'ACTOR_NOT_ASSIGNED';
    end if;
  end if;

  if v_registry_found then
    if v_conflict is not null then
      return query select false, v_conflict, false, v_registry.result_request_id,
        null::text, null::integer, null::integer, null::uuid;
      return;
    end if;
    return query select true, v_registry.result_outcome_code, true,
      v_registry.result_request_id, v_registry.result_request_status,
      v_registry.result_request_version, v_registry.result_case_version,
      v_registry.result_correlation_id;
    return;
  end if;

  if v_conflict is null and v_request.status <> 'DRAFT' then v_conflict := 'REQUEST_STATE_CONFLICT'; end if;
  if v_conflict is null and v_request.request_version <> p_expected_request_version then v_conflict := 'REQUEST_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_assignment.assignment_id is distinct from v_request.source_assignment_id
    or v_assignment.assignment_version <> p_expected_assignment_version
  ) then v_conflict := 'ASSIGNMENT_VERSION_STALE'; end if;
  if v_conflict is null and (v_case.case_version <> p_expected_case_version or v_contact.contact_version <> p_expected_contact_version) then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_request.source_case_version <> v_case.case_version
    or v_request.source_contact_version <> v_contact.contact_version
    or v_request.source_assignment_id is distinct from v_assignment.assignment_id
    or v_request.source_assignment_version <> v_assignment.assignment_version
    or v_request.source_contact_id <> v_case.primary_contact_id
  ) then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and v_case.conversion_state <> 'DRAFT' then v_conflict := 'REQUEST_STATE_CONFLICT'; end if;

  if v_conflict is not null then
    delete from public.crm_idempotency_registry i where i.idempotency_record_id = v_registry_id;
    return query select false, v_conflict, false, p_conversion_request_id,
      null::text, null::integer, null::integer, null::uuid;
    return;
  end if;

  v_previous_version := v_request.request_version;
  update public.crm_conversion_request r
  set intent_digest = p_new_request_intent_digest,
      action_graph_digest = p_new_action_graph_digest,
      source_case_version = v_case.case_version,
      source_contact_version = v_contact.contact_version,
      source_assignment_id = v_assignment.assignment_id,
      source_assignment_version = v_assignment.assignment_version,
      request_version = r.request_version + 1
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id
  returning r.* into v_request;

  -- 5. AUDIT_OUTBOX_ROWS
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id, request_id,
    assignment_id, previous_version, new_version, correlation_id
  ) values (
    v_center_id, 'crm.conversion.draft_updated', p_actor_user_id,
    'crm_conversion_request', p_conversion_request_id, p_conversion_request_id,
    v_assignment.assignment_id, v_previous_version, v_request.request_version, v_correlation_id
  );
  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    v_center_id, 'crm_conversion_request', p_conversion_request_id,
    'crm.conversion.draft_updated', v_request.request_version,
    pg_catalog.jsonb_build_object(
      'event_schema_version', 1, 'resource_kind', 'crm_conversion_request',
      'resource_id', p_conversion_request_id::text, 'request_id', p_conversion_request_id::text,
      'assignment_id', v_assignment.assignment_id::text,
      'previous_version', v_previous_version, 'new_version', v_request.request_version,
      'status', 'DRAFT', 'correlation_id', v_correlation_id::text,
      'operation', 'crm.conversion.update_draft', 'outcome_code', 'DRAFT_UPDATED'
    )
  );
  update public.crm_idempotency_registry i
  set status = 'COMPLETED',
      terminal_outcome_digest = public.f23_3e_p1b_internal_result_digest(
        p_conversion_request_id, v_request.request_version, v_case.case_version,
        'DRAFT', 'DRAFT_UPDATED', v_correlation_id
      ),
      result_request_id = p_conversion_request_id,
      result_request_version = v_request.request_version,
      result_case_version = v_case.case_version,
      result_request_status = 'DRAFT', result_outcome_code = 'DRAFT_UPDATED',
      result_correlation_id = v_correlation_id,
      idempotency_version = i.idempotency_version + 1,
      completed_at = pg_catalog.transaction_timestamp()
  where i.idempotency_record_id = v_registry_id;

  return query select true, 'DRAFT_UPDATED', false, p_conversion_request_id,
    'DRAFT', v_request.request_version, v_case.case_version, v_correlation_id;
end;
$f23_3e_p1b_update_conversion_draft$;

-- SUBMIT_REVIEW_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. AUTH_USER_EXISTENCE_ROW (attribution existence only; not account security)
-- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
-- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
-- 4. CURRENT_ASSIGNMENT_ROW
-- 5. AUDIT_OUTBOX_ROWS, then idempotency completion
-- 6. COMMIT_ATOMIC by the caller transaction
-- SUBMIT_REVIEW_RUNTIME_ATOMIC_END
create function public.f23_3e_p1b_submit_conversion_draft(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_expected_case_version integer,
  p_expected_contact_version integer,
  p_expected_assignment_version integer,
  p_expected_request_intent_digest bytea,
  p_expected_action_graph_digest bytea,
  p_environment_fingerprint bytea,
  p_idempotency_key_digest bytea,
  p_operation_intent_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean, outcome_code text, replayed boolean, conversion_request_id uuid,
  request_status text, request_version integer, case_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1b_submit_conversion_draft$
declare
  v_center_id text; v_case_id uuid; v_contact_id uuid;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_registry_found boolean := false;
  v_registry_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_conflict text; v_previous_version integer;
begin
  if p_conversion_request_id is null or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or p_expected_request_intent_digest is null or pg_catalog.octet_length(p_expected_request_intent_digest) <> 32
     or p_expected_action_graph_digest is null or pg_catalog.octet_length(p_expected_action_graph_digest) <> 32
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_expires_at is null
     or p_idempotency_expires_at <= pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at > pg_catalog.transaction_timestamp() + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  select r.center_id, r.consultation_case_id, r.source_contact_id
  into v_center_id, v_case_id, v_contact_id
  from public.crm_conversion_request r where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  -- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = p_environment_fingerprint and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request' and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.conversion.submit_review'
    and i.idempotency_key_digest = p_idempotency_key_digest for update;
  v_registry_found := found;
  if v_registry_found and (
    v_registry.intent_digest is distinct from p_operation_intent_digest
    or v_registry.request_intent_digest is distinct from p_expected_request_intent_digest
    or v_registry.action_graph_digest is distinct from p_expected_action_graph_digest
  ) then
    return query select false, 'IDEMPOTENCY_CONFLICT', false, v_registry.result_request_id,
      null::text, null::integer, null::integer, null::uuid; return;
  end if;
  if not v_registry_found then
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
      resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
      intent_digest, request_intent_digest, action_graph_digest, request_id, expires_at
    ) values (
      v_registry_id, p_environment_fingerprint, v_center_id, 'conversion_request',
      p_conversion_request_id, v_case_id, 'crm.conversion.submit_review',
      p_idempotency_key_digest, p_operation_intent_digest,
      p_expected_request_intent_digest, p_expected_action_graph_digest,
      p_conversion_request_id, p_idempotency_expires_at
    );
  elsif v_registry.status <> 'COMPLETED' then
    raise exception 'f23_3e_p1b_unexpected_idempotency_state: %', v_registry.status;
  end if;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_contact_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = v_case_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 4. CURRENT_ASSIGNMENT_ROW
  if v_conflict is null then
    select a.* into v_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id and a.consultation_case_id = v_case_id
      and a.assignment_id = v_case.active_assignment_id and a.assignment_status = 'ACTIVE' for update;
    if not found or v_assignment.assigned_consultant_user_id <> p_actor_user_id then v_conflict := 'ACTOR_NOT_ASSIGNED'; end if;
  end if;

  if v_registry_found then
    if v_conflict is not null then
      return query select false, v_conflict, false, v_registry.result_request_id,
        null::text, null::integer, null::integer, null::uuid; return;
    end if;
    return query select true, v_registry.result_outcome_code, true,
      v_registry.result_request_id, v_registry.result_request_status,
      v_registry.result_request_version, v_registry.result_case_version,
      v_registry.result_correlation_id; return;
  end if;

  if v_conflict is null and v_request.status <> 'DRAFT' then v_conflict := 'REQUEST_STATE_CONFLICT'; end if;
  if v_conflict is null and v_request.request_version <> p_expected_request_version then v_conflict := 'REQUEST_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_assignment.assignment_id is distinct from v_request.source_assignment_id
    or v_assignment.assignment_version <> p_expected_assignment_version
  ) then v_conflict := 'ASSIGNMENT_VERSION_STALE'; end if;
  if v_conflict is null and (v_case.case_version <> p_expected_case_version or v_contact.contact_version <> p_expected_contact_version) then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_request.intent_digest is distinct from p_expected_request_intent_digest
    or v_request.action_graph_digest is distinct from p_expected_action_graph_digest
  ) then v_conflict := 'REQUEST_DIGEST_STALE'; end if;
  if v_conflict is null and (
    v_request.source_case_version <> v_case.case_version
    or v_request.source_contact_version <> v_contact.contact_version
    or v_request.source_assignment_id is distinct from v_assignment.assignment_id
    or v_request.source_assignment_version <> v_assignment.assignment_version
  ) then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and v_case.conversion_state <> 'DRAFT' then v_conflict := 'REQUEST_STATE_CONFLICT'; end if;

  if v_conflict is not null then
    delete from public.crm_idempotency_registry i where i.idempotency_record_id = v_registry_id;
    return query select false, v_conflict, false, p_conversion_request_id,
      null::text, null::integer, null::integer, null::uuid; return;
  end if;

  v_previous_version := v_request.request_version;
  update public.crm_conversion_request r
  set status = 'READY_FOR_REVIEW', source_case_version = v_case.case_version + 1,
      source_contact_version = v_contact.contact_version,
      source_assignment_id = v_assignment.assignment_id,
      source_assignment_version = v_assignment.assignment_version,
      request_version = r.request_version + 1
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id
  returning r.* into v_request;
  update public.consultation_case c
  set conversion_state = 'REVIEW_PENDING', case_version = c.case_version + 1
  where c.center_id = v_center_id and c.consultation_case_id = v_case_id returning c.* into v_case;

  -- 5. AUDIT_OUTBOX_ROWS
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id, request_id,
    assignment_id, previous_version, new_version, correlation_id
  ) values (
    v_center_id, 'crm.conversion.review_submitted', p_actor_user_id,
    'crm_conversion_request', p_conversion_request_id, p_conversion_request_id,
    v_assignment.assignment_id, v_previous_version, v_request.request_version, v_correlation_id
  );
  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    v_center_id, 'crm_conversion_request', p_conversion_request_id,
    'crm.conversion.review_submitted', v_request.request_version,
    pg_catalog.jsonb_build_object(
      'event_schema_version', 1, 'resource_kind', 'crm_conversion_request',
      'resource_id', p_conversion_request_id::text, 'request_id', p_conversion_request_id::text,
      'assignment_id', v_assignment.assignment_id::text,
      'previous_version', v_previous_version, 'new_version', v_request.request_version,
      'status', 'READY_FOR_REVIEW', 'correlation_id', v_correlation_id::text,
      'operation', 'crm.conversion.submit_review', 'outcome_code', 'REVIEW_SUBMITTED'
    )
  );
  update public.crm_idempotency_registry i
  set status = 'COMPLETED',
      terminal_outcome_digest = public.f23_3e_p1b_internal_result_digest(
        p_conversion_request_id, v_request.request_version, v_case.case_version,
        'READY_FOR_REVIEW', 'REVIEW_SUBMITTED', v_correlation_id
      ),
      result_request_id = p_conversion_request_id,
      result_request_version = v_request.request_version,
      result_case_version = v_case.case_version,
      result_request_status = 'READY_FOR_REVIEW', result_outcome_code = 'REVIEW_SUBMITTED',
      result_correlation_id = v_correlation_id,
      idempotency_version = i.idempotency_version + 1,
      completed_at = pg_catalog.transaction_timestamp()
  where i.idempotency_record_id = v_registry_id;

  return query select true, 'REVIEW_SUBMITTED', false, p_conversion_request_id,
    'READY_FOR_REVIEW', v_request.request_version, v_case.case_version, v_correlation_id;
end;
$f23_3e_p1b_submit_conversion_draft$;

-- CANCEL_REQUEST_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. AUTH_USER_EXISTENCE_ROW (attribution existence only; not account security)
-- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
-- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
-- 4. CURRENT_ASSIGNMENT_ROW
-- 5. AUDIT_OUTBOX_ROWS, then idempotency completion
-- 6. COMMIT_ATOMIC by the caller transaction
-- CANCEL_REQUEST_RUNTIME_ATOMIC_END
create function public.f23_3e_p1b_cancel_conversion_request(
  p_conversion_request_id uuid,
  p_actor_user_id uuid,
  p_expected_request_version integer,
  p_expected_case_version integer,
  p_expected_assignment_version integer,
  p_environment_fingerprint bytea,
  p_idempotency_key_digest bytea,
  p_operation_intent_digest bytea,
  p_safe_reason_code text,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean, outcome_code text, replayed boolean, conversion_request_id uuid,
  request_status text, request_version integer, case_version integer, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1b_cancel_conversion_request$
declare
  v_center_id text; v_case_id uuid; v_contact_id uuid;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_registry_found boolean := false;
  v_registry_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_conflict text; v_previous_version integer;
begin
  if p_conversion_request_id is null or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_assignment_version is null or p_expected_assignment_version < 1
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_safe_reason_code is null
     or p_safe_reason_code !~ '^[a-z][a-z0-9_.-]{0,159}$'
     or p_idempotency_expires_at is null
     or p_idempotency_expires_at <= pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at > pg_catalog.transaction_timestamp() + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  select r.center_id, r.consultation_case_id, r.source_contact_id
  into v_center_id, v_case_id, v_contact_id
  from public.crm_conversion_request r where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  -- 0. CENTER_CRM_CONTROL_ROW
  select r.* into v_root from public.center_crm_control r where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;
  -- 1. AUTH_USER_EXISTENCE_ROW
  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::text, null::integer, null::integer, null::uuid; return;
  end if;

  -- 2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROW
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = p_environment_fingerprint and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request' and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.conversion.cancel'
    and i.idempotency_key_digest = p_idempotency_key_digest for update;
  v_registry_found := found;
  if v_registry_found and (
    v_registry.intent_digest is distinct from p_operation_intent_digest
    or v_registry.request_intent_digest is not null
    or v_registry.action_graph_digest is not null
  ) then
    return query select false, 'IDEMPOTENCY_CONFLICT', false, v_registry.result_request_id,
      null::text, null::integer, null::integer, null::uuid; return;
  end if;
  if not v_registry_found then
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
      resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
      intent_digest, request_id, expires_at
    ) values (
      v_registry_id, p_environment_fingerprint, v_center_id, 'conversion_request',
      p_conversion_request_id, v_case_id, 'crm.conversion.cancel',
      p_idempotency_key_digest, p_operation_intent_digest,
      p_conversion_request_id, p_idempotency_expires_at
    );
  elsif v_registry.status <> 'COMPLETED' then
    raise exception 'f23_3e_p1b_unexpected_idempotency_state: %', v_registry.status;
  end if;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_contact_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = v_case_id for update;
  if not found then v_conflict := 'RESOURCE_NOT_FOUND'; end if;

  -- 4. CURRENT_ASSIGNMENT_ROW
  if v_conflict is null then
    select a.* into v_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id and a.consultation_case_id = v_case_id
      and a.assignment_id = v_case.active_assignment_id and a.assignment_status = 'ACTIVE' for update;
    if not found or v_assignment.assigned_consultant_user_id <> p_actor_user_id then v_conflict := 'ACTOR_NOT_ASSIGNED'; end if;
  end if;

  if v_registry_found then
    if v_conflict is not null then
      return query select false, v_conflict, false, v_registry.result_request_id,
        null::text, null::integer, null::integer, null::uuid; return;
    end if;
    return query select true, v_registry.result_outcome_code, true,
      v_registry.result_request_id, v_registry.result_request_status,
      v_registry.result_request_version, v_registry.result_case_version,
      v_registry.result_correlation_id; return;
  end if;

  if v_conflict is null and v_request.status not in ('DRAFT', 'READY_FOR_REVIEW') then v_conflict := 'REQUEST_STATE_CONFLICT'; end if;
  if v_conflict is null and v_request.request_version <> p_expected_request_version then v_conflict := 'REQUEST_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_assignment.assignment_id is distinct from v_request.source_assignment_id
    or v_assignment.assignment_version <> p_expected_assignment_version
  ) then v_conflict := 'ASSIGNMENT_VERSION_STALE'; end if;
  if v_conflict is null and v_case.case_version <> p_expected_case_version then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and (
    v_request.source_case_version <> v_case.case_version
    or v_request.source_contact_version <> v_contact.contact_version
    or v_request.source_assignment_id is distinct from v_assignment.assignment_id
    or v_request.source_assignment_version <> v_assignment.assignment_version
  ) then v_conflict := 'SOURCE_VERSION_STALE'; end if;
  if v_conflict is null and exists (
    select 1 from public.crm_conversion_request r
    where r.center_id = v_center_id and r.consultation_case_id = v_case_id
      and r.conversion_request_id <> p_conversion_request_id
      and r.status in ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXECUTING', 'COMPENSATION_REQUIRED')
  ) then v_conflict := 'ACTIVE_REQUEST_CONFLICT'; end if;

  if v_conflict is not null then
    delete from public.crm_idempotency_registry i where i.idempotency_record_id = v_registry_id;
    return query select false, v_conflict, false, p_conversion_request_id,
      null::text, null::integer, null::integer, null::uuid; return;
  end if;

  v_previous_version := v_request.request_version;
  update public.crm_conversion_request r
  set status = 'CANCELLED', request_version = r.request_version + 1
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id
  returning r.* into v_request;
  update public.consultation_case c
  set conversion_state = 'NOT_STARTED', case_version = c.case_version + 1
  where c.center_id = v_center_id and c.consultation_case_id = v_case_id returning c.* into v_case;

  -- 5. AUDIT_OUTBOX_ROWS
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id, request_id,
    assignment_id, previous_version, new_version, safe_reason_code, correlation_id
  ) values (
    v_center_id, 'crm.conversion.request_cancelled', p_actor_user_id,
    'crm_conversion_request', p_conversion_request_id, p_conversion_request_id,
    v_assignment.assignment_id, v_previous_version, v_request.request_version,
    p_safe_reason_code, v_correlation_id
  );
  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    v_center_id, 'crm_conversion_request', p_conversion_request_id,
    'crm.conversion.request_cancelled', v_request.request_version,
    pg_catalog.jsonb_build_object(
      'event_schema_version', 1, 'resource_kind', 'crm_conversion_request',
      'resource_id', p_conversion_request_id::text, 'request_id', p_conversion_request_id::text,
      'assignment_id', v_assignment.assignment_id::text,
      'previous_version', v_previous_version, 'new_version', v_request.request_version,
      'status', 'CANCELLED', 'safe_reason_code', p_safe_reason_code,
      'correlation_id', v_correlation_id::text,
      'operation', 'crm.conversion.cancel', 'outcome_code', 'REQUEST_CANCELLED'
    )
  );
  update public.crm_idempotency_registry i
  set status = 'COMPLETED',
      terminal_outcome_digest = public.f23_3e_p1b_internal_result_digest(
        p_conversion_request_id, v_request.request_version, v_case.case_version,
        'CANCELLED', 'REQUEST_CANCELLED', v_correlation_id
      ),
      result_request_id = p_conversion_request_id,
      result_request_version = v_request.request_version,
      result_case_version = v_case.case_version,
      result_request_status = 'CANCELLED', result_outcome_code = 'REQUEST_CANCELLED',
      result_correlation_id = v_correlation_id,
      idempotency_version = i.idempotency_version + 1,
      completed_at = pg_catalog.transaction_timestamp()
  where i.idempotency_record_id = v_registry_id;

  return query select true, 'REQUEST_CANCELLED', false, p_conversion_request_id,
    'CANCELLED', v_request.request_version, v_case.case_version, v_correlation_id;
end;
$f23_3e_p1b_cancel_conversion_request$;

create function public.f23_3e_p1b_get_conversion_request_status(
  p_conversion_request_id uuid
)
returns table (
  conversion_request_id uuid,
  request_status text,
  request_version integer,
  consultation_case_id uuid,
  case_version integer,
  source_case_version integer,
  source_contact_version integer,
  source_assignment_version integer,
  requested_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $f23_3e_p1b_get_conversion_request_status$
  select r.conversion_request_id, r.status, r.request_version,
    r.consultation_case_id, c.case_version, r.source_case_version,
    r.source_contact_version, r.source_assignment_version,
    r.requested_at, r.updated_at
  from public.crm_conversion_request r
  join public.consultation_case c
    on c.center_id = r.center_id
   and c.consultation_case_id = r.consultation_case_id
  where r.conversion_request_id = p_conversion_request_id;
$f23_3e_p1b_get_conversion_request_status$;

revoke all on function public.f23_3e_p1b_internal_enforce_outbox_delivery_version()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1b_internal_guard_outbox_lifecycle()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1b_internal_guard_idempotency_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1b_internal_result_digest(uuid, integer, integer, text, text, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p1b_create_conversion_draft(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, bytea, timestamptz)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1b_update_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1b_submit_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1b_cancel_conversion_request(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1b_get_conversion_request_status(uuid)
  from public, anon, authenticated;

grant execute on function public.f23_3e_p1b_create_conversion_draft(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, bytea, timestamptz)
  to service_role;
grant execute on function public.f23_3e_p1b_update_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz)
  to service_role;
grant execute on function public.f23_3e_p1b_submit_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz)
  to service_role;
grant execute on function public.f23_3e_p1b_cancel_conversion_request(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, text, timestamptz)
  to service_role;
grant execute on function public.f23_3e_p1b_get_conversion_request_status(uuid)
  to service_role;

comment on function public.f23_3e_p1b_create_conversion_draft(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, bytea, timestamptz) is
  'F23.3E-P1B protected service-role-only internal draft create; actor is protected-service attribution, not end-user authority.';
comment on function public.f23_3e_p1b_update_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz) is
  'F23.3E-P1B protected service-role-only internal draft update; no browser or capability-resolver claim.';
comment on function public.f23_3e_p1b_submit_conversion_draft(uuid, uuid, integer, integer, integer, integer, bytea, bytea, bytea, bytea, bytea, timestamptz) is
  'F23.3E-P1B protected service-role-only internal review submission; never approves or executes conversion.';
comment on function public.f23_3e_p1b_cancel_conversion_request(uuid, uuid, integer, integer, integer, bytea, bytea, bytea, text, timestamptz) is
  'F23.3E-P1B protected service-role-only requester cancellation before approval.';
comment on function public.f23_3e_p1b_get_conversion_request_status(uuid) is
  'F23.3E-P1B service-role-only safe status primitive; final authorization projection is deferred to P1D.';

commit;
