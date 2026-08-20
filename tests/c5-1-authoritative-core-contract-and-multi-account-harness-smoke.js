import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql',
  report: 'docs/c5-1-authoritative-core-contract-and-multi-account-harness.md',
  review: 'docs/c5-1-independent-technical-review.md',
  smoke: 'tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js',
  qa: 'tests/c5-1-authoritative-core-contract-and-multi-account-harness-local-db-qa.js',
  adapter: 'src/cloud-authoritative-core.js',
  entities: 'src/cloud-db-entities.js',
  sync: 'src/cloud-db-sync.js',
  bootstrap: 'src/cloud-bootstrap.js',
  students: 'src/cloud-realtime-students.js',
  teachers: 'src/cloud-realtime-teachers.js',
  schedule: 'src/cloud-realtime-schedule-sessions.js',
  cleanup: 'src/legacy-dataset-cleanup.js',
  access: 'src/online-access-control.js',
  main: 'src/main.js',
  settings: 'src/settings-module.js',
  scheduleModule: 'src/schedule-module.js',
  c50Report: 'docs/c5-0-system-wide-shared-source-of-truth-audit.md',
}
for (const value of Object.values(paths)) assert(existsSync(join(root, value)), `Missing C5.1 dependency: ${value}`)
assert(!existsSync(join(root, 'src/attendance-board-angel-wings-data.js')), 'Retired dataset source must be removed')
const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const content = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, read(value)]))
const includesAll = (value, tokens, label) => {
  for (const token of tokens) assert(value.includes(token), `${label}: missing ${token}`)
}
const excludesAll = (value, tokens, label) => {
  for (const token of tokens) assert(!value.includes(token), `${label}: forbidden ${token}`)
}
const functionSlice = (source, name, nextName) => {
  const start = source.indexOf(name)
  assert(start >= 0, `Missing function ${name}`)
  const end = nextName ? source.indexOf(nextName, start + name.length) : source.length
  assert(end > start, `Missing boundary after ${name}`)
  return source.slice(start, end)
}

const artifactBasename = 'c5-1-authoritative-core-contract-and-multi-account-harness'
const phaseArtifacts = [
  ...readdirSync(join(root, 'docs')).filter((name) => name.startsWith(artifactBasename)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.startsWith(artifactBasename)).map((name) => `tests/${name}`),
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('_c5_1_authoritative_core_contract_and_multi_account_harness')).map((name) => `supabase/migrations/${name}`),
].sort()
assert.deepEqual(phaseArtifacts, [paths.report, paths.qa, paths.smoke, paths.migration].sort(), 'C5.1 must own exact migration/report/smoke/QA artifacts')

const inheritedHashes = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
  ['202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql', '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6'],
  ['202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql', 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F'],
  ['202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql', '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA'],
  ['202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql', 'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722'],
  ['202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql', '33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19'],
  ['202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql', '55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773'],
  ['202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql', 'F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B'],
  ['202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql', '7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46'],
  ['202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql', '8232FFD8EF0A63FB60E2A3FDE957EC542A3F196DA4272BF420FF7F3E98F099F0'],
  ['202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql', '70B3FA5416D2B045EBB615032A3708302871149B86DF171B633F3429B18B206A'],
  ['202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql', 'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3'],
  ['202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql', '1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC'],
  ['202608130002_f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection.sql', '677156C5393BA813B6B95E52BC0ECE6F8C79672AF43DD5ED649BF57EA9E9959F'],
])
assert.equal(inheritedHashes.size, 19)
for (const [name, expected] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), expected, `Inherited migration drift: ${name}`)
}
const c51ExpectedSha256 = '2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754'
assert.equal(sha256(paths.migration), c51ExpectedSha256, 'C5.1 migration SHA drift')

includesAll(content.migration, [
  'add column entity_version bigint not null default 1',
  'create table public.center_core_command_result',
  'alter table public.center_core_command_result enable row level security',
  'alter table public.center_core_command_result force row level security',
  'unique (center_id, actor_user_id, idempotency_key)',
  'create or replace function public.c5_1_mutate_core_entity(',
  'security definer', "set search_path = ''", 'v_actor_user_id uuid := auth.uid()',
  "v_role not in ('owner', 'qtv', 'center_admin', 'admin')",
  'for share of cm, c', 'for update', 'entity_version = e.entity_version + 1',
  "'IDEMPOTENCY_CONFLICT'", "'VERSION_CONFLICT'", "'CONCURRENT_CONFLICT'",
], 'Authoritative SQL contract')
includesAll(content.migration, [
  'drop policy if exists "center members can insert cloud entities"',
  'drop policy if exists "center members can update cloud entities"',
  'drop policy if exists "center members can delete cloud entities"',
  'c5_1 active center members read cloud entities',
  "coalesce(cm.status, 'active') = 'active'", "c.status = 'active'",
  "entity_type not in ('student', 'teacher', 'class_session', 'schedule_session')",
  'revoke all on table public.center_core_command_result from public, anon, authenticated, service_role',
  'from public, anon, service_role', 'to authenticated',
], 'RLS and ACL contract')
assert(!/grant execute[\s\S]*to\s+(anon|public|service_role)/i.test(content.migration), 'Privileged RPC grant widened')

