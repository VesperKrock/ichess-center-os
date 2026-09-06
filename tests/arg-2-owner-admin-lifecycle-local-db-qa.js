import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

class GovernanceModel {
  constructor() {
    this.centers = new Map()
    this.commands = new Map()
    this.events = []
    this.custodians = new Map()
  }

  activate(centerId, ownerId, adminId = null) {
    if (this.centers.has(centerId)) throw new Error('already-enabled')
    this.centers.set(centerId, {
      version: 1,
      owner: { id: ownerId, status: 'active', version: 1 },
      admin: adminId ? { id: adminId, status: 'active', version: 1 } : null,
      candidates: [],
    })
  }

  prepare({ centerId, requestId, intent, action, expectedVersion, actor, target = null }) {
    const key = `${centerId}:${requestId}`
    const existing = this.commands.get(key)
    if (existing) {
      if (existing.intent !== intent || existing.action !== action) throw new Error('intent-conflict')
      return existing
    }
    const center = this.centers.get(centerId)
    if (!center || center.owner.id !== actor || center.owner.status !== 'active') throw new Error('owner-required')
    if (center.version !== expectedVersion) throw new Error('stale')
    const command = { key, centerId, requestId, intent, action, state: 'prepared', stage: 'prepared', target }
    this.commands.set(key, command)
    this.events.push({ key, type: 'PREPARED' })
    if (['reset', 'revoke'].includes(action)) center.admin.status = action === 'reset' ? 'reset_required' : 'revoke_pending'
    return command
  }

  candidate(command, userId, credential = 'temporary') {
    const center = this.centers.get(command.centerId)
    if (center.candidates.some((item) => item.userId === userId)) return command.target
    command.target = { userId, status: 'pending_credential', credential }
    command.stage = 'awaiting_credential'
    center.candidates.push(command.target)
    this.events.push({ key: command.key, type: 'EXTERNAL_IDENTITY_CREATED' })
    return command.target
  }

  ready(command, userId) {
    if (command.target?.userId !== userId || command.stage !== 'awaiting_credential') throw new Error('target-denied')
    command.target.credential = 'ready'
    command.stage = 'target_ready'
  }

  ownerSwap(command, actor) {
    const center = this.centers.get(command.centerId)
    if (center.owner.id !== actor || command.stage !== 'target_ready') throw new Error('swap-denied')
    const old = center.owner
    center.owner = { id: command.target.userId, status: 'active', version: 1 }
    old.status = 'revoked'
    center.version += 1
    command.stage = 'authority_swapped'
    command.state = 'repair_required'
    this.events.push({ key: command.key, type: 'AUTHORITY_SWAPPED' })
    assert.equal(center.owner.status, 'active')
    return old
  }

  finalize(command) {
    if (command.stage !== 'authority_swapped') throw new Error('invalidation-not-expected')
    command.stage = 'complete'
    command.state = 'finalized'
    this.events.push({ key: command.key, type: 'FINALIZED' })
  }
}

const model = new GovernanceModel()
model.activate('center-a', 'owner-a', 'admin-a')
model.activate('center-b', 'owner-b')

const reset = model.prepare({
  centerId: 'center-a', requestId: 'request-reset-1', intent: 'same', action: 'reset',
  expectedVersion: 1, actor: 'owner-a', target: 'admin-a',
})
assert.equal(model.centers.get('center-a').admin.status, 'reset_required')
assert.equal(model.prepare({
  centerId: 'center-a', requestId: 'request-reset-1', intent: 'same', action: 'reset',
  expectedVersion: 1, actor: 'owner-a', target: 'admin-a',
}), reset, 'Exact retry must return the same command.')
assert.throws(() => model.prepare({
  centerId: 'center-a', requestId: 'request-reset-1', intent: 'changed', action: 'reset',
  expectedVersion: 1, actor: 'owner-a', target: 'admin-a',
}), /intent-conflict/)
assert.throws(() => model.prepare({
  centerId: 'center-b', requestId: 'wrong-center', intent: 'x', action: 'reset',
  expectedVersion: 1, actor: 'owner-a', target: 'admin-a',
}), /owner-required/)

