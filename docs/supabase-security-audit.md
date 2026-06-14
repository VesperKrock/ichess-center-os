# Supabase security audit S1-S7

Ngày audit: 2026-06-14

## Kiến trúc hiện tại

- Frontend Vite dùng Supabase publishable key tại thời điểm build.
- Auth dùng email/password và session của Supabase Auth.
- Cơ sở hiện tại là `dreamhome`.
- Quyền ứng dụng được đọc từ `center_members` qua RLS.
- Metadata ảnh nằm trong `transaction_attachments`.
- File ảnh nằm trong bucket private `transaction-images`.
- Xem và tải ảnh dùng signed URL có thời hạn.
- Frontend không có API quản trị người dùng và không có backend riêng.

## Thành phần liên quan

- `centers`: danh sách cơ sở.
- `center_members`: membership, role và hồ sơ hiển thị theo cơ sở.
- `transaction_attachments`: metadata ảnh giao dịch.
- `transaction-images`: bucket private chứa ảnh JPEG đã nén.

## Quy tắc bảo mật

- Chỉ publishable key được phép đưa vào Vite frontend.
- Key đặc quyền phía server và thông tin database không được đưa vào repo,
  GitHub Actions build environment hoặc trình duyệt.
- Bucket phải giữ private.
- RLS và Storage policy phải xác thực membership theo `center_members`.
- Frontend không đọc `auth.users`.
- Form Hồ sơ cloud chỉ cập nhật `display_name`, `member_label`,
  `email_snapshot` và `updated_at`; không cập nhật `role`.

## Kết quả audit tĩnh

- Không phát hiện key thật, JWT Supabase, URL project thật hoặc connection
  string database trong các file tracked.
- `.env.local`, các file ghi chú mật khẩu local và thư mục secret local đều
  bị `.gitignore` chặn; chúng không được đọc trong audit.
- `.env.example` chỉ có placeholder.
- Workflow Pages lấy đúng hai biến Vite từ repository secrets và không echo
  giá trị.
- Supabase client không đưa key vào status object hoặc UI.
- Auth, metadata, profile và Storage helper trả lỗi mềm khi thiếu config,
  login hoặc membership.
- Upload chỉ nhận JPEG đã nén; đầu vào được giới hạn JPG/JPEG, PNG, WebP và
  tối đa 10 MB trước khi nén.
- Ảnh được nén JPEG, cạnh dài tối đa 1920 px, quality 0.82 và nền trắng.
- Storage path bị giới hạn trong
  `dreamhome/transaction-images/YYYY/MM/`.
- Xem/tải dùng signed URL; không dùng public URL cố định.
- Xóa ảnh gọi Storage và metadata adapter, không xóa giao dịch Thu chi.
- Gallery và panel Cloud chỉ đọc metadata; không tạo cashflow/payment hoặc
  ghi Sổ quỹ.
- SQL S5 thu hồi quyền UPDATE rộng rồi chỉ cấp bốn cột hồ sơ.

## Lưu ý về ảnh local cũ

Luồng ảnh Supabase S1-S6 không tạo base64 và không ghi ảnh cloud vào
`localStorage`. Repo vẫn còn tính năng ảnh đính kèm local có từ trước trong
form Thu chi, dùng data URL tối đa 1 MB. Đây là luồng legacy riêng, không được
gọi bởi nút `Chèn ảnh` cloud và chưa được migrate trong S7.

## Cần người dùng test tay

- Tạo user anh Hải trong Supabase Dashboard và gán membership.
- Chạy SQL S5 trong SQL Editor.
- Login local bằng owner và admin.
- Xác nhận RLS cho phép xem metadata/profile cùng cơ sở.
- Upload, xem, tải và xóa một ảnh thật trong bucket private.
- Xác nhận thao tác ảnh không đổi Thu chi, Sổ quỹ hoặc payment.
- Tạo hai repository secrets, chạy workflow và kiểm tra GitHub Pages.
- Xác nhận signed URL hoạt động trên bản Pages.

Deploy GitHub Pages thực tế: chưa xác nhận.

## Chưa thực hiện

- Public signup.
- Invite user chuẩn bằng Edge Function hoặc backend tin cậy.
- Migrate dữ liệu Thu chi lên Supabase.
- Migrate ảnh local legacy khỏi `localStorage`.
- Pen test hoặc production security audit độc lập.
