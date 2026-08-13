import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationDirectory = path.join(root, 'supabase', 'migrations')
const migrationName = '202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql'
const migrationPath = path.join(migrationDirectory, migrationName)
const reportPath = path.join(root, 'docs', 'f23-3e-p1a-canonical-crm-schema-and-control-root.md')
const smokePath = path.join(root, 'tests', 'f23-3e-p1a-canonical-crm-schema-and-control-root-smoke.js')
const qaRunnerName = 'f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js'
const qaRunnerPath = path.join(root, 'tests', qaRunnerName)
const canonicalRoadmapPath = path.join(root, 'docs', 'f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const localRoadmapPath = path.join(root, 'RoadmapRealTime.txt')
const read = (absolutePath) => fs.readFileSync(absolutePath, 'utf8')

const appliedMigrationHashes = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
])

for (const [name, expectedHash] of appliedMigrationHashes) {
  const content = fs.readFileSync(path.join(migrationDirectory, name))
  const actualHash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase()
  assert.equal(actualHash, expectedHash, `Applied migration SHA-256 drift: ${name}`)
}

const checkpointVersion = 202607310001n
const migrationFilenamePattern = /^([0-9]+)_[a-z0-9_]+\.sql$/
const requiredMigrationNames = new Set([...appliedMigrationHashes.keys(), migrationName])
const actualMigrationNames = fs.readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const name of actualMigrationNames) {
  const match = migrationFilenamePattern.exec(name)
  assert(match, `Invalid migration filename: ${name}`)
  const version = BigInt(match[1])
  if (version <= checkpointVersion) {
    assert(requiredMigrationNames.has(name), `Unexpected migration at or before P1A checkpoint: ${name}`)
  }
}

for (const name of requiredMigrationNames) {
  assert(actualMigrationNames.includes(name), `Missing required P1A checkpoint migration: ${name}`)
}

const checkpointMigrations = actualMigrationNames.filter((name) => {
  const match = migrationFilenamePattern.exec(name)
  return BigInt(match[1]) === checkpointVersion
})
assert.deepEqual(
  checkpointMigrations,
  [migrationName],
  'P1A checkpoint version must resolve to exactly the canonical P1A migration',
)

assert(fs.existsSync(migrationPath), `Missing exact migration: ${migrationName}`)
assert(fs.existsSync(reportPath), 'Missing P1A implementation report')
assert(fs.existsSync(smokePath), 'Missing P1A semantic smoke')
assert(fs.existsSync(qaRunnerPath), 'Missing P1A local-database behavioral QA runner')
assert(fs.existsSync(canonicalRoadmapPath), 'Missing canonical roadmap mirror')
assert(fs.existsSync(localRoadmapPath), 'Missing ignored local roadmap mirror')

const p1aMigrationHash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(migrationPath))
  .digest('hex')
  .toUpperCase()
assert.equal(
  p1aMigrationHash,
  '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6',
  'P1A migration changed during local-database QA',
)

const migration = read(migrationPath)
const sql = migration.toLowerCase()
const report = read(reportPath)
const smokeSource = read(smokePath)
const qaSource = read(qaRunnerPath)
const canonicalRoadmap = read(canonicalRoadmapPath)
const localRoadmap = read(localRoadmapPath)

const includesAll = (content, markers, message) => {
  for (const marker of markers) assert(content.includes(marker), `${message}: ${marker}`)
}

const tableBlock = (name) => {
  const startMarker = `create table public.${name} (`
  const start = sql.indexOf(startMarker)
  assert(start >= 0, `Missing table declaration: public.${name}`)
  const end = sql.indexOf('\n);', start + startMarker.length)
  assert(end > start, `Missing table terminator: public.${name}`)
  return sql.slice(start, end + 3)
}

const tables = [
  'center_crm_control',
  'crm_contact',
  'consultation_case',
  'consultation_case_candidate_student',
  'consultation_case_assignment',
  'crm_care_log',
  'crm_conversion_request',
  'crm_idempotency_registry',
  'crm_audit_event',
  'crm_outbox_event',
]
const rootBoundTables = tables.filter((table) => table !== 'center_crm_control')

