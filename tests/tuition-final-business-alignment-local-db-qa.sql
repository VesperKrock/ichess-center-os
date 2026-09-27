begin;

select pg_catalog.set_config('request.jwt.claims',
  (select pg_catalog.jsonb_build_object('sub', member.user_id, 'role', 'service_role')::text
   from public.center_members member
   where member.status = 'active'
   order by case when member.role = 'owner' then 0 else 1 end, member.created_at
   limit 1),
  true
);

create function pg_temp.tuition_final_add_attendance(
  p_center_id text,
  p_student_id text,
  p_schedule_id text,
  p_date date,
  p_status text,
  p_teacher text
) returns void
language plpgsql
as $function$
declare
  v_actor uuid := auth.uid();
  v_attendance_id text := public.v2_3_internal_occurrence_attendance_local_id(
    p_center_id, p_schedule_id, p_date, p_student_id
  );
begin
  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values (
    p_center_id, 'schedule_session', p_schedule_id,
    pg_catalog.jsonb_build_object(
      'id', p_schedule_id, 'date', p_date, 'scheduleType', 'oneOff',
      'teacherName', p_teacher, 'studentIds', pg_catalog.jsonb_build_array(p_student_id)
    ),
    'tuition-final-qa', 'v1', 1, v_actor, v_actor
  );
  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values (
    p_center_id, 'attendance_record', v_attendance_id,
    pg_catalog.jsonb_build_object(
      'id', v_attendance_id, 'authorityLocalId', v_attendance_id,
      'attendanceAuthority', 'v2.3-occurrence-v1',
      'studentId', p_student_id, 'date', p_date,
      'scheduleSessionId', p_schedule_id, 'sessionId', p_schedule_id,
      'source', 'admin', 'attendanceStatus', p_status, 'status', p_status,
      'teacherName', p_teacher, 'note', case when p_status = 'makeup' then 'Bù cho buổi vắng' else '' end,
      'makeupReason', case when p_status = 'makeup' then 'Bù cho buổi vắng' else '' end,
      'tuitionPolicyDefined', false, 'tuitionAutoUpdateEnabled', false,
      'tuitionConsumptionApplied', false, 'countsTowardTuition', false,
      'counted', false, 'creditValue', 0
    ),
    'tuition-final-qa', 'v1', 1, v_actor, v_actor
  );
end
$function$;

do $qa$
declare
  v_owner uuid := auth.uid();
  v_member constant uuid := '27092700-0000-4000-8000-000000000101';
  v_package_16 constant uuid := '27092700-0000-4000-8000-000000000102';
  v_package_20 constant uuid := '27092700-0000-4000-8000-000000000103';
  v_category uuid;
  v_profile public.center_operational_profiles;
  v_legacy_paid public.center_tuition_package_cycles;
  v_legacy_unpaid public.center_tuition_package_cycles;
  v_new public.center_tuition_package_cycles;
  v_debt_cycle_1 public.center_tuition_package_cycles;
  v_debt_cycle_2 public.center_tuition_package_cycles;
  v_end_cycle public.center_tuition_package_cycles;
  v_result jsonb;
  v_document jsonb;
  v_finance jsonb;
  v_payment jsonb;
  v_before_finance integer;
  v_index integer;
