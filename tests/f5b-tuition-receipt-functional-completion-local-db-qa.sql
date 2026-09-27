begin;

select pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'service_role'
  )::text,
  true
);
select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);

do $qa$
declare
  v_owner constant uuid := '11111111-1111-4111-8111-111111111111';
  v_member constant uuid := 'f5b50000-0000-4000-8000-000000000001';
  v_package constant uuid := 'f5b50000-0000-4000-8000-000000000002';
  v_contact uuid;
  v_current public.center_tuition_package_cycles;
  v_prepared public.center_tuition_package_cycles;
  v_receipt_new constant uuid := 'f5b50000-0000-4000-8000-000000000010';
  v_receipt_renewal constant uuid := 'f5b50000-0000-4000-8000-000000000011';
  v_result jsonb;
  v_list jsonb;
  v_snapshot jsonb;
  v_after jsonb;
  v_transaction public.finance_transaction;
  v_version bigint;
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    raise exception 'f5b_receipt_qa_user_missing';
  end if;
  if (select column_default from information_schema.columns
      where table_schema='public' and table_name='center_operational_profiles'
        and column_name='renewal_material_fee_minor') <> '80000'::text then
    raise exception 'f5b_receipt_material_default_missing';
  end if;

  insert into public.centers(id, name, environment, status)
  values ('f5b_receipt_qa', 'iChess Receipt QA', 'test', 'active');
  insert into public.center_members(id, center_id, user_id, role, status)
  values (v_member, 'f5b_receipt_qa', v_owner, 'owner', 'active');
  update public.center_crm_control
  set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
  where center_id='f5b_receipt_qa';
  if (select renewal_material_fee_minor from public.center_operational_profiles
      where center_id='f5b_receipt_qa') <> 80000 then
    raise exception 'f5b_receipt_new_center_default_not_provisioned';
  end if;

  v_result := public.v2_1_mutate_center_settings(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','UPDATE_CENTER_PROFILE', 'expected_version',1,
      'display_name','iChess Quận 3',
      'address','45 Nguyễn Thị Minh Khai, TP.HCM',
      'phone','0901 234 567', 'note','Local receipt QA',
      'renewal_material_fee_minor',90000
    ),
    'f5b50000-0000-4000-8000-000000000020'
  );
  if coalesce(v_result->>'outcome_code','') <> 'COMMITTED'
     or (select renewal_material_fee_minor from public.center_operational_profiles
         where center_id='f5b_receipt_qa') <> 90000 then
    raise exception 'f5b_receipt_settings_create_failed:%', v_result;
  end if;

  insert into public.center_tuition_package_catalog(
    id, center_id, package_name, program_name, total_sessions, default_amount,
    is_active, note, created_by_membership_id, updated_by_membership_id
  ) values (
    v_package, 'f5b_receipt_qa', 'Gói 16 buổi', 'Cờ vua nền tảng',
    16, 1600000, true, '', v_member, v_member
  );

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values
  (
    'f5b_receipt_qa', 'student', 'receipt_student',
    pg_catalog.jsonb_build_object(
      'id','receipt_student', 'fullName','Nguyễn Minh An',
      'parentName','Nguyễn Thị Hạnh'
    ),
    'f5b-receipt-qa', 'f5b-receipt-qa', 1, v_owner, v_owner
  ),
  (
    'f5b_receipt_qa', 'tuition_record_package', 'tuition_record_package::receipt',
    pg_catalog.jsonb_build_object(
      'id','receipt', 'studentId','receipt_student',
      'packageCatalogId',v_package, 'packageName','Gói 16 buổi',
      'programName','Cờ vua nền tảng', 'currentTermId','receipt_period_1',
      'currentTermNumber',1, 'totalSessions',16, 'usedSessions',14,
      'totalAmount',1600000, 'paidAmount',0,
      'discountType','fixed', 'discountValue',100000, 'discountAmount',100000,
      'dueDate','', 'note','', 'startedAt','2026-09-01T00:00:00.000Z',
      'payments','[]'::jsonb, 'termHistory','[]'::jsonb
    ),
    'tuition', 'c5.2-authoritative-attendance-tuition-v1', 1, v_owner, v_owner
  ),
  (
    'f5b_receipt_qa', 'class_session', 'receipt_class',
    pg_catalog.jsonb_build_object(
      'id','receipt_class', 'name','Thứ Ba 18:00–19:30',
      'displayLabel','Thứ Ba 18:00–19:30',
      'daysOfWeek',pg_catalog.jsonb_build_array('tue')
    ),
    'schedule', 'f5b-receipt-qa', 1, v_owner, v_owner
  );
  insert into public.center_student_enrollment_sets(
    center_id, student_local_id, created_by_membership_id, updated_by_membership_id
  ) values ('f5b_receipt_qa','receipt_student',v_member,v_member);
  insert into public.center_student_recurring_enrollments(
    center_id, student_local_id, class_session_local_id, weekdays,
    enrollment_set_version, created_by_membership_id
  ) values ('f5b_receipt_qa','receipt_student','receipt_class',array['tue'],1,v_member);

  select ingress.crm_contact_id into v_contact
  from public.f23_3e_p4a_ingress_canonical_contact(
    'f5b_receipt_qa', v_owner, 'receipt-parent-source', 'Nguyễn Thị Hạnh',
    array['0909123456'], array['phuhuynh@example.com']
  ) ingress;
  update public.crm_contact
  set receipt_address='123 Nguyễn Đình Chiểu, TP.HCM', cccd='079203001234',
      contact_version=contact_version+1
  where center_id='f5b_receipt_qa' and crm_contact_id=v_contact;
  v_result := public.ph_1_create_parent_student_link(
    'f5b_receipt_qa', 'f5b50000-0000-4000-8000-000000000003', v_contact,
    'receipt_student', 'PARENT', true, 'PRIMARY', 'PRIMARY',
    'f5b50000-0000-4000-8000-000000000019'
  );
  if coalesce(v_result->>'outcome_code','') <> 'COMMITTED' then
    raise exception 'f5b_receipt_parent_link_failed:%', v_result;
  end if;

  v_result := public.v2_4_mutate_package_cycle(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','START_CYCLE', 'student_id','receipt_student',
      'tuition_local_id','tuition_record_package::receipt',
      'package_catalog_id',v_package, 'baseline_used_sessions',14,
      'baseline_cutoff_date','2026-09-01',
      'baseline_review_note','F5B receipt local QA baseline'
    ),
    'f5b50000-0000-4000-8000-000000000021'
  );
  if coalesce(v_result->>'ok','false') <> 'true' then
    raise exception 'f5b_receipt_start_cycle_failed:%', v_result;
  end if;
  select * into strict v_current from public.center_tuition_package_cycles
  where center_id='f5b_receipt_qa' and student_local_id='receipt_student'
    and lifecycle_status='ACTIVE';

  -- First-cycle Receipt snapshots the existing Tuition discount and never
  -- charges the renewal material fee.
  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CREATE_RECEIPT', 'receipt_id',v_receipt_new,
      'target_cycle_id',v_current.id, 'expected_cycle_version',v_current.version
    ),
    'f5b50000-0000-4000-8000-000000000022'
  );
  if v_result->>'receipt_status' <> 'WAITING_PAYMENT'
     or (select registration_classification from public.center_tuition_receipts
         where id=v_receipt_new) <> 'NEW_REGISTRATION'
     or (select material_fee_minor from public.center_tuition_receipts
         where id=v_receipt_new) <> 0
     or (select total_amount_due_minor from public.center_tuition_receipts
         where id=v_receipt_new) <> 1500000
     or exists (select 1 from public.finance_transaction
         where center_id='f5b_receipt_qa') then
    raise exception 'f5b_receipt_new_waiting_contract_failed:%', v_result;
  end if;
  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CREATE_RECEIPT',
      'receipt_id','f5b50000-0000-4000-8000-000000000012',
      'target_cycle_id',v_current.id, 'expected_cycle_version',v_current.version
    ),
    'f5b50000-0000-4000-8000-000000000023'
  );
  if v_result->>'outcome_code' <> 'RECEIPT_ALREADY_EXISTS' then
    raise exception 'f5b_receipt_duplicate_not_blocked:%', v_result;
  end if;

  v_result := public.v2_4_mutate_package_cycle(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','PREPARE_NEXT_CYCLE', 'student_id','receipt_student',
      'current_cycle_id',v_current.id, 'expected_version',v_current.version,
      'package_catalog_id',v_package
    ),
    'f5b50000-0000-4000-8000-000000000024'
  );
  if coalesce(v_result->>'ok','false') <> 'true' then
    raise exception 'f5b_receipt_prepare_failed:%', v_result;
  end if;
  select * into strict v_prepared from public.center_tuition_package_cycles
  where center_id='f5b_receipt_qa' and student_local_id='receipt_student'
    and lifecycle_status='PREPARED';

  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CREATE_RECEIPT', 'receipt_id',v_receipt_renewal,
      'target_cycle_id',v_prepared.id, 'expected_cycle_version',v_prepared.version
    ),
    'f5b50000-0000-4000-8000-000000000025'
  );
  select snapshot into strict v_snapshot from public.center_tuition_receipts
  where id=v_receipt_renewal;
  if v_result->>'receipt_status' <> 'WAITING_PAYMENT'
     or (select registration_classification from public.center_tuition_receipts
         where id=v_receipt_renewal) <> 'RENEWAL'
     or (select material_fee_minor from public.center_tuition_receipts
         where id=v_receipt_renewal) <> 90000
     or (select total_amount_due_minor from public.center_tuition_receipts
         where id=v_receipt_renewal) <> 1690000
     or v_snapshot#>>'{customer,email}' <> 'phuhuynh@example.com'
     or v_snapshot#>>'{customer,receiptAddress}' <> '123 Nguyễn Đình Chiểu, TP.HCM'
     or v_snapshot#>>'{customer,cccd}' <> '079203001234'
     or v_snapshot#>>'{center,address}' <> '45 Nguyễn Thị Minh Khai, TP.HCM'
     or v_snapshot#>>'{registration,code}' <> 'RENEWAL'
     or not (v_snapshot->'scheduleLines' @> '["Thứ Ba 18:00–19:30"]'::jsonb) then
    raise exception 'f5b_receipt_renewal_snapshot_failed:%', v_snapshot;
  end if;

  -- Live authority changes after issuance must not rewrite the receipt.
  select version into v_version from public.center_operational_profiles
  where center_id='f5b_receipt_qa';
  v_result := public.v2_1_mutate_center_settings(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','UPDATE_CENTER_PROFILE', 'expected_version',v_version,
      'display_name','iChess Quận 3 mới', 'address','Địa chỉ đã đổi',
      'phone','0909 999 999', 'note','Changed after issuance',
      'renewal_material_fee_minor',120000
    ),
    'f5b50000-0000-4000-8000-000000000026'
  );
  if coalesce(v_result->>'outcome_code','') <> 'COMMITTED' then
    raise exception 'f5b_receipt_settings_edit_failed:%', v_result;
  end if;
  update public.crm_contact set
    receipt_address='Địa chỉ phụ huynh đã đổi', cccd='000000000001',
    contact_version=contact_version+1
  where center_id='f5b_receipt_qa' and crm_contact_id=v_contact;
  update public.center_cloud_entities set
    payload=pg_catalog.jsonb_set(payload,'{fullName}','"Tên học viên đã đổi"'::jsonb),
    entity_version=entity_version+1
  where center_id='f5b_receipt_qa' and entity_type='student'
    and local_id='receipt_student';
  update public.center_cloud_entities set
    payload=pg_catalog.jsonb_set(payload,'{displayLabel}','"Lịch đã đổi"'::jsonb),
    entity_version=entity_version+1
  where center_id='f5b_receipt_qa' and entity_type='class_session'
    and local_id='receipt_class';
  update public.center_tuition_package_catalog set default_amount=2200000, version=version+1
  where center_id='f5b_receipt_qa' and id=v_package;
  select snapshot into strict v_after from public.center_tuition_receipts
  where id=v_receipt_renewal;
  if v_after is distinct from v_snapshot then
    raise exception 'f5b_receipt_snapshot_mutated_after_live_edits';
  end if;
  begin
    update public.center_tuition_receipts
    set snapshot=pg_catalog.jsonb_set(snapshot,'{tampered}','true'::jsonb)
    where id=v_receipt_renewal;
    raise exception 'f5b_receipt_snapshot_update_was_allowed';
  exception when others then
    if position('f5b_receipt_snapshot_immutable' in sqlerrm)=0 then raise; end if;
  end;

  -- Canonical Finance validation failure leaves the first Receipt waiting.
  update public.finance_category set is_archived=true
  where center_id='f5b_receipt_qa' and pg_catalog.lower(name)=pg_catalog.lower('Học phí');
  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CONFIRM_PAID', 'receipt_id',v_receipt_new,
      'expected_version',1, 'transaction_date','2026-09-24',
      'method','Chuyển khoản', 'recorded_by_name','Admin QA'
    ),
    'f5b50000-0000-4000-8000-000000000027'
  );
  if v_result->>'outcome_code' <> 'TUITION_CATEGORY_MISSING'
     or exists (select 1 from public.finance_transaction
       where center_id='f5b_receipt_qa' and source_period_id='receipt_period_1') then
    raise exception 'f5b_receipt_finance_failure_contract_failed:%', v_result;
  end if;
  update public.finance_category set is_archived=false
  where center_id='f5b_receipt_qa' and pg_catalog.lower(name)=pg_catalog.lower('Học phí');

  -- Confirming the prepared term writes one full Finance income row, allocates
  -- only Tuition principal, and never activates the prepared cycle early.
  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CONFIRM_PAID', 'receipt_id',v_receipt_renewal,
      'expected_version',1, 'transaction_date','2026-09-24',
      'method','Chuyển khoản', 'recorded_by_name','Admin QA'
    ),
    'f5b50000-0000-4000-8000-000000000028'
  );
  if v_result->>'receipt_status' <> 'PAID' then
    raise exception 'f5b_receipt_confirm_failed:%', v_result;
  end if;
  select * into strict v_transaction from public.finance_transaction
  where center_id='f5b_receipt_qa' and id=(v_result->>'finance_transaction_id')::uuid;
  if v_transaction.amount_minor <> 1690000
     or v_transaction.tuition_allocation_minor <> 1600000
     or v_transaction.status <> 'POSTED'
     or (select lifecycle_status from public.center_tuition_package_cycles
       where id=v_prepared.id) <> 'PREPARED' then
    raise exception 'f5b_receipt_finance_or_early_activation_failed';
  end if;
  v_after := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CONFIRM_PAID', 'receipt_id',v_receipt_renewal,
      'expected_version',1, 'transaction_date','2026-09-24',
      'method','Chuyển khoản', 'recorded_by_name','Admin QA'
    ),
    'f5b50000-0000-4000-8000-000000000028'
  );
  if coalesce(v_after->>'replayed','false') <> 'true'
     or (select count(*) from public.finance_transaction
       where center_id='f5b_receipt_qa' and source_period_id=v_prepared.payment_period_id) <> 1 then
    raise exception 'f5b_receipt_confirm_retry_duplicated:%', v_after;
  end if;

  -- A voided linked payment changes the derived Receipt state back to WAITING,
  -- preserves history, and allows one later canonical replacement.
  v_result := public.c5_4_void_tuition_payment(
    'f5b_receipt_qa', v_transaction.id, v_transaction.source_payment_id,
    v_transaction.source_tuition_id, v_transaction.version,
    'Hủy khoản thu Phiếu Thu để kiểm thử',
    'f5b50000-0000-4000-8000-000000000029'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'f5b_receipt_void_failed:%', v_result;
  end if;
  v_list := public.f5b_list_tuition_receipts('f5b_receipt_qa');
  select item.value into strict v_after
  from pg_catalog.jsonb_array_elements(v_list->'receipts') item
  where item.value->>'id'=v_receipt_renewal::text;
  if v_after->>'status' <> 'WAITING_PAYMENT'
     or pg_catalog.jsonb_array_length(v_after->'payments') <> 1
     or v_after#>>'{payments,0,status}' <> 'VOIDED' then
    raise exception 'f5b_receipt_void_drift:%', v_after;
  end if;
  v_result := public.f5b_mutate_tuition_receipt(
    'f5b_receipt_qa',
    pg_catalog.jsonb_build_object(
      'operation','CONFIRM_PAID', 'receipt_id',v_receipt_renewal,
      'expected_version',(v_after->>'version')::bigint,
      'transaction_date','2026-09-25', 'method','Tiền mặt',
      'recorded_by_name','Admin QA'
    ),
    'f5b50000-0000-4000-8000-000000000030'
  );
  if v_result->>'receipt_status' <> 'PAID'
     or (select count(*) from public.finance_transaction
       where center_id='f5b_receipt_qa' and source_period_id=v_prepared.payment_period_id
         and status='POSTED') <> 1
     or (select count(*) from public.center_tuition_receipt_payment_links
       where center_id='f5b_receipt_qa' and receipt_id=v_receipt_renewal) <> 2 then
    raise exception 'f5b_receipt_replacement_payment_failed:%', v_result;
  end if;
  v_list := public.f5b_list_tuition_receipts('f5b_receipt_qa');
  select item.value into strict v_after
  from pg_catalog.jsonb_array_elements(v_list->'receipts') item
  where item.value->>'id'=v_receipt_renewal::text;
  if v_after->>'status' <> 'PAID'
     or pg_catalog.jsonb_array_length(v_after->'payments') <> 2
     or (select paid_amount from public.center_tuition_package_cycle_projection
         where id=v_prepared.id) <> 1600000
     or (select lifecycle_status from public.center_tuition_package_cycles
         where id=v_prepared.id) <> 'PREPARED' then
    raise exception 'f5b_receipt_final_projection_failed:%', v_after;
  end if;

  raise notice 'F5B_RECEIPT_LOCAL_DB_QA: PASS';
end
$qa$;

select 'F5B_RECEIPT_LOCAL_DB_QA: PASS';

rollback;
