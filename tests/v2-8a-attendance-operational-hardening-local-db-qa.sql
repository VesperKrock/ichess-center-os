begin;

do $$
declare
  v_force integer;
  v_browser_grants integer;
begin
  select count(*) into v_force
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'center_attendance_cycle_checkpoints',
      'center_attendance_occurrence_notes',
      'center_attendance_operation_command_results',
      'center_attendance_operation_audit_events'
    )
    and c.relrowsecurity and c.relforcerowsecurity;
  if v_force <> 4 then raise exception 'v2_8a_qa_force_rls_failed'; end if;

  select count(*) into v_browser_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'center_attendance_cycle_checkpoints',
      'center_attendance_occurrence_notes',
      'center_attendance_operation_command_results',
      'center_attendance_operation_audit_events'
    )
    and grantee in ('anon', 'authenticated');
  if v_browser_grants <> 0 then raise exception 'v2_8a_qa_browser_table_grant_leak'; end if;
  if not has_function_privilege('authenticated', 'public.v2_8a_list_attendance_operations(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.v2_8a_mutate_attendance_operation(text,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.v2_8a_mutate_attendance_operation(text,jsonb,uuid)', 'EXECUTE') then
    raise exception 'v2_8a_qa_rpc_acl_failed';
  end if;
end
$$;

insert into auth.users(id, aud, role, created_at, updated_at) values
  ('28000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', clock_timestamp(), clock_timestamp()),
  ('28000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', clock_timestamp(), clock_timestamp()),
  ('28000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', clock_timestamp(), clock_timestamp()),
  ('28000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', clock_timestamp(), clock_timestamp());

select set_config('v2_8a.qa.owner', '28000000-0000-4000-8000-000000000001', true);
select set_config('v2_8a.qa.admin', '28000000-0000-4000-8000-000000000002', true);
select set_config('v2_8a.qa.teacher', '28000000-0000-4000-8000-000000000003', true);
select set_config('v2_8a.qa.other', '28000000-0000-4000-8000-000000000004', true);

insert into public.centers(id, name, environment, status) values
  ('v28a_qa_a', 'V2-8A QA A', 'test', 'active'),
  ('v28a_qa_b', 'V2-8A QA B', 'test', 'active');

insert into public.center_members(center_id, user_id, role, status) values
  ('v28a_qa_a', current_setting('v2_8a.qa.owner')::uuid, 'owner', 'active'),
  ('v28a_qa_a', current_setting('v2_8a.qa.admin')::uuid, 'center_admin', 'active'),
  ('v28a_qa_a', current_setting('v2_8a.qa.teacher')::uuid, 'teacher', 'active'),
  ('v28a_qa_b', current_setting('v2_8a.qa.other')::uuid, 'owner', 'active');

insert into public.center_cloud_entities(
  center_id, entity_type, local_id, payload, source_module, source_version,
  entity_version, created_by, updated_by
) values
  ('v28a_qa_a', 'student', 'v28a_student',
    jsonb_build_object('id', 'v28a_student', 'fullName', 'Attendance QA Student'),
    'v2.8a-qa', 'v2.8a-qa', 1,
    current_setting('v2_8a.qa.owner')::uuid, current_setting('v2_8a.qa.owner')::uuid),
  ('v28a_qa_b', 'student', 'v28a_other_student',
    jsonb_build_object('id', 'v28a_other_student', 'fullName', 'Other Center Student'),
    'v2.8a-qa', 'v2.8a-qa', 1,
    current_setting('v2_8a.qa.other')::uuid, current_setting('v2_8a.qa.other')::uuid);

insert into public.center_tuition_package_catalog(
  id, center_id, package_name, total_sessions, default_amount, is_active,
  note, created_by_membership_id, updated_by_membership_id
)
select
  '28000000-0000-4000-8000-000000000010', 'v28a_qa_a', 'Gói QA 8', 8,
  800000, true, '', member.id, member.id
from public.center_members member
where member.center_id = 'v28a_qa_a'
  and member.user_id = current_setting('v2_8a.qa.owner')::uuid;

