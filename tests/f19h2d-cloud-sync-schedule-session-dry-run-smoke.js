import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  SCHEDULE_SESSION_CLOUD_ENTITY_TYPE,
  SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH,
  buildScheduleSessionCloudEntity,
  createScheduleSessionCloudDryRun,
  createScheduleSessionCloudLocalId,
  evaluateScheduleSessionCloudReadiness,
  isAllowedScheduleSessionCloudEntityType,
  validateScheduleSessionCloudPayload,
} from '../src/cloud-schedule-sessions.js'

function createLocalStorageMock(initialValues = {}) {
  const values = new Map(Object.entries(initialValues))
  let writeCount = 0

  return {
    values,
    get writeCount() {
      return writeCount
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      writeCount += 1
      values.set(key, value)
    },
  }
}

const scheduleSessions = [
  {
    id: 'schedule-001',
    classSessionId: 'class-session-001',
    scheduleType: 'recurring',
    title: 'Lop co vua can ban',
    dayOfWeek: 'monday',
    startDate: '2026-06-01',
    endDate: '2026-09-01',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phong 1',
    teacherId: 'teacher-001',
    teacherName: 'Giao vien A',
    studentIds: ['student-001', 'student-002'],
    groupName: 'Nhom can ban',
    status: 'scheduled',
    updatedAt: '2026-06-20T08:00:00.000Z',
  },
  {
    id: 'schedule-002',
    classSessionId: 'class-session-002',
    scheduleType: 'oneOff',
    title: 'Hoc bu dot xuat',
    date: '2026-06-21',
    startTime: '17:30',
    endTime: '18:30',
    room: 'Phong 2',
    teacherId: '',
    studentIds: [],
    occurrenceReason: 'makeup',
    updatedAt: '2026-06-20T09:00:00.000Z',
  },
  {
    classSessionId: 'class-session-003',
    scheduleType: 'weekly',
    dayOfWeek: 'tuesday',
    startTime: '19:00',
    endTime: '20:00',
    room: 'Phong 3',
    teacherId: 'teacher-003',
    studentIds: ['student-003'],
    updatedAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'schedule-invalid-type',
    scheduleType: 'holiday',
    date: '2026-06-22',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    id: 'schedule-invalid-time',
    scheduleType: 'recurring',
    dayOfWeek: 'friday',
    startTime: '20:00',
    endTime: '19:00',
  },
]
const storage = createLocalStorageMock({
  'ichessCenterOS.schedule.dreamhome': JSON.stringify(scheduleSessions),
})

assert.equal(SCHEDULE_SESSION_CLOUD_ENTITY_TYPE, 'schedule_session')
assert.equal(isAllowedScheduleSessionCloudEntityType('schedule_session'), true)
assert.equal(isAllowedScheduleSessionCloudEntityType('class_session'), false)

const dryRun = createScheduleSessionCloudDryRun({
  centerId: 'dreamhome',
  storage,
})

assert.equal(dryRun.entityType, 'schedule_session')
assert.equal(dryRun.total, 5)
assert.equal(dryRun.valid, 3)
assert.equal(dryRun.invalid, 2)
assert.equal(dryRun.skipped, 2)
assert.equal(dryRun.countByScheduleType.recurring, 2)
assert.equal(dryRun.countByScheduleType.oneOff, 1)
assert.equal(dryRun.countByScheduleType.legacyUnknown, 1)
assert.equal(dryRun.sessionsMissingTeacher, 1)
assert.equal(dryRun.sessionsMissingStudents, 1)
assert.equal(dryRun.estimatedCloudEntityCount, 3)
assert.equal(dryRun.realPushStatus, SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH)
assert.equal(storage.writeCount, 0, 'F19H.2d dry-run must not write localStorage.')

const recurringEntity = buildScheduleSessionCloudEntity({
  centerId: 'dreamhome',
  session: scheduleSessions[0],
})
assert.equal(recurringEntity.ok, true)
assert.equal(recurringEntity.data.entity_type, 'schedule_session')
assert.equal(recurringEntity.data.payload.classSessionId, 'class-session-001')
assert.equal(recurringEntity.data.payload.classSessionEntity, 'class_session')
assert.equal(recurringEntity.data.payload.scheduleSessionEntity, 'schedule_session')

const legacyValidation = validateScheduleSessionCloudPayload(scheduleSessions[2])
assert.equal(legacyValidation.ok, true)
assert.equal(legacyValidation.session.scheduleType, 'recurring')
assert.equal(legacyValidation.session.scheduleTypeWasNormalized, true)
assert.equal(
  createScheduleSessionCloudLocalId(scheduleSessions[2]),
  'schedule-session::schedule-class-session-003-recurring-tuesday-19-00-20-00',
)

const invalidValidation = validateScheduleSessionCloudPayload(scheduleSessions[3])
assert.equal(invalidValidation.ok, false)
assert.equal(invalidValidation.scheduleType, 'legacyUnknown')

const readiness = evaluateScheduleSessionCloudReadiness({
  cloudReady: true,
  signedIn: true,
  membershipReady: true,
  centerId: 'dreamhome',
  dryRunPreview: {
    ...dryRun,
    invalid: 0,
  },
  explicitUserAction: true,
  remoteAllowlistReady: false,
})
assert.equal(readiness.ok, false)
assert.equal(readiness.status, SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH)
assert(readiness.blockers.includes(SCHEDULE_SESSION_CLOUD_STATUS_NEEDS_PATCH))

const docs = fs.readFileSync(
  new URL('../docs/supabase-schedule-session-sync-f19h2d.md', import.meta.url),
  'utf8',
)
assert(docs.includes('schedule_session'))
assert(docs.includes('ichessCenterOS.schedule.dreamhome'))
assert(docs.includes('class_session'))
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))
assert(docs.includes('F19H.2e - Cloud dry-run cho tuition_record va tuition_package'))

const sqlPatch = fs.readFileSync(
  new URL('../docs/supabase-f19h2d-schedule-session-allowlist.sql', import.meta.url),
  'utf8',
)
assert(sqlPatch.includes("'student'"))
assert(sqlPatch.includes("'teacher'"))
assert(sqlPatch.includes("'class_session'"))
assert(sqlPatch.includes("'attendance_record'"))
assert(sqlPatch.includes("'attendance_baseline_state'"))
assert(sqlPatch.includes("'session_report'"))
assert(sqlPatch.includes("'schedule_session'"))
assert(!/create\s+table/i.test(sqlPatch))
assert(!/to\s+anon/i.test(sqlPatch))
assert(!/service_role/i.test(sqlPatch))

const runtimeSources = [
  '../src/main.js',
  '../src/cloud-db-sync.js',
  '../src/cloud-db-entities.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(!runtimeSources.includes('attendance_baseline_state'))
assert(!runtimeSources.includes('session_report'))
assert(!runtimeSources.includes('schedule_session'))
assert(!runtimeSources.includes('tuition_record'))
assert(!runtimeSources.includes('deadline_state'))
assert(!runtimeSources.includes('realtime'))

console.log('F19H.2d cloud sync schedule_session dry-run smoke passed')
