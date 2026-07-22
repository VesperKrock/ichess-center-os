import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { loadStoredCenterCalendarItems, saveStoredCenterCalendarItems } from '../src/center-calendar-data.js'
import { renderScheduleModule } from '../src/schedule-module.js'

const repoRoot = process.cwd()
const scheduleSource = fs.readFileSync(path.join(repoRoot, 'src', 'schedule-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const stylesSource = fs.readFileSync(path.join(repoRoot, 'src', 'styles.css'), 'utf8')
const docsPath = path.join(repoRoot, 'docs', 'f23-5b-render-center-calendar-items-readonly-tren-tkb.md')

const centerStorage = createMemoryStorage()
saveStoredCenterCalendarItems('center-a', [
  {
    id: 'qa-f23-5b-meeting',
    centerId: 'center-a',
    itemType: 'meeting',
    title: 'Họp giáo viên',
    startAt: '2026-07-22T08:00:00.000Z',
    endAt: '2026-07-22T09:00:00.000Z',
    location: 'Phòng họp',
  },
  {
    id: 'qa-f23-5b-event',
    centerId: 'center-a',
    itemType: 'event',
    title: 'Sự kiện khai mạc',
    startAt: '2026-07-23T08:00:00.000Z',
    endAt: '2026-07-23T09:00:00.000Z',
    customColor: '#00ffaa',
    tagLabel: 'Cộng đồng',
  },
  {
    id: 'qa-f23-5b-tournament',
    centerId: 'center-a',
    itemType: 'tournament',
    title: 'Giải đấu cuối tuần',
    startAt: '2026-07-24T08:00:00.000Z',
    endAt: '2026-07-24T09:00:00.000Z',
    roomId: 'Sảnh 1',
    isCancelled: true,
  },
  {
    id: 'qa-f23-5b-other',
    centerId: 'center-a',
    itemType: 'other',
    title: 'Kiểm kê thiết bị',
    startAt: '2026-07-25T00:00:00.000Z',
    endAt: '2026-07-25T23:59:00.000Z',
    allDay: true,
  },
  {
    id: 'qa-f23-5b-class-like',
    centerId: 'center-a',
    itemType: 'classSession',
    title: 'Không được render',
    startAt: '2026-07-22T08:00:00.000Z',
    endAt: '2026-07-22T09:00:00.000Z',
  },
  {
    id: 'qa-f23-5b-outside-week',
    centerId: 'center-a',
    itemType: 'meeting',
    title: 'Ngoài tuần',
    startAt: '2026-08-22T08:00:00.000Z',
    endAt: '2026-08-22T09:00:00.000Z',
  },
], centerStorage)
saveStoredCenterCalendarItems('center-b', [
  {
    id: 'qa-f23-5b-other-center',
    centerId: 'center-b',
    itemType: 'meeting',
    title: 'Không lọt center',
    startAt: '2026-07-22T08:00:00.000Z',
    endAt: '2026-07-22T09:00:00.000Z',
  },
], centerStorage)

const centerAItems = loadStoredCenterCalendarItems('center-a', centerStorage)
const sourceSnapshot = JSON.stringify(centerAItems)
const html = renderScheduleModule(
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
    classSessions: [
      {
        id: 'class-session-1',
        name: 'Ca cố định',
        daysOfWeek: ['wed'],
        startTime: '08:00',
        endTime: '09:00',
        displayLabel: 'Ca cố định',
        status: 'active',
      },
    ],
    centerCalendarItems: centerAItems,
  },
)

assert.equal(JSON.stringify(centerAItems), sourceSnapshot, 'Render must not mutate centerCalendarItems.')
assert(mainSource.includes('loadStoredCenterCalendarItems'))
assert(mainSource.includes('centerCalendarItems: loadStoredCenterCalendarItems(getCurrentResolvedCenterId())'))
assert(scheduleSource.includes('getCenterCalendarItemsForRange'))
assert(scheduleSource.includes('data-center-calendar-item-id'))
assert(stylesSource.includes('.schedule-calendar-item'))

for (const expected of [
  'schedule-calendar-item',
  'schedule-calendar-item--meeting',
  'schedule-calendar-item--event',
  'schedule-calendar-item--tournament',
  'schedule-calendar-item--other',
  'Hội họp',
  'Sự kiện',
  'Giải đấu',
  'Hoạt động khác',
  'Họp giáo viên',
  'Sự kiện khai mạc',
  'Giải đấu cuối tuần',
  'Kiểm kê thiết bị',
  'Phòng họp',
  'Sảnh 1',
  'Cộng đồng',
  'Cả ngày',
  'Đã hủy',
  '--schedule-calendar-item-color: #00ffaa',
]) {
  assert(html.includes(expected), `Rendered schedule HTML must include: ${expected}`)
}

for (const forbidden of [
  'Không được render',
  'Ngoài tuần',
  'Không lọt center',
  'data-session-id',
  'data-schedule-report-role',
  'data-schedule-action="save-attendance"',
  'data-schedule-action="delete-session"',
]) {
  assert(!getCalendarHtml(html).includes(forbidden), `Calendar layer must not include: ${forbidden}`)
}

assert(html.includes('is-empty-slot'), 'Fixed class slot must still render.')
assert(html.includes('data-schedule-action="open-create"'), '+ Thêm buổi học action must remain.')
assert(html.includes('data-schedule-action="open-create-for-day"'), 'Per-day existing schedule add action must remain.')

assert(!scheduleSource.includes('saveStoredCenterCalendarItems'), 'Schedule render must not persist calendar items.')
assert(!scheduleSource.includes('loadStoredCenterCalendarItems'), 'Schedule module must receive items, not read storage directly.')
assert(!scheduleSource.includes('tuition.usedSessions'), 'Schedule render must not update tuition used sessions.')
assert(!scheduleSource.includes('teacher-workspace'), 'Schedule render must not write Teacher Workspace.')
assert(!scheduleSource.includes('@supabase'), 'Schedule render must not call Supabase/Auth.')

assert(fs.existsSync(docsPath), 'F23.5B docs must exist.')
const docs = fs.readFileSync(docsPath, 'utf8')
for (const term of [
  'ichessCenterOS.centerCalendarItems.<centerId>',
  'qa-f23-5b-',
  'localStorage.setItem',
  'localStorage.removeItem',
  'Cleanup',
  'không seed demo',
  'không nối Điểm danh',
  'không nối Học phí',
  'Teacher Portal',
  'F23.5C',
]) {
  assert(docs.includes(term), `Missing docs term: ${term}`)
}

for (const mojibakeMarker of createMojibakeMarkers()) {
  assert(!scheduleSource.includes(mojibakeMarker), `Mojibake marker found in schedule source: ${mojibakeMarker}`)
  assert(!docs.includes(mojibakeMarker), `Mojibake marker found in docs: ${mojibakeMarker}`)
}

console.log('F23.5B render center calendar items read-only on schedule smoke passed')

function getCalendarHtml(html) {
  return html
    .split('<article')
    .filter((part) => part.includes('schedule-calendar-item'))
    .map((part) => `<article${part.split('</article>')[0]}</article>`)
    .join('\n')
}

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

function createMojibakeMarkers() {
  return [
    ['C', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u0192'].join(''),
    ['\u0102', '\u2020', '\u00c2', '\u00b0'].join(''),
    ['H', '\u0102', '\u00a1', '\u00c2', '\u00ba'].join(''),
    ['\u0102', '\u00a1', '\u00c2', '\u00bb'].join(''),
  ]
}
