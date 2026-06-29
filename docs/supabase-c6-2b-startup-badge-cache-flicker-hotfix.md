# C6.2B - Startup badge/cache flicker hotfix

C6.2B STATUS: STARTUP BADGE CACHE FLICKER HOTFIX
PRODUCTION_CENTER_ID: dreamhome_prod
STAGING_CENTER_ID: dreamhome
STARTUP_BADGE_FLICKER_FIXED: YES
BADGES_GATED_UNTIL_CENTER_READY: YES
INVENTORY_BADGE_CENTER_AWARE: YES
PRODUCTION_EMPTY_BADGE_HIDDEN: YES
SIGNED_IN_PRODUCTION_READS_DREAMHOME_CACHE: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
DREAMHOME_CACHE_DELETED: NO
DREAMHOME_CACHE_MIGRATED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
C6_3_STARTED: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.2B

Hotfix C6.2B xử lý startup flicker trên signed-in production path: khi admin DreamHome thuộc `dreamhome_prod` reload app, module `Kho hàng` không được hiển thị badge đỏ số `3` từ cache/sample/staging trước khi center binding hoàn tất.

## 2. Triệu chứng user phát hiện

Manual QA sau C6.2A cho thấy dashboard DreamHome production empty cuối cùng vẫn đúng, nhưng mỗi lần reload có khoảnh khắc `Kho hàng` hiện badge đỏ `3` rồi biến mất. Đây là lỗi hiển thị dữ liệu nghiệp vụ trước khi app chắc chắn đang bind vào `dreamhome_prod`.

## 3. Nguyên nhân kỹ thuật dự kiến

`src/main.js` khởi tạo state local-first từ localStorage/default theo center hiện tại trước khi Supabase auth và `center_members` resolve xong. Badge module lấy từ notification counts, trong đó `Kho hàng` có thể được sync từ `inventoryRequests`. Khi production path chưa xác nhận dữ liệu đã reload theo `dreamhome_prod`, badge có thể đọc state cũ/sample của `dreamhome`.

## 4. Audit source

Badge dashboard nằm trong `renderDashboard()` ở `src/main.js` và dùng `getUnreadNotificationCountsByModule(notifications)`.

`Kho hàng` badge liên quan tới `buildInventoryRequestNotificationCandidates(inventoryRequests)` trong `syncAppNotifications()`.

Center binding được resolve qua `resolveAppCenterBinding(cloudStatus)` và `syncCloudUser()` gọi `setCurrentStorageCenterId(resolvedMembership.centerId)` trước khi `reloadLocalDataForResolvedCenter()`.

LocalStorage namespace hiện đi qua center-scoped storage, gồm `.dreamhome` cho staging và `.dreamhome_prod` cho production.

## 5. Fix summary

Thêm marker runtime `activeLocalDataCenterId`, cập nhật sau mỗi lần `reloadLocalDataForResolvedCenter()`.

Thêm guard `canRenderCenterScopedModuleBadges()`:

- signed-in path chỉ render module badges khi binding status là `bound`;
- `activeLocalDataCenterId` phải trùng `binding.currentCenterId`;
- `getCurrentStorageCenterId()` phải trùng `binding.currentCenterId`;
- nếu chưa đủ điều kiện, dashboard render tile nhưng badge count là `{}`.

Không dùng `setTimeout`, không delay giả, không reset cache.

## 6. Center binding ready rule

Với user đã đăng nhập, module badges chỉ được tính sau khi center binding sẵn sàng. Trạng thái `loading`, `missing`, `error`, hoặc data center marker chưa khớp sẽ không render badge nghiệp vụ.

## 7. Inventory/Kho hàng badge rule

Với `dreamhome_prod`, `Kho hàng` badge chỉ hợp lệ sau khi local data đã được reload trong namespace production. Vì guard yêu cầu `activeLocalDataCenterId === dreamhome_prod`, badge không được tính từ `.dreamhome`.

## 8. Notification badge rule

Module badges tiếp tục dùng notification store hiện có, nhưng việc đọc counts cho dashboard bị gate theo center. C6.2B không rewrite notification subsystem; chỉ chặn render count khi center data chưa ready.

## 9. Production empty behavior

Production empty là trạng thái hợp lệ. Nếu `dreamhome_prod` chưa có dữ liệu kho, `Kho hàng` badge phải ẩn/0 ngay từ đầu và không seed sample.

## 10. Staging behavior

Staging `dreamhome` vẫn được giữ làm sandbox/test. Nếu user staging có pending inventory requests thì badge staging vẫn được phép hiển thị sau khi binding vào `dreamhome`; C6.2B không xóa hoặc migrate Angel Wings.

## 11. LocalStorage namespace safety

C6.2B không xóa `.dreamhome`, không migrate `.dreamhome`, không xóa `.dreamhome_prod`, không seed staging vào production. Guard chỉ quyết định thời điểm render badge theo center đã bind.

## 12. Files changed

Runtime:

- `src/main.js`

Docs:

- `docs/supabase-c6-2b-startup-badge-cache-flicker-hotfix.md`

Tests:

- `tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js`

Existing smokes updated:

- C6.0 -> C6.2A smoke allowlists cập nhật để chấp nhận file C6.2B.

## 13. Manual QA checklist

1. Mở incognito/local.
2. Login `admin.dreamhome@ichess.vn`.
3. Reload 5 lần.
4. Quan sát module `Kho hàng`: không được hiện badge đỏ `3` dù thoáng qua.
5. Dashboard vẫn vào DreamHome production empty.
6. Không thấy Angel Wings.
7. Taskbar `Cơ sở: DreamHome` vẫn ổn.
8. Profile popover vẫn hoạt động.
9. DevTools localStorage vẫn có `.dreamhome_prod` riêng.
10. `.dreamhome` không bị xóa.
11. Nếu có staging user thuộc `dreamhome`, badge staging vẫn hiển thị đúng theo dữ liệu staging.

## 14. PASS / NEEDS REVIEW criteria

PASS khi smoke/build pass, no SQL/Supabase action, no commit/push, runtime có center-ready guard thật, production empty badge ẩn/0, và manual QA không còn flicker badge `Kho hàng` số `3`.

NEEDS REVIEW nếu vẫn thấy production đọc `.dreamhome`, phải sửa sâu notification/storage, hoặc phát hiện file ngoài scope.

## 15. Recommendation sau C6.2B

User chạy manual QA reload flicker. Nếu PASS, tiếp tục C6.2E checkpoint review trước khi xét commit/deploy sau.
