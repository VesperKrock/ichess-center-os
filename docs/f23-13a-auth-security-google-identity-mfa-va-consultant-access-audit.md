# F23.13A — Auth Security, Google Identity, MFA và Consultant Access Audit

Ngày chốt design foundation: 2026-07-29

```text
F23_13_STATUS: DONE DESIGN
F23_13A_STATUS: DONE DESIGN
F23_13A_FINAL_TECHNICAL_AUDIT: PASS
F23_13B_STATUS: DONE DESIGN
F23_13B_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_STATUS: DONE DESIGN
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_STATUS: DONE DESIGN
F23_13D_FINAL_TECHNICAL_AUDIT: PASS
F23_13_FINAL_TECHNICAL_AUDIT: PASS
F23_12_STATUS: DESIGN COMPLETE
F23_12D_FINAL_TECHNICAL_AUDIT: PASS
F23_12_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
F23_12D_IMPLEMENTATION_READINESS: BLOCKED
F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13A_IMPLEMENTATION_READINESS: BLOCKED
F23_13B_IMPLEMENTATION_READINESS: BLOCKED
F23_13C_IMPLEMENTATION_READINESS: BLOCKED
F23_13D_IMPLEMENTATION_READINESS: BLOCKED
F23_13_IMPLEMENTATION_READINESS: BLOCKED
F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13_AUTH_CONFIGURATION_CHANGE: NO
F23_13_SUPABASE_ACTION: NOT RUN
RUNTIME_CHANGE: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
AUTH_CHANGE: NO
SUPABASE_ACTION: NOT RUN
DEPLOY: NOT RUN
REAL_ACCOUNT_CHANGE: NO
REAL_CONSULTANT_ACCOUNT_CREATED: NO
```

## 1. Phạm vi, taxonomy và bằng chứng

F23.13A là design-only foundation audit. Tài liệu này không bật provider, MFA, callback, route, account, role, permission, SQL, migration hoặc Supabase action.

Mọi kết luận dùng một trong bốn nhãn:

- **REPO FACT:** được chứng minh bằng code, schema snapshot, config local hoặc tài liệu final hiện có. Fact về `supabase/config.toml` chỉ nói trạng thái local được commit, không suy diễn cấu hình remote.
- **PARTIAL FOUNDATION:** có nền tái sử dụng nhưng chưa đạt security boundary cần thiết.
- **DESIGN PROPOSAL:** contract đề xuất để duyệt cho phase sau; chưa có authority runtime.
- **DEFERRED:** ngoài F23.13A hoặc phải chờ approval/dependency.

Nguồn audit chính: `src/app-auth.js`, `src/supabase-auth.js`, `src/app-center-binding.js`, `src/app-login-gate.js`, `src/online-access-control.js`, `src/main.js`, `src/storage.js`, `src/staff-module.js`, các module hồ sơ hành chính, `supabase/config.toml`, schema/migration hiện có và năm server function quản trị tài khoản trong `supabase/functions`.

## 2. Đồng bộ F23.12 final technical audit

**REPO FACT:** F23.12D đã có hai marker:

```text
F23_12D_FINAL_TECHNICAL_AUDIT: PASS
F23_12_FINAL_TECHNICAL_AUDIT: PASS
```

**REPO FACT:** final line canonical của F23.12D là:

```text
F23.12D FINAL TECHNICAL AUDIT PASS - F23.13 DESIGN MAY START
```

**REPO FACT:** final audit chỉ mở design F23.13. Nó không thay các gate:

```text
F23_12_STATUS: DESIGN COMPLETE
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
F23_12D_IMPLEMENTATION_READINESS: BLOCKED
F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED
```

**REPO FACT:** không có tài khoản thật được tuyên bố hoặc gán Platform Owner bởi F23.12/F23.13A.

## 3. Repo truth — Auth, session và login

| Surface | Phân loại | Repo truth và giới hạn |
| --- | --- | --- |
| Supabase client bootstrap | REPO FACT | Browser tạo client từ `VITE_SUPABASE_URL` và publishable/anon key; không có service-role key trong client source. |
| Login UI | REPO FACT | UI ghi “Email / Tài khoản” nhưng input là `type="email"`; submit trim giá trị rồi gọi trực tiếp `signInWithPassword({ email, password })`. |
| Username translation | REPO FACT | Không có username-to-email resolver hoặc canonical username login trong runtime. Nhãn “Tài khoản” không chứng minh username login. |
| Password login | REPO FACT | Email/password login đang tồn tại qua Supabase Auth. Lỗi hiện có thể hiển thị `error.message` do SDK trả về, chưa có uniform safe auth error mapper. |
| Sign-out | REPO FACT | `auth.signOut()` được gọi; state app, membership, center và cache in-memory liên quan user được clear qua `syncCloudUser(null)`. |
| Session bootstrap | PARTIAL FOUNDATION | App gọi `auth.getUser()`, đăng ký `onAuthStateChange`, xử lý `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`; không có explicit step-up/freshness record. |
| Session refresh | PARTIAL FOUNDATION | Có listener cho `TOKEN_REFRESHED` và client được tạo bằng defaults; repo không gọi `refreshSession()` hay định nghĩa security action dựa trên fresh server authentication. |
| Auth gate | REPO FACT | Dashboard chỉ mở khi signed-in và center binding là `bound`. Active membership là điều kiện để bind center. |
| Current center | REPO FACT | Resolver đọc membership của chính user, sort theo `center_id`, rồi chọn active membership đầu tiên; nhiều membership active chỉ tạo message và vẫn dùng center đầu tiên. |
| Center switching | PARTIAL FOUNDATION | Owner console có flow switch sang active membership cụ thể; đây không phải platform authority và không tạo permission xuyên center. |
| Local Auth config | REPO FACT | Local config bật Auth/email signup, tắt anonymous sign-in, tắt manual linking; minimum password length là 6 và password requirements rỗng. Không suy diễn remote bằng các giá trị này. |
| Secure password change | REPO FACT | Local config đặt `secure_password_change = false`; repo không có self-service change-password runtime. |
| Google/OAuth | REPO FACT | Không có Google provider stanza hoặc Google/OAuth/linking callback code. OAuth server local bị tắt; manual linking local bị tắt. |
| MFA | REPO FACT | TOTP và phone MFA local đều tắt; WebAuthn/passkey chỉ là comment/template; không có MFA runtime code. |

