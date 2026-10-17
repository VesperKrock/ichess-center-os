-- Synthetic fixtures inside the caller's pinned LOCAL rollback transaction.
create temp table r3c_cycles_before as select id,to_jsonb(c) snapshot from public.center_tuition_package_cycles c;
create temp table r3c_read_before as select public.v2_4_list_package_cycle_state('recurring_local_qa') snapshot;
-- MIGRATION_INSERT_POINT

select pg_temp.check_ok(not exists(select 1 from r3c_cycles_before b
 join public.center_tuition_package_cycles c on c.id=b.id where to_jsonb(c)<>b.snapshot),'R3C existing cycle rows unchanged by migration');
select pg_temp.check_ok((select snapshot-'observed_server_at' from r3c_read_before)=
 (public.v2_4_list_package_cycle_state('recurring_local_qa')-'initial_import_overage_capability'-'observed_server_at'),
 'R3C existing canonical projection unchanged apart from capability');
select set_config('request.jwt.claims','{"sub":"17101700-0000-4000-8000-000000009001","role":"authenticated"}',true);
set local role authenticated;
do $guardian$
declare r jsonb; payload jsonb;
begin
 r:=public.c5_1_mutate_core_entity('recurring_local_qa','class_session','r3c-local-class',0,
   '{"id":"r3c-local-class","name":"LOCAL R3C class","daysOfWeek":["sat","sun"],"startTime":"08:30","endTime":"10:00","status":"active"}',
   '17101700-0000-4000-8000-000000006001','UPSERT');
 perform pg_temp.check_ok(r->>'ok'='true','canonical LOCAL class');
 payload:='{"id":"r3c-no-guardian","fullName":"LOCAL child without guardian","birthDate":"","birthYear":2021,"birthDatePrecision":"YEAR_ONLY","fatherName":"","fatherPhone":"","motherName":"","motherPhone":"","parentName":"","parentPhone":"","schoolName":"","level":"Turtle 2","currentStatus":"Đang theo học"}';
 r:=public.v2_2_mutate_student_with_enrollments('recurring_local_qa','r3c-no-guardian',0,payload,0,
   '[{"class_session_id":"r3c-local-class","weekdays":["sat","sun"]}]','17101700-0000-4000-8000-000000006002','UPSERT');
 perform pg_temp.check_ok(r->>'ok'='true' and r->>'student_version'='1','CREATE guardian-free via canonical V2.2');
 perform pg_temp.check_ok(public.v2_2_mutate_student_with_enrollments('recurring_local_qa','r3c-no-guardian',0,payload,0,
   '[{"class_session_id":"r3c-local-class","weekdays":["sat","sun"]}]','17101700-0000-4000-8000-000000006002','UPSERT')->>'replayed'='true','guardian-free create replay');
 payload:=payload||'{"homeName":"LOCAL edit without contact"}';
 r:=public.v2_2_mutate_student_with_enrollments('recurring_local_qa','r3c-no-guardian',1,payload,1,
   '[{"class_session_id":"r3c-local-class","weekdays":["sat","sun"]}]','17101700-0000-4000-8000-000000006003','UPSERT');
 perform pg_temp.check_ok(r->>'ok'='true' and r->>'student_version'='2' and r#>>'{enrollment_set,version}'='2','EDIT guardian-free via canonical V2.2');
 perform pg_temp.check_ok(r#>>'{student_payload,birthYear}'='2021' and r#>>'{student_payload,birthDate}'='' and r#>>'{student_payload,parentPhone}'='','no fabricated DOB/contact on EDIT');
 r:=public.v2_2_mutate_student_with_enrollments('recurring_local_qa','r3c-overage',0,
   '{"id":"r3c-overage","fullName":"LOCAL source overage","birthDate":"2012-03-25"}',0,'[]',
   '17101700-0000-4000-8000-000000006004','UPSERT');
 perform pg_temp.check_ok(r->>'ok'='true','overage Student canonical fixture');
end $guardian$;

do $one_off$
declare cycle_id uuid; snapshot jsonb; student jsonb; c jsonb; r jsonb; b uuid;
begin
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object(
   'operation','IMPORT_INITIAL_BASELINE','student_id','r3c-no-guardian',
   'package_catalog_id','17101700-0000-4000-8000-000000000016','expected_package_version',1,
   'total_sessions',16,'baseline_used_sessions',2,'listed_price_minor',2750000,
   'baseline_cutoff_date',((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1)::text,
   'source_sha256',repeat('e',64),'source_key',repeat('f',64),'review_note','LOCAL first-time10percent; no recurring policy.',
   'financial_facts',jsonb_build_object('discountKind','PERCENT','percent',10,'fixedMinor',0,'siblingVoucherMinor',0,
     'paymentState','PAID_BEFORE_ICHESS','sourceDueMinor',2475000,'collectedMinor',2475000,'remainingMinor',0)),
   '17101700-0000-4000-8000-000000006009');
 perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','guardian-free canonical first-time IMPORT');
 b:=(r->>'baseline_id')::uuid;
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','ADOPT_INITIAL_BASELINE',
   'student_id','r3c-no-guardian','baseline_id',b,'expected_baseline_version',1,'expected_package_version',1,
   'review_note','LOCAL first-time10percent only; no contacts fabricated.','recurring_discount_policy',null),
   '17101700-0000-4000-8000-000000006010');
 perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','guardian-free canonical first-time ADOPT');
 cycle_id:=(r->>'cycle_id')::uuid;
 snapshot:=public.v2_4_list_package_cycle_state('recurring_local_qa');
 select value into student from jsonb_array_elements(snapshot->'students') where value->>'student_id'='r3c-no-guardian';
 c:=student->'current_cycle';
 perform pg_temp.check_ok(c->>'used_sessions'='2' and c->>'total_sessions'='16'
   and c->>'amount_due'='2475000' and c->>'payment_status'='PAID' and c->>'recurring_discount_policy' is null,
   'guardian-free source2/16 paid first-time10percent only');
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
   'student_id','r3c-no-guardian','current_cycle_id',cycle_id,'expected_version',c->'version',
   'package_catalog_id','17101700-0000-4000-8000-000000000016'),'17101700-0000-4000-8000-000000006008');
 snapshot:=public.v2_4_list_package_cycle_state('recurring_local_qa');
 select value into student from jsonb_array_elements(snapshot->'students') where value->>'student_id'='r3c-no-guardian';
 perform pg_temp.check_ok(student#>>'{prepared_next_cycle,discount_amount}'='0'
   and student#>>'{prepared_next_cycle,recurring_discount_policy}' is null,'first-time10percent does not repeat');
end $one_off$;

do $overage$
declare command jsonb; r jsonb; snap jsonb; student jsonb; c jsonb; b uuid; next_id uuid; malformed jsonb;
begin
 command:=jsonb_build_object('operation','IMPORT_INITIAL_BASELINE','student_id','r3c-overage',
   'package_catalog_id','17101700-0000-4000-8000-000000000024','expected_package_version',1,
   'total_sessions',24,'baseline_used_sessions',25,'listed_price_minor',4125000,
   'baseline_cutoff_date',((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1)::text,
   'source_sha256',repeat('c',64),'source_key',repeat('d',64),'review_note','LOCAL verified 25/24. Extra session not priced or allocated.',
   'financial_facts',jsonb_build_object('discountKind','PERCENT','percent',5,'fixedMinor',0,'siblingVoucherMinor',0,
      'paymentState','PAID_BEFORE_ICHESS','sourceDueMinor',3918750,'collectedMinor',3918750,'remainingMinor',0));
 perform pg_temp.expect_error(format('select public.v2_4_mutate_package_cycle(%L,%L::jsonb,%L::uuid)',
   'recurring_local_qa',command::text,md5('r3c-no-explicit-overage')),'INITIAL_IMPORT_OVERAGE_REVIEW_REQUIRED');
 for malformed in select value from jsonb_array_elements('[0,2,-1,1.5,"1",null,true]') loop
   perform pg_temp.expect_error(format('select public.v2_4_mutate_package_cycle(%L,%L::jsonb,%L::uuid)',
     'recurring_local_qa',(command||jsonb_build_object('source_overage_sessions',malformed))::text,md5('r3c-invalid-overage')),'INITIAL_IMPORT_OVERAGE_REVIEW_REQUIRED');
 end loop;
 command:=command||jsonb_build_object('source_overage_sessions',1);
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',command,'17101700-0000-4000-8000-000000006005');
 perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','explicit source25/24 import');b:=(r->>'baseline_id')::uuid;
 perform pg_temp.check_ok(public.v2_4_mutate_package_cycle('recurring_local_qa',command,'17101700-0000-4000-8000-000000006005')->>'replayed'='true','overage import idempotent');
 snap:=public.v2_4_list_package_cycle_state('recurring_local_qa');
 select value into student from jsonb_array_elements(snap->'students') where value->>'student_id'='r3c-overage';
 perform pg_temp.check_ok(student#>>'{initial_import_baseline,used_sessions}'='25'
   and student#>>'{initial_import_baseline,total_sessions}'='24'
   and student#>>'{initial_import_baseline,source_overage_sessions}'='1'
   and student->>'current_cycle' is null,'pending source25/24 is exact;no cycle');
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','ADOPT_INITIAL_BASELINE',
   'student_id','r3c-overage','baseline_id',b,'expected_baseline_version',1,'expected_package_version',1,
   'review_note','LOCAL source overage remains unpriced; no next term created.',
   'recurring_discount_policy',jsonb_build_object('schemaVersion',1,'discountKind','PERCENT','percent',5,'fixedMinor',0,'siblingVoucherMinor',0)),
   '17101700-0000-4000-8000-000000006006');
 perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','ADOPT source25/24');
 snap:=public.v2_4_list_package_cycle_state('recurring_local_qa');
 select value into student from jsonb_array_elements(snap->'students') where value->>'student_id'='r3c-overage';c:=student->'current_cycle';
 perform pg_temp.check_ok(c->>'used_sessions'='25' and c->>'total_sessions'='24' and c->>'remaining_sessions'='0'
   and c#>>'{initial_import,source_overage_sessions}'='1','current source25/24 exact');
 perform pg_temp.check_ok(c->>'payment_status'='PAID' and c->>'amount_due'='3918750'
   and c->>'amount_outstanding'='0' and c#>>'{recurring_discount_policy,percent}'='5','old24 paid truth and future5percent, no overage invoice');
 perform pg_temp.check_ok(jsonb_array_length(student->'cycles')=1 and student->>'prepared_next_cycle' is null,'ADOPT does not fabricate successor');
 perform public.v2_4_list_package_cycle_state('recurring_local_qa');
 perform public.v2_4_list_package_cycle_state('recurring_local_qa');
 r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
   'student_id','r3c-overage','current_cycle_id',c->>'id','expected_version',c->'version',
   'package_catalog_id','17101700-0000-4000-8000-000000000024'),'17101700-0000-4000-8000-000000006007');
 perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','LOCAL explicit legitimate prepare');next_id:=(r->>'cycle_id')::uuid;
 snap:=public.v2_4_list_package_cycle_state('recurring_local_qa');
 select value into student from jsonb_array_elements(snap->'students') where value->>'student_id'='r3c-overage';
 perform pg_temp.check_ok(exists(select 1 from jsonb_array_elements(student->'cycles') x
   where x->>'id'=next_id::text and x->>'cycle_number'='2' and x->>'used_sessions'='0'
     and x#>>'{recurring_discount_policy,percent}'='5' and x->>'discount_amount'='206250'),
   'next legitimate term5percent; no automatic old overage allocation');
 perform pg_temp.check_ok(exists(select 1 from jsonb_array_elements(student->'cycles') x
   where x#>>'{initial_import,source_overage_sessions}'='1' and x->>'used_sessions'='25'),'original25/24 retained in history');
end $overage$;
reset role;

do $scoped_guard$
declare c public.center_tuition_package_cycles; before_count integer;
begin
 select * into c from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='r3c-overage' and cycle_number=1;
 perform pg_temp.expect_error(format('update public.center_tuition_package_cycles set initial_import_baseline_id=null where id=%L::uuid',c.id),'INITIAL_OVERAGE_SOURCE_CONFLICT');
 perform pg_temp.expect_error(format('update public.center_tuition_package_cycles set baseline_used_sessions=26 where id=%L::uuid',c.id),'INITIAL_OVERAGE_SOURCE_CONFLICT');
 perform pg_temp.expect_error(format('update public.center_tuition_package_cycles set student_local_id=%L where id=%L::uuid','legacy',c.id),'INITIAL_OVERAGE_SOURCE_CONFLICT');
 perform pg_temp.check_ok((select count(*)=1 from public.finance_transaction where center_id='recurring_local_qa'),'R3C zero additional Finance');
 perform pg_temp.check_ok((select count(*)=1 from public.center_tuition_receipts where center_id='recurring_local_qa'),'R3C zero additional Receipt');
 perform pg_temp.check_ok(not exists(select 1 from public.center_tuition_attendance_contributions where center_id='recurring_local_qa' and student_local_id in ('r3c-overage','r3c-no-guardian')),'R3C no fabricated Attendance');
 perform pg_temp.check_ok(not has_table_privilege('authenticated','public.center_tuition_package_cycles','insert')
   and not has_table_privilege('authenticated','public.center_tuition_initial_import_baselines','insert'),'raw writes still unavailable');
 perform pg_temp.check_ok(not exists(select 1 from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='student' and local_id='r3c-no-guardian'
   and (payload->>'parentName'<>'' or payload->>'parentPhone'<>'' or payload->>'birthDate'<>'')),'no fake guardian or DOB');
end $scoped_guard$;
select jsonb_build_object('r3c_snapshot',public.v2_4_list_package_cycle_state('recurring_local_qa'),
 'students',(select jsonb_agg(payload) from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='student'),
 'post_functions',(select jsonb_agg(jsonb_build_object('name',proname,'sha256',encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex'),
   'owner',pg_get_userbyid(proowner),'acl',proacl,'security_definer',prosecdef,
   'args',pg_get_function_identity_arguments(oid),'configuration',proconfig)) from pg_proc
   where oid in ('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure,'public.tuition_final_guard_cycle_terms()'::regprocedure,
     'public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure,'public.v2_4_list_package_cycle_state(text)'::regprocedure)));
select 'R3C_LOCAL_GUARDIAN_FREE_AND_EXACT25_OVER24_PASS';
