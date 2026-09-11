begin;

do $$
declare v_users uuid[];
begin
  select array_agg(id order by id) into v_users from (select id from auth.users order by id limit 4) users;
  if coalesce(array_length(v_users, 1), 0) < 4 then raise exception 'v2_4_qa_requires_four_users'; end if;
  perform set_config('v2_4.qa.owner', v_users[1]::text, true);
  perform set_config('v2_4.qa.admin', v_users[2]::text, true);
  perform set_config('v2_4.qa.teacher', v_users[3]::text, true);
  perform set_config('v2_4.qa.other', v_users[4]::text, true);

  insert into public.centers(id,name,environment,status) values
    ('v24_qa_a','V2.4 QA A','test','active'),
    ('v24_qa_b','V2.4 QA B','test','active');
  insert into public.center_members(center_id,user_id,role,status) values
    ('v24_qa_a',v_users[1],'owner','active'),
    ('v24_qa_a',v_users[2],'center_admin','active'),
    ('v24_qa_a',v_users[3],'teacher','active'),
    ('v24_qa_b',v_users[4],'owner','active');

  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
  values
    ('v24_qa_a','student','v24_student_policy',jsonb_build_object('id','v24_student_policy','fullName','Policy Student'),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','student','v24_student_rollover',jsonb_build_object('id','v24_student_rollover','fullName','Rollover Student'),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','student','v24_student_selection',jsonb_build_object('id','v24_student_selection','fullName','Selection Student'),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','student','v24_student_admin',jsonb_build_object('id','v24_student_admin','fullName','Admin Student'),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','student','v24_student_same_day',jsonb_build_object('id','v24_student_same_day','fullName','Same-day Student'),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_b','student','v24_student_b',jsonb_build_object('id','v24_student_b','fullName','Center B Student'),'v2.4-qa','v2.4-qa',1,v_users[4],v_users[4]),
    ('v24_qa_a','tuition_record_package','tuition_record_package::v24_tuition_policy',jsonb_build_object('id','v24_tuition_policy','studentId','v24_student_policy','currentTermId','v24_period_policy','currentTermNumber',1,'usedSessions',5,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','tuition_record_package','tuition_record_package::v24_tuition_rollover',jsonb_build_object('id','v24_tuition_rollover','studentId','v24_student_rollover','currentTermId','v24_period_rollover','currentTermNumber',1,'usedSessions',8,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','tuition_record_package','tuition_record_package::v24_tuition_selection',jsonb_build_object('id','v24_tuition_selection','studentId','v24_student_selection','currentTermId','v24_period_selection','currentTermNumber',1,'usedSessions',8,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','tuition_record_package','tuition_record_package::v24_tuition_admin',jsonb_build_object('id','v24_tuition_admin','studentId','v24_student_admin','currentTermId','v24_period_admin','currentTermNumber',1,'usedSessions',0,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_a','tuition_record_package','tuition_record_package::v24_tuition_same_day',jsonb_build_object('id','v24_tuition_same_day','studentId','v24_student_same_day','currentTermId','v24_period_same_day','currentTermNumber',1,'usedSessions',0,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[1],v_users[1]),
    ('v24_qa_b','tuition_record_package','tuition_record_package::v24_tuition_b',jsonb_build_object('id','v24_tuition_b','studentId','v24_student_b','currentTermId','v24_period_b','currentTermNumber',1,'usedSessions',0,'totalSessions',8),'v2.4-qa','v2.4-qa',1,v_users[4],v_users[4]);

  insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,default_amount,is_active,note,created_by_membership_id,updated_by_membership_id)
  select '24000000-0000-4000-8000-000000000001', 'v24_qa_a', 'Gói QA 8', 8, 800000, true, '', m.id, m.id
  from public.center_members m where m.center_id='v24_qa_a' and m.user_id=v_users[1];
  insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,default_amount,is_active,note,created_by_membership_id,updated_by_membership_id)
  select '24000000-0000-4000-8000-000000000002', 'v24_qa_b', 'Gói QA B', 8, 900000, true, '', m.id, m.id
  from public.center_members m where m.center_id='v24_qa_b' and m.user_id=v_users[4];
  insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,default_amount,is_active,note,created_by_membership_id,updated_by_membership_id)
  select '24000000-0000-4000-8000-000000000003', 'v24_qa_a', 'Gói QA 16', 16, 1500000, true, '', m.id, m.id
  from public.center_members m where m.center_id='v24_qa_a' and m.user_id=v_users[1];
end
$$;

-- V2-3 attendance can exist before an explicit cycle. It must not silently
-- create a V2-4 row or turn legacy usedSessions into an inferred baseline.
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
values
 ('v24_qa_a','schedule_session','v24_sched_cutoff',jsonb_build_object(
  'id','v24_sched_cutoff','scheduleType','oneOff','date','2026-09-01','studentIds',jsonb_build_array('v24_student_policy')
 ),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_pre',jsonb_build_object(
  'id','v24_sched_pre','scheduleType','oneOff','date','2026-09-02','studentIds',jsonb_build_array('v24_student_policy')
 ),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_result jsonb;
begin
  perform public.v2_3_mutate_occurrence_attendance(
    'v24_qa_a','v24_sched_cutoff','2026-09-01',jsonb_build_array(jsonb_build_object(
      'student_id','v24_student_policy','source','admin','attendance_status','present',
      'payload',jsonb_build_object('note','Included in reviewed baseline'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000006');
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v24_qa_a','v24_sched_pre','2026-09-02',jsonb_build_array(jsonb_build_object(
      'student_id','v24_student_policy','source','admin','attendance_status','present',
      'payload',jsonb_build_object('note','Present before cycle'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000001');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_4_qa_pre_cycle_attendance_failed'; end if;
end
$$;
reset role;
do $$ begin
  if exists (select 1 from public.center_tuition_package_cycles where center_id='v24_qa_a')
     or exists (select 1 from public.center_tuition_attendance_contributions where center_id='v24_qa_a') then
    raise exception 'v2_4_qa_silent_legacy_inference';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);

-- Explicit baseline is required. The attendance after cutoff is then derived
-- from the canonical occurrence and reaches N-2 without a renewal reminder.
do $$
begin
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_admin',
    'tuition_local_id','tuition_record_package::v24_tuition_admin',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',0,'baseline_cutoff_date','2026-09-01'
  ),'24020000-0000-4000-8000-000000000000');
  raise exception 'v2_4_qa_missing_baseline_evidence_accepted';
exception when others then
  if sqlerrm='v2_4_qa_missing_baseline_evidence_accepted'
     or position('v2_4_invalid_baseline' in sqlerrm)=0 then raise; end if;
end
$$;
do $$
declare v_result jsonb; v_retry jsonb; v_state jsonb;
begin
  v_result := public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_policy',
    'tuition_local_id','tuition_record_package::v24_tuition_policy',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',5,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu lịch sử kỳ hiện tại'
  ),'24020000-0000-4000-8000-000000000001');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_4_qa_start_failed'; end if;
  v_retry := public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_policy',
    'tuition_local_id','tuition_record_package::v24_tuition_policy',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',5,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu lịch sử kỳ hiện tại'
  ),'24020000-0000-4000-8000-000000000001');
  if not coalesce((v_retry->>'replayed')::boolean,false) then raise exception 'v2_4_qa_exact_retry_failed'; end if;
  begin
    perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
      'operation','START_CYCLE','student_id','v24_student_policy',
      'tuition_local_id','tuition_record_package::v24_tuition_policy',
      'package_catalog_id','24000000-0000-4000-8000-000000000001',
      'baseline_used_sessions',4,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu lịch sử kỳ hiện tại'
    ),'24020000-0000-4000-8000-000000000001');
    raise exception 'v2_4_qa_changed_intent_accepted';
  exception when others then
    if sqlerrm='v2_4_qa_changed_intent_accepted' or position('v2_4_idempotency_conflict' in sqlerrm)=0 then raise; end if;
  end;
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if (select (p->'current_cycle'->>'used_sessions')::int from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') <> 6
     or (select (p->'current_cycle'->>'bcht_reminder')::boolean from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') is not true
     or (select (p->'current_cycle'->>'renewal_reminder')::boolean from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') is not false then
    raise exception 'v2_4_qa_n_minus_2_failed';
  end if;
end
$$;

reset role;
do $$
begin
  if not exists (
    select 1
    from public.center_tuition_package_cycles c
    where c.center_id='v24_qa_a'
      and c.student_local_id='v24_student_policy'
      and c.origin='OPERATOR_BASELINE'
      and c.baseline_used_sessions=5
      and c.baseline_cutoff_date='2026-09-01'
      and pg_catalog.btrim(c.baseline_review_note) <> ''
      and c.created_by=current_setting('v2_4.qa.owner')::uuid
      and c.created_at is not null
  ) then
    raise exception 'v2_4_qa_baseline_actor_time_reason_missing';
  end if;
  if exists (
    select 1 from public.center_tuition_attendance_contributions c
    where c.center_id='v24_qa_a'
      and c.student_local_id='v24_student_policy'
      and c.schedule_session_local_id='v24_sched_cutoff'
      and c.occurrence_date='2026-09-01'
  ) then
    raise exception 'v2_4_qa_baseline_cutoff_double_counted';
  end if;
end
$$;

-- BCHT completion is versioned and suppresses BCHT only. Admin/Owner parity is
-- exercised by letting center_admin complete the cycle report.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.admin'), true);
do $$
declare v_cycle public.center_tuition_package_cycles; v_result jsonb;
begin
  select (p->'current_cycle'->>'id')::uuid,
         (p->'current_cycle'->>'version')::bigint
    into v_cycle.id, v_cycle.version
  from jsonb_array_elements(public.v2_4_list_package_cycle_state('v24_qa_a')->'students') p
  where p->>'student_id'='v24_student_policy';
  v_result := public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','UPDATE_BCHT','student_id','v24_student_policy','cycle_id',v_cycle.id,
    'expected_version',v_cycle.version,'bcht_status','COMPLETED','bcht_note','Đã hoàn tất BCHT QA'
  ),'24020000-0000-4000-8000-000000000002');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_4_qa_admin_bcht_failed'; end if;
  begin
    perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
      'operation','UPDATE_BCHT','student_id','v24_student_policy','cycle_id',v_cycle.id,
      'expected_version',v_cycle.version,'bcht_status','IN_PROGRESS','bcht_note','stale'
    ),'24020000-0000-4000-8000-000000000003');
    raise exception 'v2_4_qa_stale_accepted';
  exception when others then
    if sqlerrm='v2_4_qa_stale_accepted' or position('v2_4_stale_version' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

reset role;
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
values
 ('v24_qa_a','schedule_session','v24_sched_makeup',jsonb_build_object('id','v24_sched_makeup','scheduleType','oneOff','date','2026-09-03','studentIds',jsonb_build_array('v24_student_policy')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_absent',jsonb_build_object('id','v24_sched_absent','scheduleType','oneOff','date','2026-09-04','studentIds',jsonb_build_array('v24_student_policy')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_trial',jsonb_build_object('id','v24_sched_trial','scheduleType','oneOff','date','2026-09-05','studentIds',jsonb_build_array('v24_student_policy')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_result jsonb; v_state jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_makeup','2026-09-03',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_policy','source','admin','attendance_status','makeup',
    'payload',jsonb_build_object('note','Bù do nghỉ có phép'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000002');
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_absent','2026-09-04',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_policy','source','admin','attendance_status','absent',
    'payload',jsonb_build_object('note','Vắng'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000003');
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_trial','2026-09-05',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_policy','source','admin','attendance_status','trial',
    'payload',jsonb_build_object('note','Học thử'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000004');
  if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'v2_4_qa_makeup_save_failed'; end if;
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if (select (p->'current_cycle'->>'used_sessions')::int from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') <> 7
     or (select (p->'current_cycle'->>'renewal_reminder')::boolean from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') is not true
     or (select (p->'current_cycle'->>'bcht_reminder')::boolean from jsonb_array_elements(v_state->'students') p where p->>'student_id'='v24_student_policy') is not false then
    raise exception 'v2_4_qa_policy_or_n_minus_1_failed';
  end if;
end
$$;
reset role;
do $$ begin
  if (select contribution_units from public.center_tuition_attendance_contributions where center_id='v24_qa_a' and schedule_session_local_id='v24_sched_absent') <> 0
     or (select contribution_units from public.center_tuition_attendance_contributions where center_id='v24_qa_a' and schedule_session_local_id='v24_sched_trial') <> 0
     or (select makeup_reason_snapshot from public.center_tuition_attendance_contributions where center_id='v24_qa_a' and schedule_session_local_id='v24_sched_makeup') <> 'Bù do nghỉ có phép' then
    raise exception 'v2_4_qa_policy_contribution_failed';
  end if;
end $$;

-- Correction updates the same occurrence contribution rather than adding a
-- second credit. Enrollment truth is untouched.
do $$
declare v_local text; v_version bigint; v_before_enrollment text;
begin
  select local_id,entity_version into v_local,v_version from public.center_cloud_entities
  where center_id='v24_qa_a' and entity_type='attendance_record' and deleted_at is null
    and payload->>'scheduleSessionId'='v24_sched_makeup' and payload->>'studentId'='v24_student_policy';
  select coalesce(string_agg(to_jsonb(e)::text,'' order by e.id),'') into v_before_enrollment
  from public.center_student_recurring_enrollments e where e.center_id='v24_qa_a';
  perform set_config('v2_4.qa.makeup_local', v_local, true);
  perform set_config('v2_4.qa.makeup_version', v_version::text, true);
  perform set_config('v2_4.qa.enrollment_before', v_before_enrollment, true);
end
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_makeup','2026-09-03',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_policy','source','correction','attendance_status','excused',
    'payload',jsonb_build_object('note','Sửa thành có phép'),
    'expected_records',jsonb_build_array(jsonb_build_object(
      'local_id',current_setting('v2_4.qa.makeup_local'),
      'version',current_setting('v2_4.qa.makeup_version')::bigint
    ))
  )),null,'24010000-0000-4000-8000-000000000005');
end
$$;
reset role;
do $$
declare v_after_enrollment text;
begin
  select coalesce(string_agg(to_jsonb(e)::text,'' order by e.id),'') into v_after_enrollment
    from public.center_student_recurring_enrollments e where e.center_id='v24_qa_a';
  if (select count(*) from public.center_tuition_attendance_contributions where center_id='v24_qa_a' and schedule_session_local_id='v24_sched_makeup' and ended_at is null) <> 1
     or (select contribution_units from public.center_tuition_attendance_contributions where center_id='v24_qa_a' and schedule_session_local_id='v24_sched_makeup') <> 0
     or v_after_enrollment <> current_setting('v2_4.qa.enrollment_before') then raise exception 'v2_4_qa_correction_convergence_failed'; end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);

-- Rollover: a consuming event after N creates exactly one provisional unpaid
-- cycle, does not create Finance, and preserves attendance save.
do $$
begin
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_rollover',
    'tuition_local_id','tuition_record_package::v24_tuition_rollover',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',8,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu đủ 8 buổi'
  ),'24020000-0000-4000-8000-000000000010');
end
$$;
reset role;
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
values
 ('v24_qa_a','schedule_session','v24_sched_rollover_absent',jsonb_build_object('id','v24_sched_rollover_absent','scheduleType','oneOff','date','2026-09-03','studentIds',jsonb_build_array('v24_student_rollover')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_rollover_excused',jsonb_build_object('id','v24_sched_rollover_excused','scheduleType','oneOff','date','2026-09-04','studentIds',jsonb_build_array('v24_student_rollover')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_rollover_trial',jsonb_build_object('id','v24_sched_rollover_trial','scheduleType','oneOff','date','2026-09-05','studentIds',jsonb_build_array('v24_student_rollover')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_rollover',jsonb_build_object('id','v24_sched_rollover','scheduleType','oneOff','date','2026-09-06','studentIds',jsonb_build_array('v24_student_rollover')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_rollover_absent','2026-09-03',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_rollover','source','admin','attendance_status','absent',
    'payload',jsonb_build_object('note','Không mở chu kỳ'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000011');
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_rollover_excused','2026-09-04',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_rollover','source','admin','attendance_status','excused',
    'payload',jsonb_build_object('note','Không mở chu kỳ'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000012');
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_rollover_trial','2026-09-05',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_rollover','source','admin','attendance_status','trial',
    'payload',jsonb_build_object('note','Không mở chu kỳ'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000013');
  if (select count(*) from jsonb_array_elements(public.v2_4_list_package_cycle_state('v24_qa_a')->'students') p
      cross join lateral jsonb_array_elements(p->'cycles') cycle
      where p->>'student_id'='v24_student_rollover') <> 1 then
    raise exception 'v2_4_qa_nonconsuming_opened_cycle';
  end if;
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_rollover','2026-09-06',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_rollover','source','admin','attendance_status','present',
    'payload',jsonb_build_object('note','First beyond N'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000010');
end
$$;
reset role;
do $$ begin
  if (select count(*) from public.center_tuition_package_cycles where center_id='v24_qa_a' and student_local_id='v24_student_rollover') <> 2
     or not exists (select 1 from public.center_tuition_package_cycle_projection where center_id='v24_qa_a' and student_local_id='v24_student_rollover' and cycle_number=2 and lifecycle_status='PROVISIONAL_UNPAID' and used_sessions=1 and bcht_status='NOT_STARTED' and payment_status='UNPAID')
     or (select count(*) from public.finance_transaction where center_id='v24_qa_a') <> 0
     or (select payload->>'usedSessions' from public.center_cloud_entities where center_id='v24_qa_a' and local_id='tuition_record_package::v24_tuition_rollover') <> '8' then
    raise exception 'v2_4_qa_provisional_rollover_failed';
  end if;
  if not exists (select 1 from public.center_tuition_package_cycles
    where center_id='v24_qa_a' and student_local_id='v24_student_rollover'
      and cycle_number=2 and bcht_status='NOT_STARTED') then
    raise exception 'v2_4_qa_bcht_did_not_reset';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);

-- A still-unpaid inherited provisional cycle may be changed explicitly. The
-- exhausted predecessor snapshot stays immutable and accumulated attendance
-- is reconciled exactly once under the selected package.
do $$
declare v_state jsonb; v_cycle jsonb;
begin
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  select p->'current_cycle' into v_cycle from jsonb_array_elements(v_state->'students') p
    where p->>'student_id'='v24_student_rollover';
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','SELECT_PROVISIONAL_PACKAGE','student_id','v24_student_rollover',
    'cycle_id',v_cycle->>'id','expected_version',(v_cycle->>'version')::bigint,
    'package_catalog_id','24000000-0000-4000-8000-000000000003'
  ),'24020000-0000-4000-8000-000000000011');
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if not exists (select 1 from jsonb_array_elements(v_state->'students') p
    where p->>'student_id'='v24_student_rollover'
      and (p->'current_cycle'->>'total_sessions')::int=16
      and (p->'current_cycle'->>'used_sessions')::int=1)
    or not exists (select 1 from jsonb_array_elements(v_state->'students') p
      cross join lateral jsonb_array_elements(p->'cycles') history
      where p->>'student_id'='v24_student_rollover'
        and (history->>'cycle_number')::int=1 and (history->>'total_sessions')::int=8) then
    raise exception 'v2_4_qa_provisional_package_change_failed';
  end if;
end
$$;

-- An inactive prior catalog cannot invent next-cycle terms. Attendance is kept
-- as a pending contribution until an operator explicitly selects a live package.
do $$
begin
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_selection',
    'tuition_local_id','tuition_record_package::v24_tuition_selection',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',8,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu đủ 8 buổi'
  ),'24020000-0000-4000-8000-000000000020');
end
$$;
reset role;
update public.center_tuition_package_catalog set is_active=false,version=version+1 where id='24000000-0000-4000-8000-000000000001';
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
values ('v24_qa_a','schedule_session','v24_sched_selection',jsonb_build_object('id','v24_sched_selection','scheduleType','oneOff','date','2026-09-07','studentIds',jsonb_build_array('v24_student_selection')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_selection','2026-09-07',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_selection','source','admin','attendance_status','makeup',
    'payload',jsonb_build_object('note','Bù vượt gói'), 'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000020');
end
$$;
reset role;
do $$ begin
  if not exists (select 1 from public.center_tuition_package_cycle_projection
    where center_id='v24_qa_a' and student_local_id='v24_student_selection' and cycle_number=2
      and lifecycle_status='NEEDS_PACKAGE_SELECTION' and total_sessions_snapshot is null
      and pending_sessions=1 and reminder_state='PACKAGE_SELECTION_REQUIRED') then
    raise exception 'v2_4_qa_needs_selection_failed';
  end if;
end $$;

-- Ordinary Admin parity and exact-center denial.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.admin'), true);
do $$
begin
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_admin',
    'tuition_local_id','tuition_record_package::v24_tuition_admin',
    'package_catalog_id','24000000-0000-4000-8000-000000000001',
    'baseline_used_sessions',0,'baseline_cutoff_date','2026-09-01','baseline_review_note','Bắt đầu từ 0 buổi'
  ),'24020000-0000-4000-8000-000000000030');
  raise exception 'v2_4_qa_inactive_package_admin_accepted';
exception when others then
  if sqlerrm='v2_4_qa_inactive_package_admin_accepted' or position('v2_4_package_not_available' in sqlerrm)=0 then raise; end if;
end
$$;
reset role;
update public.center_tuition_package_catalog set is_active=true,version=version+1 where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_state jsonb; v_cycle jsonb;
begin
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  select p->'current_cycle' into v_cycle from jsonb_array_elements(v_state->'students') p
    where p->>'student_id'='v24_student_selection';
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','SELECT_PROVISIONAL_PACKAGE','student_id','v24_student_selection',
    'cycle_id',v_cycle->>'id','expected_version',(v_cycle->>'version')::bigint,
    'package_catalog_id','24000000-0000-4000-8000-000000000003'
  ),'24020000-0000-4000-8000-000000000021');
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if not exists (select 1 from jsonb_array_elements(v_state->'students') p
    where p->>'student_id'='v24_student_selection'
      and p->'current_cycle'->>'lifecycle_status'='PROVISIONAL_UNPAID'
      and (p->'current_cycle'->>'used_sessions')::int=1
      and (p->'current_cycle'->>'total_sessions')::int=16) then
    raise exception 'v2_4_qa_pending_contribution_selection_failed';
  end if;
end
$$;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.admin'), true);
select public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
  'operation','START_CYCLE','student_id','v24_student_admin',
  'tuition_local_id','tuition_record_package::v24_tuition_admin',
  'package_catalog_id','24000000-0000-4000-8000-000000000001',
  'baseline_used_sessions',0,'baseline_cutoff_date','2026-09-01','baseline_review_note','Bắt đầu từ 0 buổi'
),'24020000-0000-4000-8000-000000000031');

