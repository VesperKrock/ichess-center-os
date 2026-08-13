import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationName = '202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql'
const migrationRelative = `supabase/migrations/${migrationName}`
const reportRelative = 'docs/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime.md'
const smokeRelative = 'tests/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime-smoke.js'
const qaRelative = 'tests/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime-local-db-qa.js'
const canonicalRoadmapRelative = 'docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md'
const localRoadmapRelative = 'RoadmapRealTime.txt'
const artifacts = [migrationRelative, reportRelative, smokeRelative, qaRelative]
const migrationDirectory = join(root, 'supabase', 'migrations')

for (const relative of artifacts) assert(existsSync(join(root, relative)), `Missing P3B artifact: ${relative}`)

const read = (relative) => readFileSync(join(root, relative), 'utf8')
const sha256 = (relative) => createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').toUpperCase()
const includesAll = (content, values, label) => {
  for (const value of values) assert(content.includes(value), `${label}: missing ${value}`)
}
const count = (content, pattern) => [...content.matchAll(pattern)].length
const ordered = (content, values, label) => {
  let cursor = 0
  for (const value of values) {
    const index = content.indexOf(value, cursor)
    assert(index >= cursor, `${label}: missing or out of order: ${value}`)
    cursor = index + value.length
  }
}
const functionBlock = (sql, name) => {
  const start = sql.indexOf(`create function public.${name}(`)
  assert(start >= 0, `Missing function ${name}`)
  const nextCreate = sql.indexOf('\ncreate function ', start + 1)
  const commit = sql.indexOf('\ncommit;', start + 1)
  const end = nextCreate >= 0 ? nextCreate : commit
  assert(end > start, `Could not delimit function ${name}`)
  return sql.slice(start, end)
}

const sql = read(migrationRelative)
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const canonicalRoadmap = read(canonicalRoadmapRelative)
const localRoadmap = read(localRoadmapRelative)
const p3aReport = read('docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md')
const p3aSmoke = read('tests/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze-smoke.js')

const p3bPhaseToken = /f23[-_]3e[-_]p3b(?![a-z0-9])/i
for (const phase of ['p3', 'p3a', 'p3ba', 'p3b2', 'p3c', 'p3d', 'p4']) {
  assert(!p3bPhaseToken.test(`f23_3e_${phase}_future`), `P3B ownership captures ${phase}`)
}
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => p3bPhaseToken.test(name)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => p3bPhaseToken.test(name)).map((name) => `tests/${name}`),
  ...readdirSync(migrationDirectory).filter((name) => p3bPhaseToken.test(name)).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3B must own exactly four artifacts')

const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()
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
])
assert.equal(checkpointHashes.size, 14)
for (const [name, expectedHash] of checkpointHashes) {
  assert(migrationFiles.includes(name), `Missing checkpoint migration ${name}`)
  assert.equal(sha256(`supabase/migrations/${name}`), expectedHash, `Checkpoint hash drift: ${name}`)
}
assert.deepEqual(migrationFiles.filter((name) => p3bPhaseToken.test(name)), [migrationName], 'P3B must own one migration')
assert.equal(sha256(migrationRelative), '8232FFD8EF0A63FB60E2A3FDE957EC542A3F196DA4272BF420FF7F3E98F099F0', 'P3B migration hash drift')
assert.equal(checkpointHashes.size + 1, 15, 'P3B checkpoint package must verify 15 exact migration hashes')
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P3B smoke must not freeze total migration inventory')

