# C7.8A - Owner account management UI readonly

C7.8A STATUS: OWNER ACCOUNT MANAGEMENT UI READONLY
C7_7C_STATUS: PASS
OWNER_FACING_ACCOUNT_UI_ADDED: YES
INTERNAL_CENTER_CONSOLE_UPDATED: YES
READONLY_ONLY: YES
EDGE_FUNCTION_INVOKED: NO
SUPABASE_MUTATION: NO
AUTH_USER_CREATED: NO
PASSWORD_RESET: NO
ACCESS_REVOKED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
PASSWORD_LONG_TERM_STORAGE: NO
ACTION_BUTTONS_SAFE_DISABLED: YES
COPY_EMAIL_SAFE_ACTION_ALLOWED: YES
RUNTIME_UI_CHANGE: YES
C7_8B_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh sau C7.7C

C7.7C đã chốt readiness cho account ops sau các mốc C7.6 provisioning, C7.7A reset password và C7.7B revoke pack. Trạng thái hiện biết:

- `dreamhome_prod` là production center active và đã có `center_admin` active.
- `phongtrong_prod` là production center active và đã có `center_admin` active.
- `owner.duchai@ichess.vn` là owner active của hai cơ sở production trên.

## 2. Mục tiêu C7.8A

C7.8A thêm một khu readonly trong Internal Center Console để anh Hải xem tình trạng tài khoản admin theo từng cơ sở production active. Phase này chỉ dựng nền UI và trạng thái an toàn, chưa thực hiện thao tác account ops thật.

## 3. UI added

Internal Center Console có section mới `Quản lý tài khoản cơ sở` nằm dưới danh sách cơ sở. Mỗi card cơ sở hiển thị:

- Tên cơ sở.
- Mã cơ sở.
- Slug.
- Môi trường.
- Trạng thái center.
- Admin cơ sở.
- Trạng thái tài khoản.
- Hành động tài khoản.

## 4. Data source / limitations

Runtime tiếp tục dùng danh sách `centers` production active hiện có. C7.8A thêm một truy vấn read-only bằng Supabase client hiện tại vào `center_members`:

- `center_id` thuộc các production center đang hiển thị.
- `role = center_admin`.
- `status = active`.

Email admin chỉ hiển thị nếu `center_members.email_snapshot` đọc được qua RLS. Nếu RLS hoặc schema không cho đọc, UI hiển thị trạng thái chưa tải hoặc cần kết nối dữ liệu tài khoản, không hardcode email production vào runtime.

## 5. Buttons disabled/coming soon

Các nút sau chỉ là placeholder an toàn:

- `Tạo admin`.
- `Tạo mật khẩu tạm mới`.
- `Thu hồi quyền`.

Các nút này disabled và có nhãn `Sắp bật`, kèm title `Sẽ được bật ở C7.8B/C7.8C`.

`Copy email` là action an toàn duy nhất được bật khi card có email admin đã hiển thị. Action này chỉ copy chuỗi email sang clipboard, không gọi Supabase mutate và không gọi Edge Function.

## 6. Security constraints

C7.8A không đưa service role key vào frontend, không dùng `auth.admin`, không gọi Edge Function account ops và không lưu mật khẩu. UI không có input mật khẩu và không hiển thị mật khẩu cũ.

## 7. What C7.8A does not do

C7.8A không:

- Tạo Auth user.
- Tạo admin mới.
- Reset password.
- Thu hồi hoặc disable access.
- Deploy hoặc invoke Edge Function.
- Apply SQL.
- Commit hoặc push.

## 8. C7.8B recommendation

Sau khi manual QA Internal Center Console PASS, C7.8B nên wire action tạo admin/reset theo hướng server-side an toàn, có owner guard, one-time temporary password handoff, audit log và không expose service role trong frontend.
