# FB Admin DreamHome Follow-up - Window focus and student form smoothness

FB ADMIN DREAMHOME FOLLOWUP STATUS: WINDOW FOCUS STUDENT FORM SMOOTHNESS
FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN
C8_TEACHER_ROADMAP_SCOPE: NO
STUDENT_PROFILE_BRING_TO_FRONT_REALLY_FIXED: YES
STUDENT_MODULE_NO_LONGER_PRIORITIZED_OVER_PROFILE: YES
STUDENT_FORM_VERBOSE_REQUIRED_BANNER_REMOVED: YES
STUDENT_PARENT_TAB_WARNING_ICON_PRESERVED: YES
STUDENT_FORM_EXTRA_CTA_REMOVED: YES
STUDENT_INPUT_SINGLE_CLICK_FOCUS_FIXED: YES
STUDENT_FORM_BLUR_RERENDER_REDUCED: YES
ADD_STUDENT_MODAL_HEIGHT_RESPONSIVE_POLISHED: YES
TEACHER_ADD_FORM_FIX_PRESERVED: YES
BUTTON_AFFORDANCE_PRESERVED: YES
RUNTIME_CHANGED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Bối cảnh

Follow-up admin DreamHome từ Hoàng Vân sau feedback trước chưa pass. Các vấn đề còn lại tập trung vào window hồ sơ học viên vẫn bị module Học viên che, form Thêm học viên quá nhiều cảnh báo, thao tác input phải bấm hai lần, và modal học viên chưa tận dụng đủ chiều cao viewport.

## Root cause

- Hồ sơ học viên: `focusWindow` trước đó chỉ map z-index trên mảng hiện tại. Trong flow click từ row, module list vẫn có thể được focus bởi bubbling/pointerdown và render order chưa buộc window active ra cuối danh sách.
- Form học viên quá rối: feedback trước thêm banner, CTA điền phụ huynh và nút điều hướng footer trong khi user chỉ cần dấu `!` ở tab phụ huynh.
- Input phải bấm hai lần: blur của field học viên format/validate rồi gọi `render()`, thay DOM ngay giữa thao tác chuyển focus/click.
- Modal thấp: `.student-form-panel` có `max-height: calc(100vh - 140px)`, hơi chặt trên màn hình khoảng 768px.

## Patch summary

- Thêm `bringWindowToFront(windowId)` để vừa tăng z-index vừa đưa window active ra cuối mảng render; `focusWindow` dùng helper này.
- Chặn `pointerdown/click` từ `.student-row` bubble lên window list trước/sau khi mở hồ sơ học viên.
- Bỏ banner `Thiếu thông tin bắt buộc`, bỏ CTA `Điền thông tin phụ huynh`, bỏ footer step buttons trong form học viên.
- Giữ dấu `!` vàng trên tab `2. Phụ huynh / chăm sóc` và tooltip ngắn `Cần nhập thông tin phụ huynh/chăm sóc`.
- Blur field học viên không gọi `render()` nữa; chỉ cập nhật value local/state và trạng thái nút lưu.
- Tăng modal Thêm học viên bằng `height: min(92dvh, calc(100dvh - 76px), 780px)` và `max-height: calc(100dvh - 76px)`.
- Giữ fix Thêm giáo viên: nút lưu explicit `type="button"` và handler save có `preventDefault()`.

## Manual QA checklist

- Click học viên từ module Học viên: hồ sơ hiện trước mặt, không cần bấm nút `^`.
- Click lại học viên đã có hồ sơ mở: window hồ sơ được bring-to-front.
- Mở Thêm học viên: chỉ thấy dấu `!` vàng ở tab phụ huynh khi thiếu thông tin, không còn banner/CTA dài.
- Trong tab phụ huynh, click từ field này sang field khác: caret vào field mới ngay lần đầu.
- Click Hủy thêm khi đang focus input: modal đóng ngay lần đầu.
- Màn hình khoảng 768px height: modal học viên cao hơn, header/nút vẫn thao tác được, body scroll riêng nếu cần.
- Thêm giáo viên vẫn lưu được và không có warning native form disconnected.

## Safety notes

- Không sửa C8 Teacher roadmap/docs/tests.
- Không tạo/chạy SQL.
- Không deploy Supabase.
- Không invoke Edge Function.
- Không commit/push.