includesAll(report, [
  'F23_3E_P3B_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P3B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P3B_MIGRATION_CREATED: YES',
  'F23_3E_P3B_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P3B_LOCAL_DB_QA: PASS',
  'P3B_MEMBERSHIP_VERSION_RUNTIME: IMPLEMENTED',
  'P3B_ACCOUNT_SECURITY_RUNTIME: IMPLEMENTED',
  'P3B_TRUSTED_VERIFIER_DB_BOUNDARY: IMPLEMENTED',
  'P3B_REAL_AUTH_PROVIDER_VERIFIER_INTEGRATION: NOT IMPLEMENTED',
  'P3B_REAL_USER_STEP_UP_VERIFICATION: NOT RUN',
  'P3B_STEP_UP_ASSERTION_RUNTIME: IMPLEMENTED',
  'P3B_CONVERSION_SPECIFIC_FINAL_CAPABILITY_RESOLVER: IMPLEMENTED',
  'P3B_ACTION_CHILD_FOUNDATION: IMPLEMENTED',
  'P3B_PRODUCTION_REVIEWED_ACTION_MATERIALIZER: NOT IMPLEMENTED — P3C',
  'P3B_SINGLE_USE_CONVERSION_AUTHORITY_RUNTIME: IMPLEMENTED',
  'P3B_AUTHORITY_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D',
  'P3B_TARGET_PROFILE_RUNTIME: NOT IMPLEMENTED — P3C',
  'P3B_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED — P3D',
  'F23_13D_FULL_PRODUCT_RUNTIME_IMPLEMENTED_BY_P3B: NO',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'F23_3E_P3B_REMOTE_APPLY: NOT RUN',
  'F23_3E_P3B_AUTH_CHANGE: NO',
  'F23_3E_P3B_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P3B_DEPLOY: NOT RUN',
  'F23_3E_P3B_BROWSER_UI_WIRING: NOT STARTED',
  'P3B_LOCAL_SECURITY_AUTHORITY_FOUNDATION_READY_FOR_P3C: YES',
  'P3B_REAL_CONVERSION_EXECUTION_READY: NO',
  'P3B_TERMINAL_ENVIRONMENT_SOURCE: CRM_CONVERSION_AUTHORITY.ENVIRONMENT_FINGERPRINT',
  'P3B_TERMINAL_OPERATION_BINDING_INCLUDES_ENVIRONMENT: YES',
  'P3B_TERMINAL_IDEMPOTENCY_LOOKUP_USES_AUTHORITY_ENVIRONMENT: YES',
  'P3B_TERMINAL_IDEMPOTENCY_INSERT_USES_AUTHORITY_ENVIRONMENT: YES',
  'P3B_HARDCODED_LOCAL_TERMINAL_ENVIRONMENT: NO',
  'P3B_FORMER_AUTHORITY_ISSUER_HAS_PERPETUAL_STATUS_READ: NO',
  'P3B_AUTHORITY_STATUS_NONMEMBER_RESULT: RESOURCE_NOT_AVAILABLE',
], 'P3B report status')
assert(report.includes('External technical audit closeout on 2026-08-12: PASS'), 'P3B external-audit closeout note missing')

const currentP3b = 'F23.3E-P3B DONE backend/local verified / Step-up, capability và single-use conversion authority runtime'
includesAll(localRoadmap, [
  currentP3b,
  'F23.3E-P3 DONE backend/local verified',
  'F23.3E-P4A DONE backend/local verified',
], 'Current P3B roadmap milestone')
assert.equal(localRoadmap.split('F23.3E-P3B DONE backend/local verified').length - 1, 1, 'P3B must have exactly one current DONE status')
assert(!localRoadmap.includes('F23.3E-P3B TODO backend'), 'Stale P3B TODO marker must be removed')
assert(canonicalRoadmap.includes('F23.3E-P3B DONE backend/local verified'), 'Historical P3B checkpoint evidence drifted')

includesAll(sql, [
  'add column membership_version integer not null default 1',
  'center_members_membership_version_positive',
  'center_members_conversion_version_binding_key',
  'center_members_conversion_capability_idx',
  'f23_3e_p3b_center_members_version_guard',
  'create table public.account_security_control',
  'create table public.account_step_up_assertion',
  'create table public.crm_conversion_action',
  'create table public.crm_conversion_authority',
  'p3_operation_binding_digest bytea',
  'crm_idempotency_registry_p3_safe_snapshot_check',
  'crm_idempotency_registry_completed_result_snapshot_check',
], 'P3B physical foundation')

for (const table of ['account_security_control', 'account_step_up_assertion', 'crm_conversion_action', 'crm_conversion_authority']) {
  includesAll(sql, [
    `alter table public.${table} enable row level security`,
    `alter table public.${table} force row level security`,
    `revoke all on table public.${table} from public, anon, authenticated, service_role`,
  ], `${table} protection`)
}
assert(!/create policy[\s\S]{0,200}(account_security_control|account_step_up_assertion|crm_conversion_action|crm_conversion_authority)/i.test(sql), 'Protected P3B tables must have no RLS policy')
assert(!/alter publication/i.test(sql), 'P3B protected tables must not be added to Realtime')

