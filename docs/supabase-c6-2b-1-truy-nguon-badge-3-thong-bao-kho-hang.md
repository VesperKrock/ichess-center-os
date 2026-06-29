# C6.2B.1 - Truy nguồn badge 3 thông báo / Kho hàng

C6.2B.1 STATUS: TRACE FIX BADGE 3 NOTIFICATION INVENTORY SOURCE
PRODUCTION_CENTER_ID: dreamhome_prod
STAGING_CENTER_ID: dreamhome
C6_2B_MANUAL_QA_FAILED: YES
DEVTOOLS_EVIDENCE_DREAMHOME_PROD_NOTIFICATIONS_EMPTY: YES
DEVTOOLS_EVIDENCE_DREAMHOME_STAGING_NOTIFICATIONS_EXIST: YES
BADGE_THREE_SOURCE_TRACED: YES
STARTUP_BADGE_FLICKER_FIXED: YES
BELL_BADGE_CENTER_AWARE: YES
INVENTORY_BADGE_CENTER_AWARE: YES
BADGES_GATED_UNTIL_CENTER_READY: YES
PRODUCTION_EMPTY_BADGE_HIDDEN: YES
SIGNED_IN_PRODUCTION_READS_DREAMHOME_CACHE: NO
PRODUCTION_EMPTY_SEEDS_DEMO_NOTIFICATIONS: NO
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

## 1. Mục tiêu C6.2B.1

Truy nguồn thật của badge đỏ số `3` sau khi C6.2B manual QA failed, rồi fix để signed-in production path `dreamhome_prod` không đọc, sinh hoặc render notification/badge từ staging `.dreamhome`.

## 2. C6.2B manual QA fail

Sau C6.2B, admin DreamHome thuộc `dreamhome_prod` vẫn thấy badge đỏ `3` trên module `Kho hàng` và chuông tổng. C6.2B chỉ gate dashboard module tile, chưa sửa nguồn notification và chưa gate chuông tổng/module bell.

## 3. Evidence từ DevTools

DevTools cho thấy `.dreamhome_prod` đang rỗng, gồm `ichessCenterOS.notifications.dreamhome_prod = []`, `inventoryRequests.dreamhome_prod = []`, `inventoryMovements.dreamhome_prod = []`, `inventory.dreamhome_prod = []`, `schedule.dreamhome_prod = []`, `students.dreamhome_prod = []`, `teachers.dreamhome_prod = []`.

Trong khi đó `.dreamhome` staging vẫn có `ichessCenterOS.notifications.dreamhome = [...]` và `ichessCenterOS.notifications.version.dreamhome = "15J.1"`. C6.2B.1 không xóa hay migrate các key này.

## 4. Triệu chứng: Kho hàng badge và chuông tổng cùng hiện 3

`Kho hàng` badge và chuông tổng cùng hiện `3`, nên nguồn ưu tiên là notification pipeline chung thay vì riêng UI tile.

## 5. Audit source số 3

`renderDashboard()` dùng `getUnreadNotificationCountsByModule(...)` để tạo badge module.

`renderTaskbar()` dùng `getUnreadNotificationCount()` để tạo badge chuông tổng.

`renderModuleNotificationBell()` cũng lọc trực tiếp notification theo `sourceModule`.

Ba nhánh này đều dựa trên biến in-memory `notifications`.

Nguồn tạo notification kho nằm ở `syncAppNotifications()`, gọi `buildInventoryRequestNotificationCandidates(inventoryRequests)`.

`sampleInventoryRequests` có đúng 3 request ở trạng thái sinh notification: `new`, `pending`, `preparing`. Request `fulfilled` không sinh notification. Vì vậy số `3` được trace tới 3 inventory request sample/staging này.

## 6. Root cause chính xác

Trong `reloadLocalDataForResolvedCenter()`, trước C6.2B.1 code sync `notifications` trước khi reload `inventoryRequests`.

Khi app chuyển từ default/staging state sang `dreamhome_prod`, `notifications = syncAppNotifications(getStoredNotifications([]))` chạy khi `inventoryRequests` vẫn còn sample/staging trong memory. Kết quả là 3 notification `inventory-request` được sinh cho production render path, dù sau đó `inventoryRequests` mới được reload thành `[]`.

## 7. Vì sao C6.2B chưa đủ

C6.2B thêm `activeLocalDataCenterId` và gate badge dashboard tile, nhưng:

- không đổi thứ tự reload notification so với inventory;
- không gate chuông tổng taskbar;
- không gate module notification bell trong window;
- notification render vẫn có thể đọc biến `notifications` stale.

## 8. Fix summary

C6.2B.1 sửa nguồn bằng cách reload inventory trước khi gọi `syncAppNotifications()` trong `reloadLocalDataForResolvedCenter()`. Nhờ vậy production empty dùng `inventoryRequests.dreamhome_prod = []` trước khi build notification candidates.

Thêm `activeNotificationDataCenterId` và helper `getCenterScopedNotificationsForRender()`. Dashboard badge, chuông tổng, notification center và module bell chỉ đọc notifications khi:

- signed-in center binding là `bound`;
- `activeLocalDataCenterId` trùng current center;
- `activeNotificationDataCenterId` trùng current center;
- storage center hiện tại trùng current center.

## 9. Notification/bell badge rule

Với admin DreamHome, chuông tổng chỉ được tính sau khi notification data marker là `dreamhome_prod`. Nếu `.dreamhome_prod` không có notification thật, chuông tổng phải ẩn/0.

## 10. Inventory/Kho hàng badge rule

`Kho hàng` badge được derived từ center-aware notification source. Với `dreamhome_prod`, inventory notification candidates chỉ được tạo từ `inventoryRequests.dreamhome_prod`, không từ sample/staging `.dreamhome`.

## 11. Center binding ready rule

Nếu signed-in nhưng center binding hoặc notification data marker chưa ready, render notification count dùng mảng rỗng. Không dùng delay giả và không dùng CSS-only hide.

## 12. Production empty behavior

Production empty là hợp lệ. `dreamhome_prod` rỗng không seed demo notifications, không sinh `inventory-request` từ sample, và không hiển thị badge `3`.

## 13. Staging behavior

Staging `dreamhome` vẫn được giữ làm sandbox/test. Nếu staging có 3 inventory notification thật từ sample/staging, badge staging vẫn được phép hiển thị sau khi binding vào `dreamhome`.

## 14. LocalStorage namespace safety

C6.2B.1 không xóa `.dreamhome`, không migrate `.dreamhome`, không xóa `.dreamhome_prod`, không chạy SQL và không gọi Supabase action. Fix chỉ thay thứ tự reload runtime và guard render notification theo center.

C6.3, C6.4, C6.5 và C7 chưa mở trong phase này.

## 15. Files changed

Runtime:

- `src/main.js`

Docs:

- `docs/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang.md`

Tests:

- `tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js`

Existing smokes updated:

- C6.0 -> C6.2B smoke allowlists cập nhật để chấp nhận file C6.2B.1.

## 16. Manual QA checklist

1. Mở incognito/local.
2. Login `admin.dreamhome@ichess.vn`.
3. Reload 5-10 lần.
4. Quan sát `Kho hàng`: không hiện badge đỏ `3` dù thoáng qua.
5. Quan sát chuông tổng: không hiện badge đỏ `3` nếu production empty không có notification thật.
6. Dashboard vẫn là DreamHome production empty.
7. Không thấy Angel Wings.
8. Taskbar `Cơ sở: DreamHome` vẫn ổn.
9. Profile popover vẫn hoạt động.
10. DevTools: `.dreamhome_prod` keys vẫn riêng.
11. DevTools: `.dreamhome` keys vẫn còn, không bị xóa.
12. Nếu có staging user thuộc `dreamhome`, badge staging nếu có dữ liệu thật vẫn được phép hiện.

## 17. PASS / NEEDS REVIEW criteria

PASS khi source số `3` được trace rõ, runtime không còn sync notification kho trước khi reload inventory center hiện tại, bell/module badges đều center-aware, all smoke/build pass, không SQL/Supabase action, không commit/push.

NEEDS REVIEW nếu vẫn thấy production đọc `.dreamhome`, vẫn sinh 3 notification kho từ sample trong `dreamhome_prod`, hoặc phải rewrite lớn notification/storage.

## 18. Recommendation sau C6.2B.1

User chạy manual QA reload 5-10 lần. Nếu `Kho hàng` và chuông tổng không còn badge `3`, tiếp tục C6.2E checkpoint review. Nếu vẫn hiện badge, dừng và báo NEEDS REVIEW, không làm tiếp.
