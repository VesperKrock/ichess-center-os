begin;

-- F23.3E-P3D owns no business table. It forward-opens only executor-owned
-- lifecycle edges and composes the final-audited P1/P2/P3 aggregates.
do $f23_3e_p3d_prerequisites$
begin
  if pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_create_student_target(uuid,uuid,text,date)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3b_internal_action_set_digest(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_crypto_environment_fingerprint()') is null
     or pg_catalog.to_regclass('public.crm_conversion_authority') is null then
    raise exception 'f23_3e_p3d_checkpoint_prerequisite_missing';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p3d_%'
  ) then
    raise exception 'f23_3e_p3d_runtime_already_exists';
  end if;
end;
$f23_3e_p3d_prerequisites$;

-- REQUEST APPROVED -> EXECUTING -> COMPLETED is P3D-owned and occurs in one
-- transaction. Every historical P1/P3B path remains unchanged.
create or replace function public.f23_3e_p1a_guard_request_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_request_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' or new.request_version <> 1 then
      raise exception 'f23_3e_p1a_request_must_start_draft_at_version_one';
    end if;
    return new;
  end if;
  if old.status in ('COMPLETED', 'CONFLICT', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'COMPENSATION_REQUIRED') then
    raise exception 'f23_3e_p1a_terminal_request_cannot_return_to_draft';
  end if;
  if old.status = 'READY_FOR_REVIEW' and new.status = 'APPROVED'
     and pg_catalog.current_setting('ichess.p3b_authority_issue', true) = 'on'
     and new.request_version = old.request_version + 1 then
    return new;
  end if;
  if old.status = 'APPROVED' and new.status = 'EXECUTING'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'
     and new.request_version = old.request_version + 1
     and new.terminal_outcome_digest is null then
    return new;
  end if;
  if old.status = 'APPROVED' and new.status = 'SUPERSEDED'
     and pg_catalog.current_setting('ichess.p3d_plan_invalidation', true) = 'on'
     and new.request_version = old.request_version + 1
     and new.terminal_outcome_digest is null then
    return new;
  end if;
  if old.status = 'EXECUTING' and new.status = 'COMPLETED'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'
     and new.request_version = old.request_version + 1
     and new.terminal_outcome_digest is not null then
    return new;
  end if;
  if new.status in ('APPROVED', 'EXECUTING', 'COMPLETED', 'CONFLICT', 'COMPENSATION_REQUIRED') then
    raise exception 'f23_3e_p1a_request_status_reserved_for_future_protected_runtime';
  end if;
  if not (
    (old.status = 'DRAFT' and new.status in ('DRAFT', 'READY_FOR_REVIEW', 'CANCELLED', 'SUPERSEDED'))
    or (old.status = 'READY_FOR_REVIEW' and new.status in ('DRAFT', 'REJECTED', 'CANCELLED', 'SUPERSEDED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_request_transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$f23_3e_p1a_guard_request_lifecycle$;

create or replace function public.f23_3e_p1a_guard_case_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_case_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' or new.conversion_state <> 'NOT_STARTED' or new.case_version <> 1 then
      raise exception 'f23_3e_p1a_case_must_start_open_not_started_at_version_one';
    end if;
    return new;
  end if;
  if old.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
    raise exception 'f23_3e_p1a_terminal_case_is_immutable_without_future_protected_flow';
  end if;
  if old.status = 'READY_FOR_CONVERSION' and old.conversion_state = 'REVIEW_PENDING'
     and new.status = 'CONVERTED' and new.conversion_state = 'COMPLETED'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'
     and new.case_version = old.case_version + 1
     and new.active_assignment_id is null and new.closed_at is not null then
    return new;
  end if;
  if new.status = 'CONVERTED' then
    raise exception 'f23_3e_p1a_case_converted_reserved_for_future_executor';
  end if;
  if new.status <> old.status and not (
    (old.status = 'OPEN' and new.status in ('CONSULTING', 'PAUSED', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'CONSULTING' and new.status in ('PAUSED', 'READY_FOR_CONVERSION', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'PAUSED' and new.status in ('CONSULTING', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'READY_FOR_CONVERSION' and new.status in ('CONSULTING', 'LOST', 'CANCELLED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_case_transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$f23_3e_p1a_guard_case_lifecycle$;

create or replace function public.f23_3e_p1a_guard_candidate_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_candidate_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.candidate_status <> 'DRAFT' or new.candidate_version <> 1 then
      raise exception 'f23_3e_p1a_candidate_must_start_draft_at_version_one';
    end if;
    return new;
  end if;
  if old.candidate_status in ('CONVERTED', 'DISCARDED') then
    raise exception 'f23_3e_p1a_terminal_candidate_is_immutable';
  end if;
  if old.candidate_status in ('ACTIVE', 'REVIEW_REQUIRED')
     and new.candidate_status = 'CONVERTED'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'
     and new.candidate_version = old.candidate_version + 1 then
    return new;
  end if;
  if new.candidate_status = 'CONVERTED' then
    raise exception 'f23_3e_p1a_candidate_converted_reserved_for_future_executor';
  end if;
  if new.candidate_status <> old.candidate_status and not (
    (old.candidate_status = 'DRAFT' and new.candidate_status in ('ACTIVE', 'REVIEW_REQUIRED', 'DISCARDED'))
    or (old.candidate_status = 'ACTIVE' and new.candidate_status in ('REVIEW_REQUIRED', 'DISCARDED'))
    or (old.candidate_status = 'REVIEW_REQUIRED' and new.candidate_status in ('ACTIVE', 'DISCARDED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_candidate_transition: % -> %', old.candidate_status, new.candidate_status;
  end if;
  return new;
end;
$f23_3e_p1a_guard_candidate_lifecycle$;

create or replace function public.f23_3e_p3b_internal_guard_conversion_action()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_conversion_action$
declare
  v_legacy bytea;
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3b_conversion_action_delete_forbidden'; end if;
  select r.action_graph_digest into v_legacy
  from public.crm_conversion_request r
  where r.center_id = new.center_id and r.conversion_request_id = new.conversion_request_id;
  if not found or v_legacy is distinct from new.legacy_request_action_graph_digest then
    raise exception 'f23_3e_p3b_action_legacy_request_binding_mismatch';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'PROPOSED' or new.action_version <> 1 then
      raise exception 'f23_3e_p3b_action_must_start_proposed_at_version_one';
    end if;
    return new;
  end if;
  if new.conversion_action_id is distinct from old.conversion_action_id
     or new.center_id is distinct from old.center_id
     or new.conversion_request_id is distinct from old.conversion_request_id
     or new.legacy_request_action_graph_digest is distinct from old.legacy_request_action_graph_digest
     or new.action_kind is distinct from old.action_kind
     or new.action_intent_digest is distinct from old.action_intent_digest
     or new.identity_kind is distinct from old.identity_kind
     or new.source_contact_id is distinct from old.source_contact_id
     or new.source_candidate_student_id is distinct from old.source_candidate_student_id
     or new.match_review_id is distinct from old.match_review_id
     or new.profile_creation_reservation_id is distinct from old.profile_creation_reservation_id
     or new.target_adapter_namespace is distinct from old.target_adapter_namespace
     or new.opaque_target_id is distinct from old.opaque_target_id
     or new.expected_target_version is distinct from old.expected_target_version
     or new.student_target_id is distinct from old.student_target_id
     or new.guardian_target_id is distinct from old.guardian_target_id
     or new.guardian_action_id is distinct from old.guardian_action_id
     or new.student_action_id is distinct from old.student_action_id
     or new.guardian_student_relationship_id is distinct from old.guardian_student_relationship_id
     or new.expected_relationship_version is distinct from old.expected_relationship_version
     or new.relationship_type is distinct from old.relationship_type
     or new.is_primary_contact is distinct from old.is_primary_contact
     or new.financial_contact_role is distinct from old.financial_contact_role
     or new.academic_contact_role is distinct from old.academic_contact_role
     or new.safe_reason_code is distinct from old.safe_reason_code
     or new.relationship_policy_version is distinct from old.relationship_policy_version
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p3b_action_binding_is_immutable';
  end if;
  if new.action_version <> old.action_version + 1 then
    raise exception 'f23_3e_p3b_action_transition_requires_exact_version_increment';
  end if;
  if old.status = 'PROPOSED' and new.status in ('REVIEWED', 'SUPERSEDED') then return new; end if;
  if old.status = 'REVIEWED' and new.status = 'SUPERSEDED' then return new; end if;
  if old.status = 'REVIEWED' and new.status = 'APPROVED'
     and pg_catalog.current_setting('ichess.p3b_authority_issue', true) = 'on' then return new; end if;
  if old.status = 'APPROVED' and new.status = 'EXECUTED'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on' then return new; end if;
  raise exception 'f23_3e_p3b_invalid_or_unowned_action_transition: % -> %', old.status, new.status;
end;
$f23_3e_p3b_internal_guard_conversion_action$;

create or replace function public.f23_3e_p3b_internal_guard_conversion_authority()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_conversion_authority$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3b_conversion_authority_delete_forbidden'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'ISSUED' or new.authority_version <> 1 then
      raise exception 'f23_3e_p3b_authority_must_start_issued_at_version_one';
    end if;
    return new;
  end if;
  if pg_catalog.current_setting('ichess.p3d_r0_authority_binding', true) = 'on'
     and old.status = 'ISSUED' and new.status = 'ISSUED'
     and old.authority_version = 1 and new.authority_version = 1
     and old.p3_action_set_encoding_version = 1 and new.p3_action_set_encoding_version = 2
     and new.p3_reuse_authorization_set_encoding_version = 1
     and pg_catalog.octet_length(new.p3_reuse_authorization_set_digest) = 32
     and new.expires_at <= old.expires_at
     and new.expires_at > pg_catalog.transaction_timestamp()
     and (pg_catalog.to_jsonb(new)
          - 'p3_action_set_encoding_version' - 'p3_action_set_digest'
          - 'p3_reuse_authorization_set_encoding_version' - 'p3_reuse_authorization_set_digest'
          - 'expires_at' - 'updated_at')
       is not distinct from
         (pg_catalog.to_jsonb(old)
          - 'p3_action_set_encoding_version' - 'p3_action_set_digest'
          - 'p3_reuse_authorization_set_encoding_version' - 'p3_reuse_authorization_set_digest'
          - 'expires_at' - 'updated_at') then
    return new;
  end if;
  if new.conversion_authority_id is distinct from old.conversion_authority_id
     or new.environment_fingerprint is distinct from old.environment_fingerprint
     or new.center_id is distinct from old.center_id
     or new.actor_user_id is distinct from old.actor_user_id
     or new.membership_id is distinct from old.membership_id
     or new.membership_version is distinct from old.membership_version
     or new.conversion_request_id is distinct from old.conversion_request_id
     or new.approved_request_version is distinct from old.approved_request_version
     or new.consultation_case_id is distinct from old.consultation_case_id
     or new.case_version is distinct from old.case_version
     or new.source_contact_id is distinct from old.source_contact_id
     or new.contact_version is distinct from old.contact_version
     or new.assignment_id is distinct from old.assignment_id
     or new.assignment_version is distinct from old.assignment_version
     or new.conversion_intent_digest is distinct from old.conversion_intent_digest
     or new.legacy_request_action_graph_digest is distinct from old.legacy_request_action_graph_digest
     or new.p3_action_set_encoding_version is distinct from old.p3_action_set_encoding_version
     or new.p3_action_set_digest is distinct from old.p3_action_set_digest
     or new.review_set_digest is distinct from old.review_set_digest
     or new.reservation_set_digest is distinct from old.reservation_set_digest
     or new.target_set_digest is distinct from old.target_set_digest
     or new.step_up_assertion_id is distinct from old.step_up_assertion_id
     or new.step_up_assertion_version is distinct from old.step_up_assertion_version
     or new.account_security_version is distinct from old.account_security_version
     or new.account_session_version is distinct from old.account_session_version
     or new.assurance_policy_version is distinct from old.assurance_policy_version
     or new.identity_policy_version is distinct from old.identity_policy_version
     or new.conversion_policy_version is distinct from old.conversion_policy_version
     or new.relationship_policy_version is distinct from old.relationship_policy_version
     or new.student_profile_policy_version is distinct from old.student_profile_policy_version
     or new.purpose is distinct from old.purpose
     or new.issued_at is distinct from old.issued_at
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p3b_authority_binding_is_immutable';
  end if;
  if new.authority_version <> old.authority_version + 1 then
    raise exception 'f23_3e_p3b_invalid_or_unowned_authority_transition';
  end if;
  if old.status = 'ISSUED' and new.status in ('EXPIRED', 'REVOKED', 'SUPERSEDED') then return new; end if;
  if old.status = 'ISSUED' and new.status = 'CONSUMED'
     and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'
     and new.consumed_idempotency_record_id is not null
     and new.terminal_reason_code = 'conversion_completed' then return new; end if;
  raise exception 'f23_3e_p3b_invalid_or_unowned_authority_transition';
end;
$f23_3e_p3b_internal_guard_conversion_authority$;

-- P2A's immutable reservation binding remains unchanged. P3D opens only the
-- executor-owned ACTIVE -> CONSUMED edge after Request approval and EXECUTING.
create or replace function public.f23_3e_p2a_internal_guard_profile_creation_reservation()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2a_internal_guard_profile_creation_reservation$
declare
  v_review public.crm_identity_match_review%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_policy_status text;
  v_prior public.crm_profile_creation_reservation%rowtype;
  v_p3d_consume boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'ACTIVE' or new.reservation_version <> 1
       or new.terminal_at is not null or new.terminal_reason_code is not null then
      raise exception 'f23_3e_p2a_reservation_must_start_active_at_version_one';
    end if;
    new.created_at := pg_catalog.transaction_timestamp();
    new.updated_at := new.created_at;
    if new.expires_at <= new.created_at then
      raise exception 'f23_3e_p2a_reservation_expiry_must_be_future_server_time';
    end if;
    if new.supersedes_reservation_id is not null then
      select r.* into v_prior from public.crm_profile_creation_reservation r
      where r.center_id = new.center_id and r.reservation_id = new.supersedes_reservation_id;
      if not found or v_prior.status = 'ACTIVE' or v_prior.entity_kind <> new.entity_kind
         or v_prior.conversion_request_id <> new.conversion_request_id
         or v_prior.action_id <> new.action_id
         or v_prior.action_intent_digest is distinct from new.action_intent_digest then
        raise exception 'f23_3e_p2a_invalid_reservation_supersession_binding';
      end if;
    end if;
  else
    if new.reservation_id is distinct from old.reservation_id
       or new.center_id is distinct from old.center_id
       or new.entity_kind is distinct from old.entity_kind
       or new.conversion_request_id is distinct from old.conversion_request_id
       or new.request_version is distinct from old.request_version
       or new.action_id is distinct from old.action_id
       or new.action_intent_digest is distinct from old.action_intent_digest
       or new.request_action_graph_digest is distinct from old.request_action_graph_digest
       or new.match_review_id is distinct from old.match_review_id
       or new.preallocated_target_id is distinct from old.preallocated_target_id
       or new.target_adapter_namespace is distinct from old.target_adapter_namespace
       or new.identity_mutex_keys_digest is distinct from old.identity_mutex_keys_digest
       or new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
       or new.normalization_version is distinct from old.normalization_version
       or new.match_policy_version is distinct from old.match_policy_version
       or new.minimum_evidence_policy_version is distinct from old.minimum_evidence_policy_version
       or new.source_evidence_digest is distinct from old.source_evidence_digest
       or new.source_versions_digest is distinct from old.source_versions_digest
       or new.projection_snapshot_digest is distinct from old.projection_snapshot_digest
       or new.expires_at is distinct from old.expires_at
       or new.created_by_user_id is distinct from old.created_by_user_id
       or new.created_at is distinct from old.created_at
       or new.supersedes_reservation_id is distinct from old.supersedes_reservation_id then
      raise exception 'f23_3e_p2a_reservation_binding_is_immutable';
    end if;
    if old.status <> 'ACTIVE' then raise exception 'f23_3e_p2a_terminal_reservation_is_immutable'; end if;
    if new.status not in ('CONSUMED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED') then
      raise exception 'f23_3e_p2a_invalid_reservation_transition: % -> %', old.status, new.status;
    end if;
    if new.reservation_version <> old.reservation_version + 1 then
      raise exception 'f23_3e_p2a_reservation_version_must_increment_by_one';
    end if;
    if pg_catalog.transaction_timestamp() >= old.expires_at and new.status <> 'EXPIRED' then
      raise exception 'f23_3e_p2a_expired_reservation_cannot_be_consumed_or_reused';
    end if;
    if new.status = 'EXPIRED' and pg_catalog.transaction_timestamp() < old.expires_at then
      raise exception 'f23_3e_p2a_reservation_cannot_expire_before_server_time';
    end if;
    v_p3d_consume := new.status = 'CONSUMED'
      and pg_catalog.current_setting('ichess.p3d_executor', true) = 'on';
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.transaction_timestamp();
    new.terminal_at := new.updated_at;
    new.terminal_reason_code := case new.status
      when 'CONSUMED' then 'CONSUMED_BY_FUTURE_EXECUTOR'
      when 'EXPIRED' then 'SERVER_TIME_EXPIRED'
      when 'CANCELLED' then 'REQUEST_CANCELLED'
      when 'SUPERSEDED' then 'SOURCE_OR_POLICY_SUPERSEDED'
    end;
  end if;

  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = new.center_id and r.match_review_id = new.match_review_id;
  if not found or v_review.review_status <> 'CREATE_NEW_REVIEWED'
     or v_review.match_outcome <> 'NO_MATCH' or v_review.review_action <> 'PREPARE_CREATE_NEW'
     or v_review.conversion_request_id <> new.conversion_request_id
     or v_review.request_version <> new.request_version or v_review.action_id <> new.action_id
     or v_review.action_intent_digest is distinct from new.action_intent_digest
     or v_review.request_action_graph_digest is distinct from new.request_action_graph_digest
     or v_review.identity_kind <> new.entity_kind
     or v_review.identity_mutex_keys_digest is distinct from new.identity_mutex_keys_digest
     or v_review.identity_policy_registry_id <> new.identity_policy_registry_id
     or v_review.normalization_version <> new.normalization_version
     or v_review.match_policy_version <> new.match_policy_version
     or v_review.minimum_evidence_policy_version <> new.minimum_evidence_policy_version
     or v_review.evidence_set_digest is distinct from new.source_evidence_digest
     or v_review.projection_snapshot_digest is distinct from new.projection_snapshot_digest
     or v_review.expires_at < new.expires_at then
    raise exception 'f23_3e_p2a_reservation_review_binding_is_not_current_create_new';
  end if;

  if tg_op = 'INSERT' or new.status = 'CONSUMED' then
    select r.* into v_request from public.crm_conversion_request r
    where r.center_id = new.center_id and r.conversion_request_id = new.conversion_request_id;
    if not found or v_request.action_graph_digest is distinct from new.request_action_graph_digest
       or (
         not v_p3d_consume and v_request.request_version <> new.request_version
       ) or (
         v_p3d_consume and (
           v_request.status <> 'EXECUTING' or v_request.request_version <> new.request_version + 2
         )
       ) then
      raise exception 'f23_3e_p2a_reservation_request_action_binding_stale';
    end if;
    select p.status into v_policy_status from public.crm_identity_policy_registry p
    where p.center_id = new.center_id and p.identity_kind = new.entity_kind
      and p.identity_policy_registry_id = new.identity_policy_registry_id
      and p.normalization_version = new.normalization_version
      and p.match_policy_version = new.match_policy_version
      and p.minimum_evidence_policy_version = new.minimum_evidence_policy_version;
    if not found or v_policy_status <> 'CURRENT' then
      raise exception 'f23_3e_p2a_reservation_policy_is_not_current';
    end if;
  end if;
  return new;
end;
$f23_3e_p2a_internal_guard_profile_creation_reservation$;

-- Completed REAL_CONVERSION lookup is unique for the frozen result-status
-- signature, independently of future migration inventory.
create unique index crm_idempotency_registry_p3d_result_lookup_uidx
  on public.crm_idempotency_registry(resource_scope_id, idempotency_key_digest)
  where operation = 'crm.real_conversion.execute';

-- Preserve the exact final P3C result validator behind a private checkpoint
-- name, then add only the strict REAL_CONVERSION result shape.
alter table public.crm_idempotency_registry
  drop constraint crm_idempotency_registry_p3_safe_snapshot_check;

alter function public.f23_3e_p3b_internal_is_safe_result_snapshot(jsonb)
  rename to f23_3e_p3d_internal_checkpoint_is_safe_result_snapshot;

create function public.f23_3e_p3b_internal_is_safe_result_snapshot(p_snapshot jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $f23_3e_p3b_internal_is_safe_result_snapshot$
declare
  v_item jsonb;
  v_key text;
  v_kind text;
  v_outcome text;
  v_target_id jsonb;
  v_target_version jsonb;
  v_student_count integer := 0;
  v_guardian_count integer := 0;
  v_relationship_count integer := 0;
begin
  if p_snapshot ->> 'result_type' in ('ACTION_PLAN_MATERIALIZATION','ACTION_PLAN_FINALIZATION')
     and p_snapshot ->> 'action_set_encoding_version' = '2' then
    return p_snapshot ->> 'action_set_digest' ~ '^[0-9a-f]{64}$'
      and public.f23_3e_p3d_internal_checkpoint_is_safe_result_snapshot(
        pg_catalog.jsonb_set(p_snapshot,'{action_set_encoding_version}','1'::jsonb,true));
  end if;
  if p_snapshot ->> 'result_type' = 'CONVERSION_AUTHORITY'
     and p_snapshot ?& array['request_status','invalidated_authorization_count',
       'superseded_action_count','terminalized_reservation_count'] then
    return public.f23_3e_p3d_internal_checkpoint_is_safe_result_snapshot(
        p_snapshot - 'request_status' - 'invalidated_authorization_count'
          - 'superseded_action_count' - 'terminalized_reservation_count')
      and p_snapshot ->> 'request_status' = 'SUPERSEDED'
      and p_snapshot ->> 'invalidated_authorization_count' ~ '^[0-2]$'
      and p_snapshot ->> 'superseded_action_count' = '3'
      and p_snapshot ->> 'terminalized_reservation_count' ~ '^[0-2]$';
  end if;
  if p_snapshot ->> 'result_type' <> 'REAL_CONVERSION' then
    return public.f23_3e_p3d_internal_checkpoint_is_safe_result_snapshot(p_snapshot);
  end if;
  if pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then return false; end if;
  for v_key in select e.key from pg_catalog.jsonb_each(p_snapshot) e loop
    if v_key not in (
      'result_schema_version', 'result_type', 'resource_id', 'resource_version',
      'resource_status', 'request_id', 'request_version', 'consultation_case_id',
      'case_version', 'conversion_authority_id', 'authority_status',
      'authority_version', 'executed_action_results', 'correlation_id', 'outcome_code'
    ) then return false; end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_snapshot)) <> 15
     or p_snapshot ->> 'result_schema_version' <> '1'
     or p_snapshot ->> 'resource_status' <> 'COMPLETED'
     or p_snapshot ->> 'authority_status' <> 'CONSUMED'
     or p_snapshot ->> 'outcome_code' <> 'REAL_CONVERSION_COMPLETED'
     or p_snapshot ->> 'resource_id' <> p_snapshot ->> 'request_id'
     or p_snapshot ->> 'resource_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_snapshot ->> 'consultation_case_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_snapshot ->> 'conversion_authority_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_snapshot ->> 'correlation_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_snapshot ->> 'resource_version' !~ '^[1-9][0-9]*$'
     or p_snapshot ->> 'request_version' <> p_snapshot ->> 'resource_version'
     or p_snapshot ->> 'case_version' !~ '^[1-9][0-9]*$'
     or p_snapshot ->> 'authority_version' !~ '^[1-9][0-9]*$'
     or pg_catalog.jsonb_typeof(p_snapshot -> 'executed_action_results') <> 'array'
     or pg_catalog.jsonb_array_length(p_snapshot -> 'executed_action_results') <> 3 then
    return false;
  end if;
  for v_item in select e.value from pg_catalog.jsonb_array_elements(p_snapshot -> 'executed_action_results') e loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_item)) <> 6 then return false; end if;
    for v_key in select e.key from pg_catalog.jsonb_each(v_item) e loop
      if v_key not in ('action_id','action_kind','action_version','outcome_code','target_id','target_version') then return false; end if;
    end loop;
    v_kind := v_item ->> 'action_kind';
    v_outcome := v_item ->> 'outcome_code';
    v_target_id := v_item -> 'target_id';
    v_target_version := v_item -> 'target_version';
    if v_item ->> 'action_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or v_item ->> 'action_version' !~ '^[1-9][0-9]*$'
       or v_kind not in (
         'CREATE_NEW_STUDENT','REUSE_REVIEWED_STUDENT','DO_NOT_CREATE_STUDENT',
         'CREATE_NEW_GUARDIAN','REUSE_REVIEWED_GUARDIAN','DO_NOT_CREATE_GUARDIAN',
         'CREATE_RELATIONSHIP','REUSE_EXISTING_RELATIONSHIP',
         'UPDATE_APPROVED_RELATIONSHIP_ROLE','DO_NOT_CREATE_RELATIONSHIP'
       ) or v_outcome not in (
         'STUDENT_CREATED','STUDENT_REUSED','STUDENT_NOT_CREATED',
         'GUARDIAN_CREATED','GUARDIAN_REUSED','GUARDIAN_NOT_CREATED',
         'RELATIONSHIP_CREATED','RELATIONSHIP_REUSED','RELATIONSHIP_UPDATED',
         'RELATIONSHIP_NOT_CREATED'
       ) then return false;
    end if;
    if v_kind like '%STUDENT' then v_student_count := v_student_count + 1;
    elsif v_kind like '%GUARDIAN' then v_guardian_count := v_guardian_count + 1;
    else v_relationship_count := v_relationship_count + 1;
    end if;
    if v_kind like 'DO_NOT_%' then
      if pg_catalog.jsonb_typeof(v_target_id) <> 'null' or pg_catalog.jsonb_typeof(v_target_version) <> 'null' then return false; end if;
    elsif pg_catalog.jsonb_typeof(v_target_id) <> 'string'
       or v_item ->> 'target_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.jsonb_typeof(v_target_version) <> 'number'
       or v_item ->> 'target_version' !~ '^[1-9][0-9]*$' then return false;
    end if;
    if (v_kind = 'CREATE_NEW_STUDENT' and v_outcome <> 'STUDENT_CREATED')
       or (v_kind = 'REUSE_REVIEWED_STUDENT' and v_outcome <> 'STUDENT_REUSED')
       or (v_kind = 'DO_NOT_CREATE_STUDENT' and v_outcome <> 'STUDENT_NOT_CREATED')
       or (v_kind = 'CREATE_NEW_GUARDIAN' and v_outcome <> 'GUARDIAN_CREATED')
       or (v_kind = 'REUSE_REVIEWED_GUARDIAN' and v_outcome <> 'GUARDIAN_REUSED')
       or (v_kind = 'DO_NOT_CREATE_GUARDIAN' and v_outcome <> 'GUARDIAN_NOT_CREATED')
       or (v_kind = 'CREATE_RELATIONSHIP' and v_outcome <> 'RELATIONSHIP_CREATED')
       or (v_kind = 'REUSE_EXISTING_RELATIONSHIP' and v_outcome <> 'RELATIONSHIP_REUSED')
       or (v_kind = 'UPDATE_APPROVED_RELATIONSHIP_ROLE' and v_outcome <> 'RELATIONSHIP_UPDATED')
       or (v_kind = 'DO_NOT_CREATE_RELATIONSHIP' and v_outcome <> 'RELATIONSHIP_NOT_CREATED') then
      return false;
    end if;
  end loop;
  return v_student_count = 1 and v_guardian_count = 1 and v_relationship_count = 1;
end;
$f23_3e_p3b_internal_is_safe_result_snapshot$;

alter table public.crm_idempotency_registry
  add constraint crm_idempotency_registry_p3_safe_snapshot_check
  check (p3_result_snapshot is null or public.f23_3e_p3b_internal_is_safe_result_snapshot(p3_result_snapshot));

-- P3D0 birth-evidence bridge. These functions reuse the P3C crypto root but
-- deliberately use distinct source/target magic, KDF context, and AAD.
create function public.f23_3e_p3d_internal_candidate_birth_aad(
  p_center_id text,
  p_consultation_case_id uuid,
  p_candidate_student_id uuid,
  p_key_epoch integer
)
returns bytea
language sql stable strict set search_path = ''
as $f23_3e_p3d_internal_candidate_birth_aad$
  select
    public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to('ichess.crm.candidate.birth-evidence.aead.v1', 'UTF8'))
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(public.f23_3e_p3c_internal_crypto_environment_fingerprint())
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_center_id, 'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_consultation_case_id))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_candidate_student_id))
$f23_3e_p3d_internal_candidate_birth_aad$;

create function public.f23_3e_p3d_internal_student_birth_aad(
  p_center_id text,
  p_student_id uuid,
  p_key_epoch integer
)
returns bytea
language sql stable strict set search_path = ''
as $f23_3e_p3d_internal_student_birth_aad$
  select
    public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to('ichess.student.target.birth-evidence.aead.v1', 'UTF8'))
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(public.f23_3e_p3c_internal_crypto_environment_fingerprint())
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_center_id, 'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_student_id))
$f23_3e_p3d_internal_student_birth_aad$;

create function public.f23_3e_p3d_internal_parse_birth_envelope(
  p_envelope bytea,
  p_magic text
)
returns table(key_epoch integer, nonce bytea, sealed bytea)
language plpgsql immutable strict set search_path = ''
as $f23_3e_p3d_internal_parse_birth_envelope$
declare
  v_epoch bigint;
  v_nonce_length integer;
  v_sealed_length bigint;
begin
  if p_magic not in ('IC3CBE01', 'IC3SBE01')
     or pg_catalog.octet_length(pg_catalog.convert_to(p_magic, 'UTF8')) <> 8
     or pg_catalog.octet_length(p_envelope) < 68
     or pg_catalog.substr(p_envelope, 1, 8) <> pg_catalog.convert_to(p_magic, 'UTF8')
     or pg_catalog.get_byte(p_envelope, 8) <> 1
     or pg_catalog.get_byte(p_envelope, 9) <> 1 then
    raise exception 'BIRTH_EVIDENCE_ENVELOPE_UNAVAILABLE';
  end if;
  v_epoch := (pg_catalog.get_byte(p_envelope,10)::bigint << 24)
    + (pg_catalog.get_byte(p_envelope,11)::bigint << 16)
    + (pg_catalog.get_byte(p_envelope,12)::bigint << 8)
    + pg_catalog.get_byte(p_envelope,13)::bigint;
  v_nonce_length := (pg_catalog.get_byte(p_envelope,14) << 8)
    + pg_catalog.get_byte(p_envelope,15);
  v_sealed_length := (pg_catalog.get_byte(p_envelope,32)::bigint << 24)
    + (pg_catalog.get_byte(p_envelope,33)::bigint << 16)
    + (pg_catalog.get_byte(p_envelope,34)::bigint << 8)
    + pg_catalog.get_byte(p_envelope,35)::bigint;
  if v_epoch <> 1 or v_nonce_length <> 16 or v_sealed_length < 32
     or v_sealed_length > 64
     or pg_catalog.octet_length(p_envelope) <> 36 + v_sealed_length then
    raise exception 'BIRTH_EVIDENCE_ENVELOPE_UNAVAILABLE';
  end if;
  return query select v_epoch::integer,
    pg_catalog.substr(p_envelope, 17, 16),
    pg_catalog.substr(p_envelope, 37, v_sealed_length::integer);
end;
$f23_3e_p3d_internal_parse_birth_envelope$;

create function public.f23_3e_p3d_internal_parse_birth_plaintext(p_payload bytea)
returns date
language plpgsql immutable strict set search_path = ''
as $f23_3e_p3d_internal_parse_birth_plaintext$
declare
  v_text text;
  v_date date;
begin
  if pg_catalog.octet_length(p_payload) <> 10 then
    raise exception 'BIRTH_EVIDENCE_PAYLOAD_UNAVAILABLE';
  end if;
  begin
    v_text := pg_catalog.convert_from(p_payload, 'UTF8');
    if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'bad shape'; end if;
    v_date := v_text::date;
    if pg_catalog.to_char(v_date, 'YYYY-MM-DD') <> v_text then raise exception 'bad roundtrip'; end if;
  exception when others then
    raise exception 'BIRTH_EVIDENCE_PAYLOAD_UNAVAILABLE';
  end;
  return v_date;
end;
$f23_3e_p3d_internal_parse_birth_plaintext$;

create function public.f23_3e_p3d_internal_protect_candidate_birth_evidence(
  p_center_id text,
  p_consultation_case_id uuid,
  p_candidate_student_id uuid,
  p_expected_candidate_version integer,
  p_trusted_birth_date date
)
returns table(candidate_version integer)
language plpgsql security definer set search_path = ''
as $f23_3e_p3d_internal_protect_candidate_birth_evidence$
declare
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_payload bytea;
  v_nonce bytea;
  v_sealed bytea;
  v_envelope bytea;
begin
  if p_trusted_birth_date is null or p_expected_candidate_version is null or p_expected_candidate_version < 1 then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end if;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = p_center_id and c.consultation_case_id = p_consultation_case_id
    and c.candidate_student_id = p_candidate_student_id for update;
  if not found or v_candidate.candidate_version <> p_expected_candidate_version
     or v_candidate.candidate_status not in ('ACTIVE','REVIEW_REQUIRED') then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end if;
  begin
    v_payload := pg_catalog.convert_to(pg_catalog.to_char(p_trusted_birth_date, 'YYYY-MM-DD'), 'UTF8');
    if pg_catalog.octet_length(v_payload) <> 10 then raise exception 'bad payload'; end if;
    v_nonce := vault._crypto_aead_det_noncegen();
    if pg_catalog.octet_length(v_nonce) <> 16 then raise exception 'bad nonce'; end if;
    v_sealed := vault._crypto_aead_det_encrypt(
      v_payload,
      public.f23_3e_p3d_internal_candidate_birth_aad(
        p_center_id, p_consultation_case_id, p_candidate_student_id, 1
      ),
      1::bigint, pg_catalog.convert_to('iC3Bth01', 'UTF8'), v_nonce
    );
    if pg_catalog.octet_length(v_sealed) not between 32 and 64 then raise exception 'bad sealed'; end if;
    v_envelope := pg_catalog.convert_to('IC3CBE01', 'UTF8')
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u32(1)
      || public.f23_3e_p3c_internal_u16(16)
      || v_nonce
      || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))
      || v_sealed;
  exception when others then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end;
  update public.consultation_case_candidate_student c set
    birth_evidence_protected = v_envelope,
    candidate_version = c.candidate_version + 1,
    updated_at = pg_catalog.transaction_timestamp()
  where c.candidate_student_id = p_candidate_student_id
  returning c.candidate_version into candidate_version;
  return next;
end;
$f23_3e_p3d_internal_protect_candidate_birth_evidence$;

create function public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(
  p_center_id text,
  p_consultation_case_id uuid,
  p_candidate_student_id uuid,
  p_expected_candidate_version integer
)
returns date
language plpgsql security definer set search_path = ''
as $f23_3e_p3d_internal_unwrap_candidate_birth_evidence$
declare
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_parsed record;
  v_payload bytea;
begin
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = p_center_id and c.consultation_case_id = p_consultation_case_id
    and c.candidate_student_id = p_candidate_student_id;
  if not found or v_candidate.candidate_version <> p_expected_candidate_version
     or v_candidate.candidate_status not in ('ACTIVE','REVIEW_REQUIRED') then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end if;
  begin
    select * into strict v_parsed from public.f23_3e_p3d_internal_parse_birth_envelope(
      v_candidate.birth_evidence_protected, 'IC3CBE01'
    );
    v_payload := vault._crypto_aead_det_decrypt(
      v_parsed.sealed,
      public.f23_3e_p3d_internal_candidate_birth_aad(
        p_center_id, p_consultation_case_id, p_candidate_student_id, v_parsed.key_epoch
      ),
      1::bigint, pg_catalog.convert_to('iC3Bth01', 'UTF8'), v_parsed.nonce
    );
    return public.f23_3e_p3d_internal_parse_birth_plaintext(v_payload);
  exception when others then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end;
end;
$f23_3e_p3d_internal_unwrap_candidate_birth_evidence$;

create function public.f23_3e_p3d_internal_protect_student_birth_evidence(
  p_center_id text,
  p_student_id uuid,
  p_birth_date date
)
returns bytea
language plpgsql security definer set search_path = ''
as $f23_3e_p3d_internal_protect_student_birth_evidence$
declare
  v_payload bytea;
  v_nonce bytea;
  v_sealed bytea;
begin
  if p_center_id is null or p_student_id is null or p_birth_date is null then
    raise exception 'STUDENT_BIRTH_TARGET_UNAVAILABLE';
  end if;
  begin
    v_payload := pg_catalog.convert_to(pg_catalog.to_char(p_birth_date, 'YYYY-MM-DD'), 'UTF8');
    if pg_catalog.octet_length(v_payload) <> 10 then raise exception 'bad payload'; end if;
    v_nonce := vault._crypto_aead_det_noncegen();
    if pg_catalog.octet_length(v_nonce) <> 16 then raise exception 'bad nonce'; end if;
    v_sealed := vault._crypto_aead_det_encrypt(
      v_payload, public.f23_3e_p3d_internal_student_birth_aad(p_center_id, p_student_id, 1),
      1::bigint, pg_catalog.convert_to('iC3Std01', 'UTF8'), v_nonce
    );
    if pg_catalog.octet_length(v_sealed) not between 32 and 64 then raise exception 'bad sealed'; end if;
    return pg_catalog.convert_to('IC3SBE01', 'UTF8')
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u32(1)
      || public.f23_3e_p3c_internal_u16(16)
      || v_nonce
      || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))
      || v_sealed;
  exception when others then
    raise exception 'STUDENT_BIRTH_TARGET_UNAVAILABLE';
  end;
end;
$f23_3e_p3d_internal_protect_student_birth_evidence$;

create function public.f23_3e_p3d_internal_validate_student_birth_evidence(
  p_center_id text,
  p_student_id uuid,
  p_expected_student_version integer
)
returns boolean
language plpgsql security definer set search_path = ''
as $f23_3e_p3d_internal_validate_student_birth_evidence$
declare
  v_student public.student_profile%rowtype;
  v_parsed record;
  v_payload bytea;
begin
  select s.* into v_student from public.student_profile s
  where s.center_id = p_center_id and s.student_id = p_student_id;
  if not found or v_student.student_version <> p_expected_student_version
     or v_student.profile_status <> 'ACTIVE' then return false; end if;
  begin
    select * into strict v_parsed from public.f23_3e_p3d_internal_parse_birth_envelope(
      v_student.birth_evidence_protected, 'IC3SBE01'
    );
    v_payload := vault._crypto_aead_det_decrypt(
      v_parsed.sealed,
      public.f23_3e_p3d_internal_student_birth_aad(p_center_id, p_student_id, v_parsed.key_epoch),
      1::bigint, pg_catalog.convert_to('iC3Std01', 'UTF8'), v_parsed.nonce
    );
    perform public.f23_3e_p3d_internal_parse_birth_plaintext(v_payload);
    return true;
  exception when others then return false;
  end;
end;
$f23_3e_p3d_internal_validate_student_birth_evidence$;

-- Exact P3C signature and business checks are retained. The only physical
-- change is authenticated Candidate unwrap followed by Student-context seal.
create or replace function public.f23_3e_p3c_internal_create_student_target(
  p_conversion_action_id uuid,
  p_actor_user_id uuid,
  p_display_name_evidence text,
  p_birth_date_evidence date
)
returns table(student_id uuid, student_version integer)
language plpgsql security definer set search_path = ''
as $f23_3e_p3c_internal_create_student_target$
declare
  v_selector record;
  v_root public.center_crm_control%rowtype;
  v_action public.crm_conversion_action%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_existing public.student_profile%rowtype;
  v_key bytea;
  v_mutexes bytea[];
  v_mutex bytea;
  v_name_digest bytea;
  v_birth_digest bytea;
  v_identity_digest bytea;
  v_authenticated_birth date;
  v_target_birth bytea;
begin
  select a.center_id, a.conversion_request_id, a.source_candidate_student_id
  into v_selector from public.crm_conversion_action a
  where a.conversion_action_id = p_conversion_action_id;
  if not found or p_actor_user_id is null then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_selector.center_id for update;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_selector.center_id
    and c.candidate_student_id = v_selector.source_candidate_student_id;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = v_selector.center_id and p.identity_kind = 'STUDENT'
    and p.status = 'CURRENT' for share;
  if not found or v_candidate.candidate_student_id is null
     or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    raise exception 'SOURCE_VERSION_STALE';
  end if;
  v_authenticated_birth := public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(
    v_selector.center_id, v_candidate.consultation_case_id,
    v_candidate.candidate_student_id, v_candidate.candidate_version
  );
  if v_authenticated_birth is distinct from p_birth_date_evidence then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end if;
  v_mutexes := public.f23_3e_p3c_internal_identity_mutex_keys(
    v_selector.center_id, 'STUDENT', v_policy.identity_policy_registry_id,
    p_display_name_evidence, v_authenticated_birth, null
  );
  foreach v_mutex in array v_mutexes loop
    perform 1 from public.crm_identity_match_mutex m
    where m.identity_match_mutex_key = v_mutex and m.status = 'ACTIVE' for update;
    if not found then raise exception 'MATCH_POLICY_STALE'; end if;
  end loop;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_selector.center_id
    and r.conversion_request_id = v_selector.conversion_request_id for update;
  select a.* into v_action from public.crm_conversion_action a
  where a.center_id = v_selector.center_id
    and a.conversion_request_id = v_request.conversion_request_id
    and a.conversion_action_id = p_conversion_action_id for update;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_selector.center_id
    and c.consultation_case_id = v_request.consultation_case_id
    and c.candidate_student_id = v_action.source_candidate_student_id for share;
  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = v_selector.center_id and r.match_review_id = v_action.match_review_id for share;
  select r.* into v_reservation from public.crm_profile_creation_reservation r
  where r.center_id = v_selector.center_id
    and r.reservation_id = v_action.profile_creation_reservation_id for update;
  if v_action.action_kind <> 'CREATE_NEW_STUDENT' or v_action.status <> 'APPROVED'
     or v_action.identity_kind <> 'STUDENT'
     or v_action.conversion_request_id <> v_request.conversion_request_id
     or v_action.source_candidate_student_id <> v_candidate.candidate_student_id
     or v_action.match_review_id <> v_review.match_review_id
     or v_action.profile_creation_reservation_id <> v_reservation.reservation_id
     or v_action.opaque_target_id is distinct from v_reservation.preallocated_target_id
     or v_action.target_adapter_namespace <> 'canonical.student_profile.v1'
     or v_review.review_status <> 'CREATE_NEW_REVIEWED'
     or v_review.review_action <> 'PREPARE_CREATE_NEW'
     or v_review.match_outcome <> 'NO_MATCH'
     or v_review.conversion_request_id <> v_request.conversion_request_id
     or v_review.consultation_case_id <> v_request.consultation_case_id
     or v_review.crm_contact_id <> v_request.source_contact_id
     or v_review.candidate_student_id <> v_candidate.candidate_student_id
     or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_review.source_contact_version <> v_request.source_contact_version
     or v_review.source_case_version <> v_request.source_case_version
     or v_review.expires_at <= pg_catalog.transaction_timestamp()
     or v_reservation.status <> 'ACTIVE'
     or v_reservation.entity_kind <> 'STUDENT'
     or v_reservation.conversion_request_id <> v_request.conversion_request_id
     or v_reservation.match_review_id <> v_review.match_review_id
     or v_reservation.request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_reservation.target_adapter_namespace <> 'canonical.student_profile.v1'
     or v_reservation.expires_at <= pg_catalog.transaction_timestamp()
     or v_request.action_graph_digest is distinct from v_action.legacy_request_action_graph_digest
     or v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version
     or v_policy.identity_policy_registry_id <> v_reservation.identity_policy_registry_id
     or v_policy.normalization_version <> v_reservation.normalization_version
     or v_policy.match_policy_version <> v_reservation.match_policy_version
     or v_policy.minimum_evidence_policy_version <> v_reservation.minimum_evidence_policy_version
     or v_candidate.candidate_version <> v_review.source_candidate_version then
    raise exception 'CREATE_STUDENT_TARGET_EVIDENCE_STALE';
  end if;
  v_authenticated_birth := public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(
    v_selector.center_id, v_request.consultation_case_id,
    v_candidate.candidate_student_id, v_candidate.candidate_version
  );
  if v_authenticated_birth is distinct from p_birth_date_evidence then
    raise exception 'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE';
  end if;
  select s.* into v_existing from public.student_profile s
  where s.center_id = v_selector.center_id and s.student_id = v_reservation.preallocated_target_id for share;
  if found then
    if v_existing.created_from_action_id = p_conversion_action_id then
      student_id := v_existing.student_id; student_version := v_existing.student_version; return next; return;
    end if;
    raise exception 'TARGET_ALREADY_EXISTS';
  end if;
  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_name_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    'STUDENT', 'STUDENT_DISPLAY_NAME',
    public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence),
    v_policy.digest_key_epoch
  );
  v_birth_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    'STUDENT', 'STUDENT_BIRTH_DATE',
    public.f23_3e_p2b_internal_normalize_student_birth_v1(v_authenticated_birth),
    v_policy.digest_key_epoch
  );
  v_identity_digest := extensions.digest(
    v_review.evidence_set_digest || v_reservation.source_evidence_digest
      || v_name_digest || v_birth_digest, 'sha256'
  );
  v_target_birth := public.f23_3e_p3d_internal_protect_student_birth_evidence(
    v_selector.center_id, v_reservation.preallocated_target_id, v_authenticated_birth
  );
  if v_target_birth = v_candidate.birth_evidence_protected then
    raise exception 'STUDENT_BIRTH_TARGET_UNAVAILABLE';
  end if;
  insert into public.student_profile(
    student_id, center_id, display_name, birth_evidence_protected,
    profile_status, learning_lifecycle_status, identity_policy_registry_id,
    normalization_version, match_policy_version, minimum_evidence_policy_version,
    name_lookup_digest, birth_lookup_digest, identity_evidence_digest,
    student_version, created_from_case_id, created_from_candidate_id,
    created_from_request_id, created_from_action_id, created_by_user_id
  ) values (
    v_reservation.preallocated_target_id, v_selector.center_id,
    p_display_name_evidence, v_target_birth,
    'ACTIVE', null, v_policy.identity_policy_registry_id,
    v_policy.normalization_version, v_policy.match_policy_version,
    v_policy.minimum_evidence_policy_version, v_name_digest, v_birth_digest,
    v_identity_digest, 1, v_request.consultation_case_id,
    v_candidate.candidate_student_id, v_request.conversion_request_id,
    p_conversion_action_id, p_actor_user_id
  ) returning public.student_profile.student_id, public.student_profile.student_version
    into student_id, student_version;
  return next;