**PARTIAL FOUNDATION:** auth bootstrap đủ để nhận biết user và membership, nhưng không phải security service cho re-auth, lifecycle, identity link, MFA, recovery hoặc step-up.

## 4. Repo truth — password, account lifecycle và audit

| Surface | Phân loại | Repo truth và giới hạn |
| --- | --- | --- |
| Self-service đổi mật khẩu | REPO FACT | Không có form/call `auth.updateUser` để user đổi mật khẩu. |
| Owner reset mật khẩu | PARTIAL FOUNDATION | `reset-center-admin-password` chỉ cho active Owner đúng center reset đúng một active `center_admin`; server sinh mật khẩu tạm bằng `crypto.getRandomValues`, trả một lần và ghi account audit. |
| First-login forced change | REPO FACT | Không có marker/user state hoặc gate bắt đổi mật khẩu lần đầu. `credential_handoff_required` chỉ nằm ở response/audit metadata, không được runtime enforce. |
| Provision account | PARTIAL FOUNDATION | `provision-center-admin-account` tạo Auth user `center_admin`, active membership và audit; email được server suy ra từ trusted center slug nhưng domain là constant cố định trong function source. Client không truyền email/role/password; constant này không được tái dùng làm security authority. |
| List account | PARTIAL FOUNDATION | `list-center-admin-accounts` chỉ liệt kê lifecycle của `center_admin` trong production center mà caller có active Owner membership. |
| Revoke | PARTIAL FOUNDATION | `revoke-center-admin-access` đổi membership `active -> revoked`. Request disable Auth user trả `auth_disable_not_implemented`; không revoke Auth session. |
| Restore | PARTIAL FOUNDATION | `restore-center-admin-access` đổi membership `revoked -> active`; không re-enable Auth user vì revoke không disable Auth user. |
| Lifecycle enforcement at app gate | PARTIAL FOUNDATION | User không có active membership bị deny dashboard; Auth session/user vẫn có thể tồn tại và account có thể còn active ở center khác. |
| Session invalidation | REPO FACT | Reset password, membership revoke/restore không có explicit global session revocation trong repo. |
| Account audit | PARTIAL FOUNDATION | `account_audit_logs` có RLS, service-role insert/select grants, indexes và constraints cấm ba plaintext password key ở top-level JSON. Năm function ghi/đọc audit theo action/idempotency. |
| Atomicity | PARTIAL FOUNDATION | Một số function cố rollback user/membership khi provisioning audit fail; reset/revoke/restore có thể mutate trước rồi audit fail, trả manual-review error. Không có một transaction xuyên Auth + database. |
| Error privacy | PARTIAL FOUNDATION | Function có safe codes, nhưng một số owner-guard query error có thể trả `debug`; login hiển thị SDK message. Contract F23.13 không được tái sử dụng raw debug cho browser. |
| CORS | PARTIAL FOUNDATION | Function lấy allow-origin từ environment nhưng fallback là wildcard. Bearer token và server owner guard vẫn có; production origin policy cần review riêng. |
| Canonical account lifecycle | REPO FACT | Chưa có canonical account state service thống nhất Auth user, mọi membership, factor, provider identity và session invalidation. Đây tiếp tục là blocker F23.12 và F23.13 implementation. |

**DESIGN PROPOSAL:** temporary credential không được coi là “forced change” nếu server chưa lưu một state fail-closed và mọi privileged endpoint chưa kiểm tra state đó.

**DEFERRED:** đổi password runtime, email recovery, forced first-login, account-wide disable, session revocation và transactional lifecycle implementation.

## 5. Repo truth — membership, role và permission

| Surface | Phân loại | Repo truth và giới hạn |
| --- | --- | --- |
| Membership model | REPO FACT | `center_members` unique theo `(center_id, user_id)`, FK đến Auth user; app chỉ bind status chính xác `active`. |
| Role/status defaults | REPO FACT | Schema snapshot đặt role mặc định `admin`, status mặc định `active`; app normalize `admin` thành `center_admin`. Không có role enum/check constraint trong snapshot. |
| Own-membership read | REPO FACT | Authenticated user có RLS SELECT membership của chính mình. Server function dùng service-role rồi tự guard active Owner đúng center. |
| Generic app role policy | REPO FACT | `owner`, `qtv`, `center_admin` là cloud writers; `teacher`, `consultant`, `viewer` được generic access coi là read-only. |
| Module policy | REPO FACT | `canReadModule` không xét `moduleId`; launcher/open-window không có consultant module allowlist. Active consultant có thể nhìn toàn dashboard surface trừ các module có guard riêng. |
| Permission override | REPO FACT | Không có permission-override table/service/effective-permission resolver. Hồ sơ hành chính dùng fixed action sets cho Owner/Center Admin; consultant bị deny. |
| Server authorization gap | REPO FACT | Schema snapshot đồng thời có role-aware write policies và broad policies cho mọi active member trên `center_cloud_entities`; PostgreSQL policies cùng command được OR, nên app-side consultant read-only không phải server write boundary. |
| Private staff data | REPO FACT | Hồ sơ/tài liệu hành chính chỉ cho active Owner/Center Admin đúng center; consultant bị deny ở app action resolver và private attachment helpers. |
| Transaction evidence | REPO FACT | SUP-CF.1 hardened owner/center_admin migration hiện có trong history và canonical final history nói migration đã apply remote/bất biến; F23.13A không sửa hoặc apply lại. |

**DESIGN PROPOSAL:** mọi future capability phải được server resolve từ immutable Auth user, active exact-center membership, canonical role và explicit override; UI chỉ phản chiếu quyết định.

**DEFERRED:** sửa broad RLS/policy hiện có. Đây là runtime/SQL work cần phase và approval riêng; F23.13A chỉ ghi blocker.

## 6. Repo truth — consultant và CRM

