# C5.1B - Attendance / Session Report Manual SQL Apply Pack

## 1. Summary

C5.1B tạo manual SQL apply pack và checklist backend readiness cho realtime Điểm danh/Báo cáo ca dạy. Phase này chỉ chuẩn bị tài liệu để user đọc, duyệt và tự chạy sau trong Supabase SQL Editor nếu đồng ý.

Safety markers:

- SQL APPLY: NO
- WAITING USER CONFIRMATION BEFORE APPLYING SQL
- SUPABASE DATA CHANGE: NO
- RUNTIME IMPLEMENTATION: NO

Không có SQL nào được apply bởi Codex trong C5.1B. Không sửa Supabase data/schema thật. Không runtime implementation, không commit/push.

## 2. Why C5.1B is needed

C5.1A đã chốt hướng thiết kế: C5.1 vẫn đi qua `center_cloud_entities`, với attendance/report là dữ liệu nhạy cảm hơn student/teacher/class_session vì có xung đột nhiều actor, deadline, khóa admin, baseline và audit tương lai.

Backend hiện cần readiness trước khi C5.1C có thể viết runtime guarded realtime:

- Check constraint `center_cloud_entities_entity_type_check` phải cho phép entity C5.1.
- RLS hiện tại cần được xác nhận là center-scoped và write chỉ dành cho owner/admin/qtv/center_admin ở MVP.
- Realtime publication và replica identity phải sẵn sàng để client nhận update/delete đủ dữ liệu.
- Teacher/consultant direct write policy chưa đủ an toàn để mở rộng đại trà.

## 3. Entities added

Manual SQL pack mở rộng allowlist cho 3 entity C5.1:

- `attendance_record`: canonical attendance record cho từng học viên/ca/ngày/source.
- `attendance_baseline_state`: trạng thái nhập nền, khóa/mở khóa và metadata baseline.
- `session_report`: báo cáo ca dạy và snapshot attendance trong report.

Allowlist vẫn giữ các entity đã có hoặc đã dùng trong docs/code:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `tuition_record_package`

`tuition_record_package` chỉ được giữ trong allowlist readiness để không làm mất entity type đã có trong roadmap/docs; C5.1B không mở học phí/TBHP realtime.

## 4. Backend readiness checklist

Trước khi user apply SQL thủ công:

- Backup/snapshot `center_cloud_entities` và policy definition hiện tại.
- Chạy toàn bộ read-only preflight trong file SQL.
- Xác nhận constraint hiện tại không có entity type ngoài danh sách C5.1B.
- Xác nhận `center_members` có role/status đúng với dự án alpha/staging.
- Xác nhận C4.6B helper `is_center_member` và `can_write_center` còn đúng.
- Xác nhận `supabase_realtime` có hoặc sẽ có `public.center_cloud_entities`.
- Xác nhận `REPLICA IDENTITY FULL` được chấp nhận cho table này.
- Không chạy optional test insert nếu chưa đồng ý rõ.

## 5. SQL pack overview

File manual pack: `docs/supabase-c5-1b-attendance-session-report-final-apply.sql`.

Step 0 - Safety header:

- Ghi rõ `SQL APPLY: NO in CodeX`.
- Ghi rõ `WAITING USER CONFIRMATION BEFORE APPLYING SQL`.
- Ghi rõ data destructive intended NO và backup recommended YES.

Step 1 - Read-only preflight:

- Đếm tổng `center_cloud_entities`.
- Đếm theo `entity_type` và `center_id`.
- Kiểm tra `center_cloud_entities_entity_type_check`.
- Kiểm tra `supabase_realtime`.
- Kiểm tra `relreplident`.
- Kiểm tra `pg_policies` cho `center_cloud_entities` và `center_members`.

Step 2 - Allowlist patch:

- Drop/re-add duy nhất check constraint `center_cloud_entities_entity_type_check`.
- Không drop table, không truncate, không delete data.
- Allowlist cuối gồm `student`, `teacher`, `class_session`, `schedule_session`, `attendance_record`, `attendance_baseline_state`, `session_report`, `tuition_record_package`.

Step 3 - RLS readiness:

- Verify policies hiện có từ C4.6B.
- Giữ `can_write_center` theo owner/qtv/center_admin/admin.
- Không mở teacher/consultant direct write trong C5.1B.

Step 4 - Realtime readiness:

- Đặt `alter table public.center_cloud_entities replica identity full`.
- Add publication `supabase_realtime` nếu table chưa có.

