# F23.12B — Global Internal Console và Center Inventory

Ngày chốt design: 2026-07-29

```text
F23_12B_STATUS: DONE DESIGN
F23_12B_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_FINAL_TECHNICAL_AUDIT: PASS
F23_12A_STATUS: DONE DESIGN
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
CANONICAL_MACHINE_ROLE: platform_owner
GLOBAL_CONSOLE_AUTHORITY_SOURCE: SERVER_SIDE_PLATFORM_OWNER_ASSIGNMENT
PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES
GLOBAL_CONSOLE_IS_ACTING_SESSION: NO
CENTER_SWITCH_IS_ACTING_SESSION: NO
GLOBAL_CONTEXT_AND_CENTER_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO
MEMBERSHIP_CONTEXT_AND_ACTING_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO
BROWSER_BACK_REQUIRES_CONTEXT_REVALIDATION: YES
CONTEXT_TRANSITION_CLEARS_INCOMPATIBLE_DATA: YES
LEGACY_OWNER_MEMBERSHIP_GUARD_REUSED_FOR_GLOBAL_CONSOLE: NO
SERVER_DERIVED_AUTHORITY_AND_CAPABILITIES_REQUIRED: YES
CENTER_OPERATIONAL_DATA_IN_GLOBAL_CONSOLE: NO
READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO
SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO
SELF_APPROVAL_ALLOWED: NO
PRIVATE_INVENTORY_EXPORT_DEFAULT: FORBIDDEN
PRIVATE_HR_IN_CENTER_INVENTORY_ALLOWED: NO
DIRECT_CENTER_OPERATIONAL_QUERY_ALLOWED: NO
CLIENT_ONLY_PLATFORM_AUTHORIZATION_ALLOWED: NO
DIRECT_BROWSER_PRIVILEGED_QUERY_ALLOWED: NO
HARDCODED_OPERATOR_EMAIL_ALLOWED: NO
UNIVERSAL_RLS_BYPASS_ALLOWED: NO
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

## 1. Kết luận thiết kế

**DESIGN PROPOSAL:** Global Internal Console là một platform surface mới dành cho active `platform_owner`, nhận authority context và capability từ server. Surface này xem inventory/governance metadata đã duyệt trên toàn hệ thống mà không cần membership từng center, nhưng tuyệt đối không bootstrap module vận hành, không đọc dữ liệu center tier G3 và không tạo acting context ngầm.

**DESIGN PROPOSAL:** Centers, Center Governance Detail và System Readiness là ba vùng chi tiết của F23.12B. Platform Operators, Global Audit và Requests & Approvals chỉ có shell/navigation contract; không authority mutation trong phase này.

**DEFERRED:** route, UI, endpoint, assignment, RLS/RPC, health aggregator, acting service và mọi mutation vẫn chưa triển khai. F23.12A final audit đã PASS ở mức design; implementation tiếp tục `BLOCKED` bởi account lifecycle, second Platform Owner, approved authority data plane, atomic audit và bootstrap runbook.

## 2. Nhãn bằng chứng và boundary kế thừa

- **REPO FACT:** có bằng chứng trực tiếp trong source, migration hoặc checkpoint docs.
- **PARTIAL FOUNDATION:** có pattern tái sử dụng được nhưng không đạt global platform contract.
- **DESIGN PROPOSAL:** contract cho phase implementation sau; chưa tồn tại.
- **DEFERRED:** chủ động chưa triển khai hoặc cần approval khác.

F23.12B kế thừa nguyên vẹn:

- `platform_owner` độc lập `center_members`;
- Global Console không phải Acting Session;
- center switch không phải Acting Session;
- frontend, role string, route, cache và email không phải authority source;
- không browser privileged credential, không generic/universal RLS bypass;
- không self-grant, self-approval hoặc Owner/Center Admin làm global approver ngầm;
- một Platform Owner thì write acting và mọi additional-approval action bị khóa fail-closed;
- private HR/sensitive data không thuộc self-start read;
- permanent deletion vẫn F23.11E.2B `LATER`.

## 3. Repo audit

### 3.1 Hidden Internal Center Console hiện tại

1. **REPO FACT:** route là hash `#/internal/centers`, kiểm tra exact equality trong `isInternalCenterConsoleRoute()`.
2. **REPO FACT:** `getInternalCenterConsoleAccess()` yêu cầu signed-in user, center binding `bound`, membership hiện tại `active` và role normalize thành `owner`.
3. **REPO FACT:** `renderInternalCenterConsoleRoute()` trả denied nếu guard trên fail; guard này không kiểm server-side Platform Owner assignment.
4. **REPO FACT:** app chỉ render internal route sau khi center membership login gate đã mở. Platform Owner không có membership chưa có đường bootstrap Global Console trong runtime hiện tại.
5. **REPO FACT:** console route không nằm trong public navigation; đây là hidden surface lịch sử.

### 3.2 Center list và provisioning

