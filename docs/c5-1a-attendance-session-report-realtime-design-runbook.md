# C5.1A - Điểm danh / Báo cáo ca dạy Realtime Design + SQL Runbook

## 1. Summary

C5.1A là phase thiết kế chi tiết và runbook thủ công cho Điểm danh/Báo cáo ca dạy realtime. Không runtime implementation, không SQL apply, không sửa Supabase data, không commit/push.

Checkpoint trước phase này:

- F22 pushed: `3ea85dd F22 feedback modules and data links MVP`.
- C5.0.1 local commit: `c0f38b8 C5 realtime sensitive workflow preflight`.
- Nhánh `main` đang ahead remote vì C5.0.1 local commit chưa push.

Kết luận thiết kế: tiếp tục dùng `center_cloud_entities` trong C5.1 nếu backend được duyệt, với 3 `entity_type` đề xuất: `attendance_record`, `attendance_baseline_state`, `session_report`. `sessionReports.attendance` vẫn là report-centric snapshot/legacy adapter, không phải canonical attendance duy nhất.

## 2. Current audit

### 2.1. Điểm danh

- Local canonical hiện có ở `ichessCenterOS.attendanceRecords.dreamhome`, qua `src/attendance-records.js`.
- Source hiện được normalize thành `teacher`, `admin`, `consultant`, `initialBaseline`, `correction`, `imported`, `legacyReport`, `unknown`.
- `buildUnifiedAttendanceRecords({ sessionReports, storedRecords })` lấy adapter records từ `sessionReports.attendance`, sau đó merge stored records. Teacher stored record có `sourceReportId/sourceAttendanceIndex` sẽ dedupe adapter record cùng nguồn.
- Module 13 Bảng điểm danh đọc unified records, không ghi Supabase, và có logic loại demo report cũ.
- Admin/teacher attendance đã ghi local trong `src/main.js` qua `upsertAdminAttendanceRecords` và `upsertTeacherAttendanceRecords`.
- Học phí vẫn giữ `usedSessions` riêng; C5.1A không nối `attendance -> usedSessions`, `attendance -> remainingSessions`, hoặc `attendance -> TBHP`.

### 2.2. Báo cáo ca dạy

- Giáo viên/admin mở gateway từ Module 7 Thời khóa biểu.
- Báo cáo lưu vào `ichessCenterOS.sessionReports.dreamhome` qua `saveStoredSessionReports`.
- `createSessionReportDraft` ưu tiên admin attendance nếu đã có, sau đó teacher canonical attendance, sau đó `existingReport.attendance`.
- `buildSessionReportFromAttendance`, `buildSessionReportFromLearningGroups`, `buildSessionReportFromExtraInfo` lưu từng phần report vào cùng record `sessionId + occurrenceDate`.
- Nếu admin đã điểm danh, giáo viên bị khóa phần điểm danh nhưng vẫn có thể bổ sung nội dung ca dạy.

### 2.3. Baseline

- Baseline attendance dùng cùng `attendanceRecords` với source `initialBaseline`.
- State baseline nằm ở `ichessCenterOS.attendanceBaselineState.dreamhome`, gồm `status`, lock/unlock metadata và `auditLog`.
- Baseline là nền/manual để khởi tạo lịch sử, không được override admin/teacher/report tùy tiện khi chưa có rule.
- Hiện có undo/restore local cho thao tác baseline, chưa có rollback cloud.

### 2.4. Cloud/dry-run

