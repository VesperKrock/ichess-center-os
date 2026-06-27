# C5.0 - Realtime Sensitive Workflow Preflight

## 1. Summary

C5.0 là preflight, không runtime. Phase này chỉ audit hiện trạng và khóa roadmap cho các nghiệp vụ nhạy cảm sau khi C4/F22 đã commit và push online alpha.

F22 đã push online alpha tại GitHub Pages sau checkpoint `3ea85dd F22 feedback modules and data links MVP`. C5 sẽ xử lý Điểm danh, Báo cáo ca dạy, Học phí, TBHP và audit/conflict/rollback nên cần audit trước, không sửa dữ liệu Supabase, không apply SQL, không thêm runtime nghiệp vụ mới.

## 2. Current data map

| Domain | Current source | Local key/helper | Cloud entity | Realtime status | Risk |
| --- | --- | --- | --- | --- | --- |
| Điểm danh | Read model hợp nhất từ `sessionReports.attendance` và `attendanceRecords`; dữ liệu nền từ baseline; admin/teacher có thể ghi record local. | `ichessCenterOS.sessionReports.dreamhome`, `ichessCenterOS.attendanceRecords.dreamhome`, `ichessCenterOS.attendanceBaselineState.dreamhome`; `src/attendance-records.js`, `src/attendance-board-module.js`. | Dry-run/helper có `attendance_record`; baseline có `attendance_baseline_state`; chưa nằm trong allowlist runtime core `CLOUD_ENTITY_TYPES`. | Chưa realtime production. Chỉ có dry-run/merge helper F19H, chưa subscribe runtime. | Nhiều nguồn: report/import/baseline/admin/teacher; dễ trùng record theo report snapshot và canonical; cần rule ưu tiên trước khi realtime. |
| Báo cáo ca dạy | Giáo viên mở từ Thời khóa biểu, lưu vào `sessionReports`; attendance trong report là snapshot/legacy adapter, không phải canonical cuối cùng. | `ichessCenterOS.sessionReports.dreamhome`; `src/schedule-module.js`, `src/schedule-deadline.js`, `src/cloud-session-reports.js`. | Dry-run/helper có `session_report`; payload ghi `attendanceIsCanonical: false`, `canonicalAttendanceEntity: 'attendance_record'`. | Chưa realtime production toàn bộ nguồn. | Báo cáo ca dạy vừa chứa nội dung học, vừa chứa điểm danh snapshot; nếu realtime trước khi tách source of truth có thể ghi đè attendance canonical. |
| Học phí | LocalStorage là nguồn vận hành hiện tại; nối học viên bằng `studentId`; payment và term history nằm trong payload học phí. | `ichessCenterOS.tuition.dreamhome`; `src/tuition-module.js`, `src/student-tuition-links.js`, `src/cloud-tuition-records.js`, `src/cloud-tuition-terms.js`. | Dry-run/helper có `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment`; chưa source of truth cloud production. | Chưa realtime/cloud source of truth. | Dữ liệu tài chính nhạy cảm; `usedSessions` hiện vẫn là field nhập/duy trì trong học phí, chưa tự ăn attendance; conflict payment/history dễ mất tiền sử nếu latest-wins. |
| TBHP | Chưa thấy module TBHP riêng; hiện mới có cảnh báo chăm sóc học phí từ remaining/debt và notification type `tuition` trong runtime. | Tính từ `tuitionRecords`, `buildTuitionWarningNotifications`, student/parent link helper. | Chưa có entity TBHP riêng. | Chưa realtime. | Nếu gửi thông báo trước khi học phí là source of truth sẽ có nguy cơ báo sai nợ, sai số buổi còn lại. |
| Audit/conflict/rollback | Có audit cục bộ cho baseline attendance; có backup trước cloud pull; có conflict TKB UI; chưa có audit log dùng chung. | `attendanceBaselineState.auditLog`; `ichessCenterOS.backup.beforeCloudPull.*`; `createCloudDbPullBackup`; schedule conflict helpers. | `center_cloud_entities` có metadata `source_module`, `source_version`, `created_by`, `updated_by`, `deleted_at`; core cloud hiện chỉ allow `student`, `teacher`, `class_session`. | Realtime runtime hiện có student/teacher/schedule_session, merge theo `updatedAt`; chưa có conflict UI chung cho attendance/tuition. | Latest-wins không đủ cho attendance/tuition; rollback hiện thiên về backup local trước pull, chưa có restore UX và audit trail cloud. |

## 3. Điểm danh audit notes

