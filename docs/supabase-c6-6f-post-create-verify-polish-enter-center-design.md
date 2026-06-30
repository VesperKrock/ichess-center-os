# C6.6F - Post-create verify, UI polish, enter center design

C6.6F STATUS: POST CREATE VERIFY POLISH ENTER CENTER DESIGN
C6_6E_STATUS: PASS
C6_6E_MANUAL_QA: PASS
PHONG_TRONG_CREATED_BY_USER: YES
PHONG_TRONG_CENTER_ID: phongtrong_prod
PHONG_TRONG_SLUG: phongtrong
PHONG_TRONG_ENVIRONMENT: production
PHONG_TRONG_STATUS: active
INTERNAL_CONSOLE_POLISH_APPLIED: YES
LONG_OWNER_DESCRIPTION_REMOVED: YES
LONG_ADD_CENTER_DESCRIPTION_REMOVED: YES
RUNTIME_LOGIC_PRESERVED: YES
OWNER_ADD_CENTER_FORM_PRESERVED: YES
CENTERS_LIST_PRESERVED: YES
CENTER_ADMIN_DENIED_PRESERVED: YES
SIGNED_OUT_DENIED_PRESERVED: YES
CENTER_SWITCH_IMPLEMENTED: NO
CENTER_SWITCH_DEFERRED_TO_C6_6G: YES
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
ADMIN_ACCOUNT_CREATION_IMPLEMENTED: NO
TEACHER_ACCOUNT_CREATION_IMPLEMENTED: NO
ACCOUNT_MANAGEMENT_DEFERRED_TO_C7: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
RPC_CALLED_BY_CODEX: NO
AUTH_USER_CREATED: NO
CENTER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
RUNTIME_CHANGE: YES
RUNTIME_CHANGE_SCOPE: INTERNAL_CONSOLE_TEXT_POLISH_ONLY
C6_6G_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6F

C6.6F ghi nhận kết quả sau khi user manual QA C6.6E tạo cơ sở thành công, polish UI Internal Center Console cho gọn hơn, và thiết kế rõ bước tiếp theo để owner vào cơ sở mới.

Phase này không chạy SQL, không gọi RPC, không tạo center mới, không tạo Auth user/admin/teacher account, không implement center switch, không acting mode, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.6E

C6.6E đã thêm form owner-only `Thêm cơ sở` trong `#/internal/centers`.

Form vẫn dùng một field `Tên cơ sở`, preview compact slug/center_id, gọi RPC `provision_center_for_owner(p_center_name)` khi user bấm submit, và refresh list production/active sau success.

## 3. C6.6E manual QA PASS

User xác nhận C6.6E manual QA PASS:

- owner tạo được cơ sở mới;
- list Internal Console refresh và hiển thị cơ sở mới;
- không cần CodeX chạy SQL hoặc gọi RPC.

## 4. Phòng Trống post-create summary

Cơ sở đã được user tạo thành công:

- name = Phòng Trống
- id = `phongtrong_prod`
- slug = `phongtrong`
- environment = `production`
- status = `active`

Internal Console list hiện có:

- DreamHome / `dreamhome_prod` / `dreamhome` / `production` / `active`
- Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`

## 5. UI polish summary

Runtime chỉ polish text trong Internal Center Console:

- bỏ block mô tả dài phía trên list;
- bỏ câu mô tả dài trong form `Thêm cơ sở`;
- giữ form, preview, submit, loading/success/error và list.

Không thêm text giải thích dev vào UI.

## 6. Text removed

Các text dài đã bỏ khỏi runtime UI:

- `Khu vực này dành cho owner. Danh sách bên dưới chỉ đọc từ Cloud.`
- `Mặc định chỉ hiển thị cơ sở production active.`
- `Owner nhập một trường duy nhất, hệ thống tạo cơ sở production trống qua RPC đã apply.`

UI vẫn giữ heading chính:

- `Quản trị nội bộ`
- `Thêm cơ sở`

## 7. Runtime logic preserved

C6.6F không đổi logic C6.6E:

- owner-only form preserved;
- preview slug/center_id preserved;
- RPC call preserved;
- list refresh preserved;
- loading/success/error preserved;
- `center_admin` denied preserved;
- signed-out denied preserved;
- không direct insert `centers` hoặc `center_members`.

## 8. Cách vào Phòng Trống hiện tại

Hiện tại chưa có cách vào Phòng Trống bằng UI nếu chưa có center switch.

Owner đang thấy Phòng Trống trong Internal Center Console như metadata center production/active. Để vận hành OS trong Phòng Trống, app cần phase sau cho owner chọn center có active membership rồi bind runtime/cache/cloud theo center đó.

## 9. Vì sao hiện chưa có center switch

C6.6F không implement center switch vì cần audit đầy đủ:

- resolver chọn center sau login;
- cache/localStorage theo center;
- cloud entity read/write theo center;
- notification/badge theo center;
- rollback khi switch lỗi;
- manual QA chống lẫn staging/production.

Thêm nút vào cơ sở quá sớm có thể làm owner nhìn thấy center mới nhưng app vẫn bind sai center runtime.

## 10. Center switch khác acting mode thế nào

Center switch không phải acting mode:

- center switch = user chọn một center mà chính user có active membership.
- acting mode = super/owner giả lập vai trò người khác/cơ sở khác để hỗ trợ, cần audit/permission riêng và defer C7.4.

C6.6F không implement acting mode.

## 11. Định hướng C6.6G Owner center switch / Mở OS cơ sở

C6.6G nên thiết kế/implement owner center switch an toàn:

- owner xem các centers production/active mà owner có active membership;
- owner chọn `Mở OS cơ sở`;
- app bind `currentCenterId` sang center được chọn;
- reload local cache/cloud theo center mới;
- đảm bảo DreamHome và Phòng Trống không lẫn dữ liệu.

Tên UX dự kiến có thể là `Mở OS cơ sở`, nhưng C6.6F chưa thêm nút runtime.

## 12. Panel tạo Giáo viên là gì

Tạo Giáo viên có 2 nghĩa:

1. Tạo hồ sơ giáo viên trong Module 6 của cơ sở hiện tại.
2. Tạo tài khoản giáo viên/Auth user để login Teacher Portal.

C6.6 chỉ xử lý center provisioning/list. C6.6F không tạo account teacher.

## 13. Panel tạo admin là gì

Tạo admin là account management:

- tạo/sửa Auth user;
- gán membership vào center;
- chọn role như `center_admin`;
- quản lý trạng thái account;
- audit quyền.

C6.6F không tạo admin account và không tạo membership mới.

## 14. Vì sao admin/teacher account defer C7

Tài khoản teacher/admin thuộc C7 Account Management vì cần Auth flow, role policy, membership lifecycle, reset/invite, audit log và UI quản trị account rõ ràng.

C6.6F chỉ ghi nhận định hướng; không mở C7 runtime.

## 15. Risk list

- Center switch nếu làm vội có thể bind sai center/cache.
- Acting mode nếu trộn vào center switch có thể gây thao tác nhầm vai trò.
- Admin/teacher account nếu làm trước C7 có thể thiếu audit và lifecycle.
- Cleanup center/membership vẫn là thao tác nhạy cảm, không làm trong C6.6F.

## 16. PASS / NEEDS REVIEW criteria

PASS nếu:

- post-create Phòng Trống được ghi nhận;
- long descriptive UI text đã bỏ;
- runtime logic C6.6E không vỡ;
- owner form/list vẫn còn;
- `center_admin`/signed-out vẫn bị chặn;
- không implement center switch trong F;
- C6.6G plan rõ;
- admin/teacher account panel deferred C7 rõ;
- không SQL/Supabase action;
- không gọi RPC;
- không tạo user/center/membership bởi CodeX;
- smokes/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu UI polish làm mất form/list, có center switch runtime ngoài scope, có acting mode, hoặc cần SQL/RPC/Auth action.
