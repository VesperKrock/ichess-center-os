-- Execute inside an outer transaction and ROLLBACK. All fixtures are isolated.
do $$
declare
  v_actor uuid;
  v_past date := ((pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date - 7);
  v_future date := ((pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date + 7);
  v_weekday text;
begin
  select id into v_actor from auth.users order by id limit 1;
  if v_actor is null then raise exception 'a2_qa_requires_existing_auth_user'; end if;
  if exists(select 1 from public.centers where id='a2_qa_occurrence_2709') then
    raise exception 'a2_qa_center_collision';
  end if;
  perform pg_catalog.set_config('a2.qa.actor',v_actor::text,true);
  perform pg_catalog.set_config('a2.qa.past',v_past::text,true);
  perform pg_catalog.set_config('a2.qa.future',v_future::text,true);
  v_weekday := case extract(isodow from v_past)
    when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
    when 5 then 'fri' when 6 then 'sat' when 7 then 'sun' end;
  perform pg_catalog.set_config('a2.qa.weekday',v_weekday,true);
  perform pg_catalog.set_config('a2.qa.newday',case when v_weekday='tue' then 'wed' else 'tue' end,true);
  insert into public.centers(id,name,environment,status)
    values('a2_qa_occurrence_2709','A2 occurrence QA','test','active');
  insert into public.center_members(center_id,user_id,role,status)
    values('a2_qa_occurrence_2709',v_actor,'owner','active');
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('a2_qa_occurrence_2709','student','a2_student',
      pg_catalog.jsonb_build_object('id','a2_student','fullName','A2 QA Student'),
      'a2-qa','a2-qa',1,v_actor,v_actor),
    ('a2_qa_occurrence_2709','class_session','a2_class',
      pg_catalog.jsonb_build_object('id','a2_class','daysOfWeek',pg_catalog.jsonb_build_array(v_weekday),
        'startTime','10:00','endTime','11:00','room','Room Old','instructorName','Teacher Old','status','active'),
      'a2-qa','a2-qa',1,v_actor,v_actor);
  insert into public.center_student_enrollment_sets(
    center_id,student_local_id,created_by_membership_id,updated_by_membership_id)
  select 'a2_qa_occurrence_2709','a2_student',m.id,m.id
  from public.center_members m
  where m.center_id='a2_qa_occurrence_2709' and m.user_id=v_actor;
  insert into public.center_student_recurring_enrollments(
    center_id,student_local_id,class_session_local_id,weekdays,
    enrollment_set_version,created_by_membership_id)
  select 'a2_qa_occurrence_2709','a2_student','a2_class',array[v_weekday]::text[],1,m.id
  from public.center_members m
  where m.center_id='a2_qa_occurrence_2709' and m.user_id=v_actor;
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('a2_qa_occurrence_2709','schedule_session','a2_recurring',
      pg_catalog.jsonb_build_object('id','a2_recurring','scheduleType','recurring',
        'classSessionId','a2_class','dayOfWeek',v_weekday,
        'startDate',(v_past-7)::text,'endDate',(v_future+7)::text,
        'studentIds',pg_catalog.jsonb_build_array('a2_student'),'status','scheduled'),
      'a2-qa','a2-qa',1,v_actor,v_actor),
    ('a2_qa_occurrence_2709','schedule_session','a2_cancelled',
      pg_catalog.jsonb_build_object('id','a2_cancelled','scheduleType','oneOff','date',v_past::text,
        'startTime','12:00','endTime','13:00','studentIds',pg_catalog.jsonb_build_array('a2_student'),
        'teacherName','Teacher Oneoff','status','scheduled'),
      'a2-qa','a2-qa',1,v_actor,v_actor);
  insert into public.center_tuition_package_catalog(
    id,center_id,package_name,total_sessions,default_amount,is_active,
    created_by_membership_id,updated_by_membership_id)
  select 'a2000000-0000-4000-8000-000000000100','a2_qa_occurrence_2709',
    'A2 QA package',8,800000,true,m.id,m.id
  from public.center_members m
  where m.center_id='a2_qa_occurrence_2709' and m.user_id=v_actor;
  insert into public.center_tuition_package_cycles(
    center_id,student_local_id,tuition_local_id,cycle_number,package_catalog_id,
    package_name_snapshot,total_sessions_snapshot,price_snapshot,payment_period_id,
    baseline_cutoff_date,baseline_review_note,lifecycle_status,origin,created_by,updated_by)
  values('a2_qa_occurrence_2709','a2_student','a2_qa_tuition',1,
    'a2000000-0000-4000-8000-000000000100','A2 QA package',8,800000,
    'a2_qa_period',v_past-14,'QA opening','ACTIVE','OPERATOR_BASELINE',v_actor,v_actor);
end $$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a2.qa.actor'),true);

do $$
declare
  v_past date := pg_catalog.current_setting('a2.qa.past')::date;
  v_future date := pg_catalog.current_setting('a2.qa.future')::date;
  v_result jsonb;
  v_command jsonb;
begin
  v_result := public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_recurring',v_future,'RESOLVE');
  if v_result#>>'{occurrence,lifecycle_state}' <> 'PLANNED' then raise exception 'a2_qa_future_not_planned'; end if;
  if (public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_recurring',v_future,'RESOLVE')
      #>>'{occurrence,version}')::bigint <> 1 then raise exception 'a2_qa_resolve_not_idempotent'; end if;
  begin
    perform public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_recurring',v_past+1,'RESOLVE');
    raise exception 'a2_qa_invalid_date_accepted';
  exception when others then
    if sqlerrm='a2_qa_invalid_date_accepted' or position('a2_schedule_occurrence_not_found' in sqlerrm)=0 then raise; end if;
  end;
  v_command := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a2_student','source','admin','attendance_status','absent',
    'payload',pg_catalog.jsonb_build_object('teacherName','Fake'),
    'expected_records','[]'::jsonb));
  begin
    perform public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709','a2_recurring',
      v_future,v_command,null,'a2000000-0000-4000-8000-000000000001');
    raise exception 'a2_qa_future_write_accepted';
  exception when others then
    if sqlerrm='a2_qa_future_write_accepted' or position('a2_occurrence_not_held' in sqlerrm)=0 then raise; end if;
  end;
  v_result := public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_recurring',v_past,'RESOLVE');
  if v_result#>>'{occurrence,lifecycle_state}' <> 'PLANNED'
     or v_result#>>'{occurrence,planned_teacher_name}' <> 'Teacher Old' then
    raise exception 'a2_qa_past_snapshot_wrong';
  end if;
  v_result := public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_recurring',v_past,'MARK_HELD');
  if v_result#>>'{occurrence,lifecycle_state}' <> 'HELD' then raise exception 'a2_qa_held_failed'; end if;
  v_result := public.a2_manage_occurrence('a2_qa_occurrence_2709','a2_cancelled',v_past,'CANCEL');
  if v_result#>>'{occurrence,lifecycle_state}' <> 'CANCELLED' then raise exception 'a2_qa_cancel_failed'; end if;
  if pg_catalog.jsonb_array_length(public.a2_list_occurrences(
      'a2_qa_occurrence_2709',v_past,v_future)->'occurrences') <> 3 then
    raise exception 'a2_qa_occurrence_read_wrong';
  end if;
  begin
    perform public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709','a2_cancelled',
      v_past,v_command,null,'a2000000-0000-4000-8000-000000000002');
    raise exception 'a2_qa_cancelled_write_accepted';
  exception when others then
    if sqlerrm='a2_qa_cancelled_write_accepted' or position('a2_occurrence_cancelled' in sqlerrm)=0 then raise; end if;
  end;
  v_command := pg_catalog.jsonb_set(v_command,'{0,attendance_status}','"present"'::jsonb);
  v_result := public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709','a2_recurring',
    v_past,v_command,null,'a2000000-0000-4000-8000-000000000003');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a2_qa_v23_present_failed'; end if;
  if not coalesce((public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709',
      'a2_recurring',v_past,v_command,null,'a2000000-0000-4000-8000-000000000003')
      ->>'replayed')::boolean,false) then raise exception 'a2_qa_v23_retry_failed'; end if;
  v_command := pg_catalog.jsonb_set(v_command,'{0,attendance_status}','"makeup"'::jsonb);
  v_command := pg_catalog.jsonb_set(v_command,'{0,payload}',
    pg_catalog.jsonb_build_object('makeupReason','A2 QA historical makeup'));
  v_result := public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709','a2_recurring',
    v_past-7,v_command,null,'a2000000-0000-4000-8000-000000000005');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a2_qa_v23_makeup_failed'; end if;
