# C5 Closeout — Derived Convergence + System-wide Acceptance

Date: 2026-08-20
Baseline: `main`, `HEAD = origin/main = 53c014f9b2fb7691f29972fa2595f20467579e97`
Result: **LOCAL QA PASS / AWAITING INDEPENDENT TECHNICAL REVIEW / FINAL C5 CHECKPOINT**

This implementation closes the local C5 system-wide convergence work only. It does not mark C5 DONE, start a new authority phase, resume P4B, apply remote Supabase/Auth/Edge/Storage changes, deploy the app, commit, or push.

## 1. Blocking findings and remediation

| Finding | Severity before fix | Remediation | Result |
|---|---:|---|---|
| C5.3 startup/reload called `clearStoredParentConsultations()` and generic Angel Wings cleanup included CRM, so real/uncertain legacy CRM could be deleted before preservation | HIGH / blocking | CRM browser writes/deletes are now non-destructive compatibility shims; generic cleanup excludes `parentConsultations`; first authoritative CRM pull creates an exact-center metadata-only quarantine manifest while retaining the original source bytes | Resolved |
| C5.1/C5.2/C5.3 snapshot projection could skip or normalize one malformed row and still apply the rest as authoritative | HIGH / blocking | Core, Schedule, Attendance, Tuition and CRM pulls now reject the entire snapshot on any wrong center/type/local identity/version/payload row; no partial replacement occurs | Resolved |
| Business modules refreshed unevenly; several derived surfaces could reopen on an old projection without an explicit freshness state | MEDIUM / blocking | Added a 14-module authority registry, targeted upstream coordinator, per-module open/reopen/manual refresh, in-flight deduplication and visible loading/fresh/failed state | Resolved |
| Report/Settings and user-facing module metadata still contained DreamHome/planned/local-cache wording | MEDIUM / blocking | Canonical active-center identity is required; unresolved center hides business data; Report/Settings use neutral unresolved labels; 13 implemented modules are marked active | Resolved |
| Runtime still initialized deterministic students/teachers/classes/schedule/tuition/notification samples | MEDIUM / blocking | Removed runtime sample fallbacks and sample notification injection; deterministic notification cleanup removes exact fixture signatures only | Resolved |
| The C5.1 Student list still appended a P4B `sessionStorage` conversion projection | MEDIUM / blocking | Student business rows now come only from the C5.1 authoritative projection; the frozen-P4B envelope remains cache-only and cannot add a Student row | Resolved |

Final threshold: CRITICAL=0, HIGH=0, blocking MEDIUM=0.

## 2. Fourteen-module authority and refresh audit

| Module | Authoritative source | Derived source | Remaining local state | Open/reopen + manual refresh | Center behavior |
|---|---|---|---|---|---|
| Học viên | C5.1 Student | — | cache projection + transient filters/forms | `core` | exact center; unresolved hidden |
| Phụ huynh / Tư vấn | C5.3 CRM | C5.1 Student reference | masked memory projection; legacy source quarantined | `core + crm` | A/B same-center; cross-center denied |
| Giáo viên | C5.1 Teacher | Schedule, Attendance/Session Report, C5.5 Staff link | cache projection + transient UI | `core + attendance + staff` | exact center |
| Nhân viên | C5.5 Staff/HR | Teacher, Schedule, Attendance/Session Report summaries | memory projection + transient sensitive UI | `staff + core + attendance` | exact center; account switch clears projection |
| Thời khóa biểu | C5.1 Schedule/Class; C5.7 custom Calendar | attendance, recurrence and conflict views | C5.1 cache; C5.7 memory projection | `core + attendance + calendar-notes` | exact center |
| Học phí | C5.2 Tuition | Student, Attendance, Finance ledger, C5.7 manual advisory | cache projection + transient forms | `core + attendance + tuition + finance + calendar-notes` | exact center |
| Nhóm Tài chính | — | C5.4 Finance/Cashbook wrapper | transient selected child only | `finance` | exact center; no new storage/authority |
| Thu chi | C5.4 Finance | — | memory projection + transient forms/attachments | `finance` | exact center |
| Sổ quỹ | C5.4 Cashbook | Finance ledger totals | memory projection + transient forms | `finance` | exact center |
| Kho hàng | C5.6 Inventory | C5.1 Student references | memory projection + transient forms | `inventory + core` | exact center |
| Báo cáo | — | Student + Attendance + Finance | `reportState.draft` memory-only unsaved editor state | `core + attendance + finance` | exact center; center switch resets draft |
| Cài đặt cơ sở | — | canonical active center + Class/Student + Tuition package | transient tab/filter/form state | `core + tuition` | no DreamHome fallback |
| Bảng điểm danh | — | Student/Class/Schedule + Attendance/Baseline/Session Report/Tuition | projection caches + transient draft; C5.7 manual board note authoritative | `core + attendance + tuition + calendar-notes` | exact center |
| Đang cập nhật | none | none | transient placeholder | none / N/A | N/A |

