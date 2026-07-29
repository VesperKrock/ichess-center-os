# F23.13D — Consultant Provisioning, Capability Matrix và Server Enforcement

Ngày chốt design: 2026-07-30

## 1. Trạng thái, phạm vi và boundary

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
F23_13A_IMPLEMENTATION_READINESS: BLOCKED
F23_13B_IMPLEMENTATION_READINESS: BLOCKED
F23_13C_IMPLEMENTATION_READINESS: BLOCKED
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
SRC_CHANGE: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
RLS_CHANGE: NO
AUTH_CHANGE: NO
SUPABASE_ACTION: NOT RUN
REAL_ACCOUNT_CHANGE: NO
REAL_MEMBERSHIP_CHANGE: NO
REAL_ROLE_CHANGE: NO
REAL_CAPABILITY_CHANGE: NO
```

F23.13D là **design-only**. Tài liệu này chốt security contract tương lai; không sửa `src/`, không tạo server function, SQL, migration hoặc RLS policy, không đổi Auth/Supabase và không tạo account, Staff link, membership, role hay capability thật.

Nhãn bằng chứng:

- **REPO FACT:** hành vi đã kiểm chứng trong repository.
- **PARTIAL FOUNDATION:** nền có liên quan nhưng chưa đủ authority contract.
- **DESIGN PROPOSAL:** contract bắt buộc cho implementation sau.
- **DEFERRED:** cần phase, dependency hoặc approval khác.

F23.13C final technical audit đã `PASS`; account-security control, MFA/step-up, restricted recovery và G2 identity-linking giữ nguyên. Audit này không mở implementation F23.12/F23.13.

F23.13C FINAL TECHNICAL AUDIT PASS - F23.13D DESIGN MAY START

## 2. Repo truth kế thừa

```text
CONSULTANT_MACHINE_ROLE_EXISTS: YES
CONSULTANT_IS_PLATFORM_ROLE: NO
CONSULTANT_PROVISIONING_RUNTIME_IMPLEMENTED: NO
CONSULTANT_CAPABILITY_RESOLVER_IMPLEMENTED: NO
CONSULTANT_SERVER_MASKING_IMPLEMENTED: NO
CONSULTANT_PERMISSION_OVERRIDE_IMPLEMENTED: NO
CONSULTANT_USERNAME_LOGIN_IMPLEMENTED: NO
CONSULTANT_MFA_RUNTIME_IMPLEMENTED: NO
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTED: NO
AUTH_SESSION_INVALIDATION_IMPLEMENTED: NO
```

| Khu vực | Phân loại | Repo truth |
|---|---|---|
| Role | REPO FACT | `consultant` có trong constants/labels/tests; sự tồn tại của nhãn không cấp authority. |
| Generic app policy | REPO FACT | UI hiện coi consultant read-only; đây không phải server write boundary. |
| Generic cloud read | REPO FACT | Consultant hiện có generic cloud read; path này chưa enforce assigned scope, capability-aware minimal projection hoặc server masking canonical. |
| Module launcher | REPO FACT | Chưa có consultant-specific module allowlist. |
| CRM | REPO FACT | Phụ huynh/Tư vấn dùng localStorage theo namespace center, chưa có backend canonical, resolver hoặc masking. |
| Staff và Auth | REPO FACT | Staff record và Auth account là hai entity khác nhau. |
| Termination/unlink | REPO FACT | Flow hiện hữu chưa revoke membership/account hoặc invalidate session canonical. |
| Account server operations | REPO FACT | Năm server functions được audit chỉ quản trị `center_admin`, không provision consultant. |
| Login | REPO FACT | Login hiện là email/password; không có username resolver hoặc forced first-password-change canonical. |
| Membership revoke | REPO FACT | Revoke membership không đồng nghĩa account-wide disable hoặc session invalidation. |

Không suy diễn security runtime từ UI label, hidden button, localStorage namespace, client role hoặc client capability claim.

## 3. CRITICAL IMPLEMENTATION BLOCKER — broad active-member RLS

```text
BROAD_ACTIVE_MEMBER_RLS_WRITE_POLICY_PRESENT: YES
CONSULTANT_APP_READ_ONLY_IS_SERVER_WRITE_BOUNDARY: NO
CONSULTANT_DIRECT_GENERIC_ENTITY_WRITE_ALLOWED: NO
F23_13D_RLS_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES
CONSULTANT_UI_ONLY_GUARD_ALLOWED: NO
CONSULTANT_BROWSER_DIRECT_TABLE_WRITE_ALLOWED: NO
BROAD_RLS_CAN_REMAIN_WHILE_CONSULTANT_WRITE_ENABLED: NO
```

**REPO FACT — CRITICAL IMPLEMENTATION BLOCKER:** `center_cloud_entities` có broad policy cho mọi active member cùng lúc với role-aware policy. Các PostgreSQL policy áp dụng cùng command được OR, nên một broad active-member policy có thể cho phép direct table/API mutation dù app policy và UI coi consultant read-only.

Hệ quả fail-closed:

- Ẩn nút, route guard và module allowlist không phải authority.
- Session browser hợp lệ không được phép đi generic table write path.
- Consultant không được gửi arbitrary `entityType + payload` vào generic entity mutation.
- Không bật bất kỳ consultant write nào khi broad policy còn cấp active-member write.
- RLS phải được remove/narrow trong phase SQL riêng, được review và có direct-API/RLS regression tests trước runtime.

F23.13D không sửa RLS thật. Nếu runtime được yêu cầu trước remediation thì kết luận là `NEEDS REVIEW`.

## 4. Canonical role, center scope và eligibility

```text
CONSULTANT_ROLE_SCOPE: EXACT_CENTER
CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: NO
CONSULTANT_PLATFORM_AUTHORITY_ALLOWED: NO
CONSULTANT_ACTING_AUTHORITY_ALLOWED: NO
MULTI_CENTER_CONSULTANT_INITIAL_ROLLOUT: NO
CONSULTANT_DEFAULT_RESOURCE_SCOPE: ASSIGNED_ONLY
```

Consultant là center-scoped machine role. Department/position của Staff chỉ là employment metadata, không cấp role. Request `center_id` chỉ là selector; server phải đối chiếu exact active membership, resource center và server-derived center context. Consultant không trở thành Owner, Center Admin, Platform Owner, không có Acting và không được trộn dữ liệu giữa center.

Rollout đầu chỉ cho tối đa một active consultant center membership trên một canonical account. Multi-center tương lai cần approval riêng và membership, role, capability policy, assignment, session center context cùng audit tách độc lập theo từng center.

```text
CONSULTANT_STAFF_RECORD_REQUIRED: YES
CONSULTANT_ACTIVE_EMPLOYMENT_REQUIRED: YES
CONSULTANT_ACTIVE_MEMBERSHIP_REQUIRED: YES
CONSULTANT_EXACT_STAFF_ACCOUNT_LINK_REQUIRED: YES
```

Effective authority là phép AND của:

```text
eligible canonical account lifecycle
+ eligible canonical account-security state
+ exact-center active membership
+ machine role consultant
+ same-center active Staff employment
+ same-center active Staff-account-membership link
+ current capability/policy versions
+ exact assignment/resource scope
+ required MFA and fresh step-up
```

Thiếu hoặc stale bất kỳ dependency nào đều `DENY`; không có client fallback và active membership một mình không cấp toàn bộ read.

## 5. Staff — canonical account — membership linkage

Ba entity và link không được nhập làm một:

```text
staff_record
  staff_id
  center_id
  employment_status
  department
  position
  account_link_status
  employment_version

canonical_account
  canonical_user_id
  account_lifecycle_status
  account_security_control
  verified_login_methods

center_membership
  membership_id
  center_id
  canonical_user_id
  machine_role
  membership_status
  membership_version

staff_account_link
  staff_account_link_id
  center_id
  staff_id
  canonical_user_id
  membership_id
  link_status
  link_version
  linked_at
  unlinked_at
  reason_code
