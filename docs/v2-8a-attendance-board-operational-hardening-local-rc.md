# V2-8A — Attendance Board Operational Hardening + Figma Paint — Local RC

Date: 2026-09-14

## Preflight

- Branch: `main`
- Starting `HEAD`: `7388432e05362a43624c838ac03fafcd8430386f`
- Fetched `origin/main`: `7388432e05362a43624c838ac03fafcd8430386f`
- Starting ahead/behind: `0/0`
- Starting source worktree: clean
- Existing isolated stash: `stash@{0}: On local/teacher-workspace-secret: wip T7 teacher report review scroll unresolved`
- Frozen migration worktree drift: `0`

## Bounded implementation map

Reused authoritative entities and boundaries:

- V2-3 `attendance_record` occurrence identity and server mutation boundary for attendance state.
- V2-4 package cycles, attendance contributions, remaining-session projection, and Finance `POSTED/VOIDED` payment truth.
- C5.7 `ATTENDANCE_ADVISORY` note state `sentComment` as the existing review/comment completion authority.
- V2-2 student recurring-enrollment sets as schedule display authority.
- C5.1 Student edit workflow as the only schedule-edit navigation target.
- V2-5 Notification Center candidate/provider, read/seen presentation state, and center-currentness guards.
- Existing Attendance background-data lifecycle and confirmation behavior.

Missing authority:

- No cycle-scoped authoritative event records that TBHP was sent.
- Existing Attendance Board notes are student/month notes and cannot identify an exact attendance occurrence.

Minimal new authority:

- One additive forward migration, `202609140001_v2_8a_attendance_operational_hardening.sql`, for a cycle-scoped TBHP checkpoint, exact-occurrence cell notes, audit/idempotency support, and exact-center list/mutation RPCs.
- Reminder derivation remains server-backed and is returned by the same list RPC to both Attendance Board and Notification Center.
- No new schedule, attendance-state, package, or Finance authority is introduced.

Expected source scope:

- `supabase/migrations/202609140001_v2_8a_attendance_operational_hardening.sql`
- `src/cloud-authoritative-attendance-operations.js`
- `src/attendance-operational-reminders.js`
- `src/attendance-board-module.js`
- `src/attendance-theme.css`
- `src/notification-center.js`
- `src/module-authority-registry.js`
- `src/main.js`
- Targeted V2-8A smoke and local transactional DB QA files.
- This execution log.

`RoadmapRealTime.txt` remains ignored, local-only, and excluded from the RC commit.

## QA result

PASS.

- Migration SHA-256: `A8CF977A6539B9796EFFB29DE972D44519B9E0DD4EBD799FC3636F15F8131C0F`.
- Guarded transactional local DB QA passed against those exact migration bytes with N-5/N-4/N-3/N-2/rollover boundaries, Finance `POSTED/VOID`, Owner/Admin parity, unauthorized and cross-center denial, exact-occurrence note create/edit, attendance immutability, and residue `0`.
- The final migration checksum remained identical after browser work, so the passing DB QA was reused and not rerun.
- `node --check` passed for every changed JavaScript source/test file.
- `V2_8A_ATTENDANCE_OPERATIONAL_HARDENING_SMOKE: PASS`.
- `V2-5A Notification Center V1 smoke: PASS`.
- Directly affected V2-2/V2-3/V2-4 compatibility checks passed before the final browser-only renderer fix; that fix did not change their adapters, SQL, or authority boundaries, so they were not repeated.
- `npm run build`: PASS (149 modules; only the existing large-chunk advisory).
- Fresh authenticated browser session used process-only local Supabase overrides at `1536x728`; repository `.env.local` remained untouched and no production authentication occurred.
- Attendance and Notification Center both consumed the same eight V2-8A reminders. Vietnamese labels rendered correctly with no stale presentation from the discarded fixture session.
- Light and dark treatments passed for centered names, warning/danger states, reminder panel, exact-cell note context/modal, wider `310px` note surface, and background-data modal. The approved Figma `1536x730` versus app-shell `1536x728` difference was non-blocking.
- Multi-slot schedules rendered one weekday/time per line and navigated to canonical Student edit. Attendance did not gain a schedule-write path.
- Right-click exact-occurrence note read/edit passed. After save, the attendance cell remained `Bù` with unchanged cycle/title metadata.
- Background-data actions were absent from the primary table surface and all seven controls were contained by `Quản lý dữ liệu nền`.
- Currentness fail-closed check: pausing the disposable primary membership and reloading selected the fixture's empty exact center; unread count became `0` and no primary-center Attendance reminder rendered. Restoring membership restored the primary-center projection.
- Vite overlay: absent. Browser page errors: none. Console: Vite connection debug only.
- Disposable centers, memberships, users, entities, cycles, contributions, V2-8A checkpoints/notes/commands/audit rows: residue `0` after cleanup.
- Temporary browser fixture and generated screenshots were removed before staging.
- Push: no. Deploy: no. Production migration apply: no. Production mutation: `0`.
