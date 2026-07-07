# FB Admin DreamHome Vong 1-3 Follow-up Select Window Parent Settings

## Boi canh

Follow-up QA DreamHome sau Vong 1-3: native select bi render dong dropdown, mo Cài đặt cơ sở tu form sua hoc vien chua noi len dung stack, module Phụ huynh / Tư vấn can row-click/detail gon hon, va Settings can polish product copy.

## Root Cause

- Native select bi dong vi render guard coi `select` nhu text input nhung lai cho render ngay khi select dang focus/mo. DOM select bi thay the truoc khi user chon option.
- Mo Settings tu form sua hoc vien co nguy co click bubble/focus lai window Hoc vien, nen target window da mo nhung khong chac nam tren modal/window hien tai.
- Parent module da derive contact tu hoc vien nhung table van giu cot action/add-note; note history chi doc `careLogs`, nen contact derive co latest note tu hoc vien nhung history rong.
- Settings dung ten `Dữ liệu mẫu` de gay hieu la demo/staging; tab Gói học phí chua noi ro la danh muc dung chung voi Module Học phí.

## Patch Summary

- Tach native select guard: select interaction duoc defer khi pointer/focus, nhung `change` duoc cap cua render ngan de filter apply ngay.
- Giu caret input text: focus/caret snapshot bo qua native select, van ap dung cho input/textarea.
- Them `openModuleWindowFromChildInteraction()` va stop propagation khi mo Settings tu form hoc vien; target window duoc restore/focus lai sau render.
- Parent table con 5 cot, bo cot `Thao tác` va `Thêm ghi chú`; row click/Enter/Space mo detail.
- Detail parent hien hoc vien lien quan va lich su ghi chu. Contact derive tu hoc vien tao readonly history tu `careNotes` va `parentNotes`.
- Settings doi `Dữ liệu mẫu` thanh `Danh mục nhập liệu`.
- Tab Gói học phí noi ro day la danh muc goi dung chung voi Module Học phí.
- Them foundation `Giao diện cơ sở`: nen mac dinh, lop phu doc chu, storage anh bat sau; khong tai anh len trong prompt nay.

## Manual QA

- Mo Hoc vien, click cac select filter Trang thai/Cap do/Ca hoc va chon option.
- Mo Settings, them ca hoc va chon select Trang thai trong form.
- Mo Phu huynh / Tu van, test select filter Loai/Trang thai/Nguon.
- Tu Hoc vien -> Sua hoc vien -> Mo Cài đặt cơ sở; Settings phai hien tren cung, X quay lai form sua hoc vien.
- Mo Phu huynh / Tu van, click row phu huynh; detail hien hoc vien lien quan va lich su ghi chu.
- Settings co `Danh mục nhập liệu`, co `Giao diện cơ sở`, khong con tab `Dữ liệu mẫu`.

## Deferred

- Bang diem danh baseline/nhap nen/check-in se xu ly prompt rieng.
- Upload hinh nen qua Supabase Storage de sau: can nen anh, policy storage, overlay/readability setting.

## Safety

- SQL: khong chay.
- Deploy/Edge Functions: khong chay.
- C8 Teacher: khong dung.
- Commit/push: khong chay.
- Background upload/storage: deferred, khong implement file upload.

```txt
FB ADMIN DREAMHOME STATUS: VONG 1 3 FOLLOWUP SELECT WINDOW PARENT SETTINGS
FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA
C8_TEACHER_ROADMAP_SCOPE: NO
NATIVE_SELECT_DROPDOWN_RENDER_CLOSE_FIXED: YES
SELECT_CHANGE_LIVE_APPLY_PRESERVED: YES
TEXT_INPUT_CARET_STABILITY_PRESERVED: YES
SETTINGS_OPEN_FROM_STUDENT_EDIT_VISIBLE_TOP: YES
WINDOW_MODAL_STACK_CHILD_OPEN_FIXED: YES
PARENT_ROW_CLICK_DETAIL_ENABLED: YES
PARENT_ACTION_COLUMN_REMOVED: YES
PARENT_ADD_NOTE_COLUMN_REMOVED: YES
PARENT_LATEST_NOTE_HISTORY_CONSISTENT: YES
TUITION_PACKAGE_SETTINGS_SHARED_CATALOG_CLARIFIED: YES
SAMPLE_DATA_RENAMED_TO_INPUT_CATALOG: YES
CENTER_APPEARANCE_BACKGROUND_FOUNDATION_ADDED: YES
BACKGROUND_UPLOAD_STORAGE_DEFERRED: YES
ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```
