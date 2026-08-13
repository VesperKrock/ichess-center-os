import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(repoRoot, path), 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase()

function listFiles(root, predicate) {
  const absoluteRoot = join(repoRoot, root)
  const output = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (predicate(absolute)) output.push(relative(repoRoot, absolute).replaceAll('\\', '/'))
    }
  }
  visit(absoluteRoot)
  return output.sort()
}

const report = read('docs/f23-3e-p4-conversion-ui-legacy-projection-readiness.md')
const roadmap = read('RoadmapRealTime.txt')
const main = read('src/main.js')
const parentModule = read('src/parent-consultation-module.js')
const supabaseClient = read('src/supabase-client.js')
const cloudSync = read('src/cloud-db-sync.js')
const config = read('supabase/config.toml')
const authDesign = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const p1a = read('supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql')
const p1d = read('supabase/migrations/202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql')
const p3b = read('supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql')
const p3c = read('supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql')
const p3c0 = read('docs/f23-3e-p3c0-guardian-source-evidence-crypto-contract-design-freeze.md')
const p3d = read('supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql')
const p4a = read('supabase/migrations/202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql')
const migrations = listFiles('supabase/migrations', (path) => path.endsWith('.sql')).map(read).join('\n')

for (const marker of [
  'F23_3E_P4_STATUS: IN PROGRESS — P4A BACKEND/LOCAL VERIFIED',
  'F23_3E_P4A_LOOKUP_NORMALIZATION_BLOCKER: CLOSED',
  'F23_3E_P4_BRIDGE_BOUNDARY_AUDIT: PASS',
  'F23_3E_P4_BRIDGE_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P4_UI_REAL_CONVERSION: NOT IMPLEMENTED',
  'F23_3E_P4_LEGACY_PROJECTION: NOT IMPLEMENTED',
  'F23_3E_P4A_LOCAL_INTEGRATION_QA: PASS',
  'F23_3E_P4B_SAFE_SERVER_BRIDGE: NOT STARTED',
  'F23_3E_P4_MANUAL_E2E: PENDING',
  'F23_3E_P4_REMOTE_APPLY: NOT RUN',
  'F23_3E_P4_DEPLOY: NOT RUN',
  'F23_3E_P4_P3D_MIGRATION_CHANGED: NO',
  'F23_3E_P4_SERVICE_ROLE_IN_BROWSER: NO',
]) assert(report.includes(marker), `Missing P4 report marker: ${marker}`)

for (const contractToken of [
  '`prepare`', '`review`', '`approve_execute`', '`status`',
  'f23_3e_p3b_record_verified_conversion_step_up',
  'F23.3E-P4A DONE backend/local verified — READY FOR F23.3E-P4B',
  'Legacy UI adapter chỉ là refreshable projection cache',
]) assert(report.includes(contractToken), `P4 bridge contract drifted: ${contractToken}`)

assert(roadmap.includes('F23.3 PARTIAL public/backend'), 'F23.3 parent must remain PARTIAL')
assert(roadmap.includes('F23.3E PARTIAL public/backend/QA'), 'F23.3E parent must remain PARTIAL')
assert(roadmap.includes('F23.3E-P3D DONE backend/local verified'), 'P3D accepted backend must remain DONE')
assert(
  roadmap.includes('F23.3E-P4A DONE backend/local verified'),
  'Roadmap must expose the current P4A checkpoint',
)
assert(roadmap.includes('remote apply/deploy chưa chạy'), 'Roadmap must retain remote/deploy NOT RUN truth')
assert(!roadmap.includes('CURRENT CHECKPOINT —'), 'Completed milestones must not regain checkpoint prefixes')
assert(!roadmap.includes('Historical checkpoint compatibility note'), 'Historical compatibility museum must stay removed')

assert(main.includes('let parentConsultations = getStoredParentConsultations'), 'CRM shell must still use local source data')
assert(main.includes('let students = getStoredStudents'), 'Legacy Student UI source evidence missing')
assert(parentModule.includes('buildParentConvertPreview'), 'F23.3D preview builder missing')
assert(parentModule.includes('<button type="button" disabled>Xác nhận chuyển đổi - chưa mở</button>'), 'Real conversion CTA must remain fail closed')
assert(parentModule.includes('Không auto merge theo số điện thoại hoặc tên.'), 'Duplicate-review warning drifted')

assert(supabaseClient.includes('VITE_SUPABASE_PUBLISHABLE_KEY'), 'Browser publishable-key boundary missing')
assert(supabaseClient.includes('VITE_SUPABASE_ANON_KEY'), 'Browser anon-key fallback boundary missing')
assert(!supabaseClient.includes('SERVICE_ROLE'), 'Browser client must never load service-role configuration')
for (const token of [
  "'crm_contact'", "'consultation_case'", "'consultation_case_candidate_student'",
  "'crm_conversion_request'", 'GENERIC_CLOUD_CANONICAL_CRM_ENTITY_DENIED',
]) assert(cloudSync.includes(token), `Generic cloud canonical denial drifted: ${token}`)

