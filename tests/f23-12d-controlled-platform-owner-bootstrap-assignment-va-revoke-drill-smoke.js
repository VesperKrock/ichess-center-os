import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-12d-controlled-platform-owner-bootstrap-assignment-va-revoke-drill.md')
const runbook = read('docs/runbooks/f23-12d-platform-owner-bootstrap-va-revoke-runbook.md')
const authorityDesign = read('docs/f23-12a-platform-owner-role-va-nguon-cap-quyen-server-side.md')
const consoleDesign = read('docs/f23-12b-global-internal-console-va-center-inventory.md')
const actingDesign = read('docs/f23-12c-acting-session-approval-expiry-revoke-va-thoat-vai.md')
const roadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

for (const marker of [
  'F23_12D_STATUS: DONE DESIGN',
  'F23_12_STATUS: DESIGN COMPLETE',
  'F23_12D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'CANONICAL_MACHINE_ROLE: platform_owner',
  'PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES',
  'HARDCODED_OPERATOR_EMAIL_ALLOWED: NO',
  'CLIENT_SELF_GRANT_ALLOWED: NO',
  'OWNER_OR_CENTER_ADMIN_SELF_GRANT_ALLOWED: NO',
  'BROWSER_PRIVILEGED_CREDENTIAL_ALLOWED: NO',
  'UNIVERSAL_RLS_BYPASS_ALLOWED: NO',
  'SELF_APPROVAL_ALLOWED: NO',
  'FIRST_PLATFORM_OWNER_BOOTSTRAP_IS_NORMAL_IN_APP_GRANT: NO',
  'SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES',
  'REAL_PLATFORM_OWNER_ASSIGNMENT: NO',
  'REAL_ACCOUNT_ID_RESOLVED_IN_REPO: NO',
  'REAL_ACCOUNT_EMAIL_STORED_IN_REPO: NO',
  'PLATFORM_OWNER_TARGET_RESOLVED_BY_IMMUTABLE_USER_ID: YES',
  'EMAIL_IS_CANONICAL_PLATFORM_AUTHORITY: NO',
  'TARGET_IDENTITY_REQUIRES_SECOND_CHANNEL_VERIFICATION: YES',
  'CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: NO',
  'BOOTSTRAP_BLOCKED_WITHOUT_CANONICAL_ACCOUNT_LIFECYCLE: YES',
  'ACCOUNT_LIFECYCLE_DEPENDENCY_ERROR_FAILS_CLOSED: YES',
  'FIRST_OPERATOR_USES_CONTROLLED_BOOTSTRAP_EXCEPTION: YES',
  'SECOND_OPERATOR_USES_NORMAL_PROTECTED_GRANT: YES',
  'ONE_PLATFORM_OWNER_ENABLES_WRITE_OR_SENSITIVE_ACCESS: NO',
  'LEGACY_INTERNAL_CENTERS_ROUTE_IS_PLATFORM_CONSOLE: NO',
  'RECOMMENDED_PLATFORM_CONSOLE_ROUTE: #/internal/platform/centers',
  'F23_12D_ROUTE_CHANGE: NO',
  'ACTING_START_LOCK_TARGET: ACTIVE_PLATFORM_ASSIGNMENT_ROW',
  'ACTING_CANONICAL_LOCK_ORDER_DEFINED: YES',
  'PLATFORM_AUTHORITY_GLOBAL_MUTEX_REQUIRED: YES',
  'EMPTY_ASSIGNMENT_SET_PROVIDES_BOOTSTRAP_SERIALIZATION: NO',
  'FIRST_BOOTSTRAP_ASSIGNMENT_ROW_EXISTS_BEFORE_BOOTSTRAP: NO',
  'PLATFORM_AUTHORITY_MUTATION_LOCK_TARGET: GLOBAL_AUTHORITY_CONTROL_ROW',
  'GLOBAL_AUTHORITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'FIRST_BOOTSTRAP_COMPLETION_IS_REVERSIBLE: NO',
  'RECOVERY_BOOTSTRAP_REOPENS_FIRST_BOOTSTRAP: NO',
  'ACTING_START_REQUIRES_GLOBAL_AUTHORITY_MUTEX: NO',
  'AUTHORITY_MUTATION_REQUIRES_GLOBAL_AUTHORITY_MUTEX: YES',
  'GLOBAL_AUTHORITY_CONTROL_LOCK_PRECEDES_ASSIGNMENT_LOCKS: YES',
  'AUTHORITY_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'CONCURRENT_FIRST_BOOTSTRAPS_CAN_BOTH_COMMIT: NO',
  'FIRST_BOOTSTRAP_EXCEPTION_MAY_CREATE_SECOND_OPERATOR: NO',
  'EXECUTION_ENVELOPE_BINDS_ENVIRONMENT_FINGERPRINT: YES',
  'EXECUTION_ENVELOPE_BINDS_AUTHORITY_SCHEMA_VERSION: YES',
  'EXECUTION_ENVELOPE_BINDS_GLOBAL_CONTROL_VERSION: YES',
  'EXECUTION_ENVELOPE_BINDS_BOOTSTRAP_EPOCH: YES',
  'CROSS_ENVIRONMENT_PAYLOAD_REPLAY_ALLOWED: NO',
  'CROSS_SCHEMA_PAYLOAD_REPLAY_ALLOWED: NO',
  'REVOKED_ASSIGNMENT_ROW_MAY_BE_REACTIVATED: NO',
  'REVOKE_INVALIDATES_ACTING_SESSIONS: YES',
  'REVOKE_INVALIDATES_PENDING_APPROVALS: YES',
  'OLD_TOKEN_OR_CACHE_OVERRIDES_REVOKE: NO',
  'RUNTIME_CHANGE: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'AUTH_MUTATION: NOT RUN',
  'DEPLOY: NOT RUN',
  'F23.12D FINAL TECHNICAL AUDIT PASS - F23.13 DESIGN MAY START',
  'F23.12 DESIGN COMPLETE; implementation A–D vẫn `BLOCKED`.',
]) assert(design.includes(marker), `Missing F23.12D marker: ${marker}`)

