import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationRelative = 'supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql'
const reportRelative = 'docs/f23-3e-p2c-reviewed-match-decision-and-create-new-reservation-typed-runtime.md'
const smokeRelative = 'tests/f23-3e-p2c-reviewed-match-decision-and-create-new-reservation-typed-runtime-smoke.js'
const qaRelative = 'tests/f23-3e-p2c-reviewed-match-decision-and-create-new-reservation-typed-runtime-local-db-qa.js'
const canonicalRoadmapRelative = 'docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md'
const localRoadmapRelative = 'RoadmapRealTime.txt'
const migrationDirectory = join(root, 'supabase', 'migrations')
const artifacts = [migrationRelative, reportRelative, smokeRelative, qaRelative]

for (const relative of [...artifacts, canonicalRoadmapRelative, localRoadmapRelative]) {
  assert(existsSync(join(root, relative)), `Missing required file: ${relative}`)
}
const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const migration = read(migrationRelative)
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const canonicalRoadmap = read(canonicalRoadmapRelative)
const localRoadmap = read(localRoadmapRelative)
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const count = (content, pattern) => [...content.matchAll(pattern)].length

const p2cPhaseToken = /f23[-_]3e[-_]p2c(?![a-z0-9])/i
assert(p2cPhaseToken.test('202608110003_f23_3e_p2c_runtime.sql'))
for (const phase of ['p2a', 'p2b', 'p2d', 'p2z', 'p2ca', 'p2c2']) {
  assert(!p2cPhaseToken.test(`202608110004_f23_3e_${phase}_forward.sql`), `P2C ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'supabase', 'migrations'))
    .filter((name) => p2cPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs'))
    .filter((name) => p2cPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests'))
    .filter((name) => p2cPhaseToken.test(name)).map((name) => `tests/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...new Set(artifacts)].sort(), 'P2C must own exactly four artifacts')

const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()
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
])
assert.equal(inheritedHashes.size, 13)
for (const [name, expectedHash] of inheritedHashes) {
  assert(migrationFiles.includes(name), `Missing inherited migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Inherited hash drift: ${name}`)
}
const p2cName = migrationRelative.split('/').at(-1)
assert.deepEqual(migrationFiles.filter((name) => p2cPhaseToken.test(name)), [p2cName], 'P2C must own one migration')
const p2cHash = '7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46'
assert.equal(sha256(migrationRelative), p2cHash, 'P2C migration hash drift')
assert(report.includes(`SHA-256: ${p2cHash}`), 'P2C report hash drift')

