import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const identityDesign = read('docs/f23-13b-google-identity-linking-va-login-recovery-semantics.md')
const foundation = read('docs/f23-13a-auth-security-google-identity-mfa-va-consultant-access-audit.md')
const platformDesign = read('docs/f23-12d-controlled-platform-owner-bootstrap-assignment-va-revoke-drill.md')
const canonicalRoadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const realtimeRoadmapPath = path.join(root, 'RoadmapRealTime.txt')
const realtimeRoadmap = fs.existsSync(realtimeRoadmapPath)
  ? fs.readFileSync(realtimeRoadmapPath, 'utf8')
  : ''

for (const marker of [
  'F23_13_STATUS: DONE DESIGN',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13C_STATUS: DONE DESIGN',
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13D_STATUS: DONE DESIGN',
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_13_AUTH_CONFIGURATION_CHANGE: NO',
  'F23_13_SUPABASE_ACTION: NOT RUN',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'RUNTIME_CHANGE: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'AUTH_CHANGE: NO',
  'MFA_ENABLEMENT_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'REAL_QR_CREATED: NO',
  'REAL_FACTOR_CHANGE: NO',
  'REAL_ACCOUNT_CHANGE: NO',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
]) assert(design.includes(marker), `Missing status/design-only marker: ${marker}`)

assert(
  !design.includes('F23.13C MFA ENROLLMENT ENFORCEMENT RECOVERY AND STEP-UP DESIGN COMPLETE - READY FOR TECHNICAL AUDIT'),
  'F23.13C stale pre-hardening final line must be replaced.',
)
assert(
  !design.includes('F23.13C INTEGRATION HARDENING COMPLETE - READY FOR FINAL TECHNICAL AUDIT'),
  'F23.13C stale pre-final-audit line must be replaced.',
)
assert(
  design.endsWith('F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE\n'),
  'F23.13 parent closeout must be the exact document ending.',
)

for (const marker of [
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
  'ACCOUNT_IDENTITY_MUTEX_REQUIRED: YES',
  'PROVIDER_SUBJECT_MUTEX_REQUIRED: YES',
  'IDENTITY_MUTATION_LOCK_ORDER_DEFINED: YES',
  'LINK_CEREMONY_BINDS_ENVIRONMENT_FINGERPRINT: YES',
]) assert(identityDesign.includes(marker), `F23.13B final-audit/contract sync missing: ${marker}`)

assert(
  !identityDesign.includes('F23.13B IDENTITY LINK MUTEX AND VERSIONED CEREMONY HARDENING COMPLETE - READY FOR FINAL AUDIT'),
  'F23.13B stale pre-final-audit line must be replaced.',
)

for (const marker of [
  'F23_12D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_FINAL_TECHNICAL_AUDIT: PASS',
  'F23.12D FINAL TECHNICAL AUDIT PASS - F23.13 DESIGN MAY START',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
]) assert(platformDesign.includes(marker), `F23.12 boundary changed or missing: ${marker}`)

for (const classification of [
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
]) assert(design.includes(classification), `Missing classification: ${classification}`)

for (const repoTruth of [
  'MFA_RUNTIME_IMPLEMENTED: NO',
  'TOTP_RUNTIME_IMPLEMENTED: NO',
  'WEBAUTHN_RUNTIME_IMPLEMENTED: NO',
  'MFA_RECOVERY_RUNTIME_IMPLEMENTED: NO',
  'SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO',
  'AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO',
  'CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO',
  'GOOGLE_IDENTITY_LINKING_IMPLEMENTED: NO',
  'không chứng minh remote production',
  'UI badge, role label, browser timestamp hoặc access token hiện hữu không phải bằng chứng MFA/step-up',
]) assert(design.includes(repoTruth), `Missing inherited repo truth: ${repoTruth}`)

for (const marker of [
  'MFA_INITIAL_BASELINE: TOTP',
  'PHISHING_RESISTANT_DIRECTION: WEBAUTHN_OR_HARDWARE_SECURITY_KEY',
  'SMS_OTP_DEFAULT_FACTOR: NO',
  'EMAIL_OTP_ALWAYS_COUNTS_AS_STRONG_SECOND_FACTOR: NO',
  'RECOVERY_CODE_IS_ENROLLED_FACTOR: NO',
  'PLATFORM_OWNER_PRODUCTION_HARDWARE_BACKED_MFA_REQUIRED: YES',
  'TOTP authenticator',
  'WebAuthn/passkey',
  'Hardware-backed security key',
  'SMS OTP',
  'Email OTP',
  'Recovery codes',
]) assert(design.includes(marker), `Missing MFA taxonomy/recommendation: ${marker}`)

