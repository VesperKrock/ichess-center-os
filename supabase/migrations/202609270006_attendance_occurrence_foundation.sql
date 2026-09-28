-- A2: a durable fact for one dated Schedule occurrence. Attendance remains V2.3.
do $$ begin
  if pg_catalog.to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_4_internal_reconcile_student(text,text,uuid)') is null
     or pg_catalog.to_regprocedure('public.tuition_final_cycle_json(text,uuid,jsonb)') is null then
    raise exception 'a2_required_attendance_tuition_contract_missing';
  end if;
end $$;

create table public.center_schedule_occurrences (
  center_id text not null references public.centers(id) on delete restrict,
  schedule_session_local_id text not null,
  occurrence_date date not null,
  class_session_local_id text,
  schedule_type text not null check (schedule_type in ('recurring','oneoff')),
  planned_start_time time,
  planned_end_time time,
  room text not null default '',
  roster_student_ids text[] not null default '{}'::text[],
  planned_teacher_id text,
  planned_teacher_name text not null default '',
  lifecycle_state text not null check (lifecycle_state in ('PLANNED','HELD','CANCELLED')),
  context_origin text not null check (context_origin in ('CURRENT_SCHEDULE','EXISTING_ATTENDANCE')),
  source_schedule_version bigint,
  source_class_version bigint,
  version bigint not null default 1 check (version >= 1),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(center_id, schedule_session_local_id, occurrence_date),
  check ((planned_start_time is null) = (planned_end_time is null)),
  check (planned_start_time is null or planned_end_time > planned_start_time),
  check (pg_catalog.cardinality(roster_student_ids) <= 500),
  check (context_origin <> 'CURRENT_SCHEDULE' or planned_start_time is not null)
);
create index center_schedule_occurrences_center_date_idx
  on public.center_schedule_occurrences(center_id, occurrence_date, lifecycle_state);
alter table public.center_schedule_occurrences enable row level security;
alter table public.center_schedule_occurrences force row level security;
revoke all on public.center_schedule_occurrences from public, anon, authenticated, service_role;
grant all on public.center_schedule_occurrences to service_role;

-- Resolve once under a natural-key lock. Existing V2.3 rows are stronger evidence
-- than today's mutable Schedule: their partial context is labelled honestly.
create function public.a2_internal_resolve_occurrence(
  p_center_id text, p_schedule_session_id text, p_occurrence_date date, p_actor uuid
)
returns public.center_schedule_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v_fact public.center_schedule_occurrences;
  v_schedule public.center_cloud_entities;
  v_class public.center_cloud_entities;
  v_attendance public.center_cloud_entities;
  v_type text;
  v_class_id text;
  v_weekday text;
  v_start_text text;
  v_end_text text;
  v_start time;
  v_end time;
  v_roster text[];
  v_teacher_id text;
  v_teacher_name text;
  v_room text;
  v_state text;
  v_origin text;
