# C7.2 - Read-only inspection Auth / Membership / Teacher data

C7.2 STATUS: READONLY INSPECTION AUTH MEMBERSHIP TEACHER DATA
C7_1_STATUS: PASS
READONLY_INSPECT_SQL_CREATED: YES
AUTH_USERS_INSPECTION_DESIGNED: YES
CENTERS_INSPECTION_DESIGNED: YES
CENTER_MEMBERS_INSPECTION_DESIGNED: YES
ROLE_COUNTS_INSPECTION_DESIGNED: YES
CENTER_ADMIN_ONE_CENTER_VIOLATION_CHECK_DESIGNED: YES
OWNER_MEMBERSHIP_INSPECTION_DESIGNED: YES
TEACHER_MEMBERSHIP_INSPECTION_DESIGNED: YES
TEACHER_RELATED_TABLE_FUNCTION_INSPECTION_DESIGNED: YES
CENTER_CLOUD_ENTITIES_TEACHER_INSPECTION_DESIGNED: YES
CONSTRAINTS_INDEXES_POLICIES_INSPECTION_DESIGNED: YES
EXPECTED_OWNER_DREAMHOME_PROD_MEMBERSHIP: YES
EXPECTED_OWNER_PHONGTRONG_PROD_MEMBERSHIP: YES
EXPECTED_ADMIN_DREAMHOME_PROD_MEMBERSHIP: YES
EXPECTED_CENTER_ADMIN_MULTI_CENTER_VIOLATIONS: 0
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
RUNTIME_CHANGE: NO
C7_3_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.2

C7.2 tạo một inspection pack read-only để soi dữ liệu Auth, centers, `center_members`, role hiện tại và dữ liệu teacher trước khi thiết kế/apply account/admin/teacher model thật ở C7.3+. Phase này chỉ tạo docs, SQL đọc-only và smoke static.

C7.2 không chạy SQL, không gọi Supabase, không tạo Auth user, không tạo admin/teacher account, không tạo/sửa membership, không sửa runtime và không commit/push.

## 2. Trạng thái sau C7.1

C7.1 PASS đã chốt mô hình tương lai:

- owner tạo cơ sở, tạo admin cơ sở, tạo giáo viên global, phân/gỡ giáo viên vào nhiều cơ sở;
- `center_admin` chỉ có 1 active center membership, không tạo giáo viên global và không tạo teacher/admin account;
- teacher có hồ sơ global, có thể thuộc nhiều cơ sở qua assignment và có tài khoản riêng về sau;
- Module 6 không xóa ngay, sẽ tái chế theo quyền ở phase sau.

Latest commit vẫn là `10b58fc C6.6 add center provisioning and owner center switch`. C7.1 docs/test đang là thay đổi local chưa commit theo đúng scope trước đó.

## 3. Read-only SQL created

File SQL read-only đã tạo:

- `docs/supabase-c7-2-readonly-inspect-auth-membership-teacher-data.sql`

File này chứa các truy vấn `select` để inspect:

- `auth.users`;
- `public.centers`;
- `public.center_members`;
- role counts;
- kiểm tra `center_admin` active ở nhiều cơ sở;
- owner membership;
- teacher membership;
- table/function liên quan teacher/member/staff;
- `center_cloud_entities` teacher data;
- constraints, indexes và policies của `centers`/`center_members`.

## 4. SQL safety statement

SQL C7.2 là read-only inspection pack, không phải apply/migration. CodeX không chạy SQL này.

Safety:

- không tạo Auth user;
- không tạo membership;
- không tạo teacher profile;
- không sửa dữ liệu;
- không tạo Edge Function;
- không gọi provisioning RPC;
- không đụng runtime.

Nếu SQL Editor không đọc được `auth.users`, user cần chạy trong Supabase SQL Editor/admin context phù hợp hoặc gửi lại lỗi để điều chỉnh C7.3 planning.

## 5. Auth users inspection

Query `auth.users` đọc các trường:

- `id`
- `email`
- `created_at`
- `last_sign_in_at`
- `email_confirmed_at`
- `raw_app_meta_data`
- `raw_user_meta_data`

Mục tiêu là biết hiện có user nào, email owner/admin nào đã tồn tại, và có dấu hiệu teacher account nào chưa.

## 6. Centers inspection

Query `public.centers` đọc:

- `id`
- `name`
- `slug`
- `environment`
- `status`
- `created_at`
- `updated_at`

Expected hiện tại có ít nhất:

- `dreamhome`
- `dreamhome_prod`
- `phongtrong_prod`

## 7. center_members inspection

Query `public.center_members` join `auth.users` và `public.centers` để xem:

- user/email;
- center;
- center slug/environment/status;
- role;
- membership status;
- thời điểm tạo/cập nhật.

Mục tiêu là kiểm tra hiện trạng membership trước khi thiết kế admin/teacher provisioning thật.

## 8. Role counts

Role counts group theo `cm.role` và `cm.status`.

Mục tiêu:

- biết số lượng membership theo role;
- phát hiện role legacy như `admin`/`qtv` nếu còn;
- đánh giá rủi ro trước khi chuẩn hóa owner/center_admin/teacher.

## 9. center_admin one-center violation check