Step 5 - Post-apply verification:

- Verify constraint mới.
- Verify policies/helper.
- Verify publication.
- Verify replica identity.
- Optional rollback transaction test được comment, không active mặc định.

Step 6 - Rollback notes:

- Revert check constraint về allowlist cũ nếu cần.
- Không xóa data thật.
- Nếu user tự tạo test record, chỉ xóa exact test `local_id/entity_id`.
- Realtime publication có thể giữ nguyên, chỉ remove khi đã đánh giá tác động.

## 6. RLS/read/write policy recommendation

MVP an toàn cho C5.1:

- Center member active được read entity cùng center qua `public.is_center_member(center_id)`.
- Owner/admin/qtv/center_admin được insert/update qua `public.can_write_center(center_id)`.
- admin/center_admin write first.
- teacher/consultant direct write policy: HOLD / needs approval.

Lý do giữ teacher/consultant:

- Teacher chỉ nên ghi `session_report` và `attendance_record` cho ca được phân công, không được ghi toàn center.
- Consultant write attendance cần rule nghiệp vụ riêng và audit rõ.
- Latest-wins không đủ an toàn cho điểm danh; cùng natural key nhưng khác value/source phải có conflict guard.
- Admin attendance có thể khóa teacher attendance, nên policy cần predicate theo session assignment và trạng thái khóa.

C5.1B chỉ chuẩn bị backend cho admin/center_admin write trước. Teacher/consultant policy cần phase riêng hoặc user approval rõ trước khi mở.

## 7. Realtime readiness

Realtime nên đi qua `public.center_cloud_entities` với filter center:

- Table: `public.center_cloud_entities`.
- Publication: `supabase_realtime`.
- Client filter: `center_id=eq.<centerId>`.
- Entity handler C5.1C chỉ nhận `attendance_record`, `attendance_baseline_state`, `session_report`.
- Soft delete dùng `deleted_at` và payload `deletedAt`, không hard delete.
- Conflict guard tối thiểu: ignore older `updatedAt`, mark conflict nếu same natural key khác value/status/source.

`REPLICA IDENTITY FULL` giúp realtime update/delete có đủ old row/new row để client không mất context khi xử lý soft delete hoặc conflict.

## 8. Verification queries

Manual pack có sẵn verification cho:

- Total count và count theo entity type.
- Constraint definition.
- Policy list.
- Function readiness `is_center_member`, `can_write_center`.
- Realtime publication.
- Replica identity.

Optional test insert chỉ là block comment. Không chạy nếu user chưa duyệt rõ vì dù transaction rollback, nó vẫn là thao tác viết thử lên database.

## 9. Rollback notes

Rollback dự kiến nếu apply thủ công gặp lỗi:

- Ghi lại constraint definition trước apply.
- Nếu chỉ lỗi allowlist, revert check constraint về definition cũ.
- Không `truncate`, không hard delete, không xóa dữ liệu thật.
- Nếu user tự tạo test record, chỉ xóa đúng exact test `local_id` hoặc `entity_id`.
- Nếu publication đã thêm thành công, thường có thể giữ nguyên; chỉ remove nếu xác nhận nó gây side effect.
- Nếu RLS bị sai, restore policy/function definition từ backup C4.6B/C5.1B preflight.

## 10. Risk notes

- Project đang có alpha/staging data, nên backup vẫn cần dù SQL chủ đích không destructive.
- Legacy policies có thể đã thay đổi sau C4.6B; user phải đọc preflight output trước khi apply patch.
- Latest-wins không đủ cho attendance conflict, nhất là admin/teacher/baseline cùng một học viên/ca.
- Teacher/consultant write policy nhạy cảm, không mở rộng trong C5.1B.
- `session_report.attendanceSnapshot` không phải canonical attendance cuối; canonical là `attendance_record`.
- C5.3 audit log/rollback chưa làm, nên C5.1C sau này chỉ được thêm guard tối thiểu.
- C5.1B không nối attendance sang học phí/TBHP, không mutate `usedSessions`.

## 11. Next phase recommendation

Recommended next step:

- C5.1B-Apply - User manually applies SQL after review.

Sau khi user confirm đã apply và verify backend readiness:

- C5.1C - Runtime guarded realtime implementation after backend readiness is confirmed.

Nếu user chưa muốn apply SQL, giữ C5.1C ở trạng thái pending và không thêm write-through realtime cho attendance/session report.
