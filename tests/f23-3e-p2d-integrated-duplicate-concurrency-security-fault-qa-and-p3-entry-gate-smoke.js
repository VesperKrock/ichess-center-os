import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const reportRelative = 'docs/f23-3e-p2d-integrated-duplicate-concurrency-security-fault-qa-and-p3-entry-gate.md'
const smokeRelative = 'tests/f23-3e-p2d-integrated-duplicate-concurrency-security-fault-qa-and-p3-entry-gate-smoke.js'
const qaRelative = 'tests/f23-3e-p2d-integrated-duplicate-concurrency-security-fault-qa-and-p3-entry-gate-local-db-qa.js'
const canonicalRoadmapRelative = 'docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md'
const localRoadmapRelative = 'RoadmapRealTime.txt'
const artifacts = [reportRelative, smokeRelative, qaRelative]
const migrationDirectory = join(root, 'supabase', 'migrations')

for (const relative of [...artifacts, canonicalRoadmapRelative, localRoadmapRelative]) {
  assert(existsSync(join(root, relative)), `Missing required file: ${relative}`)
}
const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const count = (content, pattern) => [...content.matchAll(pattern)].length
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const canonicalRoadmap = read(canonicalRoadmapRelative)
const localRoadmap = read(localRoadmapRelative)

