import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderScheduleModule } from '../src/schedule-module.js'

const teachers = [
  { id: 'teacher-hotfix', fullName: 'Giao vien Hotfix' },
]
const students = [
  { id: 'student-hotfix', fullName: 'Hoc vien Hotfix' },
]
const sessions = [
  {
    id: 'schedule-hotfix-001',
    scheduleType: 'oneOff',
    title: 'Angel Wings T4-T6 19:00-20:30',
    date: '2026-06-10',
    occurrenceDate: '2026-06-10',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Phong 1',
    teacherId: 'teacher-hotfix',
    teacherName: 'Giao vien Hotfix',
    studentIds: ['student-hotfix'],
    level: 'beginner',
    status: 'scheduled',
  },
  {
    id: 'schedule-hotfix-002',
    scheduleType: 'oneOff',
    title: 'Angel Wings T7-CN 10:30-12:00',
    date: '2026-06-14',
    occurrenceDate: '2026-06-14',
    startTime: '10:30',
    endTime: '12:00',
    room: 'Phong 2',
    teacherId: 'teacher-hotfix',
    teacherName: 'Giao vien Hotfix',
    studentIds: ['student-hotfix'],
    level: 'intermediate',
    status: 'scheduled',
  },
]
const teacherAttendanceRecord = {
  id: 'teacher-hotfix-record',
  source: 'teacher',
  submittedByRole: 'teacher',
  studentId: 'student-hotfix',
  date: '2026-06-10',
  sessionId: 'schedule-hotfix-001',
  scheduleSessionId: 'schedule-hotfix-001',
  attendanceStatus: 'present',
}

const html = renderScheduleModule(
  sessions,
  null,
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
  '2026-06-08',
  null,
  {
    attendanceRecords: [teacherAttendanceRecord],
    sessionReports: [],
    now: new Date(2026, 5, 17, 10, 0),
  },
)

assert(html.includes('schedule-alert-bell'))
assert(html.includes('schedule-alert-popover'))
assert(html.includes('schedule-alert-popover-list'))
assert(html.includes('QTV/anh'))
assert(html.includes('Admin/T'))
assert(!html.includes('<article class="schedule-teacher-alert-item'))
assert(!html.includes('<section class="schedule-teacher-alerts"'))
assert(html.indexOf('schedule-alert-bell') < html.indexOf('schedule-week-grid'))
assert(html.indexOf('schedule-alert-bell') < html.indexOf('schedule-session-card'))

for (const text of ['prototype', 'placeholder', 'debug', 'F19', 'sáº½ triá»ƒn khai']) {
  assert(!html.toLowerCase().includes(text.toLowerCase()), `Alert UI must not include "${text}"`)
}

const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const alertCssStart = styles.indexOf('.schedule-alert-bell')
const alertCssEnd = styles.indexOf('.schedule-week-scroll', alertCssStart)
const alertCss = styles.slice(alertCssStart, alertCssEnd)

assert(alertCss.includes('position: relative'))
assert(alertCss.includes('position: absolute'))
assert(alertCss.includes('max-height: 340px'))
assert(alertCss.includes('overflow: hidden'))
assert(alertCss.includes('overflow-y: auto'))
assert(alertCss.includes('schedule-alert-popover'))
assert(alertCss.includes('text-overflow: ellipsis'))
assert(!/Module:\s*T/i.test(html))

const scheduleDeadlineSource = fs.readFileSync(
  new URL('../src/schedule-deadline.js', import.meta.url),
  'utf8',
)
assert(scheduleDeadlineSource.includes('TEACHER_REPORT_DEADLINE_HOUR = 10'))
assert(scheduleDeadlineSource.includes('ADMIN_REVIEW_DEADLINE_HOURS = 48'))

const scheduleModuleSource = fs.readFileSync(
  new URL('../src/schedule-module.js', import.meta.url),
  'utf8',
)
assert(!scheduleModuleSource.includes('cloud-tuition'))
assert(!scheduleModuleSource.includes('cloud-schedule'))
assert(!scheduleModuleSource.includes('cloud-attendance'))

console.log('F19H.2 hotfix cảnh báo TKB không đè card smoke passed')
