# FB Admin DreamHome - Bang diem danh save persistence keyboard hotfix

FB ADMIN DREAMHOME STATUS: ATTENDANCE SAVE PERSISTENCE KEYBOARD HOTFIX
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_SAVE_PRESERVES_BASELINE_RECORDS: YES
ATTENDANCE_SAVE_DOES_NOT_RESET_TO_UNINITIALIZED: YES
ATTENDANCE_RELOAD_LOCAL_PERSISTENCE_FIXED: YES
ATTENDANCE_LOCK_PRESERVES_RECORDS: YES
ATTENDANCE_UNLOCK_AFTER_LOCK_PRESERVES_RECORDS: YES
ATTENDANCE_CELL_ONE_CLICK_SWITCH_FIXED: YES
ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ARROW_NAVIGATION_SAFE: YES
ATTENDANCE_UNASSIGNED_ROWS_STILL_DISABLED: YES
ATTENDANCE_MONTH_CONTROL_RENDER_SAFE: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh QA

Sau hotfix unlock, admin da nhap duoc o baseline nhung `Luu thay doi` lam UI trong nhu mat du lieu va quay ve flow `Bat dau nhap du lieu nen`. `Chot du lieu nen` cung co cam giac clear/an du lieu. Input cell con can polish: click sang cell khac nen chi can mot lan, Tab/Enter/Arrow di chuyen nhe nhu bang tinh.

## Root cause

- Draft records duoc save vao `saveStoredAttendanceRecords(getCurrentResolvedCenterId(), draftRecords)`.
- Sau save, app goi `clearAttendanceBaselineDraft()` roi render.
- Truoc hotfix nay, `renderAttendanceBoardModule` chi nhan `attendanceBaselineDraftRecords`; khi draft bi clear, module tu `loadStoredAttendanceRecords()` bang default center thay vi current DreamHome center.
- State baseline da duoc truyen dung center sau hotfix unlock, nhung records thi van co the doc sai center. Vi vay UI co cam giac mat data sau save/lock/reload.
- `Chot du lieu nen` khong xoa records trong helper, nhung render sau lock cung co the doc sai records neu module fallback ve default center.
- Click tu cell A sang cell B bi double-click cam giac vi blur/change cua A co the commit va render truoc khi click B duoc xu ly.

## Patch summary

- `main.js` truyen `getAttendanceBaselineDraftRecords()` vao `renderAttendanceBoardModule` thay vi raw `attendanceBaselineDraftRecords`.
- Khi khong co draft, `getAttendanceBaselineDraftRecords()` tra stored records cua `getCurrentResolvedCenterId()`, giup save/lock/unlock/reload render dung center.
- Them `pointerdown` tren baseline cell input: neu dang focus cell A va click cell B, app commit A, render an toan, roi focus B bang `pendingAttendanceBaselineCellFocus`. Mot click la chuyen cell.
- Giu navigation co san: Tab sang phai, Shift+Tab sang trai, Enter xuong duoi, arrow keys di chuyen theo grid input hien co.
- Month control van apply tren `change`; khong render tren tung tick va khong them live sync gay mat caret.

## Manual QA checklist

1. Mo Bang diem danh, unlock neu dang locked.
2. Nhap `1`, `3+4`, `T` vao hoc vien da phan lop.
3. Bam `Luu thay doi`: data van hien, state khong ve `Chua khoi tao`.
4. Reload app: data con.
5. Bam `Chot du lieu nen`: bang readonly/locked nhung records van hien.
6. Bam `Mo khoa du lieu nen`: data cu con va co the sua tiep.
7. Hoc vien chua phan lop van disabled.
8. Click cell A roi click cell B: mot lan la chuyen focus, cell A giu value.
9. Tab/Shift+Tab/Enter/Arrow khong crash va di chuyen theo grid input.

## Safety notes

- Khong sua C8 Teacher.
- Khong SQL.
- Khong deploy.
- Khong commit/push.
