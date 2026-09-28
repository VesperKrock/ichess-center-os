-- Run inside an outer BEGIN/ROLLBACK, after A3 migration is installed in that transaction.
do $$
declare
  v_actor uuid;
  v_member uuid;
  v_past date := (pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-7;
  v_future date := (pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date+14;
  v_day text;
begin
  select id into v_actor from auth.users order by id limit 1;
  if v_actor is null then raise exception 'a3_qa_requires_user'; end if;
  if exists(select 1 from public.centers where id='a3_qa_teacher_2709') then
    raise exception 'a3_qa_center_collision'; end if;
  perform pg_catalog.set_config('a3.qa.actor',v_actor::text,true);
  perform pg_catalog.set_config('a3.qa.past',v_past::text,true);
  perform pg_catalog.set_config('a3.qa.future',v_future::text,true);
  v_day:=case extract(isodow from v_past)
    when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
    when 5 then 'fri' when 6 then 'sat' else 'sun' end;
  insert into public.centers(id,name,environment,status)
  values('a3_qa_teacher_2709','A3 teacher QA','test','active');
  insert into public.center_members(center_id,user_id,role,status)
  values('a3_qa_teacher_2709',v_actor,'owner','active') returning id into v_member;
  insert into public.canonical_teacher_registry(
    id,full_name,display_name,created_by_membership_id,updated_by_membership_id)
  values
    ('a3000000-0000-4000-8000-000000000101','Teacher A','Teacher A',v_member,v_member),
    ('a3000000-0000-4000-8000-000000000102','Teacher B','Teacher B',v_member,v_member),
    ('a3000000-0000-4000-8000-000000000103','Teacher C','Teacher C',v_member,v_member);
  insert into public.teacher_center_assignments(
    teacher_id,center_id,created_by_membership_id,updated_by_membership_id)
  values
    ('a3000000-0000-4000-8000-000000000101','a3_qa_teacher_2709',v_member,v_member),
    ('a3000000-0000-4000-8000-000000000102','a3_qa_teacher_2709',v_member,v_member),
    ('a3000000-0000-4000-8000-000000000103','a3_qa_teacher_2709',v_member,v_member);
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by)
  values
    ('a3_qa_teacher_2709','student','a3_student',
      pg_catalog.jsonb_build_object('id','a3_student','fullName','A3 Student'),
      'a3-qa','a3-qa',1,v_actor,v_actor),
    ('a3_qa_teacher_2709','class_session','a3_class',
      pg_catalog.jsonb_build_object('id','a3_class','daysOfWeek',pg_catalog.jsonb_build_array(v_day),
        'startTime','09:00','endTime','10:00','room','A3 room','instructorName',''),
      'a3-qa','a3-qa',1,v_actor,v_actor);
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by)
  values('a3_qa_teacher_2709','schedule_session','a3_schedule',
    pg_catalog.jsonb_build_object('id','a3_schedule','scheduleType','recurring',
      'classSessionId','a3_class','dayOfWeek',v_day,'startDate',(v_past-7)::text,
      'endDate',(v_future+7)::text,'studentIds',pg_catalog.jsonb_build_array('a3_student')),
    'a3-qa','a3-qa',1,v_actor,v_actor);
  insert into public.center_class_teacher_assignments(
    center_id,class_session_local_id,teacher_id,teacher_name,effective_from,
    source,created_by,updated_by)
  values('a3_qa_teacher_2709','a3_class','a3000000-0000-4000-8000-000000000101',
    'Teacher A',v_past-7,'LEGACY_OPENING',v_actor,v_actor);
  insert into public.center_tuition_package_catalog(
    id,center_id,package_name,total_sessions,default_amount,
    created_by_membership_id,updated_by_membership_id)
  values('a3000000-0000-4000-8000-000000000104','a3_qa_teacher_2709',
    'A3 package',8,800000,v_member,v_member);
  insert into public.center_tuition_package_cycles(
    center_id,student_local_id,tuition_local_id,cycle_number,package_catalog_id,
    package_name_snapshot,total_sessions_snapshot,price_snapshot,payment_period_id,
    baseline_cutoff_date,baseline_review_note,lifecycle_status,origin,created_by,updated_by)
  values('a3_qa_teacher_2709','a3_student','a3_tuition',1,
    'a3000000-0000-4000-8000-000000000104','A3 package',8,800000,
    'a3_period',v_past-14,'A3 QA opening','ACTIVE','OPERATOR_BASELINE',v_actor,v_actor);
