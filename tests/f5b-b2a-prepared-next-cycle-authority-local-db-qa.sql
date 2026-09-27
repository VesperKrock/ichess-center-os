begin;

do $fixture_user$
declare v_owner uuid;
begin
  select id into v_owner from auth.users order by id limit 1;
  if v_owner is null then raise exception 'f5b_b2a_qa_user_missing'; end if;
  perform pg_catalog.set_config('f5b_b2a.qa.owner', v_owner::text, true);
end
$fixture_user$;

select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('f5b_b2a.qa.owner'),
    'role', 'service_role'
  )::text,
  true
);
select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);

do $setup$
declare
  v_owner uuid := current_setting('f5b_b2a.qa.owner')::uuid;
  v_member uuid;
begin
  insert into public.centers(id, name, environment, status)
  values ('f5b_b2a_qa', 'F5B B2A QA', 'test', 'active');
  insert into public.center_members(center_id, user_id, role, status)
  values ('f5b_b2a_qa', v_owner, 'owner', 'active')
  returning id into v_member;

  insert into public.center_tuition_package_catalog(
    id, center_id, package_name, program_name, total_sessions, default_amount,
    is_active, note, created_by_membership_id, updated_by_membership_id
  ) values (
    'b2a00000-0000-4000-8000-000000000001', 'f5b_b2a_qa',
    'Gói 16 buổi B2A', 'Cờ vua nền tảng', 16, 1500000,
    true, '', v_member, v_member
  );

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  )
  select 'f5b_b2a_qa', 'student', 'b2a_student_' || suffix,
    pg_catalog.jsonb_build_object('id', 'b2a_student_' || suffix, 'fullName', 'B2A ' || suffix),
    'f5b-b2a-qa', 'f5b-b2a-qa', 1, v_owner, v_owner
  from unnest(array['paid','unpaid','legacy','bcht']) suffix;

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  )
  select 'f5b_b2a_qa', 'tuition_record_package', 'tuition_record_package::b2a_' || suffix,
    pg_catalog.jsonb_build_object(
      'id', 'b2a_' || suffix,
      'studentId', 'b2a_student_' || suffix,
      'packageCatalogId', 'b2a00000-0000-4000-8000-000000000001',
      'packageName', 'Gói 16 buổi B2A',
      'programName', 'Cờ vua nền tảng',
      'currentTermId', 'b2a_period_' || suffix || '_1',
      'currentTermNumber', 1,
      'totalSessions', 16,
      'usedSessions', case when suffix = 'bcht' then 12 when suffix = 'legacy' then 15 else 14 end,
      'totalAmount', 1500000,
      'paidAmount', 0,
      'discountType', 'none',
      'discountValue', 0,
      'discountAmount', 0,
      'dueDate', '',
      'note', '',
      'startedAt', '2026-09-01T00:00:00.000Z',
      'payments', '[]'::jsonb,
      'termHistory', '[]'::jsonb
    ),
    'tuition', 'c5.2-authoritative-attendance-tuition-v1', 1, v_owner, v_owner
  from unnest(array['paid','unpaid','legacy','bcht']) suffix;

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  )
  select 'f5b_b2a_qa', 'schedule_session', 'b2a_schedule_' || suffix || '_' || number,
    pg_catalog.jsonb_build_object(
      'id', 'b2a_schedule_' || suffix || '_' || number,
      'scheduleType', 'oneOff',
      'date', ('2026-09-' || pg_catalog.lpad((10 + row_number() over ())::text, 2, '0')),
      'studentIds', pg_catalog.jsonb_build_array('b2a_student_' || suffix)
    ),
    'f5b-b2a-qa', 'f5b-b2a-qa', 1, v_owner, v_owner
  from unnest(array['paid','unpaid','legacy']) suffix
  cross join generate_series(1, 3) number;
end
$setup$;

do $start_cycles$
declare
  v_suffix text;
  v_baseline integer;
  v_result jsonb;
