import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const reportRelative = 'docs/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze.md'
const smokeRelative = 'tests/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze-smoke.js'
const artifacts = [reportRelative, smokeRelative]
const migrationDirectory = join(root, 'supabase', 'migrations')

const p1aRelative = 'supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql'
const p1bRelative = 'supabase/migrations/202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql'
const p1cRelative = 'supabase/migrations/202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql'
const p1dRelative = 'supabase/migrations/202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql'
const p1eRelative = 'supabase/migrations/202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql'
const p2bRelative = 'supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql'
const p3bMigrationRelative = 'supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql'
const p3aRelative = 'docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md'
const p3bRelative = 'docs/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime.md'

for (const relative of [...artifacts, p1aRelative, p1bRelative, p1cRelative, p1dRelative, p1eRelative, p2bRelative, p3bMigrationRelative, p3aRelative, p3bRelative]) {
  assert(existsSync(join(root, relative)), `Missing required artifact: ${relative}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
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
  const start = sql.search(new RegExp(`create(?: or replace)? function public\\.${name}\\(`, 'i'))
  assert(start >= 0, `Missing function ${name}`)
  const tail = sql.slice(start + 1)
  const next = tail.search(/\ncreate(?: or replace)? function /i)
  const commit = tail.search(/\ncommit;/i)
  const candidates = [next, commit].filter((value) => value >= 0)
  const end = candidates.length > 0 ? start + 1 + Math.min(...candidates) : sql.length
  return sql.slice(start, end)
}

const report = read(reportRelative)
const smoke = read(smokeRelative)
const p1a = read(p1aRelative)
const p1b = read(p1bRelative)
const p1c = read(p1cRelative)
const p1d = read(p1dRelative)
const p1e = read(p1eRelative)
const p2b = read(p2bRelative)
const p3bSql = read(p3bMigrationRelative)
const p3a = read(p3aRelative)
const p3b = read(p3bRelative)

// P3C0 owns exactly one report and one semantic smoke, and no migration/QA runner.
const p3c0PhaseToken = /f23[-_]3e[-_]p3c0(?![a-z0-9])/i
for (const phase of ['p3c', 'p3ca', 'p3c00', 'p3c1', 'p3d', 'p4']) {
  assert(!p3c0PhaseToken.test(`f23_3e_${phase}_future`), `P3C0 ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => p3c0PhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => p3c0PhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationDirectory).filter((name) => p3c0PhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3C0 must own exactly two artifacts')
assert.deepEqual(
  readdirSync(migrationDirectory).filter((name) => p3c0PhaseToken.test(name)),
  [],
  'P3C0 must own zero migrations',
)
assert(![...actualArtifacts].some((name) => /local-db-qa|runner/i.test(name)), 'P3C0 must not own a QA runner')

// Lock the 15 inherited checkpoint migration contents without freezing the
// total migration inventory, so future forward migrations remain compatible.
const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql'))
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
assert.equal(checkpointHashes.size, 15, 'P3C0 must lock 15 inherited checkpoint hashes')
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing checkpoint migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P3C0 smoke must not freeze total migration inventory')

// Physical P1A provenance: the pair exists, and its checks are structural only.
const contactTableStart = p1a.indexOf('create table public.crm_contact (')
const contactTableEnd = p1a.indexOf('\n);', contactTableStart)
assert(contactTableStart >= 0 && contactTableEnd > contactTableStart, 'P1A crm_contact table missing')
const contactTable = p1a.slice(contactTableStart, contactTableEnd)
includesAll(contactTable, [
  'protected_contact_methods_ciphertext bytea not null',
  'contact_methods_crypto_version integer not null',
  'normalized_lookup_digests bytea[] not null',
  'normalization_version integer not null',
  'check (pg_catalog.octet_length(protected_contact_methods_ciphertext) > 0)',
  'check (contact_methods_crypto_version >= 1)',
], 'P1A physical Contact shape')
assert(!/(decrypt|unwrap|aead|nonce|key_epoch|key_slot)/i.test(contactTable), 'P1A must not be reinterpreted as an envelope registry')

// Physical P1D provenance: caller values are structurally validated and stored.
const validator = functionBlock(p1d, 'f23_3e_p1d_internal_valid_contact_payload')
includesAll(validator, [
  'p_ciphertext bytea',
  'p_crypto_version integer',
  'pg_catalog.octet_length(p_ciphertext) > 0',
  'p_crypto_version is not null and p_crypto_version >= 1',
], 'P1D structural Contact validator')
assert(!/(decrypt|unwrap|aead|nonce|key_epoch|key_slot)/i.test(validator), 'P1D validator must remain non-cryptographic')

const createContact = functionBlock(p1d, 'f23_3e_p1d_create_crm_contact')
const updateContact = functionBlock(p1d, 'f23_3e_p1d_update_crm_contact')
for (const [label, block] of [['create', createContact], ['update', updateContact]]) {
  includesAll(block, [
    'p_protected_contact_methods_ciphertext bytea',
    'p_contact_methods_crypto_version integer',
    'p_protected_contact_methods_ciphertext',
    'p_contact_methods_crypto_version',
  ], `P1D ${label} caller provenance`)
}
includesAll(createContact, [
  'protected_contact_methods_ciphertext, contact_methods_crypto_version',
  'p_protected_contact_methods_ciphertext, p_contact_methods_crypto_version',
], 'P1D create direct storage')
includesAll(updateContact, [
  'protected_contact_methods_ciphertext = p_protected_contact_methods_ciphertext',
  'contact_methods_crypto_version = p_contact_methods_crypto_version',
], 'P1D update direct storage')

// No inherited P1 migration declares an application decrypt/unwrap/reveal RPC.
const inheritedP1 = [p1a, p1b, p1c, p1d, p1e].join('\n')
const inheritedP1Functions = [...inheritedP1.matchAll(/create(?: or replace)? function public\.([a-z0-9_]+)\(/gi)].map((match) => match[1])
assert(!inheritedP1Functions.some((name) => /(decrypt|unwrap|unseal|reveal|plaintext)/i.test(name)), 'Inherited P1 decrypt/reveal RPC must not exist')

// P1E's physical projections structurally omit protected fields.
for (const functionName of ['f23_3e_p1e_list_crm_contacts_masked', 'f23_3e_p1e_list_consultation_cases_masked']) {
  const block = functionBlock(p1e, functionName)
  includesAll(block, ["'MASKED_PROTECTED'::text", "'NO_STORE'::text"], `${functionName} masking`)
  for (const protectedName of ['protected_contact_methods_ciphertext', 'contact_methods_crypto_version', 'normalized_lookup_digests']) {
    assert(!block.includes(protectedName), `${functionName} leaks ${protectedName}`)
  }
}

// Physical P3B provenance: authority issuance accepts an opaque caller value,
// validates only its 32-byte shape, uses it as issuance-idempotency scope, and
// persists that same value on the authority.
const issueAuthority = functionBlock(p3bSql, 'f23_3e_p3b_issue_conversion_authority')
includesAll(issueAuthority, [
  'p_environment_fingerprint bytea',
  'p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32',
  "'environment_fingerprint', pg_catalog.encode(p_environment_fingerprint, 'hex')",
  'where i.environment_fingerprint = p_environment_fingerprint',
  'insert into public.crm_idempotency_registry (',
  'p_environment_fingerprint, v_center_id, \'conversion_request\', p_conversion_request_id',
  'insert into public.crm_conversion_authority (',
  'conversion_authority_id, environment_fingerprint, center_id, actor_user_id',
  'v_authority_id, p_environment_fingerprint, v_center_id, p_actor_user_id',
], 'Physical P3B authority environment provenance')
assert(!/vault\._crypto|extensions\.hmac/i.test(issueAuthority), 'P3B issue RPC must not be reinterpreted as deriving a crypto/identity environment')

// Physical P2B provenance: identity-policy environment is an independent
// protected HMAC domain selected by the identity digest-key epoch.
const p2bEnvironment = functionBlock(p2b, 'f23_3e_p2b_internal_environment_fingerprint')
includesAll(p2bEnvironment, [
  'p_digest_key_epoch integer',
  'extensions.hmac(',
  "pg_catalog.convert_to('f23.3e.p2b/environment-fingerprint/v1', 'UTF8')",
  'public.f23_3e_p2b_internal_digest_key(p_digest_key_epoch)',
  "'sha256'",
], 'Physical P2B identity environment provenance')
assert(!/vault\._crypto_aead_det/i.test(p2bEnvironment), 'P2B identity environment must remain outside the P3C crypto domain')

// P3A/P3B inherited boundaries must be final-audited and retain target-context
// re-protection, exact Guardian shape, and an immutable authority environment.
includesAll(p3a, [
  'F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS',
  'guardian_profile',
  'protected_contact_methods_ciphertext bytea',
  'contact_methods_crypto_version integer',
  'created_from_contact_id uuid',
  'created_from_case_id uuid',
  'created_from_request_id uuid',
  'created_from_action_id uuid',
  'P3C re-protects source evidence for the target\'s table/AAD/crypto version',
  '`f23_3e_p3c_internal_protect_target_evidence`',
  'unwraps/re-protects through approved local key contract',
], 'P3A Guardian contract')
includesAll(p3b, [
  'F23_3E_P3B_FINAL_TECHNICAL_AUDIT: PASS',
  '`environment_fingerprint`',
  'P3B_TARGET_PROFILE_RUNTIME: NOT IMPLEMENTED',
  'P3B_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED',
], 'P3B inherited boundary')

// Required state markers and the non-conflation of primitive availability with
// legacy envelope provenance.
includesAll(report, [
  'F23_3E_P3C0_STATUS: DESIGN COMPLETE IN REPO',
  'F23_3E_P3C0_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P3C0_MIGRATION_CREATED: NO',
  'F23_3E_P3C0_RUNTIME_CHANGE: NO',
  'P3C0_CURRENT_CONTACT_CRYPTO_CONTRACT:\nOPAQUE_CALLER_SUPPLIED_PROTECTED_BYTES',
  'P3C0_LEGACY_SOURCE_CIPHERTEXT:\nOPAQUE_FAIL_CLOSED',
  'P3C0_CANONICAL_SOURCE_ENVELOPE:\nFROZEN',
  'P3C0_GUARDIAN_TARGET_REPROTECTION:\nFROZEN',
  'P3C_GUARDIAN_SOURCE_CIPHERTEXT_DIRECT_COPY_ALLOWED: NO',
  'P3C_GUARDIAN_TARGET_REPROTECTION_REQUIRED: YES',
  'P3C0_P3C_BACKEND_LOCAL_IMPLEMENTATION:\nSAFE_TO_RESUME',
  'P3C_BACKEND_LOCAL_IMPLEMENTATION: SAFE',
  'P3_PRODUCT_INGESTION_INTEGRATION: DEFERRED',
  'P3C0_REMOTE_APPLY: NOT RUN',
  'P3C0_REAL_SECRET_PROVISIONING: NOT RUN',
  'P3C0_REAL_DATA_REENCRYPTION: NOT IMPLEMENTED',
  'P3C0_CRYPTO_PRIMITIVE_AVAILABLE_EQUALS_LEGACY_CONTRACT_KNOWN: NO',
  'P3C0_P3B_AUTHORITY_ENVIRONMENT_PROVENANCE:\nCALLER_SUPPLIED_OPAQUE_32_BYTE_BINDING',
  'P3C0_P2B_IDENTITY_ENVIRONMENT_PROVENANCE:\nSERVER_DERIVED_IDENTITY_DIGEST_KEY_HMAC',
  'P3C0_CRYPTO_ENVIRONMENT_FINGERPRINT:\nSERVER_ROOT_DERIVED',
  'P3C0_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT: 3',
  'P3C_CRYPTO_ENVIRONMENT_EQUALS_P3B_AUTHORITY_ENVIRONMENT: NO',
  'P3C_CRYPTO_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT',
  'P3B_AUTHORITY_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT',
  'P3D_COMPARE_P3C_CRYPTO_ENVIRONMENT_TO_P3B_AUTHORITY_ENVIRONMENT: NO',
  'P3D_AUTHORITY_ENVIRONMENT_RECHECK: INDEPENDENT',
  'P3D_CRYPTO_ENVIRONMENT_RECHECK: INDEPENDENT',
  'P3C0_CRYPTO_ENVIRONMENT_REQUIRES_AUTHORITY_COLUMN: NO',
], 'P3C0 status')

includesAll(report, [
  '`authority_environment_fingerprint`',
  'Historical P1/P3B caller-supplied opaque 32-byte binding.',
  '`identity_environment_fingerprint`',
  'P2B protected HMAC-SHA-256 using the identity digest key',
  '`crypto_environment_fingerprint`',
  'P3C protected deterministic Vault-root derivation',
  'There is no cross-domain equality requirement.',
  'Coincidentally equal bytes do\nnot merge provenance or semantics',
  'P3D never compares these fingerprints to each other.',
  'No new authority column is\nneeded',
], 'Three independent environment domains')

includesAll(report, [
  'P3C_SUPPORTED_CONTACT_SOURCE_CRYPTO_VERSIONS: 2',
  'P3C_CANONICAL_CONTACT_SOURCE_CRYPTO_VERSION: 2',
  'P3C_LEGACY_CONTACT_CRYPTO_VERSION_REINTERPRETED: NO',
  'P3C_GUARDIAN_TARGET_CRYPTO_VERSION: 1',
  'P3C0_ENVELOPE_FORMAT_VERSION: 1',
  'P3C0_PAYLOAD_SCHEMA_VERSION: 1',
  'LEGACY_OPAQUE',
  'NOT_DECRYPTABLE_BY_CONTRACT',
  'NOT_GUARDIAN_REPROTECTABLE',
  'NOT_AUTOMATICALLY_UPGRADED',
  'LEGACY_CONTACT_CRYPTO_REMEDIATION:\nEXPLICIT_REINGEST_OR_REENCRYPT_REVIEW_REQUIRED',
  'Version 2 is allocated prospectively by this freeze.',
  'a historical/local row carrying 2 but lacking\nthe exact authenticated envelope remains `LEGACY_OPAQUE`',
  'read-only local\ncheckpoint inventory found zero `crm_contact` rows',
  'Those rollout facts reduce no compatibility rule',
  '`SUPPORTED_WRITE` and `SUPPORTED_READ_ONLY`',
  '`RETIRED_FAIL_CLOSED`',
], 'Finite source classes and versions')

// Exact installed primitive, its cryptographic dimensions, and protected use.
includesAll(report, [
  'pgcrypto 1.3',
  'supabase_vault 0.3.1',
  'vault._crypto_aead_det_encrypt(',
  'vault._crypto_aead_det_decrypt(',
  'vault._crypto_aead_det_noncegen() RETURNS bytea',
  'P3C0_ALGORITHM:\nSUPABASE_VAULT_0_3_1_CRYPTO_AEAD_DET_XCHACHA20',
  'P3C0_AEAD_DERIVED_KEY_BYTES: 32',
  'P3C0_AEAD_NONCE_BYTES: 16',
  'P3C0_AEAD_AUTHENTICATOR_BYTES: 32',
  '`ciphertext || 32-byte synthetic authenticator`',
  'not\nXChaCha20-Poly1305',
  '`additional` is authenticated AAD',
  'github.com/supabase/vault/blob/v0.3.1/src/crypto_aead_det_xchacha20.h',
  'github.com/supabase/vault/blob/v0.3.1/src/crypto_aead_det_xchacha20.c',
  'github.com/supabase/vault/blob/v0.3.1/src/pgsodium.c',
  'github.com/supabase/vault/blob/v0.3.1/src/pgsodium.h',
], 'Exact Vault primitive')

// Byte-level envelope V1 must be complete and unambiguously parseable.
ordered(report, [
  '| `0..7` | 8 | magic | Source ASCII `IC3CSE01`; Guardian target ASCII `IC3GTE01`.',
  '| `8` | 1 | envelope format version | Unsigned value 1.',
  '| `9` | 1 | payload schema version | Unsigned value 1.',
  '| `10..13` | 4 | key epoch |',
  '| `14..15` | 2 | nonce length | Unsigned big-endian value 16.',
  '| `16..31` | 16 | nonce |',
  '| `32..35` | 4 | sealed length |',
  '| `36..(35+N)` | `N` | sealed payload |',
], 'Envelope byte ordering')
includesAll(report, [
  '`octet_length(envelope) = 36 + N`',
  'reject trailing bytes',
  'requires no persisted\nsource metadata column',
  'P3C0_EXISTING_BYTEA_VERSION_SHAPE_SUFFICIENT: YES',
  'P3C0_SOURCE_ENVELOPE_SELF_CONTAINED: YES',
  'P3C0_SCHEMA_EXPANSION_REQUIRED: NO',
], 'Self-contained envelope')

// Logical slots are distinct, finite, root-derived, and caller-independent.
includesAll(report, [
  '`F23_3E_P3C_CONTACT_SOURCE_PROTECTION` | 1 | 1 | ASCII `iC3Src01`',
  '`F23_3E_P3C_GUARDIAN_TARGET_PROTECTION` | 1 | 1 | ASCII `iC3Gdn01`',
  '`F23_3E_P3C_ENVIRONMENT_FINGERPRINT` | 1 | 1 | ASCII `iC3Env01`',
  '`CRYPTO_KEY_UNAVAILABLE`',
  '`CRYPTO_KEY_CONFIGURATION_INVALID`',
  'A caller\ncannot add or select a mapping.',
  'The caller cannot supply or read a data key',
  'It takes no caller environment argument.',
  'nonce = 16 zero bytes',
  'a different crypto fingerprint, a different derived key,\na different AAD, and an authentication failure',
  'This property does not depend\non P3B caller-supplied environment bytes.',
], 'Key and environment contract')

// Exact deterministic LP32 AAD serialization and independent domains.
includesAll(report, [
  'LP32(UTF8("ichess.crm.contact.source-evidence.aead.v1"))',
  '|| U32(2)                                     -- source crypto version',
  '|| LP32(crypto_environment_fingerprint)       -- exactly 32 bytes',
  '|| LP32(UTF8(center_id))',
  '|| LP32(uuid_send(crm_contact_id))            -- exactly 16 bytes',
  'LP32(UTF8("ichess.guardian.target.contact-evidence.aead.v1"))',
  '|| U32(1)                                     -- Guardian target crypto version',
  '|| LP32(uuid_send(guardian_id))                -- exactly 16 bytes',
  'Both AAD serializations bind only the P3C',
  '`crypto_environment_fingerprint`; neither imports the P3B',
  '`authority_environment_fingerprint` nor the P2B',
  '`identity_environment_fingerprint`.',
  'The different domain identifiers, magic',
], 'Exact source/target AAD')
assert(!report.includes('LP32(environment_fingerprint)'), 'Generic environment fingerprint must not remain in P3C AAD')
assert(!report.includes('LP32(authority_environment_fingerprint)'), 'P3B authority binding must not enter P3C AAD')
assert(!report.includes('LP32(identity_environment_fingerprint)'), 'P2B identity binding must not enter P3C AAD')

// Ingestion remains protected and does not reinterpret P1D.
includesAll(report, [
  'P3C uses an explicit combination of choices B and C:',
  '`f23_3e_p3c_internal_protect_contact_source_evidence`',
  'retain P1D Contact create/update external signatures and their legacy\n  opaque semantics',
  'does not forward-replace P1D merely to label arbitrary\n  caller bytes canonical',
  'The P3C helper has no `service_role` grant',
  'Browser-supplied\nciphertext, crypto version, environment, epoch, nonce, or secret never becomes\nauthoritative.',
  'Product ingestion integration is deferred',
], 'Protected source ingestion')

// Exact re-protection ordering and P3A helper are mandatory.
ordered(report, [
  '1. Load and lock the exact current Contact',
  '2. Require source crypto version 2.',
  '3. Call the protected Vault decrypt primitive.',
  '4. Keep the opaque canonical payload only in a local protected function',
  '5. Resolve the current Guardian target epoch',
  '6. Persist only the Guardian envelope and Guardian target crypto version 1',
], 'Guardian re-protection sequence')
includesAll(report, [
  '`f23_3e_p3c_internal_protect_target_evidence`',
  'unwrap-then-re-protect',
  'Source and target byte strings must differ.',
  'Do not put it in a table, temporary table',
  'acquire no earlier-tier business lock',
  'perform no network or human\nwait while locks are held',
], 'No-copy transaction contract')
assert(!/guardian_profile\.protected_contact_methods_ciphertext\s*=\s*(?:crm_contact\.)?protected_contact_methods_ciphertext/i.test(report), 'Report recommends direct source-to-Guardian ciphertext assignment')
assert(!/target ciphertext\s*=\s*(?:contact|source) ciphertext/i.test(report), 'Report contains direct-copy equivalence')

// Finite failures, non-disclosing application collapse, and fail-closed search.
includesAll(report, [
  'CONTACT_SOURCE_CRYPTO_VERSION_UNSUPPORTED',
  'CONTACT_SOURCE_ENVELOPE_MALFORMED',
  'CONTACT_SOURCE_CRYPTO_KEY_UNAVAILABLE',
  'CONTACT_SOURCE_AUTHENTICATION_FAILED',
  'CRYPTO_KEY_CONFIGURATION_INVALID',
  'GUARDIAN_TARGET_CRYPTO_KEY_UNAVAILABLE',
  'GUARDIAN_TARGET_PROTECTION_FAILED',
  'GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE',
  'GUARDIAN_TARGET_CRYPTO_UNAVAILABLE',
  '`MATCH_SEARCH_UNAVAILABLE`',
  'it never converts\nthat condition to `NO_MATCH`, `CREATE_NEW_REVIEWED`',
  'writes nothing',
  'Raw database/Vault exceptions',
], 'Finite crypto failure contract')

// The addendum must be executable P3C guidance, not a marker-only assertion.
const addendumStart = report.indexOf('## P3C implementation addendum')
const closureStart = report.indexOf('## Closure', addendumStart)
assert(addendumStart >= 0 && closureStart > addendumStart, 'P3C implementation addendum missing')
const addendum = report.slice(addendumStart, closureStart)
includesAll(addendum, [
  '`f23_3e_p3c_internal_crypto_environment_fingerprint`',
  'internal helpers for strict source/target envelope V1 parsing/encoding',
  'source version set `{2}`',
  'source magic `IC3CSE01`',
  'epoch 1 / `key_id=1` /\n   `iC3Src01`',
  'Guardian target version set `{1}`',
  'target magic `IC3GTE01`',
  '`iC3Gdn01`',
  '`f23_3e_p3c_internal_protect_target_evidence`',
  '`MATCH_SEARCH_UNAVAILABLE`',
  '`GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE`',
  'server-derived P3C crypto environment',
  'must not compare that value with the P3B authority or P2B identity\n   fingerprint',
  'two plan materialize/finalize RPCs',
  '`vault.secrets` returns to its exact baseline of zero rows',
], 'Concrete P3C implementation addendum')

includesAll(report, [
  'wrong crypto environment, center, Contact UUID, epoch, domain, nonce, sealed length,',
  'version 1, version 999, malformed version 2, missing epoch, and ambiguous',
  'source context cannot open target bytes and target context cannot\n  open source bytes',
  'all P3C business\n  tables return to zero fixture rows',
], 'Future P3C QA matrix')

// Reject every audited cross-domain conflation, including the exact pre-patch
// equality rule. Required negative markers above remain allowed because they
// state NO/NO_REQUIREMENT explicitly.
for (const conflation of [
  /current server-derived[\s\S]{0,100}fingerprint to equal its immutable P3B authority fingerprint/i,
  /P3C crypto fingerprint must equal P3B authority fingerprint/i,
  /P2B identity fingerprint is the P3C crypto fingerprint/i,
  /P3B authority environment proves the Vault server root/i,
  /compare (?:the )?P3C crypto fingerprint (?:with|to) (?:the )?P3B authority fingerprint/i,
]) {
  assert(!conflation.test(report), `Environment provenance conflation found: ${conflation}`)
}

// Reject vague cryptography placeholders and accidental sensitive fixtures.
for (const placeholder of [/\bTBD\b/i, /some encryption/i, /appropriate AEAD/i, /secure key/i, /\betc\.?(?:\s|$)/i]) {
  assert(!placeholder.test(report), `Ambiguous crypto placeholder found: ${placeholder}`)
}
for (const artifact of [report, smoke]) {
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(artifact), 'Private key material forbidden')
  assert(!/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(artifact), 'JWT-like value forbidden')
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(artifact), 'Email fixture forbidden')
  assert(!/(postgres(?:ql)?:\/\/|supabase\.co\/rest\/v1)/i.test(artifact), 'Remote database/project locator forbidden')
}

includesAll(report, [
  'P3C0_P3C_IMPLEMENTATION_APPROVAL: SAFE_TO_RESUME',
  'P3C0_P3C0_MIGRATION_COUNT: 0',
  'P3C0_ARTIFACT_COUNT: 2',
  'P3C0_CHECKPOINT_MIGRATION_HASH_COUNT: 15',
  'P3C remains TODO',
], 'P3C0 closure')

console.log('F23.3E-P3C0 guardian source-evidence crypto contract design-freeze semantic smoke: PASS')
