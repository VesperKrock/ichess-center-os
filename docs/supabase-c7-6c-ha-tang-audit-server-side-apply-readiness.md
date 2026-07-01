# C7.6C - Hạ tầng audit server-side apply/readiness

C7.6C STATUS: AUDIT INFRASTRUCTURE APPLY READINESS
C7_6C_1_STATUS: AUDIT SQL IDEMPOTENT SYNC AND VERIFY PASS
C7_1_STATUS: PASS
C7_2_STATUS: PASS
C7_3_STATUS: PASS
C7_4_STATUS: PASS
C7_5_STATUS: PASS
C7_6A_STATUS: PASS
C7_6B_STATUS: PASS
C7_6B_MANUAL_INSPECTION: PASS
AUDIT_SQL_APPLIED_BY_USER: YES
AUDIT_SQL_APPLIED_BY_CODEX: NO
AUDIT_SQL_VERIFY_BY_USER: PASS
ACCOUNT_AUDIT_LOGS_TABLE_EXISTS_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_COLUMNS_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_CONSTRAINTS_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_INDEXES_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_RLS_TRUE_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_POLICIES_NONE_VERIFIED: YES
ACCOUNT_AUDIT_LOGS_CONSTRAINTS_NOT_VALID_NOTED: YES
AUDIT_SQL_IDEMPOTENT_TEMPLATE_SYNCED: YES
EDGE_FUNCTIONS_AVAILABLE: YES
EDGE_FUNCTION_SECRETS_UI_AVAILABLE: YES
EMAIL_PROVIDER_ENABLED: YES
DEDICATED_AUDIT_TABLE_CURRENTLY_MISSING: YES
GENERIC_CLOUD_AUDIT_ENTRY_STAGING_NOTED: YES
AUDIT_INFRASTRUCTURE_MANUAL_APPLY_SQL_CREATED: YES
AUDIT_INFRASTRUCTURE_POST_APPLY_VERIFY_SQL_CREATED: YES
ACCOUNT_AUDIT_LOGS_TABLE_DESIGNED: YES
ACCOUNT_AUDIT_LOGS_TABLE_NAME: public.account_audit_logs
PLAINTEXT_PASSWORD_STORAGE_ALLOWED: NO
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO
PASSWORD_KEY_GUARD_DESIGNED: YES
AUDIT_LOG_RLS_ENABLED_DESIGNED: YES
BROAD_AUTHENTICATED_INSERT_POLICY_DESIGNED: NO
BROAD_AUTHENTICATED_SELECT_POLICY_DESIGNED: NO
SERVICE_ROLE_WRITE_MODEL_DESIGNED: YES
OWNER_AUDIT_UI_DEFERRED: YES
SEED_AUDIT_ROW_CREATED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
EDGE_FUNCTION_CREATED: NO
EDGE_FUNCTION_DEPLOYED: NO
SECRETS_SET_BY_CODEX: NO
RUNTIME_CHANGE: NO
C7_6D_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C7.6C

C7.6C chuẩn bị hạ tầng audit server-side dedicated trước khi tạo admin account thật. Pha này tạo docs, manual apply SQL template, post-apply verify SQL và smoke test static.

CodeX không chạy SQL, không gọi Supabase, không tạo Auth user/admin/membership, không tạo/deploy Edge Function, không sửa runtime, không sửa Module 6, không bắt đầu C7.6D và không commit/push.

## 2. Trạng thái sau C7.6B

C7.6B PASS và manual inspection đã xác nhận Edge Functions, Secrets UI và Email provider đã sẵn sàng ở mức Supabase UI. Tuy nhiên dedicated audit/log table trong `public` đang missing, nên chưa đủ an toàn để nhảy thẳng sang Edge Function provisioning.

## 3. Manual inspection summary

Kết quả user đã kiểm tra sau C7.6B:

- Edge Functions: có.
- Secrets UI: có.
- Authentication / Auth Providers / Email: Enabled.
- DreamHome production có `admin.dreamhome@ichess.vn` role `center_admin` active.
- Phòng Trống production active chưa có center_admin.
- `admin.dreamhome@ichess.vn` exists.
- `admin.phongtrong@ichess.vn` does not exist.
- center_admin one-center violation: Success. No rows returned.
- Existing functions: `public.is_center_member(requested_center_id text)`, `public.provision_center_for_owner(p_center_name text)`.
- Chưa có admin provisioning function.
- Chưa có audit/account governance function.
- Dedicated audit/log table: Success. No rows returned.
- Generic audit cloud entity: `audit_log_entry,dreamhome,1`.

## 4. Vì sao cần dedicated audit table

Các action như tạo admin cơ sở, reset password, ban/revoke access và archive center là sensitive server-side actions. Chúng cần audit append-only, truy vấn được theo actor/target/action/center/request, và không phụ thuộc vào sync entity generic của app.

