import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const resetConsentFlag = 'ICHESS_P1C_LOCAL_QA_ALLOW_RESET'
const linkedFlag = ['--', 'linked'].join('')
const migrationName = '202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql'
const migrationPath = join(root, 'supabase', 'migrations', migrationName)
const reportPath = join(root, 'docs', 'f23-3e-p1c-transactional-audit-and-durable-outbox-runtime.md')
const smokePath = join(root, 'tests', 'f23-3e-p1c-transactional-audit-and-durable-outbox-runtime-smoke.js')
const qaPath = join(root, 'tests', 'f23-3e-p1c-transactional-audit-and-durable-outbox-local-db-qa.js')
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
])
for (const [name, expected] of immutableHashes) {
  assert.equal(sha256(join(root, 'supabase', 'migrations', name)), expected, `Immutable migration changed: ${name}`)
  includesAll(report, [name, expected], `Report lacks immutable hash ${name}`)
}
const p1cHash = sha256(migrationPath)
assert.equal(
  p1cHash,
  '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA',
  'P1C migration changed after external technical audit',
)
includesAll(report, [migrationName, p1cHash], 'Report lacks P1C migration hash')

const checkpointVersion = 202608100001n
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
    assert(requiredMigrationNames.has(name), `Unexpected migration at or before P1C checkpoint: ${name}`)
  }
}
for (const name of requiredMigrationNames) {
  assert(actualMigrationNames.includes(name), `Missing required P1C checkpoint migration: ${name}`)
}
const checkpointMigrations = actualMigrationNames.filter((name) => {
  const match = migrationFilenamePattern.exec(name)
  return BigInt(match[1]) === checkpointVersion
})
assert.deepEqual(
  checkpointMigrations,
  [migrationName],
  'P1C checkpoint version must resolve to exactly the canonical P1C migration',
)

const exactArtifacts = [
  join('supabase', 'migrations', migrationName),
  join('docs', 'f23-3e-p1c-transactional-audit-and-durable-outbox-runtime.md'),
  join('tests', 'f23-3e-p1c-transactional-audit-and-durable-outbox-runtime-smoke.js'),
  join('tests', 'f23-3e-p1c-transactional-audit-and-durable-outbox-local-db-qa.js'),
].map((path) => path.replaceAll('\\', '/')).sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('f23_3e_p1c')).map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs')).filter((name) => name.includes('f23-3e-p1c')).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.includes('f23-3e-p1c')).map((name) => `tests/${name}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P1C must consist of exactly four artifacts')

const rpcs = [
  'f23_3e_p1c_list_crm_audit_events',
  'f23_3e_p1c_claim_outbox_batch',
  'f23_3e_p1c_ack_outbox_delivered',
  'f23_3e_p1c_fail_outbox_delivery',
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
  assert(!/\bexecute\s+(?:format|immediate|[a-z_])/i.test(block), `${name} contains dynamic SQL`)
  assert(sql.includes(`revoke all on function public.${name}(`), `${name} browser revoke missing`)
  assert(sql.includes(`grant execute on function public.${name}(`), `${name} service grant missing`)
}
assert.equal((sql.match(/grant execute on function public\.f23_3e_p1c_/g) ?? []).length, 4)
assert(!/grant execute on function public\.f23_3e_p1c_internal_/i.test(migration), 'Internal helper was exposed')
includesAll(sql, ['from public, anon, authenticated;', 'to service_role;'], 'Application RPC grant boundary incomplete')

includesAll(sql, [
  'add column last_attempt_at timestamptz',
  'add column last_failure_code text',
  'add column dead_lettered_at timestamptz',
  'crm_outbox_event_attempt_ceiling_check',
  'check (attempt_count <= 5)',
  "last_failure_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'",
  "(delivery_status = 'dead_letter') = (dead_lettered_at is not null)",
  'f23_3e_p1c_outbox_delivery_version_must_increment_by_one',
  'new.event_version is distinct from old.event_version',
  'new.safe_payload is distinct from old.safe_payload',
], 'Outbox forward schema/immutability incomplete')

