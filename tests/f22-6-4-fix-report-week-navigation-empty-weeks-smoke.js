import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { buildReportData, getWeekStartDate } from '../src/report-module.js'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')
const runNodeTest = (relativePath) => {
  execFileSync(process.execPath, [relativePath], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

const docPath = 'docs/f22-6-4-fix-report-week-navigation-empty-weeks.md'
const smokePath = 'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js'
const mainPath = 'src/main.js'
const reportModulePath = 'src/report-module.js'

for (const filePath of [docPath, smokePath, mainPath, reportModulePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing F22.6.4 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)
const main = read(mainPath)
const reportModule = read(reportModulePath)

for (const required of [
  '# F22.6.4 - Fix Report Week Navigation Empty Weeks',
  'Manual QA Issue',
  'Root Cause',
  'Fix Applied',
  'Empty week',
  'F22.7 - Commit local F22 checkpoint',
]) {
  assert(doc.includes(required), `F22.6.4 doc missing: ${required}`)
}

for (const required of [
  'data-report-week-action="previous"',
  'data-report-week-action="current"',
  'data-report-week-action="next"',
  'Tuần đang xem:',
  'data-report-filter="weekStartDate"',
  'Chưa có dữ liệu thu/chi trong các tuần đang hiển thị.',
]) {
  assert(reportModule.includes(required), `Report module missing week/empty behavior: ${required}`)
}

for (const required of [
  'function getNextReportWeekStartDate(currentWeekStartDate, action)',
  "action === 'current'",
  "action === 'previous'",
  "action === 'next'",
  'nextWeekDate.setDate(nextWeekDate.getDate() - 7)',
  'nextWeekDate.setDate(nextWeekDate.getDate() + 7)',
  "event.target.closest('[data-report-week-action]')",
  'selectedBarDetail: null',
  "control.dataset.reportFilter === 'weekStartDate'",
  'getWeekStartDate(control.value)',
]) {
  assert(main.includes(required), `Main missing week navigation guard: ${required}`)
}

for (const required of [
  'function parseReportDate(value)',
  'value instanceof Date',
  'return parseDateKey(value)',
  'const date = parseReportDate(value) ?? new Date()',
  'const startDate = parseReportDate(weekStartDate) ?? new Date()',
]) {
  assert(reportModule.includes(required), `Report module missing Date-safe helper: ${required}`)
}

assert.equal(getWeekStartDate('2026-06-27'), '2026-06-22')
assert.equal(getWeekStartDate(new Date('2026-06-15T00:00:00')), '2026-06-15')
assert.equal(getWeekStartDate(new Date('2026-06-29T00:00:00')), '2026-06-29')

const previousWeekData = buildReportData({
  filters: {
    reportDate: '2026-06-27',
    weekStartDate: getWeekStartDate(new Date('2026-06-15T00:00:00')),
  },
  students: [],
  cashflowTransactions: [],
  attendanceRecords: [],
})

assert.equal(previousWeekData.weekLabel, '15/06/2026 - 21/06/2026')
assert.equal(previousWeekData.weeklyIncome, 0)
assert.equal(previousWeekData.weeklyExpense, 0)
assert.equal(previousWeekData.weeklyBalance, 0)
assert.equal(previousWeekData.attendanceSummary.hasAttendanceData, false)
assert(previousWeekData.weeklyBars.weeks.some((week) => week.weekLabel === '15/06/2026 - 21/06/2026'))

const weekHandlerStart = main.indexOf("event.target.closest('[data-report-week-action]')")
const weekHandlerEnd = main.indexOf("document.querySelectorAll('[data-staff-filter]')", weekHandlerStart)
const weekHandlerSource = main.slice(weekHandlerStart, weekHandlerEnd)

for (const forbidden of [
  'bootstrapCoreCloudDataForCurrentCenter',
  'syncCloudUser',
  'pullCloudBootstrapCoreEntities',
]) {
  assert(!weekHandlerSource.includes(forbidden), `Week navigation must not call cloud: ${forbidden}`)
}

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
  [mainPath, main],
  [reportModulePath, reportModule],
  ['src/styles.css', read('src/styles.css')],
]) {
  const mojibakePatterns = [
    /\u00c3[\u0080-\u00bf]/u,
    /\u00c2[\u0080-\u00bf]/u,
    /\u00e2\u20ac[\u0080-\u00bf]/u,
    /\u00ef\u00bf\u00bd/u,
  ]

  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} contains mojibake pattern`)
  }
}

for (const forbidden of [
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bauth\.signUp\s*\(/i,
  /\bsignUp\s*\(/i,
]) {
  assert(!forbidden.test(doc), `F22.6.4 doc contains forbidden pattern: ${forbidden}`)
  assert(!forbidden.test(smoke), `F22.6.4 smoke contains forbidden pattern: ${forbidden}`)
}

const status = execSync('git status --short', { cwd: repoRoot, encoding: 'utf8' })
const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  'src/cloud-bootstrap.js',
  'src/inventory-module.js',
  'src/main.js',
  'src/modules.js',
  'src/report-module.js',
  'src/staff-module.js',
  'src/student-detail.js',
  'src/student-tuition-links.js',
  'src/styles.css',
  'src/tuition-module.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md',
  'docs/f22-feedback-checkpoint-review-before-push.md',
  'docs/f22-6-1-manual-qa-polish-before-commit.md',
  'docs/f22-6-2-cloud-400-report-scroll-diagnosis.md',
  'docs/f22-6-3-report-week-buttons-cloud-status.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'tests/f22-6-feedback-checkpoint-review-smoke.js',
  'tests/f22-6-1-manual-qa-polish-before-commit-smoke.js',
  'tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js',
  'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.6.4 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.6.4 must not change SQL files: ${changedPath}`)
}

runNodeTest('tests/f22-6-3-report-week-buttons-cloud-status-smoke.js')
runNodeTest('tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js')
runNodeTest('tests/f22-6-1-manual-qa-polish-before-commit-smoke.js')
runNodeTest('tests/f22-6-feedback-checkpoint-review-smoke.js')
runNodeTest('tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js')
runNodeTest('tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')

console.log('F22.6.4 fix report week navigation empty weeks smoke passed')
