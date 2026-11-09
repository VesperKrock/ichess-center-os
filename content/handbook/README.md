# Sổ tay iChess V1 — nội dung phát hành

Mỗi bài trong `articles/` là Markdown riêng, có mã ổn định và JSON ở đầu tệp. `chapters.json` tổ chức 9 module; `guidance.json` nêu phạm vi áp dụng và những nhánh chỉ được tra cứu.

Đây là nội dung cho người dùng cuối. Không thêm log, thông tin xác thực, dữ liệu thật hoặc hồ sơ kiểm chứng nội bộ vào thư mục này. Trạng thái biên tập trong metadata được giữ nguyên; việc phát hành V1 không tự xác nhận mọi thao tác đã được kiểm thử.

Khi sửa bài, giữ ID/liên kết, đối chiếu tên nút và điều kiện với ứng dụng. Không bỏ giới hạn của nhánh chưa được xác minh. Chạy `node --test tests/handbook-release.test.mjs` và build trước khi phát hành. Chỉ dùng ảnh có dữ liệu minh họa trong `public/handbook/images/`.

Trang đọc trực tiếp: `/ichess-center-os/handbook/`. Trong ứng dụng, mở **Sổ tay** từ Taskbar; Admin tự thao tác nghiệp vụ tại module liên quan.
