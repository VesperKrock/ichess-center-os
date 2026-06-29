# C6.1A - Thiết kế DreamHome production empty center

C6.1A STATUS: DESIGN ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME_CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
PRODUCTION_CENTER_CREATED: NO
PRODUCTION_DATA_SEEDED: NO
STAGING_DATA_MIGRATED: NO
ANGEL_WINGS_MIGRATED: NO
ANGEL_WINGS_MODIFIED: NO
LOCAL_STORAGE_RESET: NO
ACCOUNT_MANAGEMENT_UI_CREATED: NO
USERNAME_LOGIN_CREATED: NO
PERMISSION_OVERRIDE_CREATED: NO
ACTING_MODE_CREATED: NO
TEACHER_PORTAL_PUBLIC_DISCLOSURE: NO
SUPER_ADMIN_PUBLIC_DISCLOSURE: NO
CUSTOMER_FACING_DOCS_FOR_TEACHER_OR_SUPER_ADMIN: NO
C7_STARTED: NO

## 1. Mục tiêu C6.1A

C6.1A thiết kế DreamHome production empty center sau C6.0 PASS. Phase này chỉ audit/design/docs/test, không runtime, không SQL, không Supabase action, không commit và không push.

Mục tiêu:

- Định nghĩa production center sạch.
- Chốt boundary staging Angel Wings vs production DreamHome.
- Không migrate Angel Wings, không seed staging, không seed production.
- Thiết kế minimal center identity, membership/role binding và auth user mapping cho C6.
- Thiết kế risk plan cho localStorage/cache `.dreamhome`.
- Đề xuất C6.1B read-only verification, C6.1C runtime/cache guard nếu cần, C6.1D manual QA.

## 2. Trạng thái trước C6.1A

- Latest commit: `6fa4608 F23 feedback 2706 polish checkpoint`.
- Branch: `main...origin/main`.
- Worktree trước C6.1A: chỉ có C6.0 docs/test.
- C6.0 production readiness audit: PASS.
- C6.0 không runtime, không SQL, không Supabase action, không commit.

## 3. Tóm tắt C6.0

C6.0 đã xác nhận:

- Angel Wings là controlled staging dataset, không phải production.
- DreamHome production empty center là center sạch để nhập dữ liệu thật.
- `center_cloud_entities` là storage cloud chung hiện tại cho nhiều entity.
- `CURRENT_CENTER_ID = 'dreamhome'` và default center binding `DreamHome` đang tồn tại trong runtime.
- Nhiều localStorage key đang dùng suffix `.dreamhome`.
- Rủi ro lớn nhất là production center empty nhưng browser localStorage còn staging/Angel Wings cache.
- Teacher Portal / Super Admin là INTERNAL ONLY / NOT CUSTOMER-FACING / HOLD.

## 4. Định nghĩa DreamHome production empty center

DreamHome production empty center là một center/cơ sở sạch để nhập dữ liệu thật.

Điều kiện empty production:

- Không có học viên staging.
- Không có giáo viên staging.
- Không có schedule/session staging.
- Không có attendance/session_report staging.
- Không có tuition staging.
- Không có audit/log staging ngoài các log do production tạo sau này.
- Không lẫn Angel Wings.
- Không lẫn demo/sample/seed cũ.
- Không tự kéo dữ liệu local staging vào cloud production.

C6.1A không tạo production center thật.

## 5. Production vs staging boundary

Boundary bắt buộc:

- Angel Wings = controlled staging dataset, dùng để test nội bộ.
- DreamHome production empty center = môi trường/cơ sở sạch để nhập dữ liệu thật.
- Staging data không là production truth.
- Production không được backfill từ staging nếu chưa có phase riêng.
- Production QA phải phân biệt Cloud data, local cache, staging local và sample/default UI.

Nếu cùng logical name `dreamhome` được dùng trong alpha và production, C6.1B/C6.1C phải quyết định guard rõ thay vì đoán.

## 6. Angel Wings không được migrate

Không migrate Angel Wings sang DreamHome production.

Không seed Angel Wings vào production. Không seed staging vào production. Không clear staging. Không sửa Angel Wings. Không dùng Angel Wings làm nguồn production data.

Angel Wings chỉ có thể được dùng làm reference nội bộ để hiểu rủi ro cache/staging, không dùng làm input cho production center.

## 7. Production data model tối thiểu

Production empty center tối thiểu cần quan sát các nhóm entity đang có readiness:

- `student`
- `teacher`
- `class_session`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `tuition_record_package`
- `audit_log_entry`

Trong trạng thái empty, count production theo `center_id` nên bằng 0 cho dữ liệu nghiệp vụ chính, trừ các record hệ thống/log do production tạo sau khi vận hành. C6.1A không chạy query và không xác nhận remote count.

