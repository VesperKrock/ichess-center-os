import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  CENTER_CALENDAR_COLOR_PRESETS,
  CENTER_CALENDAR_ITEM_TYPES,
  CENTER_CALENDAR_ITEM_TYPE_LABELS,
  getCenterCalendarItemsForRange,
  getCenterCalendarItemsStorageKey,
  getCenterCalendarPresetForType,
  getCenterCalendarTagsStorageKey,
  loadStoredCenterCalendarItems,
  loadStoredCenterCalendarTags,
  normalizeCenterCalendarItem,
  normalizeCenterCalendarItems,
  normalizeCenterCalendarTag,
  normalizeCenterCalendarTags,
  saveStoredCenterCalendarItems,
  saveStoredCenterCalendarTags,
} from '../src/center-calendar-data.js'

const repoRoot = process.cwd()
const helperSource = fs.readFileSync(path.join(repoRoot, 'src', 'center-calendar-data.js'), 'utf8')
const docsPath = path.join(repoRoot, 'docs', 'f23-5a-center-calendar-data-foundation-local-safe.md')

assert.deepEqual(CENTER_CALENDAR_ITEM_TYPES, ['meeting', 'event', 'tournament', 'other'])
assert.equal(CENTER_CALENDAR_ITEM_TYPE_LABELS.meeting, 'Hội họp')
assert.equal(CENTER_CALENDAR_ITEM_TYPE_LABELS.event, 'Sự kiện')
assert.equal(CENTER_CALENDAR_ITEM_TYPE_LABELS.tournament, 'Giải đấu')
assert.equal(CENTER_CALENDAR_ITEM_TYPE_LABELS.other, 'Hoạt động khác')

for (const rejectedType of [
  'fixedClass',
  'makeupClass',
  'extraClass',
  'classSession',
  'scheduleSession',
  'teachingSession',
]) {
  assert.equal(
    normalizeCenterCalendarItem({
      id: `bad-${rejectedType}`,
      centerId: 'dreamhome',
      itemType: rejectedType,
      title: 'Không phải buổi học',
      startAt: '2026-07-22T08:00:00.000Z',
      endAt: '2026-07-22T09:00:00.000Z',
    }),
    null,
    `Class-like type must be rejected: ${rejectedType}`,
  )
}

const normalizedItem = normalizeCenterCalendarItem({
  id: ' item-001 ',
  centerId: ' dreamhome ',
  itemType: 'meeting',
  title: '  Họp giáo viên  ',
  description: '  Chuẩn bị tháng mới  ',
  startAt: '2026-07-22T08:00:00.000Z',
  endAt: '2026-07-22T09:00:00.000Z',
  participantIds: [' staff-1 ', '', 'staff-1', 'staff-2'],
  teacherIds: ['teacher-1', 'teacher-1', null],
  staffIds: ['admin-1', ''],
  customColor: '#FFAA00',
  recurrenceRule: { frequency: 'weekly', count: 5 },
})

assert.equal(normalizedItem.id, 'item-001')
assert.equal(normalizedItem.itemType, 'meeting')
assert.equal(normalizedItem.title, 'Họp giáo viên')
assert.deepEqual(normalizedItem.participantIds, ['staff-1', 'staff-2'])
assert.deepEqual(normalizedItem.teacherIds, ['teacher-1'])
assert.deepEqual(normalizedItem.staffIds, ['admin-1'])
assert.equal(normalizedItem.customColor, '#ffaa00')
assert.equal(normalizedItem.colorKey, CENTER_CALENDAR_COLOR_PRESETS.meeting.key)
assert.equal(normalizedItem.recurrenceRule.frequency, 'weekly')

assert.equal(normalizeCenterCalendarItem({ ...normalizedItem, title: ' ' }), null)
assert.equal(normalizeCenterCalendarItem({ ...normalizedItem, startAt: 'bad-date' }), null)
assert.equal(normalizeCenterCalendarItem({ ...normalizedItem, endAt: 'bad-date' }), null)
assert.equal(
  normalizeCenterCalendarItem({
    ...normalizedItem,
    startAt: '2026-07-22T10:00:00.000Z',
    endAt: '2026-07-22T09:00:00.000Z',
  }),
  null,
)
assert.equal(
  normalizeCenterCalendarItem({ ...normalizedItem, customColor: 'url(javascript:bad)' }).customColor,
  '',
)
assert.equal(getCenterCalendarPresetForType('tournament').key, 'emerald')
assert.equal(getCenterCalendarPresetForType('unknown').key, 'yellow')

