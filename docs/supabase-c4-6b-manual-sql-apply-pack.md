# C4.6B - Manual SQL Apply Pack

## Summary

C4.6B prepares a manual Supabase SQL apply pack for membership/RLS/entity allowlist/realtime. Codex did not run SQL locally and did not modify Supabase.

SQL READY FOR MANUAL APPLY: YES
SQL APPLIED BY USER: NO
WAITING USER TO RUN SQL IN SUPABASE SQL EDITOR
LIVE QA T/P: NOT RUN

Use the SQL only in Supabase SQL Editor, one step at a time, with verify after each step. Do not run the whole file blindly.

## Project / Environment

Run SQL here only:

```txt
Supabase Dashboard
-> Project: ichess-center-os
-> Ref: zahcfnpaprbnuqpegdmo
-> SQL Editor
```

Environment note: the Supabase UI currently shows PRODUCTION, but this project is being used as the current staging/dev project for iChess Center OS. Because of that label, every step must be run and verified separately.

## Current Backend State To Protect

`center_cloud_entities` backup:

- 39 rows
- center_id: `dreamhome`
- `student`: 29
- `teacher`: 6
- `class_session`: 4
- `schedule_session`: 0
- `deleted_at`: empty
- payload JSON: parse OK
- datasetId: `angel-wings-2026-06`

`center_members`:

- exists
- 3 rows
- center_id: `dreamhome`
- roles: `owner`, `owner`, `admin`

Do not delete, truncate, reseed, or rewrite these rows. Do not insert membership rows unless the user explicitly requests it later.

## SQL File

Manual SQL file created:

```txt
docs/supabase-c4-6b-final-apply.sql
```

The SQL file is review/manual-apply only. It is split into steps:

- STEP 1: READ-ONLY PREFLIGHT
- STEP 2: MEMBERSHIP READINESS
- STEP 3: ENTITY ALLOWLIST
- STEP 4: RLS POLICIES
- STEP 5: REALTIME PUBLICATION
- STEP 6: POST-APPLY VERIFY

## Destructive Scan Result

Data-destructive operations: NO

The SQL file must not contain:

- `TRUNCATE`
- `DELETE FROM center_cloud_entities`
- `DELETE FROM center_members`
- `DROP TABLE`
- `DROP SCHEMA`

Policy replacement: YES, limited to named policies on `center_members` and `center_cloud_entities`.

Drop trigger: NO.

Drop constraint: YES, only for `center_cloud_entities_entity_type_check`, inside STEP 3. Reason: PostgreSQL check constraints cannot be edited in place; adding `schedule_session` requires replacing the existing allowlist constraint. This is metadata-only, does not delete rows, preserves existing `student`, `teacher`, `class_session`, and adds `schedule_session`. Verify counts before and after.

NEEDS REVIEW note: if the live constraint definition differs unexpectedly, stop before STEP 3 and review.

## Backup Reminder

Before running any write step:

- Confirm project `ichess-center-os / zahcfnpaprbnuqpegdmo`.
- Keep the exported `center_cloud_entities` CSV.
- Export or screenshot `center_members`.
- Save current policies for `center_members` and `center_cloud_entities`.
- Save current `center_cloud_entities_entity_type_check` definition.
- Do not run all steps in one click.

## Apply Steps

### Step 0 - Backup / Confirm

Checklist:

- [ ] Đúng project `ichess-center-os / zahcfnpaprbnuqpegdmo`.
- [ ] Đã export `center_cloud_entities` CSV.
- [ ] Đã xác nhận `center_members` có 3 rows.
- [ ] Không chạy tất cả một lần nếu chưa đọc từng step.
- [ ] Đã mở `docs/supabase-c4-6b-final-apply.sql`.

### Step 1 - Read-only preflight verify

Purpose: confirm live state before any write.

Run only the STEP 1 queries from SQL file. Expected:

- `center_cloud_entities` exists.
- `center_members` exists.
- `center_cloud_entities` total is 39.
- counts are `student` 29, `teacher` 6, `class_session` 4, `schedule_session` 0.
- `center_members` total for `dreamhome` is 3.
- roles include `owner`, `owner`, `admin`.
- existing policies/publication are visible.

If counts differ, stop and review before continuing.

### Step 2 - Membership readiness

Purpose: keep existing `center_members`, add only safe readiness pieces if missing.

This step:

- does not drop/recreate `center_members`;
- does not insert membership data;
- does not change the 3 existing roles;
- adds `status`, `created_at`, `updated_at` only if missing;
- creates safe indexes if missing;
- creates helper functions `is_center_member` and `can_write_center`.

Write roles include `owner`, `qtv`, `center_admin`, and `admin` because current data has `admin` while runtime aliases `admin` to `center_admin`.

Verify immediately after Step 2 with the Step 2 verify queries.

### Step 3 - Entity allowlist

Purpose: allow exactly the C4.6B core cloud entities needed for live QA:

```txt
student
teacher
class_session
schedule_session
```

`class_session` is preserved because existing cloud has 4 rows and C2/C3 uses it.

This step replaces the check constraint with a superset. It does not delete data. If this step fails, stop and restore the prior constraint definition from backup/review.

Verify immediately after Step 3. Counts must remain:

- total 39
- `student` 29
- `teacher` 6
- `class_session` 4
- `schedule_session` 0

### Step 4 - RLS / Policies

Purpose:

- signed-in member of a center can read that center;
- `owner`, `admin`, `center_admin`, `qtv` can write;
- no cross-center leak;
- no table/data drop.

This step replaces only named C4.6B policies. It does not drop tables or delete rows.

Verify policies after Step 4.

### Step 5 - Realtime Publication

Purpose: ensure `public.center_cloud_entities` is in `supabase_realtime` and set replica identity for robust update events.

If publication add reports the table is already included, use the guarded DO block in the SQL file. Verify `pg_publication_tables` after the step.

### Step 6 - Post-apply Verification

Expected after all apply steps:

- `center_cloud_entities`: 39 rows
- `student`: 29
- `teacher`: 6
- `class_session`: 4
- `schedule_session`: 0
- `center_members` for dreamhome: 3 rows
- policies exist
- realtime publication includes `center_cloud_entities`
- app login can read cloud after refresh

### Step 7 - Stop Before C4.7

After apply + verify PASS, stop.

Do not claim C4.7 live QA. C4.7 will test T/P two tabs/two machines.

## Rollback / Recovery Notes

If any SQL step fails:

- stop immediately;
- do not run the next step;
- copy the exact error and step number;
- do not use `drop`, `truncate`, or `delete` as rollback;
- restore policy definitions from saved backup if policy access breaks;
- restore prior `center_cloud_entities_entity_type_check` definition if allowlist replacement is wrong;
- remove table from realtime publication only after review if needed;
- app local/cache fallback remains available if cloud is not ready.

## C4.7 Handoff

C4.7 starts only after the user confirms:

- SQL was run in Supabase SQL Editor;
- Step 6 verification passed;
- no data counts changed unexpectedly;
- app can login and bootstrap cloud.

C4.7 will then run live T/P QA for shared cloud data and realtime behavior. C4.6B does not run live QA.
