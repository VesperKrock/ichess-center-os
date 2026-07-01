# C7.7B - Revoke / disable admin access pack

C7.7B STATUS: REVOKE DISABLE ADMIN ACCESS PACK
C7_7A_RESET_PASSWORD_PASS: YES
PHONGTRONG_ADMIN_EMAIL: admin.phongtrong@ichess.vn
REVOKE_EDGE_FUNCTION_CREATED: YES
REVOKE_EDGE_FUNCTION_NAME: revoke-center-admin-access
REVOKE_BUSINESS_NAME: revoke_center_admin_access
REVOKE_AUDIT_ACTION: account.revoke_center_admin_access
VERIFY_JWT_REQUIRED: YES
VERIFY_JWT_DISABLED_ALLOWED: NO
SERVICE_ROLE_SERVER_SIDE_ONLY: YES
USER_TOKEN_USED_ONLY_FOR_AUTH_GET_USER: YES
OWNER_GUARD_IMPLEMENTED: YES
TARGET_ADMIN_VALIDATION_IMPLEMENTED: YES
MEMBERSHIP_REVOKE_STATUS: revoked
HARD_DELETE_MEMBERSHIP_ALLOWED: NO
AUTH_DISABLE_OPTION_DOCUMENTED: YES
CENTER_MEMBERS_UPDATE_GRANT_NEEDED: YES
GRANT_APPLIED_BY_CODEX: NO
REVOKE_AUDIT_LOG_INSERT_IMPLEMENTED: YES
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO
BROWSER_CONSOLE_REVOKE_SCRIPT_CREATED: YES
BROWSER_CONSOLE_REVOKE_SCRIPT_DO_NOT_RUN_IN_C7_7B: YES
POST_REVOKE_VERIFY_SQL_CREATED: YES
EDGE_FUNCTION_DEPLOYED_BY_CODEX: NO
EDGE_FUNCTION_INVOKED_BY_CODEX: NO
ACCESS_REVOKED_BY_CODEX: NO
AUTH_USER_DISABLED_BY_CODEX: NO
RUNTIME_UI_CHANGE: NO
C7_7C_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.7A PASS

C7.6 đã tạo admin cơ sở thật cho Phòng Trống. C7.7A đã reset/rotate password admin thành công. C7.7B chuẩn bị phần thu hồi/khóa quyền nhưng chưa thao tác thật.

Admin hiện có:

```txt
center_id: phongtrong_prod
email: admin.phongtrong@ichess.vn
user_id: e4582453-8373-4c31-947c-d49eb879b027
role: center_admin
status: active
```

## 2. Product principle: anh Hải thu hồi chìa

Anh Hải cần thao tác đơn giản:

- Cấp chìa.
- Đổi chìa.
- Thu hồi chìa.
- Khóa tài khoản khi cần.

Default an toàn là revoke membership bằng trạng thái `revoked`, không xóa user/membership cứng. Auth user disable là option được document và defer để tránh khóa tài khoản thật ngoài kế hoạch.

## 3. Scope C7.7B

C7.7B tạo implementation pack:

- Edge Function source `revoke-center-admin-access`.
- Browser Console script template cho phase sau.
- Read-only post-revoke verify SQL.
- Smoke test static.

C7.7B không deploy, không invoke, không revoke/disable thật, không chạy SQL mutate.

## 4. Function revoke-center-admin-access

Function:

```txt
deploy name: revoke-center-admin-access
business name: revoke_center_admin_access
audit action: account.revoke_center_admin_access
```

Function dùng service role server-side, user JWT chỉ dùng cho `auth.getUser(token)`.

## 5. Request contract

POST JSON:

```json
{
  "center_id": "phongtrong_prod",
  "target_email": "admin.phongtrong@ichess.vn",
  "idempotency_key": "uuid-or-client-generated-string",
  "reason": "admin_left_center",
  "disable_auth_user": false
}
```

Rules:

- `center_id`, `target_email`, `idempotency_key` required.
- `reason` optional.
- `disable_auth_user` optional boolean, default false.
- Không nhận role/actor/password/token/service_role từ client.

Forbidden fields: `password`, `temporary_password`, `new_password`, `role`, `actor_user_id`, `actor_email`, `service_role`, `jwt`, `authorization`.

## 6. Response contract

Success revoke membership only:

```json
{
  "ok": true,
  "code": "center_admin_access_revoked",
  "center_id": "phongtrong_prod",
  "email": "admin.phongtrong@ichess.vn",
  "membership_status": "revoked",
  "auth_user_disabled": false,
  "audit_id": "uuid"
}
```

