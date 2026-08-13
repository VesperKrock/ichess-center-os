# F23.3E-P3D-R0 — Independent Design Audit

## Audit verdict

```text
F23_3E_P3D_R0_INDEPENDENT_DESIGN_AUDIT: BLOCKED
P3D_R0_PREFLIGHT: PASS
P3D_R0_BLOCKER_1_CROSS_SOURCE_REUSE: BLOCKED
P3D_R0_BLOCKER_2_IDENTITY_MUTEX_TOTAL_ORDER: BLOCKED
P3D_R0_DESIGN_REVISION_REQUIRED: YES
P3D_STATUS: NOT DONE
P4_STATUS: NOT STARTED
NEXT_GATE: P3D-R0 DESIGN REMEDIATION REVISION
```

The central provenance idea is directionally correct: a reviewed cross-source
reuse authorization is distinct from both historical binding A-to-T and the
future binding B-to-T, and binding B-to-T is created only by successful atomic
conversion B. That idea does not yet make the design implementation-ready.
Adversarial comparison with the physical P2/P3 contracts found unresolved
HIGH issues in authorization currentness/lifecycle, action-digest versioning,
and identity-lock ordering/test feasibility. The author's `READY`, `22/22`,
and “no design blocker remains” claims are therefore not accepted.

## Scope and verified baseline

This was a design-only audit. No runtime, migration, test, roadmap, remote
state, P4 work, commit, push, or staging operation was performed.

```text
repository: VesperKrock/ichess-center-os
branch: main
HEAD: 6879df4c5904db1b427eb974eaa099724f3f6a28
origin/main: 6879df4c5904db1b427eb974eaa099724f3f6a28
staged files: 0
tracked modifications: 0
blocked P3D migration SHA-256:
35C43A650060CB84A3233B5543076967B4B26F5E66A30998716D7FCF2BBDAA31
```

Before this report, the worktree contained exactly the four blocked P3D
artifacts plus `docs/f23-3e-p3d-r0-design-remediation.md`, all untracked. The
blocked P3D hash remains an identity of the rejected implementation, not an
acceptance hash.

## Sources independently inspected

The audit read the canonical handoff, the entire R0 design, the final-audited
P3D0 and P3C0 crypto freezes, the P3A design, physical P2A/P2B/P2C and
P3B/P3C migrations, all four blocked P3D artifacts, and finally the independent
audit prompt. The load-bearing physical contracts were:

- `crm_identity_match_review` stores the exact source/Request/target/evidence
  tuple plus `reviewer_user_id` and one `reviewer_authority_version`;
- P2C currently writes `reviewer_authority_version` from the source Assignment
  version, not from a `center_members.membership_version` snapshot;
- `crm_identity_target_binding` owns immutable source provenance and permits
  one ACTIVE binding per exact source;
- both P3C reuse resolvers currently require the ACTIVE binding source to be
  the current source and additionally require its originating Request/review
  to equal the current review's Request/review;
- P3B canonical action-set digest V1 has a fixed two-argument function and
  hard-coded `encoding_version = 1`; authorities persist that encoding version;
- P3B authority issuance and P3C plan materialize/finalize lock the center root
  `FOR UPDATE`, then lock identity mutex rows ordered by
  `(identity_kind, identity_match_mutex_key)`;
- the blocked P3D executor first locks a Student subset and later performs the
  all-active `(identity_kind, key)` pass, reproducing the audited inversion;
- its reuse QA fabricates a terminal-to-live flow with
  `session_replication_role='replica'` and is not production-reachable.

## Finding summary

