-- F19H.2b.1: allow attendance_record entity in center_cloud_entities.
-- Khong chay tu dong. Ap dung thu cong trong Supabase SQL Editor sau khi review.
-- Patch nay chi mo entity_type allowlist, khong tao bang moi va khong bat sync that.

begin;

alter table public.center_cloud_entities
  drop constraint if exists center_cloud_entities_entity_type_check;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_type_check
  check (entity_type in ('student', 'teacher', 'class_session', 'attendance_record'));

notify pgrst, 'reload schema';

commit;
