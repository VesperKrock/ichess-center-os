# F23.3E-P3D External Technical Re-Audit After Remediation

## 1. Verdict

```text
F23.3E-P3D EXTERNAL TECHNICAL RE-AUDIT: BLOCKED

P3D TECHNICAL ACCEPTANCE: BLOCKED
P3D DONE: NO
P4 STARTED: NO

NEXT GATE: MINIMAL P3D IMPLEMENTATION REMEDIATION
```

The genuine cross-source Request-A to Request-B path and the remediated lock
architecture pass this audit. The package nevertheless cannot pass because the
forward replacements reopen protected P2/P3 functions to `PUBLIC`, `anon` and
`authenticated`, the final-audited pre-issue invalidation path is absent, and
two P3C exact-replay wrappers reinterpret mutable action lifecycle state.

No implementation, migration, runtime test, prior design/audit artifact, or
roadmap file was changed during this audit. This report is the only artifact
created.

## 2. Preflight and audited identity

```text
repository: VesperKrock/ichess-center-os
branch: main
HEAD: 6879df4c5904db1b427eb974eaa099724f3f6a28
origin/main: 6879df4c5904db1b427eb974eaa099724f3f6a28
tracked modifications before audit: 0
staged files before audit: 0
pre-audit untracked artifacts: 8/8 expected
P3D migration SHA-256:
16BF495282AF762FDFCDB40FA75E7CDE1A2CAB11D9F32F3821B954CE9B38F288
inherited migration hashes: 16/16 PASS
remote apply: NOT RUN
```

The audited migration bytes match the supplied remediated identity. The old
blocked hash was not used as acceptance truth.

## 3. Findings

### CRITICAL-1 — forward-recreated protected functions are publicly executable

**Status: BLOCKING.**

The checkpoint migrations explicitly revoked the internal functions from all
application roles and exposed the P3B/P3C service RPCs only to `service_role`.
The P3D migration renames those function objects and creates new objects under
the original names. PostgreSQL gives a newly created function `EXECUTE` to
`PUBLIC` unless it is explicitly revoked. The migration's final revoke loop
only covers names matching `f23_3e_p3d_internal_%`; it does not cover the newly
created P2B/P3B/P3C functions.

Catalog inspection after a clean reset/apply proved these effective privileges:

| Function | SECURITY DEFINER | PUBLIC | anon | authenticated | service_role |
|---|---:|---:|---:|---:|---:|
| `f23_3e_p2b_internal_search_masked_candidates(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3c_internal_resolve_reusable_student(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3c_internal_resolve_reusable_guardian(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3c_materialize_reviewed_action_pair(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3c_finalize_reviewed_action_plan(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3b_issue_conversion_authority(...)` | yes | yes | yes | yes | yes |
| `f23_3e_p3b_internal_is_safe_result_snapshot(jsonb)` | no | yes | yes | yes | yes |

The renamed checkpoint functions are correctly revoked, which isolates the
defect to the replacement objects. This is not merely a catalog anomaly:
loopback PostgREST calls authenticated only with the local anon key returned
HTTP 200 for all of these sampled functions:

```text
f23_3e_p3c_finalize_reviewed_action_plan -> HTTP 200 / INVALID_INPUT result
f23_3e_p3c_internal_resolve_reusable_student -> HTTP 200 / result row
f23_3e_p2b_internal_search_masked_candidates -> HTTP 200 / safe-result object
f23_3e_p3b_issue_conversion_authority -> HTTP 200 / INVALID_INPUT result
```

The P2B internal function is especially load-bearing: unlike its protected
external wrapper, it carries the server-only cross-source `reuse_eligible`
signal before the scrub step. The P3C plan RPCs and P3B authority RPC accept an
actor UUID as a trusted server-orchestration input and must never be callable
by anon/authenticated clients. Current database checks may reject the invalid
audit selectors, but they do not restore the missing caller boundary or make
the functions safe public APIs.

Minimal remediation:

1. In the still-uncommitted P3D migration, explicitly revoke every newly
   created internal function from `PUBLIC`, `anon`, `authenticated`, and
   `service_role`.
2. Explicitly revoke the forward-recreated P3B/P3C service RPCs from `PUBLIC`,
   `anon`, and `authenticated`, then grant only their exact signatures to
   `service_role`.
3. Add catalog and loopback PostgREST tests for every forward-recreated
   function, not only `f23_3e_p3d_internal_%` and the two P3D RPCs.

### HIGH-1 — final-audited pre-issue invalidation/recovery is not implemented

**Status: BLOCKING.**

