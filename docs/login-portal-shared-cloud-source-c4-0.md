# C4.0 - Login Portal + Shared Cloud Source of Truth

## 1. Executive summary

C4 là tầng chuyển iChess Center OS từ prototype localStorage sang trải nghiệm đăng nhập và dùng dữ liệu cloud chung. C4.0 chỉ chốt thiết kế, chưa triển khai runtime Login Portal, chưa chạy SQL, chưa đổi dữ liệu và chưa seed cloud.

Thiết kế C4.0 chốt các nguyên tắc sau:

- Trước đăng nhập, người dùng chỉ thấy Login Portal.
- Sau đăng nhập hợp lệ và có center binding, app mở dashboard 13 module.
- App không có đăng ký trong app.
- Tài khoản do admin/dev tạo thủ công trong Supabase/Admin tools.
- MVP chỉ cần cổng mở/đóng: có tài khoản hợp lệ và được gắn center thì được vào, chưa cần role matrix chi tiết.
- Phân quyền chi tiết, Super Admin và Admin tools quản lý tài khoản để ở phase tương lai.
- Khi online, cloud là source of truth.
- localStorage chỉ là cache/fallback, không còn là nguồn dữ liệu chính cho online path.

## 2. Login Portal model

Màn hình Login Portal tương lai có nội dung tối thiểu:

```txt
iChess Center OS
Email / Tài khoản
Mật khẩu
Đăng nhập
```

Portal không hiển thị các hành động tự tạo tài khoản hoặc tự tạo cơ sở. Các hành động không thuộc thiết kế portal MVP:

```txt
Đăng ký
Tạo tài khoản
Tạo cơ sở mới
```

Sau này có thể thêm liên kết hỗ trợ như:

```txt
Quên mật khẩu / Liên hệ quản trị viên
```

C4.0 chỉ ghi nhận thiết kế này. Không tách login khỏi Module Thu Chi và không code runtime portal trong phase này.

## 3. Account creation policy

App không cho user tự đăng ký. Tài khoản được tạo trong Supabase/Admin tools hoặc công cụ quản trị nội bộ tương lai.

Chính sách tài khoản MVP:

- Có thể dùng tài khoản cơ sở hoặc tài khoản admin cơ sở.
- Không hardcode email/password trong code.
- Không dùng email cá nhân để fake quyền.
- Không fake membership.
- Quyền truy cập được xác định bằng account hợp lệ và center binding, không bằng text email phía client.

Ví dụ ở mức thiết kế, không đưa vào code:

```txt
Tài khoản cơ sở DreamHome hoặc admin DreamHome
Mật khẩu do admin cấp
Center binding: DreamHome
```

## 4. One-center admin MVP

Trong Admin Center OS MVP, mỗi tài khoản admin/cơ sở thường gắn với một center. Sau khi đăng nhập, app đi thẳng vào dashboard của center đó. MVP chưa cần combobox chọn cơ sở cho Admin app.

Flow được chốt:

```txt
Mở app
-> chưa đăng nhập: Login Portal
-> đăng nhập
-> kiểm center binding
-> nếu có 1 center: vào dashboard 13 module
-> nếu không có center: báo chưa được cấp quyền
```

Nếu sau này một admin được gắn nhiều center, C4+ có thể bổ sung center selector. Đây không phải scope C4.0.

## 5. Center binding

Concept dữ liệu:

```txt
account -> center_members/binding -> centerId
```

Giai đoạn hiện tại chỉ cần xác định tài khoản có được vào center hay không:

- Account hợp lệ + center binding là được mở dashboard.
- Chưa cần role matrix phức tạp.
- Role chi tiết để Super Admin/Admin tools tương lai xử lý.
- Nếu không có center binding, app phải báo chưa được cấp quyền thay vì mở dashboard bằng dữ liệu local.

## 6. Shared Cloud Source of Truth

Online mode dùng cloud làm nguồn dữ liệu chính. localStorage chỉ là cache/fallback để hỗ trợ trải nghiệm khi tải lại, mất mạng, hoặc bảo vệ dữ liệu local trong các tình huống lỗi.

Nguyên tắc bootstrap sau login:

- Mở app sau login phải bootstrap dữ liệu từ cloud theo `centerId`.
- Nếu cloud có dữ liệu, app dùng cloud.
- Nếu cloud chưa ready, app không được im lặng quay về seed cũ làm lệch dữ liệu giữa T/P, Chrome thường và tab ẩn danh.
- Runtime tương lai cần trạng thái rõ: đang tải dữ liệu cloud, không thể tải dữ liệu cloud, hoặc đang dùng cache.

Điều này chốt lại rằng localStorage không còn là source of truth cho online path. Khi online, Supabase/cloud mới là nguồn dữ liệu chung.

## 7. Seed 8 vs gói 29 staging

Seed/local cũ 8 học viên không còn là default online path. Gói 29 học viên là shared staging dataset để T/P cùng test trên một center staging.

Chốt C4.0:

- Không xóa seed 8 trong C4.0.
- Không seed cloud 29 trong C4.0.
- Không reset Angel Wings trong C4.0.
- C4.4 sẽ quyết định cách thay default/staging seed an toàn.
- Mục tiêu C4.4: user/tab/máy mới đăng nhập cùng center staging phải thấy cùng bộ 29, không còn cảnh Chrome thường 29 còn tab ẩn danh 8.

## 8. Supabase free strategy

MVP ưu tiên một Supabase project trước. Nhiều center được phân tách bằng `centerId`, không tạo mỗi center một Supabase project trong MVP.

Lý do:

- Tiết kiệm free plan.
- Dễ quản lý auth, RLS, realtime và membership.
- Dễ mở đường cho Super Admin sau này.
- Dữ liệu text như students/teachers/schedules tương đối nhẹ.
- Storage-heavy features như ảnh cloud cần kiểm soát ở phase sau.

## 9. Teacher Portal future wire

C4.0 chỉ ghi dây chờ kiến trúc cho future staff/teacher portal compatibility, không làm app Giáo viên.

Ghi nhận tương lai:

- Teacher account có display name.
- Teacher có thể được duyệt/phân vào một hoặc nhiều center.
- Teacher Portal tương lai có thể có center selector nếu teacher thuộc nhiều center.
- Scope tương lai có thể gồm xem TKB của mình, điểm danh, báo cáo lớp/Trello, và xem thông tin học viên trong phạm vi được phép.

Không đưa nội dung thương mại hoặc thông tin báo giá vào thiết kế này.

## 10. Roadmap C4

```txt
C4.0 - Login Portal + Shared Cloud Source of Truth design
C4.1 - Tách đăng nhập khỏi Module Thu Chi
C4.2 - Login gate: chưa đăng nhập chỉ thấy Login Portal
C4.3 - Center binding: tài khoản admin một center vào thẳng dashboard
C4.4 - Shared staging dataset: bỏ seed 8 khỏi default online path, dùng gói 29 để T/P test
C4.5 - Cloud bootstrap: mở app là lấy student/teacher/schedule từ cloud
C4.6 - Apply SQL membership/realtime theo runbook, có xác nhận
C4.7 - Live QA: T/P hai tab/hai máy cùng sửa dữ liệu
C4.8 - No-push checkpoint review
```

## 11. Non-goals

C4.0 không làm:

- Không runtime login portal.
- Không SQL.
- Không apply SQL.
- Không data change.
- Không seed 29.
- Không xóa seed 8.
- Không Teacher Portal.
- Không Super Admin.
- Không push.
- Không claim T/P online live đã được nghiệm thu.
