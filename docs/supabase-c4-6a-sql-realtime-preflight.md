# C4.6A - SQL / Realtime Preflight, Khong Apply

## Summary

C4.6A la preflight cho Supabase SQL/realtime. Phase nay chi audit readiness, chot checklist apply va chuan bi handoff cho C4.6B.

SQL APPLIED: NO
LIVE QA T/P: NOT RUN
WAITING USER CONFIRMATION BEFORE APPLYING SQL

C4.6A khong apply SQL, khong sua du lieu Supabase, khong seed cloud 29, khong claim production, khong claim T/P online pass. C4.7 moi live QA T/P sau khi SQL/realtime duoc apply va verify.

## Current App Readiness

- Login gate: da co C4.2, signed-out chi thay Login Portal.
- Center binding MVP: da co C4.3, single-center DreamHome fallback.
- Local staging 29: da co C4.4, la staging fallback, khong phai cloud seed.
- Cloud bootstrap: da co C4.5 cho `student`, `teacher`, `schedule_session`; cloud empty/error giu cache local.
- Student realtime guarded: da co C3.2 runtime, can membership/RLS/realtime live.
- Teacher realtime guarded: da co C3.3 runtime, can membership/RLS/realtime live.
- Schedule realtime guarded: da co C3.4C runtime, can membership/RLS/realtime live va allowlist `schedule_session`.
- Taskbar polish: da co C4.5.1/C4.5.2.

## Audit Sources

Reviewed repo/runbook inputs:

- `docs/supabase-c1-cloud-db-foundation.sql`
- `docs/supabase-c2-2-cloud-db-permissions-fix.sql`
- `docs/supabase-c3-2-1-membership-realtime-readiness.md`
- `docs/supabase-c3-2-1-membership-realtime-readiness.sql`
- `docs/supabase-c3-2-2-sql-apply-runbook.md`
- `docs/online-access-control-c3-1.md`
- `docs/online-student-realtime-c3-2.md`
- `docs/online-teacher-realtime-c3-3.md`
- `docs/online-schedule-session-realtime-c3-4c.md`
- `docs/online-schedule-session-bridge-c3-4b.md`
- `docs/cloud-bootstrap-c4-5-core-entities.md`
- `docs/supabase-f19h2d-schedule-session-allowlist.sql`
- runtime helpers: `cloud-db-sync`, `cloud-db-entities`, `cloud-bootstrap`, realtime student/teacher/schedule helpers, `online-access-control`, `app-center-binding`.

No SQL was executed during this audit.

## Backend Readiness Matrix

| Area | Needed for | Current repo readiness | Live Supabase status | Action |
| --- | --- | --- | --- | --- |
| Auth users | Manual account login | Runtime uses Supabase Auth, no signup | NEEDS SUPABASE PROJECT CONFIRMATION | Confirm users exist in target project; do not create in app |
| center binding / center_members | Bind user to DreamHome and enforce center scope | Runtime expects `center_members`; C3.2.1 has review-only SQL plan | UNKNOWN | Verify/create table/columns/policies in C4.6B only after confirmation |
| center_cloud_entities | Shared cloud source for core payloads | C1/C2 SQL exists; runtime reads/writes guarded | UNKNOWN | Verify table, columns, constraints, RLS, grants |
| student entity | Student bootstrap/realtime | App allowlist has `student`; C1/C2 SQL includes `student` | UNKNOWN | Verify check constraint contains `student` |
| teacher entity | Teacher bootstrap/realtime | App allowlist has `teacher`; C1/C2 SQL includes `teacher` | UNKNOWN | Verify check constraint contains `teacher` |
| schedule_session entity | TKB bootstrap/realtime | Runtime has separate schedule_session helper; SQL allowlist patch exists as F19H.2d | UNKNOWN / likely needs patch | Verify check constraint contains `schedule_session`; apply reviewed allowlist only in C4.6B |
| RLS | Cross-center isolation and role write guard | C1/C2 policies exist; C3.2.1 proposes active membership + write roles | UNKNOWN | Verify policies; avoid broad member write if role-aware write is required |
| Realtime publication | Realtime events for shared entities | C3.2.1 SQL plan adds `center_cloud_entities` to `supabase_realtime` | UNKNOWN | Verify publication and replica identity |
| Backup/verification | Safe backend changes | Runbook requires backup/export and read-only queries | NOT DONE in C4.6A | Backup before C4.6B |
| Manual QA | T/P live confidence | App smokes pass locally | LIVE QA T/P: NOT RUN | Run after SQL verify in C4.7 |

## SQL Purpose

Membership / center binding:

- Ensure `public.center_members` exists.
- Ensure fields: `center_id`, `user_id`, `role`, `status`, `created_at`, `updated_at`.
- Ensure unique/index coverage for `(center_id, user_id)`, `user_id`, and active center lookup.
- No account creation in app; accounts remain manual in Supabase/Admin tools.

RLS / policy:

- Let authenticated users read only their own active memberships.
- Let active center members read `center_cloud_entities` rows for their center.
- Let write-capable roles (`owner`, `qtv`, `center_admin`) write shared cloud rows.
- Preserve cross-center isolation.

Entity allowlist:

- Confirm `student` and `teacher` remain allowed.
- Add/confirm `schedule_session` before relying on schedule bootstrap/realtime.
- Do not add tuition, attendance, cashflow, Teacher Portal, Super Admin, or future entities in C4.6B.

Realtime publication:

- Add `public.center_cloud_entities` to `supabase_realtime` if missing.
- Set `REPLICA IDENTITY FULL` if update/delete event detail is needed.
- Keep RLS and client-side `center_id` plus `entity_type` filters.

Verification queries:

- Read-only checks for tables, columns, constraints, RLS, policies, publication, replica identity, membership rows, entity counts, and cross-center isolation.

## SQL Environment

SQL should be run manually only in:

```txt
Supabase Dashboard -> SQL Editor
Project: ichess-center-os / project hien tai nguoi dung dang dung
Environment: staging/dev Supabase project, chua claim production
```

NEEDS SUPABASE PROJECT CONFIRMATION

Before C4.6B, confirm project ref/URL, environment, admin owner, current backup status, and whether `center_members` already exists.

## Safety

SQL APPLIED: NO
Destructive data operation: NO
Backup recommended: YES
WAITING USER CONFIRMATION BEFORE APPLYING SQL

Destructive scan result on existing SQL files:

- `DROP TABLE`: not found.
- `TRUNCATE`: not found.
- `DELETE FROM`: not found.
- Data seed/membership seed: not found in C4.6A target plan.
- `drop policy if exists`: found in C1/C2/S5 docs; this can change permissions and must be reviewed.
- `drop trigger if exists`: found in C1/C2 docs; review before apply.
- `drop constraint if exists center_cloud_entities_entity_type_check`: found in allowlist patches; review because a bad replacement can block writes.

Conclusion: no destructive data operation was found, but schema/policy changes are real backend changes and need backup plus user confirmation.

## Apply Order For C4.6B

Step 0 - Backup / project confirmation

- Confirm Supabase project and environment.
- Export schema/policies if possible.
- Snapshot `center_members` if it exists.
- Snapshot `center_cloud_entities`.
- Save current `center_cloud_entities_entity_type_check` definition.
- Confirm SQL APPLIED is still NO before starting.

Step 1 - Preflight read-only verification

- Run all read-only verification queries below.
- Stop if tables/policies differ from assumptions.

Step 2 - Membership table / center binding readiness

- Verify/create `center_members`.
- Verify active membership rows for test accounts and center `dreamhome`.
- Do not hardcode personal emails in SQL.

Step 3 - RLS/policies

- Enable RLS where needed.
- Verify self-read membership.
- Verify center-scoped read and role-scoped write for `center_cloud_entities`.
- Do not silently stack broad old policies with stricter new ones.

Step 4 - Entity allowlist for `student`, `teacher`, `schedule_session`

- Verify `student` and `teacher`.
- Add/confirm `schedule_session`.
- Do not add future C5/C6 entities.

Step 5 - Realtime publication / replica identity

- Verify/add `public.center_cloud_entities` to `supabase_realtime`.
- Verify `relreplident` and set replica identity only if reviewed.

Step 6 - Post-apply verification

- Run verification queries again.
- Run app smoke/manual sanity.

Step 7 - App smoke/manual test

- Login, cloud bootstrap, student/teacher/schedule smoke.
- No T/P live claim until C4.7.

## Verification Checklist And Queries

Tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('center_members', 'center_cloud_entities')
order by table_name;
```

Columns exist:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('center_members', 'center_cloud_entities')
  and column_name in (
    'center_id', 'user_id', 'role', 'status',
    'entity_type', 'local_id', 'payload', 'deleted_at',
    'created_at', 'updated_at'
  )
order by table_name, ordinal_position;
```

RLS enabled:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities');
```

Policies:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities')
order by tablename, policyname;
```

Helper functions:

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_center_member', 'can_write_center');
```

Entity allowlist:

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';
```

Expected entity types for C4.6B:

```txt
student
teacher
schedule_session
```

Realtime publication:

```sql
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';
```

Replica identity:

```sql
select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;
```

Membership sample:

```sql
select center_id, user_id, role, status
from public.center_members
where center_id = '<CENTER_ID>'
  and user_id = '<USER_UUID>';
```

Entity counts:

```sql
select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
where entity_type in ('student', 'teacher', 'schedule_session')
group by center_id, entity_type
order by center_id, entity_type;
```

Cross-center isolation check:

```sql
select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
group by center_id, entity_type
order by center_id, entity_type;
```

Then verify from the app with two accounts that a user from one center cannot read another center. Do not rely on SQL counts alone.

## Rollback / Recovery Notes

- If any SQL step errors, stop immediately.
- Do not continue to later steps after an error.
- Copy the exact SQL error and current step.
- Do not run ad hoc `drop`, `truncate`, or `delete` as recovery.
- Restore policy definitions from exported schema if access breaks.
- Remove `center_cloud_entities` from realtime publication only after review if event volume or leakage risk appears.
- Restore `center_cloud_entities_entity_type_check` from backup if allowlist replacement is wrong.
- App fallback local/cache should continue to work if cloud is unavailable.

## C4.6B Handoff

C4.6B should start only after user confirms:

- Supabase project/environment.
- Backup completed.
- SQL review accepted.
- Step-by-step apply is allowed.

C4.6B may apply reviewed membership/RLS/allowlist/realtime SQL manually in Supabase SQL Editor. It must verify each step before continuing.

## C4.7 Handoff

C4.7 is live QA after SQL/realtime is applied and verified:

- T/P or two test accounts in the same center.
- Two tabs or two machines.
- Shared cloud data visible for `student`, `teacher`, `schedule_session`.
- Cross-center isolation check.
- No claim before manual QA is actually run.
