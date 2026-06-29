# C6.1C - Production/staging split + thêm cơ sở trống

C6.1C STATUS: PRODUCTION/STAGING SPLIT + PROVISIONING PACK ONLY
STAGING_CENTER_ID: dreamhome
PRODUCTION_CENTER_ID: dreamhome_prod
ADD_CENTER_NOT_CLONE: YES
ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
DREAMHOME_REUSED_AS_PRODUCTION: NO
DREAMHOME_PROD_CREATED_BY_CODEX: NO
AUTH_USER_CREATED_BY_CODEX: NO
BICH_USER_CREATED: NO
SQL_APPLIED: NO
SUPABASE_ACTION: NOT RUN
RUNTIME_CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
C7_STARTED: NO

## 1. Mục tiêu C6.1C

C6.1C chốt production/staging split và tạo provisioning pack an toàn cho “thêm cơ sở trống”. Phase này chỉ tạo docs, SQL read-only preflight, SQL manual-apply template và smoke test.

C6.1C không chạy SQL, không Supabase action, không runtime, không commit và không push.

## 2. Trạng thái trước C6.1C

- Latest commit: `6fa4608 F23 feedback 2706 polish checkpoint`.
- C6.0: PASS.
- C6.1A: PASS.
- C6.1B: PASS.
- Worktree trước C6.1C: chỉ có C6.0/C6.1A/C6.1B docs/sql/tests.
- C6.1B verify do user cung cấp đã xác nhận cloud foundation OK nhưng `dreamhome` không còn là production empty center.

## 3. Kết quả C6.1B verify

Kết quả quan trọng:

- `center_cloud_entities`: exists.
- Required columns: OK.
- Entity allowlist: OK.
- Realtime publication: OK.
- Replica identity full: OK.
- Helper functions `can_write_center` / `is_center_member`: OK.
- `center_members` table: OK.
- RLS enabled: OK.
- `center_id = dreamhome` hiện có 59 records.
- Trong đó có 43 records liên quan Angel Wings.

Kết luận: database/cloud foundation OK, nhưng `dreamhome` hiện là staging/test sandbox chứ không phải DreamHome production empty center.

## 4. Quyết định staging/production split

Quyết định:

- `dreamhome` = staging/test sandbox hiện tại, giữ Angel Wings.
- `dreamhome_prod` = DreamHome production empty center mới.

Không rename `dreamhome` trong C6.1C. Không sửa `center_id dreamhome`. Nếu muốn rename staging thành `dreamhome_test`, đó là phase riêng có backup/verify/rollback.

Không migrate Angel Wings sang `dreamhome_prod`.

## 5. Vì sao không xóa Angel Wings

Không xóa Angel Wings vì:

- Angel Wings là controlled staging dataset dùng để bảo trì, phá test và kiểm thử realtime/cloud.
- Xóa dữ liệu hiện tại có thể làm mất sandbox đang có giá trị.
- C6.1B đã xác nhận Angel Wings đang tồn tại trong `dreamhome`; xử lý an toàn là tách production sang `dreamhome_prod`.

Angel Wings deleted: NO. Angel Wings migrated: NO.

## 6. Vì sao không reuse dreamhome làm production

Không reuse `dreamhome` làm production vì:

- `dreamhome` đã có 59 records.
- Có 43 records liên quan Angel Wings.
- Runtime/localStorage/membership/cloud references hiện đang dùng `dreamhome`.
- Dọn sạch hoặc rename ngay là migration rủi ro cao.

`dreamhome` được giữ làm staging/test sandbox. DreamHome production dùng `dreamhome_prod`.

## 7. “Thêm cơ sở trống” khác “nhân bản cơ sở”

Thêm cơ sở trống = tạo center identity/membership tối thiểu, không copy dữ liệu vận hành.

Nhân bản cơ sở = copy dữ liệu từ center nguồn sang center mới. Kiểu này chỉ dùng cho test/sandbox nếu có phase riêng.

C6.1C chọn “thêm cơ sở trống”, không nhân bản cơ sở.

## 8. Naming convention center_id

Naming convention tạm chốt:

- `dreamhome`: staging/test sandbox.
- `dreamhome_prod`: DreamHome production empty center.

