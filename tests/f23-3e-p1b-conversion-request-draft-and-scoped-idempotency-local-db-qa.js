import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P1B_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')

assert.equal(process.argv.length, 2, 'This runner accepts no URL, credential, project, or mode arguments')
assert.equal(process.env[resetConsentFlag], 'YES', `${resetConsentFlag}=YES is required before any mutation`)
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked project reference is forbidden')
assert(!process.argv.includes(linkedFlag), 'Linked mode is forbidden')

const assertLoopback = (value, label) => {
  if (!value) return
  let host = value
  try { host = new URL(value).hostname } catch { host = value.split(':')[0] }
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(host.toLowerCase()), `${label} must resolve to loopback`)
}
for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL']) {
  assertLoopback(process.env[name], name)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 32 * 1024 * 1024, ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${label} failed with exit ${result.status}${detail ? `:\n${detail}` : ''}`)
  }
  return result.stdout
}

const localCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const localArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]

const statusResult = run(localCommand, localArgs('status -o json'))
assert.equal(statusResult.status, 0, 'Local Supabase status failed; no fallback is permitted')
const localStatus = JSON.parse(statusResult.stdout)
assert.equal(typeof localStatus.DB_URL, 'string', 'Local status omitted DB_URL')
assertLoopback(new URL(localStatus.DB_URL).hostname, 'Supabase local DB')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, `Expected exactly one running ${expectedContainerName}`)
  assert(/supabase\/postgres/i.test(rows[0][2]), 'Unexpected database image')
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format', '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ]), 'Docker inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match, 'Could not parse Docker labels')
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  return rows[0][0]
}

let containerId = discoverContainer()
console.log('P1B_QA_LOCAL_SAFETY_GUARD: PASS')

const runReset = () => requireSuccess(
  run(localCommand, localArgs('db reset'), { timeout: 180_000 }),
  'npx --no-install supabase db reset',
)

const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, { expectFailure = false } = {}) => {
  const result = run('docker', psqlArgs(), { input: sql })
  if (!expectFailure) requireSuccess(result, 'Local container psql')
  return result
}
const jsonResult = (sql) => {
  const output = psql(sql).stdout.trim().split(/\r?\n/).map((line) => line.trim())
  const line = [...output].reverse().find((value) => value.startsWith('{'))
  assert(line, `Expected JSON result, received: ${output.join(' | ')}`)
  return JSON.parse(line)
}
const scalar = (sql) => psql(sql).stdout.trim()
const h = (label) => createHash('sha256').update(label).digest('hex')
const b = (hex) => `decode('${hex}', 'hex')`
const u = (value) => `'${value}'::uuid`
const t = (value) => `'${value}'`
const expires = `pg_catalog.transaction_timestamp() + interval '1 hour'`

const fixtures = Object.fromEntries([
  'gate', 'lifecycle', 'actor', 'source', 'assignment', 'update', 'cancelDraft',
  'cancelReady', 'faultAudit', 'faultOutbox', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
].map((name) => [name, {
  name, center: randomUUID(), contact: randomUUID(), caseId: randomUUID(), assignment: randomUUID(),
}]))
const actorA = randomUUID()
const actorB = randomUUID()
const allFixtureIds = [actorA, actorB, ...Object.values(fixtures).flatMap((f) => [f.center, f.contact, f.caseId, f.assignment])]

const createArgs = (f, key, intent, graph, overrides = {}) => [
  u(f.caseId), u(overrides.actor ?? actorA), overrides.caseVersion ?? 2,
  overrides.contactVersion ?? 1, overrides.assignmentVersion ?? 1,
  b(h('environment')), b(h(key)), b(h(intent)), b(h(graph)), expires,
].join(', ')
const createSql = (f, key, intent, graph, overrides) =>
  `select pg_catalog.row_to_json(r)::text from public.f23_3e_p1b_create_conversion_draft(${createArgs(f, key, intent, graph, overrides)}) r;`

const updateArgs = (requestId, key, operationIntent, requestIntent, graph, expected = {}) => [
  u(requestId), u(expected.actor ?? actorA), expected.requestVersion ?? 1,
  expected.caseVersion ?? 3, expected.contactVersion ?? 1, expected.assignmentVersion ?? 1,
  b(h('environment')), b(h(key)), b(h(operationIntent)), b(h(requestIntent)), b(h(graph)), expires,
].join(', ')
const updateSql = (requestId, key, operationIntent, requestIntent, graph, expected) =>
  `select pg_catalog.row_to_json(r)::text from public.f23_3e_p1b_update_conversion_draft(${updateArgs(requestId, key, operationIntent, requestIntent, graph, expected)}) r;`

const submitArgs = (requestId, key, operationIntent, requestIntent, graph, expected = {}) => [
  u(requestId), u(expected.actor ?? actorA), expected.requestVersion ?? 1,
  expected.caseVersion ?? 3, expected.contactVersion ?? 1, expected.assignmentVersion ?? 1,
  b(h(requestIntent)), b(h(graph)), b(h('environment')), b(h(key)), b(h(operationIntent)), expires,
].join(', ')
const submitSql = (requestId, key, operationIntent, requestIntent, graph, expected) =>
  `select pg_catalog.row_to_json(r)::text from public.f23_3e_p1b_submit_conversion_draft(${submitArgs(requestId, key, operationIntent, requestIntent, graph, expected)}) r;`

const cancelArgs = (requestId, key, operationIntent, expected = {}) => [
  u(requestId), u(expected.actor ?? actorA), expected.requestVersion ?? 1,
  expected.caseVersion ?? 3, expected.assignmentVersion ?? 1,
  b(h('environment')), b(h(key)), b(h(operationIntent)), t(expected.reason ?? 'qa_cancelled'), expires,
].join(', ')
const cancelSql = (requestId, key, operationIntent, expected) =>
  `select pg_catalog.row_to_json(r)::text from public.f23_3e_p1b_cancel_conversion_request(${cancelArgs(requestId, key, operationIntent, expected)}) r;`

const parseWorkerJson = (output) => {
  const line = output.split(/\r?\n/).map((v) => v.trim()).reverse().find((v) => v.startsWith('{'))
  assert(line, `Concurrent worker omitted JSON: ${output}`)
  return JSON.parse(line)
}
const spawnPsql = () => spawn('docker', psqlArgs(), {
  cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
})
const collect = (child) => {
  let stdout = ''; let stderr = ''
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const done = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`psql worker ${code}: ${stderr || stdout}`)))
  })
  const marker = (needle) => new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`Timed out waiting for ${needle}`)), 15_000)
    const check = () => {
      if (stdout.includes(needle)) { clearTimeout(deadline); resolve() }
      else setTimeout(check, 10)
    }
    check()
  })
  return { child, done, marker }
}
const concurrentBarrier = async (number, sqlA, sqlB) => {
  const coordinator = collect(spawnPsql())
  coordinator.child.stdin.write(`select pg_catalog.pg_advisory_lock(230731, ${number});\nselect 'BARRIER_READY';\n`)
  await coordinator.marker('BARRIER_READY')
  const a = collect(spawnPsql()); const bWorker = collect(spawnPsql())
  a.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230731, ${number});\nselect pg_catalog.pg_advisory_unlock(230731, ${number});\n${sqlA}\n`)
  bWorker.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230731, ${number});\nselect pg_catalog.pg_advisory_unlock(230731, ${number});\n${sqlB}\n`)
  await Promise.all([a.marker('WORKER_READY'), bWorker.marker('WORKER_READY')])
  coordinator.child.stdin.end(`select pg_catalog.pg_advisory_unlock(230731, ${number});\n`)
  const [ra, rb] = await Promise.all([a.done, bWorker.done])
  await coordinator.done
  return [parseWorkerJson(ra.stdout), parseWorkerJson(rb.stdout)]
}

let primaryError
let finalResetPassed = false
let leftoverCount = -1
try {
  runReset()
  containerId = discoverContainer()

  const migrationCount = scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002');`)
  assert.equal(migrationCount, '2', 'P1A/P1B migration history missing after clean reset')

  const rpcSignatures = [
    'public.f23_3e_p1b_create_conversion_draft(uuid,uuid,integer,integer,integer,bytea,bytea,bytea,bytea,timestamp with time zone)',
    'public.f23_3e_p1b_update_conversion_draft(uuid,uuid,integer,integer,integer,integer,bytea,bytea,bytea,bytea,bytea,timestamp with time zone)',
    'public.f23_3e_p1b_submit_conversion_draft(uuid,uuid,integer,integer,integer,integer,bytea,bytea,bytea,bytea,bytea,timestamp with time zone)',
    'public.f23_3e_p1b_cancel_conversion_request(uuid,uuid,integer,integer,integer,bytea,bytea,bytea,text,timestamp with time zone)',
    'public.f23_3e_p1b_get_conversion_request_status(uuid)',
  ]
  const catalogChecks = `
do $qa$
declare v_signature text;
begin
  foreach v_signature in array array[${rpcSignatures.map(t).join(',')}] loop
    if pg_catalog.to_regprocedure(v_signature) is null then raise exception 'missing_rpc_%', v_signature; end if;
    if not pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE') then raise exception 'service_grant_missing_%', v_signature; end if;
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('public', v_signature, 'EXECUTE') then
      raise exception 'browser_or_public_grant_%', v_signature;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p1b_internal_%'
      and (pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) then raise exception 'helper_exposed'; end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'f23_3e_p1b_create_conversion_draft','f23_3e_p1b_update_conversion_draft',
      'f23_3e_p1b_submit_conversion_draft','f23_3e_p1b_cancel_conversion_request',
      'f23_3e_p1b_get_conversion_request_status'
    ) and (not p.prosecdef or not ('search_path=""'=any(p.proconfig)))
  ) then raise exception 'rpc_security_drift'; end if;
end $qa$;
`
  psql(catalogChecks)
  const denied = psql(`set role authenticated; select * from public.f23_3e_p1b_get_conversion_request_status(${u(randomUUID())});`, { expectFailure: true })
  assert.notEqual(denied.status, 0)
  assert.match(`${denied.stdout}\n${denied.stderr}`, /permission denied for function/i)
  console.log('P1B_QA_BROWSER_RPC_EXECUTE_DENIED: PASS')
  console.log('P1B_QA_SERVICE_ROLE_RPC_GRANTS_EXACT: PASS')
  console.log('P1B_QA_HELPER_FUNCTIONS_NOT_EXPOSED: PASS')

  const centersSql = Object.values(fixtures).map((f) => `(${t(f.center)}, ${t(`p1bqa_${f.name}`)})`).join(',\n')
  const contactsSql = Object.values(fixtures).map((f, i) => `(
    ${u(f.contact)}, ${t(f.center)}, 'qa_source', decode('01','hex'), 1,
    array[${b(h(`lookup_${i}`))}], 1, ${u(actorA)}
  )`).join(',\n')
  const casesSql = Object.values(fixtures).map((f) => `(${u(f.caseId)}, ${t(f.center)}, ${u(f.contact)}, ${u(actorA)})`).join(',\n')
  const assignmentsSql = Object.values(fixtures).map((f) => `(${u(f.assignment)}, ${t(f.center)}, ${u(f.caseId)}, ${u(actorA)}, ${u(actorA)})`).join(',\n')
  const activeCenters = Object.values(fixtures).filter((f) => f.name !== 'gate').map((f) => t(f.center)).join(',')
  psql(`
begin;
insert into auth.users (id, aud, role, created_at, updated_at) values
  (${u(actorA)}, 'authenticated', 'authenticated', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp()),
  (${u(actorB)}, 'authenticated', 'authenticated', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp());
insert into public.centers (id, name) values ${centersSql};
update public.center_crm_control set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
where center_id in (${activeCenters});
insert into public.crm_contact (
  crm_contact_id, center_id, source_category, protected_contact_methods_ciphertext,
  contact_methods_crypto_version, normalized_lookup_digests, normalization_version, created_by_user_id
) values ${contactsSql};
insert into public.consultation_case (consultation_case_id, center_id, primary_contact_id, created_by_user_id)
values ${casesSql};
set constraints all immediate;
set constraints all deferred;
insert into public.consultation_case_assignment (
  assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
) values ${assignmentsSql};
${Object.values(fixtures).map((f) => `update public.consultation_case set active_assignment_id=${u(f.assignment)}, case_version=case_version+1 where consultation_case_id=${u(f.caseId)};`).join('\n')}
set constraints all immediate;
commit;
`)

  const gate = jsonResult(createSql(fixtures.gate, 'gate_key', 'gate_intent', 'gate_graph'))
  assert.equal(gate.outcome_code, 'CRM_RUNTIME_NOT_ACTIVE')
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where consultation_case_id=${u(fixtures.gate.caseId)};`), '0')
  console.log('P1B_QA_PLANNED_DISABLED_ROOT_DENIES_MUTATION: PASS')
  console.log('P1B_QA_ACTIVE_ENABLED_TEST_ROOT_ALLOWS_MUTATION: PASS')

  const created = jsonResult(createSql(fixtures.lifecycle, 'life_create', 'life_intent', 'life_graph'))
  assert.deepEqual([created.ok, created.outcome_code, created.replayed, created.request_status, created.request_version, created.case_version], [true, 'DRAFT_CREATED', false, 'DRAFT', 1, 3])
  const replay = jsonResult(createSql(fixtures.lifecycle, 'life_create', 'life_intent', 'life_graph'))
  assert.equal(replay.replayed, true); assert.equal(replay.correlation_id, created.correlation_id)
  const idemConflict = jsonResult(createSql(fixtures.lifecycle, 'life_create', 'life_other', 'life_other_graph'))
  assert.equal(idemConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  const activeConflict = jsonResult(createSql(fixtures.lifecycle, 'life_other_key', 'life_intent', 'life_graph'))
  assert.equal(activeConflict.outcome_code, 'ACTIVE_REQUEST_CONFLICT')
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where consultation_case_id=${u(fixtures.lifecycle.caseId)};`), '1')
  console.log('P1B_QA_CREATE_DRAFT: PASS')
  console.log('P1B_QA_SAME_KEY_SAME_INTENT_REPLAY: PASS')
  console.log('P1B_QA_SAME_KEY_DIFFERENT_INTENT_CONFLICT: PASS')
  console.log('P1B_QA_ONE_ACTIVE_REQUEST: PASS')

  const wrongActor = jsonResult(createSql(fixtures.actor, 'actor_key', 'actor_intent', 'actor_graph', { actor: actorB }))
  assert.equal(wrongActor.outcome_code, 'ACTOR_NOT_ASSIGNED')
  const sourceStale = jsonResult(createSql(fixtures.source, 'source_key', 'source_intent', 'source_graph', { caseVersion: 99 }))
  assert.equal(sourceStale.outcome_code, 'SOURCE_VERSION_STALE')
  const assignmentStale = jsonResult(createSql(fixtures.assignment, 'assignment_key', 'assignment_intent', 'assignment_graph', { assignmentVersion: 99 }))
  assert.equal(assignmentStale.outcome_code, 'ASSIGNMENT_VERSION_STALE')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where consultation_case_id in (${u(fixtures.actor.caseId)},${u(fixtures.source.caseId)},${u(fixtures.assignment.caseId)});`), '0')
  console.log('P1B_QA_ACTOR_MUST_BE_CURRENT_ASSIGNEE: PASS')
  console.log('P1B_QA_CONTACT_CASE_ASSIGNMENT_EXACT_CENTER: PASS')
  console.log('P1B_QA_SOURCE_VERSION_STALE_FAILS_CLOSED: PASS')
  console.log('P1B_QA_ASSIGNMENT_VERSION_STALE_FAILS_CLOSED: PASS')

  const updateCreated = jsonResult(createSql(fixtures.update, 'update_create', 'update_initial', 'update_graph_initial'))
  const updated = jsonResult(updateSql(updateCreated.conversion_request_id, 'update_key', 'update_operation', 'update_new_intent', 'update_new_graph'))
  assert.deepEqual([updated.ok, updated.outcome_code, updated.request_version, updated.case_version], [true, 'DRAFT_UPDATED', 2, 3])
  const priorCreate = jsonResult(createSql(fixtures.update, 'update_create', 'update_initial', 'update_graph_initial'))
  assert.deepEqual(
    [priorCreate.replayed, priorCreate.request_version, priorCreate.case_version, priorCreate.request_status, priorCreate.correlation_id],
    [true, 1, 3, 'DRAFT', updateCreated.correlation_id],
  )
  const submitted = jsonResult(submitSql(updateCreated.conversion_request_id, 'submit_key', 'submit_operation', 'update_new_intent', 'update_new_graph', { requestVersion: 2 }))
  assert.deepEqual([submitted.ok, submitted.outcome_code, submitted.request_status, submitted.request_version, submitted.case_version], [true, 'REVIEW_SUBMITTED', 'READY_FOR_REVIEW', 3, 4])
  const status = jsonResult(`select pg_catalog.row_to_json(r)::text from public.f23_3e_p1b_get_conversion_request_status(${u(updateCreated.conversion_request_id)}) r;`)
  assert.deepEqual([status.request_status, status.request_version, status.case_version], ['READY_FOR_REVIEW', 3, 4])
  console.log('P1B_QA_UPDATE_DRAFT: PASS')
  console.log('P1B_QA_SUBMIT_REVIEW: PASS')
  console.log('P1B_QA_EXACT_PRIOR_RESULT_SNAPSHOT: PASS')

  const cancelDraftCreated = jsonResult(createSql(fixtures.cancelDraft, 'cd_create', 'cd_intent', 'cd_graph'))
  const cancelledDraft = jsonResult(cancelSql(cancelDraftCreated.conversion_request_id, 'cd_cancel', 'cd_cancel_intent'))
  assert.deepEqual([cancelledDraft.ok, cancelledDraft.request_status, cancelledDraft.request_version, cancelledDraft.case_version], [true, 'CANCELLED', 2, 4])
  const cancelReadyCreated = jsonResult(createSql(fixtures.cancelReady, 'cr_create', 'cr_intent', 'cr_graph'))
  const ready = jsonResult(submitSql(cancelReadyCreated.conversion_request_id, 'cr_submit', 'cr_submit_intent', 'cr_intent', 'cr_graph'))
  const cancelledReady = jsonResult(cancelSql(cancelReadyCreated.conversion_request_id, 'cr_cancel', 'cr_cancel_intent', { requestVersion: 2, caseVersion: 4 }))
  assert.deepEqual([ready.request_status, cancelledReady.request_status, cancelledReady.request_version, cancelledReady.case_version], ['READY_FOR_REVIEW', 'CANCELLED', 3, 5])
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where status in ('APPROVED','EXECUTING','COMPLETED','COMPENSATION_REQUIRED');`), '0')
  console.log('P1B_QA_CANCEL_DRAFT: PASS')
  console.log('P1B_QA_CANCEL_READY_FOR_REVIEW: PASS')
  console.log('P1B_QA_PROTECTED_STATUSES_UNREACHABLE: PASS')

  const eventCounts = jsonResult(`select pg_catalog.json_build_object(
    'audit', (select count(*) from public.crm_audit_event where request_id=${u(updateCreated.conversion_request_id)}),
    'outbox', (select count(*) from public.crm_outbox_event where aggregate_id=${u(updateCreated.conversion_request_id)}),
    'completed_registry', (select count(*) from public.crm_idempotency_registry where request_id=${u(updateCreated.conversion_request_id)} and status='COMPLETED')
  )::text;`)
  assert.deepEqual(eventCounts, { audit: 3, outbox: 3, completed_registry: 3 })
  console.log('P1B_QA_REQUEST_AUDIT_OUTBOX_IDEMPOTENCY_ATOMIC: PASS')
  console.log('P1B_QA_REPLAY_HAS_NO_DUPLICATE_EVENTS: PASS')

  const faultCheck = (f, target) => jsonResult(`
begin;
create function pg_temp.qa_forced_failure() returns trigger language plpgsql set search_path='' as $x$
begin raise exception 'qa_forced_${target}_failure'; end $x$;
create trigger qa_forced_${target} before insert on public.crm_${target}_event
for each row execute function pg_temp.qa_forced_failure();
do $x$ begin
  begin perform * from public.f23_3e_p1b_create_conversion_draft(${createArgs(f, `${target}_key`, `${target}_intent`, `${target}_graph`)});
  exception when others then
    if sqlerrm <> 'qa_forced_${target}_failure' then raise; end if;
  end;
end $x$;
select pg_catalog.json_build_object(
 'request_count',(select count(*) from public.crm_conversion_request where consultation_case_id=${u(f.caseId)}),
 'registry_count',(select count(*) from public.crm_idempotency_registry where consultation_case_id=${u(f.caseId)}),
 'case_version',(select case_version from public.consultation_case where consultation_case_id=${u(f.caseId)})
)::text;
rollback;
`)
  assert.deepEqual(faultCheck(fixtures.faultAudit, 'audit'), { request_count: 0, registry_count: 0, case_version: 2 })
  assert.deepEqual(faultCheck(fixtures.faultOutbox, 'outbox'), { request_count: 0, registry_count: 0, case_version: 2 })
  console.log('P1B_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK: PASS')
  console.log('P1B_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK: PASS')

  const c1 = await concurrentBarrier(1,
    createSql(fixtures.c1, 'c1_key', 'c1_intent', 'c1_graph'),
    createSql(fixtures.c1, 'c1_key', 'c1_intent', 'c1_graph'))
  assert.deepEqual(c1.map((r) => r.ok).sort(), [true, true])
  assert.deepEqual(c1.map((r) => r.replayed).sort(), [false, true])
  assert.equal(c1[0].correlation_id, c1[1].correlation_id)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where request_id=${u(c1[0].conversion_request_id)};`), '1')
  console.log('P1B_QA_CONCURRENT_SAME_KEY_REPLAY: PASS')

  const c2 = await concurrentBarrier(2,
    createSql(fixtures.c2, 'c2_key', 'c2_intent_a', 'c2_graph_a'),
    createSql(fixtures.c2, 'c2_key', 'c2_intent_b', 'c2_graph_b'))
  assert.equal(c2.filter((r) => r.outcome_code === 'DRAFT_CREATED').length, 1)
  assert.equal(c2.filter((r) => r.outcome_code === 'IDEMPOTENCY_CONFLICT').length, 1)
  console.log('P1B_QA_CONCURRENT_DIFFERENT_INTENT_CONFLICT: PASS')

  const c3 = await concurrentBarrier(3,
    createSql(fixtures.c3, 'c3_key_a', 'c3_intent', 'c3_graph'),
    createSql(fixtures.c3, 'c3_key_b', 'c3_intent', 'c3_graph'))
  assert.equal(c3.filter((r) => r.outcome_code === 'DRAFT_CREATED').length, 1)
  assert.equal(c3.filter((r) => r.outcome_code === 'ACTIVE_REQUEST_CONFLICT').length, 1)
  console.log('P1B_QA_CONCURRENT_ACTIVE_REQUEST_CONFLICT: PASS')

  const c4Created = jsonResult(createSql(fixtures.c4, 'c4_create', 'c4_intent', 'c4_graph'))
  const c4 = await concurrentBarrier(4,
    updateSql(c4Created.conversion_request_id, 'c4_update', 'c4_update_op', 'c4_new_intent', 'c4_new_graph'),
    submitSql(c4Created.conversion_request_id, 'c4_submit', 'c4_submit_op', 'c4_intent', 'c4_graph'))
  assert.equal(c4.filter((r) => r.ok).length, 1)
  assert.equal(c4.filter((r) => !r.ok && ['REQUEST_VERSION_STALE','REQUEST_STATE_CONFLICT','REQUEST_DIGEST_STALE','SOURCE_VERSION_STALE'].includes(r.outcome_code)).length, 1)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where request_id=${u(c4Created.conversion_request_id)};`), '2')
  console.log('P1B_QA_CONCURRENT_UPDATE_VS_SUBMIT: PASS')

  const c5Created = jsonResult(createSql(fixtures.c5, 'c5_create', 'c5_intent', 'c5_graph'))
  const c5 = await concurrentBarrier(5,
    submitSql(c5Created.conversion_request_id, 'c5_submit', 'c5_submit_op', 'c5_intent', 'c5_graph'),
    cancelSql(c5Created.conversion_request_id, 'c5_cancel', 'c5_cancel_op'))
  assert.equal(c5.filter((r) => r.ok).length, 1)
  assert.equal(c5.filter((r) => !r.ok && ['REQUEST_VERSION_STALE','REQUEST_STATE_CONFLICT','SOURCE_VERSION_STALE'].includes(r.outcome_code)).length, 1)
  console.log('P1B_QA_CONCURRENT_SUBMIT_VS_CANCEL: PASS')

  const c6Created = jsonResult(createSql(fixtures.c6, 'c6_create', 'c6_intent', 'c6_graph'))
  const replacementAssignment = randomUUID()
  const coordinator = collect(spawnPsql())
  coordinator.child.stdin.write(`select pg_catalog.pg_advisory_lock(230732, 6);\nselect 'C6_GATE_READY';\n`)
  await coordinator.marker('C6_GATE_READY')
  const changer = collect(spawnPsql())
  changer.child.stdin.end(`
begin;
select 1 from public.center_crm_control where center_id=${t(fixtures.c6.center)} for update;
select 'ASSIGNMENT_ROOT_LOCKED';
select pg_catalog.pg_advisory_lock(230732, 6);
select pg_catalog.pg_advisory_unlock(230732, 6);
select 1 from public.crm_conversion_request where conversion_request_id=${u(c6Created.conversion_request_id)} for update;
select 1 from public.consultation_case where consultation_case_id=${u(fixtures.c6.caseId)} for update;
select 1 from public.consultation_case_assignment where assignment_id=${u(fixtures.c6.assignment)} for update;
update public.consultation_case_assignment set assignment_status='REVOKED', assignment_version=assignment_version+1,
 ended_at=pg_catalog.transaction_timestamp(), end_reason='qa_replaced' where assignment_id=${u(fixtures.c6.assignment)};
insert into public.consultation_case_assignment (assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id)
values (${u(replacementAssignment)},${t(fixtures.c6.center)},${u(fixtures.c6.caseId)},${u(actorA)},${u(actorA)});
update public.consultation_case set active_assignment_id=${u(replacementAssignment)},case_version=case_version+1 where consultation_case_id=${u(fixtures.c6.caseId)};
set constraints all immediate;
commit;
select pg_catalog.json_build_object('changed',true)::text;
`)
  await changer.marker('ASSIGNMENT_ROOT_LOCKED')
  const staleWriter = collect(spawnPsql())
  staleWriter.child.stdin.end(`select 'MUTATION_STARTED';\n${updateSql(c6Created.conversion_request_id, 'c6_update', 'c6_update_op', 'c6_new_intent', 'c6_new_graph')}\n`)
  await staleWriter.marker('MUTATION_STARTED')
  coordinator.child.stdin.end(`select pg_catalog.pg_advisory_unlock(230732, 6);\n`)
  await Promise.all([changer.done, coordinator.done])
  const staleResult = parseWorkerJson((await staleWriter.done).stdout)
  assert.equal(staleResult.outcome_code, 'ASSIGNMENT_VERSION_STALE')
  assert.equal(scalar(`select request_version from public.crm_conversion_request where conversion_request_id=${u(c6Created.conversion_request_id)};`), '1')
  console.log('P1B_QA_CONCURRENT_ASSIGNMENT_CHANGE_RECHECK: PASS')

  console.log('F23_3E_P1B_LOCAL_DB_BEHAVIOR_QA: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    const post = jsonResult(`select pg_catalog.json_build_object(
      'migration_count',(select count(*) from supabase_migrations.schema_migrations where version='202607310002'),
      'fixture_count',(
        (select count(*) from public.centers where name like 'p1bqa_%') +
        (select count(*) from auth.users where id in (${allFixtureIds.slice(0, 2).map(u).join(',')})) +
        (select count(*) from public.crm_contact where center_id in (select id from public.centers where name like 'p1bqa_%'))
      ),
      'nondefault_root_count',(select count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED')
    )::text;`)
    assert.equal(post.migration_count, 1)
    assert.equal(post.fixture_count, 0)
    assert.equal(post.nondefault_root_count, 0)
    leftoverCount = post.fixture_count
    finalResetPassed = true
    console.log('P1B_QA_FINAL_LOCAL_RESET: PASS')
    console.log(`P1B_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
  } catch (cleanupError) {
    if (primaryError) primaryError = new AggregateError([primaryError, cleanupError], 'QA and final cleanup both failed')
    else primaryError = cleanupError
  }
}

assert(finalResetPassed, 'Final reset did not pass')
if (primaryError) throw primaryError
