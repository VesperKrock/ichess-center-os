import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  detectCenterCalendarSeriesConflicts,
} from '../src/center-calendar-conflicts.js'
import {
  expandWeeklyCenterCalendarOccurrences,
  getCenterCalendarSeriesRange,
} from '../src/center-calendar-recurrence.js'
import {
  buildCenterCalendarItemFromForm,
  createCenterCalendarOccurrenceDetailState,
  createCenterCalendarSeriesDeleteState,
  createEditCenterCalendarSeriesFormState,
  renderScheduleModule,
} from '../src/schedule-module.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const scheduleSource = fs.readFileSync(path.join(repoRoot, 'src', 'schedule-module.js'), 'utf8')
const conflictSource = fs.readFileSync(path.join(repoRoot, 'src', 'center-calendar-conflicts.js'), 'utf8')
const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'f23-5e2b-edit-delete-whole-weekly-series.md'), 'utf8')

const master = {
  id: 'series-master-1',
  centerId: 'center-a',
  itemType: 'meeting',
  title: 'Weekly ops',
  description: 'Original',
  startAt: '2026-07-22T09:00:00',
  endAt: '2026-07-22T10:00:00',
  location: 'Room A',
  colorKey: 'orange',
  tagId: 'tag-a',
  tagLabel: 'Ops',
  sourceModule: 'centerCalendar',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  recurrenceRule: {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: ['wed'],
    endMode: 'count',
    untilDate: null,
    count: 4,
    timezone: 'Asia/Ho_Chi_Minh',
  },
}

const [occurrence] = expandWeeklyCenterCalendarOccurrences([master], {
  rangeStart: '2026-07-29T00:00:00',
  rangeEnd: '2026-07-30T00:00:00',
})
assert(occurrence.isVirtualOccurrence)
assert.equal(occurrence.masterId, master.id)
assert.notEqual(occurrence.id, master.id)

const detailState = createCenterCalendarOccurrenceDetailState(occurrence, master)
const detailHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-27', null, {
  centerCalendarItemState: detailState,
  centerCalendarItems: [master],
})
assert(detailHtml.includes('Chỉnh sửa toàn bộ chuỗi'))
assert(detailHtml.includes('Xóa toàn bộ chuỗi'))
assert(detailHtml.includes(`data-center-calendar-master-id="${master.id}"`))
assert(!detailHtml.includes('Chỉ lần này'))
assert(!detailHtml.includes('Lần này và các lần sau'))
assert(!detailHtml.includes('data-center-calendar-action="edit"'), 'Occurrence detail must not use single-item edit action.')
assert(!detailHtml.includes('data-center-calendar-action="confirm-delete"'), 'Occurrence detail must not use single-item delete action.')

const editState = createEditCenterCalendarSeriesFormState(master, '2026-07-29')
assert.equal(editState.mode, 'edit')
assert.equal(editState.itemId, master.id)
assert.equal(editState.isSeriesEdit, true)
assert.equal(editState.values.date, '2026-07-22', 'Series edit must keep master anchor date.')

const editedMaster = buildCenterCalendarItemFromForm({
  ...editState.values,
  title: 'Weekly ops updated',
  itemType: 'event',
  colorKey: 'green',
  tagId: 'tag-b',
  tagLabel: 'Updated',
  recurrenceFrequency: 'weekly',
  recurrenceDays: 'tue',
  recurrenceEndMode: 'count',
  recurrenceCount: '3',
}, master, 'center-a')
assert.equal(editedMaster.id, master.id)
assert.equal(editedMaster.createdAt, master.createdAt)
assert.equal(editedMaster.sourceModule, master.sourceModule)
assert.notEqual(editedMaster.updatedAt, master.updatedAt)
assert.deepEqual(editedMaster.recurrenceRule.daysOfWeek, ['tue'])
assert.equal(
  expandWeeklyCenterCalendarOccurrences([editedMaster], {
    rangeStart: getCenterCalendarSeriesRange(editedMaster).startAt,
    rangeEnd: getCenterCalendarSeriesRange(editedMaster).endAt,
  }).length,
  3,
  'Changing count/weekday should recalculate virtual occurrences.',
)

const singleConverted = buildCenterCalendarItemFromForm({
  ...editState.values,
  recurrenceFrequency: 'none',
}, master, 'center-a')
assert.equal(singleConverted.id, master.id)
assert.equal(singleConverted.recurrenceRule, null)
assert.equal(singleConverted.startAt.slice(0, 10), master.startAt.slice(0, 10), 'Convert-to-single must keep anchor date, not occurrence date.')

const selfConflict = detectCenterCalendarSeriesConflicts({
  candidate: editedMaster,
  occurrences: expandWeeklyCenterCalendarOccurrences([editedMaster], {
    rangeStart: getCenterCalendarSeriesRange(editedMaster).startAt,
    rangeEnd: getCenterCalendarSeriesRange(editedMaster).endAt,
  }),
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [],
  centerCalendarItems: [master],
  currentItemId: master.id,
})
assert(!selfConflict.hasHard && !selfConflict.hasSoft, 'Series edit must exclude its own master and occurrences.')

