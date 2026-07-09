import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildScheduleSessionFromForm,
  getVisibleScheduleSessions,
  renderScheduleModule,
  validateScheduleForm,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const teacher = {
  id: 'teacher-thinh',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thay Thinh',
  status: 'active',
  teacherType: 'fullTime',
}

const student = {
  id: 'student-c8-3-hotfix',
  fullName: 'Hoc vien C8.3',
  assignedTeacherId: teacher.id,
}

const formValues = {
  scheduleType: 'oneOff',
  title: 'C8.3 hotfix add-card',
  dayOfWeek: 'monday',
  startDate: '',
  endDate: '',
  date: '2026-07-09',
  occurrenceReason: 'makeup',
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong QA',
  teacherId: teacher.id,
  teacherName: '',
  studentIds: [student.id],
  groupName: '',
  level: 'beginner',
  status: 'scheduled',
  note: 'Smoke save from Them buoi hoc',
}

const errors = validateScheduleForm(formValues)
assert.deepEqual(errors, {}, 'Valid add-card form must not fail validation silently.')

const createdSession = buildScheduleSessionFromForm(formValues, null, [teacher])
assert.equal(createdSession.teacherId, teacher.id, 'Created schedule session must keep real teacherId.')
assert.equal(createdSession.teacherName, teacher.displayName, 'Real teacher should provide display label.')
assert.deepEqual(createdSession.studentIds, [student.id], 'Student selections must stay normalized.')

const scheduleSessions = [createdSession]
const visibleSessions = getVisibleScheduleSessions(scheduleSessions, '2026-07-06')
assert.equal(visibleSessions.length, 1, 'Created one-off session must be visible in the current week.')
assert.equal(visibleSessions[0].occurrenceDate, formValues.date, 'Visible card must stay on the selected date.')
assert.equal(visibleSessions[0].teacherId, teacher.id, 'Visible card must not lose teacherId.')

const scheduleHtml = renderScheduleModule(
  scheduleSessions,
  null,
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
)
assert(scheduleHtml.includes('schedule-session-card'), 'Schedule render must include a card for the saved session.')
assert(scheduleHtml.includes('C8.3 hotfix add-card'), 'Schedule card must render the saved title.')

const teacherSessions = getTeacherScheduleSessions(teacher, scheduleSessions)
assert.equal(teacherSessions.length, 1, 'Teacher Portal C8.3 must receive sessions by teacherId.')
assert.equal(teacherSessions[0].id, createdSession.id, 'Teacher Portal filter must keep the created session.')

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

assert(
  scheduleSource.includes('data-schedule-action="save-form"'),
  'Save button must use the explicit schedule save action.',
)
assert(
  scheduleSource.includes('class="schedule-save-button" type="button"'),
  'Save button must avoid native submit cancellation edge cases.',
)
assert(
  mainSource.includes('getScheduleFormValuesFromDom'),
  'Save flow must snapshot live DOM values before validation/build payload.',
)
assert(
  mainSource.includes('data-schedule-action="save-form"') &&
    mainSource.includes('handleScheduleFormSave'),
  'Click save and submit paths must share one save handler.',
)
assert(!scheduleSource.includes('usedSessions'), 'TKB hotfix must not add tuition usedSessions updates.')
assert(
  !scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'),
  'TKB hotfix must not add attendance-to-tuition automation.',
)

console.log('FB C8.3 TKB add-card hotfix smoke: PASS')
