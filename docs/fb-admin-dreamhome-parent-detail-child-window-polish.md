# FB Admin DreamHome Parent Detail Child Window Polish

## Boi canh

Feedback nho-vua sau Vong 1-3 follow-up: Parent detail da mo duoc nhung bi chat/chong khi co nhieu hoc vien, click hoc vien lien quan can mo Ho so hoc vien va noi len truoc, child-window focus can chat hon, checkbox ngay hoc trong Settings can toggle mot lan.

## Root Cause

- Parent detail dung chung khung `.parent-note-modal` voi kich thuoc gon va grid rows khong toi uu cho nhieu section, nen khi co nhieu hoc vien/notes de bi chen va scroll kho doc.
- Link hoc vien lien quan dang goi `openStudentDetailWindow()` thuong; neu caller la modal/detail, caller co the van nam tren layer hien tai va target student profile chua duoc focus lai sau render.
- Checkbox ngay hoc dang nam trong label wrapper. Native toggle van co, nhung hit-area label/input va window pointer handling tao cam giac phai bam lai, nen doi sang input `id` + label `for` ro rang.

## Patch Summary

- Parent detail rong/cao hon, `max-height: calc(100dvh - 104px)`, body scroll noi bo, danh sach hoc vien va lich su ghi chu tach section.
- Them `openStudentDetailWindowFromChildInteraction()` dung chung pattern `focusWindowAfterRender()`; parent related student link dung helper nay va stop propagation.
- Giu `openModuleWindowFromChildInteraction()` cho Settings tu Student edit, cung dung helper focus sau render.
- Settings day checkbox doi sang `.settings-day-option` voi input `id` va label `for`, handler `change` khong render thay node.

## Manual QA

- Mo Phụ huynh / Tư vấn, click phu huynh co nhieu hoc vien. Detail phai rong/cao hon, khong de taskbar, co body scroll doc duoc.
- Click hoc vien lien quan trong detail. Ho so hoc vien phai noi len truoc mat, khong an sau detail/module.
- Mo Cài đặt cơ sở -> Ca học / Lớp -> + Thêm ca học. Click T4 mot lan de chon, click lai mot lan de bo chon.
- Kiem tra search input, native select va Settings tu Student edit khong regress.

## Deferred

- Bảng điểm danh baseline/nhập nền/check-in xử lý prompt riêng.

## Safety

- SQL/deploy/Edge Functions: khong chay.
- C8 Teacher: khong dung.
- Commit/push: khong chay.

```txt
FB ADMIN DREAMHOME STATUS: PARENT DETAIL CHILD WINDOW POLISH
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
PARENT_DETAIL_MULTI_STUDENT_LAYOUT_FIXED: YES
PARENT_DETAIL_TASKBAR_SAFE_HEIGHT_FIXED: YES
PARENT_RELATED_STUDENT_OPEN_PROFILE_ENABLED: YES
CHILD_WINDOW_BRING_TO_FRONT_APP_WIDE_FIXED: YES
CALLER_MODAL_DOES_NOT_STEAL_FOCUS_BACK: YES
SETTINGS_CLASS_DAY_CHECKBOX_SINGLE_CLICK_FIXED: YES
SELECT_DROPDOWN_FIX_PRESERVED: YES
TEXT_INPUT_CARET_STABILITY_PRESERVED: YES
ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```