for (const marker of [
  '## 2. Boundary route và product surface',
  '`#/internal/centers`',
  '`#/internal/platform/centers`',
  '## 4. Repo audit',
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
  '## 5. Identity-resolution ceremony',
  'resolve exact immutable Auth `user_id`',
  'second-channel confirmation',
  '## 6. Canonical account-lifecycle prerequisite',
  '## 7. Hai enrollment paths',
  'activation_mode = FIRST_BOOTSTRAP_EXCEPTION',
  'requester_user_id != approver_user_id',
  'approver_user_id != target_user_id',
  '## 8. Separation of duties',
  '## 9. Conceptual bootstrap record',
  '### 9.1 Stable global authority-control singleton',
  'FIRST_PLATFORM_OWNER',
  'RECOVERY_BOOTSTRAP',
  '## 10. Assignment lifecycle, term và review',
  '## 11. Atomic mutation, audit và lock order',
  'platform assignment rows theo sorted user_id',
  '## 13. Post-verification',
  '## 15. Suspend và revoke semantics',
  '## 16. Revoke drill',
  '## 17. Emergency suspend/revoke',
  '## 18. Zero-operator recovery',
  '## 19. Rollback và compensation',
  '## 20. Session, token và cache invalidation',
  '## 21. Concurrency/replay negative matrix',
  '## 22. Threat model',
  '## 23. Approval gates F23.12D',
  'Smoke là docs-contract test',
]) assert(design.includes(marker) || (marker === 'Smoke là docs-contract test' && design.includes('Design smoke cannot discharge them')), `Missing F23.12D contract: ${marker}`)

for (const field of [
  'control_key',
  'first_bootstrap_state',
  'bootstrap_epoch',
  'control_version',
  'authority_schema_version',
  'first_bootstrap_change_id',
  'first_bootstrap_completed_at',
  'updated_at',
]) assert(design.includes(field), `Missing global authority control field: ${field}`)

assert(design.includes('control_key = platform_owner_authority'), 'Missing canonical global control key')
assert(design.includes('`NOT_COMPLETED` hoặc `COMPLETED`'), 'Missing one-time first-bootstrap states')

