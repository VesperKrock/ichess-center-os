# C6.1B - Read-only verification pack cho DreamHome production empty center

C6.1B STATUS: READ-ONLY VERIFICATION PACK ONLY

SQL_MODE: READ_ONLY_VERIFY_ONLY
FINAL_APPLY_SQL_CREATED: NO
SQL_APPLIED: NO
SUPABASE_ACTION: NOT RUN
RUNTIME_CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
PRODUCTION_CENTER_CREATED: NO
PRODUCTION_DATA_SEEDED: NO
STAGING_DATA_MIGRATED: NO
ANGEL_WINGS_MIGRATED: NO
ANGEL_WINGS_MODIFIED: NO
LOCAL_STORAGE_RESET: NO
ACCOUNT_BASED_CENTER_ROUTING_DECISION: YES
URL_BASED_SECURITY: NO
USERNAME_LOGIN_CREATED: NO
ACCOUNT_MANAGEMENT_UI_CREATED: NO
PERMISSION_OVERRIDE_CREATED: NO
ACTING_MODE_CREATED: NO
TEACHER_PORTAL_PUBLIC_DISCLOSURE: NO
SUPER_ADMIN_PUBLIC_DISCLOSURE: NO
C7_STARTED: NO

## 1. Mục tiêu C6.1B

C6.1B tạo read-only verification pack để user chạy thủ công trên Supabase SQL Editor. Phase này chỉ tạo docs, SQL verify chỉ đọc và smoke test; không final apply SQL, không runtime, không Supabase action, không commit và không push.

Mục tiêu verify:

- DreamHome production empty center readiness.
- Core table, entity allowlist, realtime/publication, replica identity.
- Helper functions, membership/role candidates.
- Count theo `center_id` và `entity_type`.
- Angel Wings/staging detection ở mức chỉ đọc.
- Rủi ro localStorage/cache và hướng account-based center routing.

## 2. Trạng thái trước C6.1B

- Latest commit: `6fa4608 F23 feedback 2706 polish checkpoint`.
- Branch: `main...origin/main`.
- C6.0: PASS, docs/test only.
- C6.1A: PASS, docs/test only.
- Worktree trước C6.1B chỉ có C6.0/C6.1A docs/tests.
- Chưa có runtime C6.
- Chưa có SQL C6.1B trước phase này.

## 3. Tóm tắt C6.0/C6.1A

C6.0 xác nhận production readiness risks:

- Angel Wings là controlled staging dataset.
- DreamHome production empty center phải sạch.
- `center_cloud_entities` là cloud storage chung.
- Rủi ro lớn nhất là localStorage `.dreamhome` còn staging/Angel Wings cache.

C6.1A chốt thiết kế:

- Không migrate Angel Wings sang DreamHome production.
- Không seed staging/production.
- Cần minimal center identity, membership/role binding.
- Supabase Auth user ≠ quyền trong app.
- C7 mới xử lý account/permission/portal nâng cao.

## 4. Quyết định link chung + account-based center routing

Vận hành ưu tiên dùng một link chung:

https://vesperkrock.github.io/ichess-center-os/

Sau đăng nhập, app dựa vào `user_id`/membership/role để resolve center. Đây là account-based center routing.

Flow đề xuất:

- Nếu user có 1 membership active: auto-enter center.
- Nếu user có nhiều membership active: hiện màn chọn cơ sở.
- Nếu user không có membership active: không vào dashboard, hiển thị lỗi/empty state “Tài khoản chưa được gán cơ sở”.

URL/hidden route không phải security. Hidden/internal route nếu có sau này vẫn phải dựa vào auth + membership/role, không dựa vào việc giấu link.

## 5. Read-only SQL file

SQL verify nằm tại:

`docs/supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql`

SQL này có marker:

- `READ ONLY VERIFY ONLY`
- `Do not modify data.`

SQL chỉ dùng `select`, `with`, `exists`, `count(*)`, `information_schema`, `pg_catalog`, `pg_constraint`, `pg_publication_tables`, `pg_class`.

Không có final apply SQL.

## 6. SQL này kiểm tra gì

Pack kiểm:

- Core table/readiness: `public.center_cloud_entities` và các cột `center_id`, `entity_type`, `local_id`, `payload`, `created_at`, `updated_at`, `deleted_at`.
- Entity allowlist/constraint metadata cho `student`, `teacher`, `class_session`, `schedule_session`, `attendance_record`, `attendance_baseline_state`, `session_report`, `tuition_record_package`, `audit_log_entry`.
- Realtime/publication: `pg_publication_tables` có `center_cloud_entities`.
- Replica identity: kiểm `replica identity full`.
- Helper functions: `public.can_write_center`, `public.is_center_member`.
- Membership/role readiness: tìm table/routine candidates như `center_members`, `memberships`, `center_memberships`, `profiles`, `user_profiles`.
- Center counts: count by `center_id`, count by `center_id + entity_type`, target `dreamhome`.
- Angel Wings/staging detection: `payload::text ilike '%Angel Wings%'`, `local_id ilike '%angel%'`, `payload::text ilike '%staging%'`.
- Auth users note: không query `auth.users` trong pack mặc định.

Nếu schema không dùng constraint allowlist mà dùng cơ chế khác, phần entity allowlist có thể trả `not found in metadata constraint definitions`; đó là limitation cần đọc cùng app-side allowlist/docs.

## 7. Hướng dẫn user chạy verify thủ công

1. Mở Supabase SQL Editor.
2. Mở file `docs/supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql`.
3. Kiểm tra marker `READ ONLY VERIFY ONLY`.
4. Chạy SQL thủ công.
5. Copy toàn bộ kết quả về chat.

Không chạy apply SQL. Không sửa dashboard. Không insert/update/delete dữ liệu.

