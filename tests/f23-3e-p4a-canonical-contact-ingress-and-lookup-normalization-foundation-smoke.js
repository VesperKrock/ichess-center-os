import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationRelative = 'supabase/migrations/202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql'
const reportRelative = 'docs/f23-3e-p4a-canonical-contact-ingress-and-lookup-normalization-foundation.md'
const smokeRelative = 'tests/f23-3e-p4a-canonical-contact-ingress-and-lookup-normalization-foundation-smoke.js'
const qaRelative = 'tests/f23-3e-p4a-canonical-contact-ingress-and-lookup-normalization-foundation-local-db-qa.js'
const artifacts = [migrationRelative, reportRelative, smokeRelative, qaRelative]
const migrationsDirectory = join(root, 'supabase', 'migrations')
for (const path of artifacts) assert(existsSync(join(root, path)), `Missing P4A artifact: ${path}`)
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const sql = read(migrationRelative)
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const p3c = read('supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql')
const p3d = read('supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql')

const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const excludesAll = (content, values, label) => {
  for (const value of values) assert(!content.includes(value), `${label}: forbidden ${value}`)
}
const functionBlock = (name) => {
  const start = sql.search(new RegExp(`create\\s+function\\s+public\\.${name}\\s*\\(`, 'i'))
  assert(start >= 0, `Missing function ${name}`)
  const token = `$${name}$;`
  const end = sql.indexOf(token, start)
  assert(end >= 0, `Missing terminator for ${name}`)
  return sql.slice(start, end + token.length)
}

const basename = 'f23-3e-p4a-canonical-contact-ingress-and-lookup-normalization-foundation'
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => name.startsWith(basename)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.startsWith(basename)).map((name) => `tests/${name}`),
  ...readdirSync(migrationsDirectory).filter((name) => name.includes('_f23_3e_p4a_')).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P4A must own exact four artifacts')
assert.deepEqual(readdirSync(migrationsDirectory).filter((name) => name.includes('_f23_3e_p4a_')), [migrationRelative.split('/').at(-1)], 'P4A must own one forward migration')
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P4A must not freeze total migration inventory')

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
  ['202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql', 'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3'],
])
assert.equal(checkpointHashes.size, 17)
for (const [name, expected] of checkpointHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), expected, `Inherited migration drift: ${name}`)
}
const p4aExpectedSha256 = '1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC'
assert.equal(sha256(migrationRelative), p4aExpectedSha256, 'P4A migration SHA drift')

for (const table of ['crm_contact_lookup_control', 'crm_contact_lookup_evidence']) {
  assert.equal((sql.match(new RegExp(`create\\s+table\\s+public\\.${table}\\b`, 'gi')) || []).length, 1, `Missing ${table}`)
  includesAll(sql, [`alter table public.${table} enable row level security`, `alter table public.${table} force row level security`, `revoke all on table public.${table} from public, anon, authenticated, service_role`], `${table} privacy`)
}
for (const forbidden of ['student_profile', 'guardian_profile', 'guardian_student_relationship', 'crm_identity_target_binding']) {
  assert(!new RegExp(`create\\s+table\\s+public\\.${forbidden}\\b`, 'i').test(sql), `P4A recreated ${forbidden}`)
}

includesAll(sql, [
  'IC4CPV01', "ichess.crm.contact.phone.lookup.v1", "ichess.crm.contact.email.lookup.v1",
  "f23_3e_p4a_contact_lookup_epoch_", 'extensions.hmac(',
  'public.f23_3e_p3c_internal_lp32', 'public.f23_3e_p3c_internal_u32',
  "p_center_id,'UTF8'", "p_normalized_value,'UTF8'",
  "local.parent_consultation.v1", "PARENT_CONSULTATION",
], 'Canonical payload/digest contract')
includesAll(functionBlock('f23_3e_p4a_internal_normalize_phone_v1'), [
  "^0[35789][0-9]{8}$", "^84[35789][0-9]{8}$", "^\\+84[35789][0-9]{8}$",
  "CONTACT_PHONE_INVALID",
], 'Phone V1')
includesAll(functionBlock('f23_3e_p4a_internal_normalize_email_v1'), [
  "v_local :=", "v_domain := pg_catalog.lower", "v_local ~ '\\.\\.'",
  "CONTACT_EMAIL_INVALID",
], 'Email V1')
includesAll(functionBlock('f23_3e_p4a_internal_canonical_payload'), [
  'array_agg(x order by pg_catalog.convert_to', 'select distinct',
  'cardinality(canonical_phones) > 5', 'cardinality(canonical_emails) > 5',
  "convert_to('IC4CPV01'", 'f23_3e_p3c_internal_u16',
], 'Deterministic payload')
includesAll(functionBlock('f23_3e_p4a_internal_parse_payload_v1'), [
  "CONTACT_PAYLOAD_UNSUPPORTED", "CONTACT_PAYLOAD_NONCANONICAL",
  'f23_3e_p4a_internal_canonical_payload', 'rebuilt.payload is distinct from p_payload',
], 'Strict parser')

