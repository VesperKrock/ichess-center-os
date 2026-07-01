# C7.6A - Edge Function/admin provisioning implementation design pack

C7.6A STATUS: EDGE FUNCTION ADMIN PROVISIONING IMPLEMENTATION DESIGN PACK
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
C7_4_STATUS: PASS
C7_5_STATUS: PASS
FUNCTION_NAME_DESIGNED: provision_center_admin_account
EDGE_FUNCTION_FILE_CREATED: NO
EDGE_FUNCTION_DEPLOYED: NO
REQUEST_CONTRACT_DESIGNED: YES
AUTH_CALLER_VERIFICATION_DESIGNED: YES
OWNER_GUARD_DESIGNED: YES
CLIENT_ROLE_BODY_TRUSTED: NO
TARGET_CENTER_VALIDATION_DESIGNED: YES
ADMIN_EMAIL_GENERATION_DESIGNED: YES
ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn
EXISTING_ADMIN_HANDLING_DESIGNED: YES
DREAMHOME_DUPLICATE_ADMIN_PROTECTION_DESIGNED: YES
PHONGTRONG_PROVISIONING_TARGET_DESIGNED: YES
DUPLICATE_EMAIL_HANDLING_DESIGNED: YES
CENTER_ADMIN_ONE_CENTER_RULE_DESIGNED: YES
TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES
MATH_RANDOM_PASSWORD_ALLOWED: NO
SUPABASE_AUTH_ADMIN_CREATE_USER_CAVEAT_NOTED: YES
SERVICE_ROLE_SERVER_SIDE_ONLY_DESIGNED: YES
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
PROVISIONING_SEQUENCE_DESIGNED: YES
ROLLBACK_CLEANUP_DESIGNED: YES
AUDIT_LOG_DESIGNED: YES
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO
SUCCESS_RESPONSE_CONTRACT_DESIGNED: YES
ERROR_RESPONSE_CONTRACT_DESIGNED: YES
CREDENTIAL_HANDOFF_UI_CONTRACT_DESIGNED: YES
PASSWORD_DISPLAY_ONCE_DESIGNED: YES
MANUAL_QA_PLAN_DESIGNED: YES
C7_6B_RECOMMENDED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
RUNTIME_CHANGE: NO
C7_6B_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6A

C7.6A chỉ thiết kế implementation pack cho Edge Function/server-side provisioning tương lai. Pha này không tạo Edge Function thật, không deploy, không gọi Supabase, không tạo Auth user, không tạo membership và không sửa runtime Module 6.

Mục tiêu cụ thể là đóng băng contract an toàn cho `provision_center_admin_account`: request/response, owner guard, service role usage, duplicate admin/email handling, temporary password generation, credential handoff, rollback/cleanup, audit log và manual QA plan cho Phòng Trống.

## 2. Trạng thái sau C7.5

C7.5 đã PASS ở mức readiness: service role chỉ server-side, frontend không được tạo Auth user trực tiếp, owner guard bắt buộc, email admin theo `admin.<slug>@ichess.vn`, mật khẩu tạm thời phải random, handoff password chỉ một lần, rollback/cleanup và audit log bắt buộc.

C7.6A không chuyển sang apply/deploy. Đây là bản thiết kế đủ chi tiết để C7.6B có thể tạo function thật sau khi user xác nhận.

## 3. Function name

Function name thiết kế:

```text
provision_center_admin_account
```

Tên này chỉ là contract. Không tạo file `supabase/functions/provision_center_admin_account/*` trong C7.6A.

## 4. Request contract

Request chỉ nhận dữ liệu tối thiểu:

```json
{
  "center_id": "phongtrong_prod",
  "idempotency_key": "uuid-or-client-generated-operation-id",
  "requested_display_name": "Admin Phòng Trống"
}
```

Quy tắc:

- `center_id` là bắt buộc.
- `idempotency_key` là bắt buộc để chống double-click/retry.
- `requested_display_name` là optional, dùng làm metadata thân thiện nếu hợp lệ.
- Không nhận `role` từ client.
- Không nhận `email` từ client cho center admin mặc định.
- Không nhận `password` từ client.
- Không nhận `owner_user_id` từ body.

## 5. Auth/caller verification

Function tương lai phải đọc JWT của caller từ `Authorization: Bearer <access_token>` và dùng Supabase client bằng anon/publishable key để xác thực caller trước khi dùng service role cho thao tác privileged.

Luồng guard:

1. Nếu thiếu bearer token: trả `401 unauthorized`.
2. Gọi `auth.getUser(token)` để lấy caller user.
3. Nếu token không hợp lệ hoặc user bị ban/disabled theo model tương lai: trả `401 unauthorized`.
4. Dùng user id từ token làm `actor_user_id`.
5. Bỏ qua mọi `actor_user_id`, `role`, `is_owner` nếu client gửi trong body.

## 6. Owner guard

Owner guard là điều kiện bắt buộc trước mọi thao tác service role:

- Query `center_members` bằng server-side privileged client hoặc RPC guard đã duyệt.
- Xác nhận `actor_user_id` có active membership role `owner`.
- Ưu tiên owner global/system-level nếu schema tương lai có cờ này.
- Không tin role từ request body: CLIENT_ROLE_BODY_TRUSTED: NO.
- Nếu caller không phải owner: trả `403 owner_required`.

Owner guard phải chạy trước khi generate password và trước khi gọi Auth Admin API.

## 7. Target center validation

Target center phải được validate trước khi tạo account:

- `centers.id = center_id` tồn tại.
- `centers.status = active`.
- Center không archived/disabled/banned.
- Slug hợp lệ để sinh email.
- Nếu center là Phòng Trống, target expected là `phongtrong_prod` / slug `phongtrong`.
- Nếu center là DreamHome, target expected là `dreamhome_prod` / slug `dreamhome`.

Nếu center không hợp lệ: trả `404 center_not_found` hoặc `409 center_not_active`.

## 8. Admin email generation

Email admin mặc định sinh từ slug center:

```text
admin.<slug>@ichess.vn
```

Ví dụ:

- DreamHome: `admin.dreamhome@ichess.vn`
- Phòng Trống: `admin.phongtrong@ichess.vn`

Quy tắc slug:

- Lowercase.
- Chỉ dùng ký tự an toàn `a-z`, `0-9`, `-`.
- Nếu slug rỗng hoặc chứa ký tự không hợp lệ sau normalize: trả `422 invalid_center_slug`.
- Không để client tự truyền email mặc định ở C7.6A/C7.6B.

## 9. Existing admin handling

Trước khi tạo Auth user mới, function phải kiểm tra membership admin hiện có:

1. Query `center_members` cho `center_id`, `role = center_admin`, status active/pending.
2. Nếu đã có admin active cho center đó, không tạo user mới.
3. Trả `409 center_admin_already_exists`.
4. Response có thể kèm email masked hoặc admin user id nếu được phép hiển thị.

Không tạo trùng admin cho cùng center. Đây là bảo vệ chính cho DreamHome.

## 10. Duplicate email handling

Duplicate email phải xử lý trước và sau khi gọi Auth Admin API:

- Tìm Auth user theo email `admin.<slug>@ichess.vn` nếu API/server helper cho phép.
- Nếu email tồn tại và đã là admin đúng center: trả `409 center_admin_already_exists`.
- Nếu email tồn tại nhưng thuộc center khác hoặc role khác: trả `409 admin_email_already_used`.
- Nếu Auth Admin `createUser` trả duplicate email: map sang `409 admin_email_already_used`.
- Không fallback sang email tùy tiện kiểu `admin.<slug>2@ichess.vn` nếu chưa có thiết kế riêng.

## 11. center_admin one-center rule

`center_admin` chỉ được có một cơ sở active. Khi tạo membership mới:

- Kiểm tra user target chưa có active membership role `center_admin` ở center khác.
- Với account mới tạo, expected là không có membership nào.
- Nếu reuse user trong flow tương lai, phải reject khi user đã có center_admin active ở center khác.
- Teacher có thể multi-center, nhưng rule này không áp dụng cho teacher.

## 12. Temporary password generation

Temporary password phải random bằng cryptographic random:

- Dùng Web Crypto `crypto.getRandomValues` trong Deno Edge Runtime hoặc helper tương đương.
- Không dùng `Math.random`.
- Độ dài khuyến nghị tối thiểu 20 ký tự.
- Có chữ hoa, chữ thường, số, ký tự an toàn.
- Tránh ký tự dễ nhầm nếu muốn copy thủ công: `O`, `0`, `l`, `1` có thể loại khỏi alphabet.
- Không ghi plaintext password vào audit log, console log, error log, DB hoặc metadata.

Password chỉ tồn tại trong memory trong request và chỉ trả về một lần trong success response.

## 13. Supabase Auth admin creation caveat

Supabase Auth Admin API là privileged action. C7.6B khi tạo thật phải xác nhận chính xác option cho email/password theo SDK version đang dùng:

- `email_confirm` hoặc option tương đương có thể ảnh hưởng khả năng login ngay.
- Nếu email confirmation bắt buộc nhưng chưa có mail flow, temporary password handoff có thể chưa đủ để đăng nhập.
- Function phải ghi rõ trong response `email_confirmed_for_login` hoặc `login_caveat`.
- Không giả định user login được nếu Auth setting yêu cầu confirmation.

## 14. Service role / environment secrets

Service role chỉ được dùng trong Edge Function/server-side:

- Secret dự kiến: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Không expose service role key ra frontend.
- Không bundle service role key vào runtime app.
- Không log env var.
- Dùng service role client chỉ sau khi caller đã qua owner guard.
- Mọi operation privileged phải đi kèm audit log.

## 15. Provisioning operation sequence

Trình tự đề xuất:

1. Parse JSON body.
2. Validate `center_id` và `idempotency_key`.
3. Verify caller từ bearer token.
4. Owner guard.
5. Load target center và validate active status.
6. Generate admin email từ slug.
7. Check existing `center_admin` membership cho center.
8. Check duplicate email/Auth user nếu helper cho phép.
9. Lock/idempotency theo `idempotency_key` hoặc audit operation table tương lai.
10. Generate temporary password bằng crypto random.
11. Create Auth user bằng Admin API.
12. Create `center_members` row role `center_admin`, status active hoặc pending theo schema.
13. Write audit log success, không chứa plaintext password.
14. Return success response có credential handoff một lần.

Nếu bước 12 fail sau khi Auth user đã tạo, chuyển sang rollback/cleanup.

## 16. Rollback/cleanup design

Rollback phải ưu tiên không để orphan privileged account:

- Nếu Auth user đã tạo nhưng membership tạo fail: disable/ban/delete pending Auth user theo khả năng an toàn của Supabase Auth Admin API.
- Nếu cleanup thành công: trả error với `cleanup_status: cleaned`.
- Nếu cleanup fail: trả error với `cleanup_status: needs_manual_review` và audit log mức critical.
- Nếu membership tạo thành công nhưng audit log fail: không trả password nếu trạng thái audit bắt buộc không chắc chắn; đánh dấu `needs_manual_review`.
- Không tự hard delete membership/account đã active nếu đã có dấu hiệu user đăng nhập hoặc có dữ liệu phát sinh.

Rollback không log plaintext password.

## 17. Audit log design

Audit action đề xuất:

```text
account.provision_center_admin
```

Fields:

- `actor_user_id`
- `target_center_id`
- `target_role`: `center_admin`
- `target_email`
- `target_auth_user_id`
- `status`: `success`, `failed`, `rolled_back`, `needs_manual_review`
- `reason_code`
- `idempotency_key_hash`
- `request_id`
- `created_at`

Forbidden:

- Plaintext temporary password.
- Service role key.
- Full bearer token.
- Raw request body nếu có nguy cơ chứa secret.

PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO.

## 18. Success response contract

Success response:

```json
{
  "ok": true,
  "status": "created",
  "center_id": "phongtrong_prod",
  "center_slug": "phongtrong",
  "role": "center_admin",
  "email": "admin.phongtrong@ichess.vn",
  "temporary_password": "returned-once-only",
  "password_display_once": true,
  "credential_handoff_required": true,
  "auth_user_id": "uuid",
  "membership_id": "uuid",
  "email_confirmed_for_login": true,
  "login_caveat": null,
  "audit_id": "uuid"
}
```

Response này chỉ được trả cho owner đã gọi thành công. Frontend phải mở panel/window riêng để hiển thị "Đã tạo tài khoản".

## 19. Error response contract

Error response dùng code ổn định:

```json
{
  "ok": false,
  "error": {
    "code": "center_admin_already_exists",
    "message": "Center already has an admin account.",
    "safe_message_vi": "Cơ sở này đã có tài khoản admin.",
    "cleanup_status": "not_needed",
    "audit_id": "uuid-or-null"
  }
}
```

Mã lỗi tối thiểu:

- `unauthorized`
- `owner_required`
- `invalid_request`
- `center_not_found`
- `center_not_active`
- `invalid_center_slug`
- `center_admin_already_exists`
- `admin_email_already_used`
- `center_admin_one_center_violation`
- `auth_create_failed`
- `membership_create_failed`
- `cleanup_failed_needs_manual_review`
- `audit_log_failed`

Không trả temporary password trong error response.