The accepted R0 lifecycle requires protected recovery both before and after
P3B authority issuance. After materialization or finalization, an expired or
stale cross-source authorization must terminalize the single plan and Request,
then force a fresh Request; terminal review/plan state must not be resurrected.

Physical migration and catalog evidence shows:

```text
P2C expire wrapper calls invalidator: false
P2C supersede wrapper calls invalidator: false
P2C core contains the frozen fresh-Request outcome: false
P2C core still requires review_status = PENDING: true
catalog callers of f23_3e_p3d_internal_invalidate_single_plan_request: 1
sole caller: f23_3e_p3b_revoke_or_expire_conversion_authority
```

Therefore post-issue recovery exists and passed, but a V2 plan whose
authorization becomes stale/expired before P3B issuance is stranded: finalize
or issuance fails closed, while the inherited P2C expire/supersede functions
reject the already terminal `EXACT_REVIEWED_MATCH v2` review and cannot
invalidate the plan. This contradicts the final-audited single-plan recovery
contract.

The QA marker `P3D_QA_AUTHORIZATION_INVALIDATION_FRESH_REQUEST_RECOVERY: PASS`
tests only the post-issue P3B revoke flow. It contains no call to
`f23_3e_p2c_expire_match_review` or
`f23_3e_p2c_supersede_match_review` for a materialized/finalized V2 plan.

Minimal remediation: implement the exact terminal-review pre-issue branches
frozen by R0 through a P3D-era forward replacement, with canonical locks,
strict idempotency snapshot, finite
`CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED` outcome, exact
action/authorization/reservation/Request terminal counts, Audit+Outbox, and
fresh-Request QA both after materialize and after finalize.

### HIGH-2 — P3C materialize/finalize exact replay rehashes live actions

**Status: BLOCKING.**

The checkpoint implementation is called first and can return an immutable
completed idempotency result. The new wrappers then discard the persisted V2
digest on replay and recompute from current action rows:

- materialize replay reads `v_student_action.status` and calls
  `f23_3e_p3d_internal_action_set_digest_v2(request, live_status)`;
- finalize replay calls
  `f23_3e_p3d_internal_action_set_digest_v2(request, 'REVIEWED')`.

Action V2 includes `action_version`. Natural progression changes PROPOSED-v1
to REVIEWED-v2, APPROVED-v3, and EXECUTED-v4. Consequently:

- materialize replay after finalize/approval/execution returns a digest for
  the later live lifecycle while retaining the original materialization
  `action_versions` result;
- finalize replay after approval/execution hashes an empty REVIEWED action set
  instead of returning the committed REVIEWED-v2 result.

This violates immutable exact replay and produces internally inconsistent
replay output. P3D executor replay itself is correctly snapshot-first and
passed, but that does not repair inherited P3C service RPC replay semantics
that this migration forward-replaced.

The local QA never replays P3C materialize/finalize after lifecycle advance,
so its PASS does not exercise this branch.

Minimal remediation: exact completed replay must return the immutable stored
V2 result before reading live actions or invoking any action serializer. The
strict materialization/finalization snapshots must contain the frozen V2
encoding/digest and authorization references required by the final design.
Add replay tests after finalize, after P3B approval, and after P3D execution;
assert byte-identical results and zero live rehash/mutation/event/version
effects.

### MEDIUM-1 — security/recovery/replay smoke and QA permit false PASS

The runner checks effective privileges only for functions named
`f23_3e_p3d_internal_%` and tests anon denial only for the P3D execute RPC. It
does not inspect the P2B/P3B/P3C functions recreated by P3D. The smoke likewise
asserts the P3D internal revoke loop but has no exact effective-grant contract
for those forward replacements.

Recovery coverage is post-issue only, and P3C post-lifecycle exact replay is
absent. These omissions explain why the full runner and semantic smoke report
PASS despite the three blocking findings above.

### MEDIUM-2 — P3D immutable-result uniqueness index uses the wrong operation

The migration creates
`crm_idempotency_registry_p3d_result_lookup_uidx` with predicate:

```sql
where operation = 'conversion.execute'
```

Every executor and status query uses:

```text
crm.real_conversion.execute
```

The advertised operation-specific uniqueness therefore protects zero real
P3D result rows. The inherited broader unique constraint includes the
environment fingerprint, while the frozen result-status signature omits it,
so the typo should be corrected and independently tested rather than treated
as harmless documentation drift.

## 4. Original blocker re-audit

### Blocker 1 — genuine independent Request A to Request B reuse

**Result: PASS.**

The full guarded run used independent Contact, Case, Candidate, Request,
reviews, V2 actions, step-up, authority, idempotency and event/result
identities for B. The happy path did not use
`session_replication_role='replica'`, resurrect A, or pre-create a B binding.

