# F23.3E — Convert thật Khách tư vấn → Phụ huynh/Học viên: Idempotency, Rollback & Duplicate Safety

```text
F23_3E_STATUS: DONE DESIGN
F23_3E_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_IMPLEMENTATION_READINESS: BLOCKED
F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO

F23_3E_SQL_CHANGE: NO
F23_3E_MIGRATION_CHANGE: NO
F23_3E_RLS_CHANGE: NO
F23_3E_AUTH_CHANGE: NO
F23_3E_SUPABASE_ACTION: NOT RUN
F23_3E_REAL_DATA_CHANGE: NO
```

## 1. Scope, evidence labels và inherited boundary

F23.3E là **design-only**. Tài liệu này chi tiết hóa conversion thật trong tương lai nhưng không tạo backend, không nối nút confirm, không ghi Guardian/Student/Relationship, không sửa runtime, `src/`, SQL, migration, RLS, Auth, Supabase, Storage, dữ liệu thật hoặc roadmap canonical.

Nhãn bằng chứng:

- **REPO FACT**: hành vi đã kiểm chứng trong repository.
- **PARTIAL FOUNDATION**: nền có thể tham khảo nhưng chưa đạt canonical authority/atomicity.
- **DESIGN PROPOSAL**: contract bắt buộc cho phase implementation sau.
- **DEFERRED**: cần phase, dependency hoặc approval riêng.

Inherited final-audit state:

```text
F23_2_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_FINAL_TECHNICAL_AUDIT: PASS
```

F23.3E kế thừa nguyên contact/case/Guardian/Student/Relationship là entity riêng, Guardian–Student M:N, consultant assignment chỉ thuộc case/resource, exact-center, assigned-only, server-derived capability, server-side masking, no generic read/write, no auto-link/auto-merge, stable center CRM root, identity-match mutex, explicit action graph, `DO_NOT_CREATE_RELATIONSHIP`, fresh step-up tại approval và implementation `BLOCKED`. Nếu implementation proposal khác F23.2/F23.13C–D thì outcome là `FAIL / NEEDS REVIEW`, không silently override audited contract.

```text
F23_3E_INHERITS_F23_2_WITHOUT_RELAXATION: YES
F23_3E_INHERITS_F23_13C_STEP_UP_ATOMICITY: YES
F23_3E_INHERITS_F23_13D_CONSULTANT_SECURITY: YES
```

## 2. Repo-truth audit

| # | Khu vực | Phân loại | Exact evidence và kết luận |
|---|---|---|---|
| 1 | F23.3D preview builder | REPO FACT | `src/parent-consultation-module.js:2492-2516` chỉ build view model từ contact/candidates/options; không tạo request hoặc target row. |
| 2 | Preview candidate scoring | REPO FACT | `src/parent-consultation-module.js:2613-2741` normalize phone và gán `high/medium/low` từ phone/name/birth/link evidence. Đây là heuristic browser, không phải reviewed match authority. |
| 3 | Confirm chưa mở | REPO FACT | `src/parent-consultation-module.js:1377-1389` tuyên bố chưa tạo Student/Tuition/Class/Attendance và render `Xác nhận chuyển đổi - chưa mở` disabled. |
| 4 | Preview UI state | REPO FACT | `src/main.js:20653-20712` chỉ set/clear `parentConvertPreviewState`, đổi mode/candidate rồi render; không persist conversion. Modal style có tại `src/styles.css:13562-13606`. |
| 5 | Ba CRM stages | REPO FACT | `src/parent-consultation-module.js:15-21` định nghĩa `lead`, `consulting`, `converted`; chúng là presentation state trên contact object, chưa phải canonical case lifecycle. |
| 6 | CRM form/local record | REPO FACT | `src/parent-consultation-module.js:54-58,141-168,549-620` có wizard bốn bước, tạo ID `contact-${Date.now()}` và lưu contact/student/consultant fields vào một object. Không có canonical contact/case/request versions. |
| 7 | Student links/case-like children | REPO FACT | `src/storage.js:2174-2231` normalize `studentId`, `linkedStudentIds`, care logs, appointments và enrollment draft trên contact; `:2240-2251` chỉ dedupe string IDs. Chúng không chứng minh Guardian/Relationship. |
| 8 | CRM center storage key | PARTIAL FOUNDATION | `src/storage.js:48-59,88,1107-1129` tạo `ichessCenterOS.parentConsultations.<currentStorageCenterId>` và đọc/ghi localStorage. Client-selected namespace không phải exact-center server authority, row lock hoặc multi-user source. |
| 9 | Student create flow | REPO FACT | `src/student-module.js:331-381,415-440` validate form phía client và tạo `stu-${Date.now()}`; flow hiện hữu không nhận canonical conversion request/approval. |
| 10 | Student status vocabulary | REPO FACT | `src/student-data.js:3` chỉ có `Đang theo học`, `Bảo lưu`, `Ngưng học`; `src/student-module.js:79-104,156` default/fallback `Đang theo học`. Không có approved unenrolled profile status. |
| 11 | Embedded parent fields | REPO FACT | `src/student-module.js:79-104,127-159,331-353,415-440` nhúng `parentName`, `fatherPhone`, `motherPhone`, `parentPhone` và bắt buộc parent name + ít nhất một parent phone cho form hiện tại. Đây không phải Guardian/Relationship service. |
| 12 | Student ↔ Tuition | REPO FACT | `src/student-tuition-links.js:127-151` tìm tuition bằng `record.studentId === student.id` và đọc parent fields từ Student. `src/cloud-tuition-record-package-bridge.js:277-307` giữ record identity riêng và yêu cầu `studentId`. Conversion không được tạo/mutate tuition. |
| 13 | Local cache foundation | PARTIAL FOUNDATION | `src/storage.js:266-285,471-490` vẫn đọc/ghi Student và Tuition bằng localStorage center key. Cloud/realtime bridge tồn tại cho một số entity nhưng không phải canonical conversion transaction. |
| 14 | Generic cloud reads/writes | REPO FACT | `src/cloud-db-sync.js:135-179` select payload theo center/entity; `:214-251` generic upsert `center_cloud_entities`. `src/cloud-tuition-record-package-bridge.js:44-64,113-125` cũng direct select/upsert. Không có request/approval/executor authority. |
| 15 | Broad RLS snapshot | REPO FACT | `supabase/migrations/20260722000000_remote_schema.sql:365-400` có center-member SELECT/INSERT/UPDATE/DELETE policies song song role-aware policies. OR-policy behavior làm generic active-member writes thành production blocker. |
| 16 | F23.2 conversion contract | REPO FACT | `docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md:376-438,442-702` khóa exact center root, identity mutex, action graph, approval/step-up và atomic conversion; final audit `PASS`. |
| 17 | F23.13C step-up | REPO FACT | `docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md:426-522` yêu cầu business root → account-security → assertion → targets, atomic consume, và cấm consume-then-call. Runtime vẫn `NOT STARTED`. |
| 18 | F23.13D consultant boundary | REPO FACT | `docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md:111-147,277-350,360-455,845-904` chốt exact-center, assigned-only, server resolver/masking, no generic read/write và RLS remediation. Runtime vẫn blocked. |
| 19 | Idempotency patterns | PARTIAL FOUNDATION | `src/main.js:7650-7655,7712-7714,7817-7823,7862-7864,8138-8144,8205-8207` gửi idempotency key cho vài account operations nhưng UI tạo key bằng `Date.now()`. Không có durable CRM idempotency registry, intent digest hoặc prior conversion outcome. |
| 20 | Audit/outbox foundation | PARTIAL FOUNDATION | `src/cloud-audit-log.js:1-18,39-88,90-175` ghi generic `audit_log_entry` bằng separate cloud upsert; `src/storage.js:724-813` có append-only local HR audit; snapshot có `account_audit_logs` (`supabase/migrations/20260722000000_remote_schema.sql:242-307`). Repo không có transactional CRM conversion audit/outbox. |
| 21 | Historical compatibility | REPO FACT | F22.4 xác nhận parent đang là read-only fields trên Student và chưa có parent table (`docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md:5-24,39-40`). C5.2 giữ `tuition_record_package` identity riêng, `studentId` link và cấm attendance auto-link (`docs/supabase-c5-2c-runtime-guarded-hoc-phi-tbhp-cloud.md:71-103,162-188,221-229`). |

### 2.1 Repo truth conclusion

