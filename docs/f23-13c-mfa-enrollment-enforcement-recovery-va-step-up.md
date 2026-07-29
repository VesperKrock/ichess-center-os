# F23.13C — MFA Enrollment, Enforcement, Recovery và Step-Up

## 1. Trạng thái, phạm vi và boundary

```text
F23_13_STATUS: DONE DESIGN
F23_13A_STATUS: DONE DESIGN
F23_13A_FINAL_TECHNICAL_AUDIT: PASS
F23_13A_IMPLEMENTATION_READINESS: BLOCKED
F23_13B_FINAL_TECHNICAL_AUDIT: PASS
F23_13B_STATUS: DONE DESIGN
F23_13B_IMPLEMENTATION_READINESS: BLOCKED
F23_13C_STATUS: DONE DESIGN
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_IMPLEMENTATION_READINESS: BLOCKED
F23_13D_STATUS: DONE DESIGN
F23_13D_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_IMPLEMENTATION_READINESS: BLOCKED
F23_13_FINAL_TECHNICAL_AUDIT: PASS
F23_13_IMPLEMENTATION_READINESS: BLOCKED
F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13_AUTH_CONFIGURATION_CHANGE: NO
F23_13_SUPABASE_ACTION: NOT RUN
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
F23_12D_IMPLEMENTATION_READINESS: BLOCKED
F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED
RUNTIME_CHANGE: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
AUTH_CHANGE: NO
MFA_ENABLEMENT_CHANGE: NO
SUPABASE_ACTION: NOT RUN
REAL_QR_CREATED: NO
REAL_FACTOR_CHANGE: NO
REAL_ACCOUNT_CHANGE: NO
```

F23.13C là **design-only**. Tài liệu này không bật TOTP, WebAuthn/passkey hoặc MFA provider; không sinh seed, QR, recovery code, factor, session hay assertion thật; không sửa runtime, Auth config, SQL, migration hoặc Supabase.

Nhãn bằng chứng:

- **REPO FACT:** hành vi đã kiểm chứng trong repository.
- **PARTIAL FOUNDATION:** nền liên quan có sẵn nhưng chưa đủ contract.
- **DESIGN PROPOSAL:** contract mục tiêu cho implementation sau.
- **DEFERRED:** cần phase/approval/dependency khác.

F23.13B final technical audit đã `PASS`; G2, identity-link mutex, versioned ceremony envelope và recovery separation vẫn nguyên vẹn. Final audit không mở implementation F23.12/F23.13.

F23.13B FINAL TECHNICAL AUDIT PASS - F23.13C DESIGN MAY START

## 2. Repo truth kế thừa

```text
MFA_RUNTIME_IMPLEMENTED: NO
TOTP_RUNTIME_IMPLEMENTED: NO
WEBAUTHN_RUNTIME_IMPLEMENTED: NO
MFA_RECOVERY_RUNTIME_IMPLEMENTED: NO
SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO
AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO
GOOGLE_IDENTITY_LINKING_IMPLEMENTED: NO
```

| Khu vực | Phân loại | Kết luận |
|---|---|---|
| Auth/runtime | REPO FACT | Không có enrollment, factor confirmation, MFA recovery hoặc server step-up implementation. |
| Session | PARTIAL FOUNDATION | Có Auth session events nhưng chưa có canonical security/session-version invalidation. |
| Local Auth config | REPO FACT | Config local được audit đang tắt các factor liên quan; không chứng minh remote production. |
| Account lifecycle | PARTIAL FOUNDATION | Membership active/revoked không phải account-wide lifecycle/security lock. |
| Google identity | DESIGN PROPOSAL | G2 đã PASS design, implementation vẫn blocked; MFA recovery không được link/recover Google. |

UI badge, role label, browser timestamp hoặc access token hiện hữu không phải bằng chứng MFA/step-up. Remote Auth/MFA truth phải được kiểm chứng riêng trước implementation.

## 3. MFA taxonomy và recommendation

| Method | Vị trí đề xuất | Boundary |
|---|---|---|
| TOTP authenticator | Baseline khả thi cho Owner, Center Admin và consultant trước PII write. | Phishing-resistant: không; seed phải server-protected. |
| WebAuthn/passkey | Hướng user-facing phishing-resistant tiếp theo. | Runtime deferred; credential ID cần stable external mutex. |
| Hardware-backed security key | Bắt buộc cho production Platform Owner. | Nên có primary + spare; protected recovery. |
| SMS OTP | Chỉ exception sau risk/cost approval. | Không phải default. |
| Email OTP | Không luôn là strong second factor khi cùng inbox là login/recovery root. | Không dùng để tự nâng assurance mạnh. |
| Recovery codes | Recovery method một lần. | Không phải enrolled login factor thường xuyên. |

```text
MFA_INITIAL_BASELINE: TOTP
PHISHING_RESISTANT_DIRECTION: WEBAUTHN_OR_HARDWARE_SECURITY_KEY
SMS_OTP_DEFAULT_FACTOR: NO
EMAIL_OTP_ALWAYS_COUNTS_AS_STRONG_SECOND_FACTOR: NO
RECOVERY_CODE_IS_ENROLLED_FACTOR: NO
PLATFORM_OWNER_PRODUCTION_HARDWARE_BACKED_MFA_REQUIRED: YES
```

TOTP là baseline đề xuất, không phải tuyên bố runtime đã bật. WebAuthn/passkey chỉ mở sau foundation, credential-registry và security review.

## 4. Role-based enforcement policy

```text
PLATFORM_OWNER_MFA_POLICY: HARDWARE_BACKED_REQUIRED
PLATFORM_OWNER_MFA_GRACE_PERIOD_DAYS: 0
OWNER_MFA_BASELINE: TOTP_OR_STRONGER
CENTER_ADMIN_MFA_BASELINE: TOTP_OR_STRONGER
CONSULTANT_PII_WRITE_MFA_REQUIRED: YES
TEACHER_MFA_POLICY: DEFERRED_RISK_TIER
MFA_POLICY_SERVER_DERIVED: YES
MFA_GRACE_PERIOD_GRANTS_SENSITIVE_ACCESS: NO
ROLE_ESCALATION_BYPASSES_MFA_POLICY: NO
MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: NO
```

| Role/risk | Baseline | Grace proposal | Enforcement consequence |
|---|---|---|---|
| Platform Owner production | Hardware-backed; hướng 2 active hardware factors. | 0 ngày. | Không đạt policy thì không có production authority. |
| Owner | TOTP hoặc mạnh hơn. | 14 ngày rollout có thể duyệt. | Sensitive action bị khóa ngay cả trong grace. |
| Center Admin | TOTP hoặc mạnh hơn. | 14 ngày rollout có thể duyệt. | Không được dùng center authority để reset Owner/Platform Owner. |
| Consultant có PII write/full-contact reveal | TOTP hoặc mạnh hơn trước capability. | 14 ngày rollout có thể duyệt. | Capability nhạy cảm fail closed phía server. |
| Teacher | Risk tier deferred. | Chưa chốt. | Không suy policy từ client/role label. |

Role escalation chỉ tạo restricted/pending authority đến khi factor/assurance policy mới đạt. Grace period không mở private HR, financial export, identity link, permission/account/platform mutation hoặc các action nhạy cảm khác.

## 5. Canonical account-security control

Conceptual canonical parent/control, chưa phải SQL:

```text
account_security_control
canonical_user_id
security_version
session_version
identity_control_version
factor_control_version
assurance_policy_version
updated_at
```

