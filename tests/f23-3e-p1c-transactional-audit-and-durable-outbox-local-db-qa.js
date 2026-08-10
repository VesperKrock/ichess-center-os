import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P1C_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
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
console.log('P1C_QA_LOCAL_SAFETY_GUARD: PASS')

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
const scalar = (sql) => psql(sql).stdout.trim()
const jsonValue = (sql) => {
  const output = psql(sql).stdout.trim().split(/\r?\n/).map((line) => line.trim())
  const line = [...output].reverse().find((value) => value.startsWith('{') || value.startsWith('['))
  assert(line, `Expected JSON result, received: ${output.join(' | ')}`)
  return JSON.parse(line)
}
const expectSqlFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, 'SQL was expected to fail')
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const fixtureNames = [
  'audit_a', 'audit_b', 'gate', 'claim', 'ack', 'retry', 'reclaim',
  'ceiling', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
]
const fixtures = Object.fromEntries(fixtureNames.map((name) => [name, { name, center: randomUUID() }]))

const claimSql = (center, worker, limit = 100, lease = 60) => `
select pg_catalog.json_build_object(
  'rows', coalesce(pg_catalog.json_agg(pg_catalog.row_to_json(r)), '[]'::json)
)::text
from public.f23_3e_p1c_claim_outbox_batch(${q(center)}, ${q(worker)}, ${limit}, ${lease}) r;
`
const ackSql = (eventId, claimId, worker, version) => `
select pg_catalog.row_to_json(r)::text
from public.f23_3e_p1c_ack_outbox_delivered(${u(eventId)}, ${u(claimId)}, ${q(worker)}, ${version}) r;
`
const failSql = (eventId, claimId, worker, version, code = 'qa_delivery_failed', retry = 3600) => `
select pg_catalog.row_to_json(r)::text
from public.f23_3e_p1c_fail_outbox_delivery(
  ${u(eventId)}, ${u(claimId)}, ${q(worker)}, ${version}, ${q(code)}, ${retry}
) r;
`
const eventRow = (center, options = {}) => ({
  id: options.id ?? randomUUID(),
  aggregate: options.aggregate ?? randomUUID(),
  center,
  eventVersion: options.eventVersion ?? 1,
  created: options.created ?? 'pg_catalog.statement_timestamp()',
  available: options.available ?? 'pg_catalog.statement_timestamp()',
})
const insertEvents = (rows) => psql(`
insert into public.crm_outbox_event (
  outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type,
  event_version, safe_payload, created_at, available_at
) values
${rows.map((row) => `(
  ${u(row.id)}, ${q(row.center)}, 'qa_resource', ${u(row.aggregate)}, 'qa.outbox_event',
  ${row.eventVersion}, '{}'::jsonb, ${row.created}, ${row.available}
)`).join(',\n')};
`)
const expireClaim = (eventId) => psql(`
set session_replication_role = replica;
update public.crm_outbox_event
set claim_expires_at = pg_catalog.statement_timestamp() - interval '1 second'
where outbox_event_id = ${u(eventId)};
set session_replication_role = origin;
`)
const makeRetryAvailable = (eventId) => psql(`
set session_replication_role = replica;
update public.crm_outbox_event
set available_at = pg_catalog.statement_timestamp()
where outbox_event_id = ${u(eventId)};
set session_replication_role = origin;
`)

const parseWorkerJson = (output) => {
  const line = output.split(/\r?\n/).map((value) => value.trim()).reverse()
    .find((value) => value.startsWith('{'))
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
    child.on('close', (code) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`psql worker ${code}: ${stderr || stdout}`)))
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
  coordinator.child.stdin.write(`select pg_catalog.pg_advisory_lock(230810, ${number});\nselect 'BARRIER_READY';\n`)
  await coordinator.marker('BARRIER_READY')
  const workerA = collect(spawnPsql())
  const workerB = collect(spawnPsql())
  workerA.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230810, ${number});\nselect pg_catalog.pg_advisory_unlock(230810, ${number});\n${sqlA}\n`)
  workerB.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230810, ${number});\nselect pg_catalog.pg_advisory_unlock(230810, ${number});\n${sqlB}\n`)
  await Promise.all([workerA.marker('WORKER_READY'), workerB.marker('WORKER_READY')])
  coordinator.child.stdin.end(`select pg_catalog.pg_advisory_unlock(230810, ${number});\n`)
  const [resultA, resultB] = await Promise.all([workerA.done, workerB.done])
  await coordinator.done
  return [parseWorkerJson(resultA.stdout), parseWorkerJson(resultB.stdout)]
}

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1