const otherSeries = {
  ...master,
  id: 'series-other',
  title: 'Other series',
  startAt: '2026-07-28T09:30:00',
  endAt: '2026-07-28T10:30:00',
  recurrenceRule: { ...master.recurrenceRule, daysOfWeek: ['tue'], count: 3 },
}
const softConflict = detectCenterCalendarSeriesConflicts({
  candidate: editedMaster,
  occurrences: expandWeeklyCenterCalendarOccurrences([editedMaster], {
    rangeStart: getCenterCalendarSeriesRange(editedMaster).startAt,
    rangeEnd: getCenterCalendarSeriesRange(editedMaster).endAt,
  }),
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [],
  centerCalendarItems: [master, otherSeries],
  currentItemId: master.id,
})
assert(softConflict.hasSoft && !softConflict.hasHard, 'Series edit must still conflict with a different series.')

const hardConflict = detectCenterCalendarSeriesConflicts({
  candidate: editedMaster,
  occurrences: expandWeeklyCenterCalendarOccurrences([editedMaster], {
    rangeStart: getCenterCalendarSeriesRange(editedMaster).startAt,
    rangeEnd: getCenterCalendarSeriesRange(editedMaster).endAt,
  }),
  centerId: 'center-a',
  classSessions: [{
    id: 'class-a',
    centerId: 'center-a',
    name: 'Real class',
    daysOfWeek: ['tue'],
    startTime: '09:00',
    endTime: '10:00',
    room: 'Room A',
    status: 'active',
  }],
  scheduleSessions: [],
  centerCalendarItems: [master],
  currentItemId: master.id,
})
assert(hardConflict.hasHard, 'Hard conflict with real class/session must block whole-series edit.')

const deleteState = createCenterCalendarSeriesDeleteState(master, occurrence.occurrenceDate)
const deleteHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-27', null, {
  centerCalendarItemState: deleteState,
  centerCalendarItems: [master],
})
assert(deleteHtml.includes('Xóa toàn bộ chuỗi hoạt động?'))
assert(deleteHtml.includes('Tất cả các lần lặp của chuỗi sẽ biến mất.'))
assert(deleteHtml.includes('data-center-calendar-action="delete-series"'))
assert(deleteHtml.includes(`data-center-calendar-master-id="${master.id}"`))
const deletePanelHtml = deleteHtml.slice(
  deleteHtml.indexOf('data-center-calendar-series-delete-confirm'),
  deleteHtml.indexOf('</section>', deleteHtml.indexOf('data-center-calendar-series-delete-confirm')),
)
assert(!deletePanelHtml.includes(`data-center-calendar-master-id="${occurrence.occurrenceId}"`), 'Delete confirmation must not target occurrence id.')

const actionFlow = mainSource.slice(
  mainSource.indexOf("document.querySelectorAll('[data-center-calendar-action]'"),
  mainSource.indexOf("document.querySelectorAll('[data-schedule-report-role]'"),
)
assert(actionFlow.includes("if (action === 'edit-series')"))
assert(actionFlow.includes("if (action === 'confirm-series-delete')"))
assert(actionFlow.includes("if (action === 'delete-series')"))
assert(actionFlow.includes('resolveCurrentCenterCalendarSeriesMaster'), 'Series actions must resolve latest master in current center.')
assert(actionFlow.includes('latestItems.filter((item) => item.id !== masterItem.id)'), 'Delete must remove exactly the master.')
assert(!actionFlow.includes('occurrenceId') && !actionFlow.includes('centerCalendarItemId) =>'), 'Series action flow must not delete by occurrence id.')
assert(!actionFlow.includes('window.confirm'), 'Delete confirmation must not use browser confirm.')
assert(!actionFlow.includes('saveStoredSchedule') && !actionFlow.includes('saveStoredClassSessions'), 'Series edit/delete must not write lesson data.')
assert(mainSource.includes('createEditCenterCalendarSeriesFormState(masterItem, occurrenceDate)'))
assert(scheduleSource.includes('data-center-calendar-action="edit-series"'))
assert(scheduleSource.includes('data-center-calendar-action="confirm-series-delete"'))
assert(scheduleSource.includes('data-center-calendar-action="delete-series"'))
assert(scheduleSource.includes('Chuỗi sẽ trở thành một hoạt động đơn lẻ'))
assert(!scheduleSource.includes('Chỉnh sửa lần này') && !scheduleSource.includes('Xóa lần này'))
assert(conflictSource.includes('currentItemId'), 'Conflict engine must support self-exclusion.')

for (const marker of [
  'Master Resolution',
  'Edit Whole-Series Flow',
  'Self-Exclusion',
  'Delete Whole-Series',
  'Convert Series To Single',
  'Limits',
]) {
  assert(docs.includes(marker), `Docs missing marker: ${marker}`)
}

const mojibakeTokens = ['\u00c3', '\u00c2', '\ufffd', 'T\u00e1\u00ba', '\u00e1\u00bb', '\u00c4\u2018', '\u00c6\u01a1']
for (const [label, text] of Object.entries({ docs })) {
  for (const token of mojibakeTokens) {
    assert(!text.includes(token), `${label} contains mojibake token ${token}`)
  }
}

console.log('F23.5E2B edit/delete whole weekly series smoke passed')
