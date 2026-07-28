# Open questions and approval gates

## Gate A — Visual direction

Đầu ra:

- 2–3 directions;
- representative desktop shell;
- typography set cho tiếng Việt;
- palette draft và surface hierarchy;
- component mood cho button/table/form/window.

Điều kiện qua gate: người dùng/anh Hải chọn một direction, nêu rõ phần giữ/lấy từ direction khác và chốt dark-only hay light/dark. Chưa qua Gate A thì không nhân mockup toàn module.

## Gate B — System validation

Đầu ra tối thiểu:

1. Desktop shell với Start, multi-window và taskbar.
2. Một data-heavy table ở 1440×900 và 1366×768.
3. Một detailed profile/form có loading/error/permission/long-content.
4. Component states và responsive/overflow spec.

Điều kiện qua gate: chat kỹ thuật xác nhận không phá shell, focus/scroll, role, center hoặc source-of-truth; user xác nhận hierarchy/density/copy dùng được.

## Gate C — Full mockup and handoff

Đầu ra:

- approved component system;
- P0 flows và state matrix;
- prototype có scope rõ;
- developer specs/acceptance criteria;
- asset export/source;
- danh sách known gaps và decisions.

Điều kiện qua gate: mọi frame implement có nhãn Ready, business proposal chưa duyệt bị loại, CodeX nhận đủ spec ngoài screenshot.

## Open questions — không tự trả lời thay người duyệt

| Câu hỏi | Người chốt | Gate |
| --- | --- | --- |
| Dark-only hay light/dark? | User/anh Hải + technical cost audit | A |
| Giữ biểu tượng desktop OS mạnh đến mức nào? | User/anh Hải | A |
| Brand iChess/DreamHome cần cảm xúc gì? | User/anh Hải | A |
| Logo, font và asset nào đã được phép dùng? | User/anh Hải | A |
| Primary target resolution/zoom/môi trường máy? | User + quan sát thực tế | A/B |
| Mobile/tablet có thuộc scope phát hành hay chỉ exploration? | Product + technical | A |
| P0 module nào được làm trước ngoài shell? | User/anh Hải | A |
| Ai là người duyệt cuối khi ý kiến khác nhau? | User/anh Hải | A |
| Có bao nhiêu vòng chỉnh sửa cho từng gate? | User/anh Hải | A |
| Prototype cần click-through, keyboard hay usability test mức nào? | User/anh Hải | B |
| Có cần design file riêng cho mỗi cơ sở? | Product/design system | B |
| Density mặc định và có cần density switch không? | User + technical | B |
| Motion/reduced-motion scope? | User + technical | B |
| Có xử lý known viewer scroll issue trong redesign implementation không? | Technical/product | B/C |

## Approval log template

```text
Gate:
Ngày:
Người duyệt:
Figma version/link:
Đã duyệt:
Không duyệt:
Điều kiện kèm theo:
Business/interaction proposal cần technical review:
Next action:
```

## Boundary roadmap

- F23.11E.2A: DONE cho soft removal, deletion request, review và legal hold.
- Manual approval bằng Owner thứ hai: QA deferred do chưa có fixture phù hợp.
- F23.11E.2B: LATER; không mockup execution khả dụng.
- F23.12: NEXT design cho role platform-wide và hỗ trợ xuyên cơ sở; không nhập vào scope UI hiện tại trước approval.
