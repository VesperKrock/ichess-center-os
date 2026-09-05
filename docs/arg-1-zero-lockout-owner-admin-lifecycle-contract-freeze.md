# ARG-1 — Zero-lockout Owner/Admin lifecycle contract freeze

Status: **PASS — contract frozen; implementation not started**

Date: 2026-09-05

Baseline: `bc606817a1c5cdb360280cd676f787cd93b95b69`

## 1. Decision

ARG-1 freezes the product and security contract for managed Owner/Admin accounts. It does not change Auth, memberships, production data, SQL, Edge Functions, or the frontend.

The accepted direction is:

- every rollout center has exactly one canonical active Owner;
- routine Owner handoff is prepared first and switches authority atomically only after the successor proves control of a non-temporary credential;
- emergency recovery is a narrow server-side authority requiring two distinct recovery-custodian approvals; it is not an email allowlist, impersonation, Platform Owner, or Acting Mode;
- normal lifecycle actions never hard-delete an Auth identity or membership history;
- a managed Admin identity is dedicated to one center and uses an operator-reviewed email, not a center-derived fixed email;
- temporary/reset credentials cannot reach ordinary business data;
- membership revocation blocks center authority immediately; session invalidation is a required, durable external step;
- Auth and Postgres changes use a durable saga: `PREPARED → external mutation → FINALIZED | REPAIR_REQUIRED`;
- governance audit is append-only;
- ordinary Owner/Admin business parity is unchanged; lifecycle governance remains narrowly Owner-only.

## 2. Current truth and compatibility boundary

The existing authority sources remain valid:

- Supabase Auth is identity and credential authority.
- `center_members` is center membership/role/status authority.
- an active `owner` membership is current Owner authority.
- business RPCs continue to require active exact-center membership.
- browser state is never account, membership, or recovery authority.

Read-only ARG-0 production evidence found five active production centers, each with exactly one active Owner. A non-production center has legacy multiple active Owners, and one legacy raw `admin` role remains outside the canonical `center_admin` vocabulary.

Therefore ARG-2 must not install a global constraint by silently choosing or demoting a legacy Owner. It must:

1. enumerate an explicit rollout-center allowlist;
2. require exactly one active Owner and canonical role values for every allowlisted center;
3. stop on ambiguity;
4. leave non-allowlisted/ambiguous centers unchanged and not lifecycle-enabled.

## 3. Frozen invariants

### Identity and history

1. Auth user ID is the stable identity. Email is a login attribute and display evidence, never a foreign key or authorization key.
2. No supported lifecycle path calls Auth hard-delete.
3. Historical actor/subject identifiers, memberships, commands, events, and business records survive revoke, replacement, and handoff.
4. A new Admin/Owner candidate uses a genuinely new reviewed identity. Existing Auth identities are never silently attached by matching email.
5. Managed `center_admin` identities have at most one center membership. A multi-center or mixed-role identity fails closed and requires separate governance review.

### Center authority

6. An enabled center has exactly one membership with `role=owner` and `status=active`.
7. A center may temporarily have zero active Admins; its Owner can still operate ordinary business.
8. A center has at most one active canonical `center_admin` under this contract.
9. Owner handoff never exposes two active Owners and never commits zero active Owners.
10. Direct browser DML cannot create, promote, demote, revoke, restore, or replace Owner/Admin memberships.
11. Every mutation binds exact center, caller, target Auth user, expected membership/governance version, action, and request ID.

### Credential and session safety

12. A membership in `pending_credential`, `reset_required`, `revoke_pending`, or `revoked` is not active business authority.
13. Existing business guards that require `status=active` remain fail-closed for these states.
14. Temporary credentials are random, one-time handoff values and never enter tables, audit, logs, URL, analytics, localStorage, or sessionStorage.
15. Target users must replace the temporary credential through the approved server flow before membership becomes active.
16. Reset first removes active business authority, invalidates old sessions, and then requires credential replacement before reactivation.
17. Revocation is successful only when membership authority is blocked and the supported session-invalidation step is verified.
18. ARG-2 must prove a hosted-supported session invalidation mechanism. If exact target-session invalidation cannot be proven, production rollout stops; UI must not claim completion.

### Audit and idempotency

19. Every lifecycle request creates a durable command and immutable `PREPARED` event before external Auth mutation.
20. Every external attempt must be reconciled to a non-secret outcome/receipt digest before success. Until reconciliation is durable, the command remains non-final and its target remains without newly granted business authority.
21. Same request ID plus identical intent returns/resumes the same command. Changed intent returns conflict.
22. No error response may hide a committed authority or credential change.
23. Audit events are insert-only. `anon`, `authenticated`, and `service_role` receive no `UPDATE`, `DELETE`, or `TRUNCATE` on audit events.
24. Existing `account_audit_logs` is hardened against update/delete/truncate; existing rows are preserved.
25. Audit or durable-command failure prevents the protected mutation from starting.

