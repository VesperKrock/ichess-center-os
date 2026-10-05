import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { renderNotificationAssistantPanel } from '../src/notification-assistant-panel.js'
import { filterNotifications, getUnreadNotificationCount, upsertNotificationCandidates } from '../src/notification-center.js'
import { getNotificationRoute, resolveCurrentNotificationTarget } from '../src/notification-operational-assistant.js'
import { renderCanonicalAttendanceLedgerModule } from '../src/attendance-ledger-module.js'

let checks = 0
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`) }
const centerId = 'center-a'
const candidate = {
  id: 'bcht-1', dedupeKey: 'v2-4:cycle-a:bcht-due', sourceModule: 'hoc-phi', sourceLabel: 'Học phí',
  type: 'tuition', severity: 'warning', title: 'Cần hoàn tất BCHT', message: 'Nhắc giáo viên hoàn tất.',
  createdAt: '2026-10-05T00:00:00Z', meta: { centerId, providerId: 'tuition-existing', operational: true,
    studentId: 'student-a', cycleId: 'cycle-a', signal: 'bcht-due' },
}

check('loading, failed, fresh empty and fresh populated are distinct', () => {
  const loading = renderNotificationAssistantPanel({ loading: true })
  const failed = renderNotificationAssistantPanel({ snapshotStatus: 'failed' })
  const partial = renderNotificationAssistantPanel({ snapshotStatus: 'partial' })
  const freshEmpty = renderNotificationAssistantPanel({ snapshotStatus: 'fresh' })
  const freshPopulated = renderNotificationAssistantPanel({ notifications: [candidate], unreadCount: 1 })
  for (const unconfirmed of [loading, failed, partial]) {
    assert(!unconfirmed.includes('0 cần xử lý'))
    assert(!unconfirmed.includes('Không có việc cần xử lý.'))
    assert(!unconfirmed.includes('data-notification-action="open-source"'))
  }
  assert(loading.includes('Đang cập nhật việc cần xử lý'))
  assert(failed.includes('Chưa xác nhận đủ thông báo'))
  assert(freshEmpty.includes('0 cần xử lý'))
  assert(freshEmpty.includes('Không có việc cần xử lý.'))
  assert(freshPopulated.includes('1 cần xử lý'))
})

check('stale cache stays in All and unread badge, not confirmed work or actions', () => {
  const stale = upsertNotificationCandidates([candidate], [], { readyProviders: [] })
  assert.equal(stale[0].meta.stale, true)
  assert.equal(filterNotifications(stale, { readState: 'attention' }).length, 0)
  assert.equal(filterNotifications(stale, { readState: 'all' }).length, 1)
  assert.equal(getUnreadNotificationCount(stale), 1)
  const html = renderNotificationAssistantPanel({ notifications: stale, readState: 'all', unreadCount: 1,
    snapshotStatus: 'failed' })
  assert(html.includes('Chờ cập nhật'))
  assert(!html.includes('data-notification-action="open-source"'))
  assert(html.includes('1 chưa đọc'))
  const fresh = upsertNotificationCandidates(stale, [candidate], { readyProviders: ['tuition-existing'] })
  assert.equal(fresh.length, 1)
  assert.equal(fresh[0].meta.stale, false)
  assert.equal(filterNotifications(fresh, { readState: 'attention' }).length, 1)
  assert(renderNotificationAssistantPanel({ notifications: fresh }).includes('data-notification-action="open-source"'))
  assert.equal(upsertNotificationCandidates(fresh, [candidate], { readyProviders: ['tuition-existing'] }).length, 1)
  assert.equal(upsertNotificationCandidates(fresh, [], { readyProviders: ['tuition-existing'] }).length, 0)
})

check('BCHT and review route by captured center, Student and cycle', () => {
  const student = { id: 'student-a', centerId, fullName: 'An' }
  const bchtRoute = getNotificationRoute(candidate, centerId)
  assert.deepEqual(bchtRoute, { moduleId: 'hoc-phi', studentId: 'student-a', cycleId: 'cycle-a' })
  assert(resolveCurrentNotificationTarget(bchtRoute, { centerId, students: [student], bchtCandidates: [candidate] }))
  assert.equal(resolveCurrentNotificationTarget(bchtRoute, { centerId, students: [student], bchtCandidates: [] }), null)
  const review = { ...candidate, dedupeKey: 'v2-8a:cycle-a:REVIEW_UPDATE_DUE', sourceModule: 'bang-diem-danh',
    meta: { ...candidate.meta, signal: 'REVIEW_UPDATE_DUE', providerId: 'reviews-existing' } }
  const reviewRoute = getNotificationRoute(review, centerId)
  assert.deepEqual(reviewRoute, { moduleId: 'bang-diem-danh', studentId: 'student-a', cycleId: 'cycle-a' })
  const reminder = { centerId, studentId: 'student-a', cycleId: 'cycle-a', signal: 'REVIEW_UPDATE_DUE',
    cycleNumber: 2, triggerDate: '2026-10-05' }
  assert(resolveCurrentNotificationTarget(reviewRoute, { centerId, students: [student], reviewReminders: [reminder] }))
  assert.equal(resolveCurrentNotificationTarget(reviewRoute, { centerId, students: [student], reviewReminders: [] }), null)
  assert.equal(getNotificationRoute(review, 'center-b'), null)
  assert.equal(resolveCurrentNotificationTarget(reviewRoute, { centerId: 'center-b', students: [student],
    reviewReminders: [reminder] }), null)
  const board = renderCanonicalAttendanceLedgerModule({ students: [student], notificationReview: {
    studentName: student.fullName, cycleNumber: reminder.cycleNumber, triggerDate: reminder.triggerDate,
  } })
  assert(board.includes('role="dialog" aria-modal="true" aria-label="Chi tiết nhắc nhận xét"'))
  assert(board.includes('Cần cập nhật nhận xét'))
  assert(board.includes('<dd>An</dd>'))
  assert(board.includes('Kỳ 2'))
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const routeCode = main.slice(main.indexOf('async function openNotificationSourceModule'),
    main.indexOf('function getNotificationSourceLabel', main.indexOf('async function openNotificationSourceModule')))
  assert(routeCode.includes("refreshAuthoritativeUpstream('package-cycles'"))
  assert(routeCode.includes('refreshV28AAttendanceOperations({ reason:'))
  assert(routeCode.includes("open('detail', route.studentId, route.cycleId)"))
  assert(routeCode.includes('preserveCurrentness: true'))
})

check('Vietnam Schedule date and end time are independent of runner timezone', () => {
  const source = `import { buildScheduleAttentionNotificationCandidates as schedule, buildMissingSessionReportNotificationCandidates as missing } from './src/notification-center.js';
    import { getNotificationAttentionRange } from './src/notification-operational-assistant.js';
    import { getCurrentScheduleWeekStartDate } from './src/schedule-module.js';
    const occurrence = { id: 'one', centerId: 'center-a', scheduleType: 'oneOff', occurrenceDate: '2026-10-05',
      title: 'Buổi học', startTime: '17:00', endTime: '18:30', status: 'scheduled' };
    const recurring = { ...occurrence, id: 'regular', scheduleType: 'recurring' };
    const week = instant => getCurrentScheduleWeekStartDate(new Date(getNotificationAttentionRange(new Date(instant)).toDate + 'T12:00:00'));
    console.log(JSON.stringify({ beforeDay: schedule([occurrence], { centerId: 'center-a', today: new Date('2026-10-04T16:30:00Z') }).length,
      afterDay: schedule([occurrence], { centerId: 'center-a', today: new Date('2026-10-04T17:30:00Z') }).length,
      dateObject: schedule([{ ...occurrence, occurrenceDate: new Date('2026-10-04T17:30:00Z') }],
        { centerId: 'center-a', today: new Date('2026-10-04T17:30:00Z') }).length,
      beforeWeek: week('2026-10-04T16:30:00Z'), afterWeek: week('2026-10-04T17:30:00Z'),
      beforeEnd: missing([recurring], [], { centerId: 'center-a', now: new Date('2026-10-05T11:00:00Z') }).length,
      afterEnd: missing([recurring], [], { centerId: 'center-a', now: new Date('2026-10-05T12:00:00Z') }).length }));`
  const results = ['UTC', 'Asia/Ho_Chi_Minh', 'America/Los_Angeles'].map(TZ => JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8',
    }).trim(),
  ))
  for (const result of results) assert.deepEqual(result, { beforeDay: 0, afterDay: 1, dateObject: 1,
    beforeWeek: '2026-09-28', afterWeek: '2026-10-05', beforeEnd: 0, afterEnd: 1 })
})

console.log(`M10.1 Start + Notifications smoke: PASS (${checks} checks)`)
