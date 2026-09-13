# V2-7A Inventory Blind Cycle Count

V2-7A is an additive workflow around the C5.6 Inventory authority. It does not
create a second stock ledger and never creates a Finance transaction.

## Authority model

- A count snapshots every active item for one exact center, including private
  expected quantity and item version evidence.
- The draft RPC projection returns only count identity, due state, and item
  identity. Expected quantity, item version, observed quantity, and variance
  are absent from the payload until submission.
- Submission freezes a complete set of non-negative observed quantities. It
  checks every snapshotted item version and does not mutate stock.
- Reconciliation requires a non-empty explanation for every non-zero variance.
  It locks and rechecks every scoped item before writing anything.
- Each discrepancy inserts one immutable `center_inventory_movements` row and
  performs the paired `center_inventory_items` quantity/version update in the
  same database transaction. Zero variance creates no movement.
- Actor identity, membership, role, server time, before/after quantity, and
  item versions are server-authored. A stale item makes the whole command fail.
- Command results are scoped by center, actor, and idempotency key. Exact retry
  returns the stored result; changed intent returns `IDEMPOTENCY_CONFLICT`.

## Lifecycle and reminders

The lifecycle is `DRAFT` → `SUBMITTED` → `RECONCILED`, with cancellation from
either incomplete state. Cancellation never changes stock. An explicit due date
produces server-derived `UPCOMING`, `DUE`, or `OVERDUE` state only while the
count is incomplete.

The V2-5 Notification Center consumes that exact-center authoritative state.
Due and overdue counts create one stable signal per count; reconciliation or
cancellation removes it naturally. Opening a signal selects the corresponding
count inside Inventory.

## Security boundary

Cycle-count tables use forced RLS and expose no direct browser table access.
Authenticated access is through the two exact-center RPCs. Active members may
read; `owner`, `admin`, `center_admin`, and `qtv` may mutate. Other roles and
cross-center callers fail closed.

The guarded local QA runner may work around two pre-existing empty-database
migration blockers (`pg_net` absence and the DreamHome data-repair precondition)
only inside the disposable local database. Frozen repository migrations remain
byte-identical and are never weakened.
