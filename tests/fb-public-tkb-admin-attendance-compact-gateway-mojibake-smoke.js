import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  createEditScheduleFormState,
  renderScheduleModule,
} from '../src/schedule-module.js'

const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

const knownBadTitle = [
  fromCodePoints(0x42, 0x75, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xa2, 0x69),
  fromCodePoints(0x68, 0x102, 0xa1, 0xc2, 0xbb, 0xc2, 0x8d, 0x63),
  fromCodePoints(0x6d, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xba, 0x69),
].join(' ')
const fixedTitle = 'Buổi học mới'

const backdropBlock = getCssBlock(stylesSource, '.schedule-form-backdrop')
const gatewayBlock = getCssBlock(stylesSource, '.schedule-report-panel.schedule-role-gateway')
const adminCompactBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-compact')
const adminHeaderActionsBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-compact .schedule-report-header-actions')
const adminHeaderButtonsBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-compact .schedule-report-header-actions button')
const adminActionsBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-actions')
const adminRowBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-row')
const adminRowsBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-rows')
const statusButtonBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-choice-group button')
const selectedStatusBlock = getCssBlock(stylesSource, '.schedule-admin-attendance-choice-group button.is-selected')

assert(!scheduleSource.includes(knownBadTitle), 'Schedule source must not contain the known bad lesson title literal.')
assert(scheduleSource.includes(fixedTitle), 'Schedule source has the repaired lesson title.')
assert(backdropBlock.includes('position: absolute'), 'Gateway backdrop is scoped inside the TKB window.')
assert(backdropBlock.includes('pointer-events: none'), 'Gateway backdrop does not block clicks.')
assert(gatewayBlock.includes('position: fixed') && gatewayBlock.includes('z-index: 181'), 'Gateway appears above backdrop.')
assert(adminCompactBlock.includes('width: min(920px'), 'Admin attendance uses compact width.')
assert(adminHeaderActionsBlock.includes('flex-wrap: wrap'), 'Admin header actions can wrap.')
assert(adminHeaderButtonsBlock.includes('width: auto'), 'Admin close button is not forced to icon width.')
assert(adminActionsBlock.includes('flex-wrap: wrap'), 'Admin action group can wrap.')
assert(stylesSource.includes('.schedule-admin-attendance-actions button.is-primary'), 'Save action has primary styling.')
assert(stylesSource.includes('.schedule-admin-attendance-actions button.is-secondary'), 'Mark-all action has secondary styling.')
assert(stylesSource.includes('.schedule-admin-attendance-actions button.is-danger-ghost'), 'Clear action has danger ghost styling.')
assert(adminRowBlock.includes('display: grid') && adminRowBlock.includes('grid-template-columns:'), 'Admin student row uses grid.')
assert(adminRowsBlock.includes('overflow-x: hidden'), 'Admin rows do not create horizontal scrolling.')
assert(statusButtonBlock.includes('font: inherit'), 'Status choices are one-click buttons.')
assert(selectedStatusBlock.includes('background:'), 'Selected status has visible styling.')
assert(mainSource.includes("control.addEventListener(control.tagName === 'BUTTON' ? 'click' : 'change'"), 'Admin status buttons use click handler.')

