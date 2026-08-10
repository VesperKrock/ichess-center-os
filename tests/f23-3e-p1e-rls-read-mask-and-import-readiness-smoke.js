import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationName = '202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql'
const migrationPath = join(root, 'supabase', 'migrations', migrationName)
const reportPath = join(root, 'docs', 'f23-3e-p1e-rls-read-mask-and-import-readiness.md')
const smokePath = join(root, 'tests', 'f23-3e-p1e-rls-read-mask-and-import-readiness-smoke.js')
const qaPath = join(root, 'tests', 'f23-3e-p1e-rls-read-mask-and-import-readiness-local-db-qa.js')
const toolPath = join(root, 'tools', 'f23-3e-p1e-localstorage-import-preview.js')
const cloudPath = join(root, 'src', 'cloud-db-sync.js')
const migration = readFileSync(migrationPath, 'utf8')
const report = readFileSync(reportPath, 'utf8')
const smoke = readFileSync(smokePath, 'utf8')
const qa = readFileSync(qaPath, 'utf8')
const tool = readFileSync(toolPath, 'utf8')
const cloud = readFileSync(cloudPath, 'utf8')
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
  ['202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql', 'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722'],
])
for (const [name, expected] of immutableHashes) {
  assert.equal(sha256(join(root, 'supabase', 'migrations', name)), expected, `Immutable migration changed: ${name}`)
  includesAll(report, [name, expected], `Report lacks immutable hash ${name}`)
}

const p1eHash = sha256(migrationPath)
assert.equal(
  p1eHash,
  '33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19',
  'P1E migration changed after external technical audit',
)
includesAll(report, [migrationName, p1eHash], 'Report lacks computed P1E migration hash')
assert(report.includes('F23_3E_P1E_FINAL_TECHNICAL_AUDIT: PASS'), 'P1E external audit closeout missing')

const checkpointVersion = 202608100003n
const migrationFilenamePattern = /^([0-9]+)_[a-z0-9_]+\.sql$/
const requiredMigrationNames = new Set([...immutableHashes.keys(), migrationName])
const actualMigrationNames = readdirSync(join(root, 'supabase', 'migrations'))
  .filter((name) => name.endsWith('.sql')).sort()
for (const name of actualMigrationNames) {
  const match = migrationFilenamePattern.exec(name)
  assert(match, `Invalid migration filename: ${name}`)
  if (BigInt(match[1]) <= checkpointVersion) {
    assert(requiredMigrationNames.has(name), `Unexpected migration at or before P1E checkpoint: ${name}`)
  }
}
for (const name of requiredMigrationNames) assert(actualMigrationNames.includes(name), `Missing checkpoint migration: ${name}`)
assert.deepEqual(
  actualMigrationNames.filter((name) => BigInt(migrationFilenamePattern.exec(name)[1]) === checkpointVersion),
  [migrationName],
  'P1E checkpoint must resolve to exactly one canonical migration',
)

