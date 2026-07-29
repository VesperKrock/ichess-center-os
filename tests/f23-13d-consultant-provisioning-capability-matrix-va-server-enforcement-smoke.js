import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md')
const mfaDesign = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const identityDesign = read('docs/f23-13b-google-identity-linking-va-login-recovery-semantics.md')
const foundation = read('docs/f23-13a-auth-security-google-identity-mfa-va-consultant-access-audit.md')
const platformDesign = read('docs/f23-12d-controlled-platform-owner-bootstrap-assignment-va-revoke-drill.md')
const canonicalRoadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

const includesAll = (content, markers, message) => {
  for (const marker of markers) assert(content.includes(marker), `${message}: ${marker}`)
}

const section = (content, startMarker, endMarker) => {
  const start = content.indexOf(startMarker)
  const end = content.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0 && end > start, `Missing semantic section: ${startMarker} -> ${endMarker}`)
  return content.slice(start, end)
}

includesAll(design, [
  'F23_13_STATUS: DONE DESIGN',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_STATUS: DONE DESIGN',
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13D_STATUS: DONE DESIGN',
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13C_IMPLEMENTATION_READINESS: BLOCKED',
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
  'SRC_CHANGE: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'RLS_CHANGE: NO',
  'AUTH_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'REAL_ACCOUNT_CHANGE: NO',
  'REAL_MEMBERSHIP_CHANGE: NO',
  'REAL_ROLE_CHANGE: NO',
  'REAL_CAPABILITY_CHANGE: NO',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
], 'Missing status/design-only boundary')

const closeoutMarkers = [
  'F23_13_STATUS: DONE DESIGN',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
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
]
for (const [label, content] of [
  ['F23.13A', foundation],
  ['F23.13B', identityDesign],
  ['F23.13C', mfaDesign],
  ['F23.13D', design],
]) includesAll(content, closeoutMarkers, `${label} closeout sync missing`)

includesAll(mfaDesign, [
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_STATUS: DONE DESIGN',
  'F23_13C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
  'ACCOUNT_SECURITY_CONTROL_ROW',
  'CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_BEGIN',
], 'F23.13C final-audit/cross-domain contract sync missing')

assert(
  !mfaDesign.includes('F23.13C INTEGRATION HARDENING COMPLETE - READY FOR FINAL TECHNICAL AUDIT'),
  'F23.13C stale pre-final-audit line must be replaced.',
)

includesAll(identityDesign, [
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'GOOGLE_AUTO_LINK_BY_EMAIL_ALLOWED: NO',
  'ACCOUNT_IDENTITY_MUTEX_REQUIRED: YES',
], 'F23.13B boundary changed or roadmap sync missing')

includesAll(foundation, [
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'broad policies cho mọi active member trên `center_cloud_entities`',
  'PostgreSQL policies cùng command được OR',
], 'F23.13A boundary changed or roadmap sync missing')

includesAll(platformDesign, [
  'F23_12D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
], 'F23.12 audited-but-blocked boundary changed')

for (const classification of [
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
]) assert(design.includes(classification), `Missing evidence classification: ${classification}`)

includesAll(design, [
  'CONSULTANT_MACHINE_ROLE_EXISTS: YES',
  'CONSULTANT_IS_PLATFORM_ROLE: NO',
  'CONSULTANT_PROVISIONING_RUNTIME_IMPLEMENTED: NO',
  'CONSULTANT_CAPABILITY_RESOLVER_IMPLEMENTED: NO',
  'CONSULTANT_SERVER_MASKING_IMPLEMENTED: NO',
  'CONSULTANT_PERMISSION_OVERRIDE_IMPLEMENTED: NO',
  'CONSULTANT_USERNAME_LOGIN_IMPLEMENTED: NO',
  'CONSULTANT_MFA_RUNTIME_IMPLEMENTED: NO',
  'CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO',
  'AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO',
  'Consultant hiện có generic cloud read; path này chưa enforce assigned scope',
], 'Missing inherited repo truth')

const rlsBlocker = section(design, '## 3. CRITICAL IMPLEMENTATION BLOCKER', '## 4. Canonical role')
includesAll(rlsBlocker, [
  'center_cloud_entities',
  'broad policy cho mọi active member',
  'PostgreSQL policy áp dụng cùng command được OR',
  'BROAD_ACTIVE_MEMBER_RLS_WRITE_POLICY_PRESENT: YES',
  'CONSULTANT_APP_READ_ONLY_IS_SERVER_WRITE_BOUNDARY: NO',
  'CONSULTANT_DIRECT_GENERIC_ENTITY_WRITE_ALLOWED: NO',
  'F23_13D_RLS_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES',
  'CONSULTANT_UI_ONLY_GUARD_ALLOWED: NO',
  'CONSULTANT_BROWSER_DIRECT_TABLE_WRITE_ALLOWED: NO',
  'BROAD_RLS_CAN_REMAIN_WHILE_CONSULTANT_WRITE_ENABLED: NO',
  'Không bật bất kỳ consultant write nào khi broad policy còn cấp active-member write.',
  'RLS phải được remove/narrow trong phase SQL riêng',
], 'Broad active-member RLS is not a substantive critical blocker')

includesAll(design, [
  'CONSULTANT_ROLE_SCOPE: EXACT_CENTER',
  'CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: NO',
  'CONSULTANT_PLATFORM_AUTHORITY_ALLOWED: NO',
  'CONSULTANT_ACTING_AUTHORITY_ALLOWED: NO',
  'MULTI_CENTER_CONSULTANT_INITIAL_ROLLOUT: NO',
  'CONSULTANT_DEFAULT_RESOURCE_SCOPE: ASSIGNED_ONLY',
  'CONSULTANT_STAFF_RECORD_REQUIRED: YES',
  'CONSULTANT_ACTIVE_EMPLOYMENT_REQUIRED: YES',
  'CONSULTANT_ACTIVE_MEMBERSHIP_REQUIRED: YES',
  'CONSULTANT_EXACT_STAFF_ACCOUNT_LINK_REQUIRED: YES',
  'Request `center_id` chỉ là selector',
  'Thiếu hoặc stale bất kỳ dependency nào đều `DENY`',
], 'Missing exact-center role/eligibility semantics')

const linkage = section(design, '## 5. Staff — canonical account — membership linkage', '## 6. Provisioning modes')
includesAll(linkage, [
  'staff_record',
  'canonical_account',
  'center_membership',
  'staff_account_link',
  'staff_account_link_id',
  'membership_id',
  'STAFF_RECORD_IS_AUTH_ACCOUNT: NO',
  'STAFF_ACCOUNT_LINK_IS_MEMBERSHIP: NO',
  'STAFF_TERMINATION_AUTOMATICALLY_DELETES_ACCOUNT: NO',
  'STAFF_UNLINK_WITHOUT_ACCESS_REEVALUATION_ALLOWED: NO',
  'TWO_ACCOUNTS_CAN_LINK_SAME_STAFF: NO',
  'ONE_ACCOUNT_CAN_LINK_TWO_STAFF_SAME_CENTER: NO',
  'Email, tên, số điện thoại hoặc department không phải link key',
], 'Missing Staff-account-membership canonical linkage')

