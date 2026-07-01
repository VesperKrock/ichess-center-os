# C7.1 - Account & People Model audit/design

C7.1 STATUS: ACCOUNT PEOPLE MODEL AUDIT DESIGN
C6_6_DONE: YES
OWNER_CAN_CREATE_TEACHERS_DESIGNED: YES
CENTER_ADMIN_CAN_CREATE_GLOBAL_TEACHERS: NO
TEACHER_CAN_BELONG_TO_MULTIPLE_CENTERS: YES
CENTER_ADMIN_ONE_CENTER_ONLY_DESIGNED: YES
CENTER_TEACHER_ASSIGNMENT_DESIGNED: YES
TEACHER_GLOBAL_PROFILE_DESIGNED: YES
MODULE_6_TEACHER_BUTTON_REUSE_RECOMMENDED: YES
MODULE_6_RUNTIME_CHANGED: NO
CENTER_ADMIN_ACCOUNT_AUTO_EMAIL_CONCEPT_DESIGNED: YES
CENTER_ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn
AUTH_USER_CREATION_SERVER_SIDE_REQUIRED: YES
FRONTEND_DIRECT_AUTH_USER_CREATION_RECOMMENDED: NO
ACCOUNT_MANAGEMENT_DEFERRED_TO_LATER_C7: YES
TEACHER_PORTAL_DEFERRED: YES
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_LATER_C7: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
RUNTIME_CHANGE: NO
C7_2_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.1

C7.1 chỉ audit và thiết kế mô hình tài khoản/người dùng sau C6.6 DONE. Phase này chốt hướng owner, center_admin và teacher cho iChess Center OS nhiều cơ sở, đặc biệt:

- owner tạo cơ sở, tạo admin cơ sở, tạo hồ sơ/tài khoản giáo viên global và phân giáo viên vào nhiều cơ sở;
- center_admin chỉ vận hành đúng một cơ sở và không tạo giáo viên global;
- teacher là tài nguyên global, có thể được phân vào nhiều cơ sở;
- Module 6 Giáo viên hiện chưa đổi runtime, chỉ ghi hướng tái chế theo quyền ở phase sau.

C7.1 không chạy SQL, không gọi Supabase, không tạo Auth user, không tạo membership, không tạo account thật, không sửa runtime và không commit/push.

## 2. Trạng thái sau C6.6

C6.6 đã DONE với commit mới nhất `10b58fc C6.6 add center provisioning and owner center switch`. Internal Center Console hiện owner-only, có form thêm cơ sở một field `Tên cơ sở`, gọi RPC `provision_center_for_owner(p_center_name)` khi user thao tác runtime, và owner đã mở được Phòng Trống.

Phòng Trống được ghi nhận:

- `center_id = phongtrong_prod`
- `slug = phongtrong`
- `environment = production`
- `status = active`

DreamHome vẫn available. Phòng Trống không clone Angel Wings và không copy staging students. C6.6H cũng đã ghi rõ Account/admin/teacher model defer C7 và Module 6 teacher button nên được tái chế theo quyền.

## 3. Role model tổng quan

Role tối thiểu cho C7:

- `owner`: tầng iChess tổng, quản trị hệ thống/cơ sở/người dùng.
- `center_admin`: người vận hành một cơ sở cụ thể.
- `teacher`: giáo viên, có hồ sơ global và có thể được phân vào nhiều cơ sở.

Role deferred:

- `consultant`
- `viewer`
- `super_admin` advanced

Audit source hiện tại cho thấy `src/online-access-control.js` đã normalize các role `owner`, `qtv`, `center_admin`, `teacher`, `consultant`, `viewer`. Write cloud chung hiện chỉ mở cho `owner`, `qtv`, `center_admin`; `teacher/consultant/viewer` đọc được theo membership nhưng write bị giữ lại hoặc read-only tùy scope.

## 4. Owner responsibilities

Owner là tầng iChess tổng. Owner được thiết kế để:

- tạo cơ sở;
- tạo tài khoản admin cơ sở;
- tạo hồ sơ giáo viên global;
- tạo tài khoản teacher khi phase account thật được duyệt;
- phân giáo viên vào một hoặc nhiều cơ sở;
- gỡ giáo viên khỏi cơ sở khi cần;
- xem danh sách cơ sở production/active;
- quản trị Internal Center Console;
- quản trị workflow account/membership qua flow server-side có audit.

Trong ngắn hạn, owner vẫn tương thích với membership per center. Về dài hạn có thể bổ sung global owner role riêng, nhưng C7.1 chưa tạo schema đó.

## 5. center_admin responsibilities and one-center rule

`center_admin` là admin cơ sở, chỉ vận hành một cơ sở cụ thể.

Rule thiết kế:

- một `center_admin` chỉ được có 1 active center membership role `center_admin`;
- nếu chuyển cơ sở, cần disable membership cũ hoặc có transfer flow rõ;
- `center_admin` không được tạo giáo viên global;
- `center_admin` không được tạo teacher account;
- `center_admin` không được tạo admin khác;
- `center_admin` không được phân giáo viên sang cơ sở khác;
- `center_admin` không truy cập Internal Center Console.

`center_admin` được phép quản lý học viên, lịch học, báo cáo và dữ liệu vận hành trong đúng center của mình; được xem/dùng giáo viên đã được owner phân vào center đó.

## 6. teacher responsibilities and multi-center rule

Teacher là người dạy, có hồ sơ global của iChess và có thể có tài khoản đăng nhập riêng.

Rule thiết kế:

- một teacher có thể thuộc nhiều cơ sở;
- teacher không tự chọn cơ sở nếu chưa được phân;
- mỗi cơ sở chỉ thấy teacher được phân vào cơ sở đó;
- teacher được xem ca dạy của mình và gửi điểm danh/báo cáo ca theo policy scoped;
- teacher không dùng Module 6 admin như một admin cơ sở.

Teacher write quyền cần gắn với assignment/session cụ thể, không mở broad write theo membership chung.

## 7. center_members hiện tại và gap

Hiện trạng audit:

- runtime đọc quyền qua `center_members` và membership per center;
- `src/app-center-binding.js` resolve center theo account membership;
- `src/cloud-db-sync.js` yêu cầu user có membership `center_members` cho center đang mở;
- `src/online-access-control.js` có role `owner`, `center_admin`, `teacher`, `consultant`, `viewer`;
- C6.4/C6.6 docs ghi ngắn hạn dùng membership per center, không dùng wildcard `center_id = '*'`;
- `center_admin` hiện được hiểu là admin của center được gán.

Gap cho C7:

- chưa chứng minh có unique/constraint chặn một user có nhiều active `center_admin` memberships;
- chưa có model global role tách khỏi membership per center;
- chưa có `teacher_profiles`;
- chưa có `center_teacher_assignments`;
- entity `teacher` hiện nằm trong `center_cloud_entities` như dữ liệu giáo viên theo center/local payload, chưa phải hồ sơ teacher global;
- chưa có lifecycle account chuẩn hóa cho admin/teacher.

C7.1 không sửa gap bằng SQL/runtime. Các gap này chuyển sang C7.2/C7.3/C7.5/C7.6.

## 8. teacher_profiles concept

Khái niệm tương lai: `teacher_profiles`.

Trường đề xuất:

- `id`
- `user_id` nullable hoặc required tùy phase
- `name`
- `email`
- `phone`
- `status`
- `specialties`
- `notes`
- `created_at`
- `updated_at`

`teacher_profiles.user_id` có thể trỏ đến `auth.users.id` khi teacher có tài khoản đăng nhập. C7.1 không tạo bảng, không tạo Auth user và không migrate dữ liệu Module 6 hiện có.

## 9. center_teacher_assignments concept

Khái niệm tương lai: `center_teacher_assignments`.

Trường đề xuất:

- `center_id`
- `teacher_id`
- `status`
- `assigned_by`
- `assigned_at`
- `updated_at`

Ý nghĩa:

- một teacher global có thể được phân vào nhiều center;
- một center chỉ thấy teacher có assignment active với center đó;
- owner có quyền assign/unassign;
- center_admin chỉ xem hoặc dùng danh sách teacher đã được phân, không tạo global teacher;
- policy teacher portal sau này phải kiểm tra teacher được phân vào center/session tương ứng.

## 10. Module 6 future behavior

Module 6 hiện có local teacher CRUD/prototype, gồm nút `+ Thêm giáo viên`, form thêm/sửa giáo viên và dữ liệu `teacher` theo local/cloud entity hiện tại. C7.1 không xóa và không sửa runtime Module 6.

Hướng tương lai: tái chế Module 6 từ local teacher CRUD thành view/management theo quyền:

- owner thấy giáo viên toàn hệ thống, owner tạo giáo viên global, phân/gỡ giáo viên vào cơ sở;
- center_admin chỉ thấy giáo viên được phân vào cơ sở đang mở;
- center_admin không thấy action tạo teacher global hoặc tạo teacher account;
- teacher không dùng Module 6 admin.

## 11. Tạo giáo viên: owner-only

Tạo giáo viên global là owner-only.

Owner có thể tạo:

- `teacher_profiles` global;
- Auth account teacher nếu cần đăng nhập;
- assignment teacher vào một hoặc nhiều center.

Flow này cần server-side privileged action, validation trùng email/phone, audit log và rollback/lifecycle rõ. C7.1 chỉ thiết kế, không tạo dữ liệu thật.

## 12. Admin không tạo giáo viên global

`center_admin` không được tạo giáo viên global và không được tạo teacher account.

