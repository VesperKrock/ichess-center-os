# CHB-0 — Clean handoff + first-Owner bootstrap contract freeze

Status: **PASS — contract frozen; implementation not started**

Date: 2026-09-07

Baseline: `f35371db4b62b940b272171e8f4c5cec457ed89a`

> Reconciliation note (2026-09-07): CHB-0R supersedes the single-path handoff decision in this document. The fresh-instance path remains the only `FRESH_INSTANCE_CLEAN` result, while CHB-0R additionally permits a one-time, archive-based `BUSINESS_CLEAN` reset of the tester project. See `docs/chb-0r-one-time-handoff-reset-contract-reconciliation.md`.

## 1. Product decision

The supported clean handoff is a **fresh Supabase installation**. Sanitizing the current production project is rejected as the normal handoff path because it would require destructive treatment of real Auth identities, immutable audit/history, Storage objects, Vault state, memberships, and business records.

The clean installation starts with:

- no center;
- no operational Owner or Admin;
- no business data, synthetic QA data, development fixtures, or Angel Wings data;
- no Storage object;
- one disabled/unclaimed installation-bootstrap control;
- schema, RLS, functions, empty private buckets, freshly generated installation secrets, and deployed Edge Functions only.

Anh Hải creates and confirms his own Auth identity, then claims the installation with a separate one-time handoff code and creates the first real center. The claim transaction makes that identity the first and only Owner, activates normal governance for that center, and permanently locks first-owner bootstrap.

This decision does not delete, reset, or repurpose the current production project. The current project remains the historical production source until a separately approved cutover/retention decision.

## 2. Read-only architecture evidence

The production inspection performed for CHB-0 found:

| Surface | Current production evidence | Clean-handoff consequence |
|---|---:|---|
| Migration ledger | 39 applied versions | Schema history is mature, but not a clean data state |
| Centers | 6 active, including 5 production centers | Must be 0 before first bootstrap |
| Memberships | 13 active | Must be 0 |
| Auth identities | 9 confirmed identities | Must be 0 |
| Storage | 2 buckets, 9 objects | Empty buckets are infrastructure; objects must be 0 |
| Vault | 1 secret metadata record | Never copy its secret; generate a new installation secret |
| Governance | 5 enabled center controls, 2 custodians | Must be 0 before first bootstrap |
| Core entities | 147 rows | Must be 0 |
| Finance transactions | 4 rows | Must be 0 |
| CRM contact/case/link | 3 rows | Must be 0 |
| Inventory | 6 rows | Must be 0 |
| Staff/profile/document | 3 rows | Must be 0 |
| Deployed governance Edge Functions | 8 active functions | Reusable infrastructure after clean-install verification |

The repository and linked ledger agree on every applied version. The only repository migrations not applied to production are frozen P3D and P4B. No production object, Auth identity, or secret was changed during this audit.

## 3. Exact clean-install data classification

### 3.1 Must be zero before handoff

The clean-install verifier must prove zero rows/objects in all of these classes:

1. Supabase Auth users and identities.
2. Centers, center memberships, role bindings, Owner/Admin subjects, credential gates, lifecycle commands, governance events, handoff/recovery requests, approvals, recovery scopes, and recovery custodians.
3. Student, Teacher, Class, Schedule, Attendance, Tuition, Finance, Reports/source records, CRM, Parent↔Student links, Inventory, C5.7 notes/calendar data, Staff/HR, and every business audit/outbox/idempotency table.
4. Active, archived, tombstoned, synthetic, demo, test, DreamHome, Angel Wings, and legacy quarantine business rows.
5. Storage objects and upload/version/removal records. Bucket definitions may exist but must be empty.
6. Realtime/business queue residue and pending asynchronous commands.
7. Browser-persisted business projections, old-center caches, import previews, legacy quarantines, and pending request IDs for the new installation origin/project namespace.

Zero means physical count zero, not merely hidden, inactive, archived, or filtered out of the UI.

### 3.2 May exist as installation infrastructure

