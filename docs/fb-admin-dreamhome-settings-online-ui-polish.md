# FB Admin DreamHome - Settings online UI polish

FB ADMIN DREAMHOME STATUS: SETTINGS ONLINE UI POLISH
FEEDBACK_SOURCE: ADMIN_DREAMHOME_HOANG_VAN
C8_TEACHER_ROADMAP_SCOPE: NO
SETTINGS_DEV_COPY_REMOVED: YES
CLOUD_DEBUG_PANEL_HIDDEN_FROM_ADMIN: YES
ANGEL_WINGS_RESTORE_HIDDEN_FROM_ADMIN: YES
LOCAL_CLOUD_PUSH_PULL_HIDDEN_FROM_ADMIN: YES
SETTINGS_TABS_PRODUCT_FACING: YES
CENTER_CLASS_SETTINGS_PRESERVED: YES
DATA_STATUS_PRODUCT_FACING: YES
SQL_APPLIED_BY_CODEX: NO
DEPLOY_BY_CODEX: NO
RUNTIME_CHANGED: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## Bối cảnh

Feedback admin DreamHome từ Hoàng Vân: module Cài đặt cơ sở đang hiển thị nhiều khối kỹ thuật sau khi app đã online, làm admin cơ sở thấy giống màn debug/migration thay vì màn vận hành.

## Vấn đề UI

- Header và tab có copy thiên về dữ liệu nền/roadmap.
- Khối cloud cũ hiển thị chi tiết nội bộ như Supabase, Cloud DB, marker, Angel Wings, phase code và local/cloud manual tools.
- Các nút khôi phục dữ liệu, đẩy local lên cloud, tải cloud về local không phù hợp với admin vận hành thường ngày.

## Patch summary

- Đổi subtitle thành `Quản lý các thiết lập vận hành của cơ sở.`
- Chỉ giữ tab đang dùng thật: `Ca học / Lớp`.
- Đổi mô tả ca học/lớp thành copy product-facing.
- Empty state khi chưa có ca học hướng dẫn admin thêm ca học/lớp để dùng khi nhập học viên và lập thời khóa biểu.
- Thay khối debug cloud bằng `Trạng thái dữ liệu` ngắn gọn: dữ liệu cloud, đồng bộ, cơ sở.
- Không render các nút khôi phục Angel Wings, đẩy local lên cloud, tải cloud về local trong Cài đặt cơ sở.

## Admin-facing UI sau polish

Admin DreamHome thấy:

- `Cài đặt cơ sở`
- `Ca học / Lớp`
- Danh sách, tìm kiếm, trạng thái và thao tác thêm/sửa/ngưng dùng ca học.
- `Trạng thái dữ liệu` với câu ngắn, không lộ chi tiết kỹ thuật.

Admin không thấy:

- Supabase internals.
- Angel Wings marker/restore.
- local/cache/push/pull tools.
- phase code C2/C5.2C.
- tab `đã lên kế hoạch`.

## Dev/owner tools policy

Các hàm sync/debug bên dưới không bị xóa trong feedback này, nhưng UI admin cơ sở không render nút gọi chúng. Nếu cần mở lại cho owner/dev, nên đưa vào khu `Công cụ kỹ thuật` có guard rõ và mặc định collapsed.

## Manual QA checklist

- Mở `Cài đặt cơ sở` bằng admin DreamHome.
- Không thấy `Cloud DB online core`, `Supabase`, `Angel Wings`, `marker`, `localStorage`, `C5.2C`.
- Không thấy nút khôi phục Angel Wings, đẩy local lên cloud, tải cloud về local.
- Không thấy tab `đã lên kế hoạch`.
- `Ca học / Lớp` vẫn tìm kiếm, thêm, sửa, đổi trạng thái được.
- Nếu chưa có ca học, empty state dễ hiểu.

## Safety notes

- Không SQL.
- Không deploy.
- Không invoke Edge Function.
- Không đổi schema/cloud sync logic.
- Không sửa C8 Teacher roadmap/docs/tests.
- Không commit/push.
