# F23.3E-P3A — Real Conversion Dependency Closure and Atomic Executor Design Freeze

## Status and boundary

```text
F23_3E_P3A_STATUS: DESIGN COMPLETE IN REPO
F23_3E_P3A_FINAL_TECHNICAL_AUDIT: PASS
P3A_P1B_ACTION_GRAPH_DIGEST_PROVENANCE: CALLER_SUPPLIED_OPAQUE_32_BYTE_BINDING

F23_3E_P3A_MIGRATION_CREATED: NO
F23_3E_P3A_RUNTIME_IMPLEMENTATION: NOT STARTED

P3A_P2_FOUNDATION_ACCEPTED: YES
P3A_REAL_CONVERSION_CURRENTLY_READY: NO

P3A_P3_BLOCKER_INPUT_COUNT: 7
P3A_P3_BLOCKER_DISPOSITION_COUNT: 7

P3A_STEP_UP_AUTHORITY_DESIGN: COMPLETE
P3A_FINAL_CAPABILITY_DESIGN: COMPLETE
P3A_SINGLE_USE_AUTHORITY_DESIGN: COMPLETE

P3A_STUDENT_TARGET_RUNTIME_DESIGN: COMPLETE
P3A_GUARDIAN_TARGET_RUNTIME_DESIGN: COMPLETE
P3A_RELATIONSHIP_RUNTIME_DESIGN: COMPLETE

P3A_ATOMIC_EXECUTOR_DESIGN: COMPLETE

P3A_P3B_IMPLEMENTATION_APPROVAL: SAFE_TO_REQUEST
P3A_P3C_IMPLEMENTATION_APPROVAL: BLOCKED
P3A_P3D_IMPLEMENTATION_APPROVAL: BLOCKED

F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
F23_3E_P3_REMOTE_APPLY: NOT RUN
F23_3E_P3_AUTH_CHANGE: NO
F23_3E_P3_EDGE_FUNCTION_CHANGE: NO
F23_3E_P3_DEPLOY: NOT RUN
```

P3A started from clean `main` at
`8c1cacea59e7bb0c9a13d51e2ebf63efdae97546`, with `origin/main` and
`origin/HEAD` on the same commit. It creates exactly this report and its
semantic smoke. It creates no migration, SQL, target row, Auth state, Edge
Function, remote state, deployment, import, browser wiring, or conversion.

`SAFE_TO_REQUEST` means P3B has an auditable local implementation contract. It
does not approve implementation by itself. P3C is sequentially blocked until
P3B is implemented and audited because P3C writes the action child and binds
target evidence to P3B security/action resources. P3D is sequentially blocked
until both P3B and P3C are implemented and audited. These are implementation
ordering gates, not unresolved design blockers.

External technical audit closeout on 2026-08-12: PASS. The audit accepted the
dependency closure, implementation split, independent legacy/P3 digest
provenance, post-APPROVED action-version authority binding, executor ordering
and exact replay contract without further design change.

## Repository truth inventory

The inventory was read from physical migrations and current runtime, not from
filenames or design claims.

| Area | Physical/runtime truth | P3 consequence |
|---|---|---|
| P2D gate | P2 search, review, reservation, integrated races and fault rollback passed; seven P3 prerequisites remain. | Accept the P2 foundation without treating a missing P3 runtime as a P2 defect. |
| P2A | `crm_identity_policy_registry`, fixed-size `crm_identity_match_mutex`, immutable terminal `crm_identity_match_review`, and non-rebindable `crm_profile_creation_reservation` exist with forced RLS and no direct application grants. Reservation already allows `ACTIVE → CONSUMED` with server time and version `+1`. | Reuse these resources and their exact versions; P3D owns the first consume path. |
| P2B | Exact-center legacy Student adapter `legacy.center_cloud_student.readonly.v1` is detection-only and always returns `reuse_eligible=false`; Guardian returns `MATCH_SEARCH_UNAVAILABLE`. | P3C adds canonical adapters while retaining legacy rows as detection-only. |
| P2C | Review/decision/reservation mutations are protected and atomic, but Guardian is blocked, create reservation uses `future.student.profile.v1`, and no profile, relationship, approval, consume, or completion exists. | P3C replaces only the internal adapter/decision dispatch forward; P3D composes consumption. |
| Request | `crm_conversion_request` physically supports `DRAFT`, `READY_FOR_REVIEW`, `APPROVED`, `EXECUTING`, `COMPLETED`, `CONFLICT`, `REJECTED`, `CANCELLED`, `SUPERSEDED`, and `COMPENSATION_REQUIRED`. It stores source versions, policy versions, intent and a legacy caller-supplied opaque 32-byte `action_graph_digest`, but not typed action rows. The current guard reserves approval/execution states for future runtime. | Preserve the status vocabulary and the legacy digest without reinterpretation; add a child action aggregate, a separately derived P3 action-set digest and forward-only guarded transitions. |
| Idempotency | `crm_idempotency_registry` is the center/resource/operation/key root and stores immutable exact P1/P2 result families. | Extend this registry with one structurally safe P3 result family; do not create a second registry. |
| Audit/Outbox | `crm_audit_event` and `crm_outbox_event` are forced-RLS, append/delivery guarded, safe-payload constrained, and transactionally composed by P1/P2. | Extend finite aggregate/event allowlists; append last in the same transaction. |
| Contact/Case | `crm_contact` is source evidence, not Guardian. `consultation_case` supports `READY_FOR_CONVERSION`, `CONVERTED`, and `conversion_state=COMPLETED`; current guards reserve conversion for the future executor. | Guardian remains distinct; P3D performs the protected terminal Case transition. |
| Candidate/Assignment | Candidate Student is evidence, not a Student. Candidate supports `CONVERTED`; Assignment has a versioned `ACTIVE/ENDED/REVOKED/SUPERSEDED` lifecycle and exact active pointer from Case. | Lock and recheck both; P3D terminalizes converted candidates and ends the active Assignment. |
| P1D/P1E | Current protected services treat actor IDs as service attribution/minimum eligibility, and P1E has an interim exact-center role/assignment read gate. Both explicitly say the final capability resolver is absent. | P3B must derive final approval authority from current protected state, not reuse the interim gate as final authority. |
| F23.13C | Audited design defines one account-security source, server-issued purpose/resource-bound single-use step-up, business-root-before-security composite locks, and atomic assertion consumption. Runtime and canonical account lifecycle are absent. | P3B implements the compatible minimum canonical account-security/step-up projection locally; missing or unverifiable state denies. |
| F23.13D | Audited design defines server-derived exact-center capability, account/membership/policy/assignment/security checks, deny precedence, and no client role/capability authority. Runtime is absent. | P3B implements the conversion-specific final resolver; it does not claim the whole F23.13D product runtime. |
| F23.2 | Guardian and Student are distinct center-scoped profiles; Guardian–Student is an independent M:N aggregate; Contact/candidate are sources; exact reviewed reuse, complete relationship action, and atomic conversion are normative. Runtime is absent. | P3C creates protected canonical resources and P3D composes only an approved complete action plan. |
| Membership | `center_members` has UUID membership ID, center, user, role, status and timestamps, with exact-center/user uniqueness, but no membership version. Current machine tokens include `owner`, `center_admin`, `consultant`; legacy admin aliases exist in older write policy. | P3B adds monotonic `membership_version`; final conversion approval policy uses only an explicit server catalog and never a caller role string. |
| Account/Auth | `auth.users` exists, but there is no `account_security_control`, canonical lifecycle/session version, MFA challenge, or step-up assertion table. Service-role calls do not carry an authoritative end-user step-up fact. | Current metadata cannot directly satisfy fresh purpose-bound conversion approval. A trusted Auth-verifier bridge plus protected DB evidence is required. |
| Student storage/writers | Student records are local-first and mirrored through generic JSON `center_cloud_entities`; browser code upserts by `(center_id, entity_type, local_id)`. The table has broad active-member policies and is in Realtime. Writers do not lock `crm_identity_match_mutex`. | Keep as legacy detection/projection only. It cannot become the executor writer or canonical authority. |
| Guardian/relationship storage | No physical canonical Guardian table, Guardian adapter, or Guardian–Student relationship table exists. Embedded parent fields and phone grouping are presentation evidence only. | New protected canonical resources are required. |

```text
F23.13C design exists != step-up runtime exists
F23.13D design exists != capability resolver exists
F23.2 design exists != Guardian–Student relationship runtime exists
```

No repository contradiction requires a scope change outside F23.3E. The
missing runtime is precisely the P3 implementation work. Production Auth
verification, real users/data, generic-cloud remediation, deployment, and
rollout remain separately gated.

### P1B action-graph digest provenance correction

The physical P1B migration is authoritative for the legacy field. Its create
RPC accepts `p_action_graph_digest bytea`, validates only non-null length 32,
and writes that value directly to `crm_conversion_request.action_graph_digest`
and the P1B idempotency row. Its DRAFT update RPC accepts
`p_new_action_graph_digest bytea` and executes
`action_graph_digest = p_new_action_graph_digest`. Review submission compares
the caller's expected value with the stored value but never serializes or
derives a graph. P1B therefore defines no canonical action serializer.

P3 freezes two independent digest domains:

- `legacy_request_action_graph_digest` is the exact current
  `crm_conversion_request.action_graph_digest`: a caller-supplied opaque P1B
  historical binding. P3 snapshots it when the typed plan is finalized and
  preserves it immutably in each authority. P3 never rewrites, canonicalizes,
  or interprets old Request values.
- `p3_canonical_action_set_digest` is a P3 server-derived, deterministic,
  versioned digest computed only from locked typed persisted
  `crm_conversion_action` rows and their frozen bindings. Its storage name is
  `p3_action_set_digest`; encoding version 1 is stored independently.

Neither domain proves the other, and equality between them is neither required
nor meaningful. Authority issuance binds both independently. The executor
rechecks the current Request legacy binding and recomputes the typed P3 action
set before any mutation.

```text
P3_LEGACY_REQUEST_ACTION_GRAPH_DIGEST_IS_CANONICAL_GRAPH: NO
P3_CANONICAL_ACTION_SET_DIGEST_IS_SERVER_DERIVED: YES
P3_CANONICAL_ACTION_SET_DIGEST_MUST_EQUAL_LEGACY_REQUEST_DIGEST: NO
P3_ACTION_SET_ENCODING_VERSION: 1
P3_ACTION_SET_DIGEST_BINDS_ACTION_VERSION: YES
P3_AUTHORITY_BINDS_ACTION_SET_LIFECYCLE_STATE: APPROVED
P3_FINALIZE_DIGEST_COMPUTED_AFTER_REVIEWED_VERSION_INCREMENT: YES
P3_AUTHORITY_DIGEST_COMPUTED_AFTER_APPROVED_VERSION_INCREMENT: YES
P3_AUTHORITY_BINDS_PRE_APPROVAL_ACTION_DIGEST: NO
P3_ACTION_APPROVAL_TRANSITION_OWNER: SECURITY_ISSUE_CONVERSION_AUTHORITY
P3_EXECUTOR_RECHECKS_APPROVED_ACTION_SET_DIGEST: YES
P3_EXECUTED_ACTION_VERSION_CHANGE_INVALIDATES_LIVE_AUTHORITY_DIGEST_MATCH: EXPECTED
P3_EXACT_REPLAY_REHASHES_EXECUTED_ACTIONS_AGAINST_APPROVED_AUTHORITY_DIGEST: NO
```

## Seven blocker dispositions

