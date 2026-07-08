# FB Admin DreamHome - Bang diem danh navigation final hotfix

FB ADMIN DREAMHOME STATUS: ATTENDANCE NAVIGATION FINAL HOTFIX
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_CORE_SAVE_RELOAD_ALREADY_PASS: YES
ATTENDANCE_KEYDOWN_HANDLER_BOUND_TO_CELL_INPUTS: YES
ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_SHIFT_TAB_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ARROW_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_DISABLED_SKIP_NAVIGATION: YES
ATTENDANCE_CELL_NO_FULL_RENDER_ON_KEYPRESS: YES
ATTENDANCE_CELL_DOES_NOT_FOCUS_BACK_TO_OLD_CELL: YES
ATTENDANCE_MONTH_CONTROL_INPUT_OR_CHANGE_FIXED: YES
ATTENDANCE_SAVE_RELOAD_REGRESSION_CHECKED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh QA

Core Bang diem danh da pass: count/label, unlock, nhap, save, reload, chot va mo lai. Hai loi con lai la Tab/Enter/Arrow dung yen trong cell hien tai va Month/Year chi apply sau blur.

## Root cause

- Keydown handler da bind dung vao `[data-attendance-baseline-cell-input]`, nhung khi nhan Tab/Enter/Arrow no goi commit roi `render()`.
- Render guard app-wide thay active element van la text input nen defer render de bao ve caret. Vi render bi defer, `pendingAttendanceBaselineCellFocus` khong duoc apply, focus van dung o cell cu.
- Month/Year da nghe `input/change`, nhung active element la input month nen render guard cung co the defer den blur.

## Patch summary

- Key navigation commit current cell voi `shouldRender: false`, cap nhat draft in-memory, sau do focus truc tiep cell target hien co trong DOM.
- Tab, Shift+Tab, Enter va Arrow keys deu `preventDefault()` dung luc, khong de browser/native tab order giu focus cu.
- Navigation van lay danh sach editable inputs `[data-attendance-baseline-cell-input]`, nen disabled/unassigned row khong co input va bi skip.
- Change event sau navigation duoc bo qua neu value da duoc commit bang key/pointer, tranh render quay lai cell cu.
- Attendance board filters, gom Month/Year, duoc phep render ngay khi chinh filter dang active. Month input van nghe ca `input` va `change`; browser native co the chi emit khi picker confirm.

## Regression safety

- Khong sua logic save/persistence.
- Save/reload/chot/mo lai duoc kiem bang smoke regression.
- Khong SQL, khong deploy, khong C8 Teacher, khong commit/push.

## Manual QA checklist

1. Click cell editable, nhap `1`, bam Tab: sang cell phai va cell cu giu value.
2. Shift+Tab: sang trai.
3. Enter: xuong duoi cung cot.
4. ArrowRight/Left/Down/Up: di chuyen dung huong, khong crash.
5. Navigation khong focus vao hoc vien chua phan lop.
6. Khong bi focus nguoc ve cell cu sau 0.1-0.5s.
7. Doi Month/Year: app apply khi native input/change fire.
8. Save/reload sau khi nhap bang phim: du lieu con.
