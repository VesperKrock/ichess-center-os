-- Run only against the existing local ichess-center-os Supabase database after
-- applying 202609090001. All V2-2 fixtures and temporary fault-injection DDL
-- live inside this transaction and are rolled back at the end.
begin;

do $$
declare
  v_users uuid[];
begin
  select array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 4) source;
  if coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'v2_2_qa_requires_four_local_auth_users';
  end if;

  perform set_config('v2_2.qa.owner_user_id', v_users[1]::text, true);
  perform set_config('v2_2.qa.admin_user_id', v_users[2]::text, true);
  perform set_config('v2_2.qa.teacher_user_id', v_users[3]::text, true);
  perform set_config('v2_2.qa.other_owner_user_id', v_users[4]::text, true);

  insert into public.centers(id, name, environment, status)
  values
    ('v22_qa_center_a', 'V2.2 QA A', 'test', 'active'),
    ('v22_qa_center_b', 'V2.2 QA B', 'test', 'active');

  insert into public.center_members(center_id, user_id, role, status)
  values
    ('v22_qa_center_a', v_users[1], 'owner', 'active'),
    ('v22_qa_center_a', v_users[2], 'center_admin', 'active'),
    ('v22_qa_center_a', v_users[3], 'teacher', 'active'),
    ('v22_qa_center_b', v_users[4], 'owner', 'active');

  insert into public.center_cloud_entities(
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values
    (
      'v22_qa_center_a', 'class_session', 'v22_class_wed_fri',
      jsonb_build_object(
        'id', 'v22_class_wed_fri', 'displayLabel', 'T4 - T6 19:00 - 20:30',
        'daysOfWeek', jsonb_build_array('wed', 'fri'), 'status', 'active'
      ),
      'v2.2-qa', 'v2.2-qa', 1, v_users[1], v_users[1]
    ),
    (
      'v22_qa_center_a', 'class_session', 'v22_class_sat',
      jsonb_build_object(
        'id', 'v22_class_sat', 'displayLabel', 'T7 09:00 - 10:30',
        'daysOfWeek', jsonb_build_array('sat'), 'status', 'active'
      ),
      'v2.2-qa', 'v2.2-qa', 1, v_users[1], v_users[1]
    ),
    (
      'v22_qa_center_a', 'class_session', 'v22_class_sun',
      jsonb_build_object(
        'id', 'v22_class_sun', 'displayLabel', 'CN 14:00 - 15:30',
        'daysOfWeek', jsonb_build_array('sun'), 'status', 'active'
      ),
      'v2.2-qa', 'v2.2-qa', 1, v_users[1], v_users[1]
    ),
    (
      'v22_qa_center_b', 'class_session', 'v22_class_other_center',
      jsonb_build_object(
        'id', 'v22_class_other_center', 'displayLabel', 'Other center',
        'daysOfWeek', jsonb_build_array('fri'), 'status', 'active'
      ),
      'v2.2-qa', 'v2.2-qa', 1, v_users[4], v_users[4]
    ),
    (
      'v22_qa_center_a', 'student', 'v22_legacy_single',
      jsonb_build_object('id', 'v22_legacy_single', 'fullName', 'Legacy single',
        'classSessionIds', jsonb_build_array('v22_class_sat')),
      'v2.2-qa', 'v2.2-qa', 1, v_users[1], v_users[1]
    ),
    (
      'v22_qa_center_a', 'student', 'v22_legacy_multi',
      jsonb_build_object('id', 'v22_legacy_multi', 'fullName', 'Legacy multi',
        'classSessionIds', jsonb_build_array('v22_class_wed_fri')),
      'v2.2-qa', 'v2.2-qa', 1, v_users[1], v_users[1]
    );
end
$$;

-- A missing enrollment set remains legacy/unreviewed. The migration itself
-- never invents weekdays or silently backfills classSessionIds.
do $$
begin
  if exists (
    select 1 from public.center_student_enrollment_sets
    where center_id = 'v22_qa_center_a'
      and student_local_id in ('v22_legacy_single', 'v22_legacy_multi')
  ) then
    raise exception 'v2_2_qa_legacy_silent_backfill_detected';
  end if;
end
$$;

set local role authenticated;
do $$
begin
  begin
    perform pg_catalog.nextval('public.center_student_enrollment_audit_events_id_seq'::pg_catalog.regclass);
    raise exception 'qa_authenticated_audit_sequence_usage_was_not_denied';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Fault injection after the nested C5.1 Student write proves both authorities
-- roll back together if V2-2 audit/finalization cannot commit.
create function public.v2_2_qa_force_audit_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_local_id = 'v22_atomic_failure' then
    raise exception 'v2_2_qa_forced_post_student_failure';
  end if;
  return new;
end
$$;
create trigger v2_2_qa_force_audit_failure
before insert on public.center_student_enrollment_audit_events
for each row execute function public.v2_2_qa_force_audit_failure();

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_2.qa.owner_user_id'), true);

do $$
begin
  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_atomic_failure', 0,
      jsonb_build_object('id', 'v22_atomic_failure', 'fullName', 'Atomic failure'),
      0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat')
      )),
      '00000000-0000-4000-8000-000000000001', 'UPSERT'
    );
    raise exception 'v2_2_qa_atomic_failure_not_raised';
  exception when others then
    if sqlerrm = 'v2_2_qa_atomic_failure_not_raised' then raise; end if;
    if position('v2_2_qa_forced_post_student_failure' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.center_cloud_entities
    where center_id = 'v22_qa_center_a' and entity_type = 'student'
      and local_id = 'v22_atomic_failure'
  ) or exists (
    select 1 from public.center_student_enrollment_sets
    where center_id = 'v22_qa_center_a' and student_local_id = 'v22_atomic_failure'
  ) or exists (
    select 1 from public.center_core_command_result
    where center_id = 'v22_qa_center_a'
      and idempotency_key = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'v2_2_qa_atomic_rollback_failed';
  end if;
end
$$;

drop trigger v2_2_qa_force_audit_failure on public.center_student_enrollment_audit_events;
drop function public.v2_2_qa_force_audit_failure();

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_2.qa.owner_user_id'), true);

do $$
declare
  v_result jsonb;
  v_retry jsonb;
  v_snapshot jsonb;
  v_student_version bigint;
  v_enrollment_version bigint;
begin
  -- One Student, multiple stable class/session enrollments: one selected day
  -- from a multi-day class, both selected days, plus a second class.
  v_result := public.v2_2_mutate_student_with_enrollments(
    'v22_qa_center_a', 'v22_student_owner', 0,
    jsonb_build_object(
      'id', 'v22_student_owner', 'fullName', 'Owner student',
      'currentStatus', 'Đang theo học',
      'classSessionIds', jsonb_build_array('must', 'be', 'stripped'),
      'recurringEnrollments', jsonb_build_array('must-be-stripped')
    ),
    0,
    jsonb_build_array(
      jsonb_build_object('class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('fri')),
      jsonb_build_object('class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat'))
    ),
    '10000000-0000-4000-8000-000000000001', 'UPSERT'
  );
  if not coalesce((v_result->>'ok')::boolean, false)
     or (v_result->>'student_version')::bigint <> 1
     or (v_result->'enrollment_set'->>'version')::bigint <> 1 then
    raise exception 'v2_2_qa_owner_atomic_create_failed';
  end if;
  if (select payload ? 'classSessionIds' or payload ? 'recurringEnrollments'
      from public.center_cloud_entities
      where center_id = 'v22_qa_center_a' and entity_type = 'student'
        and local_id = 'v22_student_owner') then
    raise exception 'v2_2_qa_duplicate_student_payload_authority';
  end if;
  v_snapshot := public.v2_2_list_student_enrollments('v22_qa_center_a');
  if jsonb_array_length(v_snapshot->'enrollment_sets'->0->'enrollments') <> 2 then
    raise exception 'v2_2_qa_multiple_enrollment_failed';
  end if;

  v_retry := public.v2_2_mutate_student_with_enrollments(
    'v22_qa_center_a', 'v22_student_owner', 0,
    jsonb_build_object(
      'id', 'v22_student_owner', 'fullName', 'Owner student',
      'currentStatus', 'Đang theo học',
      'classSessionIds', jsonb_build_array('must', 'be', 'stripped'),
      'recurringEnrollments', jsonb_build_array('must-be-stripped')
    ),
    0,
    jsonb_build_array(
      jsonb_build_object('class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('fri')),
      jsonb_build_object('class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat'))
    ),
    '10000000-0000-4000-8000-000000000001', 'UPSERT'
  );
  if not coalesce((v_retry->>'replayed')::boolean, false)
     or v_retry->>'student_version' <> v_result->>'student_version'
     or v_retry->'enrollment_set'->>'version' <> v_result->'enrollment_set'->>'version' then
    raise exception 'v2_2_qa_exact_retry_not_stable';
  end if;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_student_owner', 0,
      jsonb_build_object('id', 'v22_student_owner', 'fullName', 'Changed intent'),
      0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('wed')
      )),
      '10000000-0000-4000-8000-000000000001', 'UPSERT'
    );
    raise exception 'v2_2_qa_changed_intent_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_changed_intent_accepted' then raise; end if;
    if position('v2_2_idempotency_conflict' in sqlerrm) = 0 then raise; end if;
  end;

  -- Update the same multi-day class to both valid days.
  v_student_version := (v_result->>'student_version')::bigint;
  v_enrollment_version := (v_result->'enrollment_set'->>'version')::bigint;
  v_result := public.v2_2_mutate_student_with_enrollments(
    'v22_qa_center_a', 'v22_student_owner', v_student_version,
    jsonb_build_object('id', 'v22_student_owner', 'fullName', 'Owner student',
      'currentStatus', 'Đang theo học'),
    v_enrollment_version,
    jsonb_build_array(
      jsonb_build_object('class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('wed', 'fri')),
      jsonb_build_object('class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat')),
      jsonb_build_object('class_session_id', 'v22_class_sun', 'weekdays', jsonb_build_array('sun'))
    ),
    '10000000-0000-4000-8000-000000000002', 'UPSERT'
  );
  v_snapshot := public.v2_2_list_student_enrollments('v22_qa_center_a');
  if (v_result->'enrollment_set'->>'version')::bigint <> 2
     or jsonb_array_length(v_snapshot->'enrollment_sets'->0->'enrollments') <> 3 then
    raise exception 'v2_2_qa_multi_day_or_mixed_week_update_failed';
  end if;

  v_snapshot := public.v2_2_list_student_enrollments('v22_qa_center_a');
  if not coalesce((v_snapshot->>'ok')::boolean, false)
     or jsonb_array_length(v_snapshot->'enrollment_sets') <> 1 then
    raise exception 'v2_2_qa_authoritative_snapshot_failed';
  end if;

  -- Stale Student and enrollment versions both fail without partial writes.
  v_student_version := (v_result->>'student_version')::bigint;
  v_enrollment_version := (v_result->'enrollment_set'->>'version')::bigint;
  v_result := public.v2_2_mutate_student_with_enrollments(
    'v22_qa_center_a', 'v22_student_owner', v_student_version - 1,
    jsonb_build_object('id', 'v22_student_owner', 'fullName', 'Stale Student'),
    v_enrollment_version,
    jsonb_build_array(jsonb_build_object(
      'class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('fri')
    )),
    '10000000-0000-4000-8000-000000000003', 'UPSERT'
  );
  if v_result->>'outcome_code' <> 'VERSION_CONFLICT' then
    raise exception 'v2_2_qa_stale_student_version_accepted';
  end if;
  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_student_owner', v_student_version,
      jsonb_build_object('id', 'v22_student_owner', 'fullName', 'Stale enrollment'),
      v_enrollment_version - 1,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('fri')
      )),
      '10000000-0000-4000-8000-000000000004', 'UPSERT'
    );
    raise exception 'v2_2_qa_stale_enrollment_version_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_stale_enrollment_version_accepted' then raise; end if;
    if position('v2_2_enrollment_version_conflict' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

-- Owner and Admin have ordinary operational parity.
select set_config('request.jwt.claim.sub', current_setting('v2_2.qa.admin_user_id'), true);
do $$
declare
  v_result jsonb;
begin
  v_result := public.v2_2_mutate_student_with_enrollments(
    'v22_qa_center_a', 'v22_student_admin', 0,
    jsonb_build_object('id', 'v22_student_admin', 'fullName', 'Admin student',
      'currentStatus', 'Đang theo học'),
    0,
    jsonb_build_array(jsonb_build_object(
      'class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('wed')
    )),
    '20000000-0000-4000-8000-000000000001', 'UPSERT'
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'v2_2_qa_admin_parity_failed';
  end if;
end
$$;

-- Teacher is intentionally not an enrollment mutation authority.
select set_config('request.jwt.claim.sub', current_setting('v2_2.qa.teacher_user_id'), true);
do $$
begin
  begin
    perform public.v2_2_list_student_enrollments('v22_qa_center_a');
    raise exception 'v2_2_qa_unauthorized_role_read_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_unauthorized_role_read_accepted' then raise; end if;
    if position('v2_2_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_2.qa.owner_user_id'), true);
do $$
begin
  -- Server rejects duplicate class truth, duplicate days, invalid days, and
  -- valid days borrowed from a different class or center.
  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_invalid_duplicate_class', 0,
      jsonb_build_object('id', 'v22_invalid_duplicate_class'), 0,
      jsonb_build_array(
        jsonb_build_object('class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat')),
        jsonb_build_object('class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat'))
      ), '30000000-0000-4000-8000-000000000001', 'UPSERT'
    );
    raise exception 'v2_2_qa_duplicate_class_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_duplicate_class_accepted' then raise; end if;
    if position('v2_2_duplicate_student_class' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_invalid_duplicate_day', 0,
      jsonb_build_object('id', 'v22_invalid_duplicate_day'), 0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('sat', 'T7')
      )), '30000000-0000-4000-8000-000000000002', 'UPSERT'
    );
    raise exception 'v2_2_qa_duplicate_day_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_duplicate_day_accepted' then raise; end if;
    if position('v2_2_invalid_weekday' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_invalid_weekday', 0,
      jsonb_build_object('id', 'v22_invalid_weekday'), 0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_sat', 'weekdays', jsonb_build_array('noday')
      )), '30000000-0000-4000-8000-000000000003', 'UPSERT'
    );
    raise exception 'v2_2_qa_invalid_weekday_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_invalid_weekday_accepted' then raise; end if;
    if position('v2_2_invalid_weekday' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_invalid_subset', 0,
      jsonb_build_object('id', 'v22_invalid_subset'), 0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_wed_fri', 'weekdays', jsonb_build_array('sun')
      )), '30000000-0000-4000-8000-000000000004', 'UPSERT'
    );
    raise exception 'v2_2_qa_non_subset_weekday_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_non_subset_weekday_accepted' then raise; end if;
    if position('v2_2_weekday_not_in_class' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_a', 'v22_cross_center_class', 0,
      jsonb_build_object('id', 'v22_cross_center_class'), 0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_other_center', 'weekdays', jsonb_build_array('fri')
      )), '30000000-0000-4000-8000-000000000005', 'UPSERT'
    );
    raise exception 'v2_2_qa_cross_center_class_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_cross_center_class_accepted' then raise; end if;
    if position('v2_2_class_session_not_found' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_list_student_enrollments('v22_qa_center_b');
    raise exception 'v2_2_qa_cross_center_read_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_cross_center_read_accepted' then raise; end if;
    if position('v2_2_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'v22_qa_center_b', 'v22_cross_center_student', 0,
      jsonb_build_object('id', 'v22_cross_center_student'), 0,
      jsonb_build_array(jsonb_build_object(
        'class_session_id', 'v22_class_other_center', 'weekdays', jsonb_build_array('fri')
      )), '30000000-0000-4000-8000-000000000006', 'UPSERT'
    );
    raise exception 'v2_2_qa_cross_center_write_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_cross_center_write_accepted' then raise; end if;
    if position('v2_2_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

-- Active enrollment days protect class/session edits, while recurring TKB
-- records require the stable classSessionId and a day in that class.
do $$
declare
  v_result jsonb;
begin
  begin
    perform public.c5_1_mutate_core_entity(
      'v22_qa_center_a', 'class_session', 'v22_class_wed_fri', 1,
      jsonb_build_object('id', 'v22_class_wed_fri', 'displayLabel', 'T6 only',
        'daysOfWeek', jsonb_build_array('fri'), 'status', 'active'),
      '40000000-0000-4000-8000-000000000001', 'UPSERT'
    );
    raise exception 'v2_2_qa_class_weekday_corruption_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_class_weekday_corruption_accepted' then raise; end if;
    if position('v2_2_class_weekday_in_use' in sqlerrm) = 0 then raise; end if;
  end;
  if (select entity_version from public.center_cloud_entities
      where center_id = 'v22_qa_center_a' and entity_type = 'class_session'
        and local_id = 'v22_class_wed_fri') <> 1 then
    raise exception 'v2_2_qa_class_changed_after_rejection';
  end if;

  v_result := public.c5_1_mutate_core_entity(
    'v22_qa_center_a', 'schedule_session', 'v22_schedule_fri', 0,
    jsonb_build_object(
      'id', 'v22_schedule_fri', 'scheduleType', 'recurring',
      'classSessionId', 'v22_class_wed_fri', 'dayOfWeek', 'fri'
    ), '40000000-0000-4000-8000-000000000002', 'UPSERT'
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'v2_2_qa_stable_schedule_link_rejected';
  end if;

  begin
    perform public.c5_1_mutate_core_entity(
      'v22_qa_center_a', 'schedule_session', 'v22_schedule_fuzzy', 0,
      jsonb_build_object(
        'id', 'v22_schedule_fuzzy', 'scheduleType', 'recurring',
        'title', 'T4 - T6 19:00 - 20:30', 'dayOfWeek', 'fri'
      ), '40000000-0000-4000-8000-000000000003', 'UPSERT'
    );
    raise exception 'v2_2_qa_fuzzy_schedule_link_accepted';
  exception when others then
    if sqlerrm = 'v2_2_qa_fuzzy_schedule_link_accepted' then raise; end if;
    if position('v2_2_schedule_class_link_required' in sqlerrm) = 0 then raise; end if;
  end;

  -- One-off participation remains independent from recurring enrollment.
  v_result := public.c5_1_mutate_core_entity(
    'v22_qa_center_a', 'schedule_session', 'v22_schedule_oneoff', 0,
    jsonb_build_object(
      'id', 'v22_schedule_oneoff', 'scheduleType', 'oneOff',
      'date', '2026-09-09', 'dayOfWeek', 'wed',
      'studentIds', jsonb_build_array('guest-student')
    ), '40000000-0000-4000-8000-000000000004', 'UPSERT'
  );
  if not coalesce((v_result->>'ok')::boolean, false) then
    raise exception 'v2_2_qa_oneoff_regression';
  end if;
end
$$;

-- Browser roles have RPC-only access: direct DML remains denied.
do $$
begin
  begin
    update public.center_student_enrollment_sets
    set version = version + 1
    where center_id = 'v22_qa_center_a';
    raise exception 'v2_2_qa_direct_dml_accepted';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

reset role;

do $$
declare
  v_table text;
begin
  -- Two rows from version 1 are ended and three rows from version 2 are active.
  if (select count(*) from public.center_student_recurring_enrollments
      where center_id = 'v22_qa_center_a' and student_local_id = 'v22_student_owner') <> 5
     or (select count(*) from public.center_student_recurring_enrollments
         where center_id = 'v22_qa_center_a' and student_local_id = 'v22_student_owner'
           and ended_at is null) <> 3 then
    raise exception 'v2_2_qa_enrollment_history_not_preserved';
  end if;

  foreach v_table in array array[
    'center_student_enrollment_sets',
    'center_student_recurring_enrollments',
    'center_student_enrollment_command_results',
    'center_student_enrollment_audit_events'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'v2_2_qa_rls_force_missing_%', v_table;
    end if;
    if pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, 'DELETE')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, 'TRUNCATE') then
      raise exception 'v2_2_qa_browser_dml_grant_%', v_table;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege(
    'authenticated',
    'public.v2_2_list_student_enrollments(text)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated',
    'public.v2_2_mutate_student_with_enrollments(text,text,bigint,jsonb,bigint,jsonb,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'v2_2_qa_public_rpc_grant_missing';
  end if;
  if pg_catalog.has_function_privilege(
    'authenticated', 'public.v2_2_internal_active_membership(text,uuid)', 'EXECUTE'
  ) then
    raise exception 'v2_2_qa_internal_helper_exposed';
  end if;
end
$$;

rollback;
