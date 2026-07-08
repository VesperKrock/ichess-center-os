# FB Admin DreamHome - Hoc phi doi chieu diem danh read-only

FB ADMIN DREAMHOME STATUS: TUITION ATTENDANCE READONLY LINK
FEEDBACK_SOURCE: ADMIN_DREAMHOME_ATTENDANCE_TUITION_AUDIT
ATTENDANCE_TO_TUITION_LINK_EXISTS_BEFORE: NO
TUITION_CURRENT_SOURCE_BEFORE: MANUAL_USED_SESSIONS
TUITION_ATTENDANCE_READONLY_DISPLAY_ADDED: YES
TUITION_USED_SESSIONS_STORAGE_MUTATION: NO
TUITION_CLOUD_PAYLOAD_CHANGED: NO
TUITION_ATTENDANCE_AUTOMATION_ENABLED: NO
TUITION_ATTENDANCE_MISMATCH_WARNING_ADDED: YES
ATTENDANCE_CORE_REGRESSION_CHECKED: YES
C8_TEACHER_ROADMAP_SCOPE: NO
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Ket qua audit truoc do

Truoc phase nay, Hoc phi tinh `Da hoc` va `Con lai` tu `tuition.usedSessions` manual. Bang diem danh da co canonical attendance/baseline records, Bao cao da dung canonical attendance, nhung Hoc phi chua nhan attendance records.

## Nguon du lieu hien tai

- Nguon Hoc phi dang luu: `tuitionRecords.usedSessions`.
- Nguon diem danh read-only moi: `buildUnifiedAttendanceRecords({ sessionReports, storedRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()) })`.
- Helper doi chieu trong `tuition-module.js` dung `getStudentAttendanceCredits` de dem so credit diem danh counted va so ban ghi lien quan.

## Thay doi UI

Trong cot `Buoi da hoc`, moi dong co them badge:

- `Theo diem danh: N`.
- `Khop diem danh` neu bang so dang luu.
- `Lech N buoi` va canh bao nhe neu khac `tuition.usedSessions`.
- `Chua co du lieu diem danh` neu hoc vien chua co attendance records.

Panel chi tiet Hoc phi cung hien dong `Theo diem danh` de admin doi chieu ro hon.

## Gioi han an toan

Phase nay chi read-only:

- Khong gan `tuition.usedSessions = attendanceDerivedCount`.
- Khong save lai tuition records khi mo Hoc phi.
- Khong doi cloud payload.
- Khong bat `usedSessionsAutoUpdateEnabled`.
- `remainingSessions` va warning hoc phi chinh van tinh theo `tuition.usedSessions` manual.

## Phase sau can chot

- Co mat/vang/phep/hoc bu tinh hoc phi ra sao.
- Cell `3+4` tinh la 2 credit hay 1 ngay hoc trong quy tac thu phi.
- Co can nut dong bo so buoi tu diem danh khong.
- Co can audit log khi cap nhat `usedSessions` khong.
- Khi nao moi bat cloud marker attendance linkage.

## Manual QA checklist

1. Mo Hoc phi: module khong crash, cac so Hoc phi cu van giu.
2. Tim dong hoc vien co diem danh: thay `Theo diem danh`.
3. Neu so dang luu khac diem danh: thay canh bao `Can kiem tra`.
4. Hoc vien chua co diem danh: thay `Chua co du lieu diem danh`.
5. Reload: `usedSessions` khong tu doi.
6. Mo Bang diem danh: save/reload/chot/mo lai van on.
