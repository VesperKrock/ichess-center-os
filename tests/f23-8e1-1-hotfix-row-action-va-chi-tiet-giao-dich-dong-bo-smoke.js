import assert from 'node:assert/strict'
import fs from 'node:fs'

import { initialCashflowFilters, renderCashflowModule } from '../src/cashflow-module.js'

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8e1-1-hotfix-row-action-va-chi-tiet-giao-dich-dong-bo.md',
  'utf8',
)

const manualTransaction = {
  id: 'manual-1',
  type: 'expense',
  category: 'Vận hành',
  amount: 120000,
  transactionDate: '2026-07-22',
  method: 'Tiền mặt',
  personName: 'Nhân sự A',
  recordedBy: 'Admin Center',
  note: 'Có ảnh',
  createdAt: '2026-07-22T08:00:00.000Z',
  updatedAt: '2026-07-22T08:05:00.000Z',
}

const syncedTransaction = {
  id: 'synced-1',
  type: 'income',
  category: 'Học phí',
  amount: 2000000,
  transactionDate: '2026-07-24',
  method: 'Chuyển khoản',
  personName: 'Phụ huynh A',
  recordedBy: 'Admin Center',
  note: 'Thanh toán kỳ 3',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
  sourceStudentId: 'student-1',
  sourceTuitionId: 'tuition-1',
  sourcePeriodId: 'term-1',
  createdAt: '2026-07-24T08:00:00.000Z',
  updatedAt: '2026-07-24T08:10:00.000Z',
}

const html = renderCashflowModule(
  [syncedTransaction, manualTransaction],
  initialCashflowFilters,
  null,
  [],
  false,
  undefined,
  '',
  {
    canUpload: true,
    transactionCodes: {
      'synced-1': 'TC-20260724-0001',
      'manual-1': 'TC-20260722-0001',
    },
    attachmentCounts: {
      'TC-20260724-0001': 0,
      'TC-20260722-0001': 1,
    },
  },
)

assert.equal((html.match(/data-cashflow-action="print-transaction"/g) || []).length, 2)
assert(html.includes('<th>Thao tác</th>'), 'Direct action column must render.')
assert(html.includes('<td class="cashflow-row-action-cell">'), 'Print must live in a direct row action cell.')
assert(html.includes('In / PDF'), 'Visible In / PDF label must render without hover.')
assert(html.includes('1 ảnh'), 'Attachment count must not replace direct print action.')
assert(html.includes('Chèn ảnh'), 'No-attachment row must still show attachment action.')
assert(!html.includes('data-cashflow-action="overflow"'), 'Print must not depend on overflow menu.')

const detailHtml = renderCashflowModule(
  [syncedTransaction],
  initialCashflowFilters,
  null,
  [],
  false,
  undefined,
  '',
  {
    transactionCodes: {
      'synced-1': 'TC-20260724-0001',
    },
  },
  null,
  null,
  {
    transaction: syncedTransaction,
    transactionCode: 'TC-20260724-0001',
    centerId: 'dreamhome_prod',
    status: 'loaded',
    error: '',
    attachments: [{ id: 'attachment-1', fileName: 'receipt.jpg' }],
    students: [{ id: 'student-1', name: 'Nguyễn An', parentName: 'Phụ huynh A' }],
    tuitionRecords: [{
      id: 'tuition-1',
      currentTermId: 'term-1',
      currentTermNumber: 3,
      termHistory: [],
    }],
  },
)

for (const marker of [
  'Chi tiết giao dịch',
  'Đồng bộ từ Học phí',
  'Mã giao dịch',
  'TC-20260724-0001',
  'Học viên',
  'Nguyễn An',
  'Phụ huynh',
  'Kỳ hiện tại #3',
  'Trạng thái chứng từ',
  '1 chứng từ',
  'Xem chứng từ',
  'In / PDF',
  'Đóng',
]) {
  assert(detailHtml.includes(marker), `Detail missing marker: ${marker}`)
}

