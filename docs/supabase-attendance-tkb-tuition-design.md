# F19H.1 - Thiết kế Cloud cho Attendance / TKB / Học phí

## 1. Executive Summary

Cloud DB C2/C2.3 hiện chỉ sync 3 nhóm lõi qua `center_cloud_entities`: `student`, `teacher`, `class_session`. F19A-F19G đã bổ sung mô hình local cho điểm danh canonical, báo cáo ca dạy, baseline điểm danh, luồng Admin/Tư vấn - Giáo viên trong TKB, và cảnh báo deadline local.

Thiết kế F19H.1 đề xuất cloud hóa từng phần nhỏ, bắt đầu từ dữ liệu ít phụ thuộc nhất và luôn giữ một nguồn sự thật rõ ràng. Điểm quan trọng nhất: `attendanceRecords` phải là source of truth cho attendance; `sessionReports` chỉ giữ nội dung báo cáo ca dạy/Trello/backward compatibility, không trở thành nguồn attendance chính thứ hai.

Phase này không tạo bảng Supabase thật, không sửa SQL production, không bật sync runtime, không push/pull cloud, không sửa UI, và không thay đổi localStorage.

## 2. Current Local Data Sources

| Local key | Dữ liệu chứa gì | Module ghi | Module đọc | Source of truth hiện tại | Rủi ro khi sync cloud |
| --- | --- | --- | --- | --- | --- |
| `ichessCenterOS.students.dreamhome` | Hồ sơ học viên, cấp độ custom F19A, phụ huynh, trạng thái | Module Học viên, restore Angel Wings | Học viên, TKB, Học phí, Bảng điểm danh, Cloud C2 | Local, đã sync C2 dưới entity `student` | Đang được push/pull nguyên payload; cần giữ `id` ổn định để attendance/tuition tham chiếu |
| `ichessCenterOS.teachers.dreamhome` | Giáo viên, thông tin phân công, lịch khả dụng | Module Giáo viên, restore Angel Wings | TKB, deadline alerts, Cloud C2 | Local, đã sync C2 dưới entity `teacher` | Teacher app tương lai cần role/user link riêng, không chỉ payload giáo viên |
| `ichessCenterOS.classSessions.dreamhome` | Ca học/lớp lõi, thời lượng, học viên/giáo viên gợi ý | Module Học viên/Ca học, restore Angel Wings | Học viên, TKB, Cloud C2 | Local, đã sync C2 dưới entity `class_session` | Dễ bị nhầm với `schedule_session`; cần tách lớp/ca học danh mục và lịch phát sinh |
| `ichessCenterOS.schedule.dreamhome` | TKB: session cố định hoặc đột xuất, ngày/giờ/phòng/teacher/studentIds/status | Module 7/TKB, restore Angel Wings | Module 7, deadline alerts, attendance save context | Local only | Phải sync sau attendance hoặc cùng một phase có guard; recurring occurrence không có record riêng |
| `ichessCenterOS.sessionReports.dreamhome` | Báo cáo ca dạy: attendance legacy, learningGroups, guestParticipants, classSituation, suggestions, Trello content | Module 7/TKB, restore Angel Wings | Module 7, adapter attendance, deadline alerts, Bảng điểm danh qua unified records | Local report content; attendance bên trong là nguồn legacy/adapter | Nếu cloud hóa cả attendance bên trong report sẽ tạo hai nguồn sự thật với `attendanceRecords` |
| `ichessCenterOS.attendanceRecords.dreamhome` | Canonical attendance records từ `initialBaseline`, `admin`, `teacher`, `consultant`, `correction`, `imported`, `legacyReport`, `unknown` | Module 13 baseline, Module 7 Admin/Giáo viên | Module 13 unified read, Module 7 lock/alerts, deadline alerts | Source of truth mới cho attendance | Cần unique key/dedupe kỹ để teacher records và `sessionReports.attendance` không nhân đôi |
| `ichessCenterOS.attendanceBaselineState.dreamhome` | Trạng thái nhập nền: `notStarted`, `draft`, `locked`, `unlocked`, audit log | Module 13 baseline | Module 13 | Local state cho baseline | Nên sync riêng hoặc nằm cùng batch với baseline records; phải giữ audit/lock |
| `ichessCenterOS.tuition.dreamhome` | Hồ sơ học phí từng học viên: packageName, totalSessions, usedSessions, số tiền, kỳ hiện tại, thanh toán, termHistory | Module Học phí/TBHP, restore Angel Wings | Học phí/TBHP, Thu chi payment sync local | Local/manual | Chưa tự nối attendance; không được tự cập nhật `usedSessions` khi chưa có term model |
| `ichessCenterOS.tuitionPackages.dreamhome` | Danh mục gói học phí Angel Wings controlled dataset | Helper Angel Wings restore | Học phí gợi ý/data staging | Local fixture catalog | Chưa có storage API chính thức trong `storage.js`; nếu sync phải chuẩn hóa thành entity riêng |
| `ichessCenterOS.attendanceAdvisoryNotes.dreamhome` | Note chăm sóc cuối tháng/TBHP | Học phí/TBHP, Angel Wings restore | Học phí/TBHP | Local advisory note | Liên quan tuition nhưng không phải tuition record; sync sau hoặc cùng advisory phase |
| `ichessCenterOS.attendanceBoardNotes.dreamhome` | Ghi chú Bảng điểm danh | Module 13/Bảng điểm danh | Module 13 | Local note phụ trợ | Không nên sync trước attendance canonical |