Tên này tránh nhầm lẫn giữa center production và sandbox hiện tại, đồng thời giữ một link chung cho app.

## 9. DreamHome production target

DreamHome production target:

- `center_id = dreamhome_prod`
- `display_name = DreamHome`
- Center type: production empty center.
- Không có học viên/giáo viên/lịch/học phí/điểm danh/session report từ Angel Wings.
- Không có records trong `center_cloud_entities` lúc mới provision, trừ khi phase sau thêm metadata hợp lệ.

## 10. Chị Bích admin DreamHome production

Chị Bích là admin cơ sở DreamHome production.

C6.1C chưa tạo Auth user cho chị Bích. Sau C6.1C PASS, user sẽ tạo Auth user thủ công trong Supabase Dashboard hoặc bằng phase riêng.

Sau khi có `auth.users.id` của chị Bích, chạy manual apply membership template để gán:

- `center_id = dreamhome_prod`
- `role = center_admin`
- `status = active`
- `user_id = <BICH_AUTH_USER_ID>`

Placeholder dùng trong docs/SQL:

- `<BICH_AUTH_USER_ID>`
- `<BICH_EMAIL_OR_LOGIN>`

## 11. Current schema limitation: chưa có centers table/center_profile nếu audit xác nhận

C6.1B đã xác nhận có `center_members`, nhưng chưa xác nhận có bảng `centers` hoặc `center_profile`.

Nếu không có bảng `centers`/`center_profile`:

- Center identity hiện tại chủ yếu được biểu diễn qua `center_members.center_id` và dữ liệu trong `center_cloud_entities`.
- Empty production center có thể tồn tại bằng active membership trỏ tới `center_id = dreamhome_prod`, kể cả khi `center_cloud_entities` chưa có record nào.
- Display name đẹp có thể phải defer C6.2/C7 hoặc thêm center profile schema sau.

Không tự thêm `center_profile` entity trong C6.1C vì allowlist hiện chưa có `center_profile`.

## 12. Provisioning model hiện tại

Provisioning model C6.1C:

1. Chạy read-only preflight để xác nhận schema/membership/counts.
2. User tạo Auth user chị Bích thủ công.
3. User copy `auth.users.id`.
4. User thay `<BICH_AUTH_USER_ID>` trong manual apply template.
5. User chạy manual apply membership SQL.
6. User verify membership cho `dreamhome_prod`.
7. Nếu runtime vẫn hardcode `dreamhome`, chuyển sang C6.1D để xử lý center resolver/cache guard.

CodeX không tạo center thật, không tạo user thật và không chạy SQL.

## 13. Read-only preflight SQL

Preflight SQL:

`docs/supabase-c6-1c-readonly-preflight-dreamhome-prod.sql`

Preflight kiểm:

- `center_members` table exists.
- Columns `id`, `user_id`, `center_id`, `role`, `status`, `created_at`, `updated_at`.
- Defaults/constraints/indexes nếu có.
- Current rows for `center_id = dreamhome_prod`.
- Note placeholder user_id chưa check được.
- `center_cloud_entities` count for `center_id = dreamhome_prod`.
- Angel Wings count trong `dreamhome_prod` phải là 0.
- Existing `dreamhome` count/staging note.
- Helper `can_write_center` / `is_center_member` exists.
- Auth users manual note.

Preflight là READ ONLY, không sửa dữ liệu.

## 14. Manual apply membership SQL template

Manual apply template:

`docs/supabase-c6-1c-manual-apply-dreamhome-prod-membership-template.sql`

Template chỉ gán membership cho chị Bích sau khi user thay placeholder thật:

- `center_id = dreamhome_prod`
- `role = center_admin`
- `status = active`
- `user_id = <BICH_AUTH_USER_ID>`

Template không tạo Auth user, không tạo password, không insert `center_cloud_entities`, không copy Angel Wings.

## 15. Hướng dẫn tạo Auth user chị Bích thủ công

User tạo Auth user chị Bích thủ công trong Supabase Dashboard nếu cần:

1. Vào Supabase Dashboard.
2. Mở Authentication.
3. Tạo user cho chị Bích theo email/login thực tế.
4. Không ghi email thật vào docs repo nếu chưa cần.
5. Copy `auth.users.id`.

