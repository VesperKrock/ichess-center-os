import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createCenterCalendarTagManagerState,
  createEditScheduleFormState,
  createEmptyCenterCalendarItemFormState,
  createEmptyScheduleFormState,
  renderScheduleModule,
} from '../src/schedule-module.js'

const root = process.cwd()
const mainSource = readFileSync(join(root, 'src/main.js'), 'utf8')
const scheduleSource = readFileSync(join(root, 'src/schedule-module.js'), 'utf8')
const scheduleCss = readFileSync(join(root, 'src/schedule-theme.css'), 'utf8')

const teachers = [{ id: 'qa-teacher', fullName: 'QA Teacher', displayName: 'QA Teacher', status: 'active' }]
const students = Array.from({ length: 50 }, (_, index) => ({
  id: `qa-student-${index + 1}`,
  fullName: `QA Student ${index + 1}`,
  level: 'QA level',
  parentName: 'QA parent',
}))
const classSessions = [{
  id: 'qa-class',
  name: 'QA Class',
  title: 'QA Class',
  days: ['monday'],
  daysOfWeek: ['monday'],
  startTime: '18:30',
  endTime: '20:00',
  room: 'QA Room',
  status: 'active',
}]
const sessions = [{
  id: 'qa-session',
  scheduleType: 'oneOff',
  title: 'QA Session',
  date: '2026-08-17',
  dayOfWeek: 'monday',
  startTime: '18:30',
  endTime: '20:00',
  room: 'QA Room',
  teacherId: 'qa-teacher',
  teacherName: 'QA Teacher',
  studentIds: students.map((student) => student.id),
  level: 'beginner',
  status: 'scheduled',
}]

function render(overrides = {}) {
  return renderScheduleModule(
    overrides.sessions ?? sessions,
    overrides.formState ?? null,
    overrides.reportState ?? null,
    [],
    null,
    null,
    null,
    null,
    false,
    null,
    teachers,
    students,
    '2026-08-17',
    overrides.adminAttendanceState ?? null,
    {
      classSessions,
      attendanceAvailable: overrides.attendanceAvailable !== false,
      calendarNotesAvailable: overrides.calendarNotesAvailable !== false,
      centerCalendarItems: [],
      centerCalendarTags: [],
      centerCalendarFilters: { itemType: 'all', tagId: 'all' },
      centerCalendarItemState: overrides.centerCalendarItemState ?? null,
      centerCalendarTagState: overrides.centerCalendarTagState ?? null,
      calendarNotesSharedTruthState: { message: 'QA ready', messageTone: 'success' },
      attendanceRecords: [],
    },
  )
}

const mainHtml = render()
for (const token of [
  'schedule-page-header',
  'data-schedule-print-action="print"',
  'data-center-calendar-tag-action="open-manager"',
  'data-center-calendar-action="open-create"',
  'data-schedule-action="open-create"',
  'data-schedule-week-action="previous"',
  'data-schedule-week-action="today"',
  'data-schedule-week-action="next"',
  'data-center-calendar-filter="itemType"',
  'data-center-calendar-filter="tagId"',
  'data-schedule-action="open-edit"',
  'data-schedule-action="open-create-for-day"',
]) assert(mainHtml.includes(token), `Missing Schedule runtime control: ${token}`)

const optionalUnavailableHtml = render({ calendarNotesAvailable: false })
assert(optionalUnavailableHtml.includes('data-schedule-action="open-create"'))
assert(!optionalUnavailableHtml.includes('data-center-calendar-action="open-create"'))
assert(!optionalUnavailableHtml.includes('data-center-calendar-tag-action="open-manager"'))
assert.equal((optionalUnavailableHtml.match(/data-schedule-optional-capability="calendar-notes"/g) || []).length, 2)
assert.equal((optionalUnavailableHtml.match(/data-capability-state="unavailable"/g) || []).length, 2)
assert.equal((optionalUnavailableHtml.match(/disabled aria-disabled="true" tabindex="-1"/g) || []).length, 2)
assert(optionalUnavailableHtml.includes('Quản lý nhãn <span>Chưa khả dụng</span>'))
assert(optionalUnavailableHtml.includes('+ Thêm hoạt động <span>Chưa khả dụng</span>'))
assert(!optionalUnavailableHtml.includes('data-center-calendar-filter="itemType"'))

