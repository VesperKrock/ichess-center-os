# C6.4E - Runtime/manual QA owner login

C6.4E STATUS: RUNTIME MANUAL QA OWNER LOGIN
C6_4D_STATUS: PASS
OWNER_MEMBERSHIP_VERIFIED: YES
OWNER_EMAIL: owner.duchai@ichess.vn
OWNER_AUTH_USER_ID: 9683b2c8-3970-4eac-99b3-985d503bdeb9
TARGET_CENTER_ID: dreamhome_prod
TARGET_ROLE: owner
TARGET_MEMBERSHIP_STATUS: active
OWNER_ROLE_RUNTIME_REVIEWED: YES
OWNER_ROLE_RUNTIME_SUPPORTED: YES
CENTER_RESOLVER_RUNTIME_REVIEWED: YES
SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES
PRODUCTION_STAGING_SEPARATION_REVIEWED: YES
BADGE_THREE_FIX_STILL_REQUIRED: YES
INTERNAL_CENTER_CONSOLE_EXPECTED_NOW: NO
CENTER_LIST_UI_EXPECTED_NOW: NO
ADD_CENTER_BUTTON_EXPECTED_NOW: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED_BY_CODEX: NO
MEMBERSHIP_CREATED_BY_CODEX: NO
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.4E

C6.4E audit runtime/readiness cho owner login sau khi C6.4D đã verify owner membership applied. Phase này chuẩn bị manual QA checklist cho user test login `owner.duchai@ichess.vn`.

C6.4E không chạy SQL, không gọi Supabase action, không tạo/sửa Auth user, không tạo membership, không tạo center mới, không sửa runtime, không mở C6.5 UI, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.4D

C6.4D đã PASS và ghi nhận owner membership:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`
- center_id: `dreamhome_prod`
- role: `owner`
- membership_status: `active`
- center environment: `production`
- center_status: `active`

SQL apply do user chạy thủ công trong Supabase. CodeX không chạy SQL/Supabase action.

## 3. Owner membership đã verify

Owner membership đã verify theo evidence user cung cấp:

- `owner.duchai@ichess.vn`
- `9683b2c8-3970-4eac-99b3-985d503bdeb9`
- `dreamhome_prod`
- `owner`
- `active`

Đây là membership per center rõ ràng, không dùng wildcard `center_id`.

## 4. Runtime owner role support review

Runtime hiện có support role `owner`:

- `src/online-access-control.js` có `ONLINE_ACCESS_ROLES.OWNER = 'owner'`.
- `ROLE_ALIASES` map `owner` về role `owner`.
- `CLOUD_WRITE_ROLES` gồm `owner`, `qtv`, `center_admin`.
- `CLOUD_READ_ROLES` gồm write roles và các role read-only.
- Tests C3 hiện có đã kiểm `normalizeOnlineRole('owner')` và write roles gồm `owner`.

Kết luận: `OWNER_ROLE_RUNTIME_SUPPORTED: YES`.

Không cần runtime change trong C6.4E.

## 5. Center resolver review

Runtime resolve center qua `resolveActiveCenterMembership(userId)`:

- đọc `center_members`;
- lọc `user_id`;
- lọc `status = active`;
- order theo `center_id`;
- không chặn role `owner`;
- trả về `centerId`, `centerName`, `role`, `membership`.

Expected owner path:

```txt
owner.duchai@ichess.vn
-> user_id 9683b2c8-3970-4eac-99b3-985d503bdeb9
-> active membership
-> center_id dreamhome_prod
-> role owner
```

Signed-in membership wins over hardcode. URL không quyết định security.

## 6. Production/staging separation review

Owner test membership target là `dreamhome_prod`. Runtime sau resolve gọi `setCurrentStorageCenterId(resolvedMembership.centerId)`.

Với `dreamhome_prod`:

- localStorage namespace dùng `.dreamhome_prod`;
- production path dùng `useSampleFallback: false`;
- không được đọc/render `.dreamhome` staging;
- không hiện Angel Wings;
- không hiện 29 học viên staging.

`dreamhome` staging vẫn được giữ nguyên, không xóa/migrate.

## 7. Notification/badge regression review

C6.2B.1 guard vẫn cần được bảo toàn:

- `activeNotificationDataCenterId`;
- `getCenterScopedNotificationsForRender()`;
- reload `inventoryRequests` trước `syncAppNotifications()`;
- không badge đỏ `3` ở Kho hàng/chuông tổng trong production empty.

C6.4E không sửa notification pipeline.

## 8. Expected behavior trước C6.5

Trước C6.5:

- owner chưa có Internal Center Console;
- owner chưa có center list UI;
- owner chưa có nút `Thêm cơ sở`;
- owner chưa có acting mode;
- owner login có thể vẫn thấy dashboard center hiện tại như role được phép;
- nếu role hiển thị trong profile/taskbar thì nên ghi nhận `owner` hoặc label tương đương.

Nếu runtime cho owner vào dashboard `dreamhome_prod`, đó là PASS cho C6.4E.

## 9. Manual QA checklist

Manual QA user nên chạy:

1. Mở app local hoặc GitHub Pages.
2. Logout tài khoản hiện tại.
3. Login `owner.duchai@ichess.vn`.
4. Expected:
   - Login thành công.
   - Dashboard mở được.
   - Cơ sở hiển thị DreamHome.
   - Dữ liệu là production empty `dreamhome_prod`.
   - Không thấy Angel Wings.
   - Không thấy 29 học viên staging.
   - Không có badge đỏ `3` ở Kho hàng/chuông tổng.
   - Taskbar/profile không lỗi.
   - Nếu role hiển thị, role là `owner` hoặc label tương đương.
5. Reload 3-5 lần.
6. Kiểm tra localStorage:
   - `.dreamhome_prod` được dùng.
   - `.dreamhome` không bị xóa/migrate.
7. Ghi nhận behavior owner trước C6.5:
   - chưa có Internal Center Console là đúng;
   - chưa có danh sách centers là đúng.

## 10. Risk list

Risks còn lại:

- Manual QA browser chưa chạy trong C6.4E.
- Owner-specific UI chưa có trước C6.5, nên behavior hiện tại là dashboard theo membership.
- Multi-membership vẫn chọn membership đầu tiên theo `center_id`; owner test hiện expected chỉ có `dreamhome_prod`.
- Nếu owner login bị chặn bởi live data/session ngoài code audit, cần phase hotfix riêng.

## 11. Nếu owner bị chặn thì xử lý thế nào

Nếu manual QA owner login bị chặn:

- không mở C6.5;
- không tự tạo thêm role/permission system;
- kiểm tra message login/membership;
- xác nhận owner membership active trong Supabase;
- nếu blocker do runtime role allowlist nhỏ, tạo C6.4E.1 minimal owner runtime support;
- nếu blocker do data/Supabase, xử lý bằng phase verify/apply riêng.

## 12. C6.5 dependency

C6.5 Internal Center Console chỉ nên bắt đầu sau khi C6.4E manual QA owner login pass. C6.4E không tạo route `/internal/centers`, không tạo nút `Thêm cơ sở`, không tạo center list UI.

## 13. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global role/permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin/customer-facing concept.

## 14. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test đầy đủ;
- runtime owner role được review;
- center resolver được review;
- production/staging separation được review;
- badge `3` regression được review;
- không SQL/Supabase action;
- không tạo Auth user/membership/center mới;
- không mở C6.5/C7;
- không runtime change;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu owner role chưa được support trong runtime, owner membership không resolve được theo code path, phát hiện cần mở C6.5/C7, hoặc cần runtime fix lớn.
