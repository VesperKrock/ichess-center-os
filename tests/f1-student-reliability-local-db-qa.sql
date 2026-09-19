-- Transactional exact-center QA for F1 Student guardian persistence.
begin;

do $f1_seed$
declare
  users uuid[];
begin
  select array_agg(id order by id) into users
  from (select id from auth.users order by id limit 3) source;
  if coalesce(array_length(users, 1), 0) < 3 then
    raise exception 'f1_qa_requires_three_local_auth_users';
  end if;

  perform pg_catalog.set_config('f1.qa.owner', users[1]::text, true);
  perform pg_catalog.set_config('f1.qa.admin', users[2]::text, true);
  perform pg_catalog.set_config('f1.qa.other_owner', users[3]::text, true);

  insert into public.centers(id, name, slug, environment, status)
  values
    ('f1_student_qa_a', 'F1 Student QA A', 'f1-student-qa-a', 'test', 'active'),
    ('f1_student_qa_b', 'F1 Student QA B', 'f1-student-qa-b', 'test', 'active');

  insert into public.center_members(center_id, user_id, role, status)
  values
    ('f1_student_qa_a', users[1], 'owner', 'active'),
    ('f1_student_qa_a', users[2], 'center_admin', 'active'),
    ('f1_student_qa_b', users[3], 'owner', 'active');
end;
$f1_seed$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1.qa.owner'), true);

do $f1_owner_create$
declare
  result jsonb;
begin
  result := public.v2_2_mutate_student_with_enrollments(
    'f1_student_qa_a',
    'f1_student_guardian',
    0,
    pg_catalog.jsonb_build_object(
      'id', 'f1_student_guardian',
      'fullName', 'F1 Synthetic Student',
      'birthDate', '2014-01-02',
      'parentName', 'Guardian Before',
      'motherPhone', '0901001001',
      'parentPhone', '0901001001',
      'parentArea', 'Area Before',
      'currentStatus', 'Đang theo học'
    ),
    0,
    '[]'::jsonb,
    '10000000-0000-4000-8000-0000000000f1',
    'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or (result->>'student_version')::bigint <> 1
     or (result->'enrollment_set'->>'version')::bigint <> 1 then
    raise exception 'f1_owner_create_failed';
  end if;
end;
$f1_owner_create$;

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1.qa.admin'), true);

do $f1_admin_update$
declare
  result jsonb;
begin
  result := public.v2_2_mutate_student_with_enrollments(
    'f1_student_qa_a',
    'f1_student_guardian',
    1,
    pg_catalog.jsonb_build_object(
      'id', 'f1_student_guardian',
      'fullName', 'F1 Synthetic Student',
      'birthDate', '2014-01-02',
      'parentName', 'Guardian After',
      'motherPhone', '0909222333',
      'parentPhone', '0909222333',
      'parentArea', 'Area After',
      'currentStatus', 'Đang theo học'
    ),
    1,
    '[]'::jsonb,
    '20000000-0000-4000-8000-0000000000f1',
    'UPSERT'
  );
  if coalesce((result->>'ok')::boolean, false) is not true
     or result#>>'{student_payload,parentName}' <> 'Guardian After'
     or result#>>'{student_payload,motherPhone}' <> '0909222333'
     or result#>>'{student_payload,parentArea}' <> 'Area After' then
    raise exception 'f1_admin_guardian_update_failed';
  end if;
end;
$f1_admin_update$;

do $f1_admin_read$
begin
  if not exists (
    select 1
    from public.center_cloud_entities entity
    where entity.center_id = 'f1_student_qa_a'
      and entity.entity_type = 'student'
      and entity.local_id = 'f1_student_guardian'
      and entity.entity_version = 2
      and entity.payload->>'parentName' = 'Guardian After'
      and entity.payload->>'motherPhone' = '0909222333'
      and entity.payload->>'parentArea' = 'Area After'
  ) then
    raise exception 'f1_admin_authoritative_reload_failed';
  end if;
end;
$f1_admin_read$;

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1.qa.owner'), true);

do $f1_owner_read$
begin
  if not exists (
    select 1
    from public.center_cloud_entities entity
    where entity.center_id = 'f1_student_qa_a'
      and entity.entity_type = 'student'
      and entity.local_id = 'f1_student_guardian'
      and entity.payload->>'parentName' = 'Guardian After'
      and entity.payload->>'motherPhone' = '0909222333'
      and entity.payload->>'parentArea' = 'Area After'
  ) then
    raise exception 'f1_owner_shared_truth_failed';
  end if;
end;
$f1_owner_read$;

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('f1.qa.other_owner'), true);

do $f1_cross_center$
begin
  if exists (
    select 1
    from public.center_cloud_entities entity
    where entity.center_id = 'f1_student_qa_a'
      and entity.entity_type = 'student'
      and entity.local_id = 'f1_student_guardian'
  ) then
    raise exception 'f1_cross_center_read_leak';
  end if;

  begin
    perform public.v2_2_mutate_student_with_enrollments(
      'f1_student_qa_a',
      'f1_student_guardian',
      2,
      pg_catalog.jsonb_build_object(
        'id', 'f1_student_guardian',
        'fullName', 'Cross Center Mutation',
        'birthDate', '2014-01-02',
        'parentName', 'Forbidden'
      ),
      2,
      '[]'::jsonb,
      '30000000-0000-4000-8000-0000000000f1',
      'UPSERT'
    );
    raise exception 'f1_cross_center_mutation_was_not_denied';
  exception when others then
    if sqlerrm = 'f1_cross_center_mutation_was_not_denied' then raise; end if;
    if sqlerrm not like '%v2_2_center_access_denied%' then raise; end if;
  end;
end;
$f1_cross_center$;

reset role;
rollback;