Cloud C2 backup trước pull hiện dùng key `ichessCenterOS.backup.beforeCloudPull.<timestamp>` và chỉ chứa students/teachers/classSessions. Angel Wings restore dùng backup `ichessCenterOS.backup.beforeF15K5AngelWings.<timestamp>` cho nhiều key staging, gồm tuition/schedule/sessionReports/advisory.

## 3. Proposed Cloud Entities

F19H.2 nên tiếp tục dùng `center_cloud_entities` cho bước đầu vì bảng đã có RLS, unique `(center_id, entity_type, local_id)`, soft delete `deleted_at`, `created_by`, `updated_by`, và app-side readiness. Trước khi dùng thêm entity type, SQL tương lai cần mở constraint/check allowlist, nhưng F19H.1 không tạo SQL.

| Entity type đề xuất | Local source key | Primary ID/local_id | Center scope | Unique key đề xuất | Payload summary | Index nên có | Sync direction | Conflict rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `attendance_record` | `attendanceRecords` | `record.id` | `center_id`/`centerId` | `centerId + studentId + date + session key + source + sourceCreditIndex` | Canonical attendance row, source, credit, audit fields | `(center_id, entity_type)`, payload `studentId`, `date`, `sessionId`, `source`, `updatedAt` nếu tách bảng | Local to cloud then cloud to local behind manual gate | Latest `updatedAt` wins only within same unique key; source priority only for read model, không overwrite source khác |
| `attendance_baseline_state` | `attendanceBaselineState` | `baseline-state-${centerId}` | `center_id` | `centerId` | baseline status/lock/auditLog | `center_id`, `updated_at` | Manual push/pull with attendance batch | Pull chỉ sau backup; không hạ `locked` thành `draft` nếu cloud cũ hơn |
| `session_report` | `sessionReports` | `report.id` | `center_id` | `centerId + sessionId + occurrenceDate` | report content, learningGroups, guestParticipants, extra fields, legacy attendance read-only | `sessionId`, `occurrenceDate`, `teacherId`, `updatedAt` | Sync sau attendance foundation | Attendance trong payload là legacy snapshot; canonical attendance không được sinh từ cloud report nếu đã có `attendance_record` cùng source |
| `schedule_session` | `schedule` | `session.id` | `center_id` | `centerId + id` | TKB recurring/oneOff fields | `scheduleType`, `date`, `dayOfWeek`, `teacherId`, `classSessionId`, `updatedAt` | Sync sau hoặc cùng session reports | Latest `updatedAt` wins; delete dùng soft delete |
| `tuition_record` | `tuition` | `record.id` | `center_id` | `centerId + studentId` hoặc `centerId + record.id` | Current tuition record + current term summary | `studentId`, `currentTermId`, `dueDate`, `updatedAt` | Payload sync trước, automation sau | Không tự đổi `usedSessions` từ attendance trong phase sync đầu |
| `tuition_package` | `tuitionPackages` | `package.id` | `center_id` | `centerId + package.id` | Package catalog | `sessionCount`, `price`, `updatedAt` | Optional, sau tuition payload | Treat as catalog; no destructive pull nếu local có custom package |
| `tuition_term` | Có thể tách từ `tuition.currentTermId` và `termHistory` | `term.id` | `center_id` | `centerId + studentId + termId` | Current/archived term | `studentId`, `termNumber`, `status` | Future normalized model | Không triển khai trước khi chốt current term |
| `tuition_payment` | `tuition.payments` | `payment.id` | `center_id` | `centerId + tuitionId + payment.id` | Payment history | `studentId`, `paidAt`, `tuitionId` | Future normalized model | Append/update by payment id; no infer overpayment automatically |
| `session_followup_status` hoặc `deadline_state` | Runtime từ schedule + records + reports | derived id | `center_id` | `centerId + sessionId + occurrenceDate + kind` | Optional persisted deadline status | `status`, `deadlineAt`, `lastComputedAt` | Không sync phase đầu; compute runtime trước | Persist only if workflow needs assignment/escalation history |

