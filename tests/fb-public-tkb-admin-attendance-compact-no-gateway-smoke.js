import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderScheduleModule } from '../src/schedule-module.js'

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const scheduleSource = readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

const students = [
  { id: 'student-public-1', fullName: 'Synthetic Student One', level: 'Dolphin 1' },
  { id: 'student-public-2', fullName: 'Synthetic Student Two', level: 'Dolphin 2' },
]
const session = {
  id: 'schedule-public-admin',
  scheduleType: 'oneOff',
  title: 'Synthetic completed lesson',
  dayOfWeek: 'monday',
  date: '2026-09-21',
  occurrenceDate: '2026-09-21',
  startTime: '09:00',
  endTime: '10:00',
  room: 'QA',
  teacherName: '',
  studentIds: students.map((student) => student.id),
  level: 'mixed',
  status: 'done',
}
const adminAttendanceState = {
  sessionId: session.id,
  occurrenceDate: session.date,
  rows: [
    { studentId: students[0].id, attendanceStatus: 'present', note: '' },
    { studentId: students[1].id, attendanceStatus: 'excused', note: 'Synthetic note' },
  ],
}
const html = renderScheduleModule(
  [session], null,
  { sessionId: session.id, occurrenceDate: session.date, mode: 'adminPlaceholder' },
  [], null, null, null, null, false, null,
  [{ id: 'registry-entry', displayName: 'Registry Must Stay Disconnected' }],
  students, '2026-09-21', adminAttendanceState,
  { occurrenceAttendanceReady: true },
)

assert(html.includes('schedule-admin-attendance-compact'))
assert(html.includes('Điểm danh Admin cơ sở'))
assert(html.includes('Chưa xếp giáo viên'))
assert(html.includes('Học viên trong ca: 2'))
assert(html.includes('Có mặt: 1'))
assert(html.includes('Có phép: 1'))
assert(html.includes('class="is-primary" data-admin-attendance-action="save"'))
assert(html.includes('class="is-secondary" data-admin-attendance-action="mark-all-present"'))
assert(html.includes('class="is-danger-ghost" data-admin-attendance-action="clear"'))
assert(!html.includes('Bạn là?'))
assert(!html.includes('data-schedule-report-role'))
assert(!html.includes('Registry Must Stay Disconnected'))

assert(stylesSource.includes('.schedule-admin-attendance-compact'))
assert(stylesSource.includes('.schedule-admin-attendance-choice-group button.is-selected'))
assert(!scheduleSource.includes('data-schedule-report-role'))
assert(!mainSource.includes("mode: 'roleGateway'"))
assert(mainSource.includes("mode: 'adminPlaceholder'"))

console.log('FB public TKB compact Admin attendance without role gateway smoke: PASS')
