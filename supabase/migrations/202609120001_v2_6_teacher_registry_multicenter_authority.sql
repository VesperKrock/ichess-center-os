-- V2-6 canonical Teacher registry and many-to-many center assignment authority.
-- Legacy C5.1 center-scoped Teacher entities remain untouched and require
-- explicit operator review; this migration performs no identity backfill.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regprocedure(
       'public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)'
     ) is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_6_missing_prerequisite';
  end if;
end
$$;

-- Retain the C5.1 command for Student/Class/Schedule, but remove Teacher as an
-- alternate browser mutation authority once the canonical registry exists.
alter function public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)
  rename to c5_1_internal_mutate_core_entity_pre_v26;
revoke all on function public.c5_1_internal_mutate_core_entity_pre_v26(
  text,text,text,bigint,jsonb,uuid,text
) from public, anon, authenticated, service_role;

create function public.c5_1_mutate_core_entity(
  p_center_id text,
  p_entity_type text,
  p_local_id text,
  p_expected_version bigint,
  p_payload jsonb,
  p_idempotency_key uuid,
  p_operation text default 'UPSERT'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) = 'teacher' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'outcome_code', 'V2_6_TEACHER_REGISTRY_REQUIRED'
    );
  end if;
  return public.c5_1_internal_mutate_core_entity_pre_v26(
    p_center_id,
    p_entity_type,
    p_local_id,
    p_expected_version,
    p_payload,
    p_idempotency_key,
    p_operation
  );
end
$$;
revoke all on function public.c5_1_mutate_core_entity(
  text,text,text,bigint,jsonb,uuid,text
) from public, anon, service_role;
grant execute on function public.c5_1_mutate_core_entity(
  text,text,text,bigint,jsonb,uuid,text
) to authenticated;

create table public.canonical_teacher_registry (
  id uuid primary key,
  full_name text not null check (char_length(full_name) between 1 and 120),
  display_name text not null check (char_length(display_name) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 320),
  birth_year integer check (birth_year is null or birth_year between 1900 and 2100),
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  teacher_type text not null default 'fulltime'
    check (teacher_type in ('fulltime', 'parttime', 'collaborator')),
  specialties jsonb not null default '[]'::jsonb check (jsonb_typeof(specialties) = 'array'),
  levels jsonb not null default '[]'::jsonb check (jsonb_typeof(levels) = 'array'),
  main_role text not null default '' check (char_length(main_role) <= 120),
  note text not null default '' check (char_length(note) <= 1000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  updated_by_membership_id uuid not null references public.center_members(id) on delete restrict
);

create unique index canonical_teacher_registry_email_unique
  on public.canonical_teacher_registry(lower(email))
  where email <> '';

create table public.teacher_center_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.canonical_teacher_registry(id) on delete restrict,
  center_id text not null references public.centers(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned', 'removed')),
  version integer not null default 1 check (version >= 1),
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  updated_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  unique (teacher_id, center_id),
  check (
    (status = 'assigned' and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);

create index teacher_center_assignments_center_status_idx
  on public.teacher_center_assignments(center_id, status, teacher_id);

create table public.teacher_registry_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.canonical_teacher_registry(id) on delete restrict,
  event_type text not null check (
    event_type in ('teacher_created', 'teacher_updated', 'assigned', 'removed', 'transferred')
  ),
  from_center_id text references public.centers(id) on delete restrict,
  to_center_id text references public.centers(id) on delete restrict,
  assignment_id uuid references public.teacher_center_assignments(id) on delete restrict,
  related_assignment_id uuid references public.teacher_center_assignments(id) on delete restrict,
  teacher_version integer not null check (teacher_version >= 1),
  assignment_version integer check (assignment_version is null or assignment_version >= 1),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null references public.center_members(id) on delete restrict,
  command_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index teacher_registry_events_center_time_idx
  on public.teacher_registry_events(
    coalesce(to_center_id, from_center_id), occurred_at desc, id
  );
create unique index teacher_registry_events_command_type_unique
  on public.teacher_registry_events(command_id, event_type);

create table public.teacher_registry_command_results (
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  context_center_id text not null references public.centers(id) on delete restrict,
  command_hash bytea not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, idempotency_key)
);

alter table public.canonical_teacher_registry enable row level security;
alter table public.canonical_teacher_registry force row level security;
alter table public.teacher_center_assignments enable row level security;
alter table public.teacher_center_assignments force row level security;
alter table public.teacher_registry_events enable row level security;
alter table public.teacher_registry_events force row level security;
alter table public.teacher_registry_command_results enable row level security;
alter table public.teacher_registry_command_results force row level security;

revoke all on table public.canonical_teacher_registry from public, anon, authenticated, service_role;
revoke all on table public.teacher_center_assignments from public, anon, authenticated, service_role;
revoke all on table public.teacher_registry_events from public, anon, authenticated, service_role;
revoke all on table public.teacher_registry_command_results from public, anon, authenticated, service_role;
grant all on table public.canonical_teacher_registry to service_role;
grant all on table public.teacher_center_assignments to service_role;
grant all on table public.teacher_registry_events to service_role;
grant all on table public.teacher_registry_command_results to service_role;

create function public.v2_6_internal_normalize_role(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_role, '')))
    when 'admin' then 'center_admin'
    when 'qtv' then 'center_admin'
    else lower(btrim(coalesce(p_role, '')))
  end
