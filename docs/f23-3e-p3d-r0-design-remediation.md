# F23.3E-P3D-R0 Design Remediation

## 1. Status / Scope / Non-goals

```text
P3D implementation exists
-> original local Docker QA reported PASS
-> external technical audit BLOCKED -- DESIGN CONFLICT
-> P3D-R0 initial design was written
-> independent P3D-R0 design audit BLOCKED
-> independent P3D-R0 design re-audit BLOCKED on 4 HIGH + 2 MEDIUM findings
-> this final closure revision closes those six findings at design level
-> final independent design re-audit is required

P3D is NOT DONE
P4 is NOT STARTED
```

```text
P3D-R0 FINAL DESIGN CLOSURE REVISION
Latest independent re-audit result: BLOCKED
Revision objective: CLOSE 4 HIGH + 2 MEDIUM REMAINING FINDINGS
Final independent re-audit required: YES

P3D-R0 FINAL DESIGN CLOSURE: READY FOR FINAL INDEPENDENT DESIGN RE-AUDIT
P3A_NORMATIVE_REOPEN_REQUIRED: NO
FROZEN_NORMATIVE_SEMANTICS_REOPEN_REQUIRED: YES
```

The non-P3A reopen is bounded to forward extensions of P2B masked canonical
search, P2C reviewed reuse decisions and reviewer provenance, P3C action-plan
materialization/finalization and composition internals, P3B digest/capability/
authority dispatch, and P3D execution. No checkpoint migration is edited.

This document is a design contract. It does not implement SQL, change the four
blocked P3D artifacts, update the roadmap, apply remotely, open P4, or assert
that P3D has passed a new implementation or external audit.

## 2. Verified Repo Baseline

The revision was authored against this verified local state:

```text
branch: main
HEAD: 6879df4c5904db1b427eb974eaa099724f3f6a28
origin/main: 6879df4c5904db1b427eb974eaa099724f3f6a28
tracked modifications before revision: 0
staged files: 0
blocked P3D migration SHA-256:
35C43A650060CB84A3233B5543076967B4B26F5E66A30998716D7FCF2BBDAA31
remote apply: NOT RUN
```

The blocked SHA identifies an uncommitted rejected candidate, not an accepted
checkpoint hash. The seven untracked artifacts at final-revision start were the
four blocked P3D package files, this design, and the two independent audit
reports.

## 3. Existing Contract Map

| Layer | Physical contract and consequence |
|---|---|
| P2A | `crm_identity_match_mutex` stores immutable `(center_id, identity_kind, identity_match_mutex_key)` resources and has `crm_identity_match_mutex_lock_order_idx(center_id, identity_kind, identity_match_mutex_key)`. `crm_identity_match_review` binds Request/source/target/policy/evidence/mutex/projection state, `reviewer_user_id`, one legacy `reviewer_authority_version`, expiry and `review_version`. Its target/evidence tuple is immutable and terminal reviews are immutable. `crm_profile_creation_reservation` is create-only and has a guarded single-use lifecycle. |
| P2B | `f23_3e_p2b_internal_search_masked_candidates`, `f23_3e_p2b_search_masked_candidates`, and `f23_3e_p2b_get_masked_candidate_review_detail` expose exact-center masked candidates. The P3C replacement currently sets `reuse_eligible=true` only when the current source itself has a current `ACTIVE` `crm_identity_target_binding` to the canonical target. Same-name-plus-birth and Contact evidence remain review signals, not automatic merge authority. |
| P2C | `f23_3e_p2c_internal_execute_mutation` and its existing wrappers own review creation/decision/expiry/supersession and create reservations. Current `REUSE_EXISTING` requires the selected candidate's current source binding, which makes new-source reuse circular. It currently writes `reviewer_authority_version` from `source_assignment_version` for every role and does not persist membership provenance. |
| P3A | The canonical order begins `CENTER_CRM_CONTROL_ROW`, then `SORTED_IDENTITY_MUTEX_ROWS`. Student uses display-name and birth keys; Guardian uses display-name, every Contact lookup digest, and source-Contact binding keys. Exact replay is snapshot-only. Audit and Outbox are atomic. |
| P3B | `crm_conversion_action` has three typed action rows and guarded `PROPOSED -> REVIEWED -> APPROVED -> EXECUTED` versions. `f23_3e_p3b_internal_action_set_digest(uuid,text)` is the immutable V1 serializer. `crm_conversion_authority.p3_action_set_encoding_version` and `.p3_action_set_digest` bind the post-APPROVED rows. `f23_3e_p3b_issue_conversion_authority` uses center root `FOR UPDATE`, then whole-center mutex order `(identity_kind,key)`. |
| P3C | `student_profile`, `guardian_profile`, `crm_identity_target_binding`, and `guardian_student_relationship` are forced-RLS protected aggregates. `crm_identity_target_binding` records exact source provenance and only one `ACTIVE` binding per source. `f23_3e_p3c_internal_resolve_reusable_student` and `_guardian` require that binding to originate from the current review/Request, causing the cross-source circularity. Materialize/finalize and the relationship writer use center root `FOR UPDATE` then `(identity_kind,key)`. Target and relationship helpers currently acquire root/mutex locks themselves. |
| P3C0 | Contact-source and Guardian-target crypto use the independent P3C crypto environment. Legacy/unknown Contact bytes fail closed. Source ciphertext is unwrapped and re-protected for the Guardian target; direct copy is forbidden. |
| P3D0 | Candidate birth `IC3CBE01/iC3Bth01` and Student birth `IC3SBE01/iC3Std01` use the P3C crypto environment. Stage A is read-only purpose-bound protected precheck; Stage B rechecks under canonical locks. No fourth environment domain and no plaintext persistence or event/result/log disclosure are allowed. |
| Blocked P3D | `f23_3e_p3d_execute_conversion` currently locks a Student subset and later all active mutexes, then calls P3C helpers that relock. Its QA fabricates reuse by `session_replication_role='replica'`. That implementation and claimed reuse QA are rejected evidence. |

The physical root behavior is also material: P2B/P2C, P3B authority issuance,
P3C materialize/finalize/relationship composition, and the blocked P3D executor
all take `center_crm_control ... FOR UPDATE` before any identity mutex.

## 4. Independent-audit Finding Closure Matrix

| Finding | Physical current contract | Revision decision and normative consequence | Status |
|---|---|---|---|
| HIGH-1 center-root vs concurrency | Same-center production flows acquire one root row `FOR UPDATE` before mutexes. | Preserve the exclusive root. Full same-center executors are serialized at tier 0, so a claimed identity-tier wait is impossible. Future QA observes the real root wait and separately falsifies one-pass ordering structurally and at the primitive resource layer. | CLOSED BY REVISION |
| HIGH-2 mixed-kind order | Whole-center P3B/P3C uses `(identity_kind,key)`; initial R0 used bare `bytea`. | Canonical resource is `(kind,key)`. Rank `GUARDIAN=1`, `STUDENT=2`, then PostgreSQL `bytea ASC`; dedupe uses the same tuple. Forward-replaced whole-center lockers use this explicit comparator. | CLOSED BY REVISION |
| HIGH-3 no-relock graph | Current Student/Guardian/relationship helpers own root/mutex locks. | Section 13 freezes six exact named SQL interfaces, per-core caller-held locks/currentness, allowed transitive leaves and finite outcomes. Identity-mutex access is `NONE` throughout the transitive graph. | CLOSED BY FINAL REVISION |
| HIGH-4A reviewer provenance | P2A requires every reviewer field null while PENDING; the human decider is known only on terminalization. | Supporting-target provenance is stored at PENDING creation. All `reviewer_*` fields stay null until the exact PENDING-v1 to terminal-v2 update and are filled once from that terminal actor. | CLOSED BY FINAL REVISION |
| HIGH-4B invalidation/recovery | Physical P3C permits one three-action plan per Request and P3B counts every Request action, so retaining multiple generations would strand or invalidate the Request. | Use the single-plan Request model. Invalidation terminalizes the authorization, all three actions, active reservations, any issued conversion authority and the Request; recovery always starts a fresh Request. No generation query is invented. | CLOSED BY FINAL REVISION |
| HIGH-5 V1/V2 digest coexistence | The fixed two-argument P3B function means V1 only. | Preserve that function byte-for-byte semantically as V1. Add an explicit versioned dispatcher and V2 serializer; persist one encoding version on every action/authority/result binding. No inferred dispatch. | CLOSED BY REVISION |
| NEW-HIGH auxiliary authority digests | `relationship_scope_digest` and the reuse-authorization-set digest were semantic labels without canonical bytes. | Section 8 freezes distinct domains, binary framing, schema versions, nullable encoding, exact tuple fields/order, row selection and persisted authority/action bindings. | CLOSED BY FINAL REVISION |
| MEDIUM-1 supporting binding/masking | Search only recognizes current-source binding. | Section 7 freezes eligible historical support, oldest deterministic selection, server-only binding identity and the exact two-field masked extension. | CLOSED BY REVISION |
| MEDIUM-2 events | No authorization event vocabulary exists. | Section 6 reuses the exact physical `f23_3e_p3b_internal_append_audit_outbox(...)` writer, freezes three lifecycle events and its existing exact safe-payload shape including `safe_reason_code`. | CLOSED BY FINAL REVISION |
| MEDIUM-3 artifact inventory | The blocked smoke's broad P3D phase regex can count R0 docs. | Future smoke uses an exact four-path allowlist and separately classifies design/audit docs; migration and inherited hashes remain strict. | CLOSED BY REVISION |
| MEDIUM-4 root-wait orchestration | Starting two calls after a sleep cannot prove X still owns tier 0. | Section 18 freezes a local-postgres-only temporary-table plus advisory-lock barrier placed immediately after X acquires the real root; the controller observes readiness before starting Y. | CLOSED BY FINAL REVISION |

No normative finding is deferred to implementation.

## 5. Reviewed Cross-Source Reuse Authorization -- Normative Model

The three records are deliberately non-substitutable:

```text
binding A->T
!= reviewed reuse authorization B / Request-B / T
!= binding B->T
```

`binding A->T` proves only historical Source-A provenance. P2B may use that
current binding to support a masked candidate, but it grants Source B no right.
P2C's terminal human decision is the reviewed fact for B. P3C materialization,
which occurs only after that decision, creates the separate authorization.
Only the successful atomic P3D commit creates `binding B->T`; no review or plan
operation pre-binds B and no row belonging to A is rewritten.

The P3D-era migration adds protected support aggregate
`crm_reviewed_cross_source_reuse_authorization` with this exact logical schema:

```text
reviewed_reuse_authorization_id uuid primary key
center_id text not null
identity_kind text not null                 -- STUDENT | GUARDIAN
conversion_request_id uuid not null
reviewed_request_version integer not null
p2_action_id uuid not null
action_intent_digest bytea not null          -- exactly 32 bytes
legacy_request_action_graph_digest bytea not null -- exactly 32 bytes
source_contact_id uuid null
source_contact_version integer null
source_candidate_student_id uuid null
source_candidate_version integer null
consultation_case_id uuid not null
source_case_version integer not null
match_review_id uuid not null
review_version integer not null
reviewed_by_actor_user_id uuid not null
reviewed_at timestamptz not null
reviewer_membership_id uuid not null
reviewer_membership_version integer not null
reviewer_role text not null                  -- owner | center_admin | consultant
reviewer_assignment_id uuid null
reviewer_assignment_version integer null
target_adapter_namespace text not null
opaque_target_id uuid not null
expected_target_version integer not null
supporting_identity_target_binding_id uuid not null
supporting_binding_version integer not null
supporting_binding_source_version integer not null
supporting_binding_target_version integer not null
identity_policy_registry_id uuid not null
normalization_version integer not null
match_policy_version integer not null
minimum_evidence_policy_version integer not null
identity_environment_fingerprint bytea not null -- exactly 32 bytes
evidence_set_digest bytea not null           -- exactly 32 bytes
identity_mutex_keys_digest bytea not null    -- exactly 32 bytes
projection_snapshot_digest bytea not null    -- exactly 32 bytes
conversion_action_id uuid not null
relationship_scope_encoding_version integer null
relationship_scope_digest bytea null         -- null together, otherwise 32 bytes
related_student_target_id uuid null
related_student_expected_version integer null
related_student_disposition text null        -- CREATE | REUSE | NONE
status text not null                         -- ISSUED | CONSUMED | INVALIDATED
authorization_version integer not null
issued_at timestamptz not null
expires_at timestamptz not null
terminal_at timestamptz null
terminal_reason_code text null
consumed_idempotency_record_id uuid null
invalidated_by_operation text null
```

