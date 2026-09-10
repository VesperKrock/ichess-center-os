-- Transactional V2-3 QA. Run only on the guarded local Supabase database
-- after applying 202609100001. Every fixture and fault helper rolls back.
begin;

do $$
declare v_users uuid[];
begin
  select array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 4) source;
  if coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'v2_3_qa_requires_four_local_auth_users';
  end if;
  perform set_config('v2_3.qa.owner', v_users[1]::text, true);
  perform set_config('v2_3.qa.admin', v_users[2]::text, true);
  perform set_config('v2_3.qa.teacher', v_users[3]::text, true);
  perform set_config('v2_3.qa.other_owner', v_users[4]::text, true);

  insert into public.centers(id, name, environment, status) values
    ('v23_qa_center_a', 'V2.3 QA A', 'test', 'active'),
    ('v23_qa_center_b', 'V2.3 QA B', 'test', 'active');
  insert into public.center_members(center_id, user_id, role, status) values
    ('v23_qa_center_a', v_users[1], 'owner', 'active'),
    ('v23_qa_center_a', v_users[2], 'center_admin', 'active'),
    ('v23_qa_center_a', v_users[3], 'teacher', 'active'),
    ('v23_qa_center_b', v_users[4], 'owner', 'active');

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values
    ('v23_qa_center_a', 'class_session', 'v23_class_a',
      jsonb_build_object('id','v23_class_a','daysOfWeek',jsonb_build_array('fri'),'status','active'),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_b', 'class_session', 'v23_class_b',
      jsonb_build_object('id','v23_class_b','daysOfWeek',jsonb_build_array('fri'),'status','active'),
      'v2.3-qa','v2.3-qa',1,v_users[4],v_users[4]),
    ('v23_qa_center_a', 'student', 'v23_student_a',
      jsonb_build_object('id','v23_student_a','fullName','Student A'),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_a', 'student', 'v23_student_admin',
      jsonb_build_object('id','v23_student_admin','fullName','Student Admin'),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_a', 'student', 'v23_student_teacher',
      jsonb_build_object('id','v23_student_teacher','fullName','Student Teacher report'),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_a', 'student', 'v23_student_fault',
      jsonb_build_object('id','v23_student_fault','fullName','Student Fault'),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_b', 'student', 'v23_student_b',
      jsonb_build_object('id','v23_student_b','fullName','Student B'),
      'v2.3-qa','v2.3-qa',1,v_users[4],v_users[4]),
    ('v23_qa_center_a', 'schedule_session', 'v23_schedule_a',
      jsonb_build_object('id','v23_schedule_a','scheduleType','recurring','classSessionId','v23_class_a','dayOfWeek','fri','studentIds',jsonb_build_array('v23_student_a','v23_student_admin','v23_student_teacher','v23_student_fault')),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_b', 'schedule_session', 'v23_schedule_b',
      jsonb_build_object('id','v23_schedule_b','scheduleType','recurring','classSessionId','v23_class_b','dayOfWeek','fri','studentIds',jsonb_build_array('v23_student_b')),
      'v2.3-qa','v2.3-qa',1,v_users[4],v_users[4]),
    ('v23_qa_center_a', 'schedule_session', 'v23_oneoff_a',
      jsonb_build_object('id','v23_oneoff_a','scheduleType','oneOff','date','2026-09-12','studentIds',jsonb_build_array('v23_student_a')),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]),
    ('v23_qa_center_a', 'tuition_record_package', 'v23_tuition_a',
      jsonb_build_object('id','v23_tuition_a','studentId','v23_student_a','totalSessions',12,'usedSessions',4,'totalAmount',1200000,'paidAmount',600000,'attendanceLinked',false,'attendanceAutoUpdateEnabled',false,'usedSessionsAutoUpdateFromAttendance',false,'remainingSessionsAutoUpdateFromAttendance',false),
      'v2.3-qa','v2.3-qa',1,v_users[1],v_users[1]);
end
$$;

