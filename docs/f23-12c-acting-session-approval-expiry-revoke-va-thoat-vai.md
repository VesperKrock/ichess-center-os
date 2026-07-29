# F23.12C — Acting session, approval, expiry, revoke và thoát vai

Ngày chốt design: 2026-07-29

```text
F23_12C_STATUS: DONE DESIGN
F23_12C_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_FINAL_TECHNICAL_AUDIT: PASS
F23_12B_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
CANONICAL_MACHINE_ROLE: platform_owner
PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES
GLOBAL_CONTEXT_AND_CENTER_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO
MEMBERSHIP_CONTEXT_AND_ACTING_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO
BROWSER_BACK_REQUIRES_CONTEXT_REVALIDATION: YES
CONTEXT_TRANSITION_CLEARS_INCOMPATIBLE_DATA: YES
ACTING_CREATES_CENTER_MEMBERSHIP: NO
ACTING_IMPERSONATES_CENTER_USER: NO
ACTING_SESSION_ID_ALONE_GRANTS_AUTHORITY: NO
ACTING_AUTHORIZATION_REQUIRES_AUTH_UID_BINDING: YES
SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO
SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES
SELF_APPROVAL_ALLOWED: NO
READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO
ACTING_MAX_TTL_MINUTES: 30
ACTING_AUTO_RENEW_ALLOWED: NO
ACTING_START_RECONCILES_EXPIRED_ACTIVE_ROWS: YES
EXPIRED_ACTIVE_ROW_MAY_BLOCK_NEW_SESSION: NO
ACTIVE_STATUS_ALONE_DEFINES_EFFECTIVE_AUTHORITY: NO
ACTING_START_STABLE_ACTOR_LOCK_REQUIRED: YES
EMPTY_ACTING_ROW_SET_PROVIDES_SERIALIZATION: NO
ACTING_START_LOCK_TARGET: ACTIVE_PLATFORM_ASSIGNMENT_ROW
ACTING_CANONICAL_LOCK_ORDER_DEFINED: YES
ACTING_LOCK_ORDER_INVERSION_ALLOWED: NO
ACTING_UNIQUENESS_IS_INTEGRITY_BACKSTOP: YES
ACTING_UNIQUENESS_REPLACES_STABLE_ACTOR_LOCK: NO
ONE_ACTIVE_ACTING_SESSION_PER_ACTOR: YES
MULTI_TAB_DOES_NOT_CREATE_MULTIPLE_AUTHORITIES: YES
BROWSER_HISTORY_IS_NOT_AUTHORITY: YES
ACTIVATION_AND_ACTION_APPROVALS_ARE_DISTINCT: YES
ACTION_APPROVAL_REPLACES_ACTIVATION_APPROVAL: NO
ONE_SESSION_MAY_HAVE_MULTIPLE_ACTION_APPROVALS: YES
ACTION_APPROVAL_SINGLE_EXACT_ACTION: YES
ACTION_APPROVAL_SINGLE_EXACT_SUBJECT_DEFAULT: YES
ACTION_APPROVAL_WILDCARD_ALLOWED: NO
ACTION_APPROVAL_BULK_BY_DEFAULT_ALLOWED: NO
LOW_RISK_SELF_START_APPROVAL_MODE: POLICY_SELF_START
LOW_RISK_SELF_START_REQUIRES_HUMAN_APPROVER: NO
LOW_RISK_SELF_START_CREATES_FAKE_APPROVER: NO
LOW_RISK_SELF_START_IS_SELF_APPROVAL: NO
RUNTIME_CHANGE: NO
ROUTE_IMPLEMENTED: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
SUPABASE_ACTION: NOT RUN
AUTH_CHANGE: NO
REAL_ASSIGNMENT_CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```

## 1. Kết luận thiết kế và mức bằng chứng

**DESIGN PROPOSAL:** Acting Session là một actor-context tạm thời, server-authorized, bind active `platform_owner` với đúng một center và allowlist scope trong thời gian hữu hạn. Actor vẫn là chính họ; session không impersonate Owner/Center Admin, không tạo `center_members`, không đổi Auth identity và không biến session ID thành bearer authority.

**DESIGN PROPOSAL:** Low-risk operational read có thể dùng `POLICY_SELF_START` sau re-auth và full server checks, không tạo approval/approver giả. Sensitive/private read và mọi write dùng `SECOND_OPERATOR`, activation approval riêng và exact single-use action approval. Rollout chỉ có một Platform Owner phải khóa các đường này fail-closed; không self-approve và không dùng Owner/Center Admin thay thế.

**REPO FACT:** runtime hiện có hidden Internal Center Console dùng `owner + active center_members`, current-center switch, cloud bootstrap và các teardown function cho student, teacher, schedule, attendance, tuition cùng một số viewer state. Repo chưa có Platform Owner authority service, acting request/session, approval service hoặc canonical global account lifecycle.

**PARTIAL FOUNDATION:** các pattern server function có verified user token, account audit, request/idempotency, membership/lifecycle guard và cleanup khi đổi center là bằng chứng tham khảo. Chúng không chứng minh acting authorization và không được tái dùng guard Owner + membership làm global/acting authority.

**DEFERRED:** toàn bộ runtime, UI route, Auth, SQL, migration, RLS/RPC, endpoint, Supabase action, assignment tài khoản thật, notification và break-glass. Docs smoke chỉ kiểm contract tài liệu, không phải runtime security proof.

## 2. Boundary kế thừa từ F23.12A/B

1. `platform_owner` độc lập hoàn toàn với `center_members`; membership không cấp, nâng hoặc duyệt Platform Owner.
2. Global Console không phải acting; membership center switch không phải acting.
3. G0 là **low-sensitivity platform governance metadata**, không phải public data, không có anonymous API và không được export tự do.
4. Global Console chỉ đọc G0/G1 và masked governance metadata đã server-authorize; không mở center operational/private data.
5. Acting không tạo membership, không impersonate và không hiển thị actor như Owner/Center Admin.
6. Không hardcode email, không client-only authorization, không browser privileged credential, không universal RLS bypass.
7. Private HR, private financial, full identity và sensitive object không thuộc low-risk self-start read.
8. Canonical server-side account lifecycle, approved authority service, second Platform Owner và atomic audit/outbox là implementation prerequisites.
9. Permanent Storage deletion vẫn F23.11E.2B `LATER`; acting scope không được mở đường vòng cho permanent deletion.

## 3. Đồng bộ F23.12B final audit và context model

F23.12B đã được đồng bộ:

- `F23_12B_FINAL_TECHNICAL_AUDIT: PASS`;
- final line `F23.12B FINAL TECHNICAL AUDIT PASS - F23.12C DESIGN MAY START`;
- G0 đổi thành `G0 — low-sensitivity platform governance metadata`;
- Global, membership và acting là ba context loại trừ lẫn nhau trong một tab;
- browser Back/Forward phải qua server context gate, clear dữ liệu không tương thích và không phục hồi authority từ history/local storage.

Canonical actor-context:

```text
GLOBAL_CONSOLE      = platform governance metadata only
MEMBERSHIP_CONTEXT  = center OS authority từ active membership thật
ACTING_CONTEXT      = temporary platform support authority, exact center/scope/TTL
NO_AUTHORITY        = transition/error/expired/revoked/cleanup chưa hoàn tất
```

Mỗi tab chỉ có một context hiệu lực. Một user có thể mở nhiều tab nhưng chúng chỉ quan sát cùng một active acting record/version; các tab không tạo thêm authority.

