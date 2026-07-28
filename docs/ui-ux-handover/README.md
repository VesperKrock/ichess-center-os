# UI/UX & Figma handoff — iChess Center OS

Ngày chốt: 2026-07-29
Trạng thái: sẵn sàng để audit UI/UX trên ảnh chụp ứng dụng thật; chưa chốt visual direction cuối.

## Bắt đầu ở đâu

Gửi [00-NEW-GPT-START-HERE.md](00-NEW-GPT-START-HERE.md) cho New Chat GPT trước tiên. New GPT phải đọc toàn bộ thư mục này trước khi hướng dẫn Figma hoặc đưa ra quyết định thiết kế.

Thứ tự đọc khuyến nghị:

1. `00` — vai trò, cách cộng tác và prompt copy-paste.
2. `01`–`05` — sản phẩm, quyền, kiến trúc, màn hình và luồng thật.
3. `06`–`07` — audit có căn cứ và các bất biến không được phá.
4. `08`–`10` — cách tổ chức Figma, brief design system, responsive và state.
5. `11`–`13` — tiêu chuẩn bàn giao, checklist ảnh và các cổng duyệt.
6. `14` — bản đồ nguồn repo để kiểm chứng fact.

## Cách đọc trạng thái thông tin

- `REPO FACT`: đã kiểm chứng từ source, CSS, test hoặc docs canonical trong repo.
- `QA FACT`: kết quả manual QA được cung cấp trong checkpoint F23.11.
- `CẦN SCREENSHOT`: repo chưa chứng minh được trải nghiệm thị giác thực tế; phải xem ảnh app đang chạy.
- `ĐỀ XUẤT`: hướng khám phá thiết kế, chưa phải quyết định sản phẩm.
- `PLANNED` hoặc `DEFERRED`: chưa được trình bày như capability đang dùng được.

Không được đổi nghiệp vụ, quyền, phạm vi dữ liệu hoặc security boundary để làm UI đẹp hơn.

## Workflow bàn giao

```text
New Chat GPT thiết kế
→ người dùng và anh Hải duyệt
→ chat kỹ thuật audit tính khả thi
→ CodeX triển khai
→ manual QA
```

Figma là nguồn mô tả thiết kế, không tự trở thành bằng chứng rằng runtime đã hỗ trợ một interaction. Mọi thay đổi luồng hoặc quyền phải quay lại chat kỹ thuật trước khi giao CodeX.

## Phạm vi bảo mật

Bộ tài liệu này chỉ dùng dữ liệu giả khi cần minh họa. Không chụp hoặc ghi vào Figma mật khẩu, token, khóa API, URL truy cập tạm thời, đường dẫn object riêng tư, định danh nhân sự nhạy cảm hoặc dữ liệu thật không cần thiết. Các surface nội bộ ngoài phạm vi công khai đã được loại khỏi handoff.
