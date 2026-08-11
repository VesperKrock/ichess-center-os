import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P3B_LOCAL_QA_ALLOW_RESET'
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
console.log('P3B_QA_LOCAL_SAFETY_GUARD: PASS')

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
const digest = (value) => `extensions.digest(pg_catalog.convert_to(${q(value)},'UTF8'),'sha256')`
const bytes = (pair, count = 32) => `pg_catalog.decode(pg_catalog.repeat(${q(pair)},${count}),'hex')`
const digestArray = (pair) => `array[${bytes(pair)}]::bytea[]`
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
    const waiting = scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name=${q(applicationName)};`)
    if (waiting === 't') return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`${applicationName} did not exhibit a real PostgreSQL lock wait`)
}

const ids = {
  centers: { a: `p3bqa-${randomUUID()}`, b: `p3bqa-${randomUUID()}` },
  users: {
    ownerA: randomUUID(), adminA: randomUUID(), consultantA: randomUUID(),
    inactiveA: randomUUID(), ownerB: randomUUID(),
  },
  memberships: Object.fromEntries(['ownerA', 'adminA', 'consultantA', 'inactiveA', 'ownerB'].map((name) => [name, randomUUID()])),
  contacts: { a: randomUUID(), b: randomUUID() },
  cases: Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race', 'b'].map((name) => [name, randomUUID()])),
  assignments: Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race', 'b'].map((name) => [name, randomUUID()])),
  candidates: Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race', 'b'].map((name) => [name, randomUUID()])),
  requests: Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race'].map((name) => [name, randomUUID()])),
  requestRegistry: Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race'].map((name) => [name, randomUUID()])),
}
const actionIds = Object.fromEntries(['main', 'self', 'concurrent', 'fault', 'race'].map((requestName) => [
  requestName,
  { student: randomUUID(), guardian: randomUUID(), relationship: randomUUID() },
]))
const syntheticAuthIds = Object.values(ids.users)
let fixtureCreated = false
let finalResetVerified = false

const syncSql = (userId, key, intent, expected = null, evidence = `evidence-${userId}`) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_register_or_sync_account_security_control(
  ${u(userId)},${u(userId)},'ACTIVE',${digest(evidence)},${expected ?? 'null'},
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`

