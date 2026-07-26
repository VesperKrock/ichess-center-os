import assert from 'node:assert/strict'
import fs from 'node:fs'

import { initialCashflowFilters, renderCashflowModule } from '../src/cashflow-module.js'

const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const mainSource = fs.readFileSync('src/main.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8e1-2-polish-thu-chi-row-layout-va-ui-format.md',
  'utf8',
)

const syncedTransaction = {
  id: 'synced-polish-1',
  type: 'income',
  category: 'Học phí',
  amount: 1200000,
  transactionDate: '2026-07-24',
  method: 'Chuyển khoản',
  personName: 'Phụ huynh A',
  recordedBy: 'owner.duchai@example.test',
  note: 'Đồng bộ từ Học phí: Ngô Đức Tài · Kỳ 1',
  sourceModule: 'hoc-phi',
  sourceType: 'tuition-payment',
}

const manualTransaction = {
  id: 'manual-polish-1',
  type: 'expense',
  category: 'Vận hành',
  amount: 120000,
  transactionDate: '2026-07-22',
  method: 'Tiền mặt',
  personName: 'Nhân sự A',
  recordedBy: 'Admin Center',
  note: 'Ảnh hóa đơn',
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
      'synced-polish-1': 'TC-20260724-0001',
      'manual-polish-1': 'TC-20260722-0001',
    },
    attachmentCounts: {
      'TC-20260724-0001': 0,
      'TC-20260722-0001': 1,
    },
  },
)

assert(html.includes('24/07/2026'), 'Date must render full DD/MM/YYYY.')
assert(html.includes('1.200.000 VNĐ'), 'Amount must render full money text.')
assert(html.includes('Chuyển khoản'), 'Payment method must have room to render.')
assert(html.includes('Chèn ảnh'), 'Image action must remain visible.')
assert(html.includes('In / PDF'), 'Print action must remain visible.')
assert(html.includes('class="cashflow-source-text"'), 'Synced source must render as plain source text.')
assert(html.includes('Đồng bộ từ Học phí: Ngô Đức Tài · Kỳ 1'))
assert(html.includes('<span class="cashflow-source-text">Đồng bộ từ Học phí: Ngô Đức Tài · Kỳ 1</span>'))
assert(!html.includes('<span class="cashflow-source-badge">Đồng bộ từ Học phí</span>'))
assert(!html.includes('undefined'))
assert(!html.includes('null'))

const missingContextHtml = renderCashflowModule(
  [{
    ...syncedTransaction,
    id: 'synced-polish-empty',
    note: '',
  }],
  initialCashflowFilters,
  null,
  [],
  false,
  undefined,
  '',
  {
    transactionCodes: {
      'synced-polish-empty': 'TC-20260724-0002',
    },
  },
)
assert(missingContextHtml.includes('Đồng bộ từ Học phí'))
assert(!missingContextHtml.includes('Đồng bộ từ Học phí: undefined'))
assert(!missingContextHtml.includes('Đồng bộ từ Học phí: null'))

const printButtonStyle = stylesSource.slice(
  stylesSource.lastIndexOf('.cashflow-transaction-print-button {'),
  stylesSource.indexOf(
    '.cashflow-transaction-print-button:hover',
    stylesSource.lastIndexOf('.cashflow-transaction-print-button {'),
  ),
)
assert(printButtonStyle.includes('rgba(31, 93, 153, 0.35)'), 'Print button must reuse cashflow action background.')
assert(printButtonStyle.includes('color: #dcecff'), 'Print button must reuse cashflow action text color.')
assert(printButtonStyle.includes('border-radius: 5px'), 'Print button radius must match small row actions.')
assert(!printButtonStyle.includes('background: #ffffff'), 'Print button must not use white browser-default styling.')
assert(!printButtonStyle.includes('color: #0f172a'), 'Print button must not use black browser-default styling.')

const readyNoticeStyle = stylesSource.slice(
  stylesSource.indexOf('.cashflow-cloud-auth-note {'),
  stylesSource.indexOf('.cashflow-table th:nth-child(1),'),
)
assert(readyNoticeStyle.includes('rgba(19, 35, 52, 0.72)'), 'Cloud banner must use app status-panel background token.')
assert(readyNoticeStyle.includes('rgba(37, 130, 69, 0.14)'), 'Ready cloud banner must use existing success token family.')
assert(readyNoticeStyle.includes('rgba(31, 93, 153, 0.35)'), 'Cloud gallery button must match secondary action styling.')

for (const marker of [
  '.cashflow-table th:nth-child(1) {\n  width: 96px;',
  '.cashflow-table th:nth-child(5) {\n  width: 104px;',
  '.cashflow-table th:nth-child(6) {\n  width: 124px;',
  '.cashflow-table th:nth-child(9) {\n  width: 88px;',
  '.cashflow-table th:nth-child(10) {\n  width: 92px;',
  '.cashflow-table td:nth-child(6)',
  '.cashflow-source-text',
  'text-overflow: ellipsis',
]) {
  assert(stylesSource.includes(marker), `Layout/style marker missing: ${marker}`)
}

assert(mainSource.includes('renderCashflowCloudAuthNotice(cloudStatus)'))
assert(mainSource.includes('data-cloud-action="open-gallery"'))
assert(mainSource.includes('openCashflowTransactionFromRow(row.dataset.cashflowTransactionId)'))
assert(mainSource.includes('event.stopPropagation()'))
assert(cashflowSource.includes('function getSyncedTuitionRowSourceText(transaction)'))
assert(cashflowSource.includes("String(transaction?.sourceModule || '') === 'hoc-phi'"))

for (const marker of [
  'Button Style',
  'Cloud Banner',
  'Source Text',
  'Column Widths',
  'Behavior Unchanged',
  'Manual QA',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [cashflowSource, mainSource, stylesSource, docsSource, html, missingContextHtml].join('\n')
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

console.log('F23.8E1.2 cashflow table polish smoke passed')
