# C5.6 independent technical review

Review date: 2026-08-14

Verdict: **PASS**. Remaining findings are `CRITICAL 0`, `HIGH 0`, `blocking MEDIUM 0`. C5.7 was not started and no remote Supabase/Auth/Edge/Storage/app apply or deploy was performed.

## Migration identity and inherited integrity

- Accepted base: `202608140009_c5_6_inventory_authoritative_shared_truth.sql`
- Accepted SHA-256: `4D7BD90677E3B3237514A1D684C472ECEEF22F9BCCE562E5B90082D9E92B24B1`
- Review hardening migration: **NONE**.
- The accepted base migration was not edited during independent review.
- SHA-256 verification passed for all 28 inherited/frozen migrations through C5.5.

## Review findings

No production defect at CRITICAL, HIGH, or blocking MEDIUM remained after targeted adversarial review. Review expanded the evidence harness for the exact last-unit race, malformed movement/request projections, archived history, and legacy-local behavior against both empty and non-empty server truth. The expanded harness initially exposed only positional assumptions in its own assertions after a second item was added; those assertions now resolve items and history by authoritative IDs. No runtime or database remediation was required.

## Adversarial verdict matrix

| Boundary | Verdict and physical evidence |
| --- | --- |
| Catalog authority | PASS — item create/edit/archive use authenticated command RPCs; open/reopen/manual refresh installs only a completely validated server snapshot. Active runtime has no local Inventory getter/saver path. |
| Quantity authority | PASS — direct table privileges are revoked under forced RLS; metadata updates cannot write quantity. Non-zero item creation emits an opening movement, and every later quantity change is `POST_MOVEMENT`. |
| Atomic stock ledger | PASS — item row/advisory locking, `expected_version`, movement insert, quantity/version update, audit, and idempotent result execute in one SQL transaction. Before/delta/after math is validated client-side on pull. |
| Concurrent final unit | PASS — two authenticated accounts concurrently deducted the same stock=1 item; exactly one command committed, one returned `VERSION_STALE`, final quantity was 0, and exactly one candidate movement existed. No negative stock or lost update occurred. |
| Retry/idempotency | PASS — exact replay returns the stored result without duplicate item/movement/request; the same key with changed intent returns `IDEMPOTENCY_CONFLICT`. This also covers retry after an uncertain network response because replay is resolved entirely by server command identity. |
| Request workflow | PASS — request code, creator, handler, role, and server time are authoritative. Invalid/stale transitions fail closed; concurrent transitions have exactly one winner and one stale result. |
| Fulfillment/stock relationship | PASS / intentionally N/A — the current request contract is descriptive free text and has no typed item/quantity binding. `FULFILLED` changes neither quantity nor movement ledger; C5.6 does not invent an automatic stock deduction. |
| Actor and protected identity | PASS — authenticated session/membership supplies creator/handler authority. Client display strings are projection labels only. Request phone is absent from authoritative schema and response. |
| Canonical identities | PASS — optional Student link must resolve to live exact-center C5.1 Student. Wrong-center Student is denied. Inventory creates or copies no Student, Staff, Teacher, Auth user, or membership authority. |
| Finance boundary | PASS — movement cost is Inventory operational evidence only. Movement and fulfillment create zero `finance_transaction`; the disabled legacy Inventory-to-Finance helper has no caller. |
| Same-center/fresh context | PASS — separate Owner/Admin clients observe the same catalog, movements, and requests; a fresh authenticated client reconstructs the same snapshot with empty browser persistence. |
| Cross-center/Owner switch | PASS — unrelated-center read/write and references are denied. Owner A→B→A observes A truth, empty B truth, then unchanged A truth without merge/copy. |
| Roles/direct access | PASS — recognized members may read; only owner/admin/center-admin/qtv may mutate. Teacher stock adjustment and authenticated direct table reads fail closed. |
| Refresh/currentness | PASS — signed-in bootstrap, center switch, module open/reopen, movement-history open, and manual `Làm mới` pull authority. Server command success is not UI success until a complete authoritative pull also succeeds. |
| Malformed/denied refresh | PASS — malformed item, movement math, or request status rejects the whole result as `INVALID_SERVER_RESULT` and exposes no partial collection. Denied/auth-boundary paths clear projection; recoverable refresh failure remains visibly failed and is never labeled fresh. |
| Archive/history | PASS — archiving is a versioned metadata transition, not deletion. The exact movement-ID set for the archived item and fulfilled request history remained readable. |
| Audit/currentness | PASS — movement and mutation evidence records server actor/membership/role/time plus before/after/version and command key. Client actor strings cannot override it. |
| Sample fixtures | PASS — `sampleInventoryItems` and `sampleInventoryRequests` have no active authority/bootstrap import path. An empty server remains empty. |

## Legacy Inventory verdict

- Silent upload: **NO**. The quarantine module has no Supabase/RPC/upload path, and neither empty nor non-empty server truth unions local rows into authority.
- Silent deletion: **NO**. Real/uncertain source values remain at their original exact-center keys; the quarantine module has no `removeItem` path.
- Isolation and recoverability: the manifest is exact-center, idempotent, checksum-bound, metadata-only, `QUARANTINED_NOT_ACTIVE`, and `MIGRATION_REQUIRED`. It does not copy raw item/request/phone payload.
- Fixture/cache handling: only exact known sample signatures are classified as fixtures; similar business rows are not retired heuristically. Empty reconstructable cache is replaceable by authoritative pull.
- Server empty + local legacy: authoritative projection remains empty and legacy source remains recoverable.
- Server non-empty + local legacy: authoritative projection contains only server rows and legacy source remains recoverable; no merge occurs.
- Controlled import: **DEFERRED / MIGRATION REQUIRED**. Any future import needs preview, explicit authorized confirmation, exact-center scoping, idempotency, duplicate/conflict handling, and a final authoritative refresh.

## Targeted evidence

- `C5_6_INVENTORY_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS`
- `C5_6_INVENTORY_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS`
- `C5_6_QA_TWO_ACCOUNTS_DEDUCT_FINAL_UNIT_EXACTLY_ONCE: PASS`
- `C5_6_QA_ATOMIC_MOVEMENT_CONCURRENCY_NEGATIVE_IDEMPOTENCY_AUDIT: PASS`
- `C5_6_QA_REQUEST_ACTOR_STUDENT_WORKFLOW_FULFILLMENT_STOCK_FINANCE_BOUNDARY: PASS`
- `C5_6_QA_CONCURRENT_REQUEST_TRANSITION_NO_LOST_UPDATE: PASS`
- `C5_6_QA_FRESH_SAME_CENTER_CROSS_CENTER_OWNER_SWITCH_ROLE_DIRECT_TABLE: PASS`
- `C5_6_QA_ARCHIVE_PRESERVES_ITEM_AND_MOVEMENT_HISTORY: PASS`
- `C5_6_QA_FINAL_LOCAL_RESET: PASS`
- C5.1 Core, C5.4 Finance, C5.5 Staff, and F23.12B compact targeted smokes: PASS.
- Changed JavaScript `node --check`, production build, and `git diff --check`: PASS.

No system-wide historical smoke sweep was run. No stale historical smoke was changed merely to make it green.
