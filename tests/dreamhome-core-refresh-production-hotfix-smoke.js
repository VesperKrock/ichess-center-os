import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  listCloudEntityPayloads,
  listScheduleSessionCloudPayloads,
} from '../src/cloud-db-sync.js'
import { createScheduleSessionCloudLocalId } from '../src/cloud-schedule-sessions.js'
import {
  getModuleAuthorityEntry,
  getModuleRefreshUpstreams,
} from '../src/module-authority-registry.js'

const root = process.cwd()
const main = readFileSync(join(root, 'src/main.js'), 'utf8')
const coreClient = readFileSync(join(root, 'src/cloud-authoritative-core.js'), 'utf8')
const c51Migration = readFileSync(join(
  root,
  'supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql',
), 'utf8')

function queryClient(rows) {
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    order: async () => ({ data: rows, error: null }),
  }
  return { from: () => query }
}

function sourceSlice(startToken, endToken) {
  const start = main.indexOf(startToken)
  const end = main.indexOf(endToken, start + startToken.length)
  assert(start >= 0 && end > start, `Missing source slice ${startToken}`)
  return main.slice(start, end)
}

const studentRow = {
  center_id: 'dreamhome',
  entity_type: 'student',
  local_id: 'qa-student-targeted-refresh',
  payload: { id: 'qa-student-targeted-refresh', fullName: 'QA' },
  source_module: 'student',
  source_version: 'c5.1-authoritative-core-v1',
  entity_version: 1,
  updated_at: '2026-08-21T00:00:00.000Z',
  deleted_at: null,
}
const studentResult = await listCloudEntityPayloads({
  supabase: queryClient([studentRow]),
  centerId: 'dreamhome',
  entityType: 'student',
})
assert.equal(studentResult.ok, true)
assert.equal(studentResult.data.length, 1)

const legacySchedulePayload = {
  id: 'qa-legacy-schedule-identity',
  scheduleType: 'recurring',
  dayOfWeek: 'monday',
  startTime: '18:00',
  endTime: '19:00',
}
const legacyScheduleLocalId = createScheduleSessionCloudLocalId(legacySchedulePayload)
assert.equal(legacyScheduleLocalId, 'schedule-session::qa-legacy-schedule-identity')
const scheduleResult = await listScheduleSessionCloudPayloads({
  supabase: queryClient([{
    ...studentRow,
    entity_type: 'schedule_session',
    local_id: legacyScheduleLocalId,
    payload: legacySchedulePayload,
    source_module: 'schedule',
    source_version: 'f19h-schedule-session-alpha-v1',
  }]),
  centerId: 'dreamhome',
})
assert.equal(scheduleResult.ok, false)
assert.equal(scheduleResult.outcome_code, 'INVALID_SERVER_RESULT')
assert(coreClient.includes('localId = entity?.id || entity?.localId'))
assert(c51Migration.includes("pg_catalog.btrim(coalesce(v_payload->>'id', '')) <> v_local_id"))
assert(c51Migration.includes("'PAYLOAD_ID_MISMATCH'"))

assert.deepEqual(getModuleRefreshUpstreams('hoc-vien'), ['core-student'])
assert.deepEqual(getModuleAuthorityEntry('hoc-vien').authoritativeSources, ['C5.1 Core Student'])
assert.deepEqual(getModuleAuthorityEntry('hoc-vien').derivedSources, ['C5.1 Teacher/Class references'])

const upstreamRunner = sourceSlice(
  'async function runAuthoritativeUpstreamRefresh',
  'async function refreshNotificationAuthoritativeUpstreams',
)
for (const token of [
  "case 'core-student'",
  'refreshStudentModuleCoreProjection',
  "case 'staff'",
  "case 'inventory'",
  "case 'calendar-notes'",
]) assert(upstreamRunner.includes(token), `Missing targeted module-open route: ${token}`)

const studentCoreRefresh = sourceSlice(
  'async function refreshStudentModuleCoreProjection',
  'function applyAuthoritativeCoreSaveUiResult',
)
for (const entityType of ['STUDENT', 'TEACHER', 'CLASS_SESSION']) {
  assert(studentCoreRefresh.includes(`CLOUD_ENTITY_TYPES.${entityType}`))
}
assert(!studentCoreRefresh.includes('CLOUD_ENTITY_TYPES.SCHEDULE_SESSION'))
assert(studentCoreRefresh.indexOf('const failedResult') < studentCoreRefresh.indexOf('students = studentResult.data'))

for (const [startToken, endToken] of [
  ['async function handleInternalOpenCenter', 'function normalizeInternalCenters'],
  ['async function syncCloudUser', 'function createInitialCloudDbState'],
]) {
  const bootstrap = sourceSlice(startToken, endToken)
  assert(bootstrap.includes('refreshC54FinanceSharedTruth'))
  for (const unavailable of [
    'refreshC55StaffHrSharedTruth',
    'refreshC56InventorySharedTruth',
    'refreshC57CalendarNotesSharedTruth',
  ]) assert(!bootstrap.includes(unavailable), `${unavailable} must not run as background bootstrap`)
}

for (const developerCopy of [
  'projection chưa xác minh, không phải fresh',
  'Authoritative data đã xác minh',
  'Đang tải đúng authoritative upstream',
  'Không có active canonical center; authoritative refresh',
]) assert(!main.includes(developerCopy), `Developer-facing refresh copy remains: ${developerCopy}`)
assert(main.includes('Không thể làm mới dữ liệu lúc này. Thông tin đang hiển thị có thể chưa phải bản mới nhất.'))

console.log('DREAMHOME_CORE_REFRESH_PRODUCTION_HOTFIX_SMOKE: PASS')
