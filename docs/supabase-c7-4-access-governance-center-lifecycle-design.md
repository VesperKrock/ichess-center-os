# C7.4 - Access Governance & Center Lifecycle Design

C7.4 STATUS: ACCESS GOVERNANCE CENTER LIFECYCLE DESIGN
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
OWNER_AUTHORITY_DESIGNED: YES
OWNER_CAN_BAN_ACCOUNTS_DESIGNED: YES
OWNER_CAN_REVOKE_ACCESS_DESIGNED: YES
OWNER_CAN_RESET_PASSWORD_DESIGNED: YES
OWNER_CAN_MANAGE_CENTER_LIFECYCLE_DESIGNED: YES
CENTER_LIFECYCLE_DESIGNED: YES
CENTER_STATUS_ACTIVE_DESIGNED: YES
CENTER_STATUS_PAUSED_DESIGNED: YES
CENTER_STATUS_ARCHIVED_DESIGNED: YES
HARD_DELETE_CENTER_DEFAULT_ALLOWED: NO
PHONG_TRONG_CAN_BE_ARCHIVED_LATER: YES
CENTER_INFO_EDIT_DESIGNED: YES
ACCOUNT_LIFECYCLE_DESIGNED: YES
MEMBERSHIP_LIFECYCLE_DESIGNED: YES
BAN_VS_REVOKE_DESIGNED: YES
RESET_PASSWORD_TEMP_CREDENTIAL_HANDOFF_DESIGNED: YES
PASSWORD_PLAINTEXT_AUDIT_LOG_ALLOWED: NO
UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES
DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO
CONFIRMATION_UX_REQUIRED: YES
AUDIT_LOG_REQUIRED_FOR_SENSITIVE_ACTIONS: YES
PERMISSION_GUARD_MATRIX_DESIGNED: YES
CENTER_ADMIN_CAN_BAN_ACCOUNTS: NO
CENTER_ADMIN_CAN_RESET_OTHERS_PASSWORD: NO
CENTER_ADMIN_CAN_ARCHIVE_CENTER: NO
SUPER_ADMIN_ADVANCED_DEFERRED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
RUNTIME_CHANGE: NO
C7_5_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.4

C7.4 thiết kế Access Governance & Center Lifecycle cho owner/anh Hải sau C7.1/C7.2/C7.3 PASS. Phase này chốt quyền quản trị tối cao, lifecycle cơ sở, lifecycle account/membership, ban/revoke/reset password, audit log, confirmation UX và pattern UI mở panel/window riêng.

C7.4 không implement runtime, không apply SQL, không gọi Supabase, không tạo Auth user, không tạo membership, không tạo Edge Function, không sửa Module 6, không mở C7.5 và không commit/push.

## 2. Trạng thái sau C7.3

C7.3 PASS đã chốt account provisioning UX/security:

- Auth user không tạo trực tiếp từ frontend.
- Account provisioning cần server-side privileged flow.
- Admin account dùng email pattern `admin.<slug>@ichess.vn`.
- Mật khẩu tạm thời phải random, không dùng fixed default password.
- Credential handoff panel bắt buộc, hiển thị email và mật khẩu tạm thời một lần.
- Plaintext password không được lưu trong database/log/localStorage.

C7.2 manual SQL inspection đã ghi nhận production center `dreamhome_prod` và `phongtrong_prod`, owner membership hợp lệ, center_admin one-center violation result bằng `0`, teacher membership đang empty và teacher global table chưa có.

## 3. Owner authority principle

iChess là của owner/anh Hải. Owner có quyền quản trị tối cao trong hệ thống.

Owner có thể:

- tạo/sửa/ngừng/lưu trữ cơ sở;
- tạo tài khoản admin/teacher;
- reset mật khẩu tài khoản;
- khóa/mở khóa tài khoản;
- thu hồi quyền truy cập khỏi cơ sở;
- ban account toàn hệ thống;
- phân/gỡ giáo viên khỏi cơ sở;
- xem và kiểm tra audit log cho action nhạy cảm.

Mọi action nhạy cảm phải có confirm rõ, có audit log, và tránh hard delete mặc định.

## 4. Center lifecycle

Center lifecycle đề xuất:

- `active`: đang hoạt động.
- `paused`: tạm ngừng, còn dữ liệu, không cho hoạt động bình thường.
- `archived`: lưu trữ/ẩn khỏi mặc định, dữ liệu vẫn còn.

Nếu code cũ còn dùng `inactive`, phase sau cần map hoặc migrate có kiểm soát. Recommendation là chuẩn hóa `active/paused/archived` cho center lifecycle.

Hard delete center default allowed: NO. Hard delete không expose trong UI thường; chỉ reserved cho internal operator/dev sau backup và audit cực rõ.

## 5. Center info/edit rules

Center info panel nên có:

- tên cơ sở;
- `center_id`;
- slug;
- environment;
- status;
- ngày tạo;
- ngày cập nhật;
- admin chính nếu có;
- số lượng học viên/giáo viên/ca học nếu phase sau có aggregate an toàn.

