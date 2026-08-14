import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES,
  mutateAuthoritativeAttendanceTuitionEntities,
} from '../src/cloud-authoritative-attendance-tuition.js'
import {
  mergeC51CloudRecordsIntoLocal,
} from '../src/cloud-attendance-realtime.js'
import {
  mergeC52TuitionCloudRecordsIntoLocal,
} from '../src/cloud-tuition-record-package-bridge.js'

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql',
  hardeningMigration: 'supabase/migrations/202608140002_c5_2_baseline_singleton_review_hardening.sql',
  report: 'docs/c5-2-attendance-tuition-authoritative-shared-truth.md',
  review: 'docs/c5-2-independent-technical-review.md',
  smoke: 'tests/c5-2-attendance-tuition-authoritative-shared-truth-smoke.js',
  qa: 'tests/c5-2-attendance-tuition-authoritative-shared-truth-local-db-qa.js',
  adapter: 'src/cloud-authoritative-attendance-tuition.js',
  attendanceBridge: 'src/cloud-attendance-realtime.js',
  tuitionBridge: 'src/cloud-tuition-record-package-bridge.js',
  attendanceRecords: 'src/attendance-records.js',
  sessionReports: 'src/cloud-session-reports.js',
  main: 'src/main.js',
  schedule: 'src/schedule-module.js',
  tuitionModule: 'src/tuition-module.js',
  c51Report: 'docs/c5-1-authoritative-core-contract-and-multi-account-harness.md',
}
for (const value of Object.values(paths)) {
  assert(existsSync(join(root, value)), `Missing C5.2 dependency: ${value}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256')
  .update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const content = Object.fromEntries(
  Object.entries(paths).map(([key, value]) => [key, read(value)]),
)
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
  ['202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql', '2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754'],
])
assert.equal(inheritedHashes.size, 20)
for (const [name, expectedHash] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Inherited migration drift: ${name}`)
}
const c52ExpectedSha256 = '3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414'
assert.equal(sha256(paths.migration), c52ExpectedSha256, 'C5.2 migration SHA drift')
const c52HardeningExpectedSha256 = '76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7'
assert.equal(
  sha256(paths.hardeningMigration),
  c52HardeningExpectedSha256,
  'C5.2 baseline singleton hardening migration SHA drift',
)

assert.deepEqual(AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES, [
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
])
includesAll(content.migration, [
  'create table public.center_operational_command_result',
  'alter table public.center_operational_command_result enable row level security',
  'alter table public.center_operational_command_result force row level security',
  'unique (center_id, actor_user_id, idempotency_key)',
  'create or replace function public.c5_2_mutate_attendance_tuition_entities(',
  'security definer', "set search_path = ''", 'v_actor_user_id uuid := auth.uid()',
  "v_role not in ('owner', 'qtv', 'center_admin', 'admin')",
  "'attendance_record', 'attendance_baseline_state', 'session_report'",
  "'tuition_record_package'",
  'for share of cm, c', 'for update',
  'entity_version = e.entity_version + 1',
  "'VERSION_CONFLICT'", "'IDEMPOTENCY_CONFLICT'", "'CONCURRENT_CONFLICT'",
  "'BASELINE_STATE_REQUIRED'", "'BASELINE_LOCKED'",
  "'ATTENDANCE_TUITION_BOUNDARY_VIOLATION'",
  "'attendanceIsCanonical', false",
  "'canonicalAttendanceEntity', 'attendance_record'",
], 'C5.2 authoritative SQL contract')
includesAll(content.migration, [
  'drop policy if exists "c5_1 center writers insert noncore cloud entities"',
  'c5_2 center writers insert remaining noncore cloud entities',
  'c5_2 center writers update remaining noncore cloud entities',
  'c5_2 center writers delete remaining noncore cloud entities',
  'revoke all on table public.center_operational_command_result',
  'from public, anon, service_role',
  'to authenticated',
], 'C5.2 RLS and ACL contract')
assert(!/grant execute[\s\S]*to\s+(anon|public|service_role)/i.test(content.migration), 'RPC grant widened')
includesAll(content.hardeningMigration, [
  'create unique index center_cloud_entities_c5_2_baseline_singleton_idx',
  "where entity_type = 'attendance_baseline_state'",
], 'C5.2 baseline singleton hardening')