| ID | Severity | Finding | Effect |
|---|---|---|---|
| H1 | HIGH | The proposed two-executor identity-mutex test cannot reach the claimed mutex wait under the physical exclusive center-root lock; the R0 design does not freeze a different root lock mode or prove its compatibility. | Blocker 2 is not closed. |
| H2 | HIGH | R0 freezes raw-`bytea` ordering for a mixed Student/Guardian set, while inherited P3B/P3C whole-center lockers use `(identity_kind, key)`; the design neither chooses one system-wide tuple order nor proves root-lock serialization between all differing orders. | No demonstrated global total order. |
| H3 | HIGH | The no-relock composition contract is an intention, not a closed physical call graph. Exact no-relock Student, Guardian, reuse, binding, and relationship cores/signatures/preconditions are not frozen. | A later helper can reacquire or discover an earlier-tier mutex. |
| H4 | HIGH | Reuse-authorization currentness/lifecycle is incomplete: Request/action lifecycle version offsets, reviewer membership provenance, and ownership of expire/revoke/supersede transitions are not normative. | A valid authorization can be made permanently stale or a live-source unique slot can become stranded; a naïve equality check makes every post-approval execution stale. |
| H5 | HIGH | V1/V2 action-set serializer coexistence is not frozen. Replacing the existing fixed V1 digest function without a dispatch rule can reinterpret already-finalized actions/authorities and break replay or first execution. | P3B authority binding is not migration-safe. |
| M1 | MEDIUM (blocking in combination) | P2B's new masked signal lacks an exact deterministic supporting-binding selection and response/detail contract. | Privacy and review reproducibility remain under-specified. |
| M2 | MEDIUM (blocking in combination) | New authorization issue/consume/terminal Audit+Outbox event names, finite outcomes, safe payload fields, event versions, and idempotency bindings are not frozen. | Transactionality is stated, but the externally auditable event contract is not. |
| M3 | MEDIUM | The blocked P3D smoke's phase regex counts `f23-3e-p3d-r0-*` documents as P3D package artifacts while asserting exactly four artifacts. | Future remediation must make the smoke forward-compatible without weakening P3D-owned invariants. |

No separate CRITICAL finding was needed: any unresolved HIGH finding blocks the
audit.

## H1 — the claimed crossed-key runtime proof is unreachable

R0 tier 0 is the exact `center_crm_control` root, followed by tier 1 identity
mutexes. Its proposed concurrency QA releases both executor sessions after
Stage A and requires a genuine wait on the first common identity key.

The physical P3B issue RPC, P3C materialize/finalize RPCs, P3C relationship
writer, and blocked P3D executor all acquire the same-center root `FOR UPDATE`
before any identity mutex. Two Requests sharing a mutex must be in the same
center because center is bound into the mutex derivation. Therefore, with the
physical lock mode, one executor blocks at the root and cannot concurrently
reach the first common mutex. Cross-center executors cannot supply the same
canonical mutex key.

R0 does not specify a tier-0 lock mode. It neither explicitly retains
`FOR UPDATE` (making the proposed proof impossible) nor reopens tier 0 to a
compatible shared lock and proves that such a change remains safe against
root-policy mutations and inherited P2/P3 paths. A test-only bypass would not
be evidence about the production executor.

Required revision:

1. Freeze the exact root lock mode for every participating production path.
2. If the exclusive root remains, acknowledge that same-center executors are
   serialized at tier 0 and replace the impossible assertion with a truthful
   root-serialization proof plus a separately justified way to falsify the
   nested identity-order class. If the user requirement still demands two
   executors reaching mutexes, the architecture must be deliberately reopened.
3. If a shared root is selected, specify the root-version recheck and enumerate
   every incompatible inherited root writer/locker. Prove no policy/control
   mutation can pass Stage B and no mixed lock order can interact.
4. The final test must observe the tier it claims through `pg_locks`,
   `wait_event_type='Lock'`, and `pg_blocking_pids`, with deadlock, lock, and
   statement timeouts as hard failures.

## H2/H3 — no proven one-pass global identity order

R0 represents the complete set as bare `bytea`, deduplicates and orders only
by `bytea`. The physical database has `identity_kind` on every mutex row. P3B
authority issuance and P3C materialize/finalize/relationship paths order the
whole-center set by `(identity_kind, identity_match_mutex_key)`. P2B/P2C and
the per-kind target helpers use byte order within a single kind. These orders
can differ for a mixed Student/Guardian set.

The R0 claim that standalone wrappers may keep their old contract is safe only
if a precisely specified root-lock compatibility relation proves that no two
different mutex orders can execute concurrently. That proof is absent. The
same omission is what prevents H1's test from being meaningful.

The key inputs themselves are derivable before locking: Student uses current
display name and protected typed birth date; Guardian uses current Contact
display name, all normalized lookup digests, and source Contact ID. P3D0 Stage
A can hold those typed inputs transiently and Stage B can rederive them. Thus
the completeness concept is feasible. The failure is in the normative locking
contract, not in evidence availability.

R0 also says P3D will call protected no-relock cores but does not freeze their
exact call graph. The current physical P3D calls
`f23_3e_p3c_internal_create_student_target`,
`f23_3e_p3c_internal_create_guardian_target`, and
`f23_3e_p3c_internal_upsert_guardian_student_relationship`; those helpers own
root/mutex locks. Merely saying replacement cores “assume” an outer lock does
not define how that precondition is enforced or which current validators are
copied/shared without moving backward in the hierarchy.

