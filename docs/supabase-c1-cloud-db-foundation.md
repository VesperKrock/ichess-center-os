# C1 Supabase Cloud DB Foundation

C1 adds a manual Cloud DB foundation for three localStorage entity groups:

- `student`
- `teacher`
- `class_session`

The cloud table stores each local entity as a JSONB snapshot keyed by `center_id`, `entity_type`, and `local_id`. This keeps the current local data model intact while giving the app a safe first cross-device path.

## What C1 Does

- Creates `public.center_cloud_entities`.
- Enables RLS.
- Allows only authenticated `center_members` of the same `center_id` to select/insert/update/delete rows.
- Adds app-side manual actions in Module 10 / Cài đặt cơ sở:
  - refresh cloud counts;
  - push local students, teachers, and class sessions to cloud;
  - pull cloud students, teachers, and class sessions back to local.
- Backs up the three local keys before cloud-to-local replace.

## What C1 Does Not Do

- No auto-sync on CRUD.
- No Supabase Storage changes.
- No service role.
- No public signup.
- No notification.
- No tuition, attendance board, `sessionReports`, cashflow, cashbook, inventory, or parent consultation sync.
- No SQL execution from the app.

## Run SQL Manually

1. Open Supabase Dashboard.
2. Open SQL Editor.
3. Paste the contents of `docs/supabase-c1-cloud-db-foundation.sql`.
4. Run the SQL.
5. Confirm the table `public.center_cloud_entities` exists and RLS is enabled.

## Test In The App

1. Start the app.
2. Sign in with Supabase Cloud.
3. Make sure the signed-in user has a `center_members` row for `center_id = 'dreamhome'`.
4. Open Module 10 / Cài đặt cơ sở.
5. Find the `Cloud DB foundation` panel.
6. Click `Làm mới số liệu`.
7. Click `Đẩy local lên cloud` to upsert local students, teachers, and class sessions.
8. On another browser/device, sign in with the same DreamHome membership.
9. Click `Tải cloud về local` only after confirming the replace prompt.

## Backup Behavior

Before cloud-to-local replace, the app writes a backup key:

```txt
ichessCenterOS.backup.beforeCloudPull.<timestamp>
```

The backup contains only:

- `ichessCenterOS.students.dreamhome`
- `ichessCenterOS.teachers.dreamhome`
- `ichessCenterOS.classSessions.dreamhome`

It does not back up or modify tuition, attendance, Thu chi, Sổ quỹ, inventory, notifications, or cloud image metadata.

## Security Notes

- The client uses the existing Supabase publishable/anon key through Supabase Auth.
- Never put a `service_role` key in the app.
- Do not commit `.env.local`.
- Policies do not allow anonymous public reads or writes.
