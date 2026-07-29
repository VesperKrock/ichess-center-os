import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-13b-google-identity-linking-va-login-recovery-semantics.md')
const foundation = read('docs/f23-13a-auth-security-google-identity-mfa-va-consultant-access-audit.md')
const platformDesign = read('docs/f23-12d-controlled-platform-owner-bootstrap-assignment-va-revoke-drill.md')
const canonicalRoadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const realtimeRoadmapPath = path.join(root, 'RoadmapRealTime.txt')
const realtimeRoadmap = fs.existsSync(realtimeRoadmapPath)
  ? fs.readFileSync(realtimeRoadmapPath, 'utf8')
  : ''

for (const marker of [
  'F23_13_STATUS: DONE DESIGN',
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13C_STATUS: DONE DESIGN',
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13D_STATUS: DONE DESIGN',
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13D_IMPLEMENTATION_READINESS: BLOCKED',
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
  'SUPABASE_ACTION: NOT RUN',
  'OAUTH_PROVIDER_CHANGE: NO',
  'PROVIDER_CREDENTIAL_CHANGE: NO',
  'REAL_ACCOUNT_CHANGE: NO',
  'REAL_IDENTITY_LINK_CHANGE: NO',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
]) assert(design.includes(marker), `Missing status/design-only marker: ${marker}`)

assert(
  !design.includes('F23.13B GOOGLE IDENTITY LINKING AND LOGIN RECOVERY DESIGN COMPLETE - READY FOR TECHNICAL AUDIT'),
  'F23.13B stale pre-hardening final line must be replaced.',
)
assert(
  !design.includes('F23.13B IDENTITY LINK MUTEX AND VERSIONED CEREMONY HARDENING COMPLETE - READY FOR FINAL AUDIT'),
  'F23.13B stale pre-final-audit line must be replaced.',
)

for (const marker of [
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
]) assert(foundation.includes(marker), `F23.13A final-audit sync missing: ${marker}`)

assert(
  !foundation.includes('F23.13A AUTH SECURITY FOUNDATION AUDIT COMPLETE - READY FOR TECHNICAL AUDIT'),
  'F23.13A stale pre-audit final line must be replaced.',
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
  'CURRENT_LOGIN_IDENTIFIER: EMAIL',
  'USERNAME_RESOLVER_IMPLEMENTED: NO',
  'SELF_SERVICE_PASSWORD_CHANGE_IMPLEMENTED: NO',
  'FORCED_FIRST_PASSWORD_CHANGE_IMPLEMENTED: NO',
  'CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO',
  'AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO',
  'GOOGLE_IDENTITY_LINKING_IMPLEMENTED: NO',
  'GOOGLE_PROVIDER_ENABLED_BY_THIS_PHASE: NO',
  '`signInWithPassword` với email đã trim và password',
  '`INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`',
  '`auth_disable_not_implemented`',
  'không phải bằng chứng về remote production',
]) assert(design.includes(repoTruth), `Missing inherited repo truth: ${repoTruth}`)

for (const decision of [
  'GOOGLE_IDENTITY_MODEL: LINK_TO_EXISTING_ICHESS_ACCOUNT',
  'GOOGLE_SIGN_IN_AUTO_PROVISIONING_ALLOWED: NO',
  'GOOGLE_AUTO_LINK_BY_EMAIL_ALLOWED: NO',
  'GOOGLE_ONLY_ACCOUNT_ALLOWED_INITIAL_ROLLOUT: NO',
  'GOOGLE_IDENTITY_REPLACES_CANONICAL_ACCOUNT_ID: NO',
  'GOOGLE_PROVIDER_EMAIL_IS_AUTHORITY: NO',
  'GOOGLE_CALENDAR_IN_F23_13_SCOPE: NO',
  'GOOGLE_DRIVE_IN_F23_13_SCOPE: NO',
  'GOOGLE_CLASSROOM_IN_F23_13_SCOPE: NO',
  'canonical iChess Auth user_id',
]) assert(design.includes(decision), `Missing G2 rollout decision: ${decision}`)

for (const field of [
  'canonical_user_id',
  'account_lifecycle_status',
  'primary_login_methods',
  'security_version',
  'session_version',
  'identity_link_id',
  'provider_issuer',
  'provider_subject',
  'provider_email_evidence',
  'provider_email_verified_at',
  'workspace_tenant_evidence',
  'link_version',
  'linked_by_user_id',
  'last_successful_login_at',
  'account_identity_control',
  'identity_control_version',
  'active_provider_link_count',
]) assert(design.includes(field), `Missing canonical model field: ${field}`)

