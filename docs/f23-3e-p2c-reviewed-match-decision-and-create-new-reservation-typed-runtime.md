# F23.3E-P2C — Reviewed-Match Decision and Create-New Reservation Typed Runtime

## Status

```text
F23_3E_P2C_STATUS: IMPLEMENTED IN REPO
F23_3E_P2C_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P2C_MIGRATION_CREATED: YES
F23_3E_P2C_LOCAL_SQL_APPLY: PASS
F23_3E_P2C_LOCAL_DB_QA: PASS

F23_3E_P2C_REVIEW_TYPED_RUNTIME: IMPLEMENTED
F23_3E_P2C_RESERVATION_TYPED_RUNTIME: IMPLEMENTED
F23_3E_P2C_TRANSACTIONAL_AUDIT_OUTBOX: IMPLEMENTED

F23_3E_P2C_RESERVATION_CONSUME_RUNTIME: NOT IMPLEMENTED — P3
F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED

F23_3E_P2C_REMOTE_APPLY: NOT RUN
F23_3E_P2C_AUTH_CHANGE: NO
F23_3E_P2C_EDGE_FUNCTION_CHANGE: NO
F23_3E_P2C_DEPLOY: NOT RUN
F23_3E_P2C_BROWSER_UI_WIRING: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
```

Migration:

```text
supabase/migrations/202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql
SHA-256: 7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46
```

Baseline verified before implementation: clean `main` at
`c4df325d27d4eecd6787759a72d32e545d5e0caf`. All 13 inherited migrations
remain byte-identical. No remote, Auth, Edge Function, deploy, browser/UI,
real import, real data, or real conversion action was run.

## Repo-truth preflight

P2C composes only existing physical contracts:

- P2A supplies `crm_identity_match_review`,
  `crm_profile_creation_reservation`, `crm_identity_match_mutex`, and the
  versioned policy registry.
- P2B supplies the protected keyed-digest facility, versioned normalizers,
  exact-center Student adapter, sorted mutex material, and the internal masked
  search snapshot used for authoritative revalidation.
- P1 supplies the existing scoped `crm_idempotency_registry`, immutable
  `crm_audit_event`, and durable `crm_outbox_event`.
- Request/action binding uses the real current representation:
  `crm_conversion_request.action_graph_digest` plus a caller-selected opaque
  action UUID whose action-intent digest is recomputed by the server. No
  conversion-action aggregate was invented.

No Guardian/Student/Relationship business table, profile writer, relationship
runtime, approval aggregate, capability authority, or P3 executor was added.

## Eight protected operations

Exactly these service operations are exposed:

1. `f23_3e_p2c_create_match_review`
2. `f23_3e_p2c_decide_match_review`
3. `f23_3e_p2c_supersede_match_review`
4. `f23_3e_p2c_expire_match_review`
5. `f23_3e_p2c_reserve_create_target`
6. `f23_3e_p2c_cancel_creation_reservation`
7. `f23_3e_p2c_expire_creation_reservation`
8. `f23_3e_p2c_read_creation_reservation_status`

All eight are `SECURITY DEFINER`, use `search_path = ''`, revoke execution from
`PUBLIC`, `anon`, and `authenticated`, and grant execution only to
`service_role`. Every `f23_3e_p2c_internal_*` helper revokes direct execution
from `service_role` as well. P2A tables remain forced-RLS with no direct role
authority.

`p_actor_user_id` remains protected-service attribution. It is not an end-user
capability. Current interim eligibility is an active exact-center owner or
center admin, or the active consultant on the exact Request Assignment.

## Evidence, locks, and revalidation

```text
P2C_CALLER_SUPPLIED_SEARCH_RESULT_IS_AUTHORITY: NO
P2C_REVALIDATES_SEARCH_UNDER_MUTEX_LOCKS: YES
P2C_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO
P2C_ACTOR_ATTRIBUTION_GRANTS_END_USER_AUTHORITY: NO
```

Callers provide raw evidence only to the protected service and expected
versions/opaque selectors only for optimistic concurrency. They cannot supply
an outcome, reason, evidence digest, mutex digest, projection digest,
normalizer result, candidate count, or adapter-completeness proof.