const stepSql = (userId, requestId, sessionId, key, intent, expectedControl, verifiedAt = 'now()') => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_record_verified_conversion_step_up(
  ${u(userId)},${u(sessionId)},${u(requestId)},'AAL2_TOTP','local.synthetic.server-verifier',
  ${digest(`verification-${key}`)},${verifiedAt},${expectedControl},
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`

const capabilitySql = (userId, requestId, stepId, requestVersion = 2) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_evaluate_conversion_capability(
  ${u(userId)},${u(requestId)},${u(stepId)},${requestVersion}
) x;
reset role;`

const issueSql = (
  userId, requestId, stepId, key, intent, requestVersion = 2, stepVersion = 1,
  environment = 'p3b-local-environment',
) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_issue_conversion_authority(
  ${u(userId)},${u(requestId)},${u(stepId)},${requestVersion},${stepVersion},
  ${digest(environment)},${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`

const statusSql = (userId, authorityId) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_read_conversion_authority_status(
  ${u(userId)},${u(authorityId)}
) x;
reset role;`

const terminalSql = (userId, authorityId, key, intent, transition, version = 1) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3b_revoke_or_expire_conversion_authority(
  ${u(userId)},${u(authorityId)},${version},${q(transition)},${q(`qa_${transition.toLowerCase()}`)},
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`

const requestFixtureSql = (name, requestedBy, withActions = true) => {
  const requestId = ids.requests[name]
  const registryId = ids.requestRegistry[name]
  const caseId = ids.cases[name]
  const assignmentId = ids.assignments[name]
  const candidateId = ids.candidates[name]
  const graph = digest(`legacy-action-graph-${name}`)
  const action = actionIds[name]
  return `
begin; set constraints all deferred;
insert into public.crm_idempotency_registry(
  idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,
  consultation_case_id,operation,idempotency_key_digest,intent_digest,request_intent_digest,
  action_graph_digest,expires_at
) values (
  ${u(registryId)},${digest(`request-env-${name}`)},${q(ids.centers.a)},'consultation_case',${u(caseId)},
  ${u(caseId)},${q(`p3b.qa.request.${name}`)},${digest(`request-key-${name}`)},
  ${digest(`request-intent-${name}`)},${digest(`request-intent-${name}`)},${graph},now()+interval '1 day'
);
insert into public.crm_conversion_request(
  conversion_request_id,center_id,consultation_case_id,source_contact_id,source_case_version,
  source_contact_version,source_assignment_id,source_assignment_version,identity_policy_version,
  conversion_policy_version,relationship_policy_version,student_profile_policy_version,
  action_graph_digest,idempotency_scope,idempotency_key_reference,intent_digest,requested_by_user_id
) values (
  ${u(requestId)},${q(ids.centers.a)},${u(caseId)},${u(ids.contacts.a)},2,1,
  ${u(assignmentId)},1,1,1,1,1,${graph},${q(`p3b.qa.${name}`)},${u(registryId)},
  ${digest(`conversion-intent-${name}`)},${u(requestedBy)}
);
update public.crm_conversion_request set status='READY_FOR_REVIEW',request_version=2,updated_at=now()
where conversion_request_id=${u(requestId)};
${withActions ? `
insert into public.crm_conversion_action(
  conversion_action_id,center_id,conversion_request_id,legacy_request_action_graph_digest,
  action_kind,action_intent_digest,identity_kind,source_contact_id,source_candidate_student_id,safe_reason_code
) values (
  ${u(action.student)},${q(ids.centers.a)},${u(requestId)},${graph},'DO_NOT_CREATE_STUDENT',
  ${digest(`action-${name}-student`)},'STUDENT',null,${u(candidateId)},'NO_TARGET_ACTION_REQUIRED'
),(
  ${u(action.guardian)},${q(ids.centers.a)},${u(requestId)},${graph},'DO_NOT_CREATE_GUARDIAN',
  ${digest(`action-${name}-guardian`)},'GUARDIAN',${u(ids.contacts.a)},null,'NO_TARGET_ACTION_REQUIRED'
);
insert into public.crm_conversion_action(
  conversion_action_id,center_id,conversion_request_id,legacy_request_action_graph_digest,
  action_kind,action_intent_digest,guardian_action_id,student_action_id,safe_reason_code,
  relationship_policy_version
) values (
  ${u(action.relationship)},${q(ids.centers.a)},${u(requestId)},${graph},'DO_NOT_CREATE_RELATIONSHIP',
  ${digest(`action-${name}-relationship`)},${u(action.guardian)},${u(action.student)},
  'NO_GUARDIAN_RELATIONSHIP_REQUIRED',1
);
update public.crm_conversion_action set status='REVIEWED',action_version=2,updated_at=now()
where conversion_request_id=${u(requestId)};
` : ''}
commit;`
}

const stateVector = (requestId) => scalar(`
select concat_ws('|',
  (select status||':'||request_version from public.crm_conversion_request where conversion_request_id=${u(requestId)}),
  (select coalesce(string_agg(status||':'||action_version,',' order by conversion_action_id),'') from public.crm_conversion_action where conversion_request_id=${u(requestId)}),
  (select coalesce(string_agg(status||':'||assertion_version,',' order by step_up_assertion_id),'') from public.account_step_up_assertion where conversion_request_id=${u(requestId)}),
  (select count(*) from public.crm_conversion_authority where conversion_request_id=${u(requestId)}),
  (select count(*) from public.crm_audit_event where request_id=${u(requestId)}),
  (select count(*) from public.crm_outbox_event where safe_payload->>'request_id'=${q(requestId)})
);`)

try {
  runReset()
  containerId = discoverContainer()
  console.log('P3B_QA_LOCAL_SQL_APPLY: PASS')

  assert.equal(scalar(`select count(*) from auth.users;`), '0')
  console.log('P3B_QA_AUTH_USERS_BASELINE_COUNT: 0')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608120001';`), '1')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3b_%' and p.proname not like 'f23_3e_p3b_internal_%' and p.prosecdef;`), '6')

  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
${syntheticAuthIds.map((id) => `(${u(id)},'authenticated','authenticated',now(),now())`).join(',\n')};
insert into public.centers(id,name) values
(${q(ids.centers.a)},'p3b synthetic center a'),(${q(ids.centers.b)},'p3b synthetic center b');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2
where center_id in (${q(ids.centers.a)},${q(ids.centers.b)});
insert into public.center_members(id,center_id,user_id,role,status) values
(${u(ids.memberships.ownerA)},${q(ids.centers.a)},${u(ids.users.ownerA)},'owner','active'),
(${u(ids.memberships.adminA)},${q(ids.centers.a)},${u(ids.users.adminA)},'center_admin','active'),
(${u(ids.memberships.consultantA)},${q(ids.centers.a)},${u(ids.users.consultantA)},'consultant','active'),
(${u(ids.memberships.inactiveA)},${q(ids.centers.a)},${u(ids.users.inactiveA)},'owner','inactive'),
(${u(ids.memberships.ownerB)},${q(ids.centers.b)},${u(ids.users.ownerB)},'owner','active');
insert into public.crm_contact(
  crm_contact_id,center_id,source_category,protected_contact_methods_ciphertext,
  contact_methods_crypto_version,normalized_lookup_digests,normalization_version,created_by_user_id
) values
(${u(ids.contacts.a)},${q(ids.centers.a)},'synthetic',${bytes('41', 16)},1,${digestArray('42')},1,${u(ids.users.ownerA)}),
(${u(ids.contacts.b)},${q(ids.centers.b)},'synthetic',${bytes('43', 16)},1,${digestArray('44')},1,${u(ids.users.ownerB)});
insert into public.consultation_case(consultation_case_id,center_id,primary_contact_id,created_by_user_id) values
${['main', 'self', 'concurrent', 'fault', 'race'].map((name) => `(${u(ids.cases[name])},${q(ids.centers.a)},${u(ids.contacts.a)},${u(ids.users.ownerA)})`).join(',\n')},
(${u(ids.cases.b)},${q(ids.centers.b)},${u(ids.contacts.b)},${u(ids.users.ownerB)});
begin; set constraints all deferred;
insert into public.consultation_case_assignment(
  assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id
) values
${['main', 'self', 'concurrent', 'fault', 'race'].map((name) => `(${u(ids.assignments[name])},${q(ids.centers.a)},${u(ids.cases[name])},${u(ids.users.consultantA)},${u(ids.users.ownerA)})`).join(',\n')},
(${u(ids.assignments.b)},${q(ids.centers.b)},${u(ids.cases.b)},${u(ids.users.ownerB)},${u(ids.users.ownerB)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values ${[...['main', 'self', 'concurrent', 'fault', 'race'].map((name) => `(${u(ids.cases[name])},${u(ids.assignments[name])})`), `(${u(ids.cases.b)},${u(ids.assignments.b)})`].join(',')}) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id;
commit;
insert into public.consultation_case_candidate_student(
  candidate_student_id,center_id,consultation_case_id,display_name_evidence
) values
${['main', 'self', 'concurrent', 'fault', 'race'].map((name) => `(${u(ids.candidates[name])},${q(ids.centers.a)},${u(ids.cases[name])},'Synthetic P3B Candidate ${name}')`).join(',\n')},
(${u(ids.candidates.b)},${q(ids.centers.b)},${u(ids.cases.b)},'Synthetic P3B Foreign Candidate');
update public.consultation_case_candidate_student set candidate_status='ACTIVE',candidate_version=2,updated_at=now()
where candidate_student_id in (${Object.values(ids.candidates).map(u).join(',')});
  `)
  fixtureCreated = true
  assert.equal(scalar(`select count(*) from auth.users where id in (${syntheticAuthIds.map(u).join(',')});`), '5')
  assert.equal(scalar(`select count(*) from auth.users;`), '5')
  console.log('P3B_QA_LOCAL_SYNTHETIC_AUTH_FIXTURE_CREATED: PASS')
  console.log('P3B_QA_AUTH_ACTOR_SEPARATION_FIXTURE: PASS')
  console.log('P3B_QA_EXISTING_SYNTHETIC_AUTH_USER: PASS')

  psql(requestFixtureSql('main', ids.users.consultantA))
  psql(requestFixtureSql('self', ids.users.adminA))
  psql(requestFixtureSql('concurrent', ids.users.consultantA))
  psql(requestFixtureSql('fault', ids.users.consultantA))
  psql(requestFixtureSql('race', ids.users.consultantA))
  console.log('P3B_QA_REVIEWED_ACTION_FIXTURE_ONLY: PASS')

  for (const [name, userId] of Object.entries(ids.users)) {
    const result = jsonValue(syncSql(userId, `sync-${name}`, `sync-intent-${name}`))
    assert.equal(result.ok, true)
    assert.equal(result.outcome_code, 'ACCOUNT_SECURITY_CONTROL_REGISTERED')
    assert.equal(result.control_version, 1)
  }
  const syncReplay = jsonValue(syncSql(ids.users.ownerA, 'sync-ownerA', 'sync-intent-ownerA'))
  assert.equal(syncReplay.replayed, true)
  assert.equal(syncReplay.control_version, 1)
  const syncConflict = jsonValue(syncSql(ids.users.ownerA, 'sync-ownerA', 'changed-intent'))
  assert.equal(syncConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('P3B_QA_ACCOUNT_SECURITY_SYNC: PASS')
  assert.equal(jsonValue(capabilitySql(randomUUID(), ids.requests.main, randomUUID())).reason_code, 'ACCOUNT_SECURITY_CONTROL_MISSING')
  console.log('P3B_QA_ACCOUNT_SECURITY_FAIL_CLOSED: PASS')

  const stale = jsonValue(stepSql(
    ids.users.ownerA, ids.requests.main, randomUUID(), 'stale-step', 'stale-step-intent', 1,
    "now()-interval '3 minutes'",
  ))
  assert.equal(stale.outcome_code, 'STEP_UP_EXPIRED_OR_STALE')
  assert.equal(scalar(`select count(*) from public.account_step_up_assertion where conversion_request_id=${u(ids.requests.main)};`), '0')
  console.log('P3B_QA_STEP_UP_STALE_DENY: PASS')

  const driftSession = randomUUID()
  const driftStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.main, driftSession, 'drift-step', 'drift-step-intent', 1))
  assert.equal(driftStep.outcome_code, 'STEP_UP_ASSERTION_ISSUED')
  const ownerSync2 = jsonValue(syncSql(ids.users.ownerA, 'sync-ownerA-v2', 'sync-ownerA-v2-intent', 1, 'changed-owner-evidence'))
  assert.equal(ownerSync2.control_version, 2)
  assert.equal(jsonValue(capabilitySql(ids.users.ownerA, ids.requests.main, driftStep.step_up_assertion_id)).reason_code, 'ACCOUNT_SECURITY_SESSION_DRIFT')
  const ownerStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.main, randomUUID(), 'owner-step', 'owner-step-intent', 2))
  assert.equal(ownerStep.outcome_code, 'STEP_UP_ASSERTION_ISSUED')
  assert.equal(scalar(`select status from public.account_step_up_assertion where step_up_assertion_id=${u(driftStep.step_up_assertion_id)};`), 'SUPERSEDED')
  console.log('P3B_QA_FRESH_STEP_UP: PASS')
  console.log('P3B_QA_MEMBERSHIP_VERSIONING: PASS')

  const adminStep = jsonValue(stepSql(ids.users.adminA, ids.requests.main, randomUUID(), 'admin-step', 'admin-step-intent', 1))
  const consultantStep = jsonValue(stepSql(ids.users.consultantA, ids.requests.main, randomUUID(), 'consultant-step', 'consultant-step-intent', 1))
  assert.equal(jsonValue(capabilitySql(ids.users.ownerA, ids.requests.main, ownerStep.step_up_assertion_id)).decision, 'ALLOW')
  assert.equal(jsonValue(capabilitySql(ids.users.adminA, ids.requests.main, adminStep.step_up_assertion_id)).decision, 'ALLOW')
  assert.equal(jsonValue(capabilitySql(ids.users.consultantA, ids.requests.main, consultantStep.step_up_assertion_id)).reason_code, 'FINAL_APPROVAL_ROLE_DENIED')
  assert.equal(jsonValue(capabilitySql(ids.users.adminA, ids.requests.self, randomUUID())).reason_code, 'SEPARATION_OF_DUTIES_DENIED')
  assert.equal(jsonValue(capabilitySql(ids.users.inactiveA, ids.requests.main, randomUUID())).reason_code, 'MEMBERSHIP_NOT_ACTIVE')
  assert.equal(jsonValue(capabilitySql(ids.users.ownerB, ids.requests.main, randomUUID())).reason_code, 'MEMBERSHIP_NOT_ACTIVE')
  assert.equal(jsonValue(syncSql(ids.users.adminA, 'sync-admin-stale', 'sync-admin-stale-intent', 99)).outcome_code, 'ACCOUNT_CONTROL_VERSION_STALE')
  psql(`update public.center_members set role='legacy_admin' where id=${u(ids.memberships.consultantA)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.consultantA, ids.requests.main, consultantStep.step_up_assertion_id)).reason_code, 'FINAL_APPROVAL_ROLE_DENIED')
  psql(`update public.center_members set role='consultant' where id=${u(ids.memberships.consultantA)};`)
  psql(`update public.account_security_control set account_lifecycle='DISABLED',security_version=security_version+1,session_version=session_version+1,identity_control_version=identity_control_version+1,factor_control_version=factor_control_version+1,assurance_policy_version=assurance_policy_version+1,control_version=control_version+1,updated_at=now() where canonical_user_id=${u(ids.users.inactiveA)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.inactiveA, ids.requests.main, randomUUID())).reason_code, 'ACCOUNT_NOT_ACTIVE')
  psql(`update public.account_security_control set account_lifecycle='REVOKED',security_version=security_version+1,session_version=session_version+1,identity_control_version=identity_control_version+1,factor_control_version=factor_control_version+1,assurance_policy_version=assurance_policy_version+1,control_version=control_version+1,terminal_at=now(),updated_at=now() where canonical_user_id=${u(ids.users.inactiveA)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.inactiveA, ids.requests.main, randomUUID())).reason_code, 'ACCOUNT_NOT_ACTIVE')
  psql(`delete from public.center_members where id=${u(ids.memberships.inactiveA)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.inactiveA, ids.requests.main, randomUUID())).reason_code, 'ACCOUNT_NOT_ACTIVE')
  psql(`delete from public.center_members where id=${u(ids.memberships.ownerB)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.ownerB, ids.requests.main, randomUUID())).reason_code, 'MEMBERSHIP_NOT_ACTIVE')

  const fixedVerifiedAt = `${q(scalar(`select pg_catalog.clock_timestamp()::text;`))}::timestamptz`
  const selfSession = randomUUID()
  const selfStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.self, selfSession, 'self-step', 'self-step-intent', 2, fixedVerifiedAt))
  const selfStepReplay = jsonValue(stepSql(ids.users.ownerA, ids.requests.self, selfSession, 'self-step', 'self-step-intent', 2, fixedVerifiedAt))
  assert.equal(selfStepReplay.replayed, true)
  assert.equal(selfStepReplay.step_up_assertion_id, selfStep.step_up_assertion_id)
  const wrongSessionReplay = jsonValue(stepSql(ids.users.ownerA, ids.requests.self, randomUUID(), 'self-step', 'self-step-intent', 2, fixedVerifiedAt))
  assert.equal(wrongSessionReplay.outcome_code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(jsonValue(capabilitySql(ids.users.ownerA, ids.requests.main, selfStep.step_up_assertion_id)).reason_code, 'STEP_UP_BINDING_MISMATCH')
  assert.equal(jsonValue(capabilitySql(ids.users.adminA, ids.requests.main, ownerStep.step_up_assertion_id)).reason_code, 'STEP_UP_BINDING_MISMATCH')
  psql(`update public.account_step_up_assertion set status='EXPIRED',assertion_version=assertion_version+1,terminal_at=now(),terminal_reason_code='qa_expired',updated_at=now() where step_up_assertion_id=${u(selfStep.step_up_assertion_id)};`)
  assert.equal(jsonValue(capabilitySql(ids.users.ownerA, ids.requests.self, selfStep.step_up_assertion_id)).reason_code, 'STEP_UP_EXPIRED_OR_STALE')
  console.log('P3B_QA_FINAL_CAPABILITY_OWNER: PASS')
  console.log('P3B_QA_FINAL_CAPABILITY_CENTER_ADMIN: PASS')
  console.log('P3B_QA_CONSULTANT_FINAL_DENY: PASS')
  console.log('P3B_QA_SEPARATION_OF_DUTIES: PASS')
  console.log('P3B_QA_FOREIGN_INACTIVE_DENY: PASS')

  // A committed membership change holds the row while issuance waits, then the
  // fresh resolver observes the inactive state and denies. No browser truth is used.
  const memberHolder = collect(spawnPsql())
  memberHolder.child.stdin.write(`begin; set application_name='p3b_membership_holder'; update public.center_members set status='inactive' where id=${u(ids.memberships.adminA)}; \\echo P3B_MEMBER_HELD\n`)
  await memberHolder.marker('P3B_MEMBER_HELD')
  const memberContender = collect(spawnPsql())
  memberContender.child.stdin.end(`set application_name='p3b_membership_contender'; ${issueSql(ids.users.adminA, ids.requests.main, adminStep.step_up_assertion_id, 'member-race-key', 'member-race-intent')} \\echo P3B_MEMBER_DONE\n`)
  await waitForLock('p3b_membership_contender')
  memberHolder.child.stdin.end('commit; \\q\n')
  await memberHolder.done
  const memberResult = await memberContender.done
  assert.match(memberResult.stdout, /MEMBERSHIP_NOT_ACTIVE/)
  psql(`update public.center_members set status='active' where id=${u(ids.memberships.adminA)};`)

  const securityHolder = collect(spawnPsql())
  securityHolder.child.stdin.write(`begin; set application_name='p3b_security_holder'; update public.account_security_control set account_lifecycle='SUSPENDED',security_version=security_version+1,session_version=session_version+1,identity_control_version=identity_control_version+1,factor_control_version=factor_control_version+1,assurance_policy_version=assurance_policy_version+1,control_version=control_version+1,updated_at=now() where canonical_user_id=${u(ids.users.adminA)}; \\echo P3B_SECURITY_HELD\n`)
  await securityHolder.marker('P3B_SECURITY_HELD')
  const securityContender = collect(spawnPsql())
  securityContender.child.stdin.end(`set application_name='p3b_security_contender'; ${issueSql(ids.users.adminA, ids.requests.main, adminStep.step_up_assertion_id, 'security-race-key', 'security-race-intent')} \\echo P3B_SECURITY_DONE\n`)
  await waitForLock('p3b_security_contender')
  securityHolder.child.stdin.end('commit; \\q\n')
  await securityHolder.done
  const securityResult = await securityContender.done
  assert.match(securityResult.stdout, /ACCOUNT_NOT_ACTIVE/)
  psql(`update public.account_security_control set account_lifecycle='ACTIVE',security_version=security_version+1,session_version=session_version+1,identity_control_version=identity_control_version+1,factor_control_version=factor_control_version+1,assurance_policy_version=assurance_policy_version+1,control_version=control_version+1,updated_at=now() where canonical_user_id=${u(ids.users.adminA)};`)

  const raceStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.race, randomUUID(), 'race-step', 'race-step-intent', 2))
  const centerHolder = collect(spawnPsql())
  centerHolder.child.stdin.write(`begin; set application_name='p3b_center_holder'; update public.center_crm_control set crm_state='SUSPENDED',feature_flag_state='DISABLED',control_version=control_version+1,updated_at=now() where center_id=${q(ids.centers.a)}; \\echo P3B_CENTER_HELD\n`)
  await centerHolder.marker('P3B_CENTER_HELD')
  const centerContender = collect(spawnPsql())
  centerContender.child.stdin.end(`set application_name='p3b_center_contender'; ${issueSql(ids.users.ownerA, ids.requests.race, raceStep.step_up_assertion_id, 'center-race-key', 'center-race-intent')} \\echo P3B_CENTER_DONE\n`)
  await waitForLock('p3b_center_contender')
  centerHolder.child.stdin.end('commit; \\q\n')
  await centerHolder.done
  assert.match((await centerContender.done).stdout, /CRM_RUNTIME_NOT_ACTIVE/)
  psql(`update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1,updated_at=now() where center_id=${q(ids.centers.a)};`)

  const assignmentHolder = collect(spawnPsql())
  assignmentHolder.child.stdin.write(`begin; set constraints all deferred; set application_name='p3b_assignment_holder'; update public.consultation_case_assignment set assignment_status='REVOKED',assignment_version=assignment_version+1,ended_at=now(),end_reason='p3b_qa_revoke' where assignment_id=${u(ids.assignments.race)}; update public.consultation_case set active_assignment_id=null,case_version=case_version+1,updated_at=now() where consultation_case_id=${u(ids.cases.race)}; \\echo P3B_ASSIGNMENT_HELD\n`)
  await assignmentHolder.marker('P3B_ASSIGNMENT_HELD')
  const assignmentContender = collect(spawnPsql())
  assignmentContender.child.stdin.end(`set application_name='p3b_assignment_contender'; ${issueSql(ids.users.ownerA, ids.requests.race, raceStep.step_up_assertion_id, 'assignment-race-key', 'assignment-race-intent')} \\echo P3B_ASSIGNMENT_DONE\n`)
  await waitForLock('p3b_assignment_contender')
  assignmentHolder.child.stdin.end('commit; \\q\n')
  await assignmentHolder.done
  assert.match((await assignmentContender.done).stdout, /CASE_STATE_STALE|ASSIGNMENT_STATE_STALE/)
  console.log('P3B_QA_SECURITY_MEMBERSHIP_RACES: PASS')

  const reviewedDigest = scalar(`select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.main)},'REVIEWED'),'hex');`)
  assert.equal(scalar(`select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.main)},'REVIEWED'),'hex');`), reviewedDigest)
  const intentChangedDigest = scalar(`begin; alter table public.crm_conversion_action disable trigger f23_3e_p3b_conversion_action_guard; update public.crm_conversion_action set action_intent_digest=${digest('qa-alternate-action-intent')} where conversion_action_id=${u(actionIds.main.student)}; select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.main)},'REVIEWED'),'hex'); rollback;`)
  assert.notEqual(intentChangedDigest, reviewedDigest)
  const kindChangedDigest = scalar(`begin; alter table public.crm_conversion_action disable trigger f23_3e_p3b_conversion_action_guard; update public.crm_conversion_action set action_kind='DO_NOT_CREATE_GUARDIAN',identity_kind='GUARDIAN',source_contact_id=${u(ids.contacts.a)},source_candidate_student_id=null where conversion_action_id=${u(actionIds.main.student)}; select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.main)},'REVIEWED'),'hex'); rollback;`)
  assert.notEqual(kindChangedDigest, reviewedDigest)
  const legacyChangedDigest = scalar(`begin; alter table public.crm_conversion_request disable trigger f23_3e_p1a_request_version; alter table public.crm_conversion_request disable trigger f23_3e_p1a_request_lifecycle; alter table public.crm_conversion_action disable trigger f23_3e_p3b_conversion_action_guard; update public.crm_conversion_request set action_graph_digest=${digest('qa-alternate-legacy-binding')} where conversion_request_id=${u(ids.requests.main)}; update public.crm_conversion_action set legacy_request_action_graph_digest=${digest('qa-alternate-legacy-binding')} where conversion_request_id=${u(ids.requests.main)}; select pg_catalog.encode(public.f23_3e_p3b_internal_action_set_digest(${u(ids.requests.main)},'REVIEWED'),'hex'); rollback;`)
  assert.notEqual(legacyChangedDigest, reviewedDigest)

  const mainAuthority = jsonValue(issueSql(ids.users.ownerA, ids.requests.main, ownerStep.step_up_assertion_id, 'main-issue', 'main-issue-intent'))
  assert.equal(mainAuthority.outcome_code, 'CONVERSION_AUTHORITY_ISSUED')
  assert.equal(mainAuthority.request_status, 'APPROVED')
  assert.equal(mainAuthority.request_version, 3)
  assert.equal(scalar(`select status||':'||assertion_version from public.account_step_up_assertion where step_up_assertion_id=${u(ownerStep.step_up_assertion_id)};`), 'CONSUMED:2')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.requests.main)} and status='APPROVED' and action_version=3;`), '3')
  assert.equal(scalar(`select (a.p3_action_set_digest=public.f23_3e_p3b_internal_action_set_digest(a.conversion_request_id,'APPROVED'))::text from public.crm_conversion_authority a where a.conversion_authority_id=${u(mainAuthority.conversion_authority_id)};`), 'true')
  assert.equal(scalar(`select (legacy_request_action_graph_digest<>p3_action_set_digest)::text from public.crm_conversion_authority where conversion_authority_id=${u(mainAuthority.conversion_authority_id)};`), 'true')
  assert.notEqual(scalar(`select pg_catalog.encode(p3_action_set_digest,'hex') from public.crm_conversion_authority where conversion_authority_id=${u(mainAuthority.conversion_authority_id)};`), reviewedDigest)
  console.log('P3B_QA_DUAL_DIGEST_BINDING: PASS')
  console.log('P3B_QA_POST_APPROVED_AUTHORITY_DIGEST: PASS')
  console.log('P3B_QA_AUTHORITY_ISSUANCE: PASS')

  const mainReplay = jsonValue(issueSql(ids.users.ownerA, ids.requests.main, ownerStep.step_up_assertion_id, 'main-issue', 'main-issue-intent'))
  assert.equal(mainReplay.replayed, true)
  assert.equal(mainReplay.conversion_authority_id, mainAuthority.conversion_authority_id)
  assert.equal(mainReplay.correlation_id, mainAuthority.correlation_id)
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority where conversion_request_id=${u(ids.requests.main)};`), '1')
  const mainConflict = jsonValue(issueSql(ids.users.ownerA, ids.requests.main, ownerStep.step_up_assertion_id, 'main-issue', 'changed-main-intent'))
  assert.equal(mainConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('P3B_QA_STEP_UP_SINGLE_USE: PASS')
  console.log('P3B_QA_AUTHORITY_EXACT_REPLAY: PASS')
  console.log('P3B_QA_AUTHORITY_IDEMPOTENCY_CONFLICT: PASS')

  const assertStatusUnavailable = (row, authorityId) => {
    assert.equal(row.outcome_code, 'RESOURCE_NOT_AVAILABLE')
    assert.equal(row.conversion_authority_id, authorityId)
    for (const field of [
      'status', 'authority_version', 'conversion_request_id', 'approved_request_version',
      'issued_at', 'expires_at', 'terminal_at', 'terminal_reason_code',
    ]) assert.equal(row[field], null, `${field} must not leak for unavailable authority scope`)
  }
  assert.equal(
    jsonValue(statusSql(ids.users.ownerA, mainAuthority.conversion_authority_id)).outcome_code,
    'AUTHORITY_STATUS_READ',
  )
  assert.equal(
    jsonValue(statusSql(ids.users.adminA, mainAuthority.conversion_authority_id)).outcome_code,
    'AUTHORITY_STATUS_READ',
  )
  assertStatusUnavailable(
    jsonValue(statusSql(ids.users.ownerB, mainAuthority.conversion_authority_id)),
    mainAuthority.conversion_authority_id,
  )
  const unavailableAuthorityId = randomUUID()
  assertStatusUnavailable(
    jsonValue(statusSql(ids.users.ownerB, unavailableAuthorityId)),
    unavailableAuthorityId,
  )
  console.log('P3B_QA_FOREIGN_NONMEMBER_STATUS_NONDISCLOSURE: PASS')

  // QA-only local-superuser orchestration makes the issuer a former member
  // without changing the referenced membership identity/version. It creates no
  // helper or production bypass and is restored immediately after the denial.
  psql(`set session_replication_role='replica'; update public.center_members set status='inactive' where id=${u(ids.memberships.ownerA)}; set session_replication_role='origin';`)
  assertStatusUnavailable(
    jsonValue(statusSql(ids.users.ownerA, mainAuthority.conversion_authority_id)),
    mainAuthority.conversion_authority_id,
  )
  psql(`set session_replication_role='replica'; update public.center_members set status='active' where id=${u(ids.memberships.ownerA)}; set session_replication_role='origin';`)
  assert.equal(
    jsonValue(statusSql(ids.users.ownerA, mainAuthority.conversion_authority_id)).outcome_code,
    'AUTHORITY_STATUS_READ',
  )
  console.log('P3B_QA_FORMER_ISSUER_STATUS_READ_DENIED: PASS')

  // Fault injection is local-superuser orchestration only. Trigger/function are
  // dropped immediately; the failed statement proves one-transaction rollback.
  const faultStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.fault, randomUUID(), 'fault-step', 'fault-step-intent', 2))
  const faultBefore = stateVector(ids.requests.fault)
  for (const [kind, table] of [['audit', 'crm_audit_event'], ['outbox', 'crm_outbox_event']]) {
    psql(`create function public.p3b_qa_fail_${kind}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3b_qa_${kind}_fault'; end$$;
create trigger p3b_qa_fail_${kind} before insert on public.${table} for each row execute function public.p3b_qa_fail_${kind}();`)
    expectSqlFailure(issueSql(ids.users.ownerA, ids.requests.fault, faultStep.step_up_assertion_id, `fault-${kind}`, `fault-${kind}-intent`), new RegExp(`p3b_qa_${kind}_fault`, 'i'))
    psql(`drop trigger p3b_qa_fail_${kind} on public.${table}; drop function public.p3b_qa_fail_${kind}();`)
    assert.equal(stateVector(ids.requests.fault), faultBefore)
  }
  console.log('P3B_QA_FAULT_ROLLBACK: PASS')

  const faultAuthority = jsonValue(issueSql(ids.users.ownerA, ids.requests.fault, faultStep.step_up_assertion_id, 'fault-success', 'fault-success-intent'))
  assert.equal(faultAuthority.ok, true)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where correlation_id=${u(faultAuthority.correlation_id)};`), '3')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where safe_payload->>'correlation_id'=${q(faultAuthority.correlation_id)};`), '3')
  console.log('P3B_QA_AUDIT_OUTBOX_ATOMIC: PASS')

  const concurrentStep = jsonValue(stepSql(ids.users.ownerA, ids.requests.concurrent, randomUUID(), 'concurrent-step', 'concurrent-step-intent', 2))
  const concurrentCall = issueSql(
    ids.users.ownerA, ids.requests.concurrent, concurrentStep.step_up_assertion_id,
    'concurrent-issue', 'concurrent-issue-intent', 2, 1, 'p3b-secondary-environment',
  )
  const issueHolder = collect(spawnPsql())
  issueHolder.child.stdin.write(`begin; set application_name='p3b_issue_holder'; ${concurrentCall} \\echo P3B_ISSUE_HELD\n`)
  await issueHolder.marker('P3B_ISSUE_HELD')
  const issueContender = collect(spawnPsql())
  issueContender.child.stdin.end(`set application_name='p3b_issue_contender'; ${concurrentCall} \\echo P3B_ISSUE_DONE\n`)
  await waitForLock('p3b_issue_contender')
  issueHolder.child.stdin.end('commit; \\q\n')
  const holderResult = await issueHolder.done
  const contenderResult = await issueContender.done
  assert.match(holderResult.stdout, /CONVERSION_AUTHORITY_ISSUED/)
  assert.match(contenderResult.stdout, /"replayed"\s*:\s*true/i)
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority where conversion_request_id=${u(ids.requests.concurrent)};`), '1')
  const concurrentAuthorityId = scalar(`select conversion_authority_id from public.crm_conversion_authority where conversion_request_id=${u(ids.requests.concurrent)};`)
  console.log('P3B_QA_REAL_LOCK_WAIT_OBSERVED: PASS')
  console.log('P3B_QA_CONCURRENT_AUTHORITY_ISSUANCE: PASS')

  const revoke = jsonValue(terminalSql(ids.users.ownerA, mainAuthority.conversion_authority_id, 'revoke-main', 'revoke-main-intent', 'REVOKED'))
  assert.equal(revoke.outcome_code, 'CONVERSION_AUTHORITY_REVOKED')
  const revokeReplay = jsonValue(terminalSql(ids.users.ownerA, mainAuthority.conversion_authority_id, 'revoke-main', 'revoke-main-intent', 'REVOKED'))
  assert.equal(revokeReplay.replayed, true)
  const revokeConflict = jsonValue(terminalSql(ids.users.ownerA, mainAuthority.conversion_authority_id, 'revoke-main', 'changed-revoke-intent', 'REVOKED'))
  assert.equal(revokeConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('P3B_QA_AUTHORITY_REVOKE: PASS')

  // Local clock fixture only: no production helper or bypass survives the
  // statement. The row remains structurally valid while becoming server-expired.
  psql(`alter table public.crm_conversion_authority disable trigger f23_3e_p3b_conversion_authority_guard;
