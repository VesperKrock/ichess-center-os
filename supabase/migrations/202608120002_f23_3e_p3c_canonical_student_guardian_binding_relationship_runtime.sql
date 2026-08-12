-- F23.3E-P3C: canonical Student/Guardian, committed identity bindings,
-- Guardian-Student relationships, canonical P2 dispatch, and reviewed plans.
-- P3C creates no real-conversion executor and consumes no authority/reservation.

begin;

set local check_function_bodies = true;

do $f23_3e_p3c_prerequisites$
declare
  v_vault_version text;
begin
  if pg_catalog.to_regclass('public.crm_conversion_action') is null
     or pg_catalog.to_regclass('public.crm_conversion_authority') is null
     or pg_catalog.to_regclass('public.crm_identity_match_review') is null
     or pg_catalog.to_regclass('public.crm_profile_creation_reservation') is null
     or pg_catalog.to_regclass('public.crm_identity_policy_registry') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case_candidate_student') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3b_internal_action_set_digest(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3b_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid)') is null
     or pg_catalog.to_regprocedure('vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)') is null
     or pg_catalog.to_regprocedure('vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea)') is null
     or pg_catalog.to_regprocedure('vault._crypto_aead_det_noncegen()') is null then
    raise exception 'f23_3e_p3c_missing_frozen_prerequisite';
  end if;
  select e.extversion into v_vault_version
  from pg_catalog.pg_extension e where e.extname = 'supabase_vault';
  if v_vault_version is distinct from '0.3.1' then
    raise exception 'P3C0_PHYSICAL_VAULT_CONTRACT_DRIFT';
  end if;
  if pg_catalog.to_regclass('public.student_profile') is not null
     or pg_catalog.to_regclass('public.guardian_profile') is not null
     or pg_catalog.to_regclass('public.crm_identity_target_binding') is not null
     or pg_catalog.to_regclass('public.guardian_student_relationship') is not null
     or exists (
       select 1 from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'f23_3e_p3c_%'
     ) then
    raise exception 'f23_3e_p3c_resource_already_exists';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p3c_missing_service_role';
  end if;
end;
$f23_3e_p3c_prerequisites$;

