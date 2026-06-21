import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const docsPath = path.join(repoRoot, 'docs', 'online-schedule-bridge-c3-4a.md')
const docs = fs.readFileSync(docsPath, 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const entitiesSource = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-db-entities.js'), 'utf8')
const cloudSyncSource = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-db-sync.js'), 'utf8')
const scheduleDryRunSource = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-schedule-sessions.js'), 'utf8')
const storageSource = fs.readFileSync(path.join(repoRoot, 'src', 'storage.js'), 'utf8')
const scheduleModuleSource = fs.readFileSync(path.join(repoRoot, 'src', 'schedule-module.js'), 'utf8')

assert(fs.existsSync(docsPath), 'C3.4A docs must exist.')

for (const term of [
  'C3.4A chi audit/bridge',
  'ichessCenterOS.schedule.dreamhome',
  'ichessCenterOS.classSessions.dreamhome',
  'class_session',
  'schedule_session',
  'Difference table',
  'Option A - Realtime class_session truoc',
  'Option B - Realtime schedule_session truoc',
  'Option C - Split bridge',
  'Recommended next phase',
  'C3.4B - schedule_session bridge/readiness guarded, no realtime runtime',
  'C3.1 guard',
  'SQL applied: NO',
  'Membership SQL patch: still needed',
  'Realtime SQL patch: still needed',
  'NEEDS SCHEDULE_SESSION SQL PATCH',
  'NEEDS SUPABASE CONFIRMATION',
  'Manual QA future plan',
]) {
  assert(docs.includes(term), `Missing C3.4A docs term: ${term}`)
}

assert(entitiesSource.includes("CLASS_SESSION: 'class_session'"))
assert(cloudSyncSource.includes('CLOUD_ENTITY_TYPES.CLASS_SESSION'))
assert(scheduleDryRunSource.includes("SCHEDULE_SESSION_CLOUD_ENTITY_TYPE = 'schedule_session'"))
assert(scheduleDryRunSource.includes('createScheduleSessionCloudDryRun'))
assert(scheduleDryRunSource.includes('evaluateScheduleSessionCloudReadiness'))
assert(scheduleDryRunSource.includes('NEEDS SQL/ALLOWLIST PATCH'))
assert(storageSource.includes("const SCHEDULE_KEY = 'ichessCenterOS.schedule.dreamhome'"))
assert(storageSource.includes("const CLASS_SESSIONS_KEY = 'ichessCenterOS.classSessions.dreamhome'"))
assert(scheduleModuleSource.includes('buildScheduleSessionFromForm'))
assert(scheduleModuleSource.includes('teacherId'))
assert(scheduleModuleSource.includes('studentIds'))
assert(scheduleModuleSource.includes('scheduleType'))

for (const forbiddenRuntime of [
  'subscribeToTuitionCloudRealtime',
  'subscribeToAttendanceCloudRealtime',
  'writeTuitionThroughCloud',
  'writeAttendanceThroughCloud',
  'startTuitionRealtimeSubscription',
  'startAttendanceRealtimeSubscription',
]) {
  assert(!mainSource.includes(forbiddenRuntime), `C3.4A must not add runtime: ${forbiddenRuntime}`)
  assert(!scheduleDryRunSource.includes(forbiddenRuntime), `C3.4A must not add helper runtime: ${forbiddenRuntime}`)
}

assert(!/SQL (has been|was) applied/i.test(docs), 'C3.4A must not claim SQL was applied.')
assert(!/production realtime (has passed|passed|da pass|đã pass)/i.test(docs), 'C3.4A must not claim production realtime passed.')
assert(!/live realtime (has passed|passed)/i.test(docs), 'C3.4A must not claim live realtime passed.')

console.log('C3.4A audit bridge class_session schedule_session smoke passed')
