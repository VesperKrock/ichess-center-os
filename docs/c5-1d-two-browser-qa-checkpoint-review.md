# C5.1D - Two-browser QA + Checkpoint Review

## 1. Summary

C5.1D là QA/checkpoint review cho C5.1C runtime guarded realtime Điểm danh/Báo cáo ca dạy. Phase này không mở nghiệp vụ mới.

Scope safety:

- Không SQL.
- Không C5.2.
- Không Học phí/TBHP source of truth.
- Không commit/push.
- Không Supabase manual action.

## 2. Backend readiness recap

- C5.1B SQL applied manually by user.
- entity allowlist opened for `attendance_record`, `attendance_baseline_state`, `session_report`.
- realtime publication OK: `supabase_realtime.public.center_cloud_entities`.
- replica identity FULL.
- helper functions available: `is_center_member`, `can_write_center`.

## 3. Runtime wiring review

| Area | Expected behavior | Source file | Status | Notes |
| --- | --- | --- | --- | --- |
| Bootstrap/pull | Pull C5.1 entities after login + membership + cloud readiness; keep local if cloud empty/error. | `src/main.js`, `src/cloud-attendance-realtime.js` | Reviewed | `bootstrapC51AttendanceSessionReportCloudData` runs after core bootstrap. |
| Realtime subscription | Subscribe to `center_cloud_entities`, filter `center_id`, accept only C5.1 entity types. | `src/cloud-attendance-realtime.js` | Reviewed | Channel cleanup on logout/center change. |
| `attendance_record` bridge | Build/upsert/pull/merge canonical attendance records. | `src/cloud-attendance-realtime.js`, `src/cloud-attendance-records.js` | Reviewed | Stable local id and natural key conflict marker. |
| `attendance_baseline_state` bridge | Sync baseline state without overriding canonical attendance blindly. | `src/cloud-attendance-realtime.js`, `src/cloud-session-reports.js` | Reviewed | Timestamp guard by `updatedAt`/`lastActionAt`. |
| `session_report` bridge | Sync report content/snapshot while keeping attendance snapshot non-canonical. | `src/cloud-attendance-realtime.js`, `src/cloud-session-reports.js` | Reviewed | No automatic attendance canonicalization from report snapshot. |
| Admin write-through | Local save first, then guarded cloud upsert for allowed roles. | `src/main.js` | Reviewed | Admin attendance, baseline and report saves call C5.1 write-through. |
| Teacher/consultant HOLD | Do not direct cloud write without approved scoped policy. | `src/cloud-attendance-realtime.js` | Reviewed | `C51_TEACHER_CONSULTANT_WRITE_HOLD`. |
| updatedAt merge | Ignore incoming records older than or equal to local. | `src/cloud-attendance-realtime.js` | Reviewed | Guard exists for attendance/report/baseline. |
| Soft delete | Remove from active local list; no hard delete SQL/runtime. | `src/cloud-attendance-realtime.js` | Reviewed | Handles `deleted_at`, `deletedAt`, realtime `DELETE`. |
| Duplicate prevention | Use stable `local_id` and report/baseline keys. | `src/cloud-attendance-realtime.js` | Reviewed | Same id merge before insert. |
| Conflict marker | Same attendance natural key with different value/source is not silent overwrite. | `src/cloud-attendance-realtime.js` | Reviewed | Incoming record gets `raw.syncConflict`. |
| Local fallback | Cloud empty/error does not clear localStorage. | `src/main.js` | Reviewed | Status is degraded/error, local is kept. |
| Cloud error handling | Show status message, keep local data. | `src/main.js` | Reviewed | No 400 retry loop added in C5.1D. |

## 4. Two-browser manual QA checklist

Setup:

- Browser A: Chrome normal, logged in admin/center_admin.
- Browser B: Incognito or another browser, same account/same center.
- Clear console in both browsers.
- Open the same local URL or online alpha target.
- Confirm taskbar data status is Cloud or ready/degraded without looping.

Test 1 - Bootstrap:

- Open Module 13 in both tabs.
- Attendance data renders and local data is not lost.
- Console does not spam 400.

Test 2 - Attendance write-through:

- In Browser A, edit one attendance/baseline/admin cell if current UI allows.
- Browser A saves local without error.
- Browser B receives realtime or after reload/pull sees the change.
- No duplicate row is created.

Test 3 - Session report:

- In Browser A, open TKB and enter the session report/admin gateway flow if available.
- Save valid report content.
- Browser B receives or after reload sees the report.
- Attendance snapshot in report does not silently become canonical attendance beyond existing rules.

Test 4 - Role guard:

- If only an admin account is available, confirm admin write-through.
- Teacher/consultant direct write is not a pass case because policy remains HOLD.
- Do not open broad teacher/consultant policy during QA.

Test 5 - Conflict safety:

- If practical, edit the same natural key with different values in two tabs near the same time.
- Confirm data is not silently overwritten.
- If conflict UI is not present, inspect local/debug marker/docs for `syncConflict`.

Test 6 - Học phí/TBHP isolation:

- Open Học phí before and after attendance changes.
- `usedSessions` and `remainingSessions` do not auto decrement.
- TBHP does not auto-generate.

Test 7 - Stability:

- Reload both tabs.
- Attendance/report data is not lost.
- No cloud loading loop.
- No console 400 spam.

## 5. Manual QA result template

Manual QA C5.1D result:

- Browser A:
- Browser B:
- Data status:
- Bootstrap: PASS/FAIL
- Attendance realtime: PASS/FAIL/NOT AVAILABLE
- Session report realtime: PASS/FAIL/NOT AVAILABLE
- Duplicate prevention: PASS/FAIL
- Conflict marker: PASS/FAIL/NOT TESTED
- Học phí isolation: PASS/FAIL
- Console 400 spam: PASS/FAIL
- Notes:

## 6. Risk / known limitations

- Teacher/consultant direct cloud write HOLD.
- Full conflict UI is for C5.3.
- Học phí/TBHP is for C5.2.
- Check-in/out image is future scope.
- Online alpha may need deploy if remote QA is required.

## 7. Next phase recommendation

Next: User manual two-browser QA.

After manual QA pass: C5.1E checkpoint review or C5.2 planning, depending user decision.

If manual QA fails: C5.1D targeted hotfix with the smallest safe runtime patch.
