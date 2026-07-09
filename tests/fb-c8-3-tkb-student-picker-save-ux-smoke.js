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
  { id: 'student-card-1', fullName: 'Hoc vien card 1', assignedTeacherId: teacher.id },
  { id: 'student-card-2', fullName: 'Hoc vien card 2', assignedTeacherId: teacher.id },
]

const baseFormState = createEmptyScheduleFormState()
const formState = {
  ...baseFormState,
  values: {
    ...baseFormState.values,
    teacherId: teacher.id,
    teacherName: teacher.displayName,
    studentIds: students.map((student) => student.id),
  },
}

const formHtml = renderScheduleModule(
  [],
  formState,
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

assert(formHtml.includes('data-schedule-student-option'), 'Student cards must expose a wide click target.')
assert(formHtml.includes('schedule-student-option is-suggested is-selected'), 'Selected student cards need a visible state.')
assert(formHtml.includes('2 học viên đã chọn'), 'Selected count must render immediately from studentIds.')
assert(formHtml.includes('data-schedule-student-field'), 'Checkboxes must remain available for direct clicking.')
assert(formHtml.includes('class="schedule-save-button" type="button"'), 'Save must stay on explicit button flow.')
assert(!/<button[^>]*class="schedule-save-button"[^>]*type="submit"/.test(formHtml), 'Save must not depend on native submit.')

const values = {
  ...formState.values,
  scheduleType: 'oneOff',
  title: 'C8.3 picker save UX',
  date: '2026-07-09',
  occurrenceReason: 'makeup',
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong QA',
  level: 'beginner',
  status: 'scheduled',
}
const session = buildScheduleSessionFromForm(values, null, [teacher])
assert.equal(session.teacherId, teacher.id, 'Save payload must keep teacherId.')
assert.deepEqual(session.studentIds, students.map((student) => student.id), 'Save payload must keep selected studentIds.')

const visible = getVisibleScheduleSessions([session], '2026-07-06')
assert.equal(visible.length, 1, 'Saved card must be visible in the selected week.')
assert.equal(visible[0].studentIds.length, 2, 'Visible card data must keep students.')

const teacherSessions = getTeacherScheduleSessions(teacher, [session])
assert.equal(teacherSessions.length, 1, 'Teacher Portal must still receive sessions by teacherId.')
assert.deepEqual(teacherSessions[0].studentIds, students.map((student) => student.id))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

assert(
  mainSource.includes("document.querySelectorAll('[data-schedule-student-option]')") &&
    mainSource.includes("event.target.closest('[data-schedule-student-field]')") &&
    mainSource.includes('checkbox.checked = !checkbox.checked') &&
    mainSource.includes("checkbox.dispatchEvent(new Event('change', { bubbles: true }))"),
  'Card click must toggle the checkbox once and let direct checkbox clicks stay native.',
)
assert(
  mainSource.includes("saveButton.disabled = true") &&
    mainSource.includes("saveButton.setAttribute('aria-busy', 'true')") &&
    mainSource.includes("saveButton.textContent = 'Đang lưu...'"),
  'Save button must give immediate one-click feedback.',
)
assert(stylesSource.includes('.schedule-student-option.is-selected'), 'Selected cards must have a visible CSS state.')
assert(stylesSource.includes('cursor: pointer'), 'Student cards should communicate that the whole card is clickable.')
assert(!scheduleSource.includes('usedSessions'), 'TKB UX polish must not update tuition usedSessions.')
assert(
  !scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'),
  'TKB UX polish must not add attendance-to-tuition automation.',
)

console.log('FB C8.3 TKB student picker/save UX smoke: PASS')