const provisioningBoundary = section(design, '## 6. Provisioning modes', '## 7. Canonical server capability resolver')
includesAll(provisioningBoundary, [
  'CREATE_NEW_CANONICAL_ACCOUNT',
  'LINK_EXISTING_CANONICAL_ACCOUNT',
  'ADD_CENTER_MEMBERSHIP',
  'LINK_STAFF_RECORD',
  'ACTIVATE_CONSULTANT_CAPABILITIES',
  'CONSULTANT_ACCOUNT_AUTO_LINK_BY_EMAIL_ALLOWED: NO',
  'CONSULTANT_ACCOUNT_AUTO_CREATE_FROM_STAFF_EMAIL_ALLOWED: NO',
  'CONSULTANT_LINK_TARGET_CLIENT_EMAIL_IS_AUTHORITY: NO',
  'CONSULTANT_LOGIN_IDENTIFIER_INITIAL_RUNTIME: EMAIL',
  'CONSULTANT_USERNAME_LOGIN_IMPLEMENTED: NO',
  'CONSULTANT_PROVISIONING_MAY_CLAIM_USERNAME_SUPPORT: NO',
  'TEMPORARY_PASSWORD_PRODUCTION_WITHOUT_FORCED_CHANGE_ALLOWED: NO',
  'TEMPORARY_PASSWORD_PLAINTEXT_STORAGE_ALLOWED: NO',
  'TEMPORARY_PASSWORD_LOGGING_ALLOWED: NO',
  'production create-new bằng temporary password bị deny',
], 'Missing separate provisioning/login/credential boundary')

const resolver = section(design, '## 7. Canonical server capability resolver', '## 8. Capability tiers')
includesAll(resolver, [
  'resolve_center_capability(',
  'canonical account lifecycle',
  'one canonical account-security/session-version source',
  'exact active center membership and canonical machine role',
  'same-center active Staff-account link and employment lifecycle',
  'explicit allow/deny overrides with version and expiry',
  'assignment scope and assignment version',
  'resource center and resource classification',
  'MFA assurance and resource-bound step-up assertion',
  'data_projection',
  'masking_policy',
  'policy_version',
  'resource_scope_version',
  'CONSULTANT_CAPABILITY_SERVER_DERIVED: YES',
  'CONSULTANT_CAPABILITY_CLIENT_IS_AUTHORITY: NO',
  'CONSULTANT_ROLE_LABEL_ALONE_GRANTS_CAPABILITY: NO',
  'CONSULTANT_ACTIVE_MEMBERSHIP_ALONE_GRANTS_ALL_READ: NO',
  'ACCOUNT_SECURITY_VERSION_CANONICAL_SOURCE_COUNT: EXACTLY_ONE',
  'Deny immutable/non-grantable capability trước mọi override.',
  'Áp exact-center, exact-capability explicit `DENY` trước baseline hoặc `ALLOW`.',
  'Decision không phải reusable bearer token.',
], 'Canonical server capability resolver is semantically incomplete')

const allowedMatrix = section(design, '### 8.1 Baseline allow', '### 8.2 Conditional')
for (const capability of [
  'crm.lead.read_assigned',
  'crm.lead.create',
  'crm.lead.update_assigned',
  'crm.care_log.create_assigned',
  'parent.basic.read_masked',
  'student.basic.read_limited',
  'tuition.payment_status.read_limited',
]) assert(allowedMatrix.includes(`\`${capability}\``), `Missing baseline allowed capability: ${capability}`)

const deniedMatrix = section(design, '### 8.3 Default deny', '## 9. Assignment scope')
for (const capability of [
  'staff.private_hr.read',
  'cashflow.full.read',
  'account.manage',
  'permission.manage',
  'platform.manage',
  'acting.start',
]) assert(deniedMatrix.includes(`\`${capability}\``), `Missing default denied capability: ${capability}`)

includesAll(deniedMatrix, [
  'immutable consultant deny; override không cấp được',
  'CONSULTANT_DEFAULT_DENY_PRIVATE_HR: YES',
  'CONSULTANT_DEFAULT_DENY_FULL_CASHFLOW: YES',
  'CONSULTANT_DEFAULT_DENY_ACCOUNT_MANAGEMENT: YES',
  'CONSULTANT_DEFAULT_DENY_PERMISSION_MANAGEMENT: YES',
  'CONSULTANT_DEFAULT_DENY_PLATFORM_AUTHORITY: YES',
], 'Default-deny matrix lacks immutable deny semantics')

const assignment = section(design, '## 9. Assignment scope', '## 10. Data classification')
includesAll(assignment, [
  'consultant_resource_assignment',
  'consultant_membership_id',
  '`ACTIVE`, `REASSIGNED`, `UNASSIGNED`, `SUSPENDED`, `CLOSED`',
  '`crm.queue.read_unassigned` là capability riêng, default deny',
  'EMPTY_CONSULTANT_ASSIGNMENT_SET_PROVIDES_SERIALIZATION: NO',
  'CONSULTANT_ASSIGNMENT_UNIQUENESS_REPLACES_RESOURCE_MUTEX: NO',
  'TWO_CONSULTANTS_CAN_OWN_EXCLUSIVE_ASSIGNMENT: NO',
  'STALE_ASSIGNMENT_CAN_GRANT_RESOURCE_ACCESS: NO',
  'stable resource-access root',
  'Care-log write cạnh tranh với reassign phải khóa cùng resource root',
], 'Assignment scope/concurrency contract is incomplete')

const masking = section(design, '## 10. Data classification', '## 11. Full-contact reveal')
includesAll(masking, [
  'CONTACT_PII_MASKED',
  'CONTACT_PII_FULL',
  'SENSITIVE_STUDENT',
  'FINANCIAL_PRIVATE',
  'PRIVATE_HR',
  'SECURITY_ADMIN',
  '090***123',
  'n***@example-domain',
  'CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: YES',
  'CONSULTANT_CLIENT_SIDE_MASKING_ONLY_ALLOWED: NO',
  'MASKED_CAPABILITY_RESPONSE_MAY_CONTAIN_RAW_FIELD: NO',
  'Server không gửi raw PII rồi nhờ JavaScript che.',
], 'Server-side masking contract is incomplete')

