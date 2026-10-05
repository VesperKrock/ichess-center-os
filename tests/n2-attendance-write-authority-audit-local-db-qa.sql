-- Executed only by the guarded local runner, inside one outer ROLLBACK.
do $$
declare
  v_owner uuid; v_admin uuid; v_teacher uuid; v_member uuid;
  v_today date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_day text; v_fact public.center_schedule_occurrences; v_trial_id text;
begin
  select id into v_owner from auth.users order by id limit 1;
  select id into v_admin from auth.users order by id offset 1 limit 1;
  select id into v_teacher from auth.users order by id offset 2 limit 1;
  if v_teacher is null then raise exception 'n2_qa_users_required'; end if;
  if exists(select 1 from public.centers where id like 'n2_qa_%') then raise exception 'n2_qa_center_collision'; end if;
  perform set_config('n2.qa.owner',v_owner::text,true);
  perform set_config('n2.qa.admin',v_admin::text,true);
  perform set_config('n2.qa.teacher',v_teacher::text,true);
  perform set_config('n2.qa.today',v_today::text,true);
  -- Existing installation governance fences center seed triggers. This
  -- transaction-local service transition is only for disposable QA fixtures.
  perform set_config('app.chb1_internal_transition','on',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  v_day:=case extract(isodow from v_today) when 1 then 'mon' when 2 then 'tue'
    when 3 then 'wed' when 4 then 'thu' when 5 then 'fri' when 6 then 'sat' else 'sun' end;
  insert into public.centers(id,name,environment,status) values
    ('n2_qa_a','N2 QA A','test','active'),('n2_qa_b','N2 QA B','test','active');
  update public.installation_handoff_control set installation_state='TESTER_ACTIVE'
    where singleton_id=1;
  insert into public.installation_center_epochs(center_id,installation_epoch,epoch_status)
    select c.id,h.installation_epoch,'CURRENT' from public.centers c
    cross join public.installation_handoff_control h where c.id in ('n2_qa_a','n2_qa_b');
  insert into public.center_members(center_id,user_id,role,status) values
    ('n2_qa_a',v_owner,'owner','active'),('n2_qa_a',v_admin,'admin','active'),
    ('n2_qa_a',v_teacher,'teacher','active');
  select id into v_member from public.center_members where center_id='n2_qa_a' and user_id=v_owner;
  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,
    source_module,source_version,entity_version,created_by,updated_by) values
    ('n2_qa_a','student','n2_student_a',jsonb_build_object('id','n2_student_a','fullName','A'),
      'n2-qa','n2-qa',1,v_owner,v_owner),
    ('n2_qa_a','student','n2_student_b',jsonb_build_object('id','n2_student_b','fullName','B'),
      'n2-qa','n2-qa',1,v_owner,v_owner),
    ('n2_qa_a','class_session','n2_class',jsonb_build_object('id','n2_class',
      'daysOfWeek',jsonb_build_array(v_day),'startTime','09:00','endTime','10:00',
      'room','QA','instructorName',''),'n2-qa','n2-qa',1,v_owner,v_owner),
    ('n2_qa_a','schedule_session','n2_schedule',jsonb_build_object('id','n2_schedule',
      'scheduleType','recurring','classSessionId','n2_class','dayOfWeek',v_day,
      'startDate',(v_today-70)::text,'endDate',(v_today+7)::text,
      'studentIds',jsonb_build_array('n2_student_a','n2_student_b'),'status','scheduled'),
      'n2-qa','n2-qa',1,v_owner,v_owner);
  insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,
    default_amount,created_by_membership_id,updated_by_membership_id)
  values('c2000000-0000-4000-8000-000000000101','n2_qa_a','N2 QA',30,3000000,v_member,v_member);
  insert into public.center_tuition_package_cycles(center_id,student_local_id,tuition_local_id,
    cycle_number,package_catalog_id,package_name_snapshot,total_sessions_snapshot,
    price_snapshot,payment_period_id,baseline_cutoff_date,baseline_review_note,
    lifecycle_status,origin,created_by,updated_by) values
    ('n2_qa_a','n2_student_a','n2_tuition_a',1,
      'c2000000-0000-4000-8000-000000000101','N2 QA',30,3000000,
      'n2_period',v_today-70,'QA','ACTIVE','OPERATOR_BASELINE',v_owner,v_owner),
    ('n2_qa_a','n2_student_b','n2_tuition_b',1,
      'c2000000-0000-4000-8000-000000000101','N2 QA',30,3000000,
      'n2_period',v_today-70,'QA','ACTIVE','OPERATOR_BASELINE',v_owner,v_owner);
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  v_fact:=public.a2_internal_ensure_held_occurrence('n2_qa_a','n2_schedule',v_today-56,v_owner);
  v_trial_id:=public.v2_3_internal_occurrence_attendance_local_id(
    'n2_qa_a','n2_schedule',v_today-56,'n2_student_b');
  -- Privileged fixture represents a genuine pre-N2 row; operational RPC may not create trial.
  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,
    source_module,source_version,entity_version,created_by,updated_by)
  values('n2_qa_a','attendance_record',v_trial_id,jsonb_build_object(
    'id',v_trial_id,'authorityLocalId',v_trial_id,'attendanceAuthority','v2.3-occurrence-v1',
    'studentId','n2_student_b','date',(v_today-56)::text,
    'scheduleSessionId','n2_schedule','sessionId','n2_schedule','classSessionId','n2_class',
    'teacherId',v_fact.planned_teacher_id,'teacherName',v_fact.planned_teacher_name,
    'source','admin','status','trial','attendanceStatus','trial',
    'counted',false,'countsTowardTuition',false,'creditValue',0,
    'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,
    'tuitionConsumptionApplied',false),'n2-qa','n2-qa',1,v_owner,v_owner);
  perform set_config('app.chb1_internal_transition','off',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
end $$;

create function pg_temp.n2_qa_command(p_date date,p_student text,p_action text,
  p_status text,p_reason text,p_target text) returns jsonb language plpgsql as $$
declare v_expected jsonb; v_change jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('localId',e.local_id,
    'version',e.entity_version) order by e.local_id),'[]'::jsonb)
    into v_expected from public.center_cloud_entities e
  where e.center_id='n2_qa_a' and e.entity_type='attendance_record' and e.deleted_at is null
    and e.payload->>'source'<>'initialBaseline' and e.payload->>'studentId'=p_student
    and e.payload->>'scheduleSessionId'='n2_schedule' and e.payload->>'date'=p_date::text;
  v_change:=jsonb_build_object('action',p_action,'studentId',p_student,
    'scheduleSessionId','n2_schedule','occurrenceDate',p_date::text,'expectedRecords',v_expected);
  if p_action='SET' then v_change:=v_change||jsonb_build_object(
    'attendanceStatus',p_status,'absenceReason',p_reason,'makeupForAttendanceLocalId',p_target); end if;
  return jsonb_build_object('operation','SAVE_ATTENDANCE','changes',jsonb_build_array(v_change));
