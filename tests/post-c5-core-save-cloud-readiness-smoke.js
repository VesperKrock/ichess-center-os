import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CORE_SAVE_COMMITTED_REFRESH_FAILED_MESSAGE,
  CORE_SAVE_PRECOMMIT_FAILURE_MESSAGE,
  prepareAuthoritativeCoreFormCommand,
  runAuthoritativeCoreSave,
} from '../src/core-save-recovery.js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'
import { getCloudDbReadinessMessage } from '../src/cloud-db-sync.js'
import { buildOnlineAccessState, canWriteEntity } from '../src/online-access-control.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256')
  .update(readFileSync(join(root, path)))
  .digest('hex')
  .toUpperCase()
const functionSlice = (source, start, end) => {
  const startAt = source.indexOf(start)
  assert(startAt >= 0, `Missing function start: ${start}`)
  const endAt = source.indexOf(end, startAt + start.length)
  assert(endAt > startAt, `Missing function end: ${end}`)
  return source.slice(startAt, endAt)
}

const accessFor = (role) => buildOnlineAccessState({
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: `${role}-user` },
  centerId: 'center-a',
  membership: { center_id: 'center-a', status: 'active', role },
  role,
  cloudReady: true,
})
assert.equal(canWriteEntity(accessFor('owner'), 'student'), true)
assert.equal(canWriteEntity(accessFor('center_admin'), 'student'), true)
assert.equal(canWriteEntity(accessFor('admin'), 'class_session'), true)
assert.equal(canWriteEntity(accessFor('center_admin'), 'schedule_session'), true)
assert.equal(canWriteEntity(accessFor('viewer'), 'student'), false)

let generatedKeyCount = 0
const createIdempotencyKey = () => `key-${++generatedKeyCount}`
const firstCreateIntent = prepareAuthoritativeCoreFormCommand({
  formState: {},
  formValues: { fullName: 'Student A', classSessionIds: ['class-a'] },
  createIdempotencyKey,
  createLocalId: () => 'stu-stable',
  now: () => '2026-08-20T00:00:00.000Z',
})
const sameCreateIntent = prepareAuthoritativeCoreFormCommand({
  formState: firstCreateIntent.formState,
  formValues: { classSessionIds: ['class-a'], fullName: 'Student A' },
  createIdempotencyKey,
  createLocalId: () => 'must-not-change',
  now: () => 'must-not-change',
})
assert.equal(sameCreateIntent.commandIdempotencyKey, firstCreateIntent.commandIdempotencyKey)
assert.equal(sameCreateIntent.commandLocalId, firstCreateIntent.commandLocalId)
assert.equal(sameCreateIntent.commandCreatedAt, firstCreateIntent.commandCreatedAt)
const changedCreateIntent = prepareAuthoritativeCoreFormCommand({
  formState: sameCreateIntent.formState,
  formValues: { fullName: 'Student A corrected', classSessionIds: ['class-a'] },
  createIdempotencyKey,
  createLocalId: () => 'must-not-change',
  now: () => 'must-not-change',
})
assert.notEqual(changedCreateIntent.commandIdempotencyKey, sameCreateIntent.commandIdempotencyKey)
assert.equal(changedCreateIntent.commandLocalId, sameCreateIntent.commandLocalId)
assert.equal(changedCreateIntent.commandCreatedAt, sameCreateIntent.commandCreatedAt)

let installed = 0
let refreshed = 0
const failed = await runAuthoritativeCoreSave({
  executeCommand: async () => ({
    ok: false,
    outcome_code: 'SERVER_COMMAND_FAILED',
    error: 'technical network failure',
  }),
  installCommittedEntity: () => { installed += 1 },
  refreshProjection: async () => { refreshed += 1; return { ok: true } },
})
assert.equal(failed.ok, false)
assert.equal(failed.committed, false)
assert.equal(failed.error, CORE_SAVE_PRECOMMIT_FAILURE_MESSAGE)
assert.equal(failed.technicalError, 'technical network failure')
assert.equal(installed, 0)
assert.equal(refreshed, 0)

