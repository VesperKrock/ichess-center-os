import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const reportPath = join(root, 'docs', 'f23-3e-p1f-integrated-qa-and-rollout-gates.md')
const smokePath = join(root, 'tests', 'f23-3e-p1f-integrated-qa-and-rollout-gates-smoke.js')
const qaPath = join(root, 'tests', 'f23-3e-p1f-integrated-qa-and-rollout-gates-local-db-qa.js')
const p1aQaPath = join(root, 'tests', 'f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js')
const migrationsPath = join(root, 'supabase', 'migrations')

for (const path of [reportPath, smokePath, qaPath, p1aQaPath]) assert(existsSync(path), `Missing required file: ${path}`)
const report = readFileSync(reportPath, 'utf8')
const smoke = readFileSync(smokePath, 'utf8')
const qa = readFileSync(qaPath, 'utf8')
const p1aQa = readFileSync(p1aQaPath, 'utf8')

const includesAll = (text, values, label) => {
  for (const value of values) assert(text.includes(value), `${label}: missing ${value}`)
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()

const migrationCheckpoints = new Map([
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
])
const migrationFiles = readdirSync(migrationsPath).filter((name) => name.endsWith('.sql')).sort()
for (const [name, expected] of migrationCheckpoints) {
  assert(migrationFiles.includes(name), `Missing immutable checkpoint: ${name}`)
  assert.equal(sha256(join(migrationsPath, name)), expected, `Immutable migration changed: ${name}`)
  includesAll(report, [name, expected], `Report lacks immutable checkpoint ${name}`)
}
assert.equal(migrationFiles.filter((name) => /f23_3e_p1f/i.test(name)).length, 0, 'P1F migration exists')

const exactArtifacts = [
  'docs/f23-3e-p1f-integrated-qa-and-rollout-gates.md',
  'tests/f23-3e-p1f-integrated-qa-and-rollout-gates-smoke.js',
  'tests/f23-3e-p1f-integrated-qa-and-rollout-gates-local-db-qa.js',
].sort()
const discoveredArtifacts = [
  ...readdirSync(join(root, 'docs')).filter((name) => name.includes('f23-3e-p1f')).map((name) => `docs/${name}`),
  ...readdirSync(join(root, 'tests')).filter((name) => name.includes('f23-3e-p1f')).map((name) => `tests/${name}`),
  ...migrationFiles.filter((name) => /f23_3e_p1f/i.test(name)).map((name) => `supabase/migrations/${name}`),
].sort()
assert.deepEqual(discoveredArtifacts, exactArtifacts, 'P1F must have exactly three named artifacts')

const reportPrefix = [
  'F23_3E_P1F_STATUS: QA IMPLEMENTED IN REPO',
  'F23_3E_P1F_FINAL_TECHNICAL_AUDIT: PASS',
  '',
  'F23_3E_P1F_LOCAL_INTEGRATED_QA: PASS',
  'F23_3E_P1F_DIRECT_API_QA: PASS',
  'F23_3E_P1F_MULTI_ACCOUNT_MULTI_CENTER_QA: PASS',
  'F23_3E_P1F_CONCURRENCY_DEADLOCK_STALE_QA: PASS',
  'F23_3E_P1F_AUDIT_OUTBOX_FAULT_QA: PASS',
  'F23_3E_P1F_IMPORT_REPLAY_CONFLICT_QA: PASS',
  'F23_3E_P1F_READ_ONLY_KILL_SWITCH_QA: PASS',
  '',
  'F23_3E_P1_FOUNDATION_LOCAL_TECHNICAL_GATE: PASS',
  'F23_3E_P2_ENTRY_TECHNICAL_GATE: PASS',
  '',
  'F23_3E_P1F_ACTIVE_MUTATION_ROLLOUT_GATE: BLOCKED',
  'F23_3E_P1F_REMOTE_ROLLOUT_GATE: BLOCKED',
  'F23_3E_P1F_MANUAL_ACTIVE_MUTATION_QA: NOT RUN',
  'F23_3E_P1F_PRODUCTION_READINESS: NOT CLAIMED',
  '',
  'F23_3E_P1F_REMOTE_APPLY: NOT RUN',
  'F23_3E_P1F_AUTH_CHANGE: NO',
  'F23_3E_P1F_EDGE_FUNCTION_CHANGE: NO',
  'F23_3E_P1F_DEPLOY: NOT RUN',
  'F23_3E_P1F_BROWSER_UI_WIRING: NOT STARTED',
  'F23_3E_P1F_FULL_CONTACT_REVEAL: NOT IMPLEMENTED',
  'F23_3E_P1F_REAL_IMPORT: NOT RUN',
  'F23_3E_P1F_REAL_DATA_CHANGE: NO',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
].join('\n')
assert(report.startsWith(reportPrefix), 'P1F implementation report prefix drift')

const requiredQaMarkers = [
  'P1F_QA_P1A_LOCAL_RUNNER: PASS',
  'P1F_QA_P1A_FORWARD_COMPATIBLE_CURRENT_SCHEMA: PASS',
  'P1F_QA_P1B_LOCAL_RUNNER: PASS',
  'P1F_QA_P1C_LOCAL_RUNNER: PASS',
  'P1F_QA_P1D_LOCAL_RUNNER: PASS',
  'P1F_QA_P1E_LOCAL_RUNNER: PASS',
  'P1F_QA_DIRECT_API_ANON_CRM_TABLE_DENIED: PASS',
  'P1F_QA_DIRECT_API_SERVICE_ROLE_CRM_TABLE_DENIED: PASS',
  'P1F_QA_DIRECT_API_PROTECTED_MASKED_RPC: PASS',
  'P1F_QA_MULTI_ACCOUNT_EXACT_CENTER_READ_ISOLATION: PASS',
  'P1F_QA_MULTI_ACCOUNT_EXACT_CENTER_MUTATION_ISOLATION: PASS',
  'P1F_QA_STALE_VERSION_FAILS_CLOSED: PASS',
  'P1F_QA_INHERITED_CONCURRENCY_MATRIX: PASS',
  'P1F_QA_DEADLOCK_LIVENESS_GATE: PASS',
  'P1F_QA_KILL_SWITCH_ACTUAL_LOCK_WAIT_OBSERVED: PASS',
  'P1F_QA_KILL_SWITCH_WAIT_RECHECK: PASS',
  'P1F_QA_KILL_SWITCH_READ_DENIED: PASS',
  'P1F_QA_READ_ONLY_COHORT_READS_ONLY: PASS',
  'P1F_QA_AUDIT_OUTBOX_FAULT_MATRIX: PASS',
  'P1F_QA_IMPORT_REPLAY_CONFLICT_MATRIX: PASS',
  'P1F_QA_FINAL_LOCAL_RESET: PASS',
  'P1F_QA_LEFTOVER_FIXTURE_COUNT: 0',
  'P1F_QA_NONDEFAULT_ROOT_COUNT: 0',
  'P1F_QA_TEMP_HELPER_COUNT: 0',
]
includesAll(qa, requiredQaMarkers, 'Integrated runner marker inventory')
includesAll(report, requiredQaMarkers, 'Report runtime evidence inventory')

includesAll(qa, [
  "const resetConsentFlag = 'ICHESS_P1F_LOCAL_QA_ALLOW_RESET'",
  "assert.equal(process.argv.length, 2",
  'assert(!process.env.SUPABASE_PROJECT_REF',
  "localArgs('status -o json')", "localArgs('db reset')",
  "const expectedContainerName = 'supabase_db_ichess-center-os'",
  "label=com.supabase.cli.project=${projectSlug}",
  "labels['com.docker.compose.project']",
  "['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']",
  "for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'API_URL'])",
  'return await fetch(', '/rest/v1/${path}',
  "['crm_contact', 'consultation_case', 'crm_care_log']",
  "method: 'POST'", 'MASKED_PROTECTED', 'NO_STORE',
  "wait_event_type='Lock'", "application_name='p1f_kill_switch_mutation'",
  "[false, 'CRM_RUNTIME_NOT_ACTIVE']",
  "crm_state='READ_ONLY',feature_flag_state='READ_ONLY'",
  'finally {', 'runReset()', 'timeout: 360_000',
], 'Integrated safety and dynamic assertion contract')

const inheritedFiles = [
  'tests/f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js',
  'tests/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-local-db-qa.js',
  'tests/f23-3e-p1c-transactional-audit-and-durable-outbox-local-db-qa.js',
  'tests/f23-3e-p1d-typed-crm-service-operations-local-db-qa.js',
  'tests/f23-3e-p1e-rls-read-mask-and-import-readiness-local-db-qa.js',
]
includesAll(qa, inheritedFiles, 'Actual inherited runner inventory')
includesAll(qa, [
  'ICHESS_P1B_LOCAL_QA_ALLOW_RESET', 'ICHESS_P1C_LOCAL_QA_ALLOW_RESET',
  'ICHESS_P1D_LOCAL_QA_ALLOW_RESET', 'ICHESS_P1E_LOCAL_QA_ALLOW_RESET',
  'assert.equal(result.status, 0', 'for (const marker of markers)',
  'deadlock detected', 'UnhandledPromiseRejection',
], 'Inherited process verification contract')

includesAll(p1aQa, [
  "'assignmentTerminal'", 'source_assignment_id',
  '${q(ids.assignmentA2)}::uuid', '${q(ids.assignmentTerminal)}::uuid',
  'result_request_id = ${q(ids.requestA)}::uuid',
  "result_outcome_code = 'REVIEW_SUBMITTED'",
  'delivery_version = delivery_version + 1',
  'event_version = 1 and delivery_version = 5',
  'last_attempt_at = pg_catalog.transaction_timestamp()',
  'P1A_QA_MONOTONIC_VERSION_PLUS_ONE: PASS',
  'P1A_QA_LEFTOVER_FIXTURE_COUNT: 0',
], 'P1A fixture forward-compatibility contract')
assert(!p1aQa.includes('drop constraint'), 'P1A harness weakens a database constraint')
assert(!p1aQa.includes('disable trigger'), 'P1A harness disables a trigger')

includesAll(report, [
  'P1F_NEW_MIGRATION_COUNT: 0', 'P1F_EXISTING_MIGRATION_CHANGED: NO',
  'External technical audit: PASS.',
  'P1F_ACTIVE_MUTATION_ROLLOUT_GATE: BLOCKED', 'P1F_REMOTE_ROLLOUT_GATE: BLOCKED',
  'P1F_MANUAL_ACTIVE_MUTATION_QA: NOT RUN — NOT APPLICABLE BEFORE BROWSER/CAPABILITY WIRING',
  'P1F_PRODUCTION_READINESS: NOT CLAIMED',
  'P1F_REAL_CONVERSION_READINESS: BLOCKED — P2/P3/P4 NOT IMPLEMENTED',
  ...exactArtifacts, 'tests/f23-3e-p1a-canonical-crm-schema-and-control-root-local-db-qa.js',
  'docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md', 'RoadmapRealTime.txt',
], 'P1F report boundary/evidence contract')

for (const forbidden of [
  /\bsupabase\s+db\s+(?:push|pull)\b/i, /\bmigration\s+repair\b/i,
  /insert\s+into\s+auth\.(?!users\s*\()/i,
  /https?:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/i,
]) assert(!forbidden.test(`${qa}\n${report}`), `P1F artifact contains forbidden scope ${forbidden}`)

const currentP1fLine = 'F23.3E-P1F DONE QA/local verified / Integrated P1A-P1E direct API, multi-account/multi-center, exact-center, stale/concurrency/deadlock, Audit-Outbox fault, import replay/conflict, READ_ONLY và deterministic kill-switch QA PASS; P2 entry technical gate PASS; active/remote rollout vẫn BLOCKED'
const currentParentP1Line = 'F23.3E-P1 DONE backend/local foundation verified / P1A-P1F hoàn tất local: canonical CRM schema/control root, request-idempotency, transactional Audit-Outbox, typed CRM mutations, masked reads/import readiness và integrated rollout-gate QA; chưa apply remote, chưa browser/final capability/full reveal/real import'
const historicalParentP1Literal = 'F23.3E-P1 DONE implementation planning / Canonical CRM foundation: center root, Contact, Case, Assignment, conversion request, idempotency, transactional audit/outbox'
const historicalParentP1Marker = `* Historical checkpoint compatibility note — non-current P1A-era parent marker: ${historicalParentP1Literal}`
const historicalP1fTodoLiteral = 'F23.3E-P1F TODO QA / Direct API, multi-account, exact-center, concurrency, fault injection và rollout gates'
const historicalP1fMarker = `* Historical checkpoint compatibility note — non-current P1D/P1E-era marker: ${historicalP1fTodoLiteral}`
const pendingPostP1Lines = [
  'F23.3E-P2 TODO backend/design / Identity matching, duplicate review, identity mutex và profile-creation reservation',
  'F23.3E-P3 TODO backend / Fresh step-up approval, single-use authority và real conversion executor atomic',
  'F23.3E-P4 TODO public/QA / Nối UI conversion thật, legacy projection và manual QA end-to-end',
]
for (const file of ['docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md', 'RoadmapRealTime.txt']) {
  const roadmap = readFileSync(join(root, file), 'utf8')
  includesAll(roadmap, [currentP1fLine, currentParentP1Line, historicalParentP1Marker, historicalP1fMarker, ...pendingPostP1Lines], `${file} post-audit roadmap closeout`)
  const trimmedLines = roadmap.split(/\r?\n/).map((line) => line.trim())
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P1F ')), [currentP1fLine], `${file} must have exactly one current P1F status`)
  assert.deepEqual(trimmedLines.filter((line) => line.startsWith('F23.3E-P1 ')), [currentParentP1Line], `${file} must have exactly one current parent P1 status`)
  assert.equal(roadmap.split(historicalParentP1Literal).length - 1, 1, `${file} historical parent P1 literal count drift`)
  assert.equal(roadmap.split(historicalParentP1Marker).length - 1, 1, `${file} historical parent P1 compatibility marker count drift`)
  assert.equal(roadmap.split(historicalP1fTodoLiteral).length - 1, 1, `${file} historical P1F TODO literal count drift`)
  assert.equal(roadmap.split(historicalP1fMarker).length - 1, 1, `${file} historical P1F compatibility marker count drift`)
}

assert(smoke.includes('migrationCheckpoints') && smoke.includes('createHash'), 'Smoke does not hard-verify migration hashes')
console.log('P1F_NEW_MIGRATION_COUNT: 0')
console.log('P1F_EXISTING_MIGRATION_CHANGED: NO')
console.log('F23.3E-P1F semantic smoke passed')
