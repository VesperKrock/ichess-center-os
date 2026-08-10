import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P1F_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')
const migrationsDirectory = resolve('supabase/migrations')

const migrationCheckpoints = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
  ['202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql', '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6'],
  ['202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql', 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F'],
  ['202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql', '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA'],
  ['202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql', 'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722'],
  ['202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql', '33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19'],
])

const inheritedRunners = [
  {
    phase: 'P1A',
    file: 'tests/f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js',
    flag: null,
    successMarker: 'P1F_QA_P1A_LOCAL_RUNNER: PASS',
    markers: [
      'F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS',
      'P1A_QA_LEFTOVER_FIXTURE_COUNT: 0',
    ],
  },
  {
    phase: 'P1B',
    file: 'tests/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-local-db-qa.js',
    flag: 'ICHESS_P1B_LOCAL_QA_ALLOW_RESET',
    successMarker: 'P1F_QA_P1B_LOCAL_RUNNER: PASS',
    markers: [
      'P1B_QA_CONCURRENT_SAME_KEY_REPLAY: PASS',
      'P1B_QA_CONCURRENT_DIFFERENT_INTENT_CONFLICT: PASS',
      'P1B_QA_CONCURRENT_ACTIVE_REQUEST_CONFLICT: PASS',
      'P1B_QA_CONCURRENT_UPDATE_VS_SUBMIT: PASS',
      'P1B_QA_CONCURRENT_SUBMIT_VS_CANCEL: PASS',
      'P1B_QA_CONCURRENT_ASSIGNMENT_CHANGE_RECHECK: PASS',
      'P1B_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK: PASS',
      'P1B_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK: PASS',
      'P1B_QA_FINAL_LOCAL_RESET: PASS',
    ],
  },
  {
    phase: 'P1C',
    file: 'tests/f23-3e-p1c-transactional-audit-and-durable-outbox-local-db-qa.js',
    flag: 'ICHESS_P1C_LOCAL_QA_ALLOW_RESET',
    successMarker: 'P1F_QA_P1C_LOCAL_RUNNER: PASS',
    markers: [
      'P1C_QA_CONCURRENT_WORKERS_DISJOINT_CLAIMS: PASS',
      'P1C_QA_CONCURRENT_SINGLE_EVENT_ONE_WINNER: PASS',
      'P1C_QA_CONCURRENT_RECLAIM_ONE_WINNER: PASS',
      'P1C_QA_CONCURRENT_ACK_VS_FAIL_ONE_WINNER: PASS',
      'P1C_QA_CONCURRENT_STALE_ACK_VS_RECLAIM_SAFE: PASS',
      'P1C_QA_CLAIM_BATCH_FAULT_ROLLS_BACK_ALL: PASS',
      'P1C_QA_EXPIRED_LEASE_RECLAIM: PASS',
      'P1C_QA_OLD_CLAIM_REJECTED_AFTER_RECLAIM: PASS',
      'P1C_QA_DEAD_LETTER_AFTER_FIFTH_FAILURE: PASS',
      'P1C_QA_FINAL_LOCAL_RESET: PASS',
    ],
  },
  {
    phase: 'P1D',
    file: 'tests/f23-3e-p1d-typed-crm-service-operations-local-db-qa.js',
    flag: 'ICHESS_P1D_LOCAL_QA_ALLOW_RESET',
    successMarker: 'P1F_QA_P1D_LOCAL_RUNNER: PASS',
    markers: [
      'P1D_QA_CONCURRENT_CONTACT_UPDATE_ONE_WINNER: PASS',
      'P1D_QA_CONCURRENT_CASE_STATUS_ONE_WINNER: PASS',
      'P1D_QA_CONCURRENT_INITIAL_ASSIGNMENT_ONE_WINNER: PASS',
      'P1D_QA_CONCURRENT_REASSIGN_VS_REVOKE_SAFE: PASS',
      'P1D_QA_CONCURRENT_DOUBLE_REASSIGN_ONE_WINNER: PASS',
      'P1D_QA_CONCURRENT_DUPLICATE_CARE_LOG_ID_SAFE: PASS',
      'P1D_QA_ASSIGNMENT_ELIGIBILITY_REVOKE_RACE_SAFE: PASS',
      'P1D_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK_BUSINESS: PASS',
      'P1D_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK_BUSINESS: PASS',
      'P1D_QA_REASSIGN_SECOND_EVENT_FAILURE_ROLLS_BACK_ALL: PASS',
      'P1D_QA_FINAL_LOCAL_RESET: PASS',
    ],
  },
  {
    phase: 'P1E',
    file: 'tests/f23-3e-p1e-rls-read-mask-and-import-readiness-local-db-qa.js',
    flag: 'ICHESS_P1E_LOCAL_QA_ALLOW_RESET',
    successMarker: 'P1F_QA_P1E_LOCAL_RUNNER: PASS',
    markers: [
      'P1E_QA_IMPORT_PREVIEW_DETERMINISTIC: PASS',
      'P1E_QA_LEGACY_CONVERTED_REVIEW_ONLY: PASS',
      'P1E_QA_DUPLICATE_LEGACY_ID_REVIEW: PASS',
      'P1E_QA_IMPORT_PREVIEW_OUTPUT_PII_FREE: PASS',
      'P1E_QA_MALFORMED_EXPORT_FAILS_CLOSED: PASS',
      'P1E_QA_CENTER_NAMESPACE_MISMATCH_FAILS_CLOSED: PASS',
      'P1E_QA_PARTIAL_EXPORT_FAILS_CLOSED: PASS',
      'P1E_QA_LOCAL_EDIT_AFTER_PREVIEW_REQUIRES_REVIEW: PASS',
      'P1E_QA_PRIOR_MANIFEST_TAMPER_FAILS_CLOSED: PASS',
      'P1E_QA_PROTOTYPE_SENSITIVE_KEY_CHANGES_DIGEST: PASS',
      'P1E_QA_PROTOTYPE_SENSITIVE_DIVERGENCE_DETECTED: PASS',
      'P1E_QA_FINAL_LOCAL_RESET: PASS',
    ],
  },
]

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
for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'API_URL']) {
  assertLoopback(process.env[name], name)
}

