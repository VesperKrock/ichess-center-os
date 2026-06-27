import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/f22-6-1-manual-qa-polish-before-commit.md'
const smokePath = 'tests/f22-6-1-manual-qa-polish-before-commit-smoke.js'
const inventoryModulePath = 'src/inventory-module.js'
const reportModulePath = 'src/report-module.js'
const staffModulePath = 'src/staff-module.js'
const mainPath = 'src/main.js'
const stylesPath = 'src/styles.css'

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
const inventoryModule = read(inventoryModulePath)
const reportModule = read(reportModulePath)
const staffModule = read(staffModulePath)
const main = read(mainPath)
const styles = read(stylesPath)

assert(doc.includes('# F22.6.1 - Manual QA Polish Before Commit'))
assert(doc.includes('Kho unit datalist mẫu-only cho item mới'))
assert(doc.includes('Báo cáo week navigation'))
assert(doc.includes('Chart Y-axis/dynamic max'))
assert(doc.includes('Hover/click detail'))
assert(doc.includes('Report-only print'))
assert(doc.includes('Improved txt download'))
assert(doc.includes('Report scroll retention'))
assert(doc.includes('Staff header description removed'))
assert(doc.includes('F22.7 — Commit local F22 checkpoint'))

assert(inventoryModule.includes('type="text"'))
assert(inventoryModule.includes('list="inventory-unit-options"'))
assert(inventoryModule.includes('function getInventoryFormUnits(items = [], currentUnit = \'\')'))
assert(inventoryModule.includes('const units = new Set(inventoryUnitOptions)'))
assert(inventoryModule.includes('units.add(String(currentUnit).trim())'))
assert(!inventoryModule.includes("const unit = String(item?.unit ?? '').trim()"))
assert(!inventoryModule.includes('units.add(unit)'))

for (const required of [
  'Tuần trước',
  'Tuần này',
  'Tuần sau',
  'Tuần đang xem: ${escapeHtml(reportData.weekLabel)}',
  'getReadableAxisMax',
  'buildAxisTicks',
  'report-y-axis',
  'data-report-bar-detail',
  'title="${escapeAttribute(title)}"',
  'renderReportBarDetail',
  'buildReportPrintHtml',
  'Bảng thu/chi theo tuần',
  'data-report-scroll-region="report-grid"',
]) {
  assert(reportModule.includes(required), `Missing report polish: ${required}`)
}

assert(!reportModule.includes('<h3>Báo cáo vận hành cơ sở</h3>'))
assert(!reportModule.includes('<p>${DATA_SOURCE_NOTE}</p>'))
assert(main.includes('data-report-week-action'))
assert(main.includes('selectedBarDetail'))
assert(main.includes('buildReportPrintHtml'))
assert(main.includes("window.open('', 'ichess-report-print'"))
assert(!main.includes('window.print()'))
assert(main.includes("['.report-module', 'report-module']"))

assert(!staffModule.includes('<header class="staff-header">'))
assert(!staffModule.includes('<h3>Nhân viên / Chấm công</h3>'))
assert(!staffModule.includes('Theo dõi địa điểm dạy, tổng buổi và bảng chấm công'))
assert(staffModule.includes('staff-filters'))
assert(staffModule.includes('staff-summary'))
assert(staffModule.includes('staff-layout'))

assert(styles.includes('.report-week-actions'))
assert(styles.includes('.report-y-axis'))
assert(styles.includes('.report-bar-plot'))
assert(styles.includes('.report-bar-detail'))
assert(styles.includes('.report-bar-detail-empty'))

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
  [inventoryModulePath, inventoryModule],
  [reportModulePath, reportModule],
  [staffModulePath, staffModule],
  [mainPath, main],
  [stylesPath, styles],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

const changedRuntime = [inventoryModule, reportModule, staffModule, styles].join('\n')
assert(!/supabase/i.test(changedRuntime), 'F22.6.1 must not add Supabase runtime')
assert(!/channel\(|on\('postgres_changes'|realtime/i.test(changedRuntime), 'F22.6.1 must not add realtime runtime')
assert(!/signUp|Dang ky/i.test(changedRuntime), 'F22.6.1 must not add signUp/register runtime')
assert(!/C5 implemented|C6 implemented/i.test(doc), 'F22.6.1 must not implement C5/C6')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  inventoryModulePath,
  reportModulePath,
  staffModulePath,
  mainPath,
  'src/cloud-bootstrap.js',
  stylesPath,
  'src/modules.js',
  'src/student-detail.js',
  'src/tuition-module.js',
  'src/student-tuition-links.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md',
  'docs/f22-feedback-checkpoint-review-before-push.md',
  'docs/f22-6-2-cloud-400-report-scroll-diagnosis.md',
  'docs/f22-6-3-report-week-buttons-cloud-status.md',
  'docs/f22-6-4-fix-report-week-navigation-empty-weeks.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'tests/f22-6-feedback-checkpoint-review-smoke.js',
  'tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js',
  'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.6.1 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.6.1 must not change SQL files: ${changedPath}`)
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
  [inventoryModulePath, inventoryModule],
  [reportModulePath, reportModule],
  [staffModulePath, staffModule],
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-6-feedback-checkpoint-review-smoke.js')
runNodeTest('tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js')
runNodeTest('tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')

console.log('F22.6.1 manual QA polish before commit smoke passed')
