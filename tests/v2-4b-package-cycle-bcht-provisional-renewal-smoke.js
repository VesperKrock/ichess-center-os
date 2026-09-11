import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  V24_PACKAGE_CYCLE_CAPABILITY_STATUS,
  buildV24SelectProvisionalPackageCommand,
  buildV24StartCycleCommand,
  buildV24UpdateBchtCommand,
  createV24PackageCycleCapabilityState,
  createV24RetryFingerprint,
  isV24PackageCycleBackendUnavailable,
  isV24PackageCycleCapabilityReady,
  mutateV24PackageCycle,
  pullV24PackageCycleState,
} from '../src/cloud-authoritative-tuition-cycles.js'
import {
  buildTuitionRows,
  getPackageCycleWarningStatus,
  reconcileAttendanceAdvisoryWithPackageCycles,
} from '../src/tuition-module.js'
import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const migrationPath = 'supabase/migrations/202609110001_v2_4_package_cycle_bcht_provisional_renewal.sql'
const migration = read(migrationPath)
const main = read('src/main.js')
const tuitionSource = read('src/tuition-module.js')
const boardSource = read('src/attendance-board-module.js')

assert.equal(
  sha256('supabase/migrations/202609100001_v2_3_schedule_occurrence_attendance_authority.sql'),
  '60B562B4725073D8D2BD3E1CB7360997DC86BD61C8F153BD4FA37474A53FC988',
  'The deployed V2-3 attendance authority changed',
)
assert.equal(
  sha256('supabase/migrations/202609090001_v2_2_student_individualized_recurring_enrollment.sql'),
  '2F5BC3E7764069D33375506850F9D25E59258293224869F7C7353A0B8DEB7259',
  'The deployed V2-2 enrollment authority changed',
)

assert.deepEqual(Object.values(V24_PACKAGE_CYCLE_CAPABILITY_STATUS), [
  'idle', 'loading', 'ready', 'unavailable', 'failed',
])
for (const status of Object.values(V24_PACKAGE_CYCLE_CAPABILITY_STATUS)) {
  assert.equal(isV24PackageCycleCapabilityReady(
    createV24PackageCycleCapabilityState({ centerId: 'center-a', status }),
    'center-a',
  ), status === 'ready')
}
assert.equal(isV24PackageCycleCapabilityReady(
  createV24PackageCycleCapabilityState({ centerId: 'center-a', status: 'ready' }),
  'center-b',
), false)

for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
  assert.equal(isV24PackageCycleBackendUnavailable({ code }), true)
  const absent = await pullV24PackageCycleState({
    centerId: 'center-a',
    supabase: { rpc: async () => ({ data: null, error: { code, message: 'missing' } }) },
  })
  assert.equal(absent.outcome_code, 'BACKEND_NOT_DEPLOYED')
}