-- Date is not contribution identity: two concrete occurrences on one date
-- count independently. Corrections converge in place in both directions.
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
select public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
  'operation','START_CYCLE','student_id','v24_student_same_day',
  'tuition_local_id','tuition_record_package::v24_tuition_same_day',
  'package_catalog_id','24000000-0000-4000-8000-000000000001',
  'baseline_used_sessions',0,'baseline_cutoff_date','2026-09-01','baseline_review_note','Đã đối chiếu bắt đầu từ 0'
),'24020000-0000-4000-8000-000000000032');
reset role;
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
values
 ('v24_qa_a','schedule_session','v24_sched_same_day_a',jsonb_build_object('id','v24_sched_same_day_a','scheduleType','oneOff','date','2026-09-08','studentIds',jsonb_build_array('v24_student_same_day')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid),
 ('v24_qa_a','schedule_session','v24_sched_same_day_b',jsonb_build_object('id','v24_sched_same_day_b','scheduleType','oneOff','date','2026-09-08','studentIds',jsonb_build_array('v24_student_same_day')),'v2.4-qa','v2.4-qa',1,current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_state jsonb;
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_same_day_a','2026-09-08',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_same_day','source','admin','attendance_status','present','payload','{}'::jsonb,'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000032');
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_same_day_b','2026-09-08',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_same_day','source','admin','attendance_status','present','payload','{}'::jsonb,'expected_records','[]'::jsonb
  )),null,'24010000-0000-4000-8000-000000000033');
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if (select (p->'current_cycle'->>'used_sessions')::int from jsonb_array_elements(v_state->'students') p
      where p->>'student_id'='v24_student_same_day') <> 2
     or (select count(*) from jsonb_array_elements(v_state->'contributions') c
      where c->>'student_id'='v24_student_same_day' and c->>'occurrence_date'='2026-09-08') <> 2 then
    raise exception 'v2_4_qa_same_day_occurrence_identity_failed';
  end if;