```

```text
STAFF_RECORD_IS_AUTH_ACCOUNT: NO
STAFF_ACCOUNT_LINK_IS_MEMBERSHIP: NO
STAFF_TERMINATION_AUTOMATICALLY_DELETES_ACCOUNT: NO
STAFF_UNLINK_WITHOUT_ACCESS_REEVALUATION_ALLOWED: NO
TWO_ACCOUNTS_CAN_LINK_SAME_STAFF: NO
ONE_ACCOUNT_CAN_LINK_TWO_STAFF_SAME_CENTER: NO
```

Link phải reference exact four-tuple `(center_id, staff_id, canonical_user_id, membership_id)`. Uniqueness là backstop integrity, không thay stable mutex/lock. Email, tên, số điện thoại hoặc department không phải link key và không được dùng để merge.

## 6. Provisioning modes và credential boundary

Các mutation độc lập dù UI tương lai có thể gom thành wizard:

```text
CREATE_NEW_CANONICAL_ACCOUNT
LINK_EXISTING_CANONICAL_ACCOUNT
ADD_CENTER_MEMBERSHIP
LINK_STAFF_RECORD
ACTIVATE_CONSULTANT_CAPABILITIES
```

`CREATE_NEW_CANONICAL_ACCOUNT` chỉ được mở production sau canonical lifecycle, exactly-one account-security control, forced first-change, safe one-time handoff, invalidation và saga/audit. `LINK_EXISTING_CANONICAL_ACCOUNT` dùng protected resolver chọn exact canonical user ID và không gọi Auth create.

```text
CONSULTANT_ACCOUNT_AUTO_LINK_BY_EMAIL_ALLOWED: NO
CONSULTANT_ACCOUNT_AUTO_CREATE_FROM_STAFF_EMAIL_ALLOWED: NO
CONSULTANT_LINK_TARGET_CLIENT_EMAIL_IS_AUTHORITY: NO
CONSULTANT_LOGIN_IDENTIFIER_INITIAL_RUNTIME: EMAIL
CONSULTANT_USERNAME_LOGIN_IMPLEMENTED: NO
CONSULTANT_PROVISIONING_MAY_CLAIM_USERNAME_SUPPORT: NO
TEMPORARY_PASSWORD_PRODUCTION_WITHOUT_FORCED_CHANGE_ALLOWED: NO
TEMPORARY_PASSWORD_PLAINTEXT_STORAGE_ALLOWED: NO
TEMPORARY_PASSWORD_LOGGING_ALLOWED: NO
```

Email Staff hay provider email chỉ có thể là masked display evidence sau protected lookup; server không auto-link hoặc auto-create theo email. Không quảng bá username login khi resolver chưa tồn tại.

Nếu phase sau tạo temporary credential, server sinh, chỉ hiển thị một lần, không log/lưu plaintext, có expiry, giữ account restricted, enforce forced change phía server và không để old session tồn tại. Khi forced-change canonical chưa có, production create-new bằng temporary password bị deny.

## 7. Canonical server capability resolver

Canonical contract:

```text
resolve_center_capability(
  canonical_user_id,
  center_id,
  capability,
  resource_type,
  resource_id,
  requested_action,
  request_context
)
```

Resolver đọc authoritative state:

```text
canonical account lifecycle
one canonical account-security/session-version source
exact active center membership and canonical machine role
same-center active Staff-account link and employment lifecycle
capability baseline policy and immutable deny policy
explicit allow/deny overrides with version and expiry
assignment scope and assignment version
resource center and resource classification
MFA assurance and resource-bound step-up assertion
center, policy, masking and current server-time versions
```

Output conceptual:

```text
decision
reason_code
effective_capability
data_projection
masking_policy
required_assurance
required_step_up
policy_version
resource_scope_version
```

```text
CONSULTANT_CAPABILITY_SERVER_DERIVED: YES
CONSULTANT_CAPABILITY_CLIENT_IS_AUTHORITY: NO
CONSULTANT_ROLE_LABEL_ALONE_GRANTS_CAPABILITY: NO
CONSULTANT_ACTIVE_MEMBERSHIP_ALONE_GRANTS_ALL_READ: NO
ACCOUNT_SECURITY_VERSION_CANONICAL_SOURCE_COUNT: EXACTLY_ONE
```

Evaluation order fail-closed:

1. Xác thực canonical account/session và exact server-derived center context.
2. Deny nếu account, security, membership, Staff link hoặc employment không eligible/current.
3. Deny immutable/non-grantable capability trước mọi override.
4. Áp exact-center, exact-capability explicit `DENY` trước baseline hoặc `ALLOW`.
5. Yêu cầu baseline allow hoặc exact, active, approved `ALLOW`.
6. Kiểm exact resource center, assigned scope và current assignment version.
7. Kiểm MFA/step-up, purpose, resource, action, session/security versions và server time.
8. Chọn minimal projection/masking; endpoint re-resolve hoặc consume purpose-bound assertion.

Decision không phải reusable bearer token. Endpoint không tin `role`, `capability`, `assigned`, `mfa`, `step_up` hoặc policy version do browser gửi.

## 8. Capability tiers và matrix

Các tier conceptual sau là policy bundle, không phải role mới và không phải client authority:

```text
CONSULTANT_BASE
CONSULTANT_ASSIGNED_CRM
CONSULTANT_CONTACT_REVEAL
CONSULTANT_PII_WRITE
CONSULTANT_SALES_SUMMARY
```

### 8.1 Baseline allow

| Capability | Scope/projection | Assurance |
|---|---|---|
| `crm.lead.read_assigned` | Exact center, assigned lead, masked projection | Active eligible session |
| `crm.lead.create` | Exact center, field allowlist; assignment set server-side | Active eligible session |
| `crm.lead.update_assigned` | Assigned lead, optimistic version, narrow fields | Active eligible session |
| `crm.care_log.read_assigned` | Care log thuộc assigned resource | Active eligible session |
| `crm.care_log.create_assigned` | Assigned resource, narrow schema | Active eligible session |
| `crm.appointment.read_assigned` | Assigned resource only | Active eligible session |
| `crm.appointment.create_assigned` | Assigned resource, field allowlist | Active eligible session |
| `crm.appointment.update_assigned` | Assigned resource, optimistic version | Active eligible session |
| `crm.enrollment_draft.create_assigned` | Draft only; no finalization | Active eligible session |
| `parent.basic.read_masked` | Assigned parent/lead, server-masked contact | Active eligible session |
| `student.basic.read_limited` | Assigned relation, limited projection | Active eligible session |
| `tuition.quote.read` | Approved quote/package summary | Active eligible session |
| `tuition.payment_status.read_limited` | Safe status only, no ledger | Active eligible session |
| `schedule.summary.read` | Assigned operational summary | Active eligible session |
| `report.sales_summary.read` | Approved aggregate, no raw contacts | Active eligible session |

### 8.2 Conditional, exact approval only

| Capability | Additional conditions |
|---|---|
| `parent.contact.reveal_full` | Assigned/approved queue resource, purpose, MFA, fresh resource-bound step-up, TTL, rate limit, audit |
| `parent.contact.update` | Assigned resource, MFA, field allowlist, version, masked audit |
| `crm.lead.reassign` | Approved assignment authority; consultant cannot self-claim by client claim |
| `crm.queue.read_unassigned` | Separate exact-center queue policy; default off |
| `crm.sales_summary.export_limited` | Explicit approval, aggregate allowlist and export controls |

### 8.3 Default deny and non-grantable boundary

| Domain | Denied capabilities |
|---|---|
| Parent/student | `parent.full_profile.read`, `student.full_profile.read`, `student.private_note.read`, `student.write` |
| Academic | `attendance.read_full`, `attendance.write`, `grade.read_full`, `grade.write` |
| Finance | `tuition.ledger.read_full`, `tuition.write`, `tuition.payment.write`, `cashflow.full.read`, `cashflow.write`, `financial.export_full` |
| Private HR | `staff.private_hr.read`, `staff.private_hr.download`, `staff.write`, `staff.salary.read`, `staff.document.read` |
| Authority | `account.manage`, `account.password_reset`, `permission.manage`, `role.manage`, `center.manage`, `platform.manage`, `acting.start` |
| Storage/security | `storage.private.read`, `storage.private.delete`, `audit.security.read` |

Private HR, full finance, account, permission, role, center, platform, Acting, private storage và raw security audit là immutable consultant deny; override không cấp được.

```text
CONSULTANT_DEFAULT_DENY_PRIVATE_HR: YES
CONSULTANT_DEFAULT_DENY_FULL_CASHFLOW: YES
CONSULTANT_DEFAULT_DENY_ACCOUNT_MANAGEMENT: YES
CONSULTANT_DEFAULT_DENY_PERMISSION_MANAGEMENT: YES
CONSULTANT_DEFAULT_DENY_PLATFORM_AUTHORITY: YES
```

## 9. Assignment scope và concurrency

Canonical assignment model:

```text
consultant_resource_assignment
  assignment_id
  center_id
  resource_type
  resource_id
  consultant_user_id
  consultant_membership_id
  assignment_status
  assignment_version
  assigned_at
  unassigned_at
  assigned_by_user_id
  reason_code
