# C4.5.1 - Taskbar Overflow / Minimized Modules Polish

## Summary

C4.5.1 là polish nhỏ cho app shell/taskbar trước C4.6 SQL. Phase này không làm SQL, không apply SQL patch, không seed cloud, không thêm cloud bootstrap mới và không đổi dữ liệu nghiệp vụ.

Mục tiêu là khi người dùng mở nhiều module hoặc thu nhỏ module bằng nút `-`, taskbar có nút overflow `^` để xem nhanh các module đang mở/đã thu nhỏ.

## Behavior

- Overflow button: taskbar hiển thị nút `^` khi có ít nhất một cửa sổ/module đang mở.
- Popover list: popover tối liệt kê các module/window còn lại khi taskbar gom bớt module.
- Minimized modules: item trong popover có trạng thái `Đã thu nhỏ`; module đang hiện có trạng thái `Đang mở`.
- Restore/focus: click item gọi lại flow taskbar window hiện có, restore nếu đang thu nhỏ và bring-to-front nếu đang mở.
- Click outside closes: click ngoài popover và ngoài nút `^` đóng popover.
- Opening module closes popover: mở module từ desktop grid, Start menu hoặc popover đều đóng taskbar overflow.

## Scope Boundaries

C4.5.1 không làm:

- C4.6 SQL hoặc apply SQL.
- C4.7 live QA T/P.
- Cloud bootstrap mới.
- Data change hoặc Supabase data change.
- Teacher Portal.
- Super Admin.
- Center selector.
- Role matrix.
- Đăng ký hoặc `signUp`.

Start menu C4.4 vẫn giữ click-outside close và đóng khi mở module. Notification dropdown vẫn giữ outside-click behavior riêng.

## Next Phase

```txt
C4.6A - SQL / Realtime preflight, không apply nếu chưa xác nhận
```