-- Model pre-cutover production evidence: two source-specific rows for the same
-- occurrence. The installed guard is disabled only around this fixture insert.
alter table public.center_cloud_entities disable trigger v2_3_guard_occurrence_attendance;
insert into public.center_cloud_entities(
  center_id, entity_type, local_id, payload, source_module, source_version,
  entity_version, created_by, updated_by
) values
  ('v23_qa_center_a','attendance_record','attendance_record::v23-legacy-admin',
    jsonb_build_object('id','v23_legacy_admin','studentId','v23_student_a','date','2026-09-11','scheduleSessionId','v23_schedule_a','sessionId','v23_schedule_a','source','admin','status','present','attendanceStatus','present','counted',true,'creditValue',1),
    'attendanceRecords','c5.2-authoritative-attendance-tuition-v1',3,current_setting('v2_3.qa.owner')::uuid,current_setting('v2_3.qa.owner')::uuid),
  ('v23_qa_center_a','attendance_record','attendance_record::v23-legacy-teacher',
    jsonb_build_object('id','v23_legacy_teacher','studentId','v23_student_a','date','2026-09-11','scheduleSessionId','v23_schedule_a','sessionId','v23_schedule_a','source','teacher','status','absent','attendanceStatus','absent','counted',false,'creditValue',0),
    'attendanceRecords','c5.2-authoritative-attendance-tuition-v1',2,current_setting('v2_3.qa.owner')::uuid,current_setting('v2_3.qa.owner')::uuid);
alter table public.center_cloud_entities enable trigger v2_3_guard_occurrence_attendance;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);

-- One-off/trial participation remains supported by the same occurrence key;
-- it is not converted into recurring enrollment and does not touch tuition.
do $$
declare v_result jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_oneoff_a','2026-09-12',
    jsonb_build_array(jsonb_build_object(
      'student_id','v23_student_a','source','admin','attendance_status','trial',
      'payload',jsonb_build_object('note','Học thử','counted',false,'creditValue',0),
      'expected_records','[]'::jsonb
    )),null,'31500000-0000-4000-8000-000000000001');
  if not coalesce((v_result->>'ok')::boolean,false)
     or not exists (select 1 from public.center_cloud_entities where center_id='v23_qa_center_a'
       and entity_type='attendance_record' and payload->>'scheduleSessionId'='v23_oneoff_a'
       and payload->>'attendanceStatus'='trial' and deleted_at is null) then
    raise exception 'v2_3_qa_oneoff_trial_failed';
  end if;
end
$$;

do $$
declare
  v_attendance jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_local_id text;
  v_tuition_before jsonb;
begin
  select payload into v_tuition_before from public.center_cloud_entities
  where center_id='v23_qa_center_a' and entity_type='tuition_record_package' and local_id='v23_tuition_a';
  v_attendance := jsonb_build_array(jsonb_build_object(
    'student_id','v23_student_a','source','admin','attendance_status','excused',
    'payload',jsonb_build_object('note','Có phép','counted',false,'creditValue',0),
    'expected_records',jsonb_build_array(
      jsonb_build_object('local_id','attendance_record::v23-legacy-admin','version',3),
      jsonb_build_object('local_id','attendance_record::v23-legacy-teacher','version',2)
    )
  ));
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_schedule_a','2026-09-11',v_attendance,null,
    '31000000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_3_qa_legacy_cutover_failed'; end if;
  select local_id into v_local_id from public.center_cloud_entities
  where center_id='v23_qa_center_a' and entity_type='attendance_record'
    and payload->>'studentId'='v23_student_a' and payload->>'date'='2026-09-11'
    and payload->>'attendanceAuthority'='v2.3-occurrence-v1' and deleted_at is null;
  if (select count(*) from public.center_cloud_entities where center_id='v23_qa_center_a'
      and entity_type='attendance_record' and deleted_at is null
      and payload->>'studentId'='v23_student_a' and payload->>'date'='2026-09-11') <> 1
     or not exists (select 1 from public.center_cloud_entities where center_id='v23_qa_center_a'
      and entity_type='attendance_record' and local_id=v_local_id and deleted_at is null
      and payload->>'attendanceAuthority'='v2.3-occurrence-v1'
       and payload->>'attendanceStatus'='excused'
       and payload->>'counted'='false'
       and payload->>'countsTowardTuition'='false'
       and payload->>'creditValue'='0'
       and payload->>'tuitionPolicyDefined'='false'
      and payload->>'tuitionAutoUpdateEnabled'='false'
      and payload->>'tuitionConsumptionApplied'='false')
     or (select count(*) from public.center_cloud_entities where center_id='v23_qa_center_a'
      and local_id in ('attendance_record::v23-legacy-admin','attendance_record::v23-legacy-teacher')
      and deleted_at is not null) <> 2 then
    raise exception 'v2_3_qa_one_current_truth_failed';
  end if;
  if (select payload from public.center_cloud_entities where center_id='v23_qa_center_a'
      and entity_type='tuition_record_package' and local_id='v23_tuition_a') <> v_tuition_before then
    raise exception 'v2_3_qa_tuition_mutated';
  end if;

  v_retry := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_schedule_a','2026-09-11',v_attendance,null,
    '31000000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_retry->>'replayed')::boolean,false) then raise exception 'v2_3_qa_exact_retry_failed'; end if;
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_schedule_a','2026-09-11',
      jsonb_set(v_attendance,'{0,attendance_status}','"absent"'::jsonb),null,
      '31000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_changed_intent_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_changed_intent_accepted' then raise; end if;
    if position('v2_3_idempotency_conflict' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

-- Exact replay is command-authoritative even if the occurrence is no longer
-- current after the original transaction committed.
reset role;
update public.center_cloud_entities
set deleted_at=clock_timestamp()
where center_id='v23_qa_center_a' and entity_type='schedule_session' and local_id='v23_schedule_a';
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);
do $$
declare v_retry jsonb;
begin
  v_retry := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_schedule_a','2026-09-11',
    jsonb_build_array(jsonb_build_object(
      'student_id','v23_student_a','source','admin','attendance_status','excused',
      'payload',jsonb_build_object('note','Có phép','counted',false,'creditValue',0),
      'expected_records',jsonb_build_array(
        jsonb_build_object('local_id','attendance_record::v23-legacy-admin','version',3),
        jsonb_build_object('local_id','attendance_record::v23-legacy-teacher','version',2)
      )
    )),null,'31000000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_retry->>'replayed')::boolean,false) then
    raise exception 'v2_3_qa_exact_retry_after_occurrence_change_failed';
  end if;