## 8. Minimal center identity

Production center cần identity tối thiểu:

- `center_id` ổn định.
- `centerId` trong payload/runtime phải map rõ về cùng production center.
- `center_slug` hoặc local identifier rõ ràng.
- `display_name`: DreamHome hoặc tên production chính thức.
- `environment`: production hoặc cách đánh dấu tương đương nếu schema hiện có hỗ trợ.
- `created_at` / `created_by` nếu schema hiện có.
- `status`: active nếu schema hiện có.

Audit hiện tại: app đang hardcode `dreamhome` qua `CURRENT_CENTER_ID` và nhiều storage key `.dreamhome`.

Cần kiểm soát rủi ro hardcoded dreamhome vì staging và production có thể cùng tên logical center. C6.1B/C6.1C cần quyết định dùng center_id production riêng hay reuse dreamhome sau khi clean. Không quyết định bằng cách đoán.

## 9. Minimal membership/role binding

Thiết kế tối thiểu cho C6:

- Auth user chỉ là tài khoản đăng nhập.
- Quyền trong app phải đến từ membership/role.
- Không có membership hợp lệ thì không được vào dashboard.
- C6 chỉ cần membership/role tối thiểu để production center an toàn.
- Advanced account management defer C7.

Role tối thiểu cho C6:

- `owner` hoặc `qtv`: quyền cao cho anh Hải/người quản trị chính nếu cần.
- `center_admin` hoặc `admin`: quản lý cơ sở DreamHome production.
- `viewer`: nếu cần kiểm tra read-only.

Teacher/consultant có literal trong hệ thống hiện tại, nhưng Teacher Portal / Consultant portal chưa public. Teacher role nếu có chỉ là internal/future hold hoặc existing guard literal. Không demo cổng giáo viên trong C6.

## 10. Auth users hiện tại và nguyên tắc mapping

Supabase Auth hiện có thể có một số user email phục vụ alpha/dev/test. C6.1A không ghi email cụ thể vào docs có thể customer-facing, không gọi Supabase, không list user.

Nguyên tắc:

- Supabase Auth user ≠ quyền trong app.
- C6.1B cần read-only verify mapping `user_id -> center membership -> role`.
- Không tạo user mới trong C6.1A.
- Không xóa user trong C6.1A.
- Không dùng Supabase Auth list làm nguồn phân quyền trực tiếp.
- Membership/role mới là source of truth cho quyền vào production center.

## 11. LocalStorage/cache risk

Browser localStorage có thể còn dữ liệu `.dreamhome` từ staging/Angel Wings.

Rủi ro:

- Nếu production center empty nhưng app fallback về local cache staging thì UI có thể hiện nhầm dữ liệu test.
- Nếu local key `.dreamhome` được reuse, người test có thể tưởng production cloud đã có dữ liệu.
- App hiện có sample/default data path khi local key trống.

C6.1A không reset localStorage, không tự động xóa cache.

Hướng xử lý phase sau:

- Option A: production `center_id` khác staging `center_id` để cache key tách biệt.
- Option B: manual QA profile/browser sạch cho production.
- Option C: runtime guard không cho cloud empty production bị local staging lấp vào nếu center/environment mismatch.

## 12. Cloud bootstrap / cloud empty behavior risk

C6.0 audit ghi cloud bootstrap hiện có trạng thái cloud/empty/fallback/error. Khi cloud empty, UI có thể vẫn dựa vào cache/staging local hoặc sample/default path.

Cloud empty behavior risk:

- Production cloud empty cần được hiển thị như empty production, không phải staging local.
- Taskbar/status phải cho biết data source nếu C6.1C triển khai guard.
- Không pull staging vào production.
- Không push local staging lên production nếu chưa có explicit production confirmation.

C6.1A chỉ thiết kế, không đổi cloud bootstrap.

## 13. Entity readiness cho production

Entity readiness cho production dựa trên workspace:

- Core: `student`, `teacher`, `class_session`.
- Schedule: `schedule_session`.
- Attendance/report: `attendance_record`, `attendance_baseline_state`, `session_report`.
- Tuition: `tuition_record_package`.
- Audit/conflict/rollback preview: `audit_log_entry` là log entity; rollback preview chỉ đọc audit log.

C6.1B cần verify production count theo `center_id` và `entity_type`, đồng thời xác nhận không có Angel Wings marker trong production center.

## 14. Realtime readiness cho production

Realtime readiness đã có helper/runtime cho:

- `student`
- `teacher`
- `schedule_session`
- `attendance_record`
- `attendance_baseline_state`
- `session_report`
- `tuition_record_package`