for (const marker of [
  'provider + provider_issuer + provider_subject',
  'MAX_ACTIVE_GOOGLE_IDENTITIES_PER_ACCOUNT: 1',
  'ONE_GOOGLE_SUBJECT_MAY_LINK_MULTIPLE_ACCOUNTS: NO',
  'Email provider có thể đổi',
  'không phải lookup key, account key hoặc authority',
]) assert(design.includes(marker), `Missing identity invariant: ${marker}`)

for (const marker of [
  'EMPTY_IDENTITY_LINK_SET_PROVIDES_SERIALIZATION: NO',
  'IDENTITY_LINK_UNIQUENESS_REPLACES_STABLE_MUTEX: NO',
  'ACCOUNT_IDENTITY_MUTEX_REQUIRED: YES',
  'PROVIDER_SUBJECT_MUTEX_REQUIRED: YES',
  'ACCOUNT_IDENTITY_MUTATION_LOCK_TARGET: ACCOUNT_IDENTITY_CONTROL_ROW',
  'ACCOUNT_IDENTITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'PROVIDER_SUBJECT_MUTATION_LOCK_TARGET: STABLE_PROVIDER_SUBJECT_MUTEX',
  'PROVIDER_SUBJECT_UNIQUE_INDEX_IS_ONLY_BACKSTOP: YES',
  'tồn tại **trước** khi account được phép tạo intent hoặc mutate identity',
  'Missing hoặc duplicate control row đều fail closed',
  'versioned_digest(environment_namespace, provider, normalized_issuer, provider_subject)',
  'Missing mutex service hoặc lock timeout fail closed',
  'Database unique invariant vẫn bắt buộc làm integrity backstop, nhưng không thay stable serialization',
]) assert(design.includes(marker), `Missing stable serialization contract: ${marker}`)

for (const state of [
  'UNLINKED',
  'LINK_INTENT_CREATED',
  'AUTHORIZATION_PENDING',
  'CALLBACK_RECEIVED',
  'VERIFICATION_PENDING',
  'LINKED',
  'CONFLICT',
  'REAUTH_REQUIRED',
  'EXPIRED',
  'REVOKED',
  'UNLINKED_BY_USER',
  'UNLINKED_BY_ADMIN',
]) assert(design.includes(`\`${state}\``), `Missing identity lifecycle state: ${state}`)

for (const marker of [
  'IDENTITY_LINK_REAUTH_MAX_AGE_MINUTES: 5',
  'IDENTITY_LINK_REAUTH_SERVER_DERIVED: YES',
  'IDENTITY_LINK_UI_BADGE_IS_AUTHORITY: NO',
  'LINK_INTENT_SINGLE_USE: YES',
  'LINK_INTENT_SERVER_STORED: YES',
  'LINK_INTENT_CLIENT_IS_AUTHORITY: NO',
  'LINK_INTENT_DEFAULT_TTL_MINUTES: 5',
  'ONE_LIVE_LINK_INTENT_PER_ACCOUNT_PROVIDER: YES',
  'UNDEFINED_ACCOUNT_VERSION_FIELD_ALLOWED: NO',
  'LINK_INTENT_BINDS_ACCOUNT_SECURITY_VERSION: YES',
  'LINK_INTENT_BINDS_SESSION_VERSION: YES',
  'LINK_INTENT_BINDS_IDENTITY_CONTROL_VERSION: YES',
  'LINK_CEREMONY_BINDS_ENVIRONMENT_FINGERPRINT: YES',
  'LINK_CEREMONY_BINDS_PROVIDER_CONFIG_VERSION: YES',
  'LINK_CEREMONY_BINDS_REDIRECT_POLICY_VERSION: YES',
  'LINK_CEREMONY_BINDS_WORKSPACE_POLICY_VERSION: YES',
  'LINK_CEREMONY_BINDS_LOGICAL_SECURITY_SESSION: YES',
  'WORKSPACE_POLICY_VERSION_NULL_IS_WILDCARD: NO',
  'ceremony_contract_version',
  'environment_fingerprint',
  'provider_client_config_version',
  'redirect_policy_version',
  'workspace_policy_version',
  'logical_security_session_id',
  'account_security_version_at_creation',
  'session_version_at_creation',
  'identity_control_version_at_creation',
  'requested_scope_set',
  'prompt_policy_version',
  'state_digest',
  'nonce_digest',
  'pkce_challenge',
  'exact_redirect_uri',
  'idempotency_key',
  'PKCE S256',
]) assert(design.includes(marker), `Missing re-auth/link-intent contract: ${marker}`)