const sensitiveActions = section(design, '## 11. Full-contact reveal', '## 12. Tuition')
includesAll(sensitiveActions, [
  '`parent.contact.reveal_full`',
  'fresh F23.13C step-up bind exact account/session/center/action/resource',
  'CONSULTANT_FULL_CONTACT_REVEAL_REQUIRES_STEP_UP: YES',
  'CONSULTANT_FULL_CONTACT_REVEAL_BULK_ALLOWED: NO',
  'CONSULTANT_FULL_CONTACT_REVEAL_DEFAULT_TTL_MINUTES: 5',
  'không persistent client cache',
  'CONSULTANT_PII_WRITE_MFA_REQUIRED: YES',
  '`parent.contact.update`',
  '`phone`, `email`, `preferred_contact_method`, `contact_note_limited`',
  'Account identity email, password, role, membership, Staff link',
], 'Reveal/PII-write assurance and field boundary incomplete')

const domainBoundary = section(design, '## 12. Tuition', '## 13. Explicit capability override')
includesAll(domainBoundary, [
  '`tuition.quote.read`',
  '`tuition.payment_status.read_limited`',
  'CONSULTANT_TUITION_LEDGER_FULL_READ_ALLOWED: NO',
  'CONSULTANT_PAYMENT_WRITE_ALLOWED: NO',
  'CONSULTANT_CASHFLOW_ACCESS_ALLOWED: NO',
  '`crm.enrollment_draft.create_assigned` chỉ tạo draft',
  'CONSULTANT_ENROLLMENT_DRAFT_AUTO_FINALIZES_STUDENT: NO',
], 'Tuition/enrollment boundary incomplete')

const overrides = section(design, '## 13. Explicit capability override', '## 14. Stable roots')
includesAll(overrides, [
  'center_capability_override',
  'EXPLICIT_DENY_PRECEDES_ALLOW: YES',
  'CAPABILITY_OVERRIDE_WILDCARD_ALLOWED: NO',
  'CLIENT_SUPPLIED_CAPABILITY_OVERRIDE_ALLOWED: NO',
  'EXPIRED_OVERRIDE_GRANTS_ACCESS: NO',
  'CONSULTANT_CAN_SELF_GRANT_CAPABILITY: NO',
  'CONSULTANT_TARGET_CAN_SELF_APPROVE_OVERRIDE: NO',
  'CENTER_ADMIN_CAN_OVERRIDE_CONSULTANT_TO_PLATFORM_CAPABILITY: NO',
  'ALLOW không bypass lifecycle, Staff termination, membership, assignment, MFA hoặc immutable deny.',
], 'Capability override deny/authority contract incomplete')

const locking = section(design, '## 14. Stable roots', '## 15. Provisioning lifecycle')
includesAll(locking, [
  'center_access_control',
  'CENTER_ACCESS_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'CONSULTANT_PROVISIONING_LOCK_TARGET: CENTER_ACCESS_CONTROL_ROW',
  'EMPTY_MEMBERSHIP_SET_PROVIDES_PROVISIONING_SERIALIZATION: NO',
  'EMPTY_STAFF_ACCOUNT_LINK_SET_PROVIDES_SERIALIZATION: NO',
  'ACCOUNT_BOOTSTRAP_RESERVATION_ALONE_SERIALIZES_ALL_MATCHING_IDENTITIES: NO',
  'UNIQUE_ACCOUNT_REGISTRATION_REPLACES_GLOBAL_BOOTSTRAP_MUTEX: NO',
  'CONSULTANT_ACCESS_LOCK_ORDER_DEFINED: YES',
  'CENTER_ACCESS_ROOT_PRECEDES_ACCOUNT_SECURITY_LOCK: YES',
  'CONSULTANT_ACCESS_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'CENTER_AND_RESOURCE_ROOT_COMPOSITE_ORDER_DEFINED: YES',
  'CENTER_ACCESS_ROOT_PRECEDES_BUSINESS_RESOURCE_ROOT: YES',
  'BUSINESS_RESOURCE_ROOT_PRECEDES_ACCOUNT_SECURITY_LOCK: YES',
  'CENTER_RESOURCE_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'LOGIN_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ACCESS_ROOT: YES',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ROOTS: YES',
  'BOOTSTRAP_GLOBAL_TO_CENTER_LOCK_INVERSION_ALLOWED: NO',
  'global mutex đứng trước sorted center roots',
  'Không giữ login-key mutex và canonical-user mutex cùng lúc',
  'Khi global bootstrap identity, center policy/provisioning state và business resource cùng tham gia, global mutex đứng trước sorted center roots',
  'không tạo nguồn security/session version thứ hai',
], 'Stable roots/one-security-source contract incomplete')

const orderedLockTargets = [
  'LOGIN_BOOTSTRAP_IDENTITY_MUTEX hoặc CANONICAL_USER_BOOTSTRAP_MUTEX',
  'CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id',
  'BUSINESS_RESOURCE_ROOT_ROWS, theo stable resource type + resource ID',
  'ACCOUNT_BOOTSTRAP_RESERVATION_ROWS, theo stable reservation_id',
  'ACCOUNT_SECURITY_CONTROL_ROWS, accounts theo sorted canonical_user_id',
  'STAFF_ROWS, theo stable staff_id',
  'MEMBERSHIP_AND_STAFF_ACCOUNT_LINK_ROWS',
  'CAPABILITY_OVERRIDE_AND_POLICY_ROWS',
  'CONSULTANT_RESOURCE_ASSIGNMENT_ROWS',
  'SESSION_INVALIDATION_ROWS',
  'AUDIT_OUTBOX_ROWS',
]
let previousLockIndex = -1
for (const target of orderedLockTargets) {
  const currentLockIndex = locking.indexOf(target)
  assert(currentLockIndex > previousLockIndex, `Canonical consultant lock order missing/out of order: ${target}`)
  previousLockIndex = currentLockIndex
}

const lifecycle = section(design, '## 15. Provisioning lifecycle', '## 16. Preflight')
for (const state of [
  'NOT_PROVISIONED',
  'PROVISION_REQUESTED',
  'ACCOUNT_RESOLUTION_PENDING',
  'AUTH_ACCOUNT_CREATION_PENDING',
  'AUTH_ACCOUNT_CREATED_RESTRICTED',
  'MEMBERSHIP_PENDING',
  'STAFF_LINK_PENDING',
  'CAPABILITY_POLICY_PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'TERMINATED',
  'CONFLICT',
  'COMPENSATION_REQUIRED',
  'FAILED',
]) assert(lifecycle.includes(`\`${state}\``), `Missing provisioning lifecycle state: ${state}`)

includesAll(lifecycle, [
  'Chỉ `ACTIVE` cùng toàn bộ dependency current mới cấp consultant authority.',
  'Account restricted/disabled; protected compensation nếu finalize fail',
  'No authority; central protected ops',
  'no hard-delete rollback',
  'Every transition records actor, authority basis, idempotency key',
], 'Provisioning lifecycle lacks authority/failure/session semantics')