- Điểm danh đọc qua `buildUnifiedAttendanceRecords({ sessionReports, storedRecords })`.
- `sessionReports.attendance` đang là nguồn legacy/report snapshot để adapter tạo record, không nên coi là canonical duy nhất trong C5.
- `attendanceRecords` local canonical hiện có qua key `ichessCenterOS.attendanceRecords.dreamhome`, gồm nguồn `initialBaseline`, `admin`, `teacher`, `consultant`, `correction`.
- Baseline state nằm tại `ichessCenterOS.attendanceBaselineState.dreamhome`, có trạng thái `notStarted/draft/locked/unlocked` và `auditLog`.
- Module 13 đọc unified records, render read-model theo tháng/lớp, có nguồn báo cáo, Angel Wings/import, baseline và dữ liệu thật; demo cũ được loại khỏi real mode.
- Record readonly/report/imported/admin/consultant cần phân quyền rõ: report/import là snapshot hoặc dữ liệu nạp kiểm soát; admin/consultant có quyền sửa sau; teacher chỉ ghi ca của mình; baseline chỉ chỉnh khi chưa locked.
- Nguồn dễ conflict: cùng học viên/ngày/ca có teacher record, admin record, report snapshot và baseline; C5.1 cần rule ưu tiên và conflict warning.

## 4. Báo cáo ca dạy audit notes

- Giáo viên mở báo cáo từ Thời khóa biểu qua panel session report của `src/schedule-module.js`.
- Báo cáo lưu local vào `sessionReports`, mỗi report định danh bằng `sessionId + occurrenceDate`.
- Status `teacherSubmitted`, `adminHandled`, `overdueTeacher`, `adminHandledMissingTeacherReport` được tính trong `src/schedule-deadline.js`.
- Deadline giáo viên là 10:00 ngày hôm sau; admin review đang tính 48 giờ sau khi ca kết thúc.
- Báo cáo ca dạy liên quan trực tiếp tới điểm danh vì có `attendance`; liên quan gián tiếp tới học phí vì attendance counted có thể ảnh hưởng `usedSessions` trong tương lai, nhưng hiện chưa tự trừ buổi học phí.

## 5. Học phí / TBHP audit notes

- Học phí dùng local key `ichessCenterOS.tuition.dreamhome`.
- Cloud dry-run đã có nhóm entity `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment`; các helper đều đang ở trạng thái cần SQL/allowlist patch nếu muốn real push.
- Học phí hiện nối với học viên bằng `studentId`; F22.4 bổ sung helper đọc parent/student/tuition nhưng không ghi cloud/realtime.
- `usedSessions` hiện vẫn là field trong tuition record và có thể nhập/sửa thủ công; attendance advisory chỉ đọc để cảnh báo, chưa tự đồng bộ attendance sang học phí.
- TBHP chưa có module/source of truth riêng; hiện mới có cảnh báo học phí trong module học phí và notification nội bộ type `tuition`.
- Realtime học phí trước khi chuẩn hóa điểm danh sẽ rủi ro vì số buổi còn lại có thể lệch giữa `usedSessions` nhập tay và attendance counted.

## 6. C5.1 plan - Điểm danh / báo cáo ca dạy realtime

- Entity cần realtime: `attendance_record`, `attendance_baseline_state`, `session_report`; nếu cần có thể đọc thêm `schedule_session` đã có runtime guarded.
- Read path: online signed-in đọc cloud cho entity đã migrate, sau đó merge non-destructive vào local cache; offline đọc localStorage hiện có.
- Write path: teacher/admin/consultant ghi local trước, cloud push explicit/guarded sau khi readiness pass; không ghi đè report snapshot thành canonical.
- Realtime subscription: subscribe theo `center_id` và entity type; bỏ qua echo không hợp lệ; không mở big bang cho tuition.
- Conflict behavior: cùng student/date/session có nhiều nguồn thì ưu tiên admin/consultant reviewed, sau đó teacher canonical, sau đó report snapshot, sau đó baseline; khi `updatedAt` đụng nhau hoặc khác source thì hiển thị conflict, không auto mất dữ liệu.
- Manual QA: hai trình duyệt cùng center; giáo viên gửi báo cáo trước 10:00; admin sửa attendance; import/baseline vẫn hiển thị đúng; offline reload không mất cache; report attendance không bị nhân đôi vào Module 13.
- Không làm gì: không auto trừ học phí, không gửi TBHP, không chỉnh bảng Supabase, không Teacher Portal/Super Admin, không image check-in/out.

## 7. C5.2 plan - Học phí / TBHP cloud source of truth

