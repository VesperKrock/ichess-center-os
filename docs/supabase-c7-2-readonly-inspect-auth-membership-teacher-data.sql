-- C7.2 READ-ONLY INSPECTION ONLY
-- Do not run as apply/migration.
-- This file does not create Auth users.
-- This file does not create memberships.
-- This file does not create teacher profiles.
-- This file does not modify data.
-- Purpose: inspect current auth/users/memberships/teacher-related readiness before C7 account model work.

select
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
from auth.users
order by created_at desc;

select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
order by environment, status, id;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.slug,
  c.environment,
  c.status as center_status,
  cm.role,
  cm.status as membership_status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
order by u.email, cm.role, cm.center_id;

select
  cm.role,
  cm.status,
  count(*) as membership_count
from public.center_members cm
group by cm.role, cm.status
order by cm.role, cm.status;

select
  cm.user_id,
  u.email,
  count(distinct cm.center_id) as active_center_admin_centers,
  array_agg(cm.center_id order by cm.center_id) as center_ids
from public.center_members cm
left join auth.users u on u.id = cm.user_id
where cm.role = 'center_admin'
  and cm.status = 'active'
group by cm.user_id, u.email
having count(distinct cm.center_id) > 1
order by active_center_admin_centers desc, u.email;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.slug,
  c.environment,
  cm.role,
  cm.status as membership_status
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
where cm.role = 'owner'
order by u.email, cm.center_id;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.slug,
  c.environment,
  cm.role,
  cm.status as membership_status
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
where cm.role = 'teacher'
order by u.email, cm.center_id;

select
  table_schema,
  table_name
from information_schema.tables
where table_schema in ('public')
  and (
    table_name ilike '%teacher%'
    or table_name ilike '%giao%'
    or table_name ilike '%staff%'
    or table_name ilike '%member%'
  )
order by table_schema, table_name;

select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%teacher%'
    or table_name ilike '%giao%'
    or table_name ilike '%staff%'
    or table_name ilike '%member%'
  )
order by table_name, ordinal_position;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%teacher%'
    or p.proname ilike '%giao%'
    or p.proname ilike '%member%'
    or p.proname ilike '%account%'
  )
order by n.nspname, p.proname;

select
  entity_type,
  center_id,
  count(*) as entity_count
from public.center_cloud_entities
group by entity_type, center_id
order by entity_type, center_id;

select
  center_id,
  entity_type,
  local_id as entity_id,
  updated_at
from public.center_cloud_entities
where entity_type ilike '%teacher%'
   or entity_type ilike '%giao%'
order by center_id, entity_type, local_id
limit 100;

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