end $$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a3.qa.actor'),true);
do $$
declare
  v_past date:=pg_catalog.current_setting('a3.qa.past')::date;
  v_future date:=pg_catalog.current_setting('a3.qa.future')::date;
  v_result jsonb;
  v_command jsonb;
begin
  v_result:=public.a2_manage_occurrence('a3_qa_teacher_2709','a3_schedule',v_past,'RESOLVE');
  if v_result#>>'{occurrence,planned_teacher_name}'<>'Teacher A' then
    raise exception 'a3_qa_past_planned_teacher_wrong'; end if;
  v_result:=public.a2_manage_occurrence('a3_qa_teacher_2709','a3_schedule',v_past,'MARK_HELD');
  v_command:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a3_student','source','admin','attendance_status','present',
    'payload','{}'::jsonb,'expected_records','[]'::jsonb));
  v_result:=public.v2_3_mutate_occurrence_attendance('a3_qa_teacher_2709','a3_schedule',
    v_past,v_command,null,'a3000000-0000-4000-8000-000000000201');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a3_qa_attendance_failed'; end if;
  v_result:=public.a2_manage_occurrence('a3_qa_teacher_2709','a3_schedule',v_future-7,'RESOLVE');
  if v_result#>>'{occurrence,planned_teacher_name}'<>'Teacher A' then
    raise exception 'a3_qa_future_before_change_wrong'; end if;
  v_result:=public.a2_manage_occurrence('a3_qa_teacher_2709','a3_schedule',v_future,'RESOLVE');
  if v_result#>>'{occurrence,planned_teacher_name}'<>'Teacher A' then
    raise exception 'a3_qa_future_initial_plan_wrong'; end if;
  v_result:=public.a3_change_class_teacher('a3_qa_teacher_2709','a3_class',
    'a3000000-0000-4000-8000-000000000102',v_future,
    'a3000000-0000-4000-8000-000000000202');
  if not coalesce((v_result->>'changed')::boolean,false) then raise exception 'a3_qa_change_failed'; end if;
  v_result:=public.a3_change_class_teacher('a3_qa_teacher_2709','a3_class',
    'a3000000-0000-4000-8000-000000000102',v_future,
    'a3000000-0000-4000-8000-000000000202');
  if not coalesce((v_result->>'replayed')::boolean,false) then raise exception 'a3_qa_change_retry_failed'; end if;
  v_result:=public.a3_list_teacher_context('a3_qa_teacher_2709',v_past,v_future);
  if pg_catalog.jsonb_array_length(v_result->'assignments')<>2
     or v_result#>>'{assignments,0,teacher_name}'<>'Teacher A'
     or v_result#>>'{assignments,0,effective_to}'<>(v_future-1)::text
     or v_result#>>'{assignments,1,teacher_name}'<>'Teacher B'
     or v_result#>>'{assignments,1,effective_from}'<>v_future::text
     or v_result#>>'{occurrences,0,planned_teacher_name}'<>'Teacher A'
     or v_result#>>'{occurrences,1,planned_teacher_name}'<>'Teacher A'
     or v_result#>>'{occurrences,2,planned_teacher_name}'<>'Teacher B' then
    raise exception 'a3_qa_effective_date_or_history_wrong'; end if;
  v_result:=public.a3_set_occurrence_actual_teacher('a3_qa_teacher_2709','a3_schedule',
    v_past,'SET','a3000000-0000-4000-8000-000000000103',
    'a3000000-0000-4000-8000-000000000203');
  if v_result#>>'{occurrence,actual_teacher_name}'<>'Teacher C' then
    raise exception 'a3_qa_substitute_failed'; end if;
  v_result:=public.a3_set_occurrence_actual_teacher('a3_qa_teacher_2709','a3_schedule',
    v_past,'SET','a3000000-0000-4000-8000-000000000103',
    'a3000000-0000-4000-8000-000000000203');
  if not coalesce((v_result->>'replayed')::boolean,false) then
    raise exception 'a3_qa_substitute_retry_failed'; end if;
  begin
    perform public.a3_set_occurrence_actual_teacher('a3_qa_teacher_2709','a3_schedule',
      v_past,'SET','a3000000-0000-4000-8000-000000000199',
      'a3000000-0000-4000-8000-000000000205');
    raise exception 'a3_qa_unassigned_teacher_accepted';
  exception when others then
    if sqlerrm='a3_qa_unassigned_teacher_accepted'
       or position('a3_teacher_not_assigned_to_center' in sqlerrm)=0 then raise; end if;
  end;
