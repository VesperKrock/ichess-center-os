import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P2B_LOCAL_QA_ALLOW_RESET'
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
assert.equal(typeof localStatus.API_URL, 'string', 'Local status omitted API_URL')
assert.equal(typeof localStatus.ANON_KEY, 'string', 'Local status omitted ANON_KEY')
assert.equal(typeof localStatus.SERVICE_ROLE_KEY, 'string', 'Local status omitted SERVICE_ROLE_KEY')
assertLoopback(new URL(localStatus.DB_URL).hostname, 'Supabase local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'Supabase local API')

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
console.log('P2B_QA_LOCAL_SAFETY_GUARD: PASS')

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
  centers: { a: `p2bqa-${randomUUID()}`, b: `p2bqa-${randomUUID()}` },
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
  idempotency: { a: randomUUID(), b: randomUUID() },
  requests: { a: randomUUID(), b: randomUUID() },
  policies: { studentA: randomUUID(), guardianA: randomUUID(), studentB: randomUUID() },
  students: {
    exact1: randomUUID(), exact2: randomUUID(), conflict: randomUUID(), foreign: randomUUID(),
  },
}
const fixtureIds = [
  ...Object.values(ids.centers), ...Object.values(ids.users), ...ids.memberships,
  ...Object.values(ids.contacts), ...Object.values(ids.cases),
  ...Object.values(ids.assignments), ...Object.values(ids.candidates),
  ...Object.values(ids.idempotency), ...Object.values(ids.requests),
  ...Object.values(ids.policies), ...Object.values(ids.students),
]

const evidence = {
  strongName: 'Synthetic P2B Alpha', strongBirth: '2012-03-04',
  conflictName: 'Synthetic P2B Conflict', conflictBirth: '2013-04-05',
  noMatchName: 'Synthetic P2B No Match', noMatchBirth: '2014-05-06',
}

