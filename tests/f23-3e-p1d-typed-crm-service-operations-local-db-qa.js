import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P1D_LOCAL_QA_ALLOW_RESET'
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
console.log('P1D_QA_LOCAL_SAFETY_GUARD: PASS')

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
const bytea = (pair, bytes) => `pg_catalog.decode(pg_catalog.repeat(${q(pair)}, ${bytes}), 'hex')`
const digestArray = (pair = '11') => `array[${bytea(pair, 32)}]::bytea[]`
const rpcJson = (expression) => jsonValue(`
set role service_role;
select pg_catalog.row_to_json(r)::text from ${expression} r;
reset role;
`)
const call = {
  createContact: (id, center, actor, source = 'referral', cipher = 'ab', digest = '11') => rpcJson(
    `public.f23_3e_p1d_create_crm_contact(${u(id)},${q(center)},${u(actor)},${q(source)},${bytea(cipher, 16)},1,${digestArray(digest)},1)`,
  ),
  updateContact: (id, actor, version, source = 'referral_update', cipher = 'bc', digest = '22') => rpcJson(
    `public.f23_3e_p1d_update_crm_contact(${u(id)},${u(actor)},${version},${q(source)},${bytea(cipher, 16)},1,${digestArray(digest)},1)`,
  ),
  contactStatus: (id, actor, version, target, reason = 'qa_transition') => rpcJson(
    `public.f23_3e_p1d_transition_crm_contact_status(${u(id)},${u(actor)},${version},${q(target)},${q(reason)})`,
  ),
  createCase: (id, contact, actor, contactVersion) => rpcJson(
    `public.f23_3e_p1d_create_consultation_case(${u(id)},${u(contact)},${u(actor)},${contactVersion})`,
  ),
  caseStatus: (id, actor, version, target, reason = 'qa_case_transition') => rpcJson(
    `public.f23_3e_p1d_transition_consultation_case_status(${u(id)},${u(actor)},${version},${q(target)},${q(reason)})`,
  ),
  assign: (id, caseId, actor, target, caseVersion) => rpcJson(
    `public.f23_3e_p1d_assign_consultation_case(${u(id)},${u(caseId)},${u(actor)},${u(target)},${caseVersion})`,
  ),
  reassign: (newId, caseId, actor, target, caseVersion, oldId, oldVersion, reason = 'qa_reassign') => rpcJson(
    `public.f23_3e_p1d_reassign_consultation_case(${u(newId)},${u(caseId)},${u(actor)},${u(target)},${caseVersion},${u(oldId)},${oldVersion},${q(reason)})`,
  ),
  end: (caseId, actor, caseVersion, assignment, assignmentVersion, reason = 'qa_complete') => rpcJson(
    `public.f23_3e_p1d_end_consultation_case_assignment(${u(caseId)},${u(actor)},${caseVersion},${u(assignment)},${assignmentVersion},${q(reason)})`,
  ),
  revoke: (caseId, actor, caseVersion, assignment, assignmentVersion, reason = 'qa_revoke') => rpcJson(
    `public.f23_3e_p1d_revoke_consultation_case_assignment(${u(caseId)},${u(actor)},${caseVersion},${u(assignment)},${assignmentVersion},${q(reason)})`,
  ),
  appendLog: (id, caseId, actor, kind = 'NOTE', content = 'Safe QA operational note') => rpcJson(
    `public.f23_3e_p1d_append_crm_care_log(${u(id)},${u(caseId)},${u(actor)},${q(kind)},${q(content)})`,
  ),
  correctLog: (id, caseId, actor, original, content = 'Corrected safe QA operational note') => rpcJson(
    `public.f23_3e_p1d_correct_crm_care_log(${u(id)},${u(caseId)},${u(actor)},${u(original)},${q(content)})`,
  ),
}

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
    const deadline = setTimeout(() => reject(new Error(`Timed out waiting for ${needle}`)), 20_000)
    const check = () => {
      if (stdout.includes(needle)) { clearTimeout(deadline); resolve() }
      else setTimeout(check, 10)
    }
    check()
  })
  return { child, done, marker }
}
const workerRpcSql = (expression) => `
set role service_role;
select pg_catalog.row_to_json(r)::text from ${expression} r;
reset role;
`
const concurrentBarrier = async (number, sqlA, sqlB) => {
  const coordinator = collect(spawnPsql())
  coordinator.child.stdin.write(`select pg_catalog.pg_advisory_lock(230810, ${number});\nselect 'BARRIER_READY';\n`)
  await coordinator.marker('BARRIER_READY')
  const workerA = collect(spawnPsql()); const workerB = collect(spawnPsql())
  workerA.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230810, ${number});\nselect pg_catalog.pg_advisory_unlock(230810, ${number});\n${sqlA}\n`)
  workerB.child.stdin.end(`select 'WORKER_READY';\nselect pg_catalog.pg_advisory_lock(230810, ${number});\nselect pg_catalog.pg_advisory_unlock(230810, ${number});\n${sqlB}\n`)
  await Promise.all([workerA.marker('WORKER_READY'), workerB.marker('WORKER_READY')])
  coordinator.child.stdin.end(`select pg_catalog.pg_advisory_unlock(230810, ${number});\n`)
  const [resultA, resultB] = await Promise.all([workerA.done, workerB.done])
  await coordinator.done
  return [parseWorkerJson(resultA.stdout), parseWorkerJson(resultB.stdout)]
}
const assertOneWinner = (rows, successCode, losingCodes) => {
  assert.equal(rows.filter((row) => row.ok && row.outcome_code === successCode).length, 1)
  assert.equal(rows.filter((row) => !row.ok && losingCodes.includes(row.outcome_code)).length, 1)
}

const centerKeys = [
  'gate', 'core', 'foreign', 'case', 'assignment', 'care',
  'fault_audit', 'fault_outbox', 'fault_reassign',
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'eligibility',
]
const centers = Object.fromEntries(centerKeys.map((key) => [key, randomUUID()]))
const users = {
  actor: randomUUID(), consultantA: randomUUID(), consultantB: randomUUID(),
  consultantC: randomUUID(), ineligible: randomUUID(), foreignOnly: randomUUID(),
}
const fixtureIds = [...Object.values(centers), ...Object.values(users)]
const newContactCase = (centerKey) => {
  const contact = randomUUID(); const caseId = randomUUID()
  assert.equal(call.createContact(contact, centers[centerKey], users.actor).outcome_code, 'CONTACT_CREATED')
  assert.equal(call.createCase(caseId, contact, users.actor, 1).outcome_code, 'CASE_CREATED')
  fixtureIds.push(contact, caseId)
  return { contact, caseId }
}

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1

try {
  runReset()
  containerId = discoverContainer()

  assert.equal(scalar(`
