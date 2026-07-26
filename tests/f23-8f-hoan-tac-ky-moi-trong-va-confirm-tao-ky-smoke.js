import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildTuitionPaymentSummary,
  createEditTuitionFormState,
  getCurrentTuitionPeriodId,
  renderTuitionModule,
} from '../src/tuition-module.js'

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const tuitionSource = fs.readFileSync('src/tuition-module.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8f-hoan-tac-ky-moi-trong-va-confirm-tao-ky.md',
  'utf8',
)

const student = {
  id: 'student-f23-8f',
  fullName: 'Nguyễn An',
  parentName: 'Phụ huynh An',
  parentPhone: '0900000000',
}

const previousTerm = {
  id: 'term-tuition-f23-8f-1',
  termNumber: 1,
  packageName: 'Gói 8 buổi',
  totalSessions: 8,
  usedSessions: 8,
  totalAmount: 2400000,
  discountType: 'none',
  discountValue: 0,
  discountAmount: 0,
  paidAmount: 0,
  dueDate: '2026-07-01',
  note: 'Kỳ trước',
  status: 'completed',
  startedAt: '2026-06-01T00:00:00.000Z',
  endedAt: '2026-07-24T00:00:00.000Z',
  payments: [],
}

const emptyCurrentPeriod = {
  id: 'tuition-f23-8f',
  studentId: student.id,
  packageName: 'Gói 8 buổi',
  totalSessions: 8,
  usedSessions: 0,
  totalAmount: 2400000,
  discountType: 'none',
  discountValue: 0,
  discountAmount: 0,
  paidAmount: 0,
  dueDate: '',
  note: '',
  payments: [],
  currentTermNumber: 2,
  currentTermId: 'term-tuition-f23-8f-2',
  startedAt: '2026-07-24T00:00:00.000Z',
  termHistory: [previousTerm],
}

const formHtml = renderTuitionModule(
  [student],
  [emptyCurrentPeriod],
  { query: '', status: 'all', package: 'all' },
  createEditTuitionFormState(student, emptyCurrentPeriod),
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [],
  'dreamhome_prod',
)

for (const marker of [
  'Chốt kỳ hiện tại & tạo kỳ mới',
  'Hoàn tác kỳ mới',
  'data-tuition-action="open-undo-empty-period"',
  'Lưu gói',
]) {
  assert(formHtml.includes(marker), `Form missing marker: ${marker}`)
}
assert(!formHtml.includes('Gia hạn / Tạo kỳ mới'), 'Ambiguous renewal wording must be removed.')

const renewConfirmHtml = renderTuitionModule(
  [student],
  [emptyCurrentPeriod],
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [],
  'dreamhome_prod',
  {
    action: 'renew-create',
    tuitionId: emptyCurrentPeriod.id,
    studentName: student.fullName,
    periodLabel: 'Kỳ 2',
    periodId: emptyCurrentPeriod.currentTermId,
    centerId: 'dreamhome_prod',
    reasons: [],
    isSaving: false,
  },
)

for (const marker of [
  'Chốt kỳ hiện tại và tạo kỳ mới?',
  'Lịch sử kỳ học',
  '0 buổi đã học',
  '0 VNĐ đã thanh toán',
  'không được mang sang kỳ mới',
  'Đây không phải action ghi nhận thanh toán',
  'Hủy',
  'Chốt kỳ & tạo kỳ mới',
]) {
  assert(renewConfirmHtml.includes(marker), `Renew confirmation missing marker: ${marker}`)
}

const undoBlockedHtml = renderTuitionModule(
  [student],
  [emptyCurrentPeriod],
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  null,
  [],
  'dreamhome_prod',
  {
    action: 'undo-empty-period',
    tuitionId: emptyCurrentPeriod.id,
    studentName: student.fullName,
    periodLabel: 'Kỳ 2',
    periodId: emptyCurrentPeriod.currentTermId,
    centerId: 'dreamhome_prod',
    reasons: [
      'Kỳ hiện tại đã có buổi học được sử dụng.',
      'Kỳ hiện tại đã có giao dịch thanh toán.',
    ],
    isSaving: false,
  },
)

for (const marker of [
  'Hoàn tác kỳ mới?',
  'kỳ trước sẽ được phục hồi thành kỳ hiện tại',
  'giao dịch, điểm danh và chứng từ không bị xóa',
  'Chưa thể thực hiện:',
  'Kỳ hiện tại đã có buổi học được sử dụng.',
  'Kỳ hiện tại đã có giao dịch thanh toán.',
  'disabled',
]) {
  assert(undoBlockedHtml.includes(marker), `Undo blocked confirmation missing marker: ${marker}`)
}

