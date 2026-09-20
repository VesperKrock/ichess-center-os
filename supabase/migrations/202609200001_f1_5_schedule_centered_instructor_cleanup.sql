begin;

do $$
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_student_recurring_enrollments') is null
     or pg_catalog.to_regprocedure(
       'public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)'
     ) is null
     or pg_catalog.to_regprocedure('public.v2_2_internal_guard_core_identity()') is null
     or pg_catalog.to_regprocedure('public.v2_2_internal_class_weekdays(jsonb)') is null
     or pg_catalog.to_regprocedure('public.v2_2_internal_normalize_weekday(text)') is null then
    raise exception 'f1_5_missing_prerequisite';
  end if;
end
$$;

create or replace function public.v2_2_internal_guard_core_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.center_cloud_entities;
  v_class_id text;
  v_day text;
  v_class_days text[];
begin
  if new.entity_type = 'class_session' then
    v_class_days := public.v2_2_internal_class_weekdays(new.payload);
    if exists (
      select 1
      from public.center_student_recurring_enrollments e
      where e.center_id = new.center_id
        and e.class_session_local_id = new.local_id
        and e.ended_at is null
        and (new.deleted_at is not null or not (e.weekdays <@ v_class_days))
    ) then
      raise exception 'v2_2_class_weekday_in_use';
    end if;
  elsif new.entity_type = 'schedule_session'
      and new.deleted_at is null
      and pg_catalog.lower(coalesce(new.payload->>'isDeleted', 'false')) <> 'true'
      and pg_catalog.lower(coalesce(new.payload->>'scheduleType', 'recurring')) <> 'oneoff' then
    v_class_id := pg_catalog.btrim(coalesce(new.payload->>'classSessionId', ''));
    v_day := public.v2_2_internal_normalize_weekday(new.payload->>'dayOfWeek');
    if v_class_id = '' or v_day is null then
      raise exception 'v2_2_schedule_class_link_required';
    end if;
    select * into v_class
    from public.center_cloud_entities e
    where e.center_id = new.center_id
      and e.entity_type = 'class_session'
      and e.local_id = v_class_id
      and e.deleted_at is null;
    if v_class.id is null or not (v_day = any(public.v2_2_internal_class_weekdays(v_class.payload))) then
      raise exception 'v2_2_schedule_class_link_required';
    end if;
  end if;
  return new;
end
$$;

alter function public.v2_2_internal_guard_core_identity() owner to postgres;
revoke all on function public.v2_2_internal_guard_core_identity()
  from public, anon, authenticated, service_role;

create or replace function public.f1_5_internal_reconcile_schedule_instructor_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_student_count bigint := 0;
  v_orphan_schedule_count bigint := 0;
begin
  with reconciled_students as (
    update public.center_cloud_entities entity
    set payload = (entity.payload - 'assignedTeacherId' - 'mainTeacherName')
        || pg_catalog.jsonb_build_object('updatedAt', v_now),
        entity_version = entity.entity_version + 1,
        updated_at = v_now
    where entity.entity_type = 'student'
      and entity.deleted_at is null
      and pg_catalog.lower(coalesce(entity.payload->>'isDeleted', 'false')) <> 'true'
      and (entity.payload ? 'assignedTeacherId' or entity.payload ? 'mainTeacherName')
    returning 1
  )
  select pg_catalog.count(*) into v_student_count from reconciled_students;

  with retired_orphan_schedules as (
    update public.center_cloud_entities schedule
    set payload = schedule.payload || pg_catalog.jsonb_build_object(
          'status', 'cancelled',
          'isDeleted', true,
          'deletedAt', v_now,
          'updatedAt', v_now,
          'futureRecurrenceRetired', true,
          'retirementReason', 'orphaned-class-session'
        ),
        entity_version = schedule.entity_version + 1,
        updated_at = v_now
    where schedule.entity_type = 'schedule_session'
      and schedule.deleted_at is null
      and pg_catalog.lower(coalesce(schedule.payload->>'isDeleted', 'false')) <> 'true'
      and pg_catalog.lower(coalesce(schedule.payload->>'scheduleType', 'recurring'))
        not in ('oneoff', 'one-off')
      and not exists (
        select 1
        from public.center_cloud_entities class_session
        where class_session.center_id = schedule.center_id
          and class_session.entity_type = 'class_session'
          and class_session.local_id = pg_catalog.btrim(
            coalesce(schedule.payload->>'classSessionId', '')
          )
          and class_session.deleted_at is null
          and pg_catalog.lower(coalesce(class_session.payload->>'isDeleted', 'false')) <> 'true'
      )
    returning 1
  )
  select pg_catalog.count(*)
    into v_orphan_schedule_count
  from retired_orphan_schedules;

  return pg_catalog.jsonb_build_object(
    'student_assignments_removed', v_student_count,
    'orphan_recurrences_retired', v_orphan_schedule_count
  );
