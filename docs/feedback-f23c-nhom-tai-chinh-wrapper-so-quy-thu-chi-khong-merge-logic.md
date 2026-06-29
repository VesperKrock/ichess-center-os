# F23C - Nhóm Tài chính wrapper UI cho Sổ quỹ + Thu chi

F23C STATUS: FINANCE WRAPPER UI ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
CLOUD_SYNC: NO
RUNTIME CHANGE: YES, FINANCE WRAPPER UI ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
FINANCE_LOGIC_CHANGE: NO
MERGE_THU_CHI_SO_QUY_LOGIC: NO
LOCAL_STORAGE_KEY_CHANGE: NO
C6_STARTED: NO

## 1. Mục tiêu F23C

F23C tạo `Nhóm Tài chính` ở tầng UI/navigation để admin nhìn và mở nhanh Sổ quỹ + Thu chi trong cùng một không gian. Đây là wrapper UI an toàn, không phải refactor tài chính.

Mục tiêu bắt buộc: Sổ quỹ đặt trước Thu chi, không merge logic, không merge storage, không đổi công thức, không xóa module cũ.

Nguyên tắc scope: không merge logic Thu chi/Sổ quỹ.

Nguyên tắc storage: không đổi storage/localStorage key.

Nguyên tắc công thức: không đổi công thức tài chính.

Nguyên tắc backend: không SQL, không Supabase, không cloud sync, không realtime.

## 2. Trạng thái trước F23C

- Latest commit: `c40feb2 C5.3 audit conflict rollback checkpoint`
- Ahead/behind expected: `main...origin/main [ahead 4]`
- F23A: PASS, chưa commit.
- F23B: PASS, accepted limitation là checklist chưa persist qua reload.
- Worktree trước F23C: F23A/F23B docs/tests và F23B runtime/style expected.

## 3. Feedback anh Hải liên quan F23C

Feedback anh Hải ngày 27/06: Sổ quỹ và Thu chi về bản chất nên nằm trong một nhóm để dễ nhìn, dễ tổng hợp và có hướng dashboard theo ngày/tuần/quý/năm hoặc tùy chọn.

Nhận định an toàn đã chốt ở F23A: gộp Thu chi và Sổ quỹ ở tầng logic là nguy hiểm. F23C chỉ tạo wrapper UI/navigation, không gộp dữ liệu.

## 4. Files đã sửa/tạo

Runtime wrapper:

- `src/finance-workspace-module.js`

Module registry/dashboard:

- `src/modules.js`
- `src/main.js`

Styles:

- `src/styles.css`

Docs/test:

- `docs/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic.md`
- `tests/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic-smoke.js`

Không sửa `src/cashflow-module.js`, không sửa `src/cashbook-module.js`, không sửa storage, không sửa SQL/cloud files.

## 5. Thiết kế Nhóm Tài chính

F23C thêm module `Nhóm Tài chính` như workspace/wrapper UI. Module này có:

- Header mô tả rõ đây là wrapper UI an toàn.
- Tổng quan tài chính nhẹ, không tính số liệu mới.
- Card mở Sổ quỹ, có note rõ: Đối soát nằm trong Sổ quỹ, chưa tách thành module riêng.
- Card mở Thu chi.

Wrapper dùng nút mở module cũ qua `openModuleWindow`, không render ghép hai module lớn vào cùng một màn hình.

## 6. Sổ quỹ đặt trước Thu chi

Trong `Nhóm Tài chính`, thứ tự card là:

1. Sổ quỹ
2. Thu chi

Sổ quỹ đặt trước Thu chi đúng feedback anh Hải.

F23C.1 hotfix: Đối soát không còn là card/nút riêng trong wrapper. Đối soát được mô tả là hành động nằm trong Sổ quỹ.

## 7. Wrapper UI / navigation

F23C chỉ thêm navigation grouping:

- `data-finance-open-module="so-quy"` mở module Sổ quỹ cũ.
- `data-finance-open-module="thu-chi"` mở module Thu chi cũ.
- Module Sổ quỹ cũ vẫn mở trực tiếp được.
- Module Thu chi cũ vẫn mở trực tiếp được.

