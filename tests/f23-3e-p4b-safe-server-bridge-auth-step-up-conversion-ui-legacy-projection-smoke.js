import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608130002_f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection.sql',
  report: 'docs/f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection.md',
  smoke: 'tests/f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection-smoke.js',
  qa: 'tests/f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection-local-db-qa.js',
  edge: 'supabase/functions/crm-conversion-bridge/index.ts',
  edgeConfig: 'supabase/functions/crm-conversion-bridge/deno.json',
  adapter: 'src/crm-conversion-bridge.js',
  main: 'src/main.js',
  parent: 'src/parent-consultation-module.js',
  studentDetail: 'src/student-detail.js',
  styles: 'src/styles.css',
  config: 'supabase/config.toml',
}
for (const path of Object.values(paths)) assert(existsSync(join(root, path)), `Missing P4B file: ${path}`)
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const content = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]))
const includesAll = (value, expected, label) => {
  for (const token of expected) assert(value.includes(token), `${label}: missing ${token}`)
}
const excludesAll = (value, forbidden, label) => {
  for (const token of forbidden) assert(!value.includes(token), `${label}: forbidden ${token}`)
}
const functionBlock = (name) => {
  const start = content.migration.search(new RegExp(`create\\s+function\\s+public\\.${name}\\s*\\(`, 'i'))
  assert(start >= 0, `Missing ${name}`)
  const token = `$${name}$;`
  const end = content.migration.indexOf(token, start)
  assert(end >= 0, `Missing terminator ${name}`)
  return content.migration.slice(start, end + token.length)
}

const coreArtifacts = [paths.migration, paths.report, paths.smoke, paths.qa]
const basename = 'f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection'
const actualCore = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => name.startsWith(basename)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.startsWith(basename)).map((name) => `tests/${name}`),
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('_f23_3e_p4b_')).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualCore].sort(), [...coreArtifacts].sort(), 'P4B core package must remain exact')
assert.deepEqual(readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('_f23_3e_p4b_')), [paths.migration.split('/').at(-1)])
assert(!/migrationFiles\.length/.test(content.smoke), 'Do not freeze total migration inventory')

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
])
assert.equal(inheritedHashes.size, 18)
for (const [name, hash] of inheritedHashes) assert.equal(sha256(`supabase/migrations/${name}`), hash, `Inherited drift: ${name}`)
const p4bSha = '677156C5393BA813B6B95E52BC0ECE6F8C79672AF43DD5ED649BF57EA9E9959F'
assert.equal(sha256(paths.migration), p4bSha, 'P4B migration drift')

assert.equal((content.migration.match(/create\s+table\s+public\./gi) || []).length, 1)
includesAll(content.migration, [
  'create table public.crm_conversion_bridge_session',
  'alter table public.crm_conversion_bridge_session enable row level security',
  'alter table public.crm_conversion_bridge_session force row level security',
  'revoke all on table public.crm_conversion_bridge_session from public,anon,authenticated,service_role',
], 'Bridge table security')
for (const forbidden of ['student_profile', 'guardian_profile', 'guardian_student_relationship', 'crm_identity_target_binding']) {
  assert(!new RegExp(`create\\s+table\\s+public\\.${forbidden}`, 'i').test(content.migration), `P4B recreated ${forbidden}`)
}

const externals = [
  'f23_3e_p4b_prepare_conversion', 'f23_3e_p4b_review_conversion',
  'f23_3e_p4b_approve_execute_conversion', 'f23_3e_p4b_read_conversion_status',
]
for (const name of externals) includesAll(functionBlock(name), ['security definer', "set search_path=''"], `${name} hardening`)
assert.equal((content.migration.match(/grant execute on function public\.f23_3e_p4b_/g) || []).length, 4)
includesAll(content.migration, [
  "p.proname like 'f23_3e_p4b_%'", 'revoke all on function %s from public,anon,authenticated,service_role',
  'public.f23_3e_p4a_ingress_canonical_contact', 'public.f23_3e_p2b_search_masked_candidates',
  'public.f23_3e_p2c_create_match_review', 'public.f23_3e_p2c_decide_match_review',
  'public.f23_3e_p2c_reserve_create_target', 'public.f23_3e_p3c_materialize_reviewed_action_pair',
  'public.f23_3e_p3c_finalize_reviewed_action_plan', 'public.f23_3e_p3b_record_verified_conversion_step_up',
  'public.f23_3e_p3b_issue_conversion_authority', 'public.f23_3e_p3d_execute_conversion',
  "v_session.status='COMPLETED'", 'P4B_IDEMPOTENCY_CONFLICT',
  'EXPLICIT_REVIEWED_NO_CREATE', 'REUSE_EXISTING_RELATIONSHIP',
], 'P4B orchestration')
const approve = functionBlock('f23_3e_p4b_approve_execute_conversion')
assert(approve.indexOf("v_session.status='COMPLETED'") < approve.indexOf("v_session.status<>'REVIEWED'"), 'Replay must precede live state reinterpretation')
includesAll(approve, [
  "array['owner','center_admin']", 'P4B_ACTOR_SEPARATION_REQUIRED', "p_assurance_level<>'AAL2_TOTP'",
  "p_verification_provider_namespace<>'supabase.auth.totp.v1'", "interval '2 minutes'",
], 'Approval security')
includesAll(functionBlock('f23_3e_p4b_internal_safe_projection'), [
  "'read_only',true", "'projection_kind','canonical_student_v1'",
  "'projection_kind','canonical_guardian_v1'", "'projection_kind','canonical_guardian_student_relationship_v1'",
], 'Safe projection')

