import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderScheduleModule } from '../src/schedule-module.js'
import {
  initialAttendanceBoardFilters,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import {
  initialTuitionFilters,
  renderTuitionModule,
} from '../src/tuition-module.js'
import { pullC57CalendarNotesSharedTruth } from '../src/cloud-authoritative-calendar-notes.js'
import {
  applyModuleUpstreamRefreshResult,
  createLoadingModuleUpstreamHealth,
  isUnavailableCalendarNotesOutcome,
} from '../src/module-authority-registry.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const main = read('src/main.js')

const backendMissing = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-air-1c',
  supabase: {
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'RPC unavailable' } }),
  },
})
assert.equal(backendMissing.ok, false)
assert.equal(backendMissing.outcome_code, 'BACKEND_NOT_DEPLOYED')
assert.equal(isUnavailableCalendarNotesOutcome(backendMissing.outcome_code), true)

const transientFailure = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-air-1c',
  supabase: {
    rpc: async () => ({ data: null, error: { code: 'PGRST301', message: 'Temporary read failure' } }),
  },
})
assert.equal(transientFailure.ok, false)
assert.equal(transientFailure.outcome_code, 'SHARED_TRUTH_READ_FAILED')
assert.equal(isUnavailableCalendarNotesOutcome(transientFailure.outcome_code), false)

const loadingHealth = createLoadingModuleUpstreamHealth(['calendar-notes'])
assert.deepEqual(loadingHealth['calendar-notes'], {
  ok: false,
  outcomeCode: 'PENDING',
  status: 'loading',
})
const settledHealth = applyModuleUpstreamRefreshResult({
  upstreams: ['calendar-notes'],
  upstreamHealth: loadingHealth,
}, {
  upstream: 'calendar-notes',
  ok: false,
  outcome_code: backendMissing.outcome_code,
})
assert.equal(settledHealth.upstreamHealth['calendar-notes'].status, 'failed')
assert.equal(settledHealth.upstreamHealth['calendar-notes'].outcomeCode, 'BACKEND_NOT_DEPLOYED')

function renderScheduleWithCalendarState(calendarNotesSharedTruthState) {
  return renderScheduleModule(
    [], null, null, [], null, null, null, null, false, null, [], [],
    '2026-08-24', null,
    {
      attendanceAvailable: true,
      calendarNotesAvailable: false,
      calendarNotesSharedTruthState,
    },
  )
}

const scheduleLoading = renderScheduleWithCalendarState({
  message: 'Đang tải Lịch hoạt động bổ sung...',
  messageTone: '',
  availabilityStatus: 'loading',
  isLoading: true,
})
assert(scheduleLoading.includes('Đang tải Lịch hoạt động bổ sung...'))
assert(!scheduleLoading.includes('Lịch hoạt động bổ sung hiện chưa khả dụng.'))
assert(!scheduleLoading.includes('Lịch hoạt động bổ sung hiện chưa tải được.'))
assert(scheduleLoading.includes('data-schedule-action="open-create"'))
assert(!scheduleLoading.includes('data-center-calendar-action="open-create"'))
assert.equal((scheduleLoading.match(/data-schedule-optional-capability="calendar-notes"/g) || []).length, 2)
assert.equal((scheduleLoading.match(/data-capability-state="loading"/g) || []).length, 2)
assert.equal((scheduleLoading.match(/<span>Đang tải<\/span>/g) || []).length, 2)

const scheduleUnavailable = renderScheduleWithCalendarState({
  message: 'Lịch hoạt động bổ sung hiện chưa khả dụng.',
  messageTone: 'warning',
  availabilityStatus: 'unavailable',
})
assert(scheduleUnavailable.includes('c57-shared-truth-notice is-warning'))
assert(scheduleUnavailable.includes('Lịch hoạt động bổ sung hiện chưa khả dụng.'))
assert(scheduleUnavailable.includes('data-schedule-action="open-create"'))
assert(!scheduleUnavailable.includes('c57-shared-truth-notice is-error'))
assert.equal((scheduleUnavailable.match(/data-capability-state="unavailable"/g) || []).length, 2)
assert.equal((scheduleUnavailable.match(/<span>Chưa khả dụng<\/span>/g) || []).length, 2)

const scheduleFailed = renderScheduleWithCalendarState({
  message: 'Lịch hoạt động bổ sung hiện chưa tải được.',
  messageTone: 'error',
  availabilityStatus: 'failed',
})
assert(scheduleFailed.includes('c57-shared-truth-notice is-error'))
assert(scheduleFailed.includes('Lịch hoạt động bổ sung hiện chưa tải được.'))
assert.equal((scheduleFailed.match(/data-capability-state="failed"/g) || []).length, 2)
assert.equal((scheduleFailed.match(/<span>Chưa tải được<\/span>/g) || []).length, 2)

