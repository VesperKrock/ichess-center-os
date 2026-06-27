import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/kho-hang-quick-polish-f22-1.md'
const smokePath = 'tests/f22-1-kho-hang-quick-polish-smoke.js'
const inventoryModulePath = 'src/inventory-module.js'
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
const styles = read(stylesPath)

assert(doc.includes('# F22.1 - Kho hàng Quick Polish'))
assert(doc.includes('Feedback anh Hải được xử lý'))
assert(doc.includes('Đơn vị tính combobox'))
assert(doc.includes('Không realtime kho'))
assert(doc.includes('Không cảnh báo cấp sách/áo'))
assert(doc.includes('Không làm Báo cáo F22.2'))
assert(doc.includes('Không làm Nhân viên/chấm công F22.3'))
assert(doc.includes('Không làm Học phí/nối dây'))
assert(doc.includes('Không xóa localStorage'))
assert(doc.includes('Đơn vị tính cũ được preserve'))
assert(doc.includes('F22.2 - Báo cáo ngày/tuần MVP'))

assert(inventoryModule.includes('Thêm sản phẩm'))
assert(inventoryModule.includes('Lưu sản phẩm'))
assert(inventoryModule.includes('Tên vật tư / tài sản / sản phẩm'))
assert(inventoryModule.includes('Tìm vật tư/tài sản/sản phẩm theo tên, nhóm, mã, vị trí'))
assert(inventoryModule.includes('Không tìm thấy vật tư/tài sản/sản phẩm phù hợp.'))

assert(inventoryModule.includes('const inventoryUnitOptions = ['))
assert(inventoryModule.includes("'Cái'"))
assert(inventoryModule.includes("'Chiếc'"))
assert(inventoryModule.includes("'Bộ'"))
assert(inventoryModule.includes("'Quyển'"))
assert(inventoryModule.includes("'Hộp'"))
assert(inventoryModule.includes("'Gói'"))
assert(inventoryModule.includes("'Thùng'"))
assert(inventoryModule.includes("'Đôi'"))
assert(inventoryModule.includes("'Kg'"))
assert(inventoryModule.includes("'Lít'"))
assert(inventoryModule.includes("'Mét'"))
assert(inventoryModule.includes("'Buổi'"))
assert(inventoryModule.includes("'Khác'"))

assert(inventoryModule.includes('function renderInventoryUnitField(formState, units)'))
assert(inventoryModule.includes('list="inventory-unit-options"'))
assert(inventoryModule.includes('data-inventory-form-field="unit"'))
assert(inventoryModule.includes('<datalist id="inventory-unit-options">'))
assert(!inventoryModule.includes("renderInventorySelectField('Đơn vị tính', 'unit', formState, units)"))
assert(inventoryModule.includes('function getInventoryFormUnits(items = [], currentUnit = \'\')'))
assert(inventoryModule.includes('units.add(String(currentUnit).trim())'))
assert(inventoryModule.includes('[item.id, item.name, item.category, item.location, item.note, item.condition]'))

assert(styles.includes('.inventory-item-form-panel'))
assert(styles.includes('.inventory-empty .inventory-add-button'))

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

assert(!/supabase/i.test(inventoryModule), 'F22.1 must not add Supabase runtime to inventory module')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  inventoryModulePath,
  stylesPath,
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'src/report-module.js',
  'src/staff-module.js',
  'src/main.js',
  'src/cloud-bootstrap.js',
  'src/modules.js',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.1 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.1 must not change SQL files: ${changedPath}`)
  if (!/f22-2|f22-1-1|f22-3|f22-4|f22-6|f22-6-1|report-module|staff-module|student-detail|student-tuition-links|tuition-module|main\.js|modules\.js/i.test(changedPath)) {
    assert(!/report|bao-cao|teacher|nhan-vien|tuition|hoc-phi/i.test(changedPath), `F22.1 touched out-of-scope module: ${changedPath}`)
  }
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

runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')
runNodeTest('tests/c4-8-no-push-checkpoint-review-smoke.js')
runNodeTest('tests/c4-7-live-qa-tp-shared-cloud-smoke.js')
runNodeTest('tests/c4-6b-manual-sql-apply-pack-smoke.js')
runNodeTest('tests/c4-5-cloud-bootstrap-core-entities-smoke.js')
runNodeTest('tests/c4-4-shared-staging-dataset-29-shell-polish-smoke.js')

console.log('F22.1 kho hang quick polish smoke passed')