end;
$f23_3e_p3c_internal_create_student_target$;

-- Stage A is deliberately read-only. It permits a birth unwrap only after the
-- exact issued authority, consumed single-use assertion and current security /
-- membership binding have proved the real-conversion purpose.
create function public.f23_3e_p3d_internal_precheck_birth_evidence(
  p_conversion_request_id uuid,
  p_conversion_authority_id uuid,
  p_expected_request_version integer,
  p_expected_authority_version integer,
  p_environment_fingerprint bytea
)
returns table(
  center_id text,
  actor_user_id uuid,
  consultation_case_id uuid,
  candidate_student_id uuid,
  candidate_version integer,
  display_name_evidence text,
  birth_date_evidence date,
  source_envelope_digest bytea,
  student_action_id uuid,
  student_action_kind text
)
language plpgsql volatile security definer set search_path = ''
as $f23_3e_p3d_internal_precheck_birth_evidence$
declare
  v_request public.crm_conversion_request%rowtype;
  v_authority public.crm_conversion_authority%rowtype;
  v_action public.crm_conversion_action%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_control public.account_security_control%rowtype;
  v_step public.account_step_up_assertion%rowtype;
  v_membership public.center_members%rowtype;
begin
  select r.* into v_request from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  select a.* into v_authority from public.crm_conversion_authority a
  where a.conversion_authority_id = p_conversion_authority_id
    and a.conversion_request_id = p_conversion_request_id;
  if v_request.conversion_request_id is null or v_authority.conversion_authority_id is null
     or v_request.center_id <> v_authority.center_id
     or v_request.status <> 'APPROVED'
     or v_request.request_version <> p_expected_request_version
     or v_authority.approved_request_version <> v_request.request_version
     or v_authority.status <> 'ISSUED'
     or v_authority.authority_version <> p_expected_authority_version
     or v_authority.expires_at <= pg_catalog.transaction_timestamp()
     or v_authority.purpose <> 'crm.real_conversion.execute'
     or v_authority.environment_fingerprint is distinct from p_environment_fingerprint
     or v_request.action_graph_digest is distinct from v_authority.legacy_request_action_graph_digest
     or v_request.intent_digest is distinct from v_authority.conversion_intent_digest then
    raise exception 'AUTHORITY_NOT_AVAILABLE';
  end if;
  select c.* into v_control from public.account_security_control c
  where c.canonical_user_id = v_authority.actor_user_id;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_authority.center_id and m.id = v_authority.membership_id
    and m.user_id = v_authority.actor_user_id;
  select s.* into v_step from public.account_step_up_assertion s
  where s.step_up_assertion_id = v_authority.step_up_assertion_id;
  if v_control.canonical_user_id is null or v_control.account_lifecycle <> 'ACTIVE'
     or v_control.security_version <> v_authority.account_security_version
     or v_control.session_version <> v_authority.account_session_version
     or v_control.assurance_policy_version <> v_authority.assurance_policy_version
     or v_membership.id is null or v_membership.status <> 'active'
     or v_membership.role not in ('owner','center_admin')
     or v_membership.membership_version <> v_authority.membership_version
     or v_step.step_up_assertion_id is null or v_step.status <> 'CONSUMED'
     or v_step.consumed_by_authority_id <> v_authority.conversion_authority_id
     or v_step.assertion_version <> v_authority.step_up_assertion_version
     or v_step.canonical_user_id <> v_authority.actor_user_id
     or v_step.center_id <> v_authority.center_id
     or v_step.conversion_request_id <> v_request.conversion_request_id
     or v_step.purpose <> v_authority.purpose
     or v_step.security_version <> v_control.security_version
     or v_step.session_version <> v_control.session_version
     or v_step.assurance_policy_version <> v_control.assurance_policy_version
     or v_step.assurance_level not in ('AAL2_TOTP','AAL2_PHISHING_RESISTANT','AAL3_HARDWARE_BACKED') then
    raise exception 'AUTHORITY_SECURITY_BINDING_STALE';
  end if;
  select a.* into strict v_action from public.crm_conversion_action a
  where a.center_id = v_request.center_id and a.conversion_request_id = v_request.conversion_request_id
    and a.identity_kind = 'STUDENT';
  if v_action.status <> 'APPROVED'
     or v_action.legacy_request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_action.action_kind not in (
       'CREATE_NEW_STUDENT','REUSE_REVIEWED_STUDENT','DO_NOT_CREATE_STUDENT'
     ) then raise exception 'APPROVED_ACTION_SET_STALE'; end if;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_request.center_id
    and c.consultation_case_id = v_request.consultation_case_id
    and c.candidate_student_id = v_action.source_candidate_student_id;
  if not found or v_candidate.candidate_status not in ('ACTIVE','REVIEW_REQUIRED') then
    raise exception 'CANDIDATE_STATE_STALE';
  end if;
  center_id := v_request.center_id;
  actor_user_id := v_authority.actor_user_id;
  consultation_case_id := v_request.consultation_case_id;
  candidate_student_id := v_candidate.candidate_student_id;
  candidate_version := v_candidate.candidate_version;
  display_name_evidence := v_candidate.display_name_evidence;
  student_action_id := v_action.conversion_action_id;
  student_action_kind := v_action.action_kind;
  if v_action.action_kind <> 'DO_NOT_CREATE_STUDENT' then
    birth_date_evidence := public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(
      v_request.center_id, v_request.consultation_case_id,
      v_candidate.candidate_student_id, v_candidate.candidate_version
    );
    source_envelope_digest := extensions.digest(v_candidate.birth_evidence_protected, 'sha256');
  end if;
  return next;
exception when no_data_found then
  raise exception 'APPROVED_ACTION_SET_STALE';
end;
$f23_3e_p3d_internal_precheck_birth_evidence$;

