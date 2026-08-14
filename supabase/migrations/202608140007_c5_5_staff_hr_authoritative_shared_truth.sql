begin;

-- C5.5 keeps Staff HR distinct from both the C5.1 Teacher authority and
-- Auth/center_members.  Only stable references cross those boundaries.

create or replace function public.c5_5_staff_hr_access_role(p_center_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.lower(pg_catalog.btrim(cm.role))
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = pg_catalog.btrim(coalesce(p_center_id, ''))
    and cm.user_id = auth.uid()
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(cm.role)) in ('owner', 'center_admin')
  limit 1
$function$;

revoke all on function public.c5_5_staff_hr_access_role(text) from public, anon, authenticated;

create or replace function public.can_manage_staff_document_attachments(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and nullif(pg_catalog.btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
          in ('owner', 'center_admin')
    )
$function$;

create or replace function public.is_staff_document_attachment_owner(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and nullif(pg_catalog.btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_')) = 'owner'
    )
$function$;

create table public.center_staff_departments (
  center_id text not null references public.centers(id) on delete cascade,
  id text not null,
  name text not null,
  code text not null default '',
  description text not null default '',
  sort_order numeric not null default 0,
  status text not null default 'active',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_staff_departments_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_departments_name_check check (length(btrim(name)) between 1 and 200),
  constraint center_staff_departments_code_check check (length(code) <= 80),
  constraint center_staff_departments_description_check check (length(description) <= 2000),
  constraint center_staff_departments_status_check check (status in ('active', 'archived')),
  constraint center_staff_departments_archive_check check (
    (status = 'archived' and archived_at is not null)
    or (status = 'active' and archived_at is null)
  ),
  constraint center_staff_departments_version_check check (version >= 1)
);

create unique index center_staff_departments_name_unique
  on public.center_staff_departments (center_id, lower(btrim(name)));
create unique index center_staff_departments_code_unique
  on public.center_staff_departments (center_id, lower(btrim(code)))
  where btrim(code) <> '';

create table public.center_staff_hr_members (
  center_id text not null references public.centers(id) on delete cascade,
  id text not null,
  employee_code text not null default '',
  full_name text not null,
  phone text not null default '',
  email text not null default '',
  department_id text,
  position_title text not null default '',
  employment_type text not null default 'unspecified',
  employment_status text not null default 'active',
  start_date date,
  end_date date,
  teacher_local_id text,
  teacher_linked_at timestamptz,
  account_user_id uuid,
  membership_id uuid,
  account_linked_at timestamptz,
  employment_lifecycle_events jsonb not null default '[]'::jsonb,
  note text not null default '',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_staff_hr_members_department_fk foreign key (center_id, department_id)
    references public.center_staff_departments(center_id, id),
  constraint center_staff_hr_members_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_hr_members_name_check check (length(btrim(full_name)) between 1 and 200),
  constraint center_staff_hr_members_code_check check (length(employee_code) <= 80),
  constraint center_staff_hr_members_phone_check check (length(phone) <= 80),
  constraint center_staff_hr_members_email_check check (length(email) <= 320),
  constraint center_staff_hr_members_position_check check (length(position_title) <= 200),
  constraint center_staff_hr_members_type_check check (
    employment_type in ('full-time', 'part-time', 'collaborator', 'contract', 'unspecified')
  ),
  constraint center_staff_hr_members_status_check check (
    employment_status in ('active', 'on-leave', 'terminated')
  ),
  constraint center_staff_hr_members_dates_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint center_staff_hr_members_teacher_check check (
    (teacher_local_id is null and teacher_linked_at is null)
    or (teacher_local_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$' and teacher_linked_at is not null)
  ),
  constraint center_staff_hr_members_account_check check (
    (account_user_id is null and membership_id is null and account_linked_at is null)
    or (account_user_id is not null and membership_id is not null and account_linked_at is not null)
  ),
  constraint center_staff_hr_members_lifecycle_check check (
    jsonb_typeof(employment_lifecycle_events) = 'array'
    and octet_length(convert_to(employment_lifecycle_events::text, 'UTF8')) <= 131072
  ),
  constraint center_staff_hr_members_note_check check (length(note) <= 4000),
  constraint center_staff_hr_members_version_check check (version >= 1)
);

create unique index center_staff_hr_members_employee_code_unique
  on public.center_staff_hr_members (center_id, lower(btrim(employee_code)))
  where btrim(employee_code) <> '';
create unique index center_staff_hr_members_teacher_unique
  on public.center_staff_hr_members (center_id, teacher_local_id)
  where teacher_local_id is not null;
create unique index center_staff_hr_members_account_unique
  on public.center_staff_hr_members (center_id, account_user_id)
  where account_user_id is not null;
create unique index center_staff_hr_members_membership_unique
  on public.center_staff_hr_members (center_id, membership_id)
  where membership_id is not null;

-- Sensitive administrative data is deliberately stored in typed columns in a
-- dedicated forced-RLS table.  It is never placed in center_cloud_entities or
-- a generic browser/disk projection.
create table public.center_staff_administrative_profiles (
  center_id text not null references public.centers(id) on delete cascade,
  id text not null,
  staff_member_id text not null,
  schema_version integer not null default 1,
  legal_full_name text not null default '',
  date_of_birth date,
  gender text not null default '',
  nationality text not null default '',
  permanent_address_line text not null default '',
  permanent_ward_or_commune text not null default '',
  permanent_district text not null default '',
  permanent_province_or_city text not null default '',
  permanent_country text not null default '',
  current_address_line text not null default '',
  current_ward_or_commune text not null default '',
  current_district text not null default '',
  current_province_or_city text not null default '',
  current_country text not null default '',
  emergency_name text not null default '',
  emergency_phone text not null default '',
  emergency_relationship text not null default '',
  identity_type text not null default '',
  identity_number text not null default '',
  identity_issued_date date,
  identity_issued_place text not null default '',
  identity_expiry_date date,
  tax_number text not null default '',
  tax_registered_date date,
  tax_registered_place text not null default '',
  social_insurance_number text not null default '',
  health_insurance_number text not null default '',
  bank_name text not null default '',
  bank_account_number text not null default '',
  bank_account_holder_name text not null default '',
  bank_branch text not null default '',
  contract_number text not null default '',
  contract_type text not null default '',
  contract_signed_date date,
  contract_effective_date date,
  contract_expiry_date date,
  contract_signing_entity text not null default '',
  contract_note text not null default '',
  note text not null default '',
  completion_status text not null default 'incomplete',
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewed_by_label text not null default '',
  checklist_version text not null default 'f23.11b-v1',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_staff_admin_profiles_staff_fk foreign key (center_id, staff_member_id)
    references public.center_staff_hr_members(center_id, id),
  constraint center_staff_admin_profiles_staff_unique unique (center_id, staff_member_id),
  constraint center_staff_admin_profiles_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_admin_profiles_schema_check check (schema_version = 1),
  constraint center_staff_admin_profiles_completion_check check (
    completion_status in ('incomplete', 'complete', 'needs-review')
  ),
  constraint center_staff_admin_profiles_review_check check (
    completion_status <> 'complete'
    or (reviewed_at is not null and reviewed_by is not null and checklist_version = 'f23.11b-v1')
  ),
  constraint center_staff_admin_profiles_text_limits_check check (
    length(legal_full_name) <= 200
    and length(identity_number) <= 64
    and length(tax_number) <= 64
    and length(social_insurance_number) <= 64
    and length(health_insurance_number) <= 64
    and length(bank_account_number) <= 64
    and length(contract_number) <= 120
    and length(note) <= 2000
    and length(contract_note) <= 2000
  ),
  constraint center_staff_admin_profiles_version_check check (version >= 1)
);

create table public.center_staff_documents (
  center_id text not null references public.centers(id) on delete cascade,
  id text not null,
  staff_member_id text not null,
  administrative_profile_id text not null,
  schema_version integer not null default 1,
  category text not null,
  title text not null,
  document_number text not null default '',
  issued_date date,
  effective_date date,
  expiry_date date,
  note text not null default '',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_staff_documents_staff_fk foreign key (center_id, staff_member_id)
    references public.center_staff_hr_members(center_id, id),
  constraint center_staff_documents_profile_fk foreign key (center_id, administrative_profile_id)
    references public.center_staff_administrative_profiles(center_id, id),
  constraint center_staff_documents_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_documents_schema_check check (schema_version = 1),
  constraint center_staff_documents_category_check check (
    category in (
      'identity-document', 'employment-contract', 'contract-appendix', 'cv',
      'degree', 'certificate', 'insurance', 'decision', 'handover', 'other'
    )
  ),
  constraint center_staff_documents_title_check check (length(btrim(title)) between 1 and 240),
  constraint center_staff_documents_number_check check (length(document_number) <= 120),
  constraint center_staff_documents_note_check check (length(note) <= 2000),
  constraint center_staff_documents_dates_check check (
    (issued_date is null or effective_date is null or issued_date <= effective_date)
    and (issued_date is null or expiry_date is null or issued_date <= expiry_date)
    and (effective_date is null or expiry_date is null or effective_date <= expiry_date)
  ),
  constraint center_staff_documents_version_check check (version >= 1)
);

-- Reuse and version the protected attachment retention foundation.  C5.5 does
-- not create a competing HR retention authority.
alter table public.center_staff_document_attachment_retention_policies
  add column if not exists id text,
  add column if not exists schema_version integer not null default 1,
  add column if not exists version bigint not null default 1;

update public.center_staff_document_attachment_retention_policies
set id = 'staff-retention-' || substr(md5(center_id), 1, 24)
where id is null or btrim(id) = '';

alter table public.center_staff_document_attachment_retention_policies
  alter column id set not null,
  drop constraint if exists center_staff_document_attachment_retention_profile_days_check,
  drop constraint if exists center_staff_document_attachment_retention_document_days_check,
  drop constraint if exists center_staff_document_attachment_retention_grace_days_check,
  drop constraint if exists center_staff_document_attachment_retention_enabled_check,
  add constraint center_staff_document_attachment_retention_id_check
    check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  add constraint center_staff_document_attachment_retention_schema_check
    check (schema_version = 1),
  add constraint center_staff_document_attachment_retention_days_check
    check (
      profile_retention_days_after_employment_end between 0 and 36500
      and document_retention_days_after_employment_end between 0 and 36500
      and deletion_review_grace_days between 0 and 3650
    ),
  add constraint center_staff_document_attachment_retention_version_check
    check (version >= 1);

create table public.center_staff_deletion_requests (
  center_id text not null references public.centers(id) on delete cascade,
  id text not null,
  staff_member_id text not null,
  administrative_profile_id text not null,
  schema_version integer not null default 1,
  scope text not null,
  reason_code text not null,
  reason_note text not null,
  status text not null default 'pending-review',
  requested_by_user_id uuid not null references auth.users(id),
  requested_by_membership_id uuid not null references public.center_members(id),
  requested_by_role text not null,
  requested_at timestamptz not null,
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_by_membership_id uuid references public.center_members(id),
  reviewed_by_role text,
  reviewed_at timestamptz,
  review_note text not null default '',
  approved_at timestamptz,
  denied_at timestamptz,
  cancelled_at timestamptz,
  execution_eligible_at timestamptz,
  execution_state text not null default 'not-approved',
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (center_id, id),
  constraint center_staff_deletion_requests_staff_fk foreign key (center_id, staff_member_id)
    references public.center_staff_hr_members(center_id, id),
  constraint center_staff_deletion_requests_profile_fk foreign key (center_id, administrative_profile_id)
    references public.center_staff_administrative_profiles(center_id, id),
  constraint center_staff_deletion_requests_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_deletion_requests_schema_check check (schema_version = 1),
  constraint center_staff_deletion_requests_scope_check check (
    scope in ('administrative-profile', 'staff-documents', 'administrative-profile-and-documents')
  ),
  constraint center_staff_deletion_requests_reason_check check (
    reason_code in ('data-subject-request', 'duplicate-record', 'incorrect-record', 'retention-review', 'other')
    and length(reason_note) between 12 and 500
  ),
  constraint center_staff_deletion_requests_status_check check (
    status in ('pending-review', 'denied', 'cancelled', 'execution-pending')
  ),
  constraint center_staff_deletion_requests_execution_check check (
    execution_state in ('not-approved', 'waiting-backend')
  ),
  constraint center_staff_deletion_requests_version_check check (version >= 1)
);

create unique index center_staff_deletion_requests_one_active
  on public.center_staff_deletion_requests (center_id, administrative_profile_id)
  where status in ('pending-review', 'execution-pending');

create table public.center_staff_hr_audit_events (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  actor_membership_id uuid not null references public.center_members(id),
  actor_role text not null,
  operation text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  staff_member_id text,
  administrative_profile_id text,
  document_id text,
  request_id text,
  outcome text not null default 'success',
  reason_code text not null default 'server-commit',
  note_summary text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  constraint center_staff_hr_audit_action_check check (length(action) between 1 and 120),
  constraint center_staff_hr_audit_operation_check check (length(operation) between 1 and 80),
  constraint center_staff_hr_audit_entity_check check (length(entity_id) between 1 and 160),
  constraint center_staff_hr_audit_safe_summary_check check (
    note_summary = '' or note_summary ~ '^[a-z0-9][a-z0-9._-]{0,159}$'
  )
);

create index center_staff_hr_audit_center_time_idx
  on public.center_staff_hr_audit_events(center_id, created_at desc, id desc);

create table public.center_staff_hr_command_results (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (center_id, actor_user_id, idempotency_key),
  constraint center_staff_hr_command_digest_check check (octet_length(intent_digest) = 32),
  constraint center_staff_hr_command_result_check check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot->>'outcome_code' = 'COMMITTED'
  )
);

alter table public.center_staff_departments enable row level security;
alter table public.center_staff_departments force row level security;
alter table public.center_staff_hr_members enable row level security;
alter table public.center_staff_hr_members force row level security;
alter table public.center_staff_administrative_profiles enable row level security;
alter table public.center_staff_administrative_profiles force row level security;
alter table public.center_staff_documents enable row level security;
alter table public.center_staff_documents force row level security;
alter table public.center_staff_document_attachment_retention_policies enable row level security;
alter table public.center_staff_document_attachment_retention_policies force row level security;
alter table public.center_staff_deletion_requests enable row level security;
alter table public.center_staff_deletion_requests force row level security;
alter table public.center_staff_hr_audit_events enable row level security;
alter table public.center_staff_hr_audit_events force row level security;
alter table public.center_staff_hr_command_results enable row level security;
alter table public.center_staff_hr_command_results force row level security;

create policy "c5_5 exact center protected departments" on public.center_staff_departments
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);
create policy "c5_5 exact center protected staff members" on public.center_staff_hr_members
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);
create policy "c5_5 exact center protected profiles" on public.center_staff_administrative_profiles
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);
create policy "c5_5 exact center protected documents" on public.center_staff_documents
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);
create policy "c5_5 exact center protected deletion requests" on public.center_staff_deletion_requests
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);
create policy "c5_5 exact center protected audit" on public.center_staff_hr_audit_events
  for all to authenticated using (public.c5_5_staff_hr_access_role(center_id) is not null)
  with check (public.c5_5_staff_hr_access_role(center_id) is not null);

