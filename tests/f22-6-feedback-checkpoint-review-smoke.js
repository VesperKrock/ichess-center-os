import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docPath = 'docs/f22-feedback-checkpoint-review-before-push.md'
const smokePath = 'tests/f22-6-feedback-checkpoint-review-smoke.js'

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

assert(doc.includes('# F22.6 - Checkpoint Review Before Push Decision'))
assert(doc.includes('F22.6 là checkpoint review'))
assert(doc.includes('C4 commit: dc43dbb C4 shared cloud login and realtime MVP'))

for (const phase of [
  'F22.0 - Feedback triage + scope lock',
  'F22.1 - Kho hàng quick polish',
  'F22.1.1 - Unit creatable combobox',
  'F22.2 - Báo cáo ngày/tuần MVP',
  'F22.3 - Nhân viên/chấm công MVP',
  'F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí',
  'F22.5 - UI/icon/background polish',
]) {
  assert(doc.includes(phase), `Missing phase summary: ${phase}`)
}

for (const required of [
  'PASS, chưa commit',
  'HOÃN',
  'chờ designer/asset',
  'Manual QA Checklist',
  'Kho hàng',
  'Báo cáo',
  'Nhân viên',
  'Học viên ↔ Phụ huynh ↔ Học phí',
  'Regression',
  'Known Issues / Risks',
  'Scroll retention/tab order Học viên từ C4 vẫn là UX debt',
  'Báo cáo chưa realtime production',
  'Học phí chưa cloud source of truth',
  'Nhân viên chưa payroll hoàn chỉnh',
  'Kho chưa realtime/cloud',
  'Legacy policies Supabase cần audit trước C5',
  'schedule_session',
  'Ready for local commit F22 checkpoint: YES, after user confirmation.',
  'Ready for push: CONDITIONAL, after manual QA browser pass and user approval.',
  'Suggested commit message: F22 feedback modules and data links MVP',
  'Next phase: F22.7 Commit local F22 checkpoint',
  'Runtime mới trong F22.6: NO',
  'SQL: NOT RUN, NOT ADDED',
  'Supabase data change: NO',
  'C5/C6: NOT STARTED',
  'Commit/push: NOT DONE',
  'Đăng ký/signUp: NOT ADDED',
]) {
  assert(doc.includes(required), `Missing checkpoint wording: ${required}`)
}

for (const artifact of [
  'docs/feedback-anh-hai-22-06-triage-f22-0.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'docs/kho-hang-quick-polish-f22-1.md',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'docs/kho-hang-unit-creatable-combobox-f22-1-1.md',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'src/report-module.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'src/staff-module.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'src/student-tuition-links.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
]) {
  assert(doc.includes(artifact), `Missing artifact reference: ${artifact}`)
}

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
]) {
  for (const pattern of forbiddenSqlPatterns) {
    assert(!pattern.test(source), `${label} must not contain SQL pattern ${pattern}`)
  }
}

assert(!/C5 implemented|C6 implemented|Teacher Portal MVP|Super Admin implemented/i.test(doc))
assert(!/signUp\(/i.test(doc + smoke), 'F22.6 must not add signUp runtime wording')

const status = execFileSync('git', ['status', '--short'], {
  cwd: repoRoot,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  docPath,
  smokePath,
  'src/inventory-module.js',
  'src/main.js',
  'src/cloud-bootstrap.js',
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
  'docs/f22-6-2-cloud-400-report-scroll-diagnosis.md',
  'docs/f22-6-3-report-week-buttons-cloud-status.md',
  'docs/f22-6-4-fix-report-week-navigation-empty-weeks.md',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f22-1-kho-hang-quick-polish-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'docs/f22-6-1-manual-qa-polish-before-commit.md',
  'tests/f22-6-1-manual-qa-polish-before-commit-smoke.js',
  'tests/f22-6-2-cloud-400-report-scroll-diagnosis-smoke.js',
  'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in F22.6 checkpoint scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `F22.6 must not change SQL files: ${changedPath}`)
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
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

runNodeTest('tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js')
runNodeTest('tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js')
runNodeTest('tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js')
runNodeTest('tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js')
runNodeTest('tests/f22-1-kho-hang-quick-polish-smoke.js')
runNodeTest('tests/f22-0-feedback-triage-scope-lock-smoke.js')
runNodeTest('tests/c4-8-no-push-checkpoint-review-smoke.js')
runNodeTest('tests/c4-7-live-qa-tp-shared-cloud-smoke.js')
runNodeTest('tests/c4-6b-manual-sql-apply-pack-smoke.js')
runNodeTest('tests/c4-5-cloud-bootstrap-core-entities-smoke.js')
runNodeTest('tests/f19a-student-custom-level-smoke.js')
runNodeTest('tests/c2-3-angel-wings-restore-smoke.js')

console.log('F22.6 feedback checkpoint review smoke passed')