end
$$;
reset role;
do $$
declare v_record public.center_cloud_entities;
begin
  select * into v_record from public.center_cloud_entities where center_id='v24_qa_a'
    and entity_type='attendance_record' and deleted_at is null
    and payload->>'studentId'='v24_student_same_day'
    and payload->>'scheduleSessionId'='v24_sched_same_day_a';
  perform set_config('v2_4.qa.same_day_local',v_record.local_id,true);
  perform set_config('v2_4.qa.same_day_version',v_record.entity_version::text,true);
end
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_state jsonb;
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_same_day_a','2026-09-08',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_same_day','source','correction','attendance_status','absent','payload','{}'::jsonb,
    'expected_records',jsonb_build_array(jsonb_build_object('local_id',current_setting('v2_4.qa.same_day_local'),'version',current_setting('v2_4.qa.same_day_version')::bigint))
  )),null,'24010000-0000-4000-8000-000000000034');
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if (select (p->'current_cycle'->>'used_sessions')::int from jsonb_array_elements(v_state->'students') p
      where p->>'student_id'='v24_student_same_day') <> 1 then raise exception 'v2_4_qa_present_to_absent_failed'; end if;
end
$$;
reset role;
select set_config('v2_4.qa.same_day_version',(select entity_version::text from public.center_cloud_entities
  where center_id='v24_qa_a' and local_id=current_setting('v2_4.qa.same_day_local')),true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.owner'), true);
do $$
declare v_state jsonb;
begin
  perform public.v2_3_mutate_occurrence_attendance('v24_qa_a','v24_sched_same_day_a','2026-09-08',jsonb_build_array(jsonb_build_object(
    'student_id','v24_student_same_day','source','correction','attendance_status','present','payload','{}'::jsonb,
    'expected_records',jsonb_build_array(jsonb_build_object('local_id',current_setting('v2_4.qa.same_day_local'),'version',current_setting('v2_4.qa.same_day_version')::bigint))
  )),null,'24010000-0000-4000-8000-000000000035');
  v_state := public.v2_4_list_package_cycle_state('v24_qa_a');
  if (select (p->'current_cycle'->>'used_sessions')::int from jsonb_array_elements(v_state->'students') p
      where p->>'student_id'='v24_student_same_day') <> 2 then raise exception 'v2_4_qa_absent_to_present_failed'; end if;
end
$$;
reset role;
do $$
begin
  if exists (
    select 1
    from public.center_tuition_attendance_contributions c
    where c.center_id='v24_qa_a'
      and c.student_local_id='v24_student_same_day'
      and c.occurrence_date='2026-09-08'
    group by c.schedule_session_local_id, c.occurrence_date
    having count(*) <> 1 or count(*) filter (where c.ended_at is null) <> 1
  ) then
    raise exception 'v2_4_qa_duplicate_current_contribution';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.other'), true);
do $$
begin
  perform public.v2_4_list_package_cycle_state('v24_qa_a');
  raise exception 'v2_4_qa_cross_center_read_accepted';
exception when others then
  if sqlerrm='v2_4_qa_cross_center_read_accepted' or position('v2_4_center_access_denied' in sqlerrm)=0 then raise; end if;
end
$$;
do $$
begin
  perform public.v2_4_mutate_package_cycle('v24_qa_a',jsonb_build_object(
    'operation','START_CYCLE','student_id','v24_student_b',
    'tuition_local_id','tuition_record_package::v24_tuition_b',
    'package_catalog_id','24000000-0000-4000-8000-000000000002',
    'baseline_used_sessions',0,'baseline_cutoff_date','2026-09-01','baseline_review_note','Kiểm thử khác cơ sở'
  ),'24020000-0000-4000-8000-000000000040');
  raise exception 'v2_4_qa_cross_center_write_accepted';
exception when others then
  if sqlerrm='v2_4_qa_cross_center_write_accepted' or position('v2_4_center_access_denied' in sqlerrm)=0 then raise; end if;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_4.qa.teacher'), true);
do $$
begin
  perform public.v2_4_list_package_cycle_state('v24_qa_a');
  raise exception 'v2_4_qa_teacher_read_accepted';
exception when others then
  if sqlerrm='v2_4_qa_teacher_read_accepted' or position('v2_4_center_access_denied' in sqlerrm)=0 then raise; end if;
end
$$;

-- Direct table DML remains unavailable to browser roles.
do $$
begin
  insert into public.center_tuition_package_cycles(center_id,student_local_id,tuition_local_id,cycle_number,payment_period_id,baseline_cutoff_date,lifecycle_status,origin,created_by,updated_by)
  values ('v24_qa_a','x','x',99,'x','2026-09-01','NEEDS_PACKAGE_SELECTION','AUTOMATIC_ROLLOVER',current_setting('v2_4.qa.teacher')::uuid,current_setting('v2_4.qa.teacher')::uuid);
  raise exception 'v2_4_qa_direct_dml_accepted';
exception when insufficient_privilege then null;
end
$$;

reset role;

-- Payment projection consumes C5.4 POSTED/VOIDED truth and V2-4 never creates
-- a Finance transaction itself.
do $$
declare v_category uuid; v_cycle public.center_tuition_package_cycles;
begin
  insert into public.finance_category(center_id,name,category_type,created_by,updated_by)
  values ('v24_qa_a','Học phí QA','INCOME',current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid)
  returning id into v_category;
  select * into v_cycle from public.center_tuition_package_cycles where center_id='v24_qa_a' and student_local_id='v24_student_policy' and cycle_number=1;
  insert into public.finance_transaction(center_id,transaction_code,cashflow_type,category_id,category_name_snapshot,amount_minor,transaction_date,method,source_module,source_type,source_payment_id,source_tuition_id,source_student_id,source_period_id,status,created_by,updated_by)
  values ('v24_qa_a','TC-20260911-9001','INCOME',v_category,'Học phí QA',400000,'2026-09-11','cash','hoc-phi','tuition-payment','v24-payment-1',v_cycle.tuition_local_id,v_cycle.student_local_id,v_cycle.payment_period_id,'POSTED',current_setting('v2_4.qa.owner')::uuid,current_setting('v2_4.qa.owner')::uuid);
  if (select payment_status from public.center_tuition_package_cycle_projection where id=v_cycle.id) <> 'PARTIAL' then
    raise exception 'v2_4_qa_posted_payment_projection_failed';
  end if;
  update public.finance_transaction set status='VOIDED',voided_at=clock_timestamp(),voided_by=current_setting('v2_4.qa.owner')::uuid,version=version+1,updated_by=current_setting('v2_4.qa.owner')::uuid where source_payment_id='v24-payment-1';
  if (select payment_status from public.center_tuition_package_cycle_projection where id=v_cycle.id) <> 'UNPAID' then
    raise exception 'v2_4_qa_void_payment_projection_failed';
  end if;
end
$$;

-- Physical security and immutable audit boundary.
do $$
declare v_force_count int; v_grant_count int;
begin
  select count(*) into v_force_count from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in (
    'center_tuition_package_cycles','center_tuition_attendance_contributions',
    'center_tuition_cycle_command_results','center_tuition_cycle_audit_events'
  ) and c.relrowsecurity and c.relforcerowsecurity;
  if v_force_count <> 4 then raise exception 'v2_4_qa_force_rls_failed'; end if;
  select count(*) into v_grant_count from information_schema.role_table_grants
  where table_schema='public' and table_name in (
    'center_tuition_package_cycles','center_tuition_attendance_contributions',
    'center_tuition_cycle_command_results','center_tuition_cycle_audit_events'
  ) and grantee in ('anon','authenticated');
  if v_grant_count <> 0 then raise exception 'v2_4_qa_browser_table_grant_leak'; end if;
  if has_sequence_privilege('authenticated','public.center_tuition_cycle_audit_events_id_seq','USAGE')
     or has_sequence_privilege('authenticated','public.center_tuition_cycle_audit_events_id_seq','UPDATE') then
    raise exception 'v2_4_qa_audit_sequence_grant_leak';
  end if;
  if has_table_privilege('service_role','public.center_tuition_cycle_audit_events','UPDATE')
     or has_table_privilege('service_role','public.center_tuition_cycle_audit_events','DELETE')
     or has_table_privilege('service_role','public.center_tuition_cycle_audit_events','TRUNCATE') then
    raise exception 'v2_4_qa_audit_not_append_only';
  end if;
  if exists (select 1 from public.center_tuition_cycle_audit_events
    where center_id='v24_qa_a' and (coalesce(before_state,'{}'::jsonb)::text || coalesce(after_state,'{}'::jsonb)::text) ~* '(password|token|secret)') then
    raise exception 'v2_4_qa_audit_secret_leak';
  end if;
end
$$;

rollback;
