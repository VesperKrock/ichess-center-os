-- Append after the existing A4 fixture inside the same BEGIN/ROLLBACK.
-- Prove changed-row-only V2.3 payload and optimistic versions at the server.
do $$
declare
  v_date date := pg_catalog.current_setting('a4.qa.today')::date - 28;
  v_command jsonb;
  v_expected jsonb;
  v_result jsonb;
  v_local_id text;
begin
  v_command := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a4_student_a','source','admin','attendance_status','present',
    'payload','{}'::jsonb,'expected_records','[]'::jsonb));
  v_result := public.v2_3_mutate_occurrence_attendance(
    'a4_qa_makeup_2709','a4_schedule',v_date,v_command,null,
    'a5000000-0000-4000-8000-000000000201');
  if v_result->>'ok'<>'true' then raise exception 'a5_qa_present_failed'; end if;
  if exists(select 1 from public.center_cloud_entities where center_id='a4_qa_makeup_2709'
    and entity_type='attendance_record' and payload->>'date'=v_date::text
    and payload->>'studentId'='a4_student_b') then
    raise exception 'a5_qa_untouched_student_mutated'; end if;
  if (select count(*) from public.center_tuition_attendance_contributions
    where center_id='a4_qa_makeup_2709' and student_local_id='a4_student_a'
      and occurrence_date=v_date and contribution_units=1)<>1 then
    raise exception 'a5_qa_present_count_wrong'; end if;

  v_result := public.v2_3_mutate_occurrence_attendance(
    'a4_qa_makeup_2709','a4_schedule',v_date,v_command,null,
    'a5000000-0000-4000-8000-000000000201');
  if v_result->>'replayed'<>'true' then raise exception 'a5_qa_retry_wrong'; end if;
  select local_id,pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'local_id',local_id,'version',entity_version)) into v_local_id,v_expected
    from public.center_cloud_entities where center_id='a4_qa_makeup_2709'
      and entity_type='attendance_record' and payload->>'date'=v_date::text
      and payload->>'studentId'='a4_student_a' and deleted_at is null;

  v_command := pg_catalog.jsonb_set(v_command,'{0,attendance_status}','"absent"'::jsonb);
  begin
    perform public.v2_3_mutate_occurrence_attendance(
      'a4_qa_makeup_2709','a4_schedule',v_date,v_command,null,
      'a5000000-0000-4000-8000-000000000202');
    raise exception 'a5_qa_stale_draft_overwrote';
  exception when others then
    if sqlerrm='a5_qa_stale_draft_overwrote'
      or position('v2_3_attendance_version_conflict' in sqlerrm)=0 then raise; end if;
  end;
  if not exists(select 1 from public.center_cloud_entities
    where center_id='a4_qa_makeup_2709' and local_id=v_local_id
      and payload->>'attendanceStatus'='present' and entity_version=1) then
    raise exception 'a5_qa_conflict_changed_attendance'; end if;

  v_command := pg_catalog.jsonb_set(v_command,'{0,expected_records}',v_expected);
  v_result := public.v2_3_mutate_occurrence_attendance(
    'a4_qa_makeup_2709','a4_schedule',v_date,v_command,null,
    'a5000000-0000-4000-8000-000000000203');
  if v_result->>'ok'<>'true' then raise exception 'a5_qa_absent_correction_failed'; end if;
  if (select count(*) from public.center_cloud_entities where center_id='a4_qa_makeup_2709'
    and entity_type='attendance_record' and payload->>'date'=v_date::text
    and payload->>'studentId'='a4_student_a' and deleted_at is null)<>1
    or not exists(select 1 from public.center_cloud_entities
      where center_id='a4_qa_makeup_2709' and local_id=v_local_id
        and payload->>'attendanceStatus'='absent' and entity_version=2)
    or (select count(*) from public.center_tuition_attendance_contributions
      where center_id='a4_qa_makeup_2709' and student_local_id='a4_student_a'
        and occurrence_date=v_date and contribution_units=0)<>1 then
    raise exception 'a5_qa_correction_created_duplicate_or_count_wrong'; end if;
  -- The second student has no active cycle. Attendance is still permitted.
  v_command := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'student_id','a4_student_b','source','admin','attendance_status','present',
    'payload','{}'::jsonb,'expected_records','[]'::jsonb));
  v_result := public.v2_3_mutate_occurrence_attendance(
    'a4_qa_makeup_2709','a4_schedule',v_date,v_command,null,
    'a5000000-0000-4000-8000-000000000204');
  if v_result->>'ok'<>'true' then raise exception 'a5_qa_no_active_cycle_attendance_blocked'; end if;
end $$;
select 'A5_TRANSACTION_QA_PASS';