Editable fields an toàn:

- `name`;
- `display_name` nếu có;
- `address`;
- `phone`;
- `notes`;
- status qua action riêng.

Không nên sửa trực tiếp:

- `center_id`;
- `environment`.

Slug nên coi là stable sau khi tạo. Nếu cần đổi slug sau này, cần alias/redirect plan, không làm ở C7.4.

## 6. Phòng Trống handling

Phòng Trống là production center thật: `phongtrong_prod` / `phongtrong` / `production` / `active`.

C7.4 không xóa Phòng Trống, không tạo admin ngay cho Phòng Trống và không hard delete center. Sau này, nếu không dùng, owner có thể `paused` hoặc `archived` Phòng Trống bằng flow có confirm và audit log.

PHONG_TRONG_CAN_BE_ARCHIVED_LATER: YES.

## 7. Account lifecycle

Account lifecycle đề xuất:

- `active`: dùng bình thường.
- `paused`: tạm khóa nhẹ, có thể mở lại.
- `disabled`: vô hiệu hóa tài khoản.
- `banned`: cấm toàn hệ thống.

Nếu Supabase Auth không có custom account status trực tiếp, phase sau cần app-level profile/account table. Không dùng Auth user delete làm hành động thường.

## 8. Membership lifecycle

Membership lifecycle đề xuất:

- `active`: có quyền vào center.
- `paused`: tạm dừng quyền tại center.
- `revoked`: đã bị thu hồi quyền khỏi center.
- `expired`: quyền hết hạn nếu sau này cần.

Không xóa membership mặc định. Nên update status để giữ lịch sử và phục vụ audit.

## 9. Ban vs revoke

`revoke access`:

- thu hồi quyền khỏi một cơ sở;
- account có thể vẫn dùng ở cơ sở khác.

`ban account`:

- chặn toàn hệ thống;
- account không được truy cập đâu cả.

Ví dụ: Teacher A bị revoke khỏi DreamHome nhưng vẫn có thể dạy ở Gò Vấp. Teacher A bị banned thì không vào cơ sở nào.

## 10. Reset password / thay ổ khóa

Owner có quyền reset password cho admin/teacher.

Reset password design:

- tạo mật khẩu tạm thời random mới;
- sau reset phải hiện credential handoff panel giống create account;
- password chỉ hiển thị một lần;
- không lưu plaintext password;
- có nút copy email, copy password, copy toàn bộ;
- có audit log.

Nếu Supabase hỗ trợ revoke sessions/Admin API ở phase sau, reset password nên kèm optional revoke sessions.

C7.4 chỉ design, chưa implement.

## 11. Credential handoff after reset

Panel wording:

```txt
Đã đặt lại mật khẩu

Tài khoản:
Email: admin.phongtrong@ichess.vn
Mật khẩu tạm thời: IChess@8KQ2-LM91

Hãy lưu lại thông tin này. Mật khẩu tạm thời chỉ hiển thị trong lần này.
```

Credential handoff sau reset phải giống create account: hiển thị email, mật khẩu tạm thời, copy actions, và cảnh báo chỉ hiển thị một lần.

## 12. UI pattern: button opens separate panel/window

Không nhét form quản trị nhạy cảm inline vào dashboard/table. Mỗi action lớn mở panel/window/modal riêng bằng nút.

Pattern:

- button ở row hoặc toolbar;
- mở panel/window riêng;
- panel/window có header rõ, body rộng, footer action;
- action nguy hiểm có confirm step;
- dashboard không bị chèn ép bởi form dài hoặc action nhạy cảm.

UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES.
DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO.

## 13. Internal Console action design

Row center:

- Mở OS cơ sở;
- Thông tin;
- Quản lý truy cập;
- Sửa;
- Ngừng hoạt động / Lưu trữ.

Row account/member:

- Thông tin tài khoản;
- Reset mật khẩu;
- Thu hồi quyền;
- Ban tài khoản.

Panel/window list:

- Center Info Panel;
- Center Edit Panel;
- Center Lifecycle Panel;
- Access Management Panel;
- Account Reset Password Panel;
- Ban/Revoke Confirmation Panel;
- Audit Log Panel.

C7.4 không implement UI. Chỉ design pattern để C7.5+ dùng.

## 14. Confirmation UX

Action nguy hiểm bắt buộc confirm.

Archive center:

```txt
Bạn sắp lưu trữ cơ sở Phòng Trống.
Cơ sở sẽ bị ẩn khỏi danh sách mặc định và người dùng có thể mất quyền thao tác.
Dữ liệu vẫn được giữ lại.
Gõ ARCHIVE để xác nhận.
```

Ban account:

```txt
Bạn sắp ban tài khoản admin.phongtrong@ichess.vn.
Tài khoản này sẽ mất quyền truy cập toàn hệ thống.
Gõ BAN để xác nhận.
```

Revoke membership:

```txt
Bạn sắp thu hồi quyền truy cập của teacher@example.com khỏi DreamHome.
Gõ REVOKE để xác nhận.
```

