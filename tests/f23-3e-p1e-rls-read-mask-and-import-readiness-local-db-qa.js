import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  RESERVED_CANONICAL_CRM_ENTITY_TYPES,
  listCloudEntities,
  upsertCloudEntities,
} from '../src/cloud-db-sync.js'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P1E_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')
const toolPath = resolve('tools/f23-3e-p1e-localstorage-import-preview.js')

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
console.log('P1E_QA_LOCAL_SAFETY_GUARD: PASS')

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
const jsonRows = (expression) => {
  const output = psql(`set role service_role; select pg_catalog.row_to_json(r)::text from ${expression} r; reset role;`).stdout
  return output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{')).map(JSON.parse)
}
const oneRow = (expression) => {
  const rows = jsonRows(expression)
  assert.equal(rows.length, 1, `Expected one row from ${expression}`)
  return rows[0]
}
const expectSqlFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, 'SQL was expected to fail')
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const centers = { a: randomUUID(), b: randomUUID() }
const users = {
  owner: randomUUID(), admin: randomUUID(), consultantA: randomUUID(),
  consultantB: randomUUID(), other: randomUUID(), foreign: randomUUID(), inactive: randomUUID(),
}
const ids = {
  contactA1: randomUUID(), contactA2: randomUUID(), contactB1: randomUUID(), activeWriteContact: randomUUID(),
  caseA1: randomUUID(), caseA2: randomUUID(), caseB1: randomUUID(),
  assignmentA1: randomUUID(), assignmentA2: randomUUID(), assignmentB1: randomUUID(), reassignmentA1: randomUUID(),
  logA1: randomUUID(), logA2: randomUUID(), logB1: randomUUID(),
}
const fixtureIds = [...Object.values(centers), ...Object.values(users), ...Object.values(ids)]
const rawPhone = ['0909', '123', '456'].join('')
const rawEmail = ['p1e.fixture', 'example.invalid'].join('@')
const tmpRoot = mkdtempSync(join(tmpdir(), 'ichess-p1e-qa-'))
assert(resolve(tmpRoot).startsWith(resolve(tmpdir())), 'Temporary fixture directory escaped OS temp')

const rpc = {
  contacts: (actor, center, afterAt = null, afterId = null, limit = 50) =>
    `public.f23_3e_p1e_list_crm_contacts_masked(${u(actor)},${q(center)},${afterAt ? `${q(afterAt)}::timestamptz` : 'null'},${afterId ? u(afterId) : 'null'},${limit})`,
  cases: (actor, center, afterAt = null, afterId = null, limit = 50) =>
    `public.f23_3e_p1e_list_consultation_cases_masked(${u(actor)},${q(center)},${afterAt ? `${q(afterAt)}::timestamptz` : 'null'},${afterId ? u(afterId) : 'null'},${limit})`,
  detail: (actor, caseId) => `public.f23_3e_p1e_get_consultation_case_masked(${u(actor)},${u(caseId)})`,
  logs: (actor, caseId, afterAt = null, afterId = null, limit = 50) =>
    `public.f23_3e_p1e_list_case_care_logs(${u(actor)},${u(caseId)},${afterAt ? `${q(afterAt)}::timestamptz` : 'null'},${afterId ? u(afterId) : 'null'},${limit})`,
  readiness: (actor, center) => `public.f23_3e_p1e_get_local_import_readiness(${u(actor)},${q(center)})`,
}

const runPreview = (inputPath, expectedCenter, priorPath = '') => run(process.execPath, [
  toolPath, '--input', inputPath, '--expected-center', expectedCenter,
  ...(priorPath ? ['--prior-manifest', priorPath] : []),
])

let primaryError
let finalResetPassed = false
let leftoverCount = -1
let nondefaultRootCount = -1

