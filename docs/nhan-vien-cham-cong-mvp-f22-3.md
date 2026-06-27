# F22.3 - Nhân viên / Chấm công MVP

## Summary

F22.3 hoàn thiện Module Nhân viên theo hướng vận hành: chấm công, tổng buổi, địa điểm dạy và bảng chấm công. MVP đọc dữ liệu giáo viên, thời khóa biểu/ca dạy và session reports hiện có để tổng hợp số buổi hoạt động.

Trọng tâm là biết ai dạy/hoạt động bao nhiêu buổi, ở đâu, trong tuần nào. F22.3 không làm payroll hoàn chỉnh.

## Feedback anh Hải được xử lý

- Có module Nhân viên / Chấm công.
- Có địa điểm dạy.
- Có tổng buổi.
- Có bảng chấm công.
- Có thể tổng hợp từ giáo viên/ca dạy hiện có, ví dụ Thầy Thắng nếu có trong dữ liệu ca/report.
- View chính không đưa lương, phụ cấp khác, tổng tiền thành trọng tâm.

## Cách hiểu MVP

- Chấm công/tổng buổi trước.
- Dữ liệu ca dạy hiện có được tính mỗi ca là 1 buổi hoạt động.
- Giáo viên cũng được xem như nhân sự vận hành trong MVP.
- Không tính lương hoàn chỉnh, không chốt lương tự động.
- Nếu thiếu dữ liệu thì hiển thị empty state rõ.

## UI đã làm

- Header: "Nhân viên / Chấm công".
- Bộ lọc: tuần hiện tại, địa điểm dạy, nhân sự/giáo viên.
- Summary cards:
  - Tổng nhân sự / giáo viên hoạt động.
  - Tổng buổi trong kỳ.
  - Địa điểm dạy đang có.
  - Người hoạt động nhiều nhất.
- Bảng tổng hợp theo nhân sự:
  - Nhân sự.
  - Địa điểm dạy.
  - Tổng buổi.
  - Buổi gần nhất.
  - Ghi chú.
- Bảng chấm công:
  - Ngày.
  - Nhân sự/Giáo viên.
  - Địa điểm dạy.
  - Ca/Lớp.
  - Trạng thái.
  - Ghi chú.

## Trạng thái chấm công

MVP dùng các trạng thái:

- Có mặt: đã có session report cho ca/ngày.
- Vắng: ca bị hủy.
- Dạy bù: ca có lý do học bù.
- Nghỉ phép: trạng thái dự phòng cho bảng chấm công.
- Chưa chấm: có ca dạy nhưng chưa có report.

## Data source

- Teachers: danh sách giáo viên hiện có.
- Schedule sessions: thời khóa biểu/ca dạy hiện có.
- Session reports: dùng để nhận biết ca đã có báo cáo.
- Không tạo staff storage mới.
- Không ghi ngược dữ liệu lương hoặc chấm công vào giáo viên.

## Scope không làm

- Không payroll hoàn chỉnh.
- Không tính lương/phụ cấp/tổng tiền production.
- Không SQL.
- Không Supabase data change.
- Không cloud/realtime mới.
- Không làm Học phí/nối dây F22.4.
- Không C5/C6, Teacher Portal, Super Admin, Đăng ký/signUp.
- Không commit/push.

## Data safety

- Không xóa localStorage.
- Không seed dữ liệu mới.
- Không đổi schema lớn.
- Không sync cloud mới.
- Chỉ đọc teachers/schedule/sessionReports hiện có để tổng hợp.

## Manual QA checklist

1. Mở Module Nhân viên.
2. Kiểm tra giao diện có trọng tâm Chấm công/Tổng buổi/Địa điểm dạy.
3. Đổi tuần hiện tại, địa điểm dạy, nhân sự/giáo viên.
4. Tìm Thầy Thắng hoặc giáo viên có dữ liệu trong ca dạy/report.
5. Kiểm tra tổng buổi hoạt động nếu dữ liệu có.
6. Kiểm tra bảng chấm công có Ngày, Nhân sự/Giáo viên, Địa điểm dạy, Ca/Lớp, Trạng thái, Ghi chú.
7. Kiểm tra không có cột lương/phụ cấp/tổng tiền trong view chính.
8. Reload app, không crash.
9. Mở lại Học viên/Giáo viên/TKB để chắc không ảnh hưởng module khác.

## Next phase

F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí.
