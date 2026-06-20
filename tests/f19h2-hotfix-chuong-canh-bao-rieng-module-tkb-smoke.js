import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderScheduleModule } from '../src/schedule-module.js'

const teachers = [
  { id: 'teacher-bell', fullName: 'Giao vien Bell' },
]
const students = [
  { id: 'student-bell', fullName: 'Hoc vien Bell' },
]
const sessions = [
  {
    id: 'schedule-bell-001',
    scheduleType: 'oneOff',
    title: 'Angel Wings T4-T6 19:00-20:30',
    date: '2026-06-10',
    occurrenceDate: '2026-06-10',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Phong 1',
    teacherId: 'teacher-bell',
    teacherName: 'Giao vien Bell',
    studentIds: ['student-bell'],
    level: 'beginner',
    status: 'scheduled',
  },
]
const teacherAttendanceRecord = {
  id: 'teacher-bell-record',
  source: 'teacher',
  submittedByRole: 'teacher',
  studentId: 'student-bell',
  date: '2026-06-10',
  sessionId: 'schedule-bell-001',
  scheduleSessionId: 'schedule-bell-001',
  attendanceStatus: 'present',
}

const alertHtml = renderScheduleModule(
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

assert(alertHtml.includes('<details class="schedule-alert-bell"'))
assert(alertHtml.includes('schedule-alert-bell-icon'))
assert(alertHtml.includes('<strong>1</strong>'), 'Bell badge should show total alert count.')
assert(alertHtml.includes('schedule-alert-popover'))
assert(alertHtml.includes('schedule-alert-popover-list'))
assert(alertHtml.includes('Giao vien') || alertHtml.includes('Giáo viên'))
assert(alertHtml.includes('Admin/T'))
assert(alertHtml.includes('QTV/anh'))
assert(!alertHtml.includes('<section class="schedule-teacher-alerts"'))
assert(alertHtml.indexOf('schedule-alert-bell') < alertHtml.indexOf('schedule-week-grid'))
assert(alertHtml.indexOf('schedule-alert-popover') < alertHtml.indexOf('schedule-week-grid'))
assert(!alertHtml.includes('Module: Tất cả module'))

for (const text of ['prototype', 'placeholder', 'debug', 'F19', 'sẽ triển khai']) {
  assert(!alertHtml.toLowerCase().includes(text.toLowerCase()), `Alert UI must not include "${text}"`)
}

const cleanHtml = renderScheduleModule(
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
    sessionReports: [{ sessionId: 'schedule-bell-001', occurrenceDate: '2026-06-10', learningGroups: [] }],
    now: new Date(2026, 5, 10, 10, 0),
  },
)
assert(cleanHtml.includes('<details class="schedule-alert-bell"'))
assert(cleanHtml.includes('0 ca'))
assert(cleanHtml.includes('Không có ca cần cảnh báo.'))
assert(!cleanHtml.includes('schedule-teacher-alerts'))

const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
assert(styles.includes('.schedule-alert-bell'))
assert(styles.includes('.schedule-alert-popover'))
assert(styles.includes('max-height: 340px'))
assert(styles.includes('overflow-y: auto'))
assert(styles.includes('grid-template-columns: repeat(5, minmax(92px, 1fr))'))

const scheduleDeadlineSource = fs.readFileSync(
  new URL('../src/schedule-deadline.js', import.meta.url),
  'utf8',
)
assert(scheduleDeadlineSource.includes('TEACHER_REPORT_DEADLINE_HOUR = 10'))
assert(scheduleDeadlineSource.includes('ADMIN_REVIEW_DEADLINE_HOURS = 48'))

const runtimeSources = [
  '../src/cloud-attendance-records.js',
  '../src/cloud-session-reports.js',
  '../src/cloud-schedule-sessions.js',
  '../src/cloud-tuition-records.js',
  '../src/cloud-tuition-terms.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(runtimeSources.includes('NEEDS SQL/ALLOWLIST PATCH'))

console.log('F19H.2 hotfix chuong canh bao rieng Module TKB smoke passed')
