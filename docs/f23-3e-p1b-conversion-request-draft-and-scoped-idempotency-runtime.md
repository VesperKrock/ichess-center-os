F23_3E_P1B_STATUS: IMPLEMENTED IN REPO
F23_3E_P1B_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1B_MIGRATION_CREATED: YES
F23_3E_P1B_LOCAL_SQL_APPLY: PASS
F23_3E_P1B_LOCAL_DB_BEHAVIOR_QA: PASS
F23_3E_P1B_REMOTE_APPLY: NOT RUN
F23_3E_P1B_BROWSER_RUNTIME_WIRING: NOT STARTED
F23_3E_P1B_FINAL_CAPABILITY_ENFORCEMENT: NOT STARTED
F23_3E_P1B_APPROVAL_EXECUTOR: NOT STARTED
F23_3E_P1B_REAL_CONVERSION: NOT IMPLEMENTED
F23_3E_P1B_AUTH_CHANGE: NO
F23_3E_P1B_EDGE_FUNCTION_CHANGE: NO
F23_3E_P1B_DEPLOY: NOT RUN
F23_3E_P1B_REAL_DATA_CHANGE: NO

# F23.3E-P1B — Conversion Request draft and scoped idempotency runtime

## 1. Boundary and inherited contracts

P1B implements the approved protected database primitive for creating, updating,
submitting, cancelling, and reading the safe status of a conversion Request. The
migration and behavioral QA were applied only to the local Docker Supabase
database. No remote database, Auth configuration, Edge Function, browser, UI,
deployment, or real record was changed.

```text
F23_2_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P1A_FINAL_TECHNICAL_AUDIT: PASS
F23_13C_FINAL_TECHNICAL_AUDIT: PASS
F23_13D_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P1B_BROWSER_CALLABLE: NO
F23_3E_P1B_AUTHENTICATED_DIRECT_EXECUTE_ALLOWED: NO
F23_3E_P1B_ANON_DIRECT_EXECUTE_ALLOWED: NO
F23_3E_P1B_SERVICE_ROLE_ONLY_INTERNAL_RUNTIME: YES
P1B_ACTOR_PARAMETER_IS_END_USER_AUTHORITY: NO
P1B_AUTH_USERS_LOCK_EQUALS_ACCOUNT_SECURITY_CONTROL: NO
P1B_FINAL_CAPABILITY_ENFORCEMENT_IMPLEMENTED: NO
P1B_F23_13D_RESOLVER_RUNTIME_IMPLEMENTED: NO
P1B_FRESH_STEP_UP_IMPLEMENTED: NO
```

`p_actor_user_id` is protected-service attribution input. Each mutating RPC
locks the corresponding `auth.users` row only to prove existence and then
requires that user to be the current active Case assignee. That row lock is not
an account-security, membership, Staff, capability, MFA, or step-up decision.
P1D must replace the attribution input with server-derived actor context before
any browser wiring.

P1B does not approve or execute conversion and creates no Guardian, Student,
Relationship, match decision, profile reservation, membership, account,
Tuition, payment, class, schedule, attendance, or grade.

## 2. Prerequisite and immutable-migration audit

The exact local catalog established:

- `public.centers.id` is `text`; `auth.users.id` is non-null `uuid`.
- `public.center_members` exists with `center_id text`, `user_id uuid`, `role
  text`, and `status text`; P1B does not use it as final authority.
- `pgcrypto 1.3` is installed in schema `extensions`.
- the deterministic 32-byte outcome hash calls exact
  `extensions.digest(bytea,text)` with algorithm `sha256`.
- opaque identifiers use exact `pg_catalog.gen_random_uuid()`.
- `auth.uid()` and `auth.role()` exist in schema `auth`; P1B does not use a
  browser JWT claim as authority.
- `service_role` exists and has `BYPASSRLS`; application RPC access is still
  explicitly reduced to exact function grants.

The seven checkpoint migrations remained byte-for-byte unchanged:

| Migration | SHA-256 |
|---|---|
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |
| `202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql` | `81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6` |

The one new migration is:

```text
supabase/migrations/202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql
SHA-256: BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F
```

## 3. Forward schema alterations

`public.crm_idempotency_registry` now stores a typed immutable prior-result
snapshot:

```text
request_intent_digest
result_request_id
result_request_version
result_case_version
result_request_status
result_outcome_code
result_correlation_id
```

The registry keeps operation intent, canonical Request intent, and action-graph
digest as separate bindings. A `COMPLETED` record must have the full snapshot;
every non-`COMPLETED` state must have no result snapshot. Versions are positive,
status/outcome codes are allowlisted, and `result_request_id` has an exact-center
deferred FK. The P1A lifecycle guard plus the P1B snapshot guard makes scope,
intent, and terminal result immutable.