- `src/cloud-attendance-records.js` đã có dry-run/build payload cho `attendance_record`, source version `f19h-attendance-alpha-v1`.
- `src/cloud-session-reports.js` đã có dry-run/build payload cho `attendance_baseline_state` và `session_report`, source version `f19h-baseline-session-report-alpha-v1`.
- Payload `session_report` ghi rõ `attendanceIsCanonical: false` và `canonicalAttendanceEntity: 'attendance_record'`.
- Core runtime `src/cloud-db-entities.js` hiện chỉ allow `student`, `teacher`, `class_session`; `attendance_record`, `attendance_baseline_state`, `session_report` chưa thuộc allowlist runtime core.
- `src/online-access-control.js` hiện chỉ cho owner/qtv/center_admin cloud write chung; teacher/consultant là read-only ở layer C3. C5.1 cần role-scoped write rule riêng nếu muốn teacher/consultant ghi attendance/report.
- `src/cloud-realtime-schedule-sessions.js` là mẫu guarded realtime hiện có: subscribe theo `center_id`, table `center_cloud_entities`, merge theo `updatedAt`, ignore non-entity/deleted events.

### 2.5. Warnings

- Deadline giáo viên là 10:00 ngày hôm sau trong `src/schedule-deadline.js`.
- Admin review deadline là 48 giờ sau khi ca kết thúc.
- Status hiện có: `teacherSubmitted`, `waitingTeacher`, `overdueTeacher`, `adminHandledMissingTeacherReport`, `teacherSubmittedWaitingAdminReview`, `adminReviewWaiting`, `qtvAttentionNeeded`.
- Warning hiện là computed local từ schedule + `attendanceRecords` + `sessionReports`, chưa realtime production.

## 3. Canonical models

### 3.1. `attendance_record`

Đề xuất lưu trong `center_cloud_entities.payload` ở C5.1, chưa cần bảng riêng nếu vẫn theo C4 strategy.

Fields tối thiểu:

| Field | Purpose |
| --- | --- |
| `id` | Stable local id hoặc canonical id. |
| `centerId` | Center scope, phải khớp `center_id`. |
| `studentId` | Bắt buộc. |
| `studentNameSnapshot` | Tên tại thời điểm ghi, chỉ snapshot. |
| `sessionId` / `scheduleSessionId` / `classSessionId` | Khóa ca nếu có. |
| `sessionDate` / `date` | Ngày học dạng `YYYY-MM-DD`. |
| `dayOfWeek` | Snapshot ngày trong tuần nếu có. |
| `teacherId` | Giáo viên ca học nếu có. |
| `teacherNameSnapshot` | Tên giáo viên tại thời điểm ghi. |
| `source` | `teacher_report`, `admin`, `consultant`, `baseline`, `imported`, `system_adapter`. |
| `status` / `attendanceStatus` | `present`, `absent`, `excused`, `makeup`, `trial`, hoặc status hiện có. |
| `valueRaw` / `displayValue` | Giữ format cell: `1-99`, `3+4`, `1+3`, `2+2`, `T`, `V`, `P`, `CP`, `B`, `empty`. |
| `counted` / `creditValue` | Có tính vào buổi học hay không; không tự trừ học phí trong C5.1. |
| `sourceReportId` | Link về `session_report` nếu sinh từ giáo viên. |
| `sourceAttendanceIndex` | Vị trí attendance trong report snapshot. |
| `baselineKey` | Key nền/manual nếu source là baseline. |
| `createdAt`, `updatedAt`, `deletedAt` | Audit tối thiểu và soft delete. |
| `createdByUserId`, `updatedByUserId` | Actor Supabase nếu online. |
| `revision` / `version` | Tối thiểu tăng khi write-through để bắt conflict. |
| `notes` | Ghi chú nghiệp vụ. |

Mapping source hiện tại sang source đề xuất:

- `teacher` -> `teacher_report`.
- `admin` -> `admin`.
- `consultant` -> `consultant`.
- `initialBaseline` -> `baseline`.
- `imported` -> `imported`.
- `legacyReport` / adapter fallback -> `system_adapter`.

Không phá validator F19C.6: các format cell đặc biệt chỉ được preserve/parse theo helper hiện có, không ép lại bằng rule mới trong C5.1A.

### 3.2. `attendance_baseline_state`

Fields đề xuất:

| Field | Purpose |
| --- | --- |
| `id` | `attendance_baseline_state::<centerId>` hoặc theo tháng nếu tách nhỏ. |
| `centerId` | Center scope. |
| `studentId` | Optional nếu state tổng; required nếu tách per-student. |
| `baselineMonth` / `baselineRange` | Phạm vi nền. |
| `sequenceState` | Trạng thái số buổi/sequence nếu cần. |
| `manualCells` | Dữ liệu cell nền đang nhập nếu tách khỏi `attendance_record`. |
| `status` | `notStarted`, `draft`, `locked`, `unlocked`. |
| `updatedAt`, `updatedByUserId`, `deletedAt` | Metadata realtime/soft delete. |
| `notes` / `auditLog` | Lý do lock/unlock, audit local/cloud tối thiểu. |

Baseline là nền/manual fallback. Khi conflict với admin/teacher/report canonical, baseline không override nếu chưa có quyết định admin rõ ràng.

### 3.3. `session_report`

Fields đề xuất:

| Field | Purpose |
| --- | --- |
| `id` | Stable id, ưu tiên `report-<sessionId>-<sessionDate>`. |
| `centerId` | Center scope. |
| `scheduleSessionId` / `sessionId` | Link ca học. |
| `sessionDate` / `occurrenceDate` | Ngày ca học. |
| `teacherId`, `teacherNameSnapshot` | Actor/teacher snapshot. |
| `studentIds` | Danh sách học viên trong ca. |
| `attendanceSnapshot` | Snapshot để xem lại report; không phải canonical cuối. |
| `reportContent` | Nội dung học, learning groups, tình hình lớp, đề xuất. |
| `status` | `draft`, `submitted`, `late_submitted`, `admin_handled_missing_teacher_report`, `voided`. |
| `submittedAt`, `submittedByUserId` | Giáo viên submit. |
| `adminHandledAt`, `adminHandledByUserId` | Admin xử lý thiếu báo cáo. |
| `deadlineAt` | 10:00 ngày hôm sau. |
| `createdAt`, `updatedAt`, `deletedAt` | Metadata realtime/soft delete. |
| `notes` | Ghi chú. |

`attendanceSnapshot` dùng để render report và adapter legacy. Canonical attendance phải đi qua `attendance_record`.

## 4. Read path

| Consumer | Reads from | Merge priority | Empty state | Risk |
| --- | --- | --- | --- | --- |
| Module 13 Bảng điểm danh | `attendance_record` cloud/cache sau C5.1C, local `attendanceRecords`, `sessionReports` adapter, baseline/import. | 1. non-deleted canonical `attendance_record`; 2. admin/consultant override; 3. teacher_report generated records; 4. baseline/imported fallback; 5. `sessionReports` adapter legacy fallback. | Không có học viên/lớp/report thì hiển thị empty state hiện có. | Dễ double count nếu teacher stored record và report adapter không dedupe bằng stable key. |
| Module 7 TKB gateway giáo viên/admin | `scheduleSessions`, `attendanceRecords`, `sessionReports`, deadline helper. | Admin attendance khóa teacher attendance draft; teacher report đọc teacher canonical nếu có; report snapshot dùng fallback. | Không có occurrence thì không mở form; không có học viên thì report empty. | Admin lock và teacher submit cùng lúc cần conflict guard. |
| F22.2 Báo cáo | `buildUnifiedAttendanceRecords` do `main.js` truyền vào `renderReportModule`. | Dùng unified output; không tự đọc cloud trực tiếp trong report module. | Nếu weekRecords rỗng thì hiển thị chưa đủ dữ liệu điểm danh. | Báo cáo tuần có thể lệch nếu unified records chưa pull cloud. |
| Cảnh báo giáo viên trễ báo cáo | `schedule-deadline.js`: sessions + attendance records + sessionReports. | Teacher submitted nếu có teacher attendance record hoặc meaningful `session_report`. | Không có session/deadline thì `unknown`. | Report-only và attendance-only có thể làm trạng thái khác nhau nếu merge cloud chậm. |
| Cảnh báo admin/consultant | `schedule-deadline.js`: admin/consultant source trong attendance records + sessionReports. | Admin/consultant source xử lý cao hơn teacher report. | Không có data thì waiting/admin review waiting. | Consultant source cần policy rõ, hiện UI chủ yếu admin. |
| Future C5.2 Học phí/TBHP | Chỉ đọc after C5.1 canonical stable; không tự mutate trong C5.1. | Không dùng để trừ buổi trong C5.1. | Giữ current `usedSessions` local. | Nếu nối sớm sẽ báo sai học phí/TBHP. |

