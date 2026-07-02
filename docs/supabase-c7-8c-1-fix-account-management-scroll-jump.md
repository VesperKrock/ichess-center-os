# C7.8C.1 - Fix account management scroll jump

C7.8C.1 STATUS: FIX ACCOUNT MANAGEMENT SCROLL JUMP
C7_8C_STATUS: PASS
C7_8C_RESET_UI_MANUAL_QA_PASS: YES
SCROLL_JUMP_BUG_CONFIRMED: YES
ACCOUNT_ACTION_BUTTONS_TYPE_BUTTON: YES
ACCOUNT_ACTION_PREVENT_DEFAULT: YES
SCROLL_POSITION_PRESERVED: YES
CREATE_ADMIN_BUTTON_ENABLED: NO
REVOKE_ACCESS_BUTTON_ENABLED: NO
RESET_PASSWORD_LOGIC_CHANGED: NO
EDGE_FUNCTION_CHANGED: NO
SUPABASE_MUTATION_ADDED: NO
RUNTIME_UI_CHANGE: YES
C7_8D_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.8C PASS

C7.8C manual QA đã PASS logic reset password: admin email hiển thị đúng, reset password qua UI hoạt động, audit row được ghi và audit không chứa password.

## 2. Bug scroll jump

Khi thao tác trong section `Quản lý tài khoản cơ sở`, mỗi click account action làm Internal Center Console bị nhảy lên đầu trang. Điều này xảy ra khi user đang ở giữa/cuối console và UI re-render sau action.

## 3. Root cause found

Internal Console scroll container là `.desktop-area.is-internal-console-route`. Container này bị replace khi `render()` chạy nhưng chưa nằm trong danh sách preserved scroll targets, nên scrollTop mất sau re-render. Các account action cũng chưa gọi `preventDefault()` / `stopPropagation()`.

## 4. Patch summary

Patch nhỏ:

- Thêm `.desktop-area.is-internal-console-route` vào preserved scroll targets.
- Thêm `event.preventDefault()` và `event.stopPropagation()` cho account action clicks.
- Giữ nguyên reset function contract và handoff logic.

## 5. Manual QA checklist

1. Cuộn xuống `Quản lý tài khoản cơ sở`.
2. Bấm `Tạo mật khẩu tạm mới`.
3. Confirm panel hiện mà trang không nhảy lên top.
4. Bấm `Hủy`, confirm lại, copy email/password/all, và `Tôi đã lưu`.
5. Scroll vẫn giữ gần vị trí thao tác.

## 6. Safety preserved

Create admin vẫn disabled. Revoke vẫn disabled. Reset password logic không đổi. Không thêm Supabase call mới, không sửa Edge Function, không deploy, không SQL apply.

## 7. What C7.8C.1 does not do

C7.8C.1 không bật create/revoke, không đổi business logic reset, không lưu password, không thay đổi endpoint, không commit/push.

## 8. C7.8D recommendation

Sau manual QA scroll PASS, có thể checkpoint C7.8A-C.1 hoặc sang C7.8D để wire create admin button an toàn.
