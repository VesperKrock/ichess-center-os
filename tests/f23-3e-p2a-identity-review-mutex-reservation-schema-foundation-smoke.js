import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationRelative = 'supabase/migrations/202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql'
const reportRelative = 'docs/f23-3e-p2a-identity-review-mutex-reservation-schema-foundation.md'
const smokeRelative = 'tests/f23-3e-p2a-identity-review-mutex-reservation-schema-foundation-smoke.js'
const qaRelative = 'tests/f23-3e-p2a-identity-review-mutex-reservation-schema-foundation-local-db-qa.js'
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
const tableBody = (name) => {
  const startMarker = `create table public.${name} (`
  const start = migration.indexOf(startMarker)
  assert(start >= 0, `Missing table ${name}`)
  const end = migration.indexOf('\n);', start + startMarker.length)
  assert(end > start, `Could not isolate table ${name}`)
  return migration.slice(start, end + 3)
}
const constraintBody = (name, nextName) => {
  const startMarker = `constraint ${name}`
  const start = migration.indexOf(startMarker)
  assert(start >= 0, `Missing constraint ${name}`)
  const end = migration.indexOf(`constraint ${nextName}`, start + startMarker.length)
  assert(end > start, `Could not isolate constraint ${name}`)
  return migration.slice(start, end)
}
const quotedVocabulary = (content) => [...content.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1])

const p2aPhaseToken = /f23[-_]3e[-_]p2a(?![a-z0-9])/i
assert(p2aPhaseToken.test('202608110001_f23_3e_p2a_foundation.sql'), 'P2A ownership predicate is too narrow')
for (const phase of ['p2b', 'p2c', 'p2d', 'p2z', 'p2aa']) {
  assert(!p2aPhaseToken.test(`202608110002_f23_3e_${phase}_forward.sql`), `P2A ownership predicate captures forward phase ${phase}`)
}
const expectedArtifacts = new Set(artifacts)
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'supabase', 'migrations'))
    .filter((name) => p2aPhaseToken.test(name))
    .map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs'))
    .filter((name) => p2aPhaseToken.test(name))
    .map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests'))
    .filter((name) => p2aPhaseToken.test(name))
    .map((name) => `tests/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...expectedArtifacts].sort(), 'P2A artifact inventory drift')

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
assert.equal(inheritedMigrationHashes.size, 11, 'P2A inherited migration checkpoint count drift')
for (const [name, expected] of inheritedMigrationHashes) {
  assert(migrationFiles.includes(name), `Missing inherited migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expected, `Inherited migration hash drift: ${name}`)
}
const p2aMigrationName = migrationRelative.split('/').at(-1)
const p2aOwnedMigrations = migrationFiles.filter((name) => p2aPhaseToken.test(name))
assert.deepEqual(p2aOwnedMigrations, [p2aMigrationName], 'P2A must own exactly its approved forward migration')
const p2aMigrationHash = '55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773'
assert.equal(sha256(migrationRelative), p2aMigrationHash, 'P2A migration hash drift')
assert(report.includes(`SHA-256: ${p2aMigrationHash}`), 'P2A report migration hash drift')

