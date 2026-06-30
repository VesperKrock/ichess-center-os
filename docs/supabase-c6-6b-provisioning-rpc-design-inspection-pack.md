# C6.6B - Provisioning RPC design + inspection pack

C6.6B STATUS: PROVISIONING RPC DESIGN INSPECTION PACK
C6_6A_STATUS: PASS
READONLY_INSPECT_SQL_CREATED: YES
MANUAL_APPLY_RPC_TEMPLATE_CREATED: YES
ADD_CENTER_RPC_DESIGNED: YES
RPC_NAME_DESIGNED: provision_center_for_owner
RPC_VISIBLE_INPUT_FIELD_COUNT: 1
RPC_VISIBLE_INPUT_FIELD: Tên cơ sở
RPC_SQL_INPUT: p_center_name
COMPACT_SLUG_CONVENTION_CONFIRMED: YES
SLUG_EXAMPLE_GO_VAP: govap
SLUG_EXAMPLE_PHU_NHUAN: phunhuan
SLUG_EXAMPLE_THU_DUC: thuduc
SLUG_EXAMPLE_QUAN_12: quan12
CENTER_ID_PATTERN_DESIGNED: <slug>_prod
DEFAULT_ENVIRONMENT_DESIGNED: production
DEFAULT_STATUS_DESIGNED: active
EMPTY_CENTER_TRANSACTION_DESIGNED: YES
OWNER_AUTHORIZATION_DESIGNED: YES
OWNER_MEMBERSHIP_FOR_NEW_CENTER_DESIGNED: YES
FRONTEND_DIRECT_INSERT_RECOMMENDED: NO
GUARDED_RPC_RECOMMENDED: YES
UNACCENT_EXTENSION_REVIEW_REQUIRED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_6C_STARTED: NO
C6_6D_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6B

C6.6B chuẩn bị provisioning SQL/RPC design và inspection pack cho flow Thêm cơ sở sau C6.6A. Phase này tạo tài liệu, read-only inspect SQL, manual apply RPC template và smoke test static.

C6.6B không chạy SQL apply, không gọi Supabase action, không sửa runtime, không tạo center thật, không tạo/sửa Auth user hoặc membership, không tạo nút Thêm cơ sở runtime, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.6A

C6.6A đã PASS:

- owner/anh Hải chỉ nhập một field bắt buộc: Tên cơ sở;
- hệ thống tự sinh slug;
- hệ thống tự sinh `center_id`;
- pattern `center_id = <slug>_prod`;
- `environment = production`;
- `status = active`;
- ngôi nhà trống = center metadata + owner membership cần thiết;
- không clone DreamHome;
- không clone Angel Wings;
- không copy 29 học viên staging;
- không bắt buộc tạo admin cơ sở ngay;
- không frontend direct insert bừa.

## 3. Provisioning approach

Approach đề xuất: guarded RPC được apply thủ công ở phase C6.6C, sau đó runtime phase sau mới gọi RPC.

RPC được thiết kế tên:

```txt
provision_center_for_owner
```

RPC chỉ nhận input SQL:

```txt
p_center_name
```

Đây là mapping trực tiếp từ một field visible duy nhất trong UI: Tên cơ sở.

## 4. Vì sao không frontend direct insert

Không khuyến nghị frontend direct insert vào `public.centers` và `public.center_members` vì:

- client sẽ có quyền mutation vào bảng nhạy cảm;
- RLS phức tạp;
- khó đảm bảo transaction giữa center và membership;
- khó xử lý race condition khi slug/id trùng;
- khó audit provisioning.

Guarded RPC giúp gom validation, authorization, conflict check và transaction vào DB.

## 5. Read-only inspection pack

File read-only inspect:

```txt
docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql
```

Pack này chỉ dùng `select` để inspect:

- columns của `public.centers`;
- columns của `public.center_members`;
- constraints của `centers` và `center_members`;
- indexes của `centers` và `center_members`;
- unique index `centers_slug_environment_unique_idx`;
- danh sách centers production/staging hiện có;
- roles/status hiện có trong `center_members`;
- membership của `owner.duchai@ichess.vn`;
- functions liên quan center/provision/slug/unaccent;
- extensions `unaccent`, `uuid-ossp`, `pgcrypto`;
- RLS policies visible qua `pg_policies`.

Read-only file không tạo center, không tạo membership, không tạo function và không sửa dữ liệu.

## 6. Manual apply RPC template

File manual apply template:

```txt
docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql
```

Template này dành cho phase C6.6C nếu được xác nhận. Không chạy trong C6.6B.

Template thiết kế:

- helper `public.ichess_slugify_center_name_compact(input text)`;
- RPC `public.provision_center_for_owner(p_center_name text)`;
- `auth.uid()` lấy current user;
- check current user có active owner membership;
- sinh slug compact;
- sinh `center_id = slug || '_prod'`;
- check name/slug hợp lệ;
- check `center_id` chưa tồn tại;
- check `slug + production` chưa tồn tại;
- insert `public.centers`;
- insert owner membership cho center mới nếu chưa có;
- return metadata center vừa tạo.

## 7. Compact slug convention

C6.6B chốt compact slug: không dấu, không gạch ngang.

Examples bắt buộc:

```txt
Gò Vấp -> govap
Phú Nhuận -> phunhuan
Thủ Đức -> thuduc
Quận 12 -> quan12
Bình Thạnh -> binhthanh
iChess Gò Vấp 2 -> ichessgovap2
```

