# F23.12A — Platform Owner role và nguồn cấp quyền server-side

Ngày chốt design: 2026-07-29

```text
F23_12A_STATUS: DONE DESIGN
F23_12A_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
CHECKPOINT_AUDITED: 29cb88d
CANONICAL_MACHINE_ROLE: platform_owner
AUTHORITY_SOURCE_RECOMMENDATION: DEDICATED_SERVER_SIDE_ASSIGNMENT_TABLE
PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES
GLOBAL_CONSOLE_IS_ACTING_SESSION: NO
CENTER_SWITCH_IS_ACTING_SESSION: NO
CLIENT_ONLY_AUTHORIZATION_ALLOWED: NO
HARDCODED_OPERATOR_EMAIL_ALLOWED: NO
OWNER_OR_CENTER_ADMIN_SELF_GRANT_ALLOWED: NO
BROWSER_SERVICE_ROLE_ALLOWED: NO
UNIVERSAL_RLS_BYPASS_ALLOWED: NO
SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO
SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES
SELF_APPROVAL_ALLOWED: NO
READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO
PRIVATE_HR_READ_REQUIRES_ADDITIONAL_APPROVAL: YES
PRIVATE_EXPORT_DEFAULT: FORBIDDEN
LONG_LIVED_ASSIGNMENT_REVIEW_DEADLINE_REQUIRED: YES
NULL_EXPIRES_AT_MEANS_UNLIMITED_AUTHORITY: NO
OVERDUE_AUTHORITY_REVIEW_FAILS_CLOSED: YES
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: NO
PLATFORM_AUTHORITY_IMPLEMENTATION_BLOCKED_WITHOUT_ACCOUNT_LIFECYCLE: YES
ACCOUNT_LIFECYCLE_DEPENDENCY_ERROR_FAILS_CLOSED: YES
AUTHORITY_MUTATION_WITHOUT_AUDIT_ALLOWED: NO
AUTHORITY_MUTATION_AUDIT_ATOMIC_REQUIRED: YES
TRANSACTIONAL_OUTBOX_ACCEPTABLE: YES
RUNTIME_CHANGE: NO
SQL_CHANGE: NO
MIGRATION_CHANGE: NO
AUTH_CHANGE: NO
SUPABASE_ACTION: NOT RUN
REAL_ACCOUNT_ASSIGNMENT: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```

## 1. Kết luận thiết kế

**DESIGN PROPOSAL:** `platform_owner` là authority toàn nền tảng, độc lập hoàn toàn với `center_members`. Nguồn sự thật đề xuất là một bảng assignment chuyên biệt ở server, có lifecycle, expiry, revoke, approval và audit append-only. Mọi đường kiểm tra lỗi, thiếu row, row mâu thuẫn, account không hợp lệ hoặc dependency không đọc được đều trả deny.

**DESIGN PROPOSAL:** Global Console chỉ quản trị metadata và governance toàn hệ thống theo capability. Muốn đọc hoặc thao tác dữ liệu vận hành của một cơ sở, Platform Owner phải mở acting session tường minh cho đúng cơ sở, lý do, scope và thời hạn. Acting session không tạo membership ngầm, không giả làm một người dùng thật và không biến Platform Owner thành Owner/Center Admin của cơ sở.

**DEFERRED:** F23.12A không tạo bảng, helper, RPC, RLS, Edge Function, route, UI, Auth claim hoặc assignment thật. F23.12B thiết kế Global Console; F23.12C thiết kế chi tiết acting; F23.12D mới là phase gán tài khoản vận hành sau phê duyệt và triển khai hạ tầng.

## 2. Phạm vi và phương pháp audit

Audit chỉ đọc repo tại `main` checkpoint `29cb88d`. Không gọi Supabase, không đọc hoặc ghi secret, không xác minh tài khoản thật và không suy diễn trạng thái remote ngoài evidence đã được tài liệu canonical ghi lại.

Các nhãn dùng trong tài liệu:

- **REPO FACT:** có bằng chứng trực tiếp trong source, migration hoặc tài liệu checkpoint hiện hữu.
- **PARTIAL FOUNDATION:** có thành phần tái sử dụng được nhưng chưa đạt trust boundary F23.12.
- **DESIGN PROPOSAL:** quyết định kiến trúc cho phase sau; chưa tồn tại trong runtime/database.
- **DEFERRED:** chủ động không triển khai hoặc cần phê duyệt/phase khác.

### 2.1 Ma trận audit C6/C7

| Nền đã audit | Evidence chính | Kết luận |
| --- | --- | --- |
| C6.3 multi-center | `src/supabase-auth.js`, `src/app-center-binding.js`, `docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md` | **REPO FACT:** current center được resolve từ active membership; khi có nhiều membership, app chọn row đầu theo `center_id`. |
| C6.4 Owner binding | `src/online-access-control.js`, `docs/supabase-c6-4f-checkpoint-review-owner-role-binding.md` | **REPO FACT:** `owner` đang là role per-center; không có global role. |
| C6.5 Internal Console | `src/main.js` — `getInternalCenterConsoleAccess`, `renderInternalCenterConsoleRoute`; `docs/supabase-c6-5d-checkpoint-review-internal-center-console.md` | **REPO FACT:** hidden route hiện yêu cầu signed-in + bound active membership + role `owner`. |
| C6.6 provisioning/switch | `provision_center_for_owner`, `handleInternalOpenCenter`; `docs/supabase-c6-6h-checkpoint-review-add-center-center-switch.md` | **REPO FACT:** RPC tạo center và owner membership; switch chỉ mở center mà actor đã có active membership. |
| C7.4 governance design | `docs/supabase-c7-4-access-governance-center-lifecycle-design.md` | **PARTIAL FOUNDATION:** có lifecycle/confirmation/audit principles; khái niệm Owner tối cao là thiết kế lịch sử cần được F23.12 tách lại thành `platform_owner`. |
| C7.5 server provisioning | `docs/supabase-c7-5-server-side-account-provisioning-readiness.md` | **PARTIAL FOUNDATION:** đã chốt privileged credential chỉ ở server, không tin role trong request body, phải guard và audit. |
| C7.7 account ops | các Edge Functions create/reset/revoke/restore và `docs/supabase-c7-7c-checkpoint-account-ops-readiness.md` | **REPO FACT:** server xác thực bearer user rồi guard active Owner đúng center; không có global Platform Owner guard. |
| C7.8 Owner account UI | `src/main.js`, `list-center-admin-accounts`, `docs/supabase-c7-8h-owner-account-management-final-polish.md` | **PARTIAL FOUNDATION:** có confirm, idempotency và lifecycle UI; live revoke/restore vẫn có allowlist một cơ sở trong client, không được tái dùng làm authority. |
| C7.9 lifecycle | `src/supabase-auth.js`, endpoint list, revoke/restore functions, docs C7.9A/B/C | **REPO FACT:** active/revoked/paused membership được phân biệt; revoked/paused chặn bootstrap và có denied UX. |