const expectedTables = [
  'crm_identity_policy_registry',
  'crm_identity_match_mutex',
  'crm_identity_match_review',
  'crm_profile_creation_reservation',
]
const createdTables = [...migration.matchAll(/create table public\.([a-z0-9_]+)\s*\(/g)].map((match) => match[1])
assert.deepEqual(createdTables, expectedTables, 'P2A must create exactly the four approved business tables')
assert.equal(count(migration, /create table public\./g), 4, 'P2A business table count drift')

const forbiddenCreatedNames = [
  ['guardian', 'profile'].join('_'),
  ['student', 'profile'].join('_'),
  ['guardian', 'student', 'relationship'].join('_'),
  ['crm', 'conversion', 'action'].join('_'),
  ['conversion', 'execution'].join('_'),
  ['conversion', 'approval'].join('_'),
]
for (const name of forbiddenCreatedNames) assert(!createdTables.includes(name), `Forbidden aggregate created: ${name}`)

for (const table of expectedTables) {
  includesAll(migration, [
    `alter table public.${table} enable row level security;`,
    `alter table public.${table} force row level security;`,
  ], `${table} RLS`)
}
assert.equal(count(migration, / enable row level security;/g), 4, 'RLS enable count drift')
assert.equal(count(migration, / force row level security;/g), 4, 'RLS force count drift')
assert(!/\bcreate\s+policy\b/i.test(migration), 'P2A must create zero RLS policies')
assert(!/\balter\s+publication\b/i.test(migration), 'P2A must not add realtime publication entries')
assert(!/\bgrant\s+/i.test(migration), 'P2A must not grant table or function authority')
includesAll(migration, [
  'from public, anon, authenticated, service_role;',
  'revoke all privileges on table',
  'revoke all on function public.f23_3e_p2a_internal_guard_identity_policy_registry()',
  'revoke all on function public.f23_3e_p2a_internal_guard_identity_match_mutex()',
  'revoke all on function public.f23_3e_p2a_internal_guard_identity_match_review()',
  'revoke all on function public.f23_3e_p2a_internal_guard_profile_creation_reservation()',
], 'P2A fail-closed grants')

const helperNames = [...migration.matchAll(/create function public\.([a-z0-9_]+)\(\)/g)].map((match) => match[1])
assert.equal(helperNames.length, 4, 'Unexpected P2A helper-function count')
for (const name of helperNames) assert(name.startsWith('f23_3e_p2a_internal_guard_'), `Helper is not internal: ${name}`)
assert(!/security\s+definer/i.test(migration), 'P2A trigger helpers must not become privileged callable RPCs')

const suspiciousColumn = /^\s{2}(?:name|full_name|phone|email|birth_date|dob|address|contact_payload|normalized_value|raw_identity)\s+/im
const arbitraryPayload = /^\s{2}[a-z0-9_]+\s+(?:json|jsonb)\b/im
for (const table of expectedTables) {
  const body = tableBody(table)
  assert(!suspiciousColumn.test(body), `${table} contains a raw identity/PII column`)
  assert(!arbitraryPayload.test(body), `${table} contains an arbitrary JSON identity payload`)
}
includesAll(tableBody('crm_identity_match_mutex'), [
  'identity_match_mutex_key bytea primary key',
  'pg_catalog.octet_length(identity_match_mutex_key) = 32',
  'environment_fingerprint bytea not null',
  'normalization_version integer not null',
  'digest_key_epoch integer not null',
  "check (status in ('ACTIVE', 'RETIRED'))",
], 'Opaque mutex')
includesAll(migration, [
  'crm_identity_match_mutex_policy_exact_binding_fkey',
  'crm_identity_match_mutex_lock_order_idx',
  '(center_id, identity_kind, identity_match_mutex_key)',
  'f23_3e_p2a_mutex_binding_is_immutable',
  'f23_3e_p2a_mutex_version_must_increment_by_one',
  'f23_3e_p2a_retired_mutex_is_immutable',
], 'Mutex exact binding and lifecycle')

includesAll(tableBody('crm_identity_policy_registry'), [
  'environment_fingerprint bytea not null',
  'center_identity_policy_version integer not null',
  'normalization_algorithm text not null',
  'normalization_version integer not null',
  'digest_key_epoch integer not null',
  'match_policy_version integer not null',
  'minimum_evidence_policy_version integer not null',
  "check (status in ('STAGED', 'CURRENT', 'DRAINING', 'RETIRED'))",
], 'Policy physical contract')
includesAll(migration, [
  'crm_identity_policy_registry_control_root_fkey',
  'crm_identity_policy_registry_one_current_idx',
  "old.status = 'STAGED' and new.status = 'CURRENT'",
  "old.status = 'CURRENT' and new.status = 'DRAINING'",
  "old.status = 'DRAINING' and new.status = 'RETIRED'",
  'f23_3e_p2a_center_identity_policy_version_stale',
  'f23_3e_p2a_policy_binding_is_immutable',
  'f23_3e_p2a_policy_version_must_increment_by_one',
  'f23_3e_p2a_retired_policy_is_immutable',
], 'Policy lifecycle')

const outcomeVocabulary = quotedVocabulary(constraintBody(
  'crm_identity_match_review_match_outcome_check',
  'crm_identity_match_review_status_check',
))
assert.deepEqual(outcomeVocabulary, [
  'NO_MATCH', 'POSSIBLE_MATCH', 'PROBABLE_MATCH',
  'EXACT_REVIEWED_MATCH', 'CONFLICT', 'INSUFFICIENT_EVIDENCE',
], 'Canonical match outcomes must remain closed to six')
const reviewStatusVocabulary = quotedVocabulary(constraintBody(
  'crm_identity_match_review_status_check',
  'crm_identity_match_review_action_check',
))
assert.deepEqual(reviewStatusVocabulary, [
  'PENDING', 'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED', 'REJECTED_MATCH',
  'CONFLICT', 'EXPIRED', 'SUPERSEDED',
], 'Review lifecycle vocabulary drift')
const reviewActionVocabulary = quotedVocabulary(constraintBody(
  'crm_identity_match_review_action_check',
  'crm_identity_match_review_safe_reason_code_check',
))
assert.deepEqual(reviewActionVocabulary, [
  'REUSE_EXISTING', 'PREPARE_CREATE_NEW',
  'REJECT_IDENTITY_ACTION', 'ESCALATE_IDENTITY_CONFLICT',
], 'Review action vocabulary drift')
includesAll(migration, [
  'NAME_AND_BIRTH_EXACT_CANDIDATE',
  'crm_identity_match_review_request_exact_center_fkey',
  'crm_identity_match_review_contact_exact_center_fkey',
  'crm_identity_match_review_case_exact_center_fkey',
  'crm_identity_match_review_candidate_exact_case_fkey',
  'crm_identity_match_review_policy_exact_binding_fkey',
  'crm_identity_match_review_supersedes_exact_center_fkey',
  'request_action_graph_digest bytea not null',
  'action_intent_digest bytea not null',
  'f23_3e_p2a_review_binding_is_immutable',
  'f23_3e_p2a_terminal_review_is_immutable',
  'f23_3e_p2a_review_version_must_increment_by_one',
  'f23_3e_p2a_expired_review_cannot_be_decided_or_reused',
  'f23_3e_p2a_review_request_action_source_binding_stale',
], 'Review exact binding and lifecycle')

const reservationStatusVocabulary = quotedVocabulary(constraintBody(
  'crm_profile_creation_reservation_status_check',
  'crm_profile_creation_reservation_terminal_mapping_check',
))
assert.deepEqual(reservationStatusVocabulary, [
  'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED',
], 'Reservation lifecycle vocabulary drift')
includesAll(migration, [
  'crm_profile_creation_reservation_request_exact_center_fkey',
  'crm_profile_creation_reservation_review_exact_center_fkey',
  'crm_profile_creation_reservation_policy_exact_binding_fkey',
  'crm_profile_creation_reservation_supersedes_exact_center_fkey',
  'crm_profile_creation_reservation_one_active_intent_idx',
  "where status = 'ACTIVE';",
  'crm_profile_creation_reservation_target_never_rebound_idx',
  'preallocated_target_id uuid not null',
  'f23_3e_p2a_reservation_binding_is_immutable',
  'f23_3e_p2a_terminal_reservation_is_immutable',
  'f23_3e_p2a_reservation_version_must_increment_by_one',
  'f23_3e_p2a_expired_reservation_cannot_be_consumed_or_reused',
  'f23_3e_p2a_reservation_review_binding_is_not_current_create_new',
  "v_review.review_status <> 'CREATE_NEW_REVIEWED'",
  "v_review.match_outcome <> 'NO_MATCH'",
  "v_review.review_action <> 'PREPARE_CREATE_NEW'",
], 'Reservation exact binding and lifecycle')
assert(count(migration, /pg_catalog\.transaction_timestamp\(\)/g) >= 12, 'Server-time guards are incomplete')

const expectedStatusPrefix = [
  'F23_3E_P2A_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P2A_FINAL_TECHNICAL_AUDIT: PASS',
  '',
  'F23_3E_P2A_MIGRATION_CREATED: YES',
  'F23_3E_P2A_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P2A_LOCAL_DB_QA: PASS',
  '',
  'F23_3E_P2A_NEW_BUSINESS_TABLE_COUNT: 4',
  '',
  'F23_3E_P2B_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P2C_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED',
  '',
  'F23_3E_P2A_REMOTE_APPLY: NOT RUN',
  'F23_3E_P2A_AUTH_CHANGE: NO',
  'F23_3E_P2A_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P2A_DEPLOY: NOT RUN',
  'F23_3E_P2A_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
].join('\n')
assert(report.startsWith(expectedStatusPrefix), 'P2A report status prefix drift')
assert(!report.includes('F23_3E_P2A_FINAL_TECHNICAL_AUDIT: NOT RUN'), 'P2A external-audit closeout is missing')
const requiredReportMarkers = [
  'F23_3E_P2A_EXTERNAL_TECHNICAL_AUDIT_VERDICT: PASS',
  'F23_3E_P2A_EXTERNAL_TECHNICAL_AUDIT_BLOCKERS: NONE',
  'P2A_NEW_BUSINESS_TABLE_COUNT: 4',
  'P2A_RLS_ENABLED_FORCED_ALL_TABLES: YES',
  'P2A_BROWSER_TABLE_PRIVILEGES: NONE',
  'P2A_SERVICE_ROLE_DIRECT_TABLE_PRIVILEGES: NONE',
  'P2A_REALTIME_PUBLICATION: NO',
  'P2A_RAW_PII_MUTEX_COLUMN_EXISTS: NO',
  'P2A_RAW_PII_REVIEW_COLUMN_EXISTS: NO',
  'P2A_EXACT_NAME_AND_BIRTH_MATCH_AUTO_MERGES: NO',
  'P2A_EXACT_NAME_AND_BIRTH_MATCH_AUTO_CREATES_SECOND_PROFILE: NO',
  'P2A_EXACT_NAME_AND_BIRTH_MATCH_REQUIRES_REVIEW_PATH: YES',
  'P2A_SEPARATE_CONVERSION_ACTION_TABLE_CREATED: NO',
  'P2A_PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO',
  'P2A_REAL_PROFILE_CREATION_IMPLEMENTED: NO',
  'P2A_SCHEMA_GLOBALLY_ENFORCES_RUNTIME_LOCK_ORDER: NO',
  'P2A_PHYSICAL_RESOURCES_SUPPORT_CANONICAL_LOCK_ORDER: YES',
  'P2A_IDENTITY_UNIQUE_CONSTRAINT_REPLACES_MUTEX_PROTOCOL: NO',
  'P2A_P2_MUTATION_AUDIT_OUTBOX_RUNTIME: NOT IMPLEMENTED — P2C',
]
includesAll(report, requiredReportMarkers, 'P2A report markers')

const requiredQaMarkers = [
  'P2A_QA_LOCAL_SAFETY_GUARD: PASS',
  'P2A_QA_LOCAL_SQL_APPLY: PASS',
  'P2A_QA_FOUR_TABLES_PRESENT: PASS',
  'P2A_QA_RLS_ENABLED_FORCED: PASS',
  'P2A_QA_DIRECT_TABLE_ACCESS_DENIED: PASS',
  'P2A_QA_NOT_IN_REALTIME: PASS',
  'P2A_QA_POLICY_LIFECYCLE: PASS',
  'P2A_QA_ONE_CURRENT_POLICY: PASS',
  'P2A_QA_MUTEX_EXACT_CENTER: PASS',
  'P2A_QA_MUTEX_NO_RAW_PII: PASS',
  'P2A_QA_REVIEW_EXACT_CENTER: PASS',
  'P2A_QA_REVIEW_TERMINAL_IMMUTABLE: PASS',
  'P2A_QA_REVIEW_VERSION_PLUS_ONE: PASS',
  'P2A_QA_EXACT_NAME_BIRTH_DUPLICATE_REVIEW_SUPPORT: PASS',
  'P2A_QA_RESERVATION_EXACT_CENTER: PASS',
  'P2A_QA_RESERVATION_TERMINAL_IMMUTABLE: PASS',
  'P2A_QA_RESERVATION_NON_REBINDABLE_TARGET: PASS',
  'P2A_QA_RESERVATION_EXPIRY_FAIL_CLOSED: PASS',
  'P2A_QA_ONE_ACTIVE_EXACT_INTENT: PASS',
  'P2A_QA_CANONICAL_LOCK_ORDER_LIVENESS: PASS',
  'P2A_QA_FINAL_LOCAL_RESET: PASS',
]
includesAll(qa, requiredQaMarkers, 'P2A QA runtime markers')
includesAll(qa, [
  'P2A_QA_LEFTOVER_FIXTURE_COUNT:',
  'P2A_QA_NONDEFAULT_ROOT_COUNT:',
  'P2A_QA_TEMP_HELPER_COUNT:',
], 'P2A QA dynamic cleanup markers')
includesAll(report, [...requiredQaMarkers,
  'P2A_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P2A_QA_NONDEFAULT_ROOT_COUNT: 0',
  'P2A_QA_TEMP_HELPER_COUNT: 0',
], 'P2A report runtime evidence')
includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P2A_LOCAL_QA_ALLOW_RESET'",
  "assert.equal(process.env[resetConsentFlag], 'YES'",
  "localArgs('status -o json')",
  "localArgs('db reset')",
  "const expectedContainerName = 'supabase_db_ichess-center-os'",
  "const projectSlug = 'ichess-center-os'",
  "new Set(['127.0.0.1', 'localhost', '::1'])",
  'pg_catalog.pg_stat_activity',
  'pg_catalog.pg_locks',
  "order by identity_match_mutex_key for update",
  'finally {',
], 'P2A guarded local QA substance')
assert(!qa.includes('supabase db push'), 'P2A QA must not push a database')
assert(!qa.includes('supabase db pull'), 'P2A QA must not pull a database')
assert(!qa.includes('migration repair'), 'P2A QA must not repair remote migration state')

