import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationRelative = 'supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql'
const reportRelative = 'docs/f23-3e-p2b-versioned-normalization-and-exact-center-masked-candidate-search.md'
const smokeRelative = 'tests/f23-3e-p2b-versioned-normalization-and-exact-center-masked-candidate-search-smoke.js'
const qaRelative = 'tests/f23-3e-p2b-versioned-normalization-and-exact-center-masked-candidate-search-local-db-qa.js'
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

const p2bPhaseToken = /f23[-_]3e[-_]p2b(?![a-z0-9])/i
assert(p2bPhaseToken.test('202608110002_f23_3e_p2b_runtime.sql'), 'P2B ownership predicate is too narrow')
for (const phase of ['p2c', 'p2d', 'p2z', 'p2ba', 'p2b2']) {
  assert(!p2bPhaseToken.test(`202608110003_f23_3e_${phase}_forward.sql`), `P2B ownership predicate captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'supabase', 'migrations'))
    .filter((name) => p2bPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs'))
    .filter((name) => p2bPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests'))
    .filter((name) => p2bPhaseToken.test(name)).map((name) => `tests/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...new Set(artifacts)].sort(), 'P2B must own exactly four artifacts')

const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()
const inheritedMigrationHashes = new Map([
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
])
assert.equal(inheritedMigrationHashes.size, 11, 'Inherited checkpoint set drift')
for (const [name, expectedHash] of inheritedMigrationHashes) {
  assert(migrationFiles.includes(name), `Missing inherited migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Inherited migration hash drift: ${name}`)
}
const p2aName = '202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql'
const p2aHash = '55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773'
assert(migrationFiles.includes(p2aName), 'P2A migration is missing')
assert.equal(sha256(`supabase/migrations/${p2aName}`), p2aHash, 'P2A migration hash drift')

const p2bName = migrationRelative.split('/').at(-1)
const p2bOwnedMigrations = migrationFiles.filter((name) => p2bPhaseToken.test(name))
assert.deepEqual(p2bOwnedMigrations, [p2bName], 'P2B must own exactly one migration')
const p2bHash = 'F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B'
assert.equal(sha256(migrationRelative), p2bHash, 'P2B migration hash drift')
assert(report.includes(`SHA-256: ${p2bHash}`), 'P2B report migration hash drift')

