import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildSessionReportFromAttendance,
  createSessionReportDraft,
  renderScheduleModule,
} from '../src/schedule-module.js'
import {
  buildUnifiedAttendanceRecords,
  createAdminAttendanceRecord,
  createTeacherAttendanceRecord,
  upsertTeacherAttendanceRecords,
} from '../src/attendance-records.js'

const students = [
  {
    id: 'student-teacher-1',
    fullName: 'Học viên Giáo viên Một',
    level: 'Dolphin 1',
    parentName: 'Phụ huynh Giáo viên',
  },
  {
    id: 'student-teacher-2',
    fullName: 'Học viên Giáo viên Hai',
    level: 'Dolphin 2',
    parentName: 'Phụ huynh Giáo viên',
  },
]
const teachers = [
  {
    id: 'teacher-main',
    fullName: 'Giáo viên Chính',
  },
]
const session = {
  id: 'schedule-teacher',
  scheduleType: 'oneOff',
  title: 'Ca báo cáo giáo viên',
  date: '2026-06-05',
  occurrenceDate: '2026-06-05',
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phòng Giáo viên',
  teacherId: 'teacher-main',
  teacherName: '',
  studentIds: students.map((student) => student.id),
  groupName: 'Nhóm Giáo viên',
  level: 'beginner',
  status: 'scheduled',
  note: '',
}
const reportState = {
  sessionId: 'schedule-teacher',
  occurrenceDate: '2026-06-05',
}

const teacherDraft = createSessionReportDraft(session, null)
const teacherHtml = renderScheduleModule(
  [session],
  null,
  { ...reportState, mode: 'teacherReport' },
  [],
  teacherDraft,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)

for (const text of ['prototype', 'placeholder', 'F19E', 'sẽ được triển khai', 'cổng tạm']) {
  assert(!teacherHtml.toLowerCase().includes(text.toLowerCase()), `Teacher UI must not include "${text}"`)
}
assert(teacherHtml.includes('Báo cáo ca dạy'))
assert(teacherHtml.includes('Điểm danh giáo viên'))
assert(teacherHtml.includes('Có mặt'))
assert(teacherHtml.includes('Vắng'))
assert(teacherHtml.includes('Có phép'))
assert(teacherHtml.includes('Học bù'))
assert(teacherHtml.includes('Học thử'))
assert(teacherHtml.includes('session-report-learning'))
assert(teacherHtml.includes('session-report-extra-fields'))
assert(teacherHtml.includes('session-report-trello'))
assert(teacherHtml.includes('data-session-report-trello-output'))
assert(teacherHtml.includes('data-schedule-action="save-attendance"'))

const adminRecord = createAdminAttendanceRecord({
  studentId: 'student-teacher-1',
  date: '2026-06-05',
  sessionId: 'schedule-teacher',
  scheduleSessionId: 'schedule-teacher',
  attendanceStatus: 'present',
  note: 'Admin đã xác nhận.',
})
const lockedDraft = createSessionReportDraft(session, null, {
  adminAttendanceRecords: [adminRecord],
})
const lockedHtml = renderScheduleModule(
  [session],
  null,
  { ...reportState, mode: 'teacherReport' },
  [],
  lockedDraft,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(lockedHtml.includes('Admin cơ sở đã điểm danh ca này.'))
assert(lockedHtml.includes('Giáo viên có thể bổ sung nội dung ca dạy và báo cáo.'))
assert(lockedHtml.includes('data-schedule-action="save-attendance" disabled'))
assert(lockedHtml.includes('session-report-learning'))
assert(lockedHtml.includes('session-report-trello'))

const savedReport = buildSessionReportFromAttendance({
  sessionId: session.id,
  occurrenceDate: session.occurrenceDate,
  attendance: [
    { studentId: 'student-teacher-1', attendanceStatus: 'present', note: 'Có mặt đúng giờ.' },
    { studentId: 'student-teacher-2', attendanceStatus: 'excused', note: 'Có phép.' },
  ],
  guestParticipants: [],
})

const firstUpsert = upsertTeacherAttendanceRecords({
  records: [adminRecord],
  inputs: savedReport.attendance.map((item, index) => ({
    ...item,
    date: savedReport.occurrenceDate,
    sessionId: savedReport.sessionId,
    scheduleSessionId: savedReport.sessionId,
    teacherId: 'teacher-main',
    teacherName: 'Giáo viên Chính',
    sourceReportId: savedReport.id,
    sourceAttendanceIndex: index,
    sourceCreditIndex: 0,
    source: 'teacher',
    submittedByRole: 'teacher',
    counted: ['present', 'makeup'].includes(item.attendanceStatus),
    creditValue: ['present', 'makeup'].includes(item.attendanceStatus) ? 1 : 0,
  })),
  byName: 'Giáo viên Chính',
  at: '2026-06-20T08:00:00.000Z',
})
assert.equal(firstUpsert.savedRecords.length, 2)
assert(firstUpsert.savedRecords.every((record) => record.source === 'teacher'))
assert(firstUpsert.savedRecords.every((record) => record.submittedByRole === 'teacher'))
assert(firstUpsert.records.some((record) => record.source === 'admin'), 'Teacher upsert must preserve admin records')

const secondUpsert = upsertTeacherAttendanceRecords({
  records: firstUpsert.records,
  inputs: [
    {
      studentId: 'student-teacher-1',
      date: savedReport.occurrenceDate,
      sessionId: savedReport.sessionId,
      scheduleSessionId: savedReport.sessionId,
      sourceReportId: savedReport.id,
      sourceAttendanceIndex: 0,
      sourceCreditIndex: 0,
      attendanceStatus: 'absent',
      status: 'absent',
      counted: false,
      creditValue: 0,
      note: 'Cập nhật vắng.',
    },
  ],
  byName: 'Giáo viên Chính',
  at: '2026-06-20T09:00:00.000Z',
})
assert.equal(secondUpsert.records.filter((record) => record.source === 'teacher').length, 2)
assert.equal(
  secondUpsert.records.find((record) => record.studentId === 'student-teacher-1' && record.source === 'teacher').attendanceStatus,
  'absent',
)
assert.equal(secondUpsert.records.filter((record) => record.source === 'admin').length, 1)

const unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: [savedReport],
  storedRecords: firstUpsert.records,
})
assert.equal(
  unifiedRecords.filter((record) =>
    record.studentId === 'student-teacher-1' &&
    record.date === '2026-06-05' &&
    record.source === 'teacher',
  ).length,
  1,
  'Stored teacher record should replace duplicate adapter record from sessionReports',
)

const canonicalTeacherRecord = createTeacherAttendanceRecord({
  studentId: 'student-teacher-3',
  date: '2026-06-05',
  sessionId: 'schedule-teacher',
  attendanceStatus: 'excusedAbsent',
  note: 'Legacy status maps to canonical.',
})
assert.equal(canonicalTeacherRecord.attendanceStatus, 'excused')
assert.equal(canonicalTeacherRecord.source, 'teacher')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
assert(mainSource.includes('upsertTeacherAttendanceRecords'))
assert(mainSource.includes('getScheduleAdminAttendanceRecords'))
assert(recordsSource.includes('createTeacherAttendanceRecord'))
assert(recordsSource.includes('getTeacherAdapterDedupeKey'))
assert(scheduleSource.includes('session-report-admin-lock-notice'))
assert(scheduleSource.includes('renderScheduleAdminAttendanceForm'), 'Admin F19F form must remain available')

console.log('F19E TKB giáo viên điểm danh và báo cáo ca dạy smoke passed')