### 2.2 Sự thật kỹ thuật hiện tại

1. **REPO FACT:** `center_members` có khóa unique `(center_id, user_id)` và các field `role`, `status`. Authenticated user chỉ có policy đọc membership của chính mình; `centers` chỉ đọc được khi có membership tương ứng.
2. **REPO FACT:** helper `is_center_member` và `can_write_center` đều dựa trên `auth.uid()` + active `center_members`. Không có helper platform authority.
3. **REPO FACT:** `provision_center_for_owner` là `SECURITY DEFINER`, kiểm tra actor có ít nhất một active `owner` membership rồi tự thêm active `owner` membership vào center mới. Đây là provisioning model lịch sử, không phải cơ chế cấp `platform_owner`.
4. **REPO FACT:** browser list centers qua RLS, nên Internal Console hiện không phải inventory toàn hệ thống độc lập membership.
5. **REPO FACT:** center switch thay `cloudStatus`, storage center namespace và realtime/bootstrap context, nhưng bắt buộc membership thật ở center đích.
6. **REPO FACT:** các server account functions dùng server-only privileged client, xác thực access token, kiểm tra active `owner` membership đúng `center_id`, dùng idempotency và ghi `account_audit_logs`.
7. **REPO FACT:** audit hiện có `actor_user_id`, action, target, center, before/after, reason, request và timestamp; constraint ngăn các key mật khẩu plaintext phổ biến.
8. **REPO FACT:** revoke/restore hiện đổi membership `center_admin` giữa `active` và `revoked`; revoke không mặc định disable Auth user.
9. **REPO FACT:** login/current-center fail closed nếu không có active membership; revoked/paused user không bootstrap dữ liệu OS.
10. **REPO FACT:** không có machine role `platform_owner`, bảng global assignment, global authorization helper, acting-session record, acting expiry, acting revoke hoặc acting audit trong repo.
11. **REPO FACT:** search repo không tìm thấy runtime impersonation/support/break-glass; tài liệu C6/C7 nhiều lần xác nhận center switch không phải acting mode.
12. **PARTIAL FOUNDATION:** server-side guard, idempotency, RLS theo center, lifecycle state và audit pattern có thể tái sử dụng; chúng không tự tạo ra global authority.

## 3. Mô hình vai trò canonical

| Khái niệm | Scope | Nguồn quyền | Có vào OS cơ sở trực tiếp? | Có tự cấp `platform_owner`? |
| --- | --- | --- | --- | --- |
| `platform_owner` | Toàn nền tảng | Assignment server-side chuyên biệt | Không; cần membership của chính mình hoặc acting session hợp lệ | Không |
| `owner` | Một cơ sở | Active `center_members` của cơ sở đó | Có, trong đúng cơ sở membership | Không |
| `center_admin` | Một cơ sở | Active `center_members` của cơ sở đó | Có, trong đúng cơ sở membership | Không |
| Các role vận hành khác | Theo membership/capability hiện hữu | `center_members` và policy hiện hữu | Chỉ theo scope hiện hữu | Không |

**DESIGN PROPOSAL:** machine value duy nhất cho quyền tối cao là `platform_owner`. Nhãn giao diện có thể dịch là “Chủ nền tảng”, nhưng API, table, event và test không tạo alias machine khác.

**DESIGN PROPOSAL:** `owner` tiếp tục là membership của từng cơ sở. Việc một account là Owner ở một, nhiều hoặc mọi center không suy ra `platform_owner`; việc mất mọi membership cũng không tự thu hồi global assignment, nhưng sẽ làm mọi đường membership-based center access fail closed.

## 4. Invariants bắt buộc

- **PLATFORM-AUTH-1:** Chỉ server-side canonical assignment mới chứng minh `platform_owner`; email, UI state, URL, localStorage, sessionStorage và request body không có giá trị cấp quyền.
- **PLATFORM-AUTH-2:** `platform_owner` độc lập với `center_members`; không cần tạo membership ở mọi center và không được suy ra từ role `owner`.
- **PLATFORM-AUTH-3:** Owner hoặc Center Admin không thể grant, approve, activate, restore hay revoke global authority qua đường quản trị cơ sở.
- **PLATFORM-AUTH-4:** Mọi lỗi đọc authority, row trùng/mâu thuẫn, status lạ, hết hạn, revoke, account lifecycle không hợp lệ hoặc audit precondition thất bại đều deny.
- **PLATFORM-AUTH-5:** Privileged server credential không xuất hiện trong browser, bundle, client config, log, audit metadata hay response.
- **PLATFORM-AUTH-6:** Global Console access và center acting access là hai authorization context riêng; có global access không mặc nhiên đọc/ghi dữ liệu center.
- **PLATFORM-AUTH-7:** Acting session phải tường minh, center-scoped, reasoned, scoped, expiring, revocable, auditable và có thao tác thoát vai.
- **PLATFORM-AUTH-8:** Acting session không tạo/sửa `center_members`, không giả danh user thật và không thay actor identity trong audit.
- **PLATFORM-AUTH-9:** Mọi privileged action kiểm capability riêng tại server; không có cờ “platform bypass” dùng chung để bỏ toàn bộ RLS.
- **PLATFORM-AUTH-10:** Grant/revoke/restore authority và approval nhạy cảm là protected server workflow, có separation of duties và append-only audit.
- **PLATFORM-AUTH-11:** Revoke/suspend/expiry có hiệu lực ở lần server authorization tiếp theo; cache hoặc token cũ không được kéo dài quyền.
- **PLATFORM-AUTH-12:** Permanent deletion, secret access, credential disclosure, audit mutation và tự phê duyệt bị cấm hoặc deferred dù actor là Platform Owner.

## 5. So sánh nguồn cấp quyền