insert into public.center_tuition_package_cycles(
  id, center_id, student_local_id, tuition_local_id, cycle_number,
  package_catalog_id, package_name_snapshot, total_sessions_snapshot,
  price_snapshot, payment_period_id, baseline_used_sessions, baseline_cutoff_date,
  baseline_review_note, lifecycle_status, origin, created_by, updated_by
) values (
  '28000000-0000-4000-8000-000000000020', 'v28a_qa_a', 'v28a_student',
  'tuition_record_package::v28a_student', 1,
  '28000000-0000-4000-8000-000000000010', 'Gói QA 8', 8,
  800000, 'v28a-period-1', 3, '2026-09-01',
  'Đã đối chiếu dữ liệu nền đến N-5', 'ACTIVE', 'OPERATOR_BASELINE',
  current_setting('v2_8a.qa.owner')::uuid, current_setting('v2_8a.qa.owner')::uuid
);

insert into public.center_cloud_entities(
  center_id, entity_type, local_id, payload, source_module, source_version,
  entity_version, created_by, updated_by
)
select
  'v28a_qa_a', 'schedule_session', fixture.local_id,
  jsonb_build_object(
    'id', fixture.local_id,
    'scheduleType', 'oneOff',
    'date', fixture.occurrence_date,
    'studentIds', jsonb_build_array('v28a_student')
  ),
  'v2.8a-qa', 'v2.8a-qa', 1,
  current_setting('v2_8a.qa.owner')::uuid, current_setting('v2_8a.qa.owner')::uuid
from (values
  ('v28a_sched_absent', '2026-09-02'),
  ('v28a_sched_trial', '2026-09-03'),
  ('v28a_sched_present_n4', '2026-09-04'),
  ('v28a_sched_makeup', '2026-09-05'),
  ('v28a_sched_present_n2', '2026-09-06'),
  ('v28a_sched_present_n1', '2026-09-07'),
  ('v28a_sched_present_n', '2026-09-08'),
  ('v28a_sched_rollover', '2026-09-09')
) fixture(local_id, occurrence_date);

create function pg_temp.v28a_record_attendance(
  p_schedule_session_id text,
  p_occurrence_date date,
  p_status text,
  p_idempotency_key uuid
)
returns void
language plpgsql
as $$
declare v_result jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'v28a_qa_a', p_schedule_session_id, p_occurrence_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', 'v28a_student',
      'source', 'admin',
      'attendance_status', p_status,
      'payload', jsonb_build_object(
        'note', case when p_status = 'makeup' then 'Bù theo xác nhận phụ huynh' else '' end,
        'makeupReason', case when p_status = 'makeup' then 'Bù theo xác nhận phụ huynh' else '' end
      ),
      'expected_records', '[]'::jsonb
    )),
    null,
    p_idempotency_key
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'v2_8a_qa_attendance_write_failed_%', p_status;
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);

-- N-5 and non-consuming statuses must not activate N-4 or change package usage.
select pg_temp.v28a_record_attendance(
  'v28a_sched_absent', '2026-09-02', 'absent',
  '28000000-0000-4000-8000-000000000101'
);
select pg_temp.v28a_record_attendance(
  'v28a_sched_trial', '2026-09-03', 'trial',
  '28000000-0000-4000-8000-000000000102'
);
do $$
declare v_snapshot jsonb;
begin
  v_snapshot := public.v2_8a_list_attendance_operations('v28a_qa_a');
  if jsonb_array_length(v_snapshot->'reminders') <> 0
     or (select (student->'current_cycle'->>'remaining_sessions')::integer
         from jsonb_array_elements(public.v2_4_list_package_cycle_state('v28a_qa_a')->'students') student
         where student->>'student_id' = 'v28a_student') <> 5 then
    raise exception 'v2_8a_qa_n5_or_non_consuming_failed';
  end if;
end
$$;

