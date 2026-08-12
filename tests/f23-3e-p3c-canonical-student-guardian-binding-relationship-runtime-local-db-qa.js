import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P3C_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[resetConsentFlag], 'YES', `${resetConsentFlag}=YES is required before any mutation`)
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked project reference is forbidden')
assert(!process.argv.includes(linkedFlag), 'Linked mode is forbidden')

const assertLoopback = (value, label) => {
  if (!value) return
  let host = value
  try { host = new URL(value).hostname } catch { host = value.split(':')[0] }
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(host.toLowerCase()), `${label} must be loopback`)
}
for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'API_URL']) {
  assertLoopback(process.env[name], name)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, ...options,
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
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string', `Local status omitted ${key}`)
}
assertLoopback(new URL(localStatus.DB_URL).hostname, 'Supabase local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'Supabase local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, `Expected exactly one ${expectedContainerName}`)
  assert(/supabase\/postgres/i.test(rows[0][2]), 'Unexpected local database image')
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
console.log('P3C_QA_LOCAL_SAFETY_GUARD: PASS')

const runReset = () => requireSuccess(
  run(localCommand, localArgs('db reset'), { timeout: 300_000 }),
  'local Supabase database reset',
)
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const adminPsqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'supabase_admin',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, { expectFailure = false } = {}) => {
  const result = run('docker', psqlArgs(), { input: sql })
  if (!expectFailure) requireSuccess(result, 'Local container psql')
  return result
}
const scalar = (sql) => psql(sql).stdout.trim()
const adminPsql = (sql) => requireSuccess(
  run('docker', adminPsqlArgs(), { input: sql }),
  'Local synthetic crypto bridge provisioning',
)
const jsonValue = (sql) => {
  const lines = psql(sql).stdout.trim().split(/\r?\n/).map((line) => line.trim())
  const line = [...lines].reverse().find((value) => value.startsWith('{') || value.startsWith('['))
  assert(line, `Expected JSON; received: ${lines.join(' | ')}`)
  return JSON.parse(line)
}
const jsonFromOutput = (output) => {
  const lines = output.trim().split(/\r?\n/).map((line) => line.trim())
  const line = [...lines].reverse().find((value) => value.startsWith('{') || value.startsWith('['))
  assert(line, `Expected JSON worker output; received: ${lines.join(' | ')}`)
  return JSON.parse(line)
}
const expectSqlFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, 'SQL was expected to fail')
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}
const q = (value) => value === null || value === undefined
  ? 'null'
  : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const bytea = (pair, bytes = 32) => `pg_catalog.decode(pg_catalog.repeat(${q(pair)},${bytes}),'hex')`
const digest = (value) => `extensions.digest(pg_catalog.convert_to(${q(value)},'UTF8'),'sha256')`
const digestArray = (value) => `array[${digest(value)}]::bytea[]`
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
    const deadline = setTimeout(() => reject(new Error(`Timed out waiting for ${needle}`)), 20_000)
    const check = () => {
      if (stdout.includes(needle)) { clearTimeout(deadline); resolve() }
      else setTimeout(check, 20)
    }
    check()
  })
  return { child, done, marker }
}
const waitForLock = async (applicationName) => {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const waiting = scalar(`select coalesce(bool_or(wait_event_type = 'Lock' and cardinality(pg_catalog.pg_blocking_pids(pid)) > 0),false) from pg_catalog.pg_stat_activity where application_name=${q(applicationName)};`)
    if (waiting === 't') return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`${applicationName} did not exhibit a real PostgreSQL lock wait`)
}

