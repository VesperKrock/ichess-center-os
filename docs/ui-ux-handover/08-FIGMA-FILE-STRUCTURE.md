# Figma file structure — hướng dẫn cho người mới

## Pages đề xuất

Tạo đúng thứ tự:

```text
00 — Cover & Read Me
01 — Foundations
02 — Components
03 — Desktop Shell
04 — Admin Core Flows
05 — Data-heavy Modules
06 — Staff & HR
07 — States & Responsive
08 — Prototype
09 — Dev Handoff
99 — Archive
```

Không cần gói trả phí hoặc plugin để tạo cấu trúc này.

## Thuật ngữ Figma, giải thích ngắn

| Thuật ngữ | Hiểu đơn giản |
| --- | --- |
| Page | Một trang lớn trong file, giống chương của tài liệu |
| Section | Vùng có nhãn để gom nhiều frame cùng chủ đề trên một Page |
| Frame | Khung có kích thước, layout và behavior; dùng cho screen/component |
| Layer | Một đối tượng trong cây bên trái: text, shape, frame, icon… |
| Group | Gom layer để di chuyển; không có layout mạnh như Frame |
| Auto Layout | Cơ chế tự xếp item theo hàng/cột, gap, padding và resize |
| Component | Mẫu gốc có thể tái sử dụng, ví dụ Button |
| Instance | Bản dùng của Component; cập nhật theo mẫu nhưng vẫn đổi property cho phép |
| Variant | Các trạng thái/kiểu của cùng component, ví dụ default/hover/disabled |
| Constraint | Quy tắc layer bám trái/phải/giữa khi Frame đổi kích thước |
| Variable | Giá trị có tên dùng lại cho màu, spacing, radius hoặc mode |
| Style | Preset dùng lại cho text, color/effect; dùng khi Variable chưa phù hợp |
| Prototype connection | Dây nối interaction giữa frame/overlay để mô phỏng flow |
| Dev Mode | Chế độ đọc spec cho developer; không thay thế acceptance criteria |

## Naming convention

Screen/frame:

```text
Page / Feature / Screen / State / Breakpoint
03 Desktop Shell / Shell / Desktop / Multi Window / 1440
06 Staff & HR / Administrative Profile / Detail / Permission Denied / 1366
```

Component:

```text
Component / Category / Name / Variant
Component / Actions / Button / Primary
Component / Feedback / Inline Message / Error
Component / Data Display / Status Badge / Removed
```

Layer nên dùng tên có nghĩa: `Header`, `Title`, `Actions`, `Filter/Search`, `Table/Body`; tránh `Frame 423`, `Rectangle 19` ở bản handoff.

## Cấu trúc mỗi Page

- Một Section `README` ở đầu ghi mục tiêu và status.
- Các Section theo feature/flow, không xếp frame rải rác.
- Mỗi screen có frame normal, các state liên quan đặt ngay bên phải.
- Prototype frame đã duyệt nằm ở Page 08; bản khám phá không nối vào flow chính.
- Page 99 giữ exploration bị loại, có ngày và reason; không xóa evidence review.

## Quy trình tạo component

1. Vẽ một screen đại diện bằng Auto Layout cơ bản.
2. Khi cùng pattern lặp từ 2–3 lần, tách thành Component.
3. Tạo Variant chỉ cho state thật sự cần bàn giao.
4. Dùng Instance trong screen; không copy-paste detached hàng loạt.
5. Ghi role/state/content constraint cạnh component.

## Bài tập Figma đầu tiên

Sau khi tạo Pages, chỉ tạo trên `00 — Cover & Read Me`:

- một Frame desktop trống;
- title `iChess Center OS — UI Redesign`;
- subtitle `UI/UX audit in progress`;
- một text block ghi owner thiết kế, ngày và link tới handoff repo.

Dừng, gửi screenshot và chờ duyệt trước khi tạo color styles hoặc component.
