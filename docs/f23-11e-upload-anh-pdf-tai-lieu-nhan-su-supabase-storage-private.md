# F23.11E — Upload ảnh/PDF tài liệu nhân sự bằng Supabase Storage private

## 1. Kết quả và trạng thái remote

F23.11E upload private, F23.11E.1 replace/version history và phạm vi F23.11E.2A đã hoàn tất. Sáu migration từ `20260722000000` đến `202607280003` đã apply remote, Local/Remote history đã đồng bộ và phải bất biến tuyệt đối. Finalization này không chạy Supabase action và không deploy.

`SUP-CF.1` và các prerequisite liên quan đã apply remote. Runtime vẫn không suy đoán backend an toàn: nó gọi RPC readiness do migration F23.11E cung cấp. RPC chỉ trả ready khi bucket private, RLS/policies bắt buộc và table grants read-only cho authenticated đều hiện hữu. Khi một điều kiện chưa đạt, panel hiển thị `Kho tệp riêng tư chưa sẵn sàng.` và không render file picker.

Kết luận hiện tại:

- `F23.11E DONE`;
- `F23.11E.2A DONE`;
- `F23.11E.2B LATER — permanent deletion remains locked`.

## 2. Audit root architecture hiện có

### F23.8A/B/B.1 và attachment Thu chi

Attachment giao dịch hiện dùng:

- bucket `transaction-images`;
- metadata `transaction_attachments`;
- path theo center, bucket, năm/tháng và transaction filename;
- upload object với `upsert: false`, sau đó insert metadata;
- signed URL tạo ở runtime;
- edit hydrate theo transaction code vì bảng không có stable transaction row ID;
- replace/remove và object deletion thuộc contract giao dịch;
- legacy evidence có nhánh local data URL;
- policy SUP-CF.1 mở SELECT/INSERT/UPDATE/DELETE cho active owner/center_admin theo center, exact five-segment path và immutable attachment identity.

Các phần tái sử dụng có chủ đích là Supabase client, nguyên tắc signed URL on-demand, MIME/size validation, private bucket và `upsert: false`. Không tái sử dụng transaction code, month path, gallery/replace/delete, legacy data URL, evidence state hoặc giả định RLS của giao dịch.

F23.8C/D/E tiếp tục dùng ledger/transaction attachment cho thanh toán, lịch sử, in/xuất và drill-down. Các consumer đó không trở thành source of truth của tài liệu nhân sự.

### SUP-CF.1

Migration `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` có helper dựa trên `auth.uid()` và active `center_members`, ép bucket giao dịch private và khai báo table/Storage policies. F23.11E.1 làm `NULL`/blank/malformed status fail-closed, normalize role/status, thay `LIKE` bằng exact path segments, thêm prerequisite gate và khóa `center_id`, `uploaded_by`, `storage_bucket`, `storage_path` khi UPDATE. Các migration này đã apply remote theo checkpoint đầu vào F23.11E.2 và phải bất biến. F23.11E không phụ thuộc app-side role label để bù cho RLS chưa có.

### F23.11A–D

- Hồ sơ hành chính tách khỏi Staff operational record, liên kết bằng stable `staffMemberId`.
- `centerStaffDocuments` là catalog metadata nghiệp vụ local-safe và có stable `documentId`/`administrativeProfileId`.
- F23.11D có action-level access, append-only audit, retention review và deletion-request workflow không hard-delete.
- Tệp cloud không đổi Staff lifecycle, profile completion, document expiry, Teacher/account link, retention policy hoặc deletion request.

## 3. Source of truth và giới hạn multi-device

`center_staff_document_attachments` trên Supabase là source of truth duy nhất cho attachment metadata và lifecycle tệp. `centerStaffDocuments` vẫn là source of truth local-safe của category, số/ký hiệu, ngày và derived expiry status.

Không ghi bucket, raw object path, checksum, signed URL, upload token, binary, base64, `Blob`, `File` hoặc object URL vào localStorage. Upload tệp không mutate `attachmentIds` và không tăng revision của document local.

Giới hạn được giữ minh bạch: catalog document vẫn local-safe, nên thiết bị khác chỉ resolve được cloud attachment khi có cùng stable local document/profile/staff chain. Phase này chưa đồng bộ toàn bộ catalog tài liệu qua cloud.

## 4. Kiến trúc attachment riêng

Bucket riêng:

`staff-administrative-documents`

Namespace server-controlled:

`centers/<centerId>/staff/<staffMemberId>/documents/<documentId>/<attachmentId>/<safeFileName>`

`safeFileName` do RPC tạo từ MIME theo dạng `attachment.pdf`, `attachment.jpg`, `attachment.png` hoặc `attachment.webp`; client không tự quyết định object identity. Original filename chỉ nằm trong metadata cloud và chỉ render đã escape trong detail panel.

