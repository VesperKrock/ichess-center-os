import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS,
  createCashflowTransactionPrintSnapshot,
  normalizeCashflowTransactionPrintEvidence,
  renderCashflowTransactionPrintDocument,
} from '../src/cashflow-transaction-print-module.js'

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const printSource = fs.readFileSync('src/cashflow-transaction-print-module.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8e1-in-xuat-pdf-tung-giao-dich-kem-chung-tu.md',
  'utf8',
)

const transaction = {
  id: 'tx-1',
  type: 'income',
  category: 'Học phí',
  amount: 200000,
  transactionDate: '2026-07-24',
  method: 'Chuyển khoản',
  personName: 'Phụ huynh A',
  recordedBy: 'Admin Center',
  note: '<script>safe</script>',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourceStudentId: 'student-1',
  sourceTuitionId: 'tuition-1',
  sourcePeriodId: 'term-1',
  sourcePaymentId: 'payment-secret',
  createdAt: '2026-07-24T08:00:00.000Z',
  updatedAt: '2026-07-24T09:00:00.000Z',
  attachment: {
    name: 'legacy-bill.jpg',
    type: 'image/jpeg',
    size: 1000,
    dataUrl: 'data:image/jpeg;base64,legacy',
    storagePath: 'must-not-render',
  },
}

const cloudAttachment = {
  id: 'meta-secret',
  metadataId: 'meta-secret',
  fileName: 'cloud-bill.jpg',
  originalName: 'bill gốc.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  storagePath: 'center-a/transaction-images/2026/07/cloud-bill.jpg',
  signedUrl: 'https://example.test/signed-image-token',
  createdAt: '2026-07-24T08:10:00.000Z',
}

const snapshot = createCashflowTransactionPrintSnapshot({
  centerId: 'center-a',
  centerName: 'iChess Quận 1',
  transaction,
  transactionCode: 'TC-20260724-0001',
  exportedAt: '2026-07-24T10:00:00.000Z',
  cloudAttachments: [cloudAttachment],
  legacyAttachment: transaction.attachment,
  students: [{ id: 'student-1', name: 'Nguyễn An', parentName: 'Phụ huynh A' }],
  tuitionRecords: [{
    id: 'tuition-1',
    currentTermId: 'term-1',
    currentTermNumber: 3,
    termHistory: [],
  }],
})

assert.equal(CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS, 'cashflow-transaction-print-runtime-root')
assert.equal(snapshot.transaction.sourceLabel, 'Đồng bộ từ Học phí')
assert.equal(snapshot.evidence.length, 1, 'Cloud evidence must win over legacy fallback.')
assert.equal(snapshot.evidence[0].name, 'cloud-bill.jpg')
assert.equal(snapshot.transaction.amountLabel, '200.000 VNĐ')
assert(snapshot.transaction.sourceContext.some((row) => row[0] === 'Học viên' && row[1] === 'Nguyễn An'))

const html = renderCashflowTransactionPrintDocument(snapshot)

for (const marker of [
  'SAO KÊ GIAO DỊCH',
  'Thông tin giao dịch',
  'Các hình ảnh chứng từ',
  'Ngày xuất tài liệu',
  'TC-20260724-0001',
  'Thu',
  'Học phí',
  '200.000 VNĐ',
  'Chuyển khoản',
  'Phụ huynh A',
  'Admin Center',
  'Đồng bộ từ Học phí',
  'Nguyễn An',
  'Kỳ hiện tại #3',
  'cloud-bill.jpg',
  '@page { size: A4 portrait; margin: 12mm; }',
]) {
  assert(html.includes(marker), `Print HTML missing marker: ${marker}`)
}

for (const forbidden of [
  '<script>',
  'payment-secret',
  'meta-secret',
  'center-a/transaction-images',
  'must-not-render',
  'sourcePaymentId',
  'sourceTuitionId',
  'sourcePeriodId',
]) {
  assert(!html.includes(forbidden), `Print HTML must not expose raw/private value: ${forbidden}`)
}

const noEvidence = createCashflowTransactionPrintSnapshot({
  centerId: 'center-a',
  centerName: 'iChess Quận 1',
  transaction: { ...transaction, sourceModule: 'manual', sourceType: '', attachment: null },
  transactionCode: 'TC-20260724-0002',
  cloudAttachments: [],
  legacyAttachment: null,
})
assert(renderCashflowTransactionPrintDocument(noEvidence).includes('Không có chứng từ'))
assert.equal(noEvidence.transaction.sourceLabel, 'Nhập thủ công')