For a new mutation, P2C derives center from Request, locks the CRM root, derives
the current protected evidence/mutex domains, deduplicates and byte-sorts the
mutex keys, locks Request/idempotency, invokes the protected P2B core, and then
locks target/review/reservation state in canonical order. P2B re-locks and
rechecks Contact, Case, Candidate, Assignment, and stable Student adapter rows.
Review/reservation binding digests are HMACs over stable P2B safe references
and source/policy/action versions; raw identity values are never persisted.

Exact idempotent replay is resolved after root, actor, mutex, and idempotency
locking but before mutable P2B source reinterpretation. Therefore a prior
success returns its stored safe snapshot even if later source state drifts.

## Review lifecycle and duplicate boundary

Creation writes only `PENDING`, version 1, with server expiry. P2A terminal
transitions remain exactly:

```text
PENDING -> EXACT_REVIEWED_MATCH | CREATE_NEW_REVIEWED | REJECTED_MATCH |
           CONFLICT | EXPIRED | SUPERSEDED
```

Every transition is `old version + 1`; terminal rows cannot reopen or be
rewritten. P2A requires pending reviewer fields to be null, so protected actor
attribution is recorded in the creation Audit event and terminal reviewer
attribution is written only on a decision.

Current P2B V1 produces `PROBABLE_MATCH`, `MATCH_REVIEW_REQUIRED`, and
`NAME_AND_BIRTH_EXACT_CANDIDATE` for same-name plus exact-birth Student
evidence. Its Student adapter is detection-only and emits
`reuse_eligible=false`. Consequently the P2C exact-reviewed branch exists but
fails closed with `MATCH_REVIEW_REQUIRED` until audited additional evidence and
target reuse authority exist. It never upgrades that strong signal to exact
reuse.

```text
P2C_STRONG_NAME_BIRTH_AUTO_REUSE: NO
P2C_STRONG_NAME_BIRTH_AUTO_CREATE: NO
P2C_STRONG_NAME_BIRTH_AUTO_RESERVE: NO
P2C_GUARDIAN_TARGET: MATCH_SEARCH_UNAVAILABLE
```

`CREATE_NEW_REVIEWED` succeeds only when a current locked P2B search is
complete, yields exactly `NO_MATCH`, has no unresolved candidate, satisfies
current policy/normalizer/source versions, and the pending review has the same
server-derived bindings. A browser statement that someone is “another person”
is not accepted as evidence or create authority.

```text
CREATE_NEW_REVIEWED_IS_PROFILE_CREATE_AUTHORITY: NO
```

## Reservation lifecycle

Only a current, unexpired `CREATE_NEW_REVIEWED`/`NO_MATCH` review can create an
`ACTIVE`, version-1 reservation. The opaque target UUID is generated inside the
first protected transaction. Exact replay returns the same reservation ID,
target ID, expiry, result, and correlation ID. P2A's unique target binding is a
non-rebindable integrity backstop.

P2C supports only:

```text
ACTIVE -> CANCELLED
ACTIVE -> EXPIRED
```

with server terminal time and `version + 1`. It exposes no consume RPC and does
not update a Request to approved/executing/completed.

```text
P2C_RESERVATION_CREATES_PROFILE: NO
P2C_RESERVATION_REUSES_PROFILE: NO
P2C_RESERVATION_APPROVES_CONVERSION: NO
P2C_RESERVATION_COMPLETES_REQUEST: NO
P2C_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO
```

The status read returns only opaque reservation/target IDs, status, version,
expiry, entity kind, and a safe current/stale code. It emits no Outbox event and
does not reveal cross-center existence.

## Scoped idempotency and atomic events

P2C extends the existing registry with a disjoint typed result-snapshot family;
the P1B result family remains valid and unchanged in meaning. Scope binds
environment, center, operation, Request, action, and a 32-byte opaque key
reference. The server HMAC intent binds all semantic IDs, expected versions,
review action, protected evidence digests, policy versions, and target selector.

- Same key and same intent returns the exact stored safe result with
  `replayed=true`; no second mutation, Audit, or Outbox row is written.
- Same key and different intent returns `IDEMPOTENCY_CONFLICT`; the prior row
  and result are not changed.

