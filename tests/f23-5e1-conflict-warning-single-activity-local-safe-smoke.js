import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildCenterCalendarItemFromForm,
  createCenterCalendarItemConflictState,
  createEmptyCenterCalendarItemFormState,
  renderScheduleModule,
  validateCenterCalendarItemForm,
} from '../src/schedule-module.js'
import {
  detectCenterCalendarConflicts,
  hasTimeOverlap,
  normalizeCenterCalendarConflictEntry,
  normalizeCenterCalendarRoomIdentity,
  normalizeLocationText,
} from '../src/center-calendar-conflicts.js'

const repoRoot = process.cwd()
const conflictPath = path.join(repoRoot, 'src', 'center-calendar-conflicts.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const schedulePath = path.join(repoRoot, 'src', 'schedule-module.js')
const stylesPath = path.join(repoRoot, 'src', 'styles.css')
const docsPath = path.join(repoRoot, 'docs', 'f23-5e1-conflict-warning-single-activity-local-safe.md')

const conflictSource = fs.readFileSync(conflictPath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')
const schedule = fs.readFileSync(schedulePath, 'utf8')
const styles = fs.readFileSync(stylesPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')

assert.equal(normalizeLocationText('  Phòng   1  '), 'phòng 1')
assert.deepEqual(normalizeCenterCalendarRoomIdentity({ roomId: ' R1 ', location: 'Phòng 1' }), {
  kind: 'roomId',
  value: 'r1',
  label: 'R1',
})
assert.deepEqual(normalizeCenterCalendarRoomIdentity({ location: ' Phòng   1 ' }), {
  kind: 'location',
  value: 'phòng 1',
  label: 'Phòng   1',
})

const rangeA = normalizeCenterCalendarConflictEntry({
  id: 'a',
  centerId: 'center-a',
  title: 'A',
  startAt: '2026-07-22T09:00:00+07:00',
  endAt: '2026-07-22T10:00:00+07:00',
})
const adjacentRange = normalizeCenterCalendarConflictEntry({
  id: 'b',
  centerId: 'center-a',
  title: 'B',
  startAt: '2026-07-22T10:00:00+07:00',
  endAt: '2026-07-22T11:00:00+07:00',
})
const containedRange = normalizeCenterCalendarConflictEntry({
  id: 'c',
  centerId: 'center-a',
  title: 'C',
  startAt: '2026-07-22T09:15:00+07:00',
  endAt: '2026-07-22T09:30:00+07:00',
})
assert.equal(hasTimeOverlap(rangeA, adjacentRange), false, 'Adjacent half-open ranges must not overlap.')
assert.equal(hasTimeOverlap(rangeA, containedRange), true, 'Contained range must overlap.')
assert.equal(normalizeCenterCalendarConflictEntry({ id: 'bad', startAt: 'bad', endAt: '2026-07-22T10:00:00+07:00' }), null)

const baseCandidate = buildCenterCalendarItemFromForm({
  itemType: 'meeting',
  title: 'Họp phụ huynh',
  date: '2026-07-22',
  startTime: '09:00',
  endTime: '10:00',
  location: ' Phòng   1 ',
  colorKey: 'orange',
}, null, 'center-a')
const sourceSnapshot = JSON.stringify({
  candidate: baseCandidate,
  classSessions: [
    { id: 'class-wed', name: 'Lớp thứ tư', daysOfWeek: ['wed'], startTime: '09:30', endTime: '10:30', room: 'Phòng 1', status: 'active' },
  ],
})

const hardClassResult = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  classSessions: [
    { id: 'class-wed', name: 'Lớp thứ tư', daysOfWeek: ['wed'], startTime: '09:30', endTime: '10:30', room: 'Phòng 1', status: 'active' },
  ],
  scheduleSessions: [],
  centerCalendarItems: [],
})
assert.equal(hardClassResult.hasHard, true, 'Class/session same room overlap must be hard.')
assert.equal(hardClassResult.hard[0].sourceKind, 'class-session')
assert.equal(hardClassResult.hard[0].conflictType, 'room')
assert.equal(hardClassResult.hasSoft, false)
assert.equal(JSON.stringify({
  candidate: baseCandidate,
  classSessions: [
    { id: 'class-wed', name: 'Lớp thứ tư', daysOfWeek: ['wed'], startTime: '09:30', endTime: '10:30', room: 'Phòng 1', status: 'active' },
  ],
}), sourceSnapshot, 'Conflict helper must not mutate inputs.')

const hardScheduleResult = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  classSessions: [],
  scheduleSessions: [
    { id: 'lesson-1', scheduleType: 'oneOff', title: 'Học bù', date: '2026-07-22', startTime: '09:15', endTime: '09:45', room: 'Phòng 1', status: 'scheduled' },
  ],
  centerCalendarItems: [],
})
assert.equal(hardScheduleResult.hasHard, true, 'Real one-off lesson same room overlap must be hard.')
assert.equal(hardScheduleResult.hard[0].sourceKind, 'schedule-session')