const replayAt = content.migration.indexOf('v_existing_result.result_snapshot')
const currentnessAt = content.migration.indexOf('-- Validate currentness for the whole batch')
const mutationAt = content.migration.indexOf('insert into public.center_cloud_entities', currentnessAt)
assert(replayAt > 0 && currentnessAt > replayAt && mutationAt > currentnessAt, 'Replay/currentness/commit order drift')

includesAll(content.adapter, [
  "supabase.rpc('c5_2_mutate_attendance_tuition_entities'",
  'createOperationalCommandIdempotencyKey',
  'createAuthoritativeAttendanceTuitionMutation',
  'projectAuthoritativeAttendanceTuitionRecord',
  'getAuthoritativeAttendanceTuitionVersion',
  "VERSION_CONFLICT: '", "IDEMPOTENCY_CONFLICT: '",
  "BASELINE_LOCKED: '", "ATTENDANCE_TUITION_BOUNDARY_VIOLATION:",
], 'Browser C5.2 authoritative adapter')
includesAll(content.attendanceBridge, [
  'entity_version',
  'mutateAuthoritativeAttendanceTuitionEntities',
  'authoritativeSnapshot = false',
  'incomingVersion <= currentVersion',
  'replaceBaselineRecords',
  "operation: 'DELETE'",
  'filter: `center_id=eq.${normalizedCenterId}`',
], 'Attendance/baseline/report bridge')
includesAll(content.tuitionBridge, [
  'entity_version',
  'mutateAuthoritativeAttendanceTuitionEntities',
  'authoritativeSnapshot = false',
  'incomingVersion <= currentVersion',
  'attendanceLinked: false',
  'attendanceAutoUpdateEnabled: false',
  'usedSessionsAutoUpdateFromAttendance: false',
  'remainingSessionsAutoUpdateFromAttendance: false',
  'filter: `center_id=eq.${normalizedCenterId}`',
], 'Tuition bridge')
includesAll(content.attendanceRecords, [
  'cloudVersion: normalizeCloudVersion(record.cloudVersion)',
  'cloudVersion: existingRecord?.cloudVersion || 0',
  'cloudVersion: normalizeCloudVersion(sourceState.cloudVersion)',
], 'Attendance version preservation')
includesAll(content.sessionReports, [
  'cloudVersion: normalizeCloudVersion(state.cloudVersion)',
  'cloudVersion: normalizeCloudVersion(report.cloudVersion)',
], 'Baseline/session report version preservation')
includesAll(content.schedule, [
  'cloudVersion: existingReport?.cloudVersion ?? 0',
], 'Session report form version preservation')

const attendanceWriter = functionSlice(
  content.main,
  'async function writeC52AttendanceSessionReportThroughCloud',
  'async function startC51AttendanceRealtimeSubscription',
)
const attendanceAwaitAt = attendanceWriter.indexOf('await upsertC51AttendanceSessionReportCloudEntities')
const attendanceProjectionAt = attendanceWriter.indexOf('saveStoredAttendanceRecords')
assert(attendanceAwaitAt >= 0 && attendanceProjectionAt > attendanceAwaitAt, 'Attendance projection precedes server commit')
includesAll(attendanceWriter, [
  'c52AttendanceRetryCommands',
  'createOperationalCommandIdempotencyKey',
  'createC52OperationalRetryFingerprint',
  'command.idempotencyKey',
  'isC52RetryableOperationalFailure',
], 'Attendance exact retry runtime')

