import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildV24PrepareNextCycleCommand,
  pullV24PackageCycleState,
} from '../src/cloud-authoritative-tuition-cycles.js'
import {
  buildV24TuitionNotificationCandidates,
  upsertNotificationCandidates,
} from '../src/notification-center.js'
import { buildV28AAttendanceNotificationCandidates } from '../src/attendance-operational-reminders.js'
import { getPackageCycleWarningStatus } from '../src/tuition-module.js'

const read = (path) => readFileSync(path, 'utf8')
const centerId = 'center-a'
const studentId = 'student-a'
const currentCycleId = '24000000-0000-4000-8000-000000000010'
const preparedCycleId = '24000000-0000-4000-8000-000000000011'
const packageId = '24000000-0000-4000-8000-000000000001'

const currentCycle = {
  id: currentCycleId,
  cycle_number: 1,
  tuition_local_id: 'tuition_record_package::tuition-a',
  package_catalog_id: packageId,
  package_name: 'Goi 16 buoi',
  program_name: 'Co vua',
  total_sessions: 16,
  price: 1600000,
  baseline_used: 0,
  baseline_cutoff_date: '2026-09-01',
  baseline_review_note: 'Verified',
  contributed_sessions: 14,
  pending_sessions: 0,
  used_sessions: 14,
  remaining_sessions: 2,
  lifecycle_status: 'ACTIVE',
  payment_period_id: 'term-a',
  payment_status: 'PAID',
  paid_amount: 1600000,
  bcht_status: 'NOT_STARTED',
  bcht_note: '',
  reminder_state: 'RENEWAL_DUE',
  bcht_reminder: true,
  renewal_reminder: true,
  urgent_renewal: false,
  version: 4,
}
const preparedCycle = {
  ...currentCycle,
  id: preparedCycleId,
  cycle_number: 2,
  contributed_sessions: 0,
  used_sessions: 0,
  remaining_sessions: 16,
  lifecycle_status: 'PREPARED',
  payment_period_id: 'term-b',
  payment_status: 'UNPAID',
  paid_amount: 0,
  bcht_status: 'NOT_STARTED',
  reminder_state: 'PENDING_ACTIVATION',
  bcht_reminder: false,
  renewal_reminder: false,
  version: 1,
}

const result = await pullV24PackageCycleState({
  centerId,
  supabase: {
    rpc: async () => ({
      data: {
        ok: true,
        outcome_code: 'AUTHORITATIVE_SNAPSHOT',
        status: 'READY',
        contract: 'v2.4-package-cycle-v1',
        center_id: centerId,
        students: [{
          student_id: studentId,
          readiness: 'READY',
          current_cycle: currentCycle,
          prepared_next_cycle: preparedCycle,
          cycles: [currentCycle, preparedCycle],
        }],
        package_catalog: [{
          id: packageId,
          package_name: 'Goi 16 buoi',
          program_name: 'Co vua',
          total_sessions: 16,
          default_amount: 1600000,
          is_active: true,
          version: 1,
        }],
        contributions: [],
      },
      error: null,
    }),
  },
})

assert.equal(result.ok, true)
assert.equal(result.students[0].currentCycle.id, currentCycleId)
assert.equal(result.students[0].currentCycle.lifecycleStatus, 'ACTIVE')
assert.equal(result.students[0].preparedNextCycle.id, preparedCycleId)
assert.equal(result.students[0].preparedNextCycle.lifecycleStatus, 'PREPARED')
assert.equal(result.students[0].preparedNextCycle.usedSessions, 0)

assert.deepEqual(
  buildV24PrepareNextCycleCommand(result.students[0].currentCycle, packageId),
  {
    operation: 'PREPARE_NEXT_CYCLE',
    student_id: studentId,
    current_cycle_id: currentCycleId,
    package_catalog_id: packageId,
    expected_version: 4,
  },
)

assert.equal(getPackageCycleWarningStatus({ bchtReminder: true, remainingSessions: 4 }).level, 'info')
assert.equal(getPackageCycleWarningStatus({ renewalReminder: true, remainingSessions: 2 }).level, 'info')
assert.equal(getPackageCycleWarningStatus({ renewalReminder: true, remainingSessions: 1 }).level, 'warning')
assert.equal(getPackageCycleWarningStatus({ urgentRenewal: true, remainingSessions: 0 }).level, 'danger')
assert.equal(getPackageCycleWarningStatus({
  lifecycleStatus: 'PROVISIONAL_UNPAID', paymentStatus: 'UNPAID', remainingSessions: 16,
}).level, 'danger')

const students = [{ id: studentId, centerId, fullName: 'Hoc vien A' }]
const atN4 = buildV24TuitionNotificationCandidates([{
  centerId,
  studentId,
  readiness: 'READY',
  currentCycle: {
    id: currentCycleId,
    cycleNumber: 1,
    remainingSessions: 4,
    lifecycleStatus: 'ACTIVE',
    bchtStatus: 'NOT_STARTED',
    bchtReminder: true,
    renewalReminder: false,
  },
  cycles: [],
}], students, { centerId, today: '2026-09-24' })
assert.equal(atN4.length, 1)
assert.equal(atN4[0].meta.signal, 'bcht-due')
assert.equal(atN4[0].severity, 'info')