end $$;
create function pg_temp.n2_qa_write(p_date date,p_student text,p_action text,
  p_status text,p_reason text,p_target text) returns jsonb language plpgsql as $$
begin
  return public.v2_9_mutate_attendance_batch('n2_qa_a',
    pg_temp.n2_qa_command(p_date,p_student,p_action,p_status,p_reason,p_target),gen_random_uuid());
end $$;

reset role;
select set_config('request.jwt.claim.sub',current_setting('n2.qa.owner'),true);

do $$
declare
  v_today date:=current_setting('n2.qa.today')::date;
  v_result jsonb; v_replay jsonb; v_command jsonb; v_batch uuid;
  v_original text; v_count bigint; v_units integer; v_status text;
begin
  v_result:=pg_temp.n2_qa_write(v_today-49,'n2_student_a','SET','present',null,null);
  if v_result->>'outcome_code'<>'COMMITTED' or
     (select count(*) from public.center_business_audit_events where center_id='n2_qa_a')<>1 then
    raise exception 'n2_qa_present_create_failed'; end if;
  v_result:=pg_temp.n2_qa_write(v_today-42,'n2_student_a','SET','absent',null,null);
  if (select payload->>'absenceReason' from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null
      and payload->>'date'=(v_today-42)::text and payload->>'studentId'='n2_student_a') is not null then
    raise exception 'n2_qa_unknown_reason_not_null'; end if;
  v_result:=pg_temp.n2_qa_write(v_today-42,'n2_student_a','SET','absent','  Báo nghỉ bệnh  ',null);
  if (select payload->>'absenceReason' from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null
      and payload->>'date'=(v_today-42)::text and payload->>'studentId'='n2_student_a')<>'Báo nghỉ bệnh'
     or not exists(select 1 from public.center_business_audit_events where center_id='n2_qa_a'
       and before_state->>'attendanceStatus'='absent'
       and after_state->>'attendanceStatus'='absent'
       and absence_reason_before is null and absence_reason_after='Báo nghỉ bệnh') then
    raise exception 'n2_qa_reason_only_correction_failed'; end if;
  v_result:=pg_temp.n2_qa_write(v_today-42,'n2_student_a','SET','present','stale reason',null);
  if (select payload->>'absenceReason' from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null
      and payload->>'date'=(v_today-42)::text and payload->>'studentId'='n2_student_a') is not null
     or not exists(select 1 from public.center_business_audit_events where center_id='n2_qa_a'
       and absence_reason_before='Báo nghỉ bệnh' and absence_reason_after is null) then
    raise exception 'n2_qa_absent_present_reason_not_cleared'; end if;
  v_result:=pg_temp.n2_qa_write(v_today-28,'n2_student_a','SET','absent','Báo nghỉ',null);
  select local_id into v_original from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null
      and payload->>'date'=(v_today-28)::text and payload->>'studentId'='n2_student_a';
  v_result:=pg_temp.n2_qa_write(v_today-21,'n2_student_a','SET','absent','Bệnh',null);
  v_result:=pg_temp.n2_qa_write(v_today-21,'n2_student_a','SET','makeup','stale reason',v_original);
  if (select payload->>'absenceReason' from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null
      and payload->>'date'=(v_today-21)::text and payload->>'studentId'='n2_student_a') is not null
     or not exists(select 1 from public.center_business_audit_events where center_id='n2_qa_a'
       and absence_reason_before='Bệnh' and absence_reason_after is null
       and after_state->>'makeupForAttendanceLocalId'=v_original) then
    raise exception 'n2_qa_absent_makeup_reason_or_link_failed'; end if;
  v_result:=pg_temp.n2_qa_write(v_today-14,'n2_student_a','SET','absent',null,null);
  v_result:=pg_temp.n2_qa_write(v_today-14,'n2_student_a','SET','absent','Báo nghỉ bệnh',null);
  select coalesce(sum(contribution_units),0) into v_units
    from public.center_tuition_attendance_contributions
    where center_id='n2_qa_a' and student_local_id='n2_student_a' and ended_at is null;
  v_result:=pg_temp.n2_qa_write(v_today-49,'n2_student_a','UNMARK',null,null,null);
  if exists(select 1 from public.center_cloud_entities where center_id='n2_qa_a'
    and entity_type='attendance_record' and deleted_at is null
    and payload->>'studentId'='n2_student_a' and payload->>'date'=(v_today-49)::text)
     or not exists(select 1 from public.center_business_audit_events where center_id='n2_qa_a'
       and action_type='UNMARK' and after_state->>'deleted'='true')
     or (select coalesce(sum(contribution_units),0) from public.center_tuition_attendance_contributions
       where center_id='n2_qa_a' and student_local_id='n2_student_a' and ended_at is null)<>v_units-1 then
    raise exception 'n2_qa_unmark_or_tuition_failed'; end if;

  v_command:=jsonb_build_object('operation','SAVE_ATTENDANCE','changes',jsonb_build_array(
    (pg_temp.n2_qa_command(v_today-7,'n2_student_a','SET','present',null,null)->'changes'->0),
    (pg_temp.n2_qa_command(v_today-7,'n2_student_b','SET','absent',null,null)->'changes'->0)));
  v_result:=public.v2_9_mutate_attendance_batch('n2_qa_a',v_command,
    'c2000000-0000-4000-8000-000000000201');
  v_batch:=(v_result->>'audit_batch_id')::uuid;
  if (select count(*) from public.center_business_audit_events
      where center_id='n2_qa_a' and audit_batch_id=v_batch)<>2
     or (select array_agg(batch_ordinal order by batch_ordinal)
       from public.center_business_audit_events where center_id='n2_qa_a'
         and audit_batch_id=v_batch)<>array[1,2] then
    raise exception 'n2_qa_multi_change_batch_failed'; end if;
  select count(*) into v_count from public.center_business_audit_events where center_id='n2_qa_a';
  v_replay:=public.v2_9_mutate_attendance_batch('n2_qa_a',v_command,
    'c2000000-0000-4000-8000-000000000201');
  if v_replay->>'audit_batch_id'<>v_batch::text or v_replay->>'replayed'<>'true'
     or (select count(*) from public.center_business_audit_events where center_id='n2_qa_a')<>v_count then
    raise exception 'n2_qa_idempotent_replay_failed'; end if;
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',
      jsonb_set(v_command,'{changes,0,attendanceStatus}','"absent"'::jsonb),
      'c2000000-0000-4000-8000-000000000201');
    raise exception 'n2_qa_idempotency_conflict_accepted';
  exception when others then
    if sqlerrm='n2_qa_idempotency_conflict_accepted' then raise; end if;
    if sqlerrm not like '%n2_idempotency_conflict%' then raise; end if;
  end;
  foreach v_status in array array['trial','excused','excusedAbsent','unexcusedAbsent'] loop
    begin
      perform public.v2_9_mutate_attendance_batch('n2_qa_a',
        jsonb_set(pg_temp.n2_qa_command(v_today-7,'n2_student_a','SET','present',null,null),
          '{changes,0,attendanceStatus}',to_jsonb(v_status)),gen_random_uuid());
      raise exception 'n2_qa_legacy_status_accepted:%',v_status;
    exception when others then
      if sqlerrm like 'n2_qa_legacy_status_accepted:%' then raise; end if;
      if sqlerrm not like '%n2_unsupported_attendance_status%' then raise; end if;
    end;
  end loop;
  if not exists(select 1 from public.center_cloud_entities where center_id='n2_qa_a'
    and entity_type='attendance_record' and payload->>'attendanceStatus'='trial'
    and deleted_at is null) then raise exception 'n2_qa_historical_trial_lost'; end if;
  if (select coalesce(sum(contribution_units),0) from public.center_tuition_attendance_contributions
    where center_id='n2_qa_a' and student_local_id='n2_student_b'
      and occurrence_date=v_today-56 and ended_at is null)<>0 then
    raise exception 'n2_qa_trial_consumed_tuition'; end if;
  begin
    perform pg_temp.n2_qa_write(v_today-14,'n2_student_a','SET','makeup',null,v_original);
    raise exception 'n2_qa_double_makeup_accepted';
  exception when others then
    if sqlerrm='n2_qa_double_makeup_accepted' then raise; end if;
    if sqlerrm not like '%a4_makeup_already_compensated%'
       and sqlerrm not like '%center_cloud_entities_a4_makeup_target_unique%' then raise; end if;
  end;
  begin
    perform pg_temp.n2_qa_write(v_today-28,'n2_student_a','SET','present',null,null);
    raise exception 'n2_qa_compensated_absence_changed';
  exception when others then
    if sqlerrm='n2_qa_compensated_absence_changed' then raise; end if;
    if sqlerrm not like '%a4_compensated_absence_locked%' then raise; end if;
  end;
