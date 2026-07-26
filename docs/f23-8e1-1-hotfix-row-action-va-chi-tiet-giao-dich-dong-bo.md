# F23.8E1.1 - Hotfix row action và chi tiết giao dịch đồng bộ

Scope: sửa blocker trên `main` cho entry point `In / PDF` từng giao dịch Thu chi và row click của giao dịch đồng bộ từ Học phí. Không Auth, Supabase, SQL, deploy, Teacher Workspace, commit hoặc push.

## Root Cause

Action `In / PDF` đã được render trong row nhưng nằm chung trong cột `Ảnh cloud` rộng 94px. Bảng dùng `table-layout: fixed`, cell dùng `overflow: hidden`, `text-overflow: ellipsis`, và button trong cột ảnh dùng `width: 100%`. Trên viewport laptop, label print bị bóp/cắt, dễ biểu hiện thành dấu `...` hoặc không đọc được như một action trực tiếp.

Row giao dịch đồng bộ vẫn đi qua `openCashflowEditForm()`. Guard F23.8C chặn sửa giao dịch `hoc-phi/tuition-payment` rồi return, nên user không được đưa tới detail read-only. Đây là dead-end UX dù guard bảo vệ dữ liệu là đúng.

## Row Interaction Contract

Giao dịch manual: click nền row mở form `Sửa giao dịch` như F23.9.

Giao dịch đồng bộ từ Học phí: click nền row mở modal `Chi tiết giao dịch` read-only. Không mở form sửa manual.

Mọi giao dịch: row luôn có nút `In / PDF` trực tiếp, không phụ thuộc hover, overflow menu, dấu `...`, ảnh cloud, hay loại nguồn.

## Direct Print Action

Renderer tách cột `Thao tác` riêng cho `In / PDF`. Cột `Ảnh cloud` chỉ giữ `Chèn ảnh` / số ảnh và input file ẩn.

Button print vẫn dùng:

- `button type="button"`;
- `data-cashflow-action="print-transaction"`;
- `data-cashflow-transaction-id`;
- accessible label theo mã giao dịch hoặc id fallback;
- cùng `printCashflowTransaction()` của F23.8E1.

## Event Propagation

Click `In / PDF` gọi `preventDefault()` và `stopPropagation()` trước khi gọi print flow. Row click handler bỏ qua các target `data-cashflow-cloud-action`, input upload, và `data-cashflow-action="print-transaction"`.

Click `Chèn ảnh` / `1 ảnh` tiếp tục stop propagation và không mở edit/detail ngoài ý muốn.

## Read-only Synced Detail

Modal `Chi tiết giao dịch` hiển thị:

- mã giao dịch;
- loại, danh mục, số tiền, ngày giao dịch, phương thức;
- người nộp/người liên quan, người ghi nhận, ghi chú;
- badge `Đồng bộ từ Học phí`;
- học viên, phụ huynh, kỳ học phí nếu local lookup có dữ liệu;
- thời điểm tạo/cập nhật;
- trạng thái chứng từ;
- action `Xem chứng từ`, `In / PDF`, `Đóng`.

Field thiếu hiển thị `—`. Modal escape toàn bộ display text và không render source technical ids, storage path, signed URL, hoặc token.

## Synced Protection

Detail synced không có input sửa `amount`, `type`, `category`, `source`, không có `Lưu giao dịch`, không có `Xóa giao dịch`, và không mở đường hard-delete transaction. Guard F23.8C trong submit/delete vẫn giữ nguyên để bảo vệ nếu có stale form.

## Attachment Detail Behavior

Detail hydrate cloud attachments theo mã giao dịch và current center. Nếu có chứng từ, `Xem chứng từ` mở image manager hiện có cho đúng transaction. Nếu không có, trạng thái hiển thị `Không có chứng từ` và nút xem chứng từ disabled.

## Responsive Action Layout

CSS tách `.cashflow-row-action-cell`, đặt width riêng cho cột `Thao tác`, cho cell action `overflow: visible`, giữ label `In / PDF` `white-space: nowrap`, và không dùng `display: none`, `opacity: 0`, hover-only, hoặc overflow menu cho print action.

## Center And Stale Guard

Mở detail đọc lại latest cashflow theo current center. Nếu không thấy transaction: báo `Không tìm thấy giao dịch`. Nếu transaction có center metadata khác current center: báo `Giao dịch không thuộc cơ sở hiện tại`.

Hydrate chứng từ dùng token `cashflowTransactionDetailHydrateToken`; nếu đổi center/đóng detail trong lúc async, response cũ bị bỏ. Center switch/sign-out reset detail state.

## Tests

Smoke mới: `tests/f23-8e1-1-hotfix-row-action-va-chi-tiet-giao-dich-dong-bo-smoke.js`.

Coverage chính:

- `In / PDF` render trên manual và synced row;
- action không phụ thuộc attachment count, hover, overflow;
- CSS không hidden action;
- print handler stop propagation và gọi một print flow;
- manual row route vẫn mở edit;
- synced row route mở detail read-only;
- missing transaction và center mismatch có message;
- detail có badge, field giao dịch, trạng thái chứng từ, `In / PDF`;
- detail không có save/delete/input tài chính;
- F23.8E1 print engine vẫn giữ lookup bằng id/current center, signed URL, image preload, cleanup.

## Manual QA

Chưa kết luận PASS tự động. Checklist cần chạy trên browser:

1. Mở Thu chi, quan sát mọi row thấy `In / PDF` trực tiếp.
2. Click row manual mở `Sửa giao dịch`.
3. Click `In / PDF` trên manual không mở form, mở print đúng transaction.
4. Click row `Đồng bộ từ Học phí` mở `Chi tiết giao dịch`.
5. Detail không có `Lưu giao dịch` hoặc `Xóa giao dịch`.
6. Click `In / PDF` trong detail và trên row synced cho cùng dữ liệu.
7. Click `Chèn ảnh` / `1 ảnh` không mở edit/detail.
8. Kiểm tra viewport laptop: action không bị cắt, không còn dấu `...` vô nghĩa.

CODE COMPLETE - AWAITING MANUAL QA
