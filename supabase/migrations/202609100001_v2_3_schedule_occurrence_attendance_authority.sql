-- V2-3 canonical attendance identity for one concrete schedule occurrence.
-- The existing C5.2 center_cloud_entities attendance_record remains the only
-- attendance authority. This migration only constrains its operational key and
-- adds an atomic compatibility cutover command for legacy source-specific rows.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_operational_command_result') is null
     or pg_catalog.to_regclass('public.center_student_enrollment_sets') is null
     or pg_catalog.to_regclass('public.center_student_recurring_enrollments') is null
     or pg_catalog.to_regprocedure('public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_2_internal_class_weekdays(jsonb)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_3_missing_prerequisite';
  end if;
end
$$;

create table public.center_occurrence_attendance_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (octet_length(intent_digest) = 32),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (center_id, actor_user_id, idempotency_key)
);

alter table public.center_occurrence_attendance_command_results enable row level security;
alter table public.center_occurrence_attendance_command_results force row level security;
revoke all on table public.center_occurrence_attendance_command_results
  from public, anon, authenticated, service_role;
grant all on table public.center_occurrence_attendance_command_results to service_role;

create function public.v2_3_internal_occurrence_attendance_local_id(
  p_center_id text,
  p_schedule_session_id text,
  p_occurrence_date date,
  p_student_local_id text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'attendance_record::v2-3::' || pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.btrim(coalesce(p_center_id, '')) || chr(31) ||
        pg_catalog.btrim(coalesce(p_schedule_session_id, '')) || chr(31) ||
        coalesce(p_occurrence_date::text, '') || chr(31) ||
        pg_catalog.btrim(coalesce(p_student_local_id, '')),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function public.v2_3_internal_guard_occurrence_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule_id text;
  v_student_id text;
  v_date date;
  v_expected_local_id text;
  v_schedule public.center_cloud_entities;
  v_class public.center_cloud_entities;
  v_schedule_type text;
  v_class_session_id text;
  v_occurrence_weekday text;
begin
  if new.entity_type <> 'attendance_record'
     or new.deleted_at is not null
     or new.payload->>'source' = 'initialBaseline' then
    return new;
  end if;

  -- Once V2-3 is installed, every new/current operational attendance row must
  -- use the canonical occurrence contract. Existing legacy rows remain as
  -- immutable compatibility evidence and may only be retired (soft deleted).
  if new.payload->>'attendanceAuthority' is distinct from 'v2.3-occurrence-v1' then
    raise exception 'v2_3_canonical_occurrence_required';
  end if;

  v_schedule_id := pg_catalog.btrim(coalesce(new.payload->>'scheduleSessionId', ''));
  v_student_id := pg_catalog.btrim(coalesce(new.payload->>'studentId', ''));
  begin
    v_date := (new.payload->>'date')::date;
  exception when others then
    raise exception 'v2_3_invalid_occurrence_identity';
  end;

  if v_schedule_id = '' or v_student_id = ''
     or new.payload->>'date' <> v_date::text
     or pg_catalog.btrim(coalesce(new.payload->>'sessionId', '')) <> v_schedule_id then
    raise exception 'v2_3_invalid_occurrence_identity';
  end if;

  select * into v_schedule
  from public.center_cloud_entities e
  where e.center_id = new.center_id
    and e.entity_type = 'schedule_session'
    and e.local_id = v_schedule_id
    and e.deleted_at is null;
  if v_schedule.id is null or not exists (
    select 1
    from public.center_cloud_entities e
    where e.center_id = new.center_id
      and e.entity_type = 'student'
      and e.local_id = v_student_id
      and e.deleted_at is null
  ) then
    raise exception 'v2_3_occurrence_reference_not_found';
  end if;

  v_schedule_type := pg_catalog.lower(coalesce(v_schedule.payload->>'scheduleType', 'recurring'));
  v_class_session_id := pg_catalog.btrim(coalesce(v_schedule.payload->>'classSessionId', ''));
  v_occurrence_weekday := case extract(isodow from v_date)
    when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
    when 5 then 'fri' when 6 then 'sat' when 7 then 'sun' end;
  if v_schedule_type = 'oneoff' then
    if coalesce(v_schedule.payload->>'date', v_schedule.payload->>'occurrenceDate', '') <> v_date::text then
      raise exception 'v2_3_schedule_occurrence_not_found';
    end if;
  else
    select * into v_class
    from public.center_cloud_entities e
    where e.center_id = new.center_id and e.entity_type = 'class_session'
      and e.local_id = v_class_session_id and e.deleted_at is null;
    if v_class.id is null
       or not (v_occurrence_weekday = any(public.v2_2_internal_class_weekdays(v_class.payload)))
       or (coalesce(v_schedule.payload->>'startDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and v_date < (v_schedule.payload->>'startDate')::date)
       or (coalesce(v_schedule.payload->>'endDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and v_date > (v_schedule.payload->>'endDate')::date) then
      raise exception 'v2_3_schedule_occurrence_not_found';
    end if;
  end if;

  if v_schedule_type = 'oneoff' then
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements_text(
        case when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
          then v_schedule.payload->'studentIds' else '[]'::jsonb end
      ) roster(student_id) where roster.student_id = v_student_id
    ) then raise exception 'v2_3_student_not_in_occurrence_roster'; end if;
  elsif exists (
    select 1 from public.center_student_enrollment_sets s
    where s.center_id=new.center_id and s.student_local_id=v_student_id and s.ended_at is null
  ) then
    if not exists (
      select 1 from public.center_student_recurring_enrollments e
      where e.center_id=new.center_id and e.student_local_id=v_student_id
        and e.class_session_local_id=v_class_session_id and e.ended_at is null
        and v_occurrence_weekday=any(e.weekdays)
    ) then raise exception 'v2_3_student_not_in_occurrence_roster'; end if;
  elsif not exists (
    select 1 from pg_catalog.jsonb_array_elements_text(
      case when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
        then v_schedule.payload->'studentIds' else '[]'::jsonb end
    ) roster(student_id) where roster.student_id = v_student_id
  ) then
    raise exception 'v2_3_student_not_in_occurrence_roster';
  end if;

  v_expected_local_id := public.v2_3_internal_occurrence_attendance_local_id(
    new.center_id, v_schedule_id, v_date, v_student_id
  );
  if new.local_id <> v_expected_local_id
     or new.payload->>'authorityLocalId' <> v_expected_local_id
     or new.payload->>'id' <> v_expected_local_id then
    raise exception 'v2_3_occurrence_identity_mismatch';
  end if;

  if pg_catalog.lower(coalesce(new.payload->>'source', '')) not in ('admin', 'teacher', 'correction')
     or coalesce(new.payload->>'attendanceStatus', '') not in
       ('present', 'absent', 'excused', 'excusedAbsent', 'unexcusedAbsent', 'makeup', 'trial') then
    raise exception 'v2_3_invalid_attendance';
  end if;

  if new.payload->>'tuitionPolicyDefined' is distinct from 'false'
     or new.payload->>'tuitionAutoUpdateEnabled' is distinct from 'false'
     or new.payload->>'tuitionConsumptionApplied' is distinct from 'false'
     or new.payload->>'countsTowardTuition' is distinct from 'false'
     or new.payload->>'counted' is distinct from 'false'
     or new.payload->>'creditValue' is distinct from '0' then
    raise exception 'v2_3_tuition_boundary_violation';
  end if;

  return new;
end
$$;

create trigger v2_3_guard_occurrence_attendance
before insert or update of local_id, payload, deleted_at
on public.center_cloud_entities
for each row execute function public.v2_3_internal_guard_occurrence_attendance();

create unique index center_cloud_entities_v2_3_occurrence_attendance_unique
  on public.center_cloud_entities (
    center_id,
    (payload->>'scheduleSessionId'),
    (payload->>'date'),
    (payload->>'studentId')
  )
  where entity_type = 'attendance_record'
    and deleted_at is null
    and payload->>'attendanceAuthority' = 'v2.3-occurrence-v1';

create function public.v2_3_get_attendance_capability(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'v2_3_not_authenticated'; end if;
  if not exists (
    select 1
    from public.center_members m
    join public.centers c on c.id = m.center_id
    where m.center_id = p_center_id
      and m.user_id = v_actor
      and m.status = 'active'
      and c.status = 'active'
      and pg_catalog.lower(m.role) in ('owner', 'qtv', 'center_admin', 'admin')
  ) then
    raise exception 'v2_3_center_access_denied';
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 'READY',
    'center_id', p_center_id,
    'contract', 'v2.3-occurrence-v1'
  );
end
$$;

create or replace function public.v2_3_mutate_occurrence_attendance(
  p_center_id text,
  p_schedule_session_id text,
  p_occurrence_date date,
  p_attendance jsonb,
  p_session_report jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_schedule public.center_cloud_entities;
  v_class public.center_cloud_entities;
  v_schedule_type text;
  v_class_session_id text;
  v_occurrence_weekday text;
  v_item jsonb;
  v_payload jsonb;
  v_student_id text;
  v_source text;
  v_status text;
  v_local_id text;
  v_expected jsonb;
  v_current jsonb;
  v_expected_version bigint;
  v_mutations jsonb := '[]'::jsonb;
  v_seen_students text[] := '{}'::text[];
  v_intent bytea;
  v_existing public.center_occurrence_attendance_command_results;
  v_result jsonb;
  v_report_payload jsonb;
  v_report_local_id text;
  v_report_expected_version bigint;
begin
  if v_actor is null then raise exception 'v2_3_not_authenticated'; end if;
  if pg_catalog.btrim(coalesce(p_center_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_schedule_session_id, '')) = ''
     or p_occurrence_date is null
     or p_idempotency_key is null
     or pg_catalog.jsonb_typeof(p_attendance) <> 'array'
     or pg_catalog.jsonb_array_length(p_attendance) < 1
     or pg_catalog.jsonb_array_length(p_attendance) > 500 then
    raise exception 'v2_3_invalid_command';
  end if;

  select pg_catalog.lower(m.role) into v_role
  from public.center_members m
  join public.centers c on c.id = m.center_id
  where m.center_id = p_center_id
    and m.user_id = v_actor
    and m.status = 'active'
    and c.status = 'active'
  for share of m, c;
  if v_role is null or v_role not in ('owner', 'qtv', 'center_admin', 'admin') then
    raise exception 'v2_3_center_access_denied';
  end if;

  v_intent := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'contract', 1, 'center_id', p_center_id,
    'schedule_session_id', p_schedule_session_id,
    'occurrence_date', p_occurrence_date,
    'attendance', p_attendance,
    'session_report', p_session_report
  )::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.3.attendance.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0));
  select * into v_existing
  from public.center_occurrence_attendance_command_results r
  where r.center_id = p_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.intent_digest <> v_intent then raise exception 'v2_3_idempotency_conflict'; end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  select * into v_schedule
  from public.center_cloud_entities e
  where e.center_id = p_center_id
    and e.entity_type = 'schedule_session'
    and e.local_id = p_schedule_session_id
    and e.deleted_at is null
  for share;
  if v_schedule.id is null then raise exception 'v2_3_schedule_occurrence_not_found'; end if;
  v_schedule_type := pg_catalog.lower(coalesce(v_schedule.payload->>'scheduleType', 'recurring'));
  v_class_session_id := pg_catalog.btrim(coalesce(v_schedule.payload->>'classSessionId', ''));
  v_occurrence_weekday := case extract(isodow from p_occurrence_date)
    when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
    when 5 then 'fri' when 6 then 'sat' when 7 then 'sun' end;
  if v_schedule_type = 'oneoff' then
    if coalesce(v_schedule.payload->>'date', v_schedule.payload->>'occurrenceDate', '') <> p_occurrence_date::text then
      raise exception 'v2_3_schedule_occurrence_not_found';
    end if;
  else
    select * into v_class
    from public.center_cloud_entities e
    where e.center_id = p_center_id and e.entity_type = 'class_session'
      and e.local_id = v_class_session_id and e.deleted_at is null
    for share;
    if v_class.id is null
       or not (v_occurrence_weekday = any(public.v2_2_internal_class_weekdays(v_class.payload)))
       or (coalesce(v_schedule.payload->>'startDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and p_occurrence_date < (v_schedule.payload->>'startDate')::date)
       or (coalesce(v_schedule.payload->>'endDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and p_occurrence_date > (v_schedule.payload->>'endDate')::date) then
      raise exception 'v2_3_schedule_occurrence_not_found';
    end if;
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_attendance)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or pg_catalog.jsonb_typeof(v_item->'payload') <> 'object'
       or pg_catalog.jsonb_typeof(v_item->'expected_records') <> 'array' then
      raise exception 'v2_3_invalid_command';
    end if;
    v_student_id := pg_catalog.btrim(coalesce(v_item->>'student_id', ''));
    v_source := pg_catalog.lower(pg_catalog.btrim(coalesce(v_item->>'source', '')));
    v_status := pg_catalog.btrim(coalesce(v_item->>'attendance_status', ''));
    if v_student_id = '' or v_student_id = any(v_seen_students)
       or v_source not in ('admin', 'teacher', 'correction')
       or v_status not in ('present', 'absent', 'excused', 'excusedAbsent', 'unexcusedAbsent', 'makeup', 'trial') then
      raise exception 'v2_3_invalid_attendance';
    end if;
    v_seen_students := pg_catalog.array_append(v_seen_students, v_student_id);
    if not exists (
      select 1 from public.center_cloud_entities e
      where e.center_id = p_center_id and e.entity_type = 'student'
        and e.local_id = v_student_id and e.deleted_at is null
    ) then
      raise exception 'v2_3_student_not_found';
    end if;
    if v_schedule_type = 'oneoff' then
      if not exists (
        select 1 from pg_catalog.jsonb_array_elements_text(
          case when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
            then v_schedule.payload->'studentIds' else '[]'::jsonb end
        ) roster(student_id)
        where roster.student_id = v_student_id
      ) then
        raise exception 'v2_3_student_not_in_occurrence_roster';
      end if;
    elsif exists (
      select 1 from public.center_student_enrollment_sets s
      where s.center_id=p_center_id and s.student_local_id=v_student_id and s.ended_at is null
    ) then
      if not exists (
        select 1 from public.center_student_recurring_enrollments e
        where e.center_id=p_center_id and e.student_local_id=v_student_id
          and e.class_session_local_id=v_class_session_id and e.ended_at is null
          and v_occurrence_weekday=any(e.weekdays)
      ) then
        raise exception 'v2_3_student_not_in_occurrence_roster';
      end if;
    elsif not exists (
      select 1 from pg_catalog.jsonb_array_elements_text(
        case when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
          then v_schedule.payload->'studentIds' else '[]'::jsonb end
      ) roster(student_id)
      where roster.student_id = v_student_id
    ) then
      raise exception 'v2_3_student_not_in_occurrence_roster';
    end if;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'local_id', expected_item->>'local_id',
      'version', (expected_item->>'version')::bigint
    ) order by expected_item->>'local_id'), '[]'::jsonb)
      into v_expected
    from pg_catalog.jsonb_array_elements(v_item->'expected_records') expected_item
    where pg_catalog.jsonb_typeof(expected_item) = 'object'
      and pg_catalog.btrim(coalesce(expected_item->>'local_id', '')) <> ''
      and coalesce(expected_item->>'version', '') ~ '^[1-9][0-9]*$';
    if pg_catalog.jsonb_array_length(v_expected) <> pg_catalog.jsonb_array_length(v_item->'expected_records') then
      raise exception 'v2_3_invalid_expected_records';
    end if;

    -- Freeze every current row for this natural occurrence key before comparing
    -- the caller snapshot and building the atomic canonicalize+retire batch.
    perform 1
    from public.center_cloud_entities e
    where e.center_id = p_center_id
      and e.entity_type = 'attendance_record'
      and e.deleted_at is null
      and e.payload->>'source' <> 'initialBaseline'
      and e.payload->>'studentId' = v_student_id
      and e.payload->>'date' = p_occurrence_date::text
      and coalesce(nullif(e.payload->>'scheduleSessionId', ''), e.payload->>'sessionId') = p_schedule_session_id
    order by e.local_id
    for update;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'local_id', e.local_id, 'version', e.entity_version
    ) order by e.local_id), '[]'::jsonb)
      into v_current
    from public.center_cloud_entities e
    where e.center_id = p_center_id
      and e.entity_type = 'attendance_record'
      and e.deleted_at is null
      and e.payload->>'source' <> 'initialBaseline'
      and e.payload->>'studentId' = v_student_id
      and e.payload->>'date' = p_occurrence_date::text
      and coalesce(nullif(e.payload->>'scheduleSessionId', ''), e.payload->>'sessionId') = p_schedule_session_id;
    if v_current <> v_expected then raise exception 'v2_3_attendance_version_conflict'; end if;

    v_local_id := public.v2_3_internal_occurrence_attendance_local_id(
      p_center_id, p_schedule_session_id, p_occurrence_date, v_student_id
    );
    select coalesce((item->>'version')::bigint, 0) into v_expected_version
    from pg_catalog.jsonb_array_elements(v_expected) item
    where item->>'local_id' = v_local_id;
    v_expected_version := coalesce(v_expected_version, 0);

    v_payload := (v_item->'payload')
      - 'cloudVersion' - 'cloudUpdatedAt' - 'cloudDeletedAt' - 'updatedAt'
      - 'counted' - 'countsTowardTuition' - 'creditValue'
      || pg_catalog.jsonb_build_object(
        'id', v_local_id,
        'authorityLocalId', v_local_id,
        'attendanceAuthority', 'v2.3-occurrence-v1',
        'studentId', v_student_id,
        'date', p_occurrence_date::text,
        'scheduleSessionId', p_schedule_session_id,
        'sessionId', p_schedule_session_id,
        'classSessionId', coalesce(v_schedule.payload->>'classSessionId', ''),
        'source', v_source,
        'status', v_status,
        'attendanceStatus', v_status,
        'counted', false,
        'countsTowardTuition', false,
        'creditValue', 0,
        'tuitionPolicyDefined', false,
        'tuitionAutoUpdateEnabled', false,
        'tuitionConsumptionApplied', false
      );
    v_mutations := v_mutations || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'entity_type', 'attendance_record', 'local_id', v_local_id,
      'expected_version', v_expected_version, 'operation', 'UPSERT', 'payload', v_payload
    ));
    for v_expected in select value from pg_catalog.jsonb_array_elements(v_expected)
    loop
      if v_expected->>'local_id' <> v_local_id then
        v_mutations := v_mutations || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'entity_type', 'attendance_record', 'local_id', v_expected->>'local_id',
          'expected_version', (v_expected->>'version')::bigint, 'operation', 'DELETE', 'payload', '{}'::jsonb
        ));
      end if;
    end loop;
  end loop;

  if p_session_report is not null and p_session_report <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_session_report) <> 'object'
       or pg_catalog.jsonb_typeof(p_session_report->'payload') <> 'object'
       or coalesce(p_session_report->>'expected_version', '') !~ '^[0-9]+$'
       or pg_catalog.btrim(coalesce(p_session_report->>'local_id', '')) = '' then
      raise exception 'v2_3_invalid_session_report';
    end if;
    v_report_local_id := pg_catalog.btrim(p_session_report->>'local_id');
    v_report_expected_version := (p_session_report->>'expected_version')::bigint;
    v_report_payload := p_session_report->'payload';
    if pg_catalog.btrim(coalesce(v_report_payload->>'sessionId', '')) <> p_schedule_session_id
       or coalesce(v_report_payload->>'occurrenceDate', '') <> p_occurrence_date::text then
      raise exception 'v2_3_session_report_occurrence_mismatch';
    end if;
    v_mutations := v_mutations || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'entity_type', 'session_report', 'local_id', v_report_local_id,
      'expected_version', v_report_expected_version, 'operation', 'UPSERT',
      'payload', v_report_payload
    ));
  end if;

  v_result := public.c5_2_mutate_attendance_tuition_entities(
    p_center_id, v_mutations, p_idempotency_key
  );
  if coalesce((v_result->>'ok')::boolean, false) is not true then return v_result; end if;
  v_result := v_result || pg_catalog.jsonb_build_object(
    'attendance_contract', 'v2.3-occurrence-v1',
    'schedule_session_id', p_schedule_session_id,
    'occurrence_date', p_occurrence_date
  );
  insert into public.center_occurrence_attendance_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_result);
  return v_result;
end
$$;

revoke all on function public.v2_3_internal_occurrence_attendance_local_id(text,text,date,text)
  from public, anon, authenticated, service_role;
revoke all on function public.v2_3_internal_guard_occurrence_attendance()
  from public, anon, authenticated, service_role;
revoke all on function public.v2_3_get_attendance_capability(text)
  from public, anon, authenticated, service_role;
revoke all on function public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_3_get_attendance_capability(text) to authenticated;
grant execute on function public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)
  to authenticated;

comment on function public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid) is
  'V2-3 exact-center atomic canonical attendance write for one concrete schedule occurrence. It reuses C5.2 attendance_record authority, retires source-specific legacy rows, and never mutates tuition.';

commit;
