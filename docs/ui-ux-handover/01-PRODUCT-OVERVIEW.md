# Product overview

## Sản phẩm là gì

`REPO FACT` — iChess Center OS là ứng dụng vận hành cơ sở cờ vua trên web, tổ chức như một desktop OS thay vì một dashboard tuyến tính. Sau login và bind cơ sở, người dùng mở module từ desktop hoặc Start; mỗi module chạy trong window có titlebar, minimize, maximize, close, focus/z-index và taskbar.

Sản phẩm hiện có dữ liệu, form, table, lịch, detail panel, notification và nhiều luồng ghi nhận vận hành. Đây là sản phẩm đang hoạt động, không phải concept trống.

## Người dùng và trọng tâm hiện tại

`REPO FACT` — nhóm role chính thấy trong repo gồm owner, center admin, teacher và consultant. Thiết kế ưu tiên trước cho người quản lý cơ sở vì các module vận hành, tài chính, nhân sự và cấu hình tập trung ở vai trò này. Chi tiết quyền nằm trong `02-USERS-ROLES-AND-PERMISSIONS.md`.

`REPO FACT` — repo phân biệt:

- môi trường staging/test mang tên DreamHome staging;
- cơ sở production mang tên DreamHome;
- dữ liệu local/cache được namespace theo center;
- center hiện tại được resolve từ membership của tài khoản, không chỉ từ tên hiển thị.

Không dùng center ID kỹ thuật làm yếu tố nhận diện thị giác nếu người dùng không cần thấy nó.

## Mục tiêu thương mại

`REPO FACT` — kiến trúc center-scoped, danh sách cơ sở, membership và namespace dữ liệu cho thấy sản phẩm được chuẩn bị để vận hành nhiều cơ sở, không khóa vào một dataset duy nhất.

`ĐỀ XUẤT` — UI redesign nên giúp một bộ sản phẩm có thể nhân bản thương hiệu nhẹ theo cơ sở mà không tạo một design system khác cho mỗi nơi. Logo/banner hoặc accent theo cơ sở có thể là layer tùy biến; information architecture, component semantics và accessibility nên dùng chung.

## Center-scoped và platform-wide

- `IMPLEMENTED` — dữ liệu nghiệp vụ và quyền hiện tại chủ yếu gắn với cơ sở đang bind. Membership phải active và đúng center; cache/local storage tách namespace theo center.
- `IMPLEMENTED` — owner hiện tại vẫn là role membership trong phạm vi cơ sở; một người có thể có membership ở nhiều cơ sở nhưng điều đó không tự biến role thành quyền platform toàn cục.
- `PLANNED` — `platform_owner/super_admin` là phase F23.12, chưa triển khai. Không thiết kế role này như capability hiện có.

## Trạng thái F23.11

`QA FACT` — F23.11 đã chốt DONE cho hồ sơ hành chính nhân viên, tài liệu nhân sự và attachment private. Soft removal, deletion request, review và legal hold thuộc F23.11E.2A đã DONE. Phê duyệt thủ công bằng Owner thứ hai chưa có fixture nên vẫn deferred trong manual QA. Permanent Storage deletion thuộc F23.11E.2B là LATER vì cần server-side executor được duyệt và employment lifecycle canonical.

`CẦN SCREENSHOT` — chưa có ảnh ứng dụng trong handoff này. Mọi kết luận về bố cục nhìn thấy, chất lượng hierarchy, độ tương phản cảm nhận, clipping hoặc cảm giác sử dụng phải chờ screenshot app thật.