const externalRpcs = [
  'f23_3e_p3b_register_or_sync_account_security_control',
  'f23_3e_p3b_record_verified_conversion_step_up',
  'f23_3e_p3b_evaluate_conversion_capability',
  'f23_3e_p3b_issue_conversion_authority',
  'f23_3e_p3b_read_conversion_authority_status',
  'f23_3e_p3b_revoke_or_expire_conversion_authority',
]
const declaredExternal = [...sql.matchAll(/create function public\.(f23_3e_p3b_(?!internal_)[a-z0-9_]+)\(/g)].map((match) => match[1])
assert.deepEqual(declaredExternal.sort(), [...externalRpcs].sort(), 'Exactly six external P3B RPCs required')
for (const rpc of externalRpcs) {
  const block = functionBlock(sql, rpc)
  includesAll(block, ['security definer', "set search_path = ''"], `${rpc} function boundary`)
  assert(sql.includes(`grant execute on function public.${rpc}(`), `${rpc}: service-role grant missing`)
  assert(sql.includes(`revoke execute on function public.${rpc}(`), `${rpc}: browser revoke missing`)
}
assert.equal(count(sql, /^grant execute on function public\.f23_3e_p3b_(?!internal_)/gm), 6, 'Exactly six P3B service-role grants required')
const internalFunctions = [...sql.matchAll(/create function public\.(f23_3e_p3b_internal_[a-z0-9_]+)\(/g)].map((match) => match[1])
assert(internalFunctions.length >= 10, 'Expected protected P3B helper inventory')
for (const helper of internalFunctions) {
  assert(sql.includes(`revoke execute on function public.${helper}(`), `Internal helper revoke missing: ${helper}`)
}

const serializer = functionBlock(sql, 'f23_3e_p3b_internal_action_set_digest')
includesAll(serializer, [
  "'encoding_version', 1", "'legacy_request_action_graph_digest'",
  "'action_version', a.action_version", "'action_kind', a.action_kind",
  "'action_intent_digest'", "'match_review_id'", "'profile_creation_reservation_id'",
  "'target_adapter_namespace'", "'guardian_action_id'", "'student_action_id'",
  "'relationship_policy_version'", 'order by a.conversion_action_id',
], 'Canonical action serializer V1')
assert(!serializer.includes('display_name'), 'Action-set serializer must contain no raw identity PII')
assert(!serializer.includes('birth'), 'Action-set serializer must contain no birth evidence')

const issue = functionBlock(sql, 'f23_3e_p3b_issue_conversion_authority')
ordered(issue, [
  '-- 0. Center root.',
  '-- 1. Every current center identity mutex',
  '-- 2-4. Account, assertion, then membership/support.',
  '-- 5. Stable Request-scoped authority mutex precedes idempotency.',
  '-- 6. Exact replay is read only after all earlier canonical locks.',
  '-- 7-15. Remaining canonical rows.',
], 'Authority lock order')
ordered(issue, [
  "status = 'CONSUMED', assertion_version = s.assertion_version + 1",
  "status = 'APPROVED', request_version = r.request_version + 1",
  "status = 'APPROVED', action_version = a.action_version + 1",
  'POST_APPROVED_DIGEST_COMPUTE_BEGIN',
  "f23_3e_p3b_internal_action_set_digest(p_conversion_request_id, 'APPROVED')",
  'insert into public.crm_conversion_authority',
], 'Post-APPROVED digest lifecycle ordering')
ordered(issue, [
  "if v_registry.status = 'COMPLETED' then",
  "(v_registry.p3_result_snapshot ->> 'resource_id')::uuid",
  '-- 7-15. Remaining canonical rows.',
  'f23_3e_p3b_evaluate_conversion_capability',
], 'Exact replay must precede live first-attempt interpretation')
includesAll(issue, [
  'p3_legacy_request_action_graph_digest', 'p3_action_set_digest',
  "p3_result_kind = 'CONVERSION_AUTHORITY'", "p3_result_outcome_code = 'CONVERSION_AUTHORITY_ISSUED'",
], 'Independent digest and immutable replay result')

const statusRead = functionBlock(sql, 'f23_3e_p3b_read_conversion_authority_status')
includesAll(statusRead, [
  'where m.center_id = v_authority.center_id and m.user_id = p_actor_user_id',
  "if not found or v_member.status <> 'active' or v_member.role not in ('owner', 'center_admin') then",
  "return query select 'RESOURCE_NOT_AVAILABLE'",
], 'Current exact-center status-read scope')
assert(!statusRead.includes('p_actor_user_id <> v_authority.actor_user_id'), 'Historical issuer must not bypass current membership')
assert(!statusRead.includes("'CAPABILITY_DENIED'"), 'Unavailable authority status scope must not disclose capability classification')
assert(!statusRead.includes("'RESOURCE_NOT_FOUND'"), 'Missing and unauthorized authority status reads must be non-disclosing')

const terminal = functionBlock(sql, 'f23_3e_p3b_revoke_or_expire_conversion_authority')
ordered(terminal, [
  'select a.center_id, a.environment_fingerprint',
  'into v_center_id, v_environment_fingerprint',
  "'environment_fingerprint', pg_catalog.encode(v_environment_fingerprint, 'hex')",
  'where i.environment_fingerprint = v_environment_fingerprint',
  'select a.* into v_authority',
  'v_authority.environment_fingerprint is distinct from v_environment_fingerprint',
  'insert into public.crm_idempotency_registry',
  'v_authority.environment_fingerprint',
], 'Authority-derived terminal environment binding and persistence')
assert(!sql.includes('ichess.local.authority-terminal.v1'), 'Production migration must not hard-code a local terminal environment')

const authorityGuard = functionBlock(sql, 'f23_3e_p3b_internal_guard_conversion_authority')
assert(authorityGuard.includes("new.status not in ('EXPIRED', 'REVOKED', 'SUPERSEDED')"), 'P3B authority guard must not own CONSUMED')
assert(!/new\.status\s*=\s*'CONSUMED'/.test(authorityGuard), 'P3B authority CONSUMED path is forbidden')
assert(!/status\s*=\s*'CONSUMED'[\s\S]{0,120}crm_conversion_authority/.test(sql), 'P3B must not consume authority')
assert(!/update public\.crm_profile_creation_reservation[\s\S]{0,160}CONSUMED/i.test(sql), 'P3B must not consume reservation')

for (const forbidden of [
  'create table public.student_profile', 'create table public.guardian_profile',
  'create table public.crm_identity_target_binding', 'create table public.guardian_student_relationship',
  'f23_3e_p3c_materialize', 'f23_3e_p3c_finalize', 'f23_3e_p3d_execute',
  'f23_3e_p3d_read_result',
]) assert(!sql.includes(forbidden), `Forbidden P3C/P3D runtime found: ${forbidden}`)

assert(!/\b(insert\s+into|update|delete\s+from)\s+auth\.users\b/i.test(sql), 'Production migration must not mutate auth.users')
assert(!/admin\/users|signUp|createUser|password|mfa/i.test(sql), 'Migration must not contain Auth-provider mutation/integration')
assert.equal(count(qa, /insert into auth\.users/gi), 1, 'Approved synthetic Auth fixture must be isolated to one QA statement')
assert(!/update auth\.users|delete from auth\.users/i.test(qa), 'QA must not update/delete explicit Auth users')
assert(!/admin\/users|signUp|createUser|password reset|grant_type=password/i.test(qa), 'QA must not use an Auth API or credentials')
includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P3B_LOCAL_QA_ALLOW_RESET'",
  "assert.equal(process.env[resetConsentFlag], 'YES'",
  "localArgs('status -o json')", 'assertLoopback', 'supabase_db_ichess-center-os',
  "assert(!process.env.SUPABASE_PROJECT_REF", 'finally {', 'runReset()',
  "select count(*) from auth.users;", "assert.equal(scalar(`select count(*) from auth.users;`), '0')",
], 'Local safety and final Auth reset')

