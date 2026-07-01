# C7.6I - Reset mat khau tam admin va handoff tien loi

C7.6I STATUS: RESET TEMP ADMIN PASSWORD AND HANDOFF UX PACK
C7_6H_PROVISION_PASS: YES
C7_6H_LOGIN_SMOKE_PASS: YES
PHONGTRONG_ADMIN_EMAIL: admin.phongtrong@ichess.vn
PHONGTRONG_ADMIN_USER_ID: e4582453-8373-4c31-947c-d49eb879b027
TEMPORARY_PASSWORD_EXPOSED_IN_SCREENSHOT: YES
RESET_EDGE_FUNCTION_CREATED: YES
RESET_EDGE_FUNCTION_NAME: reset-center-admin-password
RESET_BUSINESS_NAME: reset_center_admin_password
RESET_AUDIT_ACTION: account.reset_center_admin_password
VERIFY_JWT_REQUIRED: YES
VERIFY_JWT_DISABLED_ALLOWED: NO
SERVICE_ROLE_SERVER_SIDE_ONLY: YES
USER_TOKEN_USED_ONLY_FOR_AUTH_GET_USER: YES
OWNER_GUARD_IMPLEMENTED: YES
TARGET_ADMIN_VALIDATION_IMPLEMENTED: YES
TEMPORARY_PASSWORD_CRYPTO_RANDOM: YES
MATH_RANDOM_PASSWORD_ALLOWED: NO
AUTH_ADMIN_UPDATE_PASSWORD_IMPLEMENTED: YES
RESET_AUDIT_LOG_INSERT_IMPLEMENTED: YES
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO
TEMPORARY_PASSWORD_ERROR_RESPONSE_ALLOWED: NO
SUCCESS_RETURNS_PASSWORD_ONCE: YES
HANDOFF_UX_CONTRACT_CREATED: YES
OWNER_CAN_CREATE_RESET_KEYS: YES
PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO
BROWSER_CONSOLE_RESET_SCRIPT_CREATED: YES
POST_RESET_VERIFY_SQL_CREATED: YES
EDGE_FUNCTION_DEPLOYED_BY_CODEX: NO
EDGE_FUNCTION_INVOKED_BY_CODEX: NO
PASSWORD_RESET_BY_CODEX: NO
AUTH_USER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
RUNTIME_UI_CHANGE: NO
C7_6J_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.6H PASS

C7.6H đã tạo và login smoke thành công cho `admin.phongtrong@ichess.vn`.

Kết quả thật đã xác nhận:

- `center_id`: `phongtrong_prod`
- `email`: `admin.phongtrong@ichess.vn`
- `user_id`: `e4582453-8373-4c31-947c-d49eb879b027`
- `role`: `center_admin`
- `status`: `active`
- Login smoke PASS, thấy cơ sở Phòng Trống, không thấy Internal Center Console.
- Audit `account.provision_center_admin` đã có và password leak query = 0 rows.

## 2. Vì sao cần rotate exposed password

Temporary password ban đầu đã xuất hiện trong screenshot/chat. Password đó không nên dùng để bàn giao thật.

Nguyên tắc: nếu password tạm bị lộ, bị mất, hoặc user quên, owner tạo password tạm mới. Hệ thống không truy xuất lại password cũ và không lưu plaintext password lâu dài.

## 3. Product principle: anh Hải quản lý chìa bằng create/reset

Anh Hải là chủ hệ thống và cần thao tác đơn giản:

- Có quyền cấp chìa cho admin cơ sở.
- Có quyền reset/tạo mật khẩu tạm mới cho admin cơ sở.
- Có thể copy email/password một lần để handoff.
- Không cần dùng Supabase, SQL, CLI, hoặc code.

Hệ thống tối ưu sự tiện dụng cho anh Hải nhưng không lưu plaintext password lâu dài. Muốn biết/đổi chìa thì tạo chìa mới.

## 4. Function reset-center-admin-password

Function mới:

```txt
deploy name: reset-center-admin-password
business name: reset_center_admin_password
audit action: account.reset_center_admin_password
```

Function được tạo trong repo, nhưng C7.6I không deploy và không invoke.

## 5. Request contract

POST JSON:

```json
{
  "center_id": "phongtrong_prod",
  "target_email": "admin.phongtrong@ichess.vn",
  "idempotency_key": "uuid-or-client-generated-string",
  "reason": "rotate_exposed_temporary_password"
}
```

Rules:

- `center_id`, `target_email`, `idempotency_key` required.
- `reason` optional.
- Không nhận password từ client.
- Không nhận temporary password từ client.
- Không nhận role từ client.
- Không nhận actor user/email từ client.
- Không trust quyền nào từ body.

Forbidden client fields: `password`, `temporary_password`, `new_password`, `role`, `actor_user_id`, `actor_email`, `service_role`, `jwt`, `authorization`.

## 6. Response contract

Success:

```json
{
  "ok": true,
  "code": "center_admin_password_reset",
  "center_id": "phongtrong_prod",
  "email": "admin.phongtrong@ichess.vn",
  "temporary_password": "...",
  "password_display_once": true,
  "credential_handoff_required": true,
  "audit_id": "uuid"
}
```

