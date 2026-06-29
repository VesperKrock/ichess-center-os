# C6.0 - Production readiness audit trước DreamHome production empty center

C6.0 STATUS: PRODUCTION READINESS AUDIT ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME_CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
PRODUCTION_CENTER_CREATED: NO
PRODUCTION_DATA_SEEDED: NO
STAGING_DATA_MIGRATED: NO
ANGEL_WINGS_MODIFIED: NO
LOCAL_STORAGE_RESET: NO
TEACHER_PORTAL_PUBLIC_DISCLOSURE: NO
SUPER_ADMIN_PUBLIC_DISCLOSURE: NO
CUSTOMER_FACING_DOCS_FOR_TEACHER_OR_SUPER_ADMIN: NO
C6.1_STARTED: NO

## 1. Mục tiêu C6.0

C6.0 là production readiness audit trước khi tạo DreamHome production empty center. Phase này chỉ đọc/audit/design/docs/test, không runtime, không SQL, không Supabase action, không commit và không push.

Mục tiêu chính:

- Phân biệt staging/current alpha với DreamHome production empty center.
- Audit cloud/auth/center binding/membership/role/entity readiness hiện tại.
- Ghi rõ rủi ro migrate/seed/clear nhầm dữ liệu.
- Thiết kế safety rules cho C6.1.
- Xác định có cần read-only verification plan hoặc manual Supabase plan cho C6.1 hay không.

## 2. Trạng thái trước C6.0

- Latest commit: `6fa4608 F23 feedback 2706 polish checkpoint`.
- Branch: `main...origin/main`.
- Worktree trước C6.0: clean.
- F23 đã checkpoint; C6.0 bắt đầu từ trạng thái không có dirty files.
- C5.1/C5.2/C5.3 đã có nền cloud/realtime cho các nghiệp vụ nhạy cảm theo checkpoint trước.

## 3. Kết quả audit Git/worktree

Lệnh audit ban đầu:

- `git status -sb`: `## main...origin/main`
- `git status --short`: không có output.
- `git log -1 --oneline`: `6fa4608 F23 feedback 2706 polish checkpoint`
- `git log --oneline -8`: xác nhận chuỗi C5.1, C5.2, C5.3 và F23 đã ở commit.

Kết luận: đủ điều kiện tạo docs/test C6.0. Không có file ngoài scope tại thời điểm bắt đầu.

## 4. Production vs staging

Staging/current alpha:

- Có thể có Angel Wings controlled staging dataset.
- Dùng để test cloud/realtime/UI/logic.
- Không được xem là dữ liệu production.
- Có các đường local restore/fixture phục vụ kiểm thử nội bộ.

DreamHome production empty center:

- Là center/cơ sở sạch để nhập dữ liệu thật.
- Không lẫn Angel Wings.
- Không lẫn seed/sample/demo cũ.
- Không backfill staging sang production nếu chưa có quyết định riêng.
- Phải có `center_id` hoặc `centerId` rõ ràng trước khi ghi cloud.

Khẳng định bắt buộc: Không migrate Angel Wings sang DreamHome production.

## 5. Current cloud/auth/center architecture

Workspace hiện tại có các thành phần chính:

- `src/supabase-auth.js`: `CURRENT_CENTER_ID = 'dreamhome'`, đăng nhập Supabase bằng email/password, đọc membership từ `center_members`.
- `src/app-center-binding.js`: default center binding trả về `id: dreamhome`, `name: DreamHome`.
- `src/app-login-gate.js`: dashboard unlock khi signed-in và center binding ready.
- `src/online-access-control.js`: normalize role và read/write guard.
- `src/cloud-db-sync.js`: đọc/ghi `center_cloud_entities`, kiểm tra `center_members`, phân loại lỗi schema/RLS/membership.
- `src/cloud-bootstrap.js`: bootstrap cloud cho `student`, `teacher`, `schedule_session`, fallback local-cache khi cloud empty/error.

Tóm tắt auth/membership/role: auth dùng Supabase Auth, membership dùng `center_members`, role guard nằm trong `online-access-control.js` và các bridge nhạy cảm.

Audit note: `dreamhome` hiện là single-center default trong runtime. C6.0 không đổi binding này; C6.1 phải xác nhận production center/membership trước mọi thao tác thật.

## 6. Entity readiness hiện tại

Entity đã có readiness hoặc runtime cloud path theo workspace:

