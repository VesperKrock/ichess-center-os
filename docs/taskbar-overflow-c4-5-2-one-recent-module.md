# C4.5.2 - Taskbar Overflow One Recent Module Hotfix

## Summary

C4.5.2 sửa UX taskbar overflow sau C4.5.1. Taskbar chỉ hiện 1 module gần nhất/active gần nhất, còn overflow `^` chứa các module còn lại đang mở hoặc đã thu nhỏ.

Phase này không làm SQL, không apply SQL patch, không seed cloud, không thêm cloud bootstrap mới và không đổi dữ liệu.

## Before / After

Before:

```txt
Taskbar có thể hiện nhiều module trực tiếp: Thu chi | Sổ quỹ | ^
```

After:

```txt
Taskbar chỉ hiện module gần nhất: Sổ quỹ | ^
Các module khác nằm trong overflow.
```

Nếu chỉ có 0 hoặc 1 module đang mở thì taskbar không cần hiện overflow.

## Behavior

- Visible module button: taskbar chỉ render tối đa 1 window button trực tiếp.
- Recent/active module: module trực tiếp là window có `zIndex` cao nhất, tức module vừa mở, vừa focus hoặc vừa restore gần nhất.
- Overflow list: overflow chứa các window còn lại, gồm cả module đang mở và module đã thu nhỏ.
- Restore/focus: click item trong overflow dùng flow taskbar hiện có để restore nếu minimized và bring-to-front nếu đang mở.
- Click outside close: click ngoài popover và ngoài nút `^` đóng overflow.
- Close on module open: mở module từ desktop grid, Start menu, taskbar hoặc overflow đều đóng overflow.

## Scope Safety

C4.5.2 không làm:

- C4.6 SQL hoặc apply SQL.
- C4.7 live QA.
- Cloud bootstrap mới.
- Data change hoặc Supabase data change.
- Teacher Portal.
- Super Admin.
- Center selector.
- Role matrix.
- Đăng ký hoặc `signUp`.

Start menu C4.4 và notification outside-click behavior vẫn được giữ nguyên.

## Next Phase

```txt
C4.6A - SQL / Realtime preflight, không apply nếu chưa xác nhận
```
