-- C5.3B FINAL APPLY - audit/conflict/rollback readiness
-- MANUAL ONLY.
-- SQL APPLY: NO in Codex.
-- WAITING USER CONFIRMATION BEFORE APPLYING SQL.
-- Purpose: add audit_log_entry to center_cloud_entities entity_type allowlist.
-- Data destructive: intended NO.
-- This file does not add a new table, does not loosen RLS, and does not seed data.
--
-- Manual safety steps:
-- 1. Run docs/supabase-c5-3b-readonly-verify-audit-conflict-rollback.sql first.
-- 2. Stop if the current allowlist contains entity types not listed below.
-- 3. Save the current constraint definition before applying.
-- 4. Apply this file manually only if audit_log_entry is missing and user approves.
-- 5. Run the read-only verification again after applying.

begin;

alter table public.center_cloud_entities
  drop constraint if exists center_cloud_entities_entity_type_check;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_type_check
  check (
    entity_type in (
      'student',
      'teacher',
      'class_session',
      'schedule_session',
      'attendance_record',
      'attendance_baseline_state',
      'session_report',
      'tuition_record_package',
      'audit_log_entry'
    )
  );

commit;

notify pgrst, 'reload schema';

-- Verification, read-only:

select
  conname,
  pg_get_constraintdef(oid) as definition,
  pg_get_constraintdef(oid) like '%audit_log_entry%' as has_audit_log_entry
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';

select
  'allowlist_has_audit_log_entry' as check_name,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.center_cloud_entities'::regclass
      and pg_get_constraintdef(oid) like '%audit_log_entry%'
  ) as ok;

-- Rollback note:
-- If this was applied incorrectly, restore center_cloud_entities_entity_type_check
-- from the saved preflight constraint definition. Do not change data rows.
