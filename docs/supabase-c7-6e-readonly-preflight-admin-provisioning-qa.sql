-- C7.6E READ-ONLY PREFLIGHT ONLY
-- Do not modify data.
-- Do not create Auth users.
-- Do not create memberships.
-- Do not invoke Edge Functions.

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
  c.slug,
  cm.user_id,
  u.email,
  cm.role,
  cm.status as membership_status
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
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'account_audit_logs';

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'account_audit_logs';

select
  action,
  center_id,
  target_email,
  request_id,
  created_at
from public.account_audit_logs
where action = 'account.provision_center_admin'
  and center_id in ('dreamhome_prod', 'phongtrong_prod')
order by created_at desc
limit 20;