- schemas, extensions, tables, indexes, constraints, RLS/FORCE RLS, policies, triggers, functions, grants, and migration metadata;
- empty private Storage buckets and their policies;
- the eight Access & Recovery Edge Functions plus the CHB bootstrap function;
- a freshly generated CRM lookup key held by supported server-side secret storage, verified by metadata only;
- one installation-bootstrap singleton and one unclaimed token digest;
- public Supabase URL and publishable key in the frontend environment;
- deployment metadata and static application assets.

No production secret, Auth ID, center ID, Storage object, or business row is copied from the current project.

### 3.3 Personal UI state

Theme and non-business UI preferences may remain personal only when namespaced to the new installation fingerprint. A new-project mismatch must purge/quarantine all old project-scoped browser state before any module can render it. Business data may never survive project switching in browser storage.

## 4. Fresh-migration replay readiness

**Verdict: the current 41-file migration directory is not safe for blind greenfield replay.** CHB-1 must create and verify a clean-install schema package; `supabase db push` over the historical directory is forbidden for the handoff.

Physical blockers are:

1. `20260722000000_remote_schema.sql` unconditionally drops `pg_net`; a clean environment without that extension fails before reaching the current schema.
2. P3D `202608120003` and P4B `202608130002` are present in the directory but intentionally frozen/absent. Blind replay would deploy excluded conversion scope.
3. `202608210001` requires an exact DreamHome data fingerprint and row counts; it intentionally fails on an empty database.
4. `202608210004` requires four exact `dreamhome_prod` schedule rows/fingerprints; it intentionally fails on an empty database.
5. The P3C-to-PH-4A history contains a transient dependency on private Vault crypto primitives that hosted Postgres cannot execute. The final physical schema is supported, but the historical intermediate path is not a valid clean-install runtime path.
6. P4A/CRM requires a new per-installation lookup key; copying the current Vault secret would violate clean-handoff isolation.

CHB-1 must therefore produce a deterministic **schema-only baseline from the final deployed physical contract**, plus an explicit manifest documenting excluded historical data repairs and frozen scopes. It must be tested on an empty disposable Supabase project before any final handoff project is created. The package must never be applied to the current production project.

## 5. Hard-coded assumptions to remove or contain

### Authority blockers

- `src/supabase-auth.js` still defines DreamHome staging/production center constants and display mappings.
- `src/app-center-binding.js` has a DreamHome single-center fallback.
- `src/app-auth.js` can display DreamHome when no resolved center name exists.
- `src/storage.js` normalizes an absent center to `dreamhome`.
- several cloud/storage adapters default a missing center argument to `dreamhome`.

For a clean installation, an unresolved center must mean **no business authority and no business fetch**, never DreamHome. Center identity must come only from the authenticated membership/bootstrap result.

### Presentation and seed risks

- Cashflow/Cashbook and some sample fixtures contain DreamHome display text.
- Student and historical test modules contain sample/default records.
- legacy localStorage keys are not consistently namespaced by Supabase project/installation.
- historical docs/tests contain the current Supabase project reference.
- `vite.config.js` contains the current GitHub Pages base path; this is a deploy-host assumption, not database authority.

Executable frontend code contains no operational Owner/Admin email allowlist and receives the Supabase URL/publishable key from environment configuration. Existing production Auth IDs, shared-Owner topology, emails, and the current project reference are evidence only; none may become bootstrap authorization or a clean-install seed.

Static sample/test data may remain in test fixtures only. The production path must start from empty arrays/server snapshots and must never promote legacy/sample data to server authority. Project references in historical evidence are not rewritten, but executable runtime/configuration must receive the new project through environment/configuration.

### Existing center creation path

`provision_center_for_owner` is not a first-owner bootstrap: it requires an already active Owner and creates another center for that Owner. It must not be exposed before bootstrap, and the CHB claim transaction must not emulate its old pre-governance assumptions.

## 6. Frozen first-owner bootstrap security model

The minimum physical server contract is frozen as:

- `public.installation_bootstrap_control`: singleton state/current digest metadata, FORCE RLS, no direct browser DML;
- `public.installation_bootstrap_events`: append-only non-secret audit, FORCE RLS, no update/delete/truncate grant;
- `public.get_installation_bootstrap_capability()`: minimal status only, never Owner/center/token metadata;
- private/service-only configuration and claim functions owned by the database role with fixed `search_path` and explicit grants/revokes;
- `bootstrap-first-owner` Edge Function: verifies the supplied user JWT with Supabase Auth, never logs the request body, and is the only remote caller of the service-only claim operation.

Exact SQL signatures are finalized in CHB-1 tests, but these objects, permissions, and separation may not be replaced by browser logic or a public mutation RPC.

### 6.1 Authorities

| Decision | Authority |
|---|---|
| Login identity, password, confirmed email | Supabase Auth |
| Whether the installation can be claimed | Bootstrap singleton in Postgres |
| One-time handoff code verification | Server-only digest comparison |
| First center, membership, Owner and governance activation | One SECURITY DEFINER transaction called only by the bootstrap Edge Function |
| Ordinary business access after claim | Existing membership/RLS/governance contract |
| Future Owner handoff/recovery | Existing Access & Recovery contract |

The browser receives only the public URL/publishable key and a minimal bootstrap status. Service-role credentials, raw token material, recovery secrets, and database passwords never enter the browser.

### 6.2 Bootstrap singleton state machine

```text
UNCONFIGURED
  -> READY(token_digest, expiry, attempt budget)
  -> LOCKED(center_id, owner_auth_id, claimed_at)

UNCONFIGURED or READY
  -> LOCKED_EXISTING when any center/membership/governance/business residue exists

READY
  -> SUSPENDED after the bounded failure policy or operator containment
  -> READY only through server-side token replacement before any successful claim
```

There is no `LOCKED -> READY`, reset, delete, or browser unlock path. On an existing installation, installing CHB-1 must produce `LOCKED_EXISTING`; it must not expose bootstrap.

### 6.3 Token and Auth requirements

- The handoff code has at least 32 random bytes of entropy and is generated outside the browser through an approved server-side/operations path.
- Only a SHA-256 digest, expiry, bounded-attempt metadata, and non-secret provenance are stored.
- The raw code is handed to anh Hải out of band once, is never logged/audited/persisted by the app, and is destroyed from operator plaintext after delivery.
- Anh Hải creates his own Auth account and must have a confirmed email before claiming.
- Before claim, that Auth user has zero memberships and therefore zero business authority.
- Public sign-up does not grant business access; after successful handoff it may be disabled as an operational setting.

### 6.4 Atomic claim transaction

The bootstrap Edge Function must authorize the signed-in user and call one private/service-only SQL operation. Under a global advisory lock and singleton row lock, SQL revalidates:

1. state is `READY`, token is valid/unexpired, and request ID/intent is current;
2. Auth user is confirmed, has no membership, and is not already a governance subject;
3. centers, memberships, governance controls, and all business/Storage-object residues are zero;
4. normalized center name/slug is valid and collision-free;
5. no other bootstrap claim has committed or is in flight.

One transaction then:

1. creates exactly one active production center;
2. creates exactly one active membership for the caller with role `owner`;
3. creates the ARG-2 governance subject and READY credential gate for the self-controlled credential;
4. activates the existing zero-lockout governance contract for that center;
5. appends immutable bootstrap audit/result evidence;
6. clears the stored token digest and sets the singleton to `LOCKED`.

All steps commit or none commit. A lost response is reconciled by the same request ID and intent. An exact retry returns the same center/Owner result; changed intent conflicts. No compensation hard-deletes Auth or creates a second center.

### 6.5 Post-claim invariant

Immediately after success, the server must prove:

- bootstrap state `LOCKED` permanently;
- exactly one center and exactly one active Owner membership;
- exactly one enabled governance control and one READY credential gate;
- zero Admins and zero recovery custodians until explicitly governed later;
- zero business rows and zero Storage objects;
- the caller is the canonical Owner and can use normal governance;
- a second user or direct RPC/table call cannot bootstrap, rebind, or unlock the installation.