-- N-4 begins review/comment reminder at the exact consuming occurrence.
select pg_temp.v28a_record_attendance(
  'v28a_sched_present_n4', '2026-09-04', 'present',
  '28000000-0000-4000-8000-000000000103'
);
do $$
declare v_snapshot jsonb;
begin
  v_snapshot := public.v2_8a_list_attendance_operations('v28a_qa_a');
  if jsonb_array_length(v_snapshot->'reminders') <> 1
     or v_snapshot->'reminders'->0->>'signal' <> 'REVIEW_UPDATE_DUE'
     or v_snapshot->'reminders'->0->>'trigger_date' <> '2026-09-04'
     or (v_snapshot->'reminders'->0->>'remaining_sessions')::integer <> 4 then
    raise exception 'v2_8a_qa_n4_failed';
  end if;
end
$$;

-- Makeup consumes one; N-3 keeps review outstanding and retains reason evidence.
select pg_temp.v28a_record_attendance(
  'v28a_sched_makeup', '2026-09-05', 'makeup',
  '28000000-0000-4000-8000-000000000104'
);
reset role;
do $$
begin
  if (select remaining_sessions from public.center_tuition_package_cycle_projection
      where id = '28000000-0000-4000-8000-000000000020') <> 3
     or not exists (
       select 1 from public.center_tuition_attendance_contributions
       where center_id = 'v28a_qa_a'
         and schedule_session_local_id = 'v28a_sched_makeup'
         and contribution_units = 1
         and makeup_reason_snapshot = 'Bù theo xác nhận phụ huynh'
     )
     or (select count(*) from public.center_attendance_operational_reminder_projection
         where center_id = 'v28a_qa_a') <> 1 then
    raise exception 'v2_8a_qa_n3_or_makeup_failed';
  end if;
end
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);

-- N-2 adds TBHP. Owner/Admin read identical business signals.
select pg_temp.v28a_record_attendance(
  'v28a_sched_present_n2', '2026-09-06', 'present',
  '28000000-0000-4000-8000-000000000105'
);
do $$
declare v_owner jsonb; v_admin jsonb;
begin
  v_owner := public.v2_8a_list_attendance_operations('v28a_qa_a');
  perform set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.admin'), true);
  v_admin := public.v2_8a_list_attendance_operations('v28a_qa_a');
  if v_owner->'reminders' <> v_admin->'reminders'
     or (select count(*) from jsonb_array_elements(v_owner->'reminders') r
         where r->>'signal' in ('REVIEW_UPDATE_DUE', 'TBHP_SEND_DUE')) <> 2
     or (select r->>'trigger_date' from jsonb_array_elements(v_owner->'reminders') r
         where r->>'signal' = 'TBHP_SEND_DUE') <> '2026-09-06' then
    raise exception 'v2_8a_qa_n2_or_owner_admin_parity_failed';
  end if;
end
$$;

-- Admin explicit TBHP completion is authoritative and idempotent.
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.admin'), true);
do $$
declare v_result jsonb; v_retry jsonb;
begin
  v_result := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'MARK_TBHP_SENT',
      'cycle_id', '28000000-0000-4000-8000-000000000020',
      'expected_version', 0
    ),
    '28000000-0000-4000-8000-000000000201'
  );
  v_retry := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'MARK_TBHP_SENT',
      'cycle_id', '28000000-0000-4000-8000-000000000020',
      'expected_version', 0
    ),
    '28000000-0000-4000-8000-000000000201'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or not coalesce((v_retry->>'replayed')::boolean, false)
     or exists (select 1
       from jsonb_array_elements(public.v2_8a_list_attendance_operations('v28a_qa_a')->'reminders') reminder
       where reminder->>'signal' = 'TBHP_SEND_DUE') then
    raise exception 'v2_8a_qa_tbhp_completion_failed';
  end if;
end
$$;

-- N-1 and exhausted retain review without recreating TBHP.
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);
select pg_temp.v28a_record_attendance(
  'v28a_sched_present_n1', '2026-09-07', 'present',
  '28000000-0000-4000-8000-000000000106'
);
do $$ begin
  if (select (student->'current_cycle'->>'remaining_sessions')::integer
      from jsonb_array_elements(public.v2_4_list_package_cycle_state('v28a_qa_a')->'students') student
      where student->>'student_id' = 'v28a_student') <> 1
     or jsonb_array_length(public.v2_8a_list_attendance_operations('v28a_qa_a')->'reminders') <> 1 then
    raise exception 'v2_8a_qa_n1_failed';
  end if;
