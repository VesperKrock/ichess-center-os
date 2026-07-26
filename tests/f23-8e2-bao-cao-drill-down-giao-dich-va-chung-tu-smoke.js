import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildReportData,
  buildReportPrintHtml,
  getReportTransactionScope,
  getReportTransactionsForScope,
  renderReportModule,
} from '../src/report-module.js'

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const reportSource = fs.readFileSync('src/report-module.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docsSource = fs.readFileSync(
  'docs/f23-8e2-bao-cao-drill-down-giao-dich-va-chung-tu.md',
  'utf8',
)

const filters = {
  reportDate: '2026-07-24',
  weekStartDate: '2026-07-20',
}

const transactions = [
  {
    id: 'income-day-manual',
    type: 'income',
    category: 'Khác',
    amount: 500000,
    transactionDate: '2026-07-24',
    personName: 'Phụ huynh A',
    recordedBy: 'Admin',
    note: 'Thu manual',
  },
  {
    id: 'income-day-tuition',
    type: 'income',
    category: 'Học phí',
    amount: 1200000,
    transactionDate: '2026-07-24',
    personName: 'Phụ huynh B',
    recordedBy: 'Admin',
    note: 'Đồng bộ từ Học phí: Nguyễn An · Kỳ 3',
    sourceModule: 'hoc-phi',
    sourceType: 'tuition-payment',
  },
  {
    id: 'expense-day',
    type: 'expense',
    category: 'Vận hành',
    amount: 300000,
    transactionDate: '2026-07-24',
    personName: 'Nhân sự A',
    recordedBy: 'Admin',
    attachment: { fileName: 'bill.jpg' },
  },
  {
    id: 'income-week-other-day',
    type: 'income',
    category: 'Khác',
    amount: 700000,
    transactionDate: '2026-07-22',
    personName: 'Phụ huynh C',
    recordedBy: 'Admin',
  },
  {
    id: 'outside-week',
    type: 'income',
    category: 'Khác',
    amount: 9900000,
    transactionDate: '2026-07-30',
    personName: 'Ngoài tuần',
    recordedBy: 'Admin',
  },
]

const reportData = buildReportData({
  filters,
  students: [],
  cashflowTransactions: transactions,
  attendanceRecords: [],
})

assert.equal(reportData.dailyIncome, 1700000)
assert.equal(reportData.dailyExpense, 300000)
assert.equal(reportData.weeklyIncome, 2400000)
assert.equal(reportData.weeklyExpense, 300000)
assert.equal(reportData.weeklyBalance, 2100000)
assert.deepEqual(reportData.dailyTransactions.map((transaction) => transaction.id), [
  'income-day-manual',
  'income-day-tuition',
  'expense-day',
])

const dayIncomeScope = getReportTransactionScope(filters, { mode: 'day', type: 'income' })
assert.equal(dayIncomeScope.startDate, '2026-07-24')
assert.equal(dayIncomeScope.endDate, '2026-07-24')
assert.equal(dayIncomeScope.type, 'income')

assert.deepEqual(
  getReportTransactionsForScope(transactions, filters, { mode: 'day', type: 'income' }).map(
    (transaction) => transaction.id,
  ),
  ['income-day-manual', 'income-day-tuition'],
)
assert.deepEqual(
  getReportTransactionsForScope(transactions, filters, {
    mode: 'day',
    type: 'income',
    category: 'Học phí',
  }).map((transaction) => transaction.id),
  ['income-day-tuition'],
)
assert.deepEqual(
  getReportTransactionsForScope(transactions, filters, { mode: 'week', type: 'expense' }).map(
    (transaction) => transaction.id,
  ),
  ['expense-day'],
)
assert.deepEqual(
  getReportTransactionsForScope(transactions, filters, { mode: 'week', type: 'all' }).map(
    (transaction) => transaction.id,
  ),
  ['income-day-manual', 'income-day-tuition', 'expense-day', 'income-week-other-day'],
)