```text
ACCOUNT_SECURITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
ACCOUNT_SECURITY_MUTATION_LOCK_TARGET: ACCOUNT_SECURITY_CONTROL_ROW
DUPLICATE_SECURITY_VERSION_SOURCES_ALLOWED: NO
EMPTY_FACTOR_SET_PROVIDES_SERIALIZATION: NO
FACTOR_UNIQUENESS_REPLACES_ACCOUNT_MUTEX: NO
ACCOUNT_IDENTITY_CONTROL_IS_CANONICAL_SECURITY_CONTROL_ROLE: YES
ACCOUNT_IDENTITY_CONTROL_STORES_SECURITY_SESSION_VERSION_COPY: NO
```

Row phải tồn tại trước mọi identity hoặc factor mutation; missing/duplicate row fail closed. `security_version` và `session_version` có đúng một canonical source.

F23.13B `ACCOUNT_IDENTITY_CONTROL_ROW` là logical lock role của cùng physical `ACCOUNT_SECURITY_CONTROL_ROW` được khuyến nghị. Nếu implementation dùng child/view 1:1, child chỉ chứa identity projection/control version và reference parent; không lưu bản sao độc lập của security/session versions. Identity và factor mutation cập nhật shared versions dưới cùng canonical parent lock, tránh lost update giữa hai service.

Empty factor set, pending-factor query hoặc unique constraint không tạo mutex vì row cần khóa có thể chưa tồn tại. Mọi enrollment, confirmation, challenge state mutation, recovery, replacement, reset và revoke khóa exact account-security control row.

## 6. Canonical factor model và count policy

Conceptual factor model:

```text
factor_id
canonical_user_id
factor_type
factor_status
factor_version
display_name
assurance_class
secret_material_ref
external_credential_identifier_digest
enrollment_id
verified_at
last_challenged_at
last_accepted_time_step
suspended_at
revoked_at
revoked_reason
compromise_version
created_at
updated_at
```

`secret_material_ref` là protected server reference, không phải plaintext seed. External identifier chỉ lưu protected digest/registry reference theo approved design.

Factor statuses:

```text
PENDING
ACTIVE
SUSPENDED
REVOKED
COMPROMISED
REPLACED
EXPIRED
```

```text
REVOKED_FACTOR_MAY_BE_REACTIVATED: NO
PENDING_FACTOR_GRANTS_ASSURANCE: NO
FACTOR_ID_ALONE_GRANTS_AUTHORITY: NO
MAX_ACTIVE_TOTP_FACTORS_PER_ACCOUNT: 1
ONE_LIVE_FACTOR_ENROLLMENT_PER_ACCOUNT_TYPE: YES
MIN_ACTIVE_HARDWARE_FACTORS_FOR_PLATFORM_OWNER: 2
```

Chỉ `ACTIVE` với factor/account/policy versions hiện hành mới có thể góp assurance. Unknown status deny. Revoked, compromised, replaced hoặc expired là terminal cho factor version; replacement tạo record/version mới và không reuse seed/ownership client claim.

## 7. Stable external credential mutex

TOTP per-account enrollment dùng account-security mutex; TOTP secret không được dùng làm mutex key. Sau khi WebAuthn/security-key credential ID đã được verified, ownership check/mutation phải lấy stable external mutex:

```text
external_factor_mutex_key =
  versioned_digest(environment_namespace, factor_type, credential_identifier)
```

```text
EXTERNAL_FACTOR_IDENTIFIER_MUTEX_REQUIRED: YES
EXTERNAL_FACTOR_UNIQUE_INDEX_IS_ONLY_BACKSTOP: YES
```

Cùng credential ID trong exact environment tranh cùng mutex. Raw credential ID không log. Collision chỉ gây extra serialization, không đổi ownership. Mutex service missing/timeout fail closed. Database unique invariant là integrity backstop, không thay serialization. WebAuthn runtime vẫn deferred.

## 8. MFA enrollment lifecycle

Chỉ state `ACTIVE`, cùng account lifecycle/policy/version hợp lệ, mới cấp assurance.

| State | Authority | Actor/transition | Expiry và terminal/retry | Secret exposure | Session effect | Audit event |
|---|---|---|---|---|---|---|
| `NOT_ENROLLED` | Không | Server inventory; eligible user có thể re-auth và tạo intent. | Không expiry; retry qua intent mới. | Không secret. | Restricted/deny theo policy. | Policy evaluation khi cần. |
| `ENROLLMENT_INTENT_CREATED` | Không | Server sau fresh re-auth + account lock. | TTL 10 phút; single-use; retry idempotent hoặc intent mới. | Chưa expose seed. | Không nâng assurance. | `mfa.enrollment_intent_created` |
| `SECRET_ISSUED` | Không | Server sinh protected TOTP seed/pending factor và one-time presentation. | Bound intent TTL; hết hạn terminal pending secret. | Một lần trong controlled view. | Không nâng assurance. | `mfa.secret_presented` không chứa secret. |
| `CONFIRMATION_PENDING` | Không | User gửi code; server challenge dưới lock/version guard. | Attempt/TTL limited; retry theo policy. | Không trả seed/clock detail. | Không nâng assurance. | `mfa.confirmation_failed` hoặc success transaction. |
| `ACTIVE` | Có điều kiện | Atomic confirmation hoặc verified external credential activation. | Active đến suspend/revoke/replace/policy failure. | Không expose secret lại. | Có thể tạo assurance sau challenge; không tự nâng session cũ. | `mfa.factor_activated` |
| `REAUTH_REQUIRED` | Không | Server khi primary re-auth/session freshness thiếu. | Ceremony dừng; re-auth rồi intent mới. | Không expose secret. | Existing session không thành step-up. | `mfa.enrollment_denied` |
| `EXPIRED` | Không | Server terminalize intent/pending factor hết TTL. | Terminal record/version; enrollment mới. | Pending secret unusable. | Không assurance. | `mfa.enrollment_expired` |
| `SUSPENDED` | Không | Security policy tạm block factor. | Không challenge đến protected review; có thể terminalize thành revoke. | Không expose secret. | Invalidate/review factor-bound assertions/sessions. | `mfa.factor_suspended` |
| `REVOKED` | Không | User/protected operator/emergency transaction. | Terminal; không reactivate. | Secret/reference unusable. | Invalidate sessions/assertions theo policy. | `mfa.factor_revoked` |
| `REPLACED` | Không | Replacement transaction sau new-factor confirmation. | Terminal old factor. | Old secret unusable. | Invalidate old-factor assertions/sessions. | `mfa.factor_replaced` |
| `RECOVERY_REQUIRED` | Không normal authority | Lost device/compromise/recovery-code flow. | Restricted proof/session; retry/rate-limit. | Không expose old secret. | Restricted recovery session only. | `mfa.recovery_required` |
| `RESET_PENDING_APPROVAL` | Không | Protected reset request chờ independent approval. | Cooldown/TTL; approve/deny/cancel/expire terminal request states. | Không secret. | Target authority restricted/risk-blocked. | `mfa.reset_requested` |

## 9. Enrollment intent và creation policy

Versioned envelope:

```text
enrollment_intent_id
ceremony_contract_version
environment_fingerprint
canonical_user_id
logical_security_session_id
factor_type
factor_policy_version
account_security_version_at_creation
session_version_at_creation
factor_control_version_at_creation
created_at
expires_at
consumed_at
intent_version
request_id
idempotency_key
```

```text
MFA_ENROLLMENT_INTENT_SINGLE_USE: YES
MFA_ENROLLMENT_INTENT_SERVER_STORED: YES
MFA_ENROLLMENT_DEFAULT_TTL_MINUTES: 10
MFA_ENROLLMENT_BINDS_LOGICAL_SECURITY_SESSION: YES
MFA_ENROLLMENT_BINDS_ACCOUNT_SECURITY_VERSION: YES
MFA_ENROLLMENT_BINDS_SESSION_VERSION: YES
MFA_ENROLLMENT_BINDS_FACTOR_CONTROL_VERSION: YES
```