$$;

create function public.v2_6_internal_active_membership(
  p_center_id text,
  p_user_id uuid
)
returns public.center_members
language sql
stable
security definer
set search_path = ''
as $$
  select membership.*
  from public.center_members membership
  join public.centers center_row on center_row.id = membership.center_id
  where membership.center_id = p_center_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
    and center_row.status = 'active'
    and public.v2_6_internal_normalize_role(membership.role) in ('owner', 'center_admin')
  limit 1
$$;

create function public.v2_6_internal_owner_membership(
  p_center_id text,
  p_user_id uuid
)
returns public.center_members
language sql
stable
security definer
set search_path = ''
as $$
  select membership.*
  from public.center_members membership
  join public.centers center_row on center_row.id = membership.center_id
  where membership.center_id = p_center_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
    and center_row.status = 'active'
    and public.v2_6_internal_normalize_role(membership.role) = 'owner'
  limit 1
$$;

create function public.v2_6_internal_teacher_in_owner_scope(
  p_teacher_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_center_assignments assignment
    join public.center_members membership
      on membership.center_id = assignment.center_id
     and membership.user_id = p_user_id
     and membership.status = 'active'
     and public.v2_6_internal_normalize_role(membership.role) = 'owner'
    join public.centers center_row
      on center_row.id = assignment.center_id
     and center_row.status = 'active'
    where assignment.teacher_id = p_teacher_id
      and assignment.status = 'assigned'
  )
$$;

