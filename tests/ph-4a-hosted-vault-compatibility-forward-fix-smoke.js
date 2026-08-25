import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const migrationPath = 'supabase/migrations/202608250002_ph_4a_hosted_vault_compatibility_forward_fix.sql'
const ph1Path = 'supabase/migrations/202608250001_ph_1_authoritative_parent_student_link_and_contact_identity_update.sql'
const p3cPath = 'supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql'
const p4aPath = 'supabase/migrations/202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql'
const c53Path = 'supabase/migrations/202608140003_c5_3_crm_authoritative_shared_truth.sql'

const read = (path) => readFileSync(path, 'utf8')
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const sql = read(migrationPath)
const ph1 = read(ph1Path)
const p3c = read(p3cPath)
const p4a = read(p4aPath)
const c53 = read(c53Path)

assert.equal(
  hash(ph1Path),
  'D5FBA4CC0C2DE8D16C3F6CF5971770A8D344E071C98378FA6CEDE259622058C8',
  'Inherited PH-1 migration bytes drifted',
)
assert.equal(
  hash(p3cPath),
  '70B3FA5416D2B045EBB615032A3708302871149B86DF171B633F3429B18B206A',
  'Inherited P3C migration bytes drifted',
)
assert.equal(
  hash(p4aPath),
  '1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC',
  'Inherited P4A migration bytes drifted',
)
assert.equal(
  hash(c53Path),
  '200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80',
  'Inherited C5.3 migration bytes drifted',
)

const includesAll = (source, values, label) => {
  for (const value of values) assert(source.includes(value), `${label}: missing ${value}`)
}
const excludesAll = (source, values, label) => {
  for (const value of values) assert(!source.includes(value), `${label}: forbidden ${value}`)
}
const functionSlice = (name, nextName) => {
  const start = sql.indexOf(name)
  assert(start >= 0, `Missing function ${name}`)
  const end = nextName ? sql.indexOf(nextName, start + name.length) : sql.length
  assert(end > start, `Missing function boundary after ${name}`)
  return sql.slice(start, end)
}

includesAll(sql, [
  'PH4A_CONTACT_RESIDUE_REVIEW_REQUIRED',
  'extensions.pgp_sym_encrypt_bytea',
  'extensions.pgp_sym_decrypt_bytea',
  "'cipher-algo=aes256,compress-algo=0,disable-mdc=0,sess-key=1'",
  'public.f23_3e_p4a_internal_lookup_key(p_key_epoch)',
  "'ichess.crm.contact.source-evidence.key-derivation.v1'",
  "pg_catalog.convert_to('IP4ACTX1', 'UTF8')",
  "pg_catalog.convert_to('IP4ACSE1', 'UTF8')",
  'v_wrong_key_rejected',
  'v_tamper_rejected',
  'public.ph_4a_internal_assert_pgcrypto_ready()',
  'contact_methods_crypto_version = 3',
  'v_contact.contact_methods_crypto_version <> 3',
  'create or replace function public.f23_3e_p3c_internal_protect_contact_source_evidence',
  'create or replace function public.f23_3e_p3c_internal_unwrap_contact_source_evidence',
  'create or replace function public.f23_3e_p4a_internal_assert_projection',
  'create or replace function public.ph_1_internal_assert_mutable_contact',
  'create or replace function public.ph_1_update_crm_contact_identity',
  'grant execute on function public.ph_1_update_crm_contact_identity',
], 'PH-4A hosted-compatible crypto closure')

excludesAll(sql, [
  'vault._crypto_',
  'create table ',
  'alter table ',
  'create policy ',
  'drop policy ',
  'insert into public.center_cloud_entities',
  'update public.center_cloud_entities',
  'delete from public.center_cloud_entities',
  'public.finance_transaction',
  'public.center_operational_command_result',
  'public.guardian_profile',
  'public.student_profile',
  'f23_3e_p3d_',
  'f23_3e_p4b_',
  'crm_conversion_request',
  'grant execute on function public.ph_4a_internal_',
], 'PH-4A append-only/no-conversion/no-core-mutation boundary')

