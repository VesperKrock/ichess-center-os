# Hồ sơ hiển thị thành viên Supabase

## Mô hình

S5 dùng bảng `center_members` làm hồ sơ hiển thị theo từng cơ sở. Không tạo bảng profile riêng và không đọc `auth.users` từ frontend.

Các cột bổ sung:

- `display_name`: tên hiển thị, ví dụ `Đức Thắng`.
- `member_label`: nhãn thân thiện, ví dụ `Admin kỹ thuật`.
- `email_snapshot`: email dùng làm fallback.
- `updated_at`: thời điểm cập nhật hồ sơ.

Bảng `transaction_attachments` có thêm `uploaded_by_name` để lưu snapshot tên người tải cho ảnh mới.

## Cài đặt SQL

1. Mở Supabase Dashboard.
2. Mở **SQL Editor**.
3. Dán và chạy nội dung file:

```txt
docs/supabase-s5-user-profiles.sql
```

App không tự chạy SQL và không thay đổi schema từ frontend.

SQL cho phép thành viên đã đăng nhập:

- Đọc profile của các thành viên thuộc cùng cơ sở.
- Chỉ cập nhật các cột profile trên membership của chính mình.
- Không cập nhật `role` qua form hồ sơ.

## Sử dụng trong app

1. Đăng nhập Supabase Cloud.
2. Mở Module **Thu chi**.
3. Trong panel **Supabase Cloud**, mở **Hồ sơ cloud**.
4. Nhập tên hiển thị và nhãn vai trò.
5. Chọn **Lưu hồ sơ**.

Ví dụ:

```txt
display_name: Đức Thắng
member_label: Admin kỹ thuật
email_snapshot: email đăng nhập
```

Sau khi lưu, modal và panel ảnh giao dịch sẽ lookup `uploaded_by` qua profile map của `center_members`.

## Fallback và tương thích

- Nếu SQL S5 chưa chạy, app vẫn đăng nhập, xem, upload và xóa ảnh theo luồng cũ.
- Nếu ảnh cũ chưa có `uploaded_by_name`, app lookup tên qua `center_members`.
- Nếu chưa có profile, app dùng metadata của current user, email hoặc UUID rút gọn.
- Ảnh mới thử lưu `uploaded_by_name`; nếu cột chưa tồn tại, adapter tự retry metadata cũ.

## Bảo mật

- Không có public signup trong S5.
- Không dùng Supabase Admin API hoặc key đặc quyền phía server.
- Frontend không đọc `auth.users`.
- RLS vẫn là lớp kiểm soát quyền theo cơ sở.
- Không đưa secret key hoặc database password vào frontend.
