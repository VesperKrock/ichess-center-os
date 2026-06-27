import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/nhan-vien-cham-cong-mvp-f22-3.md'
const smokePath = 'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js'
const staffModulePath = 'src/staff-module.js'
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
const staffModule = read(staffModulePath)
const main = read(mainPath)
const modules = read(modulesPath)
const styles = read(stylesPath)

assert(doc.includes('# F22.3 - Nhân viên / Chấm công MVP'))
assert(doc.includes('Feedback anh Hải được xử lý'))
assert(doc.includes('chấm công, tổng buổi, địa điểm dạy'))
assert(doc.includes('không làm payroll hoàn chỉnh'))
assert(doc.includes('F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí'))

for (const required of [
  'Nhân viên / Chấm công',
  'Địa điểm dạy',
  'Tổng buổi',
  'Bảng chấm công',
  'Nhân sự/Giáo viên',
  'Ca/Lớp',
  'Trạng thái',
  'Có mặt',
  'Vắng',
  'Dạy bù',
  'Nghỉ phép',
  'Chưa chấm',
  'Chưa có đủ dữ liệu chấm công/ca dạy trong khoảng thời gian này.',
]) {
  assert(staffModule.includes(required), `Missing staff UI wording: ${required}`)
}

assert(staffModule.includes('buildStaffAttendanceData'))
assert(staffModule.includes('scheduleSessions'))
assert(staffModule.includes('sessionReports'))
assert(staffModule.includes('createTeacherLookup'))
assert(staffModule.includes('getAttendanceStatus'))
assert(staffModule.includes('Tổng buổi theo nhân sự'))
assert(staffModule.includes('Địa điểm dạy đang có'))

assert(main.includes("from './staff-module.js'"))
assert(main.includes("moduleItem.id === 'nhan-vien'"))
assert(main.includes('renderStaffModule'))
assert(main.includes('data-staff-filter'))
assert(modules.includes("id: 'nhan-vien'"))
assert(modules.includes('Bảng chấm công'))
assert(modules.includes('Tổng buổi theo ca dạy'))
assert(styles.includes('.staff-module'))
assert(styles.includes('.staff-table'))
assert(styles.includes('.staff-status'))

const forbiddenPayrollClaims = [
  /Payroll production ready/i,
  /Tính lương hoàn chỉnh/i,
  /Chốt lương tự động/i,
]

for (const pattern of forbiddenPayrollClaims) {
  assert(!staffModule.match(pattern), `Forbidden payroll claim in staff module: ${pattern}`)
}

assert(!staffModule.includes('<th>Lương</th>'))
assert(!staffModule.includes('<th>Phụ cấp'))
assert(!staffModule.includes('<th>Tổng tiền</th>'))

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
  [staffModulePath, staffModule],
  [mainPath, main],
  [modulesPath, modules],
  [stylesPath, styles],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

assert(!/supabase/i.test(staffModule), 'F22.3 must not add Supabase runtime to staff module')
assert(!/channel\(|on\('postgres_changes'|realtime/i.test(staffModule), 'F22.3 must not add realtime runtime')
assert(!/signUp|Đăng ký|Dang ky/i.test(staffModule), 'F22.3 must not add signUp/register runtime')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  staffModulePath,
  mainPath,
  'src/cloud-bootstrap.js',
  modulesPath,
  stylesPath,
  'src/inventory-module.js',
  'src/report-module.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.3 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.3 must not change SQL files: ${changedPath}`)
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
  [staffModulePath, staffModule],
  [mainPath, main],
  [modulesPath, modules],
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')
runNodeTest('tests/c4-8-no-push-checkpoint-review-smoke.js')
runNodeTest('tests/c4-7-live-qa-tp-shared-cloud-smoke.js')
runNodeTest('tests/c4-6b-manual-sql-apply-pack-smoke.js')
runNodeTest('tests/c4-5-cloud-bootstrap-core-entities-smoke.js')

console.log('F22.3 nhan vien cham cong MVP smoke passed')
