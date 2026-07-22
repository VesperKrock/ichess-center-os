import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  SCHEDULE_PRINT_FILTER_ALL,
  SCHEDULE_PRINT_FILTER_CURRENT,
  createSchedulePrintSnapshot,
  getSchedulePrintDocumentTitle,
  getSchedulePrintFilteredSnapshot,
  renderSchedulePrintDocument,
} from '../src/schedule-print-module.js'
import { renderScheduleModule } from '../src/schedule-module.js'

const weekStartDate = '2026-07-20'
const teachers = [
  { id: 'teacher-1', displayName: 'Cô Linh' },
]
const legacyMojibakeNewLessonTitle = 'Bu\u00e1\u00bb\u2022i h\u00e1\u00bb\u008dc m\u00e1\u00bb\u203ai'
const repairedNewLessonTitle = 'Buổi học mới'
const htmlSpecialTitle = 'Cờ <b>"&\'</b>'
const classSessions = [
  {
    id: 'class-1',
    name: legacyMojibakeNewLessonTitle,
    daysOfWeek: ['monday'],
    startTime: '09:00',
    endTime: '10:00',
    room: 'P1',
    status: 'active',
  },
]
const scheduleSessions = [
  {
    id: 'session-1',
    scheduleType: 'oneOff',
    occurrenceReason: 'makeup',
    date: '2026-07-21',
    startTime: '10:00',
    endTime: '11:00',
    title: legacyMojibakeNewLessonTitle,
    room: 'P2',
    teacherId: 'teacher-1',
  },
]
const centerCalendarTags = [
  {
    id: 'tag-important',
    centerId: 'center-a',
    label: 'Ưu tiên',
    colorKey: 'red',
    isActive: true,
  },
  {
    id: 'tag-unused',
    centerId: 'center-a',
    label: 'Không dùng',
    colorKey: 'gray',
    isActive: true,
  },
]
const centerCalendarItems = [
  {
    id: 'activity-all-day',
    centerId: 'center-a',
    itemType: 'meeting',
    title: 'Họp phụ huynh',
    startAt: '2026-07-22T00:00:00.000Z',
    endAt: '2026-07-23T00:00:00.000Z',
    allDay: true,
    location: 'Sảnh',
    colorKey: 'orange',
    tagId: 'tag-important',
    tagLabel: 'Ưu tiên',
    sourceModule: 'centerCalendar',
  },
  {
    id: 'activity-cross-midnight',
    centerId: 'center-a',
    itemType: 'tournament',
    title: 'Giải tối',
    startAt: '2026-07-24T22:00:00.000Z',
    endAt: '2026-07-25T01:00:00.000Z',
    location: 'P3',
    colorKey: 'emerald',
    isCancelled: true,
    sourceModule: 'centerCalendar',
  },
  {
    id: 'activity-legacy-title',
    centerId: 'center-a',
    itemType: 'other',
    title: legacyMojibakeNewLessonTitle,
    startAt: '2026-07-23T08:00:00.000Z',
    endAt: '2026-07-23T09:00:00.000Z',
    location: 'P5',
    colorKey: 'yellow',
    sourceModule: 'centerCalendar',
  },
  {
    id: 'activity-html-special',
    centerId: 'center-a',
    itemType: 'other',
    title: htmlSpecialTitle,
    startAt: '2026-07-23T09:00:00.000Z',
    endAt: '2026-07-23T10:00:00.000Z',
    location: 'P<script>',
    colorKey: 'yellow',
    tagLabel: 'Tag & <safe>',
    sourceModule: 'centerCalendar',
  },
  {
    id: 'activity-recurring',
    centerId: 'center-a',
    itemType: 'event',
    title: 'Sinh hoạt tuần',
    startAt: '2026-07-20T13:00:00.000Z',
    endAt: '2026-07-20T14:00:00.000Z',
    location: 'P4',
    colorKey: 'green',
    recurrenceRule: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: ['mon'],
      endMode: 'count',
      count: 2,
      timezone: 'Asia/Ho_Chi_Minh',
    },
    sourceModule: 'centerCalendar',
  },
  {
    id: 'activity-out-of-week',
    centerId: 'center-a',
    itemType: 'other',
    title: 'Ngoài tuần',
    startAt: '2026-08-20T09:00:00.000Z',
    endAt: '2026-08-20T10:00:00.000Z',
    colorKey: 'yellow',
    sourceModule: 'centerCalendar',
  },
]

const snapshot = createSchedulePrintSnapshot({
  centerId: 'center-a',
  centerName: 'iChess Center A',
  weekStartDate,
  sessions: scheduleSessions,
  classSessions,
  centerCalendarItems,
  centerCalendarTags,
  teachers,
  activityFilters: { itemType: 'event', tagId: 'all' },
  createdAt: '2026-07-22T08:30:00.000Z',
})