Convention này đồng bộ với các ví dụ C6.3/C6.5 trước đó như `govap_prod` và `quan12_prod`.

## 8. Slug helper design

Helper slug compact nên:

- trim input;
- lowercase;
- chuyển `đ/Đ` thành `d`;
- bỏ dấu tiếng Việt;
- loại ký tự không phải `[a-z0-9]`;
- compact mọi phần còn lại thành một chuỗi không gạch ngang.

Template hiện dùng explicit translate mapping để không phụ thuộc ngay vào extension. Tuy vậy C6.6C vẫn phải inspect `unaccent`, vì dùng `unaccent` có thể là hướng tốt hơn nếu extension available và được duyệt apply.

## 9. Center ID generation design

`center_id` sinh từ slug:

```txt
center_id = <slug>_prod
```

Ví dụ:

- `govap` -> `govap_prod`;
- `phunhuan` -> `phunhuan_prod`;
- `thuduc` -> `thuduc_prod`;
- `quan12` -> `quan12_prod`.

RPC không nhận client-provided slug hoặc client-provided `center_id`.

## 10. RPC input/output design

Input:

```txt
p_center_name text
```

Output:

```txt
id
name
slug
environment
status
created_at
updated_at
```

Output này đủ để UI phase sau append hoặc refetch list centers readonly.

## 11. Owner authorization design

RPC phải authorize bằng:

- `auth.uid()` is not null;
- current user có ít nhất một membership `role = owner`, `status = active`.

Không authorize bằng email, URL, client-provided user_id, client-provided role, slug hoặc `center_id`.

RPC nên là `security definer` nhưng bắt buộc có guard chặt và `set search_path = public, extensions`.

## 12. Empty center transaction design

RPC chạy atomic trong một function:

1. validate name;
2. generate compact slug;
3. generate `center_id`;
4. check conflicts;
5. insert `public.centers`;
6. ensure owner membership trong `public.center_members`;
7. return center metadata.

Nếu bất kỳ bước nào fail, transaction rollback và không tạo ngôi nhà nửa chừng.

## 13. Owner membership creation design

Owner membership cần tạo cho current owner:

```txt
user_id = auth.uid()
center_id = generated_center_id
role = owner
status = active
```

Nếu `center_members` chưa có unique `(user_id, center_id)`, template dùng `where not exists` trước khi insert membership. C6.6B không tự thêm unique constraint mới.

## 14. Conflict handling

RPC phải raise exception nếu:

- user chưa authenticated;
- current user không có active owner membership;
- tên cơ sở rỗng/quá ngắn;
- slug sinh ra rỗng;
- `center_id` đã tồn tại;
- `slug + environment = production` đã tồn tại.

Unique index `centers_slug_environment_unique_idx` vẫn là final protection nếu đã có.

## 15. RLS/security considerations

Vì RPC có thể dùng `security definer`, C6.6C phải review:

- function owner/schema;
- `search_path`;
- execute privilege;
- RLS policies hiện có trên `centers` và `center_members`;
- helper `is_center_member` hoặc owner guard hiện có;
- liệu có cần revoke default execute khỏi public rồi grant đúng role authenticated không.

C6.6B không grant/revoke, chỉ ghi checklist.

## 16. Extension unaccent considerations

Read-only inspect pack kiểm extension `unaccent`.

Nếu `unaccent` có sẵn và được duyệt, C6.6C có thể đổi slug helper sang `unaccent` để xử lý Unicode tốt hơn. Nếu không, explicit mapping trong template là fallback có thể review.

UNACCENT_EXTENSION_REVIEW_REQUIRED: YES.

## 17. C6.6C apply plan

C6.6C chỉ nên bắt đầu sau khi user review C6.6B:

- chạy read-only inspect trong Supabase thủ công;
- xác nhận schema/constraint/index;
- quyết định dùng unaccent hay explicit mapping;
- review function/RPC template;
- nếu được duyệt, manual apply RPC/policy;
- verify không tạo center thật khi apply function.

C6.6B không apply.

## 18. C6.6D/E runtime plan

C6.6D/E defer:

- C6.6D: runtime Add center form skeleton + dry-run/validation;
- C6.6E: runtime create center via guarded RPC sau khi C6.6C PASS.

C6.6B không tạo nút Thêm cơ sở runtime, không tạo form runtime, không gọi RPC runtime.

## 19. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- tạo/sửa Auth user;
- permission override;
- Teacher Portal;
- Super Admin advanced;
- acting mode.

Admin cơ sở không bắt buộc trong flow C6.6B.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/read-only SQL/manual apply template/test đầy đủ;
- RPC `provision_center_for_owner` được thiết kế;
- input chỉ là `p_center_name`;
- compact slug convention được chốt;
- examples đúng `govap`, `phunhuan`, `thuduc`, `quan12`;
- `center_id` pattern `<slug>_prod`;
- empty center transaction rõ;
- owner authorization rõ;
- owner membership creation rõ;
- frontend direct insert không được khuyến nghị;
- guarded RPC được khuyến nghị;
- không SQL/Supabase action;
- không tạo Auth user/membership/center mới;
- không runtime change;
- không mở C6.6C/D/C7;
- required smokes/build/diff pass;
- không commit/push.

NEEDS REVIEW nếu cần apply SQL ngay, cần tạo center thật, thiếu inspect evidence quan trọng, có runtime diff, hoặc verification fail.
