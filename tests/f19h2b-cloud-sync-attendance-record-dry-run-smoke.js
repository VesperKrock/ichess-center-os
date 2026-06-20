import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE,
  ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH,
  buildAttendanceRecordCloudEntity,
  createAttendanceRecordCloudDryRun,
  createAttendanceRecordCloudLocalId,
  createAttendanceRecordsPullBackup,
  evaluateAttendanceRecordCloudReadiness,
  isAllowedAttendanceRecordCloudEntityType,
  mergeAttendanceRecordCloudPayloads,
  validateAttendanceRecordCloudPayload,
} from '../src/cloud-attendance-records.js'
import { CLOUD_ENTITY_TYPE_VALUES } from '../src/cloud-db-entities.js'

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
    removeItem(key) {
      writeCount += 1
      values.delete(key)
    },
  }
}

const records = [
  {
    id: 'baseline-001',
    studentId: 'student-001',
    date: '2026-06-01',
    source: 'initialBaseline',
    attendanceStatus: 'present',
    status: 'present',
    counted: true,
    creditValue: 1,
    creditLabel: '1',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'admin-001',
    studentId: 'student-001',
    date: '2026-06-02',
    sessionId: 'schedule-001',
    source: 'admin',
    attendanceStatus: 'present',
    status: 'present',
    counted: true,
    updatedAt: '2026-06-02T08:00:00.000Z',
  },
  {
    id: 'teacher-001',
    studentId: 'student-002',
    date: '2026-06-02',
    scheduleSessionId: 'schedule-002',
    source: 'teacher',
    attendanceStatus: 'absent',
    status: 'absent',
    counted: false,
    updatedAt: '2026-06-02T09:00:00.000Z',
  },
  {
    id: 'legacy-001',
    studentId: 'student-003',
    date: '2026-06-03',
    sessionId: 'schedule-003',
    source: 'legacyReport',
    attendanceStatus: 'present',
    status: 'present',
  },
]

assert.equal(ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE, 'attendance_record')
assert.equal(isAllowedAttendanceRecordCloudEntityType('attendance_record'), true)
assert.equal(
  CLOUD_ENTITY_TYPE_VALUES.includes('attendance_record'),
  false,
  'Core C2 runtime allowlist should stay unchanged until SQL allowlist patch is real.',
)

const dryRun = createAttendanceRecordCloudDryRun({
  centerId: 'dreamhome',
  records,
})
assert.equal(dryRun.total, 4)
assert.equal(dryRun.valid, 3)
assert.equal(dryRun.invalid, 1)
assert.equal(dryRun.skipped, 1)
assert.equal(dryRun.countBySource.initialBaseline, 1)
assert.equal(dryRun.countBySource.admin, 1)
assert.equal(dryRun.countBySource.teacher, 1)
assert.equal(dryRun.countBySource.consultant, 0)
assert.equal(dryRun.estimatedCloudEntityCount, 3)
assert.equal(dryRun.appAllowlistReady, true)
assert.equal(dryRun.remoteAllowlistReady, false)
assert.equal(dryRun.readyForRealPush, false)
assert.equal(dryRun.realPushStatus, ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH)
assert.equal(dryRun.invalidSamples[0].source, 'legacyReport')

const storage = createLocalStorageMock({
  'ichessCenterOS.attendanceRecords.dreamhome': JSON.stringify(records),
})
const storageDryRun = createAttendanceRecordCloudDryRun({
  centerId: 'dreamhome',
  storage,
})
assert.equal(storageDryRun.valid, 3)
assert.equal(storage.writeCount, 0, 'Dry-run must not write localStorage.')

const validEntity = buildAttendanceRecordCloudEntity({
  centerId: 'dreamhome',
  record: records[1],
  userId: 'user-001',
})
assert.equal(validEntity.ok, true)
assert.equal(validEntity.data.center_id, 'dreamhome')
assert.equal(validEntity.data.entity_type, 'attendance_record')
assert.equal(validEntity.data.source_version, 'f19h-attendance-alpha-v1')
assert.equal(validEntity.data.payload.studentId, 'student-001')
assert.equal(validEntity.data.payload.payloadVersion, 'f19h-attendance-alpha-v1')
assert(validEntity.data.local_id.includes('admin'))

const baselineLocalId = createAttendanceRecordCloudLocalId(records[0])
assert(baselineLocalId.includes('initialbaseline'))
assert(!baselineLocalId.includes('schedule-001'))

const invalidValidation = validateAttendanceRecordCloudPayload(records[3])
assert.equal(invalidValidation.ok, false)
assert(invalidValidation.error.includes('Source không thuộc phạm vi F19H.2b'))

const readiness = evaluateAttendanceRecordCloudReadiness({
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
assert.equal(readiness.status, ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH)
assert(readiness.blockers.includes(ATTENDANCE_RECORD_CLOUD_STATUS_NEEDS_PATCH))

const merged = mergeAttendanceRecordCloudPayloads({
  localRecords: [records[1]],
  cloudPayloads: [
    {
      ...records[1],
      note: 'Cloud newer note',
      updatedAt: '2026-06-04T08:00:00.000Z',
    },
    records[3],
    {
      id: 'consultant-001',
      studentId: 'student-004',
      date: '2026-06-04',
      sessionId: 'schedule-004',
      source: 'consultant',
      attendanceStatus: 'present',
      status: 'present',
      updatedAt: '2026-06-04T09:00:00.000Z',
    },
  ],
})
assert.equal(merged.records.length, 2)
assert(merged.records.some((record) => record.note === 'Cloud newer note'))
assert(merged.records.some((record) => record.source === 'consultant'))
assert.equal(merged.skipped.length, 1)
assert.equal(merged.skipped[0].source, 'legacyReport')

const backupKey = createAttendanceRecordsPullBackup(storage, 'dreamhome')
assert(backupKey.startsWith('ichessCenterOS.backup.beforeAttendanceRecordPull.'))
assert.equal(storage.writeCount, 1, 'Backup helper writes only when explicitly called.')
const backupPayload = JSON.parse(storage.values.get(backupKey))
assert.equal(backupPayload.reason, 'before-attendance-record-cloud-pull-f19h2b')
assert.equal(
  backupPayload.keys.attendanceRecords,
  JSON.stringify(records),
)

const docs = [
  fs.readFileSync(new URL('../docs/supabase-attendance-record-sync-f19h2b.md', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../docs/supabase-cloud-entity-strategy-f19h2a.md', import.meta.url), 'utf8'),
].join('\n')
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))
assert(docs.includes('Học phí'))

const scannedSources = [
  '../src/cloud-attendance-records.js',
  '../src/cloud-db-entities.js',
  '../src/cloud-db-sync.js',
  '../src/main.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(!scannedSources.includes('session_report'))
assert(!scannedSources.includes('schedule_session'))
assert(!scannedSources.includes('tuition_record'))
assert(!scannedSources.includes('tuition_payment'))
assert(!scannedSources.includes('realtime'))

console.log('F19H.2b cloud sync attendance_record dry-run smoke passed')
