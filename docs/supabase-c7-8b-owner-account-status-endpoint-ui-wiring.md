# C7.8B - Owner account status endpoint UI wiring

C7.8B STATUS: OWNER ACCOUNT STATUS ENDPOINT UI WIRING
C7_8A_STATUS: PASS
C7_8A_MANUAL_QA_RESULT: UI_SHELL_PASS_ADMIN_DATA_NOT_LOADED
LIST_CENTER_ADMIN_ACCOUNTS_FUNCTION_CREATED: YES
LIST_CENTER_ADMIN_ACCOUNTS_READONLY: YES
OWNER_GUARD_IMPLEMENTED: YES
SERVICE_ROLE_SERVER_SIDE_ONLY: YES
SERVICE_ROLE_FRONTEND_EXPOSURE: NO
FRONTEND_ACCOUNT_STATUS_WIRED: YES
ADMIN_EMAIL_DISPLAY_FROM_ENDPOINT: YES
COPY_EMAIL_SAFE_ACTION_ALLOWED: YES
ACTION_BUTTONS_SAFE_DISABLED: YES
EDGE_FUNCTION_MUTATION: NO
AUTH_USER_CREATED: NO
PASSWORD_RESET: NO
ACCESS_REVOKED: NO
PASSWORD_LONG_TERM_STORAGE: NO
RUNTIME_UI_CHANGE: YES
C7_8C_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.8A manual QA

C7.8A đã thêm section `Quản lý tài khoản cơ sở` trong Internal Center Console. Manual QA xác nhận DreamHome và Phòng Trống đều có card, các action `Tạo admin`, `Tạo mật khẩu tạm mới`, `Thu hồi quyền` đang disabled/Sắp bật đúng yêu cầu.

Vấn đề còn lại: frontend authenticated client chưa đọc được admin email/status đầy đủ. Card đang hiện `Chưa tải` hoặc `Cần kết nối dữ liệu tài khoản`, nên `Copy email` chưa bật.

## 2. Vì sao cần server-side read endpoint

Admin email thật nằm sau Auth Admin API, không được đọc trực tiếp từ frontend. RLS hiện tại cũng không đảm bảo owner có thể đọc toàn bộ `center_admin` của các center production. C7.8B vì vậy thêm một Edge Function read-only dùng owner JWT để xác thực actor, sau đó dùng service role server-side để đọc đúng phạm vi.

## 3. Function list-center-admin-accounts

Function mới:

- Deploy name: `list-center-admin-accounts`.
- Business name: `list_center_admin_accounts`.
- Source: `supabase/functions/list-center-admin-accounts/index.ts`.
- Config: `[functions.list-center-admin-accounts] verify_jwt = true`.

Function chỉ đọc dữ liệu: owner memberships, production centers, active center_admin memberships và Auth user email qua `auth.admin.getUserById`.

## 4. Request/response contract

Request POST JSON:

```json
{
  "center_ids": ["dreamhome_prod", "phongtrong_prod"]
}
```

`center_ids` optional. Nếu bỏ trống, function trả các production center active mà actor là owner active. Nếu truyền vào, function chỉ trả subset actor được phép xem.

Success response:

```json
{
  "ok": true,
  "code": "center_admin_accounts_loaded",
  "centers": []
}
```

Mỗi item center có `center_id`, `center_name`, `slug`, `environment`, `center_status` và `admin`. `admin.exists=true` kèm `email` khi có đúng một active admin và Auth email đọc được.

## 5. Owner guard / center scope

Function lấy Bearer token từ header `Authorization`, verify bằng `auth.getUser(token)`, rồi query `center_members`:

- `user_id = actorUser.id`.
- `role = owner`.
- `status = active`.

Sau đó function chỉ lấy `centers` thuộc owner scope, `environment = production`, `status = active`. Client không được gửi actor id/email/role/service role.

## 6. Frontend wiring

Internal Center Console gọi:

```js
supabase.functions.invoke('list-center-admin-accounts', {
  body: { center_ids: centerIds },
})
```

Frontend không dùng service role, không gọi account mutate function, không hardcode project URL.

## 7. UI states

Trước khi endpoint trả:

- `Admin cơ sở: Đang tải...`
- `Trạng thái tài khoản: Đang tải dữ liệu tài khoản`

Khi có admin:

- `Admin cơ sở: admin.<slug>@ichess.vn`
- `Trạng thái tài khoản: Đã có admin`

Khi chưa có admin:

- `Admin cơ sở: Chưa có admin`
- `Trạng thái tài khoản: Cần tạo tài khoản`

Khi lỗi endpoint:

- `Admin cơ sở: Chưa tải`
- `Trạng thái tài khoản: Không tải được dữ liệu tài khoản`

## 8. Buttons remain disabled

Các action mutate vẫn disabled/Sắp bật:

- `Tạo admin`.
- `Tạo mật khẩu tạm mới`.
- `Thu hồi quyền`.

`Copy email` chỉ bật khi endpoint trả `admin.exists=true` và `admin.email` có giá trị. Nếu không có email mà event vẫn bị gọi bằng script, UI hiện `Chưa có email admin để copy` và không copy gì.

## 9. Security constraints

C7.8B không expose service role trong frontend. Service role chỉ nằm trong Edge Function runtime qua `SUPABASE_SERVICE_ROLE_KEY`. Function không insert/update/delete data, không tạo Auth user, không reset password và không revoke access.

## 10. What C7.8B does not do

C7.8B không:

- Deploy hoặc invoke Edge Function bởi CodeX.
- Set secrets.
- Apply SQL.
- Tạo/reset/revoke account.
- Lưu hoặc hiển thị password.
- Bật action create/reset/revoke.
- Commit hoặc push.

## 11. C7.8C recommendation

Sau khi user deploy `list-center-admin-accounts` và manual QA thấy admin email hiển thị đúng, C7.8C có thể wire reset password button theo flow owner guard, one-time handoff, audit log và không expose service role trong frontend.
