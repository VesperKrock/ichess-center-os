# C7.6G.3 - Service role grants cho admin provisioning

C7.6G.3 STATUS: SERVICE ROLE GRANTS FOR ADMIN PROVISIONING
C7_6G_DEPLOY_BY_USER: PASS
C7_6G_2_REDEPLOY_BY_USER: PASS
C7_6G_2_DEBUG_ERROR_CODE: 42501
C7_6G_2_DEBUG_ERROR_MESSAGE: permission denied for table center_members
C7_6G_2_DEBUG_ERROR_HINT_CAPTURED: YES
ROOT_CAUSE: service_role_missing_table_privileges
SERVICE_ROLE_GRANTS_MANUAL_APPLY_SQL_CREATED: YES
SERVICE_ROLE_GRANTS_POST_APPLY_VERIFY_SQL_CREATED: YES
GRANT_PUBLIC_SCHEMA_USAGE_TO_SERVICE_ROLE: YES
GRANT_CENTERS_SELECT_TO_SERVICE_ROLE: YES
GRANT_CENTER_MEMBERS_SELECT_TO_SERVICE_ROLE: YES
GRANT_CENTER_MEMBERS_INSERT_TO_SERVICE_ROLE: YES
GRANT_CENTER_MEMBERS_DELETE_TO_SERVICE_ROLE: YES
GRANT_ACCOUNT_AUDIT_LOGS_SELECT_TO_SERVICE_ROLE: YES
GRANT_ACCOUNT_AUDIT_LOGS_INSERT_TO_SERVICE_ROLE: YES
GRANT_UPDATE_TO_SERVICE_ROLE: NO
GRANT_ALL_PRIVILEGES_TO_SERVICE_ROLE: NO
GRANT_AUTHENTICATED_OR_ANON: NO
RLS_POLICY_CHANGED: NO
DATA_INSERTED_BY_CODEX: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
EDGE_FUNCTION_REDEPLOYED_BY_CODEX: NO
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_IN_SUPABASE: NO
ADMIN_PHONGTRONG_CREATED: NO
RUNTIME_UI_CHANGE: NO
C7_6H_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh lỗi 42501 permission denied

Sau C7.6G.2, user redeploy/retest DreamHome no-op và nhận được debug rõ ràng từ owner guard. Function đã đi tới service-role DB query, nhưng database từ chối quyền đọc bảng `public.center_members`.

Điều này xác nhận dữ liệu owner không sai; lỗi nằm ở table privilege của database role `service_role`.

## 2. Debug object từ C7.6G.2

Debug user cung cấp:

```txt
HTTP status: 500
code: owner_guard_query_failed
debug.step: owner_guard
debug.center_id: dreamhome_prod
debug.actor_user_id: 9683b2c8-3970-4eac-99b3-985d503bdeb9
debug.actor_email: owner.duchai@ichess.vn
debug.error_code: 42501
debug.error_message: permission denied for table center_members
debug.error_hint: Grant SELECT ON public.center_members TO service_role;
```

SQL trước đó đã xác nhận owner membership tồn tại:

```txt
owner.duchai@ichess.vn
user_id: 9683b2c8-3970-4eac-99b3-985d503bdeb9
dreamhome_prod / owner / active
phongtrong_prod / owner / active
```

## 3. Root cause

Root cause: `service_role_missing_table_privileges`.

Edge Function dùng service role key đúng hướng, nhưng database role `service_role` chưa có đủ GRANT trên các bảng public mà function cần để đọc/ghi trong admin provisioning.

## 4. Vì sao GRANT cho service_role là đúng

Function `provision-center-admin-account` là server-side privileged flow:

- User JWT chỉ dùng để xác thực actor qua `auth.getUser(token)`.
- DB read/write cho owner guard, duplicate guard, membership, audit phải do service role thực hiện.
- RLS policy hiện tại của `center_members` chủ yếu cho authenticated user đọc membership của chính họ; function provisioning cần vượt qua giới hạn user-facing đó sau khi đã verify owner.

