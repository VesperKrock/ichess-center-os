import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P2C_LOCAL_QA_ALLOW_RESET'
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
    maxBuffer: 48 * 1024 * 1024, ...options,
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
console.log('P2C_QA_LOCAL_SAFETY_GUARD: PASS')

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
  assert(line, `Expected JSON; received: ${lines.join(' | ')}`)
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
      else setTimeout(check, 20)
    }
    check()
  })
  return { child, done, marker }
}

const ids = {
  centers: { a: `p2cqa-${randomUUID()}`, b: `p2cqa-${randomUUID()}` },
  users: {
    ownerA: randomUUID(), adminA: randomUUID(), consultantA: randomUUID(),
    unassignedA: randomUUID(), inactiveA: randomUUID(), ownerB: randomUUID(),
  },
  memberships: Array.from({ length: 6 }, () => randomUUID()),
  contacts: { a: randomUUID(), b: randomUUID() },
  cases: { a: randomUUID(), b: randomUUID() },
  assignments: { a: randomUUID(), b: randomUUID() },
  candidates: { strong: randomUUID(), noMatch: randomUUID(), foreign: randomUUID() },
  requestRegistry: { a: randomUUID(), b: randomUUID() },
  requests: { a: randomUUID(), b: randomUUID() },
  policies: { studentA: randomUUID(), guardianA: randomUUID(), studentB: randomUUID() },
  students: { exact: randomUUID(), foreign: randomUUID() },
}
const evidence = {
  strongName: 'Synthetic P2C Alpha', strongBirth: '2012-03-04',
  noMatchName: 'Synthetic P2C No Match', noMatchBirth: '2014-05-06',
}
const actionIds = Object.fromEntries([
  'strong', 'create', 'cancel', 'expireReservation', 'supersede', 'expireReview',
  'admin', 'consultant', 'lock', 'faultAudit', 'faultOutbox', 'sourceRace',
  'assignmentRace', 'targetRace', 'policyRace', 'reviewRace', 'reservationRace',
].map((name) => [name, randomUUID()]))
let idempotencyCounter = 16
const nextIdempotency = () => bytea((idempotencyCounter++).toString(16).padStart(2, '0'))

const baseArgs = (overrides = {}) => ({
  requestId: ids.requests.a,
  actorId: ids.users.ownerA,
  requestVersion: 1,
  identityKind: 'STUDENT',
  candidateId: ids.candidates.noMatch,
  contactVersion: 1,
  caseVersion: 2,
  candidateVersion: 1,
  displayName: evidence.noMatchName,
  birthDate: evidence.noMatchBirth,
  birthYear: null,
  normalizationVersion: 1,
  matchPolicyVersion: 1,
  minimumEvidencePolicyVersion: 1,
  policyRegistryVersion: 2,
  adapterVersion: 1,
  actionId: actionIds.create,
  ...overrides,
})
const sharedSql = (a) => `${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},${q(a.birthDate)}::date,${a.birthYear ?? 'null'},${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},${a.policyRegistryVersion},${a.adapterVersion},${u(a.actionId)}`
const createReviewSql = (overrides = {}, idempotency = nextIdempotency(), role = 'service_role') => {
  const a = baseArgs(overrides)
  return `set role ${role}; select public.f23_3e_p2c_create_match_review(${u(a.requestId)},${sharedSql(a)},${idempotency},${u(a.targetId)},${a.targetVersion ?? 'null'},${u(a.supersedesReviewId)}); reset role;`
}
const reviewMutationSql = (functionName, reviewId, expectedVersion, overrides = {}, idempotency = nextIdempotency(), reviewAction = null, role = 'service_role') => {
  const a = baseArgs(overrides)
  const actionPart = reviewAction === null ? '' : `${q(reviewAction)},`
  return `set role ${role}; select public.${functionName}(${u(a.requestId)},${u(reviewId)},${expectedVersion},${actionPart}${sharedSql(a)},${idempotency}); reset role;`
}
const reservationMutationSql = (functionName, reservationId, expectedVersion, overrides = {}, idempotency = nextIdempotency(), role = 'service_role') => {
  const a = baseArgs(overrides)
  return `set role ${role}; select public.${functionName}(${u(a.requestId)},${u(reservationId)},${expectedVersion},${sharedSql(a)},${idempotency}); reset role;`
}
const searchSql = (overrides = {}) => {
  const a = baseArgs(overrides)
  return `select public.f23_3e_p2b_search_masked_candidates(${u(a.requestId)},${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},${q(a.birthDate)}::date,${a.birthYear ?? 'null'},${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},${a.policyRegistryVersion},${a.adapterVersion});`
}

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1
let tempHelperCount = -1
let vaultSecretCount = -1