Nếu dữ liệu lớn hoặc cần query/report nhiều, nên tách bảng riêng lâu dài: `attendance_records`, `session_reports`, `schedule_sessions`, `tuition_records`, `tuition_terms`, `tuition_payments`. `center_cloud_entities` phù hợp bridge migration và prototype-safe sync, nhưng JSONB sẽ giới hạn index/query sâu khi có app Giáo viên/QTV/Phụ huynh.

## 4. Attendance Model

Cloud `attendance_record` nên phản ánh canonical record hiện có trong `src/attendance-records.js`:

```txt
id
centerId
studentId
date
classSessionId
scheduleSessionId
sessionId
teacherId
teacherName
status
attendanceStatus
counted
creditNumber
creditValue
creditLabel
credits
packageId
tuitionTermId
source
submittedByRole
note
sourceReportId
sourceAttendanceIndex
sourceCreditIndex
createdBy
updatedBy
createdAt
updatedAt
deletedAt
lockedAt
correctionReason
payloadVersion
raw
```

Allowed `source` hiện tại: `initialBaseline`, `admin`, `teacher`, `consultant`, `correction`, `imported`, `legacyReport`, `unknown`. Design phase sau nên ưu tiên source chính: `initialBaseline`, `admin`, `teacher`, `consultant`, `correction`.

Unique/dedupe:

```txt
centerId + studentId + date + (sessionId || scheduleSessionId || classSessionId || "session") + source + sourceCreditIndex
```

Với baseline không có session rõ ràng, unique có thể là:

```txt
centerId + studentId + date + source
```

Với adapter từ `sessionReports.attendance`, dedupe phải dùng `sourceReportId + sourceAttendanceIndex + sourceCreditIndex`. Nếu đã có stored teacher record cùng source report, `buildUnifiedAttendanceRecords` hiện xóa adapter duplicate. Cloud cũng phải giữ nguyên nguyên tắc này: canonical stored record thắng adapter report-derived record.

Conflict strategy:

- Không merge các source khác nhau thành một row. `teacher`, `admin`, `initialBaseline` là các fact riêng, read model quyết định ưu tiên hiển thị.
- Cùng unique key: record có `updatedAt` mới hơn thắng, nhưng không được xóa field audit nếu bản mới thiếu field do client cũ.
- Delete dùng `deletedAt`, không hard delete ở phase đầu.
- Correction nên tạo `source: "correction"` hoặc update canonical row kèm `correctionReason` theo rule đã chốt, không sửa ngầm `sessionReports`.
- `counted`, `creditValue`, `creditNumber`, `creditLabel` là dữ liệu attendance/tuition bridge nhưng chưa tự động cập nhật Học phí.

## 5. Session Reports Model

Cloud `session_report` lưu nội dung báo cáo ca dạy, không trở thành attendance source chính:

```txt
id
centerId
sessionId
scheduleSessionId
classSessionId
occurrenceDate
teacherId
teacherName
learningGroups
guestParticipants
teachingAssistantNotes
classSituation
suggestions
trelloText
reportStatus
submittedAt
createdBy
updatedBy
createdAt
updatedAt
deletedAt
payloadVersion
legacyAttendanceSnapshot
```

Phân biệt:

- `attendanceRecords` = source of truth cho attendance canonical.
- `sessionReports` = nội dung học/báo cáo/Trello/backward compatibility.
- `sessionReports.attendance` có thể giữ trong payload dưới tên legacy/snapshot để không mất dữ liệu cũ, nhưng không được coi là nguồn ghi attendance chính mới.
- Khi pull cloud report, app chỉ nên dùng report attendance làm adapter nếu chưa có canonical attendance tương ứng.

## 6. Schedule/TKB Model

Local schedule hiện có:

```txt
id
scheduleType: recurring | oneOff
title
dayOfWeek
startDate
endDate
date
occurrenceReason
startTime
endTime
room
classSessionId
teacherId
teacherName
studentIds
groupName
level
status
note
sourceModule/sourceTag/importBatchId/datasetId/datasetVersion/isControlledFixture
createdAt
updatedAt
```

Cloud cần phân biệt:

- `class_session`: entity C2 đã sync, là lớp/ca học danh mục hoặc data lõi.
- `schedule_session`: entity mới cho lịch vận hành trong Module 7/TKB.
- Occurrence của recurring session hiện được render runtime theo tuần; phase sau chưa cần tạo bảng occurrence riêng nếu chỉ sync schedule config.

Khuyến nghị:

- F19H.2c sync `schedule_session` nguyên payload trước.
- Không đổi behavior TKB khi sync; chỉ push/pull thủ công và backup trước pull.
- Với recurring session, `date` là null, dùng `dayOfWeek + startDate/endDate`.
- Với oneOff, `date` là ngày thật và `occurrenceReason` có giá trị.
- Attendance records phải tham chiếu được `sessionId`/`scheduleSessionId` và `date`/`occurrenceDate`.

## 7. Tuition/Học phí Model

Local tuition hiện là một record theo học viên, có current term gộp trong record và lịch sử kỳ trong `termHistory`:

```txt
id
studentId
packageName
totalSessions
usedSessions
hasTotalSessionsData
hasUsedSessionsData
totalAmount
discountType
discountValue
discountAmount
paidAmount
dueDate
note
payments
currentTermNumber
currentTermId
startedAt
termHistory
```

Thiết kế cloud đề xuất:

- `tuition_record`: bản payload hiện tại để sync an toàn trước.
- `tuition_package`: catalog gói, gồm `id`, `name`, `sessionCount`, `price`, `displayLabel`.
- `tuition_term`: model normalized tương lai cho current term và history.
- `tuition_payment`: model normalized tương lai cho payment history.

Nguyên tắc:

- F19H.1/F19H.2 đầu không tự nối attendance với `usedSessions`.
- Không dùng `max credit toàn lịch sử + 1` làm logic học phí.
- Trước khi tự tính học phí, phải chốt `currentTermId`, cách xác định buổi thuộc kỳ hiện tại, và quy tắc chuyển kỳ.
- Nếu phase sau chỉ sync nguyên payload `tuition_record`, ưu điểm là ít rủi ro và giữ UI hiện tại; nhược điểm là khó query payment/term và dễ conflict khi nhiều client sửa payments trong cùng record.