const browserSource = listFiles('src', (path) => path.endsWith('.js')).map(read).join('\n')
assert(!browserSource.includes('f23_3e_p3d_execute_conversion'), 'Browser must not call P3D directly')
assert(!browserSource.includes('f23_3e_p3d_read_conversion_result_status'), 'Browser must not call P3D status directly')
assert(!/SUPABASE_SERVICE_ROLE_KEY|VITE_[A-Z0-9_]*SERVICE_ROLE/.test(browserSource), 'Service role must not enter browser source')

assert(config.includes('[auth.mfa.totp]'), 'Local Auth TOTP section missing')
assert(/\[auth\.mfa\.totp\][\s\S]*?enroll_enabled\s*=\s*false[\s\S]*?verify_enabled\s*=\s*false/.test(config), 'P4 must not claim local MFA implementation before it exists')
assert(authDesign.includes('MFA_RUNTIME_IMPLEMENTED: NO'), 'Inherited Auth runtime truth drifted')
assert(authDesign.includes('SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO'), 'Inherited step-up runtime truth drifted')
assert(p3b.includes('p_server_verified_at < v_now - interval \'2 minutes\''), 'P3B fresh-step-up window drifted')
assert(p3b.includes("p_assurance_level not in ('AAL2_TOTP', 'AAL2_PHISHING_RESISTANT', 'AAL3_HARDWARE_BACKED')"), 'P3B assurance allowlist drifted')

for (const token of [
  'protected_contact_methods_ciphertext bytea not null',
  'normalized_lookup_digests bytea[] not null',
  'normalization_version integer not null',
  'crm_contact_legacy_source_unique_idx',
  'birth_evidence_protected bytea',
]) assert(p1a.includes(token), `Canonical ingress schema drifted: ${token}`)

for (const token of [
  'p_protected_contact_methods_ciphertext bytea',
  'p_normalized_lookup_digests bytea[]',
  'p_normalization_version integer',
  'p_normalized_lookup_digests, p_normalization_version, p_actor_user_id',
]) assert(p1d.includes(token), `P1D opaque Contact transport drifted: ${token}`)
assert(p4a.includes('f23_3e_p4a_internal_normalize_phone_v1'), 'P4A phone normalizer missing')
assert(p4a.includes('f23_3e_p4a_internal_normalize_email_v1'), 'P4A email normalizer missing')
assert(p4a.includes('ichess.crm.contact.phone.lookup.v1'), 'P4A phone digest domain missing')
assert(p4a.includes('ichess.crm.contact.email.lookup.v1'), 'P4A email digest domain missing')
assert(p3c0.includes('canonical plaintext is a non-empty opaque contact-method payload'), 'P3C0 opaque payload truth drifted')
assert(/Future\s+product ingestion requires a separately audited trusted server composer/.test(p3c0), 'P3C0 product composer gate drifted')
assert(p3c.includes('v_row.normalized_lookup_digests && v_contact.normalized_lookup_digests'), 'Guardian matching no longer depends on Contact lookup digests')
assert(p3c.includes('f23_3e_p3c_internal_protect_contact_source_evidence'), 'P3C0 Contact source protector missing')
assert(p3d.includes('f23_3e_p3d_internal_protect_candidate_birth_evidence'), 'P3D0 Candidate birth protector missing')

const p4Migrations = listFiles('supabase/migrations', (path) => /f23_3e_p4/i.test(path))
assert.deepEqual(p4Migrations, ['supabase/migrations/202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql'], 'P4A must own exactly one forward migration')
const edgeFiles = listFiles('supabase/functions', (path) => path.endsWith('index.ts'))
assert(!edgeFiles.some((path) => /crm-conversion|conversion-bridge/i.test(path)), 'Blocked P4 must not create a fake conversion Edge bridge')

assert.equal(
  sha256(p3d),
  'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3',
  'Accepted P3D migration changed during P4 readiness work',
)
for (const signature of [
  'f23_3e_p3d_execute_conversion(uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz)',
  'f23_3e_p3d_read_conversion_result_status(uuid,bytea)',
]) {
  assert(p3d.includes(`revoke all on function public.${signature}`), `P3D revoke missing: ${signature}`)
  assert(p3d.includes(`grant execute on function public.${signature}`), `P3D service grant missing: ${signature}`)
}

console.log('F23.3E-P4 readiness smoke passed — P4A backend/local verified; P4B pending')
