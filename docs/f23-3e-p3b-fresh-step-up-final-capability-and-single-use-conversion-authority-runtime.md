# F23.3E-P3B fresh step-up, final capability and conversion authority runtime

## Status

```text
F23_3E_P3B_STATUS: IMPLEMENTED IN REPO
F23_3E_P3B_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P3B_MIGRATION_CREATED: YES
F23_3E_P3B_LOCAL_SQL_APPLY: PASS
F23_3E_P3B_LOCAL_DB_QA: PASS

P3B_MEMBERSHIP_VERSION_RUNTIME: IMPLEMENTED
P3B_ACCOUNT_SECURITY_RUNTIME: IMPLEMENTED
P3B_TRUSTED_VERIFIER_DB_BOUNDARY: IMPLEMENTED
P3B_REAL_AUTH_PROVIDER_VERIFIER_INTEGRATION: NOT IMPLEMENTED
P3B_REAL_USER_STEP_UP_VERIFICATION: NOT RUN
P3B_STEP_UP_ASSERTION_RUNTIME: IMPLEMENTED
P3B_CONVERSION_SPECIFIC_FINAL_CAPABILITY_RESOLVER: IMPLEMENTED
P3B_ACTION_CHILD_FOUNDATION: IMPLEMENTED
P3B_PRODUCTION_REVIEWED_ACTION_MATERIALIZER: NOT IMPLEMENTED — P3C
P3B_SINGLE_USE_CONVERSION_AUTHORITY_RUNTIME: IMPLEMENTED
P3B_AUTHORITY_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D
P3B_TARGET_PROFILE_RUNTIME: NOT IMPLEMENTED — P3C
P3B_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED — P3D

F23_13D_FULL_PRODUCT_RUNTIME_IMPLEMENTED_BY_P3B: NO
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
F23_3E_P3B_REMOTE_APPLY: NOT RUN
F23_3E_P3B_AUTH_CHANGE: NO
F23_3E_P3B_EDGE_FUNCTION_CHANGE: NO
F23_3E_P3B_DEPLOY: NOT RUN
F23_3E_P3B_BROWSER_UI_WIRING: NOT STARTED

P3B_LOCAL_SECURITY_AUTHORITY_FOUNDATION_READY_FOR_P3C: YES
P3B_REAL_CONVERSION_EXECUTION_READY: NO
```

External technical audit closeout on 2026-08-12: PASS. P3B supplies the local
database security/authority foundation needed by P3C. It does not claim that a
real user has completed MFA, that a production Auth provider has been verified,
or that real conversion can execute.

## Scope and checkpoint

Implementation started from clean `main` checkpoint
`57862d64819956f282b9421a2bb5a626703c3234`. The 14 inherited checkpoint
migrations remain byte-identical. P3B owns exactly one forward migration:

```text
supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql
SHA256 8232FFD8EF0A63FB60E2A3FDE957EC542A3F196DA4272BF420FF7F3E98F099F0
```

P3B owns exactly these four artifacts:

1. `supabase/migrations/202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql`
2. `docs/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime.md`
3. `tests/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime-smoke.js`
4. `tests/f23-3e-p3b-fresh-step-up-final-capability-and-single-use-conversion-authority-runtime-local-db-qa.js`

No checkpoint migration, roadmap, application source, Auth production flow,
Edge Function, remote project, deployment, UI/import path or P3C/P3D runtime was
changed.

## Repository truth accepted from P3A

- P1B `Request.action_graph_digest` remains an immutable, opaque legacy
  caller-supplied 32-byte binding. It is not a canonical serialization.
- P3 `p3_action_set_digest` is separately server-derived from typed persisted
  `crm_conversion_action` rows using encoding version 1.
- The V1 serializer includes `action_version`; row order is canonical by
  `conversion_action_id`; raw PII and authentication evidence are excluded.
- Authority issuance transitions every action `REVIEWED -> APPROVED` with
  `action_version +1` before recomputing the persisted APPROVED digest.
- Exact issue replay reads the immutable committed result. It does not recheck
  the naturally APPROVED Request/actions or CONSUMED step-up assertion.
