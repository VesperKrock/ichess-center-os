import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildCenterCalendarItemFromForm,
  buildCenterCalendarTagFromForm,
  createCenterCalendarItemDetailState,
  createCenterCalendarTagManagerState,
  createEditCenterCalendarItemFormState,
  createEditCenterCalendarTagFormState,
  createEmptyCenterCalendarItemFormState,
  createEmptyCenterCalendarTagFormState,
  renderScheduleModule,
  validateCenterCalendarTagForm,
} from '../src/schedule-module.js'
import {
  CENTER_CALENDAR_COLOR_PRESETS,
  getCenterCalendarTagById,
  loadStoredCenterCalendarItems,
  loadStoredCenterCalendarTags,
  saveStoredCenterCalendarItems,
  saveStoredCenterCalendarTags,
} from '../src/center-calendar-data.js'

const repoRoot = process.cwd()
const mainPath = path.join(repoRoot, 'src', 'main.js')
const schedulePath = path.join(repoRoot, 'src', 'schedule-module.js')
const dataPath = path.join(repoRoot, 'src', 'center-calendar-data.js')
const stylesPath = path.join(repoRoot, 'src', 'styles.css')
const docsPath = path.join(repoRoot, 'docs', 'f23-5d-center-calendar-tags-filter-legend-local-safe.md')

const main = fs.readFileSync(mainPath, 'utf8')
const schedule = fs.readFileSync(schedulePath, 'utf8')
const data = fs.readFileSync(dataPath, 'utf8')
const styles = fs.readFileSync(stylesPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')

const paletteKeys = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray', 'emerald']
assert.deepEqual(
  paletteKeys.map((key) => CENTER_CALENDAR_COLOR_PRESETS[key]?.key),
  paletteKeys,
  'Tag palette must use safe preset keys only.',
)
assert(data.includes('CENTER_CALENDAR_TAG_LABEL_MAX_LENGTH'), 'Tag model must enforce a label length limit.')
assert(data.includes('isCenterCalendarSafeColorKey'), 'Tag color normalization must reject raw CSS values.')

const storage = createMemoryStorage()
const tagA = buildCenterCalendarTagFromForm(
  { label: 'Nội bộ', colorKey: 'purple', defaultItemType: 'meeting', description: 'Họp nội bộ' },
  null,
  'center-a',
)
const tagB = buildCenterCalendarTagFromForm(
  { label: 'Ưu tiên', colorKey: 'red', defaultItemType: 'event', description: '' },
  null,
  'center-a',
)
const archivedTag = { ...tagB, isActive: false, updatedAt: new Date().toISOString() }
assert.equal(tagA.label, 'Nội bộ')
assert.equal(tagA.colorKey, 'purple')
assert.equal(tagA.defaultItemType, 'meeting')
assert.equal(buildCenterCalendarTagFromForm({ label: 'Bad', colorKey: 'url(javascript:1)' }, null, 'center-a').colorKey, 'gray')

saveStoredCenterCalendarTags('center-a', [tagA, archivedTag], storage)
saveStoredCenterCalendarTags('center-b', [
  buildCenterCalendarTagFromForm({ label: 'Center B', colorKey: 'green' }, null, 'center-b'),
], storage)
assert.equal(loadStoredCenterCalendarTags('center-a', storage).length, 2)
assert.equal(loadStoredCenterCalendarTags('center-b', storage).length, 1)
assert.equal(getCenterCalendarTagById(loadStoredCenterCalendarTags('center-b', storage), tagA.id), null, 'Tags must be center-scoped.')

assert(validateCenterCalendarTagForm({ label: '', colorKey: 'purple' }, []).label, 'Empty label must be invalid.')
assert(validateCenterCalendarTagForm({ label: ' nội bộ ', colorKey: 'green' }, [tagA]).label, 'Active duplicate labels must be blocked case-insensitively.')
assert(validateCenterCalendarTagForm({ label: 'Ưu tiên', colorKey: 'green' }, [archivedTag]).label, 'Archived duplicate labels must suggest restore.')
assert(validateCenterCalendarTagForm({ label: 'Raw', colorKey: 'expression(alert(1))' }, []).colorKey, 'Raw CSS color must be invalid.')

const taggedItem = buildCenterCalendarItemFromForm(
  {
    itemType: 'meeting',
    title: 'Họp đội ngũ',
    date: '2026-07-22',
    startTime: '09:00',
    endTime: '10:00',
    colorKey: 'orange',
    tagId: tagA.id,
    tagLabel: tagA.label,
  },
  null,
  'center-a',
)
const archivedTaggedItem = buildCenterCalendarItemFromForm(
  {
    itemType: 'event',
    title: 'Ngày hội',
    date: '2026-07-23',
    startTime: '09:00',
    endTime: '10:00',
    colorKey: 'green',
    tagId: archivedTag.id,
    tagLabel: archivedTag.label,
  },
  null,
  'center-a',
)
const untaggedItem = buildCenterCalendarItemFromForm(
  {
    itemType: 'event',
    title: 'Workshop mở',
    date: '2026-07-24',
    startTime: '09:00',
    endTime: '10:00',
    colorKey: 'green',
  },
  null,
  'center-a',
)
saveStoredCenterCalendarItems('center-a', [taggedItem, archivedTaggedItem, untaggedItem], storage)
assert.equal(loadStoredCenterCalendarItems('center-a', storage).length, 3)
assert.equal(loadStoredCenterCalendarItems('center-b', storage).length, 0, 'Items must stay center-scoped.')
assert.equal(taggedItem.colorKey, 'orange', 'Assigning a tag must not override card color.')
assert.equal(taggedItem.itemType, 'meeting', 'Assigning a tag must not override item type.')
assert(!('tagIds' in taggedItem), 'MVP must not write multi-tag arrays.')

const formHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: createEmptyCenterCalendarItemFormState('2026-07-22'),
  centerCalendarItems: [taggedItem],
  centerCalendarTags: [tagA, archivedTag],
  classSessions: [],
})
assert(formHtml.includes('Quản lý nhãn'), 'Schedule toolbar must expose tag manager action.')
assert(formHtml.includes('data-center-calendar-form-field="tagId"'), 'Activity form must include single tag selector.')
assert(formHtml.includes('Không gắn nhãn'), 'Activity form must offer unassign option.')
assert(formHtml.includes(tagA.label), 'Active tag must be selectable.')
assert(!formHtml.includes(`value="${archivedTag.id}"`), 'Archived tag must not be selectable for new items.')

const editArchivedHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: createEditCenterCalendarItemFormState(archivedTaggedItem),
  centerCalendarItems: [archivedTaggedItem],
  centerCalendarTags: [tagA, archivedTag],
  classSessions: [],
})
assert(editArchivedHtml.includes(`${archivedTag.label} (đã lưu trữ)`), 'Old item with archived tag must still show its tag in edit.')

const cardHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItems: [taggedItem, archivedTaggedItem],
  centerCalendarTags: [tagA, archivedTag],
  classSessions: [
    { id: 'fixed-slot', name: 'Lớp cố định', daysOfWeek: ['wednesday'], startTime: '08:00', endTime: '09:00', status: 'active' },
  ],
})
assert(cardHtml.includes('schedule-calendar-item-tag'), 'Calendar card must render tag badge.')
assert(cardHtml.includes('--schedule-calendar-tag-color'), 'Tag badge must use its own color variable.')
assert(cardHtml.includes('--schedule-calendar-item-color'), 'Card color variable must remain separate.')
assert(cardHtml.includes('is-archived'), 'Archived tag badge must remain visible with archived state.')
assert(cardHtml.includes('Lớp cố định'), 'Class/fixed slots must not be hidden by calendar filters or tags.')
assert(cardHtml.includes('schedule-calendar-legend'), 'Compact legend must render.')
assert(cardHtml.includes('Nhãn trong tuần'), 'Legend must include tags used in current week.')

const detailHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: createCenterCalendarItemDetailState(taggedItem),
  centerCalendarItems: [taggedItem],
  centerCalendarTags: [{ ...tagA, label: 'Họp nội bộ' }],
  classSessions: [],
})
assert(detailHtml.includes('Họp nội bộ'), 'Detail must prefer current tag label over item snapshot.')
assert(detailHtml.includes('Nhãn'), 'Detail must show tag section.')

const typeAndTagFilterHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarFilters: { itemType: 'event', tagId: tagA.id },
  centerCalendarItems: [taggedItem, archivedTaggedItem, untaggedItem],
  centerCalendarTags: [tagA, archivedTag],
  classSessions: [
    { id: 'fixed-slot', name: 'Lớp cố định', daysOfWeek: ['wednesday'], startTime: '08:00', endTime: '09:00', status: 'active' },
  ],
})
assert(!typeAndTagFilterHtml.includes('Họp đội ngũ'), 'Type + tag filter must use AND logic.')
assert(!typeAndTagFilterHtml.includes('Ngày hội'), 'Type + tag filter must exclude other tags.')
assert(typeAndTagFilterHtml.includes('Lớp cố định'), 'Calendar filters must not hide class/fixed slots.')
assert(typeAndTagFilterHtml.includes('Không có hoạt động phù hợp bộ lọc'), 'Empty filtered calendar item result must show concise message.')
assert(typeAndTagFilterHtml.includes('Xóa bộ lọc'), 'Active filters must expose clear action.')

const noTagFilterHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarFilters: { itemType: 'all', tagId: '__none__' },
  centerCalendarItems: [taggedItem, untaggedItem],
  centerCalendarTags: [tagA],
  classSessions: [],
})
assert(noTagFilterHtml.includes('Workshop mở'), 'No-tag filter must include untagged calendar items.')
assert(!noTagFilterHtml.includes('Họp đội ngũ'), 'No-tag filter must exclude tagged calendar items.')

const managerHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarTagState: createCenterCalendarTagManagerState(),
  centerCalendarItems: [taggedItem, archivedTaggedItem],
  centerCalendarTags: [tagA, archivedTag],
  classSessions: [],
})
assert(managerHtml.includes('Quản lý nhãn hoạt động'), 'Tag manager must render in its own window.')
assert(managerHtml.includes('+ Tạo nhãn'), 'Tag manager must expose create action.')
assert(managerHtml.includes('Chỉnh sửa'), 'Active tag row must expose edit action.')
assert(managerHtml.includes('Lưu trữ'), 'Active tag row must expose archive action.')
assert(managerHtml.includes('Nhãn đã lưu trữ'), 'Archived tags must have their own section.')
assert(managerHtml.includes('Khôi phục'), 'Archived tag row must expose restore action.')
assert(!managerHtml.includes('Xóa nhãn'), 'F23.5D must not expose hard delete.')

const tagFormHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarTagState: createEmptyCenterCalendarTagFormState(),
  centerCalendarItems: [],
  centerCalendarTags: [],
  classSessions: [],
})
assert(tagFormHtml.includes('data-center-calendar-tag-field="label"'), 'Tag form must include label field.')
assert(tagFormHtml.includes('data-center-calendar-tag-field="defaultItemType"'), 'Tag form must include optional default item type.')
assert.equal((tagFormHtml.match(/data-center-calendar-tag-color-key=/g) || []).length, 9, 'Tag form must render safe palette.')
assert(tagFormHtml.includes('aria-pressed="true"'), 'Tag palette must expose selected state.')

const editTagState = createEditCenterCalendarTagFormState(tagA)
assert.equal(editTagState.tagId, tagA.id)
assert.equal(editTagState.values.label, tagA.label)

