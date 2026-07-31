import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const resetConsentFlag = 'ICHESS_P1B_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')
const migrationName = '202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql'
const migrationPath = join(root, 'supabase', 'migrations', migrationName)
const reportPath = join(root, 'docs', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime.md')
const smokePath = join(root, 'tests', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime-smoke.js')
const qaPath = join(root, 'tests', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-local-db-qa.js')
const migration = readFileSync(migrationPath, 'utf8')
const report = readFileSync(reportPath, 'utf8')
const smoke = readFileSync(smokePath, 'utf8')
const qa = readFileSync(qaPath, 'utf8')
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
])
for (const [name, expected] of immutableHashes) {
  assert.equal(sha256(join(root, 'supabase', 'migrations', name)), expected, `Immutable migration changed: ${name}`)
  includesAll(report, [name, expected], `Report lacks immutable hash ${name}`)
}
const p1bHash = sha256(migrationPath)
assert.equal(p1bHash, 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F')
includesAll(report, [migrationName, p1bHash], 'Report lacks P1B migration hash')

const checkpointVersion = 202607310002n
const migrationFilenamePattern = /^([0-9]+)_[a-z0-9_]+\.sql$/
const requiredMigrationNames = new Set([...immutableHashes.keys(), migrationName])
const actualMigrationNames = readdirSync(join(root, 'supabase', 'migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const name of actualMigrationNames) {
  const match = migrationFilenamePattern.exec(name)
  assert(match, `Invalid migration filename: ${name}`)
  const version = BigInt(match[1])
  if (version <= checkpointVersion) {
    assert(requiredMigrationNames.has(name), `Unexpected migration at or before P1B checkpoint: ${name}`)
  }
}

for (const name of requiredMigrationNames) {
  assert(actualMigrationNames.includes(name), `Missing required P1B checkpoint migration: ${name}`)
}

const checkpointMigrations = actualMigrationNames.filter((name) => {
  const match = migrationFilenamePattern.exec(name)
  return BigInt(match[1]) === checkpointVersion
})
assert.deepEqual(
  checkpointMigrations,
  [migrationName],
  'P1B checkpoint version must resolve to exactly the canonical P1B migration',
)

const exactArtifacts = [
  join('supabase', 'migrations', migrationName),
  join('docs', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime.md'),
  join('tests', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime-smoke.js'),
  join('tests', 'f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-local-db-qa.js'),
].map((p) => p.replaceAll('\\', '/')).sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((n) => n.includes('f23_3e_p1b')).map((n) => `supabase/migrations/${n}`),
  ...readdirSync(join(root, 'docs')).filter((n) => n.includes('f23-3e-p1b')).map((n) => `docs/${n}`),
  ...readdirSync(join(root, 'tests')).filter((n) => n.includes('f23-3e-p1b')).map((n) => `tests/${n}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P1B must consist of exactly four artifacts')

const rpcs = [
  'f23_3e_p1b_create_conversion_draft',
  'f23_3e_p1b_update_conversion_draft',
  'f23_3e_p1b_submit_conversion_draft',
  'f23_3e_p1b_cancel_conversion_request',
  'f23_3e_p1b_get_conversion_request_status',
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
  includesAll(block, ['security definer', "set search_path = ''"], `${name} security`)
  assert(sql.includes(`revoke all on function public.${name}(`), `${name} browser revoke missing`)
  assert(sql.includes(`grant execute on function public.${name}(`), `${name} service grant missing`)
}
assert.equal((sql.match(/grant execute on function public\.f23_3e_p1b_/g) ?? []).length, 5)
assert(!/grant execute on function public\.f23_3e_p1b_internal_/i.test(migration), 'Internal helper was exposed')
includesAll(sql, [
  'from public, anon, authenticated;', 'to service_role;',
  "v_root.crm_state <> 'active'", "v_root.feature_flag_state <> 'enabled'",
  "'crm_runtime_not_active'", 'for key share',
], 'Security/runtime gate incomplete')
assert(!/update\s+public\.center_crm_control[\s\S]{0,180}(?:crm_state|feature_flag_state)/i.test(migration), 'RPC must not self-activate a center root')

includesAll(sql, [
  'add column request_intent_digest bytea', 'add column result_request_id uuid',
  'add column result_request_version integer', 'add column result_case_version integer',
  'add column result_request_status text', 'add column result_outcome_code text',
  'add column result_correlation_id uuid',
  'crm_idempotency_registry_completed_result_snapshot_check',
  'crm_idempotency_registry_result_request_exact_center_fkey',
  'f23_3e_p1b_terminal_result_snapshot_is_immutable',
  'source_assignment_id uuid not null',
  'crm_conversion_request_source_assignment_exact_center_fkey',
  'extensions.digest(', "'sha256'", 'delivery_version integer not null default 1',
  'crm_outbox_event_conversion_request_version_uidx',
], 'Typed snapshot/hash/assignment/outbox extension incomplete')
assert(!/\bmd5\s*\(/i.test(migration), 'MD5 is forbidden')

const lockBlocks = [
  'create_draft_runtime_atomic', 'update_draft_runtime_atomic',
  'submit_review_runtime_atomic', 'cancel_request_runtime_atomic',
]
for (const marker of lockBlocks) {
  const block = sql.slice(sql.indexOf(`${marker}_begin`), sql.indexOf(`${marker}_end`) + marker.length + 4)
  const ordered = [
    'center_crm_control_row', 'auth_user_existence_row', 'idempotency_registry_and_',
    'crm_contact_and_consultation_case_rows', 'current_assignment_row',
    'audit_outbox_rows', 'commit_atomic',
  ]
  let cursor = -1
  for (const item of ordered) {
    const next = block.indexOf(item)
    assert(next > cursor, `${marker} lock order drift at ${item}`)
    cursor = next
  }
}
for (const name of rpcs.slice(0, 4)) {
  const block = functionBlock(name)
  if (name !== 'f23_3e_p1b_create_conversion_draft') {
    assert(block.indexOf('from public.crm_conversion_request') < block.indexOf('from public.crm_contact'), `${name} locks Case/Contact before Request`)
  }
  const audit = block.lastIndexOf('insert into public.crm_audit_event')
  const outbox = block.lastIndexOf('insert into public.crm_outbox_event')
  const completion = block.lastIndexOf("set status = 'completed'")
  assert(audit >= 0 && audit < outbox && outbox < completion, `${name} atomic completion order drift`)
}

for (const protectedStatus of ['APPROVED', 'EXECUTING', 'COMPLETED', 'COMPENSATION_REQUIRED']) {
  const pattern = new RegExp(`update\\s+public\\.crm_conversion_request[\\s\\S]{0,260}?set\\s+status\\s*=\\s*'${protectedStatus}'`, 'i')
  assert(!pattern.test(migration), `P1B RPC reaches protected Request status ${protectedStatus}`)
}
includesAll(sql, [
  "'draft_created'", "'draft_updated'", "'review_submitted'", "'request_cancelled'",
  "'idempotency_conflict'", "'active_request_conflict'", "'actor_not_assigned'",
  "'source_version_stale'", "'request_version_stale'", "'request_state_conflict'",
  "'request_digest_stale'", "'assignment_version_stale'", "'resource_not_found'", "'invalid_input'",
], 'Typed outcomes incomplete')

const reportPrefix = [
  'F23_3E_P1B_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P1B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1B_MIGRATION_CREATED: YES',
  'F23_3E_P1B_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1B_LOCAL_DB_BEHAVIOR_QA: PASS',
  'F23_3E_P1B_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1B_BROWSER_RUNTIME_WIRING: NOT STARTED',
  'F23_3E_P1B_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED',
  'F23_3E_P1B_APPROVAL_EXECUTOR: NOT STARTED',
  'F23_3E_P1B_REAL_CONVERSION: NOT IMPLEMENTED',
  'F23_3E_P1B_AUTH_CHANGE: NO',
  'F23_3E_P1B_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1B_DEPLOY: NOT RUN',
  'F23_3E_P1B_REAL_DATA_CHANGE: NO',
].join('\n')
assert(report.startsWith(reportPrefix), 'Implementation report status prefix drift')
includesAll(report, [
  'F23_3E_P1B_BROWSER_CALLABLE: NO',
  'P1B_ACTOR_PARAMETER_IS_END_USER_AUTHORITY: NO',
  'P1B_AUTH_USERS_LOCK_EQUALS_ACCOUNT_SECURITY_CONTROL: NO',
  'P1B_REPLAY_RETURNS_CURRENT_REQUEST_STATE_INSTEAD_OF_PRIOR_RESULT: NO',
  'P1B_BUSINESS_AUDIT_OUTBOX_IDEMPOTENCY_ATOMIC: YES',
  'P1B_QA_FINAL_LOCAL_RESET: PASS', 'P1B_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'Remote action: NOT RUN', ...exactArtifacts,
], 'Implementation report incomplete')

const qaMarkers = [
  'P1B_QA_BROWSER_RPC_EXECUTE_DENIED: PASS', 'P1B_QA_SERVICE_ROLE_RPC_GRANTS_EXACT: PASS',
  'P1B_QA_HELPER_FUNCTIONS_NOT_EXPOSED: PASS', 'P1B_QA_PLANNED_DISABLED_ROOT_DENIES_MUTATION: PASS',
  'P1B_QA_ACTIVE_ENABLED_TEST_ROOT_ALLOWS_MUTATION: PASS', 'P1B_QA_CREATE_DRAFT: PASS',
  'P1B_QA_SAME_KEY_SAME_INTENT_REPLAY: PASS', 'P1B_QA_SAME_KEY_DIFFERENT_INTENT_CONFLICT: PASS',
  'P1B_QA_ONE_ACTIVE_REQUEST: PASS', 'P1B_QA_ACTOR_MUST_BE_CURRENT_ASSIGNEE: PASS',
  'P1B_QA_CONTACT_CASE_ASSIGNMENT_EXACT_CENTER: PASS', 'P1B_QA_SOURCE_VERSION_STALE_FAILS_CLOSED: PASS',
  'P1B_QA_ASSIGNMENT_VERSION_STALE_FAILS_CLOSED: PASS', 'P1B_QA_UPDATE_DRAFT: PASS',
  'P1B_QA_SUBMIT_REVIEW: PASS', 'P1B_QA_CANCEL_DRAFT: PASS',
  'P1B_QA_CANCEL_READY_FOR_REVIEW: PASS', 'P1B_QA_PROTECTED_STATUSES_UNREACHABLE: PASS',
  'P1B_QA_REQUEST_AUDIT_OUTBOX_IDEMPOTENCY_ATOMIC: PASS', 'P1B_QA_REPLAY_HAS_NO_DUPLICATE_EVENTS: PASS',
  'P1B_QA_FORCED_AUDIT_FAILURE_ROLLS_BACK: PASS', 'P1B_QA_FORCED_OUTBOX_FAILURE_ROLLS_BACK: PASS',
  'P1B_QA_EXACT_PRIOR_RESULT_SNAPSHOT: PASS', 'P1B_QA_CONCURRENT_SAME_KEY_REPLAY: PASS',
  'P1B_QA_CONCURRENT_DIFFERENT_INTENT_CONFLICT: PASS', 'P1B_QA_CONCURRENT_ACTIVE_REQUEST_CONFLICT: PASS',
  'P1B_QA_CONCURRENT_UPDATE_VS_SUBMIT: PASS', 'P1B_QA_CONCURRENT_SUBMIT_VS_CANCEL: PASS',
  'P1B_QA_CONCURRENT_ASSIGNMENT_CHANGE_RECHECK: PASS', 'P1B_QA_FINAL_LOCAL_RESET: PASS',
  'P1B_QA_LEFTOVER_FIXTURE_COUNT:',
]
includesAll(qa, qaMarkers, 'QA runner marker inventory incomplete')
includesAll(qa, [
  "const expectedContainerName = 'supabase_db_ichess-center-os'", resetConsentFlag,
  "localArgs('db reset')", "localArgs('status -o json')", 'assertLoopback',
  "labels['com.supabase.cli.project']", "labels['com.docker.compose.project']",
  "'docker', psqlArgs()", 'pg_advisory_lock', 'ASSIGNMENT_ROOT_LOCKED',
  'finally {', 'fixture_count', 'assert.equal(post.fixture_count, 0)', 'nondefault_root_count',
], 'QA runner safety/concurrency/cleanup controls incomplete')
assert(!qa.includes(linkedFlag), 'Runner contains a linked-project command/flag literal')
for (const pattern of [
  /\bsupabase\s+db\s+(?:push|pull)\b/i,
  /\bsupabase\s+migration\s+(?:repair|up)\b/i,
  /\bsupabase\s+db\s+reset\s+[^\n]*linked/i,
  /https?:\/\/[a-z0-9-]+\.supabase\.co/i,
  /(?:postgres(?:ql)?|database):\/\/[^\s'"`]+/i,
  /(?:eyJ[a-zA-Z0-9_-]{10,}|sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,})/,
]) assert(!pattern.test(qa), `QA runner contains forbidden remote/credential pattern ${pattern}`)

const forbiddenClaims = [
  'F23_3E_P1B_REMOTE_APPLY: RUN',
  'F23_3E_P1B_BROWSER_RUNTIME_WIRING: DONE', 'F23_3E_P1B_FINAL_CAPABILITY_ENFORCEMENT: DONE',
  'F23_3E_P1B_APPROVAL_EXECUTOR: DONE', 'F23_3E_P1B_REAL_CONVERSION: IMPLEMENTED',
  'F23_3E_P1B_BROWSER_CALLABLE: YES', 'P1B_ACTOR_PARAMETER_IS_END_USER_AUTHORITY: YES',
  'P1B_AUTH_USERS_LOCK_EQUALS_ACCOUNT_SECURITY_CONTROL: YES',
  'P1B_REPLAY_RETURNS_CURRENT_REQUEST_STATE_INSTEAD_OF_PRIOR_RESULT: YES',
]
for (const claim of forbiddenClaims) assert(!report.includes(claim), `Forbidden report claim: ${claim}`)

const artifacts = [migration, report, smoke, qa]
const mojibakeMarkers = [
  [0x43, 0x102, 0xa1, 0xc2, 0xba],
  [0x102, 0x192],
  [0x102, 0x2020, 0xc2, 0xb0],
  [0x48, 0x102, 0xa1, 0xc2, 0xba],
  [0x102, 0xa1, 0xc2, 0xbb],
  [0x42, 0x75, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xa2, 0x69,
    0x20, 0x68, 0x102, 0xa1, 0xc2, 0xbb, 0xc2, 0x8d, 0x63, 0x20,
    0x6d, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xba, 0x69],
].map((points) => String.fromCodePoint(...points))
for (const artifact of artifacts) {
  for (const marker of mojibakeMarkers) {
    assert(!artifact.includes(marker), `Mojibake marker present: ${marker}`)
  }
  assert(!/(?:password|secret[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*[^\s'"`]{6,}/i.test(artifact), 'Assigned credential-like value found')
  assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(artifact), 'Raw phone-like value found')
  assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(artifact), 'Raw email-like value found')
}

const dollarQuotes = migration.match(/\$[a-z0-9_]*\$/gi) ?? []
const counts = new Map()
for (const quote of dollarQuotes) counts.set(quote, (counts.get(quote) ?? 0) + 1)
for (const [quote, count] of counts) assert.equal(count % 2, 0, `Unbalanced SQL dollar quote ${quote}`)

console.log(`F23.3E-P1B semantic smoke passed; migration SHA-256 ${p1bHash}`)
