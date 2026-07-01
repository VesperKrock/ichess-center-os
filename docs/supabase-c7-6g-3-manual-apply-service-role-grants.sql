-- C7.6G.3 MANUAL APPLY: service_role grants for admin provisioning Edge Function
-- Run manually in Supabase SQL Editor only after user approval.
-- Purpose: grant minimal table privileges to service_role for server-side Edge Function.
-- This file does not create Auth users.
-- This file does not create memberships.
-- This file does not create centers.
-- This file does not insert/update/delete business data.
-- This file does not create Edge Functions.

grant usage on schema public to service_role;

grant select on table public.centers to service_role;

grant select, insert, delete on table public.center_members to service_role;

grant select, insert on table public.account_audit_logs to service_role;
