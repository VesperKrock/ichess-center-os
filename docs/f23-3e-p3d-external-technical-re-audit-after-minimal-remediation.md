# F23.3E-P3D External Technical Re-Audit After Minimal Remediation

## 1. Verdict

```text
F23.3E-P3D EXTERNAL TECHNICAL RE-AUDIT: PASS

P3D TECHNICAL ACCEPTANCE: PASS
P3D DONE: NO — CLOSEOUT/CHECKPOINT PENDING
P4: NOT STARTED

NEXT GATE: P3D CLOSEOUT / ROADMAP UPDATE / CHECKPOINT / COMMIT-PUSH
```

This independent re-audit finds the five findings from the previous external
technical re-audit closed. The remediated runtime also retains the previously
accepted cross-source reuse, provenance, lock-order, atomicity, replay,
security, privacy, and P3D0 crypto contracts.

No implementation, migration, runtime test, inherited checkpoint, R0
design/audit artifact, prior audit report, or roadmap file was changed during
this audit. This report is the only artifact created.

## 2. Preflight and audited identity

```text
repository: VesperKrock/ichess-center-os
branch: main
HEAD: 6879df4c5904db1b427eb974eaa099724f3f6a28
origin/main: 6879df4c5904db1b427eb974eaa099724f3f6a28
tracked modifications before audit: 0
staged files before audit: 0
pre-audit untracked artifacts: 9/9 expected
P3D migration SHA-256:
F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3
inherited migration hashes: 16/16 PASS
remote apply: NOT RUN
```

The migration bytes match the supplied minimal-remediation identity. The
prior SHA
`16BF495282AF762FDFCDB40FA75E7CDE1A2CAB11D9F32F3821B954CE9B38F288`
is historical evidence only and was not used as acceptance truth.

## 3. Audit method and independence

The audit read the final-audited R0 design, the final independent R0 design
re-audit, the prior blocked external technical re-audit, the four current P3D
runtime artifacts, P3D0, and the relevant physical P2B/P2C/P3B/P3C contracts.
It then:

- reviewed the physical forward replacements, ACL hardening, invalidation
  caller graph, replay ordering, index predicate, executor lock sequence, and
  QA assertions;
- reset and applied the local migration chain through the guarded P3D Docker
  runner only after its local/loopback safety gate passed;
- independently queried `pg_proc`, effective privileges, and the partial
  unique index after apply;
- independently invoked all affected recreated surfaces through loopback
  PostgREST using the local anon credential;
- reran the P3D semantic smoke, the full P3D local DB QA, and all ten relevant
  inherited semantic regressions;
- independently queried cleanup state after the runner's final reset.

The audit did not infer PASS from the implementation report's markers.

## 4. Previous finding closure

| Prior finding | Result | Independent evidence |
|---|---|---|
| CRITICAL — recreated protected functions reopened default `EXECUTE` | CLOSED | Catalog and effective privilege checks show no `PUBLIC`, `anon`, or `authenticated` execution; real anon PostgREST calls are denied. |
| HIGH — no production-reachable pre-issue V2 invalidation/recovery | CLOSED | P2C expire/supersede forward paths invoke the exact single-plan invalidator; full QA proves terminal invalidation, rollback, no resurrection, and fresh-Request recovery. |
| HIGH — P3C materialize/finalize replay reinterprets live actions | CLOSED | Completed replay returns the persisted P3C idempotency snapshot before any wrapper action lookup or V2 live digest computation. |
| MEDIUM — missing direct QA for the three vulnerability classes | CLOSED | Local QA performs effective ACL and real PostgREST checks, pre-issue invalidation/recovery, and post-lifecycle materialize/finalize replay assertions. |
| MEDIUM — result lookup index used the wrong operation literal | CLOSED | Physical predicate is exactly `operation = 'crm.real_conversion.execute'`; QA proves duplicate rejection and distinct legitimate lookup behavior. |

No new CRITICAL, HIGH, or blocking MEDIUM finding was found.

## 5. RPC and function ACL closure

### 5.1 Physical surface inventory

The audit resolved the actual database objects and exact identity argument
lists from `pg_proc`. The affected replacement families are:

- `f23_3e_p2b_internal_search_masked_candidates(...)`;
- `f23_3e_p2c_expire_match_review(...)` and
  `f23_3e_p2c_supersede_match_review(...)`;