const tuitionWriter = functionSlice(
  content.main,
  'async function writeC52TuitionRecordPackageThroughCloud',
  'async function writeC53TuitionAuditLogEntry',
)
const tuitionAwaitAt = tuitionWriter.indexOf('await upsertC52TuitionRecordPackageCloudEntities')
const tuitionProjectionAt = tuitionWriter.indexOf('saveStoredTuition')
assert(tuitionAwaitAt >= 0 && tuitionProjectionAt > tuitionAwaitAt, 'Tuition projection precedes server commit')

const tuitionFormHandler = functionSlice(
  content.main,
  'const handleTuitionFormSave = async',
  "document.querySelectorAll('[data-tuition-form-field]')",
)
const formCommitAt = tuitionFormHandler.indexOf('await writeC52TuitionRecordPackageThroughCloud')
const formSuccessAt = tuitionFormHandler.indexOf('tuitionFormState = null', formCommitAt)
assert(formCommitAt >= 0 && formSuccessAt > formCommitAt, 'Tuition UI success precedes server commit')
includesAll(tuitionFormHandler, [
  'pendingAuthoritativeRecord', 'commandIdempotencyKey', 'isSaving: true',
], 'Tuition UI exact retry')

excludesAll(content.main, [
  'void writeC52AttendanceSessionReportThroughCloud',
  'removeDemoAttendanceReports(sessionReports)',
  'C5.1 realtime ready; attendance/session report cloud empty, giữ cache local.',
  'C5.2C tuition cloud ready; cloud empty, giu cache Hoc phi local.',
], 'No local-first/fallback C5.2 runtime')
assert.equal((content.main.match(/saveStoredAttendanceRecords\(/g) || []).length, 3, 'Attendance cache writes must stay in bootstrap/commit/realtime projection paths')
assert.equal((content.main.match(/saveAttendanceBaselineState\(/g) || []).length, 3, 'Baseline cache writes must stay in bootstrap/commit/realtime projection paths')
assert.equal((content.main.match(/saveStoredSessionReports\(/g) || []).length, 3, 'Session report cache writes must stay in bootstrap/commit/realtime projection paths')
assert.equal((content.main.match(/saveStoredTuition\(/g) || []).length, 3, 'Tuition cache writes must stay in bootstrap/commit/realtime projection paths')

includesAll(content.tuitionModule, [
  'buildTuitionAttendancePreviewMap',
  'const storedUsedSessions = Number(tuition?.usedSessions)',
  'const attendanceCreditCount',
  'Theo điểm danh:',
], 'Attendance to Tuition preview')
excludesAll(content.tuitionModule, [
  'usedSessionsAutoUpdateFromAttendance = true',
  'attendanceAutoUpdateEnabled = true',
], 'Attendance to Tuition mutation')

const rpcCalls = []
const successfulRpc = {
  rpc: async (name, args) => {
    rpcCalls.push({ name, args })
    return {
      data: {
        ok: true,
        outcome_code: 'COMMITTED',
        replayed: false,
        results: args.p_mutations.map((item, index) => ({
          ok: true,
          outcome_code: 'COMMITTED',
          center_id: args.p_center_id,
          entity_type: item.entity_type,
          local_id: item.local_id,
          entity_version: index + 1,
          updated_at: '2026-08-14T00:00:00.000Z',
          deleted_at: null,
          payload: item.payload,
        })),
      },
      error: null,
    }
  },
}
const adapterResult = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase: successfulRpc,
  centerId: 'center-a',
  idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  mutations: [{
    entityType: 'attendance_record',
    localId: 'attendance_record::a',
    expectedVersion: 0,
    entity: {
      id: 'a', studentId: 'student-a', date: '2026-08-14', source: 'admin',
      attendanceStatus: 'present', updatedAt: 'client-time', cloudVersion: 99,
    },
  }],
})
assert.equal(adapterResult.ok, true)
assert.equal(adapterResult.records.length, 1)
assert.equal(rpcCalls.length, 1)
assert.equal(rpcCalls[0].name, 'c5_2_mutate_attendance_tuition_entities')
assert.equal(rpcCalls[0].args.p_mutations[0].expected_version, 0)
assert(!Object.hasOwn(rpcCalls[0].args.p_mutations[0].payload, 'cloudVersion'))

const networkFailure = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase: { rpc: async () => ({ data: null, error: { message: 'synthetic outage' } }) },
  centerId: 'center-a',
  idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  mutations: [{
    entityType: 'session_report',
    localId: 'session_report::a',
    expectedVersion: 0,
    entity: { id: 'a', sessionId: 'session-a' },
  }],
})
assert.equal(networkFailure.ok, false)
assert.equal(networkFailure.outcome_code, 'SERVER_COMMAND_FAILED')

