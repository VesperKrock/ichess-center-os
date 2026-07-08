# FB Admin DreamHome - Bang diem danh Excel navigation polish

FB ADMIN DREAMHOME STATUS: ATTENDANCE EXCEL NAVIGATION POLISH
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_CORE_SAVE_RELOAD_ALREADY_PASS: YES
ATTENDANCE_CELL_ONE_CLICK_SWITCH_FIXED: YES
ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_SHIFT_TAB_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES
ATTENDANCE_CELL_ARROW_NAVIGATION_SAFE: YES
ATTENDANCE_CELL_DISABLED_SKIP_NAVIGATION: YES
ATTENDANCE_CELL_NO_FULL_RENDER_ON_KEYPRESS: YES
ATTENDANCE_MONTH_CONTROL_LIVE_CHANGE_POLISHED: YES
ATTENDANCE_SAVE_RELOAD_REGRESSION_CHECKED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh QA

Nghiep vu Bang diem danh da pass: label/count/unlock/input/save/reload/chot/mo lai. Scope nay chi polish trai nghiem nhap lieu baseline cell: click cell khac mot lan la qua, keyboard di chuyen nhu Excel nhe, skip disabled/unassigned cells, va month picker cap nhat som hon khi value doi.

## Root cause

- Truoc polish, click tu cell A sang cell B co the commit A roi render DOM truoc khi native focus cua B hoan tat.
- Blur/change cua A sau pointerdown co the tiep tuc render/focus lai A, tao cam giac phai click lan hai.
- Keyboard navigation da co Tab/Enter/Arrow, nhung can khoa lai smoke de dam bao khong regress va navigation chi query editable inputs, nen disabled/unassigned cells duoc skip tu nhien.
- Month input truoc do chi nghe `change`, nen mot so browser/native picker chi update sau khi blur hoac confirm.

## Patch summary

- `commitAttendanceBaselineCellInput` nhan `shouldRender`.
- Khi pointerdown vao cell B trong luc cell A dang active, app commit A vao draft in-memory voi `shouldRender: false`, khong prevent default, de browser focus B tu nhien.
- Change event tiep theo cua A duoc bo qua neu value da duoc commit bang pointer, tranh render giat lai focus.
- Tab/Shift+Tab/Enter/Arrow tiep tuc commit va render voi focus target ro rang.
- Navigation dung danh sach `[data-attendance-baseline-cell-input]`, nen row/cell disabled khong co input va bi skip.
- Month picker nghe ca `input` va `change`; neu value khong doi thi khong render.
- Focus state cua baseline input duoc lam ro hon nhung khong anh huong disabled cell.

## Manual QA checklist

1. Click cell A, nhap `1`, click cell B: mot click la B focus, A giu value.
2. Tab sang phai, Shift+Tab sang trai.
3. Enter xuong duoi cung cot.
4. Arrow keys di chuyen theo huong, khong crash.
5. Navigation khong focus vao hoc vien chua phan lop.
6. Dang go cell khong bi render tren tung keypress.
7. Chon Month/Year khac: bang update khi browser fire input/change, khong can blur neu value da doi.
8. Nhap bang keyboard roi save/reload de kiem tra regression.

## Safety notes

- Khong sua persistence/save state ngoai render records da co tu hotfix truoc.
- Khong SQL.
- Khong deploy.
- Khong C8 Teacher.
- Khong commit/push.