begin
  foreach v_suffix in array array['paid','unpaid','legacy','bcht'] loop
    v_baseline := case when v_suffix = 'bcht' then 12 when v_suffix = 'legacy' then 15 else 14 end;
    v_result := public.v2_4_mutate_package_cycle(
      'f5b_b2a_qa',
      pg_catalog.jsonb_build_object(
        'operation', 'START_CYCLE',
        'student_id', 'b2a_student_' || v_suffix,
        'tuition_local_id', 'tuition_record_package::b2a_' || v_suffix,
        'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001',
        'baseline_used_sessions', v_baseline,
        'baseline_cutoff_date', '2026-09-01',
        'baseline_review_note', 'B2A local QA baseline'
      ),
      case v_suffix
        when 'paid' then 'b2a10000-0000-4000-8000-000000000001'::uuid
        when 'unpaid' then 'b2a10000-0000-4000-8000-000000000002'::uuid
        when 'legacy' then 'b2a10000-0000-4000-8000-000000000003'::uuid
        else 'b2a10000-0000-4000-8000-000000000004'::uuid
      end
    );
    if not coalesce((v_result->>'ok')::boolean, false) then
      raise exception 'f5b_b2a_start_failed:%', v_suffix;
    end if;
  end loop;
end
$start_cycles$;

do $reminder_thresholds$
declare
  v_state jsonb;
  v_cycle jsonb;
  v_result jsonb;
begin
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student->'current_cycle' into v_cycle
  from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_bcht';
  if (v_cycle->>'remaining_sessions')::integer <> 4
     or (v_cycle->>'bcht_reminder')::boolean is not true
     or (v_cycle->>'renewal_reminder')::boolean is not false then
    raise exception 'f5b_b2a_n_minus_4_reminder_failed';
  end if;
  v_result := public.v2_4_mutate_package_cycle(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'UPDATE_BCHT', 'student_id', 'b2a_student_bcht',
      'cycle_id', v_cycle->>'id', 'expected_version', v_cycle->>'version',
      'bcht_status', 'COMPLETED', 'bcht_note', 'BCHT complete in QA'
    ),
    'b2a20000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or (select projection.bcht_reminder from public.center_tuition_package_cycle_projection projection
         where projection.id = (v_cycle->>'id')::uuid) is not false then
    raise exception 'f5b_b2a_bcht_completion_did_not_clear';
  end if;
end
$reminder_thresholds$;

do $prepare_paid$
declare
  v_state jsonb;
  v_current jsonb;
  v_prepared jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_duplicate jsonb;
begin
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student->'current_cycle' into v_current
  from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_paid';
  begin
    perform public.v2_4_mutate_package_cycle(
      'f5b_b2a_qa',
      pg_catalog.jsonb_build_object(
        'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'b2a_student_paid',
        'current_cycle_id', v_current->>'id',
        'expected_version', (v_current->>'version')::bigint + 1,
        'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001'
      ),
      'b2a30000-0000-4000-8000-000000000099'
    );
    raise exception 'f5b_b2a_stale_prepare_was_accepted';
  exception
    when others then
      if position('v2_4_stale_version' in sqlerrm) = 0 then raise; end if;
  end;
  v_result := public.v2_4_mutate_package_cycle(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'b2a_student_paid',
      'current_cycle_id', v_current->>'id', 'expected_version', v_current->>'version',
      'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001'
    ),
    'b2a30000-0000-4000-8000-000000000001'
  );
  v_retry := public.v2_4_mutate_package_cycle(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'b2a_student_paid',
      'current_cycle_id', v_current->>'id', 'expected_version', v_current->>'version',
      'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001'
    ),
    'b2a30000-0000-4000-8000-000000000001'
  );
  v_duplicate := public.v2_4_mutate_package_cycle(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'b2a_student_paid',
      'current_cycle_id', v_current->>'id', 'expected_version', v_current->>'version',
      'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001'
    ),
    'b2a30000-0000-4000-8000-000000000002'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or not coalesce((v_retry->>'replayed')::boolean, false)
     or not coalesce((v_duplicate->>'ok')::boolean, false)
     or (select count(*) from public.center_tuition_package_cycles cycle
         where cycle.center_id = 'f5b_b2a_qa'
           and cycle.student_local_id = 'b2a_student_paid'
           and cycle.lifecycle_status = 'PREPARED') <> 1 then
    raise exception 'f5b_b2a_prepare_idempotency_failed';
  end if;
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student->'current_cycle', student->'prepared_next_cycle'
    into v_current, v_prepared
  from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_paid';
  if (v_current->>'cycle_number')::integer <> 1
     or (v_current->>'used_sessions')::integer <> 14
     or v_current->>'lifecycle_status' <> 'ACTIVE'
     or (v_prepared->>'cycle_number')::integer <> 2
     or v_prepared->>'lifecycle_status' <> 'PREPARED'
     or (v_prepared->>'used_sessions')::integer <> 0
     or (select count(*) from public.center_tuition_attendance_contributions contribution
         where contribution.cycle_id = (v_prepared->>'id')::uuid) <> 0 then
    raise exception 'f5b_b2a_prepared_projection_or_attendance_boundary_failed';
  end if;
  perform pg_catalog.set_config('f5b_b2a.qa.paid_prepared_period', v_prepared->>'payment_period_id', true);