| P2D blocker input | Disposition | Owner and closure evidence required |
|---|---|---|
| `P3_STEP_UP_AUTHORITY_RUNTIME: BLOCKED_PREREQUISITE` | `P3B_NEW_PROTECTED_RUNTIME_REQUIRED` | P3B adds one canonical account-security control, one conversion-purpose step-up assertion projection, a trusted verifier-ingest boundary, freshness/purpose/session/center/version checks, and atomic assertion consumption at authority issuance. |
| `P3_FINAL_CAPABILITY_RUNTIME: BLOCKED_PREREQUISITE` | `P3B_NEW_CONVERSION_SPECIFIC_RESOLVER_REQUIRED` | P3B derives current account, membership, exact center, finite server policy, separation, current source Assignment, account security, step-up, Request and policy versions. |
| `P3_STUDENT_CREATE_TARGET_WRITE: BLOCKED_PREREQUISITE` | `P3C_NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED` | P3C creates `student_profile`; its internal writer uses the reservation target ID, locks current Student identity mutexes, versions the row, and emits no browser grant. |
| `P3_STUDENT_REUSE: BLOCKED_PREREQUISITE` | `P3C_CANONICAL_ADAPTER_AND_COMMITTED_SOURCE_BINDING_REQUIRED` | P3C may return reusable only for a current canonical Student plus a current committed source-to-target binding and exact reviewed match. Name/birth remains detection/review evidence. |
| `P3_GUARDIAN_CREATE: BLOCKED_PREREQUISITE` | `P3C_NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED` | P3C creates `guardian_profile`, Guardian candidate detection, review/reservation support and an internal reservation-bound writer. Contact remains source evidence. |
| `P3_GUARDIAN_REUSE: BLOCKED_PREREQUISITE` | `P3C_CANONICAL_ADAPTER_AND_COMMITTED_SOURCE_BINDING_REQUIRED` | Reuse requires exact-center canonical Guardian, current version, current committed Contact binding, current terminal review and authority; phone/email/name/operator confirmation alone never qualify. |
| `P3_GUARDIAN_STUDENT_RELATIONSHIP_WRITE: BLOCKED_PREREQUISITE` | `P3C_NEW_INDEPENDENT_PROTECTED_AGGREGATE_REQUIRED` | P3C creates an exact-center M:N aggregate and internal writer; P3D composes create/reuse/update only after both endpoints are current. |

All seven inputs have exactly one concrete disposition. None silently becomes
implemented or production-ready in P3A.

## Canonical target decisions

```text
P3_STUDENT_CANONICAL_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED
P3_STUDENT_CREATE_WRITER_PLAN: P3C_INTERNAL_RESERVATION_BOUND_MUTEX_PARTICIPATING_WRITER
P3_STUDENT_REUSE_AUTHORITY_PLAN: EXACT_REVIEW_PLUS_CURRENT_COMMITTED_SOURCE_BINDING

P3_GUARDIAN_CANONICAL_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED
P3_GUARDIAN_CREATE_WRITER_PLAN: P3C_INTERNAL_RESERVATION_BOUND_MUTEX_PARTICIPATING_WRITER
P3_GUARDIAN_REUSE_PLAN: EXACT_REVIEW_PLUS_CURRENT_COMMITTED_SOURCE_BINDING

P3_GUARDIAN_STUDENT_RELATIONSHIP_RESOURCE: NEW_PROTECTED_CANONICAL_RESOURCE_REQUIRED
P3_SEPARATE_ACTION_AGGREGATE_REQUIRED: YES
P3_SEPARATE_ACTION_PLAN_AGGREGATE_REQUIRED: NO
```

### Why `center_cloud_entities` is not canonical Student

It is generic JSON with a text local ID, direct browser writes, broad active
member policies, Realtime membership, no Student FK/lifecycle constraint, no
monotonic Student version, no reservation FK, and no identity-mutex writer
contract. Its current adapter uses the generic row UUID as an opaque detection
target and deliberately denies reuse. Declaring it canonical would weaken
security and integrity, not avoid unnecessary schema.

P3C keeps `legacy.center_cloud_student.readonly.v1` as detection-only. Legacy
rows can block/create review but cannot be reused or mutated by conversion.
Future reviewed import may populate `student_profile.legacy_local_id` while
preserving `(center_id, local_id)`; P3 does not run that import or silently
re-key existing Students.

```text
P3_STUDENT_TARGET_ADAPTER_NAMESPACE: canonical.student_profile.v1
P3_GUARDIAN_TARGET_ADAPTER_NAMESPACE: canonical.guardian_profile.v1
P3_RELATIONSHIP_ADAPTER_NAMESPACE: canonical.guardian_student_relationship.v1
P3_PRE_P3C_FUTURE_NAMESPACE_RESERVATION_EXECUTABLE: NO
P3_LEGACY_STUDENT_ADAPTER_REUSE_ELIGIBLE: NO
```

An old `future.student.profile.v1` reservation or legacy-target review is not
silently upgraded. It must be superseded through the existing protected P2
flow and recreated against the current canonical namespace/evidence after P3C.
No target ID is rebound.

### Why Contact/candidate cannot be targets

`crm_contact` may be incomplete or represent a third party and stores outreach
evidence; it is not a Guardian. `consultation_case_candidate_student` is
case-scoped evidence; it is not a Student. Both remain source FKs/provenance.

### Why an action child is required

The Request physically stores only the opaque legacy
`action_graph_digest`; P2 rows store individual identity action IDs/digests but
no complete Guardian–Student pair decision, relationship type, endpoint
coverage, or no-relationship exception. The legacy value cannot reconstruct or
prove a typed P3 plan. `crm_conversion_action` is therefore a versioned child
of the existing Request, not a new Request/root, and its rows are the plan: no
second action-plan table is introduced. P3 derives its own versioned canonical
action-set digest from those rows without comparing it to the legacy Request
digest.

## P3A–P3D split and migration ownership

| Phase | Frozen scope | Migration expectation | Gate |
|---|---|---|---|
| P3A | Dependency closure and executor design freeze. | Zero migrations. | Current artifact; external technical audit required. |
| P3B | Account-security/step-up projection, final conversion capability resolver, action child foundation, single-use conversion authority, issuance/status/revoke/expire, P3 idempotent-result family. No target/profile or conversion execution. | At most one forward migration; no checkpoint edit. | Safe to request after P3A audit. |
| P3C | Canonical Student, Guardian, source binding and relationship resources; canonical search/reuse adapters; reviewed action-plan materialization; internal writers and mutex/version/event contracts. No authority consume, reservation consume, or Request completion. | At most one forward migration; no checkpoint edit. | Blocked until P3B local/audit PASS. |
| P3D | Atomic executor, conversion-authority consume, reservation consume, target composition, Request/Case/Candidate/Assignment final transitions, exact replay and integrated race/fault QA. | At most one forward migration; no checkpoint edit. | Blocked until P3B and P3C local/audit PASS. |

No P3E is required by current evidence.

## Fresh step-up strategy

Current Supabase/Auth metadata cannot directly provide the required fact to a
service-role database call. `auth.users` proves only account existence; the
current repo has no logical security-session version, purpose-bound challenge,
server verification time, or single-use assertion. A browser boolean,
timestamp, JWT field copied by a caller, role label, or UI MFA badge is never
accepted.

P3B therefore defines this local/runtime prerequisite:

1. A trusted server Auth-verifier validates the current end-user session and a
   recent strong verification event against the Auth provider. It derives the
   canonical user, logical session, assurance, verification reference and
   server-observed verification time. It never accepts these as browser truth.
2. The verifier calls the service-only, typed
   `security.record_verified_conversion_step_up` boundary. The database locks
   `account_security_control`, requires `ACTIVE`, binds current security,
   session and assurance-policy versions, exact center, purpose
   `crm.real_conversion.execute`, exact Request resource and a maximum
   five-minute freshness/expiry window, then creates one `ISSUED` assertion.
3. `security.issue_conversion_authority` consumes that assertion atomically
   with the Request approval and authority insert. The assertion cannot be
   used for another purpose, resource, center, session or authority.
4. P3B local QA may use a synthetic trusted-verifier fixture. This is not Auth
   configuration, production verification, or real-user proof.

```text
BROWSER_SUPPLIES_ROLE: NO
BROWSER_SUPPLIES_CENTER_AUTHORITY: NO
BROWSER_SUPPLIES_STEP_UP_TRUTH: NO
BROWSER_SUPPLIES_MATCH_DECISION_AS_AUTHORITY: NO
BROWSER_SUPPLIES_TARGET_REUSE_AUTHORITY: NO

P3_CALLER_ROLE_STRING_IS_AUTHORITY: NO
P3_CALLER_CENTER_ID_IS_AUTHORITY: NO
P3_SERVICE_ROLE_ITSELF_IS_END_USER_AUTHORITY: NO
```

Service role is only the protected application transport. End-user authority
is the intersection of a verified actor/session assertion, current canonical
account security, exact active membership, finite server policy, separation
rules, current Request/source/Assignment, and current P2/P3 evidence.

## Final conversion capability resolver

Conceptual operation:

```text
security.evaluate_conversion_capability(
  actor_user_id,
  conversion_request_id,
  requested_operation,
  step_up_assertion_id
)
```

The exposed SQL shape does not accept role, authoritative center, assignment
claim, MFA boolean, capability claim, policy version, or arbitrary resource.
Center, Case, Contact, Assignment and source versions are derived by joining
the Request. The resolver evaluates, in this exact order:

1. exactly one `center_crm_control` row; center and CRM runtime `ACTIVE` plus
   feature flag `ENABLED`;
2. exactly one `account_security_control` for actor, lifecycle `ACTIVE`, and
   current security/session/assurance-policy versions;
3. exact `center_members` row with `status='active'`, current
   `membership_version`, and a machine role present in the finite conversion
   policy compiled for the current `conversion_policy_version`;
4. immutable deny and separation: `consultant` cannot approve/issue final
   conversion authority; issuer cannot equal `requested_by_user_id` or the
   active assigned consultant; unknown/legacy role tokens deny unless an
   explicit current policy row/migration maps them;
5. exact current Request in `READY_FOR_REVIEW`, exact intent and current opaque
   legacy Request action-graph binding, plus current source/policy versions;
6. exact Case `READY_FOR_CONVERSION` with `conversion_state='REVIEW_PENDING'`,
   current Contact, candidates and current active Assignment; Assignment is
   required as source validity even when approver is Owner/Admin;
7. complete reviewed action child, current terminal reviews/reservations and
   target evidence;
8. exact `ISSUED`, current, unexpired, purpose/resource/center/session-bound
   step-up assertion.

The initial finite approval catalog grants
`crm.real_conversion.approve` only to current exact-center `owner` and
`center_admin`. Compatibility aliases require an explicit reviewed policy
mapping; they do not inherit authority from older broad cloud-write policies.
`consultant` may retain request/review operations through their own protected
contracts only when the current Assignment matches, but cannot issue final
authority. Deny or unavailable dependency wins.

The decision returns only `ALLOW`/`DENY`, a finite reason code, operation,
center, actor/membership/security/session/policy/Request/Assignment versions,
required assurance and step-up binding. It is not a bearer token. Only an
`ALLOW` consumed inside authority issuance has effect.

## Single-use authority and approval lifecycle

### Exact purpose and binding

```text
P3_CONVERSION_AUTHORITY_PURPOSE: crm.real_conversion.execute
P3_STEP_UP_ASSERTION_SINGLE_USE: YES
P3_CONVERSION_AUTHORITY_SINGLE_USE: YES
P3_RAW_STEP_UP_REUSED_BY_EXECUTOR: NO
```

Each `crm_conversion_authority` binds immutable:

- environment fingerprint, center, actor, membership ID/version;
- Request ID/version after approval, Case/Contact/Assignment IDs and versions;
- exact conversion intent and immutable legacy Request action-graph digest;
- P3 action-set encoding version and server-derived canonical action-set
  digest over the post-transition persisted `APPROVED` typed action rows;
