# F23.12D — Controlled Platform Owner bootstrap, assignment và revoke drill

Ngày chốt design: 2026-07-29

```text
F23_12D_STATUS: DONE DESIGN
F23_12_STATUS: DESIGN COMPLETE
F23_12A_FINAL_TECHNICAL_AUDIT: PASS
F23_12B_FINAL_TECHNICAL_AUDIT: PASS
F23_12C_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
F23_12D_IMPLEMENTATION_READINESS: BLOCKED
F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED
CANONICAL_MACHINE_ROLE: platform_owner
PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES
HARDCODED_OPERATOR_EMAIL_ALLOWED: NO
CLIENT_SELF_GRANT_ALLOWED: NO
OWNER_OR_CENTER_ADMIN_SELF_GRANT_ALLOWED: NO
BROWSER_PRIVILEGED_CREDENTIAL_ALLOWED: NO
UNIVERSAL_RLS_BYPASS_ALLOWED: NO
SELF_APPROVAL_ALLOWED: NO
FIRST_PLATFORM_OWNER_BOOTSTRAP_IS_NORMAL_IN_APP_GRANT: NO
SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES
REAL_PLATFORM_OWNER_ASSIGNMENT: NO
REAL_ACCOUNT_ID_RESOLVED_IN_REPO: NO
REAL_ACCOUNT_EMAIL_STORED_IN_REPO: NO
PLATFORM_OWNER_TARGET_RESOLVED_BY_IMMUTABLE_USER_ID: YES
EMAIL_IS_CANONICAL_PLATFORM_AUTHORITY: NO
TARGET_IDENTITY_REQUIRES_SECOND_CHANNEL_VERIFICATION: YES
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: NO
BOOTSTRAP_BLOCKED_WITHOUT_CANONICAL_ACCOUNT_LIFECYCLE: YES
ACCOUNT_LIFECYCLE_DEPENDENCY_ERROR_FAILS_CLOSED: YES
FIRST_OPERATOR_USES_CONTROLLED_BOOTSTRAP_EXCEPTION: YES
SECOND_OPERATOR_USES_NORMAL_PROTECTED_GRANT: YES
ONE_PLATFORM_OWNER_ENABLES_WRITE_OR_SENSITIVE_ACCESS: NO
LEGACY_INTERNAL_CENTERS_ROUTE_IS_PLATFORM_CONSOLE: NO
RECOMMENDED_PLATFORM_CONSOLE_ROUTE: #/internal/platform/centers
F23_12D_ROUTE_CHANGE: NO
ACTING_START_LOCK_TARGET: ACTIVE_PLATFORM_ASSIGNMENT_ROW
ACTING_CANONICAL_LOCK_ORDER_DEFINED: YES
PLATFORM_AUTHORITY_GLOBAL_MUTEX_REQUIRED: YES
EMPTY_ASSIGNMENT_SET_PROVIDES_BOOTSTRAP_SERIALIZATION: NO
FIRST_BOOTSTRAP_ASSIGNMENT_ROW_EXISTS_BEFORE_BOOTSTRAP: NO
PLATFORM_AUTHORITY_MUTATION_LOCK_TARGET: GLOBAL_AUTHORITY_CONTROL_ROW
GLOBAL_AUTHORITY_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE
FIRST_BOOTSTRAP_COMPLETION_IS_REVERSIBLE: NO
RECOVERY_BOOTSTRAP_REOPENS_FIRST_BOOTSTRAP: NO
ACTING_START_REQUIRES_GLOBAL_AUTHORITY_MUTEX: NO
AUTHORITY_MUTATION_REQUIRES_GLOBAL_AUTHORITY_MUTEX: YES
GLOBAL_AUTHORITY_CONTROL_LOCK_PRECEDES_ASSIGNMENT_LOCKS: YES
AUTHORITY_MUTATION_LOCK_ORDER_INVERSION_ALLOWED: NO
CONCURRENT_FIRST_BOOTSTRAPS_CAN_BOTH_COMMIT: NO
FIRST_BOOTSTRAP_EXCEPTION_MAY_CREATE_SECOND_OPERATOR: NO
EXECUTION_ENVELOPE_BINDS_ENVIRONMENT_FINGERPRINT: YES
EXECUTION_ENVELOPE_BINDS_AUTHORITY_SCHEMA_VERSION: YES
EXECUTION_ENVELOPE_BINDS_GLOBAL_CONTROL_VERSION: YES
EXECUTION_ENVELOPE_BINDS_BOOTSTRAP_EPOCH: YES
CROSS_ENVIRONMENT_PAYLOAD_REPLAY_ALLOWED: NO
CROSS_SCHEMA_PAYLOAD_REPLAY_ALLOWED: NO
REVOKED_ASSIGNMENT_ROW_MAY_BE_REACTIVATED: NO
REVOKE_INVALIDATES_ACTING_SESSIONS: YES
REVOKE_INVALIDATES_PENDING_APPROVALS: YES
OLD_TOKEN_OR_CACHE_OVERRIDES_REVOKE: NO
RUNTIME_CHANGE: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
SUPABASE_ACTION: NOT RUN
AUTH_MUTATION: NOT RUN
DEPLOY: NOT RUN
COMMIT: NOT RUN
PUSH: NOT RUN
```

