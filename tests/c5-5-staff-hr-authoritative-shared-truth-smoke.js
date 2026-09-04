import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildC55StaffHrUpsertCommand,
  canWriteC55StaffHrSharedTruth,
  createC55StaffHrRetryFingerprint,
  mutateC55StaffHrSharedTruth,
  pullC55StaffHrSharedTruth,
  recordC55StaffHrAccessAudit,
} from '../src/cloud-authoritative-staff-hr.js'
import {
  C55_LEGACY_STAFF_HR_SCOPES,
  getC55LegacyStaffHrManifestKey,
  inspectAndQuarantineC55LegacyStaffHr,
} from '../src/legacy-staff-hr-quarantine.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140007_c5_5_staff_hr_authoritative_shared_truth.sql',
  hardening: 'supabase/migrations/202608140008_c5_5_independent_review_access_projection_attachment_hardening.sql',
  adapter: 'src/cloud-authoritative-staff-hr.js',
  legacy: 'src/legacy-staff-hr-quarantine.js',
  main: 'src/main.js',
  staff: 'src/staff-module.js',
  attachments: 'src/staff-document-attachments-supabase.js',
  report: 'docs/c5-5-staff-hr-authoritative-shared-truth.md',
  qa: 'tests/c5-5-staff-hr-authoritative-shared-truth-local-db-qa.js',
}
for (const path of Object.values(paths)) {
  assert(existsSync(join(root, path)), `Missing C5.5 artifact: ${path}`)
}
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256')
  .update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const content = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]))
const includesAll = (source, tokens, label) => {
  for (const token of tokens) assert(source.includes(token), `${label}: missing ${token}`)
}
const excludesAll = (source, tokens, label) => {
  for (const token of tokens) assert(!source.includes(token), `${label}: forbidden ${token}`)
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
  ['202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql', '3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414'],
  ['202608140002_c5_2_baseline_singleton_review_hardening.sql', '76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7'],
  ['202608140003_c5_3_crm_authoritative_shared_truth.sql', '200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80'],
  ['202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql', '8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247'],
  ['202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql', '60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27'],
  ['202608140006_c5_4_reconciliation_currentness_hardening.sql', 'EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993'],
])
assert.equal(inheritedHashes.size, 26)
for (const [name, hash] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), hash, `Inherited migration drift: ${name}`)
}

includesAll(content.migration, [
  'create table public.center_staff_departments',
  'create table public.center_staff_hr_members',
  'create table public.center_staff_administrative_profiles',
  'create table public.center_staff_documents',
  'alter table public.center_staff_document_attachment_retention_policies',
  'create table public.center_staff_deletion_requests',
  'create table public.center_staff_hr_audit_events',
  'create table public.center_staff_hr_command_results',
  'force row level security',
  'revoke all on table public.center_staff_administrative_profiles from public, anon, authenticated, service_role',
  'create or replace function public.c5_5_list_staff_hr_shared_truth',
  'create or replace function public.c5_5_mutate_staff_hr_shared_truth',
  "v_role not in ('owner', 'center_admin')",
  "'VERSION_STALE'",
  "'IDEMPOTENCY_CONFLICT'",
  "'SEPARATION_OF_DUTIES_REQUIRED'",
  "e.entity_type = 'teacher'",
  'from public.center_members cm where cm.id = v_membership',
  'from public.center_staff_document_attachments a',
  "a.state = 'available'",
  'server-commit',
  'grant execute on function public.c5_5_list_staff_hr_shared_truth(text) to authenticated',
], 'C5.5 SQL contract')
excludesAll(content.migration, [
  'alter publication supabase_realtime',
  'insert into public.center_members',
  'insert into auth.users',
  "insert into public.center_cloud_entities",
  'delete from public.center_staff_hr_members',
  'delete from public.center_staff_documents',
  'profile_payload jsonb',
], 'C5.5 SQL boundary')

assert.equal(
  sha256(paths.migration),
  '63642029F0C6FA298EFCD9577C50F8FB4FD7F93F44190A24EEC602AE064D992C',
  'Accepted C5.5 base migration bytes changed during review',
)
includesAll(content.hardening, [
  'c5_5_guard_staff_document_attachment_parent',
  'staff_document_attachment_authoritative_parent_invalid',
  'rename to c5_5_list_staff_hr_shared_truth_v1',
  'create or replace function public.c5_5_record_staff_hr_access_audit',
  "'administrative-profile.open'",
  "'administrative-profile.reveal-sensitive'",
  "'server-access-audit'",
  "'IDEMPOTENCY_CONFLICT'",
  'grant execute on function public.c5_5_record_staff_hr_access_audit',
], 'C5.5 independent-review hardening')
excludesAll(content.hardening, [
  'delete from public.center_staff',
  'delete from storage.objects',
  'insert into auth.users',
  'insert into public.center_members',
  'insert into public.center_cloud_entities',
], 'C5.5 hardening boundary')

