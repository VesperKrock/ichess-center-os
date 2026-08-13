# F23.3E-P3D-R0 Final Independent Design Re-Audit

## 1. Verdict

```text
F23.3E-P3D-R0 FINAL INDEPENDENT DESIGN RE-AUDIT: PASS

P3D IMPLEMENTATION STATUS: EXTERNAL TECHNICAL AUDIT BLOCKED
P3D REMEDIATION IMPLEMENTED: NO
P3D DONE: NO
P4 STARTED: NO

NEXT GATE: P3D REMEDIATION IMPLEMENTATION + LOCAL QA
```

This is an independent design verdict over the final P3D-R0 revision. It is
not a runtime, local-Docker, external implementation, remote-apply, production,
or product end-to-end verdict. The current blocked P3D implementation remains
blocked until the accepted design is implemented and its full local QA passes.

No CRITICAL or HIGH finding remains. No MEDIUM ambiguity remains that would
force the implementer to invent an authority, lifecycle, serializer, lock,
event, or test contract.

## 2. Verified Repo Baseline

The audit started from this read-only baseline:

```text
branch: main
HEAD: 6879df4c5904db1b427eb974eaa099724f3f6a28
origin/main: 6879df4c5904db1b427eb974eaa099724f3f6a28
tracked modifications: 0
staged files: 0
blocked P3D migration SHA-256:
35C43A650060CB84A3233B5543076967B4B26F5E66A30998716D7FCF2BBDAA31
```

Before this report, exactly seven artifacts were untracked: the four blocked
P3D package files, the current P3D-R0 design, and the two prior independent
audit reports. The four blocked package files were not modified during this
audit. This report is the eighth untracked artifact.

## 3. Audit Scope and Physical Evidence

The review did not trust the design's closure markers. It read the current
design and both prior audits, then checked the relevant physical P2A/P2B/P2C,
P3A/P3B/P3C0/P3C/P3D0 contracts and all four blocked P3D artifacts.

Load-bearing physical observations were:

- `crm_identity_match_review` physically starts `PENDING v1` with null
  `reviewer_user_id`, `reviewer_authority_version`, and `decided_at`, and its
  guarded terminal decision is the existing point where reviewer identity is
  established.
- `crm_conversion_request` already has terminal `SUPERSEDED`; its one-active-
  Case partial index excludes terminal rows, so recovery through a fresh
  Request does not require resurrection or action generations.
- `crm_conversion_action` already has terminal `SUPERSEDED`; its forward guard
  can narrowly add the accepted protected APPROVED-to-SUPERSEDED invalidation
  edge without editing the checkpoint migration.
- `crm_profile_creation_reservation` already has `SUPERSEDED` with the physical
  terminal reason `SOURCE_OR_POLICY_SUPERSEDED` and exact version increment.
- `crm_conversion_authority` already has `REVOKED|EXPIRED` terminal states and
  the existing protected
  `f23_3e_p3b_revoke_or_expire_conversion_authority(...)` entry point.
- `crm_identity_target_binding` physically stores exact Source/Request/review/
  target provenance and enforces one active binding per source. Its current P3C
  resolver requires exact-source provenance, which proves why a separate
  Source-B reviewed reuse authorization is necessary.
- Physical P3B/P3C paths take the exact-center `center_crm_control` row
  `FOR UPDATE` before identity mutexes. The same-center root is therefore a real
  exclusive serialization boundary, not an assumed mutex-order property.
- The existing
  `f23_3e_p3b_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid)`
  body creates one Audit row and one Outbox row in the caller transaction with
  the finite safe payload shape used by the revised design.
- The blocked P3D executor really contains the rejected Student-subset lock
  followed by a whole-center mutex scan and calls lock-owning P3C helpers. The
  blocked QA really fabricates reuse by resurrecting the completed first flow
  with `session_replication_role='replica'`. The remediation is therefore
  addressing reproduced defects, not hypothetical ones.

## 4. Finding 1 — Six No-Relock Cores

**Result: PASS.**

The design freezes exactly six sole-caller, internal-only cores:

| Responsibility | Proposed physical function | Result contract |
|---|---|---|
| Student create | `f23_3e_p3d_internal_create_student_target_no_relock(...)` | Student ID/version and finite outcome |
| Student reuse | `f23_3e_p3d_internal_resolve_reusable_student_no_relock(...)` | eligibility, Student ID/version, finite outcome |
| Guardian create | `f23_3e_p3d_internal_create_guardian_target_no_relock(...)` | Guardian ID/version and finite outcome |
| Guardian reuse | `f23_3e_p3d_internal_resolve_reusable_guardian_no_relock(...)` | eligibility, Guardian ID/version, finite outcome |
| Binding commit/verify | `f23_3e_p3d_internal_commit_identity_target_binding_no_relock(...)` | binding ID/version and finite outcome |
| Relationship composition | `f23_3e_p3d_internal_upsert_relationship_no_relock(...)` | relationship ID/version and finite outcome |

For each function, the revision gives the exact named parameters, SQL types,
return columns, parameter meaning, successful outcome, and finite failure set.
The UUID/version pairs are not type-only placeholders: Request, action, source,
review, reservation, target, authorization, relationship, policy, and locked
mutex-set bindings are separately named.

The sole production caller is exactly
`public.f23_3e_p3d_execute_conversion`. Before any core call, that caller must
hold the center root and all applicable security, step-up, membership,
conversion-authority, idempotency, Request, three-action, source, review,
reservation, reuse-authorization, target, existing binding, and relationship
locks in the normative hierarchy. Nonexistent rows are protected by their
locked parent/source/action scopes and physical PK/partial-unique constraints.

The common contract and each core's local contract jointly state exact row
versions and lifecycle equations. In particular:

- create cores require APPROVED-v3 typed actions, terminal current create
  review, current source, active-v1 reservation, exact policy, absent target,
  and the reservation's preallocated target ID;
- reuse cores require APPROVED-v3 typed actions, terminal reviewed target,
  current source/target/supporting binding, exact `ISSUED v1` Source-B
  authorization, and no active Source-B binding;
- the binding core distinguishes exactly `CREATE_ORIGIN`,
  `VERIFY_EXACT_SOURCE`, and `COMMIT_CROSS_SOURCE_REUSE`;
- the relationship core binds all three APPROVED-v3 actions, exact endpoint
  versions, exact persisted scope digest, current relationship policy, and the
  absent/existing relationship mode.

All six cores forbid `FOR UPDATE`, `FOR SHARE`, root/advisory acquisition, and
every read or write of `crm_identity_match_mutex`. They may not call the
lock-owning P3C wrappers. The revision supplies an exact transitive leaf
allowlist and restricts those leaves to audited crypto/digest primitives and
pure `pg_catalog` functions. Future smoke must resolve the complete callee graph
and reject any hidden lock-owning call.

The transaction-local executor marker and complete-set digest are integrity
guards, not substitutes for the caller-held locks. Row values and versions are
rechecked. Missing selectors map to `RESOURCE_NOT_AVAILABLE`; lock/set mismatch
and every Student/Guardian/binding/relationship stale/conflict class have finite
non-disclosing codes. Raw SQL detail and protected evidence cannot escape.

```text
SIX NO-RELOCK CORES IMPLEMENTABLE WITHOUT GUESSING: YES
LATE IDENTITY MUTEX RELOCK POSSIBLE: NO
```

## 5. Finding 2 — Reviewer Provenance

**Result: PASS.**

The canonical reviewer is unambiguously the actor who performs the terminal
explicit human `REUSE_EXISTING` decision. It is not the PENDING-row creator,
Request creator, materializer, or authorization-shell creator.

The forward contract preserves the physical `PENDING v1` rule: every reviewer
field remains null. The single guarded transition to
`EXACT_REVIEWED_MATCH v2` fills `reviewer_user_id`, membership ID/version, role,
optional consultant assignment ID/version, the legacy physical authority-
version field, and `decided_at`. The reuse authorization later copies that
terminal `reviewer_user_id` and decision time. All such fields are immutable
after the terminal transition.

At decision time, owner/admin or assigned-consultant authority is current and
exact-center. P3C materialization/finalization and P3B issuance recheck captured
reviewer membership/assignment provenance. After valid P3B issuance, that data
is historical proof of human review; later reviewer departure does not erase
history. P3D independently rechecks the current P3B issuer's account security,
session, membership, capability, consumed step-up, and single-use conversion
authority. Historical review provenance never substitutes for current
execution authority.

