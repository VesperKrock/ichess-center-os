-- C5.2B READ-ONLY VERIFY - Hoc phi / TBHP cloud source-of-truth
-- SQL APPLY: NO
-- SUPABASE ACTION: NO
-- SUPABASE DATA CHANGE: NO
-- WAITING USER CONFIRMATION BEFORE ANY APPLY
-- RUNTIME CHANGE: NO
-- COMMIT: NO
-- PUSH: NO
--
-- Manual read-only verification only.
-- User may copy this file into Supabase SQL Editor to inspect readiness.
-- Codex must not run this SQL.
-- This file intentionally contains only SELECT statements.

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'center_cloud_entities';

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_cloud_entities'
order by ordinal_position;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname like '%entity_type%';

select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
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
where entity_type = 'tuition_record_package'
group by entity_type;