end $$;

reset role;
do $$
declare v_past date := pg_catalog.current_setting('a2.qa.past')::date;
begin
  if (select count(*) from public.center_tuition_attendance_contributions
      where center_id='a2_qa_occurrence_2709') <> 2
     or not exists (select 1 from public.center_tuition_attendance_contributions
      where center_id='a2_qa_occurrence_2709' and schedule_session_local_id='a2_recurring'
        and occurrence_date=v_past and contribution_units=1 and allocation_state='APPLIED')
     or not exists (select 1 from public.center_tuition_attendance_contributions
      where center_id='a2_qa_occurrence_2709' and schedule_session_local_id='a2_recurring'
        and occurrence_date=v_past-7 and contribution_units=1 and allocation_state='APPLIED') then
    raise exception 'a2_qa_present_or_makeup_not_plus_one';
  end if;
end $$;
update public.center_student_recurring_enrollments
set ended_at=pg_catalog.clock_timestamp(),
  ended_by_membership_id=(select id from public.center_members
    where center_id='a2_qa_occurrence_2709' and user_id=pg_catalog.current_setting('a2.qa.actor')::uuid)
where center_id='a2_qa_occurrence_2709' and student_local_id='a2_student';
update public.center_student_enrollment_sets
set ended_at=pg_catalog.clock_timestamp(),version=version+1
where center_id='a2_qa_occurrence_2709' and student_local_id='a2_student';
update public.center_cloud_entities
set payload=payload || pg_catalog.jsonb_build_object('daysOfWeek',pg_catalog.jsonb_build_array(
  pg_catalog.current_setting('a2.qa.weekday'),pg_catalog.current_setting('a2.qa.newday')),
  'startTime','14:00','endTime','15:00','room','Room New','instructorName','Teacher New'),
  entity_version=entity_version+1