- `f23_3e_p3b_internal_is_safe_result_snapshot(jsonb)` and
  `f23_3e_p3b_issue_conversion_authority(...)`;
- `f23_3e_p3c_internal_resolve_reusable_student(...)` and
  `f23_3e_p3c_internal_resolve_reusable_guardian(...)`;
- `f23_3e_p3c_materialize_reviewed_action_pair(...)` and
  `f23_3e_p3c_finalize_reviewed_action_plan(...)`.

There is exactly one physical overload for each name. All security-definer
surfaces in this set have `search_path=""`; the pure P3B snapshot validator is
not security-definer and also has `search_path=""`.

### 5.2 Effective privilege truth

Direct `has_function_privilege(role, oid, 'EXECUTE')` checks after reset/apply
produced this effective contract:

| Surface class | `PUBLIC` | `anon` | `authenticated` | `service_role` |
|---|---:|---:|---:|---:|
| P2B/P3B/P3C internal helpers above | no | no | no | no |
| P2C expire/supersede service RPCs | no | no | no | yes |
| P3B authority issuance service RPC | no | no | no | yes |
| P3C materialize/finalize service RPCs | no | no | no | yes |

The migration explicitly reestablishes these ACLs after rename/recreate. A
targeted scan found zero `f23_3e_p3d_internal_%` functions executable by
`anon`, `authenticated`, or `service_role`. Legitimate service execution is
therefore preserved without exposing internal helpers.

### 5.3 Real anon PostgREST falsification

Using only the local loopback API and local anon credential, the audit sent
real PostgREST RPC calls with the exact physical parameter names to all nine
affected functions listed above. Every call returned HTTP 401; none returned
HTTP 200. This directly closes the prior production-surface regression rather
than relying on migration text or a static `REVOKE` search.

The local QA independently repeats both effective privilege checks and anon
PostgREST denial, so future rename/recreate regressions fail the executable
test gate.

## 6. Pre-authority invalidation and fresh recovery

### 6.1 Production-reachable invalidation path

The remediated P2C expire/supersede wrappers retain the protected checkpoint
entry points and add the terminal V2 reuse-plan branch. That branch is entered
only after the inherited P2C operation has established actor, exact-center,
Request, source, review, and identity-currentness authorization. It then:

1. accepts only the exact terminal reviewed-reuse state and a single current
   V2 three-action plan;
2. verifies the issued reviewed cross-source reuse authorization bound to the
   same source, Request, review, target, center, and current versions;
3. rejects a plan that already has a conversion authority;
4. takes the required action, authorization, and reservation locks;
5. binds the terminal operation to a scoped immutable P2C idempotency record;
6. calls `f23_3e_p3d_internal_invalidate_single_plan_request(...)` in the same
   transaction.

The invalidator terminalizes the old plan's applicable actions, reuse
authorizations, active reservation, and Request, and writes matching Audit and
Outbox evidence. The terminal review remains immutable evidence; it is not
resurrected or rewritten. A failure in this composition rolls back all state,
including the idempotency completion and event pair.

### 6.2 Recovery proof

The guarded QA constructs a genuine pre-issue V2 plan, invokes the protected
P2C terminal invalidation path, and proves:

- the old Request, review, action plan, reservation, and reuse authorization
  cannot be executed again;
- no old conversion authority is fabricated or resurrected;
- an injected Outbox failure restores the exact pre-call state;
- recovery uses a different fresh Request with fresh source/currentness,
  review, reuse authorization, V2 plan, step-up/capability, P3B authority, and
  P3D execution;
- the old terminal aggregate remains terminal and unchanged.

This is a production-reachable protected transition, not direct resurrection
or `session_replication_role='replica'` state manufacture.

## 7. P3C immutable replay closure

Both remediated P3C wrappers delegate first to the checkpoint RPC. The
checkpoint RPC performs the idempotency lookup and validates the immutable
semantic binding. On an exact completed replay, the wrapper returns the
persisted result immediately. It does not inspect current action status,
recompute a V2 digest, or rehash later `APPROVED`/`EXECUTED` rows.

For each of materialize and finalize, QA proves this sequence:

```text
first successful operation
-> capture immutable committed result/digest and state vector
-> legitimately advance the action lifecycle through P3B/P3D
-> exact replay
-> byte-equivalent original result/digest
-> zero action, Request, idempotency, Audit, or Outbox mutation
```

The same idempotency key with a changed operation-intent or semantic binding
still returns `IDEMPOTENCY_CONFLICT`. Immutable replay therefore does not
weaken conflict detection. P3D executor replay also remains before live
terminal reinterpretation and does not rehash `EXECUTED` actions.

## 8. Result lookup index

The applied database reports the exact physical definition:

```sql
CREATE UNIQUE INDEX crm_idempotency_registry_p3d_result_lookup_uidx
ON public.crm_idempotency_registry
  (resource_scope_id, idempotency_key_digest)
WHERE operation = 'crm.real_conversion.execute';
```

The predicate matches the executor and immutable result-status runtime
operation exactly. Its scope prevents duplicate result identities for the
same Request/idempotency digest while allowing a distinct legitimate digest
or a different operation. The guarded QA inserts/probes both the conflicting
and allowed cases against the applied index.

## 9. Original blocker regressions

### 9.1 Genuine Request A to Request B cross-source reuse

The full QA passes the production-reachable flow:

```text
Request A / Source A
-> explicit reviewed CREATE
-> P3B authority A
-> P3D creates canonical Student, Guardian, relationship, A bindings
-> Request A completes

independent Request B / Source B
-> real P2B canonical masked match
-> explicit terminal reviewed REUSE decisions
-> immutable B/Request-B/Target reuse authorizations
-> V2 materialize/finalize
-> fresh P3B authority B
-> P3D reuses the same canonical targets and relationship
-> B bindings are created only by atomic conversion B
-> Request B completes independently
```

The happy path contains no `session_replication_role='replica'`, terminal
aggregate resurrection, direct pre-binding, or fabricated final review/action
state. The A bindings remain unchanged, the B bindings retain B provenance,
Student and Guardian are not duplicated, and A/B Audit, Outbox, idempotency,
and result identities remain independent and exact-center.

### 9.2 Identity locking and six no-relock cores

Physical executor order remains:

1. lock `center_crm_control` for the exact center;
2. derive the complete applicable Guardian and Student mutex set;
3. union and deduplicate the set;
4. order Guardian rank 1, Student rank 2, then PostgreSQL `bytea ASC`;
5. acquire identity mutexes once in that order;
6. enter the lower Request/source/review/authorization/target/binding tiers.

No identity subset is prelocked and no later path reacquires an identity
mutex. Static call-graph assertions cover all six frozen no-relock cores and
their callers.

The deterministic two-session full-executor test uses a controller-visible
barrier only after executor X physically holds the center-root row. Executor Y
is then started and `pg_blocking_pids`, `pg_locks`, and `pg_stat_activity`
prove a real PostgreSQL lock wait on X. Releasing X permits safe progress or a
finite semantic failure without deadlock or partial conversion. The seven
existing real PostgreSQL lock-wait regressions also pass.

## 10. Broader P3D regression assessment

The applied runtime and full QA retain these accepted contracts:

- Student, Guardian, and exact-center relationship create/reuse/no-target
  semantics pass without duplicate target or silent merge;
- V1 remains valid only for its frozen domain, while V1-to-V2 mismatch,
  unknown versions, reuse-authorization substitution, relationship-scope
  substitution, and downgrade attempts fail closed;
- the frozen reuse-authorization-set and relationship-scope digest domains
  and framing remain distinct and version-bound;
- representative and full early/middle/late fault injection rolls back target,
  relationship, binding, reservation, reuse authorization, conversion
  authority, Request/action lifecycle, Audit, Outbox, and idempotency state;
- P3D exact replay returns the immutable REAL_CONVERSION result before live
  terminal checks and never reconstructs from mutable business rows;
- forced RLS, no direct application-role target-table DML, exact service RPC
  grants, and no Realtime publication remain intact;
- Audit/Outbox/result/error payload checks find no birth plaintext,
  ciphertext, identity digest, mutex key, contact PII, token, secret, or Vault
  material.

## 11. P3D0 birth crypto continuity

The guarded QA and inherited P3D0 smoke reestablish:

