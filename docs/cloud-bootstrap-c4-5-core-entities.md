# C4.5 - Cloud Bootstrap Core Entities

## Summary

C4.5 thêm cloud bootstrap guarded cho ba nhóm core: `student`, `teacher`, `schedule_session`.
Khi signed-in, center binding đã sẵn sàng và Supabase đã cấu hình, cloud là source of truth nếu cloud có dữ liệu hợp lệ. localStorage chỉ là cache/fallback.

C4.5 không chạy SQL, không apply SQL patch, không seed cloud, không seed gói 29 lên Supabase và không claim live T/P pass. Tài khoản vẫn được tạo thủ công trong Supabase/Admin tools; app không có đăng ký, không gọi `signUp`.

## Trigger

Bootstrap chỉ chạy khi đủ điều kiện:

```txt
signed-in + center binding ready + cloud configured
```

Runtime guard nằm ở `canRunCloudBootstrap()` và được gọi trước khi pull cloud snapshot. Nếu signed-out, auth loading, thiếu center binding hoặc Supabase chưa cấu hình thì bootstrap không chạy.

## Entities

C4.5 chỉ bootstrap đúng ba entity:

```txt
student
teacher
schedule_session
```

Không bootstrap học phí, điểm danh, thu chi, inventory, parent consulting, staff, session report, Teacher Portal, Super Admin hoặc center selector.

## Data Flow

```txt
login
-> center binding
-> bootstrap cloud snapshot
-> apply local cache
-> render
```

Luồng pull dùng `center_cloud_entities` theo `center_id` hiện tại. `student` và `teacher` dùng helper Cloud DB hiện có. `schedule_session` được đọc cùng bảng bằng entity type `schedule_session`.

## Source Of Truth

Rule runtime của C4.5:

```txt
signed-in + center bound + cloud data exists
-> cloud wins
-> localStorage caches cloud snapshot

cloud unavailable/empty
-> local cache/staging remains fallback
-> UI/status không claim shared online
```

Khi cloud có dữ liệu, app ghi snapshot vào cache local rồi render dashboard/module theo cache vừa nhận từ cloud. localStorage lúc này chỉ là cache của cloud data, không phải source of truth online.

## Empty/Error Behavior

Nếu cloud empty:

- Không xóa local.
- Không seed 29 lên cloud.
- Không overwrite dữ liệu user đã chỉnh.
- Status hiển thị: `Cloud chưa có dữ liệu cho center này. Đang dùng cache/staging local.`

Nếu cloud error/not ready:

- Không crash.
- Không block dashboard nếu user đã signed-in và center binding MVP đã bound.
- Không overwrite local.
- Status hiển thị: `Không thể tải dữ liệu cloud. Đang dùng cache cục bộ.`

## 29 Staging Vs Cloud

Gói 29 học viên từ C4.4 vẫn là staging fallback để test local/offline. Gói này chưa phải shared cloud data nếu cloud chưa có dữ liệu và C4.5 không tự seed gói 29 lên Supabase.

C4.6/C4.7 mới xử lý SQL/apply/live QA và quyết định dữ liệu nào được đưa lên cloud theo runbook có xác nhận.

## Status UI

App shell hiển thị trạng thái nhỏ trên taskbar:

- `Dữ liệu: Đang tải cloud`
- `Dữ liệu: Cloud`
- `Dữ liệu: Cache/staging local`
- `Dữ liệu: Cache cục bộ`

UI này tránh text debug như tên bảng hoặc payload, và chỉ nói rõ nguồn dữ liệu hiện tại.

## Next Phases

```txt
C4.6 - Apply SQL membership/realtime theo runbook, có xác nhận
C4.7 - Live QA: T/P hai tab/hai máy cùng sửa dữ liệu
```

C4.5 không làm C4.6/C4.7 sớm, không claim T/P online live pass.