create function public.f23_3e_p3d_internal_commit_create_binding(
  p_conversion_action_id uuid,
  p_target_id uuid,
  p_target_version integer
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $f23_3e_p3d_internal_commit_create_binding$
declare
  v_action public.crm_conversion_action%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_existing public.crm_identity_target_binding%rowtype;
  v_id uuid;
begin
  select a.* into v_action from public.crm_conversion_action a
  where a.conversion_action_id = p_conversion_action_id for share;
  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = v_action.center_id and r.match_review_id = v_action.match_review_id for share;
  select r.* into v_reservation from public.crm_profile_creation_reservation r
  where r.center_id = v_action.center_id
    and r.reservation_id = v_action.profile_creation_reservation_id for share;
  if v_action.status <> 'APPROVED'
     or v_action.action_kind not in ('CREATE_NEW_STUDENT','CREATE_NEW_GUARDIAN')
     or v_review.review_status <> 'CREATE_NEW_REVIEWED'
     or v_review.review_action <> 'PREPARE_CREATE_NEW'
     or v_reservation.status <> 'ACTIVE'
     or v_reservation.match_review_id <> v_review.match_review_id
     or v_reservation.preallocated_target_id <> p_target_id
     or p_target_version <> 1 then
    raise exception 'CREATE_BINDING_EVIDENCE_STALE';
  end if;
  select b.* into v_existing from public.crm_identity_target_binding b
  where b.center_id = v_action.center_id and b.identity_kind = v_action.identity_kind
    and ((v_action.identity_kind = 'STUDENT'
      and b.source_candidate_student_id = v_action.source_candidate_student_id)
      or (v_action.identity_kind = 'GUARDIAN'
      and b.source_contact_id = v_action.source_contact_id))
    and b.binding_status = 'ACTIVE' for share;
  if found then
    if coalesce(v_existing.student_id, v_existing.guardian_id) = p_target_id
       and v_existing.originating_action_id = p_conversion_action_id then
      return v_existing.identity_target_binding_id;
    end if;
    raise exception 'CREATE_BINDING_CONFLICT';
  end if;
  perform pg_catalog.set_config('ichess.p3c_binding_write', 'on', true);
  insert into public.crm_identity_target_binding(
    center_id, identity_kind, source_contact_id, source_candidate_student_id,
    student_id, guardian_id, binding_status, binding_version,
    source_version_at_binding, target_version_at_binding,
    originating_request_id, originating_action_id, originating_review_id
  ) values (
    v_action.center_id, v_action.identity_kind,
    case when v_action.identity_kind = 'GUARDIAN' then v_action.source_contact_id end,
    case when v_action.identity_kind = 'STUDENT' then v_action.source_candidate_student_id end,
    case when v_action.identity_kind = 'STUDENT' then p_target_id end,
    case when v_action.identity_kind = 'GUARDIAN' then p_target_id end,
    'ACTIVE', 1,
    case when v_action.identity_kind = 'STUDENT' then v_review.source_candidate_version
      else v_review.source_contact_version end,
    p_target_version, v_action.conversion_request_id,
    v_action.conversion_action_id, v_review.match_review_id
  ) returning identity_target_binding_id into v_id;
  return v_id;
end;
$f23_3e_p3d_internal_commit_create_binding$;

create function public.f23_3e_p3d_internal_append_event(
  p_center_id text, p_event_type text, p_actor_user_id uuid,
  p_resource_kind text, p_resource_id uuid, p_request_id uuid,
  p_assignment_id uuid, p_previous_version integer, p_new_version integer,
  p_status text, p_safe_reason_code text, p_outcome_code text, p_correlation_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $f23_3e_p3d_internal_append_event$
begin
  if p_event_type not in (
    'crm.student.created_from_conversion','crm.student.reused_for_conversion',
    'crm.guardian.created_from_conversion','crm.guardian.reused_for_conversion',
    'crm.guardian_student_relationship.created','crm.guardian_student_relationship.reused',
    'crm.guardian_student_relationship.updated',
    'crm.candidate.converted','crm.assignment.ended','crm.case.converted',
    'crm.conversion.authority_consumed','crm.conversion.completed'
  ) or p_outcome_code !~ '^[A-Z][A-Z0-9_]*$' then
    raise exception 'P3D_EVENT_NOT_ALLOWED';
  end if;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id, p_event_type, p_actor_user_id, p_resource_kind, p_resource_id,
    p_request_id, p_assignment_id, p_previous_version, p_new_version, p_status,
    p_safe_reason_code, 'crm.real_conversion.execute', p_outcome_code, p_correlation_id
  );
exception when others then
  raise exception 'P3D_EVENT_WRITE_FAILED';
end;
$f23_3e_p3d_internal_append_event$;

create function public.f23_3e_p3d_execute_conversion(
  p_conversion_request_id uuid,
  p_conversion_authority_id uuid,
  p_expected_request_version integer,
  p_expected_authority_version integer,
  p_environment_fingerprint bytea,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table(
  ok boolean,
  outcome_code text,
  replayed boolean,
  conversion_request_id uuid,
  request_status text,
  request_version integer,
  consultation_case_id uuid,
  case_version integer,
  conversion_authority_id uuid,
  authority_status text,
  authority_version integer,
  executed_action_results jsonb,
  correlation_id uuid
)
language plpgsql volatile security definer set search_path = ''
as $f23_3e_p3d_execute_conversion$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_binding_digest bytea;
  v_terminal_digest bytea;
  v_snapshot jsonb;
  v_precheck record;
  v_root public.center_crm_control%rowtype;
  v_control public.account_security_control%rowtype;
  v_step public.account_step_up_assertion%rowtype;
  v_membership public.center_members%rowtype;
  v_authority public.crm_conversion_authority%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_student_action public.crm_conversion_action%rowtype;
  v_guardian_action public.crm_conversion_action%rowtype;
  v_relationship_action public.crm_conversion_action%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_guardian_policy public.crm_identity_policy_registry%rowtype;
  v_student_mutex_keys bytea[];
  v_guardian_mutex_keys bytea[];
  v_locked_identity_mutex_set_digest bytea;
  v_mutex record;
  v_locked_birth date;
  v_action_digest bytea;
  v_reuse_authorization_set_digest bytea;
  v_reuse_code text;
  v_binding_result record;
  v_student_result record;
  v_guardian_result record;
  v_relationship_result record;
  v_reuse record;
  v_student_id uuid;
  v_student_version integer;
  v_guardian_id uuid;
  v_guardian_version integer;
  v_relationship_id uuid;
  v_relationship_version integer;
  v_student_outcome text;
  v_guardian_outcome text;
  v_relationship_outcome text;
  v_action_results jsonb;
  v_count integer;
  v_row record;
begin
  if p_conversion_request_id is null or p_conversion_authority_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_authority_version is null or p_expected_authority_version < 1
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, p_conversion_request_id,
      null::text, null::integer, null::uuid, null::integer,
      p_conversion_authority_id, null::text, null::integer, null::jsonb, null::uuid;
    return;
  end if;
  v_binding_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain','ichess.crm.p3d.real-conversion.execute.v1',
    'conversion_request_id',p_conversion_request_id,
    'conversion_authority_id',p_conversion_authority_id,
    'expected_request_version',p_expected_request_version,
    'expected_authority_version',p_expected_authority_version,
    'environment_fingerprint',pg_catalog.encode(p_environment_fingerprint,'hex')
  )::text,'UTF8'),'sha256');

  -- Unlocked immutable-result selector. This is intentionally before Stage A:
  -- a committed replay never reinterprets COMPLETED/EXECUTED/CONSUMED rows.
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.real_conversion.execute'
    and i.idempotency_key_digest = p_idempotency_key_digest;
  if found and v_registry.status = 'COMPLETED' then
    if v_registry.environment_fingerprint is distinct from p_environment_fingerprint
       or v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_expected_request_version is distinct from p_expected_request_version
       or v_registry.p3_expected_resource_version is distinct from p_expected_authority_version
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest
       or v_registry.p3_result_kind <> 'REAL_CONVERSION'
       or v_registry.p3_result_snapshot ->> 'conversion_authority_id' <> p_conversion_authority_id::text then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, p_conversion_request_id,
        null::text, null::integer, null::uuid, null::integer,
        p_conversion_authority_id, null::text, null::integer, null::jsonb, null::uuid;
      return;
    end if;
    v_snapshot := v_registry.p3_result_snapshot;
    return query select true, v_registry.p3_result_outcome_code, true,
      (v_snapshot ->> 'request_id')::uuid, v_snapshot ->> 'resource_status',
      (v_snapshot ->> 'request_version')::integer,
      (v_snapshot ->> 'consultation_case_id')::uuid,
      (v_snapshot ->> 'case_version')::integer,
      (v_snapshot ->> 'conversion_authority_id')::uuid,
      v_snapshot ->> 'authority_status', (v_snapshot ->> 'authority_version')::integer,
      v_snapshot -> 'executed_action_results',
      (v_snapshot ->> 'correlation_id')::uuid;
    return;
  elsif found then
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, p_conversion_request_id,
      null::text, null::integer, null::uuid, null::integer,
      p_conversion_authority_id, null::text, null::integer, null::jsonb, null::uuid;
    return;
  end if;

  -- Stage A purpose-bound protected selector. No mutation has occurred.
  select * into strict v_precheck from public.f23_3e_p3d_internal_precheck_birth_evidence(
    p_conversion_request_id, p_conversion_authority_id,
    p_expected_request_version, p_expected_authority_version,
    p_environment_fingerprint
  );
  if v_precheck.birth_date_evidence is not null then
    select p.* into v_policy from public.crm_identity_policy_registry p
    where p.center_id = v_precheck.center_id and p.identity_kind = 'STUDENT'
      and p.status = 'CURRENT';
    if not found then raise exception 'IDENTITY_POLICY_STALE'; end if;
    v_student_mutex_keys := public.f23_3e_p3c_internal_identity_mutex_keys(
      v_precheck.center_id, 'STUDENT', v_policy.identity_policy_registry_id,
      v_precheck.display_name_evidence, v_precheck.birth_date_evidence, null
    );
  else
    v_student_mutex_keys := array[]::bytea[];
  end if;
  select p.* into v_guardian_policy from public.crm_identity_policy_registry p
  where p.center_id=v_precheck.center_id and p.identity_kind='GUARDIAN' and p.status='CURRENT';
  select c.* into v_contact from public.crm_contact c
  join public.crm_conversion_request r on r.center_id=c.center_id and r.source_contact_id=c.crm_contact_id
  where r.conversion_request_id=p_conversion_request_id;
  if v_guardian_policy.identity_policy_registry_id is null or v_contact.crm_contact_id is null then
    raise exception 'IDENTITY_POLICY_STALE';
  end if;
  v_guardian_mutex_keys:=public.f23_3e_p3c_internal_identity_mutex_keys(
    v_precheck.center_id,'GUARDIAN',v_guardian_policy.identity_policy_registry_id,
    v_contact.display_name,null,v_contact.crm_contact_id);
  if pg_catalog.cardinality(v_guardian_mutex_keys)+pg_catalog.cardinality(v_student_mutex_keys)>0 then
    v_locked_identity_mutex_set_digest:=public.f23_3e_p3d_internal_identity_mutex_set_digest(
      v_precheck.center_id,v_guardian_mutex_keys,v_student_mutex_keys);
  else
    v_locked_identity_mutex_set_digest:=extensions.digest(
      public.f23_3e_p3d_internal_text32('ichess.crm.p3.identity-mutex-resource-set.v1')
      ||public.f23_3e_p3c_internal_u16(1)||public.f23_3e_p3d_internal_text32(v_precheck.center_id)
      ||public.f23_3e_p3c_internal_u32(0),'sha256');
  end if;

  -- P3D_CANONICAL_LOCK_ORDER_BEGIN
  -- 0 root; 1 sorted identity mutexes; 2 account; 3 consumed assertion;
  -- 4 membership; 5 authority; 6 idempotency; 7 Request; 8 actions;
  -- 9 Contact; 10 Case; 11 candidates; 12 Assignment; 13 targets/bindings;
  -- 14 reviews; 15 reservations; 16 relationships; then events and commit.
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_precheck.center_id for update;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  -- Dormant local-postgres-only post-root barrier. Product sessions cannot
  -- satisfy all three predicates and no public parameter activates it.
  if session_user='postgres'
     and pg_catalog.current_setting('ichess.p3d_local_qa_root_barrier',true)='on'
     and pg_catalog.to_regclass('pg_temp.p3d_qa_root_barrier') is not null then
    execute 'select count(*) from pg_temp.p3d_qa_root_barrier where enabled' into v_count;
    if v_count<>1 then raise exception 'P3D_LOCAL_QA_BARRIER_INVALID'; end if;
    for v_mutex in execute 'select center_id,barrier_token from pg_temp.p3d_qa_root_barrier where enabled' loop
      if v_mutex.center_id<>v_precheck.center_id then raise exception 'P3D_LOCAL_QA_BARRIER_INVALID'; end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'f23.3e.p3d.local-qa.root-barrier.v1|'||v_precheck.center_id||'|'||v_mutex.barrier_token::text,0));
    end loop;
  end if;
  for v_mutex in
    select m.identity_kind,m.identity_match_mutex_key
    from public.crm_identity_match_mutex m
    join (
      select 'GUARDIAN'::text identity_kind,k identity_match_mutex_key
        from pg_catalog.unnest(v_guardian_mutex_keys) k
      union
      select 'STUDENT',k from pg_catalog.unnest(v_student_mutex_keys) k
    ) wanted using(identity_kind,identity_match_mutex_key)
    where m.center_id=v_precheck.center_id and m.status='ACTIVE'
    order by case m.identity_kind when 'GUARDIAN' then 1 when 'STUDENT' then 2 else 99 end,
      m.identity_match_mutex_key
    for update of m
  loop null; end loop;
  if (select pg_catalog.count(*) from (
      select 'GUARDIAN'::text kind,k from pg_catalog.unnest(v_guardian_mutex_keys) k
      union select 'STUDENT',k from pg_catalog.unnest(v_student_mutex_keys) k) q)
     <> (select pg_catalog.count(*) from public.crm_identity_match_mutex m
       join (select 'GUARDIAN'::text kind,k from pg_catalog.unnest(v_guardian_mutex_keys) k
         union select 'STUDENT',k from pg_catalog.unnest(v_student_mutex_keys) k) q
       on q.kind=m.identity_kind and q.k=m.identity_match_mutex_key
       where m.center_id=v_precheck.center_id and m.status='ACTIVE') then
    raise exception 'IDENTITY_MUTEX_SET_STALE';
  end if;
  select c.* into v_control from public.account_security_control c
  where c.canonical_user_id = v_precheck.actor_user_id for update;
  select s.* into v_step from public.account_step_up_assertion s
  join public.crm_conversion_authority a on a.step_up_assertion_id = s.step_up_assertion_id
  where a.conversion_authority_id = p_conversion_authority_id for update of s;
  select m.* into v_membership from public.center_members m
  join public.crm_conversion_authority a on a.membership_id = m.id
  where a.conversion_authority_id = p_conversion_authority_id for update of m;
  select a.* into v_authority from public.crm_conversion_authority a
  where a.conversion_authority_id = p_conversion_authority_id for update;

  -- A concurrent first execution may have completed while Stage A waited.
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.real_conversion.execute'
    and i.idempotency_key_digest = p_idempotency_key_digest for update;
  if found then
    if v_registry.status = 'COMPLETED'
       and v_registry.environment_fingerprint is not distinct from p_environment_fingerprint
       and v_registry.intent_digest is not distinct from p_operation_intent_digest
       and v_registry.p3_expected_request_version is not distinct from p_expected_request_version
       and v_registry.p3_expected_resource_version is not distinct from p_expected_authority_version
       and v_registry.p3_operation_binding_digest is not distinct from v_binding_digest
       and v_registry.p3_result_kind = 'REAL_CONVERSION'
       and v_registry.p3_result_snapshot ->> 'conversion_authority_id' = p_conversion_authority_id::text then
      v_snapshot := v_registry.p3_result_snapshot;
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_snapshot ->> 'request_id')::uuid, v_snapshot ->> 'resource_status',
        (v_snapshot ->> 'request_version')::integer,
        (v_snapshot ->> 'consultation_case_id')::uuid,
        (v_snapshot ->> 'case_version')::integer,
        (v_snapshot ->> 'conversion_authority_id')::uuid,
        v_snapshot ->> 'authority_status', (v_snapshot ->> 'authority_version')::integer,
        v_snapshot -> 'executed_action_results', (v_snapshot ->> 'correlation_id')::uuid;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  insert into public.crm_idempotency_registry(
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    action_graph_digest, request_id, expires_at, p3_actor_user_id,
    p3_step_up_assertion_id, p3_expected_request_version,
    p3_expected_resource_version, p3_operation_binding_digest,
    p3_legacy_request_action_graph_digest
  ) values (
    p_environment_fingerprint, v_precheck.center_id, 'conversion_request',
    p_conversion_request_id, v_precheck.consultation_case_id,
    'crm.real_conversion.execute', p_idempotency_key_digest,
    p_operation_intent_digest, v_authority.legacy_request_action_graph_digest,
    p_conversion_request_id, p_idempotency_expires_at, v_authority.actor_user_id,
    v_authority.step_up_assertion_id, p_expected_request_version,
    p_expected_authority_version, v_binding_digest,
    v_authority.legacy_request_action_graph_digest
  ) returning * into v_registry;

  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_precheck.center_id
    and r.conversion_request_id = p_conversion_request_id for update;
  perform a.conversion_action_id from public.crm_conversion_action a
  where a.center_id = v_precheck.center_id
    and a.conversion_request_id = p_conversion_request_id
  order by a.conversion_action_id for update;
  select a.* into strict v_student_action from public.crm_conversion_action a
  where a.conversion_request_id = p_conversion_request_id and a.identity_kind = 'STUDENT';
  select a.* into strict v_guardian_action from public.crm_conversion_action a
  where a.conversion_request_id = p_conversion_request_id and a.identity_kind = 'GUARDIAN';
  select a.* into strict v_relationship_action from public.crm_conversion_action a
  where a.conversion_request_id = p_conversion_request_id and a.identity_kind is null;
  perform z.reviewed_reuse_authorization_id
  from public.crm_reviewed_cross_source_reuse_authorization z
  where z.center_id=v_precheck.center_id and z.conversion_request_id=p_conversion_request_id
  order by z.reviewed_reuse_authorization_id for update;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_precheck.center_id and c.crm_contact_id = v_request.source_contact_id for update;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_precheck.center_id
    and c.consultation_case_id = v_request.consultation_case_id for update;
  perform c.candidate_student_id from public.consultation_case_candidate_student c
  where c.center_id = v_precheck.center_id
    and c.consultation_case_id = v_request.consultation_case_id
  order by c.candidate_student_id for update;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_precheck.center_id
    and c.candidate_student_id = v_student_action.source_candidate_student_id;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_precheck.center_id and a.assignment_id = v_request.source_assignment_id for update;
  perform s.student_id from public.student_profile s
  where s.center_id = v_precheck.center_id
    and s.student_id = coalesce(v_student_action.student_target_id, v_student_action.opaque_target_id)
  for update;
  perform g.guardian_id from public.guardian_profile g
  where g.center_id = v_precheck.center_id
    and g.guardian_id = coalesce(v_guardian_action.guardian_target_id, v_guardian_action.opaque_target_id)
  for update;
  perform b.identity_target_binding_id from public.crm_identity_target_binding b
  where b.center_id = v_precheck.center_id
    and b.binding_status = 'ACTIVE'
    and (b.source_candidate_student_id = v_student_action.source_candidate_student_id
      or b.source_contact_id = v_guardian_action.source_contact_id)
  order by b.identity_target_binding_id for update;
  perform r.match_review_id from public.crm_identity_match_review r
  join public.crm_conversion_action a on a.match_review_id = r.match_review_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.match_review_id for update of r;
  perform r.reservation_id from public.crm_profile_creation_reservation r
  join public.crm_conversion_action a on a.profile_creation_reservation_id = r.reservation_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.reservation_id for update of r;
  perform r.relationship_id from public.guardian_student_relationship r
  where r.center_id = v_precheck.center_id
    and (r.relationship_id = v_relationship_action.guardian_student_relationship_id
      or (r.guardian_id = coalesce(v_guardian_action.guardian_target_id, v_guardian_action.opaque_target_id)
        and r.student_id = coalesce(v_student_action.student_target_id, v_student_action.opaque_target_id)))
  order by r.relationship_id for update;
  -- P3D_CANONICAL_LOCK_ORDER_END

  if public.f23_3e_p3d_internal_identity_mutex_set_digest(
       v_precheck.center_id,
       public.f23_3e_p3c_internal_identity_mutex_keys(v_precheck.center_id,'GUARDIAN',
         v_guardian_policy.identity_policy_registry_id,v_contact.display_name,null,v_contact.crm_contact_id),
       case when v_precheck.birth_date_evidence is null then array[]::bytea[] else
         public.f23_3e_p3c_internal_identity_mutex_keys(v_precheck.center_id,'STUDENT',
           v_policy.identity_policy_registry_id,v_precheck.display_name_evidence,
           v_precheck.birth_date_evidence,null) end)
     is distinct from v_locked_identity_mutex_set_digest then
    raise exception 'IDENTITY_MUTEX_SET_STALE';
  end if;

  if v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED'
     or v_request.status <> 'APPROVED' or v_request.request_version <> p_expected_request_version
     or v_request.center_id <> v_authority.center_id
     or v_request.consultation_case_id <> v_authority.consultation_case_id
     or v_request.source_contact_id <> v_authority.source_contact_id
     or v_request.source_assignment_id <> v_authority.assignment_id
     or v_request.action_graph_digest is distinct from v_authority.legacy_request_action_graph_digest
     or v_request.intent_digest is distinct from v_authority.conversion_intent_digest
     or v_authority.conversion_request_id <> v_request.conversion_request_id
     or v_authority.status <> 'ISSUED' or v_authority.authority_version <> p_expected_authority_version
     or v_authority.approved_request_version <> v_request.request_version
     or v_authority.purpose <> 'crm.real_conversion.execute'
     or v_authority.expires_at <= v_now
     or v_authority.environment_fingerprint is distinct from p_environment_fingerprint then
    raise exception 'AUTHORITY_OR_REQUEST_STALE';
  end if;
  if v_root.identity_policy_version <> v_authority.identity_policy_version
     or v_root.conversion_policy_version <> v_authority.conversion_policy_version
     or v_root.relationship_policy_version <> v_authority.relationship_policy_version
     or v_root.student_profile_policy_version <> v_authority.student_profile_policy_version
     or v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version then
    raise exception 'CONVERSION_POLICY_VERSION_STALE';
  end if;
  if v_control.canonical_user_id <> v_authority.actor_user_id
     or v_control.account_lifecycle <> 'ACTIVE'
     or v_control.security_version <> v_authority.account_security_version
     or v_control.session_version <> v_authority.account_session_version
     or v_control.assurance_policy_version <> v_authority.assurance_policy_version
     or v_membership.id <> v_authority.membership_id
     or v_membership.user_id <> v_authority.actor_user_id
     or v_membership.center_id <> v_authority.center_id
     or v_membership.status <> 'active' or v_membership.role not in ('owner','center_admin')
     or v_membership.membership_version <> v_authority.membership_version
     or v_step.step_up_assertion_id <> v_authority.step_up_assertion_id
     or v_step.status <> 'CONSUMED'
     or v_step.consumed_by_authority_id <> v_authority.conversion_authority_id
     or v_step.assertion_version <> v_authority.step_up_assertion_version
     or v_step.canonical_user_id <> v_authority.actor_user_id
     or v_step.purpose <> v_authority.purpose
     or v_step.security_version <> v_control.security_version
     or v_step.session_version <> v_control.session_version
     or v_step.assurance_policy_version <> v_control.assurance_policy_version then
    raise exception 'AUTHORITY_SECURITY_BINDING_STALE';
  end if;
  if v_contact.crm_contact_id is null or v_contact.contact_status = 'ARCHIVED'
     or v_contact.contact_version <> v_request.source_contact_version
     or v_contact.contact_version <> v_authority.contact_version
     or v_case.consultation_case_id is null or v_case.status <> 'READY_FOR_CONVERSION'
     or v_case.conversion_state <> 'REVIEW_PENDING'
     or v_case.case_version <> v_request.source_case_version
     or v_case.case_version <> v_authority.case_version
     or v_case.active_assignment_id is distinct from v_assignment.assignment_id
     or v_assignment.assignment_id is null or v_assignment.assignment_status <> 'ACTIVE'
     or v_assignment.assignment_version <> v_request.source_assignment_version
     or v_assignment.assignment_version <> v_authority.assignment_version
     or v_assignment.assigned_consultant_user_id = v_authority.actor_user_id
     or v_request.requested_by_user_id = v_authority.actor_user_id then
    raise exception 'SOURCE_WORKFLOW_STATE_STALE';
  end if;
  select pg_catalog.count(*) into v_count from public.crm_conversion_action a
  where a.conversion_request_id = p_conversion_request_id and a.status = 'APPROVED';
  if v_count <> 3
     or v_student_action.status <> 'APPROVED'
     or v_guardian_action.status <> 'APPROVED'
     or v_relationship_action.status <> 'APPROVED'
     or v_student_action.source_candidate_student_id <> v_candidate.candidate_student_id
     or v_guardian_action.source_contact_id <> v_contact.crm_contact_id
     or v_relationship_action.student_action_id <> v_student_action.conversion_action_id
     or v_relationship_action.guardian_action_id <> v_guardian_action.conversion_action_id then
    raise exception 'APPROVED_ACTION_SET_STALE';
  end if;
  v_action_digest := public.f23_3e_p3d_internal_action_set_digest_versioned(
    p_conversion_request_id,'APPROVED',v_authority.p3_action_set_encoding_version
  );
  if v_action_digest is null or v_action_digest is distinct from v_authority.p3_action_set_digest
     or public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id,'REVIEW')
        is distinct from v_authority.review_set_digest
     or public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id,'RESERVATION')
        is distinct from v_authority.reservation_set_digest
     or public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id,'TARGET')
        is distinct from v_authority.target_set_digest then
    raise exception 'APPROVED_ACTION_SET_DIGEST_STALE';
  end if;
  if v_authority.p3_action_set_encoding_version=2 then
    v_reuse_code:=public.f23_3e_p3d_internal_validate_reuse_authorization_set(
      p_conversion_request_id,'APPROVED',false);
    if v_reuse_code<>'REUSE_AUTHORIZATION_SET_CURRENT' then
      raise exception using message=v_reuse_code,errcode='P0001';
    end if;
    v_reuse_authorization_set_digest:=public.f23_3e_p3d_internal_reuse_authorization_set_digest_v1(
      p_conversion_request_id,'ISSUED');
    if v_authority.p3_reuse_authorization_set_encoding_version<>1
       or v_authority.p3_reuse_authorization_set_digest is distinct from v_reuse_authorization_set_digest
       or exists(select 1 from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id
         and (a.reuse_authorization_set_encoding_version<>1
           or a.reuse_authorization_set_digest is distinct from v_reuse_authorization_set_digest)) then
      raise exception 'REUSE_AUTHORIZATION_SET_DIGEST_STALE';
    end if;
  elsif v_authority.p3_action_set_encoding_version<>1
     or v_authority.p3_reuse_authorization_set_encoding_version is not null
     or v_authority.p3_reuse_authorization_set_digest is not null then
    raise exception 'ACTION_SET_ENCODING_UNSUPPORTED';
  end if;
  if v_candidate.candidate_student_id is null
     or v_candidate.consultation_case_id <> v_request.consultation_case_id
     or v_candidate.candidate_status not in ('ACTIVE','REVIEW_REQUIRED')
     or v_candidate.candidate_version <> v_precheck.candidate_version
     or (v_student_action.action_kind<>'DO_NOT_CREATE_STUDENT' and not exists(select 1 from public.crm_identity_match_review r
       where r.center_id=v_request.center_id and r.match_review_id=v_student_action.match_review_id
         and r.candidate_student_id=v_candidate.candidate_student_id
         and r.source_candidate_version=v_candidate.candidate_version
         and r.review_version=2 and r.expires_at>v_now)) then
    raise exception 'CANDIDATE_STATE_STALE';
  end if;
  if v_student_action.action_kind <> 'DO_NOT_CREATE_STUDENT' then
    if extensions.digest(v_candidate.birth_evidence_protected,'sha256')
       is distinct from v_precheck.source_envelope_digest then
      raise exception 'CANDIDATE_BIRTH_SOURCE_STALE';
    end if;
    v_locked_birth := public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(
      v_request.center_id, v_request.consultation_case_id,
      v_candidate.candidate_student_id, v_candidate.candidate_version
    );
    if v_locked_birth is distinct from v_precheck.birth_date_evidence then
      raise exception 'CANDIDATE_BIRTH_SOURCE_STALE';
    end if;
  end if;

  perform pg_catalog.set_config('ichess.p3d_executor','on',true);
  perform pg_catalog.set_config('ichess.p3d_locked_identity_set_digest',
    pg_catalog.encode(v_locked_identity_mutex_set_digest,'hex'),true);
  update public.crm_conversion_request r set status = 'EXECUTING',
    request_version = r.request_version + 1, updated_at = v_now
  where r.conversion_request_id = p_conversion_request_id returning * into v_request;
  if v_student_action.action_kind = 'CREATE_NEW_STUDENT' then
    select * into strict v_student_result from public.f23_3e_p3d_internal_create_student_target_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_student_action.conversion_action_id,
      v_authority.actor_user_id,v_candidate.candidate_student_id,v_candidate.candidate_version,
      v_student_action.match_review_id,2,v_student_action.profile_creation_reservation_id,1,
      v_student_action.opaque_target_id,v_candidate.display_name_evidence,v_locked_birth,
      v_policy.identity_policy_registry_id,v_policy.normalization_version,v_policy.match_policy_version,
      v_policy.minimum_evidence_policy_version,v_locked_identity_mutex_set_digest
    );
    v_student_id := v_student_result.student_id;
    v_student_version := v_student_result.student_version;
    v_student_outcome := 'STUDENT_CREATED';
  elsif v_student_action.action_kind = 'REUSE_REVIEWED_STUDENT' then
    select * into strict v_reuse from public.f23_3e_p3d_internal_resolve_reusable_student_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_student_action.conversion_action_id,
      v_candidate.candidate_student_id,v_candidate.candidate_version,v_student_action.match_review_id,2,
      v_student_action.opaque_target_id,v_student_action.expected_target_version,
      v_student_action.reviewed_reuse_authorization_id,v_student_action.expected_reuse_authorization_version,
      v_locked_identity_mutex_set_digest
    );
    if not coalesce(v_reuse.reuse_eligible,false)
       then raise exception 'STUDENT_REUSE_BINDING_STALE'; end if;
    v_student_id := v_reuse.student_id; v_student_version := v_reuse.student_version;
    v_student_outcome := 'STUDENT_REUSED';
  elsif v_student_action.action_kind = 'DO_NOT_CREATE_STUDENT' then
    v_student_outcome := 'STUDENT_NOT_CREATED';
  else raise exception 'APPROVED_ACTION_SET_STALE'; end if;

  if v_guardian_action.action_kind = 'CREATE_NEW_GUARDIAN' then
    select * into strict v_guardian_result from public.f23_3e_p3d_internal_create_guardian_target_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_guardian_action.conversion_action_id,
      v_authority.actor_user_id,v_contact.crm_contact_id,v_contact.contact_version,
      v_guardian_action.match_review_id,2,v_guardian_action.profile_creation_reservation_id,1,
      v_guardian_action.opaque_target_id,v_guardian_policy.identity_policy_registry_id,
      v_guardian_policy.normalization_version,v_guardian_policy.match_policy_version,
      v_guardian_policy.minimum_evidence_policy_version,v_locked_identity_mutex_set_digest
    );
    v_guardian_id := v_guardian_result.guardian_id;
    v_guardian_version := v_guardian_result.guardian_version;
    v_guardian_outcome := 'GUARDIAN_CREATED';
  elsif v_guardian_action.action_kind = 'REUSE_REVIEWED_GUARDIAN' then
    select * into strict v_reuse from public.f23_3e_p3d_internal_resolve_reusable_guardian_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_guardian_action.conversion_action_id,
      v_contact.crm_contact_id,v_contact.contact_version,v_guardian_action.match_review_id,2,
      v_guardian_action.opaque_target_id,v_guardian_action.expected_target_version,
      v_guardian_action.reviewed_reuse_authorization_id,v_guardian_action.expected_reuse_authorization_version,
      v_locked_identity_mutex_set_digest
    );
    if not coalesce(v_reuse.reuse_eligible,false) then raise exception 'GUARDIAN_REUSE_BINDING_STALE'; end if;
    v_guardian_id := v_reuse.guardian_id; v_guardian_version := v_reuse.guardian_version;
    v_guardian_outcome := 'GUARDIAN_REUSED';
  elsif v_guardian_action.action_kind = 'DO_NOT_CREATE_GUARDIAN' then
    v_guardian_outcome := 'GUARDIAN_NOT_CREATED';
  else raise exception 'APPROVED_ACTION_SET_STALE'; end if;

  if v_relationship_action.action_kind = 'DO_NOT_CREATE_RELATIONSHIP' then
    if v_relationship_action.safe_reason_code is null then raise exception 'RELATIONSHIP_DECISION_REQUIRED'; end if;
    v_relationship_outcome := 'RELATIONSHIP_NOT_CREATED';
  else
    if v_student_id is null or v_guardian_id is null then raise exception 'RELATIONSHIP_ENDPOINT_INCOMPLETE'; end if;
    select * into strict v_relationship_result
    from public.f23_3e_p3d_internal_upsert_relationship_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_relationship_action.conversion_action_id,
      v_authority.actor_user_id,v_guardian_action.conversion_action_id,v_student_action.conversion_action_id,
      v_guardian_id,v_guardian_version,v_student_id,v_student_version,
      v_relationship_action.guardian_student_relationship_id,v_relationship_action.expected_relationship_version,
      v_relationship_action.relationship_scope_encoding_version,v_relationship_action.relationship_scope_digest,
      v_locked_identity_mutex_set_digest
    );
    v_relationship_id := v_relationship_result.relationship_id;
    v_relationship_version := v_relationship_result.relationship_version;
    v_relationship_outcome := v_relationship_result.outcome_code;
  end if;

  if v_student_action.action_kind <> 'DO_NOT_CREATE_STUDENT' then
    select * into strict v_binding_result
    from public.f23_3e_p3d_internal_commit_identity_target_binding_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_student_action.conversion_action_id,
      v_student_action.match_review_id,'STUDENT',case v_student_action.action_kind
        when 'CREATE_NEW_STUDENT' then 'CREATE_ORIGIN'
        when 'REUSE_REVIEWED_STUDENT' then case when v_student_action.reviewed_reuse_authorization_id is null
          then 'VERIFY_EXACT_SOURCE' else 'COMMIT_CROSS_SOURCE_REUSE' end end,
      v_request.source_contact_id,v_candidate.candidate_student_id,v_candidate.candidate_version,
      'canonical.student_profile.v1',v_student_id,v_student_version,
      v_student_action.reviewed_reuse_authorization_id,v_student_action.expected_reuse_authorization_version,
      v_locked_identity_mutex_set_digest);
  end if;
  if v_guardian_action.action_kind <> 'DO_NOT_CREATE_GUARDIAN' then
    select * into strict v_binding_result
    from public.f23_3e_p3d_internal_commit_identity_target_binding_no_relock(
      v_request.center_id,v_request.conversion_request_id,v_guardian_action.conversion_action_id,
      v_guardian_action.match_review_id,'GUARDIAN',case v_guardian_action.action_kind
        when 'CREATE_NEW_GUARDIAN' then 'CREATE_ORIGIN'
        when 'REUSE_REVIEWED_GUARDIAN' then case when v_guardian_action.reviewed_reuse_authorization_id is null
          then 'VERIFY_EXACT_SOURCE' else 'COMMIT_CROSS_SOURCE_REUSE' end end,
      v_contact.crm_contact_id,null,v_contact.contact_version,'canonical.guardian_profile.v1',
      v_guardian_id,v_guardian_version,v_guardian_action.reviewed_reuse_authorization_id,
      v_guardian_action.expected_reuse_authorization_version,v_locked_identity_mutex_set_digest);
  end if;

  perform pg_catalog.set_config('ichess.p3d_reservation_consume','on',true);
  update public.crm_profile_creation_reservation r set
    status = 'CONSUMED', reservation_version = r.reservation_version + 1,
    terminal_at = v_now, terminal_reason_code = 'CONSUMED_BY_FUTURE_EXECUTOR',
    updated_at = v_now
  from public.crm_conversion_action a
  where a.conversion_request_id = p_conversion_request_id
    and a.action_kind in ('CREATE_NEW_STUDENT','CREATE_NEW_GUARDIAN')
    and a.profile_creation_reservation_id = r.reservation_id and r.status = 'ACTIVE';
  get diagnostics v_count = row_count;
  if v_count <> (case when v_student_action.action_kind = 'CREATE_NEW_STUDENT' then 1 else 0 end
    + case when v_guardian_action.action_kind = 'CREATE_NEW_GUARDIAN' then 1 else 0 end) then
    raise exception 'RESERVATION_CONSUME_COUNT_STALE';
  end if;

  if v_student_action.action_kind <> 'DO_NOT_CREATE_STUDENT' then
    update public.consultation_case_candidate_student c set
      candidate_status = 'CONVERTED', candidate_version = c.candidate_version + 1,
      updated_at = v_now
    where c.candidate_student_id = v_candidate.candidate_student_id;
  end if;
  update public.consultation_case_assignment a set
    assignment_status = 'ENDED', assignment_version = a.assignment_version + 1,
    ended_at = v_now, end_reason = 'CASE_CONVERTED'
  where a.assignment_id = v_assignment.assignment_id;
  update public.consultation_case c set
    status = 'CONVERTED', conversion_state = 'COMPLETED',
    case_version = c.case_version + 1, active_assignment_id = null,
    closed_at = v_now, updated_at = v_now
  where c.consultation_case_id = v_case.consultation_case_id returning * into v_case;

  v_action_results := (
    select pg_catalog.jsonb_agg(x.item order by x.action_id) from (
      select v_student_action.conversion_action_id action_id,
        pg_catalog.jsonb_build_object(
          'action_id',v_student_action.conversion_action_id,'action_kind',v_student_action.action_kind,
          'action_version',v_student_action.action_version + 1,'outcome_code',v_student_outcome,
          'target_id',v_student_id,'target_version',v_student_version
        ) item
      union all
      select v_guardian_action.conversion_action_id,
        pg_catalog.jsonb_build_object(
          'action_id',v_guardian_action.conversion_action_id,'action_kind',v_guardian_action.action_kind,
          'action_version',v_guardian_action.action_version + 1,'outcome_code',v_guardian_outcome,
          'target_id',v_guardian_id,'target_version',v_guardian_version
        )
      union all
      select v_relationship_action.conversion_action_id,
        pg_catalog.jsonb_build_object(
          'action_id',v_relationship_action.conversion_action_id,'action_kind',v_relationship_action.action_kind,
          'action_version',v_relationship_action.action_version + 1,'outcome_code',v_relationship_outcome,
          'target_id',v_relationship_id,'target_version',v_relationship_version
        )
    ) x
  );
  update public.crm_conversion_action a set
    status = 'EXECUTED', action_version = a.action_version + 1, updated_at = v_now
  where a.conversion_request_id = p_conversion_request_id and a.status = 'APPROVED';
  get diagnostics v_count = row_count;
  if v_count <> 3 then raise exception 'ACTION_EXECUTION_COUNT_STALE'; end if;

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version',1,'result_type','REAL_CONVERSION',
    'resource_id',p_conversion_request_id,'resource_version',v_request.request_version + 1,
    'resource_status','COMPLETED','request_id',p_conversion_request_id,
    'request_version',v_request.request_version + 1,
    'consultation_case_id',v_case.consultation_case_id,'case_version',v_case.case_version,
    'conversion_authority_id',v_authority.conversion_authority_id,
    'authority_status','CONSUMED','authority_version',v_authority.authority_version + 1,
    'executed_action_results',v_action_results,'correlation_id',v_correlation_id,
    'outcome_code','REAL_CONVERSION_COMPLETED'
  );
  if not public.f23_3e_p3b_internal_is_safe_result_snapshot(v_snapshot) then
    raise exception 'REAL_CONVERSION_RESULT_INVALID';
  end if;
  v_terminal_digest := extensions.digest(pg_catalog.convert_to(v_snapshot::text,'UTF8'),'sha256');
  update public.crm_conversion_request r set
    status = 'COMPLETED', request_version = r.request_version + 1,
    terminal_outcome_digest = v_terminal_digest, updated_at = v_now
  where r.conversion_request_id = p_conversion_request_id returning * into v_request;
  for v_row in
    select z.* from public.crm_reviewed_cross_source_reuse_authorization z
    where z.conversion_request_id=p_conversion_request_id and z.status='ISSUED'
    order by z.reviewed_reuse_authorization_id
  loop
    update public.crm_reviewed_cross_source_reuse_authorization z set status='CONSUMED',
      authorization_version=2,terminal_reason_code='real_conversion_completed',
      consumed_idempotency_record_id=v_registry.idempotency_record_id
    where z.reviewed_reuse_authorization_id=v_row.reviewed_reuse_authorization_id;
    perform public.f23_3e_p3b_internal_append_audit_outbox(
      v_request.center_id,'crm.identity.cross_source_reuse_authorization.consumed',
      v_authority.actor_user_id,'crm_reviewed_cross_source_reuse_authorization',
      v_row.reviewed_reuse_authorization_id,v_request.conversion_request_id,
      v_assignment.assignment_id,1,2,'CONSUMED','real_conversion_completed',
      'crm.real_conversion.execute','CROSS_SOURCE_REUSE_AUTHORIZATION_CONSUMED',v_correlation_id);
  end loop;
  update public.crm_conversion_authority a set
    status = 'CONSUMED', authority_version = a.authority_version + 1,
    terminal_at = v_now, terminal_reason_code = 'conversion_completed',
    consumed_idempotency_record_id = v_registry.idempotency_record_id,
    updated_at = v_now
  where a.conversion_authority_id = p_conversion_authority_id returning * into v_authority;

  if v_student_action.action_kind = 'CREATE_NEW_STUDENT' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,'crm.student.created_from_conversion',v_authority.actor_user_id,
      'student_profile',v_student_id,v_request.conversion_request_id,v_assignment.assignment_id,
      null,1,'ACTIVE','real_conversion_completed','STUDENT_CREATED',v_correlation_id
    );
  elsif v_student_action.action_kind = 'REUSE_REVIEWED_STUDENT' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,'crm.student.reused_for_conversion',v_authority.actor_user_id,
      'crm_conversion_action',v_student_action.conversion_action_id,
      v_request.conversion_request_id,v_assignment.assignment_id,
      v_student_action.action_version,v_student_action.action_version + 1,
      'EXECUTED','reviewed_reuse','STUDENT_REUSED',v_correlation_id
    );
  end if;
  if v_guardian_action.action_kind = 'CREATE_NEW_GUARDIAN' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,'crm.guardian.created_from_conversion',v_authority.actor_user_id,
      'guardian_profile',v_guardian_id,v_request.conversion_request_id,v_assignment.assignment_id,
      null,1,'ACTIVE','real_conversion_completed','GUARDIAN_CREATED',v_correlation_id
    );
  elsif v_guardian_action.action_kind = 'REUSE_REVIEWED_GUARDIAN' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,'crm.guardian.reused_for_conversion',v_authority.actor_user_id,
      'crm_conversion_action',v_guardian_action.conversion_action_id,
      v_request.conversion_request_id,v_assignment.assignment_id,
      v_guardian_action.action_version,v_guardian_action.action_version + 1,
      'EXECUTED','reviewed_reuse','GUARDIAN_REUSED',v_correlation_id
    );
  end if;
  if v_relationship_action.action_kind <> 'DO_NOT_CREATE_RELATIONSHIP' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,
      case v_relationship_action.action_kind
        when 'CREATE_RELATIONSHIP' then 'crm.guardian_student_relationship.created'
        when 'REUSE_EXISTING_RELATIONSHIP' then 'crm.guardian_student_relationship.reused'
        else 'crm.guardian_student_relationship.updated' end,
      v_authority.actor_user_id,
      case when v_relationship_action.action_kind = 'REUSE_EXISTING_RELATIONSHIP'
        then 'crm_conversion_action' else 'guardian_student_relationship' end,
      case when v_relationship_action.action_kind = 'REUSE_EXISTING_RELATIONSHIP'
        then v_relationship_action.conversion_action_id else v_relationship_id end,
      v_request.conversion_request_id,v_assignment.assignment_id,
      case when v_relationship_action.action_kind = 'REUSE_EXISTING_RELATIONSHIP'
          then v_relationship_action.action_version
        when v_relationship_action.action_kind = 'UPDATE_APPROVED_RELATIONSHIP_ROLE'
          then v_relationship_version - 1 else null end,
      case when v_relationship_action.action_kind = 'CREATE_RELATIONSHIP' then 1
        when v_relationship_action.action_kind = 'REUSE_EXISTING_RELATIONSHIP'
          then v_relationship_action.action_version + 1
        when v_relationship_action.action_kind = 'UPDATE_APPROVED_RELATIONSHIP_ROLE'
          then v_relationship_version else null end,
      'ACTIVE','real_conversion_completed',v_relationship_outcome,v_correlation_id
    );
  end if;
  if v_student_action.action_kind <> 'DO_NOT_CREATE_STUDENT' then
    perform public.f23_3e_p3d_internal_append_event(
      v_request.center_id,'crm.candidate.converted',v_authority.actor_user_id,
      'consultation_case_candidate_student',v_candidate.candidate_student_id,
      v_request.conversion_request_id,v_assignment.assignment_id,
      v_candidate.candidate_version,v_candidate.candidate_version + 1,'CONVERTED',
      'real_conversion_completed','CANDIDATE_CONVERTED',v_correlation_id
    );
  end if;
  perform public.f23_3e_p3d_internal_append_event(
    v_request.center_id,'crm.assignment.ended',v_authority.actor_user_id,
    'consultation_case_assignment',v_assignment.assignment_id,v_request.conversion_request_id,
    v_assignment.assignment_id,v_assignment.assignment_version,v_assignment.assignment_version + 1,
    'ENDED','CASE_CONVERTED','ASSIGNMENT_ENDED',v_correlation_id
  );
  perform public.f23_3e_p3d_internal_append_event(
    v_request.center_id,'crm.case.converted',v_authority.actor_user_id,
    'consultation_case',v_case.consultation_case_id,v_request.conversion_request_id,
    v_assignment.assignment_id,v_case.case_version - 1,v_case.case_version,'CONVERTED',
    'real_conversion_completed','CASE_CONVERTED',v_correlation_id
  );
  perform public.f23_3e_p3d_internal_append_event(
    v_request.center_id,'crm.conversion.authority_consumed',v_authority.actor_user_id,
    'crm_conversion_authority',v_authority.conversion_authority_id,v_request.conversion_request_id,
    v_assignment.assignment_id,v_authority.authority_version - 1,v_authority.authority_version,
    'CONSUMED','conversion_completed','CONVERSION_AUTHORITY_CONSUMED',v_correlation_id
  );
  perform public.f23_3e_p3d_internal_append_event(
    v_request.center_id,'crm.conversion.completed',v_authority.actor_user_id,
    'crm_conversion_request',v_request.conversion_request_id,v_request.conversion_request_id,
    v_assignment.assignment_id,v_request.request_version - 1,v_request.request_version,
    'COMPLETED','real_conversion_completed','REAL_CONVERSION_COMPLETED',v_correlation_id
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED', terminal_outcome_digest = v_terminal_digest,
    idempotency_version = i.idempotency_version + 1, completed_at = v_now,
    p3_action_set_encoding_version = v_authority.p3_action_set_encoding_version,
    p3_action_set_digest = v_action_digest,
    p3_reuse_authorization_set_encoding_version = v_authority.p3_reuse_authorization_set_encoding_version,
    p3_reuse_authorization_set_digest = v_authority.p3_reuse_authorization_set_digest,
    p3_result_kind = 'REAL_CONVERSION',
    p3_result_outcome_code = 'REAL_CONVERSION_COMPLETED',
    p3_result_snapshot = v_snapshot, p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;

  return query select true,'REAL_CONVERSION_COMPLETED',false,
    v_request.conversion_request_id,v_request.status,v_request.request_version,
    v_case.consultation_case_id,v_case.case_version,
    v_authority.conversion_authority_id,v_authority.status,v_authority.authority_version,
    v_action_results,v_correlation_id;
exception when others then
  return query select false,
    case when sqlerrm in (
      'IDEMPOTENCY_CONFLICT','AUTHORITY_NOT_AVAILABLE','AUTHORITY_SECURITY_BINDING_STALE',
      'AUTHORITY_OR_REQUEST_STALE','CONVERSION_POLICY_VERSION_STALE',
      'SOURCE_WORKFLOW_STATE_STALE','APPROVED_ACTION_SET_STALE',
      'APPROVED_ACTION_SET_DIGEST_STALE','CANDIDATE_STATE_STALE',
      'CANDIDATE_BIRTH_SOURCE_UNAVAILABLE','CANDIDATE_BIRTH_SOURCE_STALE',
      'IDENTITY_POLICY_STALE','IDENTITY_MUTEX_STALE','STUDENT_REUSE_BINDING_STALE',
      'GUARDIAN_REUSE_BINDING_STALE','RELATIONSHIP_DECISION_REQUIRED',
      'RELATIONSHIP_ENDPOINT_INCOMPLETE','CREATE_BINDING_EVIDENCE_STALE',
      'CREATE_BINDING_CONFLICT','RESERVATION_CONSUME_COUNT_STALE'
      ,'IDENTITY_MUTEX_SET_STALE','EXECUTOR_LOCK_PRECONDITION_FAILED',
      'CREATE_STUDENT_TARGET_EVIDENCE_STALE','CREATE_GUARDIAN_TARGET_EVIDENCE_STALE',
      'STUDENT_REUSE_AUTHORIZATION_STALE','GUARDIAN_REUSE_AUTHORIZATION_STALE',
      'REUSE_AUTHORIZATION_STALE','REUSE_AUTHORIZATION_SET_DIGEST_STALE',
      'REUSE_AUTHORIZATION_SET_INVALID','RELATIONSHIP_SCOPE_STALE',
      'RELATIONSHIP_SCOPE_ENCODING_UNSUPPORTED','RELATIONSHIP_ENDPOINT_STALE',
      'RELATIONSHIP_VERSION_STALE','BINDING_CONFLICT','BINDING_EVIDENCE_STALE',
      'ACTION_SET_ENCODING_UNSUPPORTED','P3D_LOCAL_QA_BARRIER_INVALID'
    ) then sqlerrm else 'REAL_CONVERSION_FAILED' end,
    false,p_conversion_request_id,null::text,null::integer,null::uuid,null::integer,
    p_conversion_authority_id,null::text,null::integer,null::jsonb,null::uuid;
end;
$f23_3e_p3d_execute_conversion$;

create function public.f23_3e_p3d_read_conversion_result_status(
  p_conversion_request_id uuid,
  p_idempotency_key_digest bytea
)
returns table(ok boolean, outcome_code text, immutable_real_conversion_result jsonb)
language plpgsql stable security definer set search_path = ''
as $f23_3e_p3d_read_conversion_result_status$
declare
  v_registry public.crm_idempotency_registry%rowtype;
begin
  if p_conversion_request_id is null or p_idempotency_key_digest is null
     or pg_catalog.octet_length(p_idempotency_key_digest) <> 32 then
    return query select false,'INVALID_INPUT',null::jsonb; return;
  end if;
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'crm.real_conversion.execute'
    and i.idempotency_key_digest = p_idempotency_key_digest
    and i.status = 'COMPLETED' and i.p3_result_kind = 'REAL_CONVERSION';
  if not found then
    return query select false,'RESOURCE_NOT_AVAILABLE',null::jsonb; return;
  end if;
  return query select true,v_registry.p3_result_outcome_code,v_registry.p3_result_snapshot;
end;
$f23_3e_p3d_read_conversion_result_status$;

-- -------------------------------------------------------------------------
-- P3D-R0 reviewed cross-source reuse remediation.
-- This migration is still pre-checkpoint.  The block below forward-extends
-- the frozen P2/P3 runtime without changing any inherited migration bytes.
-- -------------------------------------------------------------------------

alter table public.crm_identity_match_review
  add column reviewer_membership_id uuid,
  add column reviewer_membership_version integer,
  add column reviewer_role text,
  add column reviewer_assignment_id uuid,
  add column reviewer_assignment_version integer,
  add column supporting_identity_target_binding_id uuid,
  add column supporting_binding_version integer;

alter table public.crm_conversion_action
  add column action_set_encoding_version integer not null default 1,
  add column reviewed_reuse_authorization_id uuid,
  add column expected_reuse_authorization_version integer,
  add column relationship_scope_encoding_version integer,
  add column relationship_scope_digest bytea,
  add column reuse_authorization_set_encoding_version integer,
  add column reuse_authorization_set_digest bytea;

alter table public.crm_conversion_authority
  add column p3_reuse_authorization_set_encoding_version integer,
  add column p3_reuse_authorization_set_digest bytea;

alter table public.crm_idempotency_registry
  add column p3_reuse_authorization_set_encoding_version integer,
  add column p3_reuse_authorization_set_digest bytea;

alter table public.crm_identity_target_binding
  add column reviewed_reuse_authorization_id uuid;

create table public.crm_reviewed_cross_source_reuse_authorization (
  reviewed_reuse_authorization_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  identity_kind text not null check (identity_kind in ('STUDENT','GUARDIAN')),
  conversion_request_id uuid not null,
  reviewed_request_version integer not null check (reviewed_request_version >= 1),
  p2_action_id uuid not null,
  action_intent_digest bytea not null check (pg_catalog.octet_length(action_intent_digest)=32),
  legacy_request_action_graph_digest bytea not null check (pg_catalog.octet_length(legacy_request_action_graph_digest)=32),
  source_contact_id uuid,
  source_contact_version integer,
  source_candidate_student_id uuid,
  source_candidate_version integer,
  consultation_case_id uuid not null,
  source_case_version integer not null check (source_case_version >= 1),
  match_review_id uuid not null,
  review_version integer not null check (review_version >= 1),
  reviewed_by_actor_user_id uuid not null,
  reviewed_at timestamptz not null,
  reviewer_membership_id uuid not null,
  reviewer_membership_version integer not null check (reviewer_membership_version >= 1),
  reviewer_role text not null check (reviewer_role in ('owner','center_admin','consultant')),
  reviewer_assignment_id uuid,
  reviewer_assignment_version integer,
  target_adapter_namespace text not null check (target_adapter_namespace in ('canonical.student_profile.v1','canonical.guardian_profile.v1')),
  opaque_target_id uuid not null,
  expected_target_version integer not null check (expected_target_version >= 1),
  supporting_identity_target_binding_id uuid not null,
  supporting_binding_version integer not null check (supporting_binding_version >= 1),
  supporting_binding_source_version integer not null check (supporting_binding_source_version >= 1),
  supporting_binding_target_version integer not null check (supporting_binding_target_version >= 1),
  identity_policy_registry_id uuid not null,
  normalization_version integer not null check (normalization_version >= 1),
  match_policy_version integer not null check (match_policy_version >= 1),
  minimum_evidence_policy_version integer not null check (minimum_evidence_policy_version >= 1),
  identity_environment_fingerprint bytea not null check (pg_catalog.octet_length(identity_environment_fingerprint)=32),
  evidence_set_digest bytea not null check (pg_catalog.octet_length(evidence_set_digest)=32),
  identity_mutex_keys_digest bytea not null check (pg_catalog.octet_length(identity_mutex_keys_digest)=32),
  projection_snapshot_digest bytea not null check (pg_catalog.octet_length(projection_snapshot_digest)=32),
  conversion_action_id uuid not null,
  relationship_scope_encoding_version integer,
  relationship_scope_digest bytea,
  related_student_target_id uuid,
  related_student_expected_version integer,
  related_student_disposition text,
  status text not null default 'ISSUED' check (status in ('ISSUED','CONSUMED','INVALIDATED')),
  authorization_version integer not null default 1 check (authorization_version >= 1),
  issued_at timestamptz not null default pg_catalog.transaction_timestamp(),
  expires_at timestamptz not null,
  terminal_at timestamptz,
  terminal_reason_code text,
  consumed_idempotency_record_id uuid,
  invalidated_by_operation text,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_reviewed_reuse_authorization_source_shape_check check (
    (identity_kind='STUDENT' and source_contact_id is not null and source_contact_version is not null
      and source_candidate_student_id is not null and source_candidate_version is not null
      and target_adapter_namespace='canonical.student_profile.v1')
    or
    (identity_kind='GUARDIAN' and source_contact_id is not null and source_contact_version is not null
      and source_candidate_student_id is null and source_candidate_version is null
      and target_adapter_namespace='canonical.guardian_profile.v1')
  ),
  constraint crm_reviewed_reuse_authorization_reviewer_shape_check check (
    (reviewer_role in ('owner','center_admin') and reviewer_assignment_id is null and reviewer_assignment_version is null)
    or (reviewer_role='consultant' and reviewer_assignment_id is not null and reviewer_assignment_version is not null)
  ),
  constraint crm_reviewed_reuse_authorization_scope_shape_check check (
    (identity_kind='STUDENT' and relationship_scope_encoding_version is null and relationship_scope_digest is null
      and related_student_target_id is null and related_student_expected_version is null and related_student_disposition is null)
    or
    (identity_kind='GUARDIAN' and relationship_scope_encoding_version=1
      and pg_catalog.octet_length(relationship_scope_digest)=32
      and related_student_target_id is not null and related_student_expected_version >= 1
      and related_student_disposition in ('CREATE','REUSE','NONE'))
  ),
  constraint crm_reviewed_reuse_authorization_lifecycle_shape_check check (
    (status='ISSUED' and authorization_version=1 and terminal_at is null
      and terminal_reason_code is null and consumed_idempotency_record_id is null and invalidated_by_operation is null)
    or
    (status='CONSUMED' and authorization_version=2 and terminal_at is not null
      and terminal_reason_code='real_conversion_completed' and consumed_idempotency_record_id is not null
      and invalidated_by_operation is null)
    or
    (status='INVALIDATED' and authorization_version=2 and terminal_at is not null
      and terminal_reason_code in ('authorization_expired','review_or_source_stale','target_or_support_stale',
        'relationship_scope_stale','plan_superseded','conversion_authority_terminal')
      and consumed_idempotency_record_id is null and invalidated_by_operation is not null)
  ),
  constraint crm_reviewed_reuse_authorization_time_check check (expires_at > issued_at),
  constraint crm_reviewed_reuse_authorization_center_fk foreign key (center_id)
    references public.center_crm_control(center_id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_request_fk foreign key (center_id,conversion_request_id)
    references public.crm_conversion_request(center_id,conversion_request_id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_review_fk foreign key (center_id,match_review_id)
    references public.crm_identity_match_review(center_id,match_review_id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_support_fk foreign key (center_id,supporting_identity_target_binding_id)
    references public.crm_identity_target_binding(center_id,identity_target_binding_id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_membership_fk foreign key (reviewer_membership_id)
    references public.center_members(id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_assignment_fk foreign key (reviewer_assignment_id)
    references public.consultation_case_assignment(assignment_id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_reviewer_user_fk foreign key (reviewed_by_actor_user_id)
    references auth.users(id) on delete restrict,
  constraint crm_reviewed_reuse_authorization_action_fk foreign key (conversion_action_id)
    references public.crm_conversion_action(conversion_action_id) deferrable initially deferred,
  constraint crm_reviewed_reuse_authorization_consumed_registry_fk foreign key (consumed_idempotency_record_id)
    references public.crm_idempotency_registry(idempotency_record_id) on delete restrict
);

create unique index crm_reviewed_reuse_authorization_student_issued_source_uidx
  on public.crm_reviewed_cross_source_reuse_authorization(center_id,source_candidate_student_id)
  where identity_kind='STUDENT' and status='ISSUED';
create unique index crm_reviewed_reuse_authorization_guardian_issued_source_uidx
  on public.crm_reviewed_cross_source_reuse_authorization(center_id,source_contact_id)
  where identity_kind='GUARDIAN' and status='ISSUED';
create unique index crm_reviewed_reuse_authorization_issued_request_kind_uidx
  on public.crm_reviewed_cross_source_reuse_authorization(center_id,conversion_request_id,identity_kind)
  where status='ISSUED';
create index crm_reviewed_reuse_authorization_target_idx
  on public.crm_reviewed_cross_source_reuse_authorization(center_id,identity_kind,opaque_target_id,status);

alter table public.crm_conversion_action
  add constraint crm_conversion_action_reuse_authorization_fk
  foreign key (reviewed_reuse_authorization_id)
  references public.crm_reviewed_cross_source_reuse_authorization(reviewed_reuse_authorization_id)
  deferrable initially deferred;
alter table public.crm_identity_target_binding
  add constraint crm_identity_target_binding_reuse_authorization_fk
  foreign key (reviewed_reuse_authorization_id)
  references public.crm_reviewed_cross_source_reuse_authorization(reviewed_reuse_authorization_id)
  on delete restrict;
alter table public.crm_identity_match_review
  add constraint crm_identity_match_review_supporting_binding_fk
  foreign key (center_id,supporting_identity_target_binding_id)
  references public.crm_identity_target_binding(center_id,identity_target_binding_id)
  on delete restrict,
  add constraint crm_identity_match_review_reviewer_membership_fk
  foreign key (reviewer_membership_id) references public.center_members(id) on delete restrict,
  add constraint crm_identity_match_review_reviewer_assignment_fk
  foreign key (reviewer_assignment_id) references public.consultation_case_assignment(assignment_id) on delete restrict;

alter table public.crm_conversion_action
  add constraint crm_conversion_action_encoding_shape_check check (
    (action_set_encoding_version=1 and reviewed_reuse_authorization_id is null
      and expected_reuse_authorization_version is null
      and relationship_scope_encoding_version is null and relationship_scope_digest is null
      and reuse_authorization_set_encoding_version is null and reuse_authorization_set_digest is null)
    or
    (action_set_encoding_version=2
      and reuse_authorization_set_encoding_version=1
      and pg_catalog.octet_length(reuse_authorization_set_digest)=32
      and ((reviewed_reuse_authorization_id is null and expected_reuse_authorization_version is null)
        or (reviewed_reuse_authorization_id is not null and expected_reuse_authorization_version=1))
      and ((relationship_scope_encoding_version is null and relationship_scope_digest is null)
        or (relationship_scope_encoding_version=1 and pg_catalog.octet_length(relationship_scope_digest)=32)))
  ) not valid;
alter table public.crm_conversion_action validate constraint crm_conversion_action_encoding_shape_check;

alter table public.crm_conversion_authority
  add constraint crm_conversion_authority_reuse_set_shape_check check (
    (p3_action_set_encoding_version=1 and p3_reuse_authorization_set_encoding_version is null
      and p3_reuse_authorization_set_digest is null)
    or
    (p3_action_set_encoding_version=2 and p3_reuse_authorization_set_encoding_version=1
      and pg_catalog.octet_length(p3_reuse_authorization_set_digest)=32)
  ) not valid;
alter table public.crm_conversion_authority validate constraint crm_conversion_authority_reuse_set_shape_check;

alter table public.crm_idempotency_registry
  add constraint crm_idempotency_registry_reuse_set_shape_check check (
    (p3_reuse_authorization_set_encoding_version is null and p3_reuse_authorization_set_digest is null)
    or (p3_reuse_authorization_set_encoding_version=1
      and pg_catalog.octet_length(p3_reuse_authorization_set_digest)=32)
  ) not valid;
alter table public.crm_idempotency_registry validate constraint crm_idempotency_registry_reuse_set_shape_check;

alter table public.crm_reviewed_cross_source_reuse_authorization enable row level security;
alter table public.crm_reviewed_cross_source_reuse_authorization force row level security;
revoke all on table public.crm_reviewed_cross_source_reuse_authorization
  from public, anon, authenticated, service_role;

create unique index crm_outbox_event_p3d_reuse_authorization_version_uidx
  on public.crm_outbox_event(center_id,aggregate_kind,aggregate_id,event_version)
  where aggregate_kind='crm_reviewed_cross_source_reuse_authorization';

create function public.f23_3e_p3d_internal_guard_reuse_authorization()
returns trigger language plpgsql set search_path=''
as $f23_3e_p3d_internal_guard_reuse_authorization$
begin
  if tg_op='INSERT' then
    if new.status<>'ISSUED' or new.authorization_version<>1 then
      raise exception 'REUSE_AUTHORIZATION_LIFECYCLE_INVALID';
    end if;
    new.issued_at:=pg_catalog.transaction_timestamp();
    new.created_at:=new.issued_at;
    new.updated_at:=new.issued_at;
    return new;
  end if;
  if old.status<>'ISSUED' or old.authorization_version<>1
     or new.status not in ('CONSUMED','INVALIDATED') or new.authorization_version<>2 then
    raise exception 'REUSE_AUTHORIZATION_LIFECYCLE_INVALID';
  end if;
  if new.reviewed_reuse_authorization_id is distinct from old.reviewed_reuse_authorization_id
     or new.center_id is distinct from old.center_id or new.identity_kind is distinct from old.identity_kind
     or new.conversion_request_id is distinct from old.conversion_request_id
     or new.reviewed_request_version is distinct from old.reviewed_request_version
     or new.p2_action_id is distinct from old.p2_action_id
     or new.action_intent_digest is distinct from old.action_intent_digest
     or new.legacy_request_action_graph_digest is distinct from old.legacy_request_action_graph_digest
     or new.source_contact_id is distinct from old.source_contact_id
     or new.source_contact_version is distinct from old.source_contact_version
     or new.source_candidate_student_id is distinct from old.source_candidate_student_id
     or new.source_candidate_version is distinct from old.source_candidate_version
     or new.consultation_case_id is distinct from old.consultation_case_id
     or new.source_case_version is distinct from old.source_case_version
     or new.match_review_id is distinct from old.match_review_id
     or new.review_version is distinct from old.review_version
     or new.reviewed_by_actor_user_id is distinct from old.reviewed_by_actor_user_id
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewer_membership_id is distinct from old.reviewer_membership_id
     or new.reviewer_membership_version is distinct from old.reviewer_membership_version
     or new.reviewer_role is distinct from old.reviewer_role
     or new.reviewer_assignment_id is distinct from old.reviewer_assignment_id
     or new.reviewer_assignment_version is distinct from old.reviewer_assignment_version
     or new.target_adapter_namespace is distinct from old.target_adapter_namespace
     or new.opaque_target_id is distinct from old.opaque_target_id
     or new.expected_target_version is distinct from old.expected_target_version
     or new.supporting_identity_target_binding_id is distinct from old.supporting_identity_target_binding_id
     or new.supporting_binding_version is distinct from old.supporting_binding_version
     or new.supporting_binding_source_version is distinct from old.supporting_binding_source_version
     or new.supporting_binding_target_version is distinct from old.supporting_binding_target_version
     or new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
     or new.normalization_version is distinct from old.normalization_version
     or new.match_policy_version is distinct from old.match_policy_version
     or new.minimum_evidence_policy_version is distinct from old.minimum_evidence_policy_version
     or new.identity_environment_fingerprint is distinct from old.identity_environment_fingerprint
     or new.evidence_set_digest is distinct from old.evidence_set_digest
     or new.identity_mutex_keys_digest is distinct from old.identity_mutex_keys_digest
     or new.projection_snapshot_digest is distinct from old.projection_snapshot_digest
     or new.conversion_action_id is distinct from old.conversion_action_id
     or new.relationship_scope_encoding_version is distinct from old.relationship_scope_encoding_version
     or new.relationship_scope_digest is distinct from old.relationship_scope_digest
     or new.related_student_target_id is distinct from old.related_student_target_id
     or new.related_student_expected_version is distinct from old.related_student_expected_version
     or new.related_student_disposition is distinct from old.related_student_disposition
     or new.issued_at is distinct from old.issued_at or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'REUSE_AUTHORIZATION_BINDING_IMMUTABLE';
  end if;
  new.terminal_at:=pg_catalog.transaction_timestamp();
  new.updated_at:=new.terminal_at;
  return new;
end;
$f23_3e_p3d_internal_guard_reuse_authorization$;

create trigger crm_reviewed_reuse_authorization_guard
before insert or update on public.crm_reviewed_cross_source_reuse_authorization
for each row execute function public.f23_3e_p3d_internal_guard_reuse_authorization();

create function public.f23_3e_p3d_internal_select_support_binding(
  p_center_id text,
  p_identity_kind text,
  p_target_id uuid,
  p_expected_target_version integer,
  p_source_contact_id uuid,
  p_source_candidate_student_id uuid
)
returns table(
  identity_target_binding_id uuid,
  binding_version integer,
  source_version_at_binding integer,
  target_version_at_binding integer
)
language sql stable security definer set search_path=''
as $f23_3e_p3d_internal_select_support_binding$
  select b.identity_target_binding_id,b.binding_version,
         b.source_version_at_binding,b.target_version_at_binding
  from public.crm_identity_target_binding b
  join public.crm_conversion_request r
    on r.center_id=b.center_id and r.conversion_request_id=b.originating_request_id
  join public.crm_conversion_action a
    on a.center_id=b.center_id and a.conversion_action_id=b.originating_action_id
  where b.center_id=p_center_id
    and b.identity_kind=p_identity_kind
    and b.binding_status='ACTIVE'
    and b.target_version_at_binding=p_expected_target_version
    and ((p_identity_kind='STUDENT' and b.student_id=p_target_id
          and b.source_candidate_student_id is distinct from p_source_candidate_student_id)
      or (p_identity_kind='GUARDIAN' and b.guardian_id=p_target_id
          and b.source_contact_id is distinct from p_source_contact_id))
    and r.status='COMPLETED'
    and a.status='EXECUTED'
    and a.conversion_request_id=r.conversion_request_id
  order by b.created_at asc,b.identity_target_binding_id asc
  limit 1
$f23_3e_p3d_internal_select_support_binding$;

alter function public.f23_3e_p2b_internal_search_masked_candidates(
  uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,
  integer,integer,integer,integer,integer,uuid,integer
) rename to f23_3e_p3d_internal_r0_checkpoint_search_masked_candidates;

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
returns jsonb language plpgsql security definer set search_path=''
as $f23_3e_p2b_internal_search_masked_candidates$
declare
  v_result jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_center_id text;
  v_source_contact_id uuid;
  v_exact_binding boolean;
  v_support record;
  v_mode text;
begin
  v_result:=public.f23_3e_p3d_internal_r0_checkpoint_search_masked_candidates(
    p_conversion_request_id,p_actor_user_id,p_expected_request_version,p_identity_kind,
    p_candidate_student_id,p_expected_contact_version,p_expected_case_version,
    p_expected_candidate_version,p_display_name_evidence,p_birth_date_evidence,
    p_birth_year_evidence,p_expected_normalization_version,p_expected_match_policy_version,
    p_expected_minimum_evidence_policy_version,p_expected_policy_registry_version,
    p_expected_adapter_version,p_detail_opaque_candidate_id,p_expected_target_version
  );
  if coalesce((v_result->>'ok')::boolean,false) is not true
     or p_identity_kind not in ('STUDENT','GUARDIAN') then
    return v_result;
  end if;
  select r.center_id,r.source_contact_id into v_center_id,v_source_contact_id
  from public.crm_conversion_request r
  where r.conversion_request_id=p_conversion_request_id;
  for v_candidate in select value from pg_catalog.jsonb_array_elements(coalesce(v_result->'candidates','[]'::jsonb))
  loop
    v_mode:='NONE';
    v_exact_binding:=false;
    if v_candidate->>'target_adapter_namespace' in ('canonical.student_profile.v1','canonical.guardian_profile.v1') then
      select exists(
        select 1 from public.crm_identity_target_binding b
        where b.center_id=v_center_id and b.identity_kind=p_identity_kind and b.binding_status='ACTIVE'
          and b.target_version_at_binding=(v_candidate->>'target_version')::integer
          and ((p_identity_kind='STUDENT' and b.student_id=(v_candidate->>'opaque_target_id')::uuid
                and b.source_candidate_student_id=p_candidate_student_id
                and b.source_version_at_binding=p_expected_candidate_version)
            or (p_identity_kind='GUARDIAN' and b.guardian_id=(v_candidate->>'opaque_target_id')::uuid
                and b.source_contact_id=v_source_contact_id
                and b.source_version_at_binding=p_expected_contact_version))
      ) into v_exact_binding;
      if v_exact_binding then
        v_mode:='EXACT_SOURCE_ACTIVE_BINDING';
      else
        select * into v_support
        from public.f23_3e_p3d_internal_select_support_binding(
          v_center_id,p_identity_kind,(v_candidate->>'opaque_target_id')::uuid,
          (v_candidate->>'target_version')::integer,v_source_contact_id,p_candidate_student_id
        );
        if found then v_mode:='CROSS_SOURCE_EXPLICIT_REVIEW'; end if;
      end if;
    end if;
    v_candidate:=v_candidate || pg_catalog.jsonb_build_object(
      'reuse_review_mode',v_mode,
      'explicit_human_review_required',true,
      -- Internal P2C consumes this boolean. External wrappers scrub it for
      -- cross-source candidates before returning the masked response.
      'reuse_eligible',v_exact_binding or v_mode='CROSS_SOURCE_EXPLICIT_REVIEW'
    );
    v_candidates:=v_candidates||pg_catalog.jsonb_build_array(v_candidate);
  end loop;
  return pg_catalog.jsonb_set(v_result,'{candidates}',v_candidates,true);
end;
$f23_3e_p2b_internal_search_masked_candidates$;

create function public.f23_3e_p3d_internal_scrub_cross_source_search(p_result jsonb)
returns jsonb language plpgsql immutable security definer set search_path=''
as $f23_3e_p3d_internal_scrub_cross_source_search$
declare v_out jsonb:='[]'::jsonb; v_item jsonb;
begin
  if p_result is null or pg_catalog.jsonb_typeof(p_result->'candidates')<>'array' then return p_result; end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_result->'candidates') loop
    if v_item->>'reuse_review_mode'='CROSS_SOURCE_EXPLICIT_REVIEW' then
      v_item:=pg_catalog.jsonb_set(v_item,'{reuse_eligible}','false'::jsonb,true);
    end if;
    v_out:=v_out||pg_catalog.jsonb_build_array(v_item);
  end loop;
  return pg_catalog.jsonb_set(p_result,'{candidates}',v_out,true);
end;
$f23_3e_p3d_internal_scrub_cross_source_search$;

create or replace function public.f23_3e_p2b_search_masked_candidates(
  p_conversion_request_id uuid,p_actor_user_id uuid,p_expected_request_version integer,
  p_identity_kind text,p_candidate_student_id uuid,p_expected_contact_version integer,
  p_expected_case_version integer,p_expected_candidate_version integer,
  p_display_name_evidence text,p_birth_date_evidence date,p_birth_year_evidence integer,
  p_expected_normalization_version integer,p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,p_expected_policy_registry_version integer,
  p_expected_adapter_version integer
) returns jsonb language plpgsql security definer set search_path=''
as $f23_3e_p2b_search_masked_candidates$
begin
  perform pg_catalog.set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  return public.f23_3e_p3d_internal_scrub_cross_source_search(
    public.f23_3e_p2b_internal_search_masked_candidates(
      p_conversion_request_id,p_actor_user_id,p_expected_request_version,p_identity_kind,
      p_candidate_student_id,p_expected_contact_version,p_expected_case_version,
      p_expected_candidate_version,p_display_name_evidence,p_birth_date_evidence,
      p_birth_year_evidence,p_expected_normalization_version,p_expected_match_policy_version,
      p_expected_minimum_evidence_policy_version,p_expected_policy_registry_version,
      p_expected_adapter_version,null,null));
end;
$f23_3e_p2b_search_masked_candidates$;

create or replace function public.f23_3e_p2b_get_masked_candidate_review_detail(
  p_conversion_request_id uuid,p_actor_user_id uuid,p_expected_request_version integer,
  p_identity_kind text,p_candidate_student_id uuid,p_expected_contact_version integer,
  p_expected_case_version integer,p_expected_candidate_version integer,
  p_display_name_evidence text,p_birth_date_evidence date,p_birth_year_evidence integer,
  p_expected_normalization_version integer,p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,p_expected_policy_registry_version integer,
  p_expected_adapter_version integer,p_opaque_candidate_id uuid,p_expected_target_version integer
) returns jsonb language plpgsql security definer set search_path=''
as $f23_3e_p2b_get_masked_candidate_review_detail$
begin
  perform pg_catalog.set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  return public.f23_3e_p3d_internal_scrub_cross_source_search(
    public.f23_3e_p2b_internal_search_masked_candidates(
      p_conversion_request_id,p_actor_user_id,p_expected_request_version,p_identity_kind,
      p_candidate_student_id,p_expected_contact_version,p_expected_case_version,
      p_expected_candidate_version,p_display_name_evidence,p_birth_date_evidence,
      p_birth_year_evidence,p_expected_normalization_version,p_expected_match_policy_version,
      p_expected_minimum_evidence_policy_version,p_expected_policy_registry_version,
      p_expected_adapter_version,p_opaque_candidate_id,p_expected_target_version));
end;
$f23_3e_p2b_get_masked_candidate_review_detail$;

create function public.f23_3e_p3d_internal_prepare_review_r0()
returns trigger language plpgsql security definer set search_path=''
as $f23_3e_p3d_internal_prepare_review_r0$
declare
  v_support record;
  v_membership public.center_members%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
begin
  if tg_op='INSERT' then
    new.reviewer_membership_id:=null; new.reviewer_membership_version:=null;
    new.reviewer_role:=null; new.reviewer_assignment_id:=null;
    new.reviewer_assignment_version:=null;
    if new.opaque_target_id is not null and new.target_version is not null
       and new.target_adapter_namespace in ('canonical.student_profile.v1','canonical.guardian_profile.v1')
       and not exists(
         select 1 from public.crm_identity_target_binding b
         where b.center_id=new.center_id and b.identity_kind=new.identity_kind and b.binding_status='ACTIVE'
           and b.target_version_at_binding=new.target_version
           and ((new.identity_kind='STUDENT' and b.student_id=new.opaque_target_id
                 and b.source_candidate_student_id=new.candidate_student_id
                 and b.source_version_at_binding=new.source_candidate_version)
             or (new.identity_kind='GUARDIAN' and b.guardian_id=new.opaque_target_id
                 and b.source_contact_id=new.crm_contact_id
                 and b.source_version_at_binding=new.source_contact_version))
       ) then
      select * into v_support
      from public.f23_3e_p3d_internal_select_support_binding(
        new.center_id,new.identity_kind,new.opaque_target_id,new.target_version,
        new.crm_contact_id,new.candidate_student_id);
      if found then
        new.supporting_identity_target_binding_id:=v_support.identity_target_binding_id;
        new.supporting_binding_version:=v_support.binding_version;
      end if;
    end if;
    return new;
  end if;

  if old.review_status='PENDING' and new.review_status in
      ('EXACT_REVIEWED_MATCH','CREATE_NEW_REVIEWED','REJECTED_MATCH','CONFLICT')
     and new.reviewer_user_id is not null then
    select m.* into v_membership from public.center_members m
    where m.center_id=new.center_id and m.user_id=new.reviewer_user_id and m.status='active'
    order by m.id limit 1;
    if not found or v_membership.role not in ('owner','center_admin','consultant') then
      raise exception 'REVIEWER_CAPABILITY_STALE';
    end if;
    new.reviewer_membership_id:=v_membership.id;
    new.reviewer_membership_version:=v_membership.membership_version;
    new.reviewer_role:=v_membership.role;
    if v_membership.role='consultant' then
      select a.* into v_assignment from public.consultation_case_assignment a
      join public.crm_conversion_request r on r.center_id=a.center_id and r.source_assignment_id=a.assignment_id
      where r.conversion_request_id=new.conversion_request_id
        and a.assigned_consultant_user_id=new.reviewer_user_id and a.assignment_status='ACTIVE';
      if not found then raise exception 'REVIEWER_CAPABILITY_STALE'; end if;
      new.reviewer_assignment_id:=v_assignment.assignment_id;
      new.reviewer_assignment_version:=v_assignment.assignment_version;
    else
      new.reviewer_assignment_id:=null; new.reviewer_assignment_version:=null;
    end if;
    if new.review_status='EXACT_REVIEWED_MATCH' and new.review_action='REUSE_EXISTING'
       and old.supporting_identity_target_binding_id is not null then
      select * into v_support
      from public.f23_3e_p3d_internal_select_support_binding(
        old.center_id,old.identity_kind,old.opaque_target_id,old.target_version,
        old.crm_contact_id,old.candidate_student_id);
      if not found or v_support.identity_target_binding_id<>old.supporting_identity_target_binding_id
         or v_support.binding_version<>old.supporting_binding_version then
        raise exception 'SUPPORTING_BINDING_STALE';
      end if;
    end if;
  end if;
  return new;
end;
$f23_3e_p3d_internal_prepare_review_r0$;

create trigger aaa_f23_3e_p3d_prepare_review_r0
before insert or update on public.crm_identity_match_review
for each row execute function public.f23_3e_p3d_internal_prepare_review_r0();

create function public.f23_3e_p3d_internal_guard_review_r0()
returns trigger language plpgsql set search_path=''
as $f23_3e_p3d_internal_guard_review_r0$
begin
  if tg_op='INSERT' then
    if new.reviewer_membership_id is not null or new.reviewer_membership_version is not null
       or new.reviewer_role is not null or new.reviewer_assignment_id is not null
       or new.reviewer_assignment_version is not null
       or ((new.supporting_identity_target_binding_id is null)<>(new.supporting_binding_version is null)) then
      raise exception 'REVIEW_R0_INSERT_SHAPE_INVALID';
    end if;
    return new;
  end if;
  if new.supporting_identity_target_binding_id is distinct from old.supporting_identity_target_binding_id
     or new.supporting_binding_version is distinct from old.supporting_binding_version then
    raise exception 'REVIEW_SUPPORTING_BINDING_IMMUTABLE';
  end if;
  if old.review_status<>'PENDING' then
    if new.reviewer_membership_id is distinct from old.reviewer_membership_id
       or new.reviewer_membership_version is distinct from old.reviewer_membership_version
       or new.reviewer_role is distinct from old.reviewer_role
       or new.reviewer_assignment_id is distinct from old.reviewer_assignment_id
       or new.reviewer_assignment_version is distinct from old.reviewer_assignment_version then
      raise exception 'REVIEWER_PROVENANCE_IMMUTABLE';
    end if;
  elsif new.reviewer_user_id is not null then
    if new.reviewer_membership_id is null or new.reviewer_membership_version is null
       or new.reviewer_role not in ('owner','center_admin','consultant')
       or (new.reviewer_role='consultant' and (new.reviewer_assignment_id is null or new.reviewer_assignment_version is null))
       or (new.reviewer_role in ('owner','center_admin') and (new.reviewer_assignment_id is not null or new.reviewer_assignment_version is not null)) then
      raise exception 'REVIEWER_PROVENANCE_INVALID';
    end if;
  end if;
  return new;
end;
$f23_3e_p3d_internal_guard_review_r0$;

create trigger zzz_f23_3e_p3d_guard_review_r0
before insert or update on public.crm_identity_match_review
for each row execute function public.f23_3e_p3d_internal_guard_review_r0();

alter function public.f23_3e_p3c_internal_resolve_reusable_student(text,uuid,uuid,integer,uuid)
  rename to f23_3e_p3d_internal_checkpoint_resolve_reusable_student;
alter function public.f23_3e_p3c_internal_resolve_reusable_guardian(text,uuid,uuid,integer,uuid)
  rename to f23_3e_p3d_internal_checkpoint_resolve_reusable_guardian;

create function public.f23_3e_p3c_internal_resolve_reusable_student(
  p_center_id text,p_source_candidate_student_id uuid,p_student_id uuid,
  p_expected_student_version integer,p_match_review_id uuid
) returns table(reuse_eligible boolean,student_id uuid,student_version integer)
language plpgsql security definer set search_path=''
as $f23_3e_p3c_internal_resolve_reusable_student$
declare v_review public.crm_identity_match_review%rowtype; v_support public.crm_identity_target_binding%rowtype;
  v_student public.student_profile%rowtype; v_candidate public.consultation_case_candidate_student%rowtype;
  v_request public.crm_conversion_request%rowtype;
begin
  select r.* into v_review from public.crm_identity_match_review r
    where r.center_id=p_center_id and r.match_review_id=p_match_review_id for share;
  if not found or v_review.supporting_identity_target_binding_id is null then
    return query select * from public.f23_3e_p3d_internal_checkpoint_resolve_reusable_student(
      p_center_id,p_source_candidate_student_id,p_student_id,p_expected_student_version,p_match_review_id);
    return;
  end if;
  select s.* into v_student from public.student_profile s
    where s.center_id=p_center_id and s.student_id=p_student_id for share;
  select c.* into v_candidate from public.consultation_case_candidate_student c
    where c.center_id=p_center_id and c.candidate_student_id=p_source_candidate_student_id for share;
  select r.* into v_request from public.crm_conversion_request r
    where r.center_id=p_center_id and r.conversion_request_id=v_review.conversion_request_id for share;
  select b.* into v_support from public.crm_identity_target_binding b
    where b.center_id=p_center_id and b.identity_target_binding_id=v_review.supporting_identity_target_binding_id for share;
  reuse_eligible:=v_review.review_status='EXACT_REVIEWED_MATCH' and v_review.review_action='REUSE_EXISTING'
    and v_review.identity_kind='STUDENT' and v_review.candidate_student_id=p_source_candidate_student_id
    and v_review.opaque_target_id=p_student_id and v_review.target_version=p_expected_student_version
    and v_review.expires_at>pg_catalog.transaction_timestamp()
    and v_review.reviewer_user_id is not null and v_review.reviewer_membership_id is not null
    and v_student.student_id is not null and v_student.profile_status='ACTIVE'
    and v_student.student_version=p_expected_student_version
    and v_candidate.candidate_student_id is not null
    and v_candidate.candidate_version=v_review.source_candidate_version
    and v_candidate.consultation_case_id=v_review.consultation_case_id
    and v_request.conversion_request_id=v_review.conversion_request_id
    and v_request.request_version=v_review.request_version
    and v_request.action_graph_digest is not distinct from v_review.request_action_graph_digest
    and v_support.identity_target_binding_id is not null
    and v_support.binding_version=v_review.supporting_binding_version
    and v_support.identity_kind='STUDENT' and v_support.binding_status='ACTIVE'
    and v_support.student_id=p_student_id and v_support.source_candidate_student_id<>p_source_candidate_student_id
    and v_support.target_version_at_binding=p_expected_student_version
    and exists(select 1 from public.crm_conversion_request x where x.center_id=p_center_id
      and x.conversion_request_id=v_support.originating_request_id and x.status='COMPLETED')
    and exists(select 1 from public.crm_conversion_action a where a.center_id=p_center_id
      and a.conversion_action_id=v_support.originating_action_id and a.status='EXECUTED');
  student_id:=case when reuse_eligible then p_student_id end;
  student_version:=case when reuse_eligible then p_expected_student_version end;
  return next;
end;
$f23_3e_p3c_internal_resolve_reusable_student$;

create function public.f23_3e_p3c_internal_resolve_reusable_guardian(
  p_center_id text,p_source_contact_id uuid,p_guardian_id uuid,
  p_expected_guardian_version integer,p_match_review_id uuid
) returns table(reuse_eligible boolean,guardian_id uuid,guardian_version integer)
language plpgsql security definer set search_path=''
as $f23_3e_p3c_internal_resolve_reusable_guardian$
declare v_review public.crm_identity_match_review%rowtype; v_support public.crm_identity_target_binding%rowtype;
  v_guardian public.guardian_profile%rowtype; v_contact public.crm_contact%rowtype;
  v_request public.crm_conversion_request%rowtype;
begin
  select r.* into v_review from public.crm_identity_match_review r
    where r.center_id=p_center_id and r.match_review_id=p_match_review_id for share;
  if not found or v_review.supporting_identity_target_binding_id is null then
    return query select * from public.f23_3e_p3d_internal_checkpoint_resolve_reusable_guardian(
      p_center_id,p_source_contact_id,p_guardian_id,p_expected_guardian_version,p_match_review_id);
    return;
  end if;
  select g.* into v_guardian from public.guardian_profile g
    where g.center_id=p_center_id and g.guardian_id=p_guardian_id for share;
  select c.* into v_contact from public.crm_contact c
    where c.center_id=p_center_id and c.crm_contact_id=p_source_contact_id for share;
  select r.* into v_request from public.crm_conversion_request r
    where r.center_id=p_center_id and r.conversion_request_id=v_review.conversion_request_id for share;
  select b.* into v_support from public.crm_identity_target_binding b
    where b.center_id=p_center_id and b.identity_target_binding_id=v_review.supporting_identity_target_binding_id for share;
  reuse_eligible:=v_review.review_status='EXACT_REVIEWED_MATCH' and v_review.review_action='REUSE_EXISTING'
    and v_review.identity_kind='GUARDIAN' and v_review.crm_contact_id=p_source_contact_id
    and v_review.opaque_target_id=p_guardian_id and v_review.target_version=p_expected_guardian_version
    and v_review.expires_at>pg_catalog.transaction_timestamp()
    and v_review.reviewer_user_id is not null and v_review.reviewer_membership_id is not null
    and v_guardian.guardian_id is not null and v_guardian.guardian_status='ACTIVE'
    and v_guardian.guardian_version=p_expected_guardian_version
    and v_contact.crm_contact_id is not null and v_contact.contact_status<>'ARCHIVED'
    and v_contact.contact_version=v_review.source_contact_version
    and v_request.conversion_request_id=v_review.conversion_request_id
    and v_request.request_version=v_review.request_version
    and v_request.action_graph_digest is not distinct from v_review.request_action_graph_digest
    and v_support.identity_target_binding_id is not null
    and v_support.binding_version=v_review.supporting_binding_version
    and v_support.identity_kind='GUARDIAN' and v_support.binding_status='ACTIVE'
    and v_support.guardian_id=p_guardian_id and v_support.source_contact_id<>p_source_contact_id
    and v_support.target_version_at_binding=p_expected_guardian_version
    and exists(select 1 from public.crm_conversion_request x where x.center_id=p_center_id
      and x.conversion_request_id=v_support.originating_request_id and x.status='COMPLETED')
    and exists(select 1 from public.crm_conversion_action a where a.center_id=p_center_id
      and a.conversion_action_id=v_support.originating_action_id and a.status='EXECUTED');
  guardian_id:=case when reuse_eligible then p_guardian_id end;
  guardian_version:=case when reuse_eligible then p_expected_guardian_version end;
  return next;
end;
$f23_3e_p3c_internal_resolve_reusable_guardian$;

create function public.f23_3e_p3d_internal_text32(p_value text)
returns bytea language plpgsql immutable set search_path=''
as $f23_3e_p3d_internal_text32$
declare v_bytes bytea;
begin
  if p_value is null or p_value !~ '^[\x20-\x7e]+$' then raise exception 'CANONICAL_TEXT_INVALID'; end if;
  v_bytes:=pg_catalog.convert_to(p_value,'UTF8');
  return public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_bytes))||v_bytes;
end;
$f23_3e_p3d_internal_text32$;

create function public.f23_3e_p3d_internal_nullable_uuid(p_value uuid)
returns bytea language sql immutable set search_path=''
as $$select case when p_value is null then public.f23_3e_p3c_internal_u8(0)
 else public.f23_3e_p3c_internal_u8(1)||pg_catalog.uuid_send(p_value) end$$;
create function public.f23_3e_p3d_internal_nullable_u32(p_value integer)
returns bytea language plpgsql immutable set search_path=''
as $$begin return case when p_value is null then public.f23_3e_p3c_internal_u8(0)
 else public.f23_3e_p3c_internal_u8(1)||public.f23_3e_p3c_internal_u32(p_value) end; end$$;
create function public.f23_3e_p3d_internal_nullable_text32(p_value text)
returns bytea language plpgsql immutable set search_path=''
as $$begin return case when p_value is null then public.f23_3e_p3c_internal_u8(0)
 else public.f23_3e_p3c_internal_u8(1)||public.f23_3e_p3d_internal_text32(p_value) end; end$$;
create function public.f23_3e_p3d_internal_nullable_bool(p_value boolean)
returns bytea language sql immutable set search_path=''
as $$select case when p_value is null then public.f23_3e_p3c_internal_u8(0)
 else public.f23_3e_p3c_internal_u8(1)||public.f23_3e_p3c_internal_u8(case when p_value then 1 else 0 end) end$$;
create function public.f23_3e_p3d_internal_nullable_bytes32(p_value bytea)
returns bytea language plpgsql immutable set search_path=''
as $$begin if p_value is null then return public.f23_3e_p3c_internal_u8(0); end if;
 if pg_catalog.octet_length(p_value)<>32 then raise exception 'CANONICAL_BYTES32_INVALID'; end if;
 return public.f23_3e_p3c_internal_u8(1)||p_value; end$$;

create function public.f23_3e_p3d_internal_relationship_scope_digest_v1(
  p_center_id text,p_conversion_request_id uuid,p_relationship_action_id uuid,
  p_guardian_action_id uuid,p_student_action_id uuid,p_related_student_disposition text,
  p_guardian_match_review_id uuid,p_guardian_review_version integer,
  p_student_match_review_id uuid,p_student_review_version integer,
  p_guardian_target_id uuid,p_guardian_expected_target_version integer,
  p_student_target_id uuid,p_student_expected_target_version integer,
  p_relationship_action_kind text,p_guardian_student_relationship_id uuid,
  p_expected_relationship_version integer,p_relationship_type text,
  p_is_primary_contact boolean,p_financial_contact_role text,p_academic_contact_role text,
  p_relationship_policy_version integer,p_safe_reason_code text
) returns bytea language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_relationship_scope_digest_v1$
declare v bytea;
begin
  if p_related_student_disposition not in ('CREATE','REUSE','NONE')
     or p_relationship_policy_version is null or p_relationship_policy_version<1 then
    raise exception 'RELATIONSHIP_SCOPE_INVALID';
  end if;
  v:=public.f23_3e_p3d_internal_text32('ichess.crm.p3.relationship-scope.v1')
    ||public.f23_3e_p3c_internal_u16(1)
    ||public.f23_3e_p3d_internal_text32(p_center_id)
    ||pg_catalog.uuid_send(p_conversion_request_id)||pg_catalog.uuid_send(p_relationship_action_id)
    ||pg_catalog.uuid_send(p_guardian_action_id)||pg_catalog.uuid_send(p_student_action_id)
    ||public.f23_3e_p3d_internal_text32(p_related_student_disposition)
    ||public.f23_3e_p3d_internal_nullable_uuid(p_guardian_match_review_id)
    ||public.f23_3e_p3d_internal_nullable_u32(p_guardian_review_version)
    ||public.f23_3e_p3d_internal_nullable_uuid(p_student_match_review_id)
    ||public.f23_3e_p3d_internal_nullable_u32(p_student_review_version)
    ||public.f23_3e_p3d_internal_nullable_uuid(p_guardian_target_id)
    ||public.f23_3e_p3d_internal_nullable_u32(p_guardian_expected_target_version)
    ||public.f23_3e_p3d_internal_nullable_uuid(p_student_target_id)
    ||public.f23_3e_p3d_internal_nullable_u32(p_student_expected_target_version)
    ||public.f23_3e_p3d_internal_text32(p_relationship_action_kind)
    ||public.f23_3e_p3d_internal_nullable_uuid(p_guardian_student_relationship_id)
    ||public.f23_3e_p3d_internal_nullable_u32(p_expected_relationship_version)
    ||public.f23_3e_p3d_internal_nullable_text32(p_relationship_type)
    ||public.f23_3e_p3d_internal_nullable_bool(p_is_primary_contact)
    ||public.f23_3e_p3d_internal_nullable_text32(p_financial_contact_role)
    ||public.f23_3e_p3d_internal_nullable_text32(p_academic_contact_role)
    ||public.f23_3e_p3c_internal_u32(p_relationship_policy_version)
    ||public.f23_3e_p3d_internal_text32(p_safe_reason_code);
  return extensions.digest(v,'sha256');
end;
$f23_3e_p3d_internal_relationship_scope_digest_v1$;

create function public.f23_3e_p3d_internal_reuse_authorization_set_digest_v1(
  p_conversion_request_id uuid,p_required_authorization_status text
) returns bytea language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_reuse_authorization_set_digest_v1$
declare v bytea; v_header bytea; v_record bytea; v_row record; v_count integer:=0; v_seen text[]:=array[]::text[];
begin
  if p_required_authorization_status not in ('ISSUED','CONSUMED','INVALIDATED') then
    raise exception 'REUSE_AUTHORIZATION_SET_STATUS_INVALID';
  end if;
  v_header:=public.f23_3e_p3d_internal_text32('ichess.crm.p3.reuse-authorization-set.v1')
    ||public.f23_3e_p3c_internal_u16(1)||pg_catalog.uuid_send(p_conversion_request_id);
  v:=v_header;
  for v_row in
    select a.*,case a.identity_kind when 'GUARDIAN' then 1 when 'STUDENT' then 2 end kind_rank
    from public.crm_reviewed_cross_source_reuse_authorization a
    where a.conversion_request_id=p_conversion_request_id and a.status=p_required_authorization_status
    order by case a.identity_kind when 'GUARDIAN' then 1 when 'STUDENT' then 2 else 99 end,
      pg_catalog.uuid_send(a.reviewed_reuse_authorization_id)
  loop
    if v_row.kind_rank is null or v_row.identity_kind=any(v_seen) then raise exception 'REUSE_AUTHORIZATION_SET_INVALID'; end if;
    v_seen:=pg_catalog.array_append(v_seen,v_row.identity_kind); v_count:=v_count+1;
    v_record:=public.f23_3e_p3c_internal_u8(v_row.kind_rank)
      ||pg_catalog.uuid_send(v_row.reviewed_reuse_authorization_id)
      ||public.f23_3e_p3c_internal_u32(v_row.authorization_version)
      ||public.f23_3e_p3d_internal_text32(v_row.center_id)
      ||pg_catalog.uuid_send(v_row.conversion_request_id)||pg_catalog.uuid_send(v_row.conversion_action_id)
      ||public.f23_3e_p3d_internal_nullable_uuid(v_row.source_contact_id)
      ||public.f23_3e_p3d_internal_nullable_uuid(v_row.source_candidate_student_id)
      ||public.f23_3e_p3d_internal_text32(v_row.target_adapter_namespace)
      ||pg_catalog.uuid_send(v_row.opaque_target_id)
      ||public.f23_3e_p3c_internal_u32(v_row.expected_target_version)
      ||pg_catalog.uuid_send(v_row.match_review_id)
      ||public.f23_3e_p3c_internal_u32(v_row.review_version)
      ||public.f23_3e_p3d_internal_nullable_u32(v_row.relationship_scope_encoding_version)
      ||public.f23_3e_p3d_internal_nullable_bytes32(v_row.relationship_scope_digest);
    v:=v||public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_record))||v_record;
  end loop;
  if v_count not between 1 and 2 then raise exception 'REUSE_AUTHORIZATION_SET_INVALID'; end if;
  v:=v_header||public.f23_3e_p3c_internal_u32(v_count)
    ||pg_catalog.substr(v,pg_catalog.octet_length(v_header)+1);
  return extensions.digest(v,'sha256');
end;
$f23_3e_p3d_internal_reuse_authorization_set_digest_v1$;

create function public.f23_3e_p3d_internal_action_set_digest_v2(
  p_conversion_request_id uuid,p_required_status text
) returns bytea language sql stable set search_path=''
as $f23_3e_p3d_internal_action_set_digest_v2$
select extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
  'domain','ichess.crm.p3.action-set','encoding_version',2,
  'conversion_request_id',p_conversion_request_id,
  'legacy_request_action_graph_digest',pg_catalog.encode(r.action_graph_digest,'hex'),
  'lifecycle_status',p_required_status,
  'actions',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'action_id',a.conversion_action_id,'action_version',a.action_version,'action_kind',a.action_kind,
    'action_intent_digest',pg_catalog.encode(a.action_intent_digest,'hex'),'identity_kind',a.identity_kind,
    'source_contact_id',a.source_contact_id,'source_candidate_student_id',a.source_candidate_student_id,
    'match_review_id',a.match_review_id,'profile_creation_reservation_id',a.profile_creation_reservation_id,
    'target_adapter_namespace',a.target_adapter_namespace,'opaque_target_id',a.opaque_target_id,
    'expected_target_version',a.expected_target_version,'student_target_id',a.student_target_id,
    'guardian_target_id',a.guardian_target_id,'guardian_action_id',a.guardian_action_id,
    'student_action_id',a.student_action_id,'guardian_student_relationship_id',a.guardian_student_relationship_id,
    'expected_relationship_version',a.expected_relationship_version,'relationship_type',a.relationship_type,
    'is_primary_contact',a.is_primary_contact,'financial_contact_role',a.financial_contact_role,
    'academic_contact_role',a.academic_contact_role,'safe_reason_code',a.safe_reason_code,
    'relationship_policy_version',a.relationship_policy_version,
    'action_set_encoding_version',a.action_set_encoding_version,
    'reviewed_reuse_authorization_id',a.reviewed_reuse_authorization_id,
    'expected_reuse_authorization_version',a.expected_reuse_authorization_version,
    'relationship_scope_encoding_version',a.relationship_scope_encoding_version,
    'relationship_scope_digest',case when a.relationship_scope_digest is null then null else pg_catalog.encode(a.relationship_scope_digest,'hex') end,
    'reuse_authorization_set_encoding_version',a.reuse_authorization_set_encoding_version,
    'reuse_authorization_set_digest',case when a.reuse_authorization_set_digest is null then null else pg_catalog.encode(a.reuse_authorization_set_digest,'hex') end
  ) order by a.conversion_action_id) from public.crm_conversion_action a
    where a.conversion_request_id=p_conversion_request_id and a.status=p_required_status),'[]'::jsonb)
)::text,'UTF8'),'sha256') from public.crm_conversion_request r
where r.conversion_request_id=p_conversion_request_id
$f23_3e_p3d_internal_action_set_digest_v2$;