Inspection pack có query phát hiện user có nhiều hơn 1 active center membership role `center_admin`.

Expected:

- `EXPECTED_CENTER_ADMIN_MULTI_CENTER_VIOLATIONS: 0`
- query nên trả 0 rows.

Nếu có rows, C7.3 phải NEEDS REVIEW trước khi provisioning admin account vì rule C7.1 đã chốt `center_admin` chỉ thuộc một cơ sở.

## 10. owner membership overview

Owner membership query lọc `cm.role = 'owner'`.

Expected hiện tại:

- `owner.duchai@ichess.vn` có role owner cho `dreamhome_prod`;
- `owner.duchai@ichess.vn` có role owner cho `phongtrong_prod`.

Nếu thiếu một trong hai membership này, C7.3 không nên tạo account/admin flow ngay mà cần đọc nguyên nhân trước.

## 11. teacher membership overview

Teacher membership query lọc `cm.role = 'teacher'`.

Expected hiện tại có thể là 0 rows. Đây không phải lỗi C7.2, vì teacher global model chưa implement.

Nếu đã có teacher role membership, kết quả cần được dùng để quyết định C7.5/C7.6: teacher membership hiện tại là quyền đăng nhập theo center hay chỉ dữ liệu thử nghiệm cần migrate.

## 12. Teacher-related table/function inspection

Inspection pack soi `information_schema.tables`, `information_schema.columns` và `pg_proc` cho tên liên quan:

- teacher;
- giao;
- staff;
- member;
- account.

Mục tiêu là phát hiện bảng/function hiện có trước khi tạo `teacher_profiles` hoặc `center_teacher_assignments` ở phase sau.

## 13. center_cloud_entities teacher data inspection

Hiện app có entity `teacher` trong cloud generic `center_cloud_entities` và Module 6 dùng local/cloud payload giáo viên theo center. Inspection pack đếm entity types theo center và đọc tối đa 100 record teacher-related.

Ghi chú: SQL dùng `local_id as entity_id` vì schema generic hiện tại trong repo dùng `local_id` cho định danh entity. Nếu môi trường thật có column khác, user gửi kết quả/lỗi để C7.3+ điều chỉnh.

## 14. Constraints/indexes/policies inspection

Inspection pack đọc:

- constraints của `centers` và `center_members`;
- indexes của `centers` và `center_members`;
- RLS policies của `centers` và `center_members`.

Mục tiêu là biết hiện đã có đủ constraint để chặn trùng membership chưa, đặc biệt rule một `center_admin` chỉ có một active center.

## 15. Expected findings

Expected hiện tại:

- `owner.duchai@ichess.vn` có role owner cho `dreamhome_prod` và `phongtrong_prod`.
- `admin.dreamhome@ichess.vn` là center_admin cho `dreamhome_prod`.
- center_admin multi-center violation query nên trả 0 rows.
- teacher role memberships có thể đang 0 rows.
- teacher data hiện chủ yếu nằm ở app/module/local/cloud generic, chưa có teacher global model thật.

Nếu kết quả khác expected, C7.3 phải xử lý theo hướng design/review, không tự apply.

## 16. What C7.2 does not do

C7.2 không làm:

- không chạy SQL;
- không Supabase action;
- không SQL apply;
- không tạo/sửa/xóa Auth user;
- không tạo admin account;
- không tạo teacher account;
- không tạo/sửa membership;
- không sửa runtime;
- không sửa Module 6 runtime;
- không tạo Account Management UI;
- không tạo Teacher Portal;
- không tạo acting mode;
- không mở C7.3;
- không commit/push.

## 17. Recommendation for user manual SQL run

Nếu C7.2 PASS, user có thể tự copy/chạy file SQL read-only trong Supabase SQL Editor/admin context:

- chạy toàn bộ hoặc từng section;
- không chỉnh thành apply/migration;
- gửi lại kết quả các query quan trọng: auth users, centers, center_members, role counts, center_admin violation, owner/admin/teacher memberships, teacher tables/functions và teacher cloud entity count.

CodeX không chạy SQL này trong C7.2.

## 18. C7.3 dependency

C7.3 chỉ nên bắt đầu sau khi có kết quả read-only inspection.

C7.3 phụ thuộc:

- owner/admin email hiện có hay chưa;
- membership owner/admin hiện trạng;
- center_admin one-center violation có 0 rows hay không;
- teacher role membership có tồn tại không;
- teacher data đang nằm ở bảng/function nào;
- constraints/indexes/policies hiện tại đủ an toàn đến đâu.

## 19. PASS / NEEDS REVIEW criteria

PASS khi:

- docs/read-only SQL/test đầy đủ;
- Auth/users/membership/teacher inspection queries rõ;
- center_admin one-center violation check rõ;
- owner/admin expected memberships rõ;
- SQL file chỉ là read-only inspection;
- không SQL/Supabase action/Auth user/membership/runtime;
- build/diff pass;
- không commit/push.

NEEDS REVIEW nếu:

- có file ngoài C7.1/C7.2 scope;
- có `src` diff;
- SQL file chứa mutating executable SQL;
- có SQL apply/migration;
- có Supabase action hoặc account/membership thật được tạo;
- thiếu inspection bắt buộc;
- không chạy được smoke/build/diff check.
