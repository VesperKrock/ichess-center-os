import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildScheduleSessionFromForm,
  createEmptyScheduleFormState,
  getVisibleScheduleSessions,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')
const stylesSource = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8')
const scheduleSource = fs.readFileSync(path.join(root, 'src', 'schedule-module.js'), 'utf8')

const teacher = {
  id: 'teacher-empty-slot-dom',
  fullName: 'Teacher Empty Slot DOM',
  displayName: 'Coach DOM',
}

const student = {
  id: 'student-empty-slot-dom',
  fullName: 'Student Empty Slot DOM',
  assignedTeacherId: teacher.id,
}

const classSession = {
  id: 'class-session-empty-slot-dom',
  name: 'T2 01:00 - 02:30',
  displayLabel: 'T2 01:00 - 02:30',
  daysOfWeek: ['mon'],
  daysLabel: 'T2',
  startTime: '01:00',
  endTime: '02:30',
  status: 'active',
}

const pastWeekStart = '2026-07-06'
const emptySlots = getVisibleScheduleSessions([], pastWeekStart, [classSession])
assert.equal(emptySlots.length, 1)
assert.equal(emptySlots[0].isEmptyClassSessionSlot, true)
assert.equal(emptySlots[0].classSessionId, classSession.id)
assert.equal(emptySlots[0].occurrenceDate, '2026-07-06')

const emptySlotBranchIndex = mainSource.indexOf('if (occurrence?.isEmptyClassSessionSlot)')
const pastBranchIndex = mainSource.indexOf('isPastScheduleOccurrence(occurrence)', emptySlotBranchIndex)
assert(emptySlotBranchIndex > -1, 'Click handler must branch empty fixed slot explicitly.')
assert(pastBranchIndex > emptySlotBranchIndex, 'Empty fixed slot branch must run before past-occurrence report branch.')

const assignState = {
  ...createEmptyScheduleFormState(),
  mode: 'assign',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'recurring',
    classSessionId: emptySlots[0].classSessionId,
    title: '',
    dayOfWeek: emptySlots[0].dayOfWeek,
    startTime: emptySlots[0].startTime,
    endTime: emptySlots[0].endTime,
    room: '',
    groupName: emptySlots[0].classSessionLabel,
    teacherId: '',
    studentIds: [],
    level: emptySlots[0].level,
    status: 'scheduled',
  },
}

const assignHtml = renderScheduleModule(
  [],
  assignState,
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
  pastWeekStart,
  null,
  { classSessions: [classSession] },
)

assert(assignHtml.includes('schedule-form-backdrop'), 'Backdrop must render for assign form.')
assert(assignHtml.includes('schedule-form-panel'), 'Dialog must render with backdrop; no backdrop-only state.')
assert(assignHtml.includes('data-schedule-form'), 'Dialog must contain the schedule form.')
assert(assignHtml.includes('data-schedule-form-field="classSessionId"'), 'Assign dialog must keep classSessionId context.')
assert(assignHtml.includes(classSession.id), 'Assign dialog must include the source classSessionId.')
assert(assignHtml.includes('data-schedule-form-field="teacherId"'), 'Assign dialog must include teacher field.')
assert(assignHtml.includes('data-schedule-student-field'), 'Assign dialog must include student field.')
assert(assignHtml.includes('Gán thông tin') || assignHtml.includes('slot'), 'Assign dialog must show fixed-slot context text.')

const backdropZ = Number(stylesSource.match(/\.schedule-form-backdrop\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])
const panelZ = Number(stylesSource.match(/\.schedule-form-panel\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])
assert(Number.isFinite(backdropZ), 'Backdrop z-index must be explicit.')
assert(Number.isFinite(panelZ), 'Dialog z-index must be explicit.')
assert(panelZ > backdropZ, 'Dialog z-index must be higher than backdrop.')
assert(stylesSource.includes('position: fixed'), 'Schedule form overlay must be fixed to viewport.')
assert(stylesSource.includes('calc(100vh - 28px)'), 'Schedule form max-height must be viewport-based.')

const assignment = buildScheduleSessionFromForm(
  {
    ...assignState.values,
    title: 'Assigned empty slot DOM',
    teacherId: teacher.id,
    teacherName: teacher.displayName,
    studentIds: [student.id],
  },
  null,
  [teacher],
  [classSession],
)
assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])

const assignedSlots = getVisibleScheduleSessions([assignment], pastWeekStart, [classSession])
assert.equal(assignedSlots[0].isEmptyClassSessionSlot, false)
assert.equal(assignedSlots[0].assignmentId, assignment.id)
assert.equal(getTeacherScheduleSessions(teacher, [assignment]).length, 1, 'C8.4 Teacher Portal must still see assigned fixed slot.')

const clearedSlots = getVisibleScheduleSessions([], pastWeekStart, [classSession])
assert.equal(clearedSlots[0].isEmptyClassSessionSlot, true)
assert.equal(clearedSlots[0].classSessionId, classSession.id)

const oneOffHtml = renderScheduleModule(
  [],
  {
    ...createEmptyScheduleFormState(),
    values: {
      ...createEmptyScheduleFormState().values,
      scheduleType: 'oneOff',
      title: 'Manual makeup stays manual',
      occurrenceReason: 'makeup',
      date: '2026-07-06',
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
  [student],
  pastWeekStart,
  null,
  { classSessions: [classSession] },
)
assert(oneOffHtml.includes('data-schedule-form-field="title"'), 'One-off/makeup must keep manual title.')
assert(oneOffHtml.includes('type="time"'), 'One-off/makeup must keep manual time inputs.')
assert(!oneOffHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup must not require classSessionId.')

;['auth.admin', 'createUser', 'signUp', 'SUPABASE_SERVICE_ROLE_KEY', 'saveStoredAttendance', 'saveStoredTuition', 'usedSessions'].forEach(
  (forbidden) => {
    assert(!scheduleSource.includes(forbidden), `Schedule source must not include forbidden marker ${forbidden}`)
  },
)

console.log('FB C8.4 TKB empty slot overlay DOM investigation smoke: PASS')

