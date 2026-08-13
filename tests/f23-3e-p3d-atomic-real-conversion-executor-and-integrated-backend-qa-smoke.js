import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationRelative = 'supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql'
const reportRelative = 'docs/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa.md'
const smokeRelative = 'tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-smoke.js'
const qaRelative = 'tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-local-db-qa.js'
const artifacts = [migrationRelative, reportRelative, smokeRelative, qaRelative]
const migrationsDirectory = join(root, 'supabase', 'migrations')
const p3d0ReportRelative = 'docs/f23-3e-p3d0-candidate-student-birth-evidence-crypto-contract-design-freeze.md'
const p3cMigrationRelative = 'supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql'
const p3bMigrationRelative = 'supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql'
const p2bMigrationRelative = 'supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql'

for (const relative of [...artifacts, p3d0ReportRelative, p3cMigrationRelative, p3bMigrationRelative, p2bMigrationRelative]) {
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
  const endToken = `$${name}$;`
  const end = sql.indexOf(endToken,start)
  assert(end >= 0, `Missing function terminator ${name}`)
  return sql.slice(start,end+endToken.length)
}

const sql = read(migrationRelative)
const report = read(reportRelative)
const smoke = read(smokeRelative)
const qa = read(qaRelative)
const p3d0Report = read(p3d0ReportRelative)
const p3c = read(p3cMigrationRelative)
const p3b = read(p3bMigrationRelative)
const p2b = read(p2bMigrationRelative)

// Runtime ownership is an exact path allowlist. R0 design/audit documents are
// classified separately and can never weaken package or migration assertions.
const runtimeBasename = 'f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa'
const actualArtifacts = new Set([
  ...readdirSync(join(root, 'docs')).filter((name) => name.startsWith(runtimeBasename)).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.startsWith(runtimeBasename)).map((name) => `tests/${name}`),
  ...readdirSync(migrationsDirectory).filter((name) => name.includes('_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa')).map((name) => `supabase/migrations/${name}`),
])
assert.deepEqual([...actualArtifacts].sort(), [...artifacts].sort(), 'P3D runtime package must be the exact four-path allowlist')
assert.deepEqual(readdirSync(migrationsDirectory).filter((name) => name.includes('_f23_3e_p3d_')), [migrationRelative.split('/').at(-1)], 'P3D must own exactly one migration')
const r0Evidence = readdirSync(join(root, 'docs')).filter((name) => /^f23-3e-p3d-r0-(?:design|independent|final-independent)/.test(name))
assert(r0Evidence.length >= 3, 'R0 design/audit evidence must stay separate from runtime ownership')
assert(!new RegExp(['migrationFiles', 'length'].join('\\.')).test(smoke), 'P3D must not freeze total migration inventory')

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
assert.equal(checkpointHashes.size, 16)
for (const [name, expected] of checkpointHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), expected, `Checkpoint hash drift: ${name}`)
}
const p3dExpectedSha256 = 'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3'
assert.equal(sha256(migrationRelative), p3dExpectedSha256, 'P3D migration SHA drift')

assert.equal((sql.match(/create\s+table\s+public\.crm_reviewed_cross_source_reuse_authorization\b/gi) || []).length, 1)
for (const forbiddenTable of ['student_profile','guardian_profile','guardian_student_relationship','crm_identity_target_binding']) {
  assert(!new RegExp(`create\\s+table\\s+public\\.${forbiddenTable}\\b`,'i').test(sql), `P3D recreated ${forbiddenTable}`)
}
includesAll(sql, [
  "old.status = 'APPROVED' and new.status = 'EXECUTING'",
  "old.status = 'EXECUTING' and new.status = 'COMPLETED'",
  "old.status = 'APPROVED' and new.status = 'EXECUTED'",
  "old.status = 'ISSUED' and new.status = 'CONSUMED'",
  "new.status = 'CONSUMED'",
  "pg_catalog.current_setting('ichess.p3d_executor', true) = 'on'",
  "pg_catalog.set_config('ichess.p3d_reservation_consume','on',true)",
  "terminal_reason_code = 'CONSUMED_BY_FUTURE_EXECUTOR'",
], 'P3D protected lifecycle edges')

