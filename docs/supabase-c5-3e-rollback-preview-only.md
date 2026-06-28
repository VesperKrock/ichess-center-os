# C5.3E - Rollback preview only cho nghiệp vụ realtime nhạy cảm

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE
RUNTIME CHANGE: YES, ROLLBACK PREVIEW ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
ROLLBACK_EXECUTION: NO
ROLLBACK_APPLY: NO
CONFLICT_RESOLUTION: NO
DATA_MUTATION: NO
ATTENDANCE_TO_TUITION_AUTO_LINK: NO
TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.3E

C5.3E implement rollback preview only cho nghiệp vụ realtime nhạy cảm, ưu tiên `tuition_record_package` / Học phí. Pha này cho admin xem audit snapshot trước/sau từ `audit_log_entry`.

C5.3E chỉ xem trước. Không khôi phục dữ liệu, không ghi ngược dữ liệu, không tự resolve conflict và không rollback thật.

## 2. Trạng thái trước C5.3E

Trước C5.3E:

- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Worktree có C5.3A/B/C/D files expected, chưa commit C5.3.

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

C5.3C bổ sung runtime audit_log_entry write-through tối thiểu, đã QA pass.

C5.3D bổ sung conflict marker/UI tối thiểu cho tuition_record_package.

## 3. C5.3C manual QA PASS

User đã xác nhận C5.3C manual QA PASS:

- Supabase có row `entity_type = audit_log_entry`.
- `payload.entityType = tuition_record_package`.
- `local_id` bắt đầu bằng `audit-log-entry::dreamhome::tuition-record-package`.
- Có console warning 400/WebSocket nhưng non-blocking.
- App vẫn lưu Học phí.
- Audit log vẫn ghi được.

## 4. C5.3D conflict marker PASS

C5.3D đã PASS:

- Có conflict marker helper.
- Có hook `tuition_record_package`.
- Có badge UI `Có xung đột dữ liệu`.
- Không rollback.
- Không conflict resolver.
- Không SQL.
- Không commit/push.

## 5. Files runtime đã tạo/sửa

Runtime helper mới:

- `src/cloud-rollback-preview.js`

Runtime/UI files đã sửa:

- `src/main.js`
- `src/tuition-module.js`
- `src/styles.css`

Docs/test mới:

- `docs/supabase-c5-3e-rollback-preview-only.md`
- `tests/supabase-c5-3e-rollback-preview-only-smoke.js`

## 6. Entity ưu tiên

Entity ưu tiên:

```txt
tuition_record_package
```

C5.3E chưa hỗ trợ preview cho attendance/session_report/schedule_session/student/teacher.

## 7. Nguồn audit_log_entry

Preview đọc từ:

```txt
center_cloud_entities
entity_type = audit_log_entry
payload.entityType = tuition_record_package
payload.entityLocalId = tuition_record_package::<record.id>
payload.beforePayload
payload.afterPayload
payload.changedFields
payload.action
payload.actorRole
payload.createdAt
```

Helper chỉ đọc audit log đã có từ C5.3C. Không backfill audit log cũ.

## 8. Rollback preview model

Preview object:

```js
{
  canPreview: true,
  entityType: 'tuition_record_package',
  entityLocalId: 'tuition_record_package::<record.id>',
  auditEntryId: '...',
  action: 'update',
  actorRole: 'admin',
  auditCreatedAt: '...',
  beforePayload: {},
  afterPayload: {},
  changedFields: [],
  diffSummary: [],
  previewOnly: true,
  source: 'c5.3e'
}
```

Không có `applyRollback`, `restoreRecord` hoặc `commitRollback`.

## 9. Read-only guard

Helper `src/cloud-rollback-preview.js` chỉ đọc:

- `.select(...)`
- `.eq(...)`
- `.order(...)`
- `.limit(...)`

Helper không mutate localStorage, không mutate cloud, không gọi insert/update/delete/upsert, không apply rollback và không restore record.

## 10. Role guard

Rollback preview chỉ cho admin-style roles:

```txt
owner
qtv
center_admin
admin
```

Teacher/consultant/viewer không được xem preview nhạy cảm. TEACHER_CONSULTANT_DIRECT_WRITE: HOLD.

## 11. UI preview tối thiểu

UI Học phí thêm nút:

```txt
Xem lịch sử
```

Panel chỉ đọc hiển thị:

- `Lịch sử thay đổi`
- `Bản xem trước khôi phục`
- `Chỉ xem trước, chưa khôi phục dữ liệu`
- action
- actorRole
- thời gian audit
- changedFields
- diff summary `Trước thay đổi` / `Sau thay đổi`

Panel chỉ có nút đóng. Không có nút khôi phục, không có nút áp dụng rollback và không có nút chọn bản local/cloud.

## 12. Diff/summary logic

Nếu có `beforePayload` và `afterPayload`, helper so sánh shallow các field top-level.

Nếu chỉ có `afterPayload`, UI hiển thị fallback an toàn và ghi rõ không có snapshot đủ để so sánh.

Nếu audit entry thiếu field, UI không crash và hiển thị fallback tiếng Việt.

## 13. Những gì C5.3E không làm

C5.3E không làm:

- Không SQL.
- Không Supabase dashboard action.
- Không rollback apply.
- Không restore record.
- Không batch rollback.
- Không conflict resolver.
- Không chọn local/cloud thay user.
- Không hard delete.
- Không reset localStorage.
- Không seed đè dữ liệu.
- Không mutate dữ liệu nghiệp vụ từ rollback preview.

## 14. Không rollback execution

ROLLBACK_EXECUTION: NO.

C5.3E không chạy rollback và không tạo flow apply.

## 15. Không conflict resolver

CONFLICT_RESOLUTION: NO.

C5.3E chỉ xem lịch sử/audit snapshot, không tự giải quyết conflict và không chọn bản nào thắng.

## 16. Không attendance -> tuition auto-link

ATTENDANCE_TO_TUITION_AUTO_LINK: NO.

C5.3E không nối attendance sang học phí, không tự cập nhật `usedSessions` từ attendance và không tự cập nhật `remainingSessions` từ attendance.

## 17. Manual QA plan

Manual QA tối thiểu:

1. Mở app local bằng account admin-style.
2. Mở Học phí.
3. Chọn record đã từng sửa sau C5.3C để có `audit_log_entry`.
4. Bấm `Xem lịch sử`.
5. Kiểm tra panel chỉ hiển thị dữ liệu, không có nút khôi phục.
6. Kiểm tra có thông tin audit_log_entry.
7. Kiểm tra payload entity là `tuition_record_package`.
8. Kiểm tra before/after hoặc fallback hiển thị an toàn.
9. Bấm đóng preview.
10. Kiểm tra dữ liệu Học phí không bị thay đổi.

## 18. Risks / limitations

Risks / limitations:

- Preview chỉ hỗ trợ `tuition_record_package`.
- Preview chỉ có dữ liệu nếu C5.3C đã ghi audit log cho record đó.
- Query hiện đọc các audit log gần nhất rồi lọc client-side theo `entityLocalId`; nếu audit log tăng lớn, phase sau nên thêm query/index chuyên biệt.
- Chưa có rollback apply.
- Chưa có conflict resolver.
- Chưa QA live Supabase bởi Codex.

## 19. Next recommendation

Nếu C5.3E PASS: user chạy manual QA rollback preview.

Nếu manual QA pass/accepted: sang C5.3F checkpoint review.
