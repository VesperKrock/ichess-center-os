# C5.2C - Runtime guarded bridge cho Học phí / TBHP cloud

Markers:

- SQL: NOT CREATED / NOT RUN
- SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE
- COMMIT: NOT RUN
- PUSH: NOT RUN
- ATTENDANCE_TO_TUITION_AUTO_LINK: NO
- TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.2C

C5.2C implement runtime guarded bridge cho Học phí/TBHP qua `center_cloud_entities` với entity:

```txt
tuition_record_package
```

Mục tiêu là local-first, cloud write-through sau, có role guard admin-style, pull/merge an toàn và realtime subscription theo center. C5.2C không làm SQL, không commit/push và không nối attendance sang học phí.

## 2. Trạng thái trước C5.2C

Cloud/core sync entities hiện có trước C5.2C:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Realtime subscriptions wired hiện có trước C5.2C:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`

`class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng được xác nhận trong workspace hiện tại.

C5.2C bổ sung runtime bridge/subscription cho `tuition_record_package`.

## 3. C5.2B verification PASS

User đã xác nhận:

- `allowlist_has_tuition_record_package: true`
- `realtime_has_center_cloud_entities: true`
- `replica_identity_full: true`
- `has_can_write_center: true`
- `has_is_center_member: true`

Vì vậy C5.2C không cần SQL apply.

## 4. Files runtime đã tạo/sửa

Runtime:

- `src/cloud-tuition-record-package-bridge.js`
- `src/main.js`

Docs/tests:

- `docs/supabase-c5-2c-runtime-guarded-hoc-phi-tbhp-cloud.md`
- `tests/supabase-c5-2c-runtime-guarded-hoc-phi-tbhp-cloud-smoke.js`

## 5. Entity tuition_record_package

Canonical C5.2 entity:

```txt
tuition_record_package
```

C5.2C không dùng các legacy dry-run entity `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment` làm source-of-truth mới.

## 6. LocalStorage keys giữ nguyên

C5.2C giữ nguyên local keys:

- `ichessCenterOS.tuition.dreamhome`
- `ichessCenterOS.tuitionPackages.dreamhome`
- `ichessCenterOS.attendanceAdvisoryNotes.dreamhome`

Không rename key, không reset localStorage, không seed đè dữ liệu người dùng.

## 7. local_id strategy

Runtime bridge dùng:

```txt
tuition_record_package::<record.id>
```

Không dùng `studentId` đơn lẻ làm `local_id`, vì một học viên có thể có nhiều gói/kỳ học phí.

## 8. Payload model

Payload preserve record học phí hiện có:

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
- `currentTermId`
- `currentTermNumber`
- `startedAt`
- `termHistory`
- `createdAt`
- `updatedAt`

Metadata cloud tối thiểu:

- `localId`
- `centerId`
- `schemaVersion`
- `source`
- `deletedAt`

Bridge cũng ghi marker payload `attendanceLinked: false`, `attendanceAutoUpdateEnabled: false`, `usedSessionsAutoUpdateFromAttendance: false`, `remainingSessionsAutoUpdateFromAttendance: false`.

## 9. Pull/merge strategy

Khi user signed-in và center/cloud ready, `main.js` gọi pull `tuition_record_package`.

Nếu cloud có records:

- Merge theo `local_id`.
- Cloud mới hơn theo `updatedAt` được nhập vào local.
- Cloud record mới được thêm vào local.
- Sau merge mới ghi lại `ichessCenterOS.tuition.dreamhome`.

Nếu cloud empty:

- Không xóa local.
- Chỉ ghi trạng thái cloud ready/fallback.

Nếu cloud error:

- Không xóa local.
- Local vẫn là fallback.

Cloud soft delete hiện chỉ được ghi nhận và bỏ qua để bảo toàn local; C5.2C không hard delete local.

## 10. Write-through strategy

Hai hook runtime hiện có được nối:

- Lưu/gia hạn/gán gói học phí.
- Lưu thanh toán học phí.

Trình tự:

1. Local save bằng `saveStoredTuition(tuitionRecords)`.
2. Sau đó gọi `writeC52TuitionRecordPackageThroughCloud(...)`.
3. Nếu cloud fail, local save vẫn giữ.

`updatedAt` được set khi thao tác Học phí hiện tại lưu. Không có write-through từ attendance/session_report.

## 11. Role guard

Cloud write chỉ cho admin-style roles:

- `owner`
- `qtv`
- `center_admin`
- `admin`

Teacher/consultant direct write: HOLD.

Runtime bridge dùng `canWriteC52TuitionRecordPackageEntity` và không mở write cho `teacher`, `consultant`, `viewer`.

## 12. Local fallback

Local fallback vẫn là localStorage Học phí. Cloud empty/error không xóa local, không block local save và không hard delete cloud data.

## 13. Realtime/subscription nếu có

C5.2C thêm guarded subscription:

- Table: `public.center_cloud_entities`.
- Filter: `center_id=eq.<centerId>`.
- Entity accepted: `tuition_record_package`.
- Duplicate subscription guard: không subscribe lại nếu center đã active.
- Cleanup: `stopC52TuitionRealtimeSubscription`.
- Merge: theo `local_id`/`updatedAt`.

Realtime event không tạo attendance side effect.

## 14. TBHP behavior

TBHP tiếp tục đọc từ `tuitionRecords` local đã merge. C5.2C không sync `attendanceAdvisoryNotes`, không tự sinh TBHP và không biến TBHP thành dữ liệu tài chính riêng.

## 15. Những gì C5.2C không làm

C5.2C không:

- Không tạo/chạy SQL.
- Không apply Supabase schema.
- Không hard delete local/cloud.
- Không tạo bảng tuition riêng.
- Không sync all modules đại trà.
- Không backfill hàng loạt.
- Không tự sinh TBHP.
- Không mở signUp.
- Không commit/push.

## 16. Không attendance -> tuition auto-link

C5.2C không nối `attendance_record` sang `tuition_record_package`.

C5.2C không đọc attendance/session_report để tự tăng `usedSessions`, không tự cập nhật `remainingSessions`, không tự tính nợ/phí từ attendance và không tự trừ buổi.

## 17. Risks/limitations

- C5.2C chỉ xử lý bridge guarded tối thiểu; conflict UI/audit log để C5.3.
- Cloud soft delete được bảo toàn local thay vì xóa local.
- Local records thiếu `id` ổn định sẽ bị skip cloud write; runtime hiện đã có pattern tạo id khi save form.
- Cần QA hai browser để xác nhận realtime parity trên remote thật.

## 18. Manual QA plan C5.2D

Đề xuất C5.2D:

1. Hai browser T/P cùng login admin-style.
2. Browser T sửa Học phí một học viên.
3. Browser P reload hoặc nhận realtime.
4. Kiểm tra local fallback khi cloud unavailable.
5. Kiểm tra cloud empty không xóa local.
6. Kiểm tra teacher/consultant không direct write.
7. Kiểm tra TBHP không tự sinh/trừ từ attendance.
8. Kiểm tra `usedSessions` chỉ đổi khi thao tác Học phí hiện tại đổi.

## 19. Next recommendation

Nếu C5.2C PASS, bước tiếp theo là C5.2D - QA hai browser Học phí/TBHP cloud parity + fallback.

