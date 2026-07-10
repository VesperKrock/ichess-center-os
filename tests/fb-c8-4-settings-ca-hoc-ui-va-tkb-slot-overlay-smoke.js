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

const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')
const settingsSource = fs.readFileSync(path.join(root, 'src', 'settings-module.js'), 'utf8')
const stylesSource = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8')

const teacher = { id: 'teacher-ui-overlay', fullName: 'Teacher UI Overlay', displayName: 'Coach UI' }
const student = { id: 'student-ui-overlay', fullName: 'Student UI Overlay', assignedTeacherId: teacher.id }

const classSession = buildSettingsClassSessionFromForm(
  {
    daysOfWeek: ['mon', 'tue'],
    startTime: '17:00',
    endTime: '18:30',
    status: 'active',
    note: '',
  },
  null,
  [],
)

assert.equal(buildClassSessionAutoName({ daysOfWeek: ['mon', 'tue'], startTime: '17:00', endTime: '18:30' }), 'T2 - T3 17:00 - 18:30')
assert.equal(classSession.name, 'T2 - T3 17:00 - 18:30')
assert.equal(classSession.displayLabel, 'T2 - T3 17:00 - 18:30')
assert.equal(
  validateSettingsClassSessionForm({ daysOfWeek: ['mon', 'tue', 'wed'], startTime: '17:00', endTime: '18:30' }).daysOfWeek,
  'Mỗi ca học chỉ chọn tối đa 2 ngày học.',
)

const settingsHtml = renderSettingsModule(
  [classSession],
  [student],
  {},
  {
    mode: 'create',
    classSessionId: null,
    values: {
      daysOfWeek: ['mon', 'tue'],
      startTime: '17:00',
      endTime: '18:30',
      status: 'active',
      note: '',
    },
    errors: {},
  },
)

assert(settingsHtml.includes('Tên ca học'), 'Settings form must show the requested label.')
assert(!settingsHtml.includes('Tên ca học tự sinh'), 'Settings form must not show "Tên ca học tự sinh".')
assert(!settingsHtml.includes('data-settings-class-session-field="name"'), 'Manual class session name input must stay removed.')
assert(settingsHtml.includes('settings-class-session-form-grid'), 'Settings form must use the dedicated class-session layout grid.')
assert(settingsHtml.includes('settings-class-session-time-column'), 'Start/end time must share the right-side time column.')
assert(settingsHtml.includes('data-settings-class-day-toggle="mon"'), 'Day pill must expose a real toggle target.')
assert(settingsHtml.includes('data-settings-class-session-day'), 'Checkbox must remain available for direct click.')

assert(mainSource.includes("document.querySelectorAll('[data-settings-class-day-toggle]')"), 'Runtime must bind day pill toggle events.')
assert(mainSource.includes("checkbox.dispatchEvent(new Event('change', { bubbles: true }))"), 'Pill click must toggle real checkbox state.')
assert(stylesSource.includes('.settings-class-session-form-grid'), 'CSS must define Settings class-session grid layout.')
assert(stylesSource.includes('.settings-class-session-time-column'), 'CSS must define a shared time column.')

const emptySlots = getVisibleScheduleSessions([], '2026-07-06', [classSession])
assert.equal(emptySlots.length, 2, 'Two-day class session must materialize two fixed slots in TKB.')
assert(emptySlots.every((slot) => slot.isEmptyClassSessionSlot), 'Unassigned fixed slots must be empty slots.')

const assignState = {
  ...createEmptyScheduleFormState(),
  mode: 'assign',
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'recurring',
    classSessionId: classSession.id,
    dayOfWeek: 'monday',
    startTime: classSession.startTime,
    endTime: classSession.endTime,
    groupName: classSession.displayLabel,
    teacherId: teacher.id,
    teacherName: teacher.displayName,
    studentIds: [student.id],
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
  '2026-07-06',
  null,
  { classSessions: [classSession] },
)

assert(assignHtml.includes('schedule-form-backdrop'), 'Clicking an empty fixed slot must render backdrop.')
assert(assignHtml.includes('schedule-form-panel'), 'Clicking an empty fixed slot must render dialog content, not only backdrop.')
assert(assignHtml.includes('data-schedule-form-field="classSessionId"'), 'Assignment form must keep classSessionId context.')
assert(assignHtml.includes('data-schedule-form-field="teacherId"'), 'Assignment form must allow teacher assignment.')
assert(assignHtml.includes('data-schedule-student-field'), 'Assignment form must allow student assignment.')

const backdropZ = Number(stylesSource.match(/\.schedule-form-backdrop\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])
const panelZ = Number(stylesSource.match(/\.schedule-form-panel\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1])
assert(Number.isFinite(backdropZ) && Number.isFinite(panelZ), 'Schedule overlay z-index must be explicit.')
assert(panelZ > backdropZ, 'Schedule dialog must be above backdrop.')
assert(panelZ >= 181, 'Schedule dialog z-index must be above app windows/system overlays audited for this flow.')
assert(stylesSource.includes('max-height: min(680px, calc(100vh - 28px))'), 'Schedule dialog height must be viewport-based, not clipped by module container.')

const assignment = buildScheduleSessionFromForm(assignState.values, null, [teacher], [classSession])
assert.equal(assignment.classSessionId, classSession.id)
assert.equal(assignment.teacherId, teacher.id)
assert.deepEqual(assignment.studentIds, [student.id])
assert.equal(getTeacherScheduleSessions(teacher, [assignment]).length, 1, 'C8.4 Teacher Portal must still read assigned fixed slot.')
assert.equal(getVisibleScheduleSessions([], '2026-07-06', [classSession])[0].isEmptyClassSessionSlot, true)

const oneOffHtml = renderScheduleModule(
  [],
  {
    ...createEmptyScheduleFormState(),
    values: {
      ...createEmptyScheduleFormState().values,
      scheduleType: 'oneOff',
      title: 'Manual makeup',
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
  '2026-07-06',
  null,
  { classSessions: [classSession] },
)

assert(oneOffHtml.includes('data-schedule-form-field="title"'), 'One-off/makeup must keep manual title.')
assert(oneOffHtml.includes('type="time"'), 'One-off/makeup must keep manual time inputs.')
assert(!oneOffHtml.includes('data-schedule-form-field="classSessionId"'), 'One-off/makeup must not require classSessionId.')

;['auth.admin', 'createUser', 'signUp', 'SUPABASE_SERVICE_ROLE_KEY', 'saveStoredAttendance', 'saveStoredTuition', 'usedSessions'].forEach(
  (forbidden) => {
    assert(!settingsSource.includes(forbidden), `Settings source must not include forbidden marker ${forbidden}`)
  },
)

console.log('FB C8.4 Settings class session UI and TKB slot overlay smoke: PASS')