const postRpc = (rpc, apikey, bearer, body) => fetch(`${localStatus.API_URL}/rest/v1/rpc/${rpc}`, {
  method: 'POST',
  headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const tableNames = [
  'student_profile', 'guardian_profile', 'crm_identity_target_binding',
  'guardian_student_relationship',
]
const dependentFixtureTables = [
  'crm_conversion_action', 'crm_conversion_authority',
  'crm_identity_match_review', 'crm_profile_creation_reservation',
  'crm_idempotency_registry', 'crm_audit_event', 'crm_outbox_event',
]
const ids = {
  centers: { a: `p3cqa-${randomUUID()}`, b: `p3cqa-${randomUUID()}` },
  users: { ownerA: randomUUID(), consultantA: randomUUID(), ownerB: randomUUID() },
  memberships: { ownerA: randomUUID(), consultantA: randomUUID(), ownerB: randomUUID() },
  contacts: { a: randomUUID(), b: randomUUID(), legacy: randomUUID() },
  cases: { a: randomUUID(), b: randomUUID() },
  assignments: { a: randomUUID(), b: randomUUID() },
  candidates: { student: randomUUID(), sameName: randomUUID(), foreign: randomUUID() },
  policies: { studentA: randomUUID(), guardianA: randomUUID(), studentB: randomUUID(), guardianB: randomUUID() },
  requestRegistry: { a: randomUUID(), b: randomUUID() },
  requests: { a: randomUUID(), b: randomUUID() },
  reviews: { studentCreate: randomUUID(), guardianCreate: randomUUID() },
  reservations: { student: randomUUID(), guardian: randomUUID() },
  targets: { student: randomUUID(), guardian: randomUUID(), studentSecond: randomUUID(), guardianSecond: randomUUID() },
  actions: { student: randomUUID(), guardian: randomUUID(), relationship: randomUUID() },
  p2Actions: {
    studentSearch: randomUUID(), studentReview: randomUUID(), studentDecision: randomUUID(), studentReserve: randomUUID(),
    guardianSearch: randomUUID(), guardianReview: randomUUID(), guardianDecision: randomUUID(), guardianReserve: randomUUID(),
  },
  relationships: { main: randomUUID(), second: randomUUID() },
}
const evidence = {
  studentName: 'Synthetic P3C Student', studentBirth: '2013-04-05',
  guardianName: 'Synthetic P3C Guardian',
  contactPayloadHex: '5033432d53594e5448455449432d434f4e544143542d45564944454e43452d5631',
}

let fixtureCreated = false
let finalResetVerified = false

const functionExists = (signature) => scalar(`select (pg_catalog.to_regprocedure(${q(signature)}) is not null)::text;`) === 'true'
const assertFunction = (signature) => assert(functionExists(signature), `Missing function ${signature}`)
const functionResult = (signature) => scalar(`select pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure(${q(signature)}));`)
const hasExecute = (role, signature) => scalar(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE');`)
const hasPublicExecute = (signature) => scalar(`select coalesce(bool_or(a.grantee=0 and a.privilege_type='EXECUTE'),false)::text from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where p.oid=pg_catalog.to_regprocedure(${q(signature)});`)

const materializeSql = ({
  key = 'materialize-key', intent = 'materialize-intent', expectedRequestVersion = 2,
  expectedGuardianReviewVersion = 2, expectedStudentReviewVersion = 2,
  relationshipDecision = 'CREATE_RELATIONSHIP', relationshipType = 'PARENT',
  primary = true, financial = 'PRIMARY', academic = 'PRIMARY',
  guardianReviewId = ids.reviews.guardianCreate,
  studentReviewId = ids.reviews.studentCreate,
  safeReason = 'P3C_QA_REVIEWED',
  } = {}) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3c_materialize_reviewed_action_pair(
  ${u(ids.users.ownerA)},${u(ids.requests.a)},${expectedRequestVersion},
  ${u(guardianReviewId)},${expectedGuardianReviewVersion},
  ${u(studentReviewId)},${expectedStudentReviewVersion},
  ${u(ids.actions.relationship)},${q(relationshipDecision)},${q(relationshipType)},${primary},
  ${q(financial)},${q(academic)},${q(safeReason)},1,
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`
const transactionalMaterialize = (mutationSql, options) => jsonValue(`
begin;
set session_replication_role='replica';
${mutationSql}
set session_replication_role='origin';
${materializeSql(options)}
rollback;`)

const finalizeSql = ({
  key = 'finalize-key', intent = 'finalize-intent', expectedRequestVersion = 2,
  expectedActionCount = 3,
} = {}) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3c_finalize_reviewed_action_plan(
  ${u(ids.users.ownerA)},${u(ids.requests.a)},${expectedRequestVersion},${expectedActionCount},
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`

let idempotencyCounter = 80
const nextIdempotency = () => bytea((idempotencyCounter++).toString(16).padStart(2, '0'))
const p2BaseArgs = (identityKind, overrides = {}) => ({
  requestId: ids.requests.a,
  actorId: ids.users.ownerA,
  requestVersion: 2,
  identityKind,
  candidateId: ids.candidates.student,
  contactVersion: 2,
  caseVersion: 2,
  candidateVersion: 2,
  displayName: identityKind === 'STUDENT' ? evidence.studentName : evidence.guardianName,
  birthDate: identityKind === 'STUDENT' ? evidence.studentBirth : null,
  birthYear: null,
  normalizationVersion: 1,
  matchPolicyVersion: 1,
  minimumEvidencePolicyVersion: 1,
  policyRegistryVersion: 2,
  adapterVersion: 1,
  actionId: identityKind === 'STUDENT' ? ids.p2Actions.studentSearch : ids.p2Actions.guardianSearch,
  targetId: null,
  targetVersion: null,
  supersedesReviewId: null,
  ...overrides,
})
const p2EvidenceSql = (a) => `${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},${q(a.birthDate)}::date,${a.birthYear ?? 'null'},${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},${a.policyRegistryVersion},${a.adapterVersion}`
const p2SharedSql = (a) => `${p2EvidenceSql(a)},${u(a.actionId)}`
const searchSql = (identityKind, overrides = {}, role = 'service_role') => {
  const a = p2BaseArgs(identityKind, overrides)
  return `set role ${role}; select public.f23_3e_p2b_search_masked_candidates(${u(a.requestId)},${p2EvidenceSql(a)}); reset role;`
}
const detailSql = (identityKind, opaqueTargetId, targetVersion, overrides = {}, role = 'service_role') => {
  const a = p2BaseArgs(identityKind, { ...overrides, targetId: opaqueTargetId, targetVersion })
  return `set role ${role}; select public.f23_3e_p2b_get_masked_candidate_review_detail(${u(a.requestId)},${p2EvidenceSql(a)},${u(a.targetId)},${a.targetVersion}); reset role;`
}
const createReviewSql = (identityKind, overrides = {}, idempotency = nextIdempotency(), role = 'service_role') => {
  const a = p2BaseArgs(identityKind, overrides)
  return `set role ${role}; select public.f23_3e_p2c_create_match_review(${u(a.requestId)},${p2SharedSql(a)},${idempotency},${u(a.targetId)},${a.targetVersion ?? 'null'},${u(a.supersedesReviewId)}); reset role;`
}
const decideReviewSql = (identityKind, reviewId, expectedReviewVersion, reviewAction, overrides = {}, idempotency = nextIdempotency(), role = 'service_role') => {
  const a = p2BaseArgs(identityKind, overrides)
  return `set role ${role}; select public.f23_3e_p2c_decide_match_review(${u(a.requestId)},${u(reviewId)},${expectedReviewVersion},${q(reviewAction)},${p2SharedSql(a)},${idempotency}); reset role;`
}
const reserveSql = (identityKind, reviewId, expectedReviewVersion, overrides = {}, idempotency = nextIdempotency(), role = 'service_role') => {
  const a = p2BaseArgs(identityKind, overrides)
  return `set role ${role}; select public.f23_3e_p2c_reserve_create_target(${u(a.requestId)},${u(reviewId)},${expectedReviewVersion},${p2SharedSql(a)},${idempotency}); reset role;`
}

const assertNoP3Execution = (result) => {
  for (const field of ['profile_created', 'profile_reused', 'conversion_approved', 'request_completed']) {
    assert.notEqual(result[field], true, `${field} must never be true before P3D`)
  }
}

const assertEventPair = (result) => {
  assert.match(result.correlation_id, /^[0-9a-f-]{36}$/i)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where correlation_id=${u(result.correlation_id)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where safe_payload->>'correlation_id'=${q(result.correlation_id)};`), '1')
}

const replaceContactEnvelope = (contactId, envelopeHex, cryptoVersion = 2) => psql(`
set session_replication_role='replica';
update public.crm_contact set protected_contact_methods_ciphertext=pg_catalog.decode(${q(envelopeHex)},'hex'),contact_methods_crypto_version=${cryptoVersion}
where crm_contact_id=${u(contactId)};
set session_replication_role='origin';`)

const assertSourceEnvelopeRejected = (contactId, envelopeHex, cryptoVersion, label) => {
  const originalHex = scalar(`select pg_catalog.encode(protected_contact_methods_ciphertext,'hex') from public.crm_contact where crm_contact_id=${u(contactId)};`)
  const originalVersion = scalar(`select contact_methods_crypto_version from public.crm_contact where crm_contact_id=${u(contactId)};`)
  replaceContactEnvelope(contactId, envelopeHex, cryptoVersion)
  expectSqlFailure(`select public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(contactId)},2);`, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)
  replaceContactEnvelope(contactId, originalHex, Number(originalVersion))
  assert.equal(scalar(`select pg_catalog.encode(public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(contactId)},2),'hex');`), evidence.contactPayloadHex, label)
}

const securitySyncSql = () => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_register_or_sync_account_security_control(
  ${u(ids.users.ownerA)},${u(ids.users.ownerA)},'ACTIVE',${digest('p3c-owner-security-evidence')},null,
  ${digest('p3c-owner-security-sync-intent')},${digest('p3c-owner-security-sync-key')},now()+interval '1 hour'
) x;
reset role;`
const stepUpSql = (sessionId) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_record_verified_conversion_step_up(
  ${u(ids.users.ownerA)},${u(sessionId)},${u(ids.requests.a)},'AAL2_TOTP',
  'local.synthetic.server-verifier',${digest('p3c-local-step-verification')},now(),1,
  ${digest('p3c-local-step-intent')},${digest('p3c-local-step-key')},now()+interval '1 hour'
) x;
reset role;`
const issueAuthoritySql = (stepUpAssertionId) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_issue_conversion_authority(
  ${u(ids.users.ownerA)},${u(ids.requests.a)},${u(stepUpAssertionId)},2,1,
  ${digest('p3c-caller-supplied-authority-environment')},
  ${digest('p3c-issue-authority-intent')},${digest('p3c-issue-authority-key')},now()+interval '1 hour'
) x;
reset role;`

try {
  runReset()
  containerId = discoverContainer()
  console.log('P3C_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where name like 'f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime%';`), '1')
  assert.equal(scalar(`select count(*) from auth.users;`), '0')
  assert.equal(scalar(`select count(*) from vault.secrets;`), '0')
  for (const table of tableNames) assert.equal(scalar(`select count(*) from public.${table};`), '0')
  for (const table of dependentFixtureTables) assert.equal(scalar(`select count(*) from public.${table};`), '0')

  assert.equal(scalar(`select extversion from pg_catalog.pg_extension where extname='supabase_vault';`), '0.3.1')
  for (const signature of [
    'vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_noncegen()',
  ]) assertFunction(signature)
  console.log('P3C_QA_GUARDIAN_CRYPTO_PREFLIGHT: PASS')

  // The stock local Vault 0.3.1 image owns these primitives as supabase_admin.
  // Grant only the migration-function owner for this synthetic Docker run; the
  // final database reset restores the exact extension ACL baseline.
  adminPsql(`
grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;
`)
  for (const signature of [
    'vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_noncegen()',
  ]) assert.equal(hasExecute('postgres', signature), 't')
  console.log('P3C_QA_LOCAL_CRYPTO_BRIDGE: PASS')

  const materializeSignature = 'public.f23_3e_p3c_materialize_reviewed_action_pair(uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,integer,bytea,bytea,timestamp with time zone)'
  const finalizeSignature = 'public.f23_3e_p3c_finalize_reviewed_action_plan(uuid,uuid,integer,integer,bytea,bytea,timestamp with time zone)'
  assertFunction(materializeSignature)
  assertFunction(finalizeSignature)
  assert.match(functionResult(materializeSignature), /ok boolean.*outcome_code text.*replayed boolean.*guardian_action_id uuid.*student_action_id uuid.*relationship_action_id uuid.*action_versions jsonb.*current_action_set_digest bytea.*action_set_encoding_version integer.*correlation_id uuid/i)
  assert.match(functionResult(finalizeSignature), /ok boolean.*outcome_code text.*replayed boolean.*conversion_request_id uuid.*action_count integer.*finalized_action_set_digest bytea.*action_set_encoding_version integer.*max_action_version integer.*correlation_id uuid/i)
  for (const signature of [materializeSignature, finalizeSignature]) {
    assert.equal(hasExecute('service_role', signature), 't')
    assert.equal(hasExecute('anon', signature), 'f')
    assert.equal(hasExecute('authenticated', signature), 'f')
    assert.equal(hasPublicExecute(signature), 'false')
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3c_%' and not p.proname like 'f23_3e_p3c_internal_%';`), '2')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3c_internal_%' and (has_function_privilege('service_role',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));`), '0')

  for (const table of tableNames) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT');`), 'f')
    }
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=any(array[${tableNames.map(q).join(',')}]);`), '0')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and (routine_name like 'f23_3e_p3d%' or routine_name in ('conversion_execute','conversion_read_result_status'));`), '0')
  console.log('P3C_QA_DIRECT_API_FAIL_CLOSED: PASS')
  console.log('P3C_QA_NO_P3D_EXECUTOR: PASS')

  // Frozen external P2 wrappers and P3B authority surface must survive P3C unchanged.
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f23_3e_p2b_search_masked_candidates','f23_3e_p2b_get_masked_candidate_review_detail') and p.prosecdef;`), '2')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2c_%' and p.proname not like 'f23_3e_p2c_internal_%' and p.prosecdef;`), '8')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3b_%' and p.proname not like 'f23_3e_p3b_internal_%' and p.prosecdef;`), '6')

  // iC3Env01 is a server-root crypto domain. P2B identity policy and P3B
  // caller-supplied authority fingerprints are deliberately independent.
  const cryptoEnvironment = scalar(`select pg_catalog.encode(public.f23_3e_p3c_internal_crypto_environment_fingerprint(),'hex');`)
  assert.match(cryptoEnvironment, /^[0-9a-f]{64}$/)
  assert.equal(cryptoEnvironment, scalar(`select pg_catalog.encode(public.f23_3e_p3c_internal_crypto_environment_fingerprint(),'hex');`))
  assert.equal(scalar(`select (public.f23_3e_p3c_internal_crypto_environment_fingerprint()=extensions.digest(pg_catalog.convert_to('p3c-caller-authority-domain','UTF8'),'sha256'))::text;`), 'false')
  console.log('P3C_QA_ENVIRONMENT_DOMAINS_INDEPENDENT: PASS')

  // Synthetic fixture begins only after every local-only and catalog guard passed.
  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P3C ephemeral synthetic local QA only');`)
  fixtureCreated = true

  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
(${u(ids.users.ownerA)},'authenticated','authenticated',now(),now()),
(${u(ids.users.consultantA)},'authenticated','authenticated',now(),now()),
(${u(ids.users.ownerB)},'authenticated','authenticated',now(),now());
insert into public.centers(id,name) values
(${q(ids.centers.a)},'p3c synthetic center a'),(${q(ids.centers.b)},'p3c synthetic center b');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2
where center_id in (${q(ids.centers.a)},${q(ids.centers.b)});
insert into public.center_members(id,center_id,user_id,role,status) values
(${u(ids.memberships.ownerA)},${q(ids.centers.a)},${u(ids.users.ownerA)},'owner','active'),
(${u(ids.memberships.consultantA)},${q(ids.centers.a)},${u(ids.users.consultantA)},'consultant','active'),
(${u(ids.memberships.ownerB)},${q(ids.centers.b)},${u(ids.users.ownerB)},'owner','active');
insert into public.crm_contact(
  crm_contact_id,center_id,display_name,source_category,
  protected_contact_methods_ciphertext,contact_methods_crypto_version,
  normalized_lookup_digests,normalization_version,created_by_user_id
) values
(${u(ids.contacts.a)},${q(ids.centers.a)},${q(evidence.guardianName)},'synthetic',${bytea('41',16)},1,${digestArray('p3c-contact-a')},1,${u(ids.users.ownerA)}),
(${u(ids.contacts.b)},${q(ids.centers.b)},${q(evidence.guardianName)},'synthetic',${bytea('42',16)},1,${digestArray('p3c-contact-b')},1,${u(ids.users.ownerB)}),
(${u(ids.contacts.legacy)},${q(ids.centers.a)},'Synthetic P3C Legacy Guardian','synthetic',${bytea('43',16)},1,${digestArray('p3c-contact-legacy')},1,${u(ids.users.ownerA)});
insert into public.consultation_case(consultation_case_id,center_id,primary_contact_id,created_by_user_id) values
(${u(ids.cases.a)},${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.users.ownerA)}),
(${u(ids.cases.b)},${q(ids.centers.b)},${u(ids.contacts.b)},${u(ids.users.ownerB)});
begin; set constraints all deferred;
insert into public.consultation_case_assignment(
  assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id
) values
(${u(ids.assignments.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.users.consultantA)},${u(ids.users.ownerA)}),
(${u(ids.assignments.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.users.ownerB)},${u(ids.users.ownerB)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values (${u(ids.cases.a)},${u(ids.assignments.a)}),(${u(ids.cases.b)},${u(ids.assignments.b)})) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id; commit;
insert into public.consultation_case_candidate_student(
  candidate_student_id,center_id,consultation_case_id,display_name_evidence,birth_evidence_protected,candidate_status
) values
(${u(ids.candidates.student)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.studentName)},${bytea('51',16)},'DRAFT'),
(${u(ids.candidates.sameName)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.studentName)},${bytea('52',16)},'DRAFT'),
(${u(ids.candidates.foreign)},${q(ids.centers.b)},${u(ids.cases.b)},${q(evidence.studentName)},${bytea('53',16)},'DRAFT');
update public.consultation_case_candidate_student
set candidate_status='ACTIVE',candidate_version=2
where candidate_student_id in (${u(ids.candidates.student)},${u(ids.candidates.foreign)});
insert into public.crm_identity_policy_registry(
  identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,
  center_identity_policy_version,normalization_algorithm,normalization_version,
  digest_key_epoch,match_policy_version,minimum_evidence_policy_version
) values
(${u(ids.policies.studentA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.guardianA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.studentB)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.b)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.guardianB)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.b)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2
where identity_policy_registry_id in (${Object.values(ids.policies).map(u).join(',')});`)

  const protectedSource = jsonValue(`select row_to_json(x) from public.f23_3e_p3c_internal_protect_contact_source_evidence(${q(ids.centers.a)},${u(ids.contacts.a)},1,pg_catalog.decode(${q(evidence.contactPayloadHex)},'hex')) x;`)
  assert.equal(protectedSource.contact_version, 2)
  assert.equal(protectedSource.contact_methods_crypto_version, 2)
  const protectedForeignSource = jsonValue(`select row_to_json(x) from public.f23_3e_p3c_internal_protect_contact_source_evidence(${q(ids.centers.b)},${u(ids.contacts.b)},1,pg_catalog.decode(${q(evidence.contactPayloadHex)},'hex')) x;`)
  assert.equal(protectedForeignSource.contact_version, 2)

  psql(`
