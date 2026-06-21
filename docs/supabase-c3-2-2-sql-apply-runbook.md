# C3.2.2 - SQL Apply Runbook: Membership / Realtime

## 1. Summary

C3.2 code da chuan bi Online Hoc vien realtime MVP cho entity `student`, nhung live Supabase van can backend membership/RLS/realtime dung va du truoc khi claim production-ready.

C3.2.2 khong apply SQL. Runbook nay dung de nguoi van hanh review truoc khi quyet dinh chay SQL thu cong trong Supabase SQL Editor.

SQL patch muc tieu:

- Membership: tao/verify `center_members`, role, status, indexes.
- RLS: membership self-read, cloud entity read/write theo center va role.
- Realtime publication: bat Realtime cho `center_cloud_entities`.

WAITING USER CONFIRMATION BEFORE APPLYING SQL.

## 2. SQL files involved

### `docs/supabase-c3-2-1-membership-realtime-readiness.sql`

- Muc dich: patch plan cho membership/RLS/realtime C3.2.
- Trang thai: patch plan, NEEDS SQL REVIEW truoc khi apply.
- Co destructive SQL: NO.
- Co can backup: YES, vi co DDL/RLS/publication thay doi live schema.
- Co can user confirmation: YES.
- Chay o dau: Supabase SQL Editor cua project duoc user xac nhan.

### Files tham khao

- `docs/supabase-c1-cloud-db-foundation.sql`: tao `center_cloud_entities` va policy C1.
- `docs/supabase-c2-2-cloud-db-permissions-fix.sql`: idempotent Cloud DB permission/readiness fix C2.2.
- F19H.2 allowlist SQL docs: chi tham khao convention, khong dung de apply C3.2.2.

## 3. Supabase project target

Runbook chua tu xac dinh duoc Supabase live project.

NEEDS SUPABASE CONFIRMATION:

- Project Supabase can chay SQL la staging/test hay production?
- URL/project ref la gi?
- Ai la nguoi co quyen owner/admin de apply SQL?
- Da backup/export truoc chua?
- Live schema hien co co `center_members` hay chua?
- Neu `center_members` da ton tai, cac column/type/policy hien co la gi?

Khong hardcode project, URL, email, hoac user id trong runbook.

## 4. Safety audit

Audit tren `docs/supabase-c3-2-1-membership-realtime-readiness.sql`:

| Check | Result |
| --- | --- |
| `DROP TABLE` | NO |
| `TRUNCATE` | NO |
| `DELETE FROM` | NO |
| `ALTER TABLE` | YES |
| `CREATE TABLE IF NOT EXISTS` | YES |
| `ENABLE ROW LEVEL SECURITY` | YES |
| `CREATE POLICY` | YES |
| `ALTER PUBLICATION supabase_realtime` | YES |
| `REPLICA IDENTITY FULL` | YES |
| Hardcoded personal email/user access | NO |
| Seed real membership data | NO |

Destructive SQL found: NO.

NEEDS SQL REVIEW: YES, because live schema/policy names and existing `center_members` structure must be confirmed before apply.

## 5. Suggested apply order

### Step 0 - Backup / preflight

Do not run SQL until project is confirmed.

1. Confirm Supabase project: staging/test first is recommended.
2. Export schema or take project backup/snapshot if available.
3. Export existing `center_members` and `center_cloud_entities` rows if tables exist.
4. Run read-only verification queries in Section 6.
5. Compare live schema to patch plan.

Go/no-go before Step 1:

- `Toi da chon dung Supabase project.`
- `Toi hieu SQL dung de lam gi.`
- `Toi da backup/export neu can.`
- `Toi dong y chay Step 1.`

### Step 1 - Membership table/check

Purpose:

- Tao/verify `public.center_members`.
- Dam bao fields `center_id`, `user_id`, `role`, `status`, `created_at`, `updated_at`.
- Dam bao unique user-center va indexes can thiet.

Risk:

- Neu live table da co schema khac, can review manual truoc khi apply.

### Step 2 - Membership indexes

Purpose:

- Index by `user_id`.
- Index by `(center_id, role)`.
- Index by `(center_id, user_id, status)`.

Risk:

- Index creation can lock or take time on large table. Backup and low-traffic window recommended.

### Step 3 - Membership RLS/policies

Purpose:

- Enable RLS on `center_members`.
- Let authenticated users read their own memberships.
- Add helpers `public.is_center_member(center_id)` and `public.can_write_center(center_id)`.

Risk:

- Existing policies may have different names/logic. Review `pg_policies` first.

