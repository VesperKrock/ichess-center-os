-- C7.8F readonly post-restore verify.
-- Expected: Phong Trong admin membership is active again,
-- Auth user still exists, DreamHome admin remains active. No mutations in this file.

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status
from public.center_members cm
join auth.users au on au.id = cm.user_id
where cm.center_id = 'phongtrong_prod'
  and cm.role = 'center_admin'
  and lower(au.email) = 'admin.phongtrong@ichess.vn';

select id, email, deleted_at
from auth.users
where lower(email) = 'admin.phongtrong@ichess.vn';

select
  id,
  action,
  target_email,
  center_id,
  before_state,
  after_state,
  request_id,
  created_at
from public.account_audit_logs
where action = 'account.restore_center_admin_access'
  and center_id = 'phongtrong_prod'
  and target_email = 'admin.phongtrong@ichess.vn'
order by created_at desc
limit 5;

select
  cm.center_id,
  au.email,
  cm.role,
  cm.status
from public.center_members cm
join auth.users au on au.id = cm.user_id
where cm.center_id = 'dreamhome_prod'
  and cm.role = 'center_admin'
  and lower(au.email) = 'admin.dreamhome@ichess.vn';

select center_id, user_id, count(*) as active_center_admin_memberships
from public.center_members
where role = 'center_admin'
  and status = 'active'
group by center_id, user_id
having count(*) > 1;

select
  id,
  action,
  center_id,
  target_email,
  created_at
from public.account_audit_logs
where (
    before_state::text ilike '%password%' or
    after_state::text ilike '%password%' or
    metadata::text ilike '%password%' or
    reason ilike '%password%'
  )
  and center_id = 'phongtrong_prod'
order by created_at desc
limit 20;
