# C5.7 Calendar + Operational Notes authoritative shared truth

Implementation date: 2026-08-14

Status: **INDEPENDENT TECHNICAL REVIEW PASS — checkpoint approved**. Review findings were remediated inside C5.7 and affected QA passed. No remote Supabase/Auth/Edge/Storage/app apply or deploy was performed.

## Physical truth and root cause removed

Custom Calendar items/tags and the Attendance advisory/board notes were durable browser `localStorage` collections. Writes updated an in-browser array and persisted it without a server commit, while the Calendar storage normalizer could fall back to `dreamhome` for a missing center. Two accounts in one center therefore owned different durable Calendar/Notes truth, and an invalid center context risked reading/writing a default-center key.

C5.7 initializes these active projections empty. A signed-in bootstrap, exact-center switch, module open/reopen, or manual `Làm mới` clears the old projection and pulls a complete exact-center snapshot. Mutations follow command → server commit → complete authoritative pull → memory projection → UI success. Missing membership-bound `center_id`, denied/malformed responses, or refresh failure leave the projection withheld and marked unhealthy; no stale/partial collection is presented as fresh.

## Authoritative scope

- `center_calendar_tags_authoritative`: versioned custom Calendar tags and active/archive currentness.
- `center_calendar_items_authoritative`: versioned custom meetings/events/tournaments/other items, cancellation/archive state, and validated weekly recurrence.
- `center_operational_attendance_notes`: versioned human-entered Attendance advisory note/manual care status and Attendance Board note, keyed by exact-center canonical Student reference and month.
- `center_calendar_notes_audit_events`: immutable server actor/membership/role/time evidence. Operational-note text is excluded; only length and SHA-256 are retained in audit state.
- `center_calendar_notes_command_results`: actor/center-scoped idempotency intent digest and committed result snapshot.

Calendar conflict results remain derived by `center-calendar-conflicts.js`; recurrence expansion remains derived from the stored validated rule. No conflict row or recurrence occurrence becomes a second writable truth.

## Authority boundaries

C5.1 Schedule/Class Session remains canonical. C5.7 accepts only `MEETING`, `EVENT`, `TOURNAMENT`, and `OTHER`; it stores no class/schedule identity, participants, Teacher, Staff, or copied Student profile. A Calendar item cannot bind `linkedSessionId`, `linkedClassSessionId`, `participantIds`, `teacherIds`, or `staffIds` through the adapter or SQL schema.

Operational notes store only an exact-center `student_local_id`; the mutation RPC verifies a live C5.1 canonical Student in `center_cloud_entities`. Names, phones, Tuition records, Attendance records, and Session Reports are not duplicated.

Tuition embedded care notes already save through C5.1 canonical Student via `commitStudentProjection`, so C5.7 does not create another Tuition/Student note authority. Derived Tuition/Attendance warnings and counts remain derived. `reportState.draft` has no saved-business-state action in the current UI; it remains an unsaved in-memory editor draft. C5.7 therefore creates no Report task/problem/assignee table. Notification Center/read-state and system-wide Report dashboards remain out of scope.

## ACL, isolation, conflict safety

All five C5.7 tables use forced RLS and direct privileges are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Only authenticated RPC entry points are granted. Active recognized exact-center members may read; only `owner`, `admin`, `center_admin`, and `qtv` may write. Teacher/consultant/viewer writes fail closed.

Every mutation derives actor identity from `auth.uid()` plus active membership, validates `expected_version`, serializes the entity/natural-key race, and scopes the idempotency record by center and actor. Exact retry returns the committed result; changed intent returns `IDEMPOTENCY_CONFLICT`; stale concurrent writes return `VERSION_STALE`/`CONCURRENT_CONFLICT`. There is no direct browser table write or delete path.

## Legacy safety

Inventoried exact-center keys:

- `ichessCenterOS.centerCalendarItems.<center>`
- `ichessCenterOS.centerCalendarTags.<center>`
- `ichessCenterOS.attendanceAdvisoryNotes.<center>`
- `ichessCenterOS.attendanceBoardNotes.<center>`

Absent/empty state is `RECONSTRUCTABLE_CACHE`; Attendance-note rows with exact known fixture provenance are `FIXTURE_SAMPLE`; non-empty Calendar or non-fixture note collections are `REAL_LOCAL_ONLY`; malformed state is `UNCERTAIN`. Calendar content is never guessed to be a fixture by title/date. The former generic legacy cleanup no longer touches `attendanceAdvisoryNotes` before C5.7 inventory.

Real/uncertain data remains recoverable in its original exact-center key and receives an idempotent metadata-only `QUARANTINED_NOT_ACTIVE / MIGRATION_REQUIRED` manifest. The manifest holds key, byte length, shape/count/schema versions, and SHA-256; it contains no raw note, Student, or Calendar payload. Source drift fails closed. There is no upload/merge or `removeItem` path. Empty and non-empty server snapshots never import or union local legacy. Controlled import is **DEFERRED / MIGRATION REQUIRED** and must later require preview, authorized confirmation, exact-center scope, idempotency, and conflict handling.

## Migration

- Base additive migration: `supabase/migrations/202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql`
- Base SHA-256: `C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167`
- Independent-review hardening migration: `supabase/migrations/202608140011_c5_7_independent_review_recurrence_reference_hardening.sql`
- Hardening SHA-256: `DB628B00196EAAEA4DBB864DAFE9D6B0B1A8E47D2115AF865A387940EB9F7129`
- All 29 inherited migrations through C5.6 are byte-identical to `HEAD`.

## Targeted evidence

- Guarded local reset applied every migration through C5.7, then final-reset the loopback DB.
- Schema: forced RLS, RPC-only tables, no duplicated Student/class/session identity columns, no DreamHome/sample rows.
- Same-center: A creates Calendar/tag/note and B/fresh client reconstructs; B edits and A reads current truth.
- Isolation: different-center read/write denied; Owner A→B→A returns A-only/B-empty/A-only; direct table read denied; teacher write denied.
- Currentness: stale two-account Calendar edit and note race allow one winner only; retry does not duplicate; changed retry intent conflicts.
- References/audit: wrong-center Student reference is denied; actor fields are server-generated; operational note plaintext is absent from audit state.
- Failure/projection: client network error returns `SERVER_COMMAND_FAILED`; malformed/wrong-center row rejects the whole snapshot; runtime clears old projection before pull and installs arrays only after a complete valid response.
- Legacy combinations: server empty/non-empty remains authoritative; real/uncertain local data remains exact-center, recoverable, quarantined, and inactive.

Targeted commands:

```text
node tests/c5-7-calendar-operational-notes-authoritative-shared-truth-smoke.js
$env:ICHESS_C5_7_LOCAL_QA_ALLOW_RESET='YES'; node tests/c5-7-calendar-operational-notes-authoritative-shared-truth-local-db-qa.js
node tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js
node tests/c5-2-attendance-tuition-authoritative-shared-truth-smoke.js
node tests/c5-6-inventory-authoritative-shared-truth-smoke.js
npm run build
```
