# F22.4 - Nối Học viên ↔ Phụ huynh ↔ Học phí

## Feedback anh Hải được xử lý

- Hồ sơ Học viên có thêm khối `Liên kết phụ huynh & học phí` để thấy nhanh phụ huynh/người chăm sóc, SĐT ba/mẹ, số liên hệ chính, trạng thái học viên và tóm tắt học phí liên quan.
- Module Học phí hiển thị rõ hơn dây `Học viên & phụ huynh`: phụ huynh, số liên hệ, trạng thái học viên và các cảnh báo chăm sóc liên quan.
- Có nền cảnh báo/chăm sóc cơ bản từ dữ liệu hiện có: thiếu SĐT phụ huynh, thiếu tên phụ huynh, chưa có học phí, còn nợ/sắp hết buổi, chưa phân lớp, thiếu giáo viên phụ trách, có ghi chú cần chăm sóc.
- Dữ liệu được đọc/normalize từ record hiện có trong app: học viên, phụ huynh nằm trên hồ sơ học viên, học phí theo `studentId`, lớp/ca học theo `classSessionIds`.

## Phạm vi kỹ thuật

- Thêm helper `src/student-tuition-links.js` để gom dây dữ liệu MVP, chỉ đọc dữ liệu đang có và không ghi ngược vào local/cloud.
- `src/student-detail.js` nhận thêm `tuitionRecords` từ `src/main.js` để render tóm tắt học phí trong hồ sơ học viên.
- `src/tuition-module.js` dùng cùng helper để enrich bảng học phí, search được cả SĐT ba/mẹ và nhãn cảnh báo.
- `src/styles.css` bổ sung style nhỏ cho warning badge và khối phụ huynh trong bảng học phí.

## Giữ nguyên ngoài scope

- Không SQL, không migration, không Supabase data change.
- Không thêm cloud/realtime mới.
- Không làm C5/C6.
- Không commit/push.
- Không dựng bảng phụ huynh riêng hay chỉnh schema production. MVP này vẫn đọc phụ huynh từ dữ liệu học viên hiện có.
- Không sửa nghiệp vụ học phí thu/đóng tiền; phần nối chỉ làm rõ liên kết và cảnh báo đọc được.

## Empty state / fallback

- Nếu học viên chưa có thông tin phụ huynh/người liên hệ, UI hiển thị `Chưa có thông tin phụ huynh/người liên hệ.`
- Nếu học viên chưa có record học phí, UI hiển thị `Chưa có dữ liệu học phí liên kết cho học viên này.`
- Nếu chưa đủ dữ liệu lớp/giáo viên/học phí, warning ghi rõ thiếu dữ liệu thay vì bịa dữ liệu production.

## Smoke

- Smoke chính: `node tests/f22-4-noi-hoc-vien-phu-huynh-hoc-phi-smoke.js`
- Smoke này gọi lại F22.3, F22.2, F22.1.1, F22.1, F22.0 và C4 subset theo yêu cầu để khóa scope.

## Ghi chú sau F22.4

- Khi có phase data/cloud chính thức, có thể tách phụ huynh thành entity riêng và map nhiều người chăm sóc cho một học viên.
- Khi có nguồn học phí cloud ổn định, có thể nâng cảnh báo từ calculated fallback thành workflow chăm sóc có trạng thái xử lý.