const committedEntity = { id: 'student-a', cloudVersion: 1 }
const success = await runAuthoritativeCoreSave({
  entityLabel: 'Học viên',
  executeCommand: async () => ({ ok: true, outcome_code: 'COMMITTED', entity: committedEntity }),
  installCommittedEntity: (entity) => { assert.equal(entity, committedEntity); installed += 1 },
  refreshProjection: async () => { refreshed += 1; return { ok: true, data: [committedEntity] } },
})
assert.equal(success.ok, true)
assert.equal(success.committed, true)
assert.equal(success.refreshOk, true)
assert.equal(installed, 1)
assert.equal(refreshed, 1)

const refreshFailed = await runAuthoritativeCoreSave({
  executeCommand: async () => ({ ok: true, outcome_code: 'COMMITTED', entity: committedEntity }),
  installCommittedEntity: () => { installed += 1 },
  refreshProjection: async () => ({ ok: false, error: 'injected refresh failure' }),
})
assert.equal(refreshFailed.ok, true, 'A confirmed server commit must not be reclassified as save failure')
assert.equal(refreshFailed.committed, true)
assert.equal(refreshFailed.refreshOk, false)
assert.equal(refreshFailed.outcome_code, 'COMMITTED_REFRESH_FAILED')
assert.equal(refreshFailed.warning, CORE_SAVE_COMMITTED_REFRESH_FAILED_MESSAGE)
assert(refreshFailed.warning.includes('Không cần bấm Lưu lại'))

let contextCurrent = true
let contextInstallCount = 0
const switched = await runAuthoritativeCoreSave({
  executeCommand: async () => {
    contextCurrent = false
    return { ok: true, outcome_code: 'COMMITTED', entity: committedEntity }
  },
  isContextCurrent: () => contextCurrent,
  installCommittedEntity: () => { contextInstallCount += 1 },
  refreshProjection: async () => ({ ok: true }),
})
assert.equal(switched.committed, true)
assert.equal(switched.refreshOk, false)
assert.equal(contextInstallCount, 0, 'Old-center commit may not install into the new center projection')

let commitCount = 0
let firstResponseLost = true
let storedResult = null
let storedIntent = null
const idempotentSupabase = {
  rpc: async (name, args) => {
    assert.equal(name, 'c5_1_mutate_core_entity')
    const intent = JSON.stringify(args)
    if (!storedResult) {
      commitCount += 1
      storedIntent = intent
      storedResult = {
        ok: true,
        outcome_code: 'COMMITTED',
        center_id: args.p_center_id,
        entity_type: args.p_entity_type,
        local_id: args.p_local_id,
        entity_version: 1,
        updated_at: '2026-08-20T00:00:00.000Z',
        deleted_at: null,
        payload: args.p_payload,
        replayed: false,
      }
    } else {
      assert.equal(intent, storedIntent, 'Ambiguous retry must reuse the exact command intent')
    }
    if (firstResponseLost) {
      firstResponseLost = false
      return { data: null, error: { message: 'network timeout after commit' } }
    }
    return { data: { ...storedResult, replayed: true }, error: null }
  },
}
const idempotencyKey = '11111111-1111-4111-8111-111111111111'
const student = { id: 'student-retry', fullName: 'Retry Student', updatedAt: '2026-08-20T00:00:00.000Z' }
const firstAttempt = await mutateAuthoritativeCoreEntity({
  supabase: idempotentSupabase,
  centerId: 'center-a',
  entityType: 'student',
  entity: student,
  idempotencyKey,
})
assert.equal(firstAttempt.ok, false)
const retryAttempt = await mutateAuthoritativeCoreEntity({
  supabase: idempotentSupabase,
  centerId: 'center-a',
  entityType: 'student',
  entity: student,
  idempotencyKey,
})
assert.equal(retryAttempt.ok, true)
assert.equal(retryAttempt.replayed, true)
assert.equal(commitCount, 1, 'Ambiguous retry may not create a duplicate authoritative entity')

assert.equal(
  getCloudDbReadinessMessage({ category: 'schema-not-ready', centerId: 'center-a' }),
  'Dữ liệu trung tâm chưa sẵn sàng cho phiên bản ứng dụng hiện tại.',
)
assert(!getCloudDbReadinessMessage({}).includes('C2.2'))

