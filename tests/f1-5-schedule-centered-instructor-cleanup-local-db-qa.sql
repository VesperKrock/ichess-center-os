begin;

do $f1_5_security$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles owner_role on owner_role.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname = 'f1_5_internal_reconcile_schedule_instructor_state'
      and procedure.prosecdef is true
      and procedure.proconfig = array['search_path=""']
      and owner_role.rolname = 'postgres'
  ) then
    raise exception 'f1_5_reconcile_security_context_invalid';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    where pg_catalog.has_function_privilege(
      roles.role_name,
      'public.f1_5_internal_reconcile_schedule_instructor_state()',
      'EXECUTE'
    )
  ) then
    raise exception 'f1_5_internal_reconcile_execute_grant_widened';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles owner_role on owner_role.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname = 'v2_2_internal_guard_core_identity'
      and procedure.prosecdef is true
      and procedure.proconfig = array['search_path=""']
      and owner_role.rolname = 'postgres'
  ) then
    raise exception 'f1_5_v2_2_guard_security_context_invalid';
  end if;

  if pg_catalog.has_table_privilege('service_role', 'public.center_access_governance', 'SELECT') then
    raise exception 'f1_5_governance_select_widened';
  end if;

  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '202609200001'
      and name = 'f1_5_schedule_centered_instructor_cleanup'
  ) then
    raise exception 'f1_5_migration_ledger_missing';
  end if;
end;
$f1_5_security$;

do $f1_5_seed$
declare
  users uuid[];
begin
  select array_agg(id order by id) into users
  from (select id from auth.users order by id limit 3) source;
  if coalesce(array_length(users, 1), 0) < 3 then
    raise exception 'f1_5_qa_requires_three_local_auth_users';
  end if;

  perform pg_catalog.set_config('f1_5.qa.owner', users[1]::text, true);
  perform pg_catalog.set_config('f1_5.qa.admin', users[2]::text, true);
  perform pg_catalog.set_config('f1_5.qa.other_owner', users[3]::text, true);

  insert into public.centers(id, name, slug, environment, status)
  values
    ('f1_5_qa_a', 'F1.5 QA A', 'f1-5-qa-a', 'test', 'active'),
    ('f1_5_qa_b', 'F1.5 QA B', 'f1-5-qa-b', 'test', 'active');

  insert into public.center_members(center_id, user_id, role, status)
  values
    ('f1_5_qa_a', users[1], 'owner', 'active'),
    ('f1_5_qa_a', users[2], 'center_admin', 'active'),
    ('f1_5_qa_b', users[3], 'owner', 'active');
end;
$f1_5_seed$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1_5.qa.owner'), true);

do $f1_5_owner_writes$
declare
  result jsonb;
begin
  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'student', 'student-a', 0,
    '{"id":"student-a","fullName":"Synthetic Student","assignedTeacherId":"obsolete-id","mainTeacherName":"Obsolete Name"}'::jsonb,
    '15000000-0000-4000-8000-000000000001', 'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result->'payload' ? 'assignedTeacherId'
     or result->'payload' ? 'mainTeacherName' then
    raise exception 'f1_5_student_boundary_failed';
  end if;

  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'class_session', 'slot-a', 0,
    '{"id":"slot-a","daysOfWeek":["mon"],"startTime":"09:00","endTime":"10:30","status":"active","instructorName":"  Synthetic Slot Instructor  "}'::jsonb,
    '15000000-0000-4000-8000-000000000002', 'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result#>>'{payload,instructorName}' <> 'Synthetic Slot Instructor' then
    raise exception 'f1_5_slot_instructor_trim_failed';
  end if;

  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'class_session', 'slot-null', 0,
    '{"id":"slot-null","daysOfWeek":["tue"],"startTime":"11:00","endTime":"12:00","status":"active","instructorName":""}'::jsonb,
    '15000000-0000-4000-8000-000000000003', 'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result->'payload' ? 'instructorName' then
    raise exception 'f1_5_slot_null_not_supported';
  end if;

  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'schedule_session', 'recurring-a', 0,
    '{"id":"recurring-a","scheduleType":"recurring","classSessionId":"slot-a","dayOfWeek":"monday","teacherId":"registry-id","teacherName":"schedule-copy","status":"scheduled"}'::jsonb,
    '15000000-0000-4000-8000-000000000004', 'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result->'payload' ? 'teacherId'
     or result->'payload' ? 'teacherName' then
    raise exception 'f1_5_recurring_schedule_boundary_failed';
  end if;

  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'schedule_session', 'one-off-a', 0,
    '{"id":"one-off-a","scheduleType":"oneOff","date":"2026-09-21","teacherName":"Synthetic Actual Instructor","status":"scheduled"}'::jsonb,
    '15000000-0000-4000-8000-000000000005', 'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result#>>'{payload,teacherName}' <> 'Synthetic Actual Instructor' then
    raise exception 'f1_5_one_off_actual_instructor_lost';
  end if;
