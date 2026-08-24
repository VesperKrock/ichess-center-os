import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  evaluateModuleRefreshResults,
  getModuleRefreshContract,
} from '../src/module-authority-registry.js'
import {
  initialTeacherFilters,
  renderTeacherModule,
} from '../src/teacher-module.js'
import { renderScheduleModule } from '../src/schedule-module.js'
import {
  initialAttendanceBoardFilters,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import {
  initialTuitionFilters,
  renderTuitionModule,
} from '../src/tuition-module.js'
import { buildOnlineAccessState } from '../src/online-access-control.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256')
  .update(readFileSync(join(root, path)))
  .digest('hex')
  .toUpperCase()
const main = read('src/main.js')

function sourceSlice(startToken, endToken) {
  const start = main.indexOf(startToken)
  const end = main.indexOf(endToken, start + startToken.length)
  assert(start >= 0 && end > start, `Missing source slice: ${startToken}`)
  return main.slice(start, end)
}

assert.deepEqual(getModuleRefreshContract('giao-vien'), {
  required: ['core'],
  optional: ['attendance', 'staff'],
  actionRequired: {},
  all: ['core', 'attendance', 'staff'],
})
assert.deepEqual(getModuleRefreshContract('thoi-khoa-bieu'), {
  required: ['core'],
  optional: ['attendance', 'calendar-notes'],
  actionRequired: {},
  all: ['core', 'attendance', 'calendar-notes'],
})
assert.deepEqual(getModuleRefreshContract('bang-diem-danh'), {
  required: ['core', 'attendance'],
  optional: ['tuition', 'calendar-notes'],
  actionRequired: {},
  all: ['core', 'attendance', 'tuition', 'calendar-notes'],
})
assert.deepEqual(getModuleRefreshContract('hoc-phi'), {
  required: ['core', 'tuition'],
  optional: ['attendance', 'calendar-notes'],
  actionRequired: {
    payment: ['finance'],
    'collected-balance': ['finance'],
  },
  all: ['core', 'tuition', 'attendance', 'calendar-notes', 'finance'],
})

