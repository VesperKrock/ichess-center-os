# C5.2B - Gói SQL/readiness cho Học phí / TBHP cloud source-of-truth

Safety markers:

- SQL APPLY: NO
- SUPABASE ACTION: NO
- SUPABASE DATA CHANGE: NO
- WAITING USER CONFIRMATION BEFORE ANY APPLY
- RUNTIME CHANGE: NO
- COMMIT: NO
- PUSH: NO

## 1. Mục tiêu C5.2B

C5.2B tạo manual readiness pack cho Học phí/TBHP cloud source-of-truth với canonical entity:

```txt
tuition_record_package
```

Phase này chỉ tạo tài liệu kiểm tra readiness và file SQL read-only để user tự copy vào Supabase SQL Editor nếu muốn xác minh trạng thái backend. C5.2B không apply SQL, không gọi Supabase API, không đổi dữ liệu, không runtime, không commit, không push.

## 2. Trạng thái trước C5.2B

Checkpoint nền:

- Latest commit: `76a5f51 C5.1 attendance session report realtime checkpoint`
- Branch: `main`
- Expected ahead/behind: `main...origin/main [ahead 2]`
- C5.2A đã PASS và để lại 2 file untracked đúng scope.

Cloud/core sync entities hiện có:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Realtime subscriptions wired hiện có:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

`class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.

## 3. Kết quả C5.2A liên quan SQL/readiness

C5.2A xác nhận:

- Học phí local key: `ichessCenterOS.tuition.dreamhome`.
- Catalog phụ: `ichessCenterOS.tuitionPackages.dreamhome`.
- TBHP hiện là bảng chăm sóc/cuối tháng trong module Học phí, đọc `tuitionRecords` và `sessionReports`.
- `usedSessions` hiện lưu/nhập trong Học phí.
- `remainingSessions` chủ yếu tính hiển thị từ `totalSessions - usedSessions`.
- Không có auto update runtime từ attendance.
- Chưa có runtime bridge thật cho `tuition_record_package`.
- Chưa có tuition realtime.

C5.2A đề xuất tiếp tục dùng `center_cloud_entities` và entity `tuition_record_package`.

## 4. C5.2B không làm gì

C5.2B không:

- Không apply SQL.
- Không chạy SQL.
- Không gọi Supabase API.
- Không sửa Supabase dashboard.
- Không tạo migration tự động.
- Không runtime implementation.
- Không sửa `src/main.js`.
- Không sửa module Học phí/TBHP runtime.
- Không sửa Bảng điểm danh hoặc `session_report` runtime.
- Không auto-link attendance sang học phí.
- Không tự cập nhật `usedSessions`.
- Không tự cập nhật `remainingSessions`.
- Không tự sinh TBHP.
- Không enable teacher/consultant direct write.
- Không tạo bảng tuition riêng.
- Không backfill hoặc seed dữ liệu.
- Không commit.
- Không push.

## 5. Supabase readiness cần kiểm tra

User nên xác minh các điểm sau bằng file read-only verification SQL:

- `public.center_cloud_entities` tồn tại.
- Check constraint/allowlist của `center_cloud_entities` có `tuition_record_package`.
- `supabase_realtime` publication có `public.center_cloud_entities`.
- Replica identity của `center_cloud_entities` là FULL.
- Helper function `public.can_write_center` tồn tại.
- Helper function `public.is_center_member` tồn tại.
- RLS policies trên `center_cloud_entities` còn center-scoped.
- Có hay chưa có row `entity_type = 'tuition_record_package'`, chỉ count/read.

Không tạo bảng tuition riêng trong C5.2B. Tiếp tục chiến lược `center_cloud_entities` entity table.

## 6. Read-only verification queries

File verification:

```txt
docs/supabase-c5-2b-readonly-verify-hoc-phi-tbhp.sql
```

File này chỉ chứa read-only verification queries. User có thể copy vào Supabase SQL Editor để tự kiểm tra. Codex không chạy file này.

Các nhóm query:

- Kiểm tra bảng/cột `center_cloud_entities`.
- Kiểm tra constraint entity type.
- Kiểm tra publication realtime.
- Kiểm tra replica identity.
- Kiểm tra helper functions.
- Kiểm tra policies.
- Count row `tuition_record_package`.

## 7. Expected result

Expected nếu C5.1B SQL đã được apply đúng:

- Constraint của `center_cloud_entities` có các entity: `student`, `teacher`, `class_session`, `schedule_session`, `attendance_record`, `attendance_baseline_state`, `session_report`, `tuition_record_package`.
- Publication `supabase_realtime` có `public.center_cloud_entities`.
- `relreplident = 'f'`, nghĩa là replica identity FULL.
- `can_write_center` và `is_center_member` tồn tại.
- RLS policies không mở teacher/consultant direct write rộng.
- Count `tuition_record_package` có thể là 0 nếu C5.2 runtime chưa bắt đầu. 0 row không phải lỗi readiness.

## 8. Nếu verification pass thì không cần apply SQL

Nếu user chạy read-only verification và thấy `tuition_record_package` đã có trong allowlist, C5.2B không cần final apply SQL.

C5.2B FINAL APPLY SQL: NOT REQUIRED BASED ON CURRENT WORKSPACE/HANDOVER

Khi đó bước tiếp theo có thể là C5.2C runtime guarded bridge, nhưng chỉ sau khi user xác nhận readiness.

## 9. Nếu verification fail thì hướng xử lý phase sau

Nếu verification fail:

- Không tự apply SQL trong C5.2B.
- Không sang C5.2C runtime.
- Ghi lại output read-only verification.
- Tạo phase riêng C5.2B-Apply hoặc C5.2B.1 manual apply pack nếu user duyệt.

Các fail đáng chú ý:

- Thiếu `tuition_record_package` trong allowlist.
- Thiếu publication `supabase_realtime` cho `center_cloud_entities`.
- Replica identity chưa FULL.
- Thiếu `can_write_center` hoặc `is_center_member`.
- RLS policies không center-scoped hoặc mở write quá rộng.

## 10. Có cần final apply SQL không?

Theo audit workspace hiện tại: không tạo final apply SQL trong C5.2B.

Lý do:

- `docs/supabase-c5-1b-attendance-session-report-final-apply.sql` đã bao gồm `tuition_record_package` trong allowlist cuối.
- C5.1B docs ghi rõ entity này được giữ trong readiness.
- C5.2B không có bằng chứng workspace cần SQL mới.

Final apply needed: NO, NEEDS USER VERIFY BEFORE C5.2C.

Optional final apply SQL: NOT CREATED.

## 11. RLS/helper function readiness

Readiness mong đợi:

- `public.is_center_member(center_id)` cho phép center member active đọc dữ liệu cùng center.
- `public.can_write_center(center_id)` chỉ cho admin-style roles ghi.
- Admin-style roles gồm `owner`, `qtv`, `center_admin`, `admin`.

Teacher/consultant direct write: HOLD.

Nếu teacher/consultant cần đề xuất/chăm sóc trong tương lai, cần policy scoped riêng và audit riêng. Không mở trong C5.2B.

## 12. Realtime readiness

C5.2B chỉ kiểm tra readiness, không thêm realtime runtime.

Readiness mong đợi:

- Publication: `supabase_realtime`.
- Table: `public.center_cloud_entities`.
- Client future phải filter theo `center_id`.
- Client future chỉ xử lý entity `tuition_record_package` khi C5.2C được duyệt.

Không subscribe tuition realtime trong C5.2B.

## 13. Replica identity readiness

Replica identity mong đợi cho `public.center_cloud_entities`:

```txt
FULL
```

Trong Postgres catalog, `pg_class.relreplident = 'f'` tương ứng FULL. Điều này giúp realtime update/delete có đủ context cho merge, soft delete và conflict guard sau này.

## 14. Entity allowlist readiness

Allowlist expected theo C5.1B/handover:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `tuition_record_package`

C5.2B không thêm `tuition_record`, `tuition_package`, `tuition_term`, hoặc `tuition_payment` vào canonical C5.2 path. Các entity F19H đó chỉ là legacy dry-run/reference.

## 15. Role guard policy

Cloud write Học phí/TBHP future chỉ cho:

- `owner`
- `qtv`
- `center_admin`
- `admin`

Teacher/consultant direct write HOLD.

Policy này đồng bộ với hướng C5.1B/C5.2A: dữ liệu tiền/buổi nhạy cảm, không mở write rộng nếu chưa có scoped policy, audit log và rollback.

## 16. Không runtime trong C5.2B

C5.2B không sửa runtime và không tạo bridge code cho Học phí/TBHP.

Runtime: NOT CHANGED.

C5.2 runtime: NOT STARTED.

## 17. Không attendance -> tuition auto-link

C5.2B không nối attendance sang học phí.

Không tự trừ buổi, không chọn current term từ attendance, không đọc `attendance_record` để update Học phí, không dùng `session_report` để mutate tuition package.

Attendance -> tuition auto-link: NOT ADDED.

## 18. Không teacher/consultant direct write

Teacher/consultant direct write vẫn HOLD.

C5.2B không đổi RLS, không tạo policy mới, không mở role mới, không tạo runtime write path cho teacher/consultant.

## 19. Manual QA/verification plan cho user

Manual verification:

1. Mở `docs/supabase-c5-2b-readonly-verify-hoc-phi-tbhp.sql`.
2. Copy vào Supabase SQL Editor.
3. Chỉ chạy nếu user muốn kiểm tra read-only.
4. Lưu output constraint, publication, replica identity, helper functions, policies.
5. Xác nhận `tuition_record_package` có trong constraint definition.
6. Xác nhận `can_write_center` chỉ cho `owner`, `qtv`, `center_admin`, `admin`.
7. Xác nhận `teacher`/`consultant` không được mở direct write rộng.
8. Nếu mọi thứ pass, ghi nhận readiness trước khi sang C5.2C.

## 20. Risks/blockers

Risks:

- Workspace cho thấy C5.1B SQL đã có `tuition_record_package`, nhưng Codex không tự kiểm tra remote Supabase trong C5.2B.
- Nếu user chưa apply C5.1B hoặc remote khác workspace, verification có thể fail.
- Count `tuition_record_package = 0` là bình thường trước runtime, nhưng thiếu allowlist mới là blocker.
- RLS/policy drift có thể xảy ra nếu dashboard đã được sửa thủ công sau C5.1B.

Blocker:

- Verification fail ở allowlist/realtime/replica identity/helper function/RLS.
- User yêu cầu apply SQL ngay trong C5.2B.
- Cần tạo final apply SQL nhưng output verification chưa đủ rõ.

Nếu có blocker: NEEDS REVIEW, không commit, không push, không sang C5.2C.

## 21. Next recommendation

Nếu PASS:

- User có thể chạy read-only verification SQL trong Supabase.
- Nếu verification pass: tiếp theo là C5.2C runtime guarded bridge.
- Nếu verification fail: cần C5.2B-Apply manual SQL pack/user approval trước C5.2C.

Không sang C5.2C runtime nếu readiness chưa rõ.

