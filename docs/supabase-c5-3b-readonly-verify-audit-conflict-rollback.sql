-- C5.3B READ-ONLY VERIFY - audit/conflict/rollback readiness
-- SQL APPLY: NO
-- SUPABASE DATA CHANGE: NO
-- Manual use only: user may copy this into Supabase SQL Editor to inspect readiness.

select
  to_regclass('public.center_cloud_entities') is not null as center_cloud_entities_exists;

select
  conname,
  pg_get_constraintdef(oid) as definition,
  pg_get_constraintdef(oid) like '%audit_log_entry%' as has_audit_log_entry
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname like '%entity_type%';

select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where schemaname = 'public'
  and tablename = 'center_cloud_entities';

select
  c.relname,
  c.relreplident
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'center_cloud_entities';

select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('can_write_center', 'is_center_member')
order by routine_name;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'center_cloud_entities'
order by policyname;

select
  entity_type,
  count(*) as row_count
from public.center_cloud_entities
where entity_type = 'audit_log_entry'
group by entity_type;

select
  'allowlist_has_audit_log_entry' as check_name,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.center_cloud_entities'::regclass
      and pg_get_constraintdef(oid) like '%audit_log_entry%'
  ) as ok

union all

select
  'realtime_has_center_cloud_entities' as check_name,
  exists (
    select 1
    from pg_publication_tables
    where schemaname = 'public'
      and tablename = 'center_cloud_entities'
  ) as ok

union all

select
  'replica_identity_full' as check_name,
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'center_cloud_entities'
      and c.relreplident = 'f'
  ) as ok

union all

select
  'has_can_write_center' as check_name,
  exists (
    select 1
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'can_write_center'
  ) as ok

union all

select
  'has_is_center_member' as check_name,
  exists (
    select 1
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'is_center_member'
  ) as ok;