```text
P1B_IDEMPOTENCY_PRIOR_RESULT_SNAPSHOT_PERSISTED: YES
P1B_REPLAY_RETURNS_CURRENT_REQUEST_STATE_INSTEAD_OF_PRIOR_RESULT: NO
P1B_TERMINAL_RESULT_SNAPSHOT_MUTABLE: NO
```

`public.crm_conversion_request` now also stores `source_assignment_id` with an
exact-center Assignment FK. Version alone was insufficient because a replacement
Assignment row can start again at version one; all update/submit/cancel paths now
bind and recheck both exact Assignment identity and version.

P1A's outbox `event_version` previously doubled as mutable delivery-row revision.
P1B makes it the immutable aggregate Request version required by the event
contract, adds independent positive `delivery_version`, and forward-replaces only
the outbox triggers. A partial unique index protects
`(center_id, aggregate_kind, aggregate_id, event_version)` for
`crm_conversion_request` events.

## 4. Exact RPC signatures and privilege boundary

```text
public.f23_3e_p1b_create_conversion_draft(
  uuid, uuid, integer, integer, integer,
  bytea, bytea, bytea, bytea, timestamptz
)

public.f23_3e_p1b_update_conversion_draft(
  uuid, uuid, integer, integer, integer, integer,
  bytea, bytea, bytea, bytea, bytea, timestamptz
)

public.f23_3e_p1b_submit_conversion_draft(
  uuid, uuid, integer, integer, integer, integer,
  bytea, bytea, bytea, bytea, bytea, timestamptz
)

public.f23_3e_p1b_cancel_conversion_request(
  uuid, uuid, integer, integer, integer,
  bytea, bytea, bytea, text, timestamptz
)

public.f23_3e_p1b_get_conversion_request_status(uuid)
```

All five functions are `SECURITY DEFINER SET search_path = ''`. `PUBLIC`, `anon`,
and `authenticated` have no execute privilege; only `service_role` has execute.
Every `f23_3e_p1b_internal_*` helper is revoked from browser roles and
`service_role`. No RPC accepts center, role, capability, operation name, resource
scope kind, raw key, credential, or arbitrary JSON from the caller.

The safe mutating response is exactly `ok`, `outcome_code`, `replayed`, opaque
Request ID, Request status/version, Case version, and correlation ID. Safe status
returns Request/Case IDs, statuses, source versions, and timestamps only; it
returns no Contact PII, graph/digest, candidate evidence, membership, or security
version.

## 5. Runtime gate and lock orders

Every mutation derives center from the Case or Request selector, then locks the
one `center_crm_control` row and proceeds only for `ACTIVE + ENABLED`. Missing,
disabled, planned, read-only, migrating, or suspended roots return
`CRM_RUNTIME_NOT_ACTIVE`. The functions never activate a root.

```text
CREATE_DRAFT_RUNTIME_ATOMIC_BEGIN
UPDATE_DRAFT_RUNTIME_ATOMIC_BEGIN
SUBMIT_REVIEW_RUNTIME_ATOMIC_BEGIN
CANCEL_REQUEST_RUNTIME_ATOMIC_BEGIN

0. CENTER_CRM_CONTROL_ROW
1. AUTH_USER_EXISTENCE_ROW
2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_OR_PREALLOCATED_REQUEST_ROW
3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS
4. CURRENT_ASSIGNMENT_ROW
5. AUDIT_OUTBOX_ROWS, then idempotency completion
6. COMMIT_ATOMIC
```

No path locks Case or Assignment before an overlapping Request. Rows are
rechecked after locking, including exact center, source Contact/Case versions,
exact current Assignment ID/version, current assignee, Request version/state,
and request/action digests.

## 6. Lifecycle and scoped idempotency semantics

- Create preallocates registry and Request UUIDs, reserves the Case-scoped key,
  locks/rechecks sources, inserts one `DRAFT` Request, increments Case exactly
  once to projection `DRAFT`, and stores the committed versions.
- Update requires `DRAFT`, changes only canonical Request intent/graph/source
  snapshots, and increments Request exactly once. Case remains `DRAFT` without a
  Case version bump.
- Submit requires exact current Request/source/Assignment versions and digests,
  changes Request to `READY_FOR_REVIEW`, Case projection to `REVIEW_PENDING`, and
  increments both exactly once. It does not approve or execute.
- Cancel permits requester cancellation only from `DRAFT` or
  `READY_FOR_REVIEW`, validates an allowlisted non-PII reason token, changes
  Request to `CANCELLED`, and returns Case projection to `NOT_STARTED` only after
  rechecking there is no other active Request.

