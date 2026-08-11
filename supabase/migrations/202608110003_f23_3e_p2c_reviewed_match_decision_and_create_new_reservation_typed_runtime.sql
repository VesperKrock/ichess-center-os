-- F23.3E-P2C: reviewed-match decisions and create-new reservations.
-- Forward-only composition over P2A/P2B and the P1 idempotency/Audit/Outbox
-- foundation. This migration creates no business aggregate and no profile.

begin;

set local check_function_bodies = true;

do $f23_3e_p2c_prerequisites$
begin
  if pg_catalog.to_regclass('public.crm_identity_match_review') is null
     or pg_catalog.to_regclass('public.crm_profile_creation_reservation') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regprocedure(
       'public.f23_3e_p2b_internal_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)'
     ) is null
     or pg_catalog.to_regprocedure('public.f23_3e_p2b_internal_digest_key(integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p2b_internal_normalize_student_name_v1(text)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p2b_internal_normalize_student_birth_v1(date)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p2b_internal_evidence_digest(bytea,text,integer,text,text,text,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p2b_internal_mutex_key(bytea,bytea,text,text,integer,bytea)') is null then
    raise exception 'f23_3e_p2c_missing_frozen_prerequisite';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p2c_missing_service_role';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p2c_%'
  ) then
    raise exception 'f23_3e_p2c_runtime_already_exists';
  end if;
end;
$f23_3e_p2c_prerequisites$;

-- P2B's complete NO_MATCH vocabulary was intentionally unavailable when the
-- P2A storage-only migration was frozen. Add precisely that server-authored
-- reason without weakening any prior P2A lifecycle mapping.
alter table public.crm_identity_match_review
  drop constraint crm_identity_match_review_safe_reason_code_check,
  add constraint crm_identity_match_review_safe_reason_code_check
    check (safe_reason_code in (
      'NAME_AND_BIRTH_EXACT_CANDIDATE',
      'NAME_SIMILAR_CANDIDATE',
      'BIRTH_EVIDENCE_MATCH',
      'CONTACT_EVIDENCE_MATCH',
      'MULTIPLE_CANDIDATES',
      'CONTRADICTORY_EVIDENCE',
      'INSUFFICIENT_EVIDENCE',
      'NO_CANDIDATE_AFTER_COMPLETE_SEARCH'
    ));

-- P1B owns one exact-result snapshot family. P2C adds a disjoint, typed
-- snapshot family to the same scoped registry so replay never consults mutable
-- review/reservation rows.
alter table public.crm_idempotency_registry
  add column p2c_result_resource_kind text,
  add column p2c_result_resource_id uuid,
  add column p2c_result_resource_version integer,
  add column p2c_result_resource_status text,
  add column p2c_result_opaque_target_id uuid,
  add column p2c_result_expires_at timestamptz,
  add column p2c_result_outcome_code text,
  add column p2c_result_correlation_id uuid,
  add constraint crm_idempotency_registry_p2c_resource_kind_check
    check (
      p2c_result_resource_kind is null
      or p2c_result_resource_kind in ('identity_match_review', 'profile_creation_reservation')
    ),
  add constraint crm_idempotency_registry_p2c_resource_version_check
    check (p2c_result_resource_version is null or p2c_result_resource_version >= 1),
  add constraint crm_idempotency_registry_p2c_resource_status_check
    check (
      p2c_result_resource_status is null
      or p2c_result_resource_status in (
        'PENDING', 'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED',
        'REJECTED_MATCH', 'CONFLICT', 'EXPIRED', 'SUPERSEDED',
        'ACTIVE', 'CANCELLED'
      )
    ),
  add constraint crm_idempotency_registry_p2c_outcome_code_check
    check (
      p2c_result_outcome_code is null
      or p2c_result_outcome_code in (
        'MATCH_REVIEW_CREATED', 'MATCH_REVIEW_DECIDED',
        'MATCH_REVIEW_SUPERSEDED', 'MATCH_REVIEW_EXPIRED',
        'CREATION_RESERVED', 'CREATION_RESERVATION_CANCELLED',
        'CREATION_RESERVATION_EXPIRED'
      )
    );

alter table public.crm_idempotency_registry
  drop constraint crm_idempotency_registry_completed_result_snapshot_check,
  add constraint crm_idempotency_registry_completed_result_snapshot_check
    check (
      (
        status = 'COMPLETED'
        and (
          (
            result_request_id is not null
            and result_request_version is not null
            and result_case_version is not null
            and result_request_status is not null
            and result_outcome_code is not null
            and result_correlation_id is not null
            and p2c_result_resource_kind is null
            and p2c_result_resource_id is null
            and p2c_result_resource_version is null
            and p2c_result_resource_status is null
            and p2c_result_opaque_target_id is null
            and p2c_result_expires_at is null
            and p2c_result_outcome_code is null
            and p2c_result_correlation_id is null
          )
          or
          (
            result_request_id is null
            and result_request_version is null
            and result_case_version is null
            and result_request_status is null
            and result_outcome_code is null
            and result_correlation_id is null
            and p2c_result_resource_kind is not null
            and p2c_result_resource_id is not null
            and p2c_result_resource_version is not null
            and p2c_result_resource_status is not null
            and p2c_result_expires_at is not null
            and p2c_result_outcome_code is not null
            and p2c_result_correlation_id is not null
          )
        )
      )
      or
      (
        status <> 'COMPLETED'
        and result_request_id is null
        and result_request_version is null
        and result_case_version is null
        and result_request_status is null
        and result_outcome_code is null
        and result_correlation_id is null
        and p2c_result_resource_kind is null
        and p2c_result_resource_id is null
        and p2c_result_resource_version is null
        and p2c_result_resource_status is null
        and p2c_result_opaque_target_id is null
        and p2c_result_expires_at is null
        and p2c_result_outcome_code is null
        and p2c_result_correlation_id is null
      )
    );

create function public.f23_3e_p2c_internal_guard_idempotency_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2c_internal_guard_idempotency_snapshot$
begin
  if tg_op = 'UPDATE'
     and old.status in ('COMPLETED', 'CONFLICT', 'EXPIRED')
     and (
       new.p2c_result_resource_kind is distinct from old.p2c_result_resource_kind
       or new.p2c_result_resource_id is distinct from old.p2c_result_resource_id
       or new.p2c_result_resource_version is distinct from old.p2c_result_resource_version
       or new.p2c_result_resource_status is distinct from old.p2c_result_resource_status
       or new.p2c_result_opaque_target_id is distinct from old.p2c_result_opaque_target_id
       or new.p2c_result_expires_at is distinct from old.p2c_result_expires_at
       or new.p2c_result_outcome_code is distinct from old.p2c_result_outcome_code
       or new.p2c_result_correlation_id is distinct from old.p2c_result_correlation_id
     ) then
    raise exception 'f23_3e_p2c_terminal_result_snapshot_is_immutable';
  end if;
  return new;
end;
$f23_3e_p2c_internal_guard_idempotency_snapshot$;

