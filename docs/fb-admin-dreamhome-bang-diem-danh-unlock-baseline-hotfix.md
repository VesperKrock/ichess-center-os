# FB Admin DreamHome - Bang diem danh unlock baseline hotfix

FB ADMIN DREAMHOME STATUS: ATTENDANCE UNLOCK BASELINE HOTFIX
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_UNLOCK_REASON_FLOW_FIXED: YES
ATTENDANCE_UNLOCK_TRANSITIONS_TO_EDITABLE_STATE: YES
ATTENDANCE_UNLOCK_PRESERVES_EXISTING_BASELINE_RECORDS: YES
ATTENDANCE_ASSIGNED_ROWS_EDITABLE_AFTER_UNLOCK: YES
ATTENDANCE_UNASSIGNED_ROWS_STILL_DISABLED_AFTER_UNLOCK: YES
ATTENDANCE_TOTAL_CLASS_SESSIONS_RECHECKED: YES
ATTENDANCE_CELL_INPUT_CARET_STABLE_AFTER_UNLOCK: YES
ATTENDANCE_SAVE_RELOAD_READY_FOR_MANUAL_QA: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh QA

Manual QA da pass phan resolve label ca hoc va canh bao hoc vien chua phan lop. Diem ket la flow `Mo khoa du lieu nen`: bam nut, app hoi ly do, nhung UI khong chuyen sang trang thai editable nen admin khong test duoc nhap/lưu/reload.

Anh local cung cho thay truong hop `Tong ca hoc: 0` trong khi rows da hien ca hoc product-facing. Hotfix nay recheck va them fallback count tu session ids dang duoc hoc vien su dung.

## Root cause

- Handler unlock co tao va luu state theo `getCurrentResolvedCenterId()`.
- Nhung `renderAttendanceBoardModule` lai tu load baseline state bang default center khi render, khong nhan state cua center hien tai tu `main.js`.
- Ket qua: unlock co the da save vao DreamHome center, nhung UI sau render van doc state default/old va trong nhu chua mo khoa.
- Draft cache cung co the giu state cu; sau unlock can clear cache de render doc state vua save.
- `Tong ca hoc` truoc do chi dem danh muc `classSessions`; neu Settings/cloud chua load nhung hoc vien co `classSessionIds`, count co the hien 0 du rows da resolve duoc label.

## Patch summary

- `renderAttendanceBoardModule` nhan them `baselineStateOverride` tuy chon.
- `main.js` truyen `getAttendanceBaselineDraftState()` vao module, nen UI doc dung baseline state cua center hien tai.
- Unlock reason de trong se dung default reason an toan: `Mo khoa de chinh sua du lieu nen.`
- Sau khi save unlock state, clear draft cache roi render lai; stored baseline records khong bi xoa.
- Count `Tong ca hoc` lay `max(active classSessions, unique student.classSessionIds)` de khong hien 0 khi rows dang co ca hoc assigned/resolved.

## Manual QA checklist

1. Mo Bang diem danh khi baseline dang locked va co ban ghi nen cu.
2. Bam `Mo khoa du lieu nen`.
3. Nhap ly do hoac de trong, bam OK.
4. Expected: trang thai chuyen sang editable/unlocked, ban ghi nen cu van con.
5. Hoc vien da phan lop co input trong o ngay hop le.
6. Hoc vien chua phan lop van disabled va co tooltip ly do.
7. Nhap `1`, `3+4`, `T`, de trong; caret khong mat.
8. Bam `Luu thay doi`, reload, du lieu con.
9. `Tong ca hoc` khong hien 0 neu rows dang co ca hoc assigned/resolved.

## Safety notes

- Khong sua C8 Teacher.
- Khong SQL.
- Khong deploy.
- Khong commit/push.
