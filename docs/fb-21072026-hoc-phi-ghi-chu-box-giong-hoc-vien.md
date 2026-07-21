# Feedback 21/07/2026 - Học phí ghi chú box giống Học viên

## Phạm vi

Module Học phí đổi cột `Ghi chú` trong bảng chính từ nội dung dài sang badge/nút gọn:

- `Chưa có ghi chú`
- `Có ghi chú (n)`

Bấm badge mở box `Chăm sóc / Ghi chú - <Tên học viên>` theo phong cách Module Học viên.

## Data

Ghi chú Học phí lưu vào `students[].careNotes` theo `studentId`, dùng chung model ghi chú chăm sóc của Module Học viên.

Ghi chú tạo từ Học phí có metadata:

- `sourceModule: "tuition"`
- `author: "Admin DreamHome"`
- `tags`
- `content`
- `createdAt`
- `updatedAt`

Nhờ dùng chung `students[].careNotes`, ghi chú thêm từ Học phí cũng làm Module Học viên hiển thị `Có ghi chú`.

## Box ghi chú

Box mở dạng full-window trong Module Học phí, dùng vùng body scroll riêng để không bị taskbar che hoặc bị cắt dưới.

Box có:

- lịch sử ghi chú chăm sóc dạng timeline/hộp thư;
- form thêm ghi chú;
- `Tag / chủ đề`;
- `Nội dung ghi chú`;
- chip gợi ý tư vấn Học phí;
- `Lưu ghi chú`;
- `Hủy nhập`;
- feedback `Đã lưu ghi chú chăm sóc.`

Chip gợi ý append nội dung vào textarea và tự đặt tag mặc định `Học phí` nếu tag đang trống.

## F23.1 full-window và scroll

`Bảng chăm sóc cuối tháng` không còn chen trực tiếp dưới bảng Học phí chính. Màn chính chỉ còn entry/nút `Chăm sóc cuối tháng` / `Mở bảng chăm sóc`; bấm nút mở window riêng full-window trong Module Học phí.

Các action mở/đóng ghi chú, chip gợi ý, lưu/hủy ghi chú, mở/đóng chăm sóc cuối tháng và lưu ghi chú chăm sóc tháng dùng scroll lock: capture `window.scrollX/Y`, các vùng scroll của Module Học phí, care note window, monthly care window và scrollable ancestors trước khi render; sau render restore qua nhiều nhịp `requestAnimationFrame`.

## Guard

Không update tuition.usedSessions.

Không đổi tổng số buổi, số buổi đã học, số buổi còn lại, số tiền đã đóng, số tiền còn nợ hoặc công thức học phí.

Không update Bảng điểm danh.

Không tạo attendance canonical.

Không attendance-to-tuition automation.

Không Auth/Supabase/SQL/deploy.

Không push/commit.