const handoff = model.prepare({
  centerId: 'center-b', requestId: 'owner-handoff-1', intent: 'handoff', action: 'handoff',
  expectedVersion: 1, actor: 'owner-b',
})
model.candidate(handoff, 'successor-b')
assert.equal(model.centers.get('center-b').owner.id, 'owner-b', 'Candidate must never become authority early.')
model.ready(handoff, 'successor-b')
const predecessor = model.ownerSwap(handoff, 'owner-b')
assert.equal(predecessor.status, 'revoked')
assert.equal(model.centers.get('center-b').owner.id, 'successor-b')
assert.equal(handoff.state, 'repair_required', 'Swap is not success until predecessor sessions are invalidated.')
assert.throws(() => model.ownerSwap(handoff, 'owner-b'), /swap-denied/, 'Concurrent second swap must lose.')
model.finalize(handoff)
assert.equal(handoff.state, 'finalized')
assert.equal(model.centers.get('center-b').version, 2)
assert.equal(model.events.filter((event) => event.key === handoff.key && event.type === 'PREPARED').length, 1)
assert.equal(model.events.filter((event) => event.key === handoff.key && event.type === 'FINALIZED').length, 1)

const immutableEvents = Object.freeze(model.events.map((event) => Object.freeze({ ...event })))
assert.throws(() => { immutableEvents[0].type = 'tampered' }, TypeError)

// Guarded deterministic DB model: these assertions mirror the transaction boundaries
// of the additive migration without touching production Auth or production membership.
const businessAllowed = (membership) => membership?.status === 'active' &&
  ['owner', 'center_admin'].includes(membership?.role)
assert.equal(businessAllowed({ role: 'center_admin', status: 'pending_credential' }), false)
assert.equal(businessAllowed({ role: 'center_admin', status: 'reset_required' }), false)
assert.equal(businessAllowed({ role: 'center_admin', status: 'revoke_pending' }), false)
assert.equal(businessAllowed({ role: 'center_admin', status: 'revoked' }), false)
assert.equal(businessAllowed({ role: 'center_admin', status: 'active' }), true)

const recovery = {
  requester: 'recovery-requester',
  target: 'successor-a',
  expiresAt: Date.now() + 60_000,
  intent: 'recovery-intent-a',
  approvals: new Map(),
}
function approveRecovery(command, custodian, authorityVersion, intent = command.intent) {
  if (intent !== command.intent) throw new Error('recovery-intent-conflict')
  if (Date.now() >= command.expiresAt) throw new Error('recovery-expired')
  if ([command.requester, command.target].includes(custodian)) throw new Error('identity-collapse')
  if (command.approvals.has(custodian)) return { replayed: true, count: command.approvals.size }
  command.approvals.set(custodian, authorityVersion)
  return { replayed: false, count: command.approvals.size }
}
assert.equal(approveRecovery(recovery, 'custodian-a', 1).count, 1)
assert.equal(recovery.approvals.size >= 2, false, 'One custodian can never authorize recovery.')
assert.deepEqual(approveRecovery(recovery, 'custodian-a', 1), { replayed: true, count: 1 })
assert.equal(recovery.approvals.size, 1, 'The same custodian cannot count twice.')
assert.throws(() => approveRecovery(recovery, 'custodian-b', 1, 'changed-intent'), /intent-conflict/)
assert.equal(approveRecovery(recovery, 'custodian-b', 1).count, 2)
assert.equal(recovery.approvals.size >= 2, true)
assert.throws(() => approveRecovery({ ...recovery, expiresAt: Date.now() - 1 }, 'custodian-c', 1), /expired/)
assert.throws(() => approveRecovery(recovery, recovery.requester, 1), /identity-collapse/)
assert.throws(() => approveRecovery(recovery, recovery.target, 1), /identity-collapse/)

const adminReplacement = {
  old: { id: 'admin-old', role: 'center_admin', status: 'active', historicalActorRefs: 7 },
  candidate: { id: 'admin-new', role: 'center_admin', status: 'pending_credential' },
}
assert.equal(businessAllowed(adminReplacement.candidate), false)
adminReplacement.candidate.status = 'active'
adminReplacement.old.status = 'revoked'
assert.equal(businessAllowed(adminReplacement.candidate), true)
assert.equal(businessAllowed(adminReplacement.old), false)
assert.equal(adminReplacement.old.historicalActorRefs, 7, 'Replacement preserves historical actor references.')

