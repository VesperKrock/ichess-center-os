import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationName = '202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql'
const migrationRelative = `supabase/migrations/${migrationName}`
const reportRelative = 'docs/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime.md'
const smokeRelative = 'tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-smoke.js'
const qaRelative = 'tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-local-db-qa.js'
const artifacts = [migrationRelative, reportRelative, smokeRelative, qaRelative]

const p3c0ReportRelative = 'docs/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze.md'
const p3c0SmokeRelative = 'tests/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze-smoke.js'
const p3aRelative = 'docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md'
const p3bReportRelative = 'docs/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime.md'
const p3bMigrationRelative = 'supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql'
const p2bRelative = 'supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql'
const p2cRelative = 'supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql'
const migrationDirectory = join(root, 'supabase', 'migrations')

for (const relative of [
  ...artifacts,
  p3c0ReportRelative,
  p3c0SmokeRelative,
  p3aRelative,
  p3bReportRelative,
  p3bMigrationRelative,
  p2bRelative,
  p2cRelative,
]) {
  assert(existsSync(join(root, relative)), `Missing required artifact: ${relative}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const count = (content, pattern) => [...content.matchAll(pattern)].length
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const ordered = (content, values, label) => {
  let cursor = 0
  for (const value of values) {
    const index = content.indexOf(value, cursor)
    assert(index >= cursor, `${label}: missing or out of order: ${value}`)
    cursor = index + value.length
  }
}
const functionBlock = (sql, name) => {
  const start = sql.search(new RegExp(`create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${name}\\s*\\(`, 'i'))
  assert(start >= 0, `Missing function ${name}`)
  const tail = sql.slice(start + 1)
  const next = tail.search(/\ncreate(?:\s+or\s+replace)?\s+function\s+/i)
  const commit = tail.search(/\ncommit\s*;/i)
  const candidates = [next, commit].filter((value) => value >= 0)
  const end = candidates.length > 0 ? start + 1 + Math.min(...candidates) : sql.length
  return sql.slice(start, end)
}
const tableBlock = (sql, name) => {
  const start = sql.search(new RegExp(`create\\s+table\\s+public\\.${name}\\s*\\(`, 'i'))
  assert(start >= 0, `Missing table ${name}`)
  const end = sql.indexOf('\n);', start)
  assert(end > start, `Unterminated table ${name}`)
  return sql.slice(start, end + 3)
}
const functionContaining = (sql, value, label) => {
  const valueIndex = sql.indexOf(value)
  assert(valueIndex >= 0, `${label}: missing ${value}`)
  const prefix = sql.slice(0, valueIndex)
  const starts = [...prefix.matchAll(/create(?:\s+or\s+replace)?\s+function\s+public\.[a-z0-9_]+\s*\(/gi)]
  assert(starts.length > 0, `${label}: ${value} is not inside a function`)
  const start = starts.at(-1).index
  const tail = sql.slice(start + 1)
  const next = tail.search(/\ncreate(?:\s+or\s+replace)?\s+function\s+/i)
  return next >= 0 ? sql.slice(start, start + 1 + next) : sql.slice(start)
}

const sql = read(migrationRelative)
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const p3c0 = read(p3c0ReportRelative)
const p3c0Smoke = read(p3c0SmokeRelative)
const p3a = read(p3aRelative)
const p3bReport = read(p3bReportRelative)
const p3bSql = read(p3bMigrationRelative)
const p2b = read(p2bRelative)
const p2c = read(p2cRelative)

// P3C owns exactly one forward migration and the four audited package files.
// P3C0 is deliberately excluded from this phase token.
const p3cPhaseToken = /f23[-_]3e[-_]p3c(?![a-z0-9])/i
assert(!p3cPhaseToken.test('f23_3e_p3c0'), 'P3C ownership must not capture P3C0')
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => p3cPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => p3cPhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationDirectory).filter((name) => p3cPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3C must own exactly four artifacts')
const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql'))
assert.deepEqual(migrationFiles.filter((name) => p3cPhaseToken.test(name)), [migrationName], 'P3C must own exactly one migration')

// Lock the inherited checkpoint bytes without freezing the total future
// migration inventory. The P3C digest is filled after its SQL is final.
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
  ['202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql', '8232FFD8EF0A63FB60E2A3FDE957EC542A3F196DA4272BF420FF7F3E98F099F0'],
])
assert.equal(checkpointHashes.size, 15, 'P3C must lock 15 inherited migration hashes')
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing checkpoint migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
const p3cExpectedSha256 = '70B3FA5416D2B045EBB615032A3708302871149B86DF171B633F3429B18B206A'
assert.match(p3cExpectedSha256, /^[0-9A-F]{64}$/, 'Replace the P3C SHA placeholder after the migration is final')
assert.equal(sha256(migrationRelative), p3cExpectedSha256, 'P3C migration hash drift')
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P3C smoke must not freeze total migration inventory')

// Final-audited inherited design and runtime boundaries remain normative.
includesAll(p3c0, [
  'F23_3E_P3C0_FINAL_TECHNICAL_AUDIT: PASS',
  'P3C0_P3C_BACKEND_LOCAL_IMPLEMENTATION:\nSAFE_TO_RESUME',
  'P3C0_EXISTING_BYTEA_VERSION_SHAPE_SUFFICIENT: YES',
  'P3C0_SCHEMA_EXPANSION_REQUIRED: NO',
  'P3C_GUARDIAN_SOURCE_CIPHERTEXT_DIRECT_COPY_ALLOWED: NO',
  'P3C_GUARDIAN_TARGET_REPROTECTION_REQUIRED: YES',
  'P3C0_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT: 3',
  'P3C_CRYPTO_ENVIRONMENT_EQUALS_P3B_AUTHORITY_ENVIRONMENT: NO',
  'P3D_COMPARE_P3C_CRYPTO_ENVIRONMENT_TO_P3B_AUTHORITY_ENVIRONMENT: NO',
  'P3_PRODUCT_INGESTION_INTEGRATION: DEFERRED',
], 'P3C0 normative addendum')
assert(p3c0Smoke.includes('checkpointHashes.size, 15'), 'P3C0 inherited hash lock missing')
includesAll(p3a, [
  'F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS',
  'P3_CANONICAL_ACTION_SET_DIGEST_MUST_EQUAL_LEGACY_REQUEST_DIGEST: NO',
  'P3_ACTION_SET_DIGEST_BINDS_ACTION_VERSION: YES',
  'P3_AUTHORITY_DIGEST_COMPUTED_AFTER_APPROVED_VERSION_INCREMENT: YES',
  'P3_EXACT_REPLAY_REHASHES_EXECUTED_ACTIONS_AGAINST_APPROVED_AUTHORITY_DIGEST: NO',
], 'P3A frozen digest lifecycle')
includesAll(p3bReport, [
  'F23_3E_P3B_FINAL_TECHNICAL_AUDIT: PASS',
  'P3B_PRODUCTION_REVIEWED_ACTION_MATERIALIZER: NOT IMPLEMENTED — P3C',
  'P3B_TARGET_PROFILE_RUNTIME: NOT IMPLEMENTED — P3C',
  'P3B_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED — P3D',
  'P3B_TERMINAL_ENVIRONMENT_SOURCE: CRM_CONVERSION_AUTHORITY.ENVIRONMENT_FINGERPRINT',
], 'P3B inherited boundary')

// Exactly four protected canonical business aggregates, with no plaintext or
// alternate result/identity aggregate introduced by P3C.
const tableNames = [...sql.matchAll(/create\s+table\s+public\.([a-z0-9_]+)\s*\(/gi)].map((match) => match[1])
assert.deepEqual(tableNames.sort(), [
  'crm_identity_target_binding',
  'guardian_profile',
  'guardian_student_relationship',
  'student_profile',
], 'P3C migration must create exactly four business tables')

const studentTable = tableBlock(sql, 'student_profile')
includesAll(studentTable, [
  'student_id uuid', 'center_id text', 'legacy_local_id text', 'display_name text',
  'birth_evidence_protected bytea', 'profile_status text', 'learning_lifecycle_status text',
  'identity_policy_registry_id uuid', 'normalization_version integer', 'match_policy_version integer',
  'minimum_evidence_policy_version integer', 'name_lookup_digest bytea', 'birth_lookup_digest bytea',
  'identity_evidence_digest bytea', 'student_version integer', 'created_from_case_id uuid',
  'created_from_candidate_id uuid', 'created_from_request_id uuid', 'created_from_action_id uuid',
  'created_by_user_id uuid', 'archived_at timestamptz',
], 'Student physical shape')
includesAll(sql, [
  'student_profile_center_student_key',
  'student_profile_identity_detection_idx',
  'references public.center_crm_control(center_id)',
], 'Student exact-center and detection backstops')
assert(!/create\s+unique\s+index[^;]+student_profile[^;]+name_lookup_digest[^;]+birth_lookup_digest/is.test(sql), 'Same-name/birth evidence must remain non-unique')

const guardianTable = tableBlock(sql, 'guardian_profile')
includesAll(guardianTable, [
  'guardian_id uuid', 'center_id text', 'display_name text',
  'protected_contact_methods_ciphertext bytea', 'contact_methods_crypto_version integer',
  'normalized_lookup_digests bytea[]', 'identity_evidence_digest bytea',
  'normalization_version integer', 'guardian_status text', 'guardian_version integer',
  'created_from_contact_id uuid', 'created_from_case_id uuid', 'created_from_request_id uuid',
  'created_from_action_id uuid', 'created_by_user_id uuid', 'archived_at timestamptz',
], 'Guardian physical shape')
includesAll(sql, ['guardian_profile_center_guardian_key', 'contact_methods_crypto_version = 1'], 'Guardian target contract')

const bindingTable = tableBlock(sql, 'crm_identity_target_binding')
includesAll(bindingTable, [
  'identity_target_binding_id uuid', 'center_id text', 'identity_kind text',
  'source_contact_id uuid', 'source_candidate_student_id uuid', 'student_id uuid', 'guardian_id uuid',
  'binding_status text', 'binding_version integer', 'source_version_at_binding integer',
  'target_version_at_binding integer', 'originating_request_id uuid', 'originating_action_id uuid',
  'originating_review_id uuid', 'terminal_at timestamptz',
], 'Identity target binding shape')
includesAll(bindingTable, ["identity_kind in ('STUDENT', 'GUARDIAN')", "binding_status in ('ACTIVE', 'REVOKED', 'SUPERSEDED')"], 'Finite binding vocabulary')
assert(/source_candidate_student_id\s+is\s+not\s+null[\s\S]+student_id\s+is\s+not\s+null/i.test(bindingTable), 'Student binding typed endpoints missing')
assert(/source_contact_id\s+is\s+not\s+null[\s\S]+guardian_id\s+is\s+not\s+null/i.test(bindingTable), 'Guardian binding typed endpoints missing')

const relationshipTable = tableBlock(sql, 'guardian_student_relationship')
includesAll(relationshipTable, [
  'relationship_id uuid', 'center_id text', 'guardian_id uuid', 'student_id uuid',
  'relationship_type text', 'is_primary_contact boolean', 'financial_contact_role text',
  'academic_contact_role text', 'status text', 'relationship_version integer',
  'effective_from timestamptz', 'effective_to timestamptz', 'created_from_request_id uuid',
  'created_from_action_id uuid', 'created_by_user_id uuid',
  "'PARENT'", "'LEGAL_GUARDIAN'", "'CAREGIVER'", "'EMERGENCY_CONTACT'", "'OTHER_REVIEWED'",
  "'NONE'", "'PRIMARY'", "'SECONDARY'", "'ACTIVE'", "'ENDED'", "'ARCHIVED'",
], 'Guardian-Student relationship shape')
includesAll(sql, [
  'guardian_student_relationship_one_active_equivalent_idx',
  'guardian_student_relationship_one_active_primary_idx',
], 'Relationship uniqueness backstops')

for (const table of ['student_profile', 'guardian_profile', 'crm_identity_target_binding', 'guardian_student_relationship']) {
  includesAll(sql, [
    `alter table public.${table} enable row level security`,
    `alter table public.${table} force row level security`,
    `revoke all on table public.${table} from public, anon, authenticated, service_role`,
  ], `${table} protected boundary`)
}
assert(!/create\s+policy[\s\S]{0,180}(student_profile|guardian_profile|crm_identity_target_binding|guardian_student_relationship)/i.test(sql), 'P3C protected tables must have no convenience policy')
assert(!/alter\s+publication/i.test(sql), 'P3C protected tables must not enter Realtime')

// P3C0 crypto is implemented byte-for-byte as a separate server-root domain.
includesAll(sql, [
  'f23_3e_p3c_internal_crypto_environment_fingerprint',
  'f23_3e_p3c_internal_protect_contact_source_evidence',
  'f23_3e_p3c_internal_protect_target_evidence',
  'vault._crypto_aead_det_encrypt', 'vault._crypto_aead_det_decrypt',
  'ichess.p3c.environment.fingerprint.v1', 'ichess.p3c.environment.fingerprint.aad.v1',
  'IC3CSE01', 'IC3GTE01', 'iC3Src01', 'iC3Gdn01', 'iC3Env01',
  'ichess.crm.contact.source-evidence.aead.v1',
  'ichess.guardian.target.contact-evidence.aead.v1',
  'f23_3e_p3c_internal_lp32', 'uuid_send',
], 'P3C0 physical crypto contract')
const cryptoEnvironment = functionBlock(sql, 'f23_3e_p3c_internal_crypto_environment_fingerprint')
includesAll(cryptoEnvironment, [
  'vault._crypto_aead_det_encrypt', 'ichess.p3c.environment.fingerprint.v1',
  'ichess.p3c.environment.fingerprint.aad.v1', 'iC3Env01', "'sha256'",
], 'Server-root crypto environment derivation')
assert(!/p_[a-z0-9_]+\s+/i.test(cryptoEnvironment.slice(0, cryptoEnvironment.indexOf('returns'))), 'Crypto environment helper must take no caller input')
assert(!/(authority|identity)_environment_fingerprint/i.test(cryptoEnvironment), 'Crypto environment helper must not import authority/identity domains')

const sourceAad = functionContaining(sql, 'ichess.crm.contact.source-evidence.aead.v1', 'Source AAD')
includesAll(sourceAad, ['f23_3e_p3c_internal_lp32', 'f23_3e_p3c_internal_crypto_environment_fingerprint', 'uuid_send'], 'Source LP32 AAD')
assert(/language\s+sql\s+stable/i.test(sourceAad), 'Source AAD must not be IMMUTABLE while it derives a server-root crypto environment')
assert(!/(authority|identity)_environment_fingerprint/i.test(sourceAad), 'Source AAD must use only the crypto environment')
const targetAad = functionContaining(sql, 'ichess.guardian.target.contact-evidence.aead.v1', 'Guardian AAD')
includesAll(targetAad, ['f23_3e_p3c_internal_lp32', 'f23_3e_p3c_internal_crypto_environment_fingerprint', 'uuid_send'], 'Guardian LP32 AAD')
assert(/language\s+sql\s+stable/i.test(targetAad), 'Guardian AAD must not be IMMUTABLE while it derives a server-root crypto environment')
assert(!/(authority|identity)_environment_fingerprint/i.test(targetAad), 'Guardian AAD must use only the crypto environment')
assert(/octet_length\s*\([^)]*envelope[^)]*\)\s*<>\s*36\s*\+/i.test(sql), 'Envelope parser must reject truncation and trailing bytes by exact length')

const targetProtection = functionBlock(sql, 'f23_3e_p3c_internal_protect_target_evidence')
includesAll(targetProtection, [
  'f23_3e_p3c_internal_unwrap_contact_source_evidence',
  'vault._crypto_aead_det_encrypt', 'IC3GTE01',
], 'Source unwrap to Guardian re-protection')
assert(/octet_length\s*\(v_nonce\)\s*<>\s*16/i.test(targetProtection), 'Guardian sealing must validate the frozen 16-byte nonce')
assert(/octet_length\s*\(v_sealed\)\s+not\s+between\s+33\s+and\s+65568/i.test(targetProtection), 'Guardian sealing must validate the frozen sealed-payload bounds')
const sourceUnwrap = functionBlock(sql, 'f23_3e_p3c_internal_unwrap_contact_source_evidence')
includesAll(sourceUnwrap, [
  'contact_methods_crypto_version <> 2', 'IC3CSE01',
  'vault._crypto_aead_det_decrypt', 'iC3Src01',
], 'Canonical source authentication')
const guardianWriterCrypto = functionBlock(sql, 'f23_3e_p3c_internal_create_guardian_target')
assert(!/insert\s+into\s+public\.guardian_profile[\s\S]+?values\s*\([\s\S]+?v_contact\.protected_contact_methods_ciphertext/i.test(guardianWriterCrypto), 'Contact ciphertext must never be inserted directly into Guardian')
includesAll(guardianWriterCrypto, [
  'f23_3e_p3c_internal_protect_target_evidence',
  'v_protected.protected_contact_methods_ciphertext',
], 'Guardian writer must persist only target-context re-protection')

// Physical provenance of all three independent environment domains.
const issueAuthority = functionBlock(p3bSql, 'f23_3e_p3b_issue_conversion_authority')
includesAll(issueAuthority, [
  'p_environment_fingerprint bytea',
  'p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32',
  'v_authority_id, p_environment_fingerprint, v_center_id, p_actor_user_id',
], 'Caller-supplied P3B authority environment')
assert(!/vault\._crypto|extensions\.hmac/i.test(issueAuthority), 'P3B authority environment must remain opaque caller supplied')
const identityEnvironment = functionBlock(p2b, 'f23_3e_p2b_internal_environment_fingerprint')
includesAll(identityEnvironment, [
  'p_digest_key_epoch integer', 'extensions.hmac(',
  'f23.3e.p2b/environment-fingerprint/v1',
  'public.f23_3e_p2b_internal_digest_key(p_digest_key_epoch)', "'sha256'",
], 'P2B identity-policy environment')
assert(!/vault\._crypto_aead_det/i.test(identityEnvironment), 'P2B identity environment must remain outside the crypto domain')
for (const conflation of [
  /crypto_environment_fingerprint\s*(?:=|is\s+(?:not\s+)?distinct\s+from)\s*authority_environment_fingerprint/i,
  /crypto_environment_fingerprint\s*(?:=|is\s+(?:not\s+)?distinct\s+from)\s*identity_environment_fingerprint/i,
  /authority_environment_fingerprint\s*(?:=|is\s+(?:not\s+)?distinct\s+from)\s*identity_environment_fingerprint/i,
]) assert(!conflation.test(sql), `Environment-domain equality is forbidden: ${conflation}`)

// Canonical adapters forward-replace only inherited internal dispatch. External
// P2B/P2C wrapper signatures remain checkpointed by their locked migrations.
const p2bDispatch = functionBlock(sql, 'f23_3e_p2b_internal_search_masked_candidates')
includesAll(p2bDispatch, [
  'f23_3e_p3c_internal_p2b_checkpoint_search',
  'student_profile', 'guardian_profile', 'canonical.student_profile.v1',
  'canonical.guardian_profile.v1', 'reuse_eligible', 'crm_identity_target_binding',
  'MATCH_SEARCH_UNAVAILABLE',
], 'P2B canonical/legacy dispatch')
const legacyStudentAdapter = functionBlock(sql, 'f23_3e_p3c_internal_p2b_checkpoint_search')
includesAll(legacyStudentAdapter, [
  'center_cloud_entities', 'legacy.center_cloud_student.readonly.v1',
  "'reuse_eligible', false",
], 'Inherited legacy Student detection-only adapter')
assert(!/create(?:\s+or\s+replace)?\s+function\s+public\.f23_3e_p2b_(?:search_masked_candidates|get_masked_candidate_review_detail)\s*\(/i.test(sql), 'P3C must not replace external P2B wrappers')

const p2cDispatch = functionBlock(sql, 'f23_3e_p2c_internal_execute_mutation')
includesAll(p2cDispatch, [
  'canonical.student_profile.v1', 'canonical.guardian_profile.v1',
  'preallocated_target_id', 'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED',
], 'P2C canonical review/reservation dispatch')
assert(!/v_target_namespace\s*:=\s*'future\.(?:student|guardian)\.profile\.v1'/i.test(p2cDispatch), 'Old future namespaces must not be issued after P3C')
assert(!/create(?:\s+or\s+replace)?\s+function\s+public\.f23_3e_p2c_(?:create|decide|supersede|expire|reserve|cancel|read)_[a-z0-9_]*\s*\(/i.test(sql), 'P3C must preserve external P2C wrappers')

// Complete the pre-existing P3B typed target mirrors without changing the
// checkpointed serializer or action vocabulary.
includesAll(sql, [
  'crm_conversion_action_student_target_exact_center_fkey',
  'crm_conversion_action_guardian_target_exact_center_fkey',
  'crm_conversion_action_relationship_target_exact_center_fkey',
  'references public.student_profile(center_id, student_id)',
  'references public.guardian_profile(center_id, guardian_id)',
  'references public.guardian_student_relationship(center_id, relationship_id)',
], 'P3B typed target FK completion')
const identityShapeStart = sql.indexOf('drop constraint crm_conversion_action_identity_binding_shape_check')
const identityShapeEnd = sql.indexOf(';', identityShapeStart)
assert(identityShapeStart >= 0 && identityShapeEnd > identityShapeStart, 'P3C identity action shape replacement missing')
const identityShape = sql.slice(identityShapeStart, identityShapeEnd)
const createMirrorsArePopulated = /action_kind\s*=\s*'CREATE_NEW_STUDENT'[\s\S]+student_target_id\s*=\s*opaque_target_id/i.test(identityShape)
  && /action_kind\s*=\s*'CREATE_NEW_GUARDIAN'[\s\S]+guardian_target_id\s*=\s*opaque_target_id/i.test(identityShape)
if (/Typed target mirrors are\s+populated/i.test(report)) {
  assert(createMirrorsArePopulated, 'Report says all typed mirrors are populated but CREATE action constraints keep them null')
} else if (!createMirrorsArePopulated) {
  assert(/CREATE[^\n]{0,100}typed (?:target )?mirrors?[^\n]{0,100}(?:NULL|nullable)/i.test(report), 'Report must explicitly disclose nullable CREATE typed mirrors')
}
const inheritedSerializer = functionBlock(p3bSql, 'f23_3e_p3b_internal_action_set_digest')
includesAll(inheritedSerializer, ["'encoding_version', 1", "'action_version', a.action_version", 'order by a.conversion_action_id'], 'Frozen P3B serializer')
assert(!/create(?:\s+or\s+replace)?\s+function\s+public\.f23_3e_p3b_internal_action_set_digest\s*\(/i.test(sql), 'P3C must not replace the frozen P3B serializer')

// Internal writers and crypto helpers are never service-role RPCs.
const requiredInternalHelpers = [
  'f23_3e_p3c_internal_protect_contact_source_evidence',
  'f23_3e_p3c_internal_crypto_environment_fingerprint',
  'f23_3e_p3c_internal_protect_target_evidence',
  'f23_3e_p3c_internal_create_student_target',
  'f23_3e_p3c_internal_resolve_reusable_student',
  'f23_3e_p3c_internal_create_guardian_target',
  'f23_3e_p3c_internal_resolve_reusable_guardian',
  'f23_3e_p3c_internal_upsert_guardian_student_relationship',
]
const dynamicInternalRevoke = /for\s+v_function\s+in[\s\S]*?where\s+n\.nspname\s*=\s*'public'\s+and\s+p\.proname\s+like\s+'f23_3e_p3c_internal_%'[\s\S]*?execute\s+pg_catalog\.format\s*\(\s*'revoke all on function %s from public, anon, authenticated, service_role'[\s\S]*?v_function\.signature[\s\S]*?end\s+loop/i.test(sql)
for (const helper of requiredInternalHelpers) {
  functionBlock(sql, helper)
  const explicitInternalRevoke = new RegExp(`revoke\\s+(?:all|execute)\\s+on\\s+function\\s+public\\.${helper}\\s*\\([^;]+\\)\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role\\s*;`, 'i').test(sql)
  assert(dynamicInternalRevoke || explicitInternalRevoke, `Internal helper revoke missing: ${helper}`)
}

const reusableStudent = functionBlock(sql, 'f23_3e_p3c_internal_resolve_reusable_student')
includesAll(reusableStudent, [
  'v_review.conversion_request_id', 'v_review.candidate_student_id',
  'v_review.source_candidate_version', 'v_review.expires_at',
  'v_review.identity_policy_registry_id', 'v_binding.source_version_at_binding',
  'v_binding.target_version_at_binding',
], 'Reusable Student exact reviewed/current binding evidence')
const reusableGuardian = functionBlock(sql, 'f23_3e_p3c_internal_resolve_reusable_guardian')
includesAll(reusableGuardian, [
  'v_review.conversion_request_id', 'v_review.crm_contact_id',
  'v_review.source_contact_version', 'v_review.expires_at',
  'v_review.identity_policy_registry_id', 'v_binding.source_version_at_binding',
  'v_binding.target_version_at_binding',
], 'Reusable Guardian exact reviewed/current binding evidence')

const createStudentTarget = functionBlock(sql, 'f23_3e_p3c_internal_create_student_target')
const createGuardianTarget = functionBlock(sql, 'f23_3e_p3c_internal_create_guardian_target')
for (const [label, block] of [['Student', createStudentTarget], ['Guardian', createGuardianTarget]]) {
  const requestLock = block.indexOf('into v_request')
  const actionLock = block.indexOf('into v_action')
  assert(requestLock >= 0 && actionLock > requestLock, `${label} writer must lock Request before Action`)
  includesAll(block, [
    'v_review.conversion_request_id', 'v_review.expires_at',
    'v_reservation.conversion_request_id', 'v_reservation.match_review_id',
    'v_reservation.expires_at',
  ], `${label} writer current review/reservation binding`)
}
const relationshipWriter = functionBlock(sql, 'f23_3e_p3c_internal_upsert_guardian_student_relationship')
includesAll(relationshipWriter, [
  'center_crm_control', 'relationship_policy_version',
  'v_guardian_action.status', 'v_student_action.status',
  'expected_target_version',
], 'Relationship writer policy/action/target currentness')

const serviceRoleP3cGrants = [...sql.matchAll(/grant\s+execute\s+on\s+function\s+public\.(f23_3e_p3c_[a-z0-9_]+)\s*\([^;]+\)\s+to\s+service_role\s*;/gi)].map((match) => match[1])
assert.deepEqual([...new Set(serviceRoleP3cGrants)].sort(), [
  'f23_3e_p3c_finalize_reviewed_action_plan',
  'f23_3e_p3c_materialize_reviewed_action_pair',
], 'Exactly two P3C functions may be granted to service_role')

const materialize = functionBlock(sql, 'f23_3e_p3c_materialize_reviewed_action_pair')
includesAll(materialize.slice(0, materialize.indexOf('returns')), [
  'p_actor_user_id uuid', 'p_conversion_request_id uuid', 'p_expected_request_version integer',
  'p_guardian_match_review_id uuid', 'p_expected_guardian_review_version integer',
  'p_student_match_review_id uuid', 'p_expected_student_review_version integer',
  'p_relationship_action_id uuid', 'p_relationship_decision text', 'p_relationship_type text',
  'p_is_primary_contact boolean', 'p_financial_contact_role text', 'p_academic_contact_role text',
  'p_safe_reason_code text', 'p_relationship_policy_version integer',
  'p_operation_intent_digest bytea', 'p_idempotency_key_digest bytea',
  'p_idempotency_expires_at timestamptz',
], 'Materialization typed signature')
includesAll(materialize, [
  'security definer', "set search_path = ''", 'crm_idempotency_registry',
  "'ACTION_PLAN_MATERIALIZATION'", "'COMPLETED'", "'PROPOSED'",
  'insert into public.crm_conversion_action', 'crm.conversion.action_plan_materialized',
  'f23_3e_p3b_internal_action_set_digest',
], 'Materialization runtime')
assert(!/p_(?:center|role|action_json|target|mfa)/i.test(materialize.slice(0, materialize.indexOf('returns'))), 'Materialization must not accept caller authority/target truth')
for (const forbiddenTargetWrite of ['student_profile', 'guardian_profile', 'crm_identity_target_binding', 'guardian_student_relationship']) {
  assert(!new RegExp(`insert\\s+into\\s+public\\.${forbiddenTargetWrite}`, 'i').test(materialize), `Materialization must not write ${forbiddenTargetWrite}`)
}

const finalize = functionBlock(sql, 'f23_3e_p3c_finalize_reviewed_action_plan')
includesAll(finalize.slice(0, finalize.indexOf('returns')), [
  'p_actor_user_id uuid', 'p_conversion_request_id uuid', 'p_expected_request_version integer',
  'p_expected_action_count integer', 'p_operation_intent_digest bytea',
  'p_idempotency_key_digest bytea', 'p_idempotency_expires_at timestamptz',
], 'Finalization typed signature')
includesAll(finalize, [
  'security definer', "set search_path = ''", 'crm_idempotency_registry',
  "'ACTION_PLAN_FINALIZATION'", "'COMPLETED'", "'PROPOSED'", "'REVIEWED'",
  'crm.conversion.action_plan_finalized', 'f23_3e_p3b_internal_action_set_digest',
], 'Finalization runtime')
ordered(finalize, [
  "status = 'REVIEWED'",
  'action_version = a.action_version + 1',
  'v_final_digest := public.f23_3e_p3b_internal_action_set_digest',
], 'Finalized digest must follow persisted REVIEWED +1')
const replayBranch = finalize.indexOf("p3_result_kind = 'ACTION_PLAN_FINALIZATION'")
const liveProposedInterpretation = finalize.indexOf("status <> 'PROPOSED'")
assert(replayBranch >= 0 && liveProposedInterpretation > replayBranch, 'Finalization exact replay must precede live PROPOSED-state interpretation')

// The P3 result family is extended narrowly and Audit/Outbox remains finite.
includesAll(sql, [
  'f23_3e_p3b_internal_is_safe_result_snapshot',
  "'ACTION_PLAN_MATERIALIZATION'", "'ACTION_PLAN_FINALIZATION'",
  "'CONVERSION_AUTHORITY'", "'REAL_CONVERSION'",
  'crm.conversion.action_plan_materialized', 'crm.conversion.action_plan_finalized',
], 'Narrow P3 result/event extension')
const safeP3Result = functionBlock(sql, 'f23_3e_p3b_internal_is_safe_result_snapshot')
assert(/v_type\s*=\s*'ACTION_PLAN_MATERIALIZATION'[\s\S]+outcome_code[^\n]+ACTION_PLAN_MATERIALIZED/i.test(safeP3Result), 'Materialization result type must bind its exact outcome')
assert(/v_type\s*=\s*'ACTION_PLAN_FINALIZATION'[\s\S]+outcome_code[^\n]+ACTION_PLAN_FINALIZED/i.test(safeP3Result), 'Finalization result type must bind its exact outcome')
assert(!/create\s+table\s+public\.[a-z0-9_]*(?:idempotency|result)/i.test(sql), 'P3C must reuse the inherited idempotency registry')
for (const block of [materialize, finalize]) {
  assert(!/(protected_contact_methods_ciphertext|birth_evidence_protected|normalized_lookup_digests|plaintext|crypto_key|nonce)/i.test(block), 'Plan RPC result/event path must contain no protected/raw crypto material')
}

// P3D composition remains physically absent.
assert(!/f23_3e_p3d_|conversion\.execute|real_conversion_result/i.test(sql), 'P3D executor/result runtime is forbidden in P3C')
assert(!/update\s+public\.crm_conversion_authority[\s\S]{0,240}status\s*=\s*'CONSUMED'/i.test(sql), 'P3C must not consume authority')
assert(!/update\s+public\.crm_profile_creation_reservation[\s\S]{0,240}status\s*=\s*'CONSUMED'/i.test(sql), 'P3C must not consume reservations')
assert(!/insert\s+into\s+public\.crm_identity_target_binding/i.test(sql), 'P3C must expose no production binding creation path')
assert(!/\b(insert\s+into|update|delete\s+from)\s+auth\.users\b/i.test(sql), 'Production migration must not mutate Auth')
assert(!/(signUp|admin\/users|createUser|password|mfa)/i.test(sql), 'Production migration must not implement Auth-provider flows')

// Final-audit report state and frozen semantics are explicit and evidence-backed.
includesAll(report, [
  'F23_3E_P3C_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P3C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P3C_MIGRATION_CREATED: YES',
  'F23_3E_P3C_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P3C_LOCAL_DB_QA: PASS',
  'P3C_STUDENT_CANONICAL_RUNTIME: IMPLEMENTED',
  'P3C_GUARDIAN_CANONICAL_RUNTIME: IMPLEMENTED',
  'P3C_IDENTITY_TARGET_BINDING_RUNTIME: IMPLEMENTED',
  'P3C_GUARDIAN_STUDENT_RELATIONSHIP_RUNTIME: IMPLEMENTED',
  'P3C_CANONICAL_SEARCH_ADAPTERS: IMPLEMENTED',
  'P3C_REVIEW_RESERVATION_CANONICAL_DISPATCH: IMPLEMENTED',
  'P3C_CRYPTO_SOURCE_ENVELOPE_RUNTIME: IMPLEMENTED',
  'P3C_GUARDIAN_REPROTECTION_RUNTIME: IMPLEMENTED',
  'P3C_REVIEWED_ACTION_PLAN_MATERIALIZATION: IMPLEMENTED',
  'P3C_REVIEWED_ACTION_PLAN_FINALIZATION: IMPLEMENTED',
  'P3C_INTERNAL_TARGET_WRITERS: IMPLEMENTED',
  'P3C_PRODUCTION_IDENTITY_BINDING_CREATE_RPC: NONE',
  'P3C_PRODUCT_CANONICAL_CONTACT_INGRESS: DEFERRED',
  'P3C_AUTHORITY_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D',
  'P3C_RESERVATION_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D',
  'P3C_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED — P3D',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'F23_3E_P3C_REMOTE_APPLY: NOT RUN',
  'F23_3E_P3C_AUTH_CHANGE: NO',
  'F23_3E_P3C_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P3C_DEPLOY: NOT RUN',
  'F23_3E_P3C_BROWSER_UI_WIRING: NOT STARTED',
  'P3C_CANONICAL_TARGET_FOUNDATION_READY_FOR_P3D: YES',
  'P3C_REAL_CONVERSION_EXECUTION_READY: NO',
  'P3C_FINALIZE_DIGEST_COMPUTED_AFTER_REVIEWED_VERSION_INCREMENT: YES',
  'P3C_LEGACY_REQUEST_DIGEST_EQUALS_CANONICAL_ACTION_SET_DIGEST: NO',
  'P3C_FINALIZATION_EXACT_REPLAY_REINTERPRETS_REVIEWED_STATE: NO',
  'P3C_CRYPTO_ENVIRONMENT_EQUALS_P3B_AUTHORITY_ENVIRONMENT: NO',
  'P3C_GUARDIAN_SOURCE_CIPHERTEXT_DIRECT_COPY_ALLOWED: NO',
  'P3C_GUARDIAN_TARGET_REPROTECTION_REQUIRED: YES',
], 'P3C report state')
assert(!report.includes('__P3C_'), 'P3C report evidence placeholders must be resolved before handoff')

// The guarded Docker QA is executable proof, including real blocking and an
// unconditional final reset of Auth, Vault, P3C and dependent fixtures.
includesAll(qa, [
  'ICHESS_P3C_LOCAL_QA_ALLOW_RESET', 'status -o json', '127.0.0.1',
  'supabase_vault', 'vault._crypto_aead_det_encrypt', 'vault._crypto_aead_det_decrypt',
  'IC3CSE01', 'IC3GTE01', 'iC3Src01', 'iC3Gdn01', 'iC3Env01',
  'MATCH_SEARCH_UNAVAILABLE', 'EXACT_REVIEWED_MATCH', 'CREATE_NEW_REVIEWED',
  'canonical.student_profile.v1', 'canonical.guardian_profile.v1',
  'ACTION_PLAN_MATERIALIZATION', 'ACTION_PLAN_FINALIZATION',
  'IDEMPOTENCY_CONFLICT', 'RELATIONSHIP_DECISION_REQUIRED',
  "wait_event_type = 'Lock'", 'pg_blocking_pids',
  'finally', 'auth.users', 'vault.secrets',
  'student_profile', 'guardian_profile', 'crm_identity_target_binding',
  'guardian_student_relationship', 'F23_3E_P3C_LOCAL_DB_QA: PASS',
], 'P3C guarded local QA coverage')
includesAll(qa, [
  'f23_3e_p3b_issue_conversion_authority',
  'P3C_QA_CRYPTO_WRONG_ENVIRONMENT: PASS',
  'P3C_QA_MATERIALIZATION_CREATE_MATRIX: PASS',
  'P3C_QA_MATERIALIZATION_REUSE_MATRIX: PASS',
  'P3C_QA_MATERIALIZATION_NO_TARGET_MATRIX: PASS',
  'P3C_QA_STALE_EVIDENCE_MATRIX: PASS',
  'P3C_QA_FAULT_INJECTION_MATRIX: PASS',
  'P3C_QA_REAL_LOCK_WAIT_MATRIX: PASS',
  'P3C_QA_PLAINTEXT_NONPERSISTENCE: PASS',
  'P3C_QA_P3B_AUTHORITY_ISSUANCE_COMPATIBILITY: PASS',
  'P3C_QA_LOCAL_CRYPTO_BRIDGE_FINAL_COUNT: 0',
], 'Integrated plan/security/fault/concurrency regression proof')
assert(/p\.proname\s+like\s+'f23_3e_p3c_internal_%'[\s\S]{0,360}has_function_privilege\('service_role',p\.oid,'EXECUTE'\)[\s\S]{0,260}has_function_privilege\('anon',p\.oid,'EXECUTE'\)[\s\S]{0,260}has_function_privilege\('authenticated',p\.oid,'EXECUTE'\)[\s\S]{0,260}\),\s*'0'\)/i.test(qa), 'P3C QA must prove zero application/service EXECUTE privileges on every internal helper')
assert(/runReset\s*\(/.test(qa), 'P3C QA must reset the local database')
assert(!/admin\/users|signUp|createUser|grant_type=password/i.test(qa), 'P3C QA must not call Auth provider APIs')
assert(!/(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b)/.test(qa), 'P3C QA must contain no private key/JWT')

// Package hygiene: no remote locator, credential, or real contact fixture.
for (const artifact of [sql, report, smoke, qa]) {
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(artifact), 'Private key material forbidden')
  assert(!/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(artifact), 'JWT-like material forbidden')
  assert(!/(postgres(?:ql)?:\/\/[^\s`]+|https:\/\/[a-z0-9-]+\.supabase\.co)/i.test(artifact), 'Remote database/project locator forbidden')
}

console.log('P3C_INHERITED_CHECKPOINT_MIGRATION_HASH_COUNT: 15')
console.log(`P3C_MIGRATION_SHA256: ${p3cExpectedSha256}`)
console.log('F23.3E-P3C canonical Student/Guardian binding/relationship runtime semantic smoke: PASS')
