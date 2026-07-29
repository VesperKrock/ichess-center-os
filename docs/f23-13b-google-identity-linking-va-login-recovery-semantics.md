# F23.13B — Google Identity Linking và Login-Recovery Semantics

## 1. Trạng thái, phạm vi và boundary

```text
F23_13_STATUS: DONE DESIGN
F23_13A_FINAL_TECHNICAL_AUDIT: PASS
F23_13A_STATUS: DONE DESIGN
F23_13A_IMPLEMENTATION_READINESS: BLOCKED
F23_13B_STATUS: DONE DESIGN
F23_13B_FINAL_TECHNICAL_AUDIT: PASS
F23_13B_IMPLEMENTATION_READINESS: BLOCKED
F23_13C_STATUS: DONE DESIGN
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_STATUS: DONE DESIGN
F23_13D_FINAL_TECHNICAL_AUDIT: PASS
F23_13_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_IMPLEMENTATION_READINESS: BLOCKED
F23_13D_IMPLEMENTATION_READINESS: BLOCKED
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
SUPABASE_ACTION: NOT RUN
OAUTH_PROVIDER_CHANGE: NO
PROVIDER_CREDENTIAL_CHANGE: NO
REAL_ACCOUNT_CHANGE: NO
REAL_IDENTITY_LINK_CHANGE: NO
```

F23.13B là **design-only**. Tài liệu này chốt contract cho liên kết Google identity, đăng nhập bằng identity đã liên kết và recovery semantics; không bật provider, không tạo callback route, không gọi OAuth thật, không sửa Auth config, runtime, SQL, migration hoặc Supabase.

Nhãn sử dụng trong audit:

- **REPO FACT:** hành vi đã kiểm chứng trong repository tại thời điểm audit.
- **PARTIAL FOUNDATION:** nền hiện hữu có liên quan nhưng chưa đủ contract F23.13B.
- **DESIGN PROPOSAL:** contract mục tiêu cho phase implementation sau.
- **DEFERRED:** không triển khai ở F23.13B hoặc phải chờ approval/dependency.

F23.13A đã qua final technical audit; việc này không mở readiness implementation của F23.12 hoặc F23.13.

F23.13A FINAL TECHNICAL AUDIT PASS - F23.13B DESIGN MAY START

## 2. Repo truth kế thừa và audit bổ sung

```text
CURRENT_LOGIN_IDENTIFIER: EMAIL
USERNAME_RESOLVER_IMPLEMENTED: NO
SELF_SERVICE_PASSWORD_CHANGE_IMPLEMENTED: NO
FORCED_FIRST_PASSWORD_CHANGE_IMPLEMENTED: NO
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO
AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO
GOOGLE_IDENTITY_LINKING_IMPLEMENTED: NO
GOOGLE_PROVIDER_ENABLED_BY_THIS_PHASE: NO
```

| Khu vực | Phân loại | Repo truth và hệ quả thiết kế |
|---|---|---|
| Login | REPO FACT | `src/supabase-auth.js` gọi trực tiếp `signInWithPassword` với email đã trim và password. Nhãn UI không phải bằng chứng có username resolver. |
| Auth session | PARTIAL FOUNDATION | Runtime nghe `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`, có `getUser` và `signOut`; không có canonical session-version invalidation. |
| Đổi/reset password | PARTIAL FOUNDATION | Có server function admin reset mật khẩu tạm; không có self-service đổi mật khẩu, forced first-change hoặc password-recovery flow canonical. Reset hiện không chứng minh revoke session. |
| Account lifecycle | PARTIAL FOUNDATION | Membership có active/revoked; revoke trả `auth_disable_not_implemented` và không phải account-wide disable/ban/security lock. |
| Membership/role | REPO FACT | Center membership và role hiện hữu không phải canonical identity authority; restore membership không khôi phục account identity. |
| Google/OAuth | REPO FACT | Không thấy runtime `signInWithOAuth`, link/unlink identity, callback validation hoặc provider login. |
| MFA | REPO FACT | Không thấy runtime enrollment/challenge/recovery/step-up. |
| Local Auth config | REPO FACT | Repo-local config đang tắt manual linking và các factor được audit; đây không phải bằng chứng về remote production. |

Không suy diễn remote Auth/provider truth từ file local. Remote inventory, client, redirect, issuer, tenant và provider enablement là blocker riêng trước implementation.

## 3. Quyết định rollout Google mặc định

Google trong phase này là identity provider cho authentication, không phải Google Calendar. Calendar, Drive và Classroom đều ngoài scope.

```text
GOOGLE_IDENTITY_MODEL: LINK_TO_EXISTING_ICHESS_ACCOUNT
GOOGLE_SIGN_IN_AUTO_PROVISIONING_ALLOWED: NO
GOOGLE_AUTO_LINK_BY_EMAIL_ALLOWED: NO
GOOGLE_ONLY_ACCOUNT_ALLOWED_INITIAL_ROLLOUT: NO
GOOGLE_IDENTITY_REPLACES_CANONICAL_ACCOUNT_ID: NO
GOOGLE_PROVIDER_EMAIL_IS_AUTHORITY: NO
GOOGLE_CALENDAR_IN_F23_13_SCOPE: NO
GOOGLE_DRIVE_IN_F23_13_SCOPE: NO
GOOGLE_CLASSROOM_IN_F23_13_SCOPE: NO
```

**DESIGN PROPOSAL:** chọn G2 — user đăng nhập tài khoản iChess đã tồn tại, re-auth rồi chủ động link Google identity. G1 — Google Sign-In — chỉ được mở cho identity đã link sau khi mapping/lifecycle/session guard tồn tại. G3 — Google Workspace restriction — là policy tùy chọn, độc lập với G2 và mặc định tắt.

Canonical identity duy nhất là `canonical iChess Auth user_id`. Google subject không thay account ID, không tự tạo membership, role hoặc account.

## 4. Canonical account-provider model

Đây là conceptual model, không phải schema hoặc SQL.

### 4.1 Canonical account

```text
canonical_user_id
account_lifecycle_status
primary_login_methods
security_version
session_version
created_at
updated_at
```

- `canonical_user_id` là target duy nhất của authority, audit, lifecycle và session.
- `account_lifecycle_status` phải có canonical service; trạng thái eligible mới được link/login/recover.
- `primary_login_methods` là server-derived inventory của phương thức đã verified, không lấy từ UI.
- `security_version` chặn ceremony dựa trên security state cũ; `session_version` chặn session cũ.

### 4.2 Provider identity link

```text
identity_link_id
canonical_user_id
provider
provider_issuer
provider_subject
provider_email_evidence
provider_email_verified_at
workspace_tenant_evidence
status
link_version
linked_at
linked_by_user_id
revoked_at
revoked_reason
last_successful_login_at
created_at
updated_at
```

