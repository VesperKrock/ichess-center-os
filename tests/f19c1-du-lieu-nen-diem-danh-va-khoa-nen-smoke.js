import assert from 'node:assert/strict'

import {
  buildAttendanceRecordsFromSessionReports,
  buildUnifiedAttendanceRecords,
  createAttendanceBaselineAuditEntry,
  createInitialBaselineAttendanceRecord,
  getAttendanceBaselineStateStorageKey,
  getAttendanceRecordsStorageKey,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  normalizeAttendanceBaselineState,
  normalizeStoredAttendanceRecord,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
} from '../src/attendance-records.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'

function createLocalStorageMock() {
  const values = new Map()

  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

const storage = createLocalStorageMock()
globalThis.localStorage = storage

const recordsKey = getAttendanceRecordsStorageKey('dreamhome')
const stateKey = getAttendanceBaselineStateStorageKey('dreamhome')
assert.equal(recordsKey, 'ichessCenterOS.attendanceRecords.dreamhome')
assert.equal(stateKey, 'ichessCenterOS.attendanceBaselineState.dreamhome')

const defaultState = loadAttendanceBaselineState('dreamhome')
assert.equal(defaultState.status, 'notStarted', 'Default baseline state should be safe')
assert.deepEqual(defaultState.auditLog, [])
assert.equal(storage.values.has(stateKey), false, 'Loading default state must not write storage')

const lockAuditEntry = createAttendanceBaselineAuditEntry('lockBaseline', {
  id: 'audit-khoa-nen-001',
  at: '2026-06-19T08:00:00.000Z',
  byRole: 'admin',
  byName: 'Quản trị viên',
  reason: 'Chốt dữ liệu nền sau khi kiểm tra.',
  note: 'Khóa dữ liệu nền điểm danh ban đầu.',
})
assert.equal(lockAuditEntry.action, 'lockBaseline')
assert.equal(lockAuditEntry.reason, 'Chốt dữ liệu nền sau khi kiểm tra.')

const draftState = saveAttendanceBaselineState('dreamhome', {
  status: 'draft',
  lastActionAt: '2026-06-19T07:30:00.000Z',
  lastActionBy: 'Quản trị viên',
  note: 'Đang nhập dữ liệu nền.',
  auditLog: [
    createAttendanceBaselineAuditEntry('startBaseline', {
      id: 'audit-nhap-nen-001',
      at: '2026-06-19T07:30:00.000Z',
      byRole: 'admin',
      byName: 'Quản trị viên',
      note: 'Bắt đầu nhập dữ liệu nền.',
    }),
  ],
})
assert.equal(draftState.status, 'draft')
assert.equal(loadAttendanceBaselineState('dreamhome').status, 'draft')

const lockedState = saveAttendanceBaselineState('dreamhome', {
  ...draftState,
  status: 'locked',
  lockedAt: '2026-06-19T08:00:00.000Z',
  lockedBy: 'Quản trị viên',
  lastActionAt: '2026-06-19T08:00:00.000Z',
  lastActionBy: 'Quản trị viên',
  auditLog: [...draftState.auditLog, lockAuditEntry],
})
assert.equal(lockedState.status, 'locked')
assert.equal(lockedState.auditLog.length, 2)
assert.equal(loadAttendanceBaselineState('dreamhome').lockedBy, 'Quản trị viên')

const unlockedState = normalizeAttendanceBaselineState({
  status: 'unlocked',
  unlockedAt: '2026-06-19T09:00:00.000Z',
  unlockedBy: 'Quản trị viên',
  unlockReason: 'Cần sửa số buổi nền cho một học viên.',
  auditLog: [
    createAttendanceBaselineAuditEntry('unlockBaseline', {
      id: 'audit-mo-khoa-001',
      at: '2026-06-19T09:00:00.000Z',
      byRole: 'admin',
      byName: 'Quản trị viên',
      reason: 'Cần sửa số buổi nền cho một học viên.',
    }),
  ],
})
assert.equal(unlockedState.status, 'unlocked')
assert.equal(unlockedState.auditLog[0].action, 'unlockBaseline')

const baselineInput = {
  id: 'baseline-student-001-2026-06-01',
  studentId: 'student-001',
  date: '2026-06-01',
  status: 'present',
  attendanceStatus: 'present',
  source: 'teacher',
  note: 'Bé đã học 5/8 buổi trước khi nhập app.',
  creditValue: 1,
  createdAt: '2026-06-19T07:40:00.000Z',
  updatedAt: '2026-06-19T07:45:00.000Z',
}
const baselineSnapshot = JSON.stringify(baselineInput)
const baselineRecord = createInitialBaselineAttendanceRecord(baselineInput)
assert.equal(JSON.stringify(baselineInput), baselineSnapshot, 'Baseline helper must not mutate input')
assert.equal(baselineRecord.source, 'initialBaseline')
assert.equal(baselineRecord.studentId, 'student-001')
assert.equal(baselineRecord.date, '2026-06-01')
assert.equal(baselineRecord.status, 'present')
assert.equal(baselineRecord.attendanceStatus, 'present')
assert.equal(baselineRecord.note, 'Bé đã học 5/8 buổi trước khi nhập app.')
assert.equal(baselineRecord.creditValue, 1)
assert.equal(baselineRecord.createdAt, '2026-06-19T07:40:00.000Z')
assert.equal(baselineRecord.updatedAt, '2026-06-19T07:45:00.000Z')

const invalidRecord = normalizeStoredAttendanceRecord({
  id: 'invalid-missing-student',
  date: '2026-06-01',
  attendanceStatus: 'present',
})
assert.equal(invalidRecord, null, 'Invalid records without studentId should be skipped safely')
assert.equal(normalizeStoredAttendanceRecord(null), null, 'Null stored record should not crash')

const savedRecords = saveStoredAttendanceRecords('dreamhome', [
  baselineRecord,
  {
    id: 'invalid-missing-date',
    studentId: 'student-002',
    attendanceStatus: 'present',
  },
])
assert.equal(savedRecords.length, 1)
assert.equal(savedRecords[0].source, 'initialBaseline')
const loadedRecords = loadStoredAttendanceRecords('dreamhome')
assert.equal(loadedRecords.length, 1)
assert.equal(loadedRecords[0].studentId, 'student-001')
assert.equal(loadedRecords[0].note, 'Bé đã học 5/8 buổi trước khi nhập app.')

storage.values.clear()
storage.setItem('ichessCenterOS.sessionReports.dreamhome', JSON.stringify([{ id: 'report-cu' }]))
assert.deepEqual(loadStoredAttendanceRecords('dreamhome'), [], 'Loading stored records must not migrate sessionReports')
assert.equal(storage.values.has(recordsKey), false, 'Loading stored records must not backfill attendanceRecords')

const dataset = buildAngelWingsRealDataset()
const sessionReports = JSON.parse(JSON.stringify(dataset.sessionReports))
const sessionReportsSnapshot = JSON.stringify(sessionReports)
const adapterRecords = buildAttendanceRecordsFromSessionReports(sessionReports)
const baselineForUnified = createInitialBaselineAttendanceRecord({
  id: 'baseline-unified-001',
  studentId: dataset.students[0].id,
  date: '2026-05-31',
  attendanceStatus: 'present',
  note: 'Dữ liệu nền trước khi dùng app.',
})
const storageBeforeUnified = JSON.stringify(Array.from(storage.values.entries()))
const unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports,
  storedRecords: [baselineForUnified],
})
assert.equal(JSON.stringify(sessionReports), sessionReportsSnapshot, 'Unified read-model must not mutate sessionReports')
assert.equal(
  JSON.stringify(Array.from(storage.values.entries())),
  storageBeforeUnified,
  'Unified read-model must not write localStorage',
)
assert(
  unifiedRecords.some((record) => record.id === adapterRecords[0].id),
  'Unified read-model should include adapter records from sessionReports',
)
assert(
  unifiedRecords.some((record) => record.id === baselineForUnified.id && record.source === 'initialBaseline'),
  'Unified read-model should include stored baseline records',
)

const correctionRecord = normalizeStoredAttendanceRecord({
  ...adapterRecords[0],
  id: 'correction-overrides-source-record',
  source: 'correction',
  note: 'Sửa sau khóa, giữ cùng sourceReportId/sourceAttendanceIndex.',
})
const overriddenRecords = buildUnifiedAttendanceRecords({
  sessionReports: [sessionReports[0]],
  storedRecords: [correctionRecord],
})
assert(
  overriddenRecords.some((record) => record.id === 'correction-overrides-source-record'),
  'Stored record with the same sourceReportId/sourceAttendanceIndex should override adapter record',
)
assert(
  !overriddenRecords.some((record) => record.id === adapterRecords[0].id),
  'Overridden adapter record should not be duplicated',
)

console.log('F19C.1 dữ liệu nền điểm danh và khóa nền smoke passed')
