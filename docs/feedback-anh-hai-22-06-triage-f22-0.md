# F22.0 - Feedback anh Hải 22/06: Triage + Scope Lock

## Summary

F22.0 là phase triage feedback và khóa phạm vi, không code runtime. Mục tiêu là biến feedback anh Hải ngày 22/06 thành roadmap rõ theo deadline 29/06, 01/07 và 10/07.

C4 đã commit local:

```txt
dc43dbb C4 shared cloud login and realtime MVP
Push: NO
```

C4 đã đạt login gate, center binding MVP `dreamhome`, cloud bootstrap `student`/`teacher`/`schedule_session`, SQL/RLS/realtime đã được user apply thủ công, T/P manual QA cùng thấy cloud data, Học viên 29 -> 30 sau khi thêm qua UI, Giáo viên 6, student realtime/write-through MVP PASS.

C4 hiện đã commit local nhưng chưa push.

Known C4 debt giữ lại:

- Scroll retention Module Học viên chưa pass manual QA.
- Tab order form Học viên/Phụ huynh chưa đủ mượt.
- Legacy policies cần audit trước khi mở rộng C5.
- `schedule_session` cloud ban đầu 0, chưa claim production schedule realtime.

F22 ưu tiên feedback anh Hải vì deadline 29/06 và 01/07. C6 Super Admin/Teacher Portal tạm hoãn. F22.5 UI/icon/background chỉ là khung chờ designer/asset sau, không phải blocker cho F22.1-F22.4.

## Raw Feedback Grouped

### Báo cáo

- Module Báo cáo cần realtime về mặt định hướng, nhưng F22 chỉ làm MVP khi dữ liệu thật đủ an toàn.
- Báo cáo ngày: công việc ngày, tình huống/vấn đề trong ngày, doanh thu trong ngày, ghi chú vận hành.
- Báo cáo tuần: tổng hợp tuần, biểu đồ thu/chi dạng cột, biểu đồ học/vắng/nghỉ dạng tròn/quạt.
- Phải có hướng download và in.
- Báo cáo kho cập nhật sau, không ép vào MVP đầu nếu làm chậm deadline 29/06.

Chart thu/chi:

- Trục ngang: tuần 1/2/3/4 kèm ngày dạng `dd/mm/yy`.
- Trục dọc: doanh thu/chi phí, đơn vị VNĐ.
- Min: 0 VNĐ.
- Max: auto, ưu tiên doanh thu cao nhất + 10 triệu.
- Cột thể hiện: doanh thu và chi phí.

Chart học/vắng/nghỉ:

- 100% là tổng số học viên.
- M là số học viên đi học trong tuần.
- `100% - M` là số học viên nghỉ/vắng.

### Kho hàng

- Thêm vật tư hoặc chuẩn hóa wording thành Thêm sản phẩm.
- Tìm vật tư/tài sản rõ hơn.
- Đơn vị tính là combobox.
- Làm gọn form Kho hàng.
- Không làm cloud/realtime kho trong F22.1 nếu chưa thật cần.

### Nối dữ liệu

- Nối Học viên -> Phụ huynh -> Học phí.
- Chuẩn bị realtime nhưng không claim production realtime nếu chưa đủ entity/backing data.
- Học phí đọc được học viên và phụ huynh liên quan.
- Tạo nền cho cảnh báo/chăm sóc: học phí, kế hoạch tiếp theo, thông báo cho phụ huynh.

### Nhân viên

- Chấm công và tính lương theo ca/buổi dạy.
- Ví dụ: Thầy Thắng hoạt động ở cơ sở này bao nhiêu buổi, tính theo ca dạy.
- Một cơ sở có nhiều giáo viên phụ trách nhiều lớp.
- Sử dụng bảng chấm công nhân viên hiện có.
- View chính nên tập trung địa điểm dạy, tổng buổi, bảng chấm công.
- Các cột tên nhân viên, mã nhân viên, lương, phụ cấp khác, tổng tiền không nên làm rối view chính; tên/mã có thể điền trong bảng chấm công.

### UI/Icon/Background

- Cần hỗ trợ tân trang icon, sắp xếp bố trí, chuẩn hóa vị trí các mục trong folder hiện có.
- Mục tiêu đẹp, chuẩn để sử dụng.
- Không đụng logic/chức năng phần mềm.
- F22.5 chỉ giữ khung chờ designer/asset sau; chưa làm icon/background lớn.
- Có thể chuẩn bị slot cho ảnh/icon/background và ý tưởng Start -> Cài đặt giao diện -> chọn background, nhưng chưa implement trong F22.0.

### Giá trị phần mềm / vận hành cơ sở