create function public.f23_3e_p3c_internal_valid_digest_array(p_values bytea[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $f23_3e_p3c_internal_valid_digest_array$
  select pg_catalog.cardinality(p_values) >= 1
    and pg_catalog.array_position(p_values, null) is null
    and not exists (
      select 1 from pg_catalog.unnest(p_values) v
      where pg_catalog.octet_length(v) <> 32
    )
$f23_3e_p3c_internal_valid_digest_array$;

-- The globally unique registry UUID makes this narrower exact policy binding
-- unique without adding identity_kind to the frozen Student target shape.
alter table public.crm_identity_policy_registry
  add constraint crm_identity_policy_registry_p3c_target_binding_key
  unique (
    center_id, identity_policy_registry_id, normalization_version,
    match_policy_version, minimum_evidence_policy_version
  );

create table public.student_profile (
  student_id uuid primary key,
  center_id text not null,
  legacy_local_id text,
  display_name text not null,
  birth_evidence_protected bytea not null,
  profile_status text not null default 'ACTIVE',
  learning_lifecycle_status text,
  identity_policy_registry_id uuid not null,
  normalization_version integer not null,
  match_policy_version integer not null,
  minimum_evidence_policy_version integer not null,
  name_lookup_digest bytea not null,
  birth_lookup_digest bytea not null,
  identity_evidence_digest bytea not null,
  student_version integer not null default 1,
  created_from_case_id uuid not null,
  created_from_candidate_id uuid not null,
  created_from_request_id uuid not null,
  created_from_action_id uuid not null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  archived_at timestamptz,
  constraint student_profile_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint student_profile_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint student_profile_policy_exact_binding_fkey
    foreign key (
      center_id, identity_policy_registry_id, normalization_version,
      match_policy_version, minimum_evidence_policy_version
    ) references public.crm_identity_policy_registry (
      center_id, identity_policy_registry_id, normalization_version,
      match_policy_version, minimum_evidence_policy_version
    ) on delete restrict,
  constraint student_profile_created_case_exact_center_fkey
    foreign key (center_id, created_from_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint student_profile_created_candidate_exact_case_fkey
    foreign key (center_id, created_from_case_id, created_from_candidate_id)
    references public.consultation_case_candidate_student(
      center_id, consultation_case_id, candidate_student_id
    ) on delete restrict,
  constraint student_profile_created_request_exact_center_fkey
    foreign key (center_id, created_from_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint student_profile_created_action_exact_request_fkey
    foreign key (center_id, created_from_request_id, created_from_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict,
  constraint student_profile_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint student_profile_center_student_key unique (center_id, student_id),
  constraint student_profile_legacy_local_id_check
    check (legacy_local_id is null or pg_catalog.length(pg_catalog.btrim(legacy_local_id)) between 1 and 240),
  constraint student_profile_display_name_check
    check (pg_catalog.length(pg_catalog.btrim(display_name)) between 1 and 240),
  constraint student_profile_birth_evidence_check
    check (pg_catalog.octet_length(birth_evidence_protected) > 0),
  constraint student_profile_profile_status_check
    check (profile_status in ('ACTIVE', 'MERGE_REVIEW', 'ARCHIVED')),
  constraint student_profile_learning_lifecycle_check
    check (learning_lifecycle_status is null or learning_lifecycle_status in ('Đang theo học', 'Bảo lưu', 'Ngừng học')),
  constraint student_profile_digest_sizes_check
    check (
      pg_catalog.octet_length(name_lookup_digest) = 32
      and pg_catalog.octet_length(birth_lookup_digest) = 32
      and pg_catalog.octet_length(identity_evidence_digest) = 32
    ),
  constraint student_profile_versions_positive
    check (
      normalization_version >= 1 and match_policy_version >= 1
      and minimum_evidence_policy_version >= 1 and student_version >= 1
    ),
  constraint student_profile_archive_mapping_check
    check ((profile_status = 'ARCHIVED') = (archived_at is not null)),
  constraint student_profile_timestamp_order_check
    check (updated_at >= created_at and (archived_at is null or archived_at >= created_at))
);

create unique index student_profile_legacy_local_id_idx
  on public.student_profile(center_id, legacy_local_id)
  where legacy_local_id is not null;
create index student_profile_identity_detection_idx
  on public.student_profile(
    center_id, identity_policy_registry_id, name_lookup_digest,
    birth_lookup_digest, profile_status
  );

create table public.guardian_profile (
  guardian_id uuid primary key,
  center_id text not null,
  display_name text not null,
  protected_contact_methods_ciphertext bytea not null,
  contact_methods_crypto_version integer not null,
  normalized_lookup_digests bytea[] not null,
  normalization_version integer not null,
  identity_evidence_digest bytea not null,
  guardian_status text not null default 'ACTIVE',
  guardian_version integer not null default 1,
  created_from_contact_id uuid not null,
  created_from_case_id uuid not null,
  created_from_request_id uuid not null,
  created_from_action_id uuid not null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  archived_at timestamptz,
  constraint guardian_profile_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint guardian_profile_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint guardian_profile_created_contact_exact_center_fkey
    foreign key (center_id, created_from_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint guardian_profile_created_case_exact_center_fkey
    foreign key (center_id, created_from_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint guardian_profile_created_request_exact_center_fkey
    foreign key (center_id, created_from_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint guardian_profile_created_action_exact_request_fkey
    foreign key (center_id, created_from_request_id, created_from_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict,
  constraint guardian_profile_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint guardian_profile_center_guardian_key unique (center_id, guardian_id),
  constraint guardian_profile_display_name_check
    check (pg_catalog.length(pg_catalog.btrim(display_name)) between 1 and 240),
  constraint guardian_profile_ciphertext_check
    check (pg_catalog.octet_length(protected_contact_methods_ciphertext) >= 68),
  constraint guardian_profile_crypto_version_check
    check (contact_methods_crypto_version = 1),
  constraint guardian_profile_lookup_digests_check
    check (public.f23_3e_p3c_internal_valid_digest_array(normalized_lookup_digests)),
  constraint guardian_profile_digest_size_check
    check (pg_catalog.octet_length(identity_evidence_digest) = 32),
  constraint guardian_profile_versions_positive
    check (normalization_version >= 1 and guardian_version >= 1),
  constraint guardian_profile_status_check
    check (guardian_status in ('ACTIVE', 'INACTIVE', 'MERGE_REVIEW', 'ARCHIVED')),
  constraint guardian_profile_archive_mapping_check
    check ((guardian_status = 'ARCHIVED') = (archived_at is not null)),
  constraint guardian_profile_timestamp_order_check
    check (updated_at >= created_at and (archived_at is null or archived_at >= created_at))
);

create index guardian_profile_lookup_digests_idx
  on public.guardian_profile using gin(normalized_lookup_digests);
create index guardian_profile_center_status_idx
  on public.guardian_profile(center_id, guardian_status, guardian_id);

create table public.crm_identity_target_binding (
  identity_target_binding_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  identity_kind text not null,
  source_contact_id uuid,
  source_candidate_student_id uuid,
  student_id uuid,
  guardian_id uuid,
  binding_status text not null default 'ACTIVE',
  binding_version integer not null default 1,
  source_version_at_binding integer not null,
  target_version_at_binding integer not null,
  originating_request_id uuid not null,
  originating_action_id uuid not null,
  originating_review_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  terminal_at timestamptz,
  constraint crm_identity_target_binding_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_identity_target_binding_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_identity_target_binding_contact_exact_center_fkey
    foreign key (center_id, source_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_identity_target_binding_candidate_exact_center_fkey
    foreign key (center_id, source_candidate_student_id)
    references public.consultation_case_candidate_student(center_id, candidate_student_id)
    on delete restrict,
  constraint crm_identity_target_binding_student_exact_center_fkey
    foreign key (center_id, student_id)
    references public.student_profile(center_id, student_id) on delete restrict,
  constraint crm_identity_target_binding_guardian_exact_center_fkey
    foreign key (center_id, guardian_id)
    references public.guardian_profile(center_id, guardian_id) on delete restrict,
  constraint crm_identity_target_binding_request_exact_center_fkey
    foreign key (center_id, originating_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint crm_identity_target_binding_action_exact_request_fkey
    foreign key (center_id, originating_request_id, originating_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict,
  constraint crm_identity_target_binding_review_exact_center_fkey
    foreign key (center_id, originating_review_id)
    references public.crm_identity_match_review(center_id, match_review_id) on delete restrict,
  constraint crm_identity_target_binding_center_binding_key
    unique (center_id, identity_target_binding_id),
  constraint crm_identity_target_binding_identity_kind_check
    check (identity_kind in ('STUDENT', 'GUARDIAN')),
  constraint crm_identity_target_binding_source_target_shape_check
    check (
      (identity_kind = 'STUDENT' and source_candidate_student_id is not null
       and student_id is not null and source_contact_id is null and guardian_id is null)
      or
      (identity_kind = 'GUARDIAN' and source_contact_id is not null
       and guardian_id is not null and source_candidate_student_id is null and student_id is null)
    ),
  constraint crm_identity_target_binding_status_check
    check (binding_status in ('ACTIVE', 'REVOKED', 'SUPERSEDED')),
  constraint crm_identity_target_binding_versions_positive
    check (binding_version >= 1 and source_version_at_binding >= 1 and target_version_at_binding >= 1),
  constraint crm_identity_target_binding_terminal_mapping_check
    check ((binding_status = 'ACTIVE') = (terminal_at is null)),
  constraint crm_identity_target_binding_timestamp_order_check
    check (terminal_at is null or terminal_at >= created_at)
);

create unique index crm_identity_target_binding_one_active_source_idx
  on public.crm_identity_target_binding(
    center_id, identity_kind,
    coalesce(source_contact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(source_candidate_student_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where binding_status = 'ACTIVE';
create index crm_identity_target_binding_student_idx
  on public.crm_identity_target_binding(center_id, student_id, binding_status);
create index crm_identity_target_binding_guardian_idx
  on public.crm_identity_target_binding(center_id, guardian_id, binding_status);

create table public.guardian_student_relationship (
  relationship_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null,
  guardian_id uuid not null,
  student_id uuid not null,
  relationship_type text not null,
  is_primary_contact boolean not null default false,
  financial_contact_role text not null default 'NONE',
  academic_contact_role text not null default 'NONE',
  status text not null default 'ACTIVE',
  relationship_version integer not null default 1,
  effective_from timestamptz not null default pg_catalog.transaction_timestamp(),
  effective_to timestamptz,
  created_from_request_id uuid not null,
  created_from_action_id uuid not null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint guardian_student_relationship_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint guardian_student_relationship_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint guardian_student_relationship_guardian_exact_center_fkey
    foreign key (center_id, guardian_id)
    references public.guardian_profile(center_id, guardian_id) on delete restrict,
  constraint guardian_student_relationship_student_exact_center_fkey
    foreign key (center_id, student_id)
    references public.student_profile(center_id, student_id) on delete restrict,
  constraint guardian_student_relationship_request_exact_center_fkey
    foreign key (center_id, created_from_request_id)
    references public.crm_conversion_request(center_id, conversion_request_id) on delete restrict,
  constraint guardian_student_relationship_action_exact_request_fkey
    foreign key (center_id, created_from_request_id, created_from_action_id)
    references public.crm_conversion_action(center_id, conversion_request_id, conversion_action_id)
    on delete restrict,
  constraint guardian_student_relationship_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint guardian_student_relationship_center_relationship_key
    unique (center_id, relationship_id),
  constraint guardian_student_relationship_type_check
    check (relationship_type in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')),
  constraint guardian_student_relationship_contact_roles_check
    check (
      financial_contact_role in ('NONE', 'PRIMARY', 'SECONDARY')
      and academic_contact_role in ('NONE', 'PRIMARY', 'SECONDARY')
    ),
  constraint guardian_student_relationship_status_check
    check (status in ('ACTIVE', 'ENDED', 'ARCHIVED')),
  constraint guardian_student_relationship_versions_positive
    check (relationship_version >= 1),
  constraint guardian_student_relationship_effective_interval_check
    check (effective_to is null or effective_to >= effective_from),
  constraint guardian_student_relationship_terminal_mapping_check
    check ((status = 'ACTIVE') = (effective_to is null)),
  constraint guardian_student_relationship_timestamp_order_check
    check (updated_at >= created_at and effective_from >= created_at)
);

create unique index guardian_student_relationship_one_active_equivalent_idx
  on public.guardian_student_relationship(center_id, guardian_id, student_id, relationship_type)
  where status = 'ACTIVE';
create unique index guardian_student_relationship_one_active_primary_idx
  on public.guardian_student_relationship(center_id, student_id)
  where status = 'ACTIVE' and is_primary_contact;
create index guardian_student_relationship_guardian_idx
  on public.guardian_student_relationship(center_id, guardian_id, status);
create index guardian_student_relationship_student_idx
  on public.guardian_student_relationship(center_id, student_id, status);

-- Four protected aggregates: no policies, no direct application table access,
-- and no Realtime membership.
alter table public.student_profile enable row level security;
alter table public.student_profile force row level security;
alter table public.guardian_profile enable row level security;
alter table public.guardian_profile force row level security;
alter table public.crm_identity_target_binding enable row level security;
alter table public.crm_identity_target_binding force row level security;
alter table public.guardian_student_relationship enable row level security;
alter table public.guardian_student_relationship force row level security;

revoke all on table public.student_profile from public, anon, authenticated, service_role;
revoke all on table public.guardian_profile from public, anon, authenticated, service_role;
revoke all on table public.crm_identity_target_binding from public, anon, authenticated, service_role;
revoke all on table public.guardian_student_relationship from public, anon, authenticated, service_role;

create function public.f23_3e_p3c_internal_guard_student_profile()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3c_internal_guard_student_profile$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3c_student_delete_forbidden'; end if;
  if tg_op = 'INSERT' then
    if new.student_version <> 1 then raise exception 'f23_3e_p3c_student_must_start_at_version_one'; end if;
    if not exists (
      select 1 from public.crm_identity_policy_registry p
      where p.center_id = new.center_id
        and p.identity_kind = 'STUDENT'
        and p.identity_policy_registry_id = new.identity_policy_registry_id
        and p.normalization_version = new.normalization_version
        and p.match_policy_version = new.match_policy_version
        and p.minimum_evidence_policy_version = new.minimum_evidence_policy_version
    ) then raise exception 'f23_3e_p3c_student_policy_binding_invalid'; end if;
    return new;
  end if;
  if pg_catalog.current_setting('ichess.p3c_target_write', true) <> 'on' then
    raise exception 'f23_3e_p3c_student_update_requires_protected_writer';
  end if;
  if new.student_id is distinct from old.student_id or new.center_id is distinct from old.center_id
     or new.legacy_local_id is distinct from old.legacy_local_id
     or new.identity_policy_registry_id is distinct from old.identity_policy_registry_id
     or new.normalization_version is distinct from old.normalization_version
     or new.match_policy_version is distinct from old.match_policy_version
     or new.minimum_evidence_policy_version is distinct from old.minimum_evidence_policy_version
     or new.name_lookup_digest is distinct from old.name_lookup_digest
     or new.birth_lookup_digest is distinct from old.birth_lookup_digest
     or new.identity_evidence_digest is distinct from old.identity_evidence_digest
     or new.created_from_case_id is distinct from old.created_from_case_id
     or new.created_from_candidate_id is distinct from old.created_from_candidate_id
     or new.created_from_request_id is distinct from old.created_from_request_id
     or new.created_from_action_id is distinct from old.created_from_action_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
     or new.student_version <> old.student_version + 1 then
    raise exception 'f23_3e_p3c_student_binding_or_version_invalid';
  end if;
  if old.profile_status = 'ARCHIVED' then raise exception 'f23_3e_p3c_archived_student_is_terminal'; end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p3c_internal_guard_student_profile$;

create trigger f23_3e_p3c_student_profile_guard
before insert or update or delete on public.student_profile
for each row execute function public.f23_3e_p3c_internal_guard_student_profile();

create function public.f23_3e_p3c_internal_guard_guardian_profile()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3c_internal_guard_guardian_profile$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3c_guardian_delete_forbidden'; end if;
  if tg_op = 'INSERT' then
    if new.guardian_version <> 1 or new.contact_methods_crypto_version <> 1 then
      raise exception 'f23_3e_p3c_guardian_must_start_at_version_one';
    end if;
    return new;
  end if;
  if pg_catalog.current_setting('ichess.p3c_target_write', true) <> 'on' then
    raise exception 'f23_3e_p3c_guardian_update_requires_protected_writer';
  end if;
  if new.guardian_id is distinct from old.guardian_id or new.center_id is distinct from old.center_id
     or new.normalization_version is distinct from old.normalization_version
     or new.identity_evidence_digest is distinct from old.identity_evidence_digest
     or new.created_from_contact_id is distinct from old.created_from_contact_id
     or new.created_from_case_id is distinct from old.created_from_case_id
     or new.created_from_request_id is distinct from old.created_from_request_id
     or new.created_from_action_id is distinct from old.created_from_action_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
     or new.guardian_version <> old.guardian_version + 1 then
    raise exception 'f23_3e_p3c_guardian_binding_or_version_invalid';
  end if;
  if old.guardian_status = 'ARCHIVED' then raise exception 'f23_3e_p3c_archived_guardian_is_terminal'; end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p3c_internal_guard_guardian_profile$;

create trigger f23_3e_p3c_guardian_profile_guard
before insert or update or delete on public.guardian_profile
for each row execute function public.f23_3e_p3c_internal_guard_guardian_profile();

create function public.f23_3e_p3c_internal_guard_identity_target_binding()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3c_internal_guard_identity_target_binding$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3c_identity_binding_delete_forbidden'; end if;
  if pg_catalog.current_setting('ichess.p3c_binding_write', true) <> 'on' then
    raise exception 'f23_3e_p3c_identity_binding_requires_protected_writer';
  end if;
  if tg_op = 'INSERT' then
    if new.binding_status <> 'ACTIVE' or new.binding_version <> 1 or new.terminal_at is not null then
      raise exception 'f23_3e_p3c_identity_binding_must_start_active';
    end if;
    return new;
  end if;
  if new.identity_target_binding_id is distinct from old.identity_target_binding_id
     or new.center_id is distinct from old.center_id or new.identity_kind is distinct from old.identity_kind
     or new.source_contact_id is distinct from old.source_contact_id
     or new.source_candidate_student_id is distinct from old.source_candidate_student_id
     or new.student_id is distinct from old.student_id or new.guardian_id is distinct from old.guardian_id
     or new.source_version_at_binding is distinct from old.source_version_at_binding
     or new.target_version_at_binding is distinct from old.target_version_at_binding
     or new.originating_request_id is distinct from old.originating_request_id
     or new.originating_action_id is distinct from old.originating_action_id
     or new.originating_review_id is distinct from old.originating_review_id
     or new.created_at is distinct from old.created_at
     or old.binding_status <> 'ACTIVE' or new.binding_status not in ('REVOKED', 'SUPERSEDED')
     or new.binding_version <> old.binding_version + 1 then
    raise exception 'f23_3e_p3c_identity_binding_transition_invalid';
  end if;
  new.terminal_at := coalesce(new.terminal_at, pg_catalog.transaction_timestamp());
  return new;
end;
$f23_3e_p3c_internal_guard_identity_target_binding$;

create trigger f23_3e_p3c_identity_target_binding_guard
before insert or update or delete on public.crm_identity_target_binding
for each row execute function public.f23_3e_p3c_internal_guard_identity_target_binding();

create function public.f23_3e_p3c_internal_guard_guardian_student_relationship()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p3c_internal_guard_guardian_student_relationship$
begin
  if tg_op = 'DELETE' then raise exception 'f23_3e_p3c_relationship_delete_forbidden'; end if;
  if pg_catalog.current_setting('ichess.p3c_relationship_write', true) <> 'on' then
    raise exception 'f23_3e_p3c_relationship_requires_protected_writer';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'ACTIVE' or new.relationship_version <> 1 or new.effective_to is not null then
      raise exception 'f23_3e_p3c_relationship_must_start_active';
    end if;
    return new;
  end if;
  if new.relationship_id is distinct from old.relationship_id
     or new.center_id is distinct from old.center_id
     or new.guardian_id is distinct from old.guardian_id
     or new.student_id is distinct from old.student_id
     or new.created_from_request_id is distinct from old.created_from_request_id
     or new.created_from_action_id is distinct from old.created_from_action_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
     or new.effective_from is distinct from old.effective_from
     or new.relationship_version <> old.relationship_version + 1 then
    raise exception 'f23_3e_p3c_relationship_binding_or_version_invalid';
  end if;
  if old.status in ('ENDED', 'ARCHIVED') then
    raise exception 'f23_3e_p3c_terminal_relationship_cannot_reactivate';
  end if;
  if new.status in ('ENDED', 'ARCHIVED') then
    new.effective_to := coalesce(new.effective_to, pg_catalog.transaction_timestamp());
  end if;
  new.updated_at := pg_catalog.transaction_timestamp();
  return new;
end;
$f23_3e_p3c_internal_guard_guardian_student_relationship$;

create trigger f23_3e_p3c_guardian_student_relationship_guard
before insert or update or delete on public.guardian_student_relationship
for each row execute function public.f23_3e_p3c_internal_guard_guardian_student_relationship();

-- Exact P3C0 byte encoders. All integers are unsigned/network order.
create function public.f23_3e_p3c_internal_u8(p_value integer)
returns bytea language plpgsql immutable strict set search_path = ''
as $f23_3e_p3c_internal_u8$
begin
  if p_value < 0 or p_value > 255 then raise exception 'CRYPTO_KEY_CONFIGURATION_INVALID'; end if;
  return pg_catalog.decode(pg_catalog.lpad(pg_catalog.to_hex(p_value), 2, '0'), 'hex');
end;
$f23_3e_p3c_internal_u8$;

create function public.f23_3e_p3c_internal_u16(p_value integer)
returns bytea language plpgsql immutable strict set search_path = ''
as $f23_3e_p3c_internal_u16$
begin
  if p_value < 0 or p_value > 65535 then raise exception 'CRYPTO_KEY_CONFIGURATION_INVALID'; end if;
  return pg_catalog.decode(pg_catalog.lpad(pg_catalog.to_hex(p_value), 4, '0'), 'hex');
end;
$f23_3e_p3c_internal_u16$;

create function public.f23_3e_p3c_internal_u32(p_value bigint)
returns bytea language plpgsql immutable strict set search_path = ''
as $f23_3e_p3c_internal_u32$
begin
  if p_value < 0 or p_value > 4294967295 then raise exception 'CRYPTO_KEY_CONFIGURATION_INVALID'; end if;
  return pg_catalog.decode(pg_catalog.lpad(pg_catalog.to_hex(p_value), 8, '0'), 'hex');
end;
$f23_3e_p3c_internal_u32$;

create function public.f23_3e_p3c_internal_lp32(p_value bytea)
returns bytea language sql immutable strict set search_path = ''
as $f23_3e_p3c_internal_lp32$
  select public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(p_value)) || p_value
$f23_3e_p3c_internal_lp32$;

create function public.f23_3e_p3c_internal_crypto_environment_fingerprint()
returns bytea
language plpgsql
volatile
security definer
set search_path = ''
as $f23_3e_p3c_internal_crypto_environment_fingerprint$
declare
  v_derived bytea;
begin
  begin
    v_derived := vault._crypto_aead_det_encrypt(
      pg_catalog.convert_to('ichess.p3c.environment.fingerprint.v1', 'UTF8'),
      pg_catalog.convert_to('ichess.p3c.environment.fingerprint.aad.v1', 'UTF8'),
      1::bigint,
      pg_catalog.convert_to('iC3Env01', 'UTF8'),
      pg_catalog.decode(pg_catalog.repeat('00', 16), 'hex')
    );
    if v_derived is null then raise exception 'missing derived material'; end if;
    return extensions.digest(v_derived, 'sha256');
  exception when others then
    raise exception 'CRYPTO_KEY_CONFIGURATION_INVALID';
  end;
end;
$f23_3e_p3c_internal_crypto_environment_fingerprint$;

create function public.f23_3e_p3c_internal_source_aad(
  p_center_id text, p_contact_id uuid, p_key_epoch integer
)
returns bytea
language sql stable strict set search_path = ''
as $f23_3e_p3c_internal_source_aad$
  select
    public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to('ichess.crm.contact.source-evidence.aead.v1', 'UTF8'))
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(2)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(public.f23_3e_p3c_internal_crypto_environment_fingerprint())
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_center_id, 'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_contact_id))
$f23_3e_p3c_internal_source_aad$;

create function public.f23_3e_p3c_internal_guardian_aad(
  p_center_id text, p_guardian_id uuid, p_key_epoch integer
)
returns bytea
language sql stable strict set search_path = ''
as $f23_3e_p3c_internal_guardian_aad$
  select
    public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to('ichess.guardian.target.contact-evidence.aead.v1', 'UTF8'))
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u8(1)
    || public.f23_3e_p3c_internal_u32(1)
    || public.f23_3e_p3c_internal_u32(p_key_epoch)
    || public.f23_3e_p3c_internal_lp32(public.f23_3e_p3c_internal_crypto_environment_fingerprint())
    || public.f23_3e_p3c_internal_lp32(pg_catalog.convert_to(p_center_id, 'UTF8'))
    || public.f23_3e_p3c_internal_lp32(pg_catalog.uuid_send(p_guardian_id))
$f23_3e_p3c_internal_guardian_aad$;

create function public.f23_3e_p3c_internal_parse_envelope(p_envelope bytea, p_magic text)
returns table(key_epoch integer, nonce bytea, sealed bytea)
language plpgsql immutable strict set search_path = ''
as $f23_3e_p3c_internal_parse_envelope$
declare
  v_epoch bigint;
  v_nonce_length integer;
  v_sealed_length bigint;
begin
  if p_magic not in ('IC3CSE01', 'IC3GTE01')
     or pg_catalog.octet_length(pg_catalog.convert_to(p_magic, 'UTF8')) <> 8
     or pg_catalog.octet_length(p_envelope) < 68
     or pg_catalog.substr(p_envelope, 1, 8) <> pg_catalog.convert_to(p_magic, 'UTF8')
     or pg_catalog.get_byte(p_envelope, 8) <> 1
     or pg_catalog.get_byte(p_envelope, 9) <> 1 then
    raise exception 'CONTACT_SOURCE_ENVELOPE_MALFORMED';
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
     or v_sealed_length > 65568
     or pg_catalog.octet_length(p_envelope) <> 36 + v_sealed_length then
    raise exception 'CONTACT_SOURCE_ENVELOPE_MALFORMED';
  end if;
  return query select v_epoch::integer,
    pg_catalog.substr(p_envelope, 17, 16),
    pg_catalog.substr(p_envelope, 37, v_sealed_length::integer);
end;
$f23_3e_p3c_internal_parse_envelope$;

create function public.f23_3e_p3c_internal_protect_contact_source_evidence(
  p_center_id text,
  p_contact_id uuid,
  p_expected_contact_version integer,
  p_trusted_payload bytea
)
returns table(contact_version integer, contact_methods_crypto_version integer)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_protect_contact_source_evidence$
declare
  v_contact public.crm_contact%rowtype;
  v_nonce bytea;
  v_sealed bytea;
  v_envelope bytea;
begin
  if p_center_id is null or p_contact_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_trusted_payload is null
     or pg_catalog.octet_length(p_trusted_payload) not between 1 and 65536 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id for update;
  if not found or v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_status = 'ARCHIVED' then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  begin
    v_nonce := vault._crypto_aead_det_noncegen();
    if pg_catalog.octet_length(v_nonce) <> 16 then raise exception 'bad nonce'; end if;
    v_sealed := vault._crypto_aead_det_encrypt(
      p_trusted_payload,
      public.f23_3e_p3c_internal_source_aad(p_center_id, p_contact_id, 1),
      1::bigint, pg_catalog.convert_to('iC3Src01', 'UTF8'), v_nonce
    );
    if pg_catalog.octet_length(v_sealed) not between 33 and 65568 then raise exception 'bad sealed'; end if;
    v_envelope := pg_catalog.convert_to('IC3CSE01', 'UTF8')
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u32(1)
      || public.f23_3e_p3c_internal_u16(16)
      || v_nonce
      || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))
      || v_sealed;
  exception when others then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end;
  update public.crm_contact c set
    protected_contact_methods_ciphertext = v_envelope,
    contact_methods_crypto_version = 2,
    contact_version = c.contact_version + 1
  where c.crm_contact_id = p_contact_id
  returning c.contact_version, c.contact_methods_crypto_version
    into contact_version, contact_methods_crypto_version;
  return next;
end;
$f23_3e_p3c_internal_protect_contact_source_evidence$;

create function public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
  p_center_id text, p_contact_id uuid, p_expected_contact_version integer
)
returns bytea
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_unwrap_contact_source_evidence$
declare
  v_contact public.crm_contact%rowtype;
  v_parsed record;
  v_payload bytea;
begin
  select c.* into v_contact from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id for share;
  if not found or v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_status = 'ARCHIVED'
     or v_contact.contact_methods_crypto_version <> 2 then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  begin
    select * into strict v_parsed
    from public.f23_3e_p3c_internal_parse_envelope(
      v_contact.protected_contact_methods_ciphertext, 'IC3CSE01'
    );
    v_payload := vault._crypto_aead_det_decrypt(
      v_parsed.sealed,
      public.f23_3e_p3c_internal_source_aad(p_center_id, p_contact_id, v_parsed.key_epoch),
      1::bigint, pg_catalog.convert_to('iC3Src01', 'UTF8'), v_parsed.nonce
    );
    if pg_catalog.octet_length(v_payload) not between 1 and 65536 then raise exception 'bad payload'; end if;
  exception when others then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end;
  return v_payload;
end;
$f23_3e_p3c_internal_unwrap_contact_source_evidence$;

create function public.f23_3e_p3c_internal_protect_target_evidence(
  p_center_id text,
  p_contact_id uuid,
  p_expected_contact_version integer,
  p_guardian_id uuid
)
returns table(protected_contact_methods_ciphertext bytea, contact_methods_crypto_version integer)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_protect_target_evidence$
declare
  v_payload bytea;
  v_nonce bytea;
  v_sealed bytea;
begin
  if p_guardian_id is null then raise exception 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE'; end if;
  v_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
    p_center_id, p_contact_id, p_expected_contact_version
  );
  begin
    v_nonce := vault._crypto_aead_det_noncegen();
    if pg_catalog.octet_length(v_nonce) <> 16 then raise exception 'bad nonce'; end if;
    v_sealed := vault._crypto_aead_det_encrypt(
      v_payload,
      public.f23_3e_p3c_internal_guardian_aad(p_center_id, p_guardian_id, 1),
      1::bigint, pg_catalog.convert_to('iC3Gdn01', 'UTF8'), v_nonce
    );
    if pg_catalog.octet_length(v_sealed) not between 33 and 65568 then
      raise exception 'bad sealed';
    end if;
    protected_contact_methods_ciphertext := pg_catalog.convert_to('IC3GTE01', 'UTF8')
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u32(1)
      || public.f23_3e_p3c_internal_u16(16)
      || v_nonce
      || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))
      || v_sealed;
    contact_methods_crypto_version := 1;
  exception when others then
    raise exception 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE';
  end;
  return next;
end;
$f23_3e_p3c_internal_protect_target_evidence$;

create function public.f23_3e_p3c_internal_validate_guardian_target_evidence(
  p_center_id text, p_guardian_id uuid, p_expected_guardian_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_validate_guardian_target_evidence$
declare
  v_guardian public.guardian_profile%rowtype;
  v_parsed record;
  v_payload bytea;
begin
  select g.* into v_guardian from public.guardian_profile g
  where g.center_id = p_center_id and g.guardian_id = p_guardian_id for share;
  if not found or v_guardian.guardian_version <> p_expected_guardian_version
     or v_guardian.guardian_status <> 'ACTIVE'
     or v_guardian.contact_methods_crypto_version <> 1 then return false; end if;
  begin
    select * into strict v_parsed from public.f23_3e_p3c_internal_parse_envelope(
      v_guardian.protected_contact_methods_ciphertext, 'IC3GTE01'
    );
    v_payload := vault._crypto_aead_det_decrypt(
      v_parsed.sealed,
      public.f23_3e_p3c_internal_guardian_aad(p_center_id, p_guardian_id, v_parsed.key_epoch),
      1::bigint, pg_catalog.convert_to('iC3Gdn01', 'UTF8'), v_parsed.nonce
    );
    return pg_catalog.octet_length(v_payload) between 1 and 65536;
  exception when others then return false;
  end;
end;
$f23_3e_p3c_internal_validate_guardian_target_evidence$;

-- P3C completes the finite relationship catalog and the typed mirrors that can
-- reference already-existing canonical targets. Create actions keep the typed
-- mirror NULL because their reservation target does not exist until P3D; the
-- immutable opaque target remains the exact preallocated UUID.
alter table public.crm_conversion_action
  drop constraint crm_conversion_action_relationship_action_shape_check,
  add constraint crm_conversion_action_relationship_action_shape_check
  check (
    (
      action_kind not in (
        'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
        'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
        'DO_NOT_CREATE_RELATIONSHIP'
      )
      and relationship_type is null and is_primary_contact is null
      and financial_contact_role is null and academic_contact_role is null
      and relationship_policy_version is null
      and guardian_student_relationship_id is null
      and expected_relationship_version is null
    )
    or (
      action_kind = 'DO_NOT_CREATE_RELATIONSHIP'
      and relationship_type is null and is_primary_contact is null
      and financial_contact_role is null and academic_contact_role is null
      and relationship_policy_version is not null
      and guardian_student_relationship_id is null
      and expected_relationship_version is null
    )
    or (
      action_kind in ('CREATE_RELATIONSHIP', 'REQUIRE_RELATIONSHIP_REVIEW')
      and relationship_type in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
      and is_primary_contact is not null
      and financial_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
      and academic_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
      and relationship_policy_version is not null
      and guardian_student_relationship_id is null
      and expected_relationship_version is null
    )
    or (
      action_kind in ('REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE')
      and relationship_type in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
      and is_primary_contact is not null
      and financial_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
      and academic_contact_role in ('PRIMARY', 'SECONDARY', 'NONE')
      and relationship_policy_version is not null
      and guardian_student_relationship_id is not null
      and expected_relationship_version is not null
    )
  );

alter table public.crm_conversion_action
  drop constraint crm_conversion_action_identity_binding_shape_check,
  add constraint crm_conversion_action_identity_binding_shape_check
  check (
    (
      action_kind in ('DO_NOT_CREATE_STUDENT', 'DO_NOT_CREATE_GUARDIAN')
      and match_review_id is null and profile_creation_reservation_id is null
      and target_adapter_namespace is null and opaque_target_id is null
      and expected_target_version is null
      and student_target_id is null and guardian_target_id is null
    )
    or (
      action_kind = 'CREATE_NEW_STUDENT'
      and match_review_id is not null and profile_creation_reservation_id is not null
      and target_adapter_namespace = 'canonical.student_profile.v1'
      and opaque_target_id is not null and expected_target_version is null
      and student_target_id is null and guardian_target_id is null
    )
    or (
      action_kind = 'CREATE_NEW_GUARDIAN'
      and match_review_id is not null and profile_creation_reservation_id is not null
      and target_adapter_namespace = 'canonical.guardian_profile.v1'
      and opaque_target_id is not null and expected_target_version is null
      and student_target_id is null and guardian_target_id is null
    )
    or (
      action_kind = 'REUSE_REVIEWED_STUDENT'
      and match_review_id is not null and profile_creation_reservation_id is null
      and target_adapter_namespace = 'canonical.student_profile.v1'
      and opaque_target_id is not null and expected_target_version is not null
      and student_target_id = opaque_target_id and guardian_target_id is null
    )
    or (
      action_kind = 'REUSE_REVIEWED_GUARDIAN'
      and match_review_id is not null and profile_creation_reservation_id is null
      and target_adapter_namespace = 'canonical.guardian_profile.v1'
      and opaque_target_id is not null and expected_target_version is not null
      and guardian_target_id = opaque_target_id and student_target_id is null
    )
    or action_kind in (
      'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
      'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
      'DO_NOT_CREATE_RELATIONSHIP'
    )
  ),
  add constraint crm_conversion_action_student_target_exact_center_fkey
    foreign key (center_id, student_target_id)
    references public.student_profile(center_id, student_id) on delete restrict,
  add constraint crm_conversion_action_guardian_target_exact_center_fkey
    foreign key (center_id, guardian_target_id)
    references public.guardian_profile(center_id, guardian_id) on delete restrict,
  add constraint crm_conversion_action_relationship_target_exact_center_fkey
    foreign key (center_id, guardian_student_relationship_id)
    references public.guardian_student_relationship(center_id, relationship_id) on delete restrict;

alter table public.crm_idempotency_registry
  drop constraint crm_idempotency_registry_p3_kind_check,
  add constraint crm_idempotency_registry_p3_kind_check
    check (p3_result_kind is null or p3_result_kind in (
      'CONVERSION_AUTHORITY', 'REAL_CONVERSION',
      'ACTION_PLAN_MATERIALIZATION', 'ACTION_PLAN_FINALIZATION'
    ));

create or replace function public.f23_3e_p3b_internal_is_safe_result_snapshot(p_snapshot jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $f23_3e_p3b_internal_is_safe_result_snapshot$
declare
  v_key text;
  v_type text;
begin
  if pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then return false; end if;
  v_type := p_snapshot ->> 'result_type';
  if v_type in ('ACCOUNT_SECURITY_CONTROL', 'STEP_UP_ASSERTION', 'CONVERSION_AUTHORITY') then
    for v_key in select e.key from pg_catalog.jsonb_each(p_snapshot) e loop
      if v_key not in (
        'result_schema_version', 'result_type', 'resource_id', 'resource_version',
        'resource_status', 'request_id', 'request_version', 'issued_at',
        'expires_at', 'terminal_at', 'correlation_id', 'outcome_code',
        'canonical_user_id', 'security_version', 'session_version'
      ) then return false; end if;
    end loop;
    return p_snapshot ? 'result_schema_version'
      and p_snapshot ->> 'result_schema_version' = '1'
      and p_snapshot ? 'resource_id'
      and p_snapshot ->> 'resource_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_snapshot ? 'resource_version'
      and p_snapshot ->> 'resource_version' ~ '^[1-9][0-9]*$'
      and p_snapshot ? 'resource_status'
      and p_snapshot ? 'correlation_id'
      and p_snapshot ->> 'correlation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and p_snapshot ? 'outcome_code'
      and p_snapshot ->> 'outcome_code' ~ '^[A-Z][A-Z0-9_]*$';
  end if;
  if v_type not in ('ACTION_PLAN_MATERIALIZATION', 'ACTION_PLAN_FINALIZATION') then
    return false;
  end if;
  for v_key in select e.key from pg_catalog.jsonb_each(p_snapshot) e loop
    if v_key not in (
      'result_schema_version', 'result_type', 'resource_id', 'resource_version',
      'resource_status', 'request_id', 'request_version',
      'guardian_action_id', 'guardian_action_version',
      'student_action_id', 'student_action_version',
      'relationship_action_id', 'relationship_action_version',
      'action_count', 'action_set_encoding_version', 'action_set_digest',
      'max_action_version', 'correlation_id', 'outcome_code'
    ) then return false; end if;
  end loop;
  return p_snapshot ->> 'result_schema_version' = '1'
    and p_snapshot ->> 'resource_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ->> 'request_id' = p_snapshot ->> 'resource_id'
    and p_snapshot ->> 'request_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ->> 'resource_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'request_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'guardian_action_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ->> 'student_action_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ->> 'relationship_action_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and p_snapshot ->> 'guardian_action_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'student_action_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'relationship_action_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'action_count' = '3'
    and p_snapshot ->> 'action_set_encoding_version' = '1'
    and p_snapshot ->> 'action_set_digest' ~ '^[0-9a-f]{64}$'
    and p_snapshot ->> 'max_action_version' ~ '^[1-9][0-9]*$'
    and p_snapshot ->> 'correlation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      (v_type = 'ACTION_PLAN_MATERIALIZATION'
       and p_snapshot ->> 'resource_status' = 'PROPOSED'
       and p_snapshot ->> 'outcome_code' = 'ACTION_PLAN_MATERIALIZED')
      or (v_type = 'ACTION_PLAN_FINALIZATION'
       and p_snapshot ->> 'resource_status' = 'REVIEWED'
       and p_snapshot ->> 'outcome_code' = 'ACTION_PLAN_FINALIZED')
    );
end;
$f23_3e_p3b_internal_is_safe_result_snapshot$;

create unique index crm_outbox_event_p3c_action_plan_version_uidx
  on public.crm_outbox_event(center_id, aggregate_kind, aggregate_id, event_version)
  where aggregate_kind = 'crm_conversion_action_plan';

create function public.f23_3e_p3c_internal_identity_mutex_keys(
  p_center_id text,
  p_identity_kind text,
  p_identity_policy_registry_id uuid,
  p_display_name_evidence text,
  p_birth_date_evidence date,
  p_contact_id uuid
)
returns bytea[]
language plpgsql
security definer
stable
set search_path = ''
as $f23_3e_p3c_internal_identity_mutex_keys$
declare
  v_policy public.crm_identity_policy_registry%rowtype;
  v_contact public.crm_contact%rowtype;
  v_key bytea;
  v_env bytea;
  v_normalized text;
  v_digest bytea;
  v_values bytea[] := array[]::bytea[];
  v_lookup bytea;
begin
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = p_center_id
    and p.identity_kind = p_identity_kind
    and p.identity_policy_registry_id = p_identity_policy_registry_id;
  if not found then raise exception 'MATCH_POLICY_STALE'; end if;
  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_env := public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  if v_env is distinct from v_policy.environment_fingerprint then raise exception 'MATCH_POLICY_STALE'; end if;
  v_normalized := public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence);
  if p_identity_kind = 'STUDENT' then
    v_digest := public.f23_3e_p2b_internal_evidence_digest(
      v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
      'STUDENT', 'STUDENT_DISPLAY_NAME', v_normalized, v_policy.digest_key_epoch
    );
    v_values := v_values || public.f23_3e_p2b_internal_mutex_key(
      v_key, v_env, p_center_id, 'STUDENT', v_policy.normalization_version, v_digest
    );
    v_digest := public.f23_3e_p2b_internal_evidence_digest(
      v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
      'STUDENT', 'STUDENT_BIRTH_DATE',
      public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence),
      v_policy.digest_key_epoch
    );
    v_values := v_values || public.f23_3e_p2b_internal_mutex_key(
      v_key, v_env, p_center_id, 'STUDENT', v_policy.normalization_version, v_digest
    );
  elsif p_identity_kind = 'GUARDIAN' then
    select c.* into v_contact from public.crm_contact c
    where c.center_id = p_center_id and c.crm_contact_id = p_contact_id;
    if not found then raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE'; end if;
    v_digest := public.f23_3e_p2b_internal_evidence_digest(
      v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
      'GUARDIAN', 'GUARDIAN_DISPLAY_NAME', v_normalized, v_policy.digest_key_epoch
    );
    v_values := v_values || public.f23_3e_p2b_internal_mutex_key(
      v_key, v_env, p_center_id, 'GUARDIAN', v_policy.normalization_version, v_digest
    );
    foreach v_lookup in array v_contact.normalized_lookup_digests loop
      v_digest := public.f23_3e_p2b_internal_evidence_digest(
        v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
        'GUARDIAN', 'GUARDIAN_CONTACT_LOOKUP_DIGEST',
        pg_catalog.encode(v_lookup, 'hex'), v_policy.digest_key_epoch
      );
      v_values := v_values || public.f23_3e_p2b_internal_mutex_key(
        v_key, v_env, p_center_id, 'GUARDIAN', v_policy.normalization_version, v_digest
      );
    end loop;
    v_digest := public.f23_3e_p2b_internal_evidence_digest(
      v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
      'GUARDIAN', 'GUARDIAN_SOURCE_BINDING', p_contact_id::text, v_policy.digest_key_epoch
    );
    v_values := v_values || public.f23_3e_p2b_internal_mutex_key(
      v_key, v_env, p_center_id, 'GUARDIAN', v_policy.normalization_version, v_digest
    );
  else
    raise exception 'INVALID_INPUT';
  end if;
  select pg_catalog.array_agg(x.v order by x.v) into v_values
  from (select distinct pg_catalog.unnest(v_values) v) x;
  if pg_catalog.cardinality(v_values) < 2 then raise exception 'f23_3e_p3c_mutex_domain_collision'; end if;
  return v_values;
end;
$f23_3e_p3c_internal_identity_mutex_keys$;

create function public.f23_3e_p3c_internal_guardian_secondary_evidence_digest(
  p_key bytea, p_center_id text, p_contact_id uuid
)
returns bytea
language sql
stable
security definer
set search_path = ''
as $f23_3e_p3c_internal_guardian_secondary_evidence_digest$
  select extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'domain', 'f23.3e.p3c.guardian-secondary-evidence.v1',
      'center_id', p_center_id,
      'contact_id', p_contact_id,
      'lookup_digests', (
        select pg_catalog.jsonb_agg(pg_catalog.encode(v, 'hex') order by v)
        from public.crm_contact c, pg_catalog.unnest(c.normalized_lookup_digests) v
        where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
      )
    )::text, 'UTF8'), p_key, 'sha256'
  )
$f23_3e_p3c_internal_guardian_secondary_evidence_digest$;

create function public.f23_3e_p3c_internal_resolve_reusable_student(
  p_center_id text,
  p_source_candidate_student_id uuid,
  p_student_id uuid,
  p_expected_student_version integer,
  p_match_review_id uuid
)
returns table(reuse_eligible boolean, student_id uuid, student_version integer)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_resolve_reusable_student$
declare
  v_student public.student_profile%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_binding public.crm_identity_target_binding%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
begin
  select s.* into v_student from public.student_profile s
  where s.center_id = p_center_id and s.student_id = p_student_id for share;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = p_center_id and c.candidate_student_id = p_source_candidate_student_id for share;
  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = p_center_id and r.match_review_id = p_match_review_id for share;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = p_center_id
    and r.conversion_request_id = v_review.conversion_request_id for share;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = p_center_id and p.identity_kind = 'STUDENT'
    and p.identity_policy_registry_id = v_review.identity_policy_registry_id
    and p.status = 'CURRENT' for share;
  select b.* into v_binding from public.crm_identity_target_binding b
  where b.center_id = p_center_id and b.identity_kind = 'STUDENT'
    and b.source_candidate_student_id = p_source_candidate_student_id
    and b.student_id = p_student_id and b.binding_status = 'ACTIVE' for share;
  reuse_eligible := v_student.student_id is not null
    and v_student.profile_status = 'ACTIVE'
    and v_student.student_version = p_expected_student_version
    and v_candidate.candidate_student_id is not null
    and v_candidate.consultation_case_id = v_review.consultation_case_id
    and v_candidate.candidate_version = v_review.source_candidate_version
    and v_review.match_review_id is not null
    and v_review.identity_kind = 'STUDENT'
    and v_review.candidate_student_id = p_source_candidate_student_id
    and v_review.review_status = 'EXACT_REVIEWED_MATCH'
    and v_review.review_action = 'REUSE_EXISTING'
    and v_review.expires_at > pg_catalog.transaction_timestamp()
    and v_review.target_adapter_namespace = 'canonical.student_profile.v1'
    and v_review.opaque_target_id = p_student_id
    and v_review.target_version = p_expected_student_version
    and v_request.conversion_request_id = v_review.conversion_request_id
    and v_request.consultation_case_id = v_review.consultation_case_id
    and v_request.source_contact_id = v_review.crm_contact_id
    and v_request.source_contact_version = v_review.source_contact_version
    and v_request.source_case_version = v_review.source_case_version
    and v_request.action_graph_digest is not distinct from v_review.request_action_graph_digest
    and v_policy.identity_policy_registry_id = v_review.identity_policy_registry_id
    and v_policy.normalization_version = v_review.normalization_version
    and v_policy.match_policy_version = v_review.match_policy_version
    and v_policy.minimum_evidence_policy_version = v_review.minimum_evidence_policy_version
    and v_binding.identity_target_binding_id is not null
    and v_binding.originating_request_id = v_review.conversion_request_id
    and v_binding.originating_review_id = v_review.match_review_id
    and v_binding.source_version_at_binding = v_candidate.candidate_version
    and v_binding.target_version_at_binding = v_student.student_version;
  student_id := case when reuse_eligible then v_student.student_id else null end;
  student_version := case when reuse_eligible then v_student.student_version else null end;
  return next;
end;
$f23_3e_p3c_internal_resolve_reusable_student$;

create function public.f23_3e_p3c_internal_resolve_reusable_guardian(
  p_center_id text,
  p_source_contact_id uuid,
  p_guardian_id uuid,
  p_expected_guardian_version integer,
  p_match_review_id uuid
)
returns table(reuse_eligible boolean, guardian_id uuid, guardian_version integer)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_resolve_reusable_guardian$
declare
  v_guardian public.guardian_profile%rowtype;
  v_contact public.crm_contact%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_binding public.crm_identity_target_binding%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
begin
  select g.* into v_guardian from public.guardian_profile g
  where g.center_id = p_center_id and g.guardian_id = p_guardian_id for share;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_source_contact_id for share;
  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = p_center_id and r.match_review_id = p_match_review_id for share;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = p_center_id
    and r.conversion_request_id = v_review.conversion_request_id for share;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = p_center_id and p.identity_kind = 'GUARDIAN'
    and p.identity_policy_registry_id = v_review.identity_policy_registry_id
    and p.status = 'CURRENT' for share;
  select b.* into v_binding from public.crm_identity_target_binding b
  where b.center_id = p_center_id and b.identity_kind = 'GUARDIAN'
    and b.source_contact_id = p_source_contact_id
    and b.guardian_id = p_guardian_id and b.binding_status = 'ACTIVE' for share;
  reuse_eligible := v_guardian.guardian_id is not null
    and v_guardian.guardian_status = 'ACTIVE'
    and v_guardian.guardian_version = p_expected_guardian_version
    and public.f23_3e_p3c_internal_validate_guardian_target_evidence(
      p_center_id, p_guardian_id, p_expected_guardian_version
    )
    and v_contact.crm_contact_id is not null
    and v_contact.contact_version = v_review.source_contact_version
    and v_review.match_review_id is not null
    and v_review.identity_kind = 'GUARDIAN'
    and v_review.crm_contact_id = p_source_contact_id
    and v_review.review_status = 'EXACT_REVIEWED_MATCH'
    and v_review.review_action = 'REUSE_EXISTING'
    and v_review.expires_at > pg_catalog.transaction_timestamp()
    and v_review.target_adapter_namespace = 'canonical.guardian_profile.v1'
    and v_review.opaque_target_id = p_guardian_id
    and v_review.target_version = p_expected_guardian_version
    and v_request.conversion_request_id = v_review.conversion_request_id
    and v_request.consultation_case_id = v_review.consultation_case_id
    and v_request.source_contact_id = v_review.crm_contact_id
    and v_request.source_contact_version = v_review.source_contact_version
    and v_request.source_case_version = v_review.source_case_version
    and v_request.action_graph_digest is not distinct from v_review.request_action_graph_digest
    and v_policy.identity_policy_registry_id = v_review.identity_policy_registry_id
    and v_policy.normalization_version = v_review.normalization_version
    and v_policy.match_policy_version = v_review.match_policy_version
    and v_policy.minimum_evidence_policy_version = v_review.minimum_evidence_policy_version
    and v_binding.identity_target_binding_id is not null
    and v_binding.originating_request_id = v_review.conversion_request_id
    and v_binding.originating_review_id = v_review.match_review_id
    and v_binding.source_version_at_binding = v_contact.contact_version
    and v_binding.target_version_at_binding = v_guardian.guardian_version;
  guardian_id := case when reuse_eligible then v_guardian.guardian_id else null end;
  guardian_version := case when reuse_eligible then v_guardian.guardian_version else null end;
  return next;
end;
$f23_3e_p3c_internal_resolve_reusable_guardian$;

create function public.f23_3e_p3c_internal_create_student_target(
  p_conversion_action_id uuid,
  p_actor_user_id uuid,
  p_display_name_evidence text,
  p_birth_date_evidence date
)
returns table(student_id uuid, student_version integer)
language plpgsql
security definer
set search_path = ''
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
  v_mutexes := public.f23_3e_p3c_internal_identity_mutex_keys(
    v_selector.center_id, 'STUDENT', v_policy.identity_policy_registry_id,
    p_display_name_evidence, p_birth_date_evidence, null
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
    public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence),
    v_policy.digest_key_epoch
  );
  v_identity_digest := extensions.digest(
    v_review.evidence_set_digest || v_reservation.source_evidence_digest
      || v_name_digest || v_birth_digest, 'sha256'
  );
  insert into public.student_profile(
    student_id, center_id, display_name, birth_evidence_protected,
    profile_status, learning_lifecycle_status, identity_policy_registry_id,
    normalization_version, match_policy_version, minimum_evidence_policy_version,
    name_lookup_digest, birth_lookup_digest, identity_evidence_digest,
    student_version, created_from_case_id, created_from_candidate_id,
    created_from_request_id, created_from_action_id, created_by_user_id
  ) values (
    v_reservation.preallocated_target_id, v_selector.center_id,
    p_display_name_evidence, v_candidate.birth_evidence_protected,
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

create function public.f23_3e_p3c_internal_create_guardian_target(
  p_conversion_action_id uuid,
  p_actor_user_id uuid
)
returns table(guardian_id uuid, guardian_version integer)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_create_guardian_target$
declare
  v_selector record;
  v_root public.center_crm_control%rowtype;
  v_action public.crm_conversion_action%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_contact public.crm_contact%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_existing public.guardian_profile%rowtype;
  v_protected record;
  v_key bytea;
  v_name_digest bytea;
  v_lookup bytea[];
  v_identity_digest bytea;
  v_mutexes bytea[];
  v_mutex bytea;
begin
  select a.center_id, a.conversion_request_id, a.source_contact_id
  into v_selector from public.crm_conversion_action a
  where a.conversion_action_id = p_conversion_action_id;
  if not found or p_actor_user_id is null then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_selector.center_id for update;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_selector.center_id and c.crm_contact_id = v_selector.source_contact_id;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = v_selector.center_id and p.identity_kind = 'GUARDIAN'
    and p.status = 'CURRENT' for share;
  if not found or v_contact.crm_contact_id is null
     or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    raise exception 'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE';
  end if;
  v_mutexes := public.f23_3e_p3c_internal_identity_mutex_keys(
    v_selector.center_id, 'GUARDIAN', v_policy.identity_policy_registry_id,
    v_contact.display_name, null, v_contact.crm_contact_id
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
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_selector.center_id and c.crm_contact_id = v_action.source_contact_id for update;
  select r.* into v_review from public.crm_identity_match_review r
  where r.center_id = v_selector.center_id and r.match_review_id = v_action.match_review_id for share;
  select r.* into v_reservation from public.crm_profile_creation_reservation r
  where r.center_id = v_selector.center_id
    and r.reservation_id = v_action.profile_creation_reservation_id for update;
  if v_action.action_kind <> 'CREATE_NEW_GUARDIAN' or v_action.status <> 'APPROVED'
     or v_action.identity_kind <> 'GUARDIAN'
     or v_action.conversion_request_id <> v_request.conversion_request_id
     or v_action.source_contact_id <> v_contact.crm_contact_id
     or v_action.match_review_id <> v_review.match_review_id
     or v_action.profile_creation_reservation_id <> v_reservation.reservation_id
     or v_action.opaque_target_id is distinct from v_reservation.preallocated_target_id
     or v_action.target_adapter_namespace <> 'canonical.guardian_profile.v1'
     or v_review.review_status <> 'CREATE_NEW_REVIEWED'
     or v_review.review_action <> 'PREPARE_CREATE_NEW'
     or v_review.match_outcome <> 'NO_MATCH'
     or v_review.conversion_request_id <> v_request.conversion_request_id
     or v_review.consultation_case_id <> v_request.consultation_case_id
     or v_review.crm_contact_id <> v_contact.crm_contact_id
     or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_review.source_case_version <> v_request.source_case_version
     or v_review.expires_at <= pg_catalog.transaction_timestamp()
     or v_reservation.status <> 'ACTIVE'
     or v_reservation.entity_kind <> 'GUARDIAN'
     or v_reservation.conversion_request_id <> v_request.conversion_request_id
     or v_reservation.match_review_id <> v_review.match_review_id
     or v_reservation.request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_reservation.target_adapter_namespace <> 'canonical.guardian_profile.v1'
     or v_reservation.expires_at <= pg_catalog.transaction_timestamp()
     or v_contact.display_name is null
     or pg_catalog.length(pg_catalog.btrim(v_contact.display_name)) not between 1 and 240
     or v_contact.contact_version <> v_review.source_contact_version
     or v_contact.contact_version <> v_request.source_contact_version
     or v_request.action_graph_digest is distinct from v_action.legacy_request_action_graph_digest
     or v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version
     or v_policy.identity_policy_registry_id <> v_reservation.identity_policy_registry_id
     or v_policy.normalization_version <> v_reservation.normalization_version
     or v_policy.match_policy_version <> v_reservation.match_policy_version
     or v_policy.minimum_evidence_policy_version <> v_reservation.minimum_evidence_policy_version then
    raise exception 'CREATE_GUARDIAN_TARGET_EVIDENCE_STALE';
  end if;
  select g.* into v_existing from public.guardian_profile g
  where g.center_id = v_selector.center_id and g.guardian_id = v_reservation.preallocated_target_id for share;
  if found then
    if v_existing.created_from_action_id = p_conversion_action_id then
      guardian_id := v_existing.guardian_id; guardian_version := v_existing.guardian_version; return next; return;
    end if;
    raise exception 'TARGET_ALREADY_EXISTS';
  end if;
  select * into strict v_protected from public.f23_3e_p3c_internal_protect_target_evidence(
    v_selector.center_id, v_contact.crm_contact_id, v_contact.contact_version,
    v_reservation.preallocated_target_id
  );
  if v_protected.protected_contact_methods_ciphertext = v_contact.protected_contact_methods_ciphertext then
    raise exception 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE';
  end if;
  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_name_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    'GUARDIAN', 'GUARDIAN_DISPLAY_NAME',
    public.f23_3e_p2b_internal_normalize_student_name_v1(v_contact.display_name),
    v_policy.digest_key_epoch
  );
  select pg_catalog.array_agg(x.v order by x.v) into v_lookup
  from (
    select distinct v_name_digest v
    union
    select distinct d from pg_catalog.unnest(v_contact.normalized_lookup_digests) d
  ) x;
  v_identity_digest := extensions.digest(
    v_review.evidence_set_digest || v_reservation.source_evidence_digest
      || public.f23_3e_p3c_internal_crypto_environment_fingerprint(), 'sha256'
  );
  insert into public.guardian_profile(
    guardian_id, center_id, display_name, protected_contact_methods_ciphertext,
    contact_methods_crypto_version, normalized_lookup_digests,
    normalization_version, identity_evidence_digest, guardian_status,
    guardian_version, created_from_contact_id, created_from_case_id,
    created_from_request_id, created_from_action_id, created_by_user_id
  ) values (
    v_reservation.preallocated_target_id, v_selector.center_id,
    v_contact.display_name,
    v_protected.protected_contact_methods_ciphertext,
    v_protected.contact_methods_crypto_version, v_lookup,
    v_policy.normalization_version, v_identity_digest, 'ACTIVE', 1,
    v_contact.crm_contact_id, v_request.consultation_case_id,
    v_request.conversion_request_id, p_conversion_action_id, p_actor_user_id
  ) returning public.guardian_profile.guardian_id, public.guardian_profile.guardian_version
    into guardian_id, guardian_version;
  return next;
exception when others then
  if sqlerrm in ('GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE', 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE') then
    raise exception '%', sqlerrm;
  end if;
  raise;
end;
$f23_3e_p3c_internal_create_guardian_target$;

create function public.f23_3e_p3c_internal_upsert_guardian_student_relationship(
  p_conversion_action_id uuid,
  p_actor_user_id uuid
)
returns table(relationship_id uuid, relationship_version integer, outcome_code text)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_internal_upsert_guardian_student_relationship$
declare
  v_selector record;
  v_root public.center_crm_control%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_action public.crm_conversion_action%rowtype;
  v_guardian_action public.crm_conversion_action%rowtype;
  v_student_action public.crm_conversion_action%rowtype;
  v_existing public.guardian_student_relationship%rowtype;
  v_guardian public.guardian_profile%rowtype;
  v_student public.student_profile%rowtype;
  v_guardian_id uuid;
  v_student_id uuid;
begin
  if p_actor_user_id is null then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select a.center_id, a.conversion_request_id into v_selector
  from public.crm_conversion_action a
  where a.conversion_action_id = p_conversion_action_id;
  if not found then raise exception 'RESOURCE_NOT_AVAILABLE'; end if;
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_selector.center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    raise exception 'CRM_RUNTIME_NOT_ACTIVE';
  end if;
  perform m.identity_match_mutex_key from public.crm_identity_match_mutex m
  where m.center_id = v_selector.center_id and m.status = 'ACTIVE'
  order by m.identity_kind, m.identity_match_mutex_key for update;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_selector.center_id
    and r.conversion_request_id = v_selector.conversion_request_id for update;
  select a.* into v_action from public.crm_conversion_action a
  where a.center_id = v_selector.center_id
    and a.conversion_request_id = v_request.conversion_request_id
    and a.conversion_action_id = p_conversion_action_id for update;
  if not found or v_action.status <> 'APPROVED'
     or v_action.action_kind not in (
       'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
       'UPDATE_APPROVED_RELATIONSHIP_ROLE'
     )
     or v_request.action_graph_digest is distinct from v_action.legacy_request_action_graph_digest
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_action.relationship_policy_version <> v_request.relationship_policy_version then
    raise exception 'RELATIONSHIP_DECISION_REQUIRED';
  end if;
  perform a.conversion_action_id from public.crm_conversion_action a
  where a.center_id = v_action.center_id
    and a.conversion_request_id = v_action.conversion_request_id
    and a.conversion_action_id in (v_action.guardian_action_id, v_action.student_action_id)
  order by a.conversion_action_id for update;
  select a.* into v_guardian_action from public.crm_conversion_action a
  where a.center_id = v_action.center_id and a.conversion_request_id = v_action.conversion_request_id
    and a.conversion_action_id = v_action.guardian_action_id for share;
  select a.* into v_student_action from public.crm_conversion_action a
  where a.center_id = v_action.center_id and a.conversion_request_id = v_action.conversion_request_id
    and a.conversion_action_id = v_action.student_action_id for share;
  if v_guardian_action.conversion_action_id is null
     or v_student_action.conversion_action_id is null
     or v_guardian_action.status <> 'APPROVED'
     or v_student_action.status <> 'APPROVED'
     or v_guardian_action.identity_kind <> 'GUARDIAN'
     or v_student_action.identity_kind <> 'STUDENT'
     or v_guardian_action.legacy_request_action_graph_digest is distinct from v_request.action_graph_digest
     or v_student_action.legacy_request_action_graph_digest is distinct from v_request.action_graph_digest then
    raise exception 'TARGET_VERSION_STALE';
  end if;
  v_guardian_id := coalesce(v_guardian_action.guardian_target_id, v_guardian_action.opaque_target_id);
  v_student_id := coalesce(v_student_action.student_target_id, v_student_action.opaque_target_id);
  select g.* into v_guardian from public.guardian_profile g
  where g.center_id = v_action.center_id and g.guardian_id = v_guardian_id
    and g.guardian_status = 'ACTIVE' for share;
  select s.* into v_student from public.student_profile s
  where s.center_id = v_action.center_id and s.student_id = v_student_id
    and s.profile_status = 'ACTIVE' for share;
  if v_guardian.guardian_id is null or v_student.student_id is null
     or v_guardian.guardian_version <> coalesce(v_guardian_action.expected_target_version, 1)
     or v_student.student_version <> coalesce(v_student_action.expected_target_version, 1) then
    raise exception 'TARGET_VERSION_STALE';
  end if;
  perform pg_catalog.set_config('ichess.p3c_relationship_write', 'on', true);
  if v_action.action_kind = 'CREATE_RELATIONSHIP' then
    insert into public.guardian_student_relationship(
      center_id, guardian_id, student_id, relationship_type, is_primary_contact,
      financial_contact_role, academic_contact_role, status, relationship_version,
      created_from_request_id, created_from_action_id, created_by_user_id
    ) values (
      v_action.center_id, v_guardian_id, v_student_id, v_action.relationship_type,
      v_action.is_primary_contact, v_action.financial_contact_role,
      v_action.academic_contact_role, 'ACTIVE', 1,
      v_action.conversion_request_id, v_action.conversion_action_id, p_actor_user_id
    ) returning public.guardian_student_relationship.relationship_id,
        public.guardian_student_relationship.relationship_version
      into relationship_id, relationship_version;
    outcome_code := 'RELATIONSHIP_CREATED'; return next; return;
  end if;
  select r.* into v_existing from public.guardian_student_relationship r
  where r.center_id = v_action.center_id
    and r.relationship_id = v_action.guardian_student_relationship_id for update;
  if not found or v_existing.guardian_id <> v_guardian_id or v_existing.student_id <> v_student_id
     or v_existing.status <> 'ACTIVE'
     or v_existing.relationship_version <> v_action.expected_relationship_version then
    raise exception 'RELATIONSHIP_VERSION_STALE';
  end if;
  if v_action.action_kind = 'REUSE_EXISTING_RELATIONSHIP' then
    if v_existing.relationship_type <> v_action.relationship_type
       or v_existing.is_primary_contact <> v_action.is_primary_contact
       or v_existing.financial_contact_role <> v_action.financial_contact_role
       or v_existing.academic_contact_role <> v_action.academic_contact_role then
      raise exception 'RELATIONSHIP_VERSION_STALE';
    end if;
    relationship_id := v_existing.relationship_id;
    relationship_version := v_existing.relationship_version;
    outcome_code := 'RELATIONSHIP_REUSED'; return next; return;
  end if;
  update public.guardian_student_relationship r set
    relationship_type = v_action.relationship_type,
    is_primary_contact = v_action.is_primary_contact,
    financial_contact_role = v_action.financial_contact_role,
    academic_contact_role = v_action.academic_contact_role,
    relationship_version = r.relationship_version + 1
  where r.relationship_id = v_existing.relationship_id
  returning r.relationship_id, r.relationship_version
    into relationship_id, relationship_version;
  outcome_code := 'RELATIONSHIP_UPDATED'; return next;
end;
$f23_3e_p3c_internal_upsert_guardian_student_relationship$;

-- Frozen P2B implementation retained as the legacy Student projection. The
-- public internal dispatch below composes canonical targets without changing
-- either external P2B signature.
create function public.f23_3e_p3c_internal_p2b_checkpoint_search(
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
as $f23_3e_p3c_internal_p2b_checkpoint_search$
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
$f23_3e_p3c_internal_p2b_checkpoint_search$;

create or replace function public.f23_3e_p2b_internal_search_masked_candidates(
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
  v_base jsonb;
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_key bytea;
  v_env bytea;
  v_name_digest bytea;
  v_birth_digest bytea;
  v_mutexes bytea[];
  v_mutex bytea;
  v_candidates jsonb := '[]'::jsonb;
  v_row record;
  v_row_digest bytea;
  v_adapter_digest bytea;
  v_evidence_digest bytea;
  v_mutex_digest bytea;
  v_projection_digest bytea;
  v_adapter_material text := '';
  v_exact_count integer := 0;
  v_same_name_count integer := 0;
  v_member_role text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_expires_at timestamptz;
  v_detail_is_canonical boolean := false;
  v_reuse boolean;
  v_payload bytea;
begin
  perform pg_catalog.set_config('lock_timeout', '2000ms', true);
  if p_identity_kind = 'STUDENT' then
    if p_detail_opaque_candidate_id is not null then
      select exists(
        select 1 from public.student_profile s
        join public.crm_conversion_request r on r.center_id = s.center_id
        where r.conversion_request_id = p_conversion_request_id
          and s.student_id = p_detail_opaque_candidate_id
      ) into v_detail_is_canonical;
    end if;
    v_base := public.f23_3e_p3c_internal_p2b_checkpoint_search(
      p_conversion_request_id, p_actor_user_id, p_expected_request_version,
      p_identity_kind, p_candidate_student_id, p_expected_contact_version,
      p_expected_case_version, p_expected_candidate_version,
      p_display_name_evidence, p_birth_date_evidence, p_birth_year_evidence,
      p_expected_normalization_version, p_expected_match_policy_version,
      p_expected_minimum_evidence_policy_version, p_expected_policy_registry_version,
      p_expected_adapter_version,
      case when v_detail_is_canonical then null else p_detail_opaque_candidate_id end,
      case when v_detail_is_canonical then null else p_expected_target_version end
    );
    if coalesce((v_base ->> 'ok')::boolean, false) is not true then return v_base; end if;
    -- A detail request for a checkpoint legacy candidate remains entirely in
    -- the immutable legacy adapter.  General search below composes legacy
    -- detection with the canonical Student adapter without rebinding either.
    if p_detail_opaque_candidate_id is not null and not v_detail_is_canonical then
      return v_base;
    end if;
    v_center_id := (select r.center_id from public.crm_conversion_request r
      where r.conversion_request_id = p_conversion_request_id);
    select p.* into v_policy from public.crm_identity_policy_registry p
    where p.identity_policy_registry_id = (v_base ->> 'identity_policy_registry_id')::uuid;
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
      public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence),
      v_policy.digest_key_epoch
    );
    if not v_detail_is_canonical then v_candidates := coalesce(v_base -> 'candidates', '[]'::jsonb); end if;
    for v_row in
      select s.*, exists(
        select 1 from public.crm_identity_target_binding b
        where b.center_id = s.center_id and b.identity_kind = 'STUDENT'
          and b.source_candidate_student_id = p_candidate_student_id
          and b.student_id = s.student_id and b.binding_status = 'ACTIVE'
          and b.source_version_at_binding = p_expected_candidate_version
          and b.target_version_at_binding = s.student_version
      ) binding_current
      from public.student_profile s
      where s.center_id = v_center_id and s.profile_status = 'ACTIVE'
        and s.identity_policy_registry_id = v_policy.identity_policy_registry_id
        and s.normalization_version = v_policy.normalization_version
        and (not v_detail_is_canonical or s.student_id = p_detail_opaque_candidate_id)
      order by s.student_id for share of s
    loop
      v_row_digest := extensions.hmac(
        pg_catalog.convert_to(pg_catalog.jsonb_build_object(
          'adapter_namespace', 'canonical.student_profile.v1',
          'adapter_version', 1, 'center_id', v_center_id,
          'target_id', v_row.student_id, 'target_version', v_row.student_version,
          'status', v_row.profile_status, 'binding_current', v_row.binding_current
        )::text, 'UTF8'), v_key, 'sha256'
      );
      v_adapter_material := v_adapter_material || pg_catalog.encode(v_row_digest, 'hex');
      if v_row.name_lookup_digest = v_name_digest then
        v_same_name_count := v_same_name_count + 1;
        if v_row.birth_lookup_digest = v_birth_digest then
          v_exact_count := v_exact_count + 1;
          if v_detail_is_canonical and v_row.student_version <> p_expected_target_version then
            return public.f23_3e_p2b_internal_safe_result('TARGET_VERSION_STALE');
          end if;
          if pg_catalog.jsonb_array_length(v_candidates) < 10 then
            v_candidates := v_candidates || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
              'candidate_projection_version', 1, 'identity_kind', 'STUDENT',
              'opaque_candidate_id', v_row.student_id, 'opaque_target_id', v_row.student_id,
              'target_adapter_namespace', 'canonical.student_profile.v1',
              'target_version', v_row.student_version,
              'masked_attributes', pg_catalog.jsonb_build_array('IDENTITY_REDACTED'),
              'safe_attributes', pg_catalog.jsonb_build_array('CURRENT_CANONICAL_STUDENT'),
              'evidence_summary_codes', pg_catalog.jsonb_build_array('DISPLAY_NAME_EXACT', 'BIRTH_DATE_EXACT'),
              'match_reason_codes', pg_catalog.jsonb_build_array('NAME_AND_BIRTH_EXACT_CANDIDATE'),
              'normalization_version', v_policy.normalization_version,
              'match_policy_version', v_policy.match_policy_version,
              'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
              'adapter_snapshot_version', 1,
              'target_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_row_digest),
              'reuse_eligible', v_row.binding_current,
              'create_authority', false
            ));
          end if;
        end if;
      end if;
    end loop;
    if v_detail_is_canonical and pg_catalog.jsonb_array_length(v_candidates) <> 1 then
      return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
    end if;
    v_adapter_digest := extensions.hmac(
      pg_catalog.convert_to(pg_catalog.jsonb_build_object(
        'domain', 'f23.3e.p3c.student-adapter.v1',
        'legacy_snapshot', v_base -> 'adapter_snapshot_reference',
        'canonical_snapshots', v_adapter_material
      )::text, 'UTF8'), v_key, 'sha256'
    );
    v_projection_digest := extensions.hmac(
      pg_catalog.convert_to(pg_catalog.jsonb_build_object(
        'domain', 'f23.3e.p3c.student-projection.v1',
        'checkpoint_projection', v_base -> 'projection_snapshot_reference',
        'combined_adapter', pg_catalog.encode(v_adapter_digest, 'hex'),
        'candidates', v_candidates,
        'canonical_exact_count', v_exact_count,
        'canonical_same_name_count', v_same_name_count
      )::text, 'UTF8'), v_key, 'sha256'
    );
    if v_exact_count = 0 and v_same_name_count = 0 then
      return v_base || pg_catalog.jsonb_build_object(
        'candidates', v_candidates,
        'candidate_count_capped', pg_catalog.jsonb_array_length(v_candidates),
        'target_adapter_namespace', 'canonical.student_profile.v1',
        'target_adapter_version', 1,
        'adapter_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_adapter_digest),
        'projection_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_projection_digest),
        'reuse_eligible', false, 'create_authority', false
      );
    end if;
    return v_base || pg_catalog.jsonb_build_object(
      'outcome_code', 'MATCH_REVIEW_REQUIRED',
      'match_outcome', case when v_exact_count > 0 then 'PROBABLE_MATCH' else 'CONFLICT' end,
      'review_requirement', 'MATCH_REVIEW_REQUIRED',
      'safe_reason_code', case when v_exact_count > 0 then 'NAME_AND_BIRTH_EXACT_CANDIDATE' else 'CONTRADICTORY_EVIDENCE' end,
      'candidates', v_candidates,
      'candidate_count_capped', pg_catalog.jsonb_array_length(v_candidates),
      'target_adapter_namespace', 'canonical.student_profile.v1',
      'target_adapter_version', 1,
      'adapter_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_adapter_digest),
      'projection_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_projection_digest),
      'reuse_eligible', false, 'create_authority', false
    );
  end if;

  if p_identity_kind <> 'GUARDIAN'
     or p_conversion_request_id is null or p_actor_user_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_candidate_student_id is null
     or p_expected_contact_version is null or p_expected_contact_version < 1
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_candidate_version is null or p_expected_candidate_version < 1
     or p_display_name_evidence is null
     or p_expected_normalization_version is null or p_expected_normalization_version < 1
     or p_expected_match_policy_version is null or p_expected_match_policy_version < 1
     or p_expected_minimum_evidence_policy_version is null or p_expected_minimum_evidence_policy_version < 1
     or p_expected_policy_registry_version is null or p_expected_policy_registry_version < 1
     or p_expected_adapter_version <> 1
     or ((p_detail_opaque_candidate_id is null) <> (p_expected_target_version is null)) then
    return public.f23_3e_p2b_internal_safe_result('INVALID_INPUT');
  end if;
  select r.center_id into v_center_id from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE'); end if;
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  if not found or v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  select pg_catalog.lower(m.role) into v_member_role from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id and m.status = 'active'
  order by m.id limit 1 for share;
  if not found or v_member_role not in ('owner', 'center_admin', 'consultant') then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = v_center_id and p.identity_kind = 'GUARDIAN' and p.status = 'CURRENT' for share;
  if not found or v_policy.center_identity_policy_version <> v_root.identity_policy_version
     or v_policy.normalization_algorithm <> 'p2b.student_identity.nfc_casefold_v1'
     or v_policy.normalization_version <> p_expected_normalization_version
     or v_policy.match_policy_version <> p_expected_match_policy_version
     or v_policy.minimum_evidence_policy_version <> p_expected_minimum_evidence_policy_version
     or v_policy.policy_registry_version <> p_expected_policy_registry_version then
    return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE');
  end if;
  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_env := public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  if v_env is distinct from v_policy.environment_fingerprint then
    return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE');
  end if;
  v_mutexes := public.f23_3e_p3c_internal_identity_mutex_keys(
    v_center_id, 'GUARDIAN', v_policy.identity_policy_registry_id,
    p_display_name_evidence, p_birth_date_evidence,
    (select r.source_contact_id from public.crm_conversion_request r
      where r.conversion_request_id = p_conversion_request_id)
  );
  foreach v_mutex in array v_mutexes loop
    insert into public.crm_identity_match_mutex(
      identity_match_mutex_key, environment_fingerprint, center_id, identity_kind,
      identity_policy_registry_id, normalization_version, digest_key_epoch
    ) values (
      v_mutex, v_env, v_center_id, 'GUARDIAN', v_policy.identity_policy_registry_id,
      v_policy.normalization_version, v_policy.digest_key_epoch
    ) on conflict (identity_match_mutex_key) do update
      set mutex_version = public.crm_identity_match_mutex.mutex_version + 1
      where public.crm_identity_match_mutex.status = 'ACTIVE'
        and public.crm_identity_match_mutex.center_id = excluded.center_id
        and public.crm_identity_match_mutex.identity_kind = excluded.identity_kind
        and public.crm_identity_match_mutex.identity_policy_registry_id = excluded.identity_policy_registry_id;
    if not found then raise exception 'f23_3e_p3c_mutex_binding_unavailable'; end if;
  end loop;
  perform 1 from public.crm_identity_match_mutex m
  where m.identity_match_mutex_key = any(v_mutexes)
  order by m.identity_match_mutex_key for update;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id and r.conversion_request_id = p_conversion_request_id for update;
  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_request.source_contact_id for share;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = v_request.consultation_case_id for share;
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_center_id and c.consultation_case_id = v_request.consultation_case_id
    and c.candidate_student_id = p_candidate_student_id for share;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id and a.assignment_id = v_request.source_assignment_id for share;
  if v_request.request_version <> p_expected_request_version
     or v_request.identity_policy_version <> v_root.identity_policy_version
     or v_contact.contact_version <> p_expected_contact_version
     or v_contact.contact_version <> v_request.source_contact_version
     or v_case.case_version <> p_expected_case_version
     or v_case.case_version <> v_request.source_case_version
     or v_candidate.candidate_version <> p_expected_candidate_version
     or v_assignment.assignment_version <> v_request.source_assignment_version then
    return public.f23_3e_p2b_internal_safe_result('SOURCE_VERSION_STALE');
  end if;
  if v_member_role = 'consultant' and (
    v_assignment.assignment_status <> 'ACTIVE'
    or v_assignment.assigned_consultant_user_id <> p_actor_user_id
  ) then return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE'); end if;
  -- Authentication is mandatory before a complete Guardian adapter may claim NO_MATCH.
  v_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
    v_center_id, v_contact.crm_contact_id, v_contact.contact_version
  );
  v_payload := null;
  v_name_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    'GUARDIAN', 'GUARDIAN_DISPLAY_NAME',
    public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence),
    v_policy.digest_key_epoch
  );
  for v_row in
    select g.*, exists(
      select 1 from public.crm_identity_target_binding b
      where b.center_id = g.center_id and b.identity_kind = 'GUARDIAN'
        and b.source_contact_id = v_contact.crm_contact_id
        and b.guardian_id = g.guardian_id and b.binding_status = 'ACTIVE'
        and b.source_version_at_binding = v_contact.contact_version
        and b.target_version_at_binding = g.guardian_version
    ) binding_current
    from public.guardian_profile g
    where g.center_id = v_center_id and g.guardian_status = 'ACTIVE'
      and (p_detail_opaque_candidate_id is null or g.guardian_id = p_detail_opaque_candidate_id)
    order by g.guardian_id for share of g
  loop
    if not public.f23_3e_p3c_internal_validate_guardian_target_evidence(
      v_center_id, v_row.guardian_id, v_row.guardian_version
    ) then raise exception 'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE'; end if;
    v_row_digest := extensions.hmac(
      pg_catalog.convert_to(pg_catalog.jsonb_build_object(
        'adapter_namespace', 'canonical.guardian_profile.v1', 'adapter_version', 1,
        'center_id', v_center_id, 'target_id', v_row.guardian_id,
        'target_version', v_row.guardian_version, 'status', v_row.guardian_status,
        'binding_current', v_row.binding_current
      )::text, 'UTF8'), v_key, 'sha256'
    );
    v_adapter_material := v_adapter_material || pg_catalog.encode(v_row_digest, 'hex');
    if v_name_digest = any(v_row.normalized_lookup_digests)
       or v_row.normalized_lookup_digests && v_contact.normalized_lookup_digests then
      v_exact_count := v_exact_count + 1;
      if p_detail_opaque_candidate_id is not null
         and v_row.guardian_version <> p_expected_target_version then
        return public.f23_3e_p2b_internal_safe_result('TARGET_VERSION_STALE');
      end if;
      if pg_catalog.jsonb_array_length(v_candidates) < 10 then
        v_candidates := v_candidates || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'candidate_projection_version', 1, 'identity_kind', 'GUARDIAN',
          'opaque_candidate_id', v_row.guardian_id, 'opaque_target_id', v_row.guardian_id,
          'target_adapter_namespace', 'canonical.guardian_profile.v1',
          'target_version', v_row.guardian_version,
          'masked_attributes', pg_catalog.jsonb_build_array('IDENTITY_REDACTED'),
          'safe_attributes', pg_catalog.jsonb_build_array('CURRENT_CANONICAL_GUARDIAN'),
          'evidence_summary_codes', pg_catalog.jsonb_build_array('CONTACT_EVIDENCE_MATCH'),
          'match_reason_codes', pg_catalog.jsonb_build_array('CONTACT_EVIDENCE_MATCH'),
          'normalization_version', v_policy.normalization_version,
          'match_policy_version', v_policy.match_policy_version,
          'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
          'adapter_snapshot_version', 1,
          'target_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_row_digest),
          'reuse_eligible', v_row.binding_current, 'create_authority', false
        ));
      end if;
    end if;
  end loop;
  if p_detail_opaque_candidate_id is not null and pg_catalog.jsonb_array_length(v_candidates) <> 1 then
    return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE');
  end if;
  v_adapter_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'domain', 'f23.3e.p3c.guardian-adapter.v1',
      'complete', true, 'ordered_row_snapshots', v_adapter_material
    )::text, 'UTF8'), v_key, 'sha256'
  );
  v_evidence_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'schema_version', 1, 'name', pg_catalog.encode(v_name_digest, 'hex'),
      'contact_lookup_count', pg_catalog.cardinality(v_contact.normalized_lookup_digests),
      'source_contact_version', v_contact.contact_version
    )::text, 'UTF8'), v_key, 'sha256'
  );
  v_mutex_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.array_to_string(
      array(select pg_catalog.encode(k, 'hex') from pg_catalog.unnest(v_mutexes) k order by k), ','
    ), 'UTF8'), v_key, 'sha256'
  );
  v_expires_at := v_now + interval '5 minutes';
  v_projection_digest := extensions.hmac(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'projection_schema_version', 1, 'conversion_request_id', p_conversion_request_id,
      'request_version', v_request.request_version, 'contact_version', v_contact.contact_version,
      'case_version', v_case.case_version, 'candidate_source_version', v_candidate.candidate_version,
      'assignment_version', v_assignment.assignment_version,
      'adapter_snapshot', pg_catalog.encode(v_adapter_digest, 'hex'),
      'evidence_set', pg_catalog.encode(v_evidence_digest, 'hex'),
      'mutex_set', pg_catalog.encode(v_mutex_digest, 'hex'),
      'candidates', v_candidates, 'expires_at', v_expires_at
    )::text, 'UTF8'), v_key, 'sha256'
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', case when v_exact_count > 0 then 'MATCH_REVIEW_REQUIRED' else 'NO_MATCH' end,
    'match_outcome', case when v_exact_count > 0 then 'PROBABLE_MATCH' else 'NO_MATCH' end,
    'review_requirement', case when v_exact_count > 0 then 'MATCH_REVIEW_REQUIRED' else 'REVIEW_STILL_REQUIRED_BEFORE_CREATE' end,
    'safe_reason_code', case when v_exact_count > 0 then 'CONTACT_EVIDENCE_MATCH' else 'NO_CANDIDATE_AFTER_COMPLETE_SEARCH' end,
    'candidate_projection_version', 1, 'identity_kind', 'GUARDIAN',
    'candidates', v_candidates, 'candidate_count_capped', least(v_exact_count, 10),
    'candidate_limit', 10, 'request_version', v_request.request_version,
    'source_contact_version', v_contact.contact_version, 'source_case_version', v_case.case_version,
    'source_candidate_version', v_candidate.candidate_version,
    'source_assignment_version', v_assignment.assignment_version,
    'normalization_algorithm', v_policy.normalization_algorithm,
    'normalization_version', v_policy.normalization_version,
    'match_policy_version', v_policy.match_policy_version,
    'minimum_evidence_policy_version', v_policy.minimum_evidence_policy_version,
    'identity_policy_registry_id', v_policy.identity_policy_registry_id,
    'identity_policy_registry_version', v_policy.policy_registry_version,
    'digest_key_epoch', v_policy.digest_key_epoch,
    'target_adapter_namespace', 'canonical.guardian_profile.v1',
    'target_adapter_version', 1, 'adapter_snapshot_version', 1,
    'adapter_completeness', 'COMPLETE',
    'adapter_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_adapter_digest),
    'evidence_set_reference', public.f23_3e_p2b_internal_opaque_uuid(v_evidence_digest),
    'mutex_set_reference', public.f23_3e_p2b_internal_opaque_uuid(v_mutex_digest),
    'projection_snapshot_reference', public.f23_3e_p2b_internal_opaque_uuid(v_projection_digest),
    'expires_at', v_expires_at, 'projection_cache_policy', 'NO_STORE',
    'reuse_eligible', false, 'create_authority', false,
    'creates_match_review', false, 'creates_reservation', false, 'server_time', v_now
  );
