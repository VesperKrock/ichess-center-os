# C5 Closeout Independent Technical Review and Final Checkpoint

Date: 2026-08-20
Branch: `main`
Reviewed baseline: `53c014f9b2fb7691f29972fa2595f20467579e97`
Remote production: **NOT APPLIED / NOT DEPLOYED**

## Verdict

**PASS** after one minimal fail-closed remediation.

| Severity | Open findings |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 0 |
| Blocking MEDIUM | 0 |

The current C5 Closeout change set satisfies the checkpoint threshold. C5.0-C5.7 remain complete, P4B remains frozen/not done, and no new module-authority phase was opened.

## Independent review scope

The review used the repository diff and executable contracts as source of truth rather than relying on the implementation report. It covered:

- all 14 registry modules and their authoritative/derived boundaries;
- open, reopen and manual targeted refresh, including failure freshness;
- exact-center isolation and center-context invalidation;
- browser-storage enumeration and classification;
- legacy preservation, especially C5.1, C5.2 and C5.3;
- Report, Settings, Notification Center and Student/P4B boundaries;
- inherited migration immutability and the physical local Roadmap;
- compact guarded multi-account acceptance against local Supabase only.

No UI/Figma work, P4B work, remote Supabase/Auth/Edge/Storage apply, or app deployment was performed.

## Finding and remediation

| Finding | Initial severity | Remediation | Re-review |
| --- | --- | --- | --- |
| Generic legacy dataset cleanup normalized a blank or malformed center to `dreamhome`, so a direct unresolved-context call could inspect and mutate the wrong storage namespace. | MEDIUM / blocking | `cleanupLegacyDatasetLocalResidue` now requires a strict non-empty center identifier, returns `INVALID_CENTER_CONTEXT` otherwise, and performs zero writes. A regression test proves blank and malformed inputs leave both `dreamhome` and similarly normalized namespaces unchanged. | Resolved; targeted legacy preservation audit PASS |

No migration change was needed. No inherited or frozen migration was edited.

## Fourteen-module authority and convergence verdict

| Module | Authority / derived boundary | Targeted authoritative refresh | Verdict |
| --- | --- | --- | --- |
| Học viên | C5.1 Student authority | `core` | PASS |
| Phụ huynh / Tư vấn | C5.3 CRM authority; Student reference derived | `core + crm` | PASS |
| Giáo viên | C5.1 Teacher authority; Schedule, Session Report and Staff link derived | `core + attendance + staff` | PASS |
| Nhân viên | C5.5 Staff/HR authority; Teacher/Schedule/Attendance references derived | `staff + core + attendance` | PASS |
| Thời khóa biểu | C5.1 Schedule/Class and C5.7 custom Calendar authority; conflict/recurrence derived | `core + attendance + calendar-notes` | PASS |
| Học phí | C5.2 Tuition authority; Student/Attendance/Finance/manual advisory references derived | `core + attendance + tuition + finance + calendar-notes` | PASS |
| Nhóm Tài chính | Derived wrapper over C5.4 | `finance` | PASS |
| Thu chi | C5.4 Finance authority | `finance` | PASS |
| Sổ quỹ | C5.4 Cashbook authority; Finance ledger derived | `finance` | PASS |
| Kho hàng | C5.6 Inventory authority; Student reference derived | `inventory + core` | PASS |
| Báo cáo | Derived from Student, Attendance and Finance | `core + attendance + finance` | PASS |
| Cài đặt cơ sở | Derived from canonical active center, Class/Student and Tuition packages | `core + tuition` | PASS |
| Bảng điểm danh | Derived from C5.1/C5.2 plus C5.7 manual notes | `core + attendance + tuition + calendar-notes` | PASS |
| Đang cập nhật | Non-business placeholder; transient view only | none | PASS |

Every business module resets its freshness state on open/reopen and performs only the upstream pulls listed above. Manual `Làm mới` uses the same coordinator. A failed, denied, malformed, stale-run, or center-superseded refresh cannot set `fresh`; any retained projection is explicitly marked unverified. Blank/unresolved canonical context hides business content and returns `INVALID_CENTER_CONTEXT`.

## Exact-center and snapshot integrity