The coordinator refreshes only the upstreams listed for that surface, not the whole OS. A failed, denied, malformed, or superseded pull leaves the visible data explicitly marked as an unverified projection, never fresh. Blank/unresolved membership renders no business projection and cannot fall back to DreamHome.

## 3. Derived convergence decisions

- Attendance Board remains derived. Automatic attendance warning/count is derived; only C5.7 manual advisory care/note and Attendance Board note are shared authority.
- Report remains derived from exact-center Student, Attendance and Finance projections. Its editor draft has no Save contract and remains memory-only.
- Settings center identity comes only from canonical active-center binding. Class and tuition-package summaries are derived.
- Finance Group remains a wrapper; it adds no storage, merge logic or second authority.
- Staff attendance/summary views derive from C5.5 Staff plus C5.1 Teacher/Schedule and C5.2 Attendance/Session Report.
- Notification candidates derive from authoritative Tuition, Inventory and CRM projections. Exact sample notifications are retired and cannot masquerade as business truth. Read/dismiss state is browser-personal.
- `modules.js` now reflects the 13 implemented business modules as active. The placeholder remains non-business.

## 4. Complete browser-storage registry

Registry totals: 42 key patterns. `ACTIVE_AUTHORITY=0`, `CACHE_PROJECTION=12`, `PERSONAL_UI_STATE=3`, `QUARANTINED_NOT_ACTIVE=27`. There are no browser keys classified as `UNSAVED_DRAFT`, `FIXTURE_SAMPLE`, `REAL_LOCAL_ONLY`, `UNCERTAIN`, or `DEPRECATED_EMPTY`; those classes remain explicit for runtime payload classification. The Report draft is an `UNSAVED_DRAFT` in memory, not a storage key. A legacy source payload is classified `UNCERTAIN` or `DEPRECATED_EMPTY` inside its quarantine evidence.