const protocols = section(design, '## 16. Preflight', '## 17. Suspend')
includesAll(protocols, [
  'broad-RLS write blocker',
  'complete read-path inventory/remediation blocker',
  'AUTH_AND_DATABASE_CROSS_SYSTEM_ATOMIC_TRANSACTION_EXISTS: NO',
  'CONSULTANT_PROVISIONING_REQUIRES_SAGA_OR_RESERVATION: YES',
  'NEW_ACCOUNT_BOOTSTRAP_LOCKS_NONEXISTENT_ACCOUNT_SECURITY_ROW: NO',
  'EMPTY_ACCOUNT_SECURITY_CONTROL_SET_PROVIDES_SERIALIZATION: NO',
  'ACCOUNT_SECURITY_UNIQUE_INDEX_REPLACES_BOOTSTRAP_MUTEX: NO',
  'login_bootstrap_mutex_key =',
  'canonical_user_bootstrap_mutex_key =',
  'bootstrap_mutex_key_version',
  'environment_fingerprint',
  'auth_account_realm_id',
  'stable_login_identifier_kind',
  'canonical_login_identifier_digest',
  'auth_provider',
  'provider_config_version',
  'login_identifier_normalization_version',
  'ceremony_contract_version',
  'canonical_auth_user_id',
  'BOOTSTRAP_MUTEX_IDENTITY_SEPARATE_FROM_CEREMONY_VERSION_BINDING: YES',
  'MUTABLE_PROVIDER_CONFIG_VERSION_MAY_FRAGMENT_CANONICAL_USER_MUTEX: NO',
  'MUTABLE_NORMALIZATION_VERSION_MAY_CREATE_PARALLEL_IDENTITY_MUTEX: NO',
  'AUTH_ACCOUNT_REALM_ID_STABLE_ACROSS_PROVIDER_CONFIG_ROTATION: YES',
  'AUTH_ACCOUNT_REALM_ID_IS_LOGIN_METHOD: NO',
  'AUTH_ACCOUNT_REALM_ID_IS_PROVIDER_CLIENT_ID: NO',
  'LOGIN_BOOTSTRAP_IDENTITY_MUTEX_REQUIRED: YES',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_REQUIRED: YES',
  'BOOTSTRAP_IDENTITY_MUTEX_SCOPED_TO_ENVIRONMENT: YES',
  'RAW_LOGIN_IDENTIFIER_USED_AS_MUTEX_OR_LOG_VALUE: NO',
  'ONE_ACTIVE_BOOTSTRAP_RESERVATION_PER_LOGIN_IDENTITY_KEY: YES',
  'CANONICAL_USER_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: YES',
  'CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_METHOD: YES',
  'CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_NORMALIZATION_VERSION: YES',
  'LOGIN_BOOTSTRAP_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: YES',
  'LOGIN_BOOTSTRAP_MUTEX_USES_STABLE_ACCOUNT_REALM: YES',
  'BOOTSTRAP_CEREMONY_BINDS_PROVIDER_CONFIG_VERSION: YES',
  'BOOTSTRAP_CEREMONY_BINDS_NORMALIZATION_VERSION: YES',
  'BOOTSTRAP_IDENTITY_CONFIG_DRIFT_FAILS_CLOSED: YES',
  'SAME_IDENTITY_ACROSS_PROVIDER_CONFIG_VERSIONS_SHARES_MUTEX: YES',
  'STALE_CEREMONY_MAY_BYPASS_STABLE_IDENTITY_MUTEX: NO',
  'Canonical-user key tuyệt đối không chứa login method, `auth_provider`, provider client ID, config version hoặc normalization version.',
  'provider_config_version`, `login_identifier_normalization_version`, `ceremony_contract_version` và `environment_fingerprint` vẫn bind vào reservation/ceremony envelope',
  'Không persist/log raw normalized identifier, raw email, credential hoặc provider payload làm mutex/audit authority.',
  'Login key chỉ serialize account-creation ceremony; nó không chứng minh ownership, canonical link target hoặc quyền auto-link.',
  'stable registry/control row hoặc transaction-scoped advisory mutex',
  'account_bootstrap_reservation',
  'canonical_login_identifier_digest',
  'ACCOUNT_BOOTSTRAP_RESERVATION_REQUIRED_BEFORE_AUTH_CREATE: YES',
  'ACCOUNT_BOOTSTRAP_RESERVATION_GRANTS_AUTHORITY: NO',
  'ONE_AUTH_CREATE_ATTEMPT_PER_ACTIVE_BOOTSTRAP_RESERVATION: YES',
  'Mọi request cùng login identity key acquire cùng login-bootstrap mutex',
  'Chỉ một reservation được `AUTH_CREATE_PENDING`',
  'không lộ Staff/center của reservation hiện hữu',
  'Unique constraints trên identity-key registry, reservation, canonical registration và account-security control vẫn bắt buộc nhưng chỉ là integrity backstop',
  'LOGIN_NORMALIZATION_ROTATION_REQUIRES_BARRIER: YES',
  'NORMALIZATION_ROTATION_WITHOUT_DRAIN_OR_DUAL_KEY_LOCK_ALLOWED: NO',
  'OLD_AND_NEW_NORMALIZATION_RESERVATIONS_MAY_CALL_AUTH_CONCURRENTLY: NO',
  '**Drain/expire barrier:**',
  '**Dual-key/alias migration:**',
  'acquire cả hai theo deterministic sorted order',
  'enforce one active reservation trên toàn equivalence class',
  'Thiếu approved barrier/migration contract thì fail closed và không bật normalizer mới.',
  'ceremony V1/V2 vẫn tranh cùng login/canonical-user mutex',
  'Một stale ceremony vẫn acquire stable identity mutex trước khi mutate/reconcile shared state',
  'Gọi Auth create **ngoài mọi DB lock**',
  'restricted/disabled lifecycle',
  'Reconcile uncertain Auth result bằng exact reservation, idempotency key và provider evidence',
  'không blind retry tạo account thứ hai',
  'Release login-key transaction locks',
  'transaction mới acquire canonical-user bootstrap mutex',
  'Nếu normalization/provider/config/environment/contract drift trước Auth hoặc finalize, ceremony vẫn tranh stable identity mutex rồi deny/expire reservation',
  'không âm thầm tính mutex key mới hoặc tiếp tục ceremony cũ',
  'CANONICAL_ACCOUNT_AND_SECURITY_CONTROL_REGISTER_ATOMICALLY: YES',
  'ACCOUNT_SECURITY_CONTROL_CREATED_EXACTLY_ONCE_PER_CANONICAL_ACCOUNT: YES',
  'ACCOUNT_BOOTSTRAP_FINALIZE_BINDS_EXACT_AUTH_USER_ID: YES',
  'ACCOUNT_BOOTSTRAP_FINALIZE_CLIENT_EMAIL_IS_AUTHORITY: NO',
  'AUTH_USER_WITHOUT_FINALIZED_ACCOUNT_SECURITY_CONTROL_GETS_AUTHORITY: NO',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ROOTS: YES',
  'DIFFERENT_RESERVATIONS_FOR_SAME_AUTH_USER_SHARE_ONE_MUTEX: YES',
  'TWO_RESERVATIONS_CAN_FINALIZE_ONE_AUTH_USER_CONCURRENTLY: NO',
  'Hai finalize workers của cùng reservation serialize bằng exact reservation row/idempotency',
  'Hai reservation khác nhau resolve cùng canonical Auth user serialize bằng cùng canonical-user bootstrap mutex',
  'Không tạo membership, Staff link, capability authority hay partial account-security state.',
  '`COMPENSATION_REQUIRED`',
  'không tuyên bố rollback atomic giả',
  'Final consultant access provisioning và activation',
  'account bootstrap reservation is FINALIZED',
  'Account/control creation luôn đứng trước membership, Staff link và capability policy',
  'Link-existing database transaction',
  'email chỉ là masked evidence',
  'Another role không silent overwrite',
], 'Provisioning preflight/saga/link-existing semantics incomplete')