Mỗi document có tối đa một primary attachment ở trạng thái `pending` hoặc `available`. Failed rows được giữ để audit/reconcile và retry tạo stable attachment/object mới với version tăng. Schema cho phép version history về sau nhưng UI F23.11E không replace và không archive attachment.

## 5. Cloud schema

Migration tạo `center_staff_document_attachments` với:

- stable UUID `id`;
- `center_id`, `staff_member_id`, `administrative_profile_id`, `document_id`;
- private `bucket_id` và server-controlled `object_path`;
- original/safe filename, MIME, size, checksum nullable;
- lifecycle `pending | available | failed | archived`;
- `is_primary`, `version`;
- uploader user ID và timestamps/archive fields;
- allowlisted failure reason code, không lưu raw backend error.

Constraints khóa stable ID format, MIME, 10 MiB, exact path, private bucket, state và archive consistency. Partial unique index ngăn duplicate primary pending/available; advisory transaction lock trong prepare RPC bảo vệ double-submit đồng thời.

## 6. Authorization, RLS và Storage policy

Server authorization dùng `auth.uid()` và row `center_members` có:

- exact current `center_id`;
- exact current user ID;
- status `active`;
- role canonical `owner` hoặc `center_admin`.

Teacher, consultant, inactive/revoked/malformed, unauthenticated và cross-center bị deny-by-default.

Table bật RLS và có SELECT/INSERT/UPDATE policies center-scoped. Client chỉ được grant SELECT; mutation đi qua security-definer RPC đã revoke public execution. Không có client DELETE grant/policy.

Storage SELECT cho object `available`, chưa archived với active owner/admin đúng center. Riêng object `pending` chỉ chính `uploaded_by_user_id = auth.uid()` có active owner/admin membership đúng center được đọc trong khoảng prepare → finalize; owner/admin khác không được đọc pending. Upload object mới `upsert: false` vẫn chỉ cần INSERT theo contract Supabase hiện tại, còn read/signed access cần SELECT. `failed`, `archived`, missing metadata và path không khớp exact đều bị deny. Storage INSERT vẫn chỉ cho exact pending row, exact object path, exact uploader và active owner/admin. Không có Storage UPDATE/DELETE policy, không public read và không dùng public URL.

Mọi function `SECURITY DEFINER` trong migration dùng `set search_path = ''`; relation nhạy cảm đều schema-qualified. Quyền execute bị revoke khỏi `public`/`anon` và chỉ các RPC/helper cần gọi mới grant cho `authenticated`.

## 7. RPC và lifecycle

Ba RPC canonical:

1. `prepare_staff_document_attachment_upload` revalidate auth/membership, stable chain, MIME/size/name; serialize theo center/document; tạo UUID, safe filename, exact path, version và metadata `pending`.
2. Browser upload object vào private bucket với `upsert: false`.
3. `finalize_staff_document_attachment_upload` revalidate auth/uploader, khóa row, xác nhận exact object trong Storage cùng size/MIME rồi chuyển `available`. Duplicate finalize trả lại row available idempotently.
4. `fail_staff_document_attachment_upload` chuyển pending sang `failed` bằng reason code allowlisted; không xóa object.

Sau khi object upload và trước finalize, app re-read active membership, current center, Staff/Profile/Document stable chain, document revision/update timestamp và archive state. Context stale hoặc center switch làm finalize dừng và record chuyển failed.

Không fake progress phần trăm. UI dùng các state `Đang chuẩn bị`, `Đang tải lên`, `Đang hoàn tất`, `Đã tải lên`, `Tải lên thất bại`, denied và backend unavailable.

## 8. File validation

Allowlist chính xác:

- `application/pdf`;
- `image/jpeg`;
- `image/png`;
- `image/webp`.

Giới hạn là 10 MiB, một file, không ZIP/HEIC, không MIME rỗng, không convert. Client kiểm tra MIME, extension và magic signature trước prepare; bucket và SQL kiểm tra MIME/size lần nữa. File input chỉ xuất hiện trong attachment panel của document detail khi readiness và role đều hợp lệ.

## 9. Signed URL, preview và download

Preview/download luôn re-read current Auth membership, query exact available attachment qua RLS, rồi tạo signed URL on-demand TTL 180 giây.

- ảnh dùng viewer gần full-screen với `object-fit: contain`;
- PDF dùng browser iframe viewer;
- viewer chừa taskbar, có một content scroll, close/backdrop/Escape;
- download dùng ephemeral anchor và safe server filename;
- close, expiry, window close, center switch hoặc access loss xóa signed URL reference khỏi memory.

Signed URL không đi vào document, local/session storage, audit, toast, taskbar, app route hoặc log. Raw bucket/path/attachment ID không render trong UI.

## 10. Privacy audit

Action canonical bổ sung:

- `staff-document.attachment-upload-start`;
- `staff-document.attachment-upload-success`;
- `staff-document.attachment-upload-failed`;
- `staff-document.attachment-view`;
- `staff-document.attachment-download`.