const auditBlock = functionBlock('f23_3e_p1c_list_crm_audit_events')
includesAll(auditBlock, [
  'p_after_created_at timestamptz default null',
  'p_after_audit_event_id uuid default null',
  'p_limit integer default 50',
  "message = 'invalid_cursor'", 'p_limit < 1', 'p_limit > 100',
  'where a.center_id = p_center_id',
  'a.created_at > p_after_created_at',
  'a.created_at = p_after_created_at',
  'a.audit_event_id > p_after_audit_event_id',
  'order by a.created_at asc, a.audit_event_id asc',
], 'Audit keyset/exact-center contract incomplete')
assert(!/\boffset\b/.test(auditBlock), 'Audit RPC uses offset pagination')
assert(!/select\s+a\.\*/.test(auditBlock), 'Audit RPC has a generic projection')
const safeAuditFields = [
  'audit_event_id uuid', 'center_id text', 'event_type text', 'actor_user_id uuid',
  'resource_kind text', 'resource_id uuid', 'request_id uuid', 'assignment_id uuid',
  'previous_version integer', 'new_version integer', 'safe_reason_code text',
  'correlation_id uuid', 'created_at timestamptz',
]
includesAll(auditBlock, safeAuditFields, 'Audit typed projection incomplete')

const claimBlock = functionBlock('f23_3e_p1c_claim_outbox_batch')
includesAll(claimBlock, [
  "p_worker_id !~ '^[a-za-z0-9][a-za-z0-9._:-]{0,127}$'",
  'p_limit < 1', 'p_limit > 100', 'p_lease_seconds < 5', 'p_lease_seconds > 300',
  'pg_catalog.clock_timestamp()', 'for share',
  "v_root.crm_state <> 'active'", "v_root.feature_flag_state <> 'enabled'",
  'for update skip locked', 'pg_catalog.gen_random_uuid()',
  'attempt_count = o.attempt_count + 1', 'last_attempt_at = v_now',
  'delivery_version = o.delivery_version + 1',
  'order by o.available_at asc, o.created_at asc, o.outbox_event_id asc',
  "o.delivery_status in ('pending', 'retry')", "o.delivery_status = 'claimed'",
  'o.claim_expires_at <= v_now', 'o.attempt_count < 5',
  "last_failure_code = 'lease_expired_after_max_attempts'",
], 'Claim contract incomplete')
assert(claimBlock.indexOf('for share') < claimBlock.indexOf('v_now := pg_catalog.clock_timestamp()'), 'Claim clock must be sampled after the root lock')
assert(!/set[\s\S]{0,160}\bevent_version\s*=/.test(claimBlock), 'Claim mutates event_version')
for (const forbiddenTimeInput of ['p_now', 'p_claimed_at', 'p_claim_expires_at', 'p_delivered_at', 'p_dead_lettered_at']) {
  assert(!claimBlock.includes(forbiddenTimeInput), `Claim accepts caller time ${forbiddenTimeInput}`)
}

const ackBlock = functionBlock('f23_3e_p1c_ack_outbox_delivered')
includesAll(ackBlock, [
  'p_outbox_event_id uuid', 'p_claim_id uuid', 'p_worker_id text',
  'p_expected_delivery_version integer', 'for share', 'for update',
  "v_event.delivery_status <> 'claimed'", 'v_event.claim_id is distinct from p_claim_id',
  'v_event.claimed_by is distinct from p_worker_id',
  'v_event.delivery_version <> p_expected_delivery_version',
  'v_event.claim_expires_at <= v_now', "delivery_status = 'delivered'",
  'delivered_at = v_now', 'delivery_version = o.delivery_version + 1',
  "'delivered'::text", "'resource_not_found'::text", "'claim_mismatch'::text",
  "'claim_expired'::text", "'delivery_version_stale'::text",
  "'outbox_state_conflict'::text", "'crm_runtime_not_active'::text", "'invalid_input'::text",
], 'ACK CAS/outcomes incomplete')
assert(!/set[\s\S]{0,160}\bevent_version\s*=/.test(ackBlock), 'ACK mutates event_version')