const cycleId = '24000000-0000-4000-8000-000000000010'
const packageId = '24000000-0000-4000-8000-000000000001'
const projectedCycle = {
  id: cycleId, cycle_number: 1, tuition_local_id: 'tuition_record_package::tuition-a',
  package_catalog_id: packageId, package_name: 'Gói 8 buổi', total_sessions: 8,
  price: 800000, baseline_used: 5, baseline_cutoff_date: '2026-09-01',
  contributed_sessions: 1, pending_sessions: 0, used_sessions: 6,
  remaining_sessions: 2, lifecycle_status: 'ACTIVE', payment_period_id: 'term-a',
  payment_status: 'UNPAID', paid_amount: 0, bcht_status: 'NOT_STARTED', bcht_note: '',
  reminder_state: 'BCHT_DUE', bcht_reminder: true, renewal_reminder: false,
  urgent_renewal: false, version: 1,
}
const readCalls = []
const ready = await pullV24PackageCycleState({
  centerId: 'center-a',
  supabase: { rpc: async (name, params) => {
    readCalls.push({ name, params })
    return { data: {
      ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', status: 'READY',
      contract: 'v2.4-package-cycle-v1', center_id: 'center-a',
      students: [{
        student_id: 'student-a', readiness: 'READY',
        current_cycle: { ...projectedCycle, baseline_review_note: 'Đã đối chiếu lịch sử kỳ hiện tại' },
        cycles: [projectedCycle],
      }],
      package_catalog: [{ id: packageId, package_name: 'Gói 8 buổi', total_sessions: 8, default_amount: 800000, is_active: true, version: 1 }],
      contributions: [{
        student_id: 'student-a', schedule_session_id: 'session-a', occurrence_date: '2026-09-10',
        attendance_status: 'makeup', contribution_units: 1, allocation_state: 'APPLIED',
        makeup_reason: 'Học bù do nghỉ có phép', cycle_id: cycleId, cycle_number: 1,
        package_name: 'Gói 8 buổi', total_sessions: 8, session_number: 6,
        remaining_sessions: 2, cycle_lifecycle_status: 'ACTIVE', payment_status: 'UNPAID',
      }],
    }, error: null }
  } },
})
assert.equal(ready.ok, true)
assert.equal(ready.students[0].currentCycle.usedSessions, 6)
assert.equal(ready.students[0].currentCycle.bchtReminder, true)
assert.equal(ready.students[0].currentCycle.baselineReviewNote, 'Đã đối chiếu lịch sử kỳ hiện tại')
assert.equal(ready.contributions[0].sessionNumber, 6)
assert.equal(readCalls[0].name, 'v2_4_list_package_cycle_state')
assert.equal(readCalls[0].params.p_center_id, 'center-a')
assert.equal((await pullV24PackageCycleState({
  centerId: 'center-b',
  supabase: { rpc: async () => ({ data: {
    ok: true, status: 'READY', contract: 'v2.4-package-cycle-v1',
    center_id: 'center-a', students: [], package_catalog: [], contributions: [],
  }, error: null }) },
})).outcome_code, 'INVALID_SERVER_RESULT')

const start = buildV24StartCycleCommand({
  studentId: 'student-a', tuitionLocalId: 'tuition_record_package::tuition-a',
  packageCatalogId: packageId, baselineUsedSessions: 5, baselineCutoffDate: '2026-09-01',
  baselineReviewNote: 'Đã đối chiếu lịch sử kỳ hiện tại',
})
assert.deepEqual(start, {
  operation: 'START_CYCLE', student_id: 'student-a',
  tuition_local_id: 'tuition_record_package::tuition-a', package_catalog_id: packageId,
  baseline_used_sessions: 5, baseline_cutoff_date: '2026-09-01',
  baseline_review_note: 'Đã đối chiếu lịch sử kỳ hiện tại',
})
assert.deepEqual(buildV24UpdateBchtCommand(ready.students[0].currentCycle, 'COMPLETED', 'Đã xong'), {
  operation: 'UPDATE_BCHT', student_id: 'student-a', cycle_id: cycleId,
  expected_version: 1, bcht_status: 'COMPLETED', bcht_note: 'Đã xong',
})
assert.equal(buildV24SelectProvisionalPackageCommand(
  ready.students[0].currentCycle, packageId,
).operation, 'SELECT_PROVISIONAL_PACKAGE')
assert.equal(createV24RetryFingerprint({ b: 2, a: 1 }), createV24RetryFingerprint({ a: 1, b: 2 }))

const writeCalls = []
const saved = await mutateV24PackageCycle({
  centerId: 'center-a', command: start,
  idempotencyKey: '24000000-0000-4000-8000-000000000099',
  supabase: { rpc: async (name, params) => {
    writeCalls.push({ name, params })
    return { data: { ok: true, outcome_code: 'COMMITTED', center_id: 'center-a' }, error: null }
  } },
})
assert.equal(saved.ok, true)
assert.equal(writeCalls[0].name, 'v2_4_mutate_package_cycle')
assert.equal(writeCalls[0].params.p_center_id, 'center-a')

