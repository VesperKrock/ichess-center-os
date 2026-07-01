-- C7.7B POST-REVOKE VERIFY READ-ONLY
-- Do not modify data.

select
  c.id as center_id,
  c.name as center_name,
  u.email,
  cm.user_id,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
join public.centers c on c.id = cm.center_id
join auth.users u on u.id = cm.user_id
where cm.center_id = 'phongtrong_prod'
  and lower(u.email) = 'admin.phongtrong@ichess.vn'
order by cm.updated_at desc nulls last, cm.created_at desc;

select
  cm.center_id,
  count(*) as active_center_admin_count
from public.center_members cm
where cm.center_id = 'phongtrong_prod'
  and cm.role = 'center_admin'
  and cm.status = 'active'
group by cm.center_id
order by cm.center_id;

select
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  updated_at
from auth.users
where lower(email) = 'admin.phongtrong@ichess.vn';

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
where action = 'account.revoke_center_admin_access'
  and center_id = 'phongtrong_prod'
  and target_email = 'admin.phongtrong@ichess.vn'
order by created_at desc
limit 5;

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
   or metadata ? 'new_password'
   or before_state ? 'temporary_password'
   or before_state ? 'password'
   or before_state ? 'plaintext_password'
   or before_state ? 'new_password'
   or after_state ? 'temporary_password'
   or after_state ? 'password'
   or after_state ? 'plaintext_password'
   or after_state ? 'new_password'
order by created_at desc;