## 4. Canonical state machines

### 4.1 Durable governance command

```text
NEW
  → PREPARED
      → external Auth action succeeds
          → FINALIZED
          → REPAIR_REQUIRED (DB finalization failed)
      → external Auth action fails
          → REPAIR_REQUIRED
      → CANCELLED (only before any external action)

REPAIR_REQUIRED
  → resume same request/intent
      → FINALIZED
      → REPAIR_REQUIRED
```

There is no automatic rollback claim across Auth and Postgres. Repair first reconciles the recorded command and never blindly repeats an external mutation. If an applied temporary credential cannot be proven/delivered after a finalization failure, repair may deliberately rotate it again under the same command, invalidating the unknown credential and incrementing a non-secret reissue counter; the target remains non-active until the repaired result is finalized.

### 4.2 Admin provision

```text
NONE
  → PREPARED(new reviewed email, target center)
  → Auth identity created
  → center_admin / pending_credential
  → target replaces temporary credential
  → center_admin / active
```

- Existing-email collision is review-required, not auto-link.
- The temporary credential cannot open business modules.
- Initial provision is rejected if an active Admin exists; use replacement instead.

### 4.3 Credential reset

```text
active
  → reset_required + PREPARED
  → old sessions invalidated
  → temporary credential applied
  → target replaces credential
  → active + FINALIZED
```

On any failure after `reset_required`, access stays blocked and the same command is repairable. The old credential is never silently restored.

### 4.4 Revoke and restore

```text
active
  → revoke_pending (center business authority blocked atomically with PREPARED audit)
  → sessions invalidated
  → revoked + FINALIZED

revoked
  → restore_pending
  → fresh temporary credential + session invalidation
  → target replaces credential
  → active + FINALIZED
```

Restore never re-enables a previously exposed credential without rotation.

### 4.5 Planned Admin replacement

```text
old Admin active
  → new identity pending_credential (no authority)
  → new identity proves credential control
  → one DB transaction:
       old Admin → revoked
       new Admin → active
       canonical Admin pointer/version → new Admin
  → invalidate old Admin sessions
  → FINALIZED or REPAIR_REQUIRED
```

If replacement is urgent, revoke the old Admin first; the Owner operates temporarily while the new Admin completes onboarding.

### 4.6 Planned Owner handoff

```text
current Owner active
  → HANDOFF_PREPARED(successor identity, expiry, expected version)
  → successor pending_credential
  → successor accepts and proves credential control
  → one DB transaction:
       current Owner → revoked/former_owner
       successor → owner/active
       canonical Owner pointer/version → successor
  → invalidate former Owner sessions
  → FINALIZED or REPAIR_REQUIRED
```

- The current Owner remains canonical until the atomic swap.
- The target cannot approve or finalize their own promotion.
- Handoff expires and can be cancelled only before the swap.
- If post-swap session invalidation fails, the new Owner remains canonical, the former Owner has no center authority, and the command is `REPAIR_REQUIRED`.

### 4.7 Emergency Owner recovery

Emergency recovery is replacement, not impersonation and not a password reset of a possibly multi-center Owner identity.

```text
RECOVERY_REQUESTED(new reviewed identity, center, reason/evidence digest, expiry)
  → approval by recovery custodian A
  → approval by distinct recovery custodian B
  → successor pending_credential
  → successor proves credential control
  → atomic Owner swap using the same invariant as planned handoff
  → invalidate former Owner sessions
  → FINALIZED or REPAIR_REQUIRED
```

Frozen recovery-authority rules:

- recovery custodians are identified by Auth user ID in server data, never source-code/email allowlists;
- minimum approval threshold is two distinct active custodians;
- requester, target, and either approver cannot collapse into one identity;
- custodians cannot open center business data, act as Owner, or alter Admins through this role;
- recovery is disabled if fewer than two eligible custodians exist;
- all approvals bind exact request, center, target, expiry, governance version, and evidence digest;
- execution is server-only and single-use;
- configuring/replacing custodians is a separately approved production operation, not self-service UI.

This authority is intentionally smaller than Platform Owner/Acting Mode and creates neither feature.

## 5. Failure semantics

