# C5.3A - Thiết kế audit log / conflict / rollback cho nghiệp vụ realtime nhạy cảm

C5.3A STATUS: DESIGN ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
ROLLBACK_EXECUTION: NO
DATA_MUTATION: NO

## 1. Mục tiêu C5.3A

C5.3A audit/preflight/design cho audit log, conflict handling và rollback an toàn trên các nghiệp vụ realtime nhạy cảm của iChess Center OS.

Mục tiêu là xác định hiện trạng, rủi ro, gap còn lại và thiết kế hướng đi C5.3. Pha này không implement runtime, không tạo SQL apply file, không thao tác Supabase, không sửa dữ liệu và không rollback thật.

## 2. Trạng thái trước C5.3A

Git trước C5.3A:

- Branch: `main`
- Ahead/behind: `main...origin/main [ahead 3]`
- Latest commit: `007a50d C5.2 tuition TBHP cloud source of truth checkpoint`
- Worktree trước C5.3A: clean
- Push: chưa chạy trong C5.3A

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

## 3. Phạm vi entity cần audit

Entity/luồng nhạy cảm đã lên cloud/realtime và cần C5.3 audit:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `tuition_record_package`

Ghi chú riêng: `class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại. Vì vậy C5.3 nên xem `class_session` là scope phụ để tránh overclaim realtime.

## 4. Những gì C5.3A không làm

C5.3A không làm các việc sau:

- Không commit.
- Không push.
- Không SQL.
- Không tạo SQL apply file.
- Không apply SQL.
- Không sửa Supabase.
- Không gọi Supabase API.
- Không runtime implementation.
- Không sửa `src`.
- Không tạo bảng audit thật.
- Không tạo trigger thật.
- Không viết rollback executor thật.
- Không chạy rollback.
- Không sửa dữ liệu cloud/local.
- Không hard delete cloud/local.
- Không reset localStorage.
- Không seed đè dữ liệu.
- Không auto-link attendance sang học phí.
- Không tự cập nhật `usedSessions` từ attendance.
- Không tự cập nhật `remainingSessions` từ attendance.
- Không enable teacher/consultant direct write.

## 5. Audit hiện trạng audit log

Hiện chưa có audit log production-level dùng chung cho các entity realtime nhạy cảm.

Những gì đang có:

- `attendance_baseline_state` có `auditLog` local trong `src/attendance-records.js` và được normalize/build vào payload qua `src/cloud-session-reports.js`.
- Một số entity cloud có metadata `created_by`, `updated_by`, `source_module`, `source_version`, `createdAt`, `updatedAt`.
- Merge/write-through hiện dựa nhiều vào `updatedAt`, `createdAt`, `source`, `syncConflict`, `deleted_at` và console/status message.

Những gì chưa có:

- Chưa có entity/table audit log riêng như `audit_log` hoặc `audit_log_entry`.
- Chưa có before/after snapshot dùng chung.
- Chưa có action type chuẩn dùng chung cho create/update/soft_delete/restore/rollback.
- Chưa có reason bắt buộc khi sửa dữ liệu nhạy cảm.
- Chưa có correlationId/clientId/deviceId.
- Chưa có UI audit timeline cho từng record.
- Actor/userId/role chưa được lưu nhất quán trong mọi payload và mọi entity.

Kết luận: audit log hiện tại là partial/local/entity-specific, chưa đủ cho rollback hoặc điều tra conflict tài chính/điểm danh.

## 6. Audit hiện trạng conflict

Hiện trạng conflict theo runtime audit:

- `student` và `teacher`: realtime merge theo `updatedAt`; chưa có conflict UI riêng.
- `schedule_session`: realtime merge theo `updatedAt`; nếu incoming cũ hơn local thì giữ local; chưa có conflict UI đầy đủ, nhưng có dấu vết `conflictMetadata`/conflicts trong schedule payload/dry-run.
- `attendance_record`: merge theo `updatedAt` khi cùng local id; có marker `syncConflict: true` khi cùng natural key nhưng khác attendance value/source.
- `attendance_baseline_state`: merge theo `updatedAt` hoặc `lastActionAt`; không tự override nếu incoming không mới hơn.
- `session_report`: merge theo `updatedAt`; report attendance vẫn là snapshot, không tự trở thành canonical attendance.
- `tuition_record_package`: merge theo `updatedAt`; cloud soft delete được ghi nhận nhưng local tuition record được giữ lại an toàn; chưa có field-level conflict cho tiền/buổi/thanh toán.

Conflict tiền/buổi/học phí hiện chưa có UI hoặc rule phân giải tài chính. `tuition_record_package` dùng updatedAt wins ở mức record khi incoming mới hơn, nên rủi ro cao nếu hai browser cùng sửa payment/package gần nhau.

Conflict điểm danh hiện có marker cơ bản cho `attendance_record`, nhưng chưa có UI xử lý, chưa có severity và chưa có before/after snapshot chuẩn.

Conflict báo cáo ca dạy hiện chủ yếu là updatedAt wins, trong khi attendance snapshot trong report không phải canonical attendance.

Conflict TKB hiện chủ yếu là updatedAt wins, chưa có UI phân loại conflict nhẹ/nặng.

Kết luận: conflict hiện tại là partial guard, chưa phải conflict management hoàn chỉnh.

## 7. Audit hiện trạng rollback

Hiện chưa có rollback thật cho realtime sensitive entities.

Những gì đang có:

- Local fallback qua localStorage cho nhiều module.
- `attendance_baseline_state` có một số undo/restore local trong baseline workflow.
- Một số merge path giữ local nếu cloud lỗi, cloud trống, incoming cũ hơn hoặc soft delete không an toàn.
- `tuition_record_package` giữ local record khi thấy cloud soft delete.

Những gì chưa có:

- Chưa có backup chuẩn trước pull/merge cho từng entity.
- Chưa có restore single record từ audit snapshot.
- Chưa có rollback preview UI.
- Chưa có rollback apply flow có confirm token.
- Chưa có batch rollback an toàn.
- Chưa có audit trail đủ để tái dựng before/after.

Hard delete risk:

- Runtime hiện tại ưu tiên soft delete qua `deleted_at` hoặc ignore/skip delete ở một số path.
- C5.3 vẫn cần audit sâu các path delete hiện hữu trước khi mở rollback apply.

Rollback không được hiểu là reset database, xóa cloud, restore toàn bộ localStorage bừa, hard delete hoặc seed đè.

## 8. Risk matrix theo entity

| Entity | Mức rủi ro | Lý do | Hiện trạng conflict/rollback |
| --- | --- | --- | --- |
| `tuition_record_package` | Cao | Tiền, thanh toán, nợ, buổi, `usedSessions` | updatedAt merge; chưa có field conflict/audit rollback |
| `attendance_record` | Cao | Điểm danh canonical ảnh hưởng buổi học | Có `syncConflict` cơ bản; chưa có UI/rollback |
| `session_report` | Cao | Báo cáo ca dạy có attendance snapshot | updatedAt merge; snapshot không canonical; chưa rollback |
| `schedule_session` | Trung bình | TKB ảnh hưởng vận hành lớp/giáo viên | updatedAt merge; conflict metadata partial |
| `attendance_baseline_state` | Trung bình | Chốt nền ảnh hưởng trạng thái điểm danh | auditLog local partial; merge theo timestamp |
| `student` | Thấp hơn | Metadata học viên, nhưng vẫn ảnh hưởng liên kết học phí/điểm danh | updatedAt merge; chưa audit log dùng chung |
| `teacher` | Thấp hơn | Metadata giáo viên, ảnh hưởng TKB/báo cáo | updatedAt merge; chưa audit log dùng chung |
| `class_session` | Scope phụ | Cloud/core sync nhưng chưa confirmed dedicated realtime | Không đưa vào realtime overclaim |

Phân loại này giữ đúng yêu cầu: cao cho học phí/thanh toán/nợ/buổi, điểm danh canonical và báo cáo ca dạy; trung bình cho TKB/baseline; thấp hơn cho metadata nếu không trực tiếp động đến tiền/buổi.

## 9. Đề xuất audit log model

C5.3 nên cân nhắc hai hướng storage:

- Table/entity riêng `audit_log`: rõ ràng, query tốt, dễ phân quyền, phù hợp production.
- Entity type trong `center_cloud_entities` như `audit_log_entry`: ít thay đổi hạ tầng hơn, nhưng query/report/audit dài hạn kém hơn.

Field đề xuất:

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
clientId/deviceId
schemaVersion
```