includesAll(content.main, [
  "from './cloud-authoritative-staff-hr.js'",
  "from './legacy-staff-hr-quarantine.js'",
  'refreshC55StaffHrSharedTruth',
  "reason: 'module-open'",
  "reason: 'module-reopen'",
  "reason: 'manual-refresh'",
  'writeC55StaffHrCommand',
  'Thay đổi đã được lưu nhưng chưa tải lại được danh sách mới nhất',
  'staffMembers = result.staffMembers',
  'staffAdministrativeProfiles = result.administrativeProfiles',
  "resetC55StaffHrRuntimeForAccessBoundary('')",
  "if (reason !== 'after-server-commit') clearC55StaffHrTransientUi()",
  'clearC55StaffHrProjection()',
  'commitC55StaffHrAccessAudit',
  'recordC55StaffHrAccessAudit',
], 'C5.5 runtime contract')
excludesAll(content.main, [
  'getStoredCenterStaffMembers',
  'getStoredCenterDepartments',
  'getStoredCenterStaffAdministrativeProfiles',
  'getStoredCenterStaffDocuments',
  'saveStoredCenterStaffMembers',
  'saveStoredCenterDepartments',
  'saveStoredCenterStaffAdministrativeProfiles',
  'saveStoredCenterStaffDocuments',
  'saveStoredCenterStaffAdministrativeRetentionPolicy',
  'saveStoredCenterStaffAdministrativeDeletionRequests',
  'appendStoredCenterStaffAdministrativeAuditEvent',
], 'C5.5 no local authority')
const openProfileBlock = content.main.slice(
  content.main.indexOf('async function openStaffAdministrativeProfileWindow'),
  content.main.indexOf('function startStaffAdministrativeProfileCreate'),
)
assert(!openProfileBlock.includes('moduleId'), 'Staff profile open must not reuse unrelated CRM module scope')
for (const functionName of [
  'function startStaffAdministrativeProfileCreate',
  'function startStaffAdministrativeProfileEdit',
]) {
  const start = content.main.indexOf(functionName)
  const end = content.main.indexOf('\nfunction ', start + functionName.length)
  const block = content.main.slice(start, end)
  assert(block.includes('isC55StaffHrProjectionHealthy(access.centerId)'))
  assert(!block.includes('isC55StaffHrProjectionHealthy(state.centerId)'))
}
const cloudUserSyncBlock = content.main.slice(
  content.main.indexOf('async function syncCloudUser'),
  content.main.indexOf('function createInitialCloudDbState'),
)
const signedOutBranch = cloudUserSyncBlock.slice(
  cloudUserSyncBlock.indexOf('if (!user)'),
  cloudUserSyncBlock.indexOf('const previousUserId'),
)
assert(signedOutBranch.includes("resetC55StaffHrRuntimeForAccessBoundary('')"))
const signedInBoundary = cloudUserSyncBlock.slice(
  cloudUserSyncBlock.indexOf('const previousUserId'),
  cloudUserSyncBlock.indexOf('cloudStatus = {', cloudUserSyncBlock.indexOf('const previousUserId')),
)
assert(signedInBoundary.includes("resetC55StaffHrRuntimeForAccessBoundary('')"))
const refreshBlock = content.main.slice(
  content.main.indexOf('async function refreshC55StaffHrSharedTruth'),
  content.main.indexOf('async function writeC55StaffHrCommand'),
)
assert(refreshBlock.indexOf('clearC55StaffHrProjection()')
  < refreshBlock.indexOf('inspectAndQuarantineC55LegacyStaffHr'))
assert(refreshBlock.indexOf('staffMembers = result.staffMembers')
  > refreshBlock.indexOf('if (!result.ok)'))

includesAll(content.legacy, [
  'ORIGINAL_EXACT_CENTER_KEYS_RETAINED',
  'containsRawHrPayload: false',
  'QUARANTINED_NOT_ACTIVE',
  'MIGRATION_REQUIRED',
  'rawChecksum',
], 'C5.5 legacy safety')
excludesAll(content.legacy, [
  'removeItem(',
  'sources: currentSources, raw',
  'upload',
], 'C5.5 legacy forbidden behavior')

assert.equal(canWriteC55StaffHrSharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'admin' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'teacher' }).ok, false)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'consultant' }).ok, false)

const staffDraft = {
  id: 'staff-static-1', centerId: 'center-a', employeeCode: 'NV-1', fullName: 'Staff A',
  phone: '', email: '', departmentId: '', positionTitle: '', employmentType: 'full-time',
  employmentStatus: 'active', startDate: '', endDate: '', teacherId: '', accountUserId: '',
  membershipId: '', accountLinkedAt: '', note: '', createdAt: 'volatile-a', updatedAt: 'volatile-b',
}
const createOne = buildC55StaffHrUpsertCommand('staff_member', staffDraft)
const createTwo = buildC55StaffHrUpsertCommand('staff_member', {
  ...staffDraft, id: 'staff-static-2', createdAt: 'volatile-c', updatedAt: 'volatile-d',
})
assert.equal(createC55StaffHrRetryFingerprint(createOne), createC55StaffHrRetryFingerprint(createTwo))
assert.equal(createOne.expected_version, 0)