end $$;
reset role;
do $$
declare v_past date:=pg_catalog.current_setting('a3.qa.past')::date;
begin
  if not exists(select 1 from public.center_cloud_entities e
    where e.center_id='a3_qa_teacher_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=v_past::text and e.payload->>'teacherName'='Teacher C')
     or not exists(select 1 from public.center_tuition_attendance_contributions c
    where c.center_id='a3_qa_teacher_2709' and c.occurrence_date=v_past
      and c.teacher_name_snapshot='Teacher C' and c.contribution_units=1)
     or (select count(*) from public.a3_teacher_events where center_id='a3_qa_teacher_2709')<>2
     or (select count(*) from public.center_class_teacher_assignments
       where center_id='a3_qa_teacher_2709')<>2 then
    raise exception 'a3_qa_actual_teacher_or_tuition_wrong'; end if;
  begin
    insert into public.center_class_teacher_assignments(
      center_id,class_session_local_id,teacher_id,teacher_name,effective_from,
      source,created_by,updated_by)
    values('a3_qa_teacher_2709','a3_class','a3000000-0000-4000-8000-000000000103',
      'Teacher C',v_past,'A3_COMMAND',
      pg_catalog.current_setting('a3.qa.actor')::uuid,
      pg_catalog.current_setting('a3.qa.actor')::uuid);
    raise exception 'a3_qa_overlap_accepted';
  exception when others then
    if sqlerrm='a3_qa_overlap_accepted'
       or position('a3_teacher_range_overlap' in sqlerrm)=0 then raise; end if;
  end;
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a3.qa.actor'),true);
do $$
declare
  v_past date:=pg_catalog.current_setting('a3.qa.past')::date;
  v_local_id text;
  v_version bigint;
  v_result jsonb;
begin
  select local_id,entity_version into v_local_id,v_version
  from public.center_cloud_entities where center_id='a3_qa_teacher_2709'
    and entity_type='attendance_record' and payload->>'date'=v_past::text;
  v_result:=public.v2_3_mutate_occurrence_attendance('a3_qa_teacher_2709','a3_schedule',v_past,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id','a3_student','source','admin','attendance_status','absent',
      'payload',pg_catalog.jsonb_build_object('teacherName','Teacher B'),
      'expected_records',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'local_id',v_local_id,'version',v_version)))),null,
    'a3000000-0000-4000-8000-000000000204');
  if not coalesce((v_result->>'ok')::boolean,false) then
    raise exception 'a3_qa_historical_correction_failed'; end if;
end $$;
reset role;
do $$
declare v_past date:=pg_catalog.current_setting('a3.qa.past')::date;
begin
  if not exists(select 1 from public.center_cloud_entities e
    where e.center_id='a3_qa_teacher_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=v_past::text and e.payload->>'teacherName'='Teacher C'
      and e.payload->>'attendanceStatus'='absent')
     or not exists(select 1 from public.center_tuition_attendance_contributions c
    where c.center_id='a3_qa_teacher_2709' and c.occurrence_date=v_past
      and c.teacher_name_snapshot='Teacher C' and c.contribution_units=0)
     or (select count(*) from public.center_schedule_occurrences
      where center_id='a3_qa_teacher_2709')<>3 then
    raise exception 'a3_qa_correction_or_future_materialization_wrong'; end if;
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a3.qa.actor'),true);
do $$
declare v_result jsonb;
begin
  v_result:=public.a3_set_occurrence_actual_teacher('a3_qa_teacher_2709','a3_schedule',
    pg_catalog.current_setting('a3.qa.past')::date,'CLEAR',null,
    'a3000000-0000-4000-8000-000000000206');
  if v_result#>>'{occurrence,actual_teacher_override}'<>'false' then
    raise exception 'a3_qa_clear_failed'; end if;
end $$;
reset role;
do $$
declare v_past date:=pg_catalog.current_setting('a3.qa.past')::date;
begin
  if not exists(select 1 from public.center_cloud_entities e
    where e.center_id='a3_qa_teacher_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=v_past::text and e.payload->>'teacherName'='Teacher A')
     or not exists(select 1 from public.center_tuition_attendance_contributions c
    where c.center_id='a3_qa_teacher_2709' and c.occurrence_date=v_past
      and c.teacher_name_snapshot='Teacher A' and c.contribution_units=0) then
    raise exception 'a3_qa_clear_did_not_restore_planned'; end if;
end $$;
select 'A3_TRANSACTION_QA_PASS';
