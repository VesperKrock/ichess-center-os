-- Run only in a disposable database after 202609080001 -> 202609080002.
begin;

do $fixture$
declare
  v_users uuid[];
  v_index integer;
  v_center_id text;
  v_owner_membership_id uuid;
  v_admin_membership_id uuid;
begin
  select array_agg(id order by id) into v_users
  from (select id from auth.users order by id limit 5) source;
  if coalesce(array_length(v_users, 1), 0) < 5 then
    raise exception 'v2_1a2_qa_requires_five_local_auth_users';
  end if;

  for v_index in 1..5 loop
    v_center_id := 'v21a2_governed_' || v_index::text;
    insert into public.centers(id, name, environment, status)
    values (v_center_id, 'V2.1A2 governed ' || v_index::text, 'production', 'active');

    insert into public.center_members(center_id, user_id, role, status)
    values (v_center_id, v_users[1], 'owner', 'active')
    returning id into v_owner_membership_id;

    if v_index = 1 then
      insert into public.center_members(center_id, user_id, role, status)
      values (v_center_id, v_users[3], 'center_admin', 'active')
      returning id into v_admin_membership_id;
    else
      v_admin_membership_id := null;
    end if;

    insert into public.center_access_governance(
      center_id, status, canonical_owner_membership_id,
      canonical_admin_membership_id, activated_at
    ) values (
      v_center_id, 'active', v_owner_membership_id,
      v_admin_membership_id, pg_catalog.transaction_timestamp()
    );
  end loop;

  insert into public.centers(id, name, environment, status)
  values ('v21a2_staging', 'V2.1A2 staging', 'staging', 'active');
  insert into public.center_members(center_id, user_id, role, status)
  values ('v21a2_staging', v_users[2], 'owner', 'active')
  returning id into v_owner_membership_id;
  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id, activated_at
  ) values (
    'v21a2_staging', 'suspended', v_owner_membership_id,
    pg_catalog.transaction_timestamp()
  );

  -- A raw Owner-shaped row that is not the ARG canonical pointer must grant no
  -- wallpaper authority. It is restored before deferred ARG invariants run.
  insert into public.center_members(center_id, user_id, role, status)
  values ('v21a2_governed_1', v_users[4], 'teacher', 'active');

  perform set_config('v2_1a2.qa.owner', v_users[1]::text, true);
  perform set_config('v2_1a2.qa.staging_owner', v_users[2]::text, true);
  perform set_config('v2_1a2.qa.admin', v_users[3]::text, true);
  perform set_config('v2_1a2.qa.noncanonical_owner', v_users[4]::text, true);
  perform set_config('v2_1a2.qa.other_user', v_users[5]::text, true);
end;
$fixture$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.owner'), true);

do $primary_case$
begin
  if not public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_owner_all_governed_denied';
  end if;
  if public.v2_1_can_manage_shared_wallpaper(
    current_setting('v2_1a2.qa.other_user')::uuid
  ) then
    raise exception 'v2_1a2_qa_cross_user_spoof_accepted';
  end if;
end;
$primary_case$;
reset role;

-- Make the canonical Owner membership non-current in exactly one governed
-- center. The state is restored before the deferred ARG invariant is checked.
update public.center_members
set status = 'revoked'
where center_id = 'v21a2_governed_5'
  and user_id = current_setting('v2_1a2.qa.owner')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.owner'), true);
do $missing_one$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_missing_one_governed_center_accepted';
  end if;
end;
$missing_one$;
reset role;
update public.center_members
set status = 'active'
where center_id = 'v21a2_governed_5'
  and user_id = current_setting('v2_1a2.qa.owner')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.staging_owner'), true);
do $staging_only$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_staging_only_owner_accepted';
  end if;
end;
$staging_only$;

select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.admin'), true);
do $admin_case$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_admin_accepted';
  end if;
end;
$admin_case$;
reset role;

update public.center_members
set role = 'owner'
where center_id = 'v21a2_governed_1'
  and user_id = current_setting('v2_1a2.qa.noncanonical_owner')::uuid;
insert into public.center_members(center_id, user_id, role, status)
values
  ('v21a2_governed_2', current_setting('v2_1a2.qa.noncanonical_owner')::uuid, 'owner', 'active'),
  ('v21a2_governed_3', current_setting('v2_1a2.qa.noncanonical_owner')::uuid, 'owner', 'active'),
  ('v21a2_governed_4', current_setting('v2_1a2.qa.noncanonical_owner')::uuid, 'owner', 'active'),
  ('v21a2_governed_5', current_setting('v2_1a2.qa.noncanonical_owner')::uuid, 'center_admin', 'active');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.noncanonical_owner'), true);
do $mixed_noncanonical_owner$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_mixed_owner_admin_or_noncanonical_owner_accepted';
  end if;
end;
$mixed_noncanonical_owner$;
reset role;
delete from public.center_members
where center_id in ('v21a2_governed_2', 'v21a2_governed_3', 'v21a2_governed_4', 'v21a2_governed_5')
  and user_id = current_setting('v2_1a2.qa.noncanonical_owner')::uuid;
update public.center_members
set role = 'teacher'
where center_id = 'v21a2_governed_1'
  and user_id = current_setting('v2_1a2.qa.noncanonical_owner')::uuid;

update public.center_access_governance
set status = 'disabled'
where center_id like 'v21a2_governed_%';
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.owner'), true);
do $zero_scope$
begin
  if public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_zero_governed_scope_accepted';
  end if;
end;
$zero_scope$;
reset role;
update public.center_access_governance
set status = 'active'
where center_id like 'v21a2_governed_%';

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('v2_1a2.qa.owner'), true);
do $final_scope$
begin
  if not public.v2_1_can_manage_shared_wallpaper(auth.uid()) then
    raise exception 'v2_1a2_qa_suspended_staging_expanded_scope';
  end if;
end;
$final_scope$;
reset role;

do $security_contract$
declare
  v_function_def text;
begin
  select pg_get_functiondef('public.v2_1_can_manage_shared_wallpaper(uuid)'::regprocedure)
  into v_function_def;
  if position('center_access_governance' in v_function_def) = 0
     or position('canonical_owner_membership_id' in v_function_def) = 0 then
    raise exception 'v2_1a2_qa_canonical_governance_not_used';
  end if;
  if position('environment' in v_function_def) <> 0 then
    raise exception 'v2_1a2_qa_environment_became_authority';
  end if;
  if not (select prosecdef from pg_proc where oid =
      'public.v2_1_can_manage_shared_wallpaper(uuid)'::regprocedure) then
    raise exception 'v2_1a2_qa_security_definer_lost';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'public.v2_1_can_manage_shared_wallpaper(uuid)'::regprocedure
      and proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'v2_1a2_qa_fixed_search_path_lost';
  end if;
  if has_function_privilege('anon',
       'public.v2_1_can_manage_shared_wallpaper(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated',
       'public.v2_1_can_manage_shared_wallpaper(uuid)', 'EXECUTE') then
    raise exception 'v2_1a2_qa_function_grant_mismatch';
  end if;
end;
$security_contract$;

set constraints all immediate;
rollback;
