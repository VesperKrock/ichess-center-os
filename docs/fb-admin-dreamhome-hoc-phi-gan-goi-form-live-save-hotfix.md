# FB Admin DreamHome - Hoc phi gan goi form live/save hotfix

FB ADMIN DREAMHOME STATUS: TUITION PACKAGE FORM LIVE SAVE HOTFIX
FEEDBACK_SOURCE: ADMIN_DREAMHOME_TUITION_PACKAGE_FORM_MANUAL_QA
TUITION_PACKAGE_FORM_SUBMIT_WARNING_FIXED: YES
TUITION_PACKAGE_PREVIEW_LIVE_INPUT_ADDED: YES
TUITION_PACKAGE_SAVE_WORKS: YES
TUITION_NEGATIVE_PAID_AMOUNT_PRESERVED_AS_DEBT_DEDUCTION: YES
TUITION_USED_SESSIONS_STORAGE_MUTATION_FROM_ATTENDANCE: NO
TUITION_ATTENDANCE_READONLY_LINK_PRESERVED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
C8_TEACHER_SCOPE: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## Root cause

- Form `Gan goi hoc phi` dang render nut `Luu goi` la native submit trong `<form>`. Khi click save trung luc UI render/unmount, browser co the bao `Form submission canceled because the form is not connected`.
- Preview cong thuc hoc phi duoc cap nhat bang `render()` toan app tren cac field tien/uu dai. Render guard bao ve input dang go nen preview bi doi den khi blur, con neu ep render thi co nguy co mat caret.

## Files changed

- `src/tuition-module.js`: doi nut save cua form gan goi sang `type="button"`, gan marker `data-tuition-discount-preview`, export helper render preview tu draft values.
- `src/main.js`: tach handler save dung chung cho click va submit fallback; input tien/uu dai chi refresh preview cuc bo thay vi full render.

## Fix form submit

- Nut `Luu goi` / `Tao ky moi` khong con la submit ngam.
- Click save goi explicit handler, handler van `preventDefault()` va `stopPropagation()`.
- Submit fallback cua form van duoc giu de Enter trong form di qua cung mot save flow.

## Fix live preview

- Draft `tuitionFormState.values` van cap nhat ngay tren input.
- Cac field anh huong cong thuc (`totalAmount`, `paidAmount`, `discountCustomValue`) chi thay lai vung `[data-tuition-discount-preview]`.
- `discountPreset` van render modal khi can doi layout custom field, nhung co mark native select change render de khong doi blur.

## Debt deduction display

- Dong `Da thanh toan` van hien dang tru cong no: `-${formatMoney(amounts.paidAmount)}`.
- Khong doi thanh so duong.

## Save flow

- Validate va normalize giu logic hien co.
- Save vao `saveStoredTuition(tuitionRecords)` nhu truoc.
- Queue cloud write-through hien co duoc giu, khong doi payload/schema.
- Sau save dong form va render lai de row/stat cap nhat.

## Attendance read-only preserved

- Attendance chi tiep tuc duoc truyen vao Module Hoc phi de doi chieu read-only.
- Khong co logic ghi nguoc attendance vao `tuition.usedSessions`.
- `remainingSessions` van dua tren `tuition.usedSessions` cua goi hoc phi.

## Manual QA checklist

- Mo Module `Hoc phi`, chon hoc vien chua co goi, mo `Gan goi hoc phi`.
- Nhap `Tong so buoi`, `So buoi da hoc`, `Hoc phi goc`, `Da thanh toan`, `Han dong / ngay nhac`; preview phai cap nhat khi dang go.
- Kiem tra caret khong nhay/mat trong cac o tien.
- Bam `Luu goi` mot lan; khong reload, khong warning form disconnected, form dong va row/stat cap nhat.
- Reload app, goi vua luu van con.
- Kiem tra doi chieu diem danh van chi hien read-only, khong tu sua `usedSessions`.