assert(sql.trimStart().startsWith('-- f23.3e-p1a:'), 'Migration header/boundary is missing')
assert(/^begin;$/m.test(sql), 'Migration must begin an explicit transaction')
assert(/^commit;$/m.test(sql), 'Migration must commit its explicit transaction')
assert(!/create\s+(?:table|function|index|trigger)\s+if\s+not\s+exists/i.test(migration), 'Schema conflicts must not be hidden with CREATE IF NOT EXISTS')
const functionCount = [...sql.matchAll(/^create function public\./gm)].length
assert(functionCount > 0, 'P1A migration must create its protected/trigger helper functions')
assert.equal([...sql.matchAll(/^set search_path = ''$/gm)].length, functionCount, 'Every P1A function must harden search_path')
assert.equal([...sql.matchAll(/^revoke all on function public\./gm)].length, functionCount, 'Every P1A function must revoke default/browser execution')

for (const table of tables) {
  const createPattern = new RegExp(`\\bcreate\\s+table\\s+public\\.${table}\\s*\\(`, 'g')
  assert.equal([...sql.matchAll(createPattern)].length, 1, `Table must be created exactly once: ${table}`)
}
assert.equal([...sql.matchAll(/\bcreate\s+table\s+public\./g)].length, tables.length, 'P1A migration created an unexpected public table')
for (const table of rootBoundTables) {
  includesAll(tableBlock(table), [
    'foreign key (center_id) references public.centers(id) on delete restrict',
    'foreign key (center_id) references public.center_crm_control(center_id) on delete restrict',
  ], `Canonical center/control-root binding is incomplete: ${table}`)
}

const control = tableBlock('center_crm_control')
includesAll(control, [
  'center_id text primary key',
  "foreign key (center_id) references public.centers(id) on delete cascade",
  "crm_state text not null default 'planned'",
  "feature_flag_state text not null default 'disabled'",
  "'planned', 'migrating', 'read_only', 'active', 'suspended'",
  "'disabled', 'read_only', 'enabled'",
  'control_version integer not null default 1',
], 'Center control root is incomplete')
includesAll(sql, [
  'lock table public.centers in share row exclusive mode',
  'create function public.f23_3e_p1a_provision_center_crm_control()',
  'security definer',
  "set search_path = ''",
  'after insert on public.centers',
  'insert into public.center_crm_control (center_id)',
  'select c.id\nfrom public.centers c',
  'having count(r.center_id) <> 1',
  'revoke all on function public.f23_3e_p1a_provision_center_crm_control()',
  'from public, anon, authenticated',
], 'Root backfill/future provisioning is incomplete')

const contact = tableBlock('crm_contact')
includesAll(contact, [
  'crm_contact_id uuid primary key default pg_catalog.gen_random_uuid()',
  'protected_contact_methods_ciphertext bytea not null',
  'contact_methods_crypto_version integer not null',
  'normalized_lookup_digests bytea[] not null',
  'normalization_version integer not null',
  'contact_version integer not null default 1',
  "'new', 'contacted', 'qualified', 'unqualified', 'archived'",
  'unique (center_id, crm_contact_id)',
  'references auth.users(id)',
], 'Contact schema is incomplete')
assert(!/\b(phone|email)\b\s+(?:text|varchar|character varying)\b/.test(contact), 'Contact must not store raw phone/email plaintext columns')

const consultationCase = tableBlock('consultation_case')
includesAll(consultationCase, [
  'consultation_case_id uuid primary key default pg_catalog.gen_random_uuid()',
  'foreign key (center_id, primary_contact_id)',
  'references public.crm_contact(center_id, crm_contact_id)',
  'unique (center_id, consultation_case_id)',
  'unique (center_id, consultation_case_id, primary_contact_id)',
  "'open', 'consulting', 'paused', 'ready_for_conversion'",
  "'converted', 'lost', 'cancelled', 'archived'",
  'case_version integer not null default 1',
  'active_assignment_id uuid',
], 'Consultation Case schema is incomplete')

const candidate = tableBlock('consultation_case_candidate_student')
includesAll(candidate, [
  'candidate_student_id uuid primary key default pg_catalog.gen_random_uuid()',
  'birth_evidence_protected bytea',
  'foreign key (center_id, consultation_case_id)',
  'references public.consultation_case(center_id, consultation_case_id)',
  "'draft', 'active', 'review_required', 'converted', 'discarded'",
  'candidate_version integer not null default 1',
], 'Candidate-student evidence schema is incomplete')

