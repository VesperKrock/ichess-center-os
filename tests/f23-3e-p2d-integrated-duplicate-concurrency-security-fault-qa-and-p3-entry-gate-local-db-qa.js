import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P2D_LOCAL_QA_ALLOW_RESET'
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
console.log('P2D_QA_LOCAL_SAFETY_GUARD: PASS')

const runReset = () => requireSuccess(
  run(localCommand, localArgs('db reset'), { timeout: 240_000 }),
  'local Supabase database reset',
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
const waitForLock = async (applicationName, label) => {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const waiting = scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name=${q(applicationName)};`)
    if (waiting === 't') return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`${label} did not exhibit a real PostgreSQL lock wait`)
}
const lockRace = async ({ holderName, holderSql, holderMarker, contenderName, contenderSql, contenderMarker, expected }) => {
  const holder = collect(spawnPsql())
  holder.child.stdin.write(`begin; set statement_timeout='20s'; set application_name=${q(holderName)}; ${holderSql}\n\\echo ${holderMarker}\n`)
  await holder.marker(holderMarker)
  const contender = collect(spawnPsql())
  contender.child.stdin.end(`set statement_timeout='20s'; set application_name=${q(contenderName)}; ${contenderSql}\n\\echo ${contenderMarker}\n`)
  await waitForLock(contenderName, contenderName)
  holder.child.stdin.end('commit; \\q\n')
  await holder.done
  const result = await contender.done
  assert(result.stdout.includes(contenderMarker), `${contenderName} did not complete`)
  if (expected) assert.match(result.stdout, expected)
  return result.stdout
}

const ids = {
  centers: { a: `p2dqa-${randomUUID()}`, b: `p2dqa-${randomUUID()}` },
  users: {
    ownerA: randomUUID(), adminA: randomUUID(), consultantA: randomUUID(),
    unassignedA: randomUUID(), inactiveA: randomUUID(), ownerB: randomUUID(),
  },
  memberships: Array.from({ length: 6 }, () => randomUUID()),
  contacts: { a: randomUUID(), b: randomUUID() },
  cases: { a: randomUUID(), b: randomUUID() },
  assignments: { a: randomUUID(), b: randomUUID() },
  candidates: {
    strong: randomUUID(), conflict: randomUUID(), noMatch: randomUUID(), foreign: randomUUID(),
  },
  requestRegistry: { a: randomUUID(), b: randomUUID() },
  requests: { a: randomUUID(), b: randomUUID() },
  policies: { studentA: randomUUID(), guardianA: randomUUID(), studentB: randomUUID() },
  students: { exact1: randomUUID(), exact2: randomUUID(), conflict: randomUUID(), foreign: randomUUID() },
}
const evidence = {
  strongName: 'Synthetic P2D Alpha', strongBirth: '2012-03-04',
  conflictName: 'Synthetic P2D Conflict', conflictBirth: '2013-04-05',
  noMatchName: 'Synthetic P2D No Match', noMatchBirth: '2014-05-06',
}
const actionIds = Object.fromEntries([
  'strong', 'create', 'cancel', 'expire', 'expiryRace', 'outageReserve',
  'ownerScope', 'adminScope', 'consultantScope', 'sameKey', 'differentKey',
  'reviewRace', 'reservationRace', 'sourceRace', 'targetRace', 'policyRace',
  'requestCancelRace', 'assignmentRace', 'suspendRace', 'reviewFault',
  'reservationFault', 'auditFault', 'outboxFault', 'lockProbe',
].map((name) => [name, randomUUID()]))
let idempotencyCounter = 32
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
const searchSql = (overrides = {}, role = 'service_role') => {
  const a = baseArgs(overrides)
  return `set role ${role}; select public.f23_3e_p2b_search_masked_candidates(${u(a.requestId)},${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},${q(a.birthDate)}::date,${a.birthYear ?? 'null'},${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},${a.policyRegistryVersion},${a.adapterVersion}); reset role;`
}
const assertNoAuthority = (result) => {
  for (const field of ['profile_created', 'profile_reused', 'conversion_approved', 'request_completed']) {
    assert.equal(result[field], false, `${field} must remain false`)
  }
}
const assertEventPair = (result) => {
  assert.match(result.correlation_id, /^[0-9a-f-]{36}$/i)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where correlation_id=${u(result.correlation_id)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where safe_payload->>'correlation_id'=${q(result.correlation_id)};`), '1')
  const versions = scalar(`select a.resource_id::text||'|'||a.new_version::text||'|'||o.aggregate_id::text||'|'||o.event_version::text from public.crm_audit_event a join public.crm_outbox_event o on o.safe_payload->>'correlation_id'=a.correlation_id::text where a.correlation_id=${u(result.correlation_id)};`)
  assert.equal(versions, `${result.resource_id}|${result.resource_version}|${result.resource_id}|${result.resource_version}`)
}
const stateVector = () => scalar(`select
  (select count(*) from public.crm_identity_match_review)||'|'||
  (select count(*) from public.crm_profile_creation_reservation)||'|'||
  (select count(*) from public.crm_audit_event)||'|'||
  (select count(*) from public.crm_outbox_event)||'|'||
  (select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%');`)
const forceExpiredReservation = (reservationId) => psql(`
  alter table public.crm_profile_creation_reservation disable trigger f23_3e_p2a_profile_creation_reservation_guard;
  update public.crm_profile_creation_reservation
  set created_at=now()-interval '10 minutes',updated_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute'
  where reservation_id=${u(reservationId)};
  alter table public.crm_profile_creation_reservation enable trigger f23_3e_p2a_profile_creation_reservation_guard;
`)

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1
let tempHelperCount = -1
let vaultSecretCount = -1

