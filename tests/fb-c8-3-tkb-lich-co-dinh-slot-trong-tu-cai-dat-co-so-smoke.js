import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildScheduleSessionFromForm,
  getVisibleScheduleSessions,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const teacher = {
  id: 'teacher-thinh',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thay Thinh',
  status: 'active',
  teacherType: 'fulltime',
}
const student = {
  id: 'student-slot',
  fullName: 'Hoc vien slot',
  assignedTeacherId: teacher.id,
}
const classSession = {
  id: 'class-session-t3-1630',
  name: 'T3 16:30-18:00',
  displayLabel: 'T3 16:30-18:00',
  daysOfWeek: ['tue'],
  daysLabel: 'T3',
  startTime: '16:30',
  endTime: '18:00',
  room: 'Phong 01',
  level: 'beginner',
  status: 'active',
}

const emptySlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(emptySlots.length, 1, 'Active Settings classSession must render one fixed TKB slot.')
assert.equal(emptySlots[0].isEmptyClassSessionSlot, true)
assert.equal(emptySlots[0].classSessionId, classSession.id)
assert.equal(emptySlots[0].occurrenceDate, '2026-07-07')
assert.equal(emptySlots[0].startTime, classSession.startTime)
assert.equal(emptySlots[0].endTime, classSession.endTime)
assert.equal(emptySlots[0].teacherId, '', 'Empty fixed slot must not invent teacherId.')
assert.deepEqual(emptySlots[0].studentIds, [], 'Empty fixed slot must not invent students.')
assert.equal(emptySlots[0].title, '', 'Empty fixed slot must not resurrect old title.')

const emptyHtml = renderScheduleModule(
  [],
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
  null,
  { classSessions: [classSession] },
)
assert(emptyHtml.includes('is-empty-slot'), 'Empty fixed slot needs distinct visual state.')
assert(emptyHtml.includes('T3 16:30-18:00'), 'Empty slot should show the Settings class session name.')
assert(emptyHtml.includes('Chưa phân công'), 'Empty slot should be clearly unassigned.')
assert(emptyHtml.includes('+ Thêm thông tin'), 'Empty slot should invite assignment.')
assert(!emptyHtml.includes('Lớp thầy Thịnh'), 'Empty slot must not resurrect deleted assignment title.')

const assignmentValues = {
  scheduleType: 'recurring',
  classSessionId: classSession.id,
  title: 'Lớp thầy Thịnh',
  startDate: '',
  endDate: '',
  room: '',
  teacherId: teacher.id,
  teacherName: '',
  studentIds: [student.id],
  groupName: 'Nhóm T3',
  level: 'beginner',
  status: 'scheduled',
  note: 'Assignment only',
}
const assignment = buildScheduleSessionFromForm(assignmentValues, null, [teacher], [classSession])
assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])
assert.equal(assignment.startTime, classSession.startTime)
assert.equal(assignment.endTime, classSession.endTime)

const assignedSlots = getVisibleScheduleSessions([assignment], '2026-07-06', [classSession])
assert.equal(assignedSlots.length, 1)
assert.equal(assignedSlots[0].isEmptyClassSessionSlot, false)
assert.equal(assignedSlots[0].title, 'Lớp thầy Thịnh')
assert.equal(assignedSlots[0].teacherId, teacher.id)

const teacherSessions = getTeacherScheduleSessions(teacher, [assignment])
assert.equal(teacherSessions.length, 1, 'Teacher Portal must see assigned fixed slot by teacherId.')
assert.equal(getTeacherScheduleSessions(teacher, []).length, 0, 'Teacher Portal must not see empty fixed slots.')

const clearedSlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(clearedSlots.length, 1, 'Clear assignment must leave the Settings slot visible.')
assert.equal(clearedSlots[0].isEmptyClassSessionSlot, true)
assert.equal(clearedSlots[0].title, '', 'Clear assignment must not resurrect old title.')
assert.equal(clearedSlots[0].teacherId, '', 'Clear assignment must not resurrect old teacher.')
assert.deepEqual(clearedSlots[0].studentIds, [], 'Clear assignment must not resurrect old students.')

const inactiveSlots = getVisibleScheduleSessions([], '2026-07-06', [
  { ...classSession, status: 'inactive' },
])
assert.equal(inactiveSlots.length, 0, 'Inactive/deleted Settings classSession must remove the slot from TKB.')

const oneOffHtml = renderScheduleModule(
  [],
  {
    mode: 'create',
    sessionId: null,
    values: {
      scheduleType: 'oneOff',
      title: '',
      dayOfWeek: 'tuesday',
      classSessionId: '',
      startDate: '',
      endDate: '',
      date: '2026-07-07',
      occurrenceReason: 'makeup',
      startTime: '',
      endTime: '',
      room: '',
      teacherId: '',
      teacherName: '',
      studentIds: [],
      groupName: '',
      level: 'beginner',
      status: 'scheduled',
      note: '',
    },
    errors: {},
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
assert(oneOffHtml.includes('type="time"'), 'One-off/makeup must keep manual time inputs.')
assert(!oneOffHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup must not require classSessionId.')

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(scheduleSource.includes('buildClassSessionScheduleSlot'), 'Schedule module must materialize fixed slots from Settings classSessions.')
assert(mainSource.includes('Xóa phân công của slot này?'), 'Clear assignment wording must not imply deleting the Settings slot.')
assert(!scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'))
assert(!scheduleSource.includes('usedSessions'))

console.log('FB C8.3 TKB fixed slot from Settings smoke: PASS')
