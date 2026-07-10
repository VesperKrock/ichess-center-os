import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildScheduleSessionFromForm,
  createEmptyScheduleFormState,
  getVisibleScheduleSessions,
  renderScheduleModule,
  validateScheduleForm,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const scheduleSource = fs.readFileSync(path.join(root, 'src', 'schedule-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')

const teacher = {
  id: 'teacher-fixed-polish',
  fullName: 'Teacher Fixed Polish',
  displayName: 'Coach Polish',
  status: 'active',
}

const student = {
  id: 'student-fixed-polish',
  fullName: 'Student Fixed Polish',
  assignedTeacherId: teacher.id,
}

const classSession = {
  id: 'class-session-fixed-polish',
  name: 'T2 05:00-06:30',
  displayLabel: 'T2 05:00-06:30',
  daysOfWeek: ['monday'],
  startTime: '05:00',
  endTime: '06:30',
  room: '',
  level: 'beginner',
  status: 'active',
}

const weekStart = '2026-07-06'
const emptySlots = getVisibleScheduleSessions([], weekStart, [classSession]).filter(
  (session) => session.isEmptyClassSessionSlot,
)

assert.equal(emptySlots.length, 1)
assert.equal(emptySlots[0].classSessionLabel, 'T2 05:00-06:30')

const scheduleHtml = renderScheduleModule(
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
  weekStart,
  null,
  { classSessions: [classSession] },
)

assert(scheduleHtml.includes('T2 05:00-06:30'), 'Fixed slot card must show Settings class session name.')
assert(scheduleHtml.includes('+ Thêm thông tin'), 'Empty fixed slot card must keep add-info action.')
assert(scheduleHtml.includes('Chưa phân công'), 'Empty fixed slot card must show unassigned state.')

const assignFormState = {
  ...createEmptyScheduleFormState(),
  mode: 'assign',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'recurring',
    classSessionId: classSession.id,
    dayOfWeek: 'monday',
    startTime: '05:00',
    endTime: '06:30',
    room: 'Room A',
    level: 'beginner',
    status: 'scheduled',
    allowOpenRange: 'true',
  },
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
  weekStart,
  null,
  { classSessions: [classSession] },
)

assert(assignHtml.includes('schedule-form-backdrop'), 'Fixed slot assign must render backdrop.')
assert(assignHtml.includes('schedule-form-panel'), 'Fixed slot assign must render dialog panel.')
assert(assignHtml.includes('Gán thông tin ca học'), 'Fixed slot assign title should be compact.')
assert(assignHtml.includes('schedule-fixed-slot-context'), 'Fixed slot assign must show compact slot context.')
assert(assignHtml.includes('data-schedule-form-field="classSessionId"'), 'Fixed slot assign must keep classSessionId hidden.')
assert(assignHtml.includes('data-schedule-form-field="teacherId"'), 'Fixed slot assign must keep teacher field.')
assert(assignHtml.includes('data-schedule-form-field="room"'), 'Fixed slot assign must keep room field.')
assert(assignHtml.includes('data-schedule-form-field="status"'), 'Fixed slot assign must keep status field.')
assert(assignHtml.includes('data-schedule-form-field="note"'), 'Fixed slot assign must keep note field.')
assert(assignHtml.includes('data-schedule-student-field'), 'Fixed slot assign must keep student picker.')

const removedTexts = [
  'Gán thông tin cho slot cố định từ Cài đặt cơ sở',
  'Loại lịch',
  'Tên buổi/lớp',
  'Ca học/Lớp từ Cài đặt cơ sở',
  'Nguồn lịch cố định',
  'Nhóm/lớp',
  'Từ ngày',
  'Đến ngày',
  'Tên giáo viên fallback',
  'Cấp độ',
]

removedTexts.forEach((text) => {
  assert(!assignHtml.includes(text), `Fixed slot assign form must not render "${text}".`)
})

assert.deepEqual(validateScheduleForm(assignFormState.values, [classSession]), {})

const assignment = buildScheduleSessionFromForm(
  {
    ...assignFormState.values,
    teacherId: teacher.id,
    studentIds: [student.id],
    note: 'Operational note',
  },
  null,
  [teacher],
  [classSession],
)

assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])
assert.equal(assignment.title, '', 'Fixed slot assignment should not rename Settings class session from TKB.')
assert.equal(assignment.groupName, '', 'Fixed slot assignment should not write custom group name from TKB.')

const assignedSlots = getVisibleScheduleSessions([assignment], weekStart, [classSession])
assert.equal(assignedSlots[0].classSessionLabel, 'T2 05:00-06:30')

const assignedHtml = renderScheduleModule(
  [assignment],
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
  weekStart,
  null,
  { classSessions: [classSession] },
)

assert(assignedHtml.includes('T2 05:00-06:30'), 'Assigned fixed slot must fall back to Settings class session name.')
assert(getTeacherScheduleSessions(teacher, assignedSlots).length === 1, 'Teacher Portal must still read assigned fixed slot.')

const clearedSlots = getVisibleScheduleSessions([], weekStart, [classSession])
assert(clearedSlots[0].isEmptyClassSessionSlot, 'Clearing assignment must return slot to empty state.')
assert.equal(clearedSlots[0].classSessionLabel, 'T2 05:00-06:30')

const oneOffFormState = {
  ...createEmptyScheduleFormState(),
  mode: 'create',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'oneOff',
    title: 'Buổi học bù',
    dayOfWeek: 'monday',
    date: weekStart,
    startTime: '07:00',
    endTime: '08:00',
  },
}

const oneOffHtml = renderScheduleModule(
  [],
  oneOffFormState,
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
  weekStart,
  null,
  { classSessions: [classSession] },
)

assert(oneOffHtml.includes('Tên buổi/lớp'), 'One-off/makeup flow must still render title field.')
assert(oneOffHtml.includes('Ngày cụ thể'), 'One-off/makeup flow must still render specific date.')
assert(oneOffHtml.includes('Giờ bắt đầu'), 'One-off/makeup flow must still render manual start time.')
assert(!oneOffHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup flow must not require classSessionId.')

assert(scheduleSource.includes('schedule-fixed-slot-context'), 'Schedule module must contain compact fixed-slot context.')
assert(mainSource.includes("allowOpenRange: 'true'"), 'Empty fixed slot assign state must allow open range.')
assert(!scheduleSource.includes('tuition.usedSessions'), 'Schedule polish must not update tuition.usedSessions.')

console.log('fb-c8-4-tkb-fixed-slot-form-polish smoke passed')
