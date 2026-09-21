import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

import {
  mutateAuthoritativeAttendanceTuitionEntities,
} from '../src/cloud-authoritative-attendance-tuition.js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'
import { mutateV22StudentWithEnrollments } from '../src/cloud-authoritative-student-enrollments.js'

assert.equal(process.env.ICHESS_F3A_LOCAL_QA_ALLOW, 'YES', 'ICHESS_F3A_LOCAL_QA_ALLOW=YES is required')
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked production project references are forbidden')

const qaWorkdir = String(process.env.ICHESS_F3A_LOCAL_QA_WORKDIR || '').trim()
assert(qaWorkdir, 'ICHESS_F3A_LOCAL_QA_WORKDIR is required')
const config = readFileSync(`${qaWorkdir}/supabase/config.toml`, 'utf8')
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
assert(projectId?.startsWith('ichess-f3a-tuition-qa-'), 'A disposable F3A project is required')
const dockerProjectId = projectId.slice(0, 40)
assert(dockerProjectId.startsWith('ichess-f3a-tuition-qa-'), 'Disposable Docker project identity is required')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

const statusOutput = process.platform === 'win32'
  ? run(process.env.ComSpec, ['/d', '/s', '/c', 'npx --no-install supabase status -o json'], { cwd: qaWorkdir })
  : run('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { cwd: qaWorkdir })
const status = JSON.parse(statusOutput)
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof status[key], 'string')
for (const url of [status.DB_URL, status.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()))
}

const containerRows = run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${dockerProjectId}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]).trim().split(/\r?\n/).filter(Boolean).map((row) => row.split('|'))
const dbRows = containerRows.filter(([, name, image]) => name === `supabase_db_${dockerProjectId}` && /supabase\/postgres/i.test(image))
assert.equal(dbRows.length, 1, 'Exactly one disposable local database must be running')
const containerId = dbRows[0][0]

const psql = (sql) => run('docker', [
  'exec', '-i', containerId,
  'psql', '-X', '--no-psqlrc', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], { input: sql }).trim()
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const uuid = (value) => `${quote(value)}::uuid`

assert.equal(psql("select count(*) from supabase_migrations.schema_migrations where version='202609200002';"), '1')
assert.equal(psql("select pg_catalog.pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','),'') from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='c5_1_mutate_core_entity';"), 'postgres|true|search_path=""')

const suffix = randomUUID()
const password = `F3A!${randomUUID()}aA1`
const emails = Object.fromEntries(['owner', 'admin', 'outsider'].map((role) => [role, `f3a.${role}.${suffix}@example.invalid`]))
const centers = {
  primary: `f3a-primary-${suffix}`,
  other: `f3a-other-${suffix}`,
}
const ids = {
  slot: `slot-${suffix}`,
  student: `student-${suffix}`,
  tuition: `tuition-${suffix}`,
  attendance: `attendance-${suffix}`,
  attendanceBaseline: `attendance-baseline-${suffix}`,
}

const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return data.user
}
const signIn = async (email) => {
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session?.access_token)
  return client
}
const users = {
  owner: await makeUser(emails.owner),
  admin: await makeUser(emails.admin),
  outsider: await makeUser(emails.outsider),
}

psql(`
  begin;
  select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
  insert into public.centers(id,name,status) values
    (${quote(centers.primary)}, 'F3A primary', 'active'),
    (${quote(centers.other)}, 'F3A other', 'active');
  insert into public.installation_center_epochs(center_id, installation_epoch, epoch_status) values
    (${quote(centers.primary)}, 1, 'CURRENT'),
    (${quote(centers.other)}, 1, 'CURRENT');
  update public.installation_handoff_control
  set installation_state='TESTER_ACTIVE', bootstrap_state='LOCKED_EXISTING'
  where singleton_id=1;
  insert into public.center_members(center_id,user_id,role,status) values
    (${quote(centers.primary)}, ${uuid(users.owner.id)}, 'owner', 'active'),
    (${quote(centers.primary)}, ${uuid(users.admin.id)}, 'center_admin', 'active'),
    (${quote(centers.other)}, ${uuid(users.outsider.id)}, 'owner', 'active');
  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id, canonical_admin_membership_id, activated_at
  ) values (
    ${quote(centers.primary)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='owner'),
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='center_admin'),
    pg_catalog.transaction_timestamp()
  ), (
    ${quote(centers.other)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.other)} and role='owner'),
    null,
    pg_catalog.transaction_timestamp()
  );
  commit;
`)

