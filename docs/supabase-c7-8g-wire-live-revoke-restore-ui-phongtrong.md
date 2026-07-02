# C7.8G - Wire live revoke/restore UI Phong Trong

C7.8G STATUS: WIRE LIVE REVOKE RESTORE UI PHONGTRONG
C7_8F_MANUAL_LIVE_REVOKE_PASS: YES
C7_8F_MANUAL_LIVE_RESTORE_PASS: YES
TARGET_CENTER_ID: phongtrong_prod
TARGET_ADMIN_EMAIL: admin.phongtrong@ichess.vn
DREAMHOME_PROTECTED: YES
UI_LIVE_REVOKE_ENABLED_FOR_PHONGTRONG: YES
UI_LIVE_RESTORE_ENABLED_FOR_PHONGTRONG: YES
UI_LIVE_REVOKE_ENABLED_FOR_DREAMHOME: NO
UI_LIVE_RESTORE_ENABLED_FOR_DREAMHOME: NO
REVOKE_TYPED_CONFIRMATION_REQUIRED: YES
RESTORE_CONFIRMATION_REQUIRED: YES
DISABLE_AUTH_USER_ALLOWED: NO
HARD_DELETE_ALLOWED: NO
PASSWORD_OR_SECRET_INCLUDED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
CODEX_APPLIED_SQL: NO
CODEX_DEPLOYED_FUNCTIONS: NO
CODEX_INVOKED_REVOKE: NO
CODEX_INVOKED_RESTORE: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh

C7.8F manual live revoke/restore Phòng Trống đã PASS. UI trước C7.8G vẫn có modal safety gate nhưng chưa gọi live action từ app.

## 2. Manual live C7.8F result summary

- Revoke Phòng Trống returned `center_admin_access_revoked`.
- Restore Phòng Trống returned `center_admin_access_restored`.
- Auth user không bị disable.
- DreamHome admin vẫn active.
- Audit revoke/restore đã ghi đúng.

## 3. Why UI live is limited to Phòng Trống

C7.8G chỉ mở live allowlist cho `phongtrong_prod` vì đây là target đã live-test có kiểm soát. DreamHome vẫn protected để tránh thao tác nhạy cảm trên cơ sở không thuộc scope test.

## 4. Revoke UI flow

Owner bấm `Thu hồi quyền`, nhập `REVOKE`, bấm `Tôi hiểu rủi ro`, rồi final button gọi `revoke-center-admin-access` với `disable_auth_user: false`. Sau success, UI giữ local revoked snapshot để hiện `Đã thu hồi quyền` và nút `Khôi phục quyền` ngay trong phiên hiện tại.

## 5. Restore UI flow

Sau revoke success, card hiện `Khôi phục quyền`. Owner nhập `RESTORE`, final button gọi `restore-center-admin-access`. Sau success, local revoked snapshot được clear, account card quay lại active và refresh status endpoint.

## 6. DreamHome protection

DreamHome không nằm trong `ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS`. Modal có thể hiển thị trạng thái protected, nhưng final live revoke/restore bị khóa và handler vẫn chặn nếu target không thuộc allowlist.

## 7. Manual QA checklist

1. Mở Internal Center Console bằng owner.
2. DreamHome: mở modal revoke và xác nhận final action không live-enabled.
3. Phòng Trống: mở modal, nhập `REVOKE`, bấm `Tôi hiểu rủi ro`, revoke.
4. Expected: UI báo đã thu hồi và hiện `Khôi phục quyền`.
5. Chạy verify SQL post-revoke nếu cần.
6. Bấm `Khôi phục quyền`, nhập `RESTORE`, restore.
7. Expected: UI quay active, reset/copy hoạt động.
8. Chạy verify SQL post-restore nếu cần.

## 8. What C7.8G does not do

C7.8G không chạy SQL, không deploy function, không invoke live bởi CodeX, không bật DreamHome, không hard delete, không disable Auth user, không commit/push.

## 9. Recommendation after C7.8G

Sau manual UI revoke/restore PASS, có thể checkpoint C7.8 owner account management hoặc sang C7.8H để generalize allowlist/policy cho nhiều center.
