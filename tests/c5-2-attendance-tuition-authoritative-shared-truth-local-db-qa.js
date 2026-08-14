import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  mutateAuthoritativeAttendanceTuitionEntities,
} from '../src/cloud-authoritative-attendance-tuition.js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const expectedGatewayContainerName = 'supabase_kong_ichess-center-os'
const expectedRealtimeContainerName = 'supabase_realtime_ichess-center-os'
const consentFlag = 'ICHESS_C5_2_LOCAL_QA_ALLOW_RESET'
const entityTypes = [
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
]

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked project references are forbidden')

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
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
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
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, 'Expected exactly one local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format',
    '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ]), 'Docker inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match)
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  return rows[0][0]
}

const restartLocalGatewayForRealtime = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'local gateway discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedGatewayContainerName)
  assert.equal(rows.length, 1, 'Expected exactly one local Kong gateway')
  assert(/supabase\/kong/i.test(rows[0][2]))
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format',
    '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ]), 'local gateway inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match)
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedGatewayContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  requireSuccess(run('docker', ['restart', rows[0][0]], { timeout: 30_000 }), 'restart local gateway')
}

const waitForLocalRealtimeContainer = async () => {
  const deadline = Date.now() + 60_000
  let stableStartedAt = ''
  let stableChecks = 0
  let lastState = ''
  while (Date.now() < deadline) {
    const result = run('docker', [
      'inspect', expectedRealtimeContainerName, '--format',
      '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.StartedAt}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{index .Config.Labels "com.docker.compose.project"}}',
    ])
    if (result.status === 0) {
      lastState = result.stdout.trim()
      const [running, health, startedAt, projectLabel, composeLabel] = lastState.split('|')
      if (running === 'true' && health === 'healthy' && projectLabel === projectSlug && composeLabel === projectSlug) {
        if (startedAt === stableStartedAt) stableChecks += 1
        else { stableStartedAt = startedAt; stableChecks = 1 }
        if (stableChecks >= 4) return
      } else {
        stableChecks = 0
      }
    } else {
      lastState = result.stderr.trim()
      stableChecks = 0
    }
    await sleep(500)
  }
  assert.fail(`Local Realtime container did not stabilize: ${lastState}`)
}