end
$$;

alter function public.f1_5_internal_reconcile_schedule_instructor_state() owner to postgres;
revoke all on function public.f1_5_internal_reconcile_schedule_instructor_state()
  from public, anon, authenticated, service_role;

select public.f1_5_internal_reconcile_schedule_instructor_state();

create or replace function public.f1_5_internal_enforce_schedule_centered_instructor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_instructor_name text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if new.entity_type = 'student' then
    new.payload := new.payload - 'assignedTeacherId' - 'mainTeacherName';
    return new;
  end if;

  if new.entity_type = 'class_session' and new.payload ? 'instructorName' then
    if new.payload->'instructorName' = 'null'::jsonb then
      new.payload := new.payload - 'instructorName';
      return new;
    end if;
    if pg_catalog.jsonb_typeof(new.payload->'instructorName') <> 'string' then
      raise exception 'f1_5_invalid_slot_instructor';
    end if;
    v_instructor_name := pg_catalog.btrim(new.payload->>'instructorName');
    if pg_catalog.length(v_instructor_name) > 160 then
      raise exception 'f1_5_invalid_slot_instructor';
    end if;
    if v_instructor_name = '' then
      new.payload := new.payload - 'instructorName';
    else
      new.payload := pg_catalog.jsonb_set(
        new.payload,
        '{instructorName}',
        pg_catalog.to_jsonb(v_instructor_name),
        true
      );
    end if;
    return new;
  end if;

  if new.entity_type = 'schedule_session'
     and pg_catalog.lower(coalesce(new.payload->>'scheduleType', 'recurring'))
       not in ('oneoff', 'one-off')
     and pg_catalog.lower(coalesce(new.payload->>'isDeleted', 'false')) <> 'true' then
    new.payload := new.payload - 'teacherId' - 'teacherName';
  end if;

  return new;
end
$$;

alter function public.f1_5_internal_enforce_schedule_centered_instructor() owner to postgres;
revoke all on function public.f1_5_internal_enforce_schedule_centered_instructor()
  from public, anon, authenticated, service_role;

drop trigger if exists f1_5_enforce_schedule_centered_instructor
  on public.center_cloud_entities;
create trigger f1_5_enforce_schedule_centered_instructor
before insert or update of entity_type, payload, deleted_at
on public.center_cloud_entities
for each row execute function public.f1_5_internal_enforce_schedule_centered_instructor();

comment on function public.f1_5_internal_reconcile_schedule_instructor_state() is
  'F1.5 deterministic reconciliation: removes obsolete current Student instructor ownership and retires only active recurring schedules whose Settings slot no longer exists.';
comment on function public.f1_5_internal_enforce_schedule_centered_instructor() is
  'F1.5 payload boundary: Student has no instructor ownership, class_session may hold one nullable instructorName, recurring schedule rows inherit the slot instructor.';

commit;
