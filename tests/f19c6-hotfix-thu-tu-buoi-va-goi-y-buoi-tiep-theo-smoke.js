import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  buildUnifiedAttendanceRecords,
  getLastAttendanceCreditNumber,
  getNextAttendanceCreditNumber,
  loadAttendanceBaselineState,
  parseInitialBaselineCellInput,
  removeInitialBaselineAttendanceRecord,
  saveAttendanceBaselineState,
  startAttendanceBaselineDraft,
  upsertInitialBaselineAttendanceRecord,
  validateStudentAttendanceCreditSequence,
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

function createDisplayValueReport(studentId, date, displayValue) {
  return {
    id: `f19c6-report-${studentId}-${date}`,
    sessionId: `f19c6-session-${date}`,
    occurrenceDate: date,
    sourceModule: 'schedule-report',
    attendance: [{
      studentId,
      attendanceStatus: 'present',
      displayValue,
      countsTowardTuition: true,
    }],
  }
}

function createCreditReports(studentId, creditNumbers, startDay = 1) {
  return creditNumbers.map((creditNumber, index) =>
    createDisplayValueReport(
      studentId,
      `2026-05-${String(startDay + index).padStart(2, '0')}`,
      String(creditNumber),
    ),
  )
}

function upsertBaseline(records, state, studentId, date, value) {
  const parsedInput = parseInitialBaselineCellInput(value)
  assert.equal(parsedInput.valid, true, `${value} should parse`)
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

const sevenCreditStudentId = 'student-f19c6-seven-existing'
const sevenCreditReports = createCreditReports(sevenCreditStudentId, [1, 2, 3, 4, 5, 6, 7])
let state = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
})
let result = upsertBaseline([], state, sevenCreditStudentId, '2026-06-08', '8')
let unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: sevenCreditReports,
  storedRecords: result.records,
})
let validation = validateStudentAttendanceCreditSequence(unifiedRecords, sevenCreditStudentId)
assert.equal(validation.valid, true, 'Existing rendered 1-7 plus baseline 8 should be valid')
assert.notEqual(validation.expectedCreditNumber, 1, 'Validator must not ask for next credit 1 after rendered 1-7')
assert.equal(getLastAttendanceCreditNumber(unifiedRecords, sevenCreditStudentId), 8)
assert.equal(getNextAttendanceCreditNumber(unifiedRecords, sevenCreditStudentId), 9)

const oneThenThreeStudentId = 'student-f19c6-one-then-three'
result = upsertBaseline([], state, oneThenThreeStudentId, '2026-06-03', '3')
unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: createCreditReports(oneThenThreeStudentId, [1]),
  storedRecords: result.records,
})
validation = validateStudentAttendanceCreditSequence(unifiedRecords, oneThenThreeStudentId)
assert.equal(validation.valid, false, '1 then 3 should still be hard-blocked')
assert.equal(validation.expectedCreditNumber, 2)
assert.equal(validation.actualCreditNumber, 3)

const multiStudentId = 'student-f19c6-multi'
const multiReports = [createDisplayValueReport(multiStudentId, '2026-05-01', '1+2')]
result = upsertBaseline([], state, multiStudentId, '2026-06-03', '3')
unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: multiReports,
  storedRecords: result.records,
})
assert.equal(validateStudentAttendanceCreditSequence(unifiedRecords, multiStudentId).valid, true)
assert.equal(getLastAttendanceCreditNumber(unifiedRecords, multiStudentId), 3)

const blankDayStudentId = 'student-f19c6-blank-day'
result = upsertBaseline([], state, blankDayStudentId, '2026-06-06', '2')
unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: createCreditReports(blankDayStudentId, [1]),
  storedRecords: result.records,
})
assert.equal(validateStudentAttendanceCreditSequence(unifiedRecords, blankDayStudentId).valid, true)