const sessionFormHtml = render({ formState: createEmptyScheduleFormState() })
for (const token of [
  'is-session-form-panel',
  'data-schedule-form-field="title"',
  'data-schedule-form-field="date"',
  'data-schedule-form-field="startTime"',
  'data-schedule-form-field="endTime"',
  'data-schedule-form-field="room"',
  'data-schedule-form-field="teacherId"',
  'data-schedule-action="toggle-student-picker"',
  'data-schedule-action="cancel-form"',
  'data-schedule-action="save-form"',
]) assert(sessionFormHtml.includes(token), `Missing Add Session capability: ${token}`)

const fixedFormState = createEditScheduleFormState({
  id: 'qa-fixed',
  scheduleType: 'recurring',
  classSessionId: 'qa-class',
  title: 'QA Class',
  dayOfWeek: 'monday',
  startTime: '18:30',
  endTime: '20:00',
  room: 'QA Room',
  teacherId: '',
  teacherName: '',
  studentIds: [],
  level: 'beginner',
  status: 'scheduled',
})
const fixedHtml = render({ formState: fixedFormState })
assert(fixedHtml.includes('is-fixed-slot-panel'))
assert(fixedHtml.includes('Gán thông tin ca học'))
assert(fixedHtml.includes('data-schedule-action="save-form"'))

const activityHtml = render({ centerCalendarItemState: createEmptyCenterCalendarItemFormState('2026-08-17') })
for (const token of [
  'schedule-calendar-form-column is-primary',
  'schedule-calendar-form-column is-secondary',
  'data-center-calendar-form-field="itemType"',
  'data-center-calendar-form-field="title"',
  'data-center-calendar-form-field="recurrenceFrequency"',
  'data-center-calendar-action="select-color"',
  'data-center-calendar-action="reset-color"',
  'data-center-calendar-action="close"',
  'data-center-calendar-action="save"',
]) assert(activityHtml.includes(token), `Missing Add Activity capability: ${token}`)

const labelsHtml = render({ centerCalendarTagState: createCenterCalendarTagManagerState() })
for (const token of [
  'data-center-calendar-tag-action="create"',
  'schedule-calendar-tag-section-title',
  'schedule-calendar-tag-manager-footer',
  'data-center-calendar-tag-action="close"',
]) assert(labelsHtml.includes(token), `Missing Labels capability: ${token}`)

const attendanceHtml = render({
  reportState: { sessionId: 'qa-session', occurrenceDate: '2026-08-17', mode: 'adminPlaceholder' },
  adminAttendanceState: {
    rows: students.map((student) => ({ studentId: student.id, attendanceStatus: '', note: '' })),
  },
})
for (const token of [
  'schedule-admin-attendance-compact',
  'data-schedule-action="close-report"',
  'data-admin-attendance-action="mark-all-present"',
  'data-admin-attendance-status',
  'data-admin-attendance-note',
  'data-schedule-report-role="gateway"',
  'data-admin-attendance-action="clear"',
  'data-admin-attendance-action="save"',
  'schedule-admin-attendance-footer',
]) assert(attendanceHtml.includes(token), `Missing Attendance capability: ${token}`)
assert.equal((attendanceHtml.match(/data-admin-attendance-row=/g) || []).length, 50)

const attendanceUnavailableHtml = render({
  reportState: { sessionId: 'qa-session', occurrenceDate: '2026-08-17', mode: 'adminPlaceholder' },
  attendanceAvailable: false,
})
assert(!attendanceUnavailableHtml.includes('schedule-admin-attendance-compact'))
assert(attendanceUnavailableHtml.includes('role="status"'))