create trigger f23_3e_p2c_idempotency_snapshot_guard
before insert or update on public.crm_idempotency_registry
for each row execute function public.f23_3e_p2c_internal_guard_idempotency_snapshot();

create unique index crm_outbox_event_p2c_review_version_uidx
  on public.crm_outbox_event (center_id, aggregate_kind, aggregate_id, event_version)
  where aggregate_kind = 'identity_match_review';

create unique index crm_outbox_event_p2c_reservation_version_uidx
  on public.crm_outbox_event (center_id, aggregate_kind, aggregate_id, event_version)
  where aggregate_kind = 'profile_creation_reservation';

create function public.f23_3e_p2c_internal_safe_result(p_outcome_code text)
returns jsonb
language sql
immutable
strict
set search_path = ''
as $f23_3e_p2c_internal_safe_result$
  select pg_catalog.jsonb_build_object(
    'ok', false,
    'outcome_code', p_outcome_code,
    'replayed', false,
    'profile_created', false,
    'profile_reused', false,
    'conversion_approved', false,
    'request_completed', false
  )
$f23_3e_p2c_internal_safe_result$;

create function public.f23_3e_p2c_internal_binding_digest(
  p_key bytea,
  p_domain text,
  p_search jsonb,
  p_action_intent_digest bytea
)
returns bytea
language sql
immutable
strict
set search_path = ''
as $f23_3e_p2c_internal_binding_digest$
  select extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'domain', p_domain,
      'schema_version', 1,
      'request_version', p_search -> 'request_version',
      'source_contact_version', p_search -> 'source_contact_version',
      'source_case_version', p_search -> 'source_case_version',
      'source_candidate_version', p_search -> 'source_candidate_version',
      'source_assignment_version', p_search -> 'source_assignment_version',
      'identity_policy_registry_id', p_search -> 'identity_policy_registry_id',
      'identity_policy_registry_version', p_search -> 'identity_policy_registry_version',
      'normalization_version', p_search -> 'normalization_version',
      'match_policy_version', p_search -> 'match_policy_version',
      'minimum_evidence_policy_version', p_search -> 'minimum_evidence_policy_version',
      'adapter_snapshot_reference', p_search -> 'adapter_snapshot_reference',
      'evidence_set_reference', p_search -> 'evidence_set_reference',
      'mutex_set_reference', p_search -> 'mutex_set_reference',
      'outcome_code', p_search -> 'outcome_code',
      'match_outcome', p_search -> 'match_outcome',
      'candidates', p_search -> 'candidates',
      'action_intent_digest', pg_catalog.encode(p_action_intent_digest, 'hex')
    )::text, 'UTF8'),
    p_key,
    'sha256'
  )
$f23_3e_p2c_internal_binding_digest$;

create function public.f23_3e_p2c_internal_append_audit_outbox(
  p_center_id text,
  p_event_type text,
  p_actor_user_id uuid,
  p_resource_kind text,
  p_resource_id uuid,
  p_request_id uuid,
  p_assignment_id uuid,
  p_previous_version integer,
  p_new_version integer,
  p_status text,
  p_safe_reason_code text,
  p_operation text,
  p_outcome_code text,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2c_internal_append_audit_outbox$
declare
  v_payload jsonb;
begin
  insert into public.crm_audit_event (
    center_id, event_type, actor_user_id, resource_kind, resource_id,
    request_id, assignment_id, previous_version, new_version,
    safe_reason_code, correlation_id
  ) values (
    p_center_id, p_event_type, p_actor_user_id, p_resource_kind, p_resource_id,
    p_request_id, p_assignment_id, p_previous_version, p_new_version,
    pg_catalog.lower(p_safe_reason_code), p_correlation_id
  );

  v_payload := pg_catalog.jsonb_build_object(
    'event_schema_version', 1,
    'resource_kind', p_resource_kind,
    'resource_id', p_resource_id,
    'request_id', p_request_id,
    'assignment_id', p_assignment_id,
    'new_version', p_new_version,
    'status', p_status,
    'safe_reason_code', p_safe_reason_code,
    'correlation_id', p_correlation_id,
    'operation', p_operation,
    'outcome_code', p_outcome_code
  );
  if p_previous_version is not null then
    v_payload := v_payload || pg_catalog.jsonb_build_object('previous_version', p_previous_version);
  end if;

  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    p_center_id, p_resource_kind, p_resource_id, p_event_type, p_new_version, v_payload
  );
end;
$f23_3e_p2c_internal_append_audit_outbox$;

