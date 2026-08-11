-- F23.3E-P3B: fresh step-up, conversion-specific final capability, and
-- single-use conversion-authority runtime.  This forward-only migration does
-- not create target profiles, relationships, an action materializer, or the
-- real-conversion executor.

begin;

set local check_function_bodies = true;

do $f23_3e_p3b_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_conversion_request') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regclass('public.crm_identity_match_mutex') is null
     or pg_catalog.to_regclass('public.crm_identity_match_review') is null
     or pg_catalog.to_regclass('public.crm_profile_creation_reservation') is null then
    raise exception 'f23_3e_p3b_missing_frozen_prerequisite';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p3b_missing_service_role';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p3b_%'
  ) then
    raise exception 'f23_3e_p3b_runtime_already_exists';
  end if;
end;
$f23_3e_p3b_prerequisites$;

-- Existing writers do not become security authorities.  The trigger derives
-- an exact +1 version whenever an existing semantic membership field changes.
alter table public.center_members
  add column membership_version integer not null default 1,
  add constraint center_members_membership_version_positive
    check (membership_version >= 1),
  add constraint center_members_conversion_version_binding_key
    unique (center_id, id, membership_version);

create index center_members_conversion_capability_idx
  on public.center_members (center_id, user_id, status, role, membership_version);

alter table public.consultation_case_candidate_student
  add constraint consultation_case_candidate_student_center_candidate_key
  unique (center_id, candidate_student_id);

create function public.f23_3e_p3b_internal_guard_center_members_version()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_center_members_version$
begin
  if tg_op = 'INSERT' then
    if new.membership_version <> 1 then
      raise exception 'f23_3e_p3b_membership_must_start_at_version_one';
    end if;
    return new;
  end if;

  if new.center_id is distinct from old.center_id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.status is distinct from old.status then
    if new.membership_version = old.membership_version then
      new.membership_version := old.membership_version + 1;
    elsif new.membership_version <> old.membership_version + 1 then
      raise exception 'f23_3e_p3b_membership_semantic_change_requires_exact_version_increment';
    end if;
  elsif new.membership_version is distinct from old.membership_version then
    raise exception 'f23_3e_p3b_membership_version_change_requires_semantic_change';
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_center_members_version$;

create trigger f23_3e_p3b_center_members_version_guard
before insert or update on public.center_members
for each row execute function public.f23_3e_p3b_internal_guard_center_members_version();

create table public.account_security_control (
  canonical_user_id uuid primary key,
  account_lifecycle text not null,
  security_version integer not null,
  session_version integer not null,
  identity_control_version integer not null,
  factor_control_version integer not null,
  assurance_policy_version integer not null,
  account_evidence_digest bytea not null,
  control_version integer not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  terminal_at timestamptz,
  constraint account_security_control_user_fkey
    foreign key (canonical_user_id) references auth.users(id) on delete restrict,
  constraint account_security_control_lifecycle_check
    check (account_lifecycle in ('ACTIVE', 'SUSPENDED', 'DISABLED', 'REVOKED')),
  constraint account_security_control_versions_positive
    check (
      security_version >= 1 and session_version >= 1
      and identity_control_version >= 1 and factor_control_version >= 1
      and assurance_policy_version >= 1 and control_version >= 1
    ),
  constraint account_security_control_evidence_digest_size
    check (pg_catalog.octet_length(account_evidence_digest) = 32),
  constraint account_security_control_terminal_mapping_check
    check ((account_lifecycle = 'REVOKED') = (terminal_at is not null)),
  constraint account_security_control_timestamp_order_check
    check (updated_at >= created_at and (terminal_at is null or terminal_at >= created_at))
);

create index account_security_control_lifecycle_idx
  on public.account_security_control (account_lifecycle, updated_at);

