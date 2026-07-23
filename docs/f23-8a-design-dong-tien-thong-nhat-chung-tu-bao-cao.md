# F23.8A - Thiết kế dòng tiền thống nhất, chứng từ và Báo cáo

Date: 2026-07-23

Scope: design-only for a unified cashflow ledger, transaction evidence, tuition payment linkage, report drill-down, and safe empty-period undo. No runtime code, storage migration, upload, Auth, Supabase, SQL, deploy, Teacher secret, commit, or push.

## Audit Summary

Audited files:

- `src/cashflow-module.js`
- `src/tuition-module.js`
- `src/report-module.js`
- `src/main.js`
- `src/storage.js`
- `src/transaction-attachments.js`
- `src/supabase-storage.js`
- `src/image-compression.js`
- `docs/f23-9-thu-chi-edit-save-transaction-local-safe.md`
- related Thu chi, Học phí, Báo cáo smoke coverage

Related F23.1 docs were not present as a `f23-1` file in `docs/`; the closest current finance baseline docs are F23A/F23C finance wrapper docs and F23.9 edit-save docs.

## Current Thu Chi Schema

`cashflowTransactions` are center-scoped through `ichessCenterOS.cashflow.<currentStorageCenterId>`.

Actual local transaction fields normalized today:

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
- optional legacy local `attachment`
- unknown backward-compatible fields are preserved by normalization

Current totals come from `getCashflowStats()` over filtered transactions: total income, total expense, balance, and count. Báo cáo already reads `cashflowTransactions`; it does not independently add tuition paid totals.

Current manual transaction form fields are `type`, `category`, `amount`, `transactionDate`, `method`, `personName`, `recordedBy`, `note`, and optional legacy image `attachment`. F23.9 already made edit-save safer by collecting latest DOM values, reading latest current-center data, and replacing exactly one record.

## Current Tuition Schema And Period Logic

Tuition records are center-scoped through `ichessCenterOS.tuition.<currentStorageCenterId>`.

Actual current tuition record fields:

- `id`
- `studentId`
- `packageName`
- `totalSessions`
- `usedSessions`
- `hasTotalSessionsData`
- `hasUsedSessionsData`
- `totalAmount`
- `discountType`: `none`, `percent`, or `amount`
- `discountValue`
- `discountAmount`
- `paidAmount`
- `dueDate`
- `note`
- `payments[]`
- `currentTermNumber`
- `currentTermId`
- `startedAt`
- `termHistory[]`
- `createdAt`
- `updatedAt`

Actual `payments[]` fields:

- `id`
- `amount`
- `paidAt`
- `method`: `cash`, `transfer`, or `other`
- `collectorName`
- `note`
- `createdAt`

Actual term history fields mirror the package and payment fields: `id`, `termNumber`, `packageName`, `totalSessions`, `usedSessions`, `totalAmount`, discount fields, `paidAmount`, `dueDate`, `note`, `status`, `startedAt`, `endedAt`, and `payments[]`.

Current `calculateTuitionAmounts()` computes `paidAmount` as the larger of stored `paidAmount` and the sum of `payments[]`. `remainingDebt = max(payableAmount - paidAmount, 0)`. Current payment save creates a tuition `paymentRecord`, increments `record.paidAmount`, prepends it to `record.payments`, saves tuition, then calls `syncTuitionPaymentToCashflow()`.

Renewal currently archives the current period into `termHistory`, creates a new `currentTermId`, resets `usedSessions`, and may create an initial payment when `paidAmount > 0` in the renewal form. It then syncs those new payments to cashflow. There is no runtime undo-empty-period action yet.

## Current Sync Linkage

`syncTuitionPaymentToCashflow(payment, tuitionRecord, student)` creates one income transaction when it does not already find:

```txt
sourceModule === "hoc-phi"
sourcePaymentId === payment.id
```

The created transaction uses:

- `id = cashflow-from-tuition-${payment.id}`
- `type = income`
- `category = Học phí`
- `amount = payment.amount`
- `transactionDate = payment.paidAt`
- mapped method from tuition payment method
- `personName` from student/parent helper
- `recordedBy = payment.collectorName`
- `sourceModule = hoc-phi`
- `sourceType = tuition-payment`
- `sourcePaymentId = payment.id`
- `sourceTuitionId = tuitionRecord.id`
- `sourceStudentId = student.id`
- `sourceTermId = tuitionRecord.currentTermId`

Inventory movement sync follows the same broad idea with `sourceModule = kho-hang` and `sourceMovementId`.

## Current Attachment And Cloud Flow

There are two attachment concepts today.

Legacy local singular `attachment`:

- stored directly on a cashflow transaction;
- supports one image;
- shape: `id`, `name`, `type`, `size`, `dataUrl`, `createdAt`;
- accepts image data URLs only;
- size limit: `1MB` in local cashflow normalization.

Cloud transaction images:

- bucket: `transaction-images`;
- metadata table helper: `transaction_attachments`;
- metadata fields: `center_id`, `transaction_code`, `transaction_date`, `month_key`, `amount`, `cashflow_type`, `note`, `original_name`, `file_name`, `mime_type`, `size_bytes`, `storage_bucket`, `storage_path`, `uploaded_by`, optional `uploaded_by_name`, `created_at`;
- list by month or by `transactionCode`;
- delete removes storage object first, then metadata;
- signed URLs are generated when displaying attachments.

Upload lifecycle today:

1. Transaction must already exist.
2. Runtime derives a display `transactionCode` by date grouping.
3. File validation accepts JPEG, PNG, and WebP source images up to `10MB`.
4. Image is compressed to JPEG, max dimension `1920`, quality `0.82`.
5. Storage file name is `TC-yyyymmdd-seq-index.jpg`.
6. Storage path is center-scoped: `<centerId>/transaction-images/<year>/<month>/<fileName>`.
7. Upload uses `upsert: false` and retries indexes on duplicate.
8. Metadata is inserted after upload.
9. If metadata insert fails after upload, runtime reports an error; it does not currently guarantee cleanup.

Current cloud helpers only support images. They do not yet support PDF, XLS, or XLSX. They require Supabase config, signed-in user, and center membership.

## Source Of Truth Decision

Official design decision:

```txt
Mỗi lần tiền thật vào hoặc ra = một cashflow transaction.
Cashflow transaction là ledger entry trung tâm.
```

Tuition payment action should be represented by a linked cashflow transaction. Học phí should derive payment history, Đã thanh toán, and Còn nợ from linked ledger transactions for the target period. Báo cáo should continue reading the cashflow ledger only.

There must not be two independent financial sources where tuition `paidAmount` and cashflow transaction `amount` can both be edited freely and later reconciled by guesswork.

## Payment Event Model

F23.8C should introduce a clear payment action:

```txt
+ Ghi nhận thanh toán
```

This is the only action that means cash was actually received for tuition. `Lưu gói`, package creation, remaining debt, renewal, attendance usage, or creating a new period must not create a transaction by themselves.

Payment form fields:

- amount
- payment date
- method
- payer/person name
- recorded by
- note
- evidence
- current tuition period

Recommended source linkage for the generated cashflow transaction:

- `sourceModule = "hoc-phi"` for backward compatibility with existing badges;
- `sourceType = "tuition-payment"`;
- `sourcePaymentId = payment action id`;
- `sourceTuitionId = tuition record id`;
- `sourceStudentId = student id`;
- `sourceTermId = currentTermId`;
- future optional `sourcePeriodId` should alias or replace `sourceTermId` only through a migration plan, not ad hoc.

## Idempotency

Idempotency must not rely on amount, date, payer name, category, or note.

Recommended F23.8C behavior:

1. Create a `paymentActionId` before save, for example `payment-${tuitionId}-${termId}-${clientNonce}`.
2. Use deterministic transaction id: `cashflow-from-tuition-${paymentActionId}`.
3. Save guards with `isSaving`.
4. Before saving, read latest current-center cashflow and tuition state.
5. If a transaction with the same `sourceModule`, `sourceType`, and `sourcePaymentId` exists, return that existing transaction as the result instead of creating a duplicate.
6. Retry after partial UI failure must be safe.

Existing `sourcePaymentId` and deterministic `cashflow-from-tuition-*` already give a good local foundation, but F23.8C should make the payment action id explicit and attach it to the form state before submit.

## Manual And Synced Edit Rights

Manual transactions:

- editable in Thu chi according to F23.9;
- can change type, category, amount, date, method, person, recorded by, note, and evidence;
- save must continue to replace exactly one transaction.

Synced tuition payment transactions:

- Thu chi should allow viewing source, source badge, student/parent/period summary, evidence, and verification note;
- Thu chi should allow add/replace/remove evidence;
- Thu chi should not freely change `type`, category away from tuition, amount, payment date, or source ids;
- amount/date corrections should go through a controlled payment correction or future void/refund/reversal flow.

Reason: Học phí and Thu chi must not both own the same financial value independently.

## Attachment Model Decision

Current singular `attachment` is useful for local MVP but too narrow for the roadmap.

Design decision:

```txt
Canonical future model: attachments[]
F23.8B MVP: one staged image in the form, exposed through an attachments adapter.
Legacy singular attachment remains readable.
```

Recommended adapter contract:

```txt
getTransactionEvidence(transaction, cloudMetadata[])
-> normalized list of evidence items
```

For F23.8B, allow one image only:

- JPEG;
- PNG;
- WebP;
- source max `10MB`;
- compressed output JPEG when using existing cloud helper;
- local fallback may retain the existing `attachment` size limit unless intentionally raised in a later runtime phase.

PDF/XLS/XLSX should be designed into the normalized `attachments[]` shape but not enabled until a later phase has validation, storage, display, and download policy.

Future normalized evidence item fields:

- `id`
- `name`
- `mimeType`
- `size`
- `kind`
- `storageBucket`
- `storagePath`
- optional short-lived `signedUrl`
- `uploadedAt`
- `uploadedBy`
- `status`: `staged`, `uploaded`, `metadata-failed`, `upload-failed`, `removed`

Do not store signed URLs as permanent data.

## UI Placement

The transaction form must place evidence beside `Người ghi nhận`:

```txt
Người ghi nhận                    Chứng từ
[Admin DreamHome]                 [Chèn ảnh]
```

On narrow screens the row may wrap safely. The label is `Chứng từ`. MVP button label is `Chèn ảnh`.

After choosing a file, show compact state:

- thumbnail or file icon;
- file name;
- size;
- `Xem trước`;
- `Thay ảnh`;
- `Gỡ`.

This applies to manual `+ Thêm giao dịch`, `Sửa giao dịch`, and the Học phí `Ghi nhận thanh toán` form. The file button must not use a module launcher marker.

## Attachment Staging

When transaction is not saved:

- keep `File` object or draft metadata only in form state;
- optionally create an object URL for preview;
- do not write transaction/storage on file selection;
- do not persist raw `File` object to localStorage.

Cancel:

- discard staging;
- revoke object URL;
- do not create transaction;
- do not leave an orphan file.

Validation error:

- keep staging;
- keep preview;
- allow user to fix fields and save again.

Center switch or form close:

- clear staging;
- revoke object URL;
- block stale save.

## Upload And Save Lifecycle

Audited helpers favor deterministic storage path with an existing transaction/date/code. The cleanest future lifecycle is:

1. Validate form and file.
2. Generate transaction id and payment action id client-side before upload.
3. Generate deterministic transaction code or path using center id, transaction id or payment action id, not a fragile display sequence if possible.
4. Upload staged file to center-scoped path.
5. Insert metadata.
6. Save transaction with evidence reference.
7. If transaction save fails after upload, attempt cleanup: delete metadata and storage object.
8. If upload fails, do not save transaction; keep form and staged file for retry.
9. If metadata fails after storage upload and cleanup is unavailable, show `evidence upload failed` and keep a retry path; do not pretend the evidence is saved.

Because current runtime has reliable `deleteTransactionImageObject()` and `deleteTransactionAttachmentMetadata()` helpers, cleanup is feasible, but F23.8B must test both partial-failure directions. No upload should happen in F23.8A.

## Tuition Payment History And Derived Totals

Future Học phí detail should show:

```txt
Lịch sử thanh toán
```

Each row represents one linked cashflow transaction:

- date;
- amount;
- method;
- payer/person;
- recorded by;
- note;
- status;
- evidence indicator;
- action to open Thu chi transaction detail.

Derived rules:

```txt
Đã thanh toán =
sum(amount) of valid income cashflow transactions
where sourceModule = hoc-phi
and sourceType = tuition-payment
and sourceTuitionId = tuition.id
and sourceTermId = currentTermId
and current center matches
and transaction is not voided/reversed/refunded
```

```txt
Còn nợ = max(0, Cần thanh toán - Đã thanh toán)
```

Valid transaction rules:

- income tuition payment counts;
- malformed amount does not count;
- different center does not count;
- different period does not count;
- manual transaction does not count unless explicitly linked through the payment flow;
- future `voided`, `reversed`, or `refunded` transaction must be excluded or netted by explicit reversal rules.

Overpayment should be visible as `Đóng dư`, not silently moved to the next period.

## Report Contract

Báo cáo must continue to read the cashflow ledger as the financial source. It must not add tuition `paidAmount` on top of tuition-linked cashflow transactions.

