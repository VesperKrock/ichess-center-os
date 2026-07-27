# F23.11C — Danh mục tài liệu, hạn hiệu lực và attachment private-ready

Ngày triển khai: 2026-07-27  
Phạm vi: runtime local-safe trên `main`, không migration, không backend/cloud write, không triển khai hạ tầng tệp và không thay đổi Teacher Workspace.

## Kết quả kiến trúc

F23.11C thêm entity center-scoped `centerStaffDocuments`, tách khỏi cả `centerStaffMembers` và `centerStaffAdministrativeProfiles`. Một Nhân viên có thể có nhiều tài liệu; mỗi record liên kết bằng ba khóa ổn định `centerId`, `staffMemberId`, `administrativeProfileId`. Tài liệu không trở thành field con khổng lồ của form Nhân viên và không sao chép employment status, lifecycle history, Teacher link, account/membership link hoặc completion checklist.

Chuỗi liên kết bắt buộc khi đọc và trước khi ghi là:

`current center → unique Staff → unique administrative profile → document`

Sai center, Staff/Profile không tồn tại, Profile không thuộc Staff, duplicate document ID hoặc collection malformed đều fail closed. UI hiển thị trạng thái an toàn “Dữ liệu tài liệu cần kiểm tra” và không ghi đè storage hiện hữu.

## Storage contract và schema

Storage key: `ichessCenterOS.centerStaffDocuments.<centerId>`.

Đọc empty state không tự tạo key. JSON lỗi hoặc record lỗi không bị xóa, sửa hay migration ngầm. Chỉ create/edit/archive/restore hợp lệ mới ghi. Normalizer dùng spread trước các field owned để preserve unknown fields phục vụ backward compatibility; field owned malformed làm collection read-only thay vì bị stringify thành `[object Object]`.

Schema v1:

```js
{
  id,
  schemaVersion: 1,
  centerId,
  staffMemberId,
  administrativeProfileId,
  category,
  title,
  documentNumber,
  issuedDate,
  effectiveDate,
  expiryDate,
  note,
  attachmentIds: [],
  revision,
  createdAt,
  updatedAt,
  archivedAt
}
```

`id`, ba khóa liên kết, `category`, `title`, timestamps và `revision` là bắt buộc. Số/ký hiệu là text để giữ số 0 đầu. Ba ngày dùng chuỗi `YYYY-MM-DD`. Phase này record mới luôn có `attachmentIds: []`; không sinh attachment ID, provider, bucket hoặc path giả.

Nhóm tài liệu: giấy tờ tùy thân, hợp đồng lao động, phụ lục hợp đồng, sơ yếu lý lịch/CV, văn bằng, chứng chỉ, bảo hiểm, quyết định, biên bản bàn giao và khác. Alias thiết kế cũ `identity` chỉ được đọc tương thích thành `identity-document`; không có bulk rewrite.

## Validation

- Tên tài liệu bắt buộc, tối đa 240 ký tự.
- Nhóm phải thuộc allowlist.
- Số/ký hiệu tối đa 120 ký tự; ghi chú tối đa 2.000 ký tự.
- Ngày phải tồn tại thực tế.
- Ngày ban hành không sau ngày hiệu lực hoặc ngày hết hạn; ngày hiệu lực không sau ngày hết hạn.
- Không có input cho derived status.
- HTML trong title, number và note được escape tại render boundary.

## Derived expiry status

Status không được persist và không được người dùng sửa tay. Mỗi lần render/filter, hệ thống tính theo ngày local hiện tại:

- Không có `expiryDate`: `Không áp dụng`.
- `expiryDate < today`: `Hết hạn`.
- `today <= expiryDate <= today + 30 ngày`: `Sắp hết hạn`.
- Sau cửa sổ 30 ngày: `Còn hiệu lực`.
- Record malformed: `Tài liệu cần kiểm tra`.
- Record có `archivedAt`: `Đã lưu trữ`.