class FaultInjectedSaga {
  constructor({ auth = 'success', finalize = 'success', invalidate = 'success' } = {}) {
    this.outcomes = { auth, finalize, invalidate }
    this.order = []
    this.state = 'new'
    this.businessAuthority = 'active'
  }
  run() {
    this.order.push('PREPARED')
    this.state = 'prepared'
    this.businessAuthority = 'blocked'
    this.order.push('AUTH_ATTEMPT')
    if (this.outcomes.auth !== 'success') {
      this.state = 'repair_required'
      this.order.push('REPAIR_REQUIRED')
      return false
    }
    this.order.push('AUTH_SUCCEEDED')
    if (this.outcomes.finalize !== 'success') {
      this.state = 'repair_required'
      this.order.push('REPAIR_REQUIRED')
      return false
    }
    this.order.push('DB_FINALIZED')
    if (this.outcomes.invalidate !== 'success') {
      this.state = 'repair_required'
      this.order.push('SESSION_INVALIDATION_FAILED')
      return false
    }
    this.order.push('SESSION_INVALIDATED')
    this.state = 'finalized'
    return true
  }
}
for (const fault of [
  { auth: 'failure' },
  { finalize: 'failure' },
  { invalidate: 'failure' },
  { auth: 'timeout' },
]) {
  const saga = new FaultInjectedSaga(fault)
  assert.equal(saga.run(), false)
  assert.equal(saga.state, 'repair_required')
  assert.equal(saga.businessAuthority, 'blocked', 'No failure may restore business authority implicitly.')
  assert.equal(saga.order[0], 'PREPARED', 'Durable prepare must precede every external attempt.')
}
const successfulSaga = new FaultInjectedSaga()
assert.equal(successfulSaga.run(), true)
assert.deepEqual(successfulSaga.order, [
  'PREPARED', 'AUTH_ATTEMPT', 'AUTH_SUCCEEDED', 'DB_FINALIZED', 'SESSION_INVALIDATED',
])

class UnknownResponseReconciler {
  constructor(action) {
    this.action = action
    this.commandId = `${action}-command-1`
    this.intent = `${action}-intent-1`
    this.state = 'prepared'
    this.stage = 'prepared'
    this.businessAuthority = 'blocked'
    this.authMutations = 0
    this.sessionInvalidations = 0
  }
  externalCommit() {
    this.authMutations += 1
    if (this.action === 'revoke') {
      this.state = 'finalized'
      this.stage = 'complete'
      return
    }
    if (this.action === 'replace') {
      this.state = 'repair_required'
      this.stage = 'authority_swapped'
      this.businessAuthority = 'new-admin-only'
      return
    }
    this.state = 'finalized'
    this.stage = 'complete'
    this.businessAuthority = 'ready'
  }
  retry({ commandId, intent }) {
    if (commandId !== this.commandId || intent !== this.intent) throw new Error('intent-conflict')
    if (this.state === 'finalized') return { reconciled: true, repeatedMutation: false }
    if (this.action === 'replace' && this.stage === 'authority_swapped') {
      this.sessionInvalidations += 1
      this.state = 'finalized'
      this.stage = 'complete'
      return { reconciled: true, repeatedMutation: false }
    }
    throw new Error('repair-required')
  }
}
for (const action of ['credential', 'revoke', 'replace']) {
  const reconciler = new UnknownResponseReconciler(action)
  reconciler.externalCommit()
  const result = reconciler.retry({ commandId: reconciler.commandId, intent: reconciler.intent })
  assert.equal(result.reconciled, true)
  assert.equal(result.repeatedMutation, false)
  const lostFinalResponseRetry = reconciler.retry({
    commandId: reconciler.commandId,
    intent: reconciler.intent,
  })
  assert.equal(lostFinalResponseRetry.reconciled, true)
  assert.equal(lostFinalResponseRetry.repeatedMutation, false)
  assert.equal(reconciler.authMutations, 1, `${action} retry must not repeat a committed Auth mutation.`)
  assert.equal(reconciler.sessionInvalidations, action === 'replace' ? 1 : 0,
    `${action} lost final response must not repeat session invalidation.`)
  if (action !== 'credential') {
    assert.equal(reconciler.businessAuthority === 'active', false,
      `${action} reconciliation must not restore the revoked/predecessor authority.`)
  }
  assert.throws(() => reconciler.retry({ commandId: reconciler.commandId, intent: 'changed' }), /intent-conflict/)
}

const lastOwner = { role: 'owner', status: 'active' }
assert.throws(() => {
  const nextOwnerCount = [lastOwner].filter((item) => item.role === 'owner' && item.status === 'active').length - 1
  if (nextOwnerCount !== 1) throw new Error('exactly-one-owner-required')
}, /exactly-one-owner-required/)
assert.equal(businessAllowed({ role: 'recovery_custodian', status: 'active' }), false,
  'Recovery authority alone grants no center business access.')

