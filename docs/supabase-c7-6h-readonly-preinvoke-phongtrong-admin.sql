-- C7.6H READ-ONLY PRE-INVOKE CHECK
-- Do not modify data.
-- Do not create Auth users.
-- Do not create memberships.
-- Purpose: confirm Phong Trong is still safe before controlled admin provisioning.

select
  id,
  name,
  slug,
  environment,
  status
from public.centers
where id in ('dreamhome_prod', 'phongtrong_prod')
order by id;

select
  c.id as center_id,
  c.name as center_name,
  u.email,
  cm.role,
  cm.status,
  cm.created_at
from public.center_members cm
join public.centers c on c.id = cm.center_id
join auth.users u on u.id = cm.user_id
where cm.role = 'center_admin'
  and cm.status = 'active'
  and cm.center_id in ('dreamhome_prod', 'phongtrong_prod')
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
  id,
  created_at,
  actor_email,
  action,
  target_email,
  center_id,
  request_id,
  before_state,
  after_state,
  metadata
from public.account_audit_logs
where action = 'account.provision_center_admin'
  and center_id in ('dreamhome_prod', 'phongtrong_prod')
order by created_at desc
limit 20;