const stripMetadataAt = content.migration.indexOf("- 'updatedAt'")
const intentAt = content.migration.indexOf('v_intent_digest :=')
const serverTimestampAt = content.migration.indexOf("'{updatedAt}'")
const replayAt = content.migration.indexOf('v_existing_result.result_snapshot')
const entityLockAt = content.migration.indexOf('from public.center_cloud_entities e\n  where', replayAt)
assert(stripMetadataAt > 0 && stripMetadataAt < intentAt && intentAt < serverTimestampAt, 'Client timestamp must not bind semantic retry intent')
assert(replayAt > 0 && entityLockAt > replayAt, 'Immutable exact replay must precede live entity lock/currentness')

includesAll(content.adapter, [
  "'student'", "'teacher'", "'class_session'", "'schedule_session'",
  "supabase.rpc('c5_1_mutate_core_entity'", 'createCoreCommandIdempotencyKey',
  'projectAuthoritativeCoreRecord', 'getAuthoritativeCoreVersion',
  "VERSION_CONFLICT: '", "IDEMPOTENCY_CONFLICT: '",
], 'Browser authoritative adapter')
includesAll(content.sync, [
  "'center_id, entity_type, local_id, payload, source_module, source_version, entity_version, updated_at, deleted_at'",
  'isAuthoritativeCoreEntityType', 'mutateAuthoritativeCoreEntity',
  'projectAuthoritativeCoreRecord', 'scheduleSessions',
], 'Cloud read/write routing')
includesAll(content.bootstrap, [
  "'student'", "'teacher'", "'class_session'", "'schedule_session'",
  "source: 'cache-projection'", "ERROR: 'error'",
  'Không xác minh được server',
], 'Cache-only bootstrap vocabulary')
includesAll(content.access, [
  "['student', 'teacher', 'class_session', 'schedule_session']",
  'ONLINE_ACCESS_ROLES.OWNER', 'ONLINE_ACCESS_ROLES.QTV', 'ONLINE_ACCESS_ROLES.CENTER_ADMIN',
  'ONLINE_ACCESS_ROLES.TEACHER', 'ONLINE_ACCESS_ROLES.CONSULTANT', 'ONLINE_ACCESS_ROLES.VIEWER',
], 'Role gate')

for (const [source, label] of [
  [content.students, 'Student'], [content.teachers, 'Teacher'], [content.schedule, 'Schedule'],
]) {
  includesAll(source, [
    'mutateAuthoritativeCoreEntity', 'projectAuthoritativeCoreRecord',
    'getAuthoritativeCoreVersion', 'incomingVersion <= currentVersion',
  ], `${label} authoritative realtime`)
}

for (const [name, saveMarker, nextName] of [
  ['async function commitTeacherProjection', 'saveStoredTeachers(teachers)', 'async function writeClassSessionThroughCloud'],
]) {
  const block = functionSlice(content.main, name, nextName)
  const awaitAt = block.indexOf('await write')
  const successAt = block.indexOf('if (!result.ok) return result')
  const saveAt = block.indexOf(saveMarker)
  assert(awaitAt >= 0 && successAt > awaitAt && saveAt > successAt, `${name} must commit cloud before cache`)
}
const recovery = read('src/core-save-recovery.js')
const recoveryCommandAt = recovery.indexOf('commandResult = await executeCommand?.()')
const recoveryGuardAt = recovery.indexOf('if (!commandResult?.ok)')
const recoveryInstallAt = recovery.indexOf('await installCommittedEntity?.(commandResult.entity, commandResult)')
assert(
  recoveryCommandAt >= 0 && recoveryGuardAt > recoveryCommandAt && recoveryInstallAt > recoveryGuardAt,
  'Core save recovery must confirm the server command before installing cache',
)
for (const [name, saveMarker, nextName] of [
  ['async function commitStudentProjection', 'saveStoredStudents(students)', 'async function commitTeacherProjection'],
  ['async function commitClassSessionProjection', 'saveStoredClassSessions(classSessions)', 'async function commitScheduleSessionProjection'],
  ['async function commitScheduleSessionProjection', 'saveStoredSchedule(scheduleSessions)', 'async function writeStudentThroughCloud'],
]) {
  const block = functionSlice(content.main, name, nextName)
  includesAll(block, ['runAuthoritativeCoreSave', 'executeCommand:', saveMarker], `${name} recovery ordering`)
}
const bootstrapBlock = functionSlice(content.main, 'function applyCloudBootstrapSnapshotToLocal', 'async function refreshCloudDbReadiness')
includesAll(bootstrapBlock, [
  'students = Array.isArray(snapshot.students) ? snapshot.students : []',
  'teachers = Array.isArray(snapshot.teachers) ? snapshot.teachers : []',
  'classSessions = Array.isArray(snapshot.classSessions) ? snapshot.classSessions : []',
  'scheduleSessions = Array.isArray(snapshot.scheduleSessions) ? snapshot.scheduleSessions : []',
], 'Empty authoritative snapshot replacement')
excludesAll(content.main, [
  'restoreAngelWingsLocalDataset',
  'upsertAngelWingsAttendanceData',
  'removeAngelWingsAttendanceData',
  'data-attendance-board-angel-wings-action',
  'restore-angel-wings-local',
  'getLocalAngelWingsStatus',
  'mergeAngelWingsTeacherRoster',
], 'Retired dataset product runtime')
includesAll(content.cleanup, [
  "const LEGACY_SOURCE_MODULE = 'angel-wings-import'",
  "const LEGACY_SOURCE_TAG = 'angel-wings-2026-06'",
  "'angel-wings-2026-06-f15k5'",
  "'angel-wings-2026-06-attendance'",
  'cleanupLegacyDatasetLocalResidue',
  'hasExactLegacyDatasetIdentity',
], 'Exact legacy residue cleanup')
assert(!content.cleanup.includes('record.isControlledFixture'), 'Cleanup must not delete by broad fixture heuristic')
assert(content.main.includes('cleanupLegacyDatasetLocalResidue(globalThis.localStorage, getCurrentStorageCenterId())'))