After A created the canonical Student, Guardian, relationship and A bindings:

- P2B returned masked cross-source review candidates;
- P2C recorded explicit reviewed reuse;
- P3C issued two B/Request-B/target-scoped authorizations;
- P3B issued a fresh B conversion authority;
- P3D reused the existing targets/relationship and atomically inserted two
  distinct B-provenance bindings;
- A remained `COMPLETED:5`, B independently became `COMPLETED:5`, target and
  relationship counts stayed one, and A/B completion correlations differed;
- B exact replay returned the immutable P3D result without a second mutation.

```text
REQUEST A -> REQUEST B PRODUCTION-REACHABLE: YES
SEMANTIC TERMINAL-STATE FABRICATION IN HAPPY PATH: NO
BINDING A USED AS B AUTHORITY: NO
BINDING B CREATED ONLY IN B CONVERSION TRANSACTION: YES
```

The reviewed authorization is distinct from both A and B canonical bindings.
The CRITICAL caller-surface finding must still be fixed before this path is
acceptable for production exposure.

### Reviewer provenance

**Physical implementation: PASS. QA depth: incomplete.**

The `aaa_f23_3e_p3d_prepare_review_r0` trigger fills membership/role/optional
assignment provenance only on the terminal transition, using the terminal
`reviewer_user_id`; the subsequent guard makes those fields immutable. The
authorization copies that terminal reviewer and decision time.

The genuine A/B QA uses the owner for both PENDING creation and terminal
decision, so it does not independently prove creator/decider separation. The
physical path is correct, but remediation QA should use distinct authorized
actors as required by the final design.

### Authorization lifecycle and recovery

```text
ISSUED v1 -> CONSUMED v2: PASS
ISSUED v1 -> INVALIDATED v2 post-issue: PASS
post-issue fresh Request recovery: PASS
pre-issue invalidation/recovery: BLOCKED
overall lifecycle/recovery: BLOCKED
```

### Student, Guardian and relationship

The create, reviewed cross-source reuse and explicit no-target families passed
for Student and Guardian. Canonical target counts did not increase on reuse.
Guardian reuse carried a separate authorization whose relationship-scope
digest bound the paired Student and relationship decision. Relationship count
and endpoint provenance remained stable. Substitution attempts failed before
business mutation.

```text
STUDENT: PASS
GUARDIAN: PASS
RELATIONSHIP: PASS
```

## 5. Original blocker 2 — lock architecture

**Result: PASS.**

Physical executor order is:

```text
center_crm_control FOR UPDATE
-> union/dedupe complete Guardian + Student resource tuples
-> GUARDIAN rank 1, STUDENT rank 2, bytea ASC
-> exactly one crm_identity_match_mutex FOR UPDATE pass
-> later canonical tiers
```

There is no Student subset pre-lock. Stage B rederives and compares the set
digest without reading or locking the mutex table.

All six required `*_no_relock` cores exist with the final-audited signatures.
Physical body and transitive-leaf inspection found no center-root, advisory,
identity-mutex, `FOR UPDATE`, or `FOR SHARE` acquisition in their composition
graph. The sole product caller is the P3D executor.

The rerun retained seven real PostgreSQL lock waits. The two-full-executor test
used controller/X/Y sessions and a postgres-only temporary post-root barrier.
The controller observed X's advisory wait before launching Y, then observed Y
blocked by X through `pg_stat_activity`, `pg_locks`, and
`pg_blocking_pids`. Both completed after barrier release without deadlock or
partial state.

```text
COMPLETE MIXED-KIND ONE-PASS SET: PASS
CANONICAL ORDER: GUARDIAN=1 -> STUDENT=2 -> PostgreSQL bytea ASC
SIX NO-RELOCK CORES: PASS
LATE IDENTITY RELOCK: NO
CENTER-ROOT SERIALIZATION: PASS
REAL TWO-SESSION ROOT WAIT: PASS
```

## 6. Other technical gates

