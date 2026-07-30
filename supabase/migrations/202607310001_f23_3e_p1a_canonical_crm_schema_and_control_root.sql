-- F23.3E-P1A: canonical CRM physical foundation and exactly-one center control root.
-- This migration creates schema only. It does not enable CRM runtime, conversion,
-- Guardian/Student/Relationship records, Auth changes, imports, or remote delivery.

begin;

set local check_function_bodies = true;

-- Fail loudly when the canonical targets audited from the applied baseline drift.
do $f23_3e_p1a_prerequisites$
begin
  if pg_catalog.to_regclass('public.centers') is null then
    raise exception 'f23_3e_p1a_missing_prerequisite: public.centers';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.centers'::regclass
      and a.attname = 'id'
      and a.atttypid = 'text'::regtype
      and a.attnotnull
      and not a.attisdropped
  ) then
    raise exception 'f23_3e_p1a_prerequisite_drift: public.centers.id must be NOT NULL text';
  end if;

  if pg_catalog.to_regclass('auth.users') is null then
    raise exception 'f23_3e_p1a_missing_prerequisite: auth.users';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'auth.users'::regclass
      and a.attname = 'id'
      and a.atttypid = 'uuid'::regtype
      and a.attnotnull
      and not a.attisdropped
  ) then
    raise exception 'f23_3e_p1a_prerequisite_drift: auth.users.id must be NOT NULL uuid';
  end if;
end;
$f23_3e_p1a_prerequisites$;

-- Prevent a center insert from racing between trigger installation and backfill.
lock table public.centers in share row exclusive mode;

create table public.center_crm_control (
  center_id text primary key,
  crm_schema_version integer not null default 1,
  identity_policy_version integer not null default 1,
  conversion_policy_version integer not null default 1,
  relationship_policy_version integer not null default 1,
  student_profile_policy_version integer not null default 1,
  crm_state text not null default 'PLANNED',
  feature_flag_state text not null default 'DISABLED',
  control_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint center_crm_control_center_fkey
    foreign key (center_id) references public.centers(id) on delete cascade,
  constraint center_crm_control_schema_version_positive
    check (crm_schema_version >= 1),
  constraint center_crm_control_identity_policy_version_positive
    check (identity_policy_version >= 1),
  constraint center_crm_control_conversion_policy_version_positive
    check (conversion_policy_version >= 1),
  constraint center_crm_control_relationship_policy_version_positive
    check (relationship_policy_version >= 1),
  constraint center_crm_control_student_profile_policy_version_positive
    check (student_profile_policy_version >= 1),
  constraint center_crm_control_control_version_positive
    check (control_version >= 1),
  constraint center_crm_control_crm_state_check
    check (crm_state in ('PLANNED', 'MIGRATING', 'READ_ONLY', 'ACTIVE', 'SUSPENDED')),
  constraint center_crm_control_feature_flag_state_check
    check (feature_flag_state in ('DISABLED', 'READ_ONLY', 'ENABLED')),
  constraint center_crm_control_active_flag_check
    check (crm_state <> 'ACTIVE' or feature_flag_state = 'ENABLED'),
  constraint center_crm_control_timestamp_order_check
    check (updated_at >= created_at)
);

comment on table public.center_crm_control is
  'F23.3E-P1A exactly-one per-center CRM mutation root; existence does not activate runtime or conversion.';

create function public.f23_3e_p1a_provision_center_crm_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1a_provision_center_crm_control$
begin
  insert into public.center_crm_control (center_id)
  values (new.id);
  return new;
end;
$f23_3e_p1a_provision_center_crm_control$;

comment on function public.f23_3e_p1a_provision_center_crm_control() is
  'Protected deterministic trigger provisioning one disabled PLANNED CRM root for each future center.';

revoke all on function public.f23_3e_p1a_provision_center_crm_control()
  from public, anon, authenticated;

create trigger f23_3e_p1a_provision_center_crm_control
after insert on public.centers
for each row
execute function public.f23_3e_p1a_provision_center_crm_control();

-- The table is new and locked provisioning makes this exactly one row per center.
insert into public.center_crm_control (center_id)
select c.id
from public.centers c
order by c.id;

do $f23_3e_p1a_verify_root_backfill$
begin
  if exists (
    select 1
    from public.centers c
    left join public.center_crm_control r on r.center_id = c.id
    group by c.id
    having count(r.center_id) <> 1
  ) then
    raise exception 'f23_3e_p1a_center_root_backfill_failed';
  end if;
end;
$f23_3e_p1a_verify_root_backfill$;