select pg_catalog.count(*) from supabase_migrations.schema_migrations
where version in ('202607310001','202607310002','202608100001','202608100002');
`), '4', 'P1A/P1B/P1C/P1D migration history missing after clean reset')

  const signatures = [
    'public.f23_3e_p1d_create_crm_contact(uuid,text,uuid,text,bytea,integer,bytea[],integer)',
    'public.f23_3e_p1d_update_crm_contact(uuid,uuid,integer,text,bytea,integer,bytea[],integer)',
    'public.f23_3e_p1d_transition_crm_contact_status(uuid,uuid,integer,text,text)',
    'public.f23_3e_p1d_create_consultation_case(uuid,uuid,uuid,integer)',
    'public.f23_3e_p1d_transition_consultation_case_status(uuid,uuid,integer,text,text)',
    'public.f23_3e_p1d_assign_consultation_case(uuid,uuid,uuid,uuid,integer)',
    'public.f23_3e_p1d_reassign_consultation_case(uuid,uuid,uuid,uuid,integer,uuid,integer,text)',
    'public.f23_3e_p1d_end_consultation_case_assignment(uuid,uuid,integer,uuid,integer,text)',
    'public.f23_3e_p1d_revoke_consultation_case_assignment(uuid,uuid,integer,uuid,integer,text)',
    'public.f23_3e_p1d_append_crm_care_log(uuid,uuid,uuid,text,text)',
    'public.f23_3e_p1d_correct_crm_care_log(uuid,uuid,uuid,uuid,text)',
  ]
  psql(`
do $qa$
declare v_signature text;
begin
  foreach v_signature in array array[${signatures.map(q).join(',')}] loop
    if pg_catalog.to_regprocedure(v_signature) is null then raise exception 'missing_%', v_signature; end if;
    if not pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE') then raise exception 'service_missing_%', v_signature; end if;
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'browser_execute_%', v_signature;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'f23_3e_p1d_%' and p.proname not like 'f23_3e_p1d_internal_%') <> 11 then
    raise exception 'application_rpc_count';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p1d_internal_%'
      and (pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) then raise exception 'internal_helper_exposed'; end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p1d_%'
      and p.proname not like 'f23_3e_p1d_internal_%'
      and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))
  ) then raise exception 'application_security_drift'; end if;
  if exists (
    select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name)
    cross join (values
      ('public.center_crm_control'),('public.crm_contact'),('public.consultation_case'),
      ('public.consultation_case_assignment'),('public.crm_care_log'),
      ('public.crm_audit_event'),('public.crm_outbox_event')
    ) tables(name)
    where pg_catalog.has_table_privilege(roles.name,tables.name,'SELECT')
       or pg_catalog.has_table_privilege(roles.name,tables.name,'INSERT')
       or pg_catalog.has_table_privilege(roles.name,tables.name,'UPDATE')
       or pg_catalog.has_table_privilege(roles.name,tables.name,'DELETE')
  ) then raise exception 'generic_table_privilege'; end if;
end $qa$;
`)
  const browserDenied = psql(`set role authenticated; select * from public.f23_3e_p1d_create_consultation_case(${u(randomUUID())},${u(randomUUID())},${u(randomUUID())},1);`, { expectFailure: true })
  assert.notEqual(browserDenied.status, 0)
  assert.match(`${browserDenied.stdout}\n${browserDenied.stderr}`, /permission denied/i)
  console.log('P1D_QA_BROWSER_RPC_EXECUTE_DENIED: PASS')
  console.log('P1D_QA_SERVICE_ROLE_RPC_GRANTS_EXACT: PASS')
  console.log('P1D_QA_INTERNAL_HELPERS_NOT_EXPOSED: PASS')
  console.log('P1D_QA_CRM_TABLE_PRIVILEGES_FAIL_CLOSED: PASS')

  psql(`
