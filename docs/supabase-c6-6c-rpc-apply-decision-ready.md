# C6.6C - RPC apply decision/readiness

C6.6C STATUS: RPC APPLY DECISION READY
C6_6B_STATUS: PASS
MANUAL_APPLY_SQL_CREATED: YES
POST_APPLY_VERIFY_SQL_CREATED: YES
RPC_APPLY_READY_FOR_USER_REVIEW: YES
RPC_NAME: provision_center_for_owner
RPC_SQL_INPUT: p_center_name
VISIBLE_REQUIRED_FIELD_COUNT: 1
VISIBLE_REQUIRED_FIELD: Tên cơ sở
COMPACT_SLUG_CONVENTION_CONFIRMED: YES
SLUG_HELPER_NAME: ichess_slugify_center_name_compact
SLUG_EXAMPLE_GO_VAP: govap
SLUG_EXAMPLE_PHU_NHUAN: phunhuan
SLUG_EXAMPLE_THU_DUC: thuduc
SLUG_EXAMPLE_QUAN_12: quan12
CENTER_ID_PATTERN: <slug>_prod
DEFAULT_ENVIRONMENT: production
DEFAULT_STATUS: active
OWNER_AUTHORIZATION_REVIEWED: YES
OWNER_MEMBERSHIP_FOR_NEW_CENTER_REVIEWED: YES
EMPTY_CENTER_BEHAVIOR_REVIEWED: YES
CONFLICT_HANDLING_REVIEWED: YES
EXECUTE_GRANT_REVIEWED: YES
NO_REAL_CENTER_CREATION_IN_APPLY_SQL: YES
NO_PROVISION_RPC_CALL_IN_VERIFY_SQL: YES
BACKUP_RECOMMENDED_BEFORE_APPLY: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_6D_STARTED: NO
C6_6E_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6C

C6.6C review SQL/RPC template từ C6.6B và chuẩn bị apply decision/readiness pack để user tự review và apply thủ công ở Supabase nếu xác nhận.

C6.6C không chạy SQL, không tạo RPC thật, không tạo helper function thật, không grant quyền thật, không tạo center thật, không tạo/sửa Auth user hoặc membership, không sửa runtime và không commit/push.

## 2. Trạng thái sau C6.6B

C6.6B đã PASS và tạo:

- `docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md`;
- `docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql`;
- `docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql`;
- `tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js`.

C6.6B đã chốt RPC `provision_center_for_owner(p_center_name)`, helper `ichess_slugify_center_name_compact`, slug compact không dấu không gạch ngang, `center_id = <slug>_prod`, `environment=production`, `status=active`.

## 3. SQL safety statement

Purpose:

- create guarded RPC for owner to provision an empty production center from one visible field `Tên cơ sở`.

Environment:

- Supabase project for iChess Center OS.

Data impact:

- C6.6C does not run SQL.
- Manual apply SQL does not create centers by itself.
- Manual apply SQL does not create memberships by itself.
- Manual apply SQL creates/replaces helper/RPC functions and execute grants.

Destructive impact:

- No drop table.
- No delete data.
- No data migration.

Backup:

- Recommended schema snapshot/backup before manual apply.

Apply order:

- Review SQL.
- User confirms.
- User manually applies SQL.
- Run post-apply verify SQL.
- Only later test RPC/create center under controlled QA.

## 4. Files created

C6.6C tạo:

- `docs/supabase-c6-6c-rpc-apply-decision-ready.md`;
- `docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql`;
- `docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql`;
- `tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js`.

Không có runtime file, không có SQL applied result file.

## 5. Manual apply SQL summary

Manual apply SQL file:

```txt
docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql
```

Nội dung:

- header `DO NOT RUN UNLESS USER CONFIRMS`;
- helper `public.ichess_slugify_center_name_compact(input text)`;
- RPC `public.provision_center_for_owner(p_center_name text)`;
- `auth.uid()` authorization;
- active owner membership check;
- slug compact;
- `center_id = slug || '_prod'`;
- default `production` / `active`;
- insert center khi RPC được gọi sau này;
- insert owner membership khi RPC được gọi sau này;
- revoke/ grant execute cho RPC.

Apply file không gọi RPC và không hardcode tạo Gò Vấp/Quận 12/DreamHome.

## 6. Post-apply verify SQL summary

Post-apply verify SQL file:

```txt
docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql
```

Verify SQL chỉ read-only:

- kiểm helper function tồn tại;
- kiểm RPC function tồn tại;
- kiểm args `p_center_name text`;
- kiểm security/search_path nếu inspectable;
- kiểm execute privilege;
- test helper slug examples bằng `select`;
- kiểm các future center id như `govap_prod`, `phunhuan_prod`, `thuduc_prod`, `quan12_prod` chưa xuất hiện nếu chưa tạo thật.

