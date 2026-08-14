# C5.4 Finance + Cashbook authoritative shared truth

Status: local QA PASS; ready for independent technical review/checkpoint. No remote apply/deploy and no Git commit/push were performed in this implementation turn.

## Physical root cause removed

Before C5.4, `cashflow`, `cashflowCategories`, `cashbookSettings`, and `cashbookReconciliations` were loaded and mutated through center-scoped `localStorage`. Each browser/account therefore owned an independent ledger. Transaction attachment bytes/metadata were private-cloud data, but their parent transaction and its code were browser-local, so the relationship was not authoritative.

C5.4 makes dedicated server tables and two authenticated RPCs the only active Finance/Cashbook authority. The browser starts with empty Finance projections, pulls exact-center state on sign-in, center switch, module open/reopen, and manual refresh, and changes the view only after a server commit followed by a successful authoritative pull.

## Server contract

- `finance_transaction`: integer VND (`amount_minor bigint`), immutable stable transaction code, version, POSTED/VOIDED evidence state, protected Tuition source identity.
- `finance_category`: exact-center, versioned, unique normalized name, archived instead of deleted; transaction keeps a category-name snapshot.
- `finance_cashbook_settings`: exact-center singleton, versioned opening balance/date.
- `finance_reconciliation`: exact-center/date, server-calculated system balance, versioned OPEN/CLOSED state.
- `finance_transaction_attachment_binding`: exact-center composite foreign keys bind one active private attachment to one active transaction. Bound metadata cannot be changed or deleted directly; RPC updates it with the transaction.
- `finance_command_result`: actor + center + UUID idempotency ledger with SHA-256 intent digest.
- `finance_audit_event`: append-only server audit projection for category, transaction, settings, and reconciliation commands.

All Finance tables have RLS enabled and forced, no direct client/service-role table grants, and no permissive policies. Only authenticated `c5_4_list_finance_shared_truth` and `c5_4_mutate_finance_shared_truth` are exposed. Finance and private attachment management allow active `owner`, `admin`, `center_admin`, or `qtv`; teacher and unrelated roles fail closed. C5.4 intentionally uses refresh-on-open rather than adding Finance tables to Realtime publication.

The server serializes all commands per center. Every mutable resource requires `expected_version`; retries require the same intent for the same idempotency key. Closed reconciliation periods reject affected transaction/settings mutations. Manual transactions are voided, never hard-deleted. Tuition-payment transactions are authoritative Finance rows but cannot be edited/voided from Thu chi. Before accepting a Tuition payment, the server locks the center command stream, revalidates the authoritative Tuition package/period/student identity, recomputes payable and already-posted Finance payment totals, and rejects legacy-payment mismatches or concurrent overpayment.

Independent review added `202608140006_c5_4_reconciliation_currentness_hardening.sql`. Its trigger takes the same exact-center cashbook lock and recomputes authoritative system balance/difference at the OPEN → CLOSED edge, so an intervening ledger commit cannot turn a stale reconciliation preview into a closed balance. It also rejects reconciliation insert/update inside an already closed period. The accepted `202608140005` migration bytes remain unchanged.

## Legacy local Finance safety

The legacy inventory is exactly:

- `ichessCenterOS.cashflow.<center>`
- `ichessCenterOS.cashflowCategories.<center>`
- `ichessCenterOS.cashbookSettings.<center>`
- `ichessCenterOS.cashbookReconciliations.<center>`

Known exact samples are classified `FIXTURE_SAMPLE`; absent/empty reconstructable collections are `RECONSTRUCTABLE_CACHE`; configured opening balances are `REAL_LOCAL_ONLY`; other non-empty or malformed data is `UNCERTAIN`.

Real/uncertain data is copied once into the immutable app-owned key `ichessCenterOS.c5_4.legacyFinanceSnapshot.<center>.v1`, including exact source keys/raw values, center, capture time, counts, income/expense totals, opening balance, schema marker, and SHA-256 checksum. The source keys are not silently deleted. The snapshot is explicitly `QUARANTINED_NOT_ACTIVE` and `MIGRATION_REQUIRED`; it is never merged/uploaded by module open. A future import remains deferred and must have preview, explicit confirmation, exact-center scope, and idempotency.

## Runtime boundaries

- Local Finance arrays are memory projections only; the four legacy keys are not read or written by `main.js` as active authority.
- Manual Finance, category, settings, reconciliation, close, and void flows all call the command RPC first.
- An intentional Tuition payment creates an authoritative protected Finance transaction before UI success. Attendance → Tuition remains read-only; C5.4 adds no attendance-driven payment/session mutation.
- Inventory-to-Finance automatic local creation is disabled. Inventory remediation and an explicit cross-module server command remain outside C5.4.
- Attachment upload may create an unbound private draft first. Only a successful Finance RPC binding makes it transaction evidence; failed commits clean up the new unbound upload. Unbinding keeps the private file for audit instead of silently deleting it.

## Targeted evidence

Commands and final outputs are filled by the implementation QA run:

- `node tests/c5-4-finance-cashbook-authoritative-shared-truth-smoke.js`
- `$env:ICHESS_C5_4_LOCAL_QA_ALLOW_RESET='YES'; node tests/c5-4-finance-cashbook-authoritative-shared-truth-local-db-qa.js`
- `npm run build`

Acceptance matrix:

| Invariant | Evidence |
| --- | --- |
| A create → B sees; B edit → A sees | Local DB multi-account RPC QA |
| Fresh empty context reconstructs | Fresh authenticated client pull with empty browser state |
| Different-center leak = 0 | Other-center and unauthorized-center reads |
| Owner A→B→A no merge/copy | Three exact-center pulls |
| Version/conflict/idempotency | Stale write rejection, replay, intent conflict |
| Cloud failure no false success | Adapter failure test + server-first runtime ordering |
| Integer money / reconciliation | DB constraints and server-calculated close balance |
| Attachment exact-center binding | Bound projection, wrong-center rejection, direct bound metadata update/delete rejection |
| Legacy no silent upload/delete | Fixture classification and immutable real/uncertain snapshot replay test |
| ACL/RLS fail closed | Forced RLS, zero policies/direct grants, teacher and direct-table denial |
| Inherited migrations immutable | SHA-256 verification for all 24 inherited migration files |

Final targeted outputs:

- Migration SHA-256: `60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27`
- Review hardening migration SHA-256: `EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993`
- `C5_4_FINANCE_CASHBOOK_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `C5_4_FINANCE_CASHBOOK_LOCAL_DB_QA: PASS`
- `C5.1 authoritative core semantic smoke: PASS`
- `C5.2 attendance + tuition authoritative semantic smoke: PASS`
- `C5_3_CRM_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `npm run build`: PASS; only the inherited bundle-size advisory remains.
