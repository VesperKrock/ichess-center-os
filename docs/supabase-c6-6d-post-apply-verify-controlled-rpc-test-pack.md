# C6.6D - Post-apply verify + controlled RPC test pack

C6.6D STATUS: POST APPLY VERIFY CONTROLLED RPC TEST PACK
C6_6C_STATUS: PASS
C6_6C_MANUAL_APPLY_BY_USER: PASS
C6_6C_SLUG_VERIFY_BY_USER: PASS
READONLY_VERIFY_RPC_APPLIED_SQL_CREATED: YES
CONTROLLED_CREATE_RPC_TEMPLATE_CREATED: YES
POST_CREATE_VERIFY_SQL_CREATED: YES
RPC_NAME: provision_center_for_owner
RPC_SQL_INPUT: p_center_name
VISIBLE_REQUIRED_FIELD: Tên cơ sở
COMPACT_SLUG_CONVENTION_CONFIRMED: YES
SLUG_EXAMPLE_GO_VAP: govap
SLUG_EXAMPLE_PHU_NHUAN: phunhuan
SLUG_EXAMPLE_THU_DUC: thuduc
SLUG_EXAMPLE_QUAN_12: quan12
TARGET_PRECHECK_DESIGNED: YES
DEFAULT_REAL_TARGET_FOR_CONTROLLED_TEST: Phòng Trống
DEFAULT_REAL_TARGET_CENTER_ID: phongtrong_prod
DEFAULT_REAL_TARGET_SLUG: phongtrong
SQL_EDITOR_AUTH_UID_LIMITATION_DOCUMENTED: YES
NO_FAKE_TEST_CENTER_RECOMMENDED_WITHOUT_CLEANUP: YES
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

## 1. Mục tiêu C6.6D

C6.6D chuẩn bị gói kiểm tra sau apply và controlled RPC test pack cho `provision_center_for_owner(p_center_name)`. Phase này chỉ tạo docs, SQL template và smoke static.

C6.6D không chạy SQL, không gọi RPC, không tự tạo center thật, không sửa runtime, không tạo nút Thêm cơ sở UI, không mở C6.6E/C7 và không commit/push.

## 2. Trạng thái sau C6.6C apply

Theo user, C6.6C manual apply đã PASS:

- Apply SQL: Success. No rows returned.
- Helper `public.ichess_slugify_center_name_compact(input text)` đã apply.
- RPC `public.provision_center_for_owner(p_center_name text)` đã apply.
- Slug helper verify PASS:
  - Phòng Trống -> phongtrong
  - Gò Vấp -> govap
  - Phú Nhuận -> phunhuan
  - Thủ Đức -> thuduc
  - Quận 12 -> quan12
  - Bình Thạnh -> binhthanh
  - iChess Gò Vấp 2 -> ichessgovap2

## 3. SQL safety statement

Mục đích:

- Kiểm tra RPC `provision_center_for_owner(p_center_name)` đã hoạt động sau apply.
- Chuẩn bị một lần gọi RPC có kiểm soát để tạo cơ sở production trống.

Môi trường:

- Supabase project hiện tại của iChess Center OS.

Có phá dữ liệu không:

- C6.6D không chạy SQL.
- SQL verify read-only không sửa dữ liệu.
- SQL controlled test nếu user chạy sẽ tạo center thật và owner membership thật.
- Không xóa dữ liệu.
- Không clone DreamHome.
- Không copy Angel Wings.

Backup:

- Nên chụp schema/data snapshot trước khi chạy controlled create RPC vì bước đó sẽ thêm row mới vào `public.centers` và `public.center_members`.

Thứ tự:

1. Verify RPC/helper/function exists.
2. Verify target center chưa tồn tại.
3. User xác nhận target center name.
4. User chạy đúng một câu RPC trong context phù hợp.
5. Verify center mới xuất hiện.
6. Verify owner membership mới xuất hiện.
7. Mở Internal Center Console kiểm tra list production/active.

## 4. Files created

C6.6D tạo:

- `docs/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md`
- `docs/supabase-c6-6d-readonly-verify-rpc-applied.sql`
- `docs/supabase-c6-6d-controlled-create-center-rpc-template.sql`
- `docs/supabase-c6-6d-post-create-verify-center.sql`
- `tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js`

## 5. Read-only verify RPC applied

File:

```txt
docs/supabase-c6-6d-readonly-verify-rpc-applied.sql
```

File này kiểm:

- helper function exists;
- RPC function exists;
- RPC args include `p_center_name text`;
- slug helper examples return expected;
- owner membership hiện tại;
- candidate target centers chưa tồn tại.

File này không gọi `provision_center_for_owner`.

## 6. Slug verify expected

Expected helper outputs:

```txt
Phòng Trống -> phongtrong
Gò Vấp -> govap
Phú Nhuận -> phunhuan
Thủ Đức -> thuduc
Quận 12 -> quan12
Bình Thạnh -> binhthanh
iChess Gò Vấp 2 -> ichessgovap2
```