Ngày hết hạn đúng hôm nay vẫn còn trong trạng thái `Sắp hết hạn`; chỉ ngày trước hôm nay mới là `Hết hạn`. Summary đang quản lý loại record archived khỏi tổng active và đếm lưu trữ riêng.

## Revision, stale guard và double-submit

Create bắt đầu revision 1. Edit, archive và restore tăng revision đúng một lần và cập nhật `updatedAt`; `id`/`createdAt`/liên kết không đổi. Form edit giữ `expectedRevision`, `expectedUpdatedAt`, `expectedArchivedAt`. Trước ghi, runtime lấy membership mới nhất, đọc lại Staff/Profile/document và so snapshot. Khi lệch, dừng với:

`Tài liệu đã thay đổi. Vui lòng mở lại để tiếp tục.`

Set in-memory theo window chặn double-submit. Center switch, close hoặc mất quyền xóa state tạm. Không có timeout, synthetic click hay full-app render trong filter/create/edit catalog.

## Archive, restore và retention

Archive là soft archive bằng `archivedAt`; không hard-delete. Restore giữ cùng stable document ID. Archive Nhân viên không cascade archive tài liệu: toàn cửa sổ Hồ sơ hành chính chuyển read-only và vẫn cho xem catalog. Staff lifecycle, Teacher/account links và profile completion không bị mutation bởi thao tác tài liệu.

Retention phase local-safe: metadata tiếp tục tồn tại đến khi có policy pháp lý theo từng category/center. Không tự purge khi hết hạn, khi tài liệu được thay thế hoặc khi Staff nghỉ việc. Roadmap backend phải bổ sung legal hold, retention decision và audit evidence trước mọi cleanup vật lý.

## UI window, scroll, focus và taskbar

Section `Tài liệu` nằm trong child window rộng/maximized của Hồ sơ hành chính. Window và taskbar vẫn dùng stable Staff identity; title/taskbar không chứa title, số tài liệu, ngày, note hoặc metadata attachment.

Window giữ đúng một `.staff-administrative-content-scroll`. Catalog, summary, filters, detail và form nằm trong document flow, không tạo modal hẹp, nested scroll hoặc double-scroll. Filter thay riêng results region; create/edit/detail thay riêng section, nên không render lại desktop/window, không làm nhảy main scroll và không cần focus workaround. Navigation có mục `Tài liệu` cuộn trong main scroller hiện hữu.

Empty state phân biệt:

- Không có dữ liệu: `Chưa có tài liệu.`
- Có dữ liệu nhưng filter không khớp: `Không có tài liệu phù hợp với bộ lọc hiện tại.` và action `Xóa bộ lọc`.

Search chỉ xét title và documentNumber. Filter gồm category, derived expiry status và active/archived. List không render raw center/staff/profile ID, path, bucket, checksum hoặc dữ liệu nhạy cảm của administrative profile.

## Access matrix và privacy-by-design

| Membership hiện tại | Đọc | Tạo/sửa | Archive/restore |
| --- | --- | --- | --- |
| active `owner` đúng center | Có | Có | Có |
| active `center_admin` đúng center | Có | Có | Có |
| `teacher` | Không | Không | Không |
| `consultant` | Không | Không | Không |
| inactive/malformed/sai center/không đăng nhập | Không | Không | Không |

Access deny xảy ra trước khi truyền documents vào renderer. Mutation luôn re-check membership mới nhất. Mất quyền xóa document window state và parent renderer chuyển sang safe state, không để metadata nhạy cảm tiếp tục render. Không log title, số/ký hiệu, note, path hoặc giá trị Hồ sơ hành chính; toast/taskbar/search Staff cũng không nhận các giá trị này.

## Attachment private-ready