Creation yêu cầu signed-in canonical account, eligible lifecycle, fresh primary re-auth, exact role/factor policy và canonical account-security lock. Transaction expire/cancel stale intent theo policy, tạo tối đa một nonterminal live enrollment/account/type, bind post-mutation versions và append audit/outbox atomic. Cùng idempotency key trả exact safe outcome.

Empty pending-enrollment/factor query không serialize creation. Browser không chọn account, role, factor policy, versions hoặc TTL.

## 10. TOTP secret generation và presentation boundary

Server dùng cryptographically secure randomness; client không gửi/tạo seed và seed không derive từ email/user ID. Seed chỉ nằm trong pending factor qua protected encrypted reference; hết TTL trở thành unusable.

QR provisioning payload chỉ được render trong controlled, no-cache, one-time, re-auth-bound enrollment view. Không đặt seed/QR payload trong URL/query/referrer, localStorage/sessionStorage, public file, logs, analytics, audit metadata, telemetry, screenshot automation hoặc crash report. Refresh không tự sinh/present secret mới ngoài ceremony/idempotency contract.

```text
TOTP_SECRET_CLIENT_GENERATED_ALLOWED: NO
TOTP_SECRET_BROWSER_STORAGE_ALLOWED: NO
TOTP_SECRET_LOGGING_ALLOWED: NO
TOTP_SECRET_PLAINTEXT_PERSISTENCE_ALLOWED: NO
QR_PROVISIONING_PAYLOAD_PUBLIC_STORAGE_ALLOWED: NO
REAL_TOTP_SECRET_GENERATED_BY_THIS_PHASE: NO
```

Không tạo QR hoặc seed thật trong phase này.

## 11. TOTP parameters, confirmation và timestep replay

```text
TOTP_DIGITS: 6
TOTP_TIME_STEP_SECONDS: 30
TOTP_ALLOWED_CLOCK_SKEW_STEPS: 1
TOTP_CODE_REUSE_ACROSS_CHALLENGES_ALLOWED: NO
TOTP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO
TOTP_ACCEPTED_TIMESTEP_MUST_ADVANCE_MONOTONICALLY: YES
TOTP_CANDIDATE_TIMESTEP_LESS_THAN_OR_EQUAL_TO_HIGHEST_ACCEPTED_ALLOWED: NO
OLDER_TOTP_TIMESTEP_AFTER_NEWER_ACCEPTED_CAN_SUCCEED: NO
```

Algorithm là approval gate cần interoperability validation; tài liệu không tự tuyên bố provider/runtime algorithm. Server time là authority.

`last_accepted_time_step` được định nghĩa canonical là `highest_accepted_time_step`, không phải timestep của request đến sau cùng. Recommended baseline là:

```text
candidate_time_step > highest_accepted_time_step
```

Trong cùng factor/challenge transaction, server xác định candidate timestep từ server time, approved ±1 skew và exact code; khóa exact factor/challenge; re-read highest accepted timestep; reject candidate `<= highest_accepted_time_step`; consume exact challenge; update highest timestep cùng factor/challenge versions; append audit/outbox; rồi commit atomic.

Nếu timestep mới hơn đã accepted, code của timestep cũ hơn bị `mfa_challenge_replayed` kể cả nó vẫn nằm trong ±1 skew. Server không cấp assurance, không consume business action, không hạ highest timestep và không ghi success thứ hai. Vì vậy request out-of-order không thể thắng monotonic state.

Nếu interoperability tương lai thật sự cần nhận out-of-order unused timestep trong skew, chỉ approved consumed-step registry tương đương mới được thay baseline:

```text
factor_id
time_step
consumed_at
challenge_id
```

Registry cần exact uniqueness, stable factor lock, atomic challenge consumption và versioned policy. Không fallback sang rule “candidate khác timestep cuối” vì rule đó cho phép replay older step. UX retry dùng server-issued idempotent outcome, không validate code lần nữa như challenge mới.

Enrollment confirmation canonical order:

1. Lock `ACCOUNT_SECURITY_CONTROL_ROW`.
2. Lock exact enrollment intent row.
3. Lock exact pending factor row.
4. Re-check TTL/single-use/lifecycle.
5. Re-check security/session/factor-control/policy versions.
6. Validate code theo server time/skew và unused timestep.
7. Transition pending factor to `ACTIVE`.
8. Consume enrollment intent.
9. Increment factor-control/security versions theo policy.
10. Create recovery-code generation intent/set theo approved flow.
11. Append audit/outbox.
12. Commit atomic.

Sai confirmation tăng protected attempt count và rate limit; không log code, lộ seed/clock detail hoặc activate factor. Terminalization policy không được trở thành enumeration oracle.

## 12. Canonical MFA lock order

Khi verified external credential identifier đã biết:

```text
MFA_MUTATION_LOCK_ORDER_DEFINED: YES
EXTERNAL_FACTOR_MUTEX_PRECEDES_ACCOUNT_SECURITY_MUTEX: YES
MFA_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO
```

Canonical MFA mutation lock order:

```text
0. STABLE_EXTERNAL_FACTOR_MUTEX
1. ACCOUNT_SECURITY_CONTROL_ROW, nhiều accounts theo sorted canonical_user_id
2. ENROLLMENT_RESET_RECOVERY_REQUEST_ROWS
3. FACTOR_ROWS, theo stable factor_id
4. RECOVERY_CODE_ROWS
5. SESSION_STEP_UP_ROWS
6. AUDIT_OUTBOX_ROWS
```

TOTP/no-external-identifier lock order:

```text
ACCOUNT_SECURITY_CONTROL_ROW
→ ENROLLMENT_REQUEST_ROW
→ FACTOR_ROW
→ RECOVERY_CODE_ROW
→ SESSION_STEP_UP_ROW
→ AUDIT_OUTBOX_ROW
```

Không lấy account lock rồi quay lại lấy external mutex. Không giữ database lock khi user nhập code, render QR, gọi authenticator/notification provider, chờ reviewer hoặc gửi email. External verification hoàn tất trước mutation transaction; short-lived result được revalidate dưới bound ceremony versions trước commit.

## 13. Challenge model và assurance

Conceptual challenge:

```text
challenge_id
canonical_user_id
logical_security_session_id
factor_id
factor_version
challenge_type
purpose
target_action
target_resource
required_assurance
security_version_at_creation
session_version_at_creation
created_at
expires_at
attempt_count
consumed_at
challenge_version
idempotency_key
```

```text
MFA_CHALLENGE_SINGLE_USE: YES
MFA_CHALLENGE_CLIENT_IS_AUTHORITY: NO
MFA_CHALLENGE_PURPOSE_BOUND: YES
```

Challenge do server tạo, short TTL, attempt-limited, exact logical session/factor/version/action/resource/risk và không dùng raw code làm identifier.

Assurance classes đề xuất:

```text
AAL1_PRIMARY_ONLY
AAL2_TOTP
AAL2_PHISHING_RESISTANT
AAL3_HARDWARE_BACKED
```

Server-derived assurance bind canonical user, logical security session, authentication methods, factor ID/version, account security/session versions, issued/expiry time và purpose. Đây không tuyên bố mapping trực tiếp với Auth provider hiện tại. Unknown assurance hoặc dependency unavailable deny.

## 14. Step-up assertion và protected actions

Conceptual assertion:

```text
step_up_assertion_id
canonical_user_id
logical_security_session_id
factor_id
factor_version
assurance_level
purpose
exact_action
exact_resource
security_version
session_version
issued_at
expires_at
consumed_at
single_use
assertion_version
```