## 5. Write path

| Actor | Action | Local write | Cloud write | Realtime publish | Conflict rule | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| Giáo viên gửi báo cáo ca dạy | Lưu attendance + nội dung report. | `sessionReports`; đồng thời `upsertTeacherAttendanceRecords` vào `attendanceRecords`. | C5.1C mới write-through guarded `session_report` + `attendance_record`. | Sau cloud upsert vào `center_cloud_entities`. | Nếu admin attendance đã tồn tại, teacher không ghi đè attendance; chỉ bổ sung report content. | Giữ local snapshot trước write; soft delete/void report nếu hủy. |
| Admin xử lý thiếu báo cáo giáo viên | Điểm danh thay hoặc đánh dấu handled. | `upsertAdminAttendanceRecords` vào `attendanceRecords`. | C5.1C write-through `attendance_record`; có thể cập nhật `session_report.status`. | Publish entity changed. | Admin/consultant priority cao hơn teacher_report nếu cùng natural key. | Backup local attendance trước pull/write-through. |
| Admin/consultant điểm danh trực tiếp | Ghi attendance theo học viên/ca. | `attendanceRecords` source `admin` hoặc `consultant`. | Chỉ khi role policy được duyệt. | Publish `attendance_record`. | Same natural key khác value -> mark conflict, không silently latest-wins. | Soft delete hoặc correction record, không hard delete. |
| Admin sửa baseline điểm danh | Nhập/chốt/mở khóa nền. | `attendanceRecords` source `initialBaseline` + `attendanceBaselineState`. | C5.1C write-through `attendance_record` baseline hoặc `attendance_baseline_state` tùy runbook. | Publish baseline state và baseline records nếu có. | Baseline không override admin/teacher/report canonical nếu chưa explicit override. | Undo local hiện có; cloud rollback cần backup/snapshot. |
| System adapter import từ `sessionReports` cũ | Sinh read adapter hoặc migration preview. | Không tạo record thật trong C5.1A. | Chỉ dry-run/proposal. | Không publish trong C5.1A. | Legacy adapter phải dedupe theo `sourceReportId/sourceAttendanceIndex/sourceCreditIndex`. | Không destructive; có thể bỏ adapter record bằng rebuild. |

C5.1A không implement. C5.1C mới guarded runtime. Khi cloud unavailable, thiết kế ưu tiên local guarded save + cloud write-through retry + visible sync status, không hard reset dữ liệu thật.

## 6. Realtime design

### 6.1. Entities

Đề xuất `center_cloud_entities.entity_type`:

- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Không mở tuition/TBHP trong C5.1.

### 6.2. Subscription

Proposal:

- Chỉ subscribe sau khi Supabase configured, signed-in, center binding ready, membership/role guard pass.
- Subscribe table `public.center_cloud_entities`, filter `center_id=eq.<centerId>`.
- Trong handler tiếp tục ignore payload khác center hoặc `entity_type` không thuộc C5.1.
- Ignore older `updatedAt`; nếu `updatedAt` bằng nhau nhưng value khác thì mark conflict.
- Handle soft delete qua `deleted_at`/payload `deletedAt`: remove khỏi active read model nhưng giữ tombstone/audit ở cache nếu C5.3 chưa xong.
- Dedupe theo `local_id` và natural key:
  - attendance: `studentId + date + sessionKey + source + creditKey`.
  - session report: `sessionId + occurrenceDate`.
  - baseline state: `centerId + baselineRange` hoặc `centerId` nếu global.

