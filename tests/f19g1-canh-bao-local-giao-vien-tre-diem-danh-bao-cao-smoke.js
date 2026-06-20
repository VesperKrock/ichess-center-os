import assert from 'node:assert/strict'

import { renderScheduleModule } from '../src/schedule-module.js'
import {
  buildTeacherDeadlineAlerts,
  getTeacherReportDeadline,
  getTeacherReportStatus,
  isTeacherReportOverdue,
} from '../src/schedule-deadline.js'

function createLocalStorageMock() {
  const values = new Map()
  let writeCount = 0

  return {
    values,
    get writeCount() {
      return writeCount
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      writeCount += 1
      values.set(key, value)
    },
    removeItem(key) {
      writeCount += 1
      values.delete(key)
    },
  }
}

const storage = createLocalStorageMock()
globalThis.localStorage = storage

const teachers = [
  { id: 'teacher-deadline', fullName: 'Giáo viên Deadline' },
]
const students = [
  { id: 'student-deadline', fullName: 'Học viên Deadline' },
]
const baseSession = {
  id: 'schedule-deadline',
  scheduleType: 'oneOff',
  title: 'Ca Deadline',
  date: '2026-06-19',
  occurrenceDate: '2026-06-19',
  startTime: '19:00',
  endTime: '20:30',
  room: 'Phòng Deadline',
  teacherId: 'teacher-deadline',
  studentIds: ['student-deadline'],
  level: 'beginner',
  status: 'scheduled',
}
const nowBeforeDeadline = new Date(2026, 5, 20, 9, 30)
const nowAfterDeadline = new Date(2026, 5, 20, 10, 1)

const deadline = getTeacherReportDeadline(baseSession)
assert.equal(deadline.getFullYear(), 2026)
assert.equal(deadline.getMonth(), 5)
assert.equal(deadline.getDate(), 20)
assert.equal(deadline.getHours(), 10)
assert.equal(deadline.getMinutes(), 0)
assert.equal(isTeacherReportOverdue(baseSession, nowBeforeDeadline), false)
assert.equal(isTeacherReportOverdue(baseSession, nowAfterDeadline), true)

assert.equal(
  getTeacherReportStatus({
    session: { ...baseSession, date: '2026-06-22', occurrenceDate: '2026-06-22' },
    now: nowAfterDeadline,
  }).status,
  'upcoming',
)
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    now: nowBeforeDeadline,
  }).status,
  'waitingTeacher',
)
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    now: nowAfterDeadline,
  }).status,
  'overdueTeacher',
)

const teacherRecord = {
  id: 'teacher-record-deadline',
  source: 'teacher',
  submittedByRole: 'teacher',
  studentId: 'student-deadline',
  date: '2026-06-19',
  sessionId: 'schedule-deadline',
  scheduleSessionId: 'schedule-deadline',
  attendanceStatus: 'present',
}
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    attendanceRecords: [teacherRecord],
    now: nowAfterDeadline,
  }).status,
  'teacherSubmitted',
)

const meaningfulReport = {
  id: 'report-deadline',
  sessionId: 'schedule-deadline',
  occurrenceDate: '2026-06-19',
  learningGroups: [
    {
      id: 'group-deadline',
      studentIds: ['student-deadline'],
      contentLines: ['Ôn khai cuộc Ý.'],
    },
  ],
}
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    sessionReports: [meaningfulReport],
    now: nowAfterDeadline,
  }).status,
  'teacherSubmitted',
)

const emptyDemoReport = {
  id: 'demo-report-deadline',
  sessionId: 'schedule-deadline',
  occurrenceDate: '2026-06-19',
  isDemoAttendance: true,
  attendance: [],
}
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    sessionReports: [emptyDemoReport],
    now: nowAfterDeadline,
  }).status,
  'overdueTeacher',
)

const adminRecord = {
  id: 'admin-record-deadline',
  source: 'admin',
  submittedByRole: 'admin',
  studentId: 'student-deadline',
  date: '2026-06-19',
  sessionId: 'schedule-deadline',
  scheduleSessionId: 'schedule-deadline',
  attendanceStatus: 'present',
}
assert.equal(
  getTeacherReportStatus({
    session: baseSession,
    attendanceRecords: [adminRecord],
    now: nowAfterDeadline,
  }).status,
  'adminHandledMissingTeacherReport',
)

const alerts = buildTeacherDeadlineAlerts({
  sessions: [baseSession],
  attendanceRecords: [],
  sessionReports: [],
  teachers,
  now: nowAfterDeadline,
})
assert.equal(alerts.length, 1)
assert.equal(alerts[0].message, 'Giáo viên chưa gửi điểm danh/báo cáo đúng hạn.')
assert.equal(alerts[0].deadlineLabel, '10:00, 20/06/2026')

const adminAlerts = buildTeacherDeadlineAlerts({
  sessions: [baseSession],
  attendanceRecords: [adminRecord],
  sessionReports: [],
  teachers,
  now: nowAfterDeadline,
})
assert.equal(adminAlerts.length, 1)
assert.equal(adminAlerts[0].status, 'adminHandledMissingTeacherReport')
assert.equal(adminAlerts[0].message, 'Admin đã điểm danh thay, còn thiếu báo cáo Giáo viên.')

const cleanHtml = renderScheduleModule(
  [baseSession],
  null,
  null,
  [meaningfulReport],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-15',
  null,
  { attendanceRecords: [], now: nowAfterDeadline },
)
assert(cleanHtml.includes('schedule-alert-bell'))
assert(cleanHtml.includes('schedule-alert-popover'))
assert(cleanHtml.includes('0 ca'))
assert(cleanHtml.includes('ca c'))

const alertHtml = renderScheduleModule(
  [baseSession],
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
  '2026-06-15',
  null,
  { attendanceRecords: [adminRecord], now: nowAfterDeadline },
)
assert(alertHtml.includes('schedule-alert-bell'))
assert(alertHtml.includes('schedule-alert-popover'))
assert(alertHtml.includes('schedule-alert-bell'))
assert(alertHtml.includes('schedule-alert-popover'))
assert(alertHtml.includes('Giáo viên: Giáo viên Deadline'))
assert(alertHtml.includes('Hạn gửi: 10:00, 20/06/2026'))
assert(alertHtml.includes('Admin đã điểm danh thay, còn thiếu báo cáo Giáo viên.'))
for (const text of ['F19G.1', 'prototype', 'placeholder', 'cổng tạm', 'deadline helper']) {
  assert(!alertHtml.toLowerCase().includes(text.toLowerCase()), `Alert UI must not include "${text}"`)
}

assert.equal(storage.writeCount, 0, 'Building local deadline alerts must not write localStorage')

console.log('F19G.1 cảnh báo local Giáo viên trễ điểm danh/báo cáo smoke passed')
