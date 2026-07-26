# F23.8E1.2 - Polish bảng Thu chi

Scope: polish-only cho bảng Thu chi sau khi F23.8E1.1 manual QA xác nhận logic PASS. Không đổi print engine, click behavior, attachment, payment, totals, report, Auth, Supabase, SQL, deploy, commit hoặc push.

## Button Style

`In / PDF` vẫn giữ cùng selector và handler F23.8E1.1 nhưng bỏ style trắng lệch hệ thống. Button hiện dùng cùng nhóm token với action nhỏ trong Thu chi:

- border `rgba(118, 164, 231, 0.38)`;
- background `rgba(31, 93, 153, 0.35)`;
- text `#dcecff`;
- radius 5px, font nhỏ đậm, hover/focus/active cùng hệ action.

Không đổi text, không đổi `data-cashflow-action="print-transaction"`, không đổi `stopPropagation()`.

## Cloud Banner

Banner cloud Thu chi được đưa về visual language của status panel tối trong app thay vì block xanh/trắng riêng:

- nền tối `rgba(19, 35, 52, 0.72)`;
- trạng thái ready dùng family success `rgba(37, 130, 69, 0.14)`;
- border/padding/radius/font weight đồng bộ với các status strip;
- nút `Mở kho ảnh cloud` dùng secondary action style cùng nhóm với nút nhỏ Thu chi.

Wording và behavior mở gallery giữ nguyên.

## Source Text

Trong table row `hoc-phi`, bỏ badge nguồn trùng ở cell `Ghi chú`. Row synced chỉ hiển thị một dòng plain text:

```txt
Đồng bộ từ Học phí: <Học viên> · <Kỳ>
```

Nếu note nguồn thiếu context, fallback gọn:

```txt
Đồng bộ từ Học phí
```

Renderer dọn các mảnh `undefined`, `null`, `—`, không render raw source IDs và vẫn escape text. Badge `Đồng bộ từ Học phí` vẫn được giữ ở detail read-only và bản in/PDF, nơi không tạo chồng chữ trong table row.

## Column Widths

Cân lại các cột ở viewport laptop:

- `Ngày`: 96px để đọc trọn `DD/MM/YYYY`;
- `Loại`: 58px cho badge Thu/Chi;
- `Danh mục`: 104px, đủ `Học phí`, ellipsis với category dài;
- `Nội dung / Người liên quan`: 15%;
- `Thanh toán`: 104px để đọc `Chuyển khoản`;
- `Số tiền`: 124px và nowrap;
- `Ghi nhận`: 84px, ellipsis hợp lý;
- `Ghi chú / Nguồn`: phần còn lại, ellipsis một dòng;
- `Ảnh cloud`: 88px;
- `Thao tác`: 92px.

Date, payment, amount, image và action columns dùng nowrap để không bị cắt/wrap ở layout desktop. Source/note dùng ellipsis có `title` từ renderer.

## Behavior Unchanged

Giữ nguyên contract đã PASS:

- manual row click mở `Sửa giao dịch`;
- synced row click mở `Chi tiết giao dịch` read-only;
- `Chèn ảnh` / `1 ảnh` xử lý chứng từ và stop propagation;
- `In / PDF` gọi print flow và stop propagation;
- detail read-only không có save/delete hay input tài chính;
- print snapshot, signed URL, preload ảnh, print root và cleanup không đổi.

## Tests

Smoke mới: `tests/f23-8e1-2-polish-thu-chi-row-layout-va-ui-format-smoke.js`.

Coverage:

- print button không dùng nền trắng/chữ đen default;
- print button và cloud banner dùng token hệ thống;
- cloud gallery button giữ wiring;
- row synced không còn badge source trùng;
- source text chỉ có một prefix và có học viên/kỳ;
- missing context fallback không sinh `undefined/null`;
- width/nowrap cho date, amount, image/action;
- behavior selectors F23.8E1.1 vẫn còn;
- docs marker và mojibake scan.

## Manual QA

Chưa kết luận PASS tự động. Checklist browser:

1. Reload `Ctrl + F5`, mở Thu chi.
2. `In / PDF` nhìn cùng hệ với `Chèn ảnh` / `1 ảnh`, không còn button trắng.
3. Banner cloud nhìn cùng format status strip của app; `Mở kho ảnh cloud` vẫn đúng hàng và mở gallery.
4. Row synced chỉ có một dòng `Đồng bộ từ Học phí: <Học viên> · <Kỳ>`.
5. Ngày đọc đủ `24/07/2026`.
6. `Chuyển khoản`, `1.200.000 VNĐ`, `Chèn ảnh` / `1 ảnh`, `In / PDF` không bị cắt.
7. Click manual row, synced row, attachment và print vẫn theo behavior F23.8E1.1.

CODE COMPLETE - AWAITING MANUAL QA
