import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationsDirectory = join(root, 'supabase', 'migrations')
const reportRelative = 'docs/f23-3e-p3d0-candidate-student-birth-evidence-crypto-contract-design-freeze.md'
const smokeRelative = 'tests/f23-3e-p3d0-candidate-student-birth-evidence-crypto-contract-design-freeze-smoke.js'
const artifacts = [reportRelative, smokeRelative]

const p1PlanRelative = 'docs/f23-3e-p1-canonical-crm-foundation-implementation-planning.md'
const p1aRelative = 'supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql'
const p2aRelative = 'supabase/migrations/202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql'
const p2aReportRelative = 'docs/f23-3e-p2a-identity-review-mutex-reservation-schema-foundation.md'
const p2bRelative = 'supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql'
const p2bReportRelative = 'docs/f23-3e-p2b-versioned-normalization-and-exact-center-masked-candidate-search.md'
const p2cRelative = 'supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql'
const p2cReportRelative = 'docs/f23-3e-p2c-reviewed-match-decision-and-create-new-reservation-typed-runtime.md'
const p3aRelative = 'docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md'
const p3bRelative = 'supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql'
const p3c0Relative = 'docs/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze.md'
const p3cRelative = 'supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql'
const p3cReportRelative = 'docs/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime.md'

for (const relative of [
  ...artifacts,
  p1PlanRelative,
  p1aRelative,
  p2aRelative,
  p2aReportRelative,
  p2bRelative,
  p2bReportRelative,
  p2cRelative,
  p2cReportRelative,
  p3aRelative,
  p3bRelative,
  p3c0Relative,
  p3cRelative,
  p3cReportRelative,
]) {
  assert(existsSync(join(root, relative)), `Missing required repo-truth file: ${relative}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const excludesAll = (content, values, label) => {
  for (const value of values) assert(!content.includes(value), `${label}: forbidden ${value}`)
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

const report = read(reportRelative)
const smoke = read(smokeRelative)
const p1Plan = read(p1PlanRelative)
const p1a = read(p1aRelative)
const p2a = read(p2aRelative)
const p2aReport = read(p2aReportRelative)
const p2b = read(p2bRelative)
const p2bReport = read(p2bReportRelative)
const p2c = read(p2cRelative)
const p2cReport = read(p2cReportRelative)
const p3a = read(p3aRelative)
const p3b = read(p3bRelative)
const p3c0 = read(p3c0Relative)
const p3c = read(p3cRelative)
const p3cReport = read(p3cReportRelative)

// P3D0 owns exactly a design and a semantic smoke. It does not capture P3D.
const p3d0PhaseToken = /f23[-_]3e[-_]p3d0(?![a-z0-9])/i
assert(p3d0PhaseToken.test('f23_3e_p3d0'), 'P3D0 ownership token is invalid')
for (const phase of ['p3d', 'p3da', 'p3d00', 'p3d1', 'p3e', 'p4']) {
  assert(!p3d0PhaseToken.test(`f23_3e_${phase}_future`), `P3D0 ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => p3d0PhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => p3d0PhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationsDirectory).filter((name) => p3d0PhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3D0 must own exactly two artifacts')
assert.deepEqual(
  readdirSync(migrationsDirectory).filter((name) => p3d0PhaseToken.test(name)),
  [],
  'P3D0 must own zero migrations',
)
assert(![...actualArtifacts].some((name) => /local-db-qa|runner/i.test(name)), 'P3D0 must own zero local DB QA runners')

// Lock inherited checkpoint bytes, but never freeze the total migration inventory.
const migrationFiles = readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql'))
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
  ['202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql', '70B3FA5416D2B045EBB615032A3708302871149B86DF171B633F3429B18B206A'],
])
assert.equal(checkpointHashes.size, 16, 'P3D0 must lock exactly 16 inherited checkpoint hashes')
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing inherited checkpoint migration: ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P3D0 smoke must not freeze total migration inventory')

