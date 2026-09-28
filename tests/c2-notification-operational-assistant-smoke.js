import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildIncompleteAttendanceCandidates, buildPaymentAttentionCandidates, buildTuitionN2Candidates,
  getNotificationAttentionRange, getNotificationRoute, normalizeCachedOperationalNotification,
} from '../src/notification-operational-assistant.js'
import {
  filterNotifications, markNotificationReadById, upsertNotificationCandidates,
} from '../src/notification-center.js'
import {
  getStoredNotifications, saveNotificationViewedState, saveStoredNotifications,
  setCurrentInstallationStorageNamespace, setCurrentNotificationAccountId, setCurrentStorageCenterId,
} from '../src/storage.js'
import { renderNotificationAssistantPanel } from '../src/notification-assistant-panel.js'

let checks = 0
const check = (label, run) => { run(); checks++; console.log(`PASS ${label}`) }
const centerId = 'c2-fixture'
const now = new Date('2026-09-28T12:00:00Z')
const fact = (id, date, values = {}) => ({ center_id: centerId, schedule_session_local_id: id,
  occurrence_date: date, class_session_local_id: 'slot', planned_start_time: '17:30:00', planned_end_time: '18:30:00',
  lifecycle_state: 'HELD', context_origin: 'CURRENT_SCHEDULE', roster_student_ids: ['a', 'b', 'c'], ...values })
const record = (id, date, studentId, status) => ({ centerId, scheduleSessionId: id, date, studentId, attendanceStatus: status,
  attendanceAuthority: 'v2.3-occurrence-v1', source: 'admin', cloudVersion: 1,
  authorityLocalId: `${id}|${date}|${studentId}` })
const attendanceSource = (occurrences, records = []) => ({ status: 'ready', centerId,
  occurrences, attendanceRecords: records, students: ['a', 'b', 'c'].map(id => ({ id, fullName: id })),
  classSessions: [{ id: 'slot', displayLabel: 'Ca T3–T5' }], scheduleSessions: [] })
const buildAttendance = (occurrences, records) => buildIncompleteAttendanceCandidates(attendanceSource(occurrences, records), { centerId, now })

check('seven local calendar days; independent of browser timezone', () => {
  assert.equal(getNotificationAttentionRange(now).fromDate, '2026-09-22')
  assert.equal(getNotificationAttentionRange(new Date('2026-09-28T17:01:00Z')).toDate, '2026-09-29')
})
check('zero marked, known canonical roster', () => {
  const items = buildAttendance([fact('zero', '2026-09-22')])
  assert.equal(items.length, 1); assert.equal(items[0].meta.missingStudents, 3)
  assert(items[0].title.includes('Ca T3–T5 · 17:30'))
})
check('partial attendance; absence is already marked', () => {
  const items = buildAttendance([fact('partial', '2026-09-23')], [record('partial', '2026-09-23', 'a', 'present'), record('partial', '2026-09-23', 'b', 'absent')])
  assert.equal(items[0].meta.missingStudents, 1)
})
check('complete attendance resolves, including makeup', () => {
  assert.equal(buildAttendance([fact('complete', '2026-09-24')], ['present', 'absent', 'makeup'].map((status, i) => record('complete', '2026-09-24', ['a', 'b', 'c'][i], status))).length, 0)
})
check('future date and not-yet-ended session never alert', () => {
  assert.equal(buildAttendance([fact('future', '2026-09-29'), fact('later', '2026-09-28', { lifecycle_state: 'PLANNED', planned_start_time: '20:00:00', planned_end_time: '21:00:00' })]).length, 0)
})
check('cancelled and empty rosters never alert', () => {
  assert.equal(buildAttendance([fact('cancelled', '2026-09-23', { lifecycle_state: 'CANCELLED' }), fact('empty', '2026-09-23', { roster_student_ids: [] })]).length, 0)
})
check('unknown historical roster/end time never inferred', () => {
  assert.equal(buildAttendance([fact('historical', '2026-09-23', { context_origin: 'EXISTING_ATTENDANCE' }),
    fact('unknown', '2026-09-23', { context_origin: '' }), fact('missing-end', '2026-09-23', { planned_end_time: null })]).length, 0)
})
check('past planned snapshot can need attention without asserting held', () => {
  assert.equal(buildAttendance([fact('planned', '2026-09-23', { lifecycle_state: 'PLANNED' })]).length, 1)
})
check('same-day distinct occurrences and seven-day boundary preserved', () => {
  const items = buildAttendance([fact('first', '2026-09-25'), fact('second', '2026-09-25', { planned_start_time: '19:00:00', planned_end_time: '20:00:00' }), fact('old', '2026-09-21')])
  assert.equal(items.length, 2); assert.notEqual(items[0].dedupeKey, items[1].dedupeKey)
})
check('foreign center facts and provider failures do not fabricate attendance', () => {
  assert.equal(buildAttendance([fact('foreign', '2026-09-23', { center_id: 'other' })]).length, 0)
  assert.equal(buildIncompleteAttendanceCandidates({ ...attendanceSource([fact('zero', '2026-09-23')]), status: 'failed' }, { centerId, now }).length, 0)
})

