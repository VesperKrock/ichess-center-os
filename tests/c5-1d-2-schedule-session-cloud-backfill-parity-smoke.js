import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'c5-1d-2-schedule-session-cloud-backfill-parity.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1d-2-schedule-session-cloud-backfill-parity-smoke.js')
const backfillPath = path.join(repoRoot, 'src', 'cloud-schedule-session-backfill.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const scheduleSessionsPath = path.join(repoRoot, 'src', 'cloud-schedule-sessions.js')
const scheduleBridgePath = path.join(repoRoot, 'src', 'cloud-schedule-session-bridge.js')
const scheduleRealtimePath = path.join(repoRoot, 'src', 'cloud-realtime-schedule-sessions.js')
const storagePath = path.join(repoRoot, 'src', 'storage.js')
const scheduleModulePath = path.join(repoRoot, 'src', 'schedule-module.js')

for (const filePath of [
  docPath,
  smokePath,
  backfillPath,
  mainPath,
  scheduleSessionsPath,
  scheduleBridgePath,
  scheduleRealtimePath,
  storagePath,
  scheduleModulePath,
]) {
  assert(fs.existsSync(filePath), `Missing C5.1D.2 file/dependency: ${filePath}`)
}

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')
const backfill = fs.readFileSync(backfillPath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')
const scheduleSessions = fs.readFileSync(scheduleSessionsPath, 'utf8')
const scheduleBridge = fs.readFileSync(scheduleBridgePath, 'utf8')
const scheduleRealtime = fs.readFileSync(scheduleRealtimePath, 'utf8')
const storage = fs.readFileSync(storagePath, 'utf8')
const scheduleModule = fs.readFileSync(scheduleModulePath, 'utf8')

for (const snippet of [
  'C5.1D.2',
  'Schedule Session Cloud Backfill',
  'Browser T',
  'Angel Wings 8 ca',
  'seed cũ 6 ca',
  'cloud `schedule_session` đang trống',
  'Manual only',
  'dryRun: true',
  'confirm: "BACKFILL_SCHEDULE_SESSION"',
  'owner',
  'qtv',
  'center_admin',
  'admin',
  'teacher/consultant/viewer',
  'centerId',
  'center_id',
  'No SQL',
  'No C5.2',
  'No all-module sync',
  'No commit/push',
  'Reload browser T và browser L/P',
  'C5.1D manual QA retry after schedule_session backfill',
]) {
  assert(doc.includes(snippet), `C5.1D.2 doc missing: ${snippet}`)
}

for (const snippet of [
  'backfillLocalScheduleSessionsToCloud',
  'SCHEDULE_SESSION_BACKFILL_CONFIRM_TOKEN',
  'BACKFILL_SCHEDULE_SESSION',
  'dryRun = true',
  'ADMIN_BACKFILL_ROLES',
  "'owner'",
  "'qtv'",
  "'center_admin'",
  "'admin'",
  'centerId',
  'center_id',
  'SCHEDULE_SESSION_CLOUD_ENTITY_TYPE',
  "from('center_cloud_entities')",
  '.upsert(',
  "onConflict: 'center_id,entity_type,local_id'",
  'wouldUpsert',
  'wouldOverwrite',
  'wouldSkipCloudNewer',
  'overwrite',
  'Angel Wings',
]) {
  assert(backfill.includes(snippet), `C5.1D.2 backfill helper missing: ${snippet}`)
}

assert(main.includes('backfillLocalScheduleSessionsToCloud'), 'main must import manual backfill helper')
assert(main.includes('window.__ichessCenterOS'), 'main must expose manual helper namespace')
assert(main.includes('backfillScheduleSessionsToCloud'), 'main must expose backfillScheduleSessionsToCloud')
assert(main.includes('scheduleSessions,'), 'helper must use current browser local TKB state')
assert(!/backfillScheduleSessionsToCloud\(\s*\{?\s*dryRun:\s*false/.test(main), 'main must not auto-apply schedule backfill')

const backfillDangerText = `${backfill}\n${main}`
assert(!/\.delete\(|\.remove\(|\.truncate\(|localStorage\.clear|removeItem\(/.test(backfill), 'C5.1D.2 helper must not remove cloud/local data')
assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)|SQL APPLY/i.test(backfillDangerText), 'C5.1D.2 runtime must not apply SQL')
assert(!/signUp|Đăng ký/.test(backfillDangerText), 'C5.1D.2 must not add signUp/Dang ky runtime')
assert(!/usedSessions|remainingSessions|tuition_record_package|tuitionTermPayment|TBHP/.test(backfill), 'C5.1D.2 must not connect TKB backfill to tuition/TBHP')

assert(scheduleSessions.includes("SCHEDULE_SESSION_CLOUD_ENTITY_TYPE = 'schedule_session'"), 'schedule_session entity type must stay defined')
assert(scheduleBridge.includes('buildScheduleSessionCloudPayload'), 'schedule bridge payload builder must remain available')
assert(scheduleRealtime.includes('subscribeToScheduleSessionCloudRealtime'), 'C4 schedule realtime must remain intact')
assert(storage.includes('getStoredSchedule'), 'local schedule storage must remain intact')
assert(scheduleModule.includes('renderScheduleModule'), 'schedule module must remain intact')

for (const fileName of [
  'tests/c5-1d-1-cloud-parity-tkb-400-hotfix-smoke.js',
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
  assert(allowedChangedFiles.has(fileName), `Unexpected C5.1D.2 changed file: ${fileName}`)
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
  ['backfill', backfill],
]) {
  assert(!mojibakePattern.test(content), `C5.1D.2 ${label} must not contain mojibake`)
}

for (const [label, fileName] of [
  ['main', 'src/main.js'],
  ['scheduleSessions', 'src/cloud-schedule-sessions.js'],
  ['scheduleBridge', 'src/cloud-schedule-session-bridge.js'],
  ['scheduleRealtime', 'src/cloud-realtime-schedule-sessions.js'],
  ['storage', 'src/storage.js'],
  ['scheduleModule', 'src/schedule-module.js'],
]) {
  const diff = getFileDiff(fileName)
  assert(!mojibakePattern.test(diff), `C5.1D.2 ${label} diff must not introduce mojibake`)
}

console.log('C5.1D.2 schedule_session cloud backfill parity smoke passed')

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

function getFileDiff(fileName) {
  try {
    return execFileSync('git', ['diff', '--', fileName], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
  } catch {
    return ''
  }
}