## 8. Deadline/Status Model

Deadline alerts hiện compute local/read-only từ:

- TKB visible sessions.
- Canonical teacher/admin/consultant attendance records.
- `sessionReports` report content.
- Teacher list để hiển thị tên.

Quy tắc hiện tại:

- Giáo viên: deadline 10:00 sáng hôm sau.
- Admin/Tư vấn: deadline 48 giờ sau khi ca học kết thúc.
- QTV/anh Hải: trạng thái tương lai khi quá hạn Admin/Tư vấn mà chưa có record `admin`/`consultant`.

Khuyến nghị phase đầu: không persist alerts. Sau pull schedule/attendance/report, client tự compute runtime để tránh stale state.

Chỉ cân nhắc entity `session_followup_status`/`deadline_state` khi có workflow thật cho QTV/anh Hải, notification thật, assignment, hoặc lịch sử escalation. Khi đó payload có thể gồm:

```txt
kind
sessionId
occurrenceDate
teacherDeadlineAt
adminDeadlineAt
status
lastComputedAt
escalationState
assignedTo
acknowledgedAt
resolvedAt
```

## 9. Sync Strategy By Phase

### F19H.2a - Cloud sync `attendanceRecords` behind dev/manual gate

Scope: add entity type `attendance_record` to allowlist, build serializers, manual push/pull with backup and preview. No UI behavior change outside Cloud DB panel.

Likely files: `cloud-db-entities.js`, `cloud-db-sync.js`, `storage.js` or `attendance-records.js`, Settings cloud panel, smoke tests.

Data keys: `ichessCenterOS.attendanceRecords.dreamhome`.

Tests: attendance adapter smoke, F19G deadline smoke, new cloud entity smoke, build/diff.

Rollback risk: medium, because attendance is now shared read model. Mitigation: no auto pull/push, backup before pull.

### F19H.2b - Cloud sync `attendanceBaselineState`

Scope: sync baseline lock/audit state with attendance batch.

Data keys: `ichessCenterOS.attendanceBaselineState.dreamhome`.

Tests: F19C.1-F19C.8 smoke and attendance cloud smoke.

Rollback risk: medium. Pulling stale unlocked state could reopen locked baseline; require `updatedAt`/lock comparison.

### F19H.2c - Cloud sync `sessionReports` content

Scope: sync report content as `session_report`, keep attendance legacy snapshot read-only.

Data keys: `ichessCenterOS.sessionReports.dreamhome`.

Tests: F19E/F19F/F19G smoke, report build/Trello smoke if added.

Rollback risk: medium-high because report content and legacy attendance share payload. Mitigation: canonical attendance remains primary.

### F19H.2d - Cloud sync `schedule_session`

Scope: sync TKB config/oneOff sessions. Do not create occurrence table yet.

Data keys: `ichessCenterOS.schedule.dreamhome`.

Tests: F19D/E/F/G smoke plus schedule form smoke if available.

Rollback risk: high if pull replaces local schedule unexpectedly. Mitigation: count/diff preview and backup.

### F19H.2e - Cloud sync `tuition_record` and `tuition_package` as payload

Scope: sync Học phí/TBHP payload only.

Data keys: `ichessCenterOS.tuition.dreamhome`, `ichessCenterOS.tuitionPackages.dreamhome`.

Tests: tuition module smoke if added, C2/Angel Wings restore smoke.

Rollback risk: high for payment history. Mitigation: backup, no auto pull, no destructive merge.

### F19H.2f - Normalize tuition term/payment and cross-link attendance to current term

Scope: after business rules are approved, add term/payment normalized read model and optional attendance-to-term linkage.

Data keys: tuition plus attendance.

Tests: dedicated tuition-term and attendance credit smoke.

Rollback risk: high. This should not be combined with first cloud sync.

