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
  id: 'teacher-cleanup',
  fullName: 'Nguyen Thanh Cleanup',
  displayName: 'Thay Cleanup',
  status: 'active',
  teacherType: 'fulltime',
}
const student = {
  id: 'student-cleanup',
  fullName: 'Hoc vien cleanup',
  assignedTeacherId: teacher.id,
}
const classSession = {
  id: 'class-session-cleanup',
  name: 'Thu 4 18:00',
  daysOfWeek: ['wednesday'],
  startTime: '18:00',
  endTime: '19:30',
  room: 'Phong Cleanup',
  level: 'beginner',
  status: 'active',
}

const addNewState = createEmptyScheduleFormState()
assert.equal(addNewState.values.scheduleType, 'oneOff', 'Add-new TKB must stay internal oneOff/manual.')

const addNewHtml = renderScheduleModule(
  [],
  addNewState,
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

assert(!addNewHtml.includes('Loại lịch'), 'Add-new TKB must not render schedule type label.')
assert(!addNewHtml.includes('Lịch cố định được tạo tại Cài đặt cơ sở'), 'Add-new TKB must not render old fixed schedule hint.')
assert(addNewHtml.includes('data-schedule-form-field="scheduleType"'), 'Add-new TKB must keep hidden scheduleType field.')
assert(addNewHtml.includes('value="oneOff"'), 'Hidden scheduleType must preserve oneOff payload.')
assert(addNewHtml.includes('Lý do'), 'Manual add-new must keep occurrence reason field.')
assert(addNewHtml.includes('type="time"'), 'Manual add-new must keep manual time inputs.')
assert(!addNewHtml.includes('data-schedule-form-field="classSessionId"'), 'Manual add-new must not require classSessionId.')

const manualSession = buildScheduleSessionFromForm(
  {
    ...addNewState.values,
    title: 'Buoi hoc bu cleanup',
    date: '2026-07-08',
    occurrenceReason: 'makeup',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phong Cleanup',
    teacherId: teacher.id,
    studentIds: [student.id],
    level: 'beginner',
    status: 'scheduled',
  },
  null,
  [teacher],
  [classSession],
)
assert.equal(manualSession.scheduleType, 'oneOff')
assert.equal(manualSession.classSessionId, '')
assert.equal(manualSession.teacherId, teacher.id)
assert.deepEqual(manualSession.studentIds, [student.id])

const fixedSlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(fixedSlots.length, 1, 'Settings classSession must still render fixed slot.')
assert.equal(fixedSlots[0].isEmptyClassSessionSlot, true)

const fixedAssignment = buildScheduleSessionFromForm(
  {
    scheduleType: 'recurring',
    classSessionId: classSession.id,
    title: 'Assignment cleanup',
    teacherId: teacher.id,
    studentIds: [student.id],
    room: '',
    groupName: '',
    level: 'beginner',
    status: 'scheduled',
  },
  null,
  [teacher],
  [classSession],
)
const assignedSlots = getVisibleScheduleSessions([fixedAssignment], '2026-07-06', [classSession])
assert.equal(assignedSlots.length, 1)
assert.equal(assignedSlots[0].classSessionId, classSession.id)
assert.equal(assignedSlots[0].teacherId, teacher.id)
assert.deepEqual(assignedSlots[0].studentIds, [student.id])
assert.equal(getTeacherScheduleSessions(teacher, [fixedAssignment]).length, 1)
assert.equal(getTeacherScheduleSessions(teacher, []).length, 0)

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const attendanceBoardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')

assert(mainSource.includes("scheduleFormState.mode === 'create'"), 'Fixed schedule add-new guard must remain.')
assert(!scheduleSource.includes('schedule-form-help'), 'Cleanup should remove redundant hint style/hook.')
assert(!scheduleSource.includes('usedSessions'))
assert(!scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'))
assert(attendanceBoardSource.includes('renderAttendanceBoardModule'), 'Smoke reads attendance board without requiring changes.')
assert(!mainSource.includes('createUserWithEmail') && !mainSource.includes('signUp('))

console.log('FB C8.3 TKB remove schedule type and redundant hint smoke: PASS')
