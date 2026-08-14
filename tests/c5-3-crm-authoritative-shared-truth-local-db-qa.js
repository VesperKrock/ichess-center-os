import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC53AppendCareLogCommand,
  buildC53AssignCaseCommand,
  buildC53CreateLeadCommand,
  buildC53SaveCaseCommand,
  buildC53UpsertAppointmentCommand,
  mutateC53CrmSharedTruth,
  pullC53CrmSharedTruth,
} from '../src/cloud-authoritative-crm.js'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_3_LOCAL_QA_ALLOW_RESET'

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

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
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}
const cliCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof localStatus[key], 'string')
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainer)
  assert.equal(rows.length, 1, 'Expected exactly one local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
let containerId = discoverContainer()
const runReset = () => requireSuccess(run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'local db reset')
const psqlArgs = (user = 'postgres') => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user,
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, user = 'postgres') => requireSuccess(run('docker', psqlArgs(user), { input: sql }), 'psql')
const scalar = (sql, user = 'postgres') => psql(sql, user).trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `C5.3!${randomUUID()}aA1`
const ids = {
  center: `c5-3-${randomUUID()}`,
  otherCenter: `c5-3-${randomUUID()}`,
  disabledCenter: `c5-3-${randomUUID()}`,
}
const emails = Object.fromEntries(['a', 'b', 'c', 'consultant', 'teacher']
  .map((key) => [key, `c5.3.${key}.${suffix}@example.invalid`]))

const admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return data.user
}
const signIn = async (email) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session?.access_token)
  return client
}
const mutate = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateC53CrmSharedTruth({ supabase: client, centerId, command, idempotencyKey })

