# F23.8B.1 - Dong bo attachment cloud voi form edit giao dich

## Root Cause

Blocker den tu viec cac be mat UI doc hai nguon khac nhau:

- Row giao dich tinh so anh tu `cloudStatus.attachments`, du lieu nay duoc preload tu bang `transaction_attachments`.
- Kho anh giao dich cloud query truc tiep `transaction_attachments` theo current center, month/transaction code va dung signed URL rieng.
- Form `Sua giao dich` lai khoi tao `attachmentDraft` chi tu `transaction.attachment` local legacy.

Vi vay transaction da co metadata cloud van hien `1 anh` o row va gallery, nhung edit form khong thay `transaction.attachment` nen hien `Khong co chung tu`.

## Canonical Hydrate Rule

Khi mo edit transaction da ton tai:

1. Resolve current center canonical bang `getCurrentResolvedCenterId()`.
2. Doc latest local cashflow snapshot cua center hien tai.
3. Tim transaction theo `transactionId`.
4. Render form voi `attachmentDraft.mode = loading`.
5. Tu `transactionId`, tinh transaction code canonical trong danh sach latest.
6. Query cloud metadata bang current center + transaction code.
7. Neu cloud co metadata anh hop le, hydrate draft thanh `keep-existing-cloud`.
8. Neu cloud khong co anh, fallback legacy `transaction.attachment` thanh `keep-existing-legacy`.
9. Neu ca hai deu khong co, draft ve `none`.
10. Neu query loi, draft ve `error`, hoac giu legacy fallback kem error neu co.

Bang hien tai chua co cot `transaction_id`, nen transactionId duoc dung de resolve transaction code truoc khi query `transaction_attachments`.

## Loading/Error/None

Trong luc query cloud chua xong, form hien `Dang tai chung tu...` va khong hien `Khong co chung tu`.

Trang thai error hien `Khong the tai thong tin chung tu` va khong cho upload moi mu mot cach de gay duplicate. Save bi chan neu draft van `loading` hoac `error`.

Trang thai `none` chi duoc render sau khi cloud query thanh cong va legacy attachment cung khong ton tai.

## Cloud Before Legacy

Neu cloud metadata va legacy `transaction.attachment` cung ton tai, form uu tien cloud. MVP chi hien mot attachment; legacy khong bi xoa tu dong va van duoc preserve neu user khong thay/gỡ.

Draft state hien co:

- `loading`
- `none`
- `keep-existing-cloud`
- `keep-existing-legacy`
- `staged-new`
- `remove-existing`
- `error`

Signed URL chi dung de preview/thumbnail tam thoi. Canonical persisted state van la metadata id, storage path, filename, mime, size, uploader va thoi gian upload.

## No Reupload On Field Save

Neu user mo transaction da co cloud attachment va chi sua amount/note/category/date:

- Khong goi upload blob.
- Khong goi create metadata moi.
- Khong doi storage path.
- Khong doi uploader/uploadedAt cua attachment.
- Sau khi local transaction save thanh cong, app update metadata hien huu cho cac field hien thi trong gallery.

## Replace/Remove Lifecycle

Replace:

- Chon file moi chi chuyen draft sang `staged-new`.
- Anh cu van ton tai den khi Save thanh cong.
- Save upload anh moi, tao metadata moi, save transaction local, roi moi cleanup object/metadata cu.
- Cancel revoke object URL va giu anh cu.

Remove:

- Bam `Go` chi chuyen draft sang `remove-existing`.
- Cancel giu anh cu.
- Save thanh cong moi delete storage object va metadata cloud cu.
- Row, form edit va gallery refresh theo metadata moi.

## Cache Invalidation

Sau create/replace/remove hoac update metadata field-only, app goi `loadCurrentMonthCloudAttachments()`. Neu gallery dang mo, cac flow upload/manager hien co tiep tuc refresh gallery theo explicit action. Phase nay khong them realtime subscription moi.

## Center/Stale Safety

Moi hydrate request co `cashflowAttachmentHydrateToken`. Response bi bo qua neu:

- token khong con khop;
- form da dong;
- transactionId khac;
- centerId cua form khac current center;
- current center da doi.

Center switch revoke staged object URL, clear form state va invalidate token.

## SUP-CF.1 Boundary

SUP-CF.1 guard duoc giu nguyen:

- Metadata list/update/delete di qua `runAuthorizedAttachmentOperation`.
- Role hop le van la `owner` hoac `center_admin`.
- Moi operation truyen current center canonical.
- Storage bucket van private va preview dung signed URL.
- Khong hardcode email/center.
- Khong apply remote SQL trong phase nay.

## Tests

Coverage duoc them/cap nhat:

- F23.8B.1 hydrate smoke.
- F23.8B staging/edit smoke.
- F23.9 edit-save smoke.
- SUP-CF.1 current-center authorization smoke.
- Syntax check runtime files.
- Build, diff check va mojibake scan.

## Roadmap

F23.8C NEXT public: Hoc phi ghi nhan thanh toan tu dong tao giao dich Thu chi duoc lien ket.

F23.8E1 TODO public: In/Xuat PDF tung giao dich kem chi tiet va toan bo hinh anh chung tu.
