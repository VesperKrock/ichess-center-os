import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildC54VoidTuitionPaymentCommand,
  canWriteC54FinanceSharedTruth,
  mutateC54TuitionPaymentVoid,
} from '../src/cloud-authoritative-finance.js'
import { initialTuitionFilters, renderTuitionModule } from '../src/tuition-module.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256')
  .update(readFileSync(join(root, path)))
  .digest('hex')
  .toUpperCase()

const migrationPath = 'supabase/migrations/202608210002_ov1_4_tuition_payment_finance_void.sql'
const migration = read(migrationPath)
const hardeningPath = 'supabase/migrations/202608210003_ov1_4_tuition_payment_identity_compatibility_hardening.sql'
const hardening = read(hardeningPath)
const adapter = read('src/cloud-authoritative-finance.js')
const main = read('src/main.js')

for (const token of [
  'create function public.c5_4_void_tuition_payment(',
  'security definer',
  "set search_path = ''",
  'public.c5_4_internal_has_finance_access(v_center_id)',
  "'c5.4.command|' || v_center_id || '|' || v_actor_user_id::text",
  "'c5.4.cashbook|' || v_center_id",
  "'c5.4.transaction|' || v_center_id || '|' || p_transaction_id::text",
  'where t.center_id = v_center_id',
  'and t.id = p_transaction_id',
  "v_transaction.status <> 'POSTED'",
  "v_transaction.source_module <> 'hoc-phi'",
  "v_transaction.source_type <> 'tuition-payment'",
  'v_transaction.version <> p_expected_version',
  "e.entity_type = 'tuition_record_package'",
  "v_tuition_entity.payload->>'id'",
  "v_tuition_entity.payload->>'studentId'",
  "v_tuition_entity.payload->>'currentTermId'",
  "set status = 'VOIDED'",
  'version = t.version + 1',
  "'VOID_TUITION_PAYMENT'",
  "'_void_reason'",
  'insert into public.finance_command_result',
  "'IDEMPOTENCY_CONFLICT'",
  "'VERSION_STALE'",
  "'CLOSED_PERIOD'",
  'grant execute on function public.c5_4_void_tuition_payment(',
]) assert(migration.includes(token), `Migration is missing: ${token}`)

for (const forbidden of [
  'delete from public.finance_transaction',
  'drop table',
  'alter table public.finance_transaction disable row level security',
  'grant select on public.finance_transaction',
  'create or replace function public.c5_4_mutate_finance_shared_truth',
]) assert(!migration.toLowerCase().includes(forbidden), `Migration broadens scope: ${forbidden}`)

for (const token of [
  'create or replace function public.c5_4_void_tuition_payment(',
  'e.local_id = v_source_tuition_id',
  'v_tuition_match_count <> 1',
  "v_tuition_entity.payload->>'id', '')) = ''",
  "v_tuition_entity.payload->>'studentId'",
  "v_tuition_entity.payload->>'currentTermId'",
]) assert(hardening.includes(token), `Identity hardening is missing: ${token}`)
assert(!hardening.includes("v_tuition_entity.payload->>'id', '')) <> v_source_tuition_id"))

assert.equal(
  sha256('supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql'),
  '60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27',
)
assert.equal(
  sha256('supabase/migrations/202608140006_c5_4_reconciliation_currentness_hardening.sql'),
  'EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993',
)

const transaction = {
  id: '11111111-1111-4111-8111-111111111111',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourcePaymentId: 'payment-qa-1',
  sourceTuitionId: 'tuition-qa-1',
  sourceStudentId: 'student-qa-1',
  sourcePeriodId: 'term-qa-1',
  status: 'posted',
  cloudVersion: 3,
}
const command = buildC54VoidTuitionPaymentCommand(transaction, 'Ghi nhận nhầm khoản thu')
assert.deepEqual(command, {
  operation: 'VOID_TUITION_PAYMENT',
  transaction_id: transaction.id,
  source_module: 'hoc-phi',
  source_type: 'tuition-payment',
  source_payment_id: transaction.sourcePaymentId,
  source_tuition_id: transaction.sourceTuitionId,
  expected_version: 3,
  status: 'posted',
  reason: 'Ghi nhận nhầm khoản thu',
})
assert.throws(
  () => buildC54VoidTuitionPaymentCommand({ ...transaction, sourceModule: 'manual' }, 'Nhập nhầm'),
  /chỉ có thể hủy khoản thu/i,
)
assert.throws(
  () => buildC54VoidTuitionPaymentCommand({ ...transaction, cloudVersion: 0 }, 'Nhập nhầm'),
  /phiên bản/i,
)
assert.throws(
  () => buildC54VoidTuitionPaymentCommand(transaction, 'x'),
  /lý do hủy/i,
)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'admin' }).ok, true)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'teacher' }).ok, false)

