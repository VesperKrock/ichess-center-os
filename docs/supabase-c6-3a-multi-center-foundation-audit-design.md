# C6.3A - Multi-center foundation audit/design

C6.3A STATUS: MULTI CENTER FOUNDATION AUDIT DESIGN
C6_2_DONE: YES
PRODUCTION_CENTER_ID_EXAMPLE: dreamhome_prod
STAGING_CENTER_ID_EXAMPLE: dreamhome
FUTURE_CENTER_ID_EXAMPLE_GOVAP: govap_prod
FUTURE_CENTER_ID_EXAMPLE_QUAN12: quan12_prod
ADD_CENTER_NOT_CLONE: YES
ONE_SHARED_LINK_ACCOUNT_BASED_ROUTING: YES
URL_BASED_SECURITY: NO
CURRENT_SCHEMA_REVIEWED: YES
CENTERS_SCHEMA_RUNTIME_CHANGE: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.3A

C6.3A chỉ audit/design nền tảng multi-center sau C6.2 DONE. Phase này chốt convention `center_id`, display name, slug và environment; review schema hiện tại; thiết kế cách thêm Gò Vấp / Quận 12 production empty sau này. Không tạo center mới, không chạy SQL, không Supabase action, không runtime, không commit/push.

## 2. Trạng thái sau C6.2

C6.2 đã hoàn tất production/staging separation hardening tại commit `81a9f9e C6.2 production staging hardening checkpoint`.

Kết luận đang giữ:

- `dreamhome` = staging/test sandbox, giữ Angel Wings.
- `dreamhome_prod` = DreamHome production empty center.
- Admin DreamHome vào center theo `center_members`.
- localStorage tách namespace `.dreamhome` và `.dreamhome_prod`.
- Badge đỏ số `3` đã được trace/fix ở C6.2B.1: notification sync trước inventoryRequests reload.

## 3. Roadmap C6 cập nhật

- C6.0 - Production readiness audit - DONE.
- C6.1 - DreamHome production empty center - DONE.
- C6.2 - Production/staging separation hardening + online QA - DONE.
- C6.3 - Multi-center foundation - CURRENT.
- C6.4 - Minimal owner/admin role binding - DEFERRED.
- C6.5 - Internal Center Console - DEFERRED.
- C7 - Account/permission/portal system - DEFERRED.

## 4. Current schema review

Schema hiện biết theo prompt và docs:

`public.centers`:

- `id text primary key`
- `name text`
- `created_at timestamptz default now()`

`public.center_members`:

- `user_id`
- `center_id`
- `role`
- `status`
- `created_at`
- `updated_at`

Runtime hiện tại chưa đọc bảng `public.centers` trực tiếp để route user; app resolve center bằng `center_members`, sau đó map display name tạm trong `src/supabase-auth.js`.

## 5. Centers table review

Nếu live schema `public.centers` chỉ có `id/name/created_at`, bảng này đủ cho identity tối thiểu nhưng chưa đủ giàu cho Internal Center Console sau này.

Thiếu có thể cần cân nhắc ở C6.3B/C6.5:

- `slug`
- `environment`
- `status`
- owner/operator metadata nếu C6.5 cần quản lý cơ sở.

Trong C6.3A không thay schema. Tạm thời encode environment bằng suffix `_prod` trong `center_id`.

## 6. Center members review

`center_members` đang là source quan trọng cho account-based routing:

- user có active membership thì vào center tương ứng;
- role và status đi cùng membership;
- user không có active membership thì không vào dashboard;
- user nhiều active memberships hiện runtime chọn membership đầu tiên theo `center_id`, có message cảnh báo.

C6.3A không đổi role policy và không thêm permission override.

## 7. Naming convention center_id

Production center IDs:

- `dreamhome_prod`
- `govap_prod`
- `quan12_prod`

Staging/test center:

- `dreamhome` = staging/test sandbox hiện tại, giữ Angel Wings.

Không rename `dreamhome` thành `dreamhome_test` trong C6.3A. Nếu cần rename/normalize staging sau này, phải có phase riêng kèm backup/verify/rollback.

## 8. Display name / slug / environment

Display name:

- DreamHome
- Gò Vấp
- Quận 12

Slug tương lai:

- `dreamhome`
- `govap`
- `quan12`

Environment:

- production: encode tạm bằng suffix `_prod`.
- staging/test: `dreamhome` hiện tại.

Nếu schema chưa có `slug`, `environment`, `status` riêng, C6.3B hoặc C6.5 nên quyết định có cần thêm cột hay tiếp tục dùng convention trong `center_id`.

## 9. Production vs staging model

