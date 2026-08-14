import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC55StaffHrUpsertCommand,
  mutateC55StaffHrSharedTruth,
  pullC55StaffHrSharedTruth,
  recordC55StaffHrAccessAudit,
} from '../src/cloud-authoritative-staff-hr.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_5_LOCAL_QA_ALLOW_RESET'
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
const getLocalStatus = () => JSON.parse(
  requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'),
)
let localStatus = getLocalStatus()
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string')
}
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainer)
  assert.equal(rows.length, 1, 'Expected exactly one guarded local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
let containerId = discoverContainer()
const runReset = () => requireSuccess(
  run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }),
  'local db reset',
)
const psqlArgs = (user = 'postgres') => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user,
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, user = 'postgres') => requireSuccess(
  run('docker', psqlArgs(user), { input: sql }), 'psql',
)
const expectPsqlFailure = (sql, pattern) => {
  const result = run('docker', psqlArgs(), { input: sql })
  assert.notEqual(result.status, 0, `Expected SQL failure: ${sql}`)
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}
const scalar = (sql, user = 'postgres') => psql(sql, user).trim()
const q = (value) => value === null || value === undefined
  ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `C5.5!${randomUUID()}aA1`
const ids = {
  center: `c5-5-${randomUUID()}`,
  otherCenter: `c5-5-${randomUUID()}`,
  department: `department-${randomUUID()}`,
  staff: `staff-${randomUUID()}`,
  profile: `admin-profile-${randomUUID()}`,
  document: `staff-document-${randomUUID()}`,
  policy: `staff-retention-${randomUUID()}`,
  request: `staff-deletion-request-${randomUUID()}`,
  teacher: `teacher-${randomUUID()}`,
}
const emails = Object.fromEntries(['a', 'b', 'c', 'teacher']
  .map((key) => [key, `c5.5.${key}.${suffix}@example.invalid`]))
let admin
let fixtureCreated = false
let finalResetVerified = false

const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
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
  mutateC55StaffHrSharedTruth({ supabase: client, centerId, command, idempotencyKey })
const pull = (client, centerId = ids.center) =>
  pullC55StaffHrSharedTruth({ supabase: client, centerId })
const accessAudit = (client, overrides = {}) => recordC55StaffHrAccessAudit({
  supabase: client,
  centerId: ids.center,
  action: 'administrative-profile.open',
  staffMemberId: ids.staff,
  administrativeProfileId: ids.profile,
  noteSummary: 'explicit-open',
  idempotencyKey: randomUUID(),
  ...overrides,
})
const staffPayload = (overrides = {}) => ({
  id: ids.staff, centerId: ids.center, employeeCode: 'NV-C55-001',
  fullName: 'Nhân viên C5.5', phone: '0900000000', email: 'staff@example.invalid',
  departmentId: ids.department, positionTitle: 'Điều phối', employmentType: 'full-time',
  employmentStatus: 'active', startDate: '2026-08-01', endDate: '',
  teacherId: '', teacherLinkedAt: '', accountUserId: '', membershipId: '',
  accountLinkedAt: '', employmentLifecycleEvents: [], note: 'Synthetic C5.5',
  createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z',
  archivedAt: '', ...overrides,
})
const departmentPayload = (overrides = {}) => ({
  id: ids.department, centerId: ids.center, name: 'Vận hành C5.5', code: 'VH-C55',
  description: 'Synthetic', sortOrder: 1, status: 'active', archivedAt: '', ...overrides,
})
const profilePayload = (overrides = {}) => ({
  id: ids.profile, schemaVersion: 1, centerId: ids.center, staffMemberId: ids.staff,
  legalFullName: 'Nhân viên C5.5', dateOfBirth: '1990-01-01', gender: 'other',
  nationality: 'VN',
  permanentAddress: { addressLine: '', wardOrCommune: '', district: '', provinceOrCity: '', country: '' },
  currentAddress: { addressLine: 'Memory only', wardOrCommune: '', district: '', provinceOrCity: 'HCM', country: 'VN' },
  emergencyContact: { name: 'Emergency', phone: '0900000001', relationship: 'Other' },
  identityDocument: { type: 'CCCD', number: 'C55-SENSITIVE-001', issuedDate: '2020-01-01', issuedPlace: 'HCM', expiryDate: '2030-01-01' },
  taxInformation: { taxNumber: 'TAX-C55', registeredDate: '', registeredPlace: '' },
  insuranceInformation: { socialInsuranceNumber: 'SI-C55', healthInsuranceNumber: 'HI-C55' },
  bankInformation: { bankName: 'Bank', accountNumber: 'BANK-C55', accountHolderName: 'Staff', branch: '' },
  employmentAdministration: { contractNumber: 'CONTRACT-C55', contractType: 'full-time', signedDate: '2026-08-01', effectiveDate: '2026-08-01', expiryDate: '', signingEntity: 'Center', note: '' },
  note: '', completionStatus: 'incomplete',
  completionReview: { reviewedAt: '', reviewedBy: '', reviewedByLabel: '', checklistVersion: 'f23.11b-v1' },
  archivedAt: '', ...overrides,
})
const documentPayload = (overrides = {}) => ({
  id: ids.document, schemaVersion: 1, centerId: ids.center,
  staffMemberId: ids.staff, administrativeProfileId: ids.profile,
  category: 'identity-document', title: 'CCCD synthetic', documentNumber: 'DOC-C55',
  issuedDate: '2020-01-01', effectiveDate: '2020-01-01', expiryDate: '2030-01-01',
  note: '', attachmentIds: [], archivedAt: '', ...overrides,
})