- `student`: core cloud entity trong `cloud-db-entities.js`, write-through/realtime qua `cloud-realtime-students.js`.
- `teacher`: core cloud entity trong `cloud-db-entities.js`, write-through/realtime qua `cloud-realtime-teachers.js`.
- `class_session`: có cloud/core sync trong foundation cũ qua `cloud-db-entities.js` và `pushLocalCoreEntitiesToCloud`; không overclaim dedicated realtime subscription vì audit không thấy helper realtime riêng cho `class_session`.
- `schedule_session`: có entity builder/readiness trong `cloud-schedule-sessions.js`, bridge guarded trong `cloud-schedule-session-bridge.js`, realtime helper riêng.
- `attendance_record`: có builder/readiness trong `cloud-attendance-records.js`.
- `attendance_baseline_state`: có builder/readiness trong `cloud-session-reports.js`.
- `session_report`: có builder/readiness trong `cloud-session-reports.js`.
- `tuition_record_package`: có guarded bridge/runtime trong `cloud-tuition-record-package-bridge.js`.
- `audit_log_entry`: có write-through tối thiểu trong `cloud-audit-log.js`; rollback preview đọc `audit_log_entry` trong `cloud-rollback-preview.js`.

Tất cả entity trên đi qua bảng `center_cloud_entities` khi dùng cloud path. C6.0 không đọc remote và không xác nhận dữ liệu production thật đang tồn tại.

## 7. Realtime readiness hiện tại

Realtime subscription đã thấy trong workspace:

- `student`: `subscribeToStudentCloudRealtime`, filter `center_id=eq.<centerId>` trên `center_cloud_entities`.
- `teacher`: `subscribeToTeacherCloudRealtime`, filter `center_id=eq.<centerId>`.
- `schedule_session`: có helper realtime riêng và wiring trong `main.js`.
- `attendance_record`, `attendance_baseline_state`, `session_report`: C5.1 wiring realtime trong `main.js` với C5.1 attendance/session report flow.
- `tuition_record_package`: C5.2C có `subscribeToC52TuitionRecordPackageRealtime`.

Không overclaim: `class_session` có cloud/core sync trong foundation cũ, nhưng C6.0 không xác nhận dedicated realtime subscription riêng cho `class_session`.

## 8. Auth/membership/role readiness

Auth/membership/role hiện tại:

- Supabase Auth đăng nhập bằng `signInWithPassword`.
- Membership đọc từ `center_members` theo `center_id` và `user_id`.
- Role literals có trong guard: `owner`, `qtv`, `center_admin`, `teacher`, `consultant`, `viewer`, `none`, `unknown`; một số bridge nhạy cảm cũng chấp nhận raw `admin`.
- Cloud write rộng cho core entity chỉ cho `owner`, `qtv`, `center_admin`.
- `teacher`/`consultant`/`viewer` read-only hoặc hold tùy nghiệp vụ; không có direct write tổng quát.
- `tuition_record_package`, `audit_log_entry`, rollback preview dùng admin-style guard.

C6.0 không tạo user, không tạo membership, không đổi role. C6.1 có thể cần manual Supabase plan cho production center/membership nếu thiếu.

## 9. LocalStorage/cache readiness

Audit localStorage/cache:

- Nhiều key hiện hardcode suffix `.dreamhome`, ví dụ `ichessCenterOS.students.dreamhome`, `ichessCenterOS.teachers.dreamhome`, `ichessCenterOS.classSessions.dreamhome`, `ichessCenterOS.schedule.dreamhome`, `ichessCenterOS.sessionReports.dreamhome`, `ichessCenterOS.tuition.dreamhome`.
- Attendance cũng có `ichessCenterOS.attendanceRecords.dreamhome` và `ichessCenterOS.attendanceBaselineState.dreamhome`.
- App hiện load default sample data nếu localStorage key trống.
- Có Angel Wings controlled dataset restore vào local, có backup trước khi replace, và message ghi rõ chưa đẩy cloud.
- Cloud bootstrap có trạng thái cloud/empty/fallback/error; khi cloud empty có thể hiển thị cache/staging local hoặc local fallback.

Rủi ro lớn nhất của C6.1 là production center empty nhưng browser localStorage còn staging/Angel Wings cache. C6.1 không được tự reset localStorage nếu chưa có prompt riêng, nhưng phải có checklist rõ để tránh nhìn nhầm local cache là production cloud.

## 10. Production DreamHome empty center - định nghĩa

DreamHome production empty center trong C6.1 phải được định nghĩa là:

- Center production sạch, có `center_id`/`centerId` rõ ràng.
- Có membership/user map rõ ràng cho tài khoản vận hành.
- Chưa seed dữ liệu học viên, giáo viên, ca học, TKB, học phí, báo cáo, điểm danh thật.
- Không chứa Angel Wings staging dataset.
- Không chứa demo/sample/fixture cũ.
- Không nhận local cache/staging push tự động.

C6.0 không tạo production center.

## 11. Không migrate Angel Wings sang production

Không migrate Angel Wings sang DreamHome production.

Angel Wings là controlled staging dataset để test. Dữ liệu này không được backfill, seed, clear hoặc sửa trong C6.0. Nếu C6.1 cần đối chiếu Angel Wings thì chỉ làm checklist/read-only reasoning, không dùng làm nguồn production.

## 12. Không seed dữ liệu thật trong C6.0

