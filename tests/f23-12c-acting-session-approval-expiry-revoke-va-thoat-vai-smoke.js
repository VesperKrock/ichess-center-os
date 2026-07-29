import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-12c-acting-session-approval-expiry-revoke-va-thoat-vai.md')
const consoleDesign = read('docs/f23-12b-global-internal-console-va-center-inventory.md')
const authorityDesign = read('docs/f23-12a-platform-owner-role-va-nguon-cap-quyen-server-side.md')
const roadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

for (const marker of [
  'F23_12C_STATUS: DONE DESIGN',
  'F23_12C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'CANONICAL_MACHINE_ROLE: platform_owner',
  'PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES',
  'GLOBAL_CONTEXT_AND_CENTER_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'MEMBERSHIP_CONTEXT_AND_ACTING_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'BROWSER_BACK_REQUIRES_CONTEXT_REVALIDATION: YES',
  'CONTEXT_TRANSITION_CLEARS_INCOMPATIBLE_DATA: YES',
  'ACTING_CREATES_CENTER_MEMBERSHIP: NO',
  'ACTING_IMPERSONATES_CENTER_USER: NO',
  'ACTING_SESSION_ID_ALONE_GRANTS_AUTHORITY: NO',
  'ACTING_AUTHORIZATION_REQUIRES_AUTH_UID_BINDING: YES',
  'SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO',
  'SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES',
  'SELF_APPROVAL_ALLOWED: NO',
  'READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO',
  'ACTING_MAX_TTL_MINUTES: 30',
  'ACTING_AUTO_RENEW_ALLOWED: NO',
  'ACTING_START_RECONCILES_EXPIRED_ACTIVE_ROWS: YES',
  'EXPIRED_ACTIVE_ROW_MAY_BLOCK_NEW_SESSION: NO',
  'ACTIVE_STATUS_ALONE_DEFINES_EFFECTIVE_AUTHORITY: NO',
  'ACTING_START_STABLE_ACTOR_LOCK_REQUIRED: YES',
  'EMPTY_ACTING_ROW_SET_PROVIDES_SERIALIZATION: NO',
  'ACTING_START_LOCK_TARGET: ACTIVE_PLATFORM_ASSIGNMENT_ROW',
  'ACTING_CANONICAL_LOCK_ORDER_DEFINED: YES',
  'ACTING_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'ACTING_UNIQUENESS_IS_INTEGRITY_BACKSTOP: YES',
  'ACTING_UNIQUENESS_REPLACES_STABLE_ACTOR_LOCK: NO',
  'ONE_ACTIVE_ACTING_SESSION_PER_ACTOR: YES',
  'MULTI_TAB_DOES_NOT_CREATE_MULTIPLE_AUTHORITIES: YES',
  'BROWSER_HISTORY_IS_NOT_AUTHORITY: YES',
  'ACTIVATION_AND_ACTION_APPROVALS_ARE_DISTINCT: YES',
  'ACTION_APPROVAL_REPLACES_ACTIVATION_APPROVAL: NO',
  'ONE_SESSION_MAY_HAVE_MULTIPLE_ACTION_APPROVALS: YES',
  'ACTION_APPROVAL_SINGLE_EXACT_ACTION: YES',
  'ACTION_APPROVAL_SINGLE_EXACT_SUBJECT_DEFAULT: YES',
  'ACTION_APPROVAL_WILDCARD_ALLOWED: NO',
  'ACTION_APPROVAL_BULK_BY_DEFAULT_ALLOWED: NO',
  'LOW_RISK_SELF_START_APPROVAL_MODE: POLICY_SELF_START',
  'LOW_RISK_SELF_START_REQUIRES_HUMAN_APPROVER: NO',
  'LOW_RISK_SELF_START_CREATES_FAKE_APPROVER: NO',
  'LOW_RISK_SELF_START_IS_SELF_APPROVAL: NO',
  'RUNTIME_CHANGE: NO',
  'ROUTE_IMPLEMENTED: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'AUTH_CHANGE: NO',
  'REAL_ASSIGNMENT_CHANGE: NO',
  'F23.12C FINAL TECHNICAL AUDIT PASS - F23.12D DESIGN MAY START',
]) assert(design.includes(marker), `Missing F23.12C marker: ${marker}`)