const softItem = buildCenterCalendarItemFromForm({
  itemType: 'event',
  title: 'Workshop',
  date: '2026-07-22',
  startTime: '09:30',
  endTime: '10:30',
  location: 'phòng 1',
  colorKey: 'green',
}, null, 'center-a')
const softResult = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [softItem],
})
assert.equal(softResult.hasHard, false)
assert.equal(softResult.hasSoft, true, 'Other calendar item same room overlap must be soft.')
assert.equal(softResult.soft[0].sourceKind, 'center-calendar-item')

const noConflictAdjacent = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [
    buildCenterCalendarItemFromForm({
      itemType: 'meeting',
      title: 'Adjacent',
      date: '2026-07-22',
      startTime: '10:00',
      endTime: '11:00',
      location: 'Phòng 1',
      colorKey: 'orange',
    }, null, 'center-a'),
  ],
})
assert.equal(noConflictAdjacent.total, 0, 'Adjacent calendar item must not conflict.')

const infoDifferentRoom = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [
    buildCenterCalendarItemFromForm({
      itemType: 'meeting',
      title: 'Khác phòng',
      date: '2026-07-22',
      startTime: '09:30',
      endTime: '10:30',
      location: 'Phòng 2',
      colorKey: 'orange',
    }, null, 'center-a'),
  ],
})
assert.equal(infoDifferentRoom.highestSeverity, 'informational', 'Overlapping different room item is informational only.')
assert.equal(infoDifferentRoom.requiresDecision, false)

const cancelledIgnored = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [{ ...softItem, isCancelled: true }],
  scheduleSessions: [
    { id: 'cancelled-lesson', scheduleType: 'oneOff', title: 'Đã hủy', date: '2026-07-22', startTime: '09:15', endTime: '09:45', room: 'Phòng 1', status: 'cancelled' },
  ],
})
assert.equal(cancelledIgnored.total, 0, 'Cancelled records must be ignored.')

const differentCenterIgnored = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [{ ...softItem, centerId: 'center-b' }],
})
assert.equal(differentCenterIgnored.total, 0, 'Different center calendar item must be ignored.')

const editSelfIgnored = detectCenterCalendarConflicts({
  candidate: baseCandidate,
  centerId: 'center-a',
  centerCalendarItems: [baseCandidate, softItem],
  currentItemId: baseCandidate.id,
})
assert.equal(editSelfIgnored.soft.length, 1, 'Edit must ignore self and still compare other items.')
assert.equal(editSelfIgnored.soft[0].sourceId, softItem.id)

const roomIdResult = detectCenterCalendarConflicts({
  candidate: { ...baseCandidate, roomId: 'room-a', location: '' },
  centerId: 'center-a',
  centerCalendarItems: [{ ...softItem, roomId: 'ROOM-A', location: 'Phòng khác' }],
})
assert.equal(roomIdResult.hasSoft, true, 'Matching roomId must beat text location.')

const aliasResult = detectCenterCalendarConflicts({
  candidate: { ...baseCandidate, location: 'P1' },
  centerId: 'center-a',
  centerCalendarItems: [{ ...softItem, location: 'Phòng 1' }],
})
assert.equal(aliasResult.hasSoft, false, 'P1 must not be auto-mapped to Phòng 1.')

const allDayCandidate = buildCenterCalendarItemFromForm({
  itemType: 'event',
  title: 'Cả ngày',
  date: '2026-07-22',
  allDay: true,
  location: 'Phòng 1',
  colorKey: 'green',
}, null, 'center-a')
const allDayResult = detectCenterCalendarConflicts({
  candidate: allDayCandidate,
  centerId: 'center-a',
  classSessions: [
    { id: 'class-wed', name: 'Lớp thứ tư', daysOfWeek: ['wednesday'], startTime: '15:00', endTime: '16:00', room: 'Phòng 1', status: 'active' },
  ],
})
assert.equal(allDayResult.hasHard, true, 'All-day activity with room must conflict with class in that room.')

