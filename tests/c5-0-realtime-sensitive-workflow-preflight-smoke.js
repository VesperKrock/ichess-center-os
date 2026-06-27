import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const docPath = path.join(repoRoot, 'docs', 'c5-0-realtime-sensitive-workflow-preflight.md')
const testPath = path.join(repoRoot, 'tests', 'c5-0-realtime-sensitive-workflow-preflight-smoke.js')

assert(fs.existsSync(docPath), 'Missing C5.0 preflight doc')

const doc = fs.readFileSync(docPath, 'utf8')
const testSource = fs.readFileSync(testPath, 'utf8')

const requiredDocSnippets = [
  'C5.0 là preflight, không runtime.',
  'F22 đã push online alpha',
  'Domain | Current source | Local key/helper | Cloud entity | Realtime status | Risk',
  'Điểm danh',
  'Báo cáo ca dạy',
  'Học phí',
  'TBHP',
  'Audit/conflict/rollback',
  'C5.1 plan',
  'C5.2 plan',
  'C5.3 plan',
  'SQL APPLY: NO',
  'Supabase data change: NO',
  'Known risks',
  'Next recommended phase: C5.1',
  'Rollback / manual QA runbook',
]

requiredDocSnippets.forEach((snippet) => {
  assert(doc.includes(snippet), `C5.0 doc missing required snippet: ${snippet}`)
})

assert(doc.includes('attendance_record'), 'Doc must mention attendance_record entity')
assert(doc.includes('session_report'), 'Doc must mention session_report entity')
assert(doc.includes('tuition_record'), 'Doc must mention tuition_record entity')
assert(doc.includes('tuition_payment'), 'Doc must mention tuition_payment entity')
assert(doc.includes('center_cloud_entities'), 'Doc must mention center_cloud_entities readiness')
assert(doc.includes('không apply SQL'), 'Doc must explicitly avoid SQL apply')
assert(doc.includes('không sửa dữ liệu Supabase'), 'Doc must explicitly avoid Supabase data changes')

const sqlApplyFiles = fs
  .readdirSync(path.join(repoRoot, 'docs'))
  .filter((fileName) => /c5-0/i.test(fileName) && /\.sql$/i.test(fileName))
assert.equal(sqlApplyFiles.length, 0, 'C5.0 must not add a SQL apply file')

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-0-realtime-sensitive-workflow-preflight.md',
  'tests/c5-0-realtime-sensitive-workflow-preflight-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(
    allowedChangedFiles.has(fileName),
    `C5.0 preflight must not change runtime or unrelated files: ${fileName}`,
  )
})

assert(!changedFiles.some((fileName) => /^src\//.test(fileName)), 'C5.0 must not add runtime implementation')
assert(!changedFiles.some((fileName) => /\.sql$/i.test(fileName)), 'C5.0 must not add SQL files')

const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const authSource = fs.readFileSync(path.join(repoRoot, 'src', 'supabase-auth.js'), 'utf8')
const runtimeSources = [mainSource, authSource].join('\n')
assert(!/signUp|Đăng ký/.test(runtimeSources), 'C5.0 must not add signUp/Dang ky runtime')
assert(!/cloud-realtime-attendance|cloud-realtime-tuition/.test(mainSource), 'C5.0 must not wire attendance/tuition realtime runtime')

const existingSubsetTests = [
  'tests/f22-6-4-fix-report-week-navigation-empty-weeks-smoke.js',
  'tests/f22-6-3-report-week-buttons-cloud-status-smoke.js',
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

existingSubsetTests.forEach((fileName) => {
  assert(fs.existsSync(path.join(repoRoot, fileName)), `Missing subset smoke test: ${fileName}`)
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

assert(!mojibakePattern.test(doc), 'C5.0 doc must not contain mojibake')
assert(!mojibakePattern.test(testSource), 'C5.0 smoke must not contain mojibake')

console.log('C5.0 realtime sensitive workflow preflight smoke passed')

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
