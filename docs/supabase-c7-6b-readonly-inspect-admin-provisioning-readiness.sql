-- C7.6B READ-ONLY INSPECTION ONLY
-- Do not run as apply/migration.
-- This file does not create Auth users.
-- This file does not create memberships.
-- This file does not create Edge Functions.
-- This file does not modify data.
-- Purpose: inspect database readiness before future admin account provisioning.

select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
where id in ('dreamhome_prod', 'phongtrong_prod', 'dreamhome')
order by environment, id;

select
  c.id as center_id,
  c.name as center_name,
  c.slug,
  c.environment,
  c.status as center_status,
  cm.user_id,
  u.email,
  cm.role,
  cm.status as membership_status,
  cm.created_at,
  cm.updated_at
from public.centers c
left join public.center_members cm
  on cm.center_id = c.id
  and cm.role = 'center_admin'
  and cm.status = 'active'
left join auth.users u on u.id = cm.user_id
where c.id in ('dreamhome_prod', 'phongtrong_prod')
order by c.id, u.email;

select
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
from auth.users
where lower(email) in (
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn'
)
order by lower(email);

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
  role,
  status,
  count(*) as membership_count
from public.center_members
group by role, status
order by role, status;

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

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%audit%'
    or table_name ilike '%log%'
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
    table_name ilike '%audit%'
    or table_name ilike '%log%'
  )
order by table_name, ordinal_position;

select
  entity_type,
  center_id,
  count(*) as entity_count
from public.center_cloud_entities
where entity_type ilike '%audit%'
   or entity_type ilike '%log%'
group by entity_type, center_id
order by entity_type, center_id;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%provision%'
    or p.proname ilike '%audit%'
    or p.proname ilike '%account%'
    or p.proname ilike '%member%'
  )
order by n.nspname, p.proname;