C6.0 không seed dữ liệu thật, không seed production, không insert/update/delete cloud data, không clear `center_cloud_entities`, không migrate, không backfill. Nếu cần seed/create center thật, việc đó thuộc C6.1+ và phải manual-only theo prompt riêng.

## 13. Rủi ro production

Rủi ro chính trước C6.1:

- LocalStorage `.dreamhome` có thể đang chứa staging/Angel Wings/sample, khiến UI nhìn như có dữ liệu dù cloud production empty.
- `CURRENT_CENTER_ID = 'dreamhome'` là default single-center; cần phân biệt semantic `dreamhome` local alpha với production center thật.
- Cloud bootstrap empty/fallback cần được QA kỹ để không kéo staging local vào production cloud.
- Membership/RLS có thể thiếu cho user production.
- `center_cloud_entities` có thể đã ready schema nhưng production center chưa có membership đúng.
- `class_session` có cloud/core sync nhưng không xác nhận dedicated realtime subscription riêng.
- Các module sample/default data có thể tự nạp khi local key trống; C6.1 cần xác định expected empty UI vs sample UI.

## 14. Safety rules cho C6.1

C6.1 phải tuân thủ:

- Có manual checklist trước khi chạy SQL/action.
- Nếu cần SQL, tạo read-only verification trước final apply.
- Mọi final apply SQL phải manual-only.
- Không clear staging.
- Không migrate Angel Wings.
- Không reset localStorage tự động nếu chưa có prompt riêng.
- Không seed production tự động.
- Cloud empty phải không kéo staging local vào production.
- Production center phải có `center_id` rõ ràng.
- Membership/user phải map rõ ràng.
- Không push local cache/staging lên cloud nếu user chưa xác nhận production context.

## 15. Read-only verification plan cho C6.1 nếu cần

C6.1 có thể cần read-only verification plan trước mọi apply:

- Verify current auth user.
- Verify `center_members` cho production `center_id`.
- Verify `center_cloud_entities` count theo `center_id` và `entity_type`.
- Verify realtime publication cho `center_cloud_entities` nếu cần.
- Verify không có Angel Wings marker trong production entity payload.
- Verify localStorage/cache state trong browser dùng QA.

C6.0 không chạy các query này.

## 16. SQL/manual Supabase plan nếu cần

C6.0 không tạo SQL và không chạy Supabase action.

Nếu C6.1 thiếu production center/membership/RLS/realtime readiness, phase sau có thể cần manual Supabase pack:

- Read-only verification SQL trước.
- Manual apply SQL chỉ khi user yêu cầu.
- Không seed dữ liệu thật trong SQL readiness.
- Không insert Angel Wings vào production.
- Không clear staging table.

## 17. Teacher Portal / Super Admin internal hold

INTERNAL ONLY - Teacher Portal / Super Admin are future roadmap placeholders and are not part of C6.0/C6.1 public/customer-facing scope.

Teacher Portal và Super Admin là roadmap nội bộ future hold. Không công bố cho anh Hải trong giai đoạn này. Không thêm UI/route, không demo, không tạo customer-facing docs, không viết wording kiểu đã chuẩn bị cổng giáo viên hoặc tổng admin.

Nếu cần nhắc trong kế hoạch nội bộ, phải giữ nhãn INTERNAL ONLY / NOT CUSTOMER-FACING / HOLD.

## 18. C6.1 proposal

Đề xuất tách C6.1:

- C6.1A - Thiết kế DreamHome production empty center.
- C6.1B - SQL/readiness pack manual-only nếu cần.
- C6.1C - Runtime guard/cache/center binding nếu audit chỉ ra cần.
- C6.1D - Manual QA production empty center.
- C6.1E - Checkpoint review.
- C6.1F - Commit/push checkpoint nếu user yêu cầu.

C6.0 không implement C6.1.

## 19. PASS / NEEDS REVIEW criteria

C6.0 PASS nếu:

- Docs C6.0 đầy đủ.
- Smoke C6.0 pass.
- `npm run build` pass.
- `git diff --check` pass.
- Không runtime change.
- Không SQL.
- Không Supabase action.
- Không commit/push.
- Không tạo production center.
- Không seed production.
- Không migrate Angel Wings.
- Không reset localStorage.
- Không public Teacher Portal.
- Không public Super Admin.
- Không file ngoài scope.

NEEDS REVIEW nếu có dirty unexpected file, cần apply SQL, cần Supabase action, cần runtime fix trong C6.0, hoặc không phân biệt được staging/production an toàn.

## 20. Recommendation

Recommendation: GO for C6.1A - Thiết kế DreamHome production empty center, với điều kiện user xác nhận tiếp tục.

C6.1A nên tập trung vào checklist center/membership/cache guard trước, không seed dữ liệu, không migrate Angel Wings và không công bố Teacher Portal / Super Admin.