- `service_role` is transport/service authority only. It never substitutes for
  an end-user role, center membership, step-up, separation-of-duties check or
  target reuse decision.

Required semantic markers:

```text
AUTH_USER_EXISTS_MEANS_ACCOUNT_SECURITY_ACTIVE: NO
P3_ACTION_SET_ENCODING_VERSION: 1
P3_ACTION_SET_DIGEST_BINDS_ACTION_VERSION: YES
P3B_AUTHORITY_BINDS_ACTION_SET_LIFECYCLE_STATE: APPROVED
P3B_AUTHORITY_BINDS_PRE_APPROVAL_ACTION_DIGEST: NO
P3B_AUTHORITY_EXACT_REPLAY_REINTERPRETS_POST_SUCCESS_LIVE_STATE: NO
P3B_LEGACY_REQUEST_DIGEST_EQUALS_CANONICAL_ACTION_SET_DIGEST: NO
P3B_CALLER_ROLE_IS_AUTHORITY: NO
P3B_CALLER_CENTER_IS_AUTHORITY: NO
P3B_BROWSER_STEP_UP_BOOLEAN_IS_AUTHORITY: NO
P3B_SERVICE_ROLE_IS_END_USER_AUTHORITY: NO
P3B_TERMINAL_ENVIRONMENT_SOURCE: CRM_CONVERSION_AUTHORITY.ENVIRONMENT_FINGERPRINT
P3B_TERMINAL_OPERATION_BINDING_INCLUDES_ENVIRONMENT: YES
P3B_TERMINAL_IDEMPOTENCY_LOOKUP_USES_AUTHORITY_ENVIRONMENT: YES
P3B_TERMINAL_IDEMPOTENCY_INSERT_USES_AUTHORITY_ENVIRONMENT: YES
P3B_HARDCODED_LOCAL_TERMINAL_ENVIRONMENT: NO
P3B_FORMER_AUTHORITY_ISSUER_HAS_PERPETUAL_STATUS_READ: NO
P3B_AUTHORITY_STATUS_NONMEMBER_RESULT: RESOURCE_NOT_AVAILABLE
```

## Physical resources

### Membership versioning

`center_members.membership_version` is non-null, positive and backfilled to 1.
The compatibility trigger automatically derives exact `+1` for semantic
changes to role, status or center/user binding when an existing writer leaves
the version unchanged. An attempted arbitrary bump, skipped version or semantic
change preserving an explicitly stale version fails.

The frozen resources are:

```text
center_members_membership_version_positive
center_members_conversion_version_binding_key
center_members_conversion_capability_idx
f23_3e_p3b_center_members_version_guard
```

### `account_security_control`

The protected global account aggregate has the P3A lifecycle
`ACTIVE|SUSPENDED|DISABLED|REVOKED`, positive security/session/identity/factor/
assurance/control versions, a 32-byte evidence digest, guarded immutable user
binding and terminal `REVOKED` state. No row is bootstrapped from `auth.users`.
Only the trusted verifier receiving RPC can register/synchronize it.

Because the frozen sync contract accepts no caller center and the inherited
idempotency registry is center-scoped, the receiving boundary derives a stable
lexicographically ordered membership center, then locks and rechecks that
center's active CRM root. The center is never supplied as caller authority.

### `account_step_up_assertion`

Each assertion binds the canonical user, logical security session, exact center,
exact Request, fixed purpose `crm.real_conversion.execute`, assurance level,
provider namespace, 32-byte verification-reference digest and current account
security/session/assurance-policy versions. Database time accepts verifier
evidence only within a two-minute freshness window with 30 seconds of future
tolerance. Expiry is bounded by both verifier freshness and a five-minute
maximum.

An assertion begins `ISSUED`. It can become `EXPIRED`, `REVOKED` or
`SUPERSEDED`; only successful authority issuance can perform
`ISSUED -> CONSUMED` and set the unique `consumed_by_authority_id`. A rollback
leaves the assertion ISSUED.

### `crm_conversion_action`