Action đề xuất:

```txt
create
update
soft_delete
restore
merge_conflict
conflict_resolved
rollback_preview
rollback_apply
```

Design preference: C5.3B nên tạo manual SQL/readiness pack để user quyết định `audit_log` riêng hay `audit_log_entry` trong entity table. C5.3A chưa quyết định cứng vì cần xem quyền/RLS/query/audit retention.

## 10. Đề xuất conflict model

Conflict marker tối thiểu:

```txt
syncConflict: true
conflictReason
localUpdatedAt
cloudUpdatedAt
localSnapshot
cloudSnapshot
conflictFields
severity
```

Severity đề xuất:

- A: tiền/buổi/thanh toán/điểm danh canonical, cần user xử lý.
- B: schedule/session/report quan trọng, cần cảnh báo.
- C: metadata ít rủi ro, có thể updatedAt wins nếu an toàn.

Rule đề xuất:

- Không overwrite field tiền/buổi/payment nếu cả local và cloud đều thay đổi.
- Không tự rollback.
- Không hard delete.
- Không tự resolve conflict tài chính.
- Không dùng `session_report` attendance snapshot để ghi ngược canonical attendance.
- Không auto-link attendance sang học phí.
- Không tự cập nhật `usedSessions`/`remainingSessions` từ attendance.