Student rows bind Candidate source and Student target; their Contact source
columns still bind the Request's Contact but `source_candidate_student_id` is
the identity-source discriminator. Guardian rows bind Contact source and
Guardian target. Guardian rows additionally require relationship-scope version
1/digest and the exact Student endpoint/disposition. Student relationship-scope
columns are null. Section 8 defines the only accepted digest bytes.

Exact-center/version foreign keys cover Request, terminal review, target,
supporting binding, reviewer membership, optional reviewer assignment and P3
action; `reviewed_by_actor_user_id` references `auth.users`. The action/authorization mutual references are
deferrable and their UUIDs are generated before one atomic materialization.
Every semantic/currentness/reviewer/digest field is immutable. The guard permits
only lifecycle status/version/time/reason/idempotency fields to change.

Physical uniqueness is fail closed:

- at most one `ISSUED` row per `(center_id, identity_kind,
  coalesce(source_contact_id,source_candidate_student_id))`, implemented as
  separate Student and Guardian partial unique indexes rather than a nullable
  expression shortcut;
- at most one `ISSUED` row per
  `(center_id, conversion_request_id, identity_kind)`;
- exactly one Student and at most one Guardian authorization may be referenced
  by the three-action plan;
- terminal rows never become `ISSUED` again; no index predicate depends on
  wall-clock time;
- consumption requires exact `ISSUED v1` and one P3D idempotency reference.

## 6. Authorization Lifecycle, Reviewer Provenance and Events

### Creation point and circularity closure

```text
P2B strong masked candidate search
-> P2C creates PENDING review with target/supporting-binding evidence only
-> terminal P2C human REUSE_EXISTING decision fills reviewer provenance
-> P3C materialize inserts authorization ISSUED v1 and PROPOSED action v1
-> P3C finalize transitions actions to REVIEWED v2, then hashes
-> P3B transitions Request/actions to APPROVED and issues authority
-> P3D creates binding B->T and consumes authorization atomically
```

No reuse authorization row exists before the terminal human decision. The
authorization is therefore never a PENDING shell and never derives reviewer
authority from the actor who created the PENDING review.

### Canonical terminal-decision reviewer provenance

The forward migration adds these nullable review columns:

```text
reviewer_membership_id uuid
reviewer_membership_version integer
reviewer_role text
reviewer_assignment_id uuid
reviewer_assignment_version integer
supporting_identity_target_binding_id uuid
supporting_binding_version integer
```

`supporting_identity_target_binding_id` and `supporting_binding_version` are
selected server-side and written immutably when P2C creates the PENDING review.
All five new `reviewer_*` fields, the physical `reviewer_user_id`, physical
`reviewer_authority_version`, and `decided_at` MUST be null while
`review_status='PENDING'`. The only fill is the same guarded update that changes
`PENDING v1` to `EXACT_REVIEWED_MATCH v2` with
`review_action='REUSE_EXISTING'`. That update sets:

```text
reviewer_user_id                = terminal decision actor
reviewer_membership_id          = locked center_members.id for that actor
reviewer_membership_version     = locked center_members.membership_version
reviewer_role                   = locked normalized role
reviewer_assignment_id          = Request assignment for consultant, else NULL
reviewer_assignment_version     = locked assignment version for consultant, else NULL
reviewer_authority_version      = physical source_assignment_version (legacy meaning)
decided_at                      = transaction_timestamp()
review_version                  = 2
```

The replacement P2A guard permits exactly that null-to-value fill on the one
PENDING-to-terminal transition and thereafter treats all fields as immutable.
It rejects reviewer fields on INSERT, any PENDING-row update that fills them,
partial owner/admin or consultant shapes, and any later rewrite. The
authorization copies `reviewer_user_id` to `reviewed_by_actor_user_id` and
copies `decided_at` to `reviewed_at`; it never uses row creator or materializer
actor as reviewer provenance.

At terminal decision, owner/center-admin requires current ACTIVE exact-center
membership. Consultant additionally requires the Request's ACTIVE assignment
to that same user. P3C materialize/finalize and P3B issuance recheck those
captured membership/assignment versions. After P3B issuance they are immutable
historical proof; later reviewer departure does not retroactively erase the
review. P3D instead rechecks the independent current P3B actor, security,
session, membership, capability, consumed step-up and conversion authority.

### Minimal lifecycle and single-plan recovery

The only persisted authorization states are:

```text
ISSUED v1 -> CONSUMED v2
ISSUED v1 -> INVALIDATED v2
```

`CONSUMED` and `INVALIDATED` are terminal and immutable. `expires_at` is a
currentness boundary, not another status: an `ISSUED` row at or after that
server time is immediately non-executable even before persisted invalidation.
No REVOKED/EXPIRED/SUPERSEDED authorization state or action generation is
introduced.

P3C sets Student authorization `expires_at` exactly to the bound Student
terminal review's `expires_at`. Guardian authorization uses
`least(guardian_review.expires_at,student_review.expires_at)` because its scope
binds both endpoints. P3B conversion-authority expiry remains the least of its
physical five-minute ceiling, consumed step-up expiry and every referenced
reuse-authorization expiry. Server time equal to expiry is invalid.

The physical repo permits exactly one three-action plan per Request and P3B
counts all Request actions. The final recovery model is therefore
**single-plan Request**, not generations:

- before P3B authority issuance, the terminal-review branches added to the
  existing-signature `f23_3e_p2c_expire_match_review(...)` and
  `f23_3e_p2c_supersede_match_review(...)` are the protected recovery entry
  points. They leave the terminal review immutable, but call
  `f23_3e_p3d_internal_invalidate_single_plan_request`;
- after P3B authority issuance, the existing-signature
  `f23_3e_p3b_revoke_or_expire_conversion_authority(...)` is the only recovery
  entry point and calls the same internal invalidator in its transaction;
- P3C finalize, P3B issue and P3D first execution only detect currentness and
  fail closed. They never silently repair or rewrite history. The caller uses
  the applicable protected recovery entry point.

The internal invalidator has this exact interface (both P2C and P3B owners pass
their currently authorized RPC `p_actor_user_id`; this event actor is distinct
from immutable historical terminal-review provenance):

```sql
f23_3e_p3d_internal_invalidate_single_plan_request(
  p_center_id text,
  p_conversion_request_id uuid,
  p_expected_request_version integer,
  p_conversion_authority_id uuid,
  p_expected_authority_version integer,
  p_conversion_authority_terminal_status text,
  p_event_actor_user_id uuid,
  p_invalidation_reason_code text,
  p_operation text,
  p_correlation_id uuid
) returns table (
  request_status text,
  request_version integer,
  invalidated_authorization_count integer,
  superseded_action_count integer,
  terminalized_reservation_count integer
)
```

The authority ID/version/status are all null pre-issue. Post-issue they are all
non-null and terminal status is exactly `REVOKED|EXPIRED`, copied from the
existing RPC's `p_requested_transition`.
Its sole callers are the three existing protected RPC bodies named above,
after they hold the center root, complete mutex pass and all affected rows in
the canonical order. It acquires no earlier-tier lock. In one transaction it:

1. changes every bound reuse authorization `ISSUED v1 -> INVALIDATED v2`;
2. changes exactly three PROPOSED/REVIEWED/APPROVED actions to `SUPERSEDED +1`;
3. terminalizes every ACTIVE create reservation as `SUPERSEDED +1` (or
   `EXPIRED +1` only when server time already passed its expiry);
4. post-issue, changes the exact conversion authority from `ISSUED` to the
   existing RPC's caller-requested physical `REVOKED|EXPIRED +1`;
5. changes Request `READY_FOR_REVIEW|APPROVED -> SUPERSEDED +1` under the new
   protected guard setting `ichess.p3d_plan_invalidation='on'`;
6. writes the finite events and returns the counts above.

It requires exact expected versions, exactly three same-Request actions and no
CONSUMED authorization. Any count/version mismatch aborts. Existing completed
materialize/finalize/authority idempotency snapshots remain immutable history;
the invoking expire/supersede/revoke idempotency row records this terminal
result. Recovery always creates a fresh Request with fresh reviews, plan,
step-up and conversion authority. The old Request or authority is never
resurrected. Until invalidation is persisted, expiry/staleness still denies
finalize, issuance and P3D, so no obsolete plan remains executable.

Exact invalidation offsets are:

| Point | Required pre-state | Atomic terminal post-state |
|---|---|---|
| after materialize, before finalize | Request `READY_FOR_REVIEW vRq`; three `PROPOSED v1`; reuse auth `ISSUED v1`; no conversion authority | Request `SUPERSEDED vRq+1`; actions `SUPERSEDED v2`; auth `INVALIDATED v2` |
| after finalize, before P3B issue | Request `READY_FOR_REVIEW vRq`; three `REVIEWED v2`; reuse auth `ISSUED v1`; no conversion authority | Request `SUPERSEDED vRq+1`; actions `SUPERSEDED v3`; auth `INVALIDATED v2` |
| after P3B issue | Request `APPROVED vRq+1`; three `APPROVED v3`; reuse auth `ISSUED v1`; authority `ISSUED v1` | Request `SUPERSEDED vRq+2`; actions `SUPERSEDED v4`; auth `INVALIDATED v2`; authority `REVOKED|EXPIRED v2` |

The pre-issue P2C operation's existing scoped idempotency key additionally
binds terminal review ID/version, Request expected version, reason and exact
action/auth IDs/versions. P3B post-issue keeps its existing environment,
authority/version, requested-transition, reason and intent binding and adds the
same action/auth tuple. Same key with any changed binding conflicts. Exact
completed invalidation replay returns its immutable terminal snapshot and
does not repeat versions or events.

Both P2C branches return
`CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED`. The P3B branch
retains physical `CONVERSION_AUTHORITY_REVOKED` or
`CONVERSION_AUTHORITY_EXPIRED` and extends its strict snapshot with
`request_status='SUPERSEDED'` plus the three exact counts returned above. No
generic JSON or arbitrary SQL error enters either result.

The P2C completed snapshot remains in its existing typed family: resource kind
is `identity_match_review`, resource ID/version/status are the unchanged
terminal review (`v2/EXACT_REVIEWED_MATCH`), opaque target remains the reviewed
target, expiry remains that review's expiry, and the only new allowed outcome
is `CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED`. The strict
registry guard is forward-extended for that finite outcome and for the added
operation-binding action/auth tuple; it never reconstructs the invalidated
Request from live state on exact replay.

Only successful P3D moves `ISSUED v1 -> CONSUMED v2`, after target,
relationship and B-binding composition, in the same transaction as all
terminal state and immutable result. Rollback restores `ISSUED v1`. Exact
replay returns the immutable result before checking the consumed row.

### Exact canonical Audit/Outbox writer

