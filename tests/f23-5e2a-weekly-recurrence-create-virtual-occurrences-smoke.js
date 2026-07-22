import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES,
  createCenterCalendarOccurrenceId,
  createCenterCalendarRecurrenceRuleFromFormValues,
  expandWeeklyCenterCalendarOccurrences,
  formatCenterCalendarRecurrenceSummary,
  getCenterCalendarRecurrenceFormValues,
  getCenterCalendarSeriesRange,
  isWeeklyRecurringCenterCalendarItem,
  normalizeCenterCalendarRecurrenceRule,
  validateCenterCalendarRecurrenceRule,
} from '../src/center-calendar-recurrence.js'
import {
  detectCenterCalendarConflicts,
  detectCenterCalendarSeriesConflicts,
} from '../src/center-calendar-conflicts.js'
import {
  buildCenterCalendarItemFromForm,
  createCenterCalendarOccurrenceDetailState,
  createEmptyCenterCalendarItemFormState,
  renderScheduleModule,
  validateCenterCalendarItemForm,
} from '../src/schedule-module.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const recurrenceSource = fs.readFileSync(path.join(repoRoot, 'src', 'center-calendar-recurrence.js'), 'utf8')
const conflictSource = fs.readFileSync(path.join(repoRoot, 'src', 'center-calendar-conflicts.js'), 'utf8')
const scheduleSource = fs.readFileSync(path.join(repoRoot, 'src', 'schedule-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'f23-5e2a-weekly-recurrence-create-virtual-occurrences.md'), 'utf8')

const baseRule = {
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: ['wed', 'mon', 'wed'],
  endMode: 'count',
  count: 4,
  timezone: 'Asia/Ho_Chi_Minh',
}
const normalizedRule = normalizeCenterCalendarRecurrenceRule(baseRule)
assert.deepEqual(normalizedRule.daysOfWeek, ['mon', 'wed'], 'Weekdays must dedupe and sort by canonical week order.')
assert.equal(normalizedRule.count, 4)
assert.equal(validateCenterCalendarRecurrenceRule(normalizedRule, { anchorDate: '2026-07-21' }).recurrenceCount, undefined)
assert(validateCenterCalendarRecurrenceRule({ ...baseRule, frequency: 'daily' }, { anchorDate: '2026-07-21' }).recurrenceFrequency)
assert(validateCenterCalendarRecurrenceRule({ ...baseRule, interval: 2 }, { anchorDate: '2026-07-21' }).recurrenceRule)
assert(validateCenterCalendarRecurrenceRule({ ...baseRule, daysOfWeek: ['noday'] }, { anchorDate: '2026-07-21' }).recurrenceDays)
assert(validateCenterCalendarRecurrenceRule({ ...baseRule, daysOfWeek: [] }, { anchorDate: '2026-07-21' }).recurrenceDays)
assert(validateCenterCalendarRecurrenceRule({ ...baseRule, count: 53 }, { anchorDate: '2026-07-21' }).recurrenceCount)
assert(validateCenterCalendarRecurrenceRule({
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  endMode: 'until',
  untilDate: '2026-12-31',
  count: null,
  timezone: 'Asia/Ho_Chi_Minh',
}, { anchorDate: '2026-07-21' }).recurrenceUntilDate, 'Until mode must block more than 52 occurrences.')

const anchorExcludedMaster = {
  id: 'series-a',
  centerId: 'center-a',
  itemType: 'meeting',
  title: 'Weekly meeting',
  startAt: '2026-07-21T18:00:00',
  endAt: '2026-07-21T19:00:00',
  location: 'Room A',
  recurrenceRule: normalizedRule,
}
const excludedOccurrences = expandWeeklyCenterCalendarOccurrences([anchorExcludedMaster], {
  rangeStart: '2026-07-20T00:00:00',
  rangeEnd: '2026-08-10T00:00:00',
})
assert.deepEqual(
  excludedOccurrences.map((item) => item.occurrenceDate),
  ['2026-07-22', '2026-07-27', '2026-07-29', '2026-08-03'],
  'Anchor Tuesday with Monday/Wednesday should start at Wednesday, not prior Monday.',
)
assert(excludedOccurrences.every((item) => item.isVirtualOccurrence && item.masterId === 'series-a'))
assert.equal(createCenterCalendarOccurrenceId('series-a', '2026-07-22'), 'series-a@2026-07-22')

const anchorIncludedMaster = {
  ...anchorExcludedMaster,
  id: 'series-b',
  startAt: '2026-07-22T18:00:00',
  endAt: '2026-07-22T19:00:00',
  recurrenceRule: { ...normalizedRule, daysOfWeek: ['wed'], count: 2 },
}
assert.deepEqual(
  expandWeeklyCenterCalendarOccurrences([anchorIncludedMaster], {
    rangeStart: '2026-07-20T00:00:00',
    rangeEnd: '2026-08-10T00:00:00',
  }).map((item) => item.occurrenceDate),
  ['2026-07-22', '2026-07-29'],
  'Anchor weekday should be included when selected.',
)

const crossMidnightMaster = {
  ...anchorExcludedMaster,
  id: 'series-night',
  startAt: '2026-07-24T22:00:00',
  endAt: '2026-07-25T01:00:00',
  recurrenceRule: { ...normalizedRule, daysOfWeek: ['fri'], count: 1 },
}
const [nightOccurrence] = expandWeeklyCenterCalendarOccurrences([crossMidnightMaster], {
  rangeStart: '2026-07-24T00:00:00',
  rangeEnd: '2026-07-26T00:00:00',
})
assert.equal(new Date(nightOccurrence.endAt).getTime() - new Date(nightOccurrence.startAt).getTime(), 3 * 60 * 60 * 1000)
assert.notEqual(new Date(nightOccurrence.startAt).getDate(), new Date(nightOccurrence.endAt).getDate(), 'Cross-midnight occurrence must end on a later local date.')

const allDayMaster = {
  ...anchorExcludedMaster,
  id: 'series-day',
  startAt: '2026-07-24T00:00:00',
  endAt: '2026-07-25T00:00:00',
  allDay: true,
  recurrenceRule: { ...normalizedRule, daysOfWeek: ['fri'], count: 1 },
}
const [allDayOccurrence] = expandWeeklyCenterCalendarOccurrences([allDayMaster], {
  rangeStart: '2026-07-24T00:00:00',
  rangeEnd: '2026-07-25T00:00:00',
})
assert.equal(new Date(allDayOccurrence.endAt).getTime() - new Date(allDayOccurrence.startAt).getTime(), 24 * 60 * 60 * 1000)

const sourceSnapshot = JSON.stringify(anchorExcludedMaster)
expandWeeklyCenterCalendarOccurrences([anchorExcludedMaster], {
  rangeStart: '2026-07-20T00:00:00',
  rangeEnd: '2026-07-27T00:00:00',
})
assert.equal(JSON.stringify(anchorExcludedMaster), sourceSnapshot, 'Expansion must not mutate master input.')
assert.equal(getCenterCalendarSeriesRange(anchorIncludedMaster).occurrenceCount, 2)
assert(isWeeklyRecurringCenterCalendarItem(anchorIncludedMaster))
assert(formatCenterCalendarRecurrenceSummary(anchorIncludedMaster.recurrenceRule).includes('Thứ Tư'))

const formValues = {
  ...createEmptyCenterCalendarItemFormState('2026-07-22').values,
  title: 'Series from form',
  location: 'Room A',
  recurrenceFrequency: 'weekly',
  recurrenceDays: 'wed,fri',
  recurrenceEndMode: 'count',
  recurrenceCount: '3',
}
assert.equal(validateCenterCalendarItemForm(formValues).recurrenceDays, undefined)
const formRule = createCenterCalendarRecurrenceRuleFromFormValues(formValues)
assert.deepEqual(formRule.daysOfWeek, ['wed', 'fri'])
const masterFromForm = buildCenterCalendarItemFromForm(formValues, null, 'center-a')
assert.equal(masterFromForm.recurrenceRule.frequency, 'weekly')
assert.equal(getCenterCalendarRecurrenceFormValues(formRule, '2026-07-22').recurrenceFrequency, 'weekly')

const existingRecurring = {
  ...masterFromForm,
  id: 'existing-series',
  location: 'Room A',
  recurrenceRule: { ...formRule, daysOfWeek: ['wed'], count: 4 },
}
const singleConflict = detectCenterCalendarConflicts({
  candidate: {
    ...masterFromForm,
    id: 'single-candidate',
    recurrenceRule: null,
    startAt: '2026-07-29T09:15:00',
    endAt: '2026-07-29T09:45:00',
    location: 'Room A',
  },
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [],
  centerCalendarItems: [existingRecurring],
})
assert(singleConflict.hasSoft, 'Single activity must detect existing recurring occurrence as soft conflict.')
assert(singleConflict.soft[0].sourceId.includes('@2026-07-29'))

const classHard = detectCenterCalendarSeriesConflicts({
  candidate: existingRecurring,
  occurrences: expandWeeklyCenterCalendarOccurrences([existingRecurring], {
    rangeStart: getCenterCalendarSeriesRange(existingRecurring).startAt,
    rangeEnd: getCenterCalendarSeriesRange(existingRecurring).endAt,
  }),
  centerId: 'center-a',
  classSessions: [{
    id: 'class-wed',
    centerId: 'center-a',
    name: 'Real class',
    daysOfWeek: ['wed'],
    startTime: '09:00',
    endTime: '10:00',
    room: 'Room A',
    status: 'active',
  }],
  scheduleSessions: [],
  centerCalendarItems: [],
})
assert(classHard.hasHard, 'Any occurrence matching a real class room must hard block the whole series.')
assert.equal(classHard.conflictedOccurrenceCount, 4)

const softSeries = detectCenterCalendarSeriesConflicts({
  candidate: existingRecurring,
  occurrences: expandWeeklyCenterCalendarOccurrences([existingRecurring], {
    rangeStart: getCenterCalendarSeriesRange(existingRecurring).startAt,
    rangeEnd: getCenterCalendarSeriesRange(existingRecurring).endAt,
  }),
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [],
  centerCalendarItems: [{
    id: 'other-activity',
    centerId: 'center-a',
    itemType: 'event',
    title: 'Other activity',
    startAt: '2026-07-29T09:00:00',
    endAt: '2026-07-29T10:00:00',
    location: 'Room A',
  }],
})
assert(softSeries.hasSoft && !softSeries.hasHard, 'Activity conflict with a series occurrence should be soft.')

const cancelledIgnored = detectCenterCalendarConflicts({
  candidate: { ...masterFromForm, id: 'single-cancelled-source', recurrenceRule: null, startAt: '2026-07-29T09:15:00', endAt: '2026-07-29T09:45:00' },
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [],
  centerCalendarItems: [{ ...existingRecurring, isCancelled: true }],
})
assert(!cancelledIgnored.hasHard && !cancelledIgnored.hasSoft, 'Cancelled recurring series must not block candidates.')

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
  [],
  [],
  '2026-07-27',
  null,
  {
    centerCalendarItems: [existingRecurring],
    centerCalendarTags: [{ id: 'tag-a', label: 'Internal', colorKey: 'blue', isActive: true }],
    centerCalendarFilters: { itemType: 'meeting', tagId: 'all' },
  },
)
assert(scheduleHtml.includes('data-center-calendar-master-id="existing-series"'), 'Rendered recurring card must point to master id.')
assert(scheduleHtml.includes('data-center-calendar-occurrence-date="2026-07-29"'), 'Rendered card must include occurrence date.')
assert(scheduleHtml.includes('Lặp'), 'Rendered recurring card/detail must include recurring marker.')
assert(!scheduleHtml.includes('existing-series@2026-07-22'), 'Master anchor outside week must not render duplicate.')

const formHtml = renderScheduleModule(
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
  [],
  [],
  '2026-07-20',
  null,
  {
    centerCalendarItemState: {
      ...createEmptyCenterCalendarItemFormState('2026-07-22'),
      values: {
        ...createEmptyCenterCalendarItemFormState('2026-07-22').values,
        recurrenceFrequency: 'weekly',
        recurrenceDays: 'wed',
      },
    },
    centerCalendarItems: [],
  },
)
for (const marker of ['Không lặp', 'Hàng tuần', 'data-center-calendar-recurrence-day', 'Vào ngày', 'Sau số lần']) {
  assert(formHtml.includes(marker), `Form must include recurrence marker: ${marker}`)
}
assert(!formHtml.includes('daily') && !formHtml.includes('monthly'), 'F23.5E2A form must not expose daily/monthly recurrence.')

const [detailOccurrence] = expandWeeklyCenterCalendarOccurrences([existingRecurring], {
  rangeStart: '2026-07-29T00:00:00',
  rangeEnd: '2026-07-30T00:00:00',
})
const detailHtml = renderScheduleModule(
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
  [],
  [],
  '2026-07-27',
  null,
  {
    centerCalendarItemState: createCenterCalendarOccurrenceDetailState(detailOccurrence, existingRecurring),
    centerCalendarItems: [existingRecurring],
  },
)
assert(detailHtml.includes('Chi tiết hoạt động lặp lại'))
assert(detailHtml.includes('Hoạt động lặp lại'))
assert(!detailHtml.includes('data-center-calendar-action="edit"'), 'Occurrence detail must not expose edit in E2A.')
assert(!detailHtml.includes('data-center-calendar-action="confirm-delete"'), 'Occurrence detail must not expose delete in E2A.')

assert.equal(CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES, 52)
assert(recurrenceSource.includes('export function normalizeCenterCalendarRecurrenceRule'))
assert(recurrenceSource.includes('export function expandWeeklyCenterCalendarOccurrences'))
assert(!recurrenceSource.includes('localStorage') && !recurrenceSource.includes('document.'), 'Recurrence module must be pure.')
assert(!mainSource.includes('saveStoredSchedule') || !mainSource.slice(mainSource.indexOf('saveCenterCalendarItemFromForm'), mainSource.indexOf('saveCenterCalendarTagFromForm')).includes('saveStoredSchedule'), 'Center calendar save must not write schedule sessions.')
assert(mainSource.includes('detectCenterCalendarSeriesConflicts'), 'Save flow must aggregate series conflicts.')
assert(mainSource.includes('persistCenterCalendarItem(centerId, nextItem, existingItem)'), 'Save flow must persist one master item.')
const centerCalendarSaveFlow = mainSource.slice(
  mainSource.indexOf('const saveCenterCalendarItemFromForm'),
  mainSource.indexOf('const saveCenterCalendarTagFromForm'),
)
const centerCalendarActionFlow = mainSource.slice(
  mainSource.indexOf("document.querySelectorAll('[data-center-calendar-action]'"),
  mainSource.indexOf("document.querySelectorAll('[data-schedule-report-role]'"),
)
assert(!centerCalendarSaveFlow.includes('window.confirm') && !centerCalendarActionFlow.includes('window.confirm'), 'Conflict UI must not use browser confirm.')
assert(conflictSource.includes('expandWeeklyCenterCalendarOccurrences'), 'Conflict engine must expand recurring source items.')
assert(scheduleSource.includes('getCenterCalendarItemsForDisplayRange'), 'Schedule render must use display range expansion.')
assert(scheduleSource.includes('data-center-calendar-master-id'), 'Occurrence cards must retain master id.')
assert(scheduleSource.includes('data-center-calendar-occurrence-detail'), 'Occurrence detail must be read-only boundary.')
assert(!scheduleSource.includes('data-module-launcher"][data-center-calendar-recurrence-day'), 'Weekday buttons must not be module launchers.')
assert(!scheduleSource.includes('data-center-calendar-form-field="recurrenceRule"'), 'Form must not save raw recurrenceRule text.')
for (const forbidden of ['attendanceRecords', 'tuition.usedSessions', 'Teacher Workspace', 'Supabase', 'SQL']) {
  assert(!recurrenceSource.includes(forbidden), `Recurrence foundation must not touch ${forbidden}.`)
}

for (const marker of [
  'Storage Strategy',
  'Rule Shape',
  'Occurrence Identity',
  'Conflict Aggregation',
  'Occurrence Detail',
  'Roadmap E2B',
]) {
  assert(docs.includes(marker), `Docs missing marker: ${marker}`)
}

const mojibakeTokens = ['\u00c3', '\u00c2', '\ufffd', 'T\u00e1\u00ba', '\u00e1\u00bb', '\u00c4\u2018', '\u00c6\u01a1']
for (const [label, text] of Object.entries({ recurrenceSource, docs })) {
  for (const token of mojibakeTokens) {
    assert(!text.includes(token), `${label} contains mojibake token ${token}`)
  }
}

console.log('F23.5E2A weekly recurrence create virtual occurrences smoke passed')