| Phương án | Đánh giá | Audit/revoke/expiry | Fail-closed | Quyết định |
| --- | --- | --- | --- | --- |
| A. Bảng assignment server-side chuyên biệt | Tách đúng global authority khỏi center membership; query được bằng server helper | Tốt; versioned lifecycle và event đầy đủ | Tốt nếu deny-on-error và unique active invariant | **RECOMMENDED** |
| B. Auth `app_metadata` | Server/Admin API kiểm soát được, token tiện cho coarse gate | Revocation có độ trễ JWT/cache; lịch sử và approval cần bảng phụ | Chỉ phù hợp hint, không làm nguồn duy nhất | **SECONDARY CACHE/HINT ONLY** |
| C. `center_members` | Đã có nhưng là authority per-center | Có lifecycle membership, không diễn đạt global scope sạch | Dễ privilege creep và membership ngầm | **REJECTED AS PLATFORM SOURCE** |
| D. Hardcoded email hoặc frontend allowlist | Nhanh nhưng dựa trên client/deploy và danh tính có thể đổi | Không có lifecycle/audit đáng tin | Không | **REJECTED** |
| E. Auth `user_metadata` | User-facing metadata không phải trusted authority store | Không đủ separation/revoke guarantee | Không | **NOT SUITABLE FOR AUTHORITY** |

**DESIGN PROPOSAL:** `app_metadata` nếu dùng sau này chỉ chứa projection version hoặc coarse hint. Server luôn re-check assignment canonical cho action nhạy cảm; mismatch giữa claim và table trả deny và ghi security event.

## 6. Data model đề xuất — chưa phải SQL

### 6.1 `platform_operator_assignments`

Conceptual fields:

```text
assignment_id
user_id
role                 -- exact value platform_owner
status               -- PROPOSED | ACTIVE | SUSPENDED | REVOKED | EXPIRED | REJECTED | CANCELLED
assignment_term      -- temporary | long_lived
proposed_by_user_id
proposed_at
approved_by_user_id
approved_at
activated_at
expires_at
review_due_at
last_reviewed_at
last_reviewed_by_user_id
review_status
suspended_by_user_id
suspended_at
suspension_reason
revoked_by_user_id
revoked_at
revoke_reason
restored_from_assignment_id
authority_version
created_at
updated_at
```

Constraints đề xuất:

- một `user_id` không có hơn một assignment `ACTIVE` cho `platform_owner`;
- actor không thể tự là proposer và approver trong normal flow;
- `approved_by_user_id` khác target `user_id`;
- `assignment_term` là giá trị server-controlled; không suy ra term một cách mơ hồ chỉ từ `expires_at`;
- assignment `temporary`: `expires_at` bắt buộc, hợp lệ và ở tương lai; `review_due_at` bắt buộc và không muộn hơn `expires_at`;
- assignment `long_lived`: `expires_at` có thể `NULL`, nhưng `review_due_at` bắt buộc, hợp lệ và ở tương lai;
- `NULL expires_at` không bao giờ có nghĩa authority vô thời hạn không kiểm soát; review quá hạn phải deny hoặc chuyển `SUSPENDED` theo policy đã duyệt;
- khi activate, approval review đầu tiên phải điền `last_reviewed_at`, `last_reviewed_by_user_id` và `review_status`; lần review sau tạo audit mới và tăng version;
- lifecycle là state transition, không hard delete;
- mọi mutation đi qua protected function/endpoint, không direct browser DML;
- optimistic concurrency bằng `authority_version` để chặn stale approval/revoke.

### 6.2 Lifecycle authority

| State | Ý nghĩa | Có quyền? | Transition hợp lệ đề xuất |
| --- | --- | --- | --- |
| `PROPOSED` | Yêu cầu chờ duyệt; dùng để separation of duties và bootstrap review | Không | `ACTIVE`, `REJECTED`, `CANCELLED`, `EXPIRED` |
| `ACTIVE` | Assignment đã duyệt, còn hạn, account hợp lệ | Có theo capability | `SUSPENDED`, `REVOKED`, `EXPIRED` |
| `SUSPENDED` | Tạm dừng điều tra/nghỉ việc/sự cố | Không | `ACTIVE` qua approval mới, hoặc `REVOKED` |
| `REVOKED` | Thu hồi vĩnh viễn assignment row này | Không | Không restore row; tạo proposal mới có link `restored_from_assignment_id` |
| `EXPIRED` | Hết `expires_at` hoặc review deadline | Không | Không restore row; tạo proposal mới |
| `REJECTED` | Approver từ chối proposal chưa từng active | Không | Terminal; proposal mới phải tạo row mới |
| `CANCELLED` | Proposer hoặc authorized operator hủy proposal trước activation | Không | Terminal; proposal mới phải tạo row mới |

`PROPOSED` được dùng vì grant quyền tối cao không thể là single-click self-service. `REJECTED` và `CANCELLED` không được biểu diễn bằng `REVOKED`, vì proposal đó chưa từng có authority. Hai state này không được activate lại hoặc tái sử dụng; yêu cầu mới tạo row mới. Mỗi transition phải ghi actor, reason, before/after, request/idempotency key và authority version. Suspend/revoke/expiry kết thúc mọi acting session còn mở của target; cache projection bị tăng version để request tiếp theo deny. Restore không hồi sinh row đã revoke/expire, nhờ đó giữ lịch sử bất biến.

### 6.3 Account lifecycle integration

```text
IMPLEMENTATION PREREQUISITE
CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: NO
PLATFORM_AUTHORITY_IMPLEMENTATION_BLOCKED_WITHOUT_ACCOUNT_LIFECYCLE: YES
ACCOUNT_LIFECYCLE_DEPENDENCY_ERROR_FAILS_CLOSED: YES
```

**REPO FACT:** repo hiện chứng minh membership lifecycle và một số Auth checks trong server functions, nhưng chưa chứng minh có canonical server-side global account lifecycle hoàn chỉnh cho Platform Owner. Vì vậy chưa được triển khai `is_active_platform_owner` chỉ dựa trên một bảng được giả định là đã tồn tại.

**DESIGN PROPOSAL:** trước implementation phải phê duyệt một trong hai hướng:

1. server endpoint kiểm tra Auth Admin state cùng canonical app account state; hoặc
2. canonical server-side account-lifecycle table được đồng bộ bằng approved workflow.