1. **REPO FACT:** list hiện select `id,name,slug,environment,status,created_at,updated_at` trực tiếp từ `centers`, chỉ lấy `production` + `active`, sort theo `name` và không có server pagination.
2. **REPO FACT:** RLS `centers` hiện cho authenticated user xem center mà user có row `center_members`; list này không phải platform-wide inventory.
3. **REPO FACT:** Add Center gọi RPC `provision_center_for_owner(p_center_name)` từ browser.
4. **REPO FACT:** RPC lịch sử là `SECURITY DEFINER`, guard actor có ít nhất một active `owner` membership rồi tạo center production/active và active Owner membership cho actor ở center mới.
5. **PARTIAL FOUNDATION:** form validation, loading/error/refresh pattern và stable identity fields có thể tham khảo; RPC/guard/provisioning semantics không được tái dùng làm Platform Owner authority hoặc global create-center execution.

### 3.3 Center switch/current-center/cache

1. **REPO FACT:** `canOpenInternalCenter()` yêu cầu actor là Owner, target production/active và có active membership thật ở target.
2. **REPO FACT:** `handleInternalOpenCenter()` đổi current storage center, reload local namespace, reset cloud/realtime state, đổi `cloudStatus` và bootstrap dữ liệu target.
3. **REPO FACT:** `resolveActiveCenterMembership()` chọn active membership đầu theo `center_id` khi user có nhiều center; `resolveAppCenterBinding()` đánh dấu source là `account-membership`.
4. **REPO FACT:** revoked/paused/no-membership dẫn tới denied/error binding và chặn normal dashboard bootstrap.
5. **DESIGN PROPOSAL:** Global Console không gọi center switch để xem governance detail. Chỉ entry “Mở bằng quyền membership của tôi” mới rời Global Console sang existing membership context sau server revalidation.

### 3.4 Lifecycle, account governance, audit và readiness

1. **REPO FACT:** `centers.environment` constraint hiện có `production`, `staging`, `test`, `development`; status constraint có `active`, `paused`, `archived`.
2. **REPO FACT:** account operations create/reset/revoke/restore dùng server functions, verified user token, active Owner membership guard, request/idempotency và `account_audit_logs`.
3. **REPO FACT:** audit table có actor/action/target/center/before/after/reason/request/timestamp và chặn các key password plaintext phổ biến.
4. **REPO FACT:** repo có nhiều readiness/error state theo module và private attachment readiness; chưa có platform health aggregator canonical.
5. **PARTIAL FOUNDATION:** lifecycle vocabulary, confirm/error UX, server function guard/audit pattern và horizontal table overflow có thể tái sử dụng ở mức pattern.
6. **DEFERRED:** global account lifecycle canonical, authority service, global inventory endpoint, provisioning lifecycle source, acting service và atomic authority audit chưa tồn tại.

## 4. Console cũ và Global Console mới

| Contract | Internal Center Console hiện tại | Global Internal Console đề xuất |
| --- | --- | --- |
| Authority | Active `owner` membership của current center | Active server-side `platform_owner` assignment |
| Bootstrap | Sau center membership gate | Platform authority gate độc lập center binding |
| Center coverage | Chỉ center RLS/membership cho phép | Metadata đã duyệt của mọi center |
| Open center | Membership switch + data bootstrap | Không bootstrap center data; chỉ governance detail |
| Acting | Không có | Chỉ entry tạo/request acting; service thuộc F23.12C |
| Membership mutation | RPC provisioning lịch sử tạo Owner membership | Không silent membership |
| Data | Center metadata + account ops theo Owner scope | G0/G1 và masked G2 governance metadata |
| Operational/private data | Có thể đi vào OS center qua membership | Không hiển thị tier G3 |

### 4.1 Coexistence/migration path

1. Giữ nguyên `#/internal/centers` và Owner Ops hiện tại trong transition; không đổi guard hoặc xóa surface ở F23.12B.
2. Thêm platform route/shell riêng trong phase implementation sau, authority bootstrap không phụ thuộc `currentCenterId`.
3. Khi Platform Owner có membership thật, Global Console chỉ hiện explicit entry sang membership OS; không nhúng console cũ vào global detail.
4. Khi feature parity và authority backend đã PASS, product có thể deprecate các global-looking action của console cũ bằng phase riêng; center-scoped Owner Ops vẫn có thể tồn tại.
5. Deep link cũ không redirect tự động sang Global Console vì hai authority model khác nhau.

### 4.2 Context transition contract

Mỗi tab chỉ được có đúng một actor-context hiệu lực: `GLOBAL_CONSOLE`, `MEMBERSHIP_CONTEXT` hoặc `ACTING_CONTEXT`. Global Console và center context không được đồng thời active; membership và acting cũng không được đồng thời active. Route, browser Back/Forward, `currentCenterId`, local storage, in-memory snapshot và subscription cũ không phải authority.