## 11. Đề xuất rollback model

Rollback nên chia 3 cấp:

Level 1 - Preview only:

- Hiển thị record trước/sau từ audit snapshot/backup.
- Không ghi dữ liệu.
- Có thể là phase C5.3E đầu tiên.

Level 2 - Restore single record:

- Khôi phục một record từ audit snapshot/backup.
- Chỉ admin-style role.
- Bắt buộc ghi audit entry `rollback_apply`.

Level 3 - Batch rollback:

- Chỉ làm phase sau.
- Cần dry-run, nhiều bước xác nhận, confirm token và giới hạn scope.

Rollback không được là reset database, xóa cloud, restore toàn bộ localStorage bừa, hard delete hoặc seed đè dữ liệu.

## 12. Đề xuất UI/UX conflict tối thiểu

UI tối thiểu cho C5.3D nên có:

- Badge/cảnh báo conflict trên record nhạy cảm.
- Drawer/modal so sánh local vs cloud theo field.
- Hiển thị severity A/B/C.
- Hiển thị actor/time/source nếu audit log có.
- Nút giữ local, dùng cloud, merge thủ công hoặc defer.
- Với severity A, không cho auto-resolve im lặng.
- Với học phí/thanh toán, bắt buộc reason khi resolve.

UI rollback preview nên tách khỏi conflict resolve để tránh người dùng tưởng đã rollback thật.

## 13. Đề xuất quyền/role guard

Giữ admin-style role guard:

```txt
owner
qtv
center_admin
admin
```

Chỉ các role này mới được:

- Resolve conflict.
- Preview rollback sensitive data.
- Apply rollback nếu phase sau có.

Teacher/consultant direct write HOLD.

Teacher/consultant không được direct write/rollback trong C5.3A design. Nếu mở sau này phải có phase riêng, rule riêng và QA role riêng.

## 14. Đề xuất storage strategy

Storage strategy đề xuất:

- Giữ `center_cloud_entities` cho entity realtime hiện tại.
- Thêm audit storage riêng nếu C5.3B readiness cho thấy phù hợp.
- Nếu dùng `audit_log_entry` trong `center_cloud_entities`, cần entity allowlist/readiness rõ.
- Lưu before/after snapshot đã sanitize.
- Không lưu dữ liệu nhạy cảm ngoài phạm vi cần thiết.
- Có `schemaVersion` để migrate audit payload về sau.
- Có retention/archive policy ở phase sau.

Local fallback:

- Có thể giữ pre-merge local snapshot ngắn hạn trong localStorage/sessionStorage cho preview.
- Không restore toàn bộ localStorage bừa.
- Không hard delete local backup khi chưa có checkpoint.

## 15. Đề xuất SQL/manual pack cho phase sau nếu cần

C5.3B nên là manual SQL/readiness pack, không apply tự động.

Nội dung C5.3B đề xuất:

- Readiness option A: table `audit_log`.
- Readiness option B: entity type `audit_log_entry` trong `center_cloud_entities`.
- RLS role guard theo center membership.
- Read-only verification SQL.
- Realtime publication nếu audit entry cần realtime.
- Index theo `centerId`, `entityType`, `entityLocalId`, `createdAt`, `correlationId`.
- Manual apply instructions và rollback/readiness notes.

C5.3A không tạo SQL file và không chạy SQL.

## 16. Đề xuất runtime phase sau

Roadmap runtime sau C5.3A:

- C5.3B - Manual SQL/readiness pack cho audit log/conflict metadata.
- C5.3B-Verify/Apply - User verify/apply nếu cần.
- C5.3C - Runtime audit log write-through tối thiểu.
- C5.3D - Conflict marker/UI tối thiểu.
- C5.3E - Rollback preview only.
- C5.3F - QA/checkpoint review.
- C5.3G - Commit local C5.3 checkpoint.

Không tự tạo phase sau trong C5.3A.

## 17. Manual QA plan tương lai

Manual QA future plan:

- Hai browser cùng center, cùng role admin-style.
- Tạo/sửa `tuition_record_package` ở browser A, sửa field tiền/buổi ở browser B gần đồng thời.
- Xác nhận severity A không auto-resolve im lặng.
- Tạo/sửa `attendance_record` cùng natural key khác value/source.
- Xác nhận `syncConflict` hoặc conflict UI xuất hiện.
- Sửa `session_report` và xác nhận attendance snapshot không ghi ngược canonical attendance.
- Sửa `schedule_session` cùng record và xác nhận warning/updatedAt behavior.
- Kiểm tra audit entry có actor/action/before/after.
- Kiểm tra rollback preview chỉ preview, không mutate data.
- Kiểm tra teacher/consultant không được resolve/apply rollback.

## 18. Risks / blockers

Không phát hiện blocker runtime buộc dừng C5.3A.

Risks còn lại:

- Chưa có audit log thật.
- Chưa có conflict UI production-level.
- Học phí/thanh toán vẫn cần field-level conflict trước khi xử lý tranh chấp thật.
- Rollback chưa có backup/audit snapshot đủ dùng.
- Teacher/consultant direct write vẫn phải HOLD.
- Live Supabase state không được query trong C5.3A vì scope cấm Supabase action.

## 19. Open questions

Open questions cho phase sau:

- Dùng table `audit_log` riêng hay `audit_log_entry` trong `center_cloud_entities`?
- Audit log có cần realtime không, hay chỉ query-on-demand?
- Retention audit log bao lâu?
- Có cần mask field nhạy cảm trong before/after không?
- Conflict UI ưu tiên module nào trước: học phí hay điểm danh?
- Rollback apply có cần multi-admin confirmation cho tài chính không?
- Có cần clientId/deviceId ổn định trong app hiện tại không?

## 20. Next recommendation

Nếu C5.3A smoke/build/diff pass: GO for C5.3B manual SQL/readiness pack cho audit/conflict/rollback.

Không push trừ khi user yêu cầu rõ. Không runtime C5.3 trước khi có readiness/SQL/manual decision.