insert into auth.users (id,aud,role,created_at,updated_at) values
${Object.values(users).map((id) => `(${u(id)},'authenticated','authenticated',pg_catalog.now(),pg_catalog.now())`).join(',\n')};
insert into public.centers (id,name) values
${centerKeys.map((key) => `(${q(centers[key])},${q(`p1dqa_${key}`)})`).join(',\n')};
update public.center_crm_control
set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
where center_id <> ${q(centers.gate)} and center_id in (${centerKeys.map((key) => q(centers[key])).join(',')});
insert into public.center_members (center_id,user_id,role,status)
select c.center_id, m.user_id, m.role, m.status
from (values ${centerKeys.filter((key) => key !== 'gate').map((key) => `(${q(centers[key])})`).join(',')}) c(center_id)
cross join (values
  (${u(users.consultantA)},'consultant','active'),
  (${u(users.consultantB)},'consultant','active'),
  (${u(users.consultantC)},'consultant','active'),
  (${u(users.ineligible)},'admin','active')
) m(user_id,role,status);
insert into public.center_members (center_id,user_id,role,status)
values (${q(centers.foreign)},${u(users.foreignOnly)},'consultant','active');
`)

  const gateContact = randomUUID(); fixtureIds.push(gateContact)
  assert.equal(call.createContact(gateContact, centers.gate, users.actor).outcome_code, 'CRM_RUNTIME_NOT_ACTIVE')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_contact where crm_contact_id=${u(gateContact)};`), '0')
  console.log('P1D_QA_INACTIVE_ROOT_DENIES_MUTATION: PASS')

  const coreContact = randomUUID(); fixtureIds.push(coreContact)
  const createdContact = call.createContact(coreContact, centers.core, users.actor)
  assert.equal(createdContact.outcome_code, 'CONTACT_CREATED'); assert.equal(createdContact.resource_version, 1)
  assert.equal(call.createContact(coreContact, centers.core, users.actor).outcome_code, 'RESOURCE_ALREADY_EXISTS')
  const updatedContact = call.updateContact(coreContact, users.actor, 1)
  assert.equal(updatedContact.outcome_code, 'CONTACT_UPDATED'); assert.equal(updatedContact.resource_version, 2)
  assert.equal(call.updateContact(coreContact, users.actor, 1).outcome_code, 'CONTACT_VERSION_STALE')
  const contacted = call.contactStatus(coreContact, users.actor, 2, 'CONTACTED')
  assert.equal(contacted.outcome_code, 'CONTACT_STATUS_CHANGED'); assert.equal(contacted.resource_version, 3)
  const archived = call.contactStatus(coreContact, users.actor, 3, 'ARCHIVED', 'qa_archive')
  assert.equal(archived.outcome_code, 'CONTACT_STATUS_CHANGED'); assert.equal(archived.resource_version, 4)
  assert.equal(call.updateContact(coreContact, users.actor, 4).outcome_code, 'CONTACT_STATE_CONFLICT')
  console.log('P1D_QA_CREATE_CONTACT: PASS')
  console.log('P1D_QA_CONTACT_PREALLOCATED_ID_RETRY_SAFE: PASS')
  console.log('P1D_QA_UPDATE_CONTACT: PASS')
  console.log('P1D_QA_CONTACT_VERSION_STALE: PASS')
  console.log('P1D_QA_CONTACT_STATUS_TRANSITION: PASS')
  console.log('P1D_QA_ARCHIVED_CONTACT_NORMAL_MUTATION_DENIED: PASS')

  const caseContact = randomUUID(); const caseMain = randomUUID()
  fixtureIds.push(caseContact, caseMain)
  assert.equal(call.createContact(caseContact, centers.case, users.actor).outcome_code, 'CONTACT_CREATED')
  assert.equal(call.createCase(randomUUID(), caseContact, users.actor, 2).outcome_code, 'CONTACT_VERSION_STALE')
  const createdCase = call.createCase(caseMain, caseContact, users.actor, 1)
  assert.equal(createdCase.outcome_code, 'CASE_CREATED'); assert.equal(createdCase.case_version, 1)
  const consultingCase = call.caseStatus(caseMain, users.actor, 1, 'CONSULTING')
  assert.equal(consultingCase.outcome_code, 'CASE_STATUS_CHANGED'); assert.equal(consultingCase.case_version, 2)
  assert.equal(call.caseStatus(caseMain, users.actor, 2, 'CONVERTED').outcome_code, 'INVALID_INPUT')

  const terminal = newContactCase('case')
  assert.equal(call.caseStatus(terminal.caseId, users.actor, 1, 'LOST').outcome_code, 'CASE_STATUS_CHANGED')
  assert.equal(call.caseStatus(terminal.caseId, users.actor, 2, 'OPEN').outcome_code, 'RESOURCE_STATE_CONFLICT')

  const caseWithAssignment = newContactCase('case'); const terminalAssignment = randomUUID()
  fixtureIds.push(terminalAssignment)
  assert.equal(call.assign(terminalAssignment, caseWithAssignment.caseId, users.actor, users.consultantA, 1).outcome_code, 'ASSIGNMENT_CREATED')
  assert.equal(call.caseStatus(caseWithAssignment.caseId, users.actor, 2, 'LOST').outcome_code, 'ACTIVE_ASSIGNMENT_CONFLICT')
  console.log('P1D_QA_CREATE_CASE: PASS')
  console.log('P1D_QA_CASE_EXACT_CONTACT_VERSION: PASS')
  console.log('P1D_QA_CASE_STATUS_TRANSITION: PASS')
  console.log('P1D_QA_CASE_CONVERTED_STATUS_UNREACHABLE: PASS')
  console.log('P1D_QA_TERMINAL_CASE_REOPEN_DENIED: PASS')
  console.log('P1D_QA_TERMINAL_CASE_WITH_ACTIVE_ASSIGNMENT_DENIED: PASS')

  const assignmentFixture = newContactCase('assignment')
  const assignmentA = randomUUID(); const duplicateAssignment = randomUUID()
  fixtureIds.push(assignmentA, duplicateAssignment)
  const assigned = call.assign(assignmentA, assignmentFixture.caseId, users.actor, users.consultantA, 1)
  assert.equal(assigned.outcome_code, 'ASSIGNMENT_CREATED'); assert.equal(assigned.case_version, 2)
  assert.equal(call.assign(duplicateAssignment, assignmentFixture.caseId, users.actor, users.consultantB, 2).outcome_code, 'ACTIVE_ASSIGNMENT_CONFLICT')

  const exactCenterCase = newContactCase('assignment')
  assert.equal(call.assign(randomUUID(), exactCenterCase.caseId, users.actor, users.foreignOnly, 1).outcome_code, 'TARGET_NOT_ELIGIBLE')
  assert.equal(call.assign(randomUUID(), exactCenterCase.caseId, users.actor, users.ineligible, 1).outcome_code, 'TARGET_NOT_ELIGIBLE')

  const assignmentB = randomUUID(); fixtureIds.push(assignmentB)
  const reassigned = call.reassign(assignmentB, assignmentFixture.caseId, users.actor, users.consultantB, 2, assignmentA, 1)
  assert.equal(reassigned.outcome_code, 'ASSIGNMENT_REASSIGNED'); assert.equal(reassigned.case_version, 3)
  const assignmentState = jsonValue(`
select pg_catalog.json_build_object(
  'old_status',(select assignment_status from public.consultation_case_assignment where assignment_id=${u(assignmentA)}),
  'old_version',(select assignment_version from public.consultation_case_assignment where assignment_id=${u(assignmentA)}),
  'new_status',(select assignment_status from public.consultation_case_assignment where assignment_id=${u(assignmentB)}),
  'pointer',(select active_assignment_id from public.consultation_case where consultation_case_id=${u(assignmentFixture.caseId)})
)::text;
`)
  assert.deepEqual(assignmentState, { old_status: 'SUPERSEDED', old_version: 2, new_status: 'ACTIVE', pointer: assignmentB })
  const ended = call.end(assignmentFixture.caseId, users.actor, 3, assignmentB, 1)
  assert.equal(ended.outcome_code, 'ASSIGNMENT_ENDED'); assert.equal(ended.case_version, 4)

  const revokeFixture = newContactCase('assignment'); const revokeAssignment = randomUUID()
  fixtureIds.push(revokeAssignment)
  assert.equal(call.assign(revokeAssignment, revokeFixture.caseId, users.actor, users.consultantA, 1).outcome_code, 'ASSIGNMENT_CREATED')
  const revoked = call.revoke(revokeFixture.caseId, users.actor, 2, revokeAssignment, 1)
  assert.equal(revoked.outcome_code, 'ASSIGNMENT_REVOKED'); assert.equal(revoked.case_version, 3)
  expectSqlFailure(`
update public.consultation_case_assignment
set assignment_status='ACTIVE', assignment_version=assignment_version+1, ended_at=null, end_reason=null
where assignment_id=${u(revokeAssignment)};
`, /terminal_assignment_cannot_be_rewritten|active_assignment_must_transition/i)
  console.log('P1D_QA_ASSIGN_CASE: PASS')
  console.log('P1D_QA_ASSIGNMENT_TARGET_EXACT_CENTER: PASS')
  console.log('P1D_QA_ASSIGNMENT_TARGET_ELIGIBILITY: PASS')
  console.log('P1D_QA_ONE_ACTIVE_ASSIGNMENT: PASS')
  console.log('P1D_QA_REASSIGN_CASE: PASS')
  console.log('P1D_QA_REASSIGN_OLD_SUPERSEDED: PASS')
  console.log('P1D_QA_REASSIGN_NEW_ACTIVE: PASS')
  console.log('P1D_QA_REASSIGN_CASE_POINTER_EXACT: PASS')
  console.log('P1D_QA_END_ASSIGNMENT: PASS')
  console.log('P1D_QA_REVOKE_ASSIGNMENT: PASS')
  console.log('P1D_QA_TERMINAL_ASSIGNMENT_REOPEN_DENIED: PASS')

  const careFixture = newContactCase('care'); const otherCareFixture = newContactCase('care')
  const originalLog = randomUUID(); const correctionLog = randomUUID(); const crossLog = randomUUID()
  fixtureIds.push(originalLog, correctionLog, crossLog)
  const appended = call.appendLog(originalLog, careFixture.caseId, users.actor)
  assert.equal(appended.outcome_code, 'CARE_LOG_APPENDED')
  const originalBefore = scalar(`select pg_catalog.md5(pg_catalog.row_to_json(l)::text) from public.crm_care_log l where care_log_id=${u(originalLog)};`)
  const corrected = call.correctLog(correctionLog, careFixture.caseId, users.actor, originalLog)
  assert.equal(corrected.outcome_code, 'CARE_LOG_CORRECTED')
  const originalAfter = scalar(`select pg_catalog.md5(pg_catalog.row_to_json(l)::text) from public.crm_care_log l where care_log_id=${u(originalLog)};`)
  assert.equal(originalAfter, originalBefore)
  assert.equal(scalar(`select correction_of_care_log_id from public.crm_care_log where care_log_id=${u(correctionLog)};`), originalLog)
  assert.equal(call.correctLog(crossLog, otherCareFixture.caseId, users.actor, originalLog).outcome_code, 'CROSS_CENTER_CONFLICT')
  console.log('P1D_QA_APPEND_CARE_LOG: PASS')
  console.log('P1D_QA_CORRECT_CARE_LOG_APPEND_ONLY: PASS')
  console.log('P1D_QA_CARE_LOG_ORIGINAL_UNCHANGED: PASS')
  console.log('P1D_QA_CROSS_CASE_CORRECTION_DENIED: PASS')

  const eventIntegrity = jsonValue(`
select pg_catalog.json_build_object(
  'audit_count',(select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.assignment)}),
  'outbox_count',(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.assignment)}),
  'unpaired',(select pg_catalog.count(*) from public.crm_audit_event a
    where a.center_id=${q(centers.assignment)} and not exists (
      select 1 from public.crm_outbox_event o
      where o.center_id=a.center_id and o.event_type=a.event_type
        and o.aggregate_id=a.resource_id
        and o.safe_payload->>'correlation_id'=a.correlation_id::text)),
  'bad_outbox_state',(select pg_catalog.count(*) from public.crm_outbox_event
    where center_id=${q(centers.assignment)} and
      (delivery_status<>'PENDING' or attempt_count<>0 or delivery_version<>1)),
  'raw_value_leak',(select pg_catalog.count(*) from public.crm_outbox_event
    where safe_payload::text like '%Safe QA operational note%')
)::text;
`)
  assert(eventIntegrity.audit_count > 0)
  assert.equal(eventIntegrity.audit_count, eventIntegrity.outbox_count)
  assert.equal(eventIntegrity.unpaired, 0); assert.equal(eventIntegrity.bad_outbox_state, 0)
  assert.equal(eventIntegrity.raw_value_leak, 0)
  console.log('P1D_QA_BUSINESS_AUDIT_OUTBOX_ATOMIC: PASS')
  console.log('P1D_QA_AUDIT_OUTBOX_NO_RAW_PII: PASS')

  // C1: two separate sessions update the same expected Contact version.
  const c1Contact = randomUUID(); fixtureIds.push(c1Contact)
  assert.equal(call.createContact(c1Contact, centers.c1, users.actor).outcome_code, 'CONTACT_CREATED')
  const c1Rows = await concurrentBarrier(1,
    workerRpcSql(`public.f23_3e_p1d_update_crm_contact(${u(c1Contact)},${u(users.actor)},1,'c1_worker_a',${bytea('31', 16)},1,${digestArray('31')},1)`),
    workerRpcSql(`public.f23_3e_p1d_update_crm_contact(${u(c1Contact)},${u(users.actor)},1,'c1_worker_b',${bytea('32', 16)},1,${digestArray('32')},1)`),
  )
  assertOneWinner(c1Rows, 'CONTACT_UPDATED', ['CONTACT_VERSION_STALE'])
  assert.equal(scalar(`select contact_version from public.crm_contact where crm_contact_id=${u(c1Contact)};`), '2')
  console.log('P1D_QA_CONCURRENT_CONTACT_UPDATE_ONE_WINNER: PASS')

  // C2: two lifecycle transitions race on the same Case version.
  const c2 = newContactCase('c2')
  const c2Rows = await concurrentBarrier(2,
    workerRpcSql(`public.f23_3e_p1d_transition_consultation_case_status(${u(c2.caseId)},${u(users.actor)},1,'CONSULTING','c2_worker_a')`),
    workerRpcSql(`public.f23_3e_p1d_transition_consultation_case_status(${u(c2.caseId)},${u(users.actor)},1,'PAUSED','c2_worker_b')`),
  )
  assertOneWinner(c2Rows, 'CASE_STATUS_CHANGED', ['CASE_VERSION_STALE'])
  assert.equal(scalar(`select case_version from public.consultation_case where consultation_case_id=${u(c2.caseId)};`), '2')
  console.log('P1D_QA_CONCURRENT_CASE_STATUS_ONE_WINNER: PASS')

  // C3: concurrent initial Assignment attempts serialize under the Case/root locks.
  const c3 = newContactCase('c3'); const c3A = randomUUID(); const c3B = randomUUID()
  fixtureIds.push(c3A, c3B)
  const c3Rows = await concurrentBarrier(3,
    workerRpcSql(`public.f23_3e_p1d_assign_consultation_case(${u(c3A)},${u(c3.caseId)},${u(users.actor)},${u(users.consultantA)},1)`),
    workerRpcSql(`public.f23_3e_p1d_assign_consultation_case(${u(c3B)},${u(c3.caseId)},${u(users.actor)},${u(users.consultantB)},1)`),
  )
  assertOneWinner(c3Rows, 'ASSIGNMENT_CREATED', ['CASE_VERSION_STALE', 'ACTIVE_ASSIGNMENT_CONFLICT'])
  assert.equal(scalar(`select pg_catalog.count(*) from public.consultation_case_assignment where consultation_case_id=${u(c3.caseId)} and assignment_status='ACTIVE';`), '1')
  console.log('P1D_QA_CONCURRENT_INITIAL_ASSIGNMENT_ONE_WINNER: PASS')

  // C4: Reassign and Revoke race from one exact active Assignment snapshot.
  const c4 = newContactCase('c4'); const c4Old = randomUUID(); const c4New = randomUUID()
  fixtureIds.push(c4Old, c4New)
  assert.equal(call.assign(c4Old, c4.caseId, users.actor, users.consultantA, 1).outcome_code, 'ASSIGNMENT_CREATED')
  const c4Rows = await concurrentBarrier(4,
    workerRpcSql(`public.f23_3e_p1d_reassign_consultation_case(${u(c4New)},${u(c4.caseId)},${u(users.actor)},${u(users.consultantB)},2,${u(c4Old)},1,'c4_reassign')`),
    workerRpcSql(`public.f23_3e_p1d_revoke_consultation_case_assignment(${u(c4.caseId)},${u(users.actor)},2,${u(c4Old)},1,'c4_revoke')`),
  )
  assert.equal(c4Rows.filter((row) => row.ok).length, 1)
  assert.equal(c4Rows.filter((row) => !row.ok && ['CASE_VERSION_STALE', 'ASSIGNMENT_IDENTITY_STALE'].includes(row.outcome_code)).length, 1)
  const c4Invariant = jsonValue(`
select pg_catalog.json_build_object(
  'active_count',(select pg_catalog.count(*) from public.consultation_case_assignment where consultation_case_id=${u(c4.caseId)} and assignment_status='ACTIVE'),
  'pointer',(select active_assignment_id from public.consultation_case where consultation_case_id=${u(c4.caseId)}),
  'active_id',(select assignment_id from public.consultation_case_assignment where consultation_case_id=${u(c4.caseId)} and assignment_status='ACTIVE' limit 1)
)::text;
`)
  assert(c4Invariant.active_count === 0 || c4Invariant.active_count === 1)
  assert.equal(c4Invariant.pointer, c4Invariant.active_id ?? null)
  console.log('P1D_QA_CONCURRENT_REASSIGN_VS_REVOKE_SAFE: PASS')

  // C5: only one of two exact-snapshot reassignments can win.
  const c5 = newContactCase('c5'); const c5Old = randomUUID(); const c5NewA = randomUUID(); const c5NewB = randomUUID()
  fixtureIds.push(c5Old, c5NewA, c5NewB)
  assert.equal(call.assign(c5Old, c5.caseId, users.actor, users.consultantA, 1).outcome_code, 'ASSIGNMENT_CREATED')
  const c5Rows = await concurrentBarrier(5,
    workerRpcSql(`public.f23_3e_p1d_reassign_consultation_case(${u(c5NewA)},${u(c5.caseId)},${u(users.actor)},${u(users.consultantB)},2,${u(c5Old)},1,'c5_worker_a')`),
    workerRpcSql(`public.f23_3e_p1d_reassign_consultation_case(${u(c5NewB)},${u(c5.caseId)},${u(users.actor)},${u(users.consultantC)},2,${u(c5Old)},1,'c5_worker_b')`),
  )
  assertOneWinner(c5Rows, 'ASSIGNMENT_REASSIGNED', ['CASE_VERSION_STALE', 'ASSIGNMENT_IDENTITY_STALE'])
  assert.equal(scalar(`select pg_catalog.count(*) from public.consultation_case_assignment where consultation_case_id=${u(c5.caseId)} and assignment_status='ACTIVE';`), '1')
  assert.equal(scalar(`select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id in (${u(c5NewA)},${u(c5NewB)});`), '1')
  console.log('P1D_QA_CONCURRENT_DOUBLE_REASSIGN_ONE_WINNER: PASS')

  // C6: duplicate preallocated Care Log ID produces one row and one success.
  const c6 = newContactCase('c6'); const c6Log = randomUUID(); fixtureIds.push(c6Log)
  const c6Rows = await concurrentBarrier(6,
    workerRpcSql(`public.f23_3e_p1d_append_crm_care_log(${u(c6Log)},${u(c6.caseId)},${u(users.actor)},'NOTE','Safe C6 worker A note')`),
    workerRpcSql(`public.f23_3e_p1d_append_crm_care_log(${u(c6Log)},${u(c6.caseId)},${u(users.actor)},'NOTE','Safe C6 worker B note')`),
  )
  assertOneWinner(c6Rows, 'CARE_LOG_APPENDED', ['RESOURCE_ALREADY_EXISTS'])
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_care_log where care_log_id=${u(c6Log)};`), '1')
  assert.equal(scalar(`select pg_catalog.count(*) from public.crm_audit_event where resource_id=${u(c6Log)} and event_type='crm.care_log.appended';`), '1')
  console.log('P1D_QA_CONCURRENT_DUPLICATE_CARE_LOG_ID_SAFE: PASS')

  // Eligibility revoke wins the membership row lock; waiting Assign rechecks the committed state.
  const eligibility = newContactCase('eligibility'); const eligibilityAssignment = randomUUID()
  fixtureIds.push(eligibilityAssignment)
  const revoker = collect(spawnPsql())
  revoker.child.stdin.write(`
