# Responsive and state matrix

## Breakpoint facts và target proposal

`REPO FACT`:

- `html/body` minimum width 320 px.
- Desktop window minimum 420×320; normal restore bounds mặc định 760×520; module mở mặc định maximized.
- CSS có nhiều module breakpoint tại 1180, 980, 820, 780, 760, 700 và 520 px.
- Schedule week grid minimum 1180 px; nhiều table có minimum width 620–1420 px và scroll wrapper.
- Mobile product support hoàn chỉnh không được tài liệu repo chốt.

`ĐỀ XUẤT CẦN DUYỆT` — dùng frame audit đầu tiên:

- 1440×900: desktop chính.
- 1366×768: laptop compact bắt buộc.
- 1280×720: stress test nếu người dùng thực tế có màn hình này.
- 820×1180 và 390×844 chỉ là exploration; không gọi là supported product trước approval.

## Responsive behavior cần bàn giao

| Surface | Desktop | Compact laptop | Hẹp/mobile exploration |
| --- | --- | --- | --- |
| Desktop shortcuts | Grid/list đầy đủ | Giảm gap, giữ label; kiểm taskbar | Chưa chốt product model |
| Normal window | Có thể drag/resize theo bounds hiện tại | Ưu tiên maximize, title/action không clip | Cần technical approval |
| Maximized window | Inset trong desktop, taskbar vẫn khả dụng | Giữ titlebar + content scroll | Chưa chốt |
| Table | Full columns hoặc density comfortable | Horizontal scroll/frozen context; compact density | Card conversion không tự động được duyệt |
| Schedule | 7-day grid | Horizontal scroll + sticky day header | Không tự chuyển thành agenda nếu chưa duyệt |
| Attendance | Spreadsheet | Horizontal/vertical scroll, giữ row/day context | Dedicated mobile nhập liệu chưa chốt |
| Sidebar/section nav | Cột trái | Có thể thành horizontal scroll/tab ở breakpoint | Cần test keyboard/overflow |
| Dialog/form | Center panel hoặc full-window | Fit chiều cao, một content scroll, action không mất | Full-screen exploration |
| Attachment viewer | Overlay chừa taskbar, contain/iframe | Full available area, close luôn thấy | Chưa chốt |
| Taskbar | Window buttons + overflow | Giữ Start/center/notification; tăng overflow | Chưa chốt shell mobile |

## State matrix chung

| State | Visual/interaction requirement | Không được nhầm với |
| --- | --- | --- |
| Default | Label và action rõ, contrast đủ | Placeholder/disabled |
| Hover | Chỉ bổ trợ; không chứa thông tin duy nhất | Focus |
| Focus-visible | Ring/outline rõ, không bị clip | Selected/active |
| Active/pressed | Feedback tức thời | Window active |
| Selected | Chỉ rõ item/filter/tab đang chọn | Hover |
| Disabled | Không tương tác, có reason khi cần | Loading/read-only |
| Read-only | Nội dung xem được, field/action ghi bị khóa | Permission denied |
| Loading | Giữ context, ngăn double-submit khi cần | Disabled vô lý do |
| Success | Xác nhận outcome, state data mới | “Đã gửi request” nếu chưa execute |
| Warning | Rủi ro/điều cần chú ý | Destructive error |
| Error | Nêu lỗi và recovery/retry | Empty |
| Empty | Chưa có dữ liệu + CTA hợp lệ | Filtered empty |
| Filtered empty | Không có kết quả + xóa filter | No data |
| Permission denied | Không render dữ liệu nhạy cảm; nêu quyền cần thiết | Backend unavailable |
| Backend not ready | Capability khóa vì readiness; không fake permission | Permission denied |
| Offline/cache/stale | Nêu nguồn dữ liệu và hạn chế ghi nếu contract có | Loading |
| Destructive confirm | Object + hậu quả + dữ liệu giữ lại + CTA danger | Normal save |
| Archived | Không còn active nhưng lịch sử còn | Removed attachment |
| Removed | Tệp rời current document; object/history vẫn private | Deleted |
| Deferred/unavailable | Nêu capability chưa có và blocker cấp cao | Disabled tạm thời |

## State matrix F23.11 attachment

| Attachment state | CTA hợp lệ | Copy/meaning bắt buộc |
| --- | --- | --- |
| None | Upload nếu role/readiness cho phép | Chưa có tệp |
| Preparing/uploading/finalizing | Current vẫn xem/tải nếu replace; control cạnh tranh disabled | Không fake phần trăm |
| Available current | View, download, replace, soft remove theo quyền | Tệp hiện hành, private |
| Archived/replaced | View/download trong history | Phiên bản cũ được giữ |
| Removed | History view/download, upload slot mở lại | Không phải permanent deletion |
| Request pending review | Cancel theo quyền; review chỉ Owner khác requester | Chưa xóa object |
| Approved/waiting | Hiển thị tách approval/execution | Execution chưa khả dụng |
| Legal hold active | Hold nổi bật, action xung đột bị chặn | Không tự resume khi release |
| Execution unavailable | Không render execute button | Cần server executor và lifecycle canonical |