const assignment = tableBlock('consultation_case_assignment')
includesAll(assignment, [
  'assignment_id uuid primary key default pg_catalog.gen_random_uuid()',
  'foreign key (center_id, consultation_case_id)',
  'references public.consultation_case(center_id, consultation_case_id)',
  'assigned_consultant_user_id uuid not null',
  'references auth.users(id)',
  "'active', 'ended', 'revoked', 'superseded'",
  'assignment_version integer not null default 1',
  'unique (center_id, consultation_case_id, assignment_id)',
  'unique (center_id, assignment_id)',
], 'Case Assignment schema is incomplete')
includesAll(sql, [
  'create unique index consultation_case_assignment_one_active_idx',
  "where assignment_status = 'active'",
  'add constraint consultation_case_active_assignment_exact_case_fkey',
  'foreign key (center_id, consultation_case_id, active_assignment_id)',
  'references public.consultation_case_assignment(center_id, consultation_case_id, assignment_id)',
  'deferrable initially deferred',
  'create constraint trigger f23_3e_p1a_case_active_assignment_consistency',
  'create constraint trigger f23_3e_p1a_assignment_case_root_consistency',
], 'Case/Assignment exact-center circular integrity is incomplete')

const careLog = tableBlock('crm_care_log')
includesAll(careLog, [
  'care_log_id uuid primary key default pg_catalog.gen_random_uuid()',
  'foreign key (center_id, consultation_case_id)',
  'correction_of_care_log_id uuid',
  'foreign key (center_id, consultation_case_id, correction_of_care_log_id)',
  'references public.crm_care_log(center_id, consultation_case_id, care_log_id)',
  'care_log_version integer not null default 1',
  'check (care_log_version = 1)',
], 'Care Log schema is incomplete')
assert(!/\battachment\b\s+(?:text|jsonb|bytea)/.test(careLog), 'Care Log must not add arbitrary attachment storage')

const request = tableBlock('crm_conversion_request')
includesAll(request, [
  'conversion_request_id uuid primary key default pg_catalog.gen_random_uuid()',
  'foreign key (center_id, consultation_case_id)',
  'foreign key (center_id, source_contact_id)',
  'foreign key (center_id, consultation_case_id, source_contact_id)',
  'action_graph_digest bytea not null',
  'intent_digest bytea not null',
  'request_version integer not null default 1',
  'idempotency_key_reference uuid not null',
  "'draft', 'ready_for_review', 'approved', 'executing', 'completed'",
  "'conflict', 'rejected', 'cancelled', 'superseded', 'compensation_required'",
], 'Conversion Request schema is incomplete')
includesAll(sql, [
  'create unique index crm_conversion_request_one_active_case_idx',
  "where status in ('draft', 'ready_for_review', 'approved', 'executing', 'compensation_required')",
  'f23_3e_p1a_request_status_reserved_for_future_protected_runtime',
  'f23_3e_p1a_terminal_request_cannot_return_to_draft',
], 'One-active/protected Request lifecycle is incomplete')

const idempotency = tableBlock('crm_idempotency_registry')
includesAll(idempotency, [
  'environment_fingerprint bytea not null',
  'resource_scope_kind text not null',
  'resource_scope_id uuid not null',
  'idempotency_key_digest bytea not null',
  'intent_digest bytea not null',
  'idempotency_version integer not null default 1',
  "'reserved', 'in_progress', 'completed', 'conflict', 'expired'",
  'foreign key (center_id, consultation_case_id)',
  'foreign key (center_id, request_id)',
], 'Scoped Idempotency schema is incomplete')
includesAll(idempotency, [
  'environment_fingerprint,\n      center_id,\n      resource_scope_kind,\n      resource_scope_id,\n      operation,\n      idempotency_key_digest',
], 'Idempotency uniqueness does not bind the complete non-null resource scope')
includesAll(sql, [
  'add constraint crm_conversion_request_idempotency_exact_center_fkey',
  'foreign key (center_id, idempotency_key_reference)',
  'references public.crm_idempotency_registry(center_id, idempotency_record_id)',
], 'Request/Idempotency exact-center link is incomplete')