const rejectedNetworkFailure = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase: { rpc: async () => { throw new Error('synthetic rejected fetch') } },
  centerId: 'center-a',
  idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  mutations: [{
    entityType: 'session_report',
    localId: 'session_report::b',
    expectedVersion: 0,
    entity: { id: 'b', sessionId: 'session-b' },
  }],
})
assert.equal(rejectedNetworkFailure.ok, false)
assert.equal(rejectedNetworkFailure.outcome_code, 'SERVER_COMMAND_FAILED')

const attendanceLocal = {
  id: 'attendance-a', studentId: 'student-a', date: '2026-08-14', source: 'admin',
  attendanceStatus: 'present', status: 'present', cloudVersion: 2,
}
const staleAttendanceMerge = mergeC51CloudRecordsIntoLocal({
  attendanceRecords: [attendanceLocal],
  cloudRecords: [{
    entity_type: 'attendance_record', local_id: 'attendance-record::student-a::2026-08-14::session::admin::empty',
    entity_version: 1, updated_at: '2099-01-01T00:00:00.000Z',
    payload: { ...attendanceLocal, attendanceStatus: 'absent', status: 'absent', cloudVersion: undefined },
  }],
})
assert.equal(staleAttendanceMerge.changed, false, 'Stale attendance event overrode newer projection')
assert.equal(staleAttendanceMerge.attendanceRecords[0].attendanceStatus, 'present')

const emptyAttendanceSnapshot = mergeC51CloudRecordsIntoLocal({
  attendanceRecords: [attendanceLocal],
  baselineState: { status: 'locked', cloudVersion: 2 },
  sessionReports: [{ id: 'report-a', sessionId: 'session-a', learningGroups: [{}], cloudVersion: 2 }],
  cloudRecords: [],
  authoritativeSnapshot: true,
})
assert.equal(emptyAttendanceSnapshot.attendanceRecords.length, 0)
assert.deepEqual(emptyAttendanceSnapshot.baselineState, {})
assert.equal(emptyAttendanceSnapshot.sessionReports.length, 0)

const tuitionLocal = {
  id: 'tuition-a', studentId: 'student-a', totalSessions: 12, usedSessions: 2,
  totalAmount: 100, paidAmount: 50, payments: [], cloudVersion: 2,
}
const staleTuitionMerge = mergeC52TuitionCloudRecordsIntoLocal({
  tuitionRecords: [tuitionLocal],
  cloudRecords: [{
    center_id: 'center-a', entity_type: 'tuition_record_package',
    local_id: 'tuition_record_package::tuition-a', entity_version: 1,
    updated_at: '2099-01-01T00:00:00.000Z',
    payload: { ...tuitionLocal, usedSessions: 99, cloudVersion: undefined },
  }],
})
assert.equal(staleTuitionMerge.changed, false, 'Stale tuition event overrode newer projection')
assert.equal(staleTuitionMerge.tuitionRecords[0].usedSessions, 2)
const emptyTuitionSnapshot = mergeC52TuitionCloudRecordsIntoLocal({
  tuitionRecords: [tuitionLocal], cloudRecords: [], authoritativeSnapshot: true,
})
assert.equal(emptyTuitionSnapshot.tuitionRecords.length, 0)

