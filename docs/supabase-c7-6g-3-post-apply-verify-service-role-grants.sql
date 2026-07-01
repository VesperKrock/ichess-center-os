-- C7.6G.3 POST-APPLY VERIFY: service_role grants
-- Read-only verification.
-- This file does not modify data.

select
  'service_role' as role_name,
  has_schema_privilege('service_role', 'public', 'USAGE') as public_schema_usage,
  has_table_privilege('service_role', 'public.centers', 'SELECT') as centers_select,
  has_table_privilege('service_role', 'public.center_members', 'SELECT') as center_members_select,
  has_table_privilege('service_role', 'public.center_members', 'INSERT') as center_members_insert,
  has_table_privilege('service_role', 'public.center_members', 'DELETE') as center_members_delete,
  has_table_privilege('service_role', 'public.account_audit_logs', 'SELECT') as account_audit_logs_select,
  has_table_privilege('service_role', 'public.account_audit_logs', 'INSERT') as account_audit_logs_insert;

select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'service_role'
  and table_schema = 'public'
  and table_name in ('centers', 'center_members', 'account_audit_logs')
order by table_name, privilege_type;