const teachers = [{ id: 'teacher-public-tkb', fullName: 'Thầy Thịnh', displayName: 'Thầy Thịnh' }]
const students = [
  { id: 'student-public-1', fullName: 'Minh Anh', level: 'Dolphin 1', parentName: 'Phụ huynh A' },
  { id: 'student-public-2', fullName: 'Khánh Ngọc', level: 'Dolphin 2', parentName: 'Phụ huynh B' },
]
const classSessions = [
  {
    id: 'class-session-public-t2',
    displayLabel: 'T2 17:30 - 19:00',
    daysOfWeek: ['mon'],
    startTime: '17:30',
    endTime: '19:00',
    room: '01',
    status: 'active',
  },
]
const session = {
  id: 'schedule-public-admin',
  scheduleType: 'oneOff',
  title: knownBadTitle,
  dayOfWeek: 'monday',
  date: '2026-07-06',
  occurrenceDate: '2026-07-06',
  startTime: '17:30',
  endTime: '19:00',
  room: '01',
  teacherId: 'teacher-public-tkb',
  studentIds: students.map((student) => student.id),
  level: 'mixed',
  status: 'scheduled',
  note: '',
}
const sessionReports = [
  {
    id: 'report-public-admin',
    sessionId: session.id,
    occurrenceDate: '2026-07-06',
    summary: 'Report exists',
    updatedAt: '2026-07-06T09:00:00.000Z',
  },
]
const adminAttendanceState = {
  sessionId: session.id,
  occurrenceDate: '2026-07-06',
  rows: [
    { studentId: 'student-public-1', attendanceStatus: 'present', note: '' },
    { studentId: 'student-public-2', attendanceStatus: 'excused', note: 'Xin nghỉ trước.' },
  ],
}

const gatewayHtml = renderScheduleModule(
  [session],
  null,
  { sessionId: session.id, occurrenceDate: '2026-07-06', mode: 'roleGateway' },
  sessionReports,
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-07-06',
)
assert(gatewayHtml.includes('schedule-report-panel schedule-role-gateway'), 'Gateway uses scoped panel class.')
assert(gatewayHtml.includes('Bạn là?'), 'Gateway title renders.')
assert(gatewayHtml.includes('Admin cơ sở') && gatewayHtml.includes('Giáo viên'), 'Gateway keeps both choices.')
assert(gatewayHtml.includes(fixedTitle), 'Gateway repairs bad title.')
assert(!gatewayHtml.includes(knownBadTitle), 'Gateway does not render bad title.')

const adminHtml = renderScheduleModule(
  [session],
  null,
  { sessionId: session.id, occurrenceDate: '2026-07-06', mode: 'adminPlaceholder' },
  sessionReports,
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-07-06',
  adminAttendanceState,
)
assert(adminHtml.includes('schedule-admin-attendance-compact'), 'Admin compact attendance panel renders.')
assert(adminHtml.includes('Điểm danh Admin cơ sở'), 'Admin panel title renders.')
assert(adminHtml.includes(fixedTitle), 'Admin header repairs bad title.')
assert(adminHtml.includes('Giáo viên đã báo cáo'), 'Admin panel reads report status from session reports.')
assert(adminHtml.includes('Học viên trong ca: 2'), 'Admin summary includes student count.')
assert(adminHtml.includes('Có mặt: 1'), 'Admin summary includes present count.')
assert(adminHtml.includes('Vắng: 0'), 'Admin summary includes absent count.')
assert(adminHtml.includes('Có phép: 1'), 'Admin summary includes excused count.')
assert(adminHtml.includes('Chưa chọn: 0'), 'Admin summary includes empty count.')
assert(adminHtml.includes('placeholder="Ghi chú (không bắt buộc)"'), 'Admin note placeholder renders.')
assert(adminHtml.includes('type="button"') && adminHtml.includes('value="present"'), 'Present status is a one-click button.')
assert(adminHtml.includes('value="absent"') && adminHtml.includes('value="excused"'), 'Absent and excused status values remain.')
assert(adminHtml.includes('aria-pressed="true"'), 'Selected status state is synchronized.')
assert(adminHtml.includes('<button type="button" data-schedule-action="close-report">Đóng</button>'), 'Close button renders full text.')
assert(adminHtml.includes('class="is-primary" data-admin-attendance-action="save"'), 'Save remains primary.')
assert(adminHtml.includes('class="is-secondary" data-admin-attendance-action="mark-all-present"'), 'Mark-all remains secondary.')
assert(adminHtml.includes('class="is-danger-ghost" data-admin-attendance-action="clear"'), 'Clear remains danger ghost.')
assert(!adminHtml.includes('session-report-trello'), 'Admin panel does not render the Trello report area.')

