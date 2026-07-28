# Core user flows

## State contract dùng cho mọi flow

Mỗi mockup flow phải chỉ rõ: entry point, happy path, validation, empty, permission, loading, error, confirmation, success và destructive/deferred boundary. Nếu một state không áp dụng, ghi `N/A` thay vì bỏ trống.

## 1. Đăng nhập và bind center

1. Người dùng mở app tại login gate.
2. Nhập thông tin đăng nhập và submit; button chuyển busy.
3. App xác thực rồi tải memberships.
4. Membership active hợp lệ bind center; desktop mới xuất hiện.
5. Thiếu/inactive/revoked/paused/malformed membership hiển thị access denied hoặc lỗi rõ ràng; không render dữ liệu center.

States: config missing, signed out, signing in, bad credentials, membership loading, no membership, denied, center bound, logout. Không đưa thông tin đăng nhập thật vào mockup.

## 2. Mở và quản lý module từ desktop

1. Từ desktop hoặc Start, chọn module.
2. Nếu module chưa mở, app tạo window và đưa lên trước; nếu đã mở, focus window cũ.
3. Người dùng minimize, restore từ taskbar, maximize/restore hoặc close.
4. Nhiều window được quản lý bằng z-index; taskbar overflow giữ window dư.

States: desktop empty, grid/list, Start open, one/many windows, active/inactive/minimized, taskbar overflow, notification overlay. Confirmation chỉ áp dụng khi form có unsaved/destructive boundary đã được nghiệp vụ xác nhận.

## 3. Quản lý học viên

1. Mở Học viên, xem stats/list và dùng search/filter/sort.
2. Tạo học viên qua form nhiều bước hoặc mở detail của row.
3. Validate required/format và giữ error tại field/form.
4. Lưu thành công quay về data mới; detail có các child view như ghi chú chăm sóc/kết quả học.

States: loading/cache/cloud status nếu có, no data, no filter result, create/edit, invalid, saving, save error, success, detail not found. Archive/status action phải giữ confirmation theo runtime; không biến thành hard delete.

## 4. Giáo viên và Nhân viên

1. Mở danh sách, filter theo trạng thái/loại/phòng ban/link.
2. Tạo hoặc sửa hồ sơ vận hành.
3. Có thể link Giáo viên ↔ Nhân viên và account membership theo stable identity.
4. Thay đổi employment lifecycle qua dialog có reason/date/checklist; lịch sử được giữ.
5. Từ row Nhân viên, active owner/admin có thể mở Hồ sơ hành chính child window.

States: not linked, linked, candidate unavailable, inactive/archived, duplicate identity, malformed membership, lifecycle transition validation, saving/error/success. Không merge hồ sơ Giáo viên và Nhân viên chỉ để đơn giản UI.

## 5. Thiết lập ca học/lớp

1. Mở Cài đặt cơ sở → Ca học/Lớp.
2. Search/filter list hoặc tạo/sửa ca.
3. Nhập ngày trong tuần, thời gian, trạng thái và các field liên quan.
4. Validate thời gian/tên/trùng lặp theo runtime; lưu và cập nhật list.

States: empty, filtered empty, create/edit, validation, saving/error, active/inactive. Ca đang được tham chiếu không được giả định có thể xóa một bước.

## 6. Thời khóa biểu

1. Mở module, chọn tuần trước/hiện tại/sau và lọc hoạt động.
2. Xem 7 cột ngày; mở ca dạy hoặc hoạt động cơ sở.
3. Tạo/sửa hoạt động, tag, recurrence; conflict panel xuất hiện khi có xung đột.
4. Mở report/attendance theo ca và lưu theo quyền.

States: week empty, day empty, filtered empty, horizontal overflow, loading, item detail, create/edit, soft/hard conflict, delete confirm, recurring series confirm, report incomplete/error/success. Ở laptop, phải giữ ngày/giờ/context khi grid scroll.

## 7. Điểm danh