end;
$f1_5_owner_writes$;

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1_5.qa.admin'), true);

do $f1_5_admin_same_center$
begin
  if not exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a'
      and entity_type = 'class_session'
      and local_id = 'slot-a'
      and payload->>'instructorName' = 'Synthetic Slot Instructor'
  ) then
    raise exception 'f1_5_admin_same_center_read_failed';
  end if;
end;
$f1_5_admin_same_center$;

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1_5.qa.other_owner'), true);

do $f1_5_cross_center$
declare
  result jsonb;
begin
  if exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a'
  ) then
    raise exception 'f1_5_cross_center_read_leak';
  end if;

  result := public.c5_1_mutate_core_entity(
    'f1_5_qa_a', 'class_session', 'slot-a', 1,
    '{"id":"slot-a","instructorName":"Forbidden"}'::jsonb,
    '15000000-0000-4000-8000-000000000006', 'UPSERT'
  );
  if result->>'outcome_code' <> 'CENTER_ACCESS_DENIED' then
    raise exception 'f1_5_cross_center_mutation_was_not_denied: %', result;
  end if;
end;
$f1_5_cross_center$;

reset role;

alter table public.center_cloud_entities disable trigger f1_5_enforce_schedule_centered_instructor;
alter table public.center_cloud_entities disable trigger v2_2_guard_core_identity;
alter table public.center_cloud_entities disable trigger v2_3_guard_occurrence_attendance;

insert into public.center_cloud_entities(center_id, entity_type, local_id, payload, entity_version)
values
  ('f1_5_qa_a', 'student', 'legacy-student', '{"id":"legacy-student","assignedTeacherId":"obsolete-id","mainTeacherName":"Obsolete Name"}'::jsonb, 3),
  ('f1_5_qa_a', 'schedule_session', 'legacy-orphan', '{"id":"legacy-orphan","scheduleType":"recurring","classSessionId":"missing-slot","teacherId":"historical-id","teacherName":"Historical Snapshot","status":"scheduled"}'::jsonb, 4),
  ('f1_5_qa_a', 'schedule_session', 'legacy-one-off', '{"id":"legacy-one-off","scheduleType":"oneOff","date":"2026-09-20","teacherName":"Historical Actual","status":"done"}'::jsonb, 5),
  ('f1_5_qa_a', 'attendance_record', 'history-attendance', '{"id":"history-attendance","teacherName":"Historical Attendance Snapshot"}'::jsonb, 6),
  ('f1_5_qa_a', 'session_report', 'history-report', '{"id":"history-report","teacherName":"Historical Report Snapshot"}'::jsonb, 7);

alter table public.center_cloud_entities enable trigger v2_2_guard_core_identity;

do $f1_5_reconcile$
declare
  result jsonb;
begin
  result := public.f1_5_internal_reconcile_schedule_instructor_state();
  if (result->>'student_assignments_removed')::bigint <> 1
     or (result->>'orphan_recurrences_retired')::bigint <> 1 then
    raise exception 'f1_5_reconcile_counts_failed: %', result;
  end if;

  if exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a' and local_id = 'legacy-student'
      and (payload ? 'assignedTeacherId' or payload ? 'mainTeacherName')
  ) then
    raise exception 'f1_5_legacy_student_cleanup_failed';
  end if;

  if not exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a' and local_id = 'legacy-orphan'
      and payload->>'isDeleted' = 'true'
      and payload->>'futureRecurrenceRetired' = 'true'
      and payload->>'retirementReason' = 'orphaned-class-session'
      and payload->>'teacherId' = 'historical-id'
      and payload->>'teacherName' = 'Historical Snapshot'
      and entity_version = 5
  ) then
    raise exception 'f1_5_orphan_retirement_or_history_preservation_failed';
  end if;

  if not exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a' and local_id = 'legacy-one-off'
      and payload->>'teacherName' = 'Historical Actual' and entity_version = 5
  ) or not exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a' and local_id = 'history-attendance'
      and payload->>'teacherName' = 'Historical Attendance Snapshot' and entity_version = 6
  ) or not exists (
    select 1 from public.center_cloud_entities
    where center_id = 'f1_5_qa_a' and local_id = 'history-report'
      and payload->>'teacherName' = 'Historical Report Snapshot' and entity_version = 7
  ) then
    raise exception 'f1_5_legitimate_history_changed';
  end if;
end;
$f1_5_reconcile$;

rollback;
