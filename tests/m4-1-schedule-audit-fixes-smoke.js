import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildScheduleSessionFromForm,
  createEditScheduleFormState,
  createEmptyScheduleFormState,
  getA5ScheduleAttendanceCardState,
  getVisibleScheduleSessions,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { projectA3ScheduleSessions } from '../src/cloud-authoritative-teacher-history.js'
import { createSchedulePrintSnapshot, renderSchedulePrintDocument } from '../src/schedule-print-module.js'
import { renderStudentDetail } from '../src/student-detail.js'

const classSession = {
  id: 'turtle', daysOfWeek: ['tue', 'thu'], displayLabel: 'Turtle',
  startTime: '17:30', endTime: '18:30', room: 'Phòng 1', status: 'active',
  instructorName: 'Stale static teacher',
}
const assignments = ['tuesday', 'thursday'].map((dayOfWeek) => ({
  id: `turtle-${dayOfWeek}`, classSessionId: 'turtle', scheduleType: 'recurring',
  dayOfWeek, startDate: '2026-09-28', endDate: '2026-10-03',
  title: 'Turtle', studentIds: ['one', 'two'], status: 'scheduled',
}))
const week = (start) => getVisibleScheduleSessions(assignments, start, [classSession])
assert(week('2026-09-21').every((slot) => slot.isEmptyClassSessionSlot))
assert.deepEqual(week('2026-09-28').map((slot) => [slot.id, slot.occurrenceDate]), [
  ['turtle-tuesday', '2026-09-29'], ['turtle-thursday', '2026-10-01'],
])
assert(week('2026-10-05').every((slot) => slot.isEmptyClassSessionSlot))
assert(week('2026-10-05').every((slot) => getA5ScheduleAttendanceCardState(slot).kind === 'empty'))

const historical = {
  id: 'turtle-historical', classSessionId: 'turtle', scheduleType: 'oneOff',
  date: '2026-09-29', title: 'Turtle', status: 'cancelled', studentIds: ['one'],
}
const cancelledFact = {
  schedule_session_local_id: historical.id, class_session_local_id: 'turtle',
  occurrence_date: historical.date, schedule_type: 'oneoff', lifecycle_state: 'CANCELLED',
  planned_start_time: '17:30:00', planned_end_time: '18:30:00', room: 'Phòng 1',
  roster_student_ids: ['one'], planned_teacher_name: 'An', planned_teacher_id: 'an',
  actual_teacher_override: false,
}
assert.deepEqual(getVisibleScheduleSessions([...assignments, historical], '2026-09-28', [classSession])
  .filter((slot) => slot.classSessionId === 'turtle' && slot.occurrenceDate === '2026-09-29')
  .map((slot) => slot.id), [historical.id])
const withHistory = projectA3ScheduleSessions(
  getVisibleScheduleSessions([...assignments, historical], '2026-09-28', [classSession]),
  { occurrences: [cancelledFact] },
  { scheduleSessions: [...assignments, historical], classSessions: [classSession] },
)
assert.deepEqual(withHistory.filter((slot) => slot.classSessionId === 'turtle'
  && slot.occurrenceDate === '2026-09-29').map((slot) => slot.id), [historical.id])
assert.equal(getA5ScheduleAttendanceCardState(withHistory.find((slot) => slot.id === historical.id)).kind, 'cancelled')
const cancelledRecurringPrint = createSchedulePrintSnapshot({
  weekStartDate: '2026-09-28', sessions: assignments, classSessions: [classSession],
  teacherContext: { occurrences: [{ ...cancelledFact,
    schedule_session_local_id: 'turtle-tuesday' }] },
})
assert.equal(cancelledRecurringPrint.entries.find((entry) => entry.date === '2026-09-29')?.isCancelled, true)
const cancelledHtml = renderScheduleModule(
  [...assignments, historical], null, null, [], null, null, null, null, false, null,
  [], [], '2026-09-28', null,
  { classSessions: [classSession], a3TeacherContext: { occurrences: [cancelledFact] },
    a3TeacherReady: true, occurrenceAttendanceReady: true },
)
assert(!cancelledHtml.includes('data-schedule-id="turtle-tuesday" data-occurrence-date="2026-09-29"'))
assert(!cancelledHtml.includes('data-schedule-id="turtle-historical" data-occurrence-date="2026-09-29"'))