- ordered match-review IDs/versions digest;
- ordered reservation IDs/versions digest;
- ordered reusable target IDs/versions digest;
- step-up assertion ID/version, account security/session/assurance-policy
  versions and verification evidence digest;
- identity/conversion/relationship/student-profile policy versions;
- purpose `crm.real_conversion.execute`, issued/expiry server times and opaque
  authority UUID.

No plaintext bearer secret, MFA answer, access token, raw verification
payload, or reusable nonce is stored. The opaque authority ID is only a
selector; possessing it without all current state is not authority.

### States

```text
ISSUED → CONSUMED
ISSUED → EXPIRED
ISSUED → REVOKED
ISSUED → SUPERSEDED
```

All terminal states are immutable. Every successful transition increments
`authority_version` exactly once and writes server terminal time/reason.
`CONSUMED` is allowed only inside `conversion.execute` before expiry and after
all current-state checks. Two active authorities for the same Request/P3
action set are prevented by the Request lock and a partial unique backstop.

### Exact P3B storage shapes

`account_security_control` is the compatible minimum implementation of the
F23.13C canonical parent, not a second conversion-only copy:

```text
canonical_user_id uuid PK/FK auth.users
account_lifecycle ACTIVE | SUSPENDED | DISABLED | REVOKED
security_version integer
session_version integer
identity_control_version integer
factor_control_version integer
assurance_policy_version integer
account_evidence_digest bytea(32)
control_version integer
created_at timestamptz
updated_at timestamptz
terminal_at timestamptz nullable
```

All versions are positive. `ACTIVE` has no terminal time; `REVOKED` is
terminal. Security/session/account-evidence changes require a trusted protected
sync, version `+1`, Audit/Outbox and current server time. Migration/bootstrap
does not label an existing account active merely because `auth.users` contains
a row. The trusted server account verifier uses
`security.register_or_sync_account_security_control`; missing/unverified rows
remain deny. This is a local protected projection and no Auth mutation.

`account_step_up_assertion` has this exact shape:

```text
step_up_assertion_id uuid PK
canonical_user_id uuid
logical_security_session_id uuid
center_id text
conversion_request_id uuid
purpose text = crm.real_conversion.execute
assurance_level AAL2_TOTP | AAL2_PHISHING_RESISTANT | AAL3_HARDWARE_BACKED
verification_provider_namespace text
verification_reference_digest bytea(32)
security_version integer
session_version integer
assurance_policy_version integer
status ISSUED | CONSUMED | EXPIRED | REVOKED | SUPERSEDED
assertion_version integer
issued_at timestamptz
expires_at timestamptz
terminal_at timestamptz nullable
terminal_reason_code text nullable
consumed_by_authority_id uuid nullable, deferred FK
```

The server enforces `expires_at <= issued_at + 5 minutes`. The assertion's
binding columns never change. `consumed_by_authority_id` is set only on
`ISSUED → CONSUMED` in the authority issuance transaction and is unique, so an
assertion cannot mint two authorities.

`crm_conversion_action` has this exact superset shape with typed checks rather
than an arbitrary payload:

```text
conversion_action_id uuid PK
center_id text
conversion_request_id uuid
legacy_request_action_graph_digest bytea(32)
action_kind
  CREATE_NEW_STUDENT | REUSE_REVIEWED_STUDENT | DO_NOT_CREATE_STUDENT |
  CREATE_NEW_GUARDIAN | REUSE_REVIEWED_GUARDIAN | DO_NOT_CREATE_GUARDIAN |
  CREATE_RELATIONSHIP | REUSE_EXISTING_RELATIONSHIP |
  UPDATE_APPROVED_RELATIONSHIP_ROLE | REQUIRE_RELATIONSHIP_REVIEW |
  DO_NOT_CREATE_RELATIONSHIP
identity_kind STUDENT | GUARDIAN nullable
action_intent_digest bytea(32)
source_contact_id uuid nullable
source_candidate_student_id uuid nullable
match_review_id uuid nullable
profile_creation_reservation_id uuid nullable
target_adapter_namespace text nullable
opaque_target_id uuid nullable
expected_target_version integer nullable
student_target_id uuid nullable
guardian_target_id uuid nullable
guardian_action_id uuid nullable
student_action_id uuid nullable
guardian_student_relationship_id uuid nullable
expected_relationship_version integer nullable
relationship_type text nullable
is_primary_contact boolean nullable
financial_contact_role text nullable
academic_contact_role text nullable
safe_reason_code text
relationship_policy_version integer nullable
status PROPOSED | REVIEWED | APPROVED | EXECUTED | SUPERSEDED
action_version integer
created_at timestamptz
updated_at timestamptz
```

Identity create actions require a `CREATE_NEW_REVIEWED` review plus `ACTIVE`
reservation and no target version. Identity reuse actions require an
`EXACT_REVIEWED_MATCH`, current target and no reservation. Relationship actions
require exact endpoint action IDs and their finite relationship fields; no-op
identity/relationship actions require explicit reviewed reason. Cross-kind
nullable combinations are rejected by shape constraints. Rows may be assembled
as `PROPOSED` per typed pair, then
`conversion.finalize_reviewed_action_plan` atomically checks total endpoint/pair
coverage, review/reservation/target currentness and expected action versions,
transitions every eligible row to `REVIEWED` with version `+1`, and only then
computes the authoritative REVIEWED digest from those persisted rows. P3B
authority issuance owns the complete `REVIEWED → APPROVED` version `+1`
transition and computes the authority digest afterward. P3D verifies that
APPROVED digest before mutation and changes all successfully executed rows to
`EXECUTED`, version `+1`, only after composition succeeds.

The P3 canonical serializer is
`f23_3e_p3b_internal_action_set_digest`. Encoding V1 is deterministic and
domain-separated. In this order it includes the encoding version, Request ID,
the legacy Request action-graph digest, then action rows ordered by
`conversion_action_id`, with each action ID, action version, action kind,
action-intent digest, identity kind, review and reservation bindings,
target namespace/ID/version, relationship endpoint IDs and finite relationship
fields, safe reason codes, and all relevant policy versions. Nullable values
use explicit typed null tags and byte/text lengths; UUID/integer/boolean/enum
encodings are fixed. Raw PII, display values, plaintext contact material and
security evidence are excluded.

Because encoding V1 includes `action_version`, every lifecycle-state digest is
computed only after the corresponding version transition is persisted inside
the same transaction:

```text
PROPOSED action-set digest = digest over current persisted PROPOSED rows
REVIEWED action-set digest = digest over persisted rows after PROPOSED → REVIEWED +1
APPROVED action-set digest = digest over persisted rows after REVIEWED → APPROVED +1
EXECUTED rows = terminal execution evidence after successful composition
```

`current_action_set_digest` returned by
`conversion.materialize_reviewed_action_pair` is diagnostic output for the
current PROPOSED rows. It is not the finalized REVIEWED digest and can never be
stored as the authority digest.

### P3C finalization lifecycle ordering

`conversion.finalize_reviewed_action_plan` performs one transaction:

```text
lock Request
lock the complete PROPOSED action rows
validate legacy Request binding, endpoint coverage, reviews, reservations,
reusable target evidence, source/policy state, expected action count/versions
transition every eligible action PROPOSED → REVIEWED +1
re-read or reuse RETURNING post-transition persisted REVIEWED rows
compute P3 action-set digest V1 from post-transition REVIEWED rows
append any required finalization Audit/Outbox
store the immutable finalization idempotency result
return finalized_action_set_digest, action_set_encoding_version,
post-transition max_action_version
commit
```

Concise frozen chain:

```text
P3C:
PROPOSED → REVIEWED +1
→ compute REVIEWED digest
```

The finalizer proves the legacy `Request.action_graph_digest` is unchanged from
every proposed action snapshot, but never compares the P3 digest with that
legacy value. Digest computation, finalization idempotency, and any required
Audit/Outbox are atomic with the REVIEWED transitions. Failure at any point
rolls back every version/status change, leaving no half-REVIEWED plan.

Before authority issuance, the complete locked `REVIEWED` rows are revalidated.
No extra action-plan aggregate is needed.

`crm_conversion_authority` has this exact shape:

```text
conversion_authority_id uuid PK
environment_fingerprint bytea(32)
center_id text
actor_user_id uuid
membership_id uuid
membership_version integer
conversion_request_id uuid
approved_request_version integer
consultation_case_id uuid
source_case_version integer
source_contact_id uuid
source_contact_version integer
source_assignment_id uuid
source_assignment_version integer
purpose text = crm.real_conversion.execute
conversion_intent_digest bytea(32)
legacy_request_action_graph_digest bytea(32)
p3_action_set_encoding_version integer
p3_action_set_digest bytea(32)
match_review_set_digest bytea(32)
reservation_set_digest bytea(32)
target_set_digest bytea(32)
step_up_assertion_id uuid
step_up_assertion_version integer
account_security_version integer
account_session_version integer
assurance_policy_version integer
identity_policy_version integer
conversion_policy_version integer
relationship_policy_version integer
student_profile_policy_version integer
status ISSUED | CONSUMED | EXPIRED | REVOKED | SUPERSEDED
authority_version integer
issued_at timestamptz
expires_at timestamptz
terminal_at timestamptz nullable
terminal_reason_code text nullable
consumed_by_idempotency_record_id uuid nullable
terminal_result_digest bytea(32) nullable
```

`expires_at` is the earlier of assertion expiry and five minutes after issuance.
Every binding is immutable. `consumed_by_idempotency_record_id` and result digest
exist only for `CONSUMED`; other terminal states have a finite reason and no
conversion result. P3 result extension columns on the existing registry are:

```text
p3_result_kind CONVERSION_AUTHORITY | REAL_CONVERSION nullable
p3_result_outcome_code text nullable
p3_result_snapshot jsonb nullable
p3_result_correlation_id uuid nullable
```

Exactly one of the P1, P2C or P3 completed-result families may be populated.
The P3 JSON is not generic business input: a database validator checks exact
keys, scalar types, finite codes, UUIDs, positive versions and timestamps, and
rejects any unknown key or free-form value.

### Issuance transaction

Authority issuance is the independent approval required by F23.2:

```text
BEGIN
lock CENTER_CRM_CONTROL_ROW
lock SORTED_IDENTITY_MUTEX_ROWS
lock ACCOUNT_SECURITY_CONTROL_ROW
lock STEP_UP_ASSERTION_ROW
lock MEMBERSHIP/CAPABILITY_SUPPORT_ROW
lock IDEMPOTENCY_REGISTRY + CONVERSION_REQUEST
lock CONVERSION_ACTION_ROWS
lock Contact / Case / Candidate / Assignment
lock current reusable target rows
lock MATCH_REVIEW_ROWS
lock ACTIVE PROFILE_CREATION_RESERVATION_ROWS
validate center, account/security, membership/capability, step-up,
Request READY_FOR_REVIEW, legacy Request digest, complete REVIEWED action rows,
reviews, reservations, targets, source and policy state
evaluate final capability and separation
consume step-up assertion
transition Request READY_FOR_REVIEW → APPROVED, version +1
transition every current action REVIEWED → APPROVED, action_version +1
re-read or reuse RETURNING persisted APPROVED action rows
compute P3 action-set digest V1 from post-transition APPROVED rows
insert ISSUED conversion authority bound independently to the approved Request
version/legacy digest and the P3 action-set encoding version/APPROVED digest
append mfa.step_up_consumed Audit/Outbox
append crm.conversion.approved Audit/Outbox
append crm.conversion.authority_issued Audit/Outbox
store exact authority idempotency result
COMMIT
```