## 20. Credential handoff UI contract

UI tương lai không chèn form nguy hiểm vào dashboard chính. Sau success:

- Mở panel/window riêng từ nút "Tạo admin cơ sở".
- Hiển thị tiêu đề "Đã tạo tài khoản".
- Hiển thị email.
- Hiển thị mật khẩu tạm thời một lần.
- Có nút copy email.
- Có nút copy mật khẩu.
- Có nút copy toàn bộ thông tin đăng nhập.
- Có cảnh báo: "Mật khẩu chỉ hiển thị một lần. Hãy lưu lại trước khi đóng."
- Khi đóng panel, frontend xóa password khỏi state memory.
- Không persist password vào localStorage/sessionStorage.

## 21. Manual QA plan for C7.6 future

Manual QA chỉ dành cho C7.6B/C7.6C khi user duyệt apply/deploy:

1. Xác nhận function deploy đúng project/staging/production mục tiêu.
2. Login owner/anh Hải.
3. Mở panel quản trị cơ sở.
4. Chọn Phòng Trống.
5. Bấm tạo admin cơ sở một lần.
6. Expected success: email `admin.phongtrong@ichess.vn`, password random hiển thị một lần.
7. Copy credential, đóng panel, xác nhận password không còn trong UI state.
8. Dùng SQL read-only kiểm tra có đúng một `center_admin` membership cho Phòng Trống.
9. Thử bấm tạo admin Phòng Trống lần hai.
10. Expected duplicate protection: `409 center_admin_already_exists`, không tạo Auth user/membership mới.
11. Kiểm tra audit log không chứa plaintext password.
12. Nếu login bằng admin mới được duyệt, kiểm tra email confirmation caveat trước.

## 22. DreamHome duplicate protection test

DreamHome hiện đã có hướng admin `admin.dreamhome@ichess.vn`. C7.6 tương lai phải test duplicate protection:

- Target center: `dreamhome_prod`.
- Expected không tạo admin mới nếu đã có center_admin.
- Expected không tạo email thay thế.
- Expected trả `center_admin_already_exists`.
- Expected audit log ghi failed/blocked duplicate, không có password.

Đây là guard để không phá account/membership DreamHome hiện có.

## 23. Phòng Trống provisioning target

Phòng Trống là target provisioning chính cho admin mới trong C7.6 tương lai:

- Target center id expected: `phongtrong_prod`.
- Slug expected: `phongtrong`.
- Email expected: `admin.phongtrong@ichess.vn`.
- Role expected: `center_admin`.
- Center phải active trước khi provisioning.
- Không seed dữ liệu nghiệp vụ cho Phòng Trống trong flow này.

PHONGTRONG_PROVISIONING_TARGET_DESIGNED: YES.

## 24. C7.6B recommendation

C7.6B nên là Edge Function implementation/apply readiness riêng:

- Tạo function thật chỉ sau khi user xác nhận.
- Có dry-run local review nếu khả thi.
- Có secrets checklist.
- Có deploy checklist.
- Có manual QA checklist.
- Không tạo admin thật trước khi user xác nhận rõ target.
- Không trộn teacher provisioning vào C7.6B nếu phạm vi đang là admin center.

## 25. Risk list

- Service role bị expose nếu nhầm đưa vào frontend.
- Owner guard sai khiến center_admin tự tạo account.
- Duplicate admin gây nhiều admin cho cùng cơ sở.
- Duplicate email gây account sai center.
- Auth user tạo thành công nhưng membership fail tạo orphan account.
- Password bị log/plaintext storage.
- Email confirmation setting khiến account không login được dù đã handoff password.
- Retry/double-click tạo nhiều user nếu thiếu idempotency.
- Audit log fail làm khó truy vết thao tác nhạy cảm.

## 26. PASS / NEEDS REVIEW criteria

PASS khi:

- Có đủ contract request/response/error.
- Có owner guard và caller verification.
- Có target center validation.
- Có duplicate admin/email handling.
- Có center_admin one-center rule.
- Có crypto random password và cấm `Math.random`.
- Có service role server-side only.
- Có rollback/cleanup.
- Có audit log không plaintext password.
- Có credential handoff one-time.
- Có manual QA plan cho Phòng Trống và duplicate DreamHome.
- Không tạo runtime, SQL apply, Supabase action, Auth user, membership, Edge Function thật, commit hoặc push.

NEEDS REVIEW nếu bất kỳ điều kiện an toàn nào ở trên thiếu hoặc nếu có thay đổi ngoài docs/test.