for (const state of [
  'DRAFT',
  'REQUESTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'EXPIRED',
  'ENDED',
  'REVOKED',
  'DENIED',
  'CANCELLED',
]) assert(design.includes(`\`${state}\``), `Missing acting lifecycle state: ${state}`)

for (const field of [
  'acting_session_id',
  'platform_actor_user_id',
  'target_center_id',
  'status',
  'requested_scopes',
  'approved_scopes',
  'reason_code',
  'reason_text_redacted',
  'requested_at',
  'requested_by_user_id',
  'approval_mode',
  'activation_approval_id',
  'approved_by_user_id',
  'approved_at',
  'started_at',
  'expires_at',
  'ended_at',
  'ended_by_user_id',
  'end_reason',
  'revoked_at',
  'revoked_by_user_id',
  'revoke_reason',
  'authority_assignment_id',
  'authority_version_at_start',
  'session_version',
  'request_id',
  'created_at',
  'updated_at',
]) assert(design.includes(field), `Missing acting field: ${field}`)

for (const field of [
  'approval_id',
  'approval_purpose',
  'requester_user_id',
  'approver_user_id',
  'action_digest',
  'issued_at',
  'consumed_at',
  'consumed_by_request_id',
  'approval_version',
  'created_at',
  'updated_at',
  'approved_scope_set',
  'session_start_action',
  'authority_version',
  'action_approval_id',
  'approved_scope',
  'approved_action',
  'approved_subject_type',
  'approved_subject_id',
  'canonical_payload_digest',
]) assert(design.includes(field), `Missing approval field: ${field}`)