const loginBootstrapFormula = section(
  protocols,
  'LOGIN_BOOTSTRAP_MUTEX_FORMULA_BEGIN',
  'LOGIN_BOOTSTRAP_MUTEX_FORMULA_END',
)
includesAll(loginBootstrapFormula, [
  'bootstrap_mutex_key_version',
  'environment_fingerprint',
  'auth_account_realm_id',
  'stable_login_identifier_kind',
  'canonical_login_identifier_digest',
], 'Stable login-bootstrap mutex formula incomplete')
for (const mutableFragment of [
  'provider_config_version',
  'login_identifier_normalization_version',
  'auth_provider',
  'provider_client_id',
]) assert(!loginBootstrapFormula.includes(mutableFragment), `Mutable config/login-method fragment found in login mutex formula: ${mutableFragment}`)

const canonicalUserFormula = section(
  protocols,
  'CANONICAL_USER_BOOTSTRAP_MUTEX_FORMULA_BEGIN',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_FORMULA_END',
)
includesAll(canonicalUserFormula, [
  'bootstrap_mutex_key_version',
  'environment_fingerprint',
  'auth_account_realm_id',
  'canonical_auth_user_id',
], 'Stable canonical-user mutex formula incomplete')
for (const mutableFragment of [
  'provider_config_version',
  'login_identifier_normalization_version',
  'login_method',
  'auth_provider',
  'provider_client_id',
]) assert(!canonicalUserFormula.includes(mutableFragment), `Mutable config/login-method fragment found in canonical-user mutex formula: ${mutableFragment}`)

const preAuthLockOrder = section(
  protocols,
  'ACCOUNT_BOOTSTRAP_RESERVATION_LOCK_ORDER_BEGIN',
  'ACCOUNT_BOOTSTRAP_RESERVATION_LOCK_ORDER_END',
)
let previousPreAuthLockIndex = -1
for (const target of [
  'LOGIN_BOOTSTRAP_IDENTITY_MUTEX',
  'CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id',
  'BUSINESS_RESOURCE_ROOT_ROWS, khi cần, theo stable type + ID',
  'ACCOUNT_BOOTSTRAP_RESERVATION_ROW',
  'STAFF_ROWS, theo stable staff_id',
  'STAFF_ACCOUNT_LINK_INTENT_ROWS',
  'AUDIT_OUTBOX_ROWS',
]) {
  const currentIndex = preAuthLockOrder.indexOf(target)
  assert(currentIndex > previousPreAuthLockIndex, `Pre-Auth bootstrap lock order missing/out of order: ${target}`)
  previousPreAuthLockIndex = currentIndex
}

const bootstrapFinalize = section(
  protocols,
  'ACCOUNT_BOOTSTRAP_FINALIZE_ATOMIC_BEGIN',
  'ACCOUNT_BOOTSTRAP_FINALIZE_ATOMIC_END',
)
let previousFinalizeIndex = -1
for (const step of [
  'LOCK exact CANONICAL_USER_BOOTSTRAP_MUTEX',
  'LOCK affected CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id',
  'LOCK BUSINESS_RESOURCE_ROOT_ROWS khi cần, theo stable type + ID',
  'LOCK ACCOUNT_BOOTSTRAP_RESERVATION_ROWS, theo stable reservation_id',
  'RECHECK all reservations, Staff, environment/provider/config/normalization/ceremony versions, stable realm, idempotency and exact Auth result',
  'VERIFY exact canonical Auth user binding',
  'VERIFY no canonical registration or RECONCILE exact prior idempotent result',
  'CREATE canonical account registration for exact canonical_user_id when absent',
  'CREATE exactly one ACCOUNT_SECURITY_CONTROL_ROW when absent',
  'BIND approved reservation/request and TERMINALIZE all conflicting reservations for exact canonical_user_id',
  'INITIALIZE account security, session and control versions',
  'APPEND audit/outbox',
  'COMMIT database transaction atomically',
]) {
  const currentIndex = bootstrapFinalize.indexOf(step)
  assert(currentIndex > previousFinalizeIndex, `Bootstrap finalize atomic order missing/out of order: ${step}`)
  previousFinalizeIndex = currentIndex
}

assert(
  protocols.indexOf('ACCOUNT_BOOTSTRAP_FINALIZE_ATOMIC_END')
    < protocols.indexOf('### 16.3 Final consultant access provisioning và activation'),
  'Canonical account/security-control bootstrap must complete before membership/link/policy activation.',
)

const invalidation = section(design, '## 17. Suspend', '## 18. Server access architecture')
includesAll(invalidation, [
  'CONSULTANT_TERMINATION_BLOCKS_EFFECTIVE_CAPABILITIES: YES',
  'CONSULTANT_TERMINATION_INVALIDATES_SESSIONS: YES',
  'CONSULTANT_TERMINATION_HARD_DELETES_ACCOUNT: NO',
  'TERMINATED_CONSULTANT_SESSION_REMAINS_AUTHORIZED: NO',
  'Staff unlink phải revoke/suspend membership hoặc fail unlink',
  'override add/remove/expire',
  'Old JWT, cached UI/module state, localStorage hoặc previously revealed PII không thắng current server decision.',
  'Invalidation delivery fail giữ effective deny bằng current server versions',
], 'Suspend/revoke/termination/session invalidation semantics incomplete')