assert(mainSource.includes("import './schedule-theme.css'"))
assert(mainSource.includes("isScheduleWindow ? 'is-schedule-window' : ''"))
for (const binding of [
  "querySelectorAll('[data-schedule-week-action]')",
  "querySelector('[data-schedule-action=\"open-create\"]')",
  "querySelector('[data-center-calendar-action=\"open-create\"]')",
  "querySelector('[data-schedule-print-action=\"print\"]')",
  "querySelector('[data-center-calendar-tag-action=\"open-manager\"]')",
  "querySelectorAll('[data-schedule-action=\"open-create-for-day\"]')",
  "querySelectorAll('[data-schedule-action=\"open-edit\"]')",
  "querySelectorAll('[data-center-calendar-tag-action]')",
  "querySelectorAll('[data-schedule-form-field]')",
  "querySelectorAll('[data-admin-attendance-status]')",
  "querySelectorAll('[data-admin-attendance-action]')",
]) assert(mainSource.includes(binding), `Missing existing runtime binding: ${binding}`)

assert(scheduleSource.includes("const attendanceAvailable = deadlineOptions.attendanceAvailable !== false"))
assert(scheduleSource.includes("const calendarNotesAvailable = deadlineOptions.calendarNotesAvailable !== false"))
assert(scheduleSource.includes("reportState && attendanceAvailable"))

for (const token of [
  '.desktop-window.is-schedule-window',
  ':root[data-ui-theme="dark"] .desktop-window.is-schedule-window',
  '.schedule-week-scroll',
  'overflow: auto;',
  '.schedule-day-header',
  'position: sticky;',
  '.schedule-day-sessions',
  'overflow: visible;',
  '.schedule-calendar-form-grid',
  '.schedule-calendar-tag-manager-body',
  '.schedule-admin-attendance-rows',
  '.schedule-admin-attendance-footer',
  '--schedule-text-help:',
  '--schedule-text-placeholder:',
  '.module-authoritative-refresh-notice.is-fresh',
  '.module-authoritative-refresh-notice.is-unfresh',
  '.schedule-role-gateway',
  '.schedule-role-options button:not(:disabled)',
  '@media (max-width: 1160px)',
  '@media (max-width: 900px)',
  '@media (max-height: 680px)',
]) assert(scheduleCss.includes(token), `Missing Schedule paint contract: ${token}`)

assert.doesNotMatch(scheduleCss, /\bzoom\s*:/, 'Schedule paint must not use CSS zoom')
assert.doesNotMatch(scheduleCss, /\bscale\s*\(/, 'Schedule paint must not scale the UI')
assert.doesNotMatch(scheduleCss, /\.taskbar\b/, 'Schedule paint must not target the runtime taskbar')
assert.doesNotMatch(scheduleCss, /\.window-titlebar\b/, 'Schedule paint must not repaint runtime window chrome')

const modalFoundation = scheduleCss.match(
  /\.desktop-window\.is-schedule-window \.schedule-form-panel,\s*\.desktop-window\.is-schedule-window \.schedule-report-panel \{([\s\S]*?)\n\}/,
)?.[1] || ''
assert.match(modalFoundation, /\bopacity:\s*1;/, 'Active Schedule foreground modals must remain fully opaque')
assert.match(modalFoundation, /\bfilter:\s*none;/, 'Active Schedule foreground modals must not inherit dim filters')

const backdropBlock = scheduleCss.match(
  /\.desktop-window\.is-schedule-window \.schedule-form-backdrop \{([\s\S]*?)\n\}/,
)?.[1] || ''
assert.match(backdropBlock, /background:\s*rgba\([^;]+\);/, 'Schedule dimming must use an overlay background')
assert.doesNotMatch(backdropBlock, /\bopacity\s*:/, 'Schedule backdrop must not dim foreground through parent opacity')

console.log('U2_SCHEDULE_PAGE_PAINT_SMOKE: PASS')
