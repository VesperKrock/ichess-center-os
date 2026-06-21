# Online Roadmap C3-C6

## 1. Principles

- No signup in app.
- Accounts are created manually in Supabase/Admin tools.
- MVP: valid account plus center binding opens dashboard.
- Fine-grained permissions move to Super Admin later.
- Use one Supabase project first, many centers by `centerId`.
- localStorage is cache/fallback, not production source of truth.
- Cloud is source of truth when online.
- No SQL apply without user confirmation.
- No push until T/P online QA pass.
- No production center creation inside C3.

## 2. C3 - Online guarded foundation

C3 is the guarded online foundation. It prepares runtime paths, access guards, docs, tests and readiness markers, but does not claim live production realtime while SQL/realtime confirmation is still pending.

- C3.0 - Online architecture/design.
- C3.1 - Auth + access gate foundation.
- C3.2 - Hoc vien realtime guarded.
- C3.3 - Giao vien realtime guarded.
- C3.4A - Audit class_session vs schedule_session.
- C3.4B - schedule_session bridge/readiness.
- C3.4C - TKB schedule_session realtime guarded runtime.
- C3.4D - Final audit + roadmap lock + commit local only.

C3 final state:

- Student, teacher and schedule guarded code paths exist.
- C3.1 access guard blocks viewer/teacher/consultant/no membership from broad cloud write.
- SQL applied: NO.
- NEEDS MEMBERSHIP SQL PATCH: YES.
- NEEDS SUPABASE REALTIME PATCH: YES.
- NEEDS SCHEDULE_SESSION SQL PATCH: YES for TKB live path.
- NEEDS SUPABASE CONFIRMATION: YES.

## 3. C4 - Login Portal + Shared Cloud Source of Truth

C4 turns the guarded foundation into the first shared online operating mode.

- C4.0 - Portal design: no signup, one-center admin login MVP.
- C4.1 - Tach dang nhap khoi Module Thu Chi.
- C4.2 - Login gate: chua dang nhap chi thay man hinh dang nhap.
- C4.3 - Center binding: tai khoan admin thuoc 1 center thi vao thang center do.
- C4.4 - Shared staging dataset: bo seed 8 cu khoi default path, dung goi 29 de T/P test.
- C4.5 - Cloud bootstrap: mo app la lay student/teacher/schedule tu cloud.
- C4.6 - Apply SQL membership/realtime theo runbook, co xac nhan.
- C4.7 - Live QA: T/P hai tab/hai may cung sua du lieu.
- C4.8 - No-push checkpoint review.

C4 rules:

- No signup.
- Manual Supabase account creation only.
- Login portal is a gate, not a public registration funnel.
- localStorage is cache and fallback.
- Shared cloud data is the online source of truth.
- Seed 8 must not silently become the anonymous/new-machine default after C4.4.
- The 29-student package is the shared staging dataset for T/P online QA.

## 4. C5 - Realtime nghiep vu nhay cam

C5 is for sensitive realtime operations after login/cloud source of truth is proven.

- C5.1 - Diem danh/Bao cao realtime design.
- C5.2 - attendance_record realtime guarded.
- C5.3 - session_report realtime guarded.
- C5.4 - Hoc phi/TBHP cloud source of truth design.
- C5.5 - tuition_record/term/payment realtime guarded.
- C5.6 - Audit log / conflict / rollback.

C5 rules:

- Attendance and tuition need stronger conflict, audit and rollback behavior than C3 core entities.
- No hidden automation from attendance to tuition.
- No broad realtime write without module-specific QA.

## 5. C6 - Production / Expansion

C6 moves from shared staging to production expansion.

- C6.1 - DreamHome production empty center.
- C6.2 - Ban giao nhap lieu that.
- C6.3 - Multi-center toan quoc.
- C6.4 - Teacher Portal architecture.
- C6.5 - Teacher Portal MVP.
- C6.6 - Super Admin architecture.
- C6.7 - Super Admin MVP.

C6 rules:

- Production center starts empty unless an explicit import/migration is approved.
- Multi-center must remain `centerId` scoped.
- Super Admin owns detailed permissions and center administration later.

## 6. Teacher Portal future wire

Teacher Portal is not built in C3/C4. The current work only keeps architecture compatible so the later portal does not require breaking changes.

Future compatibility notes:

- Teacher/staff portal compatibility is planned.
- Teacher account has display name.
- Teacher may be approved/assigned to one or more centers.
- Teacher app can select center if assigned to multiple centers.
- Teacher app future scope:
  - view own TKB;
  - diem danh;
  - bao cao lop/Trello;
  - xem thong tin hoc vien trong pham vi duoc phep.

Teacher own-only write permissions are future scope, not C3.

## 7. Supabase free plan note

- Prefer one Supabase project with many centers first.
- Avoid per-center Supabase project in MVP.
- Text data for students, teachers and schedules is lightweight.
- Storage-heavy features like cloud images should be controlled later.
- SQL changes require explicit user confirmation before apply.

## 8. Push policy

- Commit local after C3.4D only if smoke/build/diff pass.
- Do not push until T/P online QA pass.
- Do not claim live realtime production pass before SQL/realtime backend and manual QA are complete.