create table public.account_step_up_assertion (
  step_up_assertion_id uuid primary key default pg_catalog.gen_random_uuid(),
  canonical_user_id uuid not null,
  logical_security_session_id uuid not null,
  center_id text not null,
  conversion_request_id uuid not null,
  purpose text not null,
  assurance_level text not null,
  verification_provider_namespace text not null,
  verification_reference_digest bytea not null,
  security_version integer not null,
  session_version integer not null,
  assurance_policy_version integer not null,
  status text not null,
  assertion_version integer not null default 1,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  terminal_at timestamptz,
  terminal_reason_code text,
  consumed_by_authority_id uuid,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint account_step_up_assertion_user_fkey
    foreign key (canonical_user_id) references auth.users(id) on delete restrict,
  constraint account_step_up_assertion_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint account_step_up_assertion_request_exact_center_fkey
    foreign key (center_id, conversion_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint account_step_up_assertion_purpose_check
    check (purpose = 'crm.real_conversion.execute'),
  constraint account_step_up_assertion_assurance_check
    check (assurance_level in ('AAL2_TOTP', 'AAL2_PHISHING_RESISTANT', 'AAL3_HARDWARE_BACKED')),
  constraint account_step_up_assertion_provider_check
    check (
      pg_catalog.length(verification_provider_namespace) between 3 and 80
      and verification_provider_namespace ~ '^[a-z][a-z0-9_.-]+$'
    ),
  constraint account_step_up_assertion_verification_digest_size
    check (pg_catalog.octet_length(verification_reference_digest) = 32),
  constraint account_step_up_assertion_versions_positive
    check (
      security_version >= 1 and session_version >= 1
      and assurance_policy_version >= 1 and assertion_version >= 1
    ),
  constraint account_step_up_assertion_status_check
    check (status in ('ISSUED', 'CONSUMED', 'EXPIRED', 'REVOKED', 'SUPERSEDED')),
  constraint account_step_up_assertion_expiry_check
    check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  constraint account_step_up_assertion_terminal_mapping_check
    check (
      (status = 'ISSUED' and terminal_at is null and terminal_reason_code is null and consumed_by_authority_id is null)
      or (status = 'CONSUMED' and terminal_at is not null and terminal_reason_code = 'authority_issued' and consumed_by_authority_id is not null)
      or (status in ('EXPIRED', 'REVOKED', 'SUPERSEDED') and terminal_at is not null and terminal_reason_code is not null and consumed_by_authority_id is null)
    ),
  constraint account_step_up_assertion_reason_check
    check (
      terminal_reason_code is null
      or (pg_catalog.length(terminal_reason_code) between 1 and 80 and terminal_reason_code ~ '^[a-z][a-z0-9_.-]*$')
    ),
  constraint account_step_up_assertion_timestamp_order_check
    check (
      updated_at >= created_at and issued_at >= created_at
      and (terminal_at is null or terminal_at >= issued_at)
    ),
  constraint account_step_up_assertion_consumed_authority_unique
    unique (consumed_by_authority_id),
  constraint account_step_up_assertion_center_id_key
    unique (center_id, step_up_assertion_id)
);

create unique index account_step_up_assertion_one_issued_request_purpose_idx
  on public.account_step_up_assertion (
    center_id, canonical_user_id, conversion_request_id, purpose
  ) where status = 'ISSUED';

create index account_step_up_assertion_expiry_idx
  on public.account_step_up_assertion (expires_at) where status = 'ISSUED';

create index account_step_up_assertion_session_idx
  on public.account_step_up_assertion (canonical_user_id, logical_security_session_id, status);

create table public.crm_conversion_action (
  conversion_action_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  conversion_request_id uuid not null,
  legacy_request_action_graph_digest bytea not null,
  action_kind text not null,
  action_intent_digest bytea not null,
  identity_kind text,
  source_contact_id uuid,
  source_candidate_student_id uuid,
  match_review_id uuid,
  profile_creation_reservation_id uuid,
  target_adapter_namespace text,
  opaque_target_id uuid,
  expected_target_version integer,
  student_target_id uuid,
  guardian_target_id uuid,
  guardian_action_id uuid,
  student_action_id uuid,
  guardian_student_relationship_id uuid,
  expected_relationship_version integer,
  relationship_type text,
  is_primary_contact boolean,
  financial_contact_role text,
  academic_contact_role text,
  safe_reason_code text not null,
  relationship_policy_version integer,
  status text not null default 'PROPOSED',
  action_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_conversion_action_request_exact_center_fkey
    foreign key (center_id, conversion_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_conversion_action_contact_exact_center_fkey
    foreign key (center_id, source_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_conversion_action_candidate_exact_case_fkey
    foreign key (center_id, source_candidate_student_id)
    references public.consultation_case_candidate_student(center_id, candidate_student_id)
    on delete restrict,
  constraint crm_conversion_action_review_exact_center_fkey
    foreign key (center_id, match_review_id)
    references public.crm_identity_match_review(center_id, match_review_id) on delete restrict,
  constraint crm_conversion_action_reservation_exact_center_fkey
    foreign key (center_id, profile_creation_reservation_id)
    references public.crm_profile_creation_reservation(center_id, reservation_id) on delete restrict,
  constraint crm_conversion_action_request_action_key
    unique (center_id, conversion_request_id, conversion_action_id),
  constraint crm_conversion_action_action_kind_check
    check (action_kind in (
      'CREATE_NEW_STUDENT', 'REUSE_REVIEWED_STUDENT', 'DO_NOT_CREATE_STUDENT',
      'CREATE_NEW_GUARDIAN', 'REUSE_REVIEWED_GUARDIAN', 'DO_NOT_CREATE_GUARDIAN',
      'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
      'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
      'DO_NOT_CREATE_RELATIONSHIP'
    )),
  constraint crm_conversion_action_identity_kind_check
    check (identity_kind is null or identity_kind in ('STUDENT', 'GUARDIAN')),
  constraint crm_conversion_action_digest_sizes_check
    check (
      pg_catalog.octet_length(legacy_request_action_graph_digest) = 32
      and pg_catalog.octet_length(action_intent_digest) = 32
    ),
  constraint crm_conversion_action_status_check
    check (status in ('PROPOSED', 'REVIEWED', 'APPROVED', 'EXECUTED', 'SUPERSEDED')),
  constraint crm_conversion_action_versions_positive
    check (
      action_version >= 1
      and (expected_target_version is null or expected_target_version >= 1)
      and (expected_relationship_version is null or expected_relationship_version >= 1)
      and (relationship_policy_version is null or relationship_policy_version >= 1)
    ),
  constraint crm_conversion_action_reason_check
    check (
      pg_catalog.length(safe_reason_code) between 1 and 80
      and safe_reason_code ~ '^[A-Z][A-Z0-9_]*$'
    ),
  constraint crm_conversion_action_identity_action_shape_check
    check (
      (
        action_kind in ('CREATE_NEW_STUDENT', 'REUSE_REVIEWED_STUDENT', 'DO_NOT_CREATE_STUDENT')
        and identity_kind = 'STUDENT' and source_candidate_student_id is not null
        and source_contact_id is null and guardian_action_id is null and student_action_id is null
      )
      or (
        action_kind in ('CREATE_NEW_GUARDIAN', 'REUSE_REVIEWED_GUARDIAN', 'DO_NOT_CREATE_GUARDIAN')
        and identity_kind = 'GUARDIAN' and source_contact_id is not null
        and source_candidate_student_id is null and guardian_action_id is null and student_action_id is null
      )
      or (
        action_kind in ('CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW', 'DO_NOT_CREATE_RELATIONSHIP')
        and identity_kind is null and source_contact_id is null and source_candidate_student_id is null
        and guardian_action_id is not null and student_action_id is not null
      )
    ),
  constraint crm_conversion_action_no_op_reason_check
    check (
      action_kind not in ('DO_NOT_CREATE_STUDENT', 'DO_NOT_CREATE_GUARDIAN', 'DO_NOT_CREATE_RELATIONSHIP')
      or safe_reason_code in ('NO_TARGET_ACTION_REQUIRED', 'NO_GUARDIAN_RELATIONSHIP_REQUIRED', 'EXPLICIT_REVIEWED_NO_CREATE', 'DUPLICATE_AVOIDED', 'RELATIONSHIP_ALREADY_CURRENT')
    ),
  constraint crm_conversion_action_relationship_action_shape_check
    check (
      (
        action_kind not in ('CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW', 'DO_NOT_CREATE_RELATIONSHIP')
        and relationship_type is null and is_primary_contact is null
        and financial_contact_role is null and academic_contact_role is null
        and relationship_policy_version is null and guardian_student_relationship_id is null
        and expected_relationship_version is null
      )
      or (
        action_kind = 'DO_NOT_CREATE_RELATIONSHIP'
        and relationship_type is null and is_primary_contact is null
        and financial_contact_role is null and academic_contact_role is null
        and relationship_policy_version is not null and guardian_student_relationship_id is null
        and expected_relationship_version is null
      )
      or (
        action_kind in ('CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW')
        and relationship_type in ('PARENT', 'GUARDIAN', 'OTHER')
        and is_primary_contact is not null
        and financial_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
        and academic_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
        and relationship_policy_version is not null
      )
    ),
  constraint crm_conversion_action_timestamp_order_check
    check (updated_at >= created_at)
);

alter table public.crm_conversion_action
  add constraint crm_conversion_action_guardian_action_fkey
    foreign key (center_id, conversion_request_id, guardian_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict deferrable initially deferred,
  add constraint crm_conversion_action_student_action_fkey
    foreign key (center_id, conversion_request_id, student_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict deferrable initially deferred;

create unique index crm_conversion_action_relationship_pair_idx
  on public.crm_conversion_action (
    center_id, conversion_request_id, guardian_action_id, student_action_id
  ) where action_kind in (
    'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
    'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
    'DO_NOT_CREATE_RELATIONSHIP'
  );

create index crm_conversion_action_request_status_idx
  on public.crm_conversion_action (center_id, conversion_request_id, status, conversion_action_id);

alter table public.crm_conversion_action
  add constraint crm_conversion_action_identity_binding_shape_check
  check (
    (
      action_kind in ('DO_NOT_CREATE_STUDENT', 'DO_NOT_CREATE_GUARDIAN')
      and match_review_id is null and profile_creation_reservation_id is null
      and target_adapter_namespace is null and opaque_target_id is null
      and expected_target_version is null and student_target_id is null and guardian_target_id is null
    )
    or (
      action_kind in ('CREATE_NEW_STUDENT', 'CREATE_NEW_GUARDIAN')
      and match_review_id is not null and profile_creation_reservation_id is not null
      and target_adapter_namespace is not null and opaque_target_id is not null
      and expected_target_version is null and student_target_id is null and guardian_target_id is null
    )
    or (
      action_kind in ('REUSE_REVIEWED_STUDENT', 'REUSE_REVIEWED_GUARDIAN')
      and match_review_id is not null and profile_creation_reservation_id is null
      and target_adapter_namespace is not null and opaque_target_id is not null
      and expected_target_version is not null
    )
    or action_kind in (
      'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
      'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
      'DO_NOT_CREATE_RELATIONSHIP'
    )
  );

create table public.crm_conversion_authority (
  conversion_authority_id uuid primary key default pg_catalog.gen_random_uuid(),
  environment_fingerprint bytea not null,
  center_id text not null,
  actor_user_id uuid not null,
  membership_id uuid not null,
  membership_version integer not null,
  conversion_request_id uuid not null,
  approved_request_version integer not null,
  consultation_case_id uuid not null,
  case_version integer not null,
  source_contact_id uuid not null,
  contact_version integer not null,
  assignment_id uuid not null,
  assignment_version integer not null,
  conversion_intent_digest bytea not null,
  legacy_request_action_graph_digest bytea not null,
  p3_action_set_encoding_version integer not null,
  p3_action_set_digest bytea not null,
  review_set_digest bytea not null,
  reservation_set_digest bytea not null,
  target_set_digest bytea not null,
  step_up_assertion_id uuid not null,
  step_up_assertion_version integer not null,
  account_security_version integer not null,
  account_session_version integer not null,
  assurance_policy_version integer not null,
  identity_policy_version integer not null,
  conversion_policy_version integer not null,
  relationship_policy_version integer not null,
  student_profile_policy_version integer not null,
  purpose text not null,
  status text not null default 'ISSUED',
  authority_version integer not null default 1,
  issued_at timestamptz not null default pg_catalog.transaction_timestamp(),
  expires_at timestamptz not null,
  terminal_at timestamptz,
  terminal_reason_code text,
  consumed_idempotency_record_id uuid,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_conversion_authority_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_conversion_authority_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_conversion_authority_actor_fkey
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint crm_conversion_authority_actor_security_fkey
    foreign key (actor_user_id) references public.account_security_control(canonical_user_id) on delete restrict,
  constraint crm_conversion_authority_membership_version_fkey
    foreign key (center_id, membership_id, membership_version)
    references public.center_members(center_id, id, membership_version) on delete restrict,
  constraint crm_conversion_authority_request_exact_center_fkey
    foreign key (center_id, conversion_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_conversion_authority_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_conversion_authority_contact_exact_center_fkey
    foreign key (center_id, source_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_conversion_authority_assignment_exact_center_fkey
    foreign key (center_id, assignment_id)
    references public.consultation_case_assignment(center_id, assignment_id) on delete restrict,
  constraint crm_conversion_authority_step_up_fkey
    foreign key (center_id, step_up_assertion_id)
    references public.account_step_up_assertion(center_id, step_up_assertion_id) on delete restrict,
  constraint crm_conversion_authority_consumed_idempotency_exact_center_fkey
    foreign key (center_id, consumed_idempotency_record_id)
    references public.crm_idempotency_registry(center_id, idempotency_record_id) on delete restrict,
  constraint crm_conversion_authority_center_id_key
    unique (center_id, conversion_authority_id),
  constraint crm_conversion_authority_purpose_check
    check (purpose = 'crm.real_conversion.execute'),
  constraint crm_conversion_authority_digest_sizes_check
    check (
      pg_catalog.octet_length(environment_fingerprint) = 32
      and pg_catalog.octet_length(conversion_intent_digest) = 32
      and pg_catalog.octet_length(legacy_request_action_graph_digest) = 32
      and pg_catalog.octet_length(p3_action_set_digest) = 32
      and pg_catalog.octet_length(review_set_digest) = 32
      and pg_catalog.octet_length(reservation_set_digest) = 32
      and pg_catalog.octet_length(target_set_digest) = 32
    ),
  constraint crm_conversion_authority_versions_positive
    check (
      membership_version >= 1 and approved_request_version >= 1
      and case_version >= 1 and contact_version >= 1 and assignment_version >= 1
      and p3_action_set_encoding_version >= 1 and step_up_assertion_version >= 1
      and account_security_version >= 1 and account_session_version >= 1
      and assurance_policy_version >= 1 and identity_policy_version >= 1
      and conversion_policy_version >= 1 and relationship_policy_version >= 1
      and student_profile_policy_version >= 1 and authority_version >= 1
    ),
  constraint crm_conversion_authority_status_check
    check (status in ('ISSUED', 'CONSUMED', 'EXPIRED', 'REVOKED', 'SUPERSEDED')),
  constraint crm_conversion_authority_expiry_check
    check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  constraint crm_conversion_authority_terminal_mapping_check
    check (
      (status = 'ISSUED' and terminal_at is null and terminal_reason_code is null and consumed_idempotency_record_id is null)
      or (status = 'CONSUMED' and terminal_at is not null and terminal_reason_code is not null and consumed_idempotency_record_id is not null)
      or (status in ('EXPIRED', 'REVOKED', 'SUPERSEDED') and terminal_at is not null and terminal_reason_code is not null and consumed_idempotency_record_id is null)
    ),
  constraint crm_conversion_authority_reason_check
    check (
      terminal_reason_code is null
      or (pg_catalog.length(terminal_reason_code) between 1 and 80 and terminal_reason_code ~ '^[a-z][a-z0-9_.-]*$')
    ),
  constraint crm_conversion_authority_timestamp_order_check
    check (
      updated_at >= created_at and issued_at >= created_at
      and (terminal_at is null or terminal_at >= issued_at)
    )
);

alter table public.account_step_up_assertion
  add constraint account_step_up_assertion_consumed_authority_fkey
  foreign key (center_id, consumed_by_authority_id)
  references public.crm_conversion_authority(center_id, conversion_authority_id)
  on delete restrict deferrable initially deferred;

create unique index crm_conversion_authority_one_issued_action_set_idx
  on public.crm_conversion_authority (
    center_id, conversion_request_id, p3_action_set_encoding_version, p3_action_set_digest
  ) where status = 'ISSUED';

create index crm_conversion_authority_expiry_idx
  on public.crm_conversion_authority (expires_at) where status = 'ISSUED';

create index crm_conversion_authority_actor_idx
  on public.crm_conversion_authority (actor_user_id, status, expires_at);

-- A disjoint P3 family extends the shared registry.  P1 and P2C columns remain
-- untouched and a completed row belongs to exactly one immutable result family.
alter table public.crm_idempotency_registry
  add column p3_actor_user_id uuid,
  add column p3_step_up_assertion_id uuid,
  add column p3_expected_request_version integer,
  add column p3_expected_resource_version integer,
  add column p3_operation_binding_digest bytea,
  add column p3_legacy_request_action_graph_digest bytea,
  add column p3_action_set_encoding_version integer,
  add column p3_action_set_digest bytea,
  add column p3_result_kind text,
  add column p3_result_outcome_code text,
  add column p3_result_snapshot jsonb,
  add column p3_result_correlation_id uuid,
  add constraint crm_idempotency_registry_p3_actor_fkey
    foreign key (p3_actor_user_id) references auth.users(id) on delete restrict,
  add constraint crm_idempotency_registry_p3_step_up_fkey
    foreign key (p3_step_up_assertion_id)
    references public.account_step_up_assertion(step_up_assertion_id) on delete restrict,
  add constraint crm_idempotency_registry_p3_versions_check
    check (
      (p3_expected_request_version is null or p3_expected_request_version >= 1)
      and (p3_expected_resource_version is null or p3_expected_resource_version >= 1)
      and (p3_action_set_encoding_version is null or p3_action_set_encoding_version >= 1)
    ),
  add constraint crm_idempotency_registry_p3_digest_sizes_check
    check (
      (p3_legacy_request_action_graph_digest is null or pg_catalog.octet_length(p3_legacy_request_action_graph_digest) = 32)
      and (p3_operation_binding_digest is null or pg_catalog.octet_length(p3_operation_binding_digest) = 32)
      and (p3_action_set_digest is null or pg_catalog.octet_length(p3_action_set_digest) = 32)
    ),
  add constraint crm_idempotency_registry_p3_kind_check
    check (p3_result_kind is null or p3_result_kind in ('CONVERSION_AUTHORITY', 'REAL_CONVERSION')),
  add constraint crm_idempotency_registry_p3_outcome_check
    check (
      p3_result_outcome_code is null
      or (pg_catalog.length(p3_result_outcome_code) between 2 and 80 and p3_result_outcome_code ~ '^[A-Z][A-Z0-9_]*$')
    );

alter table public.crm_idempotency_registry
  drop constraint crm_idempotency_registry_completed_result_snapshot_check,
  add constraint crm_idempotency_registry_completed_result_snapshot_check
  check (
    (
      status = 'COMPLETED'
      and (
        (
          result_request_id is not null and result_request_version is not null
          and result_case_version is not null and result_request_status is not null
          and result_outcome_code is not null and result_correlation_id is not null
          and p2c_result_resource_kind is null and p2c_result_resource_id is null
          and p2c_result_resource_version is null and p2c_result_resource_status is null
          and p2c_result_opaque_target_id is null and p2c_result_expires_at is null
          and p2c_result_outcome_code is null and p2c_result_correlation_id is null
          and p3_result_kind is null and p3_result_outcome_code is null
          and p3_result_snapshot is null and p3_result_correlation_id is null
        )
        or (
          result_request_id is null and result_request_version is null
          and result_case_version is null and result_request_status is null
          and result_outcome_code is null and result_correlation_id is null
          and p2c_result_resource_kind is not null
          and p2c_result_resource_id is not null and p2c_result_resource_version is not null
          and p2c_result_resource_status is not null and p2c_result_expires_at is not null
          and p2c_result_outcome_code is not null and p2c_result_correlation_id is not null
          and p3_result_kind is null and p3_result_outcome_code is null
          and p3_result_snapshot is null and p3_result_correlation_id is null
        )
        or (
          result_request_id is null and result_request_version is null
          and result_case_version is null and result_request_status is null
          and result_outcome_code is null and result_correlation_id is null
          and p2c_result_resource_kind is null and p2c_result_resource_id is null
          and p2c_result_resource_version is null and p2c_result_resource_status is null
          and p2c_result_opaque_target_id is null and p2c_result_expires_at is null
          and p2c_result_outcome_code is null and p2c_result_correlation_id is null
          and p3_result_kind is not null and p3_result_outcome_code is not null
          and p3_result_snapshot is not null and p3_result_correlation_id is not null
        )
      )
    )
    or (
      status <> 'COMPLETED'
      and result_request_id is null and result_request_version is null
      and result_case_version is null and result_request_status is null
      and result_outcome_code is null and result_correlation_id is null
      and p2c_result_resource_kind is null and p2c_result_resource_id is null
      and p2c_result_resource_version is null and p2c_result_resource_status is null
      and p2c_result_opaque_target_id is null and p2c_result_expires_at is null
      and p2c_result_outcome_code is null and p2c_result_correlation_id is null
      and p3_result_kind is null and p3_result_outcome_code is null
      and p3_result_snapshot is null and p3_result_correlation_id is null
    )
  );

create function public.f23_3e_p3b_internal_is_safe_result_snapshot(p_snapshot jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $f23_3e_p3b_internal_is_safe_result_snapshot$
declare
  v_key text;
begin
  if pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then return false; end if;
  for v_key in select e.key from pg_catalog.jsonb_each(p_snapshot) e loop
    if v_key not in (
      'result_schema_version', 'result_type', 'resource_id', 'resource_version',
      'resource_status', 'request_id', 'request_version', 'issued_at',
      'expires_at', 'terminal_at', 'correlation_id', 'outcome_code',
      'canonical_user_id', 'security_version', 'session_version'
    ) then return false; end if;
  end loop;
  return p_snapshot ? 'result_schema_version'
    and (p_snapshot ->> 'result_schema_version') = '1'
    and p_snapshot ? 'result_type'
    and (p_snapshot ->> 'result_type') in ('ACCOUNT_SECURITY_CONTROL', 'STEP_UP_ASSERTION', 'CONVERSION_AUTHORITY')
    and p_snapshot ? 'resource_id'
    and (p_snapshot ->> 'resource_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ? 'resource_version'
    and (p_snapshot ->> 'resource_version') ~ '^[1-9][0-9]*$'
    and p_snapshot ? 'resource_status'
    and p_snapshot ? 'correlation_id'
    and (p_snapshot ->> 'correlation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ? 'outcome_code'
    and (p_snapshot ->> 'outcome_code') ~ '^[A-Z][A-Z0-9_]*$';
end;
$f23_3e_p3b_internal_is_safe_result_snapshot$;

alter table public.crm_idempotency_registry
  add constraint crm_idempotency_registry_p3_safe_snapshot_check
  check (p3_result_snapshot is null or public.f23_3e_p3b_internal_is_safe_result_snapshot(p3_result_snapshot));

create function public.f23_3e_p3b_internal_guard_idempotency_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_idempotency_snapshot$
begin
  if tg_op = 'UPDATE' then
    if new.p3_actor_user_id is distinct from old.p3_actor_user_id
       or new.p3_step_up_assertion_id is distinct from old.p3_step_up_assertion_id
     or new.p3_expected_request_version is distinct from old.p3_expected_request_version
     or new.p3_expected_resource_version is distinct from old.p3_expected_resource_version
       or new.p3_operation_binding_digest is distinct from old.p3_operation_binding_digest
     or new.p3_legacy_request_action_graph_digest is distinct from old.p3_legacy_request_action_graph_digest then
      raise exception 'f23_3e_p3b_idempotency_binding_is_immutable';
    end if;
    if old.status in ('COMPLETED', 'CONFLICT', 'EXPIRED') and (
      new.p3_action_set_encoding_version is distinct from old.p3_action_set_encoding_version
      or new.p3_action_set_digest is distinct from old.p3_action_set_digest
      or new.p3_result_kind is distinct from old.p3_result_kind
      or new.p3_result_outcome_code is distinct from old.p3_result_outcome_code
      or new.p3_result_snapshot is distinct from old.p3_result_snapshot
      or new.p3_result_correlation_id is distinct from old.p3_result_correlation_id
    ) then
      raise exception 'f23_3e_p3b_terminal_result_snapshot_is_immutable';
    end if;
    if old.status not in ('COMPLETED', 'CONFLICT', 'EXPIRED')
       and new.status not in ('COMPLETED', 'CONFLICT', 'EXPIRED') and (
         new.p3_action_set_encoding_version is distinct from old.p3_action_set_encoding_version
         or new.p3_action_set_digest is distinct from old.p3_action_set_digest
         or new.p3_result_kind is distinct from old.p3_result_kind
         or new.p3_result_outcome_code is distinct from old.p3_result_outcome_code
         or new.p3_result_snapshot is distinct from old.p3_result_snapshot
         or new.p3_result_correlation_id is distinct from old.p3_result_correlation_id
       ) then
      raise exception 'f23_3e_p3b_result_snapshot_only_at_terminal_completion';
    end if;
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_idempotency_snapshot$;

create trigger f23_3e_p3b_idempotency_snapshot_guard
before insert or update on public.crm_idempotency_registry
for each row execute function public.f23_3e_p3b_internal_guard_idempotency_snapshot();

create function public.f23_3e_p3b_internal_guard_account_security_control()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_account_security_control$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3b_account_security_delete_forbidden'; end if;
  if tg_op = 'INSERT' then
    if new.control_version <> 1 or new.security_version <> 1 or new.session_version <> 1
       or new.identity_control_version <> 1 or new.factor_control_version <> 1
       or new.assurance_policy_version <> 1 then
      raise exception 'f23_3e_p3b_account_security_must_start_at_version_one';
    end if;
    return new;
  end if;
  if new.canonical_user_id is distinct from old.canonical_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p3b_account_security_identity_is_immutable';
  end if;
  if old.account_lifecycle = 'REVOKED' then
    raise exception 'f23_3e_p3b_revoked_account_security_is_terminal';
  end if;
  if new.control_version <> old.control_version + 1
     or new.security_version < old.security_version
     or new.session_version < old.session_version
     or new.identity_control_version < old.identity_control_version
     or new.factor_control_version < old.factor_control_version
     or new.assurance_policy_version < old.assurance_policy_version then
    raise exception 'f23_3e_p3b_account_security_versions_not_monotonic';
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_account_security_control$;

create trigger f23_3e_p3b_account_security_control_guard
before insert or update or delete on public.account_security_control
for each row execute function public.f23_3e_p3b_internal_guard_account_security_control();

create function public.f23_3e_p3b_internal_guard_step_up_assertion()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3b_internal_guard_step_up_assertion$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3b_step_up_delete_forbidden'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'ISSUED' or new.assertion_version <> 1 then
      raise exception 'f23_3e_p3b_step_up_must_start_issued_at_version_one';
    end if;
    return new;
  end if;
  if new.step_up_assertion_id is distinct from old.step_up_assertion_id
     or new.canonical_user_id is distinct from old.canonical_user_id
     or new.logical_security_session_id is distinct from old.logical_security_session_id
     or new.center_id is distinct from old.center_id
     or new.conversion_request_id is distinct from old.conversion_request_id
     or new.purpose is distinct from old.purpose
     or new.assurance_level is distinct from old.assurance_level
     or new.verification_provider_namespace is distinct from old.verification_provider_namespace
     or new.verification_reference_digest is distinct from old.verification_reference_digest
     or new.security_version is distinct from old.security_version
     or new.session_version is distinct from old.session_version
     or new.assurance_policy_version is distinct from old.assurance_policy_version
     or new.issued_at is distinct from old.issued_at
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p3b_step_up_binding_is_immutable';
  end if;
  if old.status <> 'ISSUED' or new.status not in ('CONSUMED', 'EXPIRED', 'REVOKED', 'SUPERSEDED')
     or new.assertion_version <> old.assertion_version + 1 then
    raise exception 'f23_3e_p3b_invalid_step_up_transition';
  end if;
  if new.status = 'CONSUMED'
     and pg_catalog.current_setting('ichess.p3b_authority_issue', true) <> 'on' then
    raise exception 'f23_3e_p3b_step_up_consume_requires_authority_issue';
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_step_up_assertion$;

create trigger f23_3e_p3b_account_step_up_assertion_guard
before insert or update or delete on public.account_step_up_assertion
for each row execute function public.f23_3e_p3b_internal_guard_step_up_assertion();

create function public.f23_3e_p3b_internal_guard_conversion_action()
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
  raise exception 'f23_3e_p3b_invalid_or_unowned_action_transition: % -> %', old.status, new.status;
end;
$f23_3e_p3b_internal_guard_conversion_action$;

create trigger f23_3e_p3b_conversion_action_guard
before insert or update or delete on public.crm_conversion_action
for each row execute function public.f23_3e_p3b_internal_guard_conversion_action();

create function public.f23_3e_p3b_internal_guard_conversion_authority()
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
  if old.status <> 'ISSUED' or new.status not in ('EXPIRED', 'REVOKED', 'SUPERSEDED')
     or new.authority_version <> old.authority_version + 1 then
    raise exception 'f23_3e_p3b_invalid_or_unowned_authority_transition';
  end if;
  return new;
end;
$f23_3e_p3b_internal_guard_conversion_authority$;

create trigger f23_3e_p3b_conversion_authority_guard
before insert or update or delete on public.crm_conversion_authority
for each row execute function public.f23_3e_p3b_internal_guard_conversion_authority();

-- P1A's request trigger remains the sole lifecycle guard.  P3B opens only the
-- guarded READY_FOR_REVIEW -> APPROVED edge; P3D owns later states.
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

-- All four security/conversion tables are database-internal aggregates.
alter table public.account_security_control enable row level security;
alter table public.account_security_control force row level security;
alter table public.account_step_up_assertion enable row level security;
alter table public.account_step_up_assertion force row level security;
alter table public.crm_conversion_action enable row level security;
alter table public.crm_conversion_action force row level security;
alter table public.crm_conversion_authority enable row level security;
alter table public.crm_conversion_authority force row level security;

revoke all on table public.account_security_control from public, anon, authenticated, service_role;
revoke all on table public.account_step_up_assertion from public, anon, authenticated, service_role;
revoke all on table public.crm_conversion_action from public, anon, authenticated, service_role;
revoke all on table public.crm_conversion_authority from public, anon, authenticated, service_role;

create function public.f23_3e_p3b_internal_result_digest(p_snapshot jsonb)
returns bytea
language sql
immutable
strict
set search_path = ''
as $f23_3e_p3b_internal_result_digest$
  select extensions.digest(pg_catalog.convert_to(p_snapshot::text, 'UTF8'), 'sha256')
$f23_3e_p3b_internal_result_digest$;

create function public.f23_3e_p3b_internal_action_set_digest(
  p_conversion_request_id uuid,
  p_required_status text
)
returns bytea
language sql
stable
set search_path = ''
as $f23_3e_p3b_internal_action_set_digest$
  select extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'domain', 'ichess.crm.p3.action-set',
        'encoding_version', 1,
        'conversion_request_id', p_conversion_request_id,
        'legacy_request_action_graph_digest', pg_catalog.encode(r.action_graph_digest, 'hex'),
        'lifecycle_status', p_required_status,
        'actions', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'action_id', a.conversion_action_id,
              'action_version', a.action_version,
              'action_kind', a.action_kind,
              'action_intent_digest', pg_catalog.encode(a.action_intent_digest, 'hex'),
              'identity_kind', a.identity_kind,
              'source_contact_id', a.source_contact_id,
              'source_candidate_student_id', a.source_candidate_student_id,
              'match_review_id', a.match_review_id,
              'profile_creation_reservation_id', a.profile_creation_reservation_id,
              'target_adapter_namespace', a.target_adapter_namespace,
              'opaque_target_id', a.opaque_target_id,
              'expected_target_version', a.expected_target_version,
              'student_target_id', a.student_target_id,
              'guardian_target_id', a.guardian_target_id,
              'guardian_action_id', a.guardian_action_id,
              'student_action_id', a.student_action_id,
              'guardian_student_relationship_id', a.guardian_student_relationship_id,
              'expected_relationship_version', a.expected_relationship_version,
              'relationship_type', a.relationship_type,
              'is_primary_contact', a.is_primary_contact,
              'financial_contact_role', a.financial_contact_role,
              'academic_contact_role', a.academic_contact_role,
              'safe_reason_code', a.safe_reason_code,
              'relationship_policy_version', a.relationship_policy_version
            ) order by a.conversion_action_id
          )
          from public.crm_conversion_action a
          where a.conversion_request_id = p_conversion_request_id
            and a.status = p_required_status
        ), '[]'::jsonb)
      )::text,
      'UTF8'
    ),
    'sha256'
  )
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id
$f23_3e_p3b_internal_action_set_digest$;

create function public.f23_3e_p3b_internal_binding_set_digest(
  p_conversion_request_id uuid,
  p_binding_kind text
)
returns bytea
language sql
stable
set search_path = ''
as $f23_3e_p3b_internal_binding_set_digest$
  select extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'domain', 'ichess.crm.p3.binding-set',
        'encoding_version', 1,
        'conversion_request_id', p_conversion_request_id,
        'binding_kind', p_binding_kind,
        'values', coalesce(pg_catalog.jsonb_agg(x.binding order by x.binding), '[]'::jsonb)
      )::text,
      'UTF8'
    ),
    'sha256'
  )
  from (
    select distinct case p_binding_kind
      when 'REVIEW' then a.match_review_id::text
      when 'RESERVATION' then a.profile_creation_reservation_id::text
      when 'TARGET' then coalesce(a.target_adapter_namespace, '') || ':' || coalesce(a.opaque_target_id::text, '') || ':' || coalesce(a.expected_target_version::text, '')
      else null
    end as binding
    from public.crm_conversion_action a
    where a.conversion_request_id = p_conversion_request_id
      and (
        (p_binding_kind = 'REVIEW' and a.match_review_id is not null)
        or (p_binding_kind = 'RESERVATION' and a.profile_creation_reservation_id is not null)
        or (p_binding_kind = 'TARGET' and a.opaque_target_id is not null)
      )
  ) x;
