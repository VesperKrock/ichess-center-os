# C7.9B - Persistent revoked restore state

C7.9B STATUS: PERSISTENT REVOKED RESTORE STATE
C7_9A_STATUS: PASS_WITH_LEGACY_SCOPE_NOTE
LIST_CENTER_ADMIN_ACCOUNTS_RETURNS_REVOKED: YES
OWNER_UI_HANDLES_REVOKED_FROM_ENDPOINT: YES
RESTORE_AFTER_RELOAD_SUPPORTED: YES
LOCAL_SNAPSHOT_NO_LONGER_REQUIRED_FOR_RESTORE_AFTER_RELOAD: YES
PHONGTRONG_LIVE_RESTORE_PRESERVED: YES
DREAMHOME_LIVE_RESTORE_ENABLED: NO
DREAMHOME_LIVE_REVOKE_ENABLED: NO
DEV_COPY_REINTRODUCED: NO
RUNTIME_CHANGED: YES
EDGE_FUNCTION_CHANGED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
LIVE_REVOKE_INVOKED_BY_CODEX: NO
LIVE_RESTORE_INVOKED_BY_CODEX: NO
PASSWORD_OR_SECRET_INCLUDED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Context

C7.9A found one account lifecycle gap after C7.8: the Owner Account UI could show `Đã thu hồi quyền` immediately after revoke because it stored a local in-memory revoked snapshot, but `list-center-admin-accounts` only returned active center admins. After a reload, the revoked admin could disappear from the owner UI, so the restore button might no longer be available.

C7.9B fixes that persistence gap.

## 2. Root Issue

Before this phase:

- `revoke-center-admin-access` changed `center_members.status` from `active` to `revoked`.
- UI stored local revoked state for the current session.
- `list-center-admin-accounts` queried only `status = active`.
- Reloading the app discarded the local snapshot.

That meant restore-after-reload depended on memory instead of the database lifecycle state.

## 3. Endpoint Change

`list-center-admin-accounts` remains read-only and owner-guarded. It now queries center admin memberships with status `active` or `revoked`.

For each production active center:

- active admin wins if present,
- multiple active admins still returns the existing `multiple_active_admins` state,
- if no active admin exists but revoked admins exist, the endpoint returns the most recent revoked row,
- if no active or revoked admin exists, it returns no admin.

The response keeps existing fields and adds lifecycle flags:

- `membership_status`
- `state`
- `is_active`
- `is_revoked`
- `can_restore`
- `source`

No password, token, service-role value, or audit write is introduced.

## 4. UI Change

The Owner Account UI now normalizes lifecycle state from the endpoint. A revoked admin returned by the endpoint is enough to show:

- email,
- `Đã thu hồi quyền`,
- disabled reset/revoke,
- enabled `Khôi phục quyền` only for the allowed live target,
- copy email enabled.

Local revoked snapshots are still used for immediate current-session feedback after revoke, but endpoint lifecycle state has priority once loaded.

## 5. Restore After Reload

After the user deploys the updated endpoint:

1. Owner revokes Phòng Trống admin.
2. Owner reloads app.
3. `list-center-admin-accounts` returns the revoked admin row.
4. UI shows `Đã thu hồi quyền` and `Khôi phục quyền`.
5. Owner can restore with `RESTORE`.
6. After restore, endpoint returns active again and UI returns to normal.

## 6. Backward Compatibility

If an older endpoint shape is still deployed, the UI does not crash. It still understands the previous active/no-admin response shape and can use local snapshot fallback within the current session.

## 7. DreamHome Protection

Live revoke/restore remains allowlisted only to `phongtrong_prod`. If DreamHome ever has a revoked admin row, the UI may display the revoked state, but live restore remains disabled with product-facing copy.

## 8. Deploy Note

CodeX did not deploy. After review, deploy manually:

```bash
npx supabase functions deploy list-center-admin-accounts
```

Then run manual QA.

## 9. Manual QA Checklist

1. Login owner.
2. Open Internal Center Console.
3. Confirm Phòng Trống active admin is visible.
4. Revoke Phòng Trống admin.
5. Reload app.
6. Confirm Phòng Trống still shows admin email and `Đã thu hồi quyền`.
7. Confirm `Khôi phục quyền` is enabled for Phòng Trống.
8. Restore with `RESTORE`.
9. Reload again.
10. Confirm Phòng Trống returns to `Đã có admin`.
11. Confirm DreamHome still cannot live revoke/restore.
12. Confirm reset/copy/create flows still work.

## 10. Risks And Known Limitations

- Endpoint deployment is required before production runtime sees revoked state after reload.
- Restore remains live-enabled only for Phòng Trống.
- Access-denied UX for a revoked user login is still a C7.9C topic.

## 11. Recommendation

After manual QA passes, proceed to C7.9C for revoked-user access-denied UX, or checkpoint if C7.9C is intentionally deferred.