## 4. Định nghĩa Acting Session

Acting Session là một grant tạm, có reason, exact center, allowlisted scope, server start time, expiry, assignment version và audit. Nó luôn bind đồng thời:

```text
auth.uid()
platform_actor_user_id
authority_assignment_id
authority_version_at_start
acting_session_id
session_version
target_center_id
approved_scopes
server time window
```

Thiếu hoặc mismatch bất kỳ binding nào đều deny. `acting_session_id` chỉ là opaque reference; bị biết, copy sang account khác hoặc đưa vào route không cấp authority.

Acting tuyệt đối không:

- thay đổi Auth subject hoặc phát token mang identity của user center;
- tạo, sửa hoặc ngầm giả định `center_members`;
- dùng membership hiện có làm approval;
- dùng route, local storage, cached role/capability hoặc UI badge làm authority;
- dùng service-role/privileged credential trong browser;
- cung cấp wildcard/global bypass cho dữ liệu center.

## 5. Acting request/session lifecycle

Canonical lifecycle:

```text
DRAFT
REQUESTED
PENDING_APPROVAL
APPROVED
ACTIVE
EXPIRED
ENDED
REVOKED
DENIED
CANCELLED
```

Chỉ một row `ACTIVE` còn hiệu lực theo server time và toàn bộ authority checks mới có authority. Status `ACTIVE` đứng một mình không đủ. `DRAFT`, `REQUESTED`, `PENDING_APPROVAL`, `APPROVED` không được gọi center operational endpoint. Unknown state luôn deny.

| State | Authority | Ai chuyển state | Preconditions/approval | Audit event | Expiry | Terminal | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DRAFT` | Không | Requester ở UI local-safe | Chưa submit; không chứa sensitive payload | Không bắt buộc trước submit | Draft UI timeout/discard | Không | Có thể sửa trước submit |
| `REQUESTED` | Không | Authenticated active Platform Owner | Exact center/scopes/reason/request id; re-auth gate | `acting.requested` | Request TTL server-side | Không | Không đổi actor/center |
| `PENDING_APPROVAL` | Không | Server policy | Scope write/sensitive; second active Platform Owner bắt buộc | `acting.requested`/approval requested | Request/approval expiry | Không | Không mở rộng payload |
| `APPROVED` | Không | Second Platform Owner hoặc server low-risk policy evaluator | `POLICY_SELF_START`: exact policy/version, no approval record; `SECOND_OPERATOR`: exact activation digest, requester khác approver | `acting.approved` với approval mode rõ | Policy/request hoặc activation approval phải còn hạn | Không | Policy re-evaluate; activation approval single-use |
| `ACTIVE` | Chỉ khi `effective_active`, đúng approved scope | Server start transaction | Tất cả 18 start steps; stable mutex + policy self-start hoặc activation approval hợp lệ | `acting.started` | `expires_at` bắt buộc, tối đa 30 phút | Không | Không renew/đổi center/mở scope |
| `EXPIRED` | Không | Server clock/per-request check | `server_now >= expires_at` | `acting.expired` | Đã hết | Có | Không revive; record mới |
| `ENDED` | Không | Actor hoặc approved server workflow | Idempotent safe exit | `acting.ended` | N/A | Có | Không revive; record mới |
| `REVOKED` | Không | Authorized revoker/system lifecycle | Revoke reason + version bump | `acting.revoked` | Ngay request kế tiếp | Có | Không revive; record mới |
| `DENIED` | Không | Server/approver | Policy, lifecycle, approval hoặc integrity fail | `acting.start_denied` hoặc `acting.rejected` | N/A | Có | Không revive; request mới |
| `CANCELLED` | Không | Requester trước active hoặc system cleanup | Chưa active/consume action | `acting.cancelled` | N/A | Có | Không revive; request mới |

Allowed transitions:

```text
DRAFT -> REQUESTED | CANCELLED
REQUESTED -> APPROVED | PENDING_APPROVAL | DENIED | CANCELLED | EXPIRED
PENDING_APPROVAL -> APPROVED | DENIED | CANCELLED | EXPIRED
APPROVED -> ACTIVE | CANCELLED | EXPIRED | DENIED
ACTIVE -> EXPIRED | ENDED | REVOKED
terminal -> no transition
```

Mỗi transition server-side dùng row/version lock hoặc optimistic compare-and-swap bằng `session_version`. Hai request race chỉ một request thắng; loser nhận version stale. Terminal record không reset status hoặc recycle ID.

### 5.1 Effective-active và start-time expiry reconciliation

Canonical logical predicate:

```text
effective_active =
  status == ACTIVE
  AND expires_at > server_now()
  AND session/account/assignment vẫn hợp lệ
```

Logical expiry có hiệu lực ngay khi `server_now() >= expires_at`; row chưa transition do chưa có request không còn authority. Mọi authorization check dùng server time. Browser countdown, heartbeat hoặc UI state không tham gia predicate.

Trước khi start session mới, protected transaction bắt buộc:

1. khóa stable actor mutex là exact canonical active assignment row của requester;
2. re-read authority state/version/review/expiry dưới assignment lock;
3. sau đó khóa mọi acting row `ACTIVE` của actor theo canonical order;
4. dùng một server transaction time xác định row đã hết hạn;
5. transition row stale từ `ACTIVE` sang `EXPIRED`;
6. tăng `session_version` theo expected version;
7. ghi `acting.expired` bằng audit row hoặc transactional-outbox row trong cùng transaction;
8. xác nhận không còn `effective_active` session;
9. sau đó mới evaluate/start session mới trong cùng protected flow.

Expiry transition hoặc audit/outbox lỗi phải `rollback / deny start`. Không chờ browser gọi session cũ, không bỏ qua stale row, không tự xóa record và không mở hai session active. Background expiry worker có thể bổ sung sau nhưng không thay start-time reconciliation vì worker có thể trễ.

Khóa query acting rows không đủ để serialize lần start đầu tiên: khi actor chưa có acting row, empty row set không tạo mutex giữa hai transaction. Không được dùng fake acting row hoặc client mutex để lấp lỗ này.

### 5.2 Stable actor serialization target

Recommended stable target là exact canonical row trong conceptual `platform_operator_assignments` của requester với role `platform_owner`. Assignment row là prerequisite tồn tại trước acting session đầu tiên, đồng thời serialize start với authority suspend/revoke/version change.

Protected transaction contract:

```text
load exact active platform_operator_assignments row for auth.uid()
validate count == 1
lock stable assignment row
re-read assignment state/version/review/expiry under lock
```

Nói cách khác, transaction phải khóa stable assignment row và re-check assignment dưới lock trước khi khóa/reconcile acting sessions.

Không có row, có nhiều row, row inactive, review overdue, assignment expired, account dependency error hoặc không lấy được lock theo bounded policy đều `deny / rollback`. Không fallback sang email, membership, browser state hoặc row acting không tồn tại.

Hai alternative chỉ được dùng sau technical/security approval:

1. dedicated `platform_actor_runtime_locks(actor_user_id, lock_version, updated_at)` với row được tạo an toàn trong canonical bootstrap transaction;
2. transaction-scoped advisory lock có key derive server-side từ immutable actor ID, collision strategy rõ, bounded timeout và không nhận arbitrary lock key từ browser.

Alternative không tự được phê duyệt bởi design này, không thay database uniqueness và không chốt SQL. Default vẫn là active platform assignment row.

### 5.3 Canonical lock ordering

Mọi start, approve, revoke, expiry reconciliation, action consume và authority suspend/revoke dùng cùng global order:

```text
1. platform assignment rows
   - requester assignment bắt buộc, stable actor mutex
   - approver assignment nếu cần
   - khi có nhiều assignment: sorted user_id
