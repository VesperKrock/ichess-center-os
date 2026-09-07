# CHB-0R — One-time handoff reset contract reconciliation

Status: **PASS — reconciled contract frozen; no reset executed**

Date: 2026-09-07

Baseline: `f35371db4b62b940b272171e8f4c5cec457ed89a`

Supersedes: the single-path strategy decision in `chb-0-clean-handoff-first-owner-bootstrap-contract.md`. The CHB-0 security model for first-Owner bootstrap remains applicable where this document does not replace it.

## 1. Decision

The frozen handoff strategy is **C — hybrid**:

1. The current Supabase project remains the active tester environment until the Product Owner explicitly starts the future handoff execution gate.
2. A one-time Owner-only reset may transition that project to an operationally clean `UNINITIALIZED_NEXT_EPOCH` state by archiving every old center, revoking all old business memberships, disabling old governance, and isolating all retained history.
3. That reset does **not** make the project historically fresh. Auth identities, immutable audit, migration history, protected attachments, Storage objects, Vault/key history, backups, and archived business evidence remain.
4. The final clean handoff still uses a fresh Supabase instance. Only a fresh instance can truthfully meet `FRESH_INSTANCE_CLEAN`.
5. The same first-Owner bootstrap UX is rehearsed on the logically reset tester project and used on the fresh final instance. The UI must label the two states truthfully.

No current production data, Auth user, Storage object, Vault record, migration, center, membership, or audit row was changed by CHB-0R.

## 2. Why current-project physical cleaning is not safe

The current project contains real tester/business state and protected history across core operations, Finance, CRM, Inventory, C5.7, Staff/HR, Access & Recovery, Auth, Storage, and Vault.

The physical contracts include:

- append-only account governance and account audit events, with update/delete/truncate blocked;
- append-only CRM care/audit evidence;
- Finance transactions that are voided rather than hard-deleted;
- Staff attachment version/removal history and legal-hold controls;
- coordinated Owner-recovery scopes that are immutable;
- Auth user foreign keys and historical actor IDs that must survive revoke/replacement;
- private Storage evidence whose signed URLs may remain valid until their bounded expiry;
- Vault material needed to unwrap retained encrypted evidence;
- migration ledger history that must not be rewritten.

A database owner could technically bypass some application controls, but doing so would destroy the very audit, privacy, and recovery guarantees already accepted in production. That is not a supported product reset.

## 3. What the one-time reset may safely clear

“Clear” has two meanings. The reset contract uses supported lifecycle transitions for server records and may physically delete only genuinely ephemeral material.

### 3.1 May be physically deleted

Only these classes may be physically removed after exact verification:

- current-device browser caches, drafts, stale projections, in-memory secrets, pending request IDs, and old installation namespaces;
- expired session material through supported Auth invalidation;
- unbound temporary upload fragments proven to have no business, audit, version, retention, or legal-hold reference;
- generated transient export/rehearsal files whose protected archive is separately verified;
- an unclaimed bootstrap token digest when it is rotated before any claim.

The system cannot erase caches already copied to offline tester devices. It can only prevent those caches from becoming current authority or rendering in the new installation epoch.

### 3.2 May leave active operation only through lifecycle transitions

These records may be removed from ordinary operation but not hard-deleted by the reset:

- centers: `active/paused -> archived`;
- memberships: active/pending states -> revoked, with historical actor IDs preserved;
- center governance: disabled/sealed, with commands/events retained;
- business projections: archived, tombstoned, ended, or otherwise excluded from the next center by exact-center authority;
- Finance payments/transactions: retained as posted/voided historical truth;
- CRM contacts/cases/links and care logs: retained under archived centers;
- Inventory movements and audit: retained;
- C5.7 notes/calendar history: retained;
- Staff/HR and documents: archived through supported lifecycle; attachment/legal-hold evidence retained;
- recovery custodians/approvals: revoked or expired for the old installation epoch, never deleted.

The reset must not issue thousands of ordinary per-record mutations merely to imitate deletion. It seals the complete old center set as one installation epoch and relies on existing exact-center membership/RLS boundaries to make that state inaccessible to the new operational center.

## 4. What must remain

The default is retention until a separately approved legal/retention process proves disposal is allowed.

| Class | Required treatment |
|---|---|
| Migration ledger and schema | Retain unchanged |
| Governance/account/business audits | Retain append-only |
| Idempotency and command results | Retain for replay evidence |
| Historical centers and memberships | Archive/revoke; retain IDs and relationships |
| Auth identities | Disable/sign out as required; do not hard-delete |
| Historical business rows | Retain under archived center IDs |
| Finance transactions | Retain; use existing void semantics only |
| CRM protected evidence | Retain encrypted |
| Staff attachment/version/removal history | Retain subject to retention/legal hold |
| Storage objects with a record/hold | Keep private until a separate disposal gate |
| Vault keys needed by retained ciphertext | Retain/rotate with version history; never expose |
| Protected backups | Retain according to the approved backup policy |

