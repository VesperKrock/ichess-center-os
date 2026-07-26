# F23.8E2 - Báo cáo drill-down giao dịch và chứng từ

## Data Contract

F23.8E2 giữ `cashflowTransactions` là nguồn duy nhất cho số Thu/Chi trong Báo cáo ngày/tuần. `buildReportData()` và drill-down dùng cùng helper `getReportTransactionsForScope()`, nên danh sách nguồn không được lệch với tổng đang hiển thị. Không cộng thêm projection học phí và không đọc `paidAmount` từ Học phí khi tính tổng Báo cáo.

## Drill-down Scope

Nút `Xem giao dịch nguồn` có ở Báo cáo ngày và Báo cáo tuần, kèm lựa chọn nguồn Thu/Chi. Scope lọc gồm:

- current center do `main.js` đọc latest cashflow theo `getCurrentResolvedCenterId()`;
- ngày báo cáo hoặc tuần đang xem;
- loại `all`, `income`, `expense`;
- danh mục nếu caller truyền category.

Mỗi dòng hiển thị mã giao dịch, ngày, Thu/Chi, danh mục, số tiền, người liên quan, nguồn manual/Học phí, trạng thái chứng từ và nhóm thao tác.

## Read-only Actions

Drill-down không tạo form sửa/xóa riêng. Các action chỉ gọi lại flow hiện có:

- `Mở giao dịch` focus/mở module Thu chi rồi gọi `openCashflowTransactionFromRow()`;
- `Xem chứng từ` focus/mở module Thu chi rồi gọi `openTransactionImageManager()`;
- `In / PDF` gọi `printCashflowTransaction()`.

Manual transaction vẫn mở form sửa theo hành vi Thu chi hiện có. Synced Học phí vẫn đi qua modal chi tiết read-only F23.8E1.1, không mở quyền sửa amount/type/category/source và không hard-delete từ Báo cáo.

## Attachment Loading

Danh sách drill-down chỉ kiểm tra metadata chứng từ bằng `listTransactionAttachmentsByMonth()` theo các tháng có giao dịch trong scope. Không tải signed URL hàng loạt khi render list. Signed URL chỉ được resolve bởi attachment viewer hoặc print flow hiện có khi user thật sự mở chứng từ hoặc in.

## Stale And Center Guards

Trước khi mở giao dịch, mở chứng từ hoặc in, `main.js` đọc lại cashflow của cơ sở hiện tại. Nếu transaction mất, stale hoặc không thuộc center hiện tại, UI báo lỗi rõ trong modal hoặc cloud message, không mở nhầm record. Khi đổi ngày, đổi tuần hoặc chuyển center, modal drill-down bị đóng và token hydrate bị vô hiệu hóa.

## Print Flow

Print từng giao dịch tiếp tục dùng `printCashflowTransaction()`, bao gồm lookup transaction mới nhất, resolve chứng từ phục vụ print, render document print hiện có và guard request token. Báo cáo tổng (`In báo cáo`) không đổi format và không thêm export tổng mới.

## Manual QA

1. Mở Báo cáo ngày có cả Thu, Chi và transaction synced Học phí.
2. Bấm `Xem giao dịch nguồn`, kiểm số dòng đúng với tổng ngày đang thấy.
3. Bấm `Xem nguồn Thu`, kiểm không có dòng Chi.
4. Bấm `Xem nguồn Chi`, kiểm amount và chứng từ không bị cắt ở màn laptop.
5. Đổi sang Báo cáo tuần, kiểm list đúng phạm vi thứ Hai đến Chủ nhật của tuần đang xem.
6. Từ dòng manual, bấm `Mở giao dịch`, form Sửa Thu chi mở như cũ.
7. Từ dòng synced Học phí, bấm `Mở giao dịch`, modal chi tiết read-only mở, không có nút sửa/xóa.
8. Bấm `Xem chứng từ`, viewer hiện có mới resolve ảnh.
9. Bấm `In / PDF`, print flow từng giao dịch chạy và gồm chứng từ khi có.
10. Đổi center hoặc xóa transaction local rồi thử action lại, phải báo rõ missing/stale và không mở nhầm bản ghi.
