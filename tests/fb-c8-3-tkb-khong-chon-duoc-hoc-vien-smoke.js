import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildScheduleSessionFromForm,
  createEmptyScheduleFormState,
  getVisibleScheduleSessions,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const teacher = {
  id: 'teacher-thinh',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thay Thinh',
  status: 'active',
  teacherType: 'fullTime',
}

const students = [
  {
    id: 'student-picked-1',
    fullName: 'Hoc vien da chon 1',
    assignedTeacherId: teacher.id,
  },
  {
    id: 'student-picked-2',
    fullName: 'Hoc vien da chon 2',
    assignedTeacherId: teacher.id,
  },
]

const emptyFormState = createEmptyScheduleFormState()
const pickerHtml = renderScheduleModule(
  [],
  {
    ...emptyFormState,
    values: {
      ...emptyFormState.values,
      teacherId: teacher.id,
      teacherName: teacher.displayName,
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
  students,
  '2026-07-06',
)

assert(pickerHtml.includes('schedule-student-picker'), 'Schedule form must render the student picker.')
assert(
  pickerHtml.includes('data-schedule-action="toggle-student-picker"'),
  'Student picker summary must expose an explicit toggle action.',
)
assert(pickerHtml.includes('aria-expanded="false"'), 'Empty student picker should start collapsed.')
assert(
  pickerHtml.includes('data-schedule-student-field') && pickerHtml.includes('name="studentIds"'),
  'Student options must be real checkbox fields for DOM snapshot/save.',
)
assert(!/<button[^>]*data-schedule-action="toggle-student-picker"[^>]*type="submit"/.test(pickerHtml))

const selectedFormState = {
  ...emptyFormState,
  values: {
    ...emptyFormState.values,
    teacherId: teacher.id,
    teacherName: teacher.displayName,
    studentIds: students.map((student) => student.id),
  },
}
const selectedPickerHtml = renderScheduleModule(
  [],
  selectedFormState,
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  [teacher],
  students,
  '2026-07-06',
)

assert(selectedPickerHtml.includes('2 học viên đã chọn'), 'Selected count must update after choosing students.')
assert(selectedPickerHtml.includes('aria-expanded="true"'), 'Picker should stay open when students are selected.')

const formValues = {
  ...selectedFormState.values,
  scheduleType: 'oneOff',
  title: 'C8.3 student picker hotfix',
  date: '2026-07-09',
  occurrenceReason: 'makeup',
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong QA',
  level: 'beginner',
  status: 'scheduled',
}
const createdSession = buildScheduleSessionFromForm(formValues, null, [teacher])
assert.equal(createdSession.teacherId, teacher.id, 'Student picker hotfix must not lose teacherId.')
assert.deepEqual(
  createdSession.studentIds,
  students.map((student) => student.id),
  'Save payload must keep selected studentIds.',
)

const visibleSessions = getVisibleScheduleSessions([createdSession], '2026-07-06')
assert.equal(visibleSessions.length, 1, 'Saved session with students must render in the selected week.')
assert.equal(visibleSessions[0].studentIds.length, 2, 'Visible card data must keep selected students.')

const cardHtml = renderScheduleModule(
  [createdSession],
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
  students,
  '2026-07-06',
)
assert(cardHtml.includes('2 học viên'), 'Schedule card should show the selected student count.')

const teacherSessions = getTeacherScheduleSessions(teacher, [createdSession])
assert.equal(teacherSessions.length, 1, 'Teacher Portal must keep receiving the teacher session.')
assert.deepEqual(teacherSessions[0].studentIds, students.map((student) => student.id))

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

assert(
  mainSource.includes('data-schedule-action="toggle-student-picker"') &&
    mainSource.includes("picker.open = !picker.open"),
  'Main wiring must manually toggle the student picker.',
)
assert(
  mainSource.includes("formElement?.querySelectorAll('[data-schedule-student-field]:checked')"),
  'DOM snapshot save must keep checked studentIds.',
)
assert(!scheduleSource.includes('usedSessions'), 'TKB student picker hotfix must not update tuition usedSessions.')
assert(
  !scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'),
  'TKB student picker hotfix must not add attendance-to-tuition automation.',
)

console.log('FB C8.3 TKB student picker hotfix smoke: PASS')