end $$;

-- Server permissions, center isolation, and non-Attendance C5.2 compatibility.
do $$
declare v_today date:=current_setting('n2.qa.today')::date;
  v_command jsonb; v_result jsonb; v_count bigint;
begin
  if to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is not null
     or has_function_privilege('authenticated',
       'public.n2_internal_mutate_attendance_tuition_entities(text,jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.n2_internal_append_business_audit_event(jsonb)','EXECUTE') then
    raise exception 'n2_qa_second_writer_or_append_access'; end if;
  if pg_get_functiondef('public.a3_set_occurrence_actual_teacher(text,text,date,text,uuid,uuid)'::regprocedure)
    like '%update public.center_cloud_entities e%' then
    raise exception 'n2_qa_a3_teacher_override_writes_attendance'; end if;
  v_result:=public.c5_2_mutate_attendance_tuition_entities('n2_qa_a',jsonb_build_array(
    jsonb_build_object('entity_type','attendance_record','local_id','forbidden',
      'expected_version',0,'operation','UPSERT','payload','{}'::jsonb)),gen_random_uuid());
  if v_result->>'outcome_code'<>'ATTENDANCE_TYPED_COMMAND_REQUIRED' then
    raise exception 'n2_qa_c52_attendance_bypass'; end if;
  v_result:=public.c5_2_mutate_attendance_tuition_entities('n2_qa_a',jsonb_build_array(
    jsonb_build_object('entity_type','session_report','local_id','n2_report',
      'expected_version',0,'operation','UPSERT','payload',jsonb_build_object(
        'id','n2_report','sessionId','n2_schedule','occurrenceDate',v_today::text,
        'attendance',jsonb_build_array()))),gen_random_uuid());
  if v_result->>'outcome_code'<>'COMMITTED' then raise exception 'n2_qa_c52_report_compatibility'; end if;
  if has_table_privilege('authenticated','public.center_business_audit_events','UPDATE')
     or has_table_privilege('authenticated','public.center_business_audit_events','DELETE')
     or has_table_privilege('authenticated','public.center_business_audit_events','SELECT') then
    raise exception 'n2_qa_audit_table_privilege_leaked'; end if;
  select count(*) into v_count from public.center_business_audit_events where center_id='n2_qa_a';
  v_result:=public.v2_9_list_attendance_audit_events('n2_qa_a');
  if v_result->>'ok'<>'true' or jsonb_array_length(v_result->'events')<>v_count then
    raise exception 'n2_qa_owner_audit_read_failed'; end if;
  begin
    perform public.v2_9_list_attendance_audit_events('n2_qa_b');
    raise exception 'n2_qa_cross_center_read_allowed';
  exception when others then
    if sqlerrm='n2_qa_cross_center_read_allowed' then raise; end if;
    if sqlerrm not like '%n2_audit_owner_required%' then raise; end if;
  end;
  v_command:=pg_temp.n2_qa_command(v_today-7,'n2_student_a','SET','absent',null,null);
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',v_command-'operation',gen_random_uuid());
    raise exception 'n2_qa_missing_operation_accepted';
  exception when others then
    if sqlerrm='n2_qa_missing_operation_accepted' then raise; end if;
    if sqlerrm not like '%n2_invalid_command%' then raise; end if;
  end;
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',
      jsonb_set(v_command,'{changes,0}',(v_command->'changes'->0)-'expectedRecords'),gen_random_uuid());
    raise exception 'n2_qa_missing_expected_versions_accepted';
  exception when others then
    if sqlerrm='n2_qa_missing_expected_versions_accepted' then raise; end if;
    if sqlerrm not like '%n2_invalid_change%' then raise; end if;
  end;
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_b',v_command,gen_random_uuid());
    raise exception 'n2_qa_cross_center_write_allowed';
  exception when others then
    if sqlerrm='n2_qa_cross_center_write_allowed' then raise; end if;
    if sqlerrm not like '%n2_write_role_required%' then raise; end if;
  end;
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',
      jsonb_set(v_command,'{changes,0,expectedRecords}','[]'::jsonb),gen_random_uuid());
    raise exception 'n2_qa_stale_write_allowed';
  exception when others then
    if sqlerrm='n2_qa_stale_write_allowed' then raise; end if;
    if sqlerrm not like '%n2_attendance_version_conflict%' then raise; end if;
  end;
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',
      jsonb_set(v_command,'{changes}',jsonb_build_array(v_command->'changes'->0,
        v_command->'changes'->0)),gen_random_uuid());
    raise exception 'n2_qa_duplicate_identity_allowed';
  exception when others then
    if sqlerrm='n2_qa_duplicate_identity_allowed' then raise; end if;
    if sqlerrm not like '%n2_duplicate_attendance_identity%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('n2.qa.admin'),true);
  begin
    perform public.v2_9_list_attendance_audit_events('n2_qa_a');
    raise exception 'n2_qa_admin_audit_read_allowed';
  exception when others then
    if sqlerrm='n2_qa_admin_audit_read_allowed' then raise; end if;
    if sqlerrm not like '%n2_audit_owner_required%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('n2.qa.teacher'),true);
  begin
    perform public.v2_9_mutate_attendance_batch('n2_qa_a',v_command,gen_random_uuid());
    raise exception 'n2_qa_teacher_write_allowed';
  exception when others then
    if sqlerrm='n2_qa_teacher_write_allowed' then raise; end if;
    if sqlerrm not like '%n2_write_role_required%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('n2.qa.owner'),true);
