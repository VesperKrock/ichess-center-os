# FB Admin DreamHome - Bang diem danh nhap nen muot

FB ADMIN DREAMHOME STATUS: ATTENDANCE BASELINE SMOOTH INPUT
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
ATTENDANCE_CLASS_SESSION_LABEL_RESOLVED: YES
ATTENDANCE_TOTAL_CLASS_SESSIONS_FIXED: YES
ATTENDANCE_UNASSIGNED_BADGE_WARNING_RED: YES
ATTENDANCE_UNASSIGNED_ROWS_DISABLED: YES
ATTENDANCE_ASSIGNED_ROWS_EDITABLE: YES
ATTENDANCE_BASELINE_UNLOCK_EDIT_FLOW_FIXED: YES
ATTENDANCE_CELL_INPUT_CARET_STABLE: YES
ATTENDANCE_CELL_VALIDATION_PRESERVED: YES
ATTENDANCE_SAVE_RELOAD_LOCAL_PERSISTENCE_FIXED: YES
ATTENDANCE_EXCEL_LIKE_KEYBOARD_BASIC: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Boi canh

QA GitHub Pages moi nhat khong con loi `Tong ca hoc = 0`: Bang diem danh dang co `Tong ca hoc: 2`, baseline `Chua khoi tao`, `0 ban ghi nen`, va nut `Bat dau nhap du lieu nen` dang bat. Patch nay vi vay tap trung vao flow nhap nen tu trang thai chua khoi tao: hoc vien da phan lop nhap duoc, hoc vien chua phan lop bi disabled/co canh bao, raw class session id khong lo ra nhu label chinh, input o diem danh khong mat caret, validator va luu/reload du lieu nen giu nguyen.

## Root cause

- Bang diem danh lay hoc vien tu danh sach `students` cua app va doc ca hoc/lop tu `student.classSessionIds`, cong them `classSessionId` trong attendance/session report neu co.
- Danh muc ca hoc/lop den tu `classSessions` cua Settings. Khi id khong co trong danh muc, module dung fallback tu raw id.
- Fallback cu chi parse duoc mot vai dang id (`t4-t6`, `t7-cn`, gio 4 chu so), nen id moi nhu `class-session-ca-2-t3-t5-16g30-20g00` co the bi hien raw.
- Hoc vien chua co `classSessionIds` van di qua row binh thuong; truoc patch canh bao chua du do va cell chua co disabled state ro rang trong flow nhap nen.
- Cell baseline da co co che commit khi `change`/phim dieu huong thay vi render tren moi `input`, nhung selector restore focus chua coi cell baseline la selector on dinh.

## Patch summary

- Them formatter raw class session id thanh nhan product-facing, vi du `T3-T5 16:30-20:00`; neu khong parse duoc thi hien `Ca hoc khong tim thay`.
- Fallback class session missing duoc gan `isMissing` va style warning, khong dung raw id lam label chinh.
- `Tong ca hoc` tinh theo ca active trong danh muc Settings, phu hop trang thai moi dang co 2 ca hoc.
- Chip `Chua phan lop` chuyen warning do khi so luong > 0.
- Row hoc vien chua phan lop co class rieng, cell nen disabled co tooltip ly do: can chon Ca hoc / Lop trong ho so hoc vien.
- `canEditAttendanceBaselineCell` chan hoc vien chua phan lop; hoc vien da co ca/lop van edit duoc khi baseline `draft` hoac `unlocked`.
- Them `data-attendance-baseline-cell-input` vao selector focus-stable cua app-wide render guard de giam nguy co render ngoai luong lam mat caret.

## Baseline flow

- `notStarted`: nut `Bat dau nhap du lieu nen` tao state `draft`; cell cua hoc vien da phan lop trong khoang ngay cho phep se hien input.
- `draft`/`unlocked`: cell assigned editable; `Luu thay doi` chi bat khi co draft change.
- `locked`: cell readonly; `Mo khoa du lieu nen` chuyen ve editable va khong xoa ban ghi cu.
- Luu/reload van di qua `saveStoredAttendanceRecords` va `saveAttendanceBaselineState` theo `centerId` hien tai.

## Manual QA checklist

- Mo Bang diem danh DreamHome: `Tong ca hoc` la so ca active hien co, khong quay ve 0.
- Cot `Ca hoc/Lop`: thay `T3-T5 17:00-18:30` hoac `T3-T5 16:30-20:00`, khong thay raw `class-session-...` nhu label chinh.
- Neu con id missing khong parse duoc: thay badge `Ca hoc khong tim thay` mau canh bao.
- `Chua phan lop > 0`: chip do/canh bao; row chua phan lop co cell disabled va tooltip ly do.
- Tu `Chua khoi tao`, bam `Bat dau nhap du lieu nen`; hoc vien da phan lop nhap duoc cac token `1`, `3+4`, `T`, rong; hoc vien chua phan lop khong nhap duoc.
- Dang go trong o khong mat caret; Enter/Tab/Arrow commit va di chuyen o co ban.
- Bam `Luu thay doi`, reload, mo lai Bang diem danh va kiem tra du lieu nen con.

## Safety notes

- Khong sua C8 Teacher.
- Khong tao/chay SQL.
- Khong deploy.
- Khong commit/push.