Nguồn được duyệt phải trả lời Auth user có tồn tại không; banned/disabled/deleted; app-level security lock; terminated/paused nếu sản phẩm có; assignment state; và dependency health. Không dùng membership status làm global account lifecycle duy nhất, không dùng browser cache, không dùng access-token claim cũ làm nguồn duy nhất và không allow khi dependency lỗi hoặc không đọc được.

`is_active_platform_owner(user_id)` chỉ true khi đồng thời:

- Auth user tồn tại và request user đã được xác thực;
- canonical account state cho phép đăng nhập/đặc quyền;
- có đúng một assignment `ACTIVE`, role chính xác, chưa revoke/suspend/expire;
- không có unresolved security lock bắt buộc;
- authority dependency và audit dependency cần thiết đọc được.

Các case phải deny:

| Case | Kết quả |
| --- | --- |
| Auth user bị ban/disable/delete | Deny; end sessions; audit system event |
| Account app-level paused/terminated | Deny; suspend assignment theo workflow |
| Membership center revoked nhưng global assignment active | Global Console vẫn có thể hợp lệ; membership-based OS access deny; acting cần policy riêng |
| Global assignment revoked nhưng membership Owner còn active | Global Console deny; OS center vẫn theo membership Owner hiện hữu |
| Claim cũ nói active nhưng table revoked/expired | Deny; table thắng; security audit |
| Nhiều active rows hoặc role/status không nhận diện | Deny; integrity incident |

## 7. Authorization helper và capability contract

Pseudocode khái niệm, không phải implementation:

```text
is_active_platform_owner(auth.uid()):
  if auth.uid() is null: return false
  account = load approved canonical server-side account lifecycle
  if account dependency is not approved, missing, unhealthy, or unreadable: return false
  if account user is missing, deleted, disabled, banned, security-locked, paused, or terminated: return false
  rows = load platform_operator_assignments for auth.uid() and role platform_owner
  if query failed or active-row count != 1: return false
  assignment = rows[0]
  if assignment.status != ACTIVE: return false
  if assignment.revoked_at or assignment.suspended_at: return false
  if assignment.assignment_term == temporary:
    if expires_at is null, invalid, or expires_at <= server_now(): return false
    if review_due_at is null, invalid, or review_due_at > expires_at: return false
  else if assignment.assignment_term == long_lived:
    if expires_at is not null and (invalid or expires_at <= server_now()): return false
    if review_due_at is null, invalid, or review_due_at <= server_now(): return false
  else: return false
  if review_due_at is null, invalid, or review_due_at <= server_now(): return false
  if last_reviewed_at is null, invalid, or last_reviewed_at > server_now(): return false
  if last_reviewed_by_user_id is null: return false
  if review_status is not current/approved: return false
  return true

authorize_platform_action(action, target_center_id, acting_session_id):
  if not is_active_platform_owner(auth.uid()): deny
  capability = resolve server-side action policy(action)
  if capability unknown or disabled: deny
  if capability.requires_acting:
    validate active acting session for actor + center + scope + expiry + version
  if capability.requires_approval:
    validate distinct approver and unconsumed approval bound to exact action digest
  write/require append-only audit according to action policy
  allow only the specific operation; never return a generic bypass
```

Recommended capabilities:

```text
platform.console.view
platform.centers.list
platform.audit.read
platform.center.create.request
platform.center.lifecycle.request
platform.account.lifecycle.request
platform.authority.propose
platform.authority.approve
platform.authority.revoke
platform.acting.start.read
platform.acting.start.write
platform.acting.end
platform.acting.revoke
center.data.read.acting
center.data.write.acting
center.private_hr.read.approved
center.private_hr.view_download.approved
center.financial_detail.read.approved
```

Không có capability `platform.rls.bypass_all`.

## 8. RLS/RPC trust-boundary design

### 8.1 Assignment table RLS

**DESIGN PROPOSAL:** bật RLS. Browser không có INSERT/UPDATE/DELETE. Quyền SELECT của chính actor không được dùng làm authority check cho mutation; nếu mở, chỉ trả projection tối thiểu của assignment của chính mình để render trạng thái, không lộ operator list, approver note nhạy cảm hoặc target khác.

Operator list đầy đủ chỉ qua protected server endpoint có capability `platform.authority.read`. Grant/revoke/approve chỉ qua protected server path; Owner/Center Admin không có execute grant.

### 8.2 Function/RPC hardening cho phase implementation

- helper dùng `auth.uid()` hoặc verified server actor, không nhận `actor_user_id` tin cậy từ body;
- nếu dùng `SECURITY DEFINER`: owner cố định, `search_path` explicit, fully qualified object, `PUBLIC` execute bị revoke, chỉ grant exact caller role/path;
- không cho caller truyền role/status/approved-by tự do;
- action payload được canonicalize và hash để approval không dùng lại cho target khác;
- grant, revoke, suspend và approval dùng transaction + row lock + expected version;
- authority/acting mutation và append-only audit phải atomic trong cùng transaction, hoặc mutation cùng transactional-outbox record phải commit atomic; audit precondition/write/outbox lỗi thì rollback và deny;
- không có contract giữ authority state mới khi audit thiếu; partial external side effect dùng compensation + incident runbook riêng và không được nới lỏng authority mutation;
- tránh recursive RLS bằng helper narrowly scoped, `SECURITY DEFINER` đã review hoặc server endpoint; không tạo policy tự query lại chính table theo đường recursive;
- execute grants được test riêng cho `anon`, `authenticated`, operator endpoint và server runtime;
- mọi unknown action/status/scope đều deny.

### 8.3 Browser/server secret boundary

Browser chỉ gửi user access token và business input tối thiểu. Privileged server credential chỉ được đọc từ môi trường server đã duyệt, không nằm trong source client, không trả về response và không ghi log. Chuỗi `service_role` trong tài liệu này chỉ mô tả loại credential bị cấm trong browser, không phải secret hoặc chỉ dẫn cấu hình.

## 9. Global Console khác Acting Session

| Thuộc tính | Global Console | Acting Session |
| --- | --- | --- |
| Mục đích | Inventory, health, governance, audit, request/approval toàn hệ thống | Hỗ trợ một center cụ thể theo scope |
| Authority gốc | Active `platform_owner` assignment | Active assignment + acting session hợp lệ |
| Center context | Có thể không có; target center chỉ là object governance | Bắt buộc một `target_center_id` |
| Dữ liệu vận hành center | Không đọc mặc định | Chỉ theo scope session |
| Membership | Không yêu cầu | Không tạo membership |
| Actor audit | Platform actor thật | Vẫn là Platform actor thật + session id; không giả user |
| Hết quyền | Assignment suspend/revoke/expire | Assignment hoặc session suspend/revoke/expire/end |
| UI exit | Rời console | Nút “Thoát vai hỗ trợ” luôn hiển thị |