### 6.3. Write-through

Proposal:

- Local guarded save trước để không mất thao tác khi mạng yếu.
- Cloud write-through ngay sau local save nếu online/readiness pass.
- Stable id dùng existing local id hoặc deterministic id:
  - `attendance_record::<studentId>::<date>::<sessionKey>::<source>::<creditKey>`.
  - `session_report::<reportId>` hoặc `session_report::<sessionId>::<occurrenceDate>`.
  - `attendance_baseline_state::<centerId>`.
- UI cần visible sync status: pending/synced/failed/conflict.
- Nếu cloud fail: giữ local cache, ghi warning, cho retry; không seed/overwrite cloud.
- Optimistic UI được phép vì local là cache/fallback, nhưng phải có conflict badge nếu cloud trả về version mới hơn.

### 6.4. Conflict

Minimal C5.1 guard:

- Latest `updatedAt` không đủ cho attendance nhạy cảm.
- Same natural key khác value/status/note/source -> mark conflict/cần kiểm tra.
- Admin/consultant override teacher report nếu rule được user duyệt.
- Teacher report không được ghi đè admin attendance đã tồn tại.
- Imported/baseline chỉ fallback, không override canonical admin/teacher nếu không có explicit admin correction.
- Không xóa record thật bằng hard delete; dùng soft delete.

Full audit/conflict/rollback để C5.3, nhưng C5.1C phải có guard tối thiểu để tránh mất attendance.

## 7. Conflict / duplicate / soft delete rules

- Duplicate prevention: stable `local_id`, natural key, và dedupe adapter bằng `sourceReportId/sourceAttendanceIndex/sourceCreditIndex`.
- Same teacher report saved nhiều lần: update cùng report id và cùng teacher attendance natural key, không append duplicate.
- Admin correction: tạo/update canonical source admin/consultant, giữ teacher report snapshot để audit.
- Soft delete: set `deleted_at` ở `center_cloud_entities`; payload nên giữ `deletedAt`, `deletedByUserId`, `deleteReason`.
- Delete event realtime: không hard-remove khỏi backup; chỉ ẩn khỏi active read path.
- Conflict display proposal: Module 7 và Module 13 hiển thị “Cần kiểm tra” khi same natural key có value khác nhau giữa admin/teacher/report/baseline.

## 8. SQL/Supabase readiness

SQL APPLY: NO

WAITING USER CONFIRMATION BEFORE APPLYING SQL

### 8.1. Entity allowlist proposal

Nếu tiếp tục dùng `center_cloud_entities`, cần manual SQL/runbook để allow:

- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Audit cần làm trước khi apply:

- Check constraint `center_cloud_entities_entity_type_check`.
- RLS policies cho read/write theo `center_members`.
- Publication `supabase_realtime`.
- `REPLICA IDENTITY FULL` nếu muốn delete/old row visibility cho realtime conflict/soft delete.

### 8.2. RLS/realtime proposal

Role policy đề xuất:

- owner/qtv/center_admin: read/write all C5.1 entities trong center.
- teacher: read sessions/reports liên quan; write own `session_report` và own `attendance_record` cho ca được phân công, nếu C5.1B policy đủ chặt.
- consultant: read attendance/report; write consultant attendance nếu được user duyệt.
- viewer: read-only.

Không áp policy teacher/consultant broad write nếu chưa có predicate an toàn theo center/session assignment.

### 8.3. Manual runbook proposal

Purpose: mở backend readiness cho C5.1 entities trong `center_cloud_entities`.

Environment: Supabase project alpha/staging trước; production chỉ sau QA.