assert.equal(count(migration, /\bcreate\s+table\b/gi), 0, 'P2B must create no table')
assert.equal(count(migration, /\bcreate\s+policy\b/gi), 0, 'P2B must create no RLS policy')
assert.equal(count(migration, /\balter\s+publication\b/gi), 0, 'P2B must not add realtime')
assert(!/\b(?:guardian|student)_profile\b/i.test(migration), 'P2B must not invent a profile table/runtime')
assert(!/\bguardian_student_relationship\b/i.test(migration), 'P2B must not invent a relationship')
assert(!/\bp_digest_secret\b/i.test(migration), 'Caller-supplied digest secret is forbidden')
assert(!/create_secret\s*\(/i.test(migration), 'Migration must not provision a secret')
assert(!/[0-9a-f]{64}.*(?:secret|hmac)|(?:secret|hmac).*[0-9a-f]{64}/i.test(migration), 'Migration appears to contain hard-coded key material')

includesAll(migration, [
  "pg_catalog.to_regclass('vault.decrypted_secrets')",
  "pg_catalog.to_regprocedure('extensions.hmac(bytea,bytea,text)')",
  'f23_3e_p2b_internal_digest_key',
  's.decrypted_secret',
  "v_secret_value !~ '^[0-9A-Fa-f]{64}$'",
  'f23_3e_p2b_identity_digest_epoch_',
  'extensions.hmac(',
  "'digest_schema_version', 1",
  "'normalization_algorithm'",
  "'normalization_version'",
  "'identity_kind'",
  "'evidence_kind'",
  "'canonical_normalized_value'",
  "'digest_key_epoch'",
], 'Protected keyed digest')

includesAll(migration, [
  'f23_3e_p2b_internal_normalize_student_name_v1',
  'normalize(p_value, NFC)',
  'pg_catalog.translate(',
  "'[[:space:]]+'",
  'pg_catalog.lower(v_value)',
  "p_value ~ '[[:cntrl:]]'",
  'pg_catalog.length(v_value) not between 1 and 240',
  'f23_3e_p2b_internal_normalize_student_birth_v1',
  "p_value < date '1900-01-01'",
  "pg_catalog.to_char(p_value, 'YYYY-MM-DD')",
], 'Versioned normalizers')

includesAll(migration, [
  'f23_3e_p2b_internal_mutex_key',
  "'mutex_schema_version', 1",
  "'environment_fingerprint'",
  "'center_id'",
  "'canonical_normalized_identity_digest'",
  'select distinct pg_catalog.unnest(v_mutex_keys)',
  'pg_catalog.array_agg(d.key order by d.key)',
  'order by m.identity_match_mutex_key',
  'for update;',
  'on conflict (identity_match_mutex_key) do update',
], 'Stable sorted mutex protocol')

includesAll(migration, [
  'create function public.f23_3e_p2b_search_masked_candidates(',
  'create function public.f23_3e_p2b_get_masked_candidate_review_detail(',
  'security definer',
  "set search_path = ''",
  'from public, anon, authenticated, service_role;',
  'to service_role;',
  "pg_catalog.set_config('response.headers', '[{\"Cache-Control\":\"no-store\"}]', true)",
], 'Protected RPC boundary')
assert.equal(count(migration, /grant execute on function public\.f23_3e_p2b_/g), 2, 'Only two P2B RPC grants are allowed')
for (const match of migration.matchAll(/grant execute on function public\.f23_3e_p2b_[\s\S]*?\n\s+to\s+([a-z_]+);/g)) {
  assert.equal(match[1], 'service_role', 'P2B RPC execution may be granted only to service_role')
}

includesAll(migration, [
  "v_root.crm_state <> 'ACTIVE'",
  "v_root.feature_flag_state <> 'ENABLED'",
  "v_member_role in ('owner', 'center_admin')",
  "v_member_role = 'consultant'",
  "a.assignment_status = 'ACTIVE'",
  "return public.f23_3e_p2b_internal_safe_result('RESOURCE_NOT_AVAILABLE')",
  "return public.f23_3e_p2b_internal_safe_result('NORMALIZER_STALE')",
  "return public.f23_3e_p2b_internal_safe_result('MATCH_POLICY_STALE')",
  "return public.f23_3e_p2b_internal_safe_result('SOURCE_VERSION_STALE')",
  "return public.f23_3e_p2b_internal_safe_result('TARGET_VERSION_STALE')",
], 'Exact-center eligibility and stale behavior')

includesAll(migration, [
  "e.entity_type = 'student'",
  'e.center_id = v_center_id',
  "v_row.source_module <> 'localStorage'",
  "v_row.source_version <> 'c2-online-core-v1'",
  "v_row.payload ->> 'id' <> v_row.local_id",
  "v_row.payload ->> 'birthDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'",
  "raise exception 'f23_3e_p2b_student_adapter_incomplete'",
  "'legacy.center_cloud_student.readonly.v1'",
  "'masked_attributes', pg_catalog.jsonb_build_array('IDENTITY_REDACTED')",
  "'safe_attributes', pg_catalog.jsonb_build_array('CURRENT_STUDENT_RECORD')",
  "'projection_cache_policy', 'NO_STORE'",
  "'reuse_eligible', false",
  "'create_authority', false",
], 'Narrow masked Student adapter')

includesAll(migration, [
  "p_identity_kind = 'GUARDIAN'",
  "'MATCH_SEARCH_UNAVAILABLE'",
  "v_outcome_code := 'MATCH_REVIEW_REQUIRED'",
  "v_match_outcome := 'PROBABLE_MATCH'",
  "v_reason_code := 'NAME_AND_BIRTH_EXACT_CANDIDATE'",
  "v_match_outcome := 'CONFLICT'",
  "v_reason_code := 'CONTRADICTORY_EVIDENCE'",
  "v_outcome_code := 'NO_MATCH'",
  "'creates_match_review', false",
  "'creates_reservation', false",
], 'Nonterminal match semantics')
for (const forbiddenOutput of [
  "'fullName'", "'birthDate'", "'phone'", "'email'", "'payload'",
  "'canonical_normalized_identity_digest'", "'identity_match_mutex_key'",
]) {
  const resultStart = migration.indexOf("return pg_catalog.jsonb_build_object(\n    'ok', true")
  assert(resultStart > 0, 'Could not isolate successful projection')
  assert(!migration.slice(resultStart, migration.indexOf('exception', resultStart)).includes(forbiddenOutput), `Projection leaks ${forbiddenOutput}`)
}

includesAll(report, [
  'F23_3E_P2B_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P2B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P2B_MIGRATION_CREATED: YES',
  'F23_3E_P2B_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P2B_LOCAL_DB_QA: PASS',
  'F23_3E_P2B_VERSIONED_NORMALIZATION_RUNTIME: IMPLEMENTED',
  'F23_3E_P2B_MASKED_CANDIDATE_SEARCH_RUNTIME: IMPLEMENTED',
  'F23_3E_P2C_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P2B_REMOTE_APPLY: NOT RUN',
  'F23_3E_P2B_AUTH_CHANGE: NO',
  'F23_3E_P2B_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P2B_DEPLOY: NOT RUN',
  'F23_3E_P2B_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'P2B_GUARDIAN_TARGET_SEARCH: BLOCKED_ADAPTER_ABSENT',
  'P2B_CURRENT_STUDENT_WRITERS_PARTICIPATE_IN_IDENTITY_MUTEX: NO',
  'P2B_NO_MATCH_IS_PROFILE_CREATE_AUTHORITY: NO',
  'P3_CREATE_NEW_REMAINS_BLOCKED_UNTIL_CANONICAL_TARGET_WRITE_PROTOCOL: YES',
  'P2B_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'P2B_CALLER_CONTROLS_SEARCH_CENTER: NO',
  'PARTIAL_BIRTH_EVIDENCE_EQUALS_EXACT_BIRTH_MATCH: NO',
  'P2B_CREATES_MATCH_REVIEW: NO',
  'P2B_CREATES_RESERVATION: NO',
  'P2B_CREATES_PROFILE: NO',
  'P2B_REUSES_PROFILE: NO',
  'P2B_APPROVES_CONVERSION: NO',
  'P2B_COMPLETES_REQUEST: NO',
  'External technical audit: PASS',
  'existing Vault/HMAC',
  'Vietnamese-diacritic-preserving',
  'real lock-wait concurrency',
  'clean final reset',
], 'P2B report boundary')
assert(!report.includes('F23_3E_P2B_FINAL_TECHNICAL_AUDIT: NOT RUN'), 'P2B audit closeout is incomplete')

const qaMarkers = [
  'P2B_QA_LOCAL_SAFETY_GUARD: PASS',
  'P2B_QA_LOCAL_SQL_APPLY: PASS',
  'P2B_QA_PROTECTED_DIGEST_KEY_SOURCE: PASS',
  'P2B_QA_RAW_NORMALIZED_VALUE_NOT_PERSISTED: PASS',
  'P2B_QA_VERSIONED_NAME_NORMALIZATION: PASS',
  'P2B_QA_VERSIONED_BIRTH_NORMALIZATION: PASS',
  'P2B_QA_DIGEST_DOMAIN_SEPARATION: PASS',
  'P2B_QA_SORTED_MUTEX_LOCKING: PASS',
  'P2B_QA_STUDENT_ADAPTER_EXACT_CENTER: PASS',
  'P2B_QA_STUDENT_ADAPTER_MASKED_ONLY: PASS',
  'P2B_QA_ADAPTER_COMPLETENESS_FAIL_CLOSED: PASS',
  'P2B_QA_NAME_BIRTH_STRONG_DUPLICATE_REVIEW: PASS',
  'P2B_QA_NAME_ONLY_NOT_IDENTITY: PASS',
  'P2B_QA_BIRTH_ONLY_NOT_IDENTITY: PASS',
  'P2B_QA_MULTI_CANDIDATE_REVIEW_REQUIRED: PASS',
  'P2B_QA_COMPLETE_NO_MATCH: PASS',
  'P2B_QA_NO_MATCH_NOT_CREATE_AUTHORITY: PASS',
  'P2B_QA_CROSS_CENTER_NON_DISCLOSURE: PASS',
  'P2B_QA_MULTI_ACCOUNT_SCOPE: PASS',
  'P2B_QA_NORMALIZER_STALE: PASS',
  'P2B_QA_POLICY_STALE: PASS',
  'P2B_QA_SOURCE_STALE: PASS',
  'P2B_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS',
  'P2B_QA_NO_RAW_PII_SERIALIZATION: PASS',
  'P2B_QA_NO_STORE_PROJECTION: PASS',
  'P2B_QA_MUTEX_CONCURRENCY_LIVENESS: PASS',
  'P2B_QA_FAULT_INJECTION_FAIL_CLOSED: PASS',
  'P2B_QA_FINAL_LOCAL_RESET: PASS',
  'P2B_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P2B_QA_NONDEFAULT_ROOT_COUNT: 0',
  'P2B_QA_TEMP_HELPER_COUNT: 0',
]
includesAll(report, qaMarkers, 'Report QA evidence')
includesAll(qa, qaMarkers.filter((marker) => !marker.endsWith(': 0')), 'Executable QA markers')
includesAll(qa, [
  'P2B_QA_LEFTOVER_FIXTURE_COUNT:',
  'P2B_QA_NONDEFAULT_ROOT_COUNT:',
  'P2B_QA_TEMP_HELPER_COUNT:',
], 'Executable QA cleanup markers')
includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P2B_LOCAL_QA_ALLOW_RESET'",
  "localArgs('status -o json')",
  "localArgs('db reset')",
  "extensions.gen_random_bytes(32)",
  'pg_catalog.pg_blocking_pids(pid)',
  "wait_event_type='Lock'",
  '/rest/v1/rpc/f23_3e_p2b_search_masked_candidates',
  "serviceResponse.headers.get('cache-control')",
  'finally {',
], 'Executable guarded QA')
assert(!qa.includes('supabase link'), 'QA must not link a project')
assert(!qa.includes('supabase db push'), 'QA must not push migrations')
assert(!qa.includes('supabase migration repair'), 'QA must not repair migration history')

