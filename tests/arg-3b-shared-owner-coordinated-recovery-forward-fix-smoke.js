import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const arg2Path = 'supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql'
const twoCustodianPath = 'supabase/migrations/202609060001_arg_3b_two_custodian_total_recovery_forward_fix.sql'
const coordinatedPath = 'supabase/migrations/202609060002_arg_3b_shared_owner_coordinated_recovery_forward_fix.sql'
const edgePath = 'supabase/functions/manage-owner-recovery/index.ts'

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
assert.equal(digest(arg2Path), '0E805E004E9446EF93CE0B16AE609E9C767AD81454E8E8B83D76835DE1E41CFA')
assert.equal(digest(twoCustodianPath), '04D812F2EB0EA5267F75F439853F36BB27B5C49D022B4945DB2D9AC2E5DE7D2A')
assert.equal(digest(coordinatedPath), '441A642445528931DDEB6E054F038FD2300D46FE93E50E00388BEF3E02C500D5')

const sqlSource = readFileSync(coordinatedPath, 'utf8')
const edgeSource = readFileSync(edgePath, 'utf8')
for (const token of [
  'create table public.account_owner_recovery_scopes',
  'account_governance_open_owner_recovery_predecessor_key',
  'arg3b_recovery_scope_integrity_failed',
  'arg3b_recovery_scope_changed',
  'arg3b_sync_recovery_credential_gates',
  "'atomic_scope_swap', true",
  'arg3b_exactly_one_owner_postcondition_failed',
  'affected_center_count',
  'affected_centers',
  'for update of control, owner_membership',
]) assert(sqlSource.includes(token), `Missing coordinated-recovery contract token: ${token}`)
assert(!sqlSource.includes('drop table public.'), 'Forward-fix must remain additive.')
assert(!sqlSource.includes('delete from public.center_members'), 'Recovery must not hard-delete membership history.')
assert(!sqlSource.includes('arg2_shared_owner_recovery_requires_coordinated_plan'),
  'The new path must implement coordinated recovery, not copy the inherited single-center stop.')
for (const token of [
  'affected_center_count',
  'affected_centers',
  'recovery_scope_digest',
  "mode === 'inspect'",
  'scope_confirmation_required',
  'Khôi phục Owner sẽ áp dụng đồng thời',
]) {
  assert(edgeSource.includes(token), `Edge response must expose frozen recovery scope: ${token}`)
}

