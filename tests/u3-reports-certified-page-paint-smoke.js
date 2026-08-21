import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildReportData,
  createInitialReportState,
  getReportTransactionsForScope,
  renderReportModule,
} from '../src/report-module.js'

const repoRoot = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
const main = read('src/main.js')
const reportModule = read('src/report-module.js')
const reportTheme = read('src/report-theme.css')

const certifiedFigmaNodes = {
  day: ['156:4', '164:2'],
  week: ['166:4', '174:2'],
  source: ['182:4', '184:2'],
  sourceModal: ['182:114', '184:140'],
}

assert.deepEqual(Object.values(certifiedFigmaNodes).flat(), [
  '156:4', '164:2', '166:4', '174:2', '182:4', '184:2', '182:114', '184:140',
])

const transactions = Array.from({ length: 100 }, (_, index) => ({
  id: `qa-report-${index + 1}`,
  transactionCode: `QA-RPT-${String(index + 1).padStart(3, '0')}`,
  transactionDate: `2026-08-${String(10 + (index % 7)).padStart(2, '0')}`,
  type: index % 3 === 1 ? 'expense' : 'income',
  category: `Nội dung nguồn kiểm thử rất dài ${index + 1}`,
  amount: 125_000 + index * 75_000,
  personName: `Người liên quan kiểm thử ${index + 1}`,
  recordedBy: 'QA Operator',
  sourceModule: index % 2 ? 'hoc-phi' : 'thu-chi',
  sourceType: index % 2 ? 'tuition-payment' : 'manual',
  note: index % 2 ? 'Đồng bộ từ Học phí — QA' : '',
}))

const filters = { reportDate: '2026-08-16', weekStartDate: '2026-08-10' }
const reportData = buildReportData({ filters, cashflowTransactions: transactions })
assert.equal(reportData.dailyTransactions.length, 14)
assert.equal(reportData.weeklyTransactions.length, 100)
assert.equal(getReportTransactionsForScope(transactions, filters, { mode: 'week', type: 'expense' }).length, 33)

const initialState = createInitialReportState(new Date('2026-08-16T12:00:00+07:00'))
assert.equal(initialState.viewMode, 'day')
assert.equal(initialState.draft.dailyTasks, '')

const dayHtml = renderReportModule({
  viewMode: 'day',
  filters,
  cashflowTransactions: transactions,
  centerInfo: { ok: true, centerId: 'qa-center', centerName: 'Cơ sở QA' },
})

const weekHtml = renderReportModule({
  viewMode: 'week',
  filters,
  cashflowTransactions: transactions,
  students: [{ id: 'student-1', status: 'active' }],
  attendanceRecords: [],
  centerInfo: { ok: true, centerId: 'qa-center', centerName: 'Cơ sở QA' },
})

for (const token of [
  'data-report-view="day"',
  'data-report-view-mode="day"',
  'data-report-view-mode="week"',
  'data-report-filter="reportDate"',
  'data-report-action="print"',
  'data-report-action="download"',
  'Ghi nhận vận hành trong ngày',
  'Checklist công việc ngày',
  'report-field-helper',
  'data-report-draft-field="dailyTasks"',
  'data-report-pending-task="diemDanh"',
  'data-report-drilldown-mode="day"',
]) assert(dayHtml.includes(token), `Day report missing ${token}`)

for (const token of [
  'data-report-view="week"',
  'data-report-filter="weekStartDate"',
  'data-report-week-action="previous"',
  'data-report-week-action="current"',
  'data-report-week-action="next"',
  'Thu / Chi theo tuần',
  'Học / Vắng / Nghỉ',
  'data-report-bar-detail',
  'data-report-drilldown-mode="week"',
]) assert(weekHtml.includes(token), `Week report missing ${token}`)

assert(!dayHtml.includes('Thu học phí tháng 8'), 'Figma sample values must not enter runtime')
assert(!weekHtml.includes('3.850.000'), 'Figma sample values must not enter runtime')