update public.crm_conversion_authority set created_at=now()-interval '4 minutes',issued_at=now()-interval '4 minutes',updated_at=now()-interval '4 minutes',expires_at=now()-interval '1 second' where conversion_authority_id=${u(concurrentAuthorityId)};
alter table public.crm_conversion_authority enable trigger f23_3e_p3b_conversion_authority_guard;`)
  const expired = jsonValue(terminalSql(ids.users.ownerA, concurrentAuthorityId, 'expire-concurrent', 'expire-concurrent-intent', 'EXPIRED'))
  assert.equal(expired.outcome_code, 'CONVERSION_AUTHORITY_EXPIRED')
  console.log('P3B_QA_AUTHORITY_EXPIRE: PASS')

  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry i join public.crm_conversion_authority a on a.conversion_authority_id=i.resource_scope_id where i.operation='security.revoke_or_expire_conversion_authority' and i.environment_fingerprint is distinct from a.environment_fingerprint;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where operation='security.revoke_or_expire_conversion_authority';`), '2')
  assert.equal(scalar(`select count(distinct pg_catalog.encode(i.environment_fingerprint,'hex')) from public.crm_idempotency_registry i where i.operation='security.revoke_or_expire_conversion_authority';`), '2')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry i where i.operation='security.revoke_or_expire_conversion_authority' and i.environment_fingerprint=extensions.digest(pg_catalog.convert_to('ichess.local.authority-terminal.v1','UTF8'),'sha256');`), '0')
  console.log('P3B_QA_TERMINAL_ENVIRONMENT_BINDING: PASS')

  assert.equal(scalar(`select count(*) from public.crm_conversion_authority where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and routine_name like 'f23_3e_p3b%consume%';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='CONSUMED';`), '0')
  assert.equal(scalar(`select count(*) from information_schema.tables where table_schema='public' and table_name in ('student_profile','guardian_profile','crm_identity_target_binding','guardian_student_relationship');`), '0')
  assert.equal(scalar(`select count(*) from information_schema.routines where routine_schema='public' and (routine_name like 'f23_3e_p3c%' or routine_name like 'f23_3e_p3d%' or routine_name in ('conversion_execute','conversion_read_result_status'));`), '0')
  console.log('P3B_QA_AUTHORITY_CONSUME_ABSENT: PASS')
  console.log('P3B_QA_NO_P3C_TARGET_RUNTIME: PASS')
  console.log('P3B_QA_NO_P3D_EXECUTOR: PASS')

  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['account_security_control', 'account_step_up_assertion', 'crm_conversion_action', 'crm_conversion_authority']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT');`), 'f')
    }
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3b_internal_%' and has_function_privilege('service_role',p.oid,'EXECUTE');`), '0')
  expectSqlFailure(`set role anon; select public.f23_3e_p3b_read_conversion_authority_status(${u(ids.users.ownerA)},${u(mainAuthority.conversion_authority_id)});`, /permission denied/i)
  expectSqlFailure(`set role authenticated; select public.f23_3e_p3b_evaluate_conversion_capability(${u(ids.users.ownerA)},${u(ids.requests.main)},${u(ownerStep.step_up_assertion_id)},2);`, /permission denied/i)
  const postRpc = (rpc, apikey, bearer, body) => fetch(`${localStatus.API_URL}/rest/v1/rpc/${rpc}`, {
    method: 'POST', headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const anonDenied = await postRpc('f23_3e_p3b_read_conversion_authority_status', localStatus.ANON_KEY, localStatus.ANON_KEY, {
    p_actor_user_id: ids.users.ownerA, p_conversion_authority_id: mainAuthority.conversion_authority_id,
  })
  assert([401, 403, 404].includes(anonDenied.status), `anon RPC status ${anonDenied.status}`)
  const serviceRead = await postRpc('f23_3e_p3b_read_conversion_authority_status', localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY, {
    p_actor_user_id: ids.users.ownerA, p_conversion_authority_id: mainAuthority.conversion_authority_id,
  })
  assert.equal(serviceRead.status, 200)
  const serviceReadPayload = await serviceRead.json()
  const serviceReadRow = Array.isArray(serviceReadPayload) ? serviceReadPayload[0] : serviceReadPayload
  assert.equal(serviceReadRow.status, 'REVOKED')
  for (const [apikey, bearer] of [
    [localStatus.ANON_KEY, localStatus.ANON_KEY],
    [localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY],
  ]) {
    const denied = await fetch(`${localStatus.API_URL}/rest/v1/crm_conversion_authority?select=conversion_authority_id`, {
      headers: { apikey, Authorization: `Bearer ${bearer}` },
    })
    assert([401, 403, 404].includes(denied.status), `protected table status ${denied.status}`)
  }
  console.log('P3B_QA_DIRECT_API_FAIL_CLOSED: PASS')

  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p3b_qa_%';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p3b_qa_%';`), '0')
  console.log('P3B_QA_TEMP_HELPER_COUNT: 0')

  runReset()
  containerId = discoverContainer()
  assert.equal(scalar(`select count(*) from auth.users;`), '0')
  assert.equal(scalar(`select count(*) from public.centers where id like 'p3bqa-%';`), '0')
  assert.equal(scalar(`select count(*) from public.center_crm_control where center_id like 'p3bqa-%';`), '0')
  assert.equal(scalar(`select count(*) from public.account_security_control;`), '0')
  assert.equal(scalar(`select count(*) from public.account_step_up_assertion;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where p3_result_kind is not null or p3_actor_user_id is not null;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_audit_event;`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event;`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p3b_qa_%';`), '0')
  fixtureCreated = false
  finalResetVerified = true
  console.log('P3B_QA_SYNTHETIC_AUTH_FIXTURE_FINAL_RESET: PASS')
  console.log('P3B_QA_AUTH_USERS_FINAL_COUNT: 0')
  console.log('P3B_QA_FINAL_LOCAL_RESET: PASS')
  console.log('P3B_QA_LEFTOVER_FIXTURE_COUNT: 0')
  console.log('P3B_QA_NONDEFAULT_ROOT_COUNT: 0')
  console.log('P3B_QA_REAL_AUTH_USER_MUTATION_COUNT: 0')
  console.log('P3B_QA_PRODUCTION_AUTH_MUTATION: NO')
  console.log('P3B_QA_AUTH_USERS_UNCHANGED: PASS (baseline restored after approved synthetic-only fixture)')
  console.log('F23_3E_P3B_LOCAL_DB_QA: PASS')
} finally {
  if (fixtureCreated || !finalResetVerified) {
    try {
      runReset()
      containerId = discoverContainer()
      assert.equal(scalar(`select count(*) from auth.users;`), '0')
    } catch (cleanupError) {
      console.error(`P3B QA cleanup failed: ${cleanupError.message}`)
    }
  }
}
