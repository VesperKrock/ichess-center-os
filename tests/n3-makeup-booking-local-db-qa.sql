-- Only the guarded LOCAL runner executes these disposable rollback fixtures.
select set_config('request.jwt.claim.sub',current_setting('n2.qa.owner'),true);
create function pg_temp.n3_expect_failure(p_sql text,p_error text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if strpos(sqlerrm,p_error)=0 then raise; end if; return;
  end;
  raise exception 'Expected failure: %',p_error;
end $$;
create function pg_temp.n3_booking(p_operation text,p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('operation',p_operation,'studentId','n2_student_a',
    'sourceAttendanceLocalId',public.v2_3_internal_occurrence_attendance_local_id(
      'n2_qa_a','n2_schedule',current_setting('n2.qa.today')::date-42,'n2_student_a'))||p_extra
$$;
do $$
declare v_today date:=current_setting('n2.qa.today')::date; v_fact public.center_schedule_occurrences;
begin
  perform pg_temp.n2_qa_write(v_today-42,'n2_student_a','SET','absent',null,null);
  v_fact:=public.a2_internal_ensure_held_occurrence('n2_qa_a','n2_schedule',v_today-35,auth.uid());
  v_fact:=public.a2_internal_ensure_held_occurrence('n2_qa_a','n2_schedule',v_today-28,auth.uid());
  v_fact:=public.a2_internal_ensure_held_occurrence('n2_qa_a','n2_schedule',v_today-21,auth.uid());
  -- Deliberately non-roster A; destination authority remains frozen thereafter.
  update public.center_schedule_occurrences set roster_student_ids=array['n2_student_b']
    where center_id='n2_qa_a' and occurrence_date in (v_today-35,v_today-28,v_today-21);
  perform set_config('n3.qa.roster', (select md5(string_agg(to_jsonb(o)::text,'' order by occurrence_date))
    from public.center_schedule_occurrences o where center_id='n2_qa_a'),true);
end $$;
select pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
  'n2_qa_b',pg_temp.n3_booking('BOOK')),'n3_booking_access_denied');
select pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
  'n2_qa_a',pg_temp.n3_booking('BOOK',jsonb_build_object('sourceAttendanceLocalId','missing',
    'destinationScheduleId','n2_schedule','destinationDate',current_setting('n2.qa.today')::date-35))),'n3_booking_source_not_absent');
select pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
  'n2_qa_a',pg_temp.n3_booking('BOOK',jsonb_build_object('destinationScheduleId','n2_schedule',
    'destinationDate',current_setting('n2.qa.today')::date-42))),'n3_booking_source_ineligible');
select pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
  'n2_qa_a',pg_temp.n3_booking('BOOK',jsonb_build_object('destinationScheduleId','missing',
    'destinationDate',current_setting('n2.qa.today')::date-35))),'n3_booking_destination_invalid');
do $$
declare v_command jsonb; v_key uuid:=gen_random_uuid(); v_result jsonb;
begin
  v_command:=pg_temp.n3_booking('BOOK',jsonb_build_object('destinationScheduleId','n2_schedule',
    'destinationDate',current_setting('n2.qa.today')::date-35));
  v_result:=public.n3_mutate_makeup_booking('n2_qa_a',v_command,v_key);
  if not (public.n3_mutate_makeup_booking('n2_qa_a',v_command,v_key)->>'replayed')::boolean then raise exception 'booking replay failed'; end if;
  perform pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,%L::uuid)',
    'n2_qa_a',v_command||'{"operation":"CANCEL"}',v_key),'n3_booking_idempotency_conflict');
  perform pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
    'n2_qa_a',v_command),'n3_booking_already_planned');
  if (select sum(used_sessions) from public.center_tuition_package_cycle_projection where center_id='n2_qa_a')<>0
    or (select count(*) from public.center_business_audit_events where center_id='n2_qa_a')<>1 then
    raise exception 'booking counted tuition or wrote attendance/audit'; end if;
end $$;
select pg_temp.n3_expect_failure(format('select pg_temp.n2_qa_write(%L::date,%L,%L,%L,null,null)',
  current_setting('n2.qa.today')::date-35,'n2_student_a','SET','present'),'n2_student_not_in_occurrence_roster');
select pg_temp.n3_expect_failure(format('select pg_temp.n2_qa_write(%L::date,%L,%L,%L,null,null)',
  current_setting('n2.qa.today')::date-35,'n2_student_a','SET','absent'),'n2_student_not_in_occurrence_roster');
select pg_temp.n3_expect_failure(format('select pg_temp.n2_qa_write(%L::date,%L,%L,%L,null,%L)',
  current_setting('n2.qa.today')::date-35,'n2_student_a','SET','makeup','wrong-source'),'n2_student_not_in_occurrence_roster');
select pg_temp.n3_expect_failure(format('select pg_temp.n2_qa_write(%L::date,%L,%L,%L,null,null)',
  current_setting('n2.qa.today')::date-42,'n2_student_a','SET','present'),'n3_booked_absence_locked');