end $$;
select pg_temp.v28a_record_attendance(
  'v28a_sched_present_n', '2026-09-08', 'present',
  '28000000-0000-4000-8000-000000000107'
);
do $$ begin
  if (select (student->'current_cycle'->>'remaining_sessions')::integer
      from jsonb_array_elements(public.v2_4_list_package_cycle_state('v28a_qa_a')->'students') student
      where student->>'student_id' = 'v28a_student') <> 0
     or (select count(*)
         from jsonb_array_elements(public.v2_8a_list_attendance_operations('v28a_qa_a')->'reminders') reminder
         where reminder->>'signal' = 'REVIEW_UPDATE_DUE') <> 1 then
    raise exception 'v2_8a_qa_exhausted_failed';
  end if;
end $$;

-- First consuming attendance creates the frozen V2-4 provisional cycle;
-- V2-8A only derives a payment check and never creates Finance truth.
select pg_temp.v28a_record_attendance(
  'v28a_sched_rollover', '2026-09-09', 'present',
  '28000000-0000-4000-8000-000000000108'
);
reset role;
do $$
begin
  if not exists (
    select 1 from public.center_tuition_package_cycle_projection
    where center_id = 'v28a_qa_a' and student_local_id = 'v28a_student'
      and cycle_number = 2 and origin = 'AUTOMATIC_ROLLOVER'
      and lifecycle_status = 'PROVISIONAL_UNPAID' and used_sessions = 1
      and payment_status = 'UNPAID'
  )
  or not exists (
    select 1 from public.center_attendance_operational_reminder_projection
    where center_id = 'v28a_qa_a' and cycle_number = 2
      and signal = 'PAYMENT_CHECK_DUE' and trigger_date = '2026-09-09'
  )
  or exists (
    select 1 from public.finance_transaction
    where center_id = 'v28a_qa_a'
  ) then
    raise exception 'v2_8a_qa_rollover_payment_check_failed';
  end if;
end
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);

-- Existing C5.7 authoritative review completion clears review only.
do $$
declare v_result jsonb;
begin
  v_result := public.c5_7_mutate_calendar_notes_shared_truth(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'UPSERT_ATTENDANCE_ADVISORY_NOTE',
      'expected_version', 0,
      'note_id', '28000000-0000-4000-8000-000000000301',
      'student_local_id', 'v28a_student',
      'month_key', '2026-09',
      'care_status', 'sentComment',
      'note', 'Đã cập nhật nhận xét cho chu kỳ'
    ),
    '28000000-0000-4000-8000-000000000302'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or exists (select 1
       from jsonb_array_elements(public.v2_8a_list_attendance_operations('v28a_qa_a')->'reminders') reminder
       where reminder->>'signal' = 'REVIEW_UPDATE_DUE')
     or not exists (select 1
       from jsonb_array_elements(public.v2_8a_list_attendance_operations('v28a_qa_a')->'reminders') reminder
       where reminder->>'signal' = 'PAYMENT_CHECK_DUE') then
    raise exception 'v2_8a_qa_review_completion_failed';
  end if;
end
$$;

-- Per-cell notes are exact-occurrence facts and never mutate attendance state.
reset role;
select set_config('v2_8a.qa.attendance_before', (
  select jsonb_build_object('payload', payload, 'version', entity_version)::text
  from public.center_cloud_entities
  where center_id = 'v28a_qa_a' and entity_type = 'attendance_record'
    and payload->>'scheduleSessionId' = 'v28a_sched_absent'
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);
do $$
declare
  v_result jsonb;
begin
  v_result := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'UPSERT_CELL_NOTE',
      'note_id', null,
      'expected_version', 0,
      'student_id', 'v28a_student',
      'schedule_session_id', 'v28a_sched_absent',
      'occurrence_date', '2026-09-02',
      'note', 'Phụ huynh đã báo vắng'
    ),
    '28000000-0000-4000-8000-000000000401'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or v_result->'entity'->>'schedule_session_id' <> 'v28a_sched_absent'
     or v_result->'entity'->>'occurrence_date' <> '2026-09-02' then
    raise exception 'v2_8a_qa_cell_note_create_or_attendance_immutability_failed';
  end if;
