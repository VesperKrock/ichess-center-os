-- C6.6B READ-ONLY INSPECT ONLY
-- Do not run as apply/migration.
-- This file does not create centers.
-- This file does not create memberships.
-- This file does not create functions.
-- This file does not modify data.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'centers'
order by ordinal_position;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
order by ordinal_position;

select
  con.conname,
  rel.relname as table_name,
  pg_get_constraintdef(con.oid) as constraint_def
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname in ('centers', 'center_members')
order by rel.relname, con.conname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('centers', 'center_members')
order by tablename, indexname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'centers'
  and indexname = 'centers_slug_environment_unique_idx';

select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
order by environment, id;

select
  cm.center_id,
  c.name as center_name,
  c.environment,
  cm.role,
  cm.status,
  count(*) as membership_count
from public.center_members cm
left join public.centers c on c.id = cm.center_id
group by cm.center_id, c.name, c.environment, cm.role, cm.status
order by cm.center_id, cm.role, cm.status;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.environment,
  cm.role,
  cm.status
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
where lower(u.email) = lower('owner.duchai@ichess.vn')
order by cm.center_id;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'extensions')
  and (
    p.proname ilike '%center%'
    or p.proname ilike '%provision%'
    or p.proname ilike '%slug%'
    or p.proname ilike '%unaccent%'
  )
order by n.nspname, p.proname;

select
  extname,
  extversion
from pg_extension
where extname in ('unaccent', 'uuid-ossp', 'pgcrypto')
order by extname;

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
  and tablename in ('centers', 'center_members')
order by tablename, policyname;
