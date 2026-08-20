import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'
import { listCloudEntityPayloads } from '../src/cloud-db-sync.js'
import { buildAttendanceRecordCloudEntity } from '../src/cloud-attendance-records.js'
import { pullC51AttendanceSessionReportCloudEntities } from '../src/cloud-attendance-realtime.js'
import { mutateAuthoritativeAttendanceTuitionEntities } from '../src/cloud-authoritative-attendance-tuition.js'
import { pullC53CrmSharedTruth } from '../src/cloud-authoritative-crm.js'
import {
  buildC54SaveCategoryCommand,
  mutateC54FinanceSharedTruth,
  pullC54FinanceSharedTruth,
} from '../src/cloud-authoritative-finance.js'
import {
  buildC55StaffHrUpsertCommand,
  mutateC55StaffHrSharedTruth,
  pullC55StaffHrSharedTruth,
} from '../src/cloud-authoritative-staff-hr.js'
import {
  buildC56SaveItemCommand,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from '../src/cloud-authoritative-inventory.js'
import {
  buildC57SaveCalendarTagCommand,
  mutateC57CalendarNotesSharedTruth,
  pullC57CalendarNotesSharedTruth,
} from '../src/cloud-authoritative-calendar-notes.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_CLOSEOUT_LOCAL_QA'
assert.equal(process.argv.length, 2, 'This guarded runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

const assertLoopback = (value, label) => {
  if (!value) return
  let host = value
  try { host = new URL(value).hostname } catch { host = String(value).split(':')[0] }
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
const runOneFinalCleanupReset = () => requireSuccess(
  run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }),
  'single final local cleanup reset',
)
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
for (const name of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[name], 'string', `Missing local ${name}`)
}
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverDbContainer = () => {
  const discovery = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'local Docker discovery')
  const rows = discovery.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainer)
  assert.equal(rows.length, 1, 'Expected exactly one guarded local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
let containerId = discoverDbContainer()
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'guarded local psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const requiredVersions = [
  '202608130003', '202608140001', '202608140002', '202608140003',
  '202608140004', '202608140005', '202608140006', '202608140007',
  '202608140008', '202608140009', '202608140010', '202608140011',
]
assert.equal(
  scalar(`select count(*) from supabase_migrations.schema_migrations where version in (${requiredVersions.map(q).join(',')});`),
  String(requiredVersions.length),
  'Local DB is missing an accepted C5.1-C5.7 migration',
)
console.log('C5_CLOSEOUT_LOCAL_GUARD_NO_REMOTE_ONE_FINAL_CLEANUP_RESET: PASS')

const suffix = randomUUID()
const password = `C5.Closeout!${randomUUID()}aA1`
const ids = {
  centerOne: `c5-closeout-one-${suffix}`,
  centerTwo: `c5-closeout-two-${suffix}`,
  studentOne: `student-one-${suffix}`,
  studentTwo: `student-two-${suffix}`,
  attendance: `attendance-${suffix}`,
  department: randomUUID(),
}
const emails = Object.fromEntries(['a', 'b', 'c'].map((name) => [
  name, `c5.closeout.${name}.${suffix}@example.invalid`,
]))
const admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const createdUsers = []
let fixtureCreated = false
const makeUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  createdUsers.push(data.user)
  return data.user
}
const signIn = async (email) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session?.access_token)
  return client
}
const pullCore = (client, centerId) => listCloudEntityPayloads({
  supabase: client, centerId, entityType: 'student',
})
const pullAll = async (client, centerId) => {
  const [core, attendance, crm, finance, staff, inventory, calendar] = await Promise.all([
    pullCore(client, centerId),
    pullC51AttendanceSessionReportCloudEntities({ supabase: client, centerId }),
    pullC53CrmSharedTruth({ supabase: client, centerId }),
    pullC54FinanceSharedTruth({ supabase: client, centerId }),
    pullC55StaffHrSharedTruth({ supabase: client, centerId }),
    pullC56InventorySharedTruth({ supabase: client, centerId }),
    pullC57CalendarNotesSharedTruth({ supabase: client, centerId }),
  ])
  return { core, attendance, crm, finance, staff, inventory, calendar }
}
const assertCenterOneSnapshot = (snapshot) => {
  for (const [wave, result] of Object.entries(snapshot)) {
    assert.equal(result.ok, true, `${wave}: ${JSON.stringify(result)}`)
  }
  assert.equal(snapshot.core.data.some((row) => row.id === ids.studentOne), true)
  assert.equal(snapshot.core.data.some((row) => row.id === ids.studentTwo), false)
  assert.equal(snapshot.attendance.records.length, 1)
  assert.equal(snapshot.crm.records.length, 0)
  assert.equal(snapshot.finance.categories.some((row) => row.name === 'C5 Closeout'), true)
  assert.equal(snapshot.staff.departments.length, 1)
  assert.equal(snapshot.inventory.items.length, 1)
  assert.equal(snapshot.calendar.calendarTags.length, 1)
}
const assertDeniedOrEmpty = (result, collections = []) => {
  if (!result.ok) {
    assert([
      'CENTER_ACCESS_DENIED', 'RESOURCE_NOT_FOUND_OR_DENIED', 'CRM_READ_NOT_ACTIVE',
      'FINANCE_SHARED_TRUTH_READ_FAILED', 'STAFF_HR_SHARED_TRUTH_READ_FAILED',
      'INVENTORY_SHARED_TRUTH_READ_FAILED', 'CALENDAR_NOTES_SHARED_TRUTH_READ_FAILED',
    ].includes(result.outcome_code), JSON.stringify(result))
    return
  }
  const count = collections.reduce((sum, name) => sum + (Array.isArray(result[name]) ? result[name].length : 0), 0)
  assert.equal(count, 0, `Cross-center leak in ${collections.join(',')}`)
}