| Transition | Điều kiện server | Context phải kết thúc | Cleanup bắt buộc | Kết quả |
| --- | --- | --- | --- | --- |
| Global → Membership | Revalidate account + active membership target | Global | Clear inventory/detail/cursors/global capabilities | Bootstrap center bằng membership thật |
| Global → Acting | Acting request/session hợp lệ theo F23.12C | Global | Clear inventory/detail/cursors/global capabilities | Chỉ active acting context đã bind actor + center |
| Membership → Global | Revalidate active Platform Owner assignment | Membership | Dừng center subscriptions; clear operational data, viewer và center capabilities | Global shell tải snapshot mới |
| Membership → Acting | End membership context rồi revalidate acting | Membership | Dừng subscriptions; clear center operational data/viewer/capabilities | Không reuse membership authority/approval |
| Acting → Global | End/revoke/expire acting rồi revalidate Platform Owner | Acting | Clear operational data, signed URL/viewer, drafts và acting capabilities; dừng subscriptions | Global shell tải snapshot mới |
| Acting → Membership | End acting rồi revalidate active membership target | Acting | Cùng cleanup acting; không giữ scope/approval | Membership context mới |
| Acting center A → Acting center B | Không cho direct switch | Acting A | End A và cleanup hoàn tất trước | Tạo request/session B mới |

Browser Back/Forward luôn đi qua context gate server-side trước khi render hoặc nối lại subscription. Transition lỗi để tab ở trạng thái không-authority, clear dữ liệu không tương thích và cung cấp retry/sign-out; không phục hồi context từ history hay local storage.

## 5. Information architecture

```text
Global Console Shell
├── Overview
├── Centers
│   ├── Center Inventory
│   └── Center Governance Detail
├── Platform Operators        [shell only in F23.12B]
├── Global Audit              [shell/read contract only]
├── Requests & Approvals      [shell only; no mutation]
└── System Readiness
```

### 5.1 Centers

- server-paginated inventory;
- search/filter/sort;
- row warning/readiness summary;
- explicit environment and lifecycle labels;
- governance detail entry;
- explicit membership entry hoặc acting request entry theo server capability.

### 5.2 Center Governance Detail

- identity, environment, lifecycle, provisioning, owner/membership aggregate;
- readiness signals, warnings, recent governance events và request history đã redact;
- available actions theo server-derived capability;
- không student/staff/cashflow/tuition/attendance/schedule business rows.

### 5.3 System Readiness

- platform dependency summary, timestamp, source và status;
- `UNKNOWN`/`NOT IMPLEMENTED` không được render như PASS;
- detail lỗi được redact cho browser.

## 6. Global Console shell contract

Header/shell phải hiển thị:

- Platform Owner identity đã server xác nhận, không dùng email làm authorization;
- assignment status, `review_due_at` và `expires_at` nếu có;
- label `Ngữ cảnh toàn hệ thống`;
- dòng cố định `Không ở chế độ hỗ trợ cơ sở`;
- không gắn badge Owner/Center Admin và không dùng desktop center name làm shell identity;
- lối về Admin OS bằng membership nếu có, hoặc sign out;
- authority checking/denied/expired/suspended/error state.

Không render cached inventory trước khi server authority revalidation thành công. Assignment/review overdue hoặc dependency error phải clear/lock inventory và deny action.

## 7. Global metadata privacy tiers

| Tier | Nội dung | Global list/detail | Capability/Mask | Acting |
| --- | --- | --- | --- | --- |
| G0 — low-sensitivity platform governance metadata | Display name, environment, lifecycle label | Có | `platform.centers.list`; không secret detail | Không |
| G1 — operator governance metadata | Provisioning state, readiness summary, aggregate count, assigned/unassigned | Có | Governance read capability; bounded aggregate | Không |
| G2 — sensitive governance metadata | Masked owner identity, account-lock summary, redacted failure category | Detail hoặc opt-in column | Capability riêng; mask/redact; audit read | Không mặc định; full identity cần approval riêng |
| G3 — center operational/private data | Student/staff records, private HR, chứng từ, finance/attendance/schedule detail | Không | Không field/capability trong inventory response | Acting phù hợp; sensitive còn cần additional approval |

G2 không được nâng thành G3 chỉ vì actor là Platform Owner. Full owner/membership identities không nằm trong default inventory; approval/capability riêng nếu business duyệt. G3 không xuất hiện trong Center Governance Detail.

G0 không phải public data. G0 chỉ được trả bởi endpoint đã server-authorize cho active Platform Owner; không có public/anonymous API. “Low-sensitivity” không có nghĩa là được export tự do: export mặc định vẫn cấm và mọi export tương lai cần capability, giới hạn field/row, audit và approval riêng.

## 8. Center inventory field contract

