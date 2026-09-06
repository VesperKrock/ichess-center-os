# ARG-2 Owner/Admin lifecycle implementation

Status: **LOCAL PASS — not committed, not deployed, not applied to production**

Contract checkpoint: `41b38b02d4440cc6df3cbe2f3aedc8df0f7a4ee6`

## Implemented boundary

ARG-2 implements the frozen ARG-1 lifecycle contract without changing ordinary
Owner/Admin business permissions:

- exactly one canonical active Owner per governed center;
- versioned Admin provision, reset, revoke, restore, and replacement;
- two-phase Owner handoff with the old Owner retained until the atomic swap;
- emergency recovery with a reviewed target, expiry, evidence digest, and two
  distinct active custodian approvals separate from requester and target;
- temporary and reset-required credentials deny ordinary business authority;
- Auth identity is never hard-deleted;
- governance commands are durable and progress from `PREPARED` to `FINALIZED`,
  `REPAIR_REQUIRED`, or a pre-swap cancellation;
- governance audit is append-only;
- server capability, not a center list in browser code, controls availability.

## Authority and state model

| Concern | Authority | Browser role |
| --- | --- | --- |
| Current Owner/Admin | `center_access_governance` plus versioned `center_members` | Display current server result only |
| Credential readiness | `account_credential_gates` | Show mandatory change screen; never grant authority |
| Lifecycle command | `account_governance_commands` | Retain the request ID in memory only while retrying the same dialog |
| Audit | `account_governance_events` and existing account audit | Read reviewed state; cannot update/delete/truncate |
| Emergency recovery | recovery custodian/approval tables | No ordinary center access and no self-service configuration |
| Auth mutation | reviewed Edge Functions using server-held privilege | Invoke function with caller JWT; no privileged key in client |

Governance capability states are `IDLE`, `LOADING`, `READY`, `UNAVAILABLE`, and
`FAILED`. A missing status, missing version, wrong center, or incomplete response
is fail-closed. Direct actions require a current exact-center `READY` capability.

## Command and reconciliation rules

Every external Auth operation follows this order:

1. authenticate the caller and authorize the exact center;
2. persist one command and its `PREPARED` event;
3. perform the server-side Auth action;
4. record the external result and complete the database transition;
5. return success only after the authoritative terminal state is durable.

The same request ID with the same intent resumes the same command. The same ID
with changed intent is rejected. Auth user metadata binds a committed mutation to
its governance command, allowing credential completion, revoke, Admin replacement,
Owner handoff, and recovery retries to avoid repeating a mutation after a lost
response. A one-time temporary credential that was delivered to an unknown response
cannot be recovered; reset/restore/candidate repair rotates a new credential under
the same durable command and never grants business authority early.

If Auth succeeded but database finalization or session invalidation cannot be
confirmed, the command remains `REPAIR_REQUIRED`. Revoked/replaced authority is not
restored as compensation. No hard-delete compensation exists.

## Owner and recovery invariants

- Direct revoke, demotion, or deletion of the last Owner is rejected.
- Owner handoff swaps old and new memberships in one database transaction.
- After the swap, the new Owner remains canonical even if predecessor session
  invalidation needs repair; there is never a zero-Owner committed state.
- Recovery requester, target, and either approving custodian cannot collapse to
  one identity.
- Duplicate approval is an idempotent replay and creates no duplicate approval or
  semantic audit event.
- A recovery custodian has no center business authority by virtue of that role.
- A shared multi-center Owner cannot be recovered through a single-center action
  without a separately coordinated plan.

## Edge Function allowlist

The ARG-3 deployment set is exactly:

1. `list-center-admin-accounts`
2. `provision-center-admin-account`
3. `reset-center-admin-password`
4. `revoke-center-admin-access`
5. `restore-center-admin-access`
6. `complete-account-credential-change`
7. `manage-owner-handoff`
8. `manage-owner-recovery`

All eight require JWT verification. Privileged Auth calls remain server-side. No
function calls an Auth hard-delete API or directly mutates `center_members`.

## Migration artifact

File:
`supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql`

SHA-256:
`0E805E004E9446EF93CE0B16AE609E9C767AD81454E8E8B83D76835DE1E41CFA`