Canonical uniqueness invariant:

```text
provider + provider_issuer + provider_subject
```

Một tuple subject chỉ được thuộc một canonical account. Email provider có thể đổi, chỉ là protected evidence/policy input, không phải lookup key, account key hoặc authority. Audit chỉ giữ masked/digested evidence cần thiết.

```text
MAX_ACTIVE_GOOGLE_IDENTITIES_PER_ACCOUNT: 1
ONE_GOOGLE_SUBJECT_MAY_LINK_MULTIPLE_ACCOUNTS: NO
EMPTY_IDENTITY_LINK_SET_PROVIDES_SERIALIZATION: NO
IDENTITY_LINK_UNIQUENESS_REPLACES_STABLE_MUTEX: NO
ACCOUNT_IDENTITY_MUTEX_REQUIRED: YES
PROVIDER_SUBJECT_MUTEX_REQUIRED: YES
```

Email alias không hợp nhất hai provider subject. Mở nhiều link/account hoặc transfer identity là thay đổi policy cần approval và threat review riêng.

### 4.3 Stable account identity-control mutex

Mỗi canonical account phải có đúng một server-side control row tồn tại **trước** khi account được phép tạo intent hoặc mutate identity:

```text
account_identity_control
canonical_user_id
identity_control_version
active_provider_link_count
security_version
session_version
updated_at
```

```text
ACCOUNT_IDENTITY_MUTATION_LOCK_TARGET: ACCOUNT_IDENTITY_CONTROL_ROW
ACCOUNT_IDENTITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
```

Missing hoặc duplicate control row đều fail closed. `active_provider_link_count` chỉ là integrity projection; nó không tự cấp authority và actual link rows vẫn phải được query/re-check dưới lock. Control version tăng sau mỗi committed identity mutation. Link-intent creation, callback commit, unlink, admin revoke, transfer hoặc identity-recovery operation đều phải khóa exact control row; operation tác động nhiều accounts khóa các control rows theo sorted `canonical_user_id`.

Control row không chứa token, raw email, nonce, verifier hoặc provider payload. Empty identity-link row set không thể làm mutex vì row cần khóa chưa tồn tại.

### 4.4 Stable provider-subject mutex/reservation

Sau cryptographic validation, khi server đã có normalized tuple `provider + provider_issuer + provider_subject`, mọi ownership check/mutation phải tranh cùng stable subject-scoped mutex:

```text
provider_subject_mutex_key =
  versioned_digest(environment_namespace, provider, normalized_issuer, provider_subject)
```

```text
PROVIDER_SUBJECT_MUTATION_LOCK_TARGET: STABLE_PROVIDER_SUBJECT_MUTEX
PROVIDER_SUBJECT_UNIQUE_INDEX_IS_ONLY_BACKSTOP: YES
```

Implementation sau có thể dùng transaction-scoped advisory lock với collision-safe namespace hoặc stable subject registry/reservation row, nhưng cần SQL/security review riêng. Mutex phải scoped exact environment; raw subject không được log. Hash collision chỉ được gây extra serialization, không được đổi ownership. Missing mutex service hoặc lock timeout fail closed. Database unique invariant vẫn bắt buộc làm integrity backstop, nhưng không thay stable serialization.

## 5. Identity-link lifecycle

Chỉ `LINKED`, cùng account lifecycle eligible, link version hiện hành và policy assurance đạt yêu cầu mới có authentication authority. Provider authentication/token riêng lẻ không tạo iChess authority.

| State | Authority | Actor và transition hợp lệ | Expiry/retry/terminal | Audit event | Session impact |
|---|---|---|---|---|---|
| `UNLINKED` | Không | System khởi tạo hoặc kết thúc inventory không có active link; user eligible có thể bắt đầu ceremony mới. | Không expiry; retry bằng intent mới; không terminal. | Inventory/security read chỉ khi cần. | Không provider session nào được issue. |
| `LINK_INTENT_CREATED` | Không | Server tạo sau canonical login + fresh re-auth; bind account/session/provider/version. | TTL 5 phút; không gia hạn; retry tạo intent mới; không terminal. | `identity.link_intent_created` | Không issue/upgrade session. |
| `AUTHORIZATION_PENDING` | Không | Server phát exact authorization request; provider chỉ trả callback vào allowlist. | Theo TTL intent; một redirect attempt; retry bằng intent mới. | `identity.link_started` | Session gốc chưa được nâng authority. |
| `CALLBACK_RECEIVED` | Không | Callback server nhận opaque state/code và khóa intent exact-match. | Transient; replay bị deny; không phải terminal. | Correlation vào success/failure event, không log payload. | Không issue session trước validation. |
| `VERIFICATION_PENDING` | Không | Server kiểm token response, issuer, audience, time, nonce, PKCE, versions và uniqueness. | Phải hoàn tất trong intent TTL; failure terminalize attempt; retry từ intent mới. | `identity.link_failed` nếu fail. | Không partial session/link. |
| `LINKED` | Có điều kiện | Transaction server consume intent + tạo link + audit/outbox. | Active đến revoke/unlink/policy block; login có thể retry có rate limit; không terminal. | `identity.link_succeeded` | Provider login có thể issue canonical session sau mọi guard. |
| `CONFLICT` | Không | Server phát hiện uniqueness/count/version/tenant/security conflict; central protected operator mới được xử lý. | Attempt terminal; ceremony mới sau resolution; không client retry loop. | `identity.link_conflict` | Không issue session; review/invalidate nếu compromise. |
| `REAUTH_REQUIRED` | Không | Server từ chối khi primary re-auth quá 5 phút, assurance thiếu hoặc session binding đổi. | Attempt không tiếp tục; re-auth rồi tạo intent mới; không terminal account. | `identity.link_failed` với safe reason. | Session hiện tại không được coi là step-up. |
| `EXPIRED` | Không | Server terminalize intent hết TTL hoặc callback matching không còn hợp lệ. | Terminal cho intent; intent mới bắt buộc. | `identity.link_failed` | Không session/link; refresh callback vẫn deny. |
| `REVOKED` | Không | Security/provider/lifecycle policy revoke link bằng protected server operation. | Terminal cho link version; relink cần ceremony/review mới. | `identity.admin_revoked` | Invalidate provider-linked; all nếu privileged/compromise. |
| `UNLINKED_BY_USER` | Không | Canonical user eligible + fresh re-auth + assurance + last-method guard. | Terminal cho link version; link lại qua ceremony mới. | `identity.unlink_succeeded` | Invalidate provider-linked sessions; bump version theo policy. |
| `UNLINKED_BY_ADMIN` | Không | Central protected operator, exact target/reason/approval; Center Admin không có authority. | Terminal cho link version; recovery/relink riêng. | `identity.admin_revoked` | Provider-linked sessions bị invalidate; privileged/compromise là all sessions. |

