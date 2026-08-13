# F23.3E-P3D - Atomic Real-Conversion Executor and Integrated Backend QA

F23_3E_P3D_STATUS: IMPLEMENTED IN REPO

F23_3E_P3D_REMEDIATION_LOCAL_QA: PASS

F23_3E_P3D_REMEDIATION_STATUS: READY FOR EXTERNAL TECHNICAL RE-AUDIT

F23_3E_P3D_EXTERNAL_TECHNICAL_RE_AUDIT: BLOCKED - FINDINGS REMEDIATED; RE-AUDIT NOT RUN

F23_3E_P3D_MINIMAL_REMEDIATION_LOCAL_QA: PASS

P3D REMEDIATION IMPLEMENTED + LOCAL QA PASS — READY FOR EXTERNAL TECHNICAL RE-AUDIT

F23_3E_P3D_FINAL_TECHNICAL_AUDIT: NOT RUN

F23_3E_P3D_MIGRATION_CREATED: YES

F23_3E_P3D_LOCAL_SQL_APPLY: PASS

F23_3E_P3D_LOCAL_DB_QA: PASS

P3D_ATOMIC_REAL_CONVERSION_EXECUTOR: IMPLEMENTED

P3D_IMMUTABLE_RESULT_STATUS_RUNTIME: IMPLEMENTED

P3D_CANDIDATE_BIRTH_SOURCE_BRIDGE: IMPLEMENTED

P3D_CANDIDATE_BIRTH_SOURCE_RUNTIME: IMPLEMENTED

P3D_STUDENT_BIRTH_TARGET_REPROTECTION: IMPLEMENTED

P3D_AUTHORITY_CONSUME_RUNTIME: IMPLEMENTED

P3D_RESERVATION_CONSUME_RUNTIME: IMPLEMENTED

P3D_SOURCE_TARGET_BINDING_COMMIT_RUNTIME: IMPLEMENTED

P3D_REQUEST_FINAL_TRANSITIONS: IMPLEMENTED

P3D_CASE_FINAL_TRANSITION: IMPLEMENTED

P3D_CANDIDATE_FINAL_TRANSITION: IMPLEMENTED

P3D_ASSIGNMENT_FINAL_TRANSITION: IMPLEMENTED

P3D_ACTION_EXECUTED_TRANSITION: IMPLEMENTED

P3D_REAL_CONVERSION_RESULT_STATUS: IMPLEMENTED

P3D_EXACT_REPLAY_RUNTIME: IMPLEMENTED

P3D_FAULT_ROLLBACK_QA: PASS

P3D_REAL_LOCK_WAIT_QA: PASS

P3D_P3B_P3C_INTEGRATION_QA: PASS

P3D_EXACT_REPLAY_BEFORE_LIVE_TERMINAL_RECHECK: YES

P3D_EXACT_REPLAY_REHASHES_EXECUTED_ACTIONS: NO

P3D_NEW_BUSINESS_TABLE_COUNT: 0

P3D_EXTERNAL_SERVICE_RPC_COUNT: 2

P3D_PRODUCT_CANDIDATE_INGRESS: DEFERRED

P3D_PRODUCT_CANDIDATE_BIRTH_INGESTION: DEFERRED

P3D_BACKEND_LOCAL_READY_FOR_P4: NO - EXTERNAL TECHNICAL RE-AUDIT REQUIRED

P3D_PRODUCT_END_TO_END_READY: NO - P4 REQUIRED

F23_3E_P3D_REMOTE_APPLY: NOT RUN

F23_3E_P3D_AUTH_PRODUCTION_CHANGE: NO

F23_3E_P3D_EDGE_FUNCTION_CHANGE: NO

F23_3E_P3D_DEPLOY: NOT RUN

F23_3E_P3D_UI_OR_IMPORT_CHANGE: NO

## Checkpoint, ownership and result

P3D resumes from clean `main` checkpoint
`6879df4c5904db1b427eb974eaa099724f3f6a28`. P3B and P3C are final-audit and
closeout PASS. P3D0 is the final-audited normative addendum for Candidate to
Student birth evidence; its blocker is closed and its crypto contract is not
reopened here.

P3D owns exactly four artifacts:

1. `supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql`
2. `docs/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa.md`
3. `tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-smoke.js`
4. `tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-local-db-qa.js`