// P1A physical Candidate source is protected-but-opaque bytea, not a crypto contract.
const candidateTable = tableBlock(p1a, 'consultation_case_candidate_student')
includesAll(candidateTable, [
  'candidate_student_id uuid primary key',
  'center_id text not null',
  'consultation_case_id uuid not null',
  'display_name_evidence text',
  'birth_evidence_protected bytea',
  'candidate_version integer not null default 1',
  'check (birth_evidence_protected is null or pg_catalog.octet_length(birth_evidence_protected) > 0)',
], 'P1A Candidate physical shape')
assert(!/birth[^\n,]*(?:crypto_version|envelope_version|key_epoch|key_slot)/i.test(candidateTable), 'P1A must not have a Candidate birth crypto-version registry')
assert(!/(aead|decrypt|unwrap|nonce|magic)/i.test(candidateTable), 'P1A structural Candidate check must not be reinterpreted as authentication')
includesAll(p1Plan, ['Protected PII', 'birth_evidence_protected'], 'P1 planning protected-evidence boundary')

// P2A stores aggregate versioned bindings, not recoverable birth plaintext.
includesAll(p2a, [
  'evidence_set_digest bytea not null',
  'identity_mutex_keys_digest bytea not null',
  'source_evidence_digest bytea not null',
  'preallocated_target_id uuid not null',
], 'P2A review/reservation bindings')
includesAll(p2aReport, [
  'F23_3E_P2A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
], 'P2A final-audited boundary')

// P2B/P2C use typed review-time dates for identity normalization and mutexes.
const normalizeBirth = functionBlock(p2b, 'f23_3e_p2b_internal_normalize_student_birth_v1')
includesAll(normalizeBirth, ['p_value date', "pg_catalog.to_char(p_value, 'YYYY-MM-DD')", "date '1900-01-01'"], 'P2B canonical date normalization')
includesAll(p2b, ["'STUDENT_DISPLAY_NAME'", "'STUDENT_BIRTH_DATE'", 'f23_3e_p2b_internal_environment_fingerprint'], 'P2B identity domains')
includesAll(p2bReport, [
  'F23_3E_P2B_FINAL_TECHNICAL_AUDIT: PASS',
  '`STUDENT_BIRTH_DATE` accepts PostgreSQL `date`',
  '`YYYY-MM-DD`',
], 'P2B final-audited date contract')
includesAll(p2c, ['p_birth_date_evidence date', "'STUDENT_BIRTH_DATE'", 'identity_mutex_keys_digest'], 'P2C review-time date evidence')
includesAll(p2cReport, [
  'F23_3E_P2C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
], 'P2C final-audited boundary')

// P3B physically binds exact purpose, step-up, current security and authority environment.
const authorityTable = tableBlock(p3b, 'crm_conversion_authority')
includesAll(authorityTable, [
  'actor_user_id uuid not null',
  'environment_fingerprint bytea not null',
  'step_up_assertion_id uuid not null',
  'membership_version integer not null',
  'account_security_version integer not null',
  'account_session_version integer not null',
  'purpose text not null',
  "status text not null default 'ISSUED'",
], 'P3B authority purpose and currentness')
const stepUpTable = tableBlock(p3b, 'account_step_up_assertion')
includesAll(stepUpTable, [
  'conversion_request_id uuid not null',
  'purpose text not null',
  'security_version integer not null',
  'session_version integer not null',
  'consumed_by_authority_id uuid',
], 'P3B consumed step-up binding')
assert(p3b.includes("'crm.real_conversion.execute'"), 'P3B physical execution purpose is missing')

// P3A freezes current evidence mutexes and a narrow executor signature with no birth input.
includesAll(p3a, [
  'F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS',
  '`STUDENT_DISPLAY_NAME` and `STUDENT_BIRTH_DATE` mutex keys from current source',
  'conversion.execute(',
  'conversion_request_id uuid,',
  'conversion_authority_id uuid,',
  'expected_request_version integer,',
  'expected_authority_version integer,',
  'environment_fingerprint bytea,',
  'operation_intent_digest bytea,',
  'idempotency_key_digest bytea,',
  'idempotency_expires_at timestamptz',
], 'P3A final-audited executor contract')
const executorSignatureStart = p3a.indexOf('conversion.execute(')
const executorSignatureEnd = p3a.indexOf(') ->', executorSignatureStart)
assert(executorSignatureStart >= 0 && executorSignatureEnd > executorSignatureStart, 'P3A executor signature missing')
const executorSignature = p3a.slice(executorSignatureStart, executorSignatureEnd)
assert(!/(birth|candidate|center|actor|role|step_up|action_list|target_choice)/i.test(executorSignature), 'P3D caller signature must remain free of birth and server-derived authority')

