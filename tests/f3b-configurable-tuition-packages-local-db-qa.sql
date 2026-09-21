-- Run only in a disposable local Supabase database with four synthetic Auth users.
begin;

select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  v_users uuid[];
begin
  select pg_catalog.array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 4) source;
  if coalesce(pg_catalog.array_length(v_users, 1), 0) < 4 then
    raise exception 'f3b_qa_requires_four_local_auth_users';
  end if;

  insert into public.centers(id, name, environment, status)
  values
    ('f3b_center_a', 'F3B QA A', 'test', 'active'),
    ('f3b_center_b', 'F3B QA B', 'test', 'active');

  insert into public.installation_center_epochs(center_id, installation_epoch, epoch_status)
  values ('f3b_center_a', 1, 'CURRENT'), ('f3b_center_b', 1, 'CURRENT');

  update public.installation_handoff_control
  set installation_state = 'TESTER_ACTIVE', bootstrap_state = 'LOCKED_EXISTING'
  where singleton_id = 1;

  insert into public.center_members(center_id, user_id, role, status)
  values
    ('f3b_center_a', v_users[1], 'owner', 'active'),
    ('f3b_center_a', v_users[2], 'center_admin', 'active'),
    ('f3b_center_b', v_users[3], 'owner', 'active'),
    ('f3b_center_b', v_users[4], 'center_admin', 'active');

  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id,
    canonical_admin_membership_id, activated_at
  ) values
    (
      'f3b_center_a', 'active',
      (select id from public.center_members where center_id = 'f3b_center_a' and role = 'owner'),
      (select id from public.center_members where center_id = 'f3b_center_a' and role = 'center_admin'),
      pg_catalog.transaction_timestamp()
    ),
    (
      'f3b_center_b', 'active',
      (select id from public.center_members where center_id = 'f3b_center_b' and role = 'owner'),
      (select id from public.center_members where center_id = 'f3b_center_b' and role = 'center_admin'),
      pg_catalog.transaction_timestamp()
    );
end
$$;

select pg_catalog.set_config(
  'f3b.qa.owner_user_id',
  (select user_id::text from public.center_members where center_id = 'f3b_center_a' and role = 'owner'),
  true
);
select pg_catalog.set_config(
  'f3b.qa.admin_user_id',
  (select user_id::text from public.center_members where center_id = 'f3b_center_a' and role = 'center_admin'),
  true
);
select pg_catalog.set_config(
  'f3b.qa.outsider_user_id',
  (select user_id::text from public.center_members where center_id = 'f3b_center_b' and role = 'owner'),
  true
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f3b.qa.admin_user_id'), true);

do $$
declare
  v_result jsonb;
  v_settings jsonb;
  v_package_id uuid := '31313131-3131-4131-8131-313131313131';
  v_assignment jsonb;
begin
  v_result := public.v2_1_mutate_center_settings(
    'f3b_center_a',
    pg_catalog.jsonb_build_object(
      'operation', 'CREATE_TUITION_PACKAGE',
      'package_id', v_package_id,
      'expected_version', 0,
      'package_name', 'Gói linh hoạt 12 buổi',
      'total_sessions', 12,
      'default_amount', 3600000,
      'is_active', true,
      'note', 'F3B disposable QA'
    ),
    '32323232-3232-4232-8232-323232323232'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'f3b_package_create_failed';
  end if;

  v_settings := public.v2_1_list_center_settings('f3b_center_a');
  if pg_catalog.jsonb_array_length(v_settings->'tuition_packages') <> 1
     or v_settings->'tuition_packages'->0->>'package_name' <> 'Gói linh hoạt 12 buổi'
     or (v_settings->'tuition_packages'->0->>'total_sessions')::integer <> 12 then
    raise exception 'f3b_package_authoritative_reload_failed';
  end if;

  v_result := public.c5_1_mutate_core_entity(
    'f3b_center_a', 'student', 'f3b_student', 0,
    pg_catalog.jsonb_build_object(
      'id', 'f3b_student',
      'fullName', 'Học viên F3B',
      'currentStatus', 'Đang theo học',
      'classSessionIds', pg_catalog.jsonb_build_array()
    ),
    '33333333-3333-4333-8333-333333333333',
    'UPSERT'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'f3b_student_create_failed';
  end if;

  v_result := public.c5_2_mutate_attendance_tuition_entities(
    'f3b_center_a',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'entity_type', 'tuition_record_package',
      'local_id', 'tuition_record_package::f3b_tuition',
      'expected_version', 0,
      'operation', 'UPSERT',
      'payload', pg_catalog.jsonb_build_object(
        'id', 'f3b_tuition',
        'studentId', 'f3b_student',
        'packageCatalogId', v_package_id,
        'packageName', 'Gói linh hoạt 12 buổi',
        'totalSessions', 12,
        'usedSessions', 8,
        'totalAmount', 3600000,
        'paidAmount', 0,
        'attendanceLinked', false,
        'attendanceAutoUpdateEnabled', false,
        'usedSessionsAutoUpdateFromAttendance', false,
        'remainingSessionsAutoUpdateFromAttendance', false
      )
    )),
    '34343434-3434-4434-8434-343434343434'
  );
  if not (v_result->>'ok')::boolean then
    raise exception 'f3b_custom_assignment_failed: %', v_result;
  end if;

  select payload into v_assignment
  from public.center_cloud_entities
  where center_id = 'f3b_center_a'
    and entity_type = 'tuition_record_package'
    and local_id = 'tuition_record_package::f3b_tuition'
    and deleted_at is null;
  if v_assignment->>'packageCatalogId' <> v_package_id::text
     or (v_assignment->>'totalSessions')::integer <> 12
     or (v_assignment->>'usedSessions')::integer <> 8
     or (v_assignment->>'totalSessions')::integer - (v_assignment->>'usedSessions')::integer <> 4 then
    raise exception 'f3b_custom_assignment_reload_or_remaining_failed';
  end if;
end
$$;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f3b.qa.owner_user_id'), true);

do $$
declare
  v_result jsonb;
  v_settings jsonb;
  v_assignment jsonb;
begin
  v_settings := public.v2_1_list_center_settings('f3b_center_a');
  if v_settings->'tuition_packages'->0->>'package_name' <> 'Gói linh hoạt 12 buổi' then
    raise exception 'f3b_same_center_owner_package_read_failed';
  end if;

  select payload into v_assignment
  from public.center_cloud_entities
  where center_id = 'f3b_center_a'
    and entity_type = 'tuition_record_package'
    and local_id = 'tuition_record_package::f3b_tuition'
    and deleted_at is null;
  if v_assignment->>'packageName' <> 'Gói linh hoạt 12 buổi' then
    raise exception 'f3b_same_center_owner_assignment_read_failed';
  end if;

  v_result := public.v2_1_mutate_center_settings(
    'f3b_center_a',
    pg_catalog.jsonb_build_object(
      'operation', 'SET_TUITION_PACKAGE_STATUS',
      'package_id', '31313131-3131-4131-8131-313131313131',
      'expected_version', 1,
      'is_active', false
    ),
    '35353535-3535-4535-8535-353535353535'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'f3b_package_retirement_failed';
  end if;

  v_settings := public.v2_1_list_center_settings('f3b_center_a');
  if (v_settings->'tuition_packages'->0->>'is_active')::boolean then
    raise exception 'f3b_package_retirement_reload_failed';
  end if;

  select payload into v_assignment
  from public.center_cloud_entities
  where center_id = 'f3b_center_a'
    and entity_type = 'tuition_record_package'
    and local_id = 'tuition_record_package::f3b_tuition'
    and deleted_at is null;
  if v_assignment->>'packageName' <> 'Gói linh hoạt 12 buổi'
     or (v_assignment->>'totalSessions')::integer <> 12 then
    raise exception 'f3b_retirement_mutated_historical_assignment';
  end if;
end
$$;

select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f3b.qa.outsider_user_id'), true);

do $$
declare
  v_result jsonb;
  v_visible integer;
begin
  begin
    perform public.v2_1_list_center_settings('f3b_center_a');
    raise exception 'f3b_cross_center_package_read_accepted';
  exception when others then
    if sqlerrm = 'f3b_cross_center_package_read_accepted' then raise; end if;
    if position('v2_1_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;

  v_result := public.c5_2_mutate_attendance_tuition_entities(
    'f3b_center_a',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'entity_type', 'tuition_record_package',
      'local_id', 'tuition_record_package::f3b_tuition',
      'expected_version', 1,
      'operation', 'UPSERT',
      'payload', pg_catalog.jsonb_build_object(
        'id', 'f3b_tuition', 'studentId', 'f3b_student',
        'packageName', 'Cross center denied',
        'totalSessions', 1, 'usedSessions', 0,
        'totalAmount', 0, 'paidAmount', 0
      )
    )),
    '36363636-3636-4636-8636-363636363636'
  );
  if v_result->>'outcome_code' <> 'CENTER_ACCESS_DENIED' then
    raise exception 'f3b_cross_center_assignment_mutation_not_denied: %', v_result;
  end if;

  select pg_catalog.count(*) into v_visible
  from public.center_cloud_entities
  where center_id = 'f3b_center_a'
    and entity_type = 'tuition_record_package';
  if v_visible <> 0 then
    raise exception 'f3b_cross_center_assignment_read_leak';
  end if;
end
$$;

reset role;

do $$
begin
  if not (
    select c.relrowsecurity and c.relforcerowsecurity
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'center_tuition_package_catalog'
  ) then
    raise exception 'f3b_catalog_rls_force_missing';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'DELETE') then
    raise exception 'f3b_catalog_direct_authenticated_grant_present';
  end if;
end
$$;

select 'F3B_CONFIGURABLE_TUITION_PACKAGES_LOCAL_DB_QA: PASS';
rollback;