## 1. Kết luận thiết kế

**DESIGN PROPOSAL:** F23.12D chốt một protected, fail-closed process để bootstrap Platform Owner đầu tiên, enroll Platform Owner thứ hai, suspend/revoke, diễn tập invalidation và recovery. Target chỉ được resolve trong controlled execution window bằng immutable Auth `user_id` phía server/operator environment sau two-person identity review. Repo không chứa email, ID tài khoản thật, credential hoặc payload thực thi.

**DESIGN PROPOSAL:** First operator là controlled bootstrap exception có change ticket, reviewer ngoài hệ thống và executor khác người. Nó không giả lập in-app approver và không mở write/sensitive access. Second operator dùng normal protected grant với requester/approver/target separation. Write acting, sensitive read và additional approval vẫn disabled cho tới khi có hai distinct active Platform Owners, revoke drill PASS và explicit release approval.

**DEFERRED:** authority schema/service, canonical account lifecycle, operator tool, RLS/RPC/API, token/session invalidation implementation, route/UI, assignment thật và deploy. Tài liệu này không phải authorization để thực thi.

## 2. Boundary route và product surface

| Surface | Route | Authority | Data | F23.12D action |
| --- | --- | --- | --- | --- |
| Legacy Internal Center Console | `#/internal/centers` | Active `owner` membership của current center | Center-scoped; center switch bootstrap operational data | Không đổi, không biến thành Platform Console |
| Proposed Global Internal Console | `#/internal/platform/centers` | Active server-side `platform_owner` assignment | Platform governance inventory; không center operational data | Design only; route chưa triển khai |

Assignment thành công trong phase implementation sau không tự tạo route mới, không thay legacy guard và không bootstrap Global Console bằng `currentCenterId` hay membership.

## 3. Boundary kế thừa A–C

1. `platform_owner` độc lập `center_members`; Owner/Center Admin không cấp hoặc duyệt global authority.
2. Không hardcode email, frontend allowlist, local storage, `user_metadata`, membership hoặc client claim làm authority.
3. Không browser privileged credential, public self-grant RPC, generic RLS bypass hoặc persistent bootstrap backdoor.
4. Global Console, membership context và acting context loại trừ lẫn nhau.
5. Acting không impersonate, không tạo membership, bind `auth.uid()`, exact center/scope/version/TTL.
6. Low-risk read dùng `POLICY_SELF_START`; write/sensitive dùng second operator, distinct activation/action approvals.
7. Acting start dùng stable active assignment-row mutex, canonical lock order và effective-active checks.
8. Authority/approval/acting mutation phải atomic với audit hoặc transactional outbox.
9. Revoked assignment không revive; restore tạo proposal/assignment mới có history link.

## 4. Repo audit

| Foundation | Kết luận | Evidence/impact |
| --- | --- | --- |
| Auth bootstrap | **REPO FACT:** client có Supabase session/sign-in/sign-out; server account functions verify bearer bằng Auth user lookup | Không phải global authority/bootstrap service |
| Current membership binding | **REPO FACT:** current-center resolution và legacy console dùng active `center_members`; revoked/paused/no membership chặn center bootstrap | Membership không được dùng cho Platform Owner |
| Account operations | **REPO FACT:** server functions create/list/reset/revoke/restore center admin dùng server-held privileged credential, verified actor, request/idempotency patterns | **PARTIAL FOUNDATION:** center-scoped Owner guard/email lookup không được reuse cho global grant |
| Account audit | **REPO FACT:** `account_audit_logs` có actor/action/target/center/before/after/reason/request/time fields | **PARTIAL FOUNDATION:** một số current mutations ghi audit sau mutation và có manual-review error; không đạt authority atomicity |
| Canonical account lifecycle | **PARTIAL FOUNDATION:** membership active/paused/revoked và Auth signals tồn tại | **DEFERRED:** chưa có canonical global source cho banned/disabled/deleted/security lock/app termination/dependency health |
| Privileged boundary | **REPO FACT:** privileged credential được đọc ở server function environment, không từ browser | Pattern boundary có thể tham khảo; không đưa value/log/browser |
| Center provisioning | **REPO FACT:** browser RPC lịch sử tạo center + Owner membership sau Owner guard | Không phải bootstrap authority và không được gọi để cấp `platform_owner` |
| Deployment/runbook conventions | **REPO FACT:** repo có các pack read-only preflight, manual apply decision, post-verify và revoke rehearsal cho center/account phases | **PARTIAL FOUNDATION:** chưa có canonical protected Platform Owner operator tool/runbook |
| Cache/session cleanup | **REPO FACT:** sign-out và current-center changes stop realtime subscriptions/reset center state | **PARTIAL FOUNDATION:** Platform assignment version/invalidation chưa triển khai |
| Applied migrations | **REPO FACT từ canonical F23.11 final doc:** sáu migrations `20260722000000`–`202607280003` đã applied remote, có SHA-256 trước/sau và bất biến tuyệt đối | F23.12D không sửa/rename/repair/apply lại; execution preflight phải xác nhận hashes |
| A/B/C designs | **REPO FACT:** authority, Global Console, acting/approval, expiry reconciliation và stable lock contracts đã final-audit PASS | F23.12D kế thừa, không thay kiến trúc |