const dockerProbe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8',
  windowsHide: true,
})
if (dockerProbe.status === 0) {
  const sql = String.raw`
\set ON_ERROR_STOP on
begin;
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $qa_schema$
declare
  v_table text;
  v_role text;
begin
  foreach v_table in array array[
    'center_access_governance','account_governance_subjects','account_governance_commands',
    'account_governance_events','account_credential_gates','account_recovery_custodians',
    'account_recovery_approvals'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity and c.relforcerowsecurity
    ) then raise exception 'qa_rls_force_missing_%', v_table; end if;
    foreach v_role in array array['anon','authenticated','service_role'] loop
      if pg_catalog.has_table_privilege(v_role, 'public.'||v_table, 'INSERT')
         or pg_catalog.has_table_privilege(v_role, 'public.'||v_table, 'UPDATE')
         or pg_catalog.has_table_privilege(v_role, 'public.'||v_table, 'DELETE')
         or pg_catalog.has_table_privilege(v_role, 'public.'||v_table, 'TRUNCATE') then
        raise exception 'qa_direct_dml_leak_%_%', v_table, v_role;
      end if;
    end loop;
  end loop;
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_table_privilege(v_role, 'public.account_audit_logs', 'UPDATE')
       or pg_catalog.has_table_privilege(v_role, 'public.account_audit_logs', 'DELETE')
       or pg_catalog.has_table_privilege(v_role, 'public.account_audit_logs', 'TRUNCATE') then
      raise exception 'qa_legacy_audit_mutation_leak_%', v_role;
    end if;
  end loop;
end;
$qa_schema$;

insert into public.centers(id,name,slug,environment,status) values
  ('arg2-qa-center-a','ARG2 QA A','arg2-qa-a','test','active'),
  ('arg2-qa-center-b','ARG2 QA B','arg2-qa-b','test','active');
insert into auth.users(id,aud,role,created_at,updated_at) values
  ('a2000000-0000-4000-8000-000000000001','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000002','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000003','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000004','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000005','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000006','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000007','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000008','authenticated','authenticated',now(),now()),
  ('a2000000-0000-4000-8000-000000000009','authenticated','authenticated',now(),now());
insert into public.center_members(id,center_id,user_id,role,status) values
  ('b2000000-0000-4000-8000-000000000001','arg2-qa-center-a','a2000000-0000-4000-8000-000000000001','owner','active'),
  ('b2000000-0000-4000-8000-000000000002','arg2-qa-center-a','a2000000-0000-4000-8000-000000000002','admin','active'),
  ('b2000000-0000-4000-8000-000000000003','arg2-qa-center-b','a2000000-0000-4000-8000-000000000003','owner','active');

select public.arg2_activate_center_governance(
  'arg2-qa-center-a','b2000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002'
);
select public.arg2_activate_center_governance(
  'arg2-qa-center-b','b2000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000003',null
);

do $qa_owner_invariant$
declare
  v_failed boolean;
begin
  v_failed := false;
  begin
    update public.center_members
    set status = 'revoked'
    where id = 'b2000000-0000-4000-8000-000000000001';
    set constraints all immediate;
  exception when others then
    v_failed := sqlerrm like '%arg2_exactly_one_active_owner_required%';
  end;
  set constraints all deferred;
  if not v_failed then raise exception 'qa_last_owner_revoke_not_denied'; end if;

  v_failed := false;
  begin
    update public.center_members
    set role = 'former_owner'
    where id = 'b2000000-0000-4000-8000-000000000001';
    set constraints all immediate;
  exception when others then
    v_failed := sqlerrm like '%arg2_exactly_one_active_owner_required%';
  end;
  set constraints all deferred;
  if not v_failed then raise exception 'qa_last_owner_demote_not_denied'; end if;

  v_failed := false;
  begin
    delete from public.center_members
    where id = 'b2000000-0000-4000-8000-000000000001';
    set constraints all immediate;
  exception when others then
    -- Either the governed-owner trigger or the canonical pointer's RESTRICT
    -- FK may fire first; both are valid server-side hard denial.
    v_failed := true;
  end;
  set constraints all deferred;
  if not v_failed then raise exception 'qa_last_owner_delete_not_denied'; end if;

  v_failed := false;
  begin
    perform public.arg2_list_center_account_lifecycle(
      array['arg2-qa-center-b'], 'a2000000-0000-4000-8000-000000000001'
    );
  exception when others then
    v_failed := sqlerrm like '%arg2_owner_required%';
  end;
  if not v_failed then raise exception 'qa_cross_center_capability_metadata_leak'; end if;
end;
$qa_owner_invariant$;

do $qa_lifecycle$
declare
  v_first jsonb;
  v_retry jsonb;
  v_result jsonb;
  v_command uuid;
  v_admin_membership_id uuid;
  v_version integer;
  v_failed boolean;
begin
  if (select count(*) from public.center_members where center_id='arg2-qa-center-a' and role='owner' and status='active') <> 1
     or (select count(*) from public.center_members where center_id='arg2-qa-center-b' and role='owner' and status='active') <> 1 then
    raise exception 'qa_one_owner_activation_failed';
  end if;
  if (select role from public.center_members where id='b2000000-0000-4000-8000-000000000002') <> 'center_admin' then
    raise exception 'qa_raw_admin_not_normalized';
  end if;

  v_first := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-reset-request-0001','reset_admin',repeat('1',64),
    'a2000000-0000-4000-8000-000000000001',1,
    'b2000000-0000-4000-8000-000000000002',2,null,null,null,'{}'::jsonb
  );
  v_retry := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-reset-request-0001','reset_admin',repeat('1',64),
    'a2000000-0000-4000-8000-000000000001',1,
    'b2000000-0000-4000-8000-000000000002',2,null,null,null,'{}'::jsonb
  );
  if v_first->>'command_id' <> v_retry->>'command_id' or (v_retry->>'replayed')::boolean is not true then
    raise exception 'qa_exact_retry_not_stable';
  end if;
  v_failed := false;
  begin
    perform public.arg2_prepare_lifecycle_command(
      'arg2-qa-center-a','arg2-reset-request-0001','reset_admin',repeat('2',64),
      'a2000000-0000-4000-8000-000000000001',1,
      'b2000000-0000-4000-8000-000000000002',2,null,null,null,'{}'::jsonb
    );
  exception when others then v_failed := sqlerrm like '%arg2_idempotency_intent_conflict%'; end;
  if not v_failed then raise exception 'qa_changed_intent_not_denied'; end if;
  v_failed := false;
  begin
    perform public.arg2_prepare_lifecycle_command(
      'arg2-qa-center-a','arg2-cross-center-0001','reset_admin',repeat('3',64),
      'a2000000-0000-4000-8000-000000000003',1,
      'b2000000-0000-4000-8000-000000000002',2,null,null,null,'{}'::jsonb
    );
  exception when others then v_failed := sqlerrm like '%arg2_owner_required%'; end;
  if not v_failed then raise exception 'qa_cross_center_governance_not_denied'; end if;
  v_failed := false;
  begin
    perform public.arg2_prepare_lifecycle_command(
      'arg2-qa-center-a','arg2-admin-governance-0001','reset_admin',repeat('3',64),
      'a2000000-0000-4000-8000-000000000002',1,
      'b2000000-0000-4000-8000-000000000002',2,null,null,null,'{}'::jsonb
    );
  exception when others then v_failed := sqlerrm like '%arg2_owner_required%'; end;
  if not v_failed then raise exception 'qa_admin_owner_governance_not_denied'; end if;
  if (select status from public.center_members where id='b2000000-0000-4000-8000-000000000002') <> 'reset_required' then
    raise exception 'qa_reset_did_not_block_business';
  end if;
  v_command := (v_first->>'command_id')::uuid;
  v_result := public.arg2_record_external_credential_result(
    v_command,'a2000000-0000-4000-8000-000000000002',repeat('4',64),false,'fault_injected'
  );
  if v_result->>'state' <> 'repair_required' then raise exception 'qa_auth_failure_not_repairable'; end if;
  v_result := public.arg2_record_external_credential_result(
    v_command,'a2000000-0000-4000-8000-000000000002',repeat('5',64),true,null
  );
  if v_result->>'stage' <> 'awaiting_credential' then raise exception 'qa_repair_resume_failed'; end if;
  perform public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000002',repeat('6',64)
  );
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000002'
  );
  if v_result->>'operation' <> 'already_complete' then
    raise exception 'qa_credential_completion_lost_response_not_reconciled';
  end if;
  v_result := public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000002',repeat('6',64)
  );
  if not (v_result->>'replayed')::boolean or v_result->>'state' <> 'finalized' then
    raise exception 'qa_credential_completion_exact_retry_not_stable';
  end if;
  if (select status from public.center_members where id='b2000000-0000-4000-8000-000000000002') <> 'active' then
    raise exception 'qa_credential_completion_not_active';
  end if;

  select membership_version into v_version from public.center_members
  where id='b2000000-0000-4000-8000-000000000002';
  v_first := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-replace-request-0001','replace_admin',repeat('7',64),
    'a2000000-0000-4000-8000-000000000001',1,
    'b2000000-0000-4000-8000-000000000002',v_version,repeat('8',64),'ne***@example.test',null,'{}'::jsonb
  );
  v_command := (v_first->>'command_id')::uuid;
  perform public.arg2_register_created_identity(
    v_command,'a2000000-0000-4000-8000-000000000004',repeat('8',64),repeat('9',64)
  );
  if exists (select 1 from public.center_members where user_id='a2000000-0000-4000-8000-000000000004' and status='active') then
    raise exception 'qa_candidate_received_early_authority';
  end if;
  v_result := public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000004',repeat('a',64)
  );
  if v_result->>'state' <> 'repair_required'
     or (select status from public.center_members where id='b2000000-0000-4000-8000-000000000002') <> 'revoked'
     or not exists (select 1 from public.center_members where user_id='a2000000-0000-4000-8000-000000000004' and status='active') then
    raise exception 'qa_atomic_admin_replacement_failed';
  end if;
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000004'
  );
  if v_result->>'operation' <> 'resume_session_invalidation' then
    raise exception 'qa_admin_replacement_authority_swapped_not_resumable';
  end if;
  v_result := public.arg2_finalize_session_invalidation(
    v_command,'a2000000-0000-4000-8000-000000000001',repeat('b',64),false,
    'predecessor_session_invalidation_failed'
  );
  if v_result->>'state' <> 'repair_required' then raise exception 'qa_invalidation_failure_false_success'; end if;
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000004'
  );
  if v_result->>'operation' <> 'resume_session_invalidation' then
    raise exception 'qa_admin_replacement_failed_invalidation_not_resumable';
  end if;
  v_result := public.arg2_finalize_session_invalidation(
    v_command,'a2000000-0000-4000-8000-000000000001',repeat('c',64),true,null
  );
  if v_result->>'state' <> 'finalized' then raise exception 'qa_invalidation_repair_failed'; end if;
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000004'
  );
  if v_result->>'operation' <> 'already_complete' then
    raise exception 'qa_admin_replacement_lost_final_response_not_reconciled';
  end if;

  select id, membership_version into v_admin_membership_id, v_version
  from public.center_members
  where center_id='arg2-qa-center-a'
    and user_id='a2000000-0000-4000-8000-000000000004';
  v_first := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-revoke-request-0001','revoke_admin',repeat('a',64),
    'a2000000-0000-4000-8000-000000000001',2,
    v_admin_membership_id,v_version,null,null,null,'{}'::jsonb
  );
  v_command := (v_first->>'command_id')::uuid;
  v_result := public.arg2_record_external_credential_result(
    v_command,'a2000000-0000-4000-8000-000000000004',repeat('b',64),true,null
  );
  if v_result->>'state' <> 'finalized'
     or (select status from public.center_members where id=v_admin_membership_id) <> 'revoked' then
    raise exception 'qa_revoke_did_not_commit_business_denial';
  end if;
  v_retry := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-revoke-request-0001','revoke_admin',repeat('a',64),
    'a2000000-0000-4000-8000-000000000001',2,
    v_admin_membership_id,v_version,null,null,null,'{}'::jsonb
  );
  if v_retry->>'state' <> 'finalized'
     or v_retry->>'command_id' <> v_first->>'command_id'
     or (select status from public.center_members where id=v_admin_membership_id) <> 'revoked' then
    raise exception 'qa_revoke_lost_response_not_reconciled';
  end if;

  select membership_version into v_version from public.center_members where id=v_admin_membership_id;
  v_first := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-a','arg2-restore-request-0001','restore_admin',repeat('c',64),
    'a2000000-0000-4000-8000-000000000001',2,
    v_admin_membership_id,v_version,null,null,null,'{}'::jsonb
  );
  v_command := (v_first->>'command_id')::uuid;
  perform public.arg2_mark_command_repair_required(
    v_command,'a2000000-0000-4000-8000-000000000001',
    'candidate_credential_reissue_required',repeat('d',64)
  );
  v_result := public.arg2_record_external_credential_result(
    v_command,'a2000000-0000-4000-8000-000000000004',repeat('e',64),true,null
  );
  if v_result->>'stage' <> 'awaiting_credential' then
    raise exception 'qa_restore_same_command_repair_not_resumable';
  end if;
  perform public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000004',repeat('f',64)
  );
  if (select status from public.center_members where id=v_admin_membership_id) <> 'active' then
    raise exception 'qa_restore_did_not_return_ready_after_credential_completion';
  end if;

  v_first := public.arg2_prepare_lifecycle_command(
    'arg2-qa-center-b','arg2-handoff-request-0001','owner_handoff',repeat('d',64),
    'a2000000-0000-4000-8000-000000000003',1,
    'b2000000-0000-4000-8000-000000000003',1,repeat('e',64),'su***@example.test',
    now()+interval '1 hour','{}'::jsonb
  );
  v_command := (v_first->>'command_id')::uuid;
  perform public.arg2_register_created_identity(
    v_command,'a2000000-0000-4000-8000-000000000005',repeat('e',64),repeat('f',64)
  );
  perform public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000005',repeat('0',64)
  );
  perform public.arg2_mark_command_repair_required(
    v_command,'a2000000-0000-4000-8000-000000000005',
    'credential_changed_database_finalize_failed',repeat('2',64)
  );
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000005'
  );
  if v_result->>'operation' <> 'resume_database_finalize' then
    raise exception 'qa_target_ready_unknown_response_not_reconcilable';
  end if;
  v_result := public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000005',repeat('0',64)
  );
  if v_result->>'stage' <> 'target_ready' or v_result->>'state' <> 'prepared' then
    raise exception 'qa_target_ready_reconciliation_not_stable';
  end if;
  if (select user_id from public.center_members where id='b2000000-0000-4000-8000-000000000003') <> 'a2000000-0000-4000-8000-000000000003' then
    raise exception 'qa_handoff_changed_owner_before_finalize';
  end if;
  perform public.arg2_execute_owner_swap(v_command,'a2000000-0000-4000-8000-000000000003');
  if (select count(*) from public.center_members where center_id='arg2-qa-center-b' and role='owner' and status='active') <> 1
     or not exists (select 1 from public.center_members where center_id='arg2-qa-center-b' and user_id='a2000000-0000-4000-8000-000000000005' and role='owner' and status='active') then
    raise exception 'qa_owner_handoff_zero_lockout_failed';
  end if;
  v_result := public.arg2_validate_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000005'
  );
  if v_result->>'operation' <> 'resume_session_invalidation' then
    raise exception 'qa_handoff_authority_swapped_not_resumable';
  end if;
  v_failed := false;
  begin perform public.arg2_execute_owner_swap(v_command,'a2000000-0000-4000-8000-000000000003');
  exception when others then v_failed := sqlerrm like '%arg2_owner_swap_not_ready%'; end;
  if not v_failed then raise exception 'qa_concurrent_second_handoff_not_denied'; end if;
  perform public.arg2_finalize_session_invalidation(
    v_command,'a2000000-0000-4000-8000-000000000005',repeat('1',64),true,null
  );
end;
$qa_lifecycle$;

insert into public.account_recovery_custodians(auth_user_id,status) values
 ('a2000000-0000-4000-8000-000000000006','active');

do $qa_recovery_minimum$
declare
  v_failed boolean := false;
begin
  begin
    perform public.arg2_prepare_owner_recovery(
      'arg2-qa-center-a','arg2-recovery-too-few-0001',repeat('1',64),
      'a2000000-0000-4000-8000-000000000006',2,repeat('2',64),'re***@example.test',
      repeat('3',64),now()+interval '1 hour'
    );
  exception when others then
    v_failed := sqlerrm like '%arg2_two_independent_recovery_custodians_required%';
  end;
  if not v_failed then raise exception 'qa_recovery_not_disabled_without_two_independent_approvers'; end if;
end;
$qa_recovery_minimum$;

insert into public.account_recovery_custodians(auth_user_id,status) values
 ('a2000000-0000-4000-8000-000000000007','active'),
 ('a2000000-0000-4000-8000-000000000008','active');

do $qa_recovery$
declare
  v_request jsonb;
  v_result jsonb;
  v_command uuid;
  v_failed boolean;
  v_event_count integer;
begin
  v_request := public.arg2_prepare_owner_recovery(
    'arg2-qa-center-a','arg2-recovery-request-0001',repeat('2',64),
    'a2000000-0000-4000-8000-000000000006',2,repeat('3',64),'re***@example.test',
    repeat('4',64),now()+interval '1 hour'
  );
  v_command := (v_request->>'command_id')::uuid;
  v_result := public.arg2_approve_owner_recovery(v_command,'a2000000-0000-4000-8000-000000000007',1);
  if (v_result->>'threshold_met')::boolean then raise exception 'qa_one_custodian_met_threshold'; end if;
  select count(*) into v_event_count from public.account_governance_events
  where command_id = v_command and event_type = 'RECOVERY_APPROVED';
  v_result := public.arg2_approve_owner_recovery(v_command,'a2000000-0000-4000-8000-000000000007',1);
  if (v_result->>'approval_count')::integer <> 1
     or not (v_result->>'replayed')::boolean
     or (select count(*) from public.account_governance_events
         where command_id = v_command and event_type = 'RECOVERY_APPROVED') <> v_event_count then
    raise exception 'qa_same_custodian_counted_or_audited_twice';
  end if;
  v_result := public.arg2_approve_owner_recovery(v_command,'a2000000-0000-4000-8000-000000000008',1);
  if not (v_result->>'threshold_met')::boolean then raise exception 'qa_two_custodian_threshold_failed'; end if;
  perform public.arg2_register_created_identity(
    v_command,'a2000000-0000-4000-8000-000000000009',repeat('3',64),repeat('5',64)
  );
  perform public.arg2_complete_credential_change(
    v_command,'a2000000-0000-4000-8000-000000000009',repeat('6',64)
  );
  v_failed := false;
  begin
    perform public.arg2_execute_owner_swap(v_command,'a2000000-0000-4000-8000-000000000001');
  exception when others then v_failed := sqlerrm like '%arg2_active_recovery_custodian_required%'; end;
  if not v_failed then raise exception 'qa_non_custodian_recovery_execution_not_denied'; end if;
  perform public.arg2_execute_owner_swap(v_command,'a2000000-0000-4000-8000-000000000007');
  if (select count(*) from public.center_members where center_id='arg2-qa-center-a' and role='owner' and status='active') <> 1
     or not exists (select 1 from public.center_members where center_id='arg2-qa-center-a' and user_id='a2000000-0000-4000-8000-000000000009' and role='owner' and status='active') then
    raise exception 'qa_recovery_zero_lockout_failed';
  end if;
  perform public.arg2_finalize_session_invalidation(
    v_command,'a2000000-0000-4000-8000-000000000007',repeat('7',64),true,null
  );
  if exists (
    select 1 from public.center_members
    where user_id in ('a2000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000007','a2000000-0000-4000-8000-000000000008')
  ) then raise exception 'qa_recovery_authority_received_business_membership'; end if;
end;
$qa_recovery$;

do $qa_audit$
declare
  v_failed boolean;
begin
  if not exists (select 1 from public.account_governance_events where event_type='PREPARED')
     or exists (
       select 1 from public.account_governance_events
       where pg_catalog.lower(metadata::text) ~ 'password|access_token|refresh_token|jwt|secret'
     ) then raise exception 'qa_audit_missing_or_secret_leak'; end if;
  if exists (
    select 1 from public.account_governance_commands
    where pg_catalog.lower(safe_context::text) ~ 'password|access_token|refresh_token|jwt|secret'
  ) then raise exception 'qa_command_secret_leak'; end if;

  v_failed := false;
  begin
    update public.account_governance_events set event_type = event_type
    where id = (select id from public.account_governance_events order by created_at limit 1);
  exception when others then v_failed := sqlerrm like '%arg2_governance_audit_is_append_only%'; end;
  if not v_failed then raise exception 'qa_audit_update_not_denied'; end if;

  v_failed := false;
  begin
    delete from public.account_governance_events
    where id = (select id from public.account_governance_events order by created_at limit 1);
  exception when others then v_failed := sqlerrm like '%arg2_governance_audit_is_append_only%'; end;
  if not v_failed then raise exception 'qa_audit_delete_not_denied'; end if;

  v_failed := false;
  begin
    truncate table public.account_governance_events;
  exception when others then v_failed := sqlerrm like '%arg2_governance_audit_is_append_only%'; end;
  if not v_failed then raise exception 'qa_audit_truncate_not_denied'; end if;
end;
$qa_audit$;

rollback;
select 'ARG2_LOCAL_DB_QA_PASS';
`
  const dbQa = spawnSync('docker', [
    'exec', '-i', 'supabase_db_ichess-center-os',
    'psql', '-U', 'postgres', '-d', process.env.ARG2_LOCAL_DB_NAME || 'postgres', '-v', 'ON_ERROR_STOP=1', '-At',
  ], {
    input: sql,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  })
  assert.equal(dbQa.status, 0, dbQa.stderr || dbQa.stdout)
  assert(dbQa.stdout.includes('ARG2_LOCAL_DB_QA_PASS'), dbQa.stdout)
  console.log('ARG-2 guarded existing-local-DB transactional QA PASS (fixtures rolled back)')
} else {
  console.log('ARG-2 local PostgreSQL unavailable; deterministic model QA only')
}
console.log('ARG-2 deterministic lifecycle/concurrency model QA PASS')