Required revision:

- Model the set as exact `(identity_kind, identity_match_mutex_key)` records,
  then freeze one canonical comparison rule, or explicitly prove why raw byte
  order is the only interacting order under named root lock modes.
- Enumerate every function that can participate concurrently and its root and
  mutex lock modes/order. Any retained exception needs a serialization proof.
- Freeze exact no-relock core names/signatures for Student create/reuse,
  Guardian create/reuse, binding insert/verify, and relationship
  create/reuse/update, along with their allowed caller and locked-input
  contract. The executor must contain exactly one mutex acquisition loop; no
  later helper may query `crm_identity_match_mutex ... FOR UPDATE/SHARE`.
- Make structural smoke inspect the complete call graph, not only count a loop
  in the executor text.

## H4 — authorization currentness and lifecycle are not executable as written

The proposed aggregate binds the right semantic identities: exact center,
Source B, Request B, terminal review B, exact target/version, evidence/policy
material, reviewer provenance, action, and Guardian relationship scope. It is
explicitly not binding A-to-T, and B-to-T is deferred to atomic conversion.
Those are sound foundations.

Three lifecycle gaps still prevent a fail-closed implementation:

1. **Lifecycle-aware Request/action versions are missing.** The authorization
   stores Request version at P3C materialization. P3B issuance then validly
   changes Request `READY_FOR_REVIEW -> APPROVED +1` and actions
   `REVIEWED -> APPROVED +1`. R0 says later Request/action drift is stale but
   does not freeze the expected offsets at P3B and P3D. Exact equality with the
   materialization snapshot would reject every legitimate P3D first attempt;
   loose equality would admit drift.
2. **Reviewer authority provenance is not mapped to the physical review.**
   P2A has `reviewer_user_id` and `reviewer_authority_version`; current P2C
   assigns the latter from `source_assignment_version`. It has no persisted
   reviewer membership ID/version. R0 requires membership/assignment IDs and
   versions but does not specify new review columns, whether owner/admin versus
   consultant use different authority sources, or the exact review-time and
   execution-time rechecks.
3. **Terminal lifecycle ownership is absent.** A partial unique index allows
   only one `ISSUED` authorization per source, but wall-clock expiry does not
   change `status`. No protected function is assigned responsibility for
   `EXPIRED`, `REVOKED`, or `SUPERSEDED`, including materialization/finalization
   failure and plan/Request supersession. An expired row can therefore strand
   the live-source slot indefinitely.

Required revision must define exact stored columns and transition owners,
expected version equations across materialize/finalize/approve/execute, lock
order, idempotency, Audit+Outbox, expiry terminalization, supersession, and the
outcome when a source has an old ISSUED row. No index predicate may rely on
current time.

## H5 — action/authority serializer coexistence is unresolved

The physical `f23_3e_p3b_internal_action_set_digest(uuid,text)` hard-codes V1,
and `crm_conversion_authority.p3_action_set_encoding_version` records the
version. R0 proposes adding `reviewed_reuse_authorization_id` and a “new
versioned canonical action-set encoding,” but does not freeze:

- the new encoding number and exact serializer fields/order;
- whether the existing two-argument function dispatches by plan metadata or a
  new version-aware helper is introduced;
- how V1 CREATE/no-target/exact-source rows coexist with V2 cross-source rows;
- how P3C finalize, P3B approve/issue, P3D first execution, authority status,
  and immutable replay select the same encoding;
- whether pre-remediation live V1 rows are executable, explicitly terminalized,
  or make migration fail before any mutation.

A global `CREATE OR REPLACE` that silently begins producing V2 would alter the
meaning of V1 authorities. Required revision must freeze version dispatch and
coexistence. Completed exact replay must remain snapshot-only and must not
recompute either V1 or V2 live rows.

## Blocker 1 adversarial conclusion

```text
BLOCKER 1 — REVIEWED CROSS-SOURCE REUSE: BLOCKED
GENUINE REQUEST-A -> REQUEST-B QA CURRENTLY CONSTRUCTIBLE: NO
```

The core authorization separation answers the original circularity at a
conceptual level:

```text
A-to-T = historical committed provenance only
B/request-B/review-B/T authorization = explicit reviewed permission
B-to-T = new provenance row inserted only by atomic conversion B
```

It supports both Student and Guardian and binds Guardian reuse to an exact
Student action/endpoint and relationship decision, which prevents a Guardian
authorization from being transferred to an unrelated Student. B and C may
legitimately obtain independent authorizations and bindings to the same target
under exact-center target locks and the existing one-active-source constraint.

However, Request B cannot yet be declared production-reachable from the
normative text because the authorization's lifecycle-aware versions, reviewer
authority snapshot, expiry/supersession transition owner, and action-digest
version are not closed. The proposed A→B QA sequence is the correct acceptance
shape and its ban on trigger disabling/terminal resurrection is mandatory;
after revision it must exercise both Student and Guardian through P2B search,
P2C decision, P3C materialize/finalize, fresh P3B step-up/authority, and P3D.

The future test must prove A remains terminal and immutable; B has distinct
sources/reviews/actions/authority/result/events; Student/Guardian counts do not
increase; B obtains new B-provenance bindings; A bindings are unchanged; the
relationship is reused or created exactly as reviewed; and exact retry adds no
event/version. `session_replication_role='replica'` is forbidden for that flow.

## Blocker 2 adversarial conclusion

```text
BLOCKER 2 — COMPLETE IDENTITY MUTEX TOTAL ORDER: BLOCKED
GENUINE TWO-EXECUTOR CROSSED-KEY QA CURRENTLY FEASIBLE AS WRITTEN: NO
```

The complete Student+Guardian key inputs are knowable in protected Stage A,
and rederivation under locked Stage B is sound. But R0 has not defined a single
interacting order across raw-byte and `(kind,key)` physical paths, has not
closed the nested no-relock call graph, and proposes a mutex-wait observation
that the exclusive root prevents. A structural assertion about loop count
cannot substitute for a reachable production concurrency proof.

## Other contract assessments

### P2B forward extension — BLOCKED

The separate `cross_source_review_eligible` concept preserves the important
rule that same-name/birth or Contact evidence remains review-only. Exact-center
masked target selection can remain safe. The revision must nevertheless freeze
deterministic supporting-binding selection when multiple historical sources
are bound to the same target, the exact safe candidate/detail fields, and
stable projection/currentness behavior. No source ID, binding provenance,
protected digest, or stronger certainty may enter the masked response.

### P2C forward extension — BLOCKED

An explicit `AUTHORIZE_CROSS_SOURCE_REUSE` terminal decision and immutable
selected target/support evidence is the correct forward extension. The
revision must freeze the new review columns and guard mapping, reviewer
membership/assignment snapshot semantics, lifecycle version equations,
idempotency result, and finite event vocabulary. It must retain consultant
assignment scoping and owner/admin exact-center checks server-side.

### P3B forward extension — BLOCKED

Fresh step-up, owner/admin final capability, single-use conversion authority,
separate authority environment, and post-APPROVED digest ordering remain
mandatory and are not conceptually reopened. H5 prevents a safe implementation
until V1/V2 serializer and authorization-set digest coexistence are exact.

### P3C forward extension — BLOCKED

P3C can materially create the new authorization and a reuse action without a
B-to-T binding; that resolves the old resolver circularity. It must use the
authorization, never A-to-T, as B's permission. Exact no-relock cores,
authorization lifecycle checks, lifecycle-aware Request versions, and
Guardian relationship binding still require normative detail.

### Student — BLOCKED

The intended identity and provenance model is sound, including protected birth
recheck and no duplicate target. It remains blocked by H2–H5.

### Guardian and relationship — BLOCKED

The design correctly recognizes Guardian asymmetry and binds the Student
endpoint and full relationship choice. It retains exact-center relationship
constraints and historical provenance. It remains blocked by lifecycle,
event, serializer, and no-relock details. Guardian identity authorization alone
must never imply relationship authorization.

### Atomicity / rollback — PASS at the transaction-boundary level

The design keeps authorization validation/consumption, target/relationship
composition, B-binding insert, reservation consumption, terminal states,
authority consumption, Audit+Outbox, and immutable result in one PostgreSQL
transaction. Exact replay precedes consumed/live-state interpretation. No saga
or compensation path is introduced. Implementation may claim this PASS only
after fault injection at every listed edge.

### Audit + Outbox — BLOCKED