Không chạy remote inspection ở phase D. Applied-remote status trên được kế thừa từ canonical repo documentation, không phải xác nhận Supabase mới.

## 5. Identity-resolution ceremony

Business input có thể là tên người vận hành, contact identity qua kênh riêng, account-ownership confirmation và approved change ticket; các giá trị này không commit vào repo.

Trong controlled execution window, protected server/operator tool phải:

1. nhận approved ticket và business identity qua protected channel;
2. tìm Auth account trong exact approved environment;
3. resolve exact immutable Auth `user_id`;
4. xác nhận đúng một account match, không duplicate/alias ambiguity;
5. xác nhận account không anonymous, banned, disabled, deleted hoặc security-locked;
6. kiểm canonical app account lifecycle và dependency health;
7. second-channel confirmation trực tiếp với account owner;
8. reviewer đối chiếu resolved identity với ticket;
9. từ đây payload chỉ bind immutable `user_id`, không dùng email làm authority;
10. không ghi resolved ID/email vào repo, migration, smoke hoặc frontend.

Zero/multiple match, ownership mismatch, lifecycle unknown hoặc environment mismatch đều `ABORT`.

## 6. Canonical account-lifecycle prerequisite

Implementation không bắt đầu nếu server chưa có canonical, fail-closed source cho Auth existence, banned, disabled, deleted, security lock, app-level paused/terminated nếu có và dependency health. Membership status chỉ là center access state, không thay global account lifecycle.

Lifecycle phải kiểm tại proposal, review, activation, protected request, periodic review và revoke recovery. Dependency unavailable/ambiguous deny; không dùng cached “active”, old JWT hoặc UI login success để override.

## 7. Hai enrollment paths

### 7.1 First Platform Owner bootstrap

First bootstrap là exception có kiểm soát vì chưa có active Platform Owner để approve in-app. Required:

- approved change ticket và explicit execution window;
- immutable target ID đã resolve server-side;
- two-person out-of-band review;
- executor khác reviewer; target không làm reviewer/executor;
- preflight snapshot/hash/evidence bundle;
- exact canonical payload + digest;
- `PROPOSED -> ACTIVE` và append-only bootstrap audit/outbox atomic;
- post-verification và immediate revoke procedure;
- no browser/public endpoint/persistent backdoor.

Audit ghi `activation_mode = FIRST_BOOTSTRAP_EXCEPTION`. Reviewer/executor không trở thành in-app approver chỉ vì tham gia runbook.

### 7.2 Second Platform Owner enrollment

Sau first operator active, second operator bắt buộc dùng normal protected authority workflow:

```text
requester_user_id != approver_user_id
approver_user_id != target_user_id
```

Requester có thể là target nhưng không tự approve. Approver là distinct active Platform Owner với valid account/assignment/review. Target đi lại identity ceremony, nhận independent assignment term/review deadline. Không dùng first-bootstrap exception khi normal approver đã tồn tại.

Hai active assignments không tự động enable write/sensitive. Feature chỉ được release sau revoke drill, concurrency/approval tests, readiness health và explicit Security/Product approval.

## 8. Separation of duties

| Role | First bootstrap | Có thể trùng? |
| --- | --- | --- |
| Change requester | Nêu business need/ticket | Có thể là target hoặc executor nếu target khác executor; không là reviewer duy nhất |
| Change reviewer | Xác minh identity, plan, rollback, evidence | Bắt buộc khác executor và target |
| Execution operator | Chỉ thực thi approved digest trong protected environment | Bắt buộc khác reviewer và target |
| Target account owner | Xác nhận ownership qua second channel | Có thể là requester; không reviewer/executor |

Normal grant bắt buộc distinct requester/approver và approver/target. Hai browser profiles hoặc sessions của cùng account vẫn là một actor và không thỏa separation. Human alias/shared credential bị cấm.

## 9. Conceptual bootstrap record

```text
bootstrap_change_id
change_ticket_id
bootstrap_type
target_user_id
requested_by_operator
reviewed_by_operator
executed_by_operator
reviewed_at
executed_at
reason_code
reason_text_redacted
payload_digest
preflight_snapshot_id
resulting_assignment_id
resulting_authority_version
outcome
rollback_reference
created_at
```

`bootstrap_type` chỉ gồm `FIRST_PLATFORM_OWNER` hoặc `RECOVERY_BOOTSTRAP`. Recovery type chỉ dùng khi zero active Platform Owner, có incident + executive/security approval; không thay normal restore/grant.

Record chỉ giữ identifiers tối thiểu của protected operator/change systems; không log personal contact, credential, token hoặc full identity evidence.

### 9.1 Stable global authority-control singleton

Conceptual control model — chưa phải SQL:

```text
platform_authority_control
control_key
first_bootstrap_state
bootstrap_epoch
control_version
authority_schema_version
first_bootstrap_change_id
first_bootstrap_completed_at
updated_at
```

Canonical singleton key:

```text
control_key = platform_owner_authority
```

`first_bootstrap_state` chỉ là `NOT_COMPLETED` hoặc `COMPLETED`. Singleton row phải tồn tại trước first bootstrap; missing/multiple rows fail closed. Nó không chứa email, credential, client authority hoặc cached active-operator count. Actual assignments/effective active count luôn được query và verify dưới global lock.