const cycle = { id: 'cycle-1', centerId, cycleNumber: 1, totalSessions: 16, usedSessions: 14, remainingSessions: 2,
  lifecycleStatus: 'ACTIVE', renewalReminder: true, paymentStatus: 'PAID' }
const tuition = { centerId, status: 'ready', students: [{ id: 'a', fullName: 'Gia Hân' }],
  cycleStates: [{ studentId: 'a', centerId, readiness: 'READY', currentCycle: cycle }] }
const operations = { centerId, status: 'ready', reminders: [], tbhpCheckpoints: [] }
const n2 = buildTuitionN2Candidates(tuition, operations, { centerId, now })
check('one exact current-cycle N-2 item from frozen presentation', () => {
  assert.equal(n2.length, 1); assert.equal(n2[0].title, 'Gia Hân · Kỳ 1 · 14/16')
  assert.equal(n2[0].message, 'Còn 2 buổi — nên gửi TBHP')
})
check('N-2 does not gate payment, and does not alert after manual end', () => {
  const unpaid = structuredClone(tuition); unpaid.cycleStates[0].currentCycle.paymentStatus = 'UNPAID'
  assert.equal(buildTuitionN2Candidates(unpaid, operations, { centerId, now }).length, 1)
  unpaid.cycleStates[0].currentCycle.manuallyEndedAt = now.toISOString()
  assert.equal(buildTuitionN2Candidates(unpaid, operations, { centerId, now }).length, 0)
})
check('valid canonical sent checkpoint resolves; printing is not a sent fact', () => {
  const printedOnly = { ...operations, printedAt: now.toISOString() }
  assert.equal(buildTuitionN2Candidates(tuition, printedOnly, { centerId, now }).length, 1)
  const sent = { ...operations, tbhpCheckpoints: [{ centerId, studentId: 'a', cycleId: cycle.id, sentAt: now.toISOString() }] }
  assert.equal(buildTuitionN2Candidates(tuition, sent, { centerId, now }).length, 0)
})
check('V24/V28 duplicate is coalesced into one stable business key', () => {
  const old = [
    { id: 'v24', dedupeKey: 'v2-4:cycle-1:tuition-due', type: 'tuition', meta: { studentId: 'a', cycleId: 'cycle-1', signal: 'tuition-due' } },
    { id: 'v28', dedupeKey: 'v2-8a:cycle-1:TBHP_SEND_DUE', type: 'system', meta: { studentId: 'a', cycleId: 'cycle-1', signal: 'TBHP_SEND_DUE' } },
  ].map(item => normalizeCachedOperationalNotification(item, centerId))
  const result = upsertNotificationCandidates(old, n2, { readyProviders: ['tuition-n2'] })
  assert.equal(result.length, 1); assert.equal(result[0].dedupeKey, n2[0].dedupeKey)
  assert.equal(upsertNotificationCandidates(old, [], { readyProviders: [] }).length, 1)
})
const paymentOperations = { ...operations, reminders: [{ centerId, studentId: 'a', cycleId: 'cycle-2', cycleNumber: 2,
  signal: 'PAYMENT_CHECK_DUE', triggerDate: '2026-09-27', remainingSessions: 16 }] }