const currentP2BLine = 'F23.3E-P2B DONE backend/local verified / Versioned Student identity normalization, protected keyed digests, sorted identity mutex và exact-center masked candidate search PASS; same-name + exact-birth strong duplicate signal yêu cầu review; Guardian target adapter và create authority vẫn BLOCKED'
const currentP2BMarker = `CURRENT CHECKPOINT — ${currentP2BLine}`
const historicalP2BTodoLine = 'F23.3E-P2B TODO backend / Versioned normalization và exact-center masked candidate search'
const historicalP2BHeading = '* Historical checkpoint compatibility note — non-current P2A-era P2B marker; the indented literal below is not a current status:'
for (const roadmap of [canonicalRoadmap, localRoadmap]) {
  includesAll(roadmap, [
    'F23.3E-P2 DONE design',
    'F23.3E-P2A DONE backend/local verified',
    currentP2BMarker,
    'F23.3E-P2C TODO backend',
    'F23.3E-P2D TODO QA',
    'F23.3E-P3 TODO backend',
    'F23.3E-P4 TODO public/QA',
    historicalP2BHeading,
    historicalP2BTodoLine,
  ], 'Post-audit roadmap boundary')
  const trimmedLines = roadmap.split(/\r?\n/).map((line) => line.trim())
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('CURRENT CHECKPOINT — F23.3E-P2B ')), [currentP2BMarker], 'Roadmap must have exactly one current P2B status')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P2B ')), [historicalP2BTodoLine], 'P2B TODO must exist only as the historical compatibility literal')
  assert.equal(roadmap.split(currentP2BLine).length - 1, 1, 'P2B DONE status count drift')
  assert.equal(roadmap.split(historicalP2BHeading).length - 1, 1, 'P2B historical heading count drift')
  assert.equal(roadmap.split(historicalP2BTodoLine).length - 1, 1, 'P2B historical TODO count drift')
}

const totalInventoryExpression = ['migrationFiles', 'length'].join('.')
assert(!smoke.includes(`${totalInventoryExpression} ===`), 'P2B smoke must not freeze total migration inventory')
assert(!smoke.includes(`${totalInventoryExpression},`), 'P2B smoke must remain forward-compatible')

console.log('F23.3E-P2B versioned normalization and exact-center masked candidate search smoke passed')