**DESIGN PROPOSAL:** nếu Platform Owner đồng thời có active membership thật ở center, UI phải buộc chọn “Vào bằng quyền membership” hoặc “Mở phiên hỗ trợ”; không tự nâng sang acting và không nhập nhằng audit source.

## 10. Acting session contract

Conceptual fields bắt buộc:

```text
session_id
platform_actor_user_id
target_center_id
reason
requested_at
started_at
expires_at
ended_at
ended_by
end_reason
status
```

Fields bổ sung đề xuất:

```text
requested_scopes
approved_scopes
approval_id
approved_by_user_id
authority_version_at_start
last_verified_at
created_request_id
client_context_hash
```

### 10.1 Quyết định mặc định cho F23.12C

- read-only support session chỉ cho low-risk operational read: Platform Owner có thể tự mở theo approved policy sau re-auth, reason bắt buộc, tối đa 30 phút;
- write session: cần Platform Owner thứ hai duyệt, approval bind đúng actor/center/scopes/expiry;
- scope mặc định là least privilege; không có `all` wildcard;
- một actor chỉ có một acting session active; mở session mới phải end session cũ rõ ràng;
- server kiểm session và assignment ở mọi privileged request, không tin heartbeat client;
- UI heartbeat chỉ để refresh trạng thái; quá 5 phút không verify được server thì chuyển read-only/deny;
- không auto-renew; hết hạn phải tạo request mới;
- re-auth bắt buộc trước start và trước high-risk approval;
- emergency revoke cho security operator path đã duyệt; revoke kết thúc session ngay ở request tiếp theo;
- break-glass **DEFERRED** cho đến khi có on-call policy, second-channel alert, post-incident review và bounded scope;
- nút thoát vai luôn hiện, end idempotent, server ghi `ended_by`, `end_reason` và timestamp;
- acting không impersonate email/display name/identity của người trong center.

### 10.2 `SINGLE_OPERATOR_BOOTSTRAP_MODE`

Trong rollout ban đầu chỉ có một active Platform Owner:

```text
SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO
SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES
SELF_APPROVAL_ALLOWED: NO
```

- Global Console metadata read được phép theo capability;
- read-only acting chỉ có thể self-start cho low-risk operational read theo approved policy;
- write acting bị khóa fail-closed;
- mọi action `REQUIRE ADDITIONAL APPROVAL` bị khóa fail-closed;
- grant/revoke authority qua normal in-app workflow chưa được phép;
- cùng actor không được đứng ở cả requester và approver, không giả lập approver và không self-approval;
- Owner/Center Admin không trở thành global approver ngầm;
- không dùng email hardcode hoặc client state để vượt khóa.

Write acting chỉ có thể mở sau khi có Platform Owner thứ hai active/hợp lệ, chứng minh separation of duties, approval service đã triển khai và authority/audit atomic tests đã PASS. First bootstrap bằng protected operator runbook không biến người thực thi runbook thành in-app approver cho những action tiếp theo.

### 10.3 Private-data boundary

```text
READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO
PRIVATE_HR_READ_REQUIRES_ADDITIONAL_APPROVAL: YES
PRIVATE_EXPORT_DEFAULT: FORBIDDEN
```

Low-risk operational read có thể thuộc self-start read-only acting sau re-auth, reason và TTL:

- lịch vận hành;
- attendance summary phù hợp;
- trạng thái module;
- dữ liệu hỗ trợ không nhạy cảm;
- metadata kỹ thuật tối thiểu.

Sensitive read không thuộc self-start acting:

- private HR attachments và hồ sơ hành chính nhạy cảm;
- định danh cá nhân đầy đủ và thông tin ngân hàng;
- chứng từ private và dữ liệu tài chính chi tiết;
- signed download/view capability;
- export.

Mỗi sensitive read cần acting session hợp lệ **và** capability riêng **và** additional approval. Approval phải bind exact actor, center, subject, action và expiry; TTL ngắn; audit từng lần; single-use; không wildcard; không reuse; không export mặc định. Metadata list cũng phải masked để self-start session không suy ra nội dung nhạy cảm.

## 11. Action matrix

Quy ước: `REQUIRE ADDITIONAL APPROVAL` là mức cao hơn và vẫn bao gồm acting session nếu action chạm dữ liệu center. Đây là recommended default cho phase sau, chưa phải quyền runtime.