const main = read('src/main.js')
const sync = read('src/cloud-db-sync.js')
const commandContext = functionSlice(
  main,
  'async function getAuthoritativeCoreCommandContext',
  'async function refreshAuthoritativeCoreProjectionAfterCommit',
)
assert(commandContext.includes('await getCloudDbContext(centerId)'))
assert(!commandContext.includes('buildCurrentOnlineAccessState'))
assert(!commandContext.includes('getOnlineAccessMessage'))
assert(commandContext.includes('Vai trò hiện tại chỉ được xem, không được sửa dữ liệu dùng chung.'))
const saveUiResult = functionSlice(
  main,
  'function applyAuthoritativeCoreSaveUiResult',
  'async function commitStudentProjection',
)
assert(saveUiResult.includes('result.committed && !result.refreshOk'))
assert(saveUiResult.includes('window.alert(result.userMessage)'))
const studentWrite = functionSlice(main, 'async function writeStudentThroughCloud', 'async function startStudentRealtimeSubscription')
const classWrite = functionSlice(main, 'async function writeClassSessionThroughCloud', 'async function commitClassSessionProjection')
const scheduleWrite = functionSlice(main, 'async function writeScheduleSessionThroughCloud', 'async function startScheduleSessionRealtimeSubscription')
for (const writePath of [studentWrite, classWrite, scheduleWrite]) {
  assert(writePath.includes('getAuthoritativeCoreCommandContext'))
  assert(!writePath.includes('checkCloudDbReadiness'))
  assert(!writePath.includes("cloudDbState.readinessStatus === 'ready'"))
}
const coreBootstrap = functionSlice(sync, 'export async function pullCloudBootstrapCoreEntities', 'export function createEmptyCloudEntityCounts')
assert(coreBootstrap.includes('getCloudDbContext(centerId)'))
assert(!coreBootstrap.includes('checkCloudDbReadiness(centerId)'))
const financeRefresh = functionSlice(main, 'async function refreshC54FinanceSharedTruth', 'async function writeC54FinanceCommand')
const financeWrite = functionSlice(main, 'async function writeC54FinanceCommand', 'async function refreshC56InventorySharedTruth')
assert(financeRefresh.includes('getCloudDbContext(centerId)'))
assert(financeWrite.includes('getCloudDbContext(centerId)'))
assert(!financeRefresh.includes('checkCloudDbReadiness(centerId)'))
assert(!financeWrite.includes('checkCloudDbReadiness(centerId)'))
assert(!main.includes('Cloud DB C2.2 readiness'))

const studentSaveHandler = functionSlice(
  main,
  'document.querySelector(\'[data-student-action="save-form"]\')',
  "document.querySelectorAll('.student-row[data-student-id]')",
)
assert(studentSaveHandler.includes('if (!result.ok)'))
assert(studentSaveHandler.includes('...studentFormState'))
assert(studentSaveHandler.includes('prepareAuthoritativeCoreFormCommand'))
assert(studentSaveHandler.includes('createdAt: commandCreatedAt'))
assert(studentSaveHandler.includes('studentFormState = null'))
const scheduleSaveHandler = functionSlice(main, 'const handleScheduleFormSave', "document.querySelector('[data-schedule-form]')")
assert(scheduleSaveHandler.includes('values: formValues'))
assert(scheduleSaveHandler.includes('if (!result.ok)'))
assert(scheduleSaveHandler.includes('prepareAuthoritativeCoreFormCommand'))
assert(scheduleSaveHandler.includes('createdAt: commandCreatedAt'))
assert(scheduleSaveHandler.includes('scheduleFormState = null'))
const classSaveHandler = functionSlice(
  main,
  'document.querySelector(\'[data-settings-class-session-action="save-form"]\')',
  "document.querySelectorAll('[data-parent-consultation-filter]')",
)
assert(classSaveHandler.includes('...settingsClassSessionFormState'))
assert(classSaveHandler.includes('if (!result.ok)'))
assert(classSaveHandler.includes('prepareAuthoritativeCoreFormCommand'))
assert(classSaveHandler.includes('createdAt: commandCreatedAt'))
assert(classSaveHandler.includes('settingsClassSessionFormState = null'))

assert.equal(
  sha256('supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql'),
  '2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754',
)
for (const migration of [
  'supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql',
  'supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql',
  'supabase/migrations/202608140006_c5_4_reconciliation_currentness_hardening.sql',
]) {
  const migrationSql = read(migration).toLowerCase()
  assert(!migrationSql.includes('f23_3e_p4b'))
  assert(!migrationSql.includes('crm_conversion_bridge_session'))
}

console.log('POST_C5_CORE_SAVE_CLOUD_READINESS_SMOKE: PASS')
