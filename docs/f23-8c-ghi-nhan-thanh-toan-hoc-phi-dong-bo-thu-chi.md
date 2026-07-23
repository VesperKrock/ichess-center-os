# F23.8C - Ghi nhan thanh toan Hoc phi dong bo Thu chi

## Source Of Truth

Tu F23.8C, so tien `Da thanh toan` va `Con no` cua ky Hoc phi hien tai duoc tinh tu ledger Thu chi. Field legacy `tuition.paidAmount` va mang `tuition.payments` chi con la du lieu lich su/fallback khi chua doc ledger, khong duoc dung de cong them tien khi nguoi dung bam `Luu goi`.

Bao cao ngay/tuan tiep tuc doc doanh thu tu `cashflowTransactions`, khong cong them `paidAmount` cua Hoc phi de tranh double count.

## Payment Form

Trong detail ky Hoc phi co action rieng `Ghi nhan thanh toan`. Form gom so tien, ngay thu, phuong thuc, nguoi nop, nguoi ghi nhan, ghi chu va anh chung tu optional. So tien mac dinh bang so con no cua ky hien tai, cho phep thanh toan tung phan, chan `amount <= 0`, chan vuot con no va chan khi ky da thanh toan du.

`Luu goi` chi luu cau hinh goi/ky va khong tao transaction Thu chi. Khi edit/gia han ky da dung ledger, phan `Da thanh toan` trong form la readonly va lay tu cac giao dich linked.

## Period Identity

Moi thanh toan gan voi identity ky hien tai bang `sourceTuitionId` va `sourcePeriodId`. `sourcePeriodId` uu tien `currentTermId`, fallback ve `id + currentTermNumber` cho ban ghi cu. Query tinh tien chi tinh cac transaction cung tuition va cung period de khong lan tien giua cac ky.

## Transaction Linkage

Save thanh toan tao dung mot transaction Thu chi:

- `type: income`
- `category: Hoc phi`
- `sourceModule: hoc-phi`
- `sourceType: tuition-payment`
- `sourcePaymentId`
- `sourceTuitionId`
- `sourceStudentId`
- `sourceParentId`
- `sourceTermId`
- `sourcePeriodId`

Transaction hien ngay trong Thu chi, co badge nguon `Dong bo tu Hoc phi`, va duoc Bao cao tinh nhu mot khoan thu ledger binh thuong.

## Idempotency

Moi lan mo form tao mot `sourcePaymentId` on dinh cho attempt do. Khi save, runtime kiem tra ledger moi nhat cua current center; neu da ton tai transaction cung `sourceModule/sourceType/sourcePaymentId` thi khong insert ban ghi thu hai. Trang thai saving cua form cung chan double-click trong cung phien UI.

## Attachment Reuse

Anh chung tu optional dung lai staging/cloud helper cua F23.8B. File duoc upload len bucket private theo current center va transaction id/code. Khi save cashflow that bai sau upload, metadata vua upload duoc cleanup; khi chi sua field Hoc phi khac thi khong upload lai anh.

Flow replace/remove cua transaction van do Thu chi/F23.8B quan ly. F23.8C khong xoa anh cu truoc khi transaction save thanh cong.

## Legacy Paid Guard

Neu ky co `paidAmount > 0` legacy nhung chua co linked transaction trong ledger, UI hien canh bao `chua doi soat` va khong tu cong/migrate. F23.8C khong backfill du lieu cu de tranh double-count.

## Synced Transaction Protection

Giao dich sinh tu Hoc phi khong duoc sua nhu giao dich manual trong Thu chi. UI chan edit form, chan doi loai/danh muc/so tien qua save path, chan hard-delete, va khong bi category rename hang loat ap vao. Cac hanh dong void/refund/history day du de lai cho phase sau.

## Report No Double Count

Bao cao chi tong hop tu cashflow ledger. Hoc phi chi tao nguon du lieu ledger, khong con dong logic rieng vao Bao cao. Nhung ky legacy chua doi soat khong duoc dua vao Bao cao cho den khi co backfill rieng.

## Guards

F23.8C giu role/current-center guard cua SUP-CF.1 va khong them Auth/Supabase migration/SQL/deploy. Cloud attachment tiep tuc dung bucket private va metadata theo current center.

## Tests

Smoke F23.8C kiem tra:

- tinh tien Hoc phi tu linked ledger theo period;
- form thanh toan co cac field bat buoc va chung tu optional;
- `Luu goi` khong con field `paidAmount` editable;
- save path tao transaction linked, co idempotency va cleanup attachment;
- transaction synced bi khoa edit/delete manual;
- storage normalize source linkage;
- Bao cao khong cong `paidAmount`;
- doc va source khong co mojibake markers.

## F23.8D

F23.8D se xu ly lich su/backfill/doi soat cac ky da co `paidAmount` legacy truoc F23.8C. Phase nay khong lam payment history day du, refund/void, hoan tac ky hoac report drill-down.