const students = [{ id: 'student-a', fullName: 'Học viên A', parentName: 'Phụ huynh A' }]
const tuition = [{
  id: 'tuition-a', studentId: 'student-a', packageName: 'Gói cũ', totalSessions: 8,
  usedSessions: 5, totalAmount: 800000, paidAmount: 0, discountAmount: 0,
  currentTermId: 'term-a', currentTermNumber: 1, note: '',
}]
const rows = buildTuitionRows(students, tuition, [], [], {
  packageCycleReady: true, packageCycleStudentStates: ready.students,
})
assert.equal(rows[0].remainingSessions, 2)
assert.equal(rows[0].status.key, 'cycle-bcht')
assert.equal(getPackageCycleWarningStatus({ renewalReminder: true, bchtReminder: false }).key, 'cycle-renewal')
assert.equal(getPackageCycleWarningStatus({ urgentRenewal: true, bchtReminder: false }).key, 'cycle-urgent')
assert.equal(getPackageCycleWarningStatus({ lifecycleStatus: 'NEEDS_PACKAGE_SELECTION' }).key, 'needs-package-selection')

const baseAdvisory = [{
  student: students[0], tuition: tuition[0], monthKey: '2026-09', totalSessions: 8,
  learnedSessions: 5, remainingSessions: 3, warning: { key: 'normal', label: 'Bình thường', tone: 'normal' },
  careStatus: 'auto', careStatusLabel: 'Theo dõi bình thường', note: '', source: 'Dữ liệu cũ',
}]
const cycleAdvisory = reconcileAttendanceAdvisoryWithPackageCycles(baseAdvisory, ready.students, true)
assert.equal(cycleAdvisory[0].learnedSessions, 6)
assert.equal(cycleAdvisory[0].warning.key, 'cycle-bcht')
assert.equal(cycleAdvisory[0].source, 'Chu kỳ học phí từ điểm danh')
assert.equal(reconcileAttendanceAdvisoryWithPackageCycles(baseAdvisory, ready.students, false), baseAdvisory)

const boardHtml = renderAttendanceBoardModule(
  [{ id: 'student-a', fullName: 'Học viên A', classSessionIds: ['class-a'] }],
  [{ id: 'class-a', status: 'active', daysOfWeek: ['thu'], startTime: '19:00', endTime: '20:30' }],
  tuition,
  [], [],
  { month: '2026-09', classSessionId: 'all', query: '' },
  { studentId: 'student-a', dateKey: '2026-09-10' }, [], null, false,
  [{
    id: 'attendance-a', studentId: 'student-a', date: '2026-09-10',
    classSessionId: 'class-a', scheduleSessionId: 'session-a', source: 'admin',
    attendanceStatus: 'makeup', status: 'makeup', counted: false, creditValue: 0,
    note: 'Học bù do nghỉ có phép', raw: {},
  }],
  0, { status: 'locked' }, false, {},
  {
    attendanceAvailable: true, tuitionAvailable: true, calendarNotesAvailable: true,
    packageCycleReady: true, packageCycleStudentStates: ready.students,
    packageCycleContributions: ready.contributions,
  },
)
assert.match(boardHtml, /attendance-cell-makeup/)
assert.match(boardHtml, /attendance-credit-chip is-makeup/)
assert.match(boardHtml, /Học bù do nghỉ có phép/)
assert.match(boardHtml, /Chu kỳ 1 · buổi 6\/8/)
assert.doesNotMatch(boardHtml, /Học thử, không tính vào gói/)

const presentBoardHtml = renderAttendanceBoardModule(
  [{ id: 'student-a', fullName: 'Học viên A', classSessionIds: ['class-a'] }],
  [{ id: 'class-a', status: 'active', daysOfWeek: ['thu'], startTime: '19:00', endTime: '20:30' }],
  tuition, [], [], { month: '2026-09', classSessionId: 'all', query: '' },
  null, [], null, false,
  [{
    id: 'attendance-present', studentId: 'student-a', date: '2026-09-10',
    classSessionId: 'class-a', scheduleSessionId: 'session-a', source: 'admin',
    attendanceStatus: 'present', status: 'present', counted: false, creditValue: 0,
    note: '', raw: {},
  }],
  0, { status: 'locked' }, false, {},
  {
    attendanceAvailable: true, tuitionAvailable: true, calendarNotesAvailable: true,
    packageCycleReady: true, packageCycleStudentStates: ready.students,
    packageCycleContributions: [{ ...ready.contributions[0], attendanceStatus: 'present', makeupReason: '' }],
  },
)
assert.match(presentBoardHtml, /attendance-credit-chip[^>]*>6<\/span>/)
assert.doesNotMatch(presentBoardHtml, /Học thử, không tính vào gói/)