The migration is additive and transactional. New governance tables use RLS and
FORCE RLS, browser DML is revoked, service mutation is RPC-only, security-definer
functions use a fixed empty search path, and historical Auth/member references use
restrictive foreign keys rather than destructive cleanup.

## Local verification

- exact migration bytes parsed and applied to the guarded temporary clone;
- transactional SQL fixtures rolled back completely;
- one-Owner, last-Owner, handoff, recovery, exact-center, stale/version,
  idempotency, concurrency, repair, and audit invariants passed;
- deterministic fake-Auth fault tests covered Auth failure, success, lost response,
  finalization failure, session-invalidation failure, and committed-state retry;
- all eight Edge Functions passed Deno type-check and bundle validation;
- ARG-2 contract smoke and all 15 updated C7 lifecycle smokes passed;
- focused login, Staff/Teacher link, Staff authority, launcher, and Internal Console
  regressions passed;
- changed JavaScript syntax, production build, and diff whitespace checks passed.

Two unrelated legacy structural smokes still contain pre-existing mojibake string
assertions against unchanged Teacher/Staff render files. They are not ARG-2 files,
do not indicate an ARG-2 behavior regression, and were not weakened or edited.

## Historical C7 test reconciliation

The edited C7 tests each record `OLD ASSUMPTION`, `CURRENT ARG-2 CONTRACT`, and
`WHY VALID`. The replaced assumptions were:

- direct Edge/table membership mutation;
- fixed center-derived Admin email;
- independently assembled Auth/membership status as UI authority;
- static center allowlists authorizing real actions;
- external Auth mutation before a durable governance prepare/audit record;
- treating revoke/restore or a one-time credential response as safely replayable
  without command identity and version checks.

The replacement assertions preserve their security intent by requiring the
versioned server saga, explicit human identity, exact-center capability, fail-closed
responses, immutable audit, and same-command reconciliation.

## ARG-3 frozen rollout package

### Files

ARG-3 may release only the files in the ARG-1 allowlist plus this implementation
document. The runtime production files are:

- `src/account-lifecycle.js`
- `src/main.js`
- `src/supabase-auth.js`
- `supabase/config.toml`
- the migration above;
- the eight Edge Functions listed above;
- ARG-2 tests and the 15 explicitly allowlisted C7 test updates.

### Preconditions

- Git diff and migration hash exactly match this package.
- Production project identity and migration ledger have not drifted.
- A protected logical backup is decrypted/read-tested in a separate restore target.
- Every rollout center is explicitly enumerated; each has exactly one active Owner
  and at most one active Admin, with membership IDs and versions frozen.
- Recovery custodians are configured only through a separately approved server-side
  operation; the requester and two approvers are independent identities.
- No browser, log, document, or command metadata contains a temporary password,
  token, recovery evidence plaintext, or privileged key.

### Deployment order

1. Commit and push only the frozen package.
2. Deploy all eight Edge Functions and frontend/config first. They must remain
   fail-closed while the migration is absent; ordinary business remains unchanged.
3. Verify the live governance capability is unavailable, not falsely ready.
4. Create and restore-verify the production backup.
5. Apply only the exact migration through the reviewed controlled SQL channel.
6. Verify tables, RLS/FORCE RLS, grants, triggers, RPC signatures, and audit
   immutability before recording only this migration version in the ledger.
7. Activate only the frozen explicit center allowlist with exact Owner/Admin
   membership IDs and versions; stop on any mismatch.
8. Verify capability transitions to `READY` only for activated centers.
9. Run synthetic multi-session QA for Owner, Admin, successor, another-center user,
   and independent recovery custodians. Inject Auth/finalize/invalidation failures.
10. Cleanup all operator-active synthetic accounts/memberships through supported
    lifecycle operations; retain immutable audit evidence and verify other business
    domains unchanged.

### Hard stops and containment

Stop before mutation on project, ledger, hash, membership/version, Owner-count,
backup, grant, RLS, Edge, or recovery-custodian drift. If a serious defect is found
after schema apply, suspend governance capability for the exact affected centers,
leave ordinary center data intact, keep audit evidence, and use a reviewed forward
fix. Do not drop the schema, delete Auth identities, restore revoked authority
silently, or apply unrelated migrations.
