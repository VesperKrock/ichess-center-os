import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migration = 'supabase/migrations/202608250001_ph_1_authoritative_parent_student_link_and_contact_identity_update.sql'
const c53Smoke = 'tests/c5-3-crm-authoritative-shared-truth-smoke.js'
const main = 'src/main.js'

for (const path of [migration, c53Smoke, main]) {
  assert(existsSync(join(root, path)), `Missing PH-1 artifact: ${path}`)
}

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256')
  .update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const sql = read(migration)

const prerequisites = new Map([
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
  ['202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql', '1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC'],
  ['202608140003_c5_3_crm_authoritative_shared_truth.sql', '200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80'],
  ['202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql', '8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247'],
])
assert.equal(prerequisites.size, 13)
for (const [name, expected] of prerequisites) {
  assert.equal(sha256(`supabase/migrations/${name}`), expected, `PH-1 prerequisite drift: ${name}`)
}
assert.equal(
  sha256('supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql'),
  '2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754',
  'PH-1 existing C5.1 Student authority anchor drift',
)

const includesAll = (source, tokens, label) => {
  for (const token of tokens) assert(source.includes(token), `${label}: missing ${token}`)
}
const excludesAll = (source, tokens, label) => {
  for (const token of tokens) assert(!source.includes(token), `${label}: forbidden ${token}`)
}
const functionSlice = (name, nextName) => {
  const start = sql.indexOf(`create function public.${name}`)
  assert(start >= 0, `Missing function ${name}`)
  const end = nextName ? sql.indexOf(`create function public.${nextName}`, start + 1) : sql.length
  assert(end > start, `Missing boundary after ${name}`)
  return sql.slice(start, end)
}

includesAll(sql, [
  'create table public.crm_contact_student_operational_link',
  'references public.crm_contact(center_id, crm_contact_id)',
  'references public.center_cloud_entities(center_id, entity_type, local_id)',
  "check (student_entity_type = 'student')",
  "check (link_status in ('ACTIVE', 'ENDED'))",
  'crm_contact_student_operational_link_active_equivalent_idx',
  'crm_contact_student_operational_link_active_primary_idx',
  'enable row level security',
  'force row level security',
  'PARENT_STUDENT_LINK_DIRECT_WRITE_DENIED',
  'PARENT_STUDENT_LINK_DELETE_DENIED',
  'create function public.ph_1_list_parent_student_links',
  'create function public.ph_1_create_parent_student_link',
  'create function public.ph_1_update_parent_student_link',
  'create function public.ph_1_end_parent_student_link',
  'create function public.ph_1_update_crm_contact_identity',
  'public.c5_3_internal_assert_access(p_center_id, true, true)',
  'public.c5_3_internal_assert_access(v_center_id, false, true)',
  'public.crm_shared_command_result',
  'IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT',
  'LINK_VERSION_STALE',
  'CONTACT_VERSION_STALE',
  'LINK_COLLISION_REVIEW_REQUIRED',
  'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED',
  'CONTACT_IDENTITY_REACTIVATION_REVIEW_REQUIRED',
  'public.f23_3e_p1d_internal_append_audit_outbox',
  "'crm.parent_student_link.created'",
  "'crm.parent_student_link.updated'",
  "'crm.parent_student_link.ended'",
  "'crm.contact.identity_updated'",
  "pg_catalog.set_config('ichess.p4a_lookup_write', 'on', true)",
  "pg_catalog.set_config('ichess.ph_1_link_write', 'on', true)",
  'grant execute on function public.ph_1_list_parent_student_links(text,boolean) to authenticated',
  'grant execute on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid) to authenticated',
], 'PH-1 SQL contract')

excludesAll(sql, [
  'create policy',
  'alter publication supabase_realtime',
  'to service_role;',
  'f23_3e_p3d_',
  'f23_3e_p4b_',
  'public.student_profile',
  'public.guardian_profile',
  'public.guardian_student_relationship',
  'public.crm_conversion_request',
  'public.crm_conversion_action',
  'insert into public.crm_contact(',
  'delete from public.crm_contact_student_operational_link',
  'update public.center_cloud_entities',
  'insert into public.center_cloud_entities',
], 'PH-1 no-conversion/no-direct-authority boundary')