Verify SQL không gọi `public.provision_center_for_owner(...)`.

## 7. RPC design final review

RPC final:

```txt
public.provision_center_for_owner(p_center_name text)
```

Function is `security definer`, dùng `set search_path = public, auth, extensions`, và return:

```txt
id
name
slug
environment
status
created_at
updated_at
```

RPC không nhận `user_id`, slug hoặc `center_id` từ client.

## 8. Slug helper final review

Helper final:

```txt
public.ichess_slugify_center_name_compact(input text)
```

Behavior:

- trim/lowercase;
- `đ/Đ -> d`;
- bỏ dấu tiếng Việt bằng explicit mapping fallback;
- chỉ giữ `[a-z0-9]`;
- không gạch ngang.

Unaccent vẫn có thể là hướng tốt hơn ở phase sau, nhưng C6.6C apply-ready dùng explicit mapping để giảm phụ thuộc extension.

## 9. Compact slug examples

Examples:

```txt
Gò Vấp -> govap
Phú Nhuận -> phunhuan
Thủ Đức -> thuduc
Quận 12 -> quan12
Bình Thạnh -> binhthanh
iChess Gò Vấp 2 -> ichessgovap2
```

Center id tương ứng:

```txt
govap_prod
phunhuan_prod
thuduc_prod
quan12_prod
binhthanh_prod
```

## 10. Owner authorization review

RPC authorize bằng:

- `auth.uid()` is not null;
- current user có ít nhất một membership `role = owner`, `status = active`.

Không dùng email, không dùng URL, không dùng client-provided `user_id`, không hardcode owner test account.

## 11. Empty center behavior review

Khi RPC được gọi ở phase kiểm soát sau này, center mới là production empty:

- tạo metadata row trong `public.centers`;
- tạo owner membership trong `public.center_members`;
- không seed học viên;
- không seed giáo viên;
- không seed lịch;
- không seed kho hàng;
- không seed học phí;
- không clone DreamHome;
- không clone Angel Wings.

## 12. Conflict handling review

RPC reject:

- unauthenticated user;
- user không có active owner membership;
- `p_center_name` rỗng/quá ngắn sau trim;
- slug rỗng;
- `center_id` đã tồn tại;
- `slug + environment = production` đã tồn tại.

Unique index `centers_slug_environment_unique_idx` vẫn cần được verify trong schema nếu user apply/readiness.

## 13. Privilege/grant review

Manual apply SQL có:

```sql
revoke all on function public.provision_center_for_owner(text) from public;
grant execute on function public.provision_center_for_owner(text) to authenticated;
```

Helper không cần gọi từ client; hiện template không grant helper riêng. Nếu Supabase/Postgres permission yêu cầu thêm grant helper cho function execution path, xử lý ở apply review hoặc C6.6C.1.

## 14. No real center creation guarantee

C6.6C guarantee:

- C6.6C không chạy SQL;
- manual apply SQL không gọi `public.provision_center_for_owner(...)`;
- manual apply SQL không insert hardcoded Gò Vấp/Quận 12/DreamHome;
- post-apply verify SQL không gọi provisioning RPC;
- không có center thật được tạo bởi CodeX.

## 15. Backup/apply order

Recommended order:

1. User review `docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql`.
2. User chụp schema snapshot/backup.
3. User apply thủ công trong Supabase SQL Editor nếu đồng ý.
4. User chạy `docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql`.
5. Chỉ sau verify PASS mới mở phase runtime/test center.

## 16. C6.6D recommendation

Sau khi user apply và verify RPC PASS, C6.6D có thể làm runtime form skeleton/dry-run validation hoặc readiness verify phase tùy hướng tiếp theo.

Không làm C6.6D trong C6.6C.

## 17. C6.6E/F runtime/test center deferred

C6.6E/F deferred:

- runtime gọi guarded RPC;
- controlled QA tạo test center;
- refresh Internal Center Console list;
- kiểm owner membership và empty center.

Không tạo center thật trong C6.6C.

## 18. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- tạo/sửa Auth user;
- permission override;
- Teacher Portal;
- Super Admin advanced;
- acting mode.

## 19. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/manual apply SQL/post-apply verify SQL/test đầy đủ;
- SQL safety statement rõ;
- RPC apply ready for user review;
- RPC `provision_center_for_owner` reviewed;
- helper `ichess_slugify_center_name_compact` reviewed;
- input chỉ `p_center_name`;
- compact slug examples đúng;
- `center_id` pattern `<slug>_prod`;
- no real center creation in apply SQL;
- verify SQL không gọi provisioning RPC;
- không SQL/Supabase action;
- không tạo Auth user/membership/center mới;
- không runtime change;
- không mở C6.6D/E/C7;
- required smokes/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu apply SQL chưa đủ an toàn, verify SQL có thể tạo center, có runtime diff, hoặc cần chạy SQL trong phase này.