create function public.f23_3e_p3d_internal_action_set_digest_versioned(
  p_conversion_request_id uuid,p_required_status text,p_action_set_encoding_version integer
) returns bytea language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_action_set_digest_versioned$
begin
  if p_action_set_encoding_version=1 then
    return public.f23_3e_p3b_internal_action_set_digest(p_conversion_request_id,p_required_status);
  elsif p_action_set_encoding_version=2 then
    return public.f23_3e_p3d_internal_action_set_digest_v2(p_conversion_request_id,p_required_status);
  end if;
  raise exception 'ACTION_SET_ENCODING_UNSUPPORTED';
end;
$f23_3e_p3d_internal_action_set_digest_versioned$;

create or replace function public.f23_3e_p3b_internal_guard_conversion_action()
returns trigger language plpgsql set search_path=''
as $f23_3e_p3b_internal_guard_conversion_action$
declare v_legacy bytea;
begin
  if tg_op='DELETE' then raise exception 'f23_3e_p3b_conversion_action_delete_forbidden'; end if;
  select r.action_graph_digest into v_legacy from public.crm_conversion_request r
    where r.center_id=new.center_id and r.conversion_request_id=new.conversion_request_id;
  if not found or v_legacy is distinct from new.legacy_request_action_graph_digest then
    raise exception 'f23_3e_p3b_action_legacy_request_binding_mismatch';
  end if;
  if tg_op='INSERT' then
    if new.status<>'PROPOSED' or new.action_version<>1 then raise exception 'f23_3e_p3b_action_must_start_proposed_at_version_one'; end if;
    return new;
  end if;
  if new.conversion_action_id is distinct from old.conversion_action_id
     or new.center_id is distinct from old.center_id or new.conversion_request_id is distinct from old.conversion_request_id
     or new.legacy_request_action_graph_digest is distinct from old.legacy_request_action_graph_digest
     or new.action_kind is distinct from old.action_kind or new.action_intent_digest is distinct from old.action_intent_digest
     or new.identity_kind is distinct from old.identity_kind or new.source_contact_id is distinct from old.source_contact_id
     or new.source_candidate_student_id is distinct from old.source_candidate_student_id
     or new.match_review_id is distinct from old.match_review_id
     or new.profile_creation_reservation_id is distinct from old.profile_creation_reservation_id
     or new.target_adapter_namespace is distinct from old.target_adapter_namespace
     or new.opaque_target_id is distinct from old.opaque_target_id
     or new.expected_target_version is distinct from old.expected_target_version
     or new.student_target_id is distinct from old.student_target_id or new.guardian_target_id is distinct from old.guardian_target_id
     or new.guardian_action_id is distinct from old.guardian_action_id or new.student_action_id is distinct from old.student_action_id
     or new.guardian_student_relationship_id is distinct from old.guardian_student_relationship_id
     or new.expected_relationship_version is distinct from old.expected_relationship_version
     or new.relationship_type is distinct from old.relationship_type or new.is_primary_contact is distinct from old.is_primary_contact
     or new.financial_contact_role is distinct from old.financial_contact_role
     or new.academic_contact_role is distinct from old.academic_contact_role
     or new.safe_reason_code is distinct from old.safe_reason_code
     or new.relationship_policy_version is distinct from old.relationship_policy_version
     or new.created_at is distinct from old.created_at then raise exception 'f23_3e_p3b_action_binding_is_immutable';
  end if;
  if pg_catalog.current_setting('ichess.p3d_r0_plan_binding',true)='on'
     and old.status='PROPOSED' and new.status='PROPOSED' and old.action_version=1 and new.action_version=1
     and old.action_set_encoding_version=1 and new.action_set_encoding_version=2
     and old.reviewed_reuse_authorization_id is null and old.expected_reuse_authorization_version is null
     and old.relationship_scope_encoding_version is null and old.relationship_scope_digest is null
     and old.reuse_authorization_set_encoding_version is null and old.reuse_authorization_set_digest is null then
    return new;
  end if;
  if new.action_set_encoding_version is distinct from old.action_set_encoding_version
     or new.reviewed_reuse_authorization_id is distinct from old.reviewed_reuse_authorization_id
     or new.expected_reuse_authorization_version is distinct from old.expected_reuse_authorization_version
     or new.relationship_scope_encoding_version is distinct from old.relationship_scope_encoding_version
     or new.relationship_scope_digest is distinct from old.relationship_scope_digest
     or new.reuse_authorization_set_encoding_version is distinct from old.reuse_authorization_set_encoding_version
     or new.reuse_authorization_set_digest is distinct from old.reuse_authorization_set_digest then
    raise exception 'f23_3e_p3b_action_binding_is_immutable';
  end if;
  if new.action_version<>old.action_version+1 then raise exception 'f23_3e_p3b_action_transition_requires_exact_version_increment'; end if;
  if old.status='PROPOSED' and new.status in ('REVIEWED','SUPERSEDED') then return new; end if;
  if old.status='REVIEWED' and new.status='SUPERSEDED' then return new; end if;
  if old.status='APPROVED' and new.status='SUPERSEDED'
     and pg_catalog.current_setting('ichess.p3d_plan_invalidation',true)='on' then return new; end if;
  if old.status='REVIEWED' and new.status='APPROVED' and pg_catalog.current_setting('ichess.p3b_authority_issue',true)='on' then return new; end if;
  if old.status='APPROVED' and new.status='EXECUTED' and pg_catalog.current_setting('ichess.p3d_executor',true)='on' then return new; end if;
  raise exception 'f23_3e_p3b_invalid_or_unowned_action_transition';
