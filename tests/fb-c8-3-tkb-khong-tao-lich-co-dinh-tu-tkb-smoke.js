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
  id: 'teacher-fixed-slot',
  fullName: 'Nguyen Gia Bao',
  displayName: 'Thay Bao',
  status: 'active',
  teacherType: 'fulltime',
}
const student = {
  id: 'student-fixed-slot',
  fullName: 'Hoc vien fixed slot',
  assignedTeacherId: teacher.id,
}
const classSession = {
  id: 'class-session-thu-5-1800',
  name: 'Thu 5 18:00',
  daysOfWeek: ['thursday'],
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong 2',
  level: 'intermediate',
  status: 'active',
}

const createFormState = createEmptyScheduleFormState()
assert.equal(createFormState.mode, 'create')
assert.equal(createFormState.values.scheduleType, 'oneOff', 'Add-new TKB must default to manual one-off/makeup.')

const createHtml = renderScheduleModule(
  [],
  createFormState,
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

assert(
  !/<option value="recurring"/.test(createHtml),
  'Add-new TKB form must not offer fixed schedule creation.',
)
assert(!createHtml.includes('Loại lịch'), 'Add-new TKB must not show redundant schedule type field.')
assert(!createHtml.includes('Lịch cố định được tạo tại Cài đặt cơ sở'), 'Add-new TKB must not show the old fixed-source hint.')
assert(
  createHtml.includes('type="hidden"') &&
    createHtml.includes('data-schedule-form-field="scheduleType"') &&
    createHtml.includes('value="oneOff"'),
  'Add-new TKB must keep internal manual scheduleType as a hidden value.',
)
assert(createHtml.includes('type="time"'), 'Manual one-off/makeup sessions must keep manual time inputs.')
assert(
  !createHtml.includes('data-schedule-form-field="classSessionId"'),
  'Manual one-off/makeup sessions must not require classSessionId.',
)

const emptyFixedSlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(emptyFixedSlots.length, 1, 'Settings classSession must still materialize a fixed slot in TKB.')
assert.equal(emptyFixedSlots[0].isEmptyClassSessionSlot, true)
assert.equal(emptyFixedSlots[0].classSessionId, classSession.id)

const assignFormState = {
  ...createEmptyScheduleFormState(),
  mode: 'assign',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'recurring',
    classSessionId: classSession.id,
  },
  errors: {},
}
const assignHtml = renderScheduleModule(
  [],
  assignFormState,
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

assert(!assignHtml.includes('Loại lịch'), 'Fixed slot assignment form must not show schedule type selector.')
assert(assignHtml.includes('data-schedule-form-field="classSessionId"'), 'Fixed slot assignment must keep classSessionId.')

const assignment = buildScheduleSessionFromForm(
  {
    ...assignFormState.values,
    title: 'Lop co dinh da gan',
    teacherId: teacher.id,
    studentIds: [student.id],
    room: '',
    groupName: 'Nhom thu 5',
    level: 'intermediate',
    status: 'scheduled',
  },
  null,
  [teacher],
  [classSession],
)
assert.equal(assignment.scheduleType, 'recurring')
assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])

const assignedSlots = getVisibleScheduleSessions([assignment], '2026-07-06', [classSession])
assert.equal(assignedSlots.length, 1)
assert.equal(assignedSlots[0].isEmptyClassSessionSlot, false)
assert.equal(assignedSlots[0].classSessionId, classSession.id)
assert.equal(assignedSlots[0].teacherId, teacher.id)
assert.deepEqual(assignedSlots[0].studentIds, [student.id])

const clearedSlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(clearedSlots.length, 1, 'Clear assignment must leave the fixed Settings slot visible.')
assert.equal(clearedSlots[0].isEmptyClassSessionSlot, true)

assert.equal(getTeacherScheduleSessions(teacher, [assignment]).length, 1)
assert.equal(getTeacherScheduleSessions(teacher, []).length, 0, 'Teacher Portal must not show empty fixed slots.')

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes("scheduleFormState.mode === 'create'"), 'Save flow needs add-new runtime guard.')
assert(
  mainSource.includes('Lich co dinh duoc tao o Cai dat co so'),
  'Runtime guard must explain fixed schedules are created in Settings.',
)
assert(mainSource.includes("mode: 'assign'"), 'Empty fixed slot click must open assignment mode.')
assert(!scheduleSource.includes('usedSessions'))
assert(!scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'))
assert(!mainSource.includes('createUserWithEmail') && !mainSource.includes('signUp('))

console.log('FB C8.3 TKB no fixed schedule from add-new smoke: PASS')