begin
  if p_actor is null or pg_catalog.btrim(coalesce(p_center_id,'')) = ''
     or pg_catalog.btrim(coalesce(p_schedule_session_id,'')) = ''
     or p_occurrence_date is null then
    raise exception 'a2_invalid_occurrence_identity';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'a2.occurrence|' || p_center_id || '|' || p_schedule_session_id || '|' || p_occurrence_date::text, 0));
  select * into v_fact from public.center_schedule_occurrences
  where center_id = p_center_id and schedule_session_local_id = p_schedule_session_id
    and occurrence_date = p_occurrence_date for update;
  if found then return v_fact; end if;

  select * into v_schedule from public.center_cloud_entities e
  where e.center_id = p_center_id and e.entity_type = 'schedule_session'
    and e.local_id = p_schedule_session_id and e.deleted_at is null for share;
  select * into v_attendance from public.center_cloud_entities e
  where e.center_id = p_center_id and e.entity_type = 'attendance_record'
    and e.deleted_at is null and e.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
    and e.payload->>'scheduleSessionId' = p_schedule_session_id
    and e.payload->>'date' = p_occurrence_date::text
  order by e.local_id limit 1 for share;

  if v_attendance.id is not null then
    -- No historical time/room/complete roster can be inferred from old rows.
    -- Preserve only witnessed IDs and the first captured teacher name.
    select coalesce(pg_catalog.array_agg(distinct e.payload->>'studentId'
      order by e.payload->>'studentId'), '{}'::text[])
      into v_roster from public.center_cloud_entities e
    where e.center_id = p_center_id and e.entity_type = 'attendance_record'
      and e.deleted_at is null and e.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
      and e.payload->>'scheduleSessionId' = p_schedule_session_id
      and e.payload->>'date' = p_occurrence_date::text
      and pg_catalog.btrim(coalesce(e.payload->>'studentId','')) <> '';
    v_type := case when pg_catalog.lower(coalesce(v_schedule.payload->>'scheduleType','recurring')) = 'oneoff'
      then 'oneoff' else 'recurring' end;
    v_class_id := nullif(pg_catalog.btrim(coalesce(v_attendance.payload->>'classSessionId','')), '');
    v_teacher_id := nullif(pg_catalog.btrim(coalesce(v_attendance.payload->>'teacherId','')), '');
    v_teacher_name := pg_catalog.btrim(coalesce(v_attendance.payload->>'teacherName',''));
    v_room := '';
    v_state := 'HELD';
    v_origin := 'EXISTING_ATTENDANCE';
  else
    if v_schedule.id is null or pg_catalog.lower(coalesce(v_schedule.payload->>'isDeleted','false')) = 'true' then
      raise exception 'a2_schedule_occurrence_not_found';
    end if;
    v_type := case when pg_catalog.lower(coalesce(v_schedule.payload->>'scheduleType','recurring')) = 'oneoff'
      then 'oneoff' else 'recurring' end;
    v_class_id := nullif(pg_catalog.btrim(coalesce(v_schedule.payload->>'classSessionId','')), '');
    v_weekday := case extract(isodow from p_occurrence_date)
      when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
      when 5 then 'fri' when 6 then 'sat' when 7 then 'sun' end;
    if v_type = 'oneoff' then
      if coalesce(v_schedule.payload->>'date',v_schedule.payload->>'occurrenceDate','') <> p_occurrence_date::text then
        raise exception 'a2_schedule_occurrence_not_found';
      end if;
      v_start_text := v_schedule.payload->>'startTime';
      v_end_text := v_schedule.payload->>'endTime';
      v_room := pg_catalog.btrim(coalesce(v_schedule.payload->>'room',''));
      v_teacher_id := nullif(pg_catalog.btrim(coalesce(v_schedule.payload->>'teacherId','')), '');
      v_teacher_name := pg_catalog.btrim(coalesce(v_schedule.payload->>'teacherName',''));
      select coalesce(pg_catalog.array_agg(distinct student.local_id order by student.local_id),'{}'::text[])
        into v_roster
      from pg_catalog.jsonb_array_elements_text(case
        when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
          then v_schedule.payload->'studentIds' else '[]'::jsonb end) roster(student_id)
      join public.center_cloud_entities student on student.center_id=p_center_id
        and student.entity_type='student' and student.local_id=roster.student_id
        and student.deleted_at is null;
    else
      select * into v_class from public.center_cloud_entities e
      where e.center_id=p_center_id and e.entity_type='class_session'
        and e.local_id=v_class_id and e.deleted_at is null for share;
      if v_class.id is null
         or not (v_weekday = any(public.v2_2_internal_class_weekdays(v_class.payload)))
         or (coalesce(v_schedule.payload->>'startDate','') ~ '^\d{4}-\d{2}-\d{2}$'
            and p_occurrence_date < (v_schedule.payload->>'startDate')::date)
         or (coalesce(v_schedule.payload->>'endDate','') ~ '^\d{4}-\d{2}-\d{2}$'
            and p_occurrence_date > (v_schedule.payload->>'endDate')::date) then
        raise exception 'a2_schedule_occurrence_not_found';
      end if;
      v_start_text := v_class.payload->>'startTime';
      v_end_text := v_class.payload->>'endTime';
      v_room := pg_catalog.btrim(coalesce(v_class.payload->>'room',v_schedule.payload->>'room',''));
      v_teacher_id := null;
      v_teacher_name := pg_catalog.btrim(coalesce(v_class.payload->>'instructorName',''));
      with candidates as (
        select enrollment.student_local_id as student_id
        from public.center_student_recurring_enrollments enrollment
        join public.center_student_enrollment_sets enrollment_set
          on enrollment_set.center_id=enrollment.center_id
          and enrollment_set.student_local_id=enrollment.student_local_id
          and enrollment_set.ended_at is null
        where enrollment.center_id=p_center_id and enrollment.class_session_local_id=v_class_id
          and enrollment.ended_at is null and v_weekday=any(enrollment.weekdays)
        union
        select roster.student_id
        from pg_catalog.jsonb_array_elements_text(case
          when pg_catalog.jsonb_typeof(v_schedule.payload->'studentIds')='array'
            then v_schedule.payload->'studentIds' else '[]'::jsonb end) roster(student_id)
        where not exists (select 1 from public.center_student_enrollment_sets enrollment_set
          where enrollment_set.center_id=p_center_id
            and enrollment_set.student_local_id=roster.student_id
            and enrollment_set.ended_at is null)
      )
      select coalesce(pg_catalog.array_agg(distinct student.local_id order by student.local_id),'{}'::text[])
        into v_roster from candidates
      join public.center_cloud_entities student on student.center_id=p_center_id
        and student.entity_type='student' and student.local_id=candidates.student_id
        and student.deleted_at is null;
    end if;
    if coalesce(v_start_text,'') !~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v_end_text,'') !~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'a2_invalid_schedule_time';
    end if;
    v_start := v_start_text::time;
    v_end := v_end_text::time;
    if v_end <= v_start then raise exception 'a2_invalid_schedule_time'; end if;
    v_state := case when pg_catalog.lower(coalesce(v_schedule.payload->>'status','scheduled'))='cancelled'
      then 'CANCELLED' else 'PLANNED' end;
    v_origin := 'CURRENT_SCHEDULE';
  end if;

  insert into public.center_schedule_occurrences (
    center_id,schedule_session_local_id,occurrence_date,class_session_local_id,schedule_type,
    planned_start_time,planned_end_time,room,roster_student_ids,planned_teacher_id,
    planned_teacher_name,lifecycle_state,context_origin,source_schedule_version,
    source_class_version,created_by,updated_by
  ) values (
    p_center_id,p_schedule_session_id,p_occurrence_date,v_class_id,v_type,
    v_start,v_end,coalesce(v_room,''),coalesce(v_roster,'{}'::text[]),v_teacher_id,
    coalesce(v_teacher_name,''),v_state,v_origin,v_schedule.entity_version,
    v_class.entity_version,p_actor,p_actor
  ) on conflict (center_id,schedule_session_local_id,occurrence_date) do nothing;
  select * into v_fact from public.center_schedule_occurrences
  where center_id=p_center_id and schedule_session_local_id=p_schedule_session_id
    and occurrence_date=p_occurrence_date for update;
  return v_fact;
