import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildCenterCalendarItemFromForm,
  createCenterCalendarItemDeleteState,
  createCenterCalendarItemDetailState,
  createEditCenterCalendarItemFormState,
  createEmptyCenterCalendarItemFormState,
  createEmptyScheduleFormState,
  renderScheduleModule,
  validateCenterCalendarItemForm,
} from '../src/schedule-module.js'
import {
  CENTER_CALENDAR_COLOR_PRESETS,
  CENTER_CALENDAR_ITEM_TYPES,
  getCenterCalendarItemById,
  loadStoredCenterCalendarItems,
  saveStoredCenterCalendarItems,
} from '../src/center-calendar-data.js'

const repoRoot = process.cwd()
const mainPath = path.join(repoRoot, 'src', 'main.js')
const schedulePath = path.join(repoRoot, 'src', 'schedule-module.js')
const dataPath = path.join(repoRoot, 'src', 'center-calendar-data.js')
const stylesPath = path.join(repoRoot, 'src', 'styles.css')
const docsPath = path.join(repoRoot, 'docs', 'f23-5c-crud-center-calendar-items-local-safe.md')

const main = fs.readFileSync(mainPath, 'utf8')
const schedule = fs.readFileSync(schedulePath, 'utf8')
const data = fs.readFileSync(dataPath, 'utf8')
const styles = fs.readFileSync(stylesPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')

assert.deepEqual(CENTER_CALENDAR_ITEM_TYPES, ['meeting', 'event', 'tournament', 'other'])

const lessonCreateState = {
  ...createEmptyScheduleFormState(),
  values: {
    ...createEmptyScheduleFormState().values,
    scheduleType: 'oneOff',
    title: 'Hoc bu',
    date: '2026-07-21',
    occurrenceReason: 'makeup',
    startTime: '09:00',
    endTime: '10:00',
    room: 'Phong 1',
  },
}
const lessonCreateHtml = renderScheduleModule([], lessonCreateState, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItems: [],
  classSessions: [],
})
for (const label of ['Học bù', 'Học thử', 'Học thêm', 'Buổi học khác']) {
  assert(lessonCreateHtml.includes(label), `Lesson create form missing reason: ${label}`)
}
const lessonReasonSelectHtml = getSnippetAround(lessonCreateHtml, 'data-schedule-form-field="occurrenceReason"', 900)
assert(!lessonReasonSelectHtml.includes('value="event"'), 'Lesson create form must not offer event as a new reason.')
assert(!lessonCreateHtml.includes('>Khác<'), 'Lesson create form must not use generic Khac label.')

const legacyEventEditHtml = renderScheduleModule(
  [
    {
      id: 'legacy-event-session',
      scheduleType: 'oneOff',
      title: 'Legacy event reason session',
      date: '2026-07-21',
      occurrenceReason: 'event',
      startTime: '09:00',
      endTime: '10:00',
      room: 'Phong 1',
      studentIds: [],
    },
  ],
  {
    ...createEmptyScheduleFormState(),
    mode: 'edit',
    sessionId: 'legacy-event-session',
    values: {
      ...createEmptyScheduleFormState().values,
      scheduleType: 'oneOff',
      title: 'Legacy event reason session',
      date: '2026-07-21',
      occurrenceReason: 'event',
      startTime: '09:00',
      endTime: '10:00',
      room: 'Phong 1',
      studentIds: [],
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
  [],
  [],
  '2026-07-20',
  null,
  { centerCalendarItems: [], classSessions: [] },
)
assert(legacyEventEditHtml.includes('value="event" selected'), 'Legacy event reason must remain editable without migration.')

const emptyState = createEmptyCenterCalendarItemFormState('2026-07-20')
const formHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: emptyState,
  centerCalendarItems: [],
  classSessions: [],
})

assert(formHtml.includes('+ Thêm buổi học'), 'Existing lesson create action must remain.')
assert(formHtml.includes('+ Thêm hoạt động'), 'Activity create action must render.')
assert(formHtml.includes('data-center-calendar-action="open-create"'), 'Activity entry point must have a dedicated action.')
assert(formHtml.includes('data-center-calendar-form'), 'Activity form must render separately.')

for (const field of ['itemType', 'title', 'date', 'allDay', 'startTime', 'endTime', 'location', 'description', 'colorKey', 'colorOverridden']) {
  assert(formHtml.includes(`data-center-calendar-form-field="${field}"`), `Missing activity field: ${field}`)
}
for (const type of CENTER_CALENDAR_ITEM_TYPES) {
  assert(formHtml.includes(`value="${type}"`), `Missing activity type option: ${type}`)
}
for (const lessonReason of ['makeup', 'trial', 'extra']) {
  assert(!formHtml.includes(`value="${lessonReason}"`), `Activity form must not include lesson reason: ${lessonReason}`)
}
assert(!formHtml.includes('data-center-calendar-form-field="tagIds"'), 'Later tag UI must stay single-label and not add multi-tag.')
assert(!formHtml.includes('data-center-calendar-form-field="recurrenceRule"'), 'F23.5C must not add recurrence UI.')
assert.equal((formHtml.match(/data-center-calendar-color-key=/g) || []).length, 9, 'Activity palette should render about 8 basic color swatches.')
for (const colorKey of ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray', 'emerald']) {
  assert(formHtml.includes(`data-center-calendar-color-key="${colorKey}"`), `Missing palette color: ${colorKey}`)
}
assert(formHtml.includes('data-center-calendar-action="select-color"'), 'Palette swatches must be clickable buttons.')
assert(formHtml.includes('aria-pressed="true"'), 'Selected palette swatch must expose pressed state.')
assert(formHtml.includes('✓'), 'Selected palette swatch must show a check mark.')
assert(formHtml.includes('Đặt lại theo loại'), 'Palette must include reset-to-type action.')