```text
P3D_FORWARD_MIGRATION_COUNT: 1
P3D_NEW_BUSINESS_TABLE_COUNT: 0
P3D_EXTERNAL_SERVICE_RPC_COUNT: 2
P3D_CHECKPOINT_MIGRATION_HASH_COUNT: 16
P3D_MIGRATION_SHA256: f3fb385fa3564e05656c6093c86f14492893f3b3b57777286a1ce11728979cc3
SHA-256: f3fb385fa3564e05656c6093c86f14492893f3b3b57777286a1ce11728979cc3
```

The semantic smoke locks all 16 inherited checkpoint SHA-256 values and the
exact P3D migration SHA without freezing total migration inventory. This phase
does not update roadmap state and does not commit or push.

## Physical inventory and bounded forward replacements

No new canonical Student/Guardian/Relationship business aggregate is created.
R0 adds one protected authorization/control aggregate,
`crm_reviewed_cross_source_reuse_authorization`, because a historical A-to-T
binding cannot authorize a different Source B. The implementation otherwise composes the existing
P1/P2/P3 records:

- `crm_conversion_request`, `consultation_case`, Candidate and Assignment;
- P2 reviews, identity mutexes and creation reservations;
- P3B account security, consumed step-up, typed actions, authority and the P3
  idempotency/result family;
- P3C Student, Guardian, source-target binding and Guardian-Student
  relationship aggregates.

The single migration forward-replaces only guards or validators needed by the
executor:

- Request `APPROVED -> EXECUTING -> COMPLETED` with exact `+1` edges;
- Case `READY_FOR_CONVERSION/REVIEW_PENDING -> CONVERTED/COMPLETED`;
- applicable Candidate `ACTIVE|REVIEW_REQUIRED -> CONVERTED`;
- action `APPROVED -> EXECUTED` and authority `ISSUED -> CONSUMED`;
- used create reservation `ACTIVE -> CONSUMED` only under the P3D executor;
- the strict P3 result-snapshot validator for `REAL_CONVERSION` and versioned
  P3 action-set/result bindings;
- the P3C Student writer body, preserving its exact four-argument signature
  and all P3C business checks while replacing ciphertext copy with protected
  source unwrap and target-context re-protection.

R0 also forward-extends P2B/P2C/P3C/P3B bodies in this single uncommitted P3D
migration: a deterministic historical supporting binding may be presented as
masked candidate evidence, terminal human review captures immutable reviewer
provenance, P3C issues request/source/target-scoped reuse authorization, P3B
binds V2 digests, and P3D consumes authorization only with atomic B-to-T
binding creation. Checkpoint migrations remain byte-for-byte unchanged. Contact lifecycle is
unchanged. There is no compensation saga, generic cloud Student writer, silent
merge, Request/Case completion outside the executor, or P4 runtime.

## Exact external surface

Exactly these two `SECURITY DEFINER`, `search_path=''` functions are executable
by `service_role`:

```text
f23_3e_p3d_execute_conversion(
  conversion_request_id uuid,
  conversion_authority_id uuid,
  expected_request_version integer,
  expected_authority_version integer,
  environment_fingerprint bytea,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
)

f23_3e_p3d_read_conversion_result_status(
  conversion_request_id uuid,
  idempotency_key_digest bytea
)
```

The execute input has no actor, center, role, birth date, action list, target
choice, policy version, crypto environment or step-up truth. Those facts are
derived server-side. All `f23_3e_p3d_internal_%` functions are revoked from
`PUBLIC`, `anon`, `authenticated` and `service_role`. The four P3C tables retain
forced RLS, zero policies, no direct application grants and no Realtime
publication.

## Immutable replay and result

The first selector checks the `(Request, operation, idempotency-key)` result
registry. An exact `COMPLETED/REAL_CONVERSION` binding returns its immutable
snapshot before Stage A or any live Request/action/authority check. Therefore
natural terminal state does not make replay fail, and replay never computes a
digest from `EXECUTED` actions.

A first attempt binds the opaque authority environment, caller operation
intent, expected Request/authority versions, Request, authority and key. It
locks the registry again after the earlier lock tiers to serialize concurrent
first attempts. A different environment, intent, authority or expected version
is `IDEMPOTENCY_CONFLICT`.

The strict snapshot contains exactly safe IDs, versions, statuses, one
correlation ID and three action results. Each action kind maps to one exact
finite outcome. No name, birth, contact, ciphertext, digest key, mutex key,
Vault material or arbitrary payload is accepted. Result status reads only this
immutable completed snapshot and never reconstructs success from mutable
business rows.

## P3D0 birth-evidence bridge