| Field | Nguồn dự kiến | Evidence | Tier | List | Mask | Acting | Stale behavior | Unavailable behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `center_id` | `centers.id` qua platform inventory service | REPO FACT field / PROPOSAL service | G1 | Có | Không, nhưng không export mặc định | Không | Badge stale; không action | Hiện `Không khả dụng`, row non-actionable |
| `display_name` | `centers.name` | REPO FACT | G0 | Có | Không | Không | Có thể hiện từ in-memory snapshot sau authority recheck | Placeholder |
| `slug` | `centers.slug` | REPO FACT | G0/G1 | Có | Không | Không | Badge stale | `—` |
| `environment` | canonical `centers.environment` | REPO FACT values | G0 | Có, explicit text | Không | Không | Stale badge | `UNKNOWN`, không đoán theo ID/slug |
| `lifecycle_status` | canonical `centers.status` + approved mapping | REPO FACT base / PROPOSAL normalization | G0/G1 | Có | Không | Không | Stale badge; mutation disabled | `UNKNOWN`, warning |
| `provisioning_status` | future provisioning state service/event | DESIGN PROPOSAL | G1 | Có nếu source ready | Không | Không | `UNKNOWN`, không lấy lifecycle thay thế | `NOT IMPLEMENTED` |
| `readiness_status` | future health aggregator | DESIGN PROPOSAL | G1 | Có summary | Redact raw detail | Không | Timestamp + stale | `UNKNOWN` |
| `owner_summary` | server aggregate từ approved membership/account source | PARTIAL FOUNDATION / PROPOSAL aggregate | G1/G2 | Chỉ assigned/unassigned; masked label optional | Có | Không cho masked governance; full identity approval riêng | Drop G2 khi stale | `UNKNOWN`, không suy ra “unassigned” |
| `membership_summary` | server aggregate canonical active/paused/revoked | DESIGN PROPOSAL | G1 | Count bounded | Không identity | Không | Drop hoặc mark stale | `UNKNOWN` |
| `created_at` | `centers.created_at` | REPO FACT | G1 | Optional | Không | Không | Display stale timestamp | `—` |
| `updated_at` | `centers.updated_at` | REPO FACT | G1 | Có | Không | Không | Dùng làm sort only khi source valid | `—` |
| `last_health_check_at` | health aggregator | DESIGN PROPOSAL | G1 | Có | Không | Không | Tự xác định stale threshold | `Chưa có tín hiệu` |
| `warning_count` | server-computed authorized warnings | DESIGN PROPOSAL | G1 | Có count/severity | Raw detail redact | Không | Badge stale; action disabled | `UNKNOWN`, không phải zero |

Server chỉ trả field actor được authorize. `null`, `unknown` và unavailable khác zero/false/unassigned. Client không merge field từ request trước hoặc tự suy ra source thay thế.

### 8.1 Field tuyệt đối không có trong inventory

- private HR data/attachments/object path/signed URL;
- student, staff hoặc full personal identity records;
- full payment, tuition, cashflow hoặc private voucher detail;
- credential, password, token, authorization header hoặc secret;
- raw database/policy error;
- unrestricted account/membership identity list.

## 9. Environment, lifecycle và provisioning

### 9.1 Environment normalization

Server mapping đề xuất:

| Canonical source | UI label | Mutation behavior |
| --- | --- | --- |
| `production` | Production | High-risk request, re-auth/approval policy |
| `staging` | Staging | Governance actions vẫn server-guarded |
| `test` | Test | Không suy ra là safe sandbox |
| `development` | Development | Có thể map vào non-production filter sau approval |
| null/malformed/other | Unknown | Read warning tối thiểu; mutation deny |

Không suy environment từ suffix center ID, slug, hostname hoặc localStorage.

### 9.2 Lifecycle/provisioning separation

- Lifecycle canonical ứng viên: `ACTIVE`, `PAUSED`, `ARCHIVED`, `UNKNOWN` từ `centers.status`.
- Provisioning overlay: `PROVISIONING`, `PROVISIONING_FAILED`, `NOT_IMPLEMENTED`, `UNKNOWN` từ future service/event; không nhét vào lifecycle column nếu schema chưa duyệt.
- Center provisioning có thể chưa usable dù lifecycle `ACTIVE`; hai signal phải hiển thị riêng.
- Unknown/malformed vẫn hiện identity tối thiểu để governance triage, nhưng mọi mutation fail closed.
- Hard delete center không có trong design.

## 10. Search, filter, sort và pagination

### 10.1 Search

- fuzzy/prefix search theo normalized display name và slug;
- exact search cho center ID;
- masked owner summary chỉ searchable nếu backend có approved privacy-safe index;
- trim, max length, rate limit và server parameterization;
- browser không gửi raw SQL, PostgREST expression hoặc arbitrary column name.

### 10.2 Filters

- environment;
- lifecycle status;
- provisioning status;
- readiness;
- warning presence/severity;
- owner assigned/unassigned/unknown.

Filter là enum allowlist ở server. `unknown` là lựa chọn thật, không bị loại khỏi list mặc định khi governance cần triage.

### 10.3 Sort

- display name;
- created/updated date;
- warning severity;
- readiness status.

Sort key/direction dùng allowlist. Stable tie-breaker là `center_id`; không tin raw client order expression.

### 10.4 Pagination

- server-side opaque stable cursor, bind vào normalized query/filter/sort và snapshot version;
- recommended page size 25, max 100 sau approval;
- response có `next_cursor`, `has_more`, `page_size`, không trả total exact nếu expensive/privacy-sensitive;
- cursor invalid/stale trả safe error và restart affordance;
- không tải mọi center để client filter/sort/paginate;
- không lưu toàn bộ pages trong persistent browser storage.

## 11. Center Governance Detail

Detail chỉ gồm:

- center identity, environment, lifecycle/provisioning;
- masked owner summary và membership aggregates;
- readiness status, timestamp/source, redacted warnings;
- recent governance events với actor/target đã mask theo capability;
- request history, status, expiry và approval availability;
- action descriptors từ server: visible/enabled/status/reason code.

Không render Student list, Staff list, private documents, cashflow/tuition rows, attendance rows, schedule events hoặc signed object access. “Xem governance detail” không tạo center binding, local namespace, realtime subscription hoặc bootstrap center modules.

## 12. Action matrix

| Action | Normal design status | Single-operator/UI behavior | Boundary |
| --- | --- | --- | --- |
| Xem center inventory G0/G1 | ALLOW DIRECTLY | Enabled sau authority check | Server capability; không acting |
| Xem Center Governance Detail G0/G1 | ALLOW DIRECTLY | Enabled | Không center data bootstrap |
| Xem masked G2 governance metadata | ALLOW DIRECTLY | Chỉ nếu assignment có capability | Mask + audit read; không full identities |
| Refresh readiness | ALLOW DIRECTLY | Enabled nếu service available | Read-only health request, redact error |
| Tạo center request | CREATE REQUEST | Disabled nếu request backend chưa ready | Không gọi RPC Owner lịch sử; execution cần approval |
| Pause center request | CREATE REQUEST | Có thể draft; submit chỉ khi workflow ready | Không đổi status trực tiếp |
| Restore center request | CREATE REQUEST | Có thể draft; submit chỉ khi workflow ready | Không đổi status trực tiếp |
| Archive center request | CREATE REQUEST | Có thể draft; submit chỉ khi workflow ready | Không hard delete |
| Đổi Owner request | CREATE REQUEST | Submit disabled nếu không có approver/workflow | Không direct membership mutation |
| Execute center lifecycle/Owner change | REQUIRE ADDITIONAL APPROVAL | `SINGLE_OPERATOR_BLOCKED` | Distinct Platform Owner + atomic audit |
| Xem membership aggregate | ALLOW DIRECTLY | Enabled nếu aggregate source available | Không identity rows |
| Xem full owner/membership identities | REQUIRE ADDITIONAL APPROVAL | Disabled fail-closed | Capability/approval riêng; audit |
| Mở center bằng membership thật | ALLOW DIRECTLY | Chỉ khi server revalidates active membership | Explicitly leave Global Console |
| Yêu cầu read-only acting low-risk | CREATE REQUEST | Enabled only when acting request service ready | Không session/data trong F23.12B |
| Yêu cầu write acting | CREATE REQUEST | Disabled trong single-operator rollout | Start cần second Platform Owner approval |
| Kích hoạt acting session | DEFERRED | `ACTING_NOT_IMPLEMENTED` | F23.12C triển khai/revalidate; không fallback |
| Xem center operational data low-risk | REQUIRE ACTING SESSION | Không hiển thị trong Global Console | Chỉ sau acting service F23.12C và scope hợp lệ |
| Xem private/sensitive center data | REQUIRE ADDITIONAL APPROVAL | Disabled | Vẫn cần acting + exact capability/approval |
| Export center inventory | DEFERRED | Không nút active | Chờ B-AG5/DLP/masking contract |
| Hard-delete center | FORBIDDEN | Không render destructive action | Không supported |
| Sửa/xóa audit | FORBIDDEN | Không render | Append-only correction event only |
| Grant/revoke Platform Owner | REQUIRE ADDITIONAL APPROVAL | Disabled; implementation blocked | F23.12D/authority workflow, không center action |

Action descriptor từ server phải có `action`, `status`, `enabled`, `reason_code`, `requires_reauth`, `requires_acting`, `requires_approval`. Client không tự biến disabled thành enabled. Trong single-operator rollout, action additional-approval không hiện như có thể hoàn tất; recommended UI là visible disabled với lý do và không gửi mutation request.

## 13. Entry sang center

### 13.1 Actor có membership thật

Server item capability có thể trả `membership_entry_available: true` sau revalidation. UI hiện hai lựa chọn tách biệt khi acting service ready:

```text
Mở bằng quyền membership của tôi
Mở phiên hỗ trợ cơ sở
```

Không auto-select. Membership entry dùng role/membership thật và đi qua current-center transition hiện hữu; acting entry không dùng membership role để giả approval.

### 13.2 Actor không có membership

Không có nút switch/open OS trực tiếp. Chỉ có `Mở phiên hỗ trợ cơ sở` hoặc `Yêu cầu phiên hỗ trợ` nếu server capability/service ready.

### 13.3 Acting backend chưa sẵn sàng

Hiển thị `Chế độ hỗ trợ chưa khả dụng`, action disabled, error code `acting_service_not_ready`. Không tạo membership, không set current center/localStorage, không client-only context và không fallback sang Owner guard.

F23.12B chỉ thiết kế entry/request; không mở dữ liệu vận hành center.

## 14. System Readiness và health

Status vocabulary:

```text
AVAILABLE
PARTIAL
NOT IMPLEMENTED
DEGRADED
UNKNOWN
```