end
$$;
reset role;
update public.center_cloud_entities
set deleted_at=null
where center_id='v23_qa_center_a' and entity_type='schedule_session' and local_id='v23_schedule_a';

-- Admin ordinary parity and an exact-current update of the same canonical row.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.admin'), true);
do $$
declare v_result jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_schedule_a','2026-09-11',
    jsonb_build_array(jsonb_build_object(
      'student_id','v23_student_admin','source','admin','attendance_status','present',
      'payload',jsonb_build_object('counted',true,'creditValue',1),
      'expected_records','[]'::jsonb
    )),null,'32000000-0000-4000-8000-000000000001');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_3_qa_admin_parity_failed'; end if;
end
$$;

-- Teacher/report coexistence still writes one attendance authority and the
-- session report in the same C5.2 transaction.
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);
do $$
declare v_result jsonb; v_local_id text;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v23_qa_center_a','v23_schedule_a','2026-09-11',
    jsonb_build_array(jsonb_build_object(
      'student_id','v23_student_teacher','source','teacher','attendance_status','makeup',
      'payload',jsonb_build_object('note','Học bù','counted',true,'creditValue',1),
      'expected_records','[]'::jsonb
    )),jsonb_build_object(
      'local_id','session_report::v23-report','expected_version',0,
      'payload',jsonb_build_object('id','v23_report','sessionId','v23_schedule_a',
        'scheduleSessionId','v23_schedule_a','occurrenceDate','2026-09-11',
        'attendance',jsonb_build_array(jsonb_build_object('studentId','v23_student_teacher','attendanceStatus','makeup')))
    ),'33000000-0000-4000-8000-000000000001');
  select local_id into v_local_id from public.center_cloud_entities
  where center_id='v23_qa_center_a' and entity_type='attendance_record'
    and payload->>'studentId'='v23_student_teacher' and payload->>'date'='2026-09-11'
    and payload->>'attendanceAuthority'='v2.3-occurrence-v1' and deleted_at is null;
  if not coalesce((v_result->>'ok')::boolean,false)
     or not exists (select 1 from public.center_cloud_entities where center_id='v23_qa_center_a'
       and entity_type='attendance_record' and local_id=v_local_id and deleted_at is null)
     or not exists (select 1 from public.center_cloud_entities where center_id='v23_qa_center_a'
       and entity_type='session_report' and local_id='session_report::v23-report' and deleted_at is null) then
    raise exception 'v2_3_qa_teacher_report_atomic_write_failed';
  end if;
end
$$;

