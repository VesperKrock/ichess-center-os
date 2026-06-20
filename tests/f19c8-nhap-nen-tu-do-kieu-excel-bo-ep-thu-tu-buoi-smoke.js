import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  buildUnifiedAttendanceRecords,
  clearInitialBaselineAttendanceRecordsInMonth,
  loadAttendanceBaselineState,
  parseInitialBaselineCellInput,
  saveAttendanceBaselineState,
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
  assert.equal(parsedInput.valid, true, `${value} should parse as valid Excel-style baseline input`)
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

globalThis.localStorage = createLocalStorageMock()

for (const value of ['1', '8', '99', '3+4', '1+3', '2+2', 'T', 'V', 'P', 'CP', 'B', '', '-']) {
  assert.equal(parseInitialBaselineCellInput(value).valid, true, `${value} should be valid`)
}

for (const value of ['abc', '??', '1a', '1++2', '1+a', '1.5', '0.5', '-3', '0', '100', '999']) {
  assert.equal(parseInitialBaselineCellInput(value).valid, false, `${value} should be invalid format`)
}

const state = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
})
const studentId = 'student-f19c8-free-excel'
let result = upsertBaseline([], state, studentId, '2026-06-01', '1')
result = upsertBaseline(result.records, result.state, studentId, '2026-06-02', '3')
result = upsertBaseline(result.records, result.state, studentId, '2026-06-03', '1+3')
result = upsertBaseline(result.records, result.state, studentId, '2026-06-04', '2')
result = upsertBaseline(result.records, result.state, studentId, '2026-06-05', '2')

const freeRecords = buildUnifiedAttendanceRecords({
  sessionReports: [],
  storedRecords: result.records,
})
assert.equal(freeRecords.some((record) => record.creditLabel === '1+3'), true)
assert.equal(
  freeRecords.filter((record) => record.studentId === studentId && record.creditNumber === 2).length >= 2,
  true,
  'Duplicate credit numbers should be preserved when format is valid',
)

const multiRecord = result.records.find((record) => record.date === '2026-06-03')
assert.equal(multiRecord.creditLabel, '1+3')
assert.deepEqual(
  multiRecord.raw.attendanceItem.credits.map((credit) => credit.sessionNumber),
  [1, 3],
  'Non-continuous multi-number input should be preserved as typed',
)

const dataset = buildAngelWingsRealDataset()
const sourceReportsSnapshot = JSON.stringify(dataset.sessionReports)
const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
})
saveAttendanceBaselineState('dreamhome', draftState)
const student = {
  ...dataset.students[0],
  id: studentId,
  fullName: 'Học viên nhập nền tự do F19C8',
  classSessionIds: [dataset.classSessions[0].id],
}
const html = renderAttendanceBoardModule(
  [student],
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  true,
  result.records,
  5,
)
assert(html.includes('5 thay đổi chưa lưu'))
assert(html.includes('value="1+3"'))
assert(!html.includes('data-next-credit-suggestion'))
assert(!html.includes('Gợi ý: buổi tiếp theo'))

const clearResult = clearInitialBaselineAttendanceRecordsInMonth({
  records: [
    ...result.records,
    {
      id: 'imported-f19c8',
      source: 'imported',
      studentId,
      date: '2026-06-06',
      attendanceStatus: 'present',
      status: 'present',
      counted: true,
      creditNumber: 8,
      creditLabel: '8',
      creditValue: 1,
    },
  ],
  state,
  month: '2026-06',
})
assert.equal(clearResult.records.some((record) => record.source === 'initialBaseline'), false)
assert.equal(clearResult.records.some((record) => record.source === 'imported'), true)
assert.equal(JSON.stringify(dataset.sessionReports), sourceReportsSnapshot, 'F19C.8 must not mutate sessionReports')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const boardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
assert(!mainSource.includes('validateStudentAttendanceCreditSequence'))
assert(!mainSource.includes('validateAttendanceBaselineRecords'))
assert(!mainSource.includes('expectedCreditNumber'))
assert(!mainSource.includes('buổi tiếp theo là'))
assert(mainSource.includes('attendanceBaselineDraftRecords = result.records'))
assert(mainSource.includes('data-attendance-baseline-action="save"'))
assert(mainSource.includes('data-attendance-baseline-action="cancel"'))
assert(mainSource.includes('data-attendance-baseline-action="clear"'))
assert(!boardSource.includes('data-next-credit-suggestion'))
assert(!boardSource.includes('Gợi ý: buổi tiếp theo'))
assert(recordsSource.includes('creditNumber > 99'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.8 nhập nền tự do kiểu Excel bỏ ép thứ tự buổi smoke passed')
