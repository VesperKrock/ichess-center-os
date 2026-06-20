import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  clearInitialBaselineAttendanceRecordsInMonth,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  parseInitialBaselineCellInput,
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

function upsertBaseline(records, state, studentId, date, value) {
  const parsedInput = parseInitialBaselineCellInput(value)
  assert.equal(parsedInput.valid, true)
  const result = upsertInitialBaselineAttendanceRecord({
    records,
    state,
    input: {
      ...parsedInput.input,
      studentId,
      date,
    },
    byRole: 'admin',
    byName: 'Admin cơ sở',
    at: `${date}T08:00:00.000Z`,
  })

  assert.equal(result.blocked, false)
  return result
}

const storage = createLocalStorageMock()
globalThis.localStorage = storage

const dataset = buildAngelWingsRealDataset()
const student = {
  ...dataset.students[0],
  id: 'student-f19c7-draft',
  fullName: 'Học viên draft F19C7',
  classSessionIds: [dataset.classSessions[0].id],
}
const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
})
saveAttendanceBaselineState('dreamhome', draftState)

const baseHtml = renderAttendanceBoardModule(
  [student],
  dataset.classSessions,
  dataset.tuitionRecords,
  [],
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  null,
  0,
)
assert(baseHtml.includes('Không có thay đổi chưa lưu'))
assert(baseHtml.includes('data-attendance-baseline-action="save" disabled'))
assert(baseHtml.includes('data-attendance-baseline-action="cancel" disabled'))
assert(baseHtml.includes('data-attendance-baseline-action="clear"'))

const recordsKey = 'ichessCenterOS.attendanceRecords.dreamhome'
assert.equal(storage.values.has(recordsKey), false, 'Rendering draft toolbar must not write records storage')

let draftResult = upsertBaseline([], draftState, student.id, '2026-06-02', '1')
const draftRecords = draftResult.records
const draftHtml = renderAttendanceBoardModule(
  [student],
  dataset.classSessions,
  dataset.tuitionRecords,
  [],
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  true,
  draftRecords,
  1,
)
assert(draftHtml.includes('1 thay đổi chưa lưu'))
assert(!draftHtml.includes('data-attendance-baseline-action="save" disabled'))
assert(!draftHtml.includes('data-attendance-baseline-action="cancel" disabled'))
assert(draftHtml.includes('value="1"'), 'Draft records should render as overlay before save')
assert.equal(storage.values.has(recordsKey), false, 'Draft overlay must not write localStorage before explicit save')

saveStoredAttendanceRecords('dreamhome', draftRecords)
assert(loadStoredAttendanceRecords('dreamhome').some((record) => record.source === 'initialBaseline'))

const storedState = loadAttendanceBaselineState('dreamhome')
let mixedRecords = loadStoredAttendanceRecords('dreamhome')
mixedRecords = upsertBaseline(mixedRecords, storedState, student.id, '2026-05-30', '2').records
mixedRecords.push({
  id: 'imported-f19c7-2026-06',
  source: 'imported',
  studentId: student.id,
  date: '2026-06-03',
  attendanceStatus: 'present',
  status: 'present',
  counted: true,
  creditNumber: 3,
  creditLabel: '3',
  creditValue: 1,
})
const clearResult = clearInitialBaselineAttendanceRecordsInMonth({
  records: mixedRecords,
  state: storedState,
  month: '2026-06',
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:30:00.000Z',
})
assert.equal(clearResult.blocked, false)
assert.equal(
  clearResult.records.some((record) => record.source === 'initialBaseline' && record.date.startsWith('2026-06')),
  false,
  'Clear should remove only June initialBaseline records',
)
assert.equal(
  clearResult.records.some((record) => record.source === 'initialBaseline' && record.date.startsWith('2026-05')),
  true,
  'Clear should keep baseline records outside current month',
)
assert.equal(
  clearResult.records.some((record) => record.source === 'imported' && record.date.startsWith('2026-06')),
  true,
  'Clear must not remove imported records',
)
assert.equal(clearResult.state.auditLog.at(-1).action, 'clearBaselineRecords')

const sourceReportsSnapshot = JSON.stringify(dataset.sessionReports)
clearInitialBaselineAttendanceRecordsInMonth({
  records: mixedRecords,
  state: storedState,
  month: '2026-06',
})
assert.equal(JSON.stringify(dataset.sessionReports), sourceReportsSnapshot, 'Clear must not mutate sessionReports')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const boardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
const commitSource = mainSource.slice(
  mainSource.indexOf('function commitAttendanceBaselineCellInput'),
  mainSource.indexOf('function rememberPreservedScrollPositions'),
)
assert(commitSource.includes('attendanceBaselineDraftRecords = result.records'))
assert(!commitSource.includes('saveStoredAttendanceRecords'))
assert(mainSource.includes('data-attendance-baseline-action="save"'))
assert(mainSource.includes('data-attendance-baseline-action="cancel"'))
assert(mainSource.includes('data-attendance-baseline-action="clear"'))
assert(mainSource.includes('Bạn còn thay đổi dữ liệu nền chưa lưu'))
assert(mainSource.includes('restoreAttendanceBaselineDraftUndoSnapshot'))
assert(boardSource.includes('thay đổi chưa lưu'))
assert(boardSource.includes('Lưu thay đổi'))
assert(boardSource.includes('Hủy thay đổi'))
assert(boardSource.includes('Xóa dữ liệu nền đang nhập'))
assert(recordsSource.includes('clearInitialBaselineAttendanceRecordsInMonth'))
assert(recordsSource.includes('saveBaselineDraft'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.7 draft nhập nền, xóa dữ liệu nền và hủy thay đổi smoke passed')