const noRoomAllDayResult = detectCenterCalendarConflicts({
  candidate: { ...allDayCandidate, location: '' },
  centerId: 'center-a',
  classSessions: [
    { id: 'class-wed', name: 'Lớp thứ tư', daysOfWeek: ['wednesday'], startTime: '15:00', endTime: '16:00', room: 'Phòng 1', status: 'active' },
  ],
})
assert.equal(noRoomAllDayResult.hasHard, false, 'All-day activity without room must not block the whole center.')
assert.equal(noRoomAllDayResult.highestSeverity, 'informational')

const overnightCandidate = buildCenterCalendarItemFromForm({
  itemType: 'meeting',
  title: 'Qua đêm',
  date: '2026-07-22',
  startTime: '22:00',
  endTime: '01:00',
  location: 'Phòng 1',
  colorKey: 'orange',
}, null, 'center-a')
assert.equal(validateCenterCalendarItemForm({
  itemType: 'meeting',
  title: 'Qua đêm',
  date: '2026-07-22',
  startTime: '22:00',
  endTime: '01:00',
  allDay: false,
}).endTime, undefined, 'Cross-midnight activity should validate.')
assert(new Date(overnightCandidate.endAt).getTime() > new Date(overnightCandidate.startAt).getTime(), 'Cross-midnight build must advance end date.')
const overnightResult = detectCenterCalendarConflicts({
  candidate: overnightCandidate,
  centerId: 'center-a',
  scheduleSessions: [
    { id: 'late-lesson', scheduleType: 'oneOff', title: 'Lớp khuya', date: '2026-07-23', startTime: '00:30', endTime: '01:30', room: 'Phòng 1', status: 'scheduled' },
  ],
})
assert.equal(overnightResult.hasHard, true, 'Cross-midnight conflict must be detected after midnight.')

const sortedResult = detectCenterCalendarConflicts({
  candidate: allDayCandidate,
  centerId: 'center-a',
  classSessions: [
    { id: 'class-late', name: 'B late', daysOfWeek: ['wed'], startTime: '17:00', endTime: '18:00', room: 'Phòng 1', status: 'active' },
    { id: 'class-early', name: 'A early', daysOfWeek: ['wed'], startTime: '08:00', endTime: '09:00', room: 'Phòng 1', status: 'active' },
  ],
})
assert.deepEqual(sortedResult.hard.map((conflict) => conflict.title), ['A early', 'B late'], 'Conflicts must sort deterministically.')

const hardState = createCenterCalendarItemConflictState({
  previousState: { ...createEmptyCenterCalendarItemFormState('2026-07-22'), values: { title: 'Draft' } },
  conflictResult: hardClassResult,
  pendingItem: baseCandidate,
})
const hardHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: hardState,
  centerCalendarItems: [],
  centerCalendarTags: [],
  classSessions: [],
})
assert(hardHtml.includes('Không thể lưu do trùng lịch'), 'Hard conflict panel must render.')
assert(hardHtml.includes('Quay lại chỉnh sửa'), 'Hard panel must allow returning to edit.')
assert(!hardHtml.includes('Vẫn lưu'), 'Hard conflict with real class/session must not expose override.')

const softState = createCenterCalendarItemConflictState({
  previousState: { ...createEmptyCenterCalendarItemFormState('2026-07-22'), values: { title: 'Draft' } },
  conflictResult: softResult,
  pendingItem: baseCandidate,
})
const softHtml = renderScheduleModule([], null, null, [], null, null, null, null, false, null, [], [], '2026-07-20', null, {
  centerCalendarItemState: softState,
  centerCalendarItems: [],
  centerCalendarTags: [],
  classSessions: [],
})
assert(softHtml.includes('Hoạt động đang trùng lịch'), 'Soft conflict panel must render.')
assert(softHtml.includes('Vẫn lưu'), 'Soft panel must expose override.')
assert(!softHtml.includes('data-module-launcher'), 'Conflict panel must not be marked as launcher.')

for (const marker of [
  'detectCenterCalendarConflicts',
  'createCenterCalendarItemConflictState',
  'persistCenterCalendarItem',
  "action === 'conflict-return'",
  "action === 'conflict-save'",
]) {
  assert(main.includes(marker), `Missing main integration marker: ${marker}`)
}

