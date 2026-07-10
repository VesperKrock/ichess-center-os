# C8.4 - Teacher Portal - Chi tiết ca dạy của tôi

## Phạm vi

C8.4 mở rộng `Lịch dạy của tôi` trong Teacher Portal preview để giáo viên bấm `Xem ca dạy` và xem chi tiết ca read-only tại chỗ.

## Đã làm

- Giữ teacher context preview từ hồ sơ giáo viên, không dùng Auth thật.
- Giữ filter lịch theo `teacherId`; slot thiếu `teacherId` không hiển thị trong lịch giáo viên.
- Detail ca hiển thị thông tin ca, giáo viên, học viên, ghi chú/trạng thái và nguồn ca.
- Nếu có `classSessionId`, detail đọc tên ca cố định từ dữ liệu Ca học/Lớp hiện có.
- Nếu có `sessionReports`, detail chỉ đọc trạng thái/tóm tắt báo cáo.
- Cảnh báo nhẹ khi thiếu `teacherId`, thiếu `studentIds`, thiếu `classSessionId` cho lịch cố định, hoặc student id không tìm thấy trong hồ sơ học viên.

## Guard

- Không tạo Teacher Auth/login thật.
- Không chụp ảnh vào/ra.
- Không upload ảnh.
- Không tạo/sửa/xóa session report.
- Không ghi attendance.
- Không sửa Học phí/Bảng điểm danh/TKB.
- Không attendance-to-tuition automation.
- Không update `tuition.usedSessions`.

## Manual QA

1. Mở `Giáo viên`.
2. Mở hồ sơ giáo viên có lịch.
3. Bấm `Mở Teacher Portal`.
4. Trong `Lịch dạy của tôi`, bấm `Xem ca dạy`.
5. Kiểm tra detail có ngày/giờ, lớp/nhóm, phòng, giáo viên, học viên, trạng thái báo cáo nếu có.
6. Kiểm tra detail chỉ đọc và không có chụp ảnh vào/ra, điểm danh, hoặc nút tạo báo cáo.
