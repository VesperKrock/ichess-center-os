# FB Admin DreamHome - Form save, window focus, teacher add

FB ADMIN DREAMHOME STATUS: FORM SAVE WINDOW FOCUS TEACHER ADD
FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN
C8_TEACHER_ROADMAP_SCOPE: NO
STUDENT_SAVE_DISABLED_REASON_ADDED: YES
STUDENT_PARENT_INFO_REQUIRED_HINT_ADDED: YES
STUDENT_PROFILE_WINDOW_BRING_TO_FRONT_FIXED: YES
WINDOW_LAYER_PRIORITY_NOTED: YES
TEACHER_ADD_FORM_SUBMIT_FIXED: YES
BUTTON_AFFORDANCE_POLISHED: YES
RUNTIME_CHANGED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Bối cảnh

Feedback admin DreamHome từ Hoàng Vân ghi nhận bốn điểm UX/runtime nhỏ trong vận hành: lưu học viên thiếu lý do, hồ sơ học viên mở sau module danh sách, form thêm giáo viên không lưu được do native submit detached, và nút trong form/modal chưa có affordance rõ.

Việc này là polish admin runtime, không thuộc C8 Teacher roadmap.

## Issue và root cause

1. Form Thêm học viên: nút Lưu học viên dùng trạng thái disabled theo validation, nhưng UI chỉ nói chung chung là cần nhập đủ dấu sao. Khi admin đã nhập xong tab học viên, lý do thiếu phụ huynh/chăm sóc không hiện rõ ngay cạnh nút.
2. Hồ sơ học viên: `openStudentDetailWindow` tạo window mới với z-index mới nhưng không gọi lại helper focus như các student subwindow, nên trong một số nhịp render có thể không được đưa lên active/front nhất quán.
3. Thêm giáo viên: nút Lưu giáo viên là `type="submit"` trong modal render động. Khi DOM bị thay trong chu kỳ submit, browser có thể báo `Form submission canceled because the form is not connected`.
4. Button affordance: một số button form/modal có hover nhẹ, thiếu active/focus-visible/disabled khác biệt.

## Patch summary

- Thêm helper lý do disabled cho form học viên, ưu tiên text: `Còn thiếu thông tin phụ huynh/chăm sóc để lưu học viên.`
- Thêm trạng thái cảnh báo nhỏ trên tab `2. Phụ huynh / chăm sóc` và CTA `Điền thông tin phụ huynh →`.
- Sửa `openStudentDetailWindow` để window vừa mở gọi `focusWindow(nextWindowId)` ngay sau khi push, còn window đã mở vẫn focus/bring-to-front.
- Tách lưu giáo viên thành `handleTeacherFormSave(event)`, giữ `preventDefault()` cho submit/Enter, và đổi nút lưu chính sang `type="button"` với click explicit.
- Polish hover/focus/active/disabled cho các nút form/modal học viên và giáo viên, không chạm window controls.

## Manual QA checklist

- Mở Học viên, bấm Thêm học viên, nhập đủ tab học viên nhưng bỏ trống phụ huynh: thấy nút Lưu học viên disabled và hiện lý do thiếu phụ huynh/chăm sóc.
- Bấm CTA hoặc tab Phụ huynh / chăm sóc: tab có dấu cần điền; nhập tên phụ huynh và ít nhất một SĐT ba/mẹ thì nút lưu enabled.
- Click một học viên từ danh sách: cửa sổ Hồ sơ học viên hiện trước module Học viên; click lại học viên đã mở thì focus lại đúng window.
- Mở Giáo viên, bấm Thêm giáo viên, nhập tối thiểu họ tên/tên hiển thị/SĐT, bấm Lưu giáo viên: giáo viên được thêm, không còn warning form disconnected.
- Hover/focus/click các nút trong form/modal admin: enabled có phản hồi rõ, disabled nhìn disabled và không hover như enabled.

## Safety notes

- Không sửa C8 Teacher roadmap/docs/tests trong phase này.
- Không tạo/chạy SQL.
- Không deploy Supabase.
- Không invoke Edge Function.
- Không commit/push.
