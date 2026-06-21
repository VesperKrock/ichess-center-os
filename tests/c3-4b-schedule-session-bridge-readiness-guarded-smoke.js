import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  NEEDS_SCHEDULE_SESSION_SQL_PATCH,
  NEEDS_SUPABASE_REALTIME_PATCH,
  SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE,
  buildScheduleSessionBridgePreview,
  buildScheduleSessionCloudPayload,
  canWriteScheduleSession,
  getScheduleSessionBridgeReadiness,
  normalizeScheduleSessionForCloud,
  validateScheduleSessionPayload,
} from '../src/cloud-schedule-session-bridge.js'
import { buildOnlineAccessState } from '../src/online-access-control.js'

const repoRoot = process.cwd()
const helperPath = path.join(repoRoot, 'src', 'cloud-schedule-session-bridge.js')
const docsPath = path.join(repoRoot, 'docs', 'online-schedule-session-bridge-c3-4b.md')
const testPath = path.join(repoRoot, 'tests', 'c3-4b-schedule-session-bridge-readiness-guarded-smoke.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')
const testSource = fs.readFileSync(testPath, 'utf8')
const mainSource = fs.readFileSync(mainPath, 'utf8')

assert.equal(SCHEDULE_SESSION_BRIDGE_ENTITY_TYPE, 'schedule_session')
assert(fs.existsSync(helperPath), 'C3.4B helper must exist.')
assert(fs.existsSync(docsPath), 'C3.4B docs must exist.')

for (const term of [
  'schedule_session',
  'classSessionId',
  'schedule_session.classSessionId -> class_session.id',
  'Payload mapping',
  'Readiness preview',
  'Access-control C3.1',
  'SQL applied: NO',
  'NEEDS MEMBERSHIP SQL PATCH: YES',
  'NEEDS SUPABASE REALTIME PATCH: YES',
  'NEEDS SCHEDULE_SESSION SQL PATCH: YES',
  'NEEDS SUPABASE CONFIRMATION: YES',
  'Mojibake found: NO',
  'C3.4C - Schedule Session Realtime Guarded Runtime',
]) {
  assert(docs.includes(term), `Missing C3.4B docs term: ${term}`)
}

for (const exportName of [
  'normalizeScheduleSessionForCloud',
  'validateScheduleSessionPayload',
  'buildScheduleSessionCloudPayload',
  'buildScheduleSessionBridgePreview',
  'canWriteScheduleSession',
  'getScheduleSessionBridgeReadiness',
]) {
  assert(helperSource.includes(`export function ${exportName}`), `Missing helper export ${exportName}`)
}

const classSessions = [
  { id: 'class-session-t2-1800', name: 'T2 18:00' },
  { id: 'class-session-t4-1900', name: 'T4 19:00' },
]
const scheduleSessions = [
  createScheduleSession({ id: 'schedule-001', classSessionId: 'class-session-t2-1800' }),
  createScheduleSession({
    id: 'schedule-002',
    classSessionId: '',
    scheduleType: 'oneOff',
    date: '2026-06-21',
    dayOfWeek: '',
    teacherId: '',
    studentIds: [],
  }),
  createScheduleSession({ id: 'schedule-003', classSessionId: 'class-session-missing' }),
  createScheduleSession({ id: 'schedule-bad', scheduleType: 'bad-type' }),
]

const normalized = normalizeScheduleSessionForCloud(scheduleSessions[0])
assert.equal(normalized.ok, true)
assert.equal(normalized.payload.classSessionId, 'class-session-t2-1800')
assert.equal(normalized.payload.teacherId, 'teacher-001')
assert.deepEqual(normalized.payload.studentIds, ['student-001', 'student-002'])

const invalid = validateScheduleSessionPayload({ id: 'bad', scheduleType: 'oneOff', startTime: '10:00', endTime: '11:00' })
assert.equal(invalid.ok, false, 'oneOff schedule without date must be invalid')