| Surface | Phân loại | Repo truth và giới hạn |
| --- | --- | --- |
| Machine role | REPO FACT | `consultant` tồn tại trong online role constants, aliases, staff account role labels và tests. |
| Default generic access | REPO FACT | Consultant được generic cloud read, bị app-layer generic write deny với reason limited-role read-only. |
| CRM surface | REPO FACT | Module Phụ huynh/Tư vấn render đủ contact, phone, email, care log, appointment, enrollment draft và mutation handlers. |
| CRM persistence | REPO FACT | Parent consultations được lưu localStorage theo center namespace; create/update/delete/care-log handlers không có consultant-specific authorization hoặc masking. |
| CRM cloud/server | REPO FACT | App cloud entity allowlist không có CRM lead/parent entity; không có consultant CRM server function/RLS capability. |
| Data visibility | REPO FACT | Không có current-role masking cho phone, email, address, birth data, tuition hoặc care notes trên CRM surface. |
| Staff relationship | PARTIAL FOUNDATION | Staff record giữ riêng `accountUserId`, `membershipId`, `accountLinkedAt`; role consultant có thể xuất hiện trong account directory/link display. Link không gộp Staff và Auth record. |
| Unlink/termination | REPO FACT | Unlink Staff chỉ xóa reference local; account, membership, role và login không đổi. Staff termination cũng tuyên bố account/link không đổi. |
| Consultant provisioning | REPO FACT | Không có consultant account provisioning server function. Năm function hiện hữu chỉ quản trị `center_admin`. |
| Consultant account lifecycle | REPO FACT | Không có consultant-specific revoke/restore/forced password/MFA policy. Chỉ generic membership resolution áp dụng nếu membership đã tồn tại. |
| Permission override | REPO FACT | Không có override cho consultant; UI cũng không có effective capability matrix. |

**PARTIAL FOUNDATION:** repo đã tách Staff record khỏi account/membership và có center namespace, nhưng CRM hiện là local UI/data, không phải production consultant authorization boundary.

**DEFERRED:** account consultant thật, CRM backend, masking runtime, role/capability override và server enforcement.

## 7. “Google link” có ba nghĩa độc lập

| Option | Phân loại | Nghĩa | Security consequence | F23.13A position |
| --- | --- | --- | --- | --- |
| G1 — Google Sign-In | DESIGN PROPOSAL | Google là phương thức đăng nhập trực tiếp. | Bare OAuth sign-in có thể tạo identity/account ngoài provisioning và phải chặn lifecycle trước authority. | Không phải default; quyết định ở A-AG1/A-AG3 và thiết kế chi tiết F23.13B. |
| G2 — Link Google identity | DESIGN PROPOSAL | User đã đăng nhập account iChess hiện có rồi thêm Google identity như credential bổ sung. | Cần re-auth, one-time link intent, subject uniqueness, audit, recovery và safe unlink. | Recommended default để approval. |
| G3 — Google Workspace restriction | DESIGN PROPOSAL | Chỉ chấp nhận identity từ tenant/domain Workspace đã duyệt. | Là policy độc lập phủ lên G1 hoặc G2; email suffix một mình không đủ authority. | Optional, chỉ bật sau allowlist/ownership verification được duyệt. |

```text
GOOGLE_IDENTITY_DEFAULT_MODEL: LINK_TO_EXISTING_ICHESS_ACCOUNT
GOOGLE_AUTO_CREATE_ACCOUNT_ALLOWED: NO
GOOGLE_EMAIL_MATCH_AUTO_LINK_ALLOWED: NO
GOOGLE_IDENTITY_REPLACES_CANONICAL_ACCOUNT_ID: NO
GOOGLE_EMAIL_IS_AUTHORITY: NO
GOOGLE_AUTO_LINK_BY_EMAIL: NO
GOOGLE_AUTO_ACCOUNT_PROVISIONING: NO
GOOGLE_CALENDAR_IN_F23_13_SCOPE: NO
GOOGLE_DRIVE_IN_F23_13_SCOPE: NO
GOOGLE_CLASSROOM_IN_F23_13_SCOPE: NO
```

**DEFERRED:** Google Calendar, Drive, Classroom và API scopes nghiệp vụ. Không có repo fact nối “Google link” với các integration này.

## 8. Recommended identity-linking model

**DESIGN PROPOSAL:** canonical account ID tiếp tục là immutable iChess Auth user ID. Provider identity là credential/link phụ; provider email chỉ là verified evidence.

### 8.1 Server contract

1. User phải signed-in vào account iChess hiện hữu và account lifecycle phải eligible.
2. Server yêu cầu re-auth/step-up còn fresh trước khi tạo link intent.
3. Server tạo one-time intent bind exact user, session, provider, exact redirect URI, PKCE challenge, state digest, nonce, created/expiry time và single-use state.
4. PKCE verifier, nonce và link intent chỉ ở protected server storage; browser chỉ giữ opaque state cần thiết.
5. Callback kiểm tra exact state, nonce, PKCE, issuer, audience, signature, time, provider và redirect allowlist.
6. Server lấy exact immutable provider subject. Verified email và Workspace claim chỉ là evidence/policy input.
7. Không tìm account bằng email để link; không tạo account nếu callback không bind vào authenticated existing account.
8. Unique provider + subject chỉ được thuộc một canonical account. Conflict fail closed, không tiết lộ account đích.
9. Server re-check account lifecycle, link intent, current session, membership/role policy ngay trước atomic link + audit.
10. Disabled, banned, revoked hoặc recovery-locked account không được link hoặc dùng Google login để vượt lifecycle.
11. Callback không nhận role, membership, account ID, assurance level hoặc redirect tùy ý từ browser.
12. Provider token không lưu localStorage/sessionStorage. Refresh token chỉ lưu protected server-side khi một approved use case thật sự cần; authentication-only không tự tạo nhu cầu lưu token ứng dụng.
13. Error trả safe code; provider payload, token, stack, SQL và private account existence không về browser.
14. Link/unlink, conflict review và admin intervention ghi immutable audit, nhưng không ghi token hoặc raw provider payload.

### 8.2 Unlink contract

**DESIGN PROPOSAL:** unlink yêu cầu fresh re-auth/step-up, exact link version và lifecycle re-check. Không cho unlink login method cuối cùng nếu chưa có verified recovery method. Unlink revoke provider token nếu có, invalidate session theo policy A-AG18 và ghi audit. Unknown link state hoặc provider dependency unavailable phải fail closed.

