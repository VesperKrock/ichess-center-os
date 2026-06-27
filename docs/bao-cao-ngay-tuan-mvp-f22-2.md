# F22.2 - Báo cáo Ngày/Tuần MVP

## Summary

F22.2 tạo giao diện Báo cáo vận hành cơ sở mức MVP theo feedback anh Hải ngày 22/06. Module Báo cáo hiện có Báo cáo ngày, Báo cáo tuần, biểu đồ cột thu/chi theo tuần, biểu đồ tròn học/vắng/nghỉ tổng thể cơ sở, và nút in/tải báo cáo.

MVP đọc dữ liệu hiện có trong app/local/cache: học viên, Thu chi, sessionReports và attendance records local. Nếu nguồn chưa đủ, UI hiển thị empty state/fallback rõ ràng. F22.2 không claim production realtime.

## Feedback anh Hải được xử lý

- Có Báo cáo ngày.
- Có Báo cáo tuần.
- Có phần công việc ngày.
- Có phần tình huống/vấn đề xảy ra trong ngày.
- Có doanh thu trong ngày.
- Có biểu đồ thu/chi dạng cột.
- Có biểu đồ học/vắng/nghỉ dạng tròn/quạt.
- Có nút in báo cáo.
- Có nút tải báo cáo MVP dạng `.txt`.

## Báo cáo ngày MVP

Báo cáo ngày gồm:

- Ngày báo cáo.
- Doanh thu trong ngày, chi phí trong ngày, chênh lệch.
- Danh sách tối đa 5 giao dịch thu/chi trong ngày nếu có dữ liệu.
- Công việc ngày.
- Tình huống/vấn đề xảy ra trong ngày.
- Ghi chú vận hành.
- Người phụ trách.

Các ô công việc/tình huống/ghi chú là draft trong phiên mở app, không ghi cloud và không đổi schema dữ liệu.

## Báo cáo tuần MVP

Báo cáo tuần gồm:

- Tuần đang xem.
- Tổng doanh thu.
- Tổng chi phí.
- Chênh lệch thu - chi.
- Tổng học viên.
- Số học viên đi học trong tuần.
- Số học viên vắng/nghỉ trong tuần.

## Biểu đồ thu/chi

Biểu đồ thu/chi là bar chart HTML/CSS:

- Cột ngang là các tuần đang hiển thị, label theo ngày bắt đầu tuần.
- Cột dọc dùng đơn vị VNĐ.
- Có doanh thu và chi phí.
- Min là 0 VNĐ.
- Max tự tính bằng doanh thu cao nhất + 10.000.000 VNĐ, có fallback tối thiểu 10.000.000 VNĐ để chart không bị trống chiều cao.
- Nếu chưa có dữ liệu thu/chi trong các tuần hiển thị, UI vẫn có khung chart và empty state.

## Biểu đồ học/vắng/nghỉ

Biểu đồ học/vắng/nghỉ dùng conic-gradient:

- 100% là tổng học viên đang hoạt động của cơ sở.
- M là số học viên có bản ghi đi học trong tuần.
- Tổng - M là số học viên vắng/nghỉ trong tuần.
- Có legend Đi học, Vắng/nghỉ, Tổng.
- Nếu chưa có đủ dữ liệu điểm danh trong tuần, UI hiển thị fallback: "Chưa có đủ dữ liệu điểm danh trong tuần này để tính chính xác học/vắng/nghỉ."

## In/download

- In báo cáo dùng browser print qua `window.print()`.
- Tải báo cáo tạo file text MVP bằng Blob.
- Tên file an toàn dạng `bao-cao-co-so-dreamhome-YYYY-MM-DD.txt`.
- Nội dung file có Báo cáo ngày, Báo cáo tuần, số liệu tóm tắt và ghi chú nguồn dữ liệu/fallback.

## Data source

- Học viên: danh sách học viên hiện có trong app/local/cache.
- Thu chi: giao dịch Thu chi hiện có.
- Điểm danh: sessionReports kết hợp attendance records local/cache qua unified attendance read path.
- Nguồn chưa đủ thì hiện empty state/fallback rõ.
- Không claim production realtime. Realtime báo cáo đầy đủ cần phase sau khi nối đủ thu chi/học phí/điểm danh/kho.

## Scope không làm

- Không production realtime cho Báo cáo.
- Không cloud/realtime mới.
- Không SQL.
- Không Supabase data change.
- Không seed dữ liệu.
- Không làm Kho hàng F22.1 thêm.
- Không làm Nhân viên/chấm công F22.3.
- Không làm Học phí/nối dây F22.4.
- Không làm UI/icon/background F22.5.
- Không C5/C6, Teacher Portal, Super Admin, Đăng ký/signUp.
- Không commit/push.

## Data safety

- Không xóa localStorage.
- Không đổi schema dữ liệu hiện có.
- Không ghi cloud cache.
- Không seed hoặc bịa production data.
- Draft báo cáo ngày chỉ giữ trong state phiên app, không tự tạo dữ liệu thật.

## Manual QA checklist

1. Mở Module Báo cáo.
2. Kiểm tra có Báo cáo ngày và Báo cáo tuần.
3. Đổi Ngày báo cáo và Tuần đang xem.
4. Nhập thử công việc ngày, tình huống/vấn đề và ghi chú vận hành.
5. Xem doanh thu trong ngày có số hoặc empty state rõ.
6. Kiểm tra biểu đồ cột thu/chi có label tuần, doanh thu, chi phí, VNĐ.
7. Kiểm tra biểu đồ học/vắng/nghỉ có legend và fallback nếu thiếu điểm danh.
8. Bấm In báo cáo để mở browser print dialog.
9. Bấm Tải báo cáo để tải file `.txt`.
10. Reload app, không crash và các module khác không bị ảnh hưởng.

## Next phase

F22.3 - Nhân viên/chấm công MVP.
