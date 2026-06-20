import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderScheduleModule } from '../src/schedule-module.js'
import {
  buildUnifiedAttendanceRecords,
  createAdminAttendanceRecord,
  getAttendanceRecordsStorageKey,
  loadStoredAttendanceRecords,
  saveStoredAttendanceRecords,
  upsertAdminAttendanceRecords,
} from '../src/attendance-records.js'

function createLocalStorageMock() {
  const values = new Map()

  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

const students = [
  {
    id: 'student-admin-1',
    fullName: 'Học viên Admin Một',
    level: 'Dolphin 1',
    parentName: 'Phụ huynh Admin',
  },
  {
    id: 'student-admin-2',
    fullName: 'Học viên Admin Hai',
    level: 'Dolphin 2',
    parentName: 'Phụ huynh Admin',
  },
]
const teachers = [
  {
    id: 'teacher-admin',
    fullName: 'Giáo viên Admin',
    nickname: 'GV Admin',
  },
]
const sessions = [
  {
    id: 'schedule-admin',
    scheduleType: 'oneOff',
    title: 'Ca kiểm thử Admin',
    date: '2026-06-05',
    occurrenceReason: 'extra',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng Admin',
    teacherId: 'teacher-admin',
    teacherName: '',
    studentIds: students.map((student) => student.id),
    groupName: 'Nhóm Admin',
    level: 'beginner',
    status: 'scheduled',
    note: '',
  },
]
const reportState = {
  sessionId: 'schedule-admin',
  occurrenceDate: '2026-06-05',
}
const adminState = {
  sessionId: 'schedule-admin',
  occurrenceDate: '2026-06-05',
  rows: [
    { studentId: 'student-admin-1', attendanceStatus: 'present', note: 'Đã xác nhận tại quầy.' },
    { studentId: 'student-admin-2', attendanceStatus: 'excused', note: 'Phụ huynh báo nghỉ.' },
  ],
  error: '',
  saveState: 'saved',
}

const gatewayHtml = renderScheduleModule(
  sessions,
  null,
  { ...reportState, mode: 'roleGateway' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(gatewayHtml.includes('Bạn là?'))
assert(gatewayHtml.includes('Chọn chế độ xử lý cho buổi học này.'))
assert(gatewayHtml.includes('data-schedule-report-role="admin"'))
assert(gatewayHtml.includes('data-schedule-report-role="teacher"'))

const adminHtml = renderScheduleModule(
  sessions,
  null,
  { ...reportState, mode: 'adminPlaceholder' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
  adminState,
)

const forbiddenUiText = ['prototype', 'placeholder', 'F19F', 'sẽ được triển khai', 'cổng tạm']
for (const text of forbiddenUiText) {
  assert(!adminHtml.toLowerCase().includes(text.toLowerCase()), `Admin UI must not include "${text}"`)
}

assert(adminHtml.includes('Điểm danh Admin cơ sở'))
assert(adminHtml.includes('Ca kiểm thử Admin'))
assert(adminHtml.includes('Giáo viên: Giáo viên Admin'))
assert(adminHtml.includes('Học viên trong ca: 2'))
assert(adminHtml.includes('Có mặt: 1'))
assert(adminHtml.includes('Có phép: 1'))
assert(adminHtml.includes('data-admin-attendance-action="mark-all-present"'))
assert(adminHtml.includes('data-admin-attendance-action="clear"'))
assert(adminHtml.includes('data-admin-attendance-action="save"'))
assert(adminHtml.includes('data-admin-attendance-status'))
assert(adminHtml.includes('data-admin-attendance-note'))
assert(adminHtml.includes('Học viên Admin Một'))
assert(adminHtml.includes('Học viên Admin Hai'))
assert(adminHtml.includes('Có mặt'))
assert(adminHtml.includes('Vắng'))
assert(adminHtml.includes('Có phép'))
assert(adminHtml.includes('Học bù'))
assert(adminHtml.includes('Học thử'))
assert(!adminHtml.includes('session-report-learning'), 'Admin mode must not include teacher learning report')
assert(!adminHtml.includes('session-report-trello'), 'Admin mode must not include Trello report')
assert(!adminHtml.includes('data-schedule-action="save-attendance"'), 'Admin mode must not save sessionReports attendance')

const emptyHtml = renderScheduleModule(
  [{ ...sessions[0], id: 'schedule-admin-empty', studentIds: [] }],
  null,
  { sessionId: 'schedule-admin-empty', occurrenceDate: '2026-06-05', mode: 'adminPlaceholder' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
  { sessionId: 'schedule-admin-empty', occurrenceDate: '2026-06-05', rows: [] },
)
assert(emptyHtml.includes('Ca học này chưa có học viên.'))

const adminRecord = createAdminAttendanceRecord({
  studentId: 'student-admin-1',
  date: '2026-06-05',
  sessionId: 'schedule-admin',
  scheduleSessionId: 'schedule-admin',
  attendanceStatus: 'makeup',
  note: 'Học bù đã xác nhận.',
})
assert.equal(adminRecord.source, 'admin')
assert.equal(adminRecord.submittedByRole, 'admin')
assert.equal(adminRecord.counted, true)
assert.equal(adminRecord.creditValue, 1)

const firstUpsert = upsertAdminAttendanceRecords({
  records: [],
  inputs: [
    {
      studentId: 'student-admin-1',
      date: '2026-06-05',
      sessionId: 'schedule-admin',
      scheduleSessionId: 'schedule-admin',
      teacherId: 'teacher-admin',
      teacherName: 'Giáo viên Admin',
      attendanceStatus: 'present',
      status: 'present',
      counted: true,
      creditValue: 1,
      note: 'Có mặt tại lớp.',
    },
    {
      studentId: 'student-admin-2',
      date: '2026-06-05',
      sessionId: 'schedule-admin',
      scheduleSessionId: 'schedule-admin',
      teacherId: 'teacher-admin',
      teacherName: 'Giáo viên Admin',
      attendanceStatus: 'trial',
      status: 'trial',
      counted: false,
      creditValue: 0,
      note: 'Học thử.',
    },
  ],
  byName: 'Admin cơ sở',
  at: '2026-06-20T08:00:00.000Z',
})
assert.equal(firstUpsert.savedRecords.length, 2)
assert(firstUpsert.savedRecords.every((record) => record.source === 'admin'))
assert(firstUpsert.savedRecords.every((record) => record.submittedByRole === 'admin'))
assert.equal(firstUpsert.savedRecords.find((record) => record.studentId === 'student-admin-1').counted, true)
assert.equal(firstUpsert.savedRecords.find((record) => record.studentId === 'student-admin-2').counted, false)

const secondUpsert = upsertAdminAttendanceRecords({
  records: firstUpsert.records,
  inputs: [
    {
      studentId: 'student-admin-1',
      date: '2026-06-05',
      sessionId: 'schedule-admin',
      scheduleSessionId: 'schedule-admin',
      attendanceStatus: 'absent',
      status: 'absent',
      counted: false,
      creditValue: 0,
      note: 'Cập nhật thành vắng.',
    },
  ],
  byName: 'Admin cơ sở',
  at: '2026-06-20T09:00:00.000Z',
})
assert.equal(secondUpsert.records.filter((record) => record.source === 'admin').length, 2)
const updatedRecord = secondUpsert.records.find((record) => record.studentId === 'student-admin-1')
assert.equal(updatedRecord.attendanceStatus, 'absent')
assert.equal(updatedRecord.counted, false)
assert.equal(updatedRecord.creditValue, 0)
assert.equal(updatedRecord.note, 'Cập nhật thành vắng.')

const storage = createLocalStorageMock()
globalThis.localStorage = storage
const recordsKey = getAttendanceRecordsStorageKey('dreamhome')
saveStoredAttendanceRecords('dreamhome', secondUpsert.records)
assert.equal(storage.values.has(recordsKey), true)
assert.equal(loadStoredAttendanceRecords('dreamhome').length, 2)

const sourceReports = [
  {
    id: 'teacher-report-admin',
    sessionId: 'schedule-admin',
    occurrenceDate: '2026-06-05',
    attendance: [
      {
        studentId: 'student-admin-1',
        attendanceStatus: 'present',
        source: 'teacher',
        submittedByRole: 'teacher',
      },
    ],
  },
]
const sourceReportsSnapshot = JSON.stringify(sourceReports)
const unifiedRecords = buildUnifiedAttendanceRecords({
  sessionReports: sourceReports,
  storedRecords: secondUpsert.records,
})
assert.equal(JSON.stringify(sourceReports), sourceReportsSnapshot, 'Admin attendance must not mutate sessionReports')
assert(unifiedRecords.some((record) => record.source === 'admin'))
assert(unifiedRecords.some((record) => record.source === 'teacher' || record.source === 'unknown'))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const recordsSource = fs.readFileSync(new URL('../src/attendance-records.js', import.meta.url), 'utf8')
assert(mainSource.includes('upsertAdminAttendanceRecords'))
assert(mainSource.includes('data-admin-attendance-action'))
assert(scheduleSource.includes('renderScheduleAdminAttendanceForm'))
assert(recordsSource.includes('createAdminAttendanceRecord'))
assert(!mainSource.includes('saveStoredSessionReports(result.records)'))
assert(!mainSource.includes('source: "initialBaseline"'))

console.log('F19F TKB Admin/Tư vấn điểm danh đơn giản smoke passed')
