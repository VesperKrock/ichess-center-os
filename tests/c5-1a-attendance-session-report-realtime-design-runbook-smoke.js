import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const docPath = path.join(repoRoot, 'docs', 'c5-1a-attendance-session-report-realtime-design-runbook.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1a-attendance-session-report-realtime-design-runbook-smoke.js')

assert(fs.existsSync(docPath), 'Missing C5.1A design runbook doc')

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const authSource = fs.readFileSync(path.join(repoRoot, 'src', 'supabase-auth.js'), 'utf8')

const requiredDocSnippets = [
  'C5.1A là phase thiết kế chi tiết và runbook thủ công',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'Read path',
  'Write path',
  'Realtime design',
  'Conflict',
  'soft delete',
  'Duplicate prevention',
  'SQL/Supabase readiness',
  'SQL APPLY: NO',
  'WAITING USER CONFIRMATION BEFORE APPLYING SQL',
  'C5.1B plan',
  'C5.1C plan',
  'Manual QA plan',
  'Scope safety',
  'C5.1B - Manual SQL apply pack / backend readiness, if user approves',
]

requiredDocSnippets.forEach((snippet) => {
  assert(doc.includes(snippet), `C5.1A doc missing required snippet: ${snippet}`)
})

for (const required of [
  'center_cloud_entities_entity_type_check',
  'RLS policies',
  'supabase_realtime',
  'REPLICA IDENTITY FULL',
  'teacher_report',
  'admin',
  'consultant',
  'baseline',
  'imported',
  'system_adapter',
  'No attendance -> tuition automation',
]) {
  assert(doc.includes(required), `C5.1A doc missing design detail: ${required}`)
}

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-1a-attendance-session-report-realtime-design-runbook.md',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(
    allowedChangedFiles.has(fileName),
    `C5.1A must not change runtime or unrelated files: ${fileName}`,
  )
})

assert(!changedFiles.some((fileName) => /^src\//.test(fileName)), 'C5.1A must not add runtime implementation')
assert(!changedFiles.some((fileName) => /\.sql$/i.test(fileName)), 'C5.1A must not add SQL apply files')
assert(!/cloud-realtime-attendance|cloud-realtime-session-report|cloud-realtime-session-reports/.test(mainSource), 'C5.1A must not wire attendance/session report realtime runtime')
assert(!/signUp|Đăng ký/.test(`${mainSource}\n${authSource}`), 'C5.1A must not add signUp/Dang ky runtime')

const docsDir = fs.readdirSync(path.join(repoRoot, 'docs'))
const c51SqlFiles = docsDir.filter((fileName) => /c5-1a|c5-1/i.test(fileName) && /\.sql$/i.test(fileName))
assert.equal(c51SqlFiles.length, 0, 'C5.1A must not add SQL files')

const previousSmokeFiles = [
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
]

previousSmokeFiles.forEach((fileName) => {
  assert(fs.existsSync(path.join(repoRoot, fileName)), `Missing previous smoke dependency: ${fileName}`)
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

assert(!mojibakePattern.test(doc), 'C5.1A doc must not contain mojibake')
assert(!mojibakePattern.test(smoke), 'C5.1A smoke must not contain mojibake')

console.log('C5.1A attendance/session report realtime design runbook smoke passed')

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
