-- C6.6D POST-CREATE VERIFY CENTER
-- Read-only verification after a controlled RPC create.
-- This file must not create centers.
-- This file must not create memberships.
-- This file must not call provision_center_for_owner.

-- Default C6.6D.1 target is Phòng Trống / phongtrong_prod.
-- Change these literals only if the confirmed target is not Phòng Trống.
select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
where id = 'phongtrong_prod'
   or slug = 'phongtrong'
order by id;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.slug,
  c.environment,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
where cm.center_id = 'phongtrong_prod'
order by u.email, cm.role, cm.status;
