# C7.8F - Controlled live revoke/restore Phong Trong

C7.8F STATUS: CONTROLLED LIVE REVOKE RESTORE PACK
C7.8F MANUAL LIVE STATUS: PASS
C7_8F_MANUAL_LIVE_REVOKE_PASS: YES
C7_8F_MANUAL_LIVE_RESTORE_PASS: YES
TARGET_CENTER_ID: phongtrong_prod
TARGET_ADMIN_EMAIL: admin.phongtrong@ichess.vn
DREAMHOME_PROTECTED: YES
REVOKE_FUNCTION_REVIEWED: YES
RESTORE_FUNCTION_ADDED_OR_CONFIRMED: YES
SERVICE_ROLE_UPDATE_GRANT_SQL_CREATED: YES
PREFLIGHT_SQL_CREATED: YES
POST_REVOKE_VERIFY_SQL_CREATED: YES
POST_RESTORE_VERIFY_SQL_CREATED: YES
BROWSER_REVOKE_SCRIPT_CREATED: YES
BROWSER_RESTORE_SCRIPT_CREATED: YES
DISABLE_AUTH_USER_ALLOWED: NO
HARD_DELETE_ALLOWED: NO
PASSWORD_OR_SECRET_INCLUDED: NO
UI_LIVE_REVOKE_FLAG_ENABLED: NO
CODEX_APPLIED_SQL: NO
CODEX_DEPLOYED_FUNCTIONS: NO
CODEX_INVOKED_REVOKE: NO
CODEX_INVOKED_RESTORE: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh

C7.8E và C7.8E.1 đã chuẩn bị UI revoke với safety gate OFF. C7.8F là pack để owner tự live-test revoke/restore có kiểm soát sau khi review, không phải bước CodeX tự chạy live.

Manual live result sau khi user thực hiện:

- Revoke `phongtrong_prod` / `admin.phongtrong@ichess.vn`: HTTP 200, `center_admin_access_revoked`, audit id `e5c490ee-7b2f-4796-8cdb-aa79f9d4c31a`.
- Restore `phongtrong_prod` / `admin.phongtrong@ichess.vn`: HTTP 200, `center_admin_access_restored`, audit id `0b71cf98-e77c-411b-8102-d383d89baa3e`.
- Auth user vẫn tồn tại, `auth_user_disabled: false`.
- DreamHome admin vẫn active.
- One-center admin violation: no rows.

## 2. Target controlled test

Target duy nhất:

- Center: `phongtrong_prod`
- Center name: `Phòng Trống`
- Admin: `admin.phongtrong@ichess.vn`

Không đụng DreamHome:

- `dreamhome_prod`
- `admin.dreamhome@ichess.vn`

## 3. Revoke vs reset vs ban terminology

- Reset password: thay ổ khóa/thay mã số.
- Revoke access: rút chìa khóa khỏi một cơ sở, membership `active -> revoked`.
- Restore access: trả lại chìa khóa, membership `revoked -> active`.
- Ban/disable: khóa tài khoản phạm vi rộng hơn.

C7.8F không hard delete, không xóa Auth user, không disable Auth user.

## 4. Safety boundaries

CodeX chỉ tạo source/docs/scripts. CodeX không apply SQL, không deploy Edge Function, không invoke revoke/restore live, không commit/push.

UI live flag vẫn OFF: `ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = false`.

## 5. Files created

- `supabase/functions/restore-center-admin-access/index.ts`
- `supabase/functions/restore-center-admin-access/deno.json`
- `docs/supabase-c7-8f-manual-apply-service-role-update-grant.sql`
- `docs/supabase-c7-8f-readonly-preflight-phongtrong-revoke.sql`
- `docs/supabase-c7-8f-browser-invoke-revoke-phongtrong.js`
- `docs/supabase-c7-8f-readonly-post-revoke-verify.sql`
- `docs/supabase-c7-8f-browser-invoke-restore-phongtrong.js`
- `docs/supabase-c7-8f-readonly-post-restore-verify.sql`
- `tests/supabase-c7-8f-controlled-live-revoke-restore-phongtrong-smoke.js`

`supabase/config.toml` also adds `restore-center-admin-access` with `verify_jwt = true`.

## 6. Step-by-step runbook

Step 0: confirm git dirty is expected from C7.8E/E.1/F, and review all files.

Step 1: manually apply grant SQL in Supabase SQL editor:

`docs/supabase-c7-8f-manual-apply-service-role-update-grant.sql`

Run only in project `zahcfnpaprbnuqpegdmo` / iChess. Review before running.

Step 2: deploy revoke function manually:

```bash
npx supabase functions deploy revoke-center-admin-access
```

Step 3: deploy restore function manually:

```bash
npx supabase functions deploy restore-center-admin-access
```

Step 4: run readonly preflight SQL:

`docs/supabase-c7-8f-readonly-preflight-phongtrong-revoke.sql`

Expected: Phòng Trống exists, production active, `admin.phongtrong@ichess.vn` has active `center_admin` membership, owner membership exists.

Step 5: invoke revoke manually from browser console while logged in as owner:

`docs/supabase-c7-8f-browser-invoke-revoke-phongtrong.js`

Step 6: run post-revoke verify SQL:

`docs/supabase-c7-8f-readonly-post-revoke-verify.sql`

Expected: Phòng Trống admin membership is `revoked`, Auth user still exists, DreamHome admin remains active, audit row exists, no password leak.

Step 7: invoke restore manually from browser console while logged in as owner:

`docs/supabase-c7-8f-browser-invoke-restore-phongtrong.js`

Step 8: run post-restore verify SQL:

`docs/supabase-c7-8f-readonly-post-restore-verify.sql`

Expected: Phòng Trống admin membership returns to `active`, Auth user still exists, DreamHome admin remains active, restore audit row exists.

Step 9: reload Internal Center Console and confirm Phòng Trống account status is active again.

## 7. Rollback

Prefer restore function first. If revoke succeeds and restore function fails, emergency manual restore may be used only after confirming target row:

```sql
update public.center_members
set status = 'active'
where center_id = 'phongtrong_prod'
  and role = 'center_admin'
  and status = 'revoked'
  and user_id = (
    select id
    from auth.users
    where lower(email) = 'admin.phongtrong@ichess.vn'
    limit 1
  );
```

Run verification SQL immediately after emergency restore. Do not touch DreamHome.

## 8. What C7.8F does not do

C7.8F does not enable UI live revoke flag, does not revoke DreamHome, does not disable Auth users, does not delete memberships, does not apply SQL by CodeX, does not deploy by CodeX, does not invoke revoke/restore by CodeX, and does not commit/push.

## 9. Recommendation after live pass

After controlled revoke/restore PASS, choose either:

- checkpoint C7.8F, or
- proceed to C7.8G to decide whether and how to wire UI live flag safely.
