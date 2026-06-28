import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md')
const sqlPath = path.join(repoRoot, 'docs', 'supabase-c5-1b-attendance-session-report-final-apply.sql')
const smokePath = path.join(repoRoot, 'tests', 'c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js')

assert(fs.existsSync(docPath), 'Missing C5.1B manual SQL apply pack doc')
assert(fs.existsSync(sqlPath), 'Missing C5.1B final apply SQL draft')
assert(fs.existsSync(smokePath), 'Missing C5.1B smoke test')

const doc = fs.readFileSync(docPath, 'utf8')
const sql = fs.readFileSync(sqlPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')

for (const marker of [
  'SQL APPLY: NO',
  'WAITING USER CONFIRMATION BEFORE APPLYING SQL',
  'SUPABASE DATA CHANGE: NO',
  'RUNTIME IMPLEMENTATION: NO',
]) {
  assert(doc.includes(marker), `C5.1B doc missing marker: ${marker}`)
}

for (const marker of [
  '-- C5.1B Attendance / Session Report Manual SQL Apply Pack',
  '-- SQL APPLY: NO in CodeX',
  '-- WAITING USER CONFIRMATION BEFORE APPLYING SQL',
  '-- Data destructive: intended NO.',
  '-- Backup recommended: YES',
]) {
  assert(sql.includes(marker), `C5.1B SQL missing safety marker: ${marker}`)
}

for (const entityType of [
  'student',
  'teacher',
  'class_session',
  'schedule_session',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
]) {
  assert(doc.includes(entityType), `C5.1B doc missing entity type: ${entityType}`)
  assert(sql.includes(`'${entityType}'`), `C5.1B SQL allowlist missing entity type: ${entityType}`)
}

for (const snippet of [
  'select count(*) as center_cloud_entities_total',
  'from public.center_cloud_entities',
  'from pg_constraint',
  'center_cloud_entities_entity_type_check',
  'from pg_publication_tables',
  'from pg_class',
  'from pg_policies',
]) {
  assert(sql.includes(snippet), `C5.1B SQL missing preflight/verification snippet: ${snippet}`)
}

for (const snippet of [
  'add constraint center_cloud_entities_entity_type_check',
  'supabase_realtime',
  'alter publication supabase_realtime add table public.center_cloud_entities',
  'alter table public.center_cloud_entities replica identity full',
  'POST-APPLY VERIFICATION',
  'ROLLBACK NOTES',
]) {
  assert(sql.includes(snippet), `C5.1B SQL missing manual pack section: ${snippet}`)
}

for (const snippet of [
  'teacher/consultant direct write policy: HOLD / needs approval',
  'admin/center_admin write',
  'Latest-wins không đủ',
  'C5.1B-Apply - User manually applies SQL after review',
  'C5.1C - Runtime guarded realtime implementation after backend readiness is confirmed',
]) {
  assert(doc.includes(snippet), `C5.1B doc missing policy/risk/next-step note: ${snippet}`)
}

const activeSql = sql
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

assert(!/\b(drop\s+table|truncate|delete\s+from)\b/i.test(activeSql), 'C5.1B SQL must not include active destructive drop table/truncate/delete')
assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)/i.test(`${doc}\n${sql}\n${smoke}`), 'C5.1B must not include SQL apply CLI commands')

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-1a-attendance-session-report-realtime-design-runbook.md',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'docs/supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md',
  'docs/supabase-c5-1b-attendance-session-report-final-apply.sql',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(allowedChangedFiles.has(fileName), `C5.1B must not change runtime or unrelated files: ${fileName}`)
})

assert(!changedFiles.some((fileName) => /^src\//.test(fileName)), 'C5.1B must not modify runtime source')

for (const fileName of [
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

assert(!mojibakePattern.test(doc), 'C5.1B doc must not contain mojibake')
assert(!mojibakePattern.test(sql), 'C5.1B SQL must not contain mojibake')
assert(!mojibakePattern.test(smoke), 'C5.1B smoke must not contain mojibake')

console.log('C5.1B attendance/session report manual SQL apply pack smoke passed')

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