includesAll(content.settings, ['...existingClassSession'], 'Class version preservation')
includesAll(content.scheduleModule, ['...existingSession'], 'Schedule version preservation')

includesAll(content.qa, [
  "ICHESS_C5_1_LOCAL_QA_ALLOW_RESET", 'assertLoopback', 'npx --no-install supabase', 'status -o json',
  'supabase_db_ichess-center-os', 'MemoryStorage', 'signIn', 'subscribe',
  'C5_1_A_CREATE_B_SEES_MATRIX: PASS 4/4',
  'C5_1_RETRY_IDEMPOTENCY_MATRIX: PASS 4/4',
  'C5_1_B_EDIT_A_SEES_MATRIX: PASS 4/4',
  'C5_1_CONCURRENT_STALE_EDIT: PASS',
  'C5_1_EMPTY_STORAGE_NEW_CONTEXT_BOOTSTRAP: PASS',
  'C5_1_CROSS_CENTER_AND_WRONG_ROLE: PASS',
  'C5_1_OWNER_CENTER_SWITCH_ISOLATION: PASS',
  'C5_1_REALTIME_CROSS_CENTER_ISOLATION: PASS',
  'C5_1_MEMBERSHIP_CURRENTNESS_READ_WRITE: PASS',
  'C5_1_RLS_DIRECT_CORE_AND_C5_2_ATTENDANCE_DENY: PASS',
  'C5_1_ACL_POSTGREST_POLICY_CATALOG: PASS',
  'C5_1_CLOUD_FAILURE_NO_FALSE_LOCAL_SUCCESS: PASS',
  'C5_1_REALTIME_STUDENT_TEACHER_SCHEDULE: PASS',
  'C5_1_RELOAD_CLASS_SESSION: PASS',
  'C5_1_FINAL_RESET_AUTH_CORE_RESULT_BASELINE_ZERO: PASS',
], 'Guarded multi-account harness')
excludesAll(content.qa, ['supabase link', 'supabase push', '--linked'], 'QA remote safety')

includesAll(content.report, [
  'C5_1_GUARDED_LOCAL_DOCKER_QA: PASS',
  'C5_1_SEMANTIC_SMOKE: PASS',
  'C5_1_TECHNICAL_RE_REVIEW: PASS',
  'C5_1_LEGACY_ANGEL_WINGS_REMOVED: PASS',
  'C5_1_EXACT_CENTER_ISOLATION: PASS',
  'C5_1_REMOTE_APPLY_DEPLOY: NOT RUN',
  'F23_3E_P4B: FROZEN / NOT DONE',
  'C5.1 TECHNICAL RE-REVIEW PASS — ANGEL WINGS REMOVED — CENTER ISOLATION VERIFIED',
  c51ExpectedSha256,
], 'Report truth')
includesAll(content.review, [
  'C5_1_INDEPENDENT_TECHNICAL_RE_REVIEW: PASS',
  'CRITICAL: 0',
  'HIGH: 0',
  'BLOCKING_MEDIUM: 0',
  'C5.1-H01 — RESOLVED',
  'targeted semantic regressions: PASS 19/19',
  c51ExpectedSha256,
], 'Independent re-review truth')
includesAll(content.c50Report, [
  'C5_0_AUDIT_STATUS: PASS',
  'C5_0_SYSTEM_SHARED_TRUTH_ACCEPTANCE: FAIL / REMEDIATION REQUIRED',
  'C5.1 — AUTHORITATIVE CORE CONTRACT + MULTI-ACCOUNT HARNESS',
], 'C5.0 lineage')

for (const value of Object.values(content)) {
  assert(!value.includes('\uFFFD'), 'Replacement character detected')
  assert(!/\r(?!\n)/.test(value), 'Bare carriage return detected')
  assert(!/^(<{7}|={7}|>{7})/m.test(value), 'Conflict marker detected')
}

console.log('C5.1 authoritative core semantic smoke: PASS')
console.log('19 inherited migration hashes: PASS')
console.log(`C5.1 migration SHA-256: ${c51ExpectedSha256}`)