No-double-count pipeline:

```txt
Tuition payment action
-> cashflow transaction
-> Báo cáo daily/weekly totals
```

Future report drill-down contract:

- query by center and date range;
- optional filters by `type`, `category`, `sourceModule`, `sourceType`, and evidence status;
- totals link to a transaction list;
- transaction row shows type, category, date, amount, source badge, and evidence indicator;
- evidence can be opened only for authorized roles in later permission phases.

F23.8A does not add runtime report UI.

## Undo Empty New Period

Design action:

```txt
Hoàn tác kỳ mới
```

Only allow when all conditions are true:

- current period has `usedSessions = 0`;
- no attendance-linked usage exists for the period;
- no linked payment cashflow transaction exists for current `currentTermId`;
- derived paid amount is `0`;
- no refund/correction/reversal exists;
- no dependent data exists;
- previous term exists in `termHistory`;
- current center matches.

Undo algorithm:

1. Read latest tuition record and linked ledger state.
2. Validate eligibility.
3. Remove only the empty current period.
4. Restore previous term snapshot as current.
5. Preserve previous term history, payments, attendance, and source references.
6. Do not delete any cashflow transaction.
7. Do not change `tuition.usedSessions` beyond restoring the prior term snapshot.

If any dependency exists, block and list reasons.

Renewal wording should become:

```txt
Chốt kỳ hiện tại và tạo kỳ mới
```

Confirmation must state that this is not a payment action, the old period moves to history, the new period starts with zero usage and zero paid amount, and old payments do not move to the new period.

## Center Scope And Privacy

Every transaction, tuition period, and evidence object must be scoped to current center.

Rules:

- no transaction center A linked to tuition center B;
- no evidence center A shown in center B;
- no report center B total from center A transactions;
- switching center clears payment/evidence staging;
- upload paths must include center id;
- source ids must resolve inside the same center.

Evidence may contain bank details, payer names, transaction references, and amounts. Use private storage and short-lived signed URLs. Do not log signed URLs or expose evidence through Teacher Portal/public surfaces in this roadmap.

## Missing And Stale Safety

Every future save must:

- read latest current-center transaction and tuition state before save;
- validate tuition id, student id, current period id, and center;
- check idempotency key;
- block stale form when period changed;
- avoid recreating deleted source records silently;
- handle uploaded evidence but stale source with cleanup or retry state.

## Roadmap

F23.8B - Manual transaction evidence in create/edit form:

- staging;
- same-row `Người ghi nhận` and `Chứng từ`;
- one image MVP;
- preview/replace/remove;
- adapter for legacy `attachment` and future `attachments[]`;
- no tuition sync change.

F23.8C - Học phí payment action to cashflow:

- `Ghi nhận thanh toán`;
- source linkage;
- idempotency;
- optional evidence handoff;
- transaction appears in Thu chi and Báo cáo;
- no duplicate.

F23.8D - Payment history and derived totals:

- `Lịch sử thanh toán`;
- `Đã thanh toán` and `Còn nợ` derived from linked ledger;
- period scope;
- no arbitrary direct paid total edit.

F23.8E - Evidence view and report drill-down:

- evidence indicator;
- safe viewer/open/download;
- report transaction drill-down;
- source badges.

F23.8F - Empty period undo and renewal confirmation:

- eligibility checks;
- restore prior period;
- block when dependencies exist;
- clearer wording.

F23.8G - Correction, void, refund, and reconciliation:

- no hard-delete financial history;
- reversal/refund;
- audit trail;
- source correction flow.

## Definition Of Ready

F23.8B is ready when implementation accepts:

- canonical future `attachments[]` with legacy `attachment` read compatibility;
- MVP one image;
- JPEG/PNG/WebP allowlist;
- staging object URL cleanup;
- upload/save partial-failure rollback plan;
- same-row form placement;
- center scope;
- no file chooser full render.

F23.8C is ready when implementation accepts:

- cashflow transaction as source of truth for real money;
- explicit payment action;
- deterministic payment action id;
- source linkage;
- idempotency;
- manual/synced edit rights;
- report no-double-count rule.

F23.8D-F are ready when implementation accepts:

- linked transaction query contract;
- valid transaction rules;
- period identity;
- void/refund exclusion readiness;
- report drill-down contract;
- empty-period undo conditions.

## Checks

Design-only required checks:

- `git diff --check`
- docs marker/content check
- mojibake scan
- `npm run build`

DESIGN COMPLETE - READY FOR F23.8B
