# F23.8F - Hoàn tác kỳ mới trống và confirmation tạo kỳ

## Model Audit

Học phí hiện lưu một record theo học viên trong storage current center. Current period dùng các field trên record: `currentTermId`, `currentTermNumber`, `packageName`, `totalSessions`, `usedSessions`, fee/discount fields, `paidAmount`, `payments`, `dueDate`, `note`, `startedAt`. Kỳ cũ nằm trong `termHistory[]`, mỗi term có `id`, `termNumber`, cùng cấu hình gói, `startedAt`, `endedAt`, `status`, `payments`.

Period identity chính là `currentTermId`. Historical period identity là `term.id`, fallback helper chỉ dùng cho record legacy thiếu id. F23.8C/D payment ledger nối bằng `sourceTuitionId` và `sourcePeriodId` hoặc `sourceTermId`; derived paid/outstanding luôn tính từ cashflow ledger, không cộng thêm projection học phí.

## Wording

Wording chính đã đổi từ `Gia hạn / Tạo kỳ mới` sang `Chốt kỳ hiện tại & tạo kỳ mới`. `Lưu gói` giữ nguyên nghĩa: chỉ lưu cấu hình kỳ hiện tại. Button tạo kỳ trong form renew là `Chốt kỳ & tạo kỳ mới`.

## Confirmation

Tạo kỳ mới không save ngay ở click submit đầu tiên. Runtime mở confirmation `Chốt kỳ hiện tại và tạo kỳ mới?` và nói rõ:

- kỳ hiện tại vào `Lịch sử kỳ học`;
- kỳ mới bắt đầu `0 buổi đã học`;
- kỳ mới bắt đầu `0 VNĐ đã thanh toán`;
- payment kỳ cũ không mang sang kỳ mới;
- đây không phải action ghi nhận thanh toán.

Confirm mới đọc lại latest tuition/cashflow của current center và chặn nếu period id đã thay đổi.

## New Period Initialization

Khi confirm, current period được snapshot vào `termHistory[]`. Kỳ mới có stable `currentTermId` mới, `currentTermNumber` kế tiếp, carry forward cấu hình form renew, `usedSessions = 0`, `paidAmount = 0`, `payments = []`, `startedAt/updatedAt` mới. Không tạo cashflow transaction và không mở payment form.

## Undo Eligibility

Action `Hoàn tác kỳ mới` mở confirmation `Hoàn tác kỳ mới?`. Confirm chỉ enabled khi không có blocking reason. Runtime chạy lại eligibility trên latest data trước khi restore.

Điều kiện bắt buộc:

- current period tồn tại và có stable id;
- có previous term hợp lệ trong `termHistory`;
- current và previous không trùng identity;
- `usedSessions` current bằng 0;
- không có linked tuition-payment transaction của current period;
- derived paid amount bằng 0;
- legacy `paidAmount` và `payments[]` current bằng 0/rỗng;
- không có refund/void/reversal/correction dependency;
- không có attendance usage thuộc current period;
- center và period id không stale.

## Attendance Guard

Attendance hiện không phải nguồn tự động trừ buổi Học phí. Read model đến từ `buildUnifiedAttendanceRecords()` gồm stored attendance và `sessionReports.attendance`. Một số record có `tuitionTermId`, `termId`, hoặc `packageId`; nếu các field này trỏ tới current period thì undo bị chặn.

Với record counted nhưng chưa có period id, guard chặn nếu attendance date nằm từ `startedAt` của current period trở đi. Đây là guard thực tế an toàn trong model hiện tại, không đoán kỳ từ index hoặc tên kỳ.

## Payment Guard

Linked payment dùng helper F23.8D `getLinkedTuitionPaymentTransactions()`. Bất kỳ transaction active nào có `sourceModule=hoc-phi`, `sourceType=tuition-payment`, cùng `sourceTuitionId`, cùng period id và current center đều chặn undo. Các transaction refund/void/reversal/correction cùng tuition/period cũng chặn, kể cả không được cộng vào paid summary.

## Blocking Reasons

UI liệt kê lý do cụ thể, ví dụ:

- `Kỳ hiện tại đã có buổi học được sử dụng.`
- `Kỳ hiện tại đã có dữ liệu điểm danh.`
- `Kỳ hiện tại đã có giao dịch thanh toán.`
- `Kỳ hiện tại có số tiền cũ chưa được đối soát.`
- `Không tìm thấy kỳ trước hợp lệ để phục hồi.`
- `Dữ liệu kỳ học đã thay đổi, vui lòng mở lại hồ sơ.`

Không có force delete.

## Restore Algorithm

Khi eligible:

1. Đọc latest tuition record.
2. Đọc latest current-center cashflow ledger.
3. Build unified attendance records.
4. Chạy lại eligibility.
5. Remove đúng current empty period bằng cách restore previous term.
6. Remove previous term khỏi `termHistory` theo stable identity.
7. Restore previous term thành current period, giữ `currentTermId = previousTerm.id`.
8. Giữ nguyên package/fee/discount/dates/note/usedSessions/payments của previous term.
9. Cập nhật `updatedAt`.
10. Save đúng tuition record, không save cashflow/attendance.

## Stable Identity

Previous period được phục hồi bằng chính id lịch sử của nó. Không tạo id mới, không clone để lại duplicate trong history, không pop thêm kỳ cũ hơn. Các history term cũ hơn giữ nguyên thứ tự và dữ liệu.

## No Deletion

Undo không xóa cashflow transaction, attachment, cloud object, attendance record, report total, source id, refund hoặc reversal. Nếu current period có bất kỳ dependency tiền/điểm danh nào, action bị chặn.

## Center And Double-submit Safety

Confirmation lưu `centerId` và `periodId`. Center switch/reset form sẽ clear confirmation. Confirm double-click bị chặn bằng `isSaving`; stale period id sẽ render reason thay vì tạo/restore nhầm.

F23.8F.1 bổ sung helper ownership dùng chung cho render eligibility và confirm. Record Học phí legacy thiếu hoặc có metadata center cũ được chấp nhận chỉ khi record vừa được resolve từ collection Học phí center-scoped hiện tại; record không có provenance vẫn bị chặn.

## Tests

Smoke `tests/f23-8f-hoan-tac-ky-moi-trong-va-confirm-tao-ky-smoke.js` kiểm:

- wording mới và không còn wording mơ hồ;
- confirmation tạo kỳ nói rõ 0 buổi/0 thanh toán;
- action hoàn tác và blocking reasons;
- payment summary period-scoped;
- main có eligibility/restore/stale/attendance/payment guards;
- undo block không gọi save/delete cashflow/attendance/attachment;
- style/docs markers;
- mojibake scan.

## Limits

F23.8F không làm correction/refund/void/reversal UX, không backfill legacy paid, không merge hai kỳ, không xóa attendance, không đổi TKB, không đổi report export, không Auth/Supabase/SQL/deploy và không Teacher secret.

## Roadmap F23.8G

F23.8G có thể xử lý sửa, hủy, hoàn tiền và đối soát giao dịch liên kết với audit/reversal đầy đủ. F23.8F chỉ phục hồi kỳ mới trống an toàn.