for (const marker of [
  'PLATFORM_OWNER_MFA_POLICY: HARDWARE_BACKED_REQUIRED',
  'PLATFORM_OWNER_MFA_GRACE_PERIOD_DAYS: 0',
  'OWNER_MFA_BASELINE: TOTP_OR_STRONGER',
  'CENTER_ADMIN_MFA_BASELINE: TOTP_OR_STRONGER',
  'CONSULTANT_PII_WRITE_MFA_REQUIRED: YES',
  'TEACHER_MFA_POLICY: DEFERRED_RISK_TIER',
  'MFA_POLICY_SERVER_DERIVED: YES',
  'MFA_GRACE_PERIOD_GRANTS_SENSITIVE_ACCESS: NO',
  'ROLE_ESCALATION_BYPASSES_MFA_POLICY: NO',
  'MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: NO',
  'Sensitive action bị khóa ngay cả trong grace',
]) assert(design.includes(marker), `Missing role-based MFA policy: ${marker}`)

for (const field of [
  'account_security_control',
  'canonical_user_id',
  'security_version',
  'session_version',
  'identity_control_version',
  'factor_control_version',
  'assurance_policy_version',
]) assert(design.includes(field), `Missing account-security field: ${field}`)

for (const marker of [
  'ACCOUNT_SECURITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'ACCOUNT_SECURITY_MUTATION_LOCK_TARGET: ACCOUNT_SECURITY_CONTROL_ROW',
  'DUPLICATE_SECURITY_VERSION_SOURCES_ALLOWED: NO',
  'EMPTY_FACTOR_SET_PROVIDES_SERIALIZATION: NO',
  'FACTOR_UNIQUENESS_REPLACES_ACCOUNT_MUTEX: NO',
  'ACCOUNT_IDENTITY_CONTROL_IS_CANONICAL_SECURITY_CONTROL_ROLE: YES',
  'ACCOUNT_IDENTITY_CONTROL_STORES_SECURITY_SESSION_VERSION_COPY: NO',
  'Row phải tồn tại trước mọi identity hoặc factor mutation',
  'không lưu bản sao độc lập của security/session versions',
  'Identity và factor mutation cập nhật shared versions dưới cùng canonical parent lock',
]) assert(design.includes(marker), `Missing canonical account-security mutex/version contract: ${marker}`)

for (const field of [
  'factor_id',
  'factor_type',
  'factor_status',
  'factor_version',
  'assurance_class',
  'secret_material_ref',
  'external_credential_identifier_digest',
  'enrollment_id',
  'last_accepted_time_step',
  'compromise_version',
]) assert(design.includes(field), `Missing factor-model field: ${field}`)

for (const status of [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'COMPROMISED',
  'REPLACED',
  'EXPIRED',
]) assert(design.includes(status), `Missing factor status: ${status}`)

for (const marker of [
  'REVOKED_FACTOR_MAY_BE_REACTIVATED: NO',
  'PENDING_FACTOR_GRANTS_ASSURANCE: NO',
  'FACTOR_ID_ALONE_GRANTS_AUTHORITY: NO',
  'MAX_ACTIVE_TOTP_FACTORS_PER_ACCOUNT: 1',
  'ONE_LIVE_FACTOR_ENROLLMENT_PER_ACCOUNT_TYPE: YES',
  'MIN_ACTIVE_HARDWARE_FACTORS_FOR_PLATFORM_OWNER: 2',
  'EXTERNAL_FACTOR_IDENTIFIER_MUTEX_REQUIRED: YES',
  'EXTERNAL_FACTOR_UNIQUE_INDEX_IS_ONLY_BACKSTOP: YES',
  'versioned_digest(environment_namespace, factor_type, credential_identifier)',
  'TOTP secret không được dùng làm mutex key',
  'Mutex service missing/timeout fail closed',
]) assert(design.includes(marker), `Missing factor count/external mutex contract: ${marker}`)

for (const state of [
  'NOT_ENROLLED',
  'ENROLLMENT_INTENT_CREATED',
  'SECRET_ISSUED',
  'CONFIRMATION_PENDING',
  'ACTIVE',
  'REAUTH_REQUIRED',
  'EXPIRED',
  'SUSPENDED',
  'REVOKED',
  'REPLACED',
  'RECOVERY_REQUIRED',
  'RESET_PENDING_APPROVAL',
]) assert(design.includes(`\`${state}\``), `Missing enrollment lifecycle state: ${state}`)