includesAll(sql, [
  "rotation_state = 'ACTIVE'", "rotation_state = 'PREPARING'",
  "rotation_state = 'DUAL_READ'", "rotation_state = 'RETIRING'",
  "LOOKUP_ROTATION_REINGEST_INCOMPLETE", "LOOKUP_EPOCH_DEPENDENCY_ACTIVE",
  "LOOKUP_RETIREMENT_REINGEST_INCOMPLETE", 'g.normalized_lookup_digests',
  'e.lookup_digest=any(g.normalized_lookup_digests)',
], 'Rotation/re-ingestion')
assert.equal((functionBlock('f23_3e_p4a_transition_lookup_key_epoch').match(/LOOKUP_EPOCH_DEPENDENCY_ACTIVE/g) || []).length, 2, 'Guardian dependency must be checked at begin and completion')
for (const name of ['f23_3e_p4a_ingress_canonical_contact', 'f23_3e_p4a_reingest_canonical_contact', 'f23_3e_p4a_transition_lookup_key_epoch']) {
  const block = functionBlock(name)
  assert(block.indexOf('from public.center_crm_control r') < block.indexOf('from public.crm_contact_lookup_control c'), `${name}: center root must lock before lookup control`)
  includesAll(block, ["r.crm_state='ACTIVE'", "r.feature_flag_state='ENABLED'", 'for update'], `${name} center-root lock`)
}
includesAll(functionBlock('f23_3e_p4a_reingest_canonical_contact'), [
  'f23_3e_p3c_internal_unwrap_contact_source_evidence',
  'f23_3e_p4a_internal_parse_payload_v1', "evidence_status='RETIRED'",
  'normalized_lookup_digests=v_digests', 'contact_version=c.contact_version+1',
], 'Protected re-ingestion')

const ingress = functionBlock('f23_3e_p4a_ingress_canonical_contact')
includesAll(ingress, [
  'f23_3e_p4a_internal_assert_actor', 'f23_3e_p4a_internal_canonical_payload',
  'f23_3e_p4a_internal_lookup_key', 'f23_3e_p4a_internal_lookup_digest',
  'f23_3e_p3c_internal_protect_contact_source_evidence',
  'f23_3e_p3b_internal_append_audit_outbox', "INGRESS_CONFLICT",
  "'CANONICAL_CONTACT_INGRESSED',true", "'CANONICAL_CONTACT_INGRESSED',false",
], 'Canonical ingress')
excludesAll(ingress.slice(0, ingress.indexOf('returns table')), [
  'p_lookup_digest', 'p_ciphertext', 'p_key_epoch', 'p_environment_fingerprint',
], 'Ingress caller-owned security material')

const externals = [
  'f23_3e_p4a_ingress_canonical_contact', 'f23_3e_p4a_reingest_canonical_contact',
  'f23_3e_p4a_transition_lookup_key_epoch', 'f23_3e_p4a_read_contact_ingress_status',
]
for (const name of externals) {
  const block = functionBlock(name)
  includesAll(block, ['security definer', "set search_path = ''"], `${name} security`)
}
includesAll(sql, [
  "where n.nspname='public' and p.proname like 'f23_3e_p4a_%'",
  "revoke all on function %s from public, anon, authenticated, service_role",
], 'Global helper revoke')
assert.equal((sql.match(/grant execute on function public\.f23_3e_p4a_/g) || []).length, 4, 'Exactly four P4A grants')
for (const name of externals) assert(new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*?\\) to service_role;`, 'i').test(sql), `Missing service grant ${name}`)

includesAll(p3c, [
  'v_row.normalized_lookup_digests && v_contact.normalized_lookup_digests',
  "'GUARDIAN_CONTACT_LOOKUP_DIGEST'", 'foreach v_lookup in array v_contact.normalized_lookup_digests',
], 'Guardian shared digest contract')
assert.equal(sha256('supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql'), 'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3')
assert(!sql.includes('create or replace function public.f23_3e_p3d_'), 'P4A must not alter P3D')

includesAll(report, [
  'F23_3E_P4A_IMPLEMENTATION: IMPLEMENTED', 'F23_3E_P4A_LOCAL_DOCKER_QA: PASS',
  'F23_3E_P4A_SEMANTIC_SMOKE: PASS', 'F23_3E_P4A_INHERITED_REGRESSIONS: PASS',
  `F23_3E_P4A_MIGRATION_SHA256: ${p4aExpectedSha256}`,
  'F23_3E_P4A_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_P4A_REMOTE_APPLY_DEPLOY: NOT RUN',
  'F23_3E_P4A_PRODUCT_CONTACT_INGRESS: DEFERRED TO P4B SAFE SERVER BRIDGE',
  'F23_3E_P4A_STATUS: DONE backend/local verified — READY FOR F23.3E-P4B',
], 'Report evidence')
includesAll(qa, [
  'ICHESS_P4A_LOCAL_QA_ALLOW_RESET', 'P4A_QA_LOCAL_SAFETY_GUARD: PASS',
  'P4A_QA_NORMALIZATION_PAYLOAD: PASS', 'P4A_QA_LOOKUP_DIGEST_DOMAINS: PASS',
  'P4A_QA_INGRESS_REPLAY_SECURITY: PASS', 'P4A_QA_ROTATION_GUARDIAN_COMPATIBILITY: PASS',
  'P4A_QA_FAULT_ROLLBACK: PASS', 'P4A_QA_FINAL_RESET: PASS',
  'P4A_LOCAL_DOCKER_QA: PASS',
], 'QA evidence markers')

for (const content of [sql, report, smoke, qa]) {
  assert(!content.includes('\uFFFD'), 'Replacement character detected')
  assert(!/\r(?!\n)/.test(content), 'Bare carriage return detected')
}

console.log('F23.3E-P4A semantic smoke: PASS')
console.log(`P4A migration SHA-256: ${p4aExpectedSha256}`)
console.log('17 inherited migration hashes: PASS')
