import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  buildUnifiedAttendanceRecords,
  getNextAttendanceCreditNumber,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  parseInitialBaselineCellInput,
  removeInitialBaselineAttendanceRecord,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
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

const storage = createLocalStorageMock()
globalThis.localStorage = storage

const dataset = buildAngelWingsRealDataset()
const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-19T08:00:00.000Z',
})
saveAttendanceBaselineState('dreamhome', draftState)

const draftHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)
assert(draftHtml.includes('data-attendance-baseline-cell-input'), 'Draft board should render editable baseline cells')
assert(draftHtml.includes('data-row-index="0"'), 'Editable cells should carry row index for keyboard navigation')
assert(draftHtml.includes('data-column-index="'), 'Editable cells should carry column index for keyboard navigation')
assert(draftHtml.includes('has-source-record'), 'Cells backed by report/import data should still be editable for baseline override')

assert.equal(parseInitialBaselineCellInput(' t ').input.attendanceStatus, 'trial')
assert.equal(parseInitialBaselineCellInput('cp').input.attendanceStatus, 'excused')
assert.equal(parseInitialBaselineCellInput('b').input.attendanceStatus, 'makeup')
assert.equal(parseInitialBaselineCellInput('').action, 'delete')
assert.equal(parseInitialBaselineCellInput('-').action, 'delete')
assert.equal(parseInitialBaselineCellInput('1+2').valid, true)
assert.equal(parseInitialBaselineCellInput('1+3').valid, true, 'F19C.8 allows non-continuous multi-number cells')
assert.equal(parseInitialBaselineCellInput('1++2').valid, false)
assert.equal(parseInitialBaselineCellInput('0').valid, false)
assert.equal(parseInitialBaselineCellInput('abc').valid, false)

let records = []
let state = loadAttendanceBaselineState('dreamhome')
let result = upsertBaseline(records, state, 'student-sequence-ok', '2026-06-01', '1')
result = upsertBaseline(result.records, result.state, 'student-sequence-ok', '2026-06-03', '2')
assert.equal(validateStudentAttendanceCreditSequence(result.records, 'student-sequence-ok').valid, true)
assert.equal(getNextAttendanceCreditNumber(result.records, 'student-sequence-ok'), 3)

records = []
state = loadAttendanceBaselineState('dreamhome')
result = upsertBaseline(records, state, 'student-sequence-gap', '2026-06-01', '1')
result = upsertBaseline(result.records, result.state, 'student-sequence-gap', '2026-06-03', '3')
const gapValidation = validateStudentAttendanceCreditSequence(result.records, 'student-sequence-gap')
assert.equal(gapValidation.valid, false)
assert.equal(gapValidation.expectedCreditNumber, 2)
assert.equal(gapValidation.actualCreditNumber, 3)

records = []
state = loadAttendanceBaselineState('dreamhome')
result = upsertBaseline(records, state, 'student-sequence-multi', '2026-06-01', '1+2')
result = upsertBaseline(result.records, result.state, 'student-sequence-multi', '2026-06-05', '3')
assert.equal(validateStudentAttendanceCreditSequence(result.records, 'student-sequence-multi').valid, true)

records = []
state = loadAttendanceBaselineState('dreamhome')
result = upsertBaseline(records, state, 'student-sequence-blank-day', '2026-06-01', '1')
result = upsertBaseline(result.records, result.state, 'student-sequence-blank-day', '2026-06-05', '2')
assert.equal(validateStudentAttendanceCreditSequence(result.records, 'student-sequence-blank-day').valid, true)

records = []
state = loadAttendanceBaselineState('dreamhome')
result = upsertBaseline(records, state, 'student-sequence-duplicate', '2026-06-01', '1')
result = upsertBaseline(result.records, result.state, 'student-sequence-duplicate', '2026-06-02', '1')
const duplicateValidation = validateStudentAttendanceCreditSequence(result.records, 'student-sequence-duplicate')
assert.equal(duplicateValidation.valid, false)
assert.equal(duplicateValidation.expectedCreditNumber, 2)
assert.equal(duplicateValidation.actualCreditNumber, 1)

records = []
state = loadAttendanceBaselineState('dreamhome')
result = upsertBaseline(records, state, 'student-sequence-status', '2026-06-01', 'T')
result = upsertBaseline(result.records, result.state, 'student-sequence-status', '2026-06-02', 'V')
result = upsertBaseline(result.records, result.state, 'student-sequence-status', '2026-06-03', 'P')
result = upsertBaseline(result.records, result.state, 'student-sequence-status', '2026-06-04', 'CP')
result = upsertBaseline(result.records, result.state, 'student-sequence-status', '2026-06-05', 'B')
assert.equal(validateStudentAttendanceCreditSequence(result.records, 'student-sequence-status').valid, true)
assert.equal(getNextAttendanceCreditNumber(result.records, 'student-sequence-status'), 2)

const sourceReports = [{
  id: 'f19c5-source-report',
  sessionId: 'f19c5-source-session',
  occurrenceDate: '2026-06-10',
  sourceModule: 'schedule-report',
  attendance: [{
    studentId: 'student-override',
    attendanceStatus: 'present',
    displayValue: '1',
    creditNumber: 1,
    countsTowardTuition: true,
  }],
}]
const sourceReportsSnapshot = JSON.stringify(sourceReports)
result = upsertBaseline([], loadAttendanceBaselineState('dreamhome'), 'student-override', '2026-06-10', '1')
const unifiedOverrideRecords = buildUnifiedAttendanceRecords({
  sessionReports: sourceReports,
  storedRecords: result.records,
})
assert.equal(
  validateStudentAttendanceCreditSequence(unifiedOverrideRecords, 'student-override').valid,
  true,
  'Baseline override on the same date should replace source records for sequence validation',
)
assert.equal(JSON.stringify(sourceReports), sourceReportsSnapshot, 'Baseline override must not mutate sessionReports')

const deleteResult = removeInitialBaselineAttendanceRecord({
  records: result.records,
  state: result.state,
  studentId: 'student-override',
  date: '2026-06-10',
  byRole: 'admin',
  byName: 'Admin cơ sở',
  at: '2026-06-10T08:30:00.000Z',
})
assert.equal(deleteResult.records.some((record) => record.source === 'initialBaseline'), false)
assert.equal(JSON.stringify(sourceReports), sourceReportsSnapshot, 'Deleting baseline must not delete source attendance')

saveStoredAttendanceRecords('dreamhome', result.records)
assert(loadStoredAttendanceRecords('dreamhome').some((record) => record.source === 'initialBaseline'))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(!mainSource.includes('validateStudentAttendanceCreditSequence'))
assert(mainSource.includes('attendanceBaselineDraftRecords = result.records'))
assert(mainSource.includes('keydown'))
assert(mainSource.includes('ArrowLeft'))
assert(mainSource.includes('ArrowRight'))
assert(mainSource.includes('ArrowUp'))
assert(mainSource.includes('ArrowDown'))
assert(mainSource.includes("event.key === 'Tab'"))
assert(mainSource.includes('event.shiftKey'))
assert(mainSource.includes('pendingAttendanceBaselineCellFocus'))
assert(!mainSource.includes('saveStoredSessionReports(sessionReports, result.records)'))

console.log('F19C.5 nhập nền kiểm thứ tự buổi và bàn phím smoke passed')