const migrationFiles = readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort()
for (const file of migrationCheckpoints.keys()) assert(migrationFiles.includes(file), `Missing immutable migration checkpoint: ${file}`)
assert.equal(migrationFiles.filter((name) => /f23_3e_p1f/i.test(name)).length, 0, 'P1F forbids a P1F migration')
for (const [file, expected] of migrationCheckpoints) {
  const actual = createHash('sha256').update(readFileSync(resolve(migrationsDirectory, file))).digest('hex').toUpperCase()
  assert.equal(actual, expected, `Immutable migration checkpoint drift: ${file}`)
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
  assert.equal(result.status, 0, `${label} failed or timed out; run that local QA command directly for diagnostics`)
  return result.stdout
}

const localCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const localArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]

const getLocalStatus = () => {
  const result = run(localCommand, localArgs('status -o json'), { timeout: 30_000 })
  assert.equal(result.status, 0, 'Local Supabase status failed; no fallback is permitted')
  const status = JSON.parse(result.stdout)
  for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    assert.equal(typeof status[key], 'string', `Local status omitted ${key}`)
  }
  assertLoopback(status.DB_URL, 'Supabase local DB')
  assertLoopback(status.API_URL, 'Supabase local API')
  return status
}

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ], { timeout: 30_000 }), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, `Expected exactly one running ${expectedContainerName}`)
  assert(/supabase\/postgres/i.test(rows[0][2]), 'Unexpected database image')
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format', '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ], { timeout: 30_000 }), 'Docker inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match, 'Could not parse Docker labels')
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  return rows[0][0]
}

let localStatus = getLocalStatus()
let containerId = discoverContainer()
console.log('P1F_QA_LOCAL_SAFETY_GUARD: PASS')
console.log('P1F_QA_IMMUTABLE_MIGRATION_CHECKPOINTS: PASS')