## 10. Readiness Gate And Safety

Required guards before any future push/pull:

- Supabase config status must be `configured`.
- User must be signed in.
- `center_members` membership must exist for `center_id = dreamhome`.
- Cloud table readiness check must pass.
- Entity type must be in an explicit allowlist.
- Push must show count/diff preview by entity type.
- Pull must create backup for every local key it may replace.
- Push must block suspicious local counts, including old seed or missing Angel Wings marker where relevant.
- Pull must block if cloud count is zero while local count is non-zero unless user confirms a recovery mode.
- No auto push on page load.
- No auto pull without user action for new F19 entities.
- No destructive cloud writes in first phase; use upsert + soft delete only.
- Preserve Angel Wings as staging dataset, not production truth.
- Never run SQL from frontend.
- Never include service role key in app.

## 11. RLS/Security Design

F19H.1 không làm login/role thật mới, nhưng schema future phải chuẩn bị:

- All rows center-scoped by `center_id`.
- RLS checks `center_members` or helper `is_center_member(center_id)`.
- Future roles:
  - `owner`/QTV/anh Hải: full center operations, escalation view.
  - `center_admin`: manage local center data, attendance admin/consultant records, schedule, tuition.
  - `teacher`: read assigned schedule/students, write teacher attendance/report for own sessions.
  - `consultant`: write consultant attendance/checking if workflow allows.
  - Parent/student future: read-only scoped summaries, no write to operational attendance.
- Every write should include `created_by`, `updated_by`, and role/source metadata.
- Corrections need audit fields: `correctionReason`, `updatedBy`, optional `supersedesRecordId`.
- If moving to normalized tables, use table-specific policies instead of broad JSON entity policies.

## 12. Migration Plan

1. Freeze scope and export localStorage backup for all affected keys.
2. Add cloud allowlist/entity support in dev-only/manual mode.
3. Build dry-run serializer and count preview.
4. Push Angel Wings staging data to cloud for one entity group only.
5. Pull into a clean browser profile and compare counts/hash summaries.
6. Run smoke tests for affected module and cross-module read model.
7. Add rollback button or documented restore from backup key.
8. Repeat for next entity group.
9. Only after staging pass, create production empty center/import plan.
10. Defer auto-sync, notifications, QTV/Teacher separate apps, and tuition automation until entity model is stable.

## 13. Open Questions

- Tiếp tục mở rộng `center_cloud_entities` bao lâu trước khi tách bảng riêng?
- SQL phase sau sẽ mở check constraint entity type bằng migration mới hay chuyển sang bảng normalized ngay?
- `sessionReports.attendance` cloud nên giữ dưới tên field nào để tránh nhầm với canonical attendance?
- `consultant` source sẽ có UI/role chính thức ở đâu?
- Admin và consultant có cùng quyền sửa attendance hay cần phân biệt audit?
- Học phí current term được xác định bằng `currentTermId`, ngày bắt đầu, hay credit range?
- Payment history nên tách `tuition_payment` trước hay sau khi sync tuition payload?
- QTV/anh Hải cần app riêng, notification thật, hay chỉ dashboard trong Admin cơ sở?
- Khi một client cũ chỉ có `sessionReports.attendance`, cloud pull có nên sinh canonical record một lần hay để adapter runtime đọc?
- Chính sách xử lý xung đột khi hai máy cùng sửa cùng attendance source trong offline window là gì?

## 14. Readiness For F19H.2

Khuyến nghị bắt đầu F19H.2 bằng `attendance_record` vì đây là mô hình canonical mới và Module 13/Module 7/deadline đã đọc được unified records. Tuy nhiên chỉ nên bật manual push/pull sau khi có:

- Serializer/deserializer có test.
- Backup đầy đủ cho attendance/baseline.
- Preview count/diff.
- Allowlist rõ trong `cloud-db-entities.js`.
- Không auto sync.
- Smoke test F19B/F19C/F19E/F19F/F19G pass.