const sourceHtml = renderReportModule({
  viewMode: 'day',
  filters,
  cashflowTransactions: transactions,
  sourceTransactionsState: {
    title: 'Giao dịch nguồn báo cáo',
    subtitle: 'Ngày 16/08/2026 · Dữ liệu hiện tại',
    scope: { mode: 'day', type: 'all', category: '' },
    transactions,
    transactionCodes: Object.fromEntries(transactions.map((item) => [item.id, item.transactionCode])),
    attachmentCounts: {},
    status: 'loaded',
    error: '',
    message: '',
  },
})

assert.equal((sourceHtml.match(/class="report-source-row is-/g) || []).length, 100)
for (const token of [
  'data-report-source-action="filter"',
  'data-report-source-type="all"',
  'data-report-source-type="income"',
  'data-report-source-type="expense"',
  'data-report-source-action="close"',
  'data-report-source-action="open-transaction"',
  'data-report-source-action="view-evidence"',
  'data-report-source-action="print-transaction"',
  'report-source-type-badge',
  'title="Nội dung nguồn kiểm thử rất dài 100"',
]) assert(sourceHtml.includes(token), `Source modal missing ${token}`)

for (const token of [
  "import './report-theme.css'",
  "windowItem.moduleId === 'bao-cao'",
  "isReportWindow ? 'is-report-window' : ''",
  'viewMode: reportState.viewMode',
  "event.target.closest('[data-report-view-mode]')",
  "action === 'filter'",
  'openReportTransactionDrilldown({',
  "document.querySelector('[data-report-action=\"print\"]')",
  "document.querySelector('[data-report-action=\"download\"]')",
]) assert(main.includes(token), `Runtime wiring missing ${token}`)

assert(!reportModule.includes('data-report-action="save"'))
assert(!/localStorage|sessionStorage/.test(reportModule), 'Report draft must remain memory-only')
assert(!/supabase|\.rpc\(|insert\(|update\(|delete\(/i.test(reportModule), 'Report renderer must not mutate server data')

for (const token of [
  '.desktop-window.is-report-window .report-module',
  'overflow-y: auto;',
  'scrollbar-gutter: stable;',
  '.report-source-table-wrap',
  'position: sticky;',
  'max-height: min(500px, calc(100% - 18px));',
  'opacity: 1;',
  '@media (max-width: 1280px)',
  '@media (max-width: 720px)',
  'grid-template-columns: 1fr;',
]) assert(reportTheme.includes(token), `Report theme missing ${token}`)

assert(!/\bzoom\s*:|transform\s*:\s*scale\(/i.test(reportTheme))
assert(!/^\s*\.taskbar\b/m.test(reportTheme), 'U3 must not style the runtime taskbar')
assert(!/^\s*\.window-titlebar\b/m.test(reportTheme), 'U3 must not style runtime window chrome')

function channelToLinear(channel) {
  const normalized = channel / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16))
  return channels.map(channelToLinear).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const [foreground, background, label] of [
  ['#111827', '#ffffff', 'light primary'],
  ['#4b5563', '#ffffff', 'light secondary'],
  ['#6b7280', '#ffffff', 'light placeholder'],
  ['#047857', '#ffffff', 'light positive'],
  ['#dc2626', '#ffffff', 'light negative'],
  ['#f4f4f5', '#14171c', 'dark primary'],
  ['#c7cbd1', '#14171c', 'dark secondary'],
  ['#9ca3af', '#14171c', 'dark muted'],
  ['#34d399', '#14171c', 'dark positive'],
  ['#f87171', '#14171c', 'dark negative'],
]) assert(contrast(foreground, background) >= 4.5, `${label} contrast must be >= 4.5`)

for (const [indicator, background, label] of [
  ['#047857', '#ffffff', 'light chart income'],
  ['#dc2626', '#ffffff', 'light chart expense'],
  ['#34d399', '#14171c', 'dark chart income'],
  ['#f87171', '#14171c', 'dark chart expense'],
]) assert(contrast(indicator, background) >= 3, `${label} contrast must be >= 3`)

console.log('U3 reports certified page paint smoke passed')