Authorization lifecycle events MUST use the existing physical writer; no
parallel event mechanism is created:

```sql
public.f23_3e_p3b_internal_append_audit_outbox(
  p_center_id text,
  p_event_type text,
  p_actor_user_id uuid,
  p_resource_kind text,
  p_resource_id uuid,
  p_request_id uuid,
  p_assignment_id uuid,
  p_previous_version integer,
  p_new_version integer,
  p_status text,
  p_safe_reason_code text,
  p_operation text,
  p_outcome_code text,
  p_correlation_id uuid
) returns void
```

Its body remains the canonical writer. Only P1A/P1C safe event/resource/payload
validators are forward-extended as a strict superset. The finite calls are:

| Transition owner | Event type | Operation | Outcome | Safe reason(s) |
|---|---|---|---|---|
| P3C materialize, insert `ISSUED v1` | `crm.identity.cross_source_reuse_authorization.issued` | `conversion.materialize_action_plan` | `CROSS_SOURCE_REUSE_AUTHORIZATION_ISSUED` | `explicit_human_reviewed_reuse` |
| P2C/P3B invalidator, `ISSUED v1 -> INVALIDATED v2` | `crm.identity.cross_source_reuse_authorization.invalidated` | exact invoking P2C/P3B operation | `CROSS_SOURCE_REUSE_AUTHORIZATION_INVALIDATED` | `authorization_expired`, `review_or_source_stale`, `target_or_support_stale`, `relationship_scope_stale`, `plan_superseded`, `conversion_authority_terminal` |
| P3D, `ISSUED v1 -> CONSUMED v2` | `crm.identity.cross_source_reuse_authorization.consumed` | `crm.real_conversion.execute` | `CROSS_SOURCE_REUSE_AUTHORIZATION_CONSUMED` | `real_conversion_completed` |

Single-plan invalidation also emits, through the same writer and correlation,
these exact finite events for the other mutations (one plan event covers the
three action transitions; it does not expose action data):

| Resource transition | Event type | Outcome | Safe reason(s) |
|---|---|---|---|
| three actions -> `SUPERSEDED` | `crm.conversion.action-plan.invalidated` on action-plan aggregate/Request UUID, common new action version | `CONVERSION_ACTION_PLAN_INVALIDATED` | same finite invalidation reason passed above |
| Request -> `SUPERSEDED` | `crm.conversion-request.superseded` | `CONVERSION_REQUEST_SUPERSEDED` | same finite invalidation reason passed above |
| each ACTIVE reservation -> `SUPERSEDED` | `crm.identity.creation_reservation_superseded` | `CREATION_RESERVATION_SUPERSEDED` | `plan_superseded` |
| each server-expired ACTIVE reservation -> `EXPIRED` | existing `crm.identity.creation_reservation_expired` | existing `CREATION_RESERVATION_EXPIRED` | existing `SERVER_TIME_EXPIRED` mapping |

The plan event uses resource kind `crm_conversion_action_plan`, Request UUID,
status `SUPERSEDED`, and the common previous/new action version (the invalidator
requires all three actions start at the same version). The Request event uses
resource kind `crm_conversion_request`, Request UUID and exact Request
previous/new version. Both use the invoking P2C/P3B operation. Reservation events use
`profile_creation_reservation`, reservation UUID and exact reservation
versions/status. These resource kinds follow the physical P3C action-plan and
P1B Request event indexes, so there is no aggregate/version collision.

Post-issue conversion-authority transition remains owned/emitted by the
existing P3B RPC as physical
`security.conversion-authority.revoked|expired`; the invalidator must not emit a
duplicate authority event. Validator additions are limited to the new exact
types/outcomes/reasons listed in this section; existing shapes stay accepted.

For every call: `p_resource_kind` is
`crm_reviewed_cross_source_reuse_authorization`; resource ID is authorization
UUID; Request and Request assignment IDs are supplied; previous/new versions
are null/1 for issue and 1/2 for terminal transitions; status is exactly
`ISSUED|INVALIDATED|CONSUMED`; one operation correlation UUID is reused.

The existing writer produces exactly this `safe_payload` schema version 1:

```text
event_schema_version
resource_kind
resource_id
new_version
status
safe_reason_code
correlation_id
operation
outcome_code
request_id
assignment_id
previous_version                 -- absent only for insert
```

No custom `transition_code`, target/source/supporting-binding ID, reviewer ID,
PII, ciphertext, digest, mutex key, secret or Vault material is added. The
Outbox row carries event type/version outside the payload. The forward migration
adds exact partial unique index
`crm_outbox_event_p3d_reuse_authorization_version_uidx` on
`(center_id,aggregate_kind,aggregate_id,event_version)` where
`aggregate_kind='crm_reviewed_cross_source_reuse_authorization'`. Existing P1B,
P2C and P3C event indexes remain unchanged. Audit or Outbox failure rolls back
the complete issuing, invalidating or consuming transaction.

## 7. P2B/P2C/P3C/P3B/P3D Integration

### Deterministic supporting binding

The protected helper
`f23_3e_p3d_r0_internal_select_supporting_identity_target_binding` receives
exact center, identity kind, canonical target ID/version and current Source B.
The eligible set contains only:

- same-center `ACTIVE` `crm_identity_target_binding` rows for that target/kind;
- a source different from Source B;
- `target_version_at_binding` equal to the current ACTIVE canonical target
  version;
- an originating Request still `COMPLETED` and action still `EXECUTED`;
- a current binding version and exact source/target shape.

Selection is `ORDER BY created_at ASC, identity_target_binding_id ASC LIMIT 1`.
UUID comparison uses PostgreSQL UUID order. A later binding cannot displace the
oldest current binding. If the selected binding terminalizes or its target
version drifts, P2C/P3C re-selection differs and the review/authorization is
stale. The raw binding ID/version are server-only and are stored in the review
and authorization; they are never returned in the masked service response.

### Exact masked response

P2B external signatures remain unchanged. Existing candidate fields remain
unchanged. Exactly two new candidate fields are permitted:

```text
reuse_review_mode:
  NONE | EXACT_SOURCE_ACTIVE_BINDING | CROSS_SOURCE_EXPLICIT_REVIEW
explicit_human_review_required: true
```

For cross-source evidence, existing `reuse_eligible` remains `false`; top-level
match remains `PROBABLE_MATCH/MATCH_REVIEW_REQUIRED`. No supporting binding ID,
source-A ID/PII, plaintext/ciphertext, digest, mutex key or new raw target data
is returned. `CROSS_SOURCE_EXPLICIT_REVIEW` is emitted only after the same
exact-center capability, minimum-evidence, canonical adapter/current target,
strong-evidence and masked-detail gates that already permit the candidate to be
shown. Weak/multiple/conflicting evidence remains review/conflict without this
mode. Safe negative responses do not distinguish absent target from unavailable
adapter/policy. This does not create an enumeration oracle.

P2C re-runs the protected selector when creating the review and again after the
human chooses the already masked target; it does not trust a caller-supplied
binding handle. The PENDING review stores only the selected supporting binding
ID/version and immutable target/evidence tuple. Every reviewer field remains
null. The terminal cross-source decision requires the same target/version,
same deterministic supporting binding, same source and evidence/policy tuple,
then fills reviewer provenance from the actual terminal actor exactly once.

### P3C and P3B

P3C materialize accepts only terminal `EXACT_REVIEWED_MATCH/REUSE_EXISTING`
reviews. Exact-source rows continue through the current binding rule. A
cross-source row must carry the P2C support/provenance fields; P3C validates the
supporting A binding but issues the separate authorization for B. It generates
authorization/action IDs, binds the full relationship scope, inserts both
atomically, and returns them only through its immutable result. The safe
materialization snapshot adds exactly nullable
`student_reuse_authorization_id`, `student_reuse_authorization_version`,
`guardian_reuse_authorization_id`, `guardian_reuse_authorization_version`, and
the explicit `action_set_encoding_version`; no source/support/evidence data is
returned. The `crm_idempotency_registry` result-shape validator is extended for
that exact schema rather than generalized. Finalize
requires every V2 authorization `ISSUED v1`, unexpired and current before moving
actions to `REVIEWED v2` and hashing.

P3B capability rechecks authorization, reviewer validity through issuance,
source/review/target/supporting binding/current policy and relationship scope.
It moves Request/actions to APPROVED first, then computes the selected versioned
action digest and the section-8 binary reuse-authorization-set digest. It stores
both exact encoding versions/digests on `crm_conversion_authority` and limits
authority expiry to the earliest bound reuse-authorization expiry. Existing
current execution authority, step-up, membership/security and exact-center
checks remain unchanged.

P3D exact replay remains before all live state. First execution validates the
same explicit encoding, recomputes APPROVED action digest, locks and validates
the authorization set, composes targets/relationship, creates B bindings,
consumes authorizations and terminalizes the conversion atomically.

## 8. Exact Version Equations and Digest Coexistence

Let `Rq` be the Request version at P2C review creation/decision. No P2C or P3C
plan operation changes Request version.

| Gate | Precondition | Transition | Persisted/bound post-state |
|---|---|---|---|
| P2C decision | Request `READY_FOR_REVIEW vRq`; review `PENDING v1` storing `request_version=Rq` | review -> `EXACT_REVIEWED_MATCH v2` | review and future authorization bind `reviewed_request_version=Rq`, `review_version=2` |
| P3C materialize | Request still `vRq`; review `v2`; no actions | authorization insert `ISSUED v1`; actions insert `PROPOSED v1` | each cross-source action stores authorization ID and expected version `1`; all actions store encoding `E` |
| P3C finalize | Request `vRq`; actions `PROPOSED v1`; auth `ISSUED v1` | all actions -> `REVIEWED v2`, then digest | finalized digest is over persisted `REVIEWED v2`; auth remains v1 |
| P3B issue | Request `READY_FOR_REVIEW vRq`; actions `REVIEWED v2`; auth `ISSUED v1` | step-up consumed; Request -> `APPROVED vRq+1`; actions -> `APPROVED v3`; then digest/authority insert | conversion authority `ISSUED v1` binds approved Request `Rq+1`, action encoding `E`, APPROVED digest and auth-set digest |
| P3D first attempt | Request `APPROVED vRq+1`; actions `APPROVED v3`; conversion authority `v1`; reuse auth `ISSUED v1` | Request -> `EXECUTING vRq+2`; compose; actions -> `EXECUTED v4`; Request -> `COMPLETED vRq+3`; reuse auth -> `CONSUMED v2`; conversion authority -> `CONSUMED v2` | immutable result stores terminal versions |

Any extra Request/action increment breaks these equations and fails closed. P3D
does not compare an authorization's `reviewed_request_version=Rq` directly to
the approved Request; it requires exactly `Request.version = Rq + 1` and the
P3B authority's approved version. An action binds authorization expected version
1 through execution; consumption to 2 occurs only after APPROVED digest recheck.

### V1/V2 serializer dispatch

The existing `f23_3e_p3b_internal_action_set_digest(uuid,text)` remains the V1
serializer and keeps its exact V1 domain, fields and bytes. It is never silently
redefined as V2.

The forward migration adds:

```text
crm_conversion_action.action_set_encoding_version integer not null default 1
crm_conversion_action.reviewed_reuse_authorization_id uuid nullable
crm_conversion_action.expected_reuse_authorization_version integer nullable
crm_conversion_action.relationship_scope_encoding_version integer nullable
crm_conversion_action.relationship_scope_digest bytea nullable
crm_conversion_action.reuse_authorization_set_encoding_version integer nullable
crm_conversion_action.reuse_authorization_set_digest bytea nullable

crm_conversion_authority.p3_reuse_authorization_set_encoding_version integer nullable
crm_conversion_authority.p3_reuse_authorization_set_digest bytea nullable

crm_idempotency_registry.p3_reuse_authorization_set_encoding_version integer nullable
crm_idempotency_registry.p3_reuse_authorization_set_digest bytea nullable

f23_3e_p3d_internal_action_set_digest_v2(uuid,text) returns bytea
f23_3e_p3d_internal_action_set_digest_versioned(uuid,text,integer) returns bytea
```