const [owner, centerAdmin, outsider] = await Promise.all([
  signIn(emails.owner), signIn(emails.admin), signIn(emails.outsider),
])

const createCore = (client, entityType, entity, expectedVersion = 0) => mutateAuthoritativeCoreEntity({
  supabase: client,
  centerId: centers.primary,
  entityType,
  entity,
  expectedVersion,
  idempotencyKey: randomUUID(),
})
const slotCreate = await createCore(owner, 'class_session', {
  id: ids.slot,
  name: 'Ca nhiều ngày F3A',
  daysOfWeek: ['mon', 'wed'],
  startTime: '18:00',
  endTime: '19:30',
  status: 'active',
})
assert.equal(slotCreate.ok, true, JSON.stringify(slotCreate))

const existingNote = {
  id: `care-old-${suffix}`,
  createdAt: '2026-09-20T08:00:00.000Z',
  author: 'Owner F3A',
  content: 'Lịch sử chăm sóc cũ phải được giữ',
  tags: ['Học phí'],
  sourceModule: 'tuition',
}
const studentCreate = await createCore(owner, 'student', {
  id: ids.student,
  fullName: 'Học viên F3A',
  currentStatus: 'Đang theo học',
  classSessionIds: [ids.slot],
  careNotes: [existingNote],
  latestCareNote: existingNote.content,
})
assert.equal(studentCreate.ok, true, JSON.stringify(studentCreate))

const operationalCreate = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase: owner,
  centerId: centers.primary,
  idempotencyKey: randomUUID(),
  mutations: [{
    entityType: 'tuition_record_package',
    localId: `tuition_record_package::${ids.tuition}`,
    expectedVersion: 0,
    operation: 'UPSERT',
    entity: {
      id: ids.tuition,
      studentId: ids.student,
      packageName: 'Gói 8 buổi',
      totalSessions: 8,
      usedSessions: 4,
      totalAmount: 1600000,
      paidAmount: 0,
      usedSessionsAutoUpdateFromAttendance: false,
      remainingSessionsAutoUpdateFromAttendance: false,
    },
  }, {
    entityType: 'attendance_baseline_state',
    localId: `attendance_baseline_state::${centers.primary}`,
    expectedVersion: 0,
    operation: 'UPSERT',
    entity: {
      id: ids.attendanceBaseline,
      status: 'draft',
      auditLog: [],
    },
  }, {
    entityType: 'attendance_record',
    localId: `attendance_record::${ids.attendance}`,
    expectedVersion: 0,
    operation: 'UPSERT',
    entity: {
      id: ids.attendance,
      studentId: ids.student,
      date: '2026-09-21',
      source: 'initialBaseline',
      status: 'present',
      attendanceStatus: 'present',
      counted: true,
      creditValue: 1,
    },
  }],
})
assert.equal(operationalCreate.ok, true, JSON.stringify(operationalCreate))

const protectedDigest = () => psql(`
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.string_agg(
      entity_type || '|' || local_id || '|' || entity_version::text || '|' || payload::text,
      E'\\n' order by entity_type, local_id
    ), 'UTF8'), 'sha256'), 'hex')
  from public.center_cloud_entities
  where center_id=${quote(centers.primary)}
    and entity_type in ('attendance_record','tuition_record_package');
`)
const protectedBefore = protectedDigest()

const reproducedFailure = await mutateV22StudentWithEnrollments({
  supabase: owner,
  centerId: centers.primary,
  student: {
    ...studentCreate.entity,
    recurringEnrollments: [{ classSessionId: ids.slot, weekdays: [], legacyReviewRequired: true }],
    enrollmentVersion: 0,
    useAuthoritativeEnrollment: true,
  },
  enrollments: [{ classSessionId: ids.slot, weekdays: [], legacyReviewRequired: true }],
  expectedEnrollmentVersion: 0,
  idempotencyKey: randomUUID(),
})
assert.equal(reproducedFailure.ok, false)
assert.equal(reproducedFailure.outcome_code, 'WEEKDAY_REQUIRED')

