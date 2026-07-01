-- C7.6C POST-APPLY VERIFY: account/server-side audit infrastructure
-- Read-only verification.
-- This file does not modify data.

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'account_audit_logs';

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'account_audit_logs'
order by ordinal_position;

select
  con.conname,
  pg_get_constraintdef(con.oid) as constraint_def
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'account_audit_logs'
order by con.conname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'account_audit_logs'
order by indexname;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'account_audit_logs';

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'account_audit_logs'
order by policyname;
