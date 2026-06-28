import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'c5-1e-attendance-session-report-checkpoint-review.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1e-attendance-session-report-checkpoint-review-smoke.js')

for (const filePath of [docPath, smokePath]) {
  assert(fs.existsSync(filePath), `Missing C5.1E artifact: ${filePath}`)
}

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')

for (const snippet of [
  'C5.1E',
  'Attendance / Session Report Checkpoint Review',
  'C5.1A',
  'C5.1B',
  'C5.1B-Apply',
  'C5.1C',
  'C5.1D',
  'C5.1D.1',
  'C5.1D.2',
  'C5.1D.3',
  'Backend Readiness Status',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'schedule_session',
  'upserted: 8',
  'Angel Wings 8 ca',
  'Runtime Status',
  'Manual QA Status',
  'teacher/consultant',
  'HOLD',
  'Học phí/TBHP',
  'Known Limitations',
  'GO for C5.2 planning/preflight',
  'C5.2A - Học phí / TBHP cloud source of truth preflight + design',
  'No SQL',
  'no runtime implementation',
  'no commit/push',
]) {
  assert(doc.includes(snippet), `C5.1E doc missing: ${snippet}`)
}

assert(doc.includes('Supabase realtime publication'), 'Doc must mention realtime publication')
assert(doc.includes('Replica identity: FULL'), 'Doc must mention replica identity FULL')
assert(doc.includes('can_write_center') && doc.includes('is_center_member'), 'Doc must mention helper functions')
assert(doc.includes('Taskbar shows `Dữ liệu: Cloud`'), 'Doc must record taskbar Cloud manual QA')
assert(doc.includes('Console 400'), 'Doc must record console 400 known status')
assert(doc.includes('NOT FULLY TESTED'), 'Doc must avoid overclaiming incomplete manual QA')
assert(doc.includes('Online alpha does not include C5.1 until commit/push/deploy'), 'Doc must mention deploy limitation')

for (const fileName of [
  'tests/c5-1d-3-fix-schedule-backfill-c2-scope-guard-smoke.js',
  'tests/c5-1d-2-schedule-session-cloud-backfill-parity-smoke.js',
  'tests/c5-1d-1-cloud-parity-tkb-400-hotfix-smoke.js',
  'tests/c5-1d-two-browser-qa-checkpoint-review-smoke.js',
  'tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'tests/c5-0-realtime-sensitive-workflow-preflight-smoke.js',
  'tests/c3-4c-schedule-session-realtime-guarded-runtime-smoke.js',
  'tests/c4-8-no-push-checkpoint-review-smoke.js',
  'tests/c4-7-live-qa-tp-shared-cloud-smoke.js',
  'tests/c4-6b-manual-sql-apply-pack-smoke.js',
  'tests/c4-5-cloud-bootstrap-core-entities-smoke.js',
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js',
  'tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js',
  'tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js',
  'tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js',
  'tests/f22-0-feedback-triage-scope-lock-smoke.js',
  'tests/f19a-student-custom-level-smoke.js',
  'tests/c2-3-angel-wings-restore-smoke.js',
]) {
  assert(fs.existsSync(path.join(repoRoot, fileName)), `Missing smoke dependency: ${fileName}`)
}

assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)|SQL APPLY:\s*YES/i.test(doc), 'C5.1E must not apply SQL')
assert(!/implemented C5\.2|C5\.2 implementation complete|C5\.2 runtime complete/i.test(doc), 'C5.1E must not implement C5.2')
assert(!/git\s+(commit|push)|force push/i.test(doc), 'C5.1E doc must not instruct commit/push')
assert(!/auth\.signUp|function\s+signUp|signUpWith/i.test(doc), 'C5.1E must not add signUp runtime')

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-1a-attendance-session-report-realtime-design-runbook.md',
  'docs/c5-1c-attendance-session-report-guarded-realtime.md',
  'docs/c5-1d-1-cloud-parity-tkb-400-hotfix.md',
  'docs/c5-1d-2-schedule-session-cloud-backfill-parity.md',
  'docs/c5-1d-3-fix-schedule-backfill-c2-scope-guard.md',
  'docs/c5-1d-two-browser-qa-checkpoint-review.md',
  'docs/c5-1e-attendance-session-report-checkpoint-review.md',
  'docs/supabase-c5-1b-attendance-session-report-final-apply.sql',
  'docs/supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md',
  'src/cloud-attendance-realtime.js',
  'src/cloud-schedule-session-backfill.js',
  'src/main.js',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
  'tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js',
  'tests/c5-1d-1-cloud-parity-tkb-400-hotfix-smoke.js',
  'tests/c5-1d-2-schedule-session-cloud-backfill-parity-smoke.js',
  'tests/c5-1d-3-fix-schedule-backfill-c2-scope-guard-smoke.js',
  'tests/c5-1d-two-browser-qa-checkpoint-review-smoke.js',
  'tests/c5-1e-attendance-session-report-checkpoint-review-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(allowedChangedFiles.has(fileName), `Unexpected C5.1E changed file: ${fileName}`)
})

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
]) {
  assert(!mojibakePattern.test(content), `C5.1E ${label} must not contain mojibake`)
}

console.log('C5.1E attendance/session report checkpoint review smoke passed')

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
