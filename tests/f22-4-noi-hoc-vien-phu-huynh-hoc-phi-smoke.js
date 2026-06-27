import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md'
const smokePath = 'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js'
const helperPath = 'src/student-tuition-links.js'
const studentDetailPath = 'src/student-detail.js'
const tuitionModulePath = 'src/tuition-module.js'
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
const helper = read(helperPath)
const studentDetail = read(studentDetailPath)
const tuitionModule = read(tuitionModulePath)
const main = read(mainPath)
const styles = read(stylesPath)

assert(doc.includes('# F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí'))
assert(doc.includes('Feedback anh Hải được xử lý'))
assert(doc.includes('Liên kết phụ huynh & học phí'))
assert(doc.includes('Chưa có thông tin phụ huynh/người liên hệ.'))
assert(doc.includes('Chưa có dữ liệu học phí liên kết cho học viên này.'))
assert(doc.includes('Không SQL, không migration, không Supabase data change'))
assert(doc.includes('Không thêm cloud/realtime mới'))
assert(doc.includes('Không commit/push'))

for (const required of [
  'buildStudentTuitionLink',
  'buildStudentCareWarnings',
  'studentId',
  'parentName',
  'primaryPhone',
  'fatherPhone',
  'motherPhone',
  'debtAmount',
  'remainingSessions',
  'Thiếu SĐT phụ huynh',
  'Thiếu tên phụ huynh/người chăm sóc',
  'Chưa có dữ liệu học phí',
  'Cần kiểm tra học phí',
  'Sắp hết buổi học',
  'Chưa phân lớp',
  'Thiếu giáo viên phụ trách',
  'Có ghi chú cần chăm sóc',
]) {
  assert(helper.includes(required), `Missing helper wording/logic: ${required}`)
}

for (const required of [
  'Liên kết phụ huynh & học phí',
  'Phụ huynh/người chăm sóc',
  'Số liên hệ chính',
  'Trạng thái học viên',
  'Tổng quan học phí',
  'Cảnh báo chăm sóc',
  'Chưa có thông tin phụ huynh/người liên hệ.',
  'Chưa có dữ liệu học phí liên kết cho học viên này.',
  'renderStudentDetail(student, teachers = [], classSessions = [], tuitionRecords = [])',
]) {
  assert(studentDetail.includes(required), `Missing student detail UI: ${required}`)
}

assert(main.includes('renderStudentDetail(student, teachers, classSessions, tuitionRecords)'))
assert(tuitionModule.includes("from './student-tuition-links.js'"))
assert(tuitionModule.includes('familyTuitionLink'))
assert(tuitionModule.includes('renderTuitionFamilyLink'))
assert(tuitionModule.includes('renderTuitionCareBadges'))
assert(tuitionModule.includes('Học viên & phụ huynh'))
assert(tuitionModule.includes('Chưa có thông tin phụ huynh/người liên hệ.'))
assert(tuitionModule.includes('${student.fatherPhone} ${student.motherPhone}'))
assert(styles.includes('.student-link-warning-list'))
assert(styles.includes('.tuition-family-link'))
assert(styles.includes('.tuition-care-badges'))

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
  [helperPath, helper],
  [studentDetailPath, studentDetail],
  [tuitionModulePath, tuitionModule],
  [mainPath, main],
  [stylesPath, styles],
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

const changedRuntime = [helper, studentDetail, tuitionModule, styles].join('\n')
assert(!/supabase/i.test(changedRuntime), 'F22.4 must not add Supabase runtime')
assert(!/channel\(|on\('postgres_changes'|realtime/i.test(changedRuntime), 'F22.4 must not add realtime runtime')
assert(!/signUp|Dang ky/i.test(changedRuntime), 'F22.4 must not add signUp/register runtime')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  helperPath,
  studentDetailPath,
  tuitionModulePath,
  mainPath,
  'src/cloud-bootstrap.js',
  stylesPath,
  'src/inventory-module.js',
  'src/modules.js',
  'src/report-module.js',
  'src/staff-module.js',
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'docs/kho-hang-quick-polish-f22-1.md',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'docs/bao-cao-ngay-tuan-mvp-f22-2.md',
  'docs/nhan-vien-cham-cong-mvp-f22-3.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.4 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.4 must not change SQL files: ${changedPath}`)
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
  [helperPath, helper],
  [studentDetailPath, studentDetail],
  [tuitionModulePath, tuitionModule],
  [mainPath, main],
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')
runNodeTest('tests/c4-8-no-push-checkpoint-review-smoke.js')
runNodeTest('tests/c4-7-live-qa-tp-shared-cloud-smoke.js')
runNodeTest('tests/c4-6b-manual-sql-apply-pack-smoke.js')
runNodeTest('tests/c4-5-cloud-bootstrap-core-entities-smoke.js')

console.log('F22.4 noi hoc vien phu huynh hoc phi smoke passed')