const trialBoardHtml = renderAttendanceBoardModule(
  [{ id: 'student-a', fullName: 'Học viên A', classSessionIds: ['class-a'] }],
  [{ id: 'class-a', status: 'active', daysOfWeek: ['thu'], startTime: '19:00', endTime: '20:30' }],
  tuition, [], [], { month: '2026-09', classSessionId: 'all', query: '' },
  { studentId: 'student-a', dateKey: '2026-09-10' }, [], null, false,
  [{
    id: 'attendance-trial', studentId: 'student-a', date: '2026-09-10',
    classSessionId: 'class-a', scheduleSessionId: 'session-a', source: 'admin',
    attendanceStatus: 'trial', status: 'trial', counted: false, creditValue: 0,
    note: 'Buổi học thử', raw: {},
  }],
  0, { status: 'locked' }, false, {},
  {
    attendanceAvailable: true, tuitionAvailable: true, calendarNotesAvailable: true,
    packageCycleReady: true, packageCycleStudentStates: ready.students,
    packageCycleContributions: [{
      ...ready.contributions[0], attendanceStatus: 'trial', contributionUnits: 0,
      sessionNumber: 6, makeupReason: '',
    }],
  },
)
assert.match(trialBoardHtml, /attendance-credit-chip[^>]*>T<\/span>/)
assert.match(trialBoardHtml, /Học thử, không tính vào gói/)

for (const token of [
  'create table public.center_tuition_package_cycles',
  'create table public.center_tuition_attendance_contributions',
  'create table public.center_tuition_cycle_command_results',
  'create table public.center_tuition_cycle_audit_events',
  'v2_4_internal_consumption_units',
  'baseline_review_note', 'center_tuition_package_cycles_baseline_evidence_check',
  "when 'present' then 1::smallint", "when 'absent' then 0::smallint",
  "when 'excused' then 0::smallint", "when 'makeup' then 1::smallint",
  "when 'trial' then 0::smallint", 'PROVISIONAL_UNPAID',
  'NEEDS_PACKAGE_SELECTION', 'PENDING_PACKAGE_SELECTION',
  'v2_4_list_package_cycle_state', 'v2_4_mutate_package_cycle',
  'v2_4_idempotency_conflict', 'v2_4_stale_version',
  'force row level security', 'CONTRIBUTION_RECONCILED',
]) assert(migration.includes(token), `Missing V2-4 contract: ${token}`)
assert.doesNotMatch(migration, /update\s+public\.center_cloud_entities/i)
assert.doesNotMatch(migration, /insert\s+into\s+public\.finance_transaction/i)
assert.doesNotMatch(migration, /update\s+public\.finance_transaction/i)
assert.doesNotMatch(migration, /update\s+public\.center_student_recurring_enrollments/i)
assert.doesNotMatch(migration, /p3d|p4b/i)
assert.match(migration, /revoke all on table public\.center_tuition_package_cycles from public, anon, authenticated, service_role/i)
assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|truncate|all)[\s\S]{0,100}to authenticated/i)

for (const token of [
  'resetV24PackageCycleRuntimeForAccessBoundary', 'refreshV24PackageCycles',
  'isV24PackageCycleCapabilityReady', 'writeV24PackageCycleCommand',
  'attendance-reconciled', 'v24PackageCycleRetryCommands.clear()',
]) assert(main.includes(token), `Missing V2-4 runtime boundary: ${token}`)
assert.doesNotMatch(main, /localStorage[^\n]*(?:packageCycle|v24)/i)
assert.match(tuitionSource, /Hoàn tất BCHT chỉ tắt nhắc BCHT/)
assert.match(tuitionSource, /chưa có giá hay điều khoản được tự đặt/)
assert.match(boardSource, /attendance-cell-makeup/)

console.log(`V2_4B_PACKAGE_CYCLE_BCHT_PROVISIONAL_RENEWAL_SMOKE: PASS (${sha256(migrationPath)})`)
