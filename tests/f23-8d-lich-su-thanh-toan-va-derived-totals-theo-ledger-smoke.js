import assert from 'node:assert/strict'
import fs from 'node:fs'

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  },
}

const tuitionModule = await import('../src/tuition-module.js')
const reportModule = await import('../src/report-module.js')

const {
  buildTuitionPaymentSummary,
  calculateTuitionAmounts,
  getCurrentTuitionPeriodId,
  getLinkedTuitionPaymentTransactions,
  getTuitionPeriodIdentity,
  isTuitionPaymentTransaction,
  renderTuitionModule,
  sortTuitionPaymentTransactions,
} = tuitionModule

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const tuitionSource = fs.readFileSync('src/tuition-module.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const reportSource = fs.readFileSync('src/report-module.js', 'utf8')
const docSource = fs.readFileSync('docs/f23-8d-lich-su-thanh-toan-va-derived-totals-theo-ledger.md', 'utf8')

const centerId = 'dreamhome_prod'
const otherCenterId = 'phongtrong_prod'
const student = {
  id: 'student-1',
  fullName: 'Nguyen An',
  parentName: 'Me An',
  parentPhone: '090',
  parentId: 'parent-1',
}
const tuition = {
  id: 'tuition-1',
  studentId: student.id,
  packageName: 'Goi 10 buoi',
  totalSessions: 10,
  usedSessions: 2,
  totalAmount: 1000000,
  discountType: 'none',
  discountValue: 0,
  discountAmount: 0,
  paidAmount: 0,
  currentTermNumber: 2,
  currentTermId: 'period-current',
  dueDate: '2026-07-31',
  note: '',
  payments: [],
  termHistory: [
    {
      id: 'period-history',
      termNumber: 1,
      packageName: 'Goi cu',
      totalSessions: 8,
      usedSessions: 8,
      totalAmount: 800000,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      paidAmount: 500000,
      payments: [{ amount: 500000, paidAt: '2026-06-01', collectorName: 'Legacy' }],
      startedAt: '2026-06-01',
      endedAt: '2026-07-01',
      status: 'archived',
    },
    {
      id: 'period-history-linked',
      termNumber: 0,
      packageName: 'Goi doi soat',
      totalSessions: 4,
      usedSessions: 4,
      totalAmount: 400000,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      paidAmount: 0,
      payments: [],
      startedAt: '2026-05-01',
      endedAt: '2026-05-15',
      status: 'completed',
    },
  ],
}

function tx(overrides) {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    type: 'income',
    category: 'Học phí',
    amount: 100000,
    transactionDate: '2026-07-20',
    method: 'Chuyển khoản',
    personName: 'Me An',
    recordedBy: 'Admin',
    note: 'Thu hoc phi',
    sourceModule: 'hoc-phi',
    sourceType: 'tuition-payment',
    sourcePaymentId: `payment-${Math.random().toString(36).slice(2)}`,
    sourceTuitionId: tuition.id,
    sourceStudentId: student.id,
    sourceParentId: student.parentId,
    sourceTermId: tuition.currentTermId,
    sourcePeriodId: tuition.currentTermId,
    centerId,
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
    ...overrides,
  }
}

const currentOlder = tx({
  id: 'tx-current-older',
  amount: 250000,
  transactionDate: '2026-07-20',
  createdAt: '2026-07-20T08:00:00.000Z',
})
const currentNewest = tx({
  id: 'tx-current-newest',
  amount: 350000,
  transactionDate: '2026-07-22',
  createdAt: '2026-07-22T08:00:00.000Z',
  attachment: { name: 'bill.jpg', type: 'image/jpeg', size: 1000, dataUrl: 'data:image/jpeg;base64,a' },
})
const sameDateLater = tx({
  id: 'tx-current-same-date-later',
  amount: 100000,
  transactionDate: '2026-07-22',
  createdAt: '2026-07-22T09:00:00.000Z',
})
const historicalLinked = tx({
  id: 'tx-history-linked',
  amount: 400000,
  transactionDate: '2026-05-10',
  sourceTermId: 'period-history-linked',
  sourcePeriodId: 'period-history-linked',
})
const excludedTransactions = [
  tx({ id: 'tx-other-period', amount: 900000, sourceTermId: 'other-period', sourcePeriodId: 'other-period' }),
  tx({ id: 'tx-other-tuition', amount: 900000, sourceTuitionId: 'tuition-other' }),
  tx({ id: 'tx-other-center', amount: 900000, centerId: otherCenterId }),
  tx({ id: 'tx-manual', amount: 900000, sourceModule: 'manual', sourceType: '' }),
  tx({ id: 'tx-expense', amount: 900000, type: 'expense' }),
  tx({ id: 'tx-invalid-amount', amount: 0 }),
  tx({ id: 'tx-reversed', amount: 900000, status: 'reversed' }),
]
const transactions = [currentOlder, ...excludedTransactions, historicalLinked, currentNewest, sameDateLater]

assert.equal(getCurrentTuitionPeriodId(tuition), 'period-current')
assert.equal(getTuitionPeriodIdentity(tuition.termHistory[0], tuition), 'period-history')
assert(isTuitionPaymentTransaction(currentNewest, tuition.id, tuition.currentTermId, centerId))
assert(!isTuitionPaymentTransaction(excludedTransactions[0], tuition.id, tuition.currentTermId, centerId))
assert(!isTuitionPaymentTransaction(excludedTransactions[2], tuition.id, tuition.currentTermId, centerId))

