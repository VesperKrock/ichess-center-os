# F23.11E.1 — Thay tệp, lịch sử phiên bản và lưu trữ bản cũ

Ngày chuẩn bị: 2026-07-28

Trạng thái: `F23.11E.1 DONE` — migration `202607280002` đã apply remote và manual QA đã hoàn tất theo checkpoint đầu vào F23.11E.2. Migration đã apply là bất biến tuyệt đối.

Finalization 2026-07-29: migration `202607280003` cũng đã apply remote; cả sáu migration từ `20260722000000` đến `202607280003` hiện là bất biến tuyệt đối. F23.11E.2 được tách thành E.2A DONE và E.2B LATER trong roadmap canonical cuối tài liệu.

## Applied migration immutability

Bốn migration đã apply remote được coi là bất biến. SHA-256 ghi trước khi triển khai:

| Migration | SHA-256 |
| --- | --- |
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |

F23.11E.1 chỉ tạo migration nối tiếp:

`202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql`

Không sửa, rename, format, repair history hoặc apply lại bốn migration trên.

## Data model

`public.center_staff_document_attachments` được bổ sung:

- `replaces_attachment_id uuid null`: self-reference immutable đến phiên bản thành công ngay trước;
- `archive_reason text null`: F23.11E.1 chỉ ghi allowlisted value `replaced`;
- partial unique version index chỉ áp dụng cho `available | archived`, để các candidate pending cạnh tranh có thể cùng mang version kế tiếp, còn failed attempt không chiếm số version thành công;
- partial unique replacement link chỉ áp dụng cho version thành công, nên hai actor có thể cùng prepare nhưng chỉ finalize đầu tiên được commit.

Version 1 hiện có vẫn hợp lệ và không cần data rewrite. Failed attempts không xuất hiện trong lịch sử thành công.

Update guard giữ immutable toàn bộ object identity, filename/MIME/size, uploader, version và replacement link. Transition hợp lệ:

```text
initial pending primary → available primary
initial pending primary → failed primary
replacement pending non-primary → available primary
replacement pending non-primary → failed non-primary
old available primary → archived non-primary + archive_reason=replaced
```

Archived không thể quay lại available; available không thể quay lại pending.

## Replace flow

Luồng bắt buộc là `prepare → upload → finalize` và không overwrite:

1. `prepare_staff_document_attachment_replacement` xác thực active owner/center_admin đúng center.
2. RPC lấy advisory transaction lock theo center/document và lock expected current row.
3. Current phải available, primary, chưa archive và đúng toàn bộ stable identity chain.
4. RPC sinh attachment UUID mới, object path mới và candidate version `current + 1`; concurrent actor có thể prepare candidate cạnh tranh.
5. Replacement metadata được insert `pending`, `is_primary=false`, liên kết `replaces_attachment_id=current.id`.
6. Browser upload object mới với `upsert: false`; object cũ không đổi.
7. `finalize_staff_document_attachment_replacement` lock replacement/current, xác minh expected current và exact Storage object metadata.
8. Trong cùng transaction, current cũ được archive/demote trước rồi replacement được promote thành available/current.

Không có archive current trong prepare. Nếu bước promote lỗi, transaction rollback cả bước archive.

## Stale, concurrency và failure

Frontend dùng per-window upload set để chặn double-submit, nhưng backend mới là authority:

- advisory lock serialize prepare/finalize theo center/document;
- expected current attachment ID được gửi cho cả prepare và finalize;
- current và replacement đều được row-lock;
- unique partial indexes giữ current/version invariant;
- không có last-writer-wins.

Upload failure gọi failure RPC để đánh dấu replacement pending thành failed/non-primary. Finalize stale trả allowlisted `replacement-stale`; transaction thua không mutate current winner và UI reload lại current/history. Private orphan object sau upload/finalize failure được để lại cho F23.11E.2; browser không có quyền cleanup.

## Storage, RLS và signed URL

Storage INSERT policy vẫn yêu cầu exact bucket + exact metadata/object path + pending uploader + active owner/admin đúng center, nhưng không còn bắt pending row phải primary. Vì vậy initial pending primary và replacement pending non-primary đều upload được.

Storage SELECT:

- current available: active owner/admin đúng center;
- archived history: active owner/admin đúng center;
- pending: chỉ uploader hiện tại;
- failed, unauthenticated, inactive, teacher, consultant và cross-center: deny.

Không có Storage UPDATE/DELETE policy. Không có public bucket, public URL, `getPublicUrl`, service-role browser hoặc path authorization chỉ dựa trên prefix.

