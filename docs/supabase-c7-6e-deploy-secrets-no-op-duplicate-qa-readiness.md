# C7.6E - Deploy/secrets/no-op duplicate QA readiness

C7.6E STATUS: DEPLOY SECRETS NO-OP DUPLICATE QA READINESS
C7_6D_STATUS: PASS
EDGE_FUNCTION_IMPLEMENTED: YES
AUDIT_TABLE_APPLIED_AND_VERIFIED: YES
SOURCE_PREFLIGHT_CHECKLIST_CREATED: YES
SECRETS_READINESS_CHECKLIST_CREATED: YES
DEPLOY_CHECKLIST_CREATED: YES
VERIFY_JWT_REQUIRED: YES
VERIFY_JWT_DISABLED_ALLOWED: NO
DREAMHOME_NO_OP_DUPLICATE_QA_PLAN_CREATED: YES
DREAMHOME_EXPECTED_CODE: center_admin_already_exists
PHONGTRONG_CONTROLLED_QA_PLAN_CREATED: YES
PHONGTRONG_EXPECTED_EMAIL: admin.phongtrong@ichess.vn
READONLY_PREFLIGHT_SQL_CREATED: YES
READONLY_POST_QA_VERIFY_SQL_CREATED: YES
ROLLBACK_MANUAL_CLEANUP_PLAN_CREATED: YES
PASSWORD_LEAK_VERIFY_QUERY_CREATED: YES
EDGE_FUNCTION_DEPLOYED: NO
SECRETS_SET_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_IN_SUPABASE: NO
ADMIN_PHONGTRONG_CREATED: NO
RUNTIME_UI_CHANGE: NO
C7_6F_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6E

C7.6E chuẩn bị checklist deploy/secrets và QA an toàn trước khi deploy/test thật Edge Function `provision-center-admin-account`. Phase này không deploy, không set secrets, không gọi Supabase thật, không invoke Edge Function, không tạo Auth user/admin/membership, không tạo `admin.phongtrong@ichess.vn`, không sửa runtime UI, không bắt đầu C7.6F và không commit/push.

## 2. Trạng thái sau C7.6D

C7.6D đã tạo source:

- `supabase/functions/provision-center-admin-account/index.ts`
- `supabase/functions/provision-center-admin-account/deno.json`

Business name: `provision_center_admin_account`. Audit table `public.account_audit_logs` đã được user apply/verify PASS ở C7.6C.1.

## 3. Source preflight checklist

Trước khi deploy thủ công ở phase sau, đọc source function và tick:

- Không hardcode service role key.
- Không hardcode JWT.
- Không hardcode temporary password.
- Không dùng `Math.random`.
- Có `crypto.getRandomValues`.
- Có Authorization/Bearer handling.
- Có `auth.getUser`.
- Có owner guard `role = owner` và `status = active`.
- Có center validation `production` và `active`.
- Có slug validation.
- Có admin email từ `center.slug`, không nhận email client.
- Có duplicate active `center_admin` guard.
- Có idempotency check `account_audit_logs`.
- Có `createUser` server-side.
- Có membership insert sau `createUser`.
- Có audit insert trước khi return password.
- Có rollback cleanup.
- Error response không trả `temporary_password`.
- Audit `metadata`/`before_state`/`after_state` không chứa password key.

## 4. Secrets readiness checklist

Checklist Supabase UI/CLI cho phase deploy tương lai:

- Edge Functions UI tồn tại.
- Secrets UI tồn tại.
- `SUPABASE_URL` cần set/available.
- `SUPABASE_SERVICE_ROLE_KEY` cần set server-side only.
- Không paste service role key vào repo/chat/docs.
- `CORS_ALLOWED_ORIGIN` là deploy-time decision.
- `verify_jwt` phải enabled/không tắt.
- Function name đúng: `provision-center-admin-account`.

## 5. Deploy checklist

Manual future command nếu user duyệt ở phase sau:

```bash
supabase functions deploy provision-center-admin-account
```

Không chạy command này trong C7.6E. Không deploy bằng Dashboard/CLI trong C7.6E. Không invoke function trong C7.6E.

## 6. verify_jwt requirement

`verify_jwt` phải bật. Không set `verify_jwt = false`. Function vẫn tự extract Authorization Bearer token để lấy actor user, nhưng gateway-level JWT verification không được tắt nếu không có phase security review riêng.