begin;
update public.center_members set status='inactive', updated_at=pg_catalog.clock_timestamp()
where center_id=${q(centers.eligibility)} and user_id=${u(users.consultantA)};
select 'ELIGIBILITY_REVOKE_LOCKED';
`)
  await revoker.marker('ELIGIBILITY_REVOKE_LOCKED')
  const waitingAssign = collect(spawnPsql())
  waitingAssign.child.stdin.end(`
set application_name='p1d_eligibility_waiter';
${workerRpcSql(`public.f23_3e_p1d_assign_consultation_case(${u(eligibilityAssignment)},${u(eligibility.caseId)},${u(users.actor)},${u(users.consultantA)},1)`)}
`)
  const waitDeadline = Date.now() + 20_000
  let lockObserved = false
  while (Date.now() < waitDeadline) {
    lockObserved = scalar(`select exists(select 1 from pg_catalog.pg_stat_activity where application_name='p1d_eligibility_waiter' and wait_event_type='Lock');`) === 't'
    if (lockObserved) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert(lockObserved, 'Eligibility assignment never waited on the locked membership row')
  revoker.child.stdin.end('commit;\n')
  const eligibilityResult = parseWorkerJson((await waitingAssign.done).stdout)
  await revoker.done
  assert.equal(eligibilityResult.outcome_code, 'TARGET_NOT_ELIGIBLE')
  assert.equal(scalar(`select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id=${u(eligibilityAssignment)};`), '0')
  console.log('P1D_QA_ASSIGNMENT_ELIGIBILITY_REVOKE_RACE_SAFE: PASS')

  // Forced Audit failure must roll back the preceding business mutation.
  const faultAuditContact = randomUUID(); fixtureIds.push(faultAuditContact)
  assert.equal(call.createContact(faultAuditContact, centers.fault_audit, users.actor).outcome_code, 'CONTACT_CREATED')
  const faultAuditCountsBefore = scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_audit)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_audit)})::text;`)
  psql(`
create function public.f23_3e_p1d_qa_fail_audit() returns trigger
language plpgsql set search_path='' as $qa$
begin
  if new.resource_id=${u(faultAuditContact)} and new.event_type='crm.contact.updated' then
    raise exception 'p1d_qa_forced_audit_failure';
  end if;
  return new;
end $qa$;
create trigger f23_3e_p1d_qa_fail_audit before insert on public.crm_audit_event
for each row execute function public.f23_3e_p1d_qa_fail_audit();
`)
  expectSqlFailure(`
set role service_role;
select * from public.f23_3e_p1d_update_crm_contact(${u(faultAuditContact)},${u(users.actor)},1,'fault_audit',${bytea('41', 16)},1,${digestArray('41')},1);
`, /p1d_qa_forced_audit_failure/i)
  psql(`drop trigger f23_3e_p1d_qa_fail_audit on public.crm_audit_event; drop function public.f23_3e_p1d_qa_fail_audit();`)
  assert.equal(scalar(`select contact_version from public.crm_contact where crm_contact_id=${u(faultAuditContact)};`), '1')
  assert.equal(scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_audit)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_audit)})::text;`), faultAuditCountsBefore)
  console.log('P1D_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK_BUSINESS: PASS')

  // Forced Outbox failure must roll back both business data and the Audit insert.
  const faultOutboxContact = randomUUID(); fixtureIds.push(faultOutboxContact)
  assert.equal(call.createContact(faultOutboxContact, centers.fault_outbox, users.actor).outcome_code, 'CONTACT_CREATED')
  const faultOutboxCountsBefore = scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_outbox)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_outbox)})::text;`)
  psql(`
create function public.f23_3e_p1d_qa_fail_outbox() returns trigger
language plpgsql set search_path='' as $qa$
begin
  if new.aggregate_id=${u(faultOutboxContact)} and new.event_type='crm.contact.updated' then
    raise exception 'p1d_qa_forced_outbox_failure';
  end if;
  return new;
end $qa$;
create trigger f23_3e_p1d_qa_fail_outbox before insert on public.crm_outbox_event
for each row execute function public.f23_3e_p1d_qa_fail_outbox();
`)
  expectSqlFailure(`
set role service_role;
select * from public.f23_3e_p1d_update_crm_contact(${u(faultOutboxContact)},${u(users.actor)},1,'fault_outbox',${bytea('42', 16)},1,${digestArray('42')},1);
`, /p1d_qa_forced_outbox_failure/i)
  psql(`drop trigger f23_3e_p1d_qa_fail_outbox on public.crm_outbox_event; drop function public.f23_3e_p1d_qa_fail_outbox();`)
  assert.equal(scalar(`select contact_version from public.crm_contact where crm_contact_id=${u(faultOutboxContact)};`), '1')
  assert.equal(scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_outbox)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_outbox)})::text;`), faultOutboxCountsBefore)
  console.log('P1D_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK_BUSINESS: PASS')

  // A failure in Reassign's second event pair rolls back old/new/Case and both pairs.
  const faultReassign = newContactCase('fault_reassign')
  const faultOld = randomUUID(); const faultNew = randomUUID(); fixtureIds.push(faultOld, faultNew)
  assert.equal(call.assign(faultOld, faultReassign.caseId, users.actor, users.consultantA, 1).outcome_code, 'ASSIGNMENT_CREATED')
  const faultReassignCountsBefore = scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_reassign)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_reassign)})::text;`)
  psql(`
create function public.f23_3e_p1d_qa_fail_second_event() returns trigger
language plpgsql set search_path='' as $qa$
begin
  if new.resource_id=${u(faultNew)} and new.event_type='crm.assignment.assigned' then
    raise exception 'p1d_qa_forced_second_event_failure';
  end if;
  return new;
end $qa$;
create trigger f23_3e_p1d_qa_fail_second_event before insert on public.crm_audit_event
for each row execute function public.f23_3e_p1d_qa_fail_second_event();
`)
  expectSqlFailure(`
set role service_role;
select * from public.f23_3e_p1d_reassign_consultation_case(${u(faultNew)},${u(faultReassign.caseId)},${u(users.actor)},${u(users.consultantB)},2,${u(faultOld)},1,'fault_second_event');
`, /p1d_qa_forced_second_event_failure/i)
  psql(`drop trigger f23_3e_p1d_qa_fail_second_event on public.crm_audit_event; drop function public.f23_3e_p1d_qa_fail_second_event();`)
  const faultReassignState = jsonValue(`
select pg_catalog.json_build_object(
  'old_status',(select assignment_status from public.consultation_case_assignment where assignment_id=${u(faultOld)}),
  'old_version',(select assignment_version from public.consultation_case_assignment where assignment_id=${u(faultOld)}),
  'new_count',(select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id=${u(faultNew)}),
  'pointer',(select active_assignment_id from public.consultation_case where consultation_case_id=${u(faultReassign.caseId)}),
  'case_version',(select case_version from public.consultation_case where consultation_case_id=${u(faultReassign.caseId)})
)::text;
`)
  assert.deepEqual(faultReassignState, { old_status: 'ACTIVE', old_version: 1, new_count: 0, pointer: faultOld, case_version: 2 })
  assert.equal(scalar(`select (select pg_catalog.count(*) from public.crm_audit_event where center_id=${q(centers.fault_reassign)})::text||':'||(select pg_catalog.count(*) from public.crm_outbox_event where center_id=${q(centers.fault_reassign)})::text;`), faultReassignCountsBefore)
  console.log('P1D_QA_REASSIGN_SECOND_EVENT_FAILURE_ROLLS_BACK_ALL: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    runReset()
    containerId = discoverContainer()
    const post = jsonValue(`
select pg_catalog.json_build_object(
  'migration_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608100002'),
  'fixture_count',(
    (select pg_catalog.count(*) from public.centers where name like 'p1dqa_%')
    + (select pg_catalog.count(*) from auth.users where id in (${Object.values(users).map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_contact where crm_contact_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.consultation_case where consultation_case_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_care_log where care_log_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_audit_event where resource_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_outbox_event where aggregate_id in (${fixtureIds.map(u).join(',')}))
  ),
  'nondefault_root_count',(select pg_catalog.count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED'),
  'qa_helper_count',(select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p1d_qa_%')
)::text;
`)
    assert.equal(post.migration_count, 1)
    assert.equal(post.fixture_count, 0)
    assert.equal(post.nondefault_root_count, 0)
    assert.equal(post.qa_helper_count, 0)
    leftoverCount = post.fixture_count
    nondefaultRootCount = post.nondefault_root_count
    finalResetPassed = true
  } catch (resetError) {
    if (!primaryError) primaryError = resetError
    else primaryError = new AggregateError([primaryError, resetError], 'P1D QA and final reset both failed')
  }
}

if (finalResetPassed) {
  console.log('P1D_QA_FINAL_LOCAL_RESET: PASS')
  console.log(`P1D_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
  console.log(`P1D_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
}
if (primaryError) throw primaryError

console.log('F23.3E-P1D local behavioral, fault-injection, and concurrency QA passed')