| Action | Platform Owner status | Điều kiện/rationale |
| --- | --- | --- |
| Mở Global Console, xem health/inventory center | ALLOW DIRECTLY | Active assignment; metadata tối thiểu; audit access theo sampling/risk |
| Xem platform authority list | ALLOW DIRECTLY | Capability riêng; dữ liệu tối thiểu; mọi export bị chặn |
| Xem audit toàn hệ thống | ALLOW DIRECTLY | Read-only, paginated, masked; audit read event |
| Tạo center | REQUIRE ADDITIONAL APPROVAL | Không tái dùng `owner` membership guard lịch sử; exact request digest |
| Pause/archive/restore center | REQUIRE ADDITIONAL APPROVAL | Lifecycle nhạy cảm, không hard delete |
| Hard delete center | FORBIDDEN | Không có product use case/backup protocol đã duyệt |
| Đổi Owner của center | REQUIRE ADDITIONAL APPROVAL | Acting session + distinct approver; không cho target tự duyệt |
| Tạo/sửa/revoke membership thường | REQUIRE ACTING SESSION | Scope exact center và role; Owner/Center Admin policy hiện hữu vẫn độc lập |
| Grant/revoke `platform_owner` | REQUIRE ADDITIONAL APPROVAL | Protected authority workflow; không qua acting |
| Tạo account Admin/Teacher | REQUIRE ACTING SESSION | Server endpoint; không privileged credential ở browser |
| Reset mật khẩu account | REQUIRE ADDITIONAL APPROVAL | Acting + re-auth + distinct approval; secret one-time handling riêng |
| Lock/ban/unban account toàn hệ thống | REQUIRE ADDITIONAL APPROVAL | Global lifecycle; end sessions; exact reason |
| Xem dữ liệu vận hành center | REQUIRE ACTING SESSION | Read scope, center-bound, expiring |
| Sửa dữ liệu học viên/nhân sự thường | REQUIRE ACTING SESSION | Write scope cụ thể; actor thật trong audit |
| Xem tài liệu nhân sự private | REQUIRE ADDITIONAL APPROVAL | Vẫn cần acting session; capability riêng bind actor/center/subject/action/expiry; audit từng lần |
| Xem hồ sơ hành chính nhạy cảm/PII đầy đủ/thông tin ngân hàng | REQUIRE ADDITIONAL APPROVAL | Vẫn cần acting; TTL ngắn; masked-by-default; không wildcard/reuse |
| Tạo signed view/download cho private HR/chứng từ | REQUIRE ADDITIONAL APPROVAL | Approval single-use; exact subject/object/action/expiry; audit từng lần |
| Export tài liệu private/hồ sơ nhạy cảm | FORBIDDEN | Chờ DLP/export approval design |
| Xem tổng quan tài chính không nhạy cảm đã mask | REQUIRE ACTING SESSION | Read-only scope, center-bound, expiring |
| Xem dữ liệu tài chính chi tiết/chứng từ private | REQUIRE ADDITIONAL APPROVAL | Vẫn cần acting; capability/subject/action/expiry exact; audit từng lần |
| Sửa/duyệt giao dịch tài chính | REQUIRE ADDITIONAL APPROVAL | Acting + approval + reconciliation/audit contract |
| Xem/sửa điểm danh | REQUIRE ACTING SESSION | Scope read/write tách biệt |
| Xem/sửa lịch học | REQUIRE ACTING SESSION | Scope read/write tách biệt |
| Soft removal/deletion request tài liệu | REQUIRE ACTING SESSION | Tuân thủ F23.11E.2A; không vượt review/legal hold |
| Permanent Storage deletion | DEFERRED | F23.11E.2B LATER; cần executor và lifecycle canonical |
| Xóa/sửa audit log | FORBIDDEN | Audit append-only; correction bằng event mới |
| Export audit log | REQUIRE ADDITIONAL APPROVAL | Bounded range, masking, watermark và audit export event |
| Đọc secret/token/credential server | FORBIDDEN | Không phải business capability |

## 12. Audit append-only contract

Audit authority/acting đề xuất dùng event store chuyên biệt hoặc mở rộng hạ tầng hiện hữu sau review. Không overwrite/delete event. Correction là event mới tham chiếu event cũ.

Fields tối thiểu:

```text
event_id
occurred_at
actor_user_id
actor_assignment_id
actor_authority_version
acting_session_id
action
target_type
target_id
target_center_id
request_id
approval_id
reason_code
reason_text_redacted
before_state
after_state
outcome
denial_code
source_channel
correlation_id
metadata_redacted
```

Không log password, token, signed URL, private document content, raw authorization header, privileged credential hoặc full request body. Audit phải phân biệt `GLOBAL_CONSOLE`, `MEMBERSHIP_CONTEXT`, `ACTING_CONTEXT` và system expiry/revoke. Các event tối thiểu gồm authority proposed/approved/activated/reviewed/suspended/revoked/expired/rejected/cancelled, acting requested/started/denied/approved/expired/ended/emergency-revoked, approval consumed/rejected và every high-risk action outcome.

### 12.1 Atomic mutation + audit contract

```text
AUTHORITY_MUTATION_WITHOUT_AUDIT_ALLOWED: NO
AUTHORITY_MUTATION_AUDIT_ATOMIC_REQUIRED: YES
TRANSACTIONAL_OUTBOX_ACCEPTABLE: YES
```

Các transition authority `propose/approve/activate/suspend/revoke/expire/reject/cancel`, acting `request/start/approve/end/revoke` và high-risk approval consumption phải bảo đảm state mutation + append-only audit bằng một trong hai contract:

1. **Preferred:** cùng database transaction, row lock, expected version, exact request/idempotency key và audit insert thành công trước commit.
2. **Approved alternative:** state mutation và transactional-outbox record cùng commit trong một transaction; worker phát event sau. Mutation không được coi là externally complete nếu outbox record không tồn tại.

Nếu audit precondition, audit insert hoặc outbox insert thất bại thì rollback/deny. Không chấp nhận quyền đã đổi mà thiếu audit. Partial external side effects ngoài transaction phải có compensation và incident runbook riêng; chúng không được dùng để cho phép authority/acting mutation tồn tại thiếu audit.

## 13. Threat model

| # | Threat | Likelihood | Impact | Mitigation thiết kế | Residual / phase |
| --- | --- | --- | --- | --- | --- |
| T1 | Hardcoded operator email bị chiếm/đổi | Medium | Critical | Không dùng email làm authority; assignment theo verified user id | F23.12D identity ceremony |
| T2 | Client sửa localStorage/request role | High | Critical | Server canonical check; ignore client role | Implementation tests |
| T3 | Owner tự nâng thành Platform Owner | Medium | Critical | Không grant path từ center; protected approval | F23.12D |
| T4 | Privileged credential rò vào bundle | Low | Critical | Server-only env, build/secret scan | CI + deployment review |
| T5 | JWT claim cũ sau revoke | Medium | High | Table re-check/version mỗi privileged action | Cache SLA decision |
| T6 | Nhiều active assignment mâu thuẫn | Low | Critical | Unique invariant + deny count != 1 | Integrity alert |
| T7 | Acting session bị replay | Medium | High | Opaque id, version, expiry, action-bound scope | F23.12C implementation |
| T8 | Session còn sống sau revoke | Medium | Critical | Assignment/session check mỗi request; cascade end | Realtime UI is secondary |
| T9 | Cross-center target swap | Medium | Critical | Bind approval/session/action digest to exact center | Regression mandatory |
| T10 | Acting bị hiểu là impersonation | Medium | High | Actor identity không đổi; persistent banner/audit | UI contract F23.12B/C |
| T11 | Approval tự duyệt hoặc reuse | Medium | Critical | Distinct actor, single-use digest, expiry, row lock | Approval service |
| T12 | Recursive RLS làm allow/error không rõ | Medium | High | Narrow helper, explicit search path, deny on error | SQL review phase |
| T13 | Audit lỗi nhưng authority mutation thành công | Low | Critical | Cùng transaction hoặc transactional outbox; audit/outbox lỗi thì rollback/deny | Atomicity tests + recovery runbook |
| T14 | Export làm lộ PII/private docs | Medium | Critical | Default forbidden; DLP/masking/approval | Deferred export design |
| T15 | Break-glass bị lạm dụng | Low | Critical | Không triển khai; future short TTL, alerts, review | Deferred |
| T16 | Account bị ban nhưng assignment còn active | Medium | Critical | Account lifecycle là điều kiện helper; end sessions | Canonical account table needed |
| T17 | Universal RLS bypass mở dữ liệu ngoài scope | Medium | Critical | Capability-specific policy; không generic bypass | Architecture invariant |