assert.equal(parseInitialBaselineCellInput('1+3').valid, true, 'F19C.8 allows 1+3 as Excel-style input')

const duplicateStudentId = 'student-f19c6-duplicate'
result = upsertBaseline([], state, duplicateStudentId, '2026-06-02', '2')
unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: createCreditReports(duplicateStudentId, [1, 2]),
  storedRecords: result.records,
})
validation = validateStudentAttendanceCreditSequence(unifiedRecords, duplicateStudentId)
assert.equal(validation.valid, false, 'Duplicate 2 should still be hard-blocked for clean existing data')
assert.equal(validation.expectedCreditNumber, 3)
assert.equal(validation.actualCreditNumber, 2)

const nextFourStudentId = 'student-f19c6-next-four'
const nextFourRecords = buildUnifiedAttendanceRecords({
  sessionReports: createCreditReports(nextFourStudentId, [1, 2, 3, 4]),
  storedRecords: [],
})
assert.equal(getLastAttendanceCreditNumber(nextFourRecords, nextFourStudentId), 4)
assert.equal(getNextAttendanceCreditNumber(nextFourRecords, nextFourStudentId), 5)

const sourceReports = createCreditReports('student-f19c6-source', [1, 2, 3, 4, 5, 6, 7])
const sourceReportsSnapshot = JSON.stringify(sourceReports)
result = upsertBaseline([], state, 'student-f19c6-source', '2026-06-08', '8')
assert.equal(JSON.stringify(sourceReports), sourceReportsSnapshot, 'Baseline upsert must not mutate sessionReports')
const deleteResult = removeInitialBaselineAttendanceRecord({
  records: result.records,
  state: result.state,
  studentId: 'student-f19c6-source',
  date: '2026-06-08',
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-08T08:30:00.000Z',
})
assert.equal(deleteResult.records.length, 0)
assert.equal(JSON.stringify(sourceReports), sourceReportsSnapshot, 'Deleting baseline must not delete source reports')

const dataset = buildAngelWingsRealDataset()
const suggestionStudent = {
  ...dataset.students[0],
  id: nextFourStudentId,
  fullName: 'Học viên gợi ý F19C6',
  classSessionIds: [dataset.classSessions[0].id],
}
saveAttendanceBaselineState('dreamhome', state)
const suggestionHtml = renderAttendanceBoardModule(
  [suggestionStudent],
  dataset.classSessions,
  dataset.tuitionRecords,
  createCreditReports(nextFourStudentId, [1, 2, 3, 4]),
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)
assert(!suggestionHtml.includes('data-next-credit-suggestion="5"'))
assert(!suggestionHtml.includes('Gợi ý: buổi tiếp theo 5'))
assert(!suggestionHtml.includes('source: "initialBaseline"'), 'Suggestion must not be stored as data')

const suggestionSevenHtml = renderAttendanceBoardModule(
  [suggestionStudent],
  dataset.classSessions,
  dataset.tuitionRecords,
  sevenCreditReports.map((report) => ({
    ...report,
    attendance: report.attendance.map((item) => ({ ...item, studentId: nextFourStudentId })),
  })),
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)
assert(!suggestionSevenHtml.includes('data-next-credit-suggestion="8"'))
assert(!suggestionSevenHtml.includes('Gợi ý: buổi tiếp theo 8'))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
const boardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
assert(!mainSource.includes('existingSequenceValidation.valid'))
assert(mainSource.includes('keydown'))
assert(mainSource.includes('ArrowLeft') && mainSource.includes('ArrowRight'))
assert(mainSource.includes('ArrowUp') && mainSource.includes('ArrowDown'))
assert(recordsSource.includes('getAttendanceItemDisplayedCreditNumbers'))
assert(recordsSource.includes('parseCreditNumbersFromText'))
assert(!boardSource.includes('data-next-credit-suggestion'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.6 hotfix thứ tự buổi và gợi ý buổi tiếp theo smoke passed')