create function public.f23_3e_p2c_internal_execute_mutation(
  p_operation text,
  p_conversion_request_id uuid,
  p_subject_id uuid,
  p_expected_subject_version integer,
  p_review_action text,
  p_supersedes_review_id uuid,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea,
  p_detail_opaque_target_id uuid,
  p_expected_target_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2c_internal_execute_mutation$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_prior_review public.crm_identity_match_review%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_member_role text;
  v_key bytea;
  v_environment_fingerprint bytea;
  v_name_normalized text;
  v_birth_normalized text;
  v_name_digest bytea;
  v_birth_digest bytea;
  v_mutex_keys bytea[];
  v_mutex_key bytea;
  v_action_intent_digest bytea;
  v_action_graph_for_intent bytea;
  v_intent_digest bytea;
  v_search jsonb;
  v_candidates jsonb;
  v_evidence_digest bytea;
  v_mutex_digest bytea;
  v_projection_digest bytea;
  v_source_versions_digest bytea;
  v_detail_target_id uuid := p_detail_opaque_target_id;
  v_detail_target_version integer := p_expected_target_version;
  v_target_namespace text;
  v_target_id uuid;
  v_target_version integer;
  v_registry_id uuid;
  v_resource_kind text;
  v_resource_id uuid;
  v_resource_version integer;
  v_resource_status text;
  v_result_target_id uuid;
  v_result_expires_at timestamptz;
  v_outcome_code text;
  v_event_type text;
  v_event_reason text;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
  v_search_ok boolean := false;
begin
  perform pg_catalog.set_config('lock_timeout', '4000ms', true);

  if p_operation not in (
       'crm.identity.create_match_review',
       'crm.identity.decide_match_review',
       'crm.identity.supersede_match_review',
       'crm.identity.expire_match_review',
       'crm.identity.reserve_create_target',
       'crm.identity.cancel_creation_reservation',
       'crm.identity.expire_creation_reservation'
     )
     or p_conversion_request_id is null
     or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_identity_kind is null or p_identity_kind not in ('STUDENT', 'GUARDIAN')
     or p_candidate_student_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_candidate_version is null or p_expected_candidate_version < 1
     or p_display_name_evidence is null
     or p_birth_date_evidence is null
     or p_expected_normalization_version is null or p_expected_normalization_version < 1
     or p_expected_match_policy_version is null or p_expected_match_policy_version < 1
     or p_expected_minimum_evidence_policy_version is null or p_expected_minimum_evidence_policy_version < 1
     or p_expected_policy_registry_version is null or p_expected_policy_registry_version < 1
     or p_expected_adapter_version is null or p_expected_adapter_version < 1
     or p_action_id is null
     or p_idempotency_key_digest is null
     or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or ((p_detail_opaque_target_id is null) <> (p_expected_target_version is null)) then
    return public.f23_3e_p2c_internal_safe_result('INVALID_INPUT');
  end if;

  if p_operation <> 'crm.identity.create_match_review'
     and (p_subject_id is null or p_expected_subject_version is null or p_expected_subject_version < 1) then
    return public.f23_3e_p2c_internal_safe_result('INVALID_INPUT');
  end if;
  if p_operation = 'crm.identity.decide_match_review'
     and p_review_action not in (
       'REUSE_EXISTING', 'PREPARE_CREATE_NEW',
       'REJECT_IDENTITY_ACTION', 'ESCALATE_IDENTITY_CONFLICT'
     ) then
    return public.f23_3e_p2c_internal_safe_result('INVALID_INPUT');
  end if;

  -- Selector only: center is always re-established from the locked Request.
  select r.center_id into v_center_id
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  -- 1. Exact CRM root.
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return public.f23_3e_p2c_internal_safe_result('CRM_RUNTIME_NOT_ACTIVE');
  end if;

  select pg_catalog.lower(m.role) into v_member_role
  from public.center_members m
  where m.center_id = v_center_id
    and m.user_id = p_actor_user_id
    and m.status = 'active'
  order by m.id
  limit 1
  for share;
  if not found or v_member_role not in ('owner', 'center_admin', 'consultant') then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_member_role = 'consultant' and not exists (
    select 1
    from public.crm_conversion_request rq
    join public.consultation_case_assignment a
      on a.center_id = rq.center_id
     and a.consultation_case_id = rq.consultation_case_id
     and a.assignment_id = rq.source_assignment_id
    where rq.conversion_request_id = p_conversion_request_id
      and rq.center_id = v_center_id
      and a.assigned_consultant_user_id = p_actor_user_id
      and a.assignment_status = 'ACTIVE'
  ) then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  -- Select the exact caller-expected policy generation, including a retained
  -- generation. This permits an exact replay or a terminalizing expiry/
  -- supersession after drift; every new semantic mutation is still checked by
  -- the P2B CURRENT-policy core below.
  select p.* into v_policy
  from public.crm_identity_policy_registry p
  where p.center_id = v_center_id
    and p.identity_kind = p_identity_kind
    and p.normalization_version = p_expected_normalization_version
    and p.match_policy_version = p_expected_match_policy_version
    and p.minimum_evidence_policy_version = p_expected_minimum_evidence_policy_version
    and p.policy_registry_version = p_expected_policy_registry_version
  order by p.created_at desc
  limit 1
  for share;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('MATCH_POLICY_STALE');
  end if;
  if p_identity_kind = 'GUARDIAN' then
    return public.f23_3e_p2c_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  end if;
  if v_policy.normalization_algorithm <> 'p2b.student_identity.nfc_casefold_v1'
     or p_expected_adapter_version <> 1 then
    return public.f23_3e_p2c_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  end if;

  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_environment_fingerprint := public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  if v_environment_fingerprint is distinct from v_policy.environment_fingerprint then
    return public.f23_3e_p2c_internal_safe_result('MATCH_POLICY_STALE');
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
  select pg_catalog.array_agg(x.k order by x.k)
  into v_mutex_keys
  from (
    select distinct pg_catalog.unnest(array[
      public.f23_3e_p2b_internal_mutex_key(
        v_key, v_environment_fingerprint, v_center_id, p_identity_kind,
        v_policy.normalization_version, v_name_digest
      ),
      public.f23_3e_p2b_internal_mutex_key(
        v_key, v_environment_fingerprint, v_center_id, p_identity_kind,
        v_policy.normalization_version, v_birth_digest
      )
    ]) as k
  ) x;
  if pg_catalog.array_length(v_mutex_keys, 1) <> 2 then
    raise exception 'f23_3e_p2c_mutex_domain_collision';
  end if;

  -- 2. Deduplicated, byte-sorted mutex rows. A retired generation must already
  -- have rows from its original P2B/review transaction; P2C never revives it.
  foreach v_mutex_key in array v_mutex_keys loop
    if v_policy.status = 'CURRENT' then
      insert into public.crm_identity_match_mutex (
        identity_match_mutex_key, environment_fingerprint, center_id, identity_kind,
        identity_policy_registry_id, normalization_version, digest_key_epoch
      ) values (
        v_mutex_key, v_environment_fingerprint, v_center_id, p_identity_kind,
        v_policy.identity_policy_registry_id, v_policy.normalization_version,
        v_policy.digest_key_epoch
      ) on conflict (identity_match_mutex_key) do nothing;
    end if;
    perform 1
    from public.crm_identity_match_mutex m
    where m.identity_match_mutex_key = v_mutex_key
      and m.center_id = v_center_id
      and m.identity_kind = p_identity_kind
      and m.identity_policy_registry_id = v_policy.identity_policy_registry_id
    for update;
    if not found then
      return public.f23_3e_p2c_internal_safe_result('MATCH_POLICY_STALE');
    end if;
  end loop;

  -- 3. Request/idempotency tier. Source/assignment/target authoritative locks
  -- are acquired by the protected P2B core for every non-replay mutation.
  select r.* into v_request
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id
    and r.center_id = v_center_id
  for update;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  -- Locate the scoped record before intent recomputation. A prior record owns
  -- the frozen action-graph snapshot used by its original semantic intent;
  -- replay must not reinterpret that success through a later mutable Request.
  select i.* into v_registry
  from public.crm_idempotency_registry i
  where i.environment_fingerprint = v_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = p_operation
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  if found then
    v_action_graph_for_intent := v_registry.action_graph_digest;
  else
    v_action_graph_for_intent := v_request.action_graph_digest;
  end if;

  v_action_intent_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'domain', 'f23.3e.p2c.action-intent.v1',
      'request_id', p_conversion_request_id,
      'action_id', p_action_id,
      'identity_kind', p_identity_kind,
      'candidate_student_id', p_candidate_student_id,
      'request_action_graph_digest', pg_catalog.encode(v_action_graph_for_intent, 'hex')
    )::text, 'UTF8'), v_key, 'sha256'
  );
  v_intent_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'domain', 'f23.3e.p2c.idempotency-intent.v1',
      'operation', p_operation,
      'request_id', p_conversion_request_id,
      'subject_id', p_subject_id,
      'expected_subject_version', p_expected_subject_version,
      'review_action', p_review_action,
      'supersedes_review_id', p_supersedes_review_id,
      'expected_request_version', p_expected_request_version,
      'identity_kind', p_identity_kind,
      'candidate_student_id', p_candidate_student_id,
      'expected_contact_version', p_expected_contact_version,
      'expected_case_version', p_expected_case_version,
      'expected_candidate_version', p_expected_candidate_version,
      'name_evidence_digest', pg_catalog.encode(v_name_digest, 'hex'),
      'birth_evidence_digest', pg_catalog.encode(v_birth_digest, 'hex'),
      'birth_year_evidence', p_birth_year_evidence,
      'normalization_version', p_expected_normalization_version,
      'match_policy_version', p_expected_match_policy_version,
      'minimum_evidence_policy_version', p_expected_minimum_evidence_policy_version,
      'policy_registry_version', p_expected_policy_registry_version,
      'adapter_version', p_expected_adapter_version,
      'action_id', p_action_id,
      'action_intent_digest', pg_catalog.encode(v_action_intent_digest, 'hex'),
      'detail_target_id', p_detail_opaque_target_id,
      'expected_target_version', p_expected_target_version
    )::text, 'UTF8'), v_key, 'sha256'
  );

  if v_registry.idempotency_record_id is not null then
    if v_registry.intent_digest is distinct from v_intent_digest then
      return public.f23_3e_p2c_internal_safe_result('IDEMPOTENCY_CONFLICT');
    end if;
    if v_registry.status = 'COMPLETED'
       and v_registry.p2c_result_resource_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'outcome_code', v_registry.p2c_result_outcome_code,
        'replayed', true,
        'resource_kind', v_registry.p2c_result_resource_kind,
        'resource_id', v_registry.p2c_result_resource_id,
        'resource_version', v_registry.p2c_result_resource_version,
        'status', v_registry.p2c_result_resource_status,
        'opaque_target_id', v_registry.p2c_result_opaque_target_id,
        'expires_at', v_registry.p2c_result_expires_at,
        'correlation_id', v_registry.p2c_result_correlation_id,
        'profile_created', false,
        'profile_reused', false,
        'conversion_approved', false,
        'request_completed', false
      );
    end if;
    return public.f23_3e_p2c_internal_safe_result('IDEMPOTENCY_IN_PROGRESS');
  end if;

  v_registry_id := pg_catalog.gen_random_uuid();
  insert into public.crm_idempotency_registry (
    idempotency_record_id, environment_fingerprint, center_id,
    resource_scope_kind, resource_scope_id, consultation_case_id,
    operation, idempotency_key_digest, intent_digest, action_graph_digest,
    request_id, request_intent_digest, status, expires_at
  ) values (
    v_registry_id, v_environment_fingerprint, v_center_id,
    'conversion_request', p_conversion_request_id, v_request.consultation_case_id,
    p_operation, p_idempotency_key_digest, v_intent_digest, v_request.action_graph_digest,
    p_conversion_request_id, v_request.intent_digest, 'RESERVED',
    pg_catalog.transaction_timestamp() + interval '24 hours'
  );

  -- Obtain target selector only; P2B locks and rechecks it before the review.
  if p_operation in (
    'crm.identity.decide_match_review',
    'crm.identity.supersede_match_review',
    'crm.identity.expire_match_review'
  ) then
    select r.opaque_target_id, r.target_version
    into v_detail_target_id, v_detail_target_version
    from public.crm_identity_match_review r
    where r.match_review_id = p_subject_id
      and r.center_id = v_center_id
      and r.conversion_request_id = p_conversion_request_id;
  elsif p_operation in (
    'crm.identity.reserve_create_target',
    'crm.identity.cancel_creation_reservation',
    'crm.identity.expire_creation_reservation'
  ) then
    if p_operation = 'crm.identity.reserve_create_target' then
      select r.opaque_target_id, r.target_version
      into v_detail_target_id, v_detail_target_version
      from public.crm_identity_match_review r
      where r.match_review_id = p_subject_id
        and r.center_id = v_center_id
        and r.conversion_request_id = p_conversion_request_id;
    else
      select mr.opaque_target_id, mr.target_version
      into v_detail_target_id, v_detail_target_version
      from public.crm_profile_creation_reservation pr
      join public.crm_identity_match_review mr
        on mr.center_id = pr.center_id and mr.match_review_id = pr.match_review_id
      where pr.reservation_id = p_subject_id
        and pr.center_id = v_center_id
        and pr.conversion_request_id = p_conversion_request_id;
    end if;
  end if;

  v_search := public.f23_3e_p2b_internal_search_masked_candidates(
    p_conversion_request_id, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version,
    p_display_name_evidence, p_birth_date_evidence, p_birth_year_evidence,
    p_expected_normalization_version, p_expected_match_policy_version,
    p_expected_minimum_evidence_policy_version, p_expected_policy_registry_version,
    p_expected_adapter_version, v_detail_target_id, v_detail_target_version
  );
  v_search_ok := coalesce((v_search ->> 'ok')::boolean, false);
  if not v_search_ok and p_operation not in (
    'crm.identity.supersede_match_review',
    'crm.identity.expire_match_review',
    'crm.identity.expire_creation_reservation'
  ) then
    delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
    return public.f23_3e_p2c_internal_safe_result(
      coalesce(v_search ->> 'outcome_code', 'MATCH_SEARCH_UNAVAILABLE')
    );
  end if;

  if v_search_ok then
    v_candidates := coalesce(v_search -> 'candidates', '[]'::jsonb);
    v_evidence_digest := public.f23_3e_p2c_internal_binding_digest(
      v_key, 'f23.3e.p2c.evidence.v1', v_search, v_action_intent_digest
    );
    v_mutex_digest := public.f23_3e_p2c_internal_binding_digest(
      v_key, 'f23.3e.p2c.mutex-set.v1', v_search, v_action_intent_digest
    );
    v_projection_digest := public.f23_3e_p2c_internal_binding_digest(
      v_key, 'f23.3e.p2c.projection.v1', v_search, v_action_intent_digest
    );
    v_source_versions_digest := extensions.hmac(
      pg_catalog.convert_to(pg_catalog.jsonb_build_object(
        'domain', 'f23.3e.p2c.source-versions.v1',
        'request', v_search -> 'request_version',
        'contact', v_search -> 'source_contact_version',
        'case', v_search -> 'source_case_version',
        'candidate', v_search -> 'source_candidate_version',
        'assignment', v_search -> 'source_assignment_version'
      )::text, 'UTF8'), v_key, 'sha256'
    );
  end if;

  -- 4. Review/reservation lifecycle mutation. Branches only fill one safe
  -- result; shared code below authors exactly one Audit and one Outbox event.
  if p_operation = 'crm.identity.create_match_review' then
    if not v_search_ok then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
    end if;
    if v_search ->> 'match_outcome' = 'PROBABLE_MATCH' then
      if p_detail_opaque_target_id is null or pg_catalog.jsonb_array_length(v_candidates) <> 1 then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED');
      end if;
      v_target_id := (v_candidates -> 0 ->> 'opaque_target_id')::uuid;
      v_target_version := (v_candidates -> 0 ->> 'target_version')::integer;
      v_target_namespace := v_candidates -> 0 ->> 'target_adapter_namespace';
    elsif v_search ->> 'match_outcome' = 'NO_MATCH' then
      if p_detail_opaque_target_id is not null or pg_catalog.jsonb_array_length(v_candidates) <> 0 then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED');
      end if;
    elsif v_search ->> 'match_outcome' = 'CONFLICT' then
      -- A conflict review has no reusable target binding.
      v_target_id := null;
      v_target_version := null;
      v_target_namespace := null;
    else
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED');
    end if;

    if p_supersedes_review_id is not null then
      select r.* into v_prior_review
      from public.crm_identity_match_review r
      where r.center_id = v_center_id and r.match_review_id = p_supersedes_review_id
      for update;
      if not found
         or v_prior_review.conversion_request_id <> p_conversion_request_id
         or v_prior_review.action_id <> p_action_id
         or v_prior_review.identity_kind <> p_identity_kind
         or v_prior_review.review_status = 'PENDING' then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
      end if;
    end if;

    perform 1
    from public.crm_identity_match_review r
    where r.center_id = v_center_id
      and r.conversion_request_id = p_conversion_request_id
      and r.action_id = p_action_id
      and r.identity_kind = p_identity_kind
      and r.action_intent_digest = v_action_intent_digest
      and r.review_status = 'PENDING'
    for update;
    if found then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_CONFLICT');
    end if;

    insert into public.crm_identity_match_review (
      center_id, conversion_request_id, request_version, action_id,
      action_intent_digest, request_action_graph_digest, identity_kind,
      crm_contact_id, source_contact_version, consultation_case_id,
      source_case_version, candidate_student_id, source_candidate_version,
      target_adapter_namespace, opaque_target_id, target_version,
      identity_policy_registry_id, normalization_version, match_policy_version,
      minimum_evidence_policy_version, match_outcome, review_status,
      evidence_set_digest, identity_mutex_keys_digest, projection_snapshot_digest,
      safe_reason_code, expires_at, supersedes_review_id
    ) values (
      v_center_id, p_conversion_request_id, (v_search ->> 'request_version')::integer,
      p_action_id, v_action_intent_digest, v_request.action_graph_digest, p_identity_kind,
      v_request.source_contact_id, (v_search ->> 'source_contact_version')::integer,
      v_request.consultation_case_id, (v_search ->> 'source_case_version')::integer,
      p_candidate_student_id, (v_search ->> 'source_candidate_version')::integer,
      v_target_namespace, v_target_id, v_target_version,
      (v_search ->> 'identity_policy_registry_id')::uuid,
      (v_search ->> 'normalization_version')::integer,
      (v_search ->> 'match_policy_version')::integer,
      (v_search ->> 'minimum_evidence_policy_version')::integer,
      v_search ->> 'match_outcome', 'PENDING', v_evidence_digest, v_mutex_digest,
      v_projection_digest, v_search ->> 'safe_reason_code',
      (v_search ->> 'expires_at')::timestamptz, p_supersedes_review_id
    ) returning * into v_review;

    v_resource_kind := 'identity_match_review';
    v_resource_id := v_review.match_review_id;
    v_resource_version := v_review.review_version;
    v_resource_status := v_review.review_status;
    v_result_target_id := v_review.opaque_target_id;
    v_result_expires_at := v_review.expires_at;
    v_outcome_code := 'MATCH_REVIEW_CREATED';
    v_event_type := 'crm.identity.review_created';
    v_event_reason := v_review.safe_reason_code;
    v_previous_version := null;

  elsif p_operation in (
    'crm.identity.decide_match_review',
    'crm.identity.supersede_match_review',
    'crm.identity.expire_match_review'
  ) then
    select r.* into v_review
    from public.crm_identity_match_review r
    where r.center_id = v_center_id and r.match_review_id = p_subject_id
    for update;
    if not found
       or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.identity_kind <> p_identity_kind
       or v_review.action_id <> p_action_id
       or v_review.candidate_student_id <> p_candidate_student_id then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
    end if;
    if v_review.review_version <> p_expected_subject_version
       or v_review.review_status <> 'PENDING' then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
    end if;

    if p_operation = 'crm.identity.expire_match_review' then
      if pg_catalog.transaction_timestamp() < v_review.expires_at then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_NOT_EXPIRED');
      end if;
      update public.crm_identity_match_review r
      set review_status = 'EXPIRED', review_version = r.review_version + 1
      where r.match_review_id = v_review.match_review_id
      returning * into v_review;
      v_outcome_code := 'MATCH_REVIEW_EXPIRED';
      v_event_type := 'crm.identity.review_expired';
      v_event_reason := 'SERVER_TIME_EXPIRED';
    elsif p_operation = 'crm.identity.supersede_match_review' then
      if pg_catalog.transaction_timestamp() >= v_review.expires_at then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_EXPIRED');
      end if;
      update public.crm_identity_match_review r
      set review_status = 'SUPERSEDED', review_version = r.review_version + 1
      where r.match_review_id = v_review.match_review_id
      returning * into v_review;
      v_outcome_code := 'MATCH_REVIEW_SUPERSEDED';
      v_event_type := 'crm.identity.review_superseded';
      v_event_reason := 'SOURCE_OR_POLICY_SUPERSEDED';
    else
      if pg_catalog.transaction_timestamp() >= v_review.expires_at then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_EXPIRED');
      end if;
      if not v_search_ok
         or v_review.request_version <> (v_search ->> 'request_version')::integer
         or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
         or v_review.action_intent_digest is distinct from v_action_intent_digest
         or v_review.source_contact_version <> (v_search ->> 'source_contact_version')::integer
         or v_review.source_case_version <> (v_search ->> 'source_case_version')::integer
         or v_review.source_candidate_version <> (v_search ->> 'source_candidate_version')::integer
         or v_review.identity_policy_registry_id <> (v_search ->> 'identity_policy_registry_id')::uuid
         or v_review.normalization_version <> (v_search ->> 'normalization_version')::integer
         or v_review.match_policy_version <> (v_search ->> 'match_policy_version')::integer
         or v_review.minimum_evidence_policy_version <> (v_search ->> 'minimum_evidence_policy_version')::integer
         or v_review.evidence_set_digest is distinct from v_evidence_digest
         or v_review.identity_mutex_keys_digest is distinct from v_mutex_digest
         or v_review.projection_snapshot_digest is distinct from v_projection_digest then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
      end if;

      if p_review_action = 'REUSE_EXISTING' then
        -- P2B V1 deliberately emits reuse_eligible=false. P2C cannot manufacture
        -- stronger evidence or coerce the legacy Student adapter into authority.
        if coalesce((v_search ->> 'reuse_eligible')::boolean, false) is not true
           or v_search ->> 'match_outcome' <> 'EXACT_REVIEWED_MATCH' then
          delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
          return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED');
        end if;
        update public.crm_identity_match_review r
        set review_status = 'EXACT_REVIEWED_MATCH', match_outcome = 'EXACT_REVIEWED_MATCH',
            review_action = 'REUSE_EXISTING', reviewer_user_id = p_actor_user_id,
            reviewer_authority_version = (v_search ->> 'source_assignment_version')::integer,
            review_version = r.review_version + 1
        where r.match_review_id = v_review.match_review_id
        returning * into v_review;
      elsif p_review_action = 'PREPARE_CREATE_NEW' then
        if v_search ->> 'outcome_code' <> 'NO_MATCH'
           or v_search ->> 'match_outcome' <> 'NO_MATCH'
           or v_search ->> 'adapter_completeness' <> 'COMPLETE'
           or pg_catalog.jsonb_array_length(v_candidates) <> 0
           or v_review.match_outcome <> 'NO_MATCH'
           or v_review.opaque_target_id is not null then
          delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
          return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED');
        end if;
        update public.crm_identity_match_review r
        set review_status = 'CREATE_NEW_REVIEWED', review_action = 'PREPARE_CREATE_NEW',
            reviewer_user_id = p_actor_user_id,
            reviewer_authority_version = (v_search ->> 'source_assignment_version')::integer,
            review_version = r.review_version + 1
        where r.match_review_id = v_review.match_review_id
        returning * into v_review;
      elsif p_review_action = 'REJECT_IDENTITY_ACTION' then
        update public.crm_identity_match_review r
        set review_status = 'REJECTED_MATCH', review_action = 'REJECT_IDENTITY_ACTION',
            reviewer_user_id = p_actor_user_id,
            reviewer_authority_version = (v_search ->> 'source_assignment_version')::integer,
            review_version = r.review_version + 1
        where r.match_review_id = v_review.match_review_id
        returning * into v_review;
      else
        update public.crm_identity_match_review r
        set review_status = 'CONFLICT', match_outcome = 'CONFLICT',
            review_action = 'ESCALATE_IDENTITY_CONFLICT', reviewer_user_id = p_actor_user_id,
            reviewer_authority_version = (v_search ->> 'source_assignment_version')::integer,
            review_version = r.review_version + 1
        where r.match_review_id = v_review.match_review_id
        returning * into v_review;
      end if;
      v_outcome_code := 'MATCH_REVIEW_DECIDED';
      v_event_type := 'crm.identity.review_decided';
      v_event_reason := p_review_action;
    end if;

    v_resource_kind := 'identity_match_review';
    v_resource_id := v_review.match_review_id;
    v_resource_version := v_review.review_version;
    v_resource_status := v_review.review_status;
    v_result_target_id := v_review.opaque_target_id;
    v_result_expires_at := v_review.expires_at;
    v_previous_version := p_expected_subject_version;

  elsif p_operation = 'crm.identity.reserve_create_target' then
    select r.* into v_review
    from public.crm_identity_match_review r
    where r.center_id = v_center_id and r.match_review_id = p_subject_id
    for update;
    if not found
       or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.identity_kind <> p_identity_kind
       or v_review.action_id <> p_action_id
       or v_review.candidate_student_id <> p_candidate_student_id then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
    end if;
    if v_review.review_version <> p_expected_subject_version
       or v_review.review_status <> 'CREATE_NEW_REVIEWED'
       or v_review.match_outcome <> 'NO_MATCH'
       or v_review.review_action <> 'PREPARE_CREATE_NEW'
       or pg_catalog.transaction_timestamp() >= v_review.expires_at then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
    end if;
    if not v_search_ok
       or v_search ->> 'outcome_code' <> 'NO_MATCH'
       or v_search ->> 'adapter_completeness' <> 'COMPLETE'
       or pg_catalog.jsonb_array_length(v_candidates) <> 0
       or v_review.request_version <> (v_search ->> 'request_version')::integer
       or v_review.action_intent_digest is distinct from v_action_intent_digest
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_review.evidence_set_digest is distinct from v_evidence_digest
       or v_review.identity_mutex_keys_digest is distinct from v_mutex_digest
       or v_review.projection_snapshot_digest is distinct from v_projection_digest then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESERVATION_STALE');
    end if;
    perform 1
    from public.crm_profile_creation_reservation r
    where r.center_id = v_center_id
      and r.entity_kind = p_identity_kind
      and r.conversion_request_id = p_conversion_request_id
      and r.action_id = p_action_id
      and r.action_intent_digest = v_action_intent_digest
      and r.status = 'ACTIVE'
    for update;
    if found then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESERVATION_CONFLICT');
    end if;

    insert into public.crm_profile_creation_reservation (
      center_id, entity_kind, conversion_request_id, request_version,
      action_id, action_intent_digest, request_action_graph_digest,
      match_review_id, preallocated_target_id, target_adapter_namespace,
      identity_mutex_keys_digest, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version,
      source_evidence_digest, source_versions_digest, projection_snapshot_digest,
      status, reservation_version, expires_at, created_by_user_id
    ) values (
      v_center_id, p_identity_kind, p_conversion_request_id, v_review.request_version,
      p_action_id, v_action_intent_digest, v_request.action_graph_digest,
      v_review.match_review_id, pg_catalog.gen_random_uuid(), 'future.student.profile.v1',
      v_mutex_digest, v_review.identity_policy_registry_id,
      v_review.normalization_version, v_review.match_policy_version,
      v_review.minimum_evidence_policy_version, v_evidence_digest,
      v_source_versions_digest, v_projection_digest, 'ACTIVE', 1,
      least(v_review.expires_at, pg_catalog.transaction_timestamp() + interval '2 minutes'),
      p_actor_user_id
    ) returning * into v_reservation;

    v_resource_kind := 'profile_creation_reservation';
    v_resource_id := v_reservation.reservation_id;
    v_resource_version := v_reservation.reservation_version;
    v_resource_status := v_reservation.status;
    v_result_target_id := v_reservation.preallocated_target_id;
    v_result_expires_at := v_reservation.expires_at;
    v_outcome_code := 'CREATION_RESERVED';
    v_event_type := 'crm.identity.creation_reserved';
    v_event_reason := 'CREATE_NEW_REVIEWED';
    v_previous_version := null;

  else
    -- Cancellation/expiry lock the linked review before the reservation.
    select mr.* into v_review
    from public.crm_profile_creation_reservation pr
    join public.crm_identity_match_review mr
      on mr.center_id = pr.center_id and mr.match_review_id = pr.match_review_id
    where pr.center_id = v_center_id and pr.reservation_id = p_subject_id
    for update of mr;
    if not found then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
    end if;
    select r.* into v_reservation
    from public.crm_profile_creation_reservation r
    where r.center_id = v_center_id and r.reservation_id = p_subject_id
    for update;
    if not found
       or v_reservation.conversion_request_id <> p_conversion_request_id
       or v_reservation.entity_kind <> p_identity_kind
       or v_reservation.action_id <> p_action_id
       or v_review.candidate_student_id <> p_candidate_student_id then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
    end if;
    if v_reservation.reservation_version <> p_expected_subject_version
       or v_reservation.status <> 'ACTIVE' then
      delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
      return public.f23_3e_p2c_internal_safe_result('RESERVATION_CONFLICT');
    end if;

    if p_operation = 'crm.identity.expire_creation_reservation' then
      if pg_catalog.transaction_timestamp() < v_reservation.expires_at then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('RESERVATION_NOT_EXPIRED');
      end if;
      update public.crm_profile_creation_reservation r
      set status = 'EXPIRED', reservation_version = r.reservation_version + 1
      where r.reservation_id = v_reservation.reservation_id
      returning * into v_reservation;
      v_outcome_code := 'CREATION_RESERVATION_EXPIRED';
      v_event_type := 'crm.identity.creation_reservation_expired';
      v_event_reason := 'SERVER_TIME_EXPIRED';
    else
      if pg_catalog.transaction_timestamp() >= v_reservation.expires_at then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('RESERVATION_EXPIRED');
      end if;
      if not v_search_ok
         or v_reservation.request_version <> (v_search ->> 'request_version')::integer
         or v_reservation.action_intent_digest is distinct from v_action_intent_digest
         or v_reservation.request_action_graph_digest is distinct from v_request.action_graph_digest
         or v_reservation.source_evidence_digest is distinct from v_evidence_digest
         or v_reservation.identity_mutex_keys_digest is distinct from v_mutex_digest
         or v_reservation.projection_snapshot_digest is distinct from v_projection_digest then
        delete from public.crm_idempotency_registry where idempotency_record_id = v_registry_id;
        return public.f23_3e_p2c_internal_safe_result('RESERVATION_STALE');
      end if;
      update public.crm_profile_creation_reservation r
      set status = 'CANCELLED', reservation_version = r.reservation_version + 1
      where r.reservation_id = v_reservation.reservation_id
      returning * into v_reservation;
      v_outcome_code := 'CREATION_RESERVATION_CANCELLED';
      v_event_type := 'crm.identity.creation_reservation_cancelled';
      v_event_reason := 'REQUEST_CANCELLED';
    end if;

    v_resource_kind := 'profile_creation_reservation';
    v_resource_id := v_reservation.reservation_id;
    v_resource_version := v_reservation.reservation_version;
    v_resource_status := v_reservation.status;
    v_result_target_id := v_reservation.preallocated_target_id;
    v_result_expires_at := v_reservation.expires_at;
    v_previous_version := p_expected_subject_version;
  end if;

  perform public.f23_3e_p2c_internal_append_audit_outbox(
    v_center_id, v_event_type, p_actor_user_id, v_resource_kind,
    v_resource_id, p_conversion_request_id, v_request.source_assignment_id,
    v_previous_version, v_resource_version, v_resource_status, v_event_reason,
    p_operation, v_outcome_code, v_correlation_id
  );

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', v_outcome_code,
    'replayed', false,
    'resource_kind', v_resource_kind,
    'resource_id', v_resource_id,
    'resource_version', v_resource_version,
    'status', v_resource_status,
    'opaque_target_id', v_result_target_id,
    'expires_at', v_result_expires_at,
    'correlation_id', v_correlation_id,
    'profile_created', false,
    'profile_reused', false,
    'conversion_approved', false,
    'request_completed', false
  );

  update public.crm_idempotency_registry i
  set status = 'COMPLETED',
      terminal_outcome_digest = extensions.hmac(
        pg_catalog.convert_to(v_result::text, 'UTF8'), v_key, 'sha256'
      ),
      idempotency_version = i.idempotency_version + 1,
      completed_at = pg_catalog.transaction_timestamp(),
      p2c_result_resource_kind = v_resource_kind,
      p2c_result_resource_id = v_resource_id,
      p2c_result_resource_version = v_resource_version,
      p2c_result_resource_status = v_resource_status,
      p2c_result_opaque_target_id = v_result_target_id,
      p2c_result_expires_at = v_result_expires_at,
      p2c_result_outcome_code = v_outcome_code,
      p2c_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry_id;

  return v_result;