console.log('C5_5_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  localStatus = getLocalStatus()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140007' and name='c5_5_staff_hr_authoritative_shared_truth';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140008' and name='c5_5_independent_review_access_projection_attachment_hardening';`), '1')
  const protectedTables = [
    'center_staff_departments', 'center_staff_hr_members',
    'center_staff_administrative_profiles', 'center_staff_documents',
    'center_staff_document_attachment_retention_policies',
    'center_staff_deletion_requests', 'center_staff_hr_audit_events',
    'center_staff_hr_command_results',
  ]
  for (const table of protectedTables) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_5_list_staff_hr_shared_truth(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_5_list_staff_hr_shared_truth(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_5_mutate_staff_hr_shared_truth(text,jsonb,uuid)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_5_record_staff_hr_access_audit(text,text,text,text,text,uuid)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_5_record_staff_hr_access_audit(text,text,text,text,text,uuid)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_5_list_staff_hr_shared_truth_v1(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select count(*) from information_schema.columns where table_schema='public' and table_name='center_staff_administrative_profiles' and column_name='profile_payload';`), '0')
  console.log('C5_5_QA_SCHEMA_TYPED_RLS_ACL: PASS')

  admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users = {
    a: await makeUser(emails.a),
    b: await makeUser(emails.b),
    c: await makeUser(emails.c),
    teacher: await makeUser(emails.teacher),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.5 primary','active'),
    (${q(ids.otherCenter)},'C5.5 other','active');
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'owner','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active');`)

  const [clientA, clientB, clientC, clientTeacher, freshClientA] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c),
    signIn(emails.teacher), signIn(emails.a),
  ])
  const initial = await pull(clientA)
  assert.equal(initial.ok, true, JSON.stringify(initial))
  assert.equal(initial.staffMembers.length, 0)

  const teacherCreate = await clientA.rpc('c5_1_mutate_core_entity', {
    p_center_id: ids.center, p_entity_type: 'teacher', p_local_id: ids.teacher,
    p_expected_version: 0, p_payload: { id: ids.teacher, fullName: 'Teacher canonical', status: 'active' },
    p_idempotency_key: randomUUID(), p_operation: 'UPSERT',
  })
  assert.equal(teacherCreate.error, null)
  assert.equal(teacherCreate.data.ok, true, JSON.stringify(teacherCreate.data))

  const departmentCreate = await mutate(
    clientA, buildC55StaffHrUpsertCommand('department', departmentPayload()),
  )
  assert.equal(departmentCreate.ok, true, JSON.stringify(departmentCreate))
  const afterDepartmentB = await pull(clientB)
  assert.equal(afterDepartmentB.departments.length, 1)

  const staffCreate = await mutate(
    clientA, buildC55StaffHrUpsertCommand('staff_member', staffPayload()),
  )
  assert.equal(staffCreate.ok, true, JSON.stringify(staffCreate))
  const staleStaffA = (await pull(clientA)).staffMembers[0]
  const staffAtB = (await pull(clientB)).staffMembers[0]
  assert.equal(staffAtB.fullName, 'Nhân viên C5.5')

  const staffUpdateB = await mutate(clientB, buildC55StaffHrUpsertCommand('staff_member', {
    ...staffAtB, positionTitle: 'Quản lý vận hành',
  }))
  assert.equal(staffUpdateB.ok, true, JSON.stringify(staffUpdateB))
  const staleUpdateA = await mutate(clientA, buildC55StaffHrUpsertCommand('staff_member', {
    ...staleStaffA, positionTitle: 'Stale overwrite',
  }))
  assert.equal(staleUpdateA.ok, false)
  assert.equal(staleUpdateA.outcome_code, 'VERSION_STALE')
  assert.equal((await pull(clientA)).staffMembers[0].positionTitle, 'Quản lý vận hành')
  console.log('C5_5_QA_SAME_CENTER_STAFF_DEPARTMENT_STALE: PASS')

  let currentStaff = (await pull(clientA)).staffMembers[0]
  const teacherLinked = await mutate(clientA, buildC55StaffHrUpsertCommand('staff_member', {
    ...currentStaff, teacherId: ids.teacher,
    teacherLinkedAt: '2026-08-14T01:00:00.000Z',
  }))
  assert.equal(teacherLinked.ok, true, JSON.stringify(teacherLinked))
  currentStaff = (await pull(clientA)).staffMembers[0]
  const membershipB = scalar(`select id from public.center_members where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  const membershipCountBefore = scalar('select count(*) from public.center_members;')
  const accountLinked = await mutate(clientA, buildC55StaffHrUpsertCommand('staff_member', {
    ...currentStaff, accountUserId: users.b.id, membershipId: membershipB,
    accountLinkedAt: '2026-08-14T01:05:00.000Z',
  }))
  assert.equal(accountLinked.ok, true, JSON.stringify(accountLinked))
  assert.equal(scalar('select count(*) from public.center_members;'), membershipCountBefore)
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.center)} and entity_type='teacher';`), '1')
  currentStaff = (await pull(clientA)).staffMembers[0]
  const wrongCenterMembershipA = scalar(`select id from public.center_members where center_id=${q(ids.otherCenter)} and user_id=${u(users.a.id)};`)
  const invalidTeacherLink = await mutate(clientA, buildC55StaffHrUpsertCommand('staff_member', {
    ...currentStaff, teacherId: `teacher-${randomUUID()}`,
    teacherLinkedAt: '2026-08-14T01:10:00.000Z',
  }))
  assert.equal(invalidTeacherLink.ok, false)
  assert.equal(invalidTeacherLink.outcome_code, 'INVALID_REFERENCE')
  const invalidAccountLink = await mutate(clientA, buildC55StaffHrUpsertCommand('staff_member', {
    ...currentStaff, accountUserId: users.a.id, membershipId: wrongCenterMembershipA,
    accountLinkedAt: '2026-08-14T01:15:00.000Z',
  }))
  assert.equal(invalidAccountLink.ok, false)
  assert.equal(invalidAccountLink.outcome_code, 'INVALID_REFERENCE')
  const wrongPayloadCenter = await mutate(clientA, buildC55StaffHrUpsertCommand(
    'department', departmentPayload({
      id: `department-${randomUUID()}`,
      centerId: ids.otherCenter,
      code: 'WRONG-CENTER',
    }),
  ))
  assert.equal(wrongPayloadCenter.ok, false)
  assert.equal(wrongPayloadCenter.outcome_code, 'INVALID_PAYLOAD')
  assert.equal(scalar('select count(*) from public.center_members;'), membershipCountBefore)
  console.log('C5_5_QA_EXPLICIT_TEACHER_AUTH_REFERENCES: PASS')

  const profileCreate = await mutate(
    clientB, buildC55StaffHrUpsertCommand('administrative_profile', profilePayload()),
  )
  assert.equal(profileCreate.ok, true, JSON.stringify(profileCreate))
  const profilePullA = await pull(clientA)
  assert.equal(profilePullA.ok, true, JSON.stringify(profilePullA))
  const profileAtA = profilePullA.administrativeProfiles[0]
  assert.equal(profileAtA.identityDocument.number, 'C55-SENSITIVE-001')

  const accessAuditKey = randomUUID()
  const accessOpen = await accessAudit(clientB, { idempotencyKey: accessAuditKey })
  const accessReplay = await accessAudit(clientB, { idempotencyKey: accessAuditKey })
  assert.equal(accessOpen.ok, true, JSON.stringify(accessOpen))
  assert.deepEqual(accessReplay, accessOpen)
  const changedAccessIntent = await accessAudit(clientB, {
    action: 'administrative-profile.reveal-sensitive',
    noteSummary: 'identityDocument.number',
    idempotencyKey: accessAuditKey,
  })
  assert.equal(changedAccessIntent.ok, false)
  assert.equal(changedAccessIntent.outcome_code, 'IDEMPOTENCY_CONFLICT')
  const invalidSensitiveSummary = await accessAudit(clientB, {
    action: 'administrative-profile.reveal-sensitive',
    noteSummary: 'C55-SENSITIVE-001',
  })
  assert.equal(invalidSensitiveSummary.ok, false)
  assert.equal(invalidSensitiveSummary.outcome_code, 'INVALID_PAYLOAD')
  const auditPullA = await pull(clientA)
  assert(auditPullA.auditEvents.some((event) =>
    event.id === accessAuditKey && event.action === 'administrative-profile.open'))
  assert.equal(scalar(`select count(*) from public.center_staff_hr_audit_events where id=${u(accessAuditKey)} and actor_user_id=${u(users.b.id)} and actor_role='center_admin' and reason_code='server-access-audit';`), '1')
  console.log('C5_5_QA_SERVER_ACCESS_AUDIT_IDEMPOTENCY: PASS')

  const documentCreate = await mutate(
    clientA, buildC55StaffHrUpsertCommand('staff_document', documentPayload()),
  )
  assert.equal(documentCreate.ok, true, JSON.stringify(documentCreate))
  const attachmentId = randomUUID()
  const orphanAttachmentId = randomUUID()
  const attachmentObjectPath = `centers/${ids.center}/staff/${ids.staff}/documents/${ids.document}/${attachmentId}/attachment.pdf`
  psql(`insert into public.center_staff_document_attachments(
    id,center_id,staff_member_id,administrative_profile_id,document_id,bucket_id,
    object_path,original_file_name,safe_file_name,mime_type,size_bytes,state,
    is_primary,version,uploaded_by_user_id
  ) values (
    ${u(attachmentId)},${q(ids.center)},${q(ids.staff)},${q(ids.profile)},${q(ids.document)},
    'staff-administrative-documents',${q(attachmentObjectPath)},
    'evidence.pdf','attachment.pdf','application/pdf',4,'available',true,1,${u(users.a.id)}
  );`)
  const wrongParentPrepare = await clientA.rpc('prepare_staff_document_attachment_upload', {
    p_center_id: ids.center,
    p_staff_member_id: 'orphan-staff',
    p_administrative_profile_id: 'orphan-profile',
    p_document_id: 'orphan-document',
    p_original_file_name: 'wrong-parent.pdf',
    p_mime_type: 'application/pdf',
    p_size_bytes: 4,
  })
  assert(wrongParentPrepare.error)
  assert.match(wrongParentPrepare.error.message, /authoritative_parent_invalid/)
  const wrongCenterPrepare = await clientA.rpc('prepare_staff_document_attachment_upload', {
    p_center_id: ids.otherCenter,
    p_staff_member_id: ids.staff,
    p_administrative_profile_id: ids.profile,
    p_document_id: ids.document,
    p_original_file_name: 'wrong-center.pdf',
    p_mime_type: 'application/pdf',
    p_size_bytes: 4,
  })
  assert(wrongCenterPrepare.error)
  assert.match(wrongCenterPrepare.error.message, /authoritative_parent_invalid/)
  expectPsqlFailure(
    `update public.center_staff_document_attachments set document_id='rebound-document' where id=${u(attachmentId)};`,
    /staff_document_attachment_(authoritative_parent_invalid|identity_immutable)/,
  )
  // Emulate an inherited orphan that predated the additive parent trigger;
  // it remains recoverable metadata but must never enter the C5.5 projection.
  psql(`begin;
    alter table public.center_staff_document_attachments disable trigger c5_5_guard_staff_document_attachment_parent;
    insert into public.center_staff_document_attachments(
      id,center_id,staff_member_id,administrative_profile_id,document_id,bucket_id,
      object_path,original_file_name,safe_file_name,mime_type,size_bytes,state,
      is_primary,version,uploaded_by_user_id
    ) values (${u(orphanAttachmentId)},${q(ids.center)},'orphan-staff','orphan-profile','orphan-document',
      'staff-administrative-documents',${q(`centers/${ids.center}/staff/orphan-staff/documents/orphan-document/${orphanAttachmentId}/attachment.pdf`)},
      'orphan.pdf','attachment.pdf','application/pdf',4,'available',true,1,${u(users.a.id)});
    alter table public.center_staff_document_attachments enable trigger c5_5_guard_staff_document_attachment_parent;
    commit;`)
  const documentAtB = (await pull(clientB)).documents[0]
  assert.deepEqual(documentAtB.attachmentIds, [attachmentId])
  assert(!documentAtB.attachmentIds.includes(orphanAttachmentId))
  const objectUpload = await admin.storage.from('staff-administrative-documents').upload(
    attachmentObjectPath,
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    { contentType: 'application/pdf', upsert: false },
  )
  assert.equal(objectUpload.error, null, objectUpload.error?.message)
  const allowedSigned = await clientA.storage.from('staff-administrative-documents')
    .createSignedUrl(attachmentObjectPath, 60)
  assert.equal(allowedSigned.error, null, allowedSigned.error?.message)
  assert(allowedSigned.data?.signedUrl)
  const deniedSigned = await clientC.storage.from('staff-administrative-documents')
    .createSignedUrl(attachmentObjectPath, 60)
  assert(deniedSigned.error || !deniedSigned.data?.signedUrl)
  const teacherSigned = await clientTeacher.storage.from('staff-administrative-documents')
    .createSignedUrl(attachmentObjectPath, 60)
  assert(teacherSigned.error || !teacherSigned.data?.signedUrl)
  console.log('C5_5_QA_PROFILE_DOCUMENT_PRIVATE_BINDING_DOWNLOAD_REBIND: PASS')

  const policy = {
    id: ids.policy, schemaVersion: 1, centerId: ids.center,
    staffMemberId: ids.staff, administrativeProfileId: ids.profile,
    profileRetentionDaysAfterEmploymentEnd: 1825,
    documentRetentionDaysAfterEmploymentEnd: 1825,
    deletionReviewGraceDays: 30, enabled: true,
  }
  const adminPolicyDenied = await mutate(
    clientB, buildC55StaffHrUpsertCommand('retention_policy', policy),
  )
  assert.equal(adminPolicyDenied.ok, false)
  assert.equal(adminPolicyDenied.outcome_code, 'WRITE_ROLE_REQUIRED')
  const policyCommit = await mutate(
    clientA, buildC55StaffHrUpsertCommand('retention_policy', policy),
  )
  assert.equal(policyCommit.ok, true, JSON.stringify(policyCommit))
  const legalHold = await clientA.rpc('place_staff_document_attachment_legal_hold', {
    p_center_id: ids.center,
    p_attachment_id: attachmentId,
    p_reason_code: 'audit',
  })
  assert.equal(legalHold.error, null, legalHold.error?.message)
  assert.equal(legalHold.data?.[0]?.status, 'active')
  const governanceReadiness = await clientA.rpc(
    'staff_document_attachment_governance_readiness',
    { p_center_id: ids.center },
  )
  assert.equal(governanceReadiness.error, null, governanceReadiness.error?.message)
  assert.equal(governanceReadiness.data?.[0]?.permanent_execution_ready, false)
  const request = {
    id: ids.request, schemaVersion: 1, centerId: ids.center,
    staffMemberId: ids.staff, administrativeProfileId: ids.profile,
    scope: 'administrative-profile-and-documents', reasonCode: 'data-subject-request',
    reasonNote: 'Synthetic request for guarded C5.5 QA',
  }
  const requestCommit = await mutate(clientB, buildC55StaffHrUpsertCommand(
    'deletion_request', request, { operation: 'CREATE' },
  ))
  assert.equal(requestCommit.ok, true, JSON.stringify(requestCommit))
  const pending = (await pull(clientA)).deletionRequests[0]
  const approval = await mutate(clientA, buildC55StaffHrUpsertCommand(
    'deletion_request', { ...pending, reviewDecision: 'approve', reviewNote: 'Approved synthetic QA' },
    { operation: 'REVIEW' },
  ))
  assert.equal(approval.ok, true, JSON.stringify(approval))
  const governanceAtB = await pull(clientB)
  assert.equal(governanceAtB.retentionPolicy.cloudVersion, 1)
  assert.equal(governanceAtB.deletionRequests[0].status, 'execution-pending')
  assert.equal(scalar(`select count(*) from public.center_staff_hr_audit_events where center_id=${q(ids.center)} and actor_user_id is null;`), '0')
  assert(governanceAtB.auditEvents.some((event) => event.action === 'deletion-request.approve'))
  assert.equal(scalar(`select count(*) from public.center_staff_administrative_profiles where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.center_staff_documents where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.center_staff_document_attachment_legal_holds where center_id=${q(ids.center)} and attachment_id=${u(attachmentId)} and status='active';`), '1')
  assert.equal(scalar(`select state from public.center_staff_document_attachments where id=${u(attachmentId)};`), 'available')
  console.log('C5_5_QA_GOVERNANCE_SERVER_AUDIT_LEGAL_HOLD_NO_DELETE: PASS')

  const idempotentStaffId = `staff-${randomUUID()}`
  const idempotentCommand = buildC55StaffHrUpsertCommand('staff_member', staffPayload({
    id: idempotentStaffId, employeeCode: `IDEMP-${suffix.slice(0, 8)}`, departmentId: '',
  }))
  const retryKey = randomUUID()
  const firstRetry = await mutate(clientA, idempotentCommand, retryKey)
  const secondRetry = await mutate(clientA, idempotentCommand, retryKey)
  assert.deepEqual(secondRetry, firstRetry)
  const changedIntent = structuredClone(idempotentCommand)
  changedIntent.payload.fullName = 'Changed intent'
  const conflict = await mutate(clientA, changedIntent, retryKey)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(scalar(`select count(*) from public.center_staff_hr_members where center_id=${q(ids.center)} and id=${q(idempotentStaffId)};`), '1')
  console.log('C5_5_QA_IDEMPOTENCY_NO_DUPLICATE: PASS')

  assert.equal((await pull(clientB)).ok, true)
  psql(`update public.center_members set role='teacher' where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  const downgradedPull = await pull(clientB)
  assert.equal(downgradedPull.ok, false)
  assert.equal(downgradedPull.outcome_code, 'CENTER_ACCESS_DENIED')
  const downgradedAudit = await accessAudit(clientB)
  assert.equal(downgradedAudit.ok, false)
  assert.equal(downgradedAudit.outcome_code, 'WRITE_ROLE_REQUIRED')
  psql(`update public.center_members set role='center_admin' where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  assert.equal((await pull(clientB)).ok, true)
  console.log('C5_5_QA_SAME_TOKEN_ROLE_DOWNGRADE_FAIL_CLOSED: PASS')

  const crossRead = await pull(clientC, ids.center)
  assert.equal(crossRead.ok, false)
  assert.equal(crossRead.outcome_code, 'CENTER_ACCESS_DENIED')
  const crossWrite = await mutate(clientC, buildC55StaffHrUpsertCommand(
    'department', departmentPayload({ id: `department-${randomUUID()}`, code: 'LEAK' }),
  ), randomUUID(), ids.center)
  assert.equal(crossWrite.ok, false)
  assert.equal(crossWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  const teacherRead = await pull(clientTeacher)
  assert.equal(teacherRead.ok, false)
  const teacherWrite = await mutate(clientTeacher, buildC55StaffHrUpsertCommand(
    'department', departmentPayload({ id: `department-${randomUUID()}`, code: 'TEACHER' }),
  ))
  assert.equal(teacherWrite.ok, false)
  assert.equal(teacherWrite.outcome_code, 'WRITE_ROLE_REQUIRED')
  const ownerOther = await pull(clientA, ids.otherCenter)
  assert.equal(ownerOther.ok, true)
  assert.equal(ownerOther.staffMembers.length, 0)
  const ownerBack = await pull(clientA, ids.center)
  assert(ownerBack.staffMembers.some((item) => item.id === ids.staff))
  const fresh = await pull(freshClientA)
  assert.equal(fresh.staffMembers.find((item) => item.id === ids.staff).positionTitle, 'Quản lý vận hành')
  assert.equal(fresh.documents[0].attachmentIds[0], attachmentId)
  assert.equal(fresh.deletionRequests[0].status, 'execution-pending')
  console.log('C5_5_QA_FRESH_CROSS_CENTER_OWNER_SWITCH_ROLE: PASS')

  const inactiveCenter = `c5-5-${randomUUID()}`
  psql(`insert into public.centers(id,name,status) values (${q(inactiveCenter)},'Paused','paused');
insert into public.center_members(center_id,user_id,role,status)
values (${q(inactiveCenter)},${u(users.a.id)},'owner','active');`)
  const inactiveRead = await pull(clientA, inactiveCenter)
  assert.equal(inactiveRead.ok, false)
  assert.equal(inactiveRead.outcome_code, 'CENTER_ACCESS_DENIED')
  console.log('C5_5_QA_ACTIVE_CENTER_FAIL_CLOSED: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_5_QA_FINAL_LOCAL_RESET: PASS')
console.log('C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS')