end;
$f23_3e_p3b_internal_guard_conversion_action$;

create or replace function public.f23_3e_p3b_internal_guard_idempotency_snapshot()
returns trigger language plpgsql set search_path=''
as $f23_3e_p3b_internal_guard_idempotency_snapshot$
begin
  if tg_op='UPDATE' then
    if new.p3_actor_user_id is distinct from old.p3_actor_user_id
       or new.p3_step_up_assertion_id is distinct from old.p3_step_up_assertion_id
       or new.p3_expected_request_version is distinct from old.p3_expected_request_version
       or new.p3_expected_resource_version is distinct from old.p3_expected_resource_version
       or new.p3_operation_binding_digest is distinct from old.p3_operation_binding_digest
       or new.p3_legacy_request_action_graph_digest is distinct from old.p3_legacy_request_action_graph_digest then
      raise exception 'f23_3e_p3b_idempotency_binding_is_immutable';
    end if;
    if old.status in ('COMPLETED','CONFLICT','EXPIRED') and (
      new.p3_action_set_encoding_version is distinct from old.p3_action_set_encoding_version
      or new.p3_action_set_digest is distinct from old.p3_action_set_digest
      or new.p3_reuse_authorization_set_encoding_version is distinct from old.p3_reuse_authorization_set_encoding_version
      or new.p3_reuse_authorization_set_digest is distinct from old.p3_reuse_authorization_set_digest
      or new.p3_result_kind is distinct from old.p3_result_kind
      or new.p3_result_outcome_code is distinct from old.p3_result_outcome_code
      or new.p3_result_snapshot is distinct from old.p3_result_snapshot
      or new.p3_result_correlation_id is distinct from old.p3_result_correlation_id) then
      if pg_catalog.current_setting('ichess.p3d_r0_plan_binding',true)<>'on' then
        raise exception 'f23_3e_p3b_terminal_result_snapshot_is_immutable';
      end if;
    end if;
    if old.status not in ('COMPLETED','CONFLICT','EXPIRED')
       and new.status not in ('COMPLETED','CONFLICT','EXPIRED') and (
      new.p3_action_set_encoding_version is distinct from old.p3_action_set_encoding_version
      or new.p3_action_set_digest is distinct from old.p3_action_set_digest
      or new.p3_reuse_authorization_set_encoding_version is distinct from old.p3_reuse_authorization_set_encoding_version
      or new.p3_reuse_authorization_set_digest is distinct from old.p3_reuse_authorization_set_digest
      or new.p3_result_kind is distinct from old.p3_result_kind
      or new.p3_result_outcome_code is distinct from old.p3_result_outcome_code
      or new.p3_result_snapshot is distinct from old.p3_result_snapshot
      or new.p3_result_correlation_id is distinct from old.p3_result_correlation_id) then
      raise exception 'f23_3e_p3b_result_snapshot_only_at_terminal_completion';
    end if;
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_idempotency_snapshot$;