const emptyPull = await pullC55StaffHrSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    departments: [], staff_members: [], administrative_profiles: [], documents: [],
    retention_policy: null, deletion_requests: [], audit_events: [],
  }, error: null }) },
})
assert.equal(emptyPull.ok, true)
assert.deepEqual(emptyPull.staffMembers, [])

const malformedPull = await pullC55StaffHrSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    departments: [],
    staff_members: [
      { id: 'staff-valid', centerId: 'center-a', cloudVersion: 1,
        employmentStatus: 'active', employmentType: 'full-time' },
      { id: 'staff-wrong-center', centerId: 'center-b', cloudVersion: 1,
        employmentStatus: 'active', employmentType: 'full-time' },
    ],
    administrative_profiles: [], documents: [], retention_policy: null,
    deletion_requests: [], audit_events: [],
  }, error: null }) },
})
assert.equal(malformedPull.ok, false)
assert.equal(malformedPull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedPull, 'staffMembers'), false)

const failedMutation = await mutateC55StaffHrSharedTruth({
  centerId: 'center-a', command: createOne, idempotencyKey: crypto.randomUUID(),
  supabase: { rpc: async () => ({ data: null, error: { message: 'offline' } }) },
})
assert.equal(failedMutation.ok, false)
assert.equal(failedMutation.outcome_code, 'SERVER_COMMAND_FAILED')

const accessAuditId = crypto.randomUUID()
const accessAudit = await recordC55StaffHrAccessAudit({
  centerId: 'center-a', action: 'administrative-profile.reveal-sensitive',
  staffMemberId: 'staff-static-1', administrativeProfileId: 'profile-static-1',
  noteSummary: 'identityDocument.number', idempotencyKey: accessAuditId,
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'COMMITTED', center_id: 'center-a',
    audit_event: {
      id: accessAuditId, schemaVersion: 1, centerId: 'center-a',
      actorUserId: crypto.randomUUID(), actorMembershipId: crypto.randomUUID(),
      actorRole: 'owner', action: 'administrative-profile.reveal-sensitive',
      targetType: 'administrative-profile', targetId: 'profile-static-1',
      staffMemberId: 'staff-static-1', administrativeProfileId: 'profile-static-1',
      documentId: '', attachmentId: '', requestId: '', outcome: 'success',
      reasonCode: 'server-access-audit', noteSummary: 'identitydocument.number',
      createdAt: '2026-08-14 01:00:00+00',
    },
  }, error: null }) },
})
assert.equal(accessAudit.ok, true)
assert.equal(accessAudit.auditEvent.createdAt, '2026-08-14T01:00:00.000Z')

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)) }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const centerId = 'center-legacy-a'
const sensitiveMarker = 'SECRET-HR-ID-0123456789'
const legacyStorage = new MemoryStorage({
  [`ichessCenterOS.centerStaffAdministrativeProfiles.${centerId}`]: JSON.stringify([
    { id: 'profile-legacy', schemaVersion: 1, identityDocument: { number: sensitiveMarker } },
  ]),
})
const quarantine = await inspectAndQuarantineC55LegacyStaffHr({
  storage: legacyStorage, centerId, now: () => '2026-08-14T00:00:00.000Z',
})
assert.equal(quarantine.ok, true)
assert.equal(quarantine.migrationRequired, true)
const manifestRaw = legacyStorage.getItem(getC55LegacyStaffHrManifestKey(centerId))
assert(manifestRaw)
assert(!manifestRaw.includes(sensitiveMarker), 'Manifest must not copy sensitive HR plaintext')
assert.equal(JSON.parse(manifestRaw).containsRawHrPayload, false)
assert.equal(
  legacyStorage.getItem(`ichessCenterOS.centerStaffAdministrativeProfiles.${centerId}`)
    .includes(sensitiveMarker),
  true,
  'Original exact-center legacy key must remain recoverable',
)
assert.equal(C55_LEGACY_STAFF_HR_SCOPES.length, 7)
const emptyLegacy = await inspectAndQuarantineC55LegacyStaffHr({
  storage: new MemoryStorage(), centerId: 'center-empty',
})
assert.equal(emptyLegacy.ok, true)
assert.equal(emptyLegacy.migrationRequired, false)
assert(Object.values(emptyLegacy.classifications).every((entry) =>
  entry.classification === 'RECONSTRUCTABLE_CACHE'))
legacyStorage.setItem(
  `ichessCenterOS.centerStaffAdministrativeProfiles.${centerId}`,
  JSON.stringify([{ id: 'changed-after-manifest', schemaVersion: 1 }]),
)
const driftedLegacy = await inspectAndQuarantineC55LegacyStaffHr({
  storage: legacyStorage, centerId,
})
assert.equal(driftedLegacy.ok, false)
assert.match(driftedLegacy.error, /đã thay đổi sau kiểm kê/)

console.log(`C5_5_MIGRATION_SHA256: ${sha256(paths.migration)}`)
console.log(`C5_5_REVIEW_HARDENING_SHA256: ${sha256(paths.hardening)}`)
console.log('C5_5_STAFF_HR_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS')
