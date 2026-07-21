# F23.3D - Convert Preview Phụ huynh/Học viên local-safe

Ngày: 22/07/2026

## Entry Point

Trong detail Module `Phụ huynh / Tư vấn`, box `Chuyển đổi khách hàng` thay CTA disabled cũ bằng nút `Chuẩn bị chuyển đổi` cho contact `lead` hoặc `consulting`.

Contact `converted` chỉ hiển thị trạng thái đã chuyển đổi và học viên liên kết nếu có.

## Dữ Liệu Nguồn

Preview đọc dữ liệu mới nhất từ `parentConsultations[]` đã render cùng `students[]` hiện tại:

- tên phụ huynh/khách, số điện thoại, số phụ, email, khu vực;
- nguồn khách, tư vấn phụ trách, stage, trạng thái tư vấn;
- tên bé, năm sinh/tuổi, nhu cầu học, chương trình quan tâm, lịch mong muốn;
- số ghi chú chăm sóc và số lịch hẹn.

Field thiếu hiển thị `Chưa có dữ liệu`.

## Candidate / Dedupe

Dedupe chỉ là gợi ý kiểm tra read-only, không auto merge.

Mức gợi ý:

- `high`: trùng số điện thoại sau normalize.
- `medium`: tên phụ huynh + tên bé gần giống, hoặc tên bé + năm sinh trùng.
- `low`: chỉ gần giống theo tên.

Candidate có thể đến từ:

- `Hồ sơ học viên`;
- `Liên hệ CRM`.

UI ghi rõ: `Gợi ý kiểm tra, không phải kết luận trùng hồ sơ`.

## Hai Phương Án Preview

`Tạo hồ sơ mới` hiển thị dự kiến:

- `Phụ huynh dự kiến`;
- `Học viên dự kiến`;
- `Quan hệ dự kiến`.

`Ghép với hồ sơ có sẵn` chỉ bật theo preview khi chọn candidate. Phương án này cho biết contact/student nào sẽ được xem trước liên kết, field nào giữ ở CRM, field nào có thể bổ sung nếu thiếu, và cảnh báo không ghi đè dữ liệu đang có.

## Dữ Liệu Dự Kiến

Phụ huynh dự kiến:

- tên;
- số điện thoại;
- email;
- khu vực;
- nguồn khách;
- tư vấn ban đầu.

Học viên dự kiến:

- họ tên;
- năm sinh / tuổi;
- phụ huynh chính;
- nhu cầu học;
- chương trình quan tâm;
- lịch mong muốn;
- nguồn tạo: CRM.

Quan hệ dự kiến:

- `contact → parent`;
- `parent → student`;
- `contact → linkedStudentIds`;
- `student → initialConsultantId`.

## Write Bị Cấm

F23.3D chỉ là bản xem trước:

- chưa tạo hồ sơ phụ huynh;
- chưa tạo học viên;
- chưa tạo học phí;
- chưa gán lớp/lịch học;
- chưa tạo điểm danh;
- chưa đổi trạng thái khách hàng;
- chưa ghi `linkedStudentIds`;
- chưa copy `careLogs` sang `student.careNotes`;
- chưa gọi Auth/Supabase/SQL/cloud/deploy.

## Đảm Bảo Local-safe

State lựa chọn preview (`create` / `merge`, candidate đang chọn) chỉ nằm trong UI state tạm thời ở `main.js`. Không có handler xác nhận chuyển đổi thật. Button `Xác nhận chuyển đổi - chưa mở` bị disabled.

## Test

Smoke chính:

```txt
node tests/f23-3d-convert-preview-phu-huynh-hoc-vien-local-safe-smoke.js
```

Regression CRM liên quan:

```txt
node tests/f23-3b-crm-shell-phu-huynh-tu-van-local-safe-smoke.js
node tests/fb-admin-dreamhome-vong-1-3-settings-parent-wiring-smoke.js
node tests/fb-admin-dreamhome-vong-1-3-followup-select-window-parent-settings-smoke.js
```