const execute = functionBlock(sql, 'f23_3e_p3d_execute_conversion')
includesAll(execute, [
  'p_conversion_request_id uuid', 'p_conversion_authority_id uuid',
  'p_expected_request_version integer', 'p_expected_authority_version integer',
  'p_environment_fingerprint bytea', 'p_operation_intent_digest bytea',
  'p_idempotency_key_digest bytea', 'p_idempotency_expires_at timestamptz',
  "v_registry.status = 'COMPLETED'", "v_registry.p3_result_kind <> 'REAL_CONVERSION'",
  'f23_3e_p3d_internal_precheck_birth_evidence', 'P3D_CANONICAL_LOCK_ORDER_BEGIN',
  "f23_3e_p3d_internal_action_set_digest_versioned(\n    p_conversion_request_id,'APPROVED'",
  'is distinct from v_authority.p3_action_set_digest',
  "status = 'EXECUTING'", 'f23_3e_p3d_internal_create_student_target_no_relock',
  'f23_3e_p3d_internal_create_guardian_target_no_relock',
  'f23_3e_p3d_internal_upsert_relationship_no_relock',
  'f23_3e_p3d_internal_commit_identity_target_binding_no_relock',
  "status = 'EXECUTED'", "status = 'COMPLETED'", "status = 'CONSUMED'",
  "p3_result_kind = 'REAL_CONVERSION'", "'REAL_CONVERSION_COMPLETED'",
], 'P3D executor')
assert(execute.indexOf("v_registry.status = 'COMPLETED'") < execute.indexOf('f23_3e_p3d_internal_precheck_birth_evidence'), 'Exact replay must precede Stage A')
assert(execute.indexOf("f23_3e_p3d_internal_action_set_digest_versioned(\n    p_conversion_request_id,'APPROVED'") < execute.indexOf("status = 'EXECUTING'"), 'APPROVED digest must precede mutation')
excludesAll(execute.split('-- Unlocked immutable-result selector')[1].split('-- Stage A')[0], [
  "'EXECUTED'", 'f23_3e_p3d_internal_action_set_digest_versioned', 'student_profile', 'guardian_profile',
], 'Exact replay branch')
for (const forbidden of ['p_actor_user_id uuid','p_center_id text','p_birth_date','p_action_list','p_step_up']) {
  assert(!execute.slice(0, execute.indexOf('returns table')).includes(forbidden), `Narrow executor input contains ${forbidden}`)
}

const status = functionBlock(sql, 'f23_3e_p3d_read_conversion_result_status')
includesAll(status, ["i.operation = 'crm.real_conversion.execute'", "i.status = 'COMPLETED'", "i.p3_result_kind = 'REAL_CONVERSION'", 'v_registry.p3_result_snapshot'])
excludesAll(status, ['student_profile','guardian_profile','guardian_student_relationship','crm_conversion_authority','f23_3e_p3b_internal_action_set_digest'], 'Immutable result-status RPC')

// P3D0 exact source/target crypto and no fourth environment domain.
includesAll(sql, [
  'IC3CBE01','iC3Bth01','ichess.crm.candidate.birth-evidence.aead.v1',
  'IC3SBE01','iC3Std01','ichess.student.target.birth-evidence.aead.v1',
  'f23_3e_p3c_internal_crypto_environment_fingerprint()',
  "pg_catalog.octet_length(p_payload) <> 10",
  "v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'",
  "pg_catalog.to_char(v_date, 'YYYY-MM-DD') <> v_text",
  'v_target_birth = v_candidate.birth_evidence_protected',
], 'P3D0 crypto bridge')
const studentWriter = functionBlock(sql, 'f23_3e_p3c_internal_create_student_target')
includesAll(studentWriter, [
  'p_conversion_action_id uuid','p_actor_user_id uuid','p_display_name_evidence text','p_birth_date_evidence date',
  'f23_3e_p3d_internal_unwrap_candidate_birth_evidence',
  'f23_3e_p3d_internal_protect_student_birth_evidence',
  'p_display_name_evidence, v_target_birth',
], 'Forward-compatible Student writer')
assert(!studentWriter.includes('p_display_name_evidence, v_candidate.birth_evidence_protected'), 'Candidate ciphertext direct copy regressed')
assert(!/p_environment_fingerprint\s*(?:=|is\s+not\s+distinct\s+from)\s*public\.f23_3e_p3c_internal_crypto_environment_fingerprint/i.test(sql), 'Authority/crypto environments were conflated')
includesAll(p3d0Report, ['P3D0_FINAL_TECHNICAL_AUDIT:\nPASS','P3D0_NEW_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT:\n0'], 'P3D0 normative addendum')
includesAll(p3b, ["p_environment_fingerprint is null or pg_catalog.octet_length(p_environment_fingerprint) <> 32", 'environment_fingerprint, center_id, actor_user_id'], 'P3B opaque authority environment')
includesAll(p2b, ['f23_3e_p2b_internal_environment_fingerprint'], 'P2B identity environment')