includesAll(content.qa, [
  'ICHESS_C5_2_LOCAL_QA_ALLOW_RESET',
  'assertLoopback', 'npx --no-install supabase', 'status -o json',
  'supabase_db_ichess-center-os', 'MemoryStorage', 'signIn', 'subscribe',
  'C5_2_A_CREATE_B_SEES_MATRIX: PASS 4/4',
  'C5_2_EXACT_RETRY_IDEMPOTENCY: PASS',
  'C5_2_B_UPDATE_A_CONVERGES_MATRIX: PASS 4/4',
  'C5_2_BASELINE_LOCK_STALE_ATOMIC_DENY: PASS',
  'C5_2_BASELINE_SINGLETON_LOCK_BYPASS_DENY: PASS',
  'C5_2_FRESH_EMPTY_STORAGE_BOOTSTRAP: PASS',
  'C5_2_CROSS_CENTER_ZERO_AND_WRONG_ROLE: PASS',
  'C5_2_REALTIME_CROSS_CENTER_ISOLATION: PASS',
  'C5_2_OWNER_CENTER_SWITCH_ISOLATION: PASS',
  'C5_2_ATTENDANCE_TUITION_READ_ONLY_BOUNDARY: PASS',
  'C5_2_CLOUD_FAILURE_NO_FALSE_LOCAL_SUCCESS: PASS 4/4',
  'C5_2_RLS_RPC_ACL_FAIL_CLOSED: PASS',
  'C5_2_COMPACT_C5_1_CORE_REGRESSION: PASS',
  'C5_2_MEMBERSHIP_CURRENTNESS: PASS',
  'C5_2_FINAL_RESET_AUTH_OPERATIONAL_CORE_BASELINE_ZERO: PASS',
], 'Guarded C5.2 multi-account harness')
excludesAll(content.qa, ['supabase link', 'supabase push', '--linked'], 'QA remote safety')

includesAll(content.report, [
  'C5_2_GUARDED_LOCAL_DB_QA: PASS',
  'C5_2_SEMANTIC_SMOKE: PASS',
  'C5_2_TARGETED_REGRESSIONS: PASS',
  'C5_2_REMOTE_APPLY_DEPLOY: NOT RUN',
  'F23_3E_P4B: FROZEN / NOT DONE',
  c52ExpectedSha256,
], 'C5.2 evidence report')
includesAll(content.review, [
  'C5_2_INDEPENDENT_TECHNICAL_REVIEW: PASS',
  'CRITICAL_OPEN: 0',
  'HIGH_OPEN: 0',
  'BLOCKING_MEDIUM_OPEN: 0',
  'Baseline alternate-identity lock bypass — REMEDIATED',
  '`teacher`', '`consultant`', '`viewer` read-only',
  'C5_3_IMPLEMENTATION: NOT STARTED',
  c52ExpectedSha256,
  c52HardeningExpectedSha256,
], 'C5.2 independent review artifact')
includesAll(content.c51Report, [
  'C5_1_TECHNICAL_RE_REVIEW: PASS',
  'F23_3E_P4B: FROZEN / NOT DONE',
], 'C5.1 lineage')

for (const value of Object.values(content)) {
  assert(!value.includes('\uFFFD'), 'Replacement character detected')
  assert(!/\r(?!\n)/.test(value), 'Bare carriage return detected')
  assert(!/^(<{7}|={7}|>{7})/m.test(value), 'Conflict marker detected')
}

console.log('C5.2 attendance + tuition authoritative semantic smoke: PASS')
console.log('20 inherited migration hashes: PASS')
console.log(`C5.2 migration SHA-256: ${c52ExpectedSha256}`)
console.log(`C5.2 baseline singleton hardening SHA-256: ${c52HardeningExpectedSha256}`)