Concise frozen chain:

```text
P3B:
REVIEWED → APPROVED +1
→ compute APPROVED digest
→ issue authority
```

`security.issue_conversion_authority` is the sole owner of the complete atomic
action approval transition. There is no standalone public action-approval RPC
and no partial action approval. The authority always binds the post-transition persisted APPROVED version set,
never the finalized REVIEWED digest. If any
later authority insert, idempotency, Audit/Outbox or validation step fails, the
transaction restores the Request and every action to their pre-issuance state
and leaves the step-up unconsumed.

Issuance creates/reuses no profile, writes no relationship, consumes no profile
reservation, and never completes the Request/Case.

## Canonical target and binding models

### `student_profile`

Exact columns frozen for P3C:

```text
student_id uuid
center_id text
legacy_local_id text nullable
display_name text
birth_evidence_protected bytea
profile_status ACTIVE | MERGE_REVIEW | ARCHIVED
learning_lifecycle_status nullable: Đang theo học | Bảo lưu | Ngưng học
identity_policy_registry_id uuid
normalization_version integer
match_policy_version integer
minimum_evidence_policy_version integer
name_lookup_digest bytea
birth_lookup_digest bytea
identity_evidence_digest bytea
student_version integer
created_from_case_id uuid
created_from_candidate_id uuid
created_from_request_id uuid
created_from_action_id uuid
created_by_user_id uuid
created_at timestamptz
updated_at timestamptz
archived_at timestamptz nullable
```

The PK is `student_id`; `(center_id, student_id)` is an exact-center key.
`legacy_local_id`, when populated only by a future reviewed import, is unique
within center and preserves the existing `(center_id, local_id)` identity.
Conversion-created rows use exactly the reservation UUID and never invent a
second ID. Name/birth digests are protected lookup material, never audit data.
The name+birth pair has a non-unique search index, not a uniqueness constraint:
same-name/same-birth may describe distinct people. Explicit mutex and current
projection recheck prevent blind concurrent duplicates.

`profile_status='ACTIVE'` means the canonical identity profile exists; it does
not mean enrolled. Conversion sets `learning_lifecycle_status=NULL` and has no
operation that changes enrollment, class, attendance, tuition or the existing
Vietnamese lifecycle vocabulary.

### `guardian_profile`

Exact columns frozen for P3C:

```text
guardian_id uuid
center_id text
display_name text
protected_contact_methods_ciphertext bytea
contact_methods_crypto_version integer
normalized_lookup_digests bytea[]
normalization_version integer
identity_evidence_digest bytea
guardian_status ACTIVE | INACTIVE | MERGE_REVIEW | ARCHIVED
guardian_version integer
created_from_contact_id uuid
created_from_case_id uuid
created_from_request_id uuid
created_from_action_id uuid
created_by_user_id uuid
created_at timestamptz
updated_at timestamptz
archived_at timestamptz nullable
```

The PK and exact-center key mirror Student. Contact methods stay protected.
Lookup digests are detection evidence, not uniqueness or reuse authority.
Conversion creates an `ACTIVE` profile only from a current reviewed Guardian
action; it does not create/link Auth accounts or memberships.

P3C re-protects source evidence for the target's table/AAD/crypto version via
an internal protected crypto helper; it never assumes Contact/Candidate
ciphertext is portable between aggregates. Missing key, invalid envelope or
adapter outage returns a typed dependency-unavailable result and rolls back.

### Identity mutex domains

Student create/reuse re-derives and locks the exact P2B V1
`STUDENT_DISPLAY_NAME` and `STUDENT_BIRTH_DATE` mutex keys from current source
evidence and policy, deduplicated and byte-sorted. Guardian uses the current
Contact normalization version and these versioned domains:

```text
GUARDIAN_DISPLAY_NAME
GUARDIAN_CONTACT_LOOKUP_DIGEST, one key per protected Contact lookup digest
GUARDIAN_SOURCE_BINDING, HMAC of exact center + crm_contact_id
```

Guardian keys contain only fixed-size HMAC output, never raw name, phone, email
or raw lookup digest. All keys across one action are deduplicated and byte-sorted.
Name/contact matches remain candidate signals. `GUARDIAN_SOURCE_BINDING` proves
serialization of the exact source, not person equality. The action's ordered
mutex-set digest must equal the review/reservation binding; key/policy drift
fails closed before any target lock.

### `crm_identity_target_binding`

This protected support aggregate supplies the additional authoritative reuse
evidence missing from name/birth/phone/email:

```text
identity_target_binding_id uuid
center_id text
identity_kind STUDENT | GUARDIAN
source_contact_id uuid nullable
source_candidate_student_id uuid nullable
student_id uuid nullable
guardian_id uuid nullable
binding_status ACTIVE | REVOKED | SUPERSEDED
binding_version integer
source_version_at_binding integer
target_version_at_binding integer
originating_request_id uuid
originating_action_id uuid
originating_review_id uuid
created_at timestamptz
terminal_at timestamptz nullable
```

Shape checks require Guardian = Contact + Guardian target and Student =
Candidate + Student target; exact-center FKs cover every non-null endpoint.
Only a committed P3D conversion may create the first binding. A current active
binding is required for `reuse_eligible=true`. A protected future identity
governance flow may revoke/supersede it; an operator click cannot create one.

### Exact reuse rule

Reuse requires all of:

```text
EXACT_REVIEWED_MATCH
+ current exact-center canonical target ID/version
+ current ACTIVE committed source-to-target binding
+ target adapter namespace/version current
+ current policy and projection snapshot
+ sorted identity mutex held
+ valid conversion authority
```

Name only, birth only, name+birth probable match, phone, email, shared contact,
or operator confirmation alone never sets `reuse_eligible=true`. If a legacy
or canonical candidate exists without the committed source binding, the result
is review/conflict, not reuse. A stale target returns `TARGET_VERSION_STALE`.

### Create rule

Create requires `CREATE_NEW_REVIEWED`, a current `ACTIVE` reservation, current
P2 policy/projection/evidence, the identity mutex, and valid authority. The
writer inserts exactly `reservation.preallocated_target_id`. It never uses a
new executor-time UUID or rebinds a reservation. Only after target plus binding
and required relationship succeed does P3D set reservation `CONSUMED` in the
same transaction.

## Guardian–Student relationship model

`guardian_student_relationship` is an independent business aggregate:

```text
relationship_id uuid
center_id text
guardian_id uuid
student_id uuid
relationship_type PARENT | LEGAL_GUARDIAN | CAREGIVER | EMERGENCY_CONTACT | OTHER_REVIEWED
is_primary_contact boolean
financial_contact_role NONE | PRIMARY | SECONDARY
academic_contact_role NONE | PRIMARY | SECONDARY
status ACTIVE | ENDED | ARCHIVED
relationship_version integer
effective_from timestamptz
effective_to timestamptz nullable
created_from_request_id uuid
created_from_action_id uuid
created_by_user_id uuid
created_at timestamptz
updated_at timestamptz
```

Every endpoint uses an exact-center FK. `ACTIVE` requires no `effective_to`;
`ENDED/ARCHIVED` require it and cannot silently reactivate. A partial unique
backstop prevents duplicate active equivalent
`(center, guardian, student, relationship_type)` rows. A separate partial
unique backstop enforces at most one active primary Guardian per Student; the
executor validates the approved exact-one/exception policy before commit.
Relationship type/contact-role changes require an explicit approved action and
version `+1`; they never grant identity or finance authority.

The complete action catalog is:

```text
CREATE_RELATIONSHIP
REUSE_EXISTING_RELATIONSHIP
UPDATE_APPROVED_RELATIONSHIP_ROLE
REQUIRE_RELATIONSHIP_REVIEW
DO_NOT_CREATE_RELATIONSHIP
```

Missing relationship action is never an approved no-op. A no-relationship
exception requires a finite reason, current relationship policy version and
explicit approval in the canonical typed action set.

## Physical resource proposal

Every table is forced-RLS, has no policy, has all direct privileges revoked
from `PUBLIC`, `anon`, `authenticated`, and `service_role`, and is excluded
from Realtime. Every exposed RPC is `SECURITY DEFINER`, uses an empty safe
`search_path`, is revoked from browser roles, and grants only `service_role`.
Every internal helper is revoked from all application roles including
`service_role`.

### P3B resources

| Resource | Kind/purpose | Exact integrity, privilege and Realtime disposition |
|---|---|---|
| Extend `center_members.membership_version` | Existing membership aggregate, forward-only. | Positive integer; guarded immutable identity and automatic `+1` on role/status change; new exact lookup index `(center_id,user_id,status,role,membership_version)`; existing RLS retained, no new browser mutation grant, no Realtime change. |
| `account_security_control` | Cross-feature canonical security root/support aggregate. | PK/FK `canonical_user_id`; `ACTIVE/SUSPENDED/DISABLED/REVOKED`; positive security/session/identity/factor/assurance versions; terminal/lifecycle timestamps; exactly one row required for authority and missing denies. Forced RLS/no direct grants/no Realtime. |
| `account_step_up_assertion` | Protected single-use security evidence. | Exact actor/session/center/purpose/resource, assurance, verification digest, bound security/session/policy versions, server issue/expiry, `ISSUED/CONSUMED/EXPIRED/REVOKED/SUPERSEDED`, immutable bindings/version `+1`; partial one-live request/purpose index. Forced RLS/no direct grants/no Realtime. |
| `crm_conversion_action` | Versioned child aggregate of current Request and the complete P3 plan. | PK action ID; exact-center Request FK; immutable `legacy_request_action_graph_digest` snapshot; finite typed decision; optional review/reservation/target/endpoints with decision-shape checks; action intent digest; all rows and their `action_version` participate in the P3 action-set serializer; protected-only `PROPOSED → REVIEWED → APPROVED → EXECUTED`, applicable pre-execution `SUPERSEDED`, exact version `+1`; unique Request/action and relationship-pair backstops. Forced RLS/no direct grants/no Realtime. |
| `crm_conversion_authority` | Single-use approval/execution authority aggregate. | Immutable independent legacy Request-digest and post-transition APPROVED P3 action-set bindings described above; `ISSUED/CONSUMED/EXPIRED/REVOKED/SUPERSEDED`; partial one-issued Request/action-set index; server expiry; version `+1`; exact FKs. Forced RLS/no direct grants/no Realtime. |
| Extend `crm_idempotency_registry` | Existing idempotency aggregate, forward-only. | Add one mutually exclusive P3 result family: `p3_result_kind`, safe `p3_result_snapshot`, finite outcome, correlation; terminal snapshot immutable; safe structural validator permits only opaque IDs, versions, codes and timestamps. Existing forced RLS/no grants/no Realtime retained. |
| Request lifecycle guard replacement | Trigger extension. | Preserve every P1 transition and terminal rule; add only protected `READY_FOR_REVIEW → APPROVED` for P3B. Direct table updates remain impossible. |
| `f23_3e_p3b_internal_guard_*` | Trigger helpers for security control, assertion, action, authority, P3 result. | Empty search path; no application execute grant. |
| `f23_3e_p3b_internal_evaluate_conversion_capability` | Canonical conversion-specific resolver. | Server state only; deny precedence; no reusable decision; internal only. |
| `f23_3e_p3b_internal_action_set_digest` | Canonical typed action-set serializer/digest. | Server-derived stable encoding V1 over locked persisted action rows including `action_version`; authoritative lifecycle digest is computed only after that lifecycle's version increment; independently includes the legacy Request binding but is never compared with it; no raw PII; internal only. |
| `f23_3e_p3b_internal_append_audit_outbox` | Finite event pair helper. | Validated event catalog/payload; same correlation; rollback on either insert; internal only. |
| `security.register_or_sync_account_security_control` | Trusted account-verifier RPC. | Service role only; creates/synchronizes the one canonical account row from verified server evidence; never activates from browser/account-ID claim alone. |
| `security.record_verified_conversion_step_up` | Trusted verifier-ingest RPC. | Service role only; typed actor/session/Request/verification reference; derives center/purpose/versions; no caller role/MFA boolean. |
| `security.evaluate_conversion_capability` | Safe diagnostic/preflight RPC. | Service role only; returns deny/allow plus safe current versions; decision itself grants nothing. |
| `security.issue_conversion_authority` | Protected approval/issuance RPC. | Service role only; consumes step-up, approves Request, transitions the complete REVIEWED action set to APPROVED `+1`, computes the post-transition APPROVED digest and issues the bound authority atomically; exact idempotency; no standalone/partial action approval. |
| `security.read_conversion_authority_status` | Safe status RPC. | Service role only; opaque status/version/expiry/result, no evidence payload. |
| `security.revoke_or_expire_conversion_authority` | Protected terminalization RPC. | Service role only; revoke requires current authority; expiry uses server time; neither mutates targets/Request completion. |