assert(validateCenterCalendarItemForm({ ...emptyState.values, title: '' }).title, 'Empty title must be invalid.')
assert(validateCenterCalendarItemForm({ ...emptyState.values, itemType: 'classSession', title: 'Bad' }).itemType, 'Class/session item type must be rejected.')
assert(validateCenterCalendarItemForm({ ...emptyState.values, title: 'Bad time', startTime: '10:00', endTime: '09:00' }).endTime, 'End time must be after start time.')
assert.deepEqual(validateCenterCalendarItemForm({ ...emptyState.values, title: 'Hop team' }), {}, 'Valid meeting form should pass.')

const created = buildCenterCalendarItemFromForm(
  {
    itemType: 'meeting',
    title: ' Hop team ',
    date: '2026-07-21',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    location: 'Phong 1',
    description: 'Noi dung',
    colorKey: 'purple',
  },
  null,
  'demo-center',
)

assert.equal(created.centerId, 'demo-center')
assert.equal(created.itemType, 'meeting')
assert.equal(created.title, 'Hop team')
assert.equal(created.sourceModule, 'centerCalendar')
assert.equal(created.colorKey, 'purple', 'Create must persist selected color key.')
assert.equal(created.linkedSessionId, '')
assert.equal(created.linkedClassSessionId, '')
assert(!('tuitionUsedSessions' in created), 'Activity item must not include tuition fields.')
assert(!('attendance' in created), 'Activity item must not include attendance fields.')

const editState = createEditCenterCalendarItemFormState(created)
assert.equal(editState.itemId, created.id)
assert.equal(editState.values.title, created.title)
assert.equal(editState.values.colorKey, 'purple', 'Edit must load saved color key.')
assert.equal(editState.values.colorOverridden, true, 'Edit must detect user color override.')

const updated = buildCenterCalendarItemFromForm(
  { ...editState.values, title: 'Hop team updated', colorKey: 'red' },
  created,
  'demo-center',
)
assert.equal(updated.id, created.id, 'Edit must preserve id.')
assert.equal(updated.createdAt, created.createdAt, 'Edit must preserve createdAt.')
assert.notEqual(updated.updatedAt, '', 'Edit must set updatedAt.')
assert.equal(updated.colorKey, 'red', 'Edit must persist updated color key.')

const malformedColor = buildCenterCalendarItemFromForm(
  { ...editState.values, itemType: 'event', colorKey: 'not-a-color' },
  null,
  'demo-center',
)
assert.equal(malformedColor.colorKey, 'green', 'Malformed color must fall back to item type default.')

const detailHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: createCenterCalendarItemDetailState(created),
  centerCalendarItems: [created],
  classSessions: [],
})
assert(detailHtml.includes('Chi tiết hoạt động'), 'Click card detail panel must render.')
assert(detailHtml.includes('Tím'), 'Detail must show saved color name.')
assert(detailHtml.includes('data-center-calendar-action="edit"'), 'Detail must expose edit action.')
assert(detailHtml.includes('data-center-calendar-action="confirm-delete"'), 'Detail must expose delete confirmation action.')
for (const forbiddenDetail of ['Điểm danh', 'Báo cáo ca dạy', 'Học phí', 'data-schedule-action="save-attendance"']) {
  assert(!detailHtml.includes(forbiddenDetail), `Detail must not expose lesson workflow: ${forbiddenDetail}`)
}

const deleteHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: createCenterCalendarItemDeleteState(created),
  centerCalendarItems: [created],
  classSessions: [],
})
assert(deleteHtml.includes('Bạn có chắc muốn xóa hoạt động này?'), 'Delete must show explicit confirmation.')
assert(deleteHtml.includes('data-center-calendar-action="delete"'), 'Delete confirmation must expose final delete action.')

const storage = createMemoryStorage()
saveStoredCenterCalendarItems('demo-center', [created], storage)
assert.equal(getCenterCalendarItemById(loadStoredCenterCalendarItems('demo-center', storage), created.id).colorKey, 'purple')
saveStoredCenterCalendarItems('demo-center', loadStoredCenterCalendarItems('demo-center', storage).filter((item) => item.id !== created.id), storage)
assert.equal(loadStoredCenterCalendarItems('demo-center', storage).length, 0, 'Delete must remove only the target center item list.')