const audit = tableBlock('crm_audit_event')
includesAll(audit, [
  'audit_event_id uuid primary key default pg_catalog.gen_random_uuid()',
  'foreign key (center_id, request_id)',
  'foreign key (center_id, assignment_id)',
  'previous_version integer',
  'new_version integer',
  'safe_reason_code text',
  'correlation_id uuid not null',
], 'Audit schema is incomplete')
for (const forbiddenAuditColumn of ['payload', 'before_state', 'after_state', 'phone', 'email', 'birth']) {
  assert(!new RegExp(`\\b${forbiddenAuditColumn}\\b`).test(audit), `Audit contains forbidden raw/arbitrary field: ${forbiddenAuditColumn}`)
}
includesAll(sql, [
  'create trigger f23_3e_p1a_audit_event_immutable',
  'before update or delete on public.crm_audit_event',
  'f23_3e_p1a_append_only_table_rejects_',
], 'Audit immutability trigger is incomplete')

const outbox = tableBlock('crm_outbox_event')
includesAll(outbox, [
  'outbox_event_id uuid primary key default pg_catalog.gen_random_uuid()',
  'event_version integer not null default 1',
  'safe_payload jsonb not null',
  "'pending', 'claimed', 'delivered', 'retry', 'dead_letter', 'cancelled'",
  'attempt_count integer not null default 0',
  'claim_id uuid',
  'claimed_by text',
  'claim_expires_at timestamptz',
  'delivered_at timestamptz',
  "delivery_status in ('claimed', 'delivered')",
  'claim_id is not null',
  'claimed_by is not null',
  'claim_expires_at is not null',
  "(delivery_status = 'delivered') = (delivered_at is not null)",
], 'Durable Outbox constraints are incomplete')
includesAll(sql, [
  'create function public.f23_3e_p1a_is_safe_outbox_payload(p_payload jsonb)',
  'v_key not in (',
  "v_key in ('resource_id', 'request_id', 'assignment_id', 'correlation_id')",
  "v_key in ('event_schema_version', 'previous_version', 'new_version')",
  "v_text !~ '^[a-za-z][a-za-z0-9_.-]{0,159}$'",
  'f23_3e_p1a_outbox_event_identity_and_payload_are_immutable',
  'f23_3e_p1a_terminal_outbox_event_cannot_return_to_pending',
], 'Outbox safe-payload/lifecycle guard is incomplete')

const versionFields = [
  'control_version',
  'contact_version',
  'case_version',
  'candidate_version',
  'assignment_version',
  'request_version',
  'idempotency_version',
  'event_version',
]
for (const field of versionFields) {
  assert(sql.includes(`new.${field} <> old.${field} + 1`), `Missing exact +1 monotonic update guard: ${field}`)
}
assert(sql.includes('care_log_version integer not null default 1'), 'Care Log must start at version 1')
assert(sql.includes('check (care_log_version = 1)'), 'Append-only Care Log version must remain 1')

includesAll(sql, [
  'f23_3e_p1a_archived_contact_restore_requires_future_protected_flow',
  'f23_3e_p1a_case_converted_reserved_for_future_executor',
  'f23_3e_p1a_terminal_case_is_immutable_without_future_protected_flow',
  'f23_3e_p1a_terminal_assignment_cannot_be_rewritten',
  'f23_3e_p1a_assignment_history_delete_forbidden',
  'before insert or update or delete on public.consultation_case_assignment',
  'f23_3e_p1a_terminal_idempotency_record_is_immutable',
  'before update or delete on public.crm_care_log',
], 'Required lifecycle/append-only guards are incomplete')

for (const table of tables) {
  assert(sql.includes(`alter table public.${table} enable row level security;`), `RLS ENABLE missing: ${table}`)
  assert(sql.includes(`alter table public.${table} force row level security;`), `RLS FORCE missing: ${table}`)
}
assert(!/\bcreate\s+policy\b/i.test(migration), 'P1A must create no broad or narrow browser policy')
assert(!/\bgrant\s+(?:all(?:\s+privileges)?|select|insert|update|delete|truncate|references|trigger)[\s\S]{0,240}?\bto\s+(?:public|anon|authenticated)\b/i.test(migration), 'P1A must not grant browser table CRUD privileges')
includesAll(sql, [
  'revoke all privileges on table',
  'public.center_crm_control,',
  'public.crm_outbox_event',
  'from public, anon, authenticated;',
], 'Fail-closed table privilege revoke is incomplete')

