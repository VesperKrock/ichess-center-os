# C6.3B - Centers schema hardening + provisioning pack

C6.3B STATUS: CENTERS SCHEMA HARDENING PROVISIONING PACK
C6_3A_STATUS: PASS
CURRENT_CENTERS_SCHEMA_MINIMAL: YES
PROPOSED_CENTER_COLUMNS: slug, environment, status, updated_at
PROPOSED_UNIQUE_SLUG_ENVIRONMENT: YES
BACKFILL_DREAMHOME_STAGING: YES
BACKFILL_DREAMHOME_PRODUCTION: YES
FUTURE_CENTER_ID_EXAMPLE_GOVAP: govap_prod
FUTURE_CENTER_ID_EXAMPLE_QUAN12: quan12_prod
ADD_CENTER_NOT_CLONE: YES
READONLY_SQL_CREATED: YES
MANUAL_APPLY_SQL_TEMPLATE_CREATED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
NEW_CENTER_CREATED: NO
GOVAP_CREATED: NO
QUAN12_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.3B

C6.3B chuẩn bị schema hardening và provisioning pack cho multi-center sau C6.3A PASS. Phase này chỉ tạo docs, read-only inspection SQL, manual apply SQL template để review và smoke test. Không chạy SQL, không Supabase action, không tạo center mới, không sửa runtime, không commit/push.

## 2. Trạng thái sau C6.3A

C6.3A đã chốt convention:

- `dreamhome` là staging/test sandbox giữ Angel Wings.
- `dreamhome_prod` là DreamHome production empty.
- Future examples: `govap_prod`, `quan12_prod`.
- Display names: DreamHome, Gò Vấp, Quận 12.
- Slugs: `dreamhome`, `govap`, `quan12`.
- Một link chung, account/membership quyết định center.
- Add center, not clone.

## 3. Current schema

Current known schema:

`public.centers`:

- `id text primary key`
- `name text not null`
- `created_at timestamptz default now()`

`public.center_members`:

- `id`
- `user_id`
- `center_id`
- `role`
- `status`
- `created_at`
- `updated_at`

Runtime hiện chưa dựa vào `public.centers` để route user; app resolve qua `center_members`.

## 4. Vì sao schema `centers` hiện tại chưa đủ cho C6.5

`id/name/created_at` đủ cho identity tối thiểu, nhưng chưa đủ cho Internal Center Console vì thiếu metadata rõ ràng để phân biệt production/staging/test, lọc cơ sở active/paused/archived, và tránh nhầm `dreamhome` staging với `dreamhome_prod` production.

## 5. Proposed columns: slug/environment/status/updated_at

Đề xuất thêm vào `public.centers`:

- `slug text`: mã ngắn thân thiện, ví dụ `dreamhome`, `govap`, `quan12`.
- `environment text`: `production`, `staging`, `test`, `development`.
- `status text`: `active`, `paused`, `archived`.
- `updated_at timestamptz`: thời điểm cập nhật metadata.

## 6. Proposed constraints/indexes

Đề xuất:

- `environment` check in `production`, `staging`, `test`, `development`.
- `status` check in `active`, `paused`, `archived`.
- unique index `(slug, environment)`, không unique `slug` đơn.
- index `environment`.
- index `status`.

Không unique `slug` đơn vì cần cho phép `dreamhome` staging và `dreamhome` production cùng tồn tại với environment khác nhau.

## 7. Backfill plan cho dreamhome/dreamhome_prod

Manual apply template backfill metadata hiện có:

`dreamhome`:

- name = `DreamHome`
- slug = `dreamhome`
- environment = `staging`
- status = `active`

`dreamhome_prod`:

- name = `DreamHome`
- slug = `dreamhome`
- environment = `production`
- status = `active`

Không đổi `id`, không rename `dreamhome`, không xóa Angel Wings.

## 8. Production vs staging model

Production centers dùng suffix `_prod` trong `id` và `environment = production`.

Staging/test hiện tại là `dreamhome`, giữ Angel Wings sandbox và `environment = staging`.

Production empty không copy dữ liệu vận hành từ staging.

## 9. Future centers examples: govap_prod/quan12_prod

Future examples chỉ là thiết kế:

- `govap_prod` / `Gò Vấp` / slug `govap` / environment `production`.
- `quan12_prod` / `Quận 12` / slug `quan12` / environment `production`.

C6.3B không tạo `govap_prod`, không tạo `quan12_prod`, không tạo Auth user, không gán membership.

## 10. Add center vs clone

Add center:

- tạo row center identity;
- tạo hoặc chọn Auth user admin;
- gán `center_members`;
- không copy dữ liệu vận hành;
- verify production empty.