exception
  when lock_not_available or query_canceled then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  when others then
    return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
end;
$f23_3e_p2b_internal_search_masked_candidates$;

revoke all on function public.f23_3e_p2b_internal_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)
  from public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- P2C forward dispatch: preserve all external signatures and frozen lifecycle,
-- while new reviews/reservations bind only current P3C canonical targets.
-- Historical rows keep their immutable checkpoint namespace and are never
-- upgraded or rebound by this replacement.
-- ---------------------------------------------------------------------------

create or replace function public.f23_3e_p2c_internal_execute_mutation(
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
     or (p_identity_kind = 'STUDENT' and p_birth_date_evidence is null)
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
  if v_policy.normalization_algorithm <> 'p2b.student_identity.nfc_casefold_v1'
     or p_expected_adapter_version <> 1 then
    return public.f23_3e_p2c_internal_safe_result('MATCH_SEARCH_UNAVAILABLE');
  end if;

  v_key := public.f23_3e_p2b_internal_digest_key(v_policy.digest_key_epoch);
  v_environment_fingerprint := public.f23_3e_p2b_internal_environment_fingerprint(v_policy.digest_key_epoch);
  if v_environment_fingerprint is distinct from v_policy.environment_fingerprint then
    return public.f23_3e_p2c_internal_safe_result('MATCH_POLICY_STALE');
  end if;

  -- These evidence digests keep the inherited idempotency intent stable. The
  -- actual mutex set is dispatched by identity kind through the P3C helper.
  v_name_normalized := public.f23_3e_p2b_internal_normalize_student_name_v1(p_display_name_evidence);
  v_birth_normalized := case when p_identity_kind = 'STUDENT'
    then public.f23_3e_p2b_internal_normalize_student_birth_v1(p_birth_date_evidence)
    else null
  end;
  v_name_digest := public.f23_3e_p2b_internal_evidence_digest(
    v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
    p_identity_kind,
    case when p_identity_kind = 'STUDENT'
      then 'STUDENT_DISPLAY_NAME' else 'GUARDIAN_DISPLAY_NAME' end,
    v_name_normalized, v_policy.digest_key_epoch
  );
  if p_identity_kind = 'STUDENT' then
    v_birth_digest := public.f23_3e_p2b_internal_evidence_digest(
      v_key, v_policy.normalization_algorithm, v_policy.normalization_version,
      p_identity_kind, 'STUDENT_BIRTH_DATE', v_birth_normalized,
      v_policy.digest_key_epoch
    );
  else
    v_birth_digest := public.f23_3e_p3c_internal_guardian_secondary_evidence_digest(
      v_key, v_center_id,
      (select r.source_contact_id from public.crm_conversion_request r
       where r.center_id = v_center_id
         and r.conversion_request_id = p_conversion_request_id)
    );
  end if;

  v_mutex_keys := public.f23_3e_p3c_internal_identity_mutex_keys(
    v_center_id,
    p_identity_kind,
    v_policy.identity_policy_registry_id,
    p_display_name_evidence,
    p_birth_date_evidence,
    (
      select r.source_contact_id
      from public.crm_conversion_request r
      where r.center_id = v_center_id
        and r.conversion_request_id = p_conversion_request_id
    )
  );
  if pg_catalog.cardinality(v_mutex_keys) < 2 then
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
        -- P2B remains review-only at the top level. P2C may author an exact
        -- decision only for the one immutable canonical candidate the reviewer
        -- selected and only while its committed source-target binding is current.
        if v_search ->> 'match_outcome' <> 'PROBABLE_MATCH'
           or v_review.match_outcome <> 'PROBABLE_MATCH'
           or pg_catalog.jsonb_array_length(v_candidates) <> 1
           or v_review.target_adapter_namespace <> (case
                when p_identity_kind = 'STUDENT' then 'canonical.student_profile.v1'
                else 'canonical.guardian_profile.v1'
              end)
           or v_review.opaque_target_id is null
           or v_review.target_version is null
           or v_candidates -> 0 ->> 'target_adapter_namespace'
                <> v_review.target_adapter_namespace
           or v_candidates -> 0 ->> 'opaque_target_id'
                <> v_review.opaque_target_id::text
           or v_candidates -> 0 ->> 'target_version'
                <> v_review.target_version::text
           or coalesce((v_candidates -> 0 ->> 'reuse_eligible')::boolean, false)
                is not true then
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
      v_review.match_review_id, pg_catalog.gen_random_uuid(),
      case when p_identity_kind = 'STUDENT'
        then 'canonical.student_profile.v1'
        else 'canonical.guardian_profile.v1'
      end,
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

revoke all on function public.f23_3e_p2c_internal_execute_mutation(text,uuid,uuid,integer,text,uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea,uuid,integer)
  from public, anon, authenticated, service_role;

-- A single currentness validator is shared by P3C finalization and the P3B
-- capability compatibility wrapper.  It observes only typed protected rows;
-- it never refreshes a review, reservation, target, or relationship binding.
create function public.f23_3e_p3c_internal_validate_action_plan(
  p_conversion_request_id uuid,
  p_required_status text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $f23_3e_p3c_internal_validate_action_plan$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_request public.crm_conversion_request%rowtype;
  v_root public.center_crm_control%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_student public.crm_conversion_action%rowtype;
  v_guardian public.crm_conversion_action%rowtype;
  v_relationship public.crm_conversion_action%rowtype;
  v_review public.crm_identity_match_review%rowtype;
  v_reservation public.crm_profile_creation_reservation%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_policy public.crm_identity_policy_registry%rowtype;
  v_reuse record;
  v_existing_relationship public.guardian_student_relationship%rowtype;
  v_action_count integer;
  v_student_count integer;
  v_guardian_count integer;
  v_relationship_count integer;
  v_guardian_target_id uuid;
  v_student_target_id uuid;
begin
  if p_conversion_request_id is null
     or p_required_status not in ('PROPOSED', 'REVIEWED') then
    return 'ACTION_PLAN_VALIDATION_INPUT_INVALID';
  end if;

  select r.* into v_request
  from public.crm_conversion_request r
  where r.conversion_request_id = p_conversion_request_id;
  if not found then return 'RESOURCE_NOT_AVAILABLE'; end if;

  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_request.center_id;
  if not found or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    return 'CRM_RUNTIME_NOT_ACTIVE';
  end if;
  if v_request.status <> 'READY_FOR_REVIEW' then
    return 'REQUEST_NOT_READY_FOR_REVIEW';
  end if;
  if v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version then
    return 'CONVERSION_POLICY_VERSION_STALE';
  end if;

  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_request.center_id
    and c.crm_contact_id = v_request.source_contact_id;
  if not found or v_contact.contact_version <> v_request.source_contact_version
     or v_contact.contact_status = 'ARCHIVED' then
    return 'CONTACT_STATE_STALE';
  end if;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_request.center_id
    and c.consultation_case_id = v_request.consultation_case_id;
  if not found or v_case.case_version <> v_request.source_case_version
     or v_case.status not in ('OPEN', 'CONSULTING', 'READY_FOR_CONVERSION')
     or v_case.active_assignment_id is distinct from v_request.source_assignment_id then
    return 'CASE_STATE_STALE';
  end if;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_request.center_id
    and a.assignment_id = v_request.source_assignment_id;
  if not found or v_assignment.assignment_status <> 'ACTIVE'
     or v_assignment.assignment_version <> v_request.source_assignment_version
     or v_assignment.consultation_case_id <> v_request.consultation_case_id then
    return 'ASSIGNMENT_STATE_STALE';
  end if;

  select pg_catalog.count(*),
         pg_catalog.count(*) filter (where a.identity_kind = 'STUDENT'),
         pg_catalog.count(*) filter (where a.identity_kind = 'GUARDIAN'),
         pg_catalog.count(*) filter (where a.identity_kind is null)
  into v_action_count, v_student_count, v_guardian_count, v_relationship_count
  from public.crm_conversion_action a
  where a.center_id = v_request.center_id
    and a.conversion_request_id = p_conversion_request_id;
  if v_action_count <> 3 or v_student_count <> 1 or v_guardian_count <> 1
     or v_relationship_count <> 1 then
    return 'ACTION_PLAN_INCOMPLETE';
  end if;
  if exists (
    select 1 from public.crm_conversion_action a
    where a.center_id = v_request.center_id
      and a.conversion_request_id = p_conversion_request_id
      and (a.status <> p_required_status
        or a.legacy_request_action_graph_digest is distinct from v_request.action_graph_digest)
  ) then return 'ACTION_PLAN_STATE_STALE'; end if;

  select a.* into strict v_student from public.crm_conversion_action a
  where a.center_id = v_request.center_id
    and a.conversion_request_id = p_conversion_request_id
    and a.identity_kind = 'STUDENT';
  select a.* into strict v_guardian from public.crm_conversion_action a
  where a.center_id = v_request.center_id
    and a.conversion_request_id = p_conversion_request_id
    and a.identity_kind = 'GUARDIAN';
  select a.* into strict v_relationship from public.crm_conversion_action a
  where a.center_id = v_request.center_id
    and a.conversion_request_id = p_conversion_request_id
    and a.identity_kind is null;

  if v_relationship.action_kind = 'REQUIRE_RELATIONSHIP_REVIEW' then
    return 'RELATIONSHIP_REVIEW_REQUIRED';
  end if;

  -- Student source and current policy are mandatory even for an explicit
  -- no-target action because the action still covers one exact source row.
  select c.* into v_candidate from public.consultation_case_candidate_student c
  where c.center_id = v_request.center_id
    and c.candidate_student_id = v_student.source_candidate_student_id;
  if not found or v_candidate.consultation_case_id <> v_request.consultation_case_id
     or v_candidate.candidate_status not in ('ACTIVE', 'REVIEW_REQUIRED') then
    return 'STUDENT_SOURCE_STATE_STALE';
  end if;
  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = v_request.center_id and p.identity_kind = 'STUDENT'
    and p.status = 'CURRENT';
  if not found or v_policy.center_identity_policy_version <> v_request.identity_policy_version then
    return 'IDENTITY_POLICY_VERSION_STALE';
  end if;

  if v_student.action_kind = 'CREATE_NEW_STUDENT' then
    select r.* into v_review from public.crm_identity_match_review r
    where r.center_id = v_request.center_id and r.match_review_id = v_student.match_review_id;
    select r.* into v_reservation from public.crm_profile_creation_reservation r
    where r.center_id = v_request.center_id
      and r.reservation_id = v_student.profile_creation_reservation_id;
    if v_review.match_review_id is null
       or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.request_version <> v_request.request_version
       or v_review.action_id <> v_reservation.action_id
       or v_review.action_intent_digest is distinct from v_reservation.action_intent_digest
       or v_review.identity_kind <> 'STUDENT'
       or v_review.candidate_student_id <> v_student.source_candidate_student_id
       or v_review.source_candidate_version <> v_candidate.candidate_version
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.review_status <> 'CREATE_NEW_REVIEWED'
       or v_review.review_action <> 'PREPARE_CREATE_NEW'
       or v_review.match_outcome <> 'NO_MATCH'
       or v_review.expires_at <= v_now
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_reservation.reservation_id is null
       or v_reservation.conversion_request_id <> p_conversion_request_id
       or v_reservation.request_version <> v_request.request_version
       or v_reservation.entity_kind <> 'STUDENT'
       or v_reservation.match_review_id <> v_review.match_review_id
       or v_reservation.status <> 'ACTIVE'
       or v_reservation.expires_at <= v_now
       or v_reservation.target_adapter_namespace <> 'canonical.student_profile.v1'
       or v_reservation.preallocated_target_id <> v_student.opaque_target_id
       or v_reservation.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_reservation.source_evidence_digest is distinct from v_review.evidence_set_digest
       or v_reservation.identity_mutex_keys_digest is distinct from v_review.identity_mutex_keys_digest
       or v_reservation.projection_snapshot_digest is distinct from v_review.projection_snapshot_digest
       or v_reservation.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_reservation.normalization_version <> v_policy.normalization_version
       or v_reservation.match_policy_version <> v_policy.match_policy_version
       or v_reservation.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version then
      return 'STUDENT_CREATION_EVIDENCE_STALE';
    end if;
  elsif v_student.action_kind = 'REUSE_REVIEWED_STUDENT' then
    select r.* into v_review from public.crm_identity_match_review r
    where r.center_id = v_request.center_id and r.match_review_id = v_student.match_review_id;
    if not found or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.request_version <> v_request.request_version
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.source_candidate_version <> v_candidate.candidate_version
       or v_review.expires_at <= v_now
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest then
      return 'STUDENT_REVIEW_STALE';
    end if;
    select * into v_reuse from public.f23_3e_p3c_internal_resolve_reusable_student(
      v_request.center_id, v_student.source_candidate_student_id,
      v_student.opaque_target_id, v_student.expected_target_version,
      v_student.match_review_id
    );
    if not coalesce(v_reuse.reuse_eligible, false) then
      return 'STUDENT_REUSE_BINDING_STALE';
    end if;
  elsif v_student.action_kind = 'DO_NOT_CREATE_STUDENT' then
    select r.* into strict v_review
    from public.crm_identity_match_review r
    where r.center_id = v_request.center_id
      and r.conversion_request_id = p_conversion_request_id
      and r.identity_kind = 'STUDENT'
      and r.candidate_student_id = v_student.source_candidate_student_id
      and r.review_status = 'REJECTED_MATCH'
      and r.review_action = 'REJECT_IDENTITY_ACTION'
      and extensions.digest(pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'domain', 'ichess.crm.p3c.student-action.v1',
          'request_id', p_conversion_request_id,
          'action_kind', 'DO_NOT_CREATE_STUDENT',
          'source_candidate_student_id', v_student.source_candidate_student_id,
          'match_review_id', r.match_review_id,
          'review_version', r.review_version,
          'reservation_id', null,
          'reservation_version', null,
          'adapter', null,
          'target_id', null,
          'target_version', null
        )::text, 'UTF8'), 'sha256') = v_student.action_intent_digest;
    if v_review.request_version <> v_request.request_version
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.source_candidate_version <> v_candidate.candidate_version
       or v_review.expires_at <= v_now
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_student.safe_reason_code <> 'EXPLICIT_REVIEWED_NO_CREATE' then
      return 'STUDENT_REVIEW_STALE';
    end if;
  else
    return 'STUDENT_ACTION_INVALID';
  end if;

  select p.* into v_policy from public.crm_identity_policy_registry p
  where p.center_id = v_request.center_id and p.identity_kind = 'GUARDIAN'
    and p.status = 'CURRENT';
  if not found or v_policy.center_identity_policy_version <> v_request.identity_policy_version then
    return 'IDENTITY_POLICY_VERSION_STALE';
  end if;
  if v_guardian.source_contact_id <> v_request.source_contact_id then
    return 'GUARDIAN_SOURCE_STATE_STALE';
  end if;
  if v_guardian.action_kind = 'CREATE_NEW_GUARDIAN' then
    select r.* into v_review from public.crm_identity_match_review r
    where r.center_id = v_request.center_id and r.match_review_id = v_guardian.match_review_id;
    select r.* into v_reservation from public.crm_profile_creation_reservation r
    where r.center_id = v_request.center_id
      and r.reservation_id = v_guardian.profile_creation_reservation_id;
    if v_review.match_review_id is null
       or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.request_version <> v_request.request_version
       or v_review.action_id <> v_reservation.action_id
       or v_review.action_intent_digest is distinct from v_reservation.action_intent_digest
       or v_review.identity_kind <> 'GUARDIAN'
       or v_review.crm_contact_id <> v_request.source_contact_id
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.review_status <> 'CREATE_NEW_REVIEWED'
       or v_review.review_action <> 'PREPARE_CREATE_NEW'
       or v_review.match_outcome <> 'NO_MATCH'
       or v_review.expires_at <= v_now
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_reservation.reservation_id is null
       or v_reservation.conversion_request_id <> p_conversion_request_id
       or v_reservation.request_version <> v_request.request_version
       or v_reservation.entity_kind <> 'GUARDIAN'
       or v_reservation.match_review_id <> v_review.match_review_id
       or v_reservation.status <> 'ACTIVE'
       or v_reservation.expires_at <= v_now
       or v_reservation.target_adapter_namespace <> 'canonical.guardian_profile.v1'
       or v_reservation.preallocated_target_id <> v_guardian.opaque_target_id
       or v_reservation.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_reservation.source_evidence_digest is distinct from v_review.evidence_set_digest
       or v_reservation.identity_mutex_keys_digest is distinct from v_review.identity_mutex_keys_digest
       or v_reservation.projection_snapshot_digest is distinct from v_review.projection_snapshot_digest
       or v_reservation.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_reservation.normalization_version <> v_policy.normalization_version
       or v_reservation.match_policy_version <> v_policy.match_policy_version
       or v_reservation.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version then
      return 'GUARDIAN_CREATION_EVIDENCE_STALE';
    end if;
  elsif v_guardian.action_kind = 'REUSE_REVIEWED_GUARDIAN' then
    select r.* into v_review from public.crm_identity_match_review r
    where r.center_id = v_request.center_id and r.match_review_id = v_guardian.match_review_id;
    if not found or v_review.conversion_request_id <> p_conversion_request_id
       or v_review.request_version <> v_request.request_version
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.expires_at <= v_now
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest then
      return 'GUARDIAN_REVIEW_STALE';
    end if;
    select * into v_reuse from public.f23_3e_p3c_internal_resolve_reusable_guardian(
      v_request.center_id, v_guardian.source_contact_id,
      v_guardian.opaque_target_id, v_guardian.expected_target_version,
      v_guardian.match_review_id
    );
    if not coalesce(v_reuse.reuse_eligible, false) then
      return 'GUARDIAN_REUSE_BINDING_STALE';
    end if;
  elsif v_guardian.action_kind = 'DO_NOT_CREATE_GUARDIAN' then
    select r.* into strict v_review
    from public.crm_identity_match_review r
    where r.center_id = v_request.center_id
      and r.conversion_request_id = p_conversion_request_id
      and r.identity_kind = 'GUARDIAN'
      and r.crm_contact_id = v_guardian.source_contact_id
      and r.review_status = 'REJECTED_MATCH'
      and r.review_action = 'REJECT_IDENTITY_ACTION'
      and extensions.digest(pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'domain', 'ichess.crm.p3c.guardian-action.v1',
          'request_id', p_conversion_request_id,
          'action_kind', 'DO_NOT_CREATE_GUARDIAN',
          'source_contact_id', v_guardian.source_contact_id,
          'match_review_id', r.match_review_id,
          'review_version', r.review_version,
          'reservation_id', null,
          'reservation_version', null,
          'adapter', null,
          'target_id', null,
          'target_version', null
        )::text, 'UTF8'), 'sha256') = v_guardian.action_intent_digest;
    if v_review.request_version <> v_request.request_version
       or v_review.source_contact_version <> v_contact.contact_version
       or v_review.source_case_version <> v_case.case_version
       or v_review.expires_at <= v_now
       or v_review.identity_policy_registry_id <> v_policy.identity_policy_registry_id
       or v_review.normalization_version <> v_policy.normalization_version
       or v_review.match_policy_version <> v_policy.match_policy_version
       or v_review.minimum_evidence_policy_version <> v_policy.minimum_evidence_policy_version
       or v_review.request_action_graph_digest is distinct from v_request.action_graph_digest
       or v_guardian.safe_reason_code <> 'EXPLICIT_REVIEWED_NO_CREATE' then
      return 'GUARDIAN_REVIEW_STALE';
    end if;
  else
    return 'GUARDIAN_ACTION_INVALID';
  end if;

  if v_relationship.guardian_action_id <> v_guardian.conversion_action_id
     or v_relationship.student_action_id <> v_student.conversion_action_id
     or v_relationship.relationship_policy_version <> v_request.relationship_policy_version then
    return 'RELATIONSHIP_DECISION_STALE';
  end if;
  if v_relationship.action_kind = 'DO_NOT_CREATE_RELATIONSHIP' then
    if v_relationship.safe_reason_code not in (
      'NO_GUARDIAN_RELATIONSHIP_REQUIRED', 'EXPLICIT_REVIEWED_NO_CREATE',
      'DUPLICATE_AVOIDED', 'RELATIONSHIP_ALREADY_CURRENT'
    ) then return 'RELATIONSHIP_DECISION_STALE'; end if;
  else
    if v_student.action_kind = 'DO_NOT_CREATE_STUDENT'
       or v_guardian.action_kind = 'DO_NOT_CREATE_GUARDIAN' then
      return 'RELATIONSHIP_ENDPOINT_INCOMPLETE';
    end if;
    v_student_target_id := coalesce(v_student.student_target_id, v_student.opaque_target_id);
    v_guardian_target_id := coalesce(v_guardian.guardian_target_id, v_guardian.opaque_target_id);
    if v_student_target_id is null or v_guardian_target_id is null then
      return 'RELATIONSHIP_ENDPOINT_INCOMPLETE';
    end if;
    if v_relationship.action_kind in (
      'REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE'
    ) then
      select r.* into v_existing_relationship
      from public.guardian_student_relationship r
      where r.center_id = v_request.center_id
        and r.relationship_id = v_relationship.guardian_student_relationship_id;
      if not found or v_existing_relationship.status <> 'ACTIVE'
         or v_existing_relationship.relationship_version <> v_relationship.expected_relationship_version
         or v_existing_relationship.guardian_id <> v_guardian_target_id
         or v_existing_relationship.student_id <> v_student_target_id then
        return 'RELATIONSHIP_VERSION_STALE';
      end if;
      if v_relationship.action_kind = 'REUSE_EXISTING_RELATIONSHIP'
         and (v_existing_relationship.relationship_type <> v_relationship.relationship_type
           or v_existing_relationship.is_primary_contact <> v_relationship.is_primary_contact
           or v_existing_relationship.financial_contact_role <> v_relationship.financial_contact_role
           or v_existing_relationship.academic_contact_role <> v_relationship.academic_contact_role) then
        return 'RELATIONSHIP_VERSION_STALE';
      end if;
    elsif v_relationship.action_kind = 'CREATE_RELATIONSHIP' then
      if exists (
        select 1 from public.guardian_student_relationship r
        where r.center_id = v_request.center_id
          and r.guardian_id = v_guardian_target_id
          and r.student_id = v_student_target_id
          and r.relationship_type = v_relationship.relationship_type
          and r.status = 'ACTIVE'
      ) or (v_relationship.is_primary_contact and exists (
        select 1 from public.guardian_student_relationship r
        where r.center_id = v_request.center_id
          and r.student_id = v_student_target_id
          and r.is_primary_contact and r.status = 'ACTIVE'
      )) then return 'RELATIONSHIP_ACTIVE_CONFLICT'; end if;
    else return 'RELATIONSHIP_DECISION_STALE';
    end if;
  end if;

  return 'ACTION_PLAN_CURRENT';