```text
STEP_UP_DEFAULT_FRESHNESS_MINUTES: 10
STEP_UP_CRITICAL_FRESHNESS_MINUTES: 5
STEP_UP_ASSERTION_SINGLE_USE: YES
STEP_UP_CRITICAL_ASSERTION_SINGLE_USE: YES
STEP_UP_ASSERTION_REUSABLE_ACROSS_PURPOSES: NO
STEP_UP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO
STEP_UP_REPLACES_BUSINESS_AUTHORIZATION: NO
APPROVAL_REPLACES_STEP_UP: NO
```

Mọi assertion là server-issued, purpose-bound và single-use; noncritical UX có thể dùng fresh session assurance để xin assertion mới, không replay assertion cũ. Critical assertion bind exact action/resource và consume atomic cùng business mutation hoặc approved equivalent authorization protocol.

Assertion cho `identity.link` không dùng được cho private HR download, permission escalation, Platform Owner grant hoặc financial export.

Step-up bắt buộc cho đổi password, link/unlink Google, factor enroll/replace/revoke, recovery-code regeneration, MFA reset, private HR, sensitive financial/export, account revoke/restore, permission escalation, Platform Owner bootstrap/grant, sensitive Acting action và consultant full-contact reveal theo policy. Step-up không thay capability/business authorization; approval không thay step-up.

### 14.1 Cross-domain critical step-up composition

Security-only MFA mutations tiếp tục dùng canonical MFA lock order ở section 12. Khi assertion được consume cùng business mutation, không được áp universal account-first order:

```text
CRITICAL_STEP_UP_ALWAYS_LOCKS_ACCOUNT_SECURITY_BEFORE_BUSINESS_ROOT: NO
CROSS_DOMAIN_STEP_UP_LOCK_ORDER_DEFINED: YES
BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES
STEP_UP_ASSERTION_PRECEDES_PROTECTED_TARGET_MUTATION: YES
CROSS_DOMAIN_LOCK_ORDER_INVERSION_ALLOWED: NO
```

Canonical composite order:

```text
0. BUSINESS_DOMAIN_ROOT_MUTEX_ROWS, theo canonical business-domain order
1. ACCOUNT_SECURITY_CONTROL_ROW, actor/targets theo stable canonical order
2. STEP_UP_ASSERTION_ROW
3. REMAINING_BUSINESS_APPROVAL_TARGET_ROWS, theo domain order
4. AUDIT_OUTBOX_ROWS
```

Business-domain root tier đã duyệt không bị đảo bởi MFA overlay. Platform Owner authority giữ global authority-control root; Acting sensitive action giữ canonical Acting/authority roots; permission escalation, financial/private export và HR/private-document action giữ root order của domain tương ứng. Domain chưa có stable root phải định nghĩa root trước runtime.

```text
PLATFORM_AUTHORITY_ROOT_LOCK_PRECEDES_STEP_UP_SECURITY_LOCKS: YES
ACTING_DOMAIN_ROOT_LOCK_PRECEDES_STEP_UP_SECURITY_LOCKS: YES
```

Không lấy account-security row rồi quay lại chờ global authority, Acting hoặc business root. Step-up không thay Platform authority, Acting session, capability, approval hoặc business invariant; approval không thay step-up. Đây là composition overlay, không sửa canonical root contract F23.12.

### 14.2 Composite assertion/business atomicity

```text
CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_BEGIN
BUSINESS_DOMAIN_ROOT_LOCKS
ACCOUNT_SECURITY_CONTROL_ROW_LOCK
STEP_UP_ASSERTION_ROW_LOCK
ASSERTION_VERSION_PURPOSE_RESOURCE_RECHECK
ASSERTION_CONSUME
EXACT_PROTECTED_BUSINESS_MUTATION
AUDIT_OUTBOX_APPEND
COMMIT_ATOMIC
CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_END
```

Nếu assertion stale/purpose/resource mismatch, business mutation không chạy. Nếu business mutation hoặc audit/outbox fail, assertion consumption và mọi side effect rollback. Idempotent retry trả exact prior committed business outcome và không consume assertion lần hai.

### 14.3 Distributed-equivalent restriction

Nếu assertion và business mutation không cùng transactional store, chỉ approved reservation/finalize protocol được dùng, với exact business request ID, exact assertion claim, short TTL, one claim/assertion, idempotency, commit/finalize, cancel/expiry, immutable audit/outbox và recovery runbook. Không được có business success thiếu final assertion-consumption evidence hoặc claimed assertion silently lost.

```text
CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: NO
```

Không được triển khai pattern “consume assertion rồi gọi API”. Noncommitted failure phải trả resumable/idempotent state hoặc release/expire claim an toàn; không reuse assertion cho request khác.

## 15. Recovery-code model, use và regeneration

```text
RECOVERY_CODE_COUNT: 10
RECOVERY_CODE_SINGLE_USE: YES
RECOVERY_CODE_PLAINTEXT_STORAGE_ALLOWED: NO
RECOVERY_CODE_REGENERATION_INVALIDATES_OLD_CODES: YES
```

Conceptual record:

```text
recovery_code_id
canonical_user_id
code_set_version
code_digest
salt
status
created_at
used_at
revoked_at
```

Codes là high-entropy, displayed once, per-code salt, server-protected hash/pepper; không plaintext, reversible storage, logs hoặc audit value. Audit chỉ giữ opaque set version/count/outcome.

### 15.1 Canonical restricted recovery-session envelope

```text
restricted_recovery_session_id
ceremony_contract_version
environment_fingerprint
canonical_user_id
recovery_request_id
recovery_code_set_version
recovery_code_id_digest
purpose
allowed_action_set
logical_recovery_session_id
account_security_version
session_version
factor_control_version
issued_at
expires_at
completed_at
revoked_at
status
session_version_record
idempotency_key
```

`session_version_record` là concurrency version của recovery-session record, không phải bản sao nguồn account `session_version`. Không lưu raw recovery code.

Canonical statuses:

```text
PENDING_ISSUANCE
ACTIVE_RESTRICTED
COMPLETED
REVOKED
EXPIRED
INVALIDATED
```

```text
RESTRICTED_RECOVERY_SESSION_PURPOSE_BOUND: YES
RESTRICTED_RECOVERY_SESSION_DEFAULT_TTL_MINUTES: 15
RESTRICTED_RECOVERY_SESSION_SINGLE_ACTIVE_PER_REQUEST: YES
RESTRICTED_RECOVERY_SESSION_REPLAY_ALLOWED: NO
RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SECURITY_VERSION: YES
RESTRICTED_RECOVERY_SESSION_BINDS_POST_COMMIT_SESSION_VERSION: YES
RESTRICTED_RECOVERY_SESSION_CLIENT_IS_AUTHORITY: NO
```

Chỉ `ACTIVE_RESTRICTED` với exact current account security/session/factor-control versions, request/code-set binding, TTL, purpose và allowed-action set mới có recovery authority. Allowed actions mặc định chỉ gồm:

```text
mfa.factor_replacement.begin
mfa.factor_replacement.confirm
mfa.recovery.complete
```

Session không được link/unlink Google, đổi/reset password, restore lifecycle/membership, mutate role/capability, export/view private data, tạo normal privileged session, approve admin reset hoặc bắt đầu Platform Owner/Acting action. Browser không thêm purpose/action hoặc kéo dài TTL.

### 15.2 Recovery-code use và post-commit version binding

Recovery-code use transaction:

1. Lock account-security control.
2. Lock exact recovery request.
3. Lock exact matching recovery-code row.
4. Re-check lifecycle/current security/session/factor-control/code-set versions.
5. Derive exact next security/session versions.
6. Atomic transition `unused -> used`.
7. Persist security/session version update.
8. Create one canonical restricted recovery session bound to those post-commit versions.
9. Revoke stale step-up assertions.
10. Append audit/outbox.
11. Commit atomic.

Session creation, version update và audit/outbox là cùng atomic unit. Bất kỳ failure nào `rollback / deny`; recovery code không được consumed nếu canonical safe session outcome không thể tạo. Idempotent retry trả exact prior committed session/outcome, không tạo active session thứ hai.

```text
RECOVERY_SESSION_GRANTS_NORMAL_PRIVILEGED_ACCESS: NO
RECOVERY_CODE_CAN_LINK_GOOGLE: NO
RECOVERY_CODE_CAN_RESTORE_MEMBERSHIP: NO
MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: NO
MFA_RECOVERY_RELINKS_GOOGLE: NO
MFA_RECOVERY_RESETS_PASSWORD: NO
```

Restricted recovery session chỉ cho replacement enrollment và required verification. Nó không link Google, đổi password/role, restore membership/account lifecycle hoặc export private data.

Regeneration yêu cầu fresh step-up, eligible lifecycle và account-security lock; transaction invalidate toàn bộ old unused codes, tạo đúng một new set, tăng set/security version, append audit/outbox và present once. Hai concurrent regenerations chỉ có một current set; không merge sets.

### 15.3 Recovery-session completion, revoke và replay

Completion transaction:

1. Lock account-security control.
2. Lock exact restricted recovery-session row.
3. Lock replacement enrollment/factor rows theo canonical MFA order.
4. Re-check TTL, `ACTIVE_RESTRICTED`, exact purpose/actions và bound versions.
5. Confirm replacement factor đã `ACTIVE`.
6. Terminalize old factor theo replacement/compromise flow.
7. Transition session `ACTIVE_RESTRICTED -> COMPLETED`.
8. Bump required security/session/factor-control versions.
9. Invalidate restricted/old sessions và assertions.
10. Append audit/outbox.
11. Commit atomic.

Revoke, expiry hoặc version/lifecycle invalidation chuyển session sang terminal `REVOKED`, `EXPIRED` hoặc `INVALIDATED` dưới account/session locks và audit/outbox. Refresh, Back/Forward, duplicate confirmation hoặc retry sau terminal state deny; không factor/session mutation thứ hai. Cùng recovery request/code outcome chỉ có một active canonical session; idempotent retry có thể trả cùng opaque session outcome.

## 16. Lost-device và factor replacement

Lost device không tự xóa factor:

```text
RECOVERY_REQUIRED
→ restricted recovery proof
→ replacement enrollment
→ new factor confirmation
→ old factor revoke
→ session/assertion invalidation
→ recovery complete
```

Standard account có thể dùng recovery code; privileged account cần stronger review. Platform Owner dùng protected two-person process kế thừa F23.12D. Center Admin không reset Platform Owner MFA.

Factor mới phải confirm trước khi old factor remove, trừ emergency compromise path. Replacement tạo new record/version; old factor chuyển `REPLACED`/`REVOKED`, không reactivate. TOTP không reuse seed; WebAuthn không transfer ownership từ client claim. Old-factor sessions/assertions bị invalidated; privileged replacement cần notification và additional approval.

## 17. Admin-assisted reset

Reset lifecycle:

```text
RESET_REQUESTED
RESET_PENDING_APPROVAL
RESET_APPROVED
RESET_EXECUTING
RESET_COMPLETED
RESET_DENIED
RESET_CANCELLED
RESET_EXPIRED
```

Request bind exact target/reason/requester, independent approver theo risk, requester step-up, cooldown, immutable audit và notification không secret. Không remove factor trước approval. Execution terminalize old factor, tạo restricted replacement session và invalidate session/assertion. Approve/cancel race serialize dưới account-security/request locks.

```text
CENTER_ADMIN_CAN_RESET_PLATFORM_OWNER_MFA: NO
CENTER_ADMIN_CAN_RESET_OWNER_MFA: NO
MFA_TARGET_CAN_SELF_APPROVE_ADMIN_RESET: NO
CONSULTANT_CAN_RESET_MFA: NO
```

Owner không tự reset chính mình bằng center authority. Platform Owner reset cần protected two-person central security operation. Admin reset không đổi password, link Google, restore membership hoặc tự enroll factor.

## 18. Emergency revoke và factor/reset transaction

Compromise path được block authority ngay nhưng không tự enroll replacement:

1. Lock account-security control.
2. Lock exact factor/reset request rows theo canonical order.
3. Re-check lifecycle/factor/control/security versions.
4. Transition active factor to terminal `COMPROMISED`/`REVOKED`.
5. Increment factor-control/security/session versions.
6. Create session/assertion invalidation outbox.
7. Create recovery/reset-required state.
8. Append immutable audit/outbox.
9. Commit atomic.

Failure rollback toàn unit. Invalidation delivery lỗi không làm old version tiếp tục authority; committed canonical version/state block local authority và protected outbox retry/incident tiếp tục.

## 19. Session và assertion invalidation

Factor revoke/compromise/replacement, MFA reset, recovery-code use/regeneration, role escalation, lifecycle lock, version bump, assurance-policy change và identity-link security event đều trigger invalidate/review.

Old JWT/access token hoặc cached assertion không thắng account lifecycle, security/session/factor versions. Push/realtime chỉ cải thiện UX. Protected server action re-check versions và factor status.

Nếu invalidation dependency lỗi: local authority bị block bằng committed state/version; operation không báo hoàn tất trọn vẹn; tạo protected retry/incident và audit/outbox; fail closed. Privileged/compromise reset/revoke invalidate all sessions; standard account theo approved risk policy nhưng luôn invalidate impacted factor/assertions.

## 20. Enforcement, login và restricted session

Protected server action resolve đồng thời:

```text
canonical account lifecycle
exact active membership/role/capability
required MFA policy version
current assurance
factor status/version
account security/session versions
step-up purpose/freshness
business approval
```

Client không quyết enrollment, role policy, grace, assurance, factor strength, freshness hoặc recovery eligibility.

Login có thể tạo restricted session khi cần enrollment, grace còn hiệu lực, temporary password phải đổi hoặc recovery pending. Restricted session không mở sensitive modules, write sensitive data, reveal private fields, link Google, mutate permission/role, export hoặc bắt đầu sensitive Acting action. Hết grace, server deny normal authority; không chỉ ẩn UI.

Google linked login vẫn phải qua canonical lifecycle và MFA policy. Google authentication không tự tạo MFA assurance hoặc bypass recovery/password security.

## 21. Audit, rate limit và safe errors

Minimal audit events:

```text
mfa.enrollment_intent_created
mfa.secret_presented
mfa.confirmation_failed
mfa.factor_activated
mfa.factor_suspended
mfa.factor_revoked
mfa.factor_replaced
mfa.challenge_succeeded
mfa.challenge_failed
mfa.step_up_issued
mfa.step_up_consumed
mfa.recovery_requested
mfa.recovery_code_used
mfa.recovery_codes_regenerated
mfa.reset_requested
mfa.reset_approved
mfa.reset_denied
mfa.session_invalidated
```

Audit chỉ chứa opaque IDs, type/class, safe reason/outcome, versions, request/correlation, timestamp và masked environment metadata; không seed, QR payload, OTP, recovery code, accepted timestep, raw credential ID, token hoặc provider payload.