```

Status: `ACTIVE`, `REASSIGNED`, `UNASSIGNED`, `SUSPENDED`, `CLOSED`. Lead, parent, student, appointment và care log phải nối về exact business-resource root cùng center; care log không tự mở rộng scope ngoài resource được assign. `crm.queue.read_unassigned` là capability riêng, default deny. Client không tự thêm assignment.

```text
EMPTY_CONSULTANT_ASSIGNMENT_SET_PROVIDES_SERIALIZATION: NO
CONSULTANT_ASSIGNMENT_UNIQUENESS_REPLACES_RESOURCE_MUTEX: NO
TWO_CONSULTANTS_CAN_OWN_EXCLUSIVE_ASSIGNMENT: NO
STALE_ASSIGNMENT_CAN_GRANT_RESOURCE_ACCESS: NO
```

Claim/reassign exclusive resource phải khóa stable resource-access root, khóa current assignment rows theo stable ID, re-read assignment version, áp đúng một transition, bump version, append audit/outbox rồi commit atomic trong database. Empty set và uniqueness constraint không tạo mutex. Care-log write cạnh tranh với reassign phải khóa cùng resource root; writer bị deny nếu assignment đổi trước commit.

## 10. Data classification và server-side masking

```text
PUBLIC_OPERATIONAL
CENTER_INTERNAL
CONTACT_PII_MASKED
CONTACT_PII_FULL
SENSITIVE_STUDENT
FINANCIAL_LIMITED
FINANCIAL_PRIVATE
PRIVATE_HR
SECURITY_ADMIN
```

Baseline response là minimal projection tạo ở trusted server boundary:

- Phone masked theo approved canonical format, ví dụ `090***123`.
- Email masked theo approved canonical format, ví dụ `n***@example-domain`.
- Address chỉ trả khu vực/quận hoặc coarse description cần thiết.
- Date of birth chỉ trả age band hoặc year khi có business need.
- Không trả national ID, bank, salary, medical, HR document, internal account-security data, private tuition ledger hay raw security audit.

```text
CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: YES
CONSULTANT_CLIENT_SIDE_MASKING_ONLY_ALLOWED: NO
MASKED_CAPABILITY_RESPONSE_MAY_CONTAIN_RAW_FIELD: NO
```

Server không gửi raw PII rồi nhờ JavaScript che. Projection, serialization, logs, traces, cache, audit và error đều phải giữ classification boundary.

## 11. Full-contact reveal và PII write

### 11.1 Full-contact reveal

`parent.contact.reveal_full` yêu cầu exact assigned resource hoặc approved queue scope, declared purpose, eligible membership/employment, consultant MFA policy met, fresh F23.13C step-up bind exact account/session/center/action/resource, short TTL, single-resource response, audit và rate limit.

```text
CONSULTANT_FULL_CONTACT_REVEAL_REQUIRES_STEP_UP: YES
CONSULTANT_FULL_CONTACT_REVEAL_BULK_ALLOWED: NO
CONSULTANT_FULL_CONTACT_REVEAL_DEFAULT_TTL_MINUTES: 5
```

Step-up assertion được consume theo F23.13C cross-domain order: exact business-resource root trước account-security/assertion locks khi có composite mutation. Response dùng `no-store`, không persistent client cache, không cross-account reuse và không biến reveal thành bulk export.

### 11.2 Contact/PII write

```text
CONSULTANT_PII_WRITE_MFA_REQUIRED: YES
```

`parent.contact.update` chỉ cho assigned resource và exact field allowlist: `phone`, `email`, `preferred_contact_method`, `contact_note_limited`. Server kiểm optimistic version; audit old/new values ở dạng masked, không nhận arbitrary JSON.

Account identity email, password, role, membership, Staff link, financial ledger và private student note luôn deny. Contact update không được gọi Auth identity mutation.

## 12. Tuition và enrollment boundary

`tuition.quote.read` và `tuition.payment_status.read_limited` chỉ trả approved quote/package summary cùng safe status: chưa thanh toán, một phần, đã thanh toán hoặc overdue. Không trả full ledger, payment evidence, cashflow detail, bank/reference data, internal adjustment, margin hoặc transaction attachment.

```text
CONSULTANT_TUITION_LEDGER_FULL_READ_ALLOWED: NO
CONSULTANT_PAYMENT_WRITE_ALLOWED: NO
CONSULTANT_CASHFLOW_ACCESS_ALLOWED: NO
```

`crm.enrollment_draft.create_assigned` chỉ tạo draft. Draft không tạo canonical student/membership, không thu tiền, activate package, ghi attendance hoặc finalize enrollment.

```text
CONSULTANT_ENROLLMENT_DRAFT_AUTO_FINALIZES_STUDENT: NO
```

## 13. Explicit capability override

Conceptual model:

```text
center_capability_override
  override_id
  center_id
  canonical_user_id
  membership_id
  capability
  effect
  resource_scope
  reason_code
  starts_at
  expires_at
  status
  override_version
  requested_by_user_id
  approved_by_user_id
  created_at
  updated_at
```

```text
EXPLICIT_DENY_PRECEDES_ALLOW: YES
CAPABILITY_OVERRIDE_WILDCARD_ALLOWED: NO
CLIENT_SUPPLIED_CAPABILITY_OVERRIDE_ALLOWED: NO
EXPIRED_OVERRIDE_GRANTS_ACCESS: NO
CONSULTANT_CAN_SELF_GRANT_CAPABILITY: NO
CONSULTANT_TARGET_CAN_SELF_APPROVE_OVERRIDE: NO
CENTER_ADMIN_CAN_OVERRIDE_CONSULTANT_TO_PLATFORM_CAPABILITY: NO
```

Override bind exact center, account, membership và capability; optional scope phải exact resource/class, có reason, start/expiry, version, requester, approver, MFA/step-up và audit. `DENY` thắng `ALLOW`; expiry và policy version dùng server time. ALLOW không bypass lifecycle, Staff termination, membership, assignment, MFA hoặc immutable deny.

Owner có thể request/approve standard override theo separation policy. Center Admin chỉ request low-risk và không self-approve sensitive escalation. Consultant không self-grant. Conflict/high-risk cần protected central security review.

## 14. Stable roots và canonical lock order

Mỗi center có đúng một pre-existing root:

```text
center_access_control
  center_id
  access_control_version
  consultant_policy_version
  updated_at
```

```text
CENTER_ACCESS_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
CONSULTANT_PROVISIONING_LOCK_TARGET: CENTER_ACCESS_CONTROL_ROW
EMPTY_MEMBERSHIP_SET_PROVIDES_PROVISIONING_SERIALIZATION: NO
EMPTY_STAFF_ACCOUNT_LINK_SET_PROVIDES_SERIALIZATION: NO
```

Missing/duplicate center root fail closed với `consultant_provisioning_conflict`; implementation bootstrap control row phải là phase riêng. Capability/provisioning mutex không được đặt trên empty membership/link set.

`account_bootstrap_reservation` serialize một request nhưng không phải mutex chung cho hai reservation/center/Staff khác nhau cùng login identity hoặc canonical Auth user. Create-new phải có environment-scoped global bootstrap identity mutex trước mọi center root.

```text
ACCOUNT_BOOTSTRAP_RESERVATION_ALONE_SERIALIZES_ALL_MATCHING_IDENTITIES: NO
UNIQUE_ACCOUNT_REGISTRATION_REPLACES_GLOBAL_BOOTSTRAP_MUTEX: NO
```

Canonical composite order cho consultant provisioning/access mutation:

```text
0. LOGIN_BOOTSTRAP_IDENTITY_MUTEX hoặc CANONICAL_USER_BOOTSTRAP_MUTEX
1. CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id
2. BUSINESS_RESOURCE_ROOT_ROWS, theo stable resource type + resource ID
3. ACCOUNT_BOOTSTRAP_RESERVATION_ROWS, theo stable reservation_id
4. ACCOUNT_SECURITY_CONTROL_ROWS, accounts theo sorted canonical_user_id
5. STAFF_ROWS, theo stable staff_id
6. MEMBERSHIP_AND_STAFF_ACCOUNT_LINK_ROWS
7. CAPABILITY_OVERRIDE_AND_POLICY_ROWS
8. CONSULTANT_RESOURCE_ASSIGNMENT_ROWS
9. SESSION_INVALIDATION_ROWS
10. AUDIT_OUTBOX_ROWS
```

```text
CONSULTANT_ACCESS_LOCK_ORDER_DEFINED: YES
CENTER_ACCESS_ROOT_PRECEDES_ACCOUNT_SECURITY_LOCK: YES
CONSULTANT_ACCESS_LOCK_ORDER_INVERSION_ALLOWED: NO
CENTER_AND_RESOURCE_ROOT_COMPOSITE_ORDER_DEFINED: YES
CENTER_ACCESS_ROOT_PRECEDES_BUSINESS_RESOURCE_ROOT: YES
BUSINESS_RESOURCE_ROOT_PRECEDES_ACCOUNT_SECURITY_LOCK: YES
CENTER_RESOURCE_LOCK_ORDER_INVERSION_ALLOWED: NO
LOGIN_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ACCESS_ROOT: YES
CANONICAL_USER_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ROOTS: YES
BOOTSTRAP_GLOBAL_TO_CENTER_LOCK_INVERSION_ALLOWED: NO
```

Operation chỉ cần resource root không lấy center root vô ích. Khi global bootstrap identity, center policy/provisioning state và business resource cùng tham gia, global mutex đứng trước sorted center roots; center roots đứng trước sorted resource roots; resource roots đứng trước sorted reservations/account-security. Không lấy center/resource/reservation rồi quay lại chờ global mutex. Không gọi Auth, notification hoặc chờ reviewer khi giữ DB lock. Identity/factor child projection, nếu có, phải reference cùng canonical `ACCOUNT_SECURITY_CONTROL_ROW`; không tạo nguồn security/session version thứ hai.

Không giữ login-key mutex và canonical-user mutex cùng lúc nếu chưa có implementation design riêng chứng minh không cycle. Recommended handoff: commit pre-Auth reservation → release login-key transaction locks → external Auth call/reconcile → transaction mới acquire canonical-user mutex.

## 15. Provisioning lifecycle

Chỉ `ACTIVE` cùng toàn bộ dependency current mới cấp consultant authority.

| State | Authority và actor | Idempotency, expiry, retry | Terminal | External effect / compensation | Audit và session impact |
|---|---|---|---|---|---|
| `NOT_PROVISIONED` | Không authority; system projection | Không request; retry bằng request mới | Không | Không external effect | Không session; history giữ nguyên |
| `PROVISION_REQUESTED` | Không authority; authorized Owner/Admin | Idempotency key bắt buộc; request có expiry; safe retry | Không | Chưa gọi Auth; cancel reservation nếu hết hạn | `consultant.provision_requested`; không session |
| `ACCOUNT_RESOLUTION_PENDING` | Không authority; protected resolver | Same key/result; short expiry; retry lookup | Không | Không link theo email; release reservation khi fail | Safe account-resolution audit; không session |
| `AUTH_ACCOUNT_CREATION_PENDING` | Không authority; saga worker | One request/one reservation; lease expiry; idempotent retry | Không | Auth call ngoài DB lock; reconcile uncertain result | Pending/outbox audit; không session |
| `AUTH_ACCOUNT_CREATED_RESTRICTED` | Không authority; saga worker | Persist canonical Auth ID; retry finalize | Không | Account restricted/disabled; protected compensation nếu finalize fail | Creation audit không credential; invalidate unexpected session |
| `MEMBERSHIP_PENDING` | Không authority; DB transaction | Versioned retry under center/account roots | Không | No second Auth create; compensation keeps account restricted | Membership audit/outbox; no authorized session |
| `STAFF_LINK_PENDING` | Không authority; DB transaction | Exact tuple/version; conflict fail closed | Không | Release/terminalize reservation on conflict | Link audit; no authorized session |
| `CAPABILITY_POLICY_PENDING` | Không authority; policy service | Exact baseline version; retry after policy readiness | Không | No activation until policy exists | Policy audit/version; no authorized session |
| `ACTIVE` | Effective authority only after resolver pass; system activates | Reconcile idempotently; no client activation | Không | Notification via outbox after commit | Activation audit; bump security/membership/policy versions |
| `SUSPENDED` | No new consultant authority; authorized ops/system | Versioned, reasoned; explicit resume flow | Không | Keep account/history; reassign by policy | Suspend audit; invalidate sessions/assertions/cache |
| `REVOKED` | No consultant authority; authorized ops | Repeated revoke is idempotent | Có cho membership authority | Keep canonical account for other valid scope | Revoke audit; invalidate affected sessions |
| `TERMINATED` | No consultant authority; employment lifecycle | Idempotent terminal transition | Có cho employment relationship | Never hard-delete account; protected reassignment | Termination audit; immediate invalidation |
| `CONFLICT` | No authority; protected reviewer | Retry only after conflict resolution/version change | Có cho request attempt | No automatic merge/relink/role overwrite | Conflict audit; no session |
| `COMPENSATION_REQUIRED` | No authority; central protected ops | Idempotent compensator with manual-review lease | Không đến khi resolved | Keep Auth account restricted; never compensate another account | Critical audit/alert; invalidate sessions |
| `FAILED` | No authority; system/protected ops | Terminal failure; new request needs new approved key | Có | Preserve history; no hard-delete rollback | Failure audit; no session |

Every transition records actor, authority basis, idempotency key, server time, versions, retry/terminal state, external side effect, compensation status, safe audit and session impact.

## 16. Preflight và protected provisioning protocols

### 16.1 Preflight

Server preflight kiểm exact center/caller, exactly-one center root, same-center Staff, active employment, link conflicts, existing-account lifecycle, membership/role conflicts, one-center rollout, baseline policy, MFA/security eligibility, idempotency, audit/outbox readiness, broad-RLS write blocker và complete read-path inventory/remediation blocker. Design completion không chứng minh preflight runtime tồn tại.

### 16.2 Create-new saga across Auth and database

```text
AUTH_AND_DATABASE_CROSS_SYSTEM_ATOMIC_TRANSACTION_EXISTS: NO
CONSULTANT_PROVISIONING_REQUIRES_SAGA_OR_RESERVATION: YES
NEW_ACCOUNT_BOOTSTRAP_LOCKS_NONEXISTENT_ACCOUNT_SECURITY_ROW: NO
EMPTY_ACCOUNT_SECURITY_CONTROL_SET_PROVIDES_SERIALIZATION: NO
ACCOUNT_SECURITY_UNIQUE_INDEX_REPLACES_BOOTSTRAP_MUTEX: NO
```

Account mới chưa có `canonical_user_id` hoặc `ACCOUNT_SECURITY_CONTROL_ROW` trước khi Auth create hoàn tất. Vì vậy create-new không lấy lock trên nonexistent/empty account-security set. Reservation là stable request root nhưng không serialize reservation khác.

Stable mutex identity và mutable ceremony envelope là hai lớp độc lập:

```text
mutex identity = ai đang cạnh tranh cùng account/login identity
ceremony versions = ceremony nào còn được phép tiếp tục
```

```text
BOOTSTRAP_MUTEX_IDENTITY_SEPARATE_FROM_CEREMONY_VERSION_BINDING: YES
MUTABLE_PROVIDER_CONFIG_VERSION_MAY_FRAGMENT_CANONICAL_USER_MUTEX: NO
MUTABLE_NORMALIZATION_VERSION_MAY_CREATE_PARALLEL_IDENTITY_MUTEX: NO
```

`auth_account_realm_id` là stable canonical account namespace nơi `canonical_auth_user_id` unique. Realm ID scoped đúng environment/tenant, ổn định qua provider-config deployment, không phải login method, provider client ID hay secret; thêm Google identity hoặc rotate email/password config không đổi realm. Đổi realm là security migration riêng, không phải config update thường.

```text
AUTH_ACCOUNT_REALM_ID_STABLE_ACROSS_PROVIDER_CONFIG_ROTATION: YES
AUTH_ACCOUNT_REALM_ID_IS_LOGIN_METHOD: NO
AUTH_ACCOUNT_REALM_ID_IS_PROVIDER_CLIENT_ID: NO
```

Mọi create-new request derive environment-scoped stable identity keys:

```text
LOGIN_BOOTSTRAP_MUTEX_FORMULA_BEGIN
login_bootstrap_mutex_key =
  versioned_digest(
    bootstrap_mutex_key_version,
    environment_fingerprint,
    auth_account_realm_id,
    stable_login_identifier_kind,
    canonical_login_identifier_digest
  )