class MemoryStorage {
  #items = new Map()
  getItem(key) { return this.#items.has(String(key)) ? this.#items.get(String(key)) : null }
  setItem(key, value) { this.#items.set(String(key), String(value)) }
  snapshot() { return Object.fromEntries(this.#items) }
}

const baseLead = {
  id: `contact-${suffix}`,
  contactType: 'consultingLead',
  parentName: 'C5.3 Synthetic Parent',
  phone: '0900000001',
  secondaryPhone: '',
  email: 'c53.parent@example.invalid',
  leadStudentName: 'C5.3 Candidate',
  leadNeed: 'Quan tâm lớp nhập môn cuối tuần',
  parentFeedbackAboutChild: 'Cần lộ trình làm quen an toàn',
  consultationStatus: 'newLead',
  source: 'website',
  interestedProgram: 'Nhập môn',
  preferredSchedule: 'Cuối tuần',
  locationArea: 'Khu vực kiểm thử',
  customerStage: 'lead',
  nextAction: 'Gọi lại',
  careLogs: [],
  appointments: [],
  enrollmentDraft: {
    isReady: false,
    interestedProgram: 'Nhập môn',
    preferredSchedule: 'Cuối tuần',
    learningGoal: 'Làm quen cờ vua',
    expectedTrialDate: '',
    childChessLevel: 'new',
    note: 'Draft học thử an toàn',
    advisorName: '',
  },
}

let fixtureCreated = false
let finalResetVerified = false
console.log('C5_3_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140003' and name='c5_3_crm_authoritative_shared_truth';`), '1')
  for (const table of ['crm_case_shared_state', 'crm_case_appointment', 'crm_shared_command_result']) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_3_list_crm_shared_truth(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_3_list_crm_shared_truth(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('crm_contact','consultation_case','crm_care_log','crm_case_shared_state','crm_case_appointment');`), '0')
  console.log('C5_3_QA_SCHEMA_RLS_ACL_REALTIME_HOLD: PASS')

  // The deterministic Vault primitives are granted to postgres only for this
  // synthetic local fixture. db reset removes these grants and all secrets.
  psql(`grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;`, 'supabase_admin')
  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p4a_contact_lookup_epoch_1','C5.3 synthetic local QA');`)

  const users = {
    a: await makeUser(emails.a),
    b: await makeUser(emails.b),
    c: await makeUser(emails.c),
    consultant: await makeUser(emails.consultant),
    teacher: await makeUser(emails.teacher),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.3 primary','active'),
    (${q(ids.otherCenter)},'C5.3 other','active'),
    (${q(ids.disabledCenter)},'C5.3 disabled','active');
update public.center_crm_control
set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1
where center_id in (${q(ids.center)},${q(ids.otherCenter)});
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.disabledCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'owner','active'),
    (${q(ids.center)},${u(users.consultant.id)},'consultant','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active');`)

  const [clientA, clientB, clientC, clientConsultant, clientTeacher, freshClientA] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c),
    signIn(emails.consultant), signIn(emails.teacher), signIn(emails.a),
  ])

  const createCommand = buildC53CreateLeadCommand(baseLead)
  const createKey = randomUUID()
  const created = await mutate(clientA, createCommand, createKey)
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.replayed, false)
  const replayedCreate = await mutate(clientA, createCommand, createKey)
  assert.equal(replayedCreate.ok, true)
  assert.equal(replayedCreate.replayed, true)
  assert.equal(replayedCreate.case_id, created.case_id)

  const readB = await pullC53CrmSharedTruth({ supabase: clientB, centerId: ids.center })
  assert.equal(readB.ok, true, JSON.stringify(readB))
  assert.equal(readB.records.length, 1)
  assert.equal(readB.records[0].parentName, baseLead.parentName)
  assert.equal(readB.records[0].phone, '')
  assert.equal(readB.records[0].email, '')
  assert.equal(readB.records[0].identityReadOnly, true)
  assert.equal(readB.records[0].canonicalCaseId, created.case_id)
  console.log('C5_3_QA_A_CREATE_B_SEES_MASKED_CANONICAL: PASS')

  const freshStorage = new MemoryStorage()
  const freshRead = await pullC53CrmSharedTruth({ supabase: freshClientA, centerId: ids.center })
  assert.equal(freshRead.ok, true)
  assert.equal(freshRead.records.length, 1)
  freshStorage.setItem(`crm:${ids.center}`, JSON.stringify(freshRead.records))
  assert.equal(JSON.parse(freshStorage.getItem(`crm:${ids.center}`)).length, 1)
  const otherRead = await pullC53CrmSharedTruth({ supabase: clientC, centerId: ids.otherCenter })
  assert.equal(otherRead.ok, true)
  assert.equal(otherRead.records.length, 0)
  const ownerSwitchOther = await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.otherCenter })
  const ownerSwitchBack = await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(ownerSwitchOther.records.length, 0)
  assert.equal(ownerSwitchBack.records.length, 1)
  assert.equal(ownerSwitchBack.records[0].id, baseLead.id)
  console.log('C5_3_QA_FRESH_CROSS_CENTER_OWNER_SWITCH: PASS')

  const staleSnapshot = readB.records[0]
  const edited = {
    ...staleSnapshot,
    consultationStatus: 'waitingResponse',
    customerStage: 'consulting',
    leadNeed: 'B cập nhật nhu cầu authoritative',
    nextAction: 'A gọi lại sau khi refresh',
    enrollmentDraft: {
      ...staleSnapshot.enrollmentDraft,
      isReady: true,
      expectedTrialDate: '2026-08-20',
      note: 'Durable trial draft B',
      readyAt: '2026-08-14T09:00:00.000Z',
    },
  }
  const saved = await mutate(clientB, buildC53SaveCaseCommand(edited))
  assert.equal(saved.ok, true, JSON.stringify(saved))
  const afterEditA = await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(afterEditA.records[0].leadNeed, edited.leadNeed)
  assert.equal(afterEditA.records[0].enrollmentDraft.isReady, true)
  assert.equal(afterEditA.records[0].enrollmentDraft.expectedTrialDate, '2026-08-20')

  const staleEdit = await mutate(clientA, buildC53SaveCaseCommand({
    ...staleSnapshot,
    leadNeed: 'stale overwrite attempt',
  }))
  assert.equal(staleEdit.ok, false)
  assert.equal(staleEdit.outcome_code, 'CASE_VERSION_STALE')
  console.log('C5_3_QA_B_EDIT_A_SEES_ENROLLMENT_STALE_CONFLICT: PASS')

  let current = afterEditA.records[0]
  const careCommand = buildC53AppendCareLogCommand(current, {
    contactedAt: '2026-08-14T10:00:00.000Z',
    channel: 'zalo',
    content: 'B đã xác nhận lịch học thử',
    result: 'Đồng ý lịch',
    nextAction: 'Gửi xác nhận',
  })
  const careKey = randomUUID()
  const careCreate = await mutate(clientB, careCommand, careKey)
  assert.equal(careCreate.ok, true, JSON.stringify(careCreate))
  const careReplay = await mutate(clientB, careCommand, careKey)
  assert.equal(careReplay.ok, true)
  assert.equal(careReplay.replayed, true)
  const careConflict = await mutate(clientB, {
    ...careCommand,
    care_log: { ...careCommand.care_log, payload: { ...careCommand.care_log.payload, content: 'Khác intent' } },
  }, careKey)
  assert.equal(careConflict.ok, false)
  assert.equal(careConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  current = (await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.center })).records[0]
  assert.equal(current.careLogs.length, 1)
  assert.equal(current.careLogs[0].content, 'B đã xác nhận lịch học thử')

  const appointment = {
    id: `appointment-${suffix}`,
    appointmentType: 'trialLesson',
    scheduledAt: '2026-08-20T09:00:00.000Z',
    channel: 'direct',
    location: 'Phòng kiểm thử',
    status: 'scheduled',
    note: 'Lịch học thử authoritative',
  }
  const appointmentCreate = await mutate(clientB, buildC53UpsertAppointmentCommand(current, appointment))
  assert.equal(appointmentCreate.ok, true, JSON.stringify(appointmentCreate))
  current = (await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.center })).records[0]
  assert.equal(current.appointments.length, 1)
  assert.equal(current.appointments[0].note, appointment.note)

  const assigned = await mutate(clientB, buildC53AssignCaseCommand(current, users.consultant.id))
  assert.equal(assigned.ok, true, JSON.stringify(assigned))
  current = (await pullC53CrmSharedTruth({ supabase: clientA, centerId: ids.center })).records[0]
  assert.equal(current.consultantId, users.consultant.id)
  assert.equal(current.cloudAssignmentVersion, 1)
  const consultantRead = await pullC53CrmSharedTruth({ supabase: clientConsultant, centerId: ids.center })
  assert.equal(consultantRead.ok, true)
  assert.equal(consultantRead.records.length, 1)
  console.log('C5_3_QA_CARE_APPOINTMENT_ASSIGNMENT_B_TO_A: PASS')

  const identityConflict = await mutate(clientA, buildC53CreateLeadCommand({
    ...baseLead,
    parentName: 'Silent merge forbidden',
  }))
  assert.equal(identityConflict.ok, false)
  assert.equal(identityConflict.outcome_code, 'SOURCE_IDENTITY_CONFLICT')
  const protectedSource = buildC53CreateLeadCommand({
    ...baseLead,
    id: 'leak@example.invalid',
  })
  const protectedSourceDenied = await mutate(clientA, protectedSource)
  assert.equal(protectedSourceDenied.ok, false)
  assert.equal(protectedSourceDenied.outcome_code, 'INVALID_PAYLOAD')
  const protectedDisplayDenied = await mutate(clientA, buildC53CreateLeadCommand({
    ...baseLead,
    id: `protected-display-${suffix}`,
    parentName: 'leak@example.invalid',
  }))
  assert.equal(protectedDisplayDenied.ok, false)
  assert.equal(protectedDisplayDenied.outcome_code, 'INVALID_PAYLOAD')
  const protectedCandidateDenied = await mutate(clientA, buildC53SaveCaseCommand({
    ...current,
    leadStudentName: '0900000001',
  }))
  assert.equal(protectedCandidateDenied.ok, false)
  assert.equal(protectedCandidateDenied.outcome_code, 'INVALID_PAYLOAD')
  const protectedAppointment = buildC53UpsertAppointmentCommand(current, {
    id: '0900000001',
    appointmentType: 'callback',
    scheduledAt: '2026-08-18T09:00:00.000Z',
    channel: 'phone',
    status: 'scheduled',
  })
  const protectedAppointmentDenied = await mutate(clientA, protectedAppointment)
  assert.equal(protectedAppointmentDenied.ok, false)
  assert.equal(protectedAppointmentDenied.outcome_code, 'INVALID_APPOINTMENT')
  const crossCenterMutation = await mutate(clientC, buildC53AppendCareLogCommand(current, {
    channel: 'note', content: 'cross-center attempt', contactedAt: new Date().toISOString(),
  }), randomUUID(), ids.otherCenter)
  assert.equal(crossCenterMutation.ok, false)
  assert.equal(crossCenterMutation.outcome_code, 'RESOURCE_NOT_FOUND_OR_DENIED')
  const teacherRead = await pullC53CrmSharedTruth({ supabase: clientTeacher, centerId: ids.center })
  assert.equal(teacherRead.ok, false)
  assert.equal(teacherRead.outcome_code, 'CENTER_ACCESS_DENIED')
  const disabledCreate = await mutate(clientA, buildC53CreateLeadCommand({
    ...baseLead, id: `disabled-${suffix}`,
  }), randomUUID(), ids.disabledCenter)
  assert.equal(disabledCreate.ok, false)
  assert.equal(disabledCreate.outcome_code, 'CRM_RUNTIME_NOT_ACTIVE')
  console.log('C5_3_QA_IDENTITY_CENTER_ROLE_ROOT_FAIL_CLOSED: PASS')

  const storageBeforeFailure = freshStorage.snapshot()
  const failedCloud = await mutateC53CrmSharedTruth({
    supabase: { rpc: async () => ({ data: null, error: { message: 'synthetic network failure' } }) },
    centerId: ids.center,
    command: buildC53AppendCareLogCommand(current, {
      channel: 'note', content: 'must not persist locally', contactedAt: new Date().toISOString(),
    }),
  })
  assert.equal(failedCloud.ok, false)
  assert.equal(failedCloud.outcome_code, 'SERVER_COMMAND_FAILED')
  assert.deepEqual(freshStorage.snapshot(), storageBeforeFailure)
  assert.equal(scalar(`select count(*) from public.crm_care_log where safe_content like '%must not persist locally%';`), '0')
  console.log('C5_3_QA_CLOUD_FAILURE_NO_LOCAL_SUCCESS: PASS')

  assert.equal(scalar(`select count(*) from public.crm_contact where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.consultation_case where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_case_shared_state where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_case_appointment where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_care_log where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.consultation_case_assignment where center_id=${q(ids.center)} and assignment_status='ACTIVE';`), '1')
  assert.equal(scalar(`select count(*) from public.crm_contact where center_id=${q(ids.otherCenter)};`), '0')
  assert.equal(scalar(`select count(*) from public.crm_audit_event where center_id=${q(ids.center)} and event_type in ('crm.candidate.shared_state_created','crm.candidate.shared_state_updated');`), '2')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where center_id=${q(ids.center)} and event_type in ('crm.candidate.shared_state_created','crm.candidate.shared_state_updated');`), '2')
  assert.equal(scalar(`select count(*) from public.crm_audit_event where row_to_json(crm_audit_event)::text ~* '(0900000001|c53.parent@example.invalid)';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where row_to_json(crm_outbox_event)::text ~* '(0900000001|c53.parent@example.invalid)';`), '0')

  const directTable = await fetch(`${localStatus.API_URL}/rest/v1/crm_case_shared_state?select=*`, {
    headers: { apikey: localStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${localStatus.SERVICE_ROLE_KEY}` },
  })
  assert([401, 403, 404].includes(directTable.status), `service_role direct table HTTP ${directTable.status}`)
  console.log('C5_3_QA_CANONICAL_COUNTS_AUDIT_NO_PII_DIRECT_TABLE_DENIED: PASS')
  console.log('C5_3_CRM_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from vault.secrets;'), '0')
    assert.equal(scalar(`select has_function_privilege('postgres','vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)','EXECUTE');`), 'f')
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_3_QA_FINAL_LOCAL_RESET: PASS')