end $$;

create function public.a2_internal_ensure_held_occurrence(
  p_center_id text,p_schedule_session_id text,p_occurrence_date date,p_actor uuid
)
returns public.center_schedule_occurrences
language plpgsql security definer set search_path = '' as $$
declare v_fact public.center_schedule_occurrences;
begin
  v_fact := public.a2_internal_resolve_occurrence(p_center_id,p_schedule_session_id,p_occurrence_date,p_actor);
  if v_fact.lifecycle_state='CANCELLED' then raise exception 'a2_occurrence_cancelled'; end if;
  if v_fact.lifecycle_state='PLANNED' then
    if v_fact.planned_end_time is null or
       ((v_fact.occurrence_date + v_fact.planned_end_time) at time zone 'Asia/Ho_Chi_Minh')
         > pg_catalog.clock_timestamp() then
      raise exception 'a2_occurrence_not_held';
    end if;
    update public.center_schedule_occurrences
    set lifecycle_state='HELD',version=version+1,updated_by=p_actor,
      updated_at=pg_catalog.clock_timestamp()
    where center_id=p_center_id and schedule_session_local_id=p_schedule_session_id
      and occurrence_date=p_occurrence_date returning * into v_fact;
  end if;
  return v_fact;
end $$;

create function public.a2_manage_occurrence(
  p_center_id text,p_schedule_session_id text,p_occurrence_date date,p_action text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_fact public.center_schedule_occurrences;
  v_action text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_action,'')));