First bootstrap atomically chuyển `NOT_COMPLETED -> COMPLETED`; completion không reversible và không reset sau revoke. `RECOVERY_BOOTSTRAP` chỉ hợp lệ khi state đã `COMPLETED`, giữ state đó và không mở lại first-bootstrap mode. `bootstrap_epoch` tăng sau mỗi successful first/recovery bootstrap; `control_version` tăng sau mọi committed authority mutation và dùng expected-version check.

Empty assignment set không cung cấp bootstrap serialization. First/recovery bootstrap và grant tới target mới không được dùng “khóa assignment row” làm mutex vì row chưa tồn tại.

## 10. Assignment lifecycle, term và review

```text
PROPOSED
ACTIVE
SUSPENDED
REVOKED
EXPIRED
REJECTED
CANCELLED
```

| State | Authority | Transition/restore |
| --- | --- | --- |
| `PROPOSED` | Không | Activate/reject/cancel/expire theo approval |
| `ACTIVE` | Có nếu lifecycle/review/term valid | Suspend/revoke/expire |
| `SUSPENDED` | Không | New approved restore proposal hoặc revoke; không client toggle |
| `REVOKED` | Không, terminal | Không revive; new proposal/assignment linked history |
| `EXPIRED` | Không, terminal | New proposal/assignment |
| `REJECTED` | Không, terminal | New proposal |
| `CANCELLED` | Không, terminal | New proposal |

First bootstrap có thể commit `PROPOSED -> ACTIVE` trong một controlled atomic change đã review. Normal grant dùng `activation_mode = SECOND_OPERATOR_APPROVAL`.

Required assignment fields:

```text
assignment_term
expires_at
review_due_at
last_reviewed_at
last_reviewed_by_user_id
review_status
authority_version
```

Temporary term bắt buộc `expires_at`, và review deadline không sau expiry. Long-lived term cho phép `expires_at = NULL` nhưng `review_due_at` bắt buộc; null không có nghĩa quyền vĩnh viễn. Overdue/missing review deny fail-closed.

## 11. Atomic mutation, audit và lock order

Bootstrap/grant/suspend/revoke phải commit state mutation + append-only audit trong cùng transaction, hoặc state mutation + transactional-outbox row trong cùng transaction. Audit/outbox lỗi thì `rollback / deny`.

Không chấp nhận assignment active thiếu bootstrap audit, revoke thiếu revoke audit, authority version đổi thiếu session/approval invalidation event hoặc idempotent replay tạo duplicate history.

Mọi authority mutation — first bootstrap, recovery bootstrap, normal proposal/grant, suspend, revoke, expiry/review mutation và restore proposal — phải khóa singleton `platform_authority_control` trước. Empty assignment-row set không phải mutex; target mới hoặc trạng thái zero-operator không có row để serialize.

Canonical authority-mutation lock order:

```text
0. global platform_authority_control row
1. platform assignment rows theo sorted user_id
2. acting-session rows theo stable session ID
3. approval rows theo stable approval ID
4. business target rows theo stable canonical key nếu có
5. audit/outbox rows
```

Không được đảo thứ tự hoặc lấy assignment row rồi quay lại chờ global row. Multi-actor grant/revoke khóa requester, approver và target assignment rows theo `sorted user_id`; target chưa có assignment vẫn được serialize bởi tier 0. Unique/index là integrity backstop, không thay global mutex.

Acting start **không** lấy global authority mutex: nó giữ contract F23.12C `actor assignment -> acting sessions -> activation/action approval -> business target -> audit/outbox`. Authority mutation lấy global row trước assignment, vì vậy hai path gặp nhau ở assignment row theo cùng chiều và không tạo lock cycle. Không giữ database locks khi chờ reviewer/user, gọi external network/notification hoặc render UI; external event dùng transactional outbox. Deadlock/timeout làm toàn transaction rollback và retry chỉ qua cùng idempotency contract.

## 12. First-bootstrap preflight và execution contract

Protected runbook canonical: `docs/runbooks/f23-12d-platform-owner-bootstrap-va-revoke-runbook.md`.

Preflight bắt buộc: checkpoint/worktree/environment, immutable migration hashes, backup/snapshot, deployed authority schema/version, lifecycle health, exact identity, zero active assignment/duplicate check, audit/outbox health, revoke path, reviewer/executor separation và approved ticket. Một check fail là `ABORT`; không “sửa nhanh rồi tiếp tục”.

### 12.1 Environment-bound execution envelope

Approved execution payload dùng versioned canonical serialization do protected server/operator tool sở hữu; không dùng raw UI order, browser-computed digest hoặc generic `JSON.stringify`. Envelope chính xác gồm:

```text
execution_contract_version
environment_fingerprint
authority_schema_version
global_control_key
expected_control_version
expected_bootstrap_epoch
bootstrap_type
activation_mode
target_user_id
canonical_machine_role
assignment_term
expires_at
review_due_at
reason_code
change_ticket_id
idempotency_key
expected_active_operator_count
expected_target_assignment_state
expected_target_assignment_version
canonicalization_version
```

`global_control_key` phải là `platform_owner_authority`; `canonical_machine_role` phải là `platform_owner`. `environment_fingerprint` là exact, stable, non-secret identity của deployment/project/region đã được reviewer xác nhận; không phải nhãn UI tự khai. Envelope không chứa email/contact identity, password, token, credential, signed URL hoặc private evidence.

