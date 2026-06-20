-- F19H.2c: allow attendance_baseline_state and session_report entities in center_cloud_entities.
-- Khong chay tu dong. Ap dung thu cong trong Supabase SQL Editor sau khi review.
-- Patch nay chi mo entity_type allowlist, khong tao bang moi va khong bat sync that.

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
      'session_report'
    )
  );

notify pgrst, 'reload schema';

commit;
