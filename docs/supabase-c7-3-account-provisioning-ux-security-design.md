# C7.3 - Account provisioning UX/security design

C7.3 STATUS: ACCOUNT PROVISIONING UX SECURITY DESIGN
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_2_MANUAL_SQL_INSPECTION: PASS
PRODUCTION_CENTERS_INSPECTED: YES
PRODUCTION_OWNER_MEMBERSHIP_VALIDATED: YES
CENTER_ADMIN_ONE_CENTER_VIOLATION_RESULT: 0
TEACHER_MEMBERSHIP_CURRENTLY_EMPTY: YES
TEACHER_GLOBAL_TABLE_CURRENTLY_MISSING: YES
STAGING_LEGACY_ADMIN_ROLE_NOTED: YES
CENTER_CLOUD_TEACHER_DATA_STAGING_NOTED: YES
ADMIN_ACCOUNT_EMAIL_PATTERN_DESIGNED: admin.<slug>@ichess.vn
TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES
FIXED_DEFAULT_PASSWORD_RECOMMENDED: NO
CREDENTIAL_HANDOFF_PANEL_REQUIRED: YES
CREDENTIAL_HANDOFF_PANEL_SHOWS_EMAIL: YES
CREDENTIAL_HANDOFF_PANEL_SHOWS_TEMP_PASSWORD: YES
CREDENTIAL_COPY_ACTIONS_DESIGNED: YES
PASSWORD_DISPLAY_ONCE_DESIGNED: YES
PLAINTEXT_PASSWORD_STORAGE_ALLOWED: NO
FRONTEND_DIRECT_AUTH_USER_CREATION_ALLOWED: NO
SERVER_SIDE_PRIVILEGED_FLOW_REQUIRED: YES
ADMIN_ACCOUNT_PROVISIONING_FLOW_DESIGNED: YES
TEACHER_ACCOUNT_PROVISIONING_FLOW_DESIGNED: YES
TEACHER_MULTI_CENTER_ASSIGNMENT_DESIGNED: YES
CENTER_ADMIN_CAN_CREATE_GLOBAL_TEACHERS: NO
MODULE_6_RUNTIME_CHANGED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
RUNTIME_CHANGE: NO
C7_4_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.3

C7.3 chỉ thiết kế UX/security cho account provisioning sau C7.1/C7.2 PASS và sau khi user đã chạy C7.2 read-only SQL inspection. Mục tiêu là chốt cách owner tạo admin/teacher account bằng server-side privileged flow, không tạo tài khoản thật.

Scope C7.3:

- thiết kế flow tạo admin account cho center;
- thiết kế flow tạo teacher account/global profile;
- thiết kế email admin dạng `admin.<slug>@ichess.vn`;
- thiết kế mật khẩu tạm thời random;
- thiết kế panel "Đã tạo tài khoản" hiển thị email/password/copy một lần;
- thiết kế guard/security/failure handling;
- không runtime, không SQL apply, không Supabase action, không Auth user/membership thật, không Edge Function thật, không C7.4.

## 2. C7.2 manual SQL inspection summary

User đã chạy C7.2 read-only SQL inspection và report:

Centers:

- `dreamhome_prod,DreamHome,dreamhome,production,active`
- `phongtrong_prod,Phòng Trống,phongtrong,production,active`
- `dreamhome,DreamHome,dreamhome,staging,active`

Production membership:

- `admin.dreamhome@ichess.vn` / `dreamhome_prod` / `center_admin` / `active`
- `owner.duchai@ichess.vn` / `dreamhome_prod` / `owner` / `active`
- `owner.duchai@ichess.vn` / `phongtrong_prod` / `owner` / `active`

Staging legacy membership:

- `hoangvan@gmail.com` / `dreamhome` / `owner` / `active`
- `phamducthang2045@gmail.com` / `dreamhome` / `owner` / `active`
- `tranduchai@gmail.com` / `dreamhome` / `admin` / `active`

Other findings:

- center_admin one-center violation: `Success. No rows returned`.
- role counts: `admin,active,1`, `center_admin,active,1`, `owner,active,4`.
- teacher membership query: `Success. No rows returned`.
- teacher-related table query: only `public,center_members`.
- `center_cloud_entities` has staging `dreamhome` generic teacher data: `teacher,dreamhome,6`.

Conclusion: production membership đúng hướng, center_admin one-center rule đang không bị vi phạm, chưa có teacher account/membership production, chưa có teacher global table thật, legacy `admin` chỉ ở staging và không blocker cho production design.

## 3. Account provisioning principle

Auth account không được tạo trực tiếp từ frontend public client. Thiết kế đúng:

1. Owner bấm tạo tài khoản trong UI.
2. Frontend gọi server-side privileged endpoint.
3. Endpoint dùng service role hoặc Admin API an toàn để tạo Auth user.
4. Endpoint tạo membership/profile/assignment tương ứng.
5. Endpoint trả credential tạm thời đúng một lần.
6. Frontend hiển thị credential handoff panel "Đã tạo tài khoản".

C7.3 không tạo endpoint thật.

## 4. Why frontend must not create Auth users directly

Frontend public client không được giữ service role, không được bypass RLS và không được ghi trực tiếp vào Auth/membership. Tạo account từ frontend sẽ làm lộ quyền cao, khó audit lỗi partial success, và dễ để center_admin/teacher tự tạo quyền ngoài scope.

Frontend chỉ gửi request đã validate tối thiểu; quyền thật, duplicate email, tạo Auth user, tạo membership/profile và rollback phải nằm ở backend/server-side privileged flow.

## 5. Server-side privileged flow concept

Endpoint tương lai có thể là Supabase Edge Function hoặc backend admin service, nhưng C7.3 không tạo Edge Function thật.

Endpoint phải:

- xác thực actor là owner;
- kiểm tra owner có quyền với target center;
- validate input;
- kiểm tra duplicate email;
- sinh mật khẩu tạm thời random;
- tạo Auth user bằng service role/Admin API;
- tạo membership/profile/assignment;
- ghi audit;
- trả email + mật khẩu tạm thời một lần;
- không log plaintext password.

## 6. Admin account convention

Khi tạo admin cho center production:

- center slug: `phongtrong`
- admin email: `admin.phongtrong@ichess.vn`
- role: `center_admin`
- center_id: `phongtrong_prod`
- status: `active` hoặc `invited` tùy phase C7.4 chốt

Production không dùng role legacy `admin`; production dùng `center_admin`.

## 7. admin.<slug>@ichess.vn convention

Convention bắt buộc cho primary center admin giai đoạn đầu:

- `admin.<slug>@ichess.vn`
- `admin.dreamhome@ichess.vn`
- `admin.phongtrong@ichess.vn`

Nếu owner override email sau này, C7.4 phải có rule rõ. Default vẫn là `admin.<slug>@ichess.vn`.

## 8. center_admin one-center rule

Rule:

- mỗi production center chỉ nên có tối đa 1 primary `center_admin` active ở phase đầu;
- một `center_admin` chỉ có 1 active center membership;
- nếu chuyển admin sang cơ sở khác, phải có transfer/deactivate flow sau;
- C7.2 manual inspection cho thấy violation result hiện là `0`.

## 9. Teacher account/profile convention

Teacher không dùng pattern `teacher.<slug>@ichess.vn` bắt buộc vì teacher có thể dạy nhiều cơ sở.

Teacher email có thể là:

- email cá nhân thật của giáo viên;
- hoặc email iChess cấp nếu owner muốn.

Global profile đề xuất:

- `teacher_profiles.teacher_id`
- `teacher_profiles.user_id`
- `teacher_profiles.name`
- `teacher_profiles.email`
- `teacher_profiles.phone`
- `teacher_profiles.status`
- `teacher_profiles.specialties`

Hiện C7.2 cho thấy chưa có teacher global table thật.

## 10. Teacher multi-center assignment

Teacher có thể thuộc nhiều cơ sở qua assignment. Hai hướng cần chốt ở C7.4/C7.5:

A. Dùng `center_members` role `teacher` cho teacher access/login, kết hợp `teacher_profiles` và `center_teacher_assignments` cho nghiệp vụ.

B. Dùng `center_teacher_assignments` riêng cho nghiệp vụ, còn `center_members` chỉ phục vụ login/access theo center.

Recommendation C7.3: teacher nên có global profile riêng. Access/login có thể map qua `center_members` role `teacher` hoặc assignment table, nhưng cần chốt ở C7.4/C7.5 sau khi design policy rõ.

## 11. Temporary password principle

Mỗi account được tạo bằng mật khẩu tạm thời random riêng.

Không dùng mật khẩu mặc định cố định như:

- `admin123`
- `123456`
- `ichess123`
- `IChess@123`

Principle:

- mật khẩu tạm thời phải đủ mạnh;
- mật khẩu tạm thời chỉ hiển thị một lần ngay sau khi tạo;
- không lưu plaintext password trong database/log/localStorage;
- owner phải copy/lưu/gửi cho người nhận;
- sau này có đổi mật khẩu hoặc reset mật khẩu.

Ví dụ hiển thị:

- Email: `admin.phongtrong@ichess.vn`
- Mật khẩu tạm thời: `IChess@7KQ4-M9P2`

Đây là "mật khẩu tạm thời", không phải mật khẩu mặc định cố định.

## 12. Credential handoff panel requirement

Credential handoff panel là requirement bắt buộc.

Sau khi tạo account thành công, UI phải hiển thị panel/modal:

- tiêu đề: "Đã tạo tài khoản admin cơ sở" hoặc "Đã tạo tài khoản giáo viên";
- email đăng nhập;
- mật khẩu tạm thời;
- trạng thái/tên center hoặc teacher;
- lưu ý mật khẩu tạm thời chỉ hiển thị trong lần tạo này;
- các action copy.

Không được tạo account xong rồi không hiện credential. User phải biết mật khẩu để đăng nhập lần đầu.

## 13. Notification wording

Admin example:

```txt
Đã tạo tài khoản admin cơ sở

Tài khoản này dùng để đăng nhập vào cơ sở Phòng Trống.
Email: admin.phongtrong@ichess.vn
Mật khẩu tạm thời: IChess@7KQ4-M9P2

Hãy lưu lại thông tin này. Mật khẩu tạm thời chỉ hiển thị trong lần tạo này.
```

Teacher example:

```txt
Đã tạo tài khoản giáo viên

Giáo viên có thể đăng nhập bằng thông tin dưới đây.
Email: giaovien@example.com
Mật khẩu tạm thời: IChess@9FQ2-L7AM

Hãy lưu lại thông tin này. Mật khẩu tạm thời chỉ hiển thị trong lần tạo này.
```

## 14. Copy credential actions

Panel cần có:

- Copy email;
- Copy mật khẩu;
- Copy toàn bộ thông tin.

Copy toàn bộ thông tin nên bao gồm email, mật khẩu tạm thời, tên cơ sở/teacher và lưu ý đổi/reset mật khẩu sau này. Không tự ghi thông tin này vào localStorage.

## 15. Password storage/logging safety

Safety:

- không log plaintext password;
- không lưu password trong localStorage;
- không lưu plaintext password trong database;
- không hiển thị lại password sau khi đóng panel;
- không gửi password qua channel không an toàn nếu chưa có policy;
- không dùng chung password cho nhiều account.

Nếu cần audit, chỉ log metadata: actor, target email, target center/profile, action, success/failure, request id. Không log mật khẩu.

## 16. Reset/change password future

C7.3 chỉ design:

- tạo mật khẩu tạm thời;
- hiện credential sau tạo.

Later:

- đổi mật khẩu trong account settings;
- owner reset password;
- force change password on first login nếu làm được;
- invite email/passwordless flow nếu sau này phù hợp.

C7.3 không implement reset/change password.

## 17. Admin account provisioning flow

Flow thiết kế:

1. Validate actor is owner.
2. Validate target center exists, `production`, `active`.
3. Validate owner has permission for target center.
4. Generate email `admin.<slug>@ichess.vn` or accept owner override if later allowed.
5. Check email not used.
6. Generate temporary password.
7. Create Auth user server-side.
8. Create `center_members` row role `center_admin`, status `active` or `invited`.
9. Return email + temporary password once.
10. UI shows credential handoff panel.

C7.3 không tạo admin account thật.

## 18. Teacher account provisioning flow

Flow thiết kế:

1. Validate actor is owner.
2. Validate teacher profile input.
3. Validate email unique.
4. Generate temporary password.
5. Create Auth user server-side.
6. Create teacher profile.
7. Assign teacher to selected centers if requested.
8. Return email + temporary password once.
9. UI shows credential handoff panel.

C7.3 không tạo teacher account thật.

## 19. Failure/rollback handling

Nếu Auth user tạo thành công nhưng membership/profile fail:

- endpoint phải rollback nếu có thể;
- hoặc mark pending cleanup với audit rõ;
- trả error rõ ràng;
- không hiển thị partial credential như success;
- không để user nghĩ account đã sẵn sàng khi membership/profile chưa hoàn tất.

Cần audit duplicate email, partial failure, retry idempotency và cleanup.

## 20. Module 6 teacher button impact

Module 6 runtime không sửa ở C7.3.

Tương lai:

- owner có thể tạo giáo viên global ở Account/People Management hoặc owner mode của Module 6;
- center_admin không thấy action tạo giáo viên global;
- center_admin chỉ thấy giáo viên được phân vào cơ sở;
- teacher không dùng Module 6 admin.

## 21. Role and permission guard

Guard bắt buộc:

- chỉ owner được tạo admin/teacher account;
- center_admin không được tạo global teachers;
- center_admin không được tạo admin khác;
- teacher không tự join center;
- production dùng `center_admin`, không dùng legacy `admin`;
- staging legacy `admin` đã được noted, không phải production pattern.

## 22. Risk list

Rủi ro:

- log plaintext password;
- lưu password trong localStorage;
- hiển thị lại password sau khi đóng panel;
- gửi password qua channel không an toàn;
- dùng chung password cho nhiều account;
- tạo account từ frontend public key;
- cho center_admin tạo teacher/admin account;
- cho teacher tự join center;
- không audit duplicate email;
- thiếu rollback/cleanup nếu Auth user success nhưng membership/profile fail;
- dùng role legacy `admin` trong production;
- thiếu guard center_admin one-center.

## 23. C7.4 implementation recommendation

C7.4 nên là design/apply readiness cho server-side account provisioning, chưa vội tạo account thật nếu chưa đủ safety checklist.

Trước C7.4 implementation cần chốt:

- Edge Function hay backend admin service;
- input contract;
- audit log shape;
- rollback strategy;
- status `active` hay `invited`;
- whether teacher access maps through `center_members` or assignment policies;
- exact credential handoff UX and copy behavior.

Không tạo account thật cho tới khi C7.4/C7.5 safety clear.

## 24. PASS / NEEDS REVIEW criteria

PASS khi:

- C7.2 manual SQL result được ghi nhận;
- account provisioning server-side design rõ;
- `admin.<slug>@ichess.vn` convention rõ;
- temporary password random rõ;
- không dùng fixed default password;
- credential handoff panel bắt buộc;
- panel hiển thị email + temp password + copy actions;
- password chỉ hiển thị một lần;
- không lưu plaintext password;
- frontend không trực tiếp tạo Auth user;
- admin/teacher provisioning flow rõ;
- center_admin không tạo giáo viên global;
- Module 6 không đổi runtime;
- no SQL/Supabase action/Auth user/membership/Edge Function/runtime;
- build/diff pass;
- không commit/push.

NEEDS REVIEW nếu phát hiện runtime/SQL/Edge Function thật, account/membership thật, file ngoài scope, hoặc chưa chốt được credential handoff/security boundary.
