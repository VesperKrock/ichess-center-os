# C6.4A - Minimal owner/admin role binding audit/design

C6.4A STATUS: MINIMAL OWNER ADMIN ROLE BINDING AUDIT DESIGN
C6_3_DONE: YES
OWNER_ROLE_DESIGNED: YES
CENTER_ADMIN_ROLE_DESIGNED: YES
VIEWER_ROLE_OPTIONAL: YES
OWNER_CAN_READ_CENTERS_METADATA_DESIGNED: YES
OWNER_CAN_EDIT_CENTER_DATA_BY_DEFAULT: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
WILDCARD_CENTER_ID_RECOMMENDED: NO
GLOBAL_ROLE_SCHEMA_APPLIED: NO
MEMBERSHIP_PER_CENTER_OPTION_REVIEWED: YES
HYBRID_RECOMMENDATION: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.4A

C6.4A chỉ audit/design role binding tối thiểu sau C6.3 DONE. Mục tiêu là chốt mô hình owner/anh Hải và `center_admin`, phân biệt quyền đọc danh sách cơ sở với quyền vào một cơ sở, và chuẩn bị nền cho C6.5 Internal Center Console.

Phase này không sửa runtime, không chạy SQL, không gọi Supabase, không tạo/sửa Auth user, không gán membership thật, không tạo center mới, không mở C6.5 UI và không mở C7.

## 2. Trạng thái sau C6.3

C6.3 đã hoàn thành multi-center foundation tại commit `8519155 C6.3 multi-center foundation checkpoint`.

Trạng thái đã chốt:

- `dreamhome` = staging/test sandbox, giữ Angel Wings.
- `dreamhome_prod` = DreamHome production empty center.
- User đã manual apply centers schema hardening trong Supabase.
- `public.centers` đã có `slug`, `environment`, `status`, `updated_at`.
- `dreamhome` có `environment = staging`.
- `dreamhome_prod` có `environment = production`.
- `centers_environment_check`, `centers_status_check`, `centers_slug_environment_unique_idx`, `centers_environment_idx`, `centers_status_idx` đã được ghi nhận.

## 3. Current centers/membership model

Current model:

`public.centers`:

- `id`
- `name`
- `created_at`
- `slug`
- `environment`
- `status`
- `updated_at`

`public.center_members`:

- `user_id`
- `center_id`
- `role`
- `status`
- `created_at`
- `updated_at`

Admin DreamHome hiện tại:

- email = `admin.dreamhome@ichess.vn`
- `center_id = dreamhome_prod`
- `role = center_admin`
- `status = active`

## 4. Current runtime center resolver

Runtime hiện resolve center bằng active membership:

- đọc `center_members`;
- lọc `user_id`;
- lọc `status = active`;
- chọn membership active đầu tiên theo `center_id` nếu user có nhiều membership;
- dùng `center_id` để bind localStorage/cache/cloud path.

Hàm runtime liên quan: `resolveActiveCenterMembership()`.

## 5. Role hiện có / role cần chuẩn hóa

Source hiện có các role:

- `owner`
- `qtv`
- `center_admin`
- `teacher`
- `consultant`
- `viewer`
- `none`
- `unknown`

`qtv` có thể là tên cũ/nội bộ cho owner/operator. C6.4A không rename role thật. Cần phase riêng nếu muốn chuẩn hóa `qtv` sang `owner` hoặc giữ `qtv` như alias legacy.

## 6. Định nghĩa owner

`owner` là tài khoản cấp anh Hải / chủ hệ thống.

Quyền tối thiểu được thiết kế:

- được đọc danh sách cơ sở;
- được xem metadata cơ sở;
- có thể được cấp quyền vào hỗ trợ từng cơ sở sau này qua membership hoặc acting context rõ ràng;
- không mặc định chỉnh dữ liệu vận hành của cơ sở nếu chưa có acting context/audit rõ.

Owner có thể cần đọc các cột metadata:

- `centers.id`
- `centers.name`
- `centers.slug`
- `centers.environment`
- `centers.status`
- `centers.created_at`
- `centers.updated_at`

## 7. Định nghĩa center_admin

`center_admin` là admin cơ sở.

Quyền tối thiểu:

- chỉ thấy cơ sở được gán;
- vào dashboard của center qua active membership;
- được thao tác dữ liệu trong center đó theo guard hiện có;
- không có quyền xem danh sách toàn bộ cơ sở nếu không có owner/global/internal permission riêng.

Ví dụ hiện tại: `admin.dreamhome@ichess.vn` thuộc `dreamhome_prod` với `role = center_admin`, `status = active`.

## 8. Định nghĩa viewer nếu cần

`viewer` là role xem/read-only.

Thiết kế tối thiểu:

- có thể đọc/xem trong phạm vi center được gán;
- không chỉnh dữ liệu;
- có thể dùng cho kiểm toán/quan sát hoặc user hỗ trợ read-only;
- không bắt buộc triển khai sâu trong C6.4.

## 9. Option A: owner qua membership từng center

Option A biểu diễn owner bằng nhiều rows trong `center_members`:

- `dreamhome_prod / owner`
- future `govap_prod / owner`
- future `quan12_prod / owner`

Ưu điểm:

- dùng schema hiện tại;
- không cần bảng global role mới;
- RLS theo center dễ hiểu;
- quyền vào cơ sở luôn rõ theo `center_id`.

