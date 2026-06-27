# F22.6.4 - Fix Report Week Navigation Empty Weeks

## Summary

F22.6.4 là hotfix hẹp trước commit F22 để sửa điều hướng tuần trong module Báo cáo. Sau F22.6.3, cloud status và scroll đã ổn hơn, nhưng manual QA vẫn thấy `Tuần trước` / `Tuần sau` không đổi tuần đúng nghĩa.

## Manual QA Issue

- Week buttons nhận click nhưng tuần đang xem không đổi như mong muốn.
- Tuần không có dữ liệu vẫn phải xem được, hiển thị số 0 hoặc empty state rõ, không tự quay về tuần hiện tại.

## Root Cause

`getNextReportWeekStartDate` tạo `Date` khi lùi hoặc tiến 7 ngày, sau đó gọi `getWeekStartDate`. Trong `report-module`, `getWeekStartDate` chỉ parse chuỗi `YYYY-MM-DD`; khi nhận `Date` object thì rơi về `new Date()`. Vì vậy week navigation có thể bị kéo lại tuần hiện tại thay vì tuần người dùng vừa chọn.

## Fix Applied

- Thêm `parseReportDate` để `getWeekStartDate` và `buildWeekDays` nhận cả `Date` object lẫn chuỗi date-key.
- Giữ week navigation chỉ đổi `reportState.filters.weekStartDate`, reset `selectedBarDetail`, render lại UI.
- Normalize input tuần về đầu tuần bằng `getWeekStartDate(control.value)`.
- Không đụng cloud guard/status và không đụng scroll.

## Behavior

- `Tuần trước`: lùi đúng 7 ngày từ tuần đang xem.
- `Tuần này`: quay về tuần chứa ngày hiện tại.
- `Tuần sau`: tiến đúng 7 ngày từ tuần đang xem.
- Empty week: label tuần vẫn đổi sang tuần đó; doanh thu, chi phí và chart dùng số 0/empty state rõ, không fallback về tuần hiện tại.

## Scope Không Làm

- Không SQL.
- Không Supabase data change.
- Không cloud schema/storage/realtime mới.
- Không sửa C5/C6.
- Không commit/push.

## Manual QA Checklist

1. Mở Báo cáo.
2. Ghi nhận tuần hiện tại, ví dụ `22/06/2026 - 28/06/2026`.
3. Bấm `Tuần trước`, label phải thành `15/06/2026 - 21/06/2026`.
4. Nếu tuần đó không có dữ liệu, các số tuần về 0 và chart/empty state không crash.
5. Bấm `Tuần sau`, label tăng đúng 7 ngày.
6. Bấm `Tuần này`, label quay về tuần hiện tại.
7. Console không phát sinh cloud pull/400 do thao tác nút tuần.

## Next Phase

F22.7 - Commit local F22 checkpoint.