// P3C0 is the normative physical crypto primitive/environment provenance.
includesAll(p3c0, [
  'F23_3E_P3C0_FINAL_TECHNICAL_AUDIT: PASS',
  'supabase_vault 0.3.1',
  'vault._crypto_aead_det_encrypt(',
  'vault._crypto_aead_det_decrypt(',
  'vault._crypto_aead_det_noncegen()',
  'ASCII("iC3Env01")',
  'P3C0_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT: 3',
  'P3C0_P3B_AUTHORITY_ENVIRONMENT_PROVENANCE:',
  'CALLER_SUPPLIED_OPAQUE_32_BYTE_BINDING',
  'P3C0_P2B_IDENTITY_ENVIRONMENT_PROVENANCE:',
  'SERVER_DERIVED_IDENTITY_DIGEST_KEY_HMAC',
  'P3C0_CRYPTO_ENVIRONMENT_FINGERPRINT:',
  'SERVER_ROOT_DERIVED',
  'Define `U8(n)` as one unsigned byte, `U32(n)` as four unsigned big-endian bytes,',
  'and `LP32(b)`',
], 'P3C0 final-audited crypto provenance')

// P3C physical Student target and writer confirm the bounded forward-replacement need.
const studentTable = tableBlock(p3c, 'student_profile')
includesAll(studentTable, [
  'student_id uuid primary key',
  'center_id text not null',
  'birth_evidence_protected bytea not null',
  "profile_status text not null default 'ACTIVE'",
  'learning_lifecycle_status text',
  'student_version integer not null default 1',
], 'P3C Student target shape')
assert(!/birth[^\n,]*(?:crypto_version|envelope_version|key_epoch|key_slot)/i.test(studentTable), 'P3C Student table must not be misread as an existing birth crypto contract')
const studentWriter = functionBlock(p3c, 'f23_3e_p3c_internal_create_student_target')
includesAll(studentWriter, [
  'p_conversion_action_id uuid',
  'p_actor_user_id uuid',
  'p_display_name_evidence text',
  'p_birth_date_evidence date',
  "'STUDENT_DISPLAY_NAME'",
  "'STUDENT_BIRTH_DATE'",
  'f23_3e_p3c_internal_identity_mutex_keys(',
  'v_candidate.birth_evidence_protected',
  "'ACTIVE', null",
  'v_reservation.preallocated_target_id',
], 'P3C physical Student writer')
assert(/p_display_name_evidence\s*,\s*v_candidate\.birth_evidence_protected/i.test(studentWriter), 'P3C physical writer direct-copy fact drifted')
assert(!/(IC3SBE01|iC3Std01|student\.target\.birth-evidence\.aead\.v1)/.test(studentWriter), 'P3C checkpoint must not be retroactively treated as Student birth reprotection')
includesAll(p3cReport, [
  'F23_3E_P3C_FINAL_TECHNICAL_AUDIT: PASS',
  'P3C_PRODUCT_CANONICAL_CONTACT_INGRESS: DEFERRED',
  'P3C_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED',
], 'P3C final-audited boundary')

// Exact design closure and status markers.
includesAll(report, [
  'F23_3E_P3D0_STATUS: DESIGN COMPLETE IN REPO',
  'P3D0_FINAL_TECHNICAL_AUDIT:\nPASS',
  'P3D0_CANDIDATE_BIRTH_CRYPTO_DESIGN: COMPLETE',
  'P3D0_STUDENT_TARGET_BIRTH_CRYPTO_DESIGN: COMPLETE',
  'P3D0_ARTIFACT_COUNT: 2',
  'P3D0_MIGRATION_COUNT: 0',
  'P3D0_LOCAL_DB_QA_RUNNER_COUNT: 0',
  'P3D0_CANDIDATE_SOURCE_ENVELOPE:\nFROZEN',
  'P3D0_STUDENT_TARGET_ENVELOPE:\nFROZEN',
  'P3D0_PLAINTEXT_PERSISTENCE:\nNONE',
  'P3D0_GENERAL_REVEAL_RPC:\nNONE',
  'P3D0_P3C_CHECKPOINT_EDIT_REQUIRED:\nNO',
  'P3D0_P3D_EXTERNAL_SIGNATURE_CHANGE_REQUIRED:\nNO',
  'P3D0_PERSISTED_SCHEMA_EXPANSION_REQUIRED:\nNO',
  'P3D0_PRODUCT_INGESTION:\nDEFERRED',
  'P3D0_P3D_BACKEND_LOCAL_IMPLEMENTATION:\nSAFE_TO_RESUME',
  'P3D0_REAL_PRODUCT_END_TO_END:\nNO',
], 'P3D0 status')

