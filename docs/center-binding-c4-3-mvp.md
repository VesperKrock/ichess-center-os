# C4.3 - Center Binding MVP

## 1. Summary

C4.3 thêm center binding MVP cho iChess Center OS. Signed-in user được gắn vào center/app mặc định hiện tại và chỉ khi binding sẵn sàng mới mở dashboard.

Scope C4.3:

- Signed-in account -> default app center.
- Chưa làm center selector.
- Chưa làm role matrix chi tiết.
- Chưa cloud bootstrap.
- Có polish login box: nền tối, chữ sáng, input dễ đọc, không box sáng/chói.

MVP hiện tại: valid account + center binding = vào dashboard. Chi tiết owner/qtv/admin/teacher/viewer để phase sau.

## 2. Binding model

```txt
account/session -> center binding -> currentCenterId
```

MVP:

```txt
signed-in account -> default app center
```

Future:

```txt
center_members/Admin tools/Super Admin sẽ quản lý binding thật.
```

Marker C4.3:

```txt
MEMBERSHIP SQL APPLIED: NO
CENTER BINDING MVP FALLBACK: YES
PRODUCTION MULTI-CENTER BINDING: NOT YET
```

## 3. Current center

Center mặc định dùng trong app hiện tại:

```txt
dreamhome
```

Runtime dùng lại `CURRENT_CENTER_ID` từ `src/supabase-auth.js`, không tạo danh sách nhiều center giả và không thêm combobox center selector.

## 4. Runtime states

```txt
signed-out
```

Chỉ thấy Login Portal/auth screen. Dashboard 13 module không render.

```txt
signed-in + bound
```

User signed-in được bind vào default app center `dreamhome`; dashboard render như cũ.

```txt
signed-in + binding error
```

Nếu app không resolve được current center, không mở dashboard và hiển thị trạng thái lỗi trong auth/system area: Không thể xác định cơ sở cho tài khoản này. Vui lòng liên hệ quản trị viên.

```txt
auth unavailable
```

Không crash, không fake đăng nhập, không mở dashboard khi chưa có authenticated user.

## 5. Scope boundaries

C4.3 không làm:

```txt
cloud bootstrap
shared staging dataset 29
xóa seed 8
SQL apply
Teacher Portal
Super Admin
center selector
role matrix chi tiết
```

Không sửa dữ liệu Supabase, không sửa/xóa localStorage runtime, không seed cloud và không commit/push.

## 6. Login polish

Login box đã được polish theo hướng:

- login box nền tối;
- chữ sáng;
- input dễ đọc;
- button rõ nhưng không chói;
- không box sáng/chói;
- không ảnh hưởng theme module sau khi signed-in.

## 7. Next phase

```txt
C4.4 - Shared staging dataset: bỏ seed 8 khỏi default online path, dùng gói 29 để T/P test
```
