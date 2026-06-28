# C5.1C - Attendance / Session Report Guarded Realtime Runtime

## 1. Summary

C5.1C triển khai runtime guarded realtime cho Điểm danh/Báo cáo ca dạy sau khi user đã tự apply và verify C5.1B SQL trên Supabase. Cloud là source of truth khi signed-in, có center binding, membership hợp lệ và backend ready; localStorage vẫn là cache/fallback và không bị xóa khi cloud lỗi.

Không commit/push trong phase này.

## 2. Backend readiness used

User đã manual apply C5.1B SQL và verify:

- `center_cloud_entities` nằm trong `supabase_realtime`.
- Replica identity: `FULL`.
- Helper functions: `is_center_member`, `can_write_center`.
- entity allowlist đã mở `attendance_record`, `attendance_baseline_state`, `session_report`.

C5.1C không chạy SQL, không sửa schema/data Supabase thủ công.

## 3. Files changed

- `src/cloud-attendance-realtime.js`
- `src/main.js`
- `docs/c5-1c-attendance-session-report-guarded-realtime.md`
- `tests/c5-1c-attendance-session-report-guarded-realtime-smoke.js`

Các file C5.1A/C5.1B vẫn đang dirty theo rule không commit lẻ từ C5.1.

## 4. Runtime bridge

`src/cloud-attendance-realtime.js` thêm bridge chung cho 3 entity:

- `attendance_record`
- `attendance_baseline_state`
- `session_report`

Bridge có:

- pull cloud records theo `center_id`;
- upsert guarded vào `center_cloud_entities`;
- realtime subscription riêng `ichess-center-attendance-session-report:<centerId>`;
- merge cloud vào local cache;
- role/write guard riêng cho C5.1;
- teacher/consultant direct write HOLD.

## 5. Read path

Sau khi đăng nhập và membership loaded:

- app chạy bootstrap cloud core như cũ;
- sau đó pull C5.1 entities;
- merge vào `attendanceRecords`, `attendanceBaselineState`, `sessionReports`;
- nếu cloud empty/error thì giữ local cache, không clear dữ liệu;
- cloud wins theo `updatedAt` khi cùng id và mới hơn;
- record cũ hơn local bị ignore.

Consumers giữ nguyên:

- Module 13 Bảng điểm danh vẫn đọc unified attendance;
- Module 7 TKB gateway vẫn dùng local/session report state;
- F22.2 báo cáo ngày/tuần vẫn nhận unified records;
- deadline alerts vẫn đọc attendance/session reports hiện có.

## 6. Write path

Local save vẫn chạy trước.

Write-through C5.1C chạy sau các thao tác:

- admin attendance save;
- baseline start/save/clear/undo/lock/unlock;
- teacher/session report attendance save;
- session report guest/learning/extra save.

Nếu cloud write fail hoặc role không được phép, local vẫn giữ nguyên và cloud status chuyển degraded/error.

Không biến `session_report.attendance` thành canonical attendance ngoài existing path. Attendance canonical vẫn là `attendance_record`.

## 7. Realtime subscription

Realtime subscription:

- table: `public.center_cloud_entities`;
- filter: `center_id=eq.<centerId>`;
- accepted entity types: `attendance_record`, `attendance_baseline_state`, `session_report`;
- ignore entity khác;
- ignore center khác;
- handle `INSERT`, `UPDATE`, `DELETE`;
- cleanup khi logout/center change;
- chống duplicate subscription bằng `c51AttendanceRealtimeCenterId`.

## 8. Conflict / duplicate / soft delete

Duplicate prevention:

- `attendance_record`: `local_id` từ stable cloud local id;
- `session_report`: report id hoặc `sessionId + occurrenceDate`;
- `attendance_baseline_state`: center-level baseline key.

Merge guard:

- same id nhưng incoming `updatedAt <= local.updatedAt`: ignore;
- same natural key attendance nhưng value/source khác: keep incoming as separate record and mark `raw.syncConflict`;
- soft delete/realtime delete: remove from active local list, cloud tombstone remains source of truth;
- no hard delete SQL/runtime.

## 9. Role guard

Write-through allowed:

- owner;
- qtv;
- center_admin;
- admin role normalized to `center_admin` by access control.

Teacher/consultant direct write:

- HOLD / needs approved scoped policy;
- local save can still happen through existing flow;
- cloud write is skipped with clear status.

This follows C5.1B policy: admin/center_admin write first, teacher/consultant later only after scoped session assignment policy is approved.

## 10. Local fallback / cloud failure

Cloud failure behavior:

- no local reset;
- no cloud-empty overwrite;
- no attendance-to-tuition side effect;
- cloud status records degraded/error;
- user can reload and localStorage remains cache/fallback.

## 11. Manual QA plan

1. Login as quản lý cơ sở/admin.
2. Open Module 13 Bảng điểm danh.
3. Edit baseline/admin attendance where current UI allows.
4. Confirm local save persists after reload.
5. Open second browser tab with same account/center.
6. Change attendance/report in tab A.
7. Confirm tab B receives realtime or next pull without losing local data.
8. Open TKB and save session report content.
9. Confirm no 400 spam and cloud status does not loop.
10. Confirm Học phí/TBHP does not auto decrement sessions.
11. With teacher/consultant role, confirm cloud write is guarded/held, not treated as pass case.

## 12. Risks / not done

- No SQL in C5.1C.
- No Supabase manual schema/data action.
- No C5.2.
- No Học phí/TBHP source of truth.
- No attendance -> `usedSessions`.
- No C5.3 full audit log/rollback UI.
- No check-in/out image upload.
- No broad teacher/consultant policy.

## 13. Next phase

C5.1D - Two-browser QA + checkpoint review.
