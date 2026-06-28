# C5.2E - Checkpoint review Học phí / TBHP cloud source-of-truth

C5.2E STATUS: CHECKPOINT REVIEW ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
ATTENDANCE_TO_TUITION_AUTO_LINK: NO
TEACHER_CONSULTANT_DIRECT_WRITE: HOLD

## 1. Mục tiêu C5.2E

C5.2E tổng hợp checkpoint C5.2A/B/C/D cho Học phí / TBHP cloud source-of-truth. Pha này chỉ audit, xác nhận manual QA hiện tại, ghi accepted limitations, tạo tài liệu checkpoint và smoke test tĩnh.

Không có runtime change, không tạo hoặc chạy SQL, không thao tác Supabase, không commit, không push.

## 2. Trạng thái trước C5.2E

Trước C5.2C, các luồng cloud/core sync đã có nền tảng cho student/customer/payment/attendance/session-report style entities. Realtime subscriptions trước C5.2C chưa bao phủ riêng `tuition_record_package`; `class_session` có cloud/core sync nhưng không phải dedicated realtime subscription cho học phí.

Sau C5.2C, runtime đã có guarded bridge cho `tuition_record_package`, giữ local-first/cloud-write-through và fallback an toàn qua localStorage key `ichessCenterOS.tuition.dreamhome`.

## 3. Tóm tắt C5.2A

C5.2A thiết kế Học phí / TBHP cloud source-of-truth ở mức audit/preflight/design. Tài liệu đã xác định phạm vi bảng/entity, luồng local-first, guard role admin-style, realtime/parity kỳ vọng và các điều cấm.

Kết quả C5.2A: có tài liệu thiết kế và smoke test tài liệu, không runtime, không SQL, không Supabase action.

## 4. Tóm tắt C5.2B

C5.2B tạo manual readiness pack và read-only verification SQL cho `tuition_record_package`. Pha này không apply SQL và không thao tác Supabase từ Codex.

Gói readiness ghi nhận Không cần C5.2B-Apply vì remote verification cho cấu trúc cần thiết đã PASS theo xác nhận sau đó.

## 5. Tóm tắt C5.2B remote verification

C5.2B remote verification PASS.

Các dòng verification đã được user xác nhận:

- `tuition_record_package entity type exists: true`
- `tuition_record_package payload supported: true`
- `tuition_record_package center scope supported: true`
- `tuition_record_package local_id format supported: true`
- `tuition_record_package realtime/readiness accepted: true`

Kết luận readiness: không cần C5.2B-Apply, không cần apply SQL trong C5.2C/C5.2D/C5.2E.

## 6. Tóm tắt C5.2C

C5.2C implement runtime guarded bridge cho `tuition_record_package` trong `src/cloud-tuition-record-package-bridge.js` và hook an toàn trong `src/main.js`.

Runtime hiện tại:

- Entity type: `tuition_record_package`
- Local id format: `tuition_record_package::<record.id>`
- Local storage fallback: `ichessCenterOS.tuition.dreamhome`
- Local-first save vẫn chạy trước cloud write-through
- Cloud write-through chạy fire-and-forget để không chặn thao tác học phí
- Pull/merge giữ local khi cloud thiếu hoặc soft delete
- Realtime merge chỉ cập nhật local sau khi qua guard/fallback logic
- Role guard admin-style cho owner/qtv/center_admin/admin
- Teacher/consultant direct write giữ HOLD

C5.2C không nối attendance sang học phí và không tự cập nhật `usedSessions`/`remainingSessions` từ attendance.

## 7. Tóm tắt C5.2D

C5.2D audit runtime C5.2C và tạo QA hai browser runbook cho Học phí/TBHP cloud parity + fallback. Pha này không thêm runtime.

Runbook C5.2D tập trung kiểm tra parity hai browser, realtime cho data mới/sửa sau C5.2C, Supabase row `entity_type = tuition_record_package`, local id đúng format, fallback/offline và các điều cấm với attendance.

## 8. Manual QA của user

Manual QA: PASS WITH ACCEPTED LIMITATION.

Ghi nhận hiện tại:

- Browser T/P ban đầu có thể lệch dữ liệu cũ.
- Data mới nhập hoặc sửa sau C5.2C sync realtime giữa hai browser.
- Supabase có row `entity_type = tuition_record_package`.
- `local_id` đúng form `tuition_record_package::<record.id>`.
- Fallback/offline: NOT TESTED.
- Không quan sát thấy attendance auto-link sang học phí.

## 9. Accepted limitations

Old local data mismatch: ACCEPTED LIMITATION. Dữ liệu local cũ giữa hai browser không đồng nhất không phải blocker vì C5.2C không scope full legacy tuition backfill.

New/edited data after C5.2C goes through cloud/realtime. Đây là tiêu chí chính của bridge hiện tại.

Production clean center later is not dependent on staging old data. Việc staging có dữ liệu cũ lệch không chặn rollout nếu production/clean center bắt đầu từ dữ liệu cloud nhất quán.

Fallback/offline: NOT TESTED. Không fake pass cho fallback manual QA.

Conflict UI, audit trail và rollback thuộc C5.3 hoặc roadmap sau.

Teacher/consultant QA may be NOT TESTED. TEACHER_CONSULTANT_DIRECT_WRITE: HOLD.

## 10. Những gì C5.2 không làm

C5.2 không thực hiện các việc sau:

- Không apply SQL.
- Không chạy Supabase action từ Codex.
- Không commit.
- Không push.
- Không full legacy tuition backfill.
- Không conflict UI/audit/rollback hoàn chỉnh.
- Không tự nối attendance sang học phí.
- Không tự cập nhật `usedSessions` hoặc `remainingSessions` từ attendance.
- Không mở teacher/consultant direct write.

## 11. Runtime hiện tại

Runtime bridge hiện tại nằm ở `src/cloud-tuition-record-package-bridge.js`, được gọi từ `src/main.js`.

Bridge giữ nguyên local-first behavior: thao tác học phí lưu local trước, sau đó cloud write-through nếu runtime/user/role/center đủ điều kiện. Khi cloud lỗi hoặc offline, local data vẫn là nguồn fallback an toàn.

## 12. Cloud/Supabase state

Cloud/Supabase state theo C5.2B remote verification và manual QA:

- `tuition_record_package` đã sẵn sàng ở remote.
- Supabase có row `entity_type = tuition_record_package` cho dữ liệu mới/sửa.
- Không có yêu cầu SQL apply trong C5.2E.
- SQL: NOT CREATED / NOT RUN.
- SUPABASE ACTION: NOT RUN.

## 13. Data model / entity

Data model checkpoint:

- Entity type: `tuition_record_package`
- Local id format: `tuition_record_package::<record.id>`
- Payload giữ dữ liệu gói học phí/TBHP theo record local hiện có.
- Payload marker giữ rõ không tự nối attendance: `attendanceLinked: false`.
- Payload marker giữ rõ không auto update từ attendance: `usedSessionsAutoUpdateFromAttendance: false` và `remainingSessionsAutoUpdateFromAttendance: false`.

## 14. Role guard

Role guard hiện tại là admin-style. Các role được phép write cloud trong bridge: owner, qtv, center_admin, admin.

TEACHER_CONSULTANT_DIRECT_WRITE: HOLD.

Teacher/consultant không được mở direct write trong C5.2. Nếu cần mở sau này phải có prompt/phase riêng và QA role riêng.

## 15. Local fallback

Local fallback dùng storage key `ichessCenterOS.tuition.dreamhome`.

Bridge không xóa local tuition khi cloud thiếu record hoặc báo soft delete. Hành vi checkpoint: local preserved for safety.

Fallback/offline manual QA hiện tại: NOT TESTED. Đây là accepted limitation, không được tính là pass đã kiểm chứng.

## 16. Realtime/parity

Realtime/parity checkpoint:

- Data mới hoặc chỉnh sửa sau C5.2C sync realtime giữa hai browser theo manual QA.
- Old local mismatch được chấp nhận là limitation vì không backfill legacy data.
- C5.2D runbook vẫn là tài liệu thao tác chính nếu cần chạy lại QA hai browser.

## 17. TBHP behavior

TBHP/Học phí hiện giữ behavior local-first. Các thao tác save gói học phí và thanh toán học phí vẫn cập nhật local trước.

Cloud bridge ghi payload `tuition_record_package` để đồng bộ record mới/sửa, không đổi luật nghiệp vụ TBHP ngoài phạm vi sync.

## 18. Attendance relation

ATTENDANCE_TO_TUITION_AUTO_LINK: NO.

C5.2 không nối attendance sang học phí. Không có auto-link từ attendance, không tự tăng/giảm `usedSessions`, không tự tính `remainingSessions` từ điểm danh.

Nếu cần quan hệ attendance-học phí trong tương lai, phải làm bằng phase riêng, có thiết kế, QA và rollback rõ ràng.

## 19. Risks còn lại

Rủi ro còn lại:

- Fallback/offline chưa được manual QA.
- Old local data mismatch tồn tại ở staging/browser cũ.
- Chưa có conflict UI khi hai browser sửa cùng một record gần đồng thời.
- Chưa có audit trail/rollback chuyên biệt cho học phí.
- Teacher/consultant direct write vẫn HOLD và có thể cần QA riêng nếu mở sau này.

## 20. PASS / NEEDS REVIEW criteria

PASS khi:

- Tài liệu C5.2A/B/C/D tồn tại và checkpoint C5.2E tổng hợp đúng phạm vi.
- C5.2B remote verification PASS được ghi rõ.
- Manual QA hiện tại ghi `Manual QA: PASS WITH ACCEPTED LIMITATION`.
- Accepted limitations được ghi rõ, không fake pass fallback/offline.
- Runtime bridge hiện tại vẫn có `tuition_record_package`.
- Không có runtime change trong C5.2E.
- Không tạo/chạy SQL, không Supabase action, không commit, không push.
- Không attendance-to-tuition auto-link.
- Teacher/consultant direct write vẫn HOLD.

NEEDS REVIEW nếu:

- Cần apply SQL.
- Cần Supabase action từ Codex.
- Runtime C5.2C thiếu bridge/blocker nghiêm trọng.
- Manual QA cho data mới/sửa không sync realtime.
- Phát hiện attendance tự động tác động học phí.
- Phát hiện teacher/consultant direct write đã mở ngoài phạm vi.

## 21. Recommendation

GO for C5.2F - Commit local C5.2 checkpoint.

No push unless user explicitly requests.

## 22. Next roadmap

Roadmap đề xuất sau checkpoint:

- C5.2F: commit local C5.2 checkpoint, không push nếu user chưa yêu cầu.
- C5.3: conflict UI, audit trail, rollback và fallback/offline QA sâu hơn.
- Phase riêng nếu cần legacy tuition backfill.
- Phase riêng nếu cần thiết kế attendance-to-tuition relationship.
- Phase riêng nếu cần mở teacher/consultant write với role QA đầy đủ.