const normalizedTag = normalizeCenterCalendarTag({
  id: ' tag-001 ',
  centerId: 'dreamhome',
  label: '  Nội bộ  ',
  colorKey: 'green',
  customColor: '#00FFAA',
  defaultItemType: 'meeting',
  isActive: undefined,
})

assert.equal(normalizedTag.label, 'Nội bộ')
assert.equal(normalizedTag.defaultItemType, 'meeting')
assert.equal(normalizedTag.isActive, true)
assert.equal(normalizedTag.customColor, '#00ffaa')
assert.equal(normalizeCenterCalendarTag({ label: '' }), null)
assert.equal(normalizeCenterCalendarTag({ label: 'Tag lỗi', defaultItemType: 'fixedClass' }).defaultItemType, 'other')

const storage = createMemoryStorage()
assert.deepEqual(loadStoredCenterCalendarItems('dreamhome', storage), [])
assert.deepEqual(loadStoredCenterCalendarTags('dreamhome', storage), [])

const savedItems = saveStoredCenterCalendarItems('center-a', [
  normalizedItem,
  { ...normalizedItem, id: 'event-1', itemType: 'event', title: 'Sự kiện', startAt: '2026-07-23T08:00:00.000Z', endAt: '2026-07-23T09:00:00.000Z' },
  { ...normalizedItem, id: 'bad-class', itemType: 'classSession' },
], storage)
const savedTags = saveStoredCenterCalendarTags('center-a', [normalizedTag], storage)

assert.equal(savedItems.length, 2)
assert.equal(savedTags.length, 1)
assert.equal(loadStoredCenterCalendarItems('center-a', storage).length, 2)
assert.equal(loadStoredCenterCalendarTags('center-a', storage).length, 1)
assert.deepEqual(loadStoredCenterCalendarItems('center-b', storage), [])
assert.deepEqual(loadStoredCenterCalendarTags('center-b', storage), [])
assert.notEqual(getCenterCalendarItemsStorageKey('center-a'), getCenterCalendarItemsStorageKey('center-b'))
assert.notEqual(getCenterCalendarTagsStorageKey('center-a'), getCenterCalendarTagsStorageKey('center-b'))

storage.setItem(getCenterCalendarItemsStorageKey('broken-center'), '{bad json')
storage.setItem(getCenterCalendarTagsStorageKey('broken-center'), '{"not":"array"}')
assert.deepEqual(loadStoredCenterCalendarItems('broken-center', storage), [])
assert.deepEqual(loadStoredCenterCalendarTags('broken-center', storage), [])

const sourceItems = [
  { ...normalizedItem, id: 'range-3', title: 'Zulu', startAt: '2026-07-22T10:00:00.000Z', endAt: '2026-07-22T11:00:00.000Z' },
  { ...normalizedItem, id: 'range-1', title: 'Alpha', startAt: '2026-07-22T08:00:00.000Z', endAt: '2026-07-22T09:00:00.000Z' },
  { ...normalizedItem, id: 'range-2', title: 'Beta', startAt: '2026-07-22T08:00:00.000Z', endAt: '2026-07-22T09:30:00.000Z' },
]
const sourceSnapshot = JSON.stringify(sourceItems)
const rangeItems = getCenterCalendarItemsForRange(
  sourceItems,
  '2026-07-22T07:30:00.000Z',
  '2026-07-22T10:30:00.000Z',
)
assert.equal(JSON.stringify(sourceItems), sourceSnapshot, 'Range helper must not mutate source.')
assert.deepEqual(rangeItems.map((item) => item.id), ['range-1', 'range-2', 'range-3'])

