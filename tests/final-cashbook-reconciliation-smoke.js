import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  createCashbookReconciliationFormState,
  getCashbookBalanceStats,
  getCashbookPhysicalCashStats,
  renderCashbookModule,
  validateCashbookReconciliationForm,
} from '../src/cashbook-module.js'

const settings = {
  openingBalance: 500000,
  openingDate: '2026-09-24',
  updatedAt: '2026-09-24T07:00:00+07:00',
  updatedBy: 'Admin',
  isConfigured: true,
}
const transactions = [
  tx('cash-in', 'income', 200000, 'Tiền mặt'),
  tx('transfer-in', 'income', 300000, 'Chuyển khoản'),
  tx('cash-out', 'expense', 50000, 'Tiền mặt'),
  tx('voided-cash-in', 'income', 900000, 'Tiền mặt', 'voided'),
]
const system = getCashbookBalanceStats(transactions, '2026-09-24', settings)
const physical = getCashbookPhysicalCashStats(transactions, '2026-09-24', settings)
assert.equal(system.closingBalance, 950000, 'system ledger must include cash and non-cash posted transactions')
assert.equal(physical.closingBalance, 650000, 'physical drawer must include posted cash only')
assert.equal(system.transactionCount, 3, 'voided transactions must not contribute to system reconciliation')
assert.equal(physical.transactionCount, 2, 'voided/non-cash rows must not contribute to drawer expectation')

const blankForm = createCashbookReconciliationFormState(null, '2026-09-24', physical.closingBalance)
const html = renderCashbookModule(
  transactions,
  '2026-09-24',
  settings,
  null,
  [],
  blankForm,
  {},
  'Cơ sở QA',
)
assert(html.includes('Đối soát hệ thống'))
assert(html.includes('Khớp theo sổ hệ thống'))
assert(html.includes('Kiểm quỹ thực tế'))
assert(html.includes('Chưa kiểm quỹ thực tế'))
assert(html.includes('Chỉ tính giao dịch Tiền mặt'))
assert(!html.includes('Lệch -650.000 VNĐ'), 'blank physical cash must not manufacture a discrepancy')
assert(!html.includes('is-negative">-650.000'), 'blank physical cash must remain neutral')
assert.equal(
  validateCashbookReconciliationForm(blankForm.values).actualCash,
  'Tiền thực tế trong quỹ là bắt buộc.',
  'physical cash is required only after the operator explicitly opens the optional verification form',
)

const migration = fs.readFileSync(
  'supabase/migrations/202609240006_final_cashbook_physical_cash_scope.sql',
  'utf8',
)
for (const token of [
  'f5b_final_scope_physical_cash_reconciliation',
  "transaction.status = 'POSTED'",
  "pg_catalog.lower(pg_catalog.btrim(transaction.method)) = 'tiền mặt'",
  'new.difference_minor := new.actual_cash_minor - v_expected_cash_minor',
]) assert(migration.includes(token), `Missing physical cash canonical guard: ${token}`)
assert(!/localStorage|sessionStorage|indexedDB/i.test(migration))

console.log('Final cashbook system/physical reconciliation smoke: PASS')

function tx(id, type, amount, method, status = 'posted') {
  return {
    id,
    type,
    amount,
    method,
    status,
    transactionDate: '2026-09-24',
    createdAt: '2026-09-24T09:00:00+07:00',
  }
}
