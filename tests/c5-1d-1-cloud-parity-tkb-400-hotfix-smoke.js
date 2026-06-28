import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'c5-1d-1-cloud-parity-tkb-400-hotfix.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1d-1-cloud-parity-tkb-400-hotfix-smoke.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const cloudDbSyncPath = path.join(repoRoot, 'src', 'cloud-db-sync.js')
const scheduleRealtimePath = path.join(repoRoot, 'src', 'cloud-realtime-schedule-sessions.js')
const c51BridgePath = path.join(repoRoot, 'src', 'cloud-attendance-realtime.js')

for (const filePath of [docPath, smokePath, mainPath, cloudDbSyncPath, scheduleRealtimePath, c51BridgePath]) {
  assert(fs.existsSync(filePath), `Missing C5.1D.1 dependency: ${filePath}`)
}

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')
const cloudDbSync = fs.readFileSync(cloudDbSyncPath, 'utf8')
const scheduleRealtime = fs.readFileSync(scheduleRealtimePath, 'utf8')
const c51Bridge = fs.readFileSync(c51BridgePath, 'utf8')

for (const snippet of [
  'C5.1D.1',
  'TKB mismatch',
  'Supabase 400',
  'seed/local cũ 6 ca',
  'Angel Wings 8 ca',
  'Root cause',
  'Fix applied',
  'schedule_session',
  'cloud schedule_session trống',
  'No SQL',
  'No C5.2',
  'No attendance backfill',
  'No all-module sync',
  'No commit/push',
  'C5.1D manual QA retry',
]) {
  assert(doc.includes(snippet), `C5.1D.1 doc missing: ${snippet}`)
}

for (const snippet of [
  'membershipSqlReady: true',
  'scheduleSessionSqlReady: true',
  'realtimeReady: true',
  'cloud schedule_session trống; TKB dùng local fallback',
  'hasCloudScheduleSessions',
  'applyCloudBootstrapSnapshotToLocal(result.data)',
  'startScheduleSessionRealtimeSubscription',
  'writeScheduleSessionThroughCloud',
]) {
  assert(main.includes(snippet), `C5.1D.1 main hotfix missing: ${snippet}`)
}

assert(scheduleRealtime.includes('subscribeToScheduleSessionCloudRealtime'), 'Schedule realtime helper must remain intact')
assert(scheduleRealtime.includes("table: 'center_cloud_entities'"), 'Schedule realtime must still use center_cloud_entities')
assert(scheduleRealtime.includes('mergeScheduleSessionRealtimePayload'), 'Schedule realtime merge must remain intact')
assert(c51Bridge.includes('subscribeToC51AttendanceSessionReportRealtime'), 'C5.1 attendance realtime must remain intact')

const centerCloudEntityQueries = `${cloudDbSync}\n${c51Bridge}\n${scheduleRealtime}`
assert(!/from\('center_cloud_entities'\)[\s\S]{0,300}\.order\('name'/.test(centerCloudEntityQueries), 'center_cloud_entities must not order by invalid field name')
assert(!/from\('center_cloud_entities'\)[\s\S]{0,300}\.order\('created_at'/.test(centerCloudEntityQueries), 'center_cloud_entities must not order by created_at in C5.1D.1 hotfix')
assert(centerCloudEntityQueries.includes(".order('updated_at'"), 'center_cloud_entities queries should use updated_at ordering')

assert(!/\busedSessions\b|\bremainingSessions\b|tuition_record_package|tuitionTermPayment|TBHP/.test(c51Bridge), 'C5.1D.1 must not connect attendance to tuition/TBHP')
assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)|SQL APPLY/i.test(`${main}\n${cloudDbSync}\n${scheduleRealtime}\n${c51Bridge}`), 'C5.1D.1 runtime must not apply SQL')
assert(!/signUp|Đăng ký/.test(`${main}\n${cloudDbSync}\n${scheduleRealtime}\n${c51Bridge}`), 'C5.1D.1 must not add signUp/Dang ky runtime')

const changedFiles = getChangedFiles()
const allowedChangedFiles = new Set([
  'docs/c5-1a-attendance-session-report-realtime-design-runbook.md',
  'docs/c5-1c-attendance-session-report-guarded-realtime.md',
  'docs/c5-1d-1-cloud-parity-tkb-400-hotfix.md',
  'docs/c5-1d-two-browser-qa-checkpoint-review.md',
  'docs/supabase-c5-1b-attendance-session-report-final-apply.sql',
  'docs/supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md',
  'src/cloud-attendance-realtime.js',
  'src/main.js',
  'tests/c5-1a-attendance-session-report-realtime-design-runbook-smoke.js',
  'tests/c5-1b-attendance-session-report-manual-sql-apply-pack-smoke.js',
  'tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js',
  'tests/c5-1d-1-cloud-parity-tkb-400-hotfix-smoke.js',
  'tests/c5-1d-two-browser-qa-checkpoint-review-smoke.js',
])

changedFiles.forEach((fileName) => {
  assert(allowedChangedFiles.has(fileName), `Unexpected C5.1D.1 changed file: ${fileName}`)
})

for (const fileName of [
  'tests/c5-1d-two-browser-qa-checkpoint-review-smoke.js',
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
  'tests/c3-4c-schedule-session-realtime-guarded-runtime-smoke.js',
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
  ['main', main],
  ['cloudDbSync', cloudDbSync],
  ['scheduleRealtime', scheduleRealtime],
  ['c51Bridge', c51Bridge],
]) {
  assert(!mojibakePattern.test(content), `C5.1D.1 ${label} must not contain mojibake`)
}

console.log('C5.1D.1 cloud parity TKB and 400 hotfix smoke passed')

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
