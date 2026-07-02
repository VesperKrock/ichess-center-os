# C7.8E.1 - Revoke window UX polish + restore access design

C7.8E.1 STATUS: REVOKE WINDOW UX POLISH
C7_8E_STATUS: PASS_UNCOMMITTED
REVOKE_INLINE_PANEL_REMOVED_OR_DEPRECATED: YES
REVOKE_WINDOW_OR_MODAL_ADDED: YES
REVOKE_BUTTON_AFFORDANCE_FIXED: YES
REVOKE_TYPED_CONFIRMATION_PRESERVED: YES
REVOKE_SAFETY_GATE_DEFAULT_OFF: YES
REVOKE_LIVE_ACTION_ENABLED: NO
REVOKE_FUNCTION_CALLED_FROM_UI: NO
RESTORE_ACCESS_DESIGN_PLACEHOLDER_ADDED: YES
RESTORE_ACCESS_LIVE_ACTION_ENABLED: NO
ACCESS_REVOKED: NO
ACCESS_RESTORED: NO
RESET_PASSWORD_FLOW_PRESERVED: YES
CREATE_ADMIN_FLOW_PRESERVED: YES
ACCOUNT_STATUS_UI_PRESERVED: YES
SCROLL_JUMP_FIX_PRESERVED: YES
INPUT_FOCUS_FIX_PRESERVED: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh

C7.8E đã thêm UI thu hồi quyền với safety gate OFF, nhưng manual QA thấy panel inline nằm sâu bên dưới danh sách card nên dễ tưởng nút không hoạt động. C7.8E.1 polish phần hiển thị trước checkpoint.

## 2. Revoke window/modal

`Thu hồi quyền` không còn mở panel inline sâu trong flow nội dung. UI giờ mở modal/window fixed trong viewport với title `Thu hồi quyền admin cơ sở`, badge `Safety gate OFF`, nút đóng `×` và nút `Hủy`.

Modal vẫn dùng cùng state/typed confirmation/guard của C7.8E. Không có live revoke trong phase này.

## 3. Button affordance

Nút `Thu hồi quyền` ở card có admin là nút thật để mở safety modal:

- `cursor: pointer` khi enabled.
- Hover/focus-visible rõ.
- Danger tone nhẹ để phân biệt với `Copy email`.
- Disabled chỉ khi không có admin email.

## 4. Typed confirmation

Input `Nhập REVOKE để xác nhận` được giữ trong modal. Khi gõ, render vẫn defer nhờ hotfix input focus, nên caret/text không bị reset. Final destructive button vẫn disabled vì `ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = false`.

## 5. Restore access placeholder

C7.8E.1 thêm design placeholder cho trạng thái sau khi revoke live trong tương lai:

- `Đã thu hồi quyền`
- `Không còn admin hoạt động`
- `Có thể khôi phục quyền hoặc tạo admin mới`
- Nút tương lai `Khôi phục quyền`
- Nút tương lai `Tạo admin mới`

Các nút placeholder disabled, không gọi restore function và không mutate Supabase.

## 6. Safety

Safety gate vẫn là `ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = false`. Wrapper `revoke-center-admin-access` vẫn return blocked trước invoke khi flag OFF. Không bật restore live action, không tạo function restore, không deploy, không SQL apply.

## 7. Existing flows preserved

Giữ nguyên account status endpoint, copy email, reset password handoff, create admin guard, scroll preservation và input focus hotfix.

## 8. Manual QA checklist

1. Mở Internal Center Console.
2. Hover `Thu hồi quyền` ở center có admin.
3. Nút nhìn clickable rõ.
4. Click `Thu hồi quyền`.
5. Modal hiện ngay trong viewport, không cần scroll xuống.
6. Gõ `REVOKE`; caret/text không mất.
7. Final button vẫn disabled vì safety gate OFF.
8. Bấm `Hủy` hoặc `×`; modal đóng, không scroll jump.
9. Copy email, reset password và create admin guard vẫn hoạt động như trước.

## 9. Future recommendation

C7.8F nên kiểm thử controlled revoke trước. Sau đó C7.8G có thể cân nhắc restore flow, ví dụ `restore-center-admin-access` hoặc một endpoint account access lifecycle, nhưng C7.8E.1 chưa làm phần live restore.