Production center là cơ sở vận hành sạch, bắt đầu empty và không copy dữ liệu vận hành từ staging.

Staging/test center là nơi giữ dataset kiểm thử như Angel Wings. Không được để production path đọc/render `.dreamhome` cache hoặc cloud data staging.

## 10. DreamHome hiện tại

`dreamhome_prod` là DreamHome production empty center. `dreamhome` không được dùng lại làm production vì đã giữ staging/test sandbox và Angel Wings.

Một link chung vẫn dùng được vì route thật dựa trên tài khoản/membership.

## 11. Gò Vấp / Quận 12 tương lai

Ví dụ production empty sau này:

- Gò Vấp: `center_id = govap_prod`, display name `Gò Vấp`, slug `govap`.
- Quận 12: `center_id = quan12_prod`, display name `Quận 12`, slug `quan12`.

Không tạo `govap_prod`. không tạo `quan12_prod`. C6.3A không tạo Auth user anh Phương/chị Tiền và không gán membership thật.

## 12. Add center vs clone center

Thêm cơ sở production empty:

- tạo center identity;
- gán admin/membership;
- không copy dữ liệu vận hành;
- production bắt đầu rỗng.

Clone center:

- copy dữ liệu từ center nguồn sang center mới;
- rủi ro lẫn dữ liệu vận hành;
- chỉ phù hợp test/sandbox nếu có phase riêng.

C6.3 ưu tiên add center, not clone.

## 13. Account-based routing

Vận hành dùng một link chung:

`https://vesperkrock.github.io/ichess-center-os/`

URL không quyết định security. Auth user + `center_members` quyết định center. URL based security: NO.

## 14. Multi-membership behavior

Hiện tại:

- 1 active membership: vào thẳng center đó.
- 0 active membership: chặn dashboard.
- nhiều active memberships: runtime chọn membership đầu tiên theo `center_id` và báo message.

C6.3B nên quyết định tối thiểu: tiếp tục chọn đầu tiên có kiểm soát hay thiết kế center switcher. C6.3A không làm UI switcher.

## 15. LocalStorage namespace rule

Key localStorage vẫn phải theo pattern:

`ichessCenterOS.<scope>.<centerId>`

Ví dụ:

- `ichessCenterOS.students.dreamhome_prod`
- `ichessCenterOS.students.govap_prod`
- `ichessCenterOS.students.quan12_prod`
- `ichessCenterOS.students.dreamhome`

Không migrate/xóa localStorage trong C6.3A.

## 16. Manual provisioning hiện tại

Trước khi có Internal Center Console, thêm cơ sở mới chỉ nên làm qua phase manual provisioning riêng:

1. Read-only preflight schema/membership.
2. Manual apply SQL template được review.
3. User tự chạy SQL nếu phase cho phép.
4. Verify center empty và membership.
5. Manual QA login bằng admin center đó.

C6.3A không tạo SQL apply và không tạo center.

## 17. C6.3B recommendation

C6.3B nên là readiness/provisioning pack, không apply trực tiếp, để quyết định:

- Có cần harden `public.centers` thêm `slug/environment/status` không.
- Có cần read-only SQL inspection cho `centers`, `center_members`, `center_cloud_entities` không.
- Template thêm center empty cho `govap_prod` / `quan12_prod` sẽ dùng placeholder user_id như thế nào.
- Có cần xử lý multi-membership trước C6.5 không.

## 18. C6.4 deferred

C6.4 minimal owner/admin role binding vẫn deferred. C6.3A không đổi role matrix, không permission override.

## 19. C6.5 Internal Center Console deferred

C6.5 sẽ là route internal trong cùng app, không phải web riêng. Scope tương lai:

- xem danh sách cơ sở;
- xem chi tiết cơ sở;
- thêm cơ sở trống;
- gán admin.

C6.3A không tạo route `/internal/centers` và không tạo nút `Thêm cơ sở`.

## 20. C7 deferred

C7 mới xử lý:

- username login;
- account management;
- permission override;
- acting mode;
- Teacher Portal;
- Super Admin/internal operator advanced.

C6.3A không mở C7.

## 21. PASS / NEEDS REVIEW criteria

PASS nếu docs/test đầy đủ, worktree ban đầu sạch, current schema được review, convention rõ, Gò Vấp/Quận 12 chỉ là future examples, all C6 smokes/build/check pass, không runtime change, không SQL apply, không Supabase action, không tạo center mới, không mở C6.4/C6.5/C7, không commit/push.

NEEDS REVIEW nếu phát hiện cần runtime/schema apply ngay, file ngoài scope, hoặc worktree không còn sạch trước khi bắt đầu phase.