exception
  when no_data_found or too_many_rows then return 'ACTION_PLAN_INCOMPLETE';
end;
$f23_3e_p3c_internal_validate_action_plan$;

-- Preserve all six P3B external names and signatures while adding the P3C
-- current canonical target/binding checks before P3B may issue authority.
alter function public.f23_3e_p3b_evaluate_conversion_capability(uuid,uuid,uuid,integer)
  rename to f23_3e_p3c_internal_checkpoint_evaluate_conversion_capability;

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
volatile
security definer
set search_path = ''
as $f23_3e_p3b_evaluate_conversion_capability$
declare
  v_base record;
  v_plan_code text;
begin
  select * into v_base
  from public.f23_3e_p3c_internal_checkpoint_evaluate_conversion_capability(
    p_actor_user_id, p_conversion_request_id, p_step_up_assertion_id,
    p_expected_request_version
  );
  if v_base.decision = 'ALLOW' then
    v_plan_code := public.f23_3e_p3c_internal_validate_action_plan(
      p_conversion_request_id, 'REVIEWED'
    );
    if v_plan_code <> 'ACTION_PLAN_CURRENT' then
      v_base.decision := 'DENY';
      v_base.reason_code := v_plan_code;
    end if;
  end if;
  return query select
    v_base.decision, v_base.reason_code, v_base.center_id,
    v_base.membership_id, v_base.membership_version,
    v_base.account_security_version, v_base.account_session_version,
    v_base.conversion_policy_version, v_base.assignment_id,
    v_base.assignment_version, v_base.required_assurance,
    v_base.step_up_assertion_version;
