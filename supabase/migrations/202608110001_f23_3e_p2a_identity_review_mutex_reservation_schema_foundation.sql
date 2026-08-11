-- F23.3E-P2A: physical identity policy, mutex, reviewed evidence, and
-- profile-creation reservation foundation. This migration creates no matching,
-- profile, relationship, approval, conversion executor, or browser runtime.

do $f23_3e_p2a_prerequisites$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case') is null
     or pg_catalog.to_regclass('public.consultation_case_candidate_student') is null
     or pg_catalog.to_regclass('public.crm_conversion_request') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regclass('auth.users') is null then
    raise exception 'f23_3e_p2a_missing_p1_prerequisite';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    raise exception 'f23_3e_p2a_missing_service_role';
  end if;

  if pg_catalog.to_regclass('public.crm_identity_policy_registry') is not null
     or pg_catalog.to_regclass('public.crm_identity_match_mutex') is not null
     or pg_catalog.to_regclass('public.crm_identity_match_review') is not null
     or pg_catalog.to_regclass('public.crm_profile_creation_reservation') is not null then
    raise exception 'f23_3e_p2a_resource_already_exists';
  end if;
end;
$f23_3e_p2a_prerequisites$;

create table public.crm_identity_policy_registry (
  identity_policy_registry_id uuid primary key default pg_catalog.gen_random_uuid(),
  environment_fingerprint bytea not null,
  center_id text not null,
  identity_kind text not null,
  center_identity_policy_version integer not null,
  normalization_algorithm text not null,
  normalization_version integer not null,
  digest_key_epoch integer not null,
  match_policy_version integer not null,
  minimum_evidence_policy_version integer not null,
  policy_registry_version integer not null default 1,
  status text not null default 'STAGED',
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  activated_at timestamptz,
  drain_started_at timestamptz,
  retired_at timestamptz,
  constraint crm_identity_policy_registry_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_identity_policy_registry_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_identity_policy_registry_center_policy_key
    unique (center_id, identity_kind, identity_policy_registry_id),
  constraint crm_identity_policy_registry_review_binding_key
    unique (
      center_id, identity_kind, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version
    ),
  constraint crm_identity_policy_registry_mutex_binding_key
    unique (
      environment_fingerprint, center_id, identity_kind,
      identity_policy_registry_id, normalization_version, digest_key_epoch
    ),
  constraint crm_identity_policy_registry_exact_version_tuple_key
    unique (
      environment_fingerprint, center_id, identity_kind,
      center_identity_policy_version, normalization_algorithm,
      normalization_version, digest_key_epoch, match_policy_version,
      minimum_evidence_policy_version
    ),
  constraint crm_identity_policy_registry_environment_check
    check (pg_catalog.octet_length(environment_fingerprint) = 32),
  constraint crm_identity_policy_registry_identity_kind_check
    check (identity_kind in ('GUARDIAN', 'STUDENT')),
  constraint crm_identity_policy_registry_algorithm_check
    check (
      pg_catalog.length(pg_catalog.btrim(normalization_algorithm)) between 1 and 120
      and normalization_algorithm ~ '^[a-z][a-z0-9_.-]{0,119}$'
    ),
  constraint crm_identity_policy_registry_versions_positive
    check (
      center_identity_policy_version >= 1
      and normalization_version >= 1
      and digest_key_epoch >= 1
      and match_policy_version >= 1
      and minimum_evidence_policy_version >= 1
      and policy_registry_version >= 1
    ),
  constraint crm_identity_policy_registry_status_check
    check (status in ('STAGED', 'CURRENT', 'DRAINING', 'RETIRED')),
  constraint crm_identity_policy_registry_state_timestamps_check
    check (
      (
        status = 'STAGED'
        and activated_at is null
        and drain_started_at is null
        and retired_at is null
      )
      or (
        status = 'CURRENT'
        and activated_at is not null
        and drain_started_at is null
        and retired_at is null
      )
      or (
        status = 'DRAINING'
        and activated_at is not null
        and drain_started_at is not null
        and retired_at is null
      )
      or (
        status = 'RETIRED'
        and activated_at is not null
        and drain_started_at is not null
        and retired_at is not null
      )
    ),
  constraint crm_identity_policy_registry_timestamp_order_check
    check (
      (activated_at is null or activated_at >= created_at)
      and (drain_started_at is null or drain_started_at >= activated_at)
      and (retired_at is null or retired_at >= drain_started_at)
    )
);

