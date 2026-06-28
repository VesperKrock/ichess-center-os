# C5.3D - Conflict marker/UI tối thiểu cho nghiệp vụ realtime nhạy cảm

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE
RUNTIME CHANGE: YES, CONFLICT MARKER ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
ROLLBACK_EXECUTION: NO
CONFLICT_RESOLUTION: NO
DATA_MUTATION: CONFLICT_MARKER_ONLY
ATTENDANCE_TO_TUITION_AUTO_LINK: NO
TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.3D

C5.3D implement conflict marker/UI tối thiểu cho nghiệp vụ realtime nhạy cảm, ưu tiên `tuition_record_package` vì Học phí/TBHP là entity rủi ro cao và đã có audit log C5.3C.

C5.3D chỉ đánh dấu/cảnh báo conflict. Không tự resolve conflict, không rollback, không chọn local/cloud thay user.

## 2. Trạng thái trước C5.3D

Trước C5.3D:

- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Worktree có C5.3A/B/C files expected, chưa commit C5.3.

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

## 3. C5.3C manual QA PASS

User xác nhận C5.3C manual QA PASS:

- Supabase có row `entity_type = audit_log_entry`.
- `payload.entityType = tuition_record_package`.
- `local_id` bắt đầu bằng `audit-log-entry::dreamhome::tuition-record-package`.
- Có console warning 400/WebSocket nhưng non-blocking.
- App vẫn lưu Học phí.
- Audit log vẫn ghi được.

Không cần hotfix C5.3C.1 trước C5.3D.

## 4. Files runtime đã tạo/sửa

Runtime helper mới:

- `src/cloud-conflict-markers.js`

Runtime files đã sửa:

- `src/cloud-tuition-record-package-bridge.js`
- `src/tuition-module.js`
- `src/styles.css`

Docs/test mới:

- `docs/supabase-c5-3d-conflict-marker-ui-toi-thieu.md`
- `tests/supabase-c5-3d-conflict-marker-ui-toi-thieu-smoke.js`

## 5. Entity ưu tiên

Entity ưu tiên:

```txt
tuition_record_package
```

C5.3D chưa mở rộng conflict UI cho `attendance_record`, `session_report`, `schedule_session`, `student` hoặc `teacher`.

## 6. Sensitive fields

Sensitive fields Học phí/TBHP:

```txt
totalSessions
usedSessions
remainingSessions
tuitionAmount
totalAmount
discountAmount
paidAmount
debtAmount
paymentStatus
payments
currentTermId
currentTermNumber
termHistory
status
```

Các field này liên quan tiền/buổi/thanh toán/nợ/gói học phí, nên C5.3D không overwrite bừa khi local/cloud khác nhau.

## 7. Conflict detection rule

Rule tối thiểu:

- Nếu chỉ cloud có record: import cloud.
- Nếu chỉ local có record: giữ local.
- Nếu cả hai có cùng `local_id` và cloud mới hơn nhưng khác local ở sensitive fields: không overwrite sensitive fields bừa.
- Gắn `syncConflict: true` và `conflictMarker` lên local record.
- Giữ bản local hiện tại cho UI.
- Lưu cloud snapshot trong conflict marker để admin xem ở phase sau.

Không tự resolve conflict tài chính.

## 8. Conflict marker shape

Marker shape:

```js
{
  syncConflict: true,
  conflictType: 'tuition_record_package',
  conflictSeverity: 'A',
  conflictReason: 'sensitive_fields_changed_on_both_sides',
  conflictFields: ['paidAmount', 'payments'],
  localUpdatedAt: '...',
  cloudUpdatedAt: '...',
  localSnapshot: {},
  cloudSnapshot: {},
  detectedAt: '...',
  source: 'c5.3d'
}
```

Runtime dùng `src/cloud-conflict-markers.js` để build và normalize marker.

## 9. Severity model

C5.3D implement severity A tối thiểu:

- A: tiền/buổi/thanh toán/nợ/gói học phí, không overwrite, cần admin xem.
- B: metadata quan trọng nhưng không tiền/buổi, để phase sau.
- C: metadata nhẹ, có thể updatedAt wins nếu an toàn ở phase sau.

## 10. UI marker tối thiểu

UI Học phí hiển thị badge:

```txt
Có xung đột dữ liệu
```

Badge nằm trong cột Gói của bảng Học phí khi record có `syncConflict` hoặc `conflictMarker.syncConflict`.

Tooltip giải thích:

```txt
Dữ liệu cloud/local khác nhau ở trường nhạy cảm
```

Không có nút chọn local/cloud, không có resolver và không có rollback UI.

## 11. Audit log relation nếu có

C5.3D chưa ghi audit action `merge_conflict`. Lý do: conflict detection nằm trong merge realtime/pull, còn audit helper C5.3C đang hook rõ nhất ở write-through Học phí. Ghi audit conflict sẽ mở thêm boundary async cần QA riêng.

Limitation này nên xử lý ở C5.3D.1 hoặc C5.3E nếu user muốn audit cả conflict detection.

## 12. Những gì C5.3D không làm

C5.3D không làm:

- Không SQL.
- Không Supabase dashboard action.
- Không rollback preview UI.
- Không rollback apply.
- Không restore record.
- Không batch rollback.
- Không resolve conflict.
- Không chọn local/cloud thay user.
- Không hard delete.
- Không sync all modules đại trà.
- Không enable teacher/consultant direct write.

## 13. Không rollback execution

ROLLBACK_EXECUTION: NO.

C5.3D không chạy rollback và không tạo rollback executor.

## 14. Không conflict resolver

CONFLICT_RESOLUTION: NO.

C5.3D chỉ cảnh báo. Admin xử lý thủ công ở phase sau khi có resolver/rollback preview được thiết kế riêng.

## 15. Không attendance -> tuition auto-link

ATTENDANCE_TO_TUITION_AUTO_LINK: NO.

C5.3D không nối attendance sang học phí, không tự cập nhật `usedSessions` từ attendance và không tự cập nhật `remainingSessions` từ attendance.

## 16. Manual QA plan

Manual QA tối thiểu:

1. Mở app local bằng hai browser T/P nếu có thể.
2. Chọn cùng một record Học phí.
3. Sửa field nhạy cảm ở T, ví dụ `paidAmount` hoặc `payments`.
4. Sửa field nhạy cảm khác ở P gần cùng thời điểm nếu UI cho phép.
5. Quan sát app không crash.
6. Nếu conflict được phát hiện, UI hiển thị `Có xung đột dữ liệu`.
7. Dữ liệu tiền/buổi không bị overwrite bừa.
8. Không có rollback/resolver trong C5.3D.
9. Nếu không tạo được conflict thật bằng tay, ghi `NOT TESTED`, không bịa pass.

Vì conflict thật khó tái hiện thủ công, static/runtime smoke PASS là điều kiện kỹ thuật; manual conflict reproduction có thể `NOT TESTED`.

## 17. Risks / limitations

Risks / limitations:

- Conflict marker chỉ hook `tuition_record_package`.
- Conflict detection thận trọng nên có thể giữ local và cảnh báo khi cloud khác field nhạy cảm.
- Chưa có resolver để admin chọn bản đúng.
- Chưa có rollback preview/apply.
- Chưa ghi audit action `merge_conflict`.
- Chưa hook attendance/session_report/schedule_session.
- Manual conflict reproduction có thể khó tái hiện và cần QA hai browser.

## 18. Next recommendation

Nếu C5.3D PASS: user chạy manual QA conflict marker nếu có thể.

Nếu manual QA pass hoặc accepted limitation: sang C5.3E rollback preview only hoặc C5.3E checkpoint review tùy roadmap.
