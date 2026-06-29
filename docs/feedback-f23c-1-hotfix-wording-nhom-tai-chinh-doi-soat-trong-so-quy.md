# F23C.1 - Hotfix wording Nhóm Tài chính: Đối soát nằm trong Sổ quỹ

F23C.1 STATUS: FINANCE WRAPPER UX HOTFIX ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
CLOUD_SYNC: NO
RUNTIME CHANGE: YES, FINANCE WRAPPER WORDING ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
CREATE_RECONCILIATION_MODULE: NO
FINANCE_LOGIC_CHANGE: NO
MERGE_THU_CHI_SO_QUY_LOGIC: NO
LOCAL_STORAGE_KEY_CHANGE: NO
C6_STARTED: NO
F23D_STARTED: NO

## 1. Mục tiêu F23C.1

F23C.1 là UX wording hotfix cho `Nhóm Tài chính`: làm rõ Đối soát là hành động trong Sổ quỹ, không phải module/window riêng trong F23C.1.

## 2. Vấn đề UX sau F23C

F23C có card/nút `Mở đối soát` trong `Nhóm Tài chính`. Nút này mở Sổ quỹ, đúng logic hiện tại, nhưng dễ gây hiểu nhầm rằng Đối soát là một module/window riêng ngang hàng với Sổ quỹ và Thu chi.

## 3. Quyết định sản phẩm

- Không tạo module/window Đối soát riêng.
- Đối soát nằm trong Sổ quỹ.
- F23C.1 chỉ sửa wording/UI wrapper.
- Không merge logic Thu chi/Sổ quỹ.

Nguyên tắc UX: không tạo module/window Đối soát riêng.

Nguyên tắc safety: không merge logic Thu chi/Sổ quỹ, không đổi storage/localStorage key, không đổi công thức tài chính, không SQL/Supabase/cloud/realtime.

## 4. Files đã sửa

- `src/finance-workspace-module.js`
- `src/styles.css`
- `docs/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic.md`
- `tests/feedback-f23c-nhom-tai-chinh-wrapper-so-quy-thu-chi-khong-merge-logic-smoke.js`
- `docs/feedback-f23c-1-hotfix-wording-nhom-tai-chinh-doi-soat-trong-so-quy.md`
- `tests/feedback-f23c-1-hotfix-wording-nhom-tai-chinh-doi-soat-trong-so-quy-smoke.js`

## 5. Wording/UI mới

Wrapper `Nhóm Tài chính` chỉ còn hai card chính:

1. Sổ quỹ
2. Thu chi

Trong card Sổ quỹ có note: `Đối soát nằm trong Sổ quỹ, chưa tách thành module riêng.`

Không còn nút misleading `Mở đối soát`.

## 6. Đối soát nằm trong Sổ quỹ

Đối soát là hành động trong Sổ quỹ. Khi cần đối soát, user mở `Xem Sổ quỹ` và dùng luồng đối soát hiện có trong module Sổ quỹ.

## 7. Những gì F23C.1 không làm

- Không tạo module/window Đối soát riêng.
- Không sửa logic Sổ quỹ.
- Không sửa logic Thu chi.
- Không merge logic Thu chi/Sổ quỹ.
- Không đổi storage/localStorage key.
- Không đổi công thức tài chính.
- Không SQL/Supabase/cloud/realtime.
- Không mở C6.
- Không mở F23D.

## 8. Không tạo module/window Đối soát riêng

F23C.1 không thêm module id, route, window type hoặc registry entry nào cho Đối soát.

## 9. Không merge logic Thu chi/Sổ quỹ

Thu chi và Sổ quỹ tiếp tục giữ module, storage, form, validation và công thức hiện có. Wrapper chỉ là navigation/copy.

## 10. Không đổi storage/localStorage key

F23C.1 không tạo key mới và không đổi bất kỳ key localStorage hiện có.

## 11. Không đổi công thức tài chính

Không đổi tổng thu, tổng chi, số dư, chênh lệch/còn lại, đối soát hoặc chốt sổ.

## 12. Không SQL/Supabase/cloud/realtime

F23C.1 không tạo SQL, không chạy SQL, không gọi Supabase, không thêm cloud sync và không thêm realtime.

## 13. Manual QA plan

1. Reload app local.
2. Mở `Nhóm Tài chính`.
3. Kiểm tra chỉ còn Sổ quỹ trước Thu chi; Đối soát chỉ là note trong Sổ quỹ.
4. Kiểm tra không còn nút `Mở đối soát`.
5. Bấm `Xem Sổ quỹ`, module Sổ quỹ cũ mở đúng.
6. Bấm `Xem Thu chi`, module Thu chi cũ mở đúng.
7. Kiểm tra dữ liệu Sổ quỹ không đổi.
8. Kiểm tra dữ liệu Thu chi không đổi.
9. Kiểm tra không có lỗi console nghiêm trọng.

## 14. Risks / limitations

Dashboard tài chính nâng cao vẫn là phase sau. F23C.1 chỉ sửa UX wording trong wrapper.

## 15. Next recommendation

Nếu F23C.1 PASS: user chạy manual QA F23C.1.

Nếu manual QA pass/accepted: GO for F23D — UI readiness cho designer.