Canonical serializer bind field name, type, null semantics và order theo `canonicalization_version`, rồi protected tool tính digest được phê duyệt; implementation mặc định đề xuất SHA-256. Reviewer và executor so sánh exact digest. Digest không được browser cấp authority hoặc trả về browser như privileged capability.

Mọi thay đổi environment fingerprint, authority schema version, control version, bootstrap epoch, target, role, term/review, activation mode, ticket, idempotency hoặc expected state làm digest khác. Wrong environment/schema/control version/epoch/state là `ABORT`; không reuse envelope giữa environment/schema, không dựa vào visual environment confirmation và không “vá” payload sau review.

### 12.2 First-bootstrap atomic start contract

Execution sau approval chỉ dùng server/operator environment. Canonical 17 bước — chưa phải command thật:

1. authenticate/authorize protected executor và bind exact approved ticket/execution window;
2. load exactly one canonical `platform_authority_control` singleton; missing/multiple là `ABORT`;
3. lock global control row;
4. re-read và require `first_bootstrap_state = NOT_COMPLETED`;
5. compare `expected_control_version`, exact environment/schema fingerprint và `expected_bootstrap_epoch` với locked state;
6. query real assignments dưới lock và require zero effective-active Platform Owner;
7. re-check idempotency/outcome; conflicting prior/concurrent outcome là deny, không tạo audit duplicate;
8. lock involved assignment rows theo sorted immutable `user_id`; empty target row không thay global mutex;
9. verify exact target identity và canonical account lifecycle fail-closed;
10. require expected target assignment state/version, không duplicate/malformed/conflicting history;
11. verify versioned envelope và exact protected payload digest;
12. create exact role `platform_owner` bằng `FIRST_BOOTSTRAP_EXCEPTION` mode;
13. set explicit assignment term, `expires_at` null semantics, `review_due_at` và initial authority version;
14. atomically transition global `first_bootstrap_state` từ `NOT_COMPLETED` sang `COMPLETED`;
15. increment `bootstrap_epoch` và `control_version` trong cùng mutation;
16. append immutable bootstrap audit hoặc transactional-outbox record bound ticket/idempotency/digest/control outcome;
17. commit assignment + global control + audit/outbox atomically, rồi trả safe result/correlation để independent read-only post-check.

Any mismatch, lock timeout, deadlock, lifecycle dependency error hoặc audit/outbox failure rollback toàn bộ. Không được tồn tại assignment active trong khi first state còn `NOT_COMPLETED`, hoặc control state/version/epoch đã đổi mà assignment/audit không commit.

Hai concurrent first bootstraps, kể cả khác targets, tranh cùng global row. Chỉ một transaction có thể chuyển state và commit; transaction thua re-read `COMPLETED`, deny `first_bootstrap_already_completed`, không dùng exception tạo operator thứ hai và không ghi duplicate success audit.

Design/runbook không chứa executable SQL hoặc command thực thi.

## 13. Post-verification

Read-only verification sau commit phải xác nhận:

1. đúng một active assignment cho exact target;
2. exact machine role `platform_owner`;
3. term, expiry/null semantics, review deadline và authority version;
4. expected bootstrap/activation audit event tồn tại;
5. không có center membership mới;
6. không email/frontend allowlist/client config mới;
7. không bootstrap endpoint/path còn mở;
8. legacy route vẫn membership-scoped;
9. proposed Global route vẫn chưa tồn tại nếu runtime chưa triển khai;
10. revoke procedure vẫn immediately available.

UI badge/login không phải bằng chứng duy nhất.

## 14. Second-owner readiness

Normal enrollment bị khóa tới khi có authority backend, canonical account lifecycle, approval service, atomic audit/outbox, active first operator, protected grant/revoke paths, review lifecycle và negative tests self-grant/self-approval.

Sau enrollment phải xác nhận hai distinct immutable user IDs, hai independent active assignments, valid review deadlines, approver khác target và planned revoke drill. Write/sensitive/additional approval vẫn disabled đến explicit release decision.

Normal proposal creation và grant activation là hai authority mutations riêng; mỗi mutation có exact versioned envelope/idempotency/expected state và đều lock global control row trước mọi requester/approver/target assignment rows. Proposal transaction re-check rồi tạo `PROPOSED`, bump `control_version` và audit/outbox atomic. Sau distinct approval, activation transaction re-lock/re-check state `COMPLETED`, current control version/epoch/environment/schema envelope, requester/approver effective authority và lifecycle, target lifecycle, expected target state/version, exact single-use approval và idempotency; sau đó mới activate normal assignment, consume approval, bump `control_version` và commit audit/outbox atomic.

Hai grants concurrent tới cùng target chưa có row vẫn serialize trên global row. Transaction thắng tạo exact outcome; transaction thua phải trả cùng idempotent outcome hoặc conflict/deny sau re-read, không tạo assignment/audit duplicate. Unique/index chỉ chặn integrity defect cuối cùng, không phải mutex.

## 15. Suspend và revoke semantics

`SUSPEND` tạm dừng authority nhưng giữ history; active acting sessions kết thúc/revoke, Global Console deny ở request kế tiếp và restore cần proposal mới theo policy.