for (const field of [
  'enrollment_intent_id',
  'ceremony_contract_version',
  'environment_fingerprint',
  'logical_security_session_id',
  'factor_policy_version',
  'account_security_version_at_creation',
  'session_version_at_creation',
  'factor_control_version_at_creation',
  'intent_version',
  'idempotency_key',
]) assert(design.includes(field), `Missing enrollment-envelope field: ${field}`)

for (const marker of [
  'MFA_ENROLLMENT_INTENT_SINGLE_USE: YES',
  'MFA_ENROLLMENT_INTENT_SERVER_STORED: YES',
  'MFA_ENROLLMENT_DEFAULT_TTL_MINUTES: 10',
  'MFA_ENROLLMENT_BINDS_LOGICAL_SECURITY_SESSION: YES',
  'MFA_ENROLLMENT_BINDS_ACCOUNT_SECURITY_VERSION: YES',
  'MFA_ENROLLMENT_BINDS_SESSION_VERSION: YES',
  'MFA_ENROLLMENT_BINDS_FACTOR_CONTROL_VERSION: YES',
  'tạo tối đa một nonterminal live enrollment/account/type',
  'Empty pending-enrollment/factor query không serialize creation',
]) assert(design.includes(marker), `Missing one-live enrollment contract: ${marker}`)

for (const marker of [
  'TOTP_SECRET_CLIENT_GENERATED_ALLOWED: NO',
  'TOTP_SECRET_BROWSER_STORAGE_ALLOWED: NO',
  'TOTP_SECRET_LOGGING_ALLOWED: NO',
  'TOTP_SECRET_PLAINTEXT_PERSISTENCE_ALLOWED: NO',
  'QR_PROVISIONING_PAYLOAD_PUBLIC_STORAGE_ALLOWED: NO',
  'REAL_TOTP_SECRET_GENERATED_BY_THIS_PHASE: NO',
  'cryptographically secure randomness',
  'controlled, no-cache, one-time, re-auth-bound enrollment view',
  'Không tạo QR hoặc seed thật trong phase này',
]) assert(design.includes(marker), `Missing TOTP secret/QR boundary: ${marker}`)

for (const marker of [
  'TOTP_DIGITS: 6',
  'TOTP_TIME_STEP_SECONDS: 30',
  'TOTP_ALLOWED_CLOCK_SKEW_STEPS: 1',
  'TOTP_CODE_REUSE_ACROSS_CHALLENGES_ALLOWED: NO',
  'TOTP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO',
  'TOTP_ACCEPTED_TIMESTEP_MUST_ADVANCE_MONOTONICALLY: YES',
  'TOTP_CANDIDATE_TIMESTEP_LESS_THAN_OR_EQUAL_TO_HIGHEST_ACCEPTED_ALLOWED: NO',
  'OLDER_TOTP_TIMESTEP_AFTER_NEWER_ACCEPTED_CAN_SUCCEED: NO',
  'Algorithm là approval gate cần interoperability validation',
  '`last_accepted_time_step` được định nghĩa canonical là `highest_accepted_time_step`',
  'candidate_time_step > highest_accepted_time_step',
  'reject candidate `<= highest_accepted_time_step`',
  'code của timestep cũ hơn bị `mfa_challenge_replayed` kể cả nó vẫn nằm trong ±1 skew',
  'không hạ highest timestep',
  'approved consumed-step registry tương đương',
  'Không fallback sang rule “candidate khác timestep cuối”',
  'last_accepted_time_step',
]) assert(design.includes(marker), `Missing TOTP confirmation/replay contract: ${marker}`)

for (const marker of [
  'MFA_MUTATION_LOCK_ORDER_DEFINED: YES',
  'EXTERNAL_FACTOR_MUTEX_PRECEDES_ACCOUNT_SECURITY_MUTEX: YES',
  'MFA_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'Không lấy account lock rồi quay lại lấy external mutex',
  'Không giữ database lock khi user nhập code',
]) assert(design.includes(marker), `Missing MFA lock-order marker: ${marker}`)

const lockOrderStart = design.indexOf('Canonical MFA mutation lock order:')
const lockOrderEnd = design.indexOf('TOTP/no-external-identifier lock order:', lockOrderStart)
assert(lockOrderStart >= 0 && lockOrderEnd > lockOrderStart, 'Canonical MFA lock-order section is missing.')
const lockOrder = design.slice(lockOrderStart, lockOrderEnd)
const orderedLockTargets = [
  '0. STABLE_EXTERNAL_FACTOR_MUTEX',
  '1. ACCOUNT_SECURITY_CONTROL_ROW',
  '2. ENROLLMENT_RESET_RECOVERY_REQUEST_ROWS',
  '3. FACTOR_ROWS',
  '4. RECOVERY_CODE_ROWS',
  '5. SESSION_STEP_UP_ROWS',
  '6. AUDIT_OUTBOX_ROWS',
]
let previousLockIndex = -1
for (const target of orderedLockTargets) {
  const currentLockIndex = lockOrder.indexOf(target)
  assert(currentLockIndex > previousLockIndex, `MFA lock target missing/out of order: ${target}`)
  previousLockIndex = currentLockIndex
}

