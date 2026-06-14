# Supabase handoff checklist

## 1. Tạo user anh Hải

1. Mở Supabase Dashboard.
2. Chọn **Authentication** -> **Users** -> **Add user**.
3. Nhập email và mật khẩu tạm; không tạo user từ frontend.
4. Copy UID của user vừa tạo.
5. Chạy câu lệnh sau trong SQL Editor, thay `UID_CUA_USER`:

```sql
insert into public.center_members (center_id, user_id, role)
values ('dreamhome', 'UID_CUA_USER', 'admin')
on conflict (center_id, user_id) do update
set role = excluded.role;
```

6. Yêu cầu anh Hải đổi hoặc quản lý mật khẩu theo quy trình nội bộ.

## 2. Chạy SQL S5

1. Mở `docs/supabase-s5-user-profiles.sql`.
2. Paste toàn bộ nội dung vào Supabase SQL Editor.
3. Review project đang chọn đúng trước khi bấm **Run**.
4. Reload app và đăng nhập.
5. Mở **Thu chi** -> **Supabase Cloud** -> **Hồ sơ cloud**.
6. Cập nhật tên hiển thị và nhãn vai trò.
7. Xác nhận form không cho sửa role.

## 3. Tạo GitHub repository secrets

Vào **Settings** -> **Secrets and variables** -> **Actions** và tạo:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Chỉ dùng Project URL và publishable key. Không thêm key đặc quyền phía server,
thông tin đăng nhập database hoặc mật khẩu người dùng vào GitHub secrets dành
cho Vite build.

## 4. Chạy deploy

1. Commit/push sau khi đã review diff.
2. Mở **Actions**.
3. Chạy workflow **Deploy iChess Center OS to GitHub Pages**, hoặc chờ workflow
   chạy khi push vào `main`.
4. Xác nhận bước install, build, upload artifact và deploy đều pass.
5. Không in giá trị hai secrets trong log để debug.

## 5. Test GitHub Pages

1. Mở URL GitHub Pages của repo.
2. Mở module **Thu chi**.
3. Xác nhận panel báo Supabase đã cấu hình.
4. Login bằng owner, kiểm tra cơ sở DreamHome và role.
5. Logout, login bằng tài khoản anh Hải và kiểm tra role admin.
6. Mở kho ảnh cloud, đổi tháng và thử tìm theo mã giao dịch.
7. Xem và tải một ảnh qua signed URL.
8. Upload một ảnh JPG/PNG/WebP dưới 10 MB.
9. Xóa ảnh test và xác nhận metadata cùng object Storage đã được xử lý.
10. Xác nhận giao dịch Thu chi, tổng tiền, Sổ quỹ và payment không đổi.

## 6. Kết quả cần ghi lại

- URL workflow run.
- Commit SHA đã deploy.
- URL GitHub Pages.
- User/role đã test, không ghi mật khẩu.
- Mã giao dịch và attachment test.
- Kết quả upload, signed URL và delete.

Cho đến khi hoàn thành checklist trên:

```txt
Deploy GitHub Pages thực tế: chưa xác nhận.
```