const saveFlow = getBetween(main, 'const saveCenterCalendarItemFromForm = (event) => {', 'const saveCenterCalendarTagFromForm = (event) => {')
assert(saveFlow.includes('detectCenterCalendarConflicts'), 'Conflict check must run in save flow.')
assert(saveFlow.includes('conflictResult.hasHard || conflictResult.hasSoft'), 'Only hard/soft conflicts should open panel.')
assert(saveFlow.includes('createCenterCalendarItemConflictState'), 'Save flow must preserve form state in conflict panel.')
assert(saveFlow.includes('persistCenterCalendarItem(centerId, nextItem, existingItem)'), 'No-conflict save must persist normally.')
assert(!saveFlow.includes('saveStoredSchedule'), 'Activity conflict save must not write schedule sessions.')
assert(!saveFlow.includes('saveStoredClassSessions'), 'Activity conflict save must not write class sessions.')
assert(!saveFlow.includes('window.confirm'), 'Conflict UI must not use browser confirm.')

const fieldBinding = getBetween(
  main,
  "document.querySelectorAll('[data-center-calendar-form-field]').forEach((control) =>",
  "document.querySelectorAll('[data-center-calendar-tag-field]').forEach((control) =>",
)
assert(!fieldBinding.includes('detectCenterCalendarConflicts'), 'Conflict check must not run on input/change.')
assert(!fieldBinding.includes('render()'), 'Activity input/change must not full-render the app.')
assert(!fieldBinding.includes('openModuleWindow'), 'Activity input/change must not reopen modules.')

const actionBinding = getSnippetAfter(main, "document.querySelectorAll('[data-center-calendar-action]').forEach((button) =>", 7600)
assert(actionBinding.includes("action === 'conflict-save'"), 'Soft override action must be handled.')
assert(actionBinding.includes('persistCenterCalendarItem(centerId, pendingItem, existingItem)'), 'Override must save pending candidate exactly once.')
assert(!actionBinding.includes('saveStoredSchedule'), 'Conflict actions must not write schedule sessions.')
assert(!actionBinding.includes('saveStoredClassSessions'), 'Conflict actions must not write class sessions.')
assert(!main.includes("document.querySelectorAll('[data-module-id]').forEach((button) =>"), 'Generic module launcher regression must not return.')

assert(conflictSource.includes('sourceKind'), 'Conflict module must use canonical source kind.')
assert(conflictSource.includes('class-session'), 'Conflict module must map class sessions.')
assert(conflictSource.includes('schedule-session'), 'Conflict module must map schedule sessions.')
assert(conflictSource.includes('center-calendar-item'), 'Conflict module must map calendar items.')
assert(!conflictSource.includes('document.'), 'Conflict module must be DOM-free.')
assert(!conflictSource.includes('localStorage'), 'Conflict module must not read storage directly.')
assert(!conflictSource.includes('recurrenceRule'), 'F23.5E1 must not implement recurrence.')
assert(!conflictSource.includes('teacherId') && !conflictSource.includes('participant'), 'F23.5E1 must not implement teacher/participant conflict.')
for (const forbidden of ['saveStoredSchedule', 'saveStoredClassSessions', 'attendanceRecords', 'tuition.usedSessions', 'Teacher Workspace', 'supabase.from']) {
  assert(!main.includes(`${forbidden}(`) || !saveFlow.includes(forbidden), `Save flow must not touch forbidden flow: ${forbidden}`)
}

assert(styles.includes('.schedule-calendar-conflict-panel'), 'Conflict panel styles must exist.')
assert(schedule.includes('renderCenterCalendarConflictPanel'), 'Schedule module must render conflict panel.')
assert(docs.includes('Conflict module'), 'Docs must describe conflict module.')
assert(docs.includes('Không recurrence'), 'Docs must state recurrence is not implemented.')

for (const mojibakeMarker of createMojibakeMarkers()) {
  for (const [label, source] of [
    [conflictPath, conflictSource],
    [mainPath, main],
    [schedulePath, schedule],
    [stylesPath, styles],
    [docsPath, docs],
  ]) {
    assert(!source.includes(mojibakeMarker), `${label} contains mojibake marker`)
  }
}

console.log('F23.5E1 conflict warning single activity local-safe smoke passed')

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
  ]
}