$f23_3e_p3b_internal_binding_set_digest$;

create function public.f23_3e_p3b_internal_append_audit_outbox(
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
as $f23_3e_p3b_internal_append_audit_outbox$
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
    'new_version', p_new_version,
    'status', p_status,
    'safe_reason_code', p_safe_reason_code,
    'correlation_id', p_correlation_id,
    'operation', p_operation,
    'outcome_code', p_outcome_code
  );
  if p_request_id is not null then v_payload := v_payload || pg_catalog.jsonb_build_object('request_id', p_request_id); end if;
  if p_assignment_id is not null then v_payload := v_payload || pg_catalog.jsonb_build_object('assignment_id', p_assignment_id); end if;
  if p_previous_version is not null then v_payload := v_payload || pg_catalog.jsonb_build_object('previous_version', p_previous_version); end if;

  insert into public.crm_outbox_event (
    center_id, aggregate_kind, aggregate_id, event_type, event_version, safe_payload
  ) values (
    p_center_id, p_resource_kind, p_resource_id, p_event_type, p_new_version, v_payload
  );
end;
$f23_3e_p3b_internal_append_audit_outbox$;

create function public.f23_3e_p3b_register_or_sync_account_security_control(
  p_actor_user_id uuid,
  p_verified_account_user_id uuid,
  p_verified_account_lifecycle text,
  p_account_evidence_digest bytea,
  p_expected_control_version integer,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  canonical_user_id uuid,
  security_version integer,
  session_version integer,
  control_version integer,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3b_register_or_sync_account_security_control$
declare
  v_center_id text;
  v_membership public.center_members%rowtype;
  v_root public.center_crm_control%rowtype;
  v_control public.account_security_control%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_snapshot jsonb;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_outcome text;
  v_previous integer;
  v_binding_digest bytea;
begin
  if p_actor_user_id is null or p_verified_account_user_id is null
     or p_verified_account_lifecycle not in ('ACTIVE', 'SUSPENDED', 'DISABLED', 'REVOKED')
     or p_account_evidence_digest is null or pg_catalog.octet_length(p_account_evidence_digest) <> 32
     or (p_expected_control_version is not null and p_expected_control_version < 1)
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, p_verified_account_user_id,
      null::integer, null::integer, null::integer, null::uuid;
    return;
  end if;

  v_binding_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain', 'ichess.crm.p3b.account-security-sync.v1',
    'actor_user_id', p_actor_user_id,
    'verified_account_user_id', p_verified_account_user_id,
    'verified_account_lifecycle', p_verified_account_lifecycle,
    'account_evidence_digest', pg_catalog.encode(p_account_evidence_digest, 'hex'),
    'expected_control_version', p_expected_control_version
  )::text, 'UTF8'), 'sha256');

  select m.center_id into v_center_id
  from public.center_members m
  where m.user_id = p_verified_account_user_id
  order by (m.status = 'active') desc, m.center_id, m.id
  limit 1;
  if not found then
    return query select false, 'VERIFIED_ACCOUNT_MEMBERSHIP_NOT_FOUND', false,
      p_verified_account_user_id, null::integer, null::integer, null::integer, null::uuid;
    return;
  end if;

  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, p_verified_account_user_id,
      null::integer, null::integer, null::integer, null::uuid;
    return;
  end if;

  select c.* into v_control from public.account_security_control c
  where c.canonical_user_id = p_verified_account_user_id for update;

  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_verified_account_user_id for update;
  if not found then
    return query select false, 'VERIFIED_ACCOUNT_MEMBERSHIP_NOT_FOUND', false,
      p_verified_account_user_id, null::integer, null::integer, null::integer, null::uuid;
    return;
  end if;

  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = extensions.digest(pg_catalog.convert_to('ichess.local.account-security.v1', 'UTF8'), 'sha256')
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'account_security_control'
    and i.resource_scope_id = p_verified_account_user_id
    and i.operation = 'security.register_or_sync_account_security_control'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;

  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, p_verified_account_user_id,
        null::integer, null::integer, null::integer, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED' then
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_registry.p3_result_snapshot ->> 'canonical_user_id')::uuid,
        (v_registry.p3_result_snapshot ->> 'security_version')::integer,
        (v_registry.p3_result_snapshot ->> 'session_version')::integer,
        (v_registry.p3_result_snapshot ->> 'resource_version')::integer,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, p_verified_account_user_id,
      null::integer, null::integer, null::integer, null::uuid;
    return;
  end if;

  if v_control.canonical_user_id is null and p_expected_control_version is not null then
    return query select false, 'ACCOUNT_CONTROL_VERSION_STALE', false, p_verified_account_user_id,
      null::integer, null::integer, null::integer, null::uuid;
    return;
  elsif v_control.canonical_user_id is not null
     and (p_expected_control_version is null or p_expected_control_version <> v_control.control_version) then
    return query select false, 'ACCOUNT_CONTROL_VERSION_STALE', false, p_verified_account_user_id,
      v_control.security_version, v_control.session_version, v_control.control_version, null::uuid;
    return;
  elsif v_control.account_lifecycle = 'REVOKED' then
    return query select false, 'ACCOUNT_CONTROL_REVOKED', false, p_verified_account_user_id,
      v_control.security_version, v_control.session_version, v_control.control_version, null::uuid;
    return;
  end if;

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    operation, idempotency_key_digest, intent_digest, expires_at, p3_actor_user_id,
    p3_operation_binding_digest
  ) values (
    extensions.digest(pg_catalog.convert_to('ichess.local.account-security.v1', 'UTF8'), 'sha256'),
    v_center_id, 'account_security_control', p_verified_account_user_id,
    'security.register_or_sync_account_security_control', p_idempotency_key_digest,
    p_operation_intent_digest, p_idempotency_expires_at, p_actor_user_id,
    v_binding_digest
  ) returning * into v_registry;

  if v_control.canonical_user_id is null then
    if p_expected_control_version is not null then
      return query select false, 'ACCOUNT_CONTROL_VERSION_STALE', false, p_verified_account_user_id,
        null::integer, null::integer, null::integer, null::uuid;
      return;
    end if;
    insert into public.account_security_control (
      canonical_user_id, account_lifecycle, security_version, session_version,
      identity_control_version, factor_control_version, assurance_policy_version,
      account_evidence_digest, control_version, terminal_at
    ) values (
      p_verified_account_user_id, p_verified_account_lifecycle, 1, 1, 1, 1, 1,
      p_account_evidence_digest, 1,
      case when p_verified_account_lifecycle = 'REVOKED' then v_now else null end
    ) returning * into v_control;
    v_previous := null;
    v_outcome := 'ACCOUNT_SECURITY_CONTROL_REGISTERED';
  else
    if p_expected_control_version is null or p_expected_control_version <> v_control.control_version then
      return query select false, 'ACCOUNT_CONTROL_VERSION_STALE', false, p_verified_account_user_id,
        v_control.security_version, v_control.session_version, v_control.control_version, null::uuid;
      return;
    end if;
    if v_control.account_lifecycle = 'REVOKED' then
      return query select false, 'ACCOUNT_CONTROL_REVOKED', false, p_verified_account_user_id,
        v_control.security_version, v_control.session_version, v_control.control_version, null::uuid;
      return;
    end if;
    v_previous := v_control.control_version;
    update public.account_security_control c set
      account_lifecycle = p_verified_account_lifecycle,
      security_version = c.security_version + 1,
      session_version = c.session_version + 1,
      identity_control_version = c.identity_control_version + 1,
      factor_control_version = c.factor_control_version + 1,
      assurance_policy_version = c.assurance_policy_version + 1,
      account_evidence_digest = p_account_evidence_digest,
      control_version = c.control_version + 1,
      updated_at = v_now,
      terminal_at = case when p_verified_account_lifecycle = 'REVOKED' then v_now else null end
    where c.canonical_user_id = p_verified_account_user_id
    returning * into v_control;
    v_outcome := 'ACCOUNT_SECURITY_CONTROL_SYNCED';
  end if;

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1, 'result_type', 'ACCOUNT_SECURITY_CONTROL',
    'resource_id', v_control.canonical_user_id, 'resource_version', v_control.control_version,
    'resource_status', v_control.account_lifecycle, 'canonical_user_id', v_control.canonical_user_id,
    'security_version', v_control.security_version, 'session_version', v_control.session_version,
    'correlation_id', v_correlation_id, 'outcome_code', v_outcome
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED', terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1, completed_at = v_now,
    p3_result_kind = 'CONVERSION_AUTHORITY', p3_result_outcome_code = v_outcome,
    p3_result_snapshot = v_snapshot, p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;

  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'security.account-control.synced', p_actor_user_id,
    'account_security_control', p_verified_account_user_id, null, null,
    v_previous, v_control.control_version, v_control.account_lifecycle,
    pg_catalog.lower(v_outcome), 'security.register_or_sync_account_security_control',
    v_outcome, v_correlation_id
  );
  return query select true, v_outcome, false, v_control.canonical_user_id,
    v_control.security_version, v_control.session_version, v_control.control_version, v_correlation_id;