const p2dPhaseToken = /f23[-_]3e[-_]p2d(?![a-z0-9])/i
assert(p2dPhaseToken.test('f23_3e_p2d_gate'))
for (const phase of ['p2', 'p2a', 'p2b', 'p2c', 'p2da', 'p2d2', 'p2e', 'p3']) {
  assert(!p2dPhaseToken.test(`f23_3e_${phase}_future`), `P2D ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs'))
    .filter((name) => p2dPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests'))
    .filter((name) => p2dPhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationDirectory)
    .filter((name) => p2dPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P2D must own exactly three artifacts')

const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()
const checkpointHashes = new Map([
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
])
assert.equal(checkpointHashes.size, 14)
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing checkpoint migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
assert.deepEqual(migrationFiles.filter((name) => p2dPhaseToken.test(name)), [], 'P2D must own zero migrations')

includesAll(report, [
  'F23_3E_P2D_STATUS: QA COMPLETED IN REPO',
  'F23_3E_P2D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P2D_MIGRATION_CREATED: NO',
  'F23_3E_P2D_RUNTIME_CHANGE: NO',
  'F23_3E_P2D_LOCAL_DB_QA: PASS',
  'F23_3E_P2D_REMOTE_APPLY: NOT RUN',
  'F23_3E_P2D_AUTH_CHANGE: NO',
  'F23_3E_P2D_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P2D_DEPLOY: NOT RUN',
  'F23_3E_P2D_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'P2D_CHECKPOINT_MIGRATION_HASH_COUNT: 14',
  'P2D_OWNED_MIGRATION_COUNT: 0',
], 'P2D report status')

includesAll(report, [
  'F23.13C fresh server-derived step-up runtime | ABSENT',
  'Single-use approval/authority runtime | ABSENT',
  'F23.13D final capability resolver | ABSENT',
  'Current Student storage/write paths | PARTIAL',
  'Canonical protected Student writer | ABSENT',
  'Student writer identity-mutex participation | ABSENT',
  'Audited Student reuse authority | ABSENT',
  'Guardian canonical target adapter | ABSENT',
  'Guardian canonical writer | ABSENT',
  'Guardian–Student relationship writer | ABSENT',
  'P3_STEP_UP_AUTHORITY_RUNTIME: BLOCKED_PREREQUISITE',
  'P3_FINAL_CAPABILITY_RUNTIME: BLOCKED_PREREQUISITE',
  'P3_STUDENT_CREATE_TARGET_WRITE: BLOCKED_PREREQUISITE',
  'P3_STUDENT_REUSE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_CREATE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_REUSE: BLOCKED_PREREQUISITE',
  'P3_GUARDIAN_STUDENT_RELATIONSHIP_WRITE: BLOCKED_PREREQUISITE',
  'P2D_P2_FOUNDATION_READY_FOR_P3_IMPLEMENTATION: YES',
  'P2D_REAL_CONVERSION_EXECUTION_READY: NO',
  'P2D_P3_BLOCKING_PREREQUISITE_COUNT: 7',
], 'P3 prerequisite inventory')

const qaMarkers = [
  'P2D_QA_LOCAL_SAFETY_GUARD: PASS',
  'P2D_QA_LOCAL_SQL_APPLY: PASS',
  'P2D_QA_STRONG_DUPLICATE_REVIEW_ONLY: PASS',
  'P2D_QA_NO_MATCH_TO_ACTIVE_RESERVATION_CHAIN: PASS',
  'P2D_QA_P2_NEVER_GRANTS_CONVERSION_AUTHORITY: PASS',
  'P2D_QA_RESERVATION_CONSUME_BLOCKED_UNTIL_P3: PASS',
  'P2D_QA_INTEGRATED_IDEMPOTENCY: PASS',
  'P2D_QA_INTEGRATED_AUDIT_OUTBOX: PASS',
  'P2D_QA_SEARCH_FAILURE_NEVER_BECOMES_NO_MATCH: PASS',
  'P2D_QA_EXACT_CENTER_NON_DISCLOSURE: PASS',
  'P2D_QA_MULTI_ACCOUNT_SCOPE: PASS',
  'P2D_QA_REAL_LOCK_WAIT_OBSERVED: PASS',
  'P2D_QA_CANONICAL_LOCK_ORDER: PASS',
  'P2D_QA_RACE_MATRIX_16: PASS',
  'P2D_QA_NEGATIVE_MATRIX_24: PASS',
  'P2D_QA_FAULT_ROLLBACK: PASS',
  'P2D_QA_DIRECT_API_FAIL_CLOSED: PASS',
  'P2D_QA_FINAL_LOCAL_RESET: PASS',
  'P2D_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P2D_QA_NONDEFAULT_ROOT_COUNT: 0',
  'P2D_QA_TEMP_HELPER_COUNT: 0',
  'P2D_QA_VAULT_SECRET_COUNT: 0',
]
includesAll(report, qaMarkers, 'P2D report QA evidence')
includesAll(qa, qaMarkers.filter((marker) => !marker.endsWith(': 0')), 'P2D executable QA markers')
includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P2D_LOCAL_QA_ALLOW_RESET'",
  "localArgs('status -o json')",
  "localArgs('db reset')",
  "const expectedContainerName = 'supabase_db_ichess-center-os'",
  'pg_catalog.pg_blocking_pids(pid)',
  "wait_event_type='Lock'",
  '/rest/v1/rpc/',
  'finally {',
], 'Guarded integrated runner substance')
for (const forbidden of ['supabase link', 'supabase db p' + 'ush', 'supabase db p' + 'ull', 'migration repair']) {
  assert(!qa.includes(forbidden), `Forbidden runner operation: ${forbidden}`)
}

assert.equal(count(report, /^\| P2-R(?:[1-9]|1[0-6])\b/gm), 16, 'P2 race disposition count drift')
assert.equal(count(report, /^\| P2-N(?:[1-9]|1[0-9]|2[0-4])\b/gm), 24, 'P2 negative disposition count drift')
assert.equal(count(report, /\| EXECUTED PASS \|/g), 11, 'Executed race count drift')
assert.equal(count(report, /\| DEPENDENCY-BLOCKED FAIL-CLOSED \|/g), 5, 'Dependency-blocked race count drift')

const f13c = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const f13d = read('docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md')
const p2bReport = read('docs/f23-3e-p2b-versioned-normalization-and-exact-center-masked-candidate-search.md')
const p2cReport = read('docs/f23-3e-p2c-reviewed-match-decision-and-create-new-reservation-typed-runtime.md')
const relationshipDesign = read('docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md')
const studentWriter = read('src/cloud-realtime-students.js')
const cloudWriter = read('src/cloud-db-sync.js')
includesAll(f13c, ['F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED', 'SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO'], 'F23.13C runtime truth')
includesAll(f13d, ['F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED', 'CONSULTANT_CAPABILITY_RESOLVER_IMPLEMENTED: NO'], 'F23.13D runtime truth')
includesAll(p2bReport, [
  'P2B_GUARDIAN_TARGET_SEARCH: BLOCKED_ADAPTER_ABSENT',
  'P2B_CURRENT_STUDENT_WRITERS_PARTICIPATE_IN_IDENTITY_MUTEX: NO',
  'P2B_NO_MATCH_IS_PROFILE_CREATE_AUTHORITY: NO',
], 'P2B current boundaries')
includesAll(p2cReport, [
  'F23_3E_P2C_RESERVATION_CONSUME_RUNTIME: NOT IMPLEMENTED — P3',
  'P2C_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'P2C_STRONG_NAME_BIRTH_AUTO_REUSE: NO',
  'P2C_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO',
], 'P2C current boundaries')
includesAll(relationshipDesign, ['F23_2_RUNTIME_IMPLEMENTATION: NOT STARTED', 'F23_2_CANONICAL_BACKEND_IMPLEMENTED: NO'], 'Relationship runtime truth')
includesAll(studentWriter, ['upsertStudentCloudEntity', 'upsertCloudEntities'], 'Current Student writer truth')
includesAll(cloudWriter, [".from('center_cloud_entities')", '.upsert(records'], 'Generic cloud writer truth')
assert(!studentWriter.includes('crm_identity_match_mutex'))
assert(!cloudWriter.includes('crm_identity_match_mutex'))

const p2bMigration = read('supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql')
const p2cMigration = read('supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql')
includesAll(p2bMigration, [
  "'reuse_eligible', false",
  "'adapter_namespace', 'legacy.center_cloud_student.readonly.v1'",
  "return public.f23_3e_p2b_internal_safe_result('MATCH_SEARCH_UNAVAILABLE')",
  'order by m.identity_match_mutex_key',
], 'P2B fail-closed runtime')
includesAll(p2cMigration, [
  "'profile_created', false",
  "'profile_reused', false",
  "'conversion_approved', false",
  "'request_completed', false",
  "'future.student.profile.v1'",
], 'P2C non-authority runtime')
assert(!/set\s+status\s*=\s*'CONSUMED'/i.test(p2cMigration), 'P2C must not consume reservations')
assert(!/\b(?:guardian|student)_profile\s*\(/i.test(p2cMigration), 'P2C must not write profiles')
assert(!/guardian_student_relationship/i.test(p2cMigration), 'P2C must not write relationships')

const currentP2Line = 'F23.3E-P2 DONE backend/local verified / Identity matching, duplicate review, normalization, masked search, reviewed decisions và P3-entry gate PASS'
const currentP2DLine = 'F23.3E-P2D DONE QA/local verified / Integrated duplicate, concurrency, security và fault QA'
includesAll(localRoadmap, [
  currentP2Line,
  currentP2DLine,
  'F23.3E-P3 DONE backend/local verified',
  'F23.3E-P4A DONE backend/local verified',
], 'Current P2 closeout roadmap state')
assert.equal(localRoadmap.split('F23.3E-P2 DONE backend/local verified').length - 1, 1, 'P2 must have exactly one current DONE status')
assert.equal(localRoadmap.split('F23.3E-P2D DONE QA/local verified').length - 1, 1, 'P2D must have exactly one current DONE status')
assert(!localRoadmap.includes('F23.3E-P2D TODO QA'), 'Stale P2D TODO marker must be removed')
assert(canonicalRoadmap.includes('F23.3E-P2D DONE QA/local verified'), 'Historical P2D checkpoint evidence drifted')

const auditedContent = [report, smoke, qa].join('\n')
for (const value of [
  'C\u0103\u00a1\u00c2\u00ba', '\u0103\u0192', '\u0103\u2020\u00b0',
  'H\u0103\u00a1\u00c2\u00ba', '\u0103\u00a1\u00c2\u00bb',
  'Bu\u0103\u00a1\u00c2\u00bb\u00e2\u20ac\u00a2i h\u0103\u00a1\u00c2\u00bb\u00c2\u008dc m\u0103\u00a1\u00c2\u00bb\u00e2\u20ac\u00bai',
]) assert(!auditedContent.includes(value), `Mojibake detected: ${value}`)
assert(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(auditedContent), 'JWT-like token found in P2D artifacts')
assert(!/(?:sk|sbp|ghp)_[A-Za-z0-9_-]{16,}/.test(auditedContent), 'Secret-like token found in P2D artifacts')
assert(!/[a-z0-9-]{10,}\.supabase\.co/i.test(auditedContent), 'Remote project locator found in P2D artifacts')

const totalInventoryExpression = ['migrationFiles', 'length'].join('.')
assert(!smoke.includes(`${totalInventoryExpression} ===`), 'P2D smoke must not freeze total migration inventory')
assert(!smoke.includes(`${totalInventoryExpression},`), 'P2D smoke must remain forward-compatible')

console.log('F23.3E-P2D integrated duplicate/concurrency/security/fault QA and P3-entry gate semantic smoke passed')