V2 uses domain `ichess.crm.p3.action-set`, explicit `encoding_version=2`, and
this exact top-level order in `jsonb_build_object`: domain, encoding version,
conversion Request ID, hex legacy Request action-graph digest, required
lifecycle status, actions. Actions are `jsonb_agg` ordered by
`conversion_action_id`. Every action serializes this exact V1 field order:

```text
action_id
action_version
action_kind
action_intent_digest (hex)
identity_kind
source_contact_id
source_candidate_student_id
match_review_id
profile_creation_reservation_id
target_adapter_namespace
opaque_target_id
expected_target_version
student_target_id
guardian_target_id
guardian_action_id
student_action_id
guardian_student_relationship_id
expected_relationship_version
relationship_type
is_primary_contact
financial_contact_role
academic_contact_role
safe_reason_code
relationship_policy_version
```

V2 then appends exactly these fields for every action:

```text
action_set_encoding_version
reviewed_reuse_authorization_id
expected_reuse_authorization_version
relationship_scope_encoding_version
relationship_scope_digest (hex when non-null)
reuse_authorization_set_encoding_version
reuse_authorization_set_digest (hex when non-null)
```

No secret or mutable arbitrary JSON is serialized. All three actions for a
Request must store the same explicit encoding. V1 requires every new
authorization/scope/set field null. V2 is mandatory if any identity action is
cross-source; create, no-target, exact-source reuse and relationship rows
without their own authorization keep the per-action authorization fields null,
while all three rows carry the common set encoding/digest. Relationship-scope
fields follow the exact section-8 shape. A plan with no cross-source action
remains V1.

The versioned dispatcher is exact:

```text
version 1 -> call unchanged f23_3e_p3b_internal_action_set_digest(uuid,text)
version 2 -> call f23_3e_p3d_internal_action_set_digest_v2(uuid,text)
other     -> ACTION_SET_ENCODING_UNSUPPORTED
```

P3C finalize selects the common persisted action encoding. P3B issue reselects
it after locking actions, persists it on the conversion authority and computes
the corresponding APPROVED digest. P3D dispatches only from that authority
field and requires action versions to match. A V1 authority cannot execute a
V2 plan and vice versa. Existing live V1 plans/authorities remain executable
under V1 if otherwise current. Completed replay reads its immutable snapshot and
never invokes either serializer or hashes `EXECUTED` rows.

### Canonical binary primitives for auxiliary authority digests

The two auxiliary digests below do **not** use JSON or database row-return
order. Both use `extensions.digest(serialized_bytea,'sha256')` and these exact
big-endian primitives (implementation may delegate to audited P3C
`u8/u16/u32` only when the bytes are identical):

```text
U8(n)       = one unsigned byte
U16(n)      = two unsigned big-endian bytes
U32(n)      = four unsigned big-endian bytes
UUID16(u)   = pg_catalog.uuid_send(u), exactly 16 bytes
TEXT32(s)   = U32(length(UTF8(s))) || UTF8(s); only validated finite ASCII
BYTES32(b)  = b after exact octet_length(b)=32
NULLABLE(X) = U8(0) for NULL; U8(1) || X for non-NULL
BOOL(b)     = U8(0) for false; U8(1) for true
```

Lengths, positive versions and positive integer fields use U32; serializer
schema version uses U16. Negative/overflow integers, non-canonical enum
spelling, invalid UTF-8, unexpected null and wrong byte lengths fail closed.
Encoding the domain with TEXT32 prevents prefix ambiguity.

### Relationship-scope digest V1

The exact helper is:

```sql
f23_3e_p3d_internal_relationship_scope_digest_v1(
  p_center_id text,
  p_conversion_request_id uuid,
  p_relationship_action_id uuid,
  p_guardian_action_id uuid,
  p_student_action_id uuid,
  p_related_student_disposition text,
  p_guardian_match_review_id uuid,
  p_guardian_review_version integer,
  p_student_match_review_id uuid,
  p_student_review_version integer,
  p_guardian_target_id uuid,
  p_guardian_expected_target_version integer,
  p_student_target_id uuid,
  p_student_expected_target_version integer,
  p_relationship_action_kind text,
  p_guardian_student_relationship_id uuid,
  p_expected_relationship_version integer,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_relationship_policy_version integer,
  p_safe_reason_code text
) returns bytea
```

Its preimage is exactly, in this order:

```text
TEXT32("ichess.crm.p3.relationship-scope.v1")
|| U16(1)
|| TEXT32(center_id)
|| UUID16(conversion_request_id)
|| UUID16(relationship_action_id)
|| UUID16(guardian_action_id)
|| UUID16(student_action_id)
|| TEXT32(related_student_disposition)       -- CREATE | REUSE | NONE
|| NULLABLE(UUID16(guardian_match_review_id))
|| NULLABLE(U32(guardian_review_version))
|| NULLABLE(UUID16(student_match_review_id))
|| NULLABLE(U32(student_review_version))
|| NULLABLE(UUID16(guardian_target_id))
|| NULLABLE(U32(guardian_expected_target_version))
|| NULLABLE(UUID16(student_target_id))
|| NULLABLE(U32(student_expected_target_version))
|| TEXT32(relationship_action_kind)
|| NULLABLE(UUID16(guardian_student_relationship_id))
|| NULLABLE(U32(expected_relationship_version))
|| NULLABLE(TEXT32(relationship_type))
|| NULLABLE(BOOL(is_primary_contact))
|| NULLABLE(TEXT32(financial_contact_role))
|| NULLABLE(TEXT32(academic_contact_role))
|| U32(relationship_policy_version)
|| TEXT32(safe_reason_code)
```

Every nullable ID/version pair is jointly null or non-null. Existing finite
action-shape constraints decide permitted nulls. P3C materialize generates all
three action UUIDs first, derives the digest from typed inputs, and stores
encoding `1` plus identical 32 bytes on the relationship action and every
Guardian cross-source authorization. Finalize, P3B capability, P3B issue and
P3D recompute from persisted rows and require equality. It excludes lifecycle
`action_version`; the V2 action digest separately binds that version. A plan
without Guardian cross-source reuse has null authorization-scope fields.
Unknown scope encoding fails with
`RELATIONSHIP_SCOPE_ENCODING_UNSUPPORTED`.

### Reuse-authorization-set digest V1

The exact helper is:

```sql
f23_3e_p3d_internal_reuse_authorization_set_digest_v1(
  p_conversion_request_id uuid,
  p_required_authorization_status text
) returns bytea
```

It selects only same-Request authorization rows at
`p_required_authorization_status`. The caller separately requires a bijection
between those rows and the non-null authorization references on the current V2
identity actions, including actual `authorization_version =
expected_reuse_authorization_version`. Dangling action/auth rows, duplicate
authorization IDs, duplicate identity kinds, zero rows, unrelated rows or more
than two rows fail closed. P3C/P3B/P3D use `ISSUED`; V1 and completed replay
never call it.

Each record is exactly:

```text
U8(identity_kind_rank)                       -- GUARDIAN=1, STUDENT=2
|| UUID16(reviewed_reuse_authorization_id)
|| U32(authorization_version)
|| TEXT32(center_id)
|| UUID16(conversion_request_id)
|| UUID16(conversion_action_id)
|| NULLABLE(UUID16(source_contact_id))
|| NULLABLE(UUID16(source_candidate_student_id))
|| TEXT32(target_adapter_namespace)
|| UUID16(opaque_target_id)
|| U32(expected_target_version)
|| UUID16(match_review_id)
|| U32(review_version)
|| NULLABLE(U32(relationship_scope_encoding_version))
|| NULLABLE(BYTES32(relationship_scope_digest))
```

Records sort by `(identity_kind_rank,
reviewed_reuse_authorization_id UUID16 byte order)`. That tuple is also the
dedupe key; repeated authorization or identity kind is rejected rather than
folded. The set preimage is:

```text
TEXT32("ichess.crm.p3.reuse-authorization-set.v1")
|| U16(1)
|| UUID16(conversion_request_id)
|| U32(record_count)
|| U32(record_1_length) || record_1
|| ...
|| U32(record_N_length) || record_N
```

`record_count` is one or two. An empty set has no set digest (`NULL`) and is
valid only for V1. During V2 materialization, P3C generates all action and
authorization IDs, inserts authorization rows first under their deferrable
action FKs, computes this non-recursive set preimage, then inserts all three
PROPOSED actions with common encoding `1` plus identical digest. Deferred FKs
must be valid before commit. The serializer excludes those two action columns,
so no digest cycle exists. Finalize reselects/recomputes it and verifies the
action/auth bijection before transition; V2 action serialization binds the
common fields in REVIEWED rows.

P3B capability recomputes over locked REVIEWED/ISSUED rows. After all actions
persist as APPROVED v3, issuance recomputes once more and stores encoding `1`
plus the 32-byte digest on conversion authority and completed issuance-
idempotency binding. P3D requires authority v1, requires all three action
copies equal that authority, repeats the computation over locked APPROVED
actions plus ISSUED-v1 authorization rows, and compares before business
mutation. P3D's idempotency binding stores the same set version/digest. Unknown set encoding fails with
`REUSE_AUTHORIZATION_SET_ENCODING_UNSUPPORTED`.

The domains are distinct:

```text
ichess.crm.p3.action-set
ichess.crm.p3.relationship-scope.v1
ichess.crm.p3.reuse-authorization-set.v1
```

V2 action bytes bind each authorization ID/version and relationship-scope
version/digest; conversion authority additionally binds the canonical set.
Replacing authorization X with Y, changing its version, changing relationship
scope or downgrading an encoding changes a bound digest and fails before
mutation.

## 9. Student Semantics

For Request A, reviewed create uses the reservation's preallocated ID and P3D
creates Student T plus binding A->T. For a different Candidate B, P2B may expose
T only as a strong masked candidate with `CROSS_SOURCE_EXPLICIT_REVIEW`.
P2C's human decision and P3C's Student authorization bind Candidate B, Request
B, T/version, review/evidence/policy/reviewer provenance and supporting A
binding. They do not create B's binding.

P3D validates Student authorization and current protected Candidate birth,
derives the Student mutex resources, validates current Student T and Student
birth target evidence, and then creates `binding B->T` through the no-relock
binding core. It does not duplicate or mutate T and does not treat name+birth as
authority. One active-source uniqueness prevents B from binding to two targets.

Create semantics continue to use `reservation.preallocated_target_id`, ACTIVE
profile, `learning_lifecycle_status=NULL`, P3D0 unwrap/re-protect and no direct
ciphertext copy. Explicit no-target has no reuse authorization or binding.

## 10. Guardian and Relationship Semantics

Guardian cross-source reuse is symmetric at the identity layer: Contact B,
Request B, Guardian G, current Contact evidence, target version, P3C0 evidence,
reviewer provenance and supporting historical Guardian binding are all bound.
Phone/email/name evidence never automatically merges a Contact into a Guardian.

It is intentionally asymmetric at the relationship layer. Guardian identity
authorization alone does not authorize a relationship. P3C materialization
knows the paired Student action and freezes one exact relationship scope:

- Student create: the preallocated Student ID and expected created version 1;
- Student reuse: exact Student ID/version and its own review/authorization mode;
- Student no-target: only `DO_NOT_CREATE_RELATIONSHIP` is valid;
- create relationship: exact endpoints, roles, flags and current relationship
  policy, with no existing active-equivalent/primary conflict;