F23.3D có thể làm UX shell cho draft/review, nhưng không được gửi heuristic candidate hoặc local object trực tiếp tới mutation. `merge` trong UI phải được đổi nghĩa thành `REUSE_REVIEWED_*`; phone/email/name/birth evidence chỉ tạo masked candidate review. Không tái dùng `saveStoredStudents`, `saveStoredParentConsultations`, `saveStoredTuition`, generic `center_cloud_entities` upsert hoặc client `customerStage='converted'` làm real conversion.

```text
F23_3D_PREVIEW_IS_CONVERSION_AUTHORITY: NO
CRM_LOCALSTORAGE_IS_CANONICAL_CONVERSION_SOURCE: NO
GENERIC_CLOUD_UPSERT_IS_CONVERSION_EXECUTOR: NO
CURRENT_AUDIT_LOG_IS_TRANSACTIONAL_CONVERSION_OUTBOX: NO
```

## 3. Conversion scope and forbidden side effects

Source domain:

```text
crm_contact
consultation_case
consultation_case_candidate_student
care_log
reviewed_match_evidence
```

Target graph:

```text
guardian_profile
student_profile
guardian_student_relationship
consultation_case = CONVERTED
crm_conversion_request = COMPLETED
crm_conversion_approval = CONSUMED
audit/outbox
```

```text
F23_3E_CONVERSION_TARGETS_GUARDIAN_STUDENT_RELATIONSHIP_ONLY: YES
F23_3E_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: NO
F23_3E_CONVERSION_AUTO_CREATES_MEMBERSHIP: NO
F23_3E_CONVERSION_AUTO_CREATES_TUITION: NO
F23_3E_CONVERSION_AUTO_CREATES_PAYMENT: NO
F23_3E_CONVERSION_AUTO_CREATES_CASHFLOW: NO
F23_3E_CONVERSION_AUTO_ENROLLS_CLASS: NO
F23_3E_CONVERSION_AUTO_CREATES_SCHEDULE: NO
F23_3E_CONVERSION_AUTO_CREATES_ATTENDANCE: NO
F23_3E_CONVERSION_AUTO_CREATES_GRADE: NO
F23_3E_CONVERSION_AUTO_ASSIGNS_TEACHER: NO
```

Student profile có thể tồn tại mà chưa có Auth, membership, enrollment, class, schedule, attendance, grade, tuition, payment hoặc cashflow. Các domain đó có authority/lifecycle/audit riêng.

## 4. Actors and separation of duty

### 4.1 Requester

Assigned consultant có `crm.conversion.request_assigned` được tạo/update draft, chạy preview, submit review và sửa draft chưa approve. Server derive exact center, current assignment và versions; client không tự claim assignee.

### 4.2 Approver

Approver cần exact `crm.conversion.approve`, eligible account/security state, MFA policy met và fresh resource-bound step-up. Initial recommendation: Owner, Center Admin hoặc approved CRM supervisor có exact capability. Consultant không mặc định có approve và requester không self-approve.

### 4.3 Executor

`crm.conversion.execute` là protected server operation, không phải client role. Trigger có thể do approved operator hoặc durable worker, nhưng executor authority luôn server-derived và bound exact request/approval.

```text
CONVERSION_REQUESTER_MAY_SELF_APPROVE: NO
CLIENT_MAY_CLAIM_CONVERSION_APPROVER: NO
CLIENT_MAY_SET_CONVERSION_COMPLETED: NO
CONVERSION_EXECUTOR_IS_PROTECTED_SERVER_OPERATION: YES
```

## 5. Canonical request model and lifecycle

```text
crm_conversion_request
  conversion_request_id
  center_id
  consultation_case_id
  source_contact_id
  source_case_version
  source_contact_version
  source_assignment_version
  identity_policy_version
  conversion_policy_version
  relationship_policy_version
  student_profile_policy_version
  requested_guardian_actions
  requested_student_actions
  requested_relationship_actions
  match_decisions
  action_graph_digest
  request_version
  idempotency_scope
  idempotency_key
  intent_digest
  status
  requested_by_user_id
  requested_at
  updated_at
  terminal_outcome_digest
```

Statuses:

```text
DRAFT
READY_FOR_REVIEW
APPROVED
EXECUTING
COMPLETED
CONFLICT
REJECTED
CANCELLED
SUPERSEDED
COMPENSATION_REQUIRED
```

Versioned transitions:

```text
DRAFT → READY_FOR_REVIEW
READY_FOR_REVIEW → DRAFT
READY_FOR_REVIEW → APPROVED
READY_FOR_REVIEW → REJECTED
READY_FOR_REVIEW → CANCELLED
APPROVED → EXECUTING
APPROVED → SUPERSEDED
APPROVED → CANCELLED
EXECUTING → COMPLETED
EXECUTING → CONFLICT
EXECUTING → COMPENSATION_REQUIRED
```

`APPROVED → EXECUTING → COMPLETED` là logical sequence inside protected execution. Nếu deterministic pre-mutation conflict được committed, request có thể transition `EXECUTING → CONFLICT` với no target write và approval terminalized `SUPERSEDED`. Nếu lỗi xảy ra sau mutation attempt trong same database transaction, toàn unit rollback về pre-execution state; một transaction mới, cùng canonical order, mới được terminalize safe conflict. Không giữ partial `EXECUTING` hoặc consumed approval.

```text
CONVERSION_REQUEST_STATUS_CLIENT_AUTHORITY: NO
COMPLETED_CONVERSION_CAN_RETURN_TO_DRAFT: NO
COMPLETED_CONVERSION_CAN_REEXECUTE: NO
```

## 6. Request creation serialization

Request row phải được preallocate trước approval/execution. Empty set không phải mutex.

```text
CONVERSION_REQUEST_CREATION_LOCK_ORDER_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. CONSULTATION_CASE_ROW
2. CURRENT_ASSIGNMENT_ROW
3. CONVERSION_REQUEST_IDEMPOTENCY_ROW_OR_PREALLOCATED_REQUEST_ROW
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CONVERSION_REQUEST_CREATION_LOCK_ORDER_END
```

Server dưới locks rechecks case eligible/current, exact assignment, one-active policy, idempotency scope/intent, creates or returns exact preallocated request, appends audit/outbox and commits. Human review hoặc external call không chạy khi giữ locks.

```text
EMPTY_CONVERSION_REQUEST_SET_PROVIDES_SERIALIZATION: NO
ONE_ACTIVE_EXECUTABLE_CONVERSION_REQUEST_PER_CASE: YES
ONE_COMPLETED_CANONICAL_CONVERSION_OUTCOME_PER_CASE: YES
```

Một case có nhiều historical attempts. Request mới khi request cũ `APPROVED/EXECUTING` phải safe conflict hoặc protected supersede; client không overwrite request cũ.

## 7. Scoped idempotency and committed result

Canonical execute scope:

```text
environment_fingerprint
+ center_id
+ consultation_case_id
+ operation = crm.conversion.execute
+ idempotency_key
```

Registry/envelope binds:

```text
intent_digest
action_graph_digest
source case/contact/assignment versions
identity/conversion/relationship/student-profile policy versions
request_version
approval_id + approval_version
terminal_outcome_digest
```

```text
SAME_IDEMPOTENCY_KEY_SAME_INTENT_RETURNS_PRIOR_OUTCOME: YES
SAME_IDEMPOTENCY_KEY_DIFFERENT_INTENT_ALLOWED: NO
IDEMPOTENCY_KEY_ALONE_IS_AUTHORITY: NO
IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_CASE_ROOT_LOCK: NO
```

Same key + same intent/digests returns current safe pending state, exact prior completed opaque result, or exact prior conflict outcome. Same key + different intent/digest returns `crm_conversion_idempotency_conflict`; it never overwrites graph, versions or result. Retry after timeout first resolves registry/request under root locks; it does not replay target writes or consume another approval.

## 8. Canonical action graph

Mỗi action:

```text
action_id
entity_kind
source_candidate_id
decision
target_id
target_version
evidence_set_id
review_evidence_id
reason_code
policy_version
action_version
```

Guardian decisions:

```text
CREATE_NEW_GUARDIAN
REUSE_REVIEWED_GUARDIAN
DO_NOT_CREATE_GUARDIAN
REQUIRE_DUPLICATE_REVIEW
```

Student decisions:

```text
CREATE_NEW_STUDENT
REUSE_REVIEWED_STUDENT
DO_NOT_CREATE_STUDENT
REQUIRE_DUPLICATE_REVIEW
```

Relationship decisions:

```text
CREATE_RELATIONSHIP
REUSE_EXISTING_RELATIONSHIP
UPDATE_APPROVED_RELATIONSHIP_ROLE
DO_NOT_CREATE_RELATIONSHIP
REQUIRE_RELATIONSHIP_REVIEW
```

Preflight validates unique action IDs, valid acyclic references, exact-center targets, current target/action/policy versions, exactly one relationship decision for every proposed pair, no duplicate normalized pair, explicit approved reason for every `DO_NOT_CREATE_*`, primary-contact/safeguarding invariants and canonical digest. Structural validation có thể chạy trước locks; authoritative match/target/policy/approval recheck chạy lại dưới canonical locks.

```text
CONVERSION_ACTION_GRAPH_SERVER_VALIDATED: YES
EMPTY_ACTION_GRAPH_IS_EXECUTABLE: NO
MISSING_RELATIONSHIP_DECISION_IS_EXECUTABLE: NO
EXECUTOR_ACCEPTS_DIFFERENT_ACTION_GRAPH_THAN_APPROVAL: NO
```

## 9. Identity matching and exact-center duplicate review

Phone/email/name/birth/existing ID/legacy links chỉ là evidence. Server match outcomes:

```text
NO_MATCH
POSSIBLE_MATCH
PROBABLE_MATCH
EXACT_REVIEWED_MATCH
CONFLICT
INSUFFICIENT_EVIDENCE
```

Match evidence binds exact center, identity kind, opaque target/version, source versions, evidence digests, normalizer/policy versions, reviewer/authority, reason, decision time and expiry. Chỉ `EXACT_REVIEWED_MATCH` current cho reuse. `POSSIBLE_MATCH`, `PROBABLE_MATCH`, multiple candidates, conflict hoặc insufficient evidence require review/block; name-only never reuses. Cross-center candidate lookup/count/detail không được disclose.

```text
NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: NO
POSSIBLE_MATCH_MAY_AUTO_REUSE: NO
PROBABLE_MATCH_MAY_AUTO_REUSE: NO
NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO
CROSS_CENTER_MATCH_RESULT_MAY_BE_DISCLOSED: NO
```

Create-new chỉ được approve sau complete candidate search, required index/service availability, minimum evidence policy, current normalizer/policy, no unresolved candidates và mutex recheck. `INSUFFICIENT_EVIDENCE` không được coerced thành `NO_MATCH`.

## 10. Stable identity mutex and normalization drift

```text
identity_match_mutex_key =
  versioned_digest(
    environment_fingerprint,
    center_id,
    identity_kind,
    canonical_normalized_identity_digest
  )
```

All relevant guardian/student identity keys are deduped, sorted bytewise and locked before profile rows; match runs again under locks. Raw contact/birth values never become mutex/audit keys.

```text
ALL_RELEVANT_IDENTITY_MUTEX_KEYS_LOCKED_BEFORE_MATCH_RECHECK: YES
MATCH_REVIEW_RESULT_WITHOUT_MUTEX_RECHECK_CAN_EXECUTE: NO
IDENTITY_UNIQUE_INDEX_REPLACES_MUTEX: NO
```

Normalizer rollout must drain/expire pending reviews or use deterministic dual-key/equivalence locking. Old/new algorithms cannot accept create-new concurrently for one logical identity.

## 11. Create-new reservation and absent-row race

Không thể lock một Guardian/Student row chưa tồn tại. Create-new uses center root + complete identity mutex set + exact request/action + preallocated opaque ID/reservation; unique constraint chỉ là integrity backstop.

```text
profile_creation_reservation
  reservation_id
  center_id
  entity_kind
  conversion_request_id
  action_id
  preallocated_target_id
  identity_mutex_keys_digest
  status
  reservation_version
  expires_at
```

Reservation được tạo/bind trước approval, không cấp profile authority. Executor verifies immutable reservation reference from locked request/action, locks preallocated target IDs at profile tiers, then locks/terminalizes reservation rows at their canonical tier. Mọi reservation mutation phải follow same root/mutex/request/target/reservation order, nên không có flow reservation-first đảo khóa.

```text
NEW_GUARDIAN_CREATION_LOCKS_EMPTY_GUARDIAN_SET: NO
NEW_STUDENT_CREATION_LOCKS_EMPTY_STUDENT_SET: NO
EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: NO
PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO
PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: NO
PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: NO
```

## 12. Student chưa enrolled, relationship and legacy compatibility

### 12.1 Student chưa enrolled

Current runtime vocabulary is `Đang theo học | Bảo lưu | Ngưng học`, nhưng conversion không có enrollment authority. Recommendation:

```text
student_profile_status = ACTIVE | INACTIVE | ARCHIVED
enrollment_status = separate domain, present only with enrollment
```

Nếu Product chưa approve split/mapping, `CREATE_NEW_STUDENT = BLOCKED`; `REUSE_REVIEWED_STUDENT` chỉ tiếp tục khi exact-center target current/eligible và không mutate enrollment status. F23.3E không silently thêm runtime status.

```text
CONVERSION_CREATED_STUDENT_DEFAULTS_TO_DANG_THEO_HOC: NO
CREATE_NEW_STUDENT_WITHOUT_APPROVED_UNENROLLED_MAPPING_ALLOWED: NO
CRM_CASE_STATUS_IS_STUDENT_ENROLLMENT_STATUS: NO
```

### 12.2 Relationship completeness

Khi both endpoints exist/reuse, pair phải có exactly one create/reuse/update/review outcome. `DO_NOT_CREATE_RELATIONSHIP` chỉ hợp lệ với approved exception/reason, exact guardian/student actions, relationship policy, reviewer/approver, current source/target versions và proof không vi phạm primary-contact/safeguarding. Empty/missing list không có authority.

Relationship binds:

```text
relationship_type
is_primary_contact
financial_contact_role
academic_contact_role
status
policy_version
```

Cùng phone, surname, address, embedded parent fields hoặc consultation case không suy ra relationship.

### 12.3 Legacy compatibility projection

```text
guardian/relationship = canonical authority
legacy embedded parent fields = derived compatibility projection or untouched legacy snapshot
```

Recommended initial strategy là versioned projection adapter cho UI cũ. Controlled dual-write chỉ được approval khi exact mapping, same transaction/outbox, canonical version binding, divergence detector và rollback plan tồn tại; canonical Relationship vẫn là authority. Existing data backfill là migration phase riêng.

```text
LEGACY_STUDENT_PARENT_FIELDS_ARE_CANONICAL_RELATIONSHIP_AUTHORITY: NO
CONVERSION_MAY_AUTO_OVERWRITE_LEGACY_PARENT_FIELDS_WITHOUT_POLICY: NO
LEGACY_FIELDS_MAY_CREATE_RELATIONSHIP_BY_REVERSE_INFERENCE: NO
```

## 13. Approval evidence and lifecycle

```text
crm_conversion_approval
  approval_id
  conversion_request_id
  center_id
  approval_status
  approved_by_user_id
  approved_at
  approval_expires_at
  approval_version
  approved_action
  approved_purpose
  approved_action_graph_digest
  approved_request_version
  approved_source_case_version
  approved_source_contact_version
  approved_assignment_version
  approved_match_decision_versions
  approved_identity_policy_version
  approved_conversion_policy_version
  approved_relationship_policy_version
  approved_student_profile_policy_version
  approver_security_version
  approver_session_version
  step_up_assertion_id
  consumed_at
  revoked_at
```

Approval statuses:

```text
PENDING
APPROVED
REVOKED
EXPIRED
CONSUMED
SUPERSEDED
REJECTED
```

Versioned approval transitions:

```text
PENDING → APPROVED
PENDING → REJECTED
APPROVED → CONSUMED
APPROVED → REVOKED
APPROVED → EXPIRED
APPROVED → SUPERSEDED
```

Only the protected approver operation creates `APPROVED`; only the executor transaction creates `CONSUMED`. Revoke/expire/supersede are protected server transitions using the same business-root → account-security → request/approval ordering as execution for overlapping rows. Terminal approval states never return to `APPROVED`.

Approval is a durable, exact, single-use authority artifact. `step_up_assertion_id` is opaque; approval stores no OTP, recovery code, factor secret, raw assertion payload or credential. Approval binds exact request version, graph digest, source/match/policy versions and approver security/session versions. Any draft/source/assignment/match/policy edit invalidates or supersedes old approval.