const dockerProbe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8', windowsHide: true,
})
if (dockerProbe.status === 0) {
  const sql = String.raw`
\set ON_ERROR_STOP on
begin;
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $qa_install$
begin
  if pg_catalog.obj_description(
    'public.arg2_execute_owner_swap(uuid,uuid)'::pg_catalog.regprocedure,
    'pg_proc'
  ) not like 'ARG-3B:%FIX2%' then
    raise exception 'qa_fix2_not_installed';
  end if;
  if not (select relrowsecurity and relforcerowsecurity
          from pg_catalog.pg_class where oid='public.account_owner_recovery_scopes'::pg_catalog.regclass) then
    raise exception 'qa_scope_rls_force_rls_missing';
  end if;
  if pg_catalog.has_table_privilege('authenticated','public.account_owner_recovery_scopes','SELECT')
     or pg_catalog.has_table_privilege('service_role','public.account_owner_recovery_scopes','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'qa_scope_table_privilege_leak';
  end if;
end;
$qa_install$;

insert into public.centers(id,name,slug,environment,status) values
  ('arg3b-fix2-a','ARG3B FIX2 A','arg3b-fix2-a','test','active'),
  ('arg3b-fix2-b','ARG3B FIX2 B','arg3b-fix2-b','test','active'),
  ('arg3b-fix2-c','ARG3B FIX2 C','arg3b-fix2-c','test','active'),
  ('arg3b-fix2-d','ARG3B FIX2 D','arg3b-fix2-d','test','active'),
  ('arg3b-fix2-e','ARG3B FIX2 E','arg3b-fix2-e','test','active'),
  ('arg3b-fix2-late','ARG3B FIX2 LATE','arg3b-fix2-late','test','active'),
  ('arg3b-fix2-single','ARG3B FIX2 SINGLE','arg3b-fix2-single','test','active'),
  ('arg3b-fix2-cancel','ARG3B FIX2 CANCEL','arg3b-fix2-cancel','test','active');

insert into auth.users(id,aud,role,created_at,updated_at) values
  ('a4000000-0000-4000-8000-000000000001','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000002','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000003','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000004','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000005','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000006','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000007','authenticated','authenticated',now(),now()),
  ('a4000000-0000-4000-8000-000000000008','authenticated','authenticated',now(),now());

insert into public.center_members(id,center_id,user_id,role,status) values
  ('b4000000-0000-4000-8000-000000000001','arg3b-fix2-a','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000002','arg3b-fix2-b','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000003','arg3b-fix2-c','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000004','arg3b-fix2-d','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000005','arg3b-fix2-e','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000006','arg3b-fix2-late','a4000000-0000-4000-8000-000000000001','owner','active'),
  ('b4000000-0000-4000-8000-000000000007','arg3b-fix2-single','a4000000-0000-4000-8000-000000000002','owner','active'),
  ('b4000000-0000-4000-8000-000000000008','arg3b-fix2-cancel','a4000000-0000-4000-8000-000000000008','owner','active');

select public.arg2_activate_center_governance('arg3b-fix2-a','b4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',null);
select public.arg2_activate_center_governance('arg3b-fix2-b','b4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000001',null);
select public.arg2_activate_center_governance('arg3b-fix2-c','b4000000-0000-4000-8000-000000000003','a4000000-0000-4000-8000-000000000001',null);
select public.arg2_activate_center_governance('arg3b-fix2-d','b4000000-0000-4000-8000-000000000004','a4000000-0000-4000-8000-000000000001',null);
select public.arg2_activate_center_governance('arg3b-fix2-e','b4000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000001',null);
select public.arg2_activate_center_governance('arg3b-fix2-single','b4000000-0000-4000-8000-000000000007','a4000000-0000-4000-8000-000000000002',null);
select public.arg2_activate_center_governance('arg3b-fix2-cancel','b4000000-0000-4000-8000-000000000008','a4000000-0000-4000-8000-000000000008',null);

insert into public.account_recovery_custodians(auth_user_id,status) values
  ('a4000000-0000-4000-8000-000000000003','active'),
  ('a4000000-0000-4000-8000-000000000004','active');

do $qa_shared_scope$
declare
  v_request jsonb;
  v_replay jsonb;
  v_result jsonb;
  v_context jsonb;
  v_command uuid;
  v_failed boolean;
  v_before integer;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg3b-fix2-a','arg3b-fix2-shared-0001',repeat('1',64),
    'a4000000-0000-4000-8000-000000000003',1,repeat('2',64),'ta***@example.test',
    repeat('3',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  if (v_request->>'affected_center_count')::integer <> 5
     or pg_catalog.jsonb_array_length(v_request->'affected_centers') <> 5
     or (v_request->>'approval_count')::integer <> 1 then
    raise exception 'qa_complete_five_center_scope_not_frozen';
  end if;
  if (select count(*) from public.account_governance_commands
      where action='owner_recovery' and predecessor_user_id='a4000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from public.account_owner_recovery_scopes where command_id=v_command) <> 5 then
    raise exception 'qa_manual_per_center_commands_detected';
  end if;

  v_failed := false;
  begin
    update public.account_owner_recovery_scopes
    set expected_governance_version=expected_governance_version+1
    where command_id=v_command and center_id='arg3b-fix2-a';
  exception when others then v_failed := sqlerrm like '%arg3b_recovery_scope_frozen%'; end;
  if not v_failed then raise exception 'qa_frozen_scope_update_not_denied'; end if;
  v_failed := false;
  begin
    delete from public.account_owner_recovery_scopes
    where command_id=v_command and center_id='arg3b-fix2-a';
  exception when others then v_failed := sqlerrm like '%arg3b_recovery_scope_history_immutable%'; end;
  if not v_failed then raise exception 'qa_scope_delete_not_denied'; end if;

  v_replay := public.arg2_prepare_owner_recovery(
    'arg3b-fix2-a','arg3b-fix2-shared-0001',repeat('1',64),
    'a4000000-0000-4000-8000-000000000003',1,repeat('2',64),'ta***@example.test',
    repeat('3',64),now()+interval '1 hour'
  );
  if not (v_replay->>'replayed')::boolean
     or v_replay->>'recovery_scope_digest' <> v_request->>'recovery_scope_digest' then
    raise exception 'qa_scope_retry_not_stable';
  end if;

  v_failed := false;
  begin
    perform public.arg2_prepare_owner_recovery(
      'arg3b-fix2-a','arg3b-fix2-shared-0001',repeat('f',64),
      'a4000000-0000-4000-8000-000000000003',1,repeat('2',64),'ta***@example.test',
      repeat('3',64),now()+interval '1 hour'
    );
  exception when others then v_failed := sqlerrm like '%arg2_idempotency_intent_conflict%'; end;
  if not v_failed then raise exception 'qa_changed_intent_retry_not_denied'; end if;

  v_failed := false;
  begin
    perform public.arg2_prepare_owner_recovery(
      'arg3b-fix2-b','arg3b-fix2-second-command-0001',repeat('4',64),
      'a4000000-0000-4000-8000-000000000004',1,repeat('5',64),'tx***@example.test',
      repeat('6',64),now()+interval '1 hour'
    );
  exception when others then v_failed := sqlerrm like '%arg3b_owner_recovery_already_open%'; end;
  if not v_failed then raise exception 'qa_second_manual_center_command_not_denied'; end if;

  v_failed := false;
  begin
    perform public.arg2_approve_owner_recovery(v_command,'a4000000-0000-4000-8000-000000000003',1);
  exception when others then v_failed := sqlerrm like '%arg2_recovery_identity_separation_required%'; end;
  if not v_failed then raise exception 'qa_requester_counted_twice'; end if;

  v_result := public.arg2_approve_owner_recovery(v_command,'a4000000-0000-4000-8000-000000000004',1);
  if (v_result->>'approval_count')::integer <> 2
     or not (v_result->>'threshold_met')::boolean
     or (v_result->>'affected_center_count')::integer <> 5 then
    raise exception 'qa_two_custodian_scope_attestation_failed';
  end if;

  perform public.arg2_register_created_identity(
    v_command,'a4000000-0000-4000-8000-000000000005',repeat('2',64),repeat('4',64)
  );
  v_replay := public.arg2_register_created_identity(
    v_command,'a4000000-0000-4000-8000-000000000005',repeat('2',64),repeat('4',64)
  );
  if not (v_replay->>'replayed')::boolean then raise exception 'qa_candidate_retry_not_stable'; end if;
  if (select count(*) from public.account_owner_recovery_scopes
      where command_id=v_command and target_membership_id is not null) <> 5
     or (select count(*) from public.center_members
         where user_id='a4000000-0000-4000-8000-000000000005'
           and role='owner_candidate' and status='pending_credential') <> 5
     or (select count(*) from public.account_credential_gates
         where command_id=v_command and credential_state='temporary') <> 5 then
    raise exception 'qa_candidate_not_bound_to_all_centers';
  end if;

  perform public.arg2_complete_credential_change(
    v_command,'a4000000-0000-4000-8000-000000000005',repeat('5',64)
  );
  v_replay := public.arg2_complete_credential_change(
    v_command,'a4000000-0000-4000-8000-000000000005',repeat('5',64)
  );
  if not (v_replay->>'replayed')::boolean then raise exception 'qa_credential_retry_not_stable'; end if;
  if (select count(*) from public.account_credential_gates
      where command_id=v_command and credential_state='ready') <> 5 then
    raise exception 'qa_credential_readiness_not_coordinated';
  end if;

  -- One scoped version drift must abort without swapping any center.
  update public.center_access_governance set governance_version=governance_version+1
  where center_id='arg3b-fix2-e';
  v_failed := false;
  begin
    perform public.arg2_execute_owner_swap(v_command,'a4000000-0000-4000-8000-000000000004');
  exception when others then v_failed := sqlerrm like '%arg3b_recovery_scope_governance_stale%'; end;
  if not v_failed then raise exception 'qa_scoped_drift_did_not_abort'; end if;
  if (select count(*) from public.center_members
      where center_id in ('arg3b-fix2-a','arg3b-fix2-b','arg3b-fix2-c','arg3b-fix2-d','arg3b-fix2-e')
        and user_id='a4000000-0000-4000-8000-000000000001'
        and role='owner' and status='active') <> 5
     or exists (
       select 1 from public.center_members
       where user_id='a4000000-0000-4000-8000-000000000005'
         and role='owner' and status='active'
     ) then raise exception 'qa_failed_swap_was_partial'; end if;
  update public.center_access_governance set governance_version=governance_version-1
  where center_id='arg3b-fix2-e';

  -- A late governance activation for the same predecessor is serialized and denied.
  v_failed := false;
  begin
    perform public.arg2_activate_center_governance(
      'arg3b-fix2-late','b4000000-0000-4000-8000-000000000006',
      'a4000000-0000-4000-8000-000000000001',null
    );
  exception when others then v_failed := sqlerrm like '%arg3b_owner_has_open_coordinated_recovery%'; end;
  if not v_failed or exists (
    select 1 from public.center_access_governance where center_id='arg3b-fix2-late'
  ) then raise exception 'qa_late_center_scope_race_not_denied'; end if;

  v_result := public.arg2_execute_owner_swap(v_command,'a4000000-0000-4000-8000-000000000004');
  if (v_result->>'affected_center_count')::integer <> 5
     or v_result->>'stage' <> 'authority_swapped' then
    raise exception 'qa_coordinated_swap_result_invalid';
  end if;
  if (select count(*) from public.center_members
      where center_id in ('arg3b-fix2-a','arg3b-fix2-b','arg3b-fix2-c','arg3b-fix2-d','arg3b-fix2-e')
        and user_id='a4000000-0000-4000-8000-000000000005'
        and role='owner' and status='active') <> 5
     or (select count(*) from public.center_members
         where center_id in ('arg3b-fix2-a','arg3b-fix2-b','arg3b-fix2-c','arg3b-fix2-d','arg3b-fix2-e')
           and user_id='a4000000-0000-4000-8000-000000000001'
           and role='former_owner' and status='revoked') <> 5
     or exists (
       select 1 from public.account_owner_recovery_scopes scope
       where scope.command_id=v_command
         and (select count(*) from public.center_members membership
              where membership.center_id=scope.center_id
                and membership.role='owner' and membership.status='active') <> 1
     ) then raise exception 'qa_atomic_five_center_owner_postcondition_failed'; end if;

  v_failed := false;
  begin
    perform public.arg2_prepare_owner_recovery(
      'arg3b-fix2-a','arg3b-fix2-overlap-0001',repeat('a',64),
      'a4000000-0000-4000-8000-000000000003',2,repeat('b',64),'td***@example.test',
      repeat('c',64),now()+interval '1 hour'
    );
  exception when others then v_failed := sqlerrm like '%arg3b_recovery_scope_already_open%'; end;
  if not v_failed then raise exception 'qa_overlapping_recovery_before_invalidation_not_denied'; end if;

  v_result := public.arg2_finalize_session_invalidation(
    v_command,'a4000000-0000-4000-8000-000000000004',repeat('6',64),false,
    'former_owner_session_invalidation_failed'
  );
  if (v_result->>'ok')::boolean or v_result->>'state' <> 'repair_required' then
    raise exception 'qa_invalidation_failure_not_repair_required';
  end if;
  if (select count(*) from public.center_members
      where center_id in ('arg3b-fix2-a','arg3b-fix2-b','arg3b-fix2-c','arg3b-fix2-d','arg3b-fix2-e')
        and user_id='a4000000-0000-4000-8000-000000000005'
        and role='owner' and status='active') <> 5 then
    raise exception 'qa_invalidation_failure_rolled_back_business_denial';
  end if;
  v_result := public.arg2_finalize_session_invalidation(
    v_command,'a4000000-0000-4000-8000-000000000004',repeat('7',64),true,null
  );
  if not (v_result->>'ok')::boolean or v_result->>'state' <> 'finalized' then
    raise exception 'qa_shared_predecessor_invalidation_repair_failed';
  end if;
  v_result := public.arg2_execute_owner_swap(v_command,'a4000000-0000-4000-8000-000000000004');
  if not (v_result->>'replayed')::boolean then raise exception 'qa_final_swap_retry_not_stable'; end if;

  v_context := public.arg2_get_command_execution_context(
    v_command,'a4000000-0000-4000-8000-000000000003'
  );
  if (v_context->>'affected_center_count')::integer <> 5
     or pg_catalog.jsonb_array_length(v_context->'affected_centers') <> 5 then
    raise exception 'qa_context_does_not_expose_frozen_scope';
  end if;
end;
$qa_shared_scope$;

do $qa_single_center_compatibility$
declare v_request jsonb; v_result jsonb; v_command uuid;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg3b-fix2-single','arg3b-fix2-single-0001',repeat('7',64),
    'a4000000-0000-4000-8000-000000000004',1,repeat('8',64),'tb***@example.test',
    repeat('9',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  if (v_request->>'affected_center_count')::integer <> 1 then
    raise exception 'qa_single_center_scope_not_supported';
  end if;
  perform public.arg2_approve_owner_recovery(v_command,'a4000000-0000-4000-8000-000000000003',1);
  perform public.arg2_register_created_identity(
    v_command,'a4000000-0000-4000-8000-000000000006',repeat('8',64),repeat('a',64)
  );
  perform public.arg2_complete_credential_change(
    v_command,'a4000000-0000-4000-8000-000000000006',repeat('b',64)
  );
  v_result := public.arg2_execute_owner_swap(v_command,'a4000000-0000-4000-8000-000000000003');
  if (v_result->>'affected_center_count')::integer <> 1 then
    raise exception 'qa_single_center_swap_failed';
  end if;
end;
$qa_single_center_compatibility$;

do $qa_cancel_scope$
declare v_request jsonb; v_command uuid;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg3b-fix2-cancel','arg3b-fix2-cancel-0001',repeat('c',64),
    'a4000000-0000-4000-8000-000000000003',1,repeat('d',64),'tc***@example.test',
    repeat('e',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  perform public.arg2_approve_owner_recovery(v_command,'a4000000-0000-4000-8000-000000000004',1);
  perform public.arg2_register_created_identity(
    v_command,'a4000000-0000-4000-8000-000000000007',repeat('d',64),repeat('f',64)
  );
  perform public.arg2_cancel_pending_command(
    v_command,'a4000000-0000-4000-8000-000000000003',repeat('0',64)
  );
  if not exists (
    select 1 from public.center_members
    where center_id='arg3b-fix2-cancel'
      and user_id='a4000000-0000-4000-8000-000000000008'
      and role='owner' and status='active'
  ) or exists (
    select 1 from public.center_members
    where user_id='a4000000-0000-4000-8000-000000000007'
      and status <> 'revoked'
  ) or exists (
    select 1 from public.account_credential_gates
    where command_id=v_command and credential_state <> 'locked'
  ) then raise exception 'qa_cancel_did_not_preserve_owner_and_lock_candidate'; end if;
end;
$qa_cancel_scope$;

do $qa_audit_and_scope_history$
begin
  if exists (
    select 1 from public.account_governance_events event
    where pg_catalog.lower(event.metadata::text) ~ 'password|access_token|refresh_token|jwt|service_role_key'
  ) then raise exception 'qa_audit_secret_leak'; end if;
  if not exists (
    select 1 from public.account_governance_events
    where event_type='AUTHORITY_SWAPPED'
      and metadata->>'atomic_scope_swap'='true'
      and (metadata->>'affected_center_count')::integer=5
  ) then raise exception 'qa_coordinated_swap_audit_missing'; end if;
end;
$qa_audit_and_scope_history$;

rollback;
select 'ARG3B_FIX2_SHARED_OWNER_COORDINATED_RECOVERY_LOCAL_DB_QA_PASS';
`
  const dbQa = spawnSync('docker', [
    'exec', '-i', 'supabase_db_ichess-center-os',
    'psql', '-U', 'postgres', '-d', process.env.ARG2_LOCAL_DB_NAME || 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-At',
  ], {
    input: sql, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024,
  })
  assert.equal(dbQa.status, 0, dbQa.stderr || dbQa.stdout)
  assert(dbQa.stdout.includes('ARG3B_FIX2_SHARED_OWNER_COORDINATED_RECOVERY_LOCAL_DB_QA_PASS'), dbQa.stdout)
  console.log('ARG-3B FIX2 coordinated shared-Owner local DB QA PASS (fixtures rolled back)')
} else {
  console.log('ARG-3B FIX2 local PostgreSQL unavailable; deterministic/static QA only')
}

console.log('ARG-3B FIX2 shared-Owner coordinated recovery smoke PASS')