begin
  if v_owner is null or not exists (select 1 from auth.users where id = v_owner) then
    raise exception 'TUITION FINAL QA owner fixture missing';
  end if;

  insert into public.centers(id, name, environment, status)
    values ('tuition_final_alignment_qa', 'Tuition Final Alignment QA', 'test', 'active');
  insert into public.center_members(id, center_id, user_id, role, status)
    values (v_member, 'tuition_final_alignment_qa', v_owner, 'owner', 'active');
  update public.center_operational_profiles
  set display_name = 'Tuition Final Alignment QA', address = 'QA', phone = '0900000000',
      receipt_prefix = 'TFQ', renewal_material_fee_minor = 0,
      default_receipt_collector_name = 'Admin QA'
  where center_id = 'tuition_final_alignment_qa';
  select id into strict v_category
  from public.finance_category
  where center_id = 'tuition_final_alignment_qa'
    and name = 'Học phí' and not is_archived;

  select * into strict v_profile from public.center_operational_profiles
  where center_id = 'tuition_final_alignment_qa';
  v_result := public.v2_1_mutate_center_settings('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'UPDATE_CENTER_PROFILE', 'expected_version', v_profile.version,
      'display_name', v_profile.display_name, 'address', v_profile.address,
      'phone', v_profile.phone, 'note', v_profile.note,
      'renewal_material_fee_minor', v_profile.renewal_material_fee_minor,
      'receipt_prefix', v_profile.receipt_prefix,
      'default_receipt_collector_name', v_profile.default_receipt_collector_name,
      'initial_student_setup_enabled', true
    ), '27092700-0000-4000-8000-000000000109');
  if v_result->>'ok' <> 'true'
     or public.v2_1_list_center_settings('tuition_final_alignment_qa')
       #>>'{center,initial_student_setup_enabled}' <> 'true' then
    raise exception 'initial Student setup setting did not round-trip: %', v_result;
  end if;

  insert into public.center_tuition_package_catalog(
    id, center_id, package_name, program_name, total_sessions, default_amount,
    is_active, note, created_by_membership_id, updated_by_membership_id, max_completion_weeks
  ) values
    (v_package_16, 'tuition_final_alignment_qa', 'Gói 16 buổi', 'Cờ vua', 16, 1600000,
      true, '', v_member, v_member, 9),
    (v_package_20, 'tuition_final_alignment_qa', 'Gói 20 buổi', 'Cờ vua', 20, 2000000,
      true, '', v_member, v_member, 12);

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  )
  select 'tuition_final_alignment_qa', 'student', student_id,
    pg_catalog.jsonb_build_object('id', student_id, 'fullName', student_name),
    'tuition-final-qa', 'v1', 1, v_owner, v_owner
  from (values
    ('legacy_paid', 'Legacy đã thanh toán'),
    ('legacy_unpaid', 'Legacy chưa thanh toán'),
    ('new_student', 'Học viên mới'),
    ('debt_student', 'Học viên học nợ'),
    ('end_student', 'Học viên kết thúc sớm')
  ) fixture(student_id, student_name);

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  )
  select 'tuition_final_alignment_qa', 'tuition_record_package',
    'tuition_record_package::' || student_id,
    pg_catalog.jsonb_build_object(
      'id', student_id, 'studentId', student_id, 'packageCatalogId', v_package_16,
      'packageName', 'Gói 16 buổi', 'programName', 'Cờ vua',
      'currentTermId', student_id || '_period_1', 'currentTermNumber', 1,
      'totalSessions', 16, 'usedSessions', 0, 'totalAmount', 1600000,
      'paidAmount', 0, 'discountType', 'none', 'discountValue', 0,
      'discountAmount', 0, 'payments', '[]'::jsonb, 'termHistory', '[]'::jsonb
    ),
    'tuition-final-qa', 'v1', 1, v_owner, v_owner
  from (values ('legacy_paid'), ('legacy_unpaid'), ('new_student'), ('debt_student'), ('end_student')) fixture(student_id);

  -- Story 1: explicit legacy paid opening state is Kỳ 1, without fake money.
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'START_CYCLE', 'student_id', 'legacy_paid',
      'tuition_local_id', 'tuition_record_package::legacy_paid',
      'package_catalog_id', v_package_16, 'baseline_used_sessions', 6,
      'baseline_cutoff_date', '2026-08-31', 'baseline_review_note', '6 buổi trước iChess',
      'opening_context', 'LEGACY_BEFORE_ICHESS',
      'opening_payment_state', 'PAID_BEFORE_ICHESS'
    ), '27092700-0000-4000-8000-000000000110');
  if v_result->>'ok' <> 'true' then raise exception 'legacy paid start failed: %', v_result; end if;
  select * into strict v_legacy_paid from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'legacy_paid' and cycle_number = 1;
  if v_legacy_paid.cycle_number <> 1
     or (select used_sessions from public.center_tuition_package_cycle_projection where id = v_legacy_paid.id) <> 6
     or (select payment_status from public.center_tuition_package_cycle_projection where id = v_legacy_paid.id) <> 'PAID'
     or exists (select 1 from public.finance_transaction where center_id = 'tuition_final_alignment_qa')
     or exists (select 1 from public.center_tuition_receipts where center_id = 'tuition_final_alignment_qa') then
    raise exception 'legacy paid opening truth fabricated or projected incorrectly';
  end if;
  begin
    perform public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
      pg_catalog.jsonb_build_object(
        'operation', 'SELECT_PROVISIONAL_PACKAGE', 'student_id', 'legacy_paid',
        'cycle_id', v_legacy_paid.id, 'expected_version', v_legacy_paid.version,
        'package_catalog_id', v_package_20
      ), '27092700-0000-4000-8000-000000000117');
    raise exception 'legacy package change after opening attendance was accepted';
  exception when others then
    if sqlerrm = 'legacy package change after opening attendance was accepted'
       or pg_catalog.strpos(sqlerrm, 'tuition_final_package_terms_locked') = 0 then raise; end if;
  end;
  v_result := public.tbhp_get_printable_document('tuition_final_alignment_qa', v_legacy_paid.id);
  v_document := v_result#>'{document,snapshot}';
  if v_result->>'outcome_code' <> 'PRINTABLE_DOCUMENT'
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where (row->>'sessionNumber')::integer <= 6 and row->>'source' = 'LEGACY_UNKNOWN') <> 6
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where (row->>'sessionNumber')::integer > 6 and row->>'source' = 'UNRESOLVED'
           and row->>'date' is null and row->>'teacherName' = '') <> 10 then
    raise exception 'legacy 6/16 TBHP rows failed: %', v_result;
  end if;

  -- Story 2: explicit legacy unpaid truth is not inferred from Finance.
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'START_CYCLE', 'student_id', 'legacy_unpaid',
      'tuition_local_id', 'tuition_record_package::legacy_unpaid',
      'package_catalog_id', v_package_16, 'baseline_used_sessions', 6,
      'baseline_cutoff_date', '2026-08-31', 'baseline_review_note', '6 buổi trước iChess',
      'opening_context', 'LEGACY_BEFORE_ICHESS', 'opening_payment_state', 'UNPAID'
    ), '27092700-0000-4000-8000-000000000111');
  if v_result->>'ok' <> 'true' then raise exception 'legacy unpaid start failed: %', v_result; end if;
  select * into strict v_legacy_unpaid from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'legacy_unpaid' and cycle_number = 1;
  if (select used_sessions from public.center_tuition_package_cycle_projection where id = v_legacy_unpaid.id) <> 6
     or (select payment_status from public.center_tuition_package_cycle_projection where id = v_legacy_unpaid.id) <> 'UNPAID' then
    raise exception 'legacy unpaid opening truth failed';
  end if;

  -- Story 3: every new iChess Student starts at Kỳ 1 · 0/N.
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'START_CYCLE', 'student_id', 'new_student',
      'tuition_local_id', 'tuition_record_package::new_student',
      'package_catalog_id', v_package_16, 'baseline_used_sessions', 0,
      'baseline_cutoff_date', '2026-08-31', 'baseline_review_note', 'Bắt đầu dùng iChess',
      'opening_context', 'NEW_ICHESS', 'opening_payment_state', 'UNPAID'
    ), '27092700-0000-4000-8000-000000000112');
  if v_result->>'ok' <> 'true' then raise exception 'new student start failed: %', v_result; end if;
  select * into strict v_new from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'new_student' and cycle_number = 1;
  if v_new.cycle_number <> 1
     or (select used_sessions from public.center_tuition_package_cycle_projection where id = v_new.id) <> 0 then
    raise exception 'new Student did not start at Kỳ 1 · 0/16';
  end if;
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'SELECT_PROVISIONAL_PACKAGE', 'student_id', 'new_student',
      'cycle_id', v_new.id, 'expected_version', v_new.version,
      'package_catalog_id', v_package_20
    ), '27092700-0000-4000-8000-000000000118');
  if v_result->>'ok' <> 'true'
     or not exists (select 1 from public.center_tuition_package_cycles
       where id = v_new.id and lifecycle_status = 'ACTIVE'
         and total_sessions_snapshot = 20 and price_snapshot = 2000000) then
    raise exception 'new Kỳ 1 package could not change before first attendance: %', v_result;
  end if;

  -- Story 4 + 10: present +1, absent +0, makeup +1; correction/retry of
  -- one occurrence converges to one contribution. Actual teacher is frozen.
  perform pg_temp.tuition_final_add_attendance('tuition_final_alignment_qa', 'legacy_paid',
    'legacy_present', '2026-09-01', 'present', 'Thầy Cũ');
  perform pg_temp.tuition_final_add_attendance('tuition_final_alignment_qa', 'legacy_paid',
    'legacy_absent', '2026-09-02', 'absent', 'Thầy Vắng');
  perform pg_temp.tuition_final_add_attendance('tuition_final_alignment_qa', 'legacy_paid',
    'legacy_makeup', '2026-09-03', 'makeup', 'Cô Bù');
  perform public.v2_4_internal_reconcile_student('tuition_final_alignment_qa', 'legacy_paid', v_owner);
  if (select used_sessions from public.center_tuition_package_cycle_projection where id = v_legacy_paid.id) <> 8
     or (select coalesce(sum(contribution_units), 0) from public.center_tuition_attendance_contributions
         where center_id = 'tuition_final_alignment_qa' and student_local_id = 'legacy_paid' and ended_at is null) <> 2
     or (select count(*) from public.center_tuition_attendance_contributions
         where center_id = 'tuition_final_alignment_qa' and schedule_session_local_id = 'legacy_makeup'
           and ended_at is null) <> 1 then
    raise exception 'present/absent/makeup consumption or convergence failed';
  end if;
  update public.center_cloud_entities
  set payload = payload || pg_catalog.jsonb_build_object('teacherName', 'Thầy Mới'),
      entity_version = entity_version + 1, updated_at = pg_catalog.clock_timestamp()
  where center_id = 'tuition_final_alignment_qa' and entity_type = 'schedule_session'
    and local_id = 'legacy_present';
  v_result := public.tbhp_get_printable_document('tuition_final_alignment_qa', v_legacy_paid.id);
  v_document := v_result#>'{document,snapshot}';
  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
      where row->>'source' = 'ACTUAL' and row->>'date' = '2026-09-01'
        and row->>'teacherName' = 'Thầy Cũ') then
    raise exception 'TBHP rewrote the actual occurrence teacher from current schedule metadata';
  end if;
  for v_index in 1..6 loop
    perform pg_temp.tuition_final_add_attendance('tuition_final_alignment_qa', 'legacy_paid',
      'legacy_extra_' || v_index, date '2026-09-03' + v_index, 'present', 'Thầy Thật');
  end loop;
  select count(*) into v_before_finance from public.finance_transaction
  where center_id = 'tuition_final_alignment_qa';
  v_result := public.tbhp_get_printable_document('tuition_final_alignment_qa', v_legacy_paid.id);
  v_document := v_result#>'{document,snapshot}';
  if (v_document#>>'{currentProgress,usedSessions}')::integer <> 14
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source' = 'LEGACY_UNKNOWN') <> 6
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source' = 'ACTUAL') <> 8
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source' = 'UNRESOLVED') <> 2
     or (select count(*) from public.finance_transaction where center_id = 'tuition_final_alignment_qa') <> v_before_finance then
    raise exception 'N-2 TBHP reminder-only/Finance-neutral proof failed: %', v_result;
  end if;

  -- Stories 5–7: Kỳ 2 defaults to the prior package, may change before its
  -- first attendance, freezes afterward, and accepts one exact full payment.
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'START_CYCLE', 'student_id', 'debt_student',
      'tuition_local_id', 'tuition_record_package::debt_student',
      'package_catalog_id', v_package_16, 'baseline_used_sessions', 0,
      'baseline_cutoff_date', '2026-08-31', 'baseline_review_note', 'Bắt đầu dùng iChess',
      'opening_context', 'NEW_ICHESS', 'opening_payment_state', 'UNPAID'
    ), '27092700-0000-4000-8000-000000000113');
  if v_result->>'ok' <> 'true' then raise exception 'debt cycle start failed: %', v_result; end if;
  select * into strict v_debt_cycle_1 from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'debt_student' and cycle_number = 1;
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'debt_student',
      'current_cycle_id', v_debt_cycle_1.id, 'expected_version', v_debt_cycle_1.version,
      'package_catalog_id', v_package_16
    ), '27092700-0000-4000-8000-000000000114');
  if v_result->>'ok' <> 'true' then raise exception 'default next cycle failed: %', v_result; end if;
  select * into strict v_debt_cycle_2 from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'debt_student' and cycle_number = 2;
  if v_debt_cycle_2.package_catalog_id <> v_package_16 or v_debt_cycle_2.total_sessions_snapshot <> 16 then
    raise exception 'Kỳ 2 did not default to prior package';
  end if;
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'SELECT_PROVISIONAL_PACKAGE', 'student_id', 'debt_student',
      'cycle_id', v_debt_cycle_2.id, 'expected_version', v_debt_cycle_2.version,
      'package_catalog_id', v_package_20
    ), '27092700-0000-4000-8000-000000000115');
  if v_result->>'ok' <> 'true' then raise exception 'pre-attendance package change failed: %', v_result; end if;
  for v_index in 1..18 loop
    perform pg_temp.tuition_final_add_attendance('tuition_final_alignment_qa', 'debt_student',
      'debt_attendance_' || v_index, date '2026-09-01' + v_index, 'present',
      case when v_index > 16 then 'Thầy Kỳ 2' else 'Cô Kỳ 1' end);
  end loop;
  select * into strict v_debt_cycle_2 from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'debt_student' and cycle_number = 2;
  if v_debt_cycle_2.total_sessions_snapshot <> 20
     or (select used_sessions from public.center_tuition_package_cycle_projection where id = v_debt_cycle_2.id) <> 2
     or (select payment_status from public.center_tuition_package_cycle_projection where id = v_debt_cycle_2.id) <> 'UNPAID' then
    raise exception 'Kỳ 2 debt progress did not remain 2/20 unpaid';
  end if;
  begin
    perform public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
      pg_catalog.jsonb_build_object(
        'operation', 'SELECT_PROVISIONAL_PACKAGE', 'student_id', 'debt_student',
        'cycle_id', v_debt_cycle_2.id, 'expected_version', v_debt_cycle_2.version,
        'package_catalog_id', v_package_16
      ), '27092700-0000-4000-8000-000000000116');
    raise exception 'package change after attendance was accepted';
  exception when others then
    if sqlerrm = 'package change after attendance was accepted'
       or pg_catalog.strpos(sqlerrm, 'tuition_final_package_terms_locked') = 0 then raise; end if;
  end;

  v_finance := pg_catalog.jsonb_build_object(
    'operation', 'CREATE_TRANSACTION',
    'transaction_id', '27092700-0000-4000-8000-000000000120',
    'expected_version', 0, 'local_source_id', pg_catalog.repeat('f', 231),
    'cashflow_type', 'INCOME', 'category_id', v_category,
    'amount_minor', 1000000, 'transaction_date', '2026-09-26',
    'method', 'transfer', 'person_name', 'Phụ huynh QA', 'recorded_by_name', 'Admin QA',
    'note', '', 'source_module', 'hoc-phi', 'source_type', 'tuition-payment',
    'source_payment_id', 'tuition-payment:27092700-0000-4000-8000-000000000120',
    'source_tuition_id', v_debt_cycle_2.tuition_local_id,
    'source_student_id', v_debt_cycle_2.student_local_id,
    'source_parent_id', '', 'source_period_id', v_debt_cycle_2.payment_period_id,
    'attachment_action', 'KEEP'
  );
  v_result := public.f5b_mutate_tuition_receipt('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'RECORD_PAYMENT',
      'receipt_id', '27092700-0000-4000-8000-000000000121',
      'target_cycle_id', v_debt_cycle_2.id,
      'expected_cycle_version', v_debt_cycle_2.version,
      'finance_command', v_finance
    ), '27092700-0000-4000-8000-000000000122');
  if v_result->>'outcome_code' <> 'FULL_PAYMENT_REQUIRED'
     or exists (select 1 from public.finance_transaction where center_id = 'tuition_final_alignment_qa')
     or exists (select 1 from public.center_tuition_receipts where center_id = 'tuition_final_alignment_qa') then
    raise exception 'partial payment was not rejected atomically: %', v_result;
  end if;
  v_finance := v_finance || pg_catalog.jsonb_build_object('amount_minor', 2000000);
  v_payment := pg_catalog.jsonb_build_object(
    'operation', 'RECORD_PAYMENT',
    'receipt_id', '27092700-0000-4000-8000-000000000123',
    'target_cycle_id', v_debt_cycle_2.id,
    'expected_cycle_version', v_debt_cycle_2.version,
    'finance_command', v_finance
  );
  v_result := public.f5b_mutate_tuition_receipt('tuition_final_alignment_qa', v_payment,
    '27092700-0000-4000-8000-000000000124');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select count(*) from public.finance_transaction where center_id = 'tuition_final_alignment_qa') <> 1
     or (select count(*) from public.center_tuition_receipts where center_id = 'tuition_final_alignment_qa') <> 1
     or (select payment_status from public.center_tuition_package_cycle_projection where id = v_debt_cycle_2.id) <> 'PAID'
     or (select used_sessions from public.center_tuition_package_cycle_projection where id = v_debt_cycle_2.id) <> 2
     or (select pg_catalog.length(local_source_id) from public.finance_transaction
         where center_id = 'tuition_final_alignment_qa') <> 80 then
    raise exception 'full cycle-specific Payment -> Finance -> Receipt failed: %', v_result;
  end if;
  v_result := public.f5b_mutate_tuition_receipt('tuition_final_alignment_qa', v_payment,
    '27092700-0000-4000-8000-000000000124');
  if v_result->>'replayed' <> 'true'
     or (select count(*) from public.finance_transaction where center_id = 'tuition_final_alignment_qa') <> 1
     or (select count(*) from public.center_tuition_receipts where center_id = 'tuition_final_alignment_qa') <> 1 then
    raise exception 'payment retry duplicated money: %', v_result;
  end if;

  -- Story 8: ending 13/16 expires exactly three entitlements and writes no money.
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'START_CYCLE', 'student_id', 'end_student',
      'tuition_local_id', 'tuition_record_package::end_student',
      'package_catalog_id', v_package_16, 'baseline_used_sessions', 13,
      'baseline_cutoff_date', '2026-08-31', 'baseline_review_note', '13 buổi trước iChess',
      'opening_context', 'LEGACY_BEFORE_ICHESS', 'opening_payment_state', 'UNPAID'
    ), '27092700-0000-4000-8000-000000000130');
  if v_result->>'ok' <> 'true' then raise exception 'end-cycle fixture failed: %', v_result; end if;
  select * into strict v_end_cycle from public.center_tuition_package_cycles
  where center_id = 'tuition_final_alignment_qa' and student_local_id = 'end_student' and cycle_number = 1;
  select count(*) into v_before_finance from public.finance_transaction
  where center_id = 'tuition_final_alignment_qa';
  v_result := public.v2_4_mutate_package_cycle('tuition_final_alignment_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'END_CYCLE', 'student_id', 'end_student',
      'cycle_id', v_end_cycle.id, 'expected_version', v_end_cycle.version
    ), '27092700-0000-4000-8000-000000000131');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (v_result->>'used_sessions')::integer <> 13
     or (v_result->>'expired_sessions')::integer <> 3
     or not exists (select 1 from public.center_tuition_package_cycles
         where id = v_end_cycle.id and lifecycle_status = 'COMPLETED'
           and expired_sessions_snapshot = 3 and baseline_used_sessions = 13)
     or not exists (select 1 from public.center_tuition_package_cycle_projection
         where center_id = 'tuition_final_alignment_qa' and student_local_id = 'end_student'
           and cycle_number = 2 and used_sessions = 0)
     or (select count(*) from public.finance_transaction where center_id = 'tuition_final_alignment_qa') <> v_before_finance then
    raise exception '13/16 -> 3 hết hiệu lực or Finance-neutral end failed: %', v_result;
  end if;

  -- Story 9: later catalog edits cannot rewrite any existing cycle terms.
  update public.center_tuition_package_catalog
  set package_name = 'Gói mới 18 buổi', total_sessions = 18, default_amount = 1800000,
      version = version + 1, updated_at = pg_catalog.clock_timestamp()
  where id = v_package_16;
  if (select total_sessions_snapshot from public.center_tuition_package_cycles where id = v_legacy_paid.id) <> 16
     or (select price_snapshot from public.center_tuition_package_cycles where id = v_legacy_paid.id) <> 1600000
     or (select total_sessions_snapshot from public.center_tuition_package_cycles where id = v_end_cycle.id) <> 16
     or (select price_snapshot from public.center_tuition_package_cycles where id = v_end_cycle.id) <> 1600000 then
    raise exception 'catalog edit rewrote historical cycle terms';
  end if;

  raise notice 'TUITION_FINAL_BUSINESS_ALIGNMENT_LOCAL_DB_QA: PASS';
end
$qa$;

rollback;