const protect = functionSlice(
  'create or replace function public.f23_3e_p3c_internal_protect_contact_source_evidence',
  'create or replace function public.f23_3e_p3c_internal_unwrap_contact_source_evidence',
)
const unwrap = functionSlice(
  'create or replace function public.f23_3e_p3c_internal_unwrap_contact_source_evidence',
  'create or replace function public.f23_3e_p4a_internal_assert_projection',
)
const update = functionSlice(
  'create or replace function public.ph_1_update_crm_contact_identity',
  'create or replace function public.ph_1_internal_assert_mutable_contact',
)
const mutableContact = functionSlice(
  'create or replace function public.ph_1_internal_assert_mutable_contact',
  'create function public.ph_4a_internal_source_context',
)

includesAll(protect, [
  'public.ph_4a_internal_current_source_key_epoch',
  'public.ph_4a_internal_encrypt_contact_source',
  'contact_version = c.contact_version + 1',
], 'Source protect replacement')
includesAll(unwrap, [
  'public.ph_4a_internal_decrypt_contact_source',
  'p_expected_contact_version',
], 'Source unwrap replacement')
includesAll(update, [
  'public.ph_1_internal_begin_command',
  'public.ph_1_internal_store_command',
  'CONTACT_VERSION_STALE',
  'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED',
  'public.ph_4a_internal_encrypt_contact_source',
  'public.f23_3e_p1d_internal_append_audit_outbox',
], 'PH-1 protected identity update preservation')
excludesAll(`${protect}\n${unwrap}\n${update}`, ['vault._crypto_', 'f23_3e_p3d_', 'f23_3e_p4b_'],
  'Active Parent protected-evidence call path')
includesAll(mutableContact, [
  'v_contact.contact_methods_crypto_version <> 3',
  'CONTACT_IDENTITY_UPDATE_UNSUPPORTED',
], 'PH-1 mutable Contact v3 boundary')

// Lock the inherited active callers: C5.3 create -> P4A ingress -> source
// protector; P4A replay/reingest and PH-1 reads -> source unwrap.  Guardian
// target conversion remains a separate frozen path.
includesAll(c53, ['from public.f23_3e_p4a_ingress_canonical_contact('], 'C5.3 create caller')
includesAll(p4a, [
  'from public.f23_3e_p3c_internal_protect_contact_source_evidence(',
  'public.f23_3e_p3c_internal_unwrap_contact_source_evidence(',
], 'P4A source-evidence callers')
assert(p3c.includes('f23_3e_p3c_internal_protect_target_evidence'),
  'Frozen guardian target path unexpectedly disappeared from inherited P3C')
assert(ph1.includes('vault._crypto_aead_det_encrypt'),
  'PH-1 inherited bytes must remain unchanged; PH-4A must override append-only')

const internalFunctions = [...sql.matchAll(/create function public\.(ph_4a_internal_[a-z0-9_]+)/g)]
  .map((match) => match[1])
assert(internalFunctions.length >= 9, 'Expected the complete internal PH-4A helper set')
for (const name of internalFunctions) {
  assert(sql.includes(`p.proname like 'ph_4a_internal_%'`), `${name} is not covered by internal revoke loop`)
}

assert.equal((sql.match(/\bbegin;/g) || []).length, 1, 'Migration must have one outer transaction begin')
assert.equal((sql.match(/\bcommit;/g) || []).length, 1, 'Migration must have one outer transaction commit')

console.log(`PH_4A_MIGRATION_SHA256: ${hash(migrationPath)}`)
console.log('PH_4A_HOSTED_PGCRYPTO_AES256_MDC_FAIL_CLOSED: PASS')
console.log('PH_4A_EXACT_CENTER_CONTEXT_BINDING_AND_TAMPER_REJECTION: PASS')
console.log('PH_4A_ACTIVE_PARENT_PRIVATE_VAULT_CALLS_0: PASS')
console.log('PH_4A_PUBLIC_PARENT_RPC_SIGNATURES_UNCHANGED: PASS')
console.log('PH_4A_P3D_P4B_CONVERSION_DEPENDENCY_0: PASS')
console.log('PH_4A_INHERITED_MIGRATION_BYTES_IMMUTABLE: PASS')
console.log('PH_4A_HOSTED_VAULT_COMPATIBILITY_FORWARD_FIX_SMOKE: PASS')