## 6. Fresh re-auth và step-up trước link

User phải đang đăng nhập canonical account hiện có, account lifecycle eligible, hoàn thành primary re-auth mới, và hoàn thành MFA/step-up nếu policy áp dụng trước khi server tạo intent.

```text
IDENTITY_LINK_REAUTH_MAX_AGE_MINUTES: 5
IDENTITY_LINK_REAUTH_SERVER_DERIVED: YES
IDENTITY_LINK_UI_BADGE_IS_AUTHORITY: NO
```

Server bind assertion re-auth với exact account, session, action và thời điểm server. Không dùng browser clock, localStorage, UI state, session tồn tại lâu ngày hoặc provider login ở tab khác. Với privileged account, MFA trước link/unlink là bắt buộc theo contract F23.13C; role khác chờ risk policy F23.13C.

## 7. One-time link intent

Server-side intent record và versioned ceremony envelope:

```text
link_intent_id
ceremony_contract_version
environment_fingerprint
provider
provider_issuer
provider_client_config_version
redirect_policy_version
workspace_policy_version
canonical_user_id
logical_security_session_id
account_security_version_at_creation
session_version_at_creation
identity_control_version_at_creation
exact_redirect_uri
requested_scope_set
prompt_policy_version
state_digest
nonce_digest
pkce_challenge
pkce_method
created_at
expires_at
consumed_at
intent_version
request_id
idempotency_key
```

```text
LINK_INTENT_SINGLE_USE: YES
LINK_INTENT_SERVER_STORED: YES
LINK_INTENT_CLIENT_IS_AUTHORITY: NO
LINK_INTENT_DEFAULT_TTL_MINUTES: 5
ONE_LIVE_LINK_INTENT_PER_ACCOUNT_PROVIDER: YES
UNDEFINED_ACCOUNT_VERSION_FIELD_ALLOWED: NO
LINK_INTENT_BINDS_ACCOUNT_SECURITY_VERSION: YES
LINK_INTENT_BINDS_SESSION_VERSION: YES
LINK_INTENT_BINDS_IDENTITY_CONTROL_VERSION: YES
LINK_CEREMONY_BINDS_ENVIRONMENT_FINGERPRINT: YES
LINK_CEREMONY_BINDS_PROVIDER_CONFIG_VERSION: YES
LINK_CEREMONY_BINDS_REDIRECT_POLICY_VERSION: YES
LINK_CEREMONY_BINDS_WORKSPACE_POLICY_VERSION: YES
LINK_CEREMONY_BINDS_LOGICAL_SECURITY_SESSION: YES
WORKSPACE_POLICY_VERSION_NULL_IS_WILDCARD: NO
```

Intent bind exact canonical account, stable logical security session, provider/issuer, redirect URI, environment fingerprint và security/session/control/config/policy versions; không thể đổi target sau khi tạo. `logical_security_session_id` là server-side identity ổn định qua access-token refresh, không phải raw JWT/token ID. `workspace_policy_version = null` chỉ biểu diễn exact policy state `G3_OFF`; nó không phải wildcard và callback phải deny nếu G3 state/version đổi.

Envelope không chứa raw email, raw provider subject trước verified callback, token, authorization code, PKCE verifier, raw nonce, client secret hoặc provider payload. Browser chỉ mang opaque state; internal intent data không được lưu localStorage/sessionStorage.

Server chỉ terminalize intent được xác định bằng matching state an toàn; state ngẫu nhiên không được phép consume intent khác. Với intent đã match nhưng validation fail, server consume/expire fail-closed để ngăn replay.

### 7.1 Link-intent creation concurrency

Creation transaction khóa `ACCOUNT_IDENTITY_CONTROL_ROW`, expire/cancel stale intent theo policy, re-check không có nonterminal live intent rồi tạo tối đa một live intent/account/provider và append audit/outbox atomic. Empty intent-row query không serialize được creation. Retry dùng cùng idempotency key trả exact existing safe outcome; không tạo ceremony thứ hai.

Link-intent creation lock order:

```text
ACCOUNT_IDENTITY_CONTROL_ROW
→ LINK_INTENT_ROWS
→ AUDIT_OUTBOX_ROWS
```

### 7.2 Canonical identity-mutation lock order

```text
IDENTITY_MUTATION_LOCK_ORDER_DEFINED: YES
PROVIDER_SUBJECT_MUTEX_PRECEDES_ACCOUNT_IDENTITY_MUTEX: YES
IDENTITY_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO
```

Canonical mutation lock order:

```text
0. STABLE_PROVIDER_SUBJECT_MUTEX, khi verified subject đã biết
1. ACCOUNT_IDENTITY_CONTROL_ROW, nhiều accounts theo sorted canonical_user_id
2. EXACT_LINK_INTENT_ROW
3. IDENTITY_LINK_ROWS, theo stable identity_link_id
4. SESSION_VERSION_ROWS
5. AUDIT_OUTBOX_ROWS
```

Callback/link/unlink/admin revoke đã biết subject phải lấy subject mutex trước account mutex; không được khóa account control rồi quay lại lấy subject mutex. Transfer/recovery nhiều account vẫn theo subject mutex trước, rồi account controls theo sorted canonical ID. Link-intent creation chưa biết subject dùng thứ tự riêng tại 7.1.

Không giữ database lock khi redirect user, gọi authorization endpoint, exchange token qua external network, chờ reviewer hoặc gửi notification. Provider exchange và cryptographic validation hoàn tất trước mutation transaction; kết quả validation phải short-lived, purpose-bound và được revalidate theo ceremony envelope trước commit.

## 8. Authorization request contract

Server chọn exact approved provider/issuer, environment-specific client configuration, redirect allowlist, state, nonce, PKCE S256, minimal authentication scopes và prompt semantics đã duyệt. Authorization request phải được tạo từ exact values/versions đã bind trong ceremony envelope; Workspace policy, nếu sau này bật, là server policy versioned riêng.

Browser không có authority cung cấp arbitrary redirect URI, provider, tenant, scopes, canonical user ID hoặc post-login destination. Calendar, Drive và Classroom scopes không được xin. Authentication-only không yêu cầu offline access.

## 9. Callback validation và safe terminalization

Callback phải kiểm đủ, theo server authority:

1. Link intent tồn tại và exact `environment_fingerprint` khớp.
2. Intent chưa consume.
3. Intent chưa hết TTL.
4. Exact canonical account và `logical_security_session_id` binding còn hợp lệ.
5. State khớp digest bằng constant-time comparison.
6. Nonce khớp expected digest.
7. PKCE method/challenge/verifier hợp lệ, không downgrade.
8. Exact issuer khớp approved provider metadata.
9. Audience/authorized party khớp approved client.
10. Chữ ký và approved key metadata hợp lệ.
11. Issued-at, not-before và expiry nằm trong policy clock skew.
12. Exact redirect URI và `redirect_policy_version` khớp intent/server allowlist.
13. Provider/class khớp intent.
14. `provider_client_config_version` và `prompt_policy_version` chưa drift.
15. Verified tenant và `workspace_policy_version` khớp, kể cả exact `G3_OFF` semantics.
16. Canonical account lifecycle vẫn eligible.
17. Account `security_version` khớp `account_security_version_at_creation`.
18. `session_version` và logical session vẫn khớp ceremony.
19. `identity_control_version` chưa đổi.
20. Provider subject tuple chưa link account khác dưới stable subject mutex.
21. Active link count/link rows không vượt policy dưới account control lock.
22. `ceremony_contract_version` vẫn được hỗ trợ.
23. Transactional audit/outbox dependency healthy.

Bất kỳ mismatch nào đều `deny / consume-or-expire intent safely`; không partial-link, không trả provider payload, raw provider error hoặc account existence cho browser.

### 9.1 Callback configuration drift

Callback deny nếu `environment_fingerprint`, provider client config, redirect policy, Workspace policy, account security, session hoặc identity-control version đã đổi. Không dùng current config khác với reviewed bound config để âm thầm hoàn tất ceremony cũ và không fallback theo visual environment label.

Config rotation chỉ có hai lựa chọn: giữ exact old verified config trong approved overlap window, hoặc expire intent và yêu cầu ceremony mới. Old config được giữ cho validation không có nghĩa là được cấp scope/redirect khác envelope.

## 10. Atomic link commit và concurrency

Sau provider validation, successful callback chỉ hoàn tất bằng transaction sau:

1. Acquire `STABLE_PROVIDER_SUBJECT_MUTEX` cho normalized environment/provider/issuer/subject tuple.
2. Acquire exact `ACCOUNT_IDENTITY_CONTROL_ROW`.
3. Lock exact link-intent row.
4. Re-check single-use, TTL, logical session và toàn bộ config/security/session/control versions.
5. Re-check actual active link rows và count projection dưới account lock.
6. Re-check subject ownership dưới subject mutex.
7. Create exact identity link.
8. Consume exact intent.
9. Increment `identity_control_version` và `security_version` khi policy yêu cầu.
10. Update `active_provider_link_count` projection.
11. Append immutable audit hoặc transactional outbox.
12. Commit atomic.

Failure ở bất kỳ bước nào là `rollback / deny`. Không được tồn tại link committed without consumed intent; control count/version changed without link; intent consumed without link/audit; hoặc subject ownership without account control update. Unique constraint/index chỉ là integrity backstop, không phải mutex và không thay stable locks.

Provider exchange/validation không tự cấp app authority. Canonical session chỉ được issue sau commit thành công và post-commit lifecycle/version checks. Nếu session issuance lỗi, link có thể đã hoàn tất có audit nhưng login fail an toàn; retry phải đi qua linked-login flow, không replay callback.

### 10.1 Same-account, different-subject race

```text
CONCURRENT_DIFFERENT_SUBJECT_LINKS_ON_ONE_ACCOUNT_CAN_BOTH_COMMIT: NO
```

Hai callbacks cùng canonical account nhưng hai subjects khác nhau mỗi callback lấy subject mutex riêng, rồi cùng tranh một stable account identity-control row. Transaction thắng re-check count/link rows bằng 0 và commit; control version/count đổi. Transaction sau re-read dưới lock, thấy active Google identity và trả safe `account_already_has_google_identity`. Không có success audit/link thứ hai. Empty link-row set ban đầu không tham gia serialization.

### 10.2 Same-subject, cross-account race

```text
CONCURRENT_SAME_SUBJECT_LINKS_ON_TWO_ACCOUNTS_CAN_BOTH_COMMIT: NO
```

Hai accounts cùng subject tranh đúng một normalized provider-subject mutex. Transaction thắng mới khóa account control và commit ownership. Transaction sau re-read ownership dưới cùng subject mutex rồi chuyển `CONFLICT`; không lộ owner, transfer/email-match hoặc duplicate success audit. Account locks vẫn bắt buộc; database uniqueness chỉ chặn corruption nếu service contract có defect.

## 11. Login bằng linked Google identity

Flow mục tiêu sau khi implementation blockers được gỡ:

1. Provider authentication thành công với state/nonce/PKCE và exact environment config.
2. Server validate issuer, audience, signature, authorized party và time.
3. Server lấy exact immutable provider subject.
4. Server tìm active link bằng `provider + issuer + subject`.
5. Không có link thì trả safe `identity_link_required`.
6. Re-check account lifecycle, security/recovery lock và versions.
7. Re-check required MFA/assurance.
8. Issue/bind app session cho exact `canonical_user_id`.
9. Audit outcome.
10. Bootstrap center chỉ từ active memberships hiện có, theo request context được phép.

```text
UNLINKED_GOOGLE_IDENTITY_CAN_SIGN_IN: NO
GOOGLE_LOGIN_CREATES_CENTER_MEMBERSHIP: NO
GOOGLE_LOGIN_ASSIGNES_ROLE: NO
GOOGLE_LOGIN_BYPASSES_ACCOUNT_LIFECYCLE: NO
```

Bare OAuth flow có khả năng auto-create unmanaged Auth user phải bị cấm. Provider authentication thành công không đồng nghĩa iChess authentication thành công. Google claim không chọn center, role, membership hoặc khôi phục lifecycle.

## 12. Unknown identity, anti-enumeration và safe UX

Unlinked/unknown provider subject không auto-create, auto-link hoặc lộ account/email nào tồn tại. UI chỉ có thể nói identity chưa sẵn sàng cho đăng nhập và hướng user đăng nhập bằng phương thức iChess hiện có để chủ động link.

Recommended outward code:

```text
identity_link_required
```

Response body, status class và timing phải tương đương giữa unknown subject, unavailable link và policy deny ở mức có thể; diagnostics chi tiết chỉ ở protected audit.

## 13. Conflict resolution

Conflict canonical:

```text
provider_subject_already_linked_elsewhere
account_already_has_google_identity
link_intent_security_state_changed
provider_issuer_mismatch
workspace_policy_mismatch
identity_under_security_review
```

