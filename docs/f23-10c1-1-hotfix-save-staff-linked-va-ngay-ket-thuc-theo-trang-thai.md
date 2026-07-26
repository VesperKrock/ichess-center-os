# F23.10C1.1 Hotfix - Save staff linked và ngày kết thúc theo trạng thái

## Root Cause

Button `Lưu hồ sơ` trong form Nhân viên có `type="submit"` nhưng cũng có `data-staff-action="save"`. Listener click chung cho `[data-staff-action]` luôn gọi `event.preventDefault()` trước khi phân nhánh action, trong khi action `save` không có handler riêng. Vì vậy submit event thật của form không chạy, dẫn tới click chết: không save, không loading, không validation, không message.

## Runtime Fix

- `data-staff-action="save"` được cho đi qua native submit, để `handleStaffFormSubmit(event.currentTarget)` chạy đúng.
- Save handler refresh latest center-scoped staff/departments trước khi validate và replace.
- Edit mode tìm record bằng stable staff ID, chặn stale/missing, chặn duplicate stable ID, chặn cross-center thật với message rõ.
- Duplicate `employeeCode` so sánh trim/case-insensitive trên latest list và loại trừ chính staff đang edit.
- `buildStaffMemberFromForm` spread existing record trước, chỉ override field editable, nên giữ `id`, `createdAt`, `teacherId`, `teacherLinkedAt`, `accountUserId`, `membershipId` và unknown fields.
- Flow save chỉ map thay đúng một record; không append staff mới khi edit; không mutate teacher record; teacher profile đọc lại label từ latest staff list sau render.
- Validation error giữ modal, clear saving state, focus field lỗi đầu tiên.

## Employment Dates

- `Ngày bắt đầu` optional, không tự điền ngày hiện tại.
- `active` và `on-leave`: `Ngày kết thúc` disabled, hiển thị `Đến nay`, draft end date bị clear khi đổi trạng thái và save không persist end date mới.
- `terminated`: `Ngày kết thúc` enabled; nếu có cả start/end thì end không được trước start. End date vẫn có thể để trống để không phá legacy data.
- `archived` là lifecycle hồ sơ, không tự suy luận nghỉ việc và không tự ghi ngày kết thúc mới.
- List Nhân viên hiển thị `Thời gian làm việc`: active/on-leave là `<start hoặc —> → Đến nay`; terminated thiếu end date là `Chưa cập nhật`.

## Teacher Boundary

`Ngừng dạy` của Giáo viên không đồng bộ sang trạng thái Nhân viên trong hotfix này. Không gỡ link, không archive staff, không khóa tài khoản, không đổi TKB/attendance/Teacher Portal mapping.

## QA Notes

- Manual fixture `001 → GV001` chỉ là case QA, không hardcode runtime.
- Sau save, Teacher profile phải hiển thị `GV001 · Nguyễn Trường Thịnh` từ linked staff hiện có.
- Hotfix không chạm Auth, Supabase, SQL, deploy, Teacher secret, Module 14 hoặc Teacher Workspace route.

## Markers

F23_10C1_1_LINKED_STAFF_EDIT_SAVE_FIXED: YES
F23_10C1_1_EMPLOYMENT_END_DATE_STATUS_RULE_FIXED: YES
F23_10C1_1_NO_TEACHER_LIFECYCLE_SYNC: YES