end
$$;
reset role;
do $$
declare v_after jsonb;
begin
  select jsonb_build_object('payload', payload, 'version', entity_version)
    into v_after
  from public.center_cloud_entities
  where center_id = 'v28a_qa_a' and entity_type = 'attendance_record'
    and payload->>'scheduleSessionId' = 'v28a_sched_absent';
  if current_setting('v2_8a.qa.attendance_before')::jsonb <> v_after
     or not exists (
       select 1 from public.center_attendance_occurrence_notes
       where center_id = 'v28a_qa_a'
         and student_local_id = 'v28a_student'
         and schedule_session_local_id = 'v28a_sched_absent'
         and occurrence_date = '2026-09-02'
         and note = 'Phụ huynh đã báo vắng'
     ) then
    raise exception 'v2_8a_qa_cell_note_persistence_or_attendance_immutability_failed';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.admin'), true);
do $$
declare v_snapshot jsonb; v_note jsonb; v_result jsonb;
begin
  v_snapshot := public.v2_8a_list_attendance_operations('v28a_qa_a');
  select item into v_note
  from jsonb_array_elements(v_snapshot->'cell_notes') item
  where item->>'schedule_session_id' = 'v28a_sched_absent';
  v_result := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'UPSERT_CELL_NOTE',
      'note_id', v_note->>'id',
      'expected_version', (v_note->>'version')::integer,
      'student_id', 'v28a_student',
      'schedule_session_id', 'v28a_sched_absent',
      'occurrence_date', '2026-09-02',
      'note', 'Phụ huynh xác nhận vắng có phép'
    ),
    '28000000-0000-4000-8000-000000000402'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or (v_result->'entity'->>'version')::integer <> 2 then
    raise exception 'v2_8a_qa_admin_cell_note_edit_failed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.owner'), true);
do $$
declare v_result jsonb;
begin
  v_result := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_a',
    jsonb_build_object(
      'operation', 'UPSERT_CELL_NOTE',
      'note_id', null,
      'expected_version', 0,
      'student_id', 'v28a_student',
      'schedule_session_id', 'v28a_sched_makeup',
      'occurrence_date', '2026-09-05',
      'note', 'Buổi bù theo lịch ngoại lệ'
    ),
    '28000000-0000-4000-8000-000000000403'
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'v2_8a_qa_makeup_note_failed';
  end if;
end
$$;

-- Cross-center and non-operator access fail closed; no stale center data leaks.
do $$
declare v_result jsonb;
begin
  v_result := public.v2_8a_list_attendance_operations('v28a_qa_b');
  if v_result->>'outcome_code' <> 'CENTER_ACCESS_DENIED' or v_result ? 'cell_notes' then
    raise exception 'v2_8a_qa_cross_center_read_leak';
  end if;
  v_result := public.v2_8a_mutate_attendance_operation(
    'v28a_qa_b',
    jsonb_build_object(
      'operation', 'UPSERT_CELL_NOTE', 'note_id', null, 'expected_version', 0,
      'student_id', 'v28a_student', 'schedule_session_id', 'v28a_sched_absent',
      'occurrence_date', '2026-09-02', 'note', 'must fail'
    ),
    '28000000-0000-4000-8000-000000000404'
  );
  if v_result->>'outcome_code' <> 'CENTER_ACCESS_DENIED' then
    raise exception 'v2_8a_qa_cross_center_write_leak';
  end if;
  perform set_config('request.jwt.claim.sub', current_setting('v2_8a.qa.teacher'), true);
  v_result := public.v2_8a_list_attendance_operations('v28a_qa_a');
  if v_result->>'outcome_code' <> 'CENTER_ACCESS_DENIED' then
    raise exception 'v2_8a_qa_teacher_access_accepted';
  end if;
