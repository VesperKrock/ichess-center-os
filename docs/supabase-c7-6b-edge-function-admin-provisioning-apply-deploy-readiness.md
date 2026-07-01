# C7.6B - Edge Function/admin provisioning apply-deploy readiness

C7.6B STATUS: EDGE FUNCTION ADMIN PROVISIONING APPLY DEPLOY READINESS
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
C7_4_STATUS: PASS
C7_5_STATUS: PASS
C7_6A_STATUS: PASS
READONLY_INSPECT_SQL_CREATED: YES
TARGET_CENTERS_READINESS_DESIGNED: YES
EXISTING_CENTER_ADMIN_READINESS_DESIGNED: YES
DREAMHOME_DUPLICATE_ADMIN_CHECK_DESIGNED: YES
PHONGTRONG_ADMIN_ABSENCE_CHECK_DESIGNED: YES
DUPLICATE_ADMIN_EMAIL_CHECK_DESIGNED: YES
CENTER_ADMIN_ONE_CENTER_CHECK_DESIGNED: YES
CONSTRAINTS_INDEXES_POLICIES_CHECK_DESIGNED: YES
AUDIT_INFRASTRUCTURE_CHECK_DESIGNED: YES
EXISTING_FUNCTIONS_CHECK_DESIGNED: YES
EDGE_FUNCTIONS_UI_CHECKLIST_DESIGNED: YES
SECRETS_READINESS_CHECKLIST_DESIGNED: YES
AUTH_SETTINGS_READINESS_CHECKLIST_DESIGNED: YES
EMAIL_CONFIRMATION_LOGIN_CHECK_REQUIRED: YES
AUDIT_READINESS_REQUIRED_BEFORE_REAL_PROVISIONING: YES
PRODUCTION_DATA_SAFETY_CHECKLIST_DESIGNED: YES
READINESS_DECISION_MATRIX_DESIGNED: YES
C7_6C_OR_AUDIT_PACK_RECOMMENDED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
EDGE_FUNCTION_DEPLOYED: NO
SECRETS_SET_BY_CODEX: NO
RUNTIME_CHANGE: NO
C7_6C_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6B

C7.6B chuẩn bị readiness/checklist trước khi quyết định có thể implement/deploy `provision_center_admin_account` hay chưa. Pha này chỉ tạo docs, read-only SQL inspection và smoke static.

Không tạo Edge Function thật, không tạo thư mục `supabase/functions`, không deploy, không set secrets, không chạy SQL, không Supabase action, không tạo Auth user, không tạo admin account thật, không tạo membership và không sửa runtime Module 6.

## 2. Trạng thái sau C7.6A

C7.6A đã PASS ở mức implementation design pack cho function tương lai `provision_center_admin_account`. Contract đã chốt owner guard, service role server-side only, email `admin.<slug>@ichess.vn`, duplicate handling, temporary password random, credential handoff một lần, rollback/cleanup và audit log không chứa plaintext password.

C7.6B không implement contract đó. C7.6B chỉ kiểm tra điều kiện nền: Edge Functions support, secrets, Auth email/password settings, audit infrastructure, constraints/policies, manual deploy plan và manual QA gates cho Phòng Trống/DreamHome duplicate.

## 3. Read-only SQL created

Read-only SQL inspection pack:

```text
docs/supabase-c7-6b-readonly-inspect-admin-provisioning-readiness.sql
```

File này dùng để user tự chạy thủ công nếu muốn kiểm tra readiness. CodeX không chạy SQL này.

## 4. SQL safety statement

SQL C7.6B chỉ gồm truy vấn đọc. Không có SQL apply/migration, không có mutating statement, không gọi provisioning RPC và không tạo/sửa/xóa dữ liệu.

Header bắt buộc trong SQL:

```sql
-- C7.6B READ-ONLY INSPECTION ONLY
-- Do not run as apply/migration.
-- This file does not create Auth users.
-- This file does not create memberships.
-- This file does not create Edge Functions.
-- This file does not modify data.
-- Purpose: inspect database readiness before future admin account provisioning.
```

## 5. Target centers readiness

SQL kiểm tra centers:

- `dreamhome_prod`
- `phongtrong_prod`
- `dreamhome`

Expected theo C7.6B:

- `dreamhome_prod`: production, active.
- `phongtrong_prod`: production, active.
- `dreamhome`: staging, active.

