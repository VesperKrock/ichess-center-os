# F23.11E.1 — Harden SQL/RLS trước local migration test

Ngày: 2026-07-28

Trạng thái: hai migration đã được harden trong repository; chưa chạy Supabase local reset, chưa apply remote, chưa deploy, chưa commit/push.

## Scope gate

SUP-CF.1 được resolve duy nhất bằng header `SUP-CF.1 - Transaction evidence owner/center_admin access policies.` tới:

`supabase/migrations/202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql`

Migration attachment nhân sự là:

`supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql`

Không tạo migration SUP-CF.1 thứ hai và không đổi runtime business logic.

## F23.11E pending object read

Upload runtime thực tế là `prepare → storage.upload(upsert: false) → finalize`. Prepare tạo metadata `pending` và server-controlled object path trước khi browser upload. Theo contract Supabase Storage hiện tại, upload object mới với `upsert: false` chỉ cần INSERT; SELECT cần cho read/signed access, còn finalize RPC đọc exact `storage.objects` server-side. Policy cũ làm mọi read qua Storage API bị deny khi metadata vẫn `pending`. Bridge mới đóng đúng khoảng trống pending-read cho uploader giữa prepare/finalize mà không biến upload thành overwrite và không cấp UPDATE/DELETE.

Policy SELECT mới yêu cầu exact bucket và exact metadata `bucket_id`/`object_path`, `archived_at is null`, cùng active owner/center_admin membership đúng center:

- `available`: owner hoặc center_admin hợp lệ trong center được đọc;
- `pending`: chỉ actor có `uploaded_by_user_id = auth.uid()` được đọc;
- `failed`, `archived`, missing metadata, path mismatch, uploader khác, cross-center, non-admin role, inactive/malformed và unauthenticated: deny.

Policy INSERT vẫn yêu cầu exact pending metadata, primary active, exact uploader và exact center authorization. Không có Storage UPDATE/DELETE policy và bucket không public.

## SUP-CF.1 deny-by-default

Membership helper yêu cầu `auth.uid()`, center nonblank, exact center/user match, normalized status chính xác `active`, normalized role chính xác `owner` hoặc `center_admin`. `NULL`, blank, inactive và malformed đều deny. Helper không dùng email, display name, JWT metadata role, client label hoặc Staff title.

Runtime F23.8B tạo path đúng contract:

`<centerId>/transaction-images/<YYYY>/<MM>/<fileName>`

SQL dùng exact five-segment helper với equality cho center ID. Không còn `LIKE center_id || ...`, nên `_` trong ID như `dreamhome_prod` là ký tự literal, không phải wildcard.

## Prerequisite và immutable identity

Migration fail rõ trước policy creation nếu thiếu:

- `public.transaction_attachments`;
- `public.center_members`;
- `storage.buckets` hoặc `storage.objects`;
- bucket `transaction-images`;
- các column `center_id`, `uploaded_by`, `storage_bucket`, `storage_path`, hoặc membership `center_id`, `user_id`, `status`, `role`.

Không còn `ALTER TABLE IF EXISTS` hay nhánh bỏ qua policy khi table thiếu. Trigger `guard_transaction_attachment_identity_update` chặn UPDATE thay đổi `center_id`, `uploaded_by`, `storage_bucket`, `storage_path`, nhưng không chặn update business fields `transaction_code`, `transaction_date`, `month_key`, `amount`, `cashflow_type`, `note`.

## Function, grants và compatibility

Mọi `SECURITY DEFINER` trong hai migration dùng `set search_path = ''`; relation nhạy cảm dùng schema-qualified name. Execute bị revoke khỏi `public`/`anon`, chỉ function cần gọi từ authenticated policy/RPC được grant cho `authenticated`.

F23.11E metadata table tiếp tục chỉ grant SELECT cho authenticated; mutation chỉ qua prepare/finalize/fail RPC. F23.8B runtime hiện CRUD `transaction_attachments` trực tiếp, nên authenticated giữ đúng SELECT/INSERT/UPDATE/DELETE table privileges dưới RLS. Storage SELECT/INSERT/UPDATE/DELETE của giao dịch được giữ để list/upload/replace/remove/cleanup tiếp tục hoạt động. Không có wildcard/public policy và không cấp service-role cho browser.

## Access checks

| Resource/action | Active owner/admin cùng center | Pending uploader | Owner/admin khác | Teacher/consultant/inactive/cross-center |
| --- | --- | --- | --- | --- |
| Staff attachment available SELECT | Allow | Allow | Allow | Deny |
| Staff attachment pending SELECT | Theo uploader | Allow | Deny | Deny |
| Staff attachment failed/archived SELECT | Deny | Deny | Deny | Deny |
| Staff attachment INSERT | Exact pending row/uploader | Allow | Deny | Deny |
| Transaction metadata CRUD | Allow dưới RLS | Allow | Allow | Deny |
| Transaction identity-field UPDATE | Deny | Deny | Deny | Deny |
| Transaction business-field UPDATE | Allow dưới RLS | Allow | Allow | Deny |

## Apply order và gates

```text
SUP-CF.1 hardened migration
→ F23.11E private staff attachment migration
→ local supabase db reset
→ static/security verification
→ migration list
→ remote dry-run
→ review
→ remote apply
```

F23.11E.1 chỉ hoàn tất patch/static regression. Local reset, Docker/Supabase local, migration list, remote dry-run và remote apply chưa được chạy. Không được kết luận local migration PASS hoặc remote authorization DONE từ static checks.

## Verification marker

`F23.11E SQL HARDENING COMPLETE - READY FOR LOCAL MIGRATION TEST`