| # | Key/pattern | Classification | Meaning |
|---:|---|---|---|
| 1 | `ichess-center-os:view-mode` | PERSONAL_UI_STATE | desktop preference |
| 2 | `ichess-center-os:desktop-module-order` | PERSONAL_UI_STATE | desktop ordering |
| 3 | `ichessCenterOS.students.<center>` | CACHE_PROJECTION | C5.1 Student cache |
| 4 | `ichessCenterOS.classSessions.<center>` | CACHE_PROJECTION | C5.1 Class cache |
| 5 | `ichessCenterOS.notifications.<center>` | CACHE_PROJECTION | derived candidates plus personal read markers |
| 6 | `ichessCenterOS.notifications.version.<center>` | CACHE_PROJECTION | projection schema marker |
| 7 | `ichessCenterOS.notifications.deletedIds.<center>` | PERSONAL_UI_STATE | dismiss state |
| 8 | `ichessCenterOS.tuition.<center>` | CACHE_PROJECTION | C5.2 Tuition cache |
| 9 | `ichessCenterOS.teachers.<center>` | CACHE_PROJECTION | C5.1 Teacher cache |
| 10 | `ichessCenterOS.centerStaffMembers.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy |
| 11 | `ichessCenterOS.centerStaffAdministrativeProfiles.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy HR |
| 12 | `ichessCenterOS.centerStaffDocuments.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy document metadata |
| 13 | `ichessCenterOS.centerStaffAdministrativeAuditEvents.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy audit |
| 14 | `ichessCenterOS.centerStaffAdministrativeRetentionPolicies.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy retention |
| 15 | `ichessCenterOS.centerStaffAdministrativeDeletionRequests.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy deletion request |
| 16 | `ichessCenterOS.centerDepartments.<center>` | QUARANTINED_NOT_ACTIVE | C5.5 legacy department |
| 17 | `ichessCenterOS.schedule.<center>` | CACHE_PROJECTION | C5.1 Schedule cache |
| 18 | `ichessCenterOS.sessionReports.<center>` | CACHE_PROJECTION | C5.2 Session Report cache |
| 19 | `ichessCenterOS.attendanceAdvisoryNotes.<center>` | QUARANTINED_NOT_ACTIVE | C5.7 legacy advisory source |
| 20 | `ichessCenterOS.attendanceBoardNotes.<center>` | QUARANTINED_NOT_ACTIVE | C5.7 legacy board-note source |
| 21 | `ichessCenterOS.parentConsultations.<center>` | QUARANTINED_NOT_ACTIVE | C5.3 legacy CRM retained in place |
| 22 | `ichessCenterOS.cashflow.<center>` | QUARANTINED_NOT_ACTIVE | C5.4 legacy Finance |
| 23 | `ichessCenterOS.cashflowCategories.<center>` | QUARANTINED_NOT_ACTIVE | C5.4 legacy categories |
| 24 | `ichessCenterOS.cashbookSettings.<center>` | QUARANTINED_NOT_ACTIVE | C5.4 legacy settings |
| 25 | `ichessCenterOS.cashbookReconciliations.<center>` | QUARANTINED_NOT_ACTIVE | C5.4 legacy reconciliation |
| 26 | `ichessCenterOS.inventory.<center>` | QUARANTINED_NOT_ACTIVE | C5.6 legacy item |
| 27 | `ichessCenterOS.inventoryMovements.<center>` | QUARANTINED_NOT_ACTIVE | C5.6 legacy movement |
| 28 | `ichessCenterOS.inventoryRequests.<center>` | QUARANTINED_NOT_ACTIVE | C5.6 legacy request |
| 29 | `ichessCenterOS.attendanceRecords.<center>` | CACHE_PROJECTION | C5.2 Attendance cache |
| 30 | `ichessCenterOS.attendanceBaselineState.<center>` | CACHE_PROJECTION | C5.2 Baseline cache |
| 31 | `ichessCenterOS.tuitionPackages.<center>` | CACHE_PROJECTION | C5.2 Tuition package bridge |
| 32 | `ichessCenterOS.centerCalendarItems.<center>` | QUARANTINED_NOT_ACTIVE | C5.7 legacy Calendar |
| 33 | `ichessCenterOS.centerCalendarTags.<center>` | QUARANTINED_NOT_ACTIVE | C5.7 legacy tag |
| 34 | `ichessCenterOS.c5_4.legacyFinanceSnapshot.<center>.v1` | QUARANTINED_NOT_ACTIVE | recoverable Finance snapshot |
| 35 | `ichessCenterOS.c5_5.legacyStaffHrManifest.<center>.v1` | QUARANTINED_NOT_ACTIVE | Staff/HR manifest |
| 36 | `ichessCenterOS.c5_6.legacyInventoryManifest.<center>.v1` | QUARANTINED_NOT_ACTIVE | Inventory manifest |
| 37 | `ichessCenterOS.c5_7.legacyCalendarNotesManifest.<center>.v1` | QUARANTINED_NOT_ACTIVE | Calendar/Notes manifest |
| 38 | `ichessCenterOS.c5_closeout.legacyCoreAttendanceSnapshot.<center>.v1` | QUARANTINED_NOT_ACTIVE | immutable first-seen C5.1/C5.2 raw bytes |
| 39 | `ichessCenterOS.c5_closeout.legacyCrmManifest.<center>.v1` | QUARANTINED_NOT_ACTIVE | metadata-only CRM manifest |
| 40 | `ichessCenterOS.backup.beforeCloudPull.<timestamp>` | QUARANTINED_NOT_ACTIVE | bounded C5.1 pull backup |
| 41 | `ichessCenterOS.backup.beforeAttendanceRecordPull.<timestamp>` | QUARANTINED_NOT_ACTIVE | C5.2 pull backup |
| 42 | `ichess.crmConversionProjection.v1:<center>:<sourceRecord>` (`sessionStorage`) | CACHE_PROJECTION | P4B-frozen server status/idempotency envelope; excluded from the Student business list |