try {
  const users = { a: await makeUser(emails.a), b: await makeUser(emails.b), c: await makeUser(emails.c) }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.centerOne)},'C5 Closeout One','active'),
    (${q(ids.centerTwo)},'C5 Closeout Two','active');
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.centerOne)},${u(users.a.id)},'owner','active'),
    (${q(ids.centerTwo)},${u(users.a.id)},'owner','active'),
    (${q(ids.centerOne)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.centerTwo)},${u(users.c.id)},'center_admin','active');
update public.center_crm_control
set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});`)
  fixtureCreated = true

  const [clientA, clientB, clientC] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c),
  ])

  const coreOne = await mutateAuthoritativeCoreEntity({
    supabase: clientA, centerId: ids.centerOne, entityType: 'student', localId: ids.studentOne,
    entity: { id: ids.studentOne, fullName: 'Student Center One', status: 'active' },
    expectedVersion: 0, operation: 'UPSERT', idempotencyKey: randomUUID(),
  })
  assert.equal(coreOne.ok, true, JSON.stringify(coreOne))
  const coreTwo = await mutateAuthoritativeCoreEntity({
    supabase: clientA, centerId: ids.centerTwo, entityType: 'student', localId: ids.studentTwo,
    entity: { id: ids.studentTwo, fullName: 'Student Center Two', status: 'active' },
    expectedVersion: 0, operation: 'UPSERT', idempotencyKey: randomUUID(),
  })
  assert.equal(coreTwo.ok, true, JSON.stringify(coreTwo))

  const attendanceBuilt = buildAttendanceRecordCloudEntity({
    centerId: ids.centerOne,
    record: {
      id: ids.attendance, studentId: ids.studentOne, date: '2026-08-20', source: 'admin',
      status: 'present', attendanceStatus: 'present', counted: true, creditValue: 1,
    },
  })
  assert.equal(attendanceBuilt.ok, true)
  const attendanceCreate = await mutateAuthoritativeAttendanceTuitionEntities({
    supabase: clientB, centerId: ids.centerOne, idempotencyKey: randomUUID(),
    mutations: [{
      entityType: attendanceBuilt.data.entity_type,
      localId: attendanceBuilt.localId,
      entity: attendanceBuilt.data.payload,
      expectedVersion: 0,
      operation: 'UPSERT',
    }],
  })
  assert.equal(attendanceCreate.ok, true, JSON.stringify(attendanceCreate))

  const financeCreate = await mutateC54FinanceSharedTruth({
    supabase: clientB, centerId: ids.centerOne,
    command: buildC54SaveCategoryCommand({ name: 'C5 Closeout', type: 'both' }),
    idempotencyKey: randomUUID(),
  })
  assert.equal(financeCreate.ok, true, JSON.stringify(financeCreate))

  const departmentCreate = await mutateC55StaffHrSharedTruth({
    supabase: clientA, centerId: ids.centerOne,
    command: buildC55StaffHrUpsertCommand('department', {
      id: ids.department, centerId: ids.centerOne, name: 'Operations', code: `OPS-${suffix.slice(0, 8)}`,
      description: 'C5 closeout synthetic', sortOrder: 1, status: 'active', archivedAt: '',
    }),
    idempotencyKey: randomUUID(),
  })
  assert.equal(departmentCreate.ok, true, JSON.stringify(departmentCreate))

  const inventoryCreate = await mutateC56InventorySharedTruth({
    supabase: clientB, centerId: ids.centerOne,
    command: buildC56SaveItemCommand({
      name: `Chess set ${suffix.slice(0, 8)}`, category: 'Equipment', unit: 'set', quantity: 2,
      lowStockThreshold: 1, condition: 'good', location: 'Room A', note: 'C5 closeout',
    }),
    idempotencyKey: randomUUID(),
  })
  assert.equal(inventoryCreate.ok, true, JSON.stringify(inventoryCreate))

  const calendarCreate = await mutateC57CalendarNotesSharedTruth({
    supabase: clientA, centerId: ids.centerOne,
    command: buildC57SaveCalendarTagCommand({
      label: `C5 Closeout ${suffix.slice(0, 8)}`, colorKey: 'blue', customColor: '',
      defaultItemType: 'meeting', description: 'Synthetic',
    }),
    idempotencyKey: randomUUID(),
  })
  assert.equal(calendarCreate.ok, true, JSON.stringify(calendarCreate))

  const [atA, atB, freshClientB, freshClientA] = await Promise.all([
    pullAll(clientA, ids.centerOne),
    pullAll(clientB, ids.centerOne),
    signIn(emails.b),
    signIn(emails.a),
  ])
  assertCenterOneSnapshot(atA)
  assertCenterOneSnapshot(atB)
  assertCenterOneSnapshot(await pullAll(freshClientB, ids.centerOne))
  console.log('C5_CLOSEOUT_A_B_SAME_CENTER_FRESH_CONTEXT_ALL_WAVES: PASS')

  const cross = await pullAll(clientC, ids.centerOne)
  assert.equal(cross.core.ok, true)
  assert.equal(cross.core.data.length, 0)
  assert.equal(cross.attendance.ok, true)
  assert.equal(cross.attendance.records.length, 0)
  assertDeniedOrEmpty(cross.crm, ['records'])
  assertDeniedOrEmpty(cross.finance, ['transactions', 'categories', 'reconciliations'])
  assertDeniedOrEmpty(cross.staff, ['departments', 'staffMembers'])
  assertDeniedOrEmpty(cross.inventory, ['items', 'movements', 'requests'])
  assertDeniedOrEmpty(cross.calendar, ['calendarItems', 'calendarTags', 'advisoryNotes', 'boardNotes'])
  console.log('C5_CLOSEOUT_C_DIFFERENT_CENTER_CROSS_LEAK_ZERO: PASS')

  const ownerAtOne = await pullAll(clientA, ids.centerOne)
  const ownerAtTwo = await pullAll(clientA, ids.centerTwo)
  const ownerBackAtOne = await pullAll(freshClientA, ids.centerOne)
  assertCenterOneSnapshot(ownerAtOne)
  assert.equal(ownerAtTwo.core.ok, true)
  assert.deepEqual(ownerAtTwo.core.data.map((row) => row.id), [ids.studentTwo])
  for (const [wave, result] of Object.entries(ownerAtTwo)) {
    assert.equal(result.ok, true, `${wave} center-two: ${JSON.stringify(result)}`)
  }
  assert.equal(ownerAtTwo.attendance.records.length, 0)
  assert.equal(ownerAtTwo.crm.records.length, 0)
  assert.equal(ownerAtTwo.finance.categories.some((row) => row.name === 'C5 Closeout'), false)
  assert.equal(ownerAtTwo.staff.departments.length, 0)
  assert.equal(ownerAtTwo.inventory.items.length, 0)
  assert.equal(ownerAtTwo.calendar.calendarTags.length, 0)
  assertCenterOneSnapshot(ownerBackAtOne)
  console.log('C5_CLOSEOUT_OWNER_CENTER_ONE_TO_TWO_TO_ONE: PASS')
} finally {
  if (fixtureCreated || createdUsers.length) {
    runOneFinalCleanupReset()
    containerId = discoverDbContainer()
  }
}

assert.equal(scalar(`select count(*) from public.centers where id like 'c5-closeout-%';`), '0')
assert.equal(scalar(`select count(*) from auth.users where email like 'c5.closeout.%';`), '0')
console.log('C5_CLOSEOUT_COMPACT_MULTI_ACCOUNT_LOCAL_DB_ACCEPTANCE: PASS')
