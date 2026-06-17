# Audit dây dữ liệu Bảng điểm danh với 12 module

## 1. Tổng quan

Module 13 - Bảng điểm danh là màn tổng hợp read-only. Module này không nhập điểm danh thật, không xuất Excel/PDF, không ghi Thu chi/Sổ quỹ, không tạo notification và không sync Supabase.

Sau F15K.4, real mode chỉ đọc:

- Học viên: danh sách học viên, mã học viên, tên, năm sinh, `classSessionIds`.
- Cài đặt cơ sở: danh mục Ca học/Lớp trong `ichessCenterOS.classSessions.dreamhome`.
- Học phí: gói buổi, kỳ/gói đã đóng, dữ liệu fixture import nếu cần kiểm thử cycle.
- Thời khóa biểu/Báo cáo buổi học: `sessionReports` trong `ichessCenterOS.sessionReports.dreamhome`.

Dữ liệu demo cũ F15K.1/F15K.3 có `isDemoAttendance`, `sourceModule=bang-diem-danh-demo` hoặc `demoBatchId=attendance-board-demo-foundation` không được đưa vào lookup real mode.

## 2. Source of truth của Bảng điểm danh

| Nhóm dữ liệu | Source of truth | Storage/key | Ghi chú |
| --- | --- | --- | --- |
| Học viên | Module Học viên | `ichessCenterOS.students.dreamhome` | Đọc `student.id`, `studentCode`, `fullName`, `birthDate/birthYear`, `classSessionIds`, `assignedTeacherId`. |
| Ca học/Lớp | Cài đặt cơ sở | `ichessCenterOS.classSessions.dreamhome` | Đọc `id`, `daysLabel`, `startTime`, `endTime`, `displayLabel`, `status`. |
| Gói/kỳ học phí | Module Học phí | `ichessCenterOS.tuition.dreamhome` | Đọc `totalSessions`, `usedSessions`, `currentTermNumber`, `termHistory`, trạng thái thanh toán nếu có. |
| Ô ngày đã học | Thời khóa biểu/Báo cáo buổi học | `ichessCenterOS.sessionReports.dreamhome` | Đọc `attendance`, `attendanceStatus`, `displayValue`, `credits`, `countsTowardTuition`, `sourceTag`. |
| Dữ liệu nhập Angel Wings | Import có kiểm soát | Cùng các key thật phía trên | `sourceModule=angel-wings-import`, `sourceTag=angel-wings-2026-06`, `importBatchId=angel-wings-2026-06-attendance`. |

## 3. Audit 12 module

| Module | Dữ liệu liên quan tới Bảng điểm danh | Storage key/source | Hiện đã nối chưa | Có nên nối không | Mức ưu tiên | Ghi chú/rủi ro |
| --- | --- | --- | --- | --- | --- | --- |
| Học viên | `id`, mã học viên, họ tên, năm sinh, `classSessionIds`, giáo viên phụ trách | `ichessCenterOS.students.dreamhome` | Có | Có | Rất cao | Source chính để biết bé nào thuộc ca nào. Import Angel Wings chỉ append ca thiếu, không xóa dữ liệu thật. |
| Học phí | Gói buổi, kỳ/gói đã đóng, số buổi đã học nếu chưa có report | `ichessCenterOS.tuition.dreamhome` | Có | Có | Rất cao | Cycle gói cần phân biệt gói 8/12/16/32, không hard-code 8 toàn hệ thống. |
| Thu Chi | Thanh toán học phí gián tiếp | `ichessCenterOS.cashflow.dreamhome` | Chưa | Chưa trong F15K.4 | Thấp | Không ghi/đọc trực tiếp để tránh tạo nghiệp vụ tài chính sai. |
| Sổ Quỹ | Đối soát tiền mặt | `ichessCenterOS.cashbookSettings.dreamhome`, `ichessCenterOS.cashbookReconciliations.dreamhome` | Chưa | Không trong phase này | Thấp | Không liên quan trực tiếp tới điểm danh. |
| Kho hàng | Vật tư lớp học | `ichessCenterOS.inventory.dreamhome`, `ichessCenterOS.inventoryRequests.dreamhome` | Chưa | Không | Thấp | Không ảnh hưởng attendance. |
| Giáo viên | Giáo viên phụ trách ca/lớp | `ichessCenterOS.teachers.dreamhome`, field giáo viên trong học viên/ca | Một phần | Có sau này | Trung bình | Angel Wings ghi teacherName Phạm Đức Thắng ở ca/report, chưa bắt buộc tạo teacher nếu thiếu. |
| Thời khóa biểu | Ngày học dự kiến, report buổi học | `ichessCenterOS.schedule.dreamhome`, `ichessCenterOS.sessionReports.dreamhome` | Một phần | Có | Cao | `sessionReports` đã là source ô ngày; schedule link classSessionIds còn thiếu chặt chẽ, cần phase sau. |
| Phụ huynh / Tư vấn | Học thử, lead chuyển đổi thành học viên | `ichessCenterOS.parentConsultations.dreamhome` | Chưa | Có sau này | Trung bình | Liên quan trial nhưng chưa là source điểm danh thật. |
| Nhân viên | Người thao tác/import | Chưa có key module riêng rõ ràng | Chưa | Có sau này | Thấp | Có thể dùng audit log sau này. |
| Cài đặt cơ sở | Danh mục Ca học/Lớp | `ichessCenterOS.classSessions.dreamhome` | Có | Có | Rất cao | Source chính cho filter và cột ca học. |
| Báo cáo | Tổng hợp admin | Chưa có module báo cáo riêng; sessionReports nằm ở Thời khóa biểu | Một phần | Có sau này | Trung bình | Module 13 hiện đọc trực tiếp sessionReports thay vì module báo cáo riêng. |
| Đang cập nhật / module dự phòng | Không có dữ liệu điểm danh | Không ổn định | Chưa | Không | Thấp | Không nối trong F15K.4. |

## 4. Dữ liệu thật hiện đã có

- Học viên, Ca học/Lớp, Học phí và sessionReports đang lưu localStorage.
- Báo cáo buổi học từ Thời khóa biểu có thể tạo `sessionReports` thật.
- Nếu report thật không có `sourceTag=angel-wings-2026-06`, UI ghi nguồn là `Báo cáo buổi học`.

## 5. Dữ liệu demo cũ và cách loại bỏ

Demo cũ được nhận diện bởi một trong các dấu hiệu:

- `isDemoAttendance: true`
- `sourceModule: "bang-diem-danh-demo"`
- `demoBatchId: "attendance-board-demo-foundation"`

Real mode của Bảng điểm danh bỏ qua các report này khi build lookup. Nút `Xóa demo cũ` chỉ lọc các report demo cũ khỏi `sessionReports`, không xóa report thật và không xóa Angel Wings.

## 6. Dữ liệu Angel Wings import

Import Angel Wings dùng source có kiểm soát:

- `sourceModule: "angel-wings-import"`
- `sourceTag: "angel-wings-2026-06"`
- `importBatchId: "angel-wings-2026-06-attendance"`
- `isImportedAttendance: true`

Flow `Nạp dữ liệu Angel Wings` upsert:

- 4 ca học/lớp: `T4-T6 19:00-20:30`, `T7-CN 15:00-16:30`, `T7-CN 10:30-12:00`, `T7-CN 17:30-19:00`.
- Học viên theo tên normalized + năm sinh; nếu thiếu thì tạo mới, nếu đã có thì append ca học thiếu.
- `sessionReports` theo ca/ngày với sourceTag riêng.
- Fixture học phí tối thiểu cho học viên Angel Wings nếu chưa có tuition record, đánh dấu `isImportedTuitionFixture: true`.

Flow `Xóa dữ liệu Angel Wings` xóa report import và fixture học phí import. Học viên thật được giữ lại.

## 7. Logic gói/kỳ học phí đúng

Với gói N buổi và tổng paid attendance credit tới ô hiện tại là A:

- `cycleIndex = Math.floor((A - 1) / N) + 1`
- `sessionNumberInCycle = ((A - 1) % N) + 1`
- `remainingInCycle = N - sessionNumberInCycle`

Ví dụ gói 8 học 9 buổi:

- Kỳ 2
- Buổi 1/8
- Còn 7/8

Ô đầu kỳ mới màu xanh nếu có kỳ/gói đã đóng theo Học phí. Nếu thiếu kỳ mới đã đóng, ô chuyển cảnh báo đỏ. `T` là học thử/trial, không tính vào gói. Ô `3+4` preserve display và lưu `credits: [3, 4]`.

## 8. Dây còn thiếu để tự động hóa 100%

- Schedule chưa có link chuẩn bắt buộc tới `classSessionId` cho mọi occurrence.
- Payment/cashflow chưa được nối an toàn sang tuition term status.
- Chưa có audit log người import/xóa import.
- Chưa có module báo cáo admin riêng làm source trung gian.

## 9. Rủi ro hiện tại

- Dữ liệu Angel Wings là import từ bảng user cung cấp, không phải điểm danh nhập trực tiếp trong app.
- Fixture học phí Angel Wings chỉ để kiểm tra cycle, không phải thanh toán thật.
- Nếu học viên trùng tên nhưng thiếu năm sinh trong dữ liệu cũ, hệ thống có thể tạo record mới để tránh ghi đè nhầm.

## 10. Phase đề xuất tiếp theo

- Chuẩn hóa link schedule `classSessionId` và report occurrence.
- Thêm audit log import/xóa import.
- Nối payment thật sang tuition term status bằng luồng học phí riêng, không làm trong Module 13.
- Tạo export sau khi attendance thật ổn định.

## 11. Checklist test tay

1. Mở Module 13, bấm `Xóa demo cũ`.
2. Bấm `Nạp dữ liệu Angel Wings`.
3. Mở Học viên, kiểm tra học viên Angel Wings có ca học đúng.
4. Mở Cài đặt cơ sở, kiểm tra 4 ca Angel Wings.
5. Quay lại Bảng điểm danh, filter từng ca.
6. Kiểm tra ô `T` hiển thị học thử/trial và không tính gói.
7. Kiểm tra `3+4`, `5+6`, `7+8`, `1+2` vẫn giữ dấu `+`.
8. Kiểm tra gói 8 học 9 credits hiển thị Kỳ 2, Buổi 1/8, còn 7/8.
9. Kiểm tra không có Thu chi/Sổ quỹ/notification mới.