Không có hard redirect làm mất lối vào cũ.

## 8. Tổng quan tài chính nếu có

F23C chỉ có tổng quan nhẹ dạng ghi chú. Không tự tạo aggregation ngày/tuần/quý/năm mới.

Accepted limitation: dashboard tài chính nâng cao theo ngày/tuần/quý/năm cần phase sau với aggregation chuẩn và QA riêng.

## 9. Những gì F23C không làm

- Không merge logic Thu chi/Sổ quỹ.
- Không merge storage Thu chi/Sổ quỹ.
- Không đổi localStorage key.
- Không đổi công thức Thu chi.
- Không đổi công thức Sổ quỹ.
- Không đổi logic đối soát.
- Không xóa module Thu chi.
- Không xóa module Sổ quỹ.
- Không tạo dashboard quý/năm bằng logic giả.
- Không SQL.
- Không Supabase action.
- Không cloud sync.
- Không realtime mới.
- Không mở C6.
- Không commit/push.

## 10. Không merge logic Thu chi/Sổ quỹ

Thu chi vẫn dùng module, form, validation, category, transaction model và storage cũ.

Sổ quỹ vẫn dùng module, date selection, settings, reconciliation và storage cũ.

Wrapper chỉ gọi/mở UI cũ, không chuyển dữ liệu Thu chi vào Sổ quỹ, không chuyển dữ liệu Sổ quỹ vào Thu chi, không tạo data bridge và không migrate gì.

## 11. Không đổi storage/localStorage key

F23C không tạo key mới và không đổi key hiện có.

Các key tài chính như cashflow, cashflow categories, cashbook settings và cashbook reconciliations giữ nguyên theo storage hiện tại.

## 12. Không đổi công thức tài chính

F23C không đổi công thức tổng thu, tổng chi, chênh lệch/còn lại, số dư, đối soát hoặc chốt sổ.

Wrapper không tính toán dashboard tài chính nâng cao.

## 13. Không SQL/Supabase/cloud/realtime

F23C không tạo SQL, không chạy SQL, không gọi Supabase, không thêm cloud sync và không thêm realtime.

## 14. Manual QA plan

1. Mở app local.
2. Kiểm tra dashboard/module list có `Nhóm Tài chính`.
3. Mở `Nhóm Tài chính`.
4. Xác nhận trong nhóm này Sổ quỹ đứng trước Thu chi.
5. Bấm `Xem Sổ quỹ`, xác nhận module Sổ quỹ cũ mở được.
6. Quay lại hoặc mở lại `Nhóm Tài chính`, bấm `Xem Thu chi`, xác nhận module Thu chi cũ mở được.
7. Mở module Sổ quỹ trực tiếp từ dashboard/start menu, xác nhận vẫn mở được.
8. Mở module Thu chi trực tiếp từ dashboard/start menu, xác nhận vẫn mở được.
9. Kiểm tra dữ liệu Thu chi không đổi.
10. Kiểm tra dữ liệu Sổ quỹ không đổi.
11. Kiểm tra không có lỗi console nghiêm trọng.
12. Kiểm tra layout wrapper không bị chèn ép/vỡ trên desktop/mobile.

## 15. Risks / limitations

- F23C chưa làm dashboard tài chính nâng cao ngày/tuần/quý/năm.
- Wrapper không nhúng nguyên module Thu chi/Sổ quỹ để tránh màn hình dài và tránh rủi ro merge logic.
- Nếu sau manual QA muốn đổi thứ tự module cũ ngoài dashboard, cần phase nhỏ riêng vì desktop order có thể phụ thuộc localStorage của từng máy.

## 16. Next recommendation

Nếu F23C PASS: user chạy manual QA F23C.

Nếu manual QA pass hoặc accepted limitation được chấp nhận: GO for F23D — UI readiness cho designer.

Nếu phát hiện cần merge logic/storage hoặc dashboard tài chính nâng cao ngay: dừng, không sang F23D, tách phase thiết kế riêng.