assert(!design.includes('account_version_at_creation'), 'Undefined account_version_at_creation field must be removed.')
assert(
  design.includes('`workspace_policy_version = null` chỉ biểu diễn exact policy state `G3_OFF`; nó không phải wildcard'),
  'Workspace policy nullable semantics must be exact and non-wildcard.',
)
assert(
  design.includes('server-side identity ổn định qua access-token refresh, không phải raw JWT/token ID'),
  'Logical security session semantics must survive token refresh without binding raw token identity.',
)

for (const marker of [
  'IDENTITY_MUTATION_LOCK_ORDER_DEFINED: YES',
  'PROVIDER_SUBJECT_MUTEX_PRECEDES_ACCOUNT_IDENTITY_MUTEX: YES',
  'IDENTITY_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'CONCURRENT_DIFFERENT_SUBJECT_LINKS_ON_ONE_ACCOUNT_CAN_BOTH_COMMIT: NO',
  'CONCURRENT_SAME_SUBJECT_LINKS_ON_TWO_ACCOUNTS_CAN_BOTH_COMMIT: NO',
  'account controls theo sorted canonical ID',
  'Không giữ database lock khi redirect user',
  'Provider exchange và cryptographic validation hoàn tất trước mutation transaction',
]) assert(design.includes(marker), `Missing lock-order/race contract: ${marker}`)

const lockOrderStart = design.indexOf('Canonical mutation lock order:')
const lockOrderEnd = design.indexOf('Callback/link/unlink/admin revoke', lockOrderStart)
assert(lockOrderStart >= 0 && lockOrderEnd > lockOrderStart, 'Canonical lock-order section is missing.')
const lockOrder = design.slice(lockOrderStart, lockOrderEnd)
const orderedLockTargets = [
  '0. STABLE_PROVIDER_SUBJECT_MUTEX',
  '1. ACCOUNT_IDENTITY_CONTROL_ROW',
  '2. EXACT_LINK_INTENT_ROW',
  '3. IDENTITY_LINK_ROWS',
  '4. SESSION_VERSION_ROWS',
  '5. AUDIT_OUTBOX_ROWS',
]
let previousLockIndex = -1
for (const target of orderedLockTargets) {
  const currentLockIndex = lockOrder.indexOf(target)
  assert(currentLockIndex > previousLockIndex, `Canonical lock target is missing/out of order: ${target}`)
  previousLockIndex = currentLockIndex
}

const creationOrderStart = design.indexOf('Link-intent creation lock order:')
const creationOrderEnd = design.indexOf('### 7.2', creationOrderStart)
assert(creationOrderStart >= 0 && creationOrderEnd > creationOrderStart, 'Intent-creation lock order is missing.')
const creationOrder = design.slice(creationOrderStart, creationOrderEnd)
assert(
  creationOrder.indexOf('ACCOUNT_IDENTITY_CONTROL_ROW') < creationOrder.indexOf('LINK_INTENT_ROWS')
    && creationOrder.indexOf('LINK_INTENT_ROWS') < creationOrder.indexOf('AUDIT_OUTBOX_ROWS'),
  'Intent creation must lock account control before intent and audit/outbox rows.',
)

for (const validation of [
  'exact `environment_fingerprint` khớp',
  'Exact canonical account và `logical_security_session_id` binding',
  'State khớp digest',
  'Nonce khớp expected digest',
  'PKCE method/challenge/verifier hợp lệ',
  'Exact issuer',
  'Audience/authorized party',
  'Chữ ký',
  'Issued-at, not-before và expiry',
  'Exact redirect URI và `redirect_policy_version`',
  '`provider_client_config_version` và `prompt_policy_version` chưa drift',
  'Verified tenant và `workspace_policy_version` khớp',
  'Canonical account lifecycle',
  '`security_version` khớp `account_security_version_at_creation`',
  '`session_version` và logical session',
  '`identity_control_version` chưa đổi',
  'Provider subject tuple chưa link account khác dưới stable subject mutex',
  'Active link count/link rows không vượt policy dưới account control lock',
  '`ceremony_contract_version` vẫn được hỗ trợ',
  'Transactional audit/outbox dependency',
  'deny / consume-or-expire intent safely',
]) assert(design.includes(validation), `Missing callback validation: ${validation}`)