end;
$f23_3e_p3b_register_or_sync_account_security_control$;

create function public.f23_3e_p3b_record_verified_conversion_step_up(
  p_actor_user_id uuid,
  p_logical_security_session_id uuid,
  p_conversion_request_id uuid,
  p_assurance_level text,
  p_verification_provider_namespace text,
  p_verification_reference_digest bytea,
  p_server_verified_at timestamptz,
  p_expected_account_control_version integer,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  step_up_assertion_id uuid,
  assertion_version integer,
  issued_at timestamptz,
  expires_at timestamptz,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3b_record_verified_conversion_step_up$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_control public.account_security_control%rowtype;
  v_membership public.center_members%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_existing public.account_step_up_assertion%rowtype;
  v_assertion public.account_step_up_assertion%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_snapshot jsonb;
  v_binding_digest bytea;
begin
  if p_actor_user_id is null or p_logical_security_session_id is null or p_conversion_request_id is null
     or p_assurance_level not in ('AAL2_TOTP', 'AAL2_PHISHING_RESISTANT', 'AAL3_HARDWARE_BACKED')
     or p_verification_provider_namespace is null
     or p_verification_provider_namespace !~ '^[a-z][a-z0-9_.-]{2,79}$'
     or p_verification_reference_digest is null or pg_catalog.octet_length(p_verification_reference_digest) <> 32
     or p_server_verified_at is null or p_server_verified_at > v_now + interval '30 seconds'
     or p_server_verified_at < v_now - interval '2 minutes'
     or p_expected_account_control_version is null or p_expected_account_control_version < 1
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false,
      case when p_server_verified_at is not null and (p_server_verified_at < v_now - interval '2 minutes' or p_server_verified_at > v_now + interval '30 seconds')
        then 'STEP_UP_EXPIRED_OR_STALE' else 'INVALID_INPUT' end,
      false, null::uuid, null::integer, null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;

  v_binding_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain', 'ichess.crm.p3b.verified-step-up.v1',
    'actor_user_id', p_actor_user_id,
    'logical_security_session_id', p_logical_security_session_id,
    'conversion_request_id', p_conversion_request_id,
    'assurance_level', p_assurance_level,
    'verification_provider_namespace', p_verification_provider_namespace,
    'verification_reference_digest', pg_catalog.encode(p_verification_reference_digest, 'hex'),
    'server_verified_at', p_server_verified_at,
    'expected_account_control_version', p_expected_account_control_version
  )::text, 'UTF8'), 'sha256');

  select r.center_id into v_center_id from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;

  select r.* into v_root from public.center_crm_control r where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  select c.* into v_control from public.account_security_control c
  where c.canonical_user_id = p_actor_user_id for update;
  select s.* into v_existing from public.account_step_up_assertion s
  where s.center_id = v_center_id and s.canonical_user_id = p_actor_user_id
    and s.conversion_request_id = p_conversion_request_id
    and s.purpose = 'crm.real_conversion.execute' and s.status = 'ISSUED'
  for update;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id for update;

  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = extensions.digest(pg_catalog.convert_to('ichess.local.step-up.v1', 'UTF8'), 'sha256')
    and i.center_id = v_center_id and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'security.record_verified_conversion_step_up'
    and i.idempotency_key_digest = p_idempotency_key_digest for update;
  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, null::uuid, null::integer,
        null::timestamptz, null::timestamptz, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED' then
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_registry.p3_result_snapshot ->> 'resource_id')::uuid,
        (v_registry.p3_result_snapshot ->> 'resource_version')::integer,
        (v_registry.p3_result_snapshot ->> 'issued_at')::timestamptz,
        (v_registry.p3_result_snapshot ->> 'expires_at')::timestamptz,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;

  if v_control.canonical_user_id is null then
    return query select false, 'ACCOUNT_SECURITY_CONTROL_MISSING', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  if v_control.account_lifecycle <> 'ACTIVE' then
    return query select false, 'ACCOUNT_NOT_ACTIVE', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  if v_control.control_version <> p_expected_account_control_version then
    return query select false, 'ACCOUNT_CONTROL_VERSION_STALE', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  if v_membership.id is null or v_membership.status <> 'active' then
    return query select false, 'MEMBERSHIP_NOT_ACTIVE', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;

  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id for update;
  if v_request.status <> 'READY_FOR_REVIEW' then
    return query select false, 'REQUEST_NOT_READY_FOR_REVIEW', false, null::uuid, null::integer,
      null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  if v_existing.step_up_assertion_id is not null then
    if v_existing.expires_at <= v_now then
      update public.account_step_up_assertion s set
        status = 'EXPIRED', assertion_version = s.assertion_version + 1,
        terminal_at = v_now, terminal_reason_code = 'server_expired', updated_at = v_now
      where s.step_up_assertion_id = v_existing.step_up_assertion_id;
      perform public.f23_3e_p3b_internal_append_audit_outbox(
        v_center_id, 'security.conversion-step-up.expired', p_actor_user_id,
        'account_step_up_assertion', v_existing.step_up_assertion_id,
        p_conversion_request_id, v_request.source_assignment_id,
        v_existing.assertion_version, v_existing.assertion_version + 1,
        'EXPIRED', 'server_expired', 'security.record_verified_conversion_step_up',
        'STEP_UP_ASSERTION_EXPIRED', v_correlation_id
      );
    elsif v_existing.security_version <> v_control.security_version
       or v_existing.session_version <> v_control.session_version
       or v_existing.assurance_policy_version <> v_control.assurance_policy_version
       or v_existing.logical_security_session_id <> p_logical_security_session_id then
      update public.account_step_up_assertion s set
        status = 'SUPERSEDED', assertion_version = s.assertion_version + 1,
        terminal_at = v_now, terminal_reason_code = 'security_session_superseded', updated_at = v_now
      where s.step_up_assertion_id = v_existing.step_up_assertion_id;
      perform public.f23_3e_p3b_internal_append_audit_outbox(
        v_center_id, 'security.conversion-step-up.superseded', p_actor_user_id,
        'account_step_up_assertion', v_existing.step_up_assertion_id,
        p_conversion_request_id, v_request.source_assignment_id,
        v_existing.assertion_version, v_existing.assertion_version + 1,
        'SUPERSEDED', 'security_session_superseded', 'security.record_verified_conversion_step_up',
        'STEP_UP_ASSERTION_SUPERSEDED', v_correlation_id
      );
    else
      return query select false, 'STEP_UP_ALREADY_ISSUED', false,
        v_existing.step_up_assertion_id, v_existing.assertion_version,
        v_existing.issued_at, v_existing.expires_at, null::uuid;
      return;
    end if;
  end if;

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    request_id, expires_at, p3_actor_user_id, p3_operation_binding_digest
  ) values (
    extensions.digest(pg_catalog.convert_to('ichess.local.step-up.v1', 'UTF8'), 'sha256'),
    v_center_id, 'conversion_request', p_conversion_request_id,
    v_request.consultation_case_id, 'security.record_verified_conversion_step_up',
    p_idempotency_key_digest, p_operation_intent_digest, p_conversion_request_id,
    p_idempotency_expires_at, p_actor_user_id, v_binding_digest
  ) returning * into v_registry;

  insert into public.account_step_up_assertion (
    canonical_user_id, logical_security_session_id, center_id, conversion_request_id,
    purpose, assurance_level, verification_provider_namespace,
    verification_reference_digest, security_version, session_version,
    assurance_policy_version, status, assertion_version, issued_at, expires_at
  ) values (
    p_actor_user_id, p_logical_security_session_id, v_center_id, p_conversion_request_id,
    'crm.real_conversion.execute', p_assurance_level, p_verification_provider_namespace,
    p_verification_reference_digest, v_control.security_version, v_control.session_version,
    v_control.assurance_policy_version, 'ISSUED', 1, v_now,
    least(v_now + interval '5 minutes', p_server_verified_at + interval '5 minutes')
  ) returning * into v_assertion;

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1, 'result_type', 'STEP_UP_ASSERTION',
    'resource_id', v_assertion.step_up_assertion_id, 'resource_version', v_assertion.assertion_version,
    'resource_status', v_assertion.status, 'issued_at', v_assertion.issued_at,
    'expires_at', v_assertion.expires_at, 'correlation_id', v_correlation_id,
    'outcome_code', 'STEP_UP_ASSERTION_ISSUED'
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED', terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1, completed_at = v_now,
    p3_result_kind = 'CONVERSION_AUTHORITY', p3_result_outcome_code = 'STEP_UP_ASSERTION_ISSUED',
    p3_result_snapshot = v_snapshot, p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'security.conversion-step-up.issued', p_actor_user_id,
    'account_step_up_assertion', v_assertion.step_up_assertion_id,
    p_conversion_request_id, v_request.source_assignment_id, null, 1,
    'ISSUED', 'step_up_assertion_issued', 'security.record_verified_conversion_step_up',
    'STEP_UP_ASSERTION_ISSUED', v_correlation_id
  );
  return query select true, 'STEP_UP_ASSERTION_ISSUED', false,
    v_assertion.step_up_assertion_id, v_assertion.assertion_version,
    v_assertion.issued_at, v_assertion.expires_at, v_correlation_id;
