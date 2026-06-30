# C6.6G - Owner center switch / Mở OS cơ sở

C6.6G STATUS: OWNER CENTER SWITCH MO OS CO SO
C6_6F_STATUS: PASS
PHONG_TRONG_CREATED_BY_USER: YES
OWNER_CENTER_SWITCH_IMPLEMENTED: YES
CENTER_SWITCH_ACTION_LABEL: Mở OS cơ sở
OWNER_ONLY_CENTER_SWITCH: YES
CENTER_SWITCH_REQUIRES_ACTIVE_MEMBERSHIP: YES
CENTER_SWITCH_IS_ACTING_MODE: NO
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
PHONG_TRONG_OPEN_OS_DESIGNED_OR_IMPLEMENTED: YES
PHONG_TRONG_CENTER_ID: phongtrong_prod
PHONG_TRONG_EMPTY_DATA_EXPECTED: YES
DREAMHOME_OPEN_OS_PRESERVED: YES
STAGING_DREAMHOME_HIDDEN_BY_DEFAULT: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
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
RUNTIME_CHANGE_SCOPE: OWNER_CENTER_SWITCH_ONLY
C6_6H_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6G

C6.6G thêm đường vào tối thiểu để owner mở OS của một cơ sở production/active trong Internal Center Console. Mục tiêu trước mắt là owner có thể mở Phòng Trống sau khi C6.6E manual QA đã tạo `phongtrong_prod`.

## 2. Trạng thái sau C6.6F

C6.6F PASS. Internal Center Console đã có form Thêm cơ sở và danh sách centers readonly. User đã tạo thành công Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`.

## 3. Runtime changes summary

Runtime change chỉ nằm trong owner center switch. Danh sách centers có thêm action `Mở OS cơ sở`; khi owner bấm, app cập nhật active center binding, đổi namespace localStorage, reload dữ liệu local theo center mới, reset bootstrap/realtime cũ và kéo cloud data của center mới.

## 4. Center switch definition

Center switch là việc user đang đăng nhập chọn một center mà chính user có active membership. Center switch không bypass permission, không tự tạo membership, không tạo center, không đổi user.

## 5. Center switch khác acting mode

Center switch không phải acting mode. Acting mode là giả lập người khác, vai trò khác hoặc ngữ cảnh quyền khác; phần đó chưa implement và defer C7.4.

## 6. Owner-only access

Internal Center Console vẫn owner-only. Signed-out và center_admin không vào được route `#/internal/centers`, nên không thấy action mở cơ sở.

## 7. `Mở OS cơ sở` action

Mỗi row production/active có nút `Mở OS cơ sở` nếu owner có active membership với center đó. Center hiện tại hiển thị `Đang mở` và không cần mở lại.

## 8. Active center binding behavior

Khi mở một center, `cloudStatus.centerId`, `cloudStatus.centerName`, `cloudStatus.membership`, `cloudStatus.role` và membership loaded state được bind sang center được chọn. App quay về dashboard OS cơ sở và bootstrap lại cloud data theo center mới.

## 9. Cloud/localStorage namespace behavior

`setCurrentStorageCenterId(center_id)` được gọi trước khi reload local data. Production center mới dùng empty fallback, không dùng sample data. Các realtime subscription và auto-pull guard cũ được reset để không giữ binding của center trước.

## 10. Phòng Trống expected empty behavior

Phòng Trống expected empty: `phongtrong_prod` không được lẫn Angel Wings, staging `dreamhome`, DreamHome production hoặc badge cũ. Nếu manual QA thấy seed/demo data trong production empty center thì status phải là NEEDS REVIEW/hotfix.

## 11. DreamHome still available

DreamHome / `dreamhome_prod` vẫn xuất hiện trong production/active list nếu owner có membership. Owner có thể quay lại Internal Console và bấm `Mở OS cơ sở` ở DreamHome để bind lại `dreamhome_prod`.

## 12. Staging hidden by default

Danh sách Internal Console vẫn filter `environment = production` và `status = active`, nên staging `dreamhome` bị ẩn mặc định.

## 13. Manual QA owner mở Phòng Trống

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Bấm `Mở OS cơ sở` ở Phòng Trống.
4. Expected dashboard hiện cơ sở Phòng Trống / `phongtrong_prod`.
5. Expected không thấy 29 học viên Angel Wings.
6. Expected không thấy dữ liệu staging `dreamhome`.
7. Expected badge/thông báo không lẫn DreamHome hoặc Angel Wings.

## 14. Manual QA owner quay lại DreamHome

1. Từ dashboard, mở lại `#/internal/centers`.
2. Bấm `Mở OS cơ sở` ở DreamHome.
3. Expected dashboard hiện DreamHome / `dreamhome_prod`.
4. Expected dữ liệu Cloud DreamHome vẫn hoạt động như trước.

## 15. Regression center_admin/signed-out

`admin.dreamhome@ichess.vn` mở `#/internal/centers` phải bị chặn. Signed-out mở `#/internal/centers` cũng phải bị chặn và không thấy centers list/action.

## 16. Account/admin/teacher deferred C7

C6.6G không tạo admin account, teacher account, username login, account management UI, Teacher Portal hoặc Super Admin advanced. Các phần tài khoản defer C7.

## 17. Risk list

- Owner thiếu active membership của center mới: action bị disabled hoặc báo lỗi.
- Production empty center xuất hiện seed/demo data: NEEDS REVIEW.
- Realtime/bootstrap cũ không reset sạch: cần hotfix nếu manual QA thấy dữ liệu/badge lẫn center.
- Nếu Phòng Trống chưa có dữ liệu cloud, dashboard phải empty/cache scoped theo `phongtrong_prod`.

## 18. PASS / NEEDS REVIEW criteria

PASS khi owner mở được Phòng Trống, dashboard bind `phongtrong_prod`, không lẫn staging/Angel Wings/badge cũ, DreamHome vẫn mở lại được, center_admin/signed-out vẫn bị chặn, smokes/build/diff pass, không SQL/Supabase action/RPC/Auth/center/membership creation bởi CodeX, không commit/push.

NEEDS REVIEW nếu không chứng minh được guard owner + active membership, production empty bị seed, center switch cần bypass membership, hoặc có file/runtime ngoài scope.