for (const marker of [
  'MFA_CHALLENGE_SINGLE_USE: YES',
  'MFA_CHALLENGE_CLIENT_IS_AUTHORITY: NO',
  'MFA_CHALLENGE_PURPOSE_BOUND: YES',
  'AAL1_PRIMARY_ONLY',
  'AAL2_TOTP',
  'AAL2_PHISHING_RESISTANT',
  'AAL3_HARDWARE_BACKED',
  'Unknown assurance hoặc dependency unavailable deny',
]) assert(design.includes(marker), `Missing challenge/assurance contract: ${marker}`)

for (const marker of [
  'STEP_UP_DEFAULT_FRESHNESS_MINUTES: 10',
  'STEP_UP_CRITICAL_FRESHNESS_MINUTES: 5',
  'STEP_UP_ASSERTION_SINGLE_USE: YES',
  'STEP_UP_CRITICAL_ASSERTION_SINGLE_USE: YES',
  'STEP_UP_ASSERTION_REUSABLE_ACROSS_PURPOSES: NO',
  'STEP_UP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO',
  'STEP_UP_REPLACES_BUSINESS_AUTHORIZATION: NO',
  'APPROVAL_REPLACES_STEP_UP: NO',
  'purpose-bound và single-use',
  'consume atomic cùng business mutation',
]) assert(design.includes(marker), `Missing step-up assertion contract: ${marker}`)

for (const marker of [
  'CRITICAL_STEP_UP_ALWAYS_LOCKS_ACCOUNT_SECURITY_BEFORE_BUSINESS_ROOT: NO',
  'CROSS_DOMAIN_STEP_UP_LOCK_ORDER_DEFINED: YES',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES',
  'STEP_UP_ASSERTION_PRECEDES_PROTECTED_TARGET_MUTATION: YES',
  'CROSS_DOMAIN_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'PLATFORM_AUTHORITY_ROOT_LOCK_PRECEDES_STEP_UP_SECURITY_LOCKS: YES',
  'ACTING_DOMAIN_ROOT_LOCK_PRECEDES_STEP_UP_SECURITY_LOCKS: YES',
  'CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: NO',
  'Business-domain root tier đã duyệt không bị đảo bởi MFA overlay',
  'Không lấy account-security row rồi quay lại chờ global authority',
  'không sửa canonical root contract F23.12',
]) assert(design.includes(marker), `Missing cross-domain step-up contract: ${marker}`)

const compositeOrderStart = design.indexOf('Canonical composite order:')
const compositeOrderEnd = design.indexOf('Business-domain root tier', compositeOrderStart)
assert(compositeOrderStart >= 0 && compositeOrderEnd > compositeOrderStart, 'Composite lock-order section is missing.')
const compositeOrder = design.slice(compositeOrderStart, compositeOrderEnd)
const orderedCompositeTargets = [
  '0. BUSINESS_DOMAIN_ROOT_MUTEX_ROWS',
  '1. ACCOUNT_SECURITY_CONTROL_ROW',
  '2. STEP_UP_ASSERTION_ROW',
  '3. REMAINING_BUSINESS_APPROVAL_TARGET_ROWS',
  '4. AUDIT_OUTBOX_ROWS',
]
let previousCompositeIndex = -1
for (const target of orderedCompositeTargets) {
  const currentCompositeIndex = compositeOrder.indexOf(target)
  assert(currentCompositeIndex > previousCompositeIndex, `Composite lock target missing/out of order: ${target}`)
  previousCompositeIndex = currentCompositeIndex
}

for (const marker of [
  'RECOVERY_CODE_COUNT: 10',
  'RECOVERY_CODE_SINGLE_USE: YES',
  'RECOVERY_CODE_PLAINTEXT_STORAGE_ALLOWED: NO',
  'RECOVERY_CODE_REGENERATION_INVALIDATES_OLD_CODES: YES',
  'RECOVERY_SESSION_GRANTS_NORMAL_PRIVILEGED_ACCESS: NO',
  'RECOVERY_CODE_CAN_LINK_GOOGLE: NO',
  'RECOVERY_CODE_CAN_RESTORE_MEMBERSHIP: NO',
  'MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: NO',
  'MFA_RECOVERY_RELINKS_GOOGLE: NO',
  'MFA_RECOVERY_RESETS_PASSWORD: NO',
  'Atomic transition `unused -> used`',
  'Hai concurrent regenerations chỉ có một current set',
]) assert(design.includes(marker), `Missing recovery-code/recovery separation: ${marker}`)