F23.8B được audit để học cách center/role guard và metadata reference hoạt động, nhưng transaction contract không được tái sử dụng mù quáng. F23.8B phụ thuộc transaction code, upload lifecycle, preview URL và cleanup cloud; những điều đó chưa tồn tại cho Staff Documents.

F23.11C không có file input, upload CTA, staged tệp, binary, base64, object URL, preview URL hoặc URL truy cập được persist. UI ghi rõ:

- `Chưa có tệp đính kèm`.
- `Backend lưu trữ riêng tư chưa được bật`.

Hợp đồng future-ready dự kiến tách entity `centerStaffDocumentAttachments`:

```js
{
  id,
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  state,                 // pending | available | missing | archived
  storageProvider,
  bucket,
  objectPath,
  originalName,
  storedName,
  mimeType,
  sizeBytes,
  checksum,
  uploadedAt,
  uploadedBy,
  revision,
  createdAt,
  updatedAt,
  archivedAt
}
```

Private object path v1:

`centers/<centerId>/staff/<staffMemberId>/documents/<documentId>/<attachmentId>/<safeFileName>`

Mọi segment phải được chuẩn hóa và đối chiếu lại với current center/document chain. Bucket phải private; URL truy cập chỉ được tạo ngắn hạn sau authorization và không persist vào profile, document, attachment metadata hoặc local storage. Allowlist roadmap: PDF, JPEG, PNG, WebP; tối đa 10 MiB/tệp. Attachment state `none` của document hiện tại được biểu diễn trung thực bằng mảng ID rỗng, không bằng metadata giả.

## Migration và backward compatibility

- Không migration runtime hoặc bulk rewrite trong F23.11C.
- Center chưa có key mới tiếp tục chạy với catalog rỗng, không tạo key khi chỉ đọc.
- Unknown document fields được preserve qua edit/archive/restore.
- Legacy category `identity` đọc tương thích; ghi mới dùng `identity-document`.
- Dữ liệu malformed được giữ nguyên trong storage và khóa mutation.
- Không đọc/nhập transaction attachment cũ vào Staff Documents.
- Không thay profile completion, Staff lifecycle, Teacher/account/membership links.

Backend phase sau phải có migration riêng, RLS/private bucket policy, audit actor/action/revision, idempotent metadata transaction, orphan reconciliation và rollback. Không suy diễn rằng local revision là audit log pháp lý.

## Manual QA

Fixture khuyến nghị: một active owner/center_admin, một teacher/consultant, một Staff có Hồ sơ hành chính, và tài liệu có ngày hết hạn: hôm qua, hôm nay, +30 ngày, +31 ngày, không có ngày.

1. Mở Hồ sơ hành chính, dùng navigation `Tài liệu`; xác nhận child window/taskbar/focus và chỉ một content scroll.
2. Tạo tài liệu với số có số 0 đầu; reload và xác nhận metadata tồn tại, profile completion không đổi.
3. Kiểm tra status tại các mốc ngày, gồm expiry đúng hôm nay.
4. Filter/search, xác nhận no-data khác no-match và `Xóa bộ lọc` hoạt động lần click đầu.
5. Edit rồi mô phỏng revision khác; xác nhận stale message và không overwrite.
6. Double-click Save; xác nhận chỉ một record/revision transition.
7. Archive/restore; xác nhận cùng ID, archive không nằm trong total active và không hard-delete.
8. Archive Staff; xác nhận tài liệu còn xem được nhưng mọi mutation disabled.
9. Chuyển center, sign out, inactive membership, teacher/consultant; xác nhận deny và không còn metadata trong DOM/taskbar.
10. Xác nhận form/detail đều ghi “Chưa có tệp đính kèm”, backend riêng tư chưa bật và không có file input/upload giả.

Manual QA chưa được tự động kết luận PASS. F23.11C chỉ hoàn tất code và automated verification; người kiểm thử phải xác nhận các bước tương tác trên browser.

STAFF DOCUMENT CATALOG COMPLETE - AWAITING MANUAL QA
