begin;

do $$
declare v_users uuid[];
begin
  select array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 4) users;
  if coalesce(array_length(v_users, 1), 0) < 4 then
    raise exception 'v2_6_qa_requires_four_users';
  end if;
  perform set_config('v2_6.qa.owner', v_users[1]::text, true);
  perform set_config('v2_6.qa.admin', v_users[2]::text, true);
  perform set_config('v2_6.qa.unauthorized', v_users[3]::text, true);
  perform set_config('v2_6.qa.foreign', v_users[4]::text, true);

  insert into public.centers(id,name,environment,status) values
    ('v26_qa_a','V2.6 QA A','test','active'),
    ('v26_qa_b','V2.6 QA B','test','active'),
    ('v26_qa_c','V2.6 QA C','test','active');
  insert into public.center_members(center_id,user_id,role,status) values
    ('v26_qa_a',v_users[1],'owner','active'),
    ('v26_qa_b',v_users[1],'owner','active'),
    ('v26_qa_a',v_users[2],'admin','active'),
    ('v26_qa_a',v_users[3],'teacher','active'),
    ('v26_qa_c',v_users[4],'owner','active');

  insert into public.center_cloud_entities(
    center_id,entity_type,local_id,payload,source_module,source_version,
    entity_version,created_by,updated_by
  ) values
    ('v26_qa_a','teacher','legacy-v26-a',jsonb_build_object(
      'id','legacy-v26-a','fullName','Legacy A','displayName','Legacy A'
    ),'v2.6-qa','legacy',1,v_users[1],v_users[1]),
    ('v26_qa_a','schedule_session','v26-schedule-a',jsonb_build_object(
      'id','v26-schedule-a','scheduleType','oneOff','teacherId','26000000-0000-4000-8000-000000000001'
    ),'v2.6-qa','v2.6-qa',1,v_users[1],v_users[1]),
    ('v26_qa_b','schedule_session','v26-schedule-b',jsonb_build_object(
      'id','v26-schedule-b','scheduleType','oneOff','teacherId','26000000-0000-4000-8000-000000000001'
    ),'v2.6-qa','v2.6-qa',1,v_users[1],v_users[1]);
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_6.qa.owner'), true);

do $$
declare v_result jsonb;
begin
  v_result := public.c5_1_mutate_core_entity(
    'v26_qa_a','teacher','legacy-v26-blocked',0,
    jsonb_build_object('id','legacy-v26-blocked','fullName','Blocked legacy Teacher'),
    '26000000-0000-4000-8000-000000000010','UPSERT'
  );
  if coalesce((v_result->>'ok')::boolean,false)
     or v_result->>'outcome_code' <> 'V2_6_TEACHER_REGISTRY_REQUIRED' then
    raise exception 'v2_6_qa_legacy_teacher_rpc_not_blocked';
  end if;
  v_result := public.c5_1_mutate_core_entity(
    'v26_qa_a','schedule_session','v26-wrapper-schedule',0,
    jsonb_build_object('id','v26-wrapper-schedule','scheduleType','oneOff'),
    '26000000-0000-4000-8000-000000000011','UPSERT'
  );
  if not coalesce((v_result->>'ok')::boolean,false) then
    raise exception 'v2_6_qa_non_teacher_core_wrapper_failed';
  end if;
  v_result := public.c5_1_mutate_core_entity(
    'v26_qa_a','schedule_session','v26-wrapper-schedule',1,'{}'::jsonb,
    '26000000-0000-4000-8000-000000000012','DELETE'
  );
  if not coalesce((v_result->>'ok')::boolean,false) then
    raise exception 'v2_6_qa_non_teacher_core_delete_failed';
  end if;
end
$$;

do $$
declare
  v_command jsonb := jsonb_build_object(
    'operation','CREATE_TEACHER',
    'teacher_id','26000000-0000-4000-8000-000000000001',
    'expected_version',0,
    'full_name','Giáo viên Canonical',
    'display_name','GV Canonical',
    'phone','0900000000',
    'email','teacher.v26@example.test',
    'birth_year','1990',
    'status','active',
    'teacher_type','parttime',
    'specialties',jsonb_build_array('Cờ vua'),
    'levels',jsonb_build_array('basic'),
    'main_role','Giáo viên',
    'note','Owner-only note'
  );
  v_result jsonb;
  v_retry jsonb;
  v_snapshot jsonb;