create or replace function public.f23_3e_p1a_guard_idempotency_lifecycle()
returns trigger language plpgsql set search_path=''
as $f23_3e_p1a_guard_idempotency_lifecycle$
begin
  if tg_op='INSERT' then
    if new.status<>'RESERVED' or new.idempotency_version<>1 then
      raise exception 'f23_3e_p1a_idempotency_must_start_reserved_at_version_one';
    end if;
    return new;
  end if;
  if new.environment_fingerprint is distinct from old.environment_fingerprint
     or new.center_id is distinct from old.center_id or new.resource_scope_kind is distinct from old.resource_scope_kind
     or new.resource_scope_id is distinct from old.resource_scope_id
     or new.consultation_case_id is distinct from old.consultation_case_id
     or new.operation is distinct from old.operation or new.idempotency_key_digest is distinct from old.idempotency_key_digest
     or new.intent_digest is distinct from old.intent_digest or new.action_graph_digest is distinct from old.action_graph_digest
     or new.request_id is distinct from old.request_id or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'f23_3e_p1a_idempotency_scope_and_intent_are_immutable';
  end if;
  if old.status in ('COMPLETED','CONFLICT','EXPIRED') then
    if pg_catalog.current_setting('ichess.p3d_r0_plan_binding',true)='on'
       and new.status=old.status and new.idempotency_version=old.idempotency_version+1
       and (pg_catalog.to_jsonb(new)-'p3_action_set_encoding_version'-'p3_action_set_digest'
         -'p3_reuse_authorization_set_encoding_version'-'p3_reuse_authorization_set_digest'
         -'p3_result_snapshot'-'terminal_outcome_digest'-'idempotency_version')
         is not distinct from
         (pg_catalog.to_jsonb(old)-'p3_action_set_encoding_version'-'p3_action_set_digest'
         -'p3_reuse_authorization_set_encoding_version'-'p3_reuse_authorization_set_digest'
         -'p3_result_snapshot'-'terminal_outcome_digest'-'idempotency_version') then return new; end if;
    raise exception 'f23_3e_p1a_terminal_idempotency_record_is_immutable';
  end if;
  if not ((old.status='RESERVED' and new.status in ('RESERVED','IN_PROGRESS','COMPLETED','CONFLICT','EXPIRED'))
    or (old.status='IN_PROGRESS' and new.status in ('IN_PROGRESS','COMPLETED','CONFLICT','EXPIRED'))) then
    raise exception 'f23_3e_p1a_invalid_idempotency_transition: % -> %',old.status,new.status;
  end if;
  return new;
end;
$f23_3e_p1a_guard_idempotency_lifecycle$;

alter function public.f23_3e_p3c_materialize_reviewed_action_pair(
  uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,
  integer,bytea,bytea,timestamptz
) rename to f23_3e_p3d_internal_checkpoint_materialize_reviewed_action_pair;

create function public.f23_3e_p3c_materialize_reviewed_action_pair(
  p_actor_user_id uuid,p_conversion_request_id uuid,p_expected_request_version integer,
  p_guardian_match_review_id uuid,p_expected_guardian_review_version integer,
  p_student_match_review_id uuid,p_expected_student_review_version integer,
  p_relationship_action_id uuid,p_relationship_decision text,p_relationship_type text,
  p_is_primary_contact boolean,p_financial_contact_role text,p_academic_contact_role text,
  p_safe_reason_code text,p_relationship_policy_version integer,p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns table(ok boolean,outcome_code text,replayed boolean,guardian_action_id uuid,
  student_action_id uuid,relationship_action_id uuid,action_versions jsonb,
  current_action_set_digest bytea,action_set_encoding_version integer,correlation_id uuid)
language plpgsql security definer set search_path=''
as $f23_3e_p3c_materialize_reviewed_action_pair$
declare v_result record; v_request public.crm_conversion_request%rowtype;
  v_student_action public.crm_conversion_action%rowtype; v_guardian_action public.crm_conversion_action%rowtype;
  v_relationship_action public.crm_conversion_action%rowtype;
  v_student_review public.crm_identity_match_review%rowtype; v_guardian_review public.crm_identity_match_review%rowtype;
  v_support public.crm_identity_target_binding%rowtype; v_policy public.crm_identity_policy_registry%rowtype;
  v_student_auth uuid; v_guardian_auth uuid; v_scope bytea; v_set bytea; v_digest bytea;
  v_student_disposition text; v_snapshot jsonb; v_registry_id uuid;
begin
  select * into v_result from public.f23_3e_p3d_internal_checkpoint_materialize_reviewed_action_pair(
    p_actor_user_id,p_conversion_request_id,p_expected_request_version,
    p_guardian_match_review_id,p_expected_guardian_review_version,
    p_student_match_review_id,p_expected_student_review_version,p_relationship_action_id,
    p_relationship_decision,p_relationship_type,p_is_primary_contact,p_financial_contact_role,
    p_academic_contact_role,p_safe_reason_code,p_relationship_policy_version,
    p_operation_intent_digest,p_idempotency_key_digest,p_idempotency_expires_at);
  -- Exact replay is the immutable checkpoint snapshot. It must precede every
  -- read of action rows because their lifecycle may now be APPROVED/EXECUTED.
  if not coalesce(v_result.ok,false) or coalesce(v_result.replayed,false) then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.guardian_action_id,
      v_result.student_action_id,v_result.relationship_action_id,v_result.action_versions,
      v_result.current_action_set_digest,v_result.action_set_encoding_version,v_result.correlation_id;
    return;
  end if;
  select * into v_student_action from public.crm_conversion_action where conversion_action_id=v_result.student_action_id;
  select * into v_guardian_action from public.crm_conversion_action where conversion_action_id=v_result.guardian_action_id;
  select * into v_relationship_action from public.crm_conversion_action where conversion_action_id=v_result.relationship_action_id;
  select * into v_student_review from public.crm_identity_match_review where match_review_id=p_student_match_review_id;
  select * into v_guardian_review from public.crm_identity_match_review where match_review_id=p_guardian_match_review_id;
  if not (v_student_review.supporting_identity_target_binding_id is not null
          and v_student_review.review_status='EXACT_REVIEWED_MATCH'
          and v_student_review.review_action='REUSE_EXISTING')
     and not (v_guardian_review.supporting_identity_target_binding_id is not null
          and v_guardian_review.review_status='EXACT_REVIEWED_MATCH'
          and v_guardian_review.review_action='REUSE_EXISTING') then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.guardian_action_id,
      v_result.student_action_id,v_result.relationship_action_id,v_result.action_versions,
      v_result.current_action_set_digest,v_result.action_set_encoding_version,v_result.correlation_id;
    return;
  end if;
  select * into v_request from public.crm_conversion_request r where r.conversion_request_id=p_conversion_request_id;
  v_student_disposition:=case v_student_action.action_kind when 'CREATE_NEW_STUDENT' then 'CREATE'
    when 'REUSE_REVIEWED_STUDENT' then 'REUSE' else 'NONE' end;
  if v_guardian_review.supporting_identity_target_binding_id is not null
     and v_guardian_review.review_status='EXACT_REVIEWED_MATCH'
     and v_guardian_review.review_action='REUSE_EXISTING' then
    v_scope:=public.f23_3e_p3d_internal_relationship_scope_digest_v1(
      v_request.center_id,p_conversion_request_id,v_relationship_action.conversion_action_id,
      v_guardian_action.conversion_action_id,v_student_action.conversion_action_id,v_student_disposition,
      v_guardian_review.match_review_id,v_guardian_review.review_version,
      v_student_review.match_review_id,v_student_review.review_version,
      v_guardian_action.opaque_target_id,v_guardian_action.expected_target_version,
      v_student_action.opaque_target_id,v_student_action.expected_target_version,
      v_relationship_action.action_kind,v_relationship_action.guardian_student_relationship_id,
      v_relationship_action.expected_relationship_version,v_relationship_action.relationship_type,
      v_relationship_action.is_primary_contact,v_relationship_action.financial_contact_role,
      v_relationship_action.academic_contact_role,v_relationship_action.relationship_policy_version,
      v_relationship_action.safe_reason_code);
  end if;

  if v_student_review.supporting_identity_target_binding_id is not null
     and v_student_review.review_status='EXACT_REVIEWED_MATCH'
     and v_student_review.review_action='REUSE_EXISTING' then
    v_student_auth:=pg_catalog.gen_random_uuid();
    select * into v_support from public.crm_identity_target_binding where identity_target_binding_id=v_student_review.supporting_identity_target_binding_id;
    select * into v_policy from public.crm_identity_policy_registry where identity_policy_registry_id=v_student_review.identity_policy_registry_id;
    insert into public.crm_reviewed_cross_source_reuse_authorization(
      reviewed_reuse_authorization_id,center_id,identity_kind,conversion_request_id,reviewed_request_version,
      p2_action_id,action_intent_digest,legacy_request_action_graph_digest,source_contact_id,source_contact_version,
      source_candidate_student_id,source_candidate_version,consultation_case_id,source_case_version,
      match_review_id,review_version,reviewed_by_actor_user_id,reviewed_at,reviewer_membership_id,
      reviewer_membership_version,reviewer_role,reviewer_assignment_id,reviewer_assignment_version,
      target_adapter_namespace,opaque_target_id,expected_target_version,supporting_identity_target_binding_id,
      supporting_binding_version,supporting_binding_source_version,supporting_binding_target_version,
      identity_policy_registry_id,normalization_version,match_policy_version,minimum_evidence_policy_version,
      identity_environment_fingerprint,evidence_set_digest,identity_mutex_keys_digest,projection_snapshot_digest,
      conversion_action_id,expires_at
    ) values (
      v_student_auth,v_request.center_id,'STUDENT',p_conversion_request_id,v_student_review.request_version,
      v_student_review.action_id,v_student_review.action_intent_digest,v_student_review.request_action_graph_digest,
      v_student_review.crm_contact_id,v_student_review.source_contact_version,v_student_review.candidate_student_id,
      v_student_review.source_candidate_version,v_student_review.consultation_case_id,v_student_review.source_case_version,
      v_student_review.match_review_id,v_student_review.review_version,v_student_review.reviewer_user_id,
      v_student_review.decided_at,v_student_review.reviewer_membership_id,v_student_review.reviewer_membership_version,
      v_student_review.reviewer_role,v_student_review.reviewer_assignment_id,v_student_review.reviewer_assignment_version,
      v_student_review.target_adapter_namespace,v_student_review.opaque_target_id,v_student_review.target_version,
      v_support.identity_target_binding_id,v_support.binding_version,v_support.source_version_at_binding,
      v_support.target_version_at_binding,v_student_review.identity_policy_registry_id,v_student_review.normalization_version,
      v_student_review.match_policy_version,v_student_review.minimum_evidence_policy_version,v_policy.environment_fingerprint,
      v_student_review.evidence_set_digest,v_student_review.identity_mutex_keys_digest,v_student_review.projection_snapshot_digest,
      v_student_action.conversion_action_id,v_student_review.expires_at);
  end if;
  if v_guardian_review.supporting_identity_target_binding_id is not null
     and v_guardian_review.review_status='EXACT_REVIEWED_MATCH'
     and v_guardian_review.review_action='REUSE_EXISTING' then
    v_guardian_auth:=pg_catalog.gen_random_uuid();
    select * into v_support from public.crm_identity_target_binding where identity_target_binding_id=v_guardian_review.supporting_identity_target_binding_id;
    select * into v_policy from public.crm_identity_policy_registry where identity_policy_registry_id=v_guardian_review.identity_policy_registry_id;
    insert into public.crm_reviewed_cross_source_reuse_authorization(
      reviewed_reuse_authorization_id,center_id,identity_kind,conversion_request_id,reviewed_request_version,
      p2_action_id,action_intent_digest,legacy_request_action_graph_digest,source_contact_id,source_contact_version,
      consultation_case_id,source_case_version,match_review_id,review_version,reviewed_by_actor_user_id,reviewed_at,
      reviewer_membership_id,reviewer_membership_version,reviewer_role,reviewer_assignment_id,reviewer_assignment_version,
      target_adapter_namespace,opaque_target_id,expected_target_version,supporting_identity_target_binding_id,
      supporting_binding_version,supporting_binding_source_version,supporting_binding_target_version,
      identity_policy_registry_id,normalization_version,match_policy_version,minimum_evidence_policy_version,
      identity_environment_fingerprint,evidence_set_digest,identity_mutex_keys_digest,projection_snapshot_digest,
      conversion_action_id,relationship_scope_encoding_version,relationship_scope_digest,related_student_target_id,
      related_student_expected_version,related_student_disposition,expires_at
    ) values (
      v_guardian_auth,v_request.center_id,'GUARDIAN',p_conversion_request_id,v_guardian_review.request_version,
      v_guardian_review.action_id,v_guardian_review.action_intent_digest,v_guardian_review.request_action_graph_digest,
      v_guardian_review.crm_contact_id,v_guardian_review.source_contact_version,v_guardian_review.consultation_case_id,
      v_guardian_review.source_case_version,v_guardian_review.match_review_id,v_guardian_review.review_version,
      v_guardian_review.reviewer_user_id,v_guardian_review.decided_at,v_guardian_review.reviewer_membership_id,
      v_guardian_review.reviewer_membership_version,v_guardian_review.reviewer_role,v_guardian_review.reviewer_assignment_id,
      v_guardian_review.reviewer_assignment_version,v_guardian_review.target_adapter_namespace,
      v_guardian_review.opaque_target_id,v_guardian_review.target_version,v_support.identity_target_binding_id,
      v_support.binding_version,v_support.source_version_at_binding,v_support.target_version_at_binding,
      v_guardian_review.identity_policy_registry_id,v_guardian_review.normalization_version,v_guardian_review.match_policy_version,
      v_guardian_review.minimum_evidence_policy_version,v_policy.environment_fingerprint,v_guardian_review.evidence_set_digest,
      v_guardian_review.identity_mutex_keys_digest,v_guardian_review.projection_snapshot_digest,
      v_guardian_action.conversion_action_id,1,v_scope,v_student_action.opaque_target_id,
      v_student_action.expected_target_version,v_student_disposition,
      least(v_guardian_review.expires_at,v_student_review.expires_at));
  end if;
  v_set:=public.f23_3e_p3d_internal_reuse_authorization_set_digest_v1(p_conversion_request_id,'ISSUED');
  perform pg_catalog.set_config('ichess.p3d_r0_plan_binding','on',true);
  update public.crm_conversion_action a set action_set_encoding_version=2,
    reviewed_reuse_authorization_id=case identity_kind when 'STUDENT' then v_student_auth when 'GUARDIAN' then v_guardian_auth end,
    expected_reuse_authorization_version=case when identity_kind='STUDENT' and v_student_auth is not null then 1
      when identity_kind='GUARDIAN' and v_guardian_auth is not null then 1 end,
    relationship_scope_encoding_version=case when conversion_action_id=v_relationship_action.conversion_action_id
      and v_guardian_auth is not null then 1 end,
    relationship_scope_digest=case when conversion_action_id=v_relationship_action.conversion_action_id then v_scope end,
    reuse_authorization_set_encoding_version=1,reuse_authorization_set_digest=v_set
  where a.conversion_request_id=p_conversion_request_id and a.status='PROPOSED';
  v_digest:=public.f23_3e_p3d_internal_action_set_digest_v2(p_conversion_request_id,'PROPOSED');
  select i.idempotency_record_id into v_registry_id from public.crm_idempotency_registry i
    where i.resource_scope_id=p_conversion_request_id and i.operation='conversion.materialize_action_plan'
      and i.idempotency_key_digest=p_idempotency_key_digest and i.status='COMPLETED';
  update public.crm_idempotency_registry i set idempotency_version=i.idempotency_version+1,
    p3_action_set_encoding_version=2,p3_action_set_digest=v_digest,
    p3_reuse_authorization_set_encoding_version=1,p3_reuse_authorization_set_digest=v_set,
    p3_result_snapshot=pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(i.p3_result_snapshot,'{action_set_encoding_version}','2'::jsonb,true),
      '{action_set_digest}',pg_catalog.to_jsonb(pg_catalog.encode(v_digest,'hex')),true),
    terminal_outcome_digest=public.f23_3e_p3b_internal_result_digest(pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(i.p3_result_snapshot,'{action_set_encoding_version}','2'::jsonb,true),
      '{action_set_digest}',pg_catalog.to_jsonb(pg_catalog.encode(v_digest,'hex')),true))
  where i.idempotency_record_id=v_registry_id;
  if v_student_auth is not null then
    perform public.f23_3e_p3b_internal_append_audit_outbox(v_request.center_id,
      'crm.identity.cross_source_reuse_authorization.issued',p_actor_user_id,
      'crm_reviewed_cross_source_reuse_authorization',v_student_auth,p_conversion_request_id,
      v_request.source_assignment_id,null,1,'ISSUED','explicit_human_reviewed_reuse',
      'conversion.materialize_action_plan','CROSS_SOURCE_REUSE_AUTHORIZATION_ISSUED',v_result.correlation_id);
  end if;
  if v_guardian_auth is not null then
    perform public.f23_3e_p3b_internal_append_audit_outbox(v_request.center_id,
      'crm.identity.cross_source_reuse_authorization.issued',p_actor_user_id,
      'crm_reviewed_cross_source_reuse_authorization',v_guardian_auth,p_conversion_request_id,
      v_request.source_assignment_id,null,1,'ISSUED','explicit_human_reviewed_reuse',
      'conversion.materialize_action_plan','CROSS_SOURCE_REUSE_AUTHORIZATION_ISSUED',v_result.correlation_id);
  end if;
  return query select true,v_result.outcome_code,false,v_result.guardian_action_id,v_result.student_action_id,
    v_result.relationship_action_id,v_result.action_versions,v_digest,2,v_result.correlation_id;
end;
$f23_3e_p3c_materialize_reviewed_action_pair$;

create function public.f23_3e_p3d_internal_validate_reuse_authorization_set(
  p_conversion_request_id uuid,p_required_action_status text,p_require_current_reviewer boolean
) returns text language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_validate_reuse_authorization_set$
declare v_request public.crm_conversion_request%rowtype; v_auth record; v_count integer:=0;
  v_scope bytea; v_relationship public.crm_conversion_action%rowtype;
  v_student public.crm_conversion_action%rowtype; v_guardian public.crm_conversion_action%rowtype;
begin
  select * into v_request from public.crm_conversion_request r where r.conversion_request_id=p_conversion_request_id;
  if not found then return 'RESOURCE_NOT_AVAILABLE'; end if;
  select * into v_student from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id and a.identity_kind='STUDENT';
  select * into v_guardian from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id and a.identity_kind='GUARDIAN';
  select * into v_relationship from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id and a.identity_kind is null;
  if v_student.status<>p_required_action_status or v_guardian.status<>p_required_action_status
     or v_relationship.status<>p_required_action_status
     or v_student.action_set_encoding_version<>2 or v_guardian.action_set_encoding_version<>2
     or v_relationship.action_set_encoding_version<>2 then return 'ACTION_SET_ENCODING_STALE'; end if;
  for v_auth in
    select z.*,r.review_status,r.review_action,r.reviewer_user_id,r.reviewer_membership_id review_membership_id,
      r.reviewer_membership_version review_membership_version,r.reviewer_role review_role,
      r.reviewer_assignment_id review_assignment_id,r.reviewer_assignment_version review_assignment_version,
      b.binding_status,b.binding_version current_support_version,b.source_version_at_binding current_support_source_version,
      b.target_version_at_binding current_support_target_version,
      m.status member_status,m.membership_version current_membership_version,m.role current_role,
      a.assignment_status,a.assignment_version current_assignment_version,a.assigned_consultant_user_id
    from public.crm_reviewed_cross_source_reuse_authorization z
    join public.crm_identity_match_review r on r.center_id=z.center_id and r.match_review_id=z.match_review_id
    join public.crm_identity_target_binding b on b.center_id=z.center_id
      and b.identity_target_binding_id=z.supporting_identity_target_binding_id
    join public.center_members m on m.id=z.reviewer_membership_id and m.center_id=z.center_id
    left join public.consultation_case_assignment a on a.assignment_id=z.reviewer_assignment_id
    where z.conversion_request_id=p_conversion_request_id
    order by z.reviewed_reuse_authorization_id
  loop
    v_count:=v_count+1;
    if v_auth.status<>'ISSUED' or v_auth.authorization_version<>1 or v_auth.expires_at<=pg_catalog.transaction_timestamp()
       or v_auth.review_status<>'EXACT_REVIEWED_MATCH' or v_auth.review_action<>'REUSE_EXISTING'
       or v_auth.review_version<>2 or v_auth.reviewer_user_id<>v_auth.reviewed_by_actor_user_id
       or v_auth.review_membership_id<>v_auth.reviewer_membership_id
       or v_auth.review_membership_version<>v_auth.reviewer_membership_version
       or v_auth.review_role<>v_auth.reviewer_role
       or v_auth.review_assignment_id is distinct from v_auth.reviewer_assignment_id
       or v_auth.review_assignment_version is distinct from v_auth.reviewer_assignment_version
       or v_auth.binding_status<>'ACTIVE' or v_auth.current_support_version<>v_auth.supporting_binding_version
       or v_auth.current_support_source_version<>v_auth.supporting_binding_source_version
       or v_auth.current_support_target_version<>v_auth.supporting_binding_target_version then
      return 'REUSE_AUTHORIZATION_STALE';
    end if;
    if p_require_current_reviewer and (v_auth.member_status<>'active'
       or v_auth.current_membership_version<>v_auth.reviewer_membership_version
       or v_auth.current_role<>v_auth.reviewer_role
       or (v_auth.reviewer_role='consultant' and (v_auth.assignment_status<>'ACTIVE'
         or v_auth.current_assignment_version<>v_auth.reviewer_assignment_version
         or v_auth.assigned_consultant_user_id<>v_auth.reviewed_by_actor_user_id))) then
      return 'REVIEWER_CAPABILITY_STALE';
    end if;
    if v_auth.identity_kind='STUDENT' then
      if v_student.reviewed_reuse_authorization_id<>v_auth.reviewed_reuse_authorization_id
         or v_student.expected_reuse_authorization_version<>1
         or v_student.match_review_id<>v_auth.match_review_id
         or v_student.opaque_target_id<>v_auth.opaque_target_id
         or v_student.expected_target_version<>v_auth.expected_target_version
         or not exists(select 1 from public.student_profile s where s.center_id=v_auth.center_id
           and s.student_id=v_auth.opaque_target_id and s.student_version=v_auth.expected_target_version and s.profile_status='ACTIVE')
         or not exists(select 1 from public.consultation_case_candidate_student c
           where c.center_id=v_auth.center_id and c.candidate_student_id=v_auth.source_candidate_student_id
             and c.candidate_version=v_auth.source_candidate_version and c.candidate_status in ('ACTIVE','REVIEW_REQUIRED')) then
        return 'REUSE_AUTHORIZATION_STALE';
      end if;
    elsif v_auth.identity_kind='GUARDIAN' then
      if v_guardian.reviewed_reuse_authorization_id<>v_auth.reviewed_reuse_authorization_id
         or v_guardian.expected_reuse_authorization_version<>1
         or v_guardian.match_review_id<>v_auth.match_review_id
         or v_guardian.opaque_target_id<>v_auth.opaque_target_id
         or v_guardian.expected_target_version<>v_auth.expected_target_version
         or not exists(select 1 from public.guardian_profile g where g.center_id=v_auth.center_id
           and g.guardian_id=v_auth.opaque_target_id and g.guardian_version=v_auth.expected_target_version and g.guardian_status='ACTIVE')
         or not exists(select 1 from public.crm_contact c where c.center_id=v_auth.center_id
           and c.crm_contact_id=v_auth.source_contact_id and c.contact_version=v_auth.source_contact_version
           and c.contact_status<>'ARCHIVED') then return 'REUSE_AUTHORIZATION_STALE'; end if;
      v_scope:=public.f23_3e_p3d_internal_relationship_scope_digest_v1(
        v_request.center_id,p_conversion_request_id,v_relationship.conversion_action_id,
        v_guardian.conversion_action_id,v_student.conversion_action_id,v_auth.related_student_disposition,
        v_guardian.match_review_id,2,v_student.match_review_id,2,
        v_guardian.opaque_target_id,v_guardian.expected_target_version,
        v_student.opaque_target_id,v_student.expected_target_version,
        v_relationship.action_kind,v_relationship.guardian_student_relationship_id,
        v_relationship.expected_relationship_version,v_relationship.relationship_type,
        v_relationship.is_primary_contact,v_relationship.financial_contact_role,
        v_relationship.academic_contact_role,v_relationship.relationship_policy_version,
        v_relationship.safe_reason_code);
      if v_auth.relationship_scope_encoding_version<>1 or v_auth.relationship_scope_digest is distinct from v_scope
         or v_relationship.relationship_scope_encoding_version<>1
         or v_relationship.relationship_scope_digest is distinct from v_scope then return 'RELATIONSHIP_SCOPE_STALE'; end if;
    else return 'REUSE_AUTHORIZATION_STALE'; end if;
  end loop;
  if v_count not between 1 and 2 then return 'REUSE_AUTHORIZATION_SET_INVALID'; end if;
  return 'REUSE_AUTHORIZATION_SET_CURRENT';
end;
$f23_3e_p3d_internal_validate_reuse_authorization_set$;

alter function public.f23_3e_p3c_finalize_reviewed_action_plan(
  uuid,uuid,integer,integer,bytea,bytea,timestamptz
) rename to f23_3e_p3d_internal_checkpoint_finalize_reviewed_action_plan;

create function public.f23_3e_p3c_finalize_reviewed_action_plan(
  p_actor_user_id uuid,p_conversion_request_id uuid,p_expected_request_version integer,
  p_expected_action_count integer,p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns table(ok boolean,outcome_code text,replayed boolean,conversion_request_id uuid,
  action_count integer,finalized_action_set_digest bytea,action_set_encoding_version integer,
  max_action_version integer,correlation_id uuid)
language plpgsql security definer set search_path=''
as $f23_3e_p3c_finalize_reviewed_action_plan$
declare v_result record; v_encoding integer; v_code text; v_set bytea; v_digest bytea;
  v_registry_id uuid;
begin
  select * into v_result from public.f23_3e_p3d_internal_checkpoint_finalize_reviewed_action_plan(
    p_actor_user_id,p_conversion_request_id,p_expected_request_version,p_expected_action_count,
    p_operation_intent_digest,p_idempotency_key_digest,p_idempotency_expires_at);
  -- A completed finalize replay is snapshot-owned and never rehashes later
  -- APPROVED/EXECUTED rows.
  if not coalesce(v_result.ok,false) or coalesce(v_result.replayed,false) then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.conversion_request_id,
      v_result.action_count,v_result.finalized_action_set_digest,v_result.action_set_encoding_version,
      v_result.max_action_version,v_result.correlation_id; return;
  end if;
  select min(a.action_set_encoding_version) into v_encoding from public.crm_conversion_action a
    where a.conversion_request_id=p_conversion_request_id;
  if v_encoding=1 then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.conversion_request_id,
      v_result.action_count,v_result.finalized_action_set_digest,v_encoding,
      v_result.max_action_version,v_result.correlation_id; return;
  end if;
  v_code:=public.f23_3e_p3d_internal_validate_reuse_authorization_set(p_conversion_request_id,'REVIEWED',true);
  if v_code<>'REUSE_AUTHORIZATION_SET_CURRENT' then raise exception using message=v_code,errcode='P0001'; end if;
  v_set:=public.f23_3e_p3d_internal_reuse_authorization_set_digest_v1(p_conversion_request_id,'ISSUED');
  if exists(select 1 from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id
    and (a.reuse_authorization_set_encoding_version<>1 or a.reuse_authorization_set_digest is distinct from v_set)) then
    raise exception 'REUSE_AUTHORIZATION_SET_DIGEST_STALE';
  end if;
  v_digest:=public.f23_3e_p3d_internal_action_set_digest_v2(p_conversion_request_id,'REVIEWED');
  perform pg_catalog.set_config('ichess.p3d_r0_plan_binding','on',true);
  select idempotency_record_id into v_registry_id from public.crm_idempotency_registry
    where resource_scope_id=p_conversion_request_id and operation='conversion.finalize_action_plan'
      and idempotency_key_digest=p_idempotency_key_digest and status='COMPLETED';
  update public.crm_idempotency_registry i set idempotency_version=i.idempotency_version+1,
    p3_action_set_encoding_version=2,p3_action_set_digest=v_digest,
    p3_reuse_authorization_set_encoding_version=1,p3_reuse_authorization_set_digest=v_set,
    p3_result_snapshot=pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(i.p3_result_snapshot,'{action_set_encoding_version}','2'::jsonb,true),
      '{action_set_digest}',pg_catalog.to_jsonb(pg_catalog.encode(v_digest,'hex')),true),
    terminal_outcome_digest=public.f23_3e_p3b_internal_result_digest(pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(i.p3_result_snapshot,'{action_set_encoding_version}','2'::jsonb,true),
      '{action_set_digest}',pg_catalog.to_jsonb(pg_catalog.encode(v_digest,'hex')),true))
    where i.idempotency_record_id=v_registry_id;
  return query select true,v_result.outcome_code,false,v_result.conversion_request_id,
    v_result.action_count,v_digest,2,v_result.max_action_version,v_result.correlation_id;
end;
$f23_3e_p3c_finalize_reviewed_action_plan$;

alter function public.f23_3e_p3b_issue_conversion_authority(
  uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz
) rename to f23_3e_p3d_internal_checkpoint_issue_conversion_authority;

