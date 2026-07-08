# FB Admin DreamHome - Hoc phi attendance linkage readonly audit

FB ADMIN DREAMHOME STATUS: TUITION ATTENDANCE LINKAGE READONLY AUDIT
FEEDBACK_SOURCE: ADMIN_DREAMHOME_CODE_AUDIT
C8_TEACHER_ROADMAP_SCOPE: NO
RUNTIME_CHANGED_BY_CODEX: NO
ATTENDANCE_CANONICAL_RECORDS_EXIST: YES
ATTENDANCE_BASELINE_RECORDS_EXIST: YES
ATTENDANCE_SESSION_REPORTS_EXIST: YES
REPORT_MODULE_USES_CANONICAL_ATTENDANCE: YES
TUITION_MODULE_RECEIVES_CANONICAL_ATTENDANCE: NO
TUITION_USED_SESSIONS_AUTO_FROM_ATTENDANCE: NO
TUITION_ADVISORY_USES_SESSION_REPORTS_ONLY: YES
TUITION_BASELINE_USED_SESSIONS_LINKED: NO
TUITION_CLOUD_MARKS_ATTENDANCE_LINKED_FALSE: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Ket luan

Module Hoc phi chua duoc noi that voi du lieu diem danh canonical/baseline de tinh `usedSessions`.

Hien tai:

- Bang diem danh co canonical attendance records qua `buildUnifiedAttendanceRecords({ sessionReports, storedRecords })`.
- Baseline records duoc luu trong `attendanceRecords` voi source `initialBaseline`.
- Bao cao da nhan `attendanceRecords` canonical hop nhat tu `sessionReports + loadStoredAttendanceRecords(centerId)`.
- Hoc phi khong nhan `attendanceRecords` canonical. `main.js` goi `renderTuitionModule(..., sessionReports, attendanceAdvisoryNotes, ...)` va khong truyen stored attendance records.
- `buildTuitionRows(students, tuitionRecords)` tinh `remainingSessions = tuition.totalSessions - tuition.usedSessions`, tuc la doc so buoi da hoc tu record hoc phi da luu, khong tinh lai tu diem danh.
- `student-tuition-links.js` cung doc `tuition.usedSessions` va khong nhan attendance records.
- `attendance-advisory.js` co dem `sessionReports` theo thang de hien bang cham soc cuoi thang, nhung khong doc baseline/canonical attendance records va khong ghi nguoc vao `tuitionRecords.usedSessions`.
- Cloud tuition payload hien co danh dau ro `attendanceLinked: false`, `attendanceAutoUpdateEnabled: false`, `usedSessionsAutoUpdateFromAttendance: false`, hoac `usedSessionsAutoUpdateEnabled: false`.

## File/module lien quan

- `src/attendance-records.js`: canonical attendance helpers, gom `buildUnifiedAttendanceRecords`, `getStudentAttendanceCredits`, baseline source `initialBaseline`.
- `src/attendance-board-module.js`: Bang diem danh render va tinh cycle hien thi bang attendance + tuition.
- `src/main.js`: `bao-cao` co truyen canonical `attendanceRecords`; `hoc-phi` chua truyen canonical attendance.
- `src/tuition-module.js`: `buildTuitionRows` dung `tuition.usedSessions`.
- `src/student-tuition-links.js`: tinh link hoc phi tu `tuition.usedSessions`.
- `src/attendance-advisory.js`: advisory dem `sessionReports` theo thang, fallback ve `tuition.usedSessions`.
- `src/cloud-tuition-records.js`, `src/cloud-tuition-terms.js`, `src/cloud-tuition-record-package-bridge.js`: cloud payload dang marker attendance linkage disabled.

## Rui ro nghiep vu

- Admin nhap/chot diem danh nen thanh cong nhung Hoc phi van co the bao sai `Da hoc`, `Con lai`, `Sap het buoi`, `Qua han` neu `tuition.usedSessions` khong duoc cap nhat thu cong.
- Baseline records vua nhap khong lam thay doi so buoi trong Hoc phi.
- `sessionReports` co the anh huong bang advisory theo thang, nhung khong cap nhat package/usedSessions chinh.
- Bao cao co the thay attendance canonical dung trong khi Hoc phi van dung counter cu, tao lech so lieu lien module.

## De xuat phase hotfix nho tiep theo

1. Them helper read-only tinh attendance credits theo hoc vien:
   - input: `attendanceRecords = buildUnifiedAttendanceRecords({ sessionReports, storedRecords })`.
   - dung `getStudentAttendanceCredits(records, studentId)` de dem counted credits.
   - baseline `initialBaseline` override same-date non-baseline nhu helper hien co.
2. Truyen `attendanceRecords` vao `renderTuitionModule` tu `main.js`, tuong tu `bao-cao`.
3. Trong `buildTuitionRows`, them mode hien thi derived:
   - `attendanceUsedSessions = credits.length`.
   - `effectiveUsedSessions = attendanceUsedSessions` khi co attendance data, fallback `tuition.usedSessions`.
   - giu `tuition.usedSessions` goc de audit/manual override.
4. UI nho trong Hoc phi:
   - hien `Da hoc` tu Diem danh neu co.
   - badge source: `Diem danh` / `Hoc phi manual`.
   - khong auto ghi vao storage o phase dau.
5. Sau khi QA pass read-only derived, phase sau moi xem co can persist/sync `usedSessions` vao tuition record hay khong.

## Safety notes

- Audit nay khong sua runtime.
- Khong SQL.
- Khong deploy.
- Khong commit/push.