for (const marker of [
  'scheduleCalendarItemState',
  'getCenterCalendarItemById',
  'loadStoredCenterCalendarItems',
  'saveStoredCenterCalendarItems',
  'buildCenterCalendarItemFromForm',
  'validateCenterCalendarItemForm',
  'getDefaultCenterCalendarColorKeyForType',
  'updateCenterCalendarPaletteDom',
  "document.querySelectorAll('[data-center-calendar-form-field]').forEach((control) =>",
  "document.querySelectorAll('[data-center-calendar-action]').forEach((button) =>",
  "document.querySelectorAll('.schedule-calendar-item[data-center-calendar-item-id]').forEach((card) =>",
]) {
  assert(main.includes(marker), `Missing main runtime marker: ${marker}`)
}

const fieldBinding = getBetween(
  main,
  "document.querySelectorAll('[data-center-calendar-form-field]').forEach((control) =>",
  "document.querySelectorAll('[data-center-calendar-tag-field]').forEach((control) =>",
)
assert(fieldBinding.includes("control.addEventListener('input', updateCalendarFormValue)"))
assert(fieldBinding.includes("control.addEventListener('change', updateCalendarFormValue)"))
assert(fieldBinding.includes("fieldName === 'itemType'"), 'Changing activity type must update default color when not overridden.')
assert(!fieldBinding.includes('render()'), 'Activity input/change must not full-render the app.')
assert(!fieldBinding.includes('openModuleWindow'), 'Activity input/change must not reopen modules.')

const actionBinding = getSnippetAfter(main, "document.querySelectorAll('[data-center-calendar-action]').forEach((button) =>", 5600)
assert(actionBinding.includes('saveStoredCenterCalendarItems'), 'Save/delete must use center-scoped storage helper.')
assert(actionBinding.includes('latestItems.filter((item) => item.id !== itemId)'), 'Delete must filter only the selected item id.')
assert(actionBinding.includes("action === 'select-color'"), 'Palette select action must be handled.')
assert(actionBinding.includes("action === 'reset-color'"), 'Palette reset action must be handled.')
assert(actionBinding.includes('updateCenterCalendarPaletteDom(colorKey, true)'), 'Palette select must update DOM locally.')
assert(actionBinding.includes('updateCenterCalendarPaletteDom(colorKey, false)'), 'Palette reset must update DOM locally.')
assert(!getBetween(actionBinding, "action === 'select-color'", "action === 'reset-color'").includes('render()'), 'Palette click must not full-render.')
for (const forbidden of ['saveStoredSchedule', 'saveStoredClassSessions', 'writeScheduleSessionThroughCloud', 'saveStoredAttendance', 'tuition.usedSessions', 'Teacher Workspace']) {
  assert(!actionBinding.includes(forbidden), `Activity CRUD must not touch forbidden flow: ${forbidden}`)
}

assert(!main.includes("document.querySelectorAll('[data-module-id]').forEach((button) =>"), 'F23.5B.1 generic launcher regression must not return.')
assert(main.includes('moduleLauncherSelector'), 'Launcher guard must still use marked launcher selector.')
assert(!formHtml.includes('data-module-launcher'), 'Calendar form/card must not be marked as module launcher.')

for (const forbiddenPhase of ['custom color picker', 'recurrenceRule', 'conflict detection', 'PDF', 'print preview', 'colorblind mode']) {
  assert(!docs.includes(`${forbiddenPhase}: implemented`), `Docs must not claim out-of-scope feature: ${forbiddenPhase}`)
}

assert(styles.includes('.schedule-calendar-add-button'), 'Activity add button style must exist.')
assert(styles.includes('.schedule-calendar-color-palette'), 'Palette style must exist.')
assert(styles.includes('.schedule-calendar-color-swatch.is-selected'), 'Selected swatch style must exist.')
assert(schedule.includes('sourceModule: \'centerCalendar\''), 'New activity data must set sourceModule.')
assert(data.includes('CENTER_CALENDAR_REJECTED_CLASS_ITEM_TYPES'), 'Foundation must keep rejected class/session types.')
assert.equal(Object.keys(CENTER_CALENDAR_COLOR_PRESETS).filter((key) => ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray'].includes(key)).length, 8)

for (const mojibakeMarker of createMojibakeMarkers()) {
  for (const [label, source] of [
    [mainPath, main],
    [schedulePath, schedule],
    [dataPath, data],
    [stylesPath, styles],
    [docsPath, docs],
  ]) {
    assert(!source.includes(mojibakeMarker), `${label} contains mojibake marker`)
  }
}

console.log('F23.5C CRUD center calendar items local-safe smoke passed')

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

function getSnippetAfter(source, marker, length) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Missing marker: ${marker}`)
  return source.slice(start, start + length)
}

function getSnippetAround(source, marker, length) {
  const center = source.indexOf(marker)
  assert.notEqual(center, -1, `Missing marker: ${marker}`)
  const start = Math.max(0, center - length)
  return source.slice(start, center + length)
}

function getBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`)
  return source.slice(start, end)
}

function createMojibakeMarkers() {
  return [
    ['C', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u0192'].join(''),
    ['\u0102', '\u2020', '\u00c2', '\u00b0'].join(''),
    ['H', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u00a1', '\u00c2', '\u00bb'].join(''),
  ]
}