for (const forbidden of [
  'Lưu giao dịch',
  'Xóa giao dịch',
  'data-cashflow-form-field="amount"',
  'data-cashflow-form-field="type"',
  'data-cashflow-form-field="category"',
  'sourceTuitionId',
  'sourcePeriodId',
]) {
  assert(!detailHtml.includes(forbidden), `Read-only detail must not expose: ${forbidden}`)
}

assert(mainSource.includes('function openCashflowTransactionFromRow(transactionId)'))
assert(mainSource.includes('openCashflowSyncedTransactionDetail(transactionId'))
assert(mainSource.includes('openCashflowEditForm(transactionId)'))
assert(mainSource.includes('Không tìm thấy giao dịch'))
assert(mainSource.includes('Giao dịch không thuộc cơ sở hiện tại'))
assert(mainSource.includes('isCashflowTransactionInCurrentCenter(transaction, currentCenterId)'))
assert(mainSource.includes('isCashflowTransactionDetailRequestCurrent(hydrateToken, currentCenterId, transactionId)'))
assert(mainSource.includes('cashflowTransactionDetailHydrateToken += 1'))
assert(mainSource.includes('event.stopPropagation()'))
assert(mainSource.includes('await printCashflowTransaction(button.dataset.cashflowTransactionId)'))
assert(mainSource.includes('[data-cashflow-detail-action="view-attachments"]'))
assert(mainSource.includes('await openTransactionImageManager(cashflowTransactionDetailState.transaction.id)'))

const rowClickBlock = mainSource.slice(
  mainSource.indexOf('.querySelectorAll(\'.cashflow-row[data-cashflow-transaction-id]\')'),
  mainSource.indexOf('document.querySelectorAll(\'[data-cashflow-action="print-transaction"]\')'),
)
assert(rowClickBlock.includes('openCashflowTransactionFromRow(row.dataset.cashflowTransactionId)'))
assert(!rowClickBlock.includes('openCashflowEditForm(row.dataset.cashflowTransactionId)'))

const printHandlerBlock = mainSource.slice(
  mainSource.indexOf('document.querySelectorAll(\'[data-cashflow-action="print-transaction"]\')'),
  mainSource.indexOf('document.querySelectorAll(\'[data-cashflow-detail-action="close"]\')'),
)
assert(printHandlerBlock.includes('event.preventDefault()'))
assert(printHandlerBlock.includes('event.stopPropagation()'))

const printButtonStyles = stylesSource.slice(
  stylesSource.indexOf('.cashflow-row-action-cell'),
  stylesSource.indexOf('.cashflow-transaction-detail-backdrop'),
)
assert(printButtonStyles.includes('overflow: visible'))
assert(printButtonStyles.includes('white-space: nowrap'))
assert(printButtonStyles.includes('min-width: 76px'))
assert(!/display\s*:\s*none/.test(printButtonStyles))
assert(!/opacity\s*:\s*0/.test(printButtonStyles))

for (const marker of [
  'Root Cause',
  'Row Interaction Contract',
  'Direct Print Action',
  'Event Propagation',
  'Read-only Synced Detail',
  'Synced Protection',
  'Responsive Action Layout',
  'Center And Stale Guard',
  'Manual QA',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [mainSource, cashflowSource, stylesSource, docsSource, html, detailHtml].join('\n')
const mojibakeMarkers = [
  `C${'á'}º`,
  `Ă${'ƒ'}`,
  `Ă${'†'}°`,
  `H${'á'}º`,
  `Ă${'¡'}»`,
  `Bu${'Ă'}¡Â»â€¢i h${'Ă'}¡Â»Âc m${'Ă'}¡Â»â€ºi`,
]
for (const marker of mojibakeMarkers) {
  assert(!combined.includes(marker), `Mojibake marker found: ${marker}`)
}

console.log('F23.8E1.1 row print action and synced detail smoke passed')