Transactional pairing is preserved in principle, but R0 does not enumerate
the finite authorization issue/consume/expire/revoke/supersede event types,
safe reasons/outcomes, resource versions, or privacy-safe payload fields.
These must be frozen and added to validators atomically. No source evidence,
supporting-source provenance, birth/contact bytes, mutex keys, or secrets may
appear.

### Privacy / exact-center — BLOCKED pending P2B contract completion

Forced RLS/no policy/no Realtime/no app-role grants and server-derived center
are correct. The exact masked cross-source signal/detail contract identified in
M1 must be fixed before privacy can pass independent audit.

### P3D0/P3C0 crypto regression — PASS

R0 preserves Candidate `IC3CBE01`/`iC3Bth01`, Student
`IC3SBE01`/`iC3Std01`, Guardian source/target protection, strict fail-closed
legacy behavior, and three independent authority/identity/crypto environment
domains. It introduces no fourth environment domain and does not authorize
ciphertext copy or plaintext disclosure.

## Forward-migration and artifact strategy

No inherited migration requires editing. A new ordered forward remediation
migration can add the protected authorization aggregate, exact review/action/
authority columns and constraints, and bounded function replacements. One
atomic migration may be feasible only after the version and lock-mode rules
above are frozen; multiple ordered forward migrations are safer if schema,
runtime, and data-compatibility validation cannot be made atomic and reviewable
in one file. Existing rows must never be silently upgraded into cross-source
authority.

The four blocked P3D artifacts should later be treated as a rejected candidate,
not as proof. Remediation should replace/supersede the blocked implementation
through forward migration artifacts and regenerate its report/smoke/guarded QA
to reflect the new architecture. The existing P3D smoke must explicitly exclude
R0 design/audit artifacts from its package inventory while continuing to lock
the blocked/new migration identity and all inherited invariants appropriate to
the remediation stage.

## Required design revision checklist

Independent audit may be rerun only after the design:

1. freezes exact Request/action/review/authorization version equations at
   materialize, finalize, P3B issue, and P3D execute;
2. freezes physical reviewer membership/assignment provenance columns and
   currentness checks for owner, admin, and consultant;
3. assigns protected, idempotent owners and events to every authorization
   terminal transition and prevents expired ISSUED rows from stranding the
   live-source unique slot;
4. freezes V1/V2 action serializer and authority-digest dispatch/coexistence;
5. freezes exact P2B masked fields and deterministic supporting-binding
   selection;
6. freezes exact authorization Audit+Outbox vocabulary and safe payloads;
7. freezes the center-root lock mode and its compatibility with all inherited
   root/mutex users;
8. selects and proves one interacting mixed-kind mutex order;
9. enumerates exact no-relock core functions and proves the post-mutex call
   graph never acquires or discovers an earlier-tier mutex;
10. rewrites the two-executor QA so its claimed PostgreSQL wait is reachable
    through the production executor without a test-only semantic bypass;
11. keeps the genuine Request-A→Request-B Student/Guardian test exactly
    production-reachable and retains all negative, fault, privacy, cleanup,
    inherited-hash, and original seven lock-wait regressions.

## Final acceptance matrix

```text
BLOCKER 1 — CROSS-SOURCE REUSE: BLOCKED
BLOCKER 2 — IDENTITY MUTEX TOTAL ORDER: BLOCKED
STUDENT: BLOCKED
GUARDIAN: BLOCKED
RELATIONSHIP: BLOCKED
P2B FORWARD EXTENSION: BLOCKED
P2C FORWARD EXTENSION: BLOCKED
P3B FORWARD EXTENSION: BLOCKED
P3C FORWARD EXTENSION: BLOCKED
AUTHORIZATION LIFECYCLE: BLOCKED
ATOMICITY / ROLLBACK DESIGN BOUNDARY: PASS
AUDIT + OUTBOX CONTRACT: BLOCKED
PRIVACY / EXACT-CENTER: BLOCKED
P3D0 CRYPTO REGRESSION: PASS
GENUINE REQUEST-A -> REQUEST-B QA FEASIBLE NOW: NO
GENUINE TWO-EXECUTOR CROSSED-KEY QA FEASIBLE NOW: NO
INHERITED MIGRATIONS REQUIRE EDIT: NO
DESIGN REVISION REQUIRED: YES
```

```text
F23.3E-P3D-R0 INDEPENDENT DESIGN AUDIT BLOCKED — DESIGN REVISION REQUIRED BEFORE IMPLEMENTATION
```