### P3C resources

| Resource | Kind/purpose | Exact integrity, privilege and Realtime disposition |
|---|---|---|
| `student_profile` | Canonical Student business aggregate. | Exact schema above; target UUID PK/exact-center key; non-unique protected digest search; optional unique legacy alias; version/lifecycle/provenance guards. Forced RLS/no direct grants/no Realtime. |
| `guardian_profile` | Canonical Guardian business aggregate. | Exact schema above; protected contact material, digest search, exact-center key, version/lifecycle/provenance guards. Forced RLS/no direct grants/no Realtime. |
| `crm_identity_target_binding` | Protected reuse-authority support aggregate. | Typed source/target shape, exact-center FKs, one active source binding, target lookup index, immutable provenance, terminal version guard. Forced RLS/no direct grants/no Realtime. |
| `guardian_student_relationship` | Independent M:N business aggregate. | Exact schema above; exact-center endpoint FKs, active-equivalent and primary partial unique backstops, lifecycle/version/effective-time guards. Forced RLS/no direct grants/no Realtime. |
| P2B internal search core replacement | Forward adapter dispatch. | Preserve V1 outcomes; add canonical Student/Guardian masked adapters; keep legacy Student detection-only; unavailable adapter/key remains `MATCH_SEARCH_UNAVAILABLE`; internal grants remain revoked. |
| P2C internal mutation core replacement | Forward review/reservation dispatch. | Remove only Guardian hard block when canonical adapter is current; replace future namespace with exact canonical namespace; preserve no-profile/no-consume behavior and all old replay/fault semantics. |
| `f23_3e_p3c_internal_guard_*` | Target/binding/relationship trigger helpers. | Exact immutable fields, lifecycle/version, policy and same-center checks; internal only. |
| `f23_3e_p3c_internal_protect_target_evidence` | Target-context crypto adapter. | Internal only; unwraps/re-protects through approved local key contract, returns no raw value, and fails closed on key/envelope drift. |
| `f23_3e_p3c_internal_create_student_target` | Reservation-bound Student writer. | Internal only; requires executor-held mutex/authority/current reservation; exact preallocated UUID; emits no standalone commit. |
| `f23_3e_p3c_internal_resolve_reusable_student` | Canonical masked resolver. | Current target + active source binding; legacy remains detection-only; internal/P2 search use only. |
| `f23_3e_p3c_internal_create_guardian_target` | Reservation-bound Guardian writer. | Symmetric internal-only create contract. |
| `f23_3e_p3c_internal_resolve_reusable_guardian` | Canonical masked resolver. | Current target + active Contact binding only; internal/P2 search use only. |
| `f23_3e_p3c_internal_upsert_guardian_student_relationship` | Approved relationship writer. | Internal only; exact endpoints/action/version; create/reuse/update finite behavior. |
| `conversion.materialize_reviewed_action_pair` | Narrow typed plan RPC. | Service role only; accepts Request plus exact Student/Guardian review IDs, a preallocated relationship action ID and finite relationship decision fields, not a JSON action list; derives targets/reservations and writes typed `PROPOSED` actions. It creates no target and grants no approval. |
| `conversion.finalize_reviewed_action_plan` | Narrow typed plan-finalization RPC. | Service role only; takes Request/expected version and idempotency material, validates the complete PROPOSED plan and opaque legacy Request binding, transitions all eligible rows to REVIEWED `+1`, then computes/stores/returns the canonical P3 digest from persisted REVIEWED rows; no target/approval. |

Conceptual identity operations map to internal helpers unless explicitly shown;
there is intentionally no directly granted profile-create or relationship-write
RPC.

### P3D resources

| Resource | Kind/purpose | Exact integrity, privilege and Realtime disposition |
|---|---|---|
| Request guard replacement | Forward trigger extension. | Preserve all prior rules; add protected `APPROVED → EXECUTING → COMPLETED`, terminal digest and exact version edges. No public direct mutation. |
| Case guard replacement | Forward trigger extension. | Preserve prior transitions; allow only protected `READY_FOR_CONVERSION/REVIEW_PENDING → CONVERTED/COMPLETED`, version `+1`, close time. |
| Candidate guard replacement | Forward trigger extension. | Preserve prior rules; allow executor-only current candidate `ACTIVE/REVIEW_REQUIRED → CONVERTED`, version `+1`. |
| Assignment guard use/extension | Existing aggregate transition. | Use existing `ACTIVE → ENDED`, version `+1`, server end time and reason `CASE_CONVERTED`; clear Case pointer. No new status. |
| Reservation guard use | Existing P2A aggregate transition. | Use existing `ACTIVE → CONSUMED`, version `+1`, reason `CONSUMED_BY_FUTURE_EXECUTOR`; replacement keeps every old rule. |
| P3 safe-result validator extension | Existing idempotency result family. | Accept exact real-conversion result shape: Request/Case/actions/Student/Guardian/relationship/authority IDs and versions, finite codes and correlation only. |
| `f23_3e_p3d_internal_execute` | Full atomic composition helper. | Recomputes/verifies the authority's APPROVED action-set digest before mutation, derives the plan from locked APPROVED action rows, performs composition, then transitions all executed actions to EXECUTED `+1`; no generic payload; internal only. |
| `f23_3e_p3d_internal_current_evidence` | Drift and completeness validator. | Exact ordered set equality; no silent refresh; internal only. |
| `f23_3e_p3d_internal_append_audit_outbox` | Finite conversion event helper. | Same transaction/correlation; fail injection must rollback; internal only. |
| `conversion.execute` | Protected typed executor RPC. | Service role only; Request ID, authority ID, expected Request/authority versions, environment/key/intent digests and opaque idempotency material; no caller center/role/action list. |
| `conversion.read_result_status` | Safe exact-result RPC. | Service role only; reads immutable idempotency result, never mutable target/action state and never rehashes EXECUTED rows against the APPROVED authority digest for replay. |

All three implementation phases retain the preferred maximum of one forward
migration each. If implementation evidence later proves that transactional DDL
cannot safely fit that bound, it must stop for a new design review rather than
split silently.

### Exhaustive proposed index, constraint and trigger catalog

The following names are the complete P3 proposal. Implementation may shorten a
name only if PostgreSQL's identifier limit requires it, while preserving the
same columns and semantics; it may not silently omit an invariant.

P3B forward additions:

| Type | Exact proposed names and semantics |
|---|---|
| Membership constraint/index/trigger | `center_members_membership_version_positive`; unique `center_members_conversion_version_binding_key(center_id,user_id,id,membership_version)`; index `center_members_conversion_capability_idx(center_id,user_id,status,role,membership_version)`; trigger `f23_3e_p3b_center_members_version_guard` using internal `f23_3e_p3b_internal_guard_center_members_version`. |
| Account-security constraints | `account_security_control_pkey`; `account_security_control_user_fkey`; `account_security_control_lifecycle_check`; `account_security_control_versions_positive`; `account_security_control_evidence_digest_size`; `account_security_control_terminal_mapping_check`; `account_security_control_timestamp_order_check`. |
| Account-security indexes/triggers | `account_security_control_lifecycle_idx(account_lifecycle,updated_at)`; trigger `f23_3e_p3b_account_security_control_guard` using `f23_3e_p3b_internal_guard_account_security_control`. |
| Step-up constraints | `account_step_up_assertion_pkey`; exact `*_user_fkey`, `*_center_fkey`, `*_request_exact_center_fkey`; `*_purpose_check`; `*_assurance_check`; `*_verification_digest_size`; `*_versions_positive`; `*_status_check`; `*_expiry_check`; `*_terminal_mapping_check`; `*_consumed_authority_unique`; `*_timestamp_order_check`. The `consumed_by_authority_id` FK is deferred until authority exists, then restricts delete. |
| Step-up indexes/triggers | Partial unique `account_step_up_assertion_one_issued_request_purpose_idx(center_id,canonical_user_id,conversion_request_id,purpose) WHERE status='ISSUED'`; `account_step_up_assertion_expiry_idx(expires_at) WHERE status='ISSUED'`; `account_step_up_assertion_session_idx(canonical_user_id,logical_security_session_id,status)`; trigger `f23_3e_p3b_account_step_up_assertion_guard` using `f23_3e_p3b_internal_guard_account_step_up_assertion`. |
| Action constraints | `crm_conversion_action_pkey`; exact `*_request_exact_center_fkey`, `*_contact_exact_center_fkey`, `*_candidate_exact_case_fkey`, `*_review_exact_center_fkey`, `*_reservation_exact_center_fkey`; self FKs `*_guardian_action_fkey`, `*_student_action_fkey`; `*_action_kind_check`; `*_identity_kind_check`; `*_digest_sizes_check` including the legacy Request snapshot; `*_status_check`; `*_versions_positive`; `*_identity_action_shape_check`; `*_relationship_action_shape_check`; `*_no_op_reason_check`; `*_timestamp_order_check`; unique `crm_conversion_action_request_action_key(center_id,conversion_request_id,conversion_action_id)`. P3C adds typed Student/Guardian/relationship FKs after those tables exist and checks typed IDs equal the P2 opaque target binding. |
| Action indexes/triggers | Partial unique `crm_conversion_action_relationship_pair_idx(center_id,conversion_request_id,guardian_action_id,student_action_id) WHERE action_kind LIKE '%RELATIONSHIP%'`; `crm_conversion_action_request_status_idx(center_id,conversion_request_id,status,conversion_action_id)`; trigger `f23_3e_p3b_conversion_action_guard` using `f23_3e_p3b_internal_guard_conversion_action`. The guard permits only protected `PROPOSED → REVIEWED`, `REVIEWED → APPROVED`, `APPROVED → EXECUTED`, and applicable `PROPOSED/REVIEWED → SUPERSEDED`, always exact version `+1`; browser/direct-table transitions are impossible. |
| Authority constraints | `crm_conversion_authority_pkey`; exact `*_center_fkey`, `*_root_fkey`, `*_actor_fkey`, `*_membership_version_fkey`, `*_request_exact_center_fkey`, `*_case_exact_center_fkey`, `*_contact_exact_center_fkey`, `*_assignment_exact_center_fkey`, `*_step_up_fkey`, `*_consumed_idempotency_exact_center_fkey`; `*_purpose_check`; `*_digest_sizes_check` for both legacy Request and P3 action-set digests; positive `p3_action_set_encoding_version`; other `*_versions_positive`; `*_status_check`; `*_expiry_check`; `*_terminal_mapping_check`; `*_timestamp_order_check`. |
| Authority indexes/triggers | Partial unique `crm_conversion_authority_one_issued_action_set_idx(center_id,conversion_request_id,p3_action_set_encoding_version,p3_action_set_digest) WHERE status='ISSUED'`; `crm_conversion_authority_expiry_idx(expires_at) WHERE status='ISSUED'`; `crm_conversion_authority_actor_idx(actor_user_id,status,expires_at)`; trigger `f23_3e_p3b_conversion_authority_guard` using `f23_3e_p3b_internal_guard_conversion_authority`. |
| P3 result constraints/triggers | `crm_idempotency_registry_p3_result_kind_check`; `*_p3_result_outcome_check`; `*_p3_result_safe_snapshot_check`; replacement `crm_idempotency_registry_completed_result_snapshot_check` with mutually exclusive P1/P2C/P3 families; replacement trigger `f23_3e_p3b_idempotency_snapshot_guard` using the old guard semantics plus `f23_3e_p3b_internal_guard_idempotency_snapshot`. |
| Event backstop | Partial unique `crm_outbox_event_p3_aggregate_event_version_idx(center_id,aggregate_kind,aggregate_id,event_type,event_version)` for the finite P3 aggregate kinds. Existing delivery lifecycle/indexes stay unchanged. |
| Lifecycle trigger | Replacement `f23_3e_p1a_request_lifecycle` still invokes the forward-compatible `f23_3e_p1a_guard_request_lifecycle`, whose P3B body preserves P1/P2 rules and adds issuance transition only. |

