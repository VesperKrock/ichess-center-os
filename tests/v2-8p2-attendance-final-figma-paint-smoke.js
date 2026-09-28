import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { ledgerFixture } from './a6-attendance-ledger-fixtures.js'

const students = [{
  id: 'student-a',
  centerId: 'dreamhome',
  fullName: 'Đinh Phúc Nguyên',
  classSessionIds: ['class-a'],
  recurringEnrollments: [{ classSessionId: 'class-a', weekdays: ['tue', 'thu'] }],
  useAuthoritativeEnrollment: true,
}]
const classSessions = [{
  id: 'class-a',
  name: 'T3-T5',
  daysOfWeek: ['tue', 'thu'],
  startTime: '17:00',
  endTime: '18:30',
  status: 'active',
}]
const reminders = [{
  studentId: 'student-a',
  cycleId: 'cycle-a',
  signal: 'REVIEW_UPDATE_DUE',
  label: 'Cập nhật nhận xét',
  severity: 'warning',
  checkpointVersion: 0,
}]
const records = [{
  id: 'record-a',
  studentId: 'student-a',
  date: '2026-09-03',
  scheduleSessionId: 'occurrence-a',
  classSessionId: 'class-a',
  attendanceStatus: 'makeup',
  status: 'makeup',
  counted: true,
  source: 'admin',
}]

const fixture = ledgerFixture()
const renderBoard = (availability = {}) => renderAttendanceBoardModule({
  students: fixture.students, classSessions: fixture.classSessions, filters: fixture.filters,
  availability: { ...fixture, attendanceAvailable: true, tuitionAvailable: true,
    ledgerContext: { status: 'ready', occurrences: fixture.occurrences }, ...availability },
})

const defaultHtml = renderBoard()
for (const expected of [
  'attendance-board-heading-intro',
  'attendance-board-heading-copy',
  'Theo dõi buổi học · Chỉ xem',
  'data-attendance-read-only',
  'attendance-ledger-scroll',
  'data-attendance-ledger-state="makeup"',
  'Nguyễn Hoàng Minh Anh',
]) {
  assert(defaultHtml.includes(expected), `Final Attendance paint is missing ${expected}`)
}
assert(!defaultHtml.includes('attendance-board-heading-status'))
assert(!defaultHtml.includes('attendance-board-operations-notice'))
assert(!defaultHtml.includes('module-authoritative-refresh-notice'))

const degradedHtml = renderBoard({
  attendanceAvailable: false,
  tuitionAvailable: false,
  calendarNotesAvailable: false,
  attendanceOperationsReady: false,
})
assert(degradedHtml.includes('Chưa tải được dữ liệu điểm danh.'))
assert(!degradedHtml.includes('attendance-board-operations-notice'))

const reminderHtml = renderBoard({ isReminderPanelOpen: true })
assert(!reminderHtml.includes('attendance-reminder-panel'))
assert(!reminderHtml.includes('data-attendance-reminder-action="complete-review"'))

const contextHtml = renderBoard({
  attendanceCellNoteContextState: {
    studentId: 'student-a',
    dateKey: '2026-09-03',
    x: 566,
    y: 352,
    occurrences: [{
      scheduleSessionId: 'occurrence-a',
      occurrenceDate: '2026-09-03',
      classSessionId: 'class-a',
      classSessionLabel: 'T3–T5 · 17:00–18:30',
    }],
  },
})
assert(!contextHtml.includes('Ghi chú ô điểm danh'))
assert(!contextHtml.includes('Xem / sửa ghi chú'))
assert(!contextHtml.includes('<small>T3–T5 · 17:00–18:30</small>'))

const baselineHtml = renderBoard({ isBaselineManagerOpen: true }, { status: 'unlocked' })
for (const expected of [
  'Thiết lập dữ liệu điểm danh ban đầu',
  'data-attendance-baseline-action="start"',
  'data-attendance-baseline-action="undo"',
  'data-attendance-baseline-action="save"',
  'data-attendance-baseline-action="cancel"',
  'data-attendance-baseline-action="clear"',
  'data-attendance-baseline-action="lock"',
  'data-attendance-baseline-action="unlock"',
]) {
  assert(!baselineHtml.includes(expected), `A6 retired background-data editor remains reachable: ${expected}`)
}

const themeSource = readFileSync(new URL('../src/attendance-v2-8p2-theme.css', import.meta.url), 'utf8')
for (const expected of [
  'height: 32px;',
  'height: 50px;',
  'height: 70px;',
  'height: 40px;',
  'height: 72px;',
  'width: 500px;',
  'width: 760px;',
  'height: 440px;',
  'width: 330px;',
  'min-height: 126px;',
  '--attendance-bg: #0f1115;',
  '--attendance-panel: #14171c;',
]) {
  assert(themeSource.includes(expected), `Figma geometry/theme contract is missing ${expected}`)
}

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes("import './attendance-v2-8p2-theme.css'"))
assert(mainSource.includes('renderModuleTitlebarCurrentness(windowItem)'))
assert(mainSource.includes('usesCompactModuleTitlebarCurrentness(windowItem)'))
assert(mainSource.includes('isPrimaryBusinessModuleWindow(windowItem)'))
assert(mainSource.includes('isFinanceModuleWindow(windowItem) || usesCompactModuleTitlebarCurrentness(windowItem)'))

console.log('V2-8P2 ATTENDANCE FINAL FIGMA PAINT SMOKE: PASS')
