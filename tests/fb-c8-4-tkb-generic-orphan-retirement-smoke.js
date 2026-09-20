import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createEditScheduleFormState,
  getVisibleScheduleSessions,
  isOrphanFixedScheduleRecord,
  renderScheduleModule,
} from '../src/schedule-module.js'

const classSession = {
  id: 'slot-generic',
  displayLabel: 'Generic active slot',
  daysOfWeek: ['mon'],
  startTime: '09:00',
  endTime: '10:00',
  instructorName: '',
  status: 'active',
}
const orphan = {
  id: 'schedule-generic-orphan',
  scheduleType: 'recurring',
  classSessionId: 'slot-retired',
  title: 'Generic legacy recurrence',
  dayOfWeek: 'monday',
  startTime: '11:00',
  endTime: '12:00',
  room: 'QA',
  teacherId: 'historical-reference',
  teacherName: 'Historical Instructor Snapshot',
  studentIds: [],
  status: 'scheduled',
}
const validAssignment = {
  ...orphan,
  id: 'schedule-valid-assignment',
  classSessionId: classSession.id,
  teacherId: '',
  teacherName: '',
}
const oneOff = {
  ...orphan,
  id: 'schedule-generic-one-off',
  scheduleType: 'oneOff',
  classSessionId: '',
  date: '2026-09-21',
  occurrenceReason: 'makeup',
}

assert.equal(isOrphanFixedScheduleRecord(orphan, [classSession]), true)
assert.equal(isOrphanFixedScheduleRecord(validAssignment, [classSession]), false)
assert.equal(isOrphanFixedScheduleRecord(oneOff, [classSession]), false)

const visible = getVisibleScheduleSessions(
  [orphan, validAssignment, oneOff],
  '2026-09-21',
  [classSession],
)
assert(visible.some((session) => session.id === orphan.id && session.isOrphanScheduleRecord))
assert(visible.some((session) => session.assignmentId === validAssignment.id))
assert(visible.some((session) => session.id === oneOff.id))

const formHtml = renderScheduleModule(
  [orphan], createEditScheduleFormState(orphan), null, [],
  null, null, null, null, false, null, [], [], '2026-09-21', null,
  { classSessions: [classSession] },
)
assert(formHtml.includes('Ngưng lặp lịch cũ'))
assert(formHtml.includes('lịch sử điểm danh'))

const retired = {
  ...orphan,
  status: 'cancelled',
  isDeleted: true,
  futureRecurrenceRetired: true,
  retirementReason: 'orphaned-class-session',
}
const visibleAfterRetirement = getVisibleScheduleSessions([retired], '2026-09-21', [classSession])
assert(!visibleAfterRetirement.some((session) => session.id === retired.id))
assert(visibleAfterRetirement.some((session) => session.isEmptyClassSessionSlot))
assert.equal(retired.teacherId, 'historical-reference')
assert.equal(retired.teacherName, 'Historical Instructor Snapshot')

const scheduleSource = readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(!scheduleSource.includes('purgeZombie'))
assert(!mainSource.includes('purgeZombie'))
assert(mainSource.includes("retirementReason: 'orphaned-class-session'"))

console.log('FB C8.4 generic orphan future recurrence retirement smoke: PASS')