const payloadResult = buildScheduleSessionCloudPayload(scheduleSessions[0], {
  centerId: 'dreamhome',
  userId: 'user-001',
})
assert.equal(payloadResult.ok, true)
assert.equal(payloadResult.record.entity_type, 'schedule_session')
assert.equal(payloadResult.payload.classSessionEntity, 'class_session')
assert.equal(payloadResult.payload.scheduleSessionEntity, 'schedule_session')
assert.equal(payloadResult.localId, 'schedule-session::schedule-001')

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

assert.equal(canWriteScheduleSession(adminAccess).canWrite, true)
assert.equal(canWriteScheduleSession(viewerAccess).canWrite, false)

const preview = buildScheduleSessionBridgePreview(scheduleSessions, {
  centerId: 'dreamhome',
  classSessions,
  accessState: adminAccess,
  cloudReady: true,
  signedIn: true,
  membershipReady: true,
  explicitUserAction: true,
})

assert.equal(preview.entityType, 'schedule_session')
assert.equal(preview.classSessionBridge, 'schedule_session.classSessionId -> class_session.id')
assert.equal(preview.summary.total, 4)
assert.equal(preview.summary.valid, 3)
assert.equal(preview.summary.invalid, 1)
assert.equal(preview.summary.validClassSessionId, 1)
assert.equal(preview.summary.missingClassSessionId, 1)
assert.equal(preview.summary.missingReferencedClassSession, 1)
assert.equal(preview.summary.missingTeacherId, 1)
assert.equal(preview.summary.emptyStudentIds, 1)
assert.equal(preview.summary.recurring, 2)
assert.equal(preview.summary.oneOff, 1)
assert.equal(preview.readiness.needsScheduleSessionSqlPatch, true)
assert.equal(preview.readiness.needsMembershipSqlPatch, true)
assert.equal(preview.readiness.needsRealtimePatch, true)
assert.equal(preview.readiness.readyForRuntimeWrite, false)
assert(preview.readiness.blockers.includes(NEEDS_SCHEDULE_SESSION_SQL_PATCH))
assert(preview.readiness.blockers.includes(NEEDS_SUPABASE_REALTIME_PATCH))

const readyCheck = getScheduleSessionBridgeReadiness({
  centerId: 'dreamhome',
  accessState: adminAccess,
  cloudReady: true,
  signedIn: true,
  membershipReady: true,
  membershipSqlReady: true,
  scheduleSessionSqlReady: true,
  realtimeReady: true,
  explicitUserAction: true,
  dryRunPreview: preview.dryRun,
})
assert.equal(readyCheck.readyForRuntimeWrite, false, 'invalid dry-run keeps runtime write blocked')

for (const forbiddenRuntime of [
  'subscribeToTuitionCloudRealtime',
  'subscribeToAttendanceCloudRealtime',
  'writeTuitionThroughCloud',
  'writeAttendanceThroughCloud',
  'startTuitionRealtimeSubscription',
  'startAttendanceRealtimeSubscription',
]) {
  assert(!mainSource.includes(forbiddenRuntime), `C3.4B must not add schedule runtime ${forbiddenRuntime}`)
  assert(!helperSource.includes(forbiddenRuntime), `C3.4B helper must not add schedule runtime ${forbiddenRuntime}`)
}

assert(!/SQL (has been|was) applied/i.test(docs), 'C3.4B must not claim SQL was applied.')
assert(!/production realtime (has passed|passed|da pass)/i.test(docs), 'C3.4B must not claim production realtime passed.')
assert(!/live realtime (has passed|passed)/i.test(docs), 'C3.4B must not claim live realtime passed.')

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

console.log('C3.4B schedule_session bridge readiness guarded smoke passed')

function createScheduleSession(overrides = {}) {
  return {
    id: 'schedule-001',
    scheduleType: 'recurring',
    title: 'Lich C3.4B',
    classSessionId: 'class-session-t2-1800',
    dayOfWeek: 'monday',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    date: null,
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phong 1',
    teacherId: 'teacher-001',
    teacherName: 'Coach C3.4B',
    studentIds: ['student-001', 'student-002'],
    status: 'scheduled',
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...overrides,
  }
}
