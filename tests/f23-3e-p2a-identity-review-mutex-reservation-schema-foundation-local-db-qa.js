import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P2A_LOCAL_QA_ALLOW_RESET'
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
for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'API_URL']) {
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
console.log('P2A_QA_LOCAL_SAFETY_GUARD: PASS')

const runReset = () => requireSuccess(
  run(localCommand, localArgs('db reset'), { timeout: 240_000 }),
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
  const lines = psql(sql).stdout.trim().split(/\r?\n/).map((line) => line.trim())
  const line = [...lines].reverse().find((value) => value.startsWith('{') || value.startsWith('['))
  assert(line, `Expected JSON result, received: ${lines.join(' | ')}`)
  return JSON.parse(line)
}
const expectSqlFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, 'SQL was expected to fail')
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const bytea = (pair, bytes = 32) => `pg_catalog.decode(pg_catalog.repeat(${q(pair)},${bytes}),'hex')`
const digestArray = (pair) => `array[${bytea(pair)}]::bytea[]`

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
      else setTimeout(check, 10)
    }
    check()
  })
  return { child, done, marker }
}

const centers = { a: randomUUID(), b: randomUUID() }
const users = { actor: randomUUID(), reviewer: randomUUID(), consultantA: randomUUID(), consultantB: randomUUID() }
const contacts = { a: randomUUID(), b: randomUUID() }
const cases = { a: randomUUID(), b: randomUUID() }
const assignments = { a: randomUUID(), b: randomUUID() }
const candidates = { a: randomUUID(), b: randomUUID() }
const idempotency = { a: randomUUID(), b: randomUUID() }
const requests = { a: randomUUID(), b: randomUUID() }
const policies = {
  aGuardian: randomUUID(), bGuardian: randomUUID(), bStudentLifecycle: randomUUID(),
  aGuardianConflict: randomUUID(), aGuardianSkip: randomUUID(),
}
const mutex = { a1: '11', a2: '22', b1: '33' }
const fixtureIds = [
  ...Object.values(centers), ...Object.values(users), ...Object.values(contacts),
  ...Object.values(cases), ...Object.values(assignments), ...Object.values(candidates),
  ...Object.values(idempotency), ...Object.values(requests), ...Object.values(policies),
]

const requestGraph = { a: 'a1', b: 'b1' }
const environment = { a: 'e1', b: 'e2' }

const reviewSql = ({
  id, actionId, intentPair, outcome = 'NO_MATCH', reason = 'INSUFFICIENT_EVIDENCE',
  targetId = null, targetNamespace = null, targetVersion = null,
  center = centers.a, requestId = requests.a, requestGraphPair = requestGraph.a,
  contactId = contacts.a, caseId = cases.a, candidateId = null,
  policyId = policies.aGuardian, expires = "interval '30 minutes'",
  evidencePair = '61', mutexPair = '62', projectionPair = '63', supersedes = null,
} = {}) => `
insert into public.crm_identity_match_review (
  match_review_id,center_id,conversion_request_id,request_version,
  action_id,action_intent_digest,request_action_graph_digest,identity_kind,
  crm_contact_id,source_contact_version,consultation_case_id,source_case_version,
  candidate_student_id,source_candidate_version,
  target_adapter_namespace,opaque_target_id,target_version,
  identity_policy_registry_id,normalization_version,match_policy_version,
  minimum_evidence_policy_version,match_outcome,evidence_set_digest,
  identity_mutex_keys_digest,projection_snapshot_digest,safe_reason_code,
  expires_at,supersedes_review_id
) values (
  ${u(id)},${q(center)},${u(requestId)},1,
  ${u(actionId)},${bytea(intentPair)},${bytea(requestGraphPair)},'GUARDIAN',
  ${u(contactId)},1,${u(caseId)},2,
  ${candidateId ? u(candidateId) : 'null'},${candidateId ? '1' : 'null'},
  ${targetNamespace ? q(targetNamespace) : 'null'},${targetId ? u(targetId) : 'null'},${targetVersion ?? 'null'},
  ${u(policyId)},1,1,1,${q(outcome)},${bytea(evidencePair)},
  ${bytea(mutexPair)},${bytea(projectionPair)},${q(reason)},
  pg_catalog.transaction_timestamp()+${expires},${supersedes ? u(supersedes) : 'null'}
);`

