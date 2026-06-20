# F19H.2b.1 - Allowlist Patch cho Cloud Attendance Record

## 1. Mục tiêu

Chuẩn bị patch để mở allowlist entity `attendance_record` cho bảng generic `center_cloud_entities`, sau F19H.2b dry-run.

Phase này chỉ tạo patch/document/test. Không chạy SQL lên Supabase, không real push/pull cloud, không auto sync, không sửa UI vận hành.

## 2. Current State

Cloud C2/C2.3 hiện đang chạy ổn với 3 entity:

- `student`
- `teacher`
- `class_session`

SQL C1/C2.2 hiện có check constraint giới hạn `entity_type` trong 3 giá trị trên. Vì vậy F19H.2b dry-run đang báo đúng trạng thái:

```txt
NEEDS SQL/ALLOWLIST PATCH
```

App-side attendance alpha đã có helper riêng trong `src/cloud-attendance-records.js` để nhận biết `attendance_record`, nhưng core C2 auto/push/pull vẫn giữ nguyên 3 entity cũ.

## 3. Entity Được Thêm

Entity mới:

```txt
attendance_record
```

Các entity cũ phải giữ nguyên:

```txt
student
teacher
class_session
```

Không thêm `session_report`, `schedule_session`, `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment`, hoặc deadline state trong patch này.

## 4. SQL Patch Path

Patch file:

```txt
docs/supabase-f19h2b1-attendance-record-allowlist.sql
```

Patch làm đúng một việc: thay check constraint `center_cloud_entities_entity_type_check` để cho phép:

```txt
student
teacher
class_session
attendance_record
```

Patch không tạo bảng mới, không đổi RLS policy, không grant thêm quyền mới, không seed data, không push/pull cloud.

## 5. Cách Apply Thủ Công Sau Review

1. Đảm bảo F19H.2b dry-run smoke pass ở local.
2. Mở Supabase Dashboard.
3. Mở SQL Editor.
4. Copy nội dung `docs/supabase-f19h2b1-attendance-record-allowlist.sql`.
5. Chạy thủ công sau khi review.
6. Không chạy patch này từ frontend.
7. Không chạy nếu chưa backup/ghi chú trạng thái cloud hiện tại.

Sau khi apply, phase sau F19H.2b.2 mới được xác thực remote readiness và cân nhắc real push/pull thủ công.

## 6. Cách Kiểm Readiness Sau Khi Apply

Trong phase sau:

- Kiểm tra `checkCloudDbReadiness` vẫn pass.
- Kiểm tra entity core C2 cũ vẫn đọc/ghi được: `student`, `teacher`, `class_session`.
- Kiểm tra dry-run `attendance_record` vẫn không ghi cloud.
- Thêm một readiness probe riêng cho `attendance_record` trước khi real push.
- Không tự giả định remote ready chỉ vì file patch tồn tại trong repo.

## 7. Rollback Nếu Patch Sai

Rollback thủ công trong Supabase SQL Editor bằng cách đưa constraint về 3 entity cũ:

```sql
begin;

alter table public.center_cloud_entities
  drop constraint if exists center_cloud_entities_entity_type_check;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_type_check
  check (entity_type in ('student', 'teacher', 'class_session'));

notify pgrst, 'reload schema';

commit;
```

Chỉ rollback sau khi xác nhận không còn row `attendance_record` hoặc đã xử lý dữ liệu liên quan. Không hard delete dữ liệu cloud trong phase này.

## 8. App Allowlist

F19H.2b.1 không nối `attendance_record` vào core C2 auto push/pull.

App-side allowlist hiện tách riêng ở helper attendance alpha:

```txt
src/cloud-attendance-records.js
```

Core C2 trong `src/cloud-db-entities.js` vẫn giữ 3 entity cũ để C2/C2.3 không vỡ. F19H.2b.2 có thể mở bridge runtime thủ công cho `attendance_record` sau khi SQL patch đã apply và readiness probe pass.

## 9. Chưa Làm

- Chưa chạy SQL lên Supabase.
- Chưa tạo bảng mới.
- Chưa real push/pull cloud.
- Chưa auto sync.
- Chưa realtime.
- Chưa auth/role thật.
- Chưa sync `session_report`.
- Chưa sync `schedule_session`.
- Chưa sync Học phí/TBHP.
- Chưa sync deadline state.
- Chưa sửa Module 13 UI.
- Chưa sửa Module 7/TKB behavior.

## 10. Phase Kế Tiếp

```txt
F19H.2b.2 - Real push/pull thủ công cho attendance_record sau khi allowlist ready
```

F19H.2b.2 chỉ nên bắt đầu khi:

- SQL patch đã được apply thủ công và review xong.
- Remote readiness cho `attendance_record` pass thật.
- Dry-run preview sạch.
- Có explicit user action.
- Có backup trước pull.
- Không auto push/pull.
