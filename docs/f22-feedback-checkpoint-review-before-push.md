# F22.6 - Checkpoint Review Before Push Decision

## Bối cảnh

F22.6 là checkpoint review sau cụm feedback anh Hải 22/06. Phase này không thêm runtime mới, không SQL, không Supabase data change, không C5/C6, không commit/push.

Checkpoint gần nhất:

```txt
C4 commit: dc43dbb C4 shared cloud login and realtime MVP
Push: NO
```

Quyết định hiện tại:

- F22.5 UI/icon/background polish đã hoãn, chờ designer/asset.
- Chưa vào C5 trước khi checkpoint/commit/QA F22.
- F22.6 chỉ tổng hợp, audit, smoke/build/diff/status và đưa recommendation.

## F22.0-F22.4 Artifact/Test Summary

| Phase | Status | Artifact chính | Smoke |
| --- | --- | --- | --- |
| F22.0 - Feedback triage + scope lock | PASS, chưa commit | `docs/feedback-anh-hai-22-06-triage-f22-0.md` | `tests/f22-0-feedback-triage-scope-lock-smoke.js` |
| F22.1 - Kho hàng quick polish | PASS, chưa commit | `src/inventory-module.js`, `src/styles.css`, `docs/kho-hang-quick-polish-f22-1.md` | `tests/f22-1-kho-hang-quick-polish-smoke.js` |
| F22.1.1 - Unit creatable combobox | PASS, chưa commit | `src/inventory-module.js`, `docs/kho-hang-unit-creatable-combobox-f22-1-1.md` | `tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js` |
| F22.2 - Báo cáo ngày/tuần MVP | PASS, chưa commit | `src/report-module.js`, `src/main.js`, `src/modules.js`, `src/styles.css`, `docs/bao-cao-ngay-tuan-mvp-f22-2.md` | `tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js` |
| F22.3 - Nhân viên/chấm công MVP | PASS, chưa commit | `src/staff-module.js`, `src/main.js`, `src/modules.js`, `src/styles.css`, `docs/nhan-vien-cham-cong-mvp-f22-3.md` | `tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js` |
| F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí | PASS, chưa commit | `src/student-tuition-links.js`, `src/student-detail.js`, `src/tuition-module.js`, `src/main.js`, `src/styles.css`, `docs/noi-hoc-vien-phu-huynh-hoc-phi-f22-4.md` | `tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js` |
| F22.5 - UI/icon/background polish | HOÃN | Chờ designer/asset, không blocker cho F22.0-F22.4 | Chưa tạo vì phase đã hoãn |

## Scope Summary

### F22.0 - Feedback triage

- Triage feedback anh Hải 22/06.
- Khóa scope F22.1-F22.5.
- Ghi deadline 29/06, 01/07, 10/07.
- Ghi push policy: no push cho tới khi F22 checkpoint/QA được user xác nhận.

### F22.1 - Kho hàng quick polish

- CTA chuẩn hóa thành `Thêm sản phẩm`.
- Search/form wording gom đúng vật tư/tài sản/sản phẩm.
- Form compact hơn, empty state rõ.
- Không realtime kho, không cloud kho, không cảnh báo cấp sách/áo.

### F22.1.1 - Đơn vị tính creatable combobox

- Đơn vị tính đổi từ select cứng sang input + datalist.
- Vừa chọn được vừa gõ được.
- Preserve unit cũ ngoài danh sách.

### F22.2 - Báo cáo ngày/tuần MVP

- Có Báo cáo ngày, Báo cáo tuần.
- Có công việc ngày, tình huống/vấn đề, doanh thu/chi phí/chênh lệch.
- Có biểu đồ cột thu/chi theo tuần.
- Có biểu đồ học/vắng/nghỉ tổng thể cơ sở hoặc fallback rõ khi thiếu dữ liệu.
- Có in báo cáo và tải báo cáo `.txt`.
- Không claim realtime production.

### F22.3 - Nhân viên/chấm công MVP

- Có Module Nhân viên / Chấm công.
- Tính tổng buổi theo ca dạy, địa điểm dạy, bảng chấm công.
- Đọc teachers/schedule/session reports hiện có.
- Không payroll hoàn chỉnh.
- Không để cột lương/phụ cấp/tổng tiền làm rối view chính.

### F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí

- Helper read-only nối student/parent/tuition.
- Hồ sơ học viên có khối `Liên kết phụ huynh & học phí`.
- Học phí hiển thị học viên & phụ huynh, SĐT, trạng thái học viên, badge cảnh báo.
- Empty state rõ khi thiếu phụ huynh/học phí.
- Không học phí cloud source of truth, không realtime production.

### F22.5 - UI/icon/background placeholder