const decideReviewSql = (id, status, outcome, action, version = 2) => `
update public.crm_identity_match_review
set review_status=${q(status)},match_outcome=${q(outcome)},review_action=${action ? q(action) : 'null'},
    reviewer_user_id=${action ? u(users.reviewer) : 'null'},
    reviewer_authority_version=${action ? '1' : 'null'},review_version=${version}
where match_review_id=${u(id)};`

const reservationSql = ({
  id, reviewId, actionId, intentPair, targetId, expires = "interval '10 minutes'",
  center = centers.a, requestId = requests.a, requestGraphPair = requestGraph.a,
  policyId = policies.aGuardian, evidencePair = '61', mutexPair = '62', projectionPair = '63',
  supersedes = null,
} = {}) => `
insert into public.crm_profile_creation_reservation (
  reservation_id,center_id,entity_kind,conversion_request_id,request_version,
  action_id,action_intent_digest,request_action_graph_digest,match_review_id,
  preallocated_target_id,target_adapter_namespace,identity_mutex_keys_digest,
  identity_policy_registry_id,normalization_version,match_policy_version,
  minimum_evidence_policy_version,source_evidence_digest,source_versions_digest,
  projection_snapshot_digest,expires_at,created_by_user_id,supersedes_reservation_id
) values (
  ${u(id)},${q(center)},'GUARDIAN',${u(requestId)},1,
  ${u(actionId)},${bytea(intentPair)},${bytea(requestGraphPair)},${u(reviewId)},
  ${u(targetId)},'future.guardian.adapter',${bytea(mutexPair)},
  ${u(policyId)},1,1,1,${bytea(evidencePair)},${bytea('64')},
  ${bytea(projectionPair)},pg_catalog.transaction_timestamp()+${expires},${u(users.actor)},
  ${supersedes ? u(supersedes) : 'null'}
);`

const createNewReview = ({ actionId, reviewId, intentPair, expires, supersedes } = {}) => {
  psql(reviewSql({ id: reviewId, actionId, intentPair, outcome: 'NO_MATCH', expires, supersedes }))
  psql(decideReviewSql(reviewId, 'CREATE_NEW_REVIEWED', 'NO_MATCH', 'PREPARE_CREATE_NEW'))
}

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1
let tempHelperCount = -1

try {
  runReset()
  containerId = discoverContainer()
  console.log('P2A_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110001' and name='f23_3e_p2a_identity_review_mutex_reservation_schema_foundation';`), '1')
  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')

  const tables = [
    'crm_identity_policy_registry', 'crm_identity_match_mutex',
    'crm_identity_match_review', 'crm_profile_creation_reservation',
  ]
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in (${tables.map(q).join(',')});`), '4')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${tables.map(q).join(',')}) and c.relrowsecurity and c.relforcerowsecurity;`), '4')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_policy p where p.polrelid in (${tables.map((name) => `${q(`public.${name}`)}::regclass`).join(',')});`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in (${tables.map(q).join(',')});`), '0')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of tables) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal(scalar(`select pg_catalog.has_table_privilege(${q(role)},${q(`public.${table}`)},${q(privilege)});`), 'f')
      }
      expectSqlFailure(`set role ${role}; select pg_catalog.count(*) from public.${table};`, /permission denied|row-level security/i)
    }
  }
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2a_%' and p.proname not like 'f23_3e_p2a_internal_%';`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2a_internal_%' and (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') or pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'));`), '0')
  console.log('P2A_QA_FOUR_TABLES_PRESENT: PASS')
  console.log('P2A_QA_RLS_ENABLED_FORCED: PASS')
  console.log('P2A_QA_DIRECT_TABLE_ACCESS_DENIED: PASS')
  console.log('P2A_QA_NOT_IN_REALTIME: PASS')

  const suspiciousColumns = [
    'name', 'full_name', 'phone', 'email', 'birth_date', 'dob', 'address',
    'contact_payload', 'normalized_value', 'raw_identity',
  ]
  assert.equal(scalar(`select pg_catalog.count(*) from information_schema.columns where table_schema='public' and table_name in (${tables.map(q).join(',')}) and column_name in (${suspiciousColumns.map(q).join(',')});`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from information_schema.columns where table_schema='public' and table_name in (${tables.map(q).join(',')}) and data_type in ('json','jsonb');`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from information_schema.tables where table_schema='public' and table_name in ('guardian','guardian_profile','student_profile','guardian_student_relationship','crm_conversion_action','conversion_action','request_action','conversion_execution','approval');`), '0')
  console.log('P2A_QA_MUTEX_NO_RAW_PII: PASS')

  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