const runReset = () => requireSuccess(
  run(localCommand, localArgs('db reset'), { timeout: 240_000 }),
  'npx --no-install supabase db reset',
)
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, { expectFailure = false } = {}) => {
  const result = run('docker', psqlArgs(), { input: sql, timeout: 60_000 })
  if (!expectFailure) requireSuccess(result, 'Local container psql')
  return result
}
const scalar = (sql) => psql(sql).stdout.trim()
const jsonRows = (expression) => {
  const output = psql(`set role service_role; select pg_catalog.row_to_json(r)::text from ${expression} r; reset role;`).stdout
  return output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{')).map(JSON.parse)
}
const oneRow = (expression) => {
  const rows = jsonRows(expression)
  assert.equal(rows.length, 1, `Expected one typed result row from ${expression.split('(')[0]}`)
  return rows[0]
}
const sqlFailureMessage = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, 'SQL was expected to fail closed')
  const output = `${result.stdout}\n${result.stderr}`
  assert.match(output, pattern)
  return output.match(/ERROR:\s*([^\r\n]+)/i)?.[1]?.trim() ?? ''
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const digest = (byte) => `pg_catalog.decode(pg_catalog.repeat(${q(byte)},32),'hex')`
const typedPayload = (marker, byte = '11') => `${q('p1f_qa')}::text,pg_catalog.convert_to(${q(marker)},'UTF8'),1,array[${digest(byte)}],1`

const runInheritedQa = ({ phase, file, flag, successMarker, markers }) => {
  const env = { ...process.env }
  if (flag) env[flag] = 'YES'
  const result = run(process.execPath, [resolve(file)], { env, timeout: 360_000 })
  const output = requireSuccess(result, `${phase} inherited local QA`)
  assert(!/deadlock detected|ERR_ASSERTION|UnhandledPromiseRejection/i.test(`${output}\n${result.stderr}`), `${phase} emitted a fatal marker`)
  for (const marker of markers) assert(output.includes(marker), `${phase} did not emit required runtime evidence: ${marker}`)
  console.log(successMarker)
  if (phase === 'P1A') console.log('P1F_QA_P1A_FORWARD_COMPATIBLE_CURRENT_SCHEMA: PASS')
}

const rpc = {
  contacts: (actor, center) => `public.f23_3e_p1e_list_crm_contacts_masked(${u(actor)},${q(center)},null,null,50)`,
  cases: (actor, center) => `public.f23_3e_p1e_list_consultation_cases_masked(${u(actor)},${q(center)},null,null,50)`,
  detail: (actor, caseId) => `public.f23_3e_p1e_get_consultation_case_masked(${u(actor)},${u(caseId)})`,
  createContact: (id, center, actor, marker, byte = '11') =>
    `public.f23_3e_p1d_create_crm_contact(${u(id)},${q(center)},${u(actor)},${typedPayload(marker, byte)})`,
  updateContact: (id, actor, version, marker, byte = '22') =>
    `public.f23_3e_p1d_update_crm_contact(${u(id)},${u(actor)},${version},${typedPayload(marker, byte)})`,
  createCase: (id, contact, actor, contactVersion = 1) =>
    `public.f23_3e_p1d_create_consultation_case(${u(id)},${u(contact)},${u(actor)},${contactVersion})`,
  assign: (id, caseId, actor, target, caseVersion) =>
    `public.f23_3e_p1d_assign_consultation_case(${u(id)},${u(caseId)},${u(actor)},${u(target)},${caseVersion})`,
  reassign: (id, caseId, actor, target, caseVersion, currentId, assignmentVersion) =>
    `public.f23_3e_p1d_reassign_consultation_case(${u(id)},${u(caseId)},${u(actor)},${u(target)},${caseVersion},${u(currentId)},${assignmentVersion},'p1f_qa')`,
}