-- Stale expected set is rejected and never changes the current row.
do $$
declare v_local_id text; v_before bigint;
begin
  select local_id into v_local_id from public.center_cloud_entities
  where center_id='v23_qa_center_a' and entity_type='attendance_record'
    and payload->>'studentId'='v23_student_a' and payload->>'date'='2026-09-11'
    and payload->>'attendanceAuthority'='v2.3-occurrence-v1' and deleted_at is null;
  select entity_version into v_before from public.center_cloud_entities
  where center_id='v23_qa_center_a' and entity_type='attendance_record' and local_id=v_local_id;
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_schedule_a','2026-09-11',
      jsonb_build_array(jsonb_build_object(
        'student_id','v23_student_a','source','correction','attendance_status','absent',
        'payload',jsonb_build_object('counted',false,'creditValue',0),
        'expected_records',jsonb_build_array(jsonb_build_object('local_id',v_local_id,'version',v_before+1))
      )),null,'34000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_stale_version_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_stale_version_accepted' then raise; end if;
    if position('v2_3_attendance_version_conflict' in sqlerrm)=0 then raise; end if;
  end;
  if (select entity_version from public.center_cloud_entities where center_id='v23_qa_center_a'
      and entity_type='attendance_record' and local_id=v_local_id) <> v_before then
    raise exception 'v2_3_qa_stale_write_mutated_truth';
  end if;
end
$$;

-- A failure after the nested C5.2 mutation rolls the complete command back.
reset role;
create function public.v2_3_qa_force_finalize_failure()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.idempotency_key='35000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'v2_3_qa_forced_finalize_failure';
  end if;
  return new;
end
$$;
create trigger v2_3_qa_force_finalize_failure
before insert on public.center_occurrence_attendance_command_results
for each row execute function public.v2_3_qa_force_finalize_failure();
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);
do $$
begin
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_schedule_a','2026-09-11',
      jsonb_build_array(jsonb_build_object(
        'student_id','v23_student_fault','source','admin','attendance_status','trial',
        'payload',jsonb_build_object('counted',false,'creditValue',0),
        'expected_records','[]'::jsonb
      )),null,'35000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_fault_not_raised';
  exception when others then
    if sqlerrm='v2_3_qa_fault_not_raised' then raise; end if;
    if position('v2_3_qa_forced_finalize_failure' in sqlerrm)=0 then raise; end if;
  end;
  if exists (select 1 from public.center_cloud_entities where center_id='v23_qa_center_a'
      and entity_type='attendance_record' and payload->>'studentId'='v23_student_fault') then
    raise exception 'v2_3_qa_atomic_rollback_failed';
  end if;
end
$$;
reset role;
do $$ begin
  if exists (select 1 from public.center_operational_command_result where center_id='v23_qa_center_a'
      and idempotency_key='35000000-0000-4000-8000-000000000001') then
    raise exception 'v2_3_qa_nested_command_rollback_failed';
  end if;
end $$;
drop trigger v2_3_qa_force_finalize_failure on public.center_occurrence_attendance_command_results;
drop function public.v2_3_qa_force_finalize_failure();

-- Unauthorized role and foreign-center actor cannot read capability or mutate.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.teacher'), true);
do $$ begin
  begin perform public.v2_3_get_attendance_capability('v23_qa_center_a');
    raise exception 'v2_3_qa_teacher_capability_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_teacher_capability_accepted' then raise; end if;
    if position('v2_3_center_access_denied' in sqlerrm)=0 then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.other_owner'), true);
do $$ begin
  begin perform public.v2_3_get_attendance_capability('v23_qa_center_a');
    raise exception 'v2_3_qa_cross_center_capability_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_cross_center_capability_accepted' then raise; end if;
    if position('v2_3_center_access_denied' in sqlerrm)=0 then raise; end if;
  end;