- Lưu trữ thông tin học viên và phụ huynh.
- Thu chi rõ ràng, minh bạch, realtime theo định hướng, có cảnh báo/kế hoạch tiếp theo.
- Chăm sóc học viên/phụ huynh qua cảnh báo, thông báo, dữ liệu.
- Quản lý lớp học, vật tư/sản phẩm/kho.
- Báo cáo dữ liệu, cảnh báo, xuất/in.
- Tổng hợp dữ liệu trên cùng phần mềm, tránh thất lạc file/form.
- Ví dụ kho cần cảnh báo vận hành: học viên học 2 tuần chưa được cấp sách; đăng ký mua áo 1 tuần vẫn chưa nhận.

## Deadline Matrix

| Deadline | Nhóm việc | F22 phase | Mức ưu tiên | Ghi chú |
| --- | --- | --- | --- | --- |
| 29/06 | Kho quick polish | F22.1 | Cao | Quick win: gọn form, combobox đơn vị, tìm vật tư/tài sản rõ hơn. |
| 29/06 | Báo cáo ngày/tuần MVP | F22.2 | Rất cao | Quan trọng nhất với anh Hải: báo cáo ngày, tuần, in/download, chart MVP. |
| 29/06 | Nhân viên/chấm công MVP | F22.3 | Cao | Tập trung ca dạy, địa điểm, tổng buổi; chưa làm lương phức tạp. |
| 01/07 | Nối Học viên -> Phụ huynh -> Học phí | F22.4 | Rất cao | Hoàn thành dây dữ liệu tối thiểu, chuẩn bị C5.2. |
| 10/07 | UI/icon/background placeholder | F22.5 | Trung bình | Chỉ tạo khung chờ designer/asset; không làm designer work nặng. |
| Sau F22 | C5/C6, Teacher Portal, Super Admin, production expansion | Sau F22 | Sau | Không triển khai trong F22.0. |

## F22 Phase Plan

| Phase | Mục tiêu | Output | Không làm | Risk |
| --- | --- | --- | --- | --- |
| F22.0 | Triage feedback + scope lock | Doc này + smoke guard | Runtime, SQL, push | Nếu scope mơ hồ sẽ trượt deadline. |
| F22.1 | Kho hàng quick polish | Form gọn, wording rõ, combobox đơn vị, search rõ | Cloud/realtime kho | Thấp, vì chủ yếu UI hiện có. |
| F22.2 | Báo cáo ngày/tuần MVP | Báo cáo ngày, tuần, print/download, chart MVP | Claim realtime production khi data chưa đủ | Trung bình/cao do cần gom dữ liệu từ nhiều module. |
| F22.3 | Nhân viên/chấm công MVP | View chấm công theo địa điểm/tổng buổi/ca dạy | Payroll phức tạp, phụ cấp, tổng lương production | Trung bình do dữ liệu lịch/giáo viên cần rõ. |
| F22.4 | Nối Học viên -> Phụ huynh -> Học phí | Link dữ liệu tối thiểu và nền cảnh báo/chăm sóc | Cloud source of truth học phí đầy đủ nếu chưa sang C5.2 | Cao, vì chạm nhiều module liên quan. |
| F22.5 | UI/icon/background placeholder | Slot/guide cho asset và ý tưởng cài đặt giao diện | Designer work nặng, đổi logic | Thấp nếu giữ đúng placeholder. |

## Scope Lock

- F22.1 Kho: làm trước vì quick win, dễ nghiệm thu và giảm cảm giác rối.
- F22.2 Báo cáo: làm ngay sau Kho vì quan trọng nhất với anh Hải và deadline 29/06.
- F22.3 Nhân viên: làm MVP chấm công/ca dạy, không mở payroll phức tạp.
- F22.4 Nối dây: hoàn thành trước 01/07 để Học viên/Phụ huynh/Học phí có dữ liệu liên quan.
- F22.5 UI placeholder: chỉ khung chờ designer/asset sau, không blocker cho F22.1-F22.4.

Không làm trong F22.0:

- Không code runtime.
- Không code Báo cáo/Kho/Nhân viên/Học phí.
- Không code background/icon.
- Không SQL.
- Không Supabase data change.
- Không push, không commit.
- Không C5/C6, Teacher Portal, Super Admin.

## Push Policy

Push: NO until F22.4 done, unless user explicitly asks.

Nếu push sớm, phải ghi rõ đây là online alpha, chưa phải bản nghiệm thu feedback 22/06.

## Next Step

Next: F22.1 - Kho hàng quick polish.

Lý do: F22.1 là quick win ít rủi ro, giúp làm gọn trải nghiệm vận hành trước khi vào F22.2 Báo cáo MVP, phần quan trọng nhất với anh Hải.