end
$prepare_paid$;

do $finance_prepared$
declare
  v_category uuid;
  v_result jsonb;
  v_retry jsonb;
  v_rejected jsonb;
  v_state jsonb;
  v_student jsonb;
begin
  select category.id into v_category from public.finance_category category
  where category.center_id = 'f5b_b2a_qa' and category.name = 'Học phí';
  v_result := public.c5_4_mutate_finance_shared_truth(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'CREATE_TRANSACTION',
      'transaction_id', 'b2a40000-0000-4000-8000-000000000001',
      'expected_version', 0, 'local_source_id', 'b2a-paid-prepared',
      'cashflow_type', 'INCOME', 'category_id', v_category,
      'amount_minor', 1500000, 'transaction_date', '2026-09-24',
      'method', 'Tiền mặt', 'person_name', 'Phụ huynh B2A',
      'recorded_by_name', 'Local QA', 'note', 'Prepared cycle payment',
      'source_module', 'hoc-phi', 'source_type', 'tuition-payment',
      'source_payment_id', 'b2a-payment-paid-prepared',
      'source_tuition_id', 'tuition_record_package::b2a_paid',
      'source_student_id', 'b2a_student_paid', 'source_parent_id', '',
      'source_period_id', current_setting('f5b_b2a.qa.paid_prepared_period'),
      'attachment_action', 'KEEP'
    ),
    'b2a50000-0000-4000-8000-000000000001'
  );
  v_retry := public.c5_4_mutate_finance_shared_truth(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'CREATE_TRANSACTION',
      'transaction_id', 'b2a40000-0000-4000-8000-000000000001',
      'expected_version', 0, 'local_source_id', 'b2a-paid-prepared',
      'cashflow_type', 'INCOME', 'category_id', v_category,
      'amount_minor', 1500000, 'transaction_date', '2026-09-24',
      'method', 'Tiền mặt', 'person_name', 'Phụ huynh B2A',
      'recorded_by_name', 'Local QA', 'note', 'Prepared cycle payment',
      'source_module', 'hoc-phi', 'source_type', 'tuition-payment',
      'source_payment_id', 'b2a-payment-paid-prepared',
      'source_tuition_id', 'tuition_record_package::b2a_paid',
      'source_student_id', 'b2a_student_paid', 'source_parent_id', '',
      'source_period_id', current_setting('f5b_b2a.qa.paid_prepared_period'),
      'attachment_action', 'KEEP'
    ),
    'b2a50000-0000-4000-8000-000000000001'
  );
  v_rejected := public.c5_4_mutate_finance_shared_truth(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'CREATE_TRANSACTION',
      'transaction_id', 'b2a40000-0000-4000-8000-000000000002',
      'expected_version', 0, 'local_source_id', 'b2a-arbitrary-future',
      'cashflow_type', 'INCOME', 'category_id', v_category,
      'amount_minor', 100000, 'transaction_date', '2026-09-24',
      'method', 'Tiền mặt', 'person_name', 'Phụ huynh B2A',
      'recorded_by_name', 'Local QA', 'note', 'Must fail',
      'source_module', 'hoc-phi', 'source_type', 'tuition-payment',
      'source_payment_id', 'b2a-payment-arbitrary',
      'source_tuition_id', 'tuition_record_package::b2a_paid',
      'source_student_id', 'b2a_student_paid', 'source_parent_id', '',
      'source_period_id', 'b2a_non_authoritative_future_period',
      'attachment_action', 'KEEP'
    ),
    'b2a50000-0000-4000-8000-000000000002'
  );
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student into v_student from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_paid';
  if not coalesce((v_result->>'ok')::boolean, false)
     or not coalesce((v_retry->>'replayed')::boolean, false)
     or v_rejected->>'outcome_code' <> 'TUITION_PERIOD_STALE'
     or v_student#>>'{current_cycle,cycle_number}' <> '1'
     or v_student#>>'{current_cycle,lifecycle_status}' <> 'ACTIVE'
     or v_student#>>'{prepared_next_cycle,lifecycle_status}' <> 'PREPARED'
     or v_student#>>'{prepared_next_cycle,payment_status}' <> 'PAID'
     or (select count(*) from public.finance_transaction transaction
         where transaction.center_id = 'f5b_b2a_qa'
           and transaction.source_payment_id = 'b2a-payment-paid-prepared') <> 1 then
    raise exception 'f5b_b2a_finance_prepared_authority_failed:%:%', v_result, v_rejected;
  end if;
