-- C5.1B Attendance / Session Report Manual SQL Apply Pack
-- SQL APPLY: NO in CodeX
-- WAITING USER CONFIRMATION BEFORE APPLYING SQL
-- Purpose: prepare center_cloud_entities for attendance_record, attendance_baseline_state, session_report.
-- Data destructive: intended NO.
-- Backup recommended: YES, because Supabase project contains alpha/staging data.
--
-- Manual use only:
-- - Review every step before running in Supabase Dashboard SQL Editor.
-- - Run Step 1 read-only preflight first and save the output.
-- - Stop if current entity_type values include anything outside the allowlist below.
-- - Do not run optional test insert unless user explicitly agrees.
-- - This pack does not open broad teacher/consultant direct write policy.

-- STEP 1: READ-ONLY PREFLIGHT

select count(*) as center_cloud_entities_total
from public.center_cloud_entities;

select entity_type, count(*) as total
from public.center_cloud_entities
group by entity_type
order by entity_type;

select center_id, count(*) as total
from public.center_cloud_entities
group by center_id
order by center_id;

select conname, pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('center_cloud_entities', 'center_members')
order by tablename, policyname;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_center_member', 'can_write_center')
order by proname;

-- STEP 2: ENTITY ALLOWLIST PATCH
-- This replaces only a CHECK CONSTRAINT. It does not delete table data.
-- Keep existing C4/C5 entity types and add C5.1 attendance/report types.

begin;

alter table public.center_cloud_entities
  drop constraint if exists center_cloud_entities_entity_type_check;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_type_check
  check (
    entity_type in (
      'student',
      'teacher',
      'class_session',
      'schedule_session',
      'attendance_record',
      'attendance_baseline_state',
      'session_report',
      'tuition_record_package'
    )
  );

commit;

notify pgrst, 'reload schema';

-- VERIFY STEP 2

select conname, pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select entity_type, count(*) as total
from public.center_cloud_entities
group by entity_type
order by entity_type;

-- STEP 3: RLS READINESS
-- C5.1B recommendation:
-- - active center members can read center entities;
-- - owner/admin/qtv/center_admin can write first;
-- - teacher/consultant direct write policy is HOLD / needs approval.
--
-- C4.6B policies can continue to cover C5.1 entities after the allowlist is patched.
-- The helper below intentionally does not add teacher or consultant write access.

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

revoke all on function public.can_write_center(text) from public;
grant execute on function public.can_write_center(text) to authenticated;

-- VERIFY STEP 3

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities');

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('center_cloud_entities', 'center_members')
order by tablename, policyname;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_center_member', 'can_write_center')
order by proname;

-- STEP 4: REALTIME PUBLICATION / REPLICA IDENTITY
-- Replica identity full helps realtime clients handle update/delete context.
-- Publication is added only if missing.

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

-- VERIFY STEP 4

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;

-- STEP 5: POST-APPLY VERIFICATION

select count(*) as center_cloud_entities_total
from public.center_cloud_entities;

select entity_type, count(*) as total
from public.center_cloud_entities
group by entity_type
order by entity_type;

select conname, pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('center_cloud_entities', 'center_members')
order by tablename, policyname;

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';

select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;

-- OPTIONAL TEST ONLY - DO NOT RUN unless user explicitly agrees.
-- begin;
-- insert into public.center_cloud_entities (
--   center_id,
--   entity_type,
--   local_id,
--   payload,
--   updated_at
-- )
-- values (
--   'dreamhome',
--   'attendance_record',
--   'c5_1b_manual_verify_attendance_record',
--   jsonb_build_object(
--     'id', 'c5_1b_manual_verify_attendance_record',
--     'centerId', 'dreamhome',
--     'source', 'manual_verification',
--     'status', 'void_test',
--     'createdBy', 'manual_sql_pack'
--   ),
--   now()
-- );
-- rollback;

-- STEP 6: ROLLBACK NOTES
-- - Revert check constraint to the previous allowlist if needed.
-- - Do not delete existing data.
-- - If test records are inserted manually, delete only the exact test local_id/entity id.
-- - Realtime publication can remain; do not remove unless necessary.
-- - If RLS behavior is wrong, restore policy/helper definitions from saved preflight output.