| Failure point | Required result |
|---|---|
| Validation/authorization/audit prepare fails | No Auth or membership mutation |
| Auth create/reset fails | Command `REPAIR_REQUIRED`; candidate remains non-active |
| Membership revoke committed, session invalidation fails | Center authority remains blocked; `REPAIR_REQUIRED`; no success copy |
| Auth action succeeds, DB finalization fails | No success/secret handoff; command remains non-final; retry reconciles first and never repeats blindly |
| Audit finalization fails | No success is returned; target remains blocked from newly granted authority; repair reconciles the prepared command |
| Same request and intent retries | Return/resume original command |
| Same request with changed intent | Conflict, no mutation |
| Stale expected version | Conflict, no mutation |
| Center/account changes mid-flow | Clear handoff/secret UI state and require a fresh command read |
| Recovery approval expires or authority changes | Fail closed; require a new request |

External receipts may contain provider IDs/status/timestamps or hashes, but never credentials, tokens, recovery evidence plaintext, or raw JWTs. A temporary credential is returned only after the matching command finalization is durable; otherwise it is discarded and must be safely rotated during repair.

## 6. Authority matrix

| Action | Active Owner | Active Admin | Candidate/target | Recovery custodian | Server executor |
|---|---:|---:|---:|---:|---:|
| Ordinary center business | Yes | Yes | No until active | No | Enforces membership |
| List center Admin lifecycle | Yes | No | Own minimal status only | No | Yes |
| Provision/reset/revoke/restore Admin | Initiate/confirm | No | Accept/change own credential | No | Execute |
| Planned Admin replacement | Initiate/confirm | No | Accept/change own credential | No | Atomic swap |
| Planned Owner handoff | Initiate | No | Accept/change own credential | No | Atomic swap |
| Emergency Owner recovery | No single Owner bypass | No | Accept/change own credential | Approve, two distinct | Atomic swap |
| Add/remove recovery custodian | No | No | No | No self-change | Separate approved operation |
| Hard-delete Auth identity | Never | Never | Never | Never | Not supported |
| Read immutable governance audit | Exact scoped Owner view | No by default | Own receipt only | Recovery-event scope only | Yes |

Owner-only governance does not authorize arbitrary business-data overrides. Admin retains parity for ordinary Student, Schedule, Attendance, Tuition, Finance, CRM, Inventory, Notes, and Staff operations.

## 7. Server and browser boundary

- New lifecycle tables use RLS and `FORCE ROW LEVEL SECURITY`.
- Browser roles have no direct lifecycle-table mutation grants.
- Mutations are server RPCs callable only by reviewed Edge Functions; authorization is repeated inside the database mutation.
- Owner/recovery decisions use stable Auth user and membership IDs, never client role labels.
- Candidate-status lookup returns only the caller's minimal onboarding state.
- Temporary credentials exist only in a one-time response and ephemeral UI memory; close, logout, center/account switch, and reload clear them.
- No lifecycle projection becomes browser business authority.
- Realtime may notify the app to re-resolve access, but the database membership remains authoritative.
- Every business operation continues to re-check active exact-center authority; revoked memory must never authorize a request.

## 8. ARG-2 implementation allowlist

ARG-2 is a local implementation gate. It must not apply production migrations or deploy without a later explicit rollout approval.

Exact planned file scope:

### New

- `supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql`
- `supabase/functions/complete-account-credential-change/index.ts`
- `supabase/functions/complete-account-credential-change/deno.json`
- `supabase/functions/manage-owner-handoff/index.ts`
- `supabase/functions/manage-owner-handoff/deno.json`
- `supabase/functions/manage-owner-recovery/index.ts`
- `supabase/functions/manage-owner-recovery/deno.json`
- `src/account-lifecycle.js`
- `tests/arg-2-owner-admin-lifecycle-contract-smoke.js`
- `tests/arg-2-owner-admin-lifecycle-local-db-qa.js`
- `docs/arg-2-owner-admin-lifecycle-implementation.md`

### Existing files allowed to change

