# C6.5C - Centers list readonly

C6.5C STATUS: CENTERS LIST READONLY
C6_5B_STATUS: PASS
C6_5B_MANUAL_QA: PASS
HIDDEN_ROUTE_PRESERVED: YES
OWNER_GUARD_PRESERVED: YES
OWNER_ONLY_ACCESS_PRESERVED: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
CENTERS_LIST_QUERY_IMPLEMENTED: YES
CENTERS_LIST_READONLY_IMPLEMENTED: YES
CENTERS_LIST_SOURCE: public.centers
CENTERS_LIST_FIELDS: id,name,slug,environment,status,created_at,updated_at
CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production
CENTERS_LIST_DEFAULT_FILTER_STATUS: active
CENTERS_LIST_EXPECTED_DREAMHOME_PROD: YES
STAGING_DREAMHOME_VISIBLE_IN_DEFAULT_LIST: NO
LOADING_STATE_IMPLEMENTED: YES
EMPTY_STATE_IMPLEMENTED: YES
ERROR_STATE_IMPLEMENTED: YES
ADD_CENTER_IMPLEMENTED: NO
ACTING_MODE_IMPLEMENTED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: YES
RUNTIME_CHANGE_SCOPE: INTERNAL_CENTERS_LIST_READONLY_ONLY
C6_5D_STARTED: NO
C6_6_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.5C

C6.5C mở phần danh sách cơ sở readonly trong Internal Center Console tại `#/internal/centers`. Owner xem được metadata từ `public.centers`, mặc định chỉ `production` và `active`.

Phase này không chỉnh sửa dữ liệu, không tạo center, không tạo/sửa Auth user hoặc membership, không SQL, không Supabase action ngoài runtime read trong app, không nút `Thêm cơ sở`, không acting mode, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.5B

C6.5B đã PASS:

- hidden route `#/internal/centers` hoạt động;
- owner guard hoạt động;
- signed-out không thấy Internal Center Console;
- `center_admin` bị chặn;
- owner thấy skeleton;
- manual QA C6.5B: PASS.

Manual QA C6.5B ghi nhận owner `owner.duchai@ichess.vn` vào được route, role `owner`, cơ sở hiện tại DreamHome, mã cơ sở `dreamhome_prod`. `admin.dreamhome@ichess.vn` role `center_admin` bị chặn.

## 3. Runtime changes summary

Runtime changes:

- `src/main.js`: thêm `getSupabaseClient`, state runtime-memory cho centers list, query readonly `public.centers`, normalize rows, render loading/empty/error/table.
- `src/styles.css`: thêm style cho trạng thái list, filter note và bảng readonly.

Không tạo file SQL, không thêm package, không thêm route visible navigation.

## 4. Owner guard preserved

Guard C6.5B vẫn giữ nguyên:

- signed-in;
- center binding `bound`;
- membership hiện tại `status = active`;
- role normalize về `owner`.

`center_admin`, `teacher`, `consultant`, `viewer` và signed-out không thấy list centers.

## 5. Centers readonly query

Runtime query source: `public.centers`.

Fields:

`id,name,slug,environment,status,created_at,updated_at`

Query runtime dùng Supabase JS client hiện có:

```js
supabase
  .from('centers')
  .select('id,name,slug,environment,status,created_at,updated_at')
  .eq('environment', 'production')
  .eq('status', 'active')
  .order('name', { ascending: true })
```

Đây là read-only path. Không có insert/update/delete/upsert vào `centers`.

## 6. Default filter production/active

Default filter:

- `environment = production`;
- `status = active`.

Default list phải hiển thị `dreamhome_prod` nếu RLS cho owner đọc `public.centers`. Default list không hiển thị `dreamhome` staging.

## 7. Readonly UI fields

Readonly UI hiển thị:

- Tên cơ sở;
- Mã cơ sở;
- Slug;
- Môi trường;
- Trạng thái;
- Cập nhật;
- Ngày tạo.

Expected hiện tại:

- DreamHome;
- `dreamhome_prod`;
- `dreamhome`;
- `production`;
- `active`.

## 8. Loading/empty/error states

Loading:

`Đang tải danh sách cơ sở...`

Empty:

`Chưa có cơ sở production active.`

Error:

`Không tải được danh sách cơ sở.`

Nếu lỗi là do RLS/policy, không sửa SQL trong C6.5C. User cần dừng ở NEEDS REVIEW và chuẩn bị phase policy riêng.

## 9. Manual QA checklist

Owner:

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected: thấy danh sách cơ sở readonly.
4. Expected: thấy DreamHome / `dreamhome_prod` / `production` / `active`.
5. Expected: không thấy `dreamhome` staging trong default production active list.
6. Expected: không có nút `Thêm cơ sở`.
7. Expected: không có acting mode.

center_admin:

1. Login `admin.dreamhome@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected: vẫn bị chặn.

signed-out:

1. Logout/incognito.
2. Mở `#/internal/centers`.
3. Expected: vẫn không thấy internal console.

## 10. RLS/policy risk

Risk chính là RLS/policy hiện tại có thể chưa cho owner đọc danh sách `public.centers`. Nếu owner thấy error state thay vì list, không bypass trong runtime và không tự chạy SQL.

Hướng xử lý khi fail manual QA vì RLS: báo NEEDS REVIEW và chuẩn bị SQL/policy readiness phase riêng.

## 11. Vì sao chưa có Add center

Add center là provisioning flow, có thể cần insert `centers`, gán membership, kiểm slug/environment/status, rollback và audit. C6.5C chỉ đọc list.

Add center defer C6.6.

## 12. Vì sao chưa có acting mode

Acting mode có thể khiến owner thao tác dữ liệu trong center khác. C6.5C chỉ cho xem metadata centers readonly, không "biến thành admin cơ sở".

Acting/support mode defer C7.4.

## 13. C6.5D/C6.6 dependency

C6.5D có thể làm center detail readonly nếu C6.5C manual QA PASS. C6.6 chỉ bắt đầu nếu được duyệt riêng cho provisioning/Add center.

Không đi C6.5D/C6.6 nếu C6.5C bị RLS chặn hoặc owner không thấy list.

## 14. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin advanced.

## 15. PASS / NEEDS REVIEW criteria

PASS nếu:

- owner ở `#/internal/centers` thấy centers list readonly;
- default list lọc `production`/`active`;
- DreamHome production hiện trong list;
- `dreamhome` staging không hiện default;
- `center_admin` và signed-out vẫn bị chặn;
- loading/empty/error state có đủ;
- không Add center;
- không acting mode;
- không mutation `centers`;
- không SQL/Supabase action ngoài runtime read;
- không tạo Auth user/membership/center;
- không mở C6.5D/C6.6/C7;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu:

- owner không đọc được `public.centers` do RLS/policy;
- cần apply SQL/policy;
- default list lẫn `dreamhome` staging;
- `center_admin` thấy list;
- xuất hiện Add center/provisioning/acting mode;
- có file ngoài scope.

