-- C7.8F readonly preflight for controlled Phong Trong revoke.
-- Target center_id: phongtrong_prod
-- Target admin: admin.phongtrong@ichess.vn
-- No mutations in this file.

select id, name, slug, environment, status
from public.centers
where id in ('phongtrong_prod', 'dreamhome_prod')
order by id;

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

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status
from public.center_members cm
join auth.users au on au.id = cm.user_id
where cm.center_id = 'phongtrong_prod'
  and cm.role = 'owner'
  and lower(au.email) = 'owner.duchai@ichess.vn';

select
  id,
  action,
  target_email,
  center_id,
  reason,
  request_id,
  created_at
from public.account_audit_logs
where center_id = 'phongtrong_prod'
  and target_email = 'admin.phongtrong@ichess.vn'
order by created_at desc
limit 10;

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
