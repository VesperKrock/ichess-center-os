# C6.6D.1 - Đổi target controlled test sang Phòng Trống

C6.6D.1 STATUS: CONTROLLED TEST TARGET UPDATED TO PHONG TRONG
C6_6D_STATUS: PASS
OLD_DEFAULT_TARGET: Gò Vấp
OLD_DEFAULT_TARGET_CENTER_ID: govap_prod
OLD_DEFAULT_TARGET_SLUG: govap
NEW_DEFAULT_TARGET: Phòng Trống
NEW_DEFAULT_TARGET_CENTER_ID: phongtrong_prod
NEW_DEFAULT_TARGET_SLUG: phongtrong
REASON_NOT_USE_GO_VAP_FOR_TEST: FUTURE_REAL_CENTER_CONFLICT_RISK
READONLY_PRECHECK_UPDATED: YES
CONTROLLED_CREATE_TEMPLATE_UPDATED: YES
POST_CREATE_VERIFY_UPDATED: YES
INTERNAL_CONSOLE_QA_UPDATED: YES
SQL_EDITOR_AUTH_UID_LIMITATION_PRESERVED: YES
NO_REAL_CENTER_CREATED_BY_CODEX: YES
NO_RPC_CALL_BY_CODEX: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
NEW_CENTER_CREATED_BY_CODEX: NO
RUNTIME_CHANGE: NO
C6_6E_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6D.1

C6.6D.1 đổi default target của controlled RPC test từ `Gò Vấp/govap_prod/govap` sang `Phòng Trống/phongtrong_prod/phongtrong`.

Phase này chỉ update docs, SQL template và smoke static. Không chạy SQL, không gọi `public.provision_center_for_owner`, không tạo center thật, không tạo user/membership, không sửa runtime, không commit/push.

## 2. Lý do đổi target test

C6.6D đã chuẩn bị controlled RPC test pack sau khi C6.6C manual apply/verify PASS. Default target cũ là `Gò Vấp/govap_prod`.

User quyết định đổi sang `Phòng Trống` để controlled test không chiếm slug/center_id của một cơ sở có khả năng được dùng thật sau này.

## 3. Vì sao không dùng Gò Vấp

Không dùng Gò Vấp làm target test vì Gò Vấp có thể là cơ sở thật trong tương lai.

Nếu tạo `govap_prod` để test, sau này anh Hải tạo Gò Vấp thật sẽ bị conflict với row test đã tồn tại trong `public.centers` và membership liên quan trong `public.center_members`.

Gò Vấp vẫn có thể xuất hiện trong docs như ví dụ slug hoặc cảnh báo, nhưng không còn là default controlled test target.

## 4. Target mới Phòng Trống

Target controlled test mới:

- Tên cơ sở: Phòng Trống
- slug: `phongtrong`
- center_id: `phongtrong_prod`
- environment: `production`
- status: `active`

`Phòng Trống -> phongtrong -> phongtrong_prod` là target test an toàn hơn vì tên này được chọn riêng cho controlled RPC test, không đại diện cho cơ sở thật dự kiến.

## 5. Files updated

Files C6.6D được cập nhật:

- `docs/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md`
- `docs/supabase-c6-6d-readonly-verify-rpc-applied.sql`
- `docs/supabase-c6-6d-controlled-create-center-rpc-template.sql`
- `docs/supabase-c6-6d-post-create-verify-center.sql`
- `tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js`

Files mới C6.6D.1:

- `docs/supabase-c6-6d-1-doi-target-test-phong-trong.md`
- `tests/supabase-c6-6d-1-doi-target-test-phong-trong-smoke.js`

## 6. Read-only precheck updated

`docs/supabase-c6-6d-readonly-verify-rpc-applied.sql` đã thêm candidate target:

- `phongtrong_prod`
- `phongtrong`

Expected trước khi tạo thật: query candidate centers trả 0 rows cho `phongtrong_prod/phongtrong`.

Read-only precheck vẫn không gọi `provision_center_for_owner` và không mutate dữ liệu/schema.

## 7. Controlled create template updated

`docs/supabase-c6-6d-controlled-create-center-rpc-template.sql` đã đổi commented example chính thành:

```sql
-- Target test center chosen by user to avoid future real-branch conflicts:
-- select public.provision_center_for_owner('Phòng Trống');
```

Template không có uncommented RPC call. Gò Vấp chỉ còn ở comment cảnh báo/option không mặc định:

```txt
Do not use Gò Vấp / govap_prod for test because it may become a real future center.
```

## 8. Post-create verify updated

`docs/supabase-c6-6d-post-create-verify-center.sql` default verify đã đổi sang:

- `id = 'phongtrong_prod'`
- `slug = 'phongtrong'`
- `cm.center_id = 'phongtrong_prod'`

Expected sau controlled create Phòng Trống:

`public.centers`:

- id = `phongtrong_prod`
- name = Phòng Trống
- slug = `phongtrong`
- environment = `production`
- status = `active`

`public.center_members`:

- center_id = `phongtrong_prod`
- user = current owner
- role = `owner`
- status = `active`

## 9. Internal Console QA updated

Sau khi user tạo Phòng Trống thành công bằng controlled RPC trong authenticated owner context:

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected thấy Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`.
4. DreamHome production vẫn còn.
5. Staging `dreamhome` vẫn bị ẩn mặc định.
6. `center_admin` DreamHome vẫn không vào được internal console.

## 10. SQL Editor auth.uid() limitation vẫn giữ nguyên

SQL Editor chạy với role `postgres` có thể không có `auth.uid()`.

RPC dùng `auth.uid()` nên có thể cần test qua authenticated app session/runtime. Nếu gọi RPC trong SQL Editor bị `not_authenticated` hoặc `owner_membership_required`, không tự sửa RPC để bỏ guard.

Nếu SQL Editor không có `auth.uid()`, hướng đúng là sang C6.6E runtime authenticated call thay vì nới lỏng authorization.

## 11. Safety checklist

- SQL applied by CodeX: NO
- Supabase action by CodeX: NOT RUN
- RPC called by CodeX: NO
- Auth user created: NO
- Membership created by CodeX: NO
- New center created by CodeX: NO
- Runtime change: NO
- C6.6E started: NO
- C7 started: NO
- Commit: NOT RUN
- Push: NOT RUN

## 12. PASS / NEEDS REVIEW criteria

PASS nếu:

- default target đã đổi sang `Phòng Trống/phongtrong_prod/phongtrong`;
- Gò Vấp không còn là target test mặc định;
- docs ghi rõ lý do tránh future real center conflict;
- SQL templates/verify được cập nhật;
- không SQL/Supabase action;
- không gọi RPC;
- không tạo center/membership/user;
- không runtime change;
- smokes/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu template có executable RPC call, post-create verify còn trỏ default `govap_prod`, có `src` diff, hoặc cần bỏ auth guard để test.
