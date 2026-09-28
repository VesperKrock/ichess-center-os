-- Run inside BEGIN/ROLLBACK after A4 is installed (or inside its trial transaction).
do $$
declare
  v_actor uuid;
  v_member uuid;
  v_today date:=(pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_day text;
begin
  select id into v_actor from auth.users order by id limit 1;
  if v_actor is null then raise exception 'a4_qa_requires_user'; end if;
  if exists(select 1 from public.centers where id='a4_qa_makeup_2709') then
    raise exception 'a4_qa_center_collision'; end if;
  perform pg_catalog.set_config('a4.qa.actor',v_actor::text,true);
  perform pg_catalog.set_config('a4.qa.today',v_today::text,true);
  v_day:=case extract(isodow from v_today)
    when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
    when 5 then 'fri' when 6 then 'sat' else 'sun' end;
  insert into public.centers(id,name,environment,status)
  values('a4_qa_makeup_2709','A4 makeup QA','test','active');
  insert into public.center_members(center_id,user_id,role,status)
  values('a4_qa_makeup_2709',v_actor,'owner','active') returning id into v_member;
  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,
    source_module,source_version,entity_version,created_by,updated_by)
  values
    ('a4_qa_makeup_2709','student','a4_student_a',
      pg_catalog.jsonb_build_object('id','a4_student_a','fullName','A4 Student A'),
      'a4-qa','a4-qa',1,v_actor,v_actor),
    ('a4_qa_makeup_2709','student','a4_student_b',
      pg_catalog.jsonb_build_object('id','a4_student_b','fullName','A4 Student B'),
      'a4-qa','a4-qa',1,v_actor,v_actor),
    ('a4_qa_makeup_2709','class_session','a4_class',
      pg_catalog.jsonb_build_object('id','a4_class','daysOfWeek',pg_catalog.jsonb_build_array(v_day),
        'startTime','09:00','endTime','10:00','room','QA','instructorName',''),
      'a4-qa','a4-qa',1,v_actor,v_actor),
    ('a4_qa_makeup_2709','schedule_session','a4_schedule',
      pg_catalog.jsonb_build_object('id','a4_schedule','scheduleType','recurring',
        'classSessionId','a4_class','dayOfWeek',v_day,'startDate',(v_today-56)::text,
        'endDate',(v_today+7)::text,'studentIds',pg_catalog.jsonb_build_array('a4_student_a','a4_student_b')),
      'a4-qa','a4-qa',1,v_actor,v_actor);
  insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,
    default_amount,created_by_membership_id,updated_by_membership_id)
  values('a4000000-0000-4000-8000-000000000101','a4_qa_makeup_2709',
    'A4 package',20,2000000,v_member,v_member);
  insert into public.center_tuition_package_cycles(center_id,student_local_id,tuition_local_id,
    cycle_number,package_catalog_id,package_name_snapshot,total_sessions_snapshot,
    price_snapshot,payment_period_id,baseline_cutoff_date,baseline_review_note,
    lifecycle_status,origin,created_by,updated_by)
  values('a4_qa_makeup_2709','a4_student_a','a4_tuition',1,
    'a4000000-0000-4000-8000-000000000101','A4 package',20,2000000,
    'a4_period',v_today-56,'A4 QA opening','ACTIVE','OPERATOR_BASELINE',v_actor,v_actor);
end $$;

create function pg_temp.a4_qa_write(p_date date,p_student text,p_status text,
  p_target text,p_key uuid) returns jsonb language plpgsql as $$
declare v_expected jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'local_id',e.local_id,'version',e.entity_version) order by e.local_id),'[]'::jsonb)
    into v_expected from public.center_cloud_entities e
  where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
    and e.deleted_at is null and e.payload->>'studentId'=p_student
    and e.payload->>'scheduleSessionId'='a4_schedule' and e.payload->>'date'=p_date::text;
  return public.v2_3_mutate_occurrence_attendance('a4_qa_makeup_2709','a4_schedule',p_date,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id',p_student,'source','admin','attendance_status',p_status,
      'makeup_for_attendance_local_id',p_target,'payload','{}'::jsonb,
      'expected_records',v_expected)),null,p_key);
end $$;

select pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('a4.qa.actor'),true);
do $$
declare
  v_today date:=pg_catalog.current_setting('a4.qa.today')::date;
  v_x text;
  v_y text;
  v_p text;
  v_f text;
  v_other_id text;
  v_result jsonb;
  v_cmd jsonb;
  v_expected jsonb;
begin
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-49,'MARK_HELD');
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-42,'MARK_HELD');
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-35,'MARK_HELD');
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-21,'MARK_HELD');
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-14,'MARK_HELD');
  perform public.a2_manage_occurrence('a4_qa_makeup_2709','a4_schedule',v_today-7,'MARK_HELD');
  v_result:=pg_temp.a4_qa_write(v_today-49,'a4_student_a','absent',null,
    'a4000000-0000-4000-8000-000000000201');
  v_result:=pg_temp.a4_qa_write(v_today-42,'a4_student_a','absent',null,
    'a4000000-0000-4000-8000-000000000202');
  v_result:=pg_temp.a4_qa_write(v_today-35,'a4_student_a','present',null,
    'a4000000-0000-4000-8000-000000000203');
  v_result:=pg_temp.a4_qa_write(v_today-14,'a4_student_a','absent',null,
    'a4000000-0000-4000-8000-000000000204');
  select e.local_id into v_x from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-49)::text;
  select e.local_id into v_y from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-42)::text;
  select e.local_id into v_p from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-35)::text;
  select e.local_id into v_f from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-14)::text;

  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_a','makeup',null,
      'a4000000-0000-4000-8000-000000000205');
    raise exception 'a4_qa_missing_target_accepted';
  exception when others then
    if sqlerrm='a4_qa_missing_target_accepted'
      or position('a4_makeup_target_required' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_b','makeup',v_x,
      'a4000000-0000-4000-8000-000000000206');
    raise exception 'a4_qa_wrong_student_accepted';
  exception when others then
    if sqlerrm='a4_qa_wrong_student_accepted'
      or position('a4_makeup_wrong_student' in sqlerrm)=0 then raise; end if;
  end;
  select e.local_id into v_other_id from public.center_cloud_entities e
    where e.center_id<>'a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.deleted_at is null and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
    order by e.local_id limit 1;
  if v_other_id is null then raise exception 'a4_qa_requires_other_center_attendance'; end if;
  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_a','makeup',v_other_id,
      'a4000000-0000-4000-8000-000000000216');
    raise exception 'a4_qa_other_center_target_accepted';
  exception when others then
    if sqlerrm='a4_qa_other_center_target_accepted'
      or position('a4_makeup_target_not_found' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_a','makeup',v_p,
      'a4000000-0000-4000-8000-000000000207');
    raise exception 'a4_qa_present_target_accepted';
  exception when others then
    if sqlerrm='a4_qa_present_target_accepted'
      or position('a4_makeup_target_not_absent' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_a','makeup',v_f,
      'a4000000-0000-4000-8000-000000000208');
    raise exception 'a4_qa_later_target_accepted';
  exception when others then
    if sqlerrm='a4_qa_later_target_accepted'
      or position('a4_makeup_target_future' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform pg_temp.a4_qa_write(v_today+7,'a4_student_a','makeup',v_x,
      'a4000000-0000-4000-8000-000000000217');
    raise exception 'a4_qa_future_makeup_accepted';
  exception when others then
    if sqlerrm='a4_qa_future_makeup_accepted'
      or position('a2_occurrence_not_held' in sqlerrm)=0 then raise; end if;
  end;
end $$;
-- A synthetic cancelled fact with an existing absence is used only inside
-- this rollback transaction to exercise the defensive guard.
update public.center_schedule_occurrences set lifecycle_state='CANCELLED'
  where center_id='a4_qa_makeup_2709' and schedule_session_local_id='a4_schedule'
    and occurrence_date=pg_catalog.current_setting('a4.qa.today')::date-42;
do $$
declare
  v_today date:=pg_catalog.current_setting('a4.qa.today')::date;
  v_y text;
begin
  select e.local_id into v_y from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-42)::text;
  begin
    perform pg_temp.a4_qa_write(v_today-21,'a4_student_a','makeup',v_y,
      'a4000000-0000-4000-8000-000000000209');
    raise exception 'a4_qa_cancelled_target_accepted';
  exception when others then
    if sqlerrm='a4_qa_cancelled_target_accepted'
      or position('a4_makeup_target_cancelled' in sqlerrm)=0 then raise; end if;
  end;