No one-time Owner action receives power to bypass legal holds, audit immutability, Auth history, or Vault/Storage retention.

## 5. Two different clean states

### `BUSINESS_CLEAN`

Achievable on the current project after the future reset execution:

- zero active old center and zero active old membership;
- zero old business record visible or writable in the new operational center;
- old governance disabled and old Auth sessions invalidated;
- bootstrap target has zero business authority before claim;
- new center begins with zero rows in every module for its exact center ID;
- archived history still physically exists and is explicitly classified as retained evidence.

This is also called `UNINITIALIZED_NEXT_EPOCH`. It must never be presented as “all data permanently deleted.”

### `FRESH_INSTANCE_CLEAN`

Achievable only on a new Supabase instance:

- zero historical Auth users, centers, memberships, business/audit rows, and Storage objects;
- no previous Vault/key history or installation epoch;
- schema-only infrastructure plus one unclaimed bootstrap control;
- no DreamHome/test/Angel Wings/project residue, including browser namespace carry-over.

Only this state satisfies the original clean-install handoff definition.

## 6. One-time reset state machine

```text
TESTER_ACTIVE
  -> RESET_PREPARED
       frozen complete center scope + count/digest manifest
       no destructive mutation
  -> RESET_ARMED
       restore-tested backup + eligibility + cooling period complete
  -> RESET_EXECUTING
       global business-write fence active
  -> HISTORY_SEALED
       all scoped centers archived
       all memberships revoked
       old governance disabled
       reset action permanently locked
  -> SESSION_DRAINING
       supported Auth invalidation invoked
       private signed-URL maximum lifetime allowed to expire
  -> UNINITIALIZED_NEXT_EPOCH
       designated target may perform first-Owner bootstrap
  -> BOOTSTRAP_CLAIMED
       one new center + one Owner + normal governance
  -> OPERATIONAL_LOCKED
```

Failure semantics:

- failure before `RESET_EXECUTING`: no authority/data transition; command may expire or be cancelled by the same eligible Owner;
- failure after the atomic history seal: old business authority remains denied and state becomes `RESET_REPAIR_REQUIRED`; it never silently returns to `TESTER_ACTIVE`;
- session invalidation failure does not restore membership; retry repairs the same command;
- bootstrap stays disabled until Auth/session draining and the maximum issued private signed-URL lifetime have passed;
- no rollback hard-deletes an Auth identity, center, audit row, or business record;
- exact retry resumes the same command; changed intent conflicts;
- after `HISTORY_SEALED`, the reset action is permanently locked even if bootstrap has not completed.

The current private signed-URL helper defaults to a one-hour lifetime. CHB implementation must derive the real maximum from reviewed runtime/configuration and enforce a server timestamp quarantine longer than that maximum; a browser timer is not authority.

## 7. Owner-only arming and confirmation rules

The action is not ordinary center administration. Both prepare and execute require all of the following:

1. Caller is an authenticated, credential-READY canonical Owner.
2. Caller is the canonical Owner for **every non-archived center in the frozen project scope**, including tester/staging centers. No wildcard or future center can enter after prepare.
3. If the project has another canonical Owner, an ambiguous/multi-Owner center, or a center outside caller authority, the action is unavailable. The reset must not widen one center Owner into project authority.
4. No Owner handoff/recovery, Admin lifecycle command, data import, payment, attachment deletion, or other protected command is in flight.
5. A current protected logical backup has been decrypted and restore-tested; its manifest ID/digest is bound to the reset command.
6. All legal holds, retained Storage objects, Vault dependencies, active signed URLs, and nonzero data classes are disclosed in the review. A hold blocks deletion but does not block archival.
7. Supabase Auth provides supported recent reauthentication. Session age alone or a UI password field is insufficient evidence.
8. `prepare` freezes exact center IDs, membership/governance versions, target Auth identity, count/digest manifest, expiry, and an idempotency request ID without changing business authority.
9. A 24-hour cooling period must complete. The prepared request expires after 7 days if not executed.
10. The same Owner reauthenticates, re-enters the exact phrase `CHUẨN BỊ BÀN GIAO HỆ THỐNG`, reviews the retained-history warning and affected center count, and confirms the server challenge.
11. Admin, recovery custodian, target Owner, browser storage, email allowlist, or frontend flag cannot arm/execute the reset.
12. Direct table DML and direct public reset RPC are denied. Edge/server code checks authorization again immediately before the atomic transition.

The designated bootstrap target must be an exact confirmed Supabase Auth identity, distinct from the resetting Owner, and have no post-reset active membership. On a fresh instance the target first creates/confirms their Auth identity; operations then bind the unclaimed bootstrap capability to that exact Auth ID. Email may assist human review but is not authorization authority.

## 8. Post-reset UNINITIALIZED and bootstrap