begin
  v_result := public.v2_6_mutate_teacher_registry(
    'v26_qa_a',v_command,'26010000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_result->>'ok')::boolean,false)
     or (v_result->>'teacher_version')::int <> 1
     or (v_result->>'assignment_version')::int <> 1 then
    raise exception 'v2_6_qa_owner_create_failed';
  end if;
  v_retry := public.v2_6_mutate_teacher_registry(
    'v26_qa_a',v_command,'26010000-0000-4000-8000-000000000001'
  );
  if not coalesce((v_retry->>'replayed')::boolean,false) then
    raise exception 'v2_6_qa_exact_retry_failed';
  end if;
  begin
    perform public.v2_6_mutate_teacher_registry(
      'v26_qa_a',v_command || jsonb_build_object('display_name','Changed intent'),
      '26010000-0000-4000-8000-000000000001'
    );
    raise exception 'v2_6_qa_changed_intent_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_changed_intent_accepted'
       or position('v2_6_idempotency_conflict' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform public.v2_6_mutate_teacher_registry(
      'v26_qa_b',v_command,'26010000-0000-4000-8000-000000000001'
    );
    raise exception 'v2_6_qa_cross_center_idempotency_replay_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_cross_center_idempotency_replay_accepted'
       or position('v2_6_idempotency_conflict' in sqlerrm)=0 then raise; end if;
  end;
  v_snapshot := public.v2_6_list_teacher_registry('v26_qa_a');
  if (v_snapshot->>'role') <> 'owner'
     or not coalesce((v_snapshot->>'can_manage_registry')::boolean,false)
     or jsonb_array_length(v_snapshot->'registry_teachers') <> 1
     or jsonb_array_length(v_snapshot->'assigned_teachers') <> 1
     or jsonb_array_length(v_snapshot->'managed_centers') <> 2 then
    raise exception 'v2_6_qa_owner_snapshot_failed';
  end if;
end
$$;

-- Profile version/currentness and identity collision are server-authoritative.
do $$
declare v_command jsonb;
begin
  v_command := jsonb_build_object(
    'operation','UPDATE_TEACHER','teacher_id','26000000-0000-4000-8000-000000000001',
    'expected_version',1,'full_name','Giáo viên Canonical','display_name','GV Canonical mới',
    'phone','0900000000','email','teacher.v26@example.test','birth_year','1990',
    'status','active','teacher_type','parttime','specialties',jsonb_build_array('Cờ vua'),
    'levels',jsonb_build_array('basic'),'main_role','Giáo viên','note','Owner-only note'
  );
  perform public.v2_6_mutate_teacher_registry(
    'v26_qa_a',v_command,'26010000-0000-4000-8000-000000000002'
  );
  begin
    perform public.v2_6_mutate_teacher_registry(
      'v26_qa_a',v_command,'26010000-0000-4000-8000-000000000003'
    );
    raise exception 'v2_6_qa_stale_profile_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_stale_profile_accepted'
       or position('v2_6_stale_version' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform public.v2_6_mutate_teacher_registry(
      'v26_qa_a',jsonb_build_object(
        'operation','CREATE_TEACHER','teacher_id','26000000-0000-4000-8000-000000000009',
        'expected_version',0,'full_name','Trùng email','display_name','Trùng email',
        'phone','','email','teacher.v26@example.test','birth_year','',
        'status','active','teacher_type','fulltime','specialties','[]'::jsonb,
        'levels','[]'::jsonb,'main_role','','note',''
      ),'26010000-0000-4000-8000-000000000004'
    );
    raise exception 'v2_6_qa_identity_collision_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_identity_collision_accepted'
       or position('v2_6_teacher_identity_conflict' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

-- One stable canonical Teacher may be assigned to many centers. Assignment
-- lifecycle reuses the stable relation ID and emits immutable event identity.
do $$
declare
  v_result jsonb;
  v_assignment_id uuid;
  v_assignment_version int;
  v_snapshot jsonb;
  v_assignment jsonb;
begin
  begin
    perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
      'operation','REMOVE','teacher_id','26000000-0000-4000-8000-000000000001',
      'from_center_id','v26_qa_a','expected_version',1
    ),'26020000-0000-4000-8000-000000000000');
    raise exception 'v2_6_qa_last_assignment_removed';
  exception when others then
    if sqlerrm='v2_6_qa_last_assignment_removed'
       or position('v2_6_last_assignment_required' in sqlerrm)=0 then raise; end if;
  end;
  v_result := public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
    'operation','ASSIGN','teacher_id','26000000-0000-4000-8000-000000000001',
    'to_center_id','v26_qa_b','expected_version',0
  ),'26020000-0000-4000-8000-000000000001');
  v_assignment_id := (v_result->>'assignment_id')::uuid;
  v_assignment_version := (v_result->>'assignment_version')::int;
  if v_assignment_version <> 1
     or jsonb_array_length(public.v2_6_list_teacher_registry('v26_qa_b')->'assigned_teachers') <> 1 then
    raise exception 'v2_6_qa_multi_center_assign_failed';
  end if;
  begin
    perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
      'operation','ASSIGN','teacher_id','26000000-0000-4000-8000-000000000001',
      'to_center_id','v26_qa_b','expected_version',0
    ),'26020000-0000-4000-8000-000000000006');
    raise exception 'v2_6_qa_duplicate_active_assignment_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_duplicate_active_assignment_accepted'
       or position('v2_6_assignment_already_active' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
      'operation','REMOVE','teacher_id','26000000-0000-4000-8000-000000000001',
      'from_center_id','v26_qa_b','expected_version',0
    ),'26020000-0000-4000-8000-000000000007');
    raise exception 'v2_6_qa_stale_assignment_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_stale_assignment_accepted'
       or position('v2_6_stale_version' in sqlerrm)=0 then raise; end if;
  end;

  perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
    'operation','REMOVE','teacher_id','26000000-0000-4000-8000-000000000001',
    'from_center_id','v26_qa_b','expected_version',1
  ),'26020000-0000-4000-8000-000000000002');
  if jsonb_array_length(public.v2_6_list_teacher_registry('v26_qa_b')->'assigned_teachers') <> 0 then
    raise exception 'v2_6_qa_assignment_remove_currentness_failed';
  end if;
  perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
    'operation','ASSIGN','teacher_id','26000000-0000-4000-8000-000000000001',
    'to_center_id','v26_qa_b','expected_version',2
  ),'26020000-0000-4000-8000-000000000003');
  v_snapshot := public.v2_6_list_teacher_registry('v26_qa_a');
  select assignment into v_assignment
  from jsonb_array_elements(v_snapshot->'registry_teachers'->0->'assignments') assignment
  where assignment->>'center_id'='v26_qa_b';
  if (v_assignment->>'id')::uuid <> v_assignment_id
     or (v_assignment->>'version')::int <> 3 then
    raise exception 'v2_6_qa_assignment_identity_or_version_failed';
  end if;

  perform public.v2_6_mutate_teacher_assignment('v26_qa_a',jsonb_build_object(
    'operation','REMOVE','teacher_id','26000000-0000-4000-8000-000000000001',
    'from_center_id','v26_qa_a','expected_version',1
  ),'26020000-0000-4000-8000-000000000004');
  perform public.v2_6_mutate_teacher_assignment('v26_qa_b',jsonb_build_object(
    'operation','TRANSFER','teacher_id','26000000-0000-4000-8000-000000000001',
    'from_center_id','v26_qa_b','to_center_id','v26_qa_a',
    'expected_version',3,'target_expected_version',2
  ),'26020000-0000-4000-8000-000000000005');
  v_snapshot := public.v2_6_list_teacher_registry('v26_qa_a');
  if jsonb_array_length(v_snapshot->'assigned_teachers') <> 1
     or jsonb_array_length(public.v2_6_list_teacher_registry('v26_qa_b')->'assigned_teachers') <> 0
     or not exists (select 1 from jsonb_array_elements(v_snapshot->'assignment_events') event
      where event->>'event_type'='transferred'
        and event->>'from_center_id'='v26_qa_b' and event->>'to_center_id'='v26_qa_a') then
    raise exception 'v2_6_qa_atomic_transfer_failed';
  end if;