const atN2 = buildV24TuitionNotificationCandidates([{
  centerId,
  studentId,
  readiness: 'READY',
  currentCycle: {
    id: currentCycleId,
    cycleNumber: 1,
    remainingSessions: 2,
    lifecycleStatus: 'ACTIVE',
    bchtStatus: 'NOT_STARTED',
    bchtReminder: true,
    renewalReminder: true,
  },
  cycles: [],
}], students, { centerId, today: '2026-09-24' })
assert.deepEqual(atN2.map((item) => item.severity).sort(), ['info', 'warning'])
assert(!atN2.some((item) => /c\u00f2n \d+ ng\u00e0y/i.test(`${item.title} ${item.message}`)))

for (const [remainingSessions, expectedSeverity] of [[1, 'warning'], [0, 'danger']]) {
  const candidates = buildV24TuitionNotificationCandidates([{
    centerId,
    studentId,
    readiness: 'READY',
    currentCycle: {
      id: currentCycleId,
      cycleNumber: 1,
      remainingSessions,
      lifecycleStatus: 'ACTIVE',
      bchtStatus: 'COMPLETED',
      renewalReminder: true,
      urgentRenewal: remainingSessions === 0,
    },
    cycles: [],
  }], students, { centerId, today: '2026-09-24' })
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].severity, expectedSeverity)
}

const completedBcht = buildV24TuitionNotificationCandidates([{
  centerId,
  studentId,
  readiness: 'READY',
  currentCycle: {
    id: currentCycleId,
    remainingSessions: 4,
    lifecycleStatus: 'ACTIVE',
    bchtStatus: 'COMPLETED',
    bchtReminder: true,
    renewalReminder: false,
  },
  cycles: [],
}], students, { centerId, today: '2026-09-24' })
assert.equal(completedBcht.length, 0)

const paidPrepared = buildV24TuitionNotificationCandidates([{
  centerId,
  studentId,
  readiness: 'READY',
  currentCycle: {
    id: currentCycleId,
    remainingSessions: 2,
    lifecycleStatus: 'ACTIVE',
    bchtStatus: 'COMPLETED',
    renewalReminder: true,
  },
  preparedNextCycle: { ...result.students[0].preparedNextCycle, paymentStatus: 'PAID' },
  cycles: [],
}], students, { centerId, today: '2026-09-24' })
assert.equal(paidPrepared.length, 0)

const once = upsertNotificationCandidates([], atN2)
const twice = upsertNotificationCandidates(once, atN2)
assert.equal(twice.length, once.length)
assert.deepEqual(twice.map((item) => item.id).sort(), once.map((item) => item.id).sort())

const provisionalDue = buildV28AAttendanceNotificationCandidates([{
  centerId,
  studentId,
  cycleId: preparedCycleId,
  cycleNumber: 2,
  signal: 'PAYMENT_CHECK_DUE',
  label: 'Kiểm tra đã hoàn tất thu chưa',
  severity: 'danger',
  remainingSessions: 16,
  triggerDate: '2026-09-24',
}], students, { centerId, today: '2026-09-24' })
assert.equal(provisionalDue.length, 1)
assert.equal(provisionalDue[0].severity, 'danger')
assert.equal(provisionalDue[0].meta.signal, 'PAYMENT_CHECK_DUE')
assert.equal(upsertNotificationCandidates(provisionalDue, provisionalDue).length, 1)

const migration = read('supabase/migrations/202609240001_f5b_b2a_prepared_next_cycle_authority.sql')
for (const token of [
  "'PREPARED'",
  "'COMPLETED'",
  'center_tuition_package_cycles_one_prepared_next_idx',
  'f5b_b2a_internal_prepared_payment_amount',
  'f5b_b2a_internal_activate_prepared_cycle',
  "elsif v_operation = 'PREPARE_NEXT_CYCLE' then",
  "'prepared_next_cycle'",
  "projection.lifecycle_status in ('ACTIVE', 'PROVISIONAL_UNPAID', 'NEEDS_PACKAGE_SELECTION')",
  'v2_4_prepare_not_due',
  'v2_4_prepared_cycle_exists',
  'v2_4_tuition_period_stale',
]) assert(migration.toLowerCase().includes(token.toLowerCase()), `Missing F5B-B2A contract: ${token}`)

const main = read('src/main.js')
const tuition = read('src/tuition-module.js')
assert(main.includes("action === 'prepare-next-cycle'"))
assert(main.includes("action === 'select-prepared-package'"))
assert(tuition.includes('data-v24-action="prepare-next-cycle"'))
assert(tuition.includes('data-v24-action="select-prepared-package"'))
assert(!migration.includes('receipt_snapshot'))

console.log('F5B-B2A prepared next cycle authority smoke: PASS')