let containerId = discoverContainer()
const runReset = () => requireSuccess(
  run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }),
  'db reset',
)
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => value === null || value === undefined
  ? 'null'
  : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitForRealtimeHealth = async () => {
  const deadline = Date.now() + 60_000
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${localStatus.API_URL}/realtime/v1/api/ping`, {
        headers: { apikey: localStatus.ANON_KEY },
      })
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = String(error?.message || error)
    }
    await sleep(500)
  }
  assert.fail(`Local Realtime did not become healthy: ${lastError}`)
}

class MemoryStorage {
  #items = new Map()
  getItem(key) { return this.#items.has(String(key)) ? this.#items.get(String(key)) : null }
  setItem(key, value) { this.#items.set(String(key), String(value)) }
  removeItem(key) { this.#items.delete(String(key)) }
  clear() { this.#items.clear() }
  snapshot() { return Object.fromEntries(this.#items) }
}

const suffix = randomUUID()
const password = `C5.2!${randomUUID()}aA1`
const ids = {
  center: `c5-2-${randomUUID()}`,
  otherCenter: `c5-2-${randomUUID()}`,
}
const emails = {
  a: `c5.2.a.${suffix}@example.invalid`,
  b: `c5.2.b.${suffix}@example.invalid`,
  c: `c5.2.c.${suffix}@example.invalid`,
  limited: `c5.2.limited.${suffix}@example.invalid`,
}
const localIds = {
  attendance: `attendance_record::admin-${suffix}`,
  baseline: `attendance_baseline_state::${ids.center}`,
  baselineRecord: `attendance_record::baseline-${suffix}`,
  report: `session_report::report-${suffix}`,
  tuition: `tuition_record_package::tuition-${suffix}`,
}
const basePayloads = {
  attendance: {
    id: `attendance-${suffix}`,
    studentId: `student-${suffix}`,
    date: '2026-08-14',
    source: 'admin',
    status: 'present',
    attendanceStatus: 'present',
    counted: true,
    creditValue: 1,
    centerId: ids.center,
  },
  baseline: {
    status: 'draft',
    auditLog: [],
    note: 'A baseline draft',
    centerId: ids.center,
  },
  baselineRecord: {
    id: `baseline-record-${suffix}`,
    studentId: `student-baseline-${suffix}`,
    date: '2026-08-01',
    source: 'initialBaseline',
    status: 'present',
    attendanceStatus: 'present',
    counted: true,
    creditValue: 1,
    centerId: ids.center,
  },
  report: {
    id: `report-${suffix}`,
    sessionId: `schedule-${suffix}`,
    occurrenceDate: '2026-08-14',
    learningGroups: [{ id: 'group-1', studentIds: [`student-${suffix}`], contentLines: ['Tactic'] }],
    attendance: [],
    attendanceIsCanonical: false,
    canonicalAttendanceEntity: 'attendance_record',
    centerId: ids.center,
  },
  tuition: {
    id: `tuition-${suffix}`,
    studentId: `student-${suffix}`,
    packageName: 'Gói C5.2',
    totalSessions: 12,
    usedSessions: 2,
    totalAmount: 2400000,
    paidAmount: 1200000,
    payments: [{ id: 'payment-1', amount: 1200000, paidAt: '2026-08-14' }],
    attendanceLinked: false,
    attendanceAutoUpdateEnabled: false,
    usedSessionsAutoUpdateFromAttendance: false,
    remainingSessionsAutoUpdateFromAttendance: false,
    centerId: ids.center,
  },
}

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
  client.realtime.setAuth(data.session.access_token)
  return client
}
const mutation = (entityType, localId, entity, expectedVersion = 0, operation = 'UPSERT') => ({
  entityType, localId, entity, expectedVersion, operation,
})
const mutate = (client, mutations, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateAuthoritativeAttendanceTuitionEntities({
    supabase: client, centerId, mutations, idempotencyKey,
  })
const listOperational = async (client, centerId = ids.center) => {
  const { data, error } = await client
    .from('center_cloud_entities')
    .select('center_id,entity_type,local_id,payload,entity_version,updated_at,deleted_at')
    .eq('center_id', centerId)
    .in('entity_type', entityTypes)
    .is('deleted_at', null)
    .order('entity_type')
  if (error) throw error
  return data || []
}
const bootstrapContext = async (client, storage, centerId = ids.center) => {
  const rows = await listOperational(client, centerId)
  storage.clear()
  for (const type of entityTypes) {
    storage.setItem(
      `ichessCenterOS.c5_2.${type}.${centerId}`,
      JSON.stringify(rows.filter((row) => row.entity_type === type)),
    )
  }
  return rows
}
const subscribe = async (client, label, sink, centerId = ids.center) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} realtime subscribe timeout`)), 15_000)
  const channel = client.channel(`c5-2-${label}-${randomUUID()}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'center_cloud_entities', filter: `center_id=eq.${centerId}`,
    }, (event) => {
      const row = event.new || event.old
      if (entityTypes.includes(row?.entity_type)) sink.push({ type: row.entity_type, event })
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        setTimeout(() => resolve(channel), 3_000)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`${label} realtime ${status}`))
      }
    })
})
const waitForTypes = async (sink, expectedTypes, label) => {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const seen = new Set(sink.map((item) => item.type))
    if (expectedTypes.every((type) => seen.has(type))) return
    await sleep(100)
  }
  assert.fail(`${label}: got ${JSON.stringify(sink.map((item) => item.type))}`)
}

let fixtureCreated = false
let finalResetVerified = false
const channels = []
console.log('C5_2_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  await waitForLocalRealtimeContainer()
  restartLocalGatewayForRealtime()
  await waitForRealtimeHealth()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140001' and name='c5_2_attendance_tuition_authoritative_shared_truth';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140002' and name='c5_2_baseline_singleton_review_hardening';`), '1')
  assert.equal(scalar('select count(*) from auth.users;'), '0')
  assert.equal(scalar('select count(*) from public.center_cloud_entities;'), '0')
  assert.equal(scalar('select count(*) from public.center_operational_command_result;'), '0')

  const users = {
    a: await makeUser(emails.a),
    b: await makeUser(emails.b),
    c: await makeUser(emails.c),
    limited: await makeUser(emails.limited),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.2 primary center','active'),
    (${q(ids.otherCenter)},'C5.2 other center','active');
  insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'owner','active'),
    (${q(ids.center)},${u(users.limited.id)},'teacher','active');`)

  const [clientA, clientB, clientC, clientLimited, freshClient] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c), signIn(emails.limited), signIn(emails.a),
  ])
  const storageA = new MemoryStorage()
  const storageB = new MemoryStorage()
  const storageC = new MemoryStorage()
  const freshStorage = new MemoryStorage()
  assert.notEqual(storageA, storageB)
  assert.notEqual(storageB, storageC)

  const bRealtime = []
  channels.push({ client: clientB, channel: await subscribe(clientB, 'b-create', bRealtime) })

  const attendanceKey = randomUUID()
  const attendanceCreate = await mutate(clientA, [
    mutation('attendance_record', localIds.attendance, basePayloads.attendance),
  ], attendanceKey)
  assert.equal(attendanceCreate.ok, true, JSON.stringify(attendanceCreate))
  assert.equal(attendanceCreate.records[0].entity_version, 1)

  const baselineCreate = await mutate(clientA, [
    mutation('attendance_baseline_state', localIds.baseline, basePayloads.baseline),
    mutation('attendance_record', localIds.baselineRecord, basePayloads.baselineRecord),
  ])
  assert.equal(baselineCreate.ok, true, JSON.stringify(baselineCreate))

  const reportCreate = await mutate(clientA, [
    mutation('session_report', localIds.report, basePayloads.report),
  ])
  assert.equal(reportCreate.ok, true, JSON.stringify(reportCreate))

  const tuitionCreate = await mutate(clientA, [
    mutation('tuition_record_package', localIds.tuition, basePayloads.tuition),
  ])
  assert.equal(tuitionCreate.ok, true, JSON.stringify(tuitionCreate))

  await waitForTypes(bRealtime, entityTypes, 'A create -> B realtime')
  const bRows = await bootstrapContext(clientB, storageB)
  assert.equal(bRows.length, 5)
  assert.equal(new Set(bRows.map((row) => row.entity_type)).size, 4)
  console.log('C5_2_A_CREATE_B_SEES_MATRIX: PASS 4/4')

  const replay = await mutate(clientA, [
    mutation('attendance_record', localIds.attendance, {
      ...basePayloads.attendance,
      updatedAt: '2026-08-14T10:00:00.000Z',
    }),
  ], attendanceKey)
  assert.equal(replay.ok, true)
  assert.equal(replay.replayed, true)
  assert.equal(replay.records[0].entity_version, 1)
  const idempotencyConflict = await mutate(clientA, [
    mutation('attendance_record', localIds.attendance, {
      ...basePayloads.attendance,
      attendanceStatus: 'absent',
      status: 'absent',
    }),
  ], attendanceKey)
  assert.equal(idempotencyConflict.ok, false)
  assert.equal(idempotencyConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  console.log('C5_2_EXACT_RETRY_IDEMPOTENCY: PASS')

  const aRealtime = []
  channels.push({ client: clientA, channel: await subscribe(clientA, 'a-edit', aRealtime) })
  const attendanceUpdate = await mutate(clientB, [
    mutation('attendance_record', localIds.attendance, {
      ...basePayloads.attendance,
      attendanceStatus: 'excused', status: 'excused', correctionReason: 'B correction',
    }, 1),
  ])
  assert.equal(attendanceUpdate.ok, true, JSON.stringify(attendanceUpdate))
  const reportUpdate = await mutate(clientB, [
    mutation('session_report', localIds.report, {
      ...basePayloads.report,
      suggestions: 'B updated report',
    }, 1),
  ])
  assert.equal(reportUpdate.ok, true, JSON.stringify(reportUpdate))
  const tuitionUpdate = await mutate(clientB, [
    mutation('tuition_record_package', localIds.tuition, {
      ...basePayloads.tuition,
      note: 'B updated tuition',
    }, 1),
  ])
  assert.equal(tuitionUpdate.ok, true, JSON.stringify(tuitionUpdate))
  const baselineUpdate = await mutate(clientB, [
    mutation('attendance_baseline_state', localIds.baseline, {
      ...basePayloads.baseline,
      note: 'B baseline version 2',
    }, 1),
    mutation('attendance_record', localIds.baselineRecord, {
      ...basePayloads.baselineRecord,
      note: 'B baseline record version 2',
    }, 1),
  ])
  assert.equal(baselineUpdate.ok, true, JSON.stringify(baselineUpdate))
  await waitForTypes(aRealtime, entityTypes, 'B edit -> A realtime')
  const aRows = await bootstrapContext(clientA, storageA)
  assert.equal(aRows.find((row) => row.local_id === localIds.attendance).entity_version, 2)
  assert.equal(aRows.find((row) => row.local_id === localIds.report).entity_version, 2)
  assert.equal(aRows.find((row) => row.local_id === localIds.tuition).entity_version, 2)
  console.log('C5_2_B_UPDATE_A_CONVERGES_MATRIX: PASS 4/4')

  const lockResult = await mutate(clientA, [
    mutation('attendance_baseline_state', localIds.baseline, {
      ...basePayloads.baseline,
      status: 'locked', note: 'A locked baseline',
    }, 2),
  ])
  assert.equal(lockResult.ok, true, JSON.stringify(lockResult))
  assert.equal(lockResult.records[0].entity_version, 3)
  const staleBaselineEdit = await mutate(clientB, [
    mutation('attendance_baseline_state', localIds.baseline, {
      ...basePayloads.baseline,
      note: 'stale B baseline overwrite',
    }, 2),
    mutation('attendance_record', localIds.baselineRecord, {
      ...basePayloads.baselineRecord,
      note: 'stale B record overwrite',
    }, 2),
  ])
  assert.equal(staleBaselineEdit.ok, false)
  assert.equal(staleBaselineEdit.outcome_code, 'VERSION_CONFLICT')
  const maliciousLockedEdit = await mutate(clientB, [
    mutation('attendance_baseline_state', localIds.baseline, {
      ...basePayloads.baseline,
      status: 'locked', note: 'still locked but mutated',
    }, 3),
    mutation('attendance_record', localIds.baselineRecord, {
      ...basePayloads.baselineRecord,
      note: 'must remain blocked while locked',
    }, 2),
  ])
  assert.equal(maliciousLockedEdit.ok, false)
  assert.equal(maliciousLockedEdit.outcome_code, 'BASELINE_LOCKED')
  const afterLockedRows = await listOperational(clientA)
  assert.equal(afterLockedRows.find((row) => row.local_id === localIds.baselineRecord).payload.note, 'B baseline record version 2')
  console.log('C5_2_BASELINE_LOCK_STALE_ATOMIC_DENY: PASS')

  const alternateBaselineLocalId = `attendance_baseline_state::alternate-${suffix}`
  const singletonBypass = await mutate(clientB, [
    mutation('attendance_record', localIds.baselineRecord, {
      ...basePayloads.baselineRecord,
      note: 'must rollback before alternate baseline identity insert',
    }, 2),
    mutation('attendance_baseline_state', alternateBaselineLocalId, {
      ...basePayloads.baseline,
      status: 'draft',
      note: 'alternate identity must not bypass canonical locked state',
    }, 0),
  ])
  assert.equal(singletonBypass.ok, false)
  assert.equal(singletonBypass.outcome_code, 'CONCURRENT_CONFLICT')
  const afterSingletonBypassRows = await listOperational(clientA)
  const protectedBaselineRecord = afterSingletonBypassRows.find(
    (row) => row.local_id === localIds.baselineRecord,
  )
  assert.equal(protectedBaselineRecord.entity_version, 2)
  assert.equal(protectedBaselineRecord.payload.note, 'B baseline record version 2')
  assert.equal(
    afterSingletonBypassRows.filter((row) => row.entity_type === 'attendance_baseline_state').length,
    1,
  )
  console.log('C5_2_BASELINE_SINGLETON_LOCK_BYPASS_DENY: PASS')

  freshStorage.setItem('stale-local-only', JSON.stringify([{ id: 'must-disappear' }]))
  const freshRows = await bootstrapContext(freshClient, freshStorage)
  assert.equal(freshRows.length, 5)
  assert.equal(freshStorage.getItem('stale-local-only'), null)
  assert.equal(freshRows.find((row) => row.local_id === localIds.baseline).payload.status, 'locked')
  console.log('C5_2_FRESH_EMPTY_STORAGE_BOOTSTRAP: PASS')

  const cRows = await bootstrapContext(clientC, storageC)
  assert.equal(cRows.length, 0)
  const crossWrite = await mutate(clientC, [
    mutation('tuition_record_package', `tuition_record_package::cross-${suffix}`, {
      ...basePayloads.tuition, id: `cross-${suffix}`,
    }),
  ])
  assert.equal(crossWrite.ok, false)
  assert.equal(crossWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  const limitedWrite = await mutate(clientLimited, [
    mutation('session_report', `session_report::limited-${suffix}`, {
      ...basePayloads.report, id: `limited-${suffix}`,
    }),
  ])
  assert.equal(limitedWrite.ok, false)
  assert.equal(limitedWrite.outcome_code, 'WRITE_ROLE_REQUIRED')
  console.log('C5_2_CROSS_CENTER_ZERO_AND_WRONG_ROLE: PASS')

  const otherLocalIds = {
    attendance: `attendance_record::other-${suffix}`,
    baseline: `attendance_baseline_state::${ids.otherCenter}`,
    report: `session_report::other-${suffix}`,
    tuition: `tuition_record_package::other-${suffix}`,
  }
  await sleep(750)
  const primaryRealtimeCountBeforeOtherWrite = aRealtime.length + bRealtime.length
  const otherCenterCreate = await mutate(clientA, [
    mutation('attendance_record', otherLocalIds.attendance, {
      ...basePayloads.attendance,
      id: `other-attendance-${suffix}`,
      studentId: `other-student-${suffix}`,
      centerId: ids.otherCenter,
    }),
    mutation('attendance_baseline_state', otherLocalIds.baseline, {
      ...basePayloads.baseline,
      note: 'Other center baseline',
      centerId: ids.otherCenter,
    }),
    mutation('session_report', otherLocalIds.report, {
      ...basePayloads.report,
      id: `other-report-${suffix}`,
      sessionId: `other-session-${suffix}`,
      centerId: ids.otherCenter,
    }),
    mutation('tuition_record_package', otherLocalIds.tuition, {
      ...basePayloads.tuition,
      id: `other-${suffix}`,
      studentId: `other-student-${suffix}`,
      centerId: ids.otherCenter,
    }),
  ], randomUUID(), ids.otherCenter)
  assert.equal(otherCenterCreate.ok, true, JSON.stringify(otherCenterCreate))
  await sleep(750)
  assert.equal(
    aRealtime.length + bRealtime.length,
    primaryRealtimeCountBeforeOtherWrite,
    'Other-center events must not reach primary-center subscriptions',
  )
  console.log('C5_2_REALTIME_CROSS_CENTER_ISOLATION: PASS')
  const ownerSwitchStorage = new MemoryStorage()
  const ownerCenterARows = await bootstrapContext(clientA, ownerSwitchStorage, ids.center)
  assert(ownerCenterARows.some((row) => row.local_id === localIds.tuition))
  assert(!ownerCenterARows.some((row) => Object.values(otherLocalIds).includes(row.local_id)))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.center}`)))
  const ownerCenterBRows = await bootstrapContext(clientA, ownerSwitchStorage, ids.otherCenter)
  assert.equal(ownerCenterBRows.length, 4)
  assert.deepEqual(
    [...new Set(ownerCenterBRows.map((row) => row.entity_type))].sort(),
    [...entityTypes].sort(),
  )
  assert(!ownerCenterBRows.some((row) => row.local_id === localIds.tuition))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.otherCenter}`)))
  const ownerCenterAReturnRows = await bootstrapContext(clientA, ownerSwitchStorage, ids.center)
  assert(ownerCenterAReturnRows.some((row) => row.local_id === localIds.tuition))
  assert(!ownerCenterAReturnRows.some((row) => Object.values(otherLocalIds).includes(row.local_id)))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.center}`)))
  console.log('C5_2_OWNER_CENTER_SWITCH_ISOLATION: PASS')

  const forbiddenBoundary = await mutate(clientA, [
    mutation('tuition_record_package', localIds.tuition, {
      ...basePayloads.tuition,
      attendanceAutoUpdateEnabled: true,
    }, 2),
  ])
  assert.equal(forbiddenBoundary.ok, false)
  assert.equal(forbiddenBoundary.outcome_code, 'ATTENDANCE_TUITION_BOUNDARY_VIOLATION')
  console.log('C5_2_ATTENDANCE_TUITION_READ_ONLY_BOUNDARY: PASS')

  const beforeFailure = new MemoryStorage()
  beforeFailure.setItem('projection', JSON.stringify({ version: 2 }))
  const expectedFailureSnapshot = beforeFailure.snapshot()
  for (const [label, mutations] of [
    ['attendance', [mutation('attendance_record', localIds.attendance, basePayloads.attendance, 2)]],
    ['baseline', [
      mutation('attendance_baseline_state', localIds.baseline, { ...basePayloads.baseline, status: 'unlocked' }, 3),
    ]],
    ['session-report', [mutation('session_report', localIds.report, basePayloads.report, 2)]],
    ['tuition', [mutation('tuition_record_package', localIds.tuition, basePayloads.tuition, 2)]],
  ]) {
    const failed = await mutateAuthoritativeAttendanceTuitionEntities({
      supabase: { rpc: async () => ({ data: null, error: { message: `synthetic ${label} outage` } }) },
      centerId: ids.center,
      mutations,
    })
    assert.equal(failed.ok, false)
    assert.deepEqual(beforeFailure.snapshot(), expectedFailureSnapshot)
  }
  console.log('C5_2_CLOUD_FAILURE_NO_FALSE_LOCAL_SUCCESS: PASS 4/4')

  for (const entityType of entityTypes) {
    const { error } = await clientA.from('center_cloud_entities').insert({
      center_id: ids.center,
      entity_type: entityType,
      local_id: `${entityType}::direct-${suffix}`,
      payload: { id: `direct-${suffix}` },
      source_version: 'forbidden-direct-write',
    })
    assert(error, `Direct ${entityType} write must fail RLS`)
  }
  const anonResponse = await fetch(`${localStatus.API_URL}/rest/v1/rpc/c5_2_mutate_attendance_tuition_entities`, {
    method: 'POST',
    headers: { apikey: localStatus.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_center_id: ids.center,
      p_mutations: [mutation('attendance_record', localIds.attendance, basePayloads.attendance, 2)],
      p_idempotency_key: randomUUID(),
    }),
  })
  assert([401, 403, 404].includes(anonResponse.status), `Anon RPC should fail: ${anonResponse.status}`)
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('service_role','public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)','EXECUTE')::text;`), 'false')
  console.log('C5_2_RLS_RPC_ACL_FAIL_CLOSED: PASS')

  const coreId = `core-student-${suffix}`
  const coreCreate = await mutateAuthoritativeCoreEntity({
    supabase: clientA,
    centerId: ids.center,
    entityType: 'student',
    localId: coreId,
    entity: { id: coreId, fullName: 'C5.1 compact regression' },
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  })
  assert.equal(coreCreate.ok, true, JSON.stringify(coreCreate))
  const { data: coreB, error: coreBError } = await clientB.from('center_cloud_entities')
    .select('local_id,entity_version').eq('center_id', ids.center).eq('entity_type', 'student')
  assert.equal(coreBError, null)
  assert.equal(coreB.length, 1)
  const { data: coreC, error: coreCError } = await clientC.from('center_cloud_entities')
    .select('local_id').eq('center_id', ids.center).eq('entity_type', 'student')
  assert.equal(coreCError, null)
  assert.equal(coreC.length, 0)
  console.log('C5_2_COMPACT_C5_1_CORE_REGRESSION: PASS')

  psql(`update public.center_members set status='inactive'
    where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  const inactiveRows = await listOperational(clientB)
  assert.equal(inactiveRows.length, 0)
  const inactiveWrite = await mutate(clientB, [
    mutation('attendance_record', localIds.attendance, basePayloads.attendance, 2),
  ])
  assert.equal(inactiveWrite.ok, false)
  assert.equal(inactiveWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  console.log('C5_2_MEMBERSHIP_CURRENTNESS: PASS')

  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.center)} and entity_type in ('attendance_record','attendance_baseline_state','session_report','tuition_record_package') and deleted_at is null;`), '5')
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.otherCenter)} and entity_type in ('attendance_record','attendance_baseline_state','session_report','tuition_record_package') and deleted_at is null;`), '4')
  assert.equal(scalar(`select count(*) from public.center_operational_command_result where center_id=${q(ids.center)};`), '9')
  console.log('C5_2_AUTHORITATIVE_FINAL_STATE: PASS')
} finally {
  for (const { client, channel } of channels) {
    try { await client.removeChannel(channel) } catch { /* final local reset remains cleanup */ }
  }
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    await waitForLocalRealtimeContainer()
    restartLocalGatewayForRealtime()
    await waitForRealtimeHealth()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from public.center_cloud_entities;'), '0')
    assert.equal(scalar('select count(*) from public.center_operational_command_result;'), '0')
    assert.equal(scalar('select count(*) from public.center_core_command_result;'), '0')
    assert.equal(scalar('select count(*) from public.centers;'), '0')
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_2_FINAL_RESET_AUTH_OPERATIONAL_CORE_BASELINE_ZERO: PASS')
console.log('C5.2 attendance + tuition authoritative shared truth local DB QA: PASS')