Không giải quyết conflict bằng email match, Center Admin override, tự unlink account khác, đổi subject, client retry vô hạn hoặc tạo account mới. Central Security/Platform identity operation phải xác minh exact targets, control của canonical account, provenance, lifecycle và session risk. Privileged conflict cần two-person review.

Transfer tự động bị cấm. Nếu approval tương lai cho transfer, thao tác phải revoke link cũ, invalidate session, audit/cooldown/review rồi thực hiện ceremony link mới; không update trực tiếp ownership của subject.

## 14. Provider email/subject change

Subject giữ nguyên nhưng provider email đổi: link vẫn bind subject; email evidence chỉ cập nhật sau verified login, không reassign canonical account, không cấp quyền mới. Privileged account hoặc Workspace policy phải trigger security review/re-evaluation và có thể deny login đến khi policy đạt.

Subject đổi: coi là identity khác, không auto-migrate; cần link ceremony mới hoặc protected identity recovery.

```text
PROVIDER_EMAIL_CHANGE_REASSIGNS_ACCOUNT: NO
PROVIDER_SUBJECT_CHANGE_AUTO_MIGRATION_ALLOWED: NO
```

## 15. Google Workspace restriction

G3 mặc định OFF đến khi có approved tenant inventory. Nếu bật sau này, server dùng verified issuer/tenant claims và exact environment policy version; domain suffix chỉ là evidence, không phải tenant proof. Tenant allowlist server-side không thay prerequisite account đã provision.

Policy đổi giữa authorization/callback làm callback fail; policy đổi sau link yêu cầu review session/link. Không hardcode domain hoặc email trong frontend hay function source.

## 16. Unlink và admin revoke

User unlink phải có canonical session, account eligible, fresh re-auth, MFA/step-up nếu yêu cầu, exact link ID/version, và server-confirmed inventory còn ít nhất một verified login/recovery method. Operation terminalize link, revoke provider credential nếu có, bump security/session versions theo policy, invalidate provider-linked sessions và audit atomic.

```text
LAST_LOGIN_METHOD_UNLINK_ALLOWED: NO
UNLINK_REQUIRES_FRESH_REAUTH: YES
UNLINK_INVALIDATES_PROVIDER_SESSIONS: YES
```

Unlink/admin revoke transaction bắt buộc:

1. Acquire exact provider-subject mutex.
2. Acquire exact account identity-control row.
3. Lock exact identity-link row.
4. Re-check link/control/security versions.
5. Re-check last-login/recovery invariant.
6. Block local link authority.
7. Increment identity-control/security/session versions.
8. Update active-link count projection.
9. Create session-invalidation outbox event.
10. Append security audit/outbox.
11. Commit atomic.

Provider-side token revocation là external side effect qua protected outbox/retry sau commit; không giữ database locks qua network call. Local canonical authority bị chặn bởi committed link/version state và không chờ provider token expiry.

Unlink fail closed khi password không hợp lệ/không còn recovery, account recovery-locked, factor reset chưa hoàn tất, lifecycle/invalidation/audit dependency lỗi. Provider revoke thất bại phải được ghi protected retry state; canonical link bị chặn authority ngay khi local revoke commit an toàn, không chờ provider token hết hạn.

Admin unlink/revoke chỉ dành cho central protected Security/Platform identity operator, exact target/reason, step-up, immutable audit và additional approval cho Owner/Platform Owner. Center Admin không có account-wide authority. Admin revoke không đổi password, không gắn provider mới và không khôi phục membership.

## 17. Password login và account lifecycle semantics

```text
EMAIL_PASSWORD_LOGIN_REMAINS_AVAILABLE: YES
USERNAME_LOGIN_IMPLEMENTED_BY_F23_13B: NO
GOOGLE_ONLY_ACCOUNT_ALLOWED_INITIAL_ROLLOUT: NO
```

Email/password hiện tại vẫn là login method bắt buộc trong rollout đầu. Tài liệu/UI gọi “Email / Tài khoản” không làm username thành implemented; username resolver là phase riêng. Provider email không thay canonical login/contact email; đổi contact email không relink Google; reset password không auto-unlink provider.

Canonical lifecycle precedence áp dụng giống nhau cho password và Google: disabled, banned, revoked, security-locked hoặc trạng thái không eligible không được login/link/recover. Membership revoke/restore không thay account-wide identity hoặc lifecycle. Center membership chỉ quyết định center scope sau account authentication, không phải đường vòng cấp account authority.

## 18. Password recovery semantics

F23.13B không triển khai recovery UI/runtime. Contract tương lai:

- Request opaque, rate limit riêng và outward anti-enumeration.
- Server bind exact canonical account và verified recovery method; provider email không tự trở thành recovery contact.
- Mọi request trả outward `password_recovery_request_accepted` khi có thể, bất kể identifier có tồn tại.
- Không gửi/hiển thị password hiện tại.
- Completion kiểm one-time proof, TTL, purpose, account lifecycle, security versions và audit dependency.
- Success tăng security/session version, revoke stale step-up và invalidate sessions theo risk policy.
- Disabled/banned/security-locked fail closed; privileged account dùng stronger protected flow.

Password reset không link/unlink Google, không reset MFA, không restore membership/account, không tạo identity. Password compromise phải trigger link/session review theo risk.

## 19. Ba loại recovery độc lập

| Recovery | Mục tiêu | Không có authority làm gì |
|---|---|---|
| Password recovery | Khôi phục password credential canonical. | Không relink/transfer Google, reset MFA hoặc restore lifecycle/membership. |
| Identity-link recovery | Giải quyết mất/conflict provider identity qua protected proof/review. | Không đổi password, reset MFA hoặc tự tạo account. |
| MFA recovery | Khôi phục quyền sử dụng factor theo F23.13C. | Không đổi password, link Google hoặc restore membership. |

```text
PASSWORD_RECOVERY_RELINKS_GOOGLE: NO
GOOGLE_IDENTITY_RECOVERY_RESETS_MFA: NO
MFA_RECOVERY_RESETS_PASSWORD: NO
MEMBERSHIP_RESTORE_RESTORES_ACCOUNT_IDENTITY: NO
```

Ba flow không thay thế, compose ngầm hoặc dùng proof của nhau. Mỗi flow có purpose-bound token, rate limit, assurance, audit và session policy riêng.

## 20. Session issuance và invalidation

Conceptual session evidence:

```text
canonical_user_id
account_lifecycle_status
account_security_version
session_version
identity_link_id
identity_link_version
authentication_method
assurance_level
issued_at
last_reauth_at
```

Protected server action re-check canonical account/lifecycle, versions, membership/capability và step-up; client session/UI không phải authority. Push/realtime chỉ cải thiện UX. Old token/session không thắng lifecycle hoặc version.

