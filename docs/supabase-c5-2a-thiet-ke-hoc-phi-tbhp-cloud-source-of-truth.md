# C5.2A - Thiết kế Học phí / TBHP cloud source-of-truth

## 1. Trạng thái hiện tại

C5.2A là phase audit/preflight/design sau checkpoint C5.1F. Repo hiện ở nhánh `main`, latest commit mong đợi là `76a5f51 C5.1 attendance session report realtime checkpoint`, và C5.2A không commit/push.

Cloud/core sync entities hiện có:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Realtime subscriptions wired hiện có:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

`class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.

Entity liên quan C5.2 đã nằm trong allowlist theo handover/C5.1B:

- `tuition_record_package`

## 2. Phạm vi C5.2A

C5.2A chỉ làm:

- Audit hiện trạng Học phí/TBHP trong `src`, `docs`, `tests`.
- Thiết kế source-of-truth cloud an toàn cho Học phí/TBHP.
- Xác định payload, local id, luồng đọc/ghi, role guard, fallback, realtime, conflict và QA plan.
- Tạo tài liệu này và smoke test kiểm tra tài liệu.

## 3. Những gì C5.2A không làm

C5.2A không runtime implementation, không SQL, không Supabase action, không tạo SQL apply file, không commit, không push, không backfill, không seed đè dữ liệu.

C5.2A không nối attendance sang học phí, không tự động cập nhật `usedSessions`, không tự động cập nhật `remainingSessions`, không tự động sinh TBHP, không mở teacher/consultant direct write, và không sửa module Học phí, Bảng điểm danh, Thời khóa biểu hoặc cloud write-through runtime.

## 4. Audit dữ liệu Học phí/TBHP hiện tại

### Storage hiện tại

Học phí hiện lưu localStorage qua `src/storage.js` với key:

```txt
ichessCenterOS.tuition.dreamhome
```

Catalog gói học phí/fixture Angel Wings hiện có key phụ:

```txt
ichessCenterOS.tuitionPackages.dreamhome
```

TBHP/chăm sóc cuối tháng lưu note riêng qua key:

```txt
ichessCenterOS.attendanceAdvisoryNotes.dreamhome
```

### Model hiện tại

Runtime Học phí hiện dùng mảng record theo học viên. Các field đã thấy trong code gồm:

- `id`
- `studentId`
- `packageName`
- `totalSessions`
- `usedSessions`
- `totalAmount`
- `discountType`
- `discountValue`
- `discountAmount`
- `paidAmount`
- `dueDate`
- `note`
- `payments`
- `currentTermNumber`
- `currentTermId`
- `startedAt`
- `termHistory`
- các flag/source fixture như `hasTotalSessionsData`, `hasUsedSessionsData`, `sourceModule`, `sourceTag`, `importBatchId`, `datasetId`, `datasetVersion`, `isControlledFixture`, `createdAt`, `updatedAt`

`remainingSessions` hiện chủ yếu là giá trị tính khi render từ `totalSessions - usedSessions`, không phải field lưu canonical riêng.

### Luồng runtime hiện tại

`src/main.js` khởi tạo `tuitionRecords = getStoredTuition(createSampleTuitionRecords(students))`. Khi gán/cập nhật/gia hạn gói hoặc lưu thanh toán, runtime gọi `saveStoredTuition(tuitionRecords)`.

Khi lưu thanh toán, runtime tăng `paidAmount`, thêm item vào `payments`, và gọi `syncTuitionPaymentToCashflow`. Đây là nối Học phí sang Thu Chi hiện có, không phải cloud source-of-truth C5.2A.

Gia hạn gói tạo snapshot kỳ cũ trong `termHistory`, reset gói/kỳ hiện tại và có thể tạo payment ban đầu nếu có `paidAmount`.

### TBHP hiện tại

TBHP hiện nằm trong khối/bảng chăm sóc cuối tháng của module Học phí, qua `buildAttendanceAdvisoryRows` trong `src/attendance-advisory.js` và render trong `src/tuition-module.js`.

TBHP hiện đọc:

- `students`
- `tuitionRecords`
- `sessionReports`
- `attendanceAdvisoryNotes`
- `monthKey`

Nếu có `session_report` trong tháng, bảng TBHP dùng số buổi học từ report để hiển thị gợi ý chăm sóc. Nếu chưa có report, bảng fallback sang `tuition.usedSessions`. Luồng này là read/display/advisory; không ghi ngược vào gói học phí.

Chưa thấy runtime đọc trực tiếp `attendance_record` để trừ buổi học phí. Có đọc `session_report` cho bảng advisory/TBHP, nhưng không tự cập nhật `usedSessions` hoặc `remainingSessions` vào storage học phí.

### Liên kết Học viên / Phụ huynh / Học phí

F22.4 đã nối read-only Học viên ↔ Phụ huynh ↔ Học phí qua `src/student-tuition-links.js`, `src/student-detail.js`, `src/tuition-module.js`. Liên kết dùng `studentId`, dữ liệu phụ huynh nằm trên hồ sơ học viên, và Học phí được tìm theo `record.studentId`.

Mức nối hiện tại là hiển thị/tóm tắt/cảnh báo chăm sóc. Không ghi ngược parent/student từ học phí, không tạo cloud source-of-truth Học phí, không realtime production cho Học phí.

### Cloud bridge hiện có

Repo có helper dry-run cũ:

- `src/cloud-tuition-records.js`: chuẩn bị `tuition_record` và `tuition_package`.
- `src/cloud-tuition-terms.js`: chuẩn bị `tuition_term` và `tuition_payment`.

Các helper này là dry-run/readiness từ F19H, không phải C5.2 runtime đang bật. `src/cloud-db-entities.js` core allowlist runtime vẫn chỉ có `student`, `teacher`, `class_session`.

Runtime chưa có cloud bridge thật cho `tuition_record_package`. Chưa có realtime subscription cho `tuition_record_package`.

## 5. Đề xuất canonical entity: tuition_record_package

Canonical entity cho C5.2 nên là:

```txt
tuition_record_package
```

Lý do:

- Entity này đã nằm trong allowlist expected của `center_cloud_entities` theo handover/C5.1B.
- Phù hợp để gom dữ liệu học phí/package hiện đang sống cùng nhau trong local record.
- Giữ được localStorage fallback `ichessCenterOS.tuition.dreamhome`.
- Có thể mở write-through cloud guarded ở phase runtime sau mà không cần tách nhiều entity quá sớm.
- Tránh lặp lại F19H `tuition_record`/`tuition_package` như hai canonical mới khi C5.2 đã có allowlist/handover riêng.

Mapping đề xuất:

- Local record hiện tại trong `ichessCenterOS.tuition.dreamhome` → cloud entity `tuition_record_package`.
- F19H `tuition_record` và `tuition_package` → tài liệu tham khảo/dry-run legacy, không mở runtime trong C5.2A.
- `termHistory` và `payments` → nested payload trong `tuition_record_package` cho phase đầu; chỉ tách entity riêng nếu phase sau có nhu cầu query/audit đủ mạnh.

## 6. Đề xuất payload model

Field hiện có nên preserve:

- `id`
- `studentId`
- `packageName`
- `totalSessions`
- `usedSessions`
- `totalAmount`
- `discountType`
- `discountValue`
- `discountAmount`
- `paidAmount`
- `dueDate`
- `note`
- `payments`
- `currentTermNumber`
- `currentTermId`
- `startedAt`
- `termHistory`
- `hasTotalSessionsData`
- `hasUsedSessionsData`
- `sourceModule`
- `sourceTag`
- `importBatchId`
- `datasetId`
- `datasetVersion`
- `isControlledFixture`
- `createdAt`
- `updatedAt`

Field đề xuất thêm/chuẩn hóa trong payload cloud:

- `localId`
- `centerId`
- `studentNameSnapshot`
- `parentNameSnapshot`
- `parentPhoneSnapshot`
- `packageType`
- `tuitionAmount` hoặc mapping từ `totalAmount`
- `debtAmount` dạng computed snapshot nếu cần hiển thị nhanh
- `paymentStatus`
- `startDate` hoặc mapping từ `startedAt`
- `endDate`
- `lastPaymentDate`
- `nextDueDate` hoặc mapping từ `dueDate`
- `status`
- `source`
- `schemaVersion`

Field future, chưa nên bắt buộc ở C5.2B/C đầu:

- `deletedAt` cho soft delete
- `auditTrail`
- `conflictState`
- `approvedBy`
- `reconciledAttendanceUntil`
- `attendanceReconciliationVersion`

Nguyên tắc: payload cloud C5.2 đầu tiên nên preserve record hiện có và thêm metadata tối thiểu. Không đổi nghĩa `usedSessions` từ nhập thủ công/local sang attendance-derived.

## 7. Natural key / local_id strategy

Ưu tiên local id:

```txt
tuition_record_package::<record.id>
```

Nếu record local đã có `id`, giữ nguyên để tránh đổi danh tính. Không dùng `studentId` đơn lẻ làm key vì một học viên có thể có nhiều gói/kỳ hoặc lịch sử gia hạn.

Nếu thiếu `id` ổn định, phase sau phải có migration/backfill dry-run trước khi runtime write. Candidate deterministic key chỉ để preview:

```txt
studentId + currentTermId
```

hoặc:

```txt
studentId + packageName + currentTermNumber + startedAt
```

Không quyết định cứng natural key thay thế trong C5.2A vì cần kiểm tra dữ liệu thật trong localStorage trước khi backfill.

## 8. Luồng đọc dữ liệu

Future runtime nên đọc theo thứ tự an toàn:

1. Load local `ichessCenterOS.tuition.dreamhome` trước để app không trắng dữ liệu.
2. Nếu cloud ready, signed-in, center membership ready và user có quyền đọc, pull `tuition_record_package`.
3. Nếu cloud empty, không seed đè local và không coi là dữ liệu thật đã bị xóa.
4. Merge cloud/local theo `local_id` và `updatedAt`.
5. Nếu conflict không rõ, giữ local, đánh dấu cần review thay vì overwrite.
6. Save local cache sau merge chỉ khi merge pass và có backup/preview ở phase runtime.

## 9. Luồng ghi dữ liệu

Future runtime nên theo nguyên tắc:

- Local save trước.
- Cloud write-through sau.
- Chỉ write khi cloud ready + signed-in + center membership ready + role được phép.
- Cloud error không xóa local và không rollback thao tác local của user.
- Upsert theo `center_id, entity_type, local_id`.
- Soft delete bằng `deletedAt`/`deleted_at`, không hard delete trong client.
- Không backfill tự động khi mở app; backfill cần preview và thao tác user explicit.

## 10. Role guard

Cloud write Học phí/TBHP chỉ cho admin-style roles:

- `owner`
- `qtv`
- `center_admin`
- `admin`

`admin` là alias policy/back-end cần tiếp tục hỗ trợ như C4/C5.1, dù runtime hiện normalize về `center_admin`.

Teacher/consultant direct write: HOLD.

Teacher/consultant có thể được thiết kế future read/propose/comment flow, nhưng không được ghi trực tiếp `tuition_record_package` trong C5.2A và không nên mở ở runtime C5.2 đầu nếu chưa có scoped policy.

## 11. Local fallback

Local fallback tiếp tục là:

```txt
ichessCenterOS.tuition.dreamhome
```

Yêu cầu fallback:

- Local luôn giữ được dữ liệu khi cloud lỗi.
- Cloud empty không xóa local.
- Pull cloud phải có backup trước khi ghi lại local.
- Parse lỗi localStorage thì xử lý như runtime hiện tại, nhưng phase cloud sau nên có backup và cảnh báo rõ hơn.
- Không seed đè dữ liệu người dùng bằng sample data khi đã có dữ liệu local/cloud hợp lệ.

## 12. Realtime strategy

C5.2A không thêm realtime runtime.

Future realtime cho `tuition_record_package` chỉ nên mở sau khi:

- SQL/manual readiness đã được duyệt ở phase riêng.
- `center_cloud_entities` allowlist remote xác nhận có `tuition_record_package`.
- Realtime publication đã sẵn sàng.
- Read/merge/write guard đã pass smoke và manual QA.

Subscription nên filter theo `center_id`, nhận `entity_type = tuition_record_package`, merge non-destructive theo `local_id`/`updatedAt`, bỏ qua echo cũ hơn, và không sinh side effect attendance/TBHP.

## 13. Conflict strategy tối thiểu

Conflict key:

```txt
centerId + entityType + localId
```

Quy tắc tối thiểu:

- Cùng key và `updatedAt` mới hơn: candidate merge.
- Cùng key nhưng cả hai phía cùng thay đổi field tiền/buổi quan trọng: HOLD, cần review.
- Missing `updatedAt`: không overwrite bản đang có nếu không có preview.
- Soft delete mới hơn chỉ ẩn record khi có `deletedAt` hợp lệ.
- Không hard delete local/cloud từ client.
- Nên ghi `conflictState`/warning trong phase sau nếu không resolve được.

## 14. Không nối attendance sang học phí trong C5.2A

C5.2A không nối attendance sang học phí.

C5.2A không tự trừ buổi, không cập nhật `usedSessions`, không cập nhật `remainingSessions`, không cập nhật `termHistory`, không chọn current term từ attendance, và không sinh TBHP tự động từ attendance.

Hiện TBHP có đọc `session_report` để hiển thị gợi ý chăm sóc tháng, nhưng đây không phải write-back vào học phí. Phase sau không được biến luồng đọc hiển thị này thành source-of-truth nếu chưa có reconciliation design riêng.

## 15. Quan hệ tương lai với attendance/session_report

Quan hệ tương lai nên là phase riêng, ví dụ C5.2D hoặc sau đó: attendance -> tuition reconciliation.

Điều kiện tối thiểu trước khi nối:

- `tuition_record_package` đã ổn định trên cloud.
- Current term/package được xác định từ Học phí, không suy từ attendance.
- Mỗi attendance candidate có preview, audit, rollback, manual approval.
- Có xử lý học bù, học thử, vắng phép, vắng không phép, lớp nhiều ca, học viên nhiều gói.
- Có conflict guard nếu nhiều máy cùng cập nhật.

## 16. TBHP strategy

TBHP nên đọc từ `tuition_record_package` sau khi source-of-truth ổn định.

TBHP không nên tự sinh dữ liệu tài chính riêng nếu chưa có canonical tuition package. Cần phân biệt:

- Dữ liệu gốc: `tuition_record_package`.
- Hiển thị/cảnh báo: bảng TBHP/chăm sóc.
- Note xử lý chăm sóc: `attendanceAdvisoryNotes` hoặc entity future riêng nếu cần workflow.

Trong phase runtime đầu, TBHP nên là read model/advisory. Không tự thay đổi học phí gốc.

## 17. Migration/backfill strategy cho phase sau

C5.2B/C nếu cần migration nên làm theo bước:

1. Dry-run đọc local `ichessCenterOS.tuition.dreamhome`.
2. Phân loại record thiếu `id`, thiếu `studentId`, thiếu package, thiếu số tiền/buổi.
3. Đề xuất `local_id` cho từng record, không ghi.
4. Preview số record valid/invalid/skipped.
5. User xác nhận thủ công.
6. Backup local trước khi bất kỳ pull/merge nào.
7. Chỉ write cloud sau khi SQL/readiness pass và role guard pass.

Không backfill tự động trong C5.2A.

## 18. SQL/manual pack cần hay không, để phase sau quyết định

C5.2A không tạo SQL và không chạy SQL.

Khuyến nghị: cần một phase C5.2B manual SQL/readiness pack nếu remote chưa chắc chắn có `tuition_record_package` trong constraint/allowlist và realtime publication. C5.2B chỉ nên tạo tài liệu/SQL manual pack, không apply tự động.

Nếu audit C5.2B xác nhận remote đã sẵn sàng, phase sau có thể chuyển sang runtime guarded bridge/read-only verification thay vì tạo thêm SQL.

## 19. Manual QA plan

Manual QA cho phase runtime sau nên có:

- Login bằng owner/qtv/center_admin/admin, xác nhận có quyền write.
- Login bằng teacher/consultant, xác nhận read-only/HOLD, không cloud write.
- Tạo/cập nhật gói học phí local, xác nhận local save trước.
- Mô phỏng cloud write fail, xác nhận local không mất.
- Mô phỏng cloud empty, xác nhận không seed đè/xóa local.
- Mô phỏng realtime event cũ hơn, xác nhận không overwrite.
- Mô phỏng soft delete, xác nhận không hard delete.
- Mở TBHP, xác nhận chỉ hiển thị/advisory, không ghi ngược học phí.
- Mở Bảng điểm danh/Báo cáo ca dạy, xác nhận không tự trừ buổi học phí.

## 20. Risks / blockers

Risks:

- Runtime hiện dùng `tuition_record`/`tuition_package` trong dry-run cũ, còn C5.2 đề xuất `tuition_record_package`; cần mapping kỹ ở phase sau.
- Local data có thể thiếu `id` ổn định hoặc có nhiều record cùng `studentId`.
- `usedSessions` hiện là dữ liệu nhập/lưu local, nhưng TBHP advisory có thể hiển thị số học từ `session_report`; dễ nhầm thành source-of-truth.
- Thanh toán học phí đang sync sang Thu Chi local; khi cloud hóa cần tránh double-write hoặc lệch tiền.
- Realtime conflict cho tiền/buổi nhạy cảm hơn student/teacher.
- Teacher/consultant write nếu mở sớm sẽ rủi ro nghiệp vụ và bảo mật.

Blocker cho runtime nếu chưa xử lý:

- Chưa có C5.2B readiness/SQL review cho `tuition_record_package`.
- Chưa có migration dry-run cho local id nếu dữ liệu thật thiếu id.
- Chưa có policy conflict/audit đủ cho field tiền/buổi.

## 21. Đề xuất phase tiếp theo

Nếu C5.2A pass, đề xuất tiếp theo:

- C5.2B: manual SQL/readiness pack cho `tuition_record_package`, không apply tự động.
- Sau đó C5.2C: runtime guarded bridge hoặc read-only verification, local-first, admin-style write only.
- Attendance -> tuition reconciliation để phase riêng sau khi `tuition_record_package` ổn định.

