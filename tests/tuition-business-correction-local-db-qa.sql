begin;

select pg_catalog.set_config('request.jwt.claims',
  pg_catalog.jsonb_build_object('sub','11111111-1111-4111-8111-111111111111','role','service_role')::text,
  true);
select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);

do $qa$
declare
  v_owner constant uuid := '11111111-1111-4111-8111-111111111111';
  v_member constant uuid := 'f5bc0000-0000-4000-8000-000000000001';
  v_package16 constant uuid := 'f5bc0000-0000-4000-8000-000000000002';
  v_package32 constant uuid := 'f5bc0000-0000-4000-8000-000000000003';
  v_category uuid;
  v_current public.center_tuition_package_cycles;
  v_prepared public.center_tuition_package_cycles;
  v_result jsonb;
  v_notice jsonb;
  v_receipt public.center_tuition_receipts;
  v_finance_command jsonb;
  v_payment_command jsonb;
  v_transaction public.finance_transaction;
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    raise exception 'TBC QA owner fixture missing';
  end if;
  insert into public.centers(id,name,environment,status)
    values ('tbc_local_qa','DreamHome','test','active');
  insert into public.center_members(id,center_id,user_id,role,status)
    values (v_member,'tbc_local_qa',v_owner,'owner','active');
  update public.center_crm_control
    set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1
    where center_id='tbc_local_qa';
  update public.center_operational_profiles
    set receipt_prefix='DH',renewal_material_fee_minor=90000
    where center_id='tbc_local_qa';
  v_result := public.v2_1_mutate_center_settings('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','UPDATE_CENTER_PROFILE',
      'expected_version',1,'display_name','DreamHome',
      'address','Địa chỉ QA','phone','0901 234 567','note','Local TBC QA',
      'renewal_material_fee_minor',90000,'receipt_prefix','DH',
      'default_receipt_collector_name','Hoàng Thị Vân'),
    'f5bc0000-0000-4000-8000-000000000005');
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'Settings save failed: %',v_result;
  end if;
  v_result := public.v2_1_list_center_settings('tbc_local_qa');
  if v_result#>>'{center,receipt_prefix}' <> 'DH'
     or (v_result#>>'{center,renewal_material_fee_minor}')::bigint <> 90000
     or v_result#>>'{center,default_receipt_collector_name}' <> 'Hoàng Thị Vân' then
    raise exception 'Settings reload failed: %',v_result;
  end if;
  select id into strict v_category from public.finance_category
    where center_id='tbc_local_qa' and name='Học phí' and not is_archived;
  insert into public.center_tuition_package_catalog(
    id,center_id,package_name,program_name,total_sessions,default_amount,
    is_active,note,created_by_membership_id,updated_by_membership_id,max_completion_weeks
  ) values
    (v_package16,'tbc_local_qa','Gói 16 buổi','Cờ vua',16,1600000,true,'',v_member,v_member,9),
    (v_package32,'tbc_local_qa','Gói 32 buổi','Cờ vua',32,3200000,true,'',v_member,v_member,18);
  v_result := public.v2_1_mutate_center_settings('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','UPDATE_TUITION_PACKAGE',
      'package_id',v_package32,'expected_version',1,
      'package_name','Gói 32 buổi','program_name','Cờ vua',
      'total_sessions',32,'max_completion_weeks',18,
      'default_amount',3200000,'is_active',true,'note',''),
    'f5bc0000-0000-4000-8000-000000000006');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select max_completion_weeks from public.center_tuition_package_catalog
       where id=v_package32) <> 18 then
    raise exception 'Package completion policy save failed: %',v_result;
  end if;
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('tbc_local_qa','student','student_qa',
      pg_catalog.jsonb_build_object('id','student_qa','fullName','Nguyễn Minh An','parentName','Nguyễn Thị Hạnh'),
      'tbc-qa','tbc-qa',1,v_owner,v_owner),
    ('tbc_local_qa','tuition_record_package','tuition_record_package::qa',
      pg_catalog.jsonb_build_object(
        'id','qa','studentId','student_qa','packageCatalogId',v_package16,
        'packageName','Gói 16 buổi','programName','Cờ vua','currentTermId','period_1',
        'currentTermNumber',1,'totalSessions',16,'usedSessions',14,
        'totalAmount',1600000,'paidAmount',0,'discountType','fixed',
        'discountValue',100000,'discountAmount',100000,'payments','[]'::jsonb,
        'termHistory','[]'::jsonb),
      'tuition','c5.2-authoritative-attendance-tuition-v1',1,v_owner,v_owner),
    ('tbc_local_qa','class_session','class_tue',
      pg_catalog.jsonb_build_object('id','class_tue','name','Thứ Ba','instructorName','Thầy A'),
      'schedule','tbc-qa',1,v_owner,v_owner),
    ('tbc_local_qa','class_session','class_sat',
      pg_catalog.jsonb_build_object('id','class_sat','name','Thứ Bảy','instructorName','Cô B'),
      'schedule','tbc-qa',1,v_owner,v_owner);
  insert into public.center_student_enrollment_sets(
    center_id,student_local_id,created_by_membership_id,updated_by_membership_id
  ) values ('tbc_local_qa','student_qa',v_member,v_member);
  insert into public.center_student_recurring_enrollments(
    center_id,student_local_id,class_session_local_id,weekdays,
    enrollment_set_version,created_by_membership_id
  ) values
    ('tbc_local_qa','student_qa','class_tue',array['tue'],1,v_member),
    ('tbc_local_qa','student_qa','class_sat',array['sat'],1,v_member);
  v_result := public.v2_4_mutate_package_cycle('tbc_local_qa',
    pg_catalog.jsonb_build_object(
      'operation','START_CYCLE','student_id','student_qa',
      'tuition_local_id','tuition_record_package::qa',
      'package_catalog_id',v_package16,'baseline_used_sessions',14,
      'baseline_cutoff_date','2026-09-01','baseline_review_note','TBC local QA baseline'),
    'f5bc0000-0000-4000-8000-000000000010');
  if v_result->>'ok' <> 'true' then raise exception 'START_CYCLE: %',v_result; end if;
  select * into strict v_current from public.center_tuition_package_cycles
    where center_id='tbc_local_qa' and cycle_number=1;
  v_result := public.tbhp_mutate_tuition_notice('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','CREATE_NOTICE',
      'notice_id','f5bc0000-0000-4000-8000-000000000011',
      'target_cycle_id',v_current.id,'expected_cycle_version',v_current.version),
    'f5bc0000-0000-4000-8000-000000000012');
  if v_result->>'outcome_code' <> 'RENEWAL_ONLY' then
    raise exception 'New registration must reject TBHP: %',v_result;
  end if;
  v_finance_command := pg_catalog.jsonb_build_object(
    'operation','CREATE_TRANSACTION','transaction_id','f5bc0000-0000-4000-8000-000000000020',
    'expected_version',0,'local_source_id','qa-payment-new','cashflow_type','INCOME',
    'category_id',v_category,'amount_minor',1500000,'transaction_date','2026-09-25',
    'method','transfer','person_name','Nguyễn Thị Hạnh','recorded_by_name','Hoàng Thị Vân',
    'note','Học phí','source_module','hoc-phi','source_type','tuition-payment',
    'source_payment_id','qa-payment-new','source_tuition_id',v_current.tuition_local_id,
    'source_student_id',v_current.student_local_id,'source_parent_id','',
    'source_period_id',v_current.payment_period_id,'attachment_action','KEEP');
  v_payment_command := pg_catalog.jsonb_build_object('operation','RECORD_PAYMENT',
    'receipt_id','f5bc0000-0000-4000-8000-000000000021',
    'target_cycle_id',v_current.id,'expected_cycle_version',v_current.version,
    'finance_command',v_finance_command);
  v_result := public.f5b_mutate_tuition_receipt('tbc_local_qa',v_payment_command,
    'f5bc0000-0000-4000-8000-000000000022');
  if v_result->>'outcome_code' <> 'COMMITTED' then raise exception 'NEW_PAYMENT: %',v_result; end if;
  if (select count(*) from public.finance_transaction where center_id='tbc_local_qa') <> 1 then
    raise exception 'New payment must create one Finance transaction';
  end if;
  select * into strict v_receipt from public.center_tuition_receipts
    where id='f5bc0000-0000-4000-8000-000000000021';
  if v_receipt.receipt_number <> 'DH-250926-001'
     or v_receipt.registration_classification <> 'NEW_REGISTRATION'
     or v_receipt.material_fee_minor <> 0
     or v_receipt.snapshot#>>'{customer,payerName}' <> 'Nguyễn Thị Hạnh'
     or v_receipt.snapshot#>>'{payment,collectorName}' <> 'Hoàng Thị Vân'
     or (select revision.snapshot#>>'{payment,collectorName}'
         from public.center_tuition_receipt_revisions revision
         where revision.receipt_id = v_receipt.id and revision.revision_number = 1) <> 'Hoàng Thị Vân'
     or v_receipt.finance_transaction_id <> 'f5bc0000-0000-4000-8000-000000000020' then
    raise exception 'New Receipt authority failed: %',pg_catalog.to_jsonb(v_receipt);
  end if;
  v_result := public.f5b_mutate_tuition_receipt('tbc_local_qa',v_payment_command,
    'f5bc0000-0000-4000-8000-000000000022');
  if v_result->>'replayed' <> 'true' then raise exception 'Payment replay failed: %',v_result; end if;
  if (select count(*) from public.finance_transaction where center_id='tbc_local_qa') <> 1 then
    raise exception 'Payment replay duplicated Finance';
  end if;
  v_result := public.v2_4_mutate_package_cycle('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
      'student_id','student_qa','current_cycle_id',v_current.id,
      'expected_version',v_current.version,'package_catalog_id',v_package32),
    'f5bc0000-0000-4000-8000-000000000030');
  if v_result->>'ok' <> 'true' then raise exception 'PREPARE: %',v_result; end if;
  select * into strict v_prepared from public.center_tuition_package_cycles
    where center_id='tbc_local_qa' and cycle_number=2;
  v_result := public.tbhp_mutate_tuition_notice('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','CREATE_NOTICE',
      'notice_id','f5bc0000-0000-4000-8000-000000000031',
      'target_cycle_id',v_prepared.id,'expected_cycle_version',v_prepared.version),
    'f5bc0000-0000-4000-8000-000000000032');
  if v_result->>'outcome_code' <> 'COMMITTED' then raise exception 'NOTICE: %',v_result; end if;
  select snapshot into strict v_notice from public.center_tuition_notices
    where id='f5bc0000-0000-4000-8000-000000000031';
  if pg_catalog.jsonb_array_length(v_notice->'scheduleRows') <> 32
     or v_notice#>>'{transfer,accountNumber}' <> '442228866'
     or v_notice#>>'{transfer,beneficiary}' <> 'CÔNG TY TNHH ICHESS VIET NAM'
     or (v_notice#>>'{money,materialFee}')::bigint <> 90000
     or (v_notice#>>'{tuition,maxCompletionWeeks}')::integer <> 18
     or (select pg_catalog.count(distinct row->>'teacherName') from
       pg_catalog.jsonb_array_elements(v_notice->'scheduleRows') row
       where row->>'source'='PLANNED') < 2
     or v_notice ? 'collector'
     or v_notice ? 'payment'
     or v_notice#>>'{registration,code}' <> 'RENEWAL' then
    raise exception 'NOTICE snapshot: %',v_notice;
  end if;
  if (select count(*) from public.finance_transaction where center_id='tbc_local_qa') <> 1 then
    raise exception 'TBHP created Finance income';
  end if;
  v_finance_command := v_finance_command
    || pg_catalog.jsonb_build_object(
      'transaction_id','f5bc0000-0000-4000-8000-000000000040',
      'local_source_id','qa-payment-renewal','source_payment_id','qa-payment-renewal',
      'amount_minor',3290000,'source_period_id',v_prepared.payment_period_id,
      'recorded_by_name','Trần Thị Mai');
  v_payment_command := pg_catalog.jsonb_build_object('operation','RECORD_PAYMENT',
    'receipt_id','f5bc0000-0000-4000-8000-000000000041',
    'target_cycle_id',v_prepared.id,'expected_cycle_version',v_prepared.version,
    'finance_command',v_finance_command);
  v_result := public.f5b_mutate_tuition_receipt('tbc_local_qa',v_payment_command,
    'f5bc0000-0000-4000-8000-000000000042');
  if v_result->>'outcome_code' <> 'COMMITTED' then raise exception 'RENEWAL_PAYMENT: %',v_result; end if;
  select * into strict v_receipt from public.center_tuition_receipts
    where id='f5bc0000-0000-4000-8000-000000000041';
  if v_receipt.receipt_number <> 'DH-250926-002'
     or v_receipt.registration_classification <> 'RENEWAL'
     or v_receipt.material_fee_minor <> 90000
     or v_receipt.snapshot#>>'{payment,collectorName}' <> 'Trần Thị Mai'
     or (select lifecycle_status from public.center_tuition_package_cycles
         where id=v_prepared.id) <> 'PREPARED' then
    raise exception 'Early payment activated cycle or Receipt mismatch';
  end if;
  v_result := public.v2_1_mutate_center_settings('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','UPDATE_CENTER_PROFILE',
      'expected_version',(select version from public.center_operational_profiles
        where center_id='tbc_local_qa'), 'display_name','DreamHome',
      'address','Địa chỉ QA','phone','0901 234 567','note','Local TBC QA',
      'renewal_material_fee_minor',90000,'receipt_prefix','DH',
      'default_receipt_collector_name','Phạm Thị Lan'),
    'f5bc0000-0000-4000-8000-000000000060');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (public.v2_1_list_center_settings('tbc_local_qa')
       #>>'{center,default_receipt_collector_name}') <> 'Phạm Thị Lan'
     or (select receipt.snapshot#>>'{payment,collectorName}'
         from public.center_tuition_receipts receipt
         where receipt.id='f5bc0000-0000-4000-8000-000000000021') <> 'Hoàng Thị Vân'
     or (select receipt.snapshot#>>'{payment,collectorName}'
         from public.center_tuition_receipts receipt
         where receipt.id='f5bc0000-0000-4000-8000-000000000041') <> 'Trần Thị Mai' then
    raise exception 'Collector default change rewrote historical Receipt: %',v_result;
  end if;
  v_result := public.tbhp_mutate_tuition_notice('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','CREATE_NOTICE',
      'notice_id','f5bc0000-0000-4000-8000-000000000046',
      'target_cycle_id',v_prepared.id,'expected_cycle_version',v_prepared.version),
    'f5bc0000-0000-4000-8000-000000000047');
  if v_result->>'outcome_code' <> 'PAYMENT_ALREADY_RECEIVED' then
    raise exception 'TBHP was issuable after payment: %',v_result;
  end if;
  v_result := public.f5b_mutate_tuition_receipt('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','REVISE_RECEIPT',
      'receipt_id',v_receipt.id,'expected_version',v_receipt.version,
      'correction_reason','Sửa hotline và người thu in sai',
      'corrections',pg_catalog.jsonb_build_object(
        'centerPhone','0909 111 222','collectorName','Bùi Minh Khánh')),
    'f5bc0000-0000-4000-8000-000000000043');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select count(*) from public.center_tuition_receipt_revisions
         where receipt_id=v_receipt.id) <> 2
     or (select revision.snapshot#>>'{payment,collectorName}'
         from public.center_tuition_receipt_revisions revision
         where revision.receipt_id=v_receipt.id and revision.revision_number=1) <> 'Trần Thị Mai'
     or (select revision.snapshot#>>'{payment,collectorName}'
         from public.center_tuition_receipt_revisions revision
         where revision.receipt_id=v_receipt.id and revision.revision_number=2) <> 'Bùi Minh Khánh' then
    raise exception 'Receipt revision failed: %',v_result;
  end if;
  select * into strict v_transaction from public.finance_transaction
    where id='f5bc0000-0000-4000-8000-000000000040';
  v_result := public.c5_4_void_tuition_payment('tbc_local_qa',v_transaction.id,
    v_transaction.source_payment_id,v_transaction.source_tuition_id,
    v_transaction.version,'QA hủy khoản thu','f5bc0000-0000-4000-8000-000000000044');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (public.f5b_list_tuition_receipts('tbc_local_qa')->'receipts'->0->>'status') is null then
    raise exception 'Void failed: %',v_result;
  end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.f5b_list_tuition_receipts('tbc_local_qa')->'receipts') item
      where item->>'id'=v_receipt.id::text and item->>'status'='VOIDED') then
    raise exception 'Receipt remained valid after void';
  end if;
  v_finance_command := v_finance_command || pg_catalog.jsonb_build_object(
    'transaction_id','f5bc0000-0000-4000-8000-000000000050',
    'local_source_id','qa-payment-repay','source_payment_id','qa-payment-repay',
    'transaction_date','2026-09-26');
  v_payment_command := pg_catalog.jsonb_build_object('operation','RECORD_PAYMENT',
    'receipt_id','f5bc0000-0000-4000-8000-000000000051',
    'target_cycle_id',v_prepared.id,'expected_cycle_version',v_prepared.version,
    'finance_command',v_finance_command);
  v_result := public.f5b_mutate_tuition_receipt('tbc_local_qa',v_payment_command,
    'f5bc0000-0000-4000-8000-000000000052');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select receipt_number from public.center_tuition_receipts
       where id='f5bc0000-0000-4000-8000-000000000051') <> 'DH-260926-001'
     or (select count(*) from public.finance_transaction
       where center_id='tbc_local_qa') <> 3 then
    raise exception 'Re-payment or next-day reset failed: %',v_result;
  end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.f5b_list_tuition_receipts('tbc_local_qa')->'receipts') item
      where item->>'id'='f5bc0000-0000-4000-8000-000000000051'
        and item->>'status'='ISSUED') then
    raise exception 'Re-payment did not yield a valid post-payment Receipt';
  end if;
  select * into strict v_transaction from public.finance_transaction
    where id='f5bc0000-0000-4000-8000-000000000050';
  v_result := public.c5_4_void_tuition_payment('tbc_local_qa',v_transaction.id,
    v_transaction.source_payment_id,v_transaction.source_tuition_id,
    v_transaction.version,'QA hủy khoản thu lại','f5bc0000-0000-4000-8000-000000000053');
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'Re-payment void failed: %',v_result;
  end if;
  select * into strict v_current from public.center_tuition_package_cycles
    where id=v_current.id;
  v_result := public.tbc_stop_tuition_continuation('tbc_local_qa',
    pg_catalog.jsonb_build_object('operation','STOP_CONTINUATION',
      'cycle_id',v_current.id,'expected_version',v_current.version,
      'reason','Phụ huynh xác nhận không tiếp tục'),
    'f5bc0000-0000-4000-8000-000000000045');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or v_result->>'debt_sessions' <> '0'
     or (select lifecycle_status from public.center_tuition_package_cycles
       where id=v_prepared.id) <> 'SUPERSEDED' then
    raise exception 'Explicit stop or debt preservation failed: %',v_result;
  end if;
  raise notice 'TUITION_BUSINESS_CORRECTION_LOCAL_DB_QA: PASS';
end
$qa$;

rollback;
