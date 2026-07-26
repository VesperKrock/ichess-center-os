# F23.8E1 - In/Xuất PDF từng giao dịch kèm chứng từ

Scope: triển khai bản in/PDF cho một giao dịch Thu chi trên `main`. Không thêm thư viện PDF, không tạo PDF bằng JavaScript, không sửa Báo cáo drill-down, không Auth/Supabase/SQL/deploy, không SUP-CF.1 migration, không Teacher Workspace.

## Print Pattern

F23.8E1 tái sử dụng pattern direct browser print đã ổn định của TKB F23.6B: dựng snapshot dữ liệu mới nhất, tạo runtime root riêng trong document, gọi `window.print()`, cleanup qua `afterprint` và fallback timer. Báo cáo hiện vẫn dùng print window riêng qua `window.open('', 'ichess-report-print')`; F23.8E1 không sửa flow đó.

Runtime root mới là `.cashflow-transaction-print-runtime-root`, tách khỏi `.schedule-print-runtime-root`. Print root được cleanup trước khi tạo bản mới và sau khi đóng print dialog.

## Row Action

Mỗi hàng giao dịch Thu chi có button `In / PDF`:

- `button type="button"`;
- `data-cashflow-action="print-transaction"`;
- `aria-label` kèm mã giao dịch hoặc id fallback;
- hover, active, focus-visible và disabled state;
- không dùng marker module launcher;
- click được `preventDefault()` và `stopPropagation()` để không mở edit form, không đổi filter/search.

Khi đang chuẩn bị, đúng button giao dịch đó hiển thị `Đang chuẩn bị bản in...` và bị disable để chặn double-click.

## Transaction Snapshot

Khi bấm in, runtime đọc lại `readStoredCashflow()` theo current center, resolve transaction bằng `transaction.id` và mã center hiện tại. Không dùng DOM text, amount, date hoặc row index để tìm giao dịch.

Snapshot gồm:

- tên cơ sở và ngày xuất tài liệu;
- mã giao dịch;
- Thu/Chi;
- danh mục;
- số tiền VNĐ;
- ngày giao dịch;
- phương thức;
- người liên quan/người nộp;
- người ghi nhận;
- nguồn giao dịch;
- ghi chú;
- `createdAt` và `updatedAt`;
- học viên, phụ huynh/người nộp, kỳ học phí và ngữ cảnh nguồn nếu là giao dịch `hoc-phi`;
- danh sách evidence đã normalize.

Transaction được clone trước khi đưa vào snapshot và không bị mutate.

## Source Rendering

Manual hiển thị `Nhập thủ công`.

Giao dịch học phí `sourceModule = hoc-phi` và `sourceType = tuition-payment` hiển thị `Đồng bộ từ Học phí`; nếu local data có học viên/kỳ, bản in thêm học viên, phụ huynh/người nộp và kỳ học phí thân thiện. Raw source ids không được render.

## Attachment Normalize

Priority khi in:

1. Cloud metadata từ `listTransactionAttachmentsByTransactionCode({ centerId, transactionCode })`;
2. fallback legacy `transaction.attachment`;
3. `Không có chứng từ`.

Vì bảng hiện tại chưa có `transaction_id`, runtime resolve transaction code từ latest cashflow snapshot bằng `getCashflowTransactionCodesForTransactions()`. Cloud thắng legacy để tránh double-render cùng một chứng từ.

## Signed URL Lifecycle

Ảnh cloud dùng private helper hiện có `createTransactionImageSignedUrl(storagePath, 60 * 10, centerId)`. SUP-CF.1 guard owner/center_admin/current center giữ nguyên trong helper metadata và storage.

Signed URL chỉ tồn tại trong runtime print snapshot, không ghi vào transaction, localStorage, metadata hoặc log. Storage path/raw metadata id/signed URL không được render thành text trong tài liệu.

## Image Preload

Runtime gắn print root trước, sau đó `waitForCashflowPrintImages()` chờ từng ảnh `load` hoặc `error`, có timeout an toàn. `window.print()` chỉ được gọi sau khi toàn bộ ảnh đã settled.

Nếu ảnh lỗi hoặc timeout, `<img>` được thay bằng placeholder `Không thể tải hình ảnh chứng từ`; bản in vẫn tiếp tục với thông tin giao dịch.

## Print CSS

Bản in giao dịch inject `@page { size: A4 portrait; margin: 12mm; }` trong runtime root để không đổi TKB A4 landscape. CSS scoped dưới `.cashflow-transaction-print-runtime-root`:

- nền trắng, chữ đen;
- ẩn app shell/taskbar/start menu/notification/modal/toolbars;
- section thông tin giao dịch ưu tiên giữ cùng nhau;
- ảnh scale theo printable width, không crop;
- evidence item dùng `break-inside: avoid`.

## Center And Stale Guard

Mỗi request có `requestToken`. Nếu user đổi center trong lúc query metadata/signed URL/preload ảnh, response cũ bị bỏ, print root bị cleanup và không mở print dialog cho center cũ.

## Tests

Smoke: `tests/f23-8e1-in-xuat-pdf-tung-giao-dich-kem-chung-tu-smoke.js`.

Regression liên quan đã chạy cùng phase: F23.8B, F23.8B.1, F23.8C, F23.8D, F23.9, TKB print F23.6B, report print, focus/taskbar và build.

## Limits

F23.8E1 không làm multi-transaction statement, export CSV/Excel mới, PDF generator, custom preview, report drill-down, refund/void/correction, nhiều loại attachment ngoài ảnh, upload/xóa ảnh trong print, hoặc migration storage.

## Roadmap

F23.8E2 sau manual QA: Báo cáo drill-down về giao dịch gốc và mở chứng từ.

CODE COMPLETE - AWAITING MANUAL QA
