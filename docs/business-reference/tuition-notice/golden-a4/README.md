# TBHP A4 Golden References

Thư mục này chứa các PDF tham chiếu đã được duyệt cho Phiếu Thông Báo Học Phí (TBHP).

Các file trong đây là **visual/business-reference authority** cho renderer runtime.
Chúng KHÔNG phải file runtime output và KHÔNG được dùng trực tiếp để thay thế dữ liệu thật.

## Scope

Production scope hiện tại:

- 1–16 buổi → geometry family `TBHP-16`
- 17–24 buổi → geometry family `TBHP-24`
- chỉ render đúng số dòng `N`
- khổ giấy A4
- 1 trang
- 32+ buổi: deferred

## Golden files

### `tbhp-a4-16-golden.pdf`

Golden visual authority chính cho gói từ 1–16 buổi.

Dùng để đối chiếu:

- page geometry
- typography
- header/title
- left-column layout
- session table
- payment block
- QR
- footer
- 16-row geometry

### `tbhp-a4-24-golden.pdf`

Golden visual authority chính cho gói từ 17–24 buổi.

Dùng để đối chiếu:

- 24-row density
- long student name wrapping
- one-page A4 composition
- payment block + QR + footer stability

### `tbhp-a4-08-proof.pdf`

Proof case cho gói nhỏ.

Chứng minh:

- chỉ render đúng `N` rows
- không stretch row
- QR/payment/footer giữ vị trí ổn định

### `tbhp-a4-16-legacy-6-proof.pdf`

Behavior proof cho học viên legacy.

Chứng minh:

- các buổi trước iChess nhưng không biết ngày/giáo viên → để trống
- occurrence iChess biết thật → ngày thật + giáo viên thật
- future rows → để trống

## Frozen visual contract

- A4 thật: khoảng `595.28 × 841.89 pt`
- 1 trang cho scope 1–24 buổi
- body/dynamic text: khoảng 11 pt
- session table: khoảng 10 pt
- notice: khoảng 10 pt italic
- title: khoảng 18 pt bold
- row height: khoảng 13.3 pt
- không auto-shrink từng field
- không visible field boxes
- không gray debug backgrounds
- QR/payment/footer dùng fixed geometry
- teacher dùng display name ngắn
- legacy unknown cells để trống
- future cells để trống

## Important

Golden files không được tự ý chỉnh sửa để phù hợp với code.

Nếu runtime không khớp golden:
- sửa renderer;
- không sửa golden chỉ để test PASS.

Nếu business/document strategy thay đổi trong tương lai:
- tạo revision mới có review rõ ràng;
- không âm thầm overwrite các file này.

## Integrity

Đã kiểm tra ngày 27/09/2026 bằng SHA-256 và PDF parser. Không sửa PDF golden.

| File | Role | Page size (pt) | Pages | Production range | SHA-256 |
|---|---|---:|---:|---|---|
| `tbhp-a4-08-proof.pdf` | Small-N proof | 595.2756 × 841.8898 | 1 | N=8, family 1–16 | `5735a15d5014fdf71ca260667265f5959428dfaf597e3befe4a54b61be6f33a0` |
| `tbhp-a4-16-golden.pdf` | 1–16 golden | 595.2756 × 841.8898 | 1 | 1–16 | `724194163f19a83a400eba65381d6ceeaf80e21a8b5a56561dde30c1982f0a08` |
| `tbhp-a4-24-golden.pdf` | 17–24 golden | 595.2756 × 841.8898 | 1 | 17–24 | `3584b400d39921312b4345ee2e62d7e168df95c60e93019338283ca34f04bf13` |
| `tbhp-a4-16-legacy-6-proof.pdf` | Legacy behavior proof | 595.2756 × 841.8898 | 1 | Legacy N=16, family 1–16 | `92c3a81f31cb7d9d0902cfd23dac6292ba0c49f7b46e94530c7e8db56a77ad3b` |