for (const deferredTable of [
  'guardian_profile',
  'student_profile',
  'guardian_student_relationship',
  'crm_conversion_approval',
  'identity_match_mutex',
  'profile_creation_reservation',
]) {
  assert(!new RegExp(`create\\s+table\\s+public\\.${deferredTable}\\b`, 'i').test(migration), `Deferred table must not be created: ${deferredTable}`)
}

const forbiddenSqlPatterns = [
  [/service[_ -]?role\s*(?:key|secret|token|=|:)/i, 'service-role credential'],
  [/https?:\/\//i, 'project URL'],
  [/(?:postgres(?:ql)?|database):\/\//i, 'database URL'],
  [/\b(?:\+?84|0)\d{8,10}\b/, 'raw phone fixture'],
  [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, 'raw email fixture'],
  [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/, 'date-shaped child identity fixture'],
  [/\b(?:supabase\s+db\s+(?:push|reset)|supabase\s+migration\s+up|psql\s+[^\n]*remote)\b/i, 'remote apply command'],
  [/\bdrop\s+table\s+(?:public\.)?(?:account_audit_logs|center_cloud_entities|center_members|centers|transaction_attachments)\b/i, 'DROP applied table'],
  [/\bcreate\s+policy\b[\s\S]{0,300}\bcenter[_ -]?member/i, 'generic center-member CRM policy'],
]
for (const [pattern, description] of forbiddenSqlPatterns) {
  assert(!pattern.test(migration), `Forbidden SQL content detected: ${description}`)
}

const requiredReportPrefix = [
  'F23_3E_P1A_STATUS: IMPLEMENTED IN REPO',
  'F23_3E_P1A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1A_MIGRATION_CREATED: YES',
  'F23_3E_P1A_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS',
  'F23_3E_P1A_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1A_RUNTIME_WIRING: NOT STARTED',
  'F23_3E_P1A_RLS_RUNTIME_POLICIES: NOT STARTED',
  'F23_3E_P1A_REAL_DATA_CHANGE: NO',
  'F23_3E_P1A_AUTH_CHANGE: NO',
  'F23_3E_P1A_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1A_DEPLOY: NOT RUN',
].join('\n')
assert(report.startsWith(requiredReportPrefix), 'Implementation report must begin with the exact P1A status block')

includesAll(report, [
  'F23_2_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'FUTURE_CENTER_CREATION_PROVISIONS_ONE_CRM_ROOT: YES',
  'CLIENT_MAY_PROVISION_CENTER_CRM_ROOT: NO',
  'CENTER_ROOT_PROVISIONING_SECURITY_DEFINER_HARDENED: YES',
  'IDEMPOTENCY_NULL_SCOPE_DUPLICATE_ALLOWED: NO',
  'CRM_AUDIT_EVENT_UPDATE_ALLOWED: NO',
  'CRM_AUDIT_EVENT_DELETE_ALLOWED: NO',
  'CRM_AUDIT_RAW_PII_COLUMN_EXISTS: NO',
  'OUTBOX_NETWORK_DELIVERY_EXACTLY_ONCE: NO',
  'OUTBOX_AT_LEAST_ONCE_IDEMPOTENT_CONSUMER_REQUIRED: YES',
  'F23_3E_P1A_RLS_DEFAULT: FAIL_CLOSED',
  'F23_3E_P1A_BROAD_MEMBER_POLICY_CREATED: NO',
  'F23_3E_P1A_BROWSER_DIRECT_TABLE_WRITE_ALLOWED: NO',
  'F23_3E_P1A_LOCAL_SQL_APPLY: PASS',
  'F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS',
  'QA target: local Docker Supabase only',
  'Remote action: NOT RUN',
  'Fixture cleanup: PASS',
  'P1A_QA_LEFTOVER_FIXTURE_COUNT: 0',
  '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6',
  'supabase/migrations/202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql',
  'docs/f23-3e-p1a-canonical-crm-schema-and-control-root.md',
  'tests/f23-3e-p1a-canonical-crm-schema-and-control-root-smoke.js',
  'tests/f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js',
  'docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md',
], 'Implementation report is incomplete')

for (const [name, expectedHash] of appliedMigrationHashes) {
  includesAll(report, [name, expectedHash], `Implementation report lacks applied migration hash: ${name}`)
}

const requiredRoadmapLines = [
  'F23.2 DONE design / Nối dây Phụ huynh ↔ Tư vấn ↔ Học viên: entity, relationship và lifecycle canonical',
  'F23.3 PARTIAL public/backend',
  'F23.3E PARTIAL public/backend/QA',
  'F23.3E-P1 DONE backend/local verified',
  'F23.3E-P1A DONE backend/local verified',
  'F23.3E-P1B DONE backend/local verified',
  'F23.3E-P1C DONE backend/local verified',
  'F23.3E-P1D DONE backend/local verified',
  'F23.3E-P1E DONE backend/local verified',
  'F23.3E-P1F DONE QA/local verified',
  'F23.3E-P2 DONE backend/local verified',
  'F23.3E-P3 DONE backend/local verified',
  'F23.3E-P4A DONE backend/local verified',
]
includesAll(localRoadmap, requiredRoadmapLines, 'Current P1A/F23.3E roadmap state is incomplete')
assert(!localRoadmap.includes('CURRENT CHECKPOINT —'), 'Completed milestones must not retain checkpoint prefixes')
assert(!localRoadmap.includes('Supabase applied'), 'Roadmap must not claim remote apply')
assert(canonicalRoadmap.includes('F23.3E-P1A DONE backend/local verified'), 'Historical P1A closeout evidence drifted')

const requiredQaMarkers = [
  'P1A_QA_EXISTING_CENTER_ROOT_BACKFILL: PASS',
  'P1A_QA_FUTURE_CENTER_ROOT_PROVISIONING: PASS',
  'P1A_QA_ROOT_DEFAULT_DISABLED: PASS',
  'P1A_QA_RLS_ENABLED_AND_FORCED: PASS',
  'P1A_QA_ZERO_BROWSER_POLICIES: PASS',
  'P1A_QA_BROWSER_DIRECT_ACCESS_DENIED: PASS',
  'P1A_QA_EXACT_CENTER_FOREIGN_KEYS: PASS',
  'P1A_QA_ONE_ACTIVE_ASSIGNMENT: PASS',
  'P1A_QA_DEFERRED_CASE_ASSIGNMENT_POINTER: PASS',
  'P1A_QA_ASSIGNMENT_HISTORY_IMMUTABLE: PASS',
  'P1A_QA_CONTACT_LIFECYCLE: PASS',
  'P1A_QA_CASE_CANDIDATE_LIFECYCLE: PASS',
  'P1A_QA_REQUEST_RESERVED_STATUS_GUARD: PASS',
  'P1A_QA_MONOTONIC_VERSION_PLUS_ONE: PASS',
  'P1A_QA_CARE_LOG_APPEND_ONLY: PASS',
  'P1A_QA_AUDIT_IMMUTABLE: PASS',
  'P1A_QA_AUDIT_HAS_NO_RAW_PAYLOAD_COLUMN: PASS',
  'P1A_QA_ONE_ACTIVE_REQUEST: PASS',
  'P1A_QA_SCOPED_IDEMPOTENCY_UNIQUENESS: PASS',
  'P1A_QA_REQUEST_IDEMPOTENCY_BINDING: PASS',
  'P1A_QA_OUTBOX_SAFE_PAYLOAD: PASS',
  'P1A_QA_OUTBOX_LEASE_AND_TRANSITIONS: PASS',
  'P1A_QA_LEFTOVER_FIXTURE_COUNT: 0',
]
includesAll(qaSource, requiredQaMarkers, 'Local-database QA runner lacks required result marker')
includesAll(qaSource, [
  'const databaseHost = new URL(localStatus.DB_URL).hostname',
  "'--no-install'",
  "'status'",
  "const expectedContainerName = `supabase_db_${projectSlug}`",
  "labels['com.supabase.cli.project']",
  "labels['com.docker.compose.project']",
  "'docker'",
  "'exec'",
  "'psql'",
  "'-v'",
  "'ON_ERROR_STOP=1'",
  'begin;',
  'rollback;',
  'randomUUID()',
  'set role authenticated',
  'supabase_migrations.schema_migrations',
  'F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS',
], 'Local-database QA runner is missing a safety or behavioral control')

const forbiddenQaPatterns = [
  [/\bsupabase\s+db\s+(?:push|pull)\b/i, 'remote-capable database command'],
  [/\bsupabase\s+migration\s+(?:repair|up)\b/i, 'migration mutation command'],
  [/\b--linked\b/i, 'linked-project flag'],
  [/https?:\/\/[a-z0-9-]+\.supabase\.co\b/i, 'Supabase project URL'],
  [/(?:postgres(?:ql)?|database):\/\/[^\s'"`]+/i, 'database URL'],
  [/(?:eyJ[a-zA-Z0-9_-]{10,}|sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,})/, 'credential/token'],
  [/(?:password|secret[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*[^\s'"`]{6,}/i, 'hardcoded secret'],
  [/\b(?:\+?84|0)\d{8,10}\b/, 'raw phone fixture'],
  [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, 'raw email fixture'],
  [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/, 'date-shaped child identity fixture'],
]
for (const [pattern, description] of forbiddenQaPatterns) {
  assert(!pattern.test(qaSource), `Local-database QA runner contains ${description}`)
}

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]
for (const artifact of [migration, report, smokeSource, qaSource, canonicalRoadmap, localRoadmap]) {
  for (const marker of mojibakeMarkers) assert(!artifact.includes(marker), `Mojibake marker present: ${marker}`)
}

const sensitiveArtifactPatterns = [
  [/(?:eyJ[a-zA-Z0-9_-]{10,}|sb_(?:publishable|secret)_[a-zA-Z0-9_-]{10,})/, 'credential/token'],
  [/(?:password|secret[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*[^\s'"`]{6,}/i, 'assigned secret'],
  [/https?:\/\/[a-z0-9-]+\.supabase\.co\b/i, 'Supabase project URL'],
  [/(?:postgres(?:ql)?|database):\/\/[^\s'"`]+/i, 'database URL'],
  [/\b(?:\+?84|0)\d{8,10}\b/, 'raw phone fixture'],
  [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, 'raw email fixture'],
  [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/, 'date-shaped child identity fixture'],
]
for (const artifact of [migration, report, smokeSource, qaSource]) {
  for (const [pattern, description] of sensitiveArtifactPatterns) {
    assert(!pattern.test(artifact), `P1A artifact contains ${description}`)
  }
}

const privateLabels = [
  ['Teacher', 'Workspace'].join(' '),
  ['Module', '14'].join(' '),
  ['Nhà của giáo', 'viên'].join(' '),
  ['teacher', 'workspace'].join('-'),
  ['private', 'teacher'].join('-'),
  ['secret', 'workspace'].join('-'),
  ['dream', 'home'].join(''),
]
for (const artifact of [migration, report, smokeSource, qaSource]) {
  for (const label of privateLabels) {
    assert(!artifact.toLowerCase().includes(label.toLowerCase()), `P1A artifact contains private label: ${label}`)
  }
}

assert(!/f23_3e_p1a_final_technical_audit:\s*not run/i.test(report), 'P1A final technical audit must be closed as PASS')
assert(!/f23_3e_p1a_remote_apply:\s*(?:run|done|applied|yes)/i.test(report), 'Report must not claim a remote apply')
assert(!/f23_3e_p1a_runtime_wiring:\s*(?:done|ready|yes)/i.test(report), 'Report must not claim runtime wiring')
assert(!/f23_3e_p1a_rls_runtime_policies:\s*(?:done|ready|yes)/i.test(report), 'Report must not claim runtime RLS policies')
assert(!/\b(?:runtime|production)\s+(?:is\s+)?ready\b/i.test(report), 'Report must not claim runtime/production readiness')

const dollarQuotes = migration.match(/\$[a-z0-9_]*\$/gi) ?? []
const dollarQuoteCounts = new Map()
for (const quote of dollarQuotes) dollarQuoteCounts.set(quote, (dollarQuoteCounts.get(quote) ?? 0) + 1)
for (const [quote, count] of dollarQuoteCounts) {
  assert.equal(count % 2, 0, `Unbalanced SQL dollar quote: ${quote}`)
}

console.log('F23.3E-P1A canonical CRM schema/control-root semantic smoke passed')
