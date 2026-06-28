import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')

const docPath = path.join(repoRoot, 'docs', 'c5-1d-3-fix-schedule-backfill-c2-scope-guard.md')
const smokePath = path.join(repoRoot, 'tests', 'c5-1d-3-fix-schedule-backfill-c2-scope-guard-smoke.js')
const backfillPath = path.join(repoRoot, 'src', 'cloud-schedule-session-backfill.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const cloudDbSyncPath = path.join(repoRoot, 'src', 'cloud-db-sync.js')
const scheduleSessionsPath = path.join(repoRoot, 'src', 'cloud-schedule-sessions.js')
const scheduleBridgePath = path.join(repoRoot, 'src', 'cloud-schedule-session-bridge.js')
const storagePath = path.join(repoRoot, 'src', 'storage.js')
const scheduleModulePath = path.join(repoRoot, 'src', 'schedule-module.js')

for (const filePath of [
  docPath,
  smokePath,
  backfillPath,
  mainPath,
  cloudDbSyncPath,
  scheduleSessionsPath,
  scheduleBridgePath,
  storagePath,
  scheduleModulePath,
]) {
  assert(fs.existsSync(filePath), `Missing C5.1D.3 file/dependency: ${filePath}`)
}

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')
const backfill = fs.readFileSync(backfillPath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')
const cloudDbSync = fs.readFileSync(cloudDbSyncPath, 'utf8')
const scheduleSessions = fs.readFileSync(scheduleSessionsPath, 'utf8')
const scheduleBridge = fs.readFileSync(scheduleBridgePath, 'utf8')
const storage = fs.readFileSync(storagePath, 'utf8')
const scheduleModule = fs.readFileSync(scheduleModulePath, 'utf8')

for (const snippet of [
  'C5.1D.3',
  'blocked C2',
  'Entity type không thuộc phạm vi C2.',
  'localScheduleSessionCount: 40',
  'candidateCount: 0',
  'schedule_session',
  'Fix Applied',
  'visibleWeekCandidateCount',
  'eligibleCandidateCount',
  'sampleTitles',
  'sampleIds',
  'skippedReasons',
  'Angel Wings',
  'No SQL',
  'No C5.2',
  'No all-module sync',
  'No commit/push',
]) {
  assert(doc.includes(snippet), `C5.1D.3 doc missing: ${snippet}`)
}

assert(backfill.includes('listScheduleSessionCloudEntities'), 'Backfill must use schedule-specific read path')
assert(!backfill.includes('listCloudEntities'), 'Backfill must not use C2-only listCloudEntities guard')
assert(backfill.includes("entity_type', SCHEDULE_SESSION_CLOUD_ENTITY_TYPE"), 'Backfill must filter schedule_session entity type')
assert(backfill.includes(".from('center_cloud_entities')"), 'Backfill must still use center_cloud_entities')
assert(backfill.includes('.eq('), 'Backfill must center/entity filter query')
assert(backfill.includes('dryRun = true'), 'Dry-run default must remain true')
assert(backfill.includes('if (!shouldWrite)'), 'Dry-run branch must return before upsert')
assert(backfill.indexOf('if (!shouldWrite)') < backfill.indexOf('.upsert('), 'Dry-run no-write branch must precede upsert')
assert(backfill.includes('SCHEDULE_SESSION_BACKFILL_CONFIRM_TOKEN'), 'Confirm token must remain')
assert(backfill.includes('BACKFILL_SCHEDULE_SESSION'), 'Confirm token value must remain')
assert(backfill.includes('ADMIN_BACKFILL_ROLES'), 'Role guard must remain')
assert(backfill.includes("'owner'") && backfill.includes("'qtv'") && backfill.includes("'center_admin'") && backfill.includes("'admin'"), 'Admin role allowlist incomplete')
assert(backfill.includes('centerId') && backfill.includes('center_id'), 'Center guard fields must remain')
assert(backfill.includes('visibleScheduleSessions'), 'Backfill must accept visible rendered TKB source')
assert(backfill.includes('visibleWeekCandidateCount'), 'Preview must expose visible candidate count')
assert(backfill.includes('eligibleCandidateCount'), 'Preview must expose eligible candidate count')
assert(backfill.includes('seenLocalIds'), 'Preview must dedupe by stable local_id')
assert(backfill.includes('skippedReasons'), 'Preview must expose skipped reasons')
assert(backfill.includes('Khong thay Angel Wings'), 'Preview must warn when sample is not Angel Wings')
assert(backfill.includes('Local co ${scheduleSessions.length} schedule_session'), 'Preview must warn when local raw count exceeds visible source')

assert(main.includes('getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate)'), 'main must pass currently rendered TKB source')
assert(main.includes('visibleScheduleSessions'), 'main must pass visibleScheduleSessions into helper')
assert(main.includes('backfillScheduleSessionsToCloud'), 'main must expose manual helper')
assert(!/backfillScheduleSessionsToCloud\(\s*\{?\s*dryRun:\s*false/.test(main), 'main must not auto-apply backfill')

assert(cloudDbSync.includes('Entity type kh'), 'C2-only guard can remain outside backfill path for legacy helpers')
assert(scheduleSessions.includes("SCHEDULE_SESSION_CLOUD_ENTITY_TYPE = 'schedule_session'"), 'schedule_session constant must remain')
assert(scheduleBridge.includes('buildScheduleSessionCloudPayload'), 'schedule bridge payload builder must remain')
assert(storage.includes('getStoredSchedule'), 'local schedule storage must remain')
assert(scheduleModule.includes('getVisibleScheduleSessions'), 'schedule visible helper must remain')

const dangerText = `${backfill}\n${main}`
assert(!/\.delete\(|\.remove\(|\.truncate\(|localStorage\.clear|removeItem\(/.test(backfill), 'C5.1D.3 helper must not remove cloud/local data')
assert(!/supabase\s+(db\s+push|migration\s+up|migration\s+repair)|SQL APPLY/i.test(dangerText), 'C5.1D.3 runtime must not apply SQL')
assert(!/signUp|Đăng ký/.test(dangerText), 'C5.1D.3 must not add signUp/Dang ky runtime')
assert(!/usedSessions|remainingSessions|tuition_record_package|tuitionTermPayment|TBHP/.test(backfill), 'C5.1D.3 must not connect schedule backfill to tuition/TBHP')

for (const fileName of [
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
  assert(allowedChangedFiles.has(fileName), `Unexpected C5.1D.3 changed file: ${fileName}`)
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
  assert(!mojibakePattern.test(content), `C5.1D.3 ${label} must not contain mojibake`)
}

for (const [label, fileName] of [
  ['main', 'src/main.js'],
  ['scheduleSessions', 'src/cloud-schedule-sessions.js'],
  ['scheduleBridge', 'src/cloud-schedule-session-bridge.js'],
  ['cloudDbSync', 'src/cloud-db-sync.js'],
  ['storage', 'src/storage.js'],
  ['scheduleModule', 'src/schedule-module.js'],
]) {
  const diff = getFileDiff(fileName)
  assert(!mojibakePattern.test(diff), `C5.1D.3 ${label} diff must not introduce mojibake`)
}

console.log('C5.1D.3 schedule backfill C2 scope guard smoke passed')

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
