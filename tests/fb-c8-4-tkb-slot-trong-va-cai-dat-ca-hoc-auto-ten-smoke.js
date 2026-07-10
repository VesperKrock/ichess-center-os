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
import {
  buildClassSessionAutoName,
  buildSettingsClassSessionFromForm,
  renderSettingsModule,
  validateSettingsClassSessionForm,
} from '../src/settings-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const scheduleSource = fs.readFileSync(path.join(root, 'src', 'schedule-module.js'), 'utf8')
const settingsSource = fs.readFileSync(path.join(root, 'src', 'settings-module.js'), 'utf8')
const stylesSource = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8')
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')

const teacher = {
  id: 'teacher-fb-c8-4',
  fullName: 'Teacher FB C8.4',
  displayName: 'Coach FB',
  status: 'active',
}

const student = {
  id: 'student-fb-c8-4',
  fullName: 'Student FB C8.4',
  assignedTeacherId: teacher.id,
}

const classSession = buildSettingsClassSessionFromForm(
  {
    daysOfWeek: ['mon'],
    startTime: '05:00',
    endTime: '06:30',
    note: 'Auto name fixed slot',
    status: 'active',
  },
  null,
  [],
)

assert.equal(classSession.name, 'T2 05:00 - 06:30')
assert.equal(classSession.displayLabel, 'T2 05:00 - 06:30')
assert.equal(buildClassSessionAutoName({ daysOfWeek: ['tue', 'thu'], startTime: '16:00', endTime: '17:30' }), 'T3 - T5 16:00 - 17:30')

const tooManyDaysErrors = validateSettingsClassSessionForm({
  daysOfWeek: ['mon', 'tue', 'wed'],
  startTime: '16:00',
  endTime: '17:30',
})
assert.equal(tooManyDaysErrors.daysOfWeek, 'Mỗi ca học chỉ chọn tối đa 2 ngày học.')

const missingNameErrors = validateSettingsClassSessionForm({
  daysOfWeek: ['mon'],
  startTime: '05:00',
  endTime: '06:30',
})
assert.equal(missingNameErrors.name, undefined, 'ClassSession form must not require manual name.')

const settingsHtml = renderSettingsModule(
  [classSession],
  [student],
  {},
  {
    mode: 'create',
    classSessionId: null,
    values: {
      daysOfWeek: ['tue', 'thu'],
      startTime: '16:00',
      endTime: '17:30',
      note: '',
      status: 'active',
    },
    errors: {},
  },
)

assert(settingsHtml.includes('Tên ca học'), 'Settings form must show auto-name preview label.')
assert(!settingsHtml.includes('Tên ca học tự sinh'), 'Settings form must not show "Tên ca học tự sinh".')
assert(settingsHtml.includes('T3 - T5 16:00 - 17:30'), 'Settings form must preview generated name.')
assert(!settingsHtml.includes('data-settings-class-session-field="name"'), 'Settings form must not render manual name input.')
assert(settingsHtml.includes('data-settings-class-day-toggle="tue"'), 'Day pill label must be clickable.')
assert(settingsHtml.includes('data-settings-class-session-day'), 'Day checkbox must remain available.')

const emptySlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(emptySlots.length, 1)
assert.equal(emptySlots[0].isEmptyClassSessionSlot, true)
assert.equal(emptySlots[0].classSessionId, classSession.id)

const assignFormState = {
  ...createEmptyScheduleFormState(),
  mode: 'assign',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'recurring',
    classSessionId: classSession.id,
    dayOfWeek: 'monday',
    startTime: classSession.startTime,
    endTime: classSession.endTime,
    room: '',
    groupName: classSession.displayLabel,
    teacherId: teacher.id,
    teacherName: teacher.displayName,
    studentIds: [student.id],
    status: 'scheduled',
  },
}

const assignHtml = renderScheduleModule(
  [],
  assignFormState,
  null,
  [],
  [],
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

assert(assignHtml.includes('schedule-form-backdrop'), 'Empty fixed slot must not open an empty overlay only.')
assert(assignHtml.includes('schedule-form-panel'), 'Empty fixed slot must render assignment form panel.')
assert(assignHtml.includes('data-schedule-form-field="classSessionId"'), 'Assignment form must keep classSessionId field.')
assert(assignHtml.includes('data-schedule-form-field="teacherId"'), 'Assignment form must render teacher select.')
assert(assignHtml.includes('data-schedule-student-field'), 'Assignment form must render student picker.')

const assignment = buildScheduleSessionFromForm(assignFormState.values, null, [teacher], [classSession])
assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])
assert.equal(assignment.startTime, classSession.startTime)
assert.equal(assignment.endTime, classSession.endTime)

const assignedSlots = getVisibleScheduleSessions([assignment], '2026-07-06', [classSession])
assert.equal(assignedSlots[0].isEmptyClassSessionSlot, false)
assert.equal(assignedSlots[0].assignmentId, assignment.id)
assert.equal(getTeacherScheduleSessions(teacher, [assignment]).length, 1, 'Teacher Portal C8.4 must still read assigned fixed slot.')

const clearedSlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(clearedSlots[0].isEmptyClassSessionSlot, true, 'Clear assignment must return the fixed slot to empty state.')

const oneOffHtml = renderScheduleModule(
  [
    {
      id: 'one-off-fb-c8-4',
      scheduleType: 'oneOff',
      date: '2026-07-06',
      dayOfWeek: 'monday',
      title: 'Manual makeup session',
      occurrenceReason: 'makeup',
      startTime: '18:00',
      endTime: '19:30',
      room: 'Room OneOff',
      teacherId: teacher.id,
      studentIds: [student.id],
      status: 'scheduled',
    },
  ],
  {
    ...createEmptyScheduleFormState(),
    values: {
      ...createEmptyScheduleFormState().values,
      scheduleType: 'oneOff',
      title: 'Manual makeup session',
      occurrenceReason: 'makeup',
      date: '2026-07-06',
    },
  },
  null,
  [],
  [],
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

assert(oneOffHtml.includes('data-schedule-form-field="title"'), 'One-off/makeup must keep manual title field.')
assert(oneOffHtml.includes('type="time"'), 'One-off/makeup must keep manual time inputs.')
assert(!oneOffHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup must not require classSessionId.')

assert(stylesSource.includes('.schedule-form-panel') && stylesSource.includes('position: fixed'), 'Schedule assignment form must be fixed above the dim overlay.')
assert(settingsSource.includes('buildClassSessionAutoName'), 'Settings module must expose auto-name helper.')
assert(mainSource.includes('Mỗi ca học chỉ chọn tối đa 2 ngày học.'), 'Runtime must block selecting more than two days.')
assert(mainSource.includes('updateSettingsClassSessionAutoNamePreview'), 'Runtime must update auto-name preview after day/time changes.')

;[
  'auth.admin',
  'createUser',
  'signUp',
  'SUPABASE_SERVICE_ROLE_KEY',
  'saveStoredAttendance',
  'saveStoredTuition',
  'attendance-to-tuition',
  'usedSessions',
].forEach((forbidden) => {
  assert(!scheduleSource.includes(forbidden), `Schedule source must not include forbidden marker ${forbidden}`)
  assert(!settingsSource.includes(forbidden), `Settings source must not include forbidden marker ${forbidden}`)
})

console.log('FB C8.4 TKB empty slot and Settings auto-name smoke: PASS')