## 8. Cách đọc kết quả

Mỗi block trả về các cột dạng:

- `check_name`
- `ok`
- `details`

Cách đọc:

- `ok = true`: check đạt hoặc thông tin chỉ đọc hợp lệ.
- `ok = false`: cần review, không tự sửa trong C6.1B.
- `details`: giải thích metadata/count/candidate tìm thấy.

Nếu production center chưa tồn tại, không coi là fail trong C6.1B. C6.1B chỉ xác định hiện trạng để quyết định C6.1C/C6.2.

## 9. Production empty center expected result

Expected result khi user chạy verify:

- `center_cloud_entities exists: true`.
- Helper functions exist nếu C5 đã tạo: `can_write_center: true`, `is_center_member: true`.
- Realtime publication: true.
- Replica identity full: true nếu C5 yêu cầu.
- Entity allowlist có các entity C5/C6 cần.
- Có thể thấy count theo `center_id`/`entity_type`.
- Không có Angel Wings trong production target center.
- Production target center empty hoặc chưa tạo, tùy C6.1C/C6.2 quyết định.

Nếu target `dreamhome` có record staging/Angel Wings, dừng và báo NEEDS REVIEW trước khi sang runtime/apply.

## 10. Staging/Angel Wings detection

SQL kiểm Angel Wings/staging detection bằng text search chỉ đọc:

- `payload::text ilike '%Angel Wings%'`
- `local_id ilike '%angel%'`
- `payload::text ilike '%staging%'`
- `local_id ilike '%staging%'`

Không delete/update. Không clear staging. Không migrate Angel Wings.

## 11. Membership/role readiness

Membership/role readiness cần nhìn:

- Có `center_members` hoặc table tương đương không.
- Có helper `is_center_member` không.
- Có helper `can_write_center` không.
- Có role map đủ cho `owner`, `qtv`, `center_admin`, `admin`, `viewer` theo C6 minimal.
- Teacher/consultant literal nếu có vẫn là internal/future hold trong C6.

Không có membership active thì không vào dashboard. Supabase Auth user ≠ quyền trong app.

## 12. Center counts / entity counts

SQL có:

- Count by `center_id`.
- Count by `center_id + entity_type`.
- Count where `center_id` looks like `dreamhome`.
- Target center CTE mặc định `select 'dreamhome'::text as center_id`.

Nếu C6.1C/C6.2 quyết định dùng production `center_id` khác, user cần đổi CTE trong SQL verify trước khi chạy lại.

## 13. Rủi ro localStorage/cache

Rủi ro localStorage/cache vẫn còn:

- Browser localStorage `.dreamhome` có thể chứa staging/Angel Wings.
- Cloud empty production có thể bị UI fallback sang cache/staging local.
- Sample/default data có thể gây hiểu nhầm empty production.

C6.1B không reset localStorage, không tự động xóa cache. C6.1C có thể cần runtime/cache guard hoặc manual clean browser/profile procedure nếu verification chỉ ra cần.

## 14. Những gì C6.1B không làm

C6.1B không làm:

- Không final apply SQL.
- Không apply SQL.
- Không Supabase action.
- Không runtime.
- Không tạo production center thật.
- Không tạo/xóa user thật.
- Không tạo/xóa membership thật.
- Không seed DreamHome production.
- Không migrate Angel Wings.
- Không migrate staging.
- Không clear staging.
- Không sửa `center_cloud_entities`.
- Không reset localStorage.
- Không mở C6.1C implementation.
- Không mở C7.

## 15. C7 deferred items

Deferred C7/internal hold:

- Username login.
- Account management.
- Permission override.
- Acting mode.
- Teacher Portal.
- Super Admin/internal console.
- Hidden/internal center overview route cho anh Hải nếu có sau này.

Teacher Portal/Super Admin/account advanced vẫn defer C7/internal hold, không public/customer-facing trong C6.

## 16. Next decision matrix

Sau khi user paste kết quả SQL:

- Nếu core table/helper/realtime/entity readiness đều pass và target production empty sạch: GO C6.1D manual QA hoặc C6.1C rất nhỏ nếu cache guard vẫn cần.
- Nếu table/helper/realtime thiếu: tạo manual readiness/apply phase riêng, không tự apply trong C6.1B.
- Nếu Angel Wings/staging xuất hiện trong production target: NEEDS REVIEW, không sang runtime.
- Nếu membership/role chưa rõ: C6.1C/C6.2 cần thiết kế guard/mapping trước runtime.
- Nếu local cache risk cao: C6.1C cần runtime/cache guard hoặc manual clean QA procedure.

## 17. PASS / NEEDS REVIEW criteria

C6.1B PASS nếu:

- Docs C6.1B đầy đủ.
- SQL read-only verify tồn tại.
- SQL không có mutating operation.
- Smoke C6.0/C6.1A/C6.1B pass.
- `npm run build` pass.
- `git diff --check` pass.
- Không runtime change.
- Không final apply SQL.
- Không Supabase action.
- Không commit/push.
- Không tạo production center.
- Không seed production.
- Không migrate Angel Wings.
- Không reset localStorage.
- Không mở C6.1C/C7.
- Không public Teacher Portal/Super Admin.
- Không file ngoài scope.

NEEDS REVIEW nếu SQL cần apply thật, có file ngoài scope, hoặc verification pack không thể giữ read-only.

## 18. Recommendation

Recommendation: chờ user chạy SQL verify thủ công và paste kết quả về chat.

Không sang C6.1C/apply/runtime khi chưa xem kết quả verify. Nếu kết quả sạch, phase tiếp theo có thể là C6.1D manual QA hoặc C6.1C runtime/cache guard rất hẹp nếu cần.