const teacherLimited = evaluateModuleRefreshResults('giao-vien', [
  { upstream: 'core', ok: true },
  { upstream: 'attendance', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
  { upstream: 'staff', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
])
assert.equal(teacherLimited.ok, true)
assert.equal(teacherLimited.status, 'limited')
assert.deepEqual(teacherLimited.requiredFailures, [])
assert.deepEqual(teacherLimited.nonBlockingFailures, ['attendance', 'staff'])

const boardRequiredFailure = evaluateModuleRefreshResults('bang-diem-danh', [
  { upstream: 'core', ok: true },
  { upstream: 'attendance', ok: false, outcome_code: 'NETWORK_FAILURE' },
  { upstream: 'tuition', ok: true },
  { upstream: 'calendar-notes', ok: true },
])
assert.equal(boardRequiredFailure.ok, false)
assert.equal(boardRequiredFailure.status, 'failed')
assert.deepEqual(boardRequiredFailure.requiredFailures, ['attendance'])

const tuitionLimited = evaluateModuleRefreshResults('hoc-phi', [
  { upstream: 'core', ok: true },
  { upstream: 'tuition', ok: true },
  { upstream: 'attendance', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
  { upstream: 'calendar-notes', ok: false, outcome_code: 'SCHEMA_NOT_READY' },
  { upstream: 'finance', ok: false, outcome_code: 'NETWORK_FAILURE' },
])
assert.equal(tuitionLimited.ok, true)
assert.equal(tuitionLimited.status, 'limited')
assert.equal(tuitionLimited.health.finance.ok, false)

const teacherHtml = renderTeacherModule(
  [],
  initialTeacherFilters,
  null,
  null,
  [],
  [],
  [],
  [{ id: 'stale-report' }],
  {
    staffMembers: [{ id: 'stale-staff' }],
    attendanceAvailable: false,
    staffAvailable: false,
  },
)
assert(teacherHtml.includes('Báo cáo buổi học hiện chưa tải được.'))
assert(teacherHtml.includes('Thông tin nhân sự hiện chưa tải được.'))
assert(!teacherHtml.includes('stale-report'))
assert(!teacherHtml.includes('stale-staff'))

const scheduleHtml = renderScheduleModule(
  [],
  null,
  { sessionId: 'stale-report-panel' },
  [{ id: 'stale-session-report' }],
  null,
  null,
  null,
  null,
  false,
  null,
  [],
  [],
  '2026-08-17',
  null,
  {
    attendanceAvailable: false,
    calendarNotesAvailable: false,
    attendanceRecords: [{ id: 'stale-attendance' }],
    centerCalendarItems: [{ id: 'stale-calendar' }],
    centerCalendarTags: [{ id: 'stale-tag', label: 'Stale' }],
    calendarNotesSharedTruthState: {
      message: 'Lịch hoạt động bổ sung hiện chưa khả dụng.',
      messageTone: 'warning',
      availabilityStatus: 'unavailable',
    },
  },
)
assert(scheduleHtml.includes('Lịch học vẫn có thể xem và cập nhật.'))
assert(scheduleHtml.includes('Chưa thể mở điểm danh hoặc báo cáo buổi học.'))
assert(!scheduleHtml.includes('data-center-calendar-action="open-create"'))
assert(!scheduleHtml.includes('stale-calendar'))
assert(!scheduleHtml.includes('stale-session-report'))

const boardHtml = renderAttendanceBoardModule(
  [],
  [],
  [{ id: 'stale-tuition' }],
  [{ id: 'stale-session-report' }],
  [{ id: 'stale-advisory' }],
  initialAttendanceBoardFilters,
  null,
  [{ id: 'stale-board-note' }],
  null,
  false,
  [],
  0,
  { status: 'notStarted' },
  false,
  {
    message: 'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.',
    messageTone: 'warning',
    availabilityStatus: 'unavailable',
  },
  { attendanceAvailable: false, tuitionAvailable: false, calendarNotesAvailable: false },
)
assert(boardHtml.includes('Dữ liệu điểm danh chưa tải được.'))
assert(boardHtml.includes('Đối chiếu gói học phí hiện chưa tải được.'))
assert(!boardHtml.includes('data-attendance-baseline-action'))
assert(!boardHtml.includes('stale-tuition'))
assert(!boardHtml.includes('stale-board-note'))

const student = { id: 'student-a', fullName: 'QA Student', parentName: 'QA Parent' }
const tuition = {
  id: 'tuition-a',
  studentId: student.id,
  packageName: 'Gói QA',
  totalSessions: 8,
  usedSessions: 1,
  totalAmount: 800000,
  paidAmount: 800000,
  payments: [],
  termHistory: [],
}
const tuitionHtml = renderTuitionModule(
  [student],
  [tuition],
  initialTuitionFilters,
  null,
  null,
  null,
  [],
  [{ studentId: student.id, monthKey: '2026-08', careStatus: 'called', note: 'STALE NOTE' }],
  '2026-08',
  null,
  [],
  null,
  { isOpen: true },
  [{ id: 'stale-payment', amount: 800000 }],
  'center-a',
  null,
  {
    message: 'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.',
    messageTone: 'warning',
    availabilityStatus: 'unavailable',
  },
  { attendanceAvailable: true, calendarNotesAvailable: false, financeAvailable: false },
)
assert(tuitionHtml.includes('Số đã thu và dữ liệu thanh toán hiện chưa tải được.'))
assert(tuitionHtml.includes('<td class="tuition-paid-cell" title="">Chưa tải</td>'))
assert(tuitionHtml.includes('<span class="tuition-muted">Chưa tải</span>'))
assert(!tuitionHtml.includes('data-tuition-payment-action="save-payment"'))
assert(!tuitionHtml.includes('data-tuition-advisory-action="save"'))
assert(!tuitionHtml.includes('STALE NOTE'))

const coordinator = sourceSlice(
  'async function refreshModuleAuthoritativeUpstreams',
  'async function refreshAuthoritativeUpstream',
)
for (const token of [
  'evaluateModuleRefreshResults',
  "outcome_code: 'MODULE_REQUIRED_REFRESH_FAILED'",
  "status: evaluation.status",
  'upstreamHealth: evaluation.health',
  'getModuleRefreshContextKey() !== contextKey',
]) assert(coordinator.includes(token), `Refresh coordinator missing: ${token}`)
assert(coordinator.includes("lastFreshAt = new Date().toISOString()"))

const attendanceWriter = sourceSlice(
  'async function writeC52AttendanceSessionReportThroughCloud',
  'async function startC51AttendanceRealtimeSubscription',
)
assert(attendanceWriter.includes("['core', 'attendance']"))
assert(attendanceWriter.includes("outcome_code: 'REQUIRED_REFRESH_UNAVAILABLE'"))
assert(attendanceWriter.indexOf('await upsertC51AttendanceSessionReportCloudEntities')
  < attendanceWriter.indexOf('saveStoredAttendanceRecords'))

const tuitionWriter = sourceSlice(
  'async function writeC52TuitionRecordPackageThroughCloud',
  'async function writeC53TuitionAuditLogEntry',
)
assert(tuitionWriter.includes("['core', 'tuition']"))
assert(tuitionWriter.includes("outcome_code: 'REQUIRED_REFRESH_UNAVAILABLE'"))
assert(tuitionWriter.indexOf('await upsertC52TuitionRecordPackageCloudEntities')
  < tuitionWriter.indexOf('saveStoredTuition'))

const loginBootstrap = sourceSlice('async function syncCloudUser', 'function createInitialCloudDbState')
const centerSwitchBootstrap = sourceSlice('async function handleInternalOpenCenter', 'function normalizeInternalCenters')
for (const bootstrap of [loginBootstrap, centerSwitchBootstrap]) {
  for (const forbidden of [
    'bootstrapC51AttendanceSessionReportCloudData',
    'startC51AttendanceRealtimeSubscription',
    'bootstrapC52TuitionRecordPackageCloudData',
    'startC52TuitionRealtimeSubscription',
    'refreshC54FinanceSharedTruth',
  ]) assert(!bootstrap.includes(forbidden), `Whole-OS bootstrap remains: ${forbidden}`)
}

for (const token of [
  'moduleRefreshStates.clear()',
  'authoritativeRefreshInFlight.clear()',
  'resetTransientStateForCenterSwitch()',
  'contextKey === getModuleRefreshContextKey()',
  "areModuleActionUpstreamsCurrent('hoc-phi', 'payment')",
  "areModuleActionUpstreamsCurrent('hoc-phi', 'collected-balance')",
]) assert(main.includes(token), `Missing access/action boundary: ${token}`)

const accessFor = (role) => buildOnlineAccessState({
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: `${role}-user` },
  centerId: 'center-a',
  membership: { center_id: 'center-a', status: 'active', role },
  role,
  cloudReady: true,
})
for (const role of ['owner', 'center_admin', 'admin']) {
  assert.equal(accessFor(role).canWrite, true)
}
assert.equal(accessFor('viewer').canWrite, false)

for (const copy of [
  'C5.2 attendance/session report cloud degraded',
  'Đã bootstrap C5.2 attendance/session report authoritative',
  'C5.2 tuition cloud degraded',
  'Đã bootstrap Học phí authoritative',
  'Calendar tùy chỉnh dùng authoritative server truth',
  'Ghi chú Bảng điểm danh dùng authoritative server truth',
  'Học phí chưa được lưu lên server',
]) assert(!main.includes(copy) && !teacherHtml.includes(copy) && !scheduleHtml.includes(copy)
  && !boardHtml.includes(copy) && !tuitionHtml.includes(copy), `Technical copy remains: ${copy}`)

assert.equal(
  sha256('supabase/migrations/202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql'),
  '3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414',
)
assert.equal(
  sha256('supabase/migrations/202608140002_c5_2_baseline_singleton_review_hardening.sql'),
  '76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7',
)

console.log('OV1_2_ATTENDANCE_TUITION_MODULE_REFRESH_CLOSURE_SMOKE: PASS')