LOGIN_BOOTSTRAP_MUTEX_FORMULA_END

CANONICAL_USER_BOOTSTRAP_MUTEX_FORMULA_BEGIN
canonical_user_bootstrap_mutex_key =
  versioned_digest(
    bootstrap_mutex_key_version,
    environment_fingerprint,
    auth_account_realm_id,
    canonical_auth_user_id
  )
CANONICAL_USER_BOOTSTRAP_MUTEX_FORMULA_END
```

Rollout đầu dùng stable login identifier kind `EMAIL`. Kind chỉ phân biệt stable account-creation identifier class, không phải login method/provider configuration. Canonical-user key tuyệt đối không chứa login method, `auth_provider`, provider client ID, config version hoặc normalization version. Hai reservations có cùng `(environment_fingerprint, auth_account_realm_id, canonical_auth_user_id)` tranh đúng một mutex dù ceremony thuộc config version khác nhau.

```text
LOGIN_BOOTSTRAP_IDENTITY_MUTEX_REQUIRED: YES
CANONICAL_USER_BOOTSTRAP_MUTEX_REQUIRED: YES
BOOTSTRAP_IDENTITY_MUTEX_SCOPED_TO_ENVIRONMENT: YES
RAW_LOGIN_IDENTIFIER_USED_AS_MUTEX_OR_LOG_VALUE: NO
ONE_ACTIVE_BOOTSTRAP_RESERVATION_PER_LOGIN_IDENTITY_KEY: YES
CANONICAL_USER_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: YES
CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_METHOD: YES
CANONICAL_USER_MUTEX_EXCLUDES_LOGIN_NORMALIZATION_VERSION: YES
LOGIN_BOOTSTRAP_MUTEX_EXCLUDES_MUTABLE_PROVIDER_CONFIG_VERSION: YES
LOGIN_BOOTSTRAP_MUTEX_USES_STABLE_ACCOUNT_REALM: YES
BOOTSTRAP_CEREMONY_BINDS_PROVIDER_CONFIG_VERSION: YES
BOOTSTRAP_CEREMONY_BINDS_NORMALIZATION_VERSION: YES
BOOTSTRAP_IDENTITY_CONFIG_DRIFT_FAILS_CLOSED: YES
SAME_IDENTITY_ACROSS_PROVIDER_CONFIG_VERSIONS_SHARES_MUTEX: YES
STALE_CEREMONY_MAY_BYPASS_STABLE_IDENTITY_MUTEX: NO
```

Không persist/log raw normalized identifier, raw email, credential hoặc provider payload làm mutex/audit authority. Stable keys chỉ lưu versioned digest của stable identity inputs. `provider_config_version`, `login_identifier_normalization_version`, `ceremony_contract_version` và `environment_fingerprint` vẫn bind vào reservation/ceremony envelope để drift re-check; mutable version không tự sinh namespace mutex mới. Login key chỉ serialize account-creation ceremony; nó không chứng minh ownership, canonical link target hoặc quyền auto-link.

Implementation tương lai có thể dùng stable registry/control row hoặc transaction-scoped advisory mutex với collision-safe, versioned namespace. Exact mechanism cần SQL/security review riêng; uniqueness chỉ là integrity backstop.

Stable request reservation model:

```text
account_bootstrap_reservation
  reservation_id
  environment_fingerprint
  center_id
  staff_id
  provisioning_request_id
  provisioning_mode
  bootstrap_mutex_key_version
  auth_account_realm_id
  stable_login_identifier_kind
  canonical_login_identifier_digest
  auth_provider
  provider_config_version
  login_identifier_normalization_version
  ceremony_contract_version
  login_bootstrap_mutex_key
  canonical_user_bootstrap_mutex_key
  status
  reservation_version
  idempotency_key
  created_at
  expires_at
  auth_user_id
  finalized_at
  cancelled_at