assert.equal(snapshot.centerId, 'center-a')
assert.equal(snapshot.centerName, 'iChess Center A')
assert.equal(snapshot.weekStartDate, weekStartDate)
assert.equal(snapshot.weekEndDate, '2026-07-26')
assert(Object.isFrozen(snapshot), 'Snapshot must be immutable.')

const allTitles = snapshot.entries.map((entry) => entry.title)
assert(allTitles.includes(repairedNewLessonTitle), 'Snapshot must repair legacy Vietnamese display text.')
assert.equal(allTitles.filter((title) => title === repairedNewLessonTitle).length, 3, 'Fixed class, schedule session, and activity legacy titles must all be repaired.')
assert(!allTitles.includes(legacyMojibakeNewLessonTitle), 'Snapshot must not keep legacy mojibake titles in printable entries.')
assert(allTitles.includes('Họp phụ huynh'), 'Snapshot must include single calendar items.')
assert(allTitles.includes('Sinh hoạt tuần'), 'Snapshot must include virtual recurring occurrence in range.')
assert(allTitles.includes(htmlSpecialTitle), 'Snapshot should keep correct non-mojibake dynamic text before HTML escaping.')
assert(!allTitles.includes('Ngoài tuần'), 'Snapshot must not include out-of-week activity.')
assert.equal(allTitles.filter((title) => title === 'Sinh hoạt tuần').length, 1, 'Recurring master and occurrence must not duplicate.')
assert.equal(classSessions[0].name, legacyMojibakeNewLessonTitle, 'Print snapshot must not mutate class session source data.')
assert.equal(scheduleSessions[0].title, legacyMojibakeNewLessonTitle, 'Print snapshot must not mutate schedule session source data.')
assert.equal(centerCalendarItems.find((item) => item.id === 'activity-legacy-title').title, legacyMojibakeNewLessonTitle, 'Print snapshot must not mutate activity source data.')

const defaultSnapshot = getSchedulePrintFilteredSnapshot(snapshot, SCHEDULE_PRINT_FILTER_ALL)
assert(defaultSnapshot.entries.some((entry) => entry.title === 'Họp phụ huynh'))
assert(defaultSnapshot.entries.some((entry) => entry.title === 'Giải tối'))

const filteredSnapshot = getSchedulePrintFilteredSnapshot(snapshot, SCHEDULE_PRINT_FILTER_CURRENT)
const filteredTitles = filteredSnapshot.entries.map((entry) => entry.title)
assert(filteredTitles.includes(repairedNewLessonTitle), 'Filter mode must not hide repaired class/session entries.')
assert(filteredTitles.includes('Sinh hoạt tuần'), 'Filter mode must keep matching activity.')
assert(!filteredTitles.includes('Họp phụ huynh'), 'Filter mode must hide non-matching activity.')

const printHtml = renderSchedulePrintDocument(defaultSnapshot)
for (const marker of [
  'Thời khóa biểu tuần',
  'iChess Center A',
  'Cả ngày',
  'hôm sau',
  'Đã hủy',
  'Lặp hàng tuần',
  'Ưu tiên',
  'Hội họp',
  'Giải đấu',
  repairedNewLessonTitle,
  'Cờ &lt;b&gt;&quot;&amp;&#039;&lt;/b&gt;',
  'P&lt;script&gt;',
  'Tag &amp; &lt;safe&gt;',
]) {
  assert(printHtml.includes(marker), `Print document missing marker: ${marker}`)
}
assert(!printHtml.includes(legacyMojibakeNewLessonTitle), 'Generated print HTML must not include legacy mojibake title.')
assert(!printHtml.includes('Không dùng'), 'Legend must not print unused tags.')
assert(!printHtml.includes('activity-out-of-week'), 'Print document must not expose out-of-week technical id.')

const scheduleHtml = renderScheduleModule(
  scheduleSessions,
  null,
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  [],
  weekStartDate,
  null,
  {
    classSessions,
    centerCalendarItems,
    centerCalendarTags,
  },
)
assert(scheduleHtml.includes('data-schedule-print-action="print"'), 'TKB toolbar must expose direct print action.')
assert(scheduleHtml.includes('In / Lưu PDF'), 'TKB toolbar must show print label.')
assert(!scheduleHtml.includes('data-module-launcher'), 'Print action must not use module launcher marker.')

assert.equal(getSchedulePrintDocumentTitle(snapshot), 'TKB-ichess-center-a-2026-07-20_2026-07-26')

const source = fs.readFileSync('src/schedule-print-module.js', 'utf8')
const main = fs.readFileSync('src/main.js', 'utf8')
const styles = fs.readFileSync('src/styles.css', 'utf8')
const pkg = fs.readFileSync('package.json', 'utf8')
const docs = fs.readFileSync('docs/f23-6b-print-preview-browser-print-tkb-weekly.md', 'utf8')