Same scoped key plus the same bound intent/graph returns the stored original
snapshot with `replayed=true`, even after another operation advanced the Request.
It creates no new Request, version, Audit, or Outbox. Same scoped key with a
different binding returns `IDEMPOTENCY_CONFLICT` without changing the prior row.
A different key for a Case with an active Request returns
`ACTIVE_REQUEST_CONFLICT`; the temporary reservation is removed before return.

## 7. Audit, outbox, and transaction atomicity

Every successful non-replay mutation inserts exactly one immutable Audit event
and one durable Outbox event with the same correlation. Audit carries only exact
center, actor, opaque Request/Assignment, version edge, and optional safe reason.
Outbox uses the P1A flat allowlist and the committed Request version. No raw PII,
digest, graph payload, before/after JSON, credential, or nested object is stored.

The order is business mutation, Audit, Outbox, terminal idempotency snapshot, and
caller transaction commit. A forced Audit or Outbox failure rolled back Request,
Case, registry reservation, and all events in local QA.

```text
P1B_BUSINESS_AUDIT_OUTBOX_IDEMPOTENCY_ATOMIC: YES
P1B_AUDIT_FAILURE_ALLOWS_REQUEST_COMMIT: NO
P1B_OUTBOX_FAILURE_ALLOWS_REQUEST_COMMIT: NO
P1B_REPLAY_CREATES_NEW_AUDIT_OUTBOX: NO
```

## 8. Local behavioral and concurrency QA

The Node runner accepts no arguments and uses built-in modules only. It requires
`ICHESS_P1B_LOCAL_QA_ALLOW_RESET=YES`, rejects linked/remote locators, parses only
loopback Supabase status, and verifies the exact
`supabase_db_ichess-center-os` container plus Supabase/Compose project labels.
It invokes only `npx --no-install supabase db reset` for database reset.

The clean-reset run exited `0`. Live-catalog and behavioral results:

- browser execute denied; exact five service-role grants; helpers not exposed;
- PLANNED/DISABLED deny and local ACTIVE/ENABLED fixture allow;
- create, exact replay, different-intent conflict, and one-active conflict;
- current assignee, exact-center, source, Request, and Assignment version checks;
- update, submit, cancel from draft, cancel from ready, safe status;
- protected approval/execution/completion states remained unreachable;
- exact prior snapshot after a later Request update;
- replay emitted no duplicate Audit/Outbox;
- forced Audit and Outbox failures rolled back the full unit;
- two real PostgreSQL connections plus deterministic advisory barriers passed
  same-key replay, different-intent conflict, different-key active conflict,
  update-versus-submit, submit-versus-cancel, and assignment-change recheck.

The final reset in `finally` reapplied P1B, found fixture count `0`, and found no
root outside migration-defined `PLANNED/DISABLED` state.

```text
P1B_QA_FINAL_LOCAL_RESET: PASS
P1B_QA_LEFTOVER_FIXTURE_COUNT: 0
QA target: local Docker Supabase only
Remote action: NOT RUN
```

## 9. Deferred work

P1C/P1D and later packages remain responsible for the reviewed service layer,
server-derived actor/capability/Staff/membership decision, server masking, direct
API/RLS/read-path remediation, MFA/step-up, approval, match review, profile
reservation, conversion executor, Guardian/Student/Relationship writes, outbox
worker, UI wiring, import, rollout, and production readiness. P1B does not claim
any F23.13C/F23.13D runtime.

## 10. Semantic and inherited regression checks

```text
P1A local DB behavior QA: PASS
P1B local DB behavior QA: PASS
P1A semantic smoke: PASS
P1B semantic smoke: PASS
F23.3E-P1 planning smoke: PASS
F23.3E design smoke: PASS
F23.2 design smoke: PASS
F23.13C design smoke: PASS
F23.13D design smoke: PASS
git diff --check: PASS
```

Both checkpoint smokes now require every migration known at their checkpoint,
verify every immutable SHA-256, require exactly one canonical migration at the
checkpoint version, and reject an unknown or renamed migration at or before that
version. Migration filenames must match `^[0-9]+_[a-z0-9_]+\.sql$`, and versions
are compared as `BigInt`. Later-version migrations are allowed, so P1A accepts P1B
and both smokes remain compatible with future migrations without reducing any
schema, security, atomicity, fault-injection, concurrency, or cleanup coverage.

## 11. P1B implementation artifacts

```text
supabase/migrations/202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql
docs/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime.md
tests/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime-smoke.js
tests/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-local-db-qa.js
```

## 12. Exact closeout changed files

```text
tests/f23-3e-p1a-canonical-crm-schema-and-control-root-smoke.js
tests/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime-smoke.js
docs/f23-3e-p1b-conversion-request-draft-and-scoped-idempotency-runtime.md
docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md
```
