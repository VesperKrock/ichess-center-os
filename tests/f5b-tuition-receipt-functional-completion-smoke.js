import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildF5BRecordPaymentCommand,
  getF5BReceiptOutcomeMessage,
  mutateF5BTuitionReceipt,
} from '../src/cloud-authoritative-tuition-receipts.js'

// Superseded pre-payment Receipt behavior is intentionally gone. A Receipt is
// now created only inside the one atomic full-payment command.
const cycle = {
  id: '25000000-0000-4000-8000-000000000002',
  version: 7,
  tuitionLocalId: 'tuition_record_package::tuition-a',
  studentId: 'student-a',
  paymentPeriodId: 'term-2',
}
const financeCommand = {
  operation: 'CREATE_TRANSACTION',
  transaction_id: '25000000-0000-4000-8000-000000000003',
  expected_version: 0,
  cashflow_type: 'INCOME',
  category_id: '25000000-0000-4000-8000-000000000004',
  amount_minor: 1680000,
  transaction_date: '2026-09-27',
  method: 'cash',
  source_module: 'hoc-phi',
  source_type: 'tuition-payment',
  source_payment_id: 'tuition-payment:bounded',
  source_tuition_id: cycle.tuitionLocalId,
  source_student_id: cycle.studentId,
  source_period_id: cycle.paymentPeriodId,
}
const command = buildF5BRecordPaymentCommand(
  cycle,
  financeCommand,
  '25000000-0000-4000-8000-000000000005',
)
assert.equal(command.operation, 'RECORD_PAYMENT')
assert.equal(command.target_cycle_id, cycle.id)
assert.equal(command.finance_command.amount_minor, 1680000)

const calls = []
const result = await mutateF5BTuitionReceipt({
  centerId: 'center-a', command,
  idempotencyKey: '25000000-0000-4000-8000-000000000006',
  supabase: { rpc: async (name, params) => {
    calls.push({ name, params })
    return { error: null, data: {
      ok: true, outcome_code: 'COMMITTED', center_id: 'center-a',
      receipt_id: command.receipt_id, receipt_version: 1, receipt_status: 'ISSUED',
    } }
  } },
})
assert.equal(result.ok, true)
assert.equal(calls.length, 1)
assert.equal(calls[0].name, 'f5b_mutate_tuition_receipt')
assert.equal(calls[0].params.p_command.operation, 'RECORD_PAYMENT')
assert.match(getF5BReceiptOutcomeMessage('FULL_PAYMENT_REQUIRED'), /thanh toán đủ/)

const source = readFileSync('src/cloud-authoritative-tuition-receipts.js', 'utf8')
assert(!source.includes('buildF5BCreateReceiptCommand'))
assert(!source.includes('buildF5BConfirmPaidCommand'))
const migration = readFileSync(
  'supabase/migrations/202609270001_tuition_final_business_alignment.sql', 'utf8',
)
assert(migration.includes('v_prior <> 0'))
assert(migration.includes('v_amount <> v_required'))
assert(migration.includes("'FULL_PAYMENT_REQUIRED'"))

console.log('F5B Receipt functional completion: atomic full Payment -> Finance -> Receipt PASS')