Dedicated table giúp Edge Function ghi audit bằng service role theo một schema rõ ràng trước khi trả credential handoff hoặc rollback status.

## 5. Vì sao không dùng center_cloud_entities audit_log_entry hiện tại

`center_cloud_entities` hiện có `audit_log_entry,dreamhome,1`, nhưng đây là generic cloud/staging entity. Không đủ làm hạ tầng audit server-side cho action nhạy cảm vì:

- đang gắn center staging `dreamhome`;
- schema generic, không tối ưu truy vấn actor/target/action;
- có thể đồng bộ theo cơ chế app data, không phải immutable security audit;
- không nên chứa password/secret;
- cần bảng dedicated để Edge Function ghi action nhạy cảm.

Vì vậy C7.6C thiết kế `public.account_audit_logs` thay vì tái dùng generic `audit_log_entry`.

## 6. SQL safety statement

Mục đích:

- Tạo hạ tầng audit server-side dedicated cho các action nhạy cảm như tạo admin, reset password, ban/revoke, archive center.

Môi trường:

- Supabase project iChess Center OS.

Tính chất dữ liệu:

- Không tạo Auth user.
- Không tạo membership.
- Không tạo center.
- Không tạo admin account.
- Không đụng dữ liệu nghiệp vụ hiện có.
- Chỉ tạo bảng/constraint/index/policy liên quan audit nếu chưa tồn tại.

Có phá dữ liệu không:

- Không có chủ đích phá dữ liệu.
- Không drop/truncate/delete/update dữ liệu cũ.

Backup:

- Nên backup schema hoặc export SQL trước khi apply vì đây là thay đổi schema.

Thứ tự:

1. Đọc manual apply SQL.
2. Chạy trong Supabase SQL Editor khi user xác nhận.
3. Chạy post-apply verify SQL.
4. Gửi result về trước khi sang Edge Function thật.

## 7. Manual apply SQL created

Manual apply SQL template:

```text
docs/supabase-c7-6c-manual-apply-account-audit-log.sql
```

Header khẳng định file chỉ dùng khi user duyệt apply thủ công trong Supabase SQL Editor. CodeX không chạy SQL này.

## 8. Proposed table: public.account_audit_logs

Tên bảng:

```text
public.account_audit_logs
```

Lý do: tên rõ phạm vi account/access governance, không đụng `center_cloud_entities` generic và không trộn với audit realtime nghiệp vụ C5.

## 9. Column design

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `actor_user_id uuid null`
- `actor_email text null`
- `action text not null`
- `target_type text not null`
- `target_user_id uuid null`
- `target_email text null`
- `center_id text null`
- `before_state jsonb null`
- `after_state jsonb null`
- `reason text null`
- `request_id text null`
- `metadata jsonb not null default '{}'::jsonb`

Action examples:

- `account.provision_center_admin`
- `account.reset_password`
- `account.ban`
- `account.unban`
- `membership.revoke`
- `membership.restore`
- `center.archive`
- `center.restore`

## 10. Constraint design

Constraints được thiết kế:

- `action` không rỗng.
- `target_type` không rỗng.
- `actor_email` nullable nhưng nếu có thì length sane.
- `target_email` nullable nhưng nếu có thì length sane.
- `metadata` không chứa key plaintext password.
- `before_state` không chứa key plaintext password.
- `after_state` không chứa key plaintext password.

Manual SQL dùng `not valid` cho constraints bổ sung để giảm rủi ro apply trên table có dữ liệu nếu user chạy lại sau này.

## 11. Plaintext password guard

Không được lưu temporary password vào audit. Guard SQL kiểm tra các key:

- `temporary_password`
- `password`
- `plaintext_password`

Guard áp dụng cho:

- `metadata`
- `before_state`
- `after_state`

PLAINTEXT_PASSWORD_STORAGE_ALLOWED: NO.
PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO.

## 12. Index design

Indexes:

- `created_at desc`
- `actor_user_id`
- `target_user_id`
- `target_email`
- `center_id`
- `action`
- `request_id`

Các index này phục vụ truy vết theo request, actor, target, center và action nhạy cảm.

## 13. RLS/policy design

Manual SQL bật RLS:

```sql
alter table public.account_audit_logs enable row level security;
```

Không tạo broad authenticated INSERT policy. Không tạo broad authenticated SELECT policy. Service role trong Edge Function sẽ ghi server-side và bypass RLS.

Owner audit UI read policy được defer sang phase riêng vì cần thiết kế owner-only read, filter theo center/action và UX kiểm audit.

## 14. Service role write model

