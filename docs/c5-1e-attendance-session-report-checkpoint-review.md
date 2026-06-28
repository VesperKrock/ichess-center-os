# C5.1E - Attendance / Session Report Checkpoint Review

## Summary

C5.1E tổng kết C5.1 Điểm danh/Báo cáo ca dạy realtime sau các phase C5.1A/B/C/D/D.1/D.2/D.3. Đây là checkpoint review trước khi sang C5.2 planning/preflight.

Không SQL, không runtime mới, không Supabase manual action, không C5.2 implementation, không commit/push.

## C5.1 Timeline

| Phase | Purpose | Result | Files/docs | Status |
| --- | --- | --- | --- | --- |
| C5.1A | Thiết kế chi tiết Điểm danh/Báo cáo ca dạy realtime | Chốt canonical model, read/write path, realtime subscription, conflict rules | `docs/c5-1a-attendance-session-report-realtime-design-runbook.md` | PASS |
| C5.1B | Manual SQL apply pack/backend readiness | Tạo SQL/runbook để user tự review/apply, CodeX không apply SQL | `docs/supabase-c5-1b-attendance-session-report-manual-sql-apply-pack.md` | PASS |
| C5.1B-Apply | User manually applies SQL after review | User confirmed allowlist/realtime/replica identity/helper functions ready | Supabase manual action by user | PASS by user report |
| C5.1C | Runtime guarded realtime implementation | Thêm guarded realtime cho `attendance_record`, `attendance_baseline_state`, `session_report` | `src/cloud-attendance-realtime.js`, `src/main.js` | PASS smoke |
| C5.1D | Two-browser QA/checkpoint docs | Khóa checklist QA, phát hiện TKB mismatch ngoài attendance path | `docs/c5-1d-two-browser-qa-checkpoint-review.md` | PASS docs/smoke |
| C5.1D.1 | TKB cloud parity + Supabase 400 hotfix | Sửa readiness/fallback `schedule_session`, không còn báo Cloud giả khi cloud schedule trống | `docs/c5-1d-1-cloud-parity-tkb-400-hotfix.md` | PASS smoke |
| C5.1D.2 | Manual schedule_session backfill helper | Tạo helper dry-run/apply thủ công, admin-only, confirm token | `src/cloud-schedule-session-backfill.js` | PASS smoke |
| C5.1D.3 | Fix backfill C2 scope guard | Cho `schedule_session` đi qua schedule-specific path, preview đúng visible TKB | `docs/c5-1d-3-fix-schedule-backfill-c2-scope-guard.md` | PASS smoke |
| C5.1E | Checkpoint review | Tổng kết trạng thái, rủi ro, manual QA, recommendation | `docs/c5-1e-attendance-session-report-checkpoint-review.md` | CURRENT |

## Backend Readiness Status

- `center_cloud_entities` allowlist now supports:
  - `attendance_record`
  - `attendance_baseline_state`
  - `session_report`
  - `schedule_session`
- Supabase realtime publication: `center_cloud_entities` present.
- Replica identity: FULL.
- Helper functions: `can_write_center`, `is_center_member`.
- C5.1B SQL was applied manually by user. CodeX did not apply SQL.

## Schedule_session Backfill Status

- Source browser: T.
- Source data: Angel Wings 8 ca.
- Dry-run:
  - `candidateCount: 8`
  - `eligibleCandidateCount: 8`
  - `visibleWeekCandidateCount: 8`
  - `wouldUpsert: 8`
  - `cloudExistingCount: 0`
- Apply:
  - `upserted: 8`
  - `errors: 0`
- Manual QA:
  - Reload shows TKB Angel Wings 8 ca.
  - Taskbar shows `Dữ liệu: Cloud`.
  - No longer local fallback schedule_session trống.

## Runtime Status

