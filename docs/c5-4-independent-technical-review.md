# C5.4 independent technical review

Review date: 2026-08-14

Verdict: **PASS** after targeted C5.4 remediation. Remaining findings are `CRITICAL 0`, `HIGH 0`, `blocking MEDIUM 0`.

## Migration identity and inherited integrity

- Accepted base migration: `202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql`
- Accepted base SHA-256: `60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27`
- Review hardening migration: `202608140006_c5_4_reconciliation_currentness_hardening.sql`
- Hardening SHA-256: `EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993`
- The accepted base migration was not edited during review.
- SHA-256 verification passed for all 24 inherited/frozen migrations through P4B, C5.1, C5.2, and C5.3.

## Findings and remediation

1. **HIGH — resolved: ambiguous create retry could duplicate a manual transaction.** The UI rebuilt create-only `transaction_id`, `local_source_id`, and staged attachment IDs on resubmit, so the retry map could select a new idempotency key after an ambiguous network result. Retry identity now excludes regenerated resource IDs, includes a stable in-memory staged-file intent, reuses the original pending server command/key, and removes any superseded unbound retry upload. Changed money or changed file intent produces a different fingerprint.
2. **MEDIUM (blocking) — resolved: reconciliation close could persist a stale preview balance.** A ledger command could commit after reconciliation upsert and before close. Additive migration `202608140006` locks the exact-center cashbook and recomputes system balance/difference at the OPEN → CLOSED edge; it also rejects reconciliation writes inside a closed period. Guarded DB QA proves an intervening transaction changes the final closed balance.
3. **MEDIUM (blocking) — resolved: malformed authoritative rows could be silently filtered from a successful pull.** The adapter now rejects the entire response as `INVALID_SERVER_RESULT` if any category, transaction, attachment, settings, or reconciliation projection is invalid. It does not advance totals from a partial server result.

The historical `f23-8b-1-dong-bo-attachment-cloud-transaction-form-edit-smoke.js` still asserts the removed direct metadata-update implementation (`attachmentDraft.source === 'cloud'` and `updateTransactionAttachmentMetadata`). That assertion is stale after C5.4 moved bound metadata changes into the authoritative Finance RPC. It was recorded, not modified to manufacture a green historical result. Current attachment security is covered by the C5.4 DB matrix.

## Adversarial verdict matrix

| Boundary | Verdict and physical evidence |
| --- | --- |
| Transaction/cashflow | PASS — dedicated server table; authenticated mutation RPC; POSTED/VOIDED evidence state; no active Finance local-storage writes. UI projection changes only after commit plus authoritative pull. |
| Category | PASS — exact-center UUID reference, versioned create/update/archive, normalized-name uniqueness, archived categories cannot serve new transactions, and historical transaction names remain snapshotted. |
| Opening balance/settings | PASS — one primary-key row per center, integer VND, `expected_version`, serialized mutation, authoritative pull. No browser-specific alternate balance ID exists. |
| Reconciliation | PASS — exact-center/date uniqueness, version/currentness checks, authoritative balance calculation, OPEN/CLOSED audit state, closed-period mutation guard, and close-time recomputation from the latest ledger. |
| Attachment binding/private storage | PASS — existing private bucket reused; composite center foreign keys; actor-owned draft binding; one active transaction/attachment binding; wrong-center bind rejected; bound metadata update/delete guarded; unbind retains the private file. Storage access remains exact-center and role-gated. |
| Money integrity | PASS — transaction amount is positive safe integer VND; opening/actual cash are non-negative safe integers; malformed values, invalid dates/types/categories and unsafe result projections fail closed. Totals and balances are derived from authoritative transaction rows, not writable counters. |
| Same-center A↔B | PASS — A create → B read, B edit → A read, shared settings, reconciliation and categories proven with distinct authenticated clients. |
| Fresh context | PASS — a separate authenticated client with no persisted Finance state reconstructs categories, transactions, settings, reconciliations and bound attachment metadata through the list RPC. |
| Cross-center | PASS — unrelated-center read/write returns denial; exact-center foreign keys prevent category/attachment swaps; leak count is zero in guarded DB QA. |
| Owner A→B→A | PASS — three authoritative pulls return A-only, B-only, then A-only projections with no union/copy/fallback. |
| Refresh | PASS — signed-in bootstrap, center switch, module open/reopen and manual “Làm mới” call authoritative pull. A failed refresh remains visibly failed and is not labeled freshly synchronized. Realtime is intentionally not enabled. |
| Failure safety | PASS — RPC/network failure returns failure, retains the prior projection, and cannot prepend a proposed transaction or advance ledger totals. A committed-but-unrefreshed command is reported distinctly without fake local success. |
| Conflict/idempotency | PASS — stale versions reject; same key/intent replays the stored result; changed intent/key pairing conflicts; semantic UI retry reuses the original create command and cannot duplicate the transaction. |
| Tuition boundary | PASS — payment creates one protected Finance row; server revalidates authoritative C5.2 package/period/student, ledger-paid total and outstanding amount under the center lock. Duplicate source and concurrent overpayment fail. Attendance → Tuition remains read-only and no automatic charge/session deduction was added. |
| Audit | PASS — server-time append-only events retain actor, center, action, entity, before/after state and command idempotency key behind forced RLS/no direct grants. |

## Legacy Finance verdict

- Classification: exact known samples are `FIXTURE_SAMPLE`; empty/absent reconstructable state is `RECONSTRUCTABLE_CACHE`; configured/non-zero settings are `REAL_LOCAL_ONLY`; non-exact, non-empty or malformed state is `UNCERTAIN`.
- Quarantine: real/uncertain data is copied before authoritative replacement to `ichessCenterOS.c5_4.legacyFinanceSnapshot.<exact-center>.v1` with raw source values/keys, center, capture time, counts, totals, opening balance, schema and SHA-256 checksum.
- Recoverability: original Finance keys are retained; a verified existing snapshot is reused and never treated as an active ledger.
- Silent auto-upload: **NO**. The quarantine module has no Supabase/RPC/table client and module open never imports legacy values.
- Silent real-data deletion: **NO**. Neither quarantine nor authoritative refresh removes the four legacy source keys.
- Server empty + legacy local: authoritative empty arrays remain active; legacy data is preserved but not imported.
- Server nonempty + legacy local: server arrays replace the active projection; legacy data is preserved but never unioned or merged.
- Controlled import: **DEFERRED / MIGRATION REQUIRED**. No first-browser authority and no implicit migration UI were introduced. A future import must provide preview, explicit authorized confirmation, exact-center scope, idempotency and duplicate/conflict handling.

## Targeted evidence

- `C5_4_FINANCE_CASHBOOK_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `C5_4_FINANCE_CASHBOOK_LOCAL_DB_QA: PASS`
- `C5.1 authoritative core semantic smoke: PASS`
- `C5.2 attendance + tuition authoritative semantic smoke: PASS`
- `C5_3_CRM_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- Changed JavaScript `node --check`: PASS
- Production build: PASS; only the pre-existing chunk-size advisory remains.
- `git diff --check`: PASS
- Remote Supabase/Auth/Edge/Storage/app apply/deploy: **NOT RUN**
- C5.5 implementation: **NOT STARTED**