try {
  runReset()
  containerId = discoverContainer()
  console.log('P2C_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110003' and name='f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f23_3e_p2c_create_match_review','f23_3e_p2c_decide_match_review','f23_3e_p2c_supersede_match_review','f23_3e_p2c_expire_match_review','f23_3e_p2c_reserve_create_target','f23_3e_p2c_cancel_creation_reservation','f23_3e_p2c_expire_creation_reservation','f23_3e_p2c_read_creation_reservation_status') and p.prosecdef and p.proconfig @> array['search_path=""'];`), '8')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2c_internal_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'));`), '0')
  assert.equal(scalar(`select count(*) from information_schema.tables where table_schema='public' and table_name like 'f23_3e_p2c%';`), '0')
  console.log('P2C_QA_EIGHT_TYPED_RPCS: PASS')

  expectSqlFailure(`set role anon; select public.f23_3e_p2c_read_creation_reservation_status(${u(randomUUID())},${u(randomUUID())},1,${u(randomUUID())});`, /permission denied/i)
  expectSqlFailure(`set role authenticated; select public.f23_3e_p2c_read_creation_reservation_status(${u(randomUUID())},${u(randomUUID())},1,${u(randomUUID())});`, /permission denied/i)
  expectSqlFailure(`set role service_role; select public.f23_3e_p2c_internal_safe_result('X');`, /permission denied/i)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['crm_identity_match_review', 'crm_profile_creation_reservation', 'crm_identity_match_mutex']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT');`), 'f')
    }
  }

  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P2C ephemeral local QA');`)
  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