try {
  runReset()
  containerId = discoverContainer()
  console.log('P2D_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110001';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110002';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110003';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where name like 'f23_3e_p2d%';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f23_3e_p2b_search_masked_candidates','f23_3e_p2b_get_masked_candidate_review_detail') and p.prosecdef;`), '2')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2c_%' and p.proname not like 'f23_3e_p2c_internal_%' and p.prosecdef;`), '8')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and routine_name like 'f23_3e_p2c%consume%';`), '0')
  assert.equal(scalar(`select count(*) from information_schema.tables where table_schema='public' and (table_name like '%guardian%' or table_name like '%relationship%' or table_name like '%student_profile%');`), '0')

  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['crm_identity_policy_registry', 'crm_identity_match_mutex', 'crm_identity_match_review', 'crm_profile_creation_reservation']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT');`), 'f')
    }
  }
  expectSqlFailure(searchSql({}, 'anon'), /permission denied/i)
  expectSqlFailure(searchSql({}, 'authenticated'), /permission denied/i)
  expectSqlFailure(`set role service_role; select public.f23_3e_p2b_internal_digest_key(1);`, /permission denied/i)
  expectSqlFailure(`set role service_role; select public.f23_3e_p2c_internal_safe_result('X');`, /permission denied/i)

  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P2D ephemeral synthetic local QA only');`)
  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