end $$;

-- The current authenticated DB role cannot read or mutate audit directly.
set local role authenticated;
do $$
declare
  v_date date:=current_setting('n2.qa.today')::date-63;
  v_result jsonb;
  v_direct_rows bigint;
begin
    v_result:=public.v2_9_mutate_attendance_batch('n2_qa_a',jsonb_build_object(
      'operation','SAVE_ATTENDANCE','changes',jsonb_build_array(jsonb_build_object(
        'action','SET','studentId','n2_student_a','scheduleSessionId','n2_schedule',
        'occurrenceDate',v_date::text,'expectedRecords','[]'::jsonb,
        'attendanceStatus','present'))),gen_random_uuid());
    if v_result->>'outcome_code'<>'COMMITTED' then
      raise exception 'n2_qa_authenticated_role_write_failed'; end if;
    v_result:=public.v2_9_list_attendance_audit_events('n2_qa_a');
    if v_result->>'ok'<>'true' then raise exception 'n2_qa_authenticated_owner_read_failed'; end if;
  begin
    update public.center_cloud_entities set payload=jsonb_set(payload,'{attendanceStatus}','"trial"'::jsonb)
    where center_id='n2_qa_a' and entity_type='attendance_record'
      and payload->>'studentId'='n2_student_a' and payload->>'date'=v_date::text;
    get diagnostics v_direct_rows=row_count;
    if v_direct_rows>0 then raise exception 'n2_qa_direct_attendance_write_allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    delete from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record'
      and payload->>'studentId'='n2_student_a' and payload->>'date'=v_date::text;
    get diagnostics v_direct_rows=row_count;
    if v_direct_rows>0 then raise exception 'n2_qa_direct_attendance_delete_allowed'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.center_business_audit_events set action_type='REWRITTEN' where id=1;
    raise exception 'n2_qa_owner_direct_update_allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.center_business_audit_events where id=1;
    raise exception 'n2_qa_owner_direct_delete_allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A database insert failure after V2.4 reconciliation must undo all effects.
