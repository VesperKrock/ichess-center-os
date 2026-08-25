import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildC53AppendCareLogCommand,
  buildC53AssignCaseCommand,
  buildC53CreateLeadCommand,
  buildC53SaveCaseCommand,
  buildC53UpsertAppointmentCommand,
  canWriteC53CrmSharedTruth,
  mutateC53CrmSharedTruth,
  projectC53CrmRecord,
  pullC53CrmSharedTruth,
} from '../src/cloud-authoritative-crm.js'

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140003_c5_3_crm_authoritative_shared_truth.sql',
  reviewHardening: 'supabase/migrations/202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql',
  adapter: 'src/cloud-authoritative-crm.js',
  main: 'src/main.js',
  module: 'src/parent-consultation-module.js',
  storage: 'src/storage.js',
  report: 'docs/c5-3-crm-authoritative-shared-truth.md',
  qa: 'tests/c5-3-crm-authoritative-shared-truth-local-db-qa.js',
}
for (const value of Object.values(paths)) {
  assert(existsSync(join(root, value)), `Missing C5.3 artifact: ${value}`)
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
  ['202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql', '3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414'],
  ['202608140002_c5_2_baseline_singleton_review_hardening.sql', '76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7'],
])
assert.equal(inheritedHashes.size, 22)
for (const [name, expectedHash] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Inherited migration drift: ${name}`)
}

const c53ExpectedSha256 = '200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80'
assert.equal(sha256(paths.migration), c53ExpectedSha256, 'C5.3 migration SHA drift')
const c53ReviewHardeningExpectedSha256 = '8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247'
assert.equal(
  sha256(paths.reviewHardening),
  c53ReviewHardeningExpectedSha256,
  'C5.3 independent-review hardening migration SHA drift',
)

includesAll(content.migration, [
  'create table public.crm_case_shared_state',
  'references public.consultation_case(center_id, consultation_case_id)',
  'create table public.crm_case_appointment',
  'create table public.crm_shared_command_result',
  'unique (center_id, actor_user_id, idempotency_key)',
  'alter table public.crm_case_shared_state enable row level security',
  'alter table public.crm_case_shared_state force row level security',
  'alter table public.crm_case_appointment enable row level security',
  'alter table public.crm_case_appointment force row level security',
  'alter table public.crm_shared_command_result enable row level security',
  'alter table public.crm_shared_command_result force row level security',
  'from public, anon, authenticated, service_role',
  'create function public.c5_3_list_crm_shared_truth',
  'create function public.c5_3_mutate_crm_shared_truth',
  'v_actor_user_id uuid := auth.uid()',
  "v_role not in ('owner', 'admin', 'center_admin', 'qtv', 'consultant')",
  "v_role not in ('owner', 'admin', 'center_admin', 'qtv')",
  "'CREATE_LEAD', 'SAVE_CASE', 'APPEND_CARE_LOG'",
  "'UPSERT_APPOINTMENT', 'ASSIGN_CASE', 'ARCHIVE_CASE'",
  'from public.f23_3e_p4a_ingress_canonical_contact(',
  'from public.f23_3e_p1d_create_consultation_case(',
  'from public.f23_3e_p1d_transition_consultation_case_status(',
  'from public.f23_3e_p1d_append_crm_care_log(',
  'from public.f23_3e_p1d_assign_consultation_case(',
  'from public.f23_3e_p1d_reassign_consultation_case(',
  "'MASKED_CACHE_ONLY'",
  "'phone', ''",
  "'email', ''",
  'not public.c5_3_contains_protected_identity(local_source_id)',
  'not public.c5_3_contains_protected_identity(client_appointment_id)',
  "public.c5_3_contains_protected_identity(coalesce(v_source_draft_id, ''))",
  'CASE_VERSION_STALE',
  'STATE_VERSION_STALE',
  'APPOINTMENT_VERSION_STALE',
  'ASSIGNMENT_VERSION_STALE',
  "'IDEMPOTENCY_CONFLICT'",
  "'CONCURRENT_CONFLICT'",
  'grant execute on function public.c5_3_list_crm_shared_truth(text) to authenticated',
  'grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid) to authenticated',
], 'C5.3 authoritative SQL contract')
excludesAll(content.migration, [
  'alter publication supabase_realtime',
  'create policy',
  'grant execute on function public.c5_3_list_crm_shared_truth(text) to service_role',
  'grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid) to service_role',
], 'C5.3 ACL/Realtime hold')
includesAll(content.reviewHardening, [
  'rename to c5_3_mutate_crm_shared_truth_v1_internal',
  'create function public.c5_3_audit_candidate_shared_truth_write()',
  'create trigger c5_3_candidate_shared_truth_audit_outbox',
  "'crm.candidate.shared_state_created'",
  "'crm.candidate.shared_state_updated'",
  "public.c5_3_contains_protected_identity(p_command#>>'{contact,display_name}')",
  "public.c5_3_contains_protected_identity(p_command->>'lead_student_name')",
  "pg_catalog.set_config('ichess.c5_3_candidate_write', 'on', true)",
  'public.c5_3_mutate_crm_shared_truth_v1_internal(',
  'from public, anon, authenticated, service_role',
  'grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)',
  'to authenticated',
], 'C5.3 independent-review hardening')
excludesAll(content.reviewHardening, [
  'alter publication supabase_realtime',
  'grant execute on function public.c5_3_mutate_crm_shared_truth_v1_internal',
], 'C5.3 hardening ACL/Realtime hold')
assert(content.migration.indexOf('from public.f23_3e_p1d_transition_consultation_case_status(')
  < content.migration.indexOf("'c5_3_shared_truth_save'"), 'SAVE_CASE must use canonical P1D transition')

includesAll(content.adapter, [
  "supabase.rpc('c5_3_list_crm_shared_truth'",
  "supabase.rpc('c5_3_mutate_crm_shared_truth'",
  "operation: 'CREATE_LEAD'",
  "operation: 'SAVE_CASE'",
  "operation: 'APPEND_CARE_LOG'",
  "operation: 'UPSERT_APPOINTMENT'",
  "operation: 'ASSIGN_CASE'",
  "operation: 'ARCHIVE_CASE'",
  "phone: ''",
  "email: ''",
  'identityReadOnly: true',
  'contactMethodProtected: true',
], 'C5.3 browser adapter')
excludesAll(content.adapter, [
  'localStorage',
  'prepareCanonicalConversion',
  'executeCanonicalConversion',
], 'C5.3 adapter boundary')

const refreshSlice = functionSlice(content.main, 'async function refreshC53CrmSharedTruth', 'async function writeC53CrmCommand')
const writeSlice = functionSlice(content.main, 'async function writeC53CrmCommand', 'function ')
includesAll(refreshSlice, [
  'pullC53CrmSharedTruth',
  'parentConsultations = result.records',
  'parentConsultations = []',
], 'C5.3 authoritative refresh')
assert(refreshSlice.indexOf('parentConsultations = []')
  < refreshSlice.indexOf('pullC53CrmSharedTruth'),
  'C5.3 projection must clear unconditionally before the authoritative pull')
includesAll(writeSlice, [
  'mutateC53CrmSharedTruth',
  "refreshC53CrmSharedTruth({ reason: 'after-server-commit'",
  "outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED'",
], 'C5.3 server-first write')
assert(writeSlice.indexOf('mutateC53CrmSharedTruth')
  < writeSlice.indexOf("refreshC53CrmSharedTruth({ reason: 'after-server-commit'"), 'Server commit must precede projection')
assert.equal((content.main.match(/saveStoredParentConsultations\(/g) || []).length, 0, 'CRM disk cache write bypasses user/role ACL')
includesAll(content.main, [
  "case 'crm':",
  'return refreshC53CrmSharedTruth({ reason, silent: true })',
  "refreshModuleAuthoritativeUpstreams('khach-hang-tu-van', { reason: 'manual-refresh' })",
  'buildC53CreateLeadCommand(nextContact)',
  'buildC53SaveCaseCommand(nextContact',
  'buildC53AppendCareLogCommand(existingContact, careLog)',
  'buildC53UpsertAppointmentCommand(existingContact',
  'buildC53AssignCaseCommand(refreshedContact, requestedConsultantId)',
  'buildC53ArchiveCaseCommand(contact)',
  'await writeC53CrmCommand(',
  'let parentConsultations = []',
  '// account\'s center-scoped disk projection before this session completes an',
], 'C5.3 UI integration')
assert(!content.main.includes('getStoredParentConsultations'), 'CRM disk cache must not render before per-session server authorization')
assert((content.main.match(/parentConsultations = \[\]/g) || []).length >= 3, 'CRM projection must clear at startup/reload/center switch')
includesAll(content.storage, [
  'export function clearStoredParentConsultations()',
  'Deprecated non-destructive compatibility shim',
  'return false',
], 'C5.3 disk-cache purge')
assert(writeSlice.lastIndexOf('c53CrmRetryCommands.delete(retryScope)')
  > writeSlice.indexOf('if (!projection.ok)'), 'Retry key must survive committed projection-refresh failure')
includesAll(content.module, [
  'data-parent-crm-action="refresh"',
  'Dữ liệu dùng chung',
  'identityReadOnly',
  'Tư vấn phụ trách',
], 'C5.3 module projection UX')
assert(!content.main.includes("from './crm-conversion-bridge.js'"), 'Frozen conversion bridge must not be reachable from Parent runtime')

assert.equal(canWriteC53CrmSharedTruth({ role: 'owner', canWrite: true }).ok, true)
assert.equal(canWriteC53CrmSharedTruth({ role: 'teacher', canWrite: true }).ok, false)

const lead = {
  id: 'local-lead-1',
  parentName: 'Parent A',
  phone: '0901234567',
  email: 'parent@example.test',
  leadStudentName: 'Candidate A',
  leadNeed: 'Beginner chess',
  consultationStatus: 'newLead',
  enrollmentDraft: { isReady: true, preferredSchedule: 'Weekend' },
}
const createCommand = buildC53CreateLeadCommand(lead)
assert.equal(createCommand.operation, 'CREATE_LEAD')
assert.deepEqual(createCommand.contact.phones, ['0901234567'])
assert.deepEqual(createCommand.contact.emails, ['parent@example.test'])
assert(!JSON.stringify(createCommand.safe_state).includes('0901234567'))
assert(!JSON.stringify(createCommand.safe_state).includes('parent@example.test'))

const canonicalRecord = projectC53CrmRecord({
  ...lead,
  canonicalCaseId: 'case-1',
  careLogs: [],
  appointments: [],
  enrollmentDraft: {},
})
assert.equal(canonicalRecord.phone, '')
assert.equal(canonicalRecord.email, '')
assert.equal(canonicalRecord.identityReadOnly, true)
assert.equal(canonicalRecord.enrollmentDraft.contactMethodProtected, true)

const versioned = {
  canonicalCaseId: '11111111-1111-4111-8111-111111111111',
  canonicalCandidateId: '22222222-2222-4222-8222-222222222222',
  cloudCaseVersion: 3,
  cloudStateVersion: 2,
  cloudCandidateVersion: 1,
  cloudAssignmentVersion: 1,
  ...lead,
}
assert.equal(buildC53SaveCaseCommand(versioned).expected_case_version, 3)
assert.equal(buildC53AppendCareLogCommand(versioned, { id: 'care-1', content: 'Called' }).expected_case_version, 3)
assert.equal(buildC53UpsertAppointmentCommand(versioned, {
  id: 'appointment-1', scheduledAt: '2026-08-15T09:00:00.000Z', status: 'scheduled',
}).expected_case_version, 3)
assert.equal(buildC53AssignCaseCommand(versioned, '33333333-3333-4333-8333-333333333333').expected_assignment_version, 1)

const pullCalls = []
const pullResult = await pullC53CrmSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async (name, args) => {
    pullCalls.push([name, args])
    return { data: {
      ok: true,
      outcome_code: 'CRM_SHARED_TRUTH_READ',
      center_id: 'center-a',
      projection_cache_policy: 'MASKED_CACHE_ONLY',
      records: [{ ...lead, id: 'local-lead-1', canonicalCaseId: 'case-1' }],
      eligible_consultants: [],
    }, error: null }
  } },
})
assert.equal(pullResult.ok, true)
assert.equal(pullResult.records[0].phone, '')
assert.deepEqual(pullCalls, [['c5_3_list_crm_shared_truth', { p_center_id: 'center-a' }]])

const mutateCalls = []
const mutateResult = await mutateC53CrmSharedTruth({
  centerId: 'center-a',
  idempotencyKey: '44444444-4444-4444-8444-444444444444',
  command: createCommand,
  supabase: { rpc: async (name, args) => {
    mutateCalls.push([name, args])
    return { data: {
      ok: true, outcome_code: 'COMMITTED', case_id: 'case-1', replayed: false,
    }, error: null }
  } },
})
assert.equal(mutateResult.ok, true)
assert.equal(mutateCalls[0][0], 'c5_3_mutate_crm_shared_truth')

const cloudFailure = await mutateC53CrmSharedTruth({
  centerId: 'center-a',
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
  command: createCommand,
  supabase: { rpc: async () => ({ data: null, error: new Error('offline') }) },
})
assert.equal(cloudFailure.ok, false)
assert.equal(cloudFailure.outcome_code, 'SERVER_COMMAND_FAILED')

console.log(`C5_3_MIGRATION_SHA256: ${c53ExpectedSha256}`)
console.log(`C5_3_REVIEW_HARDENING_SHA256: ${c53ReviewHardeningExpectedSha256}`)
console.log('C5_3_INHERITED_MIGRATIONS_UNCHANGED: PASS')
console.log('C5_3_CANONICAL_REUSE_RLS_ACL_MASKING: PASS')
console.log('C5_3_SERVER_FIRST_REFRESH_RETRY_CONFLICT: PASS')
console.log('C5_3_CRM_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS')