for (const field of [
  'restricted_recovery_session_id',
  'ceremony_contract_version',
  'environment_fingerprint',
  'recovery_request_id',
  'recovery_code_set_version',
  'recovery_code_id_digest',
  'purpose',
  'allowed_action_set',
  'logical_recovery_session_id',
  'account_security_version',
  'session_version',
  'factor_control_version',
  'issued_at',
  'expires_at',
  'completed_at',
  'revoked_at',
  'session_version_record',
  'idempotency_key',
]) assert(design.includes(field), `Missing restricted recovery-session field: ${field}`)

for (const status of [
  'PENDING_ISSUANCE',
  'ACTIVE_RESTRICTED',
  'COMPLETED',
  'REVOKED',
  'EXPIRED',
  'INVALIDATED',
]) assert(design.includes(status), `Missing restricted recovery-session status: ${status}`)

for (const marker of [
  'RESTRICTED_RECOVERY_SESSION_PURPOSE_BOUND: YES',
  'RESTRICTED_RECOVERY_SESSION_DEFAULT_TTL_MINUTES: 15',
  'RESTRICTED_RECOVERY_SESSION_SINGLE_ACTIVE_PER_REQUEST: YES',
  'RESTRICTED_RECOVERY_SESSION_REPLAY_ALLOWED: NO',
  'RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SECURITY_VERSION: YES',
  'RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SESSION_VERSION: YES',
  'RESTRICTED_RECOVERY_SESSION_CLIENT_IS_AUTHORITY: NO',
  'mfa.factor_replacement.begin',
  'mfa.factor_replacement.confirm',
  'mfa.recovery.complete',
  'không phải bản sao nguồn account `session_version`',
  'không được link/unlink Google, đổi/reset password',
  'không được consumed nếu canonical safe session outcome không thể tạo',
  'Cùng recovery request/code outcome chỉ có một active canonical session',
  'duplicate confirmation hoặc retry sau terminal state deny',
]) assert(design.includes(marker), `Missing restricted recovery-session contract: ${marker}`)

for (const marker of [
  'restricted recovery proof',
  'new factor confirmation',
  'old factor revoke',
  'TOTP không reuse seed',
  'CENTER_ADMIN_CAN_RESET_PLATFORM_OWNER_MFA: NO',
  'CENTER_ADMIN_CAN_RESET_OWNER_MFA: NO',
  'MFA_TARGET_CAN_SELF_APPROVE_ADMIN_RESET: NO',
  'CONSULTANT_CAN_RESET_MFA: NO',
  'Platform Owner reset cần protected two-person central security operation',
  'Emergency revoke',
  'không tự enroll replacement',
]) assert(design.includes(marker), `Missing replacement/reset/revoke contract: ${marker}`)

for (const marker of [
  'Old JWT/access token hoặc cached assertion không thắng account lifecycle',
  'local authority bị block bằng committed state/version',
  'restricted session',
  'Hết grace, server deny normal authority',
  'Google authentication không tự tạo MFA assurance',
]) assert(design.includes(marker), `Missing invalidation/enforcement contract: ${marker}`)

for (const errorCode of [
  'mfa_not_available',
  'mfa_enrollment_required',
  'mfa_enrollment_reauth_required',
  'mfa_enrollment_expired',
  'mfa_enrollment_conflict',
  'mfa_challenge_required',
  'mfa_challenge_invalid',
  'mfa_challenge_failed',
  'mfa_challenge_expired',
  'mfa_challenge_replayed',
  'mfa_factor_not_active',
  'mfa_factor_policy_not_met',
  'mfa_recovery_required',
  'mfa_recovery_code_invalid',
  'mfa_recovery_code_consumed',
  'mfa_reset_pending',
  'mfa_reset_denied',
  'mfa_reset_not_authorized',
  'mfa_step_up_required',
  'mfa_step_up_expired',
  'mfa_step_up_purpose_mismatch',
  'account_lifecycle_blocked',
  'security_service_unavailable',
  'rate_limit_exceeded',
]) assert(design.includes(errorCode), `Missing safe error: ${errorCode}`)

for (let index = 1; index <= 42; index += 1) {
  assert(design.includes(`| C-N${index} |`), `Missing concurrency/replay case C-N${index}`)
}