## 14. UI state contract — không implement UI

Global Console phải có các state độc lập:

| State | UI contract |
| --- | --- |
| `AUTHORITY_CHECKING` | Không render dữ liệu/cache nhạy cảm; skeleton trung tính |
| `AUTHORITY_DENIED` | Không suy đoán lý do nhạy cảm; đường quay lại OS/sign-out |
| `AUTHORITY_ACTIVE` | Hiện identity Platform Owner, assignment expiry/review status |
| `AUTHORITY_SUSPENDED_OR_EXPIRED` | Read/write đều khóa; yêu cầu re-check, không client override |
| `ACTING_NONE` | Global context rõ; không render center operational modules |
| `ACTING_REQUESTED` | Hiện target/reason/scopes/approver/expiry; chưa cấp quyền |
| `ACTING_ACTIVE_READ` | Banner cố định, center, actor, countdown, scopes, nút thoát vai |
| `ACTING_ACTIVE_WRITE` | Banner danger rõ hơn; approval id/status; high-risk confirm |
| `ACTING_EXPIRING` | Warning; không auto-renew |
| `ACTING_ENDED_OR_REVOKED` | Đóng center data, clear in-memory view, về Global Console |
| `AUTHORITY_ERROR` | Fail closed; không dùng cache để tiếp tục |

Mọi tab/window phải nhận server-derived context; route hoặc query string không phải authority. Refresh/reopen phải re-resolve assignment/session. Nút “Thoát vai hỗ trợ” không nằm trong menu ẩn và không bị che bởi modal. UI không hiển thị Platform Owner như Center Admin/Owner của center.

Recommended error codes cho API/UI mapping: `platform_authority_required`, `platform_authority_inactive`, `platform_authority_expired`, `platform_authority_integrity_error`, `acting_session_required`, `acting_session_inactive`, `acting_session_scope_denied`, `additional_approval_required`, `approval_invalid_or_consumed`, `action_deferred`, `action_forbidden`.

## 15. Bootstrap Platform Owner đầu tiên

**DESIGN PROPOSAL:** F23.12A chỉ so sánh đường bootstrap; không gán account.

| Option | Boundary | Đánh giá |
| --- | --- | --- |
| Operator SQL với `user_id` đã resolve | Chạy trong change window, query exact id, two-person review, insert proposal/activation + audit | Có thể dùng cho first bootstrap nếu migration/runbook đã duyệt; không dùng email literal trong app |
| Protected admin runbook | Human xác minh identity, backup, approval, execute exact server command, post-verify | **Recommended process wrapper** |
| Server-only bootstrap path tạm | Endpoint chỉ tồn tại trong controlled window, one-time nonce ngoài browser, tự disable | Có thể dùng nhưng phức tạp và tăng attack surface |
| Owner/Center Admin UI self-service | Client/center authority tự nâng global | **FORBIDDEN** |

Recommended: protected admin runbook + operator execution bằng resolved immutable user id + second-person out-of-band change review + append-only audit + immediate post-verification. First bootstrap exception phải được ghi rõ; người thực thi hoặc reviewer của runbook không tự động trở thành in-app approver. Khi chỉ có một active Platform Owner, những grant tiếp theo, write acting và mọi action cần additional approval tiếp tục bị khóa cho đến khi normal approval workflow có Platform Owner thứ hai hợp lệ. Actual assignment thuộc F23.12D.

## 16. Approval gates cần business/technical sign-off

Các default dưới đây đủ để design complete nhưng phải được approve trước implementation:

- AG-1: dedicated assignment table là canonical authority; `app_metadata` chỉ hint.
- AG-2: chỉ low-risk operational read được self-start acting tối đa 30 phút; private HR/sensitive read cần capability + additional approval riêng.
- AG-3: không break-glass trong lần triển khai đầu.
- AG-4: một active acting session mỗi actor, không auto-renew.
- AG-5: account ban/disable/termination vô hiệu Platform Owner ngay lần check kế tiếp.
- AG-6: grant/restore authority không tái sử dụng revoked/expired row.
- AG-7: private export, audit mutation, permanent delete và secret access bị cấm/deferred.
- AG-8: Platform Owner không nhận silent membership khi provision hoặc acting.
- AG-9: mọi action center write của Platform Owner cần acting; high-risk action còn cần approval.
- AG-10: actual first assignment chỉ F23.12D qua approved bootstrap runbook.
- AG-11: single-operator rollout khóa write acting, normal in-app authority mutation và mọi action additional-approval; không self-approval hoặc approver giả.
- AG-12: temporary/long-lived assignment phải có explicit term, review deadline và overdue fail-closed semantics.
- AG-13: canonical server-side account lifecycle là implementation prerequisite; dependency chưa duyệt/lỗi thì deny.
- AG-14: authority/acting mutation và append-only audit phải cùng transaction hoặc transactional outbox atomic.

## 17. Open questions Q1–Q15