const addedNote = {
  id: `care-new-${suffix}`,
  createdAt: '2026-09-21T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
  author: 'Owner F3A',
  content: 'Cần trao đổi học phí vào cuối tuần',
  tags: ['Học phí'],
  sourceModule: 'tuition',
}
const careCreate = await createCore(owner, 'student', {
  ...studentCreate.entity,
  careNotes: [addedNote, existingNote],
  latestCareNote: addedNote.content,
}, studentCreate.entity.cloudVersion)
assert.equal(careCreate.ok, true, JSON.stringify(careCreate))

let { data: adminRows, error: adminReadError } = await centerAdmin
  .from('center_cloud_entities')
  .select('payload,entity_version')
  .eq('center_id', centers.primary)
  .eq('entity_type', 'student')
  .eq('local_id', ids.student)
  .is('deleted_at', null)
assert.equal(adminReadError, null)
assert.equal(adminRows.length, 1)
assert.equal(adminRows[0].payload.careNotes.length, 2)
assert.equal(adminRows[0].payload.careNotes[0].content, addedNote.content)
assert.equal(adminRows[0].payload.careNotes[1].content, existingNote.content)
assert.deepEqual(adminRows[0].payload.classSessionIds, [ids.slot])

const editedNote = { ...addedNote, content: 'Đã xác nhận trao đổi học phí vào cuối tuần', updatedAt: '2026-09-21T09:00:00.000Z' }
const careEdit = await createCore(centerAdmin, 'student', {
  ...adminRows[0].payload,
  careNotes: [editedNote, existingNote],
  latestCareNote: editedNote.content,
}, adminRows[0].entity_version)
assert.equal(careEdit.ok, true, JSON.stringify(careEdit))

const { data: ownerRows, error: ownerReadError } = await owner
  .from('center_cloud_entities')
  .select('payload,entity_version')
  .eq('center_id', centers.primary)
  .eq('entity_type', 'student')
  .eq('local_id', ids.student)
  .is('deleted_at', null)
assert.equal(ownerReadError, null)
assert.equal(ownerRows.length, 1)
assert.equal(ownerRows[0].payload.careNotes[0].content, editedNote.content)
assert.equal(ownerRows[0].payload.careNotes[1].content, existingNote.content)

const { data: crossRows, error: crossReadError } = await outsider
  .from('center_cloud_entities')
  .select('local_id')
  .eq('center_id', centers.primary)
assert.equal(crossReadError, null)
assert.equal(crossRows.length, 0)
const crossMutation = await mutateAuthoritativeCoreEntity({
  supabase: outsider,
  centerId: centers.primary,
  entityType: 'student',
  entity: ownerRows[0].payload,
  expectedVersion: ownerRows[0].entity_version,
  idempotencyKey: randomUUID(),
})
assert.equal(crossMutation.ok, false)
assert.equal(crossMutation.outcome_code, 'CENTER_ACCESS_DENIED')

assert.equal(psql(`select count(*) from public.center_student_enrollment_sets where center_id=${quote(centers.primary)} and student_local_id=${quote(ids.student)};`), '0')
assert.equal(protectedDigest(), protectedBefore, 'Care save changed Attendance or Tuition authority')
assert.equal(psql(`select payload->>'usedSessions' from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='tuition_record_package' and local_id=${quote(`tuition_record_package::${ids.tuition}`)};`), '4')

console.log('F3A_LOCAL_REPRODUCED_LEGACY_ENROLLMENT_CARE_FAILURE: PASS')
console.log('F3A_LOCAL_OWNER_ADMIN_CARE_SAVE_EDIT_RELOAD: PASS')
console.log('F3A_LOCAL_EXISTING_HISTORY_PRESERVED: PASS')
console.log('F3A_LOCAL_CROSS_CENTER_READ_MUTATION_DENIED: PASS')
console.log('F3A_LOCAL_ATTENDANCE_TUITION_IMMUTABILITY: PASS')
