import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildAttendanceBoardRows,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  getAttendanceBaselineStateStorageKey,
  getAttendanceRecordsStorageKey,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  lockAttendanceBaselineState,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
  startAttendanceBaselineDraft,
  unlockAttendanceBaselineState,
  upsertInitialBaselineAttendanceRecord,
} from '../src/attendance-records.js'

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

const dataset = buildAngelWingsRealDataset()
const student = dataset.students[0]
const recordsKey = getAttendanceRecordsStorageKey('dreamhome')
const stateKey = getAttendanceBaselineStateStorageKey('dreamhome')
const initialHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: student.fullName },
)
assert(initialHtml.includes('Dữ liệu nền điểm danh'))
assert(initialHtml.includes('Chưa khởi tạo'))
assert(initialHtml.includes('Bắt đầu nhập dữ liệu nền'))
assert(initialHtml.includes('Chốt dữ liệu nền'))
assert(initialHtml.includes('Mở khóa dữ liệu nền'))
assert(initialHtml.includes('data-attendance-baseline-action="save"'))
assert(initialHtml.includes('data-attendance-baseline-action="cancel"'))
assert(initialHtml.includes('data-attendance-baseline-action="clear"'))
assert(!initialHtml.includes('data-attendance-baseline-field="studentId"'))
assert.equal(storage.values.has(recordsKey), false, 'Rendering baseline toolbar must not create records storage')
assert.equal(storage.values.has(stateKey), false, 'Rendering baseline toolbar must not create baseline state storage')

const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
  note: 'Bắt đầu nhập dữ liệu nền điểm danh.',
})
saveAttendanceBaselineState('dreamhome', draftState)
assert.equal(loadAttendanceBaselineState('dreamhome').status, 'draft')
assert.equal(loadAttendanceBaselineState('dreamhome').auditLog[0].action, 'startBaseline')

const firstUpsert = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: loadAttendanceBaselineState('dreamhome'),
  input: {
    studentId: student.id,
    date: '2026-06-19',
    status: 'present',
    attendanceStatus: 'present',
    counted: true,
    creditValue: 1,
    creditNumber: 1,
    creditLabel: '1',
    note: 'Dữ liệu nền chuyển từ bảng cũ.',
  },
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:05:00.000Z',
})
assert.equal(firstUpsert.blocked, false)
assert.equal(firstUpsert.record.source, 'initialBaseline')
assert.equal(firstUpsert.record.studentId, student.id)
assert.equal(firstUpsert.record.date, '2026-06-19')
assert.equal(firstUpsert.record.counted, true)
assert.equal(firstUpsert.record.creditValue, 1)
assert.equal(firstUpsert.state.auditLog.at(-1).action, 'updateBaselineRecord')
saveStoredAttendanceRecords('dreamhome', firstUpsert.records)
saveAttendanceBaselineState('dreamhome', firstUpsert.state)

const secondUpsert = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: loadAttendanceBaselineState('dreamhome'),
  input: {
    studentId: student.id,
    date: '2026-06-19',
    status: 'makeup',
    attendanceStatus: 'makeup',
    counted: true,
    creditValue: 2,
    creditNumber: 2,
    creditLabel: '2',
    note: 'Cập nhật dữ liệu nền, không tạo trùng.',
  },
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:10:00.000Z',
})
assert.equal(secondUpsert.records.length, 1, 'Saving same student/date/source should update, not duplicate')
assert.equal(secondUpsert.record.id, firstUpsert.record.id)
assert.equal(secondUpsert.record.attendanceStatus, 'makeup')
assert.equal(secondUpsert.record.creditValue, 2)
saveStoredAttendanceRecords('dreamhome', secondUpsert.records)
saveAttendanceBaselineState('dreamhome', secondUpsert.state)

const lockedState = lockAttendanceBaselineState(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:15:00.000Z',
  note: 'Chốt dữ liệu nền điểm danh.',
})
saveAttendanceBaselineState('dreamhome', lockedState)
assert.equal(loadAttendanceBaselineState('dreamhome').status, 'locked')
assert.equal(loadAttendanceBaselineState('dreamhome').auditLog.at(-1).action, 'lockBaseline')

const blockedUpsert = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: loadAttendanceBaselineState('dreamhome'),
  input: {
    studentId: student.id,
    date: '2026-06-20',
    status: 'present',
    attendanceStatus: 'present',
    counted: true,
    creditValue: 1,
  },
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:20:00.000Z',
})
assert.equal(blockedUpsert.blocked, true, 'Locked baseline state should block saving baseline records')
assert.equal(blockedUpsert.reason, 'baselineLocked')

const lockedHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: student.fullName },
)
assert(lockedHtml.includes('Đã khóa dữ liệu nền'))
assert(lockedHtml.includes('Dữ liệu nền đã khóa, cần mở khóa trước khi chỉnh sửa.'))
assert(!lockedHtml.includes('data-attendance-baseline-cell-input'))

const unlockedState = unlockAttendanceBaselineState(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:25:00.000Z',
  reason: 'Cần sửa một bản ghi nền.',
  note: 'Mở khóa dữ liệu nền điểm danh.',
})
saveAttendanceBaselineState('dreamhome', unlockedState)
assert.equal(loadAttendanceBaselineState('dreamhome').status, 'unlocked')
assert.equal(loadAttendanceBaselineState('dreamhome').unlockReason, 'Cần sửa một bản ghi nền.')
assert.equal(loadAttendanceBaselineState('dreamhome').auditLog.at(-1).action, 'unlockBaseline')

const rows = buildAttendanceBoardRows(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: student.fullName },
  [],
  loadStoredAttendanceRecords('dreamhome'),
)
const row = rows.find((candidate) => candidate.student.id === student.id)
const attendance = row.attendanceSummary.byDate.get('2026-06-19')
assert(attendance, 'Board should read saved baseline record through unified read path')
assert.equal(attendance.source, 'initialBaseline')
assert.equal(attendance.note, 'Cập nhật dữ liệu nền, không tạo trùng.')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes('Bạn chắc chắn muốn chốt dữ liệu nền điểm danh?'))
assert(mainSource.includes('Hiện chưa có bản ghi dữ liệu nền nào. Bạn vẫn muốn khóa dữ liệu nền?'))
assert(mainSource.includes('Bạn chắc chắn muốn mở khóa dữ liệu điểm danh?'))
assert(mainSource.includes('Lý do mở khóa'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.3 nhập dữ liệu nền điểm danh và khóa/mở khóa smoke passed')