```text
Candidate source envelope: IC3CBE01 / iC3Bth01
Student target envelope:   IC3SBE01 / iC3Std01
```

Legacy, raw, malformed, and unknown Candidate birth evidence fails closed.
The protected bridge unwraps only inside the server purpose and re-protects
under the Student target context; it does not copy source ciphertext. No birth
plaintext is persisted or emitted. Authority, identity, and crypto
environment fingerprints remain three independent domains; no fourth domain
was introduced and no cross-domain equality is required.

## 12. Executed verification

The following gates were rerun in this independent audit:

```text
node --check P3D semantic smoke: PASS
node --check P3D local DB QA: PASS
P3D semantic smoke: PASS
P3D artifact count: 4
P3D forward migration count: 1
P3D new business table count: 0
P3D external service RPC count: 2
P3D inherited migration hashes: 16/16 PASS
P3D full guarded local Docker QA: PASS (168.2 seconds)
real PostgreSQL lock waits: 7
two-executor center-root barrier/wait: PASS
independent effective ACL catalog probe: PASS
independent anon PostgREST probe: 9/9 DENIED (HTTP 401)
relevant inherited semantic regressions: 10/10 PASS
```

The full runner additionally reports PASS for genuine A-to-B reuse,
pre-issue invalidation and fresh recovery, invalidation fault rollback,
post-lifecycle P3C materialize/finalize replay, result lookup uniqueness,
P3D exact replay/conflict, V1/V2 substitution/downgrade, full fault rollback,
P3D0 crypto, privacy/RLS/grants, and the create/reuse/no-target matrix.

## 13. Final cleanup

After the runner's final reset, an independent database query returned zero
for every audited residue class:

```text
auth.users: 0
vault.secrets: 0
student_profile: 0
guardian_profile: 0
crm_identity_target_binding: 0
guardian_student_relationship: 0
crm_reviewed_cross_source_reuse_authorization: 0
crm_idempotency_registry REAL_CONVERSION results: 0
temporary p3d_qa functions: 0
temporary p3d_qa triggers: 0
```

The P3D migration remains applied in the local migration ledger. No synthetic
Auth, Vault, target, result, recovery, replay, fault, or barrier fixture remains.

## 14. Findings summary

```text
CRITICAL findings: 0
HIGH findings: 0
blocking MEDIUM findings: 0
LOW findings: 0
INFORMATIONAL: the canonical handoff and implementation report are historical
               pre-closeout evidence; this audit report is the current
               technical-acceptance evidence until mechanical closeout.
new blocking technical defect: NO
implementation modified during audit: NO
roadmap modified: NO
commit: NO
push: NO
remote apply/deploy: NO
P4: NOT STARTED
```

## 15. Acceptance checklist

All 31 acceptance conditions from the audit prompt pass:

- recreated functions have correct effective ACLs and real anon denial;
- intended service execution remains available;
- pre-issue invalidation, rollback, no-resurrection, and fresh recovery pass;
- P3C materialize/finalize and P3D executor replay are immutable;
- semantic mismatch remains `IDEMPOTENCY_CONFLICT`;
- the runtime-operation index is exact and its uniqueness behavior passes;
- genuine cross-source reuse and independent provenance pass;
- one-pass mixed-kind mutex ordering, six no-relock cores, root serialization,
  seven lock waits, and the genuine two-session root wait pass;
- Student, Guardian, Relationship, V1/V2, digest, substitution, atomicity,
  P3D0, privacy, RLS/grants, smoke, local QA, inherited regressions, inherited
  hashes, SHA identity, and final cleanup all pass.

This verdict is backend/local technical acceptance only. It does not mark P3D
DONE, apply the migration remotely, authorize deploy, start P4, or establish
product end-to-end readiness.

```text
F23.3E-P3D EXTERNAL TECHNICAL RE-AUDIT: PASS
P3D TECHNICAL ACCEPTANCE: PASS
P3D DONE: NO — CLOSEOUT/CHECKPOINT PENDING
NEXT GATE: P3D CLOSEOUT / ROADMAP UPDATE / CHECKPOINT / COMMIT-PUSH
```

F23.3E-P3D EXTERNAL TECHNICAL RE-AUDIT PASS — READY FOR P3D CLOSEOUT / ROADMAP UPDATE / CHECKPOINT / COMMIT-PUSH