| Area | Runtime behavior | Status | Notes |
| --- | --- | --- | --- |
| `attendance_record` | Cloud bridge + guarded realtime + local cache/fallback | READY FOR ALPHA QA | Admin/center-admin write path only |
| `attendance_baseline_state` | Baseline state sync guarded by C5.1 role/readiness | READY FOR ALPHA QA | Supports chốt nền state across Cloud |
| `session_report` | Session report cloud entity guarded through C5.1 bridge | READY FOR ALPHA QA | No teacher direct write expansion |
| `schedule_session` | C4 schedule realtime retained; D.1-D.3 fixed cloud parity/backfill | READY AFTER BACKFILL | User applied 8 Angel Wings records |
| bootstrap/pull | Cloud source when signed-in/ready; local fallback remains | READY WITH FALLBACK | Does not delete local cache |
| realtime subscription | `center_cloud_entities` subscription for allowed C5.1 entities | READY | Requires realtime publication |
| write-through | Write-through only when role/readiness allows | GUARDED | No broad sync-all |
| role guard | owner/qtv/center_admin/admin writes; teacher/consultant held | READY | Teacher/consultant HOLD remains |
| teacher/consultant HOLD | Direct cloud write is intentionally blocked | HOLD | Needs later policy/design |
| updatedAt merge | Newer cloud payload wins where supported | READY WITH LIMITATIONS | Not a full conflict UI |
| soft delete | Runtime avoids hard delete | READY WITH LIMITATIONS | Full rollback/audit later |
| duplicate prevention | Entity local_id/stable key prevents obvious duplicates | READY WITH LIMITATIONS | Conflict UX deferred |
| conflict marker | Basic markers/docs exist; no full UI | PARTIAL | C5.3 candidate |
| local fallback | LocalStorage remains cache/fallback when cloud unavailable | READY | Important for alpha safety |

## Manual QA Status

| Case | Expected | Observed | Status | Notes |
| --- | --- | --- | --- | --- |
| Module 13 bootstrap | Existing attendance/baseline can load without crash | User reported Module 13/Bảng điểm danh sync after chốt nền was temporarily OK | PARTIAL PASS | Needs one more two-browser retry after final checkpoint |
| Module 13 new save/chốt nền sync | Save/chốt nền propagates through Cloud for allowed role | C5.1C smoke passes; user earlier saw sync acceptable | NOT FULLY TESTED | Need exact two-browser checklist before C5.2 |
| TKB parity after backfill | Two browsers show same Angel Wings 8 ca | User applied backfill `upserted: 8`; reload shows Angel Wings 8 ca from Cloud | PASS |
| TKB cloud source after reload | Taskbar shows Cloud, not local fallback schedule empty | User observed `Dữ liệu: Cloud` | PASS |
| Học phí isolation | Attendance/TKB does not mutate Học phí/TBHP source of truth | Smoke guards no `usedSessions`/TBHP coupling in C5.1 bridge | PASS BY CODE AUDIT | Manual tuition regression still recommended |
| Console 400 | No unexplained Supabase 400, or exact endpoint captured if persists | D.1 found no invalid order/filter in audited paths | NOT FULLY TESTED | Capture exact endpoint/query if it reappears |

## Known Limitations / Risks

- Teacher/consultant direct cloud write remains HOLD.
- Full conflict UI/audit/rollback remains C5.3.
- Attendance old baseline/local records are not fully backfilled.
- Học phí/TBHP is not cloud source of truth yet.
- Attendance does not auto-update usedSessions.
- Console 400 may still need exact endpoint capture if it persists.
- Online alpha does not include C5.1 until commit/push/deploy.
- C5.1 still needs final user approval before bundling into a checkpoint commit.

## Go / No-Go Recommendation

GO for C5.2 planning/preflight, but do not implement Học phí source of truth until C5.1 manual QA checklist is acceptable.

Rationale: C5.1 runtime and schedule parity blockers have smoke coverage and the reported TKB backfill outcome is good. The remaining gaps are known limitations or manual QA follow-ups, not blockers for a C5.2 preflight/design phase.

## Next Phase Proposal

C5.2A - Học phí / TBHP cloud source of truth preflight + design.

Do not jump straight to C5.2 runtime implementation. First audit local/cache/cloud ownership, payment/package entities, source-of-truth rules, rollback, and manual QA.

## Scope Safety

- No SQL.
- No runtime implementation.
- no runtime implementation.
- No commit/push.
- Runtime: no new runtime implementation in C5.1E.
- SQL: no SQL added or applied.
- Supabase: no Supabase data/schema action by CodeX.
- C5.2: planning recommendation only, no implementation.
- Commit/push: no commit/push.
