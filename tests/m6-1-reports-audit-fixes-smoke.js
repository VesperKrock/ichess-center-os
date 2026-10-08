import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildReportData,
  buildReportDownloadText,
  buildReportPrintHtml,
  getReportPdfSnapshotFingerprint,
  isReportPdfSnapshotCurrent,
  renderReportModule,
} from '../src/report-module.js'
import { createReportPdfProjection } from '../src/report-pdf.js'

const centerId = 'phongtrong_prod'
const filters = { reportDate: '2026-09-26', weekStartDate: '2026-09-21' }
const transactions = [
  { id: 'posted-1', type: 'income', transactionDate: '2026-09-27', amount: 1_600_000 },
  { id: 'posted-2', type: 'income', transactionDate: '2026-09-27', amount: 1_600_000 },
]
const snapshot = data => ({ centerId, viewMode: 'day', data })
const day26 = snapshot(buildReportData({ filters, cashflowTransactions: transactions }))
assert.equal(day26.data.dailyIncome, 0)
assert(isReportPdfSnapshotCurrent(day26, { centerId, viewMode: 'day', filters, inputValue: '2026-09-26' }))

const day27Filters = { ...filters, reportDate: '2026-09-27' }
assert(!isReportPdfSnapshotCurrent(day26, { centerId, viewMode: 'day', filters: day27Filters, inputValue: '2026-09-27' }),
  '26/09 snapshot cannot be exported for selected 27/09')
assert(!isReportPdfSnapshotCurrent(day26, { centerId, viewMode: 'day', filters, inputValue: '2026-09-27' }),
  'The live focused date input must agree with the snapshot even before its event updates state')
const day27 = snapshot(buildReportData({ filters: day27Filters, cashflowTransactions: transactions }))
assert.equal(day27.data.dailyIncome, 3_200_000)
assert.equal(day27.data.dailyExpense, 0)
assert.deepEqual(day27.data.dailyTransactions.map(item => item.amount), [1_600_000, 1_600_000])
assert(isReportPdfSnapshotCurrent(day27, { centerId, viewMode: 'day', filters: day27Filters, inputValue: '2026-09-27' }))
const pdf27 = createReportPdfProjection(day27)
assert.equal(pdf27.data.filters.reportDate, '2026-09-27')
assert.equal(pdf27.data.dailyIncome, 3_200_000)
assert.deepEqual(pdf27.data.dailyTransactions.map(item => item.amount), [1_600_000, 1_600_000])
assert(!isReportPdfSnapshotCurrent(day27, { centerId, viewMode: 'day', filters, inputValue: '2026-09-26' }),
  'Returning to 26/09 invalidates the 27/09 snapshot')
assert(!isReportPdfSnapshotCurrent(day27, { centerId: 'phongtester_prod', viewMode: 'day', filters: day27Filters }),
  'A previous-center snapshot cannot enable export')
assert(!isReportPdfSnapshotCurrent(day27, { centerId, viewMode: 'week', filters: day27Filters }),
  'A Day snapshot cannot enable Week export')
assert.equal(getReportPdfSnapshotFingerprint(day27), getReportPdfSnapshotFingerprint({ ...day27,
  data: { ...day27.data, attendanceSummary: { available: true, totalCount: 86 } },
}), 'Day export ignores unrelated background Week attendance updates')
assert.notEqual(getReportPdfSnapshotFingerprint(day27), getReportPdfSnapshotFingerprint({ ...day27,
  data: { ...day27.data, dailyIncome: 0 },
}), 'Day export rejects a changed daily amount')

const week = { centerId, viewMode: 'week', data: day27.data }
assert(isReportPdfSnapshotCurrent(week, { centerId, viewMode: 'week', filters: day27Filters, inputValue: '2026-09-21' }))
assert(!isReportPdfSnapshotCurrent(week, { centerId, viewMode: 'week',
  filters: { ...day27Filters, weekStartDate: '2026-09-28' }, inputValue: '2026-09-28' }))

const html = renderReportModule({ viewMode: 'week', filters: day27Filters,
  cashflowTransactions: transactions, selectedBarDetail: {
    label: 'Doanh thu', weekLabel: '21/09/2026 - 27/09/2026', value: 3_200_000,
    source: 'Sổ quỹ trong tuần đang xem',
  } })
assert(html.includes('Nguồn: Sổ quỹ trong tuần đang xem'))
assert(html.includes('aria-label="Biểu đồ điểm danh trong tuần"'))
assert(!/aria-label="[^"]*(authoritative|canonical)/i.test(html))
assert(!/data-report-bar-source="[^"]*(authoritative|canonical)/i.test(html))
assert(!/<small>[^<]*(authoritative|canonical)/i.test(html))
assert(html.includes('Thu / Chi theo tuần') && html.includes('report-pie'), 'Both charts remain')
const legacyExports = [buildReportDownloadText({ filters: day27Filters }),
  buildReportPrintHtml({ filters: day27Filters })]
assert(legacyExports.every(output => !/authoritative|canonical|derived view|active center/i.test(output)),
  'Admin-facing Report text and print exports use business wording')
const dayHtml = renderReportModule({ viewMode: 'day', filters: day27Filters })
assert.equal((dayHtml.match(/data-checklist-item=/g) || []).length, 5, 'Day uses canonical Part-time checklist')

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(main.includes('[data-tu-filter], [data-report-filter],'), 'Focused Report date bypasses deferred rendering')
assert(main.includes("control.addEventListener('change', () => applyReportPeriodControl(control))"))
assert(main.includes('inputValue: periodControl?.value'), 'Export checks the live date control')
assert(main.includes('getReportPdfSnapshotFingerprint(reportPdfSnapshot) !== exportedData'),
  'Late PDF generation cannot use changed Report data')
const centerSwitch = main.slice(main.indexOf('async function handleInternalOpenCenter('), main.indexOf('function normalizeInternalCenters('))
assert(centerSwitch.includes('closeCenterBoundWorkspacesForSwitch()') && centerSwitch.includes('resetCloudRuntimeStateForOwnerCenterSwitch()'),
  'Center switch closes the old Report and resets its center-scoped state')
assert(main.includes("refreshModuleAuthoritativeUpstreams(moduleId, { reason: 'module-open' })"),
  'Reopening Report starts the current center-scoped refresh')
assert(main.includes('viewMode: reportState.viewMode') && main.includes('filters: { ...reportState.filters }'),
  'Center switch retains the selected Report period while resetting the draft')
console.log('M6_1_REPORTS_AUDIT_FIXES_SMOKE PASS')
