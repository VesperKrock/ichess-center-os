-- C6.1C DreamHome production membership provisioning
-- MANUAL APPLY TEMPLATE ONLY
-- DO NOT RUN UNTIL <BICH_AUTH_USER_ID> is replaced with the real auth.users.id.
-- This creates/gives membership only.
-- It does not copy Angel Wings.
-- It does not insert center_cloud_entities.
-- It does not create an Auth user or password.
-- Intended membership:
--   user_id   = <BICH_AUTH_USER_ID>
--   center_id = dreamhome_prod
--   role      = center_admin
--   status    = active

with new_membership as (
  select
    '<BICH_AUTH_USER_ID>'::uuid as user_id,
    'dreamhome_prod'::text as center_id,
    'center_admin'::text as role,
    'active'::text as status
),
inserted as (
  insert into public.center_members (
    id,
    user_id,
    center_id,
    role,
    status,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    user_id,
    center_id,
    role,
    status,
    now(),
    now()
  from new_membership nm
  where not exists (
    select 1
    from public.center_members cm
    where cm.user_id = nm.user_id
      and cm.center_id = nm.center_id
  )
  returning id, user_id, center_id, role, status
)
select
  'dreamhome_prod_membership_inserted_if_missing' as result,
  count(*) as inserted_count,
  coalesce(string_agg(id::text, ', '), 'already existed or placeholder not replaced') as membership_ids
from inserted;

-- Optional manual review section:
-- If membership already exists but role/status is wrong, do not edit blindly.
-- Review current row first, then use a separate approved phase or manually reviewed statement.