end $$;
do $$ begin
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_schedule_a','2026-09-11',
      jsonb_build_array(jsonb_build_object(
        'student_id','v23_student_admin','source','admin','attendance_status','present',
        'payload',jsonb_build_object('counted',true,'creditValue',1),
        'expected_records','[]'::jsonb
      )),null,'36000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_cross_center_mutation_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_cross_center_mutation_accepted' then raise; end if;
    if position('v2_3_center_access_denied' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- A valid same-center actor still cannot invent a student/date outside the
-- concrete occurrence roster.
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);
do $$ begin
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_oneoff_a','2026-09-12',
      jsonb_build_array(jsonb_build_object(
        'student_id','v23_student_admin','source','admin','attendance_status','present',
        'payload',jsonb_build_object('counted',true,'creditValue',1),
        'expected_records','[]'::jsonb
      )),null,'37000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_non_roster_student_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_non_roster_student_accepted' then raise; end if;
    if position('v2_3_student_not_in_occurrence_roster' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'v23_qa_center_a','v23_oneoff_a','2026-09-13',
      jsonb_build_array(jsonb_build_object(
        'student_id','v23_student_a','source','admin','attendance_status','present',
        'payload',jsonb_build_object('counted',true,'creditValue',1),
        'expected_records','[]'::jsonb
      )),null,'38000000-0000-4000-8000-000000000001');
    raise exception 'v2_3_qa_wrong_occurrence_date_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_wrong_occurrence_date_accepted' then raise; end if;
    if position('v2_3_schedule_occurrence_not_found' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- The still-supported C5.2 RPC cannot bypass the canonical occurrence guard.
reset role;
select set_config(
  'v2_3.qa.nonroster_local_id',
  public.v2_3_internal_occurrence_attendance_local_id(
    'v23_qa_center_a','v23_oneoff_a','2026-09-12','v23_student_admin'
  ),
  true
);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_3.qa.owner'), true);
do $$ begin
  begin
    perform public.c5_2_mutate_attendance_tuition_entities(
      'v23_qa_center_a',
      jsonb_build_array(jsonb_build_object(
        'entity_type','attendance_record',
        'local_id',current_setting('v2_3.qa.nonroster_local_id'),
        'expected_version',0,
        'operation','UPSERT',
        'payload',jsonb_build_object(
          'id',current_setting('v2_3.qa.nonroster_local_id'),
          'authorityLocalId',current_setting('v2_3.qa.nonroster_local_id'),
          'attendanceAuthority','v2.3-occurrence-v1',
          'studentId','v23_student_admin',
          'date','2026-09-12',
          'scheduleSessionId','v23_oneoff_a',
          'sessionId','v23_oneoff_a',
          'source','admin',
          'status','present',
          'attendanceStatus','present',
          'tuitionPolicyDefined',false,
          'tuitionAutoUpdateEnabled',false,
          'tuitionConsumptionApplied',false
        )
      )),
      '39000000-0000-4000-8000-000000000001'
    );
    raise exception 'v2_3_qa_c52_bypass_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_c52_bypass_accepted' then raise; end if;
    if position('v2_3_student_not_in_occurrence_roster' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Direct browser DML remains denied.
do $$ begin
  begin
    insert into public.center_occurrence_attendance_command_results(
      center_id,actor_user_id,idempotency_key,intent_digest,result_snapshot
    ) values ('v23_qa_center_b',current_setting('v2_3.qa.other_owner')::uuid,
      gen_random_uuid(),decode(repeat('00',32),'hex'),'{}'::jsonb);
    raise exception 'v2_3_qa_direct_dml_accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The guard blocks any post-cutover source-specific operational row, while
-- baseline history remains governed by the inherited C5.2 contract.
do $$ begin
  begin
    insert into public.center_cloud_entities(
      center_id,entity_type,local_id,payload,source_module,source_version,
      entity_version,created_by,updated_by
    ) values ('v23_qa_center_a','attendance_record','v23_bad_legacy',
      jsonb_build_object('id','v23_bad_legacy','studentId','v23_student_a','date','2026-09-18',
        'scheduleSessionId','v23_schedule_a','sessionId','v23_schedule_a','source','admin',
        'status','present','attendanceStatus','present'),
      'qa','qa',1,current_setting('v2_3.qa.owner')::uuid,current_setting('v2_3.qa.owner')::uuid);
    raise exception 'v2_3_qa_legacy_write_accepted';
  exception when others then
    if sqlerrm='v2_3_qa_legacy_write_accepted' then raise; end if;
    if position('v2_3_canonical_occurrence_required' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Physical security contract.
do $$ begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='center_occurrence_attendance_command_results'
        and c.relrowsecurity and c.relforcerowsecurity)
     or has_table_privilege('authenticated','public.center_occurrence_attendance_command_results','INSERT')
     or not has_function_privilege('authenticated','public.v2_3_get_attendance_capability(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.v2_3_internal_occurrence_attendance_local_id(text,text,date,text)','EXECUTE') then
    raise exception 'v2_3_qa_security_contract_failed';
  end if;
end $$;

rollback;