`REVOKE` terminal cho assignment row: tăng authority version, invalidate/end acting sessions, revoke pending activation/action approvals, deny Global Console/protected endpoints và clear cache projection. Old token, app metadata hint, local storage hoặc open tab không thắng canonical assignment. Restore tạo new assignment linked history; không revive row.

Suspend/revoke transaction khóa global control row trước target assignment, rồi sessions/approvals, bump `control_version` và ghi invalidation audit/outbox atomic. Expiry/review mutation và restore proposal đi cùng authority lock order. Push/realtime cải thiện UX nhưng per-request assignment/version check mới quyết định authority.

## 16. Revoke drill

Preconditions: staging/test hoặc approved safe rehearsal, known test assignment, no production interruption, healthy audit/outbox, second observer và approved recovery plan.

Drill steps:

1. verify assignment active và Global authority trước revoke;
2. optionally start bounded low-risk acting session;
3. suspend/revoke exact assignment qua protected path;
4. verify authority version increased;
5. verify acting terminal/inactive và pending approvals invalidated;
6. verify next protected request denies;
7. verify old tab focus/reload denies and clears inventory/viewers/signed URLs;
8. verify real center membership, nếu có, vẫn independent;
9. verify audit/outbox and commit order;
10. verify revoked row cannot revive;
11. if recovery is part of drill, create new recovery proposal/assignment linked history.

Không drill bằng hard-delete row hoặc production surprise.

## 17. Emergency suspend/revoke

Protected emergency path dành cho account compromise, server/operator only, exact immutable target ID, mandatory reason + incident/change ID, immediate suspend/revoke, session/approval invalidation, atomic audit/outbox và post-incident review.

Emergency revoke có thể một operator thực thi để giảm thời gian exposure theo D-AG11, nhưng không được tạo grant/break-glass authority. Actor/action/reason/time/version/outcome phải immutable và hậu kiểm.

## 18. Zero-operator recovery

Khi zero active Platform Owner, cấm nâng Owner cơ sở, email allowlist, public bootstrap endpoint, local storage override hoặc revive revoked row.

Chỉ `RECOVERY_BOOTSTRAP` qua incident ticket, executive/security approval, two-person out-of-band review, immutable target ID, atomic audit, immediate second-owner recovery plan và closure verification. Temporary recovery path phải đóng sau execution.

Recovery khóa cùng singleton global row trước assignments và chỉ hợp lệ khi locked `first_bootstrap_state = COMPLETED`, exact expected control version/epoch khớp và canonical query dưới lock trả zero effective-active Platform Owner. Nó tạo **new** assignment với bootstrap type `RECOVERY_BOOTSTRAP`, không revive row, giữ first state `COMPLETED`, tăng `bootstrap_epoch` và `control_version`, rồi commit assignment + control + audit/outbox atomic.

Recovery và normal grant serialize trên cùng global row. Nếu normal grant thắng và làm active count khác zero, recovery thua phải deny hoặc đi lại quy trình dưới normal-grant classification sau review mới; không silent downgrade/reclassify và không dùng recovery exception. Nếu recovery thắng, normal grant phải re-check epoch/control/state, dùng newly reviewed envelope/approval và không reuse stale digest. Grant concurrent cùng target cũng đi qua global mutex trước target assignment row.

## 19. Rollback và compensation

Trước commit, mọi lỗi rollback transaction. Sau active assignment, không delete assignment/audit hoặc rewrite history; dùng new `SUSPEND`/`REVOKE` correction event.

External notification fail sau committed assignment/audit không âm thầm đảo history. Transactional outbox retry; unresolved delivery tạo incident. Partial external side effect phải compensation theo approved runbook, không được làm authority mutation thiếu audit.

## 20. Session, token và cache invalidation

Canonical assignment + authority version luôn thắng JWT/app metadata hint, cache, local storage, route và tab cũ. Sau suspend/revoke:

- next protected request deny immediately; không chờ token expiry;
- acting sessions terminal và pending approvals revoked;
- Global Console inventory/capabilities cleared;
- center subscriptions/viewers/signed URLs/drafts cleared theo acting contract;
- focus/reload/Back/Forward revalidate server;
- sign-out/re-auth không revive revoked assignment.

## 21. Concurrency/replay negative matrix

| Case | Scenario | Expected fail-closed outcome |
| --- | --- | --- |
| 25 | Hai first bootstraps concurrent tới hai targets khác nhau | Cùng chờ global row; một commit, transaction còn lại re-read `COMPLETED` và deny `first_bootstrap_already_completed`; không second exception/duplicate audit |
| 26 | Hai normal grants concurrent tới cùng target mới chưa có assignment row | Global row serialize; một exact outcome, transaction còn lại idempotent-same-result hoặc conflict/deny; unique/index chỉ backstop |
| 27 | First-bootstrap exception được gọi sau khi state đã `COMPLETED` | Deny kể cả active count hiện là zero; không reset state/không tạo assignment |
| 28 | Recovery và normal grant race khi active count ban đầu bằng zero | Global row serialize; winner commit atomic; loser re-check state/count/version/epoch và deny hoặc yêu cầu proposal/envelope đúng classification mới |
| 29 | Global control row bị thiếu | `ABORT`; không assignment/control/audit success mutation |
| 30 | Có nhiều global control rows | `ABORT`; không chọn tùy ý một row và không mutation |
| 31 | Approved digest bị replay sang environment khác | Exact environment fingerprint mismatch; `ABORT`, no replay/no audit success |
| 32 | Approved digest bị replay với authority schema version khác | Exact schema version mismatch; `ABORT`, yêu cầu review/envelope mới |
| 33 | `control_version` đổi sau review | Expected-version mismatch dưới lock; full rollback/deny, không reuse digest |
| 34 | `bootstrap_epoch` đổi sau review | Expected-epoch mismatch dưới lock; full rollback/deny, không reuse digest |
| 35 | Assignment mutation thành công nội bộ nhưng global control update fail | Toàn transaction rollback; assignment không active và không success audit/outbox |
| 36 | Global control update thành công nội bộ nhưng assignment hoặc audit/outbox fail | Toàn transaction rollback; control version/epoch/state không đổi bền vững, không partial history |

