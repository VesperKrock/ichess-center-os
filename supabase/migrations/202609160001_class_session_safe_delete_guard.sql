begin;

create or replace function public.class_session_safe_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.entity_type <> 'class_session'
     or old.deleted_at is not null
     or new.deleted_at is null then
    return new;
  end if;

  -- Student history is authoritative in V2.2.  Ended enrollments still make
  -- the class historical and therefore ineligible for permanent deletion.
  if exists (
    select 1
    from public.center_student_recurring_enrollments enrollment
    where enrollment.center_id = old.center_id
      and enrollment.class_session_local_id = old.local_id
  ) then
    raise exception 'class_session_delete_referenced';
  end if;

  -- Preserve pre-V2.2 Student assignments as well.  Exact id equality is
  -- required; labels and notes never participate in lifecycle decisions.
  if exists (
    select 1
    from public.center_cloud_entities student
    where student.center_id = old.center_id
      and student.entity_type = 'student'
      and (
        (
          pg_catalog.jsonb_typeof(student.payload->'classSessionIds') = 'array'
          and (student.payload->'classSessionIds') @> pg_catalog.jsonb_build_array(old.local_id)
        )
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            case
              when pg_catalog.jsonb_typeof(student.payload->'recurringEnrollments') = 'array'
                then student.payload->'recurringEnrollments'
              else '[]'::jsonb
            end
          ) enrollment_item
          where pg_catalog.btrim(coalesce(
            enrollment_item->>'classSessionId',
            enrollment_item->>'class_session_id',
            ''
          )) = old.local_id
        )
      )
  ) then
    raise exception 'class_session_delete_referenced';
  end if;

  -- A schedule row is itself historical evidence, including a tombstoned row.
  if exists (
    select 1
    from public.center_cloud_entities schedule
    where schedule.center_id = old.center_id
      and schedule.entity_type = 'schedule_session'
      and pg_catalog.btrim(coalesce(schedule.payload->>'classSessionId', '')) = old.local_id
  ) then
    raise exception 'class_session_delete_referenced';
  end if;

  -- Attendance and Session Report may point directly to Class Session or
  -- indirectly through the canonical Schedule Session identity.
  if exists (
    select 1
    from public.center_cloud_entities history
    where history.center_id = old.center_id
      and history.entity_type in ('attendance_record', 'session_report')
      and (
        pg_catalog.btrim(coalesce(history.payload->>'classSessionId', '')) = old.local_id
        or exists (
          select 1
          from public.center_cloud_entities schedule
          where schedule.center_id = old.center_id
            and schedule.entity_type = 'schedule_session'
            and pg_catalog.btrim(coalesce(schedule.payload->>'classSessionId', '')) = old.local_id
            and schedule.local_id in (
              pg_catalog.btrim(coalesce(history.payload->>'scheduleSessionId', '')),
              pg_catalog.btrim(coalesce(history.payload->>'sessionId', ''))
            )
        )
      )
  ) then
    raise exception 'class_session_delete_referenced';
  end if;

  return new;
end
$$;

drop trigger if exists class_session_safe_delete_guard on public.center_cloud_entities;
create trigger class_session_safe_delete_guard
before update on public.center_cloud_entities
for each row execute function public.class_session_safe_delete_guard();

comment on function public.class_session_safe_delete_guard() is
  'Rejects C5.1 Class Session soft-delete when Student, Schedule, Attendance, or Session Report authority contains a current or historical exact-id reference.';

commit;