const teacherAssignments = [
  { class_session_local_id: 'turtle', teacher_id: 'an', teacher_name: 'An',
    effective_from: '2026-09-01', effective_to: '2026-09-28' },
  { class_session_local_id: 'turtle', teacher_id: 'binh', teacher_name: 'Bình',
    effective_from: '2026-09-29', effective_to: null },
]
const substitutedFact = {
  ...cancelledFact, occurrence_date: '2026-09-22', lifecycle_state: 'HELD',
  actual_teacher_override: true, actual_teacher_id: 'chi', actual_teacher_name: 'Chi',
}
const prior = { ...historical, date: '2026-09-22', status: 'done' }
const normalOldFact = { ...cancelledFact, schedule_session_local_id: 'turtle-neighbor',
  occurrence_date: '2026-09-24', lifecycle_state: 'HELD' }
const neighbor = { ...historical, id: 'turtle-neighbor', date: '2026-09-24', status: 'done' }
const oldPrint = createSchedulePrintSnapshot({
  weekStartDate: '2026-09-21', sessions: [prior, neighbor], classSessions: [classSession],
  teacherContext: { assignments: teacherAssignments, occurrences: [substitutedFact, normalOldFact] },
})
assert.equal(oldPrint.entries.find((entry) => entry.date === '2026-09-22')?.teacherName, 'Chi')
assert.equal(oldPrint.entries.find((entry) => entry.date === '2026-09-24')?.teacherName, 'An')
const currentPrint = createSchedulePrintSnapshot({
  weekStartDate: '2026-09-28', sessions: assignments, classSessions: [classSession],
  teacherContext: { assignments: teacherAssignments, occurrences: [] },
})
assert.equal(currentPrint.entries.find((entry) => entry.date === '2026-09-29')?.teacherName, 'Bình')
assert.equal(currentPrint.entries.find((entry) => entry.date === '2026-10-01')?.teacherName, 'Bình')
assert(!renderSchedulePrintDocument(currentPrint).includes('>Marker<'))
assert(renderSchedulePrintDocument(currentPrint).includes('>Ký hiệu<'))
const oldTeacher = projectA3ScheduleSessions([
  { ...prior, occurrenceDate: '2026-09-28', scheduleType: 'recurring' },
], { assignments: teacherAssignments })[0]
assert.equal(oldTeacher.teacherName, 'An')

const student = {
  id: 'one', fullName: 'Học viên Một', level: 'Dolphin 1', currentStatus: 'Đang theo học',
  classSessionIds: ['turtle'], recurringEnrollments: [{ classSessionId: 'turtle', weekdays: ['tue', 'thu'] }],
}
const studentHtml = renderStudentDetail(student, [], [classSession], [], {
  scheduleTeacherAssignments: teacherAssignments, scheduleTeacherDate: '2026-09-29',
})
assert(studentHtml.includes('>Bình</span>'))
assert(!studentHtml.includes('Stale static teacher'))
const form = createEditScheduleFormState(assignments[0])
const formHtml = renderScheduleModule(assignments, form, null, [], null, null, null, null, false, null,
  [], [student, { ...student, id: 'two', fullName: 'Học viên Hai', level: 'Turtle 3' }],
  '2026-09-28', null, { classSessions: [classSession], a3TeacherReady: true,
    a3TeacherContext: { assignments: teacherAssignments }, teacherReferenceDate: '2026-09-29' })
assert(formHtml.includes('Giáo viên phụ trách hiện tại'))
assert(formHtml.includes('>Bình</strong>'))
assert(!formHtml.includes('Stale static teacher'))
assert(!formHtml.includes('data-schedule-form-field="level"'))
assert(formHtml.includes('Dolphin 1') && formHtml.includes('Turtle 3'))
assert(!formHtml.includes('H7'))
const newSession = buildScheduleSessionFromForm({ ...createEmptyScheduleFormState().values,
  title: 'Buổi học', date: '2026-10-03', startTime: '09:00', endTime: '10:00', room: 'Phòng 1' })
assert.equal(newSession.level, 'mixed')
assert.equal(buildScheduleSessionFromForm(form.values, { ...assignments[0], level: 'beginner' }, [], [classSession]).level, 'beginner')

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const centerSwitch = mainSource.slice(mainSource.indexOf('async function handleInternalOpenCenter'),
  mainSource.indexOf('function normalizeInternalCenters'))
assert(centerSwitch.includes("refreshModuleAuthoritativeUpstreams('thoi-khoa-bieu', { reason: 'center-switch' })"))
assert(centerSwitch.includes('cloudUserSyncId !== switchSyncId'))
assert(mainSource.includes('runId !== a3TeacherReadRunId'))
assert(!mainSource.includes('moduleRefreshRunIds.clear()'))
console.log('M4_1_SCHEDULE_AUDIT_FIXES_SMOKE_PASS')