Every successful non-replay mutation writes exactly one Audit event and one
durable Outbox event with the same server correlation ID in the business
transaction. Review/reservation event versions equal aggregate versions and
partial unique indexes prevent duplicate aggregate-version events. Injected
Audit and Outbox failures rolled back the business row and idempotency snapshot.
Only flat safe codes and opaque IDs are serialized; no name, birth date,
contact value, normalized value, raw digest, mutex key, Student payload, or
Vault material is serialized.

## P2-R1–P2-R16 runtime classification

| Race | Classification | Local evidence / boundary |
|---|---|---|
| P2-R1 Guardian same evidence | DEPENDENCY-BLOCKED, FAIL CLOSED | Guardian adapter absent; `MATCH_SEARCH_UNAVAILABLE`, zero review/reservation. |
| P2-R2 Student same evidence | EXECUTED | Two real connections serialized on root/mutex; one pending review, loser `MATCH_REVIEW_CONFLICT`. |
| P2-R3 review vs source update | EXECUTED | Candidate source update held a row lock; reviewer waited and returned `SOURCE_VERSION_STALE`. |
| P2-R4 review vs target update | EXECUTED | Student adapter row update held a lock; stale target version returned `TARGET_VERSION_STALE`. |
| P2-R5 normalizer/policy rollout | EXECUTED | Root/version rollout wins; mutation recheck returns `MATCH_POLICY_STALE`. |
| P2-R6 two create reservations | EXECUTED | Two real connections; first uncommitted reservation held canonical locks, loser returned `RESERVATION_CONFLICT`; one row/target. |
| P2-R7 expiry vs future P3 use | DEPENDENCY-BLOCKED, FAIL CLOSED | P3 use does not exist; P2C server-time expiry executed and no consume surface exists. |
| P2-R8 Request cancel vs reservation | EXECUTED | P1B cancel committed while P2C reservation waited on root; reservation returned `SOURCE_VERSION_STALE`, no row. |
| P2-R9 same key/same intent | EXECUTED | Review, decision, and reservation replay returned the exact stored result without duplicate events. |
| P2-R10 same key/different intent | EXECUTED | `IDEMPOTENCY_CONFLICT`, no overwrite/event. |
| P2-R11 old review vs target change | EXECUTED | Protected target-version recheck failed closed. |
| P2-R12 shared phone/email | DEPENDENCY-BLOCKED, FAIL CLOSED | P2B V1 accepts neither as Student identity/reuse evidence; no P2C path exists. |
| P2-R13 Guardian create vs editor | DEPENDENCY-BLOCKED, FAIL CLOSED | Neither Guardian adapter nor profile editor exists. |
| P2-R14 Student create vs editor | DEPENDENCY-BLOCKED, FAIL CLOSED | Canonical Student writer is absent; detection-row target race was executed and no profile write occurred. |
| P2-R15 center suspend vs mutation | EXECUTED | Root first; post-suspend mutation returned `CRM_RUNTIME_NOT_ACTIVE`. |
| P2-R16 Assignment revoke vs review | EXECUTED | Exact Assignment/Case root was revoked consistently; consultant mutation returned `RESOURCE_NOT_AVAILABLE`. |

The real wait proofs queried `pg_stat_activity`, `pg_blocking_pids`, and
`wait_event_type='Lock'`; they did not infer concurrency from sleeps.

## P2-N1–P2-N24 negative classification

| Cases | Classification and proof |
|---|---|
| P2-N1–N4 | EXECUTED / inherited P2B proof: phone, email, name-only, and name+birth do not become automatic reuse; strong name+birth remained pending review and exact decision failed closed. |
| P2-N5–N7 | EXECUTED: direct NO_MATCH had no authority; only current complete reviewed NO_MATCH proceeded; insufficient evidence/search outage produced no row. |
| P2-N8 | EXECUTED: foreign actor/Request returned indistinguishable `RESOURCE_NOT_AVAILABLE`. |
| P2-N9–N12 | EXECUTED: stale review, target, normalizer, and policy paths returned typed stale/review-required outcomes. |
| P2-N13–N16 | EXECUTED by catalog/runtime inspection and lock tests: only protected fixed-size digests enter sorted mutex locking; unique constraints remain backstops; reservation follows P2B recheck. |
| P2-N17 | EXECUTED: every safe result says profile/create/approval/completion false; no writer exists. |
| P2-N18–N21 | EXECUTED: target/request bindings and terminal rows rejected mutation; expired reservation was terminalized by server time and could not be consumed. |
| P2-N22 | EXECUTED: same-key changed intent returned conflict and left prior result intact. |
| P2-N23 | EXECUTED: payload scan found no raw evidence/digest; injected event failures rolled back the transaction. |
| P2-N24 | EXECUTED: P2C exposes no completion operation and no fixture Request reached `APPROVED`, `EXECUTING`, or `COMPLETED`. |