- Core, Schedule, Attendance, Tuition and CRM snapshot adapters validate the whole response before applying it. A single wrong-center, wrong-type, malformed-version, invalid-local-id or malformed-payload row rejects the snapshot atomically; no partial truth is applied.
- C5.4-C5.7 retain their accepted exact-center, version/currentness and fail-closed contracts.
- Center/account switches invalidate in-flight refresh runs, stop old realtime subscriptions, clear memory-only projections and transient Report state, select the exact center storage namespace, then bootstrap authoritative upstreams.
- The compact DB acceptance independently proved A/B same-center convergence, a fresh B browser context, C cross-center leak=0, and Owner center-one → center-two → center-one across representative C5.1-C5.7 waves.

## Browser-local authority and legacy preservation

All browser storage references were enumerated from source and reconciled with the 42-pattern registry. No source key builder remains unclassified.

| Classification | Count |
| --- | ---: |
| ACTIVE_AUTHORITY | 0 |
| CACHE_PROJECTION | 12 |
| PERSONAL_UI_STATE | 3 |
| UNSAVED_DRAFT | 0 |
| FIXTURE_SAMPLE | 0 |
| REAL_LOCAL_ONLY | 0 |
| UNCERTAIN | 0 active registry entries |
| QUARANTINED_NOT_ACTIVE | 27 |
| DEPRECATED_EMPTY | 0 |

`reportState.draft` is memory-only unsaved editor state, so it creates no browser-storage key. Notification candidates are rebuilt from authoritative upstream projections; notification read/deleted state remains browser-personal UI state. Sample notifications do not enter business truth.

Legacy conclusions:

- C5.1/C5.2 preserve exact-center raw bytes for nine scopes before cleanup or authoritative replacement. The snapshot is quarantined, recoverable, non-authoritative, idempotent, and never auto-uploaded.
- C5.3 writes only a metadata/integrity manifest. The protected CRM payload remains in its original exact-center key, is not duplicated, uploaded, or deleted, and source drift fails closed as `LEGACY_SOURCE_DRIFT`. Malformed bytes are classified uncertain and retained.
- Generic fixture cleanup is center-strict after remediation, targets only exact legacy provenance, and does not include CRM, advisory notes, or Attendance Board notes.
- C5.4-C5.7 legacy finance, Staff/HR, Inventory, Calendar and Notes sources remain recoverable/quarantined and non-authoritative under their accepted contracts.

Any later legacy import is a separate explicit, reviewed migration. This checkpoint authorizes neither silent upload nor silent delete.

## Stale-truth surfaces

- Report uses the canonical active center name/id and has no DreamHome or local/cloud/cache business-source fallback. Download/print identity is exact-center. There is no Save contract and no browser persistence for the draft.
- Settings derives center identity from canonical active center and authoritative projections, with no DreamHome fallback.
- Student displays only the C5.1 authoritative projection; the frozen P4B `sessionStorage` envelope cannot add Student rows.
- Notification Center refreshes `core + crm + tuition + inventory`, derives candidates, and exposes failed freshness rather than presenting old candidates as fresh.
- User-facing module metadata no longer marks completed business modules as planned or in progress.

The visible Sổ quỹ banner `Cloud DB C2.2 readiness` remains an explicit **POST-C5 KNOWN ISSUE**. It was not diagnosed or changed in this checkpoint. Production readiness remains a separate later gate.

## Migration and QA evidence

- `git diff -- supabase/migrations`: empty; no inherited migration bytes changed.
- C5.7 authoritative migration SHA-256: `C1C9EACF39548E977CB2C09165CA6AC9DFCD156C4A3EACD4C1951F92933F8167`.
- `node tests/c5-closeout-derived-convergence-smoke.js`: PASS.
- `node tests/c5-closeout-legacy-local-preservation-audit.js`: PASS after remediation.
- `npm run build`: PASS; existing bundle-size advisory only.
- Guarded local DB acceptance: PASS for A/B same-center plus fresh context, C cross-center leak=0, and Owner A→B→A. The harness rejected remote references, used loopback endpoints only, performed one final local cleanup reset, and verified synthetic users/centers were zero afterward.
- `git diff --check`: PASS apart from informational line-ending conversion warnings.

No full historical smoke sweep or repeated reset loop was run.

## Final checkpoint decision

C5 Closeout is independently accepted. C5 is DONE locally and the next permitted work item is **FULL ROADMAP RECONCILIATION**. Remote production remains not applied/not deployed.