create table public.crm_contact (
  crm_contact_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  display_name text,
  contact_status text not null default 'NEW',
  source_category text not null,
  initial_interest text,
  safe_location_area text,
  protected_contact_methods_ciphertext bytea not null,
  contact_methods_crypto_version integer not null,
  normalized_lookup_digests bytea[] not null,
  normalization_version integer not null,
  contact_version integer not null default 1,
  legacy_source_kind text,
  legacy_source_id text,
  legacy_source_center_id text,
  import_batch_id uuid,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  archived_at timestamptz,
  constraint crm_contact_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_contact_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_contact_created_by_user_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_contact_center_contact_key unique (center_id, crm_contact_id),
  constraint crm_contact_display_name_check
    check (display_name is null or pg_catalog.length(pg_catalog.btrim(display_name)) between 1 and 240),
  constraint crm_contact_source_category_check
    check (pg_catalog.length(pg_catalog.btrim(source_category)) between 1 and 120),
  constraint crm_contact_status_check
    check (contact_status in ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'ARCHIVED')),
  constraint crm_contact_ciphertext_check
    check (pg_catalog.octet_length(protected_contact_methods_ciphertext) > 0),
  constraint crm_contact_crypto_version_positive
    check (contact_methods_crypto_version >= 1),
  constraint crm_contact_lookup_digests_check
    check (
      pg_catalog.cardinality(normalized_lookup_digests) >= 1
      and pg_catalog.array_position(normalized_lookup_digests, null) is null
    ),
  constraint crm_contact_normalization_version_positive
    check (normalization_version >= 1),
  constraint crm_contact_version_positive
    check (contact_version >= 1),
  constraint crm_contact_legacy_provenance_check
    check (
      (
        legacy_source_kind is null
        and legacy_source_id is null
        and legacy_source_center_id is null
        and import_batch_id is null
      )
      or (
        legacy_source_kind is not null
        and legacy_source_id is not null
        and legacy_source_center_id is not null
        and import_batch_id is not null
        and pg_catalog.length(pg_catalog.btrim(legacy_source_kind)) > 0
        and pg_catalog.length(pg_catalog.btrim(legacy_source_id)) > 0
        and legacy_source_center_id = center_id
      )
    ),
  constraint crm_contact_archive_timestamp_check
    check ((contact_status = 'ARCHIVED') = (archived_at is not null)),
  constraint crm_contact_timestamp_order_check
    check (updated_at >= created_at and (archived_at is null or archived_at >= created_at))
);

create unique index crm_contact_legacy_source_unique_idx
  on public.crm_contact (center_id, legacy_source_kind, legacy_source_id)
  where legacy_source_kind is not null and legacy_source_id is not null;

create index crm_contact_center_status_idx
  on public.crm_contact (center_id, contact_status);

comment on table public.crm_contact is
  'F23.3E-P1A canonical center-scoped Contact; protected contact methods are ciphertext and lookup values are binary digests.';