2. actor acting-session rows, stable session-id order
3. exact approval row, stable approval-id order
4. exact business target rows, canonical type/id order
5. audit/outbox rows
```

Đường cần second operator có thể pre-read opaque approval locator chỉ để xác định assignment set; mọi authority/approval field phải re-read sau lock. Tất cả assignment rows cần thiết được khóa trong assignment tier theo `sorted user_id` trước acting rows. Không endpoint nào được lock approval/session trước rồi quay lại lock assignment.

Không giữ database lock trong lúc chờ người dùng, gọi UI, gửi external notification hoặc gọi network service ngoài transaction. External event đi qua transactional outbox sau commit. Lock timeout/deadlock phải rollback an toàn; retry idempotent bằng request ID và không nhân đôi approval/session/audit.

### 5.4 Mutex, database invariant và effective authority

Implementation sau phải kết hợp stable assignment-row mutex, expected `session_version`, transaction, invariant một effective-active session, uniqueness/index phù hợp canonical state, lazy expiry reconciliation và optional background sweeper. Không khẳng định partial unique index chỉ lọc `status = 'ACTIVE'` tự giải quyết time expiry.

Nếu implementation chọn unique index theo status, protected transaction phải transition row đã logically expired trước insert/activate row mới. Constraint/index là lớp integrity bổ sung; server-time reconciliation mới giải phóng stale `ACTIVE` đúng audit contract.

Ba lớp không thay nhau:

```text
stable actor lock                 -> serialize start/reconcile kể cả empty acting set
database uniqueness/invariant     -> integrity backstop cho race/implementation defect
per-request effective_active      -> authority theo server time + dependency checks
```

## 6. Conceptual data model

Đây là contract logic, không phải SQL/migration đã triển khai.

### 6.1 Acting request/session

```text
acting_session_id
platform_actor_user_id
target_center_id
status
requested_scopes
approved_scopes
reason_code
reason_text_redacted
requested_at
requested_by_user_id
approval_mode
activation_approval_id
approved_by_user_id
approved_at
started_at
expires_at
ended_at
ended_by_user_id
end_reason
revoked_at
revoked_by_user_id
revoke_reason
authority_assignment_id
authority_version_at_start
session_version
request_id
created_at
updated_at
```

Required invariants:

- `platform_actor_user_id`, `requested_by_user_id` và target center immutable sau submit; requester phải bằng actor.
- `requested_scopes` không được mở rộng sau approval; đổi payload tạo request/session mới.
- `approved_scopes` là strict subset hoặc bằng requested scopes; không có scope unknown/wildcard.
- `expires_at` luôn non-null cho `ACTIVE`, dùng server time, lớn hơn `started_at` và không quá 30 phút.
- Không auto-renew; extension luôn là record mới và đi lại re-auth/approval.
- Mỗi actor tối đa một `effective_active`; stale status `ACTIVE` phải được reconcile atomic trước start mới. Mỗi session đúng một center.
- `approval_mode` chỉ là `POLICY_SELF_START` hoặc `SECOND_OPERATOR` và immutable khi session đã start.
- `activation_approval_id = NULL` và `approved_by_user_id = NULL` cho approved low-risk `POLICY_SELF_START`.
- `activation_approval_id` bắt buộc và `approved_by_user_id` là distinct active Platform Owner cho `SECOND_OPERATOR`.
- `activation_approval_id` immutable sau start và không được dùng làm “current action approval”.
- Action approvals là collection one-to-many riêng qua `action_approval_id -> acting_session_id`; session không có một field action approval hiện tại duy nhất.
- `authority_assignment_id` và version bind authority lúc start nhưng per-request vẫn kiểm version hiện tại.
- `request_id` idempotency bind actor + operation; không được dùng lại với payload khác.
- Mọi state/version mutation phải atomic với audit row hoặc transactional-outbox row.

### 6.2 Approval-purpose model

Hai canonical purpose là:

```text
ACTIVATION_APPROVAL
ACTION_APPROVAL
```

Common approval-record fields:

```text
approval_id
approval_purpose
requester_user_id
approver_user_id
target_center_id
acting_session_id
action_digest
issued_at
expires_at
consumed_at
consumed_by_request_id
status
approval_version
created_at
updated_at
```

Fields riêng cho `ACTIVATION_APPROVAL`:

```text
approved_scope_set
session_start_action
authority_version
session_version
```

Activation approval cho phép start session có write/sensitive scope, bind requester, distinct approver, center, exact acting request/session, exact approved scope set, authority/session versions và exact session-start action. Một session có tối đa một activation approval đã consume cho lần start đó; consume atomic khi transition sang `ACTIVE`.

Fields riêng cho `ACTION_APPROVAL`:

```text
action_approval_id
approved_scope
approved_action
approved_subject_type
approved_subject_id
canonical_payload_digest
```

Action approval thuộc đúng một acting session theo mapping `action_approval_id -> acting_session_id`, không thay activation approval, không mở rộng session scope và single-use. Một session có thể có nhiều action approval records theo quan hệ one-to-many; mỗi record consume atomic với đúng action và audit/outbox.

`action_approval_id` là typed reference tới common `approval_id` của record có purpose `ACTION_APPROVAL`, không phải một identifier thứ hai hoặc field ghi đè trên acting session.

Không dùng schema mơ hồ với `approved_scopes`, `approved_subjects` hoặc `approved_actions` arrays cho action approval thông thường. `approver_user_id` luôn là human second Platform Owner trên approval record; `POLICY_SELF_START` không tạo activation approval record nên không cần fake/placeholder approver.

## 7. Scope taxonomy

Scope registry do server allowlist/version. Không chấp nhận tên tổng quát như `all`, `full_access`, `admin_everything`, `bypass`, prefix wildcard hoặc scope client tự gửi chưa đăng ký.

### 7.1 Low-risk operational read — self-start có điều kiện

```text
center.schedule.summary.read
center.attendance.summary.read
center.module.readiness.read
center.non_sensitive_support_metadata.read
```

Self-start chỉ được phép khi active Platform Owner có canonical account lifecycle hợp lệ, assignment/review/expiry hợp lệ, re-auth fresh, reason hợp lệ, exact center active, TTL tối đa 30 phút, không chứa sensitive subject và start audit atomic. Response phải bounded/aggregate, không full identity, private attachment, voucher, raw financial hoặc export.

Low-risk self-start dùng chính xác:

```text
approval_mode = POLICY_SELF_START
activation_approval_id = NULL
approved_by_user_id = NULL
```

Server evaluate exact low-risk policy ID/version và scopes, đồng thời kiểm no other effective-active session. Start audit/outbox tối thiểu ghi `approval_mode = POLICY_SELF_START`, `policy_id`, `policy_version`, `evaluated_scopes`, actor, center, `reason_code` và `session_version`.

`POLICY_SELF_START` là policy evaluation, không phải human approval hoặc self-approval. Không tạo Auth user hệ thống, zero UUID, placeholder actor hoặc fake approver; không ghi requester vào approver và không dùng Owner/Center Admin. Policy mismatch/unknown version fail-closed.

### 7.2 Write scopes — luôn cần second Platform Owner

```text
center.schedule.write
center.attendance.write
center.student.basic.write
center.staff.basic.write
center.membership.write
```

Mọi write dùng `approval_mode = SECOND_OPERATOR`, cần second active Platform Owner, required `activation_approval_id` cho exact requested scope set và exact single-use `ACTION_APPROVAL` bind payload digest. Server vẫn áp dụng business validation/RLS/capability của action; acting không phải bypass. Destructive/permanent Storage deletion không nằm trong taxonomy này.

### 7.3 Sensitive read — capability + additional approval riêng

```text
center.private_hr.metadata.read
center.private_hr.object.view
center.private_hr.object.download
center.financial_private.read
center.identity_full.read
center.private_voucher.read
```

Sensitive read yêu cầu đồng thời active acting session, approved sensitive scope, explicit server capability, second Platform Owner và additional approval exact subject/object/action. Approval single-use, TTL ngắn hơn session, audit từng action, không bulk export và không wildcard. Signed URL nếu được policy cho phép phải ngắn hạn, object-bound, không log và bị clear khi exit/revoke/expiry.

Write/sensitive activation dùng `SECOND_OPERATOR`: `activation_approval_id` required và `approved_by_user_id` phải là distinct active Platform Owner. Tại approve và consume, server kiểm lại approver khác requester, canonical account lifecycle, active Platform Owner assignment, review/expiry, current authority version, exact scope set, approval chưa consumed/expired/revoked và tuyệt đối không single-operator fallback.

`center.private_hr.object.download` mặc định disabled cho tới approval gate C-AG7; không suy từ quyền view. Low-risk session không được nâng scope tại chỗ.

## 8. Single-operator rollout

Khi chỉ có một active Platform Owner:

| Capability | Kết quả |
| --- | --- |
| Global G0/G1 governance metadata | Cho phép nếu server authority/account checks hợp lệ |
| Low-risk operational read self-start | Cho phép theo allowlist + re-auth + reason + audit |
| Write acting | `single_operator_approval_unavailable`, deny |
| Sensitive/private read | Deny |
| Full identity/private HR/private financial | Deny |
| Authority mutation hoặc center execution high-risk | Deny |
| Additional approval | Không tồn tại approver hợp lệ, deny |

Không self-approval, không fake approver, không bootstrap reviewer giả lập, không emergency checkbox và không cho Owner/Center Admin duyệt. First bootstrap runbook ở F23.12D không biến người thực thi hoặc reviewer ngoài hệ thống thành approver in-app.

## 9. Re-authentication contract

- Re-auth bắt buộc trước start, trước approve và trước mọi high-risk action nếu freshness đã hết.
- Recommended freshness gate: tối đa 5 phút tính bằng server-verified authentication event; client timestamp chỉ dùng hiển thị.
- Server xác minh current Auth subject và provider result; browser không giữ password, proof, privileged credential hoặc re-auth secret.
- Cancel/fail/timeout re-auth giữ request không-authority hoặc chuyển denied/cancelled theo policy; không partially active.
- Account disabled/banned, canonical lifecycle unknown/unavailable, assignment suspended/revoked/expired hoặc review overdue đều deny.
- Re-auth thành công không override authority, center lifecycle, scope, approval hoặc session expiry.

## 10. Session start và per-request authorization

### 10.1 Mười tám bước start transaction

1. xác thực requester và `auth.uid()`;
2. kiểm canonical server-side account lifecycle active;
3. load exact một active requester `platform_operator_assignments` row; requested scopes có thể được classify sơ bộ chỉ để xác định có cần pre-read opaque activation-approval locator/approver assignment hay không;
4. khóa assignment tier gồm stable requester assignment row và approver assignment nếu cần, theo `sorted user_id`, trước mọi acting row;
5. re-check requester/approver assignment status, review, expiry và `authority_version` dưới lock;
6. khóa mọi acting-session rows của actor theo stable session-id order;
7. dùng server time reconcile mọi stale `ACTIVE` row sang `EXPIRED`;
8. tăng expected `session_version` cho từng expiry transition;
9. ghi `acting.expired` audit/outbox atomic;
10. xác nhận không còn `effective_active` session;
11. kiểm exact center, requested/approved scopes và re-auth freshness;
12. xác định final `approval_mode` chỉ là `POLICY_SELF_START` hoặc `SECOND_OPERATOR`;
13. với `SECOND_OPERATOR`, khóa exact `ACTIVATION_APPROVAL` row theo canonical order; approver assignment đã phải nằm trong locked assignment tier;
14. re-check exact approval binding, distinct approver, approver lifecycle/current versions và approval chưa consumed/expired/revoked;
15. consume activation approval nếu cần bằng expected approval version;
16. insert/activate acting session với exact actor/center/scopes/TTL/authority version;
17. ghi `acting.started` audit/outbox;
18. commit toàn bộ reconciliation, approval consume và start atomic.

Bất kỳ load-count, stable lock, re-check, expiry transition, approval consume hoặc audit/outbox nào lỗi: `deny / rollback`; không tạo partially active session. Không chờ request vào session cũ để reconcile và không dựa vào empty acting-row lock hoặc uniqueness theo status đơn lẻ.

### 10.2 Per-request authorization

Mọi request center trong acting, kể cả read, pagination, signed URL và mutation, kiểm lại server-side:

```text
auth.uid()
canonical account lifecycle
active platform assignment
current authority_version
acting_session_id exists
session actor == auth.uid()
exact target center
effective_active (không chỉ status == ACTIVE)
current session_version
server_now < expires_at
requested action
approved scope
subject/object binding nếu sensitive
valid unconsumed approval nếu action yêu cầu
center lifecycle
audit/outbox precondition
```

Không chỉ kiểm khi start. Route, UI center ID, local storage, cached capability, heartbeat hoặc old JWT không thay server checks. Revoke/expiry/version change có hiệu lực ở request kế tiếp dù realtime/push chưa tới tab.

### 10.3 Mười bốn per-action approval checks

Với action cần second-operator approval, transaction có thể pre-read opaque references để lập lock set nhưng phải lấy requester/approver assignment locks theo `sorted user_id`, rồi acting-session row, exact approval row và business target rows trước audit/outbox. Mọi field được re-read dưới lock; pre-read không cấp authority. Server phải:

1. kiểm acting session còn `effective_active`;
2. kiểm session actor bằng `auth.uid()`;
3. kiểm exact center;
4. kiểm action nằm trong approved session scope;
5. lock/re-read exact `ACTION_APPROVAL` bằng opaque reference theo canonical order;
6. kiểm `approval_purpose == ACTION_APPROVAL`;
7. kiểm exact requester, distinct approver, center và acting session;
8. kiểm đúng một `approved_scope`;
9. kiểm đúng một `approved_action`;
10. kiểm đúng một subject/object mặc định;
11. tính lại exact `canonical_payload_digest`;
12. kiểm approval chưa consumed/expired/revoked;
13. kiểm approval/session/authority versions và approver lifecycle hiện tại;
14. commit action mutation + approval consume + audit/outbox atomic.

`ACTIVATION_APPROVAL` bị từ chối tại bước 6 và không được dùng làm action approval. Mismatch bất kỳ field/version nào deny trước khi lộ private data hoặc chạy mutation.

## 11. Approval lifecycle và exact single-use digest

Approval states:

```text
REQUESTED
APPROVED
REJECTED
EXPIRED
CONSUMED
CANCELLED
REVOKED
```

| State | Authority | Transition | Reuse |
| --- | --- | --- | --- |
| `REQUESTED` | Không | Approver approve/reject; requester cancel; server expire | Không mutate payload |
| `APPROVED` | Chưa tự cấp action | Consume atomic khi exact operation chạy | Một lần |
| `REJECTED` | Không | Terminal | Không revive |
| `EXPIRED` | Không | Server clock | Không revive |
| `CONSUMED` | Không còn grant | Exact request đã commit | Không reuse |
| `CANCELLED` | Không | Requester trước consume | Không revive |
| `REVOKED` | Không | Authorized revoker trước consume | Không revive |

Mọi approval record là human second-operator approval: requester phải khác approver. Approver phải là active Platform Owner với account/assignment/review hợp lệ ở cả lúc approve và consume. Approval expiry không sau session expiry. Stale `authority_version`, `approval_version`, session version hoặc approver lifecycle đều deny. Low-risk `POLICY_SELF_START` không tạo approval record.

`action_digest` là digest cryptographic của canonical, versioned envelope chung:

```text
digest_contract_version
approval_purpose
requester_user_id
approver_user_id
target_center_id
acting_session_id
session_version
authority_assignment_id + authority_version
approval_version
issued_at + expires_at
consumption request binding
```

Với `ACTIVATION_APPROVAL`, envelope bổ sung exact `approved_scope_set`, `session_start_action` và session request ID. Nó chỉ consume khi exact session chuyển sang `ACTIVE`.

Với `ACTION_APPROVAL`, envelope bổ sung đúng một `approved_scope`, một `approved_action`, một `approved_subject_type` + `approved_subject_id`, exact `canonical_payload_digest` và action request ID. Một approval bình thường chỉ bind một requester, một approver, một center, một session, một scope, một action, một subject/object, một canonical payload và một TTL.

Ví dụ exact operation: view document X; download document X; update attendance record Y; change membership record Z. Không cho nhiều private document IDs, unrelated subjects, `all_documents`, `all_students`, nhiều action khác loại, prefix/wildcard hoặc approval dùng chung cả session.

Canonical batch không mặc định được suy từ array. Batch chỉ được phép khi có business operation riêng đã duyệt, canonical action name riêng, exact bounded subject list, maximum batch size, canonical sorted payload, additional approval dành riêng cho batch và audit từng batch outcome. Batch approval vẫn single-use; oversized/unknown batch deny.

Implementation phải chọn và duyệt canonical serialization ổn định cùng thuật toán digest mạnh (recommended SHA-256); không dùng raw `JSON.stringify`, UI text hoặc client-computed digest làm nguồn tin. Đổi purpose, center, session, scope, action, subject, payload, version hoặc request binding tạo digest khác. Server tự tính lại constant-time comparison; approval digest nội bộ không trả browser.

Consume dùng compare-and-swap từ `APPROVED` sang `CONSUMED`, bind `consumed_by_request_id`. Activation consume + session start + audit/outbox atomic; action consume + exact action mutation/read grant + audit/outbox atomic. Hai tab submit đồng thời chỉ một request consume; request kia nhận `acting_session_approval_consumed`. Nếu action hoặc audit/outbox fail thì toàn bộ consume/mutation rollback.

## 12. TTL, countdown, expiry và revoke

### 12.1 TTL/expiry

- Session TTL tối đa 30 phút; recommended default 15 phút, gate C-AG2 chốt trước implementation.
- Không auto-renew. Muốn tiếp tục phải end/expire, tạo record mới, re-auth và approval lại.
- Countdown lấy `server_now`/`expires_at`; client clock chỉ render.
- Warning persistent ở còn 5 phút và 1 phút.
- Heartbeat, focus, reload, tab mới hoặc activity không gia hạn.
- Khi server time chạm expiry, logical authority chấm dứt ngay cả khi status chưa transition; request tiếp theo deny và atomic transition/audit expiry.
- Start session mới bắt buộc lazy-reconcile stale `ACTIVE` row trong protected transaction; background worker chỉ hỗ trợ và có thể trễ.
- Không silent membership fallback, auto-create session hoặc bỏ qua stale row để “mở khóa”.

### 12.2 Revoke

Revoke sources: Platform Owner khác, approved security operator path, authority assignment suspend/revoke, account disable/ban, center lifecycle change, integrity incident hoặc session policy violation.

Revoke transaction phải đổi state, tăng `session_version` và ghi audit/outbox atomic. Từ request kế tiếp mọi endpoint deny, UI clear acting context/data/viewer/signed URL/drafts, dừng subscriptions và quay về no-authority/global revalidation. Không đợi TTL và không phụ thuộc realtime signal; push chỉ rút ngắn thời gian UI nhận biết.

Break-glass vẫn `DEFERRED`; không tạo hidden bypass trong F23.12C.

## 13. Safe exit và unsaved work

Nút `Thoát chế độ hỗ trợ` luôn visible trong persistent banner, không nằm sau menu ẩn và không bị modal che. End request idempotent, ghi actor/time/reason, end session server-side và audit atomic.

Sau server xác nhận end hoặc xác nhận session đã terminal:

1. khóa mọi center action;
2. clear acting context và capabilities;
3. dừng student/teacher/schedule/attendance/tuition và mọi subscription center khác;
4. clear center operational/private data, inventory/detail không tương thích, signed URLs, object viewers và blob URLs;
5. clear form state/draft chứa center data;
6. chuyển về Global Console và revalidate Platform Owner authority trước render.

Nếu end lỗi, UI khóa write, không giả vờ đã thoát, giữ banner/error, retry idempotent và cung cấp fallback sign-out. Server state luôn quyết định authority. Sign-out recommended revoke/end mọi active acting session của actor server-side, không chỉ clear client.

Trước expiry, UI warning và không cho bắt đầu action dài nếu remaining TTL dưới policy threshold. Sau expiry/revoke, write deny, data bị ẩn/clear, không persist draft sensitive vào local storage và không cho export/download để “cứu” dữ liệu. Default discard acting draft sau warning; chỉ local-safe draft không có center/sensitive data mới có thể giữ nếu policy phê duyệt.

## 14. Multi-tab, race và browser navigation

- Một actor chỉ có một active session record; hai tab start đồng thời dùng database invariant/version lock, một thắng một stale/blocked.
- Nhiều tab có thể quan sát cùng session nếu C-AG4 duyệt, nhưng phải cùng actor, session ID, center, version, scopes và persistent banner.
- Tab không clone authority; approval consume ở một tab làm tab khác stale ngay request kế tiếp.
- Start session mới khi session khác active bị deny; không silent end session cũ.
- Tab focus/visibility, trước action và trước reconnect subscription đều revalidate.
- Browser Back về Global hoặc membership route phải end/leave theo transition contract, clear acting data và revalidate; không chỉ đổi DOM.
- Browser Forward/reload acting route phải server revalidate active session; cached page không hiển thị center data trước check.
- local storage/session storage chỉ có thể giữ non-sensitive UI preferences; không acting authority, scope, approval, private response hoặc session bearer.

## 15. Context transition matrix

| Transition | Actor context đích và revalidation | Context phải end | Clear data/cache | Subscriptions | Route/Back | Audit | Allowed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Global → Membership | Active account + exact active membership | Global | Inventory/detail/global capabilities | Global fetches cancel | Explicit membership route; Back revalidate | `context.membership_entered` proposed | Có nếu membership thật |
| Global → Acting | Account + assignment + acting start checks | Global | Inventory/detail/global capabilities | Chưa start center subscription trước ACTIVE | Acting route sau server start; Back không restore Global cache | `acting.started` | Có theo scope/approval |
| Membership → Global | Active Platform Owner assignment | Membership | Center operational data/viewers/capabilities | Stop toàn bộ center subscriptions | Global route sau cleanup; Back revalidate membership | `context.membership_ended` proposed | Có |
| Membership → Acting | End membership, rồi full acting checks | Membership | Center operational data/viewers/capabilities | Stop trước acting start | Không reuse membership approval; Back revalidate | membership end + `acting.started` | Có, không đồng thời |
| Acting → Global | End/terminal acting, revalidate assignment | Acting | Acting data, signed URL, drafts, capabilities | Stop trước global render | Back/Forward đều revalidate | `acting.ended`/terminal | Có |
| Acting → Membership | End acting, exact membership revalidation | Acting | Acting data/viewers/drafts/capabilities | Stop acting; start membership sau gate | Không reuse acting scope | acting end + membership entry | Có, không đồng thời |
| Acting Center A → Acting Center B | New request/start for B | Acting A | Full A operational/private state | Stop A trước request B active | Không direct switch/history restore | A end + B request/start | Direct: không |

Cleanup thất bại đặt tab vào `NO_AUTHORITY`, khóa request, retry cleanup/sign-out; không mở context đích. Một tab không giữ đồng thời global inventory và center operational data đã usable.

## 16. Persistent banner và UI state matrix

Persistent banner hiển thị: `Đang hỗ trợ cơ sở`, center name, actor identity, scope class, read/write/sensitive badge, server-derived countdown, approval state nếu có và nút `Thoát chế độ hỗ trợ`. Không gắn nhãn actor là Owner/Center Admin.

| UI state | Message/data visibility | Actions | Retry | Cleanup/escape |
| --- | --- | --- | --- | --- |
| `ACTING_REQUEST_DRAFT` | Form center/scope/reason; chưa có data center | Submit/cancel | Validate | Cancel về Global |
| `ACTING_REQUESTED` | Request summary | Cancel | Server refresh | Không data center |
| `ACTING_PENDING_APPROVAL` | Exact scope/center, approver pending | Cancel | Refresh status | Về Global |
| `ACTING_APPROVED` | Approval expiry/countdown; chưa data | Start/cancel | Re-auth/start | Expiry về terminal |
| `ACTING_STARTING` | Skeleton, no operational data | Cancel disabled during atomic call | Idempotent retry | Failure clear context |
| `ACTING_ACTIVE_READ` | Authorized bounded read + banner | Read/exit | Revalidate | Exit clear all center data |
| `ACTING_ACTIVE_WRITE` | Approved scope + banner | Exact approved actions/exit | Revalidate/re-auth | Lock on stale/expiry |
| `ACTING_SENSITIVE_ACTION_PENDING` | Không reveal target content | Approve/cancel flow | Request new approval | Clear pending subject on exit |
| `ACTING_EXPIRING` | Warning 5/1 min, data only while server active | Complete/cancel/exit | Không renew | Prepare discard |
| `ACTING_EXPIRED` | No center data | Return Global/sign-out | Server recheck | Full cleanup |
| `ACTING_REVOKED` | Safe revoke reason | Return Global/sign-out | No revive | Full cleanup |
| `ACTING_ENDED` | Exit confirmed | Return Global | Authority recheck | Full cleanup |
| `ACTING_DENIED` | Safe bounded reason/correlation ID | Edit new request/Global | Re-auth/new request | No center data |
| `ACTING_CANCELLED` | Request cancelled | New request/Global | N/A | Clear draft |
| `ACTING_ERROR` | Safe error, authority unknown | Retry/sign-out | Bounded | Lock/clear data |
| `ACTING_CONTEXT_MISMATCH` | Actor/center/context mismatch | Sign-out/Global gate | Server only | Full cleanup + audit |
| `ACTING_VERSION_STALE` | Session/approval changed | Refresh state | Server revalidate | Lock data/actions |

## 17. Error contract

```text
acting_session_required
acting_session_not_found
acting_session_inactive
acting_session_expired
acting_session_revoked
acting_session_actor_mismatch
acting_session_center_mismatch
acting_session_scope_denied
acting_session_version_stale
acting_session_already_active
acting_session_start_blocked
acting_session_reauth_required
acting_session_approval_required
acting_session_approval_invalid
acting_session_approval_consumed
acting_session_context_conflict
acting_session_service_unavailable
single_operator_approval_unavailable
action_forbidden
action_deferred
```

Browser chỉ nhận safe code, correlation ID và bounded message. Không trả SQL, policy text, stack, token, signed URL, private path, internal approval digest, credential hoặc secret. Unknown error fail-closed và clear/lock dữ liệu theo authority uncertainty.

## 18. Atomic audit contract

Required events:

```text
acting.requested
acting.approved
acting.rejected
acting.cancelled
acting.started
acting.start_denied
acting.scope_denied
acting.sensitive_action_requested
acting.sensitive_action_consumed
acting.expiring
acting.expired
acting.ended
acting.revoked
acting.context_mismatch
acting.version_stale
```

Session/approval mutation + audit phải cùng database transaction, hoặc state mutation + transactional-outbox row cùng transaction. Exact write/sensitive action + approval consume + outcome audit/outbox cũng phải atomic. Audit/outbox insert fail dẫn tới rollback/deny; không giữ authority đổi, session active, approval consumed hoặc center mutation thiếu audit.

Audit tối thiểu có immutable actor, approver nếu có, center, session/request, scope/action, subject reference đã minimize/redact, before/after state/version, reason code, server time, outcome và correlation ID. Không log private content, authorization header, re-auth proof, raw digest, signed URL hoặc secret. Retry theo `request_id` không nhân đôi state/audit outcome.

## 19. Race, replay và negative test matrix

| # | Case | Expected deny/cleanup/audit |
| --- | --- | --- |
| 1 | Self-approval | Deny; no consume/start; audit approval invalid |
| 2 | Single Platform Owner mở write session | `single_operator_approval_unavailable`; no center data |
| 3 | Approval dùng lại | Deny consumed; audit bounded replay |
| 4 | Approval đổi center | Digest/center mismatch; full context cleanup if active |
| 5 | Approval đổi scope | Deny; new request required |
| 6 | Approval đổi subject/object | Deny before reveal/download; audit scope denial |
| 7 | Session ID dùng bởi account khác | Actor mismatch; clear tab; `acting.context_mismatch` |
| 8 | Session A dùng cho center B | Center mismatch; deny; clear wrong-center data |
| 9 | Session expired đúng lúc mutation | Server lock/time check wins; rollback mutation/consume; expire audit |
| 10 | Revoke đồng thời mutation | Serialized version/state check; either committed-before-revoke with both audits or mutation rollback |
| 11 | Assignment revoke nhưng tab cũ mở | Next request deny; clear; assignment/revoke audit |
| 12 | Account ban nhưng session active | Next request deny/revoke; clear subscriptions/data |
| 13 | Session version stale | Deny; `acting.version_stale`; refresh state |
| 14 | Hai tab cùng start | One ACTIVE max; loser already-active/version-stale |
| 15 | Acting A chuyển thẳng Acting B | Deny context conflict; require end A + cleanup |
| 16 | Browser Back khôi phục cached acting page | No data before server gate; cleanup/revalidate |
| 17 | localStorage giả acting state | Ignore/delete; deny without server session |
| 18 | Heartbeat cố kéo dài TTL | TTL unchanged; expiry by server clock |
| 19 | Sensitive view thiếu additional approval | Deny before content; sensitive request/scope audit |
| 20 | Private download dùng approval consumed | Deny; clear signed URL/viewer |
| 21 | Audit insert lỗi | Rollback/deny; no active/change/consume |
| 22 | Outbox insert lỗi | Rollback/deny; no authority mutation |
| 23 | Unknown scope | Deny at request/start; audit safe scope denial |
| 24 | Unknown state | Treat inactive; deny/cleanup; integrity alert |
| 25 | Center archived khi session active | Next request revoke/deny; clear; lifecycle audit |
| 26 | Membership thật tồn tại nhưng actor chọn acting | Explicit acting flow only; no authority mixing; audit start |
| 27 | Membership entry cố reuse acting capability | Deny; clear acting capability; membership revalidation |
| 28 | Signed URL còn mở sau end/revoke | Viewer cleared; subsequent fetch denied; URL short-lived |
| 29 | Subscription nhận data sau exit | Callback fenced by context/session version; discard + unsubscribe |
| 30 | Context cleanup thất bại | `NO_AUTHORITY`, lock UI, retry/sign-out; audit cleanup error |
| 31 | `ACTIVE` row đã quá hạn nhưng chưa transition, actor start session mới | Lock + atomic reconcile/audit rồi mới start; không hai effective-active sessions |
| 32 | Expiry reconciliation audit insert lỗi | Rollback reconciliation/start; stale row vẫn logically expired và không có authority/data |
| 33 | Expiry reconciliation và hai tab start đồng thời | Actor row lock serialize; một start thắng, tab kia deny/stale; đủ expiry/start audits |
| 34 | Activation approval bị dùng làm action approval | Deny purpose mismatch trước action/data; audit safe approval invalid |
| 35 | Action approval session A dùng cho session B | Deny exact session mismatch; no private data; context cleanup nếu cần |
| 36 | Action approval có nhiều subject nhưng không phải canonical batch đã duyệt | Deny bundle/wildcard; no consume/data; audit scope/action denial |
| 37 | Low-risk self-start ghi requester làm approver | Deny invalid policy contract; không start; audit không giả human approval |
| 38 | Low-risk self-start tạo fake system user làm approver | Deny; no fake actor/approval row; policy evaluation audit only |
| 39 | `POLICY_SELF_START` yêu cầu scope ngoài low-risk allowlist | Deny policy/scope; no session/data; safe audit |
| 40 | `SECOND_OPERATOR` thiếu `activation_approval_id` | Deny start; no effective-active session mới; approval-required audit |
| 41 | Action approval bị ghi đè vào `activation_approval_id` | Deny immutable/type mismatch; no consume/action; integrity audit |
| 42 | Action approval exact subject nhưng payload đã đổi | Digest mismatch; deny/rollback; no data mutation; audit invalid |
| 43 | Hai tab start acting lần đầu khi actor chưa có acting row | Cùng khóa stable requester assignment; một commit, transaction sau re-read thấy effective-active và deny already-active/version-stale; không duplicate session/audit |
| 44 | Authority assignment revoke đồng thời actor start acting | Start/revoke serialize trên cùng assignment row; revoke-first thì start deny, start-first thì revoke invalidate/revoke session; không authority sau revoke, audit theo commit order |
| 45 | Hai Platform Owner đồng thời approve/start hoặc revoke session của nhau | Assignment tier khóa theo `sorted user_id`, không inversion; deadlock còn sót rollback một transaction và retry idempotent; không duplicate approval/session/audit |

## 20. Threat model

| Threat | Likelihood | Impact | Mitigation | Residual risk | Phase |
| --- | --- | --- | --- | --- | --- |
| Session replay | Medium | Critical | Auth UID/session/version/TTL binding; one active invariant | Stolen authenticated device | Implementation + security QA |
| Cross-center swap | Medium | Critical | Immutable target + per-request center check + digest | Endpoint mapping bug | API contract tests |
| Self-approval | Medium | Critical | Requester != approver; second active PO checks twice | Collusion | Approval service |
| Approver compromised | Low/Medium | Critical | Re-auth, short TTL, exact digest, revoke | Valid compromised session | Auth/security operations |
| Stale assignment | Medium | Critical | Per-request current assignment/version check | Dependency outage | Authority service |
| Stale account state | Medium | Critical | Canonical lifecycle prerequisite + per-request check | Lifecycle lag | Account lifecycle implementation |
| Multi-tab confusion | High | High | One active record/version/banner; focus revalidation | User confusion before push | UI + concurrency tests |
| Browser history restoration | High | High | History not authority; gate before render | Transient cached pixels | UI/cache hardening |
| Signed URL leakage | Medium | Critical | Exact object approval, short URL, clear viewer, no logs | Screenshot/external capture | Storage policy + UI |
| Sensitive screenshot/download | Medium | High | Minimize data, visible banner, single-use approval, audit | Cannot fully prevent camera capture | Policy/training |
| Context mixing | Medium | Critical | Mutually exclusive state machine and cleanup barrier | Cleanup implementation defect | Integration tests |
| Expiry race | Medium | Critical | Server clock + transaction lock + request-time check | Long-running external side effect | Executor design |
| Revoke race | Medium | Critical | Version bump/serialization; next-request check | Already committed action | Transaction design |
| Audit failure | Low/Medium | Critical | Same transaction or transactional outbox; rollback | Audit sink downstream lag | Data plane |
| Universal wildcard scope | Medium | Critical | Exact allowlist; unknown/prefix wildcard deny | Registry misconfiguration | Security review |
| Membership impersonation | Medium | Critical | No membership creation/identity switch; actor banner | UI mislabel | UI/accessibility QA |
| Client clock manipulation | High | Medium | Server time authoritative | Misleading countdown until refresh | UI sync |
| Local storage spoof | High | High | No authority/scope stored; server revalidation | Cosmetic spoof before gate | Frontend hardening |
| Stale-active deadlock | Medium | High | Start-time actor lock + expiry reconciliation + atomic audit | Worker/transaction contention | Data-plane implementation |
| Approval type confusion | Medium | Critical | Explicit `approval_purpose`, distinct schema and endpoint checks | Endpoint mapping bug | API and negative tests |
| Approval bundling | Medium | Critical | Single exact action/subject default; separate canonical batch policy/limits | Oversized approved batch | Policy limits |
| Fake policy approver | Low/Medium | High | Explicit `POLICY_SELF_START`, nullable approver fields and policy-version audit | Policy misconfiguration | Authority-policy review |
| Empty-set locking race | Medium | Critical | Stable assignment-row lock trước acting rows + unique integrity backstop | Future path bỏ stable lock | Data-plane concurrency tests |
| Lock-order deadlock | Medium | High | Canonical order, sorted multi-actor locks, short transaction, idempotent retry | Future endpoint đảo order | API architecture review + concurrency tests |

## 21. Approval gates F23.12C

| Gate | Recommended default | Lý do | Rủi ro nếu sai | Approver | Phase |
| --- | --- | --- | --- | --- | --- |
| C-AG1 Low-risk scopes | Chỉ bốn allowlisted summary/readiness scopes mục 7.1 | Bounded support | PII/private leak | Security + Privacy + Product | Before implementation |
| C-AG2 TTL mặc định | 15 phút, hard max 30 | Giảm exposure | Quá ngắn gián đoạn; quá dài tăng risk | Security + Ops | Policy config |
| C-AG3 Re-auth freshness | 5 phút | Fresh intent | Stolen unlocked device | Security/Auth | Auth design |
| C-AG4 Nhiều tab | Cho cùng exact session/version, không session mới | Hỗ trợ workflow nhưng giữ một authority | Context confusion | Security + UX | Runtime design |
| C-AG5 Tab cuối đóng | Không tự end chỉ dựa browser event; TTL/revoke vẫn server | Unreliable unload | Session tồn tại đến TTL | Security + UX | Runtime design |
| C-AG6 Sensitive approval granularity | Mỗi exact action + subject/object, single-use | Least privilege | Bulk/replay | Privacy + Security | Approval service |
| C-AG7 Private download | Disabled mặc định; chỉ single-use object-bound nếu duyệt | Exfiltration risk | Data loss | Privacy/Legal + Security | Separate release gate |
| C-AG8 Unsaved draft | Warning rồi discard; không persist sensitive | Safe expiry | Mất công việc vs leak | Product + Privacy | UI design |
| C-AG9 Center lifecycle | Chỉ canonical `active`; paused/archived/unknown deny | Không thao tác center đóng | Lifecycle inconsistency | Product + Security | Backend policy |
| C-AG10 Emergency revoke | Approved security operator path + audit; break-glass deferred | Incident response | Hidden bypass | Security + Executive | F23.12D/runbook |
| C-AG11 Notify center Owner | Audit-only mặc định; notification cần policy riêng | Tránh spam nhưng minh bạch | Trust gap | Product + Legal/Ops | Later notification design |
| C-AG12 Notify sensitive read | Required audit; user/Owner notification decision pending | Privacy accountability | Alert fatigue/omission | Privacy + Legal | Before sensitive release |
| C-AG13 IP/device audit | Coarse/minimized security metadata nếu legal duyệt | Incident evidence | Privacy overcollection | Privacy + Security | Audit schema review |
| C-AG14 Parallel approvals | Cho nhiều records nhưng exact bind; rate limit và conflict checks | Ops throughput | Approval fatigue/collision | Security + Ops | Approval service |
| C-AG15 Second channel production | Recommended cho write/sensitive production | Strong intent | Added friction | Security + Ops | Auth/approval design |
| C-AG16 Sign-out | Revoke/end mọi active acting session server-side | Shared-device safety | Orphan session to TTL | Security/Auth | Runtime implementation |
| C-AG17 Read khi readiness DEGRADED | Deny mặc định nếu authority/lifecycle/audit dependency degraded; bounded read only by explicit policy | Fail-closed | Support unavailable | Security + SRE + Product | Readiness contract |
| C-AG18 Acting A → B | Bắt buộc end A, cleanup, request/start B | Prevent cross-center leak | Operational friction | Security + UX | Runtime state machine |

Các default trên đủ đóng design, không tự phê duyệt implementation. Gate chưa có approver quyết định giữ feature liên quan disabled.

## 22. Route, storage và cache contract

- F23.12C không chốt hoặc triển khai route runtime.
- Route có session ID không cấp quyền; opaque reference luôn bind `auth.uid()` và current versions server-side.
- Không lưu acting authority token, approved scope, approval, sensitive subject hoặc private response trong local storage/session storage.
- Không dùng `acting_session_id` như bearer authority độc lập `auth.uid()`.
- Reload/focus/Back/Forward bắt buộc server revalidation trước render/reconnect.
- Browser cache policy không lưu private response; signed URL ngắn hạn và clear khi exit/revoke/expiry.
- UI preference không nhạy cảm có thể persist nhưng không ảnh hưởng authorization.

## 23. F23.12D dependencies và implementation blockers

F23.12C không gán tài khoản thật. F23.12D phải có approved first-operator bootstrap runbook, Platform Owner thứ hai trước write/additional approval, canonical server-side account lifecycle, authority backend, approval service, atomic audit/outbox và revoke drill.

Implementation còn bị khóa bởi canonical `platform_operator_assignments` stable mutex, exact-one assignment invariant, bounded lock policy, global lock ordering áp dụng nhất quán cho start/approve/revoke/action/authority mutation, protected expiry reconciliation, effective-active invariant/index backstop, explicit approval-purpose storage/API, versioned low-risk policy registry, exact action digest/subject binding và approved canonical batch limits. Không được dùng empty acting-row lock, status-only uniqueness hoặc một approval field chung làm shortcut.

Implementation A/B/C vẫn `BLOCKED` cho đến khi đồng thời có:

```text
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
F23_12C_IMPLEMENTATION_READINESS: BLOCKED
```

Không “tạm mở write”, private read hoặc self-approval vì chưa có người thứ hai. Không dùng account fixture giả làm bằng chứng production.

F23.12C.2 final technical audit đã PASS. F23.12D design được phép hoàn tất, nhưng không mở implementation hoặc assignment thật.

## 24. Developer handoff và verification contract

Khi implementation được phê duyệt ở phase sau, CodeX phải:

1. audit lại canonical account lifecycle/authority schemas tại checkpoint mới;
2. lập migration/RLS/RPC/API plan riêng và xin approval, không suy design doc là deploy permission;
3. implement server authorization trước route/UI;
4. dùng exact active assignment row làm stable actor mutex, canonical lock order, start-time expiry reconciliation và transaction/transactional outbox cho state/approval/action/audit;
5. implement distinct `ACTIVATION_APPROVAL`/`ACTION_APPROVAL` endpoints và thêm runtime integration tests cho 45 negative cases, empty-set race, deadlock, type confusion và cleanup;
6. verify không privileged credential/browser direct query/hardcoded identity;
7. test Back/Forward/reload/multi-tab/revoke/expiry bằng server observation;
8. test cleanup toàn bộ center data, viewers, signed URLs và subscriptions;
9. giữ F23.11E.2B permanent deletion ngoài acting;
10. không đánh dấu runtime DONE khi chỉ docs smoke pass.

Docs smoke F23.12C phải assert A/B/C final audit PASS, implementation BLOCKED, no membership/impersonation/session-ID-only authority, stable assignment mutex/canonical lock order/uniqueness backstop, expiry reconciliation/effective-active, split approval purpose, policy self-start nullable semantics, lifecycle/schema/scope/single-operator/sensitive approval/TTL/re-auth/start/per-action checks, single-use digest, expiry/revoke/safe exit, multi-tab/Back, atomic audit, 45 negative cases, 24 threats, C-AG1–C-AG18, D DONE design và no runtime/SQL/migration/Auth/Supabase. Smoke vẫn chỉ là docs-contract test, không phải runtime concurrency proof.

## 25. Canonical roadmap

```text
F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit
    F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill
```

F23.12 implementation không `DONE`. F23.12A/B/C đều chỉ `DONE design` và implementation `BLOCKED`.

## 26. Definition of done design

- F23.12B final technical audit PASS và G0/context patch đồng bộ: **PASS**;
- acting definition/lifecycle/schema/stable mutex/effective-active reconciliation/invariants: **PASS**;
- scope taxonomy, single-operator fail-closed và sensitive approval: **PASS**;
- activation/action approval split, policy self-start, re-auth/start/per-action exact digest: **PASS**;
- TTL/expiry/revoke/safe exit/unsaved work: **PASS**;
- multi-tab/browser/context transition/UI/error: **PASS**;
- canonical lock order, atomic audit, 45 negative cases, 24-threat model và C-AG1–C-AG18: **PASS**;
- F23.12D dependency và implementation blockers rõ: **PASS**;
- không runtime/route/SQL/migration/Auth/Supabase/assignment: **PASS**.

F23.12C FINAL TECHNICAL AUDIT PASS - F23.12D DESIGN MAY START