create function pg_temp.n2_qa_force_audit_failure() returns trigger language plpgsql as $$
begin raise exception 'n2_qa_forced_audit_insert_failure'; end $$;
create trigger n2_qa_force_audit_failure before insert on public.center_business_audit_events
  for each row execute function pg_temp.n2_qa_force_audit_failure();
do $$
declare v_today date:=current_setting('n2.qa.today')::date;
  v_attendance bigint; v_tuition bigint; v_audit bigint; v_units integer;
begin
  select count(*) into v_attendance from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and deleted_at is null;
  select count(*) into v_tuition from public.center_tuition_attendance_contributions
    where center_id='n2_qa_a' and ended_at is null;
  select coalesce(sum(contribution_units),0) into v_units
    from public.center_tuition_attendance_contributions
    where center_id='n2_qa_a' and ended_at is null;
  select count(*) into v_audit from public.center_business_audit_events where center_id='n2_qa_a';
  begin
    perform pg_temp.n2_qa_write(v_today-49,'n2_student_a','SET','present',null,null);
    raise exception 'n2_qa_forced_audit_failure_not_raised';
  exception when others then
    if sqlerrm='n2_qa_forced_audit_failure_not_raised' then raise; end if;
    if sqlerrm not like '%n2_qa_forced_audit_insert_failure%' then raise; end if;
  end;
  if (select count(*) from public.center_cloud_entities where center_id='n2_qa_a'
      and entity_type='attendance_record' and deleted_at is null)<>v_attendance
    or exists(select 1 from public.center_cloud_entities where center_id='n2_qa_a'
      and entity_type='attendance_record' and deleted_at is null
      and payload->>'studentId'='n2_student_a' and payload->>'date'=(v_today-49)::text)
    or (select count(*) from public.center_tuition_attendance_contributions
      where center_id='n2_qa_a' and ended_at is null)<>v_tuition
    or (select coalesce(sum(contribution_units),0) from public.center_tuition_attendance_contributions
      where center_id='n2_qa_a' and ended_at is null)<>v_units
    or (select count(*) from public.center_business_audit_events where center_id='n2_qa_a')<>v_audit then
    raise exception 'n2_qa_audit_failure_did_not_roll_back_all_effects';
  end if;
end $$;
drop trigger n2_qa_force_audit_failure on public.center_business_audit_events;

-- Even a privileged local DB operator is stopped by the immutable guard.
do $$ declare v_id bigint;
begin
  select id into v_id from public.center_business_audit_events where center_id='n2_qa_a' limit 1;
  begin
    update public.center_business_audit_events set action_type='REWRITTEN' where id=v_id;
    raise exception 'n2_qa_audit_update_allowed';
  exception when others then
    if sqlerrm='n2_qa_audit_update_allowed' then raise; end if;
    if sqlerrm not like '%n2_audit_immutable%' then raise; end if;
  end;
  begin
    delete from public.center_business_audit_events where id=v_id;
    raise exception 'n2_qa_audit_delete_allowed';
  exception when others then
    if sqlerrm='n2_qa_audit_delete_allowed' then raise; end if;
    if sqlerrm not like '%n2_audit_immutable%' then raise; end if;
  end;
end $$;
select 'N2_DB_CASES_PASS';