Xem/Tải xuống current và archived đều tạo signed URL on-demand TTL 180 giây. URL không được persist và được clear khỏi viewer memory khi đóng/hết hạn.

## Readiness schema

Migration nâng `schema_version = 2`. Runtime xử lý tương thích:

- schema v1 vẫn upload initial, xem và tải current;
- schema v1 không render nút `Thay tệp` và thông báo đang chờ migration F23.11E.1;
- schema v2 mới bật replacement và history;
- readiness/membership/center failure vẫn fail closed.

## UI và audit

Current attachment luôn còn nút `Xem` và `Tải xuống` trong khi replacement đang chuẩn bị, upload hoặc finalize. Chỉ control `Thay tệp` của document đó bị disable.

Confirmation:

```text
Tệp mới sẽ trở thành phiên bản hiện hành.
Phiên bản hiện tại vẫn được lưu trong lịch sử và có thể xem hoặc tải xuống.
```

History newest-first hiển thị Phiên bản N, badge `Hiện hành`/`Đã thay thế`, filename, MIME, dung lượng, thời điểm upload/thay thế và Xem/Tải xuống. DOM không chứa attachment UUID, bucket, raw object path hoặc signed URL.

Audit append-only dùng action allowlist:

- `staff-document.attachment-replacement-prepared`;
- `staff-document.attachment-replacement-completed`;
- `staff-document.attachment-replacement-failed`;
- `staff-document.attachment-version-view`;
- `staff-document.attachment-version-download`.

Audit chỉ ghi stable IDs, allowlisted reason/outcome và summary dạng version + MIME category + size bucket. Không ghi filename, path, URL, file bytes hoặc raw backend error.

## Không thuộc phase này

F23.11E.1 không tự triển khai Gỡ tệp, permanent deletion, object cleanup hoặc legal hold. Các capability này được nối tiếp trong migration-ready F23.11E.2; F23.11E.1 vẫn không overwrite và không xóa object cũ.

## Manual QA sau migration apply — PASS theo checkpoint finalization

Các bước replace, version history, xem/tải phiên bản cũ, reload persistence và validation MIME/10 MiB đã PASS theo manual QA được cung cấp. Checklist chi tiết dùng để truy vết phạm vi đã kiểm:

1. Owner mở tài liệu hiện có version 1.
2. Bấm `Thay tệp`, chọn JPEG/PDF hợp lệ.
3. Xác nhận copy nói rõ bản cũ không bị xóa.
4. Quan sát `Đang chuẩn bị...`, `Đang tải lên...`, `Đang hoàn tất...`.
5. Xác nhận current cũ vẫn xem/tải được trong progress.
6. Xác nhận version 2 thành `Hiện hành` sau finalize.
7. Xác nhận version 1 thành `Đã thay thế`.
8. Xem và tải version 1.
9. Xem và tải version 2.
10. Reload và xác nhận current/history giữ nguyên.
11. Thử MIME/signature sai và file quá 10 MiB.
12. Double-click/chọn lại khi đang upload không tạo lượt thứ hai.
13. Mô phỏng stale bằng hai tab/actor; actor cũ không archive current mới.
14. Mô phỏng upload/finalize failure; current cũ vẫn hoạt động.
15. Active Center Admin cùng center được phép.
16. Teacher/consultant/inactive/signed-out bị deny.
17. Cross-center bị deny.
18. Schema v1 không hiện `Thay tệp` nhưng current view/download vẫn hoạt động.
19. Không có raw path/signed URL/auth UUID thô trong UI; audit chỉ giữ stable IDs và allowlisted summary/reason.
20. Không có nút gỡ/xóa và không có Storage UPDATE/DELETE.
21. Đóng viewer current/archived khôi phục scroll/focus đúng trigger.
22. Không tự kết luận manual QA PASS từ automated smoke.

## Roadmap

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

F23.12 NEXT design / Platform Owner quyền tối cao và hỗ trợ xuyên cơ sở
    F23.12A TODO design / Role platform_owner-super_admin và nguồn cấp quyền server-side
    F23.12B TODO design / Internal Console toàn hệ thống và danh sách cơ sở
    F23.12C TODO design / Acting mode hỗ trợ cơ sở có audit, thời hạn và thoát vai rõ ràng
    F23.12D TODO design / Gán tài khoản vận hành làm Platform Owner, không hardcode email phía client
```

Known UX deferred: đóng attachment viewer đôi lúc làm vùng Hồ sơ hành chính nhảy scroll lên trên.

Trạng thái kế thừa: F23.11E.1 đã hoàn tất. Sáu applied migration không được sửa, rename hoặc repair. F23.12 chưa được triển khai.