| Signal | Repo foundation | Initial truthful status | Future canonical source | Safe UI detail |
| --- | --- | --- | --- | --- |
| Authority service | F23.12A design only | NOT IMPLEMENTED | approved server authority service | Status + review/expiry; no raw query |
| Center metadata service | Membership RLS list exists | PARTIAL | platform inventory endpoint | Snapshot/version/timestamp |
| Provisioning | Owner membership RPC exists | PARTIAL | platform request/executor workflow | Request state, redacted failure category |
| Account operations | Server functions + audit exist | PARTIAL | capability-aware platform endpoints | Aggregate availability only |
| Audit | `account_audit_logs` foundation | PARTIAL | atomic platform audit/outbox | Append-only health, no payload leak |
| Acting capability | Không có service/session | NOT IMPLEMENTED | F23.12C | Disabled reason |
| Storage/private attachment boundary | Private attachment governance exists; permanent delete deferred | PARTIAL | approved readiness aggregator | Boundary state; never object path |
| Migration compatibility | Applied schema exists nhưng platform schema chưa design/apply | UNKNOWN | versioned compatibility check | Version/status only |

Mỗi signal có `status`, `checked_at`, `source_version`, optional `safe_code`; raw database error/policy/stack không về browser. `UNKNOWN` không phải PASS, `PARTIAL` không tự enable mutation. Manual refresh vẫn re-check authority trước.

## 15. Server-derived data contract

Conceptual response, không phải endpoint/schema thật:

```text
authority_context:
  status
  assignment_id
  authority_version
  review_due_at
  expires_at
  global_context: true
  acting_session: null

inventory_snapshot:
  snapshot_id
  snapshot_version
  generated_at
  stale_after
  completeness

items[]:
  center_id
  display_name
  slug
  environment
  lifecycle_status
  provisioning_status
  readiness_status
  owner_summary
  membership_summary
  created_at
  updated_at
  last_health_check_at
  warning_count
  row_capabilities
  membership_entry_available

pagination:
  page_size
  next_cursor
  has_more

capabilities:
  global[]
  field_visibility[]
  action_descriptors[]

readiness[]
generated_at
snapshot_version
```

Contract rules:

- authority context/capabilities chỉ server-derived;
- item chỉ chứa authorized fields; omitted khác `null`;
- client không suy capability từ `platform_owner` string;
- client không direct-query toàn bảng bằng privileged key hoặc gọi `service_role` từ browser;
- response không có G3 data, raw secrets/errors hoặc signed URL;
- every action re-check assignment, account lifecycle, capability, version và approval tại server;
- mismatch snapshot/authority version deny mutation và refresh.

## 16. Stale, cache, revoke và tab behavior

- persistent cache chỉ chứa shell preference, filter enum và skeleton placeholder; không lưu inventory pages/G2/G3;
- in-memory snapshot có `generated_at`, version và stale badge; chỉ hiện sau active authority revalidation;
- khi stale, G2 bị ẩn, mutation/action request disabled; G0/G1 có thể hiển thị read-only với badge nếu policy duyệt;
- authority revoke/suspend/expire hoặc dependency error clear inventory memory, detail, cursors và capabilities;
- tab cũ revalidate khi focus, trước pagination, trước detail và trước action;
- refresh/reopen không tin localStorage current center hoặc cached role;
- cursor bind snapshot; stale cursor restart query;
- offline state không biến browser thành global data warehouse.

## 17. UI state matrix

| State | Visible message | Data visibility | Actions | Retry | Escape | Clear cache/data? |
| --- | --- | --- | --- | --- | --- | --- |
| `AUTHORITY_CHECKING` | `Đang xác minh quyền nền tảng…` | Skeleton only | None | Auto/bounded | Sign out | Clear inventory |
| `AUTHORITY_DENIED` | `Bạn không có quyền vào Global Console` | None | None | Re-auth only | Admin OS/sign out | Yes |
| `AUTHORITY_ACTIVE` | Assignment/review status + global context | Authorized shell/inventory | Server capabilities | Normal refresh | Admin OS/sign out | No |
| `AUTHORITY_EXPIRED` | `Quyền nền tảng đã hết hạn` | None | None | Re-auth không override expiry | Sign out | Yes |
| `AUTHORITY_SUSPENDED` | `Quyền nền tảng đang tạm dừng` | None | None | Server recheck | Sign out | Yes |
| `AUTHORITY_ERROR` | `Không thể xác minh quyền` | None | None | Safe retry | Sign out | Yes |
| `INVENTORY_LOADING` | `Đang tải danh sách cơ sở…` | Skeleton | Filters disabled | Cancel/retry | Overview | Clear prior G2 |
| `INVENTORY_EMPTY` | `Không có cơ sở phù hợp bộ lọc` | Empty state | Reset filters | Yes | Overview | No |
| `INVENTORY_READY` | Snapshot timestamp | Authorized rows | Row capabilities | Refresh | Overview | No |
| `INVENTORY_PARTIAL` | `Dữ liệu governance chưa đầy đủ` | Available fields; unknown explicit | Mutation disabled where incomplete | Retry signal/query | Overview | Drop unavailable/G2 |
| `INVENTORY_STALE` | `Dữ liệu có thể đã cũ` | Read-only G0/G1 if policy permits | Mutation disabled | Required refresh | Overview | Drop G2/capabilities |
| `INVENTORY_ERROR` | `Không tải được inventory` | None/skeleton | None | Safe retry | Overview/sign out | Yes |
| `CENTER_DETAIL_LOADING` | `Đang tải governance…` | Skeleton | None | Cancel/retry | Centers | Clear prior detail |
| `CENTER_DETAIL_READY` | Center identity + governance state | G0/G1, authorized masked G2 | Server descriptors | Refresh | Centers | No |
| `CENTER_DETAIL_UNAVAILABLE` | `Governance detail chưa khả dụng` | Identity tối thiểu nếu authorized | None | Retry | Centers | Clear detail G2 |
| `ACTION_NOT_PERMITTED` | Safe reason | Existing authorized read data | No target action | Revalidate | Centers/detail | Clear stale capability |
| `ADDITIONAL_APPROVAL_REQUIRED` | `Cần Platform Owner khác phê duyệt` | Governance only | Create request if service ready | Status refresh | Detail | No |
| `SINGLE_OPERATOR_BLOCKED` | `Chưa có Platform Owner thứ hai để phê duyệt` | Governance only | Approval/write disabled | Recheck operator readiness | Detail | No |
| `ACTING_NOT_IMPLEMENTED` | `Chế độ hỗ trợ chưa khả dụng` | Governance only | Acting disabled | Capability refresh | Detail | Clear acting placeholder |