assert.equal(count(migration, /\bcreate\s+table\b/gi), 0, 'P2C must create no table')
assert.equal(count(migration, /\bcreate\s+policy\b/gi), 0, 'P2C must create no RLS policy')
assert.equal(count(migration, /\balter\s+publication\b/gi), 0, 'P2C must not add realtime')
assert(!/create_secret\s*\(/i.test(migration), 'Migration must not provision a secret')
assert(!/\b(?:guardian|student)_profile\s*\(/i.test(migration), 'P2C must not invent a profile table')
assert(!/guardian_student_relationship/i.test(migration), 'P2C must not invent a relationship runtime')

const rpcNames = [
  'f23_3e_p2c_create_match_review',
  'f23_3e_p2c_decide_match_review',
  'f23_3e_p2c_supersede_match_review',
  'f23_3e_p2c_expire_match_review',
  'f23_3e_p2c_reserve_create_target',
  'f23_3e_p2c_cancel_creation_reservation',
  'f23_3e_p2c_expire_creation_reservation',
  'f23_3e_p2c_read_creation_reservation_status',
]
for (const name of rpcNames) includesAll(migration, [`create function public.${name}(`], 'Eight typed RPCs')
assert.equal(count(migration, /grant execute on function public\.f23_3e_p2c_(?!internal_)/g), 8, 'Exactly eight P2C grants required')
for (const match of migration.matchAll(/grant execute on function public\.f23_3e_p2c_(?!internal_)[\s\S]*?\n\s+to\s+([a-z_]+);/g)) {
  assert.equal(match[1], 'service_role', 'P2C external execute is service-role only')
}
includesAll(migration, [
  'security definer',
  "set search_path = ''",
  'from public, anon, authenticated, service_role;',
  'f23_3e_p2c_internal_execute_mutation',
  'f23_3e_p2b_internal_search_masked_candidates(',
  'select distinct pg_catalog.unnest(array[',
  'pg_catalog.array_agg(x.k order by x.k)',
  'foreach v_mutex_key in array v_mutex_keys loop',
  'for update;',
  "v_root.crm_state <> 'ACTIVE'",
  "v_root.feature_flag_state <> 'ENABLED'",
  "v_member_role not in ('owner', 'center_admin', 'consultant')",
  "a.assignment_status = 'ACTIVE'",
], 'Security and canonical locking')

includesAll(migration, [
  'add column p2c_result_resource_kind text',
  'p2c_result_opaque_target_id',
  "resource_scope_kind = 'conversion_request'",
  "return public.f23_3e_p2c_internal_safe_result('IDEMPOTENCY_CONFLICT')",
  "'replayed', true",
  'p2c_result_correlation_id',
  'f23_3e_p2c_terminal_result_snapshot_is_immutable',
], 'Scoped exact replay')

includesAll(migration, [
  "'crm.identity.review_created'",
  "'crm.identity.review_decided'",
  "'crm.identity.review_superseded'",
  "'crm.identity.review_expired'",
  "'crm.identity.creation_reserved'",
  "'crm.identity.creation_reservation_cancelled'",
  "'crm.identity.creation_reservation_expired'",
  'insert into public.crm_audit_event',
  'insert into public.crm_outbox_event',
  'crm_outbox_event_p2c_review_version_uidx',
  'crm_outbox_event_p2c_reservation_version_uidx',
], 'Transactional Audit/Outbox')

includesAll(migration, [
  "review_status = 'PENDING'",
  "review_status = 'EXACT_REVIEWED_MATCH'",
  "review_status = 'CREATE_NEW_REVIEWED'",
  "review_status = 'REJECTED_MATCH'",
  "review_status = 'CONFLICT'",
  "review_status = 'EXPIRED'",
  "review_status = 'SUPERSEDED'",
  "v_search ->> 'reuse_eligible'",
  "return public.f23_3e_p2c_internal_safe_result('MATCH_REVIEW_REQUIRED')",
  "v_search ->> 'outcome_code' <> 'NO_MATCH'",
  "v_search ->> 'adapter_completeness' <> 'COMPLETE'",
], 'Review boundary')

includesAll(migration, [
  "pg_catalog.gen_random_uuid(), 'future.student.profile.v1'",
  "status = 'CANCELLED'",
  "status = 'EXPIRED'",
  "'profile_created', false",
  "'profile_reused', false",
  "'conversion_approved', false",
  "'request_completed', false",
], 'Reservation non-authority')
assert(!/set\s+status\s*=\s*'CONSUMED'/i.test(migration), 'P2C must not consume a reservation')
assert(!/set\s+status\s*=\s*'COMPLETED'/i.test(migration.replaceAll("status = 'COMPLETED'", '')), 'P2C must not complete a Request')

includesAll(report, [
  'F23_3E_P2C_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P2C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P2C_MIGRATION_CREATED: YES',
  'F23_3E_P2C_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P2C_LOCAL_DB_QA: PASS',
  'F23_3E_P2C_REVIEW_TYPED_RUNTIME: IMPLEMENTED',
  'F23_3E_P2C_RESERVATION_TYPED_RUNTIME: IMPLEMENTED',
  'F23_3E_P2C_TRANSACTIONAL_AUDIT_OUTBOX: IMPLEMENTED',
  'F23_3E_P2C_RESERVATION_CONSUME_RUNTIME: NOT IMPLEMENTED — P3',
  'F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P2C_REMOTE_APPLY: NOT RUN',
  'F23_3E_P2C_AUTH_CHANGE: NO',
  'F23_3E_P2C_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P2C_DEPLOY: NOT RUN',
  'F23_3E_P2C_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'P2C_CALLER_SUPPLIED_SEARCH_RESULT_IS_AUTHORITY: NO',
  'P2C_REVALIDATES_SEARCH_UNDER_MUTEX_LOCKS: YES',
  'P2C_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'P2C_ACTOR_ATTRIBUTION_GRANTS_END_USER_AUTHORITY: NO',
  'CREATE_NEW_REVIEWED_IS_PROFILE_CREATE_AUTHORITY: NO',
  'P2C_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO',
  'External technical audit: PASS.',
  'P2-R1–P2-R16 runtime classification',
  'P2-N1–P2-N24 negative classification',
], 'Report scope')

const qaMarkers = [
  'P2C_QA_LOCAL_SAFETY_GUARD: PASS',
  'P2C_QA_LOCAL_SQL_APPLY: PASS',
  'P2C_QA_EIGHT_TYPED_RPCS: PASS',
  'P2C_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS',
  'P2C_QA_CREATE_PENDING_REVIEW: PASS',
  'P2C_QA_EXACT_REVIEWED_MATCH: PASS',
  'P2C_QA_CREATE_NEW_REVIEWED_FROM_COMPLETE_NO_MATCH: PASS',
  'P2C_QA_STRONG_NAME_BIRTH_NOT_AUTO_AUTHORITY: PASS',
  'P2C_QA_TERMINAL_REVIEW_IMMUTABLE: PASS',
  'P2C_QA_REVIEW_VERSION_PLUS_ONE: PASS',
  'P2C_QA_REVIEW_STALE_FAIL_CLOSED: PASS',
  'P2C_QA_REVIEW_EXPIRY: PASS',
  'P2C_QA_REVIEW_SUPERSESSION: PASS',
  'P2C_QA_CREATE_ACTIVE_RESERVATION: PASS',
  'P2C_QA_SERVER_PREALLOCATED_TARGET_STABLE: PASS',
  'P2C_QA_RESERVATION_NOT_CREATE_AUTHORITY: PASS',
  'P2C_QA_RESERVATION_CONSUME_UNAVAILABLE: PASS',
  'P2C_QA_RESERVATION_CANCEL: PASS',
  'P2C_QA_RESERVATION_EXPIRY: PASS',
  'P2C_QA_RESERVATION_STALE_FAIL_CLOSED: PASS',
  'P2C_QA_TARGET_NON_REBINDABLE: PASS',
  'P2C_QA_IDEMPOTENCY_EXACT_REPLAY: PASS',
  'P2C_QA_IDEMPOTENCY_CONFLICT: PASS',
  'P2C_QA_AUDIT_OUTBOX_ATOMIC: PASS',
  'P2C_QA_AUDIT_OUTBOX_REPLAY_NO_DUPLICATE: PASS',
  'P2C_QA_AUDIT_OUTBOX_FAULT_ROLLBACK: PASS',
  'P2C_QA_NO_PII_AUDIT_OUTBOX: PASS',
  'P2C_QA_EXACT_CENTER_NON_DISCLOSURE: PASS',
  'P2C_QA_MULTI_ACCOUNT_SCOPE: PASS',
  'P2C_QA_CONCURRENCY_LOCK_WAIT: PASS',
  'P2C_QA_RACE_MATRIX: PASS',
  'P2C_QA_NEGATIVE_MATRIX: PASS',
  'P2C_QA_FAULT_INJECTION: PASS',
  'P2C_QA_FINAL_LOCAL_RESET: PASS',
  'P2C_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P2C_QA_NONDEFAULT_ROOT_COUNT: 0',
  'P2C_QA_TEMP_HELPER_COUNT: 0',
  'P2C_QA_VAULT_SECRET_COUNT: 0',
]
includesAll(report, qaMarkers, 'Report QA evidence')
includesAll(qa, qaMarkers.filter((marker) => !marker.endsWith(': 0')), 'Executable QA markers')
includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P2C_LOCAL_QA_ALLOW_RESET'",
  "localArgs('status -o json')",
  "localArgs('db reset')",
  'pg_catalog.pg_blocking_pids(pid)',
  "wait_event_type='Lock'",
  '/rest/v1/rpc/f23_3e_p2c_read_creation_reservation_status',
  'finally {',
], 'Guarded local QA')
assert(!qa.includes('supabase link'))
assert(!qa.includes('supabase db push'))
assert(!qa.includes('supabase migration repair'))

const currentP2CLine = 'F23.3E-P2C DONE backend/local verified / Reviewed decision và create-new reservation runtime'
includesAll(localRoadmap, [
  currentP2CLine,
  'F23.3E-P2 DONE backend/local verified',
  'F23.3E-P3 DONE backend/local verified',
  'F23.3E-P4A DONE backend/local verified',
], 'Current P2C roadmap milestone')
assert.equal(localRoadmap.split('F23.3E-P2C DONE backend/local verified').length - 1, 1, 'P2C must have exactly one current DONE status')
assert(!localRoadmap.includes('F23.3E-P2C TODO backend'), 'Stale P2C TODO marker must be removed')
assert(canonicalRoadmap.includes('F23.3E-P2C DONE backend/local verified'), 'Historical P2C checkpoint evidence drifted')

const totalInventoryExpression = ['migrationFiles', 'length'].join('.')
assert(!smoke.includes(`${totalInventoryExpression} ===`), 'P2C smoke must not freeze total migration inventory')
assert(!smoke.includes(`${totalInventoryExpression},`), 'P2C smoke must remain forward-compatible')

console.log('F23.3E-P2C reviewed-match decision and create-new reservation typed runtime smoke passed')