| Gate | Result | Independent audit note |
|---|---|---|
| V1/V2 first-execution dispatch | PASS | V1 preserved; V2 persisted and recomputed before mutation; unknown/mixed version fails closed. |
| Reuse-authorization-set digest | PASS | Exact v1 domain, binary framing, kind rank and UUID-byte order are implemented. |
| Relationship-scope digest | PASS | Exact v1 domain binds Request/actions/endpoints/reviews/roles/policy/reason. |
| Substitution/downgrade | PASS for first execution | Authorization ID/version, relationship scope, set digest and V2-to-V1 mutations failed with unchanged state. |
| Atomic executor rollback | PASS | Target, relationship, binding, Audit, Outbox and idempotency-completion fault injections restored the state vector. |
| Abandoned `EXECUTING` | NONE observed | Fault paths rolled back the Request transition. |
| P3D executor exact replay | PASS | Immutable result is selected before live terminal state and no EXECUTED rehash occurs. |
| Broader P3C exact replay | BLOCKED | HIGH-2. |
| P3D0 crypto | PASS | Candidate `IC3CBE01/iC3Bth01`, Student `IC3SBE01/iC3Std01`, strict date and re-protection passed. |
| Environment domains | PASS | Authority, identity and crypto fingerprints remain independent. |
| Audit/Outbox atomicity | PASS | Representative event failures rolled back full conversion. |
| Audit/Outbox/result privacy | PASS for P3D data | No tested birth/name/envelope marker appeared in event or result records. |
| RLS/table/Realtime | PASS | Protected target/authorization tables retain forced RLS, no policies/direct app grants and no Realtime exposure. |
| Function/RPC surface | BLOCKED | CRITICAL-1. |

## 7. Re-run evidence

The independent audit ran:

- `node --check` for both P3D JavaScript artifacts: PASS;
- P3D semantic smoke: PASS, exact four runtime artifacts, one migration, two
  P3D RPCs, 16 inherited hashes and exact P3D SHA;
- ten inherited semantic regressions: PASS (10/10);
- full guarded local Docker reset/apply and P3D QA: process PASS;
- genuine A-to-B, post-issue recovery, substitution/downgrade, exact P3D
  replay, fault matrix, seven waits and two-session root barrier: process PASS;
- independent catalog effective-privilege audit: FAIL, CRITICAL-1;
- independent loopback anon PostgREST probes: FAIL, CRITICAL-1;
- independent catalog recovery call-graph audit: FAIL, HIGH-1;
- independent P3C replay branch audit: FAIL, HIGH-2;
- final inherited migration hash check: 16/16 PASS;
- exact remediated migration SHA check: PASS.

The official runner's PASS is therefore not sufficient technical acceptance.

## 8. Cleanup, Git and scope

After the full runner, read-only local verification showed baseline zero for:

```text
auth.users
vault.secrets
student_profile
guardian_profile
crm_identity_target_binding
guardian_student_relationship
crm_reviewed_cross_source_reuse_authorization
REAL_CONVERSION idempotency rows
p3d_qa_% functions
p3d_qa_% triggers
```

No remote, Auth-provider, Edge, Storage, deployment, UI, import or P4 action
was performed. Roadmap was not changed. No file was staged, committed, or
pushed.

## 9. Acceptance summary

```text
CRITICAL FINDINGS: 1
HIGH FINDINGS: 2
MEDIUM FINDINGS: 2
LOW FINDINGS: 0

BLOCKER 1 -- GENUINE CROSS-SOURCE REUSE: PASS
BLOCKER 2 -- IDENTITY LOCK ARCHITECTURE: PASS
REVIEWER PROVENANCE: PASS PHYSICALLY / QA DEPTH INCOMPLETE
AUTHORIZATION LIFECYCLE / RECOVERY: BLOCKED
V1/V2: PASS FOR FIRST EXECUTION
AUTHORIZATION DIGEST: PASS
RELATIONSHIP SCOPE DIGEST: PASS
ATOMICITY / FAULT ROLLBACK: PASS
EXACT REPLAY: BLOCKED (P3C WRAPPERS)
P3D0 CRYPTO: PASS
AUDIT / OUTBOX: PASS
PRIVACY / RPC SURFACE: BLOCKED
P3D SMOKE: PROCESS PASS / ACCEPTANCE BLOCKED
P3D LOCAL DB QA: PROCESS PASS / ACCEPTANCE BLOCKED
INHERITED REGRESSIONS: 10/10 PASS
INHERITED MIGRATION HASHES: 16/16 PASS
FINAL CLEANUP: PASS
FINAL P3D SHA MATCH: YES
NEW BLOCKING TECHNICAL DEFECT: YES

IMPLEMENTATION MODIFIED DURING AUDIT: NO
ROADMAP MODIFIED: NO
COMMIT: NO
PUSH: NO
REMOTE APPLY / DEPLOY: NO
P3D DONE: NO
P4: NOT STARTED

P3D TECHNICAL ACCEPTANCE: BLOCKED
NEXT GATE: MINIMAL P3D IMPLEMENTATION REMEDIATION
```

F23.3E-P3D EXTERNAL TECHNICAL RE-AUDIT BLOCKED — MINIMAL IMPLEMENTATION REMEDIATION REQUIRED