Race/deadlock retry phải đi lại global-lock path với cùng idempotency semantics. Không bypass mutex bằng empty assignment set, status-only read, cached operator count hoặc database unique violation.

## 22. Threat model

| # | Threat | Likelihood | Impact | Mitigation | Residual risk | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hardcoded operator email | Medium | Critical | Immutable server-resolved user ID; scans | Operator copies identity elsewhere | Tool + review |
| 2 | Wrong Auth user with similar contact identity | Medium | Critical | Exact-one match + second channel | Human verification error | Ceremony |
| 3 | Duplicate Auth account | Medium | High | Ambiguity abort; canonical lifecycle | Undetected alias | Lifecycle/tool |
| 4 | Center Owner self-escalates | Medium | Critical | No membership authority/grant path | Backend guard defect | API tests |
| 5 | Executor self-approves | Medium | Critical | Reviewer/executor separation + digest | Collusion | Runbook |
| 6 | Target approves own grant | Medium | Critical | Approver != target | Shared account | Approval service |
| 7 | First-bootstrap path remains open | Low/Medium | Critical | Controlled window + closure verification | Misconfigured operator tool | Deployment review |
| 8 | Payload changes after review | Medium | Critical | Canonical payload digest + exact ticket | Canonicalization bug | Tool tests |
| 9 | Assignment commits but audit fails | Low/Medium | Critical | Same transaction/outbox; rollback | Downstream lag | Data plane |
| 10 | Revoke leaves Acting active | Medium | Critical | Version bump + session invalidation atomic | External side effect race | Revoke tests |
| 11 | Old token/cache continues allow | High | Critical | Per-request canonical assignment/version | Stale cosmetic UI | Runtime |
| 12 | Revoked row revived | Medium | Critical | Terminal state + new linked proposal | Manual data tamper | Data constraints |
| 13 | Recovery bootstrap abuse | Low/Medium | Critical | Incident/executive approval + two person | Collusion | Recovery review |
| 14 | Privileged credential leaks to browser/log | Low | Critical | Server-only env, redaction, scans | Operator environment compromise | Security ops |
| 15 | Change-ticket replay | Medium | High | Environment-bound envelope + idempotency/ticket/digest/outcome binding | Canonicalizer defect | Tool tests |
| 16 | Concurrent first bootstraps | Medium | Critical | Stable global control mutex + irreversible first state | Broken lock path | Concurrency tests |
| 17 | Lifecycle dependency unavailable | Medium | Critical | Fail closed | Operational outage | Readiness/SRE |
| 18 | Assignment review overdue | Medium | High | Required deadline + per-request deny | Review backlog | Governance |
| 19 | Wrong project/environment | Medium | Critical | Preflight environment fingerprint + reviewer | Human confirmation error | Runbook |
| 20 | Migration/schema mismatch | Medium | Critical | Immutable hashes + schema/version preflight | Undocumented drift | Preflight |
| 21 | Second operator is same human/account alias | Low/Medium | Critical | Distinct user ID + human identity review | Hidden shared credential | Enrollment |
| 22 | Reviewer/executor collusion | Low | Critical | Evidence retention + post-review | Insider threat | Security governance |
| 23 | Revoke drill disrupts production | Medium | High | Staging/test default + approved rehearsal | Environment mistake | Drill plan |
| 24 | Audit over-collects identity/contact data | Medium | High | Minimize/redact; retention gate | Investigation needs | Privacy review |
| 25 | Empty-set global bootstrap race | Medium | Critical | Pre-existing singleton global mutex; locked active-count query | Missing/multiple control row | Schema + concurrency tests |
| 26 | Concurrent new-target grant | Medium | Critical | Global mutex before sorted assignment locks; idempotency; unique backstop | Service path skips tier 0 | Concurrency tests |
| 27 | Cross-environment execution-envelope replay | Medium | Critical | Digest binds exact environment/schema/control/epoch and expected state | Fingerprint misconfiguration | Operator-tool tests |
| 28 | First-bootstrap state divergence | Low/Medium | Critical | Assignment + irreversible state + epoch/version + audit/outbox one transaction | Storage/transaction defect | Data-plane tests |

## 23. Approval gates F23.12D

