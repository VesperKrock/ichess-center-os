# C7.6H - Controlled Phong Trong admin provisioning

C7.6H STATUS: CONTROLLED PHONGTRONG ADMIN PROVISIONING PACK
C7_6G_DREAMHOME_NOOP_PASS: YES
C7_6G_POST_TEST_VERIFY_PASS: YES
PHONGTRONG_TARGET_CENTER_ID: phongtrong_prod
PHONGTRONG_EXPECTED_EMAIL: admin.phongtrong@ichess.vn
PHONGTRONG_PREINVOKE_SQL_CREATED: YES
PHONGTRONG_BROWSER_CONSOLE_INVOKE_SCRIPT_CREATED: YES
PHONGTRONG_POST_PROVISION_VERIFY_SQL_CREATED: YES
CREDENTIAL_HANDOFF_CHECKLIST_CREATED: YES
TEMPORARY_PASSWORD_DISPLAY_ONCE_REQUIRED: YES
TEMPORARY_PASSWORD_CHAT_ALLOWED: NO
TEMPORARY_PASSWORD_REPO_ALLOWED: NO
PASSWORD_LEAK_VERIFY_QUERY_CREATED: YES
MANUAL_LOGIN_SMOKE_CREATED: YES
ROLLBACK_MANUAL_CLEANUP_PLAN_CREATED: YES
EDGE_FUNCTION_INVOKED_BY_CODEX: NO
AUTH_USER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
SQL_MUTATION_BY_CODEX: NO
RUNTIME_UI_CHANGE: NO
C7_6I_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Bối cảnh C7.6G PASS

C7.6G đã đạt trạng thái an toàn để chuẩn bị provisioning thật cho Phòng Trống:

- DreamHome duplicate no-op trả HTTP 409 `center_admin_already_exists`.
- Không trả `temporary_password`.
- Không trả password.
- Post-test verify PASS.
- `dreamhome_prod` có đúng 1 active center_admin: `admin.dreamhome@ichess.vn`.
- `phongtrong_prod` có 0 active center_admin.
- `admin.phongtrong@ichess.vn` chưa tồn tại.
- Password leak query trả 0 rows.

## 2. Mục tiêu C7.6H

C7.6H chỉ chuẩn bị controlled invocation pack để user tự gọi Edge Function thật từ browser Console bằng owner token đang đăng nhập.

Expected khi user invoke thành công:

- Tạo Auth user `admin.phongtrong@ichess.vn`.
- Tạo membership `center_admin / active / phongtrong_prod`.
- Ghi audit row `account.provision_center_admin`.
- Trả `temporary_password` đúng một lần trong success response.
- User copy credential riêng tư, không gửi password vào chat/repo.

CodeX không invoke Edge Function, không tạo account, không chạy SQL mutate.

## 3. Target Phòng Trống

Target:

```txt
center_id = phongtrong_prod
expected email = admin.phongtrong@ichess.vn
display_name = Admin Phong Trong
```

Function:

```txt
provision-center-admin-account
```

## 4. Pre-invoke checklist

Trước khi invoke, user chạy read-only SQL:

```txt
docs/supabase-c7-6h-readonly-preinvoke-phongtrong-admin.sql
```

Expected trước invoke:

- `dreamhome_prod` production active.
- `phongtrong_prod` production active.
- Chỉ DreamHome có active center_admin.
- `admin.phongtrong@ichess.vn` không tồn tại.
- Chưa có success audit row cho `admin.phongtrong@ichess.vn`.

Nếu pre-invoke không đúng expected, dừng C7.6H và không gọi function.

## 5. Browser Console invocation

User tự chạy browser Console script trong app iChess:

```txt
docs/supabase-c7-6h-browser-console-invoke-phongtrong-admin.js
```

Script:

- Lấy owner access token từ localStorage của app.
- Không hardcode token.
- Gọi Edge Function `provision-center-admin-account`.
- Gửi `center_id = phongtrong_prod`.
- Tạo `idempotency_key` theo timestamp.
- Gửi `display_name = Admin Phong Trong`.
- In HTTP status/raw/parsed response.
- Nếu success, in email và `temporary_password` một lần để user copy.
- Không lưu password vào localStorage.

## 6. Expected success response

Expected success:

```json
{
  "ok": true,
  "code": "center_admin_created",
  "center_id": "phongtrong_prod",
  "email": "admin.phongtrong@ichess.vn",
  "temporary_password": "...",
  "password_display_once": true,
  "credential_handoff_required": true,
  "audit_id": "..."
}
```

Nếu response là `center_admin_already_exists`, dừng và verify vì Phòng Trống đã có active admin.

Nếu response là `duplicate_request_already_processed`, không gọi lại bằng cùng idempotency key vì password không thể hiển thị lại.

Nếu response là lỗi khác, copy error code/debug object only, không copy token/password/secret.

## 7. Credential handoff

Khi function success:

- Copy email `admin.phongtrong@ichess.vn`.
- Copy `temporary_password` ngay.
- Không gửi `temporary_password` vào ChatGPT.
- Không commit password vào repo/docs.
- Không lưu password trong localStorage.
- Có thể lưu tạm vào password manager hoặc note offline riêng của user.
- Sau khi verify login, nên đổi/reset password theo flow sau này.

Nếu user mất temporary password:

- Không thể recover password từ audit.
- Không gọi lại cùng idempotency key.
- Dùng reset password flow ở phase sau.

## 8. Post-provision verify SQL

Sau success response, user chạy read-only verify SQL:

```txt
docs/supabase-c7-6h-readonly-post-provision-verify-phongtrong-admin.sql
```

Expected after success:

- `dreamhome_prod` active center_admin count = 1.
- `phongtrong_prod` active center_admin count = 1.
- `admin.dreamhome@ichess.vn` exists.
- `admin.phongtrong@ichess.vn` exists.
- Center_admin one-center violation query = 0 rows.
- `account_audit_logs` có action `account.provision_center_admin` cho `phongtrong_prod`.

## 9. Password leak verify

Post-provision verify SQL có query kiểm tra các JSON field nhạy cảm trong `account_audit_logs`.

Expected:

```txt
password leak query = 0 rows
```

Nếu query trả row, dừng rollout và không sang C7.6I.

## 10. Manual login smoke

Sau verify DB PASS:

1. Mở app iChess trong cửa sổ ẩn danh hoặc browser profile khác.
2. Đăng nhập bằng `admin.phongtrong@ichess.vn` và temporary password.
3. Expected:
   - Login thành công.
   - User thấy Phòng Trống / `phongtrong_prod`.
   - Không thấy Internal Center Console.
   - Không thấy DreamHome data.
   - Phòng Trống không seed Angel Wings.
4. Không đổi password trong phase này nếu chưa có reset/change password flow rõ.

Nếu login fail:

- Không gọi lại provisioning nếu admin đã tạo.
- Ghi exact error.
- Dùng reset password phase sau nếu cần.

## 11. Rollback/manual cleanup plan

Case A - Function success but login fail:

- Không xóa ngay.
- Verify Auth user/membership/audit.
- Xác định lỗi Auth/email confirmation/password.
- Dùng reset password flow sau.

Case B - Auth user exists but membership missing:

- Treat as partial failure.
- Do not reuse password.
- Inspect audit.
- Manual cleanup only after user confirms.

Case C - Membership exists but audit missing:

- Treat as unsafe partial success.
- Do not continue rollout.
- Manual cleanup/revoke after inspection.

Case D - temporary password lost:

- Do not recover from audit.
- Use reset password flow later.

C7.6H không cung cấp destructive SQL cleanup. Cleanup thật cần quyết định riêng.

## 12. What C7.6H does not do

C7.6H không:

- Invoke Edge Function bởi CodeX.
- Deploy lại Edge Function.
- Set secrets.
- Chạy SQL mutate.
- Tạo/sửa/xóa Auth user bởi CodeX.
- Tạo `admin.phongtrong@ichess.vn` bởi CodeX.
- Tạo membership bởi CodeX.
- Sửa runtime UI.
- Bắt đầu C7.6I.
- Commit/push.

## 13. C7.6I recommendation

Chỉ sang C7.6I sau khi:

- Pre-invoke SQL PASS.
- User invoke Phòng Trống provisioning thành công.
- User copy credential riêng tư.
- Post-provision verify SQL PASS.
- Password leak query = 0 rows.
- Manual login smoke PASS.
