# C6.3C - Verify centers schema hardening applied

C6.3C STATUS: VERIFY CENTERS SCHEMA HARDENING APPLIED
C6_3B_STATUS: PASS
SQL_APPLIED_BY_USER: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
CENTERS_SCHEMA_HARDENED: YES
DREAMHOME_BACKFILLED_AS_STAGING: YES
DREAMHOME_PROD_BACKFILLED_AS_PRODUCTION: YES
CENTERS_ENVIRONMENT_CHECK_EXISTS: YES
CENTERS_STATUS_CHECK_EXISTS: YES
CENTERS_SLUG_ENVIRONMENT_UNIQUE_INDEX_EXISTS: YES
NEW_CENTER_CREATED: NO
GOVAP_CREATED: NO
QUAN12_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.3C

C6.3C ghi nhận và verify trạng thái sau khi user đã tự chạy manual apply SQL từ C6.3B trong Supabase SQL Editor. Phase này không chạy SQL, không Supabase action, không sửa runtime và không tạo center mới.

## 2. Trạng thái trước C6.3C

C6.3B PASS đã tạo docs, read-only inspection SQL và manual apply SQL template cho centers schema hardening. Sau đó user đã manual apply template trong Supabase.

## 3. SQL apply do user chạy thủ công

SQL_APPLIED_BY_USER: YES.

SQL_APPLIED_BY_CODEX: NO.

CodeX không chạy SQL và không gọi Supabase action trong C6.3C.

## 4. Evidence sau apply

User cung cấp evidence:

`dreamhome`:

- name = DreamHome
- slug = dreamhome
- environment = staging
- status = active

`dreamhome_prod`:

- name = DreamHome
- slug = dreamhome
- environment = production
- status = active

Constraints/indexes:

- `centers_environment_check`
- `centers_status_check`
- `centers_pkey`
- `centers_environment_idx`
- `centers_slug_environment_unique_idx`
- `centers_status_idx`

## 5. Centers metadata result

Centers schema hardening applied successfully per user evidence. `dreamhome` is explicitly staging and `dreamhome_prod` is explicitly production. Both use slug `dreamhome`, allowed by unique `(slug, environment)`.

## 6. Constraints/indexes result

Required checks and indexes exist per evidence:

- environment check exists;
- status check exists;
- slug + environment unique index exists;
- environment/status indexes exist.

## 7. Production/staging model sau apply

Production/staging is now represented in center metadata, not only encoded in `center_id` suffix:

- `dreamhome`: staging/test sandbox.
- `dreamhome_prod`: production empty center.

## 8. Tác động tới DreamHome

DreamHome production remains `dreamhome_prod`. The hardening adds metadata and does not change center IDs, memberships, runtime resolver, or localStorage keys.

## 9. Tác động tới Angel Wings

Angel Wings remains in `dreamhome` staging/test sandbox. C6.3C does not delete, migrate, clone, or seed Angel Wings data.

## 10. Tác động tới future Gò Vấp / Quận 12

`govap_prod` and `quan12_prod` remain future examples only. C6.3C does not create Gò Vấp, does not create Quận 12, does not create Auth users and does not assign memberships.

## 11. Những gì C6.3C không làm

C6.3C does not run SQL, does not call Supabase, does not modify runtime, does not create centers, does not create users, does not assign memberships, does not open C6.4/C6.5/C7, does not commit and does not push.

## 12. Manual QA checklist

Recommended manual QA after schema hardening:

1. Login `admin.dreamhome@ichess.vn`.
2. Confirm app still resolves `dreamhome_prod`.
3. Confirm dashboard remains DreamHome production empty.
4. Confirm no Angel Wings data appears in production.
5. Confirm staging `dreamhome` remains available for sandbox users if tested.
6. Confirm localStorage namespaces remain separate: `.dreamhome` and `.dreamhome_prod`.

## 13. C6.3D/C6.3E recommendation

If C6.3C review is accepted, next phase can be C6.3D runtime/readiness audit or C6.3E checkpoint review. Do not create Gò Vấp/Quận 12 without a separate provisioning phase.

## 14. C6.4 deferred

C6.4 minimal owner/admin role binding remains deferred.

## 15. C6.5 Internal Center Console deferred

C6.5 Internal Center Console remains deferred. No route `/internal/centers` and no `Thêm cơ sở` button is created in C6.3C.

## 16. C7 deferred

C7 remains deferred: no username login, account management, Teacher Portal or Super Admin work.

## 17. PASS / NEEDS REVIEW criteria

PASS if docs/test verify are complete, SQL apply is recorded as user-run, metadata for `dreamhome` and `dreamhome_prod` matches evidence, constraints/indexes are recorded, no new center is created, no SQL/Supabase action by CodeX, no runtime change, no Angel Wings migration, all smokes/build/check pass and no commit/push.

NEEDS REVIEW if evidence conflicts with recorded metadata, constraints/indexes are missing, future centers were created unexpectedly, or any runtime/SQL/Supabase action by CodeX is required.
