-- C7.6E POST-QA VERIFY READ-ONLY
-- Do not modify data.

select
  cm.center_id,
  count(*) as active_center_admin_count
from public.center_members cm
where cm.role = 'center_admin'
  and cm.status = 'active'
  and cm.center_id in ('dreamhome_prod', 'phongtrong_prod')
group by cm.center_id
order by cm.center_id;

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
  id,
  created_at,
  actor_email,
  action,
  target_type,
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

select
  id,
  created_at,
  action,
  target_email,
  center_id,
  request_id
from public.account_audit_logs
where metadata ? 'temporary_password'
   or metadata ? 'password'
   or metadata ? 'plaintext_password'
   or before_state ? 'temporary_password'
   or before_state ? 'password'
   or before_state ? 'plaintext_password'
   or after_state ? 'temporary_password'
   or after_state ? 'password'
   or after_state ? 'plaintext_password'
order by created_at desc;