const adminMissingReportHtml = renderScheduleModule(
  [session],
  null,
  { sessionId: session.id, occurrenceDate: '2026-07-06', mode: 'adminPlaceholder' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-07-06',
)
assert(adminMissingReportHtml.includes('Chưa có báo cáo giáo viên'), 'Admin panel shows missing report status.')

const teacherReportHtml = renderScheduleModule(
  [session],
  null,
  { sessionId: session.id, occurrenceDate: '2026-07-06', mode: 'teacherReport' },
  sessionReports,
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-07-06',
)
assert(teacherReportHtml.includes('session-report-attendance'), 'TKB report keeps attendance area.')
assert(teacherReportHtml.includes('session-report-learning'), 'TKB report keeps learning area.')
assert(teacherReportHtml.includes('session-report-trello'), 'TKB report keeps Trello area.')

const recurringSession = {
  ...session,
  id: 'schedule-public-fixed',
  scheduleType: 'recurring',
  classSessionId: 'class-session-public-t2',
  date: null,
}
const fixedFormHtml = renderScheduleModule(
  [recurringSession],
  createEditScheduleFormState(recurringSession),
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-07-06',
  null,
  { classSessions },
)
for (const label of ['Loại lịch *', 'Tên buổi/lớp *', 'Tên giáo viên fallback', 'Nhóm/lớp', 'Cấp độ']) {
  assert(!fixedFormHtml.includes(label), `Fixed-slot form remains compact without ${label}`)
}

for (const source of [scheduleSource, stylesSource, mainSource]) {
  assert(!source.includes('tuition.usedSessions'), 'Hotfix must not update tuition.usedSessions.')
  assert(!source.includes('attendance-to-tuition'), 'Hotfix must not add attendance-to-tuition automation.')
}

for (const marker of getMojibakeMarkers()) {
  assert(!scheduleSource.includes(marker), `schedule-module.js must not contain marker ${marker}`)
  assert(!stylesSource.includes(marker), `styles.css must not contain marker ${marker}`)
  assert(!mainSource.includes(marker), `main.js must not contain marker ${marker}`)
}

for (const forbidden of getForbiddenPublicStrings()) {
  assert(!scheduleSource.includes(forbidden), 'Schedule source must not contain forbidden public string.')
  assert(!stylesSource.includes(forbidden), 'Styles source must not contain forbidden public string.')
  assert(!mainSource.includes(forbidden), 'Main source must not contain forbidden public string.')
}

console.log('FB public TKB Admin attendance compact gateway mojibake smoke: PASS')

function getCssBlock(source, selector) {
  const start = source.indexOf(`${selector} {`)
  assert(start >= 0, `Missing CSS selector: ${selector}`)
  const end = source.indexOf('\n}', start)
  assert(end >= 0, `Missing CSS block end for selector: ${selector}`)
  return source.slice(start, end + 2)
}

function getMojibakeMarkers() {
  return [
    fromCodePoints(0x43, 0x102, 0xa1, 0xc2, 0xba),
    fromCodePoints(0x102, 0x192),
    fromCodePoints(0x102, 0x2020, 0xc2, 0xb0),
    fromCodePoints(0x48, 0x102, 0xa1, 0xc2, 0xba),
    fromCodePoints(0x102, 0xa1, 0xc2, 0xbb),
    knownBadTitle,
  ]
}

function getForbiddenPublicStrings() {
  return [
    ['Nhà', ' của giáo viên'].join(''),
    ['Teacher', ' Workspace'].join(''),
    ['Teacher', ' Home'].join(''),
    ['TEACHER', '_WORKSPACE_MODULE_ID'].join(''),
    ['local/', 'teacher-workspace-secret'].join(''),
    ['/teacher', '/'].join(''),
    ['#', '/teacher'].join(''),
  ]
}

function fromCodePoints(...codePoints) {
  return String.fromCodePoint(...codePoints)
}