- Trạng thái: HOÃN.
- Chờ designer/asset.
- Không blocker cho F22.0-F22.4.
- Có thể mở slot asset/icon/background sau.
- Có thể cân nhắc Start → Cài đặt giao diện → chọn background ở phase riêng.

## Manual QA Checklist

### Kho hàng

- Mở Kho hàng.
- Bấm `Thêm sản phẩm`.
- Đơn vị tính vừa chọn được vừa gõ được.
- Gõ unit mới như `Tập`, lưu được.
- Mở sửa lại, unit `Tập` vẫn được giữ.

### Báo cáo

- Mở Báo cáo.
- Thấy Báo cáo ngày/tuần.
- Thấy chart thu/chi.
- Thấy chart học/vắng/nghỉ hoặc fallback rõ.
- Bấm In báo cáo mở print dialog.
- Bấm Tải báo cáo tải file `.txt`.

### Nhân viên

- Mở Nhân viên.
- Thấy tổng buổi/địa điểm/bảng chấm công.
- Tìm Thầy Thắng hoặc giáo viên có data.
- Không thấy bảng chính bị lương/phụ cấp/tổng tiền làm rối.

### Học viên ↔ Phụ huynh ↔ Học phí

- Mở Học viên.
- Mở hồ sơ học viên.
- Thấy khối `Liên kết phụ huynh & học phí`.
- Thấy phụ huynh/SĐT hoặc empty state rõ.
- Mở Học phí.
- Thấy học viên & phụ huynh/SĐT/cảnh báo liên quan.

### Regression

- Học viên vẫn mở được.
- Giáo viên vẫn mở được.
- Kho/Báo cáo/Nhân viên/Học phí không crash.
- Reload app không mất dữ liệu local.

## Known Issues / Risks

- F22.0-F22.4 artifact/test pass nhưng vẫn cần user manual QA trên browser thật.
- F22.5 UI/icon/background chưa làm.
- Scroll retention/tab order Học viên từ C4 vẫn là UX debt.
- Báo cáo chưa realtime production.
- Học phí chưa cloud source of truth.
- Nhân viên chưa payroll hoàn chỉnh.
- Kho chưa realtime/cloud.
- Legacy policies Supabase cần audit trước C5.
- `schedule_session` cloud ban đầu 0, chưa claim lịch vận hành production.
- Worktree F22 còn lớn và chưa commit; nên checkpoint local trước khi đi tiếp.

## Recommendation

```txt
Ready for local commit F22 checkpoint: YES, after user confirmation.
Ready for push: CONDITIONAL, after manual QA browser pass and user approval.
Suggested commit message: F22 feedback modules and data links MVP
Next phase: F22.7 Commit local F22 checkpoint
```

Không tự commit trong F22.6. Không push trong F22.6.

## Scope Safety

- Runtime mới trong F22.6: NO.
- SQL: NOT RUN, NOT ADDED.
- Supabase data change: NO.
- Cloud/realtime mới: NO.
- C5/C6: NOT STARTED.
- Teacher Portal / Super Admin: NOT STARTED.
- F22.5 UI polish: NOT STARTED.
- Commit/push: NOT DONE.
- Đăng ký/signUp: NOT ADDED.

## Test Plan

Chạy bắt buộc:

```bash
node tests/f22-6-feedback-checkpoint-review-smoke.js
node tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js
node tests/f22-3-nhan-vien-cham-cong-mvp-smoke.js
node tests/f22-2-bao-cao-ngay-tuan-mvp-smoke.js
node tests/f22-1-1-kho-hang-unit-creatable-combobox-smoke.js
node tests/f22-1-kho-hang-quick-polish-smoke.js
node tests/f22-0-feedback-triage-scope-lock-smoke.js
node tests/c4-8-no-push-checkpoint-review-smoke.js
node tests/c4-7-live-qa-tp-shared-cloud-smoke.js
node tests/c4-6b-manual-sql-apply-pack-smoke.js
node tests/c4-5-cloud-bootstrap-core-entities-smoke.js
node tests/f19a-student-custom-level-smoke.js
node tests/c2-3-angel-wings-restore-smoke.js
npm run build
git diff --check
git status --short
git log -1 --oneline
```

Nếu build chỉ warning chunk size cũ của Vite thì không blocker. Nếu `git diff --check` chỉ cảnh báo LF/CRLF trên Windows thì không blocker.

## Worktree Audit Expected

F22 expected changed runtime/artifact paths:

- `src/inventory-module.js`
- `src/main.js`
- `src/modules.js`
- `src/student-detail.js`
- `src/styles.css`
- `src/tuition-module.js`
- `src/report-module.js`
- `src/staff-module.js`
- `src/student-tuition-links.js`
- F22 docs/smokes từ F22.0 đến F22.6.

Out-of-scope trong F22.6: none expected beyond this checkpoint doc/smoke and smoke allowlist updates.