Data destructive? NO nếu chỉ alter allowlist/policies/publication. Vẫn cần backup.

Backup needed? YES:

- Export schema/policies hiện tại.
- Snapshot `center_cloud_entities`.
- Ghi lại current check constraint definition.

Step order:

1. Verify current table/constraint/policies/publication.
2. Backup/snapshot.
3. Draft SQL allowlist cho 3 entity C5.1.
4. Draft RLS policies theo role.
5. Draft realtime publication/replica identity verification.
6. User review/approval.
7. Apply thủ công ngoài C5.1A nếu được duyệt.
8. Verify select/insert/update/soft delete/realtime event bằng test account.

Verification queries:

- Check allowed entity type insert dry-run bằng transaction rollback.
- Check authenticated read filtered by `center_id`.
- Check teacher/consultant write denial/allow theo policy.
- Check realtime event received for insert/update/soft delete.

Rollback note:

- Restore previous constraint/policies from backup.
- Remove publication change only if confirmed safe.
- Do not `truncate`, `delete`, or drop user data.

## 9. C5.1B plan

Recommended next phase: C5.1B - Manual SQL apply pack / backend readiness, if user approves.

Deliverables:

- SQL draft/proposal file with `proposal` or `draft` in name if needed.
- Manual apply checklist.
- Verification queries.
- Rollback notes.
- No automatic apply by Codex.

If user decides not to touch SQL yet, alternative C5.1B can be Runtime guarded dry-run without SQL, limited to local/cloud preview only.

## 10. C5.1C plan

Guarded runtime implementation only after C5.1B readiness decision:

- Add helper for `attendance_record`, `attendance_baseline_state`, `session_report` realtime subscription.
- Add guarded write-through after local save.
- Add sync status and conflict state.
- Keep localStorage cache/fallback.
- Do not connect attendance to tuition/TBHP.
- Do not introduce Teacher Portal/Super Admin.

## 11. Manual QA plan

- Two browsers, same center, same account role admin: save admin attendance, verify other browser receives update.
- Teacher role, assigned session: submit report, verify `session_report` + `attendance_record` write only for allowed session.
- Teacher attempts to edit admin-locked attendance: blocked; report content still editable.
- Admin handles missing teacher report after 10:00 next day: alert changes from `overdueTeacher` to `adminHandledMissingTeacherReport`.
- Baseline lock/unlock: baseline does not override admin/teacher canonical records.
- Offline/failed cloud write: local remains, sync status shows failed/pending, retry works.
- Soft delete/voided report: hidden from active read path, visible in audit/backup.
- F22.2 report reads unified attendance after pull, empty week remains graceful.
- No attendance -> tuition automation; `usedSessions` unchanged.

## 12. Risks / blockers

- Backend allowlist/RLS does not yet include C5.1 entity types in core runtime.
- Teacher/consultant write policy is not trivial; broad write would be unsafe.
- Existing `sessionReports.attendance` can be mistaken as canonical if C5.1C does not mark snapshot clearly.
- Latest-wins merge can hide attendance conflicts.
- Baseline/import/adapter data can double count without stable natural key.
- C5.3 audit/rollback is not done; C5.1C needs minimal guard only.
- Current source files contain legacy mojibake text, but C5.1A only gates new files for mojibake.

## 13. Scope safety

- Runtime implementation: NO.
- SQL apply: NO.
- Supabase data change: NO.
- Table/bucket/policy creation: NO.
- Teacher Portal/Super Admin/check-in image upload: NO.
- Commit/push: NO.
- C5.2/C5.3 implementation: NO.

## 14. Next phase

C5.1B - Manual SQL apply pack / backend readiness, if user approves.

Preconditions:

- User approves whether C5.1B should produce SQL draft/apply pack or avoid SQL and stay dry-run.
- Role policy for teacher/consultant write is explicitly reviewed.
- No attendance-to-tuition automation until C5.2.