### 8.3 Identity-link lifecycle

```text
UNLINKED
LINK_PENDING
LINKED
REAUTH_REQUIRED
CONFLICT
REVOKED
UNLINKED_BY_USER
UNLINKED_BY_ADMIN
```

| From | Event | To | Phân loại và guard |
| --- | --- | --- | --- |
| UNLINKED | fresh iChess re-auth + server intent | LINK_PENDING | DESIGN PROPOSAL; one-time, short TTL, exact session/provider. |
| LINK_PENDING | verified callback + unique subject + lifecycle eligible | LINKED | DESIGN PROPOSAL; atomic link/audit. |
| LINK_PENDING | expired/stale/no fresh auth | REAUTH_REQUIRED | DESIGN PROPOSAL; no partial link. |
| LINK_PENDING | subject belongs elsewhere/provider mismatch | CONFLICT | DESIGN PROPOSAL; safe error, security review. |
| LINKED | provider/admin revocation | REVOKED | DESIGN PROPOSAL; login blocked, sessions reviewed. |
| LINKED | user unlink + recovery safe | UNLINKED_BY_USER | DESIGN PROPOSAL; fresh step-up and audit. |
| LINKED/CONFLICT | approved admin unlink | UNLINKED_BY_ADMIN | DESIGN PROPOSAL; two-person policy for privileged account. |

**DEFERRED:** provider credentials, callback route, provider config, identity-link storage and real link/unlink.

## 9. MFA/2FA taxonomy và role policy

| Method | Phân loại | Strength/use | Weakness | Recommended position |
| --- | --- | --- | --- | --- |
| TOTP authenticator | DESIGN PROPOSAL | Deployable baseline, independent app/device secret. | Phishable; seed/recovery handling critical. | Baseline for Owner, Center Admin và consultant before sensitive CRM capability. |
| WebAuthn/passkey | DESIGN PROPOSAL | Phishing-resistant challenge bound to origin. | Synced passkey recovery/attestation policy needs clarity. | Preferred user-facing strong factor after TOTP foundation. |
| Hardware-backed security key | DESIGN PROPOSAL | Phishing-resistant, device possession, strong for privileged operators. | Procurement, spare key và recovery ceremony. | Required direction for production Platform Owner under F23.12D gate. |
| SMS OTP | DESIGN PROPOSAL | Broad device reach. | SIM swap, carrier dependency, cost và delivery risk. | Not default; exception only after risk approval. |
| Email OTP | DESIGN PROPOSAL | Familiar fallback. | Weak if same inbox is login/recovery root. | Not a strong second factor in that topology. |
| Recovery codes | DESIGN PROPOSAL | Offline single-use recovery. | Theft/plaintext mishandling bypasses factor. | Recovery mechanism, not an enrolled second factor. |

```text
MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: NO
MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: NO
PLATFORM_OWNER_PRODUCTION_HARDWARE_BACKED_MFA_REQUIRED: YES
SMS_OTP_DEFAULT_FACTOR: NO
EMAIL_OTP_ALWAYS_COUNTS_AS_STRONG_SECOND_FACTOR: NO
```

**DESIGN PROPOSAL:** server derives assurance level from verified factor/session state on every protected action. UI badge, role label, local timestamp hoặc client claim không cấp authority.

## 10. MFA lifecycle

```text
NOT_ENROLLED
ENROLLMENT_PENDING
ENROLLED
CHALLENGE_REQUIRED
VERIFIED
RECOVERY_REQUIRED
RESET_PENDING_APPROVAL
SUSPENDED
REVOKED
```

| Flow | DESIGN PROPOSAL contract |
| --- | --- |
| Enrollment | Eligible lifecycle + fresh primary re-auth; server generates factor enrollment; secret/QR shown only in controlled pending session. |
| Confirmation | Enrollment is not `ENROLLED` until valid challenge confirms possession; pending secret expires and cannot authenticate. |
| Recovery codes | Generate 10 high-entropy single-use codes after factor confirmation; show once; store only salted slow hashes with server protection; download/copy is not logged as plaintext. |
| Regeneration | Requires fresh factor/step-up; atomically invalidates all old unused codes; audit count/version only. |
| Lost device | Valid recovery code moves to `RECOVERY_REQUIRED`; restrict session, require factor replacement and invalidate used code. |
| Admin-assisted reset | Creates `RESET_PENDING_APPROVAL`; no factor removed until approver/risk/cooldown contract succeeds. |
| Compromise | Suspend/revoke factor, invalidate sessions and require clean replacement; no reuse of old seed. |
| Factor replacement | New factor confirms before old factor removal unless approved recovery path; privileged role may require two registered hardware factors. |
| First login | Temporary-password account changes password first, then enrolls required MFA inside limited session; no privileged action during grace violation. |
| Role enforcement | Server policy maps canonical role/risk to required factor strength; escalation cannot take effect until required factor is verified. |
| Reset completion | Invalidate prior step-up assertions and sessions according to risk; notify user out-of-band without secrets. |

**DESIGN PROPOSAL:** TOTP secret và recovery code plaintext không đi vào logs, analytics, audit metadata, URL, referrer, crash report hoặc browser storage.

**DEFERRED:** actual enrollment API, QR UI, factor table, Auth MFA activation và remote policy.

## 11. Step-up authentication

**DESIGN PROPOSAL:** step-up evidence is server-derived and bound to actor, canonical account lifecycle, session, factor/AAL, authentication method, issued time, expiry, action risk and optional exact resource. Default freshness recommendation is 10 minutes; critical authority/private export action uses at most 5 minutes and may be single-use.

```text
STEP_UP_DEFAULT_FRESHNESS_MINUTES: 10
STEP_UP_CRITICAL_FRESHNESS_MINUTES: 5
STEP_UP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO
STEP_UP_UI_BADGE_IS_AUTHORITY: NO
```

Step-up bắt buộc cho:

| Action | Required proposal |
| --- | --- |
| Đổi mật khẩu | Fresh primary re-auth + enrolled factor when policy requires. |
| Link/unlink Google | Fresh primary re-auth + MFA for enrolled/required roles; exact provider/link version. |
| Reset MFA | Recovery/approval ceremony; current session assertion alone không đủ. |
| Xem/tải private HR | Strong factor, 5-minute freshness, exact center/resource/purpose, audit. |
| Platform Owner bootstrap/grant | F23.12D hardware-backed and two-person gates; 5-minute exact-action evidence. |
| Acting sensitive action | F23.12C approval plus step-up; neither replaces the other. |
| Account revoke/restore | Strong step-up, exact target/center and immutable audit. |
| Permission escalation | Strong step-up + independent approval + resulting role factor compliance. |
| Financial-private action | Strong factor, exact center/action/resource and audit. |
| Sensitive export | Strong factor, short-lived single-use export authorization, masking/purpose/audit. |

Dependency unavailable, unknown assurance hoặc stale evidence luôn deny; không fallback sang client-only check.

## 12. Recovery boundary

**DESIGN PROPOSAL:** recovery là lifecycle riêng, không phải bypass MFA.

- Self-service recovery dùng một recovery code còn hiệu lực, single-use; session nhận được bị restricted cho đến khi factor mới xác minh.
- Admin-assisted recovery yêu cầu verified target, reason, independent approver theo risk tier, cooldown và immutable audit.
- Platform Owner dùng protected security-assisted recovery của F23.12D; Center Admin không được reset factor Platform Owner.
- Owner recovery không do chính target hoặc consultant phê duyệt; Platform Owner recovery cần two-person security process.
- MFA reset/factor removal invalidate old step-up assertions và risk-selected sessions; compromise mặc định invalidate toàn bộ session account.
- Không gửi mật khẩu hiện tại; không dùng secret question.
- Một inbox duy nhất không được vừa là primary login vừa là toàn bộ recovery trust root.
- Recovery code lưu hash, không plaintext; audit chỉ ghi method class, outcome, actor/approver, reason và time.
- Unknown identity, lifecycle blocked, approver conflict, audit dependency unavailable hoặc session invalidation failure phải fail closed.

```text
RECOVERY_CODE_RECOMMENDED_COUNT: 10
RECOVERY_CODE_SINGLE_USE: YES
RECOVERY_CODE_PLAINTEXT_STORAGE_ALLOWED: NO
SECRET_QUESTION_ALLOWED: NO
CENTER_ADMIN_CAN_RESET_PLATFORM_OWNER_MFA: NO
```

**DEFERRED:** recovery implementation, notification channel, risk engine và service-desk tooling.

## 13. Consultant capability proposal — default allow candidates

Các tên dưới đây chỉ là **DESIGN PROPOSAL**, chưa phải schema hoặc permission thật.

| Capability | Business purpose | Sensitivity | Scope | R/W | Server guard | Masking | Audit | Default | Override policy | Dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `crm.lead.read` | Xem lead được giao/chờ xử lý | Medium/PII | Exact active center; assigned/team queue | R | Auth user + active consultant membership + capability + row scope | Phone/email masked mặc định | View detail/reveal/export | Allow limited | Owner-approved narrowing/bounded team expansion only | Canonical CRM backend/RLS |
| `crm.lead.create` | Ghi nhận khách mới | Medium/PII | Exact active center | W | Server validates fields/source/center | Minimize fields; no private notes | Create + source | Allow | May be denied per consultant; no cross-center grant | CRM create service |
| `crm.lead.update` | Cập nhật stage/next action | Medium/PII | Assigned lead, exact center | W | Version/assignment/capability guard | Cannot unmask unrelated fields | Before/after safe field set | Allow limited | Owner-approved team scope; no ownership bypass | Optimistic concurrency/audit |
| `crm.care_log.create` | Ghi lịch sử chăm sóc | High free text | Assigned lead, exact center | W | Capability + assignment + content policy | No HR/financial/private document data | Create/result/channel, redacted summary | Allow limited | No delete/edit override by default | Care-log immutable model |
| `parent.basic.read` | Nhận diện phụ huynh phục vụ tư vấn | Medium/PII | Linked lead/student, exact center | R | Relationship + capability guard | Mask contact/address; reveal purpose-bound | Detail/reveal | Allow limited | Owner-approved assignment expansion | Parent canonical entity |
| `student.basic.read_limited` | Tư vấn chương trình/lịch phù hợp | High/minor PII | Linked prospective/current student, exact center | R | Relationship + field allowlist | Name minimal, age band/year, program only | Detail/reveal | Allow limited | No medical/learning/private notes override | Student field projection |
| `tuition.quote.read` | Báo giá/gói học | Low/Medium | Public/center product catalog | R | Active center + published quote | No customer ledger | Quote view/export if personalized | Allow | Center pricing scope only | Canonical quote catalog |
| `tuition.payment_status.read_limited` | Biết trạng thái để follow-up | High financial | Linked customer, exact center | R | Capability + relationship + server projection | Bucket only: unpaid/partial/paid/overdue; no amount/ledger by default | Every detail/reveal | Deny until approved, then limited | Independent Owner approval; cannot grant full ledger | Tuition backend/projection |
| `schedule.summary.read` | Đề xuất lịch học | Medium | Exact center, published slots/classes | R | Active membership + capability | No teacher private schedule/contact | Detail/export | Allow limited | No cross-center aggregation | Schedule summary API |
| `report.sales_summary.read` | Theo dõi conversion cá nhân/đội | Medium | Exact center; own/team aggregate | R | Aggregate query + minimum cohort | Suppress small cohorts/direct identifiers | Report/export | Allow own; team deny until approved | Owner grants bounded team aggregate | Sales reporting backend |

## 14. Consultant capability proposal — default deny

