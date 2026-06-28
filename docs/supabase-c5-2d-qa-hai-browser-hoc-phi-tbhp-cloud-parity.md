# C5.2D - QA hai browser Học phí/TBHP cloud parity + fallback

Markers:

- SQL: NOT CREATED / NOT RUN
- SUPABASE ACTION: NOT RUN BY CODEX
- COMMIT: NOT RUN
- PUSH: NOT RUN
- RUNTIME CHANGE: NO, UNLESS BLOCKER HOTFIX IS EXPLICITLY REPORTED
- ATTENDANCE_TO_TUITION_AUTO_LINK: NO
- TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.2D

C5.2D audit lại runtime C5.2C ở mức QA-readiness và tạo checklist manual QA cho hai browser T/P. Phase này không chạy Supabase, không chạy SQL, không thêm runtime mới nếu không có blocker rõ.

## 2. Trạng thái trước C5.2D

C5.2A, C5.2B và C5.2C đã PASS theo workspace hiện tại.

Cloud/core sync entities trước C5.2C:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Realtime subscriptions trước C5.2C:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

`class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.

C5.2C bổ sung runtime bridge/subscription cho `tuition_record_package`.

## 3. C5.2B verification PASS

User đã chạy verification trong Supabase và xác nhận:

- `allowlist_has_tuition_record_package: true`
- `realtime_has_center_cloud_entities: true`
- `replica_identity_full: true`
- `has_can_write_center: true`
- `has_is_center_member: true`

Vì vậy C5.2D không cần SQL apply.

## 4. C5.2C runtime summary

C5.2C đã thêm:

- Runtime bridge: `src/cloud-tuition-record-package-bridge.js`
- Runtime hook: `src/main.js`
- Entity: `tuition_record_package`
- LocalStorage key giữ nguyên: `ichessCenterOS.tuition.dreamhome`
- local_id strategy: `tuition_record_package::<record.id>`
- Pull/merge: cloud empty/error không xóa local
- Write-through: sau local save gói/kỳ và thanh toán
- Role guard: `owner`, `qtv`, `center_admin`, `admin`
- Realtime/subscription: guarded subscription theo `center_id`
- TBHP: tiếp tục đọc local `tuitionRecords` đã merge
- Attendance relation: không nối attendance/session_report sang học phí

## 5. Những gì C5.2D không làm

C5.2D không:

- Không commit.
- Không push.
- Không tạo/chạy/apply SQL.
- Không sửa Supabase dashboard/API.
- Không gọi Supabase bởi Codex.
- Không thêm runtime mới nếu không có blocker rõ.
- Không refactor lớn.
- Không sync all modules đại trà.
- Không auto-link attendance sang học phí.
- Không tự cập nhật `usedSessions` từ attendance.
- Không tự cập nhật `remainingSessions` từ attendance.
- Không tự sinh TBHP từ attendance/session_report.
- Không enable teacher/consultant direct write.
- Không hard delete cloud/local.
- Không reset localStorage.
- Không seed đè dữ liệu.

## 6. Điều kiện chuẩn bị QA

Trước khi QA:

1. Browser T và Browser P cùng mở app.
2. Cùng đăng nhập tài khoản admin-style hoặc 2 tài khoản cùng center có role được write.
3. Xác nhận cả hai cùng center DreamHome/staging.
4. Mở module Học phí ở cả hai browser.
5. Mở DevTools Console nếu cần theo dõi lỗi runtime.
6. Không chạy SQL apply.
7. Không xóa localStorage.
8. Không tạo tài khoản mới bằng signUp trong app.

## 7. Checklist QA một browser

Checklist:

1. Mở module Học phí.
2. Chọn một học viên có record học phí.
3. Sửa field an toàn như ghi chú hoặc hạn đóng.
4. Lưu.
5. Reload browser.
6. Kiểm tra dữ liệu vẫn còn.
7. Kiểm tra `usedSessions` không thay đổi vì attendance.
8. Kiểm tra `remainingSessions` chỉ phản ánh logic hiện có, không bị attendance tự sửa.
9. Kiểm tra TBHP vẫn hiển thị từ `tuitionRecords`, không tự sinh dữ liệu lạ.

## 8. Checklist QA hai browser T/P

Checklist:

1. Browser T sửa một record học phí.
2. Browser P quan sát realtime hoặc reload nếu realtime chưa hiện ngay.
3. Kiểm tra record ở P nhận được thay đổi.
4. Browser P sửa một field khác.
5. Browser T quan sát realtime hoặc reload.
6. Kiểm tra không mất dữ liệu.
7. Kiểm tra localStorage key `ichessCenterOS.tuition.dreamhome` vẫn có dữ liệu hợp lệ.
8. Kiểm tra Supabase `center_cloud_entities` có `entity_type = 'tuition_record_package'`.
9. Kiểm tra `local_id` dạng `tuition_record_package::<record.id>`.

## 9. Checklist cloud parity

Checklist:

1. Sau khi lưu ở Browser T, record cloud có payload Học phí tương ứng.
2. Payload preserve `id`, `studentId`, `packageName`, `totalSessions`, `usedSessions`, `paidAmount`, `payments`, `currentTermId`, `currentTermNumber`.
3. `updated_at`/`payload.updatedAt` tăng sau thao tác Học phí.
4. Browser P sau realtime/reload hiển thị cùng dữ liệu.
5. Không có entity legacy mới làm canonical như `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment`.

## 10. Checklist realtime parity

Checklist:

1. Hai browser cùng signed-in và cùng center.
2. Browser T lưu Học phí.
3. Browser P nhận thay đổi realtime trong thời gian hợp lý.
4. Nếu realtime không hiện, reload Browser P để phân biệt realtime issue và pull/merge issue.
5. Console không có lỗi subscription lặp vô hạn.
6. Logout một browser rồi login lại, subscription cũ được cleanup.

## 11. Checklist local fallback

Checklist:

1. Mô phỏng cloud unavailable nhẹ nếu có thể bằng logout/offline/dev config phù hợp.
2. Sửa local hoặc reload app.
3. Local vẫn giữ dữ liệu hiện có.
4. Cloud fail không block local save.
5. Nếu không mô phỏng được an toàn, ghi `NOT TESTED`, không bịa pass.

## 12. Checklist cloud empty/error không xóa local

Checklist:

1. Với môi trường cloud không có row `tuition_record_package`, mở app sau login.
2. Xác nhận local Học phí không bị clear.
3. Xác nhận app không seed đè sample data lên dữ liệu người dùng.
4. Khi cloud query lỗi, localStorage `ichessCenterOS.tuition.dreamhome` vẫn còn.
5. Không hard delete cloud/local trong QA này.

## 13. Checklist role guard

Checklist:

1. Admin-style role có thể write cloud: `owner`, `qtv`, `center_admin`, `admin`.
2. Viewer không được direct cloud write.
3. Nếu có account role khác, xác nhận behavior đúng read-only.
4. Không tự tạo tài khoản mới trong app.

## 14. Checklist teacher/consultant direct write HOLD

Checklist:

1. Teacher/consultant không được direct cloud write `tuition_record_package`.
2. Nếu chưa có tài khoản teacher/consultant để test, ghi `NOT TESTED`.
3. Không đổi policy hoặc runtime để mở write trong QA này.
4. Nếu teacher/consultant vẫn write được, phân loại `NEEDS REVIEW`.

## 15. Checklist TBHP behavior

Checklist:

1. TBHP tiếp tục đọc từ `tuitionRecords`.
2. TBHP không tự sinh dữ liệu tài chính riêng.
3. `attendanceAdvisoryNotes` không được sync trong C5.2D.
4. Chỉnh Học phí có thể làm TBHP hiển thị lại theo dữ liệu Học phí đã merge.
5. Chỉnh điểm danh không được tự sinh TBHP mới.

## 16. Checklist không attendance -> tuition auto-link

Checklist:

1. Tạo/sửa điểm danh hoặc xem session_report không được tự tăng `usedSessions`.
2. Không được tự giảm `remainingSessions`.
3. Không được tự tính nợ/phí từ attendance.
4. Nếu `usedSessions` thay đổi, nguyên nhân phải là thao tác Học phí hiện có.
5. Nếu attendance làm đổi Học phí, phân loại `NEEDS REVIEW`.

## 17. Dữ liệu cần quan sát trong Supabase

Chỉ quan sát thủ công, không yêu cầu Codex chạy Supabase:

- Table: `public.center_cloud_entities`
- `center_id`
- `entity_type = 'tuition_record_package'`
- `local_id`
- `payload.id`
- `payload.studentId`
- `payload.updatedAt`
- `payload.usedSessions`
- `payload.remainingSessionsAutoUpdateFromAttendance`
- `payload.attendanceLinked`
- `deleted_at`

Không chạy SQL apply. Nếu cần query, chỉ query read-only do user tự chạy.

## 18. Kỳ vọng kết quả

Kỳ vọng PASS:

- Hai browser thấy parity sau realtime hoặc reload.
- Local fallback giữ dữ liệu khi cloud empty/error.
- Cloud write-through chỉ xảy ra sau local save.
- Role guard admin-style hoạt động.
- Teacher/consultant direct write vẫn HOLD.
- Không attendance -> tuition auto-link.
- Không auto update `usedSessions`/`remainingSessions` từ attendance.

## 19. Cách phân loại PASS / NEEDS REVIEW

PASS khi:

- Checklist một browser pass.
- Checklist hai browser pass hoặc realtime issue được phân loại rõ với reload parity pass.
- Local fallback pass.
- Role guard pass hoặc các role chưa có account được ghi `NOT TESTED`.
- Không phát hiện attendance tự mutate Học phí.

NEEDS REVIEW khi:

- Cloud empty/error xóa local.
- Teacher/consultant write được cloud Học phí.
- Attendance/session_report tự đổi `usedSessions` hoặc `remainingSessions`.
- `local_id` không theo `tuition_record_package::<record.id>`.
- Realtime tạo duplicate/loop hoặc mất dữ liệu.
- Có lỗi runtime làm không thể QA Học phí.

## 20. Risks / limitations

- C5.2D là manual QA runbook, không chứng minh remote production bằng Codex.
- Conflict UI/audit/rollback vẫn để C5.3.
- Nếu không có account teacher/consultant thì phần role đó cần ghi `NOT TESTED`.
- Nếu realtime chậm hoặc browser ngủ tab, reload parity vẫn cần được kiểm tra riêng.
- Cloud soft delete đang preserve local để an toàn, chưa phải rollback/audit đầy đủ.

## 21. Next recommendation

Nếu manual QA pass: tạo C5.2E checkpoint review.

Nếu manual QA fail: tạo hotfix hẹp C5.2D.x, không sang checkpoint.