1. Chọn tháng và ca/lớp; search học viên.
2. Xem sheet theo học viên × ngày.
3. Nếu dùng dữ liệu nền, nhập cell và khóa/mở khóa theo flow hiện hành.
4. Mở detail hoặc ghi chú cho cell; thay đổi được lưu và phản ánh vào học phí/báo cáo theo linkage.

States: chưa có học viên, chưa có ca/lớp, filter empty, planned/recorded/empty cell, locked/unlocked, keyboard focus, detail/note modal, save error/success. Không làm mất affordance spreadsheet/keyboard nếu chưa được duyệt.

## 8. Học phí

1. Chọn tháng/kỳ, search/filter học viên và xem công nợ.
2. Tạo/sửa gói/kỳ hoặc mở chi tiết.
3. Ghi nhận thanh toán; giao dịch tương ứng được nối sang Thu chi.
4. Xem lịch sử kỳ/thanh toán, attendance preview và cảnh báo.

States: no record, no result, form validation, legacy unreconciled, overpayment warning, payment evidence empty/loading/error, confirmation tạo kỳ/hoàn tác, saving/error/success. Derived totals không được biến thành field edit trực tiếp.

## 9. Thu chi và chứng từ

1. Mở Thu chi, chọn period/filter và xem stats/table.
2. Tạo hoặc sửa giao dịch; chọn loại/danh mục/số tiền/ngày/phương thức.
3. Thêm hoặc quản lý ảnh chứng từ theo readiness và quyền.
4. Mở detail, print/export hoặc drill-down từ báo cáo.

States: empty/result empty, create/edit, invalid money/category/date, attachment empty/loading/error/private unavailable, detail, delete/remove confirm theo contract giao dịch, save error/success. Học phí là nguồn flow liên kết nhưng ledger vẫn giữ identity giao dịch.

## 10. Hồ sơ hành chính

1. Active owner/admin mở từ row Nhân viên.
2. App kiểm membership, center, storage integrity và unique staff/profile relation.
3. Nếu chưa tạo, hiển thị empty và action tạo; nếu có, hiển thị overview/sections.
4. Field nhạy cảm mask mặc định; reveal theo action, không lưu trạng thái reveal.
5. Sửa/đánh dấu review theo revision guard; archive Staff không xóa profile.

States: permission denied, not created, incomplete, complete, archived, malformed/duplicate/needs review, view/edit, masked/revealed, validation, stale, saving/error/success.

## 11. Tài liệu nhân sự và attachment private

### Catalog và upload

1. Trong Hồ sơ hành chính → Tài liệu, tạo metadata tài liệu và mở detail.
2. Khi backend readiness và role hợp lệ, chọn đúng một PDF/JPEG/PNG/WebP tối đa 10 MiB.
3. Client validate MIME/extension/signature/size trước prepare.
4. UI lần lượt hiển thị đang chuẩn bị, tải lên, hoàn tất; thành công thành attachment hiện hành.
5. Xem/tải tạo access URL tạm thời on-demand; đóng viewer clear state.

### Replace và version history

1. Chọn Thay tệp và xác nhận bản cũ vẫn được lưu.
2. Tệp mới trở thành phiên bản hiện hành sau finalize.
3. Phiên bản cũ thành archived/history nhưng vẫn private và có thể xem/tải.
4. Stale hoặc failure không làm hỏng current winner.

### Soft removal, request và legal hold

1. Owner/admin xác nhận `Gỡ khỏi tài liệu`.
2. Current chuyển archived/non-primary; object và history không bị xóa; upload slot mở lại.
3. Owner/admin có thể tạo/hủy deletion request.
4. Owner khác requester mới có thể review; manual QA bước này còn deferred do thiếu fixture thứ hai.
5. Owner có thể đặt/gỡ legal hold theo policy; hold không tự xóa hoặc resume execution.

### Boundary deferred

Permanent Storage deletion không có button execution và không được prototype như happy path. State đúng là `chưa khả dụng / cần server executor và lifecycle canonical`.

States bắt buộc: no document, no attachment, backend unavailable, permission denied, invalid file, upload phases, current/history, viewer loading/error, replace confirm/stale/fail, removed, request pending/approved/rejected/cancelled, legal hold active/released, execution unavailable.