const currentP2ALine = 'F23.3E-P2A DONE backend/local verified / Physical identity-policy, opaque identity mutex, immutable match review và profile-creation reservation schema foundation; RLS/direct-access fail-closed, exact-center/lifecycle/lock-order local QA PASS; chưa apply remote'
const currentP2AMarker = `CURRENT CHECKPOINT — ${currentP2ALine}`
const historicalP2ATodoLine = 'F23.3E-P2A TODO backend / Physical identity-policy, mutex, review và profile-creation reservation schema foundation'
const historicalP2AHeading = '* Historical checkpoint compatibility note — non-current P2-design-era P2A marker; the indented literal below is not a current status:'
for (const roadmap of [canonicalRoadmap, localRoadmap]) {
  includesAll(roadmap, [
    'F23.3E-P2 DONE design',
    currentP2AMarker,
    'F23.3E-P2B TODO backend',
    'F23.3E-P2C TODO backend',
    'F23.3E-P2D TODO QA',
    'F23.3E-P3 TODO backend',
    'F23.3E-P4 TODO public/QA',
    historicalP2AHeading,
    historicalP2ATodoLine,
  ], 'Post-audit P2A roadmap checkpoint')
  const trimmedLines = roadmap.split(/\r?\n/).map((line) => line.trim())
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('CURRENT CHECKPOINT — F23.3E-P2A ')), [currentP2AMarker], 'Roadmap must have exactly one current P2A status')
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P2A ')), [historicalP2ATodoLine], 'P2A TODO must exist only as the historical compatibility literal')
  assert.equal(roadmap.split(currentP2ALine).length - 1, 1, 'P2A DONE status count drift')
  assert.equal(roadmap.split(historicalP2AHeading).length - 1, 1, 'P2A historical heading count drift')
  assert.equal(roadmap.split(historicalP2ATodoLine).length - 1, 1, 'P2A historical TODO count drift')
}