Nếu `phongtrong_prod` không active hoặc slug không phải `phongtrong`, không nên đi tiếp provisioning admin thật.

## 6. Existing center_admin readiness

SQL kiểm tra `center_members` role `center_admin` active cho `dreamhome_prod` và `phongtrong_prod`.

Expected:

- `dreamhome_prod` đã có `admin.dreamhome@ichess.vn`.
- `phongtrong_prod` chưa có center_admin active.

Nếu Phòng Trống đã có admin, C7.6C/C7.6D không được tạo admin mới; phải chuyển sang duplicate/review path.

## 7. Duplicate admin email readiness

SQL kiểm tra `auth.users` cho:

- `admin.dreamhome@ichess.vn`
- `admin.phongtrong@ichess.vn`

Expected:

- `admin.dreamhome@ichess.vn` tồn tại.
- `admin.phongtrong@ichess.vn` chưa tồn tại.

Nếu `admin.phongtrong@ichess.vn` đã tồn tại bất ngờ, status phải là NEEDS REVIEW trước khi tạo membership hoặc reset password.

## 8. center_admin one-center rule readiness

SQL kiểm tra `center_admin` active ở nhiều cơ sở:

- Expected: 0 rows.
- Nếu có row, cần cleanup/decision riêng trước provisioning.

Rule này là điều kiện bắt buộc vì center_admin chỉ một cơ sở; teacher multi-center là câu chuyện khác và không thuộc C7.6B.

## 9. Constraints/indexes/policies readiness

SQL kiểm tra:

- Constraints của `centers`, `center_members`.
- Indexes của `centers`, `center_members`.
- RLS policies của `centers`, `center_members`.

Tóm tắt readiness: constraints/indexes/policies phải đủ rõ trước khi deploy provisioning thật.

Known policies user đã ghi nhận:

- `center_members`: `c4_6b members read own membership`, `members can view own memberships`.
- `centers`: `members can view centers`.

C7.6C/C7.6D cần biết có unique/index nào đủ để chống duplicate center admin hay chưa. Nếu thiếu constraint/index rõ ràng, function phải tự guard chặt và có thể cần SQL apply pack riêng trước khi tạo admin thật.

## 10. Audit infrastructure readiness

SQL kiểm tra:

- Dedicated audit/log tables trong `information_schema`.
- Columns của audit/log tables nếu có.
- Generic `center_cloud_entities` có `audit_log_entry` hay không.

Expected hiện tại từ user:

```text
audit_log_entry,dreamhome,1
```

Readiness conclusion tạm thời: generic staging audit entity đã tồn tại, nhưng dedicated server-side audit table cho sensitive account provisioning có thể đang thiếu. Không nên tạo admin account thật nếu chưa có audit path rõ ràng cho server-side actions.

AUDIT_READINESS_REQUIRED_BEFORE_REAL_PROVISIONING: YES.

## 11. Existing functions readiness

SQL kiểm tra public functions liên quan:

- `%provision%`
- `%audit%`
- `%account%`
- `%member%`

Expected:

- `provision_center_for_owner` tồn tại.
- Chưa có admin account provisioning function thật.

C7.6B không gọi function nào và không tạo function mới.

## 12. Edge Functions UI checklist

Manual Supabase UI checklist cho user:

- Project có mục Edge Functions không?
- Có cần Supabase CLI không?
- Deploy workflow sẽ dùng Supabase Dashboard hay CLI?
- Có billing/plan requirement không?
- Function region/project có đúng iChess không?
- Có log retention/observability tối thiểu cho function errors không?

C7.6B không tự kiểm tra online và không deploy.

## 13. Secrets readiness checklist

Secrets cần chuẩn bị cho phase deploy tương lai:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional `APP_BASE_URL`

Rules:

- Không paste service role key vào repo.
- Không paste service role key vào prompt.
- Không log service role key.
- Chỉ set trong Supabase secrets/Edge Function environment.
- Không expose service role key ra frontend.

SECRETS_SET_BY_CODEX: NO.

## 14. Auth settings readiness checklist

User cần kiểm tra trong Supabase Authentication settings:

- Email/password sign-in enabled?
- Confirm email required?
- Admin-created user có thể được marked confirmed không?
- Nếu dùng internal email `admin.phongtrong@ichess.vn`, login có hoạt động khi không có inbox thật không?
- Password reset enabled?
- Session behavior sau password reset là gì?

C7.6B không thay đổi Auth settings.

## 15. Audit readiness checklist

Checklist trước real provisioning:

- Có dedicated audit table cho server-side sensitive actions chưa?
- Nếu chưa, C7.6C nên là audit infrastructure/apply readiness pack trước provisioning.
- Audit log có ghi actor, target center, target email, target auth user id, result, reason code, idempotency hash không?
- Audit log không chứa temporary password, service role key, bearer token hay raw request body nhạy cảm.
- Không nên tạo admin account thật nếu không có audit path.

## 16. Production data safety

Manual safety gates:

- DreamHome duplicate test must not create new user.
- DreamHome duplicate test must not return old password.
- Phòng Trống controlled target chỉ dùng nếu user approve rõ.
- Không test trên cơ sở thật tương lai như Gò Vấp.
- Không archive/pause/reset/ban/revoke bất kỳ account thật nào trong C7.6B.
- Không seed dữ liệu nghiệp vụ cho Phòng Trống.

## 17. Readiness decision matrix

| Condition | Decision |
| --- | --- |
| Edge Functions unavailable | NEEDS REVIEW |
| Service role secret handling unclear | NEEDS REVIEW |
| Auth email/password behavior unclear | NEEDS REVIEW |
| No audit infrastructure for sensitive actions | NEEDS AUDIT PACK FIRST |
| DreamHome duplicate protection design missing | NEEDS REVIEW |
| Phòng Trống target approved by user | OK FOR CONTROLLED QA LATER |
| center_admin one-center violation exists | NEEDS CLEANUP FIRST |
| admin.phongtrong@ichess.vn already exists unexpected | NEEDS REVIEW |
| DreamHome duplicate returns create/success | BLOCKER |
| SQL inspection cannot confirm policies/constraints | NEEDS REVIEW |

## 18. C7.6C/C7.6D recommendation

Recommended split:

- C7.6C - Audit infrastructure/apply readiness pack nếu dedicated audit table/path cho server-side account provisioning đang thiếu.
- C7.6D - Edge Function implementation pack sau audit readiness.
- C7.6E - Deploy/readiness checklist và no-op duplicate DreamHome test.
- C7.6F - Controlled Phòng Trống admin provisioning + credential handoff, chỉ sau user xác nhận.

Nếu user chạy SQL C7.6B và chứng minh audit infrastructure đã đủ, C7.6C có thể chuyển thành Edge Function implementation pack. Nếu audit chưa đủ, ưu tiên audit pack trước.

## 19. What C7.6B does not do

C7.6B không làm các việc sau:

- Không chạy SQL.
- Không SQL apply/migration.
- Không Supabase action.
- Không tạo/sửa/xóa Auth user.
- Không tạo `admin.phongtrong@ichess.vn` thật.
- Không tạo admin/teacher account thật.
- Không tạo membership.
- Không tạo Edge Function thật.
- Không tạo thư mục `supabase/functions`.
- Không deploy function.
- Không set Supabase secrets.
- Không sửa runtime.
- Không sửa Module 6 runtime.
- Không tạo Account Management UI.
- Không tạo Teacher Portal.
- Không bắt đầu C7.6C.
- Không commit/push.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu:

- Docs/read-only SQL/test đầy đủ.
- Target centers readiness rõ.
- DreamHome duplicate check rõ.
- Phòng Trống admin absence check rõ.
- Duplicate admin email check rõ.
- center_admin one-center check rõ.
- Constraints/indexes/policies check rõ.
- Audit infrastructure check rõ.
- Edge Functions UI checklist rõ.
- Secrets readiness checklist rõ.
- Auth settings/email confirmation caveat rõ.
- Production data safety rõ.
- Decision matrix rõ.
- C7.6C/audit pack recommendation rõ.
- Không có SQL/Supabase action/Auth user/membership/Edge Function/deploy/secrets/runtime.
- Build/diff pass.
- Không commit/push.

NEEDS REVIEW nếu thiếu audit path, thiếu owner/secret/Auth readiness, SQL inspection cho thấy duplicate/rule violation, hoặc phát hiện thay đổi ngoài docs/test/read-only SQL.