Rate-limit buckets tách cho enrollment intent, secret retrieval, confirmation, login challenge, step-up, recovery-code attempt/regeneration, reset request/approval, replacement và revoke. Signals gồm account, logical session, factor/challenge, IP/network, device/risk và environment; IP không là identity duy nhất. Threshold không công khai. Repeated failures có cooldown, terminalization, temporary security lock, notification hoặc incident review.

Safe errors:

```text
mfa_not_available
mfa_enrollment_required
mfa_enrollment_reauth_required
mfa_enrollment_expired
mfa_enrollment_conflict
mfa_challenge_required
mfa_challenge_invalid
mfa_challenge_failed
mfa_challenge_expired
mfa_challenge_replayed
mfa_factor_not_active
mfa_factor_policy_not_met
mfa_recovery_required
mfa_recovery_code_invalid
mfa_recovery_code_consumed
mfa_reset_pending
mfa_reset_denied
mfa_reset_not_authorized
mfa_step_up_required
mfa_step_up_expired
mfa_step_up_purpose_mismatch
account_lifecycle_blocked
security_service_unavailable
rate_limit_exceeded
```

Outward response không lộ factor existence, seed, QR payload, recovery code, accepted timestep, raw provider error/internal policy, stack, persistence detail hoặc private account data. Enumeration-sensitive cases dùng response/timing class tương đương.

## 22. Canonical concurrency và replay matrix

| Case | Scenario | Exact fail-closed outcome |
|---|---|---|
| C-N1 | Hai enrollment intents cùng account/type. | Account-security lock + one-live policy cho một intent/idempotent outcome; không ceremony kép. |
| C-N2 | Hai confirmation requests cùng enrollment intent. | Intent/factor locks và single-use cho một activation; request sau replay/consumed deny, không audit success kép. |
| C-N3 | Hai TOTP codes cùng timestep cho hai challenges. | Factor lock + `last_accepted_time_step` cho một completion; challenge sau `mfa_challenge_replayed`. |
| C-N4 | Confirmation sau enrollment expiry. | Deny, pending factor `EXPIRED`/unusable; không activate hoặc session assurance. |
| C-N5 | Account security version đổi sau intent creation. | Deny version mismatch, terminalize safe; ceremony mới. |
| C-N6 | Session version đổi sau intent creation. | Deny stale logical-session envelope; không factor mutation. |
| C-N7 | Factor-control version đổi sau intent creation. | Deny stale inventory/count; re-enroll sau policy evaluation. |
| C-N8 | Role policy đổi giữa intent và confirmation. | Deny/re-evaluate exact factor policy version; không grandfather sensitive authority. |
| C-N9 | Pending factor row bị thiếu. | Fail closed/integrity incident; không recreate từ browser/intent payload. |
| C-N10 | Duplicate account-security control row. | Fail closed/integrity incident; không chọn ngẫu nhiên source/version. |
| C-N11 | Account-security control row bị thiếu. | Fail before intent/mutation; không lazy fallback trong ceremony. |
| C-N12 | Empty factor set bị dùng làm mutex. | Contract/test fail; require pre-existing control lock, không tiếp tục count check. |
| C-N13 | Hai active TOTP factors được tạo đồng thời. | Shared account lock + count re-check cho một activation; transaction sau conflict/rollback. |
| C-N14 | Factor revoke và challenge đồng thời. | Security/factor version re-check làm revoke thắng; challenge deny hoặc issued assertion invalidated. |
| C-N15 | Factor replacement và login challenge đồng thời. | Old factor terminal/version bump; old-factor challenge/session deny/invalidate. |
| C-N16 | Admin reset và user challenge đồng thời. | Reset execution version bump/terminal state chặn challenge; không assurance mới sống qua reset. |
| C-N17 | Reset approval và cancellation đồng thời. | Request/account locks cho đúng một terminal transition; loser safe conflict, không reset nửa vời. |
| C-N18 | Hai recovery requests dùng cùng recovery code. | Recovery-code row lock + atomic unused→used cho một restricted session; request sau consumed deny. |
| C-N19 | Recovery code đã dùng bị replay. | `mfa_recovery_code_consumed`; không session/proof mới và không lộ code-set detail. |
| C-N20 | Hai recovery-code regeneration đồng thời. | Account/code locks + set version cho một current set; transaction sau re-read/conflict. |
| C-N21 | Old recovery-code set dùng sau regeneration. | Code-set/security version mismatch; old codes revoked và deny. |
| C-N22 | Recovery session cố link Google. | Purpose/capability deny; `RECOVERY_CODE_CAN_LINK_GOOGLE: NO`, audit attempt. |
| C-N23 | Recovery session cố restore membership. | Purpose/capability deny; no membership/account lifecycle mutation. |
| C-N24 | Center Admin cố reset Platform Owner MFA. | Account-wide authorization deny, no target mutation/detail; audit unauthorized attempt. |
| C-N25 | Target tự approve admin reset. | Separation-of-duty deny; request remains pending/terminal per policy. |
| C-N26 | Session invalidation lỗi sau factor revoke. | Canonical versions block local authority; no complete-success response, outbox retry/incident. |
| C-N27 | Audit/outbox lỗi sau factor mutation. | Atomic rollback/deny; không unaudited factor/reset/recovery mutation. |
| C-N28 | Factor active nhưng account lifecycle disabled. | Lifecycle precedence deny challenge/login/action; invalidate/reject session. |
| C-N29 | Role escalation xảy ra khi chưa đạt MFA policy. | Restricted/pending authority only; sensitive capability fail closed. |
| C-N30 | Grace period hết trong khi tab đang mở. | Server current-time/policy re-check deny normal/sensitive authority; UI state không thắng. |
| C-N31 | Step-up assertion replay. | Consumed/single-use guard deny; business mutation không chạy lần hai. |
| C-N32 | Step-up assertion dùng sai purpose/resource. | Exact binding mismatch deny; assertion không chuyển purpose. |
| C-N33 | Step-up assertion dùng sau security-version bump. | Version mismatch deny và invalidate assertion. |
| C-N34 | WebAuthn credential đồng thời link hai accounts. | Stable external mutex serializes; một owner, transaction sau conflict; unique index only backstop. |
| C-N35 | External credential mutex timeout. | `security_service_unavailable`, rollback/no ownership/factor/session. |
| C-N36 | Access token refresh nhưng logical security session còn đúng. | Không fail chỉ vì raw token đổi; tiếp tục chỉ khi logical session và all bound versions/policy vẫn khớp. |
| C-N37 | Timestep mới hơn đã accepted, sau đó timestep cũ hơn được gửi khi vẫn trong ±1 skew. | Reject `candidate_time_step <= highest_accepted_time_step` bằng `mfa_challenge_replayed`; không assurance/business consume, không hạ high-water mark hoặc success audit thứ hai. |
| C-N38 | Recovery session được tạo với pre-update security/session versions. | Contract/test failure và atomic rollback; code không consumed, không phát stale session. |
| C-N39 | Hai recovery sessions được tạo từ cùng recovery request/code outcome. | Request/account locks + idempotency cho một canonical session/winner; không hai `ACTIVE_RESTRICTED` sessions. |
| C-N40 | Expired/completed recovery session cố confirm factor lần nữa. | Status/TTL/version deny replay; không factor, session hoặc audit success mutation thứ hai. |
| C-N41 | Platform authority flow giữ global root rồi chờ account-security trong khi flow khác giữ account-security rồi chờ global root. | Mọi composite flow bắt business/global root trước; account-first flow bị contract/test reject, không inversion/deadlock. |
| C-N42 | Assertion consumed nhưng protected business mutation rollback/fail. | Cùng transaction rollback assertion consume; equivalent protocol giữ resumable/idempotent noncommitted state, không mất assertion hoặc business side effect. |