for (const outcome of [
  'C-N1 | Hai enrollment intents cùng account/type.',
  'C-N3 | Hai TOTP codes cùng timestep cho hai challenges.',
  'Factor lock + `last_accepted_time_step` cho một completion',
  'C-N10 | Duplicate account-security control row.',
  'không chọn ngẫu nhiên source/version',
  'C-N11 | Account-security control row bị thiếu.',
  'C-N12 | Empty factor set bị dùng làm mutex.',
  'C-N13 | Hai active TOTP factors được tạo đồng thời.',
  'C-N14 | Factor revoke và challenge đồng thời.',
  'C-N18 | Hai recovery requests dùng cùng recovery code.',
  'atomic unused→used cho một restricted session',
  'C-N20 | Hai recovery-code regeneration đồng thời.',
  'C-N24 | Center Admin cố reset Platform Owner MFA.',
  'C-N31 | Step-up assertion replay.',
  'business mutation không chạy lần hai',
  'C-N34 | WebAuthn credential đồng thời link hai accounts.',
  'Stable external mutex serializes; một owner',
  'C-N35 | External credential mutex timeout.',
  'rollback/no ownership/factor/session',
  'C-N36 | Access token refresh nhưng logical security session còn đúng.',
  'Không fail chỉ vì raw token đổi',
  'C-N37 | Timestep mới hơn đã accepted, sau đó timestep cũ hơn được gửi khi vẫn trong ±1 skew.',
  'Reject `candidate_time_step <= highest_accepted_time_step`',
  'không hạ high-water mark hoặc success audit thứ hai',
  'C-N38 | Recovery session được tạo với pre-update security/session versions.',
  'code không consumed, không phát stale session',
  'C-N39 | Hai recovery sessions được tạo từ cùng recovery request/code outcome.',
  'không hai `ACTIVE_RESTRICTED` sessions',
  'C-N40 | Expired/completed recovery session cố confirm factor lần nữa.',
  'không factor, session hoặc audit success mutation thứ hai',
  'C-N41 | Platform authority flow giữ global root rồi chờ account-security',
  'account-first flow bị contract/test reject',
  'C-N42 | Assertion consumed nhưng protected business mutation rollback/fail.',
  'Cùng transaction rollback assertion consume',
  'không mất assertion hoặc business side effect',
]) assert(design.includes(outcome), `Missing substantive concurrency outcome: ${outcome}`)

for (const marker of [
  'CONCURRENT_TOTP_ENROLLMENTS_CAN_BOTH_ACTIVATE: NO',
  'SAME_TOTP_TIMESTEP_CAN_COMPLETE_TWO_CHALLENGES: NO',
  'ONE_RECOVERY_CODE_CAN_COMPLETE_TWO_REQUESTS: NO',
  'TWO_RECOVERY_CODE_SETS_CAN_BOTH_BE_CURRENT: NO',
  'REVOKED_FACTOR_CAN_COMPLETE_CONCURRENT_CHALLENGE: NO',
  'STEP_UP_ASSERTION_REPLAY_ALLOWED: NO',
  'Unique constraints chỉ là backstop',
]) assert(design.includes(marker), `Missing required concurrency outcome marker: ${marker}`)

const assertOrderedAtomicBlock = (startMarker, endMarker, orderedSteps) => {
  const start = design.indexOf(startMarker)
  const end = design.indexOf(endMarker, start)
  assert(start >= 0 && end > start, `Atomic block missing: ${startMarker}`)
  const block = design.slice(start, end)
  let previousIndex = -1
  for (const step of orderedSteps) {
    const currentIndex = block.indexOf(step)
    assert(currentIndex > previousIndex, `Atomic step missing/out of order in ${startMarker}: ${step}`)
    previousIndex = currentIndex
  }
}

assertOrderedAtomicBlock('ENROLLMENT_CONFIRMATION_ATOMIC_BEGIN', 'ENROLLMENT_CONFIRMATION_ATOMIC_END', [
  'ACCOUNT_SECURITY_CONTROL_ROW_LOCK',
  'ENROLLMENT_INTENT_ROW_LOCK',
  'PENDING_FACTOR_ROW_LOCK',
  'INTENT_CONSUME',
  'PENDING_FACTOR_ACTIVATE',
  'FACTOR_SECURITY_CONTROL_VERSION_UPDATE',
  'RECOVERY_CODE_GENERATION_INTENT_OR_SET',
  'AUDIT_OUTBOX_APPEND',
  'COMMIT_ATOMIC',
])