end
$finance_prepared$;

do $prepare_unpaid$
declare
  v_state jsonb;
  v_current jsonb;
begin
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student->'current_cycle' into v_current
  from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_unpaid';
  perform public.v2_4_mutate_package_cycle(
    'f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation', 'PREPARE_NEXT_CYCLE', 'student_id', 'b2a_student_unpaid',
      'current_cycle_id', v_current->>'id', 'expected_version', v_current->>'version',
      'package_catalog_id', 'b2a00000-0000-4000-8000-000000000001'
    ),
    'b2a30000-0000-4000-8000-000000000003'
  );
end
$prepare_unpaid$;

do $attendance_rollover$
declare
  v_suffix text;
  v_number integer;
  v_result jsonb;
begin
  foreach v_suffix in array array['paid','unpaid'] loop
    foreach v_number in array array[1,2] loop
      v_result := public.v2_3_mutate_occurrence_attendance(
        'f5b_b2a_qa',
        'b2a_schedule_' || v_suffix || '_' || v_number,
        ('2026-09-' || pg_catalog.lpad(((case when v_suffix='paid' then 10 else 13 end) + v_number)::text, 2, '0'))::date,
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'student_id', 'b2a_student_' || v_suffix,
          'source', 'admin', 'attendance_status', 'present',
          'payload', pg_catalog.jsonb_build_object('note', 'B2A boundary'),
          'expected_records', '[]'::jsonb
        )),
        null,
        case
          when v_suffix='paid' and v_number=1 then 'b2a60000-0000-4000-8000-000000000001'::uuid
          when v_suffix='paid' then 'b2a60000-0000-4000-8000-000000000002'::uuid
          when v_number=1 then 'b2a60000-0000-4000-8000-000000000003'::uuid
          else 'b2a60000-0000-4000-8000-000000000004'::uuid
        end
      );
      if not coalesce((v_result->>'ok')::boolean, false) then
        raise exception 'f5b_b2a_attendance_failed:%:%:%', v_suffix, v_number, v_result;
      end if;
    end loop;
  end loop;
end
$attendance_rollover$;

do $assert_rollover$
declare
  v_state jsonb;
  v_student jsonb;
  v_old public.center_tuition_package_cycle_projection;
begin
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  select student into v_student from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_paid';
  select projection.* into v_old from public.center_tuition_package_cycle_projection projection
  where projection.center_id = 'f5b_b2a_qa'
    and projection.student_local_id = 'b2a_student_paid' and projection.cycle_number = 1;
  if v_student->'prepared_next_cycle' <> 'null'::jsonb
     or v_student#>>'{current_cycle,cycle_number}' <> '2'
     or v_student#>>'{current_cycle,lifecycle_status}' <> 'ACTIVE'
     or v_student#>>'{current_cycle,payment_status}' <> 'PAID'
     or v_old.lifecycle_status <> 'COMPLETED' or v_old.used_sessions <> 16
     or (select payload->>'currentTermId' from public.center_cloud_entities entity
         where entity.center_id='f5b_b2a_qa'
           and entity.local_id='tuition_record_package::b2a_paid')
        <> current_setting('f5b_b2a.qa.paid_prepared_period') then
    raise exception 'f5b_b2a_paid_activation_failed:%', v_student;
  end if;

  select student into v_student from pg_catalog.jsonb_array_elements(v_state->'students') student
  where student->>'student_id' = 'b2a_student_unpaid';
  select projection.* into v_old from public.center_tuition_package_cycle_projection projection
  where projection.center_id = 'f5b_b2a_qa'
    and projection.student_local_id = 'b2a_student_unpaid' and projection.cycle_number = 1;
  if v_student#>>'{current_cycle,cycle_number}' <> '2'
     or v_student#>>'{current_cycle,lifecycle_status}' <> 'PROVISIONAL_UNPAID'
     or v_student#>>'{current_cycle,payment_status}' <> 'UNPAID'
     or v_old.lifecycle_status <> 'COMPLETED' or v_old.used_sessions <> 16
     or (select pg_catalog.count(*)
         from public.center_attendance_operational_reminder_projection reminder
         where reminder.center_id = 'f5b_b2a_qa'
           and reminder.student_local_id = 'b2a_student_unpaid'
           and reminder.signal = 'PAYMENT_CHECK_DUE') <> 1 then
    raise exception 'f5b_b2a_unpaid_activation_failed:%', v_student;
  end if;
