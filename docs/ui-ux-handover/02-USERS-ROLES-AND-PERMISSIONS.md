# Users, roles and permissions

## Nguyên tắc chung

`REPO FACT` — login thành công chưa đủ để vào desktop. App còn phải resolve một center membership hợp lệ. Trạng thái thiếu membership, membership inactive/revoked/paused, malformed hoặc center mismatch đều có nhánh deny/fail closed.

`REPO FACT` — generic online access cho phép owner/qtv/center_admin ghi trong scope đã hỗ trợ; teacher/consultant/viewer là read-only ở lớp generic. Tuy nhiên UI theo module còn có policy riêng. Đặc biệt hồ sơ hành chính và tệp nhân sự chỉ cho active owner hoặc active center_admin đúng center.

## Ma trận role sản phẩm

| Role | Trạng thái | Phạm vi dữ liệu | Surface/action chính đã chứng minh | Bị cấm hoặc giới hạn |
| --- | --- | --- | --- | --- |
| `owner` | `IMPLEMENTED` | Center-scoped theo active membership; có thể chuyển giữa các cơ sở mà tài khoản có quyền | Desktop vận hành; quản trị tài khoản/cơ sở ở surface owner; toàn bộ action hồ sơ hành chính; review/legal hold trong F23.11E.2A | Không có quyền platform-wide mặc định; xóa object vĩnh viễn vẫn không khả dụng |
| `center_admin` | `IMPLEMENTED` | Center-scoped, chỉ center đang bind | Module vận hành; xem/sửa hồ sơ hành chính; tạo/sửa/archive/restore tài liệu; upload/replace/view/download/soft-remove; tạo/hủy deletion request; xem audit | Không review/approve/deny request, không quản lý retention/legal hold, không execute deletion |
| `teacher` | `IMPLEMENTED` ở generic access; dedicated scope cần kiểm chứng theo flow | Read-only trong lớp online access hiện tại; dữ liệu phải cùng center | Dữ liệu giảng dạy/ca dạy có renderer trong repo | Không ghi cloud qua generic scope; không được xem metadata hoặc tệp hồ sơ hành chính |
| `consultant` | `IMPLEMENTED` ở generic access; dedicated scope cần kiểm chứng theo flow | Read-only trong lớp online access hiện tại; dữ liệu phải cùng center | Công việc tư vấn/phụ huynh theo module vận hành | Không ghi cloud qua generic scope; không được xem metadata hoặc tệp hồ sơ hành chính |
| `platform_owner/super_admin` | `PLANNED — F23.12` | Platform-wide theo nguồn cấp quyền server-side tương lai | Internal console toàn hệ thống, acting mode có audit/thời hạn là đề bài phase sau | Không được trình bày như role đang tồn tại; không hardcode định danh người dùng phía client |

## Quyền F23.11 theo action

| Nhóm action | Owner | Center admin | Teacher/Consultant |
| --- | --- | --- | --- |
| Xem hồ sơ hành chính | Có | Có | Không |
| Reveal field nhạy cảm | Có | Có | Không |
| Sửa hồ sơ | Có | Có | Không |
| Tạo/sửa/archive/restore tài liệu | Có | Có | Không |
| Upload/replace/view/download tệp private | Có | Có | Không |
| Gỡ mềm khỏi tài liệu | Có | Có | Không |
| Tạo/hủy deletion request | Có | Có | Không |
| Review/approve/deny request | Có, nhưng người review phải khác requester | Không | Không |
| Đặt/gỡ legal hold | Có | Không | Không |
| Permanent object deletion | `DEFERRED` | `DEFERRED` | Không |

## State bắt buộc trong thiết kế

- Signed out.
- Đang kiểm tra auth/membership.
- Signed in nhưng chưa có membership.
- Membership inactive, revoked hoặc paused.
- Membership malformed/unknown role.
- Center mismatch hoặc đang switch center.
- Read-only role.
- Action denied dù surface đang mở.
- Backend/readiness chưa sẵn sàng.
- Dữ liệu local malformed: chuyển read-only/needs review, không âm thầm sửa.

## Role kỹ thuật cần xác nhận

`REPO FACT` — `qtv` và `viewer` có trong generic online access code. Handoff không nâng hai nhãn này thành persona sản phẩm vì repo chưa cung cấp đủ một experience/module matrix riêng cho chúng.

`CẦN DUYỆT` — trước khi mockup dedicated navigation cho `qtv` hoặc `viewer`, hỏi chat kỹ thuật xem đây là role còn dùng, alias chuyển tiếp hay chỉ là compatibility layer.
