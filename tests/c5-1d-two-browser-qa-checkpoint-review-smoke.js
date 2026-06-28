import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'c5-1d-two-browser-qa-checkpoint-review.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1d-two-browser-qa-checkpoint-review-smoke.js')
const c51cSmokePath = path.join(repoRoot, 'tests', 'c5-1c-attendance-session-report-guarded-realtime-smoke.js')
const bridgePath = path.join(repoRoot, 'src', 'cloud-attendance-realtime.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')

for (const filePath of [docPath, smokePath, c51cSmokePath, bridgePath, mainPath]) {
  assert(fs.existsSync(filePath), `Missing C5.1D dependency: ${filePath}`)
}

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')
const bridge = fs.readFileSync(bridgePath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')

for (const snippet of [
  'C5.1D',
  'Backend readiness recap',
  'C5.1B SQL applied manually by user',
  'entity allowlist opened',
  'realtime publication OK',
  'replica identity FULL',
  'helper functions available',
  'Runtime wiring review',
  'Two-browser manual QA checklist',
  'Manual QA result template',
  'Risk / known limitations',
  'Không SQL',
  'Không commit/push',
]) {
  assert(doc.includes(snippet), `C5.1D doc missing: ${snippet}`)
}

for (const entityType of [
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
]) {
  assert(doc.includes(entityType), `C5.1D doc missing entity: ${entityType}`)
  assert(bridge.includes(entityType), `C5.1C bridge missing entity during C5.1D review: ${entityType}`)
}

for (const snippet of [
  'Bootstrap/pull',
  'Realtime subscription',
  'Admin write-through',
  'Teacher/consultant HOLD',
  'updatedAt merge',
  'Soft delete',
  'Duplicate prevention',
  'Conflict marker',
  'Local fallback',
  'Cloud error handling',
  'Học phí/TBHP isolation',
  'usedSessions',
  'remainingSessions',
]) {
  assert(doc.includes(snippet), `C5.1D doc missing QA/review item: ${snippet}`)
}

for (const snippet of [
  'bootstrapC51AttendanceSessionReportCloudData',
  'startC51AttendanceRealtimeSubscription',
  'writeC51AttendanceSessionReportThroughCloud',
  'C51_TEACHER_CONSULTANT_WRITE_HOLD',
  'syncConflict',
  'deleted_at',
]) {
  assert(`${bridge}\n${main}`.includes(snippet), `C5.1D runtime review missing marker: ${snippet}`)
}

assert(!/\busedSessions\b|\bremainingSessions\b|tuition_record_package|tuitionTermPayment|TBHP/.test(bridge), 'C5.1D: bridge must not connect attendance to tuition/TBHP')
assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)|SQL APPLY/i.test(`${bridge}\n${main}`), 'C5.1D: runtime must not apply SQL')
assert(!/signUp|Đăng ký/.test(`${bridge}\n${main}`), 'C5.1D must not add signUp/Dang ky runtime')

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-1a-attendance-session-report-realtime-design-runbook.md',
  'docs/c5-1c-attendance-session-report-guarded-realtime.md',
  'docs/c5-1d-two-browser-qa-checkpoint-review.md',
  'docs/supabase-c5-1b-attendance-session-report-final-apply.sql',
  'docs/supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md',
  'src/cloud-attendance-realtime.js',
  'src/main.js',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
  'tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js',
  'tests/c5-1d-two-browser-qa-checkpoint-review-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(allowedChangedFiles.has(fileName), `Unexpected C5.1D changed file: ${fileName}`)
})

for (const fileName of [
  'tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'tests/c5-0-realtime-sensitive-workflow-preflight-smoke.js',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/c4-8-no-push-checkpoint-review-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-6b-manual-sql-apply-pack-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
  'tests/f19a-student-custom-level-smoke.js',
  'tests/c2-3-angel-wings-restore-smoke.js',
]) {
  assert(fs.existsSync(path.join(repoRoot, fileName)), `Missing previous smoke dependency: ${fileName}`)
}

const mojibakePattern = new RegExp(
  [
    '\\u00c3',
    '\\u00c2',
    '\\u00c4',
    '\\u00c6',
    '\\u00e1\\u00ba',
    '\\u00e1\\u00bb',
    '\\u00e2\\u20ac',
    '\\ufffd',
  ].join('|'),
)

for (const [label, content] of [
  ['doc', doc],
  ['smoke', smoke],
  ['bridge', bridge],
]) {
  assert(!mojibakePattern.test(content), `C5.1D ${label} must not contain mojibake`)
}

console.log('C5.1D two-browser QA checkpoint review smoke passed')

function getChangedFiles() {
  const output = execFileSync('git', ['status', '--short'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  return output
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}