end $$;
update public.center_schedule_occurrences set lifecycle_state='HELD'
  where center_id='a4_qa_makeup_2709' and schedule_session_local_id='a4_schedule'
    and occurrence_date=pg_catalog.current_setting('a4.qa.today')::date-42;
-- Simulate a pre-A2 canonical absence: candidate reads must remain read-only,
-- while the later makeup write may materialize its conservative A2 fact.
delete from public.center_schedule_occurrences
  where center_id='a4_qa_makeup_2709' and schedule_session_local_id='a4_schedule'
    and occurrence_date=pg_catalog.current_setting('a4.qa.today')::date-49;
do $$
declare
  v_today date:=pg_catalog.current_setting('a4.qa.today')::date;
  v_x text;
  v_y text;
  v_result jsonb;
  v_cmd jsonb;
  v_expected jsonb;
begin
  select e.local_id into v_x from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-49)::text;
  select e.local_id into v_y from public.center_cloud_entities e
    where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
      and e.payload->>'date'=(v_today-42)::text;

  v_result:=public.a4_list_eligible_missed_occurrences('a4_qa_makeup_2709',
    'a4_student_a',v_today-21);
  if pg_catalog.jsonb_array_length(v_result->'candidates')<>2 then
    raise exception 'a4_qa_candidate_filter_wrong'; end if;
  if exists(select 1 from public.center_schedule_occurrences o
    where o.center_id='a4_qa_makeup_2709' and o.schedule_session_local_id='a4_schedule'
      and o.occurrence_date=v_today-49) then
    raise exception 'a4_qa_candidate_read_mutated_occurrence'; end if;
  v_cmd:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a4_student_a','source','admin','attendance_status','makeup',
    'makeup_for_attendance_local_id',v_x,'payload','{}'::jsonb,
    'expected_records','[]'::jsonb));
  v_result:=public.v2_3_mutate_occurrence_attendance('a4_qa_makeup_2709','a4_schedule',
    v_today-21,v_cmd,null,'a4000000-0000-4000-8000-000000000210');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a4_qa_valid_makeup_failed'; end if;
  v_result:=public.v2_3_mutate_occurrence_attendance('a4_qa_makeup_2709','a4_schedule',
    v_today-21,v_cmd,null,'a4000000-0000-4000-8000-000000000210');
  if not coalesce((v_result->>'replayed')::boolean,false) then
    raise exception 'a4_qa_retry_failed'; end if;
  if not exists(select 1 from public.center_cloud_entities e
      where e.center_id='a4_qa_makeup_2709' and e.local_id=v_x
        and e.payload->>'attendanceStatus'='absent')
     or not exists(select 1 from public.center_cloud_entities e
      where e.center_id='a4_qa_makeup_2709'
        and e.payload->>'date'=(v_today-21)::text
        and e.payload->>'makeupForAttendanceLocalId'=v_x)
     or not exists(select 1 from public.center_schedule_occurrences o
       where o.center_id='a4_qa_makeup_2709' and o.schedule_session_local_id='a4_schedule'
         and o.occurrence_date=v_today-49 and o.lifecycle_state='HELD'
         and o.context_origin='EXISTING_ATTENDANCE')
     or (select coalesce(sum(contribution_units),0)
       from public.center_tuition_attendance_contributions
       where center_id='a4_qa_makeup_2709')<>2 then
    raise exception 'a4_qa_link_or_count_wrong'; end if;
  begin
    perform pg_temp.a4_qa_write(v_today-7,'a4_student_a','makeup',v_x,
      'a4000000-0000-4000-8000-000000000211');
    raise exception 'a4_qa_duplicate_accepted';
  exception when others then
    if sqlerrm='a4_qa_duplicate_accepted'
      or position('a4_makeup_already_compensated' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform pg_temp.a4_qa_write(v_today-49,'a4_student_a','present',null,
      'a4000000-0000-4000-8000-000000000212');
    raise exception 'a4_qa_compensated_absence_corrected';
  exception when others then
    if sqlerrm='a4_qa_compensated_absence_corrected'
      or position('a4_compensated_absence_locked' in sqlerrm)=0 then raise; end if;
  end;
  begin
    update public.center_cloud_entities e set deleted_at=pg_catalog.clock_timestamp()
      where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
        and e.local_id=v_x;
    raise exception 'a4_qa_compensated_absence_retired';
  exception when others then
    if sqlerrm='a4_qa_compensated_absence_retired'
      or position('a4_compensated_absence_locked' in sqlerrm)=0 then raise; end if;
  end;

  -- Relink the same makeup from X to Y. X becomes eligible, Y is claimed.
  select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'local_id',e.local_id,'version',e.entity_version)) into v_expected
  from public.center_cloud_entities e where e.center_id='a4_qa_makeup_2709'
    and e.entity_type='attendance_record' and e.payload->>'date'=(v_today-21)::text;
  v_cmd:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a4_student_a','source','correction','attendance_status','makeup',
    'makeup_for_attendance_local_id',v_y,'payload','{}'::jsonb,
    'expected_records',v_expected));
  v_result:=public.v2_3_mutate_occurrence_attendance('a4_qa_makeup_2709','a4_schedule',
    v_today-21,v_cmd,null,'a4000000-0000-4000-8000-000000000213');
  if not coalesce((v_result->>'ok')::boolean,false)
     or (select coalesce(sum(contribution_units),0)
       from public.center_tuition_attendance_contributions
       where center_id='a4_qa_makeup_2709')<>2 then
    raise exception 'a4_qa_relink_or_count_wrong'; end if;
  v_result:=public.a4_list_eligible_missed_occurrences('a4_qa_makeup_2709',
    'a4_student_a',v_today-21);
  if pg_catalog.jsonb_array_length(v_result->'candidates')<>1
     or v_result#>>'{candidates,0,attendance_local_id}'<>v_x then
    raise exception 'a4_qa_relink_candidates_wrong'; end if;

  v_result:=pg_temp.a4_qa_write(v_today-21,'a4_student_a','present',null,
    'a4000000-0000-4000-8000-000000000214');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'a4_qa_release_failed'; end if;
  v_result:=public.a4_list_eligible_missed_occurrences('a4_qa_makeup_2709',
    'a4_student_a',v_today-21);
  if pg_catalog.jsonb_array_length(v_result->'candidates')<>2 then
    raise exception 'a4_qa_release_candidates_wrong'; end if;
  v_result:=pg_temp.a4_qa_write(v_today-7,'a4_student_a','makeup',v_y,
    'a4000000-0000-4000-8000-000000000215');
  if not coalesce((v_result->>'ok')::boolean,false)
     or (select count(*) from public.center_tuition_attendance_contributions
       where center_id='a4_qa_makeup_2709')<>6
     or (select coalesce(sum(contribution_units),0)
       from public.center_tuition_attendance_contributions
       where center_id='a4_qa_makeup_2709')<>3 then
    raise exception 'a4_qa_reuse_or_contribution_wrong'; end if;
  v_result:=pg_temp.a4_qa_write(v_today-7,'a4_student_a','absent',null,
    'a4000000-0000-4000-8000-000000000218');
  if not coalesce((v_result->>'ok')::boolean,false)
     or exists(select 1 from public.center_cloud_entities e
       where e.center_id='a4_qa_makeup_2709' and e.entity_type='attendance_record'
         and e.payload->>'date'=(v_today-7)::text
         and pg_catalog.btrim(coalesce(e.payload->>'makeupForAttendanceLocalId',''))<>'')
     or (select coalesce(sum(contribution_units),0)
       from public.center_tuition_attendance_contributions
       where center_id='a4_qa_makeup_2709')<>2 then
    raise exception 'a4_qa_absent_correction_or_count_wrong'; end if;
  v_result:=public.a4_list_eligible_missed_occurrences('a4_qa_makeup_2709',
    'a4_student_a',v_today-7);
  if not exists(select 1 from pg_catalog.jsonb_array_elements(v_result->'candidates') candidate
    where candidate->>'attendance_local_id'=v_y) then
    raise exception 'a4_qa_absent_correction_did_not_release_target'; end if;
end $$;
set local role authenticated;
do $$
declare v_read jsonb;
begin
  v_read:=public.a4_list_eligible_missed_occurrences('a4_qa_makeup_2709',
    'a4_student_a',pg_catalog.current_setting('a4.qa.today')::date-7);
  if v_read->>'ok'<>'true' then raise exception 'a4_qa_authenticated_candidate_read_failed'; end if;
end $$;
reset role;
select 'A4_TRANSACTION_QA_PASS';