Nhược điểm:

- muốn owner nhìn toàn bộ centers thì phải gán vào từng center;
- khi thêm center mới phải tạo thêm membership cho owner;
- chưa giải quyết tốt quyền chỉ đọc metadata của tất cả centers nếu không muốn owner vào dữ liệu vận hành.

## 10. Option B: global owner role

Option B tạo global role qua bảng kiểu `profiles` hoặc `user_roles`:

- `user_id`
- `global_role = owner`

Ưu điểm:

- owner là quyền hệ thống thật;
- đọc danh sách centers rõ hơn;
- phù hợp C6.5 Internal Center Console và C7 account system.

Nhược điểm:

- cần schema mới;
- cần RLS/helper mới;
- dễ trượt sang C7 nếu làm permission system sâu;
- không nên apply trong C6.4A.

## 11. Option C: hybrid recommendation

Khuyến nghị C6.4A: chọn Option C.

Ngắn hạn trong C6:

- dùng membership per center khi cần quyền vào một center cụ thể;
- chuẩn bị owner metadata-read boundary cho C6.5;
- không wildcard `center_id`;
- không tạo permission system sâu;
- không dùng URL làm security.

Dài hạn trong C7:

- thiết kế global role/permission system đầy đủ;
- chuẩn hóa `owner`/`qtv`;
- thêm acting/support mode có audit rõ.

## 12. Vì sao không dùng wildcard center_id

Không dùng `center_id = '*'` trong `center_members` nếu `center_members.center_id` đang hoặc sẽ FK tới `centers.id`.

Lý do:

- phá nghĩa của membership theo center;
- dễ làm RLS/helper hiểu sai;
- khó audit quyền vào dữ liệu vận hành;
- nếu cần global role thì phải có schema riêng, không nhét wildcard vào membership.

WILDCARD_CENTER_ID_RECOMMENDED: NO.

## 13. Quyền đọc danh sách cơ sở

Đọc danh sách cơ sở nghĩa là xem metadata trong `public.centers`, không phải vào xem dữ liệu vận hành chi tiết.

Owner cần đọc:

- `id`
- `name`
- `slug`
- `environment`
- `status`
- `created_at`
- `updated_at`

`center_admin` mặc định chỉ cần metadata của center mình được gán, không cần danh sách toàn hệ thống.

## 14. Quyền vào cơ sở

Vào cơ sở nghĩa là bind dashboard/runtime vào một `center_id` cụ thể.

Nguyên tắc:

- cần active membership hoặc acting context cụ thể;
- `center_admin` vào center được gán;
- owner không mặc định edit center data nếu chưa có acting context;
- quyền vào dữ liệu vận hành phải rõ `center_id`, `role`, `status` và audit path.

## 15. Acting mode deferred

Acting mode / hỗ trợ cơ sở defer C7.4.

C6.4 chỉ chuẩn bị role binding tối thiểu. Không tạo acting mode, không tạo permission override, không cho owner sửa dữ liệu center tùy ý.

## 16. C6.5 dependency

C6.5 Internal Center Console cần C6.4 để biết:

- tài khoản nào được vào route internal;
- owner/admin boundary là gì;
- đọc metadata centers khác với vào một center ra sao;
- khi nào cần membership per center;
- khi nào phải defer sang acting mode C7.4.

C6.5 mới làm UI route ẩn. C6.4A không tạo route `/internal/centers` và không tạo nút `Thêm cơ sở`.

## 17. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin/customer-facing concept.

## 18. Risk list

Risks:

- `qtv` và `owner` đang cùng nhóm write-role trong runtime cũ; cần quyết định giữ alias hay chuẩn hóa.
- Owner đọc metadata toàn bộ centers cần RLS/helper rõ, không nên dựa vào URL.
- Owner vào hỗ trợ center mà không có acting audit sẽ rủi ro sửa nhầm dữ liệu.
- Multi-membership hiện runtime chọn membership đầu tiên theo `center_id`; center switcher vẫn chưa làm.
- Nếu C6.5 làm UI trước khi role boundary rõ, Internal Center Console dễ bị lẫn với C7 account management.

## 19. C6.4B recommendation

C6.4B nên là owner membership readiness/provisioning pack:

- tạo read-only SQL inspection cho roles/memberships nếu cần;
- liệt kê distinct roles thật trong `center_members`;
- xác nhận có helper/RLS nào đọc centers metadata cho owner không;
- chuẩn bị manual apply template nếu phải tạo owner membership hoặc global role sau review;
- chưa tạo tài khoản anh Hải thật nếu chưa có phase apply riêng.

Không tạo Auth user, không gán membership thật và không apply SQL trong C6.4A.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test đầy đủ;
- owner và `center_admin` được định nghĩa rõ;
- `viewer` optional được ghi nhận;
- phân biệt đọc centers metadata và vào center rõ;
- không dùng wildcard `center_id`;
- acting mode deferred C7.4;
- C6.5 dependency rõ;
- không SQL/Supabase action;
- không tạo Auth user;
- không tạo membership;
- không runtime change;
- không mở C6.5/C7;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu cần SQL apply thật, cần tạo Auth user/membership thật, phát hiện runtime blocker, hoặc phát hiện file ngoài scope.