## 7. Target center precheck

Precheck phải xác nhận các target candidate chưa tồn tại trước khi user tạo thật:

- `phongtrong_prod` / `phongtrong` (default controlled test target)
- `govap_prod` / `govap` (không dùng làm target test mặc định sau C6.6D.1)
- `phunhuan_prod` / `phunhuan`
- `thuduc_prod` / `thuduc`
- `quan12_prod` / `quan12`
- `binhthanh_prod` / `binhthanh`

Nếu target đã tồn tại, không chạy create RPC lần nữa.

## 8. Controlled create RPC template

File:

```txt
docs/supabase-c6-6d-controlled-create-center-rpc-template.sql
```

Template có cảnh báo:

- DO NOT RUN UNLESS USER CONFIRMS THE TARGET CENTER NAME.
- Nếu chạy thành công, SQL sẽ tạo production center thật và owner membership thật.
- Chỉ chạy sau read-only precheck.
- Chỉ chạy một lần cho mỗi target.

RPC examples đều đang comment, ví dụ:

```sql
-- select public.provision_center_for_owner('Phòng Trống');
```

## 9. Vì sao không tạo fake/test center nếu chưa có cleanup

Không khuyến nghị fake/test center nếu chưa có cleanup/archive plan vì:

- production `centers` list sẽ có row dư;
- owner membership có thể tồn tại lâu dài;
- chưa có UI archive/delete center;
- cleanup bằng SQL sẽ thành thao tác nhạy cảm và cần phase riêng.

Ưu tiên chỉ tạo target thật mà user định giữ.

## 10. Vì sao ưu tiên target test Phòng Trống sau C6.6D.1

Sau C6.6D.1, không dùng Gò Vấp làm target test vì Gò Vấp có thể là cơ sở thật trong tương lai. Nếu tạo `govap_prod` để test, sau này anh Hải tạo Gò Vấp thật sẽ bị conflict.

`Phòng Trống` là target test an toàn hơn vì được chọn riêng để kiểm tra controlled RPC create một lần, không chiếm slug/center_id của cơ sở thật dự kiến.

Default target:

- name: Phòng Trống
- slug: `phongtrong`
- center_id: `phongtrong_prod`
- environment: `production`
- status: `active`

## 11. SQL Editor auth.uid() limitation

SQL Editor chạy với role `postgres` có thể không có `auth.uid()`.

RPC dùng `auth.uid()` nên có thể cần test qua authenticated app session/runtime. Nếu gọi RPC trong SQL Editor bị `not_authenticated` hoặc `owner_membership_required`, không tự sửa RPC để bỏ guard.

Đây là behavior đúng của security guard, không phải lý do để weaken authorization.

## 12. Supabase authenticated app/session test option

Hai hướng test hợp lệ:

- A. Test RPC qua app authenticated session sau khi runtime có nút/form hoặc helper an toàn.
- B. Test thủ công bằng Supabase client authenticated nếu có context JWT/session phù hợp.

C6.6D không tự làm hai hướng này; chỉ chuẩn bị checklist/template.

## 13. Post-create verify SQL

File:

```txt
docs/supabase-c6-6d-post-create-verify-center.sql
```

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

## 14. Internal Center Console manual QA after create

Sau khi tạo Phòng Trống thành công:

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected thấy thêm Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`.
4. DreamHome production vẫn còn.
5. Staging `dreamhome` vẫn bị ẩn mặc định.
6. Không thấy dữ liệu học viên/giáo viên/lịch seed.
7. `center_admin` DreamHome vẫn không vào được internal console.

## 15. Rollback/cleanup risk note

Nếu tạo nhầm center thật, cleanup sẽ là thao tác dữ liệu nhạy cảm:

- xóa/archive center;
- xóa/archive membership;
- kiểm tra entity data liên quan nếu đã phát sinh.

C6.6D không cung cấp rollback execution. Không tạo fake center nếu chưa có cleanup/archive plan.

## 16. C6.6E runtime plan

C6.6E có thể làm runtime authenticated call nếu SQL Editor không có `auth.uid()` hoặc nếu user muốn flow UI thật.

C6.6E chưa started trong C6.6D.

## 17. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- tạo/sửa Auth user;
- permission override;
- Teacher Portal;
- Super Admin advanced;
- acting mode.

## 18. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/read-only verify SQL/controlled create template/post-create verify/test đầy đủ;
- C6.6C manual apply/slug verify được ghi PASS;
- target precheck rõ;
- default controlled test target Phòng Trống/phongtrong_prod/phongtrong rõ;
- SQL Editor `auth.uid()` limitation được ghi rõ;
- không khuyến nghị fake test center nếu chưa có cleanup;
- không SQL/Supabase action;
- không gọi RPC;
- không tạo Auth user/membership/center mới bởi CodeX;
- không runtime change;
- không mở C6.6E/C7;
- tests/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu template có executable RPC call, verify SQL có mutation, hoặc cần bỏ auth guard để test.
