# C6.6E - Runtime Add Center form RPC

C6.6E STATUS: RUNTIME ADD CENTER FORM RPC
C6_6D_1_STATUS: PASS
PHONGTRONG_PRECHECK_BY_USER: PASS
RUNTIME_ADD_CENTER_FORM_IMPLEMENTED: YES
OWNER_ONLY_FORM: YES
VISIBLE_REQUIRED_FIELD_COUNT: 1
VISIBLE_REQUIRED_FIELD: Tên cơ sở
CLIENT_PREVIEW_SLUG_IMPLEMENTED: YES
CLIENT_PREVIEW_CENTER_ID_IMPLEMENTED: YES
CLIENT_COMPACT_SLUG_CONVENTION: YES
RPC_CALL_IMPLEMENTED: YES
RPC_NAME: provision_center_for_owner
RPC_SQL_INPUT: p_center_name
FRONTEND_DIRECT_INSERT_USED: NO
DEFAULT_ENVIRONMENT: production
DEFAULT_STATUS: active
CONTROLLED_MANUAL_QA_TARGET: Phòng Trống
CONTROLLED_MANUAL_QA_TARGET_SLUG: phongtrong
CONTROLLED_MANUAL_QA_TARGET_CENTER_ID: phongtrong_prod
GO_VAP_USED_AS_TEST_TARGET: NO
CENTERS_LIST_REFRESH_AFTER_CREATE: YES
LOADING_STATE_IMPLEMENTED: YES
SUCCESS_STATE_IMPLEMENTED: YES
ERROR_STATE_IMPLEMENTED: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
RPC_CALLED_BY_CODEX: NO
AUTH_USER_CREATED: NO
CENTER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
RUNTIME_CHANGE: YES
RUNTIME_CHANGE_SCOPE: INTERNAL_CENTER_CONSOLE_ADD_CENTER_FORM_RPC_ONLY
C6_6F_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6E

C6.6E thêm form runtime owner-only trong Internal Center Console để owner tạo cơ sở production trống từ một field `Tên cơ sở` qua RPC `provision_center_for_owner(p_center_name)` đã được user apply thủ công ở C6.6C.

CodeX không chạy SQL, không gọi RPC, không tự tạo center thật. Center chỉ được tạo khi user owner bấm nút trong app.

## 2. Trạng thái sau C6.6D.1

C6.6D.1 đã PASS và đổi target controlled test từ `Gò Vấp/govap_prod` sang `Phòng Trống/phongtrong_prod`.

User đã precheck `phongtrong_prod/phongtrong` và báo 0 rows, nghĩa là target manual QA chưa tồn tại trước khi user bấm tạo.

## 3. SQL safety statement

Mục đích:

- Cho owner tạo cơ sở production trống từ một field `Tên cơ sở` qua RPC đã apply.

Môi trường:

- Supabase project hiện tại của iChess Center OS.

Có phá dữ liệu không:

- CodeX không chạy SQL.
- CodeX không gọi RPC.
- Runtime chỉ tạo dữ liệu khi user owner bấm nút trong app.
- Khi user bấm tạo, RPC sẽ thêm row mới vào `public.centers` và `public.center_members`.
- Không xóa dữ liệu.
- Không clone DreamHome.
- Không copy Angel Wings.

Manual QA chỉ nên dùng target đã precheck 0 rows: `Phòng Trống / phongtrong / phongtrong_prod`.

## 4. Runtime changes summary

Runtime thay đổi tối thiểu trong `#/internal/centers`:

- thêm form `Thêm cơ sở` trong Internal Center Console;
- chỉ render sau owner guard hiện có;
- preview slug compact và center_id readonly;
- gọi `supabase.rpc('provision_center_for_owner', { p_center_name })` khi submit;
- refresh list `centers` production/active sau success;
- không direct insert vào `centers` hoặc `center_members`.

## 5. Owner-only access

Form chỉ xuất hiện sau `getInternalCenterConsoleAccess(...).isOwner`.

`center_admin` và signed-out vẫn bị chặn bởi màn hình denied/login gate hiện có, không thấy list internal và không thấy form.

## 6. Form một field `Tên cơ sở`

Visible required field count: 1.

Field duy nhất:

- `Tên cơ sở`

User không nhập slug, center_id, environment, status, owner id, SQL hoặc membership.

