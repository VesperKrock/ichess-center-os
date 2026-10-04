import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  FINANCE_READ_FAILURE_MESSAGE,
  buildCashbookReconciliationFromForm,
  createDefaultCashbookSettings,
  getFinanceAdminErrorMessage,
  getCashbookBalanceStats,
  getCashbookPhysicalCashStats,
  renderCashbookModule,
} from '../src/cashbook-module.js'
import {
  getCashflowStats,
  getCashflowSyncedTransactionDetailContext,
  getFilteredCashflowTransactions,
  initialCashflowFilters,
  renderCashflowModule,
} from '../src/cashflow-module.js'
import {
  createCashflowTransactionPrintSnapshot,
  renderCashflowTransactionPrintDocument,
} from '../src/cashflow-transaction-print-module.js'
import { getBirthdayLocalDateKey } from '../src/student-birth-information.js'

const centerId = 'phongtrong_prod'
const transactions = [
  { id: 'tx-1', centerId, type: 'income', amount: 1_600_000, transactionDate: '2026-09-27', status: 'POSTED', sourceModule: 'hoc-phi', sourceStudentId: 'student-1', personName: 'Phụ huynh' },
  { id: 'tx-2', centerId, type: 'income', amount: 1_600_000, transactionDate: '2026-09-27', status: 'POSTED', sourceModule: 'hoc-phi', sourceStudentId: 'student-2', personName: 'Phụ huynh' },
]
const settings = { ...createDefaultCashbookSettings(transactions), openingDate: '2026-09-26' }
const day26 = getCashbookBalanceStats(transactions, '2026-09-26', settings)
const day27 = getCashbookBalanceStats(transactions, '2026-09-27', settings)
assert.equal(day26.dailyIncome, 0)
assert.equal(day26.transactionCount, 0)
assert.equal(day27.dailyIncome, 3_200_000)
assert.equal(day27.dailyExpense, 0)
assert.equal(day27.transactionCount, 2)
const cashbookHtml = renderCashbookModule(transactions, '2026-09-27', settings)
assert.match(cashbookHtml, /value="2026-09-27"\s+data-cashbook-date/)
assert.match(cashbookHtml, /3\.200\.000 VNĐ/)
assert.match(cashbookHtml, /2 giao dịch/)

const reconciliationSettings = { ...settings, openingBalance: 500_000, openingDate: '2026-09-24', isConfigured: true }
const reconciliationTransactions = [
  { type: 'income', amount: 200_000, method: 'Tiền mặt', transactionDate: '2026-09-24', status: 'POSTED' },
  { type: 'income', amount: 300_000, method: 'Chuyển khoản', transactionDate: '2026-09-24', status: 'POSTED' },
  { type: 'expense', amount: 50_000, method: 'Tiền mặt', transactionDate: '2026-09-24', status: 'POSTED' },
  { type: 'income', amount: 900_000, method: 'Tiền mặt', transactionDate: '2026-09-24', status: 'VOIDED' },
]
assert.equal(getCashbookBalanceStats(reconciliationTransactions, '2026-09-24', reconciliationSettings).closingBalance, 950_000)
assert.equal(getCashbookBalanceStats(reconciliationTransactions, '2026-09-25', reconciliationSettings).openingBalanceOfDay, 950_000)
const physical = getCashbookPhysicalCashStats(reconciliationTransactions, '2026-09-24', reconciliationSettings)
assert.equal(physical.closingBalance, 650_000)
const matching = buildCashbookReconciliationFromForm({ date: '2026-09-24', systemClosingBalance: physical.closingBalance, actualCash: '650.000', checkedBy: 'QA' })
const different = buildCashbookReconciliationFromForm({ date: '2026-09-24', systemClosingBalance: physical.closingBalance, actualCash: '620.000', checkedBy: 'QA' })
assert.equal(matching.status, 'matched')
assert.equal(matching.difference, 0)
assert.equal(different.status, 'mismatched')
assert.equal(different.difference, -30_000)
assert.match(renderCashbookModule(reconciliationTransactions, '2026-09-24', reconciliationSettings), /Chưa kiểm quỹ thực tế/)

const dayFilters = { ...initialCashflowFilters, periodMode: 'day', periodDate: '2026-09-27' }
const rangeFilters = { ...initialCashflowFilters, periodMode: 'range', rangeStart: '2026-09-27', rangeEnd: '2026-09-27' }
for (const filters of [dayFilters, rangeFilters]) {
  const filtered = getFilteredCashflowTransactions(transactions, filters)
  assert.equal(filtered.length, 2)
  assert.equal(getCashflowStats(filtered).totalIncome, 3_200_000)
  const html = renderCashflowModule(transactions, filters)
  assert.match(html, /3\.200\.000 VNĐ/)
  assert.match(html, /Hiển thị 2 giao dịch/)
}
assert.equal(getFilteredCashflowTransactions(transactions, { ...dayFilters, periodDate: '2026-09-26' }).length, 0)

