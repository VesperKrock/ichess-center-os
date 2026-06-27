import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/f22-6-3-report-week-buttons-cloud-status.md'
const smokePath = 'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js'
const mainPath = 'src/main.js'
const reportModulePath = 'src/report-module.js'
const cloudBootstrapPath = 'src/cloud-bootstrap.js'

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function runNodeTest(relativePath) {
  execFileSync(process.execPath, [relativePath], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

const doc = read(docPath)
const smoke = read(smokePath)
const main = read(mainPath)
const reportModule = read(reportModulePath)
const cloudBootstrap = read(cloudBootstrapPath)

assert(doc.includes('# F22.6.3 - Report Week Buttons + Cloud Status After Reload'))
assert(doc.includes('Week Buttons'))
assert(doc.includes('Cache Cục Bộ After Reload'))
assert(doc.includes('Fix Applied'))
assert(doc.includes('F22.7 — Commit local F22 checkpoint'))

for (const required of [
  'data-report-week-action="previous"',
  'data-report-week-action="current"',
  'data-report-week-action="next"',
  'Tuần đang xem: ${escapeHtml(reportData.weekLabel)}',
]) {
  assert(reportModule.includes(required), `Missing report UI: ${required}`)
}

for (const required of [
  "document.querySelector('.report-module')?.addEventListener('click'",
  "event.target.closest('[data-report-week-action]')",
  'event.preventDefault()',
  'event.stopPropagation()',
  'getNextReportWeekStartDate',
  "action === 'previous'",
  "action === 'next'",
  "action === 'current'",
  'weekStartDate',
]) {
  assert(main.includes(required), `Missing week handler behavior: ${required}`)
}

const weekHandlerStart = main.indexOf("document.querySelector('.report-module')?.addEventListener('click'")
const weekHandlerSource = main.slice(weekHandlerStart, weekHandlerStart + 1400)
assert(!/bootstrapCoreCloudDataForCurrentCenter|pullCloudBootstrapCoreEntities|syncCloudUser/.test(weekHandlerSource))

for (const required of [
  'Dữ liệu: Cache cục bộ (đang kiểm cloud nền)',
  'Dữ liệu: Cache cục bộ (cloud lỗi 400/schema, tạm dừng pull)',
  "syncCloudUser(user, { reason: 'initial-get-user' })",
  'cloudBootstrapRetryBlockedUntil',
  'hasUsableLocalCache',
]) {
  assert(main.includes(required), `Missing cloud status guard: ${required}`)
}

assert(cloudBootstrap.includes("return state.message || 'Dữ liệu: Cache cục bộ (lỗi cloud)'"))
assert(cloudBootstrap.includes("return 'Dữ liệu: Cloud'"))

const forbiddenSqlPatterns = [
  /\bcreate\s+table\b/i,
  /\balter\s+table\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
]

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
  [mainPath, main],
  [reportModulePath, reportModule],
  [cloudBootstrapPath, cloudBootstrap],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

const changedRuntime = [main, reportModule, cloudBootstrap].join('\n')
assert(!/signUp|Dang ky/i.test(changedRuntime), 'F22.6.3 must not add signUp/register runtime')
assert(!/C5 implemented|C6 implemented/i.test(doc), 'F22.6.3 must not implement C5/C6')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  'src/cloud-bootstrap.js',
  'src/inventory-module.js',
  'src/main.js',
  'src/modules.js',
  'src/student-detail.js',
  'src/styles.css',
  'src/tuition-module.js',
  'src/report-module.js',
  'src/staff-module.js',
  'src/student-tuition-links.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md',
  'docs/f22-feedback-checkpoint-review-before-push.md',
  'docs/f22-6-1-manual-qa-polish-before-commit.md',
  'docs/f22-6-2-cloud-400-report-scroll-diagnosis.md',
  'docs/f22-6-4-fix-report-week-navigation-empty-weeks.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'tests/f22-6-feedback-checkpoint-review-smoke.js',
  'tests/f22-6-1-manual-qa-polish-before-commit-smoke.js',
  'tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.6.3 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.6.3 must not change SQL files: ${changedPath}`)
}

const mojibakePatterns = [
  /\u00c3[\u0080-\u00bf]/u,
  /\u00c2[\u0080-\u00bf]/u,
  /\u00e2\u20ac[\u0080-\u00bf]/u,
  /\u00ef\u00bf\u00bd/u,
  /\ufffd/u,
]

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
  [mainPath, main],
  [reportModulePath, reportModule],
  [cloudBootstrapPath, cloudBootstrap],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js')
runNodeTest('tests/f22-6-1-manual-qa-polish-before-commit-smoke.js')
runNodeTest('tests/f22-6-feedback-checkpoint-review-smoke.js')
runNodeTest('tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js')
runNodeTest('tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')

console.log('F22.6.3 report week buttons cloud status smoke passed')