end
$$;

reset role;

-- Admin sees basic information only for assigned Teachers in the current
-- center; raw admin role is normalized without widening canonical mutation.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_6.qa.admin'), true);
do $$
declare v_snapshot jsonb; v_teacher jsonb;
begin
  v_snapshot := public.v2_6_list_teacher_registry('v26_qa_a');
  v_teacher := v_snapshot->'assigned_teachers'->0;
  if (v_snapshot->>'role') <> 'center_admin'
     or coalesce((v_snapshot->>'can_manage_registry')::boolean,true)
     or jsonb_array_length(v_snapshot->'assigned_teachers') <> 1
     or jsonb_array_length(v_snapshot->'registry_teachers') <> 0
     or jsonb_array_length(v_snapshot->'managed_centers') <> 0
     or v_teacher->'birth_year' <> 'null'::jsonb
     or (v_teacher->>'note') <> '' then
    raise exception 'v2_6_qa_admin_basic_projection_failed';
  end if;
  if (select count(*) from public.center_cloud_entities
      where entity_type='schedule_session'
        and payload->>'teacherId'='26000000-0000-4000-8000-000000000001') <> 1
     or (select center_id from public.center_cloud_entities
      where entity_type='schedule_session'
        and payload->>'teacherId'='26000000-0000-4000-8000-000000000001') <> 'v26_qa_a' then
    raise exception 'v2_6_qa_shared_teacher_business_leak';
  end if;
  begin
    perform public.v2_6_mutate_teacher_registry('v26_qa_a',jsonb_build_object(
      'operation','CREATE_TEACHER','teacher_id','26000000-0000-4000-8000-000000000008',
      'expected_version',0,'full_name','Admin create','display_name','Admin create',
      'phone','','email','','birth_year','','status','active','teacher_type','fulltime',
      'specialties','[]'::jsonb,'levels','[]'::jsonb,'main_role','','note',''
    ),'26010000-0000-4000-8000-000000000008');
    raise exception 'v2_6_qa_admin_create_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_admin_create_accepted'
       or position('v2_6_owner_required' in sqlerrm)=0 then raise; end if;
  end;
  begin
    perform public.v2_6_list_teacher_registry('v26_qa_b');
    raise exception 'v2_6_qa_admin_cross_center_read_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_admin_cross_center_read_accepted'
       or position('v2_6_center_access_denied' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

-- Direct table authority stays closed for browser roles.
do $$
begin
  begin
    update public.canonical_teacher_registry set display_name='Bypass'
    where id='26000000-0000-4000-8000-000000000001';
    raise exception 'v2_6_qa_direct_dml_accepted';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Non-Owner and unrelated Owner cannot govern the registry.
select set_config('request.jwt.claim.sub', current_setting('v2_6.qa.unauthorized'), true);
do $$ begin
  begin
    perform public.v2_6_list_teacher_registry('v26_qa_a');
    raise exception 'v2_6_qa_unauthorized_read_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_unauthorized_read_accepted'
       or position('v2_6_center_access_denied' in sqlerrm)=0 then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('v2_6.qa.foreign'), true);