for (const [instant, expected] of [
  ['2026-09-27T16:30:00.000Z', '2026-09-27'],
  ['2026-09-27T17:30:00.000Z', '2026-09-28'],
  ['2026-09-28T05:00:00.000Z', '2026-09-28'],
]) assert.equal(getBirthdayLocalDateKey(new Date(instant)), expected)

const student = { id: 'student-2', fullName: 'DEMO - Học nợ', parentName: 'Phụ huynh' }
const transaction = { ...transactions[1], sourceType: 'tuition-payment' }
const detail = getCashflowSyncedTransactionDetailContext(transaction, [student], [])
assert.equal(detail.studentName, 'DEMO - Học nợ')
const printed = createCashflowTransactionPrintSnapshot({
  centerId, transaction, transactionCode: 'TC-20260927-0002', students: [student],
})
assert.deepEqual(printed.transaction.sourceContext.find(([label]) => label === 'Học viên'), ['Học viên', detail.studentName])
assert.match(renderCashflowTransactionPrintDocument(printed), /DEMO - Học nợ/)
const missing = createCashflowTransactionPrintSnapshot({ centerId, transaction: { ...transaction, sourceStudentId: '' }, students: [] })
assert.deepEqual(missing.transaction.sourceContext.find(([label]) => label === 'Học viên'), ['Học viên', '—'])
const manual = createCashflowTransactionPrintSnapshot({ centerId, transaction: { ...transaction, sourceModule: '', sourceStudentId: '' }, students: [] })
assert.deepEqual(manual.transaction.sourceContext, [])

assert.match(FINANCE_READ_FAILURE_MESSAGE, /Làm mới/)
const rawError = 'PostgREST SQL PGRST202 RPC public.finance_ledger table schema'
assert.equal(getFinanceAdminErrorMessage(rawError, FINANCE_READ_FAILURE_MESSAGE), FINANCE_READ_FAILURE_MESSAGE)
const errorHtml = renderCashbookModule([], '2026-09-27', settings, null, [], null, {
  message: rawError, messageTone: 'error',
})
assert.match(errorHtml, /Chưa tải được dữ liệu Sổ quỹ/)
assert.doesNotMatch(errorHtml, /PostgREST|SQL|RPC|schema|public\.finance_ledger/)
const galleryHtml = renderCashflowModule([], initialCashflowFilters, null, [], false, undefined, '', {}, null,
  { status: 'error', centerName: 'Phòng Trống', monthKey: '2026-09', attachments: [], query: '', error: 'Chưa tải được kho ảnh giao dịch. Vui lòng thử lại.' },
  null, { message: rawError, messageTone: 'error' })
assert.match(galleryHtml, /Chưa tải được dữ liệu Sổ quỹ/)
assert.doesNotMatch(galleryHtml, /PostgREST SQL PGRST202/)
assert.doesNotMatch(galleryHtml.replace(/<[^>]*>/g, ' '), /\bcloud\b|\blegacy\b|PostgREST|SQL|RPC/i)
assert.match(galleryHtml, /title="Ảnh giao dịch và ghi chú"/)

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(main.includes('[data-cashbook-date], [data-cashflow-filter][type="date"]'), 'Focused Finance dates render immediately')
assert(main.includes("control.type === 'date') control.addEventListener('change', updateCashflowFilter)"))
assert(main.includes("'[data-cashbook-date]')?.addEventListener('change', updateCashbookDate)"))
assert(main.includes("refreshModuleAuthoritativeUpstreams('nhom-tai-chinh', { reason: 'center-switch' })"))
assert(main.includes('cashbookSelectedDate = selectedCashbookDate') && main.includes('cashflowFilters = selectedCashflowFilters'))
assert(main.includes('runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()'))
assert(main.includes('cashflowTransactionDetailState?.centerId === centerId') && main.includes('students: printStudents'))
assert(main.includes('resolveCashflowLinkedStudentContext(transaction, centerId, printStudents)'))
assert(main.includes('resolveCashflowLinkedStudentContext(transaction, currentCenterId, students)'))
assert(main.includes('transaction.sourceStudentId && !studentContext.found'))
assert.equal((main.match(/message: FINANCE_READ_FAILURE_MESSAGE/g) || []).length, 3)
assert(main.includes("console.warn('[Finance read] Authoritative pull failed:'"))
assert(main.includes('cashbookSelectedDate = getBirthdayLocalDateKey()'))
for (const sourceFile of ['cashbook-module.js', 'cashflow-module.js']) {
  const source = fs.readFileSync(new URL(`../src/${sourceFile}`, import.meta.url), 'utf8')
  assert(source.includes('return getBirthdayLocalDateKey()'))
}
console.log('M7_1_CASHBOOK_AUDIT_FIXES_SMOKE PASS')