const serverArchitecture = section(design, '## 18. Server access architecture', '## 19. Safe errors')
includesAll(serverArchitecture, [
  'CONSULTANT_GENERIC_ENTITY_READ_PATH_ENABLED: NO',
  'CONSULTANT_GENERIC_CLOUD_READ_BYPASSES_CAPABILITY_PROJECTION_ALLOWED: NO',
  'CONSULTANT_GENERIC_READ_REQUIRES_CAPABILITY_AWARE_PROJECTION: YES',
  'CONSULTANT_RUNTIME_REQUIRES_COMPLETE_READ_PATH_INVENTORY: YES',
  'CONSULTANT_CLIENT_FILTERS_CENTER_WIDE_READ_ALLOWED: NO',
  'CONSULTANT_CLIENT_FILTERS_ASSIGNED_RESOURCE_READ_ALLOWED: NO',
  'MASKED_ENDPOINT_MAY_FETCH_RAW_GENERIC_RESULT_IN_BROWSER: NO',
  'F23_13D_GENERIC_READ_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES',
  'purpose-specific protected endpoint',
  'capability-aware RPC/function',
  'capability-aware minimal projection',
  'narrow reviewed RLS projection',
  'capability + immutable deny',
  'assignment + resource center',
  'Masking/minimal projection hoàn tất trước response rời trusted boundary.',
  'Generic cloud/entity/table `SELECT` không được trả raw/full/center-wide records để browser tự lọc.',
  'không client-filter assigned resources',
  'raw result không được tới browser',
  'direct table `SELECT` và generic cloud entity read',
  'realtime subscriptions/change payloads',
  'cache hydration/invalidation',
  'search, report, bulk/export/download',
  'error, debug, trace và observability payloads',
  'local persistence được hydrate/restore từ server data',
  'Bất kỳ path chưa xác định hoặc trả ngoài exact capability-aware projection đều là **implementation blocker** và fail closed.',
  'không khẳng định broad `SELECT` RLS đang tồn tại',
  'Mỗi operation re-resolve capability, exact center, assignment, field allowlist, version, assurance và audit/outbox.',
  'CONSULTANT_GENERIC_ENTITY_WRITE_PATH_ENABLED: NO',
  'Không có generic arbitrary `entityType + payload` write cho consultant.',
  'Broad active-member write policy trên `center_cloud_entities` phải được remediate trước consultant runtime',
], 'Server architecture does not enforce generic-read/write boundaries')

const operations = section(design, '## 19. Safe errors', '## 20. Canonical negative matrix')
includesAll(operations, [
  'consultant_center_scope_denied',
  'consultant_assignment_conflict',
  'consultant_step_up_required',
  'consultant_provisioning_compensation_required',
  'security_service_unavailable',
  'consultant.auth_account_created_restricted',
  'consultant.contact_revealed',
  'consultant.session_invalidated',
  'không chứa raw phone/email, credential hoặc full payload',
  'Audit/outbox failure làm mutation fail/rollback trong DB transaction hoặc giữ saga pending',
  'Default deny bulk contact/export',
], 'Safe error/audit/rate-limit contract incomplete')

for (let index = 1; index <= 49; index += 1) {
  assert(design.includes(`| D-N${index} |`), `Missing negative case D-N${index}`)
}

const negatives = section(design, '## 20. Canonical negative matrix', '## 21. Threat model')
includesAll(negatives, [
  'D-N1 | Hai provisioning requests cùng Staff | Center/Staff reservation serialize',
  'D-N9 | Browser đổi `center_id` trong payload | Server-derived exact-center mismatch',
  'D-N11 | UI ẩn nút nhưng direct API gọi write | Server resolver/RLS deny',
  'D-N12 | Broad active-member RLS còn generic write | **CRITICAL IMPLEMENTATION BLOCKER**',
  'D-N15 | ALLOW và DENY cùng capability | Exact active `DENY` precedence',
  'D-N21 | Hai consultants cùng claim exclusive lead | Stable resource root serialize',
  'D-N32 | Auth create success, DB finalize fail | Account giữ restricted',
  'D-N33 | Membership/link mutate nhưng audit/outbox fail | Cùng DB transaction rollback',
  'D-N35 | Revoke thành công nhưng invalidation delivery fail | Current server versions deny ngay',
  'D-N37 | Masked endpoint trả raw phone/email rồi client mask | Contract violation',
  'D-N39 | Bulk export all leads/contacts | Default deny',
  'D-N40 | Center access control row missing/duplicate | Fail closed',
  'D-N41 | Consultant gọi generic read/`SELECT` và yêu cầu raw hoặc center-wide records | Generic path deny hoặc chỉ trả exact capability-aware minimal projection',
  'không raw PII, unassigned/cross-center row hay browser-side masking/filtering',
  'D-N42 | Auth create thành công nhưng `ACCOUNT_SECURITY_CONTROL_ROW` chưa finalized | Account giữ restricted',
  'không membership/link/capability authority; retry/compensation qua exact bootstrap reservation',
  'D-N43 | Hai finalize workers dùng cùng bootstrap reservation | Exact reservation lock + idempotency tạo một finalize outcome',
  'không duplicate control hoặc lost security/session version',
  'D-N44 | Flow giữ resource root rồi chờ center root, flow khác giữ center root rồi chờ resource root | Contract/test reject resource-first composite flow',
  'center root trước sorted resource roots, không deadlock',
  'D-N45 | Hai center/Staff khác nhau tạo reservation cùng normalized login identifier | Cùng environment-scoped login-bootstrap mutex',
  'chỉ một reservation có Auth-create authority',
  'không gọi Auth lần hai',
  'D-N46 | Hai reservation khác nhau reconcile tới cùng canonical Auth user ID | Cùng canonical-user bootstrap mutex',
  'chỉ một canonical registration/control',
  'không auto membership/capability/link',
  'D-N47 | Normalization/provider config đổi giữa reservation và Auth/finalize | Ceremony vẫn acquire stable identity mutex rồi version/environment re-check fail closed',
  'không âm thầm đổi mutex key hoặc tiếp tục state cũ',
  'D-N48 | Hai reservations cùng canonical Auth user, một dùng provider config V1 và một dùng V2 | Cùng environment + stable Auth realm + canonical user nên tranh đúng một canonical-user mutex',
  'chỉ một registration/control outcome',
  'uniqueness không thay mutex',
  'D-N49 | Normalization V1/V2 tạo hai login digests cho cùng logical identifier khi còn active reservations | Rotation barrier drain/expire hoặc deterministic dual-key/alias locking',
  'một Auth-create authority/equivalence class',
  'thiếu migration contract thì fail closed, không bật version mới',
  'STALE_OVERRIDE_CAN_GRANT_ACCESS: NO',
  'AUTH_ACCOUNT_CREATED_WITH_FAILED_DB_FINALIZE_GETS_ACTIVE_AUTHORITY: NO',
], 'Negative matrix lacks required substantive fail-closed outcomes')

