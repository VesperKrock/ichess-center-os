# Screenshot capture checklist

## Quy tắc an toàn

- Chỉ dùng dữ liệu fixture giả hoặc record đã được thay bằng dữ liệu giả.
- Che email thật, số điện thoại, địa chỉ, số giấy tờ, tài khoản ngân hàng, tên file nhạy cảm và định danh không cần thiết.
- Không mở DevTools/network/local storage khi chụp.
- Không chụp URL truy cập tạm thời, thông tin đăng nhập, token, key hoặc đường dẫn object private.
- Ghi cạnh bộ ảnh: browser, kích thước viewport, zoom, OS và `DỮ LIỆU GIẢ`.

Kích thước đề xuất để audit: `1440×900` và `1366×768`. Đây là đề xuất capture, chưa phải supported breakpoint được sản phẩm chốt.

## Shell

| # | Route/module | State cần mở | Dữ liệu | Vùng cần che | Capture |
| --- | --- | --- | --- | --- | --- |
| 1 | Login gate | Signed out, normal | Không nhập dữ liệu thật | URL/account gợi ý nếu có | 1440×900 |
| 2 | Login gate | Loading và access denied | Fixture message | Email/account | 1366×768 |
| 3 | Desktop | Không window; grid | Center fixture | Center/account nếu thật | Cả hai size |
| 4 | Desktop | Start mở; list mode | Module labels thật | Account | 1366×768 |
| 5 | Desktop | Hai–ba window chồng | Fixture data | Nội dung nhạy cảm | 1440×900, normal và maximize |
| 6 | Taskbar | Nhiều window + overflow + minimized | Fixture titles | Center/account nếu thật | 1366×768 |
| 7 | Notification | Panel unread, read filter, empty | Fixture notices | Tên người/record | 1366×768 |

## Module patterns

| # | Module | State cần mở | Dữ liệu fixture | Vùng cần che | Capture |
| --- | --- | --- | --- | --- | --- |
| 8 | Học viên | List/table có dữ liệu + filter | 8–12 học viên giả, label dài | Toàn bộ PII thật | 1440×900 và 1366×768 |
| 9 | Học viên | Create/edit form invalid | Field giả, error dài | PII | Normal/maximize |
| 10 | Học viên | Detail + empty child state | Hồ sơ giả | PII | 1366×768 |
| 11 | Giáo viên | List + profile + form | 6 giáo viên giả | Liên hệ/account | 1440×900 |
| 12 | Nhân viên | List filter + department/lifecycle | 8 staff giả | Account/employment detail thật | 1440×900 và compact |
| 13 | Cài đặt cơ sở | Ca/lớp table + form | Ca/lớp giả | Center data thật nếu cần | 1366×768 |
| 14 | Thời khóa biểu | Tuần có lịch dày | Ca/hoạt động giả | Tên thật | Cả hai size; full grid/scroll |
| 15 | Thời khóa biểu | Conflict + empty week | Fixture conflict | Tên thật | 1366×768 |
| 16 | Bảng điểm danh | Sheet dày + selected cell | Học viên giả, một tháng | Tên học viên thật | Cả hai size |
| 17 | Bảng điểm danh | Detail/note + locked/unlocked | Fixture | Ghi chú thật | 1366×768 |
| 18 | Học phí | Table + debt/status | Số tiền/tên giả | Tài chính thật | Cả hai size |
| 19 | Học phí | Payment form/evidence/loading/error | File/số tiền giả | Chứng từ thật | 1366×768 |
| 20 | Thu chi | 10-column table + filters | 10 giao dịch giả | Giao dịch/chứng từ thật | Cả hai size |
| 21 | Thu chi | Form + transaction detail/gallery | Ảnh placeholder giả | Ảnh/chứng từ thật | 1366×768 |
| 22 | Sổ quỹ | Reconciliation + history | Số giả | Số dư thật | 1366×768 |
| 23 | Kho hàng | List/attention/request | Item/request giả | Tên người thật | 1366×768 |
| 24 | Báo cáo | Daily/weekly + source modal | Fixture report | Giao dịch thật | 1440×900 |
| 25 | Phụ huynh/Tư vấn | Table + wizard/detail | Contact giả | PII thật | 1366×768 |

## Hồ sơ hành chính và tệp

| # | State cần mở | Dữ liệu fixture | Vùng cần che | Capture |
| --- | --- | --- | --- | --- |
| 26 | Chưa tạo + permission allowed | Staff giả | Mọi PII thật | 1366×768 |
| 27 | Complete profile, masked | Field giả có độ dài thật | Không reveal giá trị thật | 1440×900 |
| 28 | Edit form invalid/long | Dữ liệu giả | Mọi field thật | 1366×768 |
| 29 | Permission denied | Không cần data | Account/center thật | 1366×768 |
| 30 | Backend unavailable/malformed/needs review | Fixture state | Error kỹ thuật nhạy cảm | 1366×768 |
| 31 | Document catalog empty và populated | 5 tài liệu giả | Số/ký hiệu/file thật | 1440×900 |
| 32 | Attachment current + viewer ảnh/PDF | File fixture vô hại | Filename/path/URL thật | Normal/maximize |
| 33 | Version history current/replaced | 2–3 version giả | File metadata thật | 1366×768 |
| 34 | Soft removal `Đã gỡ` + upload slot trở lại | Fixture | Metadata thật | 1366×768 |
| 35 | Deletion request pending/rejected/cancelled | Copy fixture | Actor ID thật | 1366×768 |
| 36 | Legal hold active + execution unavailable | Fixture | Actor/record thật | 1366×768 |
| 37 | Viewer close/scroll return | Video ngắn hoặc before/after | Nội dung file | 1366×768 |

## Mỗi ảnh gửi kèm

- ID checklist.
- Viewport + zoom.
- Window normal/maximized.
- Role giả lập.
- State/data fixture đã dùng.
- Vấn đề người dùng cảm nhận, không chỉ ảnh.
- Nếu có scroll bug: video ngắn hoặc hai ảnh trước/sau và vị trí con trỏ.