do $$
declare v_b public.center_makeup_bookings;
begin
  select * into v_b from public.center_makeup_bookings where center_id='n2_qa_a' and state='PLANNED';
  perform public.n3_mutate_makeup_booking('n2_qa_a',pg_temp.n3_booking('RESCHEDULE',jsonb_build_object(
    'bookingId',v_b.id,'expectedVersion',v_b.version,'destinationScheduleId','n2_schedule',
    'destinationDate',current_setting('n2.qa.today')::date-28)),gen_random_uuid());
  select * into v_b from public.center_makeup_bookings where id=v_b.id;
  perform public.n3_mutate_makeup_booking('n2_qa_a',pg_temp.n3_booking('CANCEL',jsonb_build_object(
    'bookingId',v_b.id,'expectedVersion',v_b.version)),gen_random_uuid());
  if exists(select 1 from public.center_makeup_bookings where center_id='n2_qa_a' and state='PLANNED') then raise exception 'cancel failed'; end if;
  if (select sum(used_sessions) from public.center_tuition_package_cycle_projection where center_id='n2_qa_a')<>0 then raise exception 'reschedule/cancel counted'; end if;
  perform public.n3_mutate_makeup_booking('n2_qa_a',pg_temp.n3_booking('BOOK',jsonb_build_object(
    'destinationScheduleId','n2_schedule','destinationDate',current_setting('n2.qa.today')::date-35)),gen_random_uuid());
end $$;
create function pg_temp.n3_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'n3_forced_audit_failure'; end $$;
create trigger n3_qa_fail before insert on public.center_business_audit_events for each row execute function pg_temp.n3_fail_audit();
select pg_temp.n3_expect_failure(format('select pg_temp.n2_qa_write(%L::date,%L,%L,%L,null,%L)',
  current_setting('n2.qa.today')::date-35,'n2_student_a','SET','makeup',
  public.v2_3_internal_occurrence_attendance_local_id('n2_qa_a','n2_schedule',current_setting('n2.qa.today')::date-42,'n2_student_a')),'n3_forced_audit_failure');
drop trigger n3_qa_fail on public.center_business_audit_events;
do $$
declare v_b public.center_makeup_bookings; v_cmd jsonb; v_key uuid:=gen_random_uuid(); v_result jsonb;
begin
  select * into v_b from public.center_makeup_bookings where center_id='n2_qa_a' and state='PLANNED';
  if public.n3_internal_booking_completed(v_b) or exists(select 1 from public.center_cloud_entities
    where center_id='n2_qa_a' and entity_type='attendance_record' and payload->>'attendanceStatus'='makeup')
    or (select sum(used_sessions) from public.center_tuition_package_cycle_projection where center_id='n2_qa_a')<>0 then
    raise exception 'failed B was not atomic'; end if;
  v_cmd:=pg_temp.n2_qa_command(current_setting('n2.qa.today')::date-35,'n2_student_a','SET','makeup',null,v_b.source_attendance_local_id);
  v_result:=public.v2_9_mutate_attendance_batch('n2_qa_a',v_cmd,v_key);
  perform public.v2_9_mutate_attendance_batch('n2_qa_a',v_cmd,v_key);
  if not public.n3_internal_booking_completed(v_b)
    or (select sum(used_sessions) from public.center_tuition_package_cycle_projection where center_id='n2_qa_a')<>1
    or (select count(*) from public.center_business_audit_events where center_id='n2_qa_a')<>2 then raise exception 'B count/completion/replay failed'; end if;
  if public.n3_list_makeup_booking_context('n2_qa_a',current_setting('n2.qa.today')::date-42,
    current_setting('n2.qa.today')::date)->'bookings'->0->>'state'<>'COMPLETED' then raise exception 'read completion failed'; end if;
  perform pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
    'n2_qa_a',pg_temp.n3_booking('CANCEL',jsonb_build_object('bookingId',v_b.id,'expectedVersion',v_b.version))),'n3_booking_already_completed');
  perform pg_temp.n2_qa_write(current_setting('n2.qa.today')::date-35,'n2_student_a','UNMARK',null,null,null);
  if public.n3_internal_booking_completed(v_b) or
    (select sum(used_sessions) from public.center_tuition_package_cycle_projection where center_id='n2_qa_a')<>0 then raise exception 'B correction failed'; end if;
  if (select md5(string_agg(to_jsonb(o)::text,'' order by occurrence_date)) from public.center_schedule_occurrences o
    where center_id='n2_qa_a')<>current_setting('n3.qa.roster') then raise exception 'permanent roster mutated'; end if;
end $$;
set local role authenticated;
select pg_temp.n3_expect_failure('insert into public.center_makeup_bookings(center_id) values (''n2_qa_a'')','permission denied');
select pg_temp.n3_expect_failure('select public.n3_internal_admit_booked_makeup(''n2_qa_a'',''a'',''b'',current_date,''c'')','permission denied');
reset role;
select set_config('request.jwt.claim.sub',current_setting('n2.qa.teacher'),true);
select pg_temp.n3_expect_failure(format('select public.n3_mutate_makeup_booking(%L,%L::jsonb,gen_random_uuid())',
  'n2_qa_a',pg_temp.n3_booking('BOOK')),'n3_booking_access_denied');
select 'N3 focused booking, zero contribution, B-only admission, atomic Audit rollback, correction, cancellation, replay, grants and isolation: PASS';
