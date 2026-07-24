# F23.8D - Lich su thanh toan va derived totals theo ledger

## Payment Query Contract

Payment history is a projection from the Thu chi cashflow ledger. A tuition payment transaction is valid only when it is an active income transaction with category `Hoc phi`, `sourceModule = hoc-phi`, `sourceType = tuition-payment`, the same tuition id, the same period id, and the same current center when a transaction-level `centerId` exists.

Local cashflow storage is already center-scoped, so old transactions without `centerId` remain valid inside the current center snapshot. Transactions with a mismatched `centerId` are ignored.

## Valid Transaction Rules

The helper ignores manual `Hoc phi` category rows without source linkage, rows from another period, rows from another tuition record, rows from another center, malformed or non-positive amounts, and rows marked `voided`, `refunded`, or `reversed`.

Sort order is deterministic: newest transaction date first, then newest `createdAt`, then id/code tie-breaker. Rendering does not mutate the ledger array.

## Period Identity

The current period uses `currentTermId` and falls back to `term-<tuitionId>-<currentTermNumber>` for older local records. Historical periods use their own term `id`; they do not fall back to the current period id and do not use array index or period label as identity.

## Derived Paid And Outstanding

For each period:

```txt
Da thanh toan = sum(valid linked tuition-payment cashflow amounts)
Con no = max(0, Can thanh toan - Da thanh toan)
```

No derived total is written back to tuition storage. `tuition.paidAmount` and legacy `payments[]` are shown only as unreconciled read-only context when they are not represented by linked ledger transactions.

## Timeline UI

The tuition detail panel shows `Lich su thanh toan` for the current period. Each row shows date, amount, method, payer, recorder, note, safe transaction display code, evidence status, and source badge `Dong bo tu Hoc phi`.

The timeline is read-only. It does not expose source ids, storage paths, signed URLs, or localStorage keys, and it does not provide edit/delete/refund/void actions.

## Payment Status

The payment summary exposes:

- `Chua thanh toan`
- `Thanh toan mot phan`
- `Da thanh toan du`
- overpayment warning when malformed data exceeds the payable amount
- `Chua doi soat` when legacy paid data is not represented by linked ledger rows

The header shows total payment count and linked ledger amount.

## Current Period Behavior

After F23.8C saves a payment, the detail summary and timeline refresh from the latest in-memory/current-center cashflow transactions. No payment draft is rendered as persisted history.

## Historical Period Behavior

Each item in `Lich su ky hoc` has its own payment summary and its own ledger timeline using that term id. Current-period payments are not counted in historical periods, and one historical period does not borrow payments from another.

## Evidence Indicator

F23.8D only displays evidence status:

- `Co chung tu`
- `Khong co chung tu`

Evidence viewing and richer drill-down remain in Thu chi/F23.8B/B.1 and later F23.8E work.

## Open Transaction Flow

`Mo giao dich Thu chi` resolves the latest transaction in the current center snapshot, opens/focuses Module Thu chi, and filters to the source transaction. It does not create a transaction. F23.8C synced transaction protection still blocks editing financial fields and hard-delete.

## Legacy Unreconciled State

If a period has legacy `paidAmount` greater than the linked ledger amount, the UI shows `So da thanh toan cu chua duoc doi soat` with legacy amount, linked ledger amount, and unreconciled delta. F23.8D does not backfill, migrate, reset, or create baseline transactions.

## Report No Double Count

Bao cao continues to use cashflow transactions as the only financial source. Tuition timelines are read-only projections and are never added to report totals.

## Center Stale Focus Safety

The helper accepts a center id and rejects mismatched transaction-level centers. Runtime passes the current resolved center to tuition rendering. Timeline buttons are plain buttons, not module launchers, and no focus workaround or generic module listener is added.

## Tests

Smoke coverage checks query contract, period identity, valid transaction rules, derived totals, current and historical timelines, payment states, evidence indicator, open transaction flow markers, legacy unreconciled panel, report no-double-count, F23.8C/F23.9 protections, and mojibake safety.

## Limits And Roadmap

This phase does not implement backfill, refund, void, correction, report drill-down, PDF export, transaction evidence viewer in tuition, or period undo.

F23.8E can add report/evidence drill-down after manual QA passes.