begin
  if v_actor is null or v_action not in ('RESOLVE','MARK_HELD','CANCEL') then
    raise exception 'a2_invalid_command';
  end if;
  select pg_catalog.lower(m.role) into v_role from public.center_members m
  join public.centers c on c.id=m.center_id
  where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
    and c.status='active' for share of m,c;
  if v_role is null or v_role not in ('owner','qtv','center_admin','admin') then
    raise exception 'a2_center_access_denied';
  end if;
  if v_action='MARK_HELD' then
    v_fact := public.a2_internal_ensure_held_occurrence(
      p_center_id,p_schedule_session_id,p_occurrence_date,v_actor);
  else
    v_fact := public.a2_internal_resolve_occurrence(
      p_center_id,p_schedule_session_id,p_occurrence_date,v_actor);
    if v_action='CANCEL' and v_fact.lifecycle_state<>'CANCELLED' then
      if exists (select 1 from public.center_cloud_entities e
        where e.center_id=p_center_id and e.entity_type='attendance_record'
          and e.deleted_at is null and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
          and e.payload->>'scheduleSessionId'=p_schedule_session_id
          and e.payload->>'date'=p_occurrence_date::text) then
        raise exception 'a2_cannot_cancel_attended_occurrence';
      end if;
      update public.center_schedule_occurrences
      set lifecycle_state='CANCELLED',version=version+1,updated_by=v_actor,
        updated_at=pg_catalog.clock_timestamp()
      where center_id=p_center_id and schedule_session_local_id=p_schedule_session_id
        and occurrence_date=p_occurrence_date returning * into v_fact;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'contract','a2-occurrence-v1',
    'center_id',p_center_id,'occurrence',pg_catalog.to_jsonb(v_fact));
end $$;

create function public.a2_list_occurrences(p_center_id text,p_from_date date,p_to_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or p_from_date is null or p_to_date is null
     or p_to_date < p_from_date or p_to_date-p_from_date > 62 then
    raise exception 'a2_invalid_read_range';
  end if;
  if not exists (select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then
    raise exception 'a2_center_access_denied';
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'contract','a2-occurrence-v1',
    'center_id',p_center_id,'occurrences',coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(o) order by o.occurrence_date,o.schedule_session_local_id)
      from public.center_schedule_occurrences o where o.center_id=p_center_id
        and o.occurrence_date between p_from_date and p_to_date),'[]'::jsonb));
end $$;

