-- C6.4B READ-ONLY INSPECT ONLY
-- Do not run as apply/migration.
-- This file does not create users.
-- This file does not create memberships.
-- This file does not create centers.
-- This file does not modify data.

-- 1. Current centers.
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

-- 2. center_members columns.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
order by ordinal_position;

-- 3. Distinct roles currently present.
select distinct
  role
from public.center_members
order by role;

-- 4. Membership count by center, role, and status.
select
  center_id,
  role,
  status,
  count(*) as membership_count
from public.center_members
group by center_id, role, status
order by center_id, role, status;

-- 5. Admin DreamHome membership check.
select
  cm.user_id,
  cm.center_id,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
where cm.center_id = 'dreamhome_prod'
  and cm.role = 'center_admin'
  and cm.status = 'active'
order by cm.updated_at desc nulls last, cm.created_at desc nulls last;

-- 6. Optional Auth user lookup placeholder.
-- Replace OWNER_EMAIL_HERE manually only when reviewing in Supabase SQL Editor.
select
  id,
  email,
  created_at,
  last_sign_in_at
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE');

-- 7. Existing owner role check.
select
  center_id,
  status,
  count(*) as owner_membership_count
from public.center_members
where role = 'owner'
group by center_id, status
order by center_id, status;

-- 8. Helper functions readiness check.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_center_member', 'can_write_center')
order by p.proname;

-- 9. Unique indexes/constraints that may affect later upsert strategy.
select
  i.relname as index_name,
  pg_get_indexdef(i.oid) as index_definition
from pg_class t
join pg_index ix on ix.indrelid = t.oid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'center_members'
order by i.relname;