The table is the physical P3A typed action child foundation, not a P3C
materializer. It contains the frozen finite Student, Guardian and relationship
action vocabulary, independent legacy digest snapshot, action-intent digest,
typed source/review/reservation/target/relationship bindings, finite safe
reasons, lifecycle and version.

Static shape constraints reject cross-kind nullable combinations. The final
resolver additionally rechecks complete endpoint coverage, exact Case candidate,
current review/reservation evidence and relationship endpoint kinds. P3B exposes
no production `PROPOSED -> REVIEWED` operation. The local QA inserted PROPOSED
rows and moved them to REVIEWED directly as local `postgres`, under forced RLS,
without creating a helper, grant, policy or persistent bypass.

### `crm_conversion_authority`

The protected authority binds:

- environment, center, actor and exact membership/version;
- Request, approved Request version, Case/Contact/Assignment IDs and versions;
- conversion intent and the independent legacy Request digest;
- P3 action-set encoding version and post-APPROVED digest;
- review, reservation and target set digests;
- consumed step-up assertion/version and account security/session/assurance
  versions;
- current identity/conversion/relationship/student-profile policy versions;
- fixed purpose and server-bounded issue/expiry timestamps.

P3B owns `ISSUED -> REVOKED|EXPIRED|SUPERSEDED`. Although the frozen vocabulary
reserves `CONSUMED`, the P3B guard deliberately rejects that transition. P3D must
replace/extend the guard inside its atomic executor package.

### Shared idempotency result family

The existing registry now has a third, disjoint P3 result family. The completion
constraint preserves strict mutual exclusion among P1, P2C and P3 snapshots.
P3 result JSON accepts an allowlisted, typed, PII-free shape. Binding columns
include actor, Request/resource versions, step-up, dual digests and a
server-derived `p3_operation_binding_digest` over all typed semantic RPC inputs.
Thus a caller cannot reuse a key with changed session, evidence, transition,
reason or expected version while repeating an unchanged caller digest.

Only completed immutable snapshots are replayed. Denied first attempts do not
leave a RESERVED idempotency row. Terminal result/binding changes are rejected.

The revoke/expire RPC selects the authority's immutable `center_id` and
`environment_fingerprint`, binds both into its server-derived terminal operation
digest, and uses that exact authority fingerprint for both idempotency lookup
and insert. The authority row is then locked and both values are rechecked
before mutation. Production SQL contains no local-environment terminal
fingerprint literal.

## Protected RPC inventory

Exactly six P3B external functions are `SECURITY DEFINER`, have empty
`search_path`, revoke execute from PUBLIC/anon/authenticated, and grant execute
only to `service_role`:

1. `f23_3e_p3b_register_or_sync_account_security_control`
2. `f23_3e_p3b_record_verified_conversion_step_up`
3. `f23_3e_p3b_evaluate_conversion_capability`
4. `f23_3e_p3b_issue_conversion_authority`
5. `f23_3e_p3b_read_conversion_authority_status`
6. `f23_3e_p3b_revoke_or_expire_conversion_authority`

All `f23_3e_p3b_internal_*` helpers revoke direct execute even from
`service_role`. The four protected tables force RLS, have no policies, have no
direct app-role grants and are not added to Realtime.

The final resolver derives, in order: active center root and policy versions;
active account control; exact active membership/version; finite owner or
center_admin role and separation deny; current Request; Case, Contact,
Candidate and Assignment; complete REVIEWED action set with P2 evidence; then
the exact fresh ISSUED step-up. Any unavailable/stale/foreign/legacy state wins
as DENY. Consultant, requester/self-approver and active assigned consultant are
never final approvers.

Authority status read is also fail-closed on current scope. A caller must have a
current active membership for the authority's exact center and a finite
`owner|center_admin` role. Historical issuance by the caller grants no bypass.
Unknown authorities and existing authorities outside current membership scope
both return `RESOURCE_NOT_AVAILABLE` with no status, Request, version, time or
reason detail.

## Authority transaction and replay

The issuance lock order is frozen and implemented as:

```text
CENTER_CRM_CONTROL_ROW
-> SORTED_IDENTITY_MUTEX_ROWS
-> ACCOUNT_SECURITY_CONTROL_ROW
-> STEP_UP_ASSERTION_ROW
-> MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS
-> REQUEST-SCOPED AUTHORITY ADVISORY MUTEX
-> IDEMPOTENCY_REGISTRY_ROW
-> CONVERSION_REQUEST_ROW
-> CONVERSION_ACTION_ROWS sorted ID
-> CRM_CONTACT_ROW
-> CONSULTATION_CASE_ROW
-> CANDIDATE_STUDENT_ROWS sorted ID
-> ASSIGNMENT_ROW
-> target rows if any (none in P3B no-target QA)
-> MATCH_REVIEW_ROWS
-> PROFILE_CREATION_RESERVATION_ROWS
-> AUDIT -> OUTBOX -> COMMIT
```

No network call occurs while locks are held. First success performs a fresh
capability check, consumes the assertion, changes Request
`READY_FOR_REVIEW -> APPROVED +1`, changes all actions
`REVIEWED -> APPROVED +1`, rereads those persisted APPROVED rows, computes the
canonical digest, inserts one ISSUED authority, appends three paired
Audit/Outbox events, stores the immutable result and commits. It writes no
profile or relationship, consumes no reservation and does not complete the
Request.

Exact replay takes all earlier canonical locks before the idempotency row, then
returns the immutable result before any live first-attempt interpretation. It
returns the same authority ID/version, approved Request version, expiry and
correlation ID with no second lifecycle transition or event.

## Local Auth fixture approval and evidence

The clean local reset contained `auth.users = 0`, which was the original
preflight blocker. The follow-up user approval authorized the minimum synthetic
local fixture needed for this P3B matrix. The runner inserted five UUID-only
local rows directly through local `postgres`: owner, center_admin, consultant,
inactive actor and foreign-center owner. It used no email, phone, password, MFA,
provider credential, real identity or Admin Auth API. UUIDs were generated per
run and tracked exactly.

```text
LOCAL SYNTHETIC AUTH FIXTURE: USED FOR QA
REAL AUTH USER: NOT USED
PRODUCTION AUTH MUTATION: NO
REAL AUTH PROVIDER VERIFICATION: NOT IMPLEMENTED
REAL MFA: NOT RUN

P3B_QA_AUTH_USERS_BASELINE_COUNT: 0
P3B_QA_LOCAL_SYNTHETIC_AUTH_FIXTURE_CREATED: PASS
P3B_QA_AUTH_ACTOR_SEPARATION_FIXTURE: PASS
P3B_QA_REAL_AUTH_USER_MUTATION_COUNT: 0
P3B_QA_PRODUCTION_AUTH_MUTATION: NO
P3B_QA_SYNTHETIC_AUTH_FIXTURE_FINAL_RESET: PASS
P3B_QA_AUTH_USERS_FINAL_COUNT: 0
```

The migration contains no `auth.users` DML and no Auth API call. Synthetic Auth
DML exists only in the guarded local DB QA runner. `finally` performs a full
local reset even on failure; the successful run independently confirmed final
Auth count 0 and no fixture/helper/root/event residue.

## Local QA results

The guarded runner requires `ICHESS_P3B_LOCAL_QA_ALLOW_RESET=YES`, accepts no
arguments, discovers only `npx --no-install supabase status -o json`, requires
loopback URLs and the exact `supabase_db_ichess-center-os` labeled container,
and rejects linked/remote context.

It passed:

- full local reset and forward migration apply;
- membership monotonic versioning and owner/admin/consultant/legacy-role,
  inactive, unassigned and foreign-center capability cases;
- missing/ACTIVE/SUSPENDED/DISABLED/REVOKED account control, stale control and
  security/session/assurance drift;
- fresh/stale/expired, wrong actor/Request/session, exact replay and single-use
  step-up behavior;
- deterministic action digest plus sensitivity to action version, kind, intent
  and independent legacy binding;
- post-APPROVED digest binding and independent legacy/canonical authority fields;
- exact issue replay and changed-intent conflict;
- real lock waits for membership, account security, center suspend, Assignment
  revoke and concurrent authority issuance;