const sourceHtml = renderReportModule({
  filters,
  cashflowTransactions: transactions,
  sourceTransactionsState: {
    title: 'Giao dịch nguồn báo cáo ngày',
    subtitle: 'Tất cả thu/chi · Ngày 24/07/2026',
    transactions: transactions.slice(0, 3),
    transactionCodes: {
      'income-day-manual': 'TC-20260724-0001',
      'income-day-tuition': 'TC-20260724-0002',
      'expense-day': 'TC-20260724-0003',
    },
    attachmentCounts: {
      'TC-20260724-0002': 1,
    },
    status: 'loaded',
    error: '',
  },
})

for (const marker of [
  'data-report-drilldown-action="open"',
  'data-report-drilldown-mode="day"',
  'data-report-drilldown-mode="week"',
  'Xem giao dịch nguồn',
  'Giao dịch nguồn báo cáo ngày',
  'TC-20260724-0002',
  'Thu',
  'Chi',
  'Học phí',
  '1.200.000 VNĐ',
  'Đồng bộ từ Học phí: Nguyễn An · Kỳ 3',
  '1 chứng từ',
  'Mở giao dịch',
  'Xem chứng từ',
  'In / PDF',
  'data-report-source-action="open-transaction"',
  'data-report-source-action="view-evidence"',
  'data-report-source-action="print-transaction"',
]) {
  assert(sourceHtml.includes(marker), `Report drill-down render missing: ${marker}`)
}

const printHtml = buildReportPrintHtml({
  filters,
  cashflowTransactions: transactions,
})
assert(printHtml.includes('Doanh thu trong ngày: 1.700.000 VNĐ'))
assert(printHtml.includes('Tổng doanh thu: 2.400.000 VNĐ'))
assert(!printHtml.includes('9.900.000 VNĐ'), 'Report print must not include outside-week transaction.')

assert(mainSource.includes('function openReportTransactionDrilldown'))
assert(mainSource.includes('getReportTransactionsForScope(latestCashflowTransactions, reportState.filters, scope)'))
assert(mainSource.includes('listTransactionAttachmentsByMonth({ centerId, monthKey })'))
assert(mainSource.includes('openCashflowTransactionFromRow(transaction.id)'))
assert(mainSource.includes('await openTransactionImageManager(transaction.id)'))
assert(mainSource.includes('printCashflowTransaction(transaction.id)'))
assert(mainSource.includes('Không tìm thấy giao dịch nguồn trong cơ sở hiện tại.'))
assert(mainSource.includes('Giao dịch nguồn không thuộc cơ sở hiện tại.'))
assert(mainSource.includes('reportTransactionDrilldownState = null'))

const drilldownImplementation = mainSource.slice(
  mainSource.indexOf('async function openReportTransactionDrilldown'),
  mainSource.indexOf('function getTransactionIdsByCode()'),
)
assert(!drilldownImplementation.includes('createTransactionImageSignedUrl'))
assert(!drilldownImplementation.includes('listTransactionAttachmentsByTransactionCode'))
assert(!drilldownImplementation.includes('addSignedUrlsToAttachments'))

for (const marker of [
  '.report-source-actions',
  '.report-source-modal',
  '.report-source-table',
  '.report-source-row-actions',
  'min-width: 1080px',
  'width: 92px',
  'width: 216px',
]) {
  assert(stylesSource.includes(marker), `Styles missing marker: ${marker}`)
}

for (const marker of [
  'Data Contract',
  'Drill-down Scope',
  'Read-only Actions',
  'Attachment Loading',
  'Stale And Center Guards',
  'Print Flow',
  'Manual QA',
]) {
  assert(docsSource.includes(marker), `Docs missing marker: ${marker}`)
}

const combined = [mainSource, reportSource, stylesSource, docsSource, sourceHtml, printHtml].join('\n')
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

console.log('F23.8E2 report source transaction drill-down smoke passed')
