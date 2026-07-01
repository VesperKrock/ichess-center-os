# C7.6F - Predeploy hardening và manual no-op duplicate pack

C7.6F STATUS: PREDEPLOY HARDENING AND MANUAL NOOP DUPLICATE PACK
C7_6E_STATUS: PASS
C7_6E_PREFLIGHT_BY_USER: PASS
DREAMHOME_ADMIN_EXISTS_PREFLIGHT: YES
PHONGTRONG_ADMIN_ABSENT_PREFLIGHT: YES
ADMIN_PHONGTRONG_EMAIL_UNUSED_PREFLIGHT: YES
AUDIT_TABLE_RLS_TRUE_PREFLIGHT: YES
SOURCE_HARDENING_CHECKLIST_COMPLETED: YES
DENO_CHECK_ATTEMPTED: YES
DENO_CHECK_RESULT: NOT RUN - DENO NOT INSTALLED
MATH_RANDOM_PASSWORD_ALLOWED: NO
CRYPTO_RANDOM_PASSWORD_REQUIRED: YES
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
VERIFY_JWT_REQUIRED: YES
VERIFY_JWT_DISABLED_ALLOWED: NO
MANUAL_DEPLOY_CHECKLIST_CREATED: YES
MANUAL_DREAMHOME_NOOP_INVOCATION_TEMPLATE_CREATED: YES
DREAMHOME_EXPECTED_CODE: center_admin_already_exists
OWNER_ACCESS_TOKEN_REQUIRED_FOR_TEST: YES
SERVICE_ROLE_AS_OWNER_TEST_TOKEN_ALLOWED: NO
POST_TEST_VERIFY_CHECKLIST_CREATED: YES
PASSWORD_LEAK_EXPECTED_ROWS: 0
C7_6G_RECOMMENDED: YES
EDGE_FUNCTION_DEPLOYED: NO
SECRETS_SET_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_IN_SUPABASE: NO
ADMIN_PHONGTRONG_CREATED: NO
RUNTIME_UI_CHANGE: NO
C7_6G_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6F

C7.6F là pre-deploy hardening và manual operation pack cho Edge Function `provision-center-admin-account`. Phase này review source, chuẩn bị manual deploy/invocation checklist cho DreamHome duplicate no-op, và tạo post-test verify plan.

Không deploy, không set secrets, không gọi Supabase thật, không invoke Edge Function thật, không chạy SQL apply, không tạo Auth user/admin/membership, không tạo `admin.phongtrong@ichess.vn`, không sửa runtime UI, không bắt đầu C7.6G và không commit/push.

## 2. C7.6E preflight captured

User đã chạy C7.6E preflight và báo PASS:

- `dreamhome_prod` / DreamHome / production / active.
- `phongtrong_prod` / Phòng Trống / production / active.
- DreamHome có `admin.dreamhome@ichess.vn`.
- Phòng Trống chưa có center_admin.
- `admin.dreamhome@ichess.vn` exists.
- `admin.phongtrong@ichess.vn` does not exist.
- `account_audit_logs` rowsecurity = true.
- Chưa có `account.provision_center_admin` rows.

## 3. Source hardening checklist

Review source `supabase/functions/provision-center-admin-account/index.ts`:

- Không hardcode service role key.
- Không hardcode JWT.
- Không hardcode temporary password.
- Không dùng `Math.random`.
- Có `crypto.getRandomValues`.
- Có `Deno.serve`.
- Có OPTIONS/POST handling.
- Có CORS helper.
- Có Authorization Bearer handling.
- Có `auth.getUser(token)`.
- Không trust actor từ body.
- Reject forbidden client fields.
- Owner guard: `role = owner`, `status = active`, target center.
- Target center validation: `production`, `active`, slug regex.
- Admin email lấy từ trusted slug.
- Existing active `center_admin` duplicate guard chạy trước `createUser`.
- Idempotency check qua `account_audit_logs`.
- Password chỉ return success sau Auth user + membership + audit success.
- Audit không chứa `temporary_password`, `password`, `plaintext_password`.
- Rollback Auth user nếu membership/audit fail.
- Error response không chứa `temporary_password`.
- `console.log` không in password/JWT/service role.

