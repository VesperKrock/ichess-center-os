# C7.8D - Wire create admin button handoff UI

C7.8D STATUS: WIRE CREATE ADMIN BUTTON HANDOFF UI
C7_8C_1_STATUS: PASS
CREATE_ADMIN_BUTTON_ENABLED_FOR_NO_ADMIN_CENTER: YES
CREATE_ADMIN_BUTTON_DISABLED_FOR_HAS_ADMIN_CENTER: YES
PROVISION_CENTER_ADMIN_FUNCTION_CALLED_FROM_UI: YES
CREATE_ADMIN_CONFIRM_REQUIRED: YES
CREATE_ADMIN_HANDOFF_CARD_CREATED: YES
COPY_EMAIL_ACTION: YES
COPY_PASSWORD_ACTION: YES
COPY_ALL_HANDOFF_ACTION: YES
TEMPORARY_PASSWORD_DISPLAY_ONCE_UI: YES
TEMPORARY_PASSWORD_LOCAL_STORAGE_ALLOWED: NO
TEMPORARY_PASSWORD_SESSION_STORAGE_ALLOWED: NO
PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO
RESET_PASSWORD_FLOW_PRESERVED: YES
REVOKE_ACCESS_BUTTON_ENABLED: NO
REVOKE_FUNCTION_CALLED_FROM_UI: NO
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
SCROLL_JUMP_FIX_PRESERVED: YES
RUNTIME_UI_CHANGE: YES
C7_8E_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.8C.1 PASS

C7.8C đã wire reset password và handoff UI. C7.8C.1 đã sửa scroll jump trong Internal Center Console. Manual QA gần nhất xác nhận DreamHome/Phòng Trống đã có admin, reset hoạt động và scroll ổn.

## 2. Mục tiêu C7.8D

C7.8D wire nút `Tạo admin` cho production active center chưa có admin. Với center đã có admin, nút vẫn disabled.

## 3. Create admin button enable logic

Nút `Tạo admin` chỉ enabled khi:

- Center là production active.
- Account status đã loaded.
- `admin.exists === false`.
- Không đang tạo admin.

DreamHome và Phòng Trống hiện đã có admin nên nút vẫn disabled với nhãn `Đã có admin`.

## 4. Confirm UX

Khi owner bấm `Tạo admin`, UI mở confirm panel inline, hiển thị center name, center id và email dự kiến `admin.<slug>@ichess.vn`. Owner phải confirm trước khi gọi function.

## 5. API call

Frontend gọi `provision-center-admin-account` bằng session hiện tại:

```json
{
  "center_id": "some_center_prod",
  "idempotency_key": "c7-8d-create-admin-some_center_prod-...",
  "display_name": "Admin Some Center"
}
```

Frontend không gửi email, password, role, actor id/email, service role, authorization hoặc jwt trong body.

## 6. Handoff card

Sau success `center_admin_created`, UI hiển thị handoff card một lần với email và mật khẩu tạm. Card dùng chung copy actions với reset password.

## 7. Copy actions

Handoff card hỗ trợ:

- Copy email.
- Copy mật khẩu.
- Copy toàn bộ.
- `Tôi đã lưu`.

## 8. Error states

Các lỗi phổ biến như `center_admin_already_exists`, `admin_email_already_used`, `forbidden_owner_required`, `center_not_production_active` được map thành message dễ hiểu. Nếu duplicate admin xảy ra, UI yêu cầu tải lại trạng thái tài khoản.

## 9. Password non-persistence

`temporary_password` chỉ sống trong memory khi handoff card mở. Không ghi vào `localStorage`, `sessionStorage`, database, console log hoặc URL.

## 10. Reset flow preserved

Nút `Tạo mật khẩu tạm mới` vẫn enabled cho center đã có admin email, confirm reset và handoff reset không đổi.

## 11. Revoke still disabled

`Thu hồi quyền` vẫn disabled. Frontend không gọi `revoke-center-admin-access`.

## 12. Manual QA recommendation

Manual QA hiện tại:

- DreamHome: `Tạo admin` disabled vì đã có admin.
- Phòng Trống: `Tạo admin` disabled vì đã có admin.
- Reset password vẫn hoạt động.
- Revoke vẫn disabled.

Live-test create admin cần center production active an toàn chưa có admin trong phase riêng.

## 13. What C7.8D does not do

C7.8D không deploy function, không set secrets, không SQL apply, không tạo center mới, không revoke access, không bật revoke, không commit/push.

## 14. C7.8E recommendation

Sau manual QA C7.8D PASS, có thể checkpoint C7.8A-D hoặc chuẩn bị C7.8E cho revoke nếu được duyệt.