The existing Candidate `birth_evidence_protected bytea` remains unchanged. The
bridge implements the final-audited P3D0 contract:

| Domain | Magic | Vault key | KDF context | AAD object binding |
|---|---|---:|---|---|
| Candidate source | `IC3CBE01` | `1` | `iC3Bth01` | crypto environment, center, Case, Candidate |
| Student target | `IC3SBE01` | `1` | `iC3Std01` | crypto environment, center, Student |

Both use envelope/payload version `1`, epoch `1`, a 16-byte Vault nonce and the
P3C `U8/U16/U32/LP32` framing helpers. Plaintext is accepted only as exactly 10
ASCII UTF-8 bytes in canonical `YYYY-MM-DD` form with strict calendar parsing
and byte-for-byte roundtrip. Legacy bytes, raw UTF-8, unknown magic/version/
epoch, malformed lengths, wrong object AAD, tampering or wrong KDF fail closed.

Stage A is a protected, read-only purpose precheck. Before unwrap it proves the
exact Request and ISSUED authority, expected versions, authority environment,
purpose `crm.real_conversion.execute`, current active account and exact-center
owner/admin membership, the authority-consumed single-use step-up and the
approved Student action/source. It holds only a local SQL date and source
envelope digest.

Stage B derives the existing P2 Student name/birth mutexes, acquires canonical
locks and rechecks every Stage A fact plus the exact Candidate bytes/version.
For create, the date is freshly sealed as `IC3SBE01` for the preallocated
Student ID. Candidate ciphertext is never copied into Student and plaintext is
never returned, persisted, logged or placed in Audit/Outbox/result.

The environment domains remain independent:

```text
authority_environment_fingerprint = P1/P3B caller-supplied authority binding
identity_environment_fingerprint = P2B identity-policy derivation
crypto_environment_fingerprint = P3C server-root-derived iC3Env01 domain
P3D_NEW_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT: 0
P3D_CROSS_DOMAIN_FINGERPRINT_EQUALITY_REQUIRED: NO
```

Product Candidate ingestion of canonical `IC3CBE01` remains `DEFERRED`. Local
QA uses only the protected internal synthetic sealing helper and resets it.

## Canonical lock and recheck order

First execution uses this ordering:

```text
CENTER_CRM_CONTROL_ROW
-> COMPLETE_DEDUPED_IDENTITY_MUTEX_ROWS
   (GUARDIAN rank 1, STUDENT rank 2, PostgreSQL bytea ASC; exactly one pass)
-> ACCOUNT_SECURITY_CONTROL_ROW
-> CONSUMED_STEP_UP_ASSERTION_ROW
-> MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS
-> CONVERSION_AUTHORITY_ROW
-> IDEMPOTENCY_REGISTRY_ROW
-> CONVERSION_REQUEST_ROW
-> CONVERSION_ACTION_ROWS_SORTED_ID
-> CRM_CONTACT_ROW
-> CONSULTATION_CASE_ROW
-> CANDIDATE_STUDENT_ROWS_SORTED_ID
-> ASSIGNMENT_ROW
-> EXISTING_TARGET_PROFILE_AND_BINDING_ROWS
-> MATCH_REVIEW_ROWS
-> PROFILE_CREATION_RESERVATION_ROWS
-> GUARDIAN_STUDENT_RELATIONSHIP_ROWS
-> AUDIT_ROWS
-> OUTBOX_ROWS
-> COMMIT
```

The authoritative recheck covers root feature state; account lifecycle and
security/session/assurance versions; exact-center membership, role and version;
consumed step-up binding; authority purpose/status/expiry and environment;
Request status/version, independent legacy digest and intent; Contact, Case,
Candidate and Assignment; current policy versions; exactly three approved typed
actions; review/reservation/target/binding/relationship currentness; and the
P3B authority binding sets.

Before any business mutation the executor recomputes the canonical action-set
digest from persisted `APPROVED` rows and compares it with
`authority.p3_action_set_digest`. The opaque legacy Request
`action_graph_digest` is checked only against its own authority legacy binding;
it is never equated with the canonical P3 digest.

The executor derives the complete Guardian plus Student mutex union before
locking, deduplicates by `(identity_kind_rank, key)` and acquires the identity
tier once. The six target/binding/relationship cores are explicit
`*_no_relock` functions: they require the caller-held set digest and contain no
root, advisory or identity-mutex lock. A local-postgres-only dormant barrier,
immediately after the real center root lock, lets QA prove that two full
same-center executors serialize at tier 0 with real `pg_locks`,
`pg_stat_activity` and `pg_blocking_pids` evidence.