| Capability | Business purpose | Sensitivity | Scope | R/W | Server guard | Masking | Audit | Default | Override policy | Dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `staff.private_hr.read` | HR administration | Critical HR | None for consultant | R | Explicit role deny server-side | Not applicable | Denied attempt | Deny | Prohibited override; use different approved role | Private HR service |
| `staff.private_hr.download` | HR document download | Critical HR/file | None | R | Explicit role deny + signed URL service deny | Not applicable | Denied attempt | Deny | Prohibited override | Private storage guard |
| `cashflow.full.read` | Full ledger | Critical financial | None | R | Explicit role deny | Not applicable | Denied attempt | Deny | Prohibited override | Financial service |
| `cashflow.write` | Mutate financial ledger | Critical financial | None | W | Explicit role deny | Not applicable | Denied attempt | Deny | Prohibited override | Financial service |
| `account.manage` | Provision/reset/revoke account | Critical identity | None | W | Explicit role deny | Not applicable | Denied attempt | Deny | Cannot be consultant override | Account lifecycle service |
| `permission.manage` | Change capabilities | Critical authorization | None | W | Explicit role deny | Not applicable | Denied attempt | Deny | Cannot be consultant override | Permission service |
| `center.manage` | Center lifecycle/config | Critical governance | None | W | Explicit role deny | Not applicable | Denied attempt | Deny | Cannot be consultant override | Center governance service |
| `platform.manage` | Platform authority | Critical platform | None | R/W | F23.12 server authority deny | Not applicable | Denied attempt | Deny | Never via center override | F23.12 implementation |
| `acting.start` | Start support acting | Critical platform | None | W | F23.12C authority deny | Not applicable | Denied attempt | Deny | Never via consultant override | F23.12C implementation |
| `storage.private.delete` | Delete private object | Critical destructive | None | W | Private executor deny | Not applicable | Denied attempt | Deny | Never via consultant override | Approved server executor |

```text
CONSULTANT_IS_PLATFORM_ROLE: NO
CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: NO
CONSULTANT_PERMISSION_UI_ONLY_GUARD_ALLOWED: NO
CONSULTANT_DEFAULT_PRIVATE_HR_ACCESS: NO
CONSULTANT_DEFAULT_FULL_FINANCIAL_ACCESS: NO
```

**DESIGN PROPOSAL:** override chỉ có thể narrow hoặc cấp một capability allowlisted, time-bounded, exact-center sau approval. Override không thể cấp bất kỳ default-deny critical capability ở mục 14, không đổi canonical role và không vượt account lifecycle/MFA.

## 15. Consultant data masking

| Data | DESIGN PROPOSAL default projection | Reveal/deny rule |
| --- | --- | --- |
| Số điện thoại | Chỉ suffix ngắn và nhãn đã xác minh/chưa xác minh | Full number chỉ cho assigned active lead, purpose-bound, step-up theo risk và audit. |
| Email | Mask local part; giữ domain khi cần nhận diện | Full email chỉ cho assigned lead và audited contact action. |
| Địa chỉ | Quận/khu vực, không số nhà/địa chỉ đầy đủ | Full address deny mặc định; exception operational riêng, không do cùng center. |
| Ngày sinh | Age band hoặc năm sinh | Full date deny mặc định; minor data cần relationship guard. |
| Học viên | Tên tối thiểu, age band, chương trình, lịch phù hợp | Không learning/private notes, health, documents hoặc unrelated family links. |
| Học phí | Quote và status bucket | Không full ledger, exact payment instrument, cashflow hoặc chứng từ. |
| Lịch sử chăm sóc | Assigned lead, fields allowlisted | Free text được sanitize/redact; internal security/HR/financial note bị loại. |
| Ghi chú nội bộ | Care-purpose note tối thiểu | Manager/security/private note deny; không dựa vào cùng center để mở. |
| Tài liệu private | Không projection | Always deny consultant. |
| Thông tin nhân sự | Không projection | Always deny consultant. |
| Dữ liệu tài chính | Sales aggregate/quote/payment bucket đã duyệt | Full cashflow, payroll, bank info và evidence deny. |

**DESIGN PROPOSAL:** masking phải ở server projection/query, không chỉ CSS/DOM. Export, search, realtime payload, audit preview và error cũng dùng cùng projection. “Cùng center” không đồng nghĩa “được xem toàn bộ”.

**DEFERRED:** masking UI/API thật và reveal workflow.

## 16. Consultant provisioning boundary

**DESIGN PROPOSAL:** năm khái niệm là năm record/lifecycle riêng:

```text
Hồ sơ Nhân viên/Tư vấn
Tài khoản đăng nhập
Center membership
Role consultant
Permission overrides
```

| Record | Authority/lifecycle proposal |
| --- | --- |
| Staff/Consultant profile | HR/operational identity; có thể tồn tại trước account; không chứa Auth credential. |
| Login account | Canonical immutable Auth user; lifecycle account-wide; không tự suy ra từ Staff email. |
| Center membership | Exact user + exact center + status; mỗi center là grant riêng. |
| Role consultant | Machine role trên membership, allowlisted server-side; không phải platform role. |
| Permission override | Separate versioned grant/deny, exact center/capability/expiry/approver; default none. |

Provisioning tương lai phải server-side, exact center, role allowlist chỉ `consultant` trong flow này, credential tạm hoặc approved existing identity link, forced password/MFA policy, immutable audit và revoke/restore. Nó không tạo Platform Owner, không cấp center khác và không merge Staff/account thành một row.

**DESIGN PROPOSAL:** internal consultant cần Staff record active trước account. Multi-center chỉ bằng separate approved active membership; mỗi request/session bind một center, không cross-center aggregate.

**DEFERRED:** consultant account creation, membership/role mutation, override table và Staff-account server link.

## 17. Authorization principles và safe errors

```text
GOOGLE_EMAIL_IS_AUTHORITY: NO
GOOGLE_AUTO_LINK_BY_EMAIL: NO
GOOGLE_AUTO_ACCOUNT_PROVISIONING: NO
MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: NO
MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: NO
CONSULTANT_IS_PLATFORM_ROLE: NO
CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: NO
CONSULTANT_PERMISSION_UI_ONLY_GUARD_ALLOWED: NO
HARDCODED_SECURITY_EMAIL_ALLOWED: NO
```

**DESIGN PROPOSAL:** allowlisted client-safe error codes:

```text
identity_link_not_available
identity_link_reauth_required
identity_link_conflict
identity_already_linked
identity_provider_mismatch
identity_callback_invalid
mfa_enrollment_required
mfa_challenge_required
mfa_challenge_failed
mfa_recovery_required
mfa_reset_pending
mfa_factor_invalid
account_lifecycle_blocked
consultant_access_denied
consultant_center_mismatch
permission_not_granted
security_service_unavailable
```

