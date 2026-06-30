-- MANUAL APPLY TEMPLATE ONLY
-- DO NOT RUN IN C6.4B.
-- Review and run only in a later confirmed apply phase such as C6.4C/C6.4D.
-- Purpose: create/ensure owner membership for a confirmed existing Auth user.
-- This does not create Auth users.
-- This does not create centers.
-- This does not delete data.
-- This does not touch Angel Wings.

begin;

-- Replace before running in a later apply phase:
-- OWNER_USER_ID_HERE
-- TARGET_CENTER_ID_HERE

-- Example target:
-- TARGET_CENTER_ID_HERE = dreamhome_prod

-- Safety precheck: target center must exist and be active.
select
  id,
  name,
  slug,
  environment,
  status
from public.centers
where id = 'TARGET_CENTER_ID_HERE';

-- Safety precheck: confirmed Auth user must already exist.
select
  id,
  email,
  created_at
from auth.users
where id = 'OWNER_USER_ID_HERE';

-- Safety precheck: inspect any current membership for the pair.
select
  user_id,
  center_id,
  role,
  status,
  created_at,
  updated_at
from public.center_members
where user_id = 'OWNER_USER_ID_HERE'
  and center_id = 'TARGET_CENTER_ID_HERE';

-- Later apply block only. Uncomment only in a confirmed apply phase.
-- Do not use wildcard center_id.
-- Confirm whether public.center_members has a unique constraint/index on (user_id, center_id).
--
-- insert into public.center_members (
--   user_id,
--   center_id,
--   role,
--   status,
--   created_at,
--   updated_at
-- )
-- values (
--   'OWNER_USER_ID_HERE',
--   'TARGET_CENTER_ID_HERE',
--   'owner',
--   'active',
--   now(),
--   now()
-- )
-- on conflict (user_id, center_id)
-- do update set
--   role = excluded.role,
--   status = excluded.status,
--   updated_at = now();

-- Default safety behavior for this template review file.
rollback;