end;
$f23_3e_p3b_evaluate_conversion_capability$;

-- PLAN_MATERIALIZATION_CANONICAL_LOCK_ORDER_BEGIN
-- CENTER ROOT -> SORTED IDENTITY MUTEXES -> MEMBERSHIP -> PLAN ADVISORY
-- -> IDEMPOTENCY -> REQUEST -> ACTIONS -> CONTACT -> CASE -> CANDIDATES
-- -> ASSIGNMENT -> TARGETS -> REVIEWS -> RESERVATIONS -> RELATIONSHIPS
create function public.f23_3e_p3c_materialize_reviewed_action_pair(
  p_actor_user_id uuid,
  p_conversion_request_id uuid,
  p_expected_request_version integer,
  p_guardian_match_review_id uuid,
  p_expected_guardian_review_version integer,
  p_student_match_review_id uuid,
  p_expected_student_review_version integer,
  p_relationship_action_id uuid,
  p_relationship_decision text,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_safe_reason_code text,
  p_relationship_policy_version integer,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  guardian_action_id uuid,
  student_action_id uuid,
  relationship_action_id uuid,
  action_versions jsonb,
  current_action_set_digest bytea,
  action_set_encoding_version integer,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_materialize_reviewed_action_pair$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_center_id text;
  v_environment_fingerprint bytea;
  v_root public.center_crm_control%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_membership public.center_members%rowtype;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_guardian_review public.crm_identity_match_review%rowtype;
  v_student_review public.crm_identity_match_review%rowtype;
  v_guardian_reservation public.crm_profile_creation_reservation%rowtype;
  v_student_reservation public.crm_profile_creation_reservation%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_existing_relationship public.guardian_student_relationship%rowtype;
  v_reuse record;
  v_snapshot jsonb;
  v_binding_digest bytea;
  v_plan_digest bytea;
  v_guardian_action_id uuid := pg_catalog.gen_random_uuid();
  v_student_action_id uuid := pg_catalog.gen_random_uuid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_student_action_kind text;
  v_guardian_action_kind text;
  v_student_target_id uuid;
  v_guardian_target_id uuid;
  v_student_target_version integer;
  v_guardian_target_version integer;
  v_student_adapter text;
  v_guardian_adapter text;
  v_student_action_intent bytea;
  v_guardian_action_intent bytea;
  v_relationship_action_intent bytea;
  v_relationship_id uuid;
  v_relationship_version integer;
  v_count integer;
  v_plan_code text;
begin
  if p_actor_user_id is null or p_conversion_request_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_relationship_action_id is null
     or p_relationship_policy_version is null or p_relationship_policy_version < 1
     or p_operation_intent_digest is null
     or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null
     or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours'
     or p_safe_reason_code is null
     or pg_catalog.length(p_safe_reason_code) not between 1 and 80
     or p_safe_reason_code !~ '^[A-Z][A-Z0-9_]*$'
     or p_guardian_match_review_id is null
     or p_expected_guardian_review_version is null
     or p_student_match_review_id is null
     or p_expected_student_review_version is null
     or coalesce(p_expected_guardian_review_version, 1) < 1
     or coalesce(p_expected_student_review_version, 1) < 1 then
    return query select false, 'INVALID_INPUT', false, null::uuid, null::uuid,
      null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;
  if p_relationship_decision is null then
    return query select false, 'RELATIONSHIP_DECISION_REQUIRED', false,
      null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
      null::integer, null::uuid;
    return;
  end if;
  if p_relationship_decision not in (
    'CREATE_RELATIONSHIP', 'REUSE_EXISTING_RELATIONSHIP',
    'UPDATE_APPROVED_RELATIONSHIP_ROLE', 'REQUIRE_RELATIONSHIP_REVIEW',
    'DO_NOT_CREATE_RELATIONSHIP'
  ) then
    return query select false, 'RELATIONSHIP_DECISION_INVALID', false,
      null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
      null::integer, null::uuid;
    return;
  end if;
  if p_relationship_decision = 'REQUIRE_RELATIONSHIP_REVIEW' then
    return query select false, 'RELATIONSHIP_REVIEW_REQUIRED', false,
      null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
      null::integer, null::uuid;
    return;
  end if;
  if p_relationship_decision = 'DO_NOT_CREATE_RELATIONSHIP' then
    if p_relationship_type is not null or p_is_primary_contact is not null
       or p_financial_contact_role is not null or p_academic_contact_role is not null
       or p_safe_reason_code not in (
         'NO_GUARDIAN_RELATIONSHIP_REQUIRED', 'EXPLICIT_REVIEWED_NO_CREATE',
         'DUPLICATE_AVOIDED', 'RELATIONSHIP_ALREADY_CURRENT'
       ) then
      return query select false, 'RELATIONSHIP_DECISION_INVALID', false,
        null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
        null::integer, null::uuid;
      return;
    end if;
  elsif p_relationship_type not in (
      'PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER',
      'EMERGENCY_CONTACT', 'OTHER_REVIEWED'
    ) or p_is_primary_contact is null
       or p_financial_contact_role not in ('NONE', 'PRIMARY', 'SECONDARY')
       or p_academic_contact_role not in ('NONE', 'PRIMARY', 'SECONDARY') then
    return query select false, 'RELATIONSHIP_DECISION_INVALID', false,
      null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
      null::integer, null::uuid;
    return;
  end if;

  -- Selector reads derive immutable scope only. Live state is rechecked after
  -- the canonical locks; replay never reinterprets live action lifecycle.
  select r.center_id, i.environment_fingerprint
  into v_center_id, v_environment_fingerprint
  from public.crm_conversion_request r
  join public.crm_idempotency_registry i
    on i.center_id = r.center_id
   and i.idempotency_record_id = r.idempotency_key_reference
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_AVAILABLE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  perform m.identity_match_mutex_key from public.crm_identity_match_mutex m
  where m.center_id = v_center_id
  order by m.identity_kind, m.identity_match_mutex_key for update;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'f23.3e.p3c.action-plan|' || v_center_id || '|' || p_conversion_request_id::text, 0
  ));

  v_binding_digest := extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'domain', 'ichess.crm.p3c.action-plan-materialization.v1',
      'actor_user_id', p_actor_user_id,
      'conversion_request_id', p_conversion_request_id,
      'expected_request_version', p_expected_request_version,
      'guardian_match_review_id', p_guardian_match_review_id,
      'expected_guardian_review_version', p_expected_guardian_review_version,
      'student_match_review_id', p_student_match_review_id,
      'expected_student_review_version', p_expected_student_review_version,
      'relationship_action_id', p_relationship_action_id,
      'relationship_decision', p_relationship_decision,
      'relationship_type', p_relationship_type,
      'is_primary_contact', p_is_primary_contact,
      'financial_contact_role', p_financial_contact_role,
      'academic_contact_role', p_academic_contact_role,
      'safe_reason_code', p_safe_reason_code,
      'relationship_policy_version', p_relationship_policy_version
    )::text, 'UTF8'), 'sha256');

  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = v_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'conversion.materialize_action_plan'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_expected_request_version is distinct from p_expected_request_version
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED'
       and v_registry.p3_result_kind = 'ACTION_PLAN_MATERIALIZATION' then
      v_snapshot := v_registry.p3_result_snapshot;
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_snapshot ->> 'guardian_action_id')::uuid,
        (v_snapshot ->> 'student_action_id')::uuid,
        (v_snapshot ->> 'relationship_action_id')::uuid,
        pg_catalog.jsonb_build_object(
          'guardian', (v_snapshot ->> 'guardian_action_version')::integer,
          'student', (v_snapshot ->> 'student_action_version')::integer,
          'relationship', (v_snapshot ->> 'relationship_action_version')::integer
        ),
        pg_catalog.decode(v_snapshot ->> 'action_set_digest', 'hex'),
        (v_snapshot ->> 'action_set_encoding_version')::integer,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  if v_root.center_id is null or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id
    and r.conversion_request_id = p_conversion_request_id for update;
  if not found or v_request.status <> 'READY_FOR_REVIEW' then
    return query select false, 'REQUEST_NOT_READY_FOR_REVIEW', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;
  if v_request.request_version <> p_expected_request_version then
    return query select false, 'REQUEST_VERSION_STALE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;
  if v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version
     or p_relationship_policy_version <> v_root.relationship_policy_version then
    return query select false, 'CONVERSION_POLICY_VERSION_STALE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  perform a.conversion_action_id from public.crm_conversion_action a
  where a.center_id = v_center_id
    and a.conversion_request_id = p_conversion_request_id
  order by a.conversion_action_id for update;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    return query select false, 'ACTION_PLAN_ALREADY_EXISTS', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  select c.* into v_contact from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_request.source_contact_id
  for update;
  select c.* into v_case from public.consultation_case c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_request.consultation_case_id for update;
  perform c.candidate_student_id from public.consultation_case_candidate_student c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_request.consultation_case_id
  order by c.candidate_student_id for update;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id and a.assignment_id = v_request.source_assignment_id
  for update;

  if v_membership.id is null or v_membership.status <> 'active'
     or v_membership.role not in ('owner', 'center_admin', 'consultant')
     or (v_membership.role = 'consultant'
       and (v_assignment.assignment_id is null
         or v_assignment.assigned_consultant_user_id <> p_actor_user_id)) then
    return query select false, 'PLAN_CAPABILITY_DENIED', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;
  if v_contact.crm_contact_id is null
     or v_contact.contact_version <> v_request.source_contact_version
     or v_contact.contact_status = 'ARCHIVED' then
    return query select false, 'CONTACT_STATE_STALE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;
  if v_case.consultation_case_id is null
     or v_case.case_version <> v_request.source_case_version
     or v_case.status not in ('OPEN', 'CONSULTING', 'READY_FOR_CONVERSION')
     or v_case.active_assignment_id is distinct from v_request.source_assignment_id
     or v_assignment.assignment_id is null
     or v_assignment.assignment_status <> 'ACTIVE'
     or v_assignment.assignment_version <> v_request.source_assignment_version then
    return query select false, 'SOURCE_WORKFLOW_STATE_STALE', false, null::uuid,
      null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
    return;
  end if;

  -- Lock current target rows before the reviews that name them.
  perform s.student_id from public.student_profile s
  join public.crm_identity_match_review r
    on r.center_id = s.center_id and r.opaque_target_id = s.student_id
  where r.center_id = v_center_id
    and r.match_review_id = p_student_match_review_id for update of s;
  perform g.guardian_id from public.guardian_profile g
  join public.crm_identity_match_review r
    on r.center_id = g.center_id and r.opaque_target_id = g.guardian_id
  where r.center_id = v_center_id
    and r.match_review_id = p_guardian_match_review_id for update of g;
  if p_guardian_match_review_id is not null then
    select r.* into v_guardian_review from public.crm_identity_match_review r
    where r.center_id = v_center_id and r.match_review_id = p_guardian_match_review_id
    for update;
  end if;
  if p_student_match_review_id is not null then
    select r.* into v_student_review from public.crm_identity_match_review r
    where r.center_id = v_center_id and r.match_review_id = p_student_match_review_id
    for update;
  end if;
  perform r.reservation_id from public.crm_profile_creation_reservation r
  where r.center_id = v_center_id
    and r.match_review_id in (p_guardian_match_review_id, p_student_match_review_id)
  order by r.reservation_id for update;
  perform r.relationship_id from public.guardian_student_relationship r
  where r.center_id = v_center_id order by r.relationship_id for update;

  if p_student_match_review_id is not null then
    if v_student_review.match_review_id is null
       or v_student_review.conversion_request_id <> p_conversion_request_id
       or v_student_review.identity_kind <> 'STUDENT'
       or v_student_review.review_version <> p_expected_student_review_version
       or v_student_review.expires_at <= v_now
       or v_student_review.request_action_graph_digest is distinct from v_request.action_graph_digest then
      return query select false, 'STUDENT_REVIEW_STALE', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
    select c.* into v_candidate from public.consultation_case_candidate_student c
    where c.center_id = v_center_id
      and c.candidate_student_id = v_student_review.candidate_student_id;
    if not found or v_candidate.consultation_case_id <> v_request.consultation_case_id
       or v_candidate.candidate_version <> v_student_review.source_candidate_version
       or v_candidate.candidate_status not in ('ACTIVE', 'REVIEW_REQUIRED') then
      return query select false, 'STUDENT_SOURCE_STATE_STALE', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
    if v_student_review.review_status = 'CREATE_NEW_REVIEWED'
       and v_student_review.review_action = 'PREPARE_CREATE_NEW'
       and v_student_review.match_outcome = 'NO_MATCH' then
      select r.* into v_student_reservation from public.crm_profile_creation_reservation r
      where r.center_id = v_center_id and r.entity_kind = 'STUDENT'
        and r.match_review_id = v_student_review.match_review_id
        and r.status = 'ACTIVE' for update;
      if not found or v_student_reservation.expires_at <= v_now
         or v_student_reservation.target_adapter_namespace <> 'canonical.student_profile.v1'
         or v_student_reservation.conversion_request_id <> p_conversion_request_id then
        return query select false, 'STUDENT_RESERVATION_STALE', false, null::uuid,
          null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
        return;
      end if;
      v_student_action_kind := 'CREATE_NEW_STUDENT';
      v_student_adapter := v_student_reservation.target_adapter_namespace;
      v_student_target_id := v_student_reservation.preallocated_target_id;
    elsif v_student_review.review_status = 'EXACT_REVIEWED_MATCH'
       and v_student_review.review_action = 'REUSE_EXISTING' then
      select * into v_reuse from public.f23_3e_p3c_internal_resolve_reusable_student(
        v_center_id, v_candidate.candidate_student_id,
        v_student_review.opaque_target_id, v_student_review.target_version,
        v_student_review.match_review_id
      );
      if not coalesce(v_reuse.reuse_eligible, false) then
        return query select false, 'STUDENT_REUSE_BINDING_STALE', false, null::uuid,
          null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
        return;
      end if;
      v_student_action_kind := 'REUSE_REVIEWED_STUDENT';
      v_student_adapter := 'canonical.student_profile.v1';
      v_student_target_id := v_reuse.student_id;
      v_student_target_version := v_reuse.student_version;
    elsif v_student_review.review_status = 'REJECTED_MATCH'
       and v_student_review.review_action = 'REJECT_IDENTITY_ACTION' then
      v_student_action_kind := 'DO_NOT_CREATE_STUDENT';
    else
      return query select false, 'STUDENT_REVIEW_STALE', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
  end if;

  if p_guardian_match_review_id is not null then
    if v_guardian_review.match_review_id is null
       or v_guardian_review.conversion_request_id <> p_conversion_request_id
       or v_guardian_review.identity_kind <> 'GUARDIAN'
       or v_guardian_review.crm_contact_id <> v_request.source_contact_id
       or v_guardian_review.review_version <> p_expected_guardian_review_version
       or v_guardian_review.expires_at <= v_now
       or v_guardian_review.request_action_graph_digest is distinct from v_request.action_graph_digest then
      return query select false, 'GUARDIAN_REVIEW_STALE', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
    if v_guardian_review.review_status = 'CREATE_NEW_REVIEWED'
       and v_guardian_review.review_action = 'PREPARE_CREATE_NEW'
       and v_guardian_review.match_outcome = 'NO_MATCH' then
      select r.* into v_guardian_reservation from public.crm_profile_creation_reservation r
      where r.center_id = v_center_id and r.entity_kind = 'GUARDIAN'
        and r.match_review_id = v_guardian_review.match_review_id
        and r.status = 'ACTIVE' for update;
      if not found or v_guardian_reservation.expires_at <= v_now
         or v_guardian_reservation.target_adapter_namespace <> 'canonical.guardian_profile.v1'
         or v_guardian_reservation.conversion_request_id <> p_conversion_request_id then
        return query select false, 'GUARDIAN_RESERVATION_STALE', false, null::uuid,
          null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
        return;
      end if;
      -- The canonical source envelope must be currently openable before a
      -- Guardian create plan is accepted; no evidence bytes leave this scope.
      perform pg_catalog.octet_length(
        public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
          v_center_id, v_contact.crm_contact_id, v_contact.contact_version
        )
      );
      v_guardian_action_kind := 'CREATE_NEW_GUARDIAN';
      v_guardian_adapter := v_guardian_reservation.target_adapter_namespace;
      v_guardian_target_id := v_guardian_reservation.preallocated_target_id;
    elsif v_guardian_review.review_status = 'EXACT_REVIEWED_MATCH'
       and v_guardian_review.review_action = 'REUSE_EXISTING' then
      select * into v_reuse from public.f23_3e_p3c_internal_resolve_reusable_guardian(
        v_center_id, v_contact.crm_contact_id,
        v_guardian_review.opaque_target_id, v_guardian_review.target_version,
        v_guardian_review.match_review_id
      );
      if not coalesce(v_reuse.reuse_eligible, false) then
        return query select false, 'GUARDIAN_REUSE_BINDING_STALE', false, null::uuid,
          null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
        return;
      end if;
      v_guardian_action_kind := 'REUSE_REVIEWED_GUARDIAN';
      v_guardian_adapter := 'canonical.guardian_profile.v1';
      v_guardian_target_id := v_reuse.guardian_id;
      v_guardian_target_version := v_reuse.guardian_version;
    elsif v_guardian_review.review_status = 'REJECTED_MATCH'
       and v_guardian_review.review_action = 'REJECT_IDENTITY_ACTION' then
      v_guardian_action_kind := 'DO_NOT_CREATE_GUARDIAN';
    else
      return query select false, 'GUARDIAN_REVIEW_STALE', false, null::uuid,
        null::uuid, null::uuid, null::jsonb, null::bytea, null::integer, null::uuid;
      return;
    end if;
  end if;

  if p_relationship_decision <> 'DO_NOT_CREATE_RELATIONSHIP'
     and (v_student_action_kind = 'DO_NOT_CREATE_STUDENT'
       or v_guardian_action_kind = 'DO_NOT_CREATE_GUARDIAN') then
    return query select false, 'RELATIONSHIP_ENDPOINT_INCOMPLETE', false,
      null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
      null::integer, null::uuid;
    return;
  end if;
  if p_relationship_decision in (
    'REUSE_EXISTING_RELATIONSHIP', 'UPDATE_APPROVED_RELATIONSHIP_ROLE'
  ) then
    if v_student_action_kind <> 'REUSE_REVIEWED_STUDENT'
       or v_guardian_action_kind <> 'REUSE_REVIEWED_GUARDIAN' then
      return query select false, 'RELATIONSHIP_ENDPOINT_INCOMPLETE', false,
        null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
        null::integer, null::uuid;
      return;
    end if;
    select r.* into v_existing_relationship
    from public.guardian_student_relationship r
    where r.center_id = v_center_id and r.guardian_id = v_guardian_target_id
      and r.student_id = v_student_target_id and r.relationship_type = p_relationship_type
      and r.status = 'ACTIVE';
    if not found then
      return query select false, 'RELATIONSHIP_VERSION_STALE', false,
        null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
        null::integer, null::uuid;
      return;
    end if;
    if p_relationship_decision = 'REUSE_EXISTING_RELATIONSHIP'
       and (v_existing_relationship.is_primary_contact <> p_is_primary_contact
         or v_existing_relationship.financial_contact_role <> p_financial_contact_role
         or v_existing_relationship.academic_contact_role <> p_academic_contact_role) then
      return query select false, 'RELATIONSHIP_VERSION_STALE', false,
        null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
        null::integer, null::uuid;
      return;
    end if;
    v_relationship_id := v_existing_relationship.relationship_id;
    v_relationship_version := v_existing_relationship.relationship_version;
  elsif p_relationship_decision = 'CREATE_RELATIONSHIP' then
    if exists (
      select 1 from public.guardian_student_relationship r
      where r.center_id = v_center_id
        and r.guardian_id = v_guardian_target_id
        and r.student_id = v_student_target_id
        and r.relationship_type = p_relationship_type
        and r.status = 'ACTIVE'
    ) or (p_is_primary_contact and exists (
      select 1 from public.guardian_student_relationship r
      where r.center_id = v_center_id and r.student_id = v_student_target_id
        and r.is_primary_contact and r.status = 'ACTIVE'
    )) then
      return query select false, 'RELATIONSHIP_ACTIVE_CONFLICT', false,
        null::uuid, null::uuid, null::uuid, null::jsonb, null::bytea,
        null::integer, null::uuid;
      return;
    end if;
  end if;

  v_student_action_intent := extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'domain', 'ichess.crm.p3c.student-action.v1',
      'request_id', p_conversion_request_id, 'action_kind', v_student_action_kind,
      'source_candidate_student_id', v_candidate.candidate_student_id,
      'match_review_id', p_student_match_review_id,
      'review_version', p_expected_student_review_version,
      'reservation_id', v_student_reservation.reservation_id,
      'reservation_version', v_student_reservation.reservation_version,
      'adapter', v_student_adapter, 'target_id', v_student_target_id,
      'target_version', v_student_target_version
    )::text, 'UTF8'), 'sha256');
  v_guardian_action_intent := extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'domain', 'ichess.crm.p3c.guardian-action.v1',
      'request_id', p_conversion_request_id, 'action_kind', v_guardian_action_kind,
      'source_contact_id', v_contact.crm_contact_id,
      'match_review_id', p_guardian_match_review_id,
      'review_version', p_expected_guardian_review_version,
      'reservation_id', v_guardian_reservation.reservation_id,
      'reservation_version', v_guardian_reservation.reservation_version,
      'adapter', v_guardian_adapter, 'target_id', v_guardian_target_id,
      'target_version', v_guardian_target_version
    )::text, 'UTF8'), 'sha256');
  v_relationship_action_intent := extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'domain', 'ichess.crm.p3c.relationship-action.v1',
      'request_id', p_conversion_request_id,
      'guardian_action_id', v_guardian_action_id,
      'student_action_id', v_student_action_id,
      'action_kind', p_relationship_decision,
      'relationship_id', v_relationship_id,
      'relationship_version', v_relationship_version,
      'relationship_type', p_relationship_type,
      'is_primary_contact', p_is_primary_contact,
      'financial_contact_role', p_financial_contact_role,
      'academic_contact_role', p_academic_contact_role,
      'safe_reason_code', p_safe_reason_code,
      'relationship_policy_version', p_relationship_policy_version
    )::text, 'UTF8'), 'sha256');

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    action_graph_digest, request_id, expires_at, p3_actor_user_id,
    p3_expected_request_version, p3_operation_binding_digest,
    p3_legacy_request_action_graph_digest
  ) values (
    v_environment_fingerprint, v_center_id, 'conversion_request',
    p_conversion_request_id, v_request.consultation_case_id,
    'conversion.materialize_action_plan', p_idempotency_key_digest,
    p_operation_intent_digest, v_request.action_graph_digest,
    p_conversion_request_id, p_idempotency_expires_at, p_actor_user_id,
    p_expected_request_version, v_binding_digest, v_request.action_graph_digest
  ) returning * into v_registry;

  insert into public.crm_conversion_action (
    conversion_action_id, center_id, conversion_request_id,
    legacy_request_action_graph_digest, action_kind, action_intent_digest,
    identity_kind, source_candidate_student_id, match_review_id,
    profile_creation_reservation_id, target_adapter_namespace,
    opaque_target_id, expected_target_version, student_target_id,
    safe_reason_code, status, action_version
  ) values (
    v_student_action_id, v_center_id, p_conversion_request_id,
    v_request.action_graph_digest, v_student_action_kind,
    v_student_action_intent, 'STUDENT', v_candidate.candidate_student_id,
    case when v_student_action_kind = 'DO_NOT_CREATE_STUDENT'
      then null else p_student_match_review_id end,
    v_student_reservation.reservation_id,
    v_student_adapter, v_student_target_id, v_student_target_version,
    case when v_student_action_kind = 'REUSE_REVIEWED_STUDENT'
      then v_student_target_id else null end,
    case when v_student_action_kind = 'DO_NOT_CREATE_STUDENT'
      then 'EXPLICIT_REVIEWED_NO_CREATE'
      when v_student_action_kind = 'CREATE_NEW_STUDENT'
      then 'CREATE_NEW_REVIEWED' else 'EXACT_REVIEWED_MATCH' end,
    'PROPOSED', 1
  );

  insert into public.crm_conversion_action (
    conversion_action_id, center_id, conversion_request_id,
    legacy_request_action_graph_digest, action_kind, action_intent_digest,
    identity_kind, source_contact_id, match_review_id,
    profile_creation_reservation_id, target_adapter_namespace,
    opaque_target_id, expected_target_version, guardian_target_id,
    safe_reason_code, status, action_version
  ) values (
    v_guardian_action_id, v_center_id, p_conversion_request_id,
    v_request.action_graph_digest, v_guardian_action_kind,
    v_guardian_action_intent, 'GUARDIAN', v_contact.crm_contact_id,
    case when v_guardian_action_kind = 'DO_NOT_CREATE_GUARDIAN'
      then null else p_guardian_match_review_id end,
    v_guardian_reservation.reservation_id,
    v_guardian_adapter, v_guardian_target_id, v_guardian_target_version,
    case when v_guardian_action_kind = 'REUSE_REVIEWED_GUARDIAN'
      then v_guardian_target_id else null end,
    case when v_guardian_action_kind = 'DO_NOT_CREATE_GUARDIAN'
      then 'EXPLICIT_REVIEWED_NO_CREATE'
      when v_guardian_action_kind = 'CREATE_NEW_GUARDIAN'
      then 'CREATE_NEW_REVIEWED' else 'EXACT_REVIEWED_MATCH' end,
    'PROPOSED', 1
  );

  insert into public.crm_conversion_action (
    conversion_action_id, center_id, conversion_request_id,
    legacy_request_action_graph_digest, action_kind, action_intent_digest,
    guardian_action_id, student_action_id,
    guardian_student_relationship_id, expected_relationship_version,
    relationship_type, is_primary_contact, financial_contact_role,
    academic_contact_role, safe_reason_code, relationship_policy_version,
    status, action_version
  ) values (
    p_relationship_action_id, v_center_id, p_conversion_request_id,
    v_request.action_graph_digest, p_relationship_decision,
    v_relationship_action_intent, v_guardian_action_id, v_student_action_id,
    v_relationship_id, v_relationship_version, p_relationship_type,
    p_is_primary_contact, p_financial_contact_role, p_academic_contact_role,
    p_safe_reason_code, p_relationship_policy_version, 'PROPOSED', 1
  );

  v_plan_code := public.f23_3e_p3c_internal_validate_action_plan(
    p_conversion_request_id, 'PROPOSED'
  );
  if v_plan_code <> 'ACTION_PLAN_CURRENT' then
    raise exception using message = v_plan_code, errcode = 'P0001';
  end if;
  v_plan_digest := public.f23_3e_p3b_internal_action_set_digest(
    p_conversion_request_id, 'PROPOSED'
  );
  if v_plan_digest is null then
    raise exception using message = 'PROPOSED_ACTION_SET_DIGEST_UNAVAILABLE', errcode = 'P0001';
  end if;

  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'crm.conversion.action_plan_materialized', p_actor_user_id,
    'crm_conversion_action_plan', p_conversion_request_id,
    p_conversion_request_id, v_request.source_assignment_id,
    null, 1, 'PROPOSED', 'action_plan_materialized',
    'conversion.materialize_action_plan', 'ACTION_PLAN_MATERIALIZED',
    v_correlation_id
  );

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1,
    'result_type', 'ACTION_PLAN_MATERIALIZATION',
    'resource_id', p_conversion_request_id,
    'resource_version', 1,
    'resource_status', 'PROPOSED',
    'request_id', p_conversion_request_id,
    'request_version', v_request.request_version,
    'guardian_action_id', v_guardian_action_id,
    'guardian_action_version', 1,
    'student_action_id', v_student_action_id,
    'student_action_version', 1,
    'relationship_action_id', p_relationship_action_id,
    'relationship_action_version', 1,
    'action_count', 3,
    'action_set_encoding_version', 1,
    'action_set_digest', pg_catalog.encode(v_plan_digest, 'hex'),
    'max_action_version', 1,
    'correlation_id', v_correlation_id,
    'outcome_code', 'ACTION_PLAN_MATERIALIZED'
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED',
    terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1,
    completed_at = v_now,
    p3_action_set_encoding_version = 1,
    p3_action_set_digest = v_plan_digest,
    p3_result_kind = 'ACTION_PLAN_MATERIALIZATION',
    p3_result_outcome_code = 'ACTION_PLAN_MATERIALIZED',
    p3_result_snapshot = v_snapshot,
    p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;

  return query select true, 'ACTION_PLAN_MATERIALIZED', false,
    v_guardian_action_id, v_student_action_id, p_relationship_action_id,
    pg_catalog.jsonb_build_object('guardian', 1, 'student', 1, 'relationship', 1),
    v_plan_digest, 1, v_correlation_id;
