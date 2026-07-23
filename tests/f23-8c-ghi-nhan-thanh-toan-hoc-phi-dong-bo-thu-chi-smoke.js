import assert from 'node:assert/strict'
import fs from 'node:fs'

const storageData = new Map()

globalThis.localStorage = {
  getItem(key) {
    return storageData.has(String(key)) ? storageData.get(String(key)) : null
  },
  setItem(key, value) {
    storageData.set(String(key), String(value))
  },
  removeItem(key) {
    storageData.delete(String(key))
  },
}

const tuitionModule = await import('../src/tuition-module.js')
const reportModule = await import('../src/report-module.js')

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const tuitionSource = fs.readFileSync('src/tuition-module.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const reportSource = fs.readFileSync('src/report-module.js', 'utf8')
const storageSource = fs.readFileSync('src/storage.js', 'utf8')
const docSource = fs.readFileSync('docs/f23-8c-ghi-nhan-thanh-toan-hoc-phi-dong-bo-thu-chi.md', 'utf8')

const {
  calculateTuitionAmounts,
  createEditTuitionFormState,
  createPaymentFormState,
  getCurrentTuitionPeriodId,
  getLinkedTuitionPaymentTransactions,
  hasUnreconciledLegacyTuitionPaidAmount,
  renderTuitionModule,
  validatePaymentForm,
} = tuitionModule

const student = {
  id: 'student-1',
  fullName: 'Nguyen An',
  parentName: 'Me An',
  parentPhone: '0900000000',
}
const tuition = {
  id: 'tuition-1',
  studentId: 'student-1',
  packageName: 'Goi 8 buoi',
  totalSessions: 8,
  usedSessions: 2,
  totalAmount: 1200000,
  discountType: 'amount',
  discountValue: 100000,
  discountAmount: 100000,
  paidAmount: 500000,
  dueDate: '2026-07-30',
  note: '',
  currentTermNumber: 1,
  currentTermId: 'term-1',
  payments: [],
  termHistory: [],
}
const linkedPayment = {
  id: 'cashflow-from-tuition-payment-1',
  type: 'income',
  category: 'Học phí',
  amount: 600000,
  transactionDate: '2026-07-23',
  method: 'Tiền mặt',
  personName: 'Me An',
  recordedBy: 'Admin',
  note: 'Dong dot 1',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourcePaymentId: 'payment-1',
  sourceTuitionId: 'tuition-1',
  sourceStudentId: 'student-1',
  sourceTermId: 'term-1',
}
const otherPeriodPayment = {
  ...linkedPayment,
  id: 'cashflow-from-tuition-payment-2',
  sourcePaymentId: 'payment-2',
  sourceTermId: 'term-2',
  amount: 400000,
}

const periodId = getCurrentTuitionPeriodId(tuition)
assert.equal(periodId, 'term-1')

const linkedPayments = getLinkedTuitionPaymentTransactions(
  [linkedPayment, otherPeriodPayment],
  tuition.id,
  periodId,
)
assert.equal(linkedPayments.length, 1)

const ledgerAmounts = calculateTuitionAmounts(tuition, [linkedPayment, otherPeriodPayment])
assert.equal(ledgerAmounts.payableAmount, 1100000)
assert.equal(ledgerAmounts.paidAmount, 600000)
assert.equal(ledgerAmounts.remainingDebt, 500000)
assert.equal(
  hasUnreconciledLegacyTuitionPaidAmount(tuition, [linkedPayment]),
  false,
)
assert.equal(
  hasUnreconciledLegacyTuitionPaidAmount(tuition, []),
  true,
)

const paymentState = {
  ...createPaymentFormState(student, tuition),
  values: {
    ...createPaymentFormState(student, tuition).values,
    amount: '500.000',
    payerName: 'Me An',
    collectorName: 'Admin',
  },
}
const tuitionHtml = renderTuitionModule(
  [student],
  [tuition],
  {},
  null,
  paymentState,
  { studentId: student.id },
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [linkedPayment],
)

assert(tuitionHtml.includes('Ghi nhận thanh toán học phí'))
assert(tuitionHtml.includes('Số tiền'))
assert(tuitionHtml.includes('Ngày thanh toán'))
assert(tuitionHtml.includes('Phương thức'))
assert(tuitionHtml.includes('Người nộp'))
assert(tuitionHtml.includes('Người ghi nhận'))
assert(tuitionHtml.includes('Chứng từ'))
assert(tuitionHtml.includes('data-tuition-payment-evidence-input'))
assert(!tuitionHtml.includes('data-tuition-form-field="paidAmount"'))
assert(tuitionHtml.includes('Thanh toán đã ghi nhận từ Thu chi'))

const editHtml = renderTuitionModule(
  [student],
  [tuition],
  {},
  createEditTuitionFormState(student, tuition),
  null,
  { studentId: student.id },
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [linkedPayment],
)
assert(editHtml.includes('Tính từ các lần ghi nhận thanh toán trong Thu chi'))
assert(!editHtml.includes('data-tuition-form-field="paidAmount"'))

assert(validatePaymentForm({ amount: '0', paidAt: '2026-07-23', method: 'cash', payerName: 'Me An', collectorName: 'Admin' }).amount)
assert(validatePaymentForm({ amount: '-100', paidAt: '2026-07-23', method: 'cash', payerName: 'Me An', collectorName: 'Admin' }).amount)
assert(validatePaymentForm({ amount: '100.000', paidAt: 'bad', method: 'cash', payerName: 'Me An', collectorName: 'Admin' }).paidAt)

const reportData = reportModule.buildReportData({
  filters: { reportDate: '2026-07-23', weekStartDate: '2026-07-20' },
  cashflowTransactions: [linkedPayment],
})
assert.equal(reportData.dailyIncome, 600000)
assert.equal(reportData.weeklyIncome, 600000)

assert(mainSource.includes('id: `cashflow-from-tuition-${sourcePaymentId}`'))
assert(mainSource.includes("sourceModule: 'hoc-phi'"))
assert(mainSource.includes("sourceType: 'tuition-payment'"))
assert(mainSource.includes('sourcePaymentId'))
assert(mainSource.includes('sourceTuitionId'))
assert(mainSource.includes('sourceStudentId'))
assert(mainSource.includes('sourceTermId'))
assert(mainSource.includes('sourcePeriodId'))
assert(mainSource.includes('existingPaymentTransaction'), 'Payment save must check idempotency before insert.')
assert(mainSource.includes('uploadStagedCashflowEvidence({'), 'Payment evidence must reuse F23.8B upload helper.')
assert(mainSource.includes('cleanupCloudCashflowAttachment(uploadedAttachment'), 'Uploaded evidence must cleanup if ledger save fails.')
assert(mainSource.includes('clearTuitionPaymentFormState()'), 'Cancel/save must revoke staged evidence.')
assert(mainSource.includes('isSyncedTuitionPaymentTransaction'), 'Synced payment transactions must be protected.')
assert(mainSource.includes('không thể sửa như giao dịch thủ công'))
assert(mainSource.includes('không thể xóa cứng trong F23.8C'))
assert(!mainSource.includes('syncTuitionPaymentToCashflow('), 'Old tuition payment sync path must be removed.')
assert(!/tuitionPaymentFormState[\s\S]{0,900}paidAmount:\s*record\.paidAmount\s*\+/.test(mainSource), 'Payment save must not increment tuition paidAmount.')
assert(!/writeC52TuitionRecordPackageThroughCloud\(updatedTuitionRecord,\s*'tuition-payment-save'/.test(mainSource), 'Payment save must not write tuition package cloud data.')

assert(cashflowSource.includes("'hoc-phi': 'Đồng bộ từ Học phí'"))
assert(storageSource.includes('sourceParentId'))
assert(storageSource.includes('sourcePeriodId'))
assert(reportSource.includes("const dailyIncome = sumTransactions(dailyTransactions, 'income')"))
assert(!/paidAmount[\s\S]{0,300}dailyIncome/.test(reportSource), 'Report must not add tuition paidAmount on top of ledger.')

for (const marker of [
  'Source Of Truth',
  'Payment Form',
  'Period Identity',
  'Transaction Linkage',
  'Idempotency',
  'Attachment Reuse',
  'Legacy Paid Guard',
  'Synced Transaction Protection',
  'Report No Double Count',
  'F23.8D',
]) {
  assert(docSource.includes(marker), `Doc missing marker: ${marker}`)
}

for (const [label, source] of [['doc', docSource]]) {
  const mojibakeMarkers = [
    ['C', 'á', 'º'].join(''),
    String.fromCharCode(0x00c3),
    ['Æ', '°'].join(''),
    ['H', 'á', 'º'].join(''),
    ['á', '»'].join(''),
    '\ufffd',
  ]

  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `${label} contains mojibake marker ${marker}`)
  }
}

console.log('F23.8C ghi nhan thanh toan hoc phi dong bo thu chi smoke passed')