## Local verification evidence

```text
P2C_QA_LOCAL_SAFETY_GUARD: PASS
P2C_QA_LOCAL_SQL_APPLY: PASS

P2C_QA_EIGHT_TYPED_RPCS: PASS
P2C_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS

P2C_QA_CREATE_PENDING_REVIEW: PASS
P2C_QA_EXACT_REVIEWED_MATCH: PASS
P2C_QA_CREATE_NEW_REVIEWED_FROM_COMPLETE_NO_MATCH: PASS
P2C_QA_STRONG_NAME_BIRTH_NOT_AUTO_AUTHORITY: PASS
P2C_QA_TERMINAL_REVIEW_IMMUTABLE: PASS
P2C_QA_REVIEW_VERSION_PLUS_ONE: PASS
P2C_QA_REVIEW_STALE_FAIL_CLOSED: PASS
P2C_QA_REVIEW_EXPIRY: PASS
P2C_QA_REVIEW_SUPERSESSION: PASS

P2C_QA_CREATE_ACTIVE_RESERVATION: PASS
P2C_QA_SERVER_PREALLOCATED_TARGET_STABLE: PASS
P2C_QA_RESERVATION_NOT_CREATE_AUTHORITY: PASS
P2C_QA_RESERVATION_CONSUME_UNAVAILABLE: PASS
P2C_QA_RESERVATION_CANCEL: PASS
P2C_QA_RESERVATION_EXPIRY: PASS
P2C_QA_RESERVATION_STALE_FAIL_CLOSED: PASS
P2C_QA_TARGET_NON_REBINDABLE: PASS

P2C_QA_IDEMPOTENCY_EXACT_REPLAY: PASS
P2C_QA_IDEMPOTENCY_CONFLICT: PASS

P2C_QA_AUDIT_OUTBOX_ATOMIC: PASS
P2C_QA_AUDIT_OUTBOX_REPLAY_NO_DUPLICATE: PASS
P2C_QA_AUDIT_OUTBOX_FAULT_ROLLBACK: PASS
P2C_QA_NO_PII_AUDIT_OUTBOX: PASS

P2C_QA_EXACT_CENTER_NON_DISCLOSURE: PASS
P2C_QA_MULTI_ACCOUNT_SCOPE: PASS

P2C_QA_CONCURRENCY_LOCK_WAIT: PASS
P2C_QA_RACE_MATRIX: PASS
P2C_QA_NEGATIVE_MATRIX: PASS
P2C_QA_FAULT_INJECTION: PASS

P2C_QA_FINAL_LOCAL_RESET: PASS
P2C_QA_LEFTOVER_FIXTURE_COUNT: 0
P2C_QA_NONDEFAULT_ROOT_COUNT: 0
P2C_QA_TEMP_HELPER_COUNT: 0
P2C_QA_VAULT_SECRET_COUNT: 0
```

The guarded runner requires `ICHESS_P2C_LOCAL_QA_ALLOW_RESET=YES`, discovers
the local project only via `npx --no-install supabase status -o json`, verifies
loopback endpoints and the exact local Docker project/container, performs a
clean reset/apply, runs lifecycle/security/fault/multi-connection checks, and
always performs a final clean reset in `finally`.

External technical audit: PASS. The independent review verified the eight
protected typed RPCs, service-role and direct-execute boundaries, server-side
revalidation and sorted locks, strong-duplicate and reservation non-authority
boundaries, scoped idempotency, transactional Audit/Outbox rollback behavior,
exact-center and multi-account fail-closed behavior, real PostgreSQL lock-wait
evidence, the P2-R/P2-N classifications, and the final clean local reset. No
additional hardening was requested.