revoke all on function public.a2_internal_resolve_occurrence(text,text,date,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.a2_internal_ensure_held_occurrence(text,text,date,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.a2_manage_occurrence(text,text,date,text)
  from public,anon,authenticated,service_role;
revoke all on function public.a2_list_occurrences(text,date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.a2_manage_occurrence(text,text,date,text) to authenticated;
grant execute on function public.a2_list_occurrences(text,date,date) to authenticated;

-- Patch only the V2.3 existence/roster validation blocks. Its natural key,
-- optimistic versions, idempotency result, retirement and V2.4 trigger remain.
do $patch$
declare
  v_def text;
  v_start integer;
  v_end integer;
begin
  v_def := pg_catalog.pg_get_functiondef(
    'public.v2_3_internal_guard_occurrence_attendance()'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'  v_occurrence public.center_schedule_occurrences;') > 0 then
    raise exception 'a2_guard_already_patched';
  end if;
  v_def := pg_catalog.replace(v_def,'  v_schedule public.center_cloud_entities;',
    '  v_schedule public.center_cloud_entities;' || chr(10) ||
    '  v_occurrence public.center_schedule_occurrences;');
  v_start := pg_catalog.strpos(v_def,'  select * into v_schedule');
  v_end := pg_catalog.strpos(v_def,
    '  v_expected_local_id := public.v2_3_internal_occurrence_attendance_local_id(');
  if v_start < 1 or v_end <= v_start then raise exception 'a2_guard_contract_mismatch'; end if;
  v_def := pg_catalog.substr(v_def,1,v_start-1) || $replacement$
  select * into v_occurrence from public.center_schedule_occurrences o
  where o.center_id=new.center_id and o.schedule_session_local_id=v_schedule_id
    and o.occurrence_date=v_date for share;
  if v_occurrence.center_id is null then raise exception 'a2_occurrence_fact_required'; end if;
  if v_occurrence.lifecycle_state <> 'HELD' then raise exception 'a2_occurrence_not_held'; end if;
  if not (v_student_id = any(v_occurrence.roster_student_ids)) then
    raise exception 'v2_3_student_not_in_occurrence_roster';
  end if;
  if coalesce(new.payload->>'classSessionId','') <> coalesce(v_occurrence.class_session_local_id,'')
     or coalesce(new.payload->>'teacherName','') <> v_occurrence.planned_teacher_name then
    raise exception 'a2_occurrence_context_mismatch';
  end if;

$replacement$ || pg_catalog.substr(v_def,v_end);
  execute v_def;

  v_def := pg_catalog.pg_get_functiondef(
    'public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'  v_occurrence public.center_schedule_occurrences;') > 0 then
    raise exception 'a2_command_already_patched';
  end if;
  v_def := pg_catalog.replace(v_def,'  v_schedule public.center_cloud_entities;',
    '  v_schedule public.center_cloud_entities;' || chr(10) ||
    '  v_occurrence public.center_schedule_occurrences;');
  v_start := pg_catalog.strpos(v_def,'  select * into v_schedule');
  v_end := pg_catalog.strpos(v_def,
    '  for v_item in select value from pg_catalog.jsonb_array_elements(p_attendance)');
  if v_start < 1 or v_end <= v_start then raise exception 'a2_command_contract_mismatch'; end if;
  v_def := pg_catalog.substr(v_def,1,v_start-1) || $replacement$
  v_occurrence := public.a2_internal_ensure_held_occurrence(
    p_center_id,p_schedule_session_id,p_occurrence_date,v_actor);
  v_class_session_id := coalesce(v_occurrence.class_session_local_id,'');

$replacement$ || pg_catalog.substr(v_def,v_end);
  v_start := pg_catalog.strpos(v_def,'    if v_schedule_type = ''oneoff'' then');
  v_end := pg_catalog.strpos(v_def,
    '    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(');
  if v_start < 1 or v_end <= v_start then raise exception 'a2_roster_contract_mismatch'; end if;
  v_def := pg_catalog.substr(v_def,1,v_start-1) || $replacement$
    if not (v_student_id = any(v_occurrence.roster_student_ids)) then
      raise exception 'v2_3_student_not_in_occurrence_roster';
    end if;

$replacement$ || pg_catalog.substr(v_def,v_end);
  if pg_catalog.strpos(v_def,'''classSessionId'', coalesce(v_schedule.payload->>''classSessionId'', '''')') < 1
     or pg_catalog.strpos(v_def,'- ''counted'' - ''countsTowardTuition'' - ''creditValue''') < 1 then
    raise exception 'a2_payload_contract_mismatch';
  end if;
  v_def := pg_catalog.replace(v_def,
    '''classSessionId'', coalesce(v_schedule.payload->>''classSessionId'', '''')',
    '''classSessionId'', v_class_session_id');
  v_def := pg_catalog.replace(v_def,
    '- ''counted'' - ''countsTowardTuition'' - ''creditValue''',
    '- ''counted'' - ''countsTowardTuition'' - ''creditValue'' - ''teacherId'' - ''teacherName''');
  v_def := pg_catalog.replace(v_def,
    '''classSessionId'', v_class_session_id,',
    '''classSessionId'', v_class_session_id,' || chr(10) ||
    '        ''teacherId'', v_occurrence.planned_teacher_id,' || chr(10) ||
    '        ''teacherName'', v_occurrence.planned_teacher_name,');
  execute v_def;
end
$patch$;

comment on table public.center_schedule_occurrences is
  'A2 one immutable dated Schedule context per natural occurrence key. PLANNED is not absence; HELD may have no attendance; CANCELLED cannot receive attendance.';