end;
$f23_3e_p3b_record_verified_conversion_step_up$;

create function public.f23_3e_p3b_evaluate_conversion_capability(
  p_actor_user_id uuid,
  p_conversion_request_id uuid,
  p_step_up_assertion_id uuid,
  p_expected_request_version integer
)
returns table (
  decision text,
  reason_code text,
  center_id text,
  membership_id uuid,
  membership_version integer,
  account_security_version integer,
  account_session_version integer,
  conversion_policy_version integer,
  assignment_id uuid,
  assignment_version integer,
  required_assurance text,
  step_up_assertion_version integer
)
language plpgsql
stable
security definer
set search_path = ''
as $f23_3e_p3b_evaluate_conversion_capability$
declare
  v_request public.crm_conversion_request%rowtype;
  v_root public.center_crm_control%rowtype;
  v_control public.account_security_control%rowtype;
  v_membership public.center_members%rowtype;
  v_case public.consultation_case%rowtype;
  v_contact public.crm_contact%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_step public.account_step_up_assertion%rowtype;
  v_action_count integer;
  v_student_count integer;
  v_guardian_count integer;
  v_relationship_count integer;
  v_reason text;
begin
  select r.* into v_request from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select 'DENY', 'REQUEST_NOT_FOUND', null::text, null::uuid,
      null::integer, null::integer, null::integer, null::integer, null::uuid,
      null::integer, 'AAL2_TOTP', null::integer;
    return;
  end if;

  select r.* into v_root from public.center_crm_control r where r.center_id = v_request.center_id;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then v_reason := 'CRM_RUNTIME_NOT_ACTIVE';
  elsif v_root.identity_policy_version <> v_request.identity_policy_version
     or v_root.conversion_policy_version <> v_request.conversion_policy_version
     or v_root.relationship_policy_version <> v_request.relationship_policy_version
     or v_root.student_profile_policy_version <> v_request.student_profile_policy_version then v_reason := 'CONVERSION_POLICY_VERSION_STALE';
  else
    select c.* into v_control from public.account_security_control c where c.canonical_user_id = p_actor_user_id;
    if not found then v_reason := 'ACCOUNT_SECURITY_CONTROL_MISSING';
    elsif v_control.account_lifecycle <> 'ACTIVE' then v_reason := 'ACCOUNT_NOT_ACTIVE';
    else
      select m.* into v_membership from public.center_members m
      where m.center_id = v_request.center_id and m.user_id = p_actor_user_id;
      if not found or v_membership.status <> 'active' then v_reason := 'MEMBERSHIP_NOT_ACTIVE';
      elsif v_membership.role not in ('owner', 'center_admin') then v_reason := 'FINAL_APPROVAL_ROLE_DENIED';
      elsif v_request.status <> 'READY_FOR_REVIEW' then v_reason := 'REQUEST_NOT_READY_FOR_REVIEW';
      elsif p_expected_request_version is null or v_request.request_version <> p_expected_request_version then v_reason := 'REQUEST_VERSION_STALE';
      elsif v_request.requested_by_user_id = p_actor_user_id then v_reason := 'SEPARATION_OF_DUTIES_DENIED';
      else
        select c.* into v_contact from public.crm_contact c
        where c.center_id = v_request.center_id and c.crm_contact_id = v_request.source_contact_id;
        select c.* into v_case from public.consultation_case c
        where c.center_id = v_request.center_id and c.consultation_case_id = v_request.consultation_case_id;
        select a.* into v_assignment from public.consultation_case_assignment a
        where a.center_id = v_request.center_id and a.assignment_id = v_request.source_assignment_id;
        if v_contact.crm_contact_id is null or v_contact.contact_version <> v_request.source_contact_version
           or v_contact.contact_status = 'ARCHIVED' then v_reason := 'CONTACT_STATE_STALE';
        elsif v_case.consultation_case_id is null or v_case.case_version <> v_request.source_case_version
           or v_case.status not in ('OPEN', 'CONSULTING', 'READY_FOR_CONVERSION')
           or v_case.active_assignment_id is distinct from v_request.source_assignment_id then v_reason := 'CASE_STATE_STALE';
        elsif v_assignment.assignment_id is null or v_assignment.assignment_status <> 'ACTIVE'
           or v_assignment.assignment_version <> v_request.source_assignment_version then v_reason := 'ASSIGNMENT_STATE_STALE';
        elsif v_assignment.assigned_consultant_user_id = p_actor_user_id then v_reason := 'SEPARATION_OF_DUTIES_DENIED';
        else
          select pg_catalog.count(*),
            pg_catalog.count(*) filter (where a.identity_kind = 'STUDENT'),
            pg_catalog.count(*) filter (where a.identity_kind = 'GUARDIAN'),
            pg_catalog.count(*) filter (where a.identity_kind is null)
          into v_action_count, v_student_count, v_guardian_count, v_relationship_count
          from public.crm_conversion_action a
          where a.center_id = v_request.center_id
            and a.conversion_request_id = p_conversion_request_id
            and a.status = 'REVIEWED'
            and a.legacy_request_action_graph_digest = v_request.action_graph_digest;
          if v_action_count <> 3 or v_student_count <> 1 or v_guardian_count <> 1 or v_relationship_count <> 1
             or exists (
               select 1 from public.crm_conversion_action a
               where a.conversion_request_id = p_conversion_request_id
                 and (
                   a.status <> 'REVIEWED'
                   or a.legacy_request_action_graph_digest is distinct from v_request.action_graph_digest
                   or (a.action_kind like 'CREATE_NEW_%' and a.profile_creation_reservation_id is null)
                   or (a.action_kind like 'REUSE_REVIEWED_%' and (a.match_review_id is null or a.opaque_target_id is null or a.expected_target_version is null))
                 )
             )
             or exists (
               select 1
               from public.crm_conversion_action a
               left join public.consultation_case_candidate_student c
                 on c.center_id = a.center_id and c.candidate_student_id = a.source_candidate_student_id
               where a.conversion_request_id = p_conversion_request_id
                 and a.identity_kind = 'STUDENT'
                 and (c.candidate_student_id is null
                   or c.consultation_case_id <> v_request.consultation_case_id
                   or c.candidate_status not in ('ACTIVE', 'REVIEW_REQUIRED'))
             )
             or exists (
               select 1
               from public.crm_conversion_action rel
               left join public.crm_conversion_action guardian
                 on guardian.center_id = rel.center_id
                and guardian.conversion_request_id = rel.conversion_request_id
                and guardian.conversion_action_id = rel.guardian_action_id
               left join public.crm_conversion_action student
                 on student.center_id = rel.center_id
                and student.conversion_request_id = rel.conversion_request_id
                and student.conversion_action_id = rel.student_action_id
               where rel.conversion_request_id = p_conversion_request_id
                 and rel.identity_kind is null
                 and (guardian.identity_kind is distinct from 'GUARDIAN'
                   or student.identity_kind is distinct from 'STUDENT'
                   or guardian.status <> 'REVIEWED' or student.status <> 'REVIEWED')
             )
             or exists (
               select 1
               from public.crm_conversion_action a
               left join public.crm_identity_match_review r
                 on r.center_id = a.center_id and r.match_review_id = a.match_review_id
               left join public.crm_profile_creation_reservation p
                 on p.center_id = a.center_id and p.reservation_id = a.profile_creation_reservation_id
               where a.conversion_request_id = p_conversion_request_id
                 and (
                   (a.action_kind like 'CREATE_NEW_%' and (
                     r.review_status <> 'CREATE_NEW_REVIEWED' or p.status <> 'ACTIVE'
                     or p.match_review_id <> r.match_review_id
                     or p.preallocated_target_id <> a.opaque_target_id
                     or p.target_adapter_namespace <> a.target_adapter_namespace
                   ))
                   or (a.action_kind like 'REUSE_REVIEWED_%' and (
                     r.review_status <> 'EXACT_REVIEWED_MATCH'
                     or r.opaque_target_id <> a.opaque_target_id
                     or r.target_adapter_namespace <> a.target_adapter_namespace
                     or r.target_version <> a.expected_target_version
                   ))
                 )
             ) then v_reason := 'REVIEWED_ACTION_SET_INCOMPLETE';
          else
            select s.* into v_step from public.account_step_up_assertion s
            where s.step_up_assertion_id = p_step_up_assertion_id;
            if not found or v_step.canonical_user_id <> p_actor_user_id
               or v_step.center_id <> v_request.center_id
               or v_step.conversion_request_id <> p_conversion_request_id
               or v_step.purpose <> 'crm.real_conversion.execute' then v_reason := 'STEP_UP_BINDING_MISMATCH';
            elsif v_step.status <> 'ISSUED' or v_step.expires_at <= pg_catalog.transaction_timestamp() then v_reason := 'STEP_UP_EXPIRED_OR_STALE';
            elsif v_step.security_version <> v_control.security_version
               or v_step.session_version <> v_control.session_version
               or v_step.assurance_policy_version <> v_control.assurance_policy_version then v_reason := 'ACCOUNT_SECURITY_SESSION_DRIFT';
            elsif v_step.assurance_level not in ('AAL2_TOTP', 'AAL2_PHISHING_RESISTANT', 'AAL3_HARDWARE_BACKED') then v_reason := 'STEP_UP_ASSURANCE_INSUFFICIENT';
            end if;
          end if;
        end if;
      end if;
    end if;
  end if;

  return query select case when v_reason is null then 'ALLOW' else 'DENY' end,
    coalesce(v_reason, 'FINAL_CONVERSION_CAPABILITY_ALLOWED'), v_request.center_id,
    v_membership.id, v_membership.membership_version,
    v_control.security_version, v_control.session_version,
    v_root.conversion_policy_version, v_assignment.assignment_id,
    v_assignment.assignment_version, 'AAL2_TOTP', v_step.assertion_version;