const ids = {
  centers: { a: randomUUID(), b: randomUUID(), kill: randomUUID() },
  users: {
    ownerA: randomUUID(), adminA: randomUUID(), consultantA1: randomUUID(), consultantA2: randomUUID(),
    inactiveA: randomUUID(), otherA: randomUUID(), ownerB: randomUUID(), consultantB1: randomUUID(), ownerKill: randomUUID(),
  },
  contacts: { a1: randomUUID(), a2: randomUUID(), stale: randomUUID(), b1: randomUUID(), kill: randomUUID(), readOnly: randomUUID() },
  cases: { a1: randomUUID(), a2: randomUUID(), b1: randomUUID() },
  assignments: { a1: randomUUID(), a1New: randomUUID(), a1Stale: randomUUID(), a2: randomUUID(), b1: randomUUID() },
}
const allFixtureUuids = Object.values(ids).flatMap((group) => Object.values(group))

const postgrest = async (path, key, { method = 'GET', body } = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(`${localStatus.API_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

const spawnPsqlSession = (label) => {
  const child = spawn('docker', psqlArgs(), { cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const done = new Promise((resolveDone, rejectDone) => {
    const timer = setTimeout(() => {
      child.kill()
      rejectDone(new Error(`${label} timed out`))
    }, 30_000)
    child.once('error', (error) => { clearTimeout(timer); rejectDone(error) })
    child.once('close', (code) => { clearTimeout(timer); resolveDone({ code, stdout, stderr }) })
  })
  return { child, done, output: () => stdout }
}
const waitUntil = async (predicate, label, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error(`${label} timed out`)
}

const stateSnapshot = () => JSON.parse(scalar(`
select pg_catalog.json_build_object(
  'contacts',(select pg_catalog.count(*) from public.crm_contact),
  'cases',(select pg_catalog.count(*) from public.consultation_case),
  'assignments',(select pg_catalog.count(*) from public.consultation_case_assignment),
  'requests',(select pg_catalog.count(*) from public.crm_conversion_request),
  'audit',(select pg_catalog.count(*) from public.crm_audit_event),
  'outbox',(select pg_catalog.count(*) from public.crm_outbox_event)
)::text;`))

let primaryError
let finalResetPassed = false
let postReset = null

try {
  runReset()
  localStatus = getLocalStatus()
  containerId = discoverContainer()

  for (const inherited of inheritedRunners) runInheritedQa(inherited)
  console.log('P1F_QA_INHERITED_CONCURRENCY_MATRIX: PASS')
  console.log('P1F_QA_DEADLOCK_LIVENESS_GATE: PASS')
  console.log('P1F_QA_AUDIT_OUTBOX_FAULT_MATRIX: PASS')
  console.log('P1F_QA_IMPORT_REPLAY_CONFLICT_MATRIX: PASS')

  runReset()
  localStatus = getLocalStatus()
  containerId = discoverContainer()
  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')

  const { centers, users, contacts, cases, assignments } = ids
  psql(`
insert into auth.users (id,aud,role,created_at,updated_at) values
${Object.values(users).map((id) => `(${u(id)},'authenticated','authenticated',pg_catalog.now(),pg_catalog.now())`).join(',\n')};
insert into public.centers (id,name) values
(${q(centers.a)},'p1fqa_center_a'),(${q(centers.b)},'p1fqa_center_b'),(${q(centers.kill)},'p1fqa_center_kill');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1
where center_id in (${q(centers.a)},${q(centers.b)},${q(centers.kill)});
insert into public.center_members(center_id,user_id,role,status) values
(${q(centers.a)},${u(users.ownerA)},'owner','active'),
(${q(centers.a)},${u(users.adminA)},'center_admin','active'),
(${q(centers.a)},${u(users.consultantA1)},'consultant','active'),
(${q(centers.a)},${u(users.consultantA2)},'consultant','active'),
(${q(centers.a)},${u(users.inactiveA)},'consultant','inactive'),
(${q(centers.a)},${u(users.otherA)},'teacher','active'),
(${q(centers.b)},${u(users.ownerB)},'owner','active'),
(${q(centers.b)},${u(users.consultantB1)},'consultant','active'),
(${q(centers.kill)},${u(users.ownerKill)},'owner','active');
`)

  for (const [id, center, actor, marker, byte] of [
    [contacts.a1, centers.a, users.ownerA, 'P1F_RAW_A1_NEVER_SERIALIZE', '11'],
    [contacts.a2, centers.a, users.ownerA, 'P1F_RAW_A2_NEVER_SERIALIZE', '12'],
    [contacts.stale, centers.a, users.ownerA, 'P1F_STALE_V1', '13'],
    [contacts.b1, centers.b, users.ownerB, 'P1F_RAW_B1_NEVER_SERIALIZE', '14'],
    [contacts.kill, centers.kill, users.ownerKill, 'P1F_KILL_V1', '15'],
  ]) {
    const created = oneRow(rpc.createContact(id, center, actor, marker, byte))
    assert.deepEqual([created.ok, created.outcome_code], [true, 'CONTACT_CREATED'])
  }
  for (const [caseId, contactId, actor] of [
    [cases.a1, contacts.a1, users.ownerA], [cases.a2, contacts.a2, users.ownerA], [cases.b1, contacts.b1, users.ownerB],
  ]) {
    const created = oneRow(rpc.createCase(caseId, contactId, actor))
    assert.deepEqual([created.ok, created.outcome_code], [true, 'CASE_CREATED'])
  }

  const foreignTarget = oneRow(rpc.assign(assignments.a2, cases.a2, users.ownerA, users.consultantB1, 1))
  const inactiveTarget = oneRow(rpc.assign(assignments.a2, cases.a2, users.ownerA, users.inactiveA, 1))
  assert.deepEqual([foreignTarget.ok, foreignTarget.outcome_code], [false, 'TARGET_NOT_ELIGIBLE'])
  assert.deepEqual([inactiveTarget.ok, inactiveTarget.outcome_code], [false, 'TARGET_NOT_ELIGIBLE'])
  for (const [assignmentId, caseId, actor, target] of [
    [assignments.a1, cases.a1, users.ownerA, users.consultantA1],
    [assignments.a2, cases.a2, users.ownerA, users.consultantA2],
    [assignments.b1, cases.b1, users.ownerB, users.consultantB1],
  ]) {
    const assigned = oneRow(rpc.assign(assignmentId, caseId, actor, target, 1))
    assert.deepEqual([assigned.ok, assigned.outcome_code], [true, 'ASSIGNMENT_CREATED'])
  }
  assert.equal(scalar(`select center_id from public.consultation_case where consultation_case_id=${u(cases.a1)};`), centers.a)
  console.log('P1F_QA_MULTI_ACCOUNT_EXACT_CENTER_MUTATION_ISOLATION: PASS')

  const ownerAContacts = jsonRows(rpc.contacts(users.ownerA, centers.a))
  const adminAContacts = jsonRows(rpc.contacts(users.adminA, centers.a))
  const ownerACases = jsonRows(rpc.cases(users.ownerA, centers.a))
  const consultantA1Cases = jsonRows(rpc.cases(users.consultantA1, centers.a))
  const consultantA2Cases = jsonRows(rpc.cases(users.consultantA2, centers.a))
  const ownerBCases = jsonRows(rpc.cases(users.ownerB, centers.b))
  assert.equal(ownerAContacts.length, 3)
  assert.deepEqual(adminAContacts.map((row) => row.crm_contact_id).sort(), ownerAContacts.map((row) => row.crm_contact_id).sort())
  assert.equal(ownerACases.length, 2)
  assert.deepEqual(consultantA1Cases.map((row) => row.consultation_case_id), [cases.a1])
  assert.deepEqual(consultantA2Cases.map((row) => row.consultation_case_id), [cases.a2])
  assert.deepEqual(ownerBCases.map((row) => row.consultation_case_id), [cases.b1])
  sqlFailureMessage(`set role service_role; select * from ${rpc.cases(users.inactiveA, centers.a)};`, /READ_SCOPE_DENIED/i)
  sqlFailureMessage(`set role service_role; select * from ${rpc.cases(users.otherA, centers.a)};`, /READ_SCOPE_DENIED/i)
  sqlFailureMessage(`set role service_role; select * from ${rpc.cases(users.ownerA, centers.b)};`, /READ_SCOPE_DENIED/i)
  sqlFailureMessage(`set role service_role; select * from ${rpc.cases(users.adminA, centers.b)};`, /READ_SCOPE_DENIED/i)
  sqlFailureMessage(`set role service_role; select * from ${rpc.cases(users.consultantB1, centers.a)};`, /READ_SCOPE_DENIED/i)
  const unassignedMessage = sqlFailureMessage(`set role service_role; select * from ${rpc.detail(users.consultantA1, cases.a2)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  const foreignMessage = sqlFailureMessage(`set role service_role; select * from ${rpc.detail(users.consultantA1, cases.b1)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  assert.equal(unassignedMessage, foreignMessage, 'Foreign and unassigned detail must be indistinguishable')
  console.log('P1F_QA_MULTI_ACCOUNT_EXACT_CENTER_READ_ISOLATION: PASS')

  for (const table of ['crm_contact', 'consultation_case', 'crm_care_log']) {
    for (const key of [localStatus.ANON_KEY, localStatus.SERVICE_ROLE_KEY]) {
      const response = await postgrest(`${table}?select=*`, key)
      assert([401, 403].includes(response.status), `${table} direct REST access must return 401/403`)
      await response.arrayBuffer()
    }
  }
  const apiContactsResponse = await postgrest('rpc/f23_3e_p1e_list_crm_contacts_masked', localStatus.SERVICE_ROLE_KEY, {
    method: 'POST', body: {
      p_actor_user_id: users.ownerA, p_center_id: centers.a,
      p_after_updated_at: null, p_after_contact_id: null, p_limit: 50,
    },
  })
  const apiCasesResponse = await postgrest('rpc/f23_3e_p1e_list_consultation_cases_masked', localStatus.SERVICE_ROLE_KEY, {
    method: 'POST', body: {
      p_actor_user_id: users.ownerA, p_center_id: centers.a,
      p_after_updated_at: null, p_after_case_id: null, p_limit: 50,
    },
  })
  assert.equal(apiContactsResponse.status, 200)
  assert.equal(apiCasesResponse.status, 200)
  const apiContacts = await apiContactsResponse.json()
  const apiCases = await apiCasesResponse.json()
  assert.equal(apiContacts.length, 3); assert.equal(apiCases.length, 2)
  assert(apiContacts.every((row) => row.center_id === centers.a && row.contact_methods_visibility === 'MASKED_PROTECTED' && row.projection_cache_policy === 'NO_STORE'))
  assert(apiCases.every((row) => row.center_id === centers.a && row.contact_methods_visibility === 'MASKED_PROTECTED' && row.projection_cache_policy === 'NO_STORE'))
  const serializedApi = JSON.stringify([apiContacts, apiCases])
  for (const forbidden of ['P1F_RAW_', 'protected_contact_methods_ciphertext', 'normalized_lookup_digests', 'contact_methods_crypto_version', 'normalization_version']) {
    assert(!serializedApi.includes(forbidden), `Protected API response leaked ${forbidden}`)
  }
  console.log('P1F_QA_DIRECT_API_ANON_CRM_TABLE_DENIED: PASS')
  console.log('P1F_QA_DIRECT_API_SERVICE_ROLE_CRM_TABLE_DENIED: PASS')
  console.log('P1F_QA_DIRECT_API_PROTECTED_MASKED_RPC: PASS')

  const beforeStale = stateSnapshot()
  const updated = oneRow(rpc.updateContact(contacts.stale, users.ownerA, 1, 'P1F_STALE_V2', '23'))
  const stale = oneRow(rpc.updateContact(contacts.stale, users.ownerA, 1, 'P1F_STALE_RETRY', '24'))
  assert.deepEqual([updated.ok, updated.outcome_code, updated.resource_version], [true, 'CONTACT_UPDATED', 2])
  assert.deepEqual([stale.ok, stale.outcome_code], [false, 'CONTACT_VERSION_STALE'])
  const afterStale = stateSnapshot()
  assert.equal(afterStale.audit - beforeStale.audit, 1)
  assert.equal(afterStale.outbox - beforeStale.outbox, 1)
  assert.equal(scalar(`select center_id from public.crm_contact where crm_contact_id=${u(contacts.stale)};`), centers.a)
  const staleCase = oneRow(rpc.assign(randomUUID(), cases.a1, users.ownerA, users.consultantA2, 1))
  assert.deepEqual([staleCase.ok, staleCase.outcome_code], [false, 'CASE_VERSION_STALE'])
  const reassigned = oneRow(rpc.reassign(assignments.a1New, cases.a1, users.ownerA, users.consultantA2, 2, assignments.a1, 1))
  assert.deepEqual([reassigned.ok, reassigned.outcome_code], [true, 'ASSIGNMENT_REASSIGNED'])
  const staleAssignment = oneRow(rpc.reassign(assignments.a1Stale, cases.a1, users.ownerA, users.consultantA1, 3, assignments.a1New, 99))
  assert.deepEqual([staleAssignment.ok, staleAssignment.outcome_code], [false, 'ASSIGNMENT_VERSION_STALE'])
  console.log('P1F_QA_STALE_VERSION_FAILS_CLOSED: PASS')

  const killBefore = stateSnapshot()
  const sessionA = spawnPsqlSession('kill-switch control session')
  let controlReleased = false
  try {
    sessionA.child.stdin.write(`set application_name='p1f_kill_switch_control'; begin; update public.center_crm_control set crm_state='SUSPENDED',feature_flag_state='DISABLED',control_version=control_version+1 where center_id=${q(centers.kill)}; select 'P1F_LOCK_HELD:'||pg_catalog.pg_backend_pid();\n`)
    await waitUntil(() => sessionA.output().includes('P1F_LOCK_HELD:'), 'control lock acquisition')
    const sessionB = spawnPsqlSession('kill-switch mutation session')
    sessionB.child.stdin.end(`set application_name='p1f_kill_switch_mutation'; set role service_role; select pg_catalog.row_to_json(r)::text from ${rpc.updateContact(contacts.kill, users.ownerKill, 1, 'P1F_KILL_BLOCKED', '31')} r; reset role;\n`)
    await waitUntil(() => scalar(`select pg_catalog.count(*) from pg_catalog.pg_stat_activity where application_name='p1f_kill_switch_mutation' and wait_event_type='Lock';`) === '1', 'mutation lock wait evidence')
    console.log('P1F_QA_KILL_SWITCH_ACTUAL_LOCK_WAIT_OBSERVED: PASS')
    sessionA.child.stdin.end('commit;\n')
    controlReleased = true
    const [controlResult, mutationResult] = await Promise.all([sessionA.done, sessionB.done])
    assert.equal(controlResult.code, 0, 'Control session failed')
    assert.equal(mutationResult.code, 0, 'Mutation session failed')
    const mutationRow = mutationResult.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith('{'))
    assert(mutationRow, 'Blocked mutation did not return a typed row')
    const mutation = JSON.parse(mutationRow)
    assert.deepEqual([mutation.ok, mutation.outcome_code], [false, 'CRM_RUNTIME_NOT_ACTIVE'])
  } finally {
    if (!controlReleased && !sessionA.child.killed) sessionA.child.stdin.end('rollback;\n')
  }
  assert.deepEqual(stateSnapshot(), killBefore)
  sqlFailureMessage(`set role service_role; select * from ${rpc.contacts(users.ownerKill, centers.kill)};`, /CRM_READ_NOT_ACTIVE/i)
  console.log('P1F_QA_KILL_SWITCH_WAIT_RECHECK: PASS')
  console.log('P1F_QA_KILL_SWITCH_READ_DENIED: PASS')

  psql(`update public.center_crm_control set crm_state='READ_ONLY',feature_flag_state='READ_ONLY',control_version=control_version+1 where center_id=${q(centers.a)};`)
  assert.equal(jsonRows(rpc.contacts(users.ownerA, centers.a)).length, 3)
  const readOnlyBefore = stateSnapshot()
  const readOnlyMutation = oneRow(rpc.createContact(contacts.readOnly, centers.a, users.ownerA, 'P1F_READ_ONLY_BLOCKED', '41'))
  assert.deepEqual([readOnlyMutation.ok, readOnlyMutation.outcome_code], [false, 'CRM_RUNTIME_NOT_ACTIVE'])
  const readOnlyRequest = oneRow(`public.f23_3e_p1b_create_conversion_draft(
    ${u(cases.a1)},${u(users.ownerA)},3,1,1,
    ${digest('51')},${digest('52')},${digest('53')},${digest('54')},pg_catalog.clock_timestamp()+interval '1 hour')`)
  assert.deepEqual([readOnlyRequest.ok, readOnlyRequest.outcome_code], [false, 'CRM_RUNTIME_NOT_ACTIVE'])
  assert.deepEqual(stateSnapshot(), readOnlyBefore)
  console.log('P1F_QA_READ_ONLY_COHORT_READS_ONLY: PASS')

  console.log('P1F_P1_FOUNDATION_LOCAL_TECHNICAL_GATE: PASS')
  console.log('P1F_P2_ENTRY_TECHNICAL_GATE: PASS')
  console.log('P1F_ACTIVE_MUTATION_ROLLOUT_GATE: BLOCKED')
  console.log('P1F_REMOTE_ROLLOUT_GATE: BLOCKED')
  console.log('P1F_REMOTE_APPLY: NOT RUN')
  console.log('P1F_MANUAL_ACTIVE_MUTATION_QA: NOT RUN — NOT APPLICABLE BEFORE BROWSER/CAPABILITY WIRING')
  console.log('P1F_PRODUCTION_READINESS: NOT CLAIMED')
  console.log('P1F_REAL_CONVERSION_READINESS: BLOCKED — P2/P3/P4 NOT IMPLEMENTED')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    localStatus = getLocalStatus()
    containerId = discoverContainer()
    postReset = JSON.parse(scalar(`
select pg_catalog.json_build_object(
  'p1e_history_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608100003'),
  'p1_history_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003')),
  'fixture_count',(
    (select pg_catalog.count(*) from public.centers where name like 'p1fqa_%')
    +(select pg_catalog.count(*) from auth.users where id in (${Object.values(ids.users).map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_contact where crm_contact_id in (${allFixtureUuids.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.consultation_case where consultation_case_id in (${allFixtureUuids.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id in (${allFixtureUuids.map(u).join(',')}))
  ),
  'nondefault_root_count',(select pg_catalog.count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED'),
  'qa_helper_count',(select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p1f_qa_%')
)::text;`))
    assert.deepEqual(postReset, {
      p1e_history_count: 1, p1_history_count: 5, fixture_count: 0,
      nondefault_root_count: 0, qa_helper_count: 0,
    })
    finalResetPassed = true
  } catch (resetError) {
    if (!primaryError) primaryError = resetError
    else primaryError = new AggregateError([primaryError, resetError], 'P1F QA and final reset both failed')
  }
}

if (finalResetPassed) {
  console.log('P1F_QA_FINAL_LOCAL_RESET: PASS')
  console.log('P1F_QA_P1E_MIGRATION_HISTORY_COUNT: 1')
  console.log('P1F_QA_P1A_P1E_MIGRATION_HISTORY_COUNT: 5')
  console.log('P1F_QA_LEFTOVER_FIXTURE_COUNT: 0')
  console.log('P1F_QA_NONDEFAULT_ROOT_COUNT: 0')
  console.log('P1F_QA_TEMP_HELPER_COUNT: 0')
}
if (primaryError) throw primaryError

console.log('F23.3E-P1F integrated local QA and rollout gates passed')
