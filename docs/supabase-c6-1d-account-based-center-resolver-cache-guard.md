# C6.1D - Account-based center resolver + production empty cache guard

C6.1D STATUS: RUNTIME MINIMAL + DOCS/SMOKE
STAGING_CENTER_ID: dreamhome
PRODUCTION_CENTER_ID: dreamhome_prod
ACCOUNT_BASED_CENTER_RESOLVER: YES
CENTER_MEMBERS_SOURCE_OF_TRUTH: YES
DREAMHOME_PROD_ADMIN_MEMBERSHIP_PROVIDED_BY_USER: YES
HARDCODE_DREAMHOME_FOR_SIGNED_IN_USER: REMOVED
PRODUCTION_EMPTY_CACHE_GUARD: YES
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MODIFIED: NO
ANGEL_WINGS_MIGRATED: NO
SQL_APPLIED: NO
SUPABASE_ACTION: NOT RUN
COMMIT: NOT RUN
PUSH: NOT RUN
C7_STARTED: NO

## 1. Context

C6.1C split the existing `dreamhome` center into a staging/test sandbox and reserved `dreamhome_prod` for DreamHome production empty center.

After C6.1C, user confirmed Supabase already has:

- `public.centers`: `dreamhome`, `dreamhome_prod`.
- `public.center_members`: active admin membership for `admin.dreamhome@ichess.vn`.
- Admin membership target: `center_id = dreamhome_prod`, `role = center_admin`, `status = active`.

C6.1D does not run SQL and does not call Supabase outside runtime app code.

## 2. Runtime design

Runtime now resolves the center after login from `center_members`, using active account membership as source of truth.

Flow:

1. User logs in through Supabase Auth.
2. App calls account-based membership resolver.
3. Resolver reads active rows from `center_members` for the authenticated user.
4. App binds to the resolved `center_id`.
5. Dashboard unlocks only when center binding is `bound`.
6. Cloud DB/readiness/realtime/write-through paths receive the resolved center explicitly.

For the DreamHome admin account, expected runtime binding is:

- `centerId = dreamhome_prod`
- `centerName = DreamHome`
- `role = center_admin`
- `source = account-membership`

## 3. Cache guard

Local cache is now center-scoped for app storage keys. The old staging namespace remains intact:

- Staging/test sandbox: `ichessCenterOS.<scope>.dreamhome`
- Production empty center: `ichessCenterOS.<scope>.dreamhome_prod`

C6.1D does not delete, migrate, or rewrite Angel Wings staging data.

When the signed-in center is `dreamhome_prod`, runtime reloads local data with empty defaults and writes only to the `dreamhome_prod` namespace. It must not fallback to `dreamhome` staging data or Angel Wings localStorage.

## 4. Production empty behavior

When cloud bootstrap/pull sees an empty production center:

- App treats empty cloud as valid production-empty state.
- App reloads local data for `dreamhome_prod` with empty defaults.
- UI/status uses `cloud-empty` / "Cloud trong" wording.
- App does not keep `dreamhome` staging cache as fallback for production.

For non-production/staging `dreamhome`, existing local/sample fallback behavior remains available.

## 5. Files changed

Runtime:

- `src/supabase-auth.js`
- `src/app-center-binding.js`
- `src/storage.js`
- `src/main.js`
- `src/cloud-status.js`
- `src/cloud-bootstrap.js`
- `src/cloud-db-sync.js`

Docs/test:

- `docs/supabase-c6-1d-account-based-center-resolver-cache-guard.md`
- `tests/supabase-c6-1d-account-based-center-resolver-cache-guard-smoke.js`

## 6. Safety constraints

- No SQL was created for apply.
- No SQL was run.
- No Supabase Dashboard/API action was run by Codex.
- No commit/push.
- No Angel Wings delete/migrate/modify action.
- No Teacher Portal, Super Admin, username login, account advanced UI, or C7 customer-facing work.

## 7. Manual QA checklist

1. Login as `admin.dreamhome@ichess.vn`.
2. Confirm account panel shows center `DreamHome`.
3. Confirm runtime binding/source is account membership, not single-center fallback.
4. Confirm dashboard unlocks only after membership is loaded.
5. Confirm Cloud DB readiness checks `dreamhome_prod`.
6. Confirm empty production state shows cloud-empty/empty data, not Angel Wings.
7. Confirm student/teacher/schedule/tuition lists start empty for `dreamhome_prod`.
8. Confirm localStorage keys written for production end with `.dreamhome_prod`.
9. Confirm existing `.dreamhome` keys are not deleted or modified by the login flow.
10. Logout and login again; confirm production empty state remains scoped to `dreamhome_prod`.

## 8. Accepted limitations

- If a user has multiple active center memberships, C6.1D picks the first row ordered by `center_id`; center picker UX is deferred.
- `CURRENT_CENTER_ID = dreamhome` remains as staging/dev fallback constant for explicit default parameters, but signed-in runtime paths are passed the resolved membership center.
- Production profile/display name is mapped in runtime for `dreamhome_prod`; richer center profile metadata is deferred.
- C6.1D does not create or verify Supabase membership rows; user already handled that manually.

## 9. Result

C6.1D PASS criteria:

- Account-based center resolver implemented.
- Signed-in DreamHome admin resolves to `dreamhome_prod`.
- Local cache guard prevents `dreamhome`/Angel Wings fallback into production empty center.
- Runtime remains local-first/cloud-write-through.
- No SQL, no Supabase action, no commit, no push.