Nếu sau này cần workflow đề xuất giáo viên, có thể thiết kế request/approval:

- center_admin gửi request thêm/đề xuất teacher;
- owner duyệt, tạo hoặc assign teacher;
- mọi thay đổi có audit.

Request workflow này deferred, không thuộc C7.1.

## 13. Admin account provisioning concept

Khi tạo center trong tương lai, hệ thống có thể tạo hoặc chuẩn bị admin account cho cơ sở. Flow đề xuất:

1. owner tạo center;
2. server-side privileged flow tạo Auth user admin cơ sở hoặc tạo invitation;
3. tạo membership active role `center_admin` cho đúng `center_id`;
4. chặn user đó có thêm active `center_admin` membership khác;
5. ghi audit actor, target user, target center, action và kết quả.

C7.1 không tạo admin account và không tạo membership.

## 14. admin.<slug>@ichess.vn convention

Convention email admin cơ sở:

- `admin.<slug>@ichess.vn`
- ví dụ `admin.dreamhome@ichess.vn`
- ví dụ `admin.phongtrong@ichess.vn`
- ví dụ `admin.govap@ichess.vn`

Email này chỉ là concept C7.1. Trước khi apply thật cần kiểm tra email đã tồn tại trong Auth, center slug đúng production target và ownership/audit đã sẵn sàng.

## 15. Auth user creation safety

Tạo Auth user là thao tác privileged. Không làm bằng frontend direct insert và không đọc/ghi `auth.users` trực tiếp từ frontend.

Flow an toàn cần một trong các hướng:

- Supabase Edge Function dùng service role, có owner guard và audit;
- manual admin tool có checklist, dry-run, review và log;
- backend/service riêng về sau.

C7.1 không tạo Edge Function, không gọi Supabase Admin API, không tạo Auth user.

## 16. Account lifecycle

Lifecycle đề xuất đầy đủ:

- `created`
- `invited`
- `active`
- `paused`
- `disabled`

Tối thiểu cần chốt:

- `active`
- `disabled`

Lifecycle nên áp dụng nhất quán cho account/membership/assignment:

- account disabled không đăng nhập hoặc không thao tác;
- membership disabled không cho vào center;
- teacher assignment disabled làm teacher biến mất khỏi danh sách center, nhưng không xóa hồ sơ global.

## 17. Acting mode deferred

Acting mode chưa implement và deferred tới phase C7 sau khi account model ổn định.

Khi thiết kế acting mode, bắt buộc có audit log:

- `true_actor`
- `acting_center`
- `acting_role`
- `reason`
- `start`
- `end`

Acting mode khác center switch. Center switch là user chọn center mà chính user có active membership; acting mode là thao tác đại diện/giả lập quyền cần audit riêng.

## 18. Risk list

Rủi ro chính:

- tạo Auth user từ frontend hoặc không có service-role guard;
- `center_admin` có nhiều active center memberships;
- dùng `center_members` cho teacher assignment làm lẫn nghĩa admin ownership và teacher availability;
- teacher broad write không scoped theo assignment/session;
- Module 6 tạo local teacher tiếp tục bị hiểu nhầm là tạo teacher global;
- thiếu lifecycle làm không biết pause/disable account, membership hay assignment;
- thiếu audit cho owner provisioning và acting mode;
- áp dụng SQL/runtime trước khi C7.2 inspect hiện trạng thật.

## 19. C7 phase split

Đề xuất phase split:

- C7.1 - Account & People Model audit/design
- C7.2 - Read-only inspection pack for auth/membership/teacher data
- C7.3 - Center admin provisioning design/apply pack
- C7.4 - Owner creates/admin account flow
- C7.5 - Teacher global profile model
- C7.6 - Assign teachers to centers
- C7.7 - Module 6 teacher assignment rewrite
- C7.8 - Teacher login / Teacher Portal foundation
- C7.9 - Account Management checkpoint
- C7.10 hoặc later - Acting mode sau khi account model ổn định

Không sang C7.2 trong C7.1. C7.2 nên chỉ là read-only inspection pack trước khi apply account/runtime.

## 20. PASS / NEEDS REVIEW criteria

PASS khi:

- docs/test C7.1 đầy đủ;
- owner-only teacher creation model rõ;
- `center_admin` không tạo global teacher;
- teacher multi-center model rõ;
- `center_admin` one-center-only rõ;
- Module 6 reuse direction rõ;
- `admin.<slug>@ichess.vn` concept rõ;
- Auth user creation server-side safety rõ;
- không SQL/Supabase action/Auth user/membership/runtime;
- smoke/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu phát hiện cần SQL/runtime ngay, có src diff, có account/membership thật được tạo, có Supabase action, có file ngoài scope, có mojibake mới, hoặc chưa chứng minh được boundary owner/admin/teacher.
