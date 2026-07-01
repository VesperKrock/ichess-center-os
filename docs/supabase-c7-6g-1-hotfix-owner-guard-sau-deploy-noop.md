# C7.6G.1 - Hotfix owner guard sau deploy no-op

C7.6G.1 STATUS: HOTFIX OWNER GUARD AFTER DEPLOY NOOP TEST
C7_6G_DEPLOY_BY_USER: PASS
C7_6G_DREAMHOME_NOOP_ACTUAL_CODE_BEFORE_FIX: owner_guard_failed
OWNER_MEMBERSHIP_SQL_VERIFIED: YES
OWNER_EMAIL_VERIFIED: owner.duchai@ichess.vn
OWNER_USER_ID_VERIFIED: 9683b2c8-3970-4eac-99b3-985d503bdeb9
OWNER_DREAMHOME_ACTIVE_VERIFIED: YES
OWNER_PHONGTRONG_ACTIVE_VERIFIED: YES
OWNER_GUARD_PATCHED: YES
OWNER_GUARD_USES_MAYBE_SINGLE: YES
OWNER_GUARD_QUERY_ERROR_CODE: owner_guard_query_failed
OWNER_GUARD_FORBIDDEN_CODE: forbidden_owner_required
DREAMHOME_DUPLICATE_EXPECTED_CODE_AFTER_REDEPLOY: center_admin_already_exists
PASSWORD_LEAK_ALLOWED: NO
TEMPORARY_PASSWORD_ERROR_RESPONSE_ALLOWED: NO
MATH_RANDOM_PASSWORD_ALLOWED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
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

## 1. Bối cảnh deploy/test thật

Sau C7.6F, user đã deploy Edge Function `provision-center-admin-account` thành công và chạy test no-op duplicate cho `dreamhome_prod` bằng owner token thật.

Kỳ vọng của test DreamHome là function đi qua owner guard, phát hiện cơ sở đã có admin active, rồi trả `center_admin_already_exists` mà không tạo Auth user, membership, hay audit row mới cho provisioning.

## 2. Actual response owner_guard_failed

Kết quả trước hotfix: request bằng owner token thật trả HTTP 500 với body:

```json
{"ok":false,"code":"owner_guard_failed"}
```

Mã lỗi này quá mơ hồ vì nó gom lỗi query owner guard và làm che mất nguyên nhân thật. Với dữ liệu đã xác nhận owner hợp lệ, behavior này cần được tách rõ thành lỗi query hoặc forbidden.

## 3. SQL proof owner.duchai is active owner

User đã xác nhận bằng SQL read-only:

- Owner email: `owner.duchai@ichess.vn`.
- Owner user id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`.
- Owner active của `dreamhome_prod`: YES.
- Owner active của `phongtrong_prod`: YES.
- `admin.dreamhome@ichess.vn` đã tồn tại.
- `admin.phongtrong@ichess.vn` chưa tồn tại và không được tạo trong C7.6G.1.

## 4. Root cause candidates

Các khả năng cần soi sau deploy:

- Query owner guard gặp schema/permission/RLS/constraint issue và bị map chung thành `owner_guard_failed`.
- `.select('id')` có thể không phù hợp nếu bảng membership không có cột `id` trong môi trường thật hoặc view/shape khác với assumption.
- Function không log đủ diagnostics an toàn để phân biệt PostgREST query error với caller không có membership owner.
- Nếu caller thật sự không phải owner active, response phải là 403 `forbidden_owner_required`, không phải 500.

## 5. Patch summary

Patch tối thiểu trong `supabase/functions/provision-center-admin-account/index.ts`:

- Owner guard vẫn dùng `adminClient` tạo bằng `SUPABASE_SERVICE_ROLE_KEY`.
- Query `center_members` đổi select sang các cột business đã cần xác minh: `user_id, center_id, role, status`.
- Query vẫn lọc `center_id`, `user_id`, `role = owner`, `status = active`.
- Query vẫn dùng `.maybeSingle()`.
- Query error trả HTTP 500 `owner_guard_query_failed`.
- Không có membership owner trả HTTP 403 `forbidden_owner_required`.
- Diagnostic log chỉ chứa `center_id`, `actor_user_id`, `actor_email`, `error_code`; không log token, service role key, JWT, hay password.

## 6. Owner guard behavior sau patch

Flow sau patch:

1. Function lấy Bearer token từ request.
2. Function verify caller bằng `adminClient.auth.getUser(token)`.
3. Function dùng service-role `adminClient` query `center_members`.
4. Nếu query lỗi: trả `owner_guard_query_failed`.
5. Nếu query thành công nhưng không có owner membership active: trả `forbidden_owner_required`.
6. Nếu owner hợp lệ: tiếp tục center validation và duplicate admin guard.

## 7. Error code mapping

| Tình huống | HTTP | Code |
| --- | ---: | --- |
| Thiếu/invalid token | 401 | `unauthorized` |
| Owner guard query lỗi | 500 | `owner_guard_query_failed` |
| Caller không phải owner active của center | 403 | `forbidden_owner_required` |
| Center đã có admin active | 409 | `center_admin_already_exists` |

## 8. Safety preserved

- Không deploy lại function bởi CodeX.
- Không set secrets bởi CodeX.
- Không gọi Supabase thật.
- Không tạo Auth user.
- Không tạo admin account thật.
- Không tạo membership.
- Không tạo `admin.phongtrong@ichess.vn`.
- Không sửa runtime UI/Module 6.
- Không dùng `Math.random`; password generation vẫn dùng `crypto.getRandomValues`.
- Error response không trả temporary password.
- Log không chứa plaintext password, JWT, access token, service role key, hay secret.

## 9. Manual redeploy instruction for user

Sau khi review patch, user tự redeploy function bằng Supabase CLI:

```bash
npx supabase functions deploy provision-center-admin-account
```

Không dùng `--no-verify-jwt`. Không paste owner JWT hoặc service role key vào chat/log.

## 10. Manual retest DreamHome no-op instruction

Sau redeploy, user chạy lại browser Console fetch cho `dreamhome_prod` bằng access token owner thật.

Expected result sau hotfix:

```json
{"ok":false,"code":"center_admin_already_exists"}
```

Nếu vẫn lỗi:

- `owner_guard_query_failed`: soi Edge Function logs để lấy `error_code` an toàn, không paste token/password/secret.
- `forbidden_owner_required`: verify token đang dùng đúng user `owner.duchai@ichess.vn` và membership owner active cho đúng `center_id`.

## 11. Post-test verify SQL reminder

Sau test DreamHome no-op, user chạy lại verify read-only để chắc chắn:

- Không có Auth user mới ngoài dữ liệu đã có.
- Không tạo `admin.phongtrong@ichess.vn`.
- Không tạo membership mới cho `phongtrong_prod`.
- DreamHome vẫn chỉ có admin existing.
- Không có plaintext password trong audit/log data.

## 12. C7.6G.2 follow-up

Sau redeploy C7.6G.1, DreamHome no-op vẫn trả `owner_guard_query_failed`. C7.6G.2 harden service-role DB client để không bị user Authorization header override và thêm safe diagnostics `error_code`, `error_message`, `error_details`, `error_hint` cho owner guard query fail.