for (let index = 1; index <= 41; index += 1) {
  assert(design.includes(`| D-T${index} `), `Missing threat D-T${index}`)
}

const threats = section(design, '## 21. Threat model', '## 22. Approval gates')
includesAll(threats, [
  '| Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |',
  'D-T2 Broad RLS OR-policy write bypass',
  'Treat as blocker; remove/narrow broad active-member write and direct-API QA',
  'D-T10 Provision retry creates duplicate Auth accounts',
  'Global login-identity mutex + one-live reservation/idempotency + uncertain-result reconciliation',
  'D-T19 ALLOW accidentally overrides DENY',
  'Fixed deny-precedence algorithm/tests',
  'D-T24 Server sends raw contact to masked client',
  'Server projection/serialization tests; no raw field',
  'D-T36 Center access lock inversion/missing root',
  'Exactly-one pre-existing root + canonical lock order',
  'D-T37 Generic read and masking bypass | High nếu generic read còn mở | Critical',
  'Capability-aware minimal read projection, complete read-path inventory và direct-API tests',
  'Forgotten realtime/export/cache path | Resolver/read-remediation QA',
  'D-T38 Missing account-security bootstrap mutex | Medium | Critical',
  'Stable bootstrap reservation + atomic canonical account/control registration',
  'Alternate provisioning path | Lifecycle/provisioning concurrency tests',
  'D-T39 Center/resource root inversion | Medium | High/Critical',
  'Center → sorted resource roots → reservation/account canonical order',
  'Endpoint bypass | Integration/deadlock tests',
  'D-T40 Cross-reservation duplicate account bootstrap | Medium | Critical',
  'Login-identity mutex trước Auth + canonical-user mutex sau Auth',
  'Normalization/provider namespace defect hoặc alternate provisioning path',
  'Provisioning concurrency and provider-reconciliation tests',
  'D-T41 Bootstrap mutex namespace fragmentation | Medium | Critical',
  'Stable Auth realm, config-independent canonical-user key và normalization rotation barrier/dual-key migration',
  'Alias/equivalence mapping defect hoặc alternate provisioning path',
  'Provider rotation, normalization migration và cross-version concurrency tests',
], 'Threat matrix lacks required likelihood/impact/mitigation/residual/phase semantics')

for (let index = 1; index <= 20; index += 1) {
  assert(design.includes(`| D-AG${index} `), `Missing approval gate D-AG${index}`)
}

const gates = section(design, '## 22. Approval gates', '## 23. Implementation blockers')
includesAll(gates, [
  '| Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |',
  'D-AG1 Staff bắt buộc trước consultant account? | YES, active Staff cùng center',
  'D-AG3 Create-new hay link-existing đầu tiên? | Link existing nếu available; create-new chỉ sau lifecycle/forced-change',
  'D-AG5 Default resource scope? | `ASSIGNED_ONLY`',
  'D-AG14 Override được phép? | YES exact/time-bound; immutable deny không grantable',
  'D-AG18 Broad RLS strategy? | Remove/narrow broad active-member write trước consultant write',
  'D-AG19 Consultant write path? | Narrow capability-aware server operations; no generic table write',
  'D-AG20 Khi bật production? | Sau lifecycle, RLS-write remediation, complete read-path inventory/remediation, resolver, masking, MFA, invalidation, audit và direct-API QA',
  'Các default là design recommendation, không cấp permission hoặc production approval.',
], 'Approval gates lack substantive default/rationale/risk/approver/phase')

const blockers = section(design, '## 23. Implementation blockers', '## 24. Roadmap')
includesAll(blockers, [
  'Canonical account lifecycle và forced first-password-change.',
  'Exactly-one canonical account-security control row/account và session-version source.',
  'Exactly-one stable center-access control row/center.',
  'Stable account-bootstrap reservation/control tồn tại trước Auth create',
  'Environment-scoped login-identity/canonical-user bootstrap mutex registry',
  'Stable Auth account realm registry; versioned ceremony provider/config/environment inventory và drift governance.',
  'Login-normalization rotation barrier hoặc approved deterministic dual-key/alias equivalence migration.',
  'Consultant provisioning saga/reservation/reconciliation/compensation.',
  'Canonical capability resolver với deny precedence và policy versions.',
  'Broad active-member RLS remediation trên `center_cloud_entities`.',
  'Complete inventory/remediation cho direct `SELECT`, generic cloud read, realtime, RPC, cache, export/search, attachment, error/debug và restored persistence.',
  'Narrow capability-aware consultant read projections/server operations; generic raw/center-wide/browser-filter read disabled.',
  'Direct API/RLS/read-path, data-projection, failure, fixture, cross-center/cross-reservation bootstrap và concurrency/deadlock regression tests.',
  'F23_13D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_13_RLS_CHANGE_BY_THIS_PHASE: NO',
  '`NEEDS REVIEW`',
], 'Implementation blockers/production gate incomplete')

const roadmapMarkers = [
  'F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn',
  'F23.13A DONE design / Audit nền Auth-security và chốt boundary',
  'F23.13B DONE design / Liên kết Google identity và login-recovery semantics',
  'F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery',
  'F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement',
]

for (const marker of roadmapMarkers) {
  assert(design.includes(marker), `F23.13D roadmap missing: ${marker}`)
  assert(mfaDesign.includes(marker), `F23.13C roadmap sync missing: ${marker}`)
  assert(identityDesign.includes(marker), `F23.13B roadmap sync missing: ${marker}`)
  assert(foundation.includes(marker), `F23.13A roadmap sync missing: ${marker}`)
  assert(canonicalRoadmap.includes(marker), `Canonical roadmap sync missing: ${marker}`)
}

includesAll(design, [
  'F23.13 FINAL TECHNICAL AUDIT: PASS',
  'F23.13 IMPLEMENTATION: BLOCKED',
  'F23.13 RUNTIME IMPLEMENTATION: NOT STARTED',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
], 'Parent closeout/blocked roadmap semantics missing')

assert(
  design.endsWith('F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE\n'),
  'F23.13 parent closeout must be the exact F23.13D document ending.',
)

