-- F19H.2e: allow tuition_record and tuition_package entities in center_cloud_entities.
-- Review/apply manually in Supabase only after the dry-run helper and readiness gate are accepted.
-- This patch only updates the entity_type check constraint; no tables, policies, roles, triggers, or realtime behavior.

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
      'attendance_record',
      'attendance_baseline_state',
      'session_report',
      'schedule_session',
      'tuition_record',
      'tuition_package'
    )
  );

notify pgrst, 'reload schema';

commit;