Do đó, cấp quyền tối thiểu cho `service_role` là đúng hơn so với mở policy cho `authenticated` hoặc `anon`.

## 5. Quyền tối thiểu cần cấp

`public.centers`:

- `SELECT` để validate target center production/active/slug.

`public.center_members`:

- `SELECT` để owner guard và existing center_admin duplicate guard.
- `INSERT` để tạo center_admin membership sau Auth user.
- `DELETE` để rollback membership nếu audit fail.

`public.account_audit_logs`:

- `SELECT` để idempotency check by request_id.
- `INSERT` để ghi audit row trước khi trả temporary password một lần.

Không cấp `UPDATE`, không cấp `ALL PRIVILEGES`, không cấp cho `authenticated` hoặc `anon`, không thay đổi RLS policy.

## 6. SQL safety statement

Mục đích:

- Cấp quyền tối thiểu cho database role `service_role` để Edge Function server-side có thể đọc/ghi các bảng cần cho admin provisioning.

Môi trường:

- Supabase project iChess Center OS.

Tính chất:

- Đây là SQL GRANT privilege.
- Không tạo Auth user.
- Không tạo membership.
- Không tạo center.
- Không tạo `admin.phongtrong@ichess.vn`.
- Không insert/update/delete dữ liệu business.
- Không thay đổi RLS policy.
- Không drop/truncate bảng.

Có phá dữ liệu không:

- Không có chủ đích phá dữ liệu.
- Chỉ thay đổi quyền truy cập của role `service_role`.

Backup:

- Nên lưu lại SQL trước khi apply.
- Có thể rollback bằng `REVOKE` nếu cần, nhưng C7.6G.3 không tạo rollback SQL để tránh thao tác ngược khi chưa có quyết định apply.

Thứ tự:

1. User review manual apply SQL.
2. User apply trong Supabase SQL Editor.
3. User chạy post-apply verify SQL.
4. User retest DreamHome no-op.

## 7. Manual apply SQL created

File manual apply SQL đã tạo:

```txt
docs/supabase-c7-6g-3-manual-apply-service-role-grants.sql
```

User tự chạy file này trong Supabase SQL Editor sau khi review. CodeX không chạy SQL.

## 8. Post-apply verify SQL created

File verify read-only đã tạo:

```txt
docs/supabase-c7-6g-3-post-apply-verify-service-role-grants.sql
```

Expected verify:

- `public_schema_usage = true`
- `centers_select = true`
- `center_members_select = true`
- `center_members_insert = true`
- `center_members_delete = true`
- `account_audit_logs_select = true`
- `account_audit_logs_insert = true`

## 9. Retest plan DreamHome no-op

Sau khi user apply + verify PASS, không cần redeploy function nếu chỉ apply GRANT privilege.

User retest bằng browser Console DreamHome no-op.

Expected:

```txt
HTTP status: 200/400/409 acceptable
code: center_admin_already_exists
No temporary_password
No password
No admin.phongtrong created
```

Nếu vẫn còn `owner_guard_query_failed`, gửi debug object only, không gửi token hoặc secret. Nếu lỗi chuyển sang permission denied cho `centers` hoặc `account_audit_logs`, chạy lại verify grants.

## 10. Safety: no data mutation except privilege grants

C7.6G.3 chỉ chuẩn bị manual SQL GRANT và verify SQL:

- Không apply SQL bởi CodeX.
- Không gọi Supabase thật.
- Không deploy Edge Function bởi CodeX.
- Không tạo/sửa/xóa Auth user.
- Không tạo admin thật.
- Không tạo membership thật.
- Không tạo audit row thật.
- Không sửa runtime UI.
- Không bắt đầu C7.6H.

## 11. C7.6H recommendation sau khi no-op PASS

Chỉ nên sang C7.6H hoặc controlled Phòng Trống provisioning sau khi:

- User apply GRANT SQL.
- Verify SQL PASS.
- DreamHome no-op trả `center_admin_already_exists`.
- Post-test verify xác nhận không có password leak và không có `admin.phongtrong@ichess.vn` được tạo ngoài kế hoạch.
