# F22.6.1 - Manual QA Polish Before Commit

## Summary

F22.6.1 là hotfix/polish sau manual QA, trước khi commit checkpoint F22. Phase này chỉ sửa đúng các điểm user vừa test ở Kho hàng, Báo cáo và Nhân viên.

Không SQL, không Supabase data change, không cloud/realtime mới, không C5/C6, không F22.5 designer polish, không commit/push.

## Manual QA Issues User Reported

- Kho hàng: Đơn vị tính vẫn cần gõ/chọn được, nhưng datalist của item mới không được tự thêm unit lạ như `Bánh` vào gợi ý mặc định.
- Báo cáo: cần nhãn tuần rõ, nút tuần trước/tuần này/tuần sau, chart có mốc trục Y động dễ đọc, hover/click cột, in riêng báo cáo, tải `.txt` rõ hơn, bỏ mô tả đầu module, giữ scroll khi Ctrl+Tab/chuyển tab quay lại.
- Nhân viên: bỏ mô tả đầu `Nhân viên / Chấm công` và dòng giải thích bên dưới.

## Fixes

### Kho unit datalist mẫu-only cho item mới

- `getInventoryFormUnits` chỉ bắt đầu từ danh sách unit mẫu chuẩn.
- Khi tạo item mới, datalist chỉ hiển thị mẫu: Cái, Chiếc, Bộ, Quyển, Hộp, Gói, Thùng, Đôi, Cuốn, Kg, Lít, Mét, Buổi, Khác.
- Input vẫn là text + datalist nên user vẫn gõ unit mới và item vẫn lưu được unit đó.
- Khi sửa item có unit lạ, unit hiện tại được thêm vào datalist của chính form đang sửa để preserve dữ liệu, nhưng không tự thành gợi ý mặc định cho item mới.

### Báo cáo week navigation

- Toolbar Báo cáo hiển thị `Tuần đang xem: start - end`.
- Thêm nút `Tuần trước`, `Tuần này`, `Tuần sau`.
- Tuần trước/sau dịch 7 ngày; tuần này quay về tuần chứa ngày hiện tại.

### Chart Y-axis/dynamic max

- Chart thu/chi có mốc trục Y.
- `getReadableAxisMax` làm tròn động lên mốc dễ đọc.
- Ví dụ: 13.220.000 lên 15.000.000, 32.230.100 lên 35.000.000.

### Hover/click detail

- Cột thu/chi là button có `title` với giá trị chính xác.
- Click cột mở card chi tiết: tuần, loại Doanh thu/Chi phí, giá trị, nguồn dữ liệu/fallback.

### Report-only print

- In báo cáo dùng `buildReportPrintHtml` mở print window riêng, không gọi `window.print()` thô trên toàn dashboard.
- Bản in có tiêu đề, ngày báo cáo, tuần, số liệu ngày/tuần, bảng thu chi và học/vắng/nghỉ.

### Improved txt download

- File `.txt` có tiêu đề, ngày báo cáo, tuần đang xem start - end, báo cáo ngày, báo cáo tuần, bảng thu/chi, học/vắng/nghỉ và ghi chú nguồn dữ liệu ngắn gọn.
- Tên file vẫn an toàn: `bao-cao-co-so-dreamhome-YYYY-MM-DD.txt`.

### Layout cleanup

- Bỏ mô tả đầu module Báo cáo khỏi UI chính.
- Nút In/Tải nằm cùng vùng filter ngày/tuần và nút điều hướng tuần.

### Report scroll retention

- Báo cáo có `data-report-scroll-region="report-grid"`.
- `.report-module` được đưa vào danh sách preserved scroll target trong `main.js`.

### Staff header description removed

- Bỏ header mô tả đầu module Nhân viên.
- Giữ filters/cards/table và nghiệp vụ chấm công hiện có.

## Scope Không Làm

- Không SQL.
- Không Supabase data change.
- Không cloud/realtime mới.
- Không C5/C6.
- Không F22.5 designer polish, không icon/background.
- Không sửa Học viên/Học phí F22.4.
- Không refactor lớn.
- Không seed/reset/restore/delete data.
- Không commit/push.
- Không Đăng ký/signUp.

## Manual QA Checklist

### Kho

- Tạo item mới, datalist unit chỉ hiện mẫu chuẩn.
- Gõ `Bánh`, lưu được cho item đó.
- Tạo item mới khác, `Bánh` không tự thành gợi ý mặc định.
- Sửa item có unit `Bánh`, input vẫn hiển thị đúng unit cũ.

### Báo cáo

- Tuần đang xem hiển thị start - end.
- Tuần trước/Tuần này/Tuần sau chạy đúng.
- Chart có mốc Y dễ đọc.
- Hover cột thấy giá trị.
- Click cột thấy chi tiết.
- In báo cáo chỉ in phần báo cáo.
- Tải báo cáo `.txt` đọc rõ hơn.
- Ctrl+Tab/quay lại không nhảy scroll lên đầu.

### Nhân viên

- Không còn header mô tả thừa.
- Filters/cards/table vẫn hiển thị và không crash.

## Next Step

F22.7 — Commit local F22 checkpoint.
