begin;

-- Baseline lifecycle is one aggregate per center. Keeping tombstones in the
-- singleton prevents an alternate local_id from bypassing lock/currentness.
create unique index center_cloud_entities_c5_2_baseline_singleton_idx
  on public.center_cloud_entities (center_id)
  where entity_type = 'attendance_baseline_state';

comment on index public.center_cloud_entities_c5_2_baseline_singleton_idx is
  'C5.2 review hardening: exactly one attendance_baseline_state identity per center, including tombstones.';

commit;
