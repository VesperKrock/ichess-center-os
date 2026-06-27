import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/kho-hang-unit-creatable-combobox-f22-1-1.md'
const smokePath = 'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js'
const inventoryModulePath = 'src/inventory-module.js'
const stylesPath = 'src/styles.css'
const reportModulePath = 'src/report-module.js'

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
const styles = read(stylesPath)
const reportModule = read(reportModulePath)

assert(doc.includes('# F22.1.1 - Kho hàng Đơn vị tính Creatable Combobox'))
assert(doc.includes('select cứng'))
assert(doc.includes('input + datalist'))
assert(doc.includes('Cấp độ học'))
assert(doc.includes('Preserve unit cũ'))
assert(doc.includes('Không sửa Báo cáo F22.2'))
assert(doc.includes('F22.3 - Nhân viên/chấm công MVP'))

assert(inventoryModule.includes('function renderInventoryUnitField(formState, units)'))
assert(inventoryModule.includes('type="text"'))
assert(inventoryModule.includes('list="inventory-unit-options"'))
assert(inventoryModule.includes('<datalist id="inventory-unit-options">'))
assert(inventoryModule.includes('data-inventory-form-field="unit"'))
assert(inventoryModule.includes('placeholder="Chọn hoặc gõ đơn vị mới"'))
assert(!inventoryModule.includes("renderInventorySelectField('Đơn vị tính', 'unit', formState, units)"))

for (const unit of [
  "'Cái'",
  "'Chiếc'",
  "'Bộ'",
  "'Quyển'",
  "'Hộp'",
  "'Gói'",
  "'Thùng'",
  "'Đôi'",
  "'Cuốn'",
  "'Kg'",
  "'Lít'",
  "'Mét'",
  "'Buổi'",
  "'Khác'",
]) {
  assert(inventoryModule.includes(unit), `Missing suggested unit ${unit}`)
}

assert(inventoryModule.includes('function getInventoryFormUnits(items = [], currentUnit = \'\')'))
assert(!inventoryModule.includes("const unit = String(item?.unit ?? '').trim()"))
assert(!inventoryModule.includes('units.add(unit)'))
assert(inventoryModule.includes('units.add(String(currentUnit).trim())'))
assert(inventoryModule.includes("unit: String(values.unit ?? '').trim()"))
assert(!reportModule.includes('F22.1.1'), 'F22.1.1 must not edit report module content')

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
  [stylesPath, styles],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

assert(!/supabase/i.test(inventoryModule), 'Hotfix must not add Supabase runtime to inventory module')
assert(!/signUp|Đăng ký|Dang ky/i.test(inventoryModule), 'Hotfix must not add signUp/register runtime')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  inventoryModulePath,
  stylesPath,
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'src/main.js',
  'src/cloud-bootstrap.js',
  'src/modules.js',
  'src/report-module.js',
  'src/staff-module.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.1.1 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.1.1 must not change SQL files: ${changedPath}`)
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
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')

console.log('F22.1.1 kho hang unit creatable combobox smoke passed')