const executionEnvelopeFields = [
  'execution_contract_version',
  'environment_fingerprint',
  'authority_schema_version',
  'global_control_key',
  'expected_control_version',
  'expected_bootstrap_epoch',
  'bootstrap_type',
  'activation_mode',
  'target_user_id',
  'canonical_machine_role',
  'assignment_term',
  'expires_at',
  'review_due_at',
  'reason_code',
  'change_ticket_id',
  'idempotency_key',
  'expected_active_operator_count',
  'expected_target_assignment_state',
  'expected_target_assignment_version',
  'canonicalization_version',
]
for (const field of executionEnvelopeFields) assert(design.includes(field), `Missing execution envelope field: ${field}`)
const envelopeStart = design.indexOf('### 12.1 Environment-bound execution envelope')
const envelopeEnd = design.indexOf('### 12.2 First-bootstrap atomic start contract')
assert(envelopeStart >= 0 && envelopeEnd > envelopeStart, 'Missing bounded execution-envelope section')
const executionEnvelope = design.slice(envelopeStart, envelopeEnd)
for (const field of executionEnvelopeFields) assert(executionEnvelope.includes(field), `Execution envelope does not bind: ${field}`)
for (const marker of [
  'versioned canonical serialization',
  'generic `JSON.stringify`',
  'SHA-256',
  'Wrong environment/schema/control version/epoch/state là `ABORT`',
  'không reuse envelope giữa environment/schema',
]) assert(design.includes(marker), `Missing execution-envelope digest contract: ${marker}`)

const globalTier = design.indexOf('0. global platform_authority_control row')
const assignmentTier = design.indexOf('1. platform assignment rows theo sorted user_id')
assert(globalTier >= 0 && assignmentTier > globalTier, 'Global authority mutex must be lock tier 0 before assignment rows')
assert(design.includes('Acting start **không** lấy global authority mutex'), 'Acting start must retain its assignment-scoped mutex')

for (const field of [
  'bootstrap_change_id',
  'change_ticket_id',
  'bootstrap_type',
  'target_user_id',
  'requested_by_operator',
  'reviewed_by_operator',
  'executed_by_operator',
  'reviewed_at',
  'executed_at',
  'reason_code',
  'reason_text_redacted',
  'payload_digest',
  'preflight_snapshot_id',
  'resulting_assignment_id',
  'resulting_authority_version',
  'outcome',
  'rollback_reference',
  'created_at',
]) assert(design.includes(field), `Missing bootstrap field: ${field}`)