const createLink = functionSlice('ph_1_create_parent_student_link', 'ph_1_update_parent_student_link')
const updateLink = functionSlice('ph_1_update_parent_student_link', 'ph_1_end_parent_student_link')
const endLink = functionSlice('ph_1_end_parent_student_link', 'ph_1_update_crm_contact_identity')
const updateIdentity = functionSlice('ph_1_update_crm_contact_identity', null)

for (const [label, source] of [
  ['create link', createLink],
  ['update link', updateLink],
  ['end link', endLink],
  ['update identity', updateIdentity],
]) {
  assert(source.includes('ph_1_internal_begin_command'), `${label}: missing guarded idempotency`)
  assert(source.includes('ph_1_internal_store_command'), `${label}: missing committed result registry`)
}
includesAll(createLink, [
  'ph_1_internal_assert_current_student',
  'ph_1_internal_assert_mutable_contact',
  'LINK_COLLISION_REVIEW_REQUIRED',
], 'Create-link exact-center validation')
includesAll(updateLink, [
  'p_expected_link_version',
  'LINK_VERSION_STALE',
  'ph_1_internal_assert_current_student',
], 'Update-link currentness')
includesAll(endLink, [
  "link_status = 'ENDED'",
  'ended_reason_code = v_reason',
  'link_version = l.link_version + 1',
], 'End-link non-destructive contract')
includesAll(updateIdentity, [
  'p_expected_contact_version',
  'public.f23_3e_p4a_internal_canonical_payload',
  'public.f23_3e_p3c_internal_unwrap_contact_source_evidence',
  'vault._crypto_aead_det_encrypt',
  'normalized_lookup_digests = v_digests',
  'contact_version = c.contact_version + 1',
  'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED',
], 'Protected Contact identity currentness/collision contract')

assert(updateIdentity.indexOf('from public.crm_contact_lookup_control c\n  where c.center_id = v_center_id for update')
  < updateIdentity.indexOf("'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED'"),
  'Lookup control lock must precede collision decision')
assert(updateIdentity.indexOf("'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED'")
  < updateIdentity.indexOf('if v_contact.display_name = v_display_name'),
  'Collision review must precede unchanged-identity no-op replay registration')

const mainSource = read(main)
const refreshStart = mainSource.indexOf('async function refreshC53CrmSharedTruth')
const refreshEnd = mainSource.indexOf('async function writeC53CrmCommand', refreshStart)
const refresh = mainSource.slice(refreshStart, refreshEnd)
assert(refresh.indexOf('parentConsultations = []') < refresh.indexOf('pullC53CrmSharedTruth'),
  'C5.3 refresh must clear the prior projection before every pull')

assert.equal((sql.match(/create table public\.crm_contact_student_operational_link/g) || []).length, 1)
assert.equal((sql.match(/insert into public\.crm_contact_student_operational_link/g) || []).length, 1,
  'Only explicit CREATE_LINK may insert an operational link')
assert.equal((sql.match(/update public\.crm_contact c set/g) || []).length, 1,
  'Only protected UPDATE_CONTACT_IDENTITY may update canonical Contact identity')

console.log('PH_1_PREREQUISITE_HASHES_13: PASS')
console.log('PH_1_EXISTING_C5_1_STUDENT_AUTHORITY_HASH: PASS')
console.log('PH_1_EXACT_CENTER_LINK_SCHEMA_RLS_ACL: PASS')
console.log('PH_1_TYPED_RPC_EXPECTED_VERSION_IDEMPOTENCY: PASS')
console.log('PH_1_CONTACT_IDENTITY_ENCRYPTION_COLLISION_REVIEW: PASS')
console.log('PH_1_NO_SILENT_IMPORT_STUDENT_MUTATION_P3D_P4B_DEPENDENCY: PASS')
console.log('PH_1_SEMANTIC_CONTRACT_SMOKE: PASS')