Clone center:

- copy dữ liệu từ center nguồn;
- có rủi ro lẫn dữ liệu vận hành;
- chỉ nên dùng test/sandbox trong phase riêng.

C6.3B chỉ chuẩn bị add center, not clone.

## 11. Read-only inspection SQL

File:

`docs/supabase-c6-3b-readonly-inspect-centers-schema.sql`

SQL này chỉ SELECT/read-only, kiểm:

- columns/constraints/indexes của `public.centers`;
- current rows trong `public.centers`;
- columns của `public.center_members`;
- membership count by `center_id/role/status`;
- `center_cloud_entities` count by `center_id/entity_type`;
- metadata readiness của `dreamhome` và `dreamhome_prod`.

## 12. Manual apply SQL template

File:

`docs/supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql`

Template này chỉ để review, không chạy trong C6.3B. Nội dung:

- add nullable columns nếu chưa có: `slug`, `environment`, `status`, `updated_at`;
- backfill `dreamhome` staging;
- backfill `dreamhome_prod` production;
- set defaults cho future rows;
- add check constraints nếu chưa có;
- add unique index `(slug, environment)`;
- add indexes `environment/status`;
- verify rows.

## 13. SQL safety/risk/order

Mục đích: harden bảng `centers` để phục vụ multi-center và Internal Center Console sau này.

Môi trường: Supabase project iChess Center OS / main production database.

Safety:

- Template không xóa dữ liệu.
- Không đổi primary key `centers.id`.
- Không đổi `center_members.center_id`.
- Không xóa `dreamhome` staging.
- Không xóa `dreamhome_prod`.
- Không chạm Angel Wings.
- Không tạo Gò Vấp/Quận 12 thật.

Order đề xuất cho phase apply tương lai:

1. Run read-only inspection.
2. Review output.
3. Backup/export `centers` và `center_members` nếu cần.
4. Run manual apply schema template ở C6.3C nếu user xác nhận.
5. Run post-apply verify.
6. Manual QA app.

Rollback hướng dẫn: vì template không đổi ID và không xóa rows, rollback chính là restore/export metadata `centers` nếu post-apply verify fail. Không chạy rollback tự động trong C6.3B.

## 14. Provisioning pack concept

Thêm cơ sở production empty sau này gồm:

1. Insert center row.
2. Tạo Auth user admin cơ sở bằng Supabase Dashboard hoặc Edge Function future.
3. Insert `center_members` row.
4. Không insert `center_cloud_entities` vận hành.
5. Verify localStorage/cloud empty.
6. App login bằng link chung và resolve theo membership.

Examples future only:

- `govap_prod` / `Gò Vấp` / slug `govap` / production.
- `quan12_prod` / `Quận 12` / slug `quan12` / production.

## 15. Những gì C6.3B không làm

C6.3B không chạy SQL, không Supabase action, không tạo center mới, không tạo Gò Vấp/Quận 12, không tạo/sửa/xóa Auth user, không gán membership mới, không xóa/migrate Angel Wings, không xóa/migrate localStorage, không sửa runtime, không mở C6.4/C6.5/C7, không commit/push.

## 16. C6.3C recommendation

Nếu user review đồng ý, phase sau nên là C6.3C manual apply centers schema hardening:

- user chạy read-only inspection;
- user xác nhận output;
- user quyết định apply template;
- sau apply chạy verify và manual QA.

Không apply SQL nếu user chưa xác nhận.

## 17. C6.4 deferred

C6.4 minimal owner/admin role binding vẫn deferred. C6.3B không đổi role matrix.

## 18. C6.5 Internal Center Console deferred

C6.5 Internal Center Console vẫn deferred. C6.3B chỉ chuẩn bị schema/provisioning review, không tạo route `/internal/centers`, không tạo nút `Thêm cơ sở`.

## 19. C7 deferred

C7 vẫn deferred: username login, account management, permission override, acting mode, Teacher Portal, Super Admin/internal operator advanced.

## 20. PASS / NEEDS REVIEW criteria

PASS khi docs/test đầy đủ, read-only SQL inspection an toàn, manual apply template có nhưng không chạy, template không tạo Gò Vấp/Quận 12 thật, không rename `dreamhome`, không xóa Angel Wings, all C6 smokes/build/check pass, không runtime, không SQL apply/Supabase action, không center mới, không C6.4/C6.5/C7, không commit/push.

NEEDS REVIEW nếu phát hiện schema/live risk cần apply ngay, file ngoài scope, hoặc template cần thao tác phá dữ liệu.
