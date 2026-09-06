import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const baseMigrationPath = 'supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql'
const fixMigrationPath = 'supabase/migrations/202609060001_arg_3b_two_custodian_total_recovery_forward_fix.sql'
const baseMigration = readFileSync(baseMigrationPath, 'utf8')
const fixMigration = readFileSync(fixMigrationPath, 'utf8')

assert.equal(
  createHash('sha256').update(readFileSync(baseMigrationPath)).digest('hex').toUpperCase(),
  '0E805E004E9446EF93CE0B16AE609E9C767AD81454E8E8B83D76835DE1E41CFA',
  'The frozen ARG-2 migration must remain byte-identical.',
)
assert(baseMigration.includes('v_independent_custodian_count < 2'), 'Test must prove the inherited three-person mismatch existed.')
for (const token of [
  'arg3b_existing_recovery_state_requires_separate_review',
  'arg3b_exactly_two_active_recovery_custodians_required',
  "'requester_attestation', true",
  "'attestation_count', 1",
  "'required_attestations', 2",
  'approvals.custodian_user_id = v_command.actor_user_id',
  "'threshold_met', v_approval_count = 2",
  'v_approval_count <> 2',
]) assert(fixMigration.includes(token), `Missing forward-fix contract token: ${token}`)
assert(!fixMigration.includes('createUser'), 'Database forward-fix must not create Auth identities.')
assert(!fixMigration.includes('center_members set role'), 'Forward-fix install must not mutate business memberships.')

const attest = ({ requester, approver, target }) => {
  assert.notEqual(requester, approver)
  assert.notEqual(requester, target)
  assert.notEqual(approver, target)
  return new Set([requester, approver])
}
assert.deepEqual([...attest({ requester: 'A', approver: 'B', target: 'T' })].sort(), ['A', 'B'])
assert.deepEqual([...attest({ requester: 'B', approver: 'A', target: 'T' })].sort(), ['A', 'B'])
assert.throws(() => attest({ requester: 'A', approver: 'A', target: 'T' }))
assert.throws(() => attest({ requester: 'A', approver: 'T', target: 'T' }))

