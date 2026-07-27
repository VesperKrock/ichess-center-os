# F23.10E.1 - Lifecycle modal interaction hotfix

## Phạm vi

Hotfix chỉ sửa tương tác của modal vòng đời nằm trên form `Sửa hồ sơ nhân viên`. Không thay đổi dữ liệu vòng đời, trạng thái hiện tại, lịch sử, liên kết Giáo viên hoặc liên kết tài khoản.

## Root cause

- Mỗi `change` của select, radio, checkbox và date input đều gọi `render()` toàn ứng dụng. Node input vừa nhận native click bị thay thế ngay trong cùng interaction, nên click từ label hoặc click sau khi rời field text có thể chỉ đổi focus và cần thao tác lần hai.
- Một deferred render đã được yêu cầu trong lúc sửa text chưa được đánh dấu là đã hoàn thành khi một render trực tiếp diễn ra. Nó có thể chạy muộn và thay DOM thêm lần nữa.
- `.staff-form` và `.staff-lifecycle-window` là hai scroll container thật nhưng chưa có trong danh sách giữ scroll. Open, close, validation và stale render vì thế làm mất `scrollTop` của modal cha.

## Cách sửa

- Radio và checkbox dùng input native với `id`, label dùng `for`; ba radio dùng chung `name`. Select/date tiếp tục dùng native `change`, textarea dùng `input`. Space giữ native toggle; Enter trên radio/checkbox chỉ bị chặn khỏi implicit submit và không phát click thay thế.
- Field handler chỉ cập nhật draft state, preview và lỗi liên quan ngay trên DOM hiện tại. Handler không gọi full render, không chặn default, không toggle `checked` thủ công và không phát click giả.
- Một render trực tiếp đánh dấu deferred render cũ là đã được đáp ứng, tránh render muộn sau focus transition.
- Hai scroll container được giữ theo `data-preserve-scroll-key` gồm center ID, staff ID và modal mode. Scroll restore hiện có dùng key này qua open, close, cancel, validation và stale error; focus vẫn dùng `focus({ preventScroll: true })`.
- `overscroll-behavior: contain` ngăn child modal truyền phần wheel dư sang modal cha hoặc toàn cửa sổ.

## Invariants

- Hotfix không ghi storage khi đổi control hoặc mở/đóng modal.
- Save vẫn đi qua current-center, latest-record, stale-history và double-submit guards của F23.10E.
- Không reactivate Nhân viên, không append lifecycle event, không đổi Teacher/account/link ngoài submit hợp lệ đã có.
- Validation/stale render dựng lại đúng draft hiện tại và giữ vị trí cuộn; native keyboard Space cho radio/checkbox và native select keyboard không bị override.

## Manual QA

1. Cuộn form sửa GV001 đến card vòng đời, focus một field text, mở `Xử lý nghỉ việc`; xác nhận modal cha giữ nguyên vị trí.
2. Click label và chính input của từng radio/checkbox; xác nhận click đầu đổi trạng thái. Dùng Tab rồi Space với radio/checkbox và keyboard với select.
3. Đổi status/date; xác nhận preview đổi tại chỗ, focus không mất và modal không nhảy.
4. Cuộn modal cha và modal con đến hai vị trí khác nhau; thử close, cancel, validation lỗi và stale error; xác nhận modal cha không nhảy đầu/cuối.
5. Đóng child modal rồi tiếp tục nhập form cha; xác nhận caret, dropdown và một-scroll chính vẫn bình thường.
6. Xác nhận record GV001 vẫn `terminated`, lifecycle history không có event mới, Teacher vẫn giữ trạng thái cũ và các link/account ID không đổi trước khi thực hiện một submit hợp lệ mới.

## Automated coverage

`tests/f23-10e-1-hotfix-scroll-jump-va-first-click-lifecycle-modal-smoke.js` khóa native markup, field-handler boundary, keyed scroll restoration, deferred-render completion và các invariant không dùng interaction hack.