${Object.values(ids.users).map((id) => `(${u(id)},'authenticated','authenticated',now(),now())`).join(',\n')};
insert into public.centers(id,name) values
(${q(ids.centers.a)},'p2d synthetic center a'),(${q(ids.centers.b)},'p2d synthetic center b');
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
(${u(ids.candidates.conflict)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.conflictName)}),
(${u(ids.candidates.noMatch)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.noMatchName)}),
(${u(ids.candidates.foreign)},${q(ids.centers.b)},${u(ids.cases.b)},${q(evidence.noMatchName)});
insert into public.crm_idempotency_registry(idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,consultation_case_id,operation,idempotency_key_digest,intent_digest,request_intent_digest,action_graph_digest,expires_at) values
(${u(ids.requestRegistry.a)},${bytea('a1')},${q(ids.centers.a)},'consultation_case',${u(ids.cases.a)},${u(ids.cases.a)},'p2d.qa.request',${bytea('a2')},${bytea('a3')},${bytea('a4')},${bytea('a5')},now()+interval '1 day'),
(${u(ids.requestRegistry.b)},${bytea('b1')},${q(ids.centers.b)},'consultation_case',${u(ids.cases.b)},${u(ids.cases.b)},'p2d.qa.request',${bytea('b2')},${bytea('b3')},${bytea('b4')},${bytea('b5')},now()+interval '1 day');
insert into public.crm_conversion_request(conversion_request_id,center_id,consultation_case_id,source_contact_id,source_case_version,source_contact_version,source_assignment_id,source_assignment_version,identity_policy_version,conversion_policy_version,relationship_policy_version,student_profile_policy_version,action_graph_digest,idempotency_scope,idempotency_key_reference,intent_digest,requested_by_user_id) values
(${u(ids.requests.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.contacts.a)},2,1,${u(ids.assignments.a)},1,1,1,1,1,${bytea('a5')},'p2d.qa',${u(ids.requestRegistry.a)},${bytea('a6')},${u(ids.users.ownerA)}),
(${u(ids.requests.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.contacts.b)},2,1,${u(ids.assignments.b)},1,1,1,1,1,${bytea('b5')},'p2d.qa',${u(ids.requestRegistry.b)},${bytea('b6')},${u(ids.users.ownerB)});
insert into public.crm_identity_policy_registry(identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,center_identity_policy_version,normalization_algorithm,normalization_version,digest_key_epoch,match_policy_version,minimum_evidence_policy_version) values
(${u(ids.policies.studentA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.guardianA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.studentB)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.b)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where identity_policy_registry_id in (${u(ids.policies.studentA)},${u(ids.policies.guardianA)},${u(ids.policies.studentB)});
insert into public.center_cloud_entities(id,center_id,entity_type,local_id,payload,source_module,source_version) values
(${u(ids.students.exact1)},${q(ids.centers.a)},'student','p2d-synthetic-exact-1',${q(JSON.stringify({ id: 'p2d-synthetic-exact-1', fullName: evidence.strongName, birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.exact2)},${q(ids.centers.a)},'student','p2d-synthetic-exact-2',${q(JSON.stringify({ id: 'p2d-synthetic-exact-2', fullName: evidence.strongName, birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.conflict)},${q(ids.centers.a)},'student','p2d-synthetic-conflict',${q(JSON.stringify({ id: 'p2d-synthetic-conflict', fullName: evidence.conflictName, birthDate: '2011-02-03', isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.foreign)},${q(ids.centers.b)},'student','p2d-synthetic-foreign',${q(JSON.stringify({ id: 'p2d-synthetic-foreign', fullName: evidence.strongName, birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1');
  `)

  const strongArgs = {
    candidateId: ids.candidates.strong,
    displayName: evidence.strongName,
    birthDate: evidence.strongBirth,
    actionId: actionIds.strong,
  }
  const strongSearch = jsonValue(searchSql(strongArgs))
  assert.equal(strongSearch.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(strongSearch.match_outcome, 'PROBABLE_MATCH')
  assert.equal(strongSearch.safe_reason_code, 'NAME_AND_BIRTH_EXACT_CANDIDATE')
  assert.equal(strongSearch.candidates.length, 2)
  assert(strongSearch.candidates.every((candidate) => candidate.reuse_eligible === false && candidate.create_authority === false))
  assert(!JSON.stringify(strongSearch).includes(evidence.strongName))
  assert(!JSON.stringify(strongSearch).includes(evidence.strongBirth))

  const nameOnly = jsonValue(searchSql({ ...strongArgs, birthDate: null, birthYear: null }))
  const birthOnly = jsonValue(searchSql({ ...strongArgs, displayName: null }))
  const partialBirth = jsonValue(searchSql({ ...strongArgs, birthDate: null, birthYear: 2012 }))
  for (const result of [nameOnly, birthOnly, partialBirth]) {
    assert.equal(result.outcome_code, 'INSUFFICIENT_IDENTITY_EVIDENCE')
    assert.notEqual(result.outcome_code, 'NO_MATCH')
  }
  const contradiction = jsonValue(searchSql({
    candidateId: ids.candidates.conflict,
    displayName: evidence.conflictName,
    birthDate: evidence.conflictBirth,
    actionId: randomUUID(),
  }))
  assert.equal(contradiction.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(contradiction.match_outcome, 'CONFLICT')
  assert.equal(contradiction.safe_reason_code, 'CONTRADICTORY_EVIDENCE')
  assert.equal(contradiction.candidates.length, 0)

  const strongTarget = strongSearch.candidates[0]
  const strongOverrides = { ...strongArgs, targetId: strongTarget.opaque_target_id, targetVersion: strongTarget.target_version }
  const strongKey = nextIdempotency()
  const strongReview = jsonValue(createReviewSql(strongOverrides, strongKey))
  assert.equal(strongReview.status, 'PENDING')
  assertNoAuthority(strongReview)
  assertEventPair(strongReview)
  const strongReplay = jsonValue(createReviewSql(strongOverrides, strongKey))
  assert.equal(strongReplay.replayed, true)
  assert.equal(strongReplay.resource_id, strongReview.resource_id)
  assert.equal(strongReplay.resource_version, strongReview.resource_version)
  assert.equal(strongReplay.correlation_id, strongReview.correlation_id)
  assertEventPair(strongReplay)
  const strongReuseDenied = jsonValue(reviewMutationSql('f23_3e_p2c_decide_match_review', strongReview.resource_id, 1, strongOverrides, nextIdempotency(), 'REUSE_EXISTING'))
  const strongCreateDenied = jsonValue(reviewMutationSql('f23_3e_p2c_decide_match_review', strongReview.resource_id, 1, strongOverrides, nextIdempotency(), 'PREPARE_CREATE_NEW'))
  const strongReserveDenied = jsonValue(reviewMutationSql('f23_3e_p2c_reserve_create_target', strongReview.resource_id, 1, strongOverrides, nextIdempotency()))
  for (const denied of [strongReuseDenied, strongCreateDenied]) {
    assert.equal(denied.outcome_code, 'MATCH_REVIEW_REQUIRED')
    assertNoAuthority(denied)
  }
  assert.equal(strongReserveDenied.outcome_code, 'MATCH_REVIEW_STALE')
  assertNoAuthority(strongReserveDenied)
  assert.equal(scalar(`select review_status from public.crm_identity_match_review where match_review_id=${u(strongReview.resource_id)};`), 'PENDING')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where match_review_id=${u(strongReview.resource_id)};`), '0')
  console.log('P2D_QA_STRONG_DUPLICATE_REVIEW_ONLY: PASS')

  const noMatchSearch = jsonValue(searchSql())
  assert.equal(noMatchSearch.outcome_code, 'NO_MATCH')
  assert.equal(noMatchSearch.match_outcome, 'NO_MATCH')
  assert.equal(noMatchSearch.adapter_completeness, 'COMPLETE')
  assert.equal(noMatchSearch.candidates.length, 0)
  assert.equal(noMatchSearch.create_authority, false)

  const createReviewKey = nextIdempotency()
  const createReview = jsonValue(createReviewSql({}, createReviewKey))
  assert.equal(createReview.status, 'PENDING')
  assertNoAuthority(createReview)
  assertEventPair(createReview)
  const createReviewReplay = jsonValue(createReviewSql({}, createReviewKey))
  assert.equal(createReviewReplay.replayed, true)
  assert.equal(createReviewReplay.resource_id, createReview.resource_id)
  assert.equal(createReviewReplay.resource_version, createReview.resource_version)
  assert.equal(createReviewReplay.correlation_id, createReview.correlation_id)
  assertEventPair(createReviewReplay)

  const decisionKey = nextIdempotency()
  const createDecision = jsonValue(reviewMutationSql('f23_3e_p2c_decide_match_review', createReview.resource_id, 1, {}, decisionKey, 'PREPARE_CREATE_NEW'))
  assert.equal(createDecision.status, 'CREATE_NEW_REVIEWED')
  assert.equal(createDecision.resource_version, 2)
  assertNoAuthority(createDecision)
  assertEventPair(createDecision)
  const decisionReplay = jsonValue(reviewMutationSql('f23_3e_p2c_decide_match_review', createReview.resource_id, 1, {}, decisionKey, 'PREPARE_CREATE_NEW'))
  assert.equal(decisionReplay.replayed, true)
  assert.equal(decisionReplay.resource_id, createDecision.resource_id)
  assert.equal(decisionReplay.resource_version, createDecision.resource_version)
  assert.equal(decisionReplay.correlation_id, createDecision.correlation_id)
  assertEventPair(decisionReplay)

  const reservationKey = nextIdempotency()
  const reservation = jsonValue(reviewMutationSql('f23_3e_p2c_reserve_create_target', createReview.resource_id, 2, {}, reservationKey))
  assert.equal(reservation.status, 'ACTIVE')
  assert.match(reservation.opaque_target_id, /^[0-9a-f-]{36}$/i)
  assertNoAuthority(reservation)
  assertEventPair(reservation)
  const reservationReplay = jsonValue(reviewMutationSql('f23_3e_p2c_reserve_create_target', createReview.resource_id, 2, {}, reservationKey))
  assert.equal(reservationReplay.replayed, true)
  assert.equal(reservationReplay.resource_id, reservation.resource_id)
  assert.equal(reservationReplay.resource_version, reservation.resource_version)
  assert.equal(reservationReplay.opaque_target_id, reservation.opaque_target_id)
  assert.equal(reservationReplay.correlation_id, reservation.correlation_id)
  assertEventPair(reservationReplay)
  const statusRead = jsonValue(`set role service_role; select public.f23_3e_p2c_read_creation_reservation_status(${u(ids.requests.a)},${u(reservation.resource_id)},1,${u(ids.users.ownerA)}); reset role;`)
  assert.equal(statusRead.status, 'ACTIVE')
  assert.equal(statusRead.current_code, 'ACTIVE')
  assert.equal(statusRead.opaque_target_id, reservation.opaque_target_id)
  assertNoAuthority(statusRead)
  console.log('P2D_QA_NO_MATCH_TO_ACTIVE_RESERVATION_CHAIN: PASS')
  console.log('P2D_QA_P2_NEVER_GRANTS_CONVERSION_AUTHORITY: PASS')

  expectSqlFailure(`update public.crm_profile_creation_reservation set preallocated_target_id=${u(randomUUID())} where reservation_id=${u(reservation.resource_id)};`, /binding_is_immutable/i)
  expectSqlFailure(`update public.crm_profile_creation_reservation set conversion_request_id=${u(ids.requests.b)} where reservation_id=${u(reservation.resource_id)};`, /binding_is_immutable|foreign key|exact_center/i)

  const makeCreateNew = (actionId, extra = {}) => {
    const overrides = { actionId, ...extra }
    const review = jsonValue(createReviewSql(overrides))
    assert.equal(review.status, 'PENDING')
    assertEventPair(review)
    const decision = jsonValue(reviewMutationSql('f23_3e_p2c_decide_match_review', review.resource_id, 1, overrides, nextIdempotency(), 'PREPARE_CREATE_NEW'))
    assert.equal(decision.status, 'CREATE_NEW_REVIEWED')
    assertEventPair(decision)
    return { overrides, review, decision }
  }
  const reserveCreateNew = (chain) => {
    const result = jsonValue(reviewMutationSql('f23_3e_p2c_reserve_create_target', chain.review.resource_id, 2, chain.overrides, nextIdempotency()))
    assert.equal(result.status, 'ACTIVE')
    assertEventPair(result)
    return result
  }

  const cancellationKey = nextIdempotency()
  const cancelled = jsonValue(reservationMutationSql('f23_3e_p2c_cancel_creation_reservation', reservation.resource_id, 1, {}, cancellationKey))
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(cancelled.resource_version, 2)
  assertNoAuthority(cancelled)
  assertEventPair(cancelled)
  const cancelledReplay = jsonValue(reservationMutationSql('f23_3e_p2c_cancel_creation_reservation', reservation.resource_id, 1, {}, cancellationKey))
  assert.equal(cancelledReplay.replayed, true)
  assert.equal(cancelledReplay.resource_id, cancelled.resource_id)
  assert.equal(cancelledReplay.resource_version, cancelled.resource_version)
  assert.equal(cancelledReplay.correlation_id, cancelled.correlation_id)
  assertEventPair(cancelledReplay)

  const expireChain = makeCreateNew(actionIds.expire)
  const expirable = reserveCreateNew(expireChain)
  forceExpiredReservation(expirable.resource_id)
  const expirationKey = nextIdempotency()
  const expired = jsonValue(reservationMutationSql('f23_3e_p2c_expire_creation_reservation', expirable.resource_id, 1, expireChain.overrides, expirationKey))
  assert.equal(expired.status, 'EXPIRED')
  assert.equal(expired.resource_version, 2)
  assertNoAuthority(expired)
  assertEventPair(expired)
  const expiredReplay = jsonValue(reservationMutationSql('f23_3e_p2c_expire_creation_reservation', expirable.resource_id, 1, expireChain.overrides, expirationKey))
  assert.equal(expiredReplay.replayed, true)
  assert.equal(expiredReplay.resource_id, expired.resource_id)
  assert.equal(expiredReplay.resource_version, expired.resource_version)
  assert.equal(expiredReplay.correlation_id, expired.correlation_id)
  assertEventPair(expiredReplay)
  expectSqlFailure(`update public.crm_identity_match_review set review_status='PENDING' where match_review_id=${u(expireChain.review.resource_id)};`, /terminal_review_is_immutable/i)
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and routine_name like 'f23_3e_p2c%consume%';`), '0')
  console.log('P2D_QA_RESERVATION_CONSUME_BLOCKED_UNTIL_P3: PASS')
  console.log('P2D_QA_INTEGRATED_IDEMPOTENCY: PASS')

  const deniedResults = []
  for (const actorId of [ids.users.unassignedA, ids.users.inactiveA, ids.users.ownerB]) {
    deniedResults.push(jsonValue(createReviewSql({ actorId, actionId: randomUUID() })))
  }
  assert(deniedResults.every((result) => result.outcome_code === 'RESOURCE_NOT_AVAILABLE'))
  assert.deepEqual(deniedResults[0], deniedResults[1])
  assert.deepEqual(deniedResults[1], deniedResults[2])
  const foreignRequest = jsonValue(createReviewSql({
    requestId: ids.requests.b, actorId: ids.users.ownerA, candidateId: ids.candidates.foreign,
    displayName: evidence.strongName, birthDate: evidence.strongBirth, actionId: randomUUID(),
  }))
  assert.equal(foreignRequest.outcome_code, 'RESOURCE_NOT_AVAILABLE')
  const foreignSearch = jsonValue(searchSql({
    requestId: ids.requests.b, actorId: ids.users.ownerA, candidateId: ids.candidates.foreign,
    displayName: evidence.strongName, birthDate: evidence.strongBirth,
  }))
  assert.equal(foreignSearch.outcome_code, 'RESOURCE_NOT_AVAILABLE')
  assert(!strongSearch.candidates.some((candidate) => candidate.opaque_candidate_id === ids.students.foreign))
  console.log('P2D_QA_EXACT_CENTER_NON_DISCLOSURE: PASS')

  for (const [actorId, actionId] of [
    [ids.users.ownerA, actionIds.ownerScope],
    [ids.users.adminA, actionIds.adminScope],
    [ids.users.consultantA, actionIds.consultantScope],
  ]) {
    const scoped = jsonValue(createReviewSql({ actorId, actionId }))
    assert.equal(scoped.status, 'PENDING')
    assertEventPair(scoped)
  }
  console.log('P2D_QA_MULTI_ACCOUNT_SCOPE: PASS')

  const rpcBody = (overrides = {}) => {
    const a = baseArgs(overrides)
    return {
      p_conversion_request_id: a.requestId,
      p_actor_user_id: a.actorId,
      p_expected_request_version: a.requestVersion,
      p_identity_kind: a.identityKind,
      p_candidate_student_id: a.candidateId,
      p_expected_contact_version: a.contactVersion,
      p_expected_case_version: a.caseVersion,
      p_expected_candidate_version: a.candidateVersion,
      p_display_name_evidence: a.displayName,
      p_birth_date_evidence: a.birthDate,
      p_birth_year_evidence: a.birthYear,
      p_expected_normalization_version: a.normalizationVersion,
      p_expected_match_policy_version: a.matchPolicyVersion,
      p_expected_minimum_evidence_policy_version: a.minimumEvidencePolicyVersion,
      p_expected_policy_registry_version: a.policyRegistryVersion,
      p_expected_adapter_version: a.adapterVersion,
    }
  }
  const postRpc = (rpc, apikey, bearer, body) => fetch(`${localStatus.API_URL}/rest/v1/rpc/${rpc}`, {
    method: 'POST', headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const authEmail = ['p2d-', randomUUID()].join('') + '@' + ['example', 'invalid'].join('.')
  const authPassword = ['P2D!', randomUUID(), 'Aa9'].join('')
  const authCreate = await fetch(`${localStatus.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: localStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${localStatus.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword, email_confirm: true }),
  })
  assert([200, 201].includes(authCreate.status), `local synthetic auth create status ${authCreate.status}`)
  const authLogin = await fetch(`${localStatus.API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: localStatus.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, password: authPassword }),
  })
  assert.equal(authLogin.status, 200)
  const authenticatedToken = (await authLogin.json()).access_token
  assert.equal(typeof authenticatedToken, 'string')

  for (const [apikey, bearer] of [
    [localStatus.ANON_KEY, localStatus.ANON_KEY],
    [localStatus.ANON_KEY, authenticatedToken],
  ]) {
    const searchDenied = await postRpc('f23_3e_p2b_search_masked_candidates', apikey, bearer, rpcBody())
    assert([401, 403, 404].includes(searchDenied.status), `P2B direct denied status ${searchDenied.status}`)
    const statusDenied = await postRpc('f23_3e_p2c_read_creation_reservation_status', apikey, bearer, {
      p_conversion_request_id: ids.requests.a,
      p_reservation_id: reservation.resource_id,
      p_expected_reservation_version: 2,
      p_actor_user_id: ids.users.ownerA,
    })
    assert([401, 403, 404].includes(statusDenied.status), `P2C direct denied status ${statusDenied.status}`)
  }
  const serviceSearch = await postRpc('f23_3e_p2b_search_masked_candidates', localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY, rpcBody())
  assert.equal(serviceSearch.status, 200)
  assert.equal((await serviceSearch.json()).outcome_code, 'NO_MATCH')
  const serviceStatus = await postRpc('f23_3e_p2c_read_creation_reservation_status', localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY, {
    p_conversion_request_id: ids.requests.a,
    p_reservation_id: reservation.resource_id,
    p_expected_reservation_version: 2,
    p_actor_user_id: ids.users.ownerA,
  })
  assert.equal(serviceStatus.status, 200)
  assert.equal((await serviceStatus.json()).status, 'CANCELLED')
  for (const [apikey, bearer] of [
    [localStatus.ANON_KEY, localStatus.ANON_KEY],
    [localStatus.ANON_KEY, authenticatedToken],
    [localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY],
  ]) {
    const tableDenied = await fetch(`${localStatus.API_URL}/rest/v1/crm_identity_match_review?select=match_review_id`, {
      headers: { apikey, Authorization: `Bearer ${bearer}` },
    })
    assert([401, 403, 404].includes(tableDenied.status), `P2A table direct denied status ${tableDenied.status}`)
  }
  console.log('P2D_QA_DIRECT_API_FAIL_CLOSED: PASS')

  const failureBefore = stateVector()
  let ephemeralDigestKey = scalar(`select decrypted_secret from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1';`)
  assert.match(ephemeralDigestKey, /^[0-9A-Fa-f]{64}$/)
  psql(`delete from vault.secrets where name='f23_3e_p2b_identity_digest_epoch_1';`)
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  expectSqlFailure(createReviewSql({ actionId: randomUUID() }), /f23_3e_p2b_protected_key_unavailable/i)
  assert.equal(stateVector(), failureBefore)
  psql(`select vault.create_secret(${q(ephemeralDigestKey)},'f23_3e_p2b_identity_digest_epoch_1','P2D ephemeral synthetic local QA restored');`)
  ephemeralDigestKey = null
  for (const [overrides, expected] of [
    [{ adapterVersion: 2 }, 'MATCH_SEARCH_UNAVAILABLE'],
    [{ identityKind: 'GUARDIAN' }, 'MATCH_SEARCH_UNAVAILABLE'],
    [{ normalizationVersion: 2 }, 'NORMALIZER_STALE'],
    [{ matchPolicyVersion: 2 }, 'MATCH_POLICY_STALE'],
    [{ minimumEvidencePolicyVersion: 2 }, 'MATCH_POLICY_STALE'],
    [{ requestVersion: 2 }, 'SOURCE_VERSION_STALE'],
    [{ displayName: '' }, 'MATCH_SEARCH_UNAVAILABLE'],
  ]) {
    const failed = jsonValue(searchSql(overrides))
    assert.equal(failed.outcome_code, expected)
    assert.notEqual(failed.outcome_code, 'NO_MATCH')
  }
  psql(`update public.center_cloud_entities set source_version='p2d-unknown-version' where id=${u(ids.students.conflict)};`)
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  psql(`update public.center_cloud_entities set source_version='c2-online-core-v1' where id=${u(ids.students.conflict)};`)

  const outageChain = makeCreateNew(actionIds.outageReserve)
  const beforeBlockedReservation = stateVector()
  psql(`update public.center_cloud_entities set payload=pg_catalog.jsonb_set(payload,'{fullName}','[]'::jsonb) where id=${u(ids.students.conflict)};`)
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  const blockedReservation = jsonValue(reviewMutationSql('f23_3e_p2c_reserve_create_target', outageChain.review.resource_id, 2, outageChain.overrides, nextIdempotency()))
  assert(['MATCH_SEARCH_UNAVAILABLE', 'RESERVATION_STALE'].includes(blockedReservation.outcome_code))
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where match_review_id=${u(outageChain.review.resource_id)};`), '0')
  psql(`update public.center_cloud_entities set payload=pg_catalog.jsonb_set(payload,'{fullName}',pg_catalog.to_jsonb(${q(evidence.conflictName)}::text)) where id=${u(ids.students.conflict)};`)

  const adapterHolder = collect(spawnPsql())
  adapterHolder.child.stdin.write(`begin; set application_name='p2d_adapter_fault'; select 1 from public.center_cloud_entities where id=${u(ids.students.exact1)} for update; \\echo P2D_ADAPTER_READY\n`)
  await adapterHolder.marker('P2D_ADAPTER_READY')
  assert.equal(jsonValue(searchSql(strongArgs)).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  adapterHolder.child.stdin.end('rollback; \\q\n')
  await adapterHolder.done

  const mutexHolder = collect(spawnPsql())
  mutexHolder.child.stdin.write(`begin; set application_name='p2d_mutex_fault'; select 1 from public.crm_identity_match_mutex where center_id=${q(ids.centers.a)} for update; \\echo P2D_MUTEX_READY\n`)
  await mutexHolder.marker('P2D_MUTEX_READY')
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  mutexHolder.child.stdin.end('rollback; \\q\n')
  await mutexHolder.done
  assert.equal(stateVector(), beforeBlockedReservation)
  console.log('P2D_QA_SEARCH_FAILURE_NEVER_BECOMES_NO_MATCH: PASS')

  const beforeReviewFault = stateVector()
  psql(`create function public.p2d_qa_fail_review() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p2d_qa_review_fault'; end$$;
create trigger p2d_qa_fail_review before insert on public.crm_identity_match_review for each row execute function public.p2d_qa_fail_review();`)
  expectSqlFailure(createReviewSql({ actionId: actionIds.reviewFault }), /p2d_qa_review_fault/i)
  psql(`drop trigger p2d_qa_fail_review on public.crm_identity_match_review; drop function public.p2d_qa_fail_review();`)
  assert.equal(stateVector(), beforeReviewFault)

  const reservationFaultChain = makeCreateNew(actionIds.reservationFault)
  const beforeReservationFault = stateVector()
  psql(`create function public.p2d_qa_fail_reservation() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p2d_qa_reservation_fault'; end$$;
create trigger p2d_qa_fail_reservation before insert on public.crm_profile_creation_reservation for each row execute function public.p2d_qa_fail_reservation();`)
  expectSqlFailure(reviewMutationSql('f23_3e_p2c_reserve_create_target', reservationFaultChain.review.resource_id, 2, reservationFaultChain.overrides, nextIdempotency()), /p2d_qa_reservation_fault/i)
  psql(`drop trigger p2d_qa_fail_reservation on public.crm_profile_creation_reservation; drop function public.p2d_qa_fail_reservation();`)
  assert.equal(stateVector(), beforeReservationFault)

  for (const [kind, table, actionId] of [
    ['audit', 'crm_audit_event', actionIds.auditFault],
    ['outbox', 'crm_outbox_event', actionIds.outboxFault],
  ]) {
    const before = stateVector()
    psql(`create function public.p2d_qa_fail_${kind}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p2d_qa_${kind}_fault'; end$$;
create trigger p2d_qa_fail_${kind} before insert on public.${table} for each row execute function public.p2d_qa_fail_${kind}();`)
    expectSqlFailure(createReviewSql({ actionId }), new RegExp(`p2d_qa_${kind}_fault`, 'i'))
    psql(`drop trigger p2d_qa_fail_${kind} on public.${table}; drop function public.p2d_qa_fail_${kind}();`)
    assert.equal(stateVector(), before)
  }
  console.log('P2D_QA_FAULT_ROLLBACK: PASS')

  const identityAuditCount = Number(scalar(`select count(*) from public.crm_audit_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`))
  const identityOutboxCount = Number(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`))
  const identityCompletedCount = Number(scalar(`select count(*) from public.crm_idempotency_registry where center_id=${q(ids.centers.a)} and operation like 'crm.identity.%' and status='COMPLETED';`))
  assert.equal(identityAuditCount, identityOutboxCount)
  assert.equal(identityAuditCount, identityCompletedCount)
  assert.equal(scalar(`select count(*) from public.crm_audit_event a left join public.crm_outbox_event o on o.safe_payload->>'correlation_id'=a.correlation_id::text where a.center_id=${q(ids.centers.a)} and a.event_type like 'crm.identity.%' and o.outbox_event_id is null;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event o left join public.crm_audit_event a on a.correlation_id::text=o.safe_payload->>'correlation_id' where o.center_id=${q(ids.centers.a)} and o.event_type like 'crm.identity.%' and a.audit_event_id is null;`), '0')
  const serializedEvents = scalar(`select coalesce(string_agg(safe_payload::text,' '),'') from public.crm_outbox_event where center_id=${q(ids.centers.a)} and event_type like 'crm.identity.%';`)
  for (const raw of Object.values(evidence)) assert(!serializedEvents.includes(raw))
  assert(!/identity_match_mutex_key|evidence_digest|projection_digest|normalized_value|phone|email/i.test(serializedEvents))
  console.log('P2D_QA_INTEGRATED_AUDIT_OUTBOX: PASS')

  const sameKey = nextIdempotency()
  await lockRace({
    holderName: 'p2d_same_key_a',
    holderSql: createReviewSql({ actionId: actionIds.sameKey }, sameKey),
    holderMarker: 'P2D_SAME_KEY_A_READY',
    contenderName: 'p2d_same_key_b',
    contenderSql: createReviewSql({ actionId: actionIds.sameKey }, sameKey),
    contenderMarker: 'P2D_SAME_KEY_B_DONE',
    expected: /"replayed": true|"replayed":true/i,
  })

  const differentKey = nextIdempotency()
  await lockRace({
    holderName: 'p2d_diff_key_a',
    holderSql: createReviewSql({ actionId: actionIds.differentKey }, differentKey),
    holderMarker: 'P2D_DIFF_KEY_A_READY',
    contenderName: 'p2d_diff_key_b',
    contenderSql: createReviewSql({ actionId: randomUUID() }, differentKey),
    contenderMarker: 'P2D_DIFF_KEY_B_DONE',
    expected: /IDEMPOTENCY_CONFLICT/,
  })

  await lockRace({
    holderName: 'p2d_review_race_a',
    holderSql: createReviewSql({ actionId: actionIds.reviewRace }, nextIdempotency()),
    holderMarker: 'P2D_REVIEW_RACE_A_READY',
    contenderName: 'p2d_review_race_b',
    contenderSql: createReviewSql({ actionId: actionIds.reviewRace }, nextIdempotency()),
    contenderMarker: 'P2D_REVIEW_RACE_B_DONE',
    expected: /MATCH_REVIEW_CONFLICT/,
  })
  assert.equal(scalar(`select count(*) from public.crm_identity_match_review where action_id=${u(actionIds.reviewRace)};`), '1')

  const reservationRaceChain = makeCreateNew(actionIds.reservationRace)
  await lockRace({
    holderName: 'p2d_reserve_race_a',
    holderSql: reviewMutationSql('f23_3e_p2c_reserve_create_target', reservationRaceChain.review.resource_id, 2, reservationRaceChain.overrides, nextIdempotency()),
    holderMarker: 'P2D_RESERVE_RACE_A_READY',
    contenderName: 'p2d_reserve_race_b',
    contenderSql: reviewMutationSql('f23_3e_p2c_reserve_create_target', reservationRaceChain.review.resource_id, 2, reservationRaceChain.overrides, nextIdempotency()),
    contenderMarker: 'P2D_RESERVE_RACE_B_DONE',
    expected: /RESERVATION_CONFLICT/,
  })
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where action_id=${u(actionIds.reservationRace)};`), '1')

  const expiryRaceChain = makeCreateNew(actionIds.expiryRace)
  const expiryRaceReservation = reserveCreateNew(expiryRaceChain)
  forceExpiredReservation(expiryRaceReservation.resource_id)
  await lockRace({
    holderName: 'p2d_expiry_race_a',
    holderSql: reservationMutationSql('f23_3e_p2c_expire_creation_reservation', expiryRaceReservation.resource_id, 1, expiryRaceChain.overrides, nextIdempotency()),
    holderMarker: 'P2D_EXPIRY_RACE_A_READY',
    contenderName: 'p2d_expiry_race_b',
    contenderSql: reservationMutationSql('f23_3e_p2c_cancel_creation_reservation', expiryRaceReservation.resource_id, 1, expiryRaceChain.overrides, nextIdempotency()),
    contenderMarker: 'P2D_EXPIRY_RACE_B_DONE',
    expected: /RESERVATION_CONFLICT/,
  })

  const sourceHolder = collect(spawnPsql())
  sourceHolder.child.stdin.write(`begin; set application_name='p2d_source_holder'; update public.consultation_case_candidate_student set candidate_version=2 where candidate_student_id=${u(ids.candidates.noMatch)}; \\echo P2D_SOURCE_READY\n`)
  await sourceHolder.marker('P2D_SOURCE_READY')
  const sourceContender = collect(spawnPsql())
  sourceContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_source_contender'; ${createReviewSql({ actionId: actionIds.sourceRace })} \\echo P2D_SOURCE_DONE\n`)
  await waitForLock('p2d_source_contender', 'source update versus review')
  sourceHolder.child.stdin.end('commit; \\q\n')
  await sourceHolder.done
  assert.match((await sourceContender.done).stdout, /SOURCE_VERSION_STALE/)

  const targetHolder = collect(spawnPsql())
  targetHolder.child.stdin.write(`begin; set application_name='p2d_target_holder'; update public.center_cloud_entities set payload=payload||'{"qaRevision":1}'::jsonb where id=${u(strongTarget.opaque_target_id)}; \\echo P2D_TARGET_READY\n`)
  await targetHolder.marker('P2D_TARGET_READY')
  const targetContender = collect(spawnPsql())
  targetContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_target_contender'; ${createReviewSql({ ...strongOverrides, actionId: actionIds.targetRace })} \\echo P2D_TARGET_DONE\n`)
  await waitForLock('p2d_target_contender', 'target update versus review')
  targetHolder.child.stdin.end('commit; \\q\n')
  await targetHolder.done
  assert.match((await targetContender.done).stdout, /TARGET_VERSION_STALE/)

  const policyHolder = collect(spawnPsql())
  policyHolder.child.stdin.write(`begin; set application_name='p2d_policy_holder'; update public.center_crm_control set identity_policy_version=2,control_version=control_version+1 where center_id=${q(ids.centers.a)}; \\echo P2D_POLICY_READY\n`)
  await policyHolder.marker('P2D_POLICY_READY')
  const policyContender = collect(spawnPsql())
  policyContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_policy_contender'; ${createReviewSql({ candidateVersion: 2, actionId: actionIds.policyRace })} \\echo P2D_POLICY_DONE\n`)
  await waitForLock('p2d_policy_contender', 'policy rollout versus mutation')
  policyHolder.child.stdin.end('commit; \\q\n')
  await policyHolder.done
  assert.match((await policyContender.done).stdout, /MATCH_POLICY_STALE/)
  psql(`update public.center_crm_control set identity_policy_version=1,control_version=control_version+1 where center_id=${q(ids.centers.a)};`)

  const cancelRaceOverrides = {
    requestId: ids.requests.b,
    actorId: ids.users.ownerB,
    candidateId: ids.candidates.foreign,
    displayName: evidence.noMatchName,
    birthDate: evidence.noMatchBirth,
  }
  const cancelRaceChain = makeCreateNew(actionIds.requestCancelRace, cancelRaceOverrides)
  const cancelHolder = collect(spawnPsql())
  cancelHolder.child.stdin.write(`begin; set statement_timeout='20s'; set application_name='p2d_cancel_holder'; set role service_role;
select * from public.f23_3e_p1b_cancel_conversion_request(${u(ids.requests.b)},${u(ids.users.ownerB)},1,2,1,${bytea('c1')},${bytea('c2')},${bytea('c3')},'p2d_qa_cancel',now()+interval '1 hour'); reset role;
\\echo P2D_CANCEL_READY\n`)
  await cancelHolder.marker('P2D_CANCEL_READY')
  const cancelContender = collect(spawnPsql())
  cancelContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_cancel_contender'; ${reviewMutationSql('f23_3e_p2c_reserve_create_target', cancelRaceChain.review.resource_id, 2, cancelRaceChain.overrides, nextIdempotency())} \\echo P2D_CANCEL_DONE\n`)
  await waitForLock('p2d_cancel_contender', 'Request cancellation versus reservation')
  cancelHolder.child.stdin.end('commit; \\q\n')
  await cancelHolder.done
  assert.match((await cancelContender.done).stdout, /SOURCE_VERSION_STALE/)
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where action_id=${u(actionIds.requestCancelRace)};`), '0')

  const assignmentHolder = collect(spawnPsql())
  assignmentHolder.child.stdin.write(`begin; set constraints all deferred; set application_name='p2d_assign_holder'; update public.consultation_case set active_assignment_id=null,case_version=case_version+1 where consultation_case_id=${u(ids.cases.a)}; update public.consultation_case_assignment set assignment_status='REVOKED',assignment_version=2,ended_at=now(),end_reason='p2d_qa_revoke' where assignment_id=${u(ids.assignments.a)}; \\echo P2D_ASSIGN_READY\n`)
  await assignmentHolder.marker('P2D_ASSIGN_READY')
  const assignmentContender = collect(spawnPsql())
  assignmentContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_assign_contender'; ${createReviewSql({ actorId: ids.users.consultantA, candidateVersion: 2, actionId: actionIds.assignmentRace })} \\echo P2D_ASSIGN_DONE\n`)
  await waitForLock('p2d_assign_contender', 'Assignment revoke versus mutation')
  assignmentHolder.child.stdin.end('commit; \\q\n')
  await assignmentHolder.done
  assert.match((await assignmentContender.done).stdout, /RESOURCE_NOT_AVAILABLE|SOURCE_VERSION_STALE/)

  const suspendHolder = collect(spawnPsql())
  suspendHolder.child.stdin.write(`begin; set application_name='p2d_suspend_holder'; update public.center_crm_control set crm_state='SUSPENDED',control_version=control_version+1 where center_id=${q(ids.centers.a)}; \\echo P2D_SUSPEND_READY\n`)
  await suspendHolder.marker('P2D_SUSPEND_READY')
  const suspendContender = collect(spawnPsql())
  suspendContender.child.stdin.end(`set statement_timeout='20s'; set application_name='p2d_suspend_contender'; ${createReviewSql({ candidateVersion: 2, actionId: actionIds.suspendRace })} \\echo P2D_SUSPEND_DONE\n`)
  await waitForLock('p2d_suspend_contender', 'center suspension versus mutation')
  suspendHolder.child.stdin.end('commit; \\q\n')
  await suspendHolder.done
  assert.match((await suspendContender.done).stdout, /CRM_RUNTIME_NOT_ACTIVE/)
  console.log('P2D_QA_REAL_LOCK_WAIT_OBSERVED: PASS')
  console.log('P2D_QA_CANONICAL_LOCK_ORDER: PASS')
  console.log('P2D_QA_RACE_MATRIX_16: PASS')

  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where status in ('APPROVED','EXECUTING','COMPLETED');`), '0')
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.centers.a)} and entity_type='student';`), '3')
  assert.equal(scalar(`select count(*) from information_schema.tables where table_schema='public' and (table_name like '%guardian%' or table_name like '%relationship%' or table_name like '%student_profile%');`), '0')
  assert.equal(scalar(`select count(*) from public.crm_identity_match_mutex where pg_catalog.octet_length(identity_match_mutex_key)<>32;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_identity_match_review where review_status='PENDING' and reviewer_user_id is not null;`), '0')
  console.log('P2D_QA_NEGATIVE_MATRIX_24: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110001';`), '1')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110002';`), '1')
    assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608110003';`), '1')
    const fixtureCount = Number(scalar(`select
      (select count(*) from public.centers where id like 'p2dqa-%')+
      (select count(*) from public.center_cloud_entities where local_id like 'p2d-synthetic-%')+
      (select count(*) from auth.users where email like 'p2d-%');`))
    const reviewCount = Number(scalar(`select count(*) from public.crm_identity_match_review;`))
    const reservationCount = Number(scalar(`select count(*) from public.crm_profile_creation_reservation;`))
    const auditCount = Number(scalar(`select count(*) from public.crm_audit_event where event_type like 'crm.identity.%';`))
    const outboxCount = Number(scalar(`select count(*) from public.crm_outbox_event where event_type like 'crm.identity.%';`))
    const idempotencyCount = Number(scalar(`select count(*) from public.crm_idempotency_registry where operation like 'crm.identity.%';`))
    leftoverCount = fixtureCount + reviewCount + reservationCount + auditCount + outboxCount + idempotencyCount
    nondefaultRootCount = Number(scalar(`select count(*) from public.center_crm_control where crm_state<>'DISABLED' or feature_flag_state<>'DISABLED' or control_version<>1;`))
    tempHelperCount = Number(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p2d_qa_%';`))
    vaultSecretCount = Number(scalar(`select count(*) from vault.decrypted_secrets where name like 'f23_3e_p2%identity_digest_epoch_%';`))
    assert.equal(fixtureCount, 0)
    assert.equal(reviewCount, 0)
    assert.equal(reservationCount, 0)
    assert.equal(auditCount, 0)
    assert.equal(outboxCount, 0)
    assert.equal(idempotencyCount, 0)
    assert.equal(leftoverCount, 0)
    assert.equal(nondefaultRootCount, 0)
    assert.equal(tempHelperCount, 0)
    assert.equal(vaultSecretCount, 0)
    finalResetPassed = true
  } catch (cleanupError) {
    if (primaryError) primaryError = new AggregateError([primaryError, cleanupError], 'P2D QA and final reset both failed')
    else primaryError = cleanupError
  }
}

if (primaryError) throw primaryError
assert(finalResetPassed)
console.log('P2D_QA_FINAL_LOCAL_RESET: PASS')
console.log(`P2D_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
console.log(`P2D_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
console.log(`P2D_QA_TEMP_HELPER_COUNT: ${tempHelperCount}`)
console.log(`P2D_QA_VAULT_SECRET_COUNT: ${vaultSecretCount}`)
console.log('F23.3E-P2D integrated local Docker QA passed')
