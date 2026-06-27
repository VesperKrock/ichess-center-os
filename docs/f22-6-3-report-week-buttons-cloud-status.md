# F22.6.3 - Report Week Buttons + Cloud Status After Reload

## Summary

F22.6.3 là hotfix nhỏ trước commit F22. Manual QA sau F22.6.2 cho thấy Báo cáo không còn spam 400 nhiều như trước, nhưng nút `Tuần trước` / `Tuần sau` chưa đổi tuần thật; sau reload taskbar có thể kẹt `Dữ liệu: Cache cục bộ` dù app đang signed-in/cloud sẵn.

Không SQL, không Supabase data change, không cloud schema/storage mới, không C5/C6, không commit/push.

## Manual QA Issue

- Week buttons trong Báo cáo không hoạt động hoặc bấm không đổi tuần.
- Sau reload, taskbar hiện `Dữ liệu: Cache cục bộ` mơ hồ.
- Nếu signed-in và cloud pull pass thì phải lên `Dữ liệu: Cloud`.
- Nếu cloud fail/cooldown thì phải hiển thị cache kèm lý do rõ, không spam loading/pull.

## Root Cause

### Week Buttons

Handler cũ gắn trực tiếp vào từng button sau render. Với module window render lại liên tục, cách này dễ bị mất click hoặc không đủ chắc khi DOM trong report toolbar thay đổi. Handler cũng chưa `preventDefault`/`stopPropagation`, nên không khóa được các edge case khi nút nằm trong vùng UI có nhiều listener khác.

### Cache Cục Bộ After Reload

F22.6.2 đã tránh spam loading khi có cache, nhưng initial auth có thể chạy song song giữa `INITIAL_SESSION` callback và `getCurrentSupabaseUser()`. Nếu lần sync sau invalidate lần bootstrap trước khi `cloudDbAutoPullUserId` đã set, lần bootstrap mới có thể bị skip và taskbar kẹt ở cache.

Ngoài ra trạng thái `ERROR` trong `getCloudBootstrapStatusLabel` trước đây luôn trả về `Dữ liệu: Cache cục bộ`, làm mất lý do lỗi/cooldown.

### Cloud Guard/Cooldown

Cooldown 400 vẫn cần giữ, nhưng label phải rõ: cache vì cloud lỗi 400/schema, không phải cache mơ hồ.

## Fix Applied

### Week Navigation

- Chuyển week click sang event delegation trên `.report-module`.
- Thêm `event.preventDefault()` và `event.stopPropagation()`.
- Thêm helper `getNextReportWeekStartDate(currentWeekStartDate, action)`:
  - `previous`: lùi 7 ngày.
  - `next`: tiến 7 ngày.
  - `current`: về tuần chứa ngày hiện tại.
- Week navigation chỉ update `reportState.filters.weekStartDate` và `selectedBarDetail`, không gọi cloud pull/bootstrap.

### Cloud Status

- `initializeSupabaseAuth()` không dùng force sync cho `initial-get-user`, để tránh đạp lên sync đang chạy từ `INITIAL_SESSION`.
- Khi có local/cache và vẫn kiểm cloud nền, taskbar dùng nhãn rõ `Dữ liệu: Cache cục bộ (đang kiểm cloud nền)`.
- Khi cloud fail 400/schema, taskbar dùng nhãn rõ `Dữ liệu: Cache cục bộ (cloud lỗi 400/schema, tạm dừng pull)`.
- `getCloudBootstrapStatusLabel()` trả về `state.message` cho trạng thái ERROR thay vì ép về `Dữ liệu: Cache cục bộ`.

### Loading/Cooldown

- Nếu cloud pull pass, bootstrap vẫn set `CLOUD_BOOTSTRAP_STATUS.CLOUD` và taskbar hiện `Dữ liệu: Cloud`.
- Nếu cloud fail 400/schema, cooldown giữ cache/local và không spam retry.
- Không bật `Đang tải cloud` lặp lại khi cache hợp lệ.

### Scroll Impact

- Week navigation không gọi cloud nên không tạo cloud render phụ.
- Scroll retention F22.6.2 giữ nguyên.

## What Was Not Changed

- Không SQL.
- Không Supabase data change.
- Không cloud schema/storage mới.
- Không C5/C6.
- Không F22.5 designer polish.
- Không implement check-in/check-out ảnh.
- Không commit/push.

## Manual QA Checklist

- Reload app khi đang đăng nhập.
- Nếu cloud pull pass, taskbar lên `Dữ liệu: Cloud`.
- Nếu cloud fail, taskbar hiển thị cache kèm lý do, không spam `Đang tải cloud`.
- Mở Báo cáo.
- Bấm `Tuần trước`: tuần lùi 7 ngày, label/chart/số liệu đổi theo tuần.
- Bấm `Tuần sau`: tuần tiến 7 ngày.
- Bấm `Tuần này`: quay về tuần hiện tại.
- Console không spam 400 do các nút tuần.
- Scroll xuống Báo cáo, Ctrl+Tab ra/vào, scroll không nhảy đầu.

## Next Phase

F22.7 — Commit local F22 checkpoint.
