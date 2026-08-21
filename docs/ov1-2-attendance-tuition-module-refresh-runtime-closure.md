# OV1.2 Attendance/Tuition module refresh runtime closure

Ngày review: 21/08/2026
Baseline: `main = origin/main = 6ab4a03955b73bda29a3539cd0894cc8155b53ea`

## Kết quả

OV1.2 local QA và independent review: **PASS**.

- CRITICAL: 0
- HIGH: 0
- blocking MEDIUM: 0
- Remote mutation: NO
- Deploy: NO
- Migration change: NO

## Refresh contract đã triển khai

| Module | Bắt buộc khi mở/làm mới | Tùy chọn | Chỉ bắt buộc cho thao tác |
| --- | --- | --- | --- |
| Giáo viên | Core | Attendance, Staff | — |
| Thời khóa biểu | Core | Attendance, Calendar/Notes | — |
| Bảng Điểm Danh | Core, Attendance | Tuition, Calendar/Notes | — |
| Học Phí | Core, Tuition | Attendance, Calendar/Notes | Finance cho thanh toán và số đã thu hiện tại |

Khi phần bắt buộc lỗi, trạng thái mới nhất bị xóa, lỗi hiển thị rõ và thao tác ghi phụ thuộc bị chặn trước mutation. Khi phần tùy chọn lỗi, phần chính vẫn dùng được nhưng projection tùy chọn bị giữ lại, không được trình bày như dữ liệu hiện tại. Health được ràng buộc bằng cả tài khoản và cơ sở; account/center switch xóa state, projection và request boundary cũ trước lần pull mới.

Attendance/Tuition/Finance không còn được bootstrap toàn hệ thống khi đăng nhập hoặc đổi cơ sở. Attendance và Tuition chỉ pull khi module liên quan được mở, mở lại hoặc bấm **Làm mới**; realtime tương ứng chỉ bắt đầu sau targeted pull thành công.

## Runtime safety

- Attendance/Tuition vẫn server-first; cache chỉ thay đổi sau khi RPC commit thành công.
- Required refresh chưa đạt thì draft/form được giữ nguyên và không gửi mutation.
- Idempotency key, version/currentness, exact-center guard và committed-versus-refresh-failed semantics không bị nới lỏng.
- Finance lỗi không chặn xem/sửa gói học phí thông thường, nhưng khóa thanh toán, gia hạn dựa trên số đã thu và hoàn tác kỳ cần đối chiếu.
- Attendance hoặc Calendar/Notes tùy chọn lỗi không tạo số liệu/ghi chú mặc định giả; vùng stale bị ẩn hoặc ghi rõ chưa tải.
- Owner, `center_admin` và alias `admin` tiếp tục dùng cùng đường ghi vận hành; không có approval queue mới.

## Product copy

Các chuỗi kỹ thuật trên luồng Giáo viên/TKB/Bảng Điểm Danh/Học Phí và C5.2 save/refresh đã được thay bằng tiếng Việt vận hành. Thuật ngữ kỹ thuật chỉ còn ở identifier, debug/internal contract hoặc tên migration/test.

## Targeted QA

PASS:

- `node tests/ov1-2-attendance-tuition-module-refresh-closure-smoke.js`
- `node tests/c5-2-attendance-tuition-authoritative-shared-truth-smoke.js`
- `node tests/dreamhome-core-refresh-production-hotfix-smoke.js`
- `node tests/c5-closeout-derived-convergence-smoke.js`
- `node tests/post-c5-core-save-cloud-readiness-smoke.js`
- `node --check` cho toàn bộ JavaScript thay đổi
- `npm run build`
- `git diff --check`

Không chạy runner `c5-2-...-local-db-qa.js`: runner đó thực hiện full local `supabase db reset`, sẽ chạy cả migration P4B frozen. SQL/migration không thay đổi trong OV1.2 và semantic/runtime C5.2 đã PASS, nên reset này không cần thiết và không phù hợp scope.

## Immutable C5.2 closure

- `202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql`
  SHA-256 `3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414`
- `202608140002_c5_2_baseline_singleton_review_hardening.sql`
  SHA-256 `76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7`

Hai migration không đổi byte và chưa được apply remote trong Gate 2.

## Checkpoint

Commit local dự kiến: `Close Operational V1 attendance tuition runtime gaps`
Push/deploy chờ OV1.3 reviewed production apply + deploy.