create unique index crm_identity_policy_registry_one_current_idx
  on public.crm_identity_policy_registry (center_id, identity_kind)
  where status = 'CURRENT';

create index crm_identity_policy_registry_lifecycle_idx
  on public.crm_identity_policy_registry (center_id, identity_kind, status, policy_registry_version);

create function public.f23_3e_p2a_internal_guard_identity_policy_registry()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2a_internal_guard_identity_policy_registry$
declare
  v_root_identity_policy_version integer;
begin
  select r.identity_policy_version
  into v_root_identity_policy_version
  from public.center_crm_control r
  where r.center_id = new.center_id;

  if not found
     or v_root_identity_policy_version <> new.center_identity_policy_version then
    raise exception 'f23_3e_p2a_center_identity_policy_version_stale';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'STAGED'
       or new.policy_registry_version <> 1
       or new.activated_at is not null
       or new.drain_started_at is not null
       or new.retired_at is not null then
      raise exception 'f23_3e_p2a_policy_must_start_staged_at_version_one';
    end if;
    new.created_at := pg_catalog.transaction_timestamp();
    return new;
  end if;

  if new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
     or new.environment_fingerprint is distinct from old.environment_fingerprint
     or new.center_id is distinct from old.center_id
     or new.identity_kind is distinct from old.identity_kind
     or new.center_identity_policy_version is distinct from old.center_identity_policy_version
     or new.normalization_algorithm is distinct from old.normalization_algorithm
     or new.normalization_version is distinct from old.normalization_version
     or new.digest_key_epoch is distinct from old.digest_key_epoch
     or new.match_policy_version is distinct from old.match_policy_version
     or new.minimum_evidence_policy_version is distinct from old.minimum_evidence_policy_version
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p2a_policy_binding_is_immutable';
  end if;

  if old.status = 'RETIRED' then
    raise exception 'f23_3e_p2a_retired_policy_is_immutable';
  end if;

  if new.policy_registry_version <> old.policy_registry_version + 1 then
    raise exception 'f23_3e_p2a_policy_version_must_increment_by_one';
  end if;

  if old.status = 'STAGED' and new.status = 'CURRENT' then
    new.activated_at := pg_catalog.transaction_timestamp();
    new.drain_started_at := null;
    new.retired_at := null;
  elsif old.status = 'CURRENT' and new.status = 'DRAINING' then
    new.activated_at := old.activated_at;
    new.drain_started_at := pg_catalog.transaction_timestamp();
    new.retired_at := null;
  elsif old.status = 'DRAINING' and new.status = 'RETIRED' then
    new.activated_at := old.activated_at;
    new.drain_started_at := old.drain_started_at;
    new.retired_at := pg_catalog.transaction_timestamp();
  else
    raise exception 'f23_3e_p2a_invalid_policy_transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$f23_3e_p2a_internal_guard_identity_policy_registry$;

create trigger f23_3e_p2a_identity_policy_registry_guard
before insert or update on public.crm_identity_policy_registry
for each row execute function public.f23_3e_p2a_internal_guard_identity_policy_registry();

create table public.crm_identity_match_mutex (
  identity_match_mutex_key bytea primary key,
  environment_fingerprint bytea not null,
  center_id text not null,
  identity_kind text not null,
  identity_policy_registry_id uuid not null,
  normalization_version integer not null,
  digest_key_epoch integer not null,
  mutex_version integer not null default 1,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  last_used_at timestamptz not null default pg_catalog.transaction_timestamp(),
  retired_at timestamptz,
  constraint crm_identity_match_mutex_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_identity_match_mutex_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_identity_match_mutex_policy_exact_binding_fkey
    foreign key (
      environment_fingerprint, center_id, identity_kind,
      identity_policy_registry_id, normalization_version, digest_key_epoch
    ) references public.crm_identity_policy_registry (
      environment_fingerprint, center_id, identity_kind,
      identity_policy_registry_id, normalization_version, digest_key_epoch
    ) on delete restrict,
  constraint crm_identity_match_mutex_center_key
    unique (center_id, identity_match_mutex_key),
  constraint crm_identity_match_mutex_key_size_check
    check (pg_catalog.octet_length(identity_match_mutex_key) = 32),
  constraint crm_identity_match_mutex_environment_check
    check (pg_catalog.octet_length(environment_fingerprint) = 32),
  constraint crm_identity_match_mutex_identity_kind_check
    check (identity_kind in ('GUARDIAN', 'STUDENT')),
  constraint crm_identity_match_mutex_versions_positive
    check (normalization_version >= 1 and digest_key_epoch >= 1 and mutex_version >= 1),
  constraint crm_identity_match_mutex_status_check
    check (status in ('ACTIVE', 'RETIRED')),
  constraint crm_identity_match_mutex_retired_state_check
    check ((status = 'RETIRED') = (retired_at is not null)),
  constraint crm_identity_match_mutex_timestamp_order_check
    check (
      last_used_at >= created_at
      and (retired_at is null or retired_at >= last_used_at)
    )
);

