import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildMonthlyAbsenceCareStates,
  getMonthlyAbsenceCarePresentation,
} from '../src/attendance-absence-care.js'
import {
  buildAttendanceBoardRows,
  initialAttendanceBoardFilters,
} from '../src/attendance-board-module.js'
import {
  formatOperatorDate,
  parseCanonicalDateParts,
} from '../src/operator-date-format.js'
import {
  buildParentContactFromForm,
  createEmptyParentContactFormState,
} from '../src/parent-consultation-module.js'
import {
  buildScheduleSessionFromForm,
  createEmptyScheduleFormState,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import {
  buildStudentFromForm,
  createEmptyStudentFormState,
  initialStudentFilters,
  renderStudentModule,
} from '../src/student-module.js'
import { V22_WEEKDAY_ORDER } from '../src/student-recurring-enrollment.js'
import { normalizeTuitionFormValues } from '../src/tuition-module.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const attendanceTheme = read('src/attendance-v2-8p2-theme.css')
const studentTheme = read('src/student-theme.css')
const mainSource = read('src/main.js')

const makeAttendance = (studentId, index, overrides = {}) => ({
  id: `attendance-${studentId}-${index}`,
  studentId,
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  scheduleSessionId: `occurrence-${studentId}-${index}`,
  attendanceStatus: index % 2 ? 'excused' : 'absent',
  status: index % 2 ? 'excused' : 'absent',
  source: 'admin',
  ...overrides,
})

const attendanceRecords = []
for (let count = 1; count <= 5; count += 1) {
  for (let index = 0; index < count; index += 1) {
    attendanceRecords.push(makeAttendance(`student-${count}`, index))
  }
}
attendanceRecords.push(
  makeAttendance('student-5', 8, {
    id: 'future-absence',
    date: '2026-09-30',
    scheduleSessionId: 'future-occurrence',
  }),
  makeAttendance('student-5', 9, {
    id: 'cancelled-absence',
    date: '2026-09-10',
    scheduleSessionId: 'cancelled-occurrence',
    raw: { report: { sessionStatus: 'cancelled' } },
  }),
  makeAttendance('student-5', 10, {
    id: 'other-month-absence',
    date: '2026-08-10',
    scheduleSessionId: 'other-month-occurrence',
  }),
  makeAttendance('student-5', 11, {
    id: 'present-record',
    date: '2026-09-11',
    scheduleSessionId: 'present-occurrence',
    attendanceStatus: 'present',
    status: 'present',
  }),
  makeAttendance('student-3', 1, {
    id: 'duplicate-credit',
    sourceReportId: 'report-student-3-1',
    sourceAttendanceIndex: 0,
    sourceCreditIndex: 1,
  }),
)
attendanceRecords.find((record) => record.id === 'attendance-student-3-1').sourceReportId = 'report-student-3-1'
attendanceRecords.find((record) => record.id === 'attendance-student-3-1').sourceAttendanceIndex = 0

const absenceStates = buildMonthlyAbsenceCareStates(attendanceRecords, '2026-09', {
  throughDate: '2026-09-15',
})
assert.equal(absenceStates.get('student-1').count, 1)
assert.equal(absenceStates.get('student-1').label, '')
assert.equal(absenceStates.get('student-2').label, 'Vắng học 2 buổi')
assert.equal(absenceStates.get('student-3').count, 3, 'replayed attendance credit counted twice')
assert.equal(absenceStates.get('student-3').label, 'Vắng học 3 buổi')
assert.equal(absenceStates.get('student-4').label, 'Cần liên lạc phụ huynh')
assert.equal(absenceStates.get('student-5').count, 5)
assert.equal(absenceStates.get('student-5').label, 'Cảnh báo: Vắng học 5 buổi')
assert.equal(getMonthlyAbsenceCarePresentation(0).label, '')
assert.equal(getMonthlyAbsenceCarePresentation(1).label, '')

const attendanceStudents = Array.from({ length: 6 }, (_, count) => ({
  id: `student-${count}`,
  fullName: `Học viên ${count}`,
  classSessionIds: [],
  recurringEnrollments: [],
}))
const attendanceRows = buildAttendanceBoardRows(
  attendanceStudents,
  [],
  [],
  [],
  [],
  { ...initialAttendanceBoardFilters, month: '2026-09' },
  [],
  attendanceRecords,
  { today: '2026-09-15' },
)
assert.equal(attendanceRows.find((row) => row.student.id === 'student-4').absenceCare.key, 'absence-4')
assert.equal(attendanceRows.find((row) => row.student.id === 'student-5').studentAttentionTone, 'danger')

const weekdayNames = {
  mon: 'Thứ Hai', tue: 'Thứ Ba', wed: 'Thứ Tư', thu: 'Thứ Năm',
  fri: 'Thứ Sáu', sat: 'Thứ Bảy', sun: 'Chủ nhật',
}
const classSessions = V22_WEEKDAY_ORDER.map((weekday, index) => ({
  id: `slot-${weekday}`,
  name: `${weekdayNames[weekday]} ${8 + index}:00 - ${9 + index}:00`,
  displayLabel: `${weekdayNames[weekday]} ${8 + index}:00 - ${9 + index}:00`,
  daysOfWeek: [weekday],
  daysLabel: weekday,
  startTime: `${String(8 + index).padStart(2, '0')}:00`,
  endTime: `${String(9 + index).padStart(2, '0')}:00`,
  instructorName: index === 0 ? '' : `Giáo viên ${index}`,
  status: 'active',
}))
classSessions.push({
  id: 'slot-mon-evening',
  name: 'Thứ Hai 18:00 - 19:00',
  displayLabel: 'Thứ Hai 18:00 - 19:00',
  daysOfWeek: ['mon'],
  daysLabel: 'mon',
  startTime: '18:00',
  endTime: '19:00',
  instructorName: '',
  status: 'active',
})

const studentFormState = createEmptyStudentFormState({ useAuthoritativeEnrollment: true })
studentFormState.values = {
  ...studentFormState.values,
  fullName: 'Học viên F4A',
  birthDate: '2019-01-05',
  schoolName: 'Trường QA',
  parentName: 'Phụ huynh QA',
  recurringEnrollments: [
    { classSessionId: 'slot-mon', weekdays: ['mon'] },
    { classSessionId: 'slot-sun', weekdays: ['sun'] },
  ],
  classSessionIds: ['slot-mon', 'slot-sun'],
}
const studentFormHtml = renderStudentModule(
  [],
  initialStudentFilters,
  studentFormState,
  [],
  classSessions,
  { enrollmentCapabilityStatus: 'ready' },
)
for (const weekday of V22_WEEKDAY_ORDER) {
  assert(studentFormHtml.includes(`data-student-schedule-weekday="${weekday}"`))
}
assert.equal((studentFormHtml.match(/data-student-schedule-weekday=/g) || []).length, 7)
assert(studentFormHtml.includes('data-class-session-id="slot-mon-evening"'))
assert(studentFormHtml.includes('Chưa xếp giáo viên'))
assert(!studentFormHtml.includes('Khung giờ 1'))
assert(!studentFormHtml.includes('Khung giờ 2'))
assert(!studentFormHtml.includes('Khung giờ 3'))

const savedStudent = buildStudentFromForm(studentFormState.values)
assert.equal(savedStudent.birthDate, '2019-01-05')
const profileHtml = renderStudentDetail(savedStudent, [], classSessions, [])
for (const weekday of V22_WEEKDAY_ORDER) {
  assert(profileHtml.includes(`data-student-profile-weekday="${weekday}"`))
}
assert(profileHtml.includes('Chưa xếp giáo viên'))

assert.deepEqual(parseCanonicalDateParts('2019-01-05'), {
  year: 2019,
  month: 1,
  day: 5,
  canonical: '2019-01-05',
})
assert.equal(formatOperatorDate('2019-01-05'), '05/01/2019')
assert.equal(formatOperatorDate('2019-05-01'), '01/05/2019')
assert.equal(formatOperatorDate('05/01/2019'), '05/01/2019', 'ambiguous legacy text was reinterpreted')
assert.equal(parseCanonicalDateParts('2019-02-29'), null)

const parentValues = {
  ...createEmptyParentContactFormState().values,
  registeredAt: '2019-01-05',
}
assert.equal(buildParentContactFromForm(parentValues).registeredAt, '2019-01-05')
assert.equal(normalizeTuitionFormValues({ dueDate: '2019-01-05' }).dueDate, '2019-01-05')

const scheduleValues = {
  ...createEmptyScheduleFormState().values,
  scheduleType: 'recurring',
  classSessionId: 'slot-mon',
  dayOfWeek: 'monday',
  startDate: '2019-01-05',
  endDate: '2019-05-01',
  room: 'Phòng QA',
  studentIds: [],
}
const schedule = buildScheduleSessionFromForm(scheduleValues, null, [], classSessions)
assert.equal(schedule.startDate, '2019-01-05')
assert.equal(schedule.endDate, '2019-05-01')
const scheduleHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2019-01-05')
assert(scheduleHtml.includes('05/01/2019'))
assert(scheduleHtml.includes('11/01/2019'))

assert(attendanceTheme.includes('text-align: left;'))
assert(attendanceTheme.includes('.attendance-absence-care.is-critical'))
assert(studentTheme.includes('.student-schedule-slot-grid'))
assert(studentTheme.includes('.student-profile-schedule-grid'))

const tuitionSaveBlock = mainSource.slice(
  mainSource.indexOf('const handleTuitionFormSave'),
  mainSource.indexOf("document.querySelectorAll('[data-tuition-payment-field]"),
)
assert(!tuitionSaveBlock.includes('attendanceRecords ='))
assert(!tuitionSaveBlock.includes('usedSessionsAutoUpdateFromAttendance'))

console.log('F4A_ATTENDANCE_SCHEDULE_DATE_NORMALIZATION_SMOKE: PASS')