The action columns `student_target_id`, `guardian_target_id` and
`guardian_student_relationship_id` are nullable typed mirrors of the opaque P2
target fields. P3B creates them without target FKs; P3C adds the exact-center
FKs and equality/shape checks in its forward migration. No polymorphic target
ID is treated as a database FK.

P3C forward additions:

| Type | Exact proposed names and semantics |
|---|---|
| Student constraints | `student_profile_pkey`; exact `*_center_fkey`, `*_root_fkey`, `*_policy_exact_binding_fkey`, `*_created_case_exact_center_fkey`, `*_created_candidate_exact_case_fkey`, `*_created_request_exact_center_fkey`, `*_created_action_exact_request_fkey`, `*_created_by_fkey`; `*_center_student_key`; `*_legacy_local_id_check`; `*_profile_status_check`; `*_learning_lifecycle_check`; `*_digest_sizes_check`; `*_versions_positive`; `*_archive_mapping_check`; `*_timestamp_order_check`. |
| Student indexes/triggers | Partial unique `student_profile_legacy_local_id_idx(center_id,legacy_local_id) WHERE legacy_local_id IS NOT NULL`; non-unique `student_profile_identity_detection_idx(center_id,identity_policy_registry_id,name_lookup_digest,birth_lookup_digest,profile_status)`; trigger `f23_3e_p3c_student_profile_guard` using `f23_3e_p3c_internal_guard_student_profile`. |
| Guardian constraints | `guardian_profile_pkey`; exact `*_center_fkey`, `*_root_fkey`, `*_created_contact_exact_center_fkey`, `*_created_case_exact_center_fkey`, `*_created_request_exact_center_fkey`, `*_created_action_exact_request_fkey`, `*_created_by_fkey`; `*_center_guardian_key`; `*_display_name_check`; `*_ciphertext_check`; `*_lookup_digests_check`; `*_versions_positive`; `*_status_check`; `*_archive_mapping_check`; `*_timestamp_order_check`. |
| Guardian indexes/triggers | GIN `guardian_profile_lookup_digests_idx(normalized_lookup_digests)` plus `guardian_profile_center_status_idx(center_id,guardian_status,guardian_id)`; trigger `f23_3e_p3c_guardian_profile_guard` using `f23_3e_p3c_internal_guard_guardian_profile`. |
| Binding constraints | `crm_identity_target_binding_pkey`; exact `*_center_fkey`, `*_contact_exact_center_fkey`, `*_candidate_exact_case_fkey`, `*_student_exact_center_fkey`, `*_guardian_exact_center_fkey`, `*_request_exact_center_fkey`, `*_action_exact_request_fkey`, `*_review_exact_center_fkey`; `*_identity_kind_check`; `*_source_target_shape_check`; `*_status_check`; `*_versions_positive`; `*_terminal_mapping_check`; `*_timestamp_order_check`. |
| Binding indexes/triggers | Partial unique `crm_identity_target_binding_one_active_source_idx(center_id,identity_kind,source_contact_id,source_candidate_student_id) WHERE binding_status='ACTIVE'`; `crm_identity_target_binding_student_idx(center_id,student_id,binding_status)`; `*_guardian_idx(center_id,guardian_id,binding_status)`; trigger `f23_3e_p3c_identity_target_binding_guard` using `f23_3e_p3c_internal_guard_identity_target_binding`. Null-source uniqueness is backed by the shape-aware expression with a fixed zero UUID sentinel, never by SQL null equality alone. |
| Relationship constraints | `guardian_student_relationship_pkey`; exact `*_center_fkey`, `*_guardian_exact_center_fkey`, `*_student_exact_center_fkey`, `*_request_exact_center_fkey`, `*_action_exact_request_fkey`, `*_created_by_fkey`; `*_center_relationship_key`; `*_type_check`; `*_contact_roles_check`; `*_status_check`; `*_versions_positive`; `*_effective_interval_check`; `*_terminal_mapping_check`; `*_timestamp_order_check`. |
| Relationship indexes/triggers | Partial unique `guardian_student_relationship_one_active_equivalent_idx(center_id,guardian_id,student_id,relationship_type) WHERE status='ACTIVE'`; partial unique `guardian_student_relationship_one_active_primary_idx(center_id,student_id) WHERE status='ACTIVE' AND is_primary_contact`; endpoint indexes `*_guardian_idx(center_id,guardian_id,status)` and `*_student_idx(center_id,student_id,status)`; trigger `f23_3e_p3c_guardian_student_relationship_guard` using `f23_3e_p3c_internal_guard_guardian_student_relationship`. |
| Action target constraints | `crm_conversion_action_student_target_exact_center_fkey`; `*_guardian_target_exact_center_fkey`; `*_relationship_exact_center_fkey`; replacement `crm_conversion_action_identity_action_shape_check` requiring typed target = opaque target for canonical namespaces. |
| P2 dispatch | `CREATE OR REPLACE` the existing P2B internal core and P2C internal mutation core with unchanged signatures/grants; their existing exposed wrappers, RLS and idempotency contracts remain. No trigger/index removal. |

P3D forward additions/replacements:

| Type | Exact proposed names and semantics |
|---|---|
| Request/Case/Candidate triggers | Replace the bodies used by existing `f23_3e_p1a_request_lifecycle`, `f23_3e_p1a_case_lifecycle`, and `f23_3e_p1a_candidate_lifecycle` triggers. Preserve all prior paths; add only executor-authorized transitions and exact versions/timestamps. |
| Assignment/Reservation | No new index/status/constraint. Use existing `f23_3e_p1a_assignment_lifecycle` and `f23_3e_p2a_profile_creation_reservation_guard` paths exactly. |
| Result/event validators | `CREATE OR REPLACE f23_3e_p3b_internal_is_safe_result_snapshot` to add the exact `REAL_CONVERSION` shape; replace the safe Outbox payload validator with a strict superset of prior keys/event kinds. No existing safe payload becomes unsafe or unvalidated. |
| Executor helpers | `f23_3e_p3d_internal_current_evidence`, `f23_3e_p3d_internal_execute`, `f23_3e_p3d_internal_result_digest`, `f23_3e_p3d_internal_append_audit_outbox`; all internal grants revoked. |
| Protected executor functions | `f23_3e_p3d_execute_conversion` and `f23_3e_p3d_read_conversion_result_status`; exact service-role grants only. |

No proposed P3 table is added to `supabase_realtime`; no P3 direct table policy
is created. P4 may define a capability-aware application projection only after
P3 local audit and separate approval.

## Typed conceptual operation inventory

| Conceptual operation | Physical exposure | Owner | Authority/result |
|---|---|---|---|
| `security.register_or_sync_account_security_control` | Trusted service-role verifier RPC. | P3B | Current canonical account-security projection; no Auth mutation or business capability. |
| `security.record_verified_conversion_step_up` | Trusted service-role verifier RPC. | P3B | One short-lived Request/purpose-bound assertion. |
| `security.evaluate_conversion_capability` | Protected service-role RPC; internal resolver does the decision. | P3B | Safe preflight only; no bearer decision. |
| `security.issue_conversion_authority` | Protected service-role RPC. | P3B | Consumes one step-up, approves one Request, changes every current action REVIEWED → APPROVED `+1`, computes the persisted APPROVED digest, then issues one authority. |
| `security.read_conversion_authority_status` | Protected service-role RPC. | P3B | Opaque status/version/expiry. |
| `security.revoke_or_expire_conversion_authority` | Protected service-role RPC. | P3B | One guarded terminal transition. |
| `identity.create_student_target` | Internal helper only. | P3C | Callable only within executor transaction. |
| `identity.resolve_reusable_student` | Internal canonical adapter used by protected search. | P3C | Masked candidate plus binding-backed reuse flag. |
| `identity.create_guardian_target` | Internal helper only. | P3C | Callable only within executor transaction. |
| `identity.resolve_reusable_guardian` | Internal canonical adapter used by protected search. | P3C | Masked candidate plus binding-backed reuse flag. |
| `identity.upsert_guardian_student_relationship` | Internal helper only. | P3C | Exact approved action/endpoints/version. |
| `conversion.materialize_reviewed_action_pair` | Narrow service-role RPC. | P3C | Creates/updates reviewed child plan only. |
| `conversion.finalize_reviewed_action_plan` | Narrow service-role RPC. | P3C | Verifies the separate legacy Request binding and complete PROPOSED evidence, moves all eligible rows to REVIEWED `+1`, then derives/returns the canonical digest/version from persisted REVIEWED rows. |
| `conversion.execute` | Protected service-role RPC. | P3D | Atomic conversion and exact replay. |
| `conversion.read_result_status` | Protected service-role RPC. | P3D | Immutable safe committed result. |

### Frozen typed RPC contracts

The conceptual names above map to versioned physical `public.f23_3e_p3*`
functions. The logical signatures below are frozen; implementation may add
PostgreSQL defaults but may not add caller-authoritative center, role,
capability, MFA flag, action JSON or target choice.

```text
security.register_or_sync_account_security_control(
  actor_user_id uuid,
  verified_account_user_id uuid,
  verified_account_lifecycle text,
  account_evidence_digest bytea,
  expected_control_version integer nullable,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, canonical_user_id,
     security_version, session_version, control_version, correlation_id

security.record_verified_conversion_step_up(
  actor_user_id uuid,
  logical_security_session_id uuid,
  conversion_request_id uuid,
  assurance_level text,
  verification_provider_namespace text,
  verification_reference_digest bytea,
  server_verified_at timestamptz,
  expected_account_control_version integer,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, step_up_assertion_id,
     assertion_version, issued_at, expires_at, correlation_id

security.evaluate_conversion_capability(
  actor_user_id uuid,
  conversion_request_id uuid,
  step_up_assertion_id uuid,
  expected_request_version integer
) -> decision, reason_code, center_id, membership_id,
     membership_version, account_security_version, account_session_version,
     conversion_policy_version, assignment_id, assignment_version,
     required_assurance, step_up_assertion_version

security.issue_conversion_authority(
  actor_user_id uuid,
  conversion_request_id uuid,
  step_up_assertion_id uuid,
  expected_request_version integer,
  expected_step_up_assertion_version integer,
  environment_fingerprint bytea,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, conversion_authority_id,
     authority_version, request_status, request_version, expires_at,
     correlation_id

security.read_conversion_authority_status(
  actor_user_id uuid,
  conversion_authority_id uuid
) -> outcome_code, conversion_authority_id, status,
     authority_version, conversion_request_id, approved_request_version,
     issued_at, expires_at, terminal_at, terminal_reason_code

security.revoke_or_expire_conversion_authority(
  actor_user_id uuid,
  conversion_authority_id uuid,
  expected_authority_version integer,
  requested_transition REVOKED | EXPIRED,
  safe_reason_code text,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, status, authority_version,
     terminal_at, correlation_id

conversion.materialize_reviewed_action_pair(
  actor_user_id uuid,
  conversion_request_id uuid,
  expected_request_version integer,
  guardian_match_review_id uuid nullable,
  expected_guardian_review_version integer nullable,
  student_match_review_id uuid nullable,
  expected_student_review_version integer nullable,
  relationship_action_id uuid,
  relationship_decision text,
  relationship_type text nullable,
  is_primary_contact boolean nullable,
  financial_contact_role text nullable,
  academic_contact_role text nullable,
  safe_reason_code text,
  relationship_policy_version integer,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, guardian_action_id,
     student_action_id, relationship_action_id, action_versions,
     current_action_set_digest, action_set_encoding_version, correlation_id

conversion.finalize_reviewed_action_plan(
  actor_user_id uuid,
  conversion_request_id uuid,
  expected_request_version integer,
  expected_action_count integer,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, conversion_request_id,
     action_count, finalized_action_set_digest, action_set_encoding_version,
     max_action_version, correlation_id

conversion.execute(
  conversion_request_id uuid,
  conversion_authority_id uuid,
  expected_request_version integer,
  expected_authority_version integer,
  environment_fingerprint bytea,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
) -> ok, outcome_code, replayed, conversion_request_id,
     request_status, request_version, consultation_case_id, case_version,
     conversion_authority_id, authority_status, authority_version,
     executed_action_results, correlation_id

conversion.read_result_status(
  conversion_request_id uuid,
  idempotency_key_digest bytea
) -> outcome_code, immutable_real_conversion_result
```

`action_versions`, `executed_action_results` and
`immutable_real_conversion_result` are typed SQL row arrays or a strictly
validated safe JSON projection with the exact P3 result schema; they are never
arbitrary caller JSON or raw target payload. `server_verified_at` is accepted
only from the trusted verifier boundary and must be within the database
server-time window; database time determines issue and expiry.

## Request, Case, Candidate and Assignment transitions

Physical states are reused exactly:

| Moment | Request | Case | Candidate | Assignment |
|---|---|---|---|---|
| Before authority | `READY_FOR_REVIEW` | `READY_FOR_CONVERSION`, `REVIEW_PENDING` | `ACTIVE` or `REVIEW_REQUIRED` as bound | exact pointer row `ACTIVE` |
| Authority issuance commit | `APPROVED`, version `+1` | unchanged | unchanged | unchanged |
| Executor starts inside transaction | `APPROVED → EXECUTING`, version `+1`; state is never externally committed alone | unchanged | unchanged | unchanged |
| Executor success before same commit | `EXECUTING → COMPLETED`, version `+1`, terminal outcome digest | `READY_FOR_CONVERSION/REVIEW_PENDING → CONVERTED/COMPLETED`, version `+1`, close time, active pointer cleared | every executed Student candidate → `CONVERTED`, version `+1` | current `ACTIVE → ENDED`, version `+1`, reason `CASE_CONVERTED` |
| Rejection/fault | No transition in the failed transaction. | No transition. | No transition. | No transition. |

The action child moves independently but atomically with its owning operation:
P3C finalization owns `PROPOSED → REVIEWED +1`; P3B authority issuance owns
`REVIEWED → APPROVED +1`; P3D executor owns `APPROVED → EXECUTED +1` after
successful composition. A failure before each owning transaction commits
restores the prior action state/version.

Contact remains at its current CRM status; conversion is not a Contact lifecycle
transition. `EXECUTING` is updated only inside the successful transaction so a
crash/fault cannot leave a committed half-executing Request. A stale outcome
returns a typed rejection and rolls back. A separate protected invalidation
operation may later move a stale Request/authority to `CONFLICT`/`SUPERSEDED`;
the executor does not mix that administrative decision into a failed business
transaction. `COMPENSATION_REQUIRED` is not used because all P3 targets are in
one PostgreSQL transaction and no external saga runs.

## Canonical P3 lock order

F23.13C requires business roots before account security/assertion; F23.2 makes
the center root and identity mutexes those business roots. F23.13D's current
membership/security checks fit after those roots. The one canonical order is:

```text
0. CENTER_CRM_CONTROL_ROW
1. SORTED_IDENTITY_MUTEX_ROWS
2. ACCOUNT_SECURITY_CONTROL_ROW, actor UUID order when plural
3. STEP_UP_ASSERTION_ROW, issuance; consumed evidence row rechecked by executor
4. MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS
5. SINGLE_USE_CONVERSION_AUTHORITY_ROW
6. IDEMPOTENCY_REGISTRY_ROW
7. CONVERSION_REQUEST_ROW
8. CONVERSION_ACTION_ROWS, sorted action ID
9. CRM_CONTACT_ROW
10. CONSULTATION_CASE_ROW
11. CANDIDATE_STUDENT_ROWS, sorted candidate ID
12. ASSIGNMENT_ROW
13. EXISTING_TARGET_PROFILE_ROWS, GUARDIAN then STUDENT, sorted target ID
14. MATCH_REVIEW_ROWS, sorted review ID
15. PROFILE_CREATION_RESERVATION_ROWS, sorted reservation ID
16. GUARDIAN_STUDENT_RELATIONSHIP_ROWS, sorted semantic key then relationship ID
17. AUDIT_ROWS
18. OUTBOX_ROWS
19. COMMIT
```

Authority issuance has no authority row before insert, so tier 5 is a stable
Request/P3-action-set-scoped advisory mutex followed by the partial unique backstop;
executor locks the physical authority row. No flow locks account security then
returns to center/mutex, target then returns to Request/review, or relationship
then returns to reservation. No network/Auth call, user wait, provider call or
notification occurs while database locks are held.

## Atomic executor contract

The exposed input is narrow: Request ID, authority ID, expected Request and
authority versions, environment fingerprint, operation-intent digest and
opaque idempotency-key digest/expiry. Center, actor role, action list, target
choice, relationship semantics, step-up truth and policy versions are not
caller authority.

```text
BEGIN

acquire the canonical P3 locks through the idempotency record in exact order

if an exact completed idempotency record exists:
  verify same operation intent, Request, authority, legacy Request digest,
  P3 action-set encoding version and immutable APPROVED action-set digest
  return its immutable exact result
  do not lock or rehash live EXECUTED action rows
  do not consume or write anything

acquire the remaining canonical P3 locks, including APPROVED action rows
verify center runtime current
verify actor account/security/session, membership and capability still current
verify consumed step-up evidence and issued authority bindings still current
verify authority ISSUED, unexpired and unused
verify Request APPROVED and exact bound version/intent
verify current Request.action_graph_digest ==
  authority.legacy_request_action_graph_digest; otherwise
  REQUEST_ACTION_BINDING_STALE
verify Contact / Case / Candidate / Assignment and all policy versions current
verify complete canonical typed APPROVED action rows
recompute APPROVED action-set digest from persisted rows with
  authority.p3_action_set_encoding_version
verify recomputed APPROVED action-set digest V1 == authority.p3_action_set_digest;
  otherwise ACTION_SET_STALE
verify every review/reservation/target/binding/relationship decision current

for each approved Student action:
  create with reservation.preallocated_target_id, or reuse exact current target

for each approved Guardian action:
  create with reservation.preallocated_target_id, or reuse exact current target

for every approved Guardian–Student pair:
  create, exact-reuse, or approved versioned role update

create/update committed source-to-target bindings as approved
consume every used ACTIVE create reservation
transition candidates, Assignment, Case and Request exactly as frozen
transition every executed action APPROVED → EXECUTED, action_version +1
mark conversion authority CONSUMED
append the finite Audit set
append the matching durable Outbox set
store exact safe P3 idempotency result

COMMIT
```

Concise frozen chain:

```text
P3D:
verify APPROVED digest
→ execute
→ APPROVED → EXECUTED +1
→ consume authority
→ commit
```

The EXECUTED version increment intentionally changes what a fresh live digest
would be. The consumed authority keeps its immutable APPROVED action-set digest
as historical authorization evidence; it is never rewritten to an EXECUTED
digest. Exact replay validates only the immutable idempotency binding and
returns the committed result, so it does not require the now-EXECUTED rows to
hash to the old APPROVED authority digest.

Any exception, typed stale conflict after mutation begins, target error,
constraint error, reservation error, relationship error, Audit error, Outbox
error, idempotency error, or authority-consume error rolls back every effect.
There is no partial success flag and no automatic retry with refreshed state.
If failure occurs after the temporary EXECUTED transition, rollback restores all actions to APPROVED
and leaves the authority ISSUED. Correspondingly, any
failure after temporary APPROVED transitions during issuance restores all
actions to REVIEWED and leaves the step-up unconsumed.

```text
ANY_EXECUTOR_FAILURE: ROLLBACK EVERYTHING
```

## Idempotency, events and privacy

The operation scope is `crm.real_conversion.execute` on the exact Request.
The idempotency binding stores the operation intent, authority, immutable
legacy Request action-graph digest, P3 action-set encoding version and P3
APPROVED action-set digest independently. Same key plus the same complete binding
returns the immutable committed P3 snapshot: Request, Case, authority, actions,
Student, Guardian and relationship IDs/versions, finite outcome codes and
correlation without revalidating or rehashing live EXECUTED action rows. It
writes no second target, binding, relationship, consume,
transition, Audit or Outbox. Same key plus a changed intent, authority, legacy
Request digest, P3 encoding version or P3 action-set digest returns
`IDEMPOTENCY_CONFLICT`; neither digest can substitute for the other.

Finite authority issuance events:

```text
mfa.step_up.consumed
crm.conversion.approved
crm.conversion.authority_issued
crm.conversion.authority_revoked
crm.conversion.authority_expired
crm.conversion.authority_superseded
```

Finite successful executor events, emitted only where the corresponding action
or aggregate transition occurs:

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

Create/status events use the new aggregate version. Reuse decisions use the
executed action's new version so they never pretend the reused profile mutated.
All events share one operation correlation ID. Audit/Outbox contain only exact
center, opaque IDs, finite codes, versions, status/policy versions, safe reason,
correlation and server timestamp. They exclude raw name, full birth date,
phone, email, normalized identity, lookup digest, mutex key, protected payload,
step-up verification payload, access token, Vault material and password.

## Drift, suspension and revocation

Issuance is not immunity from later state. Executor denies and rolls back on
any drift in center runtime; account lifecycle/security/session; membership,
role/capability policy or separation; Assignment; Request version/intent or
legacy action-graph binding; canonical typed P3 action set or its encoding; Contact,
Case or Candidate; identity/normalizer/match/minimum-evidence policies; review,
reservation or relationship policy; target/binding/version; step-up evidence;
or authority. It never silently refreshes a review, reservation, target or
authority.

Center suspension serializes on the center root. Account/membership/capability
revocation serializes on the exact security/membership support rows and changes
versions. Assignment revoke, Request cancel, review supersede and reservation
expiry share the canonical business rows. If the revocation transaction wins
first, executor returns the typed stale/denied result. If executor owns all
earlier locks and commits first, revocation waits and takes effect afterward;
there is never a midpoint visible outside the transaction.

## P3 race matrix

Across all 21 races, "legacy Request binding" means only the opaque P1B
`Request.action_graph_digest`, while "P3 action set" means only encoding V1
over locked typed action rows. Any race that reaches authority issuance or
execution rechecks both domains independently and returns the domain-specific
stale code; neither domain is a fallback for the other.
For every one of the 21 rows, P3C publishes a digest only after REVIEWED `+1`,
the winning P3B transaction binds only its post-APPROVED `+1` version set, and
P3D compares that APPROVED digest only before mutation. Concurrent action-set
mutation shares the sorted action locks with both issuance and execution.

| ID / race | Lock interaction and winner | Loser typed result | Required rollback |
|---|---|---|---|
| P3-R1 two authority issuances, same Request/legacy binding/P3 action set | Center/mutex, assertion, idempotency/Request and sorted REVIEWED action locks serialize issuance and concurrent plan mutation; the winner transitions every row to APPROVED `+1`, then computes and binds that persisted version set. Exact same-key complete-binding call replays, otherwise first commit wins. | `AUTHORITY_ALREADY_ISSUED` or exact replay. | Loser creates no assertion consume, approval, authority or events; temporary APPROVED rows roll back to REVIEWED. |
| P3-R2 same authority, two executor calls | Authority row and idempotency serialize; one commit maximum. The winner verifies the APPROVED digest before mutation and later commits EXECUTED `+1`. | Exact replay checks the immutable binding/result without live EXECUTED rehash; otherwise `AUTHORITY_CONSUMED` or `IDEMPOTENCY_CONFLICT`. | No second target/link/reservation/event/consume; loser never compares the APPROVED authority digest with EXECUTED rows. |
| P3-R3 two different authorities, same Request/P3 action set | Request/one-issued invariant prevents two current authorities; the winning authority binds only post-APPROVED versions and each authority still binds the independent legacy Request digest. If a legacy fault creates two, Request lock lets one complete. | `REQUEST_STATE_CONFLICT` or `AUTHORITY_SUPERSEDED`. | Loser fully rolls back to the pre-issuance REVIEWED set. |
| P3-R4 executor vs center suspension | Both take center root first. | `CRM_RUNTIME_NOT_ACTIVE` when suspension commits first. | No target or terminal Request effect. |
| P3-R5 executor vs account disable | Center then account-security row serializes. | `ACCOUNT_SECURITY_STALE`. | Authority remains unconsumed; all writes rollback. |
| P3-R6 executor vs membership/capability revoke | Membership row/policy version recheck serializes after security. | `CAPABILITY_REVOKED`. | Full rollback. |
| P3-R7 executor vs Assignment revoke | Common Assignment row after source locks serializes. | `ASSIGNMENT_STALE`. | No candidate/Case/Request/target commit. |
| P3-R8 executor vs Request cancel or action-set mutation | Idempotency/Request and sorted APPROVED action rows serialize before sources. A mutation winning first makes the pre-mutation authority digest stale; executor winning first owns the rows through EXECUTED `+1`. | `REQUEST_STATE_CONFLICT` or `ACTION_SET_STALE`. | No authority/reservation consumption; any temporary execution lifecycle change rolls back to APPROVED. |
| P3-R9 executor vs target update | Stable target row lock and version recheck serialize. | `TARGET_VERSION_STALE`. | Full rollback; no reuse event. |
| P3-R10 executor vs review supersede | Sorted review rows serialize; terminal review/version recheck. | `MATCH_REVIEW_STALE`. | Full rollback. |
| P3-R11 executor vs reservation expiry | Sorted reservation rows serialize using server time. | `RESERVATION_EXPIRED`. | No profile survives and reservation is not consumed. |
| P3-R12 executor vs concurrent Student duplicate insert | Shared Student mutex precedes profile rows; first insert changes canonical projection. | `IDENTITY_PROJECTION_STALE` or duplicate-review-required. | Second create/binding/relationship all rollback. |
| P3-R13 executor vs concurrent Guardian duplicate insert | Shared Guardian mutex and projection recheck mirror Student. | `IDENTITY_PROJECTION_STALE` or duplicate-review-required. | Full rollback. |
| P3-R14 two conversions target same existing Student | Shared mutex then target row serialize; both may reuse only if each has its own current committed source binding and target version. | `TARGET_VERSION_STALE`/`IDENTITY_BINDING_REQUIRED`; otherwise both serial safe references. | Failed conversion rolls back its own full unit. |
| P3-R15 two conversions create same logical Student | Shared evidence mutex; first creates binding/profile, second's NO_MATCH snapshot is stale. | `IDENTITY_PROJECTION_STALE`. | Second creates nothing. |
| P3-R16 two conversions create same logical Guardian | Same as Student with Guardian evidence mutex. | `IDENTITY_PROJECTION_STALE`. | Second creates nothing. |
| P3-R17 relationship create vs same relationship create | Endpoint targets then semantic relationship key/partial unique backstop serialize. | Exact reviewed reuse when approved, otherwise `RELATIONSHIP_CONFLICT`. | No duplicate active relationship or partial conversion. |
| P3-R18 Audit failure | Audit is after all business mutations but before commit. | `AUDIT_WRITE_FAILED`. | Transaction rolls back targets, links, reservations, statuses, authority and idempotency. |
| P3-R19 Outbox failure | Outbox follows Audit in the same transaction. | `OUTBOX_WRITE_FAILED`. | Audit and every earlier effect roll back. |
| P3-R20 target writer failure | Target helper raises before reservation/status/event commit. | `TARGET_WRITE_FAILED`. | Any earlier target in the same conversion also rolls back. |
| P3-R21 relationship writer failure | Relationship is after both targets but before reservation/status/events. | `RELATIONSHIP_WRITE_FAILED`. | Both created targets/bindings and all other effects roll back. |

Unique constraints are integrity backstops after explicit stable locks; they do
not replace mutex/root acquisition.

## P3 negative matrix

| ID | Prohibited path | Frozen result |
|---|---|---|
| P3-N1 | Service role alone authorizes conversion. | Deny; verified actor/security/membership/capability/step-up/Request evidence is mandatory. |
| P3-N2 | Caller role string authorizes conversion. | Input absent/ignored; canonical membership and finite policy only. |
| P3-N3 | Caller center redirects conversion. | Center derives from Request; mismatch/nonmember is indistinguishable deny. |
| P3-N4 | Stale step-up accepted. | `STEP_UP_EXPIRED_OR_STALE`; no authority. |
| P3-N5 | Step-up reused indefinitely. | Assertion single-use and purpose/resource bound; terminal replay denied. |
| P3-N6 | Conversion authority reused twice, or exact replay rehashes EXECUTED rows against its APPROVED digest. | One consume maximum; exact replay validates the immutable completed idempotency binding/result and performs no live action rehash. |
| P3-N7 | Authority used for another Request/center/purpose. | Binding mismatch; no mutation. |
| P3-N8 | Authority digest is computed from REVIEWED versions and then actions become APPROVED, or an old authority is reused after its bound legacy `Request.action_graph_digest` changes, after canonical action rows change, or with one digest domain substituted for the other. | Authority insertion requires a digest recomputed after the complete APPROVED `+1` transition; legacy drift returns `REQUEST_ACTION_BINDING_STALE`, P3 row/encoding/digest drift returns `ACTION_SET_STALE`, and idempotency-binding drift returns `IDEMPOTENCY_CONFLICT`. |
| P3-N9 | Same-name and exact-birth auto merge. | Never; review signal only and committed source binding still required. |
| P3-N10 | `NO_MATCH` directly creates target. | Deny; terminal create review plus active reservation plus authority required. |
| P3-N11 | Reservation alone creates target. | Deny; reservation grants neither writer nor conversion authority. |
| P3-N12 | `EXACT_REVIEWED_MATCH` with stale target reuses it. | `TARGET_VERSION_STALE`; no conversion. |
| P3-N13 | Expired/superseded review accepted. | `MATCH_REVIEW_STALE`; no write. |
| P3-N14 | Expired reservation consumed. | `RESERVATION_EXPIRED`; target transaction rolls back. |
| P3-N15 | CRM Contact silently becomes Guardian. | Schema/type boundary denies; only `guardian_profile` target is valid. |
| P3-N16 | Generic cloud Student upsert bypasses canonical writer. | Generic row is legacy detection only and has no FK/namespace authority. |
| P3-N17 | Relationship created without both canonical current targets. | Exact-center endpoint FKs/action validator deny and roll back. |
| P3-N18 | Profile created outside identity mutex. | Internal writer requires executor-held mutex evidence; direct execute grant absent. |
| P3-N19 | Reservation consumed before profile/relationship succeeds. | Consume occurs after successful target/relationship composition inside one transaction. |
| P3-N20 | Partial Student/Guardian/relationship target write commits. | Impossible under one transaction; injected failure rolls back all targets/bindings. |
| P3-N21 | Request `COMPLETED` without Audit/Outbox. | Event failure rolls back Request/Case/targets/authority/idempotency. |
| P3-N22 | Raw PII/security evidence enters Audit/Outbox/result. | Safe structural validators reject; transaction rolls back. |
| P3-N23 | Browser supplies a generic action list/target reuse choice, or caller-supplied legacy Request digest is treated as proof of the P3 plan. | Executor has no such input; locked canonical action rows plus server-derived P3 action-set digest are authoritative, while the legacy digest remains only its own binding. |
| P3-N24 | Missing relationship decision is treated as approved no-op, or finalized REVIEWED digest is computed from pre-transition PROPOSED versions. | Typed action-set completeness fails with `RELATIONSHIP_DECISION_REQUIRED`; lifecycle ordering failure rolls back finalization and publishes no REVIEWED digest. |

## Required rollback fault boundaries

The P3D integrated runner must inject a failure after each of these points and
prove zero partial rows/terminal transitions/events: first Student create,
first Guardian create, source-binding insert, relationship create/update,
first reservation consume, Candidate transition, Assignment end, Case
conversion, first Request transition, authority consume, Audit insert, Outbox
insert and idempotency completion. It must also prove that an Audit row never
survives without its business mutation and that exact replay creates no new
event.

## Checkpoint hashes and P3A ownership

```text
P3A_CHECKPOINT_MIGRATION_HASH_COUNT: 14
P3A_OWNED_MIGRATION_COUNT: 0
P3A_ARTIFACT_COUNT: 2
```

| Checkpoint migration | SHA-256 |
|---|---|
| `20260722000000_remote_schema.sql` | `55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31` |
| `20260722000100_transaction_images_bucket_prerequisite.sql` | `B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62` |
| `202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql` | `0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD` |
| `202607280001_f23_11e_staff_document_private_attachments.sql` | `E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C` |
| `202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql` | `CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8` |
| `202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql` | `2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984` |
| `202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql` | `81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6` |
| `202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql` | `BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F` |
| `202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql` | `210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA` |
| `202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql` | `BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722` |
| `202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql` | `33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19` |
| `202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql` | `55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773` |
| `202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql` | `F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B` |
| `202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql` | `7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46` |

The P3A smoke verifies these named checkpoints without fixing the repository's
total migration count, so later reviewed P3B/P3C/P3D migrations remain
forward-compatible.

Exact P3A artifacts:

```text
docs/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze.md
tests/f23-3e-p3a-real-conversion-dependency-closure-and-atomic-executor-design-freeze-smoke.js
```

## Frozen non-goals and next gate

P3A does not change either roadmap. P3 remains TODO until external technical
audit and closeout. No production/runtime/src/Auth/Edge/remote/deploy/UI/import
or real conversion action is implied. The next eligible request after audit is
P3B only; P3C and P3D retain their sequential gates above.