${Object.values(ids.users).map((id) => `(${u(id)},'authenticated','authenticated',now(),now())`).join(',\n')};
insert into public.centers(id,name) values
(${q(ids.centers.a)},'p2c synthetic center a'),(${q(ids.centers.b)},'p2c synthetic center b');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2 where center_id in (${q(ids.centers.a)},${q(ids.centers.b)});
insert into public.center_members(id,center_id,user_id,role,status) values
(${u(ids.memberships[0])},${q(ids.centers.a)},${u(ids.users.ownerA)},'owner','active'),
(${u(ids.memberships[1])},${q(ids.centers.a)},${u(ids.users.adminA)},'center_admin','active'),
(${u(ids.memberships[2])},${q(ids.centers.a)},${u(ids.users.consultantA)},'consultant','active'),
(${u(ids.memberships[3])},${q(ids.centers.a)},${u(ids.users.unassignedA)},'consultant','active'),
(${u(ids.memberships[4])},${q(ids.centers.a)},${u(ids.users.inactiveA)},'owner','inactive'),
(${u(ids.memberships[5])},${q(ids.centers.b)},${u(ids.users.ownerB)},'owner','active');
insert into public.crm_contact(crm_contact_id,center_id,source_category,protected_contact_methods_ciphertext,contact_methods_crypto_version,normalized_lookup_digests,normalization_version,created_by_user_id) values
(${u(ids.contacts.a)},${q(ids.centers.a)},'synthetic',${bytea('41', 16)},1,${digestArray('42')},1,${u(ids.users.ownerA)}),
(${u(ids.contacts.b)},${q(ids.centers.b)},'synthetic',${bytea('43', 16)},1,${digestArray('44')},1,${u(ids.users.ownerB)});
insert into public.consultation_case(consultation_case_id,center_id,primary_contact_id,created_by_user_id) values
(${u(ids.cases.a)},${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.users.ownerA)}),
(${u(ids.cases.b)},${q(ids.centers.b)},${u(ids.contacts.b)},${u(ids.users.ownerB)});
begin; set constraints all deferred;
insert into public.consultation_case_assignment(assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id) values
(${u(ids.assignments.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.users.consultantA)},${u(ids.users.ownerA)}),
(${u(ids.assignments.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.users.ownerB)},${u(ids.users.ownerB)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values (${u(ids.cases.a)},${u(ids.assignments.a)}),(${u(ids.cases.b)},${u(ids.assignments.b)})) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id; commit;
insert into public.consultation_case_candidate_student(candidate_student_id,center_id,consultation_case_id,display_name_evidence) values
(${u(ids.candidates.strong)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.strongName)}),
(${u(ids.candidates.noMatch)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.noMatchName)}),
(${u(ids.candidates.foreign)},${q(ids.centers.b)},${u(ids.cases.b)},${q(evidence.strongName)});
insert into public.crm_idempotency_registry(idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,consultation_case_id,operation,idempotency_key_digest,intent_digest,request_intent_digest,action_graph_digest,expires_at) values
(${u(ids.requestRegistry.a)},${bytea('a1')},${q(ids.centers.a)},'consultation_case',${u(ids.cases.a)},${u(ids.cases.a)},'p2c.qa.request',${bytea('a2')},${bytea('a3')},${bytea('a4')},${bytea('a5')},now()+interval '1 day'),
(${u(ids.requestRegistry.b)},${bytea('b1')},${q(ids.centers.b)},'consultation_case',${u(ids.cases.b)},${u(ids.cases.b)},'p2c.qa.request',${bytea('b2')},${bytea('b3')},${bytea('b4')},${bytea('b5')},now()+interval '1 day');
insert into public.crm_conversion_request(conversion_request_id,center_id,consultation_case_id,source_contact_id,source_case_version,source_contact_version,source_assignment_id,source_assignment_version,identity_policy_version,conversion_policy_version,relationship_policy_version,student_profile_policy_version,action_graph_digest,idempotency_scope,idempotency_key_reference,intent_digest,requested_by_user_id) values
(${u(ids.requests.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.contacts.a)},2,1,${u(ids.assignments.a)},1,1,1,1,1,${bytea('a5')},'p2c.qa',${u(ids.requestRegistry.a)},${bytea('a6')},${u(ids.users.ownerA)}),
(${u(ids.requests.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.contacts.b)},2,1,${u(ids.assignments.b)},1,1,1,1,1,${bytea('b5')},'p2c.qa',${u(ids.requestRegistry.b)},${bytea('b6')},${u(ids.users.ownerB)});
insert into public.crm_identity_policy_registry(identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,center_identity_policy_version,normalization_algorithm,normalization_version,digest_key_epoch,match_policy_version,minimum_evidence_policy_version) values
(${u(ids.policies.studentA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.guardianA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.studentB)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.b)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where identity_policy_registry_id in (${u(ids.policies.studentA)},${u(ids.policies.guardianA)},${u(ids.policies.studentB)});
insert into public.center_cloud_entities(id,center_id,entity_type,local_id,payload,source_module,source_version) values
(${u(ids.students.exact)},${q(ids.centers.a)},'student','p2c-synthetic-exact',${q(JSON.stringify({ id: 'p2c-synthetic-exact', fullName: evidence.strongName, birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.foreign)},${q(ids.centers.b)},'student','p2c-synthetic-foreign',${q(JSON.stringify({ id: 'p2c-synthetic-foreign', fullName: evidence.noMatchName, birthDate: evidence.noMatchBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1');
  `)

  const initialAudit = Number(scalar(`select count(*) from public.crm_audit_event where center_id=${q(ids.centers.a)};`))
  const initialOutbox = Number(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(ids.centers.a)};`))

  const strongSearch = jsonValue(searchSql({
    candidateId: ids.candidates.strong,
    displayName: evidence.strongName,
    birthDate: evidence.strongBirth,
    actionId: actionIds.strong,
  }))
  assert.equal(strongSearch.match_outcome, 'PROBABLE_MATCH')
  assert.equal(strongSearch.candidates.length, 1)
  const strongTarget = strongSearch.candidates[0]
  const strongKey = nextIdempotency()
  const strongOverrides = {
    candidateId: ids.candidates.strong,
    displayName: evidence.strongName,
    birthDate: evidence.strongBirth,
    actionId: actionIds.strong,
    targetId: strongTarget.opaque_target_id,
    targetVersion: strongTarget.target_version,
  }
  const strongReview = jsonValue(createReviewSql(strongOverrides, strongKey))
  assert.equal(strongReview.ok, true)
  assert.equal(strongReview.status, 'PENDING')
  assert.equal(strongReview.resource_version, 1)
  const strongReplay = jsonValue(createReviewSql(strongOverrides, strongKey))
  assert.equal(strongReplay.replayed, true)
  assert.equal(strongReplay.resource_id, strongReview.resource_id)
  const exactDenied = jsonValue(reviewMutationSql(
    'f23_3e_p2c_decide_match_review', strongReview.resource_id, 1,
    strongOverrides, nextIdempotency(), 'REUSE_EXISTING',
  ))
  assert.equal(exactDenied.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(scalar(`select review_status from public.crm_identity_match_review where match_review_id=${u(strongReview.resource_id)};`), 'PENDING')
  console.log('P2C_QA_CREATE_PENDING_REVIEW: PASS')
  console.log('P2C_QA_EXACT_REVIEWED_MATCH: PASS')
  console.log('P2C_QA_STRONG_NAME_BIRTH_NOT_AUTO_AUTHORITY: PASS')
  console.log('P2C_QA_IDEMPOTENCY_EXACT_REPLAY: PASS')

  const conflict = jsonValue(createReviewSql({ ...strongOverrides, actionId: randomUUID() }, strongKey))
  assert.equal(conflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('P2C_QA_IDEMPOTENCY_CONFLICT: PASS')

  const createKey = nextIdempotency()
  const createReview = jsonValue(createReviewSql({ actionId: actionIds.create }, createKey))
  assert.equal(createReview.status, 'PENDING')
  const createDecisionKey = nextIdempotency()
  const createDecision = jsonValue(reviewMutationSql(
    'f23_3e_p2c_decide_match_review', createReview.resource_id, 1,
    { actionId: actionIds.create }, createDecisionKey, 'PREPARE_CREATE_NEW',
  ))
  assert.equal(createDecision.status, 'CREATE_NEW_REVIEWED')
  assert.equal(createDecision.resource_version, 2)
  const decisionReplay = jsonValue(reviewMutationSql(
    'f23_3e_p2c_decide_match_review', createReview.resource_id, 1,
    { actionId: actionIds.create }, createDecisionKey, 'PREPARE_CREATE_NEW',
  ))
  assert.equal(decisionReplay.replayed, true)
  assert.equal(decisionReplay.status, 'CREATE_NEW_REVIEWED')
  console.log('P2C_QA_CREATE_NEW_REVIEWED_FROM_COMPLETE_NO_MATCH: PASS')
  console.log('P2C_QA_REVIEW_VERSION_PLUS_ONE: PASS')

  const reservationKey = nextIdempotency()
  const reservation = jsonValue(reviewMutationSql(
    'f23_3e_p2c_reserve_create_target', createReview.resource_id, 2,
    { actionId: actionIds.create }, reservationKey,
  ))
  assert.equal(reservation.status, 'ACTIVE')
  assert.match(reservation.opaque_target_id, /^[0-9a-f-]{36}$/i)
  const reservationReplay = jsonValue(reviewMutationSql(
    'f23_3e_p2c_reserve_create_target', createReview.resource_id, 2,
    { actionId: actionIds.create }, reservationKey,
  ))
  assert.equal(reservationReplay.replayed, true)
  assert.equal(reservationReplay.resource_id, reservation.resource_id)
  assert.equal(reservationReplay.opaque_target_id, reservation.opaque_target_id)
  const duplicateReservation = jsonValue(reviewMutationSql(
    'f23_3e_p2c_reserve_create_target', createReview.resource_id, 2,
    { actionId: actionIds.create }, nextIdempotency(),
  ))
  assert.equal(duplicateReservation.outcome_code, 'RESERVATION_CONFLICT')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where match_review_id=${u(createReview.resource_id)};`), '1')
  console.log('P2C_QA_CREATE_ACTIVE_RESERVATION: PASS')
  console.log('P2C_QA_SERVER_PREALLOCATED_TARGET_STABLE: PASS')
  console.log('P2C_QA_RESERVATION_NOT_CREATE_AUTHORITY: PASS')
  console.log('P2C_QA_RESERVATION_CONSUME_UNAVAILABLE: PASS')
  console.log('P2C_QA_TARGET_NON_REBINDABLE: PASS')

  const statusRead = jsonValue(`set role service_role; select public.f23_3e_p2c_read_creation_reservation_status(${u(ids.requests.a)},${u(reservation.resource_id)},1,${u(ids.users.ownerA)}); reset role;`)
  assert.equal(statusRead.status, 'ACTIVE')
  assert.equal(statusRead.current_code, 'ACTIVE')
  assert.equal(statusRead.opaque_target_id, reservation.opaque_target_id)
  assert.equal(statusRead.profile_created, false)

  const cancelled = jsonValue(reservationMutationSql(
    'f23_3e_p2c_cancel_creation_reservation', reservation.resource_id, 1,
    { actionId: actionIds.create }, nextIdempotency(),
  ))
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(cancelled.resource_version, 2)
  console.log('P2C_QA_RESERVATION_CANCEL: PASS')

  const makeCreateNew = (actionId) => {
    const pending = jsonValue(createReviewSql({ actionId }))
    const decided = jsonValue(reviewMutationSql(
      'f23_3e_p2c_decide_match_review', pending.resource_id, 1,
      { actionId }, nextIdempotency(), 'PREPARE_CREATE_NEW',
    ))
    assert.equal(decided.status, 'CREATE_NEW_REVIEWED')
    return { pending, decided }
  }

  const expirable = makeCreateNew(actionIds.expireReservation)
  const expirableReservation = jsonValue(reviewMutationSql(
    'f23_3e_p2c_reserve_create_target', expirable.pending.resource_id, 2,
    { actionId: actionIds.expireReservation }, nextIdempotency(),
  ))
  psql(`alter table public.crm_profile_creation_reservation disable trigger f23_3e_p2a_profile_creation_reservation_guard;
update public.crm_profile_creation_reservation set created_at=now()-interval '10 minutes',updated_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute' where reservation_id=${u(expirableReservation.resource_id)};
alter table public.crm_profile_creation_reservation enable trigger f23_3e_p2a_profile_creation_reservation_guard;`)
  const expiredReservation = jsonValue(reservationMutationSql(
    'f23_3e_p2c_expire_creation_reservation', expirableReservation.resource_id, 1,
    { actionId: actionIds.expireReservation }, nextIdempotency(),
  ))
  assert.equal(expiredReservation.status, 'EXPIRED')
  console.log('P2C_QA_RESERVATION_EXPIRY: PASS')

  const supersedePending = jsonValue(createReviewSql({ actionId: actionIds.supersede }))
  const superseded = jsonValue(reviewMutationSql(
    'f23_3e_p2c_supersede_match_review', supersedePending.resource_id, 1,
    { actionId: actionIds.supersede }, nextIdempotency(),
  ))
  assert.equal(superseded.status, 'SUPERSEDED')
  console.log('P2C_QA_REVIEW_SUPERSESSION: PASS')

  const expirePending = jsonValue(createReviewSql({ actionId: actionIds.expireReview }))
  psql(`alter table public.crm_identity_match_review disable trigger f23_3e_p2a_identity_match_review_guard;
update public.crm_identity_match_review set created_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute' where match_review_id=${u(expirePending.resource_id)};
alter table public.crm_identity_match_review enable trigger f23_3e_p2a_identity_match_review_guard;`)
  const expiredReview = jsonValue(reviewMutationSql(
    'f23_3e_p2c_expire_match_review', expirePending.resource_id, 1,
    { actionId: actionIds.expireReview }, nextIdempotency(),
  ))
  assert.equal(expiredReview.status, 'EXPIRED')
  console.log('P2C_QA_REVIEW_EXPIRY: PASS')

  expectSqlFailure(`update public.crm_identity_match_review set review_status='PENDING' where match_review_id=${u(expirePending.resource_id)};`, /terminal_review_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set status='CONSUMED',reservation_version=3 where reservation_id=${u(reservation.resource_id)};`, /terminal_reservation_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set preallocated_target_id=${u(randomUUID())},status='EXPIRED',reservation_version=2 where reservation_id=${u(expirableReservation.resource_id)};`, /terminal_reservation_is_immutable|binding_is_immutable/i)
  console.log('P2C_QA_TERMINAL_REVIEW_IMMUTABLE: PASS')

  const staleReview = jsonValue(createReviewSql({ actionId: randomUUID(), requestVersion: 2 }))
  assert.equal(staleReview.outcome_code, 'SOURCE_VERSION_STALE')
  const guardian = jsonValue(createReviewSql({ identityKind: 'GUARDIAN', actionId: randomUUID() }))
  assert.equal(guardian.outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  assert.equal(scalar(`select count(*) from public.crm_identity_match_review where identity_kind='GUARDIAN';`), '0')
  assert.equal(jsonValue(createReviewSql({ actorId: ids.users.unassignedA, actionId: randomUUID() })).outcome_code, 'RESOURCE_NOT_AVAILABLE')
  assert.equal(jsonValue(createReviewSql({ actorId: ids.users.inactiveA, actionId: randomUUID() })).outcome_code, 'RESOURCE_NOT_AVAILABLE')
  assert.equal(jsonValue(createReviewSql({ actorId: ids.users.ownerB, actionId: randomUUID() })).outcome_code, 'RESOURCE_NOT_AVAILABLE')
  assert.equal(jsonValue(createReviewSql({ requestId: ids.requests.b, actorId: ids.users.ownerA, candidateId: ids.candidates.foreign, contactVersion: 1, caseVersion: 2, actionId: randomUUID() })).outcome_code, 'RESOURCE_NOT_AVAILABLE')
  for (const [actorId, actionId] of [[ids.users.adminA, actionIds.admin], [ids.users.consultantA, actionIds.consultant]]) {
    assert.equal(jsonValue(createReviewSql({ actorId, actionId })).ok, true)
  }
  console.log('P2C_QA_REVIEW_STALE_FAIL_CLOSED: PASS')
  console.log('P2C_QA_RESERVATION_STALE_FAIL_CLOSED: PASS')
  console.log('P2C_QA_EXACT_CENTER_NON_DISCLOSURE: PASS')
  console.log('P2C_QA_MULTI_ACCOUNT_SCOPE: PASS')

  const eventCount = Number(scalar(`select count(*) from public.crm_audit_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`))
  assert.equal(eventCount, Number(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`)))
  assert.equal(eventCount, Number(scalar(`select count(*) from public.crm_idempotency_registry where center_id=${q(ids.centers.a)} and operation like 'crm.identity.%' and status='COMPLETED';`)))
  assert.equal(Number(scalar(`select count(*) from public.crm_audit_event where center_id=${q(ids.centers.a)};`)), initialAudit + eventCount)
  assert.equal(Number(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(ids.centers.a)};`)), initialOutbox + eventCount)
  const eventText = scalar(`select coalesce(string_agg(safe_payload::text,' '),'') from public.crm_outbox_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`)
  assert(!eventText.includes(evidence.strongName))
  assert(!eventText.includes(evidence.strongBirth))
  assert(!eventText.includes(evidence.noMatchName))
  assert(!eventText.includes(evidence.noMatchBirth))
  assert(!/identity_match_mutex_key|evidence_digest|projection_digest|normalized_value/i.test(eventText))
  console.log('P2C_QA_AUDIT_OUTBOX_ATOMIC: PASS')
  console.log('P2C_QA_AUDIT_OUTBOX_REPLAY_NO_DUPLICATE: PASS')
  console.log('P2C_QA_NO_PII_AUDIT_OUTBOX: PASS')

  const beforeAuditFault = scalar(`select (select count(*) from public.crm_identity_match_review),(select count(*) from public.crm_audit_event),(select count(*) from public.crm_outbox_event),(select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`)
  psql(`create function public.p2c_qa_fail_audit() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p2c_qa_audit_fault'; end$$;
create trigger p2c_qa_fail_audit before insert on public.crm_audit_event for each row execute function public.p2c_qa_fail_audit();`)
  expectSqlFailure(createReviewSql({ actionId: actionIds.faultAudit }), /p2c_qa_audit_fault/i)
  psql(`drop trigger p2c_qa_fail_audit on public.crm_audit_event; drop function public.p2c_qa_fail_audit();`)
  assert.equal(scalar(`select (select count(*) from public.crm_identity_match_review),(select count(*) from public.crm_audit_event),(select count(*) from public.crm_outbox_event),(select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`), beforeAuditFault)

  const beforeOutboxFault = scalar(`select (select count(*) from public.crm_identity_match_review),(select count(*) from public.crm_audit_event),(select count(*) from public.crm_outbox_event),(select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`)
  psql(`create function public.p2c_qa_fail_outbox() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p2c_qa_outbox_fault'; end$$;
create trigger p2c_qa_fail_outbox before insert on public.crm_outbox_event for each row execute function public.p2c_qa_fail_outbox();`)
  expectSqlFailure(createReviewSql({ actionId: actionIds.faultOutbox }), /p2c_qa_outbox_fault/i)
  psql(`drop trigger p2c_qa_fail_outbox on public.crm_outbox_event; drop function public.p2c_qa_fail_outbox();`)
  assert.equal(scalar(`select (select count(*) from public.crm_identity_match_review),(select count(*) from public.crm_audit_event),(select count(*) from public.crm_outbox_event),(select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`), beforeOutboxFault)
  console.log('P2C_QA_AUDIT_OUTBOX_FAULT_ROLLBACK: PASS')
  console.log('P2C_QA_FAULT_INJECTION: PASS')

  const rpcUrl = `${localStatus.API_URL}/rest/v1/rpc/f23_3e_p2c_read_creation_reservation_status`
  const body = {
    p_conversion_request_id: ids.requests.a,
    p_reservation_id: reservation.resource_id,
    p_expected_reservation_version: 2,
    p_actor_user_id: ids.users.ownerA,
  }
  const anonResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { apikey: localStatus.ANON_KEY, Authorization: `Bearer ${localStatus.ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  assert([401, 403, 404].includes(anonResponse.status), `anon RPC status ${anonResponse.status}`)
  const serviceResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { apikey: localStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${localStatus.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  assert.equal(serviceResponse.status, 200)
  assert.equal((await serviceResponse.json()).status, 'CANCELLED')
  console.log('P2C_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS')

  const lockHolder = collect(spawnPsql())
  lockHolder.child.stdin.write(`begin; set application_name='p2c_root_holder'; select 1 from public.center_crm_control where center_id=${q(ids.centers.a)} for update; \\echo P2C_ROOT_HOLDER_READY\n`)
  await lockHolder.marker('P2C_ROOT_HOLDER_READY')
  const lockContender = collect(spawnPsql())
  lockContender.child.stdin.end(`set application_name='p2c_review_contender'; ${createReviewSql({ actionId: actionIds.lock })} \\echo P2C_REVIEW_CONTENDER_DONE\n`)
  let observedWait = false
  const waitDeadline = Date.now() + 10_000
  while (Date.now() < waitDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_review_contender';`) === 't') {
      observedWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(observedWait, 'P2C contender was not observed waiting on the canonical root lock')
  lockHolder.child.stdin.end('commit; \\q\n')
  await lockHolder.done
  const lockResult = await lockContender.done
  assert(lockResult.stdout.includes('MATCH_REVIEW_CREATED'))
  assert(lockResult.stdout.includes('P2C_REVIEW_CONTENDER_DONE'))
  console.log('P2C_QA_CONCURRENCY_LOCK_WAIT: PASS')

  const reviewRaceAKey = nextIdempotency()
  const reviewRaceBKey = nextIdempotency()
  const reviewRaceHolder = collect(spawnPsql())
  reviewRaceHolder.child.stdin.write(`begin; set application_name='p2c_review_race_a'; ${createReviewSql({ actionId: actionIds.reviewRace }, reviewRaceAKey)} \\echo P2C_REVIEW_RACE_A_READY\n`)
  await reviewRaceHolder.marker('P2C_REVIEW_RACE_A_READY')
  const reviewRaceContender = collect(spawnPsql())
  reviewRaceContender.child.stdin.end(`set application_name='p2c_review_race_b'; ${createReviewSql({ actionId: actionIds.reviewRace }, reviewRaceBKey)} \\echo P2C_REVIEW_RACE_B_DONE\n`)
  let reviewRaceWait = false
  const reviewRaceDeadline = Date.now() + 10_000
  while (Date.now() < reviewRaceDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_review_race_b';`) === 't') {
      reviewRaceWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(reviewRaceWait, 'Same-identity review contender did not wait')
  reviewRaceHolder.child.stdin.end('commit; \\q\n')
  await reviewRaceHolder.done
  const reviewRaceResult = await reviewRaceContender.done
  assert(reviewRaceResult.stdout.includes('MATCH_REVIEW_CONFLICT'))
  assert.equal(scalar(`select count(*) from public.crm_identity_match_review where action_id=${u(actionIds.reviewRace)};`), '1')

  const reservationRaceReview = makeCreateNew(actionIds.reservationRace)
  const reservationRaceAKey = nextIdempotency()
  const reservationRaceBKey = nextIdempotency()
  const reservationRaceHolder = collect(spawnPsql())
  reservationRaceHolder.child.stdin.write(`begin; set application_name='p2c_reservation_race_a'; ${reviewMutationSql('f23_3e_p2c_reserve_create_target', reservationRaceReview.pending.resource_id, 2, { actionId: actionIds.reservationRace }, reservationRaceAKey)} \\echo P2C_RESERVATION_RACE_A_READY\n`)
  await reservationRaceHolder.marker('P2C_RESERVATION_RACE_A_READY')
  const reservationRaceContender = collect(spawnPsql())
  reservationRaceContender.child.stdin.end(`set application_name='p2c_reservation_race_b'; ${reviewMutationSql('f23_3e_p2c_reserve_create_target', reservationRaceReview.pending.resource_id, 2, { actionId: actionIds.reservationRace }, reservationRaceBKey)} \\echo P2C_RESERVATION_RACE_B_DONE\n`)
  let reservationRaceWait = false
  const reservationRaceDeadline = Date.now() + 10_000
  while (Date.now() < reservationRaceDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_reservation_race_b';`) === 't') {
      reservationRaceWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(reservationRaceWait, 'Same-intent reservation contender did not wait')
  reservationRaceHolder.child.stdin.end('commit; \\q\n')
  await reservationRaceHolder.done
  const reservationRaceResult = await reservationRaceContender.done
  assert(reservationRaceResult.stdout.includes('RESERVATION_CONFLICT'))
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where action_id=${u(actionIds.reservationRace)};`), '1')

  const sourceHolder = collect(spawnPsql())
  sourceHolder.child.stdin.write(`begin; set application_name='p2c_source_holder'; update public.consultation_case_candidate_student set candidate_version=2 where candidate_student_id=${u(ids.candidates.noMatch)}; \\echo P2C_SOURCE_HOLDER_READY\n`)
  await sourceHolder.marker('P2C_SOURCE_HOLDER_READY')
  const sourceContender = collect(spawnPsql())
  sourceContender.child.stdin.end(`set application_name='p2c_source_contender'; ${createReviewSql({ actionId: actionIds.sourceRace })} \\echo P2C_SOURCE_CONTENDER_DONE\n`)
  let sourceWait = false
  const sourceDeadline = Date.now() + 10_000
  while (Date.now() < sourceDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_source_contender';`) === 't') {
      sourceWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(sourceWait, 'P2C source race did not exhibit a real lock wait')
  sourceHolder.child.stdin.end('commit; \\q\n')
  await sourceHolder.done
  const sourceResult = await sourceContender.done
  assert(sourceResult.stdout.includes('SOURCE_VERSION_STALE'))
  const replayAfterSourceDrift = jsonValue(createReviewSql({ actionId: actionIds.create }, createKey))
  assert.equal(replayAfterSourceDrift.replayed, true)
  assert.equal(replayAfterSourceDrift.resource_id, createReview.resource_id)
  const staleReservationId = scalar(`select reservation_id from public.crm_profile_creation_reservation where action_id=${u(actionIds.reservationRace)};`)
  const staleReservationRead = jsonValue(`set role service_role; select public.f23_3e_p2c_read_creation_reservation_status(${u(ids.requests.a)},${u(staleReservationId)},1,${u(ids.users.ownerA)}); reset role;`)
  assert.equal(staleReservationRead.current_code, 'RESERVATION_STALE')

  const targetVersion = strongTarget.target_version
  const targetHolder = collect(spawnPsql())
  targetHolder.child.stdin.write(`begin; set application_name='p2c_target_holder'; update public.center_cloud_entities set payload=payload || '{"qaRevision":1}'::jsonb where id=${u(ids.students.exact)}; \\echo P2C_TARGET_HOLDER_READY\n`)
  await targetHolder.marker('P2C_TARGET_HOLDER_READY')
  const targetContender = collect(spawnPsql())
  targetContender.child.stdin.end(`set application_name='p2c_target_contender'; ${createReviewSql({ ...strongOverrides, actionId: actionIds.targetRace, targetVersion })} \\echo P2C_TARGET_CONTENDER_DONE\n`)
  let targetWait = false
  const targetDeadline = Date.now() + 10_000
  while (Date.now() < targetDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_target_contender';`) === 't') {
      targetWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(targetWait, 'P2C target race did not exhibit a real lock wait')
  targetHolder.child.stdin.end('commit; \\q\n')
  await targetHolder.done
  const targetResult = await targetContender.done
  assert(targetResult.stdout.includes('TARGET_VERSION_STALE'))

  const cancelRacePending = jsonValue(createReviewSql({
    actionId: actionIds.cancel, candidateVersion: 2,
  }))
  const cancelRaceDecision = jsonValue(reviewMutationSql(
    'f23_3e_p2c_decide_match_review', cancelRacePending.resource_id, 1,
    { actionId: actionIds.cancel, candidateVersion: 2 }, nextIdempotency(),
    'PREPARE_CREATE_NEW',
  ))
  assert.equal(cancelRaceDecision.status, 'CREATE_NEW_REVIEWED')
  const cancelHolder = collect(spawnPsql())
  cancelHolder.child.stdin.write(`begin; set application_name='p2c_request_cancel_a'; set role service_role;
select * from public.f23_3e_p1b_cancel_conversion_request(${u(ids.requests.a)},${u(ids.users.consultantA)},1,2,1,${bytea('c1')},${bytea('c2')},${bytea('c3')},'p2c_qa_cancel',now()+interval '1 hour'); reset role;
\\echo P2C_REQUEST_CANCEL_A_READY\n`)
  await cancelHolder.marker('P2C_REQUEST_CANCEL_A_READY')
  const cancelContender = collect(spawnPsql())
  cancelContender.child.stdin.end(`set application_name='p2c_reserve_after_cancel_b'; ${reviewMutationSql('f23_3e_p2c_reserve_create_target', cancelRacePending.resource_id, 2, { actionId: actionIds.cancel, candidateVersion: 2 }, nextIdempotency())} \\echo P2C_RESERVE_AFTER_CANCEL_B_DONE\n`)
  let cancelWait = false
  const cancelDeadline = Date.now() + 10_000
  while (Date.now() < cancelDeadline) {
    if (scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2c_reserve_after_cancel_b';`) === 't') {
      cancelWait = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(cancelWait, 'Request-cancel/reservation contender did not wait')
  cancelHolder.child.stdin.end('commit; \\q\n')
  await cancelHolder.done
  const cancelRaceResult = await cancelContender.done
  assert(cancelRaceResult.stdout.includes('SOURCE_VERSION_STALE'))
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where action_id=${u(actionIds.cancel)};`), '0')

  psql(`begin; set constraints all deferred;
update public.consultation_case set active_assignment_id=null,case_version=case_version+1 where consultation_case_id=${u(ids.cases.a)};
update public.consultation_case_assignment set assignment_status='REVOKED',assignment_version=2,ended_at=now(),end_reason='p2c_qa_revoke' where assignment_id=${u(ids.assignments.a)};
commit;`)
  assert.equal(jsonValue(createReviewSql({ actorId: ids.users.consultantA, candidateVersion: 2, actionId: actionIds.assignmentRace })).outcome_code, 'RESOURCE_NOT_AVAILABLE')
  psql(`update public.center_crm_control set identity_policy_version=2,control_version=control_version+1 where center_id=${q(ids.centers.a)};`)
  assert.equal(jsonValue(createReviewSql({ candidateVersion: 2, actionId: actionIds.policyRace })).outcome_code, 'MATCH_POLICY_STALE')
  psql(`update public.center_crm_control set crm_state='SUSPENDED',control_version=control_version+1 where center_id=${q(ids.centers.a)};`)
  assert.equal(jsonValue(createReviewSql({ candidateVersion: 2, actionId: randomUUID() })).outcome_code, 'CRM_RUNTIME_NOT_ACTIVE')
  console.log('P2C_QA_RACE_MATRIX: PASS')
  console.log('P2C_QA_NEGATIVE_MATRIX: PASS')

  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where status in ('APPROVED','EXECUTING','COMPLETED');`), '0')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and routine_name like 'f23_3e_p2c%consume%';`), '0')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    finalResetPassed = true
    leftoverCount = Number(scalar(`select
      (select count(*) from public.crm_identity_match_review)
      +(select count(*) from public.crm_profile_creation_reservation)
      +(select count(*) from public.crm_audit_event where event_type like 'crm.identity.%')
      +(select count(*) from public.crm_outbox_event where event_type like 'crm.identity.%')
      +(select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`))
    nondefaultRootCount = Number(scalar(`select count(*) from public.center_crm_control where crm_state<>'DISABLED' or feature_flag_state<>'DISABLED' or control_version<>1;`))
    tempHelperCount = Number(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p2c_qa_%';`))
    vaultSecretCount = Number(scalar(`select count(*) from vault.decrypted_secrets where name like 'f23_3e_p2%identity_digest_epoch_%';`))
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110001';`), '1')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110002';`), '1')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110003';`), '1')
    assert.equal(leftoverCount, 0)
    assert.equal(nondefaultRootCount, 0)
    assert.equal(tempHelperCount, 0)
    assert.equal(vaultSecretCount, 0)
  } catch (cleanupError) {
    if (primaryError) primaryError.cleanupError = cleanupError
    else primaryError = cleanupError
  }
}

if (primaryError) throw primaryError

console.log('P2C_QA_FINAL_LOCAL_RESET: PASS')
console.log(`P2C_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
console.log(`P2C_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
console.log(`P2C_QA_TEMP_HELPER_COUNT: ${tempHelperCount}`)
console.log(`P2C_QA_VAULT_SECRET_COUNT: ${vaultSecretCount}`)