C6.1C không tạo Auth user chị Bích.

## 16. Hướng dẫn lấy user_id

Sau khi tạo user:

- Copy UUID `auth.users.id`.
- Thay `<BICH_AUTH_USER_ID>` trong manual apply template.
- Nếu cần ghi chú nội bộ, dùng `<BICH_EMAIL_OR_LOGIN>` thay vì email thật trong docs public.

Không query `auth.users` trong preflight chính.

## 17. Hướng dẫn gán membership sau khi có user_id

Sau khi có `auth.users.id` thật:

1. Chạy preflight SQL.
2. Nếu preflight OK, mở manual apply template.
3. Thay `<BICH_AUTH_USER_ID>` bằng UUID thật.
4. Review lại `center_id = dreamhome_prod`, `role = center_admin`, `status = active`.
5. Chạy SQL thủ công trong Supabase SQL Editor.
6. Verify lại membership.

Không chạy template khi còn placeholder.

## 18. Expected result sau provisioning

Expected sau provisioning:

- `center_members` có một membership active cho chị Bích.
- `center_id = dreamhome_prod`.
- `role = center_admin`.
- `center_cloud_entities` cho `dreamhome_prod` vẫn empty.
- Không có Angel Wings trong `dreamhome_prod`.
- `dreamhome` staging vẫn giữ nguyên.

## 19. Runtime/cache risk

Runtime/cache risk:

- Nếu app vẫn hardcode `dreamhome`, chị Bích đăng nhập có thể vào staging thay vì production.
- Nếu cloud center `dreamhome_prod` empty nhưng localStorage còn `dreamhome` staging, app không được fallback nhầm.
- One shared link vẫn đúng sản phẩm, nhưng app cần center resolver dựa vào auth + membership.

C6.1D có thể cần runtime center resolver/cache guard. C6.1C không sửa runtime.

## 20. C6.1D recommendation nếu cần

C6.1D nên xử lý nếu app chưa vào đúng center:

- Runtime center resolver: user có 1 active membership thì auto-enter center đó.
- Nếu nhiều membership thì hiện chọn cơ sở.
- Nếu không có membership active thì không vào dashboard.
- Cache guard theo center_id để tránh `dreamhome` staging lấp vào `dreamhome_prod`.
- Status rõ data source/center hiện tại.

## 21. C7 deferred items

C7 deferred:

- Username login.
- Quản lý tài khoản.
- Nút “Thêm cơ sở” UI cho anh Hải.
- Permission override.
- Acting mode.
- Teacher Portal.
- Super Admin/internal console.

C6.1C chỉ là production center foundation + provisioning an toàn.

## 22. Safety checklist

Safety checklist:

- Không chạy SQL.
- Không Supabase action.
- Không tạo Auth user thật.
- Không tạo user chị Bích thật.
- Không xóa/sửa Angel Wings.
- Không sửa `center_id dreamhome`.
- Không rename `dreamhome`.
- Không clear `center_cloud_entities`.
- Không migrate/copy staging sang production.
- Không reset localStorage.
- Không runtime change.
- Không mở C7.
- Không commit/push.

## 23. PASS / NEEDS REVIEW criteria

C6.1C PASS nếu:

- Docs đầy đủ.
- Preflight SQL read-only có.
- Manual apply template có, an toàn, placeholder rõ.
- Smoke C6.0/C6.1A/C6.1B/C6.1C pass.
- `npm run build` pass.
- `git diff --check` pass.
- Không runtime change.
- Không SQL applied.
- Không Supabase action.
- Không xóa/sửa Angel Wings.
- Không reuse `dreamhome` làm production.
- Không tạo Auth user thật.
- Không gán membership thật.
- Không commit/push.
- Không mở C7.
- Không file ngoài scope.

NEEDS REVIEW nếu có file ngoài scope, cần chạy SQL ngay, cần runtime bắt buộc trong C6.1C, hoặc template không thể giữ an toàn với placeholder.

## 24. Recommendation

Recommendation: user chạy preflight SQL, tạo Auth user chị Bích thủ công, thay `<BICH_AUTH_USER_ID>` trong manual apply template sau khi review, rồi mới chạy template.

Không chạy manual apply nếu chưa thay placeholder và chưa review.