```text
CANONICAL REVIEWER: TERMINAL HUMAN DECISION ACTOR
HISTORICAL REVIEW VS CURRENT EXECUTION AUTHORITY: PASS
```

## 6. Finding 3 — Authorization Lifecycle and Recovery

**Result: PASS.**

The only persisted lifecycle is finite:

```text
ISSUED v1 -> CONSUMED v2
ISSUED v1 -> INVALIDATED v2
```

Expiry is a currentness boundary, not a third status. At or after server expiry,
finalization, issuance, and first P3D execution fail before business mutation.
Student expiry is the bound review expiry; Guardian expiry is the minimum of
the Guardian and related Student review expiries. P3B authority expiry is no
later than any referenced reuse authorization.

The design correctly adopts the repo's single-plan-per-Request reality instead
of inventing action generations. The exact internal invalidator interface,
callers, parameters, return counts, finite reasons, version offsets, and lock
ownership are frozen. Before P3B issuance, protected terminal-review branches
in the existing-signature P2C expire/supersede RPCs call it. After issuance,
the existing-signature P3B revoke/expire RPC calls it.

One invalidation transaction changes all bound `ISSUED v1` reuse
authorizations to `INVALIDATED v2`, exactly three actions to `SUPERSEDED +1`,
applicable active reservations to physical terminal states, an issued P3B
authority to the requested `REVOKED|EXPIRED +1`, and Request
`READY_FOR_REVIEW|APPROVED -> SUPERSEDED +1`. Exact count/version mismatch
aborts. Completed historical idempotency snapshots and terminal reviews remain
immutable.

Recovery then creates a fresh Request, performs fresh P2B/P2C review, issues
fresh reuse authorization(s), materializes/finalizes a fresh plan, consumes a
fresh step-up, obtains a fresh P3B authority, and calls P3D. The old Request,
actions, review, authorization, and authority are never resurrected. This is
physically feasible because terminal `SUPERSEDED` Request rows are outside the
one-active-Case partial index.

Only the successful atomic P3D commit consumes the reuse authorization. Failure
rolls the `CONSUMED v2` transition back. Exact replay reads the immutable
completed result before considering the now-consumed live row.

```text
FINAL LIFECYCLE: ISSUED v1 -> CONSUMED v2 | INVALIDATED v2
OLD PLAN/AUTHORITY INVALIDATION: PASS
RECOVERY QA FEASIBLE: YES
RESURRECTION REQUIRED: NO
```

## 7. Finding 4 — Exact Digest Serialization

**Result: PASS.**

The revised design freezes two distinct SHA-256 binary domains:

```text
reuse authorization set:
  domain = ichess.crm.p3.reuse-authorization-set.v1
  encoding/schema version = 1

relationship scope:
  domain = ichess.crm.p3.relationship-scope.v1
  encoding/schema version = 1
```

Both use exact big-endian `U8/U16/U32`, `uuid_send` 16-byte UUIDs, length-
prefixed UTF-8 text, exact 32-byte fields, explicit nullable tags, and canonical
booleans. Invalid length, range, enum, UTF-8, or null shape fails closed. No
JSON, implicit row order, locale order, or digest-domain reuse is involved.

The relationship-scope preimage has a fixed field order binding center,
Request, all three action IDs, Student disposition, both review/version pairs,
both target/version pairs, relationship action and optional existing row,
approved roles/flags, policy version, and safe reason. Joint-null rules and the
typed action constraints prevent partial tuple interpretation.

The authorization-set record binds identity-kind rank, authorization ID and
version, center, Request, action, exact source discriminator, namespace/target/
version, terminal review/version, and optional relationship-scope version and
digest. Records sort by `(GUARDIAN=1|STUDENT=2, authorization UUID bytes)`;
duplicates, duplicate identity kinds, zero rows, dangling rows, or more than two
rows fail. The set preimage includes its domain, version, Request, count, and
length-prefixed records.

Action-set V1 remains the unchanged physical P3B serializer. Cross-source plans
must use V2, whose persisted encoding and auxiliary bindings flow through P3C
finalization, P3B capability/issuance, conversion authority, P3D idempotency,
and first-execution recomputation. Dispatch is exactly V1, V2, or unsupported;
it is never inferred from nullable fields. A changed authorization/version/
target/scope/role, a V1/V2 swap, or an unknown version fails before mutation.

```text
AUTHORIZATION SUBSTITUTION PREVENTED: YES
RELATIONSHIP SCOPE SUBSTITUTION PREVENTED: YES
V1/V2 DOWNGRADE PREVENTED: YES
```

## 8. Finding 5 — Audit and Outbox

**Result: PASS.**

The design names the exact existing writer and maps every physical argument:

```text
public.f23_3e_p3b_internal_append_audit_outbox(
  p_center_id,
  p_event_type,
  p_actor_user_id,
  p_resource_kind,
  p_resource_id,
  p_request_id,
  p_assignment_id,
  p_previous_version,
  p_new_version,
  p_status,
  p_safe_reason_code,
  p_operation,
  p_outcome_code,
  p_correlation_id
)
```

Authorization event ownership is single and finite:

| Owner | Event | Outcome | Safe reasons |
|---|---|---|---|
| P3C materialize | `crm.identity.cross_source_reuse_authorization.issued` | `CROSS_SOURCE_REUSE_AUTHORIZATION_ISSUED` | `explicit_human_reviewed_reuse` |
| P2C/P3B invalidator | `crm.identity.cross_source_reuse_authorization.invalidated` | `CROSS_SOURCE_REUSE_AUTHORIZATION_INVALIDATED` | `authorization_expired`, `review_or_source_stale`, `target_or_support_stale`, `relationship_scope_stale`, `plan_superseded`, `conversion_authority_terminal` |
| P3D | `crm.identity.cross_source_reuse_authorization.consumed` | `CROSS_SOURCE_REUSE_AUTHORIZATION_CONSUMED` | `real_conversion_completed` |

The single-plan Request/action/reservation terminal events are also enumerated.
The existing P3B revoke/expire RPC remains sole owner of the conversion-
authority terminal event, preventing duplicate emission.

The writer's exact schema-v1 safe payload contains only finite aggregate IDs,
versions, statuses, operation/outcome/reason, correlation, Request, and optional
assignment. It adds no name, birth, phone, email, ciphertext, evidence digest,
mutex key, reviewer identity, supporting binding, secret, token, or Vault data.
Validators are extended as a strict finite superset.

The new partial Outbox uniqueness key is exactly
`(center_id,aggregate_kind,aggregate_id,event_version)` only for the reuse-
authorization aggregate. It blocks duplicate semantic emission without
blocking later lifecycle versions or inherited aggregate events. Audit and
Outbox writes remain in the issuing, invalidating, or consuming transaction;
writer/validator/index failure rolls the whole operation back.

```text
TRANSACTIONAL AUDIT + OUTBOX: PASS
TRANSACTIONAL ROLLBACK: PASS
```

## 9. Finding 6 — Genuine Two-Session Root-Lock QA

**Result: PASS.**

The future test is deterministic and invokes the full real executor in two
independent PostgreSQL sessions. Session X alone creates a transaction-local
`pg_temp.p3d_qa_root_barrier`, sets the transaction-local guard, and calls
P3D. The dormant hook is placed immediately after X successfully acquires
`center_crm_control ... FOR UPDATE` and before identity tier 1. It derives a
token-bound advisory key and blocks because the controller already owns the
same session advisory lock.

The controller positively observes X waiting on its advisory lock through
`pg_stat_activity`, `pg_locks`, and `pg_blocking_pids(X)`. Only after that
post-root signal does it launch full executor Y for the same center. Y has no QA
hook and must wait on X's tier-0 root transaction/tuple conflict. The controller
then proves `wait_event_type='Lock'`, `pg_blocking_pids(Y)` contains X, X retains
root-table lock participation, and Y has made no later-tier mutation.

Releasing the controller advisory lock lets X finish; Y then obtains the root
and performs authoritative rechecks, completing or failing with the expected
finite stale/conflict result. Finite deadlock, lock, and statement timeouts turn
hangs and unexpected waits into failures. Readiness never depends on sleep.

The hook is inaccessible to normal service/product calls: activation requires
`session_user='postgres'`, X's own temporary table, its exact row, and a local
GUC. No external RPC parameter exposes a pause or barrier. A malformed barrier
fails rather than pauses.

The crossed Student/Guardian comparator has a separate primitive falsification
test, while the existing seven real lock-wait regressions remain. The design
correctly does not pretend that two same-center full executors can reach
identity tier concurrently: the inherited exclusive root makes that deadlock
class production-unreachable. The full-executor regression therefore proves
the real root serialization boundary, and the primitive/static tests prove the
one-pass identity order beneath it.

```text
GENUINE TWO-SESSION FULL-EXECUTOR ROOT QA FEASIBLE: YES
SLEEP-ONLY READINESS: NOT USED
WAIT EVIDENCE: REAL POSTGRESQL ROOT-TIER BLOCKING
```

## 10. Request A to Request B Production Reachability

**Result: PASS at design level.**

The accepted path is now complete without borrowing Source A's provenance:

1. Request A uses the protected P2B/P2C/P3C/P3B/P3D path to create Student T,
   Guardian G, relationship R, and distinct A-source bindings, then completes.
2. Independent Source B receives strong masked T/G candidates through the
   forward P2B path. The response remains review-only and exposes neither the A
   binding nor Source-A data.
3. P2C reselects the deterministic historical supporting binding server-side;
   a terminal human explicitly chooses reuse and records reviewer provenance.
   No B binding exists yet.
4. P3C issues Source-B/Request-B/Target-bound reuse authorizations and a V2
   plan. Relationship scope binds the exact Student endpoint and decision.
5. P3B performs fresh current capability, step-up, reviewer/currentness, digest,
   and authority checks.
6. P3D revalidates the APPROVED persisted plan and `ISSUED v1`
   authorizations, reuses T/G/R as approved, creates distinct B-source bindings,
   consumes the authorizations, and completes B atomically.

The supporting A binding is evidence that T has current canonical provenance;
it is not B's authority and is never mutated. The reviewed authorization is not
a canonical binding. `binding B->T` is created only inside successful conversion
B. Student and Guardian each require their own reviewed authorization; Guardian
authorization also binds the exact relationship scope and cannot be attached to
an unrelated Student.

The mandatory future QA uses distinct Source/Case/Candidate/Request/review/
step-up/authority/result identities for A and B and only protected runtime
transitions for the semantic gates under test. It forbids
`session_replication_role='replica'`, terminal-state resurrection, deletion of A
idempotency, or direct manufacture of the reviewed state. Assertions preserve A
unchanged, avoid duplicate T/G/R, create distinct A/B binding provenance, keep
event/result correlations distinct, and prove immutable replay.

```text
REQUEST-A -> REQUEST-B PRODUCTION-REACHABLE: YES
STUDENT: PASS
GUARDIAN: PASS
RELATIONSHIP: PASS
```

## 11. Regression and New-Adversarial-Pass Results

| Accepted invariant / attack | Result | Independent reason |
|---|---|---|
| P3A root before mutex | PASS | Every interacting protected physical path takes exclusive same-center root first; no P3A change is required. |
| Full same-center executor serialization | PROVEN | Two transactions cannot pass the same root row concurrently. |
| Complete mixed-kind mutex set | PASS | Stage A derives Student and Guardian resources; union/dedupe occurs before one ranked lock pass. |
| Canonical mutex comparator | PASS | Guardian rank 1, Student rank 2, then PostgreSQL `bytea ASC`; no subset pre-lock or late scan remains in the accepted call graph. |
| P2B privacy/enumeration | PASS | Only mode plus mandatory-review flag are new; raw supporting provenance and negative distinctions remain hidden. |
| V1/V2 action digest | PASS | Existing V1 is preserved; V2 is explicit and persisted end-to-end; unsupported/mixed versions fail closed. |
| Atomicity/rollback | PASS | authorization, target/reuse, binding, relationship, reservation, lifecycle, events, and immutable result share one transaction. |
| Exact replay | PASS | completed immutable result is checked before live Request/action/authority/authorization state and before digest recomputation. |
| P3D0/P3C0 crypto | PASS | Candidate `IC3CBE01/iC3Bth01`, Student `IC3SBE01/iC3Std01`, Guardian unwrap/re-protect, and three independent environment domains remain unchanged. |
| Reviewer substitution | PASS | only terminal decision actor is copied into authorization; current P3B authority is separately checked. |
| Authorization resurrection | PASS | terminal authorization/Request/actions never reopen; recovery uses a fresh Request. |
| Authorization/target substitution | PASS | ID/version/source/target/review/scope changes alter persisted bindings or canonical digests. |
| Relationship-scope substitution | PASS | endpoint, relationship decision/version, roles, flags, policy, and reason are canonically bound. |
| Duplicate events | PASS | one transition owner and per-authorization-version partial uniqueness are frozen. |
| Production barrier activation | PASS | postgres session plus transaction-local GUC plus private temp row are jointly required; no product parameter exists. |
| Root bypass / late mutex relock | PASS | root is tier 0; static transitive graph and no-relock core contract reject any later mutex access. |
| Stale authority after invalidation | PASS | old Request/actions/auth rows are terminalized atomically; fresh execution needs fresh P3B authority. |
| Replay after consumption | PASS | immutable result precedes consumed-state interpretation and causes no second event or mutation. |
| Inherited migration boundary | PASS | all changes are forward replacements/extensions inside the still-uncommitted P3D migration; no checkpoint bytes need editing. |

