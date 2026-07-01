# C7.6D - Edge Function admin provisioning implementation

C7.6D STATUS: EDGE FUNCTION ADMIN PROVISIONING IMPLEMENTATION PACK
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
C7_4_STATUS: PASS
C7_5_STATUS: PASS
C7_6A_STATUS: PASS
C7_6B_STATUS: PASS
C7_6C_STATUS: PASS
C7_6C_1_STATUS: PASS
AUDIT_TABLE_APPLIED_AND_VERIFIED: YES
EDGE_FUNCTION_FILE_CREATED: YES
EDGE_FUNCTION_NAME: provision-center-admin-account
FUNCTION_BUSINESS_NAME: provision_center_admin_account
VERIFY_JWT_REQUIRED: YES
VERIFY_JWT_DISABLED: NO
SERVICE_ROLE_SERVER_SIDE_ONLY: YES
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
REQUEST_CONTRACT_IMPLEMENTED: YES
FORBIDDEN_CLIENT_FIELDS_REJECTED: YES
AUTH_CALLER_VERIFICATION_IMPLEMENTED: YES
OWNER_GUARD_IMPLEMENTED: YES
TARGET_CENTER_VALIDATION_IMPLEMENTED: YES
ADMIN_EMAIL_GENERATION_IMPLEMENTED: YES
ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn
EXISTING_ADMIN_DUPLICATE_PROTECTION_IMPLEMENTED: YES
DREAMHOME_DUPLICATE_PROTECTION_IMPLEMENTED: YES
PHONGTRONG_TARGET_SUPPORTED: YES
IDEMPOTENCY_CHECK_IMPLEMENTED: YES
TEMPORARY_PASSWORD_CRYPTO_RANDOM: YES
MATH_RANDOM_PASSWORD_ALLOWED: NO
AUTH_ADMIN_CREATE_USER_IMPLEMENTED: YES
MEMBERSHIP_INSERT_IMPLEMENTED: YES
AUDIT_LOG_INSERT_IMPLEMENTED: YES
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO
ROLLBACK_CLEANUP_IMPLEMENTED: YES
ERROR_RESPONSES_RETURN_PASSWORD: NO
SUCCESS_RETURNS_PASSWORD_ONCE: YES
EDGE_FUNCTION_DEPLOYED: NO
SECRETS_SET_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_IN_SUPABASE: NO
ADMIN_PHONGTRONG_CREATED: NO
RUNTIME_UI_CHANGE: NO
C7_6E_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6D

C7.6D tạo implementation pack cho Edge Function `provision-center-admin-account`, business name `provision_center_admin_account`. Function source được tạo trong repo nhưng chưa deploy, chưa set secrets, chưa gọi Supabase thật và chưa tạo admin thật.

## 2. Trạng thái audit sau C7.6C.1

Audit table `public.account_audit_logs` đã được user apply/verify PASS. Verify result: table, columns, constraints, password key guard, indexes, RLS true đều PASS; policies trả no rows. Đây là điều kiện để function C7.6D insert audit trước khi trả mật khẩu tạm thời.

## 3. Function files created

Files:

- `supabase/functions/provision-center-admin-account/index.ts`
- `supabase/functions/provision-center-admin-account/deno.json`

`deno.json` dùng Supabase JS v2 qua `npm:@supabase/supabase-js@2`. Không tạo `supabase/config.toml` trong C7.6D.

## 4. Request contract

Function nhận POST JSON:

```json
{
  "center_id": "phongtrong_prod",
  "idempotency_key": "uuid-or-client-generated-string",
  "display_name": "Admin Phòng Trống"
}
```

Rules implemented:

- `center_id` required string.
- `idempotency_key` required string.
- `display_name` optional string.
- Reject forbidden client fields: `role`, `email`, `password`, `temporary_password`, `actor_user_id`, `actor_email`.
- Không tin bất kỳ quyền nào từ body.

## 5. Response contract

Success response trả `temporary_password` một lần, chỉ sau khi Auth user, membership và audit đều thành công.

Errors không trả password:

- `unauthorized`
- `forbidden_owner_required`
- `center_admin_already_exists`
- `admin_email_already_used`
- `duplicate_request_already_processed`
- `provisioning_failed`
- `provisioning_failed_audit_required`

## 6. Auth/JWT caller verification

Function giữ JWT verification ở deploy config mặc định và vẫn tự đọc `Authorization: Bearer <token>`. Service-role Supabase client gọi `auth.getUser(token)` để lấy actor user id/email. Actor source of truth là token result, không lấy từ body.

## 7. Owner guard

