-- C4.6B MANUAL APPLY ONLY
-- Project: ichess-center-os / zahcfnpaprbnuqpegdmo
-- Run in Supabase Dashboard SQL Editor only after user confirmation.
-- Do not run all steps blindly.
-- SQL APPLIED BY USER: NO at file creation time.
-- SQL READY FOR MANUAL APPLY: YES
-- WAITING USER TO RUN SQL IN SUPABASE SQL EDITOR
-- LIVE QA T/P: NOT RUN
-- Data-destructive operations: NO.
-- Current protected data:
-- - center_cloud_entities: 39 rows, student 29, teacher 6, class_session 4, schedule_session 0.
-- - center_members: 3 rows for dreamhome, roles owner/owner/admin.

-- STEP 1: READ-ONLY PREFLIGHT
-- Run these first. If counts differ from the protected state above, stop and review.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('center_members', 'center_cloud_entities')
order by table_name;

select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
group by center_id, entity_type
order by center_id, entity_type;

select count(*) as center_cloud_entities_total
from public.center_cloud_entities
where center_id = 'dreamhome';

select center_id, role, count(*) as row_count
from public.center_members
where center_id = 'dreamhome'
group by center_id, role
order by role;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
  and column_name in ('id', 'center_id', 'user_id', 'role', 'status', 'created_at', 'updated_at')
order by ordinal_position;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities')
order by tablename, policyname;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

-- STEP 2: MEMBERSHIP READINESS
-- Safe readiness only. Does not create/drop center_members and does not change existing roles.

alter table public.center_members
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists center_members_user_idx
on public.center_members (user_id);

create index if not exists center_members_center_user_idx
on public.center_members (center_id, user_id);

create index if not exists center_members_center_user_status_idx
on public.center_members (center_id, user_id, status);

grant usage on schema public to authenticated;
grant select on public.center_members to authenticated;
grant select, insert, update on public.center_cloud_entities to authenticated;

create or replace function public.is_center_member(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.center_members
    where center_id = requested_center_id
      and user_id = auth.uid()
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.can_write_center(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.center_members
    where center_id = requested_center_id
      and user_id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and lower(role) in ('owner', 'qtv', 'center_admin', 'admin')
  );
$$;

revoke all on function public.is_center_member(text) from public;
revoke all on function public.can_write_center(text) from public;
grant execute on function public.is_center_member(text) to authenticated;
grant execute on function public.can_write_center(text) to authenticated;

-- VERIFY STEP 2
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
  and column_name in ('id', 'center_id', 'user_id', 'role', 'status', 'created_at', 'updated_at')
order by ordinal_position;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_center_member', 'can_write_center')
order by proname;

select center_id, role, coalesce(status, 'active') as status, count(*) as row_count
from public.center_members
where center_id = 'dreamhome'
group by center_id, role, coalesce(status, 'active')
order by role, status;

-- STEP 3: ENTITY ALLOWLIST
-- This drops/replaces only a CHECK CONSTRAINT, not data.
-- Reason: PostgreSQL check constraints cannot be edited in place.
-- Preserves existing class_session and adds schedule_session for C4.6B/C4.7.

begin;

alter table public.center_cloud_entities
  drop constraint if exists center_cloud_entities_entity_type_check;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_type_check
  check (entity_type in ('student', 'teacher', 'class_session', 'schedule_session'));

commit;

notify pgrst, 'reload schema';

-- VERIFY STEP 3
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
where center_id = 'dreamhome'
group by center_id, entity_type
order by entity_type;

select count(*) as center_cloud_entities_total
from public.center_cloud_entities
where center_id = 'dreamhome';

-- STEP 4: RLS POLICIES
-- Replace only named C4.6B policies. No data deletion.

alter table public.center_members enable row level security;
alter table public.center_cloud_entities enable row level security;

drop policy if exists "c4_6b members read own membership" on public.center_members;
create policy "c4_6b members read own membership"
on public.center_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "c4_6b center members read cloud entities" on public.center_cloud_entities;
create policy "c4_6b center members read cloud entities"
on public.center_cloud_entities
for select
to authenticated
using (public.is_center_member(center_id));

drop policy if exists "c4_6b center writers insert cloud entities" on public.center_cloud_entities;
create policy "c4_6b center writers insert cloud entities"
on public.center_cloud_entities
for insert
to authenticated
with check (public.can_write_center(center_id));

drop policy if exists "c4_6b center writers update cloud entities" on public.center_cloud_entities;
create policy "c4_6b center writers update cloud entities"
on public.center_cloud_entities
for update
to authenticated
using (public.can_write_center(center_id))
with check (public.can_write_center(center_id));

-- VERIFY STEP 4
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities');

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities')
order by tablename, policyname;

-- STEP 5: REALTIME PUBLICATION
-- Adds center_cloud_entities to supabase_realtime only if missing.
-- Replica identity full helps clients receive enough row data for update/delete events.

alter table public.center_cloud_entities replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'center_cloud_entities'
  ) then
    alter publication supabase_realtime add table public.center_cloud_entities;
  end if;
end
$$;

-- VERIFY STEP 5
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;

-- STEP 6: POST-APPLY VERIFY
-- Expected protected counts after all steps: total 39, student 29, teacher 6, class_session 4, schedule_session 0, members 3.

select count(*) as center_cloud_entities_total
from public.center_cloud_entities
where center_id = 'dreamhome';

select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
where center_id = 'dreamhome'
group by center_id, entity_type
order by entity_type;

select count(*) as dreamhome_members_total
from public.center_members
where center_id = 'dreamhome';

select center_id, role, coalesce(status, 'active') as status, count(*) as row_count
from public.center_members
where center_id = 'dreamhome'
group by center_id, role, coalesce(status, 'active')
order by role, status;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

-- STEP 7: STOP BEFORE C4.7
-- If all verification queries pass, stop here.
-- Do not claim C4.7 live QA until T/P two-tab/two-device testing is run.
