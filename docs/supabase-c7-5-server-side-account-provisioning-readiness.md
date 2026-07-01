# C7.5 - Server-side Account Provisioning / Access Governance Readiness

C7.5 STATUS: SERVER SIDE ACCOUNT PROVISIONING READINESS
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
C7_4_STATUS: PASS
SERVER_SIDE_PROVISIONING_ARCHITECTURE_DESIGNED: YES
FRONTEND_DIRECT_AUTH_USER_CREATION_ALLOWED: NO
SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO
SERVICE_ROLE_SERVER_SIDE_ONLY_DESIGNED: YES
OWNER_GUARD_DESIGNED: YES
CLIENT_ROLE_BODY_TRUSTED: NO
ADMIN_ACCOUNT_PROVISIONING_CONTRACT_DESIGNED: YES
ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn
PHONGTRONG_ADMIN_READY_FOR_FUTURE_PROVISIONING: YES
DREAMHOME_DUPLICATE_ADMIN_PROTECTION_DESIGNED: YES
TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES
MATH_RANDOM_PASSWORD_ALLOWED: NO
CREDENTIAL_HANDOFF_RESPONSE_DESIGNED: YES
PASSWORD_DISPLAY_ONCE_DESIGNED: YES
PLAINTEXT_PASSWORD_LOGGING_ALLOWED: NO
EMAIL_CONFIRMATION_LOGIN_CAVEAT_NOTED: YES
DUPLICATE_EMAIL_HANDLING_DESIGNED: YES
IDEMPOTENCY_HANDLING_DESIGNED: YES
ROLLBACK_CLEANUP_STRATEGY_DESIGNED: YES
AUDIT_LOG_CONTRACT_DESIGNED: YES
RESET_PASSWORD_READINESS_DESIGNED: YES
REVOKE_BAN_READINESS_DESIGNED: YES
CENTER_LIFECYCLE_READINESS_DESIGNED: YES
UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES
DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO
C7_6_SPLIT_RECOMMENDED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
RUNTIME_CHANGE: NO
C7_6_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.5

C7.5 chốt readiness/design cho server-side account provisioning và access governance. Phase này chỉ thiết kế contract an toàn cho Edge Function/server-side endpoint tương lai; không tạo Edge Function thật, không tạo Auth user, không tạo membership, không sửa runtime và không apply SQL.

Mục tiêu chính:

- server-side privileged architecture;
- owner guard không tin request body;
- contract tạo admin cơ sở;
- readiness teacher/reset/revoke/ban/archive;
- mật khẩu tạm thời random và credential handoff một lần;
- duplicate/idempotency handling;
- rollback/cleanup strategy;
- audit log contract không log plaintext password.

## 2. Trạng thái sau C7.4

C7.1-C7.4 PASS đã chốt:

- owner tạo cơ sở/admin/teacher global và có governance authority;
- center_admin chỉ 1 active center membership, không tạo account/admin/teacher;
- teacher có global profile/assignment model tương lai;
- C7.2 manual inspection PASS: `owner.duchai@ichess.vn` có owner membership cho `dreamhome_prod` và `phongtrong_prod`; `admin.dreamhome@ichess.vn` là `center_admin` của `dreamhome_prod`; `phongtrong_prod` chưa có center_admin;
- C7.3 chốt credential handoff panel và mật khẩu tạm thời random;
- C7.4 chốt ban/revoke/reset/archive phải owner-only, có confirm và audit log.

## 3. Architecture principle

Frontend/browser không được tạo Auth user trực tiếp.

Architecture tương lai:

```txt
Owner UI
  -> gọi server-side endpoint/Edge Function
  -> endpoint verify JWT/caller thật
  -> endpoint dùng service role/admin API ở server-side
  -> endpoint tạo Auth user / membership / profile / audit log
  -> endpoint trả credential tạm thời đúng một lần
  -> frontend hiện credential handoff panel
```

Service role chỉ được dùng ở server-side/Edge Function/secrets. Frontend chỉ dùng anon/public client như hiện tại.

## 4. Future endpoint/function list

C7.5 chỉ design contract, không tạo file function thật.

Endpoint future đề xuất:

- `provision_center_admin_account`
- `reset_account_password`
- `revoke_center_access`
- `ban_account`
- `restore_account_access`
- `archive_center`
- `restore_center`

C7.6 ưu tiên duy nhất: `provision_center_admin_account`. Các endpoint còn lại defer sau C7.6/C7.7.

## 5. Owner guard

Endpoint không được tin request body kiểu `{ "role": "owner" }`.

Guard concept:

1. Lấy caller từ access token.
2. Verify caller còn active.
3. Verify caller có role owner active.
4. Verify target center production/active nếu action theo center.
5. Verify action được phép theo permission matrix.