create index crm_identity_match_mutex_lock_order_idx
  on public.crm_identity_match_mutex (center_id, identity_kind, identity_match_mutex_key);

create index crm_identity_match_mutex_policy_idx
  on public.crm_identity_match_mutex (identity_policy_registry_id, status);

create function public.f23_3e_p2a_internal_guard_identity_match_mutex()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2a_internal_guard_identity_match_mutex$
declare
  v_policy_status text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'ACTIVE'
       or new.mutex_version <> 1
       or new.retired_at is not null then
      raise exception 'f23_3e_p2a_mutex_must_start_active_at_version_one';
    end if;

    select p.status into v_policy_status
    from public.crm_identity_policy_registry p
    where p.identity_policy_registry_id = new.identity_policy_registry_id
      and p.environment_fingerprint = new.environment_fingerprint
      and p.center_id = new.center_id
      and p.identity_kind = new.identity_kind
      and p.normalization_version = new.normalization_version
      and p.digest_key_epoch = new.digest_key_epoch;
    if not found or v_policy_status <> 'CURRENT' then
      raise exception 'f23_3e_p2a_mutex_policy_is_not_current';
    end if;

    new.created_at := pg_catalog.transaction_timestamp();
    new.last_used_at := new.created_at;
    return new;
  end if;

  if new.identity_match_mutex_key is distinct from old.identity_match_mutex_key
     or new.environment_fingerprint is distinct from old.environment_fingerprint
     or new.center_id is distinct from old.center_id
     or new.identity_kind is distinct from old.identity_kind
     or new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
     or new.normalization_version is distinct from old.normalization_version
     or new.digest_key_epoch is distinct from old.digest_key_epoch
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p2a_mutex_binding_is_immutable';
  end if;

  if old.status = 'RETIRED' then
    raise exception 'f23_3e_p2a_retired_mutex_is_immutable';
  end if;
  if new.mutex_version <> old.mutex_version + 1 then
    raise exception 'f23_3e_p2a_mutex_version_must_increment_by_one';
  end if;

  if old.status = 'ACTIVE' and new.status = 'ACTIVE' then
    new.last_used_at := pg_catalog.transaction_timestamp();
    new.retired_at := null;
  elsif old.status = 'ACTIVE' and new.status = 'RETIRED' then
    new.last_used_at := pg_catalog.transaction_timestamp();
    new.retired_at := new.last_used_at;
  else
    raise exception 'f23_3e_p2a_invalid_mutex_transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$f23_3e_p2a_internal_guard_identity_match_mutex$;

create trigger f23_3e_p2a_identity_match_mutex_guard
before insert or update on public.crm_identity_match_mutex
for each row execute function public.f23_3e_p2a_internal_guard_identity_match_mutex();

