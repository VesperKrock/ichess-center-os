import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  initialAttendanceBoardFilters,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'

const students = Array.from({ length: 8 }, (_, index) => ({
  id: `student-compact-${index + 1}`,
  fullName: `Hoc vien compact ${index + 1}`,
  studentCode: `HV${String(index + 1).padStart(3, '0')}`,
  classSessionIds: ['class-session-compact'],
}))

const classSessions = [
  {
    id: 'class-session-compact',
    name: 'T3-T5 18:30-20:00',
    title: 'T3-T5 18:30-20:00',
    weekdayLabel: 'T3-T5',
    startTime: '18:30',
    endTime: '20:00',
    status: 'active',
  },
]

const tuitionRecords = students.map((student, index) => ({
  id: `tuition-compact-${index + 1}`,
  studentId: student.id,
  packageName: 'Goi compact',
  totalSessions: 8,
  usedSessions: index,
}))

const lockedBaselineState = {
  status: 'locked',
  lockedAt: '2026-07-08T11:57:00.000Z',
  lockedBy: 'Admin co so',
  unlockedAt: '2026-07-08T11:56:00.000Z',
  unlockReason: 'Khong co ly do',
}

const specificHtml = renderAttendanceBoardModule(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  {
    ...initialAttendanceBoardFilters,
    month: '2026-07',
    classSessionId: 'class-session-compact',
    query: '',
  },
  null,
  [],
  null,
  false,
  [],
  0,
  lockedBaselineState,
)

assert(specificHtml.includes('attendance-baseline-summary'), 'Baseline compact summary must remain visible.')
assert(specificHtml.includes('Đã khóa dữ liệu nền'), 'Baseline status must remain in compact summary.')
assert(specificHtml.includes('0 bản ghi nền'), 'Baseline record count must remain in compact summary.')
assert(specificHtml.includes('attendance-baseline-details'), 'Baseline long help/history must move into details.')
assert(specificHtml.includes('data-attendance-baseline-details'), 'Baseline details disclosure must expose a stable toggle hook.')
assert(specificHtml.includes('<summary>Chi tiết dữ liệu nền</summary>'), 'Baseline details disclosure must be available.')
assert(!specificHtml.includes('data-attendance-baseline-details open'), 'Baseline details must stay closed by default.')
assert(
  specificHtml.indexOf('Nhập trực tiếp vào ô ngày trong khoảng cho phép') >
    specificHtml.indexOf('<details class="attendance-baseline-details">'),
  'Long token instructions must be behind the details disclosure.',
)
assert(specificHtml.includes('data-attendance-baseline-action="start"'), 'Baseline start action must remain.')
assert(specificHtml.includes('data-attendance-baseline-action="save"'), 'Baseline save action must remain.')
assert(specificHtml.includes('data-attendance-baseline-action="unlock"'), 'Baseline unlock action must remain.')
assert(specificHtml.includes('is-class-session-filtered'), 'Specific class-session filter must mark compact table mode.')
assert(!specificHtml.includes('<th class="attendance-class-session-column">Ca học / Lớp</th>'), 'Specific class-session filter must hide repeated class column.')
assert(specificHtml.includes('attendance-package-sessions-column'), 'So buoi column must remain.')
assert(specificHtml.includes('<th>Ghi chú</th>'), 'Ghi chu column must remain.')
assert(specificHtml.includes('data-attendance-note-open'), 'Note action must remain usable.')

const allHtml = renderAttendanceBoardModule(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  {
    ...initialAttendanceBoardFilters,
    month: '2026-07',
    classSessionId: 'all',
    query: '',
  },
  null,
  [],
  null,
  false,
  [],
  0,
  lockedBaselineState,
)

assert(allHtml.includes('<th class="attendance-class-session-column">Ca học / Lớp</th>'), 'All class sessions filter must keep class column.')
assert(allHtml.includes('T3-T5 18:30-20:00'), 'All class sessions filter must keep class labels for row distinction.')

const openedHtml = renderAttendanceBoardModule(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  {
    ...initialAttendanceBoardFilters,
    month: '2026-07',
    classSessionId: 'class-session-compact',
    query: '',
  },
  null,
  [],
  null,
  false,
  [],
  0,
  lockedBaselineState,
  true,
)

assert(openedHtml.includes('data-attendance-baseline-details open'), 'Baseline details must render open when UI state is open.')
assert(openedHtml.includes('Khóa lúc'), 'Opened baseline details must include lock history.')

const attendanceSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const tuitionSource = fs.readFileSync(new URL('../src/tuition-module.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const teacherSource = fs.readFileSync(new URL('../src/teacher-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

assert(attendanceSource.includes('function isSpecificAttendanceClassSessionFilter'), 'Attendance board must guard specific session compact mode.')
assert(attendanceSource.includes('data-attendance-baseline-details'), 'Attendance board must expose details toggle hook.')
assert(mainSource.includes("addEventListener('toggle'") && mainSource.includes('isAttendanceBaselineDetailsOpen'), 'Main must persist baseline details open state.')
assert(stylesSource.includes('min-height: clamp(360px, 58vh, 680px)'), 'Table area must be taller on laptop screens.')
assert(stylesSource.includes('.attendance-baseline-details'), 'Baseline details must have compact styling.')
assert(stylesSource.includes('-webkit-line-clamp: 2'), 'Notes should be visually compact.')
assert(!/tuition\.usedSessions\s*=/.test(`${mainSource}\n${tuitionSource}\n${attendanceSource}`), 'Attendance UI must not mutate tuition.usedSessions.')
assert(!/attendance-to-tuition/i.test(`${mainSource}\n${attendanceSource}\n${tuitionSource}`), 'No attendance-to-tuition automation should be added.')
assert(!scheduleSource.includes('attendance-baseline-details'), 'TKB/C8 schedule module must not be touched for this UI polish.')
assert(!teacherSource.includes('attendance-baseline-details'), 'Teacher Portal/C8 module must not be touched for this UI polish.')

console.log('FB attendance board compact laptop UI smoke: PASS')