Edge Function tương lai dùng service role để insert audit row sau khi caller đã qua owner guard. Audit row phải được ghi cho cả success, blocked duplicate, rollback/cleanup và failure needing manual review.

Service role key chỉ nằm trong Supabase secrets/Edge Function environment, không đưa vào frontend, không log và không paste vào prompt.

## 15. Owner audit UI deferred

C7.6C chỉ tạo write target cho server-side audit. Owner audit UI/read policy không làm trong phase này.

Lý do defer:

- Cần policy owner-only riêng.
- Cần quyết định owner đọc audit toàn hệ thống hay theo center.
- Cần UI pattern riêng để không nhồi dashboard.
- Cần tránh authenticated broad read làm lộ governance history.

## 16. No seed/test row

Manual apply SQL không insert seed row và không tạo test audit row. Nếu cần test insert, làm bằng phase controlled riêng sau khi user duyệt, không nằm trong C7.6C.

SEED_AUDIT_ROW_CREATED: NO.

## 17. Post-apply verify SQL created

Post-apply verify SQL:

```text
docs/supabase-c7-6c-post-apply-verify-account-audit-log.sql
```

File này read-only, kiểm tra table, columns, constraints, indexes, RLS và policies.

## 18. Expected post-apply result

Expected sau khi user apply thủ công:

- Table `public.account_audit_logs` exists.
- Columns đầy đủ.
- Constraints chống key plaintext password tồn tại.
- Indexes tồn tại.
- RLS enabled.
- Không có broad authenticated insert/select policies nếu chưa thiết kế riêng.
- Không có seed/test row được tạo bởi C7.6C.

Nếu verify thiếu bất kỳ phần critical nào, không sang Edge Function provisioning thật.

## 18.1 C7.6C.1 - User manual apply/verify result

User đã apply SQL thủ công trong Supabase SQL Editor.

Apply result:

```text
Success. No rows returned.
```

Verify result user đã báo:

- Table exists: `public.account_audit_logs`.
- Columns PASS: đầy đủ `id`, `created_at`, actor, action, target, center, before/after state, reason, request và `metadata`.
- Constraints PASS: các constraint expected đều tồn tại.
- Password key guard PASS: có guard cho `temporary_password`, `password`, `plaintext_password` trong `metadata`, `before_state`, `after_state`.
- Indexes PASS: action, actor, center, created_at desc, pkey, request, target email, target user.
- RLS true: `public.account_audit_logs / rowsecurity = true`.
- Policies: Success. No rows returned.
- No broad authenticated select policy.
- No broad authenticated insert policy.

Ghi chú constraints:

- Các CHECK constraint hiện là NOT VALID.
- NOT VALID accepted for C7.6C because table is new/empty and future rows are still checked.
- Constraint validation can be a later cleanup phase nếu muốn làm sạch catalog.

C7.6C.1 đồng bộ lại `docs/supabase-c7-6c-manual-apply-account-audit-log.sql` sang bản idempotent đã apply: constraint duplicate-safe bằng `do $$ ... if not exists (...) then alter table ... add constraint ...; end if; end $$;`, giữ indexes, RLS, no broad authenticated policies và no seed row.

## 19. Risk list

- Apply SQL sai project.
- Quên backup schema trước apply.
- Constraint duplicate nếu chạy lại trên môi trường đã chỉnh tay.
- Thiếu extension/function `gen_random_uuid()` trong môi trường bất thường.
- Tạo broad authenticated policy làm lộ audit.
- Edge Function tương lai log password vào metadata nếu không tuân thủ contract.
- Owner audit UI đọc audit quá rộng khi chưa có policy riêng.

## 20. C7.6D recommendation

Nếu C7.6C PASS: user review manual apply SQL. Sau user xác nhận, chạy SQL apply thủ công trong Supabase, rồi chạy post-apply verify SQL. Sau verify PASS, sang C7.6D Edge Function implementation pack.

Không tạo admin thật trước khi audit table apply/verify PASS.

## 21. PASS / NEEDS REVIEW criteria

PASS nếu:

- Manual inspection được ghi nhận.
- Dedicated audit table missing được ghi rõ.
- Manual apply SQL tạo `public.account_audit_logs` rõ.
- Post-apply verify SQL rõ.
- Không dùng `center_cloud_entities` generic làm security audit.
- Plaintext password guard rõ.
- RLS enabled rõ.
- Không broad authenticated insert/select policy.
- Service role write model rõ.
- Owner audit UI deferred.
- Không SQL/Supabase action/Auth user/membership/Edge Function/runtime.
- Build/diff pass.
- Không commit/push.

NEEDS REVIEW nếu thiếu audit guard, thiếu RLS, có policy rộng, có seed row, hoặc phát hiện thay đổi ngoài docs/test/manual SQL/verify SQL.
