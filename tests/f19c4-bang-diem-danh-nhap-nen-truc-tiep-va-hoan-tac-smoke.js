import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildAttendanceBoardRows,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  createInitialBaselineEditSnapshot,
  getBaselineEditableDateRange,
  isDateInBaselineEditableRange,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  parseInitialBaselineCellInput,
  removeInitialBaselineAttendanceRecord,
  restoreInitialBaselineEditSnapshot,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
  startAttendanceBaselineDraft,
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
const student = {
  ...dataset.students[0],
  id: 'f19c4-baseline-student',
  studentCode: 'F19C4',
  fullName: 'Học viên kiểm thử F19C4',
  classSessionIds: [dataset.classSessions[0].id],
}
const students = [student, ...dataset.students]
const renderFilters = { month: '2026-06', classSessionId: 'all', query: student.fullName }
const initialHtml = renderAttendanceBoardModule(
  students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  renderFilters,
)
assert(!initialHtml.includes('<h3>Bảng điểm danh</h3>'), 'Inner duplicate board title should be removed')
assert(initialHtml.includes('attendance-board-toolbar'))
assert(initialHtml.includes('Tổng học viên'))
assert(initialHtml.includes('Dữ liệu nền điểm danh'))
assert(initialHtml.includes('Hoàn tác nhập gần nhất'))
assert(!initialHtml.includes('attendance-baseline-form'), 'Large F19C.3 baseline form should be removed')
assert(initialHtml.includes('data-attendance-baseline-action="save"'))
assert(initialHtml.includes('data-attendance-baseline-action="cancel"'))
assert(initialHtml.includes('data-attendance-baseline-action="clear"'))
assert(!initialHtml.includes('data-attendance-baseline-field="studentId"'))
assert(!initialHtml.includes('data-attendance-baseline-cell-input'), 'NotStarted state should not render editable cells')

const editableRange = getBaselineEditableDateRange(new Date('2026-06-19T12:00:00'))
assert.deepEqual(editableRange, { startDate: '2026-05-01', endDate: '2026-06-19' })
assert.equal(isDateInBaselineEditableRange('2026-05-01', new Date('2026-06-19T12:00:00')), true)
assert.equal(isDateInBaselineEditableRange('2026-06-19', new Date('2026-06-19T12:00:00')), true)
assert.equal(isDateInBaselineEditableRange('2026-04-30', new Date('2026-06-19T12:00:00')), false)
assert.equal(isDateInBaselineEditableRange('2026-06-20', new Date('2026-06-19T12:00:00')), false)

const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
})
saveAttendanceBaselineState('dreamhome', draftState)
const draftHtml = renderAttendanceBoardModule(
  students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  renderFilters,
)
assert(draftHtml.includes('data-attendance-baseline-cell-input'), 'Draft state should render editable baseline cells in range')

const oneParse = parseInitialBaselineCellInput('1')
assert.equal(oneParse.valid, true)
assert.equal(oneParse.action, 'upsert')
assert.equal(oneParse.input.attendanceStatus, 'present')
assert.equal(oneParse.input.counted, true)
assert.equal(oneParse.input.creditValue, 1)

const multiParse = parseInitialBaselineCellInput('3+4')
assert.equal(multiParse.valid, true)
assert.equal(multiParse.input.creditValue, 2)
assert.deepEqual(
  multiParse.input.raw.attendanceItem.credits.map((credit) => credit.sessionNumber),
  [3, 4],
)

assert.equal(parseInitialBaselineCellInput('T').input.attendanceStatus, 'trial')
assert.equal(parseInitialBaselineCellInput('T').input.counted, false)
assert.equal(parseInitialBaselineCellInput('V').input.attendanceStatus, 'absent')
assert.equal(parseInitialBaselineCellInput('P').input.attendanceStatus, 'excused')
assert.equal(parseInitialBaselineCellInput('CP').input.attendanceStatus, 'excused')
assert.equal(parseInitialBaselineCellInput('B').input.attendanceStatus, 'makeup')
assert.equal(parseInitialBaselineCellInput('B').input.counted, true)
assert.equal(parseInitialBaselineCellInput('-').action, 'delete')
assert.equal(parseInitialBaselineCellInput('').action, 'delete')
assert.equal(parseInitialBaselineCellInput('abc').valid, false)

const sessionReportsSnapshot = JSON.stringify(dataset.sessionReports)
const beforeEditSnapshot = createInitialBaselineEditSnapshot(
  loadStoredAttendanceRecords('dreamhome'),
  loadAttendanceBaselineState('dreamhome'),
)
const upsertResult = upsertInitialBaselineAttendanceRecord({
  records: beforeEditSnapshot.records,
  state: beforeEditSnapshot.state,
  input: {
    ...multiParse.input,
    studentId: student.id,
    date: '2026-06-19',
  },
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:05:00.000Z',
})
saveStoredAttendanceRecords('dreamhome', upsertResult.records)
saveAttendanceBaselineState('dreamhome', upsertResult.state)
assert.equal(JSON.stringify(dataset.sessionReports), sessionReportsSnapshot, 'Inline baseline edit must not mutate sessionReports')

let rows = buildAttendanceBoardRows(
  students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  renderFilters,
  [],
  loadStoredAttendanceRecords('dreamhome'),
)
let row = rows.find((candidate) => candidate.student.id === student.id)
let attendance = row.attendanceSummary.byDate.get('2026-06-19')
assert(attendance, 'Board should read inline baseline edit through unified read path')
assert.equal(attendance.source, 'initialBaseline')
assert.equal(attendance.displayValue, '3+4')
assert.deepEqual(
  attendance.credits.map((credit) => credit.sessionNumber),
  [3, 4],
  'Multi-credit baseline edit should stay one cell with multiple credits',
)

const updateResult = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: loadAttendanceBaselineState('dreamhome'),
  input: {
    ...oneParse.input,
    studentId: student.id,
    date: '2026-06-19',
  },
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:10:00.000Z',
})
assert.equal(updateResult.records.filter((record) => record.source === 'initialBaseline').length, 1)
saveStoredAttendanceRecords('dreamhome', updateResult.records)
saveAttendanceBaselineState('dreamhome', updateResult.state)

const removeResult = removeInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: loadAttendanceBaselineState('dreamhome'),
  studentId: student.id,
  date: '2026-06-19',
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:15:00.000Z',
})
assert.equal(removeResult.records.some((record) =>
  record.source === 'initialBaseline' && record.studentId === student.id && record.date === '2026-06-19',
), false)
saveStoredAttendanceRecords('dreamhome', removeResult.records)
saveAttendanceBaselineState('dreamhome', removeResult.state)

const restored = restoreInitialBaselineEditSnapshot(beforeEditSnapshot)
saveStoredAttendanceRecords('dreamhome', restored.records)
saveAttendanceBaselineState('dreamhome', restored.state)
assert.equal(loadStoredAttendanceRecords('dreamhome').length, 0, 'Undo snapshot should restore records before last edit')
assert.equal(loadAttendanceBaselineState('dreamhome').auditLog.at(-1).action, 'undoBaselineEdit')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
assert(mainSource.includes('parseInitialBaselineCellInput'))
assert(mainSource.includes('restoreInitialBaselineEditSnapshot'))
assert(mainSource.includes('Ô này nằm ngoài khoảng ngày cho phép nhập dữ liệu nền.'))
assert(recordsSource.includes('1-99'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.4 bảng điểm danh nhập nền trực tiếp và hoàn tác smoke passed')