- Audit/Outbox pairing and injected Audit/Outbox failure rollback;
- revoke/expire behavior and absence of authority/reservation consume;
- terminal revoke/expire idempotency bound to each authority's immutable
  environment across two distinct local environment fingerprints;
- authorized current owner/admin status reads plus non-disclosing
  `RESOURCE_NOT_AVAILABLE` for a former issuer and foreign nonmember;
- anon/authenticated/service-role RPC boundaries, internal helper denial and
  direct protected-table denial through SQL/PostgREST;
- absence of P3C target/binding/materializer and P3D executor/result runtime;
- final reset to zero synthetic Auth/business/security/idempotency/event rows and
  zero temporary helpers.

The canonical marker output ended with:

```text
P3B_QA_LOCAL_SAFETY_GUARD: PASS
P3B_QA_LOCAL_SQL_APPLY: PASS
P3B_QA_MEMBERSHIP_VERSIONING: PASS
P3B_QA_ACCOUNT_SECURITY_SYNC: PASS
P3B_QA_ACCOUNT_SECURITY_FAIL_CLOSED: PASS
P3B_QA_FRESH_STEP_UP: PASS
P3B_QA_STEP_UP_STALE_DENY: PASS
P3B_QA_STEP_UP_SINGLE_USE: PASS
P3B_QA_FINAL_CAPABILITY_OWNER: PASS
P3B_QA_FINAL_CAPABILITY_CENTER_ADMIN: PASS
P3B_QA_CONSULTANT_FINAL_DENY: PASS
P3B_QA_SEPARATION_OF_DUTIES: PASS
P3B_QA_FOREIGN_INACTIVE_DENY: PASS
P3B_QA_REVIEWED_ACTION_FIXTURE_ONLY: PASS
P3B_QA_DUAL_DIGEST_BINDING: PASS
P3B_QA_POST_APPROVED_AUTHORITY_DIGEST: PASS
P3B_QA_AUTHORITY_ISSUANCE: PASS
P3B_QA_AUTHORITY_EXACT_REPLAY: PASS
P3B_QA_AUTHORITY_IDEMPOTENCY_CONFLICT: PASS
P3B_QA_AUTHORITY_REVOKE: PASS
P3B_QA_AUTHORITY_EXPIRE: PASS
P3B_QA_TERMINAL_ENVIRONMENT_BINDING: PASS
P3B_QA_FORMER_ISSUER_STATUS_READ_DENIED: PASS
P3B_QA_FOREIGN_NONMEMBER_STATUS_NONDISCLOSURE: PASS
P3B_QA_AUTHORITY_CONSUME_ABSENT: PASS
P3B_QA_AUDIT_OUTBOX_ATOMIC: PASS
P3B_QA_FAULT_ROLLBACK: PASS
P3B_QA_DIRECT_API_FAIL_CLOSED: PASS
P3B_QA_REAL_LOCK_WAIT_OBSERVED: PASS
P3B_QA_CONCURRENT_AUTHORITY_ISSUANCE: PASS
P3B_QA_SECURITY_MEMBERSHIP_RACES: PASS
P3B_QA_NO_P3C_TARGET_RUNTIME: PASS
P3B_QA_NO_P3D_EXECUTOR: PASS
P3B_QA_FINAL_LOCAL_RESET: PASS
P3B_QA_LEFTOVER_FIXTURE_COUNT: 0
P3B_QA_NONDEFAULT_ROOT_COUNT: 0
P3B_QA_TEMP_HELPER_COUNT: 0
F23_3E_P3B_LOCAL_DB_QA: PASS
```

## Entry gate

P3B is ready for external technical audit and, if accepted, for the P3C
implementation request. Real conversion remains blocked on P3C canonical
Student/Guardian/source-target binding/relationship runtime and the P3D atomic
executor with authority/reservation consumption.

```text
P3B_EXTERNAL_TECHNICAL_AUDIT_ARTIFACT_COUNT: 4
P3B_EXTERNAL_TECHNICAL_AUDIT_REQUEST: READY
```