- reuse/update: exact existing relationship ID/version and endpoint/role tuple;
- do-not-create: exact reviewed safe reason.

The Guardian authorization stores the scope digest and exact Student endpoint.
It cannot be replayed against an unrelated Student. If B reuses an already
current relationship, the relationship row's original creation provenance is
not rewritten; B provenance remains in B's authorization, action, result and
events. If B creates or approved-updates a relationship, the P3C guard and Audit
record the appropriate Request/action provenance. Concurrent duplicate or
one-primary violations fail the entire transaction; there is no last-write-wins.

## 11. Binding Creation and Provenance

```text
Reviewed reuse authorization != canonical source-target binding
binding B->T creation point = successful atomic real conversion B commit
```

The P3D-era forward extension adds nullable
`reviewed_reuse_authorization_id` to `crm_identity_target_binding`. It is null
for create-origin bindings and required for new cross-source reuse bindings.
Every B binding stores B's source/version, Request B, P3 action B, review B,
target/version and authorization ID. It never mutates A's row.

For V1 exact-source reuse the active B binding already exists and is only
verified. For V2 cross-source reuse the no-relock binding core requires no active
B binding, inserts exactly one B row, and returns its ID. If B is already bound
to T, only exact P3D idempotent replay can succeed; if B is bound to another
target, execution fails conflict. A uniqueness violation rolls back all work.

## 12. Atomic Transaction / Rollback Contract

After immutable replay and canonical locks, one P3D transaction performs:

1. validate P3B conversion authority, current capability/security/membership
   and consumed step-up;
2. validate Request/action encoding and recompute APPROVED V1 or V2 digest;
3. validate every reuse authorization `ISSUED v1`, unexpired and exact;
4. validate source, review, supporting binding, target, policy, reservation and
   relationship scope;
5. move Request `APPROVED -> EXECUTING +1`;
6. compose/reuse Student and Guardian through no-relock cores;
7. compose/reuse/update the exact relationship;
8. insert B source-target bindings for cross-source reuse and create bindings
   for create actions, or verify existing exact-source bindings;
9. consume only used create reservations;
10. terminalize Candidate/Assignment/Case as the approved plan requires;
11. move actions `APPROVED -> EXECUTED +1`;
12. move Request `EXECUTING -> COMPLETED +1` and conversion authority to
    `CONSUMED +1`;
13. move every used reuse authorization `ISSUED -> CONSUMED +1`;
14. append finite Audit and matching Outbox events;
15. complete the immutable `REAL_CONVERSION` idempotency result; commit.

Any error rolls back target, relationship, B binding, reservation and
authorization consumption, lifecycle changes, events and result. `EXECUTING`
never survives. No compensation saga or partial terminal state is permitted.

Exact replay checks the completed immutable result before Stage A or live
authorization/Request/action state. It does not rehash EXECUTED actions, require
an ISSUED authorization, create a second binding, consume again or emit events.
A same key with changed Request, conversion authority, environment, intent,
expected versions or operation binding is `IDEMPOTENCY_CONFLICT`.

## 13. Complete Identity Mutex Derivation and Exact No-relock Cores

### Complete resource set -- accepted closure preserved

Stage A derives Student display-name/birth and Guardian display-name/all lookup
digest/source-Contact resources before locking. The resource identity remains
exactly `(identity_kind,identity_match_mutex_key)`. The executor unions and
deduplicates the complete Student+Guardian set and performs one acquisition:

```sql
ORDER BY
  CASE identity_kind WHEN 'GUARDIAN' THEN 1 WHEN 'STUDENT' THEN 2 ELSE 99 END,
  identity_match_mutex_key ASC
FOR UPDATE
```

Unknown kinds are rejected before ordering. There is no Student subset
pre-lock, no all-active late scan and no later mutex access. Stage B rederives
the exact tuple-set/digest from already-locked authoritative rows without
reading `crm_identity_match_mutex`; mismatch is `IDENTITY_MUTEX_SET_STALE`.

The transaction-local set digest is not an authority/environment domain and is
not persisted. It is SHA-256 over the section-8 binary primitives:

```text
TEXT32("ichess.crm.p3.identity-mutex-resource-set.v1")
|| U16(1)
|| TEXT32(center_id)
|| U32(record_count)
|| for each record in canonical order:
     U8(identity_kind_rank) || BYTES32(identity_match_mutex_key)
```

Every physical mutex key is exactly 32 bytes. Duplicate `(rank,key)` records
are removed before `record_count`; duplicate removal and serialization use the
same canonical order. This digest only proves that every core received the set
the executor derived and locked; it cannot authorize identity or substitute for
the independent authority, identity-policy or crypto environments.

### Common caller/lock contract

All six cores below have one production caller:
`public.f23_3e_p3d_execute_conversion`. They are `SECURITY DEFINER`,
`search_path=''` and revoked from `PUBLIC`, `anon`, `authenticated` and
`service_role`. Entry requires transaction-local `ichess.p3d_executor='on'`
and hex `ichess.p3d_locked_identity_set_digest` equal to the supplied exact
32-byte digest. Those GUCs are integrity guards, not substitutes for locks.

Before calling any core, the executor owns `FOR UPDATE` locks on the center
root, security/step-up/membership/authority/idempotency/Request and all three
actions; exact Contact/Case/Candidate/Assignment; referenced reviews,
reservations and reuse authorizations; existing targets, source bindings and
relationship rows, all in section-14 order. Current policy registry rows are
held `FOR SHARE`. Nonexistent create targets/bindings/relationships have no row
to lock; the executor has locked their exact parent/source/action scope and the
PK/partial-unique constraints serialize the guarded insert.

Inside a core, ordinary reads may verify caller-held rows. `FOR UPDATE`,
`FOR SHARE`, root/advisory acquisition and every read or write of
`crm_identity_match_mutex` are forbidden. A core never calls the physical
lock-owning P3C wrappers. It may call only the explicitly listed crypto/pure
leaf helpers. No core commits, catches a failure as success, or emits an event.

The common finite failures referenced below are exactly
`RESOURCE_NOT_AVAILABLE` (opaque missing/wrong-center selector),
`EXECUTOR_LOCK_PRECONDITION_FAILED` (executor GUC/action/request identity does
not match the passed IDs/versions), and `IDENTITY_MUTEX_SET_STALE` (missing,
wrong-length or rederived-different complete set digest). Error messages contain
only the code, never IDs, evidence, bytes or SQL detail. PostgreSQL does not
offer a safe per-row “current transaction owns this lock” predicate; ownership
is enforced by the sole-caller/transitive static proof and runtime blocking
tests, while every row value/version is rechecked by the core.

### Logical core 1 -- Student create

Current function/callers: physical
`f23_3e_p3c_internal_create_student_target(uuid,uuid,text,date)` is called by
the blocked P3D executor and guarded local P3C QA; it locks root, Student mutex,
Request/action/reservation and reads Candidate/review/policy.

Post-remediation interface:

```sql
f23_3e_p3d_internal_create_student_target_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_conversion_action_id uuid,
  p_actor_user_id uuid,
  p_candidate_student_id uuid,
  p_expected_candidate_version integer,
  p_match_review_id uuid,
  p_expected_review_version integer,
  p_reservation_id uuid,
  p_expected_reservation_version integer,
  p_preallocated_student_id uuid,
  p_display_name_evidence text,
  p_birth_date_evidence date,
  p_identity_policy_registry_id uuid,
  p_expected_normalization_version integer,
  p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(student_id uuid, student_version integer, outcome_code text)
```

Caller-held/currentness preconditions: Request is exact-center APPROVED at the
authority's approved version and legacy digest; action is same-Request
`CREATE_NEW_STUDENT/APPROVED v3`; Candidate is same Case, ACTIVE or
REVIEW_REQUIRED at the passed/current review/request version; review is
`CREATE_NEW_REVIEWED v2/PREPARE_CREATE_NEW/NO_MATCH`, unexpired and matches
source/evidence/policy; reservation is exact action/review/source,
`ACTIVE v1`, unexpired, canonical Student namespace and preallocated ID; policy
IDs/versions equal root/Request; target ID is absent. The local date is the
Stage-B-authenticated P3D0 value. Allowed leaves are
`f23_3e_p3d_internal_protect_student_birth_evidence(text,uuid,date)` and the
existing pure P2B normalization/digest helpers. Success is
`STUDENT_CREATED`, version 1. Finite failures are
`RESOURCE_NOT_AVAILABLE`, `EXECUTOR_LOCK_PRECONDITION_FAILED`,
`IDENTITY_MUTEX_SET_STALE`, `CREATE_STUDENT_TARGET_EVIDENCE_STALE`,
`CANDIDATE_BIRTH_SOURCE_UNAVAILABLE`, `STUDENT_BIRTH_TARGET_UNAVAILABLE`, and
`TARGET_ALREADY_EXISTS`.

### Logical core 2 -- Student reuse

Current function/callers: physical
`f23_3e_p3c_internal_resolve_reusable_student(text,uuid,uuid,integer,uuid)` is
used by P3C validation/materialization, blocked P3D and local QA; it reads
target, Candidate, review, Request, policy and exact-source binding with share
locks and cannot authorize cross-source B.

Post-remediation interface:

```sql
f23_3e_p3d_internal_resolve_reusable_student_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_conversion_action_id uuid,
  p_source_candidate_student_id uuid,
  p_expected_source_candidate_version integer,
  p_match_review_id uuid,
  p_expected_review_version integer,
  p_student_id uuid,
  p_expected_student_version integer,
  p_reviewed_reuse_authorization_id uuid,
  p_expected_reuse_authorization_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(reuse_eligible boolean, student_id uuid,
                student_version integer, outcome_code text)
```

The locked action is `REUSE_REVIEWED_STUDENT/APPROVED v3` and exactly binds the
passed Candidate/review/target/auth IDs and versions. Candidate/review/Request/
policy/evidence/supporting binding equal the authorization snapshots; Student
is ACTIVE at `p_expected_student_version`; authorization is same-center,
same-Request, STUDENT, unexpired `ISSUED v1`; no ACTIVE B-source binding exists.
The already-loaded target birth envelope authenticates through exact no-table-
lock leaf
`f23_3e_p3d_internal_validate_student_birth_evidence_no_lock(p_center_id text,
p_student_id uuid,p_expected_student_version integer,
p_birth_evidence_protected bytea) returns boolean`; the physical three-argument
validator remains for standalone inherited use and is outside this graph. Success is
`(true,id,version,'STUDENT_REUSED')`. Finite failures are the three common
precondition codes plus `STUDENT_SOURCE_STATE_STALE`,
`STUDENT_REUSE_AUTHORIZATION_STALE`, `STUDENT_TARGET_VERSION_STALE`,
`STUDENT_BIRTH_TARGET_UNAVAILABLE`, and `BINDING_CONFLICT`.

### Logical core 3 -- Guardian create

Current function/callers: physical
`f23_3e_p3c_internal_create_guardian_target(uuid,uuid)` is called by blocked
P3D and local QA; it locks root/Guardian mutex/Request/action/Contact/
reservation and calls the lock-reading P3C source unwrap.

Post-remediation interface:

```sql
f23_3e_p3d_internal_create_guardian_target_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_conversion_action_id uuid,
  p_actor_user_id uuid,
  p_source_contact_id uuid,
  p_expected_contact_version integer,
  p_match_review_id uuid,
  p_expected_review_version integer,
  p_reservation_id uuid,
  p_expected_reservation_version integer,
  p_preallocated_guardian_id uuid,
  p_identity_policy_registry_id uuid,
  p_expected_normalization_version integer,
  p_expected_match_policy_version integer,
  p_expected_minimum_evidence_policy_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(guardian_id uuid, guardian_version integer, outcome_code text)
```