const exactArtifacts = [
  `supabase/migrations/${migrationName}`,
  'docs/f23-3e-p1e-rls-read-mask-and-import-readiness.md',
  'tests/f23-3e-p1e-rls-read-mask-and-import-readiness-smoke.js',
  'tests/f23-3e-p1e-rls-read-mask-and-import-readiness-local-db-qa.js',
  'tools/f23-3e-p1e-localstorage-import-preview.js',
].sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'supabase', 'migrations')).filter((name) => name.includes('f23_3e_p1e')).map((name) => `supabase/migrations/${name}`),
  ...readdirSync(join(root, 'docs')).filter((name) => name.includes('f23-3e-p1e')).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.includes('f23-3e-p1e')).map((name) => `tests/${name}`),
  ...readdirSync(join(root, 'tools')).filter((name) => name.includes('f23-3e-p1e')).map((name) => `tools/${name}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P1E named artifacts drifted')

const crmTables = [
  'center_crm_control', 'crm_contact', 'consultation_case',
  'consultation_case_candidate_student', 'consultation_case_assignment', 'crm_care_log',
  'crm_conversion_request', 'crm_idempotency_registry', 'crm_audit_event', 'crm_outbox_event',
]
for (const table of crmTables) {
  includesAll(sql, [
    `alter table public.${table} enable row level security`,
    `alter table public.${table} force row level security`,
    `tablename = '${table}'`,
    `drop table public.${table}`,
  ], `${table} RLS/realtime remediation`)
}
includesAll(sql, [
  'revoke all privileges on table',
  'from public, anon, authenticated, service_role',
  'p1e_rls_fail_closed_begin', 'p1e_rls_fail_closed_end',
], 'Direct access remediation')
assert(!/create\s+policy/i.test(migration), 'P1E must not create a CRM RLS policy')
assert(!/alter\s+publication\s+supabase_realtime\s+add\s+table/i.test(migration), 'P1E adds realtime access')

const appRpcs = [
  ['f23_3e_p1e_list_crm_contacts_masked', 'uuid, text, timestamptz, uuid, integer'],
  ['f23_3e_p1e_list_consultation_cases_masked', 'uuid, text, timestamptz, uuid, integer'],
  ['f23_3e_p1e_get_consultation_case_masked', 'uuid, uuid'],
  ['f23_3e_p1e_list_case_care_logs', 'uuid, uuid, timestamptz, uuid, integer'],
  ['f23_3e_p1e_get_local_import_readiness', 'uuid, text'],
]
const functionBlock = (name) => {
  const start = sql.indexOf(`create function public.${name}(`)
  assert(start >= 0, `Missing function ${name}`)
  const tag = `$${name}$`
  const end = sql.indexOf(`${tag};`, start)
  assert(end > start, `Unterminated function ${name}`)
  return sql.slice(start, end + tag.length + 1)
}
for (const [name, signature] of appRpcs) {
  const block = functionBlock(name)
  includesAll(block, ['returns table (', 'security definer', "set search_path = ''"], `${name} typed/security contract`)
  assert(!/\bexecute\s+/i.test(block), `${name} contains dynamic SQL`)
  assert(sql.includes(`revoke all on function public.${name}(${signature})`), `${name} exact revoke missing`)
  assert(sql.includes(`grant execute on function public.${name}(${signature}) to service_role`), `${name} exact grant missing`)
}
assert.equal((sql.match(/create function public\.f23_3e_p1e_(?!internal_)/g) ?? []).length, 5)
assert.equal((sql.match(/grant execute on function public\.f23_3e_p1e_/g) ?? []).length, 5)
assert(!/grant execute on function public\.f23_3e_p1e_internal_/i.test(migration), 'Internal helper exposed')

const centerGate = functionBlock('f23_3e_p1e_internal_lock_center_read_role')
const caseGate = functionBlock('f23_3e_p1e_internal_lock_case_read_role')
for (const block of [centerGate, caseGate]) {
  includesAll(block, [
    "crm_state not in ('read_only', 'active')",
    "feature_flag_state not in ('read_only', 'enabled')",
    'from auth.users', 'for key share', 'from public.center_members', 'for share',
    "status <> 'active'", "'owner', 'center_admin', 'consultant'",
  ], 'Read gate/eligibility contract')
  assert(!block.includes('p_role'), 'Read gate accepts a caller role')
}
includesAll(caseGate, [
  'non-authoritative selector', 'from public.consultation_case',
  'active_assignment_id', "assignment_status <> 'active'",
  'assigned_consultant_user_id <> p_actor_user_id', "message = 'resource_not_found_or_denied'",
], 'Case assignment gate')

const contacts = functionBlock('f23_3e_p1e_list_crm_contacts_masked')
includesAll(contacts, [
  "v_role not in ('owner', 'center_admin')", "message = 'read_scope_denied'",
  "'masked_protected'::text", 'false', "'no_store'::text",
  '(c.updated_at, c.crm_contact_id) > (p_after_updated_at, p_after_contact_id)',
  'order by c.updated_at asc, c.crm_contact_id asc', 'limit p_limit', 'for share of c',
], 'Contact list contract')

const cases = functionBlock('f23_3e_p1e_list_consultation_cases_masked')
includesAll(cases, [
  "v_role in ('owner', 'center_admin')", "v_role = 'consultant'",
  'a.assigned_consultant_user_id = p_actor_user_id', "'masked_protected'::text", "'no_store'::text",
  '(c.updated_at, c.consultation_case_id) > (p_after_updated_at, p_after_case_id)',
  'order by c.updated_at asc, c.consultation_case_id asc', 'for share',
], 'Case list contract')

const detail = functionBlock('f23_3e_p1e_get_consultation_case_masked')
includesAll(detail, [
  'f23_3e_p1e_internal_lock_case_read_role', "'masked_protected'::text",
  "'no_store'::text", "message = 'resource_not_found_or_denied'",
], 'Case detail contract')
const logs = functionBlock('f23_3e_p1e_list_case_care_logs')
includesAll(logs, [
  'f23_3e_p1e_internal_lock_case_read_role', 'l.safe_content',
  '(l.created_at, l.care_log_id) > (p_after_created_at, p_after_care_log_id)',
  'order by l.created_at asc, l.care_log_id asc', "'no_store'::text",
], 'Care Log contract')
const readiness = functionBlock('f23_3e_p1e_get_local_import_readiness')
includesAll(readiness, [
  "'import_preview_denied'", "'import_preview_ready'", "'explicit_user_exported_json'",
  'true, false', "'owner', 'center_admin'", "'no_store'",
], 'Import readiness contract')

for (const block of [contacts, cases, detail]) {
  for (const forbidden of [
    'protected_contact_methods_ciphertext', 'contact_methods_crypto_version',
    'normalized_lookup_digests', 'normalization_version', 'legacy_source_id', 'import_batch_id',
    'birth_evidence_protected', 'action_graph_digest',
  ]) assert(!block.includes(forbidden), `Read projection selected forbidden ${forbidden}`)
}
assert(!/create function public\.f23_3e_p1e_[^(]*(?:reveal|decrypt|step_up|mfa)/i.test(migration), 'Forbidden reveal/decrypt endpoint exists')
assert(!/\boffset\b/i.test([contacts, cases, logs].join('\n')), 'Read path uses OFFSET')

const reserved = crmTables.map((table) => `'${table}'`)
includesAll(cloud, [
  'RESERVED_CANONICAL_CRM_ENTITY_TYPES', 'isReservedCanonicalCrmEntityType',
  'GENERIC_CLOUD_CANONICAL_CRM_ENTITY_DENIED', ...reserved,
], 'Generic cloud reserved inventory')
for (const name of ['listCloudEntities', 'upsertCloudEntities']) {
  const start = cloud.indexOf(`export async function ${name}`)
  const next = cloud.indexOf('\nexport ', start + 1)
  const block = cloud.slice(start, next < 0 ? cloud.length : next)
  assert(block.indexOf('denyGenericCanonicalCrmEntity(entityType)') >= 0, `${name} deny guard missing`)
  assert(block.indexOf('denyGenericCanonicalCrmEntity(entityType)') < block.indexOf(".from('center_cloud_entities')"), `${name} guard runs after remote operation`)
}

includesAll(tool, [
  "from 'node:crypto'", "from 'node:fs'", "from 'node:path'", "createHash('sha256')",
  'canonicalize', "Object.keys(value).sort()", 'Object.create(null)',
  'Object.defineProperty(result, key', 'enumerable: true', 'export_digest', 'record_digest',
  'legacy_source_id_digest', 'manifest_digest', 'ichessCenterOS.parentConsultations.',
  'CENTER_NAMESPACE_MISMATCH', 'DUPLICATE_LEGACY_ID_REVIEW_REQUIRED',
  'DIVERGENT_LOCAL_EDIT_REVIEW_REQUIRED', 'PRIOR_MANIFEST_DIGEST_MISMATCH',
  'LEGACY_STAGE_LEAD_CLAIM', 'LEGACY_STAGE_CONSULTING_CLAIM',
  'LEGACY_CONVERTED_CLAIM_REVIEW_REQUIRED', "proposed_action: 'REVIEW_ONLY'",
  'P1E_IMPORT_TOOL_AUTOMATIC_BROWSER_HARVEST: NO',
  'P1E_IMPORT_TOOL_DATABASE_WRITE: NO', 'P1E_IMPORT_TOOL_NETWORK_IO: NO',
  'P1E_LEGACY_CONVERTED_PROVES_CANONICAL_CONVERSION: NO',
], 'Import-preview tool contract')
for (const forbidden of [
  /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /createClient\s*\(/,
  /\.from\s*\(/, /\.rpc\s*\(/, /https?:\/\//, /randomUUID/, /writeFileSync/,
  /window\.localStorage/, /globalThis\.localStorage/, /document\.cookie/,
]) assert(!forbidden.test(tool), `Import tool contains forbidden capability ${forbidden}`)

const canonicalizeStart = tool.indexOf('const canonicalize = (value) =>')
const canonicalizeEnd = tool.indexOf('\nconst stableJson', canonicalizeStart)
assert(canonicalizeStart >= 0 && canonicalizeEnd > canonicalizeStart, 'Canonicalization block missing')
const canonicalizeBlock = tool.slice(canonicalizeStart, canonicalizeEnd)
assert(!canonicalizeBlock.includes('}, {})'), 'Canonicalization uses an ordinary object accumulator')
assert(!/result\s*\[\s*key\s*\]\s*=/.test(canonicalizeBlock), 'Canonicalization invokes a prototype-sensitive setter')
includesAll(qa, [
  '"__proto__"', "Object.hasOwn(prototypeSensitiveRecord, '__proto__')",
  "Object.hasOwn(prototypeSensitiveRecord, 'constructor')",
  "Object.hasOwn(prototypeSensitiveRecord, 'prototype')",
  'assert.notEqual(prototypeManifestA.export_digest, prototypeManifestB.export_digest)',
  'assert.notEqual(prototypeManifestA.records[0].record_digest, prototypeManifestB.records[0].record_digest)',
  "review_codes.includes('DIVERGENT_LOCAL_EDIT_REVIEW_REQUIRED')",
], 'Prototype-sensitive dynamic regression')

const qaMarkers = [
  'P1E_QA_DIRECT_AUTHENTICATED_TABLE_SELECT_DENIED: PASS',
  'P1E_QA_DIRECT_SERVICE_ROLE_TABLE_SELECT_DENIED: PASS', 'P1E_QA_ZERO_BROWSER_RLS_POLICIES: PASS',
  'P1E_QA_CRM_NOT_IN_REALTIME_PUBLICATION: PASS', 'P1E_QA_SERVICE_ROLE_READ_RPCS_EXACT: PASS',
  'P1E_QA_BROWSER_RPC_EXECUTE_DENIED: PASS', 'P1E_QA_INTERNAL_HELPERS_NOT_EXPOSED: PASS',
  'P1E_QA_OWNER_CENTER_WIDE_MASKED_CONTACT_READ: PASS', 'P1E_QA_CENTER_ADMIN_CENTER_WIDE_MASKED_CONTACT_READ: PASS',
  'P1E_QA_CONSULTANT_GLOBAL_CONTACT_LIST_DENIED: PASS', 'P1E_QA_OWNER_CASE_LIST_EXACT_CENTER: PASS',
  'P1E_QA_ADMIN_CASE_LIST_EXACT_CENTER: PASS', 'P1E_QA_CONSULTANT_ONLY_ASSIGNED_CASE: PASS',
  'P1E_QA_CONSULTANT_UNASSIGNED_CASE_HIDDEN: PASS', 'P1E_QA_FOREIGN_CENTER_CASE_HIDDEN: PASS',
  'P1E_QA_CASE_DETAIL_ASSIGNED_ONLY: PASS', 'P1E_QA_CARE_LOG_ASSIGNED_ONLY: PASS',
  'P1E_QA_INACTIVE_MEMBERSHIP_DENIED: PASS', 'P1E_QA_OTHER_ROLE_DENIED: PASS',
  'P1E_QA_ENDED_ASSIGNMENT_REMOVES_CONSULTANT_READ: PASS',
  'P1E_QA_REASSIGN_REMOVES_OLD_CONSULTANT_READ: PASS', 'P1E_QA_READ_ONLY_COHORT: PASS',
  'P1E_QA_P1D_MUTATION_GATE_UNCHANGED: PASS', 'P1E_QA_MASKING_BEFORE_SERIALIZATION: PASS',
  'P1E_QA_RAW_CONTACT_NEVER_RETURNED: PASS', 'P1E_QA_FULL_REVEAL_RPC_ABSENT: PASS',
  'P1E_QA_IMPORT_PREVIEW_DETERMINISTIC: PASS', 'P1E_QA_LEGACY_CONVERTED_REVIEW_ONLY: PASS',
  'P1E_QA_DUPLICATE_LEGACY_ID_REVIEW: PASS', 'P1E_QA_MALFORMED_EXPORT_FAILS_CLOSED: PASS',
  'P1E_QA_CENTER_NAMESPACE_MISMATCH_FAILS_CLOSED: PASS', 'P1E_QA_PARTIAL_EXPORT_FAILS_CLOSED: PASS',
  'P1E_QA_LOCAL_EDIT_AFTER_PREVIEW_REQUIRES_REVIEW: PASS', 'P1E_QA_IMPORT_PREVIEW_OUTPUT_PII_FREE: PASS',
  'P1E_QA_GENERIC_CLOUD_NON_CRM_UNCHANGED: PASS',
  'P1E_QA_PROTOTYPE_SENSITIVE_KEY_CHANGES_DIGEST: PASS',
  'P1E_QA_PROTOTYPE_SENSITIVE_DIVERGENCE_DETECTED: PASS',
  'P1E_QA_CANONICALIZATION_PROTOTYPE_SAFE: PASS',
  'P1E_QA_FINAL_LOCAL_RESET: PASS', 'P1E_QA_LEFTOVER_FIXTURE_COUNT:', 'P1E_QA_NONDEFAULT_ROOT_COUNT:',
]
includesAll(qa, qaMarkers, 'Local QA marker inventory')

const reportPrefix = [
  'F23_3E_P1E_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P1E_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1E_MIGRATION_CREATED: YES',
  'F23_3E_P1E_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1E_LOCAL_DB_SECURITY_QA: PASS',
  '',
  'F23_3E_P1E_RLS_READ_PATH_REMEDIATION: IMPLEMENTED IN REPO',
  'F23_3E_P1E_SERVER_MASKED_READ_RUNTIME: IMPLEMENTED IN REPO',
  'F23_3E_P1E_GENERIC_CLOUD_CRM_PATH: BLOCKED FAIL-CLOSED',
  'F23_3E_P1E_LOCALSTORAGE_IMPORT_PREVIEW_TOOL: IMPLEMENTED IN REPO',
  '',
  'F23_3E_P1E_PROTOTYPE_SENSITIVE_DIGEST_BLOCKER: CLOSED',
  '',
  'F23_3E_P1E_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1E_BROWSER_RUNTIME_WIRING: NOT STARTED',
  'F23_3E_P1E_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED',
  'F23_3E_P1E_FULL_CONTACT_STEP_UP_REVEAL: NOT IMPLEMENTED',
  'F23_3E_P1E_REAL_LOCALSTORAGE_IMPORT: NOT RUN',
  'F23_3E_P1E_REAL_CLOUD_IMPORT: NOT RUN',
  'F23_3E_P1E_AUTH_CHANGE: NO',
  'F23_3E_P1E_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1E_DEPLOY: NOT RUN',
  'F23_3E_P1E_REAL_DATA_CHANGE: NO',
].join('\n')
assert(report.startsWith(reportPrefix), 'Implementation report status prefix drift')
includesAll(report, [
  ...exactArtifacts, 'src/cloud-db-sync.js',
  'P1E_READ_ONLY_COHORT_SUPPORTED: YES', 'P1E_P1D_WRITE_GATE_CHANGED: NO',
  'P1E_MASKING_BEFORE_SERIALIZATION: YES', 'P1E_BROWSER_RECEIVES_RAW_CONTACT_THEN_MASKS: NO',
  'P1E_CONSULTANT_GLOBAL_CONTACT_LIST_ALLOWED: NO', 'P1E_FINAL_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'P1E_QA_FINAL_LOCAL_RESET: PASS', 'P1E_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P1E_QA_NONDEFAULT_ROOT_COUNT: 0', 'Remote action: NOT RUN',
  'External technical audit and focused re-audit: PASS', 'Focused blocker: CLOSED',
], 'Implementation report incomplete')

for (const pattern of [
  /insert\s+into\s+auth\./i, /update\s+auth\./i, /delete\s+from\s+auth\./i,
  /insert\s+into\s+public\.(?:guardians?|students?)/i,
  /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,100}\b(?:anon|authenticated)\b/i,
  /\bfetch\s*\(/i, /https?:\/\//i, /\bsupabase\s+db\s+(?:push|pull)\b/i,
]) assert(!pattern.test(migration), `Migration contains forbidden scope ${pattern}`)

const canonicalRoadmap = readFileSync(join(root, 'docs', 'f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md'), 'utf8')
const localRoadmap = readFileSync(join(root, 'RoadmapRealTime.txt'), 'utf8')
const p1eRoadmapLine = 'F23.3E-P1E DONE backend/local verified / Fail-closed CRM read path, service-only masked projections, generic cloud CRM deny guard và deterministic prototype-safe LocalStorage import-preview readiness; multi-account/security/fault QA PASS; chưa apply remote, chưa browser/final capability/full reveal/real import'
const historicalP1eMarker = '* Historical checkpoint compatibility note — non-current P1D-era marker: F23.3E-P1E TODO backend / RLS-read path remediation, server masking và LocalStorage import readiness'
const pendingRoadmapLines = [
  'F23.3E-P1F TODO QA / Direct API, multi-account, exact-center, concurrency, fault injection và rollout gates',
  'F23.3E-P2 TODO backend/design', 'F23.3E-P3 TODO backend', 'F23.3E-P4 TODO public/QA',
]
for (const roadmap of [canonicalRoadmap, localRoadmap]) {
  includesAll(roadmap, [p1eRoadmapLine, historicalP1eMarker, ...pendingRoadmapLines], 'P1E closeout roadmap drift')
  const currentP1eLines = roadmap.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line.startsWith('F23.3E-P1E '))
  assert.deepEqual(currentP1eLines, [p1eRoadmapLine], 'P1E roadmap must have exactly one current status line')
  assert.equal((roadmap.match(/F23\.3E-P1E TODO backend/g) ?? []).length, 1, 'P1E historical compatibility marker count drift')
}

assert(smoke.includes('202608100003n') && smoke.includes('BigInt'), 'Forward-compatible checkpoint guard missing')
console.log(`F23.3E-P1E semantic smoke passed (migration SHA-256 ${p1eHash})`)