// Final-audited R0 remediation: reviewed cross-source authority, V2 binding,
// one-pass mixed-kind mutex ordering, no-relock cores and fresh-Request recovery.
includesAll(sql, [
  'create table public.crm_reviewed_cross_source_reuse_authorization',
  "status text not null default 'ISSUED'", "status='INVALIDATED'",
  "status='CONSUMED'", 'supporting_identity_target_binding_id',
  'reviewed_by_actor_user_id','reviewer_membership_id','reviewer_membership_version',
  'f23_3e_p3d_internal_select_support_binding','CROSS_SOURCE_EXPLICIT_REVIEW',
  "'reuse_review_mode',v_mode", "'explicit_human_review_required',true",
  'f23_3e_p3d_internal_action_set_digest_v2',
  'f23_3e_p3d_internal_action_set_digest_versioned',
  'f23_3e_p3d_internal_reuse_authorization_set_digest_v1',
  'f23_3e_p3d_internal_relationship_scope_digest_v1',
  'p3_reuse_authorization_set_encoding_version','p3_reuse_authorization_set_digest',
  'f23_3e_p3d_internal_invalidate_single_plan_request',
  "'crm.identity.cross_source_reuse_authorization.issued'",
  "'crm.identity.cross_source_reuse_authorization.invalidated'",
  "'crm.identity.cross_source_reuse_authorization.consumed'",
  "when 'GUARDIAN' then 1 when 'STUDENT' then 2 else 99 end",
  'pg_temp.p3d_qa_root_barrier','P3D_LOCAL_QA_BARRIER_INVALID',
], 'P3D R0 runtime')
const noRelockCores = [
  'f23_3e_p3d_internal_create_student_target_no_relock',
  'f23_3e_p3d_internal_resolve_reusable_student_no_relock',
  'f23_3e_p3d_internal_create_guardian_target_no_relock',
  'f23_3e_p3d_internal_resolve_reusable_guardian_no_relock',
  'f23_3e_p3d_internal_commit_identity_target_binding_no_relock',
  'f23_3e_p3d_internal_upsert_relationship_no_relock',
]
for (const name of noRelockCores) {
  const block = functionBlock(sql,name)
  excludesAll(block, ['for update','pg_advisory','identity_match_mutex','center_crm_control'], `${name} lock ownership`)
  includesAll(block, ['EXECUTOR_LOCK_PRECONDITION_FAILED'], `${name} caller-held precondition`)
}
assert.equal((execute.match(/m\.identity_match_mutex_key\s+for update of m/g) || []).length,1,'identity mutex must lock in exactly one pass')
assert(execute.indexOf('where r.center_id = v_precheck.center_id for update') < execute.indexOf('m.identity_match_mutex_key\n    for update of m'),'center root must precede identity mutex')

// Strict result/action mapping, event vocabulary and Audit/Outbox rollback path.
includesAll(sql, [
  "v_kind = 'CREATE_NEW_STUDENT' and v_outcome <> 'STUDENT_CREATED'",
  "v_kind = 'REUSE_REVIEWED_GUARDIAN' and v_outcome <> 'GUARDIAN_REUSED'",
  "v_kind = 'DO_NOT_CREATE_RELATIONSHIP' and v_outcome <> 'RELATIONSHIP_NOT_CREATED'",
  'crm.student.created_from_conversion','crm.student.reused_for_conversion',
  'crm.guardian.created_from_conversion','crm.guardian.reused_for_conversion',
  'crm.guardian_student_relationship.created','crm.guardian_student_relationship.reused',
  'crm.guardian_student_relationship.updated','crm.candidate.converted',
  'crm.assignment.ended','crm.case.converted','crm.conversion.authority_consumed',
  'crm.conversion.completed','f23_3e_p3b_internal_append_audit_outbox',
], 'P3D result and event vocabulary')
excludesAll(sql, ['crm.real-conversion.started','crm.conversion-action.executed'], 'Unfrozen event vocabulary')