end
$assert_rollover$;

do $post_rollover_attendance$
declare v_result jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'f5b_b2a_qa', 'b2a_schedule_paid_3', '2026-09-13',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id', 'b2a_student_paid', 'source', 'admin',
      'attendance_status', 'present',
      'payload', pg_catalog.jsonb_build_object('note', 'First next-cycle attendance'),
      'expected_records', '[]'::jsonb
    )), null, 'b2a60000-0000-4000-8000-000000000005'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or (select used_sessions from public.center_tuition_package_cycle_projection
         where center_id='f5b_b2a_qa' and student_local_id='b2a_student_paid' and cycle_number=1) <> 16
     or (select used_sessions from public.center_tuition_package_cycle_projection
         where center_id='f5b_b2a_qa' and student_local_id='b2a_student_paid' and cycle_number=2) <> 1 then
    raise exception 'f5b_b2a_post_rollover_allocation_failed';
  end if;
end
$post_rollover_attendance$;

-- Debt attendance is part of the provisional next cycle. Paying later must
-- attach Finance and Receipt to that same cycle without replacing its history.
do $late_payment_same_cycle$
declare
  v_cycle public.center_tuition_package_cycles;
  v_cycle_after public.center_tuition_package_cycles;
  v_result jsonb;
  v_category uuid;
  v_material bigint;
begin
  select * into strict v_cycle from public.center_tuition_package_cycles
    where center_id='f5b_b2a_qa' and student_local_id='b2a_student_unpaid'
      and cycle_number=2;
  v_result := public.v2_3_mutate_occurrence_attendance(
    'f5b_b2a_qa', 'b2a_schedule_unpaid_3', '2026-09-16',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id', 'b2a_student_unpaid', 'source', 'admin',
      'attendance_status', 'present',
      'payload', pg_catalog.jsonb_build_object('note', 'Debt session before payment'),
      'expected_records', '[]'::jsonb
    )), null, 'b2a60000-0000-4000-8000-000000000008'
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'late_debt_attendance_failed:%',v_result;
  end if;
  select * into strict v_cycle from public.center_tuition_package_cycles
    where id=v_cycle.id;
  if (select used_sessions from public.center_tuition_package_cycle_projection
      where center_id='f5b_b2a_qa' and student_local_id='b2a_student_unpaid'
        and cycle_number=2) <> 1 then
    raise exception 'late_debt_session_not_allocated_to_provisional_cycle';
  end if;
  select id into strict v_category from public.finance_category
    where center_id='f5b_b2a_qa' and name='Học phí' and not is_archived;
  select renewal_material_fee_minor into strict v_material
    from public.center_operational_profiles where center_id='f5b_b2a_qa';
  v_result := public.f5b_mutate_tuition_receipt('f5b_b2a_qa',
    pg_catalog.jsonb_build_object(
      'operation','RECORD_PAYMENT',
      'receipt_id','b2a70000-0000-4000-8000-000000000001',
      'target_cycle_id',v_cycle.id,
      'expected_cycle_version',v_cycle.version,
      'finance_command',pg_catalog.jsonb_build_object(
        'operation','CREATE_TRANSACTION',
        'transaction_id','b2a70000-0000-4000-8000-000000000002',
        'expected_version',0,
        'local_source_id','b2a-late-provisional-payment',
        'cashflow_type','INCOME',
        'category_id',v_category,
        'amount_minor',v_cycle.price_snapshot+v_material,
        'transaction_date','2026-09-17',
        'method','transfer',
        'person_name','B2A Parent',
        'recorded_by_name','B2A Admin',
        'note','Late payment for same provisional cycle',
        'source_module','hoc-phi',
        'source_type','tuition-payment',
        'source_payment_id','b2a-late-provisional-payment',
        'source_tuition_id',v_cycle.tuition_local_id,
        'source_student_id',v_cycle.student_local_id,
        'source_parent_id','',
        'source_period_id',v_cycle.payment_period_id,
        'attachment_action','KEEP'
      )
    ), 'b2a70000-0000-4000-8000-000000000003');
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'late_provisional_payment_failed:%',v_result;
  end if;
  select * into strict v_cycle_after from public.center_tuition_package_cycles
    where id=v_cycle.id;
  if v_cycle_after.lifecycle_status <> 'ACTIVE'
     or (select used_sessions from public.center_tuition_package_cycle_projection
       where center_id='f5b_b2a_qa' and student_local_id='b2a_student_unpaid'
         and cycle_number=2) <> 1
     or (select count(*) from public.center_tuition_package_cycles
       where center_id='f5b_b2a_qa' and student_local_id='b2a_student_unpaid') <> 2
     or (select count(*) from public.finance_transaction
       where center_id='f5b_b2a_qa'
         and source_payment_id='b2a-late-provisional-payment'
         and status='POSTED') <> 1
     or (select receipt.snapshot#>>'{payment,collectorName}'
       from public.center_tuition_receipts receipt
       where receipt.id='b2a70000-0000-4000-8000-000000000001') <> 'B2A Admin' then
    raise exception 'late_payment_lost_debt_cycle_or_receipt';
  end if;