assertOrderedAtomicBlock('RECOVERY_CODE_USE_ATOMIC_BEGIN', 'RECOVERY_CODE_USE_ATOMIC_END', [
  'ACCOUNT_SECURITY_CONTROL_ROW_LOCK',
  'RECOVERY_REQUEST_ROW_LOCK',
  'RECOVERY_CODE_ROW_LOCK',
  'CURRENT_VERSION_RECHECK',
  'NEXT_SECURITY_SESSION_VERSIONS_DERIVE',
  'CODE_UNUSED_TO_USED',
  'SECURITY_SESSION_VERSION_UPDATE',
  'RESTRICTED_RECOVERY_SESSION_CREATE_BOUND_TO_POST_COMMIT_VERSIONS',
  'STALE_STEP_UP_REVOKE',
  'AUDIT_OUTBOX_APPEND',
  'COMMIT_ATOMIC',
])

assertOrderedAtomicBlock('FACTOR_REVOKE_RESET_ATOMIC_BEGIN', 'FACTOR_REVOKE_RESET_ATOMIC_END', [
  'ACCOUNT_SECURITY_CONTROL_ROW_LOCK',
  'FACTOR_REQUEST_ROW_LOCK',
  'FACTOR_TERMINAL_STATE',
  'SECURITY_SESSION_FACTOR_CONTROL_VERSION_UPDATE',
  'SESSION_ASSERTION_INVALIDATION_OUTBOX',
  'RECOVERY_RESET_REQUIRED_STATE',
  'AUDIT_OUTBOX_APPEND',
  'COMMIT_ATOMIC',
])

assertOrderedAtomicBlock('CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_BEGIN', 'CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_END', [
  'BUSINESS_DOMAIN_ROOT_LOCKS',
  'ACCOUNT_SECURITY_CONTROL_ROW_LOCK',
  'STEP_UP_ASSERTION_ROW_LOCK',
  'ASSERTION_VERSION_PURPOSE_RESOURCE_RECHECK',
  'ASSERTION_CONSUME',
  'EXACT_PROTECTED_BUSINESS_MUTATION',
  'AUDIT_OUTBOX_APPEND',
  'COMMIT_ATOMIC',
])

for (let index = 1; index <= 34; index += 1) {
  assert(design.includes(`| C-T${index} `), `Missing threat C-T${index}`)
}

for (const threatAddition of [
  'C-T31 Older-timestep replay inside skew | Medium | High/Critical',
  'Reject candidate ≤ highest accepted; approved consumed-step registry only as reviewed equivalent',
  'C-T32 Recovery-session scope/version confusion | Medium | Critical',
  'Purpose/action-bound envelope, TTL, post-commit versions, single active + terminal states',
  'C-T33 Cross-domain lock inversion | Medium | High/Critical',
  'Business root → account-security → assertion → business targets',
  'C-T34 Assertion lost before business mutation | Medium | High',
  'One transaction or reservation/finalize protocol with idempotency/recovery',
]) assert(design.includes(threatAddition), `Missing integration threat semantic: ${threatAddition}`)

for (let index = 1; index <= 20; index += 1) {
  assert(design.includes(`| C-AG${index} `), `Missing approval gate C-AG${index}`)
}

for (const blocker of [
  'Canonical account lifecycle',
  'Exactly-one account-security control row/account',
  'Một canonical source cho security/session versions',
  'Factor/enrollment/challenge/recovery persistence',
  'Server-derived assurance',
  'Session/assertion invalidation',
  'Encrypted secret storage',
  'Rate-limit/risk service',
  'Immutable audit/transactional outbox',
  'Protected admin-reset approval service',
  'WebAuthn credential mutex/registry',
  'Verified remote Auth/MFA configuration truth',
  'F23.13B linked-identity compatibility',
]) assert(design.includes(blocker), `Missing implementation blocker: ${blocker}`)

const roadmapMarkers = [
  'F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn',
  'F23.13A DONE design / Audit nền Auth-security và chốt boundary',
  'F23.13B DONE design / Liên kết Google identity và login-recovery semantics',
  'F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery',
  'F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement',
]

for (const marker of roadmapMarkers) {
  assert(design.includes(marker), `Design roadmap missing: ${marker}`)
  assert(identityDesign.includes(marker), `F23.13B roadmap missing: ${marker}`)
  assert(foundation.includes(marker), `F23.13A roadmap missing: ${marker}`)
  assert(canonicalRoadmap.includes(marker), `Canonical roadmap missing: ${marker}`)
}

for (const marker of [
  'F23.13 FINAL TECHNICAL AUDIT: PASS',
  'F23.13 IMPLEMENTATION: BLOCKED',
  'F23.13 RUNTIME IMPLEMENTATION: NOT STARTED',
]) {
  assert(design.includes(marker), `Design closeout marker missing: ${marker}`)
  assert(canonicalRoadmap.includes(marker), `Canonical closeout marker missing: ${marker}`)
}