const auditedContent = [migration, report, smoke, qa].join('\n')
const mojibakeSequences = [
  'C\u0103\u00a1\u00c2\u00ba',
  '\u0103\u0192',
  '\u0103\u2020\u00b0',
  'H\u0103\u00a1\u00c2\u00ba',
  '\u0103\u00a1\u00c2\u00bb',
]
for (const value of mojibakeSequences) assert(!auditedContent.includes(value), `Mojibake detected: ${value}`)
assert(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(auditedContent), 'JWT-like secret found in P2A artifacts')
assert(!/https?:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/.test(qa), 'Non-loopback URL found in P2A QA')

console.log('P2A_SEMANTIC_EXACT_ARTIFACTS: PASS')
console.log('P2A_SEMANTIC_MIGRATION_HASH_INVENTORY: PASS')
console.log(`P2A_INHERITED_MIGRATION_HASH_CHECKPOINT_COUNT: ${inheritedMigrationHashes.size}`)
console.log(`P2A_OWNED_MIGRATION_COUNT: ${p2aOwnedMigrations.length}`)
console.log('P2A_SEMANTIC_FOUR_TABLE_SECURITY: PASS')
console.log('P2A_SEMANTIC_POLICY_MUTEX_REVIEW_RESERVATION: PASS')
console.log('P2A_SEMANTIC_GUARDED_LOCAL_QA: PASS')
console.log('P2A_SEMANTIC_POST_AUDIT_ROADMAP: PASS')
console.log('F23.3E-P2A physical identity review mutex reservation schema foundation semantic smoke passed')