for (const state of ['PROPOSED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'REJECTED', 'CANCELLED']) {
  assert(design.includes(`\`${state}\``), `Missing assignment lifecycle state: ${state}`)
}

for (const field of [
  'assignment_term',
  'expires_at',
  'review_due_at',
  'last_reviewed_at',
  'last_reviewed_by_user_id',
  'review_status',
  'authority_version',
]) assert(design.includes(field), `Missing review/term field: ${field}`)

for (const threat of [
  'Hardcoded operator email',
  'Wrong Auth user with similar contact identity',
  'Duplicate Auth account',
  'Center Owner self-escalates',
  'Executor self-approves',
  'Target approves own grant',
  'First-bootstrap path remains open',
  'Payload changes after review',
  'Assignment commits but audit fails',
  'Revoke leaves Acting active',
  'Old token/cache continues allow',
  'Revoked row revived',
  'Recovery bootstrap abuse',
  'Privileged credential leaks to browser/log',
  'Change-ticket replay',
  'Concurrent first bootstraps',
  'Lifecycle dependency unavailable',
  'Assignment review overdue',
  'Wrong project/environment',
  'Migration/schema mismatch',
  'Second operator is same human/account alias',
  'Reviewer/executor collusion',
  'Revoke drill disrupts production',
  'Audit over-collects identity/contact data',
  'Empty-set global bootstrap race',
  'Concurrent new-target grant',
  'Cross-environment execution-envelope replay',
  'First-bootstrap state divergence',
]) assert(design.includes(`| ${threat} |`), `Missing F23.12D threat: ${threat}`)

for (let index = 25; index <= 36; index += 1) {
  assert(design.includes(`| ${index} |`), `Missing concurrency/replay negative case ${index}`)
}

for (const outcome of [
  'first_bootstrap_already_completed',
  'Global control row bị thiếu',
  'Có nhiều global control rows',
  'environment khác',
  'authority schema version khác',
  '`control_version` đổi sau review',
  '`bootstrap_epoch` đổi sau review',
  'Toàn transaction rollback',
]) assert(design.includes(outcome), `Missing hardened negative outcome: ${outcome}`)

for (let index = 1; index <= 20; index += 1) {
  assert(design.includes(`D-AG${index}`), `Missing approval gate D-AG${index}`)
}

for (const marker of [
  'RUNBOOK_CLASSIFICATION: PROTECTED PROCEDURAL CONTRACT',
  'RUNBOOK_EXECUTABLE: NO',
  'REAL_TARGET_ID_INCLUDED: NO',
  'REAL_TARGET_EMAIL_INCLUDED: NO',
  'EXECUTABLE_SQL_INCLUDED: NO',
  'SECRET_OR_TOKEN_INCLUDED: NO',
  'FIRST_BOOTSTRAP_REQUIRES_TWO_PERSON_REVIEW: YES',
  'REVOKE_DRILL_REQUIRED_BEFORE_HIGH_RISK_RELEASE: YES',
  'GLOBAL_AUTHORITY_CONTROL_SINGLETON_REQUIRED: YES',
  'GLOBAL_AUTHORITY_CONTROL_LOCK_PRECEDES_ASSIGNMENT_LOCKS: YES',
  'EMPTY_ASSIGNMENT_SET_IS_MUTEX: NO',
  'ENVIRONMENT_BOUND_EXECUTION_ENVELOPE_REQUIRED: YES',
  'CROSS_ENVIRONMENT_OR_SCHEMA_REPLAY_ALLOWED: NO',
  '## 3. Universal preflight — mọi bootstrap/grant',
  '## 4. Identity-resolution ceremony',
  '## 5. First Platform Owner bootstrap procedure',
  '## 6. Second Platform Owner enrollment',
  '## 7. Revoke drill procedure',
  '## 8. Emergency suspend/revoke',
  '## 9. Zero-active-operator recovery',
  '## 10. Rollback and compensation',
  '## 11. Closure checklist',
  '## 12. Stop conditions',
  'F23.12D PROTECTED RUNBOOK DESIGN COMPLETE - NOT AUTHORIZED FOR EXECUTION',
]) assert(runbook.includes(marker), `Missing protected runbook contract: ${marker}`)

for (let index = 1; index <= 20; index += 1) {
  assert(runbook.includes(`| ${index} |`), `Missing universal preflight gate ${index}`)
}

for (const field of [
  'approved_environment_fingerprint',
  'approved_authority_schema_version',
  'expected_global_control_version',
  'expected_bootstrap_epoch',
  'execution_contract_version',
  'canonical_payload_digest',
]) assert(runbook.includes(field), `Missing protected evidence field: ${field}`)
assert(runbook.includes('bắt buộc đến từ cùng một reviewed execution envelope'), 'Protected evidence fields must share one reviewed envelope')

for (const marker of [
  'load exactly one `platform_owner_authority` global control row',
  'acquire global control lock **before** assignment rows',
  'state `NOT_COMPLETED`',
  'state `COMPLETED`',
  'increments bootstrap epoch and control version',
  'Recovery and normal grant race on the same global row',
  'Two grants cùng target mới serialize trên global row',
  'resulting bootstrap epoch and irreversible first-bootstrap state recorded',
  'approved environment-bound envelope/digest evidence linked',
]) assert(runbook.includes(marker), `Missing protected mutex/envelope runbook contract: ${marker}`)

const runbookGlobalLock = runbook.indexOf('acquire global control lock **before** assignment rows')
const runbookAssignmentLock = runbook.indexOf('acquire involved assignment locks by sorted immutable user ID')
assert(runbookGlobalLock >= 0 && runbookAssignmentLock > runbookGlobalLock, 'Runbook must lock global control before assignments')

for (const [content, marker] of [
  [authorityDesign, 'F23_12A_FINAL_TECHNICAL_AUDIT: PASS'],
  [consoleDesign, 'F23_12B_FINAL_TECHNICAL_AUDIT: PASS'],
  [actingDesign, 'F23_12C_FINAL_TECHNICAL_AUDIT: PASS'],
  [actingDesign, 'F23.12C FINAL TECHNICAL AUDIT PASS - F23.12D DESIGN MAY START'],
]) assert(content.includes(marker), `Missing upstream final-audit sync: ${marker}`)

for (const marker of [
  'F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở',
  'F23.12A DONE design',
  'F23.12B DONE design / Global Internal Console và center inventory',
  'F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit',
  'F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill',
]) {
  for (const [name, content] of [
    ['A design', authorityDesign],
    ['B design', consoleDesign],
    ['C design', actingDesign],
    ['D design', design],
    ['canonical roadmap', roadmap],
  ]) assert(content.includes(marker), `${name} roadmap missing: ${marker}`)
}

const scopedDocs = `${design}\n${runbook}`
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const secretPatterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*\S+/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
]
assert(!emailPattern.test(scopedDocs), 'F23.12D docs must not contain an email address')
assert(!uuidPattern.test(scopedDocs), 'F23.12D docs must not contain a real/fixture UUID')
for (const pattern of secretPatterns) assert(!pattern.test(scopedDocs), `Potential secret found: ${pattern}`)
assert(!/```sql/i.test(scopedDocs), 'F23.12D docs must not include executable SQL fences')
assert(!/\b(?:insert\s+into|update\s+public\.|delete\s+from|create\s+table|alter\s+table)\b/i.test(scopedDocs), 'F23.12D docs must not include executable SQL')
assert(!design.includes('REAL_PLATFORM_OWNER_ASSIGNMENT: YES'))
assert(!design.includes('CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: YES'))
assert(!design.includes('F23_12D_IMPLEMENTATION_READINESS: READY'))
assert(!design.includes('F23_12_RUNTIME_IMPLEMENTATION: DONE'))
assert(!design.includes('F23.12D GLOBAL AUTHORITY MUTEX AND EXECUTION ENVELOPE HARDENING COMPLETE - READY FOR FINAL AUDIT'))
assert(!design.includes('CLIENT_SELF_GRANT_ALLOWED: YES'))
assert(!design.includes('PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: NO'))
assert(!scopedDocs.includes('EMPTY_ASSIGNMENT_SET_IS_MUTEX: YES'))
assert(!scopedDocs.includes('EMPTY_ASSIGNMENT_SET_PROVIDES_BOOTSTRAP_SERIALIZATION: YES'))
assert(!scopedDocs.includes('COMPLETED -> NOT_COMPLETED'), 'First-bootstrap state must never reset')
assert(!scopedDocs.includes('CROSS_ENVIRONMENT_OR_SCHEMA_REPLAY_ALLOWED: YES'))
assert(!scopedDocs.includes('CROSS_ENVIRONMENT_PAYLOAD_REPLAY_ALLOWED: YES'))
assert(executionEnvelope.includes('Mọi thay đổi environment fingerprint'), 'Environment fingerprint must be inside digest-bound envelope')

const privateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!scopedDocs.includes(privateWorkspaceLabel), 'F23.12D docs must not include private workspace labels')

const characters = (...codePoints) => String.fromCodePoint(...codePoints)
const mojibakeMarkers = [
  characters(0x43, 0x00e1, 0x00ba),
  characters(0x00c3),
  characters(0x00c6, 0x00b0),
  characters(0x48, 0x00e1, 0x00ba),
  characters(0x00e1, 0x00bb),
  characters(0xfffd),
]
for (const content of [design, runbook, authorityDesign, consoleDesign, actingDesign, roadmap]) {
  for (const marker of mojibakeMarkers) assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
}

console.log('F23.12D controlled bootstrap and revoke design docs smoke: PASS')