end;
$f23_3e_p3b_evaluate_conversion_capability$;

-- AUTHORITY_ISSUANCE_CANONICAL_LOCK_ORDER_BEGIN
-- 0 CENTER_CRM_CONTROL_ROW
-- 1 SORTED_IDENTITY_MUTEX_ROWS
-- 2 ACCOUNT_SECURITY_CONTROL_ROW
-- 3 STEP_UP_ASSERTION_ROW
-- 4 MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS
-- 5 AUTHORITY_SCOPE_ADVISORY_MUTEX
-- 6 IDEMPOTENCY_REGISTRY_ROW
-- 7 CONVERSION_REQUEST_ROW
-- 8 CONVERSION_ACTION_ROWS_SORTED_ID
-- 9 CRM_CONTACT_ROW
-- 10 CONSULTATION_CASE_ROW
-- 11 CANDIDATE_STUDENT_ROWS_SORTED_ID
-- 12 ASSIGNMENT_ROW
-- 13 TARGET_ROWS_IF_ANY (absent in P3B no-target plans)
-- 14 MATCH_REVIEW_ROWS
-- 15 PROFILE_CREATION_RESERVATION_ROWS
-- 16 AUDIT, OUTBOX, COMMIT
-- AUTHORITY_ISSUANCE_CANONICAL_LOCK_ORDER_END
create function public.f23_3e_p3b_issue_conversion_authority(
  p_actor_user_id uuid,
  p_conversion_request_id uuid,
  p_step_up_assertion_id uuid,
  p_expected_request_version integer,
  p_expected_step_up_assertion_version integer,
  p_environment_fingerprint bytea,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  conversion_authority_id uuid,
  authority_version integer,
  request_status text,
  request_version integer,
  expires_at timestamptz,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3b_issue_conversion_authority$
declare
  v_center_id text;
  v_request public.crm_conversion_request%rowtype;
  v_root public.center_crm_control%rowtype;
  v_control public.account_security_control%rowtype;
  v_step public.account_step_up_assertion%rowtype;
  v_membership public.center_members%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_authority public.crm_conversion_authority%rowtype;
  v_capability record;
  v_authority_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_action_digest bytea;
  v_review_digest bytea;
  v_reservation_digest bytea;
  v_target_digest bytea;
  v_snapshot jsonb;
  v_action_count integer;
  v_binding_digest bytea;
begin
  if p_actor_user_id is null or p_conversion_request_id is null or p_step_up_assertion_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_step_up_assertion_version is null or p_expected_step_up_assertion_version < 1
     or p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::integer,
      null::text, null::integer, null::timestamptz, null::uuid;
    return;
  end if;

  v_binding_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain', 'ichess.crm.p3b.authority-issue.v1',
    'actor_user_id', p_actor_user_id,
    'conversion_request_id', p_conversion_request_id,
    'step_up_assertion_id', p_step_up_assertion_id,
    'expected_request_version', p_expected_request_version,
    'expected_step_up_assertion_version', p_expected_step_up_assertion_version,
    'environment_fingerprint', pg_catalog.encode(p_environment_fingerprint, 'hex')
  )::text, 'UTF8'), 'sha256');

  -- Selector read derives center; it takes no lock and is rechecked at tier 7.
  select r.center_id into v_center_id from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::integer,
      null::text, null::integer, null::timestamptz, null::uuid;
    return;
  end if;

  -- 0. Center root.
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid, null::integer,
      null::text, null::integer, null::timestamptz, null::uuid;
    return;
  end if;

  -- 1. Every current center identity mutex is locked in its canonical byte order.
  perform m.identity_match_mutex_key from public.crm_identity_match_mutex m
  where m.center_id = v_center_id
  order by m.identity_kind, m.identity_match_mutex_key for update;

  -- 2-4. Account, assertion, then membership/support.
  select c.* into v_control from public.account_security_control c
  where c.canonical_user_id = p_actor_user_id for update;
  select s.* into v_step from public.account_step_up_assertion s
  where s.step_up_assertion_id = p_step_up_assertion_id for update;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id for update;

  -- 5. Stable Request-scoped authority mutex precedes idempotency.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f23.3e.p3b.authority|' || v_center_id || '|' || p_conversion_request_id::text, 0)
  );

  -- 6. Exact replay is read only after all earlier canonical locks.  It returns
  -- the immutable committed result and deliberately does not reinterpret the
  -- now-APPROVED Request/actions or the now-CONSUMED assertion.
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = p_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'security.issue_conversion_authority'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_step_up_assertion_id is distinct from p_step_up_assertion_id
       or v_registry.p3_expected_request_version is distinct from p_expected_request_version
       or v_registry.p3_expected_resource_version is distinct from p_expected_step_up_assertion_version
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, null::uuid, null::integer,
        null::text, null::integer, null::timestamptz, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED' then
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_registry.p3_result_snapshot ->> 'resource_id')::uuid,
        (v_registry.p3_result_snapshot ->> 'resource_version')::integer,
        v_registry.p3_result_snapshot ->> 'resource_status',
        (v_registry.p3_result_snapshot ->> 'request_version')::integer,
        (v_registry.p3_result_snapshot ->> 'expires_at')::timestamptz,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, null::uuid, null::integer,
      null::text, null::integer, null::timestamptz, null::uuid;
    return;
  end if;

  -- 7-15. Remaining canonical rows.
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id for update;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::uuid, null::integer,
      null::text, null::integer, null::timestamptz, null::uuid;
    return;
  end if;
  perform a.conversion_action_id from public.crm_conversion_action a
  where a.center_id = v_center_id and a.conversion_request_id = p_conversion_request_id
  order by a.conversion_action_id for update;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_request.source_contact_id for update;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = v_request.consultation_case_id for update;
  perform c.candidate_student_id from public.consultation_case_candidate_student c
  where c.center_id = v_center_id and c.consultation_case_id = v_request.consultation_case_id
  order by c.candidate_student_id for update;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id and a.assignment_id = v_request.source_assignment_id for update;
  perform r.match_review_id from public.crm_identity_match_review r
  join public.crm_conversion_action a on a.match_review_id = r.match_review_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.match_review_id for update of r;
  perform r.reservation_id from public.crm_profile_creation_reservation r
  join public.crm_conversion_action a on a.profile_creation_reservation_id = r.reservation_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.reservation_id for update of r;

  select * into v_capability from public.f23_3e_p3b_evaluate_conversion_capability(
    p_actor_user_id, p_conversion_request_id, p_step_up_assertion_id, p_expected_request_version
  );
  if v_capability.decision <> 'ALLOW' then
    return query select false, v_capability.reason_code, false, null::uuid, null::integer,
      v_request.status, v_request.request_version, null::timestamptz, null::uuid;
    return;
  end if;
  if v_step.assertion_version <> p_expected_step_up_assertion_version then
    return query select false, 'STEP_UP_VERSION_STALE', false, null::uuid, null::integer,
      v_request.status, v_request.request_version, null::timestamptz, null::uuid;
    return;
  end if;

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    action_graph_digest, request_id, expires_at, p3_actor_user_id,
    p3_step_up_assertion_id, p3_expected_request_version,
    p3_expected_resource_version, p3_operation_binding_digest,
    p3_legacy_request_action_graph_digest
  ) values (
    p_environment_fingerprint, v_center_id, 'conversion_request', p_conversion_request_id,
    v_request.consultation_case_id, 'security.issue_conversion_authority',
    p_idempotency_key_digest, p_operation_intent_digest,
    v_request.action_graph_digest, p_conversion_request_id, p_idempotency_expires_at,
    p_actor_user_id, p_step_up_assertion_id, p_expected_request_version,
    p_expected_step_up_assertion_version, v_binding_digest, v_request.action_graph_digest
  ) returning * into v_registry;

  if v_request.action_graph_digest is distinct from v_registry.p3_legacy_request_action_graph_digest then
    return query select false, 'LEGACY_REQUEST_DIGEST_BINDING_STALE', false, null::uuid, null::integer,
      v_request.status, v_request.request_version, null::timestamptz, null::uuid;
    return;
  end if;

  perform pg_catalog.set_config('ichess.p3b_authority_issue', 'on', true);

  -- Required lifecycle ordering: consume assertion, approve Request, then move
  -- every action to APPROVED +1 before deriving the authoritative V1 digest.
  update public.account_step_up_assertion s set
    status = 'CONSUMED', assertion_version = s.assertion_version + 1,
    terminal_at = v_now, terminal_reason_code = 'authority_issued',
    consumed_by_authority_id = v_authority_id, updated_at = v_now
  where s.step_up_assertion_id = p_step_up_assertion_id
  returning * into v_step;

  update public.crm_conversion_request r set
    status = 'APPROVED', request_version = r.request_version + 1, updated_at = v_now
  where r.conversion_request_id = p_conversion_request_id
  returning * into v_request;

  update public.crm_conversion_action a set
    status = 'APPROVED', action_version = a.action_version + 1, updated_at = v_now
  where a.conversion_request_id = p_conversion_request_id and a.status = 'REVIEWED';
  get diagnostics v_action_count = row_count;
  if v_action_count <> 3 then
    raise exception using message = 'REVIEWED_ACTION_SET_CHANGED_DURING_APPROVAL', errcode = 'P0001';
  end if;

  -- POST_APPROVED_DIGEST_COMPUTE_BEGIN: persisted APPROVED rows already carry +1.
  v_action_digest := public.f23_3e_p3b_internal_action_set_digest(p_conversion_request_id, 'APPROVED');
  v_review_digest := public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id, 'REVIEW');
  v_reservation_digest := public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id, 'RESERVATION');
  v_target_digest := public.f23_3e_p3b_internal_binding_set_digest(p_conversion_request_id, 'TARGET');
  -- POST_APPROVED_DIGEST_COMPUTE_END
  if v_action_digest is null then
    raise exception using message = 'APPROVED_ACTION_SET_DIGEST_UNAVAILABLE', errcode = 'P0001';
  end if;

  insert into public.crm_conversion_authority (
    conversion_authority_id, environment_fingerprint, center_id, actor_user_id,
    membership_id, membership_version, conversion_request_id, approved_request_version,
    consultation_case_id, case_version, source_contact_id, contact_version,
    assignment_id, assignment_version, conversion_intent_digest,
    legacy_request_action_graph_digest, p3_action_set_encoding_version, p3_action_set_digest,
    review_set_digest, reservation_set_digest, target_set_digest,
    step_up_assertion_id, step_up_assertion_version, account_security_version,
    account_session_version, assurance_policy_version, identity_policy_version,
    conversion_policy_version, relationship_policy_version, student_profile_policy_version,
    purpose, status, authority_version, issued_at, expires_at
  ) values (
    v_authority_id, p_environment_fingerprint, v_center_id, p_actor_user_id,
    v_membership.id, v_membership.membership_version, p_conversion_request_id, v_request.request_version,
    v_request.consultation_case_id, v_case.case_version, v_request.source_contact_id, v_contact.contact_version,
    v_request.source_assignment_id, v_assignment.assignment_version, v_request.intent_digest,
    v_request.action_graph_digest, 1, v_action_digest,
    v_review_digest, v_reservation_digest, v_target_digest,
    p_step_up_assertion_id, v_step.assertion_version, v_control.security_version,
    v_control.session_version, v_control.assurance_policy_version, v_request.identity_policy_version,
    v_request.conversion_policy_version, v_request.relationship_policy_version,
    v_request.student_profile_policy_version, 'crm.real_conversion.execute', 'ISSUED', 1,
    v_now, least(v_step.expires_at, v_now + interval '5 minutes')
  ) returning * into v_authority;

  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'security.conversion-step-up.consumed', p_actor_user_id,
    'account_step_up_assertion', p_step_up_assertion_id, p_conversion_request_id,
    v_request.source_assignment_id, p_expected_step_up_assertion_version,
    v_step.assertion_version, 'CONSUMED', 'authority_issued',
    'security.issue_conversion_authority', 'STEP_UP_ASSERTION_CONSUMED', v_correlation_id
  );
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'crm.conversion-request.approved', p_actor_user_id,
    'crm_conversion_request', p_conversion_request_id, p_conversion_request_id,
    v_request.source_assignment_id, p_expected_request_version,
    v_request.request_version, 'APPROVED', 'conversion_authority_issued',
    'security.issue_conversion_authority', 'CONVERSION_REQUEST_APPROVED', v_correlation_id
  );
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'security.conversion-authority.issued', p_actor_user_id,
    'crm_conversion_authority', v_authority.conversion_authority_id, p_conversion_request_id,
    v_request.source_assignment_id, null, 1, 'ISSUED', 'conversion_authority_issued',
    'security.issue_conversion_authority', 'CONVERSION_AUTHORITY_ISSUED', v_correlation_id
  );

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1, 'result_type', 'CONVERSION_AUTHORITY',
    'resource_id', v_authority.conversion_authority_id, 'resource_version', v_authority.authority_version,
    'resource_status', v_request.status, 'request_id', p_conversion_request_id,
    'request_version', v_request.request_version, 'issued_at', v_authority.issued_at,
    'expires_at', v_authority.expires_at, 'correlation_id', v_correlation_id,
    'outcome_code', 'CONVERSION_AUTHORITY_ISSUED'
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED', terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1, completed_at = v_now,
    p3_action_set_encoding_version = 1, p3_action_set_digest = v_action_digest,
    p3_result_kind = 'CONVERSION_AUTHORITY', p3_result_outcome_code = 'CONVERSION_AUTHORITY_ISSUED',
    p3_result_snapshot = v_snapshot, p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;

  return query select true, 'CONVERSION_AUTHORITY_ISSUED', false,
    v_authority.conversion_authority_id, v_authority.authority_version,
    v_request.status, v_request.request_version, v_authority.expires_at, v_correlation_id;
