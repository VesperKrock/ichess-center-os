# Module and screen inventory

## Cách hiểu inventory

`IMPLEMENTED` nghĩa là repo có renderer/interaction hoặc wiring thật, không có nghĩa mọi nhánh đã manual QA về hình ảnh. `PLANNED` và `PLACEHOLDER` không được mockup như chức năng đã phát hành.

Ưu tiên thiết kế:

- `P0`: cần đại diện ở Gate A/B hoặc có rủi ro dữ liệu/quyền cao.
- `P1`: data-heavy hoặc dùng thường xuyên, nên làm ngay sau system validation.
- `P2`: làm sau khi foundations/components ổn định.

## Shell và module thật

| Surface/module | Mục đích và role chính | Screen/pattern repo chứng minh | Độ dày | Trạng thái | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| Login & center gate | Xác thực, bind center; mọi role | Login form, busy, config missing, access denied, signed-in account | Nhẹ nhưng critical | `IMPLEMENTED` | P0 |
| Desktop shell | Điểm vào module; mọi role đã bind | Grid/list shortcut, reorder, Start, taskbar, center popover, multi-window, window overflow | Trung bình | `IMPLEMENTED` | P0 |
| Notification | Cảnh báo theo center/module | Badge, module bell, global panel, read filter, empty | Trung bình | `IMPLEMENTED` | P1 |
| Học viên | Hồ sơ và theo dõi học tập; admin/ops | Stats, filter/sort, 10-column table, multi-step create/edit form, detail, care notes, learning result | Dày | `IMPLEMENTED` | P0 |
| Phụ huynh / Tư vấn | CRM lead/care/convert preview; consultant/admin | Filtered table, detail, wizard form, care log, appointment, note modals, conversion preview | Dày | `IMPLEMENTED` | P1 |
| Giáo viên | Roster, hồ sơ, phân công; admin | Filtered table, profile panel, create/edit form, staff link, teaching update, schedule/detail cards | Dày | `IMPLEMENTED` | P0 |
| Nhân viên | Staff, phòng ban, account/lifecycle, chấm công; owner/admin | Staff table, filter, form, profile/admin-card, department table/form, lifecycle dialog/history, account link, attendance table | Rất dày | `IMPLEMENTED` | P0 |
| Hồ sơ hành chính | Dữ liệu nhân sự nhạy cảm; active owner/admin | Child window riêng, overview, section nav, long form, masking/reveal, completion, documents, governance | Rất dày/nhạy cảm | `IMPLEMENTED` | P0 |
| Tài liệu nhân sự & attachment | Catalog, expiry, tệp private; active owner/admin | Summary/filter/list/detail/form, upload/view/download/replace, version history, soft removal, deletion request/review/legal hold states | Rất dày/nhạy cảm | `IMPLEMENTED`; permanent deletion `DEFERRED` | P0 |
| Thời khóa biểu | Lịch tuần, ca dạy và hoạt động cơ sở; admin/teacher-related | 7-day grid, week nav, filters, cards, activity CRUD, recurrence, tags, conflict, report/attendance panels | Rất dày | Runtime `IMPLEMENTED`; metadata module vẫn ghi `planned` — cần technical cleanup, không phải UI feature gap | P0 |
| Bảng điểm danh | Tổng hợp tháng và dữ liệu nền; admin | Filter toolbar, spreadsheet-like table, editable baseline, detail/note modal, lineage panel | Rất dày | `IMPLEMENTED` | P0 |
| Học phí | Gói/kỳ, công nợ, thanh toán; admin | Filter/table, tuition form, payment/evidence, detail, term/payment history, advisory, audit preview | Rất dày | `IMPLEMENTED` | P0 |
| Nhóm Tài chính | Wrapper vào Sổ quỹ/Thu chi | Hai entry cards, không merge logic | Nhẹ | `IMPLEMENTED` | P2 |
| Thu chi | Ledger giao dịch; owner/admin | Stats/filter, 10-column table, create/edit form, category panel, transaction detail, evidence/gallery | Rất dày | `IMPLEMENTED` | P0 |
| Sổ quỹ | Số dư và đối soát | Day toolbar, stats, transaction table, settings, reconciliation form/history | Dày | `IMPLEMENTED` | P1 |
| Kho hàng | Item, movement, request | List/filter/table, attention panel, item/movement form, history/detail, request table/form/status | Rất dày | `IMPLEMENTED` | P1 |
| Báo cáo | Ngày/tuần và nguồn dữ liệu | Date/week filters, daily form, stats, chart, print/download, source transaction modal/table | Dày | `IMPLEMENTED` | P1 |
| Cài đặt cơ sở | Thông tin và dữ liệu nền | Tabs, center info/appearance, ca-lớp table/form, gói học, sample data, cloud status | Dày | `IMPLEMENTED`; một số appearance capability được ghi là về sau | P1 |
| Đang cập nhật | Giữ chỗ | Placeholder description | Nhẹ | `PLACEHOLDER` | P2 |

## Screen set đại diện cho Gate B

1. Desktop shell với Start mở, hai window và taskbar overflow.
2. Học viên hoặc Nhân viên: data-heavy list + filter + form.
3. Hồ sơ hành chính: detail nhạy cảm + tài liệu + permission/backend state.
4. Thời khóa biểu: normal và compact laptop.
5. Thu chi/Học phí: destructive/financial confirmation và evidence state.

## Mismatch cần ghi nhớ

- `src/modules.js` dùng nhiều status `in-progress` và riêng Thời khóa biểu là `planned`, trong khi repo có renderer/interaction sâu. Designer không được dùng metadata này để bỏ qua screen thật.
- Module metadata mô tả Nhân viên thiên về chấm công, nhưng runtime hiện có đầy đủ staff/department/account/lifecycle/hồ sơ hành chính. Inventory này ưu tiên renderer hiện hành.
- Chưa có screenshot nên không kết luận screen nào đang đẹp/xấu, bị vỡ hay khó dùng chỉ từ số lượng class/field.
