# F22.6.2 - Diagnose Cloud 400 + Report Scroll Reset

## Summary

F22.6.2 chẩn đoán và hotfix lỗi manual QA sau F22.6.1: bấm điều hướng tuần trong Báo cáo thấy console spam Supabase 400, taskbar chuyển `Dữ liệu: Đang tải cloud` khi tab ra/vào, và scroll Báo cáo nhảy lên đầu.

Phase này không SQL, không Supabase data change, không cloud schema/storage mới, không C5/C6, không commit/push.

## Manual QA Issue

- Supabase 400 xuất hiện khi bấm `Tuần trước`/`Tuần này`/`Tuần sau` hoặc khi focus/visibility của browser thay đổi.
- Taskbar lặp trạng thái `Dữ liệu: Đang tải cloud`.
- Báo cáo bị render lại và scroll reset lên đầu.
- User có ý tưởng check-in/check-out bằng ảnh giáo viên, nhưng đây là future phase.

## Root Cause Found

### Cloud 400

`renderReportModule` và week navigation chỉ cập nhật local state Báo cáo, không gọi cloud trực tiếp. Root cause trong app nằm ở auth/cloud bootstrap:

- Supabase auth callback có thể bắn lại `INITIAL_SESSION`, `TOKEN_REFRESHED` hoặc `USER_UPDATED` khi focus/tab/browser session refresh.
- `syncCloudUser()` trước đó reset `cloudBootstrapState` và `cloudDbAutoPullUserId` cho cùng user, làm `bootstrapCoreCloudDataForCurrentCenter()` auto-pull lại.
- Nếu cloud query đang gặp lỗi 400/schema/RLS ngoài scope, mỗi auth/focus event có thể tạo thêm request lỗi, taskbar lại hiện loading, rồi render lại.

### Cloud Loading Loop

`bootstrapCoreCloudDataForCurrentCenter()` luôn set `CLOUD_BOOTSTRAP_STATUS.LOADING` trước khi pull, kể cả khi app đã có cache/local hợp lệ. Vì vậy taskbar nhấp nháy `Dữ liệu: Đang tải cloud` dù user chỉ đổi tuần trong Báo cáo hoặc tab ra/vào.

### Report Scroll Reset

Cloud status render và focus render làm DOM module thay mới. Scroll retention đã có nhưng restore một nhịp `requestAnimationFrame` có thể chạy trước khi layout chart/report ổn định, nên scroll đôi lúc vẫn về đầu.

## Fix Applied

### Cloud Guard

- Thêm `shouldSkipDuplicateCloudUserSync` để bỏ qua auth sync lặp cho cùng user đã loading/loaded/missing/error.
- `syncCloudUser()` chỉ reset cloud DB/bootstrap state khi đổi user thật sự.
- Auth callback bỏ qua duplicate `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`.

### Cloud 400 Cooldown

- Nếu cloud bootstrap fail với 400/schema-not-ready, app đặt cooldown 5 phút.
- Trong cooldown, app giữ cache/local và không auto-pull lại theo focus/visibility.
- Không sửa SQL/RLS trong phase này. Nếu backend vẫn trả 400 sau cooldown thì cần `NEEDS REVIEW` với request cụ thể.

### No Loading When Cache Exists

- Bootstrap chỉ set taskbar `Đang tải cloud` nếu chưa có local/cache dùng được.
- Khi đã có học viên/giáo viên/TKB local, auto-pull chạy nền nhẹ hơn và không ép trạng thái loading trên taskbar.

### Report Week Navigation

- Nút tuần chỉ update `reportState.filters.weekStartDate` và `selectedBarDetail`.
- Không gọi cloud bootstrap/pull trực tiếp từ `data-report-week-action`.

### Scroll Retention

- Restore preserved scroll hai nhịp `requestAnimationFrame`.
- Giữ target `.report-module` và `data-report-scroll-region="report-grid"` từ F22.6.1.
- Mục tiêu là giữ scroll khi cloud status update, focus/tab switch hoặc render nhẹ.

## What Was Not Changed

- Không SQL.
- Không Supabase data change.
- Không tạo/sửa Supabase table/bucket/policy.
- Không cloud storage upload.
- Không implement check-in/check-out ảnh.
- Không C5/C6.
- Không commit/push.

## Future Roadmap: Teacher Check-in/Check-out Photo Workflow

Ý tưởng ghi nhận cho phase sau:

- Giáo viên check-in: chụp mặt.
- Giáo viên check-out: chụp mặt, bảng điểm danh, phòng đã dọn.
- Hiện đang vận hành qua WhatsApp; sau này có thể upload ảnh lên app.
- Admin/anh Hải/tổng admin xem ảnh check-in/out.
- Có thể nén ảnh tương tự hướng Module Thu Chi cloud image.
- Có thể đặt trong Nhân viên/Chấm công hoặc liên kết từ TKB/Giáo viên.
- F22.6.2 không implement camera, upload, storage bucket, compression hay UI ảnh.

## Manual QA Checklist

- Mở DevTools Console.
- Mở Module Báo cáo.
- Bấm `Tuần trước` / `Tuần này` / `Tuần sau`.
- Console không còn spam Supabase 400 mới do thao tác tuần.
- Taskbar không lặp `Dữ liệu: Đang tải cloud` mỗi lần tab ra/vào nếu dữ liệu đã sẵn.
- Scroll xuống trong Báo cáo.
- Ctrl+Tab ra/vào hoặc đổi tab Chrome.
- Scroll không nhảy lên đầu.
- Kho/Báo cáo/Nhân viên/Học viên/Học phí vẫn mở được.

## Next Phase

F22.7 — Commit local F22 checkpoint.