```text
CONVERSION_APPROVAL_SINGLE_USE: YES
CONVERSION_APPROVAL_MAY_AUTHORIZE_DIFFERENT_GRAPH: NO
EXPIRED_APPROVAL_MAY_EXECUTE: NO
REVOKED_APPROVAL_MAY_EXECUTE: NO
CONSUMED_APPROVAL_MAY_EXECUTE_AGAIN: NO
```

## 14. Fresh step-up and independent approval atomicity

Independent `crm.conversion.approve` requires MFA policy met and a fresh, single-use F23.13C assertion bound to approver account/session, center, case, request, exact action `crm.conversion.approve`, purpose and versions. Browser MFA/role/`approved=true` claims are ignored.

```text
CONVERSION_APPROVAL_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. ACCOUNT_SECURITY_CONTROL_ROW, approver
2. STEP_UP_ASSERTION_ROW
3. CONVERSION_REQUEST_AND_APPROVAL_ROWS
4. AUDIT_OUTBOX_ROWS
5. COMMIT_ATOMIC
CONVERSION_APPROVAL_ATOMIC_END
```

In one transaction server rechecks account, membership, exact capability, MFA, security/session versions, request/source/assignment/match/policy versions and action graph; rechecks fresh exact assertion; consumes assertion; commits approval/request transition plus audit/outbox. Approval/audit failure rolls back assertion consumption. It is forbidden to consume step-up then call a separate approval API.

```text
F23_3E_APPROVAL_REQUIRES_MFA_POLICY_MET: YES
F23_3E_APPROVAL_REQUIRES_FRESH_RESOURCE_BOUND_STEP_UP: YES
STEP_UP_CONSUMPTION_ATOMIC_WITH_CONVERSION_APPROVAL: YES
CONSUME_STEP_UP_THEN_CALL_APPROVAL_API_ALLOWED: NO
APPROVAL_AUDIT_FAILURE_ROLLS_BACK_ASSERTION_CONSUMPTION: YES
```

## 15. Protected executor security composition

Executor does not consume the raw step-up assertion again. It consumes the durable approval once, atomically with conversion. To serialize approval revoke/expiry, approver/executor security invalidation, request supersede, assignment/policy changes and target races, exact canonical order is:

```text
CONVERSION_EXECUTOR_ATOMIC_BEGIN
0. CENTER_CRM_CONTROL_ROW
1. IDENTITY_MATCH_MUTEX_ROWS, stable sorted order
2. ACCOUNT_SECURITY_CONTROL_ROWS, approver/executor subjects theo sorted canonical_user_id
3. CONVERSION_REQUEST_AND_APPROVAL_ROWS
4. CONSULTATION_CASE_AND_CONTACT_ROWS
5. GUARDIAN_PROFILE_ROWS
6. STUDENT_PROFILE_ROWS
7. GUARDIAN_STUDENT_RELATIONSHIP_ROWS
8. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS
9. PROFILE_CREATION_RESERVATION_ROWS
10. AUDIT_OUTBOX_ROWS
11. COMMIT_ATOMIC
CONVERSION_EXECUTOR_ATOMIC_END
```

Center root + sorted identity mutexes are the business-root tier. Account-security rows are real locks, not unlocked reads; they precede approval/request and every remaining target. Under these locks executor rechecks current eligible account/security/session states and approved versions. Request/approval rows then serialize revoke, supersede, cancel, expiry evaluation and single-use consumption. Guardian → Student → Relationship relative profile order remains inherited. All same-tier rows sort by stable opaque ID/key.

Conversion-specific approval revoke follows the overlapping order `CENTER_CRM_CONTROL_ROW → relevant IDENTITY_MATCH_MUTEX_ROWS when graph-bound → ACCOUNT_SECURITY_CONTROL_ROWS → CONVERSION_REQUEST_AND_APPROVAL_ROWS → AUDIT_OUTBOX`. Security-only account revoke may lock account-security without business roots, but it never waits for conversion rows: it commits version/state first, after which a waiting executor rechecks and denies. This avoids account→business-root inversion while guaranteeing concurrent revoke cannot be missed.

Assignment/policy/case mutation sharing conversion state must lock the same center root and every overlapping tier in canonical order. No flow may lock approval, target, assignment or reservation then return to account-security/root. No external call or human wait occurs under locks.

```text
CONVERSION_EXECUTOR_SECURITY_LOCK_ORDER_DEFINED: YES
BUSINESS_ROOTS_PRECEDE_EXECUTOR_ACCOUNT_SECURITY_LOCKS: YES
EXECUTOR_ACCOUNT_SECURITY_LOCKS_PRECEDE_APPROVAL_ROW: YES
APPROVAL_ROW_LOCK_PRECEDES_TARGET_MUTATION: YES
CONVERSION_EXECUTOR_LOCK_ORDER_INVERSION_ALLOWED: NO
EXECUTOR_SECURITY_VERSION_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO
PROTECTED_EXECUTOR_REUSES_RAW_STEP_UP_ASSERTION: NO
```

## 16. Single-use approval consumption at execution

Inside the executor transaction:

1. acquire all locks in §15 order;
2. verify approval is current `APPROVED`, non-expired, non-revoked and not previously consumed;
3. recheck approver/executor account-security/session state under locked rows;
4. recheck request, source, assignment, match, target, normalizer and policy versions;
5. re-hash exact action graph and compare approval digest;
6. mark approval `CONSUMED` and request `EXECUTING` inside transaction;
7. apply only approved target decisions, terminalize reservations/case/request;
8. append audit/outbox and commit once.

Conversion/audit failure rolls back approval consumption, request transition and all target changes. A retry with same committed result returns that result without second approval use. A deterministic no-write conflict terminalizes approval as `SUPERSEDED`, not `CONSUMED`.

```text
APPROVAL_CONSUMPTION_ATOMIC_WITH_CONVERSION_COMMIT: YES
APPROVAL_CONSUMED_BEFORE_TARGET_COMMIT_OUTSIDE_TRANSACTION: NO
CONVERSION_FAILURE_MAY_LEAVE_APPROVAL_CONSUMED_WITHOUT_OUTCOME: NO
```

## 17. Atomic conversion graph

One completed request has one database commit boundary:

```text
approved Guardian decisions
+ approved Student decisions
+ approved Relationship decisions
+ profile reservations terminalized
+ case status CONVERTED
+ request status COMPLETED
+ approval status CONSUMED
+ terminal outcome digest
+ audit/outbox
```

Multiple Guardians/Students remain atomic across the whole graph in initial rollout. No “keep successful subset.” `DO_NOT_CREATE_*` is an explicit approved outcome, not a partial failure.

```text
F23_3E_CONVERSION_GRAPH_ALL_OR_NOTHING: YES
PARTIAL_GUARDIAN_STUDENT_GRAPH_COMMIT_ALLOWED: NO
CASE_CONVERTED_WITH_PARTIAL_ACTION_GRAPH_ALLOWED: NO
APPROVAL_CONSUMED_WITHOUT_COMPLETED_OR_ROLLED_BACK_OUTCOME_ALLOWED: NO
```

## 18. Failure, rollback and compensation

### 18.1 Same database domain

Stale source/target/assignment/match/policy/security, duplicate appearance, relationship conflict, reservation conflict, approval invalidity or audit/outbox insert failure rolls back the entire transaction. Case does not become `CONVERTED`, request does not become `COMPLETED`, approval is not left consumed and no partial profile/link remains.

Outbox delivery failure after a committed outbox row does not roll back committed conversion; delivery retries idempotently from durable outbox. Audit/outbox row insertion itself is inside the conversion transaction and must succeed.

### 18.2 External dependency future

Only a genuine cross-domain dependency may use a reviewed reservation/saga. Saga state binds exact request, approval, action, target, external operation ID and versions. It must have single claim, lease/expiry, idempotent finalize/cancel, immutable audit and recovery runbook. It may report `COMPENSATION_REQUIRED`; it may not claim cross-system atomicity.

Compensation never hard-deletes a preexisting or unrelated canonical Guardian/Student/Relationship. A newly created but externally exposed profile is disabled/quarantined only by exact protected policy; destructive cleanup needs separate approval and retention rules.

```text
ROLLBACK_HARD_DELETES_PREEXISTING_PROFILE: NO
COMPENSATION_MAY_DELETE_UNRELATED_CANONICAL_PROFILE: NO
CROSS_DOMAIN_ATOMICITY_MAY_BE_CLAIMED_WITHOUT_SAGA: NO
```

## 19. Preview-to-real UI contract

F23.3D remains a non-authoritative shell. Future UI states:

```text
DRAFT
MATCH_REVIEW_REQUIRED
READY_FOR_REVIEW
APPROVED
EXECUTING
COMPLETED
CONFLICT
REJECTED
```

UI displays planned Guardian/Student/Relationship actions, masked duplicate candidates, explicit no-create decisions, request/approval state, stale warning, safe error and opaque completed target links. It does not receive raw cross-center candidates, full child identity, unmasked contact without exact reveal policy, raw security/policy internals or raw step-up payload.

The current create/merge toggle becomes a draft intent only. `merge` cannot directly select authority; server-reviewed match evidence must produce `REUSE_REVIEWED_GUARDIAN`, `REUSE_REVIEWED_STUDENT` or relationship reuse. Confirm never calls local save or generic table upsert.

## 20. Exact typed server operations

| Operation | Authority + assignment | Current version/policy guards | Input allowlist | Safe response projection | Idempotency | Audit + rate limit | Primary safe errors |
|---|---|---|---|---|---|---|---|
| `crm.conversion.create_draft` | Assigned consultant/request capability; exact center | Case/contact/assignment/root policies | Case ID, source versions, scoped key, initial typed actions | Opaque request ID/version/status, masked summary | Create scope + intent digest | `crm.conversion_draft_created`; per actor/case | not-ready, assignment-stale, idempotency-conflict |
| `crm.conversion.update_draft` | Current requester while `DRAFT`; assigned | Request/source/assignment/action versions | Allowlisted actions/evidence refs/reasons only | New request version + graph digest | Request/version + intent | `crm.conversion_draft_updated`; per request | source-stale, action-graph-invalid |
| `crm.conversion.preview_assigned` | Assigned read capability | Current case/contact/assignment/masking policy | Request/case ID, expected versions | Masked source/actions/candidates only | Safe read correlation | `crm.conversion_previewed`; search/risk bucket | assignment-stale, match-review-required |
| `crm.conversion.submit_review` | Assigned requester capability | Request `DRAFT`, current source/policies | Request version, exact graph digest | `READY_FOR_REVIEW`, version, safe checklist | Request/version | `crm.conversion_review_submitted`; per case | not-ready, policy-stale, graph-invalid |
| `crm.conversion.review_matches` | Approved match reviewer, not client claim | Evidence/normalizer/target/source versions | Opaque candidate/evidence IDs, decision, reason | Masked reviewed outcome/version/expiry | Evidence-set + reviewer intent | `crm.conversion_match_reviewed`; anti-enumeration | insufficient-evidence, target-stale |
| `crm.conversion.approve` | Exact independent approver; no requester self-approval | MFA, fresh step-up, request/source/match/policy/security versions | Request/version, graph digest, purpose, opaque assertion ID | Opaque approval ID/status/expiry/version | Approval request + exact graph | `crm.conversion_approved`; critical approval bucket | approval-required, step-up-required, policy-stale |
| `crm.conversion.reject` | Exact approver/reviewer | Request/version/current authority | Request ID/version, safe reason | Terminal status/version | Same reason/intent returns prior | `crm.conversion_rejected`; approval bucket | conflict, policy-stale |
| `crm.conversion.cancel` | Requester before approval or protected authority after approval | Request/status/assignment/security versions | Request/version, reason | Cancelled/prior terminal state | Request + cancel intent | `crm.conversion_cancelled`; per request | already-completed, conflict |
| `crm.conversion.revoke_approval` | Exact protected revocation capability; never client claim | Root, account-security, request/approval/status/version and server time | Approval/request IDs, expected versions, safe reason | Opaque `REVOKED`/prior terminal state | Approval/version + revoke intent | `crm.conversion_approval_revoked`; critical bucket | approval-consumed, already-completed, security-state-stale |
| `crm.conversion.execute` | Protected server operation; caller trigger is not authority | Exact §15 locks; all source/match/target/policy/security/approval versions | Request ID, idempotency key, expected intent/graph digests | Opaque committed IDs/versions/decisions/correlation | Canonical execute scope §7 | started/completed/conflict; critical rate/deadlock guard | approval expired/revoked/consumed, stale, conflict |
| `crm.conversion.get_status` | Assigned requester or exact approved operator | Current assignment/projection policy; terminal history rule | Opaque request/case ID | Status/versions/safe reason only | Read correlation | Access-denied/status-read; read bucket | assignment-required, not-found-safe |
| `crm.conversion.get_result` | Exact authorized case/result reader | Completed request, current resource/projection authority | Opaque request ID | Prior opaque committed result; no raw candidate/PII | Returns terminal outcome digest | Result-read; anti-scrape bucket | already-completed result or access-denied |

Every endpoint server-derives center, capability and assignment, rejects arbitrary fields, rechecks source/policy versions, applies server masking before serialization and never returns reusable authority. There is no `generic entityType + arbitrary payload` conversion operation.

## 21. Read/write, capability, masking and RLS boundary

F23.3E runtime remains disabled while generic raw CRM read, broad active-member write, browser direct upsert, missing capability/assignment resolver, missing server masking or missing step-up runtime exists. Consultant data uses purpose-specific endpoint or reviewed capability-aware minimal projection only.

```text
F23_3E_UI_ONLY_SECURITY_ALLOWED: NO
F23_3E_BROWSER_DIRECT_TABLE_CONVERSION_ALLOWED: NO
F23_3E_GENERIC_CLOUD_WRITE_CONVERSION_ALLOWED: NO
F23_3E_RUNTIME_REQUIRES_RLS_AND_READ_PATH_REMEDIATION: YES
```

No raw PII is shipped for browser masking. Reassign/unassign invalidates current assigned access; stale JWT/cache/localStorage cannot authorize conversion. Error, audit, trace, realtime, search/export and cache paths follow the same projection boundary.

## 22. Audit events and safe errors

Minimum audit/outbox events:

```text
crm.conversion_draft_created
crm.conversion_draft_updated
crm.conversion_review_submitted
crm.conversion_match_reviewed
crm.conversion_approved
crm.conversion_approval_revoked
crm.conversion_execution_started
crm.conversion_completed
crm.conversion_conflict
crm.conversion_rejected
crm.conversion_cancelled
crm.profile_creation_reserved
crm.guardian_created
crm.guardian_reused
crm.student_created
crm.student_reused
crm.relationship_created
crm.relationship_reused
crm.relationship_exception_approved
crm.conversion_access_denied
```

Audit contains opaque IDs, exact center, safe decision/reason, actor, assignment, versions and request/idempotency correlation. It excludes raw phone/email/address, full birth/child identity, credential, OTP/recovery/factor data, assertion payload, raw candidate detail and SQL/RLS internals.

Safe errors:

```text
crm_conversion_not_ready
crm_conversion_source_stale
crm_conversion_assignment_stale
crm_conversion_policy_stale
crm_conversion_action_graph_invalid
crm_conversion_idempotency_conflict
crm_conversion_match_review_required
crm_conversion_insufficient_identity_evidence
crm_conversion_target_stale
crm_conversion_relationship_conflict
crm_conversion_approval_required
crm_conversion_approval_expired
crm_conversion_approval_revoked
crm_conversion_approval_consumed
crm_conversion_step_up_required
crm_conversion_security_state_stale
crm_conversion_already_completed
crm_conversion_conflict
crm_conversion_compensation_required
crm_security_service_unavailable
```

Errors do not disclose another center, candidate count/details, Auth existence, raw contact, private student/finance state or internal implementation.

## 23. Race matrix F3E-R1–F3E-R24

