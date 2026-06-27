import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/bao-cao-ngay-tuan-mvp-f22-2.md'
const smokePath = 'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js'
const reportModulePath = 'src/report-module.js'
const mainPath = 'src/main.js'
const modulesPath = 'src/modules.js'
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
const reportModule = read(reportModulePath)
const main = read(mainPath)
const modules = read(modulesPath)
const styles = read(stylesPath)

assert(doc.includes('# F22.2 - Báo cáo Ngày/Tuần MVP'))
assert(doc.includes('Feedback anh Hải được xử lý'))
assert(doc.includes('Báo cáo ngày MVP'))
assert(doc.includes('Báo cáo tuần MVP'))
assert(doc.includes('Biểu đồ thu/chi'))
assert(doc.includes('Biểu đồ học/vắng/nghỉ'))
assert(doc.includes('In/download'))
assert(doc.includes('Không claim production realtime'))
assert(doc.includes('F22.3 - Nhân viên/chấm công MVP'))

for (const required of [
  'Báo cáo vận hành cơ sở',
  'Báo cáo ngày',
  'Báo cáo tuần',
  'Công việc ngày',
  'Tình huống/vấn đề xảy ra trong ngày',
  'Doanh thu trong ngày',
  'Biểu đồ cột thu/chi theo tuần',
  'Biểu đồ học/vắng/nghỉ tổng thể cơ sở',
  'In báo cáo',
  'Tải báo cáo',
  'Chưa có đủ dữ liệu điểm danh trong tuần này để tính chính xác học/vắng/nghỉ.',
]) {
  assert(reportModule.includes(required), `Missing report UI wording: ${required}`)
}

assert(reportModule.includes('buildReportData'))
assert(reportModule.includes('buildReportDownloadText'))
assert(reportModule.includes('getReportDownloadFilename'))
assert(styles.includes('.report-bar-chart'))
assert(styles.includes('.report-pie'))
assert(styles.includes('conic-gradient'))
assert(styles.includes('@media print'))

assert(main.includes("from './report-module.js'"))
assert(main.includes("moduleItem.id === 'bao-cao'"))
assert(main.includes('renderReportModule'))
assert(main.includes('buildUnifiedAttendanceRecords'))
assert(main.includes('loadStoredAttendanceRecords()'))
assert(main.includes('buildReportPrintHtml'))
assert(main.includes("window.open('', 'ichess-report-print'"))
assert(main.includes('data-report-action="download"'))
assert(main.includes('new Blob([`\\uFEFF${content}`]'))

assert(modules.includes("id: 'bao-cao'"))
assert(modules.includes('Biểu đồ thu/chi theo tuần'))
assert(modules.includes('Biểu đồ học/vắng/nghỉ tổng thể cơ sở'))

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
  [reportModulePath, reportModule],
  [mainPath, main],
  [modulesPath, modules],
  [stylesPath, styles],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

const changedRuntime = [reportModule, main, modules, styles].join('\n')
assert(!/signUp|Đăng ký|Dang ky/i.test(changedRuntime), 'F22.2 must not add signUp/register')
assert(!/supabase/i.test(reportModule), 'F22.2 report module must not add Supabase runtime')
assert(!/channel\(|on\('postgres_changes'|realtime/i.test(reportModule), 'F22.2 must not add realtime report runtime')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  reportModulePath,
  'src/staff-module.js',
  'src/cloud-bootstrap.js',
  mainPath,
  modulesPath,
  stylesPath,
  'src/inventory-module.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'src/student-detail.js',
  'src/student-tuition-links.js',
  'src/tuition-module.js',
  'docs/f22-feedback-checkpoint-review-before-push.md',
  'tests/f22-6-feedback-checkpoint-review-smoke.js',
  'docs/f22-6-1-manual-qa-polish-before-commit.md',
  'tests/f22-6-1-manual-qa-polish-before-commit-smoke.js',
  'docs/f22-6-2-cloud-400-report-scroll-diagnosis.md',
  'tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js',
  'docs/f22-6-3-report-week-buttons-cloud-status.md',
  'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js',
  'docs/f22-6-4-fix-report-week-navigation-empty-weeks.md',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.2 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.2 must not change SQL files: ${changedPath}`)
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
  [reportModulePath, reportModule],
  [mainPath, main],
  [modulesPath, modules],
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')
runNodeTest('tests/c4-8-no-push-checkpoint-review-smoke.js')
runNodeTest('tests/c4-7-live-qa-tp-shared-cloud-smoke.js')
runNodeTest('tests/c4-6b-manual-sql-apply-pack-smoke.js')
runNodeTest('tests/c4-5-cloud-bootstrap-core-entities-smoke.js')
runNodeTest('tests/c4-4-shared-staging-dataset-29-shell-polish-smoke.js')

console.log('F22.2 bao cao ngay tuan MVP smoke passed')
