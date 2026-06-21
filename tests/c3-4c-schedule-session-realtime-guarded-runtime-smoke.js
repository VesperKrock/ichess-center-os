import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  SCHEDULE_SESSION_REALTIME_ENTITY_TYPE,
  getScheduleSessionRealtimeRecord,
  mergeScheduleSessionRealtimePayload,
  subscribeToScheduleSessionCloudRealtime,
  upsertScheduleSessionCloudEntity,
} from '../src/cloud-realtime-schedule-sessions.js'
import { createScheduleSessionCloudDryRun } from '../src/cloud-schedule-sessions.js'
import { buildOnlineAccessState } from '../src/online-access-control.js'

const repoRoot = process.cwd()
const helperPath = path.join(repoRoot, 'src', 'cloud-realtime-schedule-sessions.js')
const bridgePath = path.join(repoRoot, 'src', 'cloud-schedule-session-bridge.js')
const docsPath = path.join(repoRoot, 'docs', 'online-schedule-session-realtime-c3-4c.md')
const testPath = path.join(repoRoot, 'tests', 'c3-4c-schedule-session-realtime-guarded-runtime-smoke.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const bridgeSource = fs.readFileSync(bridgePath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')
const testSource = fs.readFileSync(testPath, 'utf8')
const mainSource = fs.readFileSync(mainPath, 'utf8')

assert.equal(SCHEDULE_SESSION_REALTIME_ENTITY_TYPE, 'schedule_session')
assert(fs.existsSync(helperPath), 'C3.4C realtime helper must exist.')
assert(fs.existsSync(docsPath), 'C3.4C docs must exist.')

for (const term of [
  'schedule_session',
  'src/cloud-realtime-schedule-sessions.js',
  'writeScheduleSessionThroughCloud',
  'subscribeToScheduleSessionCloudRealtime',
  'mergeScheduleSessionRealtimePayload',
  'SQL applied: NO',
  'NEEDS MEMBERSHIP SQL PATCH: YES',
  'NEEDS SUPABASE REALTIME PATCH: YES',
  'NEEDS SCHEDULE_SESSION SQL PATCH: YES',
  'NEEDS SUPABASE CONFIRMATION: YES',
  'Mojibake found: NO',
]) {
  assert(docs.includes(term), `Missing C3.4C docs term: ${term}`)
}

for (const term of [
  'upsertScheduleSessionCloudEntity',
  'subscribeToScheduleSessionCloudRealtime',
  'getScheduleSessionRealtimeRecord',
  'mergeScheduleSessionRealtimePayload',
  'getScheduleSessionBridgeReadiness',
  'buildScheduleSessionCloudPayload',
]) {
  assert(helperSource.includes(term), `Missing helper term: ${term}`)
}

assert(mainSource.includes('writeScheduleSessionThroughCloud'))
assert(mainSource.includes('startScheduleSessionRealtimeSubscription'))
assert(mainSource.includes('stopScheduleSessionRealtimeSubscription'))
assert(mainSource.includes('mergeScheduleSessionRealtimePayload'))
assert(mainSource.includes('isDeleted: true'))
assert(bridgeSource.includes('deletedAt'))

const adminAccess = buildOnlineAccessState({
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: 'user-001' },
  centerId: 'dreamhome',
  membership: { role: 'center_admin' },
  cloudReady: true,
})
const viewerAccess = buildOnlineAccessState({
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: 'user-viewer' },
  centerId: 'dreamhome',
  membership: { role: 'viewer' },
  cloudReady: true,
})
const scheduleSession = createScheduleSession()
const dryRunPreview = createScheduleSessionCloudDryRun({
  centerId: 'dreamhome',
  scheduleSessions: [scheduleSession],
  remoteAllowlistReady: true,
})

const blockedWrite = await upsertScheduleSessionCloudEntity({
  supabase: createMockSupabase(),
  centerId: 'dreamhome',
  scheduleSession,
  accessState: adminAccess,
  readiness: {
    dryRunPreview,
    cloudReady: true,
    signedIn: true,
    membershipReady: true,
    membershipSqlReady: false,
    scheduleSessionSqlReady: false,
    realtimeReady: false,
  },
})
assert.equal(blockedWrite.ok, false)
assert.equal(blockedWrite.skipped, true)
assert.equal(blockedWrite.readiness.needsScheduleSessionSqlPatch, true)
assert.equal(blockedWrite.readiness.readyForRuntimeWrite, false)

const viewerWrite = await upsertScheduleSessionCloudEntity({
  supabase: createMockSupabase(),
  centerId: 'dreamhome',
  scheduleSession,
  accessState: viewerAccess,
  readiness: {
    dryRunPreview,
    cloudReady: true,
    signedIn: true,
    membershipReady: true,
    membershipSqlReady: true,
    scheduleSessionSqlReady: true,
    realtimeReady: true,
  },
})
assert.equal(viewerWrite.ok, false)
assert.equal(viewerWrite.skipped, true)

const mockSupabase = createMockSupabase()
const allowedWrite = await upsertScheduleSessionCloudEntity({
  supabase: mockSupabase,
  centerId: 'dreamhome',
  scheduleSession,
  userId: 'user-001',
  accessState: adminAccess,
  readiness: {
    dryRunPreview,
    cloudReady: true,
    signedIn: true,
    membershipReady: true,
    membershipSqlReady: true,
    scheduleSessionSqlReady: true,
    realtimeReady: true,
  },
})
assert.equal(allowedWrite.ok, true)
assert.equal(mockSupabase.upsertedRecords.length, 1)
assert.equal(mockSupabase.upsertedRecords[0].entity_type, 'schedule_session')
assert.equal(mockSupabase.upsertedRecords[0].payload.id, scheduleSession.id)

const realtimeEvents = []
const realtimeStatuses = []
const mockRealtimeSupabase = createMockSupabase()
const blockedSubscription = subscribeToScheduleSessionCloudRealtime({
  supabase: mockRealtimeSupabase,
  centerId: 'dreamhome',
  accessState: adminAccess,
  readiness: {
    dryRunPreview,
    cloudReady: true,
    signedIn: true,
    membershipReady: true,
    membershipSqlReady: false,
    scheduleSessionSqlReady: false,
    realtimeReady: false,
  },
})
assert.equal(blockedSubscription.ok, false)
assert.equal(blockedSubscription.needsScheduleSessionSqlPatch, true)

const subscription = subscribeToScheduleSessionCloudRealtime({
  supabase: mockRealtimeSupabase,
  centerId: 'dreamhome',
  accessState: adminAccess,
  readiness: {
    dryRunPreview,
    cloudReady: true,
    signedIn: true,
    membershipReady: true,
    membershipSqlReady: true,
    scheduleSessionSqlReady: true,
    realtimeReady: true,
  },
  onScheduleSessionRecord: (record) => realtimeEvents.push(record),
  onStatusChange: (status) => realtimeStatuses.push(status),
})
assert.equal(subscription.ok, true)
assert.equal(mockRealtimeSupabase.channelName, 'ichess-center-schedule-sessions:dreamhome')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.table, 'center_cloud_entities')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.filter, 'center_id=eq.dreamhome')
assert.equal(realtimeStatuses[0].status, 'SUBSCRIBED')

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'teacher',
    payload: { id: 'teacher-001' },
  },
})
assert.equal(realtimeEvents.length, 0)

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'schedule_session',
    payload: createScheduleSession({ id: 'schedule-rt-001', title: 'Realtime schedule' }),
  },
})
assert.equal(realtimeEvents.length, 1)
assert.equal(getScheduleSessionRealtimeRecord({ new: realtimeEvents[0] })?.entity_type, 'schedule_session')

const olderLocal = createScheduleSession({
  id: 'schedule-rt-001',
  title: 'Ban moi hon',
  updatedAt: '2026-06-21T10:00:00.000Z',
})
const olderRemote = {
  payload: createScheduleSession({
    id: 'schedule-rt-001',
    title: 'Ban cu',
    updatedAt: '2026-06-20T10:00:00.000Z',
  }),
}
const skippedOlder = mergeScheduleSessionRealtimePayload([olderLocal], olderRemote)
assert.equal(skippedOlder.changed, false)
assert.equal(skippedOlder.scheduleSessions[0].title, 'Ban moi hon')

const mergeResult = mergeScheduleSessionRealtimePayload(
  [createScheduleSession({ id: 'schedule-rt-001', title: 'Cu' })],
  {
    payload: createScheduleSession({
      id: 'schedule-rt-001',
      title: 'Moi',
      updatedAt: '2026-06-21T11:00:00.000Z',
    }),
  },
)
assert.equal(mergeResult.ok, true)
assert.equal(mergeResult.changed, true)
assert.equal(mergeResult.scheduleSessions.length, 1)
assert.equal(mergeResult.scheduleSessions[0].title, 'Moi')

for (const forbiddenRuntime of [
  'subscribeToTuitionCloudRealtime',
  'subscribeToAttendanceCloudRealtime',
  'writeTuitionThroughCloud',
  'writeAttendanceThroughCloud',
  'startTuitionRealtimeSubscription',
  'startAttendanceRealtimeSubscription',
]) {
  assert(!mainSource.includes(forbiddenRuntime), `C3.4C must not add out-of-scope runtime ${forbiddenRuntime}`)
  assert(!helperSource.includes(forbiddenRuntime), `C3.4C helper must not add out-of-scope runtime ${forbiddenRuntime}`)
}

assert(!helperSource.includes('deleteCloudEntity'), 'C3.4C helper must not hard delete cloud schedule_session.')
assert(!/SQL (has been|was) applied/i.test(docs), 'C3.4C must not claim SQL was applied.')
assert(!/production realtime (has passed|passed|da pass)/i.test(docs), 'C3.4C must not claim production realtime passed.')
assert(!/live realtime (has passed|passed)/i.test(docs), 'C3.4C must not claim live realtime passed.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  ['helper', helperSource],
  ['docs', docs],
  ['test', testSource],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C3.4C schedule_session realtime guarded runtime smoke passed')

function createScheduleSession(overrides = {}) {
  return {
    id: 'schedule-001',
    scheduleType: 'recurring',
    title: 'Lich C3.4C',
    classSessionId: 'class-session-t2-1800',
    dayOfWeek: 'monday',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    date: null,
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phong 1',
    teacherId: 'teacher-001',
    teacherName: 'Coach C3.4C',
    studentIds: ['student-001', 'student-002'],
    status: 'scheduled',
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...overrides,
  }
}

function createMockSupabase() {
  const mock = {
    upsertedRecords: [],
    upsertOptions: null,
    channelName: '',
    postgresChangesConfig: null,
    realtimeHandler: null,
    from(tableName) {
      assert.equal(tableName, 'center_cloud_entities')
      return {
        upsert: async (records, options) => {
          mock.upsertedRecords = records
          mock.upsertOptions = options
          return { error: null }
        },
      }
    },
    channel(channelName) {
      mock.channelName = channelName
      return {
        on: (eventName, config, handler) => {
          assert.equal(eventName, 'postgres_changes')
          mock.postgresChangesConfig = config
          mock.realtimeHandler = handler
          return this.channel(channelName)
        },
        subscribe: (callback) => {
          callback('SUBSCRIBED')
          return this.channel(channelName)
        },
        unsubscribe: () => {},
      }
    },
    removeChannel: () => {},
    emit(event) {
      mock.realtimeHandler?.(event)
    },
  }

  return mock
}