const payment = buildPaymentAttentionCandidates(paymentOperations, tuition, { centerId, now })
check('only canonical PAYMENT_CHECK_DUE; no ordinary unpaid-cycle alert', () => {
  assert.equal(payment.length, 1); assert.equal(payment[0].meta.cycleId, 'cycle-2')
  const ordinary = structuredClone(tuition); ordinary.cycleStates[0].currentCycle.paymentStatus = 'UNPAID'
  assert.equal(buildPaymentAttentionCandidates(operations, ordinary, { centerId, now }).length, 0)
})
check('long canonical keys keep separate item IDs and exact routing', () => {
  const longId = 'student-'.repeat(25)
  const source = { ...tuition, students: [{ id: longId, fullName: 'Gia Hân' }],
    cycleStates: [{ ...tuition.cycleStates[0], studentId: longId }] }
  const first = buildTuitionN2Candidates(source, operations, { centerId, now })
  const second = buildTuitionN2Candidates({ ...source, cycleStates: [{ ...source.cycleStates[0],
    currentCycle: { ...cycle, id: 'cycle-2' } }] }, operations, { centerId, now })
  const items = upsertNotificationCandidates([], [...first, ...second], { readyProviders: ['tuition-n2'] })
  assert.equal(new Set(items.map(item => item.id)).size, 2)
  assert.equal(getNotificationRoute(items[1], centerId).cycleId, 'cycle-2')
})
check('all three exact routes; no route across centers', () => {
  const attendance = buildAttendance([fact('zero', '2026-09-22')])[0]
  assert.deepEqual(getNotificationRoute(attendance, centerId), { moduleId: 'thoi-khoa-bieu', sessionId: 'zero', occurrenceDate: '2026-09-22' })
  assert.deepEqual(getNotificationRoute(n2[0], centerId), { moduleId: 'hoc-phi', studentId: 'a', cycleId: 'cycle-1' })
  assert.deepEqual(getNotificationRoute(payment[0], centerId), { moduleId: 'hoc-phi', studentId: 'a', cycleId: 'cycle-2' })
  assert.equal(getNotificationRoute(n2[0], 'other'), null)
})
let current = upsertNotificationCandidates([], n2, { readyProviders: ['tuition-n2'] })
current = markNotificationReadById(current, current[0].id, now.toISOString())
check('viewed unresolved remains in attention; ready resolution removes it', () => {
  assert.equal(filterNotifications(current, { readState: 'attention' }).length, 1)
  assert.equal(filterNotifications(current, { readState: 'unread' }).length, 0)
  assert.equal(upsertNotificationCandidates(current, [], { readyProviders: ['tuition-n2'] }).length, 0)
})
check('LOADING / UNAVAILABLE / FAILED keep item and viewed history', () => {
  for (const status of ['loading', 'unavailable', 'failed']) {
    const result = upsertNotificationCandidates(current, [], { readyProviders: [] })
    assert.equal(result.length, 1, status); assert.equal(result[0].readAt, now.toISOString())
    assert.equal(result[0].meta.stale, true)
  }
})
check('one ready provider resolves without erasing a failed provider', () => {
  const both = upsertNotificationCandidates(current, [...n2, ...payment], { readyProviders: ['tuition-n2', 'payment-attention'] })
  const result = upsertNotificationCandidates(both, [], { readyProviders: ['payment-attention'] })
  assert.equal(result.length, 1); assert.equal(result[0].meta.signal, 'tuition-n2')
})

