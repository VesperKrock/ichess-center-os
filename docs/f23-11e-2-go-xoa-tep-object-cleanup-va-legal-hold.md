# F23.11E.2 — Gỡ mềm, deletion request, review và legal hold

Ngày chốt canonical: 2026-07-29

## Trạng thái cuối

```text
F23.11E.2A DONE backend/public / Gỡ mềm, deletion request, review và legal hold
F23.11E.2B LATER backend / Permanent object deletion bằng server-side executor và lifecycle canonical
```

F23.11E.2A đã hoàn tất trong phạm vi được QA. Không có permanent Storage deletion trong runtime/browser và không được ghi F23.11E.2B DONE.

Hai cảnh báo trust-boundary dưới đây tiếp tục là blocker canonical cho E.2B, không phải blocker đóng E.2A:

- `NEEDS REVIEW - F23.11E.2 PERMANENT DELETE REQUIRES APPROVED SERVER-SIDE EXECUTION`
- `NEEDS REVIEW - CANONICAL SERVER-SIDE EMPLOYMENT LIFECYCLE REQUIRED`

## Sáu applied migrations bất biến

Sáu migration đã apply remote, Local/Remote history đã đồng bộ và là bất biến tuyệt đối. Không sửa, format, đổi encoding/line ending có chủ đích, rename, xóa, squash, repair hoặc apply lại.

| Migration | SHA-256 trước finalization | SHA-256 sau finalization |
| --- | --- | --- |
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |

## E.2A đã triển khai

### Soft removal

`Gỡ khỏi tài liệu` dành cho active Owner hoặc Center Admin đúng center:

- chuyển current `available/primary` thành `archived/non-primary` với reason removed;
- không xóa Storage object hoặc metadata;
- history vẫn private và vẫn xem/tải bằng access URL ngắn hạn;
- upload slot trở lại sau removal;
- stale/double-submit không làm mất current ngoài transaction hợp lệ.

### Deletion request và review

Owner/Center Admin đúng center có thể tạo/hủy request append-only. Owner khác requester mới có thể review. Request/approval không tự cấp quyền xóa Storage object và `eligible_after = NULL` tiếp tục thể hiện chưa đủ điều kiện execution.

Manual QA phê duyệt bằng Owner thứ hai vẫn `DEFERRED`, vì chưa có fixture Owner thứ hai. Không ghi nhánh đó PASS từ automated smoke.

### Legal hold

Owner có thể đặt/gỡ legal hold theo policy. Hold dùng cùng lock domain với attachment/request; release không tự resume execution, không khôi phục capability cũ và không xóa object.

### Readiness và UI boundary

Governance readiness xác nhận soft removal và deletion request ready, còn permanent execution false với blocker cần server executor + lifecycle canonical. UI có history, badge `Đã gỡ`, xem/tải, deletion request/review/legal hold và thông báo unavailable; không render execution button.

## E.2B LATER — permanent deletion

Browser không có Storage DELETE capability và runtime không gọi đường xóa object. E.2B chỉ được mở lại bằng phase duyệt riêng có đủ:

1. employment lifecycle canonical server-side, không cho browser tự khai/backdate nguồn retention;
2. server-side executor hoặc Edge Function với authorization và secret boundary được review;
3. lock/capability protocol bao trùm hold, exact object deletion và finalize;
4. replay/stale capability, hold/delete race, cross-center và RLS regression;
5. readiness chỉ bật khi lifecycle và executor thật sự tồn tại.

Cho đến lúc đó, object archived/removed vẫn private và review-safe; `approved` không đồng nghĩa `executed`.

## Manual QA finalization

`PASS`:

- readiness;
- upload private;
- xem;
- tải xuống;
- reload persistence;
- validation MIME/10 MiB;
- replace attachment;
- version history;
- xem/tải phiên bản cũ;
- soft removal;
- object/history vẫn private và truy cập được sau soft removal;
- upload slot trở lại sau removal.

`DEFERRED`:

- Owner thứ hai phê duyệt request: chưa có fixture Owner thứ hai;
- permanent Storage deletion: chủ động khóa.

Known UX deferred: đóng attachment viewer đôi lúc làm vùng Hồ sơ hành chính nhảy scroll lên trên.

## Canonical roadmap

```text
F23.11 DONE public/backend / Hồ sơ hành chính Nhân viên, tài liệu nhân sự và attachment private
    F23.11A DONE design / Kiến trúc Hồ sơ hành chính, dữ liệu nhạy cảm và tài liệu nhân sự
    F23.11B DONE public / Hồ sơ hành chính center-scoped, local-safe, masking-reveal và cửa sổ riêng
        F23.11B.1 DONE hotfix / Default filter, empty state và mojibake
        F23.11B.2 DONE hotfix / Hiện-Ẩn dữ liệu nhạy cảm
    F23.11C DONE public / Danh mục tài liệu, hạn hiệu lực và attachment metadata private-ready
    F23.11D DONE public / Quyền theo action, audit append-only, retention và deletion-request local-safe
    F23.11E DONE backend/public / Upload ảnh-PDF tài liệu nhân sự bằng Supabase Storage private
        F23.11E.1 DONE backend/public / Thay tệp, lịch sử phiên bản và lưu trữ bản cũ
        F23.11E.2A DONE backend/public / Gỡ mềm, deletion request, review và legal hold
        F23.11E.2B LATER backend / Permanent object deletion bằng server-side executor và lifecycle canonical

F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở
    F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed
    F23.12B DONE design / Global Internal Console và center inventory
    F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed
    F23.12D DONE design / Controlled bootstrap, assignment và revoke drill
```

F23.12A–D đã hoàn tất design qua chuỗi tài liệu canonical, nhưng implementation vẫn `BLOCKED`; chưa triển khai runtime/backend, route, authority service hoặc gán tài khoản thật.