Audit chỉ giữ center, actor membership/role snapshot, stable target IDs, outcome/reason, MIME category/size bucket và timestamp. Không giữ raw filename, object path, URL, content, document metadata, raw error hoặc full attachment row.

## 11. Failure, retry và orphan boundary

- Prepare fail: không có object và không báo thành công.
- Upload fail: pending chuyển failed.
- Local context stale: object có thể đã tồn tại nhưng metadata chuyển failed; không finalize giả.
- Finalize fail: metadata chuyển failed; object private có thể cần reconcile.
- Retry tạo attachment/path/version mới, không overwrite object cũ.

F23.11E không hard-delete metadata/object. Failed/orphan reconciliation, approved deletion execution, legal hold, replace/version history và physical cleanup được defer. Không tự xóa object để che sequencing failure.

## 12. Lịch sử apply — đã hoàn tất

File review:

`supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql`

Thứ tự bắt buộc sau approval riêng:

```text
SUP-CF.1 hardened migration
→ F23.11E private staff attachment migration
→ local supabase db reset
→ static/security verification
→ migration list
→ remote dry-run
→ review
→ remote apply
```

Quy trình local reset, migration list, remote dry-run/apply và manual QA của F23.11E đã hoàn tất trước checkpoint F23.11E.2. Bucket F23.11E đã được xác nhận private, 10 MiB/MIME đúng, RLS enabled, RPC grants chỉ cho authenticated, metadata table chỉ có SELECT grant và không có Storage UPDATE/DELETE/public policy. F23.11E.2 không chạy lại hoặc repair lịch sử này.

Runtime tự chuyển từ unavailable sang ready khi RPC readiness của đúng migration trả `ready = true`; không hardcode hostname hoặc project identity.

## 13. Rollback an toàn

Rollback ưu tiên khóa runtime/readiness và revoke RPC/Storage INSERT trước. Giữ bucket private và giữ table/object để tránh mất dữ liệu. Không drop table/bucket hoặc xóa object trong rollback thông thường.

Chỉ được tạo migration cleanup riêng sau inventory/backup, xác nhận bucket rỗng hoặc có quyết định retention/deletion hợp lệ, và approval backend/security. Không dùng rollback để thực thi deletion request F23.11D.

## 14. Manual QA sau remote apply — PASS theo checkpoint finalization

Readiness, upload private, xem, tải xuống, reload persistence và validation MIME/10 MiB đã PASS theo manual QA được cung cấp. Checklist dưới đây ghi lại phạm vi kiểm; automated smoke không thay manual QA:

1. Owner và center_admin active đúng center thấy picker trong document detail.
2. Teacher, consultant, inactive, malformed, signed-out và cross-center không thấy metadata/tệp.
3. PDF/JPEG/PNG/WebP hợp lệ dưới hoặc bằng 10 MiB upload thành một pending, một object, một available primary.
4. MIME rỗng/sai, extension mismatch, signature mismatch, ZIP/HEIC và file trên 10 MiB bị chặn trước prepare.
5. Double click/change listener không tạo duplicate primary/object.
6. Reload query cloud metadata và hiển thị attachment available mà không đọc local attachment path.
7. Xem ảnh/PDF và tải xuống tạo URL mới, TTL ngắn; close/Escape/backdrop xóa viewer state.
8. Revoke membership khi window mở làm request tiếp theo bị deny và không render metadata cũ.
9. Switch center trong picker/upload/viewer đóng runtime state, không finalize vào center mới.
10. Archive document chặn upload mới nhưng attachment available vẫn xem được cho owner/admin; restore giữ same link.
11. Network/upload/finalize failure không báo available; retry không overwrite.
12. Staff lifecycle, profile completion, document expiry, Teacher/account link, retention và deletion request không đổi.
13. localStorage không có binary/base64/object URL/signed URL/raw path/bucket.
14. Taskbar/window title/search/toast/audit không có filename/path/URL hoặc metadata nhạy cảm.

## 15. Deferred roadmap

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

Manual approval bằng Owner thứ hai vẫn deferred vì chưa có fixture phù hợp. Permanent Storage deletion chủ động khóa và không được ghi DONE.

## 16. Verification local

Test pack bao phủ validation, role/center/readiness, mocked prepare-upload-finalize/fail, pending-uploader Storage SELECT, exact SUP-CF.1 path, fail-closed prerequisites, immutable identity, fixed search path, signed URL, RLS/policy static checks, no-public-URL, no-binary/local persistence, audit allowlist, UI state, center-switch/window/taskbar/focus/scroll markers và regressions F23.11D/C/B/F23.10.

Trạng thái kế thừa: `F23.11E PRIVATE STAFF ATTACHMENT DONE`; E.2A đã chốt DONE, E.2B LATER. Sáu applied migration không được sửa, rename hoặc repair.
