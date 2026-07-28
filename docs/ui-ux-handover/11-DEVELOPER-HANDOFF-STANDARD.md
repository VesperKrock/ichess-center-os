# Developer handoff standard for CodeX

## Nguyên tắc

Không bàn giao chỉ bằng screenshot. Mỗi screen phải có frame, component/state spec, responsive behavior, role/data assumptions và acceptance criteria. Link prototype chỉ mô tả intended interaction; chat kỹ thuật vẫn audit feasibility trước implementation.

## Phân loại thay đổi

| Loại | Ví dụ | Quy trình |
| --- | --- | --- |
| `Visual-only` | Token, spacing, typography, icon, alignment không đổi semantics | Có thể vào technical audit trực tiếp |
| `Interaction change` | Sticky toolbar, table keyboard behavior, dialog → drawer, window lifecycle | Technical review trước CodeX |
| `Business-flow proposal` | Bỏ bước confirm, đổi quyền, thêm action, đổi source of truth | Quay về chat kỹ thuật và product approval |

Mỗi frame/spec phải gắn một trong ba nhãn trên.

## Checklist mỗi screen

- Frame name theo convention.
- Breakpoint/frame size và browser zoom assumption.
- Component references và variant names.
- Auto Layout direction, padding, gap, min/max/fixed dimensions.
- Typography token; line-height; truncation/wrap rule.
- Color/variable names, border, radius, elevation.
- Icon source/name/size và accessible label.
- Interaction trigger, keyboard behavior, focus destination, overlay close rules.
- Default/hover/focus/active/selected/disabled/loading/success/warning/error/empty.
- Copy chính xác bằng tiếng Việt; không để lorem ipsum trong handoff cuối.
- Data assumptions, max/min/long content và fixture marker.
- Role visibility/action permission.
- Center/access/readiness/stale behavior.
- Responsive reflow, overflow, sticky/frozen regions.
- Analytics/audit/privacy effect nếu có.
- Acceptance criteria quan sát được.
- Open question hoặc dependency.

## Template copyable

```markdown
# SCREEN SPEC

## Identity
- Frame: Page / Feature / Screen / State / Breakpoint
- Change type: Visual-only | Interaction change | Business-flow proposal
- Status: Draft | Ready for technical audit | Approved
- Figma link:
- Breakpoint/frame:

## Purpose and entry
- User goal:
- Entry point:
- Exit/success destination:

## Roles and data
- Visible roles:
- Allowed actions by role:
- Center scope:
- Data source assumptions:
- Fixture note: DỮ LIỆU GIẢ

## Layout
- Shell/window state:
- Grid/Auto Layout:
- Padding/gap:
- Fixed/min/max dimensions:
- Scroll/overflow/sticky behavior:

## Components
- Component / variant / properties:
- Typography variables:
- Color/effect variables:
- Icons:

## Interaction
- Pointer:
- Keyboard/focus:
- Loading/double-submit:
- Confirmation/close/backdrop/Escape:

## States
- Default:
- Empty / filtered empty:
- Loading:
- Success:
- Warning / error / stale:
- Permission denied:
- Backend unavailable:
- Archived / removed / deferred:

## Responsive
- 1440×900:
- 1366×768:
- Narrow exploration, if approved:

## Copy
- Title:
- Labels:
- Help/error/confirmation/success:

## Acceptance criteria
1.
2.
3.

## Technical review questions
-
```

## Acceptance criteria tốt

Viết theo outcome có thể test:

- “Ở 1366×768, titlebar, primary action và taskbar luôn nhìn thấy; table cuộn ngang trong wrapper, không làm body page cuộn.”
- “Teacher/consultant không nhận metadata hồ sơ hành chính trong DOM, không chỉ bị ẩn bằng CSS.”
- “Sau soft removal, badge là `Đã gỡ`, history vẫn có View/Download và slot upload trở lại.”

Tránh câu mơ hồ như “giao diện hiện đại”, “responsive tốt” hoặc “animation mượt” nếu không có tiêu chí đo/quan sát.

## Package giao CodeX

1. Link đúng version/branch Figma đã duyệt.
2. Danh sách frame ready, không trộn exploration.
3. Variables/components đã publish trong chính file nếu chưa cần library riêng.
4. Screen specs và acceptance criteria.
5. Asset export hợp lệ, license/source rõ.
6. Change classification và quyết định Gate A/B/C.
7. Danh sách interaction/business proposals chưa duyệt được loại khỏi implementation scope.
