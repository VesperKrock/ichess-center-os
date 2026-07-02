# C7.8C - Wire reset password button handoff UI

C7.8C STATUS: WIRE RESET PASSWORD BUTTON HANDOFF UI
C7_8B_STATUS: PASS
RESET_PASSWORD_BUTTON_ENABLED: YES
RESET_PASSWORD_FUNCTION_CALLED_FROM_UI: YES
RESET_CONFIRM_REQUIRED: YES
HANDOFF_CARD_CREATED: YES
COPY_EMAIL_ACTION: YES
COPY_PASSWORD_ACTION: YES
COPY_ALL_HANDOFF_ACTION: YES
TEMPORARY_PASSWORD_DISPLAY_ONCE_UI: YES
TEMPORARY_PASSWORD_LOCAL_STORAGE_ALLOWED: NO
TEMPORARY_PASSWORD_SESSION_STORAGE_ALLOWED: NO
PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO
CREATE_ADMIN_BUTTON_ENABLED: NO
REVOKE_ACCESS_BUTTON_ENABLED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
ACCOUNT_PANEL_WIDER_POLISH: YES
EMAIL_WRAP_POLISH: YES
RUNTIME_UI_CHANGE: YES
C7_8D_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.8B PASS

C7.8B đã thêm endpoint read-only `list-center-admin-accounts` và wire Internal Center Console để hiển thị admin thật cho DreamHome và Phòng Trống. Manual QA xác nhận admin email đã hiện, trạng thái `Đã có admin`, và `Copy email` đã bật.

## 2. Mục tiêu C7.8C

C7.8C bật riêng action `Tạo mật khẩu tạm mới` cho center đã có admin email. Các action tạo admin và thu hồi quyền vẫn disabled.

## 3. Reset button behavior

Nút `Tạo mật khẩu tạm mới` chỉ enabled khi account card có `admin.exists=true` và admin email non-empty. Khi đang gọi function, nút chuyển sang `Đang tạo mật khẩu tạm...` và bị disabled để tránh double click.

## 4. Confirm UX

Trước khi reset, UI mở confirm panel inline với email admin, nhắc rằng mật khẩu cũ sẽ không dùng được và mật khẩu mới chỉ hiển thị một lần. Owner phải bấm confirm mới gọi function.

## 5. Handoff card

Sau success từ `reset-center-admin-password`, UI hiển thị handoff card gồm cơ sở, email và mật khẩu tạm. Handoff card có nút `Tôi đã lưu` để đóng và clear password khỏi UI state.

## 6. Clipboard actions

Handoff card có:

- Copy email.
- Copy mật khẩu.
- Copy toàn bộ.

Nếu Clipboard API lỗi, UI hiển thị `Không copy được, hãy chọn và copy thủ công`.

## 7. Password non-persistence

`temporary_password` chỉ được giữ trong memory state khi handoff card đang mở. C7.8C không ghi password vào `localStorage`, `sessionStorage`, database, console log, audit log hoặc URL.

## 8. Error states

Các lỗi từ Edge Function được map thành message dễ hiểu. Với `duplicate_request_already_processed`, UI báo mật khẩu tạm không thể hiển thị lại và yêu cầu tạo request reset mới nếu cần.

## 9. Layout polish rộng hơn

Internal Center Console rộng hơn, account cards có spacing lớn hơn, grid account fields rộng hơn. Email admin dùng nowrap với overflow horizontal fallback để tránh trường hợp `.vn` bị tách xuống một dòng riêng trên viewport đủ rộng.

## 10. What C7.8C does not do

C7.8C không:

- Deploy Edge Function bởi CodeX.
- Set secrets.
- Apply SQL.
- Tạo admin mới.
- Thu hồi hoặc disable access.
- Bật nút `Tạo admin`.
- Bật nút `Thu hồi quyền`.
- Lưu plaintext password lâu dài.
- Commit hoặc push.

## 11. C7.8D recommendation

Sau manual QA reset password từ UI PASS, có thể checkpoint C7.8A-C hoặc sang C7.8D để wire create admin button an toàn với handoff tương tự.