| Event | Required action |
|---|---|
| User unlink | Invalidate sessions authenticated/bound qua exact link; bump version theo policy. |
| Admin revoke/provider compromise | Block link immediately; all sessions cho privileged/compromise, otherwise risk-selected minimum provider-linked. |
| Password reset | Revoke stale step-up; all sessions mặc định cho privileged/compromise, risk-selected cho standard account. |
| MFA reset | Theo F23.13C; privileged/compromise all sessions. |
| Disable/ban/security lock | Account-wide deny và invalidate/reject all sessions. |
| Identity conflict/security-version bump | Deny new issuance; invalidate/review impacted sessions. |
| Privileged role escalation/contact compromise | Require new assurance và risk-based invalidation/review. |

Nếu invalidation service lỗi sau unlink/revoke, operation không được báo success hoàn chỉnh hoặc để link tiếp tục authority. Phải fail closed, protected retry/incident và audit; implementation cần transaction/outbox/idempotency cho distributed revocation.

## 21. Redirect, navigation và token boundary

Post-login/link destination chỉ là internal route allowlisted server-side. Absolute URL từ query, state, callback payload hoặc browser storage bị từ chối. Sau callback, transient OAuth/link data bị clear; code/token không đi vào app route; browser Back/Forward, refresh hoặc callback replay không consume intent lần hai. Browser nhận server-issued opaque outcome reference.

Không lưu provider access token, refresh token, ID token, authorization code, PKCE verifier, raw nonce hoặc provider payload trong localStorage/sessionStorage. Không log raw token/claim bundle. Nếu token tạm thời cần exchange, nó chỉ ở protected server boundary với retention tối thiểu.

```text
APPLICATION_PROVIDER_REFRESH_TOKEN_REQUIRED: NO
ARBITRARY_POST_AUTH_REDIRECT_ALLOWED: NO
OAUTH_TRANSIENT_DATA_BROWSER_STORAGE_ALLOWED: NO
```

Use case Google API tương lai phải có phase consent/scope/storage/revocation riêng.

## 22. Audit, rate limit và safe errors

### 22.1 Minimal audit events

```text
identity.link_intent_created
identity.link_started
identity.link_succeeded
identity.link_failed
identity.link_conflict
identity.login_succeeded
identity.login_failed
identity.unlink_requested
identity.unlink_succeeded
identity.unlink_failed
identity.admin_revoked
identity.provider_email_evidence_changed
identity.session_invalidated
password.recovery_requested
password.recovery_completed
password.recovery_failed
```

Audit chỉ chứa opaque actor/target IDs, provider class, action, safe reason/outcome, request/correlation IDs, versions, timestamp và masked environment metadata. Không chứa token, authorization code, raw nonce, verifier, raw email hoặc provider payload. Link/unlink/revoke commit phụ thuộc immutable audit hoặc transactional outbox healthy.

### 22.2 Rate limiting

Các bucket độc lập: login start, callback validation, link-intent creation, link callback, conflict attempts, unlink, password-recovery request và completion. Signals có thể gồm account/session, IP/network, device/risk, provider-subject digest và environment; không dùng IP đơn lẻ làm identity.

Repeated failure có thể cooldown, step-up, risk review, notification hoặc temporary lock. Threshold/rule cụ thể không công khai cho attacker; outward errors vẫn an toàn và không enumeration.

### 22.3 Safe error contract

```text
identity_link_not_available
identity_link_required
identity_link_reauth_required
identity_link_intent_expired
identity_link_intent_invalid
identity_link_conflict
identity_already_linked
identity_provider_mismatch
identity_workspace_policy_denied
identity_callback_invalid
identity_login_denied
identity_unlink_not_safe
identity_unlink_reauth_required
account_lifecycle_blocked
account_recovery_required
password_recovery_not_available
password_recovery_request_accepted
security_service_unavailable
rate_limit_exceeded
```

Enumeration-sensitive cases dùng outward response tương đương. Browser không nhận account existence/target, raw provider error, lifecycle detail, token, stack, persistence detail hoặc provider payload.

## 23. Concurrency, replay và negative matrix

| Case | Scenario | Expected fail-closed outcome |
|---|---|---|
| B-N1 | Hai callback dùng cùng link intent. | Lock/compare consumed version; chỉ một commit, callback còn lại `identity_link_intent_invalid`, không link/audit kép. |
| B-N2 | Callback tới sau intent expiry. | Deny, terminalize `EXPIRED`, không exchange/commit/session; ceremony mới bắt buộc. |
| B-N3 | Callback sau account security version thay đổi. | Deny version mismatch, consume/expire attempt, review session; không link bằng proof cũ. |
| B-N4 | Provider subject đã link account khác. | `CONFLICT`, không lộ target, không transfer/email-match; central review. |
| B-N5 | Hai link intents/callbacks cùng account/provider. | Creation tranh account control: một live intent/idempotent outcome. Callback tranh subject rồi account lock: một commit; intent còn lại conflict/expired. Không dựa empty intent/link rows. |
| B-N6 | Hai accounts đồng thời link cùng provider subject. | Cùng stable subject mutex serialize ownership; một winner, bên kia safe `CONFLICT`/rollback. Unique invariant chỉ là backstop. |
| B-N7 | User unlink trong lúc Google login đang tạo session. | Link/version re-check trước issue; unlink thắng làm login deny hoặc session lập tức invalidated. |
| B-N8 | Admin revoke và user login đồng thời. | Revoke/version/lifecycle guard thắng; không session mới sống qua revoke. |
| B-N9 | Password reset và Google login đồng thời. | Security/session version mismatch deny issuance hoặc invalidate session vừa tạo; recovery không relink. |
| B-N10 | Provider email đổi sau link. | Link vẫn subject-bound; update protected evidence/review, không reassign/quyền mới. |
| B-N11 | Provider subject đổi. | Treat unknown identity; `identity_link_required`, không auto-migrate. |
| B-N12 | Workspace policy đổi giữa authorization và callback. | Policy-version/tenant validation deny, intent terminalized an toàn, không partial-link. |
| B-N13 | Callback replay ở environment khác. | Environment/client/redirect/state binding mismatch; deny không ảnh hưởng intent hợp lệ ở environment gốc. |
| B-N14 | Redirect URI bị thay. | Exact intent + allowlist mismatch; deny và không redirect tùy ý. |
| B-N15 | Browser refresh callback. | Consumed/single-use check deny; không exchange/commit lần hai. |
| B-N16 | Unlink phương thức login cuối cùng. | `identity_unlink_not_safe`; giữ link, không session-version mutation nửa vời. |
| B-N17 | Disabled account có provider session hợp lệ. | Canonical lifecycle deny protected action/login; invalidate/reject old session. |
| B-N18 | Recovery request dùng email không tồn tại. | Cùng outward accepted response/timing class; không gửi proof, protected rate-limit/audit. |
| B-N19 | Identity conflict bị Center Admin cố xử lý. | Authorization deny; no target disclosure/mutation; audit unauthorized attempt. |
| B-N20 | Provider token bị gửi về localStorage. | Security contract/test fail; flow không hoàn tất, token exposure incident/revocation path. |
| B-N21 | Audit insert lỗi sau link mutation. | Atomic rollback/deny hoặc outbox transaction rollback; không unaudited link. |
| B-N22 | Session invalidation lỗi sau unlink/revoke. | Không báo success hoàn chỉnh; authority blocked bằng version, protected retry/incident, fail closed. |
| B-N23 | Hai callbacks cùng account nhưng hai subjects khác nhau. | Hai subject locks riêng rồi cùng account control lock; chỉ một active link/success audit, callback sau `account_already_has_google_identity`. |
| B-N24 | Account identity-control row bị thiếu. | Fail closed trước intent/mutation; không fallback sang empty link-set hoặc tự tạo ngầm trong callback. |
| B-N25 | Có duplicate account identity-control row. | Fail closed/integrity incident; không chọn ngẫu nhiên một row hoặc tiếp tục mutation. |
| B-N26 | Provider-subject mutex unavailable/timeout. | `security_service_unavailable`/safe retry; rollback toàn unit, không ownership/link/session. |
| B-N27 | Identity-control version đổi sau intent creation. | Callback deny `link_intent_security_state_changed`, consume/expire an toàn; ceremony mới. |
| B-N28 | Provider client config version đổi trước callback. | Chỉ exact approved overlap config được validate; nếu không, expire/deny và tạo ceremony mới. |
| B-N29 | Redirect policy version đổi trước callback. | Deny exact policy mismatch; không dùng current redirect fallback hoặc arbitrary destination. |
| B-N30 | Workspace policy version đổi trước callback. | Deny kể cả chuyển giữa exact `G3_OFF` null semantics và enabled policy; không silent completion. |
| B-N31 | Access token refresh nhưng logical security session còn đúng. | Không fail chỉ vì raw token đổi; tiếp tục chỉ khi logical session và security/session/control versions đều khớp. |
| B-N32 | Intent dùng undefined/stale account-version vocabulary. | Reject malformed/legacy envelope; không alias/fallback mơ hồ, không commit hoặc session issue. |