const qaMarkers = [
  'P3B_QA_LOCAL_SAFETY_GUARD: PASS', 'P3B_QA_LOCAL_SQL_APPLY: PASS',
  'P3B_QA_EXISTING_SYNTHETIC_AUTH_USER: PASS',
  'P3B_QA_AUTH_USERS_UNCHANGED: PASS (baseline restored after approved synthetic-only fixture)',
  'P3B_QA_LOCAL_SYNTHETIC_AUTH_FIXTURE_CREATED: PASS',
  'P3B_QA_AUTH_ACTOR_SEPARATION_FIXTURE: PASS',
  'P3B_QA_REAL_AUTH_USER_MUTATION_COUNT: 0', 'P3B_QA_PRODUCTION_AUTH_MUTATION: NO',
  'P3B_QA_SYNTHETIC_AUTH_FIXTURE_FINAL_RESET: PASS', 'P3B_QA_AUTH_USERS_FINAL_COUNT: 0',
  'P3B_QA_MEMBERSHIP_VERSIONING: PASS', 'P3B_QA_ACCOUNT_SECURITY_SYNC: PASS',
  'P3B_QA_ACCOUNT_SECURITY_FAIL_CLOSED: PASS', 'P3B_QA_FRESH_STEP_UP: PASS',
  'P3B_QA_STEP_UP_STALE_DENY: PASS', 'P3B_QA_STEP_UP_SINGLE_USE: PASS',
  'P3B_QA_FINAL_CAPABILITY_OWNER: PASS', 'P3B_QA_FINAL_CAPABILITY_CENTER_ADMIN: PASS',
  'P3B_QA_CONSULTANT_FINAL_DENY: PASS', 'P3B_QA_SEPARATION_OF_DUTIES: PASS',
  'P3B_QA_FOREIGN_INACTIVE_DENY: PASS', 'P3B_QA_REVIEWED_ACTION_FIXTURE_ONLY: PASS',
  'P3B_QA_DUAL_DIGEST_BINDING: PASS', 'P3B_QA_POST_APPROVED_AUTHORITY_DIGEST: PASS',
  'P3B_QA_AUTHORITY_ISSUANCE: PASS', 'P3B_QA_AUTHORITY_EXACT_REPLAY: PASS',
  'P3B_QA_AUTHORITY_IDEMPOTENCY_CONFLICT: PASS', 'P3B_QA_AUTHORITY_REVOKE: PASS',
  'P3B_QA_AUTHORITY_EXPIRE: PASS', 'P3B_QA_TERMINAL_ENVIRONMENT_BINDING: PASS',
  'P3B_QA_FORMER_ISSUER_STATUS_READ_DENIED: PASS',
  'P3B_QA_FOREIGN_NONMEMBER_STATUS_NONDISCLOSURE: PASS',
  'P3B_QA_AUTHORITY_CONSUME_ABSENT: PASS',
  'P3B_QA_AUDIT_OUTBOX_ATOMIC: PASS', 'P3B_QA_FAULT_ROLLBACK: PASS',
  'P3B_QA_DIRECT_API_FAIL_CLOSED: PASS', 'P3B_QA_REAL_LOCK_WAIT_OBSERVED: PASS',
  'P3B_QA_CONCURRENT_AUTHORITY_ISSUANCE: PASS', 'P3B_QA_SECURITY_MEMBERSHIP_RACES: PASS',
  'P3B_QA_NO_P3C_TARGET_RUNTIME: PASS', 'P3B_QA_NO_P3D_EXECUTOR: PASS',
  'P3B_QA_FINAL_LOCAL_RESET: PASS', 'P3B_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P3B_QA_NONDEFAULT_ROOT_COUNT: 0', 'P3B_QA_TEMP_HELPER_COUNT: 0',
  'F23_3E_P3B_LOCAL_DB_QA: PASS',
]
includesAll(qa, qaMarkers, 'P3B local QA marker coverage')
includesAll(qa, [
  'pg_catalog.pg_blocking_pids(pid)', 'p3b_membership_contender',
  'p3b_security_contender', 'p3b_center_contender', 'p3b_assignment_contender',
  'p3b_issue_contender', 'p3b_qa_fail_${kind}',
  "[['audit', 'crm_audit_event'], ['outbox', 'crm_outbox_event']]",
  'legacyChangedDigest', 'kindChangedDigest', 'intentChangedDigest',
  "environment = 'p3b-local-environment'", "'p3b-secondary-environment'",
  'i.environment_fingerprint is distinct from a.environment_fingerprint',
  'assertStatusUnavailable', "set session_replication_role='replica'",
], 'Executable race, fault and digest QA')