## Atomic composition and terminalization

One PostgreSQL transaction performs:

1. Request `APPROVED -> EXECUTING`, version `+1`;
2. Student create/reuse/no-target and Guardian create/reuse/no-target;
3. relationship create/reuse/update/no-target as the approved plan requires;
4. first ACTIVE source-target binding inserts for create actions, or current
   ACTIVE exact-source binding verification for legacy reuse; cross-source
   reuse creates a distinct B-to-T binding referencing B's consumed reviewed
   reuse authorization. Historical A-to-T provenance remains unchanged;
5. consumption of only the ACTIVE create reservations, after composition;
6. applicable Candidate conversion, Assignment `ENDED/CASE_CONVERTED` and Case
   `CONVERTED/COMPLETED` with pointer clear;
7. all three actions `APPROVED -> EXECUTED`, version `+1`;
8. Request `EXECUTING -> COMPLETED`, version `+1`, with terminal result digest;
9. authority `ISSUED -> CONSUMED`, version `+1`, bound to the result registry;
10. finite matching Audit/Outbox events and immutable result completion.

Any error is caught by the protected external wrapper only after PostgreSQL has
rolled back the function subtransaction. Consequently no failed call can leave
`EXECUTING`, a partial target/binding/relationship, consumed reservation,
terminal source state, Audit, Outbox or result.

Successful events are limited to the frozen vocabulary:

```text
crm.student.created_from_conversion
crm.student.reused_for_conversion
crm.guardian.created_from_conversion
crm.guardian.reused_for_conversion
crm.guardian_student_relationship.created
crm.guardian_student_relationship.reused
crm.guardian_student_relationship.updated
crm.candidate.converted
crm.assignment.ended
crm.case.converted
crm.conversion.authority_consumed
crm.conversion.completed
```

No event is emitted for a no-target action that did not occur. Every applicable
event has one Audit and one matching Outbox with the common correlation ID.

## Minimal remediation after external technical re-audit BLOCKED

The independent re-audit preserved both R0 architecture closures but found
five implementation defects. This in-place, still-uncommitted P3D migration
now closes only those findings:

- every P2B/P2C/P3B/P3C function recreated after a checkpoint rename has an
  exact signature-qualified ACL: internal functions deny `PUBLIC`, `anon`,
  `authenticated` and `service_role`; protected inherited service RPCs deny
  `PUBLIC`/application roles and grant only `service_role`;
- the existing P2C expire/supersede signatures now retain their PENDING-review
  checkpoint behavior and add the final-R0 terminal-review pre-authority path.
  It leaves the terminal review immutable, invalidates all `ISSUED v1` reuse
  authorizations, supersedes the one three-action plan and Request, terminalizes
  active reservations, records one immutable P2C result and requires a fresh
  Request. No old Request, action, review or authority is resurrected;
- exact P3C materialize/finalize replay returns its completed idempotency
  snapshot before reading live action rows, so later `APPROVED` or `EXECUTED`
  lifecycle state cannot change the originally committed digest/result;
- `crm_idempotency_registry_p3d_result_lookup_uidx` now predicates on the
  physical runtime operation `crm.real_conversion.execute`, and QA proves both
  duplicate rejection and insertion of a distinct legitimate key;
- the guarded runner now proves effective catalog privileges, actual anon
  PostgREST denial, pre-issue invalidation plus fresh recovery, both immutable
  P3C post-lifecycle replays and the corrected result lookup uniqueness.

The prior external re-audit result remains historical `BLOCKED`; no subsequent
external technical re-audit is claimed by this implementation report.

## Local Docker QA evidence

The guarded runner requires `ICHESS_P3D_LOCAL_QA_ALLOW_RESET=YES`, rejects
linked/remote context, parses local Supabase status without fallback, verifies
loopback URLs and discovers only the exact labeled local Docker database. It
never starts, links, pushes, repairs or contacts a remote project.

The final full run passed:

| Gate | Evidence |
|---|---|
| Apply/catalog | clean reset applies P3D; no new business table; exactly two external RPCs |
| Crypto | canonical source seal/unwrap, strict P3D0 framing, legacy/raw fail closed, target re-protect and direct-copy inequality |
| Happy paths | create/create/create, reuse/reuse/reuse and all explicit no-target actions execute successfully |
| Genuine cross-source reuse | completed Request A creates Student/Guardian/relationship and A bindings; independent Source/Request B uses new P2 reviews, two scoped authorizations, V2 plan/authority and creates distinct B bindings while reusing the same targets |
| Invalidation/recovery | pre-issue P2C supersede and post-issue P3B revoke each atomically produce `INVALIDATED v2`, three `SUPERSEDED` actions and a `SUPERSEDED` old Request; independent fresh Requests succeed without resurrection |
| Digest/substitution | authorization ID/version/set, relationship-scope and V2-to-V1 substitutions fail closed before mutation |
| P2/P3 | P2B/P2C review/reservation, P3C materialize/finalize and P3B authority issuance execute on one fresh database |
| Replay/status | P3C materialize/finalize and P3D execute exact replays survive later terminal live state, emit no second event, never rehash EXECUTED rows and status reads only immutable result |
| Drift | authority, account, membership, consumed step-up, Request, policy, Contact, Case, Candidate, Assignment, review, reservation and action drift fail closed |
| Faults | target, relationship, binding, Audit, Outbox and idempotency-completion trigger faults preserve the exact state vector |
| Concurrency | seven independent contender sessions exhibit real PostgreSQL lock waits; an additional two-full-executor run uses a deterministic post-root barrier and proves the second executor blocked on the first center root, then both complete without deadlock/partial state |
| Privacy/security | forced RLS/no direct grants/no Realtime, exact effective ACL inventory, actual anon PostgREST denial for every recreated surface, service-role RPC boundary and no protected evidence in Audit/Outbox/result |
| Cleanup | final reset proves Auth, Vault, all P3C aggregates, P3D idempotency and temporary QA objects at baseline zero |

```text
P3D_LOCAL_DOCKER_QA_RESULT: PASS
P3D_GENUINE_REQUEST_A_TO_REQUEST_B_RESULT: PASS
P3D_REUSE_AUTHORIZATION_PROVENANCE_RESULT: PASS
P3D_INVALIDATION_FRESH_REQUEST_RECOVERY_RESULT: PASS
P3D_PREISSUE_INVALIDATION_FRESH_REQUEST_RECOVERY_RESULT: PASS
P3D_PREISSUE_INVALIDATION_FAULT_ROLLBACK_RESULT: PASS
P3D_P3C_MATERIALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY_RESULT: PASS
P3D_P3C_FINALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY_RESULT: PASS
P3D_RECREATED_FUNCTION_EFFECTIVE_GRANTS_RESULT: PASS
P3D_RECREATED_FUNCTION_ANON_POSTGREST_RESULT: PASS
P3D_REAL_CONVERSION_RESULT_LOOKUP_UNIQUENESS_RESULT: PASS
P3D_V1_V2_AND_SUBSTITUTION_NEGATIVE_RESULT: PASS
P3D_SIX_NO_RELOCK_CORES_RESULT: PASS
P3D_MIXED_KIND_ONE_PASS_MUTEX_ORDER_RESULT: PASS
P3D_TWO_FULL_EXECUTOR_ROOT_WAIT_RESULT: PASS
P3D_CREATE_REUSE_NO_TARGET_MATRIX_RESULT: PASS
P3D_FAULT_ROLLBACK_MATRIX_RESULT: PASS
P3D_REAL_LOCK_WAIT_RESULT: PASS (7 observed waits)
P3D_FINAL_RESET_RESULT: PASS
P3D_SEMANTIC_SMOKE_RESULT: PASS
P3D_INHERITED_SEMANTIC_REGRESSIONS_RESULT: PASS (10/10)
P3D_NODE_CHECK_RESULT: PASS (2/2)
P3D_16_INHERITED_HASHES_RESULT: PASS (16/16)
P3D_EXACT_MIGRATION_SHA_RESULT: PASS (f3fb385fa3564e05656c6093c86f14492893f3b3b57777286a1ce11728979cc3)
P3D_GIT_DIFF_CHECK_RESULT: PASS
P3D_HYGIENE_RESULT: PASS
```

## Scope boundary and audit handoff

P3D changes no roadmap, `src/`, product Auth, Edge Function, remote Supabase,
deployment, UI, import or P4 behavior. Synthetic Auth and Vault material exists
only inside guarded local QA and final reset proves baseline zero.

External final technical audit has not run. The package to send is exactly:

1. `supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql`
2. `docs/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa.md`
3. `tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-smoke.js`
4. `tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-local-db-qa.js`