const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(String(key)) ?? null, setItem: (key, value) => memory.set(String(key), String(value)), removeItem: key => memory.delete(String(key)) }
setCurrentInstallationStorageNamespace('c2-fixture')
setCurrentStorageCenterId(centerId)
setCurrentNotificationAccountId('account-a')
check('canonical types survive save/reload; known corrupted old types repair', () => {
  saveStoredNotifications([...n2, ...payment, { id: 'inventory', dedupeKey: 'inventory-cycle-count-due:c2-fixture:count', type: 'inventory-cycle-count' }])
  assert.deepEqual(getStoredNotifications([]).map(item => item.type), ['tuition', 'attendance-operation', 'inventory-cycle-count'])
  const key = [...memory.keys()].find(key => key.endsWith(`.notifications.${centerId}`))
  const rows = JSON.parse(memory.get(key)); rows[1].type = 'system'; rows[1].dedupeKey = 'v2-8a:cycle-2:PAYMENT_CHECK_DUE'; rows[1].meta.signal = 'PAYMENT_CHECK_DUE'
  rows[2].type = 'system'; rows[2].meta = { cycleCountId: 'count' }
  memory.set(key, JSON.stringify(rows))
  assert.deepEqual(getStoredNotifications([]).map(item => item.type), ['tuition', 'attendance-operation', 'inventory-cycle-count'])
})
check('account A viewed flags never mark account B; center-wide condition remains', () => {
  saveStoredNotifications(current); saveNotificationViewedState(current)
  assert.equal(getStoredNotifications([])[0].readAt, now.toISOString())
  setCurrentNotificationAccountId('account-b'); assert.equal(getStoredNotifications([])[0].readAt, '')
  assert.equal(filterNotifications(getStoredNotifications([]), { readState: 'attention' }).length, 1)
  setCurrentNotificationAccountId('account-a'); assert.equal(getStoredNotifications([])[0].readAt, now.toISOString())
})
check('center switch and reload preserve isolated viewing state', () => {
  setCurrentStorageCenterId('other'); assert.equal(getStoredNotifications([]).length, 0)
  setCurrentStorageCenterId(centerId); assert.equal(getStoredNotifications([])[0].readAt, now.toISOString())
})
check('unknown cached records preserved; not canonical attention', () => {
  const unknown = { id: 'unknown', dedupeKey: 'unverified-old-item', type: 'system', title: 'Historical cache', meta: { operational: true, providerId: 'tuition-n2' } }
  const result = upsertNotificationCandidates([unknown], [], { readyProviders: ['tuition-n2'] })
  assert.equal(result.length, 1); assert.equal(filterNotifications(result, { readState: 'attention' }).length, 0)
  assert(renderNotificationAssistantPanel({ notifications: result, readState: 'all' }).includes('Thông báo lưu trước đây'))
})
check('all unresolved items beyond five render with explicit actions and viewed state', () => {
  const manyStudents = Array.from({ length: 9 }, (_, i) => ({ id: `student-${i}`, fullName: `Học viên ${i}` }))
  const source = { ...tuition, students: manyStudents, cycleStates: manyStudents.map(student => ({
    ...tuition.cycleStates[0], studentId: student.id,
  })) }
  const many = upsertNotificationCandidates([], buildTuitionN2Candidates(source, operations, { centerId, now }))
    .map(item => ({ ...item, readAt: now.toISOString() }))
  const html = renderNotificationAssistantPanel({ notifications: many, unreadCount: 0 })
  assert.equal((html.match(/data-notification-item=/g) || []).length, 9)
  assert.equal((html.match(/data-notification-action="open-source"/g) || []).length, 9)
  assert(html.includes('Đã xem')); assert(html.includes('Cần xử lý'))
  assert(!html.includes('data-notification-action="resolve"'))
})
check('empty/loading/filter UI and escaped notification content', () => {
  assert(renderNotificationAssistantPanel({ loading: true }).includes('Đang tải…'))
  assert(renderNotificationAssistantPanel().includes('Không có việc cần xử lý.'))
  assert(renderNotificationAssistantPanel({ notifications: [{ ...n2[0], title: '<img onerror="alert(1)">' }] }).includes('&lt;img'))
})
check('runtime uses read contracts; exact route cannot materialize an occurrence', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const routing = main.slice(main.indexOf('async function openNotificationSourceModule'), main.indexOf('function getNotificationSourceLabel', main.indexOf('async function openNotificationSourceModule')))
  assert(routing.includes("open('detail', route.studentId, route.cycleId)"))
  assert(!routing.includes('a2_manage_occurrence')); assert(!routing.includes('openCanonicalScheduleOccurrence'))
  const providers = fs.readFileSync(new URL('../src/notification-operational-assistant.js', import.meta.url), 'utf8')
  for (const forbidden of ['.rpc(', 'localStorage', 'countsTowardTuition', 'mutate', 'finance_transaction']) assert(!providers.includes(forbidden))
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert(styles.includes(":root[data-ui-theme='light'] .notification-center"))
})
console.log(`C2 Notification Operational Assistant smoke: PASS (${checks} checks)`)
