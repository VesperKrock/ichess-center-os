import assert from 'node:assert/strict'

import { renderAttendanceBoardModule, parseClassSessionDayIndexes } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  buildSettingsClassSessionFromForm,
  createEmptySettingsClassSessionFormState,
  normalizeClassSessionDaysOfWeek,
  renderSettingsModule,
  validateSettingsClassSessionForm,
} from '../src/settings-module.js'
import {
  getStoredAttendanceBoardNotes,
  normalizeClassSessions,
  saveStoredAttendanceBoardNotes,
} from '../src/storage.js'

assert.deepEqual(normalizeClassSessionDaysOfWeek([], 'T4-T6'), ['wed', 'fri'])
assert.deepEqual(normalizeClassSessionDaysOfWeek([], 'T7-CN'), ['sat', 'sun'])
assert.deepEqual(parseClassSessionDayIndexes('T4-T6'), [3, 5])
assert.deepEqual(parseClassSessionDayIndexes('T7-CN'), [0, 6])

const emptyForm = createEmptySettingsClassSessionFormState()
const settingsHtml = renderSettingsModule([], [], {}, emptyForm)
assert(settingsHtml.includes('data-settings-class-session-day'), 'Module 10 form should render weekday checkboxes')
assert(settingsHtml.includes('value="mon"') && settingsHtml.includes('value="sun"'))
assert(validateSettingsClassSessionForm({ name: 'Ca mới', daysOfWeek: [], startTime: '18:00', endTime: '19:30' }).daysOfWeek)

const builtClassSession = buildSettingsClassSessionFromForm(
  {
    name: 'T2-T4-T6 18:00-19:30',
    daysOfWeek: ['mon', 'wed', 'fri'],
    startTime: '18:00',
    endTime: '19:30',
    status: 'active',
  },
  null,
  [],
)
assert.deepEqual(builtClassSession.daysOfWeek, ['mon', 'wed', 'fri'])
assert.equal(builtClassSession.daysLabel, 'T2-T4-T6')
assert(builtClassSession.displayLabel.includes('T2-T4-T6'))

const normalizedSessions = normalizeClassSessions([
  { id: 'wed-fri', name: 'T4-T6', daysLabel: 'T4-T6', startTime: '19:00', endTime: '20:30' },
])
assert.deepEqual(normalizedSessions[0].daysOfWeek, ['wed', 'fri'])

const student = {
  id: 'student-flex-days',
  fullName: 'Học viên test ngày linh hoạt',
  classSessionIds: ['wed-fri'],
}
const htmlWithoutThursday = renderAttendanceBoardModule(
  [student],
  normalizedSessions,
  [{ studentId: student.id, totalSessions: 8, usedSessions: 0, paidAmount: 1000000, totalAmount: 1000000 }],
  [],
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
)
assert(htmlWithoutThursday.includes('<span>T4</span>'), 'Wednesday columns should be visible')
assert(htmlWithoutThursday.includes('<span>T6</span>'), 'Friday columns should be visible')
assert(!htmlWithoutThursday.includes('<span>T5</span>'), 'Thursday columns should be hidden without active class or attendance')

const htmlWithRealThursdayAttendance = renderAttendanceBoardModule(
  [student],
  normalizedSessions,
  [{ studentId: student.id, totalSessions: 8, usedSessions: 0, paidAmount: 1000000, totalAmount: 1000000 }],
  [
    {
      id: 'real-thu-attendance',
      occurrenceDate: '2026-06-04',
      classSessionId: 'wed-fri',
      attendance: [{ studentId: student.id, attendanceStatus: 'present', displayValue: '1', credits: [{ sessionNumber: 1, displayValue: '1' }] }],
    },
  ],
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
)
assert(htmlWithRealThursdayAttendance.includes('<span>T5</span>'), 'Real attendance day must stay visible')

const dataset = buildAngelWingsRealDataset()
const mainHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Đỗ Minh Tuyết' },
  null,
  [],
)
assert(mainHtml.includes('data-attendance-cell-detail'))
assert(mainHtml.includes('>3</span>') && mainHtml.includes('>4</span>'), 'Combined credits should render as plain chips')
assert(!mainHtml.includes('(3)') && !mainHtml.includes('(4)'), 'Combined credits should not render parentheses in main table')
const mainTableHtml = mainHtml.match(/<table class="attendance-board-sheet">[\s\S]*?<\/table>/)?.[0] || ''
assert(!mainTableHtml.includes('3+4'), 'Combined credits should not render plus display in main table')
assert(!mainHtml.includes('ANGEL WINGS'), 'Cells should not render uppercase source text')
assert(mainHtml.includes('data-attendance-note-open'), 'Attendance note action should be available')

const noteHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Đỗ Minh Tuyết' },
  null,
  [
    {
      id: 'attendance-board-note-test',
      studentId: dataset.students.find((item) => item.fullName === 'Đỗ Minh Tuyết').id,
      month: '2026-06',
      note: 'Phụ huynh báo bé nghỉ 1 buổi.',
      createdAt: '2026-06-17T00:00:00.000Z',
      updatedAt: '2026-06-17T00:00:00.000Z',
    },
  ],
)
assert(noteHtml.includes('Phụ huynh báo bé nghỉ 1 buổi.'))
assert(noteHtml.includes('Sửa ghi chú'))

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, value)
  },
  removeItem(key) {
    storage.delete(key)
  },
}

saveStoredAttendanceBoardNotes([
  {
    studentId: student.id,
    month: '2026-06',
    note: 'Ghi chú riêng.',
  },
])
assert(storage.has('ichessCenterOS.attendanceBoardNotes.dreamhome'))
assert.equal(getStoredAttendanceBoardNotes()[0].note, 'Ghi chú riêng.')
assert(!storage.has('ichessCenterOS.students.dreamhome'))
assert(!storage.has('ichessCenterOS.tuition.dreamhome'))
assert(!storage.has('ichessCenterOS.schedule.dreamhome'))

console.log('F15K.7 attendance polish days and notes smoke passed')
