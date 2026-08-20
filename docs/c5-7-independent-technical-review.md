# C5.7 independent technical review

Review date: 2026-08-20

Baseline: `main`, `HEAD = origin/main = f513091565447e771ebcca29fc8e1dab4e8a4b95`

Scope: Calendar + Operational Notes authoritative shared truth only

Verdict: **PASS — conditional checkpoint approved**

Open release findings: `CRITICAL=0`, `HIGH=0`, `blocking MEDIUM=0`.

This was a targeted adversarial review, not a full historical smoke sweep. C5 Closeout was not started. No remote Supabase/Auth/Edge/Storage/app apply or deploy was performed.

## Findings found and remediated

1. **HIGH — stale form writes could follow the newest projection version.** Calendar item/tag and Attendance Board note forms originally took `cloudVersion` from the projection at submit time. A form opened by A could therefore overwrite B after a background refresh. Forms now pin exact-center identity and base version when opened; save/delete sends that version and a stale command fails closed. Conflict state retains the original base version.
2. **Blocking MEDIUM — recurrence validation was not sufficiently closed at malformed/boundary inputs.** The additive hardening migration enforces strict JSON shape/types, unique weekdays, fixed Ho Chi Minh date semantics, a bounded `1..52` occurrence result, and rejection of zero-occurrence rules. It also corrects the recurrence helper without changing the frozen base migration.
3. **Blocking MEDIUM — a malformed live Student reference could enter a snapshot.** The list RPC now rejects the complete snapshot with `INVALID_SERVER_STATE` when an operational note does not resolve to a live exact-center C5.1 Student. It emits explicit reference proof, and the browser adapter independently validates that proof plus exact-center, duplicate, relation, recurrence, version, and field-shape invariants before installing any row.

All three findings are closed. Their affected local QA and regressions passed.

## Authority and duplication verdict

- Calendar tags/items are server-authoritative. Browser arrays are memory projections only; success is shown only after server commit and a complete authoritative pull.
- Custom Calendar accepts only `MEETING`, `EVENT`, `TOURNAMENT`, and `OTHER`. Class-like/schedule-like types and identity fields fail closed in both adapter and SQL. C5.1 Schedule/Class remains canonical.
- Calendar conflicts and recurrence occurrences remain derived; neither is persisted as a second writable truth.
- Blank, unresolved, unauthenticated, or membership-unbound center context clears/withholds the projection. There is no authoritative fallback to `dreamhome` and no default/fixture seed path to the server.
- Automatic Attendance warning/count values remain derived. Only manual advisory care state/note and the Attendance Board note are C5.7 shared authority.
- C5.7 notes reference a live exact-center canonical Student by `student_local_id`; Student profile, Attendance, Session Report, Tuition, class, Teacher, and Staff data are not copied.
- Tuition care-note ownership remains with the C5.1 canonical Student path. Attendance-to-Tuition comparison remains read-only/derived and does not update `usedSessions`.
- Report draft remains memory-only. There is no Save contract or C5.7 report authority.

## Currentness, isolation, and failure verdict

- Optimistic versions and entity/natural-key locking reject stale Calendar item, tag, and note edits. Actor/center-scoped idempotency returns the same committed result for an exact retry and rejects changed intent.
- Same-center A↔B reconstruction, a fresh context, cross-center leak `=0`, and Owner A→B→A isolation passed against the local database.
- Open/reopen, explicit surface open, center/role change, and manual refresh perform an authoritative pull. Old projections are cleared before async legacy inspection or network access.
- Denied, wrong-center, malformed, or partially invalid snapshots install nothing and remain unhealthy/withheld. One invalid row invalidates the whole snapshot.
- Mutations are server-first. A failed command cannot produce UI success; a committed command followed by refresh failure is reported as committed-but-unfresh rather than false success.
- Forced RLS and RPC-only grants protect all C5.7 tables; direct authenticated/service-role table access is revoked. Server-derived actor/membership/role/time evidence is retained without operational-note plaintext in audit state.

## Legacy verdict

The exact-center legacy keys for Calendar items, Calendar tags, advisory notes, and Attendance Board notes are inventoried before generic cleanup. Generic cleanup no longer edits or removes advisory notes.

Legacy content is never silently uploaded, merged, deleted, or treated as active authority. Nonempty real/uncertain data remains at its original exact-center key and gets a metadata-only, idempotent, recoverable `QUARANTINED_NOT_ACTIVE / MIGRATION_REQUIRED` manifest. Both combinations passed: server empty + legacy local, and server nonempty + legacy local. Controlled import remains **DEFERRED / MIGRATION REQUIRED**.

## Migration integrity

- Frozen base migration: `supabase/migrations/202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql`
- Base SHA-256: `C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167`
- Additive review hardening: `supabase/migrations/202608140011_c5_7_independent_review_recurrence_reference_hardening.sql`
- Hardening SHA-256: `DB628B00196EAAEA4DBB864DAFE9D6B0B1A8E47D2115AF865A387940EB9F7129`
- All 29 inherited migrations through C5.6 remained byte-identical to baseline.

## Targeted evidence

Passed:

```text
node tests/c5-7-calendar-operational-notes-authoritative-shared-truth-smoke.js
$env:ICHESS_C5_7_LOCAL_QA_ALLOW_RESET='YES'; node tests/c5-7-calendar-operational-notes-authoritative-shared-truth-local-db-qa.js
node tests/f23-5e1-conflict-warning-single-activity-local-safe-smoke.js
node tests/f23-5e2a-weekly-recurrence-create-virtual-occurrences-smoke.js
node tests/f23-5e2b-edit-delete-whole-weekly-series-smoke.js
node tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js
node tests/c5-2-attendance-tuition-authoritative-shared-truth-smoke.js
node tests/c5-6-inventory-authoritative-shared-truth-smoke.js
node tests/f19c2-bang-diem-danh-doc-du-lieu-diem-danh-hop-nhat-smoke.js
npm run build
git diff --check
```

The guarded database QA applied migrations through `202608140011`, exercised recurrence boundaries, stale concurrent edits, exact-center Student references, malformed live references, RLS/RPC isolation, idempotency, empty-server/no-seed behavior, fresh contexts, and Owner switches, then completed its final loopback reset.

## Checkpoint decision

C5.7 meets the checkpoint threshold. The approved next phase is **C5 CLOSEOUT**, which remains not started in this review.