### Step 4 - Cloud entity RLS/permissions

Purpose:

- Verify `center_cloud_entities`.
- Keep `student` in entity allowlist.
- Read only active center members.
- Write only `owner`, `qtv`, `center_admin`.

Risk:

- Existing C2.2 policy allows any center member to write; new role-aware policy must not conflict with old broad policy. If old broad policies still exist, decide whether to replace them in a separate reviewed patch. Do not silently stack conflicting policies.

### Step 5 - Realtime publication

Purpose:

- Enable realtime/publication for `center_cloud_entities`.
- Use `REPLICA IDENTITY FULL` if update/delete event detail is needed.
- Keep RLS as primary protection, with client filter by `center_id` and app-level `entity_type = student`.

Risk:

- Realtime publication may increase event volume. C3.2 client subscribes only `student`, but table publication covers all rows from table; RLS and runtime filters remain required.

### Step 6 - Verification queries

Run read-only verification queries after each step. See Section 6.

### Step 7 - Manual QA

Run Test A-D in Section 7 after verification queries pass.

## 6. Verification queries

Read-only queries unless noted. Some require elevated Supabase SQL Editor privileges.

### Tables exist

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('center_members', 'center_cloud_entities')
order by table_name;
```

### Membership columns

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
  and column_name in ('center_id', 'user_id', 'role', 'status', 'created_at', 'updated_at')
order by ordinal_position;
```

### RLS enabled

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities');
```

### Policies

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('center_members', 'center_cloud_entities')
order by tablename, policyname;
```

### Functions

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_center_member', 'can_write_center');
```

### Entity allowlist has student

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.center_cloud_entities'::regclass
  and conname = 'center_cloud_entities_entity_type_check';
```

### Realtime publication

```sql
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'center_cloud_entities';
```

### Replica identity

```sql
select relname, relreplident
from pg_class
where oid = 'public.center_cloud_entities'::regclass;
```

### Sample membership check

Replace placeholders before running.

```sql
select center_id, user_id, role, status
from public.center_members
where center_id = '<CENTER_ID>'
  and user_id = '<USER_UUID>';
```

### Sample student entity count

```sql
select center_id, entity_type, count(*) as row_count
from public.center_cloud_entities
where entity_type = 'student'
group by center_id, entity_type
order by center_id;
```

## 7. Manual QA checklist after apply

### Test A - Hai tab cung user

- User co role ghi: `center_admin`, `owner`, hoac `qtv`.
- Mo tab A va tab B cung app/cung center.
- Tab A them Hoc vien.
- Tab B thay update khong can pull.
- Khong duplicate.
- Console khong co crash runtime.

### Test B - Hai tai khoan cung center

- Account A co quyen ghi.
- Account B co membership cung center.
- A them/sua Hoc vien.
- B thay realtime.
- B sua mot field khac, A thay realtime.

### Test C - Viewer/read-only

- Account viewer hoac no membership dang nhap.
- Thu them/sua Hoc vien.
- Khong cloud write.
- App khong crash.
- Co read-only reason.

### Test D - Cross-center isolation

- Center A them Hoc vien.
- Center B khong thay data Center A.
- QTV neu co nhieu center chi thay data theo center dang chon.
- Realtime event Center A khong lam thay doi cache Center B.

## 8. Rollback / recovery note

Preferred recovery is restore from Supabase backup/snapshot or apply a reviewed corrective migration.

Because this runbook avoids destructive SQL, expected rollback is mostly:

- Disable/remove new policies only after review if they block access unexpectedly.
- Remove table from realtime publication if event volume or leakage risk is found, after review.
- Restore old policy definitions from exported schema if needed.
- Restore backup/export if data unexpectedly changes.

Do not run ad hoc `drop`, `truncate`, or `delete` as rollback.

## 9. Go/no-go checklist

Before running any SQL:

- I have selected the correct Supabase project.
- I understand what this SQL does.
- I have backup/export if needed.
- I have reviewed existing `center_members` schema.
- I have reviewed existing policies.
- I agree to run one step at a time.
- I will verify each step before moving on.

WAITING USER CONFIRMATION BEFORE APPLYING SQL.

## 10. Decision for C3.3

C3.3 guarded code can be prepared only after C3.2.2 runbook is accepted.

C3.3 must not claim live realtime for Giao vien if membership/realtime SQL has not been applied and C3.2 manual QA has not passed.

If C3.3 code guarded is requested before live apply:

- use a helper riêng;
- use access guard;
- no fake realtime;
- no SQL apply;
- no broad runtime expansion.