Request/action/review/reservation/policy equations mirror Student create with
`CREATE_NEW_GUARDIAN`, Contact source, `canonical.guardian_profile.v1` and
P3C0 source version 2. Contact is non-archived/current and its locked bytes are
passed internally to new leaf
`f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock(text,uuid,integer,bytea,integer,uuid)`;
that leaf performs P3C0 unwrap/re-protect and has no table read. Target is
absent. Success is `GUARDIAN_CREATED`, version 1. Finite failures are common
preconditions plus `CREATE_GUARDIAN_TARGET_EVIDENCE_STALE`,
`GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE`, `GUARDIAN_TARGET_CRYPTO_UNAVAILABLE`,
and `TARGET_ALREADY_EXISTS`.

### Logical core 4 -- Guardian reuse

Current function/callers: physical
`f23_3e_p3c_internal_resolve_reusable_guardian(text,uuid,uuid,integer,uuid)` is
used by P3C validation/materialization, blocked P3D and local QA; it reads the
current source's binding and therefore cannot authorize B.

Post-remediation interface:

```sql
f23_3e_p3d_internal_resolve_reusable_guardian_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_conversion_action_id uuid,
  p_source_contact_id uuid,
  p_expected_source_contact_version integer,
  p_match_review_id uuid,
  p_expected_review_version integer,
  p_guardian_id uuid,
  p_expected_guardian_version integer,
  p_reviewed_reuse_authorization_id uuid,
  p_expected_reuse_authorization_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(reuse_eligible boolean, guardian_id uuid,
                guardian_version integer, outcome_code text)
```

The locked action is `REUSE_REVIEWED_GUARDIAN/APPROVED v3`; Contact,
review/Request/policy/supporting binding and authorization equal every passed
and persisted currentness field; Guardian is ACTIVE at the expected version;
authorization is same-center/Request GUARDIAN, unexpired `ISSUED v1`; no ACTIVE
B-source binding exists. Locked target bytes authenticate through
`f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock(text,uuid,integer,bytea,integer)`.
Success is `(true,id,version,'GUARDIAN_REUSED')`. Finite failures are common
preconditions plus `GUARDIAN_SOURCE_STATE_STALE`,
`GUARDIAN_REUSE_AUTHORIZATION_STALE`, `GUARDIAN_TARGET_VERSION_STALE`,
`GUARDIAN_TARGET_CRYPTO_UNAVAILABLE`, and `BINDING_CONFLICT`.

### Logical core 5 -- source-target binding commit/verify

Current function: blocked
`f23_3e_p3d_internal_commit_create_binding(uuid,uuid,integer)` is called only
by blocked P3D for CREATE and reads action/review/reservation; reuse only calls
P3C resolvers and creates no B binding.

Post-remediation interface:

```sql
f23_3e_p3d_internal_commit_identity_target_binding_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_conversion_action_id uuid,
  p_match_review_id uuid,
  p_identity_kind text,
  p_binding_mode text,
  p_source_contact_id uuid,
  p_source_candidate_student_id uuid,
  p_expected_source_version integer,
  p_target_adapter_namespace text,
  p_target_id uuid,
  p_expected_target_version integer,
  p_reviewed_reuse_authorization_id uuid,
  p_expected_reuse_authorization_version integer,
  p_locked_identity_mutex_set_digest bytea
) returns table(identity_target_binding_id uuid,
                binding_version integer, outcome_code text)
```

`p_binding_mode` is exactly `CREATE_ORIGIN`, `VERIFY_EXACT_SOURCE`, or
`COMMIT_CROSS_SOURCE_REUSE`. The locked action/review/source/target are exact
and the executor holds every ACTIVE binding for that source `FOR UPDATE`.
CREATE requires reservation-backed create action and null authorization;
VERIFY requires the existing ACTIVE same-source/same-target binding and null
authorization; CROSS_SOURCE requires matching unexpired `ISSUED v1`
authorization, no active B binding, and writes its ID into the new binding.
Success is `IDENTITY_TARGET_BINDING_CREATED` for CREATE/CROSS_SOURCE or
`IDENTITY_TARGET_BINDING_VERIFIED` for VERIFY. Finite failures are common
preconditions plus `BINDING_MODE_INVALID`, `BINDING_EVIDENCE_STALE`,
`REUSE_AUTHORIZATION_STALE`, and `BINDING_CONFLICT`.

### Logical core 6 -- Guardian-Student relationship composition

Current function/callers: physical
`f23_3e_p3c_internal_upsert_guardian_student_relationship(uuid,uuid)` is called
by blocked P3D and local QA; it locks root, every active identity mutex,
Request/actions/targets and existing relationship.

Post-remediation interface:

```sql
f23_3e_p3d_internal_upsert_relationship_no_relock(
  p_center_id text,
  p_conversion_request_id uuid,
  p_relationship_action_id uuid,
  p_actor_user_id uuid,
  p_guardian_action_id uuid,
  p_student_action_id uuid,
  p_guardian_id uuid,
  p_expected_guardian_version integer,
  p_student_id uuid,
  p_expected_student_version integer,
  p_guardian_student_relationship_id uuid,
  p_expected_relationship_version integer,
  p_relationship_scope_encoding_version integer,
  p_relationship_scope_digest bytea,
  p_locked_identity_mutex_set_digest bytea
) returns table(relationship_id uuid, relationship_version integer,
                outcome_code text)
```

All three actions are locked APPROVED v3 and linked to this Request; endpoints
are locked ACTIVE at exact versions; root/Request/action policy versions equal;
scope encoding is 1 and its persisted recomputation equals the passed digest;
the locked existing relationship is absent for CREATE or exact/current for
REUSE/UPDATE. CREATE also requires no active-equivalent and no conflicting
active primary Guardian; DO_NOT is handled by executor and never calls this
core. Success vocabulary is the physical `RELATIONSHIP_CREATED`,
`RELATIONSHIP_REUSED`, `RELATIONSHIP_UPDATED`. Finite failures are common
preconditions plus `RELATIONSHIP_SCOPE_ENCODING_UNSUPPORTED`,
`RELATIONSHIP_SCOPE_STALE`, `RELATIONSHIP_ENDPOINT_STALE`,
`RELATIONSHIP_VERSION_STALE`, `RELATIONSHIP_CONFLICT`, and
`RELATIONSHIP_DECISION_REQUIRED`.

### Static and runtime no-relock proof

Future smoke parses each exact signature and the complete transitive callee
graph. It fails if a core or reachable leaf contains
`crm_identity_match_mutex`, `FOR UPDATE`, `FOR SHARE`, identity advisory locks,
the center-root table, or any lock-owning P3C wrapper. The exact internal leaf
allowlist is:

```text
f23_3e_p2b_internal_digest_key(integer)
f23_3e_p2b_internal_normalize_student_name_v1(text)
f23_3e_p2b_internal_normalize_student_birth_v1(date)
f23_3e_p2b_internal_evidence_digest(bytea,text,integer,text,text,text,integer)
f23_3e_p3c_internal_u8(integer)
f23_3e_p3c_internal_u16(integer)
f23_3e_p3c_internal_u32(bigint)
f23_3e_p3c_internal_lp32(bytea)
f23_3e_p3c_internal_crypto_environment_fingerprint()
f23_3e_p3c_internal_source_aad(text,uuid,integer)
f23_3e_p3c_internal_guardian_aad(text,uuid,integer)
f23_3e_p3c_internal_parse_envelope(bytea,text)
f23_3e_p3d_internal_student_birth_aad(text,uuid,integer)
f23_3e_p3d_internal_parse_birth_envelope(bytea,text)
f23_3e_p3d_internal_parse_birth_plaintext(bytea)
f23_3e_p3d_internal_protect_student_birth_evidence(text,uuid,date)
f23_3e_p3d_internal_validate_student_birth_evidence_no_lock(text,uuid,integer,bytea)
f23_3e_p3d_internal_reprotect_guardian_evidence_no_lock(text,uuid,integer,bytea,integer,uuid)
f23_3e_p3d_internal_validate_guardian_target_evidence_no_lock(text,uuid,integer,bytea,integer)
f23_3e_p3d_internal_relationship_scope_digest_v1(text,uuid,uuid,uuid,uuid,text,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,uuid,integer,text,boolean,text,text,integer,text)
```

Static QA resolves every exact regprocedure above. Direct calls by these leaves are limited to `extensions.digest`,
`extensions.hmac`, `vault._crypto_aead_det_encrypt`,
`vault._crypto_aead_det_decrypt`, `vault._crypto_aead_det_noncegen` and pure
`pg_catalog` functions. Any other user-defined transitive callee fails. Smoke also
asserts one executor mutex acquisition block and the accepted comparator.
Guarded runtime tests call all six responsibilities only through the real
executor and prove the caller-held version/lock preconditions plus finite
fault rollback. Static proof supplements the real root/concurrency QA.

## 14. Normative Global Lock Hierarchy and Root Decision

The P3A root-before-mutex architecture and its accepted physical realization
are preserved. Every participating production path retains
`center_crm_control ... FOR UPDATE` at tier 0. Changing it to a shared mode
would require re-auditing policy/control writers and replacing checkpointed
P2/P3B/P3C paths; this revision neither needs nor authorizes that change.

The interacting-path compatibility inventory is normative:

| Production function | Root mode | Current mutex behavior | Remediation rule |
|---|---|---|---|
| `f23_3e_p2b_internal_search_masked_candidates` | exact-center `FOR UPDATE` | one identity kind, bytea-sorted keys | preserve per-kind order; it is a subsequence of the canonical tuple order |
| `f23_3e_p2c_internal_execute_mutation` | exact-center `FOR UPDATE` | one identity kind, bytea-sorted keys | preserve per-kind order and new cross-source review checks |
| `f23_3e_p3b_issue_conversion_authority` | exact-center `FOR UPDATE` | whole-center `(identity_kind,key)` | forward-replace comparator with explicit Guardian/Student ranks |
| `f23_3e_p3c_materialize_reviewed_action_pair` | exact-center `FOR UPDATE` | whole-center `(identity_kind,key)` | forward-replace comparator and authorization issue path |
| `f23_3e_p3c_finalize_reviewed_action_plan` | exact-center `FOR UPDATE` | whole-center `(identity_kind,key)` | forward-replace comparator and V1/V2 validation |
| P3C standalone Student/Guardian target wrappers | exact-center `FOR UPDATE` | one identity kind, bytea order | retained only outside P3D; root serialization makes the per-kind subsequence compatible |
| `f23_3e_p3c_internal_upsert_guardian_student_relationship` | exact-center `FOR UPDATE` | whole-center `(identity_kind,key)` | forward-replace its standalone comparator; P3D calls the no-relock core instead |
| `f23_3e_p3d_execute_conversion` | exact-center `FOR UPDATE` | blocked body has Student pre-lock plus whole-center relock | replace with complete tuple derivation and one explicit ranked pass |

All listed functions acquire the same-center exclusive root before their mutex
behavior. Consequently no retained per-kind or checkpoint-era textual order can
interact concurrently with another order. The explicit rank is nevertheless
used in every forward-replaced whole-center path so future code has one
documented comparator rather than relying on that serialization proof alone.

```text
P3A_NORMATIVE_REOPEN_REQUIRED: NO
FULL_EXECUTOR_IDENTITY_MUTEX_CONCURRENCY:
PROVABLY_UNREACHABLE DUE TO FROZEN EARLIER EXCLUSIVE CENTER ROOT
```

Mutex keys bind center, so two centers cannot share a canonical mutex resource.
Within one center, only one transaction can pass tier 0. Therefore two full
executors cannot form a circular wait at tier 1. This is a deliberate inherited
serialization boundary, not a test accident. The canonical tier-1 order remains
mandatory defense-in-depth and for any future separately audited root-mode
change.

The exact P3D hierarchy is:

| Tier | Resources and deterministic order |
|---:|---|
| 0 | one `center_crm_control` row `FOR UPDATE`; center derived server-side |
| 1 | complete identity resource tuples, deduped and ordered Guardian rank 1, Student rank 2, then `bytea ASC`, one pass |
| 2 | `account_security_control`, actor UUID order if plural |
| 3 | consumed `account_step_up_assertion`, assertion UUID order |
| 4 | membership and capability support, UUID order; reviewer rows are historical after P3B issue |
| 5 | `crm_conversion_authority` row |
| 6 | P3D `crm_idempotency_registry` row |
| 7 | `crm_conversion_request` row |
| 8 | `crm_conversion_action` rows by UUID, then bound reuse authorization rows by UUID |
| 9 | `crm_contact` rows by UUID |
| 10 | `consultation_case` row |
| 11 | Candidate rows by UUID |
| 12 | Assignment rows by UUID |
| 13 | Guardian targets then Student targets, each UUID; supporting/current source bindings by binding UUID |
| 14 | match reviews by UUID |
| 15 | create reservations by UUID |
| 16 | relationships by semantic `(guardian_id,student_id)` then relationship UUID |
| 17 | binding and relationship writes; no earlier-tier acquisition |
| 18 | lifecycle/result writes |
| 19 | Audit, matching Outbox, commit |

Within every tier UUID uses PostgreSQL UUID ordering and bytea uses PostgreSQL
binary order. All collections are deduped before lock. No later code may return
to an earlier tier. Exact completed replay returns before Stage A and this live
lock hierarchy; the concurrent-after-selector replay check at the idempotency
tier remains snapshot-only.

## 15. Concurrency Semantics

- Requests B and C with different sources may both reuse T after independent
  review. The root serializes their same-center execution. Each inserts its own
  source binding; target T is not duplicated.
- Two executions for the same source serialize on root, source authorization
  uniqueness, idempotency and one-active-source binding. One commits; the other
  exact-replays or conflicts without partial state.
- Target or supporting-binding drift after review invalidates authorization and
  action currentness. It never silently retargets.
- Create-vs-reuse cannot last-write-win. A create commit may make a later fresh
  review eligible; a concurrently stale plan rolls back and must be reviewed
  again.
- Relationship unique active-equivalent and one-primary constraints are
  backstops. A stale create colliding with a committed relationship rolls back;
  it is not coerced into reuse.
- Client/network uncertainty uses the exact immutable P3D result. It does not
  repeat target, binding, relationship, consumption or events.

## 16. Forward Migration / Versioning Strategy

The blocked P3D migration is untracked, unpushed and not remotely applied.
Future remediation therefore chooses:

```text
STRATEGY A: rewrite/remediate the existing uncommitted
202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql
in place before its first checkpoint.
```

This avoids permanently recording a known-rejected implementation followed by a
patch. Its SHA will change and the report/smoke will bind the new value. All 16
inherited checkpoint hashes stay exact.

The remediated P3D migration may:

- create `crm_reviewed_cross_source_reuse_authorization` as a protected support
  authority aggregate, forced RLS, no policies, no Realtime and no direct app
  grants;
- add the explicitly nullable review/action/authority/binding/idempotency fields
  defined above, constraints and indexes;
- forward-replace P2B/P2C/P3B/P3C function bodies through this P3D-era migration
  without editing checkpoint bytes;
- add the versioned digest dispatcher, deterministic support selector,
  authorization validators/guards/events and no-relock cores;
- rewrite the uncommitted P3D executor/report/smoke/QA to the accepted design.

No new Student, Guardian, relationship or other business aggregate is created.
The authorization table is a protected single-use decision authority, not a
fourth business target. All internal functions are revoked from app roles.

### Forward-compatible P3D package classification

Future P3D smoke treats only these exact paths as owned runtime artifacts:

```text
supabase/migrations/202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql
docs/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa.md
tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-smoke.js
tests/f23-3e-p3d-atomic-real-conversion-executor-and-integrated-backend-qa-local-db-qa.js
```

It uses exact path equality, not a phase-prefix regex. In particular,
`docs/f23-3e-p3d-r0-design-remediation.md` and
`docs/f23-3e-p3d-r0-independent-design-audit.md` are typed design/audit
evidence and are excluded from runtime package cardinality. Exact one-migration,
new P3D SHA, inherited hash, function-surface and semantic assertions remain
strict; this classification does not whitelist extra runtime artifacts.

## 17. Production-Reachable Request-A -> Request-B QA

Fixture setup may create primitive synthetic Auth users, center, membership,
Contact/Case/Candidate inputs, current policy and protected canonical envelopes.
It may not insert terminal reviews/actions/authorizations, resurrect terminal
state, or bypass the semantic gate under test.

Mandatory sequence:

1. **Conversion A:** use P2B search, P2C review/decision/reservations, P3C
   materialize/finalize, fresh step-up, P3B authority issuance and P3D execute.
   Create Student T, Guardian G, relationship R, A-source bindings, terminal A
   Request/Case/actions/authority, Audit/Outbox and immutable result.
2. **Independent Source B:** create a different Contact, Case, Candidate,
   Request and Assignment with canonical protected evidence matching T/G under
   current policy. A remains untouched.
3. Call real P2B search/detail. Assert masked T/G, cross-source review mode,
   `reuse_eligible=false`, no support-binding/source-A data and no weak/multiple
   automatic path.
4. Call real P2C create/decide review for B. An authorized human explicitly
   selects T/G. Use different actors for PENDING creation and terminal decision;
   assert PENDING reviewer fields are null, terminal review v2 records only the
   decision actor and captured membership/assignment, and no B binding exists.
5. Call real P3C materialize/finalize. Assert two `ISSUED v1` authorizations,
   exact relationship-scope encoding 1/digest, V2 PROPOSED->REVIEWED v2 plan
   and no B binding.
6. Use fresh step-up and real P3B issuance. Assert Request B `Rq+1`, actions v3,
   V2 APPROVED digest, reuse-authorization-set encoding 1/digest and current
   issuer capability.
7. Call real P3D. Assert T/G/R reused as approved, B Student/Guardian bindings
   created with B provenance and authorization IDs, authorizations consumed v2,
   B terminal independently and A unchanged.
8. Exact replay B; assert immutable equality and zero additional rows/events/
   versions. Assert different key/intent/authority conflict.

After B: Student count and Guardian count are unchanged from after A;
`binding A->T != binding B->T` and the corresponding Guardian bindings are
distinct; R is reused or separately created only according to B's reviewed
relationship action; A/B results and event correlations are distinct; another
center cannot see or reuse them.

```text
GENUINE REQUEST-A -> REQUEST-B QA FEASIBLE: YES
session_replication_role='replica' IN HAPPY PATH: FORBIDDEN
```

Mandatory recovery flow uses separate old/fresh Requests, never generations:

1. Build Request C through terminal cross-source review, V2 finalize and P3B
   authority issuance using protected production paths.
2. Drift its target/supporting binding or pass authorization server expiry.
   P3D C must fail before mutation; C remains nonterminal but non-executable.
3. Call the real existing P3B revoke/expire RPC. Assert authority terminal,
   both reuse authorizations INVALIDATED v2, exactly three actions SUPERSEDED,
   active reservations terminal and Request C SUPERSEDED, with one event pair
   per authorization. Old immutable review/idempotency evidence remains.
4. Create fresh Request D and repeat real P2B -> P2C -> P3C -> P3B -> P3D under
   current evidence. D succeeds; no C row is resurrected or reused as D
   authority.

The pre-issue variant performs the same proof through the existing P2C
expire/supersede entry point. QA also substitutes authorization ID/version,
relationship scope bytes/version, set digest/version and V1/V2 plan/authority;
every case fails before business mutation.

## 18. Genuine Two-executor and Primitive Ordering QA

Future QA distinguishes two tests. Neither uses sleep as readiness evidence.

### A. Deterministic full-executor root-serialization regression

Prepare legitimate same-center Request/authority pairs X and Y whose logical
mutex sets cross (`X={K1,K2}`, `Y={K2,K1}`), including a mixed
Student+Guardian case. X and Y use independent PostgreSQL connections and both
invoke the real `f23_3e_p3d_execute_conversion`.

The remediated executor contains one dormant local-QA hook immediately after
its successful `center_crm_control ... FOR UPDATE` and before tier 1. The hook
activates only when all conditions are true:

```text
session_user = 'postgres'
current_setting('ichess.p3d_local_qa_root_barrier', true) = 'on'
to_regclass('pg_temp.p3d_qa_root_barrier') is not null
the temp table has exactly one enabled row for the derived center
```

The exact session-local table is created by X's guarded runner, never by a
migration:

```sql
create temporary table pg_temp.p3d_qa_root_barrier (
  center_id text primary key,
  barrier_token uuid not null,
  enabled boolean not null check (enabled)
) on commit drop;
```

When enabled, the hook derives exactly
`hashtextextended('f23.3e.p3d.local-qa.root-barrier.v1|' || center_id || '|' ||
barrier_token::text,0)` and requests that transaction-scoped advisory lock.
The controller already holds the same **session** advisory lock. Therefore X
waits on the controller only after X really owns the center root. Normal
service-role/product sessions cannot satisfy `session_user='postgres'`, cannot
create X's `pg_temp` table, do not set the transaction-local GUC and never enter
the hook. A malformed/multiple QA row fails `P3D_LOCAL_QA_BARRIER_INVALID`
rather than pausing.

The exact orchestration is:

1. Controller chooses a random UUID token and obtains the corresponding
   session advisory lock.
2. X begins, creates/inserts the exact temp row, uses `SET LOCAL` for the GUC,
   sets a unique `application_name`, and invokes the real executor.
3. Controller polls `pg_stat_activity`/`pg_locks` until X has
   `wait_event_type='Lock'`, waits on the controller's advisory lock and
   `pg_blocking_pids(X)` contains the controller. This is the positive
   post-root barrier-ready signal, not the product contention assertion.
4. Only then start Y's real executor, without the QA GUC/temp row, for the same
   center.
5. Poll until Y has `wait_event_type='Lock'`, `pg_blocking_pids(Y)` contains X,
   X retains its granted transaction plus `RowShareLock` relation participation
   on `center_crm_control`, and Y waits on X's transaction/tuple conflict while
   executing the tier-0 root statement. Because X is statically at the
   immediate post-root hook and Y has no earlier contended resource, this is
   the exact root-row wait. The report must not label it an identity wait.
6. Assert Y has no Request/action/target/binding/event/result mutation.
7. Controller releases its advisory lock. X proceeds and completes. Y then
   rechecks authoritative state and completes or returns the exact expected
   stale/conflict outcome.
8. Assert no deadlock/timeout, no partial Y state, exact A/B provenance and
   consistent immutable results/events.

All sessions set finite `deadlock_timeout`, `lock_timeout` and
`statement_timeout`; timeout, missing blocker PID, wrong wait tier, early X
completion or hang fails. The hook is a transaction-scoped guarded test seam,
not a public/helper executor and not a production pause API.

### B. Primitive tuple-order falsification plus static graph proof

A separate guarded PostgreSQL test feeds crossed Student+Guardian sets into the
production derivation/comparator and confirms both yield Guardian-rank then
Student-rank, `bytea ASC`, with exact dedupe. It is explicitly a primitive test,
not a full executor wait. Structural smoke proves the one acquisition pass and
section-13 no-relock transitive graph. Existing seven real single-tier
lock-wait tests remain; neither they nor B replaces A.