for (const forbidden of [
  'CONSULTANT_IS_PLATFORM_ROLE: YES',
  'CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: YES',
  'CONSULTANT_UI_ONLY_GUARD_ALLOWED: YES',
  'CONSULTANT_BROWSER_DIRECT_TABLE_WRITE_ALLOWED: YES',
  'BROAD_RLS_CAN_REMAIN_WHILE_CONSULTANT_WRITE_ENABLED: YES',
  'CONSULTANT_ACCOUNT_AUTO_LINK_BY_EMAIL_ALLOWED: YES',
  'CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: NO',
  'EXPLICIT_DENY_PRECEDES_ALLOW: NO',
  'CONSULTANT_CAN_SELF_GRANT_CAPABILITY: YES',
  'EMPTY_MEMBERSHIP_SET_PROVIDES_PROVISIONING_SERIALIZATION: YES',
  'EMPTY_STAFF_ACCOUNT_LINK_SET_PROVIDES_SERIALIZATION: YES',
  'NEW_ACCOUNT_BOOTSTRAP_LOCKS_NONEXISTENT_ACCOUNT_SECURITY_ROW: YES',
  'EMPTY_ACCOUNT_SECURITY_CONTROL_SET_PROVIDES_SERIALIZATION: YES',
  'ACCOUNT_SECURITY_UNIQUE_INDEX_REPLACES_BOOTSTRAP_MUTEX: YES',
  'ACCOUNT_BOOTSTRAP_RESERVATION_GRANTS_AUTHORITY: YES',
  'AUTH_USER_WITHOUT_FINALIZED_ACCOUNT_SECURITY_CONTROL_GETS_AUTHORITY: YES',
  'ACCOUNT_BOOTSTRAP_RESERVATION_ALONE_SERIALIZES_ALL_MATCHING_IDENTITIES: YES',
  'UNIQUE_ACCOUNT_REGISTRATION_REPLACES_GLOBAL_BOOTSTRAP_MUTEX: YES',
  'LOGIN_BOOTSTRAP_IDENTITY_MUTEX_REQUIRED: NO',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_REQUIRED: NO',
  'BOOTSTRAP_IDENTITY_MUTEX_SCOPED_TO_ENVIRONMENT: NO',
  'RAW_LOGIN_IDENTIFIER_USED_AS_MUTEX_OR_LOG_VALUE: YES',
  'ONE_ACTIVE_BOOTSTRAP_RESERVATION_PER_LOGIN_IDENTITY_KEY: NO',
  'LOGIN_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ACCESS_ROOT: NO',
  'BOOTSTRAP_GLOBAL_TO_CENTER_LOCK_INVERSION_ALLOWED: YES',
  'CANONICAL_USER_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ROOTS: NO',
  'DIFFERENT_RESERVATIONS_FOR_SAME_AUTH_USER_SHARE_ONE_MUTEX: NO',
  'TWO_RESERVATIONS_CAN_FINALIZE_ONE_AUTH_USER_CONCURRENTLY: YES',
  'BOOTSTRAP_IDENTITY_KEY_BINDS_PROVIDER_CONFIG_VERSION: YES',
  'BOOTSTRAP_IDENTITY_KEY_BINDS_NORMALIZATION_VERSION: YES',
  'BOOTSTRAP_IDENTITY_CONFIG_DRIFT_FAILS_CLOSED: NO',
  'BOOTSTRAP_MUTEX_IDENTITY_SEPARATE_FROM_CEREMONY_VERSION_BINDING: NO',
  'MUTABLE_PROVIDER_CONFIG_VERSION_MAY_FRAGMENT_CANONICAL_USER_MUTEX: YES',
  'MUTABLE_NORMALIZATION_VERSION_MAY_CREATE_PARALLEL_IDENTITY_MUTEX: YES',
  'AUTH_ACCOUNT_REALM_ID_STABLE_ACROSS_PROVIDER_CONFIG_ROTATION: NO',
  'AUTH_ACCOUNT_REALM_ID_IS_LOGIN_METHOD: YES',
  'AUTH_ACCOUNT_REALM_ID_IS_PROVIDER_CLIENT_ID: YES',
  'CANONICAL_USER_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: NO',
  'CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_METHOD: NO',
  'CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_NORMALIZATION_VERSION: NO',
  'LOGIN_BOOTSTRAP_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: NO',
  'LOGIN_BOOTSTRAP_MUTEX_USES_STABLE_ACCOUNT_REALM: NO',
  'LOGIN_NORMALIZATION_ROTATION_REQUIRES_BARRIER: NO',
  'NORMALIZATION_ROTATION_WITHOUT_DRAIN_OR_DUAL_KEY_LOCK_ALLOWED: YES',
  'OLD_AND_NEW_NORMALIZATION_RESERVATIONS_MAY_CALL_AUTH_CONCURRENTLY: YES',
  'SAME_IDENTITY_ACROSS_PROVIDER_CONFIG_VERSIONS_SHARES_MUTEX: NO',
  'STALE_CEREMONY_MAY_BYPASS_STABLE_IDENTITY_MUTEX: YES',
  'CENTER_RESOURCE_LOCK_ORDER_INVERSION_ALLOWED: YES',
  'CONSULTANT_GENERIC_ENTITY_READ_PATH_ENABLED: YES',
  'CONSULTANT_GENERIC_CLOUD_READ_BYPASSES_CAPABILITY_PROJECTION_ALLOWED: YES',
  'CONSULTANT_CLIENT_FILTERS_CENTER_WIDE_READ_ALLOWED: YES',
  'CONSULTANT_CLIENT_FILTERS_ASSIGNED_RESOURCE_READ_ALLOWED: YES',
  'MASKED_ENDPOINT_MAY_FETCH_RAW_GENERIC_RESULT_IN_BROWSER: YES',
  'AUTH_AND_DATABASE_CROSS_SYSTEM_ATOMIC_TRANSACTION_EXISTS: YES',
  'CONSULTANT_GENERIC_ENTITY_WRITE_PATH_ENABLED: YES',
  'F23_13_STATUS: IN PROGRESS DESIGN',
  'F23_13_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_13_IMPLEMENTATION_READINESS: READY',
  'F23_13D_IMPLEMENTATION_READINESS: READY',
  'F23_13_RUNTIME_IMPLEMENTATION: DONE',
  'F23.13 IN PROGRESS design /',
  'F23.13 DESIGN PACKAGE COMPLETE - READY FOR FINAL TECHNICAL AUDIT',
  'READY FOR TECHNICAL AUDIT — SEND:',
]) assert(!design.includes(forbidden), `Forbidden consultant design claim found: ${forbidden}`)

assert(!/```sql/i.test(design), 'Design-only document must not contain executable SQL fences.')
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'Design must not contain a real or fixture email address.')

const sensitiveValuePatterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /\botpauth:\/\//i,
  /(?:temporary[_ -]?password|access[_ -]?token|refresh[_ -]?token|id[_ -]?token|client[_ -]?secret)\s*[:=]\s*["']?[A-Za-z0-9._~-]{12,}/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
]
for (const pattern of sensitiveValuePatterns) {
  assert(!pattern.test(design), `Potential secret/credential payload found: ${pattern}`)
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

for (const content of [design, mfaDesign, identityDesign, foundation, platformDesign, canonicalRoadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.13D stable bootstrap identity namespace hardening docs smoke: PASS')