const searchArgs = (overrides = {}) => ({
  requestId: ids.requests.a,
  actorId: ids.users.ownerA,
  requestVersion: 1,
  identityKind: 'STUDENT',
  candidateId: ids.candidates.strong,
  contactVersion: 1,
  caseVersion: 2,
  candidateVersion: 1,
  displayName: evidence.strongName,
  birthDate: evidence.strongBirth,
  birthYear: null,
  normalizationVersion: 1,
  matchPolicyVersion: 1,
  minimumEvidencePolicyVersion: 1,
  policyRegistryVersion: 2,
  adapterVersion: 1,
  ...overrides,
})
const searchSql = (overrides = {}, { role = 'service_role' } = {}) => {
  const a = searchArgs(overrides)
  return `set role ${role}; select public.f23_3e_p2b_search_masked_candidates(
    ${u(a.requestId)},${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},
    ${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},
    ${a.birthDate ? `${q(a.birthDate)}::date` : 'null::date'},${a.birthYear ?? 'null'},
    ${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},
    ${a.policyRegistryVersion},${a.adapterVersion}); reset role;`
}
const rpcBody = (overrides = {}) => {
  const a = searchArgs(overrides)
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

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1
let tempHelperCount = -1

try {
  runReset()
  containerId = discoverContainer()
  console.log('P2B_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110002' and name='f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search';`), '1')
  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110001' and name='f23_3e_p2a_identity_review_mutex_reservation_schema_foundation';`), '1')
  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f23_3e_p2b_search_masked_candidates','f23_3e_p2b_get_masked_candidate_review_detail') and p.prosecdef and p.proconfig @> array['search_path=""'];`), '2')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2b_internal_%' and (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') or pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'));`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from information_schema.tables where table_schema='public' and table_name like 'f23_3e_p2b%';`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from vault.decrypted_secrets where name like 'f23_3e_p2b_identity_digest_epoch_%';`), '0')

  expectSqlFailure(`set role service_role; select public.f23_3e_p2b_internal_digest_key(1);`, /permission denied/i)
  expectSqlFailure(`select public.f23_3e_p2b_internal_normalize_student_name_v1('');`, /name_evidence_invalid/i)
  expectSqlFailure(`select public.f23_3e_p2b_internal_normalize_student_name_v1(pg_catalog.repeat('x',241));`, /name_evidence_invalid/i)
  assert.equal(scalar(`select public.f23_3e_p2b_internal_normalize_student_name_v1(U&'P2B T\\00EA\\0301ST')=public.f23_3e_p2b_internal_normalize_student_name_v1(U&'  p2b   t\\1EBFst  ');`), 't')
  assert.equal(scalar(`select public.f23_3e_p2b_internal_normalize_student_name_v1(U&'P2B d\\1EA5u')<>public.f23_3e_p2b_internal_normalize_student_name_v1('P2B dau');`), 't')
  assert.equal(scalar(`select public.f23_3e_p2b_internal_normalize_student_name_v1(U&'P2B\\2019 TOKEN')=public.f23_3e_p2b_internal_normalize_student_name_v1('p2b''token');`), 't')
  assert.equal(scalar(`select public.f23_3e_p2b_internal_normalize_student_birth_v1(date '2012-03-04');`), '2012-03-04')
  expectSqlFailure(`select public.f23_3e_p2b_internal_normalize_student_birth_v1(date '1899-12-31');`, /birth_evidence_invalid/i)

  psql(`select vault.create_secret(
    pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),
    'f23_3e_p2b_identity_digest_epoch_1',
    'P2B local synthetic ephemeral QA only'
  );`)
  assert.equal(scalar(`select pg_catalog.count(*) from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1' and decrypted_secret ~ '^[0-9A-Fa-f]{64}$';`), '1')
  assert.equal(scalar(`
with k as (select public.f23_3e_p2b_internal_digest_key(1) value), d as (
  select
    public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',1,'STUDENT','STUDENT_DISPLAY_NAME','synthetic',1) a,
    public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',1,'STUDENT','STUDENT_DISPLAY_NAME','synthetic',1) b,
    public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',1,'STUDENT','STUDENT_BIRTH_DATE','synthetic',1) c,
    public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',1,'GUARDIAN','STUDENT_DISPLAY_NAME','synthetic',1) d,
    public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',2,'STUDENT','STUDENT_DISPLAY_NAME','synthetic',1) e
  from k
) select a=b and a<>c and a<>d and a<>e and pg_catalog.octet_length(a)=32 from d;`), 't')
  assert.equal(scalar(`
with k as (select public.f23_3e_p2b_internal_digest_key(1) value), e as (
 select public.f23_3e_p2b_internal_evidence_digest(k.value,'p2b.student_identity.nfc_casefold_v1',1,'STUDENT','STUDENT_DISPLAY_NAME','synthetic',1) d,k.value from k
) select public.f23_3e_p2b_internal_mutex_key(value,decode(repeat('11',32),'hex'),'center-a','STUDENT',1,d)
 <> public.f23_3e_p2b_internal_mutex_key(value,decode(repeat('11',32),'hex'),'center-b','STUDENT',1,d) from e;`), 't')
  console.log('P2B_QA_PROTECTED_DIGEST_KEY_SOURCE: PASS')
  console.log('P2B_QA_VERSIONED_NAME_NORMALIZATION: PASS')
  console.log('P2B_QA_VERSIONED_BIRTH_NORMALIZATION: PASS')
  console.log('P2B_QA_DIGEST_DOMAIN_SEPARATION: PASS')

  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
