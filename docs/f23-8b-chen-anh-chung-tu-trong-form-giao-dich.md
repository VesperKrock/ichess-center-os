# F23.8B - Chèn ảnh chứng từ trong form giao dịch

Date: 2026-07-23

Scope: runtime MVP cho giao dịch thủ công trong Module Thu chi. Không Auth, Supabase schema, SQL, bucket/rules mới, deploy, Teacher secret, commit hoặc push. Chưa làm Học phí, PDF/Excel, nhiều ảnh, report drill-down.

## Attachment Model Thực Tế

Thu chi vẫn giữ optional `transaction.attachment`.

- Legacy local: `id`, `name`, `type`, `size`, `dataUrl`, `createdAt`, tối đa 1MB.
- Cloud reference mới: `id`, `metadataId`, `name`, `originalName`, `fileName`, `type`/`mimeType`, `size`/`sizeBytes`, `storageBucket`, `storagePath`, `transactionCode`, `uploadedAt`, `uploadedBy`, `uploadedByName`, `createdAt`.
- Normalizer đọc cả hai dạng và preserve unknown fields bằng spread, không migration hàng loạt sang `attachments[]`.
- Không lưu raw `File`, object URL hoặc signed URL dài hạn vào transaction.

## Cloud Helper Tái Sử Dụng

F23.8B dùng lại helper hiện có:

- `validateTransactionImageFile()` từ `src/image-compression.js`.
- `compressTransactionImage()` nén ảnh về JPEG.
- `buildTransactionCode()`, `buildAttachmentFileName()`, `buildTransactionImageStoragePath()`.
- `uploadTransactionImageBlob()`.
- `createTransactionAttachmentMetadata()`.
- `createTransactionImageSignedUrl()`.
- `deleteTransactionImageObject()` và `deleteTransactionAttachmentMetadata()` cho cleanup.

Không tạo bucket, rules, SQL hoặc backend mới.

## UI Placement

Form `Thêm giao dịch` và `Sửa giao dịch` đặt `Chứng từ` ngay sau `Người ghi nhận` trong cùng grid row desktop. Trên màn hẹp grid về một cột để không chồng field.

Khi chưa có ảnh: nút `Chèn ảnh`.

Khi đã chọn/đang giữ ảnh: hiển thị thumbnail hoặc placeholder ảnh, tên file, dung lượng, trạng thái và actions `Xem trước`, `Thay ảnh`, `Gỡ`.

## Draft State

Form state có `attachmentDraft`:

- `none`
- `keep-existing`
- `staged-new`
- `remove-existing`

Draft giữ `File` và object URL chỉ trong memory. Chọn file không ghi storage/localStorage và không render lại toàn app; vùng preview được sync cục bộ.

## Validation

Allowlist theo helper cloud hiện có: JPEG, PNG, WebP; source max 10MB. PDF/Excel không được accept.

File invalid:

- không upload;
- không thay attachment cũ;
- giữ dữ liệu form;
- hiển thị lỗi để chọn lại.

Tên file và metadata được escape khi render. Preview URL chỉ cho `blob:`, `data:image/`, `https://`, localhost hoặc `127.0.0.1`; không mở `javascript:`.

## Preview Và Cleanup

Staged image tạo object URL để preview. Object URL được revoke khi thay ảnh, gỡ, hủy/đóng form, save thành công, xóa transaction từ form, hoặc switch center.

`Xem trước` dùng object URL/data URL hoặc signed URL ngắn hạn từ helper cloud. Signed URL không lưu vào transaction.

## Create/Save Lifecycle

Create có ảnh:

1. collect DOM values mới nhất;
2. validate transaction;
3. validate staged image;
4. guard center scope và cloud readiness;
5. set `isSaving`;
6. reserve/build transaction object;
7. tính `transactionCode` từ snapshot có transaction mới;
8. upload ảnh bằng helper cloud hiện có;
9. insert metadata;
10. save đúng một transaction kèm attachment reference;
11. refresh attachment month cache;
12. revoke object URL và clear form.

Nếu upload fail, transaction không được lưu như đã có chứng từ; form và staged file còn để retry.

Nếu save transaction fail sau upload, app cố cleanup metadata/storage của ảnh mới và giữ form visible.

Create không ảnh vẫn lưu bình thường.

## Edit Keep/Replace/Remove

Mở edit prefill attachment hiện có vào `keep-existing`. Save field khác không làm mất attachment.

Replace:

- ảnh cũ còn persisted trong lúc chọn ảnh mới;
- bấm `Gỡ` khi đang staged sẽ bỏ ảnh mới và quay lại giữ ảnh cũ;
- Save upload ảnh mới, lưu transaction cùng `id`/`createdAt`, cập nhật `updatedAt`;
- sau save thành công mới cleanup ảnh cũ.

Remove:

- bấm `Gỡ` khi đang xem attachment persisted chỉ đánh dấu `remove-existing`;
- Cancel giữ ảnh cũ;
- Save mới remove metadata khỏi transaction và cleanup cloud object/metadata.

Cleanup cloud fail sau save được báo warning, không rollback transaction về metadata sai.

## Safety

- Double-submit: `cashflowFormState.isSaving` chặn submit lặp.
- Center scope: form giữ `centerId`; switch center block save và reset transient state revoke object URL.
- Missing record: edit save reload latest snapshot, không recreate transaction đã mất.
- Stale record: nếu `updatedAt` khác lúc mở form, không upload và yêu cầu mở lại.
- Focus guard: file button không có `data-module-launcher`; file change không gọi `render()`; không thêm focus workaround hoặc generic `[data-module-id]` listener.

## Backward Compatibility

Legacy `attachment` local data URL vẫn đọc được. Unknown transaction fields và unknown attachment metadata không bị xóa trong normalizer. Không migration hàng loạt và không đổi Học phí/Báo cáo/Sổ quỹ.

## Tests

Smoke: `tests/f23-8b-chen-anh-chung-tu-trong-form-giao-dich-smoke.js`.

Coverage gồm UI field, allowlist, staging, object URL cleanup markers, upload/save lifecycle, edit keep/replace/remove, stale/center/double-submit guard, HTML filename safety, no PDF/Excel, no tuition sync, no launcher regression, docs markers và mojibake scan.

## Roadmap F23.8C

F23.8C NEXT public / Học phí: `Ghi nhận thanh toán` tự động tạo giao dịch Thu chi được liên kết, có idempotency và optional evidence handoff.

CODE COMPLETE - AWAITING MANUAL QA