for (const forbidden of [
  'MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: YES',
  'MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: YES',
  'CENTER_ADMIN_CAN_RESET_PLATFORM_OWNER_MFA: YES',
  'PENDING_FACTOR_GRANTS_ASSURANCE: YES',
  'RECOVERY_SESSION_GRANTS_NORMAL_PRIVILEGED_ACCESS: YES',
  'STEP_UP_ASSERTION_REPLAY_ALLOWED: YES',
  'EMPTY_FACTOR_SET_PROVIDES_SERIALIZATION: YES',
  'DUPLICATE_SECURITY_VERSION_SOURCES_ALLOWED: YES',
  'FACTOR_UNIQUENESS_REPLACES_ACCOUNT_MUTEX: YES',
  'MFA_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: YES',
  'TOTP_ACCEPTED_TIMESTEP_MUST_ADVANCE_MONOTONICALLY: NO',
  'TOTP_CANDIDATE_TIMESTEP_LESS_THAN_OR_EQUAL_TO_HIGHEST_ACCEPTED_ALLOWED: YES',
  'OLDER_TOTP_TIMESTEP_AFTER_NEWER_ACCEPTED_CAN_SUCCEED: YES',
  'RESTRICTED_RECOVERY_SESSION_PURPOSE_BOUND: NO',
  'RESTRICTED_RECOVERY_SESSION_REPLAY_ALLOWED: YES',
  'RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SECURITY_VERSION: NO',
  'RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SESSION_VERSION: NO',
  'RESTRICTED_RECOVERY_SESSION_CLIENT_IS_AUTHORITY: YES',
  'CRITICAL_STEP_UP_ALWAYS_LOCKS_ACCOUNT_SECURITY_BEFORE_BUSINESS_ROOT: YES',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: NO',
  'STEP_UP_ASSERTION_PRECEDES_PROTECTED_TARGET_MUTATION: NO',
  'CROSS_DOMAIN_LOCK_ORDER_INVERSION_ALLOWED: YES',
  'CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: YES',
  'F23_13_STATUS: IN PROGRESS DESIGN',
  'F23_13_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_13_IMPLEMENTATION_READINESS: READY',
  'F23_13C_IMPLEMENTATION_READINESS: READY',
  'F23_13_RUNTIME_IMPLEMENTATION: DONE',
  'F23.13 IN PROGRESS design /',
  'F23.13 DESIGN PACKAGE COMPLETE - READY FOR FINAL TECHNICAL AUDIT',
]) assert(!design.includes(forbidden), `Forbidden MFA design claim found: ${forbidden}`)

assert(
  !design.includes('CRITICAL_STEP_UP_CONSUMPTION_ATOMIC_BEGIN'),
  'Stale universal account-first critical step-up atomic block must be removed.',
)

assert(!/```sql/i.test(design), 'Design-only doc must not contain executable SQL fences.')
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'Design must not contain a real or fixture email address.')

const sensitiveValuePatterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /\botpauth:\/\//i,
  /(?:totp[_ -]?seed|totp[_ -]?secret|otp[_ -]?code|recovery[_ -]?code[_ -]?value)\s*[:=]\s*["']?[A-Za-z0-9._~-]{8,}/i,
  /data:image\/(?:png|svg\+xml);base64,/i,
  /(?:credential[_ -]?id|raw[_ -]?credential)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/i,
  /(?:client[_ -]?secret|oauth[_ -]?secret)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/i,
  /\b\d{8,}-[A-Za-z0-9_-]{16,}\.apps\.googleusercontent\.com\b/i,
  /(?:authorization[_ -]?code|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|pkce[_ -]?verifier|raw[_ -]?nonce)\s*[:=]\s*["']?[A-Za-z0-9._~-]{12,}/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
]
for (const pattern of sensitiveValuePatterns) {
  assert(!pattern.test(design), `Potential secret/credential/OTP payload found: ${pattern}`)
}

const privateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!design.includes(privateWorkspaceLabel), 'Design must not include private workspace labels.')

const characters = (...codePoints) => String.fromCodePoint(...codePoints)
const mojibakeMarkers = [
  characters(0x43, 0x00e1, 0x00ba),
  characters(0x00c3),
  characters(0x00c6, 0x00b0),
  characters(0x48, 0x00e1, 0x00ba),
  characters(0x00e1, 0x00bb),
  characters(0xfffd),
]

for (const content of [design, identityDesign, foundation, platformDesign, canonicalRoadmap, realtimeRoadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.13C monotonic TOTP recovery-session and cross-domain step-up docs smoke: PASS')