const failBlock = functionBlock('f23_3e_p1c_fail_outbox_delivery')
includesAll(failBlock, [
  "p_failure_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$'",
  'p_retry_after_seconds < 1', 'p_retry_after_seconds > 86400',
  'v_event.delivery_version <> p_expected_delivery_version',
  "v_event.delivery_status <> 'claimed'", 'v_event.claim_id is distinct from p_claim_id',
  'v_event.claimed_by is distinct from p_worker_id', 'v_event.claim_expires_at <= v_now',
  'if v_event.attempt_count < 5 then', "delivery_status = 'retry'",
  "'retry_scheduled'::text", 'if v_event.attempt_count = 5 then',
  "delivery_status = 'dead_letter'", 'dead_lettered_at = v_now',
  "'dead_lettered'::text", 'delivery_version = o.delivery_version + 1',
], 'Failure/retry/dead-letter contract incomplete')
assert(!/set[\s\S]{0,160}\bevent_version\s*=/.test(failBlock), 'Failure RPC mutates event_version')

const reportPrefix = [
  'F23_3E_P1C_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P1C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1C_MIGRATION_CREATED: YES',
  'F23_3E_P1C_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1C_LOCAL_DB_BEHAVIOR_QA: PASS',
  'F23_3E_P1C_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1C_NETWORK_DELIVERY: NOT IMPLEMENTED',
  'F23_3E_P1C_WORKER_DEPLOY: NOT RUN',
  'F23_3E_P1C_BROWSER_RUNTIME_WIRING: NOT STARTED',
  'F23_3E_P1C_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED',
  'F23_3E_P1C_AUTH_CHANGE: NO',
  'F23_3E_P1C_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1C_DEPLOY: NOT RUN',
  'F23_3E_P1C_REAL_DATA_CHANGE: NO',
].join('\n')
assert(report.startsWith(reportPrefix), 'Implementation report status prefix drift')
includesAll(report, [
  'P1C_AUDIT_READ_STABLE_KEYSET_CURSOR: YES',
  'P1C_AUDIT_READ_EXACT_CENTER: YES',
  'P1C_AUDIT_READ_RETURNS_RAW_PII: NO',
  'P1C_AUDIT_READ_USES_OFFSET_PAGINATION: NO',
  'P1C_OUTBOX_EVENT_VERSION_MUTABLE_DURING_DELIVERY: NO',
  'P1C_OUTBOX_SAFE_PAYLOAD_MUTABLE_DURING_DELIVERY: NO',
  'P1C_OUTBOX_DELIVERY_VERSION_USED_FOR_CAS: YES',
  'P1C_OUTBOX_MAX_DELIVERY_ATTEMPTS: 5',
  'P1C_CALLER_CONTROLS_ABSOLUTE_SERVER_TIME: NO',
  'P1C_LEASE_USES_SERVER_TIME: YES',
  'P1C_RETRY_AVAILABLE_AT_USES_SERVER_TIME: YES',
  'P1C_OUTBOX_CLAIM_USES_SKIP_LOCKED: YES',
  'P1C_OUTBOX_TWO_WORKERS_CAN_CLAIM_DISJOINT_ROWS: YES',
  'P1C_OUTBOX_UNEXPIRED_CLAIM_RECLAIM_ALLOWED: NO',
  'P1C_OUTBOX_ATTEMPT_SIX_ALLOWED: NO',
  'P1C_OUTBOX_RETRY_AFTER_ATTEMPT_4_ALLOWED: YES',
  'P1C_OUTBOX_RETRY_AFTER_ATTEMPT_5_ALLOWED: NO',
  'P1C_OUTBOX_DEAD_LETTER_AFTER_FAILED_ATTEMPT_5: YES',
  'P1C_OUTBOX_DATABASE_CLAIM_AT_MOST_ONE_ACTIVE_LEASE_PER_EVENT: YES',
  'P1C_NETWORK_DELIVERY_EXACTLY_ONCE: NO',
  'P1C_DELIVERY_MODEL: AT_LEAST_ONCE',
  'P1C_CONSUMER_MUST_BE_IDEMPOTENT: YES',
  'P1C_QA_FINAL_LOCAL_RESET: PASS',
  'P1C_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P1C_QA_NONDEFAULT_ROOT_COUNT: 0',
  'Remote action: NOT RUN',
  'Network delivery: NOT IMPLEMENTED',
  ...exactArtifacts,
], 'Implementation report incomplete')