${Object.values(users).map((id) => `(${u(id)},'authenticated','authenticated',pg_catalog.now(),pg_catalog.now())`).join(',\n')};
insert into public.centers(id,name) values (${q(centers.a)},'p2aqa_a'),(${q(centers.b)},'p2aqa_b');
insert into public.crm_contact(
  crm_contact_id,center_id,source_category,protected_contact_methods_ciphertext,
  contact_methods_crypto_version,normalized_lookup_digests,normalization_version,created_by_user_id
) values
(${u(contacts.a)},${q(centers.a)},'qa',${bytea('41',16)},1,${digestArray('42')},1,${u(users.actor)}),
(${u(contacts.b)},${q(centers.b)},'qa',${bytea('43',16)},1,${digestArray('44')},1,${u(users.actor)});
insert into public.consultation_case(
  consultation_case_id,center_id,primary_contact_id,created_by_user_id
) values
(${u(cases.a)},${q(centers.a)},${u(contacts.a)},${u(users.actor)}),
(${u(cases.b)},${q(centers.b)},${u(contacts.b)},${u(users.actor)});
begin;
set constraints all deferred;
insert into public.consultation_case_assignment(
  assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id
) values
(${u(assignments.a)},${q(centers.a)},${u(cases.a)},${u(users.consultantA)},${u(users.actor)}),
(${u(assignments.b)},${q(centers.b)},${u(cases.b)},${u(users.consultantB)},${u(users.actor)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values (${u(cases.a)},${u(assignments.a)}),(${u(cases.b)},${u(assignments.b)})) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id;
commit;
insert into public.consultation_case_candidate_student(
  candidate_student_id,center_id,consultation_case_id,display_name_evidence
) values
(${u(candidates.a)},${q(centers.a)},${u(cases.a)},'synthetic-evidence-a'),
(${u(candidates.b)},${q(centers.b)},${u(cases.b)},'synthetic-evidence-b');
insert into public.crm_idempotency_registry(
  idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,
  resource_scope_id,consultation_case_id,operation,idempotency_key_digest,
  intent_digest,request_intent_digest,action_graph_digest,expires_at
) values
(${u(idempotency.a)},${bytea(environment.a)},${q(centers.a)},'consultation_case',${u(cases.a)},${u(cases.a)},'p2a.qa.request',${bytea('51')},${bytea('52')},${bytea('53')},${bytea(requestGraph.a)},pg_catalog.transaction_timestamp()+interval '1 day'),
(${u(idempotency.b)},${bytea(environment.b)},${q(centers.b)},'consultation_case',${u(cases.b)},${u(cases.b)},'p2a.qa.request',${bytea('54')},${bytea('55')},${bytea('56')},${bytea(requestGraph.b)},pg_catalog.transaction_timestamp()+interval '1 day');
insert into public.crm_conversion_request(
  conversion_request_id,center_id,consultation_case_id,source_contact_id,
  source_case_version,source_contact_version,source_assignment_id,source_assignment_version,
  identity_policy_version,conversion_policy_version,relationship_policy_version,
  student_profile_policy_version,action_graph_digest,idempotency_scope,
  idempotency_key_reference,intent_digest,requested_by_user_id
) values
(${u(requests.a)},${q(centers.a)},${u(cases.a)},${u(contacts.a)},2,1,${u(assignments.a)},1,1,1,1,1,${bytea(requestGraph.a)},'p2a.qa',${u(idempotency.a)},${bytea('57')},${u(users.actor)}),
(${u(requests.b)},${q(centers.b)},${u(cases.b)},${u(contacts.b)},2,1,${u(assignments.b)},1,1,1,1,1,${bytea(requestGraph.b)},'p2a.qa',${u(idempotency.b)},${bytea('58')},${u(users.actor)});
`)

  psql(`
insert into public.crm_identity_policy_registry(
  identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,
  center_identity_policy_version,normalization_algorithm,normalization_version,
  digest_key_epoch,match_policy_version,minimum_evidence_policy_version
) values
(${u(policies.aGuardian)},${bytea(environment.a)},${q(centers.a)},'GUARDIAN',1,'guardian_identity_v1',1,1,1,1),
(${u(policies.bGuardian)},${bytea(environment.b)},${q(centers.b)},'GUARDIAN',1,'guardian_identity_v1',1,1,1,1),
(${u(policies.bStudentLifecycle)},${bytea(environment.b)},${q(centers.b)},'STUDENT',1,'student_identity_v1',1,1,1,1),
(${u(policies.aGuardianConflict)},${bytea(environment.a)},${q(centers.a)},'GUARDIAN',1,'guardian_identity_v2',2,2,2,2),
(${u(policies.aGuardianSkip)},${bytea(environment.a)},${q(centers.a)},'GUARDIAN',1,'guardian_identity_v3',3,3,3,3);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where identity_policy_registry_id in (${u(policies.aGuardian)},${u(policies.bGuardian)});
`)
  psql(`update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where identity_policy_registry_id=${u(policies.bStudentLifecycle)};`)
  psql(`update public.crm_identity_policy_registry set status='DRAINING',policy_registry_version=3 where identity_policy_registry_id=${u(policies.bStudentLifecycle)};`)
  psql(`update public.crm_identity_policy_registry set status='RETIRED',policy_registry_version=4 where identity_policy_registry_id=${u(policies.bStudentLifecycle)};`)
  expectSqlFailure(`update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=5 where identity_policy_registry_id=${u(policies.bStudentLifecycle)};`, /retired_policy_is_immutable/i)
  expectSqlFailure(`update public.crm_identity_policy_registry set status='STAGED',policy_registry_version=3 where identity_policy_registry_id=${u(policies.aGuardian)};`, /invalid_policy_transition/i)
  expectSqlFailure(`update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=3 where identity_policy_registry_id=${u(policies.aGuardianSkip)};`, /version_must_increment_by_one/i)
  expectSqlFailure(`update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where identity_policy_registry_id=${u(policies.aGuardianConflict)};`, /duplicate key|one_current/i)
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_policy_registry where center_id=${q(centers.a)} and identity_kind='GUARDIAN' and status='CURRENT';`), '1')
  console.log('P2A_QA_POLICY_LIFECYCLE: PASS')
  console.log('P2A_QA_ONE_CURRENT_POLICY: PASS')

  psql(`
insert into public.crm_identity_match_mutex(
  identity_match_mutex_key,environment_fingerprint,center_id,identity_kind,
  identity_policy_registry_id,normalization_version,digest_key_epoch
) values
(${bytea(mutex.a2)},${bytea(environment.a)},${q(centers.a)},'GUARDIAN',${u(policies.aGuardian)},1,1),
(${bytea(mutex.a1)},${bytea(environment.a)},${q(centers.a)},'GUARDIAN',${u(policies.aGuardian)},1,1),
(${bytea(mutex.b1)},${bytea(environment.b)},${q(centers.b)},'GUARDIAN',${u(policies.bGuardian)},1,1);
`)
  assert.deepEqual(
    scalar(`select pg_catalog.string_agg(pg_catalog.encode(identity_match_mutex_key,'hex'),',' order by identity_match_mutex_key) from public.crm_identity_match_mutex where center_id=${q(centers.a)};`).split(','),
    ['11'.repeat(32), '22'.repeat(32)],
  )
  expectSqlFailure(`insert into public.crm_identity_match_mutex(identity_match_mutex_key,environment_fingerprint,center_id,identity_kind,identity_policy_registry_id,normalization_version,digest_key_epoch) values(${bytea('34')},${bytea(environment.b)},${q(centers.a)},'GUARDIAN',${u(policies.bGuardian)},1,1);`, /foreign key|mutex_policy/i)
  console.log('P2A_QA_MUTEX_EXACT_CENTER: PASS')

  const reviewExact = randomUUID(); const actionExact = randomUUID(); const targetExact = randomUUID()
  const reviewCreate = randomUUID(); const actionCreate = randomUUID()
  const reviewReject = randomUUID(); const actionReject = randomUUID()
  const reviewConflict = randomUUID(); const actionConflict = randomUUID()
  const reviewExpire = randomUUID(); const actionExpire = randomUUID()
  const reviewSupersede = randomUUID(); const actionSupersede = randomUUID()
  const reviewDuplicate = randomUUID(); const actionDuplicate = randomUUID(); const duplicateTarget = randomUUID()
  const reviewB = randomUUID(); const actionB = randomUUID()
  fixtureIds.push(reviewExact, actionExact, targetExact, reviewCreate, actionCreate, reviewReject, actionReject,
    reviewConflict, actionConflict, reviewExpire, actionExpire, reviewSupersede, actionSupersede,
    reviewDuplicate, actionDuplicate, duplicateTarget, reviewB, actionB)

  psql(reviewSql({ id: reviewExact, actionId: actionExact, intentPair: '71', outcome: 'PROBABLE_MATCH', reason: 'CONTACT_EVIDENCE_MATCH', targetId: targetExact, targetNamespace: 'future.guardian.adapter', targetVersion: 1 }))
  psql(decideReviewSql(reviewExact, 'EXACT_REVIEWED_MATCH', 'EXACT_REVIEWED_MATCH', 'REUSE_EXISTING'))
  psql(reviewSql({ id: reviewCreate, actionId: actionCreate, intentPair: '72', outcome: 'NO_MATCH' }))
  psql(decideReviewSql(reviewCreate, 'CREATE_NEW_REVIEWED', 'NO_MATCH', 'PREPARE_CREATE_NEW'))
  psql(reviewSql({ id: reviewReject, actionId: actionReject, intentPair: '73', outcome: 'POSSIBLE_MATCH', targetId: randomUUID(), targetNamespace: 'future.guardian.adapter', targetVersion: 1 }))
  psql(decideReviewSql(reviewReject, 'REJECTED_MATCH', 'POSSIBLE_MATCH', 'REJECT_IDENTITY_ACTION'))
  psql(reviewSql({ id: reviewConflict, actionId: actionConflict, intentPair: '74', outcome: 'PROBABLE_MATCH', reason: 'MULTIPLE_CANDIDATES' }))
  psql(decideReviewSql(reviewConflict, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT'))
  psql(reviewSql({ id: reviewSupersede, actionId: actionSupersede, intentPair: '75', outcome: 'INSUFFICIENT_EVIDENCE' }))
  psql(decideReviewSql(reviewSupersede, 'SUPERSEDED', 'INSUFFICIENT_EVIDENCE', null))
  psql(reviewSql({ id: reviewExpire, actionId: actionExpire, intentPair: '76', outcome: 'INSUFFICIENT_EVIDENCE', expires: "interval '100 milliseconds'" }))
  psql(`select pg_catalog.pg_sleep(0.15);`)
  psql(decideReviewSql(reviewExpire, 'EXPIRED', 'INSUFFICIENT_EVIDENCE', null))
  console.log('P2A_QA_REVIEW_VERSION_PLUS_ONE: PASS')

  expectSqlFailure(`update public.crm_identity_match_review set review_status='PENDING',review_action=null,reviewer_user_id=null,reviewer_authority_version=null,review_version=3 where match_review_id=${u(reviewExact)};`, /terminal_review_is_immutable/i)
  expectSqlFailure(`update public.crm_identity_match_review set review_status='CONFLICT',match_outcome='CONFLICT',review_action='ESCALATE_IDENTITY_CONFLICT',reviewer_user_id=${u(users.reviewer)},reviewer_authority_version=1,review_version=3 where match_review_id=${u(reviewExact)};`, /terminal_review_is_immutable/i)
  const reviewBinding = randomUUID(); const actionBinding = randomUUID(); fixtureIds.push(reviewBinding, actionBinding)
  psql(reviewSql({ id: reviewBinding, actionId: actionBinding, intentPair: '77', outcome: 'POSSIBLE_MATCH' }))
  expectSqlFailure(`update public.crm_identity_match_review set action_id=${u(randomUUID())},review_status='CONFLICT',match_outcome='CONFLICT',review_action='ESCALATE_IDENTITY_CONFLICT',reviewer_user_id=${u(users.reviewer)},reviewer_authority_version=1,review_version=2 where match_review_id=${u(reviewBinding)};`, /review_binding_is_immutable/i)
  expectSqlFailure(decideReviewSql(reviewBinding, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT', 1), /version_must_increment_by_one/i)
  expectSqlFailure(decideReviewSql(reviewBinding, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT', 3), /version_must_increment_by_one/i)
  expectSqlFailure(decideReviewSql(reviewBinding, 'EXACT_REVIEWED_MATCH', 'EXACT_REVIEWED_MATCH', 'PREPARE_CREATE_NEW', 2), /check constraint|semantic_mapping/i)
  psql(decideReviewSql(reviewBinding, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT', 2))
  const staleReview = randomUUID(); const staleAction = randomUUID(); fixtureIds.push(staleReview, staleAction)
  psql(reviewSql({ id: staleReview, actionId: staleAction, intentPair: '78', outcome: 'NO_MATCH', expires: "interval '100 milliseconds'" }))
  psql(`select pg_catalog.pg_sleep(0.15);`)
  expectSqlFailure(decideReviewSql(staleReview, 'CREATE_NEW_REVIEWED', 'NO_MATCH', 'PREPARE_CREATE_NEW'), /expired_review_cannot_be_decided_or_reused/i)
  psql(decideReviewSql(staleReview, 'EXPIRED', 'NO_MATCH', null))
  assert.equal(scalar(`select review_status||':'||review_version from public.crm_identity_match_review where match_review_id=${u(reviewExact)};`), 'EXACT_REVIEWED_MATCH:2')
  console.log('P2A_QA_REVIEW_TERMINAL_IMMUTABLE: PASS')

  expectSqlFailure(reviewSql({ id: randomUUID(), actionId: randomUUID(), intentPair: '79', center: centers.a, requestId: requests.b, contactId: contacts.a, caseId: cases.a }), /foreign key|request_action_source_binding/i)
  psql(reviewSql({ id: reviewB, actionId: actionB, intentPair: '7a', center: centers.b, requestId: requests.b, requestGraphPair: requestGraph.b, contactId: contacts.b, caseId: cases.b, policyId: policies.bGuardian }))
  psql(decideReviewSql(reviewB, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT'))
  expectSqlFailure(reviewSql({ id: randomUUID(), actionId: actionB, intentPair: '7b', supersedes: reviewB }), /foreign key|supersession/i)
  console.log('P2A_QA_REVIEW_EXACT_CENTER: PASS')

  psql(reviewSql({ id: reviewDuplicate, actionId: actionDuplicate, intentPair: '7c', outcome: 'PROBABLE_MATCH', reason: 'NAME_AND_BIRTH_EXACT_CANDIDATE', targetId: duplicateTarget, targetNamespace: 'future.guardian.adapter', targetVersion: 1 }))
  expectSqlFailure(`update public.crm_identity_match_review set review_status='EXACT_REVIEWED_MATCH',review_version=2 where match_review_id=${u(reviewDuplicate)};`, /check constraint|semantic_mapping/i)
  expectSqlFailure(reservationSql({ id: randomUUID(), reviewId: reviewDuplicate, actionId: actionDuplicate, intentPair: '7c', targetId: randomUUID() }), /reservation_review_binding_is_not_current_create_new/i)
  psql(decideReviewSql(reviewDuplicate, 'CONFLICT', 'CONFLICT', 'ESCALATE_IDENTITY_CONFLICT'))
  assert.equal(scalar(`select safe_reason_code from public.crm_identity_match_review where match_review_id=${u(reviewDuplicate)};`), 'NAME_AND_BIRTH_EXACT_CANDIDATE')
  console.log('P2A_QA_EXACT_NAME_BIRTH_DUPLICATE_REVIEW_SUPPORT: PASS')

  const reservationActions = Array.from({ length: 11 }, () => randomUUID())
  const reservationReviews = Array.from({ length: 12 }, () => randomUUID())
  const reservationIds = Array.from({ length: 12 }, () => randomUUID())
  const targetIds = Array.from({ length: 12 }, () => randomUUID())
  fixtureIds.push(...reservationActions, ...reservationReviews, ...reservationIds, ...targetIds)
  for (let index = 0; index < 8; index += 1) {
    createNewReview({ actionId: reservationActions[index], reviewId: reservationReviews[index], intentPair: `8${index}` })
  }

  psql(reservationSql({ id: reservationIds[0], reviewId: reservationReviews[0], actionId: reservationActions[0], intentPair: '80', targetId: targetIds[0] }))
  psql(`update public.crm_profile_creation_reservation set status='CONSUMED',reservation_version=2 where reservation_id=${u(reservationIds[0])};`)
  psql(reservationSql({ id: reservationIds[1], reviewId: reservationReviews[1], actionId: reservationActions[1], intentPair: '81', targetId: targetIds[1], expires: "interval '100 milliseconds'" }))
  psql(`select pg_catalog.pg_sleep(0.15);`)
  psql(`update public.crm_profile_creation_reservation set status='EXPIRED',reservation_version=2 where reservation_id=${u(reservationIds[1])};`)
  psql(reservationSql({ id: reservationIds[2], reviewId: reservationReviews[2], actionId: reservationActions[2], intentPair: '82', targetId: targetIds[2] }))
  psql(`update public.crm_profile_creation_reservation set status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[2])};`)
  psql(reservationSql({ id: reservationIds[3], reviewId: reservationReviews[3], actionId: reservationActions[3], intentPair: '83', targetId: targetIds[3] }))
  psql(`update public.crm_profile_creation_reservation set status='SUPERSEDED',reservation_version=2 where reservation_id=${u(reservationIds[3])};`)

  expectSqlFailure(`update public.crm_profile_creation_reservation set status='ACTIVE',reservation_version=3,terminal_at=null,terminal_reason_code=null where reservation_id=${u(reservationIds[0])};`, /terminal_reservation_is_immutable/i)
  psql(reservationSql({ id: reservationIds[4], reviewId: reservationReviews[4], actionId: reservationActions[4], intentPair: '84', targetId: targetIds[4] }))
  expectSqlFailure(`update public.crm_profile_creation_reservation set preallocated_target_id=${u(randomUUID())},status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[4])};`, /reservation_binding_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set action_id=${u(randomUUID())},status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[4])};`, /reservation_binding_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set match_review_id=${u(reservationReviews[5])},status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[4])};`, /reservation_binding_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set identity_policy_registry_id=${u(policies.bGuardian)},status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[4])};`, /reservation_binding_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set status='CANCELLED',reservation_version=1 where reservation_id=${u(reservationIds[4])};`, /version_must_increment_by_one/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set status='CANCELLED',reservation_version=3 where reservation_id=${u(reservationIds[4])};`, /version_must_increment_by_one/i)
  psql(`update public.crm_profile_creation_reservation set status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[4])};`)
  console.log('P2A_QA_RESERVATION_TERMINAL_IMMUTABLE: PASS')
  console.log('P2A_QA_RESERVATION_NON_REBINDABLE_TARGET: PASS')

  psql(reservationSql({ id: reservationIds[5], reviewId: reservationReviews[5], actionId: reservationActions[5], intentPair: '85', targetId: targetIds[5], expires: "interval '100 milliseconds'" }))
  psql(`select pg_catalog.pg_sleep(0.15);`)
  expectSqlFailure(`update public.crm_profile_creation_reservation set status='CONSUMED',reservation_version=2 where reservation_id=${u(reservationIds[5])};`, /expired_reservation_cannot_be_consumed_or_reused/i)
  psql(`update public.crm_profile_creation_reservation set status='EXPIRED',reservation_version=2 where reservation_id=${u(reservationIds[5])};`)
  console.log('P2A_QA_RESERVATION_EXPIRY_FAIL_CLOSED: PASS')

  const sharedAction = reservationActions[6]; const sharedIntent = '86'
  psql(reservationSql({ id: reservationIds[6], reviewId: reservationReviews[6], actionId: sharedAction, intentPair: sharedIntent, targetId: targetIds[6] }))
  createNewReview({ actionId: sharedAction, reviewId: reservationReviews[8], intentPair: sharedIntent, supersedes: reservationReviews[6] })
  expectSqlFailure(reservationSql({ id: reservationIds[8], reviewId: reservationReviews[8], actionId: sharedAction, intentPair: sharedIntent, targetId: targetIds[8] }), /duplicate key|one_active/i)
  psql(`update public.crm_profile_creation_reservation set status='CANCELLED',reservation_version=2 where reservation_id=${u(reservationIds[6])};`)
  expectSqlFailure(reservationSql({ id: reservationIds[7], reviewId: reservationReviews[7], actionId: reservationActions[7], intentPair: '87', targetId: targetIds[6] }), /duplicate key|target_never_rebound/i)
  console.log('P2A_QA_ONE_ACTIVE_EXACT_INTENT: PASS')

  expectSqlFailure(reservationSql({ id: randomUUID(), reviewId: reviewB, actionId: actionB, intentPair: '7a', targetId: randomUUID(), center: centers.a }), /foreign key|reservation_review_binding/i)
  console.log('P2A_QA_RESERVATION_EXACT_CENTER: PASS')

  const liveAction = reservationActions[8]; const liveReview = reservationReviews[9]
  const liveReservation = reservationIds[9]; const liveTarget = targetIds[9]
  createNewReview({ actionId: liveAction, reviewId: liveReview, intentPair: '88' })
  psql(reservationSql({ id: liveReservation, reviewId: liveReview, actionId: liveAction, intentPair: '88', targetId: liveTarget }))

  const canonicalLockSql = (marker) => `
select center_id from public.center_crm_control where center_id=${q(centers.a)} for update;
select pg_catalog.encode(identity_match_mutex_key,'hex') from public.crm_identity_match_mutex
where center_id=${q(centers.a)} and identity_match_mutex_key in (${bytea(mutex.a1)},${bytea(mutex.a2)})
order by identity_match_mutex_key for update;
select conversion_request_id from public.crm_conversion_request where conversion_request_id=${u(requests.a)} for update;
select crm_contact_id from public.crm_contact where crm_contact_id=${u(contacts.a)} for update;
select consultation_case_id from public.consultation_case where consultation_case_id=${u(cases.a)} for update;
select match_review_id from public.crm_identity_match_review where match_review_id=${u(liveReview)} for update;
select reservation_id from public.crm_profile_creation_reservation where reservation_id=${u(liveReservation)} for update;
select ${q(marker)};
`
  const holder = collect(spawnPsql())
  holder.child.stdin.write(`begin;\n${canonicalLockSql('P2A_LOCK_HOLDER_READY')}`)
  await holder.marker('P2A_LOCK_HOLDER_READY')
  const waiter = collect(spawnPsql())
  waiter.child.stdin.end(`set application_name='p2a_canonical_lock_waiter'; begin; ${canonicalLockSql('P2A_LOCK_WAITER_DONE')} commit;`)
  const waitDeadline = Date.now() + 20_000
  let lockObserved = false
  while (Date.now() < waitDeadline) {
    lockObserved = scalar(`
select exists(
  select 1
  from pg_catalog.pg_stat_activity a
  join pg_catalog.pg_locks l on l.pid=a.pid and not l.granted
  where a.application_name='p2a_canonical_lock_waiter'
    and a.wait_event_type='Lock'
);`) === 't'
    if (lockObserved) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert(lockObserved, 'Canonical-order waiter did not expose an actual pg_stat_activity/pg_locks wait')
  holder.child.stdin.end('commit;\n')
  const waiterResult = await waiter.done
  const holderResult = await holder.done
  assert(waiterResult.stdout.includes('P2A_LOCK_WAITER_DONE'))
  assert(!/deadlock detected|statement timeout|lock timeout/i.test(`${waiterResult.stdout}\n${waiterResult.stderr}\n${holderResult.stdout}\n${holderResult.stderr}`))
  console.log('P2A_QA_CANONICAL_LOCK_ORDER_LIVENESS: PASS')

  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_review where safe_reason_code='NAME_AND_BIRTH_EXACT_CANDIDATE' and review_status='EXACT_REVIEWED_MATCH';`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_profile_creation_reservation where status='CONSUMED' and match_review_id=${u(reviewDuplicate)};`), '0')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    const post = jsonValue(`
select pg_catalog.json_build_object(
  'p2a_migration_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110001'),
  'p1_migration_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003')),
  'fixture_count',(
    (select pg_catalog.count(*) from public.centers where id in (${Object.values(centers).map(q).join(',')}))
    +(select pg_catalog.count(*) from auth.users where id in (${Object.values(users).map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_contact where crm_contact_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.consultation_case where consultation_case_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.consultation_case_candidate_student where candidate_student_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_conversion_request where conversion_request_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_idempotency_registry where idempotency_record_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_identity_policy_registry where identity_policy_registry_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_identity_match_review where match_review_id in (${fixtureIds.map(u).join(',')}))
    +(select pg_catalog.count(*) from public.crm_profile_creation_reservation where reservation_id in (${fixtureIds.map(u).join(',')}))
  ),
  'nondefault_root_count',(select pg_catalog.count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED'),
  'temp_helper_count',(select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2a_qa_%')
)::text;
`)
    assert.equal(post.p2a_migration_count, 1)
    assert.equal(post.p1_migration_count, 5)
    assert.equal(post.fixture_count, 0)
    assert.equal(post.nondefault_root_count, 0)
    assert.equal(post.temp_helper_count, 0)
    leftoverCount = post.fixture_count
    nondefaultRootCount = post.nondefault_root_count
    tempHelperCount = post.temp_helper_count
    finalResetPassed = true
  } catch (resetError) {
    if (!primaryError) primaryError = resetError
    else primaryError = new AggregateError([primaryError, resetError], 'P2A QA and final reset both failed')
  }
}

if (finalResetPassed) {
  console.log('P2A_QA_FINAL_LOCAL_RESET: PASS')
  console.log(`P2A_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
  console.log(`P2A_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
  console.log(`P2A_QA_TEMP_HELPER_COUNT: ${tempHelperCount}`)
}
if (primaryError) throw primaryError

console.log('F23.3E-P2A local schema, lifecycle, exact-center, expiry, and lock-order QA passed')