for (const marker of [
  'loadStoredCenterCalendarTags',
  'saveStoredCenterCalendarTags',
  'scheduleCalendarTagState',
  'scheduleCalendarFilters',
  'data-center-calendar-filter',
  'data-center-calendar-tag-action',
  'updateCenterCalendarTagPaletteDom',
]) {
  assert(main.includes(marker), `Missing main runtime marker: ${marker}`)
}

const tagFieldBinding = getBetween(
  main,
  "document.querySelectorAll('[data-center-calendar-tag-field]').forEach((control) =>",
  "document.querySelectorAll('[data-center-calendar-tag-action]').forEach((button) =>",
)
assert(tagFieldBinding.includes("control.addEventListener('input', updateCalendarTagFormValue)"))
assert(tagFieldBinding.includes("control.addEventListener('change', updateCalendarTagFormValue)"))
assert(!tagFieldBinding.includes('render()'), 'Tag field input/change must not full-render the app.')
assert(!tagFieldBinding.includes('openModuleWindow'), 'Tag field input/change must not reopen modules.')

const tagActionBinding = getSnippetAfter(main, "document.querySelectorAll('[data-center-calendar-tag-action]').forEach((button) =>", 5200)
assert(tagActionBinding.includes("action === 'archive' || action === 'restore'"), 'Tag archive/restore actions must be handled.')
assert(tagActionBinding.includes('isActive: action === \'restore\''), 'Archive/restore must only toggle isActive.')
assert(!tagActionBinding.includes('saveStoredCenterCalendarItems'), 'Archiving tags must not rewrite item links.')
assert(!getBetween(tagActionBinding, "action === 'select-color'", "action === 'save'").includes('render()'), 'Tag palette click must not full-render.')

const filterBinding = getSnippetAfter(main, "document.querySelectorAll('[data-center-calendar-filter]').forEach((control) =>", 900)
assert(filterBinding.includes('scheduleCalendarFilters'), 'Filter controls must update local filter state.')
assert(!filterBinding.includes('openModuleWindow'), 'Filter controls must not reopen modules.')

assert(!main.includes("document.querySelectorAll('[data-module-id]').forEach((button) =>"), 'Generic module launcher regression must not return.')
assert(!managerHtml.includes('data-module-launcher'), 'Tag manager must not be marked as module launcher.')
assert(!formHtml.includes('data-module-launcher'), 'Activity form must not be marked as module launcher.')

for (const forbidden of [
  'tagIds',
  'recurrenceRule',
  'conflict detection',
  'PDF',
  'print preview',
  'saveStoredSchedule',
  'saveStoredClassSessions',
  'tuition.usedSessions',
  'Teacher Workspace',
  'supabase.from',
]) {
  assert(!tagActionBinding.includes(forbidden), `Tag manager runtime must not touch forbidden flow: ${forbidden}`)
}
for (const forbiddenPath of ['attendance-board-module.js', 'attendance-records.js', 'tuition-module.js', 'teacher-workspace-module.js']) {
  assert(!docs.includes(`modified ${forbiddenPath}`), `Docs must not claim forbidden file changes: ${forbiddenPath}`)
}
assert(styles.includes('.schedule-calendar-filters'), 'Filter styles must exist.')
assert(styles.includes('.schedule-calendar-legend'), 'Legend styles must exist.')
assert(styles.includes('.schedule-calendar-tag-manager'), 'Tag manager styles must exist.')
assert(schedule.includes('renderCenterCalendarFilterBar'), 'Schedule render must include filter bar.')
assert(schedule.includes('renderCenterCalendarLegend'), 'Schedule render must include legend.')
assert(docs.includes('một nhãn'), 'Docs must state the one-tag MVP limit.')
assert(docs.includes('không đổi màu thẻ'), 'Docs must explain tag color/card color independence.')
assert(docs.includes('read-only'), 'Docs must record the legend click decision.')

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

console.log('F23.5D center calendar tags filter legend local-safe smoke passed')

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
    'Buổi học mới'.replace('Buổi', 'Buổi'),
  ].filter((marker, index) => index < 5)
}