| Gate | Recommended default | Lý do | Rủi ro | Approver | Phase |
| --- | --- | --- | --- | --- | --- |
| D-AG1 First-bootstrap executor | Named security/platform operator, not target | Controlled execution | Self-grant | Security lead | Runbook approval |
| D-AG2 Out-of-band reviewer | Distinct security/change reviewer | Two-person control | Rubber stamp | Executive + Security | Runbook approval |
| D-AG3 Executive approval | Required for first/recovery bootstrap | Highest authority | Slow emergency response | Executive owner | Before execution |
| D-AG4 Identity channel | Live second channel + ticket evidence | Prevent wrong account | Social engineering | Security + HR/Ops | Ceremony |
| D-AG5 First assignment term | Temporary initially | Limit bootstrap exposure | Renewal overhead | Security + Product | Policy |
| D-AG6 Review deadline | 30 days initial; recurring max 90 days proposed | Bound persistence | Review fatigue | Security + Governance | Policy config |
| D-AG7 Execution mechanism | Approved server-only operator tool preferred; no browser | Auditable/least exposure | Tool not ready | Security Architecture | Implementation design |
| D-AG8 Ticket ID audit | Required, minimized identifier | Traceability/idempotency | Metadata leak | Privacy + Security | Audit schema |
| D-AG9 Second-owner timing | Immediately after first verification, before high-risk release | Separation of duties | Single-operator window | Security + Product | Enrollment |
| D-AG10 Revoke first operator | Other active PO or approved security operator | Incident handling | Abuse/revenge | Security governance | Revoke service |
| D-AG11 Emergency revoke approval | One protected executor allowed; mandatory post-review | Fast containment | False positive | Security + Executive | Emergency runbook |
| D-AG12 Drill environment | Staging/test default; production-safe rehearsal only approved | Avoid interruption | Incomplete prod signal | SRE + Security | Pre-release |
| D-AG13 Zero-operator recovery | Executive + Security + distinct executor/reviewer | Prevent backdoor | Slow recovery | Executive/Security | Recovery runbook |
| D-AG14 App metadata hint | Optional cache hint only, never authority | Performance without trust | Stale hint misuse | Security Architecture | Runtime design |
| D-AG15 Hardware-backed MFA | Required before production Platform Owner activation | Account security | Enrollment friction | Security | Auth prerequisite |
| D-AG16 Second-channel production action | Required for write/sensitive/high-risk actions | Fresh intent | Operational latency | Security + Ops | Approval implementation |
| D-AG17 Audit retention | Security/Legal-approved bounded retention; no indefinite default | Evidence/privacy balance | Evidence loss/overcollection | Legal + Privacy + Security | Data policy |
| D-AG18 Center Owner notification | No automatic personal detail; event policy requires approval | Trust vs privacy | Surprise/alert fatigue | Product + Legal | Notification design |
| D-AG19 Contact identity change | Trigger identity re-review; authority stays based on immutable ID | Detect takeover | False alerts | Security + HR/Ops | Lifecycle integration |
| D-AG20 Max active operators | Proposed small bounded set with review; exact cap pending | Reduce attack surface | Coverage gaps | Executive + Security | Governance policy |

Unapproved gate keeps the related feature/path disabled; defaults do not authorize real execution.

## 24. Protected runbook relationship

The runbook is a procedural contract for a future explicitly approved execution window. It contains no executable SQL, account fixture, real ID, email, password, token, project credential or privileged value. Every execution must generate a separate protected evidence bundle outside the repo.

Smoke là docs-contract test, không phải bootstrap/runtime proof.

## 25. Implementation blockers

All A–D implementation remains blocked until approved and tested:

```text
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
F23_12D_IMPLEMENTATION_READINESS: BLOCKED
F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED
```

Blockers include canonical account lifecycle; a pre-existing exactly-one global authority-control singleton with irreversible first state, epoch/version and implemented lock order; authority schema/service; environment fingerprint/canonical serializer/digest verifier; atomic audit/outbox; approval service; operator tool; identity/evidence procedure; invalidation backend; approved MFA/policy gates; second operator fixture; concurrency/replay tests 25–36; and successful revoke drill. Design smoke cannot discharge them.

## 26. Canonical roadmap

```text
F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed
    F23.12D DONE design / Controlled bootstrap, assignment và revoke drill
```

F23.12 runtime/backend/route/assignment implementation is not started and not done.

F23.12 DESIGN COMPLETE; implementation A–D vẫn `BLOCKED`.

## 27. Definition of done design

- F23.12C final audit sync và route boundary: **PASS**;
- repo foundations/gaps phân loại đúng evidence: **PASS**;
- identity ceremony + lifecycle prerequisite: **PASS**;
- first bootstrap + second-owner enrollment + separation of duties: **PASS**;
- assignment lifecycle/term/review + global mutex/epoch/version + atomic audit/locking: **PASS**;
- preflight/execution/post-verification protected contract: **PASS**;
- environment-bound versioned execution envelope và exact digest binding: **PASS**;
- suspend/revoke/drill/emergency/recovery/rollback/invalidation: **PASS**;
- negative cases 25–36, 28 threats và D-AG1–D-AG20: **PASS**;
- no real account/runtime/SQL/migration/Auth/Supabase/deploy: **PASS**.

F23.12D GLOBAL AUTHORITY MUTEX AND EXECUTION ENVELOPE HARDENING COMPLETE - READY FOR FINAL AUDIT
