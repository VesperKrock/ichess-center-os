# Design system brief

## Mục tiêu cảm xúc thương hiệu

`ĐỀ XUẤT CẦN DUYỆT` — đáng tin cậy, tập trung, hiện đại, có chất “hệ điều hành vận hành”, nhưng không lạnh lẽo hoặc giống công cụ kỹ thuật. Người quản lý phải scan được dữ liệu nhanh; state nhạy cảm/destructive phải bình tĩnh và rõ hậu quả.

## Current implementation facts

- Dark-only implementation chính: background gần đen, surface navy/charcoal, text trắng xanh, accent xanh.
- Font stack ưu tiên Inter/system UI; tiếng Việt có dấu xuất hiện dày.
- Shell dùng radius 6–8 px, border alpha và elevation tối.
- Window chrome, taskbar, Start, notification, module shortcut là component nền tảng.
- Module có nhiều table, filter, stat card, form panel, detail/modal, status badge và empty/error state nhưng token/style hiện phân tán trong CSS lớn.
- Repo có designer hooks và image slots cho center brand/module visual, hiện nhiều slot có kích thước 0 hoặc placeholder.

## Candidate visual directions

Không chốt palette cuối ở đây. Gate A tạo 2–3 direction trên cùng một bộ representative screens:

1. `Refined Dark OS` — giữ dark character, tăng phân cấp surface, giảm số alpha gần nhau, dùng accent có kiểm soát.
2. `Adaptive Light/Dark` — cùng semantic tokens cho hai mode; chỉ theo đuổi nếu user duyệt scope và technical audit xác nhận chi phí.
3. `Branded Operations` — dark neutral làm nền, center brand/logo/illustration xuất hiện có giới hạn ở desktop/empty state, không chen vào table density.

Mỗi direction chỉ cần desktop shell, một data table và một profile/detail screen; chưa nhân toàn module.

## Foundations cần định nghĩa

### Typography

- Font phải hỗ trợ đầy đủ tiếng Việt.
- Tối thiểu có: Display/desktop label, Window title, Screen title, Section heading, Body, Small/meta, Table header/cell, Label/help/error.
- Test label dài và number alignment; financial/table number dùng tabular figures nếu font hỗ trợ.
- Không dùng uppercase cho câu dài tiếng Việt.

### Spacing

`ĐỀ XUẤT` — thử base 4 px với scale `4, 8, 12, 16, 20, 24, 32, 40`. Gate B kiểm tra trong table compact, form và window body trước khi khóa.

### Radius/elevation/border

- Tạo token theo layer: control, card/panel, window, overlay.
- Active window phải phân biệt được với inactive mà không chỉ dựa vào shadow tinh tế.
- Border phải còn thấy ở display tương phản thấp; divider không thay vai trò của spacing.

### Focus và accessibility

- Focus-visible tối thiểu tương phản và không bị clipping bởi overflow.
- Status không chỉ dùng màu: kèm icon/text.
- Disabled khác loading; read-only khác permission denied.
- Target action quan trọng nên hướng tới tối thiểu 40–44 px nếu layout cho phép, nhưng phải technical review trước khi đổi table density.

### Semantic colors

Định nghĩa token, chưa chốt hex cuối: `accent`, `info`, `success`, `warning`, `danger`, `neutral`, `focus`, `selected`, `disabled`, `surface`, `border`, `text`. Warning và danger phải đủ khác nhau trong dark/light candidate.

## Component inventory

- App shell, desktop shortcut, Start menu, taskbar item/overflow, center chip, clock.
- Window, titlebar, window control, module notification bell.
- Button: primary/secondary/tertiary/danger/icon; all interaction states.
- Field: input/select/textarea/date/checkbox/radio/file; help/error/read-only/disabled.
- Search/filter bar, filter chip, period/week navigation.
- Table: header, sortable header, row, cell variants, sticky region, empty/error/loading row, pagination/load more if flow có.
- Calendar/day column/session/activity card/legend/tag/conflict.
- Stat card, status badge, alert/inline message/toast.
- Dialog, side panel/full-window form, confirmation, backdrop.
- Profile hero, section nav, data field, sensitive mask/reveal.
- Attachment picker/current/history/viewer/removed/request/legal-hold/unavailable.
- Empty state, skeleton/loading, permission denied, backend unavailable, stale/needs review.

## Window chrome và taskbar

Giữ title, notification và ba control window. Cần variant active/inactive/maximized/normal/minimized-taskbar. Taskbar phải chịu được tên tiếng Việt dài, nhiều window, overflow và center name dài.

## Table density

Gate B thử ít nhất hai density:

- `Comfortable` cho review/detail và laptop rộng.
- `Compact` cho attendance/financial/staff list.

Không giảm font/target đến mức mất khả năng đọc hoặc dùng keyboard. Sticky/frozen behavior phải có spec, không chỉ hình.

## Decision required from user/anh Hải

- Dark-only hay light/dark.
- Giữ desktop OS mạnh đến đâu.
- Direction thương hiệu, logo và asset hợp lệ.
- Density mặc định.
- Primary resolution và browser zoom.
- Motion level và reduced-motion behavior.

## Gate A

Tạo 2–3 direction, chỉ trên representative desktop shell + table + profile. Trình bày typography, palette draft, surface hierarchy và component mood. Chỉ sau khi user/anh Hải chọn một direction mới xây foundations/components đầy đủ.