```

Reservation status:

```text
RESERVED
AUTH_CREATE_PENDING
AUTH_CREATED_RESTRICTED
FINALIZING
FINALIZED
COMPENSATION_REQUIRED
CANCELLED
EXPIRED
FAILED
```

```text
ACCOUNT_BOOTSTRAP_RESERVATION_REQUIRED_BEFORE_AUTH_CREATE: YES
ACCOUNT_BOOTSTRAP_RESERVATION_GRANTS_AUTHORITY: NO
ONE_AUTH_CREATE_ATTEMPT_PER_ACTIVE_BOOTSTRAP_RESERVATION: YES
```

Reservation không cấp account, membership, role, capability hoặc session authority. Mọi request cùng login identity key acquire cùng login-bootstrap mutex, inspect active reservation rồi trả exact idempotent prior outcome hoặc safe `consultant_provisioning_conflict`. Chỉ một reservation được `AUTH_CREATE_PENDING`; request còn lại không gọi Auth, không auto-link theo email và không lộ Staff/center của reservation hiện hữu.

Unique constraints trên identity-key registry, reservation, canonical registration và account-security control vẫn bắt buộc nhưng chỉ là integrity backstop, không thay global mutex/idempotency protocol.

Normalization-version rollout có thể làm cùng logical identifier sinh old/new canonical digests. Version mới không được nhận traffic song song bằng một key mới khi V1 còn active:

```text
LOGIN_NORMALIZATION_ROTATION_REQUIRES_BARRIER: YES
NORMALIZATION_ROTATION_WITHOUT_DRAIN_OR_DUAL_KEY_LOCK_ALLOWED: NO
OLD_AND_NEW_NORMALIZATION_RESERVATIONS_MAY_CALL_AUTH_CONCURRENTLY: NO
```

Approved rotation chọn đúng một protocol:

- **Drain/expire barrier:** block create-new cho realm; drain/complete/expire mọi active reservation; verify không còn Auth-create lease; migrate alias/index evidence nếu cần; activate normalizer mới; rồi mới reopen traffic.
- **Dual-key/alias migration:** derive old/new canonical identity keys; acquire cả hai theo deterministic sorted order; resolve stable identity registry/alias equivalence; enforce one active reservation trên toàn equivalence class; chỉ release old key khi migration hoàn tất; audit và rollback plan bắt buộc.

Thiếu approved barrier/migration contract thì fail closed và không bật normalizer mới. Provider-config rotation cũng không đổi stable mutex identity cho cùng account realm: ceremony V1/V2 vẫn tranh cùng login/canonical-user mutex. Ceremony cũ bind exact config version và có thể bị deny/expire/restart theo policy, nhưng không âm thầm dùng config mới. Nếu V1/V2 overlap, one-live reservation và one-Auth-create invariant vẫn giữ.

Một stale ceremony vẫn acquire stable identity mutex trước khi mutate/reconcile shared state; drift denial không được dùng để bypass mutex.

Pre-Auth reservation transaction lấy lock theo thứ tự:

```text
ACCOUNT_BOOTSTRAP_RESERVATION_LOCK_ORDER_BEGIN
0. LOGIN_BOOTSTRAP_IDENTITY_MUTEX
1. CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id
2. BUSINESS_RESOURCE_ROOT_ROWS, khi cần, theo stable type + ID
3. ACCOUNT_BOOTSTRAP_RESERVATION_ROW
4. STAFF_ROWS, theo stable staff_id
5. STAFF_ACCOUNT_LINK_INTENT_ROWS
6. AUDIT_OUTBOX_ROWS
ACCOUNT_BOOTSTRAP_RESERVATION_LOCK_ORDER_END
```

Protected saga:

1. Tạo versioned provisioning request/idempotency record.
2. Trong DB transaction, khóa login-bootstrap identity mutex → sorted center roots → resource roots nếu cần → bootstrap reservation → Staff → Staff-link intent → audit/outbox; inspect one-live policy, reserve exact Staff/login-digest intent rồi commit.
3. Gọi Auth create **ngoài mọi DB lock**; account do Auth tạo phải ở restricted/disabled lifecycle.
4. Reconcile uncertain Auth result bằng exact reservation, idempotency key và provider evidence; không blind retry tạo account thứ hai.
5. Release login-key transaction locks; sau khi có exact `canonical_user_id`, transaction mới acquire canonical-user bootstrap mutex và chạy atomic bootstrap finalize bên dưới.
6. Chỉ sau bootstrap `FINALIZED` mới chạy membership/Staff-link/baseline-policy transaction.
7. Activate sau resolver xác nhận mọi dependency; notification/handoff chạy qua outbox.

Pending ceremony bind exact `environment_fingerprint`, `auth_provider`, `provider_config_version`, `login_identifier_normalization_version`, `ceremony_contract_version` và stable key-namespace version. Nếu normalization/provider/config/environment/contract drift trước Auth hoặc finalize, ceremony vẫn tranh stable identity mutex rồi deny/expire reservation và yêu cầu reviewed ceremony mới; không âm thầm tính mutex key mới hoặc tiếp tục ceremony cũ.

Atomic canonical account/security-control registration:

```text
ACCOUNT_BOOTSTRAP_FINALIZE_ATOMIC_BEGIN
0. LOCK exact CANONICAL_USER_BOOTSTRAP_MUTEX
1. LOCK affected CENTER_ACCESS_CONTROL_ROWS, theo sorted center_id
2. LOCK BUSINESS_RESOURCE_ROOT_ROWS khi cần, theo stable type + ID
3. LOCK ACCOUNT_BOOTSTRAP_RESERVATION_ROWS, theo stable reservation_id
4. RECHECK all reservations, Staff, environment/provider/config/normalization/ceremony versions, stable realm, idempotency and exact Auth result
5. VERIFY exact canonical Auth user binding
6. VERIFY no canonical registration or RECONCILE exact prior idempotent result
7. CREATE canonical account registration for exact canonical_user_id when absent
8. CREATE exactly one ACCOUNT_SECURITY_CONTROL_ROW when absent
9. BIND approved reservation/request and TERMINALIZE all conflicting reservations for exact canonical_user_id
10. INITIALIZE account security, session and control versions
11. APPEND audit/outbox
12. COMMIT database transaction atomically
ACCOUNT_BOOTSTRAP_FINALIZE_ATOMIC_END
```

```text
CANONICAL_ACCOUNT_AND_SECURITY_CONTROL_REGISTER_ATOMICALLY: YES
ACCOUNT_SECURITY_CONTROL_CREATED_EXACTLY_ONCE_PER_CANONICAL_ACCOUNT: YES
ACCOUNT_BOOTSTRAP_FINALIZE_BINDS_EXACT_AUTH_USER_ID: YES
ACCOUNT_BOOTSTRAP_FINALIZE_CLIENT_EMAIL_IS_AUTHORITY: NO
AUTH_USER_WITHOUT_FINALIZED_ACCOUNT_SECURITY_CONTROL_GETS_AUTHORITY: NO
CANONICAL_USER_BOOTSTRAP_MUTEX_PRECEDES_CENTER_ROOTS: YES
DIFFERENT_RESERVATIONS_FOR_SAME_AUTH_USER_SHARE_ONE_MUTEX: YES
TWO_RESERVATIONS_CAN_FINALIZE_ONE_AUTH_USER_CONCURRENTLY: NO
```

Hai finalize workers của cùng reservation serialize bằng exact reservation row/idempotency và nhận một outcome. Hai reservation khác nhau resolve cùng canonical Auth user serialize bằng cùng canonical-user bootstrap mutex: chỉ một canonical registration/control; reservation sau reconcile exact committed outcome nếu cùng approved operation hoặc chuyển conflict/compensation review. Không tự tạo membership/capability và không auto-link email.

Nếu canonical registration hoặc control creation fail, toàn bộ database finalize rollback; Auth account giữ restricted/disabled; reservation giữ retryable hoặc chuyển `COMPENSATION_REQUIRED`. Không tạo membership, Staff link, capability authority hay partial account-security state. Protected retry dùng cùng idempotency key; compensation bind exact request + reservation + Auth user ID. Compensation fail cần manual review, không hard-delete history và không tuyên bố rollback atomic giả.

### 16.3 Final consultant access provisioning và activation

Membership, Staff link và consultant baseline policy chỉ được finalize sau khi:

```text
canonical account registration exists
+ exactly-one ACCOUNT_SECURITY_CONTROL_ROW exists
+ account bootstrap reservation is FINALIZED
+ account lifecycle is restricted/eligible for next transition
```

Access-provisioning transaction re-lock center root → existing account-security control → Staff → membership/link → policy → session/invalidation → audit/outbox. Activation resolver deny `consultant_provisioning_pending` khi reservation, registration hoặc account-security bootstrap pending/inconsistent. Account/control creation luôn đứng trước membership, Staff link và capability policy; membership transaction không được tự bootstrap account-security.

### 16.4 Link-existing database transaction

Protected resolver chọn exact `canonical_user_id`; email chỉ là masked evidence. Không gọi Auth create. Một DB transaction lấy center root → account-security → Staff → membership/link → policy → invalidation → audit/outbox; re-check lifecycle, exact same-center scope, one-center rollout, MFA/security, conflicting link và incompatible role trước commit.

Same account + same center + consultant role được idempotent reconcile exact versions. Another role không silent overwrite và trả `consultant_membership_role_conflict`. Another center bị deny trong rollout đầu. Staff đã link account khác hoặc account đã link Staff khác cùng center đều conflict, không auto merge/relink.

## 17. Suspend, revoke, termination, unlink và session invalidation

Suspend block action mới, giữ history/account, transition assignment theo policy và invalidate session/assertion. Revoke terminalize consultant membership/capabilities nhưng giữ Staff và canonical account nếu account còn legitimate role/scope khác.

```text
CONSULTANT_TERMINATION_BLOCKS_EFFECTIVE_CAPABILITIES: YES
CONSULTANT_TERMINATION_INVALIDATES_SESSIONS: YES
CONSULTANT_TERMINATION_HARD_DELETES_ACCOUNT: NO
TERMINATED_CONSULTANT_SESSION_REMAINS_AUTHORIZED: NO
```

Employment termination phải kích hoạt server-side reevaluation, immediate effective deny, assignment handoff và invalidation. Runtime hiện chưa có integration này nên implementation tiếp tục blocked. Staff unlink phải revoke/suspend membership hoặc fail unlink, reassign open resources, bump versions, invalidate và audit; không để active consultant authority mồ côi.

Các event bắt buộc bump version/invalidate:

- activate, suspend, revoke, terminate, Staff unlink và role transition;
- override add/remove/expire và baseline policy change;
- assignment change, resource close và masking policy change;
- account lifecycle, MFA/security hoặc center policy change.

Old JWT, cached UI/module state, localStorage hoặc previously revealed PII không thắng current server decision. Invalidation delivery fail giữ effective deny bằng current server versions, retry outbox và báo `security_service_unavailable`; không fail open.

## 18. Server access architecture

### 18.1 Fail-closed consultant read boundary

```text
CONSULTANT_GENERIC_ENTITY_READ_PATH_ENABLED: NO
CONSULTANT_GENERIC_CLOUD_READ_BYPASSES_CAPABILITY_PROJECTION_ALLOWED: NO
CONSULTANT_GENERIC_READ_REQUIRES_CAPABILITY_AWARE_PROJECTION: YES
CONSULTANT_RUNTIME_REQUIRES_COMPLETE_READ_PATH_INVENTORY: YES
CONSULTANT_CLIENT_FILTERS_CENTER_WIDE_READ_ALLOWED: NO
CONSULTANT_CLIENT_FILTERS_ASSIGNED_RESOURCE_READ_ALLOWED: NO
MASKED_ENDPOINT_MAY_FETCH_RAW_GENERIC_RESULT_IN_BROWSER: NO
F23_13D_GENERIC_READ_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES
```

Mọi consultant read chỉ được đi qua một trong các reviewed authority boundary:

```text
purpose-specific protected endpoint
capability-aware RPC/function
capability-aware minimal projection
narrow reviewed RLS projection
```

Mỗi read request resolve lại canonical account lifecycle, exact-center membership/machine role, active same-center Staff link/employment, capability + immutable deny, assignment + resource center, projection/masking policy, required MFA/step-up, policy version và assignment version. Masking/minimal projection hoàn tất trước response rời trusted boundary.

Generic cloud/entity/table `SELECT` không được trả raw/full/center-wide records để browser tự lọc. Không tải full record rồi mask bằng JavaScript, không client-filter assigned resources, không dùng hidden module/route guard làm read authorization và không tái dùng generic read decision như bearer authority. Nếu generic infrastructure được reuse bên trong trusted server boundary, nó vẫn phải nằm sau exact capability decision và chỉ serialize exact minimal projection; raw result không được tới browser.

Trước consultant runtime phải inventory và review đầy đủ:

- direct table `SELECT` và generic cloud entity read;
- realtime subscriptions/change payloads;
- RPC/functions và purpose-specific endpoints;
- cache hydration/invalidation và server-to-client state restore;
- search, report, bulk/export/download;
- signed URL, attachment metadata và storage projections;
- error, debug, trace và observability payloads;
- local persistence được hydrate/restore từ server data.

Bất kỳ path chưa xác định hoặc trả ngoài exact capability-aware projection đều là **implementation blocker** và fail closed. F23.13D không khẳng định broad `SELECT` RLS đang tồn tại khi chưa có repo evidence về exact policy command; production gate là audit mọi SELECT/read path, narrow/remediate path không đạt contract và chạy direct-API/realtime/export/cache tests.

### 18.2 Narrow consultant writes

Writes chỉ qua narrow capability-aware server operation như:

```text
crm.lead.create
crm.lead.update_assigned
crm.care_log.create_assigned
crm.appointment.create_assigned
crm.appointment.update_assigned
```

Mỗi operation re-resolve capability, exact center, assignment, field allowlist, version, assurance và audit/outbox. Browser role/capability không phải authority.

```text
CONSULTANT_GENERIC_ENTITY_WRITE_PATH_ENABLED: NO
```

Không có generic arbitrary `entityType + payload` write cho consultant. Broad active-member write policy trên `center_cloud_entities` phải được remediate trước consultant runtime; UI-only guard không thể thay RLS/server enforcement.

## 19. Safe errors, audit và abuse protection

Safe outward codes:

```text
consultant_access_denied
consultant_center_scope_denied
consultant_assignment_required
consultant_assignment_conflict
consultant_capability_not_granted
consultant_capability_expired
consultant_step_up_required
consultant_mfa_policy_not_met
consultant_contact_reveal_denied
consultant_resource_not_available
consultant_membership_role_conflict
consultant_staff_link_conflict
consultant_account_lifecycle_blocked
consultant_employment_inactive
consultant_provisioning_pending
consultant_provisioning_conflict
consultant_provisioning_compensation_required
consultant_policy_stale
security_service_unavailable
rate_limit_exceeded
```

Error không lộ target email, membership/assignee center khác, private Staff state, full contact, SQL/RLS detail, raw Auth error, stack, secret hoặc temporary credential.

Minimum audit events:

```text
consultant.provision_requested
consultant.account_bootstrap_reserved
consultant.account_resolved
consultant.auth_account_created_restricted
consultant.account_security_registered
consultant.membership_created
consultant.staff_linked
consultant.activated
consultant.suspended
consultant.revoked
consultant.terminated
consultant.staff_unlinked
consultant.capability_granted
consultant.capability_denied
consultant.override_requested
consultant.override_approved
consultant.override_revoked
consultant.assignment_created
consultant.assignment_reassigned
consultant.contact_revealed
consultant.pii_updated
consultant.access_denied
consultant.session_invalidated
consultant.compensation_required
```

Audit chỉ chứa opaque IDs, exact center, capability, resource class, safe reason/outcome, versions và request/idempotency; không chứa raw phone/email, credential hoặc full payload. Audit/outbox failure làm mutation fail/rollback trong DB transaction hoặc giữ saga pending; không tạo unaudited authority.

Rate-limit bucket tách cho provisioning, account resolution, reveal, PII update, lead/care-log write, assignment, override, export và repeated deny. Default deny bulk contact/export; phát hiện sequential reveal, scraping, masked-to-full enumeration, center/resource probing và retry abuse.

## 20. Canonical negative matrix D-N1–D-N49

| ID | Tình huống | Exact fail-closed outcome |
|---|---|---|
| D-N1 | Hai provisioning requests cùng Staff | Center/Staff reservation serialize; một request tiến, request còn lại idempotent same intent hoặc `consultant_provisioning_conflict`; không duplicate authority. |
| D-N2 | Hai accounts đồng thời link cùng Staff | Khóa center root + Staff; đúng một exact link có thể commit, request kia conflict. |
| D-N3 | Một account đồng thời link hai Staff cùng center | Khóa account-security và Staff theo stable order; đúng một link, request kia conflict. |
| D-N4 | Existing account có membership role khác | Deny `consultant_membership_role_conflict`; không silent overwrite role. |
| D-N5 | Existing account lifecycle disabled | Deny `consultant_account_lifecycle_blocked`; không tạo/link active membership. |
| D-N6 | Staff employment inactive | Deny `consultant_employment_inactive`; không activate. |
| D-N7 | Staff termination trong lúc activation | Version re-check dưới locks làm activation fail; termination thắng và session bị invalidate. |
| D-N8 | Staff unlink khi consultant session đang hoạt động | Unlink revoke/suspend hoặc fail; bump versions và invalidate trước khi quyền tiếp tục. |
| D-N9 | Browser đổi `center_id` trong payload | Server-derived exact-center mismatch; deny `consultant_center_scope_denied` và safe audit. |
| D-N10 | Resource ID thuộc center khác | Resource-center join fail; deny không tiết lộ resource tồn tại. |
| D-N11 | UI ẩn nút nhưng direct API gọi write | Server resolver/RLS deny; UI state không ảnh hưởng decision. |
| D-N12 | Broad active-member RLS còn generic write | **CRITICAL IMPLEMENTATION BLOCKER**; consultant write production không được bật. |
| D-N13 | Client gửi capability claim | Bỏ qua claim; server derive capability và deny nếu không granted. |
| D-N14 | Client gửi role claim | Bỏ qua claim; đọc canonical membership role và deny escalation. |
| D-N15 | ALLOW và DENY cùng capability | Exact active `DENY` precedence; outcome deny. |
| D-N16 | Override hết hạn khi tab còn mở | Server time/version re-check deny; stale UI không giữ grant. |
| D-N17 | Policy version đổi giữa read và mutation | Mutation re-resolve, trả `consultant_policy_stale`; không write. |
| D-N18 | Full contact reveal không MFA | Deny `consultant_mfa_policy_not_met`; không trả raw field. |
| D-N19 | Full contact dùng stale step-up | Deny `consultant_step_up_required`; assertion không consume cho action khác. |
| D-N20 | Reveal resource không assigned | Deny `consultant_contact_reveal_denied`; không cho biết full contact. |
| D-N21 | Hai consultants cùng claim exclusive lead | Stable resource root serialize; chỉ một `ACTIVE` assignee. |
| D-N22 | Reassign lead và care-log write đồng thời | Cùng resource root/version; stale writer bị deny/rollback. |
| D-N23 | Đọc care log sau unassign | Current assignment check deny; cached grant không dùng lại. |
| D-N24 | Đọc full tuition ledger | Deny immutable finance capability; chỉ limited payment status projection. |
| D-N25 | Ghi payment/cashflow | Deny immutable capability và server operation allowlist. |
| D-N26 | Đọc private HR document | Deny immutable private-HR capability; không trả signed URL/metadata nhạy cảm. |
| D-N27 | Account/permission management | Deny immutable authority capability; audit escalation attempt. |
| D-N28 | Acting hoặc Platform action | Deny vì consultant không có platform/Acting authority. |
| D-N29 | Account có consultant membership center khác | Initial one-center policy deny activation ở center mới. |
| D-N30 | Auto-link existing account bằng email | Forbidden; yêu cầu protected exact canonical-account resolution. |
| D-N31 | Temporary password bị log/lưu plaintext | Production flow fail/incident; account giữ restricted và credential phải rotate, không activate. |
| D-N32 | Auth create success, DB finalize fail | Account giữ restricted; idempotent retry hoặc exact compensation, không active authority. |
| D-N33 | Membership/link mutate nhưng audit/outbox fail | Cùng DB transaction rollback; không có unaudited membership/link. |
| D-N34 | Compensation fail sau Auth create | State `COMPENSATION_REQUIRED`, account restricted, central review; không blind delete/retry. |
| D-N35 | Revoke thành công nhưng invalidation delivery fail | Current server versions deny ngay; retry outbox/alert, không authorize stale session. |
| D-N36 | Role consultant→admin và consultant write đồng thời | Center/account/membership version locks serialize; stale consultant write deny. |
| D-N37 | Masked endpoint trả raw phone/email rồi client mask | Contract violation; response must fail security QA, endpoint không được production. |
| D-N38 | Revealed contact cache dùng cho account khác | Resource/account-bound TTL và `no-store`; deny reuse, purge cache and audit. |
| D-N39 | Bulk export all leads/contacts | Default deny, export bucket/rate limit; no raw dataset response. |
| D-N40 | Center access control row missing/duplicate | Fail closed `consultant_provisioning_conflict`; không dùng empty membership/link set làm mutex. |
| D-N41 | Consultant gọi generic read/`SELECT` và yêu cầu raw hoặc center-wide records | Generic path deny hoặc chỉ trả exact capability-aware minimal projection; không raw PII, unassigned/cross-center row hay browser-side masking/filtering. |
| D-N42 | Auth create thành công nhưng `ACCOUNT_SECURITY_CONTROL_ROW` chưa finalized | Account giữ restricted; không membership/link/capability authority; retry/compensation qua exact bootstrap reservation. |
| D-N43 | Hai finalize workers dùng cùng bootstrap reservation | Exact reservation lock + idempotency tạo một finalize outcome; loser nhận prior outcome/conflict, không duplicate control hoặc lost security/session version. |
| D-N44 | Flow giữ resource root rồi chờ center root, flow khác giữ center root rồi chờ resource root | Contract/test reject resource-first composite flow; mọi flow cần cả hai lấy center root trước sorted resource roots, không deadlock. |
| D-N45 | Hai center/Staff khác nhau tạo reservation cùng normalized login identifier | Cùng environment-scoped login-bootstrap mutex; chỉ một reservation có Auth-create authority, request còn lại nhận prior outcome/safe conflict và không gọi Auth lần hai. |
| D-N46 | Hai reservation khác nhau reconcile tới cùng canonical Auth user ID | Cùng canonical-user bootstrap mutex; chỉ một canonical registration/control, reservation còn lại reconcile/terminalize fail closed; không auto membership/capability/link. |
| D-N47 | Normalization/provider config đổi giữa reservation và Auth/finalize | Ceremony vẫn acquire stable identity mutex rồi version/environment re-check fail closed; expire/restart reviewed ceremony, không âm thầm đổi mutex key hoặc tiếp tục state cũ. |
| D-N48 | Hai reservations cùng canonical Auth user, một dùng provider config V1 và một dùng V2 | Cùng environment + stable Auth realm + canonical user nên tranh đúng một canonical-user mutex; chỉ một registration/control outcome, stale ceremony deny/reconcile và uniqueness không thay mutex. |
| D-N49 | Normalization V1/V2 tạo hai login digests cho cùng logical identifier khi còn active reservations | Rotation barrier drain/expire hoặc deterministic dual-key/alias locking giữ một Auth-create authority/equivalence class; thiếu migration contract thì fail closed, không bật version mới. |

```text
STALE_OVERRIDE_CAN_GRANT_ACCESS: NO
AUTH_ACCOUNT_CREATED_WITH_FAILED_DB_FINALIZE_GETS_ACTIVE_AUTHORITY: NO
```

## 21. Threat model D-T1–D-T41

| Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| D-T1 UI-only consultant guard bypass | High | Critical | Canonical server resolver + narrow RLS/server operation | Server-policy regression | Resolver/RLS phase |
| D-T2 Broad RLS OR-policy write bypass | High while present | Critical | Treat as blocker; remove/narrow broad active-member write and direct-API QA | SQL drift | RLS remediation |
| D-T3 Cross-center IDOR | High without join | Critical | Exact membership/resource-center joins; opaque errors | Mapping defect | Resolver + QA |
| D-T4 Generic entity payload injection | Medium/High | Critical | Disable generic consultant write; typed field allowlists | Endpoint schema drift | Server operations |
| D-T5 Client-forged role | High | High | Canonical membership role only | Cache/version defect | Resolver |
| D-T6 Client-forged capability | High | High | Server baseline/override derivation | Policy-cache defect | Resolver |
| D-T7 Staff/account email auto-link takeover | Medium | Critical | Protected exact account resolver; email evidence only | Ops social engineering | Provisioning |
| D-T8 Duplicate Staff-account link race | Medium | Critical | Stable center/account/Staff locks + uniqueness backstop | Lock defect | Link service/tests |
| D-T9 Membership role overwrite | Medium | Critical | Explicit role-transition flow; conflict otherwise | Admin workflow error | Membership service |
| D-T10 Provision retry creates duplicate Auth accounts | Medium | Critical | Global login-identity mutex + one-live reservation/idempotency + uncertain-result reconciliation | Provider ambiguity | Saga/tests |
| D-T11 Auth success/DB failure orphan authority | Medium | Critical | Restricted lifecycle + compensation/manual review | Compensation outage | Saga |
| D-T12 Compensation disables wrong account | Low/Medium | Critical | Bind request, canonical ID, versions; protected reviewer | Identifier defect | Compensation QA |
| D-T13 Temporary credential leak | Medium | Critical | One-time server handoff, no plaintext log/store, expiry | Endpoint/device capture | Credential foundation |
| D-T14 Missing forced first-change | High if create-new | Critical | Block production create-new until server enforcement exists | Rollout bypass | Lifecycle gate |
| D-T15 Termination leaves membership active | Medium | Critical | Employment event reevaluation + effective deny/version bump | Event delay | Lifecycle integration |
| D-T16 Staff unlink leaves active authority | Medium | Critical | Revoke/suspend-or-fail unlink invariant | Partial integration | Link lifecycle |
| D-T17 Revocation leaves old sessions | Medium | Critical | Version-based deny + invalidation outbox | Delivery delay | Invalidation service |
| D-T18 Override expiry not enforced | Medium | High | Server time + version re-resolution | Clock/service fault | Override service |
| D-T19 ALLOW accidentally overrides DENY | Medium | Critical | Fixed deny-precedence algorithm/tests | Resolver regression | Resolver QA |
| D-T20 Wildcard override escalation | Medium | Critical | No wildcard; exact capability/scope only | Bad catalog mapping | Override service |
| D-T21 Assignment race | High | High | Stable resource root, version and exclusive transition | Hot contention | Assignment service |
| D-T22 Reassignment stale write | High | High | Same root/version for care-log and reassign | Long request retry | Assignment QA |
| D-T23 Reveal without step-up | Medium | Critical | MFA + resource/action-bound fresh step-up | Step-up outage/friction | Reveal endpoint |
| D-T24 Server sends raw contact to masked client | Medium | Critical | Server projection/serialization tests; no raw field | Logging serializer drift | Masking service |
| D-T25 Sensitive reveal cache leakage | Medium | Critical | `no-store`, short TTL, account/resource bind | Browser extension | Reveal endpoint |
| D-T26 Sequential contact scraping | High | High | Per-user/resource buckets, anomaly detection, no bulk reveal | Slow scraping | Risk/rate limit |
| D-T27 Care-log outside assignment | Medium | High | Assignment join per read/write | Relationship mapping bug | CRM endpoints |
| D-T28 Full tuition/cashflow exposure | Medium | Critical | Immutable deny + limited projection | Reporting join drift | Finance projection QA |
| D-T29 Private HR exposure | Medium | Critical | Immutable deny; no private storage path | Misclassified attachment | HR/storage QA |
| D-T30 Account/permission escalation | Medium | Critical | Non-grantable deny catalog + protected admin services | Privileged service flaw | Authority QA |
| D-T31 Multi-center data blending | Medium | Critical | One-center rollout + center-bound sessions/assignments/audit | Future rollout complexity | Scope gate |
| D-T32 Bulk export exfiltration | High | Critical | Default deny; limited aggregate export only after approval | Screenshot/manual copy | Export controls |
| D-T33 Policy-version drift | Medium | High | Version bind and mutation re-resolution | Cache invalidation lag | Resolver/cache QA |
| D-T34 Audit failure creates unaudited capability | Medium | Critical | Transactional audit/outbox or pending saga; no commit/activation | Outbox backlog | Audit service |
| D-T35 Session invalidation dependency outage | Medium | Critical | Current-version deny, durable retry/alert, fail closed | Availability impact | Invalidation/SRE |
| D-T36 Center access lock inversion/missing root | Medium | Critical | Exactly-one pre-existing root + canonical lock order | Migration/config defect | Foundation/concurrency QA |
| D-T37 Generic read and masking bypass | High nếu generic read còn mở | Critical | Capability-aware minimal read projection, complete read-path inventory và direct-API tests | Forgotten realtime/export/cache path | Resolver/read-remediation QA |
| D-T38 Missing account-security bootstrap mutex | Medium | Critical | Stable bootstrap reservation + atomic canonical account/control registration | Alternate provisioning path | Lifecycle/provisioning concurrency tests |
| D-T39 Center/resource root inversion | Medium | High/Critical | Center → sorted resource roots → reservation/account canonical order | Endpoint bypass | Integration/deadlock tests |
| D-T40 Cross-reservation duplicate account bootstrap | Medium | Critical | Login-identity mutex trước Auth + canonical-user mutex sau Auth | Normalization/provider namespace defect hoặc alternate provisioning path | Provisioning concurrency and provider-reconciliation tests |
| D-T41 Bootstrap mutex namespace fragmentation | Medium | Critical | Stable Auth realm, config-independent canonical-user key và normalization rotation barrier/dual-key migration; mutable config/version chỉ bind ceremony envelope | Alias/equivalence mapping defect hoặc alternate provisioning path | Provider rotation, normalization migration và cross-version concurrency tests |

## 22. Approval gates D-AG1–D-AG20

| Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |
|---|---|---|---|---|---|
| D-AG1 Staff bắt buộc trước consultant account? | YES, active Staff cùng center | Employment là dependency explicit | Orphan authority nếu thiếu | Product + HR + Security | Pre-provisioning |
| D-AG2 Ai provision consultant? | Owner/Center Admin exact center; conflict qua protected central ops | Center ownership và escalation separation | Privileged misuse | Security + Operations | Provisioning policy |
| D-AG3 Create-new hay link-existing đầu tiên? | Link existing nếu available; create-new chỉ sau lifecycle/forced-change | Giảm credential/orphan risk | Account resolution friction | Product + Security + Architecture | Rollout gate |
| D-AG4 Multi-center rollout đầu? | NO, một active consultant center | Scope đơn giản, chống blending | Hạn chế nhân sự dùng chung | Product + Security | Scope gate |
| D-AG5 Default resource scope? | `ASSIGNED_ONLY` | Least privilege | Cần assignment operations | Product + CRM owner | Assignment phase |
| D-AG6 Đọc unassigned queue? | NO mặc định; capability riêng | Tránh scraping | Chậm nhận lead | Product + Sales + Privacy | Queue policy |
| D-AG7 Masking phone/email? | Server-side; format do Product + Privacy duyệt | Raw PII không rời trusted boundary | Format giảm usability | Product + Privacy | Masking phase |
| D-AG8 Full reveal step-up? | MFA met + critical resource-bound step-up, TTL 5 phút | Chống session riding/scraping | UX friction | Security + Privacy | Reveal service |
| D-AG9 Update contact fields? | Phone, email, preferred method, limited note qua allowlist | Hỗ trợ CRM, không đụng identity | PII correctness | Product + Privacy | PII endpoint |
| D-AG10 Care-log scope? | Read/create assigned resource only | Đồng bộ relationship boundary | Reassign race | CRM owner + Security | CRM service |
| D-AG11 Appointment capability? | Read/create/update assigned | Đủ nghiệp vụ tư vấn | Calendar data leak | Product + Operations | Appointment service |
| D-AG12 Enrollment draft? | YES, draft only; no finalization | Tách sales khỏi canonical enrollment | Draft misuse | Product + Academic owner | Enrollment draft |
| D-AG13 Tuition visibility? | Quote + limited payment status; no ledger/write | Need-to-know | Customer-context thiếu | Finance + Privacy | Projection service |
| D-AG14 Override được phép? | YES exact/time-bound; immutable deny không grantable | Exception có kiểm soát | Privilege creep | Security + Data owner | Override service |
| D-AG15 Ai request/approve sensitive allow? | Separation of duty; target/requester không tự approve | Giảm self-escalation | Approval latency | Security + Executive delegate | Approval workflow |
| D-AG16 Termination tác động gì? | Immediate deny + session invalidation; no hard delete | Chặn stale authority, giữ history | Event-delivery outage | HR + Security + SRE | Lifecycle integration |
| D-AG17 Role transition? | Protected versioned transition; no silent overwrite | Tránh lost update/escalation | Operational complexity | Security + Operations | Membership service |
| D-AG18 Broad RLS strategy? | Remove/narrow broad active-member write trước consultant write | RLS OR bypass là critical | Migration regression | Security + Database owner | Separate SQL phase |
| D-AG19 Consultant write path? | Narrow capability-aware server operations; no generic table write | Central enforcement/audit | Service workload | Architecture + Security | Server operation phase |
| D-AG20 Khi bật production? | Sau lifecycle, RLS-write remediation, complete read-path inventory/remediation, resolver, masking, MFA, invalidation, audit và direct-API QA | Toàn bộ read/write authority chain phải fail closed | Rollout chậm | Security + Architecture + Product | Production gate |

Các default là design recommendation, không cấp permission hoặc production approval.

## 23. Implementation blockers và production gates

- Canonical account lifecycle và forced first-password-change.
- Exactly-one canonical account-security control row/account và session-version source.
- Exactly-one stable center-access control row/center.
- Stable account-bootstrap reservation/control tồn tại trước Auth create và atomic canonical account/security-control registration sau Auth success.
- Environment-scoped login-identity/canonical-user bootstrap mutex registry hoặc reviewed collision-safe advisory namespace.
- Stable Auth account realm registry; versioned ceremony provider/config/environment inventory và drift governance.
- Login-normalization rotation barrier hoặc approved deterministic dual-key/alias equivalence migration.
- Server-side employment lifecycle và Staff-account-membership link service.
- Consultant provisioning saga/reservation/reconciliation/compensation.
- Safe temporary credential handoff trước create-new production.
- Canonical capability resolver với deny precedence và policy versions.
- Resource assignment service với stable resource roots.
- Server-side masking/projection và full-contact reveal service.
- F23.13C MFA/step-up runtime và session/assertion invalidation.
- Exact/time-bound capability override service và immutable deny catalog.
- Immutable audit/transactional outbox, rate-limit/risk và protected notification.
- Broad active-member RLS remediation trên `center_cloud_entities`.
- Complete inventory/remediation cho direct `SELECT`, generic cloud read, realtime, RPC, cache, export/search, attachment, error/debug và restored persistence.
- Narrow capability-aware consultant read projections/server operations; generic raw/center-wide/browser-filter read disabled.
- Narrow consultant-specific write operations; generic direct table write disabled.
- Direct API/RLS/read-path, data-projection, failure, fixture, cross-center/cross-reservation bootstrap và concurrency/deadlock regression tests.

```text
F23_13D_IMPLEMENTATION_READINESS: BLOCKED
F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_13_AUTH_CONFIGURATION_CHANGE: NO
F23_13_SUPABASE_ACTION: NOT RUN
F23_13_RLS_CHANGE_BY_THIS_PHASE: NO
```

Không blocker nào được suy diễn là đã implement bởi việc hoàn tất design. Mọi yêu cầu runtime/SQL/Auth/Supabase/account/role/capability thật ở phase này là `NEEDS REVIEW`.

## 24. Roadmap sau F23.13D design

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

## 25. Definition of done design

- F23.13C final technical audit đã sync `PASS`; kiến trúc G2, account-security, MFA/step-up và recovery không đổi.
- Consultant là exact-center, assigned-resource role; không có platform/Acting/cross-center authority.
- Staff, canonical account, membership và explicit link là entity riêng với eligibility fail closed.
- Create-new và link-existing là flow riêng; không auto-link email, fake username hoặc temporary-password production thiếu forced change.
- Resolver server canonical, deny precedence, immutable deny, policy/assignment versions và minimal projection đã chốt.
- Generic cloud/table read không được bypass assigned scope, masking, minimal projection hoặc immutable deny; complete SELECT/read-path inventory là production blocker.
- Capability allow/conditional/deny, assignment mutex, masking, reveal, PII, tuition và enrollment boundaries đã chốt.
- Exactly-one center root, one account-security source và global identity mutex → sorted center roots → sorted resource roots → reservations → account-security composite order đã chốt.
- Create-new dùng shared login-key mutex + one-live reservation trước Auth và shared canonical-user mutex + atomic account registration/control sau Auth; không lock empty/nonexistent account-security row và uniqueness chỉ là backstop.
- Bootstrap mutex keys dùng versioned digest của stable environment + Auth realm + stable identity inputs; không chứa mutable provider config/login method/normalization version và không dùng/log raw email hoặc raw login identifier làm authority.
- Provider/config/normalization/ceremony versions bind riêng vào envelope; config V1/V2 cùng identity vẫn chia sẻ mutex, normalization rollout phải qua drain hoặc dual-key/alias barrier.
- Cross-domain provisioning dùng protected saga/reservation/compensation, không tuyên bố atomic giả.
- Suspend/revoke/termination/unlink, invalidation, safe errors, audit và rate-limit fail closed.
- Broad active-member write RLS là CRITICAL IMPLEMENTATION BLOCKER; UI-only guard, generic direct table write và generic raw consultant read đều bị cấm.
- D-N1–D-N49, D-T1–D-T41 và D-AG1–D-AG20 có outcome/mitigation/default substantive.
- Semantic smoke là docs-contract test, không phải runtime/RLS/Auth proof hoặc production approval.

F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE
