# F23.9 - Thu Chi Edit Save Transaction Local-Safe

Date: 2026-07-22

Scope: fix the existing `Sửa giao dịch` -> `Lưu giao dịch` lifecycle in Module Thu chi. No Auth, Supabase, SQL, deploy, Teacher secret, commit, push, or new attachment schema.

## Audited Files

- `src/cashflow-module.js`: Thu chi render, filters, form state, validation, transaction builder, stats, CSV, HTML escaping.
- `src/main.js`: Thu chi open/create/edit/save/delete wiring, storage calls, report print wiring nearby.
- `src/storage.js`: center-scoped `ichessCenterOS.cashflow.<centerId>` storage and transaction normalization.
- `src/report-module.js`: report day/week totals read from `cashflowTransactions`.

## Actual Transaction Schema

The current local transaction shape is:

- `id`
- `type`: `income` or `expense`
- `category`
- `amount`
- `transactionDate`
- `method`
- `personName`
- `recordedBy`
- `note`
- `sourceModule`
- `sourceType`
- `sourcePaymentId`
- `sourceTuitionId`
- `sourceStudentId`
- `sourceTermId`
- `sourceMovementId`
- `sourceItemId`
- `createdAt`
- `updatedAt`
- optional existing `attachment`

F23.9 does not add Excel/PDF/file attachment fields. Unknown backward-compatible fields are preserved by storage normalization instead of being dropped during save.

## Storage And Center Scope

Cashflow storage is center-scoped through `createCenterScopedStorageKey('cashflow')`, which resolves to `ichessCenterOS.cashflow.<currentStorageCenterId>`.

F23.9 adds `readStoredCashflow(defaultTransactions)` as a read-only snapshot helper. It normalizes the returned read model but does not write, remove, or migrate storage. Save still goes through `saveStoredCashflow()` exactly when the user explicitly submits the form.

Edit form state records the current center id. On save, the form center must still match `getCurrentResolvedCenterId()`, otherwise save is blocked and the draft remains visible.

## Create And Edit Mode

Create mode still creates a new transaction through the existing builder.

Edit mode now carries:

- `mode: 'edit'`
- `transactionId`
- `centerId`
- `openedUpdatedAt`
- draft `values`
- validation `errors`
- `isSaving`

Opening edit resolves by transaction id from the current in-memory center list and does not save storage. Field interactions update only the draft state.

## Validation

Edit reuses `validateCashflowForm()` from create. The validated editable fields are the real form fields:

- `type`
- `category`
- `amount`
- `transactionDate`
- `method`
- `personName`
- `recordedBy`
- `note`
- existing optional `attachment`

Validation blocks invalid type, empty category, invalid or non-positive amount, invalid date, empty `recordedBy`, and invalid existing image attachment. Negative money input is no longer converted into a positive amount by parsing.

## Immutable Replace

On submit, runtime collects the latest DOM values from `[data-cashflow-form-field]`, validates, checks center scope, reads the latest current-center cashflow snapshot, finds the transaction by id, builds:

```js
{
  ...existingRecord,
  ...validatedEditableFields,
  id: existingRecord.id,
  createdAt: existingRecord.createdAt,
  updatedAt: now
}
```

Then it replaces exactly one matching record. If zero or multiple replacements would happen, save is blocked. Edit never appends a duplicate transaction.

## Cancel And Stale Safety

Cancel clears the form state and does not write storage. Draft changes do not affect totals, list, detail, or report data before explicit save.

If the record is missing at save time, the app does not recreate it from the draft. It reloads the list and shows an error. If the center changed, it blocks save instead of writing center A data into center B.

## Double Submit Guard

The form has `isSaving`; submit returns immediately if a save is already in progress. Save controls render disabled while saving, and the submit handler is still bound through the normal single render lifecycle.

## Totals And Reports

Thu chi stats are computed from the filtered transaction list using `getCashflowStats()`. After replace, the same `cashflowTransactions` source is refreshed and passed to both Module Thu chi and Module Báo cáo.

Changing Thu to Chi, changing amount, or moving date updates:

- total income;
- total expense;
- balance;
- visible list/filter results;
- report daily totals;
- report weekly totals.

Report print flow remains unchanged.

## Focus Guard

Input/select/textarea events only update draft state and clear field errors. They do not call `render()`, reopen the module, use generic module launchers, or add focus workarounds. Save and cancel are explicit render boundaries.

## HTML Safety

Thu chi text continues to escape in list/form/report surfaces. F23.9 also fixes `escapeAttribute()` in `cashflow-module.js` so legacy category option values cannot inject raw HTML through attribute values.

## Tests

Smoke: `tests/f23-9-thu-chi-edit-save-transaction-local-safe-smoke.js`.

Coverage includes edit by id, center scope, prefill, read-only storage snapshot, cancel no-save, immutable replace, id/createdAt preservation, updatedAt update, no duplicate append, Thu to Chi totals, amount/date report refresh, stale missing record, center isolation, unknown field preservation, HTML escaping, validation for amount/date/required fields, double-submit source guard, no generic launcher, no new attachment schema, report source preservation, and output mojibake scan.

## Roadmap

F23.8 remains later for Excel/PDF/image attachment design and implementation. F23.9 intentionally does not start that work.

CODE COMPLETE - AWAITING MANUAL QA