end;
$f23_3e_p2c_internal_execute_mutation$;

create function public.f23_3e_p2c_create_match_review(
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
  p_action_id uuid,
  p_idempotency_key_digest bytea,
  p_detail_opaque_target_id uuid default null,
  p_expected_target_version integer default null,
  p_supersedes_review_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_create_match_review$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.create_match_review', p_conversion_request_id, null, null,
    null, p_supersedes_review_id, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, p_detail_opaque_target_id, p_expected_target_version
  )
$f23_3e_p2c_create_match_review$;

create function public.f23_3e_p2c_decide_match_review(
  p_conversion_request_id uuid,
  p_match_review_id uuid,
  p_expected_review_version integer,
  p_review_action text,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_decide_match_review$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.decide_match_review', p_conversion_request_id, p_match_review_id,
    p_expected_review_version, p_review_action, null, p_actor_user_id,
    p_expected_request_version, p_identity_kind, p_candidate_student_id,
    p_expected_contact_version, p_expected_case_version, p_expected_candidate_version,
    p_display_name_evidence, p_birth_date_evidence, p_birth_year_evidence,
    p_expected_normalization_version, p_expected_match_policy_version,
    p_expected_minimum_evidence_policy_version, p_expected_policy_registry_version,
    p_expected_adapter_version, p_action_id, p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_decide_match_review$;

create function public.f23_3e_p2c_supersede_match_review(
  p_conversion_request_id uuid,
  p_match_review_id uuid,
  p_expected_review_version integer,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_supersede_match_review$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.supersede_match_review', p_conversion_request_id, p_match_review_id,
    p_expected_review_version, null, null, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_supersede_match_review$;

create function public.f23_3e_p2c_expire_match_review(
  p_conversion_request_id uuid,
  p_match_review_id uuid,
  p_expected_review_version integer,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_expire_match_review$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.expire_match_review', p_conversion_request_id, p_match_review_id,
    p_expected_review_version, null, null, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_expire_match_review$;

create function public.f23_3e_p2c_reserve_create_target(
  p_conversion_request_id uuid,
  p_match_review_id uuid,
  p_expected_review_version integer,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_reserve_create_target$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.reserve_create_target', p_conversion_request_id, p_match_review_id,
    p_expected_review_version, null, null, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_reserve_create_target$;

create function public.f23_3e_p2c_cancel_creation_reservation(
  p_conversion_request_id uuid,
  p_reservation_id uuid,
  p_expected_reservation_version integer,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_cancel_creation_reservation$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.cancel_creation_reservation', p_conversion_request_id, p_reservation_id,
    p_expected_reservation_version, null, null, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_cancel_creation_reservation$;

create function public.f23_3e_p2c_expire_creation_reservation(
  p_conversion_request_id uuid,
  p_reservation_id uuid,
  p_expected_reservation_version integer,
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
  p_action_id uuid,
  p_idempotency_key_digest bytea
)
returns jsonb
language sql
security definer
set search_path = ''
as $f23_3e_p2c_expire_creation_reservation$
  select public.f23_3e_p2c_internal_execute_mutation(
    'crm.identity.expire_creation_reservation', p_conversion_request_id, p_reservation_id,
    p_expected_reservation_version, null, null, p_actor_user_id, p_expected_request_version,
    p_identity_kind, p_candidate_student_id, p_expected_contact_version,
    p_expected_case_version, p_expected_candidate_version, p_display_name_evidence,
    p_birth_date_evidence, p_birth_year_evidence, p_expected_normalization_version,
    p_expected_match_policy_version, p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version, p_expected_adapter_version, p_action_id,
    p_idempotency_key_digest, null, null
  )
$f23_3e_p2c_expire_creation_reservation$;

create function public.f23_3e_p2c_read_creation_reservation_status(
  p_conversion_request_id uuid,
  p_reservation_id uuid,
  p_expected_reservation_version integer,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f23_3e_p2c_read_creation_reservation_status$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_role text;
  v_current_code text;
begin
  if p_conversion_request_id is null or p_reservation_id is null
     or p_expected_reservation_version is null or p_expected_reservation_version < 1
     or p_actor_user_id is null then
    return public.f23_3e_p2c_internal_safe_result('INVALID_INPUT');
  end if;

  select r.center_id into v_center_id
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for share;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return public.f23_3e_p2c_internal_safe_result('CRM_RUNTIME_NOT_ACTIVE');
  end if;
  select pg_catalog.lower(m.role) into v_role
  from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id and m.status = 'active'
  order by m.id limit 1 for share;
  if not found or v_role not in ('owner', 'center_admin', 'consultant') then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  select r.* into v_request
  from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id
  for share;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_role = 'consultant' and not exists (
    select 1 from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = v_request.consultation_case_id
      and a.assignment_id = v_request.source_assignment_id
      and a.assigned_consultant_user_id = p_actor_user_id
      and a.assignment_status = 'ACTIVE'
  ) then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;

  select mr.* into v_review
  from public.crm_profile_creation_reservation pr
  join public.crm_identity_match_review mr
    on mr.center_id = pr.center_id and mr.match_review_id = pr.match_review_id
  where pr.center_id = v_center_id
    and pr.reservation_id = p_reservation_id
    and pr.conversion_request_id = p_conversion_request_id
  for share of mr;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  select r.* into v_reservation
  from public.crm_profile_creation_reservation r
  where r.center_id = v_center_id
    and r.reservation_id = p_reservation_id
    and r.conversion_request_id = p_conversion_request_id
  for share;
  if not found then
    return public.f23_3e_p2c_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  if v_reservation.reservation_version <> p_expected_reservation_version then
    return public.f23_3e_p2c_internal_safe_result('RESERVATION_CONFLICT');
  end if;

  v_current_code := v_reservation.status;
  if v_reservation.status = 'ACTIVE' and pg_catalog.transaction_timestamp() >= v_reservation.expires_at then
    v_current_code := 'RESERVATION_EXPIRED';
  elsif v_reservation.status = 'ACTIVE' and (
    v_request.request_version <> v_reservation.request_version
    or v_request.action_graph_digest is distinct from v_reservation.request_action_graph_digest
    or v_request.source_contact_version <> v_review.source_contact_version
    or v_request.source_case_version <> v_review.source_case_version
    or v_review.review_status <> 'CREATE_NEW_REVIEWED'
    or pg_catalog.transaction_timestamp() >= v_review.expires_at
    or not exists (
      select 1 from public.crm_contact c
      where c.center_id = v_reservation.center_id
        and c.crm_contact_id = v_review.crm_contact_id
        and c.contact_version = v_review.source_contact_version
    )
    or not exists (
      select 1 from public.consultation_case c
      where c.center_id = v_reservation.center_id
        and c.consultation_case_id = v_review.consultation_case_id
        and c.case_version = v_review.source_case_version
    )
    or not exists (
      select 1 from public.consultation_case_candidate_student s
      where s.center_id = v_reservation.center_id
        and s.consultation_case_id = v_review.consultation_case_id
        and s.candidate_student_id = v_review.candidate_student_id
        and s.candidate_version = v_review.source_candidate_version
    )
    or not exists (
      select 1 from public.consultation_case_assignment a
      where a.center_id = v_reservation.center_id
        and a.consultation_case_id = v_review.consultation_case_id
        and a.assignment_id = v_request.source_assignment_id
        and a.assignment_version = v_request.source_assignment_version
        and a.assignment_status = 'ACTIVE'
    )
    or not exists (
      select 1 from public.crm_identity_policy_registry p
      where p.center_id = v_reservation.center_id
        and p.identity_kind = v_reservation.entity_kind
        and p.identity_policy_registry_id = v_reservation.identity_policy_registry_id
        and p.normalization_version = v_reservation.normalization_version
        and p.match_policy_version = v_reservation.match_policy_version
        and p.minimum_evidence_policy_version = v_reservation.minimum_evidence_policy_version
        and p.status = 'CURRENT'
    )
  ) then
    v_current_code := 'RESERVATION_STALE';
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'CREATION_RESERVATION_STATUS',
    'reservation_id', v_reservation.reservation_id,
    'opaque_target_id', v_reservation.preallocated_target_id,
    'status', v_reservation.status,
    'reservation_version', v_reservation.reservation_version,
    'expires_at', v_reservation.expires_at,
    'entity_kind', v_reservation.entity_kind,
    'current_code', v_current_code,
    'profile_created', false,
    'profile_reused', false,
    'conversion_approved', false,
    'request_completed', false
  );
end;
$f23_3e_p2c_read_creation_reservation_status$;

-- Internal helpers are deliberately not a service surface.
revoke all on function public.f23_3e_p2c_internal_guard_idempotency_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2c_internal_safe_result(text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2c_internal_binding_digest(bytea,text,jsonb,bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2c_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2c_internal_execute_mutation(text,uuid,uuid,integer,text,uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea,uuid,integer)
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p2c_create_match_review(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea,uuid,integer,uuid)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_decide_match_review(uuid,uuid,integer,text,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_supersede_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_expire_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_reserve_create_target(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_cancel_creation_reservation(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_expire_creation_reservation(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p2c_read_creation_reservation_status(uuid,uuid,integer,uuid)
  from public, anon, authenticated;

grant execute on function public.f23_3e_p2c_create_match_review(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea,uuid,integer,uuid)
  to service_role;
grant execute on function public.f23_3e_p2c_decide_match_review(uuid,uuid,integer,text,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_supersede_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_expire_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_reserve_create_target(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_cancel_creation_reservation(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_expire_creation_reservation(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)
  to service_role;
grant execute on function public.f23_3e_p2c_read_creation_reservation_status(uuid,uuid,integer,uuid)
  to service_role;

comment on function public.f23_3e_p2c_create_match_review(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea,uuid,integer,uuid) is
  'P2C protected review creation; PENDING evidence only, never profile authority.';
comment on function public.f23_3e_p2c_reserve_create_target(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea) is
  'P2C protected ACTIVE intent reservation with a server-preallocated opaque target; no profile write or CONSUMED transition.';

commit;