assert(!source.includes('window.print'), 'Snapshot module must not call window.print.')
assert(!source.includes('localStorage'), 'Snapshot module must not touch storage.')
assert(!source.includes('querySelector'), 'Snapshot module must not query DOM cards.')
assert(!source.includes('html2canvas'))
assert(!source.includes('jsPDF'))
assert(!source.includes('saveStored'))

assert(main.includes('function printCurrentScheduleWeek()'), 'Main must have direct print helper.')
assert(!main.includes('renderSchedulePrintPreview'), 'Hotfix must not keep dead custom preview renderer.')
assert(!main.includes('openSchedulePrintPreview'), 'Hotfix must not keep dead preview opener.')
assert(!main.includes('schedulePrintPreviewState'), 'Hotfix must not keep dead preview state.')
const directPrintFlow = getBetween(main, 'function printCurrentScheduleWeek()', 'function isProductionCenter')
assert(directPrintFlow.includes('createCurrentSchedulePrintSnapshot()'), 'Print flow must build a fresh snapshot.')
assert(directPrintFlow.includes('document.createElement'), 'Print flow must build a print root.')
assert(directPrintFlow.includes('document.body.appendChild(printRoot)'), 'Print root must be attached for browser print.')
assert(directPrintFlow.includes('window.print()'), 'Print must call browser print from explicit helper.')
assert(directPrintFlow.includes('document.title = previousTitle'), 'Print flow must restore document title.')
assert(directPrintFlow.includes('printRoot.remove()'), 'Print flow must cleanup runtime print root.')
assert(!directPrintFlow.includes('saveStored'), 'Print must not save storage.')
assert(getBetween(main, 'data-schedule-print-action="print"', "document.querySelector('[data-center-calendar-tag-action").includes('printCurrentScheduleWeek()'), 'Toolbar print button must be wired to direct print.')
assert(main.includes('data-report-action="print"'), 'Existing report print action must remain wired.')
assert(main.includes("window.open('', 'ichess-report-print'"), 'Existing report print flow must remain unchanged.')

assert(styles.includes('@page'))
assert(styles.includes('size: A4 landscape'))
assert(styles.includes('print-color-adjust: exact'))
assert(styles.includes('-webkit-print-color-adjust: exact'))
assert(styles.includes('.schedule-print-runtime-root'))
assert(styles.includes('body:has(.schedule-print-runtime-root) .app-shell'))
assert(styles.includes('.schedule-print-button:hover'), 'Print toolbar button must have hover affordance.')
assert(styles.includes('.schedule-print-button:active'), 'Print toolbar button must have active affordance.')
assert(styles.includes('.schedule-print-button:focus-visible'), 'Print toolbar button must have keyboard focus affordance.')
assert(styles.includes('cursor: pointer'), 'Print toolbar button must advertise pointer affordance.')
assert(!styles.includes('.schedule-print-preview-actions'), 'Dead custom preview CSS should be removed.')
assert(styles.includes('break-inside: avoid'))

assert(!pkg.includes('html2canvas'))
assert(!pkg.includes('jspdf'))
assert(!pkg.includes('jsPDF'))
assert(!pkg.includes('pdfkit'))

for (const forbidden of ['saveStoredAttendance', 'saveStoredTuition', 'Teacher Workspace', 'Supabase SQL']) {
  assert(!source.includes(forbidden), `Print module must not touch forbidden boundary: ${forbidden}`)
}

for (const marker of [
  'Print Architecture',
  'Snapshot Helper',
  'Current Center And Week',
  'Filter Mode',
  'A4 Landscape',
  'Focus Guard',
  'F23.6C',
]) {
  assert(docs.includes(marker), `Docs missing marker: ${marker}`)
}

for (const mojibakeMarker of ['\u00c3', '\u00c2', '\ufffd']) {
  for (const [label, text] of [
    ['source', source],
    ['main', main],
    ['styles', styles],
    ['docs', docs],
  ]) {
    assert(!text.includes(mojibakeMarker), `${label} contains mojibake marker ${mojibakeMarker}`)
  }
}

for (const [label, output] of [
  ['snapshot fixture', JSON.stringify(snapshot)],
  ['print HTML fixture', printHtml],
]) {
  assert(!output.includes(legacyMojibakeNewLessonTitle), `${label} must not contain legacy mojibake title.`)
  for (const marker of ['\u00c3', '\u00c2', '\ufffd', '\u0102', '\u00bb', '\u2022', '\u009d', '\u203a']) {
    assert(!output.includes(marker), `${label} contains mojibake output marker ${marker}`)
  }
}

function getBetween(text, start, end) {
  const startIndex = text.indexOf(start)
  assert(startIndex >= 0, `Missing start marker: ${start}`)
  const endIndex = text.indexOf(end, startIndex + start.length)
  assert(endIndex >= 0, `Missing end marker: ${end}`)
  return text.slice(startIndex, endIndex)
}

console.log('F23.6B print preview browser print TKB weekly smoke passed')