includesAll(report, [
  'P3D0_P1A_CANDIDATE_BIRTH_BYTEA_IS_SELF_DESCRIBING_TODAY:\nNO',
  'P3D0_SYNTHETIC_UTF8_BYTEA_IS_PRODUCTION_BIRTH_CRYPTO_CONTRACT:\nNO',
  'P3D0_REVIEW_REASON_CODE_REPLACES_CURRENT_BIRTH_EVIDENCE:\nNO',
  'P3D0_REVIEW_TIME_TYPED_BIRTH_DATE_IS_EXECUTOR_AUTHORITY:\nNO',
  'P3D0_P3D_NEEDS_AUTHENTICATED_SERVER_SIDE_BIRTH_EVIDENCE:\nYES',
  'P3D0_EXISTING_CANONICAL_STUDENT_BIRTH_PROTECTION_CONTRACT:\nNO',
  'P3D0_CURRENT_P3C_WRITER_DIRECTLY_COPIES_CANDIDATE_BYTES:\nYES',
  'P3D0_P3C_WRITER_SIGNATURE_CAN_BE_PRESERVED:\nYES',
  'P3C_CHECKPOINT_MIGRATION_EDIT:\nNO',
], 'P3D0 physical conclusions')

includesAll(report, [
  'P3D0_NEW_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT:\n0',
  'P3D0_CANDIDATE_BIRTH_USES_P3C_CRYPTO_ENVIRONMENT:\nYES',
  'P3D0_CRYPTO_ENVIRONMENT_EQUALS_AUTHORITY_ENVIRONMENT:\nNO_REQUIREMENT',
  'P3D0_CRYPTO_ENVIRONMENT_EQUALS_IDENTITY_ENVIRONMENT:\nNO_REQUIREMENT',
  'P3D0_CRYPTO_ENVIRONMENT_USED_AS_IDENTITY_ENVIRONMENT:\nNO',
  'P3D0_IDENTITY_ENVIRONMENT_USED_AS_CRYPTO_ENVIRONMENT:\nNO',
  'P3D0_AUTHORITY_ENVIRONMENT_USED_AS_CRYPTO_ENVIRONMENT:\nNO',
], 'P3D0 three environment domains')

includesAll(report, [
  'P3D0_ENVELOPE_FORMAT_VERSION: 1',
  'P3D0_PAYLOAD_SCHEMA_VERSION: 1',
  'P3D0_CANDIDATE_BIRTH_SOURCE_MAGIC:\nIC3CBE01',
  'F23_3E_P3D_CANDIDATE_BIRTH_SOURCE_PROTECTION',
  'P3D0_CANDIDATE_BIRTH_SOURCE_KDF_CONTEXT:\niC3Bth01',
  'P3D0_STUDENT_BIRTH_TARGET_MAGIC:\nIC3SBE01',
  'F23_3E_P3D_STUDENT_BIRTH_TARGET_PROTECTION',
  'P3D0_STUDENT_BIRTH_TARGET_KDF_CONTEXT:\niC3Std01',
  'strict 10-byte date',
  'P3D0_CANDIDATE_BIRTH_PLAINTEXT_LENGTH_BYTES: 10',
  'P3D0_CANONICAL_DATE_ROUND_TRIP_REQUIRED:\nYES',
], 'P3D0 envelope and canonical payload')

includesAll(report, [
  'LP32(UTF8("ichess.crm.candidate.birth-evidence.aead.v1"))',
  'LP32(uuid_send(consultation_case_id))',
  'LP32(uuid_send(candidate_student_id))',
  'P3D0_CANDIDATE_BIRTH_AAD_BINDS_CENTER:\nYES',
  'P3D0_CANDIDATE_BIRTH_AAD_BINDS_CASE:\nYES',
  'P3D0_CANDIDATE_BIRTH_AAD_BINDS_CANDIDATE:\nYES',
  'LP32(UTF8("ichess.student.target.birth-evidence.aead.v1"))',
  'LP32(uuid_send(student_id))',
  'P3D0_STUDENT_BIRTH_AAD_BINDS_CENTER:\nYES',
  'P3D0_STUDENT_BIRTH_AAD_BINDS_STUDENT:\nYES',
], 'P3D0 exact AAD domains')