create table public.consultation_case (
  consultation_case_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  primary_contact_id uuid not null,
  status text not null default 'OPEN',
  interest_summary text,
  safe_case_summary text,
  case_version integer not null default 1,
  active_assignment_id uuid,
  conversion_state text not null default 'NOT_STARTED',
  opened_at timestamptz not null default pg_catalog.transaction_timestamp(),
  closed_at timestamptz,
  archived_at timestamptz,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint consultation_case_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint consultation_case_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint consultation_case_primary_contact_exact_center_fkey
    foreign key (center_id, primary_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint consultation_case_created_by_user_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint consultation_case_center_case_key
    unique (center_id, consultation_case_id),
  constraint consultation_case_center_case_contact_key
    unique (center_id, consultation_case_id, primary_contact_id),
  constraint consultation_case_status_check
    check (status in (
      'OPEN', 'CONSULTING', 'PAUSED', 'READY_FOR_CONVERSION',
      'CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED'
    )),
  constraint consultation_case_conversion_state_check
    check (conversion_state in ('NOT_STARTED', 'DRAFT', 'REVIEW_PENDING', 'COMPLETED', 'CONFLICT')),
  constraint consultation_case_converted_projection_check
    check ((status = 'CONVERTED') = (conversion_state = 'COMPLETED')),
  constraint consultation_case_version_positive
    check (case_version >= 1),
  constraint consultation_case_closed_timestamp_check
    check (
      (status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED')) = (closed_at is not null)
    ),
  constraint consultation_case_archived_timestamp_check
    check ((status = 'ARCHIVED') = (archived_at is not null)),
  constraint consultation_case_timestamp_order_check
    check (
      updated_at >= created_at
      and opened_at >= created_at
      and (closed_at is null or closed_at >= opened_at)
      and (archived_at is null or archived_at >= opened_at)
    )
);

create index consultation_case_center_contact_idx
  on public.consultation_case (center_id, primary_contact_id);

create index consultation_case_center_status_idx
  on public.consultation_case (center_id, status);

comment on table public.consultation_case is
  'F23.3E-P1A consultation workflow root; it is not a person and CONVERTED remains reserved for a later protected executor.';

create table public.consultation_case_candidate_student (
  candidate_student_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  consultation_case_id uuid not null,
  display_name_evidence text,
  birth_evidence_protected bytea,
  learning_need_summary text,
  preferred_schedule_summary text,
  candidate_status text not null default 'DRAFT',
  candidate_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint consultation_case_candidate_student_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint consultation_case_candidate_student_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint consultation_case_candidate_student_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint consultation_case_candidate_student_center_case_candidate_key
    unique (center_id, consultation_case_id, candidate_student_id),
  constraint consultation_case_candidate_student_status_check
    check (candidate_status in ('DRAFT', 'ACTIVE', 'REVIEW_REQUIRED', 'CONVERTED', 'DISCARDED')),
  constraint consultation_case_candidate_student_version_positive
    check (candidate_version >= 1),
  constraint consultation_case_candidate_student_name_evidence_check
    check (
      display_name_evidence is null
      or pg_catalog.length(pg_catalog.btrim(display_name_evidence)) between 1 and 240
    ),
  constraint consultation_case_candidate_student_birth_evidence_check
    check (birth_evidence_protected is null or pg_catalog.octet_length(birth_evidence_protected) > 0),
  constraint consultation_case_candidate_student_minimum_evidence_check
    check (display_name_evidence is not null or birth_evidence_protected is not null),
  constraint consultation_case_candidate_student_timestamp_order_check
    check (updated_at >= created_at)
);

create index consultation_case_candidate_student_case_idx
  on public.consultation_case_candidate_student (center_id, consultation_case_id, candidate_status);

comment on table public.consultation_case_candidate_student is
  'F23.3E-P1A protected candidate evidence only; this row is not a canonical Student.';

create table public.consultation_case_assignment (
  assignment_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  consultation_case_id uuid not null,
  assigned_consultant_user_id uuid not null,
  assignment_status text not null default 'ACTIVE',
  assignment_version integer not null default 1,
  assigned_by_user_id uuid not null,
  assigned_at timestamptz not null default pg_catalog.transaction_timestamp(),
  ended_at timestamptz,
  end_reason text,
  constraint consultation_case_assignment_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint consultation_case_assignment_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint consultation_case_assignment_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint consultation_case_assignment_consultant_user_fkey
    foreign key (assigned_consultant_user_id) references auth.users(id) on delete restrict,
  constraint consultation_case_assignment_assigned_by_user_fkey
    foreign key (assigned_by_user_id) references auth.users(id) on delete restrict,
  constraint consultation_case_assignment_center_case_assignment_key
    unique (center_id, consultation_case_id, assignment_id),
  constraint consultation_case_assignment_center_assignment_key
    unique (center_id, assignment_id),
  constraint consultation_case_assignment_status_check
    check (assignment_status in ('ACTIVE', 'ENDED', 'REVOKED', 'SUPERSEDED')),
  constraint consultation_case_assignment_version_positive
    check (assignment_version >= 1),
  constraint consultation_case_assignment_terminal_metadata_check
    check (
      (
        assignment_status = 'ACTIVE'
        and ended_at is null
        and end_reason is null
      )
      or (
        assignment_status in ('ENDED', 'REVOKED', 'SUPERSEDED')
        and ended_at is not null
        and end_reason is not null
        and pg_catalog.length(pg_catalog.btrim(end_reason)) between 1 and 160
      )
    ),
  constraint consultation_case_assignment_timestamp_order_check
    check (ended_at is null or ended_at >= assigned_at)
);

create unique index consultation_case_assignment_one_active_idx
  on public.consultation_case_assignment (center_id, consultation_case_id)
  where assignment_status = 'ACTIVE';

create index consultation_case_assignment_consultant_idx
  on public.consultation_case_assignment (center_id, assigned_consultant_user_id, assignment_status);

alter table public.consultation_case
  add constraint consultation_case_active_assignment_exact_case_fkey
  foreign key (center_id, consultation_case_id, active_assignment_id)
  references public.consultation_case_assignment(center_id, consultation_case_id, assignment_id)
  on delete restrict
  deferrable initially deferred;

comment on table public.consultation_case_assignment is
  'F23.3E-P1A immutable assignment history with one active case assignee; assignment never grants global Contact authority.';

create table public.crm_care_log (
  care_log_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  consultation_case_id uuid not null,
  author_user_id uuid not null,
  entry_type text not null,
  safe_content text not null,
  correction_of_care_log_id uuid,
  care_log_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_care_log_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_care_log_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_care_log_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_care_log_author_user_fkey
    foreign key (author_user_id) references auth.users(id) on delete restrict,
  constraint crm_care_log_center_case_log_key
    unique (center_id, consultation_case_id, care_log_id),
  constraint crm_care_log_correction_exact_case_fkey
    foreign key (center_id, consultation_case_id, correction_of_care_log_id)
    references public.crm_care_log(center_id, consultation_case_id, care_log_id) on delete restrict,
  constraint crm_care_log_entry_type_check
    check (entry_type in (
      'NOTE', 'CALL_SUMMARY', 'MESSAGE_SUMMARY', 'MEETING_SUMMARY', 'CORRECTION', 'SYSTEM_SAFE'
    )),
  constraint crm_care_log_safe_content_check
    check (
      pg_catalog.length(pg_catalog.btrim(safe_content)) between 1 and 4000
      and safe_content !~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
      and safe_content !~ '(^|[^0-9])((\+?84)|0)[0-9]{8,10}([^0-9]|$)'
    ),
  constraint crm_care_log_correction_shape_check
    check ((entry_type = 'CORRECTION') = (correction_of_care_log_id is not null)),
  constraint crm_care_log_no_self_correction_check
    check (correction_of_care_log_id is null or correction_of_care_log_id <> care_log_id),
  constraint crm_care_log_version_initial_check
    check (care_log_version = 1)
);

create index crm_care_log_case_created_idx
  on public.crm_care_log (center_id, consultation_case_id, created_at);

comment on table public.crm_care_log is
  'F23.3E-P1A append-only, PII-minimized care log; corrections are new rows and attachments are not supported.';

create table public.crm_conversion_request (
  conversion_request_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  consultation_case_id uuid not null,
  source_contact_id uuid not null,
  source_case_version integer not null,
  source_contact_version integer not null,
  source_assignment_version integer not null,
  identity_policy_version integer not null,
  conversion_policy_version integer not null,
  relationship_policy_version integer not null,
  student_profile_policy_version integer not null,
  action_graph_digest bytea not null,
  request_version integer not null default 1,
  idempotency_scope text not null,
  idempotency_key_reference uuid not null,
  intent_digest bytea not null,
  status text not null default 'DRAFT',
  requested_by_user_id uuid not null,
  requested_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  terminal_outcome_digest bytea,
  constraint crm_conversion_request_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_conversion_request_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_conversion_request_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_conversion_request_contact_exact_center_fkey
    foreign key (center_id, source_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_conversion_request_case_contact_binding_fkey
    foreign key (center_id, consultation_case_id, source_contact_id)
    references public.consultation_case(center_id, consultation_case_id, primary_contact_id)
    on delete restrict,
  constraint crm_conversion_request_requested_by_user_fkey
    foreign key (requested_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_conversion_request_center_request_key
    unique (center_id, conversion_request_id),
  constraint crm_conversion_request_idempotency_reference_unique
    unique (idempotency_key_reference),
  constraint crm_conversion_request_source_versions_positive
    check (
      source_case_version >= 1
      and source_contact_version >= 1
      and source_assignment_version >= 1
    ),
  constraint crm_conversion_request_policy_versions_positive
    check (
      identity_policy_version >= 1
      and conversion_policy_version >= 1
      and relationship_policy_version >= 1
      and student_profile_policy_version >= 1
    ),
  constraint crm_conversion_request_digest_check
    check (
      pg_catalog.octet_length(action_graph_digest) = 32
      and pg_catalog.octet_length(intent_digest) = 32
      and (terminal_outcome_digest is null or pg_catalog.octet_length(terminal_outcome_digest) = 32)
    ),
  constraint crm_conversion_request_version_positive
    check (request_version >= 1),
  constraint crm_conversion_request_scope_check
    check (pg_catalog.length(pg_catalog.btrim(idempotency_scope)) between 1 and 160),
  constraint crm_conversion_request_status_check
    check (status in (
      'DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXECUTING', 'COMPLETED',
      'CONFLICT', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'COMPENSATION_REQUIRED'
    )),
  constraint crm_conversion_request_terminal_digest_check
    check (
      (status in ('COMPLETED', 'CONFLICT') and terminal_outcome_digest is not null)
      or (status not in ('COMPLETED', 'CONFLICT'))
    ),
  constraint crm_conversion_request_timestamp_order_check
    check (updated_at >= requested_at)
);

create unique index crm_conversion_request_one_active_case_idx
  on public.crm_conversion_request (center_id, consultation_case_id)
  where status in ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EXECUTING', 'COMPENSATION_REQUIRED');

create index crm_conversion_request_center_contact_idx
  on public.crm_conversion_request (center_id, source_contact_id);

comment on table public.crm_conversion_request is
  'F23.3E-P1A request vocabulary only; APPROVED/EXECUTING/COMPLETED remain unavailable until a later protected approval/executor package.';

create table public.crm_idempotency_registry (
  idempotency_record_id uuid primary key default pg_catalog.gen_random_uuid(),
  environment_fingerprint bytea not null,
  center_id text not null,
  resource_scope_kind text not null,
  resource_scope_id uuid not null,
  consultation_case_id uuid,
  operation text not null,
  idempotency_key_digest bytea not null,
  intent_digest bytea not null,
  action_graph_digest bytea,
  request_id uuid,
  status text not null default 'RESERVED',
  terminal_outcome_digest bytea,
  idempotency_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  constraint crm_idempotency_registry_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_idempotency_registry_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_idempotency_registry_case_exact_center_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_idempotency_registry_request_exact_center_fkey
    foreign key (center_id, request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict
    deferrable initially deferred,
  constraint crm_idempotency_registry_center_record_key
    unique (center_id, idempotency_record_id),
  constraint crm_idempotency_registry_scope_unique
    unique (
      environment_fingerprint,
      center_id,
      resource_scope_kind,
      resource_scope_id,
      operation,
      idempotency_key_digest
    ),
  constraint crm_idempotency_registry_environment_fingerprint_check
    check (pg_catalog.octet_length(environment_fingerprint) = 32),
  constraint crm_idempotency_registry_scope_kind_check
    check (pg_catalog.length(pg_catalog.btrim(resource_scope_kind)) between 1 and 120),
  constraint crm_idempotency_registry_operation_check
    check (pg_catalog.length(pg_catalog.btrim(operation)) between 1 and 160),
  constraint crm_idempotency_registry_digest_check
    check (
      pg_catalog.octet_length(idempotency_key_digest) = 32
      and pg_catalog.octet_length(intent_digest) = 32
      and (action_graph_digest is null or pg_catalog.octet_length(action_graph_digest) = 32)
      and (terminal_outcome_digest is null or pg_catalog.octet_length(terminal_outcome_digest) = 32)
    ),
  constraint crm_idempotency_registry_status_check
    check (status in ('RESERVED', 'IN_PROGRESS', 'COMPLETED', 'CONFLICT', 'EXPIRED')),
  constraint crm_idempotency_registry_version_positive
    check (idempotency_version >= 1),
  constraint crm_idempotency_registry_expiry_check
    check (expires_at > created_at),
  constraint crm_idempotency_registry_completion_check
    check (
      (status in ('COMPLETED', 'CONFLICT', 'EXPIRED')) = (completed_at is not null)
      and (completed_at is null or completed_at >= created_at)
    ),
  constraint crm_idempotency_registry_terminal_digest_check
    check (
      (status in ('COMPLETED', 'CONFLICT') and terminal_outcome_digest is not null)
      or (status not in ('COMPLETED', 'CONFLICT'))
    )
);

alter table public.crm_conversion_request
  add constraint crm_conversion_request_idempotency_exact_center_fkey
  foreign key (center_id, idempotency_key_reference)
  references public.crm_idempotency_registry(center_id, idempotency_record_id)
  on delete restrict
  deferrable initially deferred;

create index crm_idempotency_registry_case_idx
  on public.crm_idempotency_registry (center_id, consultation_case_id, operation);

create index crm_idempotency_registry_request_idx
  on public.crm_idempotency_registry (center_id, request_id);

comment on table public.crm_idempotency_registry is
  'F23.3E-P1A non-null resource-scoped idempotency binding; uniqueness is a backstop and never replaces the center/business root lock.';

create table public.crm_audit_event (
  audit_event_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  event_type text not null,
  actor_user_id uuid,
  resource_kind text not null,
  resource_id uuid not null,
  request_id uuid,
  assignment_id uuid,
  previous_version integer,
  new_version integer,
  safe_reason_code text,
  correlation_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_audit_event_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_audit_event_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_audit_event_actor_user_fkey
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint crm_audit_event_request_exact_center_fkey
    foreign key (center_id, request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_audit_event_assignment_exact_center_fkey
    foreign key (center_id, assignment_id)
    references public.consultation_case_assignment(center_id, assignment_id) on delete restrict,
  constraint crm_audit_event_event_type_check
    check (
      pg_catalog.length(event_type) between 3 and 160
      and event_type ~ '^[a-z][a-z0-9_.-]+$'
    ),
  constraint crm_audit_event_resource_kind_check
    check (
      pg_catalog.length(resource_kind) between 1 and 120
      and resource_kind ~ '^[a-z][a-z0-9_.-]*$'
    ),
  constraint crm_audit_event_reason_code_check
    check (
      safe_reason_code is null
      or (
        pg_catalog.length(safe_reason_code) between 1 and 160
        and safe_reason_code ~ '^[a-z][a-z0-9_.-]*$'
      )
    ),
  constraint crm_audit_event_version_edge_check
    check (
      (previous_version is null and new_version is null)
      or (previous_version is null and new_version = 1)
      or (previous_version >= 1 and new_version = previous_version + 1)
    )
);

create index crm_audit_event_center_created_idx
  on public.crm_audit_event (center_id, created_at);

create index crm_audit_event_resource_idx
  on public.crm_audit_event (center_id, resource_kind, resource_id, created_at);

create index crm_audit_event_correlation_idx
  on public.crm_audit_event (correlation_id);

comment on table public.crm_audit_event is
  'F23.3E-P1A immutable server-authored audit event with typed safe metadata and no arbitrary payload or raw PII column.';

create function public.f23_3e_p1a_is_safe_outbox_payload(p_payload jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $f23_3e_p1a_is_safe_outbox_payload$
declare
  v_key text;
  v_value jsonb;
  v_text text;
begin
  if pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    return false;
  end if;

  for v_key, v_value in
    select e.key, e.value
    from pg_catalog.jsonb_each(p_payload) as e
  loop
    if v_key not in (
      'event_schema_version', 'resource_kind', 'resource_id', 'request_id',
      'assignment_id', 'previous_version', 'new_version', 'status',
      'safe_reason_code', 'correlation_id', 'operation', 'outcome_code'
    ) then
      return false;
    end if;

    v_text := v_value #>> '{}';

    if v_key in ('resource_id', 'request_id', 'assignment_id', 'correlation_id') then
      if pg_catalog.jsonb_typeof(v_value) <> 'string'
         or v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        return false;
      end if;
    elsif v_key in ('event_schema_version', 'previous_version', 'new_version') then
      if pg_catalog.jsonb_typeof(v_value) <> 'number'
         or v_text !~ '^[1-9][0-9]*$' then
        return false;
      end if;
    else
      if pg_catalog.jsonb_typeof(v_value) <> 'string'
         or v_text !~ '^[A-Za-z][A-Za-z0-9_.-]{0,159}$' then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$f23_3e_p1a_is_safe_outbox_payload$;

comment on function public.f23_3e_p1a_is_safe_outbox_payload(jsonb) is
  'Validates the flat allowlisted P1A outbox envelope and rejects contact-like plaintext; protected PII and birth evidence have no payload key.';

revoke all on function public.f23_3e_p1a_is_safe_outbox_payload(jsonb)
  from public, anon, authenticated;
grant execute on function public.f23_3e_p1a_is_safe_outbox_payload(jsonb)
  to service_role;

create table public.crm_outbox_event (
  outbox_event_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  aggregate_kind text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1,
  safe_payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'PENDING',
  attempt_count integer not null default 0,
  available_at timestamptz not null default pg_catalog.transaction_timestamp(),
  claim_id uuid,
  claimed_by text,
  claim_expires_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_outbox_event_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_outbox_event_control_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_outbox_event_aggregate_kind_check
    check (
      pg_catalog.length(aggregate_kind) between 1 and 120
      and aggregate_kind ~ '^[a-z][a-z0-9_.-]*$'
    ),
  constraint crm_outbox_event_event_type_check
    check (
      pg_catalog.length(event_type) between 3 and 160
      and event_type ~ '^[a-z][a-z0-9_.-]+$'
    ),
  constraint crm_outbox_event_version_positive
    check (event_version >= 1),
  constraint crm_outbox_event_safe_payload_check
    check (public.f23_3e_p1a_is_safe_outbox_payload(safe_payload)),
  constraint crm_outbox_event_delivery_status_check
    check (delivery_status in ('PENDING', 'CLAIMED', 'DELIVERED', 'RETRY', 'DEAD_LETTER', 'CANCELLED')),
  constraint crm_outbox_event_attempt_count_check
    check (attempt_count >= 0),
  constraint crm_outbox_event_claim_shape_check
    check (
      (
        delivery_status in ('CLAIMED', 'DELIVERED')
        and claim_id is not null
        and claimed_by is not null
        and pg_catalog.length(pg_catalog.btrim(claimed_by)) between 1 and 160
        and claim_expires_at is not null
        and attempt_count >= 1
      )
      or (
        delivery_status not in ('CLAIMED', 'DELIVERED')
        and claim_id is null
        and claimed_by is null
        and claim_expires_at is null
      )
    ),
  constraint crm_outbox_event_claim_expiry_check
    check (claim_expires_at is null or claim_expires_at > created_at),
  constraint crm_outbox_event_delivery_timestamp_check
    check ((delivery_status = 'DELIVERED') = (delivered_at is not null)),
  constraint crm_outbox_event_timestamp_order_check
    check (
      updated_at >= created_at
      and available_at >= created_at
      and (delivered_at is null or delivered_at >= created_at)
    )
);

create index crm_outbox_event_delivery_queue_idx
  on public.crm_outbox_event (delivery_status, available_at, created_at)
  where delivery_status in ('PENDING', 'RETRY');

create index crm_outbox_event_claim_expiry_idx
  on public.crm_outbox_event (claim_expires_at)
  where delivery_status = 'CLAIMED';

create index crm_outbox_event_aggregate_idx
  on public.crm_outbox_event (center_id, aggregate_kind, aggregate_id, event_version);

comment on table public.crm_outbox_event is
  'F23.3E-P1A durable at-least-once outbox with a flat safe payload, explicit claim lease, monotonic event version, retry and dead-letter state.';

-- All mutable aggregates must advance their integer version by exactly one.
create function public.f23_3e_p1a_enforce_monotonic_version()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_enforce_monotonic_version$
begin
  if tg_table_schema <> 'public' then
    raise exception 'f23_3e_p1a_version_trigger_schema_denied';
  end if;

  case tg_table_name
    when 'center_crm_control' then
      if new.control_version <> old.control_version + 1 then
        raise exception 'f23_3e_p1a_control_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    when 'crm_contact' then
      if new.contact_version <> old.contact_version + 1 then
        raise exception 'f23_3e_p1a_contact_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    when 'consultation_case' then
      if new.case_version <> old.case_version + 1 then
        raise exception 'f23_3e_p1a_case_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    when 'consultation_case_candidate_student' then
      if new.candidate_version <> old.candidate_version + 1 then
        raise exception 'f23_3e_p1a_candidate_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    when 'consultation_case_assignment' then
      if new.assignment_version <> old.assignment_version + 1 then
        raise exception 'f23_3e_p1a_assignment_version_must_increment_by_one';
      end if;
    when 'crm_conversion_request' then
      if new.request_version <> old.request_version + 1 then
        raise exception 'f23_3e_p1a_request_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    when 'crm_idempotency_registry' then
      if new.idempotency_version <> old.idempotency_version + 1 then
        raise exception 'f23_3e_p1a_idempotency_version_must_increment_by_one';
      end if;
    when 'crm_outbox_event' then
      if new.event_version <> old.event_version + 1 then
        raise exception 'f23_3e_p1a_event_version_must_increment_by_one';
      end if;
      new.updated_at := pg_catalog.transaction_timestamp();
    else
      raise exception 'f23_3e_p1a_version_trigger_table_not_allowlisted: %', tg_table_name;
  end case;

  return new;
end;
$f23_3e_p1a_enforce_monotonic_version$;

revoke all on function public.f23_3e_p1a_enforce_monotonic_version()
  from public, anon, authenticated;

create trigger f23_3e_p1a_center_control_version
before update on public.center_crm_control
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_contact_version
before update on public.crm_contact
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_case_version
before update on public.consultation_case
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_candidate_version
before update on public.consultation_case_candidate_student
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_assignment_version
before update on public.consultation_case_assignment
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_request_version
before update on public.crm_conversion_request
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_idempotency_version
before update on public.crm_idempotency_registry
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create trigger f23_3e_p1a_outbox_version
before update on public.crm_outbox_event
for each row execute function public.f23_3e_p1a_enforce_monotonic_version();

create function public.f23_3e_p1a_guard_contact_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_contact_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.contact_status <> 'NEW' or new.contact_version <> 1 then
      raise exception 'f23_3e_p1a_contact_must_start_new_at_version_one';
    end if;
    return new;
  end if;

  if old.contact_status = 'ARCHIVED' and new.contact_status <> 'ARCHIVED' then
    raise exception 'f23_3e_p1a_archived_contact_restore_requires_future_protected_flow';
  end if;

  if new.contact_status <> old.contact_status and not (
    (old.contact_status = 'NEW' and new.contact_status in ('CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'ARCHIVED'))
    or (old.contact_status = 'CONTACTED' and new.contact_status in ('QUALIFIED', 'UNQUALIFIED', 'ARCHIVED'))
    or (old.contact_status = 'QUALIFIED' and new.contact_status in ('UNQUALIFIED', 'ARCHIVED'))
    or (old.contact_status = 'UNQUALIFIED' and new.contact_status in ('CONTACTED', 'ARCHIVED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_contact_transition: % -> %', old.contact_status, new.contact_status;
  end if;

  return new;
end;
$f23_3e_p1a_guard_contact_lifecycle$;

create function public.f23_3e_p1a_guard_case_lifecycle()
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

create function public.f23_3e_p1a_guard_candidate_lifecycle()
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

create function public.f23_3e_p1a_guard_assignment_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_assignment_lifecycle$
begin
  if tg_op = 'DELETE' then
    raise exception 'f23_3e_p1a_assignment_history_delete_forbidden';
  end if;

  if tg_op = 'INSERT' then
    if new.assignment_status <> 'ACTIVE' or new.assignment_version <> 1 then
      raise exception 'f23_3e_p1a_assignment_must_start_active_at_version_one';
    end if;
    return new;
  end if;

  if new.assignment_id is distinct from old.assignment_id
     or new.center_id is distinct from old.center_id
     or new.consultation_case_id is distinct from old.consultation_case_id
     or new.assigned_consultant_user_id is distinct from old.assigned_consultant_user_id
     or new.assigned_by_user_id is distinct from old.assigned_by_user_id
     or new.assigned_at is distinct from old.assigned_at then
    raise exception 'f23_3e_p1a_assignment_identity_history_is_immutable';
  end if;

  if old.assignment_status <> 'ACTIVE' then
    raise exception 'f23_3e_p1a_terminal_assignment_cannot_be_rewritten';
  end if;

  if new.assignment_status not in ('ENDED', 'REVOKED', 'SUPERSEDED') then
    raise exception 'f23_3e_p1a_active_assignment_must_transition_to_terminal_history';
  end if;

  return new;
end;
$f23_3e_p1a_guard_assignment_lifecycle$;

create function public.f23_3e_p1a_guard_request_lifecycle()
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

create function public.f23_3e_p1a_guard_idempotency_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_idempotency_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'RESERVED' or new.idempotency_version <> 1 then
      raise exception 'f23_3e_p1a_idempotency_must_start_reserved_at_version_one';
    end if;
    return new;
  end if;

  if new.environment_fingerprint is distinct from old.environment_fingerprint
     or new.center_id is distinct from old.center_id
     or new.resource_scope_kind is distinct from old.resource_scope_kind
     or new.resource_scope_id is distinct from old.resource_scope_id
     or new.consultation_case_id is distinct from old.consultation_case_id
     or new.operation is distinct from old.operation
     or new.idempotency_key_digest is distinct from old.idempotency_key_digest
     or new.intent_digest is distinct from old.intent_digest
     or new.action_graph_digest is distinct from old.action_graph_digest
     or new.request_id is distinct from old.request_id
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'f23_3e_p1a_idempotency_scope_and_intent_are_immutable';
  end if;

  if old.status in ('COMPLETED', 'CONFLICT', 'EXPIRED') then
    raise exception 'f23_3e_p1a_terminal_idempotency_record_is_immutable';
  end if;

  if not (
    (old.status = 'RESERVED' and new.status in ('RESERVED', 'IN_PROGRESS', 'COMPLETED', 'CONFLICT', 'EXPIRED'))
    or (old.status = 'IN_PROGRESS' and new.status in ('IN_PROGRESS', 'COMPLETED', 'CONFLICT', 'EXPIRED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_idempotency_transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$f23_3e_p1a_guard_idempotency_lifecycle$;

create function public.f23_3e_p1a_guard_outbox_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_guard_outbox_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.delivery_status <> 'PENDING'
       or new.event_version <> 1
       or new.attempt_count <> 0
       or new.claim_id is not null
       or new.claimed_by is not null
       or new.claim_expires_at is not null
       or new.delivered_at is not null then
      raise exception 'f23_3e_p1a_outbox_must_start_pending_at_version_one';
    end if;
    return new;
  end if;

  if new.outbox_event_id is distinct from old.outbox_event_id
     or new.center_id is distinct from old.center_id
     or new.aggregate_kind is distinct from old.aggregate_kind
     or new.aggregate_id is distinct from old.aggregate_id
     or new.event_type is distinct from old.event_type
     or new.safe_payload is distinct from old.safe_payload
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p1a_outbox_event_identity_and_payload_are_immutable';
  end if;

  if old.delivery_status in ('DELIVERED', 'DEAD_LETTER', 'CANCELLED') then
    raise exception 'f23_3e_p1a_terminal_outbox_event_cannot_return_to_pending';
  end if;

  if not (
    (old.delivery_status in ('PENDING', 'RETRY') and new.delivery_status = 'CLAIMED' and new.attempt_count = old.attempt_count + 1)
    or (old.delivery_status in ('PENDING', 'RETRY') and new.delivery_status = 'CANCELLED' and new.attempt_count = old.attempt_count)
    or (old.delivery_status = 'CLAIMED' and new.delivery_status in ('DELIVERED', 'RETRY', 'DEAD_LETTER', 'CANCELLED') and new.attempt_count = old.attempt_count)
  ) then
    raise exception 'f23_3e_p1a_invalid_outbox_transition: % -> %', old.delivery_status, new.delivery_status;
  end if;

  return new;
end;
$f23_3e_p1a_guard_outbox_lifecycle$;

create function public.f23_3e_p1a_reject_immutable_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_reject_immutable_event_mutation$
begin
  raise exception 'f23_3e_p1a_append_only_table_rejects_%', pg_catalog.lower(tg_op);
end;
$f23_3e_p1a_reject_immutable_event_mutation$;

create trigger f23_3e_p1a_contact_lifecycle
before insert or update on public.crm_contact
for each row execute function public.f23_3e_p1a_guard_contact_lifecycle();

create trigger f23_3e_p1a_case_lifecycle
before insert or update on public.consultation_case
for each row execute function public.f23_3e_p1a_guard_case_lifecycle();

create trigger f23_3e_p1a_candidate_lifecycle
before insert or update on public.consultation_case_candidate_student
for each row execute function public.f23_3e_p1a_guard_candidate_lifecycle();

create trigger f23_3e_p1a_assignment_lifecycle
before insert or update or delete on public.consultation_case_assignment
for each row execute function public.f23_3e_p1a_guard_assignment_lifecycle();

create trigger f23_3e_p1a_request_lifecycle
before insert or update on public.crm_conversion_request
for each row execute function public.f23_3e_p1a_guard_request_lifecycle();

create trigger f23_3e_p1a_idempotency_lifecycle
before insert or update on public.crm_idempotency_registry
for each row execute function public.f23_3e_p1a_guard_idempotency_lifecycle();

create trigger f23_3e_p1a_outbox_lifecycle
before insert or update on public.crm_outbox_event
for each row execute function public.f23_3e_p1a_guard_outbox_lifecycle();

create trigger f23_3e_p1a_care_log_append_only
before update or delete on public.crm_care_log
for each row execute function public.f23_3e_p1a_reject_immutable_event_mutation();

create trigger f23_3e_p1a_audit_event_immutable
before update or delete on public.crm_audit_event
for each row execute function public.f23_3e_p1a_reject_immutable_event_mutation();

-- Deferred cross-checks make the circular Case <-> Assignment pointer exact at commit.
create function public.f23_3e_p1a_assert_case_active_assignment()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_assert_case_active_assignment$
declare
  v_active_count bigint;
  v_pointer_is_active boolean;
begin
  select pg_catalog.count(*)
  into v_active_count
  from public.consultation_case_assignment a
  where a.center_id = new.center_id
    and a.consultation_case_id = new.consultation_case_id
    and a.assignment_status = 'ACTIVE';

  v_pointer_is_active := new.active_assignment_id is not null and exists (
    select 1
    from public.consultation_case_assignment a
    where a.center_id = new.center_id
      and a.consultation_case_id = new.consultation_case_id
      and a.assignment_id = new.active_assignment_id
      and a.assignment_status = 'ACTIVE'
  );

  if (new.active_assignment_id is null and v_active_count <> 0)
     or (new.active_assignment_id is not null and (v_active_count <> 1 or not v_pointer_is_active)) then
    raise exception 'f23_3e_p1a_case_active_assignment_pointer_mismatch';
  end if;

  return null;
end;
$f23_3e_p1a_assert_case_active_assignment$;

create function public.f23_3e_p1a_assert_assignment_case_root()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1a_assert_assignment_case_root$
declare
  v_center_id text;
  v_case_id uuid;
  v_active_count bigint;
  v_active_assignment_id uuid;
  v_case_pointer uuid;
begin
  v_center_id := case when tg_op = 'DELETE' then old.center_id else new.center_id end;
  v_case_id := case when tg_op = 'DELETE' then old.consultation_case_id else new.consultation_case_id end;

  select c.active_assignment_id
  into v_case_pointer
  from public.consultation_case c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_case_id;

  if not found then
    raise exception 'f23_3e_p1a_assignment_case_root_missing';
  end if;

  select pg_catalog.count(*)
  into v_active_count
  from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = v_case_id
    and a.assignment_status = 'ACTIVE';

  select a.assignment_id
  into v_active_assignment_id
  from public.consultation_case_assignment a
  where a.center_id = v_center_id
    and a.consultation_case_id = v_case_id
    and a.assignment_status = 'ACTIVE';

  if (v_active_count = 0 and v_case_pointer is not null)
     or (v_active_count = 1 and v_case_pointer is distinct from v_active_assignment_id)
     or v_active_count > 1 then
    raise exception 'f23_3e_p1a_assignment_case_root_pointer_mismatch';
  end if;

  return null;
end;
$f23_3e_p1a_assert_assignment_case_root$;

create constraint trigger f23_3e_p1a_case_active_assignment_consistency
after insert or update on public.consultation_case
deferrable initially deferred
for each row execute function public.f23_3e_p1a_assert_case_active_assignment();

create constraint trigger f23_3e_p1a_assignment_case_root_consistency
after insert or update or delete on public.consultation_case_assignment
deferrable initially deferred
for each row execute function public.f23_3e_p1a_assert_assignment_case_root();

revoke all on function public.f23_3e_p1a_guard_contact_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_case_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_candidate_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_assignment_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_request_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_idempotency_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_guard_outbox_lifecycle()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_reject_immutable_event_mutation()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_assert_case_active_assignment()
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1a_assert_assignment_case_root()
  from public, anon, authenticated;

-- P1A is deliberately fail-closed: no member policy is created on these tables.
alter table public.center_crm_control enable row level security;
alter table public.center_crm_control force row level security;
alter table public.crm_contact enable row level security;
alter table public.crm_contact force row level security;
alter table public.consultation_case enable row level security;
alter table public.consultation_case force row level security;
alter table public.consultation_case_candidate_student enable row level security;
alter table public.consultation_case_candidate_student force row level security;
alter table public.consultation_case_assignment enable row level security;
alter table public.consultation_case_assignment force row level security;
alter table public.crm_care_log enable row level security;
alter table public.crm_care_log force row level security;
alter table public.crm_conversion_request enable row level security;
alter table public.crm_conversion_request force row level security;
alter table public.crm_idempotency_registry enable row level security;
alter table public.crm_idempotency_registry force row level security;
alter table public.crm_audit_event enable row level security;
alter table public.crm_audit_event force row level security;
alter table public.crm_outbox_event enable row level security;
alter table public.crm_outbox_event force row level security;

revoke all privileges on table
  public.center_crm_control,
  public.crm_contact,
  public.consultation_case,
  public.consultation_case_candidate_student,
  public.consultation_case_assignment,
  public.crm_care_log,
  public.crm_conversion_request,
  public.crm_idempotency_registry,
  public.crm_audit_event,
  public.crm_outbox_event
from public, anon, authenticated;

-- No policy and no browser grant is added. Later typed server operations must be
-- reviewed separately before any center can leave PLANNED/DISABLED state.

commit;