const dockerProbe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8', windowsHide: true,
})
if (dockerProbe.status === 0) {
  const sql = String.raw`
\set ON_ERROR_STOP on
begin;
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $qa_forward_fix_installed$
begin
  if pg_catalog.obj_description(
    'public.arg2_prepare_owner_recovery(text,text,text,uuid,bigint,text,text,text,timestamp with time zone)'::pg_catalog.regprocedure,
    'pg_proc'
  ) not like 'ARG-3B:%' then
    raise exception 'qa_arg3b_forward_fix_not_installed';
  end if;
end;
$qa_forward_fix_installed$;

insert into public.centers(id,name,slug,environment,status) values
  ('arg3b-qa-center-a','ARG3B QA A','arg3b-qa-a','test','active'),
  ('arg3b-qa-center-b','ARG3B QA B','arg3b-qa-b','test','active');
insert into auth.users(id,aud,role,created_at,updated_at) values
  ('a3000000-0000-4000-8000-000000000001','authenticated','authenticated',now(),now()),
  ('a3000000-0000-4000-8000-000000000002','authenticated','authenticated',now(),now()),
  ('a3000000-0000-4000-8000-000000000003','authenticated','authenticated',now(),now()),
  ('a3000000-0000-4000-8000-000000000004','authenticated','authenticated',now(),now()),
  ('a3000000-0000-4000-8000-000000000005','authenticated','authenticated',now(),now()),
  ('a3000000-0000-4000-8000-000000000006','authenticated','authenticated',now(),now());
insert into public.center_members(id,center_id,user_id,role,status) values
  ('b3000000-0000-4000-8000-000000000001','arg3b-qa-center-a','a3000000-0000-4000-8000-000000000001','owner','active'),
  ('b3000000-0000-4000-8000-000000000002','arg3b-qa-center-b','a3000000-0000-4000-8000-000000000002','owner','active');
select public.arg2_activate_center_governance(
  'arg3b-qa-center-a','b3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',null
);
select public.arg2_activate_center_governance(
  'arg3b-qa-center-b','b3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000002',null
);

insert into public.account_recovery_custodians(auth_user_id,status) values
  ('a3000000-0000-4000-8000-000000000003','active');

do $qa_one_human_denied$
declare v_failed boolean := false;
begin
  begin
    perform public.arg2_prepare_owner_recovery(
      'arg3b-qa-center-a','arg3b-one-human-0001',repeat('1',64),
      'a3000000-0000-4000-8000-000000000003',1,repeat('2',64),'ta***@example.test',
      repeat('3',64),now()+interval '1 hour'
    );
  exception when others then
    v_failed := sqlerrm like '%arg3b_exactly_two_active_recovery_custodians_required%';
  end;
  if not v_failed then raise exception 'qa_one_human_opened_recovery'; end if;
end;
$qa_one_human_denied$;

insert into public.account_recovery_custodians(auth_user_id,status) values
  ('a3000000-0000-4000-8000-000000000004','active');

do $qa_a_requests_b_approves$
declare
  v_request jsonb;
  v_replay jsonb;
  v_result jsonb;
  v_context jsonb;
  v_command uuid;
  v_failed boolean;
  v_event_count integer;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg3b-qa-center-a','arg3b-a-requests-0001',repeat('4',64),
    'a3000000-0000-4000-8000-000000000003',1,repeat('5',64),'ta***@example.test',
    repeat('6',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  if (v_request->>'approval_count')::integer <> 1 or (v_request->>'threshold_met')::boolean then
    raise exception 'qa_requester_not_exactly_first_attestation';
  end if;
  if (select count(*) from public.account_recovery_approvals where command_id=v_command) <> 1
     or not exists (
       select 1 from public.account_recovery_approvals
       where command_id=v_command and custodian_user_id='a3000000-0000-4000-8000-000000000003'
     ) then raise exception 'qa_requester_attestation_not_durable'; end if;

  select count(*) into v_event_count from public.account_governance_events
  where command_id=v_command and event_type='RECOVERY_REQUESTED';
  v_replay := public.arg2_prepare_owner_recovery(
    'arg3b-qa-center-a','arg3b-a-requests-0001',repeat('4',64),
    'a3000000-0000-4000-8000-000000000003',1,repeat('5',64),'ta***@example.test',
    repeat('6',64),now()+interval '1 hour'
  );
  if not (v_replay->>'replayed')::boolean or (v_replay->>'approval_count')::integer <> 1
     or (select count(*) from public.account_recovery_approvals where command_id=v_command) <> 1
     or (select count(*) from public.account_governance_events
         where command_id=v_command and event_type='RECOVERY_REQUESTED') <> v_event_count then
    raise exception 'qa_requester_retry_duplicated_attestation';
  end if;

  v_failed := false;
  begin
    perform public.arg2_approve_owner_recovery(v_command,'a3000000-0000-4000-8000-000000000003',1);
  exception when others then v_failed := sqlerrm like '%arg2_recovery_identity_separation_required%'; end;
  if not v_failed then raise exception 'qa_requester_counted_twice'; end if;

  v_failed := false;
  begin
    perform public.arg2_register_created_identity(
      v_command,'a3000000-0000-4000-8000-000000000005',repeat('5',64),repeat('7',64)
    );
  exception when others then v_failed := sqlerrm like '%arg2_recovery_identity_or_approval_boundary_failed%'; end;
  if not v_failed then raise exception 'qa_one_human_reached_candidate_creation'; end if;

  v_result := public.arg2_approve_owner_recovery(
    v_command,'a3000000-0000-4000-8000-000000000004',1
  );
  if (v_result->>'approval_count')::integer <> 2 or not (v_result->>'threshold_met')::boolean then
    raise exception 'qa_a_request_b_approve_threshold_failed';
  end if;
  select count(*) into v_event_count from public.account_governance_events
  where command_id=v_command and event_type='RECOVERY_APPROVED';
  v_result := public.arg2_approve_owner_recovery(
    v_command,'a3000000-0000-4000-8000-000000000004',1
  );
  if not (v_result->>'replayed')::boolean or (v_result->>'approval_count')::integer <> 2
     or (select count(*) from public.account_governance_events
         where command_id=v_command and event_type='RECOVERY_APPROVED') <> v_event_count then
    raise exception 'qa_second_attestation_retry_not_idempotent';
  end if;

  v_context := public.arg2_get_command_execution_context(
    v_command,'a3000000-0000-4000-8000-000000000003'
  );
  if (v_context->>'recovery_approval_count')::integer <> 2 then
    raise exception 'qa_total_attestation_context_wrong';
  end if;

  perform public.arg2_register_created_identity(
    v_command,'a3000000-0000-4000-8000-000000000005',repeat('5',64),repeat('7',64)
  );
  if not exists (
    select 1 from public.center_members
    where center_id='arg3b-qa-center-a'
      and user_id='a3000000-0000-4000-8000-000000000005'
      and role='owner_candidate' and status='pending_credential'
  ) then raise exception 'qa_two_attestations_did_not_open_candidate_path'; end if;
end;
$qa_a_requests_b_approves$;

do $qa_b_requests_a_approves$
declare v_request jsonb; v_result jsonb; v_command uuid; v_failed boolean;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg3b-qa-center-b','arg3b-b-requests-0001',repeat('8',64),
    'a3000000-0000-4000-8000-000000000004',1,repeat('9',64),'tb***@example.test',
    repeat('a',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  v_failed := false;
  begin
    perform public.arg2_approve_owner_recovery(v_command,'a3000000-0000-4000-8000-000000000006',1);
  exception when others then v_failed := sqlerrm like '%arg2_recovery_custodian_stale_or_inactive%'; end;
  if not v_failed then raise exception 'qa_target_or_non_custodian_approval_not_denied'; end if;
  v_result := public.arg2_approve_owner_recovery(
    v_command,'a3000000-0000-4000-8000-000000000003',1
  );
  if (v_result->>'approval_count')::integer <> 2 or not (v_result->>'threshold_met')::boolean then
    raise exception 'qa_b_request_a_approve_threshold_failed';
  end if;
end;
$qa_b_requests_a_approves$;

do $qa_stale_or_revoked_does_not_count$
declare v_command uuid; v_context jsonb; v_failed boolean;
begin
  select id into v_command from public.account_governance_commands
  where request_id='arg3b-a-requests-0001';
  update public.account_recovery_custodians
  set status='revoked', authority_version=authority_version+1
  where auth_user_id='a3000000-0000-4000-8000-000000000004';
  v_context := public.arg2_get_command_execution_context(
    v_command,'a3000000-0000-4000-8000-000000000003'
  );
  if (v_context->>'recovery_approval_count')::integer <> 0 then
    raise exception 'qa_revoked_custodian_still_counted';
  end if;
  update public.account_recovery_custodians set status='active'
  where auth_user_id='a3000000-0000-4000-8000-000000000004';
  v_context := public.arg2_get_command_execution_context(
    v_command,'a3000000-0000-4000-8000-000000000003'
  );
  if (v_context->>'recovery_approval_count')::integer <> 1 then
    raise exception 'qa_stale_authority_version_still_counted';
  end if;
  v_failed := false;
  begin
    perform public.arg2_register_created_identity(
      v_command,'a3000000-0000-4000-8000-000000000005',repeat('5',64),repeat('7',64)
    );
  exception when others then v_failed := sqlerrm like '%arg2_recovery_identity_or_approval_boundary_failed%'; end;
  if not v_failed then raise exception 'qa_stale_attestation_allowed_recovery_progress'; end if;
end;
$qa_stale_or_revoked_does_not_count$;

do $qa_recovery_has_no_business_authority$
begin
  if exists (
    select 1 from public.center_members
    where user_id in (
      'a3000000-0000-4000-8000-000000000003',
      'a3000000-0000-4000-8000-000000000004'
    )
  ) then raise exception 'qa_recovery_custodian_received_business_membership'; end if;
end;
$qa_recovery_has_no_business_authority$;

rollback;
select 'ARG3B_TWO_CUSTODIAN_LOCAL_DB_QA_PASS';
`
  const dbQa = spawnSync('docker', [
    'exec', '-i', 'supabase_db_ichess-center-os',
    'psql', '-U', 'postgres', '-d', process.env.ARG2_LOCAL_DB_NAME || 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-At',
  ], {
    input: sql, encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024,
  })
  assert.equal(dbQa.status, 0, dbQa.stderr || dbQa.stdout)
  assert(dbQa.stdout.includes('ARG3B_TWO_CUSTODIAN_LOCAL_DB_QA_PASS'), dbQa.stdout)
  console.log('ARG-3B two-custodian transactional local DB QA PASS (fixtures rolled back)')
} else {
  console.log('ARG-3B local PostgreSQL unavailable; deterministic/static QA only')
}

console.log('ARG-3B two-custodian total recovery forward-fix smoke PASS')