Errors include `unauthorized`, `forbidden_owner_required`, `target_center_admin_not_found`, `duplicate_request_already_processed`, `password_reset_failed`, and `password_reset_audit_failed_manual_reset_required`.

No error response may contain `temporary_password`, `password`, or `new_password`.

## 7. Owner guard

Caller verification:

1. Extract Authorization Bearer token.
2. Use `adminClient.auth.getUser(token)`.
3. Actor source of truth is returned user id/email.
4. Body actor fields are rejected.

Owner guard queries `public.center_members`:

- `center_id = body.center_id`
- `user_id = actor_user.id`
- `role = owner`
- `status = active`
- `.maybeSingle()`

Query error returns `owner_guard_query_failed` with safe debug fields only.

## 8. Target admin validation

Function validates:

- Center exists, production, active, valid slug.
- Center has exactly one active `center_admin` membership.
- Auth Admin `getUserById` resolves that membership user.
- Returned user email lowercased equals `target_email`.

Mismatch returns `target_center_admin_not_found`. Multiple active admins return `center_admin_state_invalid`.

## 9. Password generation

Temporary password is generated server-side using `crypto.getRandomValues`, length 24, with upper/lower/digit/symbol seeded into the first positions.

`Math.random` is forbidden.

## 10. Auth password update

Function calls server-side Auth Admin:

```txt
auth.admin.updateUserById(target_user_id, { password: temporaryPassword, email_confirm: true })
```

If reset fails, response is `password_reset_failed` and no password is returned.

## 11. Audit log

After Auth password update succeeds and before returning password, function inserts `public.account_audit_logs`:

- `actor_user_id`
- `actor_email`
- `action = account.reset_center_admin_password`
- `target_type = user`
- `target_user_id`
- `target_email`
- `center_id`
- `before_state = {"password_exposed_or_reset_requested": true}`
- `after_state = {"password_reset": true, "credential_handoff_required": true}`
- `reason`
- `request_id`
- `metadata.function = reset_center_admin_password`

Audit does not store `temporary_password`, plaintext password, or new password.

If audit insert fails after Auth password was updated, function returns `password_reset_audit_failed_manual_reset_required` and does not return the temporary password. Operator should fix audit and run reset again; do not hand off unaudited credentials.

## 12. Failure modes

- Missing/invalid token: `unauthorized`.
- Non-owner: `forbidden_owner_required`.
- Target admin missing/mismatch: `target_center_admin_not_found`.
- Multiple active center admins: `center_admin_state_invalid`.
- Duplicate idempotency: `duplicate_request_already_processed`.
- Auth update failure: `password_reset_failed`.
- Audit failure after Auth update: `password_reset_audit_failed_manual_reset_required`.

No failure mode returns password.

## 13. Credential handoff UX contract

Future UI for anh Hải should show one compact card after create/reset success:

```txt
Đã tạo/cập nhật tài khoản admin cơ sở

Cơ sở: Phòng Trống
Tài khoản: admin.phongtrong@ichess.vn
Mật khẩu tạm: [hiện rõ]
Ghi chú: Mật khẩu này chỉ hiện trong lần này.

Buttons:
- Copy email
- Copy mật khẩu
- Copy toàn bộ thông tin đăng nhập
- Tôi đã lưu
```

Copy toàn bộ format:

```txt
Tài khoản quản lý cơ sở Phòng Trống
Email: admin.phongtrong@ichess.vn
Mật khẩu tạm: <temporary_password>
Link đăng nhập: <app link>
```

Reset action:

- Button: `Tạo mật khẩu tạm mới`
- Confirm: user đang tạo mật khẩu tạm mới cho admin cơ sở này; mật khẩu cũ sẽ không dùng được.
- After success: show new handoff card.

## 14. Browser Console reset script

Manual reset script template:

```txt
docs/supabase-c7-6i-browser-console-reset-phongtrong-admin-password.js
```

Script is for C7.6J manual deploy/reset, not for C7.6I execution.

## 15. Post-reset verify SQL

Read-only verify SQL:

```txt
docs/supabase-c7-6i-readonly-post-reset-verify-phongtrong-admin.sql
```

Expected after C7.6J reset:

- `admin.phongtrong@ichess.vn` still exists.
- Membership still active `center_admin` for `phongtrong_prod`.
- Audit row `account.reset_center_admin_password` exists.
- Password leak query returns 0 rows.

## 16. C7.6J deploy/reset recommendation

If C7.6I PASS, next phase can deploy `reset-center-admin-password`, run controlled reset for `admin.phongtrong@ichess.vn`, privately copy the new temporary password, and run post-reset verify SQL.

## 17. What C7.6I does not do

C7.6I does not:

- Deploy Edge Function.
- Invoke Edge Function.
- Reset password thật.
- Create Auth user.
- Create membership.
- Mutate SQL data.
- Change runtime UI.
- Start C7.6J.
- Commit or push.