create function public.f23_3e_p3b_issue_conversion_authority(
  p_actor_user_id uuid,p_conversion_request_id uuid,p_step_up_assertion_id uuid,
  p_expected_request_version integer,p_expected_step_up_assertion_version integer,
  p_environment_fingerprint bytea,p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns table(ok boolean,outcome_code text,replayed boolean,conversion_authority_id uuid,
  authority_version integer,request_status text,request_version integer,expires_at timestamptz,
  correlation_id uuid)
language plpgsql security definer set search_path=''
as $f23_3e_p3b_issue_conversion_authority$
declare v_result record; v_encoding integer; v_code text; v_action_digest bytea; v_set bytea;
  v_authority public.crm_conversion_authority%rowtype; v_registry_id uuid; v_auth_expiry timestamptz;
begin
  select min(a.action_set_encoding_version) into v_encoding from public.crm_conversion_action a
    where a.conversion_request_id=p_conversion_request_id and a.status='REVIEWED';
  if v_encoding=2 then
    v_code:=public.f23_3e_p3d_internal_validate_reuse_authorization_set(p_conversion_request_id,'REVIEWED',true);
    if v_code<>'REUSE_AUTHORIZATION_SET_CURRENT' then
      return query select false,v_code,false,null::uuid,null::integer,null::text,null::integer,null::timestamptz,null::uuid;
      return;
    end if;
  end if;
  select * into v_result from public.f23_3e_p3d_internal_checkpoint_issue_conversion_authority(
    p_actor_user_id,p_conversion_request_id,p_step_up_assertion_id,p_expected_request_version,
    p_expected_step_up_assertion_version,p_environment_fingerprint,p_operation_intent_digest,
    p_idempotency_key_digest,p_idempotency_expires_at);
  if not coalesce(v_result.ok,false) or v_encoding is distinct from 2 or v_result.replayed then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.conversion_authority_id,
      v_result.authority_version,v_result.request_status,v_result.request_version,v_result.expires_at,v_result.correlation_id;
    return;
  end if;
  v_code:=public.f23_3e_p3d_internal_validate_reuse_authorization_set(p_conversion_request_id,'APPROVED',true);
  if v_code<>'REUSE_AUTHORIZATION_SET_CURRENT' then raise exception using message=v_code,errcode='P0001'; end if;
  v_action_digest:=public.f23_3e_p3d_internal_action_set_digest_v2(p_conversion_request_id,'APPROVED');
  v_set:=public.f23_3e_p3d_internal_reuse_authorization_set_digest_v1(p_conversion_request_id,'ISSUED');
  select min(a.expires_at) into v_auth_expiry from public.crm_reviewed_cross_source_reuse_authorization a
    where a.conversion_request_id=p_conversion_request_id and a.status='ISSUED';
  select * into v_authority from public.crm_conversion_authority a
    where a.conversion_authority_id=v_result.conversion_authority_id for update;
  perform pg_catalog.set_config('ichess.p3d_r0_authority_binding','on',true);
  update public.crm_conversion_authority a set p3_action_set_encoding_version=2,
    p3_action_set_digest=v_action_digest,p3_reuse_authorization_set_encoding_version=1,
    p3_reuse_authorization_set_digest=v_set,expires_at=least(a.expires_at,v_auth_expiry),
    updated_at=pg_catalog.transaction_timestamp()
  where a.conversion_authority_id=v_authority.conversion_authority_id returning * into v_authority;
  perform pg_catalog.set_config('ichess.p3d_r0_plan_binding','on',true);
  select i.idempotency_record_id into v_registry_id from public.crm_idempotency_registry i
    where i.resource_scope_id=p_conversion_request_id and i.operation='security.issue_conversion_authority'
      and i.idempotency_key_digest=p_idempotency_key_digest and i.status='COMPLETED';
  update public.crm_idempotency_registry i set idempotency_version=i.idempotency_version+1,
    p3_action_set_encoding_version=2,
    p3_action_set_digest=v_action_digest,p3_reuse_authorization_set_encoding_version=1,
    p3_reuse_authorization_set_digest=v_set
  where i.idempotency_record_id=v_registry_id;
  return query select true,v_result.outcome_code,false,v_authority.conversion_authority_id,
    v_authority.authority_version,v_result.request_status,v_result.request_version,
    v_authority.expires_at,v_result.correlation_id;
end;
$f23_3e_p3b_issue_conversion_authority$;

create function public.f23_3e_p3d_internal_identity_mutex_set_digest(
  p_center_id text,p_guardian_keys bytea[],p_student_keys bytea[]
) returns bytea language plpgsql immutable security definer set search_path=''
as $f23_3e_p3d_internal_identity_mutex_set_digest$
declare v bytea; v_record bytea; v_count integer:=0; v_row record;
begin
  v:=public.f23_3e_p3d_internal_text32('ichess.crm.p3.identity-mutex-resource-set.v1')
    ||public.f23_3e_p3c_internal_u16(1)||public.f23_3e_p3d_internal_text32(p_center_id);
  for v_row in
    select kind_rank,key from (
      select 1 kind_rank,k key from pg_catalog.unnest(coalesce(p_guardian_keys,array[]::bytea[])) k
      union select 2,k from pg_catalog.unnest(coalesce(p_student_keys,array[]::bytea[])) k
    ) q order by kind_rank,key
  loop
    if pg_catalog.octet_length(v_row.key)<>32 then raise exception 'IDENTITY_MUTEX_SET_STALE'; end if;
    v_count:=v_count+1;
    v_record:=coalesce(v_record,''::bytea)||public.f23_3e_p3c_internal_u8(v_row.kind_rank)||v_row.key;
  end loop;
  if v_count<2 then raise exception 'IDENTITY_MUTEX_SET_STALE'; end if;
  return extensions.digest(v||public.f23_3e_p3c_internal_u32(v_count)||v_record,'sha256');
end;
$f23_3e_p3d_internal_identity_mutex_set_digest$;

create function public.f23_3e_p3d_internal_assert_no_relock_precondition(
  p_center_id text,p_conversion_request_id uuid,p_locked_identity_mutex_set_digest bytea
) returns void language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_assert_no_relock_precondition$
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest
     or not exists(select 1 from public.crm_conversion_request r
       where r.center_id=p_center_id and r.conversion_request_id=p_conversion_request_id
         and r.status in ('APPROVED','EXECUTING')) then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
end;
$f23_3e_p3d_internal_assert_no_relock_precondition$;

create function public.f23_3e_p3d_internal_validate_student_birth_evidence_no_lock(
  p_center_id text,p_student_id uuid,p_expected_student_version integer,p_birth_evidence_protected bytea
) returns boolean language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_validate_student_birth_evidence_no_lock$
declare v_parsed record; v_payload bytea;
begin
  begin
    select * into strict v_parsed from public.f23_3e_p3d_internal_parse_birth_envelope(p_birth_evidence_protected,'IC3SBE01');
    v_payload:=vault._crypto_aead_det_decrypt(v_parsed.sealed,
      public.f23_3e_p3d_internal_student_birth_aad(p_center_id,p_student_id,v_parsed.key_epoch),
      1::bigint,pg_catalog.convert_to('iC3Std01','UTF8'),v_parsed.nonce);
    perform public.f23_3e_p3d_internal_parse_birth_plaintext(v_payload);
    return true;
  exception when others then return false; end;
end;
$f23_3e_p3d_internal_validate_student_birth_evidence_no_lock$;

create function public.f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock(
  p_center_id text,p_contact_id uuid,p_expected_contact_version integer,
  p_source_envelope bytea,p_source_crypto_version integer,p_guardian_id uuid
) returns table(protected_contact_methods_ciphertext bytea,contact_methods_crypto_version integer)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock$
declare v_parsed record; v_payload bytea; v_nonce bytea; v_sealed bytea;
begin
  if p_source_crypto_version<>2 then raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE'; end if;
  begin
    select * into strict v_parsed from public.f23_3e_p3c_internal_parse_envelope(p_source_envelope,'IC3CSE01');
    v_payload:=vault._crypto_aead_det_decrypt(v_parsed.sealed,
      public.f23_3e_p3c_internal_source_aad(p_center_id,p_contact_id,v_parsed.key_epoch),
      1::bigint,pg_catalog.convert_to('iC3Src01','UTF8'),v_parsed.nonce);
    if pg_catalog.octet_length(v_payload) not between 1 and 65536 then raise exception 'bad payload'; end if;
    v_nonce:=vault._crypto_aead_det_noncegen();
    v_sealed:=vault._crypto_aead_det_encrypt(v_payload,
      public.f23_3e_p3c_internal_guardian_aad(p_center_id,p_guardian_id,1),
      1::bigint,pg_catalog.convert_to('iC3Gdn01','UTF8'),v_nonce);
    if pg_catalog.octet_length(v_nonce)<>16 or pg_catalog.octet_length(v_sealed) not between 33 and 65568 then raise exception 'bad target'; end if;
    protected_contact_methods_ciphertext:=pg_catalog.convert_to('IC3GTE01','UTF8')
      ||public.f23_3e_p3c_internal_u8(1)||public.f23_3e_p3c_internal_u8(1)
      ||public.f23_3e_p3c_internal_u32(1)||public.f23_3e_p3c_internal_u16(16)||v_nonce
      ||public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))||v_sealed;
    contact_methods_crypto_version:=1; return next;
  exception when others then raise exception 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE'; end;
end;
$f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock$;

create function public.f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock(
  p_center_id text,p_guardian_id uuid,p_expected_guardian_version integer,
  p_protected_contact_methods_ciphertext bytea,p_contact_methods_crypto_version integer
) returns boolean language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock$
declare v_parsed record; v_payload bytea;
begin
  if p_contact_methods_crypto_version<>1 then return false; end if;
  begin
    select * into strict v_parsed from public.f23_3e_p3c_internal_parse_envelope(p_protected_contact_methods_ciphertext,'IC3GTE01');
    v_payload:=vault._crypto_aead_det_decrypt(v_parsed.sealed,
      public.f23_3e_p3c_internal_guardian_aad(p_center_id,p_guardian_id,v_parsed.key_epoch),
      1::bigint,pg_catalog.convert_to('iC3Gdn01','UTF8'),v_parsed.nonce);
    return pg_catalog.octet_length(v_payload) between 1 and 65536;
  exception when others then return false; end;
end;
$f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock$;

create function public.f23_3e_p3d_internal_create_student_target_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_conversion_action_id uuid,p_actor_user_id uuid,
  p_candidate_student_id uuid,p_expected_candidate_version integer,p_match_review_id uuid,
  p_expected_review_version integer,p_reservation_id uuid,p_expected_reservation_version integer,
  p_preallocated_student_id uuid,p_display_name_evidence text,p_birth_date_evidence date,
  p_identity_policy_registry_id uuid,p_expected_normalization_version integer,
  p_expected_match_policy_version integer,p_expected_minimum_evidence_policy_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(student_id uuid,student_version integer,outcome_code text)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_create_student_target_no_relock$
declare v_request public.crm_conversion_request%rowtype; v_action public.crm_conversion_action%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype; v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype; v_policy public.crm_identity_policy_registry%rowtype;
  v_key bytea; v_name bytea; v_birth bytea; v_identity bytea; v_protected bytea;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  select * into v_request from public.crm_conversion_request where center_id=p_center_id and conversion_request_id=p_conversion_request_id;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_conversion_action_id;
  select * into v_candidate from public.consultation_case_candidate_student where center_id=p_center_id and candidate_student_id=p_candidate_student_id;
  select * into v_review from public.crm_identity_match_review where center_id=p_center_id and match_review_id=p_match_review_id;
  select * into v_reservation from public.crm_profile_creation_reservation where center_id=p_center_id and reservation_id=p_reservation_id;
  select * into v_policy from public.crm_identity_policy_registry where center_id=p_center_id and identity_policy_registry_id=p_identity_policy_registry_id and status='CURRENT';
  if v_action.action_kind<>'CREATE_NEW_STUDENT' or v_action.status<>'APPROVED' or v_action.action_version<>3
     or v_action.conversion_request_id<>p_conversion_request_id or v_action.source_candidate_student_id<>p_candidate_student_id
     or v_action.match_review_id<>p_match_review_id or v_action.profile_creation_reservation_id<>p_reservation_id
     or v_candidate.candidate_version<>p_expected_candidate_version
     or v_review.review_version<>p_expected_review_version or v_review.review_status<>'CREATE_NEW_REVIEWED'
     or v_review.review_action<>'PREPARE_CREATE_NEW' or v_review.match_outcome<>'NO_MATCH'
     or v_reservation.reservation_version<>p_expected_reservation_version or v_reservation.status<>'ACTIVE'
     or v_reservation.preallocated_target_id<>p_preallocated_student_id or v_reservation.expires_at<=pg_catalog.transaction_timestamp()
     or v_reservation.target_adapter_namespace<>'canonical.student_profile.v1'
     or v_policy.normalization_version<>p_expected_normalization_version
     or v_policy.match_policy_version<>p_expected_match_policy_version
     or v_policy.minimum_evidence_policy_version<>p_expected_minimum_evidence_policy_version
     or exists(select 1 from public.student_profile s where s.center_id=p_center_id and s.student_id=p_preallocated_student_id) then
    raise exception 'CREATE_STUDENT_TARGET_EVIDENCE_STALE';
  end if;
  v_key:=public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_name:=public.f23_3e_p2b_internal_evidence_digest(v_key,v_policy.normalization_algorithm,v_policy.normalization_version,
    'STUDENT','STUDENT_DISPLAY_NAME',public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence),v_policy.digest_key_epoch);
  v_birth:=public.f23_3e_p2b_internal_evidence_digest(v_key,v_policy.normalization_algorithm,v_policy.normalization_version,
    'STUDENT','STUDENT_BIRTH_DATE',public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence),v_policy.digest_key_epoch);
  v_identity:=extensions.digest(v_review.evidence_set_digest||v_reservation.source_evidence_digest||v_name||v_birth,'sha256');
  v_protected:=public.f23_3e_p3d_internal_protect_student_birth_evidence(p_center_id,p_preallocated_student_id,p_birth_date_evidence);
  insert into public.student_profile(student_id,center_id,display_name,birth_evidence_protected,profile_status,
    learning_lifecycle_status,identity_policy_registry_id,normalization_version,match_policy_version,
    minimum_evidence_policy_version,name_lookup_digest,birth_lookup_digest,identity_evidence_digest,student_version,
    created_from_case_id,created_from_candidate_id,created_from_request_id,created_from_action_id,created_by_user_id)
  values(p_preallocated_student_id,p_center_id,p_display_name_evidence,v_protected,'ACTIVE',null,p_identity_policy_registry_id,
    p_expected_normalization_version,p_expected_match_policy_version,p_expected_minimum_evidence_policy_version,
    v_name,v_birth,v_identity,1,v_request.consultation_case_id,p_candidate_student_id,p_conversion_request_id,
    p_conversion_action_id,p_actor_user_id);
  student_id:=p_preallocated_student_id; student_version:=1; outcome_code:='STUDENT_CREATED'; return next;
end;
$f23_3e_p3d_internal_create_student_target_no_relock$;

create function public.f23_3e_p3d_internal_resolve_reusable_student_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_conversion_action_id uuid,
  p_source_candidate_student_id uuid,p_expected_source_candidate_version integer,
  p_match_review_id uuid,p_expected_review_version integer,p_student_id uuid,
  p_expected_student_version integer,p_reviewed_reuse_authorization_id uuid,
  p_expected_reuse_authorization_version integer,p_locked_identity_mutex_set_digest bytea
) returns table(reuse_eligible boolean,student_id uuid,student_version integer,outcome_code text)
language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_resolve_reusable_student_no_relock$
declare v_action public.crm_conversion_action%rowtype; v_auth public.crm_reviewed_cross_source_reuse_authorization%rowtype;
  v_student public.student_profile%rowtype; v_candidate public.consultation_case_candidate_student%rowtype;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_conversion_action_id;
  select * into v_auth from public.crm_reviewed_cross_source_reuse_authorization where center_id=p_center_id and reviewed_reuse_authorization_id=p_reviewed_reuse_authorization_id;
  select * into v_student from public.student_profile where center_id=p_center_id and public.student_profile.student_id=p_student_id;
  select * into v_candidate from public.consultation_case_candidate_student where center_id=p_center_id and candidate_student_id=p_source_candidate_student_id;
  reuse_eligible:=v_action.action_kind='REUSE_REVIEWED_STUDENT' and v_action.status='APPROVED' and v_action.action_version=3
    and v_action.conversion_request_id=p_conversion_request_id and v_action.match_review_id=p_match_review_id
    and v_action.reviewed_reuse_authorization_id is not distinct from p_reviewed_reuse_authorization_id
    and v_action.expected_reuse_authorization_version is not distinct from p_expected_reuse_authorization_version
    and v_candidate.candidate_version=p_expected_source_candidate_version
    and v_student.student_version=p_expected_student_version and v_student.profile_status='ACTIVE'
    and public.f23_3e_p3d_internal_validate_student_birth_evidence_no_lock(p_center_id,p_student_id,p_expected_student_version,v_student.birth_evidence_protected)
    and ((p_reviewed_reuse_authorization_id is not null
      and v_auth.status='ISSUED' and v_auth.authorization_version=p_expected_reuse_authorization_version
      and v_auth.expires_at>pg_catalog.transaction_timestamp() and v_auth.match_review_id=p_match_review_id
      and v_auth.review_version=p_expected_review_version and v_auth.source_candidate_student_id=p_source_candidate_student_id
      and v_auth.source_candidate_version=p_expected_source_candidate_version and v_auth.opaque_target_id=p_student_id
      and v_auth.expected_target_version=p_expected_student_version
      and not exists(select 1 from public.crm_identity_target_binding b where b.center_id=p_center_id
        and b.identity_kind='STUDENT' and b.source_candidate_student_id=p_source_candidate_student_id and b.binding_status='ACTIVE'))
      or (p_reviewed_reuse_authorization_id is null and p_expected_reuse_authorization_version is null
        and exists(select 1 from public.crm_identity_target_binding b where b.center_id=p_center_id
          and b.identity_kind='STUDENT' and b.source_candidate_student_id=p_source_candidate_student_id
          and b.student_id=p_student_id and b.binding_status='ACTIVE'
          and b.source_version_at_binding=p_expected_source_candidate_version
          and b.target_version_at_binding=p_expected_student_version)));
  if not reuse_eligible then raise exception 'STUDENT_REUSE_AUTHORIZATION_STALE'; end if;
  student_id:=p_student_id; student_version:=p_expected_student_version; outcome_code:='STUDENT_REUSED'; return next;
end;
$f23_3e_p3d_internal_resolve_reusable_student_no_relock$;

create function public.f23_3e_p3d_internal_create_guardian_target_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_conversion_action_id uuid,p_actor_user_id uuid,
  p_source_contact_id uuid,p_expected_contact_version integer,p_match_review_id uuid,
  p_expected_review_version integer,p_reservation_id uuid,p_expected_reservation_version integer,
  p_preallocated_guardian_id uuid,p_identity_policy_registry_id uuid,p_expected_normalization_version integer,
  p_expected_match_policy_version integer,p_expected_minimum_evidence_policy_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(guardian_id uuid,guardian_version integer,outcome_code text)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_create_guardian_target_no_relock$
declare v_request public.crm_conversion_request%rowtype; v_action public.crm_conversion_action%rowtype;
  v_contact public.crm_contact%rowtype; v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype; v_policy public.crm_identity_policy_registry%rowtype;
  v_protected record; v_key bytea; v_name bytea; v_lookup bytea[]; v_identity bytea;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  select * into v_request from public.crm_conversion_request where center_id=p_center_id and conversion_request_id=p_conversion_request_id;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_conversion_action_id;
  select * into v_contact from public.crm_contact where center_id=p_center_id and crm_contact_id=p_source_contact_id;
  select * into v_review from public.crm_identity_match_review where center_id=p_center_id and match_review_id=p_match_review_id;
  select * into v_reservation from public.crm_profile_creation_reservation where center_id=p_center_id and reservation_id=p_reservation_id;
  select * into v_policy from public.crm_identity_policy_registry where center_id=p_center_id and identity_policy_registry_id=p_identity_policy_registry_id and status='CURRENT';
  if v_action.action_kind<>'CREATE_NEW_GUARDIAN' or v_action.status<>'APPROVED' or v_action.action_version<>3
     or v_action.conversion_request_id<>p_conversion_request_id or v_action.source_contact_id<>p_source_contact_id
     or v_action.match_review_id<>p_match_review_id or v_action.profile_creation_reservation_id<>p_reservation_id
     or v_contact.contact_version<>p_expected_contact_version or v_contact.contact_status='ARCHIVED'
     or v_review.review_version<>p_expected_review_version or v_review.review_status<>'CREATE_NEW_REVIEWED'
     or v_review.review_action<>'PREPARE_CREATE_NEW' or v_review.match_outcome<>'NO_MATCH'
     or v_reservation.reservation_version<>p_expected_reservation_version or v_reservation.status<>'ACTIVE'
     or v_reservation.preallocated_target_id<>p_preallocated_guardian_id or v_reservation.expires_at<=pg_catalog.transaction_timestamp()
     or v_reservation.target_adapter_namespace<>'canonical.guardian_profile.v1'
     or v_policy.normalization_version<>p_expected_normalization_version
     or v_policy.match_policy_version<>p_expected_match_policy_version
     or v_policy.minimum_evidence_policy_version<>p_expected_minimum_evidence_policy_version
     or exists(select 1 from public.guardian_profile g where g.center_id=p_center_id and g.guardian_id=p_preallocated_guardian_id) then
    raise exception 'CREATE_GUARDIAN_TARGET_EVIDENCE_STALE';
  end if;
  select * into strict v_protected from public.f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock(
    p_center_id,p_source_contact_id,p_expected_contact_version,v_contact.protected_contact_methods_ciphertext,
    v_contact.contact_methods_crypto_version,p_preallocated_guardian_id);
  v_key:=public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_name:=public.f23_3e_p2b_internal_evidence_digest(v_key,v_policy.normalization_algorithm,v_policy.normalization_version,
    'GUARDIAN','GUARDIAN_DISPLAY_NAME',public.f23_3e_p2b_internal_normalize_student_name_v1(v_contact.display_name),v_policy.digest_key_epoch);
  select pg_catalog.array_agg(x.v order by x.v) into v_lookup from (
    select v_name v union select distinct d from pg_catalog.unnest(v_contact.normalized_lookup_digests) d) x;
  v_identity:=extensions.digest(v_review.evidence_set_digest||v_reservation.source_evidence_digest||
    public.f23_3e_p3c_internal_crypto_environment_fingerprint(),'sha256');
  insert into public.guardian_profile(guardian_id,center_id,display_name,protected_contact_methods_ciphertext,
    contact_methods_crypto_version,normalized_lookup_digests,normalization_version,identity_evidence_digest,
    guardian_status,guardian_version,created_from_contact_id,created_from_case_id,created_from_request_id,
    created_from_action_id,created_by_user_id)
  values(p_preallocated_guardian_id,p_center_id,v_contact.display_name,v_protected.protected_contact_methods_ciphertext,
    v_protected.contact_methods_crypto_version,v_lookup,p_expected_normalization_version,v_identity,'ACTIVE',1,
    p_source_contact_id,v_request.consultation_case_id,p_conversion_request_id,p_conversion_action_id,p_actor_user_id);
  guardian_id:=p_preallocated_guardian_id; guardian_version:=1; outcome_code:='GUARDIAN_CREATED'; return next;
end;
$f23_3e_p3d_internal_create_guardian_target_no_relock$;

create function public.f23_3e_p3d_internal_resolve_reusable_guardian_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_conversion_action_id uuid,p_source_contact_id uuid,
  p_expected_source_contact_version integer,p_match_review_id uuid,p_expected_review_version integer,
  p_guardian_id uuid,p_expected_guardian_version integer,p_reviewed_reuse_authorization_id uuid,
  p_expected_reuse_authorization_version integer,p_locked_identity_mutex_set_digest bytea
) returns table(reuse_eligible boolean,guardian_id uuid,guardian_version integer,outcome_code text)
language plpgsql stable security definer set search_path=''
as $f23_3e_p3d_internal_resolve_reusable_guardian_no_relock$
declare v_action public.crm_conversion_action%rowtype; v_auth public.crm_reviewed_cross_source_reuse_authorization%rowtype;
  v_guardian public.guardian_profile%rowtype; v_contact public.crm_contact%rowtype;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_conversion_action_id;
  select * into v_auth from public.crm_reviewed_cross_source_reuse_authorization where center_id=p_center_id and reviewed_reuse_authorization_id=p_reviewed_reuse_authorization_id;
  select * into v_guardian from public.guardian_profile where center_id=p_center_id and public.guardian_profile.guardian_id=p_guardian_id;
  select * into v_contact from public.crm_contact where center_id=p_center_id and crm_contact_id=p_source_contact_id;
  reuse_eligible:=v_action.action_kind='REUSE_REVIEWED_GUARDIAN' and v_action.status='APPROVED' and v_action.action_version=3
    and v_action.conversion_request_id=p_conversion_request_id and v_action.match_review_id=p_match_review_id
    and v_action.reviewed_reuse_authorization_id is not distinct from p_reviewed_reuse_authorization_id
    and v_action.expected_reuse_authorization_version is not distinct from p_expected_reuse_authorization_version
    and v_contact.contact_version=p_expected_source_contact_version and v_contact.contact_status<>'ARCHIVED'
    and v_guardian.guardian_version=p_expected_guardian_version and v_guardian.guardian_status='ACTIVE'
    and public.f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock(p_center_id,p_guardian_id,
      p_expected_guardian_version,v_guardian.protected_contact_methods_ciphertext,v_guardian.contact_methods_crypto_version)
    and ((p_reviewed_reuse_authorization_id is not null
      and v_auth.status='ISSUED' and v_auth.authorization_version=p_expected_reuse_authorization_version
      and v_auth.expires_at>pg_catalog.transaction_timestamp() and v_auth.match_review_id=p_match_review_id
      and v_auth.review_version=p_expected_review_version and v_auth.source_contact_id=p_source_contact_id
      and v_auth.source_contact_version=p_expected_source_contact_version and v_auth.opaque_target_id=p_guardian_id
      and v_auth.expected_target_version=p_expected_guardian_version
      and not exists(select 1 from public.crm_identity_target_binding b where b.center_id=p_center_id
        and b.identity_kind='GUARDIAN' and b.source_contact_id=p_source_contact_id and b.binding_status='ACTIVE'))
      or (p_reviewed_reuse_authorization_id is null and p_expected_reuse_authorization_version is null
        and exists(select 1 from public.crm_identity_target_binding b where b.center_id=p_center_id
          and b.identity_kind='GUARDIAN' and b.source_contact_id=p_source_contact_id
          and b.guardian_id=p_guardian_id and b.binding_status='ACTIVE'
          and b.source_version_at_binding=p_expected_source_contact_version
          and b.target_version_at_binding=p_expected_guardian_version)));
  if not reuse_eligible then raise exception 'GUARDIAN_REUSE_AUTHORIZATION_STALE'; end if;
  guardian_id:=p_guardian_id; guardian_version:=p_expected_guardian_version; outcome_code:='GUARDIAN_REUSED'; return next;
end;
$f23_3e_p3d_internal_resolve_reusable_guardian_no_relock$;

create function public.f23_3e_p3d_internal_commit_identity_target_binding_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_conversion_action_id uuid,p_match_review_id uuid,
  p_identity_kind text,p_binding_mode text,p_source_contact_id uuid,p_source_candidate_student_id uuid,
  p_expected_source_version integer,p_target_adapter_namespace text,p_target_id uuid,p_expected_target_version integer,
  p_reviewed_reuse_authorization_id uuid,p_expected_reuse_authorization_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(identity_target_binding_id uuid,binding_version integer,outcome_code text)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_commit_identity_target_binding_no_relock$
declare v_existing public.crm_identity_target_binding%rowtype; v_action public.crm_conversion_action%rowtype;
  v_auth public.crm_reviewed_cross_source_reuse_authorization%rowtype;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  if p_binding_mode not in ('CREATE_ORIGIN','VERIFY_EXACT_SOURCE','COMMIT_CROSS_SOURCE_REUSE') then raise exception 'BINDING_MODE_INVALID'; end if;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_conversion_action_id;
  select * into v_existing from public.crm_identity_target_binding b where b.center_id=p_center_id and b.identity_kind=p_identity_kind
    and b.binding_status='ACTIVE' and ((p_identity_kind='STUDENT' and b.source_candidate_student_id=p_source_candidate_student_id)
      or (p_identity_kind='GUARDIAN' and b.source_contact_id=p_source_contact_id));
  if found then
    if p_binding_mode='VERIFY_EXACT_SOURCE'
       and coalesce(v_existing.student_id,v_existing.guardian_id)=p_target_id
       and v_existing.source_version_at_binding=p_expected_source_version
       and v_existing.target_version_at_binding=p_expected_target_version then
      identity_target_binding_id:=v_existing.identity_target_binding_id; binding_version:=v_existing.binding_version;
      outcome_code:='IDENTITY_TARGET_BINDING_VERIFIED'; return next; return;
    end if;
    raise exception 'BINDING_CONFLICT';
  end if;
  if p_binding_mode='VERIFY_EXACT_SOURCE' then raise exception 'BINDING_CONFLICT'; end if;
  if p_binding_mode='COMMIT_CROSS_SOURCE_REUSE' then
    select * into v_auth from public.crm_reviewed_cross_source_reuse_authorization
      where reviewed_reuse_authorization_id=p_reviewed_reuse_authorization_id;
    if not found or v_auth.status<>'ISSUED' or v_auth.authorization_version<>p_expected_reuse_authorization_version
       or v_auth.conversion_request_id<>p_conversion_request_id or v_auth.conversion_action_id<>p_conversion_action_id
       or v_auth.opaque_target_id<>p_target_id then raise exception 'REUSE_AUTHORIZATION_STALE'; end if;
  elsif p_reviewed_reuse_authorization_id is not null then raise exception 'BINDING_EVIDENCE_STALE'; end if;
  insert into public.crm_identity_target_binding(center_id,identity_kind,source_contact_id,source_candidate_student_id,
    student_id,guardian_id,binding_status,binding_version,source_version_at_binding,target_version_at_binding,
    originating_request_id,originating_action_id,originating_review_id,reviewed_reuse_authorization_id)
  values(p_center_id,p_identity_kind,case when p_identity_kind='GUARDIAN' then p_source_contact_id end,
    case when p_identity_kind='STUDENT' then p_source_candidate_student_id end,
    case when p_identity_kind='STUDENT' then p_target_id end,case when p_identity_kind='GUARDIAN' then p_target_id end,
    'ACTIVE',1,p_expected_source_version,p_expected_target_version,p_conversion_request_id,p_conversion_action_id,
    p_match_review_id,p_reviewed_reuse_authorization_id)
  returning public.crm_identity_target_binding.identity_target_binding_id,public.crm_identity_target_binding.binding_version
    into identity_target_binding_id,binding_version;
  outcome_code:='IDENTITY_TARGET_BINDING_CREATED'; return next;
end;
$f23_3e_p3d_internal_commit_identity_target_binding_no_relock$;

create function public.f23_3e_p3d_internal_upsert_relationship_no_relock(
  p_center_id text,p_conversion_request_id uuid,p_relationship_action_id uuid,p_actor_user_id uuid,
  p_guardian_action_id uuid,p_student_action_id uuid,p_guardian_id uuid,p_expected_guardian_version integer,
  p_student_id uuid,p_expected_student_version integer,p_guardian_student_relationship_id uuid,
  p_expected_relationship_version integer,p_relationship_scope_encoding_version integer,
  p_relationship_scope_digest bytea,p_locked_identity_mutex_set_digest bytea
) returns table(relationship_id uuid,relationship_version integer,outcome_code text)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_upsert_relationship_no_relock$
declare v_action public.crm_conversion_action%rowtype; v_guardian_action public.crm_conversion_action%rowtype;
  v_student_action public.crm_conversion_action%rowtype; v_existing public.guardian_student_relationship%rowtype;
  v_scope bytea;
begin
  if pg_catalog.current_setting('ichess.p3d_executor',true)<>'on'
     or pg_catalog.octet_length(p_locked_identity_mutex_set_digest)<>32
     or pg_catalog.decode(pg_catalog.current_setting('ichess.p3d_locked_identity_set_digest',true),'hex')
        is distinct from p_locked_identity_mutex_set_digest then
    raise exception 'EXECUTOR_LOCK_PRECONDITION_FAILED';
  end if;
  select * into v_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_relationship_action_id;
  select * into v_guardian_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_guardian_action_id;
  select * into v_student_action from public.crm_conversion_action where center_id=p_center_id and conversion_action_id=p_student_action_id;
  if v_action.status<>'APPROVED' or v_guardian_action.status<>'APPROVED' or v_student_action.status<>'APPROVED'
     or v_action.action_version<>3 or v_action.guardian_action_id<>p_guardian_action_id
     or v_action.student_action_id<>p_student_action_id
     or not exists(select 1 from public.guardian_profile g where g.center_id=p_center_id and g.guardian_id=p_guardian_id
       and g.guardian_version=p_expected_guardian_version and g.guardian_status='ACTIVE')
     or not exists(select 1 from public.student_profile s where s.center_id=p_center_id and s.student_id=p_student_id
       and s.student_version=p_expected_student_version and s.profile_status='ACTIVE') then raise exception 'RELATIONSHIP_ENDPOINT_STALE'; end if;
  if v_action.action_set_encoding_version=2 then
    if p_relationship_scope_encoding_version<>1 then raise exception 'RELATIONSHIP_SCOPE_ENCODING_UNSUPPORTED'; end if;
    v_scope:=public.f23_3e_p3d_internal_relationship_scope_digest_v1(p_center_id,p_conversion_request_id,
    p_relationship_action_id,p_guardian_action_id,p_student_action_id,
    case v_student_action.action_kind when 'CREATE_NEW_STUDENT' then 'CREATE' when 'REUSE_REVIEWED_STUDENT' then 'REUSE' else 'NONE' end,
    v_guardian_action.match_review_id,2,v_student_action.match_review_id,2,p_guardian_id,p_expected_guardian_version,
    p_student_id,p_expected_student_version,v_action.action_kind,v_action.guardian_student_relationship_id,
    v_action.expected_relationship_version,v_action.relationship_type,v_action.is_primary_contact,
      v_action.financial_contact_role,v_action.academic_contact_role,v_action.relationship_policy_version,v_action.safe_reason_code);
    if v_scope is distinct from p_relationship_scope_digest or v_action.relationship_scope_digest is distinct from v_scope then
      raise exception 'RELATIONSHIP_SCOPE_STALE'; end if;
  elsif p_relationship_scope_encoding_version is not null or p_relationship_scope_digest is not null then
    raise exception 'RELATIONSHIP_SCOPE_STALE';
  end if;
  perform pg_catalog.set_config('ichess.p3c_relationship_write','on',true);
  if v_action.action_kind='CREATE_RELATIONSHIP' then
    insert into public.guardian_student_relationship(center_id,guardian_id,student_id,relationship_type,is_primary_contact,
      financial_contact_role,academic_contact_role,status,relationship_version,created_from_request_id,
      created_from_action_id,created_by_user_id)
    values(p_center_id,p_guardian_id,p_student_id,v_action.relationship_type,v_action.is_primary_contact,
      v_action.financial_contact_role,v_action.academic_contact_role,'ACTIVE',1,p_conversion_request_id,
      p_relationship_action_id,p_actor_user_id)
    returning public.guardian_student_relationship.relationship_id,public.guardian_student_relationship.relationship_version
      into relationship_id,relationship_version;
    outcome_code:='RELATIONSHIP_CREATED'; return next; return;
  end if;
  select * into v_existing from public.guardian_student_relationship r where r.center_id=p_center_id
    and r.relationship_id=p_guardian_student_relationship_id;
  if not found or v_existing.guardian_id<>p_guardian_id or v_existing.student_id<>p_student_id
     or v_existing.status<>'ACTIVE' or v_existing.relationship_version<>p_expected_relationship_version then
    raise exception 'RELATIONSHIP_VERSION_STALE'; end if;
  if v_action.action_kind='REUSE_EXISTING_RELATIONSHIP' then
    relationship_id:=v_existing.relationship_id;relationship_version:=v_existing.relationship_version;
    outcome_code:='RELATIONSHIP_REUSED';return next;return;
  elsif v_action.action_kind='UPDATE_APPROVED_RELATIONSHIP_ROLE' then
    update public.guardian_student_relationship r set relationship_type=v_action.relationship_type,
      is_primary_contact=v_action.is_primary_contact,financial_contact_role=v_action.financial_contact_role,
      academic_contact_role=v_action.academic_contact_role,relationship_version=r.relationship_version+1,
      updated_at=pg_catalog.transaction_timestamp() where r.relationship_id=v_existing.relationship_id
    returning public.guardian_student_relationship.relationship_id,public.guardian_student_relationship.relationship_version
      into relationship_id,relationship_version;
    outcome_code:='RELATIONSHIP_UPDATED';return next;return;
  end if;
  raise exception 'RELATIONSHIP_DECISION_REQUIRED';
