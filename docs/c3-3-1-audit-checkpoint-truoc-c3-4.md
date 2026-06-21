# C3.3.1 - Audit checkpoint truoc C3.4

## 1. Muc tieu

C3.3.1 la checkpoint audit worktree C3.0 den C3.3 truoc khi mo C3.4 TKB realtime. Phase nay khong them runtime realtime moi, khong chay SQL, khong apply SQL patch, khong sua du lieu local/cloud va khong commit/push.

## 2. Worktree audit

Modified:

- `.gitignore`
- `src/cloud-db-sync.js`
- `src/main.js`

Untracked C3 docs:

- `docs/online-collaboration-architecture-c3-0.md`
- `docs/online-access-control-c3-1.md`
- `docs/online-student-realtime-c3-2.md`
- `docs/online-teacher-realtime-c3-3.md`
- `docs/supabase-c3-2-1-membership-realtime-readiness.md`
- `docs/supabase-c3-2-1-membership-realtime-readiness.sql`
- `docs/supabase-c3-2-2-sql-apply-runbook.md`
- `docs/c3-3-1-audit-checkpoint-truoc-c3-4.md`

Untracked C3 src:

- `src/online-access-control.js`
- `src/cloud-realtime-students.js`
- `src/cloud-realtime-teachers.js`

Untracked C3 tests:

- `tests/c3-0-online-collaboration-architecture-smoke.js`
- `tests/c3-1-auth-membership-readonly-gate-smoke.js`
- `tests/c3-2-online-hoc-vien-realtime-mvp-smoke.js`
- `tests/c3-2-1-membership-realtime-readiness-smoke.js`
- `tests/c3-2-2-review-sql-patch-membership-realtime-smoke.js`
- `tests/c3-3-online-giao-vien-realtime-mvp-smoke.js`
- `tests/c3-3-1-audit-checkpoint-truoc-c3-4-smoke.js`

Ngoai scope nguy hiem: NO.

## 3. .gitignore audit

Diff hien tai:

- Bo ignore `Roadmapfb.txt`.
- Them ignore `RoadmapRealTime.txt`.

Nhan dinh:

- Thay doi nay lien quan private roadmap/local note, co the thuoc cum realtime C.
- Khong ignore nham source, docs, tests, SQL patch plan, env mau hay file cau hinh quan trong.
- Khong co wildcard rong kieu `docs/`, `src/`, `tests/` hoac `*.sql`.

NEEDS GITIGNORE REVIEW: NO.

## 4. C3 consistency

C3.0:

- Co architecture/roadmap Online Collaboration.
- Ghi ro realtime phai incremental opt-in theo entity/module.
- Ghi ro `center_cloud_entities` hien dang phuc vu `student`, `teacher`, `class_session`.

C3.1:

- Co Auth + Membership + read-only gate.
- Co marker `NEEDS MEMBERSHIP SQL PATCH`.
- Role write cloud gioi han vao `owner`, `qtv`, `center_admin`.

C3.2:

- Co Hoc vien realtime guarded cho entity `student`.
- Khong mo Giao vien/TKB/Hoc phi/attendance trong helper student.
- Co `NEEDS SUPABASE REALTIME PATCH` khi backend realtime chua san sang.

C3.2.1:

- Co readiness audit cho `center_members`, RLS va Realtime/publication tren `center_cloud_entities`.
- Ket luan can membership SQL patch va realtime patch.

C3.2.2:

- Co SQL apply runbook.
- Co gate `WAITING USER CONFIRMATION BEFORE APPLYING SQL`.
- Khong tu claim SQL da apply hay live realtime da pass.

C3.3:

- Co Giao vien realtime guarded cho entity `teacher`.
- Khong mo TKB/Hoc phi/attendance.
- Tiep tuc bao `NEEDS MEMBERSHIP SQL PATCH`, `NEEDS SUPABASE REALTIME PATCH`, `NEEDS SUPABASE CONFIRMATION`.

## 5. Runtime audit

Student realtime guarded:

- `src/cloud-realtime-students.js` chi xu ly entity `student`.
- `src/main.js` co `writeStudentThroughCloud` va `startStudentRealtimeSubscription`.
- Write path dung C3.1 access-control guard.

Teacher realtime guarded:

- `src/cloud-realtime-teachers.js` chi xu ly entity `teacher`.
- `src/main.js` co `writeTeacherThroughCloud` va `startTeacherRealtimeSubscription`.
- Add/edit/ngung day giao vien upsert cloud chi khi guard cho phep.

Access-control:

- `src/online-access-control.js` gom `buildOnlineAccessState`, `canWriteEntity`, `canReadModule`.
- Missing membership/viewer/teacher/consultant/no role khong duoc cloud write.

No TKB/Hoc phi/attendance realtime: YES.

## 6. SQL/readiness state

SQL patch exists: YES.

SQL applied: NO.

Needs user confirmation before apply: YES.

NEEDS MEMBERSHIP SQL PATCH: YES.

NEEDS SUPABASE REALTIME PATCH: YES.

NEEDS SUPABASE CONFIRMATION: YES.

## 7. C3.4 recommendation

Option khuyen nghi: Option C - split C3.4A/C3.4B.

Suggested next prompt:

- C3.4A - Audit/bridge `class_session` vs `schedule_session`, xac dinh entity source cho Module TKB realtime, khong runtime moi.
- C3.4B - `schedule_session` realtime guarded sau khi scope ro va backend/allowlist duoc xac nhan.

Reason:

- `class_session` da la core C2 entity, nam trong `CLOUD_ENTITY_TYPES` va allowlist C2.
- `schedule_session` gan Module 7/TKB that hon, co `teacherId`, `studentIds`, recurring/oneOff, date/day/time va lien ket `classSessionId`.
- Repo hien co `src/cloud-schedule-sessions.js` va docs F19H.2d cho `schedule_session`, nhung do la dry-run; SQL allowlist `docs/supabase-f19h2d-schedule-session-allowlist.sql` chua apply.

Risk:

- Neu di thang `class_session`, C3.4 se an toan hon nhung chua phu het TKB van hanh.
- Neu di thang `schedule_session`, se gan dung TKB hon nhung rui ro cao vi allowlist/backend/realtime chua san sang.
- Tach C3.4A/C3.4B giup tranh nham giua ca hoc danh muc `class_session` va lich van hanh `schedule_session`.

## 8. Non-scope da giu

- Khong SQL.
- Khong data change.
- Khong C3.4 runtime.
- Khong realtime TKB.
- Khong commit/push.
