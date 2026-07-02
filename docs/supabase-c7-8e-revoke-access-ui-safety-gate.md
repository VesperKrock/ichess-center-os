# C7.8E - Revoke access UI safety gate

C7.8E STATUS: REVOKE ACCESS UI SAFETY GATE
C7_8D_STATUS: PASS
INPUT_FOCUS_HOTFIX_STATUS: PASS
REVOKE_UI_PANEL_ADDED: YES
REVOKE_TYPED_CONFIRMATION_ADDED: YES
REVOKE_SAFETY_GATE_DEFAULT_OFF: YES
REVOKE_LIVE_ACTION_ENABLED: NO
REVOKE_FUNCTION_CALLED_FROM_UI: NO
REVOKE_FUNCTION_CALL_PREPARED_FOR_C7_8F: YES
CENTER_MEMBERS_UPDATE_GRANT_APPLIED: NO
ACCESS_REVOKED: NO
AUTH_USER_DISABLED: NO
RESET_PASSWORD_FLOW_PRESERVED: YES
CREATE_ADMIN_FLOW_PRESERVED: YES
ACCOUNT_STATUS_UI_PRESERVED: YES
SCROLL_JUMP_FIX_PRESERVED: YES
INPUT_FOCUS_FIX_PRESERVED: YES
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO
RUNTIME_UI_CHANGE: YES
C7_8F_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.8D + hotfix input focus pass

C7.8D đã wire nút tạo admin có guard và handoff một lần. Hotfix C7.8 sau đó đã bảo vệ input focus toàn app bằng cách defer full render khi người dùng đang nhập trong input/textarea/select/contenteditable.

## 2. Vì sao revoke cần safety gate

Thu hồi quyền là thao tác nhạy cảm vì sẽ đổi trạng thái membership admin cơ sở. Function `revoke-center-admin-access` đã có trong source, nhưng chưa deploy/live-test trong scope này, chưa apply grant update cần thiết, và chưa có safe target để kiểm thử. Vì vậy C7.8E chỉ chuẩn bị UI và khóa thao tác thật bằng flag runtime mặc định OFF.

## 3. UI revoke panel

Trong Internal Center Console, card center có admin hiển thị nút `Thu hồi quyền`. Center chưa có admin hiển thị `Không có admin` và disabled.

Khi bấm `Thu hồi quyền`, UI mở panel inline hiển thị cơ sở, mã cơ sở, email admin và cảnh báo hậu quả:

- Admin sẽ không còn quyền truy cập cơ sở sau khi thu hồi.
- Dữ liệu học viên, lịch học và cơ sở không bị xóa.
- Auth user có thể vẫn tồn tại, membership cơ sở dự kiến đổi sang `revoked`.
- Chỉ owner mới được thực hiện.
- Cần kiểm thử có kiểm soát trước khi bật thao tác thật.

## 4. Typed confirmation

Panel có input `Nhập REVOKE để xác nhận`. Final action chỉ có thể enabled khi typed value đúng `REVOKE`, owner đã bấm `Tôi hiểu rủi ro`, và safety gate live action được bật. Trong C7.8E gate OFF nên final action vẫn disabled dù nhập đúng.

## 5. Safety gate OFF

Runtime thêm `ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = false`.

Khi flag OFF:

- Panel có thể mở.
- Typed confirmation có thể nhập mà không mất caret.
- Final action hiển thị trạng thái chưa bật thao tác thật.
- Handler revoke có guard cứng và return trước khi Supabase invoke.
- Không gọi live revoke, không disable user, không đổi membership.

## 6. Future live call contract

Wrapper cho C7.8F đã chuẩn bị request body tương lai:

```json
{
  "center_id": "<center_id>",
  "target_email": "<admin_email>",
  "idempotency_key": "c7-8f-revoke-<center_id>-<timestamp>",
  "reason": "owner_ui_revoke_center_admin_access",
  "disable_auth_user": false
}
```

Frontend không gửi password, temporary password, role, actor ids, service role, jwt hoặc authorization field trong body.

## 7. Existing flows preserved

Account status vẫn dùng `list-center-admin-accounts`. Reset password vẫn gọi `reset-center-admin-password` và handoff password một lần. Create admin vẫn gọi `provision-center-admin-account` chỉ cho production active center chưa có admin. Copy email và handoff copy vẫn giữ.

## 8. Manual QA checklist

1. Mở Internal Center Console.
2. DreamHome/Phòng Trống vẫn hiện admin email.
3. Bấm `Thu hồi quyền` ở center có admin.
4. Panel hiện, không scroll lên đầu.
5. Gõ `REVOKE`; caret không mất và text không biến mất.
6. Bấm `Tôi hiểu rủi ro`.
7. Final action vẫn disabled vì safety gate OFF.
8. Bấm `Hủy`; panel đóng, không scroll top.
9. Reset password và create admin guard vẫn hoạt động như C7.8D.
10. Form nhập liệu module khác vẫn giữ focus khi nhập.

## 9. What C7.8E does not do

C7.8E không deploy Edge Function, không SQL apply, không grant update, không gọi revoke live, không disable Auth user, không revoke membership thật, không bật destructive action mặc định, không commit và không push.

## 10. C7.8F recommendation

Nếu manual QA C7.8E PASS, bước C7.8F nên chuẩn bị controlled revoke readiness: deploy/grant có kiểm soát, chọn safe target, live-test revoke trên target an toàn, rồi mới cân nhắc bật flag trong runtime.
