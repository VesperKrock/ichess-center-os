# Feedback C8.2 - Teacher profile modal taskbar-safe height

## 1. Trạng thái

```txt
FB C8.2 STATUS: TEACHER PROFILE MODAL TASKBAR SAFE HEIGHT
FEEDBACK_SCOPE: C8_2_LAYOUT_POLISH
TEACHER_PROFILE_MODAL_BOTTOM_ABOVE_TASKBAR: YES
TEACHER_PROFILE_MODAL_RESPONSIVE_HEIGHT: YES
TEACHER_PROFILE_MODAL_BODY_SCROLLS_INTERNALLY: YES
TEACHER_PROFILE_MODAL_FOOTER_VISIBLE: YES
TASKBAR_PRIORITY_PRESERVED: YES
TEACHER_PORTAL_LOGIC_CHANGED: NO
AUTH_CREATED: NO
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```

## 2. Bối cảnh

Sau C8.2, modal hồ sơ giáo viên và Teacher Portal preview đã cao hơn, nhưng manual QA trên màn khoảng 768px phát hiện phần dưới modal có thể bị taskbar che. Feedback này chỉ sửa layout responsive, không đổi logic Teacher Portal.

## 3. Patch summary

- Chuyển `.teacher-profile-backdrop` sang viewport-fixed để modal không phụ thuộc chiều cao/vị trí window module phía sau.
- Thêm biến `--app-taskbar-safe-height` và `--teacher-profile-modal-gap`.
- Đặt bottom inset bằng `calc(var(--app-taskbar-safe-height) + var(--teacher-profile-modal-gap))` để modal luôn kết thúc phía trên taskbar.
- Giữ `.teacher-profile-panel` trong vùng safe-area với `height: min(100%, 900px)` và `max-height: 100%`.
- Giữ nội dung scroll trong `.teacher-profile-pane`, taskbar không bị che vì backdrop dừng trước taskbar.

## 4. Responsive behavior

- Màn thấp khoảng 768px: modal dùng gần hết vùng còn lại nhưng bottom nằm trên taskbar.
- Màn cao hơn: modal vẫn có max chiều cao hợp lý.
- Màn hẹp: media rule dùng cùng biến taskbar-safe, actions có thể wrap/grid nhưng vẫn trong vùng nhìn thấy.

## 5. Manual QA checklist

1. Mở module `Giáo viên`.
2. Mở hồ sơ giáo viên.
3. Kiểm tra trên màn khoảng 768px: modal không bị taskbar che phần dưới.
4. Nút `Sửa`, `Ngừng dạy`, `Đóng` nhìn thấy và bấm được.
5. Body/pane trong modal scroll riêng.
6. Taskbar vẫn nhìn thấy và bấm được.
7. Bấm `Mở Teacher Portal`, kiểm tra `Lịch dạy của tôi` và `Xem ca dạy` vẫn hoạt động.
8. Mở TKB admin để xác nhận không regress report/attendance cũ.

## 6. Safety notes

Không đổi Teacher Portal logic, không đổi TKB/report/attendance, không tạo Auth/signup, không SQL, không deploy, không Edge Function.
