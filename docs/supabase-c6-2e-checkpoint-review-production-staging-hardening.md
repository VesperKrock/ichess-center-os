# C6.2E - Checkpoint review production/staging hardening

C6.2E STATUS: CHECKPOINT REVIEW BEFORE COMMIT PUSH
LATEST_C6_COMMIT: 542ddf2
C6_2A_STATUS: PASS
C6_2B_STATUS: SUPERSEDED_BY_C6_2B_1
C6_2B_MANUAL_QA_FAILED: YES
C6_2B_1_STATUS: PASS
BADGE_THREE_SOURCE_TRACED: YES
BADGE_THREE_ROOT_CAUSE: NOTIFICATION_SYNC_BEFORE_INVENTORY_RELOAD
PRODUCTION_CENTER_ID: dreamhome_prod
STAGING_CENTER_ID: dreamhome
ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES
PRODUCTION_EMPTY_EXPECTED: YES
LOCAL_STORAGE_NAMESPACE_SEPARATION_REQUIRED: YES
SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES
BELL_BADGE_CENTER_AWARE: YES
INVENTORY_BADGE_CENTER_AWARE: YES
PRODUCTION_EMPTY_BADGE_HIDDEN: YES
MANUAL_QA_RELOAD_BADGE_REQUIRED_BEFORE_C6_2F: YES
RUNTIME_CHANGE: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
C6_3_STARTED: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.2E

C6.2E là checkpoint review trước commit/push cho production/staging hardening sau C6.2A, C6.2B và C6.2B.1. Phase này không thêm tính năng, không sửa runtime, không SQL, không Supabase action và không mở C6.3/C6.4/C6.5/C7.

## 2. Trạng thái sau C6.1

C6.1 đã commit/push tại `542ddf2 C6.1 DreamHome production empty center foundation`.

`dreamhome` là staging/test sandbox giữ Angel Wings. `dreamhome_prod` là DreamHome production empty center. Admin DreamHome dùng membership `center_id = dreamhome_prod`, role `center_admin`, status `active`. App resolve center qua `center_members`, localStorage tách namespace `.dreamhome` và `.dreamhome_prod`, taskbar hiển thị gọn `Cơ sở: DreamHome`, profile popover hoạt động.

## 3. Tổng hợp C6.2A

C6.2A PASS audit/docs/test only. Kết luận chính:

- GitHub Pages asset khớp build local sau C6.1F.
- Signed-in production path ưu tiên membership.
- `dreamhome` được phân loại staging/test sandbox.
- `dreamhome_prod` được phân loại production empty center.
- Các default `dreamhome` còn lại là fallback/dev/backward compatibility, không phải blocker cho signed-in production path.

## 4. Tổng hợp C6.2B và manual QA fail

C6.2B CodeX report PASS nhưng manual QA failed. Khi reload admin DreamHome thuộc `dreamhome_prod`, badge đỏ số `3` vẫn xuất hiện trên module `Kho hàng` và chuông tổng.

DevTools evidence: `.dreamhome_prod` rỗng, gồm `ichessCenterOS.notifications.dreamhome_prod = []`, `inventoryRequests.dreamhome_prod = []`, `inventoryMovements.dreamhome_prod = []`, `inventory.dreamhome_prod = []`; trong khi `.dreamhome` staging vẫn có `ichessCenterOS.notifications.dreamhome = [...]`.

## 5. Tổng hợp C6.2B.1

C6.2B.1 PASS và supersedes C6.2B. Runtime hotfix đã trace/fix nguồn badge `3`:

- Reload `inventoryRequests` trước `syncAppNotifications()`.
- Thêm `activeNotificationDataCenterId`.
- Chuông tổng, notification center, module bell và module badge đọc qua `getCenterScopedNotificationsForRender()`.
- Nếu signed-in center/data marker chưa trùng `dreamhome_prod`, render notification count từ `[]`, không đọc/render `.dreamhome`.

## 6. Root cause badge đỏ số 3

Root cause chính xác: trong `reloadLocalDataForResolvedCenter()`, app sync `notifications` trước khi reload `inventoryRequests`. Khi chuyển sang `dreamhome_prod`, `inventoryRequests` vẫn còn sample/staging trong memory. Ba request trạng thái `new`, `pending`, `preparing` sinh ra 3 notification `Kho hàng`.

BADGE_THREE_ROOT_CAUSE: NOTIFICATION_SYNC_BEFORE_INVENTORY_RELOAD.