where center_id='a2_qa_occurrence_2709' and entity_type='class_session' and local_id='a2_class';
update public.center_cloud_entities
set payload=pg_catalog.jsonb_set(pg_catalog.jsonb_set(payload,'{studentIds}','[]'::jsonb),
  '{dayOfWeek}',pg_catalog.to_jsonb(pg_catalog.current_setting('a2.qa.newday'))),
  entity_version=entity_version+1
where center_id='a2_qa_occurrence_2709' and entity_type='schedule_session' and local_id='a2_recurring';
update public.center_cloud_entities
set payload=pg_catalog.jsonb_set(payload,'{daysOfWeek}',
  pg_catalog.jsonb_build_array(pg_catalog.current_setting('a2.qa.newday'))),
  entity_version=entity_version+1
where center_id='a2_qa_occurrence_2709' and entity_type='class_session' and local_id='a2_class';

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a2.qa.actor'),true);
do $$
declare
  v_past date := pg_catalog.current_setting('a2.qa.past')::date;
  v_local_id text;
  v_version bigint;
  v_result jsonb;
  v_command jsonb;
begin
  select local_id,entity_version into v_local_id,v_version
  from public.center_cloud_entities where center_id='a2_qa_occurrence_2709'
    and entity_type='attendance_record' and deleted_at is null
    and payload->>'scheduleSessionId'='a2_recurring' and payload->>'date'=v_past::text;
  v_command := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a2_student','source','admin','attendance_status','absent',
    'payload',pg_catalog.jsonb_build_object('teacherName','Teacher New'),
    'expected_records',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'local_id',v_local_id,'version',v_version))));
  v_result := public.v2_3_mutate_occurrence_attendance('a2_qa_occurrence_2709','a2_recurring',
    v_past,v_command,null,'a2000000-0000-4000-8000-000000000004');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a2_qa_historical_correction_failed'; end if;
end $$;

reset role;
do $$
declare v_past date := pg_catalog.current_setting('a2.qa.past')::date;
begin
  if (select count(*) from public.center_schedule_occurrences
    where center_id='a2_qa_occurrence_2709') <> 4 then raise exception 'a2_qa_occurrence_duplicate'; end if;
  if not exists (select 1 from public.center_schedule_occurrences
    where center_id='a2_qa_occurrence_2709' and schedule_session_local_id='a2_recurring'
      and occurrence_date=v_past and lifecycle_state='HELD'
      and planned_start_time='10:00' and planned_end_time='11:00'
      and room='Room Old' and planned_teacher_name='Teacher Old'
      and roster_student_ids=array['a2_student']::text[]) then
    raise exception 'a2_qa_historical_fact_rewritten';
  end if;
  if not exists (select 1 from public.center_cloud_entities
    where center_id='a2_qa_occurrence_2709' and entity_type='attendance_record'
      and payload->>'scheduleSessionId'='a2_recurring' and payload->>'date'=v_past::text
      and payload->>'attendanceStatus'='absent' and payload->>'teacherName'='Teacher Old') then
    raise exception 'a2_qa_correction_teacher_rewritten';
  end if;
  if (select count(*) from public.center_cloud_entities where center_id='a2_qa_occurrence_2709'
    and entity_type='attendance_record' and deleted_at is null) <> 2 then
    raise exception 'a2_qa_extra_attendance';
  end if;
  if (select count(*) from public.center_tuition_attendance_contributions
    where center_id='a2_qa_occurrence_2709') <> 2
     or (select coalesce(sum(contribution_units),0) from public.center_tuition_attendance_contributions
    where center_id='a2_qa_occurrence_2709' and allocation_state='APPLIED') <> 1
     or not exists (select 1 from public.center_tuition_attendance_contributions
    where center_id='a2_qa_occurrence_2709' and schedule_session_local_id='a2_recurring'
      and occurrence_date=v_past and attendance_status='absent' and contribution_units=0) then
    raise exception 'a2_qa_tuition_contribution_regression';
  end if;
  if public.v2_4_internal_consumption_units('present')<>1
     or public.v2_4_internal_consumption_units('absent')<>0
     or public.v2_4_internal_consumption_units('makeup')<>1 then
    raise exception 'a2_qa_tuition_policy_changed';
  end if;
end $$;
select 'A2_TRANSACTION_QA_PASS';