insert into public.crm_idempotency_registry(
  idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,
  consultation_case_id,operation,idempotency_key_digest,intent_digest,request_intent_digest,
  action_graph_digest,expires_at
) values
(${u(ids.requestRegistry.a)},${digest('p3c-authority-environment-a')},${q(ids.centers.a)},'consultation_case',${u(ids.cases.a)},${u(ids.cases.a)},'p3c.qa.request.a',${digest('p3c-request-key-a')},${digest('p3c-request-intent-a')},${digest('p3c-request-intent-a')},${digest('p3c-legacy-action-graph-a')},now()+interval '1 day'),
(${u(ids.requestRegistry.b)},${digest('p3c-authority-environment-b')},${q(ids.centers.b)},'consultation_case',${u(ids.cases.b)},${u(ids.cases.b)},'p3c.qa.request.b',${digest('p3c-request-key-b')},${digest('p3c-request-intent-b')},${digest('p3c-request-intent-b')},${digest('p3c-legacy-action-graph-b')},now()+interval '1 day');
insert into public.crm_conversion_request(
  conversion_request_id,center_id,consultation_case_id,source_contact_id,
  source_case_version,source_contact_version,source_assignment_id,source_assignment_version,
  identity_policy_version,conversion_policy_version,relationship_policy_version,
  student_profile_policy_version,action_graph_digest,idempotency_scope,
  idempotency_key_reference,intent_digest,requested_by_user_id
) values
(${u(ids.requests.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.contacts.a)},2,2,${u(ids.assignments.a)},1,1,1,1,1,${digest('p3c-legacy-action-graph-a')},'p3c.qa.a',${u(ids.requestRegistry.a)},${digest('p3c-conversion-intent-a')},${u(ids.users.consultantA)}),
(${u(ids.requests.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.contacts.b)},2,2,${u(ids.assignments.b)},1,1,1,1,1,${digest('p3c-legacy-action-graph-b')},'p3c.qa.b',${u(ids.requestRegistry.b)},${digest('p3c-conversion-intent-b')},${u(ids.users.ownerB)});
update public.crm_conversion_request set status='READY_FOR_REVIEW',request_version=2,updated_at=now()
where conversion_request_id in (${u(ids.requests.a)},${u(ids.requests.b)});`)

  const sourceEnvelopeHex = scalar(`select pg_catalog.encode(protected_contact_methods_ciphertext,'hex') from public.crm_contact where crm_contact_id=${u(ids.contacts.a)};`)
  assert(sourceEnvelopeHex.startsWith(Buffer.from('IC3CSE01').toString('hex')))
  assert.equal(scalar(`select contact_methods_crypto_version from public.crm_contact where crm_contact_id=${u(ids.contacts.a)};`), '2')
  assert.equal(scalar(`select pg_catalog.encode(public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(ids.contacts.a)},2),'hex');`), evidence.contactPayloadHex)
  expectSqlFailure(`select public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.b)},${u(ids.contacts.a)},2);`, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)
  expectSqlFailure(`select public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(ids.contacts.b)},2);`, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)
  expectSqlFailure(`select public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(ids.contacts.a)},1);`, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)
  expectSqlFailure(`select public.f23_3e_p3c_internal_unwrap_contact_source_evidence(${q(ids.centers.a)},${u(ids.contacts.legacy)},1);`, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)

  const targetEnvelopeHex = scalar(`select pg_catalog.encode(protected_contact_methods_ciphertext,'hex') from public.f23_3e_p3c_internal_protect_target_evidence(${q(ids.centers.a)},${u(ids.contacts.a)},2,${u(ids.targets.guardian)});`)
  assert(targetEnvelopeHex.startsWith(Buffer.from('IC3GTE01').toString('hex')))
  assert.notEqual(targetEnvelopeHex, sourceEnvelopeHex)
  assert.equal(scalar(`with p as (select * from public.f23_3e_p3c_internal_parse_envelope(pg_catalog.decode(${q(targetEnvelopeHex)},'hex'),'IC3GTE01')) select pg_catalog.encode(vault._crypto_aead_det_decrypt(p.sealed,public.f23_3e_p3c_internal_guardian_aad(${q(ids.centers.a)},${u(ids.targets.guardian)},p.key_epoch),1::bigint,pg_catalog.convert_to('iC3Gdn01','UTF8'),p.nonce),'hex') from p;`), evidence.contactPayloadHex)
  expectSqlFailure(`with p as (
    select * from public.f23_3e_p3c_internal_parse_envelope(pg_catalog.decode(${q(targetEnvelopeHex)},'hex'),'IC3GTE01')
  ), a as (
    select p.*,public.f23_3e_p3c_internal_guardian_aad(${q(ids.centers.a)},${u(ids.targets.guardian)},p.key_epoch) as aad,
      public.f23_3e_p3c_internal_crypto_environment_fingerprint() as env from p
  ), w as (
    select a.*,pg_catalog.set_byte(a.aad,pg_catalog.position(a.env in a.aad)-1,
      pg_catalog.get_byte(a.aad,pg_catalog.position(a.env in a.aad)-1)#1) as wrong_environment_aad from a
  ) select vault._crypto_aead_det_decrypt(w.sealed,w.wrong_environment_aad,1::bigint,
    pg_catalog.convert_to('iC3Gdn01','UTF8'),w.nonce) from w;`, /decrypt|crypto|failed|error/i)
  expectSqlFailure(`with p as (select * from public.f23_3e_p3c_internal_parse_envelope(pg_catalog.decode(${q(targetEnvelopeHex)},'hex'),'IC3GTE01')) select vault._crypto_aead_det_decrypt(p.sealed,public.f23_3e_p3c_internal_guardian_aad(${q(ids.centers.a)},${u(ids.targets.guardianSecond)},p.key_epoch),1::bigint,pg_catalog.convert_to('iC3Gdn01','UTF8'),p.nonce) from p;`, /decrypt|crypto|failed|error/i)
  expectSqlFailure(`with p as (select * from public.f23_3e_p3c_internal_parse_envelope(pg_catalog.decode(${q(targetEnvelopeHex)},'hex'),'IC3GTE01')) select vault._crypto_aead_det_decrypt(p.sealed,public.f23_3e_p3c_internal_guardian_aad(${q(ids.centers.a)},${u(ids.targets.guardian)},p.key_epoch),1::bigint,pg_catalog.convert_to('iC3Src01','UTF8'),p.nonce) from p;`, /decrypt|crypto|failed|error/i)
  expectSqlFailure(`with p as (select * from public.f23_3e_p3c_internal_parse_envelope(pg_catalog.decode(${q(sourceEnvelopeHex)},'hex'),'IC3CSE01')) select vault._crypto_aead_det_decrypt(p.sealed,public.f23_3e_p3c_internal_source_aad(${q(ids.centers.a)},${u(ids.contacts.a)},p.key_epoch),1::bigint,pg_catalog.convert_to('iC3Gdn01','UTF8'),p.nonce) from p;`, /decrypt|crypto|failed|error/i)

  const sourceBuffer = Buffer.from(sourceEnvelopeHex, 'hex')
  const mutated = (index, value) => {
    const copy = Buffer.from(sourceBuffer); copy[index] = value; return copy.toString('hex')
  }
  const tampered = Buffer.from(sourceBuffer); tampered[tampered.length - 1] ^= 1
  assertSourceEnvelopeRejected(ids.contacts.a, tampered.toString('hex'), 2, 'tampered source must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, mutated(0, 0), 2, 'wrong magic must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, mutated(8, 2), 2, 'wrong envelope version must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, mutated(9, 2), 2, 'wrong schema version must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, mutated(13, 2), 2, 'wrong epoch must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, sourceBuffer.subarray(0, sourceBuffer.length - 1).toString('hex'), 2, 'truncated source must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, Buffer.concat([sourceBuffer, Buffer.from([0])]).toString('hex'), 2, 'trailing source must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, sourceEnvelopeHex, 1, 'legacy version must restore')
  assertSourceEnvelopeRejected(ids.contacts.a, sourceEnvelopeHex, 999, 'unknown version must restore')
  console.log('P3C_QA_TARGET_EVIDENCE_REPROTECTION: PASS')
  console.log('P3C_QA_CRYPTO_WRONG_ENVIRONMENT: PASS')
  console.log('P3C_QA_GUARDIAN_SOURCE_OPAQUE_FAIL_CLOSED: PASS')

  // Canonical Student/Guardian forward dispatch starts empty and remains review-only.
  const studentSearch = jsonValue(searchSql('STUDENT'))
  assert.equal(studentSearch.outcome_code, 'NO_MATCH')
  assert.equal(studentSearch.match_outcome, 'NO_MATCH')
  assert.equal(studentSearch.target_adapter_namespace, 'canonical.student_profile.v1')
  assertNoP3Execution(studentSearch)
  const guardianSearch = jsonValue(searchSql('GUARDIAN'))
  assert.equal(guardianSearch.outcome_code, 'NO_MATCH')
  assert.equal(guardianSearch.match_outcome, 'NO_MATCH')
  assert.equal(guardianSearch.target_adapter_namespace, 'canonical.guardian_profile.v1')
  assertNoP3Execution(guardianSearch)
  replaceContactEnvelope(ids.contacts.a, '43'.repeat(16), 1)
  const legacyGuardianSearch = jsonValue(searchSql('GUARDIAN', { actionId: randomUUID() }))
  assert.equal(legacyGuardianSearch.outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  replaceContactEnvelope(ids.contacts.a, sourceEnvelopeHex, 2)
  const foreignSearch = jsonValue(searchSql('STUDENT', {
    requestId: ids.requests.b, actorId: ids.users.ownerA, candidateId: ids.candidates.foreign,
    contactVersion: 2, actionId: randomUUID(),
  }))
  assert.equal(foreignSearch.outcome_code, 'RESOURCE_NOT_AVAILABLE')
  assert(!JSON.stringify(foreignSearch).includes(ids.targets.student))
  for (const stale of [
    jsonValue(searchSql('STUDENT', { requestVersion: 99, actionId: randomUUID() })),
    jsonValue(searchSql('STUDENT', { contactVersion: 99, actionId: randomUUID() })),
    jsonValue(searchSql('STUDENT', { caseVersion: 99, actionId: randomUUID() })),
    jsonValue(searchSql('STUDENT', { candidateVersion: 99, actionId: randomUUID() })),
    jsonValue(searchSql('STUDENT', { policyRegistryVersion: 99, actionId: randomUUID() })),
  ]) assert(['SOURCE_VERSION_STALE', 'MATCH_POLICY_STALE', 'RESOURCE_NOT_AVAILABLE'].includes(stale.outcome_code))
  psql(`set session_replication_role='replica'; update public.consultation_case_assignment set assignment_version=2 where assignment_id=${u(ids.assignments.a)}; set session_replication_role='origin';`)
  assert.equal(jsonValue(searchSql('STUDENT', { actionId: randomUUID() })).outcome_code, 'SOURCE_VERSION_STALE')
  psql(`set session_replication_role='replica'; update public.consultation_case_assignment set assignment_version=1 where assignment_id=${u(ids.assignments.a)}; set session_replication_role='origin';`)
  console.log('P3C_QA_CANONICAL_STUDENT_SEARCH: PASS')
  console.log('P3C_QA_CANONICAL_GUARDIAN_SEARCH: PASS')
  console.log('P3C_QA_CROSS_CENTER_NONDISCLOSURE: PASS')

  const studentOverrides = { actionId: ids.p2Actions.studentReview }
  const studentReview = jsonValue(createReviewSql('STUDENT', studentOverrides))
  assert.equal(studentReview.status, 'PENDING')
  assertNoP3Execution(studentReview)
  assertEventPair(studentReview)
  ids.reviews.studentCreate = studentReview.resource_id
  const studentDecision = jsonValue(decideReviewSql(
    'STUDENT', ids.reviews.studentCreate, 1, 'PREPARE_CREATE_NEW',
    studentOverrides,
  ))
  assert.equal(studentDecision.status, 'CREATE_NEW_REVIEWED')
  assert.equal(studentDecision.resource_version, 2)
  assertNoP3Execution(studentDecision)
  const studentReservation = jsonValue(reserveSql(
    'STUDENT', ids.reviews.studentCreate, 2,
    studentOverrides,
  ))
  assert.equal(studentReservation.status, 'ACTIVE')
  ids.reservations.student = studentReservation.resource_id
  ids.targets.student = studentReservation.opaque_target_id
  assert.equal(scalar(`select target_adapter_namespace from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.student)};`), 'canonical.student_profile.v1')
  assertNoP3Execution(studentReservation)

  const guardianOverrides = { actionId: ids.p2Actions.guardianReview }
  const guardianReview = jsonValue(createReviewSql('GUARDIAN', guardianOverrides))
  assert.equal(guardianReview.status, 'PENDING')
  assertNoP3Execution(guardianReview)
  assertEventPair(guardianReview)
  ids.reviews.guardianCreate = guardianReview.resource_id
  const guardianDecision = jsonValue(decideReviewSql(
    'GUARDIAN', ids.reviews.guardianCreate, 1, 'PREPARE_CREATE_NEW',
    guardianOverrides,
  ))
  assert.equal(guardianDecision.status, 'CREATE_NEW_REVIEWED')
  assert.equal(guardianDecision.resource_version, 2)
  assertNoP3Execution(guardianDecision)
  const guardianReservation = jsonValue(reserveSql(
    'GUARDIAN', ids.reviews.guardianCreate, 2,
    guardianOverrides,
  ))
  assert.equal(guardianReservation.status, 'ACTIVE')
  ids.reservations.guardian = guardianReservation.resource_id
  ids.targets.guardian = guardianReservation.opaque_target_id
  assert.equal(scalar(`select target_adapter_namespace from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.guardian)};`), 'canonical.guardian_profile.v1')
  assertNoP3Execution(guardianReservation)
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where reservation_id in (${u(ids.reservations.student)},${u(ids.reservations.guardian)}) and status='ACTIVE';`), '2')
  console.log('P3C_QA_P2B_P2C_REGRESSION: PASS')

  // A P3C reviewed plan never consumes reservation or conversion authority.
  const missingRelationship = jsonValue(materializeSql({ relationshipDecision: null, key: 'missing-relationship-key', intent: 'missing-relationship-intent' }))
  assert.equal(missingRelationship.outcome_code, 'RELATIONSHIP_DECISION_REQUIRED')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};`), '0')
  console.log('P3C_QA_RELATIONSHIP_DECISION_REQUIRED: PASS')

  const noTargetPlanOutput = psql(`begin;
