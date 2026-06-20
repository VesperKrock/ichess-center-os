import assert from 'node:assert/strict'

import { renderScheduleModule } from '../src/schedule-module.js'
import {
  buildAdminReviewDeadlineAlerts,
  buildScheduleDeadlineAlerts,
  getAdminReviewDeadline,
  getAdminReviewStatus,
  isAdminReviewOverdue,
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
  { id: 'teacher-admin-review', fullName: 'Giáo viên Kiểm tra' },
]
const students = [
  { id: 'student-admin-review', fullName: 'Học viên Kiểm tra' },
]
const session = {
  id: 'schedule-admin-review',
  scheduleType: 'oneOff',
  title: 'Ca Kiểm tra Admin',
  date: '2026-06-19',
  occurrenceDate: '2026-06-19',
  startTime: '19:00',
  endTime: '20:30',
  room: 'Phòng Kiểm tra',
  teacherId: 'teacher-admin-review',
  studentIds: ['student-admin-review'],
  level: 'beginner',
  status: 'scheduled',
}
const beforeEnd = new Date(2026, 5, 19, 20, 0)
const beforeAdminDeadline = new Date(2026, 5, 21, 20, 0)
const afterAdminDeadline = new Date(2026, 5, 21, 20, 31)

const adminDeadline = getAdminReviewDeadline(session)
assert.equal(adminDeadline.getFullYear(), 2026)
assert.equal(adminDeadline.getMonth(), 5)
assert.equal(adminDeadline.getDate(), 21)
assert.equal(adminDeadline.getHours(), 20)
assert.equal(adminDeadline.getMinutes(), 30)
assert.equal(isAdminReviewOverdue(session, beforeAdminDeadline), false)
assert.equal(isAdminReviewOverdue(session, afterAdminDeadline), true)

assert.equal(
  getAdminReviewStatus({
    session,
    now: beforeEnd,
  }).status,
  'upcoming',
)
assert.equal(
  getAdminReviewStatus({
    session,
    now: beforeAdminDeadline,
  }).status,
  'adminReviewWaiting',
)

const teacherRecord = {
  id: 'teacher-admin-review-record',
  source: 'teacher',
  submittedByRole: 'teacher',
  studentId: 'student-admin-review',
  date: '2026-06-19',
  sessionId: 'schedule-admin-review',
  scheduleSessionId: 'schedule-admin-review',
  attendanceStatus: 'present',
}
assert.equal(
  getAdminReviewStatus({
    session,
    attendanceRecords: [teacherRecord],
    now: beforeAdminDeadline,
  }).status,
  'teacherSubmittedWaitingAdminReview',
)

assert.equal(
  getAdminReviewStatus({
    session,
    attendanceRecords: [teacherRecord],
    now: afterAdminDeadline,
  }).status,
  'qtvAttentionNeeded',
)

const adminRecord = {
  id: 'admin-admin-review-record',
  source: 'admin',
  submittedByRole: 'admin',
  studentId: 'student-admin-review',
  date: '2026-06-19',
  sessionId: 'schedule-admin-review',
  scheduleSessionId: 'schedule-admin-review',
  attendanceStatus: 'present',
}
assert.equal(
  getAdminReviewStatus({
    session,
    attendanceRecords: [adminRecord],
    now: afterAdminDeadline,
  }).status,
  'adminHandled',
)

const consultantRecord = {
  ...adminRecord,
  id: 'consultant-admin-review-record',
  source: 'consultant',
  submittedByRole: 'consultant',
}
assert.equal(
  getAdminReviewStatus({
    session,
    attendanceRecords: [consultantRecord],
    now: afterAdminDeadline,
  }).status,
  'adminHandled',
)

const missingTimeSession = {
  ...session,
  id: 'schedule-missing-time',
  endTime: '',
}
const missingTimeDeadline = getAdminReviewDeadline(missingTimeSession)
assert.equal(missingTimeDeadline.getDate(), 21, 'Missing end time falls back to end of session day plus 48 hours')
assert.equal(missingTimeDeadline.getHours(), 23)
assert.equal(missingTimeDeadline.getMinutes(), 59)

const adminAlerts = buildAdminReviewDeadlineAlerts({
  sessions: [session],
  attendanceRecords: [teacherRecord],
  sessionReports: [],
  teachers,
  now: afterAdminDeadline,
})
assert.equal(adminAlerts.length, 1)
assert.equal(adminAlerts[0].status, 'qtvAttentionNeeded')
assert.equal(adminAlerts[0].message, 'Admin/Tư vấn chưa kiểm điểm danh đúng hạn.')
assert.equal(adminAlerts[0].escalationMessage, 'Ca này đã quá hạn xử lý tại cơ sở. Cần QTV/anh Hải chú ý.')
assert.equal(adminAlerts[0].deadlineLabel, '20:30, 21/06/2026')

assert.equal(
  buildAdminReviewDeadlineAlerts({
    sessions: [session],
    attendanceRecords: [adminRecord],
    sessionReports: [],
    teachers,
    now: afterAdminDeadline,
  }).length,
  0,
  'Admin record should clear Admin/Tư vấn overdue alert',
)

const allAlerts = buildScheduleDeadlineAlerts({
  sessions: [session],
  attendanceRecords: [],
  sessionReports: [],
  teachers,
  now: afterAdminDeadline,
})
assert(allAlerts.some((alert) => alert.group === 'teacher'))
assert(allAlerts.some((alert) => alert.group === 'adminReview'))

const alertHtml = renderScheduleModule(
  [session],
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
  { attendanceRecords: [teacherRecord], now: afterAdminDeadline },
)
assert(alertHtml.includes('schedule-alert-bell'))
assert(alertHtml.includes('schedule-alert-popover'))
assert(alertHtml.includes('Admin/T'))
assert(alertHtml.includes('1'))
assert(alertHtml.includes('QTV/anh'))
assert(alertHtml.includes('schedule-alert-bell'))
assert(alertHtml.includes('schedule-alert-popover'))
assert(alertHtml.includes('Hạn Admin/Tư vấn kiểm: 20:30, 21/06/2026'))
assert(alertHtml.includes('Admin/Tư vấn chưa kiểm điểm danh đúng hạn.'))
assert(alertHtml.includes('Ca này đã quá hạn xử lý tại cơ sở. Cần QTV/anh Hải chú ý.'))
for (const text of ['F19G.2', 'prototype', 'placeholder', 'cổng tạm', 'future qtv', 'phase sau']) {
  assert(!alertHtml.toLowerCase().includes(text.toLowerCase()), `Alert UI must not include "${text}"`)
}

const cleanHtml = renderScheduleModule(
  [session],
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
  { attendanceRecords: [adminRecord, teacherRecord], now: afterAdminDeadline },
)
assert(cleanHtml.includes('0 ca'))
assert(cleanHtml.includes('ca c'))

assert.equal(storage.writeCount, 0, 'Building Admin/Tư vấn local alerts must not write localStorage')

console.log('F19G.2 cảnh báo local Admin/Tư vấn và QTV tương lai smoke passed')