## 7. Vì sao C6.2B.1 supersedes C6.2B

C6.2B chỉ gate badge dashboard tile, nhưng chưa sửa thứ tự nguồn notification và chưa gate chuông tổng/module bell. C6.2B.1 sửa nguồn notification và toàn bộ render path liên quan, nên C6.2B được đánh dấu `SUPERSEDED_BY_C6_2B_1`.

## 8. Production/staging separation review

Production center là `dreamhome_prod`; staging center là `dreamhome`. Signed-in user phải đi theo membership, không hardcode `dreamhome` cho production path. Angel Wings tiếp tục ở staging/test sandbox.

## 9. LocalStorage/cache namespace review

Namespace separation vẫn bắt buộc:

- Production: `.dreamhome_prod`
- Staging/test: `.dreamhome`

C6.2 không xóa, migrate hoặc seed chéo hai namespace. `.dreamhome` staging không bị xóa; `.dreamhome_prod` production empty được xem là trạng thái hợp lệ.

## 10. Notification/bell badge hardening review

Bell/notification badge đã được harden trong C6.2B.1: render path dùng center-scoped notifications. Production empty không được hiển thị badge `3` nếu `.dreamhome_prod` không có notification thật.

## 11. Inventory/Kho hàng badge hardening review

`Kho hàng` badge được derived từ notification source center-aware. Với `dreamhome_prod`, notification kho chỉ hợp lệ sau khi inventory requests production được reload; không sinh từ sample/staging `.dreamhome`.

## 12. GitHub Pages deploy/stale build review

C6.2A đã xác nhận GitHub Pages asset khớp build local sau C6.1F. Nếu local khác GitHub Pages trước C6.2F, nguyên nhân expected là C6.2 chưa commit/push/deploy.

## 13. Manual QA required trước C6.2F

Trước C6.2F commit/push, user cần manual QA:

1. Mở local/incognito.
2. Login `admin.dreamhome@ichess.vn`.
3. Reload 5-10 lần.
4. Expected: `Kho hàng` không hiện badge đỏ `3`.
5. Expected: chuông tổng không hiện badge đỏ `3`.
6. Dashboard vẫn là DreamHome production empty.
7. Không thấy Angel Wings.
8. Chip `Cơ sở: DreamHome` vẫn hoạt động.
9. Profile popover vẫn hoạt động.
10. `.dreamhome_prod` storage riêng.
11. `.dreamhome` staging không bị xóa.

Nếu manual QA chưa pass: không C6.2F, tạo C6.2B.2 hotfix.

## 14. Safety review

SQL_APPLIED_BY_CODEX: NO. SUPABASE_ACTION_BY_CODEX: NOT RUN. COMMIT: NOT RUN. PUSH: NOT RUN.

C6.2E không sửa runtime, không database/Auth/membership, không xóa/migrate Angel Wings, không xóa `.dreamhome`, không xóa `.dreamhome_prod`, không tạo center mới.

## 15. C6.3 deferred

C6.3 multi-center foundation chưa mở.

## 16. C6.4 deferred

C6.4 minimal owner/admin role binding chưa mở.

## 17. C6.5 Internal Center Console deferred

C6.5 Internal Center Console chưa mở; không có route `/internal/centers`, không có nút `Thêm cơ sở`.

## 18. C7 deferred

C7 account/permission/portal system chưa mở; không username login, không account management, không Teacher Portal, không Super Admin.

## 19. Files changed summary

C6.2E docs:

- `docs/supabase-c6-2e-checkpoint-review-production-staging-hardening.md`

C6.2E tests:

- `tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js`

Existing smokes updated only to allow C6.2E docs/test.

Runtime: no C6.2E runtime change.

SQL: none.

## 20. PASS / NEEDS REVIEW criteria

PASS khi checkpoint docs/test đầy đủ, C6.2B được ghi superseded bởi C6.2B.1, root cause badge `3` được ghi rõ, manual QA before C6.2F được ghi rõ, all C6 smokes/build/check pass, không runtime change mới trong C6.2E, không SQL/Supabase action, không commit/push.

NEEDS REVIEW nếu phát hiện file ngoài scope, runtime mới trong C6.2E, hoặc manual QA badge vẫn fail.

## 21. Recommendation sang C6.2F

Chỉ GO for C6.2F commit/push nếu user manual QA reload admin DreamHome 5-10 lần không còn badge `3` trên `Kho hàng` và chuông tổng. Nếu manual QA vẫn fail: không C6.2F, tạo C6.2B.2.