const recurringItem = normalizeCenterCalendarItem({
  ...normalizedItem,
  id: 'recurring-1',
  recurrenceRule: { frequency: 'weekly', count: 10 },
})
const recurringRange = getCenterCalendarItemsForRange(
  [recurringItem],
  '2026-07-22T07:00:00.000Z',
  '2026-08-31T23:00:00.000Z',
)
assert.equal(recurringRange.length, 1, 'F23.5A must not expand recurrence.')

const protectedStorage = createMemoryStorage()
protectedStorage.setItem('ichessCenterOS.classSessions.center-a', JSON.stringify([{ id: 'class-1' }]))
protectedStorage.setItem('ichessCenterOS.schedule.center-a', JSON.stringify([{ id: 'schedule-1' }]))
protectedStorage.setItem('ichessCenterOS.attendanceRecords.center-a', JSON.stringify([{ id: 'attendance-1' }]))
protectedStorage.setItem('ichessCenterOS.tuition.center-a', JSON.stringify([{ id: 'tuition-1', usedSessions: 3 }]))
saveStoredCenterCalendarItems('center-a', [normalizedItem], protectedStorage)
assert.deepEqual(JSON.parse(protectedStorage.getItem('ichessCenterOS.classSessions.center-a')), [{ id: 'class-1' }])
assert.deepEqual(JSON.parse(protectedStorage.getItem('ichessCenterOS.schedule.center-a')), [{ id: 'schedule-1' }])
assert.deepEqual(JSON.parse(protectedStorage.getItem('ichessCenterOS.attendanceRecords.center-a')), [{ id: 'attendance-1' }])
assert.deepEqual(JSON.parse(protectedStorage.getItem('ichessCenterOS.tuition.center-a')), [{ id: 'tuition-1', usedSessions: 3 }])

assert(!helperSource.includes('attendance-records'), 'Foundation must not call attendance adapter.')
assert(!helperSource.includes('tuition-module'), 'Foundation must not import tuition.')
assert(!helperSource.includes('teacher-workspace'), 'Foundation must not import Teacher Workspace.')
assert(!helperSource.includes('teacher-module'), 'Foundation must not import Teacher Portal.')
assert(!helperSource.includes('@supabase'), 'Foundation must not import Supabase/Auth.')
assert(!helperSource.includes('createClient'), 'Foundation must not create Auth/Supabase clients.')
assert(!helperSource.includes('schedule-module'), 'Foundation must not import TKB UI.')
assert(!helperSource.includes('scheduleSessions'), 'Foundation must not use scheduleSessions.')
assert(!helperSource.includes('classSessions'), 'Foundation must not use classSessions.')

const emptyItems = normalizeCenterCalendarItems([])
const emptyTags = normalizeCenterCalendarTags([])
assert.deepEqual(emptyItems, [])
assert.deepEqual(emptyTags, [])

assert(fs.existsSync(docsPath), 'F23.5A docs must exist.')
const docs = fs.readFileSync(docsPath, 'utf8')
for (const term of [
  'centerCalendarItems',
  'centerCalendarTags',
  'meeting',
  'event',
  'tournament',
  'other',
  'Không seed demo',
  'Recurrence defer',
  'không render UI TKB',
  'Điểm danh',
  'Học phí',
  'Teacher Portal',
]) {
  assert(docs.includes(term), `Missing docs term: ${term}`)
}

const mojibakeMarkers = [
  ['C', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
  ['\u0102', '\u0192'].join(''),
  ['\u0102', '\u2020', '\u00c2', '\u00b0'].join(''),
  ['H', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
  ['\u0102', '\u00a1', '\u00c2', '\u00bb'].join(''),
]

for (const mojibakeMarker of mojibakeMarkers) {
  assert(!helperSource.includes(mojibakeMarker), `Mojibake marker found in helper: ${mojibakeMarker}`)
  assert(!docs.includes(mojibakeMarker), `Mojibake marker found in docs: ${mojibakeMarker}`)
}

console.log('F23.5A center calendar data foundation local-safe smoke passed')

function createMemoryStorage() {
  const records = new Map()
  return {
    getItem(key) {
      return records.has(String(key)) ? records.get(String(key)) : null
    },
    setItem(key, value) {
      records.set(String(key), String(value))
    },
    removeItem(key) {
      records.delete(String(key))
    },
  }
}