| ID / Race | Actor A | Actor B | Shared root/mutex | Canonical lock order | Winner | Loser outcome | Audit result |
|---|---|---|---|---|---|---|---|
| F3E-R1 Two requests same case | Requester A create draft | Requester B create draft | Center root + case + idempotency/preallocated request | Root → case → assignment → request/idempotency → audit | First compatible intent or existing active request | Same intent gets prior request; different intent `crm_conversion_conflict`; no second executable request | One create plus safe idempotent/conflict event |
| F3E-R2 Two retries same key | Executor retry A | Executor retry B | Root + mutexes + security + request/approval | Full §15 order | First commit or already committed outcome | Returns exact pending/terminal outcome; no second target write/approval consume | One completion; retries correlated, no duplicate success |
| F3E-R3 Same key different graph | Execute graph A | Execute graph B | Root + request/idempotency | Full §15 order, digest checked at request | Prior registered intent | `crm_conversion_idempotency_conflict`; graph B never reaches targets | Conflict with opaque digests only |
| F3E-R4 Two cases create same Guardian | Case A executor | Case B executor | Center root + shared guardian identity mutexes | Root → sorted mutexes → security → request → targets | First valid conversion | Re-runs match under mutex; enters review or explicit reviewed reuse, never blind create | Create/review events without raw identity |
| F3E-R5 Two cases create same Student | Case A executor | Case B executor | Center root + shared student identity mutexes | Same as R4 | First valid conversion | Recheck sees target/candidate; conflict/review/reuse policy, no duplicate Student | Student create once; second safe conflict/review |
| F3E-R6 Guardian create vs edit | Conversion executor | Guardian profile editor | Center root + identity mutex + preallocated guardian ID | Both follow root/mutex/security/request/profile order for overlap | First committed version | Other gets `crm_conversion_target_stale`; no lost update | Winner mutation + stale conflict |
| F3E-R7 Student create vs edit | Conversion executor | Student profile editor | Center root + identity mutex + preallocated student ID | Root/mutex then account/request then Student | First committed version | Other rechecks target version and fails; enrollment status untouched | Winner + safe target-stale event |
| F3E-R8 Relationship create vs role update | Conversion executor | Relationship service | Center root + endpoint mutexes + relationship ID/pair | Guardian → Student → Relationship tier | First current semantic transition | Other detects existing/version/role conflict; requires review, no duplicate row | Create or role update plus conflict audit |
| F3E-R9 Reassign vs submit review | Assignment authority | Assigned requester | Center root + case + assignment/request | Root → case → assignment → request for submit protocol | First version transition | Stale requester gets `crm_conversion_assignment_stale`; graph not submitted | Reassign and denied submit correlation |
| F3E-R10 Reassign vs execute | Assignment authority | Protected executor | Center root + security + request/case/assignment | Overlapping tiers follow §15; no assignment-first inversion | First committed root/version mutation | Executor or reassign rechecks; stale path fails with no target mutation | Winner plus stale/conflict event |
| F3E-R11 Approval vs source edit | Approver | Assigned source editor | Center root + request/case/contact | Approval locks root/security/assertion/request; edit locks root/case/contact | First version commit | Approval sees stale source or edit invalidates/supersedes approval; no stale execution | Approval denied/superseded and source edit audit |
| F3E-R12 Approval revoke vs execute | Revoker | Executor | Root + security rows + approval/request | Root → mutexes if graph-bound → security → approval/request | First approval transition under locks | Execute sees `REVOKED`, or revoke sees `CONSUMED/COMPLETED`; no half state | Exactly one revoke or completion terminal event |
| F3E-R13 Approval expiry vs execute | Server-time expiry transition | Executor | Root + security + approval/request | Same security-before-approval order | Locked current-time evaluation | Expired approval cannot execute; if commit preceded expiry instant, consumed completion is authoritative | Expire or completion, never both success |
| F3E-R14 Security/session revoke vs execute | Account security service | Executor | Account-security row; executor also holds business roots first | Security-only revoke never waits business row; executor waits/rechecks account lock | Revoke commit or executor lock acquisition first | If revoke first, executor `crm_conversion_security_state_stale`; if executor holds lock, revoke waits until atomic commit then invalidates future authority | Both events ordered by versions; no missed revoke |
| F3E-R15 Policy change vs execute | Policy authority | Executor | Center CRM root + request/policy versions | Root first, then executor canonical tiers | First root/policy version commit | Executor stale policy denies or policy waits and applies after completed graph; no mixed policy | Policy change and conversion outcome version-linked |
| F3E-R16 Match review vs duplicate create | Reviewer | Other conversion | Identity mutex equivalence class | Root → all sorted identity mutexes → match/targets | First match/profile commit | Other review invalidated/re-run; no reviewed evidence without current mutex recheck | Match review/create plus safe invalidation |
| F3E-R17 Normalizer rollout vs pending review | Migration controller | Pending reviewer/executor | Normalizer barrier + identity mutex keys | Drain barrier or sorted dual old/new keys before mutation | Approved barrier state | Pending evidence expires/restarts; no old/new concurrent creates | Migration barrier and review invalidation audit |
| F3E-R18 Two executors same request | Worker A | Worker B | Root + mutexes + security + same request/approval | Full §15 order | One locks/consumes approval and commits | Other returns prior outcome or `crm_conversion_approval_consumed`; no second graph | One execution-start/completed success |
| F3E-R19 Retry after timeout | Original worker uncertain | Retry worker | Idempotency registry + request/approval | Resolve root/request terminal state before new execution | Existing committed result if present | Returns exact result; if no commit, same approval may retry because prior consumption rolled back | Correlation links attempt to one outcome |
| F3E-R20 Audit/outbox failure | Executor | Audit store failure | Same transaction/audit tier | Full §15 through audit before commit | No conversion winner | Whole transaction rolls back approval/request/targets/reservations; retry remains possible | Failure telemetry outside business audit may alert; no committed success audit |
| F3E-R21 Case cancel vs execute | Authorized canceller | Executor | Center root + request/case | Root/security/request before case | First eligible terminal transition | Execute sees cancelled or cancel sees executing/completed and safe conflicts | One cancellation or completion terminal event |
| F3E-R22 Target archive vs execute | Profile governance | Executor | Root + identity mutex + target profile | Both use canonical overlapping root/mutex/security/profile tiers | First target version/status commit | Executor target-stale/archived or archive waits then re-evaluates; no reuse of archived target | Archive or conversion plus safe stale event |
| F3E-R23 Two primary-contact updates | Conversion A | Relationship update B | Center root + student/relationship invariant rows | Root/mutex/security/request → Student → sorted Relationships | First invariant-valid commit | Other gets relationship conflict/review; exactly-one policy preserved | Primary decision and rejected conflict audit |
| F3E-R24 Legacy projection vs canonical relationship | Projection adapter | Conversion/relationship writer | Canonical relationship version + projection checkpoint | Canonical write commits first; adapter consumes committed outbox/version | Canonical relationship authority | Stale adapter discards/rebuilds projection; never reverse-writes authority | Canonical event + projection checkpoint/divergence event |

Unique constraints are integrity backstops in every race, never the only serialization mechanism.

## 24. Negative matrix F3E-N1–F3E-N40