const idempotencyKey = '22222222-2222-4222-8222-222222222222'
let rpcCall
const success = await mutateC54TuitionPaymentVoid({
  supabase: {
    rpc: async (name, args) => {
      rpcCall = { name, args }
      return {
        data: {
          ok: true,
          outcome_code: 'COMMITTED',
          center_id: 'center-a',
          entity_type: 'TRANSACTION',
          entity_id: transaction.id,
          entity_version: 4,
          source_payment_id: transaction.sourcePaymentId,
          source_tuition_id: transaction.sourceTuitionId,
          replayed: false,
        },
        error: null,
      }
    },
  },
  centerId: 'center-a',
  command,
  idempotencyKey,
})
assert.equal(success.ok, true)
assert.deepEqual(rpcCall, {
  name: 'c5_4_void_tuition_payment',
  args: {
    p_center_id: 'center-a',
    p_transaction_id: transaction.id,
    p_source_payment_id: transaction.sourcePaymentId,
    p_source_tuition_id: transaction.sourceTuitionId,
    p_expected_version: 3,
    p_reason: 'Ghi nhận nhầm khoản thu',
    p_idempotency_key: idempotencyKey,
  },
})

const malformed = await mutateC54TuitionPaymentVoid({
  supabase: { rpc: async () => ({ data: { ...success, center_id: 'center-b' }, error: null }) },
  centerId: 'center-a',
  command,
  idempotencyKey,
})
assert.equal(malformed.ok, false)
assert.equal(malformed.outcome_code, 'INVALID_SERVER_RESULT')

for (const token of [
  'async function writeC54TuitionPaymentVoid',
  'c54TuitionPaymentVoidRetryCommands',
  "areModuleActionUpstreamsCurrent('hoc-phi', 'payment')",
  "refreshC54FinanceSharedTruth({ reason: 'after-server-commit', silent: true })",
  "outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED'",
  'Khoản thu đã được hủy. Lịch sử giao dịch vẫn được giữ lại.',
  'sourceTuitionId: createTuitionRecordPackageLocalId(latestTuitionRecord)',
]) assert(main.includes(token), `Runtime is missing: ${token}`)
assert(adapter.includes("supabase.rpc('c5_4_void_tuition_payment'"))
assert(!adapter.includes('localStorage'))

const student = { id: 'student-qa-1', fullName: 'OV1.4 QA' }
const tuition = {
  id: 'tuition-qa-1',
  studentId: student.id,
  packageName: 'Gói QA',
  currentTermId: 'term-qa-1',
  currentTermNumber: 1,
  totalSessions: 10,
  usedSessions: 1,
  totalAmount: 500000,
  paidAmount: 0,
  discountType: 'none',
  discountValue: 0,
  payments: [],
  termHistory: [],
}
const financeTransaction = {
  ...transaction,
  type: 'income',
  category: 'Học phí',
  amount: 100000,
  transactionDate: '2026-08-21',
  method: 'Tiền mặt',
  personName: 'OV1.4 QA',
  recordedBy: 'OV1.4 QA',
  attachments: [],
}
const render = (canVoidPayments) => renderTuitionModule(
  [student], [tuition], initialTuitionFilters, null, null, { studentId: student.id },
  [], [], '2026-08', null, [], null, null, [financeTransaction], 'center-a', null,
  {}, { attendanceAvailable: true, calendarNotesAvailable: true, financeAvailable: true, canVoidPayments },
)
assert(render(true).includes(`data-tuition-payment-void="${transaction.id}"`))
assert(render(true).includes('Hủy khoản thu'))
assert(!render(false).includes('data-tuition-payment-void'))
assert(render(true).includes('100.000'))

const canonicalFinanceTransaction = {
  ...financeTransaction,
  sourceTuitionId: `tuition_record_package::${tuition.id}`,
}
const canonicalRender = renderTuitionModule(
  [student], [tuition], initialTuitionFilters, null, null, { studentId: student.id },
  [], [], '2026-08', null, [], null, null, [canonicalFinanceTransaction], 'center-a', null,
  {}, { attendanceAvailable: true, calendarNotesAvailable: true, financeAvailable: true, canVoidPayments: true },
)
assert(canonicalRender.includes(`data-tuition-payment-void="${transaction.id}"`))
assert(canonicalRender.includes('100.000'))

console.log(`OV1.4 tuition payment void smoke: PASS (${migrationPath}, SHA-256 ${sha256(migrationPath)}; ${hardeningPath}, SHA-256 ${sha256(hardeningPath)})`)