## 7. Preview slug/center_id

Client preview:

- `Slug: <compact-slug>`
- `Mã cơ sở sẽ tạo: <compact-slug>_prod`
- `Môi trường: production`
- `Trạng thái: active`

Rule compact slug client-side:

- trim;
- lowercase;
- `đ -> d`;
- bỏ dấu tiếng Việt bằng normalize;
- chỉ giữ `a-z0-9`;
- không gạch ngang.

Client preview chỉ để UX; RPC/DB vẫn là source of truth.

## 8. Client-side validation

Không submit nếu:

- tên rỗng;
- tên sau trim ngắn hơn 2 ký tự;
- slug compact rỗng.

Thông báo:

- `Vui lòng nhập tên cơ sở.`
- `Tên cơ sở quá ngắn.`
- `Tên cơ sở chưa tạo được mã hợp lệ.`

## 9. RPC call design

Submit dùng authenticated owner session hiện tại:

```js
supabase.rpc('provision_center_for_owner', {
  p_center_name: centerName,
})
```

Không có auto-call khi load trang. Không hardcode tự tạo `Phòng Trống` trong code/test.

## 10. Vì sao không direct insert

Frontend không insert/upsert/delete trực tiếp `public.centers` hoặc `public.center_members`.

RPC là nơi giữ guard `auth.uid()`, owner membership check, slug convention và transaction tạo center + membership. Nếu RPC lỗi auth/RLS, không bỏ guard và không fallback direct insert.

## 11. Loading/success/error states

Các state đã có:

- Idle
- Submitting: `Đang tạo cơ sở...`
- Success: `Đã tạo cơ sở <Tên cơ sở>.`
- Error: `Không tạo được cơ sở. <message>`

Sau success, input được clear và list production/active được refresh từ Cloud.

## 12. Duplicate/conflict handling

Nếu RPC trả lỗi duplicate/unique/already exists, UI hiển thị:

`Mã cơ sở đã tồn tại hoặc tên cơ sở đã được dùng trong production.`

UI không tự sinh `phongtrong2_prod`.

## 13. Manual QA target Phòng Trống

Manual QA target:

- Tên cơ sở: Phòng Trống
- Expected slug: `phongtrong`
- Expected center_id: `phongtrong_prod`
- environment: `production`
- status: `active`

Không dùng Gò Vấp làm target test vì Gò Vấp có thể là cơ sở thật sau này.

## 14. Manual QA after create

Sau khi user owner bấm tạo:

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Nhập `Phòng Trống`.
4. Kiểm tra preview `phongtrong / phongtrong_prod`.
5. Bấm `Tạo cơ sở`.
6. Expected success.
7. List refresh và thấy `Phòng Trống / phongtrong_prod / phongtrong / production / active`.

## 15. Non-owner/signed-out regression

`center_admin` DreamHome:

- vào `#/internal/centers`;
- expected bị chặn;
- không thấy form.

Signed-out:

- vào `#/internal/centers`;
- expected login gate;
- không thấy form.

## 16. C6.6F post-create verification dependency

C6.6F chỉ bắt đầu sau khi user manual QA tạo `Phòng Trống` thành công hoặc có kết quả lỗi cần review.

C6.6E không tạo docs post-create checkpoint C6.6F.

## 17. C7 deferred

C7 vẫn deferred:

- username login;
- account management;
- tạo/sửa Auth user;
- permission override;
- Teacher Portal;
- Super Admin advanced;
- acting mode.

## 18. PASS / NEEDS REVIEW criteria

PASS nếu:

- owner-only Add Center form implemented;
- form chỉ có một field required `Tên cơ sở`;
- preview slug/center_id compact đúng;
- RPC `provision_center_for_owner(p_center_name)` wired;
- không direct insert `centers`/`center_members`;
- không auto-call RPC/code tạo center;
- loading/success/error states có;
- list refresh sau create;
- center_admin/signed-out vẫn bị chặn;
- không dùng Gò Vấp làm test target;
- không SQL/Supabase action bởi CodeX;
- không tạo Auth user/center/membership bởi CodeX;
- runtime diff đúng scope;
- smokes/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu RPC wiring cần bỏ guard, cần direct insert, có auto-create center, hoặc access guard non-owner bị hở.