Error không trả token, provider payload, secret, TOTP seed, recovery code, stack, SQL, raw debug hoặc private account existence. Enumeration-sensitive flows dùng outward response tương đương và rate limit riêng.

## 18. Threat model

| ID | Threat | Likelihood | Impact | Mitigation proposal | Residual risk | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | OAuth account-link takeover | Medium | Critical | Existing-account login, fresh step-up, one-time intent, exact subject, atomic audit | Compromised active session | F23.13B implementation |
| T2 | Auto-link do trùng email | High nếu dùng shortcut | Critical | No email auto-link; email evidence only | Social engineering support | F23.13B |
| T3 | Provider subject reused sai account | Low/Medium | Critical | Unique provider-subject, conflict state, no reassignment shortcut | Provider account recovery abuse | F23.13B |
| T4 | OAuth state/nonce replay | Medium | High | Server state digest, nonce, PKCE, TTL, single-use | Storage/race defect | F23.13B security tests |
| T5 | Callback open redirect | Medium | High | Exact server redirect allowlist, no client URL authority | Misconfigured allowlist | F23.13B |
| T6 | Google token lưu browser | Medium | High | No local/session storage; protected server storage only if approved | Browser extension can see transient flow | F23.13B |
| T7 | Unlink login method cuối | Medium | High | Recovery-method invariant + fresh step-up | Recovery method later becomes unavailable | F23.13B/C |
| T8 | TOTP secret log leak | Low/Medium | Critical | Secret redaction, one-time display, no analytics/log/audit payload | Client compromise during enrollment | F23.13C |
| T9 | Recovery code plaintext storage | Medium | Critical | High entropy, show once, salted slow hashes, single-use | User stores code insecurely | F23.13C |
| T10 | Admin lạm dụng reset MFA | Medium | Critical | Independent approval, scope limits, target notification, cooldown, audit | Colluding approvers | F23.13C/F23.12D |
| T11 | SIM swap | Medium | High | SMS not default; risk exception only | Carrier attack on approved exception | F23.13C |
| T12 | Email inbox compromise | High | High | Email not sole login+recovery root; require independent factor | Multi-channel compromise | F23.13B/C |
| T13 | Session cũ sống sau MFA reset | Medium | Critical | Server session invalidation and step-up revocation as reset commit gate | Distributed invalidation delay | F23.13C |
| T14 | Client giả step-up timestamp | High nếu client-only | Critical | Server-derived assertion bound session/action/resource | Server clock/config defect | F23.13C |
| T15 | Consultant ẩn UI nhưng API cho phép | High trên nền hiện tại | Critical | Server capability/RLS projection; negative direct-API tests | Missed endpoint/policy OR behavior | F23.13D implementation |
| T16 | Consultant đọc center khác | Medium | Critical | Exact active membership, request center binding, no aggregate, RLS tests | Bad relationship data | F23.13D |
| T17 | Override nâng thành account management | Medium | Critical | Critical denylist, capability allowlist, independent approval, expiry | Permission service defect | F23.13D |
| T18 | Consultant xem private HR/financial | Medium/High | Critical | Server explicit deny, field projection, no signed URL, audit | Data copied into free text | F23.13D |
| T19 | Disabled account login qua Google | Medium | Critical | Canonical lifecycle checked before link/login/session authority | Provider session issued before app guard | F23.13B + lifecycle service |
| T20 | Account enumeration qua link/reset | High | Medium/High | Uniform outward errors, opaque request, separate rate limits | Timing side channels | F23.13B/C |
| T21 | Broad member RLS bypass app read-only | High (repo gap) | Critical | Replace broad OR policies with canonical capability guard after approved SQL phase | Migration/policy regression | F23.13D prerequisite |
| T22 | Password reset/revoke mutate rồi audit fail | Medium | High | Transactional lifecycle/outbox or compensating fail-closed workflow | Auth/database cross-service limits | Account lifecycle prerequisite |

## 19. Approval gates A-AG1–A-AG20