includesAll(report, [
  'P3D0_PRELOCK_PROTECTED_PURPOSE_PRECHECK:\nREQUIRED',
  'P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_AUTHORITY_RECHECK:\nNO',
  'P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_SECURITY_RECHECK:\nNO',
  'P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_SOURCE_RECHECK:\nNO',
  'CENTER_CRM_CONTROL_ROW',
  'SORTED_IDENTITY_MUTEX_ROWS',
  'CONSUMED_STEP_UP_ASSERTION_ROW',
  'CONVERSION_AUTHORITY_ROW',
  'CANDIDATE_STUDENT_ROWS',
], 'P3D0 two-stage authority and lock order')

includesAll(report, [
  'P3D0_CANDIDATE_BIRTH_CIPHERTEXT_DIRECT_COPY_TO_STUDENT:\nNO',
  'P3D0_STUDENT_BIRTH_TARGET_REPROTECTION_REQUIRED:\nYES',
  'P3D0_SOURCE_UNWRAP_REDERIVES_P2_STUDENT_MUTEXES:\nYES',
  'P3D0_P3C_FORWARD_REPLACEMENT_SCOPE:\nPROTECTED_BIRTH_BRIDGE_ONLY',
  'P3D0_P3C_BUSINESS_SEMANTICS_CHANGE:\nNO',
  'CREATE_NEW_REVIEWED',
  'reservation.preallocated_target_id',
  '`learning_lifecycle_status = NULL`',
], 'P3D0 reprotection and P3C forward compatibility')

includesAll(report, [
  'P3D0_P3D_CALLER_SUPPLIES_BIRTH_DATE:\nNO',
  'P3D0_LEGACY_CANDIDATE_BIRTH_REINTERPRETATION:\nNO',
  'P3D0_LEGACY_CANDIDATE_BIRTH_AUTOMATIC_MIGRATION:\nNO',
  'P3D0_LEGACY_CANDIDATE_CREATE_EXECUTION:\nFAIL_CLOSED',
  'CANDIDATE_BIRTH_CRYPTO_UNAVAILABLE',
  'CANDIDATE_BIRTH_AUTHENTICATION_FAILED',
  'CANDIDATE_BIRTH_PAYLOAD_INVALID',
  'STUDENT_BIRTH_TARGET_PROTECTION_FAILED',
  'P3D0_CANDIDATE_BIRTH_GENERAL_REVEAL_RPC:\nNONE',
  'P3D0_CANDIDATE_BIRTH_BROWSER_REVEAL:\nNO',
  'P3D0_CANDIDATE_BIRTH_SERVICE_ROLE_DIRECT_REVEAL:\nNO',
  'P3D0_PRODUCT_CANDIDATE_BIRTH_INGESTION:\nDEFERRED',
], 'P3D0 fail-closed privacy and ingress boundary')

// A design freeze may name future helpers but cannot smuggle runtime DDL/JS.
assert(!/\bcreate\s+(?:or\s+replace\s+)?(?:function|table|trigger)\b/i.test(report), 'P3D0 report must not implement SQL runtime')
assert(!/\b(?:alter|drop)\s+(?:function|table|trigger)\b/i.test(report), 'P3D0 report must not implement migration DDL')
excludesAll(report, ['service_role = end-user authority', 'plaintext-in-bytea production contract'], 'P3D0 unsafe design claims')

// Local hygiene: no known mojibake families, secrets, or real PII fixtures.
for (const [label, content] of [['report', report], ['smoke', smoke]]) {
  const badSequences = [
    [67, 195, 161, 194, 186],
    [195, 402],
    [195, 8224, 194, 176],
    [72, 195, 161, 194, 186],
    [195, 161, 194, 187],
    [66, 117, 195, 161, 194, 187, 226, 8364, 162, 105, 32, 104, 195, 161, 194, 187, 194, 141, 99, 32, 109, 195, 161, 194, 187, 226, 8364, 186, 105],
  ].map((points) => String.fromCodePoint(...points))
  for (const bad of badSequences) {
    assert(!content.includes(bad), `${label}: mojibake found: ${bad}`)
  }
  assert(!/(eyJ[a-zA-Z0-9_-]{20,}\.|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content), `${label}: possible secret material`)
}

console.log('P3D0_ARTIFACT_COUNT: 2')
console.log('P3D0_MIGRATION_COUNT: 0')
console.log('P3D0_LOCAL_DB_QA_RUNNER_COUNT: 0')
console.log('P3D0_INHERITED_CHECKPOINT_MIGRATION_HASH_COUNT: 16')
console.log('F23.3E-P3D0 candidate-student birth-evidence crypto contract design-freeze semantic smoke: PASS')