set session_replication_role='replica';
update public.crm_identity_match_review
set review_status='REJECTED_MATCH',review_action='REJECT_IDENTITY_ACTION'
where match_review_id in (${u(ids.reviews.studentCreate)},${u(ids.reviews.guardianCreate)});
delete from public.crm_profile_creation_reservation
where reservation_id in (${u(ids.reservations.student)},${u(ids.reservations.guardian)});
set session_replication_role='origin';
${materializeSql({
  relationshipDecision: 'DO_NOT_CREATE_RELATIONSHIP', relationshipType: null,
  primary: null, financial: null, academic: null,
  safeReason: 'EXPLICIT_REVIEWED_NO_CREATE', key: 'no-target-plan-key', intent: 'no-target-plan-intent',
})}
select pg_catalog.string_agg(action_kind,',' order by action_kind) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};
rollback;`).stdout
  assert.equal(jsonFromOutput(noTargetPlanOutput).outcome_code, 'ACTION_PLAN_MATERIALIZED')
  assert.match(noTargetPlanOutput, /DO_NOT_CREATE_GUARDIAN,DO_NOT_CREATE_RELATIONSHIP,DO_NOT_CREATE_STUDENT/)
  const partialNoTargetPlanOutput = psql(`begin;
set session_replication_role='replica';
update public.crm_identity_match_review
set review_status='REJECTED_MATCH',review_action='REJECT_IDENTITY_ACTION'
where match_review_id=${u(ids.reviews.guardianCreate)};
delete from public.crm_profile_creation_reservation
where reservation_id=${u(ids.reservations.guardian)};
set session_replication_role='origin';
${materializeSql({
  relationshipDecision: 'DO_NOT_CREATE_RELATIONSHIP', relationshipType: null,
  primary: null, financial: null, academic: null,
  safeReason: 'EXPLICIT_REVIEWED_NO_CREATE', key: 'partial-no-target-plan-key', intent: 'partial-no-target-plan-intent',
})}
select pg_catalog.string_agg(action_kind,',' order by action_kind) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};
rollback;`).stdout
  assert.equal(jsonFromOutput(partialNoTargetPlanOutput).outcome_code, 'ACTION_PLAN_MATERIALIZED')
  assert.match(partialNoTargetPlanOutput, /CREATE_NEW_STUDENT,DO_NOT_CREATE_GUARDIAN,DO_NOT_CREATE_RELATIONSHIP/)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};`), '0')
  console.log('P3C_QA_EXPLICIT_NO_TARGET_PLANS: PASS')

  const staleMaterializations = [
    jsonValue(materializeSql({ expectedRequestVersion: 99, key: 'stale-request-key', intent: 'stale-request-intent' })),
    jsonValue(materializeSql({ expectedStudentReviewVersion: 99, key: 'stale-review-key', intent: 'stale-review-intent' })),
    transactionalMaterialize(
      `update public.crm_identity_match_review set expires_at=created_at+interval '1 millisecond' where match_review_id=${u(ids.reviews.studentCreate)};`,
      { key: 'expired-review-key', intent: 'expired-review-intent' },
    ),
    transactionalMaterialize(
      `update public.crm_profile_creation_reservation set target_adapter_namespace='synthetic.bad.namespace' where reservation_id=${u(ids.reservations.student)};`,
      { key: 'bad-namespace-key', intent: 'bad-namespace-intent' },
    ),
    transactionalMaterialize(
      `update public.crm_conversion_request set source_contact_version=99 where conversion_request_id=${u(ids.requests.a)};`,
      { key: 'source-drift-key', intent: 'source-drift-intent' },
    ),
    transactionalMaterialize(
      `update public.consultation_case_assignment set assignment_version=2 where assignment_id=${u(ids.assignments.a)};`,
      { key: 'assignment-drift-key', intent: 'assignment-drift-intent' },
    ),
    transactionalMaterialize(
      `update public.center_crm_control set identity_policy_version=2 where center_id=${q(ids.centers.a)};`,
      { key: 'policy-drift-key', intent: 'policy-drift-intent' },
    ),
  ]
  for (const stale of staleMaterializations) {
    assert.equal(stale.ok, false)
    assert.notEqual(stale.outcome_code, 'ACTION_PLAN_MATERIALIZED')
  }
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};`), '0')
  console.log('P3C_QA_STALE_AND_EXPIRED_MATRIX: PASS')

  const beforeFault = scalar(`select pg_catalog.concat_ws('|',(select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)}),(select count(*) from public.crm_idempotency_registry where operation like 'conversion.%action_plan%'),(select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)}),(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)}));`)
  for (const [kind, table, timing] of [
    ['action', 'crm_conversion_action', 'insert'],
    ['idempotency', 'crm_idempotency_registry', 'insert or update'],
  ]) {
    psql(`create function public.p3c_qa_fail_${kind}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3c_qa_${kind}_fault'; end$$;
create trigger p3c_qa_fail_${kind} before ${timing} on public.${table} for each row execute function public.p3c_qa_fail_${kind}();`)
    const fault = psql(materializeSql({ key: `fault-${kind}-key`, intent: `fault-${kind}-intent` }), { expectFailure: true })
    if (fault.status === 0) assert.match(fault.stdout, /SAFE_FAILURE|ACTION_PLAN_MATERIALIZATION_FAILED|RESOURCE_NOT_AVAILABLE/i)
    else assert.match(`${fault.stdout}\n${fault.stderr}`, new RegExp(`p3c_qa_${kind}_fault|action.plan|failure`, 'i'))
    psql(`drop trigger p3c_qa_fail_${kind} on public.${table}; drop function public.p3c_qa_fail_${kind}();`)
    assert.equal(scalar(`select pg_catalog.concat_ws('|',(select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)}),(select count(*) from public.crm_idempotency_registry where operation like 'conversion.%action_plan%'),(select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)}),(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)}));`), beforeFault)
  }
  for (const [kind, table] of [['audit', 'crm_audit_event'], ['outbox', 'crm_outbox_event']]) {
    psql(`create function public.p3c_qa_fail_${kind}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3c_qa_${kind}_fault'; end$$;