Patch tối thiểu C7.6F: đổi các error message tiếng Việt trong Edge Function sang ASCII English để source sạch trước deploy. Không đổi business contract.

## 4. Deno/typecheck

Commands attempted:

```bash
deno --version
deno check supabase/functions/provision-center-admin-account/index.ts
```

Result:

```text
DENO_CHECK_RESULT: NOT RUN - DENO NOT INSTALLED
```

Không tự cài Deno trong C7.6F. Static smoke vẫn PASS.

## 5. Manual deploy checklist

Manual future command, chỉ chạy ở phase sau nếu user xác nhận:

```bash
supabase functions deploy provision-center-admin-account
```

Không chạy command này trong C7.6F.

Secrets/env checklist:

- `SUPABASE_URL` phải available trong Edge Function env.
- `SUPABASE_SERVICE_ROLE_KEY` phải available server-side.
- Không paste service role key vào repo/chat/docs.
- Không dùng service role key trong frontend/browser.
- `CORS_ALLOWED_ORIGIN` optional, deploy-time decision.

## 6. verify_jwt

- `verify_jwt` phải bật/default true.
- Không dùng `--no-verify-jwt` cho function này.
- Không set `verify_jwt = false`.

## 7. Manual DreamHome no-op invocation template

Test đầu tiên sau deploy là DreamHome duplicate no-op.

Target:

```text
center_id = dreamhome_prod
expected code = center_admin_already_exists
```

Body:

```json
{
  "center_id": "dreamhome_prod",
  "idempotency_key": "c7-6g-dreamhome-noop-YYYYMMDD-HHMMSS",
  "display_name": "Duplicate Guard Test"
}
```

Authorization phải dùng access token của owner đang active ở `dreamhome_prod`. Không dùng service_role key làm Authorization cho manual owner test. Không paste owner JWT vào chat. Không lưu JWT vào repo.

Curl template với placeholder:

```bash
curl -i --request POST "https://<PROJECT_REF>.supabase.co/functions/v1/provision-center-admin-account" \
  --header "Authorization: Bearer <OWNER_ACCESS_TOKEN>" \
  --header "Content-Type: application/json" \
  --data '{"center_id":"dreamhome_prod","idempotency_key":"c7-6g-dreamhome-noop-YYYYMMDD-HHMMSS","display_name":"Duplicate Guard Test"}'
```

Expected response:

```json
{
  "ok": false,
  "code": "center_admin_already_exists"
}
```

Response must not contain:

- `temporary_password`
- `password`

## 8. Manual post-test verify checklist

After future no-op duplicate test, user should run C7.6E post-QA verify SQL or equivalent read-only queries.

Expected after DreamHome no-op:

- DreamHome still exactly one active center_admin.
- `admin.dreamhome@ichess.vn` unchanged.
- `admin.phongtrong@ichess.vn` still does not exist.
- Phòng Trống still has no center_admin.
- No `temporary_password`/`password`/`plaintext_password` keys in `account_audit_logs`.
- If duplicate attempt audit is not implemented, no new audit row is acceptable.
- If duplicate attempt audit is implemented later, audit must contain no password keys.

## 9. C7.6G recommendation

Recommended next phase:

```text
C7.6G - Manual deploy + DreamHome no-op duplicate test
```

Only after:

- C7.6F source hardening PASS.
- Deno check PASS or explicitly not available but static smoke PASS.
- User confirms they are ready to deploy manually.

C7.6G should still not provision Phòng Trống. It only tests duplicate no-op. Actual controlled Phòng Trống admin provisioning should be C7.6H.

## 10. PASS / NEEDS REVIEW criteria

PASS nếu source hardening complete, Deno check PASS hoặc unavailable được ghi rõ, manual deploy/invocation pack complete, DreamHome no-op expected behavior clear, không deploy, không set secrets, không Supabase action, không real user/membership/admin, không runtime UI, build/diff pass và không commit/push.

NEEDS REVIEW nếu phát hiện lỗi function lớn, Deno check fail không sửa được tối thiểu, thiếu checklist owner token, hoặc có thay đổi ngoài scope.