Production/staging/test/unknown và warning severity phải có text/icon, không chỉ màu.

## 18. Error contract

```text
platform_authority_required
platform_authority_inactive
platform_authority_expired
platform_authority_integrity_error
platform_inventory_unavailable
platform_inventory_partial
center_governance_not_found
center_lifecycle_unknown
additional_approval_required
single_operator_approval_unavailable
acting_session_required
acting_service_not_ready
action_deferred
action_forbidden
```

Error response chỉ có safe code, correlation ID và bounded user message. Không trả raw database error, RLS/policy text, stack, SQL, object path, credential hoặc secret detail. Unknown code map về fail-closed generic error.

## 19. Route/navigation options

| Option | Authority gate | Center binding | Refresh/deep link | Exposure/complexity | Transition |
| --- | --- | --- | --- | --- | --- |
| A. Tái dùng `#/internal/centers` | Dễ vô tình giữ Owner guard | Bị coupling hiện tại | Deep link đã có | Risk cao: lẫn hai authority | **REJECTED as default**; console cũ vẫn giữ nguyên |
| B. Hash namespace mới `#/internal/platform/centers` trong app entry | Platform authority check trước platform shell | Phải tách khỏi center login gate | Deep link có thể re-run platform bootstrap | Complexity vừa; cần sửa auth/bootstrap có review | **RECOMMENDED DESIGN**, cần technical approval |
| C. Platform entry/app riêng | Authority isolation rõ | Không center binding | Deep link/refresh độc lập | Complexity/deployment cao | Future option nếu isolation yêu cầu |

Recommendation là Option B với route namespace riêng và platform bootstrap branch độc lập current-center. Tuy nhiên route thật chưa được chốt/implement vì current render flow gate internal route sau center membership. Technical approval phải xác nhận auth/bootstrap split, refresh behavior và no cached inventory flash. Option C giữ làm fallback kiến trúc; không tự tạo deployment mới.

Navigation entry chỉ xuất hiện sau server authority confirmation; URL biết trước không cấp quyền. Legacy route không redirect hoặc share guard với platform route.

## 20. Responsive, density và layout

**REPO FACT:** console cũ có panel `width: min(1120px, 100%)`, desktop padding 24px, table `min-width: 720px` và horizontal overflow. Đây là baseline tham khảo, không chứng minh đủ cho Global Console.

**DESIGN PROPOSAL:**

- desktop/laptop first; target content width khoảng 1280–1440px cần visual/technical approval;
- compact laptop layout thu gọn secondary columns vào governance drawer;
- sticky semantic table header, horizontal overflow trong một container;
- filter bar wrap được, search giữ visible label;
- pagination ngoài scroll container;
- Center Governance Detail dùng drawer/window rộng, không nested-scroll trap;
- skeleton giữ column geometry, warning badges bounded;
- mobile support **DEFERRED**, không tuyên bố responsive-complete.

## 21. Accessibility và copy

- semantic `<table>`, column header/sort state và caption/accessible name;
- keyboard focus order từ nav → search/filter → rows → pagination;
- detail drawer focus trap đúng, restore focus khi đóng;
- status có text/icon, không chỉ màu; contrast/focus-visible đạt chuẩn được duyệt;
- error dễ hiểu, không lộ technical secret;
- Vietnamese labels đủ chỗ, không truncate identity/status quan trọng không có tooltip;
- destructive request có summary + typed/explicit confirmation ở phase workflow;
- Production/Staging/Test/Unknown luôn có text;
- dùng `Mở phiên hỗ trợ cơ sở`, `Thoát chế độ hỗ trợ`, `Mở bằng quyền membership của tôi`;
- không dùng copy “đăng nhập với tư cách Owner của cơ sở” cho acting.