exception
  when unique_violation then
    raise exception using message = 'ACTION_PLAN_CONCURRENCY_CONFLICT', errcode = 'P0001';
end;
$f23_3e_p3c_materialize_reviewed_action_pair$;
-- PLAN_MATERIALIZATION_CANONICAL_LOCK_ORDER_END

-- PLAN_FINALIZATION_CANONICAL_LOCK_ORDER_BEGIN
-- Exact replay is returned at the idempotency tier before live PROPOSED rows
-- are interpreted. The authoritative REVIEWED digest is computed only after
-- all three persisted action_version values have advanced by exactly one.
create function public.f23_3e_p3c_finalize_reviewed_action_plan(
  p_actor_user_id uuid,
  p_conversion_request_id uuid,
  p_expected_request_version integer,
  p_expected_action_count integer,
  p_operation_intent_digest bytea,
  p_idempotency_key_digest bytea,
  p_idempotency_expires_at timestamptz
)
returns table (
  ok boolean,
  outcome_code text,
  replayed boolean,
  conversion_request_id uuid,
  action_count integer,
  finalized_action_set_digest bytea,
  action_set_encoding_version integer,
  max_action_version integer,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p3c_finalize_reviewed_action_plan$
declare
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_center_id text;
  v_environment_fingerprint bytea;
  v_root public.center_crm_control%rowtype;
  v_request public.crm_conversion_request%rowtype;
  v_membership public.center_members%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_registry public.crm_idempotency_registry%rowtype;
  v_snapshot jsonb;
  v_binding_digest bytea;
  v_final_digest bytea;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_plan_code text;
  v_action_count integer;
  v_max_action_version integer;
begin
  if p_actor_user_id is null or p_conversion_request_id is null
     or p_expected_request_version is null or p_expected_request_version < 1
     or p_expected_action_count is null or p_expected_action_count <> 3
     or p_operation_intent_digest is null
     or pg_catalog.octet_length(p_operation_intent_digest) <> 32
     or p_idempotency_key_digest is null
     or pg_catalog.octet_length(p_idempotency_key_digest) <> 32
     or p_idempotency_expires_at is null or p_idempotency_expires_at <= v_now
     or p_idempotency_expires_at > v_now + interval '24 hours' then
    return query select false, 'INVALID_INPUT', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  select r.center_id, i.environment_fingerprint
  into v_center_id, v_environment_fingerprint
  from public.crm_conversion_request r
  join public.crm_idempotency_registry i
    on i.center_id = r.center_id
   and i.idempotency_record_id = r.idempotency_key_reference
  where r.conversion_request_id = p_conversion_request_id;
  if not found then
    return query select false, 'RESOURCE_NOT_AVAILABLE', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for update;
  perform m.identity_match_mutex_key from public.crm_identity_match_mutex m
  where m.center_id = v_center_id
  order by m.identity_kind, m.identity_match_mutex_key for update;
  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id for update;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'f23.3e.p3c.action-plan|' || v_center_id || '|' || p_conversion_request_id::text, 0
  ));

  v_binding_digest := extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'domain', 'ichess.crm.p3c.action-plan-finalization.v1',
      'actor_user_id', p_actor_user_id,
      'conversion_request_id', p_conversion_request_id,
      'expected_request_version', p_expected_request_version,
      'expected_action_count', p_expected_action_count
    )::text, 'UTF8'), 'sha256');

  select i.* into v_registry from public.crm_idempotency_registry i
  where i.environment_fingerprint = v_environment_fingerprint
    and i.center_id = v_center_id
    and i.resource_scope_kind = 'conversion_request'
    and i.resource_scope_id = p_conversion_request_id
    and i.operation = 'conversion.finalize_action_plan'
    and i.idempotency_key_digest = p_idempotency_key_digest
  for update;
  if found then
    if v_registry.intent_digest is distinct from p_operation_intent_digest
       or v_registry.p3_actor_user_id is distinct from p_actor_user_id
       or v_registry.p3_expected_request_version is distinct from p_expected_request_version
       or v_registry.p3_expected_resource_version is distinct from p_expected_action_count
       or v_registry.p3_operation_binding_digest is distinct from v_binding_digest then
      return query select false, 'IDEMPOTENCY_CONFLICT', false, null::uuid,
        null::integer, null::bytea, null::integer, null::integer, null::uuid;
      return;
    end if;
    if v_registry.status = 'COMPLETED'
       and v_registry.p3_result_kind = 'ACTION_PLAN_FINALIZATION' then
      v_snapshot := v_registry.p3_result_snapshot;
      return query select true, v_registry.p3_result_outcome_code, true,
        (v_snapshot ->> 'request_id')::uuid,
        (v_snapshot ->> 'action_count')::integer,
        pg_catalog.decode(v_snapshot ->> 'action_set_digest', 'hex'),
        (v_snapshot ->> 'action_set_encoding_version')::integer,
        (v_snapshot ->> 'max_action_version')::integer,
        v_registry.p3_result_correlation_id;
      return;
    end if;
    return query select false, 'IDEMPOTENCY_IN_PROGRESS', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  if v_root.center_id is null or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;
  select r.* into v_request from public.crm_conversion_request r
  where r.center_id = v_center_id
    and r.conversion_request_id = p_conversion_request_id for update;
  if not found or v_request.status <> 'READY_FOR_REVIEW' then
    return query select false, 'REQUEST_NOT_READY_FOR_REVIEW', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;
  if v_request.request_version <> p_expected_request_version then
    return query select false, 'REQUEST_VERSION_STALE', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;
  if v_request.identity_policy_version <> v_root.identity_policy_version
     or v_request.conversion_policy_version <> v_root.conversion_policy_version
     or v_request.relationship_policy_version <> v_root.relationship_policy_version
     or v_request.student_profile_policy_version <> v_root.student_profile_policy_version then
    return query select false, 'CONVERSION_POLICY_VERSION_STALE', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- Live PROPOSED interpretation intentionally follows the completed replay
  -- branch above. Every action is locked in opaque ID order.
  perform a.conversion_action_id from public.crm_conversion_action a
  where a.center_id = v_center_id
    and a.conversion_request_id = p_conversion_request_id
  order by a.conversion_action_id for update;
  select pg_catalog.count(*), max(a.action_version)
  into v_action_count, v_max_action_version
  from public.crm_conversion_action a
  where a.center_id = v_center_id
    and a.conversion_request_id = p_conversion_request_id;
  if v_action_count <> p_expected_action_count
     or exists (
       select 1 from public.crm_conversion_action a
       where a.center_id = v_center_id
         and a.conversion_request_id = p_conversion_request_id
         and a.status <> 'PROPOSED'
     ) then
    return query select false, 'PROPOSED_ACTION_SET_INCOMPLETE', false,
      null::uuid, null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  -- Remaining protected rows are locked in the P3A canonical relative order.
  perform c.crm_contact_id from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = v_request.source_contact_id
  for update;
  perform c.consultation_case_id from public.consultation_case c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_request.consultation_case_id for update;
  perform c.candidate_student_id from public.consultation_case_candidate_student c
  where c.center_id = v_center_id
    and c.consultation_case_id = v_request.consultation_case_id
  order by c.candidate_student_id for update;
  select a.* into v_assignment from public.consultation_case_assignment a
  where a.center_id = v_center_id and a.assignment_id = v_request.source_assignment_id
  for update;
  perform s.student_id from public.student_profile s
  join public.crm_conversion_action a on a.student_target_id = s.student_id
    and a.center_id = s.center_id
  where a.conversion_request_id = p_conversion_request_id for update of s;
  perform g.guardian_id from public.guardian_profile g
  join public.crm_conversion_action a on a.guardian_target_id = g.guardian_id
    and a.center_id = g.center_id
  where a.conversion_request_id = p_conversion_request_id for update of g;
  perform r.match_review_id from public.crm_identity_match_review r
  join public.crm_conversion_action a on a.match_review_id = r.match_review_id
    and a.center_id = r.center_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.match_review_id for update of r;
  perform r.reservation_id from public.crm_profile_creation_reservation r
  join public.crm_conversion_action a on a.profile_creation_reservation_id = r.reservation_id
    and a.center_id = r.center_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.reservation_id for update of r;
  perform r.relationship_id from public.guardian_student_relationship r
  join public.crm_conversion_action a
    on a.guardian_student_relationship_id = r.relationship_id
   and a.center_id = r.center_id
  where a.conversion_request_id = p_conversion_request_id
  order by r.relationship_id for update of r;

  if v_membership.id is null or v_membership.status <> 'active'
     or v_membership.role not in ('owner', 'center_admin', 'consultant')
     or (v_membership.role = 'consultant'
       and (v_assignment.assignment_id is null
         or v_assignment.assigned_consultant_user_id <> p_actor_user_id)) then
    return query select false, 'PLAN_CAPABILITY_DENIED', false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  v_plan_code := public.f23_3e_p3c_internal_validate_action_plan(
    p_conversion_request_id, 'PROPOSED'
  );
  if v_plan_code <> 'ACTION_PLAN_CURRENT' then
    return query select false, v_plan_code, false, null::uuid,
      null::integer, null::bytea, null::integer, null::integer, null::uuid;
    return;
  end if;

  insert into public.crm_idempotency_registry (
    environment_fingerprint, center_id, resource_scope_kind, resource_scope_id,
    consultation_case_id, operation, idempotency_key_digest, intent_digest,
    action_graph_digest, request_id, expires_at, p3_actor_user_id,
    p3_expected_request_version, p3_expected_resource_version,
    p3_operation_binding_digest, p3_legacy_request_action_graph_digest
  ) values (
    v_environment_fingerprint, v_center_id, 'conversion_request',
    p_conversion_request_id, v_request.consultation_case_id,
    'conversion.finalize_action_plan', p_idempotency_key_digest,
    p_operation_intent_digest, v_request.action_graph_digest,
    p_conversion_request_id, p_idempotency_expires_at, p_actor_user_id,
    p_expected_request_version, p_expected_action_count,
    v_binding_digest, v_request.action_graph_digest
  ) returning * into v_registry;

  -- POST_REVIEWED_DIGEST_ORDER_BEGIN
  update public.crm_conversion_action a set
    status = 'REVIEWED',
    action_version = a.action_version + 1,
    updated_at = v_now
  where a.center_id = v_center_id
    and a.conversion_request_id = p_conversion_request_id
    and a.status = 'PROPOSED';
  get diagnostics v_action_count = row_count;
  if v_action_count <> p_expected_action_count then
    raise exception using message = 'PROPOSED_ACTION_SET_CHANGED_DURING_FINALIZATION', errcode = 'P0001';
  end if;
  select pg_catalog.count(*), max(a.action_version)
  into v_action_count, v_max_action_version
  from public.crm_conversion_action a
  where a.center_id = v_center_id
    and a.conversion_request_id = p_conversion_request_id
    and a.status = 'REVIEWED';
  if v_action_count <> p_expected_action_count then
    raise exception using message = 'REVIEWED_ACTION_SET_INCOMPLETE', errcode = 'P0001';
  end if;
  v_final_digest := public.f23_3e_p3b_internal_action_set_digest(
    p_conversion_request_id, 'REVIEWED'
  );
  -- POST_REVIEWED_DIGEST_ORDER_END
  if v_final_digest is null then
    raise exception using message = 'REVIEWED_ACTION_SET_DIGEST_UNAVAILABLE', errcode = 'P0001';
  end if;

  perform public.f23_3e_p3b_internal_append_audit_outbox(
    v_center_id, 'crm.conversion.action_plan_finalized', p_actor_user_id,
    'crm_conversion_action_plan', p_conversion_request_id,
    p_conversion_request_id, v_request.source_assignment_id,
    1, 2, 'REVIEWED', 'action_plan_finalized',
    'conversion.finalize_action_plan', 'ACTION_PLAN_FINALIZED',
    v_correlation_id
  );

  v_snapshot := pg_catalog.jsonb_build_object(
    'result_schema_version', 1,
    'result_type', 'ACTION_PLAN_FINALIZATION',
    'resource_id', p_conversion_request_id,
    'resource_version', 2,
    'resource_status', 'REVIEWED',
    'request_id', p_conversion_request_id,
    'request_version', v_request.request_version,
    'guardian_action_id', (
      select a.conversion_action_id from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind = 'GUARDIAN'
    ),
    'guardian_action_version', (
      select a.action_version from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind = 'GUARDIAN'
    ),
    'student_action_id', (
      select a.conversion_action_id from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind = 'STUDENT'
    ),
    'student_action_version', (
      select a.action_version from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind = 'STUDENT'
    ),
    'relationship_action_id', (
      select a.conversion_action_id from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind is null
    ),
    'relationship_action_version', (
      select a.action_version from public.crm_conversion_action a
      where a.conversion_request_id = p_conversion_request_id
        and a.identity_kind is null
    ),
    'action_count', v_action_count,
    'action_set_encoding_version', 1,
    'action_set_digest', pg_catalog.encode(v_final_digest, 'hex'),
    'max_action_version', v_max_action_version,
    'correlation_id', v_correlation_id,
    'outcome_code', 'ACTION_PLAN_FINALIZED'
  );
  update public.crm_idempotency_registry i set
    status = 'COMPLETED',
    terminal_outcome_digest = public.f23_3e_p3b_internal_result_digest(v_snapshot),
    idempotency_version = i.idempotency_version + 1,
    completed_at = v_now,
    p3_action_set_encoding_version = 1,
    p3_action_set_digest = v_final_digest,
    p3_result_kind = 'ACTION_PLAN_FINALIZATION',
    p3_result_outcome_code = 'ACTION_PLAN_FINALIZED',
    p3_result_snapshot = v_snapshot,
    p3_result_correlation_id = v_correlation_id
  where i.idempotency_record_id = v_registry.idempotency_record_id;

  return query select true, 'ACTION_PLAN_FINALIZED', false,
    p_conversion_request_id, v_action_count, v_final_digest, 1,
    v_max_action_version, v_correlation_id;
