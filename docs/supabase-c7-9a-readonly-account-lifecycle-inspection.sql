-- C7.9A readonly account lifecycle inspection.
-- Run manually in Supabase SQL editor. This file is SELECT-only.

select
  c.id,
  c.name,
  c.slug,
  c.environment,
  c.status,
  c.created_at,
  c.updated_at
from public.centers c
where c.id in ('dreamhome', 'dreamhome_prod', 'phongtrong_prod')
   or c.slug in ('dreamhome', 'phongtrong')
order by c.environment, c.name, c.id;

select
  cm.center_id,
  cm.role,
  cm.status,
  count(*) as membership_count
from public.center_members cm
group by cm.center_id, cm.role, cm.status
order by cm.center_id, cm.role, cm.status;

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users au on au.id = cm.user_id
where cm.role = 'center_admin'
  and (
    au.email in ('admin.dreamhome@ichess.vn', 'admin.phongtrong@ichess.vn')
    or cm.center_id in ('dreamhome_prod', 'phongtrong_prod')
  )
order by cm.center_id, au.email nulls last, cm.status;

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users au on au.id = cm.user_id
where cm.role = 'owner'
  and (
    au.email = 'owner.duchai@ichess.vn'
    or cm.center_id in ('dreamhome_prod', 'phongtrong_prod')
  )
order by cm.center_id, au.email nulls last;

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users au on au.id = cm.user_id
where cm.status in ('revoked', 'paused', 'disabled', 'banned', 'inactive', 'expired')
order by cm.updated_at desc nulls last, cm.created_at desc nulls last;

with active_center_admins as (
  select
    cm.user_id,
    au.email,
    array_agg(cm.center_id order by cm.center_id) as center_ids,
    count(distinct cm.center_id) as active_center_count
  from public.center_members cm
  left join auth.users au on au.id = cm.user_id
  where cm.role = 'center_admin'
    and cm.status = 'active'
  group by cm.user_id, au.email
)
select
  user_id,
  email,
  active_center_count,
  center_ids
from active_center_admins
where active_center_count > 1
order by active_center_count desc, email nulls last;

select
  cm.center_id,
  cm.user_id,
  au.email,
  cm.role,
  cm.status,
  cm.created_at,
  cm.updated_at
from public.center_members cm
left join auth.users au on au.id = cm.user_id
where cm.role = 'teacher'
order by cm.center_id, au.email nulls last;

select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('teacher_profiles', 'center_teacher_assignments')
order by table_name;

select
  aal.id,
  aal.created_at,
  aal.actor_email,
  aal.action,
  aal.target_email,
  aal.center_id,
  aal.reason,
  aal.request_id,
  aal.before_state,
  aal.after_state,
  aal.metadata
from public.account_audit_logs aal
where aal.action in (
  'account.provision_center_admin',
  'account.reset_center_admin_password',
  'account.revoke_center_admin_access',
  'account.restore_center_admin_access'
)
order by aal.created_at desc
limit 100;

with audit_text as (
  select
    aal.id,
    aal.created_at,
    aal.action,
    concat_ws(
      ' ',
      coalesce(aal.reason, ''),
      coalesce(aal.before_state::text, ''),
      coalesce(aal.after_state::text, ''),
      coalesce(aal.metadata::text, '')
    ) as searchable_text
  from public.account_audit_logs aal
  where aal.action like 'account.%'
)
select
  id,
  created_at,
  action
from audit_text
where searchable_text ~* '(password|temporary_password|service_role|jwt|authorization|access_token|refresh_token)'
order by created_at desc;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('centers', 'center_members', 'account_audit_logs')
order by tablename, policyname;
