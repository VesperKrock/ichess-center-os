# C7.6G.2 - Owner guard diagnostics + service-role DB client hardening

C7.6G.2 STATUS: OWNER GUARD DIAGNOSTICS SERVICE ROLE HARDENING
C7_6G_DEPLOY_BY_USER: PASS
C7_6G_1_REDEPLOY_BY_USER: PASS
C7_6G_1_DREAMHOME_NOOP_ACTUAL_CODE: owner_guard_query_failed
OWNER_MEMBERSHIP_SQL_VERIFIED: YES
OWNER_EMAIL_VERIFIED: owner.duchai@ichess.vn
OWNER_USER_ID_VERIFIED: 9683b2c8-3970-4eac-99b3-985d503bdeb9
OWNER_DREAMHOME_ACTIVE_VERIFIED: YES
CENTER_MEMBERS_POLICY_CONTEXT_CAPTURED: YES
SERVICE_ROLE_DB_CLIENT_HARDENED: YES
USER_AUTHORIZATION_HEADER_GLOBAL_OVERRIDE_ALLOWED: NO
USER_TOKEN_USED_ONLY_FOR_AUTH_GET_USER: YES
OWNER_GUARD_SAFE_DIAGNOSTICS_IMPLEMENTED: YES
OWNER_GUARD_QUERY_ERROR_DEBUG_FIELDS: code_message_details_hint
PASSWORD_LEAK_ALLOWED: NO
TEMPORARY_PASSWORD_ERROR_RESPONSE_ALLOWED: NO
MATH_RANDOM_PASSWORD_ALLOWED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
DREAMHOME_DUPLICATE_EXPECTED_CODE_AFTER_REDEPLOY: center_admin_already_exists
EDGE_FUNCTION_REDEPLOYED_BY_CODEX: NO
SECRETS_SET_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED_IN_SUPABASE: NO
ADMIN_PHONGTRONG_CREATED: NO
RUNTIME_UI_CHANGE: NO
C7_6H_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh lỗi owner_guard_query_failed

Sau C7.6G.1, user đã redeploy và retest DreamHome no-op. Function vẫn trả HTTP 500:

```json
{"ok":false,"code":"owner_guard_query_failed","message":"Owner guard query failed."}
```

Điều này chứng minh lỗi đã được tách khỏi `forbidden_owner_required`, nhưng response vẫn thiếu diagnostics an toàn để biết PostgREST/Auth client đang fail vì nguyên nhân nào.

## 2. SQL proof owner membership exists

User đã verify exact owner guard query:

```sql
select
  user_id,
  center_id,
  role,
  status
from public.center_members
where center_id = 'dreamhome_prod'
  and user_id = '9683b2c8-3970-4eac-99b3-985d503bdeb9'
  and role = 'owner'
  and status = 'active';
```

Result đã xác nhận 1 row:

```txt
9683b2c8-3970-4eac-99b3-985d503bdeb9,dreamhome_prod,owner,active
```

## 3. Policy context for center_members

Policy context user cung cấp:

```txt
public.center_members,c4_6b members read own membership,PERMISSIVE,{authenticated},SELECT,(user_id = auth.uid()),null
public.center_members,members can view own memberships,PERMISSIVE,{authenticated},SELECT,(user_id = auth.uid()),null
```

Vì function provisioning cần privileged read/write, DB operations phải chạy bằng service role server-side. User JWT chỉ dùng để xác thực actor qua `auth.getUser(token)`, không được dùng làm global Authorization cho DB client.

## 4. Suspected cause: service-role client / Authorization header / PostgREST query

Nghi vấn chính sau C7.6G.1:

- Service-role client có thể chưa explicit giữ service-role Authorization cho PostgREST query.
- Nếu user Authorization header override DB query, RLS/policy có thể làm query fail hoặc lệch behavior.
- Function trước đó không trả `error.code/message/details/hint`, nên không đủ dữ liệu an toàn để debug.

## 5. Patch summary

Patch tối thiểu trong `supabase/functions/provision-center-admin-account/index.ts`:

- `adminClient` tạo bằng `SUPABASE_SERVICE_ROLE_KEY`.
- Thêm explicit global headers cho admin client:
  - `apikey: serviceRoleKey`
  - `Authorization: Bearer ${serviceRoleKey}`
- User Bearer token chỉ được lấy từ request rồi truyền trực tiếp vào `adminClient.auth.getUser(token)`.
- Owner guard vẫn query `center_members` bằng service-role DB client.
- Owner guard query fail trả `owner_guard_query_failed` kèm `debug` an toàn.
- Không đổi success contract, duplicate guard, create user flow, membership insert, audit insert, rollback, hay password handoff.

## 6. Safe diagnostics

Khi owner guard query fail, response có dạng:

```json
{
  "ok": false,
  "code": "owner_guard_query_failed",
  "message": "Owner guard query failed.",
  "debug": {
    "step": "owner_guard",
    "center_id": "dreamhome_prod",
    "actor_user_id": "9683b2c8-3970-4eac-99b3-985d503bdeb9",
    "actor_email": "owner.duchai@ichess.vn",
    "error_code": "...",
    "error_message": "...",
    "error_details": "...",
    "error_hint": "..."
  }
}
```

Allowed debug fields: `center_id`, `actor_user_id`, `actor_email`, `error_code`, `error_message`, `error_details`, `error_hint`.

Forbidden debug/log fields: JWT, Authorization header, service role key, temporary password, plaintext password, full request body.

## 7. Error mapping

| Tình huống | HTTP | Code |
| --- | ---: | --- |
| Thiếu/invalid token | 401 | `unauthorized` |
| Owner guard query lỗi | 500 | `owner_guard_query_failed` + safe `debug` |
| Caller không phải owner active của center | 403 | `forbidden_owner_required` |
| Owner hợp lệ + DreamHome đã có admin | 409 | `center_admin_already_exists` |

## 8. Safety preserved

- Không deploy Edge Function bởi CodeX.
- Không set Supabase secrets.
- Không gọi Supabase thật.
- Không invoke Edge Function thật.
- Không chạy SQL apply.
- Không tạo/sửa/xóa Auth user thật.
- Không tạo admin account thật.
- Không tạo `admin.phongtrong@ichess.vn`.
- Không tạo membership thật.
- Không tạo audit row thật.
- Không sửa runtime UI/Module 6.
- Không bắt đầu C7.6H.
- Không dùng `Math.random`.
- Không đưa temporary password vào error response.

## 9. Manual redeploy instruction

User tự redeploy function sau khi review patch:

```bat
npx supabase functions deploy provision-center-admin-account
```

Không dùng `--no-verify-jwt`. Không paste owner JWT, Authorization header, service role key, hoặc password vào chat/log.

## 10. Manual retest instruction

Chạy lại browser Console DreamHome no-op bằng owner access token thật.

Expected nếu owner guard và duplicate guard đều ổn:

```json
{"ok":false,"code":"center_admin_already_exists"}
```

Nếu vẫn còn `owner_guard_query_failed`, gửi riêng object `debug` trong response để soi `error_code`, `error_message`, `error_details`, `error_hint`. Không gửi token, password, Authorization header, hoặc secret.
