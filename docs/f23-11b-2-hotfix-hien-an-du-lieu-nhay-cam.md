# F23.11B.2 - Hotfix Hiện/Ẩn dữ liệu nhạy cảm

Ngày: 2026-07-27  
Phạm vi: interaction privacy trong view-mode Hồ sơ hành chính; không đổi schema/storage, không migration, không cloud write.

## 1. Root cause thực tế

Button `Hiện`/`Ẩn` view-mode đã có đúng `type="button"`, action marker `data-staff-administrative-action="toggle-sensitive"` và canonical field path trong `data-sensitive-field`. Listener cũng đã gọi `preventDefault()` và `stopPropagation()`.

Lỗi nằm ở DOM scope. Button view-mode đồng thời có `data-window-id`, trong khi handler và toggle cùng dùng `button.closest('[data-window-id]')`. Selector này trả về chính button, không phải `.desktop-window` của Hồ sơ hành chính. Reveal `Set` vẫn được toggle trong memory, nhưng query tìm value control lại chạy bên trong button nên không tìm thấy `[data-staff-administrative-sensitive-value]`. Không có rerender sau đó, vì vậy value và wording button không đổi; click kế tiếp lại đảo Set về trạng thái ban đầu.

## 2. Action handler và mapping

F23.11B.2 bind một delegated click handler trên từng OS window `.desktop-window.is-staff-administrative-profile[data-window-id]`. Handler lấy action button bằng `event.target.closest(...)`, còn window identity luôn lấy từ root đã bind. `WeakSet` chống bind trùng trên cùng DOM node; full shell render tạo node mới và bind lại đúng một lần.

Mapping dùng canonical schema hiện có, không dùng label hay array index:

- `identityDocument.number` → số giấy tờ;
- `taxInformation.taxNumber` → mã số thuế;
- `insuranceInformation.socialInsuranceNumber` → số BHXH;
- `insuranceInformation.healthInsuranceNumber` → số BHYT;
- `bankInformation.accountNumber` → số tài khoản;
- `employmentAdministration.contractNumber` → số hợp đồng.

Các tên `taxCode` hay `insuranceNumber` không tồn tại trong schema F23.11B nên không được tạo alias hoặc duplicate field. Value được resolve từ authorized in-memory profile bằng canonical path; không đọc từ DOM attribute.

## 3. Reveal identity và behavior

View state mang `centerId`, `profileId` và `revealedFields: Set<fieldPath>`. Render chỉ chấp nhận Set khi center/profile identity khớp profile hiện tại. Nếu center, staff hoặc profile ID đổi, toàn bộ Set bị xóa trước khi render.

Mỗi click đầu tiên vào `Hiện`:

1. xác nhận current access và đọc lại active membership theo access helper hiện hữu;
2. xác nhận OS window, center và profile identity vẫn khớp;
3. toggle đúng một canonical field path trong một Set mới;
4. resolve raw value từ authorized profile;
5. cập nhật duy nhất text node, wording button và `aria-pressed` tại chỗ.

`Ẩn` mask lại field đó ngay. Các field khác giữ state riêng; không có `Hiện tất cả`. Native button hỗ trợ click, Enter và Space, không submit form.

## 4. Privacy boundary

Khi mask, HTML chỉ có display mask, field path và boolean `aria-pressed`. Full sensitive value không nằm trong `data-*`, `title`, `aria-label`, tooltip, taskbar, window title, toast, error, console, search hay staff list. Khi reveal, raw value chỉ được gán bằng `textContent`; server/user text không được nối thành raw HTML.

Formatter là presentation-only:

- rỗng → `Chưa cập nhật`, không render button;
- chuỗi dài hơn bốn ký tự → `•••• ` + bốn ký tự cuối;
- chuỗi ngắn → `••••`, không lộ toàn bộ chuỗi;
- không cast số, nên số 0 đầu được giữ nguyên.

Edit mode giữ contract F23.11B: owner/admin có thể chỉnh raw string. Hotfix không lưu mask string và không biến input thành numeric.

## 5. Reset và access

Reveal state chỉ ở Map/Set trong memory. Nó không thuộc profile, staff record, localStorage, session storage, URL hay window/taskbar metadata; reveal/hide không gọi save và không tạo audit event.

Set được reset khi:

- save/cancel quay về view;
- close/destroy administrative window;
- reload ứng dụng;
- switch center;
- profile identity hoặc staff identity đổi;
- access không còn owner/center_admin active cùng center;
- membership read thất bại hoặc logout khiến access render fail closed.

Minimize/restore cùng một window instance giữ Set tạm thời. Đóng rồi mở lại luôn mask mặc định.

## 6. Scroll, focus và dữ liệu bất biến

Happy path không gọi full-app `render()`, không thay `innerHTML`, không replace window/section và không thay scrollTop. Handler không dùng timeout, click giả hay `.focus()` workaround. Button hiện tại giữ focus; disclosure/active section và content scroll giữ nguyên.

Reveal/hide không gọi storage save, không tăng `revision`, không đổi `updatedAt`, completion status, profile fields, unknown fields, staff lifecycle, archive state, teacher/account links hay membership IDs. Chỉ mất quyền/identity mismatch mới đi theo fail-closed safety render hoặc mask-all boundary.

## 7. Manual QA status

Manual QA do người kiểm thử cung cấp đã PASS create/edit/reload/persistence/lifecycle compatibility và masking mặc định của F23.11B/B.1. Automated checks của hotfix không tự kết luận interaction Hiện/Ẩn là manual PASS.

Manual QA F23.11B.2 cần xác nhận:

1. Một click `Hiện` reveal đúng field và đổi thành `Ẩn`.
2. Reveal giấy tờ và ngân hàng độc lập; ẩn một field không ảnh hưởng field kia.
3. Button hoạt động bằng Enter/Space, không submit và không jump scroll.
4. Đóng/mở lại, Ctrl+F5, switch center hoặc mất quyền đều mask lại.
5. Đối chiếu profile trước/sau: một record, revision/updatedAt/completion và mọi liên kết không đổi; số 0 đầu còn nguyên.

## 8. Verification và roadmap

Verification gồm F23.11B/B.1/B.2, F23.10 regressions, role/membership, focus/caret/scroll, window/taskbar, sensitive logging, no-binary, public-secret, mojibake, build, docs markers và `git diff --check`.

Sau manual PASS mới chốt F23.11B DONE và chuyển F23.11C về danh mục tài liệu, hạn hiệu lực và attachment private-ready. Hotfix này không bắt đầu F23.11C.
