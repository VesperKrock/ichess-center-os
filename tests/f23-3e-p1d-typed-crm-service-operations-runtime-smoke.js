import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationName = '202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql'
const migrationPath = join(root, 'supabase', 'migrations', migrationName)
const reportPath = join(root, 'docs', 'f23-3e-p1d-typed-crm-service-operations-runtime.md')
const smokePath = join(root, 'tests', 'f23-3e-p1d-typed-crm-service-operations-runtime-smoke.js')
const qaPath = join(root, 'tests', 'f23-3e-p1d-typed-crm-service-operations-local-db-qa.js')
const canonicalRoadmapPath = join(root, 'docs', 'f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const localRoadmapPath = join(root, 'RoadmapRealTime.txt')
const migration = readFileSync(migrationPath, 'utf8')
const report = readFileSync(reportPath, 'utf8')
const smoke = readFileSync(smokePath, 'utf8')
const qa = readFileSync(qaPath, 'utf8')
const canonicalRoadmap = readFileSync(canonicalRoadmapPath, 'utf8')
const localRoadmap = readFileSync(localRoadmapPath, 'utf8')
const sql = migration.toLowerCase()

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const includesAll = (text, values, label) => {
  for (const value of values) assert(text.includes(value), `${label}: missing ${value}`)
}

const immutableHashes = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
  ['202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql', '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6'],
  ['202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql', 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F'],
  ['202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql', '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA'],
])
for (const [name, expected] of immutableHashes) {
  assert.equal(sha256(join(root, 'supabase', 'migrations', name)), expected, `Immutable migration changed: ${name}`)
  includesAll(report, [name, expected], `Report lacks immutable hash ${name}`)
}

const p1dHash = sha256(migrationPath)
assert.equal(
  p1dHash,
  'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722',
  'P1D migration changed after external technical audit',
)
includesAll(report, [migrationName, p1dHash], 'Report lacks computed P1D migration hash')
assert(report.includes('F23_3E_P1D_FINAL_TECHNICAL_AUDIT: PASS'), 'P1D external technical audit closeout missing')

const checkpointVersion = 202608100002n
const migrationFilenamePattern = /^([0-9]+)_[a-z0-9_]+\.sql$/
const requiredMigrationNames = new Set([...immutableHashes.keys(), migrationName])
const actualMigrationNames = readdirSync(join(root, 'supabase', 'migrations'))
  .filter((name) => name.endsWith('.sql')).sort()
for (const name of actualMigrationNames) {
  const match = migrationFilenamePattern.exec(name)
  assert(match, `Invalid migration filename: ${name}`)
  if (BigInt(match[1]) <= checkpointVersion) {
    assert(requiredMigrationNames.has(name), `Unexpected migration at or before P1D checkpoint: ${name}`)
  }
}
for (const name of requiredMigrationNames) {
  assert(actualMigrationNames.includes(name), `Missing required P1D checkpoint migration: ${name}`)
}
assert.deepEqual(
  actualMigrationNames.filter((name) => BigInt(migrationFilenamePattern.exec(name)[1]) === checkpointVersion),
  [migrationName],
  'P1D checkpoint version must resolve to exactly the canonical P1D migration',
)

const exactArtifacts = [
  `supabase/migrations/${migrationName}`,
  'docs/f23-3e-p1d-typed-crm-service-operations-runtime.md',
  'tests/f23-3e-p1d-typed-crm-service-operations-runtime-smoke.js',
  'tests/f23-3e-p1d-typed-crm-service-operations-local-db-qa.js',
].sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('f23_3e_p1d')).map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs')).filter((name) => name.includes('f23-3e-p1d')).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.includes('f23-3e-p1d')).map((name) => `tests/${name}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P1D must consist of exactly four artifacts')