create trigger p3c_qa_fail_${kind} before insert on public.${table} for each row execute function public.p3c_qa_fail_${kind}();`)
    const fault = psql(materializeSql({ key: `fault-${kind}-key`, intent: `fault-${kind}-intent` }), { expectFailure: true })
    if (fault.status === 0) assert.match(fault.stdout, /SAFE_FAILURE|ACTION_PLAN_MATERIALIZATION_FAILED|RESOURCE_NOT_AVAILABLE/i)
    else assert.match(`${fault.stdout}\n${fault.stderr}`, new RegExp(`p3c_qa_${kind}_fault|action.plan|failure`, 'i'))
    psql(`drop trigger p3c_qa_fail_${kind} on public.${table}; drop function public.p3c_qa_fail_${kind}();`)
    assert.equal(scalar(`select pg_catalog.concat_ws('|',(select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)}),(select count(*) from public.crm_idempotency_registry where operation like 'conversion.%action_plan%'),(select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)}),(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)}));`), beforeFault)
  }
  console.log('P3C_QA_FAULT_ROLLBACK: PASS')

  const driftHolder = collect(spawnPsql())
  driftHolder.child.stdin.write(`begin; set application_name='p3c_materialize_drift_holder'; select match_review_id from public.crm_identity_match_review where match_review_id=${u(ids.reviews.studentCreate)} for update;\n\\echo P3C_DRIFT_HELD\n`)
  await driftHolder.marker('P3C_DRIFT_HELD')
  const driftContender = collect(spawnPsql())
  driftContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p3c_materialize_drift_contender'; ${materializeSql()}\n\\echo P3C_DRIFT_DONE\n`)
  await waitForLock('p3c_materialize_drift_contender')
  driftHolder.child.stdin.end('rollback; \\q\n')
  await driftHolder.done
  const driftResult = await driftContender.done
  assert.equal(jsonFromOutput(driftResult.stdout).replayed, false)
  console.log('P3C_QA_MATERIALIZE_VS_SOURCE_DRIFT_RACE: PASS')

  const concurrentMaterialize = materializeSql()
  const holder = collect(spawnPsql())
  holder.child.stdin.write(`begin; set statement_timeout='20s'; set application_name='p3c_materialize_holder'; ${concurrentMaterialize}\n\\echo P3C_MATERIALIZE_HELD\n`)
  await holder.marker('P3C_MATERIALIZE_HELD')
  const contender = collect(spawnPsql())
  contender.child.stdin.end(`set statement_timeout='20s'; set application_name='p3c_materialize_contender'; ${concurrentMaterialize}\n\\echo P3C_MATERIALIZE_DONE\n`)
  await waitForLock('p3c_materialize_contender')
  holder.child.stdin.end('commit; \\q\n')
  const holderResult = await holder.done
  const contenderResult = await contender.done
  assert.match(holderResult.stdout, /ACTION_PLAN_MATERIALIZATION|ACTION_PLAN_MATERIALIZED/i)
  assert.match(contenderResult.stdout, /"replayed"\s*:\s*true/i)
  const materializeEventCounts = scalar(`select (select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)})::text||'|'||(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)})::text;`)
  const materialized = jsonValue(materializeSql())
  assert.equal(materialized.ok, true)
  assert.equal(materialized.replayed, true)
  assert.match(materialized.outcome_code, /ACTION_PLAN_MATERIALIZED|ACTION_PLAN_MATERIALIZATION/)
  ids.actions.guardian = materialized.guardian_action_id
  ids.actions.student = materialized.student_action_id
  ids.actions.relationship = materialized.relationship_action_id
  assert.equal(scalar(`select (select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)})::text||'|'||(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)})::text;`), materializeEventCounts)
  assert.equal(ids.actions.relationship, scalar(`select conversion_action_id from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and identity_kind is null and action_kind in ('CREATE_RELATIONSHIP','REUSE_EXISTING_RELATIONSHIP','UPDATE_APPROVED_RELATIONSHIP_ROLE','REQUIRE_RELATIONSHIP_REVIEW','DO_NOT_CREATE_RELATIONSHIP');`))
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and status='PROPOSED' and action_version=1;`), '3')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where reservation_id in (${u(ids.reservations.student)},${u(ids.reservations.guardian)}) and status='ACTIVE';`), '2')
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority where conversion_request_id=${u(ids.requests.a)};`), '0')
  const materializeConflict = jsonValue(materializeSql({ intent: 'materialize-changed-intent' }))
  assert.equal(materializeConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('P3C_QA_REAL_LOCK_WAIT_OBSERVED: PASS')
  console.log('P3C_QA_CONCURRENCY: PASS')
  console.log('P3C_QA_PLAN_MATERIALIZATION: PASS')
  console.log('P3C_QA_PLAN_MATERIALIZATION_EXACT_REPLAY: PASS')
  console.log('P3C_QA_PLAN_MATERIALIZATION_IDEMPOTENCY_CONFLICT: PASS')
  console.log('P3C_QA_NO_RESERVATION_CONSUME: PASS')
  console.log('P3C_QA_NO_AUTHORITY_CONSUME: PASS')

  psql(`create function public.p3c_qa_fail_finalize_outbox() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3c_qa_finalize_outbox_fault'; end$$;
