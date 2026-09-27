# Tuition Receipt A5 Golden References

Approved visual references for the iChess Tuition Receipt.

These PDFs are visual/business-reference authority.
They are NOT runtime outputs and must not be used as filled production receipts.

## Scope

- A5 landscape
- one page
- new registration
- renewal
- full-payment-only
- PDF receipt only

## Golden files

### receipt-a5-new-registration-golden.pdf

Authority for:
- Đăng ký mới
- Kỳ 1
- populated optional Customer fields
- cash payment example

### receipt-a5-renewal-golden.pdf

Authority for:
- Tái đăng ký
- later cycle
- discount/material-fee example
- missing optional Customer fields
- transfer payment example

## Frozen business fields

Keep:
- Receipt number
- payment date
- center
- payer
- student
- address / email / CCCD optional
- registration type
- cycle
- package/program
- class if available
- original tuition
- discount
- material fee
- total
- actual received
- amount in words
- payment method
- payer signature
- collector signature/name

Removed:
- remaining balance
- tuition-effective-from date
- next payment cycle

## Receipt numbering

Canonical format:

CENTER_CODE-DDMMYY-DAILY_SEQUENCE

Example:

DH-270926-001

## Visual contract

- A5 landscape
- approximately 595.28 × 419.53 pt
- one page
- title approximately 16 pt
- body approximately 10.5 pt
- optional missing data may remain blank
- missing Center address/hotline must not leave meaningless empty header labels
- no spreadsheet-style dense grid
- no automatic per-field font shrinking

## Prototype watermark

“BẢN GIẢ LẬP - KHÔNG SỬ DỤNG THỰC TẾ”

exists only in golden prototypes.

Production runtime must not render it.

## Integrity

Runtime implementation should record SHA-256 for both approved PDFs here.

| File | Role | Page size | Pages | SHA-256 |
|---|---|---:|---:|---|
| receipt-a5-new-registration-golden.pdf | New registration | 595.2756 × 419.5276 pt | 1 | `1a28d69afb99102a7905bdf7af61795811aca28740ad3352357cfbfe412b42e5` |
| receipt-a5-renewal-golden.pdf | Renewal | 595.2756 × 419.5276 pt | 1 | `cb9086b3f3b9d235c8d320e3fed1b2b19b47ee2b10208e6f884a49ce7a582f9a` |


Prototype Receipt numbers are illustrative only.
Runtime numbering authority:
CENTER_CODE-DDMMYY-DAILY_SEQUENCE.
