# C5.3C - Runtime audit log write-through tối thiểu

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE
RUNTIME CHANGE: YES, AUDIT LOG ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
ROLLBACK_EXECUTION: NO
CONFLICT_UI: NO
DATA_MUTATION: AUDIT_LOG_ENTRY ONLY
ATTENDANCE_TO_TUITION_AUTO_LINK: NO
TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.3C

C5.3C implement runtime audit log write-through tối thiểu cho nghiệp vụ realtime nhạy cảm. Pha này chỉ thêm audit log runtime an toàn, non-blocking, guarded, ghi entity `audit_log_entry` vào `center_cloud_entities`.

C5.3C không làm conflict UI, không rollback preview/apply, không tự resolve conflict và không tự rollback.

## 2. Trạng thái trước C5.3C

Trước C5.3C:

- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Worktree có C5.3A/B docs/tests/sql expected, chưa commit C5.3.

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

C5.3B bổ sung allowlist readiness cho audit_log_entry sau khi user apply thủ công.

## 3. C5.3B apply/verify PASS

User đã apply thủ công `docs/supabase-c5-3b-final-apply-audit-conflict-rollback.sql` và verify PASS:

- `allowlist_has_audit_log_entry: true`
- `realtime_has_center_cloud_entities: true`
- `replica_identity_full: true`
- `has_can_write_center: true`
- `has_is_center_member: true`

Không cần SQL thêm trong C5.3C.

## 4. Files runtime đã tạo/sửa

Runtime helper mới:

- `src/cloud-audit-log.js`

Runtime hook đã sửa:

- `src/main.js`

Không sửa SQL, không sửa Supabase dashboard, không thêm conflict UI hoặc rollback UI.

## 5. Entity audit_log_entry

Audit log dùng:

- Entity type: `audit_log_entry`
- Storage: `public.center_cloud_entities`
- Source module: `audit_log`
- Source version: `c5-3c-audit-log-v1`

Không tạo bảng mới trong C5.3C.

## 6. Audit payload model

Payload audit tối thiểu:

```txt
id
centerId
entityType
entityLocalId
action
actorUserId
actorRole
beforePayload
afterPayload
changedFields
reason
source
createdAt
correlationId
clientId
schemaVersion
```

Trong C5.3C, `source = runtime/c5.3c` và `schemaVersion = 1`.

## 7. local_id strategy

Audit log entry dùng append-only local_id:

```txt
audit-log-entry::<centerId>::<entityType>::<entityLocalId>::<createdAt>::<shortRandom>
```

Mỗi audit entry có random suffix nên không upsert đè audit log cũ.

## 8. Guard conditions

Audit write chỉ chạy khi:

- Supabase client ready.
- User signed-in.
- `centerId` ready.
- Role hợp lệ.
- Entity/action nằm trong audit allowlist.
- Không audit chính `audit_log_entry`.

Nếu không đủ điều kiện, helper trả skip result và không throw crash.

## 9. Role guard

Role write audit hợp lệ:

```txt
owner
qtv
center_admin
admin
```

Teacher/consultant direct write HOLD.

## 10. Non-blocking behavior

Audit write chạy sau cloud write-through học phí thành công và không chặn thao tác chính. Nếu audit fail, runtime chỉ `console.warn` nhẹ:

```txt
C5.3C audit_log_entry write failed; tuition save remains local/cloud safe.
```

Audit fail không rollback học phí, không làm UI save flow crash.

## 11. Hook đã implement

C5.3C hook tối thiểu vào `tuition_record_package`:

- `tuition-package-save`
- `tuition-payment-save`

Hook được gọi từ `writeC52TuitionRecordPackageThroughCloud` sau khi `upsertC52TuitionRecordPackageCloudEntities` trả `ok`.

## 12. Entity đã audit

Entity đã audit trong C5.3C:

```txt
tuition_record_package
```

Audit payload có:

- `entityType = tuition_record_package`
- `entityLocalId = tuition_record_package::<record.id>`
- `action = create`, `update`, hoặc `payment_update`
- `beforePayload` nếu có snapshot cũ an toàn
- `afterPayload` là record học phí hiện tại
- `changedFields` tính shallow theo field top-level

## 13. Entity chưa audit / limitations

C5.3C chưa hook các entity sau:

- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `schedule_session`
- `student`
- `teacher`

Lý do: C5.3C ưu tiên hook tối thiểu vào học phí/TBHP vì boundary rõ và rủi ro nghiệp vụ cao. Mở rộng attendance/session_report/schedule_session nên làm ở C5.3C.1 hoặc C5.3D sau khi có QA riêng.

## 14. Loop guard

Runtime helper có guard:

```txt
if entityType === audit_log_entry then skip
```

Điều này tránh audit chính audit log và tránh vòng lặp vô hạn.

## 15. Không conflict UI trong C5.3C

CONFLICT_UI: NO.

C5.3C không thêm conflict UI, không tự resolve conflict và không đổi merge logic hiện tại.

## 16. Không rollback execution trong C5.3C

ROLLBACK_EXECUTION: NO.

C5.3C không tạo rollback executor, không rollback preview UI và không rollback apply.

## 17. Không attendance -> tuition auto-link

ATTENDANCE_TO_TUITION_AUTO_LINK: NO.

C5.3C không nối attendance sang học phí, không tự cập nhật `usedSessions` từ attendance và không tự cập nhật `remainingSessions` từ attendance.

## 18. Manual QA plan C5.3C

QA thủ công đề xuất:

1. User mở app local với account admin-style.
2. Mở Học phí.
3. Sửa một record học phí an toàn.
4. Kiểm tra thao tác Học phí vẫn lưu bình thường.
5. Mở Supabase `center_cloud_entities`.
6. Filter `entity_type = audit_log_entry`.
7. Kỳ vọng có row `audit_log_entry` mới.
8. `local_id` bắt đầu bằng `audit-log-entry::`.
9. `payload.entityType = tuition_record_package`.
10. `payload.entityLocalId` dạng `tuition_record_package::<record.id>`.
11. Nếu audit fail/cloud unavailable, Học phí không được crash.

## 19. Risks / limitations

Risks / limitations:

- Chưa có audit UI.
- Chưa có conflict UI.
- Chưa có rollback preview/apply.
- Chưa audit attendance/session_report/schedule_session.
- `changedFields` hiện là top-level shallow diff.
- `beforePayload` chỉ có khi form/payment handler có snapshot cũ an toàn.
- Live Supabase QA chưa chạy bởi Codex.

## 20. Next recommendation

Nếu C5.3C PASS: user chạy manual QA audit log trên Supabase.

Nếu QA pass: tiếp theo có thể làm C5.3D conflict marker/UI tối thiểu hoặc C5.3C.1 mở rộng audit sang attendance/session_report/schedule_session.