try {
  runReset()
  containerId = discoverContainer()

  assert.equal(scalar(`
select pg_catalog.count(*)
from supabase_migrations.schema_migrations
where version in ('202607310001', '202607310002', '202608100001');
`), '3', 'P1A/P1B/P1C migration history missing after clean reset')

  const rpcSignatures = [
    'public.f23_3e_p1c_list_crm_audit_events(text,timestamp with time zone,uuid,integer)',
    'public.f23_3e_p1c_claim_outbox_batch(text,text,integer,integer)',
    'public.f23_3e_p1c_ack_outbox_delivered(uuid,uuid,text,integer)',
    'public.f23_3e_p1c_fail_outbox_delivery(uuid,uuid,text,integer,text,integer)',
  ]
  psql(`
do $qa$
declare v_signature text;
begin
  foreach v_signature in array array[${rpcSignatures.map(q).join(',')}] loop
    if pg_catalog.to_regprocedure(v_signature) is null then
      raise exception 'missing_rpc_%', v_signature;
    end if;
    if not pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'service_grant_missing_%', v_signature;
    end if;
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('public', v_signature, 'EXECUTE') then
      raise exception 'browser_or_public_execute_%', v_signature;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'f23_3e_p1c_internal_%'
      and (
        pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
      )
  ) then raise exception 'helper_exposed'; end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'f23_3e_p1c_list_crm_audit_events', 'f23_3e_p1c_claim_outbox_batch',
        'f23_3e_p1c_ack_outbox_delivered', 'f23_3e_p1c_fail_outbox_delivery'
      )
      and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))
  ) then raise exception 'rpc_security_drift'; end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated'), ('public')) roles(role_name)
    cross join (values ('public.crm_audit_event'), ('public.crm_outbox_event')) tables(table_name)
    where pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'SELECT')
       or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'INSERT')
       or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'UPDATE')
       or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'DELETE')
  ) then raise exception 'browser_table_privilege'; end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    where c.oid in ('public.crm_audit_event'::regclass, 'public.crm_outbox_event'::regclass)
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then raise exception 'rls_not_forced'; end if;
end $qa$;
`)
  console.log('P1C_QA_SERVICE_ROLE_RPC_GRANTS_EXACT: PASS')
  console.log('P1C_QA_HELPER_FUNCTIONS_NOT_EXPOSED: PASS')
  console.log('P1C_QA_TABLE_PRIVILEGES_FAIL_CLOSED: PASS')

  const centersSql = Object.values(fixtures)
    .map((fixture) => `(${q(fixture.center)}, ${q(`p1cqa_${fixture.name}`)})`).join(',\n')
  const activeCenters = Object.values(fixtures).filter((fixture) => fixture.name !== 'gate')
    .map((fixture) => q(fixture.center)).join(',')
  psql(`
insert into public.centers (id, name) values ${centersSql};
update public.center_crm_control
set crm_state = 'ACTIVE', feature_flag_state = 'ENABLED', control_version = control_version + 1
where center_id in (${activeCenters});
`)

  const auditIds = [randomUUID(), randomUUID(), randomUUID()].sort()
  const auditB = randomUUID()
  psql(`
insert into public.crm_audit_event (
  audit_event_id, center_id, event_type, resource_kind, resource_id,
  previous_version, new_version, safe_reason_code, correlation_id, created_at
) values
${auditIds.map((id, index) => `(
  ${u(id)}, ${q(fixtures.audit_a.center)}, 'qa.audit_event', 'qa_resource', ${u(randomUUID())},
  ${index === 0 ? 'null, 1' : `${index}, ${index + 1}`}, 'qa_safe', ${u(randomUUID())},
  pg_catalog.statement_timestamp() - interval '1 day'
)`).join(',\n')},
(
  ${u(auditB)}, ${q(fixtures.audit_b.center)}, 'qa.audit_event', 'qa_resource', ${u(randomUUID())},
  null, 1, 'qa_safe', ${u(randomUUID())}, pg_catalog.statement_timestamp() - interval '1 day'
);
`)

  const auditFirst = jsonValue(`
select coalesce(pg_catalog.json_agg(pg_catalog.row_to_json(r)), '[]'::json)::text
from public.f23_3e_p1c_list_crm_audit_events(${q(fixtures.audit_a.center)}, null, null, 2) r;
`)
  assert.equal(auditFirst.length, 2)
  assert.deepEqual(auditFirst.map((row) => row.audit_event_id), auditIds.slice(0, 2))
  const safeAuditKeys = [
    'actor_user_id', 'assignment_id', 'audit_event_id', 'center_id', 'correlation_id',
    'created_at', 'event_type', 'new_version', 'previous_version', 'request_id',
    'resource_id', 'resource_kind', 'safe_reason_code',
  ].sort()
  assert.deepEqual(Object.keys(auditFirst[0]).sort(), safeAuditKeys)
  const auditNext = jsonValue(`
select coalesce(pg_catalog.json_agg(pg_catalog.row_to_json(r)), '[]'::json)::text
from public.f23_3e_p1c_list_crm_audit_events(
  ${q(fixtures.audit_a.center)}, ${q(auditFirst[1].created_at)}::timestamptz,
  ${u(auditFirst[1].audit_event_id)}, 100
) r;
`)
  assert.deepEqual(auditNext.map((row) => row.audit_event_id), auditIds.slice(2))
  assert.equal(new Set([...auditFirst, ...auditNext].map((row) => row.audit_event_id)).size, 3)
  assert(![...auditFirst, ...auditNext].some((row) => row.center_id === fixtures.audit_b.center))
  expectSqlFailure(`select * from public.f23_3e_p1c_list_crm_audit_events(${q(fixtures.audit_a.center)}, pg_catalog.statement_timestamp(), null, 10);`, /INVALID_CURSOR/)
  expectSqlFailure(`select * from public.f23_3e_p1c_list_crm_audit_events(${q(fixtures.audit_a.center)}, null, null, 0);`, /INVALID_INPUT/)
  expectSqlFailure(`select * from public.f23_3e_p1c_list_crm_audit_events(${q(fixtures.audit_a.center)}, null, null, 101);`, /INVALID_INPUT/)
  const browserDenied = psql(`set role authenticated; select * from public.f23_3e_p1c_list_crm_audit_events(${q(fixtures.audit_a.center)}, null, null, 1);`, { expectFailure: true })
  assert.notEqual(browserDenied.status, 0)
  assert.match(`${browserDenied.stdout}\n${browserDenied.stderr}`, /permission denied for function/i)
  console.log('P1C_QA_AUDIT_EXACT_CENTER: PASS')
  console.log('P1C_QA_AUDIT_SAFE_PROJECTION: PASS')
  console.log('P1C_QA_AUDIT_KEYSET_FIRST_PAGE: PASS')
  console.log('P1C_QA_AUDIT_KEYSET_NEXT_PAGE_NO_DUPLICATE: PASS')
  console.log('P1C_QA_AUDIT_CURSOR_TIE_BREAK_UUID: PASS')
  console.log('P1C_QA_AUDIT_INVALID_CURSOR_REJECTED: PASS')
  console.log('P1C_QA_AUDIT_LIMIT_BOUND: PASS')
  console.log('P1C_QA_AUDIT_BROWSER_EXECUTE_DENIED: PASS')

  const gateEvent = eventRow(fixtures.gate.center)
  insertEvents([gateEvent])
  expectSqlFailure(claimSql(fixtures.gate.center, 'gate_worker', 1, 60), /CRM_RUNTIME_NOT_ACTIVE/)
  console.log('P1C_QA_INACTIVE_ROOT_DENIES_CLAIM: PASS')

  const claimRows = [
    eventRow(fixtures.claim.center, { eventVersion: 7, created: `pg_catalog.statement_timestamp() - interval '5 minutes'`, available: `pg_catalog.statement_timestamp() - interval '4 minutes'` }),
    eventRow(fixtures.claim.center, { eventVersion: 8, created: `pg_catalog.statement_timestamp() - interval '4 minutes'`, available: `pg_catalog.statement_timestamp() - interval '3 minutes'` }),
    eventRow(fixtures.claim.center, { eventVersion: 9, created: `pg_catalog.statement_timestamp() - interval '3 minutes'`, available: `pg_catalog.statement_timestamp() - interval '2 minutes'` }),
    eventRow(fixtures.claim.center, { eventVersion: 10, created: 'pg_catalog.statement_timestamp()', available: `pg_catalog.statement_timestamp() + interval '1 hour'` }),
  ]
  insertEvents(claimRows)
  const claimedFirst = jsonValue(claimSql(fixtures.claim.center, 'claim_worker_a', 2, 60)).rows
  assert.deepEqual(claimedFirst.map((row) => row.outbox_event_id), claimRows.slice(0, 2).map((row) => row.id))
  assert(claimedFirst.every((row) => row.attempt_count === 1 && row.delivery_version === 2))
  assert.deepEqual(claimedFirst.map((row) => row.event_version), [7, 8])
  const claimedSecond = jsonValue(claimSql(fixtures.claim.center, 'claim_worker_b', 100, 60)).rows
  assert.deepEqual(claimedSecond.map((row) => row.outbox_event_id), [claimRows[2].id])
  assert(![...claimedFirst, ...claimedSecond].some((row) => row.outbox_event_id === claimRows[3].id))
  expectSqlFailure(`
update public.crm_outbox_event
set event_version = event_version + 1, delivery_version = delivery_version + 1
where outbox_event_id = ${u(claimRows[3].id)};
`, /identity_version_and_payload_are_immutable/)
  console.log('P1C_QA_OUTBOX_CLAIM_BATCH: PASS')
  console.log('P1C_QA_OUTBOX_CLAIM_LIMIT: PASS')
  console.log('P1C_QA_OUTBOX_DETERMINISTIC_ORDER: PASS')
  console.log('P1C_QA_OUTBOX_FUTURE_AVAILABLE_NOT_CLAIMED: PASS')
  console.log('P1C_QA_OUTBOX_UNEXPIRED_CLAIM_NOT_RECLAIMED: PASS')
  console.log('P1C_QA_OUTBOX_EVENT_VERSION_IMMUTABLE: PASS')
  console.log('P1C_QA_OUTBOX_DELIVERY_VERSION_PLUS_ONE: PASS')

  const ackEvents = [
    eventRow(fixtures.ack.center, { eventVersion: 21 }),
    eventRow(fixtures.ack.center, { eventVersion: 22, created: `pg_catalog.statement_timestamp() - interval '1 hour'`, available: `pg_catalog.statement_timestamp() - interval '59 minutes'` }),
  ]
  insertEvents(ackEvents)
  const ackClaims = jsonValue(claimSql(fixtures.ack.center, 'ack_worker', 2, 60)).rows
  const activeAck = ackClaims.find((row) => row.outbox_event_id === ackEvents[0].id)
  const expiredAck = ackClaims.find((row) => row.outbox_event_id === ackEvents[1].id)
  assert(activeAck && expiredAck)
  const wrongClaim = jsonValue(ackSql(activeAck.outbox_event_id, randomUUID(), 'ack_worker', activeAck.delivery_version))
  assert.deepEqual([wrongClaim.ok, wrongClaim.outcome_code], [false, 'CLAIM_MISMATCH'])
  const wrongWorker = jsonValue(ackSql(activeAck.outbox_event_id, activeAck.claim_id, 'wrong_worker', activeAck.delivery_version))
  assert.deepEqual([wrongWorker.ok, wrongWorker.outcome_code], [false, 'CLAIM_MISMATCH'])
  const staleVersion = jsonValue(ackSql(activeAck.outbox_event_id, activeAck.claim_id, 'ack_worker', activeAck.delivery_version + 10))
  assert.deepEqual([staleVersion.ok, staleVersion.outcome_code], [false, 'DELIVERY_VERSION_STALE'])
  const delivered = jsonValue(ackSql(activeAck.outbox_event_id, activeAck.claim_id, 'ack_worker', activeAck.delivery_version))
  assert.deepEqual([delivered.ok, delivered.outcome_code, delivered.delivery_status], [true, 'DELIVERED', 'DELIVERED'])
  assert.equal(delivered.attempt_count, 1)
  assert.equal(delivered.delivery_version, activeAck.delivery_version + 1)
  const doubleAck = jsonValue(ackSql(activeAck.outbox_event_id, activeAck.claim_id, 'ack_worker', activeAck.delivery_version))
  assert.deepEqual([doubleAck.ok, doubleAck.outcome_code], [false, 'DELIVERY_VERSION_STALE'])
  assert.equal(scalar(`select event_version from public.crm_outbox_event where outbox_event_id=${u(activeAck.outbox_event_id)};`), '21')
  expireClaim(expiredAck.outbox_event_id)
  const expiredOutcome = jsonValue(ackSql(expiredAck.outbox_event_id, expiredAck.claim_id, 'ack_worker', expiredAck.delivery_version))
  assert.deepEqual([expiredOutcome.ok, expiredOutcome.outcome_code], [false, 'CLAIM_EXPIRED'])
  console.log('P1C_QA_ACK_DELIVERED: PASS')
  console.log('P1C_QA_ACK_WRONG_CLAIM_DENIED: PASS')
  console.log('P1C_QA_ACK_WRONG_WORKER_DENIED: PASS')
  console.log('P1C_QA_ACK_STALE_DELIVERY_VERSION_DENIED: PASS')
  console.log('P1C_QA_ACK_EXPIRED_LEASE_DENIED: PASS')
  console.log('P1C_QA_DOUBLE_ACK_DENIED: PASS')

  const retryEvent = eventRow(fixtures.retry.center, {
    eventVersion: 31,
    created: `pg_catalog.statement_timestamp() - interval '1 hour'`,
    available: `pg_catalog.statement_timestamp() - interval '59 minutes'`,
  })
  insertEvents([retryEvent])
  let retryClaim = jsonValue(claimSql(fixtures.retry.center, 'retry_worker', 1, 60)).rows[0]
  const unsafeFailure = jsonValue(failSql(retryClaim.outbox_event_id, retryClaim.claim_id, 'retry_worker', retryClaim.delivery_version, 'Unsafe Failure', 60))
  assert.deepEqual([unsafeFailure.ok, unsafeFailure.outcome_code], [false, 'INVALID_INPUT'])
  let retryOutcome = jsonValue(failSql(retryClaim.outbox_event_id, retryClaim.claim_id, 'retry_worker', retryClaim.delivery_version))
  assert.deepEqual([retryOutcome.ok, retryOutcome.outcome_code, retryOutcome.delivery_status], [true, 'RETRY_SCHEDULED', 'RETRY'])
  assert.equal(retryOutcome.attempt_count, 1)
  const retryState = jsonValue(`
select pg_catalog.row_to_json(o)::text from (
  select delivery_status, claim_id, claimed_by, claim_expires_at, last_failure_code,
    available_at > pg_catalog.statement_timestamp() as future_retry
  from public.crm_outbox_event where outbox_event_id=${u(retryEvent.id)}
) o;
`)
  assert.deepEqual(retryState, {
    delivery_status: 'RETRY', claim_id: null, claimed_by: null,
    claim_expires_at: null, last_failure_code: 'qa_delivery_failed', future_retry: true,
  })
  assert.equal(jsonValue(claimSql(fixtures.retry.center, 'early_worker', 1, 60)).rows.length, 0)
  for (let attempt = 2; attempt <= 5; attempt += 1) {
    makeRetryAvailable(retryEvent.id)
    retryClaim = jsonValue(claimSql(fixtures.retry.center, 'retry_worker', 1, 60)).rows[0]
    assert.equal(retryClaim.attempt_count, attempt)
    retryOutcome = jsonValue(failSql(retryClaim.outbox_event_id, retryClaim.claim_id, 'retry_worker', retryClaim.delivery_version, `qa_failure_${attempt}`, 3600))
    if (attempt < 5) assert.deepEqual([retryOutcome.outcome_code, retryOutcome.delivery_status], ['RETRY_SCHEDULED', 'RETRY'])
    else assert.deepEqual([retryOutcome.outcome_code, retryOutcome.delivery_status], ['DEAD_LETTERED', 'DEAD_LETTER'])
  }
  const deadState = jsonValue(`
select pg_catalog.row_to_json(o)::text from (
  select delivery_status, attempt_count, dead_lettered_at is not null as has_dead_letter_time,
    last_failure_code, event_version
  from public.crm_outbox_event where outbox_event_id=${u(retryEvent.id)}
) o;
`)
  assert.deepEqual(deadState, {
    delivery_status: 'DEAD_LETTER', attempt_count: 5, has_dead_letter_time: true,
    last_failure_code: 'qa_failure_5', event_version: 31,
  })
  assert.equal(jsonValue(claimSql(fixtures.retry.center, 'attempt_six_worker', 1, 60)).rows.length, 0)
  console.log('P1C_QA_FAILURE_SCHEDULES_RETRY: PASS')
  console.log('P1C_QA_RETRY_CLEARS_ACTIVE_CLAIM: PASS')
  console.log('P1C_QA_RETRY_NOT_AVAILABLE_EARLY: PASS')
  console.log('P1C_QA_SAFE_FAILURE_CODE_ONLY: PASS')
  console.log('P1C_QA_DEAD_LETTER_AFTER_FIFTH_FAILURE: PASS')
  console.log('P1C_QA_DEAD_LETTER_NOT_RECLAIMED: PASS')
  console.log('P1C_QA_ATTEMPT_SIX_IMPOSSIBLE: PASS')

  const reclaimEvent = eventRow(fixtures.reclaim.center, {
    eventVersion: 41,
    created: `pg_catalog.statement_timestamp() - interval '1 hour'`,
    available: `pg_catalog.statement_timestamp() - interval '59 minutes'`,
  })
  insertEvents([reclaimEvent])
  const claimA = jsonValue(claimSql(fixtures.reclaim.center, 'reclaim_worker_a', 1, 60)).rows[0]
  expireClaim(reclaimEvent.id)
  const claimB = jsonValue(claimSql(fixtures.reclaim.center, 'reclaim_worker_b', 1, 60)).rows[0]
  assert.notEqual(claimB.claim_id, claimA.claim_id)
  assert.deepEqual([claimB.claimed_by, claimB.attempt_count, claimB.delivery_version], ['reclaim_worker_b', 2, claimA.delivery_version + 1])
  const staleAck = jsonValue(ackSql(claimA.outbox_event_id, claimA.claim_id, 'reclaim_worker_a', claimA.delivery_version))
  const staleFail = jsonValue(failSql(claimA.outbox_event_id, claimA.claim_id, 'reclaim_worker_a', claimA.delivery_version))
  assert.equal(staleAck.outcome_code, 'DELIVERY_VERSION_STALE')
  assert.equal(staleFail.outcome_code, 'DELIVERY_VERSION_STALE')
  assert.equal(scalar(`select claimed_by from public.crm_outbox_event where outbox_event_id=${u(reclaimEvent.id)};`), 'reclaim_worker_b')
  console.log('P1C_QA_EXPIRED_LEASE_RECLAIM: PASS')
  console.log('P1C_QA_OLD_CLAIM_REJECTED_AFTER_RECLAIM: PASS')

  const ceilingEvent = eventRow(fixtures.ceiling.center, {
    created: `pg_catalog.statement_timestamp() - interval '1 hour'`,
    available: `pg_catalog.statement_timestamp() - interval '59 minutes'`,
  })
  insertEvents([ceilingEvent])
  let ceilingClaim
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (attempt > 1) expireClaim(ceilingEvent.id)
    ceilingClaim = jsonValue(claimSql(fixtures.ceiling.center, `ceiling_worker_${attempt}`, 1, 60)).rows[0]
    assert.equal(ceilingClaim.attempt_count, attempt)
  }
  expireClaim(ceilingEvent.id)
  assert.equal(jsonValue(claimSql(fixtures.ceiling.center, 'ceiling_worker_6', 1, 60)).rows.length, 0)
  const ceilingState = jsonValue(`
select pg_catalog.row_to_json(o)::text from (
  select delivery_status, attempt_count, last_failure_code, dead_lettered_at is not null as terminal_time
  from public.crm_outbox_event where outbox_event_id=${u(ceilingEvent.id)}
) o;
`)
  assert.deepEqual(ceilingState, {
    delivery_status: 'DEAD_LETTER', attempt_count: 5,
    last_failure_code: 'lease_expired_after_max_attempts', terminal_time: true,
  })
  console.log('P1C_QA_EXPIRED_FIFTH_LEASE_DEAD_LETTERS: PASS')

  const c1Events = Array.from({ length: 6 }, (_, index) => eventRow(fixtures.c1.center, {
    created: `pg_catalog.statement_timestamp() - interval '${20 - index} minutes'`,
    available: `pg_catalog.statement_timestamp() - interval '${19 - index} minutes'`,
  }))
  insertEvents(c1Events)
  const c1 = await concurrentBarrier(1,
    claimSql(fixtures.c1.center, 'c1_worker_a', 3, 60),
    claimSql(fixtures.c1.center, 'c1_worker_b', 3, 60))
  const c1A = c1[0].rows.map((row) => row.outbox_event_id)
  const c1B = c1[1].rows.map((row) => row.outbox_event_id)
  assert.equal(c1A.length, 3); assert.equal(c1B.length, 3)
  assert.equal(c1A.filter((id) => c1B.includes(id)).length, 0)
  assert.equal(new Set([...c1A, ...c1B]).size, 6)
  assert.equal(scalar(`select count(distinct claim_id) from public.crm_outbox_event where center_id=${q(fixtures.c1.center)} and delivery_status='CLAIMED';`), '6')
  console.log('P1C_QA_CONCURRENT_WORKERS_DISJOINT_CLAIMS: PASS')

  const c2Event = eventRow(fixtures.c2.center)
  insertEvents([c2Event])
  const c2 = await concurrentBarrier(2,
    claimSql(fixtures.c2.center, 'c2_worker_a', 1, 60),
    claimSql(fixtures.c2.center, 'c2_worker_b', 1, 60))
  assert.deepEqual(c2.map((result) => result.rows.length).sort(), [0, 1])
  assert.equal(scalar(`select attempt_count from public.crm_outbox_event where outbox_event_id=${u(c2Event.id)};`), '1')
  console.log('P1C_QA_CONCURRENT_SINGLE_EVENT_ONE_WINNER: PASS')

  const c3Event = eventRow(fixtures.c3.center, {
    created: `pg_catalog.statement_timestamp() - interval '1 hour'`,
    available: `pg_catalog.statement_timestamp() - interval '59 minutes'`,
  })
  insertEvents([c3Event])
  const c3Original = jsonValue(claimSql(fixtures.c3.center, 'c3_original', 1, 60)).rows[0]
  expireClaim(c3Event.id)
  const c3 = await concurrentBarrier(3,
    claimSql(fixtures.c3.center, 'c3_worker_a', 1, 60),
    claimSql(fixtures.c3.center, 'c3_worker_b', 1, 60))
  assert.deepEqual(c3.map((result) => result.rows.length).sort(), [0, 1])
  const c3Winner = c3.find((result) => result.rows.length === 1).rows[0]
  assert.deepEqual([c3Winner.attempt_count, c3Winner.delivery_version], [2, c3Original.delivery_version + 1])
  console.log('P1C_QA_CONCURRENT_RECLAIM_ONE_WINNER: PASS')

  const c4Event = eventRow(fixtures.c4.center)
  insertEvents([c4Event])
  const c4Claim = jsonValue(claimSql(fixtures.c4.center, 'c4_worker', 1, 60)).rows[0]
  const c4 = await concurrentBarrier(4,
    ackSql(c4Claim.outbox_event_id, c4Claim.claim_id, 'c4_worker', c4Claim.delivery_version),
    failSql(c4Claim.outbox_event_id, c4Claim.claim_id, 'c4_worker', c4Claim.delivery_version, 'c4_failed', 3600))
  assert.equal(c4.filter((result) => result.ok).length, 1)
  assert.equal(c4.filter((result) => !result.ok && ['DELIVERY_VERSION_STALE', 'OUTBOX_STATE_CONFLICT'].includes(result.outcome_code)).length, 1)
  assert(['DELIVERED', 'RETRY', 'DEAD_LETTER'].includes(scalar(`select delivery_status from public.crm_outbox_event where outbox_event_id=${u(c4Event.id)};`)))
  console.log('P1C_QA_CONCURRENT_ACK_VS_FAIL_ONE_WINNER: PASS')

  const c5Event = eventRow(fixtures.c5.center, {
    created: `pg_catalog.statement_timestamp() - interval '1 hour'`,
    available: `pg_catalog.statement_timestamp() - interval '59 minutes'`,
  })
  insertEvents([c5Event])
  const c5Old = jsonValue(claimSql(fixtures.c5.center, 'c5_worker_a', 1, 60)).rows[0]
  expireClaim(c5Event.id)
  const c5Coordinator = collect(spawnPsql())
  c5Coordinator.child.stdin.write("select pg_catalog.pg_advisory_lock(230811, 5);\nselect 'C5_BARRIER_READY';\n")
  await c5Coordinator.marker('C5_BARRIER_READY')
  const c5Reclaimer = collect(spawnPsql())
  c5Reclaimer.child.stdin.end(`
begin;
${claimSql(fixtures.c5.center, 'c5_worker_b', 1, 60)}
select 'C5_RECLAIM_LOCKED';
select pg_catalog.pg_advisory_lock(230811, 5);
select pg_catalog.pg_advisory_unlock(230811, 5);
commit;
`)
  await c5Reclaimer.marker('C5_RECLAIM_LOCKED')
  const c5StaleAck = collect(spawnPsql())
  c5StaleAck.child.stdin.end(`
select 'C5_STALE_ACK_STARTED';
${ackSql(c5Old.outbox_event_id, c5Old.claim_id, 'c5_worker_a', c5Old.delivery_version)}
`)
  await c5StaleAck.marker('C5_STALE_ACK_STARTED')
  c5Coordinator.child.stdin.end('select pg_catalog.pg_advisory_unlock(230811, 5);\n')
  const [c5ReclaimOutput, c5AckOutput] = await Promise.all([c5Reclaimer.done, c5StaleAck.done])
  await c5Coordinator.done
  const c5ReclaimResult = parseWorkerJson(c5ReclaimOutput.stdout)
  const c5AckResult = parseWorkerJson(c5AckOutput.stdout)
  assert.equal(c5ReclaimResult.rows.length, 1)
  assert.deepEqual([c5AckResult.ok, ['DELIVERY_VERSION_STALE', 'OUTBOX_STATE_CONFLICT'].includes(c5AckResult.outcome_code)], [false, true])
  assert.equal(scalar(`select claimed_by from public.crm_outbox_event where outbox_event_id=${u(c5Event.id)};`), 'c5_worker_b')
  console.log('P1C_QA_CONCURRENT_STALE_ACK_VS_RECLAIM_SAFE: PASS')

  const c6Events = Array.from({ length: 3 }, () => eventRow(fixtures.c6.center))
  insertEvents(c6Events)
  const faultCount = scalar(`
begin;
create function pg_temp.p1c_qa_forced_claim_failure()
returns trigger language plpgsql set search_path = '' as $fault$
begin
  if new.outbox_event_id = ${u(c6Events[1].id)} then
    raise exception 'qa_forced_claim_failure';
  end if;
  return new;
end;
$fault$;
create trigger p1c_qa_forced_claim_failure
before update on public.crm_outbox_event
for each row execute function pg_temp.p1c_qa_forced_claim_failure();
do $qa$
begin
  begin
    perform * from public.f23_3e_p1c_claim_outbox_batch(${q(fixtures.c6.center)}, 'c6_worker', 3, 60);
    raise exception 'qa_expected_fault_not_raised';
  exception when others then
    if sqlerrm <> 'qa_forced_claim_failure' then raise; end if;
  end;
end;
$qa$;
select count(*) from public.crm_outbox_event
where center_id=${q(fixtures.c6.center)} and delivery_status='CLAIMED';
rollback;
`)
  assert.equal(faultCount, '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(fixtures.c6.center)} and delivery_status='CLAIMED';`), '0')
  console.log('P1C_QA_CLAIM_BATCH_FAULT_ROLLS_BACK_ALL: PASS')

  console.log('F23_3E_P1C_LOCAL_DB_BEHAVIOR_QA: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    const post = jsonValue(`
select pg_catalog.json_build_object(
  'migration_count', (
    select count(*) from supabase_migrations.schema_migrations where version='202608100001'
  ),
  'fixture_count', (
    (select count(*) from public.centers where name like 'p1cqa_%')
    + (select count(*) from public.crm_audit_event where center_id in (select id from public.centers where name like 'p1cqa_%'))
    + (select count(*) from public.crm_outbox_event where center_id in (select id from public.centers where name like 'p1cqa_%'))
  ),
  'nondefault_root_count', (
    select count(*) from public.center_crm_control
    where crm_state <> 'PLANNED' or feature_flag_state <> 'DISABLED'
  )
)::text;
`)
    assert.equal(post.migration_count, 1)
    assert.equal(post.fixture_count, 0)
    assert.equal(post.nondefault_root_count, 0)
    leftoverCount = post.fixture_count
    nondefaultRootCount = post.nondefault_root_count
    finalResetPassed = true
    console.log('P1C_QA_FINAL_LOCAL_RESET: PASS')
    console.log(`P1C_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
    console.log(`P1C_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
  } catch (cleanupError) {
    if (primaryError) primaryError = new AggregateError([primaryError, cleanupError], 'QA and final cleanup both failed')
    else primaryError = cleanupError
  }
}

assert(finalResetPassed, 'Final reset did not pass')
if (primaryError) throw primaryError
