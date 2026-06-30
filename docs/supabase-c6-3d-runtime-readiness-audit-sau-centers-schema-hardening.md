# C6.3D - Runtime/readiness audit sau centers schema hardening

C6.3D STATUS: RUNTIME READINESS AUDIT AFTER CENTERS SCHEMA HARDENING
C6_3C_STATUS: PASS
SQL_APPLIED_BY_USER: YES
SQL_APPLIED_BY_CODEX: NO
CENTERS_SCHEMA_HARDENED: YES
DREAMHOME_ENVIRONMENT: staging
DREAMHOME_PROD_ENVIRONMENT: production
CENTER_RESOLVER_RUNTIME_REVIEWED: YES
SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES
LOCAL_STORAGE_NAMESPACE_SEPARATION_REQUIRED: YES
BADGE_THREE_FIX_STILL_REQUIRED: YES
NEW_CENTER_CREATED: NO
GOVAP_CREATED: NO
QUAN12_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: NO
SQL_APPLIED_IN_C6_3D: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.3D

C6.3D audit runtime/readiness sau khi user đã manual apply centers schema hardening và C6.3C PASS. Mục tiêu là xác nhận app vẫn đi theo membership, `dreamhome_prod` vẫn là production empty, `dreamhome` vẫn là staging/test sandbox, badge đỏ `3` không quay lại, và localStorage namespace vẫn tách.

## 2. Trạng thái sau C6.3C

C6.3C ghi nhận SQL apply do user chạy thủ công trong Supabase. CodeX không chạy SQL và không gọi Supabase action.

Metadata đã ghi nhận:

- `dreamhome`: `slug = dreamhome`, `environment = staging`, `status = active`.
- `dreamhome_prod`: `slug = dreamhome`, `environment = production`, `status = active`.

Constraints/indexes đã ghi nhận:

- `centers_environment_check`
- `centers_status_check`
- `centers_slug_environment_unique_idx`
- `centers_environment_idx`
- `centers_status_idx`

## 3. Centers schema hardening đã apply

Schema hardening đã thêm nền metadata cho multi-center: `slug`, `environment`, `status`, `updated_at`. Việc này không đổi `center_id`, không đổi `center_members.center_id`, không rename `dreamhome`, không tạo Gò Vấp/Quận 12.

## 4. Runtime readiness review

Runtime hiện không bị phụ thuộc vào `slug/environment/status` để login hoặc route center. App vẫn chủ yếu dùng `center_id`, role/status membership và display name map trong `src/supabase-auth.js`.

Kết luận audit: metadata mới không làm vỡ runtime hiện tại vì runtime không query các cột mới ở path login/dashboard.

## 5. Center resolver review

`resolveActiveCenterMembership()` vẫn đọc `center_members`, lọc `user_id` và `status = active`, rồi dùng `center_id` từ membership. Với admin DreamHome, expected membership là:

- email: `admin.dreamhome@ichess.vn`
- `center_id = dreamhome_prod`
- `role = center_admin`
- `status = active`

Signed-in membership wins over hardcode. URL không quyết định security.

## 6. Centers metadata usage review

Runtime hiện vẫn chủ yếu dùng `center_id` và display name. Metadata mới `slug/environment/status/updated_at` là nền cho C6.4/C6.5, chưa bắt buộc hiển thị trong UI hiện tại.

Accepted limitation: display name map vẫn nằm trong app code cho `dreamhome` và `dreamhome_prod`; việc đọc display name từ `public.centers.name` có thể là phase sau.

## 7. Production/staging separation review

Model sau hardening:

- `dreamhome = staging/test sandbox`, giữ Angel Wings.
- `dreamhome_prod = production empty center`.

Không tạo thêm center, không đổi `dreamhome`, không xóa Angel Wings.

## 8. Badge/notification hardening review

C6.2B.1 fix vẫn cần được bảo toàn:

- `inventoryRequests` reload trước `syncAppNotifications()`.
- `activeNotificationDataCenterId` vẫn là guard center-aware.
- `getCenterScopedNotificationsForRender()` vẫn là source render notification/badge.
- `Kho hàng` không được hiện badge đỏ `3` trong `dreamhome_prod` empty.
- Chuông tổng không được hiện badge đỏ `3` trong `dreamhome_prod` empty.

Marker `BADGE_THREE_FIX_STILL_REQUIRED: YES` nghĩa là fix này phải được giữ, không phải bug còn tồn tại.

## 9. LocalStorage namespace review

Rule vẫn giữ:

- Signed-in production path dùng `.dreamhome_prod`.
- Staging sandbox dùng `.dreamhome`.
- Không xóa/migrate `.dreamhome`.
- Không xóa/migrate `.dreamhome_prod`.

Storage key pattern vẫn là `ichessCenterOS.<scope>.<centerId>`.

## 10. Manual QA checklist

User nên test:

1. Mở local/incognito.
2. Login `admin.dreamhome@ichess.vn`.
3. Expected: dashboard vào DreamHome.
4. Expected: không thấy Angel Wings.
5. Expected: không thấy 29 học viên staging.
6. Expected: `Kho hàng` không badge đỏ `3`.
7. Expected: chuông tổng không badge đỏ `3`.
8. Expected: taskbar có `Cơ sở: DreamHome`.
9. Bấm chip cơ sở mở profile popover.
10. Reload 3-5 lần.
11. DevTools localStorage: `.dreamhome_prod` vẫn riêng.
12. DevTools localStorage: `.dreamhome` vẫn còn, không bị xóa.

Nếu có staging user thuộc `dreamhome`, login staging user phải vẫn vào staging sandbox và staging data nếu có vẫn hoạt động.

## 11. Risk list

- Runtime chưa đọc `public.centers.name` nên display name vẫn cần map code hiện tại.
- Multi-membership/center switcher vẫn deferred.
- C6.5 Internal Center Console chưa có UI, nên provisioning vẫn cần phase riêng.
- Manual QA browser vẫn cần xác nhận sau schema hardening.

Không có blocker runtime trong audit static C6.3D.

## 12. C6.3E recommendation

Nếu C6.3D PASS và manual QA không phát hiện lỗi, đi tiếp C6.3E checkpoint review. Không tạo Gò Vấp/Quận 12 nếu chưa có phase provisioning riêng.

## 13. C6.4 deferred

C6.4 minimal owner/admin role binding vẫn deferred. C6.3D không đổi role matrix.

## 14. C6.5 Internal Center Console deferred

C6.5 Internal Center Console vẫn deferred. C6.3D không tạo route `/internal/centers` và không tạo nút `Thêm cơ sở`.

## 15. C7 deferred

C7 vẫn deferred: không username login, không account management, không Teacher Portal, không Super Admin.

## 16. PASS / NEEDS REVIEW criteria

PASS nếu docs/test runtime readiness đầy đủ, C6.3C SQL apply được ghi là user-run, runtime center resolver được review, không runtime change, không SQL/Supabase action, không tạo center mới, không xóa/migrate Angel Wings, không mở C6.4/C6.5/C7, all C6 smokes/build/check pass, không commit/push.

NEEDS REVIEW nếu phát hiện runtime thật sự phụ thuộc sai vào `dreamhome`, production đọc staging, badge `3` quay lại, hoặc cần runtime/SQL/Supabase action để khắc phục.