```text
CONCURRENT_TOTP_ENROLLMENTS_CAN_BOTH_ACTIVATE: NO
SAME_TOTP_TIMESTEP_CAN_COMPLETE_TWO_CHALLENGES: NO
ONE_RECOVERY_CODE_CAN_COMPLETE_TWO_REQUESTS: NO
TWO_RECOVERY_CODE_SETS_CAN_BOTH_BE_CURRENT: NO
REVOKED_FACTOR_CAN_COMPLETE_CONCURRENT_CHALLENGE: NO
STEP_UP_ASSERTION_REPLAY_ALLOWED: NO
```

Unique constraints chỉ là backstop, không thay stable account/external/factor/request locks.

## 23. Atomic transaction contracts

### 23.1 Enrollment confirmation atomic block

```text
ENROLLMENT_CONFIRMATION_ATOMIC_BEGIN
ACCOUNT_SECURITY_CONTROL_ROW_LOCK
ENROLLMENT_INTENT_ROW_LOCK
PENDING_FACTOR_ROW_LOCK
INTENT_CONSUME
PENDING_FACTOR_ACTIVATE
FACTOR_SECURITY_CONTROL_VERSION_UPDATE
RECOVERY_CODE_GENERATION_INTENT_OR_SET
AUDIT_OUTBOX_APPEND
COMMIT_ATOMIC
ENROLLMENT_CONFIRMATION_ATOMIC_END
```

### 23.2 Recovery-code use atomic block

```text
RECOVERY_CODE_USE_ATOMIC_BEGIN
ACCOUNT_SECURITY_CONTROL_ROW_LOCK
RECOVERY_REQUEST_ROW_LOCK
RECOVERY_CODE_ROW_LOCK
CURRENT_VERSION_RECHECK
NEXT_SECURITY_SESSION_VERSIONS_DERIVE
CODE_UNUSED_TO_USED
SECURITY_SESSION_VERSION_UPDATE
RESTRICTED_RECOVERY_SESSION_CREATE_BOUND_TO_POST_COMMIT_VERSIONS
STALE_STEP_UP_REVOKE
AUDIT_OUTBOX_APPEND
COMMIT_ATOMIC
RECOVERY_CODE_USE_ATOMIC_END
```

### 23.3 Factor revoke/reset atomic block

```text
FACTOR_REVOKE_RESET_ATOMIC_BEGIN
ACCOUNT_SECURITY_CONTROL_ROW_LOCK
FACTOR_REQUEST_ROW_LOCK
FACTOR_TERMINAL_STATE
SECURITY_SESSION_FACTOR_CONTROL_VERSION_UPDATE
SESSION_ASSERTION_INVALIDATION_OUTBOX
RECOVERY_RESET_REQUIRED_STATE
AUDIT_OUTBOX_APPEND
COMMIT_ATOMIC
FACTOR_REVOKE_RESET_ATOMIC_END
```

### 23.4 Cross-domain critical step-up consumption atomic block

```text
CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_BEGIN
BUSINESS_DOMAIN_ROOT_LOCKS
ACCOUNT_SECURITY_CONTROL_ROW_LOCK
STEP_UP_ASSERTION_ROW_LOCK
ASSERTION_VERSION_PURPOSE_RESOURCE_RECHECK
ASSERTION_CONSUME
EXACT_PROTECTED_BUSINESS_MUTATION
AUDIT_OUTBOX_APPEND
COMMIT_ATOMIC
CROSS_DOMAIN_CRITICAL_STEP_UP_ATOMIC_END
```

Approved equivalent distributed authorization protocol phải đạt cùng single-use/idempotency/fail-closed property và restriction ở 14.3. Không có business/factor/recovery mutation thành công nếu audit, invalidation hoặc required version update mất.

## 24. Threat model C-T1–C-T34

| Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| C-T1 TOTP seed browser leak | Medium | Critical | Controlled one-time view; no storage/log/referrer | Compromised browser during enrollment | Enrollment security tests |
| C-T2 QR screenshot/telemetry leak | Medium | Critical | No telemetry/screenshot automation/cache; re-auth view | User/manual capture | Enrollment security tests |
| C-T3 Seed plaintext database/log | Medium | Critical | Encrypted protected reference; redaction and secret scan | Key-management compromise | Secret-storage review |
| C-T4 Weak random seed | Low/Medium | Critical | Server CSPRNG and approved entropy | Runtime/library defect | Crypto review |
| C-T5 TOTP brute force | High | High | Short TTL, attempts/rate-limit, risk lock | Distributed attacks | Challenge runtime/tests |
| C-T6 TOTP clock-window abuse | Medium | High | Server time, ±1 approved skew, attempt controls | Clock drift/tuning | Interoperability tests |
| C-T7 Same/older-timestep replay | Medium | Critical | Factor lock + monotonic high-water mark or approved consumed-step registry | Clock/replication defect | TOTP replay tests |
| C-T8 Enrollment CSRF/session riding | Medium | Critical | Fresh re-auth, logical session/policy/version envelope | Compromised active session | Enrollment + step-up tests |
| C-T9 Pending factor grants assurance | Medium | Critical | Active-only server assurance | Status resolver defect | Policy tests |
| C-T10 Two concurrent factor enrollments | Medium | Critical | Pre-existing account lock + one-live/count policy | Bypassed service path | Concurrency tests |
| C-T11 Recovery code plaintext storage | Medium | Critical | Salted protected digest; show once | User stores insecurely | Recovery storage review |
| C-T12 Recovery code replay race | Medium | Critical | Exact row lock + atomic unused→used | Distributed persistence defect | Recovery concurrency tests |
| C-T13 Recovery set regeneration race | Medium | High | Account/code locks + single current set version | Service bypass | Recovery concurrency tests |
| C-T14 Admin reset abuse | Medium | Critical | Protected authority, reason, step-up, independent approval | Colluding operators | Reset ops tests |
| C-T15 Self-approved reset | Medium | Critical | Requester/target/approver separation | Identity data defect | Approval tests |
| C-T16 Center Admin resets Platform Owner | Medium | Critical | Central account-wide deny + two-person Platform Owner path | Authorization regression | Direct-API tests |
| C-T17 Factor revoke leaves active session | Medium | Critical | Canonical version block + invalidation outbox | Propagation delay | Invalidation tests |
| C-T18 Step-up client timestamp spoof | High if client-only | Critical | Server issued/clock/version assertions | Server clock defect | Step-up tests |
| C-T19 Step-up purpose confusion | Medium | Critical | Exact purpose/action/resource binding | Incomplete action inventory | Authorization tests |
| C-T20 Step-up replay | Medium | Critical | Single-use assertion consumed with mutation | Distributed atomicity defect | Concurrency tests |
| C-T21 Grace UI-only enforcement | High | Critical | Server policy/current-time resolution | Missed endpoint | Direct-API policy tests |
| C-T22 Role escalation before MFA | Medium | Critical | Restricted pending authority until policy met | Role-policy race | Role transition tests |
| C-T23 Disabled account passes challenge | Medium | Critical | Lifecycle precedence at challenge/issue/action | Lifecycle service outage | Lifecycle prerequisite |
| C-T24 Recovery session becomes full session | Medium | Critical | Purpose-bound restricted session/capability deny | Token audience defect | Recovery authorization tests |
| C-T25 MFA recovery silently changes password | Medium | Critical | Recovery purpose separation; explicit password flow | Shared handler regression | Cross-recovery tests |
| C-T26 MFA recovery silently links Google | Medium | Critical | G2 ceremony only; recovery session deny | Shared handler regression | B/C compatibility tests |
| C-T27 WebAuthn credential linked two accounts | Medium | Critical | Stable external mutex + account lock + unique backstop | Mutex namespace defect | WebAuthn concurrency tests |
| C-T28 External credential mutex bypass | Medium | Critical | Mandatory service guard/fail closed | Alternate path | Architecture/direct tests |
| C-T29 Audit failure creates unaudited reset | Low/Medium | Critical | Atomic audit/outbox rollback | Outbox outage | Audit transaction tests |
| C-T30 Policy/version drift ceremony→commit | Medium | High/Critical | Bind/re-check environment, factor/security/session/control/policy versions | Incorrect inventory/version bump | Ceremony contract tests |
| C-T31 Older-timestep replay inside skew | Medium | High/Critical | Reject candidate ≤ highest accepted; approved consumed-step registry only as reviewed equivalent | Clock/replication defect | TOTP replay tests |
| C-T32 Recovery-session scope/version confusion | Medium | Critical | Purpose/action-bound envelope, TTL, post-commit versions, single active + terminal states | Endpoint misses purpose/audience check | Recovery authorization tests |
| C-T33 Cross-domain lock inversion | Medium | High/Critical | Business root → account-security → assertion → business targets | Alternate endpoint bypass | Integration/concurrency tests |
| C-T34 Assertion lost before business mutation | Medium | High | One transaction or reservation/finalize protocol with idempotency/recovery | Distributed finalize/recovery defect | Idempotency/failure tests |

