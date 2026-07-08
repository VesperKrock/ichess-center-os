# FB Admin DreamHome - Hoc phi layout va Bang diem danh so buoi

FB ADMIN DREAMHOME STATUS: TUITION LAYOUT 100 ZOOM AND ATTENDANCE SESSION COLUMN
FEEDBACK_SOURCE: ADMIN_DREAMHOME_SMALL_QA
TUITION_LAYOUT_100_ZOOM_POLISHED: YES
ATTENDANCE_BOARD_SESSION_COLUMN_ADDED: YES
ATTENDANCE_BOARD_SESSION_COLUMN_SOURCE: TUITION_RECORD_READONLY
ATTENDANCE_TO_USED_SESSIONS_AUTO_UPDATE: NO
TUITION_FORM_LIVE_SAVE_PRESERVED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
C8_TEACHER_SCOPE: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Scope

- Module Hoc phi: polish bang chinh va Bang cham soc cuoi thang de bot rong/dan trai o desktop 100% zoom.
- Module Bang diem danh: them cot `So buoi` ngay truoc cot `Ghi chu`.

## Implementation

- Cot `So buoi` doc read-only tu `row.tuition`.
- Hoc vien co goi hien `usedSessions/totalSessions`, vi du `2/8`.
- Hoc vien chua co goi hien `Chua gan goi`.
- Du lieu bat thuong ve tong so buoi hien `Chua ro so buoi`, khong crash.
- Khong ghi nguoc vao tuition record va khong doi attendance canonical.

## UX audit 100% zoom

- Bang Hoc phi giam `min-width` tu 1240px xuong 1080px va can lai ty le cot.
- Cot `Buoi da hoc` duoc uu tien rong hon de hien doi chieu diem danh 2 dong gon.
- Cot `Ghi chu` va badge doi chieu cho phep xuong dong co kiem soat.
- Bang cham soc cuoi thang giam `min-width` tu 1120px xuong 1016px va can lai cac cot thao tac/ghi chu.

## Safety

- Khong chinh flow save form Hoc phi.
- Khong doi dau am `Da thanh toan`.
- Khong doi cloud/schema/payload.
- Khong SQL, deploy, commit, push.