## 22. Approval gates F23.12B

| Gate | Recommended default | Lý do | Rủi ro nếu khác | Approver/scope | Implementation phase |
| --- | --- | --- | --- | --- | --- |
| B-AG1 Global Console ở đâu? | Namespace route riêng trong Admin OS entry, bootstrap platform độc lập | Transition vừa phải | Share guard gây privilege confusion | Architecture/Auth | Pre-runtime F23.12 implementation |
| B-AG2 Metadata không acting? | Chỉ G0/G1 + masked G2 capability | Inventory hữu ích, giữ privacy | G3 leak | Security/Privacy/Product | Inventory endpoint |
| B-AG3 Owner identity? | Default assigned/unassigned; masked identity ở detail | Data minimization | Identity enumeration | Privacy/Business | Field policy |
| B-AG4 Membership identities? | Aggregate only; full identities additional approval | Tránh bulk account exposure | PII leak | Privacy/Security | Later governance action |
| B-AG5 Export inventory? | Deferred/forbidden mặc định | Chưa có DLP/masking | Bulk metadata leak | Legal/Privacy | Separate export design |
| B-AG6 Environment source? | Canonical `centers.environment` qua server mapping | Repo có constraint | Suffix inference sai | Backend/Data | Inventory service |
| B-AG7 Readiness source? | Versioned server aggregator, signal source/timestamp | Không bịa health | False PASS | SRE/Backend/Security | Readiness service |
| B-AG8 Create center? | Chỉ create request | Separation + audit | Owner RPC bypass | Business/Security | Request workflow |
| B-AG9 Pause/archive/restore approver? | Hai distinct Platform Owner cho execution | High impact | Single-actor outage | Executive/Security | Approval service |
| B-AG10 Global Audit placement? | Shell trong console, detailed read surface riêng/lazy | Density/privacy | Overloaded inventory | Security/UX | Later B/C design |
| B-AG11 Notify center khi view governance? | Audit every G2 read; user notification policy deferred | Traceability | Alert fatigue hoặc silent access | Legal/Privacy | Audit policy |
| B-AG12 Single-operator actions? | Visible disabled với truthful reason | Discoverability without false affordance | Hidden blockers hoặc fake enabled action | Product/UX/Security | UI contract |
| B-AG13 Production re-auth? | Required before governance request/high-risk detail | Step-up auth | Session theft impact | Security/Auth | Action workflow |
| B-AG14 Cache TTL? | No persistent rows; short in-memory TTL, server-provided `stale_after` | Revoke safety | Browser data warehouse | Security/SRE | Client/server contract |
| B-AG15 Platform Auditor role? | Deferred; do not overload machine role now | Preserve canonical role | Premature alias/privilege | Business/Security | Future role design |

Defaults đủ để F23.12B design complete nhưng không thay approval/implementation readiness của F23.12A.

## 23. Phase boundary và roadmap

### 23.1 F23.12C DONE design

- acting request/session schema, approval, scopes, expiry, revoke và exit;
- entry contract từ Global Console sang request;
- low-risk vs sensitive acting tests;
- single-operator write lock.

### 23.2 F23.12D DONE design

- controlled first assignment/bootstrap;
- authority operator workflow;
- no email hardcode/real fixture in repo;
- atomic audit/revoke drill.

### 23.3 Implementation blockers giữ nguyên

```text
F23_12A_IMPLEMENTATION_READINESS: BLOCKED
F23_12B_IMPLEMENTATION_READINESS: BLOCKED
```

- canonical server-side account lifecycle chưa ready;
- chưa có Platform Owner thứ hai;
- authority migration/RLS/RPC chưa duyệt;
- atomic audit/outbox chưa triển khai;
- controlled bootstrap runbook chưa duyệt;
- platform inventory/readiness/acting services chưa tồn tại.

Canonical roadmap:

```text
F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit
    F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill
```

F23.12 implementation không `DONE`.

## 24. Smoke contract và definition of done

Docs smoke chỉ xác nhận design/roadmap markers; không phải runtime security proof và không chứng minh endpoint, RLS, route hoặc UI tồn tại.

- repo foundations/legacy guard/list/switch/provisioning/lifecycle/audit/readiness đã audit: **PASS**;
- old/new console và coexistence path tách rõ: **PASS**;
- IA, shell, inventory fields, privacy tiers và G3 exclusion: **PASS**;
- search/filter/sort/pagination và stale/cache/revoke: **PASS**;
- governance detail/action/acting-entry/readiness/server contract: **PASS**;
- UI state/error/route/responsive/accessibility: **PASS**;
- B-AG1–B-AG15 có default/risk/approval/phase: **PASS**;
- F23.12A/B/C final audit PASS, F23.12A–D DONE design, implementation BLOCKED: **PASS**;
- không runtime/route/SQL/migration/Supabase/Auth/assignment: **PASS**.

F23.12B FINAL TECHNICAL AUDIT PASS - F23.12C DESIGN MAY START