const linkedCurrent = getLinkedTuitionPaymentTransactions(
  transactions,
  tuition.id,
  tuition.currentTermId,
  centerId,
)
assert.equal(linkedCurrent.length, 3)
assert.deepEqual(
  sortTuitionPaymentTransactions(linkedCurrent).map((transaction) => transaction.id),
  ['tx-current-same-date-later', 'tx-current-newest', 'tx-current-older'],
)

const currentSummary = buildTuitionPaymentSummary({
  tuitionRecord: tuition,
  cashflowTransactions: transactions,
  centerId,
})
assert.equal(currentSummary.paidAmount, 700000)
assert.equal(currentSummary.remainingDebt, 300000)
assert.equal(currentSummary.paymentCount, 3)
assert.equal(currentSummary.statusKey, 'partial')
assert.equal(calculateTuitionAmounts(tuition, transactions, centerId).paidAmount, 700000)

const fullSummary = buildTuitionPaymentSummary({
  tuitionRecord: { ...tuition, totalAmount: 700000 },
  cashflowTransactions: transactions,
  centerId,
})
assert.equal(fullSummary.statusKey, 'paid')

const overpaidSummary = buildTuitionPaymentSummary({
  tuitionRecord: { ...tuition, totalAmount: 600000 },
  cashflowTransactions: transactions,
  centerId,
})
assert.equal(overpaidSummary.statusKey, 'overpaid')
assert.equal(overpaidSummary.remainingDebt, 0)

const legacySummary = buildTuitionPaymentSummary({
  tuitionRecord: tuition,
  periodRecord: tuition.termHistory[0],
  cashflowTransactions: transactions,
  centerId,
})
assert.equal(legacySummary.statusKey, 'unreconciled')
assert.equal(legacySummary.legacyPaidAmount, 500000)
assert.equal(legacySummary.paidAmount, 0)

const linkedHistorySummary = buildTuitionPaymentSummary({
  tuitionRecord: tuition,
  periodRecord: tuition.termHistory[1],
  cashflowTransactions: transactions,
  centerId,
})
assert.equal(linkedHistorySummary.paidAmount, 400000)
assert.equal(linkedHistorySummary.remainingDebt, 0)
assert.equal(linkedHistorySummary.paymentCount, 1)

const html = renderTuitionModule(
  [student],
  [tuition],
  {},
  null,
  null,
  { studentId: student.id },
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  transactions,
  centerId,
)
for (const text of [
  'Lịch sử thanh toán',
  'Số lần thanh toán',
  'Thanh toán một phần',
  'Đồng bộ từ Học phí',
  'Có chứng từ',
  'Không có chứng từ',
  'Mở giao dịch Thu chi',
  'Số đã thanh toán cũ chưa được đối soát',
  'Dữ liệu này chưa có lịch sử giao dịch tương ứng trong Thu chi.',
]) {
  assert(html.includes(text), `Tuition detail missing: ${text}`)
}
assert(html.includes('700.000 VNĐ'))
assert(html.includes('300.000 VNĐ'))
assert(!html.includes('900.000 VNĐ'))
assert(!html.includes('Legacy ·'))
assert(html.includes('data-tuition-payment-open-transaction="tx-current-newest"'))
assert(html.includes('Giao dịch Thu chi'))

const emptyHtml = renderTuitionModule(
  [student],
  [{ ...tuition, id: 'tuition-empty', currentTermId: 'period-empty', paidAmount: 0, termHistory: [] }],
  {},
  null,
  null,
  { studentId: student.id },
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  transactions,
  centerId,
)
assert(emptyHtml.includes('Chưa có lần thanh toán nào'))

const reportData = reportModule.buildReportData({
  filters: { reportDate: '2026-07-22', weekStartDate: '2026-07-20' },
  cashflowTransactions: [currentNewest],
})
assert.equal(reportData.dailyIncome, 350000)
assert(!/paidAmount[\s\S]{0,300}dailyIncome/.test(reportSource), 'Report must not add tuition paidAmount to ledger totals.')

for (const marker of [
  'function openTuitionPaymentSourceTransaction',
  "openModuleWindowFromChildInteraction('thu-chi')",
  'data-tuition-payment-open-transaction',
  'isSyncedTuitionPaymentTransaction',
  'không thể sửa như giao dịch thủ công',
  'không thể xóa cứng trong F23.8C',
]) {
  assert(mainSource.includes(marker), `Main missing marker: ${marker}`)
}
assert(cashflowSource.includes('transaction.id'))
assert(tuitionSource.includes('buildTuitionPaymentSummary'))
assert(tuitionSource.includes('sourcePeriodId || transaction.sourceTermId'))
assert(tuitionSource.includes('renderLegacyUnreconciledPanel'))
assert(!tuitionSource.includes('baseline transaction'))
assert(!mainSource.includes('tuition-payment-backfill'))

for (const marker of [
  'Payment Query Contract',
  'Valid Transaction Rules',
  'Period Identity',
  'Derived Paid And Outstanding',
  'Timeline UI',
  'Payment Status',
  'Historical Period Behavior',
  'Evidence Indicator',
  'Open Transaction Flow',
  'Legacy Unreconciled State',
  'Report No Double Count',
  'F23.8E',
]) {
  assert(docSource.includes(marker), `Doc missing marker: ${marker}`)
}

for (const [label, source] of [['doc', docSource]]) {
  const mojibakeMarkers = [
    ['C', 'Ă¡', 'Âº'].join(''),
    String.fromCharCode(0x00c3),
    ['Ă†', 'Â°'].join(''),
    ['H', 'Ă¡', 'Âº'].join(''),
    ['Ă¡', 'Â»'].join(''),
  ]
  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `${label} contains mojibake marker ${marker}`)
  }
}

console.log('F23.8D lich su thanh toan va derived totals theo ledger smoke passed')