const p1cRoadmapLine = 'F23.3E-P1C DONE backend/local verified / Transactional Audit và durable Outbox'
includesAll(localRoadmap, [p1cRoadmapLine, 'F23.3E-P3 DONE backend/local verified', 'F23.3E-P4A DONE backend/local verified'], 'Current P1C roadmap state drift')
assert.equal(localRoadmap.split('F23.3E-P1C DONE backend/local verified').length - 1, 1, 'P1C must have exactly one current DONE status')
assert(canonicalRoadmap.includes('F23.3E-P1C DONE backend/local verified'), 'Historical P1C closeout evidence drifted')

const qaMarkers = [
  'P1C_QA_AUDIT_EXACT_CENTER: PASS', 'P1C_QA_AUDIT_SAFE_PROJECTION: PASS',
  'P1C_QA_AUDIT_KEYSET_FIRST_PAGE: PASS', 'P1C_QA_AUDIT_KEYSET_NEXT_PAGE_NO_DUPLICATE: PASS',
  'P1C_QA_AUDIT_CURSOR_TIE_BREAK_UUID: PASS', 'P1C_QA_AUDIT_INVALID_CURSOR_REJECTED: PASS',
  'P1C_QA_AUDIT_LIMIT_BOUND: PASS', 'P1C_QA_AUDIT_BROWSER_EXECUTE_DENIED: PASS',
  'P1C_QA_OUTBOX_CLAIM_BATCH: PASS', 'P1C_QA_OUTBOX_CLAIM_LIMIT: PASS',
  'P1C_QA_OUTBOX_DETERMINISTIC_ORDER: PASS', 'P1C_QA_OUTBOX_FUTURE_AVAILABLE_NOT_CLAIMED: PASS',
  'P1C_QA_OUTBOX_UNEXPIRED_CLAIM_NOT_RECLAIMED: PASS', 'P1C_QA_OUTBOX_EVENT_VERSION_IMMUTABLE: PASS',
  'P1C_QA_OUTBOX_DELIVERY_VERSION_PLUS_ONE: PASS', 'P1C_QA_INACTIVE_ROOT_DENIES_CLAIM: PASS',
  'P1C_QA_ACK_DELIVERED: PASS', 'P1C_QA_ACK_WRONG_CLAIM_DENIED: PASS',
  'P1C_QA_ACK_WRONG_WORKER_DENIED: PASS', 'P1C_QA_ACK_STALE_DELIVERY_VERSION_DENIED: PASS',
  'P1C_QA_ACK_EXPIRED_LEASE_DENIED: PASS', 'P1C_QA_DOUBLE_ACK_DENIED: PASS',
  'P1C_QA_FAILURE_SCHEDULES_RETRY: PASS', 'P1C_QA_RETRY_CLEARS_ACTIVE_CLAIM: PASS',
  'P1C_QA_RETRY_NOT_AVAILABLE_EARLY: PASS', 'P1C_QA_SAFE_FAILURE_CODE_ONLY: PASS',
  'P1C_QA_DEAD_LETTER_AFTER_FIFTH_FAILURE: PASS', 'P1C_QA_DEAD_LETTER_NOT_RECLAIMED: PASS',
  'P1C_QA_ATTEMPT_SIX_IMPOSSIBLE: PASS', 'P1C_QA_EXPIRED_LEASE_RECLAIM: PASS',
  'P1C_QA_OLD_CLAIM_REJECTED_AFTER_RECLAIM: PASS',
  'P1C_QA_CONCURRENT_WORKERS_DISJOINT_CLAIMS: PASS',
  'P1C_QA_CONCURRENT_SINGLE_EVENT_ONE_WINNER: PASS',
  'P1C_QA_CONCURRENT_RECLAIM_ONE_WINNER: PASS',
  'P1C_QA_CONCURRENT_ACK_VS_FAIL_ONE_WINNER: PASS',
  'P1C_QA_CONCURRENT_STALE_ACK_VS_RECLAIM_SAFE: PASS',
  'P1C_QA_CLAIM_BATCH_FAULT_ROLLS_BACK_ALL: PASS',
  'P1C_QA_FINAL_LOCAL_RESET: PASS', 'P1C_QA_LEFTOVER_FIXTURE_COUNT:',
  'P1C_QA_NONDEFAULT_ROOT_COUNT:',
]
includesAll(qa, qaMarkers, 'QA runner marker inventory incomplete')
includesAll(qa, [
  "const expectedContainerName = 'supabase_db_ichess-center-os'", resetConsentFlag,
  "localArgs('db reset')", "localArgs('status -o json')", 'assertLoopback',
  "labels['com.supabase.cli.project']", "labels['com.docker.compose.project']",
  "'docker', psqlArgs()", 'pg_advisory_lock', 'finally {',
  'fixture_count', 'assert.equal(post.fixture_count, 0)', 'nondefault_root_count',
], 'QA runner safety/concurrency/cleanup controls incomplete')
assert(!qa.includes(linkedFlag), 'Runner contains a linked-project command/flag literal')