const rpcs = [
  'f23_3e_p1d_create_crm_contact',
  'f23_3e_p1d_update_crm_contact',
  'f23_3e_p1d_transition_crm_contact_status',
  'f23_3e_p1d_create_consultation_case',
  'f23_3e_p1d_transition_consultation_case_status',
  'f23_3e_p1d_assign_consultation_case',
  'f23_3e_p1d_reassign_consultation_case',
  'f23_3e_p1d_end_consultation_case_assignment',
  'f23_3e_p1d_revoke_consultation_case_assignment',
  'f23_3e_p1d_append_crm_care_log',
  'f23_3e_p1d_correct_crm_care_log',
]
const functionBlock = (name) => {
  const start = sql.indexOf(`create function public.${name}(`)
  assert(start >= 0, `Missing RPC ${name}`)
  const tag = `$${name}$`
  const end = sql.indexOf(`${tag};`, start)
  assert(end > start, `Unterminated RPC ${name}`)
  return sql.slice(start, end + tag.length + 1)
}
for (const name of rpcs) {
  const block = functionBlock(name)
  includesAll(block, ['returns table (', 'ok boolean', 'outcome_code text', 'resource_id uuid',
    'resource_version integer', 'case_id uuid', 'case_version integer', 'assignment_id uuid',
    'assignment_version integer', 'correlation_id uuid', 'security definer', "set search_path = ''"], `${name} typed/security contract`)
  assert(!/\bexecute\s+(?:format|immediate|[a-z_])/i.test(block), `${name} contains dynamic SQL`)
  assert(sql.includes(`revoke all on function public.${name}(`), `${name} revoke missing`)
  assert(sql.includes(`grant execute on function public.${name}(`), `${name} service grant missing`)
}
assert.equal((sql.match(/grant execute on function public\.f23_3e_p1d_/g) ?? []).length, 11)
assert(!/grant execute on function public\.f23_3e_p1d_internal_/i.test(migration), 'Internal helper was exposed')
assert.equal((sql.match(/create function public\.f23_3e_p1d_(?!internal_)/g) ?? []).length, 11)

includesAll(sql, [
  'create_contact_runtime_atomic_begin', 'contact_mutation_runtime_atomic_begin',
  'create_case_runtime_atomic_begin', 'case_status_runtime_atomic_begin',
  'assign_case_runtime_atomic_begin', 'reassign_case_runtime_atomic_begin',
  'end_revoke_assignment_runtime_atomic_begin', 'care_log_runtime_atomic_begin',
  'center_crm_control_row', 'auth_user_existence_row', 'audit_outbox_rows', 'commit_atomic',
], 'Lock-order markers incomplete')

for (const name of rpcs) {
  const block = functionBlock(name)
  assert(block.indexOf('center_crm_control_row') < block.indexOf('audit_outbox_rows'), `${name} root/event ordering drift`)
  includesAll(block, ["v_root.crm_state <> 'active'", "v_root.feature_flag_state <> 'enabled'"], `${name} root gate`)
}

const assignBlock = functionBlock('f23_3e_p1d_assign_consultation_case')
const reassignBlock = functionBlock('f23_3e_p1d_reassign_consultation_case')
for (const block of [assignBlock, reassignBlock]) {
  includesAll(block, [
    'order by u.id', 'for key share', 'from public.center_members', 'for share',
    "v_membership.status <> 'active'", "v_membership.role <> 'consultant'",
    "'target_not_eligible'", 'consultation_case_row',
  ], 'Assignment target lock/recheck incomplete')
  assert(!block.includes('p_role'), 'Assignment accepts caller-provided role')
  assert(!block.includes('p_center_id'), 'Assignment accepts caller-provided center authority')
}
includesAll(reassignBlock, [
  "assignment_status = 'superseded'", 'assignment_version = a.assignment_version + 1',
  'ended_at = v_now', 'end_reason = p_safe_reason_code',
  "'crm.assignment.superseded'", "'crm.assignment.assigned'",
  'both pairs share one server correlation id',
], 'Reassign all-or-nothing mapping incomplete')

const caseTransition = functionBlock('f23_3e_p1d_transition_consultation_case_status')
assert(!caseTransition.includes("p_target_status in ('converted'"), 'P1D Case transition reaches CONVERTED')
assert(!/set[\s\S]{0,100}conversion_state\s*=/.test(caseTransition), 'P1D mutates conversion_state')
includesAll(caseTransition, ["'active_assignment_conflict'", "p_target_status in ('lost','cancelled','archived')"], 'Terminal Case/active Assignment guard missing')

const appendBlock = functionBlock('f23_3e_p1d_append_crm_care_log')
const correctBlock = functionBlock('f23_3e_p1d_correct_crm_care_log')
includesAll(appendBlock, ['p_safe_content text', 'insert into public.crm_care_log', "'care_log_appended'"], 'Care Log append contract incomplete')
includesAll(correctBlock, ['p_original_care_log_id uuid', "'correction'", 'correction_of_care_log_id', "'cross_center_conflict'", "'care_log_corrected'"], 'Care Log correction contract incomplete')
assert(!/update\s+public\.crm_care_log/i.test(correctBlock), 'Correction updates an existing Care Log')

const eventBlock = functionBlock('f23_3e_p1d_internal_append_audit_outbox')
includesAll(eventBlock, [
  'insert into public.crm_audit_event', 'insert into public.crm_outbox_event',
  'event_version, safe_payload', 'p_new_version, v_payload', 'jsonb_strip_nulls',
  "'event_schema_version'", "'resource_kind'", "'resource_id'", "'correlation_id'",
], 'Audit/Outbox helper incomplete')
for (const forbidden of ['ciphertext', 'lookup_digest', 'safe_content', 'phone', 'email']) {
  assert(!eventBlock.includes(forbidden), `Audit/Outbox helper leaks ${forbidden}`)
}

const p1bMutationNames = [
  'f23_3e_p1b_create_conversion_draft', 'f23_3e_p1b_update_conversion_draft',
  'f23_3e_p1b_submit_conversion_draft', 'f23_3e_p1b_cancel_conversion_request',
]
for (const name of p1bMutationNames) assert(!sql.includes(`create function public.${name}`), `P1D duplicates ${name}`)

for (const pattern of [
  /insert\s+into\s+auth\./i, /update\s+auth\./i, /delete\s+from\s+auth\./i,
  /insert\s+into\s+public\.(?:guardians?|students?)/i,
  /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,100}\b(?:anon|authenticated)\b/i,
  /create\s+policy/i, /\bfetch\s*\(/i, /\bhttp(?:_request)?\b/i,
  /https?:\/\//i, /\bsupabase\s+db\s+(?:push|pull)\b/i,
]) assert(!pattern.test(migration), `Migration contains forbidden scope ${pattern}`)

const reportPrefix = [
  'F23_3E_P1D_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P1D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1D_MIGRATION_CREATED: YES',
  'F23_3E_P1D_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1D_LOCAL_DB_BEHAVIOR_QA: PASS',
  'F23_3E_P1D_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1D_BROWSER_RUNTIME_WIRING: NOT STARTED',
  'F23_3E_P1D_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED',
  'F23_3E_P1D_RLS_READ_PATH_REMEDIATION: NOT STARTED',
  'F23_3E_P1D_LOCALSTORAGE_IMPORT: NOT STARTED',
  'F23_3E_P1D_APPROVAL_EXECUTOR: NOT STARTED',
  'F23_3E_P1D_REAL_CONVERSION: NOT IMPLEMENTED',
  'F23_3E_P1D_AUTH_CHANGE: NO',
  'F23_3E_P1D_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1D_DEPLOY: NOT RUN',
  'F23_3E_P1D_REAL_DATA_CHANGE: NO',
].join('\n')
assert(report.startsWith(reportPrefix), 'Implementation report status prefix drift')
includesAll(report, [
  'P1D_ACTOR_IS_PROTECTED_SERVICE_ATTRIBUTION_ONLY: YES',
  'P1D_CASE_ASSIGNMENT_GRANTS_GLOBAL_CONTACT_AUTHORITY: NO',
  'P1D_ASSIGNMENT_TARGET_EXACT_CENTER_MEMBERSHIP_RECHECK: YES',
  'P1D_ASSIGNMENT_TARGET_ELIGIBILITY_RECHECKED_UNDER_LOCK: YES',
  'P1D_ASSIGNMENT_TARGET_ROLE_ACCEPTED_FROM_CALLER: NO',
  'P1D_REASSIGN_ALL_OR_NOTHING: YES',
  'P1D_CARE_LOG_CORRECTION_UPDATES_ORIGINAL_ROW: NO',
  'P1D_CARE_LOG_CORRECTION_IS_APPEND_ONLY: YES',
  'P1D_CASE_CONVERTED_STATUS_REACHABLE: NO',
  'P1D_CREATE_CONTACT_PREALLOCATED_ID_RETRY_SAFE: YES',
  'P1D_BUSINESS_AUDIT_OUTBOX_ATOMIC: YES',
  'P1D_AUDIT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO',
  'P1D_OUTBOX_FAILURE_ALLOWS_BUSINESS_COMMIT: NO',
  'P1D_QA_FINAL_LOCAL_RESET: PASS', 'P1D_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P1D_QA_NONDEFAULT_ROOT_COUNT: 0', 'Remote action: NOT RUN',
  ...exactArtifacts,
], 'Implementation report incomplete')

