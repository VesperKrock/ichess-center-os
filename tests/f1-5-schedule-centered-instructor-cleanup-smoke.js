import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildScheduleSessionFromForm,
  createEditScheduleFormState,
  getVisibleScheduleSessions,
  renderScheduleModule,
} from '../src/schedule-module.js'
import {
  buildSettingsClassSessionFromForm,
  createEmptySettingsClassSessionFormState,
  initialSettingsFilters,
  renderSettingsModule,
} from '../src/settings-module.js'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  initialStudentFilters,
  renderStudentModule,
} from '../src/student-module.js'

const student = {
  id: 'student-f1-5',
  fullName: 'Synthetic Student',
  birthDate: '2014-02-03',
  schoolName: 'Synthetic School',
  level: 'Dolphin 1',
  parentName: 'Synthetic Guardian',
  currentStatus: 'Đang theo học',
  assignedTeacherId: 'obsolete-teacher-id',
  mainTeacherName: 'Obsolete Student Instructor',
}
const studentForm = createEditStudentFormState(student)
assert.equal(studentForm.values.assignedTeacherId, undefined)
const savedStudent = buildStudentFromForm(studentForm.values, student)
assert.equal(savedStudent.assignedTeacherId, undefined)
assert.equal(savedStudent.mainTeacherName, undefined)
const studentHtml = renderStudentModule(
  [student],
  initialStudentFilters,
  studentForm,
  [{ id: 'obsolete-teacher-id', displayName: 'Registry Instructor' }],
  [],
  { enrollmentCapabilityStatus: 'ready' },
)
assert(!studentHtml.includes('Giáo viên phụ trách'))
assert(!studentHtml.includes('data-student-form-field="assignedTeacherId"'))

const emptySlotForm = createEmptySettingsClassSessionFormState()
assert.equal(emptySlotForm.values.instructorName, '')
const slot = buildSettingsClassSessionFromForm({
  ...emptySlotForm.values,
  daysOfWeek: ['mon'],
  startTime: '09:00',
  endTime: '10:30',
  instructorName: '  Synthetic Slot Instructor  ',
})
assert.equal(slot.instructorName, 'Synthetic Slot Instructor')
const unassignedSlot = { ...slot, id: 'slot-unassigned', instructorName: '' }
const settingsHtml = renderSettingsModule(
  [unassignedSlot],
  [],
  initialSettingsFilters,
  null,
  null,
  { activeTab: 'class-sessions' },
)
assert(settingsHtml.includes('Giáo viên mặc định'))
assert(settingsHtml.includes('Chưa xếp giáo viên'))

const classSession = {
  ...slot,
  id: 'slot-f1-5',
  displayLabel: 'Synthetic slot',
  room: 'QA',
  status: 'active',
}
const recurringAssignment = buildScheduleSessionFromForm({
  scheduleType: 'recurring',
  classSessionId: classSession.id,
  startDate: '',
  endDate: '',
  room: 'QA',
  teacherId: 'registry-id-must-not-persist',
  teacherName: 'schedule-copy-must-not-persist',
  studentIds: [student.id],
  status: 'scheduled',
  level: 'mixed',
}, null, [{ id: 'registry-id-must-not-persist', displayName: 'Registry Instructor' }], [classSession])
assert.equal(recurringAssignment.teacherId, '')
assert.equal(recurringAssignment.teacherName, '')

const visible = getVisibleScheduleSessions(
  [recurringAssignment],
  '2026-09-21',
  [classSession],
)
assert.equal(visible.length, 1)
assert.equal(visible[0].teacherId, '')
assert.equal(visible[0].teacherName, 'Synthetic Slot Instructor')

const noInstructorVisible = getVisibleScheduleSessions([], '2026-09-21', [unassignedSlot])
assert.equal(noInstructorVisible.length, 1)
assert.equal(noInstructorVisible[0].teacherName, '')
const unassignedScheduleHtml = renderScheduleModule(
  [], null, null, [], null, null, null, null, false, null,
  [{ id: 'registry-id', displayName: 'Must stay disconnected' }],
  [student],
  '2026-09-21',
  null,
  { classSessions: [unassignedSlot] },
)
assert(unassignedScheduleHtml.includes('Chưa xếp giáo viên'))
assert(!unassignedScheduleHtml.includes('Must stay disconnected'))

const oneOff = buildScheduleSessionFromForm({
  scheduleType: 'oneOff',
  title: 'Synthetic makeup',
  date: '2026-09-21',
  occurrenceReason: 'makeup',
  startTime: '11:00',
  endTime: '12:00',
  room: 'QA',
  teacherName: 'Synthetic Actual Instructor',
  studentIds: [],
  level: 'mixed',
  status: 'scheduled',
}, null, [], [])
assert.equal(oneOff.teacherId, '')
assert.equal(oneOff.teacherName, 'Synthetic Actual Instructor')

const orphan = {
  ...recurringAssignment,
  id: 'orphan-f1-5',
  classSessionId: 'missing-slot',
  dayOfWeek: 'monday',
  startTime: '13:00',
  endTime: '14:00',
}
const orphanHtml = renderScheduleModule(
  [orphan],
  createEditScheduleFormState(orphan),
  null, [], null, null, null, null, false, null, [], [student], '2026-09-21', null,
  { classSessions: [] },
)
assert(orphanHtml.includes('Ngưng lặp lịch cũ'))
assert(orphanHtml.includes('lịch sử điểm danh'))
assert.equal(getVisibleScheduleSessions([{ ...orphan, isDeleted: true }], '2026-09-21', []).length, 0)

const adminHtml = renderScheduleModule(
  [oneOff], null,
  { sessionId: oneOff.id, occurrenceDate: oneOff.date, mode: 'adminPlaceholder' },
  [], null, null, null, null, false, null,
  [{ id: 'registry-id', displayName: 'Must stay disconnected' }],
  [], '2026-09-21',
  { sessionId: oneOff.id, occurrenceDate: oneOff.date, rows: [] },
  { occurrenceAttendanceReady: true },
)
assert(adminHtml.includes('Điểm danh Admin cơ sở'))
assert(!adminHtml.includes('Bạn là?'))
assert(!adminHtml.includes('data-schedule-report-role'))
assert(!adminHtml.includes('Must stay disconnected'))

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const scheduleSource = readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
const migrationSource = readFileSync(
  new URL('../supabase/migrations/202609200001_f1_5_schedule_centered_instructor_cleanup.sql', import.meta.url),
  'utf8',
)
assert(!scheduleSource.includes('purgeZombie'))
assert(!mainSource.includes('purgeZombie'))
assert(!scheduleSource.includes('data-schedule-report-role'))
assert(!mainSource.includes("mode: 'roleGateway'"))
assert(migrationSource.includes("entity.payload - 'assignedTeacherId' - 'mainTeacherName'"))
assert(migrationSource.includes("'futureRecurrenceRetired', true"))
assert(migrationSource.includes("new.payload := new.payload - 'assignedTeacherId' - 'mainTeacherName'"))
assert(migrationSource.includes("new.payload := new.payload - 'teacherId' - 'teacherName'"))
assert(migrationSource.includes("new.payload->>'isDeleted', 'false'"))
assert(migrationSource.includes('create or replace function public.v2_2_internal_guard_core_identity()'))
assert(migrationSource.includes('revoke all on function public.f1_5_internal_reconcile_schedule_instructor_state()'))

console.log('F1_5_SCHEDULE_CENTERED_INSTRUCTOR_CLEANUP_SMOKE: PASS')