| ID | Negative case | Exact fail-closed outcome |
|---|---|---|
| F3E-N1 | Browser đổi `center_id` | Server-derived center mismatch → `crm_center_scope_denied`; no candidate lookup, request/target write or cross-center existence disclosure; safe access-denied audit. |
| F3E-N2 | Consultant execute case không assigned | `crm_conversion_assignment_stale`; executor authority is server-only, case/PII/result not disclosed and no request/target mutation. |
| F3E-N3 | Client tự set `APPROVED` | Schema/authority guard ignores field and returns `crm_conversion_approval_required`; request stays current pre-approval state, no assertion/approval/target write. |
| F3E-N4 | Client tự set `COMPLETED` | Server rejects terminal status mutation; case/request versions unchanged, no fabricated result links, safe escalation audit. |
| F3E-N5 | Request thiếu action graph | `crm_conversion_action_graph_invalid`; cannot submit/approve, no identity locks or reservations consumed, draft remains fixable. |
| F3E-N6 | Missing relationship decision | Reject incomplete graph with `crm_conversion_relationship_conflict`; both endpoints cannot silently commit without exact pair outcome. |
| F3E-N7 | Duplicate pair decisions | Graph validation returns conflict; no approval/execution, duplicate actions remain review evidence rather than arbitrary first-wins. |
| F3E-N8 | Guardian target center khác | Exact-center target join fails opaque; no target/candidate disclosure or reuse, request conflict and no local fallback merge. |
| F3E-N9 | Student target center khác | Same exact-center deny; child identity/count hidden, request not approved/completed and no cross-center relationship. |
| F3E-N10 | Phone-only match auto reuse | Forbidden evidence-only decision; force duplicate review, target untouched and phone excluded from audit/mutex raw values. |
| F3E-N11 | Name-only Student match | `crm_conversion_match_review_required`; no Student reuse/create authority from name, source request remains reviewable. |
| F3E-N12 | Possible match bị coi là `NO_MATCH` | Policy/outcome mismatch invalidates evidence; block create-new/reuse, rerun reviewed matching under current mutexes. |
| F3E-N13 | Insufficient evidence vẫn create-new | `crm_conversion_insufficient_identity_evidence`; reservation/profile not created, request returns review/block checklist. |
| F3E-N14 | Source contact stale | `crm_conversion_source_stale`; approval superseded or execution rolled back, no target/case terminal mutation. |
| F3E-N15 | Source case stale | Case/version/status recheck fails; request moves safe conflict/review via protected transaction, no conversion graph. |
| F3E-N16 | Assignment stale | Current assignment lock/version denies requester/executor path; stale consultant loses PII and mutation authority immediately. |
| F3E-N17 | Match decision stale | Expired/version-mismatched review evidence cannot reuse/create; rerun masked review under identity mutex, no target write. |
| F3E-N18 | Policy version stale | Root/policy mismatch returns `crm_conversion_policy_stale`; approval invalidated, all target/reservation rows unchanged. |
| F3E-N19 | Approval expired | Locked approval + server time returns `crm_conversion_approval_expired`; no consume, execute or target/case mutation; request requires new review/approval. |
| F3E-N20 | Approval revoked | Locked status returns `crm_conversion_approval_revoked`; executor cannot race past revoke, no target write and revocation remains terminal. |
| F3E-N21 | Approval already consumed | Return exact prior committed result if same idempotent intent, otherwise `crm_conversion_approval_consumed`; never execute graph twice. |
| F3E-N22 | Approver security/session version stale | Locked account-security state mismatch → `crm_conversion_security_state_stale`; no unlocked-version fallback or target mutation. |
| F3E-N23 | Action graph khác approved digest | `crm_conversion_action_graph_invalid`; approval cannot expand target/action, request stays conflict/superseded and no mutation occurs. |
| F3E-N24 | Same idempotency key different intent | `crm_conversion_idempotency_conflict`; prior registry/outcome immutable, no overwrite or second approval consumption. |
| F3E-N25 | Two executors same request | Root/request/approval locks allow one consumption/commit; loser returns exact outcome/consumed code, no duplicate success audit. |
| F3E-N26 | Two cases create same Guardian | Shared identity mutex serializes; second rechecks and enters review/reuse conflict, never blind duplicate or phone merge. |
| F3E-N27 | Two cases create same Student | Shared Student evidence mutex serializes; second rechecks current candidate/target and cannot create without renewed approval. |
| F3E-N28 | Create-new locks empty profile set | Contract/test failure; operation must acquire center root + full identity mutex + request/reservation, otherwise no create. |
| F3E-N29 | Unique constraint được dùng thay mutex | Architecture guard blocks runtime path; uniqueness may rollback as last backstop but cannot provide reviewed deterministic outcome. |
| F3E-N30 | Student mới mặc định `Đang theo học` | `CREATE_NEW_STUDENT` blocked until approved unenrolled mapping; no Student/enrollment/class/status record is created. |
| F3E-N31 | Guardian created, Student action fails | Whole same-domain transaction rolls back Guardian, reservation, approval/request and audit; case remains unconverted. |
| F3E-N32 | Relationship fails after profiles created | Whole graph rolls back both profile mutations/references and relationship; no orphan pair or consumed approval. |
| F3E-N33 | Case converted nhưng request chưa completed | Atomic invariant rejects/rolls back case transition; no `CONVERTED` visibility without completed request/outcome digest. |
| F3E-N34 | Approval consumed nhưng audit fails | Same transaction rolls back approval consumption, request/targets/case/reservations; no unaudited conversion. |
| F3E-N35 | Security revoke đồng thời execute | Shared account-security lock orders events; if revoke first executor denies stale, if execute holds lock revoke waits until commit; no missed concurrent revoke. |
| F3E-N36 | Assignment reassign đồng thời execute | Shared center/case/assignment protocol and version check produce one current transition; stale path rolls back with no person ownership transfer. |
| F3E-N37 | Normalization version đổi khi review pending | Drain/dual-key barrier invalidates or migrates review; no execute under mixed key versions and no parallel profile creation. |
| F3E-N38 | Legacy parent fields tự tạo relationship | Reverse inference forbidden; fields remain snapshot/projection, explicit reviewed action graph is required and no relationship row appears. |
| F3E-N39 | Conversion tự tạo Tuition/Auth/Class | Typed allowlist rejects every finance/Auth/membership/enrollment/schedule/attendance/payment side effect; graph rolls back if attempted. |
| F3E-N40 | Generic direct table write bypass executor | RLS/server boundary must deny; runtime remains blocked while bypass exists, no browser payload can set request/approval/targets directly. |

## 25. Threat model F3E-T1–F3E-T28

| ID / Threat | Likelihood | Impact | Mitigation | Residual risk | Implementation phase |
|---|---|---|---|---|---|
| F3E-T1 Cross-center IDOR | High | Critical | Server-derived exact center, same-center joins, opaque errors, no cross-center lookup | Resource-center mapping defect | Foundation + direct-API QA |
| F3E-T2 Client-forged approval | High | Critical | Server approval row, exact capability, graph/version binding; ignore client status | Alternate untyped endpoint | Approval service QA |
| F3E-T3 Consultant self-approval | Medium/High | Critical | Requester/approver separation and exact capability policy | Misconfigured supervisor catalog | Capability/approval QA |
| F3E-T4 Step-up replay | Medium | Critical | Fresh exact-purpose assertion consumed atomically at approval | Distributed assertion-store defect | F23.13C integration tests |
| F3E-T5 Approval reuse | Medium | Critical | Locked durable approval, single-use consume with conversion commit | Bypass endpoint skips approval status | Executor/direct-API QA |
| F3E-T6 Approval/execution race | Medium | Critical | Root → account-security → request/approval serialization; expiry/revoke recheck | Clock/policy implementation defect | Concurrency tests |
| F3E-T7 Security-revoke race | Medium | Critical | Lock approver/executor account-security rows before approval/targets; no unlocked version read | Security service availability | Security concurrency QA |
| F3E-T8 Assignment-reassign race | High | High | Shared center/case/assignment roots and version recheck | Long request retries | Assignment concurrency QA |
| F3E-T9 Stale action graph | High | Critical | Canonical digest + request/action versions + exact approved payload only | Digest canonicalization defect | Graph contract tests |
| F3E-T10 Idempotency collision/misuse | High | High | Environment/center/case/operation scope + intent digest; different intent conflicts | Bad client key hygiene | Idempotency tests |
| F3E-T11 Duplicate Guardian race | Medium | High | Stable center root + all guardian identity mutexes + match recheck/reservation | Sparse identity evidence | Identity concurrency QA |
| F3E-T12 Duplicate Student race | Medium | High/Critical | Student evidence mutexes, child-safe review and preallocated reservation | Incomplete birth evidence | Identity concurrency QA |
| F3E-T13 Duplicate Relationship race | Medium | High | Endpoint locks, semantic version check, exactly-one pair outcome | Role catalog conflict | Relationship service QA |
| F3E-T14 Empty-set locking | Medium | Critical | Pre-existing center root and identity mutex; explicit no-empty-set markers | Alternate create shortcut | Architecture/deadlock tests |
| F3E-T15 Unique-as-mutex defect | Medium | High | Unique only backstop; shared mutex and reviewed outcome required | Database-only implementation shortcut | Code/design review |
| F3E-T16 Insufficient-evidence creation | High | High/Critical | `INSUFFICIENT_EVIDENCE` blocks create; policy minimum and reviewer evidence | Reviewer error/social engineering | Match policy/manual QA |
| F3E-T17 Normalization drift | Medium | High | Drain or deterministic dual-key/equivalence barrier | Alias migration defect | Normalizer migration QA |
| F3E-T18 Partial graph commit | Medium | Critical | One transaction for full Guardian/Student/Relationship/case/request/approval/audit graph | Future cross-domain coupling | Transaction/failure QA |
| F3E-T19 Audit failure | Medium | Critical | Audit/outbox insert in transaction; fail/rollback mutation | Durable outbox outage | Audit failure tests |
| F3E-T20 Compensation deletes wrong profile | Low/Medium | Critical | Bind exact request/approval/action/target/versions; no hard-delete preexisting profile | Operator mistakes in incident flow | Compensation runbook QA |
| F3E-T21 Legacy dual-write divergence | High | High | Canonical Relationship authority, projection adapter, version/outbox/divergence detector | Old UI writes embedded fields | Compatibility phase QA |
| F3E-T22 Student enrollment-status conflation | High | High | Separate profile/enrollment model; block create-new until approved mapping | Product delay creates pressure for shortcut | Student model gate |
| F3E-T23 Generic cloud write bypass | High while present | Critical | Typed operations; disable browser/generic conversion write; RLS remediation | Forgotten direct API path | RLS/direct-API QA |
| F3E-T24 Generic raw read/PII leak | High while present | Critical | Capability-aware minimal projection and server masking before response | Realtime/export/cache path missed | Read-path inventory QA |
| F3E-T25 Cached PII after unassign | Medium | Critical | Current assignment/security recheck, no-store reveal, invalidation/outbox | Screenshots or browser extension | F23.13D integration QA |
| F3E-T26 Auto-create finance/enrollment/Auth | Medium | Critical | Immutable typed deny; conversion target allowlist only | Product integration shortcut | Cross-domain negative QA |
| F3E-T27 Alternate executor endpoint | Medium | Critical | One protected operation catalog, direct-table deny, contract tests on every route | Shadow/admin endpoint drift | Architecture/direct-API QA |
| F3E-T28 Outbox/notification delivery ambiguity | Medium | High | Commit durable outbox with graph; idempotent delivery and terminal outcome query | Delayed user notification | Outbox/recovery QA |

