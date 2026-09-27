import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inventoryLegacyAttendanceBrowserData } from '../src/attendance-legacy-browser-audit.js'
import { buildAttendanceRecordCloudEntity } from '../src/cloud-attendance-records.js'
import { projectC51AuthoritativeRecords } from '../src/cloud-attendance-realtime.js'
import { buildAttendanceBaselineStateCloudEntity } from '../src/cloud-session-reports.js'
import {
  buildCycleScopedTuitionAttendancePreviewMap,
  buildTuitionRows,
} from '../src/tuition-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

class ReadOnlyAuditStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries))
    this.writeCount = 0
    this.removeCount = 0
  }

  get length() { return this.entries.size }
  key(index) { return Array.from(this.entries.keys())[index] ?? null }
  getItem(key) { return this.entries.has(key) ? this.entries.get(key) : null }
  setItem() { this.writeCount += 1; throw new Error('audit must not write') }
  removeItem() { this.removeCount += 1; throw new Error('audit must not delete') }
}

const attendanceKey = 'ichessCenterOS.attendanceRecords.dreamhome'
const baselineKey = 'ichessCenterOS.attendanceBaselineState.dreamhome'
const exactRecord = {
  id: 'exact', studentId: 'student-1', date: '2026-09-02', classSessionId: 'class-1',
  source: 'admin', attendanceStatus: 'present', status: 'present', creditValue: 1,
}
const conflictCanonical = {
  id: 'conflict', studentId: 'student-1', date: '2026-09-03', classSessionId: 'class-1',
  source: 'admin', attendanceStatus: 'present', status: 'present', creditValue: 1,
}
const auditStorage = new ReadOnlyAuditStorage({
  [attendanceKey]: JSON.stringify([
    { id: 'local', studentId: 'student-2', date: '2026-09-01', source: 'initialBaseline' },
    exactRecord,
    { ...conflictCanonical, attendanceStatus: 'absent', status: 'absent', creditValue: 0 },
    { id: 'broken', studentId: '', date: 'not-a-date' },
    {
      id: 'demo', studentId: 'student-demo', date: '2026-09-04',
      sourceModule: 'bang-diem-danh-demo', isDemoAttendance: true,
    },
  ]),
  [baselineKey]: JSON.stringify({ status: 'locked', auditLog: [{ action: 'lockBaseline' }] }),
})
const inventory = inventoryLegacyAttendanceBrowserData({
  storage: auditStorage,
  centerId: 'dreamhome',
  canonicalRecords: [exactRecord, conflictCanonical],
})
assert.equal(inventory.readOnly, true)
assert.equal(inventory.authority, false)
assert.equal(inventory.autoImport, false)
assert.equal(inventory.autoMerge, false)
assert.equal(inventory.autoDelete, false)
assert.equal(inventory.recordCount, 5)
assert.deepEqual(inventory.dateRange, { from: '2026-09-01', to: '2026-09-04' })
assert.equal(inventory.classificationCounts.LOCAL_ONLY, 1)
assert.equal(inventory.classificationCounts.EXACT_DUPLICATE, 1)
assert.equal(inventory.classificationCounts.CONFLICT, 1)
assert.equal(inventory.classificationCounts.MALFORMED, 1)
assert.equal(inventory.classificationCounts.DEMO_OR_TEST, 1)
assert.equal(inventory.baselineStates[0].status, 'locked')
assert.equal(auditStorage.writeCount, 0)
assert.equal(auditStorage.removeCount, 0)

const centerId = '11111111-1111-4111-8111-111111111111'
const attendanceRecord = {
  id: 'canonical-record-1',
  studentId: 'student-1',
  date: '2026-09-12',
  classSessionId: 'class-1',
  scheduleSessionId: 'schedule-1',
  sessionId: 'session-1',
  status: 'present',
  attendanceStatus: 'present',
  counted: true,
  creditValue: 1,
  source: 'admin',
  note: '',
  createdAt: '2026-09-12T01:00:00.000Z',
  updatedAt: '2026-09-12T01:00:00.000Z',
}
const recordEntity = buildAttendanceRecordCloudEntity({ centerId, record: attendanceRecord })
const baselineEntity = buildAttendanceBaselineStateCloudEntity({
  centerId,
  state: {
    status: 'locked',
    lockedAt: '2026-09-12T02:00:00.000Z',
    lockedBy: 'Admin',
    auditLog: [],
  },
})
assert.equal(recordEntity.ok, true)
assert.equal(baselineEntity.ok, true)
const cloudRows = [recordEntity.data, baselineEntity.data].map((row) => ({
  ...row,
  entity_version: 1,
  updated_at: '2026-09-12T02:00:00.000Z',
}))
const firstDevice = projectC51AuthoritativeRecords({
  attendanceRecords: [], baselineState: {}, sessionReports: [],
  cloudRecords: cloudRows, authoritativeSnapshot: true,
})
const secondDeviceWithoutBrowserData = projectC51AuthoritativeRecords({
  attendanceRecords: [], baselineState: {}, sessionReports: [],
  cloudRecords: cloudRows, authoritativeSnapshot: true,
})
assert.deepEqual(secondDeviceWithoutBrowserData, firstDevice)
assert.equal(firstDevice.attendanceRecords.length, 1)
assert.equal(firstDevice.baselineState.status, 'locked')

const states = [
  {
    studentId: 'student-historical', readiness: 'READY',
    currentCycle: { id: 'cycle-current-1', cycleNumber: 2, baselineUsed: 0, usedSessions: 0, totalSessions: 8 },
    preparedNextCycle: { id: 'cycle-prepared-1', cycleNumber: 3, baselineUsed: 0, usedSessions: 0, totalSessions: 8 },
  },
  {
    studentId: 'student-current', readiness: 'READY',
    currentCycle: { id: 'cycle-current-2', cycleNumber: 2, baselineUsed: 1, usedSessions: 3, totalSessions: 8 },
  },
  {
    studentId: 'student-rollover', readiness: 'READY',
    currentCycle: { id: 'cycle-current-3', cycleNumber: 3, baselineUsed: 0, usedSessions: 1, totalSessions: 8 },
  },
]
const contribution = (studentId, cycleId, occurrenceDate, contributionUnits, extra = {}) => ({
  studentId, cycleId, occurrenceDate, contributionUnits, allocationState: 'APPLIED', ...extra,
})
const contributions = [
  contribution('student-historical', 'cycle-completed-1', '2026-07-01', 1, { lifecycleStatus: 'COMPLETED' }),
  contribution('student-historical', 'cycle-completed-1', '2026-07-08', 1, { lifecycleStatus: 'COMPLETED' }),
  contribution('student-historical', 'cycle-completed-1', '2026-07-15', 1, { lifecycleStatus: 'COMPLETED' }),
  contribution('student-historical', 'cycle-prepared-1', '2026-10-01', 1, { lifecycleStatus: 'PREPARED' }),
  contribution('student-current', 'cycle-current-2', '2026-09-01', 1, { attendanceStatus: 'present' }),
  contribution('student-current', 'cycle-current-2', '2026-09-08', 1, { attendanceStatus: 'makeup' }),
  contribution('student-current', 'cycle-current-2', '2026-09-15', 0, { attendanceStatus: 'absent' }),
  contribution('student-rollover', 'cycle-completed-2', '2026-08-20', 1, { lifecycleStatus: 'COMPLETED' }),
  contribution('student-rollover', 'cycle-current-3', '2026-09-20', 1, { lifecycleStatus: 'ACTIVE' }),
]
const rawAttendance = [
  ...Array.from({ length: 3 }, (_, index) => ({ studentId: 'student-historical', date: `2026-07-0${index + 1}` })),
  { studentId: 'student-ambiguous', date: '2026-05-01' },
]
const sourceSnapshot = JSON.stringify({ states, contributions, rawAttendance })
const previews = buildCycleScopedTuitionAttendancePreviewMap({
  packageCycleStudentStates: states,
  packageCycleContributions: contributions,
  attendanceRecords: rawAttendance,
})
assert.equal(previews.get('student-historical').attendanceCreditCount, 0, 'old/prepared attendance must not contaminate current cycle')
assert.equal(previews.get('student-current').attendanceCreditCount, 3, 'baseline + present + makeup; correction/absence contributes zero')
assert.equal(previews.get('student-rollover').attendanceCreditCount, 1, 'post-rollover comparison must use only new current cycle')
assert.equal(previews.has('student-ambiguous'), false, 'ambiguous historical record must not be assigned to a cycle')
assert.equal(JSON.stringify({ states, contributions, rawAttendance }), sourceSnapshot, 'reconciliation must be read-only')

const students = [
  { id: 'student-historical', fullName: 'Lịch sử', careNotes: [] },
  { id: 'student-current', fullName: 'Hiện tại', careNotes: [] },
  { id: 'student-rollover', fullName: 'Chuyển kỳ', careNotes: [] },
  { id: 'student-no-package', fullName: 'Chưa có gói', careNotes: [] },
]
const tuitionRecords = [
  { id: 'tuition-1', studentId: 'student-historical', usedSessions: 0, totalSessions: 8, hasUsedSessionsData: true },
  { id: 'tuition-2', studentId: 'student-current', usedSessions: 1, totalSessions: 8, hasUsedSessionsData: true },
  { id: 'tuition-3', studentId: 'student-rollover', usedSessions: 3, totalSessions: 8, hasUsedSessionsData: true },
]
const tuitionBefore = JSON.stringify(tuitionRecords)
const rows = buildTuitionRows(students, tuitionRecords, rawAttendance, [], {
  attendanceAvailable: true,
  financeAvailable: true,
  packageCycleReady: true,
  packageCycleStudentStates: states,
  packageCycleContributions: contributions,
})
assert.equal(rows.find((row) => row.student.id === 'student-historical').attendanceTuitionPreview.isMismatch, false)
assert.equal(rows.find((row) => row.student.id === 'student-current').attendanceTuitionPreview.difference, 2)
assert.equal(rows.find((row) => row.student.id === 'student-rollover').attendanceTuitionPreview.difference, -2)
assert.equal(rows.find((row) => row.student.id === 'student-no-package').attendanceTuitionPreview.hasCycleAuthority, false)
assert.equal(JSON.stringify(tuitionRecords), tuitionBefore, 'reconciliation must not mutate Tuition usedSessions')

const mainSource = read('src/main.js')
const boardSource = read('src/attendance-board-module.js')
const recordsSource = read('src/attendance-records.js')
const storageSource = read('src/storage.js')
const realtimeSource = read('src/cloud-attendance-realtime.js')
for (const forbidden of [
  'loadStoredAttendanceRecords', 'saveStoredAttendanceRecords',
  'loadAttendanceBaselineState', 'saveAttendanceBaselineState',
  'getStoredSessionReports', 'saveStoredSessionReports',
]) {
  assert(!mainSource.includes(forbidden), `main must not use browser Attendance helper ${forbidden}`)
  assert(!boardSource.includes(forbidden), `Attendance Board must not use ${forbidden}`)
  assert(!recordsSource.includes(forbidden), `Attendance domain must not expose ${forbidden}`)
  assert(!realtimeSource.includes(forbidden), `canonical realtime must not use ${forbidden}`)
  assert(!storageSource.includes(forbidden), `generic storage must not retain ${forbidden}`)
}
assert(mainSource.includes('projectC51AuthoritativeRecords'))
assert(mainSource.includes('applyC51AttendanceProjection'))
assert(mainSource.includes('inventoryLegacyAttendanceBrowserData'))
assert(!mainSource.includes('cleanupLegacyDatasetLocalResidue'))

const css = read('src/attendance-v2-8p2-theme.css')
assert(css.includes('white-space: nowrap;'))
assert(css.includes('min-width: 240px;'))
assert(css.includes('min-width: 190px;'))
assert(css.includes('min-width: 100px;'))
assert(css.includes('grid-template-columns: minmax(0, 1fr) auto;'))
assert(boardSource.includes("const buttonLabel = hasNote ? 'Sửa' : 'Ghi chú'"))
assert(boardSource.includes('aria-label="${escapeAttribute(accessibleLabel)}"'))

console.log('Attendance canonicalization + cycle-scoped reconciliation smoke: PASS')
