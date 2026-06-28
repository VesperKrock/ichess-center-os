# C5.3B - Gói SQL/readiness cho audit log / conflict / rollback

SQL APPLY: NO
SUPABASE ACTION: NO
SUPABASE DATA CHANGE BY CODEX: NO
RUNTIME CHANGE: NO
COMMIT: NO
PUSH: NO
ROLLBACK_EXECUTION: NO
DATA_MUTATION: NO
WAITING USER CONFIRMATION BEFORE ANY APPLY

## 1. Mục tiêu C5.3B

C5.3B tạo gói readiness thủ công cho audit log, conflict và rollback. Pha này tạo tài liệu, read-only verification SQL, manual final apply SQL nếu cần và smoke test kiểm tra an toàn.

C5.3B không chạy SQL, không apply SQL, không thao tác Supabase, không runtime, không commit và không push.

## 2. Trạng thái trước C5.3B

Git trước C5.3B:

- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Worktree trước C5.3B: chỉ có 2 file C5.3A mới

File C5.3A hiện có:

- `docs/supabase-c5-3a-thiet-ke-audit-conflict-rollback.md`
- `tests/supabase-c5-3a-thiet-ke-audit-conflict-rollback-smoke.js`

Cloud/core sync entities trước C5.2C:

```txt
student
teacher
class_session
schedule_session
attendance_record
attendance_baseline_state
session_report
```

Realtime subscriptions trước C5.2C:

```txt
student
teacher
schedule_session
attendance_record
attendance_baseline_state
session_report
```

class_session có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.

C5.2C bổ sung runtime bridge/subscription cho tuition_record_package.

## 3. Kết quả C5.3A liên quan SQL/readiness

C5.3A xác nhận:

- Chưa có audit log production-level dùng chung.
- Chỉ có `attendance_baseline_state.auditLog` partial/local và metadata rời rạc.
- Conflict hiện tại chủ yếu merge theo `updatedAt`.
- `attendance_record` có `syncConflict` cơ bản.
- `tuition_record_package` chưa có field-level conflict cho tiền/buổi/payment.
- Chưa có rollback thật.

C5.3A đề xuất hai hướng storage:

- `audit_log` table riêng cho production đầy đủ.
- `audit_log_entry` trong `center_cloud_entities` cho readiness tối thiểu và ít thay đổi hạ tầng hơn.

Quyết định C5.3B: dùng `audit_log_entry` là entity/readiness tối thiểu cho C5.3C audit log write-through. Không tạo `conflict_record` hoặc `rollback_snapshot` trong C5.3B.

## 4. C5.3B không làm gì

C5.3B không làm các việc sau:

- Không chạy SQL.
- Không apply SQL.
- Không sửa Supabase.
- Không gọi Supabase API.
- Không runtime implementation.
- Không sửa `src`.
- Không tạo rollback executor.
- Không chạy rollback.
- Không mutate dữ liệu.
- Không hard delete cloud/local.
- Không reset localStorage.
- Không seed đè dữ liệu.
- Không sync all modules đại trà.
- Không auto-link attendance sang học phí.
- Không tự cập nhật `usedSessions` từ attendance.
- Không tự cập nhật `remainingSessions` từ attendance.
- Không enable teacher/consultant direct write.
- Không commit.
- Không push.

## 5. Readiness cần kiểm tra

Readiness cần user kiểm tra thủ công bằng read-only SQL:

- `public.center_cloud_entities` tồn tại.
- Check constraint `center_cloud_entities_entity_type_check` hiện có allowlist nào.
- Allowlist đã có `audit_log_entry` chưa.
- `supabase_realtime` có `public.center_cloud_entities` chưa.
- Replica identity của `center_cloud_entities` có FULL chưa.
- Helper functions `can_write_center` và `is_center_member` có tồn tại chưa.
- RLS policies hiện có trên `center_cloud_entities`.
- Hiện đã có row `audit_log_entry` nào chưa, chỉ count/read.

## 6. Entity/readiness đề xuất

Entity/readiness đề xuất cho C5.3B:

```txt
audit_log_entry
```

Ý nghĩa:

- `audit_log_entry` là nơi C5.3C có thể ghi audit log write-through tối thiểu.
- Conflict marker giai đoạn đầu vẫn có thể nằm trong payload entity hiện tại.
- Rollback preview sau này có thể đọc `beforePayload`/`afterPayload` từ `audit_log_entry`.
- Không tạo bảng riêng trong C5.3B.
- Không tạo entity `conflict_record`.
- Không tạo entity `rollback_snapshot`.

## 7. Read-only verification SQL

Read-only verification SQL nằm ở:

```txt
docs/supabase-c5-3b-readonly-verify-audit-conflict-rollback.sql
```

File này chỉ chứa query đọc để user copy vào Supabase SQL Editor và tự kiểm tra. C5.3B không chạy file này.

## 8. Expected result

Expected result sau read-only verification:

- `center_cloud_entities_exists = true`
- `allowlist_has_audit_log_entry = true` nếu remote đã sẵn sàng cho C5.3C
- `realtime_has_center_cloud_entities = true`
- `replica_identity_full = true`
- `has_can_write_center = true`
- `has_is_center_member = true`
- RLS policies vẫn theo center membership / admin-style write guard

Nếu `allowlist_has_audit_log_entry = false`, cần user đọc và tự duyệt manual final apply SQL trước khi sang C5.3C.

## 9. Có cần final apply SQL không?

Có, C5.3B tạo manual final apply SQL vì workspace hiện tại chưa có bằng chứng `audit_log_entry` đã nằm trong allowlist của `center_cloud_entities`.

File:

```txt
docs/supabase-c5-3b-final-apply-audit-conflict-rollback.sql
```

File này là manual only. Codex không chạy, không apply và không gọi Supabase.

## 10. Nếu cần final apply SQL thì user apply thế nào

Thứ tự dành cho user:

1. Chạy read-only verify SQL.
2. Nếu `allowlist_has_audit_log_entry = true`, không cần apply final SQL.
3. Nếu `allowlist_has_audit_log_entry = false`, đọc toàn bộ final apply SQL.
4. Chụp screenshot/export constraint hiện tại.
5. User tự apply final SQL trong Supabase SQL Editor nếu đồng ý.
6. Chạy read-only verify lại.
7. Chỉ sang C5.3C khi verify pass.

WAITING USER CONFIRMATION BEFORE ANY APPLY.

## 11. Mục đích SQL

Mục đích read-only SQL:

- Xác nhận Supabase readiness hiện tại cho audit/conflict/rollback.
- Không thay đổi dữ liệu hoặc schema.

Mục đích final apply SQL:

- Bổ sung `audit_log_entry` vào allowlist/check constraint của `center_cloud_entities`.
- Chuẩn bị nơi ghi audit log tối thiểu cho C5.3C.
- Không tạo bảng mới.
- Không mở RLS rộng.
- Không xóa/sửa row hiện có.

## 12. Môi trường

Môi trường dự kiến:

- Supabase project iChess Center OS staging/online alpha hiện tại.
- User tự chạy thủ công trong Supabase SQL Editor nếu cần.
- Codex không chạy SQL và không truy cập Supabase.

## 13. Có phá dữ liệu không

Read-only verification SQL: không phá dữ liệu.

Final apply SQL dự kiến không phá dữ liệu:

- Chỉ thay check constraint allowlist.
- Không xóa row hiện có.
- Không sửa payload hiện có.
- Không hard delete.
- Không seed dữ liệu.

Rủi ro còn lại: nếu remote allowlist thực tế có thêm entity chưa được ghi trong file final apply, việc thay constraint có thể bỏ sót entity đó. Vì vậy user phải chạy verify trước và so sánh constraint hiện tại.

## 14. Có cần backup không

Backup không bắt buộc về mặt kỹ thuật nếu chỉ patch check constraint đúng allowlist, nhưng vẫn khuyến nghị:

- Chụp screenshot/export output constraint hiện tại.
- Lưu output read-only verification trước apply.
- Dừng nếu thấy entity type ngoài allowlist expected.

## 15. Thứ tự chạy

Thứ tự an toàn:

1. User chạy read-only verify SQL.
2. User xác nhận có thiếu `audit_log_entry` không.
3. Nếu thiếu, user đọc final apply SQL.
4. User tự apply nếu đồng ý.
5. User chạy read-only verify lại.
6. User báo kết quả cho C5.3C.

Codex không chạy bất kỳ bước SQL nào trong C5.3B.

## 16. Verification sau apply

Verification sau apply:

- `allowlist_has_audit_log_entry = true`
- Constraint definition có đủ entity:
  - `student`
  - `teacher`
  - `class_session`
  - `schedule_session`
  - `attendance_record`
  - `attendance_baseline_state`
  - `session_report`
  - `tuition_record_package`
  - `audit_log_entry`
- Realtime publication vẫn có `center_cloud_entities`.
- Replica identity vẫn FULL.
- Helper functions vẫn tồn tại.
- RLS policies vẫn không mở teacher/consultant direct write.

## 17. Rollback plan

Rollback plan cho final apply SQL:

- Không rollback dữ liệu.
- Nếu apply sai constraint, dùng SQL rollback comment trong final apply file để trả allowlist về trạng thái trước đó.
- Nếu user đã lưu output preflight, ưu tiên khôi phục theo output đó.
- Không xóa cloud.
- Không hard delete.
- Không reset database.

Rollback execution trong C5.3B: NO.

## 18. RLS/helper function readiness

Readiness cần có:

- `public.is_center_member`
- `public.can_write_center`
- RLS policies trên `center_cloud_entities`
- Write guard theo admin-style role ở app/runtime phase sau

Role guard policy tiếp tục giữ:

```txt
owner
qtv
center_admin
admin
```

Teacher/consultant direct write HOLD.

## 19. Realtime readiness

Realtime readiness cần có:

- `public.center_cloud_entities` trong `supabase_realtime`.
- Runtime C5.3C sau này có thể quyết định audit log cần realtime hay chỉ write/read on demand.

C5.3B không bật realtime bằng Codex và không chạy SQL.

## 20. Replica identity readiness

Replica identity readiness:

- `center_cloud_entities.relreplident = 'f'` tương ứng FULL.
- FULL giúp realtime update/delete context an toàn hơn nếu runtime sau cần đọc old/new row.

C5.3B chỉ cung cấp query kiểm tra, không alter trực tiếp.

## 21. Role guard policy

Role guard policy cho phase sau:

- Chỉ owner/qtv/center_admin/admin được ghi audit log cho sensitive actions nếu action gắn với resolve/rollback.
- Teacher/consultant không được direct write/rollback.
- Read audit log có thể cần policy riêng theo role và module ở C5.3C/D.
- Không mở teacher/consultant direct write trong C5.3B.

## 22. Không runtime trong C5.3B

RUNTIME CHANGE: NO.

C5.3B không sửa `src`. Runtime audit log write-through là C5.3C nếu readiness pass.

## 23. Không rollback execution trong C5.3B

ROLLBACK_EXECUTION: NO.

C5.3B không tạo rollback executor và không chạy rollback thật. Rollback preview/apply là phase sau.

## 24. Risks / blockers

Không phát hiện blocker local trước khi tạo pack.

Risks:

- Live Supabase state không được query bởi Codex trong C5.3B.
- Nếu remote constraint có entity mới ngoài allowlist expected, final apply SQL cần review trước khi user chạy.
- Nếu `audit_log_entry` đã tồn tại remote, không cần final apply.
- Nếu helper/RLS/realtime thiếu, user cần xử lý theo pack/readiness trước C5.3C.

## 25. Next recommendation

Nếu C5.3B PASS:

- User chạy read-only verification SQL.
- Nếu `audit_log_entry` đã ready: GO for C5.3C runtime audit log write-through.
- Nếu thiếu `audit_log_entry`: user đọc/duyệt, tự apply final SQL, verify lại, rồi mới GO for C5.3C.

Không sang C5.3C nếu verification fail hoặc user chưa duyệt/apply SQL cần thiết.