Owner guard query `public.center_members`:

- `center_id = body.center_id`
- `user_id = actor_user.id`
- `role = owner`
- `status = active`

Không cho `center_admin`, legacy `admin`, teacher, consultant hoặc viewer provisioning admin accounts.

## 8. Target center validation

Function query `public.centers` theo id và yêu cầu:

- center exists;
- `environment = production`;
- `status = active`;
- slug match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

Staging center bị reject bằng `center_not_production_active`.

## 9. Admin email generation

Admin email sinh từ trusted center slug:

```ts
const adminEmail = `admin.${slug}@ichess.vn`.toLowerCase()
```

Expected:

- `phongtrong` -> `admin.phongtrong@ichess.vn`
- `dreamhome` -> `admin.dreamhome@ichess.vn`

Function không nhận email từ client.

## 10. Existing admin duplicate protection

Trước khi tạo Auth user, function query active `center_admin` membership trong target center. Nếu đã có, trả `center_admin_already_exists` và không trả password. Guard này bảo vệ DreamHome vì `dreamhome_prod` đã có `admin.dreamhome@ichess.vn`.

## 11. Idempotency behavior

Function query `account_audit_logs` với:

- `action = account.provision_center_admin`
- `center_id = target center`
- `request_id = idempotency_key`

Nếu đã có audit trước đó, trả `duplicate_request_already_processed` và không hiển thị lại password.

## 12. Temporary password generation

Temporary password dùng `crypto.getRandomValues`, length 24, có chữ hoa/chữ thường/số/ký tự symbol. Không dùng `Math.random`. Password không được log và không đưa vào audit metadata/before_state/after_state.

## 13. Auth user creation

Function gọi server-side:

```text
supabase.auth.admin.createUser
```

Payload gồm email generated, temporary password, `email_confirm: true`, metadata display name, center id, role `center_admin`, created_by `provision_center_admin_account`.

Duplicate email trả `admin_email_already_used` và không trả password.

## 14. Membership insert

Sau khi Auth user tạo thành công, function insert `public.center_members`:

- `center_id`
- `user_id`
- `role = center_admin`
- `status = active`

Nếu insert membership fail, function best-effort delete Auth user, ghi failure audit nếu có thể, trả `provisioning_failed` và không trả password.

## 15. Audit log insert

Sau Auth user + membership, function insert vào `public.account_audit_logs`:

- actor user/email;
- action `account.provision_center_admin`;
- target user/email;
- center id;
- before_state `{ center_admin_exists: false }`;
- after_state `{ role: "center_admin", membership_status: "active" }`;
- reason `owner_provision_center_admin`;
- request id = idempotency key;
- metadata safe: function name, center slug, credential handoff required.

Audit không chứa plaintext password. Nếu audit fail, function rollback membership/Auth user và không trả password.

## 16. Rollback cleanup

Rollback cleanup implemented:

- delete Auth user nếu step sau fail;
- delete center_admin membership nếu audit fail;
- safe diagnostic logs chỉ chứa step/code/center_id/target_user_id;
- không log password, JWT, Authorization header hoặc service role key.

Nếu cleanup fail, response vẫn không trả password và cần manual review theo logs/code.

## 17. Logging/secrets safety

Function đọc `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` từ env/secrets server-side. Không hardcode secrets. Không expose service role ra frontend. Allowed logs chỉ là request code, center_id, error code và step name. Forbidden logs: temporary password, service role key, JWT, Authorization header, raw request body.

## 18. What C7.6D does not do

C7.6D không deploy Edge Function, không set secrets, không gọi Supabase thật, không chạy SQL, không tạo Auth user/admin/membership, không tạo `admin.phongtrong@ichess.vn`, không sửa runtime UI, không tạo Account Management UI, không sửa Module 6, không bắt đầu C7.6E, không commit/push.

## 19. C7.6E deploy/secrets/no-op QA recommendation

Nếu C7.6D PASS, C7.6E nên là deploy/secrets/no-op duplicate QA readiness:

- review function source;
- set secrets thủ công;
- deploy thủ công;
- chạy no-op DreamHome duplicate test trước;
- chỉ sau đó mới chuẩn bị controlled Phòng Trống provisioning.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu Edge Function source tồn tại, request validation strict, caller verified, owner guard enforced, production active center validated, email generated from trusted slug, duplicate/idempotency protected, password crypto random, Auth user creation/membership/audit ordered correctly, rollback implemented, password chỉ trả success, không deploy, không secrets, không live Supabase action, không runtime UI, build/diff pass và không commit/push.