for (const pattern of [
  /\bsupabase\s+db\s+(?:push|pull)\b/i,
  /\bsupabase\s+migration\s+(?:repair|up)\b/i,
  /\bsupabase\s+db\s+reset\s+[^\n]*linked/i,
  /https?:\/\/[a-z0-9-]+\.supabase\.co/i,
  /(?:postgres(?:ql)?|database):\/\/[^\s'"`]+/i,
  /(?:eyJ[a-zA-Z0-9_-]{10,}|sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,})/,
]) assert(!pattern.test(qa), `QA runner contains forbidden remote/value pattern ${pattern}`)

const operationalArtifacts = [migration, report, qa]
const forbiddenOperationalPatterns = [
  /\bfetch\s*\(/i,
  /\bcurl\b/i,
  /\bwebhook\b/i,
  /https?:\/\/[a-z0-9-]+\.supabase\.co/i,
  /\bsupabase\s+db\s+(?:push|pull)\b/i,
  /\bsupabase\s+migration\s+repair\b/i,
  /\bproduction[- ]ready\b/i,
]
for (const artifact of operationalArtifacts) {
  for (const pattern of forbiddenOperationalPatterns) {
    assert(!pattern.test(artifact), `P1C artifact contains forbidden operational content ${pattern}`)
  }
  assert(!/(?:password|secret[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*[^\s'"`]{6,}/i.test(artifact), 'Assigned secret-like value found')
  assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(artifact), 'Raw phone-like value found')
  assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(artifact), 'Raw email-like value found')
}

const forbiddenClaims = [
  'F23_3E_P1C_REMOTE_APPLY: RUN',
  'F23_3E_P1C_NETWORK_DELIVERY: IMPLEMENTED',
  'F23_3E_P1C_WORKER_DEPLOY: RUN',
  'F23_3E_P1C_BROWSER_RUNTIME_WIRING: DONE',
  'F23_3E_P1C_FINAL_CAPABILITY_ENFORCEMENT: DONE',
  'F23_3E_P1C_BROWSER_CALLABLE: YES',
  'P1C_NETWORK_DELIVERY_EXACTLY_ONCE: YES',
  'P1C_OUTBOX_ATTEMPT_SIX_ALLOWED: YES',
]
for (const claim of forbiddenClaims) assert(!report.includes(claim), `Forbidden report claim: ${claim}`)

const mojibakeMarkers = [
  [0x43, 0x102, 0xa1, 0xc2, 0xba],
  [0x102, 0x192],
  [0x102, 0x2020, 0xc2, 0xb0],
  [0x48, 0x102, 0xa1, 0xc2, 0xba],
  [0x102, 0xa1, 0xc2, 0xbb],
].map((points) => String.fromCodePoint(...points))
for (const artifact of [migration, report, smoke, qa]) {
  for (const marker of mojibakeMarkers) {
    assert(!artifact.includes(marker), `Mojibake marker present: ${marker}`)
  }
}

const dollarQuotes = migration.match(/\$[a-z0-9_]*\$/gi) ?? []
const quoteCounts = new Map()
for (const quote of dollarQuotes) quoteCounts.set(quote, (quoteCounts.get(quote) ?? 0) + 1)
for (const [quote, count] of quoteCounts) assert.equal(count % 2, 0, `Unbalanced SQL dollar quote ${quote}`)

console.log(`F23.3E-P1C semantic smoke passed; migration SHA-256 ${p1cHash}`)