## 24. Threat model

| Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| B-T1 Email auto-link takeover | High nếu shortcut | Critical | Cấm email auto-link; subject tuple + explicit ceremony | Support social engineering | F23.13B runtime |
| B-T2 Provider subject collision | Low/Medium | Critical | Stable subject mutex, account lock, issuer+subject unique backstop | Provider metadata/mutex defect | F23.13B runtime |
| B-T3 OAuth state replay | Medium | High | Server digest, TTL, single-use, session/environment bind | Storage/race defect | F23.13B runtime/tests |
| B-T4 Nonce replay | Medium | High | Exact nonce validation, one-time intent | Provider/library flaw | F23.13B runtime/tests |
| B-T5 PKCE downgrade/bypass | Medium | High | S256 only, exact challenge, no client authority | Misconfiguration | F23.13B runtime/tests |
| B-T6 Issuer mix-up | Low/Medium | Critical | Exact approved issuer discovery/config validation | Metadata compromise | F23.13B runtime |
| B-T7 Audience/client mismatch | Medium | Critical | Exact audience/authorized-party/environment client | Multi-client config drift | F23.13B runtime |
| B-T8 Open redirect | Medium | High | Exact server redirect allowlist/internal destination | Allowlist governance error | F23.13B runtime/tests |
| B-T9 Callback replay | High without guard | High | Consume once, locking/version, opaque outcome | Distributed retry race | F23.13B runtime/tests |
| B-T10 Link CSRF | Medium | Critical | Existing account login, fresh re-auth, state/session/account bind | Compromised browser session | F23.13B + F23.13C |
| B-T11 Compromised session links attacker identity | Medium | Critical | Re-auth ≤5m, privileged MFA, notification/audit | Primary credential compromise | F23.13B/C |
| B-T12 Provider token browser leakage | Medium | Critical | Server boundary, no browser storage/log, minimal retention | Browser extension/network defect | F23.13B runtime |
| B-T13 Account enumeration | High | Medium/High | Uniform outward responses, opaque IDs, rate limits | Timing/side-channel drift | F23.13B runtime/tests |
| B-T14 Unlinked identity auto-provision | High with bare OAuth | Critical | G2 only; mapping required before canonical session | Provider SDK default regression | F23.13B runtime |
| B-T15 Disabled account logs in via Google | Medium | Critical | Canonical lifecycle/version re-check before issue/action | Invalidation latency | Lifecycle prerequisite |
| B-T16 Provider email change reassigns account | Medium | Critical | Subject-bound mapping; evidence-only email | Support override abuse | F23.13B runtime |
| B-T17 Unlink last login method | Medium | High | Server method inventory + recovery guard | Stale inventory | F23.13B/C |
| B-T18 Password reset leaves old sessions | Medium | Critical | Security/session bump, risk/all-session invalidation | Distributed propagation delay | Lifecycle/invalidation prerequisite |
| B-T19 Identity revoke leaves active sessions | Medium | Critical | Link/session versions + revoke outbox | Partial outage | Invalidation prerequisite |
| B-T20 Domain suffix trusted as tenant | Medium | High | Verified tenant claim/allowlist; G3 off by default | Tenant policy drift | Later approved G3 phase |
| B-T21 Center Admin resolves conflict | Medium | Critical | Central account-wide authority; two-person privileged review | Operator collusion | Protected ops phase |
| B-T22 Cross-environment callback replay | Medium | High | Bind environment fingerprint, client/redirect/policy versions, issuer và state | Incorrect version inventory | F23.13B runtime/tests |
| B-T23 Audit failure creates unaudited link | Low/Medium | High | Atomic audit/outbox dependency, rollback | Outbox processor outage | Audit prerequisite |
| B-T24 Race links subject to two accounts | Medium | Critical | Stable subject mutex → account lock + unique tuple backstop | Mutex namespace/persistence defect | Identity concurrency tests |
| B-T25 Recovery silently links identity | Medium | Critical | Purpose separation and token audience; explicit ceremony only | Shared handler regression | F23.13B/C tests |
| B-T26 Bare OAuth creates unmanaged account | High if provider default | Critical | No provider enablement until deny-before-issuance mapping service | Remote config drift | Production gate B-AG20 |
| B-T27 Same-account different-subject race | Medium | Critical | Stable account identity-control mutex + active-account/provider invariant | Service path bỏ qua mutex | Identity concurrency tests |
| B-T28 Same-subject cross-account race | Medium | Critical | Stable subject mutex + account lock + unique backstop | Mutex namespacing/config defect | Identity concurrency tests |
| B-T29 Ceremony configuration drift | Medium | High/Critical | Bind environment/provider/redirect/Workspace policy versions; expire hoặc approved overlap | Incorrect version inventory | Callback/config tests |
| B-T30 Undefined version semantics | Medium | High | Canonical security/session/control vocabulary; reject legacy envelope | Legacy service/schema mismatch | Schema/service contract tests |