### Current project rehearsal/business-clean path

1. Old centers are archived and old memberships/recovery-custodian statuses are revoked for the sealed epoch.
2. Old Auth identities remain, but have no center business authority. All existing sessions are invalidated through the supported server path.
3. The installation exposes only minimal `Sẵn sàng bàn giao` status to the designated target; launcher and modules remain unavailable.
4. The target uses a high-entropy, one-time handoff code bound to their exact confirmed Auth ID and the sealed reset command.
5. One atomic transaction creates a new opaque center ID, makes the target its only Owner, activates normal Access & Recovery governance, appends bootstrap evidence, and permanently locks bootstrap.
6. The new center starts with zero exact-center business rows. Archived tester history is neither queried nor copied.
7. Project/installation-epoch browser namespace changes before any business render, preventing old cached DreamHome/test data from appearing current.

### Fresh final-instance path

The fresh instance begins directly at `FRESH_UNINITIALIZED`, so no reset is executed. The same target-bound bootstrap claim creates the literal first center and first Owner, after the clean-install verifier proves every must-zero class.

In both paths:

- no pre-created operational Owner exists;
- the target personally completes the claim;
- retry is idempotent and race-safe;
- a second bootstrap is permanently denied;
- recovery custodians are configured later in a separate controlled governance ceremony, not silently inherited or auto-created.

## 9. Minimal non-destructive implementation contract

CHB-1 may add the machinery without arming or executing a reset:

- one additive migration for installation epoch, reset command/manifest, append-only events, capability read, global write fence, atomic archive/revoke transition, and bootstrap lock;
- one `manage-installation-handoff` Edge Function for `inspect`, `prepare`, `cancel-before-execution`, `execute`, and `repair` modes;
- one `bootstrap-first-owner` Edge Function for target-bound inspect/claim/reconcile;
- one Owner-only UI entry `Chuẩn bị bàn giao hệ thống`, hidden/disabled unless real server capability is READY;
- one target bootstrap screen shown only in `UNINITIALIZED_NEXT_EPOCH` or `FRESH_UNINITIALIZED`;
- project/epoch-scoped browser persistence and missing-center fail-closed behavior;
- local/static/clone DB tests for authorization, complete-scope freeze, lost-response repair, permanent locks, session drain, Storage URL quarantine, exact-center isolation, and zero sample data.

Deploying CHB-1 to the current tester project must leave it in `TESTER_ACTIVE`, create no reset command, archive no center, revoke no membership, invalidate no session, and show no bootstrap to ordinary users. Future execution requires a separate explicit Product Owner gate.

## 10. Rehearsal and final handoff

1. Implement/test CHB-1 locally against populated and empty clone databases.
2. Deploy fail-closed to the tester project; verify state and all data unchanged.
3. Rehearse reset execution only on a protected clone/disposable project, including restore, incomplete external response, session invalidation failure, signed-URL quarantine, and target bootstrap.
4. At future handoff time, Product Owner chooses whether to execute the tester-project logical reset as a final rehearsal/archive transition. It is never required to prepare the fresh final project.
5. Build the final fresh Supabase project from the separately reviewed schema-only package; never clone Auth, Vault, Storage objects, audit, centers, or business rows.
6. Anh Hải creates/confirms his identity and performs the first-Owner bootstrap on the fresh project.
7. Verify one center/one Owner, permanent lock, zero business rows/Storage objects, empty UI, reload/new browser, direct-open denial, and no old namespace.
8. Configure two independent recovery custodians in a separate gate; do not perform a real Owner recovery just for QA.
9. Cut over frontend/project configuration only after physical and user acceptance. Retain the tester/old production project according to the approved archive policy.

## 11. Hard stops

- any reset path that hard-deletes Auth identities or immutable audit/history;
- any claim that `BUSINESS_CLEAN` equals `FRESH_INSTANCE_CLEAN`;
- reset caller does not own the entire frozen non-archived center set;
- incomplete/ambiguous center or Owner topology;
- missing restore-tested backup or count/digest drift after prepare;
- legal-hold bypass, Vault key loss, retained ciphertext becoming unreadable, or unclassified Storage objects;
- browser/static email/center allowlist used as authority;
- session invalidation or signed-URL draining not proven;
- partial center archival, partial membership revoke, duplicate Owner, or zero-lockout failure;
- P3D/P4B or unrelated scope entering the release;
- reset/bootstrap becoming repeatable after its permanent lock.

## 12. CHB-0R boundary and next gate

CHB-0R is documentation and read-only audit only. Production stays `TESTER_ACTIVE`. There was no SQL/Auth/membership/business/Storage/Vault mutation, migration apply, Edge/frontend deployment, or applied-migration edit.

Next: **CHB-1 — non-destructive installation-handoff reset + first-Owner bootstrap implementation**, local first. It must implement both logical-reset rehearsal and fresh-instance bootstrap while keeping final handoff strategy hybrid.
