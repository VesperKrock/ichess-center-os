-- C7.8F manual apply only.
-- Supabase project: zahcfnpaprbnuqpegdmo
-- Purpose: allow Edge Functions using service role to update center_members.status
-- for controlled revoke/restore of center admin access.
-- Review before running. Do not run if you are not in the iChess Supabase project.

grant usage on schema public to service_role;
grant select on public.centers to service_role;
grant select, insert, update on public.center_members to service_role;
grant select, insert on public.account_audit_logs to service_role;

-- Verify grants after manual apply.
select
  table_schema,
  table_name,
  privilege_type,
  grantee
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('centers', 'center_members', 'account_audit_logs')
  and grantee = 'service_role'
order by table_name, privilege_type;