const p1dRoadmapLine = 'F23.3E-P1D DONE backend/local verified / Typed Contact, Case, Assignment và Care Log operations'
includesAll(localRoadmap, [p1dRoadmapLine, 'F23.3E-P3 DONE backend/local verified', 'F23.3E-P4A DONE backend/local verified'], 'Current P1D roadmap state drift')
assert.equal(localRoadmap.split('F23.3E-P1D DONE backend/local verified').length - 1, 1, 'P1D must have exactly one current DONE status')
assert(!localRoadmap.includes('F23.3E-P1D TODO backend'), 'Stale P1D TODO marker must be removed')
assert(canonicalRoadmap.includes('F23.3E-P1D DONE backend/local verified'), 'Historical P1D closeout evidence drifted')

const qaMarkers = [
  'P1D_QA_BROWSER_RPC_EXECUTE_DENIED: PASS', 'P1D_QA_SERVICE_ROLE_RPC_GRANTS_EXACT: PASS',
  'P1D_QA_INTERNAL_HELPERS_NOT_EXPOSED: PASS', 'P1D_QA_CRM_TABLE_PRIVILEGES_FAIL_CLOSED: PASS',
  'P1D_QA_INACTIVE_ROOT_DENIES_MUTATION: PASS', 'P1D_QA_CREATE_CONTACT: PASS',
  'P1D_QA_CONTACT_PREALLOCATED_ID_RETRY_SAFE: PASS', 'P1D_QA_UPDATE_CONTACT: PASS',
  'P1D_QA_CONTACT_VERSION_STALE: PASS', 'P1D_QA_CONTACT_STATUS_TRANSITION: PASS',
  'P1D_QA_ARCHIVED_CONTACT_NORMAL_MUTATION_DENIED: PASS', 'P1D_QA_CREATE_CASE: PASS',
  'P1D_QA_CASE_EXACT_CONTACT_VERSION: PASS', 'P1D_QA_CASE_STATUS_TRANSITION: PASS',
  'P1D_QA_CASE_CONVERTED_STATUS_UNREACHABLE: PASS', 'P1D_QA_TERMINAL_CASE_REOPEN_DENIED: PASS',
  'P1D_QA_TERMINAL_CASE_WITH_ACTIVE_ASSIGNMENT_DENIED: PASS', 'P1D_QA_ASSIGN_CASE: PASS',
  'P1D_QA_ASSIGNMENT_TARGET_EXACT_CENTER: PASS', 'P1D_QA_ASSIGNMENT_TARGET_ELIGIBILITY: PASS',
  'P1D_QA_ONE_ACTIVE_ASSIGNMENT: PASS', 'P1D_QA_REASSIGN_CASE: PASS',
  'P1D_QA_REASSIGN_OLD_SUPERSEDED: PASS', 'P1D_QA_REASSIGN_NEW_ACTIVE: PASS',
  'P1D_QA_REASSIGN_CASE_POINTER_EXACT: PASS', 'P1D_QA_END_ASSIGNMENT: PASS',
  'P1D_QA_REVOKE_ASSIGNMENT: PASS', 'P1D_QA_TERMINAL_ASSIGNMENT_REOPEN_DENIED: PASS',
  'P1D_QA_APPEND_CARE_LOG: PASS', 'P1D_QA_CORRECT_CARE_LOG_APPEND_ONLY: PASS',
  'P1D_QA_CARE_LOG_ORIGINAL_UNCHANGED: PASS', 'P1D_QA_CROSS_CASE_CORRECTION_DENIED: PASS',
  'P1D_QA_BUSINESS_AUDIT_OUTBOX_ATOMIC: PASS', 'P1D_QA_AUDIT_OUTBOX_NO_RAW_PII: PASS',
  'P1D_QA_CONCURRENT_CONTACT_UPDATE_ONE_WINNER: PASS', 'P1D_QA_CONCURRENT_CASE_STATUS_ONE_WINNER: PASS',
  'P1D_QA_CONCURRENT_INITIAL_ASSIGNMENT_ONE_WINNER: PASS', 'P1D_QA_CONCURRENT_REASSIGN_VS_REVOKE_SAFE: PASS',
  'P1D_QA_CONCURRENT_DOUBLE_REASSIGN_ONE_WINNER: PASS', 'P1D_QA_CONCURRENT_DUPLICATE_CARE_LOG_ID_SAFE: PASS',
  'P1D_QA_ASSIGNMENT_ELIGIBILITY_REVOKE_RACE_SAFE: PASS',
  'P1D_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK_BUSINESS: PASS',
  'P1D_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK_BUSINESS: PASS',
  'P1D_QA_REASSIGN_SECOND_EVENT_FAILURE_ROLLS_BACK_ALL: PASS',
  'P1D_QA_FINAL_LOCAL_RESET: PASS', 'P1D_QA_LEFTOVER_FIXTURE_COUNT:', 'P1D_QA_NONDEFAULT_ROOT_COUNT:',
]
includesAll(qa, qaMarkers, 'QA runner marker inventory incomplete')
includesAll(qa, [
  "const expectedContainerName = 'supabase_db_ichess-center-os'",
  "const resetConsentFlag = 'ICHESS_P1D_LOCAL_QA_ALLOW_RESET'",
  "localArgs('db reset')", "localArgs('status -o json')", 'assertLoopback',
  "labels['com.supabase.cli.project']", "labels['com.docker.compose.project']",
  'pg_advisory_lock', 'finally {', 'fixture_count', 'nondefault_root_count',
], 'QA runner safety/concurrency/cleanup controls incomplete')
assert(!qa.includes(['--', 'linked'].join('')), 'Runner contains a linked-project flag literal')

for (const artifact of [migration, report, smoke, qa]) {
  for (const pattern of [
    /https?:\/\/[a-z0-9-]+\.supabase\.co/i,
    /(?:postgres(?:ql)?|database):\/\/[^\s'"`]+/i,
    /(?:eyJ[a-zA-Z0-9_-]{10,}|sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,})/,
  ]) assert(!pattern.test(artifact), `P1D artifact contains forbidden remote/value pattern ${pattern}`)
}

const dollarQuotes = migration.match(/\$[a-z0-9_]*\$/gi) ?? []
const quoteCounts = new Map()
for (const quote of dollarQuotes) quoteCounts.set(quote, (quoteCounts.get(quote) ?? 0) + 1)
for (const [quote, count] of quoteCounts) assert.equal(count % 2, 0, `Unbalanced SQL dollar quote ${quote}`)

console.log(`F23.3E-P1D semantic smoke passed; migration SHA-256 ${p1dHash}`)