end;
$f23_3e_p3b_issue_conversion_authority$;

create function public.f23_3e_p3b_read_conversion_authority_status(
  p_actor_user_id uuid,
  p_conversion_authority_id uuid
)
returns table (
  outcome_code text,
  conversion_authority_id uuid,
  status text,
  authority_version integer,
  conversion_request_id uuid,
  approved_request_version integer,
  issued_at timestamptz,
  expires_at timestamptz,
  terminal_at timestamptz,
  terminal_reason_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $f23_3e_p3b_read_conversion_authority_status$
declare
  v_authority public.crm_conversion_authority%rowtype;
  v_member public.center_members%rowtype;
begin
  if p_actor_user_id is null or p_conversion_authority_id is null then
    return query select 'INVALID_INPUT', p_conversion_authority_id, null::text,
      null::integer, null::uuid, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz, null::text;
    return;
  end if;
  select a.* into v_authority from public.crm_conversion_authority a
  where a.conversion_authority_id = p_conversion_authority_id;
  if not found then
    return query select 'RESOURCE_NOT_AVAILABLE', p_conversion_authority_id, null::text,
      null::integer, null::uuid, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz, null::text;
    return;
  end if;
  select m.* into v_member from public.center_members m
  where m.center_id = v_authority.center_id and m.user_id = p_actor_user_id;
  if not found or v_member.status <> 'active' or v_member.role not in ('owner', 'center_admin') then
    return query select 'RESOURCE_NOT_AVAILABLE', p_conversion_authority_id, null::text,
      null::integer, null::uuid, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz, null::text;
    return;
  end if;
  return query select 'AUTHORITY_STATUS_READ', v_authority.conversion_authority_id,
    v_authority.status, v_authority.authority_version, v_authority.conversion_request_id,
    v_authority.approved_request_version, v_authority.issued_at, v_authority.expires_at,
    v_authority.terminal_at, v_authority.terminal_reason_code;
end;
$f23_3e_p3b_read_conversion_authority_status$;

create function public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  p_actor_user_id uuid,
  p_conversion_authority_id uuid,
  p_expected_authority_version integer,
  p_requested_transition text,
  p_safe_reason_code text,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  status text,
  authority_version integer,
  terminal_at timestamptz,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3b_revoke_or_expire_conversion_authority$
declare
  v_center_id text;
  v_environment_fingerprint bytea;
  v_root public.center_crm_control%rowtype;
  v_member public.center_members%rowtype;
  v_authority public.crm_conversion_authority%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_outcome text;
  v_snapshot jsonb;
  v_binding_digest bytea;
begin
  if p_actor_user_id is null or p_conversion_authority_id is null
     or p_expected_authority_version is null or p_expected_authority_version < 1
     or p_requested_transition not in ('REVOKED', 'EXPIRED')
     or p_safe_reason_code is null or p_safe_reason_code !~ '^[a-z][a-z0-9_.-]{0,79}$'
     or p_operation_intent_digest is null or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::text, null::integer,
      null::timestamptz, null::uuid;
    return;
  end if;
  -- Unlocked selector read: only immutable values required to establish the
  -- canonical lock and idempotency scope are read here, then rechecked later.
  select a.center_id, a.environment_fingerprint
  into v_center_id, v_environment_fingerprint
  from public.crm_conversion_authority a
  where a.conversion_authority_id = p_conversion_authority_id;
  if not found then
    return query select false, 'RESOURCE_NOT_FOUND', false, null::text, null::integer,
      null::timestamptz, null::uuid;
    return;
  end if;
  v_binding_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'domain', 'ichess.crm.p3b.authority-terminal.v1',
    'actor_user_id', p_actor_user_id,
    'conversion_authority_id', p_conversion_authority_id,
    'environment_fingerprint', pg_catalog.encode(v_environment_fingerprint, 'hex'),
    'expected_authority_version', p_expected_authority_version,
    'requested_transition', p_requested_transition,
    'safe_reason_code', p_safe_reason_code
  )::text, 'UTF8'), 'sha256');
  select r.* into v_root from public.center_crm_control r where r.center_id = v_center_id for update;
  select m.* into v_member from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id for update;
  if not found or v_member.status <> 'active' or v_member.role not in ('owner', 'center_admin') then
    return query select false, 'CAPABILITY_DENIED', false, null::text, null::integer,
      null::timestamptz, null::uuid;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f23.3e.p3b.authority|' || v_center_id || '|' || p_conversion_authority_id::text, 0)
  );
  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = v_environment_fingerprint
    and i.center_id = v_center_id and i.resource_scope_kind = 'conversion_authority'
    and i.resource_scope_id = p_conversion_authority_id
    and i.operation = 'security.revoke_or_expire_conversion_authority'
    and i.idempotency_key_digest = p_idempotency_key_digest for update;
  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_expected_resource_version is distinct from p_expected_authority_version
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, null::text, null::integer,
        null::timestamptz, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED' then
      return query select true, v_registry.p3_result_outcome_code, true,
        v_registry.p3_result_snapshot ->> 'resource_status',
        (v_registry.p3_result_snapshot ->> 'resource_version')::integer,
        (v_registry.p3_result_snapshot ->> 'terminal_at')::timestamptz,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, null::text,
      null::integer, null::timestamptz, null::uuid;
    return;
  end if;
  select a.* into v_authority from public.crm_conversion_authority a
  where a.conversion_authority_id = p_conversion_authority_id for update;
  if not found
     or v_authority.center_id is distinct from v_center_id
     or v_authority.environment_fingerprint is distinct from v_environment_fingerprint then
    return query select false, 'AUTHORITY_SCOPE_CHANGED', false, null::text,
      null::integer, null::timestamptz, null::uuid;
    return;
  end if;
  if v_authority.status <> 'ISSUED' then
    return query select false, 'AUTHORITY_NOT_ISSUED', false, v_authority.status,
      v_authority.authority_version, v_authority.terminal_at, null::uuid;
    return;
  end if;
  if v_authority.authority_version <> p_expected_authority_version then
    return query select false, 'AUTHORITY_VERSION_STALE', false, v_authority.status,
      v_authority.authority_version, v_authority.terminal_at, null::uuid;
    return;
  end if;
  if p_requested_transition = 'EXPIRED' and v_authority.expires_at > v_now then
    return query select false, 'AUTHORITY_NOT_YET_EXPIRED', false, v_authority.status,
      v_authority.authority_version, v_authority.terminal_at, null::uuid;
    return;
  end if;

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    request_id, expires_at, p3_actor_user_id, p3_expected_resource_version,
    p3_operation_binding_digest, p3_legacy_request_action_graph_digest,
    p3_action_set_encoding_version, p3_action_set_digest
  ) values (
    v_authority.environment_fingerprint,
    v_center_id, 'conversion_authority', p_conversion_authority_id,
    v_authority.consultation_case_id, 'security.revoke_or_expire_conversion_authority',
    p_idempotency_key_digest, p_operation_intent_digest, v_authority.conversion_request_id,
    p_idempotency_expires_at, p_actor_user_id, p_expected_authority_version,
    v_binding_digest, v_authority.legacy_request_action_graph_digest,
    v_authority.p3_action_set_encoding_version, v_authority.p3_action_set_digest
  ) returning * into v_registry;

  update public.crm_conversion_authority a set
    status = p_requested_transition, authority_version = a.authority_version + 1,
    terminal_at = v_now, terminal_reason_code = p_safe_reason_code, updated_at = v_now
  where a.conversion_authority_id = p_conversion_authority_id
  returning * into v_authority;
  v_outcome := case when p_requested_transition = 'REVOKED'
    then 'CONVERSION_AUTHORITY_REVOKED' else 'CONVERSION_AUTHORITY_EXPIRED' end;
  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, case when p_requested_transition = 'REVOKED'
      then 'security.conversion-authority.revoked' else 'security.conversion-authority.expired' end,
    p_actor_user_id, 'crm_conversion_authority', p_conversion_authority_id,
    v_authority.conversion_request_id, v_authority.assignment_id,
    p_expected_authority_version, v_authority.authority_version,
    v_authority.status, p_safe_reason_code,
    'security.revoke_or_expire_conversion_authority', v_outcome, v_correlation_id
  );
  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1, 'result_type', 'CONVERSION_AUTHORITY',
    'resource_id', p_conversion_authority_id, 'resource_version', v_authority.authority_version,
    'resource_status', v_authority.status, 'request_id', v_authority.conversion_request_id,
    'request_version', v_authority.approved_request_version, 'terminal_at', v_authority.terminal_at,
    'correlation_id', v_correlation_id, 'outcome_code', v_outcome
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED', terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1, completed_at = v_now,
    p3_result_kind = 'CONVERSION_AUTHORITY', p3_result_outcome_code = v_outcome,
    p3_result_snapshot = v_snapshot, p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;
  return query select true, v_outcome, false, v_authority.status,
    v_authority.authority_version, v_authority.terminal_at, v_correlation_id;