Không overclaim dedicated realtime subscription riêng cho `class_session` nếu C6.1B/C6.1C không xác nhận. Production realtime phải filter theo `center_id`.

## 15. RLS / helper function readiness nếu cần

C6.1A không tạo SQL.

C6.1B có thể cần read-only verify:

- `center_cloud_entities` readable theo membership.
- Helper `can_write_center` nếu schema đang dùng.
- Helper `is_center_member` nếu schema đang dùng.
- RLS/policy không cho user ngoài center đọc/ghi production.
- Realtime publication có `center_cloud_entities`.
- Membership/role map đúng cho production `center_id`.

Nếu thiếu helper/RLS, C6.1B chỉ tạo readiness pack/manual-only plan, không apply trong C6.1A.

## 16. C6.1B read-only verification plan

C6.1B nên tạo SQL read-only verify:

- `center_cloud_entities` readiness.
- Allowlist/entity types cần cho production.
- Helper functions `can_write_center` / `is_center_member`.
- Publication/realtime.
- Membership/role mapping nếu bảng/function hiện có.
- Count entity theo `center_id` để xác nhận production empty.
- Xác nhận không có Angel Wings trong production center.

C6.1A không tạo SQL và không chạy query.

## 17. C6.1C runtime/cache guard plan nếu cần

C6.1C có thể cần runtime/cache guard nếu C6.1B hoặc manual QA chỉ ra rủi ro:

- Tránh production empty center hiển thị staging local cache.
- Kiểm tra center binding rõ ràng.
- Taskbar/status phải cho biết data source.
- Không tự clear data.
- Không pull staging vào production.
- Không push local staging lên production.

C6.1A không implement guard.

## 18. C6.1D manual QA plan

C6.1D manual QA nên kiểm:

- Đăng nhập user có membership production.
- User không có membership không được vào dashboard.
- Production center empty không hiển thị Angel Wings/staging như production truth.
- LocalStorage/cache `.dreamhome` được kiểm tra bằng browser/profile sạch hoặc procedure rõ ràng.
- Realtime/status không báo sai source.
- Không có seed production.
- Không có migration Angel Wings.

## 19. Những gì C6.1A không làm

C6.1A không làm:

- Không runtime.
- Không SQL.
- Không read-only SQL file.
- Không Supabase action.
- Không tạo production center thật.
- Không tạo/xóa user thật.
- Không tạo/xóa membership thật.
- Không seed DreamHome production.
- Không migrate Angel Wings.
- Không migrate staging.
- Không clear staging.
- Không reset localStorage.
- Không tự động xóa cache.
- Không mở C6.1B/C6.1C implementation.
- Không mở C7.

## 20. C7 deferred items

Các mục sau defer sang C7:

- Username login thay email.
- Quản lý tài khoản cho anh Hải.
- Tạo tài khoản mới trong app.
- Gán cơ sở từ UI.
- Chọn vai trò từ UI.
- Bật/tắt quyền truy cập từ UI.
- Reset/sửa mật khẩu.
- Role default permissions.
- Permission overrides tick thêm/bớt theo tài khoản.
- Acting mode / hỗ trợ cơ sở.
- Teacher Portal.
- Super Admin/internal operator console.

Các mục trên không thuộc C6.1A/C6. C7 mới xử lý chi tiết. Không public/customer-facing nếu user chưa duyệt.

## 21. Risks / blockers

Risks còn lại:

- Hardcoded `dreamhome` có thể làm staging và production nhập nhằng.
- LocalStorage `.dreamhome` có thể còn staging/Angel Wings cache.
- Cloud empty/fallback có thể làm UI hiện dữ liệu local trong production QA.
- Production membership/role có thể chưa tồn tại hoặc chưa đúng.
- RLS/helper/realtime readiness cần C6.1B verify read-only.

Không có blocker trong C6.1A vì phase này chỉ thiết kế, không apply production.

## 22. PASS / NEEDS REVIEW criteria

C6.1A PASS nếu:

- Docs C6.1A đầy đủ.
- Smoke C6.0/C6.1A pass.
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
- Không mở C6.1B/C6.1C.
- Không mở C7.
- Không public Teacher Portal/Super Admin.
- Không file ngoài scope.

NEEDS REVIEW nếu cần apply SQL/Supabase action/runtime fix ngay, có file ngoài scope, hoặc không phân biệt được staging/production an toàn.

## 23. Recommendation

Recommendation: GO for C6.1B - Read-only verification pack cho DreamHome production empty center.

C6.1B nên chỉ tạo read-only verification pack/manual readiness, không apply SQL, không seed dữ liệu, không migrate Angel Wings, không reset localStorage.