| ID | Câu hỏi | Recommended default | Lý do | Rủi ro nếu chọn khác | Approval |
| --- | --- | --- | --- | --- | --- |
| Q1 | Authority canonical nằm ở đâu? | Dedicated table | Audit/revoke/expiry rõ | Claim/client drift | Security + backend |
| Q2 | `app_metadata` có là authority duy nhất? | Không, chỉ hint | JWT stale | Revoke chậm | Security |
| Q3 | Assignment dài hạn có expiry? | `expires_at` có thể NULL nhưng `review_due_at` bắt buộc và overdue deny | Giảm quyền tồn lưu | NULL bị hiểu là quyền vô hạn | Business + security |
| Q4 | Ai duyệt grant? | Platform Owner khác target; bootstrap dùng two-person operator review | Separation of duties | Self-grant | Business |
| Q5 | Owner cơ sở có nominate không? | Chỉ gửi business request, không approve/activate | Tách center/global | Privilege escalation | Business |
| Q6 | Read-only acting có cần approver hai? | Chỉ low-risk operational read được self-start; sensitive/private cần additional approval | Hỗ trợ nhanh nhưng giữ privacy boundary | Private-data exposure | Privacy + security |
| Q7 | Write acting TTL? | Tối đa 30 phút, Platform Owner thứ hai duyệt; single-operator thì khóa | Separation of duties | Self-approved write | Security |
| Q8 | Cho nhiều session song song? | Không, một session/actor | Tránh nhầm center | Cross-center error | UX + security |
| Q9 | Heartbeat có gia hạn không? | Không; server verification only | Không biến client thành authority | Silent extension | Security |
| Q10 | Có impersonate user thật? | Không | Audit identity rõ | Non-repudiation failure | Security + legal |
| Q11 | Break-glass khi nào? | Deferred | Chưa có on-call/alert/review | Uncontrolled bypass | Executive + security |
| Q12 | Platform Owner có bypass RLS chung? | Không | Least privilege | Platform-wide breach | Architecture |
| Q13 | Audit lưu reason text thế nào? | Code + redacted bounded text | Hữu ích nhưng giảm PII | Sensitive leakage | Legal + privacy |
| Q14 | Export global/private cho phép? | Default forbidden; design riêng | DLP chưa có | Bulk leak | Legal + business |
| Q15 | First bootstrap dùng đường nào? | Approved runbook + resolved user id + two-person review | Ít attack surface | Hidden permanent backdoor | Executive + security |

## 18. Phase split và developer handoff

### F23.12B — DONE design

- screen/module inventory cho Global Console;
- server-derived authority states và center inventory contract;
- không tái dùng hidden route guard `owner + membership` như global authorization;
- không mở center operational data từ list.

F23.12B design có thể bắt đầu sau khi bản vá F23.12A.1 qua final technical audit. Không được triển khai server authority hoặc UI runtime trước các prerequisite ở mục 21.

### F23.12C — DONE design

- finalize acting schema/status/scopes/approval/re-auth/TTL;
- khóa write acting trong single-operator rollout và tách low-risk read khỏi sensitive/private read;
- race/replay/revoke/expiry/cross-center test matrix;
- persistent banner, countdown và exit semantics;
- protected RPC/endpoint/RLS design review.

### F23.12D — DONE design/controlled assignment

- approve bootstrap runbook;
- resolve target by immutable user id server-side;
- no email hardcode, no real account fixture in repo;
- assignment, audit, revoke drill và post-verify chỉ sau explicit approval.

CodeX implementation phase sau phải:

1. bắt đầu từ clean approved checkpoint và đọc lại doc này;
2. không sửa sáu migration đã apply F23.11;
3. tạo migration mới duy nhất sau review, không repair/rename lịch sử;
4. triển khai server helper/path trước UI;
5. viết negative tests self-grant, self-approval, single-operator write lock, private self-start denial, client role spoof, claim stale, review overdue, account dependency error, audit atomic rollback/outbox, cross-center, expiry, revoke, approval reuse và recursive RLS;
6. chứng minh privileged credential không vào browser/build;
7. triển khai UI chỉ sau server authorization test PASS;
8. không assign tài khoản thật nếu chưa ở F23.12D và chưa có approval.

## 19. Smoke/regression interpretation

F23.12A smoke chỉ assert tài liệu này và canonical roadmap; không assert runtime/SQL vì phase không triển khai chúng. Smoke là docs-contract test, không phải runtime security proof.

Targeted regression nền tại clean checkpoint `29cb88d`:

- PASS: C6.5D, C6.6G, C6.6H, C7.4, C7.5, C7.7C, C7.8A, C7.8B, C7.8G, C7.8H, C7.9A, C7.9B, C7.9C.
- Baseline stale/phase-locked: C6.3E và C6.4F vẫn cấm chuỗi Add Center dù C6.6 đã triển khai; C6.6E yêu cầu `src/main.js` đang có diff của đúng phase. Ba failure này có ngay trên clean checkpoint và không được “sửa” bằng thay đổi ngoài scope F23.12A.

## 20. Canonical roadmap

```text
F23.11 DONE public/backend / Hồ sơ hành chính Nhân viên, tài liệu nhân sự và attachment private
    F23.11A DONE design
    F23.11B DONE public
    F23.11C DONE public
    F23.11D DONE public
    F23.11E DONE backend/public
        F23.11E.1 DONE backend/public
        F23.11E.2A DONE backend/public / Soft removal, deletion request, review và legal hold
        F23.11E.2B LATER backend / Permanent object deletion cần approved server-side executor và canonical employment lifecycle

F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed
    F23.12D DONE design / Controlled bootstrap, assignment và revoke drill
```

## 21. Implementation readiness

```text
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
```

F23.12A vẫn `DONE design`, nhưng implementation bị khóa cho đến khi đồng thời có:

- approval các policy AG;
- canonical server-side account lifecycle đã duyệt và đọc được fail-closed;
- Platform Owner thứ hai active/hợp lệ cho write acting và action additional-approval;
- authority migration/RLS/RPC design đã duyệt;
- atomic audit hoặc transactional outbox implementation đã PASS;
- controlled bootstrap runbook đã duyệt.

Không dùng single-operator bootstrap, membership Owner/Center Admin, email, client state hoặc claim cũ để bỏ qua blocker.

## 22. Definition of done F23.12A

- audit đủ Internal Console, provisioning/switching, account governance/lifecycle, current center, membership, server functions, helper/RPC/RLS và audit: **PASS**;
- fact/proposal/deferred được phân biệt: **PASS**;
- canonical role độc lập membership và fail-closed authority source: **PASS**;
- Global Console tách Acting Session; expiry/revoke/audit/exit rõ: **PASS**;
- lifecycle, RLS/RPC, bootstrap, account integration, action matrix, threat model, UI states và Q1–Q15 có recommended defaults: **PASS**;
- single-operator write lock, private-data approval boundary, review deadline/null semantics, account lifecycle prerequisite và atomic audit contract: **PASS design / BLOCKED implementation**;
- không runtime/SQL/migration/Auth/Supabase/real assignment: **PASS**.

F23.12A FINAL TECHNICAL AUDIT PASS - F23.12B DESIGN MAY START
