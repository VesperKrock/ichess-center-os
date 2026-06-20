import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE,
  BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH,
  SESSION_REPORT_CLOUD_ENTITY_TYPE,
  buildAttendanceBaselineStateCloudEntity,
  buildSessionReportCloudEntity,
  createBaselineSessionReportCloudDryRun,
  evaluateBaselineSessionReportCloudReadiness,
  isAllowedBaselineSessionReportCloudEntityType,
  validateSessionReportCloudPayload,
} from '../src/cloud-session-reports.js'

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

const baselineState = {
  status: 'locked',
  lockedAt: '2026-06-20T10:00:00.000Z',
  lockedBy: 'Admin',
  lastActionAt: '2026-06-20T10:00:00.000Z',
  auditLog: [
    {
      id: 'audit-001',
      action: 'lockBaseline',
      at: '2026-06-20T10:00:00.000Z',
      byRole: 'admin',
      byName: 'Admin',
      note: 'Khóa dữ liệu nền.',
    },
  ],
}
const reports = [
  {
    id: 'report-schedule-001-2026-06-20',
    sessionId: 'schedule-001',
    occurrenceDate: '2026-06-20',
    teacherName: 'Giáo viên A',
    learningGroups: [
      {
        id: 'group-001',
        title: 'Khai cuộc',
        studentIds: ['student-001'],
        contentLines: ['Ôn lại nhập thành'],
      },
    ],
    classSituation: 'Lớp học ổn.',
    attendance: [
      {
        studentId: 'student-001',
        attendanceStatus: 'present',
      },
    ],
    updatedAt: '2026-06-20T12:00:00.000Z',
  },
  {
    sessionId: 'schedule-002',
    occurrenceDate: '2026-06-21',
  },
]
const storage = createLocalStorageMock({
  'ichessCenterOS.attendanceBaselineState.dreamhome': JSON.stringify(baselineState),
  'ichessCenterOS.sessionReports.dreamhome': JSON.stringify(reports),
})

assert.equal(ATTENDANCE_BASELINE_STATE_CLOUD_ENTITY_TYPE, 'attendance_baseline_state')
assert.equal(SESSION_REPORT_CLOUD_ENTITY_TYPE, 'session_report')
assert.equal(isAllowedBaselineSessionReportCloudEntityType('attendance_baseline_state'), true)
assert.equal(isAllowedBaselineSessionReportCloudEntityType('session_report'), true)

const dryRun = createBaselineSessionReportCloudDryRun({
  centerId: 'dreamhome',
  storage,
})
const baselineSummary = dryRun.entities.attendance_baseline_state
const reportSummary = dryRun.entities.session_report

assert.equal(dryRun.total, 3)
assert.equal(dryRun.valid, 2)
assert.equal(dryRun.invalid, 1)
assert.equal(dryRun.realPushStatus, BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH)
assert.equal(baselineSummary.total, 1)
assert.equal(baselineSummary.valid, 1)
assert.equal(baselineSummary.estimatedCloudEntityCount, 1)
assert.equal(reportSummary.total, 2)
assert.equal(reportSummary.valid, 1)
assert.equal(reportSummary.invalid, 1)
assert.equal(reportSummary.invalidSamples[0].reason, 'Session report không có nội dung meaningful.')
assert.equal(storage.writeCount, 0, 'F19H.2c dry-run must not write localStorage.')

const baselineEntity = buildAttendanceBaselineStateCloudEntity({
  centerId: 'dreamhome',
  state: baselineState,
})
assert.equal(baselineEntity.ok, true)
assert.equal(baselineEntity.data.entity_type, 'attendance_baseline_state')
assert.equal(baselineEntity.data.payload.status, 'locked')

const reportEntity = buildSessionReportCloudEntity({
  centerId: 'dreamhome',
  report: reports[0],
})
assert.equal(reportEntity.ok, true)
assert.equal(reportEntity.data.entity_type, 'session_report')
assert.equal(reportEntity.data.payload.attendanceIsCanonical, false)
assert.equal(reportEntity.data.payload.canonicalAttendanceEntity, 'attendance_record')
assert.equal(reportEntity.data.payload.attendance[0].legacyOnly, true)
assert.equal(reportEntity.data.payload.attendance[0].canonicalEntity, 'attendance_record')

const emptyReportValidation = validateSessionReportCloudPayload(reports[1])
assert.equal(emptyReportValidation.ok, false)
assert.equal(emptyReportValidation.error, 'Session report không có nội dung meaningful.')

const readiness = evaluateBaselineSessionReportCloudReadiness({
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
assert.equal(readiness.status, BASELINE_SESSION_REPORT_CLOUD_STATUS_NEEDS_PATCH)

const docs = fs.readFileSync(
  new URL('../docs/supabase-baseline-session-report-sync-f19h2c.md', import.meta.url),
  'utf8',
)
assert(docs.includes('attendance_baseline_state'))
assert(docs.includes('session_report'))
assert(docs.includes('attendanceIsCanonical: false'))
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))
assert(docs.includes('Học phí'))

const sqlPatch = fs.readFileSync(
  new URL('../docs/supabase-f19h2c-baseline-session-report-allowlist.sql', import.meta.url),
  'utf8',
)
assert(sqlPatch.includes("'student'"))
assert(sqlPatch.includes("'teacher'"))
assert(sqlPatch.includes("'class_session'"))
assert(sqlPatch.includes("'attendance_record'"))
assert(sqlPatch.includes("'attendance_baseline_state'"))
assert(sqlPatch.includes("'session_report'"))
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
assert(!runtimeSources.includes('realtime'))

console.log('F19H.2c cloud sync baseline/session report dry-run smoke passed')