do $$ begin
  begin
    perform public.v2_6_mutate_teacher_assignment('v26_qa_c',jsonb_build_object(
      'operation','ASSIGN','teacher_id','26000000-0000-4000-8000-000000000001',
      'to_center_id','v26_qa_c','expected_version',0
    ),'26020000-0000-4000-8000-000000000009');
    raise exception 'v2_6_qa_foreign_owner_scope_accepted';
  exception when others then
    if sqlerrm='v2_6_qa_foreign_owner_scope_accepted'
       or position('v2_6_teacher_scope_denied' in sqlerrm)=0 then raise; end if;
  end;
end $$;
reset role;

-- No silent canonical row is made for a legacy C5.1 Teacher, and exact-center
-- schedule/student business rows remain outside Registry mutation authority.
do $$
begin
  if exists (select 1 from public.canonical_teacher_registry where id::text='legacy-v26-a')
     or (select count(*) from public.center_cloud_entities
       where center_id like 'v26_qa_%' and entity_type='teacher') <> 1
     or (select count(*) from public.center_cloud_entities
       where center_id like 'v26_qa_%' and entity_type='schedule_session'
         and deleted_at is null) <> 2 then
    raise exception 'v2_6_qa_legacy_or_business_authority_changed';
  end if;
  if (select count(*) from public.teacher_registry_events
      where teacher_id='26000000-0000-4000-8000-000000000001') <> 7
     or exists (select 1 from public.teacher_registry_events group by id having count(*) > 1)
     or exists (select 1 from public.teacher_registry_events group by command_id,event_type having count(*) > 1) then
    raise exception 'v2_6_qa_event_identity_failed';
  end if;
end
$$;

rollback;