end
$$;

do $$
begin
  insert into public.center_attendance_occurrence_notes(
    center_id, student_local_id, schedule_session_local_id, occurrence_date,
    note, created_by_user_id, created_by_membership_id, created_by_role,
    updated_by_user_id, updated_by_membership_id, updated_by_role
  ) select
    'v28a_qa_a', 'x', 'x', '2026-09-10', 'must fail',
    current_setting('v2_8a.qa.teacher')::uuid, member.id, 'teacher',
    current_setting('v2_8a.qa.teacher')::uuid, member.id, 'teacher'
  from public.center_members member
  where member.center_id = 'v28a_qa_a'
    and member.user_id = current_setting('v2_8a.qa.teacher')::uuid;
  raise exception 'v2_8a_qa_direct_browser_dml_accepted';
exception when insufficient_privilege then null;
end
$$;

reset role;

-- Finance POSTED is the only payment completion and clears the signal.
do $$
declare
  v_category uuid;
  v_cycle public.center_tuition_package_cycles;
begin
  select * into v_cycle
  from public.center_tuition_package_cycles
  where center_id = 'v28a_qa_a' and student_local_id = 'v28a_student' and cycle_number = 2;
  insert into public.finance_category(center_id, name, category_type, created_by, updated_by)
  values (
    'v28a_qa_a', 'Học phí V2-8A QA', 'INCOME',
    current_setting('v2_8a.qa.owner')::uuid, current_setting('v2_8a.qa.owner')::uuid
  ) returning id into v_category;
  insert into public.finance_transaction(
    center_id, transaction_code, cashflow_type, category_id, category_name_snapshot,
    amount_minor, transaction_date, method, source_module, source_type,
    source_payment_id, source_tuition_id, source_student_id, source_period_id,
    status, created_by, updated_by
  ) values (
    'v28a_qa_a', 'TC-20260914-2801', 'INCOME', v_category, 'Học phí V2-8A QA',
    800000, '2026-09-14', 'cash', 'hoc-phi', 'tuition-payment',
    'v28a-payment-1', v_cycle.tuition_local_id, v_cycle.student_local_id,
    v_cycle.payment_period_id, 'POSTED',
    current_setting('v2_8a.qa.owner')::uuid, current_setting('v2_8a.qa.owner')::uuid
  );
  if (select payment_status from public.center_tuition_package_cycle_projection where id = v_cycle.id) <> 'PAID'
     or exists (
       select 1 from public.center_attendance_operational_reminder_projection
       where center_id = 'v28a_qa_a' and signal = 'PAYMENT_CHECK_DUE'
     ) then
    raise exception 'v2_8a_qa_posted_payment_did_not_clear';
  end if;
  update public.finance_transaction
  set status = 'VOIDED', voided_at = clock_timestamp(),
      voided_by = current_setting('v2_8a.qa.owner')::uuid,
      updated_by = current_setting('v2_8a.qa.owner')::uuid,
      version = version + 1
  where center_id = 'v28a_qa_a' and source_payment_id = 'v28a-payment-1';
  if not exists (
    select 1 from public.center_attendance_operational_reminder_projection
    where center_id = 'v28a_qa_a' and signal = 'PAYMENT_CHECK_DUE'
  ) then
    raise exception 'v2_8a_qa_voided_payment_authority_failed';
  end if;
end
$$;

do $$
begin
  if (select count(*) from public.center_attendance_cycle_checkpoints where center_id = 'v28a_qa_a') <> 1
     or (select count(*) from public.center_attendance_occurrence_notes where center_id = 'v28a_qa_a') <> 2
     or (select count(*) from public.center_attendance_operation_audit_events where center_id = 'v28a_qa_a') <> 4
     or (select count(*) from public.center_attendance_operation_command_results where center_id = 'v28a_qa_a') <> 4 then
    raise exception 'v2_8a_qa_audit_or_command_evidence_failed';
  end if;
end
$$;

\echo V2_8A_LOCAL_DB_TRANSACTIONAL_QA: PASS
rollback;