includesAll(content.edge, [
  "admin.auth.getUser(token)", ".eq('center_id', centerId)", ".eq('user_id', user.id)", ".eq('status', 'active')",
  "new Set(['owner', 'center_admin'])", "claims?.aal !== 'aal2'", "entry?.method === 'totp'",
  'nowSeconds - 120', 'admin.auth.admin.mfa.listFactors', "factor.status === 'verified'",
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')", 'FORBIDDEN_FIELDS', "'Cache-Control': 'no-store, max-age=0'",
], 'Edge Auth boundary')
excludesAll(content.edge, [
  'console.log(', 'SUPABASE_SERVICE_ROLE_KEY =', 'service_role_key:',
], 'Edge secret/log hygiene')
includesAll(content.edgeConfig, ['"@supabase/supabase-js": "npm:@supabase/supabase-js@2"'], 'Edge dependency')
includesAll(content.config, [
  '[auth.mfa.totp]', 'enroll_enabled = true', 'verify_enabled = true',
  '[functions.crm-conversion-bridge]', 'verify_jwt = true',
], 'Local Auth/function config')

includesAll(content.adapter, [
  "functions.invoke(functionName", 'auth.mfa.challengeAndVerify', 'sessionStorage',
  'readOnlyProjection: true', 'listLegacyStudentProjections', 'P4B_IDEMPOTENCY_CONFLICT',
], 'Browser adapter')
excludesAll(content.adapter, ['SERVICE_ROLE_KEY', 'saveStoredStudents(', 'lookup_digest', 'ciphertext'], 'Browser authority boundary')
includesAll(content.main, [
  'prepareCanonicalConversion', 'reviewCanonicalConversion', 'verifyFreshTotp',
  'approveAndExecuteCanonicalConversion', 'refreshCanonicalConversion',
  'getStudentsWithCanonicalProjections()', 'bridgeBusy: true',
], 'UI wiring')
includesAll(content.parent, [
  'data-p4b-conversion-action="prepare"', 'data-p4b-conversion-action="review"',
  'data-p4b-conversion-action="execute"', 'data-p4b-conversion-action="refresh"',
  'Projection chỉ đọc', 'DO_NOT_CREATE|', 'REUSE_EXISTING|',
], 'Review/loading/replay UX')
includesAll(content.studentDetail, ['student.readOnlyProjection === true', "readOnlyProjection ? 'disabled' : ''"], 'Read-only legacy projection')

includesAll(content.qa, [
  'ICHESS_P4B_LOCAL_QA_ALLOW_RESET', 'P4B_QA_LOCAL_SAFETY_GUARD: PASS',
  'P4B_QA_RLS_GRANTS_REALTIME: PASS', 'P4B_QA_EDGE_AUTHORIZATION_BOUNDARY: PASS',
  'P4B_QA_PROVIDER_AAL2_CREATE_PROJECTION: PASS', 'P4B_QA_GENUINE_REVIEWED_REUSE_RAPID_RETRY: PASS',
  'P4B_QA_EXPLICIT_NO_TARGET: PASS', 'P4B_QA_FAULT_ATOMIC_ROLLBACK: PASS',
  'P4B_QA_STATUS_PRIVACY_CLEAN_TEMP: PASS', 'P4B_QA_STALE_STEP_UP_FAIL_CLOSED: PASS',
  'P4B_QA_FINAL_RESET: PASS', 'F23_3E_P4B_LOCAL_DOCKER_QA: PASS',
  'auth.mfa.challengeAndVerify', 'Promise.all([',
], 'Guarded QA evidence')
includesAll(content.report, [
  'F23_3E_P4B_IMPLEMENTATION: IMPLEMENTED', 'F23_3E_P4B_LOCAL_DOCKER_QA: PASS',
  'F23_3E_P4B_SEMANTIC_SMOKE: PASS', 'F23_3E_P4B_INHERITED_REGRESSIONS: PASS',
  `F23_3E_P4B_MIGRATION_SHA256: ${p4bSha}`, 'F23_3E_P4B_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_P4B_MANUAL_PRODUCT_E2E: PAUSED / NOT ACCEPTED', 'F23_3E_P4B_REMOTE_APPLY_DEPLOY: NOT RUN',
  'F23_3E_P4B_STATUS: FROZEN / MANUAL PRODUCT E2E PENDING',
  'Manual product E2E ngày 2026-08-13 — PAUSED / NOT ACCEPTED',
  'Sau khi C5 hoàn tất phải quay lại P4B trước mọi feature khác',
], 'Report truth')

for (const value of Object.values(content)) {
  assert(!value.includes('\uFFFD'), 'Replacement character detected')
  assert(!/\r(?!\n)/.test(value), 'Bare carriage return detected')
}

console.log('F23.3E-P4B semantic smoke: PASS')
console.log(`P4B migration SHA-256: ${p4bSha}`)
console.log('18 inherited migration hashes: PASS')