for (const driftContract of [
  'Callback deny nếu `environment_fingerprint`',
  'Không dùng current config khác với reviewed bound config',
  'không fallback theo visual environment label',
  'giữ exact old verified config trong approved overlap window',
  'expire intent và yêu cầu ceremony mới',
]) assert(design.includes(driftContract), `Missing callback configuration-drift contract: ${driftContract}`)

for (const marker of [
  'Acquire `STABLE_PROVIDER_SUBJECT_MUTEX`',
  'Acquire exact `ACCOUNT_IDENTITY_CONTROL_ROW`',
  'Lock exact link-intent row',
  'Re-check actual active link rows và count projection dưới account lock',
  'Re-check subject ownership dưới subject mutex',
  'Create exact identity link',
  'Consume exact intent',
  'Update `active_provider_link_count` projection',
  'Append immutable audit hoặc transactional outbox',
  '`rollback / deny`',
  'link committed without consumed intent',
  'control count/version changed without link',
  'intent consumed without link/audit',
  'subject ownership without account control update',
  'Unique constraint/index chỉ là integrity backstop, không phải mutex',
  'account_already_has_google_identity',
  'Không có success audit/link thứ hai',
  'không lộ owner, transfer/email-match hoặc duplicate success audit',
  'Provider exchange/validation không tự cấp app authority',
  'UNLINKED_GOOGLE_IDENTITY_CAN_SIGN_IN: NO',
  'GOOGLE_LOGIN_CREATES_CENTER_MEMBERSHIP: NO',
  'GOOGLE_LOGIN_ASSIGNES_ROLE: NO',
  'GOOGLE_LOGIN_BYPASSES_ACCOUNT_LIFECYCLE: NO',
  'identity_link_required',
  'Bare OAuth flow có khả năng auto-create unmanaged Auth user phải bị cấm',
]) assert(design.includes(marker), `Missing linked-login/atomicity boundary: ${marker}`)

for (const conflict of [
  'provider_subject_already_linked_elsewhere',
  'account_already_has_google_identity',
  'link_intent_security_state_changed',
  'provider_issuer_mismatch',
  'workspace_policy_mismatch',
  'identity_under_security_review',
]) assert(design.includes(conflict), `Missing conflict semantic: ${conflict}`)

for (const marker of [
  'PROVIDER_EMAIL_CHANGE_REASSIGNS_ACCOUNT: NO',
  'PROVIDER_SUBJECT_CHANGE_AUTO_MIGRATION_ALLOWED: NO',
  'G3 mặc định OFF',
  'domain suffix chỉ là evidence',
  'LAST_LOGIN_METHOD_UNLINK_ALLOWED: NO',
  'UNLINK_REQUIRES_FRESH_REAUTH: YES',
  'UNLINK_INVALIDATES_PROVIDER_SESSIONS: YES',
  'Center Admin không có account-wide authority',
]) assert(design.includes(marker), `Missing conflict/email/workspace/unlink contract: ${marker}`)

for (const unlinkStep of [
  'Acquire exact provider-subject mutex',
  'Acquire exact account identity-control row',
  'Lock exact identity-link row',
  'Re-check link/control/security versions',
  'Re-check last-login/recovery invariant',
  'Block local link authority',
  'Increment identity-control/security/session versions',
  'Update active-link count projection',
  'Create session-invalidation outbox event',
  'Provider-side token revocation là external side effect qua protected outbox/retry sau commit',
]) assert(design.includes(unlinkStep), `Missing serialized unlink/revoke transaction step: ${unlinkStep}`)

for (const marker of [
  'EMAIL_PASSWORD_LOGIN_REMAINS_AVAILABLE: YES',
  'USERNAME_LOGIN_IMPLEMENTED_BY_F23_13B: NO',
  'PASSWORD_RECOVERY_RELINKS_GOOGLE: NO',
  'GOOGLE_IDENTITY_RECOVERY_RESETS_MFA: NO',
  'MFA_RECOVERY_RESETS_PASSWORD: NO',
  'MEMBERSHIP_RESTORE_RESTORES_ACCOUNT_IDENTITY: NO',
  'Password recovery',
  'Identity-link recovery',
  'MFA recovery',
  'password_recovery_request_accepted',
]) assert(design.includes(marker), `Missing login/recovery semantic: ${marker}`)