end;
$f23_3e_p3b_revoke_or_expire_conversion_authority$;

-- All internals are owner-only, including for service_role.  Exactly the six
-- protected external functions below are granted to service_role.
revoke execute on function public.f23_3e_p3b_internal_guard_center_members_version() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_is_safe_result_snapshot(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_guard_idempotency_snapshot() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_guard_account_security_control() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_guard_step_up_assertion() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_guard_conversion_action() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_guard_conversion_authority() from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_result_digest(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_action_set_digest(uuid,text) from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_binding_set_digest(uuid,text) from public, anon, authenticated, service_role;
revoke execute on function public.f23_3e_p3b_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid) from public, anon, authenticated, service_role;

revoke execute on function public.f23_3e_p3b_register_or_sync_account_security_control(uuid,uuid,text,bytea,integer,bytea,bytea,timestamptz) from public, anon, authenticated;
revoke execute on function public.f23_3e_p3b_record_verified_conversion_step_up(uuid,uuid,uuid,text,text,bytea,timestamptz,integer,bytea,bytea,timestamptz) from public, anon, authenticated;
revoke execute on function public.f23_3e_p3b_evaluate_conversion_capability(uuid,uuid,uuid,integer) from public, anon, authenticated;
revoke execute on function public.f23_3e_p3b_issue_conversion_authority(uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz) from public, anon, authenticated;
revoke execute on function public.f23_3e_p3b_read_conversion_authority_status(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.f23_3e_p3b_revoke_or_expire_conversion_authority(uuid,uuid,integer,text,text,bytea,bytea,timestamptz) from public, anon, authenticated;

grant execute on function public.f23_3e_p3b_register_or_sync_account_security_control(uuid,uuid,text,bytea,integer,bytea,bytea,timestamptz) to service_role;
grant execute on function public.f23_3e_p3b_record_verified_conversion_step_up(uuid,uuid,uuid,text,text,bytea,timestamptz,integer,bytea,bytea,timestamptz) to service_role;
grant execute on function public.f23_3e_p3b_evaluate_conversion_capability(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.f23_3e_p3b_issue_conversion_authority(uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz) to service_role;
grant execute on function public.f23_3e_p3b_read_conversion_authority_status(uuid,uuid) to service_role;
grant execute on function public.f23_3e_p3b_revoke_or_expire_conversion_authority(uuid,uuid,integer,text,text,bytea,bytea,timestamptz) to service_role;

comment on table public.account_security_control is
  'P3B protected verifier-projected account security root. Missing means deny; no Auth provider mutation occurs here.';
comment on table public.account_step_up_assertion is
  'P3B protected, purpose/resource/session-bound single-use step-up evidence with five-minute maximum lifetime.';
comment on table public.crm_conversion_action is
  'P3B physical typed action foundation. Production REVIEWED materialization remains P3C.';
comment on table public.crm_conversion_authority is
  'P3B single-use authority foundation. CONSUMED is reserved for the absent P3D executor.';

commit;
