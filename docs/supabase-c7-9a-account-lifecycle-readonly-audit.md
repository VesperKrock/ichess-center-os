# C7.9A - Account lifecycle readonly audit

C7.9A STATUS: ACCOUNT LIFECYCLE READONLY AUDIT
C7_8_OWNER_ACCOUNT_MANAGEMENT_STATUS: DONE
READONLY_AUDIT_ONLY: YES
RUNTIME_CHANGED: NO
EDGE_FUNCTION_CHANGED: NO
SQL_MUTATION_CREATED: NO
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
LIVE_FUNCTION_INVOKED_BY_CODEX: NO
ACCOUNT_CREATED_BY_CODEX: NO
ACCOUNT_RESET_BY_CODEX: NO
ACCOUNT_REVOKED_BY_CODEX: NO
ACCOUNT_RESTORED_BY_CODEX: NO
ACCESS_ENFORCEMENT_AUDITED: YES
OWNER_UI_LIFECYCLE_AUDITED: YES
AUDIT_LOG_READINESS_AUDITED: YES
TEACHER_READINESS_NOTED_FOR_C8: YES
PASSWORD_OR_SECRET_INCLUDED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Executive Summary

C7.8 owner account management is complete and has a checkpoint commit. C7.9A does not change the system. This phase only inspects source and prepares a manual read-only SQL pack so the account lifecycle can be reviewed before C8 Teacher begins.

High-level result from source audit:

- Access enforcement for signed-in app users is based on active `center_members` rows.
- Internal Center Console additionally requires owner role and active membership.
- Revoke/restore functions move center admin membership between `active` and `revoked`.
- `list-center-admin-accounts` currently returns active center admins only.
- Owner UI can show restore immediately after revoke because it keeps an in-memory revoked state. After reload, that state is lost if the status endpoint does not return revoked admin rows.
- Audit logs exist for create, reset, revoke, and restore with action names, request ids, before/after states, and metadata.

Verdict: C7.8 is usable for the controlled Phong Trong flow, but C7.9B should make revoked/restore state persistent through `list-center-admin-accounts` before generalizing owner account lifecycle.

## 2. Current Lifecycle Vocabulary

- `active`: user has access to that center through `center_members`.
- `revoked`: access to a specific center has been withdrawn.
- `paused`: reserved for future temporary hold; restore function already looks at paused rows but only restores revoked rows.
- `disabled` / `banned`: broader account-level lock. Not implemented as a live UI flow.
- Reset password is credential rotation, not access removal.
- Revoke is center-scoped access removal, not a ban.
- Restore returns a revoked center membership to active.

## 3. Current Implemented Flows

Implemented Edge Functions:

- `provision-center-admin-account`: creates Auth user, inserts active `center_members` row, returns one-time temporary credential handoff, writes `account.provision_center_admin`.
- `reset-center-admin-password`: updates Auth credential for an active center admin, returns one-time handoff, writes `account.reset_center_admin_password`.
- `revoke-center-admin-access`: requires active owner, changes target center admin membership from active to revoked, does not disable Auth user, writes `account.revoke_center_admin_access`.
- `restore-center-admin-access`: requires active owner, changes target center admin membership from revoked to active, writes `account.restore_center_admin_access`.
- `list-center-admin-accounts`: read-only owner endpoint for production active centers and current active center admins.

Frontend Owner UI:

- Lists production centers.
- Shows admin email/status from `list-center-admin-accounts`.
- Supports create, reset, copy email, revoke, and restore.
- Live revoke/restore remains allowlisted to `phongtrong_prod`.

## 4. Access Enforcement Audit

Source findings:

- `src/supabase-auth.js` uses `listActiveCenterMemberships(userId)` and filters `center_members.status = active`.
- `resolveActiveCenterMembership(userId)` returns missing when there are no active memberships.
- `src/app-center-binding.js` returns `bound` only when `membershipStatus = loaded` and a center id exists.
- `src/main.js` Internal Center Console checks `cloudStatus.membership.status === active` plus owner role.
- `src/online-access-control.js` checks that a membership exists and role is readable/writable, but it receives the already-resolved active membership from app state.

Answer:

- Login gate currently depends on an active membership lookup.
- A revoked-only user should resolve as missing because revoked rows are excluded by the active filter.
- Internal Center Console should block non-active owner memberships.
- NEEDS MANUAL QA: verify with a revoked admin login that no local cached center state allows a confusing dashboard experience before the missing-membership state settles.
- NEEDS C7.9C: improve access-denied UX for revoked users so the message says access was removed, not only missing membership.

## 5. Owner UI Lifecycle Audit

Source findings:

- `list-center-admin-accounts` queries `center_members` with role `center_admin` and status `active`.
- When no active admin exists, the endpoint returns `admin.exists = false`, `membership_status = null`, and `state = none`.
- Frontend `localAccountSnapshotsByCenterId` stores revoked state after successful revoke and overlays it on top of the endpoint response.
- Restore target lookup depends on that revoked state.
- Restore success clears the local snapshot and refreshes account status.

Answer:

- After revoke, owner can restore immediately in the same UI session.
- After reload, revoked admin likely disappears as `exists = false` because the endpoint does not return revoked rows.
- Therefore restore-after-reload currently depends on local in-memory state and is not durable.
- NEEDS C7.9B: update `list-center-admin-accounts` to return active and revoked center admin lifecycle rows, with product-safe UI states. This should be done before enabling revoke/restore beyond Phong Trong.

## 6. Audit Log Readiness

Source findings:

- Create action: `account.provision_center_admin`.
- Reset action: `account.reset_center_admin_password`.
- Revoke action: `account.revoke_center_admin_access`.
- Restore action: `account.restore_center_admin_access`.
- All four use `account_audit_logs`.
- Revoke/restore include before and after membership states.
- All four use request id / idempotency key.
- Reset/create return temporary credentials in the response only; audit insert metadata does not include the temporary credential value.
- Revoke explicitly records `auth_user_disabled: false`.

Answer:

- Sufficient for a first owner action history.
- NEEDS C7.9D if UI history is desired: add a read-only owner action-history endpoint and timeline panel.
- Run the C7.9A SQL leak check manually to verify deployed data contains no credential/token text in audit rows.

## 7. Teacher Readiness Note For C8

C7.9A does not implement Teacher. Teacher should start in C8 after account lifecycle debt is resolved.

Before C8 Teacher, clarify:

- global teacher profile versus center-scoped assignment,
- teacher membership status vocabulary,
- teacher access gate and read/write boundaries,
- whether teacher rows should live in `center_members`, a teacher assignment table, or both.

The SQL pack includes read-only checks for `center_members.role = teacher` and possible teacher tables.

## 8. Risks And Recommendations

PASS:

- Owner account management C7.8 source is coherent for the controlled Phong Trong lifecycle.
- Access resolution filters for active membership.
- Audit actions are present for create/reset/revoke/restore.

NEEDS C7.9B:

- Make revoked admin state durable after reload by returning lifecycle status from `list-center-admin-accounts`.
- Decide how paused should appear in owner UI before using it.

NEEDS C7.9C:

- Add product-facing access-denied UX for users whose membership is revoked or paused.
- Manual QA: revoked admin login should be blocked clearly.

NEEDS C7.9D:

- Optional owner action history from `account_audit_logs`.

CAN DEFER TO C8:

- Teacher profile/assignment design, as long as C7.9B/C7.9C are not left ambiguous.

Suggested next sequence:

1. C7.9B persistent account lifecycle status endpoint/UI.
2. C7.9C revoked-user access-denied UX.
3. C7.9D optional owner account action history.
4. C7.9E checkpoint.
5. C8 Teacher.

## 9. Manual QA Checklist

Do not run these through CodeX.

1. Run `docs/supabase-c7-9a-readonly-account-lifecycle-inspection.sql` manually.
2. Revoke Phong Trong admin from owner UI.
3. Reload owner app.
4. Check whether the revoked state and restore action still appear.
5. Login as revoked Phong Trong admin.
6. Expected: access denied or missing active membership, with no OS data access.
7. Restore Phong Trong admin from owner UI if visible, or via the existing controlled restore path.
8. Login again as restored admin.
9. Expected: access works again.
10. Verify latest account audit rows and credential/token leak query.

## 10. Files In This Pack

- `docs/supabase-c7-9a-account-lifecycle-readonly-audit.md`
- `docs/supabase-c7-9a-readonly-account-lifecycle-inspection.sql`
- `tests/supabase-c7-9a-account-lifecycle-readonly-audit-smoke.js`