${Object.values(ids.users).map((id) => `(${u(id)},'authenticated','authenticated',pg_catalog.now(),pg_catalog.now())`).join(',\n')};
insert into public.centers(id,name) values
(${q(ids.centers.a)},'p2b synthetic center a'),(${q(ids.centers.b)},'p2b synthetic center b');
update public.center_crm_control
set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2
where center_id in (${q(ids.centers.a)},${q(ids.centers.b)});
insert into public.center_members(id,center_id,user_id,role,status) values
(${u(ids.memberships[0])},${q(ids.centers.a)},${u(ids.users.ownerA)},'owner','active'),
(${u(ids.memberships[1])},${q(ids.centers.a)},${u(ids.users.adminA)},'center_admin','active'),
(${u(ids.memberships[2])},${q(ids.centers.a)},${u(ids.users.consultantA)},'consultant','active'),
(${u(ids.memberships[3])},${q(ids.centers.a)},${u(ids.users.unassignedA)},'consultant','active'),
(${u(ids.memberships[4])},${q(ids.centers.a)},${u(ids.users.inactiveA)},'owner','inactive'),
(${u(ids.memberships[5])},${q(ids.centers.b)},${u(ids.users.ownerB)},'owner','active');
insert into public.crm_contact(
  crm_contact_id,center_id,source_category,protected_contact_methods_ciphertext,
  contact_methods_crypto_version,normalized_lookup_digests,normalization_version,created_by_user_id
) values
(${u(ids.contacts.a)},${q(ids.centers.a)},'synthetic',${bytea('41',16)},1,${digestArray('42')},1,${u(ids.users.ownerA)}),
(${u(ids.contacts.b)},${q(ids.centers.b)},'synthetic',${bytea('43',16)},1,${digestArray('44')},1,${u(ids.users.ownerB)});
insert into public.consultation_case(
  consultation_case_id,center_id,primary_contact_id,created_by_user_id
) values
(${u(ids.cases.a)},${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.users.ownerA)}),
(${u(ids.cases.b)},${q(ids.centers.b)},${u(ids.contacts.b)},${u(ids.users.ownerB)});
begin;
set constraints all deferred;
insert into public.consultation_case_assignment(
  assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id
) values
(${u(ids.assignments.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.users.consultantA)},${u(ids.users.ownerA)}),
(${u(ids.assignments.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.users.ownerB)},${u(ids.users.ownerB)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values (${u(ids.cases.a)},${u(ids.assignments.a)}),(${u(ids.cases.b)},${u(ids.assignments.b)})) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id;
commit;
insert into public.consultation_case_candidate_student(
  candidate_student_id,center_id,consultation_case_id,display_name_evidence
) values
(${u(ids.candidates.strong)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.strongName)}),
(${u(ids.candidates.conflict)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.conflictName)}),
(${u(ids.candidates.noMatch)},${q(ids.centers.a)},${u(ids.cases.a)},${q(evidence.noMatchName)}),
(${u(ids.candidates.foreign)},${q(ids.centers.b)},${u(ids.cases.b)},${q(evidence.strongName)});
insert into public.crm_idempotency_registry(
  idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,
  resource_scope_id,consultation_case_id,operation,idempotency_key_digest,
  intent_digest,request_intent_digest,action_graph_digest,expires_at
) values
(${u(ids.idempotency.a)},${bytea('a1')},${q(ids.centers.a)},'consultation_case',${u(ids.cases.a)},${u(ids.cases.a)},'p2b.qa.request',${bytea('a2')},${bytea('a3')},${bytea('a4')},${bytea('a5')},pg_catalog.transaction_timestamp()+interval '1 day'),
(${u(ids.idempotency.b)},${bytea('b1')},${q(ids.centers.b)},'consultation_case',${u(ids.cases.b)},${u(ids.cases.b)},'p2b.qa.request',${bytea('b2')},${bytea('b3')},${bytea('b4')},${bytea('b5')},pg_catalog.transaction_timestamp()+interval '1 day');
insert into public.crm_conversion_request(
  conversion_request_id,center_id,consultation_case_id,source_contact_id,
  source_case_version,source_contact_version,source_assignment_id,source_assignment_version,
  identity_policy_version,conversion_policy_version,relationship_policy_version,
  student_profile_policy_version,action_graph_digest,idempotency_scope,
  idempotency_key_reference,intent_digest,requested_by_user_id
) values
(${u(ids.requests.a)},${q(ids.centers.a)},${u(ids.cases.a)},${u(ids.contacts.a)},2,1,${u(ids.assignments.a)},1,1,1,1,1,${bytea('a5')},'p2b.qa',${u(ids.idempotency.a)},${bytea('a6')},${u(ids.users.ownerA)}),
(${u(ids.requests.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.contacts.b)},2,1,${u(ids.assignments.b)},1,1,1,1,1,${bytea('b5')},'p2b.qa',${u(ids.idempotency.b)},${bytea('b6')},${u(ids.users.ownerB)});
insert into public.crm_identity_policy_registry(
  identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,
  center_identity_policy_version,normalization_algorithm,normalization_version,
  digest_key_epoch,match_policy_version,minimum_evidence_policy_version
) values
(${u(ids.policies.studentA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.guardianA)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.a)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.policies.studentB)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.centers.b)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2
where identity_policy_registry_id in (${u(ids.policies.studentA)},${u(ids.policies.guardianA)},${u(ids.policies.studentB)});
insert into public.center_cloud_entities(
  id,center_id,entity_type,local_id,payload,source_module,source_version
) values
(${u(ids.students.exact1)},${q(ids.centers.a)},'student','p2b-synthetic-exact-1',
 ${q(JSON.stringify({ id: 'p2b-synthetic-exact-1', fullName: '  SYNTHETIC   P2B ALPHA ', birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.exact2)},${q(ids.centers.a)},'student','p2b-synthetic-exact-2',
 ${q(JSON.stringify({ id: 'p2b-synthetic-exact-2', fullName: 'Synthetic P2B Alpha', birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
(${u(ids.students.conflict)},${q(ids.centers.a)},'student','p2b-synthetic-conflict',
 ${q(JSON.stringify({ id: 'p2b-synthetic-conflict', fullName: evidence.conflictName, birthDate: '2011-02-03', isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1'),
  (${u(ids.students.foreign)},${q(ids.centers.b)},'student','p2b-synthetic-foreign',
 ${q(JSON.stringify({ id: 'p2b-synthetic-foreign', fullName: evidence.strongName, birthDate: evidence.strongBirth, isDeleted: false }))}::jsonb,'localStorage','c2-online-core-v1');
  `)

  let ephemeralDigestKey = scalar(`select decrypted_secret from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1';`)
  assert.match(ephemeralDigestKey, /^[0-9A-Fa-f]{64}$/)
  psql(`delete from vault.secrets where name='f23_3e_p2b_identity_digest_epoch_1';`)
  assert.equal(scalar(`select pg_catalog.count(*) from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1';`), '0')
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  psql(`select vault.create_secret(
    ${q(ephemeralDigestKey)},
    'f23_3e_p2b_identity_digest_epoch_1',
    'P2B local synthetic ephemeral QA only restored after fault injection'
  );`)
  ephemeralDigestKey = null
  assert.equal(scalar(`select pg_catalog.count(*) from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1';`), '1')
  assert.equal(jsonValue(searchSql({ displayName: '' })).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')

  const strong = jsonValue(searchSql())
  assert.equal(strong.ok, true, `Strong-search safe result: ${JSON.stringify(strong)}`)
  assert.equal(strong.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(strong.match_outcome, 'PROBABLE_MATCH')
  assert.equal(strong.safe_reason_code, 'NAME_AND_BIRTH_EXACT_CANDIDATE')
  assert.equal(strong.candidate_count_capped, 2)
  assert.equal(strong.candidates.length, 2)
  assert(strong.candidates.every((item) => item.reuse_eligible === false && item.create_authority === false))
  assert(strong.candidates.every((item) => item.match_reason_codes.includes('NAME_AND_BIRTH_EXACT_CANDIDATE')))
  assert(!JSON.stringify(strong).includes(evidence.strongName))
  assert(!JSON.stringify(strong).includes(evidence.strongBirth))
  assert(!JSON.stringify(strong).includes('canonical_normalized_identity_digest'))
  assert(!JSON.stringify(strong).includes('identity_match_mutex_key'))
  assert.equal(strong.projection_cache_policy, 'NO_STORE')
  assert.equal(strong.creates_match_review, false)
  assert.equal(strong.creates_reservation, false)
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_mutex where center_id=${q(ids.centers.a)} and identity_kind='STUDENT';`), '2')
  assert.equal(scalar(`select pg_catalog.count(distinct identity_match_mutex_key) from public.crm_identity_match_mutex where center_id=${q(ids.centers.a)} and identity_kind='STUDENT';`), '2')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_review where center_id=${q(ids.centers.a)};`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_profile_creation_reservation where center_id=${q(ids.centers.a)};`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(ids.centers.a)};`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(ids.centers.a)};`), '0')
  console.log('P2B_QA_RAW_NORMALIZED_VALUE_NOT_PERSISTED: PASS')
  console.log('P2B_QA_SORTED_MUTEX_LOCKING: PASS')
  console.log('P2B_QA_STUDENT_ADAPTER_EXACT_CENTER: PASS')
  console.log('P2B_QA_STUDENT_ADAPTER_MASKED_ONLY: PASS')
  console.log('P2B_QA_NAME_BIRTH_STRONG_DUPLICATE_REVIEW: PASS')
  console.log('P2B_QA_MULTI_CANDIDATE_REVIEW_REQUIRED: PASS')
  console.log('P2B_QA_NO_RAW_PII_SERIALIZATION: PASS')
  console.log('P2B_QA_NO_STORE_PROJECTION: PASS')

  const conflict = jsonValue(searchSql({
    candidateId: ids.candidates.conflict,
    displayName: evidence.conflictName,
    birthDate: evidence.conflictBirth,
  }))
  assert.equal(conflict.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(conflict.match_outcome, 'CONFLICT')
  assert.equal(conflict.safe_reason_code, 'CONTRADICTORY_EVIDENCE')
  assert.equal(conflict.candidates.length, 0)
  const nameOnly = jsonValue(searchSql({ birthDate: null, birthYear: 2012 }))
  assert.equal(nameOnly.outcome_code, 'INSUFFICIENT_IDENTITY_EVIDENCE')
  const birthOnly = jsonValue(searchSql({ displayName: null }))
  assert.equal(birthOnly.outcome_code, 'INSUFFICIENT_IDENTITY_EVIDENCE')
  console.log('P2B_QA_NAME_ONLY_NOT_IDENTITY: PASS')
  console.log('P2B_QA_BIRTH_ONLY_NOT_IDENTITY: PASS')

  const noMatch = jsonValue(searchSql({
    candidateId: ids.candidates.noMatch,
    displayName: evidence.noMatchName,
    birthDate: evidence.noMatchBirth,
  }))
  assert.equal(noMatch.ok, true)
  assert.equal(noMatch.outcome_code, 'NO_MATCH')
  assert.equal(noMatch.create_authority, false)
  assert.equal(noMatch.review_requirement, 'REVIEW_STILL_REQUIRED_BEFORE_CREATE')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_review where center_id=${q(ids.centers.a)};`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_profile_creation_reservation where center_id=${q(ids.centers.a)};`), '0')
  console.log('P2B_QA_COMPLETE_NO_MATCH: PASS')
  console.log('P2B_QA_NO_MATCH_NOT_CREATE_AUTHORITY: PASS')

  for (const actorId of [ids.users.ownerA, ids.users.adminA, ids.users.consultantA]) {
    assert.equal(jsonValue(searchSql({ actorId })).outcome_code, 'MATCH_REVIEW_REQUIRED')
  }
  for (const actorId of [ids.users.unassignedA, ids.users.inactiveA, ids.users.ownerB]) {
    const denied = jsonValue(searchSql({ actorId }))
    assert.deepEqual(Object.keys(denied).sort(), [
      'candidate_projection_version', 'ok', 'outcome_code', 'projection_cache_policy', 'server_time',
    ])
    assert.equal(denied.outcome_code, 'RESOURCE_NOT_AVAILABLE')
  }
  assert(!strong.candidates.some((item) => item.opaque_candidate_id === ids.students.foreign))
  console.log('P2B_QA_CROSS_CENTER_NON_DISCLOSURE: PASS')
  console.log('P2B_QA_MULTI_ACCOUNT_SCOPE: PASS')

  assert.equal(jsonValue(searchSql({ normalizationVersion: 2 })).outcome_code, 'NORMALIZER_STALE')
  assert.equal(jsonValue(searchSql({ matchPolicyVersion: 2 })).outcome_code, 'MATCH_POLICY_STALE')
  assert.equal(jsonValue(searchSql({ minimumEvidencePolicyVersion: 2 })).outcome_code, 'MATCH_POLICY_STALE')
  assert.equal(jsonValue(searchSql({ requestVersion: 2 })).outcome_code, 'SOURCE_VERSION_STALE')
  assert.equal(jsonValue(searchSql({ adapterVersion: 2 })).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  assert.equal(jsonValue(searchSql({ identityKind: 'GUARDIAN' })).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  console.log('P2B_QA_NORMALIZER_STALE: PASS')
  console.log('P2B_QA_POLICY_STALE: PASS')
  console.log('P2B_QA_SOURCE_STALE: PASS')

  const detailTarget = strong.candidates[0]
  const a = searchArgs()
  const detailSql = `set role service_role; select public.f23_3e_p2b_get_masked_candidate_review_detail(
    ${u(a.requestId)},${u(a.actorId)},${a.requestVersion},${q(a.identityKind)},${u(a.candidateId)},
    ${a.contactVersion},${a.caseVersion},${a.candidateVersion},${q(a.displayName)},${q(a.birthDate)}::date,
    null,${a.normalizationVersion},${a.matchPolicyVersion},${a.minimumEvidencePolicyVersion},
    ${a.policyRegistryVersion},${a.adapterVersion},${u(detailTarget.opaque_candidate_id)},${detailTarget.target_version}); reset role;`
  const detail = jsonValue(detailSql)
  assert.equal(detail.candidates.length, 1)
  assert.equal(detail.candidates[0].opaque_candidate_id, detailTarget.opaque_candidate_id)
  const staleDetail = jsonValue(detailSql.replace(`,${detailTarget.target_version});`, `,${detailTarget.target_version + 1});`))
  assert.equal(staleDetail.outcome_code, 'TARGET_VERSION_STALE')

  expectSqlFailure(searchSql({}, { role: 'anon' }), /permission denied/i)
  expectSqlFailure(searchSql({}, { role: 'authenticated' }), /permission denied/i)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['crm_identity_policy_registry', 'crm_identity_match_mutex', 'crm_identity_match_review', 'crm_profile_creation_reservation']) {
      assert.equal(scalar(`select pg_catalog.has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT');`), 'f')
    }
  }

  const rpcUrl = `${localStatus.API_URL}/rest/v1/rpc/f23_3e_p2b_search_masked_candidates`
  const anonResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { apikey: localStatus.ANON_KEY, Authorization: `Bearer ${localStatus.ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcBody()),
  })
  assert([401, 403, 404].includes(anonResponse.status), `anon RPC status was ${anonResponse.status}`)
  const serviceResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { apikey: localStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${localStatus.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcBody()),
  })
  assert.equal(serviceResponse.status, 200)
  assert.match(serviceResponse.headers.get('cache-control') || '', /no-store/i)
  const apiResult = await serviceResponse.json()
  assert.equal(apiResult.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert(!JSON.stringify(apiResult).includes(evidence.strongName))
  assert(!JSON.stringify(apiResult).includes(evidence.strongBirth))
  console.log('P2B_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS')

  psql(`update public.center_cloud_entities set source_version='p2b-unknown-version' where id=${u(ids.students.conflict)};`)
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  psql(`update public.center_cloud_entities set source_version='c2-online-core-v1' where id=${u(ids.students.conflict)};`)
  psql(`update public.center_cloud_entities set payload=pg_catalog.jsonb_set(payload,'{fullName}','[]'::jsonb) where id=${u(ids.students.conflict)};`)
  assert.equal(jsonValue(searchSql()).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  psql(`update public.center_cloud_entities set payload=pg_catalog.jsonb_set(payload,'{fullName}',pg_catalog.to_jsonb(${q(evidence.conflictName)}::text)) where id=${u(ids.students.conflict)};`)

  const adapterHolderState = collect(spawnPsql())
  adapterHolderState.child.stdin.write(`begin; set application_name='p2b_adapter_holder'; select 1 from public.center_cloud_entities where id=${u(ids.students.exact1)} for update; \\echo P2B_ADAPTER_HOLDER_READY\n`)
  await adapterHolderState.marker('P2B_ADAPTER_HOLDER_READY')
  const adapterTimeout = jsonValue(searchSql())
  assert.equal(adapterTimeout.outcome_code, 'MATCH_SEARCH_UNAVAILABLE')
  adapterHolderState.child.stdin.end('rollback; \\q\n')
  await adapterHolderState.done
  console.log('P2B_QA_ADAPTER_COMPLETENESS_FAIL_CLOSED: PASS')

  const holderState = collect(spawnPsql())
  holderState.child.stdin.write(`begin; set application_name='p2b_search_holder'; ${searchSql()} \\echo P2B_SEARCH_HOLDER_READY\n`)
  await holderState.marker('P2B_SEARCH_HOLDER_READY')
  const contenderState = collect(spawnPsql())
  contenderState.child.stdin.end(`set application_name='p2b_search_contender'; ${searchSql()} \\echo P2B_SEARCH_CONTENDER_DONE\n`)
  let observedWait = false
  const waitDeadline = Date.now() + 10_000
  while (Date.now() < waitDeadline) {
    const waitState = scalar(`select coalesce(pg_catalog.bool_or(wait_event_type='Lock' and pg_catalog.cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2b_search_contender';`)
    if (waitState === 't') { observedWait = true; break }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(observedWait, 'Second equivalent search was not observed waiting on the canonical lock chain')
  holderState.child.stdin.end('commit; \\q\n')
  await holderState.done
  const contenderOutput = await contenderState.done
  assert(contenderOutput.stdout.includes('P2B_SEARCH_CONTENDER_DONE'))
  assert(contenderOutput.stdout.includes('MATCH_REVIEW_REQUIRED'))
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_mutex where center_id=${q(ids.centers.a)} and identity_kind='STUDENT';`), '6')
  console.log('P2B_QA_MUTEX_CONCURRENCY_LIVENESS: PASS')

  const sourceHolderState = collect(spawnPsql())
  sourceHolderState.child.stdin.write(`begin; set application_name='p2b_source_updater'; update public.consultation_case_candidate_student set candidate_version=2 where candidate_student_id=${u(ids.candidates.strong)}; \\echo P2B_SOURCE_UPDATE_READY\n`)
  await sourceHolderState.marker('P2B_SOURCE_UPDATE_READY')
  const sourceContenderState = collect(spawnPsql())
  sourceContenderState.child.stdin.end(`set application_name='p2b_source_search'; ${searchSql()} \\echo P2B_SOURCE_SEARCH_DONE\n`)
  let sourceWaitObserved = false
  const sourceWaitDeadline = Date.now() + 10_000
  while (Date.now() < sourceWaitDeadline) {
    if (scalar(`select coalesce(pg_catalog.bool_or(wait_event_type='Lock' and pg_catalog.cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2b_source_search';`) === 't') {
      sourceWaitObserved = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(sourceWaitObserved, 'Search/source update race did not exhibit a real lock wait')
  sourceHolderState.child.stdin.end('commit; \\q\n')
  await sourceHolderState.done
  const sourceContenderOutput = await sourceContenderState.done
  assert(sourceContenderOutput.stdout.includes('SOURCE_VERSION_STALE'))

  const currentCandidateVersionArgs = { candidateVersion: 2 }
  const strongNameMutexHex = scalar(`
    with p as (
      select * from public.crm_identity_policy_registry
      where identity_policy_registry_id=${u(ids.policies.studentA)}
    ), k as (
      select public.f23_3e_p2b_internal_digest_key(1) value
    )
    select pg_catalog.encode(public.f23_3e_p2b_internal_mutex_key(
      k.value,p.environment_fingerprint,p.center_id,'STUDENT',p.normalization_version,
      public.f23_3e_p2b_internal_evidence_digest(
        k.value,p.normalization_algorithm,p.normalization_version,'STUDENT',
        'STUDENT_DISPLAY_NAME',
        public.f23_3e_p2b_internal_normalize_student_name_v1(${q(evidence.strongName)}),
        p.digest_key_epoch
      )
    ),'hex') from p cross join k;
  `)
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_identity_match_mutex where identity_match_mutex_key=pg_catalog.decode(${q(strongNameMutexHex)},'hex') and status='ACTIVE';`), '1')
  psql(`update public.crm_identity_match_mutex set status='RETIRED',mutex_version=mutex_version+1 where identity_match_mutex_key=pg_catalog.decode(${q(strongNameMutexHex)},'hex');`)
  assert.equal(jsonValue(searchSql(currentCandidateVersionArgs)).outcome_code, 'MATCH_SEARCH_UNAVAILABLE')

  const policyHolderState = collect(spawnPsql())
  policyHolderState.child.stdin.write(`begin; set application_name='p2b_policy_rollout'; update public.center_crm_control set identity_policy_version=2,control_version=3 where center_id=${q(ids.centers.a)}; \\echo P2B_POLICY_ROLLOUT_READY\n`)
  await policyHolderState.marker('P2B_POLICY_ROLLOUT_READY')
  const policyContenderState = collect(spawnPsql())
  policyContenderState.child.stdin.end(`set application_name='p2b_policy_search'; ${searchSql(currentCandidateVersionArgs)} \\echo P2B_POLICY_SEARCH_DONE\n`)
  let policyWaitObserved = false
  const policyWaitDeadline = Date.now() + 10_000
  while (Date.now() < policyWaitDeadline) {
    if (scalar(`select coalesce(pg_catalog.bool_or(wait_event_type='Lock' and pg_catalog.cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name='p2b_policy_search';`) === 't') {
      policyWaitObserved = true; break
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert(policyWaitObserved, 'Search/policy rollout race did not exhibit a real root lock wait')
  policyHolderState.child.stdin.end('commit; \\q\n')
  await policyHolderState.done
  const policyContenderOutput = await policyContenderState.done
  assert(policyContenderOutput.stdout.includes('MATCH_POLICY_STALE'))

  psql(`delete from vault.secrets where name='f23_3e_p2b_identity_digest_epoch_1';`)
  assert.equal(scalar(`select pg_catalog.count(*) from vault.decrypted_secrets where name='f23_3e_p2b_identity_digest_epoch_1';`), '0')
  console.log('P2B_QA_FAULT_INJECTION_FAIL_CLOSED: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110002' and name='f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search';`), '1')
    assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608110001' and name='f23_3e_p2a_identity_review_mutex_reservation_schema_foundation';`), '1')
    assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')
    leftoverCount = Number(scalar(`
      select
        (select pg_catalog.count(*) from public.centers where id in (${Object.values(ids.centers).map(q).join(',')})) +
        (select pg_catalog.count(*) from public.center_cloud_entities where id in (${Object.values(ids.students).map(u).join(',')})) +
        (select pg_catalog.count(*) from public.crm_identity_match_mutex where center_id in (${Object.values(ids.centers).map(q).join(',')})) +
        (select pg_catalog.count(*) from public.crm_identity_policy_registry where identity_policy_registry_id in (${Object.values(ids.policies).map(u).join(',')})) +
        (select pg_catalog.count(*) from vault.decrypted_secrets where name like 'f23_3e_p2b_identity_digest_epoch_%');
    `))
    nondefaultRootCount = Number(scalar(`select pg_catalog.count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED' or control_version<>1;`))
    tempHelperCount = Number(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p2b_qa_temp_%';`))
    assert.equal(leftoverCount, 0)
    assert.equal(nondefaultRootCount, 0)
    assert.equal(tempHelperCount, 0)
    finalResetPassed = true
  } catch (resetError) {
    if (primaryError) primaryError = new AggregateError([primaryError, resetError], 'P2B QA and final reset both failed')
    else primaryError = resetError
  }
}

if (primaryError) throw primaryError
assert(finalResetPassed)
console.log('P2B_QA_FINAL_LOCAL_RESET: PASS')
console.log(`P2B_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
console.log(`P2B_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
console.log(`P2B_QA_TEMP_HELPER_COUNT: ${tempHelperCount}`)
console.log('F23.3E-P2B local DB QA passed')
