# C7.9C - Access denied UX revoked user

C7.9C STATUS: ACCESS DENIED UX REVOKED USER
C7_9B_STATUS: PASS
SIGNED_IN_NO_ACTIVE_MEMBERSHIP_BLOCKED: YES
REVOKED_USER_ACCESS_DENIED_UI: YES
PAUSED_USER_ACCESS_DENIED_UI: YES
NO_MEMBERSHIP_ACCESS_DENIED_UI: YES
DASHBOARD_RENDER_BLOCKED_WHEN_DENIED: YES
CLOUD_BOOTSTRAP_BLOCKED_WHEN_DENIED: YES
LOGOUT_FROM_DENIED_UI: YES
OWNER_ACTIVE_FLOW_PRESERVED: YES
CENTER_ADMIN_ACTIVE_FLOW_PRESERVED: YES
DEV_COPY_REINTRODUCED: NO
RUNTIME_CHANGED: YES
EDGE_FUNCTION_CHANGED: NO
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
LIVE_REVOKE_INVOKED_BY_CODEX: NO
LIVE_RESTORE_INVOKED_BY_CODEX: NO
PASSWORD_OR_SECRET_INCLUDED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Scope

C7.9C adds an explicit denied state for signed-in users who do not have any active center membership. The app now distinguishes active access from revoked, paused, and not-yet-granted access before loading the dashboard.

## 2. Runtime behavior

`resolveActiveCenterMembership` now reads the user's center memberships without filtering only active rows first. If no active membership exists, it returns a denied membership result with a reason of revoked, paused, no membership, or unknown.

`syncCloudUser` stops before cloud bootstrap when membership is denied. It resets cloud sync state, stops realtime subscriptions, renders the denied login-gate UI, and returns without loading dashboard data or sample fallback.

Active owner/admin users keep the existing loaded membership path.

## 3. User-facing copy

The login gate now shows a clear access denied state:

- Revoked: `Quyền truy cập của tài khoản này đã được thu hồi.`
- Paused: `Quyền truy cập của tài khoản này đang tạm dừng.`
- No membership: `Tài khoản này chưa được cấp quyền truy cập cơ sở.`

The screen includes the signed-in email, optional center name when known, and a logout button so the user can return to login.

## 4. Safety notes

No SQL was applied, no Edge Function was deployed or invoked, and no live revoke/restore action was run by CodeX. This change does not create, reset, revoke, restore, or mutate any account.

Frontend code still does not expose service-role secrets or Auth Admin APIs.

## 5. Follow-up readiness

Manual QA should verify:

- A revoked Phong Trống admin signs in and sees the denied screen.
- A paused membership sees the paused copy.
- A new/unassigned account sees the no-access copy.
- Active owner and active center admin accounts still enter the normal app.