function renderBoardWithCalendarState(calendarNotesSharedTruthState) {
  return renderAttendanceBoardModule(
    [], [], [], [], [], initialAttendanceBoardFilters, null, [], null,
    false, [], 0, { status: 'locked' }, false,
    calendarNotesSharedTruthState,
    {
      attendanceAvailable: true,
      tuitionAvailable: true,
      calendarNotesAvailable: false,
    },
  )
}

const boardLoading = renderBoardWithCalendarState({
  message: 'Đang tải ghi chú chăm sóc theo tháng và ghi chú điểm danh...',
  messageTone: '',
  availabilityStatus: 'loading',
  isLoading: true,
})
assert(boardLoading.includes('Đang tải ghi chú chăm sóc theo tháng và ghi chú điểm danh...'))
assert(!boardLoading.includes('hiện chưa khả dụng'))
assert(!boardLoading.includes('hiện chưa tải được'))
assert(boardLoading.includes('data-attendance-board-filter="month"'))

const boardUnavailable = renderBoardWithCalendarState({
  message: 'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.',
  messageTone: 'warning',
  availabilityStatus: 'unavailable',
})
assert(boardUnavailable.includes('c57-shared-truth-notice is-warning'))
assert(boardUnavailable.includes('Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.'))
assert(boardUnavailable.includes('data-attendance-board-filter="month"'))
assert(!boardUnavailable.includes('c57-shared-truth-notice is-error'))

const student = { id: 'student-air-1c', fullName: 'AIR-1C QA', parentName: 'QA Parent' }
const tuition = {
  id: 'tuition-air-1c',
  studentId: student.id,
  packageName: 'Gói QA',
  totalSessions: 8,
  usedSessions: 1,
  totalAmount: 800000,
  paidAmount: 400000,
  payments: [],
  termHistory: [],
}
function renderTuitionWithCalendarState(calendarNotesSharedTruthState, calendarNotesStatus) {
  return renderTuitionModule(
    [student], [tuition], initialTuitionFilters, null, null, null,
    [], [], '2026-08', null, [], null, null, [], 'center-air-1c', null,
    calendarNotesSharedTruthState,
    {
      coreStatus: 'ready',
      tuitionStatus: 'ready',
      attendanceStatus: 'ready',
      calendarNotesStatus,
      financeStatus: 'ready',
    },
  )
}

const tuitionLoading = renderTuitionWithCalendarState({
  availabilityStatus: 'loading',
  isLoading: true,
}, 'loading')
assert(tuitionLoading.includes('Đang tải ghi chú chăm sóc theo tháng và ghi chú điểm danh...'))
assert(!tuitionLoading.includes('hiện chưa khả dụng'))
assert(!tuitionLoading.includes('hiện chưa tải được'))

const tuitionUnavailable = renderTuitionWithCalendarState({
  availabilityStatus: 'unavailable',
  messageTone: 'warning',
}, 'failed')
assert(tuitionUnavailable.includes('Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng.'))
assert(tuitionUnavailable.includes('Ghi chú học viên vẫn dùng được.'))

const tuitionFailed = renderTuitionWithCalendarState({
  availabilityStatus: 'failed',
  messageTone: 'error',
}, 'failed')
assert(tuitionFailed.includes('Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa tải được.'))
assert(tuitionFailed.includes('Ghi chú học viên vẫn dùng được.'))

for (const token of [
  'isUnavailableCalendarNotesOutcome',
  "upstream === 'calendar-notes'",
  "availabilityStatus: isLoading ? 'loading' : isUnavailable ? 'unavailable' : 'failed'",
  "messageTone: isLoading ? '' : isUnavailable ? 'warning' : 'error'",
  "? `${label} hiện chưa khả dụng.`",
  ": `${label} hiện chưa tải được.`",
  "moduleId === 'thoi-khoa-bieu'",
  "'Lịch hoạt động bổ sung'",
  "'Ghi chú chăm sóc theo tháng và ghi chú điểm danh'",
]) {
  assert(main.includes(token), `Missing AIR-1C coordinator token: ${token}`)
}

assert(!read('src/schedule-module.js').includes('opacity:'))
assert(!read('src/attendance-board-module.js').includes('opacity:'))

console.log('AIR-1C optional capability copy hygiene smoke PASS')