revoke all on table public.center_staff_departments from public, anon, authenticated, service_role;
revoke all on table public.center_staff_hr_members from public, anon, authenticated, service_role;
revoke all on table public.center_staff_administrative_profiles from public, anon, authenticated, service_role;
revoke all on table public.center_staff_documents from public, anon, authenticated, service_role;
revoke all on table public.center_staff_document_attachment_retention_policies
  from public, anon, authenticated, service_role;
revoke all on table public.center_staff_deletion_requests from public, anon, authenticated, service_role;
revoke all on table public.center_staff_hr_audit_events from public, anon, authenticated, service_role;
revoke all on table public.center_staff_hr_command_results from public, anon, authenticated, service_role;

create or replace function public.c5_5_list_staff_hr_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  v_role := public.c5_5_staff_hr_access_role(v_center_id);
  if v_role is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', v_center_id,
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'centerId', d.center_id, 'name', d.name, 'code', d.code,
        'description', d.description, 'sortOrder', d.sort_order, 'status', d.status,
        'createdAt', d.created_at, 'updatedAt', d.updated_at,
        'archivedAt', coalesce(d.archived_at::text, ''), 'cloudVersion', d.version
      ) order by d.sort_order, lower(d.name), d.id)
      from public.center_staff_departments d where d.center_id = v_center_id
    ), '[]'::jsonb),
    'staff_members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'centerId', s.center_id, 'employeeCode', s.employee_code,
        'fullName', s.full_name, 'phone', s.phone, 'email', s.email,
        'departmentId', coalesce(s.department_id, ''), 'positionTitle', s.position_title,
        'employmentType', s.employment_type, 'employmentStatus', s.employment_status,
        'startDate', coalesce(s.start_date::text, ''), 'endDate', coalesce(s.end_date::text, ''),
        'teacherId', coalesce(s.teacher_local_id, ''),
        'teacherLinkedAt', coalesce(s.teacher_linked_at::text, ''),
        'accountUserId', coalesce(s.account_user_id::text, ''),
        'membershipId', coalesce(s.membership_id::text, ''),
        'accountLinkedAt', coalesce(s.account_linked_at::text, ''),
        'employmentLifecycleEvents', s.employment_lifecycle_events, 'note', s.note,
        'createdAt', s.created_at, 'updatedAt', s.updated_at,
        'archivedAt', coalesce(s.archived_at::text, ''), 'cloudVersion', s.version
      ) order by s.created_at desc, s.id)
      from public.center_staff_hr_members s where s.center_id = v_center_id
    ), '[]'::jsonb),
    'administrative_profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'schemaVersion', p.schema_version, 'centerId', p.center_id,
        'staffMemberId', p.staff_member_id, 'legalFullName', p.legal_full_name,
        'dateOfBirth', coalesce(p.date_of_birth::text, ''), 'gender', p.gender,
        'nationality', p.nationality,
        'permanentAddress', jsonb_build_object(
          'addressLine', p.permanent_address_line, 'wardOrCommune', p.permanent_ward_or_commune,
          'district', p.permanent_district, 'provinceOrCity', p.permanent_province_or_city,
          'country', p.permanent_country),
        'currentAddress', jsonb_build_object(
          'addressLine', p.current_address_line, 'wardOrCommune', p.current_ward_or_commune,
          'district', p.current_district, 'provinceOrCity', p.current_province_or_city,
          'country', p.current_country),
        'emergencyContact', jsonb_build_object(
          'name', p.emergency_name, 'phone', p.emergency_phone,
          'relationship', p.emergency_relationship),
        'identityDocument', jsonb_build_object(
          'type', p.identity_type, 'number', p.identity_number,
          'issuedDate', coalesce(p.identity_issued_date::text, ''),
          'issuedPlace', p.identity_issued_place,
          'expiryDate', coalesce(p.identity_expiry_date::text, '')),
        'taxInformation', jsonb_build_object(
          'taxNumber', p.tax_number, 'registeredDate', coalesce(p.tax_registered_date::text, ''),
          'registeredPlace', p.tax_registered_place),
        'insuranceInformation', jsonb_build_object(
          'socialInsuranceNumber', p.social_insurance_number,
          'healthInsuranceNumber', p.health_insurance_number),
        'bankInformation', jsonb_build_object(
          'bankName', p.bank_name, 'accountNumber', p.bank_account_number,
          'accountHolderName', p.bank_account_holder_name, 'branch', p.bank_branch),
        'employmentAdministration', jsonb_build_object(
          'contractNumber', p.contract_number, 'contractType', p.contract_type,
          'signedDate', coalesce(p.contract_signed_date::text, ''),
          'effectiveDate', coalesce(p.contract_effective_date::text, ''),
          'expiryDate', coalesce(p.contract_expiry_date::text, ''),
          'signingEntity', p.contract_signing_entity, 'note', p.contract_note),
        'note', p.note, 'completionStatus', p.completion_status,
        'completionReview', jsonb_build_object(
          'reviewedAt', coalesce(p.reviewed_at::text, ''),
          'reviewedBy', coalesce(p.reviewed_by::text, ''),
          'reviewedByLabel', p.reviewed_by_label, 'checklistVersion', p.checklist_version),
        'revision', p.version, 'createdAt', p.created_at, 'updatedAt', p.updated_at,
        'archivedAt', coalesce(p.archived_at::text, ''), 'cloudVersion', p.version
      ) order by p.created_at desc, p.id)
      from public.center_staff_administrative_profiles p where p.center_id = v_center_id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'schemaVersion', d.schema_version, 'centerId', d.center_id,
        'staffMemberId', d.staff_member_id,
        'administrativeProfileId', d.administrative_profile_id,
        'category', d.category, 'title', d.title, 'documentNumber', d.document_number,
        'issuedDate', coalesce(d.issued_date::text, ''),
        'effectiveDate', coalesce(d.effective_date::text, ''),
        'expiryDate', coalesce(d.expiry_date::text, ''), 'note', d.note,
        'attachmentIds', coalesce((select jsonb_agg(a.id::text order by a.version desc)
          from public.center_staff_document_attachments a
          where a.center_id = d.center_id and a.staff_member_id = d.staff_member_id
            and a.administrative_profile_id = d.administrative_profile_id
            and a.document_id = d.id and a.state = 'available'
            and a.deleted_at is null), '[]'::jsonb),
        'revision', d.version, 'createdAt', d.created_at, 'updatedAt', d.updated_at,
        'archivedAt', coalesce(d.archived_at::text, ''), 'cloudVersion', d.version
      ) order by d.created_at desc, d.id)
      from public.center_staff_documents d where d.center_id = v_center_id
    ), '[]'::jsonb),
    'retention_policy', (
      select jsonb_build_object(
        'id', r.id, 'schemaVersion', r.schema_version, 'centerId', r.center_id,
        'profileRetentionDaysAfterEmploymentEnd', r.profile_retention_days_after_employment_end,
        'documentRetentionDaysAfterEmploymentEnd', r.document_retention_days_after_employment_end,
        'deletionReviewGraceDays', r.deletion_review_grace_days, 'enabled', r.enabled,
        'revision', r.version, 'createdAt', r.created_at, 'updatedAt', r.updated_at,
        'cloudVersion', r.version)
      from public.center_staff_document_attachment_retention_policies r
      where r.center_id = v_center_id
    ),
    'deletion_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'schemaVersion', r.schema_version, 'centerId', r.center_id,
        'staffMemberId', r.staff_member_id,
        'administrativeProfileId', r.administrative_profile_id,
        'scope', r.scope, 'reasonCode', r.reason_code, 'reasonNote', r.reason_note,
        'status', r.status, 'requestedByUserId', r.requested_by_user_id,
        'requestedByMembershipId', r.requested_by_membership_id,
        'requestedByRole', r.requested_by_role, 'requestedAt', r.requested_at,
        'reviewedByUserId', coalesce(r.reviewed_by_user_id::text, ''),
        'reviewedByMembershipId', coalesce(r.reviewed_by_membership_id::text, ''),
        'reviewedByRole', coalesce(r.reviewed_by_role, ''),
        'reviewedAt', coalesce(r.reviewed_at::text, ''), 'reviewNote', r.review_note,
        'approvedAt', coalesce(r.approved_at::text, ''),
        'deniedAt', coalesce(r.denied_at::text, ''),
        'cancelledAt', coalesce(r.cancelled_at::text, ''),
        'executionEligibleAt', coalesce(r.execution_eligible_at::text, ''),
        'executionState', r.execution_state, 'revision', r.version,
        'createdAt', r.created_at, 'updatedAt', r.updated_at,
        'cloudVersion', r.version
      ) order by r.created_at desc, r.id)
      from public.center_staff_deletion_requests r where r.center_id = v_center_id
    ), '[]'::jsonb),
    'audit_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'schemaVersion', 1, 'centerId', a.center_id,
        'actorUserId', a.actor_user_id, 'actorMembershipId', a.actor_membership_id,
        'actorRole', a.actor_role, 'action', a.action,
        'targetType', replace(a.entity_type, '_', '-'), 'targetId', a.entity_id,
        'staffMemberId', coalesce(a.staff_member_id, ''),
        'administrativeProfileId', coalesce(a.administrative_profile_id, ''),
        'documentId', coalesce(a.document_id, ''), 'attachmentId', '',
        'outcome', a.outcome, 'reasonCode', a.reason_code,
        'noteSummary', a.note_summary, 'requestId', coalesce(a.request_id, ''),
        'createdAt', a.created_at
      ) order by a.created_at desc, a.id desc)
      from public.center_staff_hr_audit_events a
      where a.center_id = v_center_id
        and a.action in (
          'administrative-profile.create', 'administrative-profile.edit',
          'staff-document.create', 'staff-document.edit',
          'staff-document.archive', 'staff-document.restore',
          'retention-policy.update', 'deletion-request.create',
          'deletion-request.cancel', 'deletion-request.approve', 'deletion-request.deny'
        )
    ), '[]'::jsonb)
  );