Known errors:

- `unauthorized`
- `forbidden_owner_required`
- `target_center_admin_not_found`
- `center_admin_already_revoked`
- `duplicate_request_already_processed`
- `center_admin_state_invalid`
- `membership_revoke_failed`
- `revoke_audit_failed_manual_review_required`
- `auth_disable_not_implemented`

No response contains password/secret/JWT.

## 7. Owner guard

Caller verification:

1. Extract Authorization Bearer token.
2. Verify with `auth.getUser(token)`.
3. Actor id/email comes from verified user.
4. Body actor fields are rejected.

Owner guard queries `center_members`:

- `center_id = body.center_id`
- `user_id = actor_user.id`
- `role = owner`
- `status = active`

Missing owner returns `forbidden_owner_required`.

## 8. Target admin validation

Function validates:

- Target center exists.
- Center is production active.
- Slug is valid.
- Target email matches an active `center_admin` membership for the center via Auth Admin `getUserById`.
- Multiple matching active admins return `center_admin_state_invalid`.
- If no active match but revoked match exists, return `center_admin_already_revoked`.
- If no match, return `target_center_admin_not_found`.

## 9. Revoke membership flow

Default revoke:

```txt
public.center_members.status: active -> revoked
```

No hard delete. No Auth user deletion. No membership deletion.

If audit fails after membership is revoked, function returns `revoke_audit_failed_manual_review_required` and operator must inspect membership/audit state before continuing.

## 10. Auth user disable option / deferred decision

Request supports `disable_auth_user`, but C7.7B implementation intentionally returns `auth_disable_not_implemented` when `disable_auth_user = true`.

Reason: disabling Auth user is more destructive than membership revoke and should be verified in a separate controlled phase after deciding exact Supabase Auth Admin ban/disable behavior.

## 11. Audit log

Audit row:

- `actor_user_id`
- `actor_email`
- `action = account.revoke_center_admin_access`
- `target_type = user`
- `target_user_id`
- `target_email`
- `center_id`
- `before_state = {"membership_status":"active","role":"center_admin"}`
- `after_state = {"membership_status":"revoked","auth_user_disabled": false}`
- `reason`
- `request_id`
- `metadata.function = revoke_center_admin_access`
- `metadata.disable_auth_user_requested = false`

No password keys in audit.

## 12. Service-role grant needed

C7.6G.3 grants currently covered:

- `centers`: SELECT
- `center_members`: SELECT, INSERT, DELETE
- `account_audit_logs`: SELECT, INSERT

C7.7B revoke requires:

```sql
grant update on table public.center_members to service_role;
```

C7.7B does not apply SQL. C7.7C or a deploy/readiness phase must verify/apply this grant before a live revoke test.

## 13. Browser Console script warning

Script created:

```txt
docs/supabase-c7-7b-browser-console-revoke-phongtrong-admin-access.js
```

DO NOT RUN IN C7.7B.

Không chạy script này nếu chưa muốn khóa admin.phongtrong thật.

## 14. Post-revoke verify SQL

Read-only verify SQL:

```txt
docs/supabase-c7-7b-readonly-post-revoke-verify-phongtrong-admin.sql
```

Checks:

- `center_members` status for `admin.phongtrong@ichess.vn`.
- No active center_admin for `phongtrong_prod` if revoke was intended.
- Auth user still exists.
- Audit row exists.
- Password leak query returns 0 rows.

## 15. Failure modes

- Owner guard query error: `owner_guard_query_failed`.
- Non-owner caller: `forbidden_owner_required`.
- Target missing: `target_center_admin_not_found`.
- Already revoked: `center_admin_already_revoked`.
- Multiple active matching admins: `center_admin_state_invalid`.
- Duplicate idempotency: `duplicate_request_already_processed`.
- Revoke update failure: `membership_revoke_failed`.
- Audit failure after revoke: `revoke_audit_failed_manual_review_required`.

## 16. What C7.7B does not do

C7.7B does not:

- Deploy Edge Function.
- Invoke Edge Function.
- Revoke access thật.
- Disable Auth user thật.
- Apply grants.
- Run SQL mutate.
- Change runtime UI.
- Start C7.7C.
- Commit/push.

## 17. C7.7C deploy/revoke controlled test recommendation

If C7.7B PASS, next phase should prepare controlled deploy/test readiness:

- Verify/apply `center_members UPDATE` grant for `service_role`.
- Deploy `revoke-center-admin-access`.
- Decide whether to test on a disposable/admin account or postpone real Phòng Trống revoke.
- Run post-revoke verify SQL only after intentional live test.