## 25. Approval gates B-AG1–B-AG20

| Gate | Recommended default | Lý do | Rủi ro cần chấp nhận/giảm | Approver | Implementation phase |
|---|---|---|---|---|---|
| B-AG1 Có chọn G2 rollout đầu? | G2 — link account hiện có | Giữ canonical provisioning/lifecycle | Bare sign-in tạo unmanaged account | Product + Security + Architecture | Trước F23.13B runtime |
| B-AG2 Giữ email-password bắt buộc? | YES trong rollout đầu | Có verified fallback/recovery method | Credential retirement quá sớm gây lockout | Product + Security | B runtime/recovery |
| B-AG3 Tối đa bao nhiêu Google identities/account? | 1 active identity | Giảm conflict/recovery ambiguity | Nhu cầu nhiều identity chưa hỗ trợ | Product + Security | B runtime |
| B-AG4 Cho identity chuyển account? | NO automatic transfer | Chặn account takeover | Protected transfer tốn vận hành | Security | Protected ops tương lai |
| B-AG5 Link intent TTL? | 5 minutes | Giảm replay window | UX retry khi hết hạn | Security + Product | B runtime |
| B-AG6 Re-auth freshness? | 5 minutes | Giảm session riding | Friction cho user | Security + Product | B/C runtime |
| B-AG7 MFA trước link/unlink? | Bắt buộc privileged; role khác theo F23.13C | Risk-based assurance | Policy chưa có runtime | Security | F23.13C prerequisite |
| B-AG8 Ai duyệt callback/redirect allowlist? | Security + Architecture | Environment boundary tập trung | Config drift/open redirect | Security + Architecture | Pre-production inventory |
| B-AG9 Bật Workspace tenant restriction? | OFF đến approved tenant inventory | Không tin domain suffix | Chưa enforce tenant business policy | Security + Business Owner | G3 phase riêng |
| B-AG10 Google scopes? | Authentication identity scopes tối thiểu | Data minimization | Thiếu scope cho use case ngoài auth | Security + Privacy | B runtime |
| B-AG11 Lưu provider refresh token? | NO cho authentication-only | Không cần credential dài hạn | Không gọi Google API nền | Security + Architecture | B runtime |
| B-AG12 UX cho unlinked identity? | Safe `identity_link_required` | Không enumeration | User cần quay lại password login | Product + Security | B runtime/UI |
| B-AG13 Ai xử lý conflict? | Central Security/Platform identity operations | Account-wide authority | Queue/support latency | Security + Platform Ops | Protected ops |
| B-AG14 Admin nào được unlink? | Central protected operator; Center Admin NO | Chặn center-scoped takeover | Phụ thuộc central ops | Security + Executive | Protected ops |
| B-AG15 Unlink revoke session nào? | Provider-linked; all nếu privileged/compromise | Loại stale credential theo risk | Propagation/invalidation cost | Security + SRE | Invalidation prerequisite |
| B-AG16 Password reset revoke session nào? | All mặc định cho privileged/compromise; risk-selected standard | Chặn old-session persistence | User phải login lại | Security + SRE | Recovery prerequisite |
| B-AG17 Notification link/unlink/login mới? | YES, không secret | Detect unauthorized action | Notification fatigue | Security + Product | B runtime |
| B-AG18 Email provider đổi trigger review? | YES nếu privileged hoặc Workspace policy | Re-evaluate evidence/tenant | False positive | Security + Business Owner | B/G3 runtime |
| B-AG19 Rate limit/cooldown? | Risk-tiered, threshold không công khai | Chống abuse không tạo oracle | Tuning/false positives | Security + SRE | Shared security prerequisite |
| B-AG20 Khi nào mở Google Sign-In production? | Chỉ sau B/C design PASS, verified remote Auth truth, lifecycle và invalidation service | Deny-before-session phải tồn tại | Rollout chậm nhưng tránh unmanaged identity | Security + Architecture + Product | Production release gate |

Các default này là recommendation thiết kế, không cho phép provider/runtime implementation.

## 26. Implementation blockers và readiness

F23.13B implementation tiếp tục bị chặn bởi:

- Canonical account lifecycle và account-wide disable/ban/security lock.
- Session invalidation và version enforcement.
- Safe self-service password recovery.
- Server-derived re-auth/step-up và F23.13C MFA contract.
- Verified remote provider/Auth truth, approved client/redirect/environment inventory.
- Identity-link storage và one-time intent store.
- Exactly-one pre-existing account identity-control row/account và stable provider-subject mutex service.
- Canonical lock-order enforcement, timeout/failure handling và identity concurrency tests.
- Versioned environment/provider/redirect/Workspace policy inventory cho ceremony envelope.
- Atomic audit/transactional outbox và provider-subject uniqueness.
- Rate-limit/risk service.
- Protected conflict-resolution/admin-revoke operation.
- Safe notification, fixtures, negative/concurrency/integration tests.
- Guard bảo đảm provider auth không auto-provision trước canonical mapping.

```text
F23_13B_IMPLEMENTATION_READINESS: BLOCKED
F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13_AUTH_CONFIGURATION_CHANGE: NO
F23_13_SUPABASE_ACTION: NOT RUN
```

Nếu implementation cần thao tác provider/Auth/Supabase hoặc tài khoản thật trước khi các gate được duyệt, kết luận là `NEEDS REVIEW`.

## 27. Roadmap sau F23.13B

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

- F23.13A final audit đã sync `PASS` và stale final line đã thay.
- Repo truth, G2, canonical model, subject uniqueness và email-evidence boundary đã chốt.
- Lifecycle, re-auth, versioned ceremony envelope, stable mutex/lock order, callback, atomic commit, linked login, conflict và unlink đã có fail-closed contract.
- Password/identity/MFA recovery tách biệt; lifecycle/membership không bị Google vượt qua.
- Session, redirect, token, audit, rate-limit và safe-error boundary đã chốt.
- B-N1–B-N32, B-T1–B-T30 và B-AG1–B-AG20 đã có outcome/default.
- Đây chỉ là docs contract; không phải OAuth/runtime proof hoặc production approval.

F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE
