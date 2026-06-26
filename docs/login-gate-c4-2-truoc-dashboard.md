# C4.2 - Login Gate trước Dashboard

## 1. Summary

C4.2 gắn login gate trước dashboard. Khi chưa đăng nhập, app chỉ thấy Login Portal/app auth screen. Khi đã đăng nhập hợp lệ, app mở dashboard 13 module như trước.

Phase này giữ auth UI/logic C4.1, không có Đăng ký, không gọi `signUp`, không hardcode tài khoản/mật khẩu, không center binding runtime và không cloud bootstrap.

## 2. Before / After

Before:

```txt
C4.1 đã tách auth khỏi Thu Chi nhưng dashboard vẫn mở khi chưa đăng nhập.
```

After:

```txt
C4.2 ẩn dashboard cho tới khi auth session hợp lệ.
```

## 3. Runtime states

```txt
auth loading
```

App hiển thị auth screen và trạng thái đang kiểm tra. Dashboard, module grid, module windows và taskbar app chính chưa render.

```txt
signed out
```

App chỉ hiển thị Login Portal/app auth screen. Người dùng thấy form đăng nhập hệ thống với Email / Tài khoản, Mật khẩu và Đăng nhập.

```txt
signed in
```

App mở dashboard 13 module như cũ. App auth status và nút Đăng xuất vẫn ở tầng app/system. C4.2 không bắt buộc center binding.

```txt
auth unavailable
```

Nếu Supabase/Auth chưa cấu hình, app không crash, hiển thị trạng thái cấu hình đăng nhập và không im lặng mở dashboard như đã đăng nhập.

## 4. Scope boundaries

C4.2 không làm:

```txt
center binding
cloud bootstrap
SQL apply
seed 29
xóa seed 8
Teacher Portal
Super Admin
```

C4.2 cũng không sửa dữ liệu Supabase, không sửa/xóa localStorage runtime, không seed cloud và không commit/push.

## 5. Next phase

```txt
C4.3 - Center binding: tài khoản admin một center vào thẳng dashboard
```