exception
  when unique_violation then
    raise exception using message = 'ACTION_PLAN_CONCURRENCY_CONFLICT', errcode = 'P0001';
end;
$f23_3e_p3c_finalize_reviewed_action_plan$;
-- PLAN_FINALIZATION_CANONICAL_LOCK_ORDER_END

-- Every P3C internal primitive (including the P3B checkpoint adapter) is
-- intentionally inaccessible to application roles and service_role.
do $f23_3e_p3c_revoke_internal_functions$
declare
  v_function record;
begin
  for v_function in
    select p.oid::pg_catalog.regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'f23_3e_p3c_internal_%'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_function.signature
    );
  end loop;
end;
$f23_3e_p3c_revoke_internal_functions$;

revoke all on function public.f23_3e_p3b_evaluate_conversion_capability(uuid,uuid,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.f23_3e_p3b_evaluate_conversion_capability(uuid,uuid,uuid,integer)
  to service_role;

revoke all on function public.f23_3e_p3c_materialize_reviewed_action_pair(uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,integer,bytea,bytea,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p3c_finalize_reviewed_action_plan(uuid,uuid,integer,integer,bytea,bytea,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.f23_3e_p3c_materialize_reviewed_action_pair(uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,integer,bytea,bytea,timestamptz)
  to service_role;
grant execute on function public.f23_3e_p3c_finalize_reviewed_action_plan(uuid,uuid,integer,integer,bytea,bytea,timestamptz)
  to service_role;

comment on function public.f23_3e_p3c_materialize_reviewed_action_pair(uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,integer,bytea,bytea,timestamptz)
is 'P3C service-only reviewed evidence to exactly three immutable PROPOSED typed actions; no target or relationship write.';
comment on function public.f23_3e_p3c_finalize_reviewed_action_plan(uuid,uuid,integer,integer,bytea,bytea,timestamptz)
is 'P3C service-only atomic PROPOSED-to-REVIEWED +1 finalization with post-transition canonical digest; no conversion execution.';

commit;