| Gate | Recommended default | Lý do | Rủi ro nếu sai | Approver | Implementation phase |
| --- | --- | --- | --- | --- | --- |
| A-AG1 Google link là gì? | G2 link identity vào account iChess hiện có; G1/G3 là quyết định riêng | Giữ provisioning/canonical account | Bare sign-in auto-provisions hoặc scope confusion | Product + Security + Architecture | F23.13B design trước runtime |
| A-AG2 Giữ username-password primary? | Giữ credential email/password hiện tại trong transition; không tuyên bố username khi chưa có resolver | Có fallback/recovery rõ | Lockout hoặc hai identifier truth | Product + Security | F23.13B |
| A-AG3 Cho Google-only account? | NO | Không auto-create, giữ managed account lifecycle | Orphan/unmanaged account | Security + Product | F23.13B |
| A-AG4 Workspace restriction? | OFF mặc định; chỉ bật approved tenant/domain allowlist | Chưa có verified business allowlist | Loại user hợp lệ hoặc tin email suffix | Security + Business Owner | F23.13B |
| A-AG5 TOTP hay WebAuthn baseline? | TOTP baseline; WebAuthn preferred next; hardware-backed cho Platform Owner | Khả thi nhưng có lộ trình phishing-resistant | TOTP phishing hoặc rollout chậm | Security + Product | F23.13C |
| A-AG6 Role bắt buộc MFA? | Platform Owner hardware; Owner/Center Admin TOTP+; consultant TOTP trước PII write; teacher risk-tier later | Phù hợp impact | Privileged credential-only takeover | Security + Executive | F23.13C/F23.12D |
| A-AG7 Grace period? | 14 ngày cho rollout Owner/Admin/consultant; 0 cho Platform Owner và sensitive action | Cân bằng enrollment/support | Bypass kéo dài | Security + Operations | F23.13C |
| A-AG8 Ai reset MFA Owner/Platform Owner? | Owner: independent Owner/Platform security; Platform Owner: two-person protected security; Center Admin không được | Separation of duties | Privilege takeover | Security + Executive | F23.13C/F23.12D |
| A-AG9 Recovery code? | 10 single-use; regeneration invalidates toàn bộ code cũ | Recovery đủ nhưng giới hạn | Reuse/code sprawl | Security | F23.13C |
| A-AG10 Step-up freshness? | 10 phút default, 5 phút critical/single-use khi cần | Giảm session riding | Too long bypass; too short poor UX | Security + Product | F23.13C |
| A-AG11 Consultant xem học phí? | Quote + status bucket; exact amount/ledger deny mặc định | Đủ follow-up, giảm financial exposure | Lộ ledger/payment | Finance Owner + Security | F23.13D |
| A-AG12 Consultant chuyển đổi khách? | Được create/update real CRM lead/care log; conversion chỉ draft/preview đến workflow riêng | Tách sales work khỏi enrollment side effect | Tạo Student/Tuition ngoài guard | CRM Owner + Operations | F23.13D |
| A-AG13 Xem full phone? | Mask mặc định; full chỉ assigned active lead, purpose-bound và audit | Data minimization | Bulk PII leakage | Privacy + CRM Owner | F23.13D |
| A-AG14 Ai duyệt override? | Owner đề xuất + independent Owner/Platform approver cho grant trên baseline; critical denylist không override | Chặn self/easy escalation | Account/financial escalation | Security + Business Owner | F23.13D |
| A-AG15 Cần Staff record trước account? | YES cho internal consultant; record vẫn tách biệt | HR accountability | Orphan internal identity | HR + Operations | F23.13D |
| A-AG16 Consultant multi-center? | Có thể, chỉ separate explicit memberships; one request = one center; no cross-center aggregate | Hỗ trợ vận hành có kiểm soát | Scope bleed | Operations + Security | F23.13D |
| A-AG17 Ai xử lý Google conflict? | Central Security/Platform identity operations; privileged conflict two-person | Center Admin không có account-wide authority | Account hijack/reassignment | Security | F23.13B |
| A-AG18 Unlink revoke session? | YES; revoke provider-linked/current sessions, all sessions cho privileged/compromise risk | Không giữ stale credential | Session survives unlink | Security + Product | F23.13B/C |
| A-AG19 Audit mọi MFA failure? | YES dạng structured/rate-limited/aggregated, không secret | Detect abuse không tạo log leak | Blind attack hoặc log DoS | Security/SRE | F23.13C |
| A-AG20 Rate-limit riêng? | YES cho login/link/callback/challenge/recovery/reset | Risk/cost khác nhau | Enumeration/brute force/DoS | Security/SRE | F23.13B/C |

Recommended defaults làm design A complete nhưng không thay approval cuối hoặc mở implementation.

## 20. Dependencies, blockers và thứ tự F23.13B–D

**REPO FACT:** các implementation F23.12A–D vẫn bị block bởi canonical account lifecycle, authority data plane, second-operator/separation, audit/outbox và các gate trong F23.12D.

**DESIGN PROPOSAL:** thứ tự design tiếp theo:

1. **F23.13B:** chốt A-AG1–A-AG4, login identifier/recovery semantics, provider/account model, link/unlink/conflict/session invalidation và safe callback contract.
2. **F23.13C:** chốt factor baseline/enforcement/grace, enrollment/challenge/recovery/reset/session invalidation và step-up service.
3. **F23.13D:** chốt consultant capability IDs, data backend/projection, override governance, provisioning/revoke và direct-API/RLS negative matrix.
4. Implementation chỉ được tách thành phase mới sau B–D design/audit PASS, remote truth review và explicit approval.

Implementation blockers:

- canonical account lifecycle + account-wide disabled/banned/recovery states;
- server session/factor invalidation và server-derived step-up;
- approved Google provider/tenant/redirect inventory và production Auth truth;
- protected identity-link store, unique subject, one-time intent và audit;
- safe auth error mapper và rate-limit service;
- consultant canonical CRM/Parent/Student/Tuition/Schedule projections;
- removal/replacement of broad member write policies after separate SQL approval;
- permission override service với critical denylist và independent approval;
- no-secret audit/notification/recovery operations;
- test fixtures cho multi-center, disabled account, conflict, stale session và direct API.

```text
NEEDS REVIEW - PRODUCTION AUTH PROVIDER AND MFA CONFIGURATION TRUTH
NEEDS REVIEW - CANONICAL ACCOUNT LIFECYCLE AND SESSION INVALIDATION SERVICE
NEEDS REVIEW - CONSULTANT SERVER DATA MODEL AND BROAD MEMBER RLS REMEDIATION
```

**DEFERRED:** mọi runtime, SQL, migration, Auth, provider credential, callback, factor enrollment, account creation, permission grant và Supabase action.

## 21. Canonical roadmap

```text
F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit
    F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill

F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn
    F23.13A DONE design / Audit nền Auth-security và chốt boundary
    F23.13B DONE design / Liên kết Google identity và login-recovery semantics
    F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery
    F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement
```

F23.13 FINAL TECHNICAL AUDIT: PASS
F23.13 IMPLEMENTATION: BLOCKED
F23.13 RUNTIME IMPLEMENTATION: NOT STARTED

## 22. Definition of done design

- F23.12D và F23.12 final technical audit sync: **PASS**.
- F23.13A–D và parent final technical audit sync: **PASS**; implementation vẫn `BLOCKED`, runtime `NOT STARTED`.
- F23.12A–D implementation `BLOCKED`, runtime `NOT STARTED`: **PASS**.
- Repo Auth/login/password/session/lifecycle/membership/permission/consultant/server function audit có classification: **PASS**.
- G1–G3 được tách rõ; Google Calendar/Drive/Classroom ngoài scope: **PASS**.
- No auto-link by email, no Google auto-create, canonical account ID không bị thay: **PASS**.
- Identity-link lifecycle, re-auth/state/PKCE/nonce/subject/conflict/unlink/audit/token boundary: **PASS design**.
- MFA taxonomy/lifecycle/enrollment/recovery/reset/step-up/role policy: **PASS design**.
- Consultant truth, center-scoped capabilities, critical denylist, masking và provisioning separation: **PASS design**.
- 22 threats và A-AG1–A-AG20 có mitigation/default/risk/approver/phase: **PASS**.
- Safe error contract, dependencies và B–D sequence: **PASS**.
- Không runtime/SQL/migration/Auth/Supabase/account/role/permission/deploy: **PASS**.

F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE
