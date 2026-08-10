-- F23.3E-P1E: fail-closed CRM read path, server-side masked projections,
-- and LocalStorage import-preview readiness. Backend/local only.

begin;

set local check_function_bodies = true;

do $f23_3e_p1e_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.consultation_case') is null
     or pg_catalog.to_regclass('public.consultation_case_candidate_student') is null
     or pg_catalog.to_regclass('public.consultation_case_assignment') is null
     or pg_catalog.to_regclass('public.crm_care_log') is null
     or pg_catalog.to_regclass('public.crm_conversion_request') is null
     or pg_catalog.to_regclass('public.crm_idempotency_registry') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regclass('public.center_members') is null then
    raise exception 'f23_3e_p1e_missing_schema_prerequisite';
  end if;

  if pg_catalog.to_regprocedure('public.f23_3e_p1d_create_crm_contact(uuid,text,uuid,text,bytea,integer,bytea[],integer)') is null then
    raise exception 'f23_3e_p1e_missing_p1d_runtime_prerequisite';
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'f23_3e_p1e_missing_service_role';
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
    raise exception 'f23_3e_p1e_membership_catalog_unavailable';
  end if;
end;
$f23_3e_p1e_prerequisites$;

-- P1E_RLS_FAIL_CLOSED_BEGIN
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
from public, anon, authenticated, service_role;
-- P1E_RLS_FAIL_CLOSED_END

-- Administrative migration-only remediation. Every command is a constant over
-- the closed canonical CRM inventory; application RPCs contain no dynamic SQL.
do $f23_3e_p1e_realtime_remediation$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'center_crm_control') then
      execute 'alter publication supabase_realtime drop table public.center_crm_control';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_contact') then
      execute 'alter publication supabase_realtime drop table public.crm_contact';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultation_case') then
      execute 'alter publication supabase_realtime drop table public.consultation_case';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultation_case_candidate_student') then
      execute 'alter publication supabase_realtime drop table public.consultation_case_candidate_student';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'consultation_case_assignment') then
      execute 'alter publication supabase_realtime drop table public.consultation_case_assignment';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_care_log') then
      execute 'alter publication supabase_realtime drop table public.crm_care_log';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_conversion_request') then
      execute 'alter publication supabase_realtime drop table public.crm_conversion_request';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_idempotency_registry') then
      execute 'alter publication supabase_realtime drop table public.crm_idempotency_registry';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_audit_event') then
      execute 'alter publication supabase_realtime drop table public.crm_audit_event';
    end if;
    if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_outbox_event') then
      execute 'alter publication supabase_realtime drop table public.crm_outbox_event';
    end if;
  end if;
end;
$f23_3e_p1e_realtime_remediation$;

create index if not exists crm_contact_center_updated_keyset_idx
  on public.crm_contact (center_id, updated_at, crm_contact_id);
create index if not exists consultation_case_center_updated_keyset_idx
  on public.consultation_case (center_id, updated_at, consultation_case_id);
create index if not exists crm_care_log_case_created_keyset_idx
  on public.crm_care_log (center_id, consultation_case_id, created_at, care_log_id);

