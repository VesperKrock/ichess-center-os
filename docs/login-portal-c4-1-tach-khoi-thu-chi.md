# C4.1 - Tách đăng nhập khỏi Module Thu Chi

## 1. Summary

C4.1 tách đăng nhập Supabase/Cloud khỏi Module Thu Chi và chuyển auth lên tầng app/system. Auth chuyển lên tầng app/system, không có đăng ký, không gọi `signUp`, không hardcode tài khoản/mật khẩu và không chạy SQL.

Tài khoản vẫn được tạo thủ công trong Supabase/Admin tools. C4.1 chưa gate dashboard: người dùng chưa đăng nhập vẫn thấy dashboard như trước. C4.2 mới làm Login Portal gate, tức chưa đăng nhập chỉ thấy Login Portal.

## 2. Before / After

Before:

```txt
Đăng nhập Supabase/Cloud nằm trong Module Thu Chi.
```

After:

```txt
Đăng nhập nằm ở tầng app/system.
Module Thu Chi chỉ dùng auth state nếu cần cloud.
```

## 3. UI behavior

- Chưa đăng nhập: app-level auth entry hiển thị trạng thái và form đăng nhập hệ thống.
- Đã đăng nhập: app-level auth entry hiển thị trạng thái tài khoản và nút đăng xuất.
- Dashboard vẫn mở như cũ trong C4.1.
- C4.2 mới chặn dashboard bằng Login Portal gate.

Auth entry cấp app dùng các nhãn:

```txt
Đăng nhập hệ thống
Email / Tài khoản
Mật khẩu
Đăng nhập
Đăng xuất
Đã đăng nhập
Chưa đăng nhập
```

## 4. No signup policy

- Không có action Đăng ký trong auth entry.
- Không gọi `signUp`.
- Không hardcode tài khoản/mật khẩu trong code.
- Tài khoản được tạo thủ công trong Supabase/Admin tools.

## 5. Impact on Thu Chi

- Không đổi nghiệp vụ Thu Chi.
- Không đổi dữ liệu Thu Chi.
- Không xóa cloud image code đang dùng.
- Module Thu Chi không còn render form đăng nhập đầy đủ.
- Nếu cloud feature cần login, Thu Chi hiển thị message nhẹ: Vui lòng đăng nhập ở cổng hệ thống để dùng tính năng cloud.
- Flow thu/chi local vẫn giữ nguyên.

## 6. Next phase C4.2

```txt
C4.2 - Login gate: chưa đăng nhập chỉ thấy Login Portal
```

C4.1 không làm C4.2 sớm: không ẩn 13 module, không chặn dashboard, không center binding runtime và không cloud bootstrap mới.