includesAll(report, [
  'LOCAL SYNTHETIC AUTH FIXTURE: USED FOR QA', 'REAL AUTH USER: NOT USED',
  'PRODUCTION AUTH MUTATION: NO', 'REAL AUTH PROVIDER VERIFICATION: NOT IMPLEMENTED',
  'REAL MFA: NOT RUN', 'P3B_EXTERNAL_TECHNICAL_AUDIT_ARTIFACT_COUNT: 4',
  'P3B_EXTERNAL_TECHNICAL_AUDIT_REQUEST: READY',
], 'Approved synthetic Auth and audit handoff')
assert(p3aReport.includes('F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS'), 'P3A must remain final-audit PASS')
assert(p3aReport.includes('P3_AUTHORITY_DIGEST_COMPUTED_AFTER_APPROVED_VERSION_INCREMENT: YES'), 'P3A lifecycle ordering drift')
assert(p3aReport.includes('P3_EXACT_REPLAY_REHASHES_EXECUTED_ACTIONS_AGAINST_APPROVED_AUTHORITY_DIGEST: NO'), 'P3A exact replay drift')
assert(p3aSmoke.includes('checkpointHashes.size, 14'), 'Inherited P3A checkpoint hash lock missing')

console.log('P3B_CHECKPOINT_MIGRATION_HASH_COUNT: 15')
console.log('F23.3E-P3B fresh step-up, final capability and conversion-authority semantic smoke passed')