No new implementation-blocking regression was found.

## 12. Severity Summary

```text
CRITICAL FINDINGS: NONE
HIGH FINDINGS: NONE
MEDIUM FINDINGS REQUIRING IMPLEMENTATION GUESSING: NONE
LOW FINDINGS: NONE
INFORMATIONAL: implementation and local QA remain outstanding

NEW IMPLEMENTATION-BLOCKING CRITICAL/HIGH FINDING: NO
DESIGN REVISION REQUIRED: NO
P3A_NORMATIVE_REOPEN_REQUIRED: NO
INHERITED MIGRATIONS REQUIRE EDIT: NO
FROZEN_NORMATIVE_SEMANTICS_REOPEN_REQUIRED: YES
  -- only through the exact P3D-era forward extensions enumerated by the design
```

## 13. Implementation Acceptance Boundary

This design PASS authorizes no remote or production action. The next
implementation must remediate the existing uncommitted P3D migration in place,
update only the four P3D package artifacts, compute a new P3D SHA, retain all 16
inherited hashes, and run the complete guarded local QA.

At minimum, implementation acceptance must prove:

- all six exact no-relock cores and their static transitive graph;
- no identity subset lock and exactly one complete mixed-kind pass;
- genuine protected Request-A create to independent Request-B cross-source
  reuse for Student, Guardian, and relationship;
- pre- and post-issuance invalidation followed by a fresh Request, with no
  resurrection;
- V1 golden compatibility, V2 and both auxiliary digest golden vectors, and
  substitution/downgrade negatives;
- exact Audit/Outbox event ownership, safe payload, uniqueness, and rollback;
- the deterministic two-session root barrier and real PostgreSQL wait evidence;
- all retained seven lock waits, drift/fault matrices, privacy/RLS/grants,
  P2/P3B/P3C/P3D0 regressions, 16 inherited hashes, and final cleanup baseline.

Only a later independent technical audit may decide whether the remediated P3D
implementation passes. P4 remains outside this gate.

## 14. Final Gate

```text
FINDING 1 -- SIX NO-RELOCK CORES: PASS
FINDING 2 -- REVIEWER PROVENANCE: PASS
FINDING 3 -- AUTHORIZATION LIFECYCLE / RECOVERY: PASS
FINDING 4 -- DIGEST SERIALIZATION: PASS
FINDING 5 -- AUDIT / OUTBOX: PASS
FINDING 6 -- GENUINE ROOT-LOCK QA: PASS

P3A_NORMATIVE_REOPEN_REQUIRED: NO
FULL SAME-CENTER EXECUTOR SERIALIZATION: PROVEN
MIXED-KIND MUTEX ORDER: PASS
P2B PRIVACY: PASS
ACTION-SET V1/V2: PASS
ATOMICITY / ROLLBACK: PASS
EXACT REPLAY: PASS
P3D0: PASS
INHERITED MIGRATIONS REQUIRE EDIT: NO

F23.3E-P3D-R0 FINAL INDEPENDENT DESIGN RE-AUDIT: PASS
NEXT GATE: P3D REMEDIATION IMPLEMENTATION + LOCAL QA
```

F23.3E-P3D-R0 FINAL INDEPENDENT DESIGN RE-AUDIT PASS — BEGIN P3D REMEDIATION IMPLEMENTATION + LOCAL QA