end
$function$;

create or replace function public.c5_5_mutate_staff_hr_shared_truth(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_center_id text := btrim(coalesce(p_center_id, ''));
  v_role text;
  v_membership_id uuid;
  v_operation text := upper(btrim(coalesce(p_command->>'operation', '')));
  v_entity_type text := lower(btrim(coalesce(p_command->>'entity_type', '')));
  v_entity_id text := btrim(coalesce(p_command->>'entity_id', ''));
  v_expected_version bigint;
  v_payload jsonb;
  v_digest bytea;
  v_existing_result public.center_staff_hr_command_results%rowtype;
  v_current_version bigint;
  v_new_version bigint;
  v_now timestamptz := clock_timestamp();
  v_action text;
  v_staff_member_id text;
  v_profile_id text;
  v_document_id text;
  v_request_id text;
  v_existing_teacher text;
  v_existing_account uuid;
  v_existing_membership uuid;
  v_teacher text;
  v_account uuid;
  v_membership uuid;
  v_review_decision text;
  v_grace_days integer;
  v_request public.center_staff_deletion_requests%rowtype;
  v_result jsonb;
begin
  if v_actor is null then return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED'); end if;
  if v_center_id = '' or length(v_center_id) > 160 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_idempotency_key is null or jsonb_typeof(p_command) <> 'object' then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  if v_entity_type not in (
    'department', 'staff_member', 'administrative_profile', 'staff_document',
    'retention_policy', 'deletion_request'
  ) or v_entity_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$' then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_ENTITY_TYPE');
  end if;
  begin
    v_expected_version := (p_command->>'expected_version')::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end;
  if v_expected_version < 0 or v_operation not in ('UPSERT', 'CREATE', 'CANCEL', 'REVIEW') then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select lower(btrim(cm.role)), cm.id into v_role, v_membership_id
  from public.center_members cm join public.centers c on c.id = cm.center_id
  where cm.center_id = v_center_id and cm.user_id = v_actor
    and lower(btrim(coalesce(cm.status, ''))) = 'active'
    and lower(btrim(coalesce(c.status, ''))) = 'active'
  for share of cm, c;
  if v_role is null then return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED'); end if;
  if v_role not in ('owner', 'center_admin') then
    return jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  v_payload := coalesce(p_command->'payload', '{}'::jsonb)
    - 'cloudVersion' - 'cloudUpdatedAt' - 'createdAt' - 'updatedAt' - 'revision';
  if jsonb_typeof(v_payload) <> 'object'
    or octet_length(convert_to(v_payload::text, 'UTF8')) > 262144
    or btrim(coalesce(v_payload->>'id', '')) <> v_entity_id
    or btrim(coalesce(v_payload->>'centerId', '')) <> v_center_id then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;
  v_digest := extensions.digest(convert_to(jsonb_build_object(
    'contract_version', 1, 'center_id', v_center_id, 'operation', v_operation,
    'entity_type', v_entity_type, 'entity_id', v_entity_id,
    'expected_version', v_expected_version, 'payload', v_payload
  )::text, 'UTF8'), 'sha256');

  select * into v_existing_result from public.center_staff_hr_command_results r
  where r.center_id = v_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_result.intent_digest <> v_digest then
      return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_center_id || ':' || v_entity_type || ':' || v_entity_id, 0));

  if v_entity_type = 'department' then
    if v_operation <> 'UPSERT' then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;
    select version into v_current_version from public.center_staff_departments
      where center_id = v_center_id and id = v_entity_id for update;
    if coalesce(v_current_version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_new_version := v_expected_version + 1;
    insert into public.center_staff_departments (
      center_id, id, name, code, description, sort_order, status, version,
      created_by, updated_by, created_at, updated_at, archived_at
    ) values (
      v_center_id, v_entity_id, btrim(coalesce(v_payload->>'name', '')),
      btrim(coalesce(v_payload->>'code', '')), btrim(coalesce(v_payload->>'description', '')),
      coalesce((v_payload->>'sortOrder')::numeric, 0),
      lower(btrim(coalesce(v_payload->>'status', 'active'))), v_new_version,
      v_actor, v_actor, v_now, v_now,
      case when lower(btrim(coalesce(v_payload->>'status', 'active'))) = 'archived' then v_now end
    ) on conflict (center_id, id) do update set
      name = excluded.name, code = excluded.code, description = excluded.description,
      sort_order = excluded.sort_order, status = excluded.status, version = excluded.version,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at,
      archived_at = excluded.archived_at;
    v_action := 'department.upsert';

  elsif v_entity_type = 'staff_member' then
    if v_operation <> 'UPSERT' then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;
    select version, teacher_local_id, account_user_id, membership_id
      into v_current_version, v_existing_teacher, v_existing_account, v_existing_membership
    from public.center_staff_hr_members where center_id = v_center_id and id = v_entity_id for update;
    if coalesce(v_current_version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_teacher := nullif(btrim(coalesce(v_payload->>'teacherId', '')), '');
    v_account := nullif(btrim(coalesce(v_payload->>'accountUserId', '')), '')::uuid;
    v_membership := nullif(btrim(coalesce(v_payload->>'membershipId', '')), '')::uuid;
    if (v_teacher is null) <> (nullif(btrim(coalesce(v_payload->>'teacherLinkedAt', '')), '') is null)
      or (v_account is null) <> (v_membership is null)
      or (v_account is null) <> (nullif(btrim(coalesce(v_payload->>'accountLinkedAt', '')), '') is null) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
    end if;
    if v_teacher is distinct from v_existing_teacher and v_teacher is not null and not exists (
      select 1 from public.center_cloud_entities e where e.center_id = v_center_id
        and e.entity_type = 'teacher' and e.local_id = v_teacher and e.deleted_at is null
    ) then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE'); end if;
    if (v_account is distinct from v_existing_account or v_membership is distinct from v_existing_membership)
      and v_account is not null and not exists (
        select 1 from public.center_members cm where cm.id = v_membership
          and cm.center_id = v_center_id and cm.user_id = v_account
          and lower(btrim(coalesce(cm.status, ''))) = 'active'
      ) then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE'); end if;
    v_new_version := v_expected_version + 1;
    insert into public.center_staff_hr_members (
      center_id, id, employee_code, full_name, phone, email, department_id,
      position_title, employment_type, employment_status, start_date, end_date,
      teacher_local_id, teacher_linked_at, account_user_id, membership_id,
      account_linked_at, employment_lifecycle_events, note, version,
      created_by, updated_by, created_at, updated_at, archived_at
    ) values (
      v_center_id, v_entity_id, btrim(coalesce(v_payload->>'employeeCode', '')),
      btrim(coalesce(v_payload->>'fullName', '')), btrim(coalesce(v_payload->>'phone', '')),
      btrim(coalesce(v_payload->>'email', '')), nullif(btrim(coalesce(v_payload->>'departmentId', '')), ''),
      btrim(coalesce(v_payload->>'positionTitle', '')),
      lower(btrim(coalesce(v_payload->>'employmentType', 'unspecified'))),
      lower(btrim(coalesce(v_payload->>'employmentStatus', 'active'))),
      nullif(btrim(coalesce(v_payload->>'startDate', '')), '')::date,
      nullif(btrim(coalesce(v_payload->>'endDate', '')), '')::date,
      v_teacher, case
        when v_teacher is null then null
        when v_teacher is not distinct from v_existing_teacher then
          coalesce((select s.teacher_linked_at from public.center_staff_hr_members s
            where s.center_id = v_center_id and s.id = v_entity_id), v_now)
        else v_now end,
      v_account, v_membership,
      case
        when v_account is null then null
        when v_account is not distinct from v_existing_account
          and v_membership is not distinct from v_existing_membership then
          coalesce((select s.account_linked_at from public.center_staff_hr_members s
            where s.center_id = v_center_id and s.id = v_entity_id), v_now)
        else v_now end,
      coalesce(v_payload->'employmentLifecycleEvents', '[]'::jsonb),
      btrim(coalesce(v_payload->>'note', '')), v_new_version,
      v_actor, v_actor, v_now, v_now,
      nullif(btrim(coalesce(v_payload->>'archivedAt', '')), '')::timestamptz
    ) on conflict (center_id, id) do update set
      employee_code = excluded.employee_code, full_name = excluded.full_name,
      phone = excluded.phone, email = excluded.email, department_id = excluded.department_id,
      position_title = excluded.position_title, employment_type = excluded.employment_type,
      employment_status = excluded.employment_status, start_date = excluded.start_date,
      end_date = excluded.end_date, teacher_local_id = excluded.teacher_local_id,
      teacher_linked_at = excluded.teacher_linked_at, account_user_id = excluded.account_user_id,
      membership_id = excluded.membership_id, account_linked_at = excluded.account_linked_at,
      employment_lifecycle_events = excluded.employment_lifecycle_events, note = excluded.note,
      version = excluded.version, updated_by = excluded.updated_by,
      updated_at = excluded.updated_at, archived_at = excluded.archived_at;
    v_action := 'staff-member.upsert'; v_staff_member_id := v_entity_id;

  elsif v_entity_type = 'administrative_profile' then
    if v_operation <> 'UPSERT' then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;
    if coalesce((v_payload->>'schemaVersion')::integer, 0) <> 1 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_staff_member_id := btrim(coalesce(v_payload->>'staffMemberId', ''));
    if not exists (select 1 from public.center_staff_hr_members s
      where s.center_id = v_center_id and s.id = v_staff_member_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
    end if;
    select version into v_current_version from public.center_staff_administrative_profiles
      where center_id = v_center_id and id = v_entity_id for update;
    if coalesce(v_current_version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_new_version := v_expected_version + 1;
    insert into public.center_staff_administrative_profiles (
      center_id, id, staff_member_id, legal_full_name, date_of_birth, gender, nationality,
      permanent_address_line, permanent_ward_or_commune, permanent_district,
      permanent_province_or_city, permanent_country, current_address_line,
      current_ward_or_commune, current_district, current_province_or_city, current_country,
      emergency_name, emergency_phone, emergency_relationship, identity_type, identity_number,
      identity_issued_date, identity_issued_place, identity_expiry_date, tax_number,
      tax_registered_date, tax_registered_place, social_insurance_number,
      health_insurance_number, bank_name, bank_account_number, bank_account_holder_name,
      bank_branch, contract_number, contract_type, contract_signed_date,
      contract_effective_date, contract_expiry_date, contract_signing_entity, contract_note,
      note, completion_status, reviewed_at, reviewed_by, reviewed_by_label,
      checklist_version, version, created_by, updated_by, created_at, updated_at, archived_at
    ) values (
      v_center_id, v_entity_id, v_staff_member_id,
      btrim(coalesce(v_payload->>'legalFullName', '')),
      nullif(btrim(coalesce(v_payload->>'dateOfBirth', '')), '')::date,
      btrim(coalesce(v_payload->>'gender', '')), btrim(coalesce(v_payload->>'nationality', '')),
      btrim(coalesce(v_payload#>>'{permanentAddress,addressLine}', '')),
      btrim(coalesce(v_payload#>>'{permanentAddress,wardOrCommune}', '')),
      btrim(coalesce(v_payload#>>'{permanentAddress,district}', '')),
      btrim(coalesce(v_payload#>>'{permanentAddress,provinceOrCity}', '')),
      btrim(coalesce(v_payload#>>'{permanentAddress,country}', '')),
      btrim(coalesce(v_payload#>>'{currentAddress,addressLine}', '')),
      btrim(coalesce(v_payload#>>'{currentAddress,wardOrCommune}', '')),
      btrim(coalesce(v_payload#>>'{currentAddress,district}', '')),
      btrim(coalesce(v_payload#>>'{currentAddress,provinceOrCity}', '')),
      btrim(coalesce(v_payload#>>'{currentAddress,country}', '')),
      btrim(coalesce(v_payload#>>'{emergencyContact,name}', '')),
      btrim(coalesce(v_payload#>>'{emergencyContact,phone}', '')),
      btrim(coalesce(v_payload#>>'{emergencyContact,relationship}', '')),
      btrim(coalesce(v_payload#>>'{identityDocument,type}', '')),
      btrim(coalesce(v_payload#>>'{identityDocument,number}', '')),
      nullif(btrim(coalesce(v_payload#>>'{identityDocument,issuedDate}', '')), '')::date,
      btrim(coalesce(v_payload#>>'{identityDocument,issuedPlace}', '')),
      nullif(btrim(coalesce(v_payload#>>'{identityDocument,expiryDate}', '')), '')::date,
      btrim(coalesce(v_payload#>>'{taxInformation,taxNumber}', '')),
      nullif(btrim(coalesce(v_payload#>>'{taxInformation,registeredDate}', '')), '')::date,
      btrim(coalesce(v_payload#>>'{taxInformation,registeredPlace}', '')),
      btrim(coalesce(v_payload#>>'{insuranceInformation,socialInsuranceNumber}', '')),
      btrim(coalesce(v_payload#>>'{insuranceInformation,healthInsuranceNumber}', '')),
      btrim(coalesce(v_payload#>>'{bankInformation,bankName}', '')),
      btrim(coalesce(v_payload#>>'{bankInformation,accountNumber}', '')),
      btrim(coalesce(v_payload#>>'{bankInformation,accountHolderName}', '')),
      btrim(coalesce(v_payload#>>'{bankInformation,branch}', '')),
      btrim(coalesce(v_payload#>>'{employmentAdministration,contractNumber}', '')),
      btrim(coalesce(v_payload#>>'{employmentAdministration,contractType}', '')),
      nullif(btrim(coalesce(v_payload#>>'{employmentAdministration,signedDate}', '')), '')::date,
      nullif(btrim(coalesce(v_payload#>>'{employmentAdministration,effectiveDate}', '')), '')::date,
      nullif(btrim(coalesce(v_payload#>>'{employmentAdministration,expiryDate}', '')), '')::date,
      btrim(coalesce(v_payload#>>'{employmentAdministration,signingEntity}', '')),
      btrim(coalesce(v_payload#>>'{employmentAdministration,note}', '')),
      btrim(coalesce(v_payload->>'note', '')),
      lower(btrim(coalesce(v_payload->>'completionStatus', 'incomplete'))),
      case when lower(btrim(coalesce(v_payload->>'completionStatus', 'incomplete'))) = 'complete'
        then v_now end,
      case when lower(btrim(coalesce(v_payload->>'completionStatus', 'incomplete'))) = 'complete'
        then v_actor end,
      btrim(coalesce(v_payload#>>'{completionReview,reviewedByLabel}', '')),
      btrim(coalesce(v_payload#>>'{completionReview,checklistVersion}', 'f23.11b-v1')),
      v_new_version, v_actor, v_actor, v_now, v_now,
      nullif(btrim(coalesce(v_payload->>'archivedAt', '')), '')::timestamptz
    ) on conflict (center_id, id) do update set
      staff_member_id = excluded.staff_member_id, legal_full_name = excluded.legal_full_name,
      date_of_birth = excluded.date_of_birth, gender = excluded.gender, nationality = excluded.nationality,
      permanent_address_line = excluded.permanent_address_line,
      permanent_ward_or_commune = excluded.permanent_ward_or_commune,
      permanent_district = excluded.permanent_district,
      permanent_province_or_city = excluded.permanent_province_or_city,
      permanent_country = excluded.permanent_country, current_address_line = excluded.current_address_line,
      current_ward_or_commune = excluded.current_ward_or_commune,
      current_district = excluded.current_district,
      current_province_or_city = excluded.current_province_or_city,
      current_country = excluded.current_country, emergency_name = excluded.emergency_name,
      emergency_phone = excluded.emergency_phone, emergency_relationship = excluded.emergency_relationship,
      identity_type = excluded.identity_type, identity_number = excluded.identity_number,
      identity_issued_date = excluded.identity_issued_date,
      identity_issued_place = excluded.identity_issued_place,
      identity_expiry_date = excluded.identity_expiry_date, tax_number = excluded.tax_number,
      tax_registered_date = excluded.tax_registered_date,
      tax_registered_place = excluded.tax_registered_place,
      social_insurance_number = excluded.social_insurance_number,
      health_insurance_number = excluded.health_insurance_number, bank_name = excluded.bank_name,
      bank_account_number = excluded.bank_account_number,
      bank_account_holder_name = excluded.bank_account_holder_name, bank_branch = excluded.bank_branch,
      contract_number = excluded.contract_number, contract_type = excluded.contract_type,
      contract_signed_date = excluded.contract_signed_date,
      contract_effective_date = excluded.contract_effective_date,
      contract_expiry_date = excluded.contract_expiry_date,
      contract_signing_entity = excluded.contract_signing_entity, contract_note = excluded.contract_note,
      note = excluded.note, completion_status = excluded.completion_status,
      reviewed_at = excluded.reviewed_at, reviewed_by = excluded.reviewed_by,
      reviewed_by_label = excluded.reviewed_by_label, checklist_version = excluded.checklist_version,
      version = excluded.version, updated_by = excluded.updated_by,
      updated_at = excluded.updated_at, archived_at = excluded.archived_at;
    v_action := case when v_expected_version = 0 then 'administrative-profile.create'
      else 'administrative-profile.edit' end;
    v_profile_id := v_entity_id;

  elsif v_entity_type = 'staff_document' then
    if v_operation <> 'UPSERT' then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;
    if coalesce((v_payload->>'schemaVersion')::integer, 0) <> 1 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_staff_member_id := btrim(coalesce(v_payload->>'staffMemberId', ''));
    v_profile_id := btrim(coalesce(v_payload->>'administrativeProfileId', ''));
    if not exists (select 1 from public.center_staff_administrative_profiles p
      where p.center_id = v_center_id and p.id = v_profile_id
        and p.staff_member_id = v_staff_member_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
    end if;
    select version into v_current_version from public.center_staff_documents
      where center_id = v_center_id and id = v_entity_id for update;
    if coalesce(v_current_version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_new_version := v_expected_version + 1;
    v_action := case
      when v_expected_version = 0 then 'staff-document.create'
      when nullif(btrim(coalesce(v_payload->>'archivedAt', '')), '') is not null then 'staff-document.archive'
      else 'staff-document.edit' end;
    insert into public.center_staff_documents (
      center_id, id, staff_member_id, administrative_profile_id, category, title,
      document_number, issued_date, effective_date, expiry_date, note, version,
      created_by, updated_by, created_at, updated_at, archived_at
    ) values (
      v_center_id, v_entity_id, v_staff_member_id, v_profile_id,
      lower(btrim(coalesce(v_payload->>'category', ''))), btrim(coalesce(v_payload->>'title', '')),
      btrim(coalesce(v_payload->>'documentNumber', '')),
      nullif(btrim(coalesce(v_payload->>'issuedDate', '')), '')::date,
      nullif(btrim(coalesce(v_payload->>'effectiveDate', '')), '')::date,
      nullif(btrim(coalesce(v_payload->>'expiryDate', '')), '')::date,
      btrim(coalesce(v_payload->>'note', '')), v_new_version,
      v_actor, v_actor, v_now, v_now,
      nullif(btrim(coalesce(v_payload->>'archivedAt', '')), '')::timestamptz
    ) on conflict (center_id, id) do update set
      staff_member_id = excluded.staff_member_id,
      administrative_profile_id = excluded.administrative_profile_id,
      category = excluded.category, title = excluded.title,
      document_number = excluded.document_number, issued_date = excluded.issued_date,
      effective_date = excluded.effective_date, expiry_date = excluded.expiry_date,
      note = excluded.note, version = excluded.version, updated_by = excluded.updated_by,
      updated_at = excluded.updated_at, archived_at = excluded.archived_at;
    if v_expected_version > 0 and nullif(btrim(coalesce(v_payload->>'archivedAt', '')), '') is null
      and exists (select 1 from public.center_staff_documents d where d.center_id = v_center_id
        and d.id = v_entity_id and d.archived_at is null) then
      v_action := case when btrim(coalesce(p_command->>'audit_action', '')) = 'staff-document.restore'
        then 'staff-document.restore' else 'staff-document.edit' end;
    end if;
    v_document_id := v_entity_id;

  elsif v_entity_type = 'retention_policy' then
    if v_operation <> 'UPSERT' then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;
    if v_role <> 'owner' then
      return jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
    end if;
    if coalesce((v_payload->>'schemaVersion')::integer, 0) <> 1 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    select version into v_current_version
      from public.center_staff_document_attachment_retention_policies
      where center_id = v_center_id for update;
    if coalesce(v_current_version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_new_version := v_expected_version + 1;
    v_staff_member_id := btrim(coalesce(v_payload->>'staffMemberId', ''));
    v_profile_id := btrim(coalesce(v_payload->>'administrativeProfileId', ''));
    if not exists (select 1 from public.center_staff_administrative_profiles p
      where p.center_id = v_center_id and p.id = v_profile_id
        and p.staff_member_id = v_staff_member_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
    end if;
    insert into public.center_staff_document_attachment_retention_policies (
      center_id, id, profile_retention_days_after_employment_end,
      document_retention_days_after_employment_end,
      deletion_review_grace_days, enabled, version, configured_by_user_id,
      created_at, updated_at
    ) values (
      v_center_id, v_entity_id,
      (v_payload->>'profileRetentionDaysAfterEmploymentEnd')::integer,
      (v_payload->>'documentRetentionDaysAfterEmploymentEnd')::integer,
      (v_payload->>'deletionReviewGraceDays')::integer,
      (v_payload->>'enabled')::boolean, v_new_version,
      v_actor, v_now, v_now
    ) on conflict (center_id) do update set
      id = excluded.id,
      profile_retention_days_after_employment_end = excluded.profile_retention_days_after_employment_end,
      document_retention_days_after_employment_end = excluded.document_retention_days_after_employment_end,
      deletion_review_grace_days = excluded.deletion_review_grace_days,
      enabled = excluded.enabled, version = excluded.version,
      configured_by_user_id = excluded.configured_by_user_id,
      updated_at = excluded.updated_at;
    v_action := 'retention-policy.update';

  elsif v_entity_type = 'deletion_request' then
    if coalesce((v_payload->>'schemaVersion')::integer, 0) <> 1 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_staff_member_id := btrim(coalesce(v_payload->>'staffMemberId', ''));
    v_profile_id := btrim(coalesce(v_payload->>'administrativeProfileId', ''));
    if not exists (select 1 from public.center_staff_administrative_profiles p
      where p.center_id = v_center_id and p.id = v_profile_id
        and p.staff_member_id = v_staff_member_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
    end if;
    select * into v_request from public.center_staff_deletion_requests
      where center_id = v_center_id and id = v_entity_id for update;
    if coalesce(v_request.version, 0) <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_new_version := v_expected_version + 1;
    if v_operation = 'CREATE' and v_expected_version = 0 then
      insert into public.center_staff_deletion_requests (
        center_id, id, staff_member_id, administrative_profile_id, scope,
        reason_code, reason_note, status, requested_by_user_id,
        requested_by_membership_id, requested_by_role, requested_at,
        execution_state, version, created_at, updated_at
      ) values (
        v_center_id, v_entity_id, v_staff_member_id, v_profile_id,
        lower(btrim(coalesce(v_payload->>'scope', ''))),
        lower(btrim(coalesce(v_payload->>'reasonCode', ''))),
        btrim(coalesce(v_payload->>'reasonNote', '')), 'pending-review',
        v_actor, v_membership_id, v_role, v_now, 'not-approved', 1, v_now, v_now
      );
      v_action := 'deletion-request.create';
    elsif v_operation = 'CANCEL' and v_request.status = 'pending-review'
      and (v_role = 'owner' or (v_request.requested_by_user_id = v_actor
        and v_request.requested_by_membership_id = v_membership_id)) then
      update public.center_staff_deletion_requests set
        status = 'cancelled', cancelled_at = v_now, updated_at = v_now,
        version = v_new_version where center_id = v_center_id and id = v_entity_id;
      v_action := 'deletion-request.cancel';
    elsif v_operation = 'REVIEW' and v_role = 'owner' and v_request.status = 'pending-review' then
      if v_request.requested_by_user_id = v_actor
        or v_request.requested_by_membership_id = v_membership_id then
        return jsonb_build_object('ok', false, 'outcome_code', 'SEPARATION_OF_DUTIES_REQUIRED');
      end if;
      v_review_decision := lower(btrim(coalesce(v_payload->>'reviewDecision', '')));
      if v_review_decision not in ('approve', 'deny')
        or length(btrim(coalesce(v_payload->>'reviewNote', ''))) > 500 then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      select coalesce(r.deletion_review_grace_days, 0) into v_grace_days
        from public.center_staff_document_attachment_retention_policies r
        where r.center_id = v_center_id;
      update public.center_staff_deletion_requests set
        status = case when v_review_decision = 'approve' then 'execution-pending' else 'denied' end,
        reviewed_by_user_id = v_actor, reviewed_by_membership_id = v_membership_id,
        reviewed_by_role = v_role, reviewed_at = v_now,
        review_note = btrim(coalesce(v_payload->>'reviewNote', '')),
        approved_at = case when v_review_decision = 'approve' then v_now end,
        denied_at = case when v_review_decision = 'deny' then v_now end,
        execution_eligible_at = case when v_review_decision = 'approve'
          then v_now + make_interval(days => coalesce(v_grace_days, 0)) end,
        execution_state = case when v_review_decision = 'approve'
          then 'waiting-backend' else 'not-approved' end,
        updated_at = v_now, version = v_new_version
      where center_id = v_center_id and id = v_entity_id;
      v_action := case when v_review_decision = 'approve'
        then 'deletion-request.approve' else 'deletion-request.deny' end;
    else
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_STATE_TRANSITION');
    end if;
    v_request_id := v_entity_id;
  end if;

  insert into public.center_staff_hr_audit_events (
    center_id, actor_user_id, actor_membership_id, actor_role, operation,
    action, entity_type, entity_id, staff_member_id,
    administrative_profile_id, document_id, request_id, note_summary
  ) values (
    v_center_id, v_actor, v_membership_id, v_role, v_operation,
    v_action, v_entity_type, v_entity_id, v_staff_member_id,
    v_profile_id, v_document_id, v_request_id, 'server-commit'
  );

  v_result := jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', v_center_id,
    'entity_type', v_entity_type, 'entity_id', v_entity_id,
    'entity_version', v_new_version, 'committed_at', v_now
  );
  insert into public.center_staff_hr_command_results (
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (v_center_id, v_actor, p_idempotency_key, v_digest, v_result);
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'UNIQUE_CONFLICT');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  when serialization_failure or deadlock_detected then
    return jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end
$function$;

revoke all on function public.c5_5_list_staff_hr_shared_truth(text)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_5_mutate_staff_hr_shared_truth(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.c5_5_list_staff_hr_shared_truth(text) to authenticated;
grant execute on function public.c5_5_mutate_staff_hr_shared_truth(text, jsonb, uuid) to authenticated;

comment on table public.center_staff_administrative_profiles is
  'C5.5 typed, protected, memory-projected administrative HR profile authority.';
comment on table public.center_staff_hr_members is
  'C5.5 Staff HR authority; teacher_local_id and membership_id are references only.';
comment on table public.center_staff_hr_audit_events is
  'Server-authored Staff HR mutation evidence; never stores profile/document payloads.';

commit;
