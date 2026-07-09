import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildScheduleSessionFromForm,
  createEmptyScheduleFormState,
  getVisibleScheduleSessions,
  renderScheduleModule,
  validateScheduleForm,
} from '../src/schedule-module.js'
import {
  getTeacherScheduleSessions,
  renderTeacherModule,
} from '../src/teacher-module.js'

const teacher = {
  id: 'teacher-thinh',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thay Thinh',
  status: 'active',
  teacherType: 'fulltime',
}

const student = {
  id: 'student-fixed-schedule',
  fullName: 'Hoc vien lich co dinh',
  assignedTeacherId: teacher.id,
}

const classSession = {
  id: 'class-session-t2-1800',
  name: 'Lop co dinh T2',
  displayLabel: 'T2 18:00-19:30',
  daysOfWeek: ['mon'],
  daysLabel: 'T2',
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong co dinh',
  status: 'active',
}

const teacherHtml = renderTeacherModule(
  [teacher],
  {},
  null,
  teacher.id,
  [student],
  [],
  [classSession],
  [],
)
assert(teacherHtml.includes('data-teacher-action="open-teacher-portal"'), 'Teacher profile must expose an explicit portal action.')
assert(teacherHtml.includes('teacher-portal-preview'), 'Teacher profile must render the Teacher Portal preview shell.')
assert(teacherHtml.includes('Lịch dạy của tôi'), 'Teacher Portal preview must include my schedule.')

const emptyFormState = createEmptyScheduleFormState()
const recurringFormState = {
  ...emptyFormState,
  mode: 'assign',
  values: {
    ...emptyFormState.values,
    scheduleType: 'recurring',
    classSessionId: classSession.id,
    room: classSession.room,
    teacherId: teacher.id,
    studentIds: [student.id],
  },
}

const recurringFormHtml = renderScheduleModule(
  [],
  recurringFormState,
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  [teacher],
  [student],
  '2026-07-06',
  null,
  { classSessions: [classSession] },
)

assert(recurringFormHtml.includes('Ca học/Lớp từ Cài đặt cơ sở'), 'Recurring TKB form must select a Settings class session.')
assert(recurringFormHtml.includes('data-schedule-form-field="classSessionId"'), 'Recurring form must bind classSessionId.')
assert(recurringFormHtml.includes('schedule-class-session-readonly'), 'Recurring form must show class session details read-only.')
assert(!recurringFormHtml.includes('type="time"'), 'Recurring form must not show manual start/end time inputs.')
assert(recurringFormHtml.includes('type="hidden"') && recurringFormHtml.includes('data-schedule-form-field="startTime"'))

const oneOffFormHtml = renderScheduleModule(
  [],
  {
    ...emptyFormState,
    values: {
      ...emptyFormState.values,
      scheduleType: 'oneOff',
      date: '2026-07-09',
      occurrenceReason: 'makeup',
    },
  },
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  [teacher],
  [student],
  '2026-07-06',
  null,
  { classSessions: [classSession] },
)
assert(oneOffFormHtml.includes('type="time"'), 'One-off/makeup flow must keep manual time inputs.')
assert(!oneOffFormHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup flow must not require classSessionId.')

const formValues = {
  ...recurringFormState.values,
  title: '',
  startDate: '2026-07-06',
  endDate: '2026-08-31',
  status: 'scheduled',
  level: 'beginner',
}
const validationErrors = validateScheduleForm(formValues, [classSession])
assert.deepEqual(validationErrors, {}, 'Recurring schedule with a Settings class session must validate.')

const session = buildScheduleSessionFromForm(formValues, null, [teacher], [classSession])
assert.equal(session.classSessionId, classSession.id, 'Recurring payload must keep classSessionId.')
assert.equal(session.startTime, classSession.startTime, 'Recurring payload must use class session startTime.')
assert.equal(session.endTime, classSession.endTime, 'Recurring payload must use class session endTime.')
assert.equal(session.dayOfWeek, 'monday', 'Recurring payload must derive day from class session.')
assert.equal(session.teacherId, teacher.id, 'Recurring payload must keep teacherId.')
assert.deepEqual(session.studentIds, [student.id], 'Recurring payload must keep studentIds.')

const visibleSessions = getVisibleScheduleSessions([session], '2026-07-06', [classSession])
assert.equal(visibleSessions.length, 1, 'Recurring class session must render a TKB card in the selected week.')
assert.equal(visibleSessions[0].occurrenceDate, '2026-07-06')

const teacherSessions = getTeacherScheduleSessions(teacher, [session])
assert.equal(teacherSessions.length, 1, 'Teacher Portal must receive recurring TKB cards by teacherId.')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
assert(mainSource.includes('data-teacher-action="open-teacher-portal"'), 'Main must wire Teacher Portal action.')
assert(mainSource.includes('classSessions,') && mainSource.includes('validateScheduleForm(formValues, classSessions)'))
assert(scheduleSource.includes('renderClassSessionSelect'), 'Schedule form must render class session select for recurring.')
assert(!scheduleSource.includes('attendance-to-tuition'), 'Hotfix must not add attendance-to-tuition automation.')
assert(!scheduleSource.includes('usedSessions'), 'Hotfix must not update tuition usedSessions.')

console.log('FB C8.3 Teacher Portal button + recurring class session TKB smoke: PASS')