end
$late_payment_same_cycle$;

do $legacy_no_prepared$
declare
  v_result jsonb;
  v_state jsonb;
begin
  v_result := public.v2_3_mutate_occurrence_attendance(
    'f5b_b2a_qa', 'b2a_schedule_legacy_1', '2026-09-17',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id', 'b2a_student_legacy', 'source', 'admin',
      'attendance_status', 'present', 'payload', '{}'::jsonb,
      'expected_records', '[]'::jsonb
    )), null, 'b2a60000-0000-4000-8000-000000000006'
  );
  v_result := public.v2_3_mutate_occurrence_attendance(
    'f5b_b2a_qa', 'b2a_schedule_legacy_2', '2026-09-18',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'student_id', 'b2a_student_legacy', 'source', 'admin',
      'attendance_status', 'present', 'payload', '{}'::jsonb,
      'expected_records', '[]'::jsonb
    )), null, 'b2a60000-0000-4000-8000-000000000007'
  );
  v_state := public.v2_4_list_package_cycle_state('f5b_b2a_qa');
  if (select student#>>'{current_cycle,cycle_number}'
      from pg_catalog.jsonb_array_elements(v_state->'students') student
      where student->>'student_id'='b2a_student_legacy') <> '2'
     or (select lifecycle_status from public.center_tuition_package_cycle_projection
         where center_id='f5b_b2a_qa' and student_local_id='b2a_student_legacy' and cycle_number=2)
        <> 'PROVISIONAL_UNPAID'
     or (select used_sessions from public.center_tuition_package_cycle_projection
         where center_id='f5b_b2a_qa' and student_local_id='b2a_student_legacy' and cycle_number=1) <> 16
     or (select used_sessions from public.center_tuition_package_cycle_projection
         where center_id='f5b_b2a_qa' and student_local_id='b2a_student_legacy' and cycle_number=2) <> 1 then
    raise exception 'f5b_b2a_legacy_rollover_failed';
  end if;
end
$legacy_no_prepared$;

do $discounted_debt_settlement_guard$
declare
  v_cycle public.center_tuition_package_cycles;
  v_result jsonb;
begin
  select * into strict v_cycle from public.center_tuition_package_cycles
    where center_id='f5b_b2a_qa' and student_local_id='b2a_student_legacy'
      and cycle_number=2;
  update public.center_cloud_entities tuition
    set payload = tuition.payload || pg_catalog.jsonb_build_object(
      'discountType','amount','discountAmount',100000,'totalAmount',1400000),
      entity_version = tuition.entity_version + 1,
      updated_at = pg_catalog.clock_timestamp()
    where tuition.center_id='f5b_b2a_qa'
      and tuition.local_id=v_cycle.tuition_local_id;
  v_result := public.tbc_stop_tuition_continuation('f5b_b2a_qa',
    pg_catalog.jsonb_build_object('operation','STOP_CONTINUATION',
      'cycle_id',v_cycle.id,'expected_version',v_cycle.version,
      'reason','Phụ huynh xác nhận ngừng sau buổi học nợ'),
    'b2a70000-0000-4000-8000-000000000004');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or v_result->>'debt_sessions' <> '1'
     or v_result->'debt_amount_minor' <> 'null'::jsonb
     or v_result->>'authority_gap' <> 'CYCLE_TUITION_DISCOUNT_OR_TERM_NOT_PROVEN' then
    raise exception 'discounted_debt_was_guessed:%',v_result;
  end if;
end
$discounted_debt_settlement_guard$;

select 'F5B_B2A_LOCAL_DB_QA: PASS';

rollback;
