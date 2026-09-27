begin;

select pg_catalog.set_config('request.jwt.claims',
  (select pg_catalog.jsonb_build_object('sub',member.user_id,'role','service_role')::text
   from public.center_members member
   where member.status='active'
   order by case when member.role='owner' then 0 else 1 end, member.created_at
   limit 1),
  true
);

do $qa$
declare
  v_owner uuid := auth.uid();
  v_member constant uuid := '26092600-0000-4000-8000-000000000001';
  v_package constant uuid := '26092600-0000-4000-8000-000000000002';
  v_category uuid;
  v_cycle public.center_tuition_package_cycles;
  v_next public.center_tuition_package_cycles;
  v_debt_cycle public.center_tuition_package_cycles;
  v_result jsonb;
  v_document jsonb;
  v_finance jsonb;
  v_payment jsonb;
  v_before_finance integer;
  v_index integer;
  v_date date;
  v_attendance_id text;
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    raise exception 'TUITION SIMPLE CORE QA owner fixture missing';
  end if;

  insert into public.centers(id,name,environment,status)
    values ('tuition_simple_core_qa','Tuition Simple Core QA','test','active');
  insert into public.center_members(id,center_id,user_id,role,status)
    values (v_member,'tuition_simple_core_qa',v_owner,'owner','active');
  update public.center_operational_profiles
  set receipt_prefix='QA', renewal_material_fee_minor=0,
      display_name='Tuition Simple Core QA', address='QA', phone='0900000000'
  where center_id='tuition_simple_core_qa';
  select id into strict v_category from public.finance_category
  where center_id='tuition_simple_core_qa' and name='Học phí' and not is_archived;

  insert into public.center_tuition_package_catalog(
    id,center_id,package_name,program_name,total_sessions,default_amount,
    is_active,note,created_by_membership_id,updated_by_membership_id,max_completion_weeks
  ) values (
    v_package,'tuition_simple_core_qa','Gói 16 buổi','Cờ vua',16,1600000,
    true,'',v_member,v_member,9
  );
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('tuition_simple_core_qa','student','simple_student',
      pg_catalog.jsonb_build_object('id','simple_student','fullName','Học viên Simple','parentName','Phụ huynh Simple'),
      'tuition-simple-qa','v1',1,v_owner,v_owner),
    ('tuition_simple_core_qa','tuition_record_package','tuition_record_package::simple',
      pg_catalog.jsonb_build_object(
        'id','simple','studentId','simple_student','packageCatalogId',v_package,
        'packageName','Gói 16 buổi','programName','Cờ vua','currentTermId','simple_period_1',
        'currentTermNumber',1,'totalSessions',16,'usedSessions',0,
        'totalAmount',1600000,'paidAmount',0,'discountType','none',
        'discountValue',0,'discountAmount',0,'payments','[]'::jsonb,'termHistory','[]'::jsonb
      ), 'tuition','v1',1,v_owner,v_owner);

  v_result := public.v2_4_mutate_package_cycle('tuition_simple_core_qa',
    pg_catalog.jsonb_build_object(
      'operation','START_CYCLE','student_id','simple_student',
      'tuition_local_id','tuition_record_package::simple',
      'package_catalog_id',v_package,'baseline_used_sessions',0,
      'baseline_cutoff_date','2026-08-31','baseline_review_note','Simple core QA'
    ), '26092600-0000-4000-8000-000000000010');
  if v_result->>'ok' <> 'true' then raise exception 'START_CYCLE: %',v_result; end if;
  select * into strict v_cycle from public.center_tuition_package_cycles
  where center_id='tuition_simple_core_qa' and student_local_id='simple_student'
    and cycle_number=1;

  -- Payment is the only money event. A deliberately oversized old-style
  -- local source id must be canonicalized before the protected Finance check.
  v_finance := pg_catalog.jsonb_build_object(
    'operation','CREATE_TRANSACTION','transaction_id','26092600-0000-4000-8000-000000000020',
    'expected_version',0,'local_source_id',pg_catalog.repeat('x',231),'cashflow_type','INCOME',
    'category_id',v_category,'amount_minor',1600000,'transaction_date','2026-09-20',
    'method','transfer','person_name','Phụ huynh Simple','recorded_by_name','Admin QA',
    'note','','source_module','hoc-phi','source_type','tuition-payment',
    'source_payment_id','tuition-payment:26092600-0000-4000-8000-000000000020',
    'source_tuition_id',v_cycle.tuition_local_id,'source_student_id',v_cycle.student_local_id,
    'source_parent_id','','source_period_id',v_cycle.payment_period_id,'attachment_action','KEEP'
  );
  v_payment := pg_catalog.jsonb_build_object(
    'operation','RECORD_PAYMENT','receipt_id','26092600-0000-4000-8000-000000000021',
    'target_cycle_id',v_cycle.id,'expected_cycle_version',v_cycle.version,
    'finance_command',v_finance
  );
  v_result := public.f5b_mutate_tuition_receipt(
    'tuition_simple_core_qa',v_payment,'26092600-0000-4000-8000-000000000022'
  );
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select count(*) from public.finance_transaction where center_id='tuition_simple_core_qa') <> 1
     or (select count(*) from public.center_tuition_receipts where center_id='tuition_simple_core_qa') <> 1
     or (select pg_catalog.length(local_source_id) from public.finance_transaction
         where id='26092600-0000-4000-8000-000000000020') <> 80 then
    raise exception 'Atomic Payment -> Finance -> Receipt or bounded source failed: %',v_result;
  end if;
  v_result := public.f5b_mutate_tuition_receipt(
    'tuition_simple_core_qa',v_payment,'26092600-0000-4000-8000-000000000022'
  );
  if v_result->>'replayed' <> 'true'
     or (select count(*) from public.finance_transaction where center_id='tuition_simple_core_qa') <> 1
     or (select count(*) from public.center_tuition_receipts where center_id='tuition_simple_core_qa') <> 1 then
    raise exception 'Payment retry duplicated money state: %',v_result;
  end if;

  -- Six canonical occurred sessions.
  for v_index in 1..6 loop
    v_date := date '2026-09-01' + v_index;
    v_attendance_id := public.v2_3_internal_occurrence_attendance_local_id(
      'tuition_simple_core_qa','simple_schedule_'||v_index,v_date,'simple_student'
    );
    insert into public.center_cloud_entities(
      center_id,entity_type,local_id,payload,source_module,source_version,
      entity_version,created_by,updated_by
    ) values
      ('tuition_simple_core_qa','schedule_session','simple_schedule_'||v_index,
        pg_catalog.jsonb_build_object('id','simple_schedule_'||v_index,'date',v_date,
          'teacherName',case when v_index % 2=0 then 'Cô QA' else 'Thầy QA' end,
          'scheduleType','oneOff','studentIds',pg_catalog.jsonb_build_array('simple_student')),
        'schedule','v1',1,v_owner,v_owner),
      ('tuition_simple_core_qa','attendance_record',v_attendance_id,
        pg_catalog.jsonb_build_object('id',v_attendance_id,'authorityLocalId',v_attendance_id,
          'attendanceAuthority','v2.3-occurrence-v1','studentId','simple_student',
          'date',v_date,'scheduleSessionId','simple_schedule_'||v_index,
          'sessionId','simple_schedule_'||v_index,'source','admin',
          'attendanceStatus','present','teacherName',case when v_index % 2=0 then 'Cô QA' else 'Thầy QA' end,
          'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,
          'tuitionConsumptionApplied',false,'countsTowardTuition',false,
          'counted',false,'creditValue',0),
        'attendance','v1',1,v_owner,v_owner);
  end loop;
  perform public.v2_4_internal_reconcile_student('tuition_simple_core_qa','simple_student',v_owner);
  select count(*) into v_before_finance from public.finance_transaction
  where center_id='tuition_simple_core_qa';
  v_result := public.tbhp_get_printable_document('tuition_simple_core_qa',v_cycle.id);
  v_document := v_result#>'{document,snapshot}';
  if v_result->>'outcome_code' <> 'PRINTABLE_DOCUMENT'
     or (v_document#>>'{currentProgress,usedSessions}')::integer <> 6
     or pg_catalog.jsonb_array_length(v_document->'scheduleRows') <> 16
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where (row->>'sessionNumber')::integer <= 6
           and row->>'source'='ACTUAL' and row->>'date' <> '' and row->>'teacherName' <> '') <> 6
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where (row->>'sessionNumber')::integer > 6
           and row->>'source'='UNRESOLVED' and row->>'date' is null and row->>'teacherName'='') <> 10
     or exists (select 1 from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source'='PLANNED')
     or (select count(*) from public.finance_transaction
         where center_id='tuition_simple_core_qa') <> v_before_finance then
    raise exception 'Story A 6/16 TBHP failed: %',v_result;
  end if;

  -- Early renewal at 6/16: payment creates its receipt but does not activate
  -- or replace the current cycle.
  select * into strict v_cycle from public.center_tuition_package_cycles where id=v_cycle.id;
  v_result := public.v2_4_mutate_package_cycle('tuition_simple_core_qa',
    pg_catalog.jsonb_build_object(
      'operation','PREPARE_NEXT_CYCLE','student_id','simple_student',
      'current_cycle_id',v_cycle.id,'expected_version',v_cycle.version,
      'package_catalog_id',v_package
    ), '26092600-0000-4000-8000-000000000030');
  if v_result->>'ok' <> 'true' then raise exception 'EARLY PREPARE: %',v_result; end if;
  select * into strict v_next from public.center_tuition_package_cycles
  where center_id='tuition_simple_core_qa' and student_local_id='simple_student' and cycle_number=2;
  v_finance := v_finance || pg_catalog.jsonb_build_object(
    'transaction_id','26092600-0000-4000-8000-000000000031',
    'local_source_id',pg_catalog.repeat('y',231),
    'source_payment_id','tuition-payment:26092600-0000-4000-8000-000000000031',
    'source_period_id',v_next.payment_period_id,'transaction_date','2026-09-21'
  );
  v_result := public.f5b_mutate_tuition_receipt('tuition_simple_core_qa',
    pg_catalog.jsonb_build_object(
      'operation','RECORD_PAYMENT','receipt_id','26092600-0000-4000-8000-000000000032',
      'target_cycle_id',v_next.id,'expected_cycle_version',v_next.version,
      'finance_command',v_finance
    ), '26092600-0000-4000-8000-000000000033');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select lifecycle_status from public.center_tuition_package_cycles where id=v_next.id) <> 'PREPARED'
     or (select count(*) from public.center_tuition_receipts where center_id='tuition_simple_core_qa') <> 2 then
    raise exception 'Story D early renewal failed: %',v_result;
  end if;

  -- Reach N-2. The same TBHP remains printable and Finance does not change.
  for v_index in 7..14 loop
    v_date := date '2026-09-01' + v_index;
    v_attendance_id := public.v2_3_internal_occurrence_attendance_local_id(
      'tuition_simple_core_qa','simple_schedule_'||v_index,v_date,'simple_student'
    );
    insert into public.center_cloud_entities(
      center_id,entity_type,local_id,payload,source_module,source_version,
      entity_version,created_by,updated_by
    ) values
      ('tuition_simple_core_qa','schedule_session','simple_schedule_'||v_index,
        pg_catalog.jsonb_build_object('id','simple_schedule_'||v_index,'date',v_date,
          'teacherName','Thầy QA','scheduleType','oneOff',
          'studentIds',pg_catalog.jsonb_build_array('simple_student')),
        'schedule','v1',1,v_owner,v_owner),
      ('tuition_simple_core_qa','attendance_record',v_attendance_id,
        pg_catalog.jsonb_build_object('id',v_attendance_id,'authorityLocalId',v_attendance_id,
          'attendanceAuthority','v2.3-occurrence-v1','studentId','simple_student',
          'date',v_date,'scheduleSessionId','simple_schedule_'||v_index,
          'sessionId','simple_schedule_'||v_index,'source','admin',
          'attendanceStatus','present','teacherName','Thầy QA',
          'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,
          'tuitionConsumptionApplied',false,'countsTowardTuition',false,
          'counted',false,'creditValue',0),
        'attendance','v1',1,v_owner,v_owner);
  end loop;
  perform public.v2_4_internal_reconcile_student('tuition_simple_core_qa','simple_student',v_owner);
  select count(*) into v_before_finance from public.finance_transaction
  where center_id='tuition_simple_core_qa';
  v_result := public.tbhp_get_printable_document('tuition_simple_core_qa',v_cycle.id);
  v_document := v_result#>'{document,snapshot}';
  if (v_document#>>'{currentProgress,usedSessions}')::integer <> 14
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source'='ACTUAL') <> 14
     or (select count(*) from pg_catalog.jsonb_array_elements(v_document->'scheduleRows') row
         where row->>'source'='UNRESOLVED') <> 2
     or (select count(*) from public.finance_transaction
         where center_id='tuition_simple_core_qa') <> v_before_finance then
    raise exception 'Story B N-2 TBHP failed: %',v_result;
  end if;

  -- Separate student: 18 attended sessions create an unpaid cycle at 2/16.
  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('tuition_simple_core_qa','student','debt_student',
      pg_catalog.jsonb_build_object('id','debt_student','fullName','Học viên Nợ'),
      'tuition-simple-qa','v1',1,v_owner,v_owner),
    ('tuition_simple_core_qa','tuition_record_package','tuition_record_package::debt',
      pg_catalog.jsonb_build_object(
        'id','debt','studentId','debt_student','packageCatalogId',v_package,
        'packageName','Gói 16 buổi','programName','Cờ vua','currentTermId','debt_period_1',
        'currentTermNumber',1,'totalSessions',16,'usedSessions',0,'totalAmount',1600000,
        'paidAmount',0,'discountType','none','discountAmount',0,
        'payments','[]'::jsonb,'termHistory','[]'::jsonb
      ), 'tuition','v1',1,v_owner,v_owner);
  v_result := public.v2_4_mutate_package_cycle('tuition_simple_core_qa',
    pg_catalog.jsonb_build_object(
      'operation','START_CYCLE','student_id','debt_student',
      'tuition_local_id','tuition_record_package::debt','package_catalog_id',v_package,
      'baseline_used_sessions',0,'baseline_cutoff_date','2026-08-31',
      'baseline_review_note','Debt QA'
    ), '26092600-0000-4000-8000-000000000040');
  if v_result->>'ok' <> 'true' then raise exception 'DEBT START: %',v_result; end if;
  for v_index in 1..18 loop
    v_date := date '2026-09-01' + v_index;
    v_attendance_id := public.v2_3_internal_occurrence_attendance_local_id(
      'tuition_simple_core_qa','debt_schedule_'||v_index,v_date,'debt_student'
    );
    insert into public.center_cloud_entities(
      center_id,entity_type,local_id,payload,source_module,source_version,
      entity_version,created_by,updated_by
    ) values
      ('tuition_simple_core_qa','schedule_session','debt_schedule_'||v_index,
        pg_catalog.jsonb_build_object('id','debt_schedule_'||v_index,'date',v_date,
          'teacherName','Cô Debt QA','scheduleType','oneOff',
          'studentIds',pg_catalog.jsonb_build_array('debt_student')),
        'schedule','v1',1,v_owner,v_owner),
      ('tuition_simple_core_qa','attendance_record',v_attendance_id,
        pg_catalog.jsonb_build_object('id',v_attendance_id,'authorityLocalId',v_attendance_id,
          'attendanceAuthority','v2.3-occurrence-v1','studentId','debt_student',
          'date',v_date,'scheduleSessionId','debt_schedule_'||v_index,
          'sessionId','debt_schedule_'||v_index,'source','admin',
          'attendanceStatus','present','teacherName','Cô Debt QA',
          'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,
          'tuitionConsumptionApplied',false,'countsTowardTuition',false,
          'counted',false,'creditValue',0),
        'attendance','v1',1,v_owner,v_owner);
  end loop;
  perform public.v2_4_internal_reconcile_student('tuition_simple_core_qa','debt_student',v_owner);
  select cycle.* into strict v_debt_cycle
  from public.center_tuition_package_cycles cycle
  join public.center_tuition_package_cycle_projection projection on projection.id=cycle.id
  where cycle.center_id='tuition_simple_core_qa' and cycle.student_local_id='debt_student'
    and cycle.cycle_number=2 and projection.used_sessions=2
    and projection.payment_status='UNPAID';
  v_finance := v_finance || pg_catalog.jsonb_build_object(
    'transaction_id','26092600-0000-4000-8000-000000000041',
    'local_source_id',pg_catalog.repeat('z',231),
    'source_payment_id','tuition-payment:26092600-0000-4000-8000-000000000041',
    'source_tuition_id',v_debt_cycle.tuition_local_id,
    'source_student_id',v_debt_cycle.student_local_id,
    'source_period_id',v_debt_cycle.payment_period_id,'transaction_date','2026-09-22'
  );
  v_result := public.f5b_mutate_tuition_receipt('tuition_simple_core_qa',
    pg_catalog.jsonb_build_object(
      'operation','RECORD_PAYMENT','receipt_id','26092600-0000-4000-8000-000000000042',
      'target_cycle_id',v_debt_cycle.id,'expected_cycle_version',v_debt_cycle.version,
      'finance_command',v_finance
    ), '26092600-0000-4000-8000-000000000043');
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (select used_sessions from public.center_tuition_package_cycle_projection
         where id=v_debt_cycle.id) <> 2
     or (select payment_status from public.center_tuition_package_cycle_projection
         where id=v_debt_cycle.id) <> 'PAID'
     or (select count(*) from public.center_tuition_attendance_contributions
         where cycle_id=v_debt_cycle.id and ended_at is null and contribution_units=1) <> 2 then
    raise exception 'Story E debt 2/16 late payment failed: %',v_result;
  end if;

  raise notice 'TUITION_SIMPLE_CORE_LOCAL_DB_QA: PASS';
end
$qa$;

rollback;
