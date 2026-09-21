import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  initialAttendanceBoardFilters,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import {
  createSessionReportDraft,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import {
  getFilteredStudents,
  initialStudentFilters,
  renderStudentModule,
} from '../src/student-module.js'
import {
  initialTuitionFilters,
  renderTuitionModule,
} from '../src/tuition-module.js'

const classSessions = [{
  id: 'full-name-slot',
  displayLabel: 'Synthetic Monday 09:00 - 10:00',
  daysOfWeek: ['mon'],
  startTime: '09:00',
  endTime: '10:00',
  instructorName: '',
  status: 'active',
}]

const students = [
  {
    id: 'full-name-two',
    fullName: 'Hotel India',
    currentStatus: 'Đang theo học',
    parentName: 'Synthetic Parent Two',
    birthDate: '2018-01-05',
    classSessionIds: ['full-name-slot'],
    recurringEnrollments: [{ classSessionId: 'full-name-slot', weekdays: ['mon'] }],
  },
  {
    id: 'full-name-three',
    fullName: 'Echo Foxtrot Golf',
    currentStatus: 'Đang theo học',
    parentName: 'Synthetic Parent Three',
    birthDate: '2017-05-01',
    classSessionIds: ['full-name-slot'],
    recurringEnrollments: [{ classSessionId: 'full-name-slot', weekdays: ['mon'] }],
  },
  {
    id: 'full-name-four',
    fullName: 'Alpha Bravo Charlie Delta',
    currentStatus: 'Đang theo học',
    parentName: 'Synthetic Parent Four',
    birthDate: '2016-09-21',
    classSessionIds: ['full-name-slot'],
    recurringEnrollments: [{ classSessionId: 'full-name-slot', weekdays: ['mon'] }],
  },
]

const assertFullNames = (html, label) => {
  for (const student of students) {
    assert(
      html.includes(student.fullName),
      `${label} omitted part of authoritative name: ${student.id}`,
    )
  }
}

const studentListHtml = renderStudentModule(
  students,
  initialStudentFilters,
  null,
  [],
  classSessions,
)
assertFullNames(studentListHtml, 'Student list')
assert(studentListHtml.includes('>Alpha Bravo Charlie Delta</strong>'))
assert(!studentListHtml.includes('>Charlie Delta</strong>'))

const searchMatches = getFilteredStudents(
  students,
  { ...initialStudentFilters, query: 'Alpha Bravo Charlie Delta' },
)
assert.deepEqual(searchMatches.map((student) => student.id), ['full-name-four'])

const attendanceRecords = students.map((student, index) => ({
  id: `full-name-attendance-${index}`,
  studentId: student.id,
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  scheduleSessionId: `full-name-occurrence-${index}`,
  attendanceStatus: 'present',
  status: 'present',
  source: 'admin',
}))
const attendanceHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { ...initialAttendanceBoardFilters, month: '2026-09' },
  null,
  [],
  null,
  false,
  attendanceRecords,
  0,
  null,
  false,
  {},
  { today: '2026-09-21', tuitionAvailable: false },
)
assertFullNames(attendanceHtml, 'Attendance student column')

for (const student of students) {
  const profileHtml = renderStudentDetail(student, [], classSessions, [])
  assert(profileHtml.includes(`<h3>${student.fullName}</h3>`))
}

const session = {
  id: 'full-name-session',
  scheduleType: 'oneOff',
  title: 'Synthetic full-name session',
  date: '2026-09-21',
  occurrenceDate: '2026-09-21',
  startTime: '09:00',
  endTime: '10:00',
  room: 'QA',
  studentIds: students.map((student) => student.id),
  status: 'scheduled',
}
const teacherReportHtml = renderScheduleModule(
  [session],
  null,
  { sessionId: session.id, occurrenceDate: session.date, mode: 'teacherReport' },
  [],
  createSessionReportDraft(session, null),
  null,
  null,
  null,
  false,
  null,
  [],
  students,
  '2026-09-21',
  null,
  { occurrenceAttendanceReady: true, occurrenceAttendanceStatus: 'ready' },
)
assertFullNames(teacherReportHtml, 'Schedule/session operational rows')
assert(teacherReportHtml.includes('>Alpha Bravo Charlie Delta</strong>'))
assert(!teacherReportHtml.includes('>Charlie Delta</strong>'))

const tuitionHtml = renderTuitionModule(
  students,
  [],
  initialTuitionFilters,
  null,
  null,
  null,
  [],
  [],
  '2026-09',
  null,
  [],
  null,
  null,
  [],
  'synthetic-center',
  null,
  {},
  {
    coreStatus: 'ready',
    tuitionStatus: 'ready',
    attendanceStatus: 'ready',
    calendarNotesStatus: 'ready',
    financeStatus: 'ready',
  },
)
assertFullNames(tuitionHtml, 'Tuition Student identity rows')

const studentSource = readFileSync(new URL('../src/student-module.js', import.meta.url), 'utf8')
const scheduleSource = readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const tuitionSource = readFileSync(new URL('../src/tuition-module.js', import.meta.url), 'utf8')
assert(studentSource.includes('getAuthoritativeStudentName(student.fullName)'))
assert(!studentSource.includes('getShortName(student.fullName)'))
assert(!scheduleSource.includes('getShortStudentName'))
assert(!scheduleSource.includes('getShortName(student.fullName'))
assert(!/nameParts\.slice\(\s*-2\)/.test(scheduleSource))
assert(!tuitionSource.includes('getCompactStudentName'))

console.log('F4A_FULL_STUDENT_NAME_DISPLAY_SMOKE: PASS')