create function public.f23_3e_p1e_internal_lock_center_read_role(
  p_actor_user_id uuid,
  p_center_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_internal_lock_center_read_role$
declare
  v_root public.center_crm_control%rowtype;
  v_membership public.center_members%rowtype;
begin
  if p_actor_user_id is null or p_center_id is null or p_center_id <> pg_catalog.btrim(p_center_id) or p_center_id = '' then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  -- P1E_CENTER_READ_LOCK_ORDER: ROOT, AUTH_USER, EXACT_MEMBERSHIP.
  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = p_center_id
  for share;
  if not found
     or v_root.crm_state not in ('READ_ONLY', 'ACTIVE')
     or v_root.feature_flag_state not in ('READ_ONLY', 'ENABLED') then
    raise exception using errcode = '42501', message = 'CRM_READ_NOT_ACTIVE';
  end if;

  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    raise exception using errcode = '42501', message = 'READ_SCOPE_DENIED';
  end if;

  select m.* into v_membership
  from public.center_members m
  where m.center_id = p_center_id and m.user_id = p_actor_user_id
  order by m.id
  limit 1
  for share;
  if not found
     or v_membership.status <> 'active'
     or v_membership.role not in ('owner', 'center_admin', 'consultant') then
    raise exception using errcode = '42501', message = 'READ_SCOPE_DENIED';
  end if;

  return v_membership.role;
end;
$f23_3e_p1e_internal_lock_center_read_role$;

create function public.f23_3e_p1e_internal_lock_case_read_role(
  p_actor_user_id uuid,
  p_case_id uuid
)
returns table (center_id text, actor_role text)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_internal_lock_case_read_role$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_membership public.center_members%rowtype;
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
begin
  if p_actor_user_id is null or p_case_id is null then
    raise exception using errcode = '22023', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  -- Non-authoritative selector; every authority row is locked and rechecked below.
  select c.center_id into v_center_id
  from public.consultation_case c
  where c.consultation_case_id = p_case_id;
  if not found then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  -- P1E_CASE_READ_LOCK_ORDER: ROOT, AUTH_USER, MEMBERSHIP, CASE, ASSIGNMENT.
  select r.* into v_root from public.center_crm_control r
  where r.center_id = v_center_id for share;
  if not found
     or v_root.crm_state not in ('READ_ONLY', 'ACTIVE')
     or v_root.feature_flag_state not in ('READ_ONLY', 'ENABLED') then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  select m.* into v_membership from public.center_members m
  where m.center_id = v_center_id and m.user_id = p_actor_user_id
  order by m.id limit 1 for share;
  if not found or v_membership.status <> 'active'
     or v_membership.role not in ('owner', 'center_admin', 'consultant') then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  select c.* into v_case from public.consultation_case c
  where c.consultation_case_id = p_case_id and c.center_id = v_center_id for share;
  if not found then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;

  if v_membership.role = 'consultant' then
    if v_case.active_assignment_id is null then
      raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
    end if;
    select a.* into v_assignment from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = p_case_id
      and a.assignment_id = v_case.active_assignment_id
    for share;
    if not found or v_assignment.assignment_status <> 'ACTIVE'
       or v_assignment.assigned_consultant_user_id <> p_actor_user_id then
      raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
    end if;
  end if;

  return query select v_center_id, v_membership.role;
end;
$f23_3e_p1e_internal_lock_case_read_role$;

create function public.f23_3e_p1e_list_crm_contacts_masked(
  p_actor_user_id uuid,
  p_center_id text,
  p_after_updated_at timestamptz default null,
  p_after_contact_id uuid default null,
  p_limit integer default 50
)
returns table (
  crm_contact_id uuid,
  center_id text,
  display_name text,
  contact_status text,
  source_category text,
  initial_interest text,
  safe_location_area text,
  contact_version integer,
  contact_methods_visibility text,
  full_contact_reveal_available boolean,
  projection_cache_policy text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_list_crm_contacts_masked$
declare v_role text;
begin
  if p_limit is null or p_limit not between 1 and 100
     or ((p_after_updated_at is null) <> (p_after_contact_id is null)) then
    raise exception using errcode = '22023', message = 'INVALID_CURSOR_OR_LIMIT';
  end if;
  v_role := public.f23_3e_p1e_internal_lock_center_read_role(p_actor_user_id, p_center_id);
  if v_role not in ('owner', 'center_admin') then
    raise exception using errcode = '42501', message = 'READ_SCOPE_DENIED';
  end if;

  -- Masking is structural: protected columns are never selected into this row.
  return query
  select c.crm_contact_id, c.center_id, c.display_name, c.contact_status,
    c.source_category, c.initial_interest, c.safe_location_area, c.contact_version,
    'MASKED_PROTECTED'::text, false, 'NO_STORE'::text, c.created_at, c.updated_at
  from public.crm_contact c
  where c.center_id = p_center_id
    and (p_after_updated_at is null or (c.updated_at, c.crm_contact_id) > (p_after_updated_at, p_after_contact_id))
  order by c.updated_at asc, c.crm_contact_id asc
  limit p_limit
  for share of c;
end;
$f23_3e_p1e_list_crm_contacts_masked$;

create function public.f23_3e_p1e_list_consultation_cases_masked(
  p_actor_user_id uuid,
  p_center_id text,
  p_after_updated_at timestamptz default null,
  p_after_case_id uuid default null,
  p_limit integer default 50
)
returns table (
  consultation_case_id uuid,
  center_id text,
  status text,
  interest_summary text,
  safe_case_summary text,
  case_version integer,
  conversion_state text,
  primary_contact_id uuid,
  contact_display_name text,
  contact_status text,
  contact_methods_visibility text,
  active_assignment_id uuid,
  assigned_consultant_user_id uuid,
  assignment_version integer,
  projection_cache_policy text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_list_consultation_cases_masked$
declare v_role text;
begin
  if p_limit is null or p_limit not between 1 and 100
     or ((p_after_updated_at is null) <> (p_after_case_id is null)) then
    raise exception using errcode = '22023', message = 'INVALID_CURSOR_OR_LIMIT';
  end if;
  v_role := public.f23_3e_p1e_internal_lock_center_read_role(p_actor_user_id, p_center_id);

  return query
  select c.consultation_case_id, c.center_id, c.status, c.interest_summary,
    c.safe_case_summary, c.case_version, c.conversion_state, c.primary_contact_id,
    ct.display_name, ct.contact_status, 'MASKED_PROTECTED'::text,
    c.active_assignment_id, a.assigned_consultant_user_id, a.assignment_version,
    'NO_STORE'::text, c.updated_at
  from public.consultation_case c
  join public.crm_contact ct
    on ct.center_id = c.center_id and ct.crm_contact_id = c.primary_contact_id
  left join lateral (
    select locked_assignment.assigned_consultant_user_id,
      locked_assignment.assignment_version
    from public.consultation_case_assignment locked_assignment
    where locked_assignment.center_id = c.center_id
      and locked_assignment.consultation_case_id = c.consultation_case_id
      and locked_assignment.assignment_id = c.active_assignment_id
      and locked_assignment.assignment_status = 'ACTIVE'
    for share
  ) a on true
  where c.center_id = p_center_id
    and (p_after_updated_at is null or (c.updated_at, c.consultation_case_id) > (p_after_updated_at, p_after_case_id))
    and (v_role in ('owner', 'center_admin')
      or (v_role = 'consultant' and a.assigned_consultant_user_id = p_actor_user_id))
  order by c.updated_at asc, c.consultation_case_id asc
  limit p_limit
  for share of c, ct;
end;
$f23_3e_p1e_list_consultation_cases_masked$;

create function public.f23_3e_p1e_get_consultation_case_masked(
  p_actor_user_id uuid,
  p_case_id uuid
)
returns table (
  consultation_case_id uuid,
  center_id text,
  status text,
  interest_summary text,
  safe_case_summary text,
  case_version integer,
  conversion_state text,
  primary_contact_id uuid,
  contact_display_name text,
  contact_status text,
  contact_methods_visibility text,
  active_assignment_id uuid,
  assigned_consultant_user_id uuid,
  assignment_version integer,
  projection_cache_policy text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_get_consultation_case_masked$
declare v_access record;
begin
  select access.center_id, access.actor_role into v_access
  from public.f23_3e_p1e_internal_lock_case_read_role(p_actor_user_id, p_case_id) access;

  return query
  select c.consultation_case_id, c.center_id, c.status, c.interest_summary,
    c.safe_case_summary, c.case_version, c.conversion_state, c.primary_contact_id,
    ct.display_name, ct.contact_status, 'MASKED_PROTECTED'::text,
    c.active_assignment_id, a.assigned_consultant_user_id, a.assignment_version,
    'NO_STORE'::text, c.updated_at
  from public.consultation_case c
  join public.crm_contact ct
    on ct.center_id = c.center_id and ct.crm_contact_id = c.primary_contact_id
  left join lateral (
    select locked_assignment.assigned_consultant_user_id,
      locked_assignment.assignment_version
    from public.consultation_case_assignment locked_assignment
    where locked_assignment.center_id = c.center_id
      and locked_assignment.consultation_case_id = c.consultation_case_id
      and locked_assignment.assignment_id = c.active_assignment_id
      and locked_assignment.assignment_status = 'ACTIVE'
    for share
  ) a on true
  where c.center_id = v_access.center_id and c.consultation_case_id = p_case_id
  for share of c, ct;
  if not found then
    raise exception using errcode = '42501', message = 'RESOURCE_NOT_FOUND_OR_DENIED';
  end if;
end;
$f23_3e_p1e_get_consultation_case_masked$;

create function public.f23_3e_p1e_list_case_care_logs(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_after_created_at timestamptz default null,
  p_after_care_log_id uuid default null,
  p_limit integer default 50
)
returns table (
  care_log_id uuid,
  consultation_case_id uuid,
  author_user_id uuid,
  entry_type text,
  safe_content text,
  correction_of_care_log_id uuid,
  care_log_version integer,
  created_at timestamptz,
  projection_cache_policy text
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_list_case_care_logs$
declare v_access record;
begin
  if p_limit is null or p_limit not between 1 and 100
     or ((p_after_created_at is null) <> (p_after_care_log_id is null)) then
    raise exception using errcode = '22023', message = 'INVALID_CURSOR_OR_LIMIT';
  end if;
  select access.center_id, access.actor_role into v_access
  from public.f23_3e_p1e_internal_lock_case_read_role(p_actor_user_id, p_case_id) access;

  return query
  select l.care_log_id, l.consultation_case_id, l.author_user_id, l.entry_type,
    l.safe_content, l.correction_of_care_log_id, l.care_log_version,
    l.created_at, 'NO_STORE'::text
  from public.crm_care_log l
  where l.center_id = v_access.center_id and l.consultation_case_id = p_case_id
    and (p_after_created_at is null or (l.created_at, l.care_log_id) > (p_after_created_at, p_after_care_log_id))
  order by l.created_at asc, l.care_log_id asc
  limit p_limit
  for share of l;
end;
$f23_3e_p1e_list_case_care_logs$;

create function public.f23_3e_p1e_get_local_import_readiness(
  p_actor_user_id uuid,
  p_center_id text
)
returns table (
  ok boolean,
  outcome_code text,
  center_id text,
  crm_state text,
  feature_flag_state text,
  control_version integer,
  import_preview_allowed boolean,
  real_import_allowed boolean,
  required_source_kind text,
  projection_cache_policy text
)
language plpgsql
security definer
set search_path = ''
as $f23_3e_p1e_get_local_import_readiness$
declare
  v_root public.center_crm_control%rowtype;
  v_membership public.center_members%rowtype;
begin
  if p_actor_user_id is null or p_center_id is null or p_center_id <> pg_catalog.btrim(p_center_id) or p_center_id = '' then
    return query select false, 'INVALID_INPUT', p_center_id, null::text, null::text,
      null::integer, false, false, 'EXPLICIT_USER_EXPORTED_JSON', 'NO_STORE';
    return;
  end if;

  select r.* into v_root from public.center_crm_control r
  where r.center_id = p_center_id for share;
  if not found or v_root.crm_state not in ('READ_ONLY', 'ACTIVE')
     or v_root.feature_flag_state not in ('READ_ONLY', 'ENABLED') then
    return query select false, 'CRM_READ_NOT_ACTIVE', p_center_id,
      v_root.crm_state, v_root.feature_flag_state, v_root.control_version,
      false, false, 'EXPLICIT_USER_EXPORTED_JSON', 'NO_STORE';
    return;
  end if;

  perform u.id from auth.users u where u.id = p_actor_user_id for key share;
  if not found then
    return query select false, 'IMPORT_PREVIEW_DENIED', p_center_id,
      v_root.crm_state, v_root.feature_flag_state, v_root.control_version,
      false, false, 'EXPLICIT_USER_EXPORTED_JSON', 'NO_STORE';
    return;
  end if;
  select m.* into v_membership from public.center_members m
  where m.center_id = p_center_id and m.user_id = p_actor_user_id
  order by m.id limit 1 for share;
  if not found or v_membership.status <> 'active'
     or v_membership.role not in ('owner', 'center_admin') then
    return query select false, 'IMPORT_PREVIEW_DENIED', p_center_id,
      v_root.crm_state, v_root.feature_flag_state, v_root.control_version,
      false, false, 'EXPLICIT_USER_EXPORTED_JSON', 'NO_STORE';
    return;
  end if;

  return query select true, 'IMPORT_PREVIEW_READY', p_center_id,
    v_root.crm_state, v_root.feature_flag_state, v_root.control_version,
    true, false, 'EXPLICIT_USER_EXPORTED_JSON', 'NO_STORE';
end;
$f23_3e_p1e_get_local_import_readiness$;

revoke all on function public.f23_3e_p1e_internal_lock_center_read_role(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1e_internal_lock_case_read_role(uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p1e_list_crm_contacts_masked(uuid, text, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1e_list_consultation_cases_masked(uuid, text, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1e_get_consultation_case_masked(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1e_list_case_care_logs(uuid, uuid, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1e_get_local_import_readiness(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.f23_3e_p1e_list_crm_contacts_masked(uuid, text, timestamptz, uuid, integer) to service_role;
grant execute on function public.f23_3e_p1e_list_consultation_cases_masked(uuid, text, timestamptz, uuid, integer) to service_role;
grant execute on function public.f23_3e_p1e_get_consultation_case_masked(uuid, uuid) to service_role;
grant execute on function public.f23_3e_p1e_list_case_care_logs(uuid, uuid, timestamptz, uuid, integer) to service_role;
grant execute on function public.f23_3e_p1e_get_local_import_readiness(uuid, text) to service_role;

comment on function public.f23_3e_p1e_list_crm_contacts_masked(uuid, text, timestamptz, uuid, integer) is
  'Service-only exact-center Owner/Admin masked Contact keyset projection; no protected field is selected.';
comment on function public.f23_3e_p1e_list_consultation_cases_masked(uuid, text, timestamptz, uuid, integer) is
  'Service-only masked Case keyset projection; Consultant scope is the exact current ACTIVE assignment only.';
comment on function public.f23_3e_p1e_get_consultation_case_masked(uuid, uuid) is
  'Service-only masked Case detail with indistinguishable missing, foreign, and unassigned denial.';
comment on function public.f23_3e_p1e_list_case_care_logs(uuid, uuid, timestamptz, uuid, integer) is
  'Service-only Case-authorized safe Care Log keyset projection; grants no global Contact authority.';
comment on function public.f23_3e_p1e_get_local_import_readiness(uuid, text) is
  'Service-only Owner/Admin offline preview readiness; real import is always denied in P1E.';

commit;