create trigger p3c_qa_fail_finalize_outbox before insert on public.crm_outbox_event for each row execute function public.p3c_qa_fail_finalize_outbox();`)
  const finalizeFault = psql(finalizeSql({ key: 'finalize-fault-key', intent: 'finalize-fault-intent' }), { expectFailure: true })
  if (finalizeFault.status === 0) assert.match(finalizeFault.stdout, /SAFE_FAILURE|ACTION_PLAN_FINALIZATION_FAILED|RESOURCE_NOT_AVAILABLE/i)
  else assert.match(`${finalizeFault.stdout}\n${finalizeFault.stderr}`, /p3c_qa_finalize_outbox_fault|action.plan|failure/i)
  psql(`drop trigger p3c_qa_fail_finalize_outbox on public.crm_outbox_event; drop function public.p3c_qa_fail_finalize_outbox();`)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and status='PROPOSED' and action_version=1;`), '3')

  const expiryHolder = collect(spawnPsql())
  expiryHolder.child.stdin.write(`begin; set application_name='p3c_finalize_expiry_holder'; select reservation_id from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.student)} for update;\n\\echo P3C_EXPIRY_HELD\n`)
  await expiryHolder.marker('P3C_EXPIRY_HELD')
  const expiryContender = collect(spawnPsql())
  expiryContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p3c_finalize_expiry_contender'; ${finalizeSql()}\n\\echo P3C_EXPIRY_DONE\n`)
  await waitForLock('p3c_finalize_expiry_contender')
  expiryHolder.child.stdin.end('rollback; \\q\n')
  await expiryHolder.done
  const expiryResult = await expiryContender.done
  const finalized = jsonFromOutput(expiryResult.stdout)
  assert.equal(finalized.ok, true)
  assert.match(finalized.outcome_code, /ACTION_PLAN_FINALIZED|ACTION_PLAN_FINALIZATION/)
  assert.equal(finalized.replayed, false)
  assert.equal(finalized.action_count, 3)
  assert.equal(finalized.max_action_version, 2)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and status='REVIEWED' and action_version=2;`), '3')
  assert.match(finalized.finalized_action_set_digest, /^\\x[0-9a-f]{64}$/i)
  const finalizedDigest = scalar(`select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.a)},'REVIEWED'),'hex');`)
  assert.match(finalizedDigest, /^[0-9a-f]{64}$/)
  const finalizeEventCounts = scalar(`select (select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)})::text||'|'||(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)})::text;`)
  const finalizeHolder = collect(spawnPsql())
  finalizeHolder.child.stdin.write(`begin; set application_name='p3c_finalize_holder'; ${finalizeSql()}\n\\echo P3C_FINALIZE_HELD\n`)
  await finalizeHolder.marker('P3C_FINALIZE_HELD')
  const finalizeContender = collect(spawnPsql())
  finalizeContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p3c_finalize_contender'; ${finalizeSql()}\n\\echo P3C_FINALIZE_DONE\n`)
  await waitForLock('p3c_finalize_contender')
  finalizeHolder.child.stdin.end('commit; \\q\n')
  const finalizeHolderResult = await finalizeHolder.done
  const finalizeContenderResult = await finalizeContender.done
  assert.equal(jsonFromOutput(finalizeHolderResult.stdout).replayed, true)
  const finalizeReplay = jsonFromOutput(finalizeContenderResult.stdout)
  assert.equal(finalizeReplay.replayed, true)
  assert.equal(finalizeReplay.correlation_id, finalized.correlation_id)
  assert.equal(scalar(`select (select count(*) from public.crm_audit_event where resource_id=${u(ids.requests.a)})::text||'|'||(select count(*) from public.crm_outbox_event where aggregate_id=${u(ids.requests.a)})::text;`), finalizeEventCounts)
  const finalizeConflict = jsonValue(finalizeSql({ intent: 'finalize-changed-intent' }))
  assert.equal(finalizeConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority where status='CONSUMED';`), '0')
  console.log('P3C_QA_PLAN_FINALIZATION: PASS')
  console.log('P3C_QA_REVIEWED_DIGEST_POST_VERSION_INCREMENT: PASS')
  console.log('P3C_QA_PLAN_FINALIZATION_EXACT_REPLAY: PASS')
  console.log('P3C_QA_PLAN_FINALIZATION_IDEMPOTENCY_CONFLICT: PASS')
  console.log('P3C_QA_FINALIZE_VS_EXPIRY_RACE: PASS')
  console.log('P3C_QA_FINALIZE_VS_FINALIZE_RACE: PASS')
  console.log('P3C_QA_AUDIT_OUTBOX_ATOMIC: PASS')

  const securityControl = jsonValue(securitySyncSql())
  assert.equal(securityControl.outcome_code, 'ACCOUNT_SECURITY_CONTROL_REGISTERED')
  assert.equal(securityControl.control_version, 1)
  const stepUp = jsonValue(stepUpSql(randomUUID()))
  assert.equal(stepUp.outcome_code, 'STEP_UP_ASSERTION_ISSUED')
  const authority = jsonValue(issueAuthoritySql(stepUp.step_up_assertion_id))
  assert.equal(authority.outcome_code, 'CONVERSION_AUTHORITY_ISSUED')
  assert.equal(authority.request_status, 'APPROVED')
  assert.equal(authority.request_version, 3)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and status='APPROVED' and action_version=3;`), '3')
  assert.equal(scalar(`select (environment_fingerprint=${digest('p3c-caller-supplied-authority-environment')})::text from public.crm_conversion_authority where conversion_authority_id=${u(authority.conversion_authority_id)};`), 'true')
  assert.equal(scalar(`select (environment_fingerprint=public.f23_3e_p3c_internal_crypto_environment_fingerprint())::text from public.crm_conversion_authority where conversion_authority_id=${u(authority.conversion_authority_id)};`), 'false')
  assert.equal(scalar(`select status from public.crm_conversion_authority where conversion_authority_id=${u(authority.conversion_authority_id)};`), 'ISSUED')
  console.log('P3C_QA_P3B_COMPATIBILITY: PASS')

  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and opaque_target_id=(select preallocated_target_id from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.student)});`), '1')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)} and opaque_target_id=(select preallocated_target_id from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.guardian)});`), '1')

  const createStudentSql = `select row_to_json(x) from public.f23_3e_p3c_internal_create_student_target(${u(ids.actions.student)},${u(ids.users.ownerA)},${q(evidence.studentName)},${q(evidence.studentBirth)}::date) x;`
  psql(`create function public.p3c_qa_fail_student_target() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3c_qa_student_target_fault'; end$$;
create trigger p3c_qa_fail_student_target before insert on public.student_profile for each row execute function public.p3c_qa_fail_student_target();`)
  expectSqlFailure(createStudentSql, /p3c_qa_student_target_fault/i)
  psql(`drop trigger p3c_qa_fail_student_target on public.student_profile; drop function public.p3c_qa_fail_student_target();`)
  assert.equal(scalar(`select count(*) from public.student_profile where student_id=${u(ids.targets.student)};`), '0')
  const studentHolder = collect(spawnPsql())
  studentHolder.child.stdin.write(`begin; set application_name='p3c_student_target_holder'; ${createStudentSql}\n\\echo P3C_STUDENT_TARGET_HELD\n`)
  await studentHolder.marker('P3C_STUDENT_TARGET_HELD')
  const studentContender = collect(spawnPsql())
  studentContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p3c_student_target_contender'; ${createStudentSql}\n\\echo P3C_STUDENT_TARGET_DONE\n`)
  await waitForLock('p3c_student_target_contender')
  studentHolder.child.stdin.end('commit; \\q\n')
  const studentHolderResult = await studentHolder.done
  const studentContenderResult = await studentContender.done
  const studentCreated = jsonFromOutput(studentHolderResult.stdout)
  assert.deepEqual(jsonFromOutput(studentContenderResult.stdout), studentCreated)
  assert.equal(studentCreated.student_id, ids.targets.student)
  assert.equal(studentCreated.student_version, 1)
  assert.equal(scalar(`select (student_id=(select preallocated_target_id from public.crm_profile_creation_reservation where reservation_id=${u(ids.reservations.student)}))::text from public.student_profile where student_id=${u(ids.targets.student)};`), 'true')
  assert.equal(scalar(`select (learning_lifecycle_status is null)::text from public.student_profile where student_id=${u(ids.targets.student)};`), 'true')
  const studentReplay = jsonValue(createStudentSql)
  assert.deepEqual(studentReplay, studentCreated)

  const createGuardianSql = `select row_to_json(x) from public.f23_3e_p3c_internal_create_guardian_target(${u(ids.actions.guardian)},${u(ids.users.ownerA)}) x;`
  replaceContactEnvelope(ids.contacts.a, '43'.repeat(16), 1)
  expectSqlFailure(createGuardianSql, /GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE/i)
  replaceContactEnvelope(ids.contacts.a, sourceEnvelopeHex, 2)
  assert.equal(scalar(`select count(*) from public.guardian_profile where guardian_id=${u(ids.targets.guardian)};`), '0')
  const guardianHolder = collect(spawnPsql())
  guardianHolder.child.stdin.write(`begin; set application_name='p3c_guardian_target_holder'; ${createGuardianSql}\n\\echo P3C_GUARDIAN_TARGET_HELD\n`)
  await guardianHolder.marker('P3C_GUARDIAN_TARGET_HELD')
  const guardianDriftContender = collect(spawnPsql())
  guardianDriftContender.child.stdin.end(`begin; set statement_timeout='20s'; set application_name='p3c_guardian_contact_drift_contender'; set session_replication_role='replica'; update public.crm_contact set contact_version=contact_version where crm_contact_id=${u(ids.contacts.a)}; rollback;\n\\echo P3C_GUARDIAN_DRIFT_DONE\n`)
  await waitForLock('p3c_guardian_contact_drift_contender')
  guardianHolder.child.stdin.end('commit; \\q\n')
  const guardianHolderResult = await guardianHolder.done
  const guardianDriftResult = await guardianDriftContender.done
  assert.match(guardianDriftResult.stdout, /P3C_GUARDIAN_DRIFT_DONE/)
  const guardianCreated = jsonFromOutput(guardianHolderResult.stdout)
  assert.equal(guardianCreated.guardian_id, ids.targets.guardian)
  assert.equal(guardianCreated.guardian_version, 1)
  const persistedGuardianEnvelope = scalar(`select pg_catalog.encode(protected_contact_methods_ciphertext,'hex') from public.guardian_profile where guardian_id=${u(ids.targets.guardian)};`)
  assert(persistedGuardianEnvelope.startsWith(Buffer.from('IC3GTE01').toString('hex')))
  assert.notEqual(persistedGuardianEnvelope, sourceEnvelopeHex)
  assert.equal(scalar(`select public.f23_3e_p3c_internal_validate_guardian_target_evidence(${q(ids.centers.a)},${u(ids.targets.guardian)},1)::text;`), 'true')
  assert.equal(scalar(`select public.f23_3e_p3c_internal_validate_guardian_target_evidence(${q(ids.centers.b)},${u(ids.targets.guardian)},1)::text;`), 'false')
  assert.equal(scalar(`select count(*) from auth.users where id not in (${Object.values(ids.users).map(u).join(',')});`), '0')
  assert.equal(scalar(`select count(*) from public.center_members where user_id not in (${Object.values(ids.users).map(u).join(',')});`), '0')
  assert.equal(scalar(`select count(*) from information_schema.columns where table_schema='public' and table_name='crm_audit_event' and column_name in ('safe_payload','display_name','phone','email','contact_methods');`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where safe_payload::text like '%P3C-SYNTHETIC-CONTACT-EVIDENCE-V1%';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where coalesce(p3_result_snapshot::text,'') like '%P3C-SYNTHETIC-CONTACT-EVIDENCE-V1%';`), '0')
  console.log('P3C_QA_STUDENT_CREATE_HELPER: PASS')
  console.log('P3C_QA_GUARDIAN_CREATE_HELPER: PASS')
  console.log('P3C_QA_TARGET_HELPER_SAME_MUTEX_RACE: PASS')
  console.log('P3C_QA_GUARDIAN_CREATE_CONTACT_DRIFT_RACE: PASS')
  console.log('P3C_QA_TARGET_ID_EQUALS_RESERVATION_ID: PASS')
  console.log('P3C_QA_STUDENT_UNENROLLED_NULL_LIFECYCLE: PASS')
  console.log('P3C_QA_GUARDIAN_NOT_CONTACT: PASS')

  // No identity uniqueness constraint may collapse two same-name/birth students.
  psql(`insert into public.student_profile(
  student_id,center_id,display_name,birth_evidence_protected,profile_status,
  learning_lifecycle_status,identity_policy_registry_id,normalization_version,
  match_policy_version,minimum_evidence_policy_version,name_lookup_digest,
  birth_lookup_digest,identity_evidence_digest,student_version,created_from_case_id,
  created_from_candidate_id,created_from_request_id,created_from_action_id,created_by_user_id
)
select ${u(ids.targets.studentSecond)},center_id,display_name,birth_evidence_protected,'ACTIVE',null,
  identity_policy_registry_id,normalization_version,match_policy_version,
  minimum_evidence_policy_version,name_lookup_digest,birth_lookup_digest,
  ${digest('p3c-second-student-identity')},1,created_from_case_id,${u(ids.candidates.sameName)},
  created_from_request_id,created_from_action_id,created_by_user_id
from public.student_profile where student_id=${u(ids.targets.student)};`)
  assert.equal(scalar(`select count(*) from public.student_profile where center_id=${q(ids.centers.a)} and display_name=${q(evidence.studentName)};`), '2')

  const secondGuardianEnvelope = scalar(`select pg_catalog.encode(protected_contact_methods_ciphertext,'hex') from public.f23_3e_p3c_internal_protect_target_evidence(${q(ids.centers.a)},${u(ids.contacts.a)},2,${u(ids.targets.guardianSecond)});`)
  psql(`insert into public.guardian_profile(
  guardian_id,center_id,display_name,protected_contact_methods_ciphertext,
  contact_methods_crypto_version,normalized_lookup_digests,normalization_version,
  identity_evidence_digest,guardian_status,guardian_version,created_from_contact_id,
  created_from_case_id,created_from_request_id,created_from_action_id,created_by_user_id
)
select ${u(ids.targets.guardianSecond)},center_id,display_name,pg_catalog.decode(${q(secondGuardianEnvelope)},'hex'),
  1,normalized_lookup_digests,normalization_version,${digest('p3c-second-guardian-identity')},
  'ACTIVE',1,created_from_contact_id,created_from_case_id,created_from_request_id,
  created_from_action_id,created_by_user_id
from public.guardian_profile where guardian_id=${u(ids.targets.guardian)};`)
  assert.equal(scalar(`select count(*) from public.guardian_profile where center_id=${q(ids.centers.a)} and display_name=${q(evidence.guardianName)};`), '2')
  console.log('P3C_QA_STUDENT_PROFILE_SCHEMA: PASS')
  console.log('P3C_QA_SAME_NAME_BIRTH_NOT_UNIQUE: PASS')
  console.log('P3C_QA_GUARDIAN_PROFILE_SCHEMA: PASS')

  const searchHolder = collect(spawnPsql())
  searchHolder.child.stdin.write(`begin; set application_name='p3c_search_target_holder'; ${searchSql('STUDENT', { requestVersion: 3, actionId: randomUUID() })}\n\\echo P3C_SEARCH_TARGET_HELD\n`)
  await searchHolder.marker('P3C_SEARCH_TARGET_HELD')
  const targetMutationContender = collect(spawnPsql())
  targetMutationContender.child.stdin.end(`begin; set statement_timeout='20s'; set application_name='p3c_search_target_mutation_contender'; set session_replication_role='replica'; update public.student_profile set student_version=student_version where student_id=${u(ids.targets.student)}; rollback;\n\\echo P3C_TARGET_MUTATION_DONE\n`)
  await waitForLock('p3c_search_target_mutation_contender')
  searchHolder.child.stdin.end('commit; \\q\n')
  await searchHolder.done
  const targetMutationResult = await targetMutationContender.done
  assert.match(targetMutationResult.stdout, /P3C_TARGET_MUTATION_DONE/)
  console.log('P3C_QA_SEARCH_VS_TARGET_MUTATION_RACE: PASS')

  const canonicalStudentSearch = jsonValue(searchSql('STUDENT', { requestVersion: 3, actionId: randomUUID() }))
  assert.equal(canonicalStudentSearch.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert(canonicalStudentSearch.candidates.length >= 2)
  assert(canonicalStudentSearch.candidates.filter((candidate) => candidate.target_adapter_namespace === 'canonical.student_profile.v1').length >= 2)
  assert(canonicalStudentSearch.candidates.every((candidate) => candidate.reuse_eligible === false))
  const studentDetail = jsonValue(detailSql('STUDENT', ids.targets.student, 1, { requestVersion: 3, actionId: randomUUID() }))
  assert.equal(studentDetail.target_adapter_namespace, 'canonical.student_profile.v1')
  assert.equal(studentDetail.reuse_eligible, false)
  const canonicalGuardianSearch = jsonValue(searchSql('GUARDIAN', { requestVersion: 3, actionId: randomUUID() }))
  assert.equal(canonicalGuardianSearch.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert(canonicalGuardianSearch.candidates.length >= 2)
  assert(canonicalGuardianSearch.candidates.every((candidate) => candidate.reuse_eligible === false))
  const guardianDetail = jsonValue(detailSql('GUARDIAN', ids.targets.guardian, 1, { requestVersion: 3, actionId: randomUUID() }))
  assert.equal(guardianDetail.target_adapter_namespace, 'canonical.guardian_profile.v1')
  assert.equal(guardianDetail.reuse_eligible, false)
  console.log('P3C_QA_CANONICAL_STUDENT_SEARCH: PASS')
  console.log('P3C_QA_CANONICAL_GUARDIAN_SEARCH: PASS')

  psql(`insert into public.center_cloud_entities(id,center_id,entity_type,local_id,payload,source_module,source_version) values
(${u(randomUUID())},${q(ids.centers.a)},'student','p3c-synthetic-legacy-student',${q(JSON.stringify({ id: 'p3c-synthetic-legacy-student', fullName: evidence.studentName, birthDate: evidence.studentBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1');`)
  const coexistSearch = jsonValue(searchSql('STUDENT', { requestVersion: 3, actionId: randomUUID() }))
  assert(coexistSearch.candidates.some((candidate) => candidate.target_adapter_namespace === 'canonical.student_profile.v1'))
  assert(coexistSearch.candidates.filter((candidate) => candidate.target_adapter_namespace !== 'canonical.student_profile.v1').every((candidate) => candidate.reuse_eligible === false))
  console.log('P3C_QA_LEGACY_STUDENT_REUSE_DENIED: PASS')

  // The committed source-target binding is deliberately not exposed as an RPC.
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3c%' and p.proname like '%binding%' and not p.proname like '%internal%';`), '0')
  psql(`set session_replication_role='replica';
update public.crm_identity_match_review set
  match_outcome='EXACT_REVIEWED_MATCH',review_status='EXACT_REVIEWED_MATCH',
  review_action='REUSE_EXISTING',target_adapter_namespace='canonical.student_profile.v1',
  opaque_target_id=${u(ids.targets.student)},target_version=1,
  reviewer_user_id=${u(ids.users.ownerA)},reviewer_authority_version=1,decided_at=now()
where match_review_id=${u(ids.reviews.studentCreate)};
update public.crm_identity_match_review set
  match_outcome='EXACT_REVIEWED_MATCH',review_status='EXACT_REVIEWED_MATCH',
  review_action='REUSE_EXISTING',target_adapter_namespace='canonical.guardian_profile.v1',
  opaque_target_id=${u(ids.targets.guardian)},target_version=1,
  reviewer_user_id=${u(ids.users.ownerA)},reviewer_authority_version=1,decided_at=now()
where match_review_id=${u(ids.reviews.guardianCreate)};
set session_replication_role='origin';`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.a)},${u(ids.candidates.student)},${u(ids.targets.student)},1,${u(ids.reviews.studentCreate)});`), 'false')
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_guardian(${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.targets.guardian)},1,${u(ids.reviews.guardianCreate)});`), 'false')
  console.log('P3C_QA_BINDING_REQUIRED_FOR_REUSE: PASS')

  psql(`begin; select pg_catalog.set_config('ichess.p3c_binding_write','on',true);
insert into public.crm_identity_target_binding(
  center_id,identity_kind,source_candidate_student_id,student_id,binding_status,
  binding_version,source_version_at_binding,target_version_at_binding,
  originating_request_id,originating_action_id,originating_review_id
) values (
  ${q(ids.centers.a)},'STUDENT',${u(ids.candidates.student)},${u(ids.targets.student)},'ACTIVE',1,2,1,
  ${u(ids.requests.a)},${u(ids.actions.student)},${u(ids.reviews.studentCreate)}
); commit;
begin; select pg_catalog.set_config('ichess.p3c_binding_write','on',true);
insert into public.crm_identity_target_binding(
  center_id,identity_kind,source_contact_id,guardian_id,binding_status,
  binding_version,source_version_at_binding,target_version_at_binding,
  originating_request_id,originating_action_id,originating_review_id
) values (
  ${q(ids.centers.a)},'GUARDIAN',${u(ids.contacts.a)},${u(ids.targets.guardian)},'ACTIVE',1,2,1,
  ${u(ids.requests.a)},${u(ids.actions.guardian)},${u(ids.reviews.guardianCreate)}
); commit;`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.a)},${u(ids.candidates.student)},${u(ids.targets.student)},1,${u(ids.reviews.studentCreate)});`), 'true')
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_guardian(${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.targets.guardian)},1,${u(ids.reviews.guardianCreate)});`), 'true')
  const boundStudentSearch = jsonValue(searchSql('STUDENT', { requestVersion: 3, actionId: randomUUID() }))
  assert(boundStudentSearch.candidates.some((candidate) => candidate.opaque_target_id === ids.targets.student && candidate.reuse_eligible === true))
  const boundGuardianSearch = jsonValue(searchSql('GUARDIAN', { requestVersion: 3, actionId: randomUUID() }))
  assert(boundGuardianSearch.candidates.some((candidate) => candidate.opaque_target_id === ids.targets.guardian && candidate.reuse_eligible === true))

  const reusePlanOutput = psql(`begin;
set session_replication_role='replica';
insert into public.guardian_student_relationship(
  relationship_id,center_id,guardian_id,student_id,relationship_type,is_primary_contact,
  financial_contact_role,academic_contact_role,status,relationship_version,
  created_from_request_id,created_from_action_id,created_by_user_id
) values (
  ${u(ids.relationships.main)},${q(ids.centers.a)},${u(ids.targets.guardian)},${u(ids.targets.student)},
  'PARENT',true,'PRIMARY','PRIMARY','ACTIVE',1,
  ${u(ids.requests.a)},${u(ids.actions.relationship)},${u(ids.users.ownerA)}
);
delete from public.crm_outbox_event where aggregate_kind='crm_conversion_action_plan' and aggregate_id=${u(ids.requests.a)};
delete from public.crm_audit_event where resource_kind='crm_conversion_action_plan' and resource_id=${u(ids.requests.a)};
delete from public.crm_idempotency_registry where request_id=${u(ids.requests.a)} and operation in ('conversion.materialize_action_plan','conversion.finalize_action_plan');
delete from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};
update public.crm_conversion_request set status='READY_FOR_REVIEW',request_version=2,updated_at=now() where conversion_request_id=${u(ids.requests.a)};
set session_replication_role='origin';
${materializeSql({
  relationshipDecision: 'REUSE_EXISTING_RELATIONSHIP',
  safeReason: 'RELATIONSHIP_ALREADY_CURRENT',
  key: 'reuse-plan-key', intent: 'reuse-plan-intent',
})}
select pg_catalog.string_agg(action_kind,',' order by action_kind) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.a)};
rollback;`).stdout
  assert.equal(jsonFromOutput(reusePlanOutput).outcome_code, 'ACTION_PLAN_MATERIALIZED')
  assert.match(reusePlanOutput, /REUSE_EXISTING_RELATIONSHIP,REUSE_REVIEWED_GUARDIAN,REUSE_REVIEWED_STUDENT/)
  assert.equal(scalar(`select status from public.crm_conversion_request where conversion_request_id=${u(ids.requests.a)};`), 'APPROVED')
  assert.equal(scalar(`select count(*) from public.guardian_student_relationship;`), '0')
  console.log('P3C_QA_REUSE_REUSE_RELATIONSHIP_PLAN: PASS')

  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.b)},${u(ids.candidates.student)},${u(ids.targets.student)},1,${u(ids.reviews.studentCreate)});`), 'false')
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_guardian(${q(ids.centers.b)},${u(ids.contacts.a)},${u(ids.targets.guardian)},1,${u(ids.reviews.guardianCreate)});`), 'false')
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.a)},${u(ids.candidates.student)},${u(ids.targets.student)},2,${u(ids.reviews.studentCreate)});`), 'false')
  psql(`set session_replication_role='replica'; update public.crm_contact set contact_version=3 where crm_contact_id=${u(ids.contacts.a)}; set session_replication_role='origin';`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_guardian(${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.targets.guardian)},1,${u(ids.reviews.guardianCreate)});`), 'false')
  psql(`set session_replication_role='replica'; update public.crm_contact set contact_version=2 where crm_contact_id=${u(ids.contacts.a)}; set session_replication_role='origin';`)
  psql(`set session_replication_role='replica'; update public.crm_identity_target_binding set source_version_at_binding=999 where identity_kind='STUDENT' and source_candidate_student_id=${u(ids.candidates.student)}; set session_replication_role='origin';`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.a)},${u(ids.candidates.student)},${u(ids.targets.student)},1,${u(ids.reviews.studentCreate)});`), 'false')
  psql(`set session_replication_role='replica'; update public.crm_identity_target_binding set source_version_at_binding=2 where identity_kind='STUDENT' and source_candidate_student_id=${u(ids.candidates.student)}; set session_replication_role='origin';`)
  psql(`begin; select pg_catalog.set_config('ichess.p3c_binding_write','on',true); update public.crm_identity_target_binding set binding_status='REVOKED',binding_version=binding_version+1 where identity_kind='STUDENT' and source_candidate_student_id=${u(ids.candidates.student)}; commit;`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_student(${q(ids.centers.a)},${u(ids.candidates.student)},${u(ids.targets.student)},1,${u(ids.reviews.studentCreate)});`), 'false')
  psql(`begin; select pg_catalog.set_config('ichess.p3c_binding_write','on',true); update public.crm_identity_target_binding set binding_status='SUPERSEDED',binding_version=binding_version+1 where identity_kind='GUARDIAN' and source_contact_id=${u(ids.contacts.a)}; commit;`)
  assert.equal(scalar(`select reuse_eligible::text from public.f23_3e_p3c_internal_resolve_reusable_guardian(${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.targets.guardian)},1,${u(ids.reviews.guardianCreate)});`), 'false')
  console.log('P3C_QA_BINDING_SHAPE: PASS')
  console.log('P3C_QA_STUDENT_REUSE_BINDING: PASS')
  console.log('P3C_QA_GUARDIAN_REUSE_BINDING: PASS')

  // Relationship protected writer: exact-center M:N, uniqueness, primary and terminality.
  psql(`create function public.p3c_qa_fail_relationship_target() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3c_qa_relationship_target_fault'; end$$;
create trigger p3c_qa_fail_relationship_target before insert on public.guardian_student_relationship for each row execute function public.p3c_qa_fail_relationship_target();`)
  expectSqlFailure(`select * from public.f23_3e_p3c_internal_upsert_guardian_student_relationship(${u(ids.actions.relationship)},${u(ids.users.ownerA)});`, /p3c_qa_relationship_target_fault/i)
  psql(`drop trigger p3c_qa_fail_relationship_target on public.guardian_student_relationship; drop function public.p3c_qa_fail_relationship_target();`)
  assert.equal(scalar(`select count(*) from public.guardian_student_relationship;`), '0')
  const relationshipCreated = jsonValue(`select row_to_json(x) from public.f23_3e_p3c_internal_upsert_guardian_student_relationship(${u(ids.actions.relationship)},${u(ids.users.ownerA)}) x;`)
  assert.equal(relationshipCreated.outcome_code, 'RELATIONSHIP_CREATED')
  assert.equal(relationshipCreated.relationship_version, 1)
  ids.relationships.main = relationshipCreated.relationship_id
  expectSqlFailure(`select * from public.f23_3e_p3c_internal_upsert_guardian_student_relationship(${u(ids.actions.relationship)},${u(ids.users.ownerA)});`, /unique|duplicate|one_active_equivalent/i)
  psql(`begin; select pg_catalog.set_config('ichess.p3c_relationship_write','on',true);
insert into public.guardian_student_relationship(
  relationship_id,center_id,guardian_id,student_id,relationship_type,is_primary_contact,
  financial_contact_role,academic_contact_role,status,relationship_version,
  created_from_request_id,created_from_action_id,created_by_user_id
) values (
  ${u(ids.relationships.second)},${q(ids.centers.a)},${u(ids.targets.guardian)},${u(ids.targets.studentSecond)},
  'CAREGIVER',false,'SECONDARY','SECONDARY','ACTIVE',1,
  ${u(ids.requests.a)},${u(ids.actions.relationship)},${u(ids.users.ownerA)}
); commit;`)
  expectSqlFailure(`begin; select pg_catalog.set_config('ichess.p3c_relationship_write','on',true); insert into public.guardian_student_relationship(center_id,guardian_id,student_id,relationship_type,is_primary_contact,financial_contact_role,academic_contact_role,status,relationship_version,created_from_request_id,created_from_action_id,created_by_user_id) values (${q(ids.centers.a)},${u(ids.targets.guardianSecond)},${u(ids.targets.student)},'LEGAL_GUARDIAN',true,'PRIMARY','PRIMARY','ACTIVE',1,${u(ids.requests.a)},${u(ids.actions.relationship)},${u(ids.users.ownerA)}); commit;`, /unique|duplicate|one_active_primary/i)
  expectSqlFailure(`begin; select pg_catalog.set_config('ichess.p3c_relationship_write','on',true); insert into public.guardian_student_relationship(center_id,guardian_id,student_id,relationship_type,is_primary_contact,financial_contact_role,academic_contact_role,status,relationship_version,created_from_request_id,created_from_action_id,created_by_user_id) values (${q(ids.centers.b)},${u(ids.targets.guardian)},${u(ids.targets.student)},'OTHER_REVIEWED',false,'NONE','NONE','ACTIVE',1,${u(ids.requests.a)},${u(ids.actions.relationship)},${u(ids.users.ownerA)}); commit;`, /foreign key|exact.center|not present/i)
  psql(`begin; select pg_catalog.set_config('ichess.p3c_relationship_write','on',true); update public.guardian_student_relationship set status='ENDED',relationship_version=2 where relationship_id=${u(ids.relationships.main)}; commit;`)
  assert.equal(scalar(`select status||':'||relationship_version||':'||(effective_to is not null)::text from public.guardian_student_relationship where relationship_id=${u(ids.relationships.main)};`), 'ENDED:2:true')
  expectSqlFailure(`begin; select pg_catalog.set_config('ichess.p3c_relationship_write','on',true); update public.guardian_student_relationship set status='ACTIVE',effective_to=null,relationship_version=3 where relationship_id=${u(ids.relationships.main)}; commit;`, /terminal_relationship_cannot_reactivate/i)
  console.log('P3C_QA_RELATIONSHIP_EXACT_CENTER: PASS')
  console.log('P3C_QA_RELATIONSHIP_ACTIVE_EQUIVALENT_BACKSTOP: PASS')
  console.log('P3C_QA_RELATIONSHIP_PRIMARY_BACKSTOP: PASS')
  console.log('P3C_QA_RELATIONSHIP_LIFECYCLE: PASS')

  // Direct roles and REST cannot see protected aggregates; only the two P3C RPCs exist.
  expectSqlFailure(`set role anon; select * from public.student_profile;`, /permission denied/i)
  expectSqlFailure(`set role authenticated; select * from public.guardian_profile;`, /permission denied/i)
  expectSqlFailure(`set role service_role; select * from public.crm_identity_target_binding;`, /permission denied/i)
  expectSqlFailure(`set role service_role; select public.f23_3e_p3c_internal_crypto_environment_fingerprint();`, /permission denied/i)
  for (const [apikey, bearer] of [
    [localStatus.ANON_KEY, localStatus.ANON_KEY],
    [localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY],
  ]) {
    for (const table of tableNames) {
      const denied = await fetch(`${localStatus.API_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey, Authorization: `Bearer ${bearer}` },
      })
      assert([401, 403, 404].includes(denied.status), `${table} REST status ${denied.status}`)
    }
  }
  const anonMaterialize = await postRpc('f23_3e_p3c_materialize_reviewed_action_pair', localStatus.ANON_KEY, localStatus.ANON_KEY, {
    p_actor_user_id: ids.users.ownerA,
    p_conversion_request_id: ids.requests.a,
    p_expected_request_version: 2,
    p_guardian_match_review_id: ids.reviews.guardianCreate,
    p_expected_guardian_review_version: 2,
    p_student_match_review_id: ids.reviews.studentCreate,
    p_expected_student_review_version: 2,
    p_relationship_action_id: ids.actions.relationship,
    p_relationship_decision: 'CREATE_RELATIONSHIP',
    p_relationship_type: 'PARENT', p_is_primary_contact: true,
    p_financial_contact_role: 'PRIMARY', p_academic_contact_role: 'PRIMARY',
    p_safe_reason_code: 'P3C_QA_REVIEWED', p_relationship_policy_version: 1,
    p_operation_intent_digest: `\\x${'91'.repeat(32)}`,
    p_idempotency_key_digest: `\\x${'92'.repeat(32)}`,
    p_idempotency_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })
  assert([401, 403, 404].includes(anonMaterialize.status), `anon materialize status ${anonMaterialize.status}`)
  console.log('P3C_QA_DIRECT_API_FAIL_CLOSED: PASS')

  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p3c_qa_%';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p3c_qa_%';`), '0')
  console.log('P3C_QA_MATERIALIZATION_CREATE_MATRIX: PASS')
  console.log('P3C_QA_MATERIALIZATION_REUSE_MATRIX: PASS')
  console.log('P3C_QA_MATERIALIZATION_NO_TARGET_MATRIX: PASS')
  console.log('P3C_QA_STALE_EVIDENCE_MATRIX: PASS')
  console.log('P3C_QA_FAULT_INJECTION_MATRIX: PASS')
  console.log('P3C_QA_REAL_LOCK_WAIT_MATRIX: PASS')
  console.log('P3C_QA_PLAINTEXT_NONPERSISTENCE: PASS')
  console.log('P3C_QA_P3B_AUTHORITY_ISSUANCE_COMPATIBILITY: PASS')
  console.log('P3C_QA_TEMP_HELPER_COUNT: 0')

  runReset()
  containerId = discoverContainer()
  for (const table of tableNames) assert.equal(scalar(`select count(*) from public.${table};`), '0')
  for (const table of dependentFixtureTables) assert.equal(scalar(`select count(*) from public.${table};`), '0')
  assert.equal(scalar(`select count(*) from auth.users;`), '0')
  assert.equal(scalar(`select count(*) from vault.secrets;`), '0')
  assert.equal(scalar(`select count(*) from vault.decrypted_secrets;`), '0')
  assert.equal(scalar(`select count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED' or control_version<>1;`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p3c_qa_%';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p3c_qa_%';`), '0')
  assert.equal(hasExecute('postgres', 'vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)'), 'f')
  assert.equal(hasExecute('postgres', 'vault._crypto_aead_det_noncegen()'), 'f')
  fixtureCreated = false
  finalResetVerified = true
  console.log('P3C_QA_FINAL_LOCAL_RESET: PASS')
  console.log('P3C_QA_AUTH_USERS_FINAL_COUNT: 0')
  console.log('P3C_QA_VAULT_SECRETS_FINAL_COUNT: 0')
  console.log('P3C_QA_STUDENT_PROFILE_FINAL_COUNT: 0')
  console.log('P3C_QA_GUARDIAN_PROFILE_FINAL_COUNT: 0')
  console.log('P3C_QA_IDENTITY_TARGET_BINDING_FINAL_COUNT: 0')
  console.log('P3C_QA_GUARDIAN_STUDENT_RELATIONSHIP_FINAL_COUNT: 0')
  console.log('P3C_QA_LEFTOVER_FIXTURE_COUNT: 0')
  console.log('P3C_QA_NONDEFAULT_ROOT_COUNT: 0')
  console.log('P3C_QA_LOCAL_CRYPTO_BRIDGE_FINAL_COUNT: 0')
  console.log('P3C_QA_REAL_AUTH_USER_MUTATION_COUNT: 0')
  console.log('P3C_QA_PRODUCTION_AUTH_MUTATION: NO')
  console.log('F23_3E_P3C_LOCAL_DB_QA: PASS')
} finally {
  if (fixtureCreated || !finalResetVerified) {
    try {
      runReset()
      containerId = discoverContainer()
      assert.equal(scalar(`select count(*) from auth.users;`), '0')
      assert.equal(scalar(`select count(*) from vault.secrets;`), '0')
      for (const table of tableNames) assert.equal(scalar(`select count(*) from public.${table};`), '0')
      for (const table of dependentFixtureTables) assert.equal(scalar(`select count(*) from public.${table};`), '0')
    } catch (cleanupError) {
      console.error(`P3C QA cleanup failed: ${cleanupError.message}`)
    }
  }
}