```text
FULL EXECUTOR IDENTITY-TIER CONCURRENCY QA: PROVABLY NOT APPLICABLE
GENUINE FULL-EXECUTOR ROOT-SERIALIZATION QA: YES
P3A_NORMATIVE_REOPEN_REQUIRED: NO
```

## 19. Negative / Rollback QA Matrix

| Case | Required result |
|---|---|
| no reuse authorization | cross-source action cannot materialize/finalize/approve/execute |
| authorization wrong Source/Request/target/center/kind | fail closed without state change |
| target/supporting binding/source/review/evidence/projection/policy stale | stale/currentness failure; no retarget |
| reviewer membership/consultant assignment drifts before P3B issue | issuance denied; protected P2C supersede invalidates the single plan and requires a fresh Request |
| reviewer leaves after valid P3B issue | historical provenance remains; P3D relies on current independent issuer authority unless explicitly revoked |
| authorization server-expired | unusable immediately; protected pre/post-issue invalidation terminalizes the single plan and fresh Request recovers |
| authorization INVALIDATED/CONSUMED | first attempt denied; exact completed result replay still succeeds |
| authorization ID/version or set digest/version substituted | action/set binding mismatch before business mutation |
| relationship scope bytes/version substituted | relationship/action/authorization binding mismatch before composition |
| source already bound same target | only exact-source V1 path or immutable replay; cross-source issue conflicts |
| source bound different target | conflict; never mutate binding |
| V1 authority with V2 plan or unsupported encoding | `ACTION_SET_ENCODING_UNSUPPORTED/STALE` fail closed |
| Guardian relationship scope mismatch/unrelated Student | relationship/authorization stale, full rollback |
| concurrent B/C same target | distinct source bindings or safe conflict; no duplicate target |
| concurrent same Source | one succeeds, other replay/conflict; no duplicate binding |
| create-vs-reuse/relationship collision | unique/currentness failure; no implicit mode conversion |
| step-up/capability/security/membership/authority environment stale | inherited fail-closed result; no crypto/identity environment comparison |
| malformed Candidate/Contact crypto | P3D0/P3C0 finite unavailable result, full rollback |
| injected Student/Guardian/relationship/binding/auth-consume/Audit/Outbox/idempotency failure | exact pre-call state; no `EXECUTING` residue or partial event |
| replay after success | immutable result only; no live digest or second mutation |
| post-issue recovery | old Request/actions/authority/authorization become terminal together; fresh Request succeeds without resurrection |

## 20. Security / Crypto Invariant Check

- Center, actor, role, action/target choice, review truth and step-up truth are
  server-derived; no browser value is authority.
- New table and helper surfaces are forced-RLS/no-policy/no-Realtime and revoked
  from `PUBLIC`, `anon`, `authenticated`, and `service_role` unless an existing
  exact protected external RPC intentionally calls them as definer.
- Identity match remains review-only; no same-name/birth/contact silent merge.
- `authority_environment_fingerprint`, P2B
  `identity_environment_fingerprint`, and P3C
  `crypto_environment_fingerprint` remain three independent domains. No
  equality is required or tested between them.
- P3D0 Candidate birth and Student target protection remain
  `IC3CBE01/iC3Bth01` and `IC3SBE01/iC3Std01`. P3C0 Guardian unwrap/re-protect
  remains intact. Legacy/raw/unknown evidence fails closed.
- No name, birth, phone, email, protected bytes, identity digest, mutex key,
  secret, token or Vault material enters Audit, Outbox, result or logs.
- P3B conversion authority stays single-use, current and exact-center. Reuse
  authorization cannot replace step-up/capability authority.
- Product Candidate/Contact canonical ingestion and remote apply remain
  deferred.

## 21. Inherited Migration Impact and Exact Implementation Map

```text
INHERITED MIGRATIONS MODIFIED: NO
INHERITED MIGRATION EDIT REQUIRED: NO
BLOCKED P3D MIGRATION EVENTUAL IN-PLACE REMEDIATION: YES
```

| Current object/function | Exact forward change owned by the remediated uncommitted P3D migration | Test coverage |
|---|---|---|
| `f23_3e_p2b_internal_search_masked_candidates` and the two unchanged-signature wrappers | Deterministic supporting-binding selector and only the two masked fields from section 7; keep cross-source `reuse_eligible=false`. | A->B strong candidate; weak/multiple/unavailable/cross-center privacy negatives. |
| `crm_identity_match_review`, `f23_3e_p2a_internal_guard_identity_match_review`, `f23_3e_p2c_internal_execute_mutation` | Add supporting/reviewer columns; PENDING support fields immutable, every reviewer field null; terminal v2 fills actual decider once. External P2C signatures stay exact. | Distinct creator/decider; owner/admin/consultant; partial fill/drift/replay/conflict. |
| existing P2C `f23_3e_p2c_expire_match_review` and `f23_3e_p2c_supersede_match_review` | Add terminal cross-source pre-issue invalidation branches without mutating terminal review; invoke exact single-plan invalidator and return immutable finite result. | Expiry and stale/supersede pre-issue recovery to fresh Request. |
| new `crm_reviewed_cross_source_reuse_authorization` | Exact section-5 schema, forced RLS/no policy/no Realtime/no app grants, guard/FKs/partial unique indexes, ISSUED/CONSUMED/INVALIDATED only. | Shape, RLS/grants, unique source/Request, transition/fault tests. |
| `crm_conversion_action`, its guard and conversion-authority/idempotency columns | Add V2 encoding/auth/scope fields and auxiliary-set version/digest; immutable semantic bindings; exact terminal SUPERSEDED edges only under invalidator. | V1 golden bytes, V2 lifecycle, mixed/downgrade/substitution failures. |
| `f23_3e_p3c_materialize_reviewed_action_pair` | Generate action/auth IDs, compute exact relationship-scope V1, insert authorizations plus PROPOSED actions atomically, emit issue events with canonical writer. | Genuine A->B, decider provenance, relationship scope, exact replay/faults. |
| `f23_3e_p3c_finalize_reviewed_action_plan` | Validate ISSUED-v1 authorizations and scope; PROPOSED->REVIEWED +1 before V1/V2 action digest; no repair on stale state. | Ordering, stale auth/scope, replay, rollback. |
| unchanged physical `f23_3e_p3b_internal_action_set_digest(uuid,text)` plus new V2/dispatcher and the two section-8 binary digest helpers | Preserve V1 semantics; explicit V2 dispatch; exact binary domains/framing/order for scope/set. | Golden PostgreSQL V1/V2/action and binary auxiliary vectors; wrong version/bytes/order. |
| P3B capability and `f23_3e_p3b_issue_conversion_authority` | Recheck reviewer through issue, scope/current authorization; approve first; compute APPROVED action and auth-set digests; persist both versions/digests and minimum expiry. | Happy version offsets, stale reviewer/source/target/scope, substitution, V1/V2. |
| existing `f23_3e_p3b_revoke_or_expire_conversion_authority` | Post-issue owner calls single-plan invalidator and atomically terminalizes authority/actions/reservations/Request/auth rows. | Issued-authority stale/expire/revoke recovery then fresh Request success. |
| new `f23_3e_p3d_internal_invalidate_single_plan_request` | Exact section-6 interface/callers/counts/terminal transitions; internal-only, no earlier-tier lock. | Pre/post-issue exact counts, idempotency, Audit/Outbox faults. |
| six exact no-relock responsibilities/functions in section 13 | Add the six named guarded cores and two Guardian no-table-lock crypto leaves; executor is sole composition caller. Retain original P3C wrappers for standalone inherited semantics, outside P3D graph. | Signature/precondition assertions, full transitive static scan, six runtime/fault paths. |
| `crm_identity_target_binding` | Add nullable reuse-authorization FK; no-relock core verifies V1 source binding or commits create/V2 B binding. | A/B distinct provenance, same/different target conflict, concurrent source. |
| `f23_3e_p3d_execute_conversion` | Replace subset/relock and lock-owning calls with complete one-pass set, exact digests/currentness, six cores, auth consume and dormant post-root local-QA barrier. | Full create/reuse/no-target/fault/replay plus deterministic two-session root proof. |
| physical `f23_3e_p3b_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,uuid,integer,integer,text,text,text,text,uuid)`, P1A/P1C validators and `crm_outbox_event` | Reuse writer unchanged; strict-superset validator allowlist for exactly three authorization events, statuses, outcomes and safe reasons; add only `crm_outbox_event_p3d_reuse_authorization_version_uidx` with the exact section-6 partial predicate. | Safe/unsafe payload, one Audit+Outbox pair per authorization version, duplicate-event rejection and writer fault rollback. |
| P3D smoke | Replace phase glob with exact four runtime-path equality; separately recognize design/audit docs; retain exact P3D SHA, 16 inherited hashes and runtime/security assertions. | Extra/missing runtime artifact injection tests. |
| P3D local DB QA | Remove fabricated reuse; add real A->B, pre/post-issue recovery, substitution, all six cores, root advisory barrier and comparator proof; retain seven waits and final reset. | Production-reachable transitions only; no terminal resurrection or `session_replication_role='replica'` happy path. |

## 22. Open Questions / Unresolved Risks and Re-audit Checklist

There is no unresolved normative design question in this final closure.
Independent final re-audit must falsify, rather than assume, these load-bearing
decisions:

- the exclusive root truly covers every interacting production path;
- exact two-field P2B masking does not add an enumeration oracle;
- P3C cyclic action/authorization inserts and deferrable constraints preserve
  atomic materialization;
- all version equations, V1 golden bytes and binary auxiliary digest vectors
  are exact;
- the six named no-relock signatures/preconditions/transitive leaves have no
  hidden earlier-tier acquisition;
- the unchanged canonical writer plus validator extensions accept only the
  frozen safe payloads;
- genuine A->B and root-serialization QA use public/protected runtime paths,
  never terminal-state fabrication.
- single-plan invalidation always terminalizes the old Request and recovery
  always uses a fresh Request rather than action generations.

Re-audit readiness matrix:

```text
FINAL HIGH-1 NO-RELOCK CORE CONTRACTS: CLOSED
FINAL HIGH-2 REVIEWER PROVENANCE: CLOSED
FINAL HIGH-3 INVALIDATION/RECOVERY: CLOSED
FINAL HIGH-4 DIGEST SERIALIZATION: CLOSED
FINAL MEDIUM-1 AUDIT/OUTBOX WRITER: CLOSED
FINAL MEDIUM-2 ROOT QA ORCHESTRATION: CLOSED

Previously accepted center-root/mixed-mutex/P2B/V1-V2/atomic/replay/crypto: PRESERVED

Cross-source reuse production-reachable: YES
Source B authority independent of binding A->T: YES
Binding B->T created only in conversion B: YES
Recovery QA feasible: YES
Authorization substitution prevented: YES
Relationship scope substitution prevented: YES
Six no-relock cores implementable without guessing: YES
Full two-session root QA implementable without sleep-only orchestration: YES
Student semantics closed: YES
Guardian semantics closed: YES
Relationship semantics closed: YES
Atomic rollback preserved: YES
Exact replay preserved: YES
P3D0 preserved: YES
Inherited migration edit required: NO
P3A normative reopen required: NO

P3D-R0 FINAL DESIGN CLOSURE: READY FOR FINAL INDEPENDENT DESIGN RE-AUDIT
```

This is not P3D PASS, P3D DONE, implementation authorization, remote-apply
authorization, P4 readiness or product end-to-end readiness.

F23.3E-P3D-R0 FINAL DESIGN CLOSURE COMPLETE — READY FOR FINAL INDEPENDENT DESIGN RE-AUDIT