- `supabase/functions/list-center-admin-accounts/index.ts`
- `supabase/functions/provision-center-admin-account/index.ts`
- `supabase/functions/reset-center-admin-password/index.ts`
- `supabase/functions/revoke-center-admin-access/index.ts`
- `supabase/functions/restore-center-admin-access/index.ts`
- `supabase/config.toml`
- `src/main.js`
- `src/supabase-auth.js`
- `tests/supabase-c7-6d-edge-function-admin-provisioning-implementation-smoke.js`
- `tests/supabase-c7-6i-reset-mat-khau-tam-admin-va-handoff-tien-loi-smoke.js`
- `tests/supabase-c7-7b-revoke-disable-admin-access-pack-smoke.js`
- `tests/supabase-c7-8a-owner-account-management-ui-readonly-smoke.js`
- `tests/supabase-c7-8b-owner-account-status-endpoint-ui-wiring-smoke.js`
- `tests/supabase-c7-8c-wire-reset-password-button-handoff-ui-smoke.js`
- `tests/supabase-c7-8d-wire-create-admin-button-handoff-ui-smoke.js`
- `tests/supabase-c7-8e-revoke-access-ui-safety-gate-smoke.js`
- `tests/supabase-c7-8e-1-revoke-window-restore-ux-polish-smoke.js`
- `tests/supabase-c7-8f-controlled-live-revoke-restore-phongtrong-smoke.js`
- `tests/supabase-c7-8g-wire-live-revoke-restore-ui-phongtrong-smoke.js`
- `tests/supabase-c7-8h-owner-account-management-final-polish-smoke.js`
- `tests/supabase-c7-9a-account-lifecycle-readonly-audit-smoke.js`
- `tests/supabase-c7-9b-persistent-revoked-restore-state-smoke.js`
- `tests/supabase-c7-9c-access-denied-ux-revoked-user-smoke.js`

### Explicitly excluded

- business-domain migrations and RPCs;
- P3D/P4B;
- Platform Owner/Acting Mode;
- Google/MFA/Teacher provisioning;
- Figma/taskbar/module paint;
- Auth provider configuration and production recovery-custodian activation.

Any need to edit business-domain guards broadly, access `auth` internal tables directly, or use undocumented/private session APIs is a blocking scope expansion requiring review.

## 9. ARG-2 QA matrix

| Area | Required proof |
|---|---|
| Baseline | Frozen migrations unchanged; explicit rollout centers have exactly one active Owner |
| Provision | New reviewed identity; existing-email collision fail-closed; no fixed center email |
| Credential gate | Temporary login reaches only change-password flow; ordinary module/RPC access denied |
| Password change | Successful change activates once; retry idempotent; plaintext absent from DB/log/storage |
| Reset | Membership blocked before external reset; old sessions invalidated; failure repairable |
| Revoke | Immediate center write/read denial; refresh/relogin denied; session invalidation verified |
| Restore | Credential rotation required; no old credential reuse; active only after completion |
| Admin replacement | Planned and urgent paths; at most one active Admin; old history retained |
| Owner handoff | Concurrent finalize attempts; exactly one winner; owner count never 0 or 2 |
| Last Owner | Direct DML, stale request, delete/demote attempts denied |
| Recovery | Two distinct custodians; self-approval/collusion/expiry/wrong-center denied |
| Saga | Failure injection before/after Auth mutation; accurate `REPAIR_REQUIRED`; exact retry resumes |
| Audit | Prepare/final events present; append-only; update/delete/truncate denied to browser/service role |
| Sessions | Hosted-supported target invalidation proven; old session cannot regain center authority |
| Exact center | Same-center intended access; cross-center reads/writes/recovery approvals denied |
| Multi-center | No center Owner may reset a shared/multi-center identity through the Admin path |
| History | Revoke/replacement/handoff preserves actor references, commands, and business records |
| UI memory | Handoff secrets cleared on close/reload/logout/center/account switch; no persistence/log leak |
| Compatibility | Owner/Admin ordinary parity and all current business modules unchanged |

Required roles/contexts: current Owner A, Admin B in the same center, another-center account C, Owner successor D, two distinct recovery custodians, and fresh isolated browser sessions. All records must be synthetic and cleanup must retain immutable audit evidence.

## 10. ARG-2 hard stops

ARG-2 must stop rather than weaken this contract if:

- a rollout center has zero or multiple active Owners;
- a legacy raw role cannot be reconciled by an explicit reviewed mapping;
- session invalidation requires an undocumented/private Auth interface;
- a temporary credential can reach any ordinary business RPC;
- Auth mutation can start without durable prepared audit;
- repair would require replaying an unknown external mutation;
- audit append-only enforcement or direct-DML denial fails;
- owner count can transiently become zero/two;
- recovery can be approved by one person, by email/source allowlist, or by the target;
- an Auth hard-delete or business-domain migration becomes necessary;
- Owner/Admin ordinary business parity or exact-center isolation regresses.

## 11. Frozen next gate

`ARG-2 — OWNER/ADMIN LIFECYCLE LOCAL IMPLEMENTATION + ADVERSARIAL QA`

ARG-2 implements only the allowlisted files above, runs local/controlled QA, calculates the migration hash, and stops before commit, deploy, Auth configuration, recovery-custodian activation, or production mutation unless a later prompt explicitly authorizes those actions.
