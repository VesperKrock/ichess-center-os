import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildAttendanceBoardRows,
  initialAttendanceBoardFilters,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const attendanceSource = read('src/attendance-board-module.js')
const tuitionSource = read('src/tuition-module.js')
const mainSource = read('src/main.js')
const styles = read('src/styles.css')
const docs = read('docs/fb-admin-dreamhome-hoc-phi-layout-va-bang-diem-danh-so-buoi.md')

const markers = [
  'FB ADMIN DREAMHOME STATUS: TUITION LAYOUT 100 ZOOM AND ATTENDANCE SESSION COLUMN',
  'TUITION_LAYOUT_100_ZOOM_POLISHED: YES',
  'ATTENDANCE_BOARD_SESSION_COLUMN_ADDED: YES',
  'ATTENDANCE_BOARD_SESSION_COLUMN_SOURCE: TUITION_RECORD_READONLY',
  'ATTENDANCE_TO_USED_SESSIONS_AUTO_UPDATE: NO',
  'TUITION_FORM_LIVE_SAVE_PRESERVED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'C8_TEACHER_SCOPE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]

markers.forEach((marker) => {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
})

assert(
  attendanceSource.indexOf('<th class="attendance-package-sessions-column">Số buổi</th>') <
    attendanceSource.indexOf('<th>Ghi chú</th>'),
  'Attendance session column must be immediately before note column.',
)
assert(
  attendanceSource.includes('function renderAttendancePackageSessions(row)'),
  'Attendance board must render package sessions through a scoped helper.',
)
assert(
  attendanceSource.includes('Chưa gán gói') && attendanceSource.includes('Chưa rõ số buổi'),
  'Attendance session column must have product-facing fallbacks.',
)
assert(
  styles.includes('.attendance-package-sessions-column') &&
    styles.includes('.attendance-package-sessions-cell') &&
    styles.includes('.attendance-package-sessions.is-missing'),
  'Attendance package sessions column must have compact styling.',
)
assert(
  styles.includes('min-width: 1080px') && styles.includes('min-width: 1016px'),
  'Tuition table and advisory table must be compacted for 100% zoom.',
)
assert(
  styles.includes('.tuition-table td:nth-child(4),') &&
    styles.includes('.tuition-table td:nth-child(11)') &&
    styles.includes('white-space: normal;'),
  'Tuition important text cells must be allowed to wrap instead of forcing zoom-out.',
)
assert(
  tuitionSource.includes('<button type="button" data-tuition-action="save-form">') &&
    mainSource.includes('function refreshTuitionFormPreview()') &&
    mainSource.includes('refreshTuitionFormPreview()'),
  'Tuition live/save hotfix must remain wired.',
)
assert(
  !/tuition\.usedSessions\s*=/.test(`${mainSource}\n${tuitionSource}\n${attendanceSource}`),
  'Attendance or display code must not mutate tuition.usedSessions.',
)
assert(
  !/usedSessions\s*:\s*[^,\n]*(attendance|Attendance)/.test(`${mainSource}\n${tuitionSource}\n${attendanceSource}`),
  'Attendance must not auto-update usedSessions through object payloads.',
)

const students = [
  {
    id: 'student-with-package',
    fullName: 'Hoc vien co goi',
    studentCode: 'HV001',
    classSessionIds: ['session-1'],
  },
  {
    id: 'student-no-package',
    fullName: 'Hoc vien chua goi',
    studentCode: 'HV002',
    classSessionIds: ['session-1'],
  },
]
const classSessions = [
  {
    id: 'session-1',
    title: 'Lop A',
    weekdayLabel: 'T3-T5',
    startTime: '17:00',
    endTime: '18:30',
    status: 'active',
  },
]
const tuitionRecords = [
  {
    id: 'tuition-1',
    studentId: 'student-with-package',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 2,
  },
]

const rows = buildAttendanceBoardRows(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  { ...initialAttendanceBoardFilters, month: '2026-07', classSessionId: 'all', query: '' },
  [],
  [],
)

assert(rows[0].tuition?.usedSessions === 2, 'Attendance rows must read current tuition used sessions.')
assert(rows[0].tuition?.totalSessions === 8, 'Attendance rows must read current tuition total sessions.')
assert(rows[1].tuition === undefined, 'Student without package must not receive synthetic tuition.')

const html = renderAttendanceBoardModule(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  { ...initialAttendanceBoardFilters, month: '2026-07', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  [],
  0,
  { status: 'notStarted' },
)

assert(html.includes('<th class="attendance-package-sessions-column">Số buổi</th>'), 'Rendered board must include So buoi header.')
assert(html.includes('2/8'), 'Rendered board must show used/total for student with package.')
assert(html.includes('Chưa gán gói'), 'Rendered board must show missing package fallback.')
assert(
  html.indexOf('attendance-package-sessions-column') < html.indexOf('<th>Ghi chú</th>'),
  'Rendered So buoi header must stay before Ghi chu.',
)

console.log('PASS tuition layout and attendance session column smoke')