create table public.crm_identity_match_review (
  match_review_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  conversion_request_id uuid not null,
  request_version integer not null,
  action_id uuid not null,
  action_intent_digest bytea not null,
  request_action_graph_digest bytea not null,
  identity_kind text not null,
  crm_contact_id uuid not null,
  source_contact_version integer not null,
  consultation_case_id uuid not null,
  source_case_version integer not null,
  candidate_student_id uuid,
  source_candidate_version integer,
  target_adapter_namespace text,
  opaque_target_id uuid,
  target_version integer,
  identity_policy_registry_id uuid not null,
  normalization_version integer not null,
  match_policy_version integer not null,
  minimum_evidence_policy_version integer not null,
  match_outcome text not null,
  review_status text not null default 'PENDING',
  review_action text,
  evidence_set_digest bytea not null,
  identity_mutex_keys_digest bytea not null,
  projection_snapshot_digest bytea not null,
  safe_reason_code text not null,
  reviewer_user_id uuid,
  reviewer_authority_version integer,
  review_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  decided_at timestamptz,
  expires_at timestamptz not null,
  supersedes_review_id uuid,
  constraint crm_identity_match_review_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_identity_match_review_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_identity_match_review_request_exact_center_fkey
    foreign key (center_id, conversion_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_identity_match_review_contact_exact_center_fkey
    foreign key (center_id, crm_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_identity_match_review_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_identity_match_review_candidate_exact_case_fkey
    foreign key (center_id, consultation_case_id, candidate_student_id)
    references public.consultation_case_candidate_student(
      center_id, consultation_case_id, candidate_student_id
    ) on delete restrict,
  constraint crm_identity_match_review_policy_exact_binding_fkey
    foreign key (
      center_id, identity_kind, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version
    ) references public.crm_identity_policy_registry (
      center_id, identity_kind, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version
    ) on delete restrict,
  constraint crm_identity_match_review_reviewer_fkey
    foreign key (reviewer_user_id) references auth.users(id) on delete restrict,
  constraint crm_identity_match_review_center_review_key
    unique (center_id, match_review_id),
  constraint crm_identity_match_review_supersedes_exact_center_fkey
    foreign key (center_id, supersedes_review_id)
    references public.crm_identity_match_review(center_id, match_review_id) on delete restrict,
  constraint crm_identity_match_review_request_versions_positive
    check (
      request_version >= 1
      and source_contact_version >= 1
      and source_case_version >= 1
      and (source_candidate_version is null or source_candidate_version >= 1)
    ),
  constraint crm_identity_match_review_candidate_version_pair_check
    check ((candidate_student_id is null) = (source_candidate_version is null)),
  constraint crm_identity_match_review_identity_kind_check
    check (identity_kind in ('GUARDIAN', 'STUDENT')),
  constraint crm_identity_match_review_policy_versions_positive
    check (
      normalization_version >= 1
      and match_policy_version >= 1
      and minimum_evidence_policy_version >= 1
      and review_version >= 1
    ),
  constraint crm_identity_match_review_digest_sizes_check
    check (
      pg_catalog.octet_length(action_intent_digest) = 32
      and pg_catalog.octet_length(request_action_graph_digest) = 32
      and pg_catalog.octet_length(evidence_set_digest) = 32
      and pg_catalog.octet_length(identity_mutex_keys_digest) = 32
      and pg_catalog.octet_length(projection_snapshot_digest) = 32
    ),
  constraint crm_identity_match_review_target_binding_check
    check (
      (
        target_adapter_namespace is null
        and opaque_target_id is null
        and target_version is null
      )
      or (
        target_adapter_namespace is not null
        and target_adapter_namespace ~ '^[a-z][a-z0-9_.-]{0,119}$'
        and opaque_target_id is not null
        and target_version is not null
        and target_version >= 1
      )
    ),
  constraint crm_identity_match_review_match_outcome_check
    check (match_outcome in (
      'NO_MATCH', 'POSSIBLE_MATCH', 'PROBABLE_MATCH',
      'EXACT_REVIEWED_MATCH', 'CONFLICT', 'INSUFFICIENT_EVIDENCE'
    )),
  constraint crm_identity_match_review_status_check
    check (review_status in (
      'PENDING', 'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED',
      'REJECTED_MATCH', 'CONFLICT', 'EXPIRED', 'SUPERSEDED'
    )),
  constraint crm_identity_match_review_action_check
    check (
      review_action is null
      or review_action in (
        'REUSE_EXISTING', 'PREPARE_CREATE_NEW',
        'REJECT_IDENTITY_ACTION', 'ESCALATE_IDENTITY_CONFLICT'
      )
    ),
  constraint crm_identity_match_review_safe_reason_code_check
    check (safe_reason_code in (
      'NAME_AND_BIRTH_EXACT_CANDIDATE',
      'NAME_SIMILAR_CANDIDATE',
      'BIRTH_EVIDENCE_MATCH',
      'CONTACT_EVIDENCE_MATCH',
      'MULTIPLE_CANDIDATES',
      'CONTRADICTORY_EVIDENCE',
      'INSUFFICIENT_EVIDENCE'
    )),
  constraint crm_identity_match_review_semantic_mapping_check
    check (
      (
        review_status = 'PENDING'
        and review_action is null
        and decided_at is null
        and reviewer_user_id is null
        and reviewer_authority_version is null
      )
      or (
        review_status = 'EXACT_REVIEWED_MATCH'
        and match_outcome = 'EXACT_REVIEWED_MATCH'
        and review_action = 'REUSE_EXISTING'
        and opaque_target_id is not null
        and decided_at is not null
        and reviewer_user_id is not null
        and reviewer_authority_version is not null
        and reviewer_authority_version >= 1
      )
      or (
        review_status = 'CREATE_NEW_REVIEWED'
        and match_outcome = 'NO_MATCH'
        and review_action = 'PREPARE_CREATE_NEW'
        and opaque_target_id is null
        and decided_at is not null
        and reviewer_user_id is not null
        and reviewer_authority_version is not null
        and reviewer_authority_version >= 1
      )
      or (
        review_status = 'REJECTED_MATCH'
        and review_action = 'REJECT_IDENTITY_ACTION'
        and decided_at is not null
        and reviewer_user_id is not null
        and reviewer_authority_version is not null
        and reviewer_authority_version >= 1
      )
      or (
        review_status = 'CONFLICT'
        and match_outcome = 'CONFLICT'
        and review_action = 'ESCALATE_IDENTITY_CONFLICT'
        and decided_at is not null
        and reviewer_user_id is not null
        and reviewer_authority_version is not null
        and reviewer_authority_version >= 1
      )
      or (
        review_status in ('EXPIRED', 'SUPERSEDED')
        and review_action is null
        and decided_at is not null
        and reviewer_user_id is null
        and reviewer_authority_version is null
      )
    ),
  constraint crm_identity_match_review_expiry_check
    check (expires_at > created_at),
  constraint crm_identity_match_review_decision_time_check
    check (decided_at is null or decided_at >= created_at),
  constraint crm_identity_match_review_no_self_supersession_check
    check (supersedes_review_id is null or supersedes_review_id <> match_review_id)
);

create unique index crm_identity_match_review_one_pending_intent_idx
  on public.crm_identity_match_review (
    center_id, conversion_request_id, action_id, identity_kind, action_intent_digest
  ) where review_status = 'PENDING';

create index crm_identity_match_review_request_action_idx
  on public.crm_identity_match_review (
    center_id, conversion_request_id, action_id, review_status, review_version
  );

create index crm_identity_match_review_expiry_idx
  on public.crm_identity_match_review (center_id, expires_at)
  where review_status = 'PENDING';

create function public.f23_3e_p2a_internal_guard_identity_match_review()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2a_internal_guard_identity_match_review$
declare
  v_request public.crm_conversion_request%rowtype;
  v_policy_status text;
  v_prior public.crm_identity_match_review%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.review_status <> 'PENDING'
       or new.review_version <> 1
       or new.review_action is not null
       or new.reviewer_user_id is not null
       or new.reviewer_authority_version is not null
       or new.decided_at is not null then
      raise exception 'f23_3e_p2a_review_must_start_pending_at_version_one';
    end if;
    new.created_at := pg_catalog.transaction_timestamp();
    if new.expires_at <= new.created_at then
      raise exception 'f23_3e_p2a_review_expiry_must_be_future_server_time';
    end if;

    if new.supersedes_review_id is not null then
      select r.* into v_prior
      from public.crm_identity_match_review r
      where r.center_id = new.center_id
        and r.match_review_id = new.supersedes_review_id;
      if not found
         or v_prior.review_status = 'PENDING'
         or v_prior.conversion_request_id <> new.conversion_request_id
         or v_prior.action_id <> new.action_id
         or v_prior.identity_kind <> new.identity_kind then
        raise exception 'f23_3e_p2a_invalid_review_supersession_binding';
      end if;
    end if;
  else
    if new.match_review_id is distinct from old.match_review_id
       or new.center_id is distinct from old.center_id
       or new.conversion_request_id is distinct from old.conversion_request_id
       or new.request_version is distinct from old.request_version
       or new.action_id is distinct from old.action_id
       or new.action_intent_digest is distinct from old.action_intent_digest
       or new.request_action_graph_digest is distinct from old.request_action_graph_digest
       or new.identity_kind is distinct from old.identity_kind
       or new.crm_contact_id is distinct from old.crm_contact_id
       or new.source_contact_version is distinct from old.source_contact_version
       or new.consultation_case_id is distinct from old.consultation_case_id
       or new.source_case_version is distinct from old.source_case_version
       or new.candidate_student_id is distinct from old.candidate_student_id
       or new.source_candidate_version is distinct from old.source_candidate_version
       or new.target_adapter_namespace is distinct from old.target_adapter_namespace
       or new.opaque_target_id is distinct from old.opaque_target_id
       or new.target_version is distinct from old.target_version
       or new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
       or new.normalization_version is distinct from old.normalization_version
       or new.match_policy_version is distinct from old.match_policy_version
       or new.minimum_evidence_policy_version is distinct from old.minimum_evidence_policy_version
       or new.evidence_set_digest is distinct from old.evidence_set_digest
       or new.identity_mutex_keys_digest is distinct from old.identity_mutex_keys_digest
       or new.projection_snapshot_digest is distinct from old.projection_snapshot_digest
       or new.safe_reason_code is distinct from old.safe_reason_code
       or new.created_at is distinct from old.created_at
       or new.expires_at is distinct from old.expires_at
       or new.supersedes_review_id is distinct from old.supersedes_review_id then
      raise exception 'f23_3e_p2a_review_binding_is_immutable';
    end if;

    if old.review_status <> 'PENDING' then
      raise exception 'f23_3e_p2a_terminal_review_is_immutable';
    end if;
    if new.review_status = 'PENDING' then
      raise exception 'f23_3e_p2a_review_transition_must_terminalize';
    end if;
    if new.review_version <> old.review_version + 1 then
      raise exception 'f23_3e_p2a_review_version_must_increment_by_one';
    end if;
    if pg_catalog.transaction_timestamp() >= old.expires_at
       and new.review_status <> 'EXPIRED' then
      raise exception 'f23_3e_p2a_expired_review_cannot_be_decided_or_reused';
    end if;
    if new.review_status = 'EXPIRED'
       and pg_catalog.transaction_timestamp() < old.expires_at then
      raise exception 'f23_3e_p2a_review_cannot_expire_before_server_time';
    end if;
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
    new.decided_at := pg_catalog.transaction_timestamp();
  end if;

  if tg_op = 'INSERT'
     or new.review_status in (
       'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED',
       'REJECTED_MATCH', 'CONFLICT'
     ) then
    select r.* into v_request
    from public.crm_conversion_request r
    where r.center_id = new.center_id
      and r.conversion_request_id = new.conversion_request_id;
    if not found
       or v_request.request_version <> new.request_version
       or v_request.action_graph_digest is distinct from new.request_action_graph_digest
       or v_request.consultation_case_id <> new.consultation_case_id
       or v_request.source_contact_id <> new.crm_contact_id then
      raise exception 'f23_3e_p2a_review_request_action_source_binding_stale';
    end if;

    select p.status into v_policy_status
    from public.crm_identity_policy_registry p
    where p.center_id = new.center_id
      and p.identity_kind = new.identity_kind
      and p.identity_policy_registry_id = new.identity_policy_registry_id
      and p.normalization_version = new.normalization_version
      and p.match_policy_version = new.match_policy_version
      and p.minimum_evidence_policy_version = new.minimum_evidence_policy_version;
    if not found or v_policy_status <> 'CURRENT' then
      raise exception 'f23_3e_p2a_review_policy_is_not_current';
    end if;
  end if;

  return new;
end;
$f23_3e_p2a_internal_guard_identity_match_review$;

create trigger f23_3e_p2a_identity_match_review_guard
before insert or update on public.crm_identity_match_review
for each row execute function public.f23_3e_p2a_internal_guard_identity_match_review();

create table public.crm_profile_creation_reservation (
  reservation_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  entity_kind text not null,
  conversion_request_id uuid not null,
  request_version integer not null,
  action_id uuid not null,
  action_intent_digest bytea not null,
  request_action_graph_digest bytea not null,
  match_review_id uuid not null,
  preallocated_target_id uuid not null,
  target_adapter_namespace text not null,
  identity_mutex_keys_digest bytea not null,
  identity_policy_registry_id uuid not null,
  normalization_version integer not null,
  match_policy_version integer not null,
  minimum_evidence_policy_version integer not null,
  source_evidence_digest bytea not null,
  source_versions_digest bytea not null,
  projection_snapshot_digest bytea not null,
  status text not null default 'ACTIVE',
  reservation_version integer not null default 1,
  expires_at timestamptz not null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  terminal_at timestamptz,
  terminal_reason_code text,
  supersedes_reservation_id uuid,
  constraint crm_profile_creation_reservation_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_profile_creation_reservation_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_profile_creation_reservation_request_exact_center_fkey
    foreign key (center_id, conversion_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_profile_creation_reservation_review_exact_center_fkey
    foreign key (center_id, match_review_id)
    references public.crm_identity_match_review(center_id, match_review_id) on delete restrict,
  constraint crm_profile_creation_reservation_policy_exact_binding_fkey
    foreign key (
      center_id, entity_kind, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version
    ) references public.crm_identity_policy_registry (
      center_id, identity_kind, identity_policy_registry_id,
      normalization_version, match_policy_version, minimum_evidence_policy_version
    ) on delete restrict,
  constraint crm_profile_creation_reservation_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_profile_creation_reservation_center_key
    unique (center_id, reservation_id),
  constraint crm_profile_creation_reservation_supersedes_exact_center_fkey
    foreign key (center_id, supersedes_reservation_id)
    references public.crm_profile_creation_reservation(center_id, reservation_id) on delete restrict,
  constraint crm_profile_creation_reservation_entity_kind_check
    check (entity_kind in ('GUARDIAN', 'STUDENT')),
  constraint crm_profile_creation_reservation_versions_positive
    check (
      request_version >= 1
      and normalization_version >= 1
      and match_policy_version >= 1
      and minimum_evidence_policy_version >= 1
      and reservation_version >= 1
    ),
  constraint crm_profile_creation_reservation_digest_sizes_check
    check (
      pg_catalog.octet_length(action_intent_digest) = 32
      and pg_catalog.octet_length(request_action_graph_digest) = 32
      and pg_catalog.octet_length(identity_mutex_keys_digest) = 32
      and pg_catalog.octet_length(source_evidence_digest) = 32
      and pg_catalog.octet_length(source_versions_digest) = 32
      and pg_catalog.octet_length(projection_snapshot_digest) = 32
    ),
  constraint crm_profile_creation_reservation_adapter_namespace_check
    check (target_adapter_namespace ~ '^[a-z][a-z0-9_.-]{0,119}$'),
  constraint crm_profile_creation_reservation_status_check
    check (status in ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED')),
  constraint crm_profile_creation_reservation_terminal_mapping_check
    check (
      (
        status = 'ACTIVE'
        and terminal_at is null
        and terminal_reason_code is null
      )
      or (
        status = 'CONSUMED'
        and terminal_at is not null
        and terminal_reason_code = 'CONSUMED_BY_FUTURE_EXECUTOR'
      )
      or (
        status = 'EXPIRED'
        and terminal_at is not null
        and terminal_reason_code = 'SERVER_TIME_EXPIRED'
      )
      or (
        status = 'CANCELLED'
        and terminal_at is not null
        and terminal_reason_code = 'REQUEST_CANCELLED'
      )
      or (
        status = 'SUPERSEDED'
        and terminal_at is not null
        and terminal_reason_code = 'SOURCE_OR_POLICY_SUPERSEDED'
      )
    ),
  constraint crm_profile_creation_reservation_expiry_check
    check (expires_at > created_at),
  constraint crm_profile_creation_reservation_timestamp_order_check
    check (
      updated_at >= created_at
      and (terminal_at is null or terminal_at >= created_at)
    ),
  constraint crm_profile_creation_reservation_no_self_supersession_check
    check (supersedes_reservation_id is null or supersedes_reservation_id <> reservation_id)
);

create unique index crm_profile_creation_reservation_one_active_intent_idx
  on public.crm_profile_creation_reservation (
    center_id, entity_kind, conversion_request_id, action_id, action_intent_digest
  ) where status = 'ACTIVE';

create unique index crm_profile_creation_reservation_target_never_rebound_idx
  on public.crm_profile_creation_reservation (
    center_id, entity_kind, target_adapter_namespace, preallocated_target_id
  );

create index crm_profile_creation_reservation_request_action_idx
  on public.crm_profile_creation_reservation (
    center_id, conversion_request_id, action_id, status, reservation_version
  );

create index crm_profile_creation_reservation_expiry_idx
  on public.crm_profile_creation_reservation (center_id, expires_at)
  where status = 'ACTIVE';

create function public.f23_3e_p2a_internal_guard_profile_creation_reservation()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p2a_internal_guard_profile_creation_reservation$
declare
  v_review public.crm_identity_match_review%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_policy_status text;
  v_prior public.crm_profile_creation_reservation%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'ACTIVE'
       or new.reservation_version <> 1
       or new.terminal_at is not null
       or new.terminal_reason_code is not null then
      raise exception 'f23_3e_p2a_reservation_must_start_active_at_version_one';
    end if;
    new.created_at := pg_catalog.transaction_timestamp();
    new.updated_at := new.created_at;
    if new.expires_at <= new.created_at then
      raise exception 'f23_3e_p2a_reservation_expiry_must_be_future_server_time';
    end if;

    if new.supersedes_reservation_id is not null then
      select r.* into v_prior
      from public.crm_profile_creation_reservation r
      where r.center_id = new.center_id
        and r.reservation_id = new.supersedes_reservation_id;
      if not found
         or v_prior.status = 'ACTIVE'
         or v_prior.entity_kind <> new.entity_kind
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
    if old.status <> 'ACTIVE' then
      raise exception 'f23_3e_p2a_terminal_reservation_is_immutable';
    end if;
    if new.status not in ('CONSUMED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED') then
      raise exception 'f23_3e_p2a_invalid_reservation_transition: % -> %', old.status, new.status;
    end if;
    if new.reservation_version <> old.reservation_version + 1 then
      raise exception 'f23_3e_p2a_reservation_version_must_increment_by_one';
    end if;
    if pg_catalog.transaction_timestamp() >= old.expires_at
       and new.status <> 'EXPIRED' then
      raise exception 'f23_3e_p2a_expired_reservation_cannot_be_consumed_or_reused';
    end if;
    if new.status = 'EXPIRED'
       and pg_catalog.transaction_timestamp() < old.expires_at then
      raise exception 'f23_3e_p2a_reservation_cannot_expire_before_server_time';
    end if;

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

  select r.* into v_review
  from public.crm_identity_match_review r
  where r.center_id = new.center_id
    and r.match_review_id = new.match_review_id;
  if not found
     or v_review.review_status <> 'CREATE_NEW_REVIEWED'
     or v_review.match_outcome <> 'NO_MATCH'
     or v_review.review_action <> 'PREPARE_CREATE_NEW'
     or v_review.conversion_request_id <> new.conversion_request_id
     or v_review.request_version <> new.request_version
     or v_review.action_id <> new.action_id
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
    select r.* into v_request
    from public.crm_conversion_request r
    where r.center_id = new.center_id
      and r.conversion_request_id = new.conversion_request_id;
    if not found
       or v_request.request_version <> new.request_version
       or v_request.action_graph_digest is distinct from new.request_action_graph_digest then
      raise exception 'f23_3e_p2a_reservation_request_action_binding_stale';
    end if;

    select p.status into v_policy_status
    from public.crm_identity_policy_registry p
    where p.center_id = new.center_id
      and p.identity_kind = new.entity_kind
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

create trigger f23_3e_p2a_profile_creation_reservation_guard
before insert or update on public.crm_profile_creation_reservation
for each row execute function public.f23_3e_p2a_internal_guard_profile_creation_reservation();

alter table public.crm_identity_policy_registry enable row level security;
alter table public.crm_identity_policy_registry force row level security;
alter table public.crm_identity_match_mutex enable row level security;
alter table public.crm_identity_match_mutex force row level security;
alter table public.crm_identity_match_review enable row level security;
alter table public.crm_identity_match_review force row level security;
alter table public.crm_profile_creation_reservation enable row level security;
alter table public.crm_profile_creation_reservation force row level security;

revoke all privileges on table
  public.crm_identity_policy_registry,
  public.crm_identity_match_mutex,
  public.crm_identity_match_review,
  public.crm_profile_creation_reservation
from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p2a_internal_guard_identity_policy_registry()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2a_internal_guard_identity_match_mutex()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2a_internal_guard_identity_match_review()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p2a_internal_guard_profile_creation_reservation()
  from public, anon, authenticated, service_role;

comment on table public.crm_identity_policy_registry is
  'P2A versioned identity policy metadata only; it composes with center_crm_control and executes no normalization.';
comment on table public.crm_identity_match_mutex is
  'P2A opaque fixed-size serialization resource; unique constraints are integrity backstops, not the runtime mutex protocol.';
comment on table public.crm_identity_match_review is
  'P2A immutable reviewed-evidence foundation using the existing Request action-graph snapshot; no profile authority.';
comment on table public.crm_profile_creation_reservation is
  'P2A non-rebindable preallocated-target intent reservation; it creates no profile and grants no conversion authority.';