The lock survives logout, account replacement, Owner handoff, revoke, and emergency recovery. It is installation history, not current-Owner state.

## 7. One-time handoff UX

1. With zero center membership, the app shows `iChess chưa được khởi tạo`; it does not show the launcher or business modules.
2. Anh Hải selects `Khởi tạo iChess lần đầu`, creates his own login, and confirms email.
3. The claim screen shows the confirmed login identity, asks for the real first-center name and the separately delivered one-time handoff code, and explains that the action can be done once.
4. A final review shows the normalized center name and that this account will become Owner. Submission has one loading state and no duplicate action.
5. The code, password, and request secret are memory-only and cleared on close, logout, account switch, success, or failure requiring a fresh attempt.
6. Success refreshes the membership and opens the empty center. Every business module shows a truthful empty state; no demo record appears.
7. Reload and a fresh browser session resolve the same single center and Owner from the server.
8. The bootstrap entry disappears permanently. Direct navigation returns `Hệ thống đã được khởi tạo` without revealing Owner/center details or token validity.

Recovery custodians are **not** silently created during bootstrap. After handoff, the first Owner and Product Owner conduct a separate, reviewed two-custodian enrollment ceremony before emergency recovery is declared ready.

## 8. CHB-1 implementation allowlist

CHB-1 may change only the following files. Any additional physical requirement is a contract-change stop and must be reviewed before editing.

### New server/install artifacts

- `supabase/migrations/202609070001_chb_1_first_owner_bootstrap_governance.sql`
- `supabase/functions/bootstrap-first-owner/deno.json`
- `supabase/functions/bootstrap-first-owner/index.ts`
- `supabase/clean-install/schema.sql`
- `supabase/clean-install/manifest.json`
- `tools/chb-1-verify-clean-install.js`
- `supabase/config.toml`

The normal migration is additive and installs fail-closed as `LOCKED_EXISTING` on the current project. The clean-install baseline is a separate greenfield artifact and must not be put into the current production migration ledger.

### Frontend/auth/center boundary

- `src/first-owner-bootstrap.js`
- `src/main.js`
- `src/app-auth.js`
- `src/app-center-binding.js`
- `src/supabase-auth.js`
- `src/supabase-client.js`
- `src/storage.js`
- `src/browser-storage-registry.js`
- `src/styles.css`

### Known missing-center fallback containment

- `src/attendance-records.js`
- `src/center-calendar-data.js`
- `src/cloud-attendance-realtime.js`
- `src/cloud-attendance-records.js`
- `src/cloud-audit-log.js`
- `src/cloud-db-sync.js`
- `src/cloud-schedule-session-backfill.js`
- `src/cloud-schedule-sessions.js`
- `src/cloud-session-reports.js`
- `src/cloud-tuition-record-package-bridge.js`
- `src/cloud-tuition-records.js`
- `src/cloud-tuition-terms.js`
- `src/member-profiles.js`
- `src/supabase-storage.js`
- `src/transaction-attachments.js`

These files may only be changed to replace a missing-center DreamHome fallback with a fail-closed/no-fetch result. Business contracts remain unchanged.

### Presentation/seed containment

- `src/cashbook-module.js`
- `src/cashflow-module.js`
- `src/student-module.js`

Changes are limited to removing executable DreamHome/sample fallback from the production path; test fixtures remain explicit test inputs.

### Tests

- `tests/chb-1-first-owner-bootstrap-contract-smoke.js`
- `tests/chb-1-first-owner-bootstrap-local-db-qa.js`
- `tests/chb-1-clean-install-replay-smoke.js`
- `tests/c3-1-auth-membership-readonly-gate-smoke.js`
- `tests/c4-3-center-binding-mvp-smoke.js`
- `tests/arg-2-owner-admin-lifecycle-contract-smoke.js`
- only an existing storage/current-center smoke whose assertion directly contradicts the frozen no-center fail-closed contract.

No P3D/P4B migration or Edge Function, current applied migration, business schema contract, Figma file, or unrelated module is in scope.

## 9. CHB-1 required QA matrix

| Case | Required result |
|---|---|
| Current populated installation receives CHB migration | `LOCKED_EXISTING`; no bootstrap UI/action |
| Empty install before token configuration | `UNCONFIGURED`; claim denied |
| Valid Auth user without confirmed email | Claim denied; no center/membership |
| Confirmed user without code/wrong code/expired code | Claim denied; no authority; no token oracle |
| Same request and intent retried/concurrent | One center, one Owner, same result |
| Same request with changed center intent | Conflict; original result unchanged |
| Two users race | One winner; one center; one Owner; loser has no membership |
| Any preexisting center/membership/business/Storage residue | Fail closed and permanently contain bootstrap |
| Successful claim | Atomic center + Owner + governance + permanent lock |
| Response lost after commit | Retry reconciles committed result; no duplicate |
| Direct table/RPC/browser attempt | Denied |
| Missing center before bootstrap | Zero business request and zero DreamHome fallback |
| Fresh reload/project switch | Server truth restored; old browser business state absent |
| Post-claim second bootstrap | Denied permanently |
| Empty module check | All operational modules show zero real records, not sample data |

Security review threshold is CRITICAL=0, HIGH=0, blocking MEDIUM=0. It must include token leakage, service-role exposure, bootstrap replay/race, Auth user without business authority, center fallback, old-browser cache contamination, and accidental P3D/P4B deployment.

## 10. Rehearsal and final handoff plan

### Phase A — CHB-1 local implementation

Implement the allowlist above, clone-test the migration against both populated and empty schemas, generate the schema-only clean-install package, and leave it local for review. Do not modify production.

### Phase B — disposable fresh-project rehearsal

After separate approval, create a disposable Supabase project; configure hosted Auth with email confirmation; apply only the reviewed clean-install package; create empty private buckets; generate fresh server secrets; deploy the eight governance functions plus bootstrap; configure a one-time token digest; and verify every must-zero class.

Run the full bootstrap twice: first with automated isolated identities, then as a physical two-device rehearsal with anh Hải. Prove one Owner, one center, permanent lock, empty modules, reload, logout/login, no old cache, and normal Admin provisioning after bootstrap. Do not claim physical handoff until anh Hải performs it.

### Phase C — final fresh installation

1. Freeze frontend/schema/Edge hashes and a clean-install count/digest manifest.
2. Capture and restore-test a protected archive of the old production project; keep it as historical retention evidence.
3. Create a new project only after explicit approval; never clone current Auth, Vault, Storage, or business rows.
4. Apply the reviewed schema package and verify physical security before recording install metadata.
5. Generate fresh secrets server-side, deploy exact functions, configure redirect/origin/email confirmation, and verify must-zero counts again.
6. Deliver the raw one-time code to anh Hải out of band and destroy operator plaintext.
7. Anh Hải creates/confirms his own account and performs the first-center claim.
8. Verify permanent lock, exactly one Owner, zero business data, module empty states, reload, a second browser, and direct-access denial.
9. Enroll two approved independent recovery custodians in a separate controlled gate; perform inspect/non-destructive readiness only.
10. Switch the frontend environment/cutover only after acceptance. Keep the old project isolated/read-only according to the retention decision; do not delete it as part of handoff.

### Containment

- Before a successful claim: suspend/rotate the token server-side or rebuild the disposable project; never expose a partially trusted UI.
- After claim: bootstrap cannot be reopened. Use normal Owner/Admin governance and recovery. If acceptance fails, keep the new project isolated and do not cut over.
- Unknown state, unexpected nonzero data, migration drift, missing email confirmation, token exposure, duplicate Owner/center, browser service-role material, or P3D/P4B presence is a hard stop.

## 11. CHB-0 boundaries and next gate

CHB-0 performed read-only repository and production inspection plus this local contract document. It did not create a project, mutate SQL/Auth/Storage/Vault, edit applied migrations, deploy, or touch P3D/P4B/Figma.

Next gate: **CHB-1 — local clean-install baseline + first-owner bootstrap implementation**, restricted to the frozen allowlist. A project creation/rehearsal gate follows only after CHB-1 local PASS and explicit approval.