## 25. Approval gates C-AG1–C-AG20

| Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |
|---|---|---|---|---|---|
| C-AG1 TOTP baseline rollout đầu? | YES | Khả thi cho managed users | Phishing risk còn lại | Security + Product | TOTP foundation |
| C-AG2 Algorithm/digits/timestep/skew? | 6 digits, 30 seconds, ±1; algorithm cần interoperability approval | Tương thích và replay window rõ | Provider mismatch/clock drift | Security + Architecture | Pre-runtime validation |
| C-AG3 Role bắt buộc MFA? | Platform Owner, Owner, Center Admin; consultant trước PII write | Theo impact | Policy gap ở role khác | Security + Executive | Enforcement rollout |
| C-AG4 Grace period? | Platform Owner 0; Owner/Admin/consultant đề xuất 14 ngày | Controlled migration | Account restricted/rollout support | Security + Operations | Rollout |
| C-AG5 Sensitive action không grace? | Private HR, financial export, identity link, permission/account/platform action | Không để grace thành bypass | UX friction | Security + Data Owners | Enforcement inventory |
| C-AG6 Hardware factors Platform Owner? | 2 production factors | Primary + spare | Cost/physical custody | Security + Executive | Hardware rollout |
| C-AG7 Multiple TOTP/account? | 1 active rollout đầu | Giảm recovery ambiguity | Thiếu spare TOTP | Security + Product | TOTP foundation |
| C-AG8 Enrollment TTL? | 10 minutes | Hạn chế seed/intent window | User retry | Security + Product | Enrollment runtime |
| C-AG9 Challenge TTL/max attempts? | Short TTL, risk-tiered attempts, threshold không public | Chống brute force | False lock/cost | Security + SRE | Challenge runtime |
| C-AG10 Step-up freshness? | 10 minutes default, 5 critical | Giảm session riding | Friction | Security + Product | Step-up service |
| C-AG11 Critical single-use? | YES; design đề xuất all assertions single-use | Chống replay/purpose confusion | Phải mint assertion mới | Security + Architecture | Step-up service |
| C-AG12 Recovery-code count/format? | 10 single-use high-entropy codes | Có recovery inventory hữu hạn | User custody risk | Security + Product | Recovery runtime |
| C-AG13 Code protection? | Salted server-protected hashes, no plaintext | Giảm database disclosure | Pepper/key compromise | Security + Architecture | Secret storage review |
| C-AG14 Ai admin-reset từng role? | Central protected authority; Center Admin không reset Owner/Platform Owner | Separation account-wide | Central ops latency | Security + Executive | Reset ops |
| C-AG15 Reset cooldown? | Risk-tiered; privileged independent approval/cooldown | Detect takeover | Lockout duration | Security + Operations | Reset ops |
| C-AG16 Replacement overlap? | New factor confirms trước old removal, trừ compromise emergency | Tránh lockout | Compromised old factor window | Security + Product | Replacement runtime |
| C-AG17 Revoke/reset invalidate session? | All cho privileged/compromise; risk-selected standard | Remove stale assurance | Re-login cost | Security + SRE | Invalidation service |
| C-AG18 Khi mở WebAuthn/passkey? | Sau TOTP foundation + phishing-resistant implementation review | Cần credential mutex/UX/support | Delayed stronger auth | Security + Architecture + Product | WebAuthn phase |
| C-AG19 Notification bắt buộc? | Enrollment, new factor, recovery use, reset, revoke, replacement | Detect abuse | Notification fatigue | Security + Product | Notification service |
| C-AG20 Khi bật MFA production? | Sau remote truth, lifecycle, invalidation, rate-limit, audit/outbox và security QA | Dependency fail-closed đầy đủ | Rollout chậm | Security + Architecture + Product | Production gate |

Defaults không cấp phép implementation hoặc enablement thật.

## 26. Implementation blockers và readiness

- Canonical account lifecycle.
- Exactly-one account-security control row/account.
- Một canonical source cho security/session versions, tương thích F23.13B.
- Factor/enrollment/challenge/recovery persistence.
- Server-derived assurance và policy resolver.
- Session/assertion invalidation.
- Encrypted secret storage và recovery-code protection.
- Rate-limit/risk service.
- Immutable audit/transactional outbox.
- Notification service.
- Protected admin-reset approval service.
- WebAuthn credential mutex/registry trước WebAuthn.
- Verified remote Auth/MFA configuration truth.
- Approved role/action/policy inventory.
- Fixtures, crypto/interoperability, concurrency và security tests.
- F23.13B linked-identity compatibility.

```text
F23_13C_IMPLEMENTATION_READINESS: BLOCKED
F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13_AUTH_CONFIGURATION_CHANGE: NO
F23_13_SUPABASE_ACTION: NOT RUN
```

Nếu design yêu cầu seed, QR, factor, reset, Auth config hoặc Supabase thật trước approvals, kết luận là `NEEDS REVIEW`.

## 27. Roadmap sau F23.13C

```text
F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn
    F23.13A DONE design / Audit nền Auth-security và chốt boundary
    F23.13B DONE design / Liên kết Google identity và login-recovery semantics
    F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery
    F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement
```

F23.13 FINAL TECHNICAL AUDIT: PASS
F23.13 IMPLEMENTATION: BLOCKED
F23.13 RUNTIME IMPLEMENTATION: NOT STARTED

## 28. Definition of done design

- F23.13B và F23.13C final audit đã sync `PASS`; hardening mutex/envelope vẫn nguyên vẹn.
- Taxonomy/role policy, canonical account-security control và factor model đã chốt.
- Enrollment/confirmation/challenge, monotonic TOTP replay, out-of-order skew, secret/QR boundary và one-live policy đã chốt.
- External credential mutex và canonical lock order có semantic contract.
- Restricted recovery-session envelope bind post-commit versions, TTL, purpose/action và terminal replay state.
- Cross-domain step-up giữ business roots F23.12 trước account-security/assertion locks và có atomic/equivalent protocol contract.
- Step-up, recovery codes, lost device, replacement, reset, revoke và invalidation fail closed.
- Recovery không bypass lifecycle, password, Google identity, membership hoặc business authorization.
- C-N1–C-N42, C-T1–C-T34 và C-AG1–C-AG20 có outcome/default.
- Đây là docs-contract test target, không phải runtime/MFA proof hoặc production approval.

F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE
