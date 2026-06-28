# C5.3F - Checkpoint review audit log / conflict marker / rollback preview

C5.3F STATUS: CHECKPOINT REVIEW ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
ROLLBACK_EXECUTION: NO
ROLLBACK_APPLY: NO
CONFLICT_RESOLUTION: NO
ATTENDANCE_TO_TUITION_AUTO_LINK: NO
TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.3F

C5.3F tổng hợp checkpoint toàn bộ C5.3A/B/C/D/E cho audit log, conflict marker và rollback preview. Pha này xác nhận trạng thái manual QA, accepted limitations và điều kiện đi tiếp C5.3G commit local checkpoint.

C5.3F không runtime, không SQL, không Supabase action, không commit và không push.

## 2. Trạng thái trước C5.3F

Git trước C5.3F:

- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Worktree: có C5.3A/B/C/D/E docs/tests/sql/runtime expected, chưa commit C5.3.

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

C5.3E bổ sung rollback preview only, đã QA pass.

## 3. Tóm tắt C5.3A

C5.3A thiết kế audit log / conflict / rollback.

Kết luận chính:

- Chưa có audit log production-level dùng chung.
- Conflict hiện tại chủ yếu dựa `updatedAt`.
- Rollback thật chưa có.
- Entity rủi ro cao: `tuition_record_package`, `attendance_record`, `session_report`.
- Entity trung bình: `schedule_session`, `attendance_baseline_state`.
- Entity thấp hơn: `student`, `teacher`.

C5.3A chỉ design/audit, không runtime, không SQL, không Supabase action.

## 4. Tóm tắt C5.3B

C5.3B tạo SQL/readiness pack thủ công cho audit/conflict/rollback.

Kết quả:

- Tạo read-only verification SQL.
- Tạo final apply SQL manual-only để bổ sung `audit_log_entry` vào allowlist nếu thiếu.
- Không chạy SQL bởi Codex.
- Không runtime.
- Không commit/push.

## 5. Tóm tắt C5.3B Apply/Verify

User đã apply thủ công và verify PASS.

Verification sau apply:

- `allowlist_has_audit_log_entry: true`
- `realtime_has_center_cloud_entities: true`
- `replica_identity_full: true`
- `has_can_write_center: true`
- `has_is_center_member: true`

Kết luận: Supabase sẵn sàng nhận `entity_type = audit_log_entry`.

## 6. Tóm tắt C5.3C

Runtime helper:

- `src/cloud-audit-log.js`

Entity:

- `audit_log_entry`

Storage:

- `center_cloud_entities`

local_id:

```txt
audit-log-entry::<centerId>::<entityType>::<entityLocalId>::<createdAt>::<shortRandom>
```

Hooked entity:

- `tuition_record_package`

Behavior:

- Append-only audit log.
- Guarded theo signed-in/center/cloud/role.
- Non-blocking: audit fail không làm fail nghiệp vụ chính.
- Loop guard: không audit chính `audit_log_entry`.
- Không conflict UI.
- Không rollback execution.
- Không teacher/consultant direct write.

## 7. Tóm tắt C5.3C manual QA

User đã xác nhận:

- Sửa Học phí xong Supabase có row `audit_log_entry`.
- `payload.entityType = tuition_record_package`.
- `local_id` bắt đầu bằng `audit-log-entry::dreamhome::tuition-record-package`.
- Có console 400/WebSocket warning nhưng non-blocking.
- App vẫn lưu Học phí.
- Audit log vẫn ghi được.

Kết luận:

```txt
C5.3C manual QA: PASS WITH NON-BLOCKING CONSOLE WARNING.
```

## 8. Tóm tắt C5.3D

Runtime helper:

- `src/cloud-conflict-markers.js`

Hook:

- `src/cloud-tuition-record-package-bridge.js`

UI:

- `src/tuition-module.js`
- `src/styles.css`

Behavior:

- `tuition_record_package` có conflict marker tối thiểu.
- Sensitive fields gồm `usedSessions`, `paidAmount`, `payments`, `totalSessions`, `totalAmount`, `discountAmount`, `termHistory`.
- Nếu local/cloud khác nhau ở field nhạy cảm, giữ local và gắn marker.
- UI có badge `Có xung đột dữ liệu`.
- Không resolver.
- Không rollback.

Accepted limitation:

- Conflict thật khó tái hiện thủ công, có thể `NOT TESTED / accepted limitation`.

## 9. Tóm tắt C5.3E

Runtime helper:

- `src/cloud-rollback-preview.js`

Hook/UI:

- `src/main.js`
- `src/tuition-module.js`
- `src/styles.css`

Behavior:

- Rollback preview chỉ đọc `audit_log_entry`.
- Có role guard admin-style.
- Có preview model `beforePayload` / `afterPayload` / `changedFields` / `diffSummary` / `previewOnly`.
- Không có apply rollback.
- Không mutate dữ liệu.

## 10. Tóm tắt C5.3E manual QA

User đã xác nhận bằng UI:

- Có panel `Lịch sử thay đổi`.
- Có dòng `Chỉ xem trước, chưa khôi phục dữ liệu`.
- Có `Bản xem trước khôi phục`.
- Có before/after cho note: `Không có gì` -> `cute phố mai que`.
- Có before/after `updatedAt`.
- Chỉ có nút `Đóng`.
- Không có nút Khôi phục / Áp dụng rollback / Chọn bản này.

Kết luận:

```txt
C5.3E manual QA: PASS.
```

## 11. Runtime hiện tại

Runtime C5.3 hiện có:

- `src/cloud-audit-log.js`: audit log write-through tối thiểu.
- `src/cloud-conflict-markers.js`: conflict marker helper cho học phí.
- `src/cloud-rollback-preview.js`: rollback preview only, read-only.
- `src/cloud-tuition-record-package-bridge.js`: merge guard cho `tuition_record_package`.
- `src/main.js`: hook audit log và rollback preview state/load.
- `src/tuition-module.js`: badge conflict và panel lịch sử thay đổi.
- `src/styles.css`: styling cho conflict badge và rollback preview panel.

C5.3F không thay đổi runtime.

## 12. Data model / entity

C5.3 dùng các entity/model chính:

- Audit entity: `audit_log_entry`
- Business entity ưu tiên: `tuition_record_package`
- Storage: `center_cloud_entities`
- Audit payload fields: `entityType`, `entityLocalId`, `action`, `actorRole`, `beforePayload`, `afterPayload`, `changedFields`, `createdAt`, `previewOnly` ở preview model.

## 13. Audit log behavior

Audit log behavior:

- Append-only.
- Ghi `audit_log_entry` sau cloud write-through học phí thành công.
- `local_id` có random suffix để không ghi đè audit cũ.
- Guarded theo role admin-style.
- Non-blocking.
- Không audit `audit_log_entry` để tránh loop.

## 14. Conflict marker behavior

Conflict marker behavior:

- Ưu tiên `tuition_record_package`.
- Sensitive fields: tiền/buổi/thanh toán/nợ/gói.
- Khi local/cloud khác nhau ở field nhạy cảm, giữ local, gắn `syncConflict` và `conflictMarker`.
- UI chỉ hiển thị badge `Có xung đột dữ liệu`.
- Không tự resolve conflict tài chính.

## 15. Rollback preview behavior

Rollback preview behavior:

- Chỉ đọc `audit_log_entry`.
- UI `Lịch sử thay đổi` hiển thị action, role, thời gian, changed fields và before/after summary.
- Panel chỉ có nút đóng.
- Không có apply rollback.
- Không mutate dữ liệu học phí.

## 16. Role guard

Admin-style roles:

```txt
owner
qtv
center_admin
admin
```

Teacher/consultant direct write: HOLD.

Teacher/consultant không được mở direct write/rollback trong C5.3.

## 17. Những gì C5.3 không làm

C5.3 không làm:

- Không rollback apply.
- Không restore record.
- Không conflict resolver.
- Không batch rollback.
- Không audit toàn bộ entity khác ngoài `tuition_record_package` trong phase này.
- Không mở teacher/consultant direct write.
- Không attendance -> tuition auto-link.
- Không tự cập nhật `usedSessions`/`remainingSessions` từ attendance.
- Không hard delete cloud/local.
- Không seed đè dữ liệu.

## 18. Accepted limitations

Accepted limitations:

- Console 400/WebSocket warning ở C5.3C là non-blocking; audit log vẫn ghi được và app vẫn lưu Học phí.
- Conflict reproduction thật có thể `NOT TESTED / accepted limitation` vì khó tái hiện thủ công.
- Rollback preview query hiện đọc audit entries gần nhất rồi lọc client-side; phase sau nên tối ưu query/index nếu audit log lớn.
- Entity coverage hiện ưu tiên `tuition_record_package`; attendance/session_report/schedule_session chưa được mở rộng.
- Rollback apply chưa có và không thuộc C5.3.

## 19. Risks còn lại

Risks còn lại:

- Chưa có conflict resolver production.
- Chưa có rollback apply nhiều bước.
- Chưa có audit conflict action `merge_conflict`.
- Chưa audit đầy đủ các entity nhạy cảm khác.
- Live QA hai browser cho conflict thật có thể cần phase riêng.

Không phát hiện blocker buộc dừng C5.3F.

## 20. PASS / NEEDS REVIEW criteria

PASS khi:

- C5.3A/B/C/D/E docs/tests tồn tại.
- C5.3F checkpoint docs/test tồn tại.
- Manual QA C5.3C ghi đúng: PASS WITH NON-BLOCKING CONSOLE WARNING.
- Manual QA C5.3E ghi đúng: PASS.
- Conflict reproduction limitation được ghi rõ, không coi nhầm là blocker.
- Không runtime change trong C5.3F.
- Không SQL, không Supabase action, không commit, không push.
- Không rollback apply.
- Không conflict resolution.
- Không attendance-to-tuition auto-link.
- Không usedSessions/remainingSessions auto update từ attendance.
- Teacher/consultant direct write vẫn HOLD.

NEEDS REVIEW nếu:

- Thiếu C5.3 helper/runtime file quan trọng.
- Smoke/build/check fail thật.
- Có runtime change ngoài scope C5.3F.
- Phát hiện rollback apply/restore/conflict resolver đã được thêm ngoài scope.
- Phát hiện attendance tự động tác động học phí.

## 21. Recommendation

GO for C5.3G - Commit local C5.3 checkpoint.

No push unless user explicitly requests.

After C5.3G, next roadmap can proceed to C6 production planning.

## 22. Next roadmap

Roadmap đề xuất:

- C5.3G: commit local C5.3 checkpoint.
- Không push nếu user chưa yêu cầu.
- Sau C5.3G: mở C6 production planning.
- Phase sau nếu cần: conflict resolver, rollback apply nhiều bước, audit mở rộng sang attendance/session_report/schedule_session, query/index optimization cho audit log.