## 5. Legacy preservation outcomes

- C5.1/C5.2: before any getter normalization, Angel Wings cleanup, authoritative replacement, or server write, one exact-center immutable snapshot captures raw bytes for Student, Teacher, Class, Schedule, Attendance, Baseline, Session Report, Tuition and Tuition Package. Malformed bytes are retained verbatim.
- C5.3: the original CRM key remains in place. The manifest stores only key, digest, byte length, shape and row count; it duplicates no phone/email payload. Source drift after quarantine blocks the pull. The generic cleanup no longer touches CRM or advisory notes.
- C5.4–C5.7: accepted exact-center quarantine behavior remains active and non-authoritative.
- Server empty + legacy local: server empty is authoritative; legacy remains recoverable quarantine and is not uploaded or deleted.
- Server nonempty + legacy local: server snapshot is authoritative; legacy remains recoverable quarantine and is not merged/unioned/uploaded/deleted.
- Fixture cleanup is signature-exact. Reusing a fixture ID alone cannot delete a real notification.

## 6. Acceptance evidence

Targeted commands:

```text
node tests/c5-closeout-derived-convergence-smoke.js
node tests/c5-closeout-legacy-local-preservation-audit.js
node tests/c5-2-attendance-tuition-authoritative-shared-truth-smoke.js
node tests/c5-4-finance-cashbook-authoritative-shared-truth-smoke.js
node tests/c5-5-staff-hr-authoritative-shared-truth-smoke.js
node tests/c5-6-inventory-authoritative-shared-truth-smoke.js
node tests/c5-7-calendar-operational-notes-authoritative-shared-truth-smoke.js
npm run build
ICHESS_C5_CLOSEOUT_LOCAL_QA=YES node tests/c5-closeout-system-wide-multi-account-local-db-qa.js
```

Results:

- Derived convergence smoke: PASS.
- Legacy preservation audit: PASS.
- Affected C5.2 and C5.4–C5.7 targeted authority smokes: PASS; no full historical sweep was run.
- Vite production build: PASS (existing bundle-size warning only).
- Compact guarded local DB acceptance, no initial reset and no remote reference:
  - A/B same center + fresh B context across C5.1–C5.7: PASS.
  - C different center, cross-center leak=0: PASS.
  - Owner center-one → center-two → center-one: PASS.
  - A single final local reset cleaned synthetic users/centers. Because reset recreated the DB container, the first post-check held the old container ID; the harness now rediscovers it. A separate guarded read-only verification confirmed `centers=0`, `users=0`, `migrations=12`. Acceptance/reset was not repeated.
- Base C5.7 migration SHA-256 remains `C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167`.
- No inherited migration was edited and no new migration was required.

## 7. Explicit exclusions and next gate

- No full historical smoke sweep.
- No seven-suite heavy DB rerun.
- No remote Supabase/Auth/Edge/Storage/app apply or deploy.
- No commit or push in this implementation turn.
- C5 DONE remains NO until independent technical review/final checkpoint.
- P4B remains FROZEN / NOT DONE.
- Full historical C3/C4/C6 roadmap reconciliation waits until the final C5 checkpoint.
- POST-C5 KNOWN ISSUE: visible Sổ quỹ banner `Cloud DB C2.2 readiness`. It was recorded only and was not diagnosed or fixed in this turn. Remote production readiness remains a separate later gate.

Next: **INDEPENDENT TECHNICAL REVIEW / FINAL C5 CHECKPOINT**. Only after that checkpoint passes: **FULL ROADMAP RECONCILIATION → F23.3E-P4B**.
