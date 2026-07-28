# Current app architecture for designers

## Mental model

```text
Login gate
→ resolve active center membership
→ desktop workspace
→ mở module từ desktop hoặc Start
→ module chạy trong window
→ taskbar quản lý window + center + notification
```

## Shell đã triển khai

`REPO FACT`:

- Login gate có email/tài khoản, mật khẩu, busy state, lỗi cấu hình, access denied và logout.
- Desktop có module shortcut ở dạng grid/list và thứ tự shortcut được lưu.
- Start menu có về desktop, đổi grid/list, logout và danh sách module.
- Module window có titlebar, notification theo module, minimize, maximize/restore và close.
- Mở lại cùng một module sẽ focus window đang có thay vì tạo duplicate module window.
- Nhiều window có z-index/focus; taskbar có active/minimized state và overflow cho window dư.
- Taskbar có Start, tên app, center indicator/popover, window buttons, view mode, notification và clock.
- Notification center có unread/read filter, badge theo module và action mở module nguồn.
- Hồ sơ hành chính mở thành child window riêng gắn với một staff member.

## Module routing và lifecycle

Module public được mở qua launcher trong desktop hoặc Start, không phụ thuộc một URL riêng cho từng screen. Trạng thái list/form/detail chủ yếu nằm trong runtime state của module; close window dọn state liên quan. Center switch hoặc access loss phải đóng/clear state nhạy cảm.

`REPO FACT` — window mới được tạo với restore bounds `760 × 520` nhưng mặc định ở trạng thái maximized; window CSS có minimum `420 × 320`. Maximized window inset 10 px trong desktop area. Đây là implementation fact, không phải target breakpoint cuối cùng của redesign.

## Local và cloud responsibilities

| Dữ liệu | Trách nhiệm hiện tại |
| --- | --- |
| Auth, membership, center binding | Cloud/Supabase; desktop chỉ mở khi binding sẵn sàng |
| Student, teacher, schedule session core | Khi cloud có dữ liệu hợp lệ, cloud thắng; localStorage là cache/fallback |
| Nhiều module vận hành khác | Vẫn có local/center-scoped storage và các bridge riêng; không giả định tất cả đã cloud-first |
| Hồ sơ hành chính, catalog tài liệu, audit/retention request local-safe | Local storage center-scoped với integrity/fail-closed guards |
| Attachment metadata và lifecycle tệp nhân sự | Supabase private backend là source of truth |
| Signed access URL | Chỉ tạo on-demand, TTL ngắn, giữ trong memory và clear khi đóng/hết hạn |

Không đưa source-of-truth assumptions khác vào mockup nếu chưa audit module tương ứng.

## Laptop/desktop constraints

`REPO FACT` — app khóa body overflow và tạo scroll bên trong desktop/window/module. Nhiều bảng có `min-width` từ khoảng 620 đến 1420 px và wrapper overflow. Schedule week grid có minimum 1180 px. CSS có breakpoint module ở 1180, 980, 820, 780, 760, 700 và 520 px; `html/body` chỉ có minimum 320 px.

`CẦN SCREENSHOT` — mức usable thực tế ở laptop 1366×768, browser zoom, taskbar clipping, nested scroll và modal fit chưa được chứng minh chỉ từ CSS.

## What the designer may change

- Typography, spacing, radius, elevation, border, icon và màu trong cùng semantic.
- Visual hierarchy và grouping trong một flow giữ nguyên.
- Component consistency giữa table, filter, form, dialog và empty state.
- Cách trình bày responsive/compact miễn vẫn bảo toàn content/action/state.
- Vị trí decorative/brand assets qua các designer hooks đã có.

## What the designer must preserve

- Login → center bind → desktop gate.
- Start/taskbar/window semantics và khả năng multi-window.
- Center indicator và center isolation.
- Role/action visibility, masking/reveal và fail-closed states.
- Private attachment boundary, confirmation, history và soft-removal semantics.
- Loading, error, empty, stale, permission denied và backend unavailable.
- Vietnamese copy không bị cắt mất nghĩa.

## What requires technical approval

- Đổi navigation model hoặc bỏ desktop OS.
- Cho một window/module có nhiều instance mới.
- Đổi modal thành route hoặc ngược lại.
- Merge source of truth, đồng bộ cloud mới hoặc thay local persistence.
- Thay role/action, destructive flow, confirmation hay audit requirement.
- Thêm mobile product scope, offline write behavior hoặc permanent deletion.