end;
$f23_3e_p3d_internal_upsert_relationship_no_relock$;








-- R0 single-plan invalidation. This helper never repairs or resurrects a
-- Request: it terminalizes the only plan so recovery must use a fresh Request.
create function public.f23_3e_p3d_internal_invalidate_single_plan_request(
  p_center_id text,p_conversion_request_id uuid,p_expected_request_version integer,
  p_conversion_authority_id uuid,p_expected_authority_version integer,
  p_conversion_authority_terminal_status text,p_event_actor_user_id uuid,
  p_invalidation_reason_code text,p_operation text,p_correlation_id uuid
) returns table(request_status text,request_version integer,
  invalidated_authorization_count integer,superseded_action_count integer,
  terminalized_reservation_count integer)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_invalidate_single_plan_request$
declare
  v_request public.crm_conversion_request%rowtype; v_auth record; v_reservation record;
  v_action_status text; v_action_version integer; v_auth_count integer:=0;
  v_action_count integer; v_reservation_count integer:=0;
begin
  if p_center_id is null or p_conversion_request_id is null
     or p_expected_request_version is null or p_event_actor_user_id is null or p_correlation_id is null
     or p_invalidation_reason_code not in ('authorization_expired','review_or_source_stale',
       'target_or_support_stale','relationship_scope_stale','plan_superseded','conversion_authority_terminal')
     or p_operation not in ('security.revoke_or_expire_conversion_authority',
       'crm.identity.expire_match_review','crm.identity.supersede_match_review')
     or ((p_conversion_authority_id is null or p_expected_authority_version is null
          or p_conversion_authority_terminal_status is null)
         and not (p_conversion_authority_id is null and p_expected_authority_version is null
                  and p_conversion_authority_terminal_status is null))
     or (p_conversion_authority_id is not null
         and p_conversion_authority_terminal_status not in ('REVOKED','EXPIRED')) then
    raise exception 'PLAN_INVALIDATION_INPUT_INVALID';
  end if;
  select * into v_request from public.crm_conversion_request r
  where r.center_id=p_center_id and r.conversion_request_id=p_conversion_request_id;
  if not found or v_request.request_version<>p_expected_request_version
     or v_request.status not in ('READY_FOR_REVIEW','APPROVED') then
    raise exception 'PLAN_INVALIDATION_REQUEST_STALE';
  end if;
  if p_conversion_authority_id is not null and not exists(
    select 1 from public.crm_conversion_authority a
    where a.center_id=p_center_id and a.conversion_authority_id=p_conversion_authority_id
      and a.conversion_request_id=p_conversion_request_id
      and a.authority_version=p_expected_authority_version+1
      and a.status=p_conversion_authority_terminal_status) then
    raise exception 'PLAN_INVALIDATION_AUTHORITY_STALE';
  end if;
  select count(*),min(a.status),min(a.action_version)
    into v_action_count,v_action_status,v_action_version
  from public.crm_conversion_action a where a.center_id=p_center_id
    and a.conversion_request_id=p_conversion_request_id;
  if v_action_count<>3 or v_action_status not in ('PROPOSED','REVIEWED','APPROVED')
     or exists(select 1 from public.crm_conversion_action a
       where a.center_id=p_center_id and a.conversion_request_id=p_conversion_request_id
         and (a.status<>v_action_status or a.action_version<>v_action_version))
     or (v_request.status='APPROVED') is distinct from (v_action_status='APPROVED') then
    raise exception 'PLAN_INVALIDATION_ACTION_SET_STALE';
  end if;
  if exists(select 1 from public.crm_reviewed_cross_source_reuse_authorization a
    where a.center_id=p_center_id and a.conversion_request_id=p_conversion_request_id
      and a.status='CONSUMED') then raise exception 'PLAN_INVALIDATION_AUTHORIZATION_CONSUMED'; end if;

  perform pg_catalog.set_config('ichess.p3d_plan_invalidation','on',true);
  for v_auth in
    update public.crm_reviewed_cross_source_reuse_authorization a set
      status='INVALIDATED',authorization_version=a.authorization_version+1,
      terminal_reason_code=p_invalidation_reason_code,invalidated_by_operation=p_operation
    where a.center_id=p_center_id and a.conversion_request_id=p_conversion_request_id
      and a.status='ISSUED' and a.authorization_version=1 returning a.*
  loop
    v_auth_count:=v_auth_count+1;
    perform public.f23_3e_p3b_internal_append_audit_outbox(
      p_center_id,'crm.identity.cross_source_reuse_authorization.invalidated',p_event_actor_user_id,
      'crm_reviewed_cross_source_reuse_authorization',v_auth.reviewed_reuse_authorization_id,
      p_conversion_request_id,v_request.source_assignment_id,1,2,'INVALIDATED',
      p_invalidation_reason_code,p_operation,'CROSS_SOURCE_REUSE_AUTHORIZATION_INVALIDATED',p_correlation_id);
  end loop;
  for v_reservation in
    update public.crm_profile_creation_reservation r set
      status=case when pg_catalog.transaction_timestamp()>=r.expires_at then 'EXPIRED' else 'SUPERSEDED' end,
      reservation_version=r.reservation_version+1
    where r.center_id=p_center_id and r.conversion_request_id=p_conversion_request_id and r.status='ACTIVE'
    returning r.*
  loop
    v_reservation_count:=v_reservation_count+1;
    perform public.f23_3e_p3b_internal_append_audit_outbox(
      p_center_id,case when v_reservation.status='EXPIRED' then 'crm.identity.creation_reservation_expired'
        else 'crm.identity.creation_reservation_superseded' end,p_event_actor_user_id,
      'profile_creation_reservation',v_reservation.reservation_id,p_conversion_request_id,
      v_request.source_assignment_id,v_reservation.reservation_version-1,v_reservation.reservation_version,
      v_reservation.status,case when v_reservation.status='EXPIRED' then 'SERVER_TIME_EXPIRED'
        else 'plan_superseded' end,p_operation,case when v_reservation.status='EXPIRED'
        then 'CREATION_RESERVATION_EXPIRED' else 'CREATION_RESERVATION_SUPERSEDED' end,p_correlation_id);
  end loop;
  update public.crm_conversion_action a set status='SUPERSEDED',action_version=a.action_version+1,
    updated_at=pg_catalog.transaction_timestamp()
  where a.center_id=p_center_id and a.conversion_request_id=p_conversion_request_id;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id,'crm.conversion.action-plan.invalidated',p_event_actor_user_id,
    'crm_conversion_action_plan',p_conversion_request_id,p_conversion_request_id,
    v_request.source_assignment_id,v_action_version,v_action_version+1,'SUPERSEDED',
    p_invalidation_reason_code,p_operation,'CONVERSION_ACTION_PLAN_INVALIDATED',p_correlation_id);
  update public.crm_conversion_request r set status='SUPERSEDED',request_version=r.request_version+1,
    updated_at=pg_catalog.transaction_timestamp()
  where r.center_id=p_center_id and r.conversion_request_id=p_conversion_request_id returning r.* into v_request;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    p_center_id,'crm.conversion-request.superseded',p_event_actor_user_id,'crm_conversion_request',
    p_conversion_request_id,p_conversion_request_id,v_request.source_assignment_id,
    p_expected_request_version,v_request.request_version,'SUPERSEDED',p_invalidation_reason_code,
    p_operation,'CONVERSION_REQUEST_SUPERSEDED',p_correlation_id);
  request_status:=v_request.status; request_version:=v_request.request_version;
  invalidated_authorization_count:=v_auth_count; superseded_action_count:=v_action_count;
  terminalized_reservation_count:=v_reservation_count; return next;
end;
$f23_3e_p3d_internal_invalidate_single_plan_request$;

-- P2C terminal reviews are immutable.  When their single V2 plan becomes
-- unusable before conversion-authority issuance, the existing expire/
-- supersede service signatures terminalize that plan and require a fresh
-- Request.  The checkpoint implementation still owns every PENDING-review
-- transition and its exact replay family.
alter table public.crm_idempotency_registry
  drop constraint crm_idempotency_registry_p2c_outcome_code_check,
  add constraint crm_idempotency_registry_p2c_outcome_code_check check (
    p2c_result_outcome_code is null
    or p2c_result_outcome_code in (
      'MATCH_REVIEW_CREATED','MATCH_REVIEW_DECIDED','MATCH_REVIEW_SUPERSEDED',
      'MATCH_REVIEW_EXPIRED','CREATION_RESERVED','CREATION_RESERVATION_CANCELLED',
      'CREATION_RESERVATION_EXPIRED',
      'CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED'
    )
  );

alter function public.f23_3e_p2c_supersede_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) rename to f23_3e_p3d_internal_checkpoint_supersede_match_review;
alter function public.f23_3e_p2c_expire_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) rename to f23_3e_p3d_internal_checkpoint_expire_match_review;

create function public.f23_3e_p3d_internal_preissue_invalidate_plan(
  p_operation text,p_conversion_request_id uuid,p_match_review_id uuid,
  p_expected_review_version integer,p_actor_user_id uuid,p_expected_request_version integer,
  p_identity_kind text,p_candidate_student_id uuid,p_expected_contact_version integer,
  p_expected_case_version integer,p_expected_candidate_version integer,
  p_display_name_evidence text,p_birth_date_evidence date,p_birth_year_evidence integer,
  p_expected_normalization_version integer,p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,p_expected_policy_registry_version integer,
  p_expected_adapter_version integer,p_action_id uuid,p_idempotency_key_digest bytea
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3d_internal_preissue_invalidate_plan$
declare
  v_result jsonb; v_request public.crm_conversion_request%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_registry public.crm_idempotency_registry%rowtype; v_invalidation record;
  v_key bytea; v_environment_fingerprint bytea; v_name_normalized text;
  v_birth_normalized text; v_name_digest bytea; v_birth_digest bytea;
  v_action_intent_digest bytea; v_intent_digest bytea; v_plan_binding_digest bytea;
  v_registry_id uuid:=pg_catalog.gen_random_uuid(); v_correlation_id uuid:=pg_catalog.gen_random_uuid();
  v_action_count integer; v_action_status text; v_action_encoding integer;
  v_authorization_count integer; v_reason text; v_plan_actions jsonb; v_plan_authorizations jsonb;
begin
  if p_operation='crm.identity.supersede_match_review' then
    v_result:=public.f23_3e_p3d_internal_checkpoint_supersede_match_review(
      p_conversion_request_id,p_match_review_id,p_expected_review_version,p_actor_user_id,
      p_expected_request_version,p_identity_kind,p_candidate_student_id,p_expected_contact_version,
      p_expected_case_version,p_expected_candidate_version,p_display_name_evidence,p_birth_date_evidence,
      p_birth_year_evidence,p_expected_normalization_version,p_expected_match_policy_version,
      p_expected_minimum_evidence_policy_version,p_expected_policy_registry_version,
      p_expected_adapter_version,p_action_id,p_idempotency_key_digest);
  elsif p_operation='crm.identity.expire_match_review' then
    v_result:=public.f23_3e_p3d_internal_checkpoint_expire_match_review(
      p_conversion_request_id,p_match_review_id,p_expected_review_version,p_actor_user_id,
      p_expected_request_version,p_identity_kind,p_candidate_student_id,p_expected_contact_version,
      p_expected_case_version,p_expected_candidate_version,p_display_name_evidence,p_birth_date_evidence,
      p_birth_year_evidence,p_expected_normalization_version,p_expected_match_policy_version,
      p_expected_minimum_evidence_policy_version,p_expected_policy_registry_version,
      p_expected_adapter_version,p_action_id,p_idempotency_key_digest);
  else
    return public.f23_3e_p2c_internal_safe_result('INVALID_INPUT');
  end if;

  -- A custom completed row is returned by the checkpoint replay path. Bind
  -- the terminalizing actor/version fields that are outside legacy P2C intent.
  if coalesce(v_result->>'outcome_code','')=
       'CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED'
     and coalesce((v_result->>'replayed')::boolean,false) then
    select i.* into v_registry from public.crm_idempotency_registry i
      where i.resource_scope_kind='conversion_request'
        and i.resource_scope_id=p_conversion_request_id and i.operation=p_operation
        and i.idempotency_key_digest=p_idempotency_key_digest;
    if not found or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_expected_request_version is distinct from p_expected_request_version
       or v_registry.p3_expected_resource_version is distinct from p_expected_review_version then
      return public.f23_3e_p2c_internal_safe_result('IDEMPOTENCY_CONFLICT');
    end if;
    return v_result;
  end if;
  if coalesce(v_result->>'outcome_code','')<>'MATCH_REVIEW_STALE' then return v_result; end if;

  -- The checkpoint call above already authorized the actor and holds the
  -- center root, complete per-kind mutex set, Request/source/target and review
  -- locks.  Complete the later single-plan tiers deterministically.
  select r.* into v_request from public.crm_conversion_request r
    where r.conversion_request_id=p_conversion_request_id for update;
  select r.* into v_review from public.crm_identity_match_review r
    where r.match_review_id=p_match_review_id and r.conversion_request_id=p_conversion_request_id
    for update;
  if not found or v_request.request_version<>p_expected_request_version
     or v_request.status<>'READY_FOR_REVIEW'
     or v_review.review_version<>p_expected_review_version
     or v_review.review_status<>'EXACT_REVIEWED_MATCH'
     or v_review.review_action<>'REUSE_EXISTING'
     or v_review.identity_kind<>p_identity_kind
     or v_review.action_id<>p_action_id
     or v_review.candidate_student_id<>p_candidate_student_id
     or v_review.source_contact_version<>p_expected_contact_version
     or v_review.source_case_version<>p_expected_case_version
     or v_review.source_candidate_version<>p_expected_candidate_version
     or v_review.supporting_identity_target_binding_id is null then
    return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
  end if;
  if p_operation='crm.identity.expire_match_review' then
    if pg_catalog.transaction_timestamp()<v_review.expires_at then
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_NOT_EXPIRED');
    end if;
    v_reason:='authorization_expired';
  else
    if pg_catalog.transaction_timestamp()>=v_review.expires_at then
      return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_EXPIRED');
    end if;
    v_reason:='plan_superseded';
  end if;
  if exists(select 1 from public.crm_conversion_authority a
    where a.conversion_request_id=p_conversion_request_id) then
    return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
  end if;

  perform 1 from public.crm_conversion_action a
    where a.conversion_request_id=p_conversion_request_id
    order by a.conversion_action_id for update;
  select count(*),min(a.status),min(a.action_set_encoding_version),
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.conversion_action_id,a.action_version,
      a.status,a.reviewed_reuse_authorization_id,a.expected_reuse_authorization_version)
      order by a.conversion_action_id)
    into v_action_count,v_action_status,v_action_encoding,v_plan_actions
    from public.crm_conversion_action a where a.conversion_request_id=p_conversion_request_id;
  if v_action_count<>3 or v_action_status not in ('PROPOSED','REVIEWED')
     or exists(select 1 from public.crm_conversion_action a
       where a.conversion_request_id=p_conversion_request_id and a.status<>v_action_status)
     or v_action_encoding<>2 then
    return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
  end if;
  perform 1 from public.crm_reviewed_cross_source_reuse_authorization a
    where a.conversion_request_id=p_conversion_request_id
    order by a.reviewed_reuse_authorization_id for update;
  select count(*),pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
      a.reviewed_reuse_authorization_id,a.authorization_version,a.status,a.match_review_id,
      a.conversion_action_id) order by a.reviewed_reuse_authorization_id)
    into v_authorization_count,v_plan_authorizations
    from public.crm_reviewed_cross_source_reuse_authorization a
    where a.conversion_request_id=p_conversion_request_id;
  if v_authorization_count not between 1 and 2
     or exists(select 1 from public.crm_reviewed_cross_source_reuse_authorization a
       where a.conversion_request_id=p_conversion_request_id
         and (a.status<>'ISSUED' or a.authorization_version<>1))
     or not exists(select 1 from public.crm_reviewed_cross_source_reuse_authorization a
       where a.conversion_request_id=p_conversion_request_id and a.match_review_id=p_match_review_id) then
    return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_STALE');
  end if;
  perform 1 from public.crm_profile_creation_reservation r
    where r.conversion_request_id=p_conversion_request_id
    order by r.reservation_id for update;

  select p.* into strict v_policy from public.crm_identity_policy_registry p
    where p.center_id=v_request.center_id and p.identity_kind=p_identity_kind
      and p.normalization_version=p_expected_normalization_version
      and p.match_policy_version=p_expected_match_policy_version
      and p.minimum_evidence_policy_version=p_expected_minimum_evidence_policy_version
      and p.policy_registry_version=p_expected_policy_registry_version
    order by p.created_at desc limit 1;
  v_key:=public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_environment_fingerprint:=public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  v_name_normalized:=public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence);
  v_birth_normalized:=case when p_identity_kind='STUDENT'
    then public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence) end;
  v_name_digest:=public.f23_3e_p2b_internal_evidence_digest(v_key,v_policy.normalization_algorithm,
    v_policy.normalization_version,p_identity_kind,case when p_identity_kind='STUDENT'
      then 'STUDENT_DISPLAY_NAME' else 'GUARDIAN_DISPLAY_NAME' end,
    v_name_normalized,v_policy.digest_key_epoch);
  v_birth_digest:=case when p_identity_kind='STUDENT' then
    public.f23_3e_p2b_internal_evidence_digest(v_key,v_policy.normalization_algorithm,
      v_policy.normalization_version,p_identity_kind,'STUDENT_BIRTH_DATE',v_birth_normalized,
      v_policy.digest_key_epoch)
    else public.f23_3e_p3c_internal_guardian_secondary_evidence_digest(
      v_key,v_request.center_id,v_request.source_contact_id) end;
  v_action_intent_digest:=extensions.hmac(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain','f23.3e.p2c.action-intent.v1','request_id',p_conversion_request_id,
    'action_id',p_action_id,'identity_kind',p_identity_kind,
    'candidate_student_id',p_candidate_student_id,
    'request_action_graph_digest',pg_catalog.encode(v_request.action_graph_digest,'hex'))::text,'UTF8'),v_key,'sha256');
  v_intent_digest:=extensions.hmac(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain','f23.3e.p2c.idempotency-intent.v1','operation',p_operation,
    'request_id',p_conversion_request_id,'subject_id',p_match_review_id,
    'expected_subject_version',p_expected_review_version,'review_action',null,
    'supersedes_review_id',null,'expected_request_version',p_expected_request_version,
    'identity_kind',p_identity_kind,'candidate_student_id',p_candidate_student_id,
    'expected_contact_version',p_expected_contact_version,'expected_case_version',p_expected_case_version,
    'expected_candidate_version',p_expected_candidate_version,
    'name_evidence_digest',pg_catalog.encode(v_name_digest,'hex'),
    'birth_evidence_digest',pg_catalog.encode(v_birth_digest,'hex'),
    'birth_year_evidence',p_birth_year_evidence,'normalization_version',p_expected_normalization_version,
    'match_policy_version',p_expected_match_policy_version,
    'minimum_evidence_policy_version',p_expected_minimum_evidence_policy_version,
    'policy_registry_version',p_expected_policy_registry_version,'adapter_version',p_expected_adapter_version,
    'action_id',p_action_id,'action_intent_digest',pg_catalog.encode(v_action_intent_digest,'hex'),
    'detail_target_id',null,'expected_target_version',null)::text,'UTF8'),v_key,'sha256');
  v_plan_binding_digest:=extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain','ichess.crm.p3d.preissue-plan-invalidation-binding.v1','operation',p_operation,
    'request_id',p_conversion_request_id,'request_version',p_expected_request_version,
    'review_id',p_match_review_id,'review_version',p_expected_review_version,
    'reason',v_reason,'actions',v_plan_actions,'reuse_authorizations',v_plan_authorizations)::text,'UTF8'),'sha256');

  insert into public.crm_idempotency_registry(
    idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,
    consultation_case_id,operation,idempotency_key_digest,intent_digest,action_graph_digest,
    request_id,request_intent_digest,status,expires_at,p3_actor_user_id,
    p3_expected_request_version,p3_expected_resource_version,p3_operation_binding_digest
  ) values (
    v_registry_id,v_environment_fingerprint,v_request.center_id,'conversion_request',p_conversion_request_id,
    v_request.consultation_case_id,p_operation,p_idempotency_key_digest,v_intent_digest,
    v_request.action_graph_digest,p_conversion_request_id,v_request.intent_digest,'RESERVED',
    pg_catalog.transaction_timestamp()+interval '24 hours',p_actor_user_id,
    p_expected_request_version,p_expected_review_version,v_plan_binding_digest
  );

  select * into strict v_invalidation from public.f23_3e_p3d_internal_invalidate_single_plan_request(
    v_request.center_id,p_conversion_request_id,p_expected_request_version,null,null,null,
    p_actor_user_id,v_reason,p_operation,v_correlation_id);
  v_result:=pg_catalog.jsonb_build_object(
    'ok',true,'outcome_code','CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED',
    'replayed',false,'resource_kind','identity_match_review','resource_id',v_review.match_review_id,
    'resource_version',v_review.review_version,'status',v_review.review_status,
    'opaque_target_id',v_review.opaque_target_id,'expires_at',v_review.expires_at,
    'correlation_id',v_correlation_id,'profile_created',false,'profile_reused',false,
    'conversion_approved',false,'request_completed',false);
  update public.crm_idempotency_registry i set status='COMPLETED',
    terminal_outcome_digest=extensions.hmac(pg_catalog.convert_to(v_result::text,'UTF8'),v_key,'sha256'),
    idempotency_version=i.idempotency_version+1,completed_at=pg_catalog.transaction_timestamp(),
    p2c_result_resource_kind='identity_match_review',p2c_result_resource_id=v_review.match_review_id,
    p2c_result_resource_version=v_review.review_version,p2c_result_resource_status=v_review.review_status,
    p2c_result_opaque_target_id=v_review.opaque_target_id,p2c_result_expires_at=v_review.expires_at,
    p2c_result_outcome_code='CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED',
    p2c_result_correlation_id=v_correlation_id
    where i.idempotency_record_id=v_registry_id;
  return v_result;
exception when unique_violation then
  return public.f23_3e_p2c_internal_safe_result('IDEMPOTENCY_CONFLICT');
end;
$f23_3e_p3d_internal_preissue_invalidate_plan$;

create function public.f23_3e_p2c_supersede_match_review(
  p_conversion_request_id uuid,p_match_review_id uuid,p_expected_review_version integer,
  p_actor_user_id uuid,p_expected_request_version integer,p_identity_kind text,
  p_candidate_student_id uuid,p_expected_contact_version integer,p_expected_case_version integer,
  p_expected_candidate_version integer,p_display_name_evidence text,p_birth_date_evidence date,
  p_birth_year_evidence integer,p_expected_normalization_version integer,
  p_expected_match_policy_version integer,p_expected_minimum_evidence_policy_version integer,
  p_expected_policy_registry_version integer,p_expected_adapter_version integer,p_action_id uuid,
  p_idempotency_key_digest bytea
) returns jsonb language sql security definer set search_path=''
as $f23_3e_p2c_supersede_match_review$
  select public.f23_3e_p3d_internal_preissue_invalidate_plan(
    'crm.identity.supersede_match_review',p_conversion_request_id,p_match_review_id,
    p_expected_review_version,p_actor_user_id,p_expected_request_version,p_identity_kind,
    p_candidate_student_id,p_expected_contact_version,p_expected_case_version,p_expected_candidate_version,
    p_display_name_evidence,p_birth_date_evidence,p_birth_year_evidence,p_expected_normalization_version,
    p_expected_match_policy_version,p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version,p_expected_adapter_version,p_action_id,p_idempotency_key_digest)
$f23_3e_p2c_supersede_match_review$;

create function public.f23_3e_p2c_expire_match_review(
  p_conversion_request_id uuid,p_match_review_id uuid,p_expected_review_version integer,
  p_actor_user_id uuid,p_expected_request_version integer,p_identity_kind text,
  p_candidate_student_id uuid,p_expected_contact_version integer,p_expected_case_version integer,
  p_expected_candidate_version integer,p_display_name_evidence text,p_birth_date_evidence date,
  p_birth_year_evidence integer,p_expected_normalization_version integer,
  p_expected_match_policy_version integer,p_expected_minimum_evidence_policy_version integer,
  p_expected_policy_registry_version integer,p_expected_adapter_version integer,p_action_id uuid,
  p_idempotency_key_digest bytea
) returns jsonb language sql security definer set search_path=''
as $f23_3e_p2c_expire_match_review$
  select public.f23_3e_p3d_internal_preissue_invalidate_plan(
    'crm.identity.expire_match_review',p_conversion_request_id,p_match_review_id,
    p_expected_review_version,p_actor_user_id,p_expected_request_version,p_identity_kind,
    p_candidate_student_id,p_expected_contact_version,p_expected_case_version,p_expected_candidate_version,
    p_display_name_evidence,p_birth_date_evidence,p_birth_year_evidence,p_expected_normalization_version,
    p_expected_match_policy_version,p_expected_minimum_evidence_policy_version,
    p_expected_policy_registry_version,p_expected_adapter_version,p_action_id,p_idempotency_key_digest)
$f23_3e_p2c_expire_match_review$;

-- Post-issue recovery preserves the P3B service signature and immutable replay.
alter function public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  uuid,uuid,integer,text,text,bytea,bytea,timestamptz
) rename to f23_3e_p3d_internal_checkpoint_revoke_or_expire_authority;

create function public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  p_actor_user_id uuid,p_conversion_authority_id uuid,p_expected_authority_version integer,
  p_requested_transition text,p_safe_reason_code text,p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns table(ok boolean,outcome_code text,replayed boolean,status text,
  authority_version integer,terminal_at timestamptz,correlation_id uuid)
language plpgsql volatile security definer set search_path=''
as $f23_3e_p3b_revoke_or_expire_conversion_authority$
declare v_result record; v_authority public.crm_conversion_authority%rowtype;
  v_invalidation record; v_snapshot jsonb; v_registry_id uuid;
begin
  select * into v_result from public.f23_3e_p3d_internal_checkpoint_revoke_or_expire_authority(
    p_actor_user_id,p_conversion_authority_id,p_expected_authority_version,p_requested_transition,
    p_safe_reason_code,p_operation_intent_digest,p_idempotency_key_digest,p_idempotency_expires_at);
  if not coalesce(v_result.ok,false) or coalesce(v_result.replayed,false) then
    return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.status,
      v_result.authority_version,v_result.terminal_at,v_result.correlation_id; return;
  end if;
  select * into strict v_authority from public.crm_conversion_authority a
    where a.conversion_authority_id=p_conversion_authority_id;
  select * into strict v_invalidation from public.f23_3e_p3d_internal_invalidate_single_plan_request(
    v_authority.center_id,v_authority.conversion_request_id,v_authority.approved_request_version,
    p_conversion_authority_id,p_expected_authority_version,p_requested_transition,p_actor_user_id,
    'conversion_authority_terminal','security.revoke_or_expire_conversion_authority',v_result.correlation_id);
  select i.idempotency_record_id,i.p3_result_snapshot into strict v_registry_id,v_snapshot
    from public.crm_idempotency_registry i where i.environment_fingerprint=v_authority.environment_fingerprint
      and i.resource_scope_kind='conversion_authority' and i.resource_scope_id=p_conversion_authority_id
      and i.operation='security.revoke_or_expire_conversion_authority'
      and i.idempotency_key_digest=p_idempotency_key_digest;
  v_snapshot:=v_snapshot||pg_catalog.jsonb_build_object('request_status',v_invalidation.request_status,
    'invalidated_authorization_count',v_invalidation.invalidated_authorization_count,
    'superseded_action_count',v_invalidation.superseded_action_count,
    'terminalized_reservation_count',v_invalidation.terminalized_reservation_count);
  perform pg_catalog.set_config('ichess.p3d_r0_plan_binding','on',true);
  update public.crm_idempotency_registry i set idempotency_version=i.idempotency_version+1,
    p3_result_snapshot=v_snapshot,
    terminal_outcome_digest=public.f23_3e_p3b_internal_result_digest(v_snapshot)
    where i.idempotency_record_id=v_registry_id;
  return query select v_result.ok,v_result.outcome_code,v_result.replayed,v_result.status,
    v_result.authority_version,v_result.terminal_at,v_result.correlation_id;
end;
$f23_3e_p3b_revoke_or_expire_conversion_authority$;

-- No internal P3D helper is an application RPC. Exactly two service-role
-- entry points are granted; table RLS/direct grants remain untouched.
do $f23_3e_p3d_revoke_internal_helpers$
declare v_signature text;
begin
  for v_signature in
    select p.oid::pg_catalog.regprocedure::text from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p3d_internal_%'
  loop
    execute 'revoke all on function ' || v_signature || ' from public, anon, authenticated, service_role';
  end loop;
end;
$f23_3e_p3d_revoke_internal_helpers$;

revoke all on function public.f23_3e_p3d_internal_checkpoint_revoke_or_expire_authority(
  uuid,uuid,integer,text,text,bytea,bytea,timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  uuid,uuid,integer,text,text,bytea,bytea,timestamptz
) from public, anon, authenticated;
grant execute on function public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  uuid,uuid,integer,text,text,bytea,bytea,timestamptz
) to service_role;

-- A rename followed by CREATE produces a new function object with PostgreSQL's
-- default PUBLIC EXECUTE. Re-establish every inherited protected surface that
-- this migration recreated, using exact overload signatures.
revoke all on function public.f23_3e_p2b_internal_search_masked_candidates(
  uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,
  integer,integer,integer,integer,integer,uuid,integer
) from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3c_internal_resolve_reusable_student(
  text,uuid,uuid,integer,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3c_internal_resolve_reusable_guardian(
  text,uuid,uuid,integer,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3b_internal_is_safe_result_snapshot(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3d_internal_checkpoint_supersede_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3d_internal_checkpoint_expire_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p2c_supersede_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) from public, anon, authenticated;
grant execute on function public.f23_3e_p2c_supersede_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) to service_role;
revoke all on function public.f23_3e_p2c_expire_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) from public, anon, authenticated;
grant execute on function public.f23_3e_p2c_expire_match_review(
  uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,
  integer,integer,integer,integer,integer,integer,uuid,bytea
) to service_role;

revoke all on function public.f23_3e_p3c_materialize_reviewed_action_pair(
  uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,
  integer,bytea,bytea,timestamptz
) from public, anon, authenticated;
grant execute on function public.f23_3e_p3c_materialize_reviewed_action_pair(
  uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,
  integer,bytea,bytea,timestamptz
) to service_role;
revoke all on function public.f23_3e_p3c_finalize_reviewed_action_plan(
  uuid,uuid,integer,integer,bytea,bytea,timestamptz
) from public, anon, authenticated;
grant execute on function public.f23_3e_p3c_finalize_reviewed_action_plan(
  uuid,uuid,integer,integer,bytea,bytea,timestamptz
) to service_role;
revoke all on function public.f23_3e_p3b_issue_conversion_authority(
  uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz
) from public, anon, authenticated;
grant execute on function public.f23_3e_p3b_issue_conversion_authority(
  uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz
) to service_role;

revoke all on function public.f23_3e_p3d_execute_conversion(uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p3d_read_conversion_result_status(uuid,bytea)
  from public, anon, authenticated;
grant execute on function public.f23_3e_p3d_execute_conversion(uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz)
  to service_role;
grant execute on function public.f23_3e_p3d_read_conversion_result_status(uuid,bytea)
  to service_role;

commit;