for (const field of [
  'account_security_version',
  'identity_link_version',
  'authentication_method',
  'assurance_level',
  'issued_at',
  'last_reauth_at',
]) assert(design.includes(field), `Missing session evidence field: ${field}`)

for (const marker of [
  'Old token/session không thắng lifecycle hoặc version',
  'APPLICATION_PROVIDER_REFRESH_TOKEN_REQUIRED: NO',
  'ARBITRARY_POST_AUTH_REDIRECT_ALLOWED: NO',
  'OAUTH_TRANSIENT_DATA_BROWSER_STORAGE_ALLOWED: NO',
  'browser Back/Forward, refresh hoặc callback replay',
  'internal route allowlisted server-side',
]) assert(design.includes(marker), `Missing session/redirect/token boundary: ${marker}`)

for (const event of [
  'identity.link_intent_created',
  'identity.link_started',
  'identity.link_succeeded',
  'identity.link_failed',
  'identity.link_conflict',
  'identity.login_succeeded',
  'identity.login_failed',
  'identity.unlink_requested',
  'identity.unlink_succeeded',
  'identity.unlink_failed',
  'identity.admin_revoked',
  'identity.provider_email_evidence_changed',
  'identity.session_invalidated',
  'password.recovery_requested',
  'password.recovery_completed',
  'password.recovery_failed',
]) assert(design.includes(event), `Missing audit event: ${event}`)

for (const errorCode of [
  'identity_link_not_available',
  'identity_link_required',
  'identity_link_reauth_required',
  'identity_link_intent_expired',
  'identity_link_intent_invalid',
  'identity_link_conflict',
  'identity_already_linked',
  'identity_provider_mismatch',
  'identity_workspace_policy_denied',
  'identity_callback_invalid',
  'identity_login_denied',
  'identity_unlink_not_safe',
  'identity_unlink_reauth_required',
  'account_lifecycle_blocked',
  'account_recovery_required',
  'password_recovery_not_available',
  'password_recovery_request_accepted',
  'security_service_unavailable',
  'rate_limit_exceeded',
]) assert(design.includes(errorCode), `Missing safe error: ${errorCode}`)

for (let index = 1; index <= 32; index += 1) {
  assert(design.includes(`| B-N${index} |`), `Missing negative/concurrency case B-N${index}`)
}

for (let index = 1; index <= 30; index += 1) {
  assert(design.includes(`| B-T${index} `), `Missing threat B-T${index}`)
}

for (const expectedOutcome of [
  'B-N23 | Hai callbacks cùng account nhưng hai subjects khác nhau.',
  'chỉ một active link/success audit',
  'B-N24 | Account identity-control row bị thiếu.',
  'không fallback sang empty link-set',
  'B-N25 | Có duplicate account identity-control row.',
  'không chọn ngẫu nhiên một row',
  'B-N26 | Provider-subject mutex unavailable/timeout.',
  'rollback toàn unit, không ownership/link/session',
  'B-N27 | Identity-control version đổi sau intent creation.',
  'B-N28 | Provider client config version đổi trước callback.',
  'B-N29 | Redirect policy version đổi trước callback.',
  'B-N30 | Workspace policy version đổi trước callback.',
  'B-N31 | Access token refresh nhưng logical security session còn đúng.',
  'Không fail chỉ vì raw token đổi',
  'B-N32 | Intent dùng undefined/stale account-version vocabulary.',
  'Reject malformed/legacy envelope',
]) assert(design.includes(expectedOutcome), `Missing hardened negative outcome: ${expectedOutcome}`)

for (const threatAddition of [
  'B-T27 Same-account different-subject race | Medium | Critical',
  'Stable account identity-control mutex + active-account/provider invariant',
  'B-T28 Same-subject cross-account race | Medium | Critical',
  'Stable subject mutex + account lock + unique backstop',
  'B-T29 Ceremony configuration drift | Medium | High/Critical',
  'Bind environment/provider/redirect/Workspace policy versions',
  'B-T30 Undefined version semantics | Medium | High',
  'Canonical security/session/control vocabulary',
]) assert(design.includes(threatAddition), `Missing threat hardening semantic: ${threatAddition}`)