try {
  runReset()
  containerId = discoverContainer()

  assert.equal(scalar(`select pg_catalog.count(*) from supabase_migrations.schema_migrations where version in ('202607310001','202607310002','202608100001','202608100002','202608100003');`), '5')

  const signatures = [
    'public.f23_3e_p1e_list_crm_contacts_masked(uuid,text,timestamp with time zone,uuid,integer)',
    'public.f23_3e_p1e_list_consultation_cases_masked(uuid,text,timestamp with time zone,uuid,integer)',
    'public.f23_3e_p1e_get_consultation_case_masked(uuid,uuid)',
    'public.f23_3e_p1e_list_case_care_logs(uuid,uuid,timestamp with time zone,uuid,integer)',
    'public.f23_3e_p1e_get_local_import_readiness(uuid,text)',
  ]
  const crmTables = [
    'center_crm_control', 'crm_contact', 'consultation_case',
    'consultation_case_candidate_student', 'consultation_case_assignment', 'crm_care_log',
    'crm_conversion_request', 'crm_idempotency_registry', 'crm_audit_event', 'crm_outbox_event',
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
      where n.nspname='public' and p.proname like 'f23_3e_p1e_%' and p.proname not like 'f23_3e_p1e_internal_%') <> 5 then
    raise exception 'application_rpc_count';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p1e_internal_%'
      and (pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) then raise exception 'internal_helper_exposed'; end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p1e_%'
      and p.proname not like 'f23_3e_p1e_internal_%'
      and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))
  ) then raise exception 'application_security_drift'; end if;