- Học phí cloud source of truth: migrate `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment` sau khi SQL/allowlist được duyệt và dry-run sạch.
- TBHP: thiết kế entity hoặc read model riêng cho thông báo học phí, chỉ phát khi tuition cloud đã là source of truth và parent/student relation đã chuẩn.
- Student/parent/tuition relation: khóa `studentId` là khóa chính; không fallback match tên cho ghi cloud; parent phone chỉ để hiển thị/liên hệ.
- Attendance -> `usedSessions`: chỉ bật sau khi C5.1 có canonical attendance ổn định, rule counted/paid/trial/makeup rõ và có manual override/audit.
- Risk: payment/history là dữ liệu tiền; cần append/audit hoặc conflict UI, không dùng latest-wins thô cho mảng `payments` và `termHistory`.

## 8. C5.3 plan - Audit log / conflict / rollback

- Audit log: entity hoặc payload audit dùng chung cho attendance/session_report/tuition; ghi actor, role, before/after tối thiểu, reason và source module.
- Conflict detection: phát hiện khác source, khác `updatedAt`, khác phiên bản payload, và conflict mảng payment/history; không auto resolve dữ liệu tài chính.
- Soft delete: dùng `deleted_at`/`deletedAt` có actor và reason; runtime không hard delete entity đã migrate trừ khi có runbook riêng.
- Rollback/restore: backup localStorage trước pull/migration; snapshot theo entity; restore UX/manual runbook cho từng domain.
- Backup localStorage: giữ các key điểm danh, baseline, sessionReports, tuition, tuitionPackages trước mọi pull hoặc migration; ghi rõ backup key trong UI/log.

## 9. SQL / Supabase readiness

SQL APPLY: NO

Supabase data change: NO

SQL proposal: chưa apply và chưa tạo file SQL mới trong C5.0. Nếu C5.1/C5.2 cần SQL, chỉ viết runbook/proposal với mục đích, môi trường, destructive/non-destructive, backup, thứ tự apply, verify và rollback. C5.0 không chạy SQL, không sửa table/bucket/policy, không seed cloud.

Readiness hiện tại:

- `center_cloud_entities` core runtime hiện chỉ allow `student`, `teacher`, `class_session` trong `src/cloud-db-entities.js`.
- Các entity nhạy cảm đã có helper dry-run F19H nhưng cần review SQL allowlist/RLS/realtime publication trước khi real push.
- Legacy RLS policies còn song song cần audit lại trước khi mở rộng realtime nhạy cảm.

## 10. Known risks

- Legacy RLS policies còn song song.
- `schedule_session` cloud ban đầu 0 có thể làm QA hiểu nhầm dữ liệu TKB đã đầy đủ.
- Học phí chưa cloud source of truth.
- Báo cáo chưa realtime production toàn bộ nguồn.
- Điểm danh có nhiều nguồn: report/import/baseline/admin/teacher/consultant.
- Realtime merge có thể gây conflict nếu nhiều người sửa cùng ca/học viên.
- Ảnh check-in/out giáo viên để future workflow, không làm trong C5.0.
- `sessionReports.attendance` dễ bị hiểu nhầm là canonical attendance nếu không tách rõ trong C5.1.
- Payment/term history không an toàn nếu merge latest-wins theo whole record.
- Rollback hiện có backup trước cloud pull nhưng chưa có restore UI chuẩn cho từng entity.

## 11. Rollback / manual QA runbook

- Rollback C5.0: vì chỉ thêm docs/smoke, rollback là bỏ hai file C5.0 mới; không có SQL hoặc cloud data để rollback.
- Manual QA C5.1 trước khi implement: kiểm Module 13 với local report, baseline locked/unlocked, teacher/admin attendance, Angel Wings import, reload offline.
- Manual QA C5.2 trước khi implement: kiểm học phí theo `studentId`, tạo/gia hạn kỳ, ghi payment, tính nợ, cảnh báo còn buổi, không tự trừ từ attendance.
- Manual QA C5.3 trước khi implement: tạo conflict hai tab, kiểm audit entry, soft delete, backup key, restore bằng snapshot.

## 12. Recommendation

Next recommended phase: C5.1 — Điểm danh / báo cáo ca dạy realtime

Preconditions:

- Chốt rule canonical attendance: admin/consultant/teacher/report/baseline/import.
- Chốt conflict behavior cho cùng student/date/session.
- Review SQL allowlist/RLS/realtime publication bằng runbook riêng, có user approval.
- Chạy manual QA hai trình duyệt trên staging/alpha, không seed hoặc overwrite dữ liệu thật.