for (let index = 1; index <= 20; index += 1) {
  assert(design.includes(`| B-AG${index} `), `Missing approval gate B-AG${index}`)
}

for (const blocker of [
  'Canonical account lifecycle',
  'Session invalidation và version enforcement',
  'Safe self-service password recovery',
  'Server-derived re-auth/step-up',
  'Verified remote provider/Auth truth',
  'Identity-link storage và one-time intent store',
  'Exactly-one pre-existing account identity-control row/account',
  'stable provider-subject mutex service',
  'Canonical lock-order enforcement',
  'Versioned environment/provider/redirect/Workspace policy inventory',
  'Atomic audit/transactional outbox',
  'Rate-limit/risk service',
  'Protected conflict-resolution/admin-revoke operation',
  'F23.13C MFA contract',
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
  'GOOGLE_SIGN_IN_AUTO_PROVISIONING_ALLOWED: YES',
  'GOOGLE_AUTO_LINK_BY_EMAIL_ALLOWED: YES',
  'GOOGLE_ONLY_ACCOUNT_ALLOWED_INITIAL_ROLLOUT: YES',
  'GOOGLE_IDENTITY_REPLACES_CANONICAL_ACCOUNT_ID: YES',
  'GOOGLE_PROVIDER_EMAIL_IS_AUTHORITY: YES',
  'ONE_GOOGLE_SUBJECT_MAY_LINK_MULTIPLE_ACCOUNTS: YES',
  'UNLINKED_GOOGLE_IDENTITY_CAN_SIGN_IN: YES',
  'GOOGLE_LOGIN_CREATES_CENTER_MEMBERSHIP: YES',
  'GOOGLE_LOGIN_ASSIGNES_ROLE: YES',
  'GOOGLE_LOGIN_BYPASSES_ACCOUNT_LIFECYCLE: YES',
  'LAST_LOGIN_METHOD_UNLINK_ALLOWED: YES',
  'EMPTY_IDENTITY_LINK_SET_PROVIDES_SERIALIZATION: YES',
  'IDENTITY_LINK_UNIQUENESS_REPLACES_STABLE_MUTEX: YES',
  'ACCOUNT_IDENTITY_MUTEX_REQUIRED: NO',
  'PROVIDER_SUBJECT_MUTEX_REQUIRED: NO',
  'IDENTITY_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: YES',
  'CONCURRENT_DIFFERENT_SUBJECT_LINKS_ON_ONE_ACCOUNT_CAN_BOTH_COMMIT: YES',
  'CONCURRENT_SAME_SUBJECT_LINKS_ON_TWO_ACCOUNTS_CAN_BOTH_COMMIT: YES',
  'UNDEFINED_ACCOUNT_VERSION_FIELD_ALLOWED: YES',
  'F23_13_STATUS: IN PROGRESS DESIGN',
  'F23_13_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_13_IMPLEMENTATION_READINESS: READY',
  'F23_13B_IMPLEMENTATION_READINESS: READY',
  'F23_13_RUNTIME_IMPLEMENTATION: DONE',
  'F23.13 IN PROGRESS design /',
  'F23.13 DESIGN PACKAGE COMPLETE - READY FOR FINAL TECHNICAL AUDIT',
]) assert(!design.includes(forbidden), `Forbidden design claim found: ${forbidden}`)

assert(!/```sql/i.test(design), 'Design-only doc must not contain executable SQL fences.')
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'Design must not contain a real or fixture email address.')

const sensitiveValuePatterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /(?:client[_ -]?secret|oauth[_ -]?secret)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/i,
  /\b\d{8,}-[A-Za-z0-9_-]{16,}\.apps\.googleusercontent\.com\b/i,
  /(?:authorization[_ -]?code|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|pkce[_ -]?verifier|raw[_ -]?nonce)\s*[:=]\s*["']?[A-Za-z0-9._~-]{12,}/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
]
for (const pattern of sensitiveValuePatterns) {
  assert(!pattern.test(design), `Potential credential/OAuth token found: ${pattern}`)
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
  'Buổi học mới'.normalize('NFD'),
]

for (const content of [design, foundation, platformDesign, canonicalRoadmap, realtimeRoadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.13B identity-link mutex and versioned ceremony docs smoke: PASS')