Reset password:

```txt
Bạn sắp đặt lại mật khẩu cho admin.phongtrong@ichess.vn.
Mật khẩu cũ sẽ không còn dùng được.
Gõ RESET để xác nhận.
```

## 15. Audit log requirement

Mọi action nhạy cảm phải ghi audit log.

Audit fields concept:

- `id`
- `actor_user_id`
- `actor_email`
- `action`
- `target_type`
- `target_id`
- `target_email`
- `center_id` nullable
- `before_state` jsonb
- `after_state` jsonb
- `reason` nullable
- `created_at`
- `request_id` nullable

Không log plaintext password. Password reset audit chỉ log action `account.reset_password`, target và metadata, không log mật khẩu tạm thời.

## 16. Audit action examples

Action examples:

- `center.archive`
- `center.pause`
- `center.restore`
- `center.update_info`
- `account.reset_password`
- `account.ban`
- `account.unban`
- `membership.revoke`
- `membership.pause`
- `membership.restore`
- `teacher.assign_center`
- `teacher.remove_center`

Audit log phải đủ để biết ai làm, làm gì, làm với ai/cơ sở nào, trước/sau ra sao và request nào.

## 17. Permission guard matrix

| Action | owner | center_admin | teacher |
| --- | --- | --- | --- |
| View Internal Console | YES | NO | NO |
| Create center | YES | NO | NO |
| Edit center info | YES | NO/limited | NO |
| Archive center | YES | NO | NO |
| Create admin account | YES | NO | NO |
| Reset admin password | YES | NO | NO |
| Create teacher account | YES | NO | NO |
| Assign teacher to center | YES | NO | NO |
| Revoke teacher from center | YES | NO | NO |
| Ban account | YES | NO | NO |
| View own teaching schedule | optional | NO | YES |

PERMISSION_GUARD_MATRIX_DESIGNED: YES.

## 18. center_admin limitations

By default, `center_admin` không được:

- archive center;
- reset password người khác;
- ban account;
- tạo admin account;
- tạo teacher account;
- phân/gỡ teacher global;
- truy cập Internal Console.

Sau này center_admin có thể được sửa một số thông tin cơ sở nếu owner cho phép, nhưng phải limited, audited và không bao gồm lifecycle/account governance nhạy cảm.

## 19. Teacher access implications

Teacher có thể thuộc nhiều cơ sở. Vì vậy:

- revoke khỏi một center không đồng nghĩa ban toàn hệ thống;
- teacher assignment/membership phải có status riêng;
- teacher không tự join center;
- teacher chỉ thấy ca dạy/center được phân;
- teacher portal foundation phải kiểm tra ban/account status và membership/assignment status.

## 20. Super Admin/internal operator deferred

Super Admin/internal operator advanced deferred tới phase sau, ví dụ C7.14.

Có thể cần internal operator cho dev/support sau này, nhưng không mở quyền này trước khi audit log và acting mode ổn định.

C7.4 không implement Super Admin, internal operator advanced, acting mode hay "biến thành admin cơ sở".

## 21. Risk list

Rủi ro:

- hard delete center làm mất lịch sử hoặc dữ liệu production;
- archive/ban/revoke thiếu confirm;
- reset password không hiện credential handoff;
- log plaintext password vào audit;
- center_admin có quyền quá rộng;
- revoke và ban bị lẫn nghĩa;
- membership bị xóa thay vì đổi status;
- Phòng Trống bị xóa cứng dù chỉ cần paused/archived;
- panel quản trị bị nhét inline làm dashboard rối và dễ thao tác nhầm;
- thiếu audit before/after state cho action nhạy cảm.

## 22. C7.5 implementation/readiness recommendation

Nếu C7.4 PASS, C7.5 nên là server-side account/access governance readiness, chưa vội implement toàn bộ ban/reset/archive nếu safety chưa đủ.

C7.5 nên chuẩn bị:

- schema/readiness cho account status và membership status;
- audit log shape và write path;
- server-side privileged endpoint design;
- confirmation UX contract;
- credential handoff contract cho reset password;
- no hard delete policy;
- allowlist action owner-only;
- test plan cho owner vs center_admin vs teacher.

Chưa implement ban/reset/archive trước khi C7.5/C7.6 safety rõ.

## 23. PASS / NEEDS REVIEW criteria

PASS khi:

- owner authority design rõ;
- center lifecycle `active/paused/archived` rõ;
- hard delete default NO;
- Phòng Trống có thể archive later;
- account/membership lifecycle rõ;
- ban vs revoke rõ;
- reset password + credential handoff rõ;
- UI separate panel/window required;
- dashboard inline dangerous forms NO;
- confirmation UX required;
- audit log required;
- permission matrix rõ;
- center_admin limitations rõ;
- no SQL/Supabase action/Auth user/membership/Edge Function/runtime;
- build/diff pass;
- không commit/push.

NEEDS REVIEW nếu có runtime/SQL/Edge Function thật, có account/membership thật, có file ngoài scope, hoặc chưa chốt được governance boundary.