const currentPeriodPayment = {
  id: 'cashflow-from-tuition-current',
  type: 'income',
  category: 'Học phí',
  amount: 100000,
  transactionDate: '2026-07-24',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourceTuitionId: emptyCurrentPeriod.id,
  sourcePeriodId: emptyCurrentPeriod.currentTermId,
  centerId: 'dreamhome_prod',
}
const previousPeriodPayment = {
  id: 'cashflow-from-tuition-previous',
  type: 'income',
  category: 'Học phí',
  amount: 2400000,
  transactionDate: '2026-07-01',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourceTuitionId: emptyCurrentPeriod.id,
  sourcePeriodId: previousTerm.id,
  centerId: 'dreamhome_prod',
}

assert.equal(
  buildTuitionPaymentSummary({
    tuitionRecord: emptyCurrentPeriod,
    cashflowTransactions: [currentPeriodPayment, previousPeriodPayment],
    centerId: 'dreamhome_prod',
  }).paidAmount,
  100000,
)
assert.equal(
  buildTuitionPaymentSummary({
    tuitionRecord: emptyCurrentPeriod,
    periodRecord: previousTerm,
    cashflowTransactions: [currentPeriodPayment, previousPeriodPayment],
    centerId: 'dreamhome_prod',
  }).paidAmount,
  2400000,
)
assert.equal(getCurrentTuitionPeriodId(emptyCurrentPeriod), 'term-tuition-f23-8f-2')

for (const marker of [
  'function getTuitionEmptyPeriodUndoEligibility',
  'function restorePreviousTuitionPeriod',
  'function undoEmptyTuitionPeriodFromConfirmation',
  'getLinkedTuitionPaymentTransactions(cashflowLedger, tuitionRecord.id, periodId, centerId)',
  'getTuitionCurrentPeriodAttendanceMatches',
  'Kỳ hiện tại đã có dữ liệu điểm danh.',
  'Kỳ hiện tại đã có giao dịch thanh toán.',
  'Kỳ hiện tại có số tiền cũ chưa được đối soát.',
  'Không tìm thấy kỳ trước hợp lệ để phục hồi.',
  'Dữ liệu kỳ học đã thay đổi, vui lòng mở lại hồ sơ.',
  'currentTermId: previousPeriodId',
  'termHistory: remainingHistory',
]) {
  assert(mainSource.includes(marker), `Main missing marker: ${marker}`)
}

const renewSaveBlock = mainSource.slice(
  mainSource.indexOf("tuitionPeriodActionConfirmationState = createTuitionPeriodConfirmationState("),
  mainSource.indexOf('const normalizedValues = normalizeTuitionFormValues'),
)
assert(renewSaveBlock.includes("'renew-create'"))
assert(renewSaveBlock.includes('render()'))
assert(renewSaveBlock.includes('return'))

const undoBlock = mainSource.slice(
  mainSource.indexOf('async function undoEmptyTuitionPeriodFromConfirmation'),
  mainSource.indexOf('function bindNotificationOutsidePointer'),
)
for (const forbidden of [
  'cashflowTransactions = cashflowTransactions.filter',
  'saveStoredCashflow',
  'saveStoredAttendanceRecords',
  'deleteTransactionImage',
  'deleteTransactionAttachment',
]) {
  assert(!undoBlock.includes(forbidden), `Undo must not delete financial/attendance data: ${forbidden}`)
}

for (const marker of [
  'tuition-period-confirm-panel',
  'tuition-period-blocking-reasons',
]) {
  assert(stylesSource.includes(marker), `Styles missing marker: ${marker}`)
}

for (const marker of [
  'Model Audit',
  'Wording',
  'Confirmation',
  'Undo Eligibility',
  'Attendance Guard',
  'Payment Guard',
  'Restore Algorithm',
  'Stable Identity',
  'No Deletion',
  'Tests',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [mainSource, tuitionSource, stylesSource, docsSource, formHtml, renewConfirmHtml, undoBlockedHtml].join('\n')
const mojibakeMarkers = [
  `C${'Ă¡'}Âº`,
  `Ä‚${'Æ’'}`,
  `Ä‚${'â€ '}Â°`,
  `H${'Ă¡'}Âº`,
  `Ä‚${'Â¡'}Â»`,
  `Bu${'Ä‚'}Â¡Ă‚Â»Ă¢â‚¬Â¢i h${'Ä‚'}Â¡Ă‚Â»Ă‚Âc m${'Ä‚'}Â¡Ă‚Â»Ă¢â‚¬Âºi`,
]
for (const marker of mojibakeMarkers) {
  assert(!combined.includes(marker), `Mojibake marker found: ${marker}`)
}

console.log('F23.8F empty period undo and renewal confirmation smoke passed')