assert.match(sql, /do\s+\$f23_3e_p3d_revoke_internal_helpers\$[\s\S]*p\.proname like 'f23_3e_p3d_internal_%'[\s\S]*revoke all on function[\s\S]*public, anon, authenticated, service_role/i)
assert.match(sql, /grant execute on function public\.f23_3e_p3d_execute_conversion\(uuid,uuid,integer,integer,bytea,bytea,bytea,timestamptz\)\s+to service_role/i)
assert.match(sql, /grant execute on function public\.f23_3e_p3d_read_conversion_result_status\(uuid,bytea\)\s+to service_role/i)
assert.equal((sql.match(/grant execute on function public\.f23_3e_p3d_/gi) || []).length, 2)

// Every checkpoint rename + CREATE must restore the exact inherited ACL.
for (const protectedSignature of [
  /revoke all on function public\.f23_3e_p2b_internal_search_masked_candidates\([\s\S]*?\) from public, anon, authenticated, service_role/i,
  /revoke all on function public\.f23_3e_p3c_internal_resolve_reusable_student\(\s*text,uuid,uuid,integer,uuid\s*\) from public, anon, authenticated, service_role/i,
  /revoke all on function public\.f23_3e_p3c_internal_resolve_reusable_guardian\(\s*text,uuid,uuid,integer,uuid\s*\) from public, anon, authenticated, service_role/i,
  /revoke all on function public\.f23_3e_p3b_internal_is_safe_result_snapshot\(jsonb\)\s+from public, anon, authenticated, service_role/i,
]) assert.match(sql,protectedSignature)
for (const serviceRpc of [
  'f23_3e_p3c_materialize_reviewed_action_pair',
  'f23_3e_p3c_finalize_reviewed_action_plan',
  'f23_3e_p3b_issue_conversion_authority',
  'f23_3e_p2c_supersede_match_review',
  'f23_3e_p2c_expire_match_review',
]) {
  assert.match(sql,new RegExp(`revoke all on function public\\.${serviceRpc}\\([\\s\\S]*?\\) from public, anon, authenticated;[\\s\\S]*?grant execute on function public\\.${serviceRpc}\\([\\s\\S]*?\\) to service_role`,'i'))
}

const materialize = functionBlock(sql,'f23_3e_p3c_materialize_reviewed_action_pair')
const finalize = functionBlock(sql,'f23_3e_p3c_finalize_reviewed_action_plan')
assert(materialize.indexOf('coalesce(v_result.replayed,false)') < materialize.indexOf('select * into v_student_action'),'materialize replay must precede live actions')
assert(finalize.indexOf('coalesce(v_result.replayed,false)') < finalize.indexOf('select min(a.action_set_encoding_version)'),'finalize replay must precede live actions')
includesAll(sql,[
  'f23_3e_p3d_internal_preissue_invalidate_plan',
  "'CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED'",
  "'crm.identity.expire_match_review','crm.identity.supersede_match_review'",
  "where operation = 'crm.real_conversion.execute'",
], 'P3D minimal remediation runtime')
assert(!/where operation = 'conversion\.execute'/.test(sql),'obsolete result lookup predicate')

includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P3D_LOCAL_QA_ALLOW_RESET'",
  "localArgs('status -o json')", "localArgs('db reset')",
  'supabase_db_ichess-center-os','com.supabase.cli.project','com.docker.compose.project',
  'P3D_QA_NO_TARGET_HAPPY_PATH: PASS','P3D_QA_REUSE_REUSE_RELATIONSHIP_HAPPY_PATH: PASS',
  'P3D_QA_CREATE_CREATE_RELATIONSHIP_HAPPY_PATH: PASS','P3D_QA_FAULT_ROLLBACK_MATRIX: PASS',
  'wait_event_type=\'Lock\'','pg_catalog.pg_blocking_pids(pid)',
  'P3D_QA_REAL_POSTGRES_LOCK_WAITS: 7','P3D_QA_EXACT_REPLAY_BEFORE_LIVE_TERMINAL_RECHECK: PASS',
  'P3D_QA_REPLAY_DOES_NOT_REHASH_EXECUTED_ACTIONS: PASS','P3D_QA_AUDIT_OUTBOX_ATOMIC_PRIVACY: PASS',
  'P3D_QA_GENUINE_REQUEST_A_TO_REQUEST_B_CROSS_SOURCE_REUSE: PASS',
  'P3D_QA_REUSE_AUTHORIZATION_AND_BINDING_PROVENANCE: PASS',
  'P3D_QA_AUTHORIZATION_INVALIDATION_FRESH_REQUEST_RECOVERY: PASS',
  'P3D_QA_PREISSUE_V2_PLAN_INVALIDATION: PASS',
  'P3D_QA_PREISSUE_FRESH_REQUEST_RECOVERY: PASS',
  'P3D_QA_PREISSUE_NO_RESURRECTION: PASS',
  'P3D_QA_PREISSUE_INVALIDATION_FAULT_ROLLBACK: PASS',
  'P3D_QA_P3C_MATERIALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY: PASS',
  'P3D_QA_P3C_FINALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY: PASS',
  'P3D_QA_RECREATED_FUNCTION_EFFECTIVE_GRANTS: PASS',
  'P3D_QA_RECREATED_FUNCTION_ANON_POSTGREST_DENIAL: PASS',
  'P3D_QA_REAL_CONVERSION_RESULT_LOOKUP_UNIQUENESS: PASS',
  'P3D_QA_AUTHORIZATION_RELATIONSHIP_DIGEST_SUBSTITUTION: PASS',
  'P3D_QA_V1_V2_DOWNGRADE_FAIL_CLOSED: PASS',
  'P3D_QA_STATIC_SIX_NO_RELOCK_CORES: PASS',
  'P3D_QA_COMPLETE_MIXED_KIND_ONE_PASS_MUTEX_ORDER: PASS',
  'P3D_QA_TWO_EXECUTOR_ROOT_BARRIER_REAL_LOCK_WAIT: PASS',
  'P3D_QA_CROSS_KEY_MUTEX_DEADLOCK_CLASS_CLOSED: PASS',
  "create temporary table p3d_qa_root_barrier",'pg_catalog.pg_locks',
  'P3D_QA_AUTH_USERS_FINAL_COUNT: 0','P3D_QA_VAULT_SECRETS_FINAL_COUNT: 0',
  'P3D_QA_FINAL_RESET_BASELINE: PASS',
], 'Guarded P3D local QA')
const genuinePath = qa.slice(qa.indexOf('// Genuine Request A'),qa.indexOf('const requestBState'))
excludesAll(genuinePath,["session_replication_role='replica'"],'Production-reachable Request A to B path')
excludesAll(qa, ['--linked','supabase link','supabase push','supabase migration repair'], 'P3D local-only runner')

includesAll(report, [
  'F23_3E_P3D_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P3D_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_P3D_LOCAL_DB_QA: PASS',
  'P3D_FORWARD_MIGRATION_COUNT: 1','P3D_NEW_BUSINESS_TABLE_COUNT: 0',
  'P3D_EXTERNAL_SERVICE_RPC_COUNT: 2','P3D_CHECKPOINT_MIGRATION_HASH_COUNT: 16',
  'P3D_PRODUCT_CANDIDATE_INGRESS: DEFERRED',
  'P3D_LOCAL_DOCKER_QA_RESULT: PASS',
  p3dExpectedSha256.toLowerCase(),
], 'P3D report')
excludesAll(report, ['F23_3E_P3D_FINAL_TECHNICAL_AUDIT: PASS','P3D_PRODUCT_CANDIDATE_INGRESS: IMPLEMENTED'], 'Pre-audit report state')

for (const content of [sql, qa]) {
  assert(!/RoadmapRealTime|src\/|supabase\s+(?:link|push)|remote\s+apply/i.test(content), 'P3D artifact crosses forbidden scope')
}
for (const content of [sql, report, smoke, qa]) {
  assert(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(content), 'Control character detected')
}
for (const content of [sql, report, qa]) {
  assert(!/(?:Ã.|Â.|â€|ï¿½|\uFFFD)/.test(content), 'Mojibake detected')
}

console.log('F23.3E-P3D atomic real-conversion executor semantic smoke: PASS')
console.log('P3D_ARTIFACT_COUNT: 4')
console.log('P3D_FORWARD_MIGRATION_COUNT: 1')
console.log('P3D_NEW_BUSINESS_TABLE_COUNT: 0')
console.log('P3D_EXTERNAL_SERVICE_RPC_COUNT: 2')
console.log('P3D_CHECKPOINT_MIGRATION_HASH_COUNT: 16')
console.log(`P3D_MIGRATION_SHA256: ${p3dExpectedSha256}`)