const legacyOnly = normalizeCashflowTransactionPrintEvidence({
  cloudAttachments: [],
  legacyAttachment: transaction.attachment,
})
assert.equal(legacyOnly.length, 1)
assert.equal(legacyOnly[0].source, 'legacy')

const failedCloud = normalizeCashflowTransactionPrintEvidence({
  cloudAttachments: [{ ...cloudAttachment, signedUrl: '' }],
  legacyAttachment: transaction.attachment,
})
assert.equal(failedCloud.length, 1)
assert.equal(failedCloud[0].error, true)
assert(
  renderCashflowTransactionPrintDocument({
    ...snapshot,
    evidence: failedCloud,
  }).includes('Không thể tải hình ảnh chứng từ'),
)

assert(cashflowSource.includes('data-cashflow-action="print-transaction"'))
assert(cashflowSource.includes('type="button"'))
assert(cashflowSource.includes('aria-label="In / PDF giao dịch'))
assert(cashflowSource.includes('Đang chuẩn bị bản in...'))
assert(cashflowSource.includes('class="cashflow-transaction-print-button"'))

assert(mainSource.includes('async function printCashflowTransaction(transactionId)'))
assert(mainSource.includes('readLatestCashflowTransactionsForCurrentCenter(centerId)'))
assert(mainSource.includes('latestCashflowTransactions.find((item) => item.id === printTransactionId)'))
assert(!/amount[\s\S]{0,120}\.find\(/.test(mainSource), 'Print lookup must not find by amount.')
assert(!/transactionDate[\s\S]{0,120}\.find\(/.test(mainSource), 'Print lookup must not find by date.')
assert(mainSource.includes('listTransactionAttachmentsByTransactionCode({'))
assert(mainSource.includes('createTransactionImageSignedUrl('))
assert(mainSource.includes('waitForCashflowPrintImages(printRoot)'))
assert(mainSource.includes('window.print()'))
assert(mainSource.includes('window.addEventListener(\'afterprint\', cleanup, { once: true })'))
assert(mainSource.includes('cleanupCashflowTransactionPrintRuntime()'))
assert(mainSource.includes('isCashflowTransactionPrintRequestCurrent(requestToken, centerId, printTransactionId)'))
assert(mainSource.includes('cashflowTransactionPrintState.transactionId'))
assert(mainSource.includes('requestToken: cashflowTransactionPrintState.requestToken + 1'))
assert(mainSource.includes('[data-cashflow-action="print-transaction"]'))
assert(mainSource.includes('event.stopPropagation()'))
assert(!mainSource.includes('html2canvas'))
assert(!mainSource.includes('jsPDF'))

assert(printSource.includes('replaceFailedImage(image)'))
assert(printSource.includes('IMAGE_LOAD_TIMEOUT_MS'))
assert(printSource.includes('Không thể tải hình ảnh chứng từ'))
assert(printSource.includes('Không có chứng từ'))
assert(printSource.includes('Nhập thủ công'))
assert(printSource.includes('Đồng bộ từ Học phí'))
assert(printSource.includes('displayText(value)'))

assert(stylesSource.includes('.cashflow-transaction-print-runtime-root'))
assert(stylesSource.includes('body:has(.cashflow-transaction-print-runtime-root) .app-shell'))
assert(stylesSource.includes('body:has(.cashflow-transaction-print-runtime-root) > :not(.cashflow-transaction-print-runtime-root)'))
assert(stylesSource.includes('.cashflow-transaction-print-button:hover'))
assert(stylesSource.includes('.cashflow-transaction-print-button:active'))
assert(stylesSource.includes('.cashflow-transaction-print-button:focus-visible'))
assert(stylesSource.includes('break-inside: avoid'))
assert(stylesSource.includes('object-fit: contain'))

for (const marker of [
  'Print Pattern',
  'Row Action',
  'Transaction Snapshot',
  'Attachment Normalize',
  'Signed URL Lifecycle',
  'Image Preload',
  'Center And Stale Guard',
  'F23.8E2',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [mainSource, cashflowSource, printSource, stylesSource, docsSource, html].join('\n')
const mojibakeMarkers = [
  `C${'Ă'}¡Âº`,
  `Ă${'ƒ'}`,
  `Ă${'†'}Â°`,
  `H${'Ă'}¡Âº`,
  `Ă${'¡'}Â»`,
  `Bu${'Ă'}¡Â»â€¢i h${'Ă'}¡Â»Âc m${'Ă'}¡Â»â€ºi`,
]
for (const marker of mojibakeMarkers) {
  assert(!combined.includes(marker), `Mojibake marker found: ${marker}`)
}

console.log('F23.8E1 transaction print/PDF smoke passed')