end $qa$;
`)
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${crmTables.map(q).join(',')}) and c.relrowsecurity and c.relforcerowsecurity;`), '10')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_policy p where p.polrelid in (${crmTables.map((name) => `${q(`public.${name}`)}::regclass`).join(',')});`), '0')
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in (${crmTables.map(q).join(',')});`), '0')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of crmTables) {
      assert.equal(scalar(`select pg_catalog.has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  expectSqlFailure(`set role authenticated; select * from ${rpc.readiness(users.owner, centers.a)};`, /permission denied/i)
  expectSqlFailure('set role service_role; select * from public.crm_contact;', /permission denied/i)
  expectSqlFailure('set role authenticated; select * from public.crm_contact;', /permission denied|row-level security/i)
  console.log('P1E_QA_DIRECT_AUTHENTICATED_TABLE_SELECT_DENIED: PASS')
  console.log('P1E_QA_DIRECT_SERVICE_ROLE_TABLE_SELECT_DENIED: PASS')
  console.log('P1E_QA_ZERO_BROWSER_RLS_POLICIES: PASS')
  console.log('P1E_QA_CRM_NOT_IN_REALTIME_PUBLICATION: PASS')
  console.log('P1E_QA_SERVICE_ROLE_READ_RPCS_EXACT: PASS')
  console.log('P1E_QA_BROWSER_RPC_EXECUTE_DENIED: PASS')
  console.log('P1E_QA_INTERNAL_HELPERS_NOT_EXPOSED: PASS')

  psql(`
insert into auth.users (id,aud,role,created_at,updated_at) values
${Object.values(users).map((id) => `(${u(id)},'authenticated','authenticated',pg_catalog.now(),pg_catalog.now())`).join(',\n')};
insert into public.centers (id,name) values (${q(centers.a)},'p1eqa_a'),(${q(centers.b)},'p1eqa_b');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1
where center_id in (${q(centers.a)},${q(centers.b)});
insert into public.center_members(center_id,user_id,role,status) values
(${q(centers.a)},${u(users.owner)},'owner','active'),
(${q(centers.a)},${u(users.admin)},'center_admin','active'),
(${q(centers.a)},${u(users.consultantA)},'consultant','active'),
(${q(centers.a)},${u(users.consultantB)},'consultant','active'),
(${q(centers.a)},${u(users.other)},'teacher','active'),
(${q(centers.a)},${u(users.inactive)},'consultant','inactive'),
(${q(centers.b)},${u(users.foreign)},'consultant','active');
insert into public.crm_contact(
  crm_contact_id,center_id,display_name,contact_status,source_category,initial_interest,safe_location_area,
  protected_contact_methods_ciphertext,contact_methods_crypto_version,normalized_lookup_digests,
  normalization_version,created_by_user_id,created_at,updated_at
) values
(${u(ids.contactA1)},${q(centers.a)},'Masked A1','NEW','qa','Chess A1','Area A',pg_catalog.convert_to(${q(`${rawPhone}|${rawEmail}`)},'UTF8'),1,array[pg_catalog.decode(pg_catalog.repeat('11',32),'hex')],1,${u(users.owner)},'2026-08-10T01:00:00Z','2026-08-10T01:00:00Z'),
(${u(ids.contactA2)},${q(centers.a)},'Masked A2','NEW','qa','Chess A2','Area A',pg_catalog.convert_to('protected-a2','UTF8'),1,array[pg_catalog.decode(pg_catalog.repeat('22',32),'hex')],1,${u(users.owner)},'2026-08-10T01:00:01Z','2026-08-10T01:00:01Z'),
(${u(ids.contactB1)},${q(centers.b)},'Masked B1','NEW','qa','Chess B1','Area B',pg_catalog.convert_to('protected-b1','UTF8'),1,array[pg_catalog.decode(pg_catalog.repeat('33',32),'hex')],1,${u(users.owner)},'2026-08-10T01:00:02Z','2026-08-10T01:00:02Z');
insert into public.consultation_case(
  consultation_case_id,center_id,primary_contact_id,interest_summary,safe_case_summary,created_by_user_id,created_at,updated_at
) values
(${u(ids.caseA1)},${q(centers.a)},${u(ids.contactA1)},'Interest A1','Safe A1',${u(users.owner)},'2026-08-10T02:00:00Z','2026-08-10T02:00:00Z'),
(${u(ids.caseA2)},${q(centers.a)},${u(ids.contactA2)},'Interest A2','Safe A2',${u(users.owner)},'2026-08-10T02:00:01Z','2026-08-10T02:00:01Z'),
(${u(ids.caseB1)},${q(centers.b)},${u(ids.contactB1)},'Interest B1','Safe B1',${u(users.owner)},'2026-08-10T02:00:02Z','2026-08-10T02:00:02Z');
begin;
set constraints all deferred;
insert into public.consultation_case_assignment(assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id) values
(${u(ids.assignmentA1)},${q(centers.a)},${u(ids.caseA1)},${u(users.consultantA)},${u(users.owner)}),
(${u(ids.assignmentA2)},${q(centers.a)},${u(ids.caseA2)},${u(users.consultantB)},${u(users.owner)}),
(${u(ids.assignmentB1)},${q(centers.b)},${u(ids.caseB1)},${u(users.foreign)},${u(users.owner)});
update public.consultation_case c set active_assignment_id=v.assignment_id,case_version=2
from (values (${u(ids.caseA1)},${u(ids.assignmentA1)}),(${u(ids.caseA2)},${u(ids.assignmentA2)}),(${u(ids.caseB1)},${u(ids.assignmentB1)})) v(case_id,assignment_id)
where c.consultation_case_id=v.case_id;
commit;
insert into public.crm_care_log(care_log_id,center_id,consultation_case_id,author_user_id,entry_type,safe_content,created_at) values
(${u(ids.logA1)},${q(centers.a)},${u(ids.caseA1)},${u(users.consultantA)},'NOTE','Safe care A1','2026-08-10T03:00:00Z'),
(${u(ids.logA2)},${q(centers.a)},${u(ids.caseA2)},${u(users.consultantB)},'NOTE','Safe care A2','2026-08-10T03:00:01Z'),
(${u(ids.logB1)},${q(centers.b)},${u(ids.caseB1)},${u(users.foreign)},'NOTE','Safe care B1','2026-08-10T03:00:02Z');
`)

  const ownerContacts = jsonRows(rpc.contacts(users.owner, centers.a))
  const adminContacts = jsonRows(rpc.contacts(users.admin, centers.a))
  assert.equal(ownerContacts.length, 2)
  assert.deepEqual(adminContacts.map((row) => row.crm_contact_id), ownerContacts.map((row) => row.crm_contact_id))
  expectSqlFailure(`set role service_role; select * from ${rpc.contacts(users.consultantA, centers.a)};`, /READ_SCOPE_DENIED/i)
  const firstContactPage = jsonRows(rpc.contacts(users.owner, centers.a, null, null, 1))
  const secondContactPage = jsonRows(rpc.contacts(users.owner, centers.a, firstContactPage[0].updated_at, firstContactPage[0].crm_contact_id, 1))
  assert.equal(firstContactPage.length, 1); assert.equal(secondContactPage.length, 1)
  assert.notEqual(firstContactPage[0].crm_contact_id, secondContactPage[0].crm_contact_id)
  console.log('P1E_QA_OWNER_CENTER_WIDE_MASKED_CONTACT_READ: PASS')
  console.log('P1E_QA_CENTER_ADMIN_CENTER_WIDE_MASKED_CONTACT_READ: PASS')
  console.log('P1E_QA_CONSULTANT_GLOBAL_CONTACT_LIST_DENIED: PASS')

  const ownerCases = jsonRows(rpc.cases(users.owner, centers.a))
  const adminCases = jsonRows(rpc.cases(users.admin, centers.a))
  const consultantACases = jsonRows(rpc.cases(users.consultantA, centers.a))
  const foreignCenterCases = jsonRows(rpc.cases(users.foreign, centers.b))
  assert.equal(ownerCases.length, 2); assert.equal(adminCases.length, 2)
  assert.deepEqual(consultantACases.map((row) => row.consultation_case_id), [ids.caseA1])
  assert.deepEqual(foreignCenterCases.map((row) => row.consultation_case_id), [ids.caseB1])
  expectSqlFailure(`set role service_role; select * from ${rpc.cases(users.foreign, centers.a)};`, /READ_SCOPE_DENIED/i)
  expectSqlFailure(`set role service_role; select * from ${rpc.cases(users.other, centers.a)};`, /READ_SCOPE_DENIED/i)
  expectSqlFailure(`set role service_role; select * from ${rpc.detail(users.consultantA, ids.caseA2)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  expectSqlFailure(`set role service_role; select * from ${rpc.detail(users.consultantA, ids.caseB1)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  assert.equal(oneRow(rpc.detail(users.consultantA, ids.caseA1)).consultation_case_id, ids.caseA1)
  assert.deepEqual(jsonRows(rpc.logs(users.consultantA, ids.caseA1)).map((row) => row.care_log_id), [ids.logA1])
  expectSqlFailure(`set role service_role; select * from ${rpc.logs(users.consultantA, ids.caseA2)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  expectSqlFailure(`set role service_role; select * from ${rpc.cases(users.inactive, centers.a)};`, /READ_SCOPE_DENIED/i)
  console.log('P1E_QA_OWNER_CASE_LIST_EXACT_CENTER: PASS')
  console.log('P1E_QA_ADMIN_CASE_LIST_EXACT_CENTER: PASS')
  console.log('P1E_QA_CONSULTANT_ONLY_ASSIGNED_CASE: PASS')
  console.log('P1E_QA_CONSULTANT_UNASSIGNED_CASE_HIDDEN: PASS')
  console.log('P1E_QA_FOREIGN_CENTER_CASE_HIDDEN: PASS')
  console.log('P1E_QA_CASE_DETAIL_ASSIGNED_ONLY: PASS')
  console.log('P1E_QA_CARE_LOG_ASSIGNED_ONLY: PASS')
  console.log('P1E_QA_INACTIVE_MEMBERSHIP_DENIED: PASS')
  console.log('P1E_QA_OTHER_ROLE_DENIED: PASS')

  const serializedReads = JSON.stringify([...ownerContacts, ...ownerCases, oneRow(rpc.detail(users.owner, ids.caseA1))])
  for (const forbidden of [rawPhone, rawEmail, 'protected_contact_methods_ciphertext', 'normalized_lookup_digests', 'contact_methods_crypto_version', 'normalization_version']) {
    assert(!serializedReads.includes(forbidden), `Masked output leaked ${forbidden}`)
  }
  for (const row of [...ownerContacts, ...ownerCases]) {
    assert.equal(row.contact_methods_visibility, 'MASKED_PROTECTED')
    assert.equal(row.projection_cache_policy, 'NO_STORE')
    if ('full_contact_reveal_available' in row) assert.equal(row.full_contact_reveal_available, false)
  }
  assert.equal(scalar(`select pg_catalog.count(*) from pg_catalog.pg_proc where proname like 'f23_3e_p1e%reveal%';`), '0')
  console.log('P1E_QA_MASKING_BEFORE_SERIALIZATION: PASS')
  console.log('P1E_QA_RAW_CONTACT_NEVER_RETURNED: PASS')
  console.log('P1E_QA_FULL_REVEAL_RPC_ABSENT: PASS')

  const ownerReady = oneRow(rpc.readiness(users.owner, centers.a))
  const adminReady = oneRow(rpc.readiness(users.admin, centers.a))
  const consultantReady = oneRow(rpc.readiness(users.consultantA, centers.a))
  assert(ownerReady.ok && adminReady.ok)
  assert.equal(ownerReady.real_import_allowed, false)
  assert.deepEqual([consultantReady.ok, consultantReady.outcome_code], [false, 'IMPORT_PREVIEW_DENIED'])

  psql(`update public.center_crm_control set crm_state='READ_ONLY',feature_flag_state='READ_ONLY',control_version=control_version+1 where center_id=${q(centers.a)};`)
  assert.equal(jsonRows(rpc.contacts(users.owner, centers.a)).length, 2)
  const writeDenied = oneRow(`public.f23_3e_p1d_create_crm_contact(${u(ids.activeWriteContact)},${q(centers.a)},${u(users.owner)},'qa',pg_catalog.convert_to('protected','UTF8'),1,array[pg_catalog.decode(pg_catalog.repeat('44',32),'hex')],1)`)
  assert.deepEqual([writeDenied.ok, writeDenied.outcome_code], [false, 'CRM_RUNTIME_NOT_ACTIVE'])
  psql(`update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1 where center_id=${q(centers.a)};`)
  const writeAllowed = oneRow(`public.f23_3e_p1d_create_crm_contact(${u(ids.activeWriteContact)},${q(centers.a)},${u(users.owner)},'qa',pg_catalog.convert_to('protected','UTF8'),1,array[pg_catalog.decode(pg_catalog.repeat('44',32),'hex')],1)`)
  assert.deepEqual([writeAllowed.ok, writeAllowed.outcome_code], [true, 'CONTACT_CREATED'])
  psql(`update public.center_crm_control set crm_state='PLANNED',feature_flag_state='DISABLED',control_version=control_version+1 where center_id=${q(centers.a)};`)
  expectSqlFailure(`set role service_role; select * from ${rpc.contacts(users.owner, centers.a)};`, /CRM_READ_NOT_ACTIVE/i)
  psql(`update public.center_crm_control set crm_state='SUSPENDED',feature_flag_state='READ_ONLY',control_version=control_version+1 where center_id=${q(centers.a)};`)
  expectSqlFailure(`set role service_role; select * from ${rpc.contacts(users.owner, centers.a)};`, /CRM_READ_NOT_ACTIVE/i)
  psql(`update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1 where center_id=${q(centers.a)};`)
  console.log('P1E_QA_READ_ONLY_COHORT: PASS')
  console.log('P1E_QA_P1D_MUTATION_GATE_UNCHANGED: PASS')

  const reassign = oneRow(`public.f23_3e_p1d_reassign_consultation_case(${u(ids.reassignmentA1)},${u(ids.caseA1)},${u(users.owner)},${u(users.consultantB)},2,${u(ids.assignmentA1)},1,'p1e_qa_reassign')`)
  assert.equal(reassign.outcome_code, 'ASSIGNMENT_REASSIGNED')
  assert.equal(jsonRows(rpc.cases(users.consultantA, centers.a)).length, 0)
  assert.deepEqual(jsonRows(rpc.cases(users.consultantB, centers.a)).map((row) => row.consultation_case_id).sort(), [ids.caseA1, ids.caseA2].sort())
  expectSqlFailure(`set role service_role; select * from ${rpc.detail(users.consultantA, ids.caseA1)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  console.log('P1E_QA_REASSIGN_REMOVES_OLD_CONSULTANT_READ: PASS')
  const ended = oneRow(`public.f23_3e_p1d_end_consultation_case_assignment(${u(ids.caseA1)},${u(users.owner)},3,${u(ids.reassignmentA1)},1,'p1e_qa_end')`)
  assert.equal(ended.outcome_code, 'ASSIGNMENT_ENDED')
  expectSqlFailure(`set role service_role; select * from ${rpc.detail(users.consultantB, ids.caseA1)};`, /RESOURCE_NOT_FOUND_OR_DENIED/i)
  console.log('P1E_QA_ENDED_ASSIGNMENT_REMOVES_CONSULTANT_READ: PASS')

  let networkCalls = 0
  const denySpy = { from() { networkCalls += 1; throw new Error('NETWORK_PATH_REACHED') } }
  for (const entityType of RESERVED_CANONICAL_CRM_ENTITY_TYPES) {
    const listed = await listCloudEntities({ supabase: denySpy, centerId: centers.a, entityType })
    const upserted = await upsertCloudEntities({ supabase: denySpy, centerId: centers.a, entityType, items: [] })
    assert.equal(listed.detail.code, 'GENERIC_CLOUD_CANONICAL_CRM_ENTITY_DENIED')
    assert.equal(upserted.detail.code, 'GENERIC_CLOUD_CANONICAL_CRM_ENTITY_DENIED')
  }
  assert.equal(networkCalls, 0)
  let nonCrmCalls = 0
  const allowedChain = {
    select() { return this },
    eq() { return this },
    is() { return this },
    order() { return Promise.resolve({ data: [], error: null }) },
    upsert() { return Promise.resolve({ error: null }) },
  }
  const allowedSpy = { from() { nonCrmCalls += 1; return allowedChain } }
  assert.equal((await listCloudEntities({ supabase: allowedSpy, centerId: centers.a, entityType: 'student' })).ok, true)
  assert.equal((await upsertCloudEntities({
    supabase: allowedSpy, centerId: centers.a, entityType: 'student', items: [{ id: 'synthetic-student-1' }],
  })).ok, true)
  assert.equal(nonCrmCalls, 2)
  console.log('P1E_QA_GENERIC_CLOUD_CRM_GUARD_BEFORE_NETWORK: PASS')
  console.log('P1E_QA_GENERIC_CLOUD_NON_CRM_UNCHANGED: PASS')

  const storageKey = `ichessCenterOS.parentConsultations.${centers.a}`
  const exportEnvelope = {
    format_version: 1,
    source_center_id: centers.a,
    source_storage_key: storageKey,
    records: [
      { id: 'legacy-1', customerStage: 'lead', parentName: 'Synthetic One', phone: rawPhone, email: rawEmail, careLogs: [{ content: 'Synthetic private care text' }], linkedStudentIds: [] },
      { id: 'legacy-2', customerStage: 'consulting', appointments: [{ note: 'Synthetic appointment' }], enrollmentDraft: { note: 'Synthetic draft' }, studentId: 'legacy-student-2' },
      { id: 'legacy-3', customerStage: 'converted', leadStudentName: 'Synthetic Child' },
      { id: 'legacy-1', customerStage: 'lead', parentName: 'Synthetic Duplicate' },
      42,
    ],
  }
  const exportPath = join(tmpRoot, 'export.json')
  writeFileSync(exportPath, JSON.stringify(exportEnvelope), 'utf8')
  const previewA = runPreview(exportPath, centers.a)
  const previewB = runPreview(exportPath, centers.a)
  requireSuccess(previewA, 'Import preview A'); requireSuccess(previewB, 'Import preview B')
  assert.equal(previewA.stdout, previewB.stdout)
  const manifest = JSON.parse(previewA.stdout)
  assert.equal(manifest.converted_claim_count, 1)
  assert.equal(manifest.duplicate_legacy_locator_count, 1)
  assert(manifest.records.some((row) => row.legacy_stage_claim === 'LEGACY_CONVERTED_CLAIM_REVIEW_REQUIRED'))
  assert(manifest.records.some((row) => row.review_codes.includes('DUPLICATE_LEGACY_ID_REVIEW_REQUIRED')))
  assert(manifest.records.every((row) => row.proposed_action === 'REVIEW_ONLY'))
  const previewOutput = `${previewA.stdout}\n${previewA.stderr}`
  for (const raw of [rawPhone, rawEmail, 'Synthetic private care text', 'Synthetic One', 'Synthetic Child']) assert(!previewOutput.includes(raw))
  console.log('P1E_QA_IMPORT_PREVIEW_DETERMINISTIC: PASS')
  console.log('P1E_QA_LEGACY_CONVERTED_REVIEW_ONLY: PASS')
  console.log('P1E_QA_DUPLICATE_LEGACY_ID_REVIEW: PASS')
  console.log('P1E_QA_IMPORT_PREVIEW_OUTPUT_PII_FREE: PASS')

  const malformedPath = join(tmpRoot, 'malformed.json')
  writeFileSync(malformedPath, '{not-json', 'utf8')
  const malformed = runPreview(malformedPath, centers.a)
  assert.notEqual(malformed.status, 0); assert.match(malformed.stdout, /MALFORMED_EXPORT/)
  const partialPath = join(tmpRoot, 'partial.json')
  writeFileSync(partialPath, JSON.stringify({ format_version: 1, source_center_id: centers.a }), 'utf8')
  const partial = runPreview(partialPath, centers.a)
  assert.notEqual(partial.status, 0); assert.match(partial.stdout, /PARTIAL_OR_MALFORMED_EXPORT/)
  const mismatch = runPreview(exportPath, centers.b)
  assert.notEqual(mismatch.status, 0); assert.match(mismatch.stdout, /CENTER_NAMESPACE_MISMATCH/)
  console.log('P1E_QA_MALFORMED_EXPORT_FAILS_CLOSED: PASS')
  console.log('P1E_QA_CENTER_NAMESPACE_MISMATCH_FAILS_CLOSED: PASS')
  console.log('P1E_QA_PARTIAL_EXPORT_FAILS_CLOSED: PASS')

  const baselineEnvelope = {
    format_version: 1, source_center_id: centers.a, source_storage_key: storageKey,
    records: [{ id: 'divergent-1', customerStage: 'lead', phone: ['0909', '000', '001'].join('') }],
  }
  const baselinePath = join(tmpRoot, 'baseline.json')
  const baselineManifestPath = join(tmpRoot, 'baseline-manifest.json')
  writeFileSync(baselinePath, JSON.stringify(baselineEnvelope), 'utf8')
  const baselinePreview = runPreview(baselinePath, centers.a)
  requireSuccess(baselinePreview, 'Baseline import preview')
  writeFileSync(baselineManifestPath, baselinePreview.stdout, 'utf8')
  const divergentPath = join(tmpRoot, 'divergent.json')
  writeFileSync(divergentPath, JSON.stringify({
    ...baselineEnvelope,
    records: [{ id: 'divergent-1', customerStage: 'lead', phone: ['0909', '000', '002'].join('') }],
  }), 'utf8')
  const divergent = runPreview(divergentPath, centers.a, baselineManifestPath)
  requireSuccess(divergent, 'Divergent import preview')
  assert(JSON.parse(divergent.stdout).records[0].review_codes.includes('DIVERGENT_LOCAL_EDIT_REVIEW_REQUIRED'))

  const tamperedManifest = JSON.parse(readFileSync(baselineManifestPath, 'utf8'))
  tamperedManifest.outcome_code = 'TAMPERED'
  const tamperedPath = join(tmpRoot, 'tampered-manifest.json')
  writeFileSync(tamperedPath, JSON.stringify(tamperedManifest), 'utf8')
  const tampered = runPreview(divergentPath, centers.a, tamperedPath)
  assert.notEqual(tampered.status, 0); assert.match(tampered.stdout, /PRIOR_MANIFEST_DIGEST_MISMATCH/)
  console.log('P1E_QA_LOCAL_EDIT_AFTER_PREVIEW_REQUIRES_REVIEW: PASS')
  console.log('P1E_QA_PRIOR_MANIFEST_TAMPER_FAILS_CLOSED: PASS')

  // Use physical JSON text: an object literal would not prove that __proto__ is
  // an own data key before the tool parses and canonicalizes the fixture.
  const prototypeExportJson = (version) => `{"format_version":1,"source_center_id":${JSON.stringify(centers.a)},"source_storage_key":${JSON.stringify(storageKey)},"records":[{"id":"prototype-sensitive-1","customerStage":"lead","__proto__":{"version":${version}},"constructor":{"kind":"json-data"},"prototype":{"kind":"json-data"}}]}`
  const prototypeExportAPath = join(tmpRoot, 'prototype-export-a.json')
  const prototypeExportBPath = join(tmpRoot, 'prototype-export-b.json')
  const prototypeManifestAPath = join(tmpRoot, 'prototype-manifest-a.json')
  const prototypeExportAJson = prototypeExportJson(1)
  const prototypeExportBJson = prototypeExportJson(2)
  writeFileSync(prototypeExportAPath, prototypeExportAJson, 'utf8')
  writeFileSync(prototypeExportBPath, prototypeExportBJson, 'utf8')

  const parsedPrototypeFixture = JSON.parse(prototypeExportAJson)
  const prototypeSensitiveRecord = parsedPrototypeFixture.records[0]
  assert(Object.hasOwn(prototypeSensitiveRecord, '__proto__'))
  assert(Object.hasOwn(prototypeSensitiveRecord, 'constructor'))
  assert(Object.hasOwn(prototypeSensitiveRecord, 'prototype'))
  assert.equal(prototypeSensitiveRecord.version, undefined)
  assert.equal(Object.prototype.version, undefined)

  const prototypePreviewA = runPreview(prototypeExportAPath, centers.a)
  const prototypePreviewB = runPreview(prototypeExportBPath, centers.a)
  requireSuccess(prototypePreviewA, 'Prototype-sensitive preview A')
  requireSuccess(prototypePreviewB, 'Prototype-sensitive preview B')
  const prototypeManifestA = JSON.parse(prototypePreviewA.stdout)
  const prototypeManifestB = JSON.parse(prototypePreviewB.stdout)
  assert.notEqual(prototypeManifestA.export_digest, prototypeManifestB.export_digest)
  assert.notEqual(prototypeManifestA.records[0].record_digest, prototypeManifestB.records[0].record_digest)
  writeFileSync(prototypeManifestAPath, prototypePreviewA.stdout, 'utf8')

  const prototypeDivergent = runPreview(prototypeExportBPath, centers.a, prototypeManifestAPath)
  requireSuccess(prototypeDivergent, 'Prototype-sensitive divergent preview')
  const prototypeDivergentManifest = JSON.parse(prototypeDivergent.stdout)
  assert(prototypeDivergentManifest.records[0].review_codes.includes('DIVERGENT_LOCAL_EDIT_REVIEW_REQUIRED'))
  assert.equal(Object.prototype.version, undefined)
  assert.equal(({}).version, undefined)
  console.log('P1E_QA_PROTOTYPE_SENSITIVE_KEY_CHANGES_DIGEST: PASS')
  console.log('P1E_QA_PROTOTYPE_SENSITIVE_DIVERGENCE_DETECTED: PASS')
  console.log('P1E_QA_CANONICALIZATION_PROTOTYPE_SAFE: PASS')
} catch (error) {
  primaryError = error
} finally {
  try {
    if (resolve(tmpRoot).startsWith(resolve(tmpdir())) && tmpRoot.includes('ichess-p1e-qa-')) {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
    runReset()
    containerId = discoverContainer()
    const post = JSON.parse(scalar(`
select pg_catalog.json_build_object(
  'migration_count',(select pg_catalog.count(*) from supabase_migrations.schema_migrations where version='202608100003'),
  'fixture_count',(
    (select pg_catalog.count(*) from public.centers where name like 'p1eqa_%')
    + (select pg_catalog.count(*) from auth.users where id in (${Object.values(users).map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_contact where crm_contact_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.consultation_case where consultation_case_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.consultation_case_assignment where assignment_id in (${fixtureIds.map(u).join(',')}))
    + (select pg_catalog.count(*) from public.crm_care_log where care_log_id in (${fixtureIds.map(u).join(',')}))
  ),
  'nondefault_root_count',(select pg_catalog.count(*) from public.center_crm_control where crm_state<>'PLANNED' or feature_flag_state<>'DISABLED'),
  'qa_helper_count',(select pg_catalog.count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p1e_qa_%')
)::text;
`))
    assert.equal(post.migration_count, 1)
    assert.equal(post.fixture_count, 0)
    assert.equal(post.nondefault_root_count, 0)
    assert.equal(post.qa_helper_count, 0)
    leftoverCount = post.fixture_count
    nondefaultRootCount = post.nondefault_root_count
    finalResetPassed = true
  } catch (resetError) {
    if (!primaryError) primaryError = resetError
    else primaryError = new AggregateError([primaryError, resetError], 'P1E QA and final reset both failed')
  }
}

if (finalResetPassed) {
  console.log('P1E_QA_FINAL_LOCAL_RESET: PASS')
  console.log(`P1E_QA_LEFTOVER_FIXTURE_COUNT: ${leftoverCount}`)
  console.log(`P1E_QA_NONDEFAULT_ROOT_COUNT: ${nondefaultRootCount}`)
}
if (primaryError) throw primaryError

console.log('F23.3E-P1E local behavioral, security, fault-injection, and multi-account QA passed')