Với current model, owner được xác định qua `center_members` role `owner`; hiện owner có membership ở `dreamhome_prod` và `phongtrong_prod`. Nếu về sau owner global role tách khỏi membership, guard cần cập nhật.

CLIENT_ROLE_BODY_TRUSTED: NO.

## 6. Service role safety

Service role bypass RLS, nên endpoint phải tự check quyền.

Safety:

- không dùng service role trong browser;
- không expose service role key ra frontend;
- không log secrets;
- không trả raw service role error ra frontend nếu chứa thông tin nhạy cảm;
- cấu hình secrets trong môi trường triển khai;
- mọi privileged action phải qua owner guard và audit.

## 7. Admin account provisioning contract

Target C7.6.

Input shape concept:

```json
{
  "center_id": "phongtrong_prod",
  "requested_email": null,
  "idempotency_key": "uuid-from-client-or-server"
}
```

Default email: `admin.<slug>@ichess.vn`, ví dụ `admin.phongtrong@ichess.vn` và `admin.dreamhome@ichess.vn`.

Rules:

- target center must exist;
- target center `environment = production`;
- target center `status = active`;
- actor must be owner;
- if center already has active center_admin, do not create another silently;
- center_admin one-center rule must hold;
- role must be `center_admin`, not legacy `admin`;
- temp password must be random;
- return temp password once.

## 8. Existing admin handling

Nếu center đã có active center_admin:

- endpoint không trả password cũ;
- endpoint trả status `already_has_admin`;
- UI đề xuất dùng reset password flow nếu cần;
- không tạo duplicate admin;
- không hijack email đã thuộc account khác.

## 9. Phòng Trống readiness

`phongtrong_prod` hiện là production active center và hiện chưa có center_admin theo C7.2 inspection.

Future C7.6 có thể offer action:

```txt
Tạo admin cơ sở -> admin.phongtrong@ichess.vn
```

PHONGTRONG_ADMIN_READY_FOR_FUTURE_PROVISIONING: YES.

## 10. DreamHome duplicate protection

`dreamhome_prod` đã có `admin.dreamhome@ichess.vn` role `center_admin` active.

Future endpoint phải:

- phát hiện existing active center_admin;
- không tạo duplicate admin;
- không trả password cũ;
- trả `already_has_admin`;
- hướng owner sang reset password nếu cần.

## 11. Admin account success response

Response concept:

```json
{
  "ok": true,
  "action": "provision_center_admin_account",
  "center_id": "phongtrong_prod",
  "center_name": "Phòng Trống",
  "email": "admin.phongtrong@ichess.vn",
  "temporary_password": "IChess@7KQ4-M9P2",
  "password_display_once": true,
  "credential_handoff_required": true,
  "audit_id": "..."
}
```

Response chỉ trả password khi toàn bộ flow thành công.

## 12. Credential handoff panel response

UI phải mở credential handoff panel/window:

```txt
Đã tạo tài khoản admin cơ sở

Cơ sở: Phòng Trống
Email: admin.phongtrong@ichess.vn
Mật khẩu tạm thời: IChess@7KQ4-M9P2

Hãy lưu lại thông tin này. Mật khẩu tạm thời chỉ hiển thị trong lần này.

[Copy email]
[Copy mật khẩu]
[Copy toàn bộ thông tin]
```

Password display once: YES. Không được có API đọc lại plaintext password.

## 13. Temporary password generation

Không dùng fixed default password. Không dùng `Math.random` cho password.

Requirement:

- random per account;
- strong enough for temporary use;
- generated server-side;
- not logged;
- not stored plaintext;
- returned once.

Future implementation phải dùng cryptographically secure random source trong server-side runtime.

## 14. Email confirmation/login caveat

`admin.<slug>@ichess.vn` có thể là internal login identifier, không nhất thiết là inbox thật.

Nếu Supabase email confirmation đang required, internally generated admin emails có thể không login được nếu server-side admin creation không mark confirmed hoặc auth settings không cho phép.

C7.6 must explicitly verify login behavior in current Supabase auth settings before creating real admin accounts.

## 15. Duplicate email handling

Cases:

1. Email unused -> create new Auth user.
2. Email exists and already center_admin for target center -> `already_has_admin`, no password returned.
3. Email exists but belongs to another account/center -> NEEDS REVIEW, do not hijack.
4. Email exists but disabled/banned -> NEEDS REVIEW or reset/restore flow.

Never reveal whether a password exists. Never return old password.

## 16. Idempotency/double-click handling

Owner có thể double-click "Tạo admin"; network cũng có thể retry. Endpoint must not create duplicate users/memberships.

Design:

- accept `idempotency_key`;
- check existing request/action if future table exists;
- minimally, re-check existing admin/email before create;
- if duplicate detected, return safe `already_exists`/`already_has_admin` response;
- credential response should only be returned for the original successful creation flow.

C7.5 does not create idempotency table.

## 17. Rollback/cleanup strategy

Provisioning has multiple steps:

1. create Auth user;
2. create account/profile metadata if needed;
3. create `center_members` membership;
4. write audit log.

Failure risks:

- Auth user created but membership failed;
- membership created but audit failed;
- network timeout after success.

Design requirement:

- endpoint should be transaction-like where possible;
- if Auth user created but membership/profile fails, cleanup/disable/delete pending user if safe;
- if success happened but response failed, idempotency should prevent duplicate retry;
- do not show credential panel unless whole flow succeeds.

## 18. Audit log contract

Every sensitive action must write audit log.

For admin provisioning:

- `action = account.provision_center_admin`
- `actor_user_id`
- `actor_email`
- `target_user_id`
- `target_email`
- `center_id`
- `before_state`
- `after_state`
- `reason`
- `created_at`
- `request_id` / `idempotency_key`

Do not log:

- `temporary_password`;
- plaintext password;
- service role secret;
- raw token.

## 19. Reset password readiness

C7.7 target, but contract readiness in C7.5:

Input concept:

```json
{
  "target_user_id": "...",
  "reason": "..."
}
```

Rules:

- actor owner only;
- generate new temporary password server-side;
- update/reset via privileged flow;
- optionally revoke sessions if supported and verified later;
- return temporary password once;
- audit `account.reset_password` without password.

Success panel: "Đã đặt lại mật khẩu", email, mật khẩu tạm thời, copy actions.

## 20. Revoke/ban readiness

Revoke center access:

- update membership status to `revoked`;
- scope center-specific;
- does not ban globally.

Ban account:

- update account status to `banned`/`disabled` in future account profile;
- prevent access globally in app guard;
- do not hard delete Auth user by default.

C7.5 does not implement account profile table.

## 21. Center lifecycle readiness

Archive center:

- `status -> archived`;
- hide from default production active list;
- keep data;
- audit `center.archive`.

Paused center:

- `status -> paused`;
- visible to owner, restricted for normal operations.

Hard delete default: NO.

## 22. UI readiness: panel/window not inline

Future runtime must use separate panel/window/modal, not dangerous inline table forms.

Internal Console row example:

```txt
Phòng Trống [Mở OS cơ sở] [Thông tin] [Quản lý truy cập]
```

Inside Access Management Panel:

```txt
Admin cơ sở:
- Chưa có admin
- [Tạo admin cơ sở]
```

After success, credential handoff panel/window opens.

## 23. C7.6 proposed target/split

C7.6 should be narrowly scoped:

```txt
Create admin account for existing production center + credential handoff
```

Recommended split:

- C7.6A - Edge Function/admin provisioning implementation design pack
- C7.6B - Manual deploy/apply readiness
- C7.6C - Runtime button/panel owner-only
- C7.6D - Controlled manual QA on Phòng Trống
- C7.6E - Checkpoint review

Không tạo admin thật trước khi C7.6 safety/deploy rõ.

## 24. Risk list

Risks:

- service role key exposed to browser;
- trusting `{ role: "owner" }` from client body;
- fixed default password;
- password generated with `Math.random`;
- plaintext password logged or stored;
- duplicate admin for DreamHome;
- duplicate admin from double-click/retry;
- Auth user created but membership/audit fails;
- old password returned accidentally;
- internal email cannot login due to email confirmation settings;
- dangerous provisioning form inline in dashboard table;
- no audit log for privileged action.

## 25. PASS / NEEDS REVIEW criteria

PASS when:

- server-side provisioning architecture rõ;
- frontend direct Auth user creation NO;
- service role server-side only rõ;
- owner guard không trust client body;
- admin provisioning contract rõ;
- Phòng Trống ready for future admin provisioning;
- DreamHome duplicate admin protection rõ;
- temporary password random rõ;
- Math.random NO;
- credential handoff response rõ;
- password display once rõ;
- no plaintext password logging;
- email confirmation/login caveat noted;
- duplicate email handling rõ;
- idempotency/double-click handling rõ;
- rollback/cleanup strategy rõ;
- audit log contract rõ;
- reset/revoke/ban/center lifecycle readiness rõ;
- UI panel/window not inline rõ;
- C7.6 split recommended;
- no SQL/Supabase action/Auth user/membership/Edge Function/runtime;
- build/diff pass;
- không commit/push.

NEEDS REVIEW nếu có runtime/SQL/Edge Function thật, có account/membership thật, hoặc chưa chốt được service-role/rollback/credential safety.