create function public.v2_6_list_teacher_registry(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.center_members;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'v2_6_not_authenticated';
  end if;

  select * into v_membership
  from public.v2_6_internal_active_membership(p_center_id, v_user_id);
  if v_membership.id is null then
    raise exception 'v2_6_center_access_denied';
  end if;
  v_role := public.v2_6_internal_normalize_role(v_membership.role);

  return jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'role', v_role,
    'can_manage_registry', v_role = 'owner',
    'assigned_teachers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', teacher_row.id,
        'full_name', teacher_row.full_name,
        'display_name', teacher_row.display_name,
        'phone', teacher_row.phone,
        'email', teacher_row.email,
        'birth_year', case when v_role = 'owner' then teacher_row.birth_year else null end,
        'status', teacher_row.status,
        'teacher_type', teacher_row.teacher_type,
        'specialties', teacher_row.specialties,
        'levels', teacher_row.levels,
        'main_role', teacher_row.main_role,
        'note', case when v_role = 'owner' then teacher_row.note else '' end,
        'version', teacher_row.version,
        'updated_at', teacher_row.updated_at,
        'assignment_id', assignment.id,
        'assignment_status', assignment.status,
        'assignment_version', assignment.version,
        'assignment_updated_at', assignment.updated_at
      ) order by lower(teacher_row.full_name), teacher_row.id)
      from public.teacher_center_assignments assignment
      join public.canonical_teacher_registry teacher_row on teacher_row.id = assignment.teacher_id
      where assignment.center_id = p_center_id
        and assignment.status = 'assigned'
    ), '[]'::jsonb),
    'registry_teachers', case when v_role = 'owner' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', teacher_row.id,
        'full_name', teacher_row.full_name,
        'display_name', teacher_row.display_name,
        'phone', teacher_row.phone,
        'email', teacher_row.email,
        'birth_year', teacher_row.birth_year,
        'status', teacher_row.status,
        'teacher_type', teacher_row.teacher_type,
        'specialties', teacher_row.specialties,
        'levels', teacher_row.levels,
        'main_role', teacher_row.main_role,
        'note', teacher_row.note,
        'version', teacher_row.version,
        'updated_at', teacher_row.updated_at,
        'assignments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', scoped_assignment.id,
            'center_id', scoped_assignment.center_id,
            'center_name', center_row.name,
            'status', scoped_assignment.status,
            'version', scoped_assignment.version,
            'assigned_at', scoped_assignment.assigned_at,
            'removed_at', scoped_assignment.removed_at,
            'updated_at', scoped_assignment.updated_at
          ) order by lower(center_row.name), scoped_assignment.center_id)
          from public.teacher_center_assignments scoped_assignment
          join public.centers center_row on center_row.id = scoped_assignment.center_id
          where scoped_assignment.teacher_id = teacher_row.id
            and exists (
              select 1
              from public.center_members owner_membership
              where owner_membership.center_id = scoped_assignment.center_id
                and owner_membership.user_id = v_user_id
                and owner_membership.status = 'active'
                and public.v2_6_internal_normalize_role(owner_membership.role) = 'owner'
            )
        ), '[]'::jsonb)
      ) order by lower(teacher_row.full_name), teacher_row.id)
      from public.canonical_teacher_registry teacher_row
      where public.v2_6_internal_teacher_in_owner_scope(teacher_row.id, v_user_id)
    ), '[]'::jsonb) else '[]'::jsonb end,
    'managed_centers', case when v_role = 'owner' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'center_id', center_row.id,
        'center_name', center_row.name
      ) order by lower(center_row.name), center_row.id)
      from public.center_members owner_membership
      join public.centers center_row on center_row.id = owner_membership.center_id
      where owner_membership.user_id = v_user_id
        and owner_membership.status = 'active'
        and center_row.status = 'active'
        and public.v2_6_internal_normalize_role(owner_membership.role) = 'owner'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'assignment_events', case when v_role = 'owner' then coalesce((
      select jsonb_agg(event_json order by occurred_at desc, event_id desc)
      from (
        select jsonb_build_object(
          'id', event_row.id,
          'teacher_id', event_row.teacher_id,
          'event_type', event_row.event_type,
          'from_center_id', event_row.from_center_id,
          'to_center_id', event_row.to_center_id,
          'assignment_id', event_row.assignment_id,
          'related_assignment_id', event_row.related_assignment_id,
          'teacher_version', event_row.teacher_version,
          'assignment_version', event_row.assignment_version,
          'occurred_at', event_row.occurred_at
        ) as event_json,
        event_row.occurred_at,
        event_row.id as event_id
        from public.teacher_registry_events event_row
        where event_row.from_center_id = p_center_id
           or event_row.to_center_id = p_center_id
        order by event_row.occurred_at desc, event_row.id desc
        limit 100
      ) recent_events
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end
$$;

create function public.v2_6_mutate_teacher_registry(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.teacher_registry_command_results;
  v_hash bytea;
  v_operation text := upper(btrim(coalesce(p_command->>'operation', '')));
  v_teacher_id uuid;
  v_teacher public.canonical_teacher_registry;
  v_assignment public.teacher_center_assignments;
  v_expected_version integer;
  v_full_name text;
  v_display_name text;
  v_phone text;
  v_email text;
  v_birth_year integer;
  v_status text;
  v_teacher_type text;
  v_specialties jsonb;
  v_levels jsonb;
  v_main_role text;
  v_note text;
  v_response jsonb;
begin
  if v_user_id is null then raise exception 'v2_6_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null or jsonb_typeof(p_command) <> 'object' then
    raise exception 'v2_6_invalid_command';
  end if;
  select * into v_membership
  from public.v2_6_internal_owner_membership(p_center_id, v_user_id);
  if v_membership.id is null then raise exception 'v2_6_owner_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );
  v_hash := extensions.digest(
    pg_catalog.convert_to('teacher_registry:' || p_center_id || ':' || p_command::text, 'UTF8'),
    'sha256'
  );
  select * into v_existing
  from public.teacher_registry_command_results
  where actor_user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.command_hash <> v_hash then raise exception 'v2_6_idempotency_conflict'; end if;
    return v_existing.response || jsonb_build_object('replayed', true);
  end if;

  begin
    v_teacher_id := (p_command->>'teacher_id')::uuid;
  exception when others then
    raise exception 'v2_6_invalid_teacher_id';
  end;
  v_expected_version := coalesce((p_command->>'expected_version')::integer, -1);
  v_full_name := regexp_replace(btrim(coalesce(p_command->>'full_name', '')), '\s+', ' ', 'g');
  v_display_name := regexp_replace(btrim(coalesce(p_command->>'display_name', v_full_name)), '\s+', ' ', 'g');
  v_phone := btrim(coalesce(p_command->>'phone', ''));
  v_email := lower(btrim(coalesce(p_command->>'email', '')));
  v_birth_year := case when nullif(btrim(coalesce(p_command->>'birth_year', '')), '') is null
    then null else (p_command->>'birth_year')::integer end;
  v_status := lower(btrim(coalesce(p_command->>'status', 'active')));
  v_teacher_type := lower(btrim(coalesce(p_command->>'teacher_type', 'fulltime')));
  v_specialties := coalesce(p_command->'specialties', '[]'::jsonb);
  v_levels := coalesce(p_command->'levels', '[]'::jsonb);
  v_main_role := btrim(coalesce(p_command->>'main_role', ''));
  v_note := btrim(coalesce(p_command->>'note', ''));

  if char_length(v_full_name) not between 1 and 120
     or char_length(v_display_name) not between 1 and 120
     or char_length(v_phone) > 40
     or char_length(v_email) > 320
     or (v_email <> '' and (v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
     or (v_birth_year is not null and v_birth_year not between 1900 and 2100)
     or v_status not in ('active', 'paused', 'inactive')
     or v_teacher_type not in ('fulltime', 'parttime', 'collaborator')
     or jsonb_typeof(v_specialties) <> 'array'
     or jsonb_array_length(v_specialties) > 20
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(v_specialties) item
       where pg_catalog.jsonb_typeof(item) <> 'string'
          or pg_catalog.char_length(item #>> '{}') > 120
     )
     or jsonb_typeof(v_levels) <> 'array'
     or jsonb_array_length(v_levels) > 20
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(v_levels) item
       where pg_catalog.jsonb_typeof(item) <> 'string'
          or pg_catalog.char_length(item #>> '{}') > 120
     )
     or char_length(v_main_role) > 120
     or char_length(v_note) > 1000 then
    raise exception 'v2_6_invalid_teacher_profile';
  end if;

  if v_operation = 'CREATE_TEACHER' then
    if v_expected_version <> 0 then raise exception 'v2_6_stale_version'; end if;
    begin
      insert into public.canonical_teacher_registry(
        id, full_name, display_name, phone, email, birth_year, status, teacher_type,
        specialties, levels, main_role, note,
        created_by_membership_id, updated_by_membership_id
      ) values (
        v_teacher_id, v_full_name, v_display_name, v_phone, v_email, v_birth_year,
        v_status, v_teacher_type, v_specialties, v_levels, v_main_role, v_note,
        v_membership.id, v_membership.id
      ) returning * into v_teacher;
    exception when unique_violation then
      raise exception 'v2_6_teacher_identity_conflict';
    end;

    insert into public.teacher_center_assignments(
      teacher_id, center_id, created_by_membership_id, updated_by_membership_id
    ) values (
      v_teacher.id, p_center_id, v_membership.id, v_membership.id
    ) returning * into v_assignment;

    insert into public.teacher_registry_events(
      teacher_id, event_type, to_center_id, assignment_id,
      teacher_version, assignment_version, actor_user_id, actor_membership_id, command_id
    ) values (
      v_teacher.id, 'teacher_created', p_center_id, v_assignment.id,
      v_teacher.version, v_assignment.version, v_user_id, v_membership.id, p_idempotency_key
    );
  elsif v_operation = 'UPDATE_TEACHER' then
    if not public.v2_6_internal_teacher_in_owner_scope(v_teacher_id, v_user_id) then
      raise exception 'v2_6_teacher_scope_denied';
    end if;
    select * into v_teacher
    from public.canonical_teacher_registry
    where id = v_teacher_id for update;
    if not found or v_teacher.version <> v_expected_version then
      raise exception 'v2_6_stale_version';
    end if;
    begin
      update public.canonical_teacher_registry
      set full_name = v_full_name,
          display_name = v_display_name,
          phone = v_phone,
          email = v_email,
          birth_year = v_birth_year,
          status = v_status,
          teacher_type = v_teacher_type,
          specialties = v_specialties,
          levels = v_levels,
          main_role = v_main_role,
          note = v_note,
          version = version + 1,
          updated_at = now(),
          updated_by_membership_id = v_membership.id
      where id = v_teacher_id
      returning * into v_teacher;
    exception when unique_violation then
      raise exception 'v2_6_teacher_identity_conflict';
    end;
    insert into public.teacher_registry_events(
      teacher_id, event_type, teacher_version,
      actor_user_id, actor_membership_id, command_id
    ) values (
      v_teacher.id, 'teacher_updated', v_teacher.version,
      v_user_id, v_membership.id, p_idempotency_key
    );
  else
    raise exception 'v2_6_invalid_operation';
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', p_center_id,
    'teacher_id', v_teacher.id,
    'teacher_version', v_teacher.version,
    'assignment_id', v_assignment.id,
    'assignment_version', v_assignment.version,
    'replayed', false
  );
  insert into public.teacher_registry_command_results(
    actor_user_id, idempotency_key, context_center_id, command_hash, response
  ) values (v_user_id, p_idempotency_key, p_center_id, v_hash, v_response);
  return v_response;
exception when unique_violation then
  raise exception 'v2_6_concurrent_conflict';
end
$$;

create function public.v2_6_mutate_teacher_assignment(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_context_membership public.center_members;
  v_actor_membership public.center_members;
  v_existing public.teacher_registry_command_results;
  v_hash bytea;
  v_operation text := upper(btrim(coalesce(p_command->>'operation', '')));
  v_teacher_id uuid;
  v_teacher public.canonical_teacher_registry;
  v_from_center_id text := btrim(coalesce(p_command->>'from_center_id', ''));
  v_to_center_id text := btrim(coalesce(p_command->>'to_center_id', ''));
  v_source public.teacher_center_assignments;
  v_target public.teacher_center_assignments;
  v_expected_version integer := coalesce((p_command->>'expected_version')::integer, -1);
  v_target_expected_version integer := coalesce((p_command->>'target_expected_version')::integer, 0);
  v_response jsonb;
begin
  if v_user_id is null then raise exception 'v2_6_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null or jsonb_typeof(p_command) <> 'object' then
    raise exception 'v2_6_invalid_command';
  end if;
  select * into v_context_membership
  from public.v2_6_internal_owner_membership(p_center_id, v_user_id);
  if v_context_membership.id is null then raise exception 'v2_6_owner_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );
  v_hash := extensions.digest(
    pg_catalog.convert_to('teacher_assignment:' || p_center_id || ':' || p_command::text, 'UTF8'),
    'sha256'
  );
  select * into v_existing from public.teacher_registry_command_results
  where actor_user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.command_hash <> v_hash then raise exception 'v2_6_idempotency_conflict'; end if;
    return v_existing.response || jsonb_build_object('replayed', true);
  end if;

  begin
    v_teacher_id := (p_command->>'teacher_id')::uuid;
  exception when others then
    raise exception 'v2_6_invalid_teacher_id';
  end;
  select * into v_teacher
  from public.canonical_teacher_registry
  where id = v_teacher_id
  for update;
  if not found then raise exception 'v2_6_teacher_not_found'; end if;
  if not public.v2_6_internal_teacher_in_owner_scope(v_teacher_id, v_user_id) then
    raise exception 'v2_6_teacher_scope_denied';
  end if;

  if v_operation = 'ASSIGN' then
    select * into v_actor_membership
    from public.v2_6_internal_owner_membership(v_to_center_id, v_user_id);
    if v_actor_membership.id is null then raise exception 'v2_6_target_center_denied'; end if;
    select * into v_target from public.teacher_center_assignments
    where teacher_id = v_teacher_id and center_id = v_to_center_id for update;
    if found then
      if v_target.status = 'assigned' then raise exception 'v2_6_assignment_already_active'; end if;
      if v_target.version <> v_expected_version then raise exception 'v2_6_stale_version'; end if;
      update public.teacher_center_assignments
      set status = 'assigned', version = version + 1, assigned_at = now(), removed_at = null,
          updated_at = now(), updated_by_membership_id = v_actor_membership.id
      where id = v_target.id returning * into v_target;
    else
      if v_expected_version <> 0 then raise exception 'v2_6_stale_version'; end if;
      insert into public.teacher_center_assignments(
        teacher_id, center_id, created_by_membership_id, updated_by_membership_id
      ) values (
        v_teacher_id, v_to_center_id, v_actor_membership.id, v_actor_membership.id
      ) returning * into v_target;
    end if;
    insert into public.teacher_registry_events(
      teacher_id, event_type, to_center_id, assignment_id,
      teacher_version, assignment_version, actor_user_id, actor_membership_id, command_id
    ) values (
      v_teacher_id, 'assigned', v_to_center_id, v_target.id,
      v_teacher.version, v_target.version, v_user_id, v_actor_membership.id, p_idempotency_key
    );
  elsif v_operation = 'REMOVE' then
    select * into v_actor_membership
    from public.v2_6_internal_owner_membership(v_from_center_id, v_user_id);
    if v_actor_membership.id is null then raise exception 'v2_6_source_center_denied'; end if;
    select * into v_source from public.teacher_center_assignments
    where teacher_id = v_teacher_id and center_id = v_from_center_id for update;
    if not found or v_source.status <> 'assigned' or v_source.version <> v_expected_version then
      raise exception 'v2_6_stale_version';
    end if;
    if not exists (
      select 1 from public.teacher_center_assignments other_assignment
      where other_assignment.teacher_id = v_teacher_id
        and other_assignment.status = 'assigned'
        and other_assignment.id <> v_source.id
    ) then
      raise exception 'v2_6_last_assignment_required';
    end if;
    update public.teacher_center_assignments
    set status = 'removed', version = version + 1, removed_at = now(),
        updated_at = now(), updated_by_membership_id = v_actor_membership.id
    where id = v_source.id returning * into v_source;
    insert into public.teacher_registry_events(
      teacher_id, event_type, from_center_id, assignment_id,
      teacher_version, assignment_version, actor_user_id, actor_membership_id, command_id
    ) values (
      v_teacher_id, 'removed', v_from_center_id, v_source.id,
      v_teacher.version, v_source.version, v_user_id, v_actor_membership.id, p_idempotency_key
    );
  elsif v_operation = 'TRANSFER' then
    if v_from_center_id = '' or v_to_center_id = '' or v_from_center_id = v_to_center_id then
      raise exception 'v2_6_invalid_transfer_scope';
    end if;
    select * into v_actor_membership
    from public.v2_6_internal_owner_membership(v_from_center_id, v_user_id);
    if v_actor_membership.id is null then raise exception 'v2_6_source_center_denied'; end if;
    if not exists (
      select 1 from public.v2_6_internal_owner_membership(v_to_center_id, v_user_id)
    ) then raise exception 'v2_6_target_center_denied'; end if;
    select * into v_source from public.teacher_center_assignments
    where teacher_id = v_teacher_id and center_id = v_from_center_id for update;
    if not found or v_source.status <> 'assigned' or v_source.version <> v_expected_version then
      raise exception 'v2_6_stale_version';
    end if;
    select * into v_target from public.teacher_center_assignments
    where teacher_id = v_teacher_id and center_id = v_to_center_id for update;
    if found and (v_target.status = 'assigned' or v_target.version <> v_target_expected_version) then
      raise exception 'v2_6_target_assignment_conflict';
    end if;

    update public.teacher_center_assignments
    set status = 'removed', version = version + 1, removed_at = now(),
        updated_at = now(), updated_by_membership_id = v_actor_membership.id
    where id = v_source.id returning * into v_source;

    select * into v_actor_membership
    from public.v2_6_internal_owner_membership(v_to_center_id, v_user_id);
    if v_target.id is not null then
      update public.teacher_center_assignments
      set status = 'assigned', version = version + 1, assigned_at = now(), removed_at = null,
          updated_at = now(), updated_by_membership_id = v_actor_membership.id
      where id = v_target.id returning * into v_target;
    else
      insert into public.teacher_center_assignments(
        teacher_id, center_id, created_by_membership_id, updated_by_membership_id
      ) values (
        v_teacher_id, v_to_center_id, v_actor_membership.id, v_actor_membership.id
      ) returning * into v_target;
    end if;

    insert into public.teacher_registry_events(
      teacher_id, event_type, from_center_id, to_center_id, assignment_id, related_assignment_id,
      teacher_version, assignment_version, actor_user_id, actor_membership_id, command_id
    ) values (
      v_teacher_id, 'transferred', v_from_center_id, v_to_center_id,
      v_source.id, v_target.id, v_teacher.version, v_target.version,
      v_user_id, v_actor_membership.id, p_idempotency_key
    );
  else
    raise exception 'v2_6_invalid_operation';
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', p_center_id,
    'teacher_id', v_teacher_id,
    'operation', v_operation,
    'assignment_id', coalesce(v_target.id, v_source.id),
    'assignment_version', coalesce(v_target.version, v_source.version),
    'replayed', false
  );
  insert into public.teacher_registry_command_results(
    actor_user_id, idempotency_key, context_center_id, command_hash, response
  ) values (v_user_id, p_idempotency_key, p_center_id, v_hash, v_response);
  return v_response;
exception when unique_violation then
  raise exception 'v2_6_concurrent_conflict';
end
$$;

revoke all on function public.v2_6_internal_normalize_role(text) from public, anon, authenticated;
revoke all on function public.v2_6_internal_active_membership(text,uuid) from public, anon, authenticated;
revoke all on function public.v2_6_internal_owner_membership(text,uuid) from public, anon, authenticated;
revoke all on function public.v2_6_internal_teacher_in_owner_scope(uuid,uuid) from public, anon, authenticated;
grant execute on function public.v2_6_internal_normalize_role(text) to service_role;
grant execute on function public.v2_6_internal_active_membership(text,uuid) to service_role;
grant execute on function public.v2_6_internal_owner_membership(text,uuid) to service_role;
grant execute on function public.v2_6_internal_teacher_in_owner_scope(uuid,uuid) to service_role;

revoke all on function public.v2_6_list_teacher_registry(text) from public, anon;
revoke all on function public.v2_6_mutate_teacher_registry(text,jsonb,uuid) from public, anon;
revoke all on function public.v2_6_mutate_teacher_assignment(text,jsonb,uuid) from public, anon;
grant execute on function public.v2_6_list_teacher_registry(text) to authenticated, service_role;
grant execute on function public.v2_6_mutate_teacher_registry(text,jsonb,uuid) to authenticated, service_role;
grant execute on function public.v2_6_mutate_teacher_assignment(text,jsonb,uuid) to authenticated, service_role;

comment on table public.canonical_teacher_registry is
  'V2-6 canonical Teacher identity only; contains no center business data.';
comment on table public.teacher_center_assignments is
  'V2-6 authoritative many-to-many Teacher to center assignment state.';
comment on table public.teacher_registry_events is
  'V2-6 immutable Teacher profile/assignment events for audit and later derived notifications.';

commit;