const actingSchemaMatch = design.match(/### 6\.1 Acting request\/session\s+```text\s+([\s\S]*?)```/)
assert(actingSchemaMatch, 'Missing acting-session schema block')
const actingSessionFields = actingSchemaMatch[1]
  .split(/\r?\n/)
  .map((field) => field.trim())
  .filter(Boolean)
assert(!actingSessionFields.includes('approval_id'), 'Acting session must not keep one ambiguous approval_id')
assert(!actingSessionFields.includes('action_approval_id'), 'Acting session must not keep one current action approval field')
assert(actingSessionFields.includes('approval_mode'), 'Acting session must include approval_mode')
assert(actingSessionFields.includes('activation_approval_id'), 'Acting session must include activation_approval_id')

for (const marker of [
  'approval_mode = POLICY_SELF_START',
  'activation_approval_id = NULL',
  'approved_by_user_id = NULL',
  'approval_mode = SECOND_OPERATOR',
  'activation_approval_id` required',
  'approval_purpose == ACTION_APPROVAL',
  'action_approval_id -> acting_session_id',
]) assert(design.includes(marker), `Missing approval-mode boundary: ${marker}`)

const approvalSchemaMatches = [
  design.match(/Common approval-record fields:\s+```text\s+([\s\S]*?)```/),
  design.match(/Fields riêng cho `ACTIVATION_APPROVAL`:\s+```text\s+([\s\S]*?)```/),
  design.match(/Fields riêng cho `ACTION_APPROVAL`:\s+```text\s+([\s\S]*?)```/),
]
for (const match of approvalSchemaMatches) assert(match, 'Missing purpose-specific approval schema block')
const approvalSchemaFields = approvalSchemaMatches.map((match) => match[1]).join('\n')
assert(!approvalSchemaFields.includes('approved_subjects'), 'Approval schema must not use ambiguous approved_subjects array')
assert(!approvalSchemaFields.includes('approved_actions'), 'Approval schema must not use ambiguous approved_actions array')

const schemaLines = (match) => match[1].split(/\r?\n/).map((field) => field.trim()).filter(Boolean)
const commonApprovalFields = schemaLines(approvalSchemaMatches[0])
const activationApprovalFields = schemaLines(approvalSchemaMatches[1])
const actionApprovalFields = schemaLines(approvalSchemaMatches[2])
for (const field of [
  'approval_id', 'approval_purpose', 'requester_user_id', 'approver_user_id',
  'target_center_id', 'acting_session_id', 'action_digest', 'issued_at', 'expires_at',
  'consumed_at', 'consumed_by_request_id', 'status', 'approval_version', 'created_at', 'updated_at',
]) assert(commonApprovalFields.includes(field), `Missing common approval schema field: ${field}`)
for (const field of ['approved_scope_set', 'session_start_action', 'authority_version', 'session_version']) {
  assert(activationApprovalFields.includes(field), `Missing activation approval field: ${field}`)
}
for (const field of [
  'action_approval_id', 'approved_scope', 'approved_action', 'approved_subject_type',
  'approved_subject_id', 'canonical_payload_digest',
]) assert(actionApprovalFields.includes(field), `Missing action approval field: ${field}`)

const lockOrderMatch = design.match(/### 5\.3 Canonical lock ordering[\s\S]*?```text\s+([\s\S]*?)```/)
assert(lockOrderMatch, 'Missing canonical lock-order block')
let previousLockIndex = -1
for (const lockTier of [
  'platform assignment rows',
  'actor acting-session rows',
  'exact approval row',
  'exact business target rows',
  'audit/outbox rows',
]) {
  const currentLockIndex = lockOrderMatch[1].indexOf(lockTier)
  assert(currentLockIndex > previousLockIndex, `Lock tier missing or out of order: ${lockTier}`)
  previousLockIndex = currentLockIndex
}

for (const scope of [
  'center.schedule.summary.read',
  'center.attendance.summary.read',
  'center.module.readiness.read',
  'center.non_sensitive_support_metadata.read',
  'center.schedule.write',
  'center.attendance.write',
  'center.student.basic.write',
  'center.staff.basic.write',
  'center.membership.write',
  'center.private_hr.metadata.read',
  'center.private_hr.object.view',
  'center.private_hr.object.download',
  'center.financial_private.read',
  'center.identity_full.read',
  'center.private_voucher.read',
]) assert(design.includes(scope), `Missing acting scope: ${scope}`)

for (const marker of [
  '## 9. Re-authentication contract',
  'Recommended freshness gate: tối đa 5 phút',
  '### 5.1 Effective-active và start-time expiry reconciliation',
  'effective_active =',
  '### 5.2 Stable actor serialization target',
  'platform_operator_assignments',
  'khóa stable assignment row',
  're-check assignment dưới lock',
  '### 5.3 Canonical lock ordering',
  'sorted user_id',
  'Không giữ database lock trong lúc',
  'external notification',
  '### 5.4 Mutex, database invariant và effective authority',
  'database uniqueness/invariant     -> integrity backstop',
  'ghi `acting.expired` bằng audit row hoặc transactional-outbox row trong cùng transaction',
  '### 10.1 Mười tám bước start transaction',
  '### 10.2 Per-request authorization',
  '### 10.3 Mười bốn per-action approval checks',
  'auth.uid()',
  'server_now < expires_at',
  '## 11. Approval lifecycle và exact single-use digest',
  'ACTIVATION_APPROVAL',
  'ACTION_APPROVAL',
  'POLICY_SELF_START',
  'SECOND_OPERATOR',
  'requester khác approver',
  'recommended SHA-256',
  'compare-and-swap',
  'action consume + exact action mutation/read grant + audit/outbox atomic',
  'Canonical batch không mặc định được suy từ array',
  'activation_approval_id = NULL',
  'approved_by_user_id = NULL',
  'policy_version',
  'Implementation còn bị khóa bởi canonical `platform_operator_assignments` stable mutex',
  'F23.12C.2 final technical audit đã PASS',
  'Smoke vẫn chỉ là docs-contract test, không phải runtime concurrency proof',
  'Warning persistent ở còn 5 phút và 1 phút',
  'Heartbeat, focus, reload, tab mới hoặc activity không gia hạn',
  'Revoke transaction phải đổi state, tăng `session_version`',
  'Thoát chế độ hỗ trợ',
  'không giả vờ đã thoát',
  'dừng student/teacher/schedule/attendance/tuition',
  'Acting Center A → Acting Center B',
  'Không direct switch',
  'Docs smoke chỉ kiểm contract tài liệu, không phải runtime security proof',
]) assert(design.includes(marker), `Missing F23.12C security contract: ${marker}`)

for (const state of [
  'ACTING_REQUEST_DRAFT',
  'ACTING_REQUESTED',
  'ACTING_PENDING_APPROVAL',
  'ACTING_APPROVED',
  'ACTING_STARTING',
  'ACTING_ACTIVE_READ',
  'ACTING_ACTIVE_WRITE',
  'ACTING_SENSITIVE_ACTION_PENDING',
  'ACTING_EXPIRING',
  'ACTING_EXPIRED',
  'ACTING_REVOKED',
  'ACTING_ENDED',
  'ACTING_DENIED',
  'ACTING_CANCELLED',
  'ACTING_ERROR',
  'ACTING_CONTEXT_MISMATCH',
  'ACTING_VERSION_STALE',
]) assert(design.includes(`\`${state}\``), `Missing F23.12C UI state: ${state}`)

for (const code of [
  'acting_session_required',
  'acting_session_not_found',
  'acting_session_inactive',
  'acting_session_expired',
  'acting_session_revoked',
  'acting_session_actor_mismatch',
  'acting_session_center_mismatch',
  'acting_session_scope_denied',
  'acting_session_version_stale',
  'acting_session_already_active',
  'acting_session_start_blocked',
  'acting_session_reauth_required',
  'acting_session_approval_required',
  'acting_session_approval_invalid',
  'acting_session_approval_consumed',
  'acting_session_context_conflict',
  'acting_session_service_unavailable',
  'single_operator_approval_unavailable',
  'action_forbidden',
  'action_deferred',
]) assert(design.includes(code), `Missing safe error code: ${code}`)

for (const event of [
  'acting.requested',
  'acting.approved',
  'acting.rejected',
  'acting.cancelled',
  'acting.started',
  'acting.start_denied',
  'acting.scope_denied',
  'acting.sensitive_action_requested',
  'acting.sensitive_action_consumed',
  'acting.expiring',
  'acting.expired',
  'acting.ended',
  'acting.revoked',
  'acting.context_mismatch',
  'acting.version_stale',
]) assert(design.includes(event), `Missing audit event: ${event}`)

for (let index = 1; index <= 45; index += 1) {
  assert(design.includes(`| ${index} |`), `Missing negative test case ${index}`)
}

for (const marker of [
  '`ACTIVE` row đã quá hạn nhưng chưa transition, actor start session mới',
  'Expiry reconciliation audit insert lỗi',
  'Expiry reconciliation và hai tab start đồng thời',
  'Activation approval bị dùng làm action approval',
  'Action approval session A dùng cho session B',
  'Action approval có nhiều subject nhưng không phải canonical batch đã duyệt',
  'Low-risk self-start ghi requester làm approver',
  'Low-risk self-start tạo fake system user làm approver',
  '`POLICY_SELF_START` yêu cầu scope ngoài low-risk allowlist',
  '`SECOND_OPERATOR` thiếu `activation_approval_id`',
  'Action approval bị ghi đè vào `activation_approval_id`',
  'Action approval exact subject nhưng payload đã đổi',
  'Hai tab start acting lần đầu khi actor chưa có acting row',
  'Authority assignment revoke đồng thời actor start acting',
  'Hai Platform Owner đồng thời approve/start hoặc revoke session của nhau',
]) assert(design.includes(marker), `Missing C.1/C.2 negative test contract: ${marker}`)

for (const threat of [
  'Session replay',
  'Cross-center swap',
  'Self-approval',
  'Approver compromised',
  'Stale assignment',
  'Stale account state',
  'Multi-tab confusion',
  'Browser history restoration',
  'Signed URL leakage',
  'Sensitive screenshot/download',
  'Context mixing',
  'Expiry race',
  'Revoke race',
  'Audit failure',
  'Universal wildcard scope',
  'Membership impersonation',
  'Client clock manipulation',
  'Local storage spoof',
  'Stale-active deadlock',
  'Approval type confusion',
  'Approval bundling',
  'Fake policy approver',
  'Empty-set locking race',
  'Lock-order deadlock',
]) assert(design.includes(`| ${threat} |`), `Missing threat: ${threat}`)

for (let index = 1; index <= 18; index += 1) {
  assert(design.includes(`C-AG${index}`), `Missing approval gate C-AG${index}`)
}

for (const marker of [
  'F23_12B_FINAL_TECHNICAL_AUDIT: PASS',
  'G0 — low-sensitivity platform governance metadata',
  'G0 không phải public data',
  'GLOBAL_CONTEXT_AND_CENTER_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'MEMBERSHIP_CONTEXT_AND_ACTING_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'BROWSER_BACK_REQUIRES_CONTEXT_REVALIDATION: YES',
  'CONTEXT_TRANSITION_CLEARS_INCOMPATIBLE_DATA: YES',
  'F23.12B FINAL TECHNICAL AUDIT PASS - F23.12C DESIGN MAY START',
]) assert(consoleDesign.includes(marker), `F23.12B audit sync missing: ${marker}`)

for (const marker of [
  'F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở',
  'F23.12A DONE design',
  'F23.12B DONE design / Global Internal Console và center inventory',
  'F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed',
  'F23.12D DONE design / Controlled bootstrap, assignment và revoke drill',
]) {
  assert(design.includes(marker), `F23.12C roadmap missing: ${marker}`)
  assert(consoleDesign.includes(marker), `F23.12B roadmap missing: ${marker}`)
  assert(authorityDesign.includes(marker), `F23.12A roadmap missing: ${marker}`)
  assert(roadmap.includes(marker), `Canonical roadmap missing: ${marker}`)
}

assert(!design.includes('G0 — public-neutral platform metadata'))
assert(!design.includes('F23.12 implementation DONE'))
assert(!design.includes('SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: YES'))
assert(!design.includes('SELF_APPROVAL_ALLOWED: YES'))
assert(!design.includes('READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: YES'))
assert(!design.includes('ACTING_SESSION_ID_ALONE_GRANTS_AUTHORITY: YES'))
assert(!design.includes('ACTING_CREATES_CENTER_MEMBERSHIP: YES'))
assert(!design.includes('ACTING_IMPERSONATES_CENTER_USER: YES'))
assert(!design.includes('ACTING_START_RECONCILES_EXPIRED_ACTIVE_ROWS: NO'))
assert(!design.includes('EXPIRED_ACTIVE_ROW_MAY_BLOCK_NEW_SESSION: YES'))
assert(!design.includes('ACTIVE_STATUS_ALONE_DEFINES_EFFECTIVE_AUTHORITY: YES'))
assert(!design.includes('ACTION_APPROVAL_REPLACES_ACTIVATION_APPROVAL: YES'))
assert(!design.includes('ACTION_APPROVAL_WILDCARD_ALLOWED: YES'))
assert(!design.includes('ACTION_APPROVAL_BULK_BY_DEFAULT_ALLOWED: YES'))
assert(!design.includes('LOW_RISK_SELF_START_REQUIRES_HUMAN_APPROVER: YES'))
assert(!design.includes('LOW_RISK_SELF_START_CREATES_FAKE_APPROVER: YES'))
assert(!design.includes('LOW_RISK_SELF_START_IS_SELF_APPROVAL: YES'))
assert(!design.includes('ACTING_START_STABLE_ACTOR_LOCK_REQUIRED: NO'))
assert(!design.includes('EMPTY_ACTING_ROW_SET_PROVIDES_SERIALIZATION: YES'))
assert(!design.includes('ACTING_LOCK_ORDER_INVERSION_ALLOWED: YES'))
assert(!design.includes('ACTING_UNIQUENESS_IS_INTEGRITY_BACKSTOP: NO'))
assert(!design.includes('ACTING_UNIQUENESS_REPLACES_STABLE_ACTOR_LOCK: YES'))
assert(!design.includes('expired ACTIVE row được bỏ qua'))
assert(!design.includes('F23.12C ACTING SESSION DESIGN COMPLETE - READY FOR TECHNICAL AUDIT'))
assert(!design.includes('F23.12C EXPIRY AND APPROVAL MODEL HARDENING COMPLETE - READY FOR FINAL AUDIT'))
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'F23.12C design must not contain an email address')

const privateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!design.includes(privateWorkspaceLabel), 'F23.12C design must not include private workspace labels')

const characters = (...codePoints) => String.fromCodePoint(...codePoints)
const mojibakeMarkers = [
  characters(0x43, 0x00e1, 0x00ba),
  characters(0x00c3),
  characters(0x00c6, 0x00b0),
  characters(0x48, 0x00e1, 0x00ba),
  characters(0x00e1, 0x00bb),
  characters(0xfffd),
]

for (const content of [design, consoleDesign, authorityDesign, roadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.12C acting session design docs smoke: PASS')
