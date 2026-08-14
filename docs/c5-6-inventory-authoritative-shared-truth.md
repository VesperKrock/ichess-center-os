# C5.6 Inventory authoritative shared truth

Implementation date: 2026-08-14

Status: **LOCAL QA PASS — ready for independent technical review/checkpoint**. No remote Supabase/Auth/Edge/Storage/app apply or deploy was performed. No commit or push was made in this implementation turn.

## Physical root cause removed

Inventory previously initialized three center-scoped browser keys as durable state and injected `sampleInventoryItems` / `sampleInventoryRequests` when missing. Item create/edit/delete, stock movement, and request/status changes mutated arrays and called `saveStoredInventory*` before any server commit. Consequently, two authenticated accounts in one center owned unrelated browser ledgers and could see different stock/request truth.

C5.6 starts Inventory empty in memory, never imports sample arrays in `main.js`, and removes every active `getStoredInventory*` / `saveStoredInventory*` call. Signed-in bootstrap, exact-center switch, module open/reopen, movement-history open, and manual `Làm mới` use the C5.6 list RPC. Every mutation follows command → server commit → complete authoritative pull → memory projection → UI success.

## Authoritative model

- `center_inventory_items`: typed exact-center catalog, metadata, non-negative stored quantity, threshold, independent condition/location/note, archive state, and version.
- `center_inventory_movements`: immutable stock evidence with delta, before/after, item versions, server actor/membership/role, and server time.
- `center_inventory_requests`: typed descriptive request workflow with server-generated exact-center code and server-authored creator/handler identity.
- `center_inventory_audit_events`: server-side command evidence with actor, entity, before/after, command key, and server time.
- `center_inventory_command_results`: scoped intent digest and result snapshot for exact replay / changed-intent conflict.

Item creation with non-zero opening stock writes an opening movement. Later metadata edits cannot change quantity. `POST_MOVEMENT` locks the item, compares `expected_version`, rejects negative or overflowing stock, inserts the movement, and updates stored quantity/version in one SQL transaction. Archive preserves item identity and history; no browser hard delete remains.

Request transitions are server-owned: `NEW → PENDING → PREPARING → FULFILLED`, with reject/cancel exits from open states. Same-state note updates are versioned; stale or invalid jumps fail closed. Request codes are serialized and generated on the server.

## Fulfillment and domain boundaries

Physical Inventory request rows contain item-type labels and free-text requested quantities, not typed Inventory item/quantity lines. Existing UI explicitly states that request handling does not create stock movement. Therefore request `FULFILLED` → automatic stock mutation is **intentionally N/A** in C5.6. Guarded QA proves fulfillment changes neither stock nor movement count.

C5.4 Finance remains the only Finance authority. Inventory inbound cost metadata stays operational evidence only; stock changes and request fulfillment create no `finance_transaction`. The disabled local `syncInventoryMovementToCashflow` helper has no caller.

C5.1 Student remains canonical. `linked_student_id`, when present, must resolve to a live exact-center C5.1 `student` entity; no Student copy/create/merge occurs. Inventory does not create Staff, Teacher, Auth users, or `center_members`.

`requester_display_name` and `requester_role_label` are descriptive business labels only. Authenticated creator/handler identity comes from server session/membership. The legacy request phone field is not stored in authoritative Inventory at all, avoiding a generic plaintext copy of protected CRM/HR identity.

## ACL and exact-center isolation

All five C5.6 tables use forced RLS and have direct privileges revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Only authenticated RPC entry points are granted. Active members with recognized roles can read. Only `owner`, `admin`, `center_admin`, and `qtv` can mutate; teacher/consultant/viewer writes fail closed. Center and membership activity are rechecked server-side on every RPC.

Cross-center item/student references are impossible through composite keys or explicit exact-center validation. A malformed or wrong-center row causes the client adapter to reject the entire snapshot; it never renders a partial ledger as fresh truth.

## Legacy and fixture safety

Legacy keys inventoried:

- `ichessCenterOS.inventory.<center>`
- `ichessCenterOS.inventoryMovements.<center>`
- `ichessCenterOS.inventoryRequests.<center>`

Classification is deterministic: absent/empty is `RECONSTRUCTABLE_CACHE`; exact full known sample signatures are `FIXTURE_SAMPLE`; valid non-empty non-sample arrays are `REAL_LOCAL_ONLY`; malformed shapes are `UNCERTAIN`. Similar names/quantities are never enough to retire data as fixture.

Real/uncertain state keeps its original exact-center key and receives an idempotent `QUARANTINED_NOT_ACTIVE / MIGRATION_REQUIRED` manifest. The manifest stores key, byte length, shape/count/schema versions and SHA-256 only; it contains no raw Inventory/request/phone payload. Source drift after capture fails closed. The quarantine module has no Supabase client, upload/merge path, or `removeItem` path.

Controlled import is **DEFERRED / MIGRATION REQUIRED**. A future import must provide preview, explicit authorized confirmation, exact-center scope, idempotency, duplicate/conflict handling, and authoritative refresh. Server empty/non-empty never changes this: local data is not uploaded or unioned into active truth.

## Migration

- New additive migration: `supabase/migrations/202608140009_c5_6_inventory_authoritative_shared_truth.sql`
- SHA-256: `4D7BD90677E3B3237514A1D684C472ECEEF22F9BCCE562E5B90082D9E92B24B1`
- All 28 inherited migrations through C5.5 remain byte-identical under SHA-256 verification.

## Targeted evidence

- Guarded local DB: schema/RLS/ACL/no-phone authority; empty server does not seed samples; A create → B sees; B metadata/stock → A sees; fresh client reconstructs.
- Stock: opening movement, stored quantity consistency, exact retry, changed-intent conflict, two-client stale race, exact stock=1 last-unit race, no lost update, negative-stock rejection, immutable server actor/time/before/after.
- Request: exact replay/no duplicate, server code/actor, exact-center Student reference, invalid jump, sequential fulfillment, concurrent transition stale conflict.
- Isolation: unrelated-center read/write denied; Owner A→B→A returns A-only/B-empty/A-only; direct table read denied; teacher write denied.
- Boundaries: request fulfillment changes neither stock nor movement; Finance transaction count remains zero; archive retains item, movement IDs, and request history.
- Failure safety: adapter network failure returns `SERVER_COMMAND_FAILED`; runtime does not mutate active arrays before server commit and complete pull.
- Projection safety: malformed item, movement math, or request workflow rows reject the entire pull without exposing a partial collection.
- Legacy combinations: server empty/non-empty both remain authoritative; real local legacy is retained at source and never imported or merged.
- Final guarded runner resets the loopback local DB after QA.

Targeted commands:

```text
node tests/c5-6-inventory-authoritative-shared-truth-smoke.js
$env:ICHESS_C5_6_LOCAL_QA_ALLOW_RESET='YES'; node tests/c5-6-inventory-authoritative-shared-truth-local-db-qa.js
node tests/c5-1-authoritative-core-contract-and-multi-account-harness-smoke.js
node tests/c5-4-finance-cashbook-authoritative-shared-truth-smoke.js
node tests/c5-5-staff-hr-authoritative-shared-truth-smoke.js
npm run build
```