## 7. DreamHome no-op duplicate QA

Test đầu tiên sau deploy phải là DreamHome duplicate no-op, không phải Phòng Trống.

Target:

```text
center_id = dreamhome_prod
expected existing admin = admin.dreamhome@ichess.vn
```

Expected response:

```json
{
  "ok": false,
  "code": "center_admin_already_exists"
}
```

Expected database after test:

- Không tạo Auth user mới.
- Không tạo membership mới.
- Không trả `temporary_password`.
- Không đổi `admin.dreamhome@ichess.vn`.
- Có thể có audit row duplicate attempt nếu function sau này ghi audit cho attempt; C7.6D hiện trả duplicate trước audit success nên current behavior là no-op không tạo audit row duplicate.

C7.6E chỉ chuẩn bị plan, không test thật.

## 8. Phòng Trống controlled QA

Chỉ sau khi no-op DreamHome PASS mới test Phòng Trống.

Target:

```text
center_id = phongtrong_prod
expected email = admin.phongtrong@ichess.vn
```

Expected success sau này:

```json
{
  "ok": true,
  "code": "center_admin_created",
  "center_id": "phongtrong_prod",
  "email": "admin.phongtrong@ichess.vn",
  "temporary_password": "...",
  "password_display_once": true,
  "credential_handoff_required": true,
  "audit_id": "uuid"
}
```

Expected database:

- Auth user `admin.phongtrong@ichess.vn` exists.
- `center_members` has role `center_admin`/status `active` for `phongtrong_prod`.
- `account_audit_logs` has action `account.provision_center_admin`.
- Audit row contains no password keys.
- Owner can still access Internal Console.
- New admin can login later and sees only Phòng Trống.

C7.6E không tạo user.

## 9. Read-only SQL packs

Preflight SQL:

```text
docs/supabase-c7-6e-readonly-preflight-admin-provisioning-qa.sql
```

Post-QA verify SQL:

```text
docs/supabase-c7-6e-readonly-post-qa-admin-provisioning-verify.sql
```

Cả hai file read-only, không modify data, không tạo Auth user, không tạo membership và không invoke Edge Function.

## 10. Password leak verify

Post-QA SQL có query kiểm tra password leak trong `public.account_audit_logs`:

- `metadata ? 'temporary_password'`
- `metadata ? 'password'`
- `metadata ? 'plaintext_password'`
- `before_state ? ...`
- `after_state ? ...`

Expected password leak query: 0 rows.

## 11. Rollback/manual cleanup plan

Case A - Auth user created but membership missing:

- Do not reuse password.
- Disable/delete pending Auth user manually only after inspection.
- Check audit row.
- Rerun with new `idempotency_key` only after cleanup.

Case B - membership created but audit missing:

- Treat as failed unsafe state.
- Remove/revoke membership after inspection.
- Delete/disable Auth user if no login/use.
- Do not show/reuse password.

Case C - audit created but password not displayed:

- Do not attempt to recover password.
- Use reset password flow later.

C7.6E không chứa destructive SQL; chỉ docs.

## 12. What C7.6E does not do

C7.6E không commit, không push, không deploy Edge Function, không set Supabase secrets, không gọi Supabase thật, không invoke Edge Function, không chạy SQL apply, không tạo/sửa/xóa Auth user thật, không tạo `admin.phongtrong@ichess.vn`, không tạo membership, không tạo audit row thật, không sửa runtime UI và không bắt đầu C7.6F.

## 13. C7.6F recommendation

Nếu C7.6E PASS, user chạy read-only preflight SQL và review source/secrets checklist. Sau đó C7.6F nên là deploy/secrets + DreamHome no-op duplicate test readiness/controlled execution phase, vẫn chưa provisioning Phòng Trống cho đến khi DreamHome duplicate no-op PASS.

## 14. PASS / NEEDS REVIEW criteria

PASS nếu docs/test/SQL readiness đầy đủ, có source preflight, secrets/deploy checklist, DreamHome no-op duplicate QA, Phòng Trống controlled QA, rollback/manual cleanup, password leak verify, không deploy, không set secrets, không gọi Supabase, không tạo admin/user/membership, không sửa runtime UI, build/diff pass và không commit/push.

NEEDS REVIEW nếu phát hiện bug thật trong C7.6D function source, thiếu safety checklist, SQL không read-only, hoặc có thay đổi ngoài docs/test/read-only SQL.