## 26. Approval gates F3E-AG1–F3E-AG20

| ID / Gate | Recommended default | Lý do | Rủi ro | Approver | Implementation phase |
|---|---|---|---|---|---|
| F3E-AG1 Student chưa enrolled dùng model nào? | Tách `student_profile_status` khỏi `enrollment_status`; chưa duyệt thì block `CREATE_NEW_STUDENT` | Profile existence không chứng minh enrollment | Vocabulary/migration complexity | Product + Student owner + Architecture | Student model foundation |
| F3E-AG2 Ai được request conversion? | Assigned consultant với `crm.conversion.request_assigned`; approved CRM operator tương đương | Least privilege theo resource | Assignment operations bottleneck | Security + CRM owner | Request service |
| F3E-AG3 Ai được approve? | Owner/Center Admin hoặc CRM supervisor có exact approved capability | Independent authority | Privileged approval abuse | Security + Product + Operations | Approval policy |
| F3E-AG4 Consultant có self-approve không? | NO; requester/consultant cannot self-approve | Separation of duty và chống client claim | Approval latency | Security + Architecture | Capability catalog |
| F3E-AG5 Approval TTL bao lâu? | Short-lived; đề xuất 15 phút, cần Product/Security approval | Giảm stale source/security window | Reviewer/operator retry friction | Security + Product | Approval service |
| F3E-AG6 Approval single-use hay reusable? | Single-use; never reusable for another execution | Một approval chỉ cho một exact committed graph | Retry cần idempotent prior outcome | Security + Architecture | Executor |
| F3E-AG7 Execute tự động sau approve hay operator trigger? | Protected executor trigger after approval; browser never direct-mutates | Deterministic server authority | Worker delay/operational confusion | Product + Architecture + Operations | Executor orchestration |
| F3E-AG8 Một case có nhiều active request không? | Một executable request, nhiều historical attempts | Tránh competing approvals/outcomes | Supersede workflow phức tạp | CRM owner + Architecture | Request lifecycle |
| F3E-AG9 Create-new minimum evidence? | Versioned policy-defined minimum; insufficient evidence is not no-match | Chống duplicate/identity guessing | More manual review | Privacy + CRM/Student owners | Match policy |
| F3E-AG10 Phone/email confidence rule? | Candidate evidence only; never auto-link/merge/reuse | Chống takeover và shared contact ambiguity | Reviewer workload | Privacy + Security | Identity matching |
| F3E-AG11 Student birth evidence policy? | Minimize/mask; combine approved evidence, never name-only; exact requirements need Privacy approval | Child-data safety | Sparse data may block create/reuse | Privacy + Student owner | Match review |
| F3E-AG12 Multi-guardian conversion atomic toàn graph không? | YES; atomic across the full graph in initial rollout | Không orphan profile/relationship/case outcome | Larger transaction/lock contention | Architecture + Product | Executor transaction |
| F3E-AG13 Approved no-relationship exception khi nào? | Only explicit documented exception with no primary/safeguarding violation | Missing row cannot become implicit business choice | Exceptional family cases require review | Product + Safeguarding + Privacy | Relationship policy |
| F3E-AG14 Primary contact invariant? | Exactly one active primary after family conversion unless approved no-guardian exception | Deterministic operational contact | Complex shared-care arrangements | Product + Operations + Privacy | Relationship service |
| F3E-AG15 Legacy embedded parent fields? | Canonical Relationship authority + projection adapter; no ad hoc client dual-write | Prevent reverse-inference/divergence | Old UI compatibility work | Architecture + Product | Compatibility package |
| F3E-AG16 Backfill legacy data thuộc phase nào? | Separate migration/review phase after canonical services | Existing fields are evidence, not authority | Long-lived mixed model | Data owner + Privacy + Architecture | Migration package |
| F3E-AG17 Compensation hard-delete profile? | NO for preexisting/canonical profiles; protected quarantine/disable only if approved | Avoid deleting unrelated valid identity/history | Manual cleanup burden | Security + Data owner + Legal | Compensation runbook |
| F3E-AG18 Cross-center duplicate lookup? | NO initial rollout; exact-center evidence only | Prevent privacy leak/cross-center merge | Duplicate center-scoped profiles | Security + Privacy | Future central authority |
| F3E-AG19 Production rollout feature flag? | YES, server-authoritative center allowlist + kill switch | Controlled cohort and rollback | Flag drift/inconsistent clients | Product + SRE + Security | Rollout |
| F3E-AG20 Điều kiện bật runtime? | Only after backend/root/mutex/reservations, typed endpoints, RLS/read remediation, resolver/masking, step-up, audit/outbox and concurrency/manual QA | Whole authority chain must fail closed | Delays go-live | Security + Architecture + Product | Production gate |

## 27. Future implementation decomposition

This is sequencing only; no package is implemented by F23.3E design.

### Package 1 — Canonical CRM foundation

- exactly-one center CRM root;
- contact/case/candidate schemas and versions;
- request/idempotency registry;
- assignment versions;
- immutable audit/transactional outbox.

### Package 2 — Identity and duplicate review

- versioned normalization;
- identity mutex registry;
- masked candidate projections;
- reviewed match evidence;
- profile-creation reservations.

### Package 3 — Approval and executor

- F23.13C fresh-step-up approval;
- durable single-use approval;
- account-security/revocation serialization;
- protected atomic Guardian/Student/Relationship executor.

### Package 4 — Compatibility and UI wiring

- F23.3D preview → server draft/review;
- masked review and status/result UI;
- canonical legacy projection adapter;
- feature flag and backfill plan.

### Package 5 — Production hardening

- RLS and complete read-path remediation;
- direct API, race/deadlock and failure/outbox tests;
- safe fixtures and manual multi-account/multi-center QA;
- rollout, rollback and compensation runbook.

## 28. Implementation blockers

Runtime remains blocked on all of:

- canonical center-scoped CRM backend;
- exactly-one `center_crm_control` root;
- typed request/approval/executor services;
- scoped idempotency registry and committed result store;
- identity mutex registry and normalization migration protocol;
- profile-creation reservations/preallocated IDs;
- Guardian canonical service;
- approved Student profile/enrollment status decision;
- explicit M:N Relationship service and primary/safeguarding policy;
- duplicate-review workflow and masked projections;
- case/resource assignment service;
- F23.13D canonical capability resolver and exact consultant policies;
- F23.13C MFA/fresh step-up and assertion atomicity;
- account security/session invalidation and executor locking integration;
- server-side masking and complete read-path inventory;
- broad RLS/generic write remediation;
- immutable audit/transactional outbox;
- legacy compatibility projection/divergence adapter;
- server-authoritative feature flag/kill switch;
- direct API/RLS tests;
- concurrency/deadlock/race tests;
- stale-version, rollback, audit/outbox and compensation tests;
- safe non-PII fixtures;
- manual QA and production approval.

```text
F23_3E_IMPLEMENTATION_READINESS: BLOCKED
F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
```

## 29. Final technical audit closeout

External final technical audit đã `PASS`. The detailed design is closed for checkpoint and implementation planning. It does not mean runtime or production is ready; roadmap is now synchronized as `F23.3E DONE design`, never runtime/implementation done.

```text
F23.3E IMPLEMENTATION PLANNING: SAFE TO START
```

Semantic smoke for this document is a docs-contract test, not proof that conversion, backend, RLS, Auth, step-up, account security, masking or audit/outbox runtime exists.

F23.3E FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT
