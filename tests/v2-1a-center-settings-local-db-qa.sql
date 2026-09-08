-- Run after 202609080001 inside a disposable transaction/database only.
do $$
declare
  v_users uuid[];
begin
  select array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 4) source;
  if coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'v2_1_qa_requires_four_local_auth_users';
  end if;

  insert into public.centers(id, name, environment, status)
  values
    ('v21a_center_a', 'V2.1 QA A', 'test', 'active'),
    ('v21a_center_b', 'V2.1 QA B', 'test', 'active');

  insert into public.center_members(center_id, user_id, role, status)
  values
    ('v21a_center_a', v_users[1], 'owner', 'active'),
    ('v21a_center_b', v_users[1], 'owner', 'active'),
    ('v21a_center_a', v_users[2], 'admin', 'active'),
    ('v21a_center_b', v_users[2], 'teacher', 'active'),
    ('v21a_center_b', v_users[3], 'center_admin', 'active'),
    ('v21a_center_a', v_users[4], 'owner', 'active');
end
$$;

select set_config(
  'v2_1.qa.owner_user_id',
  (select user_id::text from public.center_members where center_id = 'v21a_center_a' and role = 'owner' order by user_id limit 1),
  true
);
select set_config(
  'v2_1.qa.admin_user_id',
  (select user_id::text from public.center_members where center_id = 'v21a_center_a' and role = 'admin'),
  true
);
select set_config(
  'v2_1.qa.center_admin_user_id',
  (select user_id::text from public.center_members where center_id = 'v21a_center_b' and role = 'center_admin'),
  true
);
select set_config(
  'v2_1.qa.subset_owner_user_id',
  (select user_id::text from public.center_members where center_id = 'v21a_center_a' and role = 'owner' order by user_id desc limit 1),
  true
);

set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('v2_1.qa.admin_user_id'), true);

do $$
declare
  v_result jsonb;
  v_package_id uuid := '11111111-1111-4111-8111-111111111111';
  v_request uuid := '22222222-2222-4222-8222-222222222222';
begin
  v_result := public.v2_1_list_center_settings('v21a_center_a');
  if not (v_result->>'ok')::boolean or v_result->'center'->>'center_code' <> 'v21a_center_a'
     or (v_result->'center'->>'version')::integer <> 0 then
    raise exception 'v2_1_qa_initial_snapshot_failed';
  end if;

  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'UPDATE_CENTER_PROFILE', 'expected_version', 0,
      'display_name', 'Cơ sở QA', 'address', 'Địa chỉ QA', 'phone', '0900', 'note', 'Ghi chú QA'
    ),
    '33333333-3333-4333-8333-333333333333'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' or (v_result->>'entity_version')::integer <> 1 then
    raise exception 'v2_1_qa_profile_write_failed';
  end if;
  if (select name from public.centers where id = 'v21a_center_a') <> 'V2.1 QA A' then
    raise exception 'v2_1_qa_center_identity_mutated';
  end if;

  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'CREATE_TUITION_PACKAGE', 'package_id', v_package_id,
      'expected_version', 0, 'package_name', 'Gói 12 buổi',
      'total_sessions', 12, 'default_amount', 2400000, 'is_active', true, 'note', 'QA'
    ),
    v_request
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then raise exception 'v2_1_qa_package_create_failed'; end if;

  if public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'CREATE_TUITION_PACKAGE', 'package_id', v_package_id,
      'expected_version', 0, 'package_name', 'Gói 12 buổi',
      'total_sessions', 12, 'default_amount', 2400000, 'is_active', true, 'note', 'QA'
    ),
    v_request
  ) <> v_result then
    raise exception 'v2_1_qa_exact_retry_not_stable';
  end if;

  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object(
        'operation', 'UPDATE_TUITION_PACKAGE', 'package_id', v_package_id,
        'expected_version', 0, 'package_name', 'Goi 12 buoi',
        'total_sessions', 12, 'default_amount', 2400000, 'is_active', true, 'note', 'QA'
      ),
      '14141414-1414-4414-8414-141414141414'
    );
    raise exception 'v2_1_qa_stale_package_write_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_stale_package_write_accepted' then raise; end if;
    if position('v2_1_stale_version' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object(
        'operation', 'CREATE_TUITION_PACKAGE', 'package_id', v_package_id,
        'expected_version', 0, 'package_name', 'Ý định khác',
        'total_sessions', 12, 'default_amount', 2400000, 'is_active', true, 'note', 'QA'
      ),
      v_request
    );
    raise exception 'v2_1_qa_changed_intent_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_changed_intent_accepted' then raise; end if;
    if position('v2_1_idempotency_conflict' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_1_list_center_settings('v21a_center_b');
    raise exception 'v2_1_qa_cross_center_read_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_cross_center_read_accepted' then raise; end if;
    if position('v2_1_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_b',
      jsonb_build_object(
        'operation', 'UPDATE_CENTER_PROFILE', 'expected_version', 0,
        'display_name', 'Cross center denied', 'address', '', 'phone', '', 'note', ''
      ),
      '88888888-8888-4888-8888-888888888888'
    );
    raise exception 'v2_1_qa_cross_center_write_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_cross_center_write_accepted' then raise; end if;
    if position('v2_1_center_access_denied' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    insert into public.center_tuition_package_catalog(
      id, center_id, package_name, total_sessions, default_amount,
      created_by_membership_id, updated_by_membership_id
    ) values (
      gen_random_uuid(), 'v21a_center_a', 'Direct DML', 1, 0,
      (select id from public.center_members where center_id = 'v21a_center_a' and role = 'admin'),
      (select id from public.center_members where center_id = 'v21a_center_a' and role = 'admin')
    );
    raise exception 'v2_1_qa_direct_dml_accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects(bucket_id, name, owner)
    values (
      'ichess-os-wallpapers',
      'shared/99999999-9999-4999-8999-999999999999.webp',
      auth.uid()
    );
    raise exception 'v2_1_qa_admin_wallpaper_upload_accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object(
        'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 0,
        'storage_bucket', 'ichess-os-wallpapers',
        'storage_path', 'shared/44444444-4444-4444-8444-444444444444.webp',
        'mime_type', 'image/webp'
      ),
      '55555555-5555-4555-8555-555555555555'
    );
    raise exception 'v2_1_qa_admin_wallpaper_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_admin_wallpaper_accepted' then raise; end if;
    if position('v2_1_owner_required' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_1.qa.subset_owner_user_id'), true);

do $$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1_qa_subset_owner_received_installation_wallpaper_authority';
  end if;
  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object(
        'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 0,
        'storage_bucket', 'ichess-os-wallpapers',
        'storage_path', 'shared/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp',
        'mime_type', 'image/webp'
      ),
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    );
    raise exception 'v2_1_qa_subset_owner_wallpaper_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_subset_owner_wallpaper_accepted' then raise; end if;
    if position('v2_1_owner_required' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_1.qa.center_admin_user_id'), true);

do $$
declare
  v_result jsonb;
begin
  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_b',
    jsonb_build_object(
      'operation', 'UPDATE_CENTER_PROFILE', 'expected_version', 0,
      'display_name', 'Center admin parity', 'address', '', 'phone', '', 'note', ''
    ),
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'v2_1_qa_center_admin_write_failed';
  end if;
  if not (public.v2_1_list_center_settings('v21a_center_b')->>'ok')::boolean then
    raise exception 'v2_1_qa_center_admin_read_failed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', current_setting('v2_1.qa.owner_user_id'), true);

do $$
declare
  v_result jsonb;
begin
  if not public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1_qa_full_owner_not_recognized';
  end if;
  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object(
        'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 0,
        'storage_bucket', 'ichess-os-wallpapers',
        'storage_path', 'shared/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
        'mime_type', 'image/webp'
      ),
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    );
    raise exception 'v2_1_qa_missing_wallpaper_object_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_missing_wallpaper_object_accepted' then raise; end if;
    if position('v2_1_wallpaper_object_missing' in sqlerrm) = 0 then raise; end if;
  end;
  insert into storage.objects(bucket_id, name, owner)
  values (
    'ichess-os-wallpapers',
    'shared/66666666-6666-4666-8666-666666666666.webp',
    auth.uid()
  );
  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 0,
      'storage_bucket', 'ichess-os-wallpapers',
      'storage_path', 'shared/66666666-6666-4666-8666-666666666666.webp',
      'mime_type', 'image/webp'
    ),
    '77777777-7777-4777-8777-777777777777'
  );
  if v_result->>'outcome_code' <> 'COMMITTED' or (v_result->>'entity_version')::integer <> 1 then
    raise exception 'v2_1_qa_owner_wallpaper_failed';
  end if;
  if public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 0,
      'storage_bucket', 'ichess-os-wallpapers',
      'storage_path', 'shared/66666666-6666-4666-8666-666666666666.webp',
      'mime_type', 'image/webp'
    ),
    '77777777-7777-4777-8777-777777777777'
  ) <> v_result then
    raise exception 'v2_1_qa_wallpaper_exact_retry_not_stable';
  end if;
  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object('operation', 'CLEAR_SHARED_WALLPAPER', 'expected_version', 1),
    '12121212-1212-4212-8212-121212121212'
  );
  if (v_result->>'entity_version')::integer <> 2 then
    raise exception 'v2_1_qa_wallpaper_clear_version_failed';
  end if;
  if (public.v2_1_list_center_settings('v21a_center_a')->>'shared_wallpaper_version')::integer <> 2
     or public.v2_1_list_center_settings('v21a_center_a')->'shared_wallpaper' <> 'null'::jsonb then
    raise exception 'v2_1_qa_cleared_wallpaper_projection_failed';
  end if;
  v_result := public.v2_1_mutate_center_settings(
    'v21a_center_a',
    jsonb_build_object(
      'operation', 'SET_SHARED_WALLPAPER', 'expected_version', 2,
      'storage_bucket', 'ichess-os-wallpapers',
      'storage_path', 'shared/66666666-6666-4666-8666-666666666666.webp',
      'mime_type', 'image/webp'
    ),
    '13131313-1313-4313-8313-131313131313'
  );
  if (v_result->>'entity_version')::integer <> 3 then
    raise exception 'v2_1_qa_wallpaper_reset_after_clear_failed';
  end if;
  begin
    perform public.v2_1_mutate_center_settings(
      'v21a_center_a',
      jsonb_build_object('operation', 'CLEAR_SHARED_WALLPAPER', 'expected_version', 2),
      '15151515-1515-4515-8515-151515151515'
    );
    raise exception 'v2_1_qa_stale_wallpaper_write_accepted';
  exception when others then
    if sqlerrm = 'v2_1_qa_stale_wallpaper_write_accepted' then raise; end if;
    if position('v2_1_stale_version' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

reset role;

do $$
declare
  v_bad integer;
begin
  if (select count(*) from public.center_settings_audit_events where center_id = 'v21a_center_a') <> 5 then
    raise exception 'v2_1_qa_audit_or_idempotency_drift';
  end if;
  if (select count(*) from public.center_settings_audit_events where center_id = 'v21a_center_b') <> 1 then
    raise exception 'v2_1_qa_center_admin_audit_drift';
  end if;

  select count(*) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'center_operational_profiles', 'center_tuition_package_catalog',
      'installation_shared_presentation', 'center_settings_command_results',
      'center_settings_audit_events'
    )
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if v_bad <> 0 then raise exception 'v2_1_qa_rls_force_missing'; end if;

  if has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'INSERT')
     or has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'UPDATE')
     or has_table_privilege('authenticated', 'public.center_tuition_package_catalog', 'DELETE') then
    raise exception 'v2_1_qa_direct_table_grant_present';
  end if;

  if has_table_privilege('authenticated', 'public.center_settings_audit_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.center_settings_audit_events', 'DELETE')
     or has_table_privilege('authenticated', 'public.center_settings_audit_events', 'TRUNCATE') then
    raise exception 'v2_1_qa_audit_mutation_grant_present';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.v2_1_internal_active_membership(text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.v2_1_list_center_settings(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.v2_1_mutate_center_settings(text,jsonb,uuid)',
       'EXECUTE'
     ) then
    raise exception 'v2_1_qa_function_grant_mismatch';
  end if;
end
$$;
