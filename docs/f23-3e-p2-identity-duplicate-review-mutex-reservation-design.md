F23_3E_P2_STATUS: DESIGN IMPLEMENTED IN REPO
F23_3E_P2_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P2_DESIGN: COMPLETE
F23_3E_P2_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P2_MIGRATION_CREATED: NO
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO

# F23.3E-P2 — Identity duplicate review, mutex, and reservation design

## 1. Scope, baseline, and evidence classification

This is a design and future implementation plan only. It was prepared from clean
`main` at `e3a043b` after the P1 foundation checkpoint. It creates no SQL,
migration, database object, runtime service, Auth flow, Edge Function, browser
path, deployment, import, profile, relationship, or conversion outcome.

The evidence labels used below are normative:

- **REPO FACT**: present in the current repository schema or executable source.
- **PARTIAL FOUNDATION**: usable current substrate, but not a protected canonical
  Guardian/Student profile service.
- **DESIGN PROPOSAL**: exact P2 contract for a future, separately approved phase.
- **DEFERRED**: P3/P4 or another canonical domain service must supply it.

Implementation readiness is limited to:

```text
F23_3E_P2_IMPLEMENTATION_READINESS: SAFE TO REQUEST EXPLICIT P2A IMPLEMENTATION APPROVAL
F23_3E_P2_PRODUCTION_READINESS: NOT CLAIMED
```

External technical audit: PASS. This verdict closes the P2 design audit only;
it does not approve P2A implementation and grants no authority to mutate a local
or remote Supabase project.

### External technical audit closeout

The external audit verified the repo-truth Guardian, Student, and
Relationship boundaries; the six canonical match outcomes; `NO_MATCH` not being
create authority; current `EXACT_REVIEWED_MATCH`-only reuse; versioned
normalization; the stable byte-sorted identity mutex; exact-center
non-disclosure; masked `NO_STORE` projections; immutable reviewed evidence;
create-new reservation without create authority; fail-closed normalization and
policy drift; the canonical lock order; P2/P3 authority separation; idempotency;
Audit/Outbox PII minimization; P2-R1–P2-R16; P2-N1–P2-N24; the physical proposal;
the typed operation proposal; and the P2A–P2D implementation sequence.

```text
F23_3E_P2_EXTERNAL_TECHNICAL_AUDIT_VERDICT: PASS
F23_3E_P2_EXTERNAL_TECHNICAL_AUDIT_BLOCKERS: NONE
```

## 2. Repository-truth inventory

The inventory audited all 11 existing migrations; P1A–P1F reports, migrations,
and tests; the F23.2, F23.3E, F23.13C, and F23.13D designs; and the current
Student, Parent Consultation, storage, tuition-link, and cloud adapters.

| Area | Classification | Current repository truth | P2 consequence |
| --- | --- | --- | --- |
| Center and membership | REPO FACT | `public.centers` is the text center root. `public.center_members` binds user, center, role, and status. P1D currently locks/rechecks exact active consultant membership for assignment, while final capability resolution remains deferred. | Every P2 lookup and mutation is exact-center and protected-service mediated. Actor attribution is not end-user authority. |
| CRM control | REPO FACT | P1A provides exactly one `center_crm_control` per center, with `identity_policy_version`, lifecycle, feature flag, and version. P1B/P1D mutations require `ACTIVE + ENABLED`; P1F keeps production rollout blocked. | This row is the first P2 business lock and the authoritative kill-switch/policy root. |
| CRM Contact | REPO FACT | `crm_contact` stores a safe display name, protected contact ciphertext, binary lookup digests, normalization version, exact center, and optimistic version. P1D provides typed service-role mutations; P1E denies direct CRM table access and exposes masked reads. | Contact fields are source evidence only. Existing digests are not browser output, mutex output, or ownership proof. |
| Consultation Case | REPO FACT | `consultation_case` is a workflow aggregate bound to one Contact; it is not a person. P1D has typed mutations and Assignment operations. `CONVERTED` is reserved for a future protected executor. | Case identity/version is bound into review and reservation intent; it cannot stand in for Guardian/Student identity. |
| Candidate Student | REPO FACT | `consultation_case_candidate_student` stores protected case evidence with a version and explicitly is not a canonical Student. | Candidate evidence may seed protected normalization/search but cannot be reused as a Student target. |
| Conversion Request | REPO FACT | P1A/P1B provide exact-center draft/update/submit/cancel/status, source Contact/Case/Assignment versions, policy versions, action graph digest, and scoped idempotency. P1B stops at `READY_FOR_REVIEW`. | P2 records bind to exact Request/action/version; P2 does not approve, execute, or complete it. |
| Idempotency | REPO FACT | `crm_idempotency_registry` and P1B enforce same-key/same-intent replay and same-key/different-intent conflict. | P2 extends the same semantics with operation-specific scopes and immutable safe result snapshots. |
| Audit/Outbox | REPO FACT | P1A–P1D provide atomic safe Audit/Outbox writes; P1C provides durable delivery primitives. No network exactly-once claim exists. | Every future meaningful P2 mutation writes one correlated safe Audit/Outbox pair in the transaction; P2 design performs no delivery. |
| Parent Consultation legacy data | REPO FACT | `src/storage.js` persists center-scoped `parentConsultations` in browser LocalStorage. Records embed parent/contact, prospective child, linked Student IDs, care, appointment, and enrollment-draft fields. `src/parent-consultation-module.js` only builds a preview/candidate score and explicitly performs no real merge. | Legacy rows are untrusted import/search evidence. A preview score is not a reviewed match and never becomes create/reuse authority. |
| Student local model | PARTIAL FOUNDATION | `src/storage.js` persists center-scoped `students`; `src/student-data.js` supplies the current shape/fixtures; `src/student-module.js` edits Student records whose guardian details are embedded fields; `src/student-tuition-links.js` joins tuition by Student ID. | Preserve via a read adapter. No direct LocalStorage call is permitted from protected P2/P3 authority. |
| Student cloud model | PARTIAL FOUNDATION | `src/cloud-db-entities.js` registers generic entity type `student`; `src/cloud-db-sync.js` lists/upserts payloads in `center_cloud_entities`. The table has `(center_id, entity_type, local_id)` uniqueness and broad legacy member policies. It is not a protected canonical identity service. | Future P2 search may use a server-owned exact-center adapter only after security remediation. Generic table/browser access cannot create, reuse, or mutate a conversion target. |
| Generic CRM cloud path | REPO FACT | P1E adds a deny-only guard preventing canonical CRM entity types from using generic `center_cloud_entities`. | P2 resources must be dedicated protected resources, never new generic payload entity types. |
| Guardian profile | REPO FACT: ABSENT | No migration or source service defines a separate protected canonical Guardian aggregate. Guardian-like details are embedded in Student and Parent Consultation records. F23.2 contains a design, not runtime truth. | P2 must not invent a Guardian table. Existing reuse and new create remain adapter/service dependencies. |
| Guardian–Student relationship | REPO FACT: ABSENT | No migration or protected runtime defines an independent versioned Guardian–Student relationship aggregate. Embedded parent fields and linked IDs are not such a relationship. | Relationship matching/creation is outside P2 and must be supplied by a future canonical relationship service before P3 can execute such an action. |
| Account security/capability | DEFERRED | F23.13C/F23.13D are audited designs; their canonical account-security control and final capability resolver are not current runtime. | P2 locks those rows only when that protected runtime exists. P2 never implements or simulates the resolver. |

Explicit current-state findings:

```text
CURRENT_GUARDIAN_CANONICAL_RUNTIME: ABSENT — no protected canonical Guardian table or service exists; only embedded guardian-like legacy/local fields exist
CURRENT_STUDENT_CANONICAL_RUNTIME: PARTIAL/NOT PROTECTED CANONICAL — center-scoped LocalStorage Student records and generic center_cloud_entities student payloads exist, but no protected canonical Student identity service exists
CURRENT_GUARDIAN_STUDENT_RELATIONSHIP_RUNTIME: ABSENT — no independent canonical versioned relationship table or protected service exists
```

These findings override any conceptual physical names in older design documents.
P2 proposes its own control/evidence resources but only adapter interfaces for
Guardian, Student, and Relationship targets.

## 3. Canonical match outcomes and authority

The complete and closed match-outcome vocabulary is:

```text
NO_MATCH
POSSIBLE_MATCH
PROBABLE_MATCH
EXACT_REVIEWED_MATCH
CONFLICT
INSUFFICIENT_EVIDENCE
```

`NO_MATCH` means a complete, current, exact-center search found no candidate
under the bound policy. It is evidence for review, not permission to create.
`POSSIBLE_MATCH` and `PROBABLE_MATCH` require human review. `CONFLICT` includes
multiple incompatible candidates/evidence. `INSUFFICIENT_EVIDENCE` blocks both
reuse and create-new. `EXACT_REVIEWED_MATCH` is the only reuse-eligible decision,
and only while every bound version remains current.

```text
ONLY_CURRENT_EXACT_REVIEWED_MATCH_MAY_REUSE: YES
NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: NO
POSSIBLE_MATCH_MAY_AUTO_REUSE: NO
PROBABLE_MATCH_MAY_AUTO_REUSE: NO
NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO
INSUFFICIENT_EVIDENCE_COERCED_TO_NO_MATCH: NO
CROSS_CENTER_MATCH_RESULT_MAY_BE_DISCLOSED: NO
```

Phone, email, name, birth evidence, existing IDs, and legacy links are evidence.
They are never ownership proof, merge authority, reuse authority, or create
authority. Student reuse is never based on name-only, birth-only, or a shared
guardian contact method alone.

## 4. Exact-center and non-disclosure boundary

```text
MATCH_SCOPE = EXACT_CENTER_ONLY
CROSS_CENTER_STUDENT_SEARCH_INITIAL_ROLLOUT: NO
```

The protected service derives the center from the locked Request/Case/root
composition; caller-supplied center text is a selector at most. Candidate search
queries only target adapters bound to that exact center. A foreign-center object,
an absent object, and an object outside the actor's exact protected scope produce
the same safe denial class.

No response discloses cross-center candidate count, existence, opaque ID,
confidence, masked detail, review history, mutex existence, or reservation
existence. The generic safe outcome is `RESOURCE_NOT_AVAILABLE`; it contains no
existence bit. Search returns counts only for the authorized exact-center result
set and caps them by policy; an authorization denial returns no result set.

## 5. Versioned normalization contract

Normalization is an allowlisted, typed server algorithm, not a universal
“lowercase and trim” rule. Each evidence item is represented internally as:

```text
normalization_algorithm
normalization_version
identity_kind
evidence_kind
canonical_normalized_identity_digest
policy_version
```

`normalization_algorithm` identifies an audited transformation family.
`normalization_version` identifies exact executable rules and digest-key epoch.
`identity_kind` separates `GUARDIAN`, `STUDENT`, and future approved kinds.
`evidence_kind` separates contact-method, display-name, protected birth,
canonical-target-ID, and legacy-link evidence. `policy_version` identifies the
minimum-evidence and scoring/review policy. The digest is a fixed-size protected
keyed digest over a domain-separated canonical envelope; it is never a client
identifier. Key material and raw normalized values remain inside the protected
service.

Normative evidence handling:

| Evidence family | Normalization requirement | Permitted authority |
| --- | --- | --- |
| Guardian/Contact | Kind-specific contact-method/name rules; contact methods remain separate evidence kinds; source crypto and Contact normalization versions are bound. | Candidate retrieval only; exact contact evidence never auto-reuses. |
| Student | Separate rules for name, protected birth evidence, Student-local opaque ID, and approved guardian link evidence. | Multi-evidence candidate retrieval/review only; no single child attribute authorizes reuse. |
| Existing canonical ID | Verify adapter namespace, exact center, target kind, target version, and current existence; digest a domain-separated opaque ID envelope. | May identify a candidate, but still needs current reviewed evidence. |
| Legacy link | Bind source dataset/provenance version, source center, legacy entity kind, and opaque legacy ID. | Supporting evidence only; never upgrades legacy `converted` to canonical conversion. |

Raw normalized values may exist transiently in protected memory. They must not
be persisted as mutex keys, returned to clients, placed in safe errors, or
written to Audit/Outbox. Protected evidence digests may be stored only in the
dedicated restricted evidence records required to revalidate decisions.

```text
RAW_NORMALIZED_VALUE_PERSISTED_AS_MUTEX_KEY: NO
RAW_NORMALIZED_VALUE_WRITTEN_TO_AUDIT_OUTBOX: NO
```

## 6. Minimum-evidence and candidate-search contract

The proposed `minimum_evidence_policy_version` is part of the match policy and
is independently inspectable. For each identity kind it defines required
evidence-family combinations, allowed supporting evidence, contradiction rules,
source freshness, and review escalation. No policy may define Guardian reuse by
one shared contact method or Student reuse by name-only, birth-only, or shared
guardian contact method alone.

A create-new review may begin only after all of these are true:

1. the exact-center search completed over every required current adapter/index;
2. minimum evidence is satisfied;
3. normalizer and match-policy versions equal the root's current versions;
4. no unresolved candidate/search page remains;
5. all relevant identity mutexes are locked; and
6. search and source/target states are rechecked under those locks.

The search result binds `normalization_version`, `match_policy_version`,
`minimum_evidence_policy_version`, source versions, adapter snapshot versions,
and a short expiry. Review, reservation, and the future P3 action graph must bind
the same values. `INSUFFICIENT_EVIDENCE` blocks; it is not `NO_MATCH`.

Safe dependency outcomes are frozen as:

```text
SEARCH_UNAVAILABLE_OUTCOME: MATCH_SEARCH_UNAVAILABLE
POLICY_STALE_OUTCOME: MATCH_POLICY_STALE
NORMALIZER_STALE_OUTCOME: NORMALIZER_STALE
MULTIPLE_CANDIDATES_OUTCOME: MATCH_REVIEW_REQUIRED
INSUFFICIENT_EVIDENCE_OUTCOME: INSUFFICIENT_IDENTITY_EVIDENCE
```

An adapter/index timeout, partial page, unknown version, or completeness proof
failure returns `MATCH_SEARCH_UNAVAILABLE`, never `NO_MATCH`.

## 7. Stable identity mutex

The canonical internal key is:

```text
identity_match_mutex_key =
  versioned_digest(
    environment_fingerprint,
    center_id,
    identity_kind,
    canonical_normalized_identity_digest
  )
```

The `versioned_digest` envelope also domain-separates the mutex schema and
normalization version. Consequently the key is environment-bound, center-bound,
identity-kind-bound, normalization-version-aware, opaque, stable, and non-PII.
The environment fingerprint is a protected deployment identity, not a project
locator exposed to clients.

For one operation the service derives every relevant key from all qualifying
evidence, removes byte-identical duplicates, sorts the bytes ascending, ensures
registry rows exist through the center-root-controlled protocol, and locks every
row in that order before candidate recheck. All same-identity Cases therefore
contend on at least one shared key. Hash collision causes conservative extra
serialization and review; it never causes identity reuse.

```text
ALL_RELEVANT_IDENTITY_MUTEX_KEYS_LOCKED_BEFORE_MATCH_RECHECK: YES
MATCH_REVIEW_RESULT_WITHOUT_MUTEX_RECHECK_CAN_EXECUTE: NO
IDENTITY_UNIQUE_INDEX_REPLACES_MUTEX: NO
RAW_CONTACT_OR_BIRTH_USED_AS_MUTEX_KEY: NO
```

Unique constraints remain integrity backstops. They are not the concurrency
protocol and an insert conflict never gets reinterpreted as an exact match.

## 8. Normalization and policy drift

P2 chooses **drain/expire plus re-review** as the initial drift strategy. It does
not claim cross-version equivalence. Activating a new normalizer or match policy
under the locked center root:

1. marks old-version pending reviews and active reservations ineligible for use;
2. emits safe supersede/expiry events transactionally in bounded batches;
3. blocks new authority under the old version;
4. requires a complete search with new mutex keys and a new review/reservation;
5. keeps historical terminal evidence immutable.

Rollout is not current until no old-version active authority candidate remains.
If the drain cannot be proven complete, both review/reservation and future P3
execution fail `NORMALIZER_STALE` or `MATCH_POLICY_STALE`. A future dual-key
strategy would require separate audit and cannot be silently enabled.

```text
NORMALIZATION_VERSION_DRIFT_CAN_CREATE_PARALLEL_PROFILE_AUTHORITY: NO
```

## 9. Masked candidate projection

Candidate matching and masking occur server-side before serialization. The
versioned projection is:

```text
candidate_projection_version
identity_kind
opaque_candidate_id
opaque_target_id (only when exact policy and reviewer scope allow it)
masked_attributes[]
safe_attributes[]
target_version
evidence_summary_codes[]
match_reason_codes[]
normalizer_version
match_policy_version
projection_cache_policy = NO_STORE
```

`masked_attributes` uses policy-generated category labels or coarse safe facts,
not an assumed decrypt/last-four capability. `safe_attributes` is an allowlist
such as lifecycle category only when the adapter certifies it as review-safe.
Reason/summary codes are finite enums, not caller-formatted text.

The projection never contains raw phone, raw email, full birth evidence,
protected Contact ciphertext, lookup digests, raw identity digests, unmasked
Student payloads, or any cross-center signal. It cannot be persisted in browser
storage, service workers, telemetry, URLs, or generic cloud entities.

## 10. Reviewed-match evidence and lifecycle

A review record binds all of the following immutably: exact center; identity
kind; opaque source candidate identity; optional exact opaque target; target
version; source Contact, Case, candidate, Request, and action versions; protected
evidence-digest set digest; mutex-set digest; normalizer version; match-policy and
minimum-evidence-policy versions; decision; reviewer attribution and future
authority-decision version; safe reason code; server decision time; expiry; and
review version.

The canonical review lifecycle is frozen as:

```text
PENDING
EXACT_REVIEWED_MATCH
CREATE_NEW_REVIEWED
REJECTED_MATCH
CONFLICT
EXPIRED
SUPERSEDED
```

The separate, closed `review_action` vocabulary is:

```text
REUSE_EXISTING
PREPARE_CREATE_NEW
REJECT_IDENTITY_ACTION
ESCALATE_IDENTITY_CONFLICT
```

Allowed transitions are `PENDING → EXACT_REVIEWED_MATCH |
CREATE_NEW_REVIEWED | REJECTED_MATCH | CONFLICT | EXPIRED | SUPERSEDED`. All six
destinations are terminal and immutable. `EXACT_REVIEWED_MATCH` requires
`REUSE_EXISTING`. `CREATE_NEW_REVIEWED` requires a current, complete `NO_MATCH`
outcome plus `PREPARE_CREATE_NEW`; it means a reviewer accepted only the next
P2 reservation step. It is not a seventh match outcome and is not create or
conversion authority. `REJECTED_MATCH` uses `REJECT_IDENTITY_ACTION` and records
a refusal to take an identity action. `CONFLICT` uses
`ESCALATE_IDENTITY_CONFLICT`. A later review creates a new row and may reference the old row as
`supersedes_review_id`; it never edits terminal evidence. `REJECTED_MATCH`
does not become create authority. The match outcome remains in the exact
six-token vocabulary of section 3.

```text
CURRENT_REVIEWED_NO_MATCH_MAY_SUPPORT_RESERVATION_RECHECK: YES
CREATE_NEW_REVIEWED_IS_PROFILE_CREATE_AUTHORITY: NO
```

Only a current `EXACT_REVIEWED_MATCH`, with exact target and all bound versions
unchanged, can become reuse eligibility evidence for P3. Any source, target,
adapter, policy, normalizer, evidence, Request, action, reviewer-authority, or
expiry drift yields `MATCH_REVIEW_STALE` and `MATCH_REVIEW_REQUIRED`; there is no
silent refresh.

## 11. Profile-creation reservation and lifecycle

The logical record is:

```text
profile_creation_reservation
  reservation_id
  center_id
  entity_kind
  conversion_request_id
  request_version
  action_id
  action_intent_digest
  preallocated_target_id
  identity_mutex_keys_digest
  normalization_version
  match_policy_version
  minimum_evidence_policy_version
  source_evidence_digest
  source_versions_digest
  search_snapshot_id
  review_id
  status
  reservation_version
  expires_at
  created_by_user_id
  created_at
  updated_at
  terminal_reason_code
  supersedes_reservation_id
```

It is created and bound before approval, after a complete search and mutex
recheck, and only from a current `CREATE_NEW_REVIEWED` record. It records an exact create-new intent and a protected-service-
preallocated opaque target ID. It does not create a profile, prove identity or
absence, grant authority, or replace P3 approval.

The canonical reservation lifecycle is frozen as:

```text
ACTIVE
CONSUMED
EXPIRED
CANCELLED
SUPERSEDED
```

Allowed transitions are `ACTIVE → CONSUMED | EXPIRED | CANCELLED | SUPERSEDED`.
Terminal rows are immutable except retention metadata managed by a protected
retention service. `CONSUMED` may be set only by a future P3 transaction that
also commits the exact profile action or exact idempotent prior outcome.
`EXPIRED` is server-time driven. Request cancellation causes `CANCELLED`.
Source/policy/normalizer/action drift causes `SUPERSEDED` and a new protocol.

There is at most one `ACTIVE` reservation for the exact `(center, entity kind,
Request, action, action intent)` and no active reservation may reuse its target
ID for another binding. A reservation cannot migrate to another target,
Request, action, kind, or center.

```text
PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO
PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: NO
PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: NO
```

## 12. Absent-row serialization

A not-yet-created Guardian or Student row cannot be locked:

```text
NEW_PROFILE_CREATION_LOCKS_EMPTY_PROFILE_SET: NO
EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: NO
```

Create-new therefore requires the center root, complete sorted identity mutex
set, exact Request/action, current reviewed evidence, preallocated target ID, and
active creation reservation. A future target unique constraint is only the final
integrity backstop and cannot manufacture a match/review outcome.

## 13. Canonical lock order and composition proof

The frozen overlapping P2/P3 logical order is:

```text
CENTER_CRM_CONTROL_ROW
→ SORTED_IDENTITY_MUTEX_ROWS
→ ACCOUNT_SECURITY_CONTROL_ROWS when that protected runtime exists
→ IDEMPOTENCY/REQUEST
→ CONTACT/CASE/SOURCE_EVIDENCE
→ ASSIGNMENT when relevant
→ EXISTING_TARGET_PROFILE_ROWS in stable type+ID order
→ MATCH_REVIEW_ROWS
→ PROFILE_CREATION_RESERVATION_ROWS
→ AUDIT_OUTBOX
→ COMMIT
```

This refines, without inverting, the F23.3E executor order: center and sorted
identity roots remain first; future account security remains before Request;
Request remains before Contact/Case/Assignment as required by current P1B
overlap; profile rows preserve stable kind then opaque-ID order; reservation and
Audit/Outbox remain last. P1 operations that do not touch identity/profile rows
retain their shorter prefix/subsequence. Any future P1 mutation overlapping P2
must acquire every shared tier in this order.

No flow may use reservation-first, target-before-mutex, review-before-mutex-
recheck, or unique-index-only serialization. No human wait, adapter network call,
or external side effect occurs while database locks are held; candidate material
is collected first and revalidated under locks through current snapshot/version
tokens.

## 14. P2 authority boundary and target adapters

P2 may establish only candidate search results, reviewed match evidence, safe
reuse eligibility evidence, and create-new reservations.

```text
P2_REVIEW_DECISION_IS_CONVERSION_APPROVAL: NO
P2_RESERVATION_IS_PROFILE_CREATE_AUTHORITY: NO
P2_EXECUTES_REAL_CONVERSION: NO
```

P2 cannot establish conversion approval, consume step-up, mint single-use
conversion authority, create Guardian/Student/Relationship rows, mark a Case
`CONVERTED`, or mark a Request `COMPLETED`.

Target dependency contracts are separate:

| Dependency | Required protected adapter contract | Current disposition |
| --- | --- | --- |
| `EXISTING_PROFILE_REUSE` | Exact-center typed search/read by identity kind; opaque target ID; target version; current lifecycle; versioned completeness token; masked projection; stable lock handle; no raw table payload. | Guardian: BLOCKED, adapter absent. Student: BLOCKED until the local/generic cloud model has an approved protected server adapter and security remediation. |
| `NEW_PROFILE_CREATE` | Preallocate immutable opaque ID; validate proposed kind/state; expose a future transactional create operation that accepts only a current P3 authority/action/reservation binding; return target version; support target lock/order and atomic Audit/Outbox composition. | Guardian: BLOCKED, canonical create service absent. Student: BLOCKED, protected canonical create service and unenrolled lifecycle decision absent. |
| `RELATIONSHIP_TARGET` | Exact-center independent relationship aggregate, semantic duplicate recheck, version/lifecycle, stable locks, and P3-only typed create/reuse operation. | BLOCKED; no canonical relationship runtime exists. |

P3 may call an adapter only after its external audit, explicit implementation
approval, exact transaction-composition proof, and P3 authority checks. P3 may
not call LocalStorage, `center_cloud_entities`, a browser endpoint, or a generic
table operation as profile authority. No adapter may infer a relationship from
shared contact evidence.

## 15. Idempotency and replay

Every persisted P2 operation uses a scope containing environment fingerprint,
exact center, operation code, Request/action IDs where applicable, and a caller-
provided opaque idempotency key reference. The stored intent digest binds all
source, target, evidence-set, normalizer, policy, expected-version, and expiry
inputs that define meaning.

| Operation family | Same key + same intent | Same key + different intent |
| --- | --- | --- |
| Persisted candidate-search snapshot | Return the exact original safe projection metadata/outcome and snapshot version, not a re-query interpreted as old success. | `IDEMPOTENCY_CONFLICT`; prior snapshot unchanged. |
| Submit/create review decision | Return exact prior safe review ID, lifecycle, decision, and bound versions; no second Audit/Outbox. | `IDEMPOTENCY_CONFLICT`; no overwrite. |
| Create reservation | Return exact prior reservation ID, preallocated target ID, status/version, and expiry snapshot; current-row drift does not rewrite history. | `IDEMPOTENCY_CONFLICT`; no second target ID/reservation. |
| Cancel/expire/supersede | Return exact prior terminal result for the same transition intent. | `IDEMPOTENCY_CONFLICT`; terminal row unchanged. |

The original committed result is immutable. Replay never reinterprets a
terminal result using a current row. A current-status read is a separate typed,
non-mutating operation.

## 16. Audit, Outbox, and safe errors

Every future successful non-replay P2 mutation appends one immutable Audit event
and one durable Outbox event with the same server correlation ID in the same
transaction. Review supersession/expiry and reservation terminalization are
meaningful mutations. Same-intent replay creates no second event.

Permitted metadata is limited to opaque resource IDs, exact center, identity
kind, decision/outcome code, safe reason code, version edges, normalizer/policy
versions, and correlation IDs. It excludes raw contact methods, full child
identity, birth values, raw normalized identity, raw identity/evidence digests,
candidate payloads, credentials, and cross-center existence. Outbox delivery
remains at-least-once operational handling; P2 makes no network guarantee.

The closed P2 safe-error vocabulary is:

```text
MATCH_REVIEW_REQUIRED
INSUFFICIENT_IDENTITY_EVIDENCE
MATCH_POLICY_STALE
NORMALIZER_STALE
SOURCE_VERSION_STALE
TARGET_VERSION_STALE
MATCH_SEARCH_UNAVAILABLE
MATCH_REVIEW_STALE
RESERVATION_STALE
RESERVATION_EXPIRED
RESERVATION_CONFLICT
RESOURCE_NOT_AVAILABLE
IDEMPOTENCY_CONFLICT
CRM_RUNTIME_NOT_ACTIVE
ACTOR_NOT_AUTHORIZED
```

`RESOURCE_NOT_AVAILABLE` covers missing, foreign-center, and non-visible targets
without distinguishing them. Errors never reveal another center, candidate
count/target ID, Auth existence, private Student state, raw evidence, mutex row,
or reservation existence.

## 17. Concurrency race matrix P2-R1–P2-R16

| ID / race | Shared locks | Canonical order | Winner | Loser safe outcome | Audit/Outbox | No-duplicate invariant |
| --- | --- | --- | --- | --- | --- | --- |
| P2-R1 two Cases evaluate same Guardian evidence | Center root and at least one shared Guardian mutex; then both Requests/sources | Root → sorted mutexes → Request → Contact/Case/evidence → targets/review/reservation | First current review/reservation commit | Waits, re-searches, then `MATCH_REVIEW_REQUIRED`, current exact reuse path, or `RESERVATION_CONFLICT`; never blind create | Winner event only; loser event only if it commits a distinct reviewed outcome | One logical identity cannot receive two create intents without serialized recheck. |
| P2-R2 two Cases evaluate same Student evidence | Center root and shared Student evidence mutex set | Root → sorted mutexes → Request → candidate/source → Student adapter target → review/reservation | First complete current decision | Rechecks child evidence and returns safe review/conflict; no name/birth-only fallback | Committed decisions only; no event for rolled-back loser | No two Student creates from the same qualifying evidence race. |
| P2-R3 review vs source Contact update | Center root, relevant mutexes, overlapping Request, Contact/Case | Root → mutexes → Request → Contact/Case/source → review | First version-changing commit | Review gets `SOURCE_VERSION_STALE`, or Contact updater causes existing review to require supersession | Each committed mutation has its own atomic pair; failed review has none | Stale Contact evidence cannot produce reusable review. |
| P2-R4 review vs Student/Guardian target update | Root, mutexes, Request/source, exact target row | Root → mutexes → Request → source → stable target → review | First target/review version commit | `TARGET_VERSION_STALE` or later review becomes stale; fresh review required | Only committed edges emitted | Reuse never binds an unlocked/stale target. |
| P2-R5 review vs normalization-version rollout | Root plus old review/mutex set; rollout owns root before drain | Root → sorted relevant mutexes → Request/source → review/reservation | Rollout or review transaction first | If rollout wins: `NORMALIZER_STALE`; if review wins: drain supersedes it before new version becomes current | Review or rollout/supersede events reflect actual commits | Old and new normalizers cannot concurrently grant eligible evidence. |
| P2-R6 create-reservation vs create-reservation same logical identity | Root, same sorted mutex set, both Requests/actions, active-intent unique backstop | Root → mutexes → Requests in opaque-ID order → source/targets → reviews → reservations | First current valid reservation | Wait/recheck then exact replay, current reuse review, or `RESERVATION_CONFLICT` | One creation event per committed reservation | At most one active exact intent; no duplicate target allocation for same logical identity. |
| P2-R7 reservation expiry vs P3 future approval attempt | Root, mutexes, account security when present, Request, source/target, review, reservation | Full canonical order; server time checked under reservation lock | Expiry or future P3 attempt first | Expiry yields `RESERVATION_EXPIRED`; P3 can proceed only if it consumed an unexpired exact reservation atomically | Exactly the winning terminal edge; P3 failure has no target event | Expired authority candidate never creates a profile. |
| P2-R8 request cancel vs reservation create | Root, mutexes, same Request/source/review/reservation | Root → mutexes → Request → source → review → reservation | First Request/reservation commit | Create sees cancelled/stale Request and returns `SOURCE_VERSION_STALE`; cancel terminalizes any active reservation | Atomic cancel plus reservation event if changed; failed create none | No active reservation survives a cancelled Request. |
| P2-R9 same idempotency key same intent | Root, mutexes where relevant, same idempotency/Request/resource rows | Canonical order with idempotency/Request tier before source | Original committed operation | Exact prior safe result with `replayed=true` | No duplicate event on replay | One semantic result and one mutation event pair. |
| P2-R10 same idempotency key different intent | Root and same idempotency scope row | Root → mutexes if bound → idempotency/Request | Original binding remains winner | `IDEMPOTENCY_CONFLICT` | No event for conflicting overwrite attempt | Prior result/target/evidence cannot be rebound. |
| P2-R11 old reviewed reuse vs target-version change | Root, mutexes, Request/source, exact target, review | Root → mutexes → Request → source → target → review | First target/reuse eligibility transaction | `TARGET_VERSION_STALE` or `MATCH_REVIEW_STALE`; no silent refresh | Only committed target edit or future use event | Old review cannot authorize current target reuse. |
| P2-R12 two identities share one phone/email evidence | Root and shared contact-evidence mutex plus identity-specific keys | Root → all deduplicated byte-sorted mutexes → Requests/sources/targets | First review records ambiguity/current state | `MATCH_REVIEW_REQUIRED` or `CONFLICT`; never treats shared contact as ownership | Audited safe decision codes contain no raw contact data | Shared evidence serializes conservatively and cannot merge identities. |
| P2-R13 Guardian create-new vs canonical Guardian editor | Root, Guardian mutexes, Request/source, exact existing target when discovered | Root → mutexes → Request → source → target → review/reservation | Existing editor or future creation transaction first | Re-search and return `TARGET_VERSION_STALE`, reviewed reuse path, or conflict | Committed editor/create path only | Unique backstop plus mutex recheck prevents second Guardian. |
| P2-R14 Student create-new vs Student editor | Root, Student mutexes, Request/source, stable Student target | Root → mutexes → Request → source → Student target → review/reservation | Existing editor or future creation transaction first | Re-search, then stale/review/conflict; never child name/birth shortcut | Committed mutation only | Student update cannot be missed by create-new protocol. |
| P2-R15 center suspend vs review/reservation mutation | Same center root | Root is first for both | First root/mutation commit | Waiting mutation rechecks root and returns `CRM_RUNTIME_NOT_ACTIVE`; if mutation wins, later suspend governs future use | Only committed business/root transition events | No mutation starts after suspension and no stale reservation executes later. |
| P2-R16 reassignment/security revoke while reviewer acts | Root; mutexes; account rows when runtime exists; Request/source; Assignment | Root → mutexes → account security → Request → source → Assignment → target/review | First assignment/security or review commit | Reviewer gets `ACTOR_NOT_AUTHORIZED`, assignment/source stale, or review immediately unusable after security version change | Each committed authority/review edge audited safely | Reviewer attribution never substitutes for current capability/assignment authority. |

## 18. Negative matrix P2-N1–P2-N24

| ID / prohibited behavior | Expected fail-closed result | Preserved invariant |
| --- | --- | --- |
| P2-N1 phone exact match auto-reuses | Return `MATCH_REVIEW_REQUIRED`; no reuse/reservation. | Contact evidence is not ownership proof. |
| P2-N2 email exact match auto-reuses | Return `MATCH_REVIEW_REQUIRED`; no reuse/reservation. | Shared contact methods cannot take over identity. |
| P2-N3 name-only match reuses | Return `INSUFFICIENT_IDENTITY_EVIDENCE`. | `NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO`. |
| P2-N4 birth/name-only Student reuses | Return insufficient/review-required under current policy. | Child identity needs approved multi-evidence review. |
| P2-N5 NO_MATCH directly authorizes create | Deny create authority; require current reviewed create-new path plus reservation and later P3 approval. | Search result is not authority. |
| P2-N6 INSUFFICIENT_EVIDENCE treated as NO_MATCH | Preserve `INSUFFICIENT_EVIDENCE`; block. | Sparse evidence cannot cause blind duplicate creation. |
| P2-N7 candidate-search outage treated as NO_MATCH | Return `MATCH_SEARCH_UNAVAILABLE`. | Completeness failure fails closed. |
| P2-N8 cross-center candidate existence leaks | Return indistinguishable `RESOURCE_NOT_AVAILABLE`, no count/ID. | Exact-center privacy. |
| P2-N9 stale review reused | Return `MATCH_REVIEW_STALE` and require new review. | Historical decision is not current authority. |
| P2-N10 stale target version reused | Return `TARGET_VERSION_STALE`. | Reuse binds exact target version. |
| P2-N11 stale normalizer review reused | Return `NORMALIZER_STALE`; supersede/expire safely. | No cross-version authority drift. |
| P2-N12 stale match-policy review reused | Return `MATCH_POLICY_STALE`; require fresh search/review. | Policy version remains bound. |
| P2-N13 raw PII used as mutex key | Reject invalid protected implementation/configuration; write nothing. | Mutex is opaque versioned digest only. |
| P2-N14 unsorted mutex acquisition | Reject internal plan before lock acquisition; incident safely. | Deterministic bytewise order prevents inversion. |
| P2-N15 unique constraint used instead of mutex | Reject protocol as incomplete; no create attempt. | Unique index remains backstop only. |
| P2-N16 reservation created before mutex recheck | Return `RESERVATION_CONFLICT`/internal invariant error and rollback. | Reservation follows full locked recheck. |
| P2-N17 reservation grants create authority | Future executor denies missing P3 approval/single-use authority. | Reservation is intent binding only. |
| P2-N18 reservation target ID rebound | Return `IDEMPOTENCY_CONFLICT` or `RESERVATION_CONFLICT`; old row immutable. | Preallocated ID is single-intent. |
| P2-N19 reservation moved between requests | Return `RESERVATION_CONFLICT`; create a new independently reviewed protocol if allowed. | Request/action binding immutable. |
| P2-N20 expired reservation accepted | Return `RESERVATION_EXPIRED`; no profile write. | Server time and expiry are authoritative. |
| P2-N21 terminal review edited in place | Deny update; create a superseding review row. | Terminal evidence remains immutable. |
| P2-N22 same idempotency key different intent overwrites | Return `IDEMPOTENCY_CONFLICT`; prior result unchanged. | No semantic key overwrite. |
| P2-N23 raw candidate data enters Audit/Outbox | Reject event payload and rollback business mutation. | Audit/Outbox are safe and PII-minimized. |
| P2-N24 P2 marks conversion Request COMPLETED | Reject transition as outside P2 operation allowlist. | Real conversion remains P3/P4. |

## 19. Threat model

| Threat | Mitigation | Residual handling |
| --- | --- | --- |
| Identity takeover via shared contact | Shared methods are evidence only; reviewed multi-evidence policy; shared mutex serialization. | Ambiguity returns review/conflict, never auto-reuse. |
| False-positive merge | Only current `EXACT_REVIEWED_MATCH`; exact target/source/policy versions. | Superseding review, never destructive merge in P2. |
| Duplicate-profile race | Center root + complete sorted mutexes + locked re-search + reservation. | Unique constraint is a final rollback backstop. |
| Cross-center privacy oracle | Exact-center adapter and indistinguishable not-available errors. | No cross-center counts, IDs, masks, mutexes, or reservations. |
| Stale-review replay | Immutable version-bound decisions with expiry and current-row recheck. | `MATCH_REVIEW_STALE`; fresh review required. |
| Normalizer downgrade/drift | Current registry version, drain/expire rollout, no old/new parallel authority. | Fail closed until drain is proven. |
| Reservation hijack | Bind center/kind/Request/action/intent/target/mutex/evidence and versions. | Rebinding conflicts and is audited without PII. |
| Preallocated-ID reuse | One immutable target per intent and permanent history. | Conflict; never allocate it to another intent. |
| Reviewer authority confusion | Attribution is not authority; future resolver/account/assignment versions rechecked. | `ACTOR_NOT_AUTHORIZED`; no decision commit/use. |
| Candidate-enumeration attack | Protected exact-purpose calls, rate limit, capped masked results, opaque IDs, no-store. | Safe generic denial and security telemetry without PII. |
| Child identity overexposure | Server masking, minimum projection, no raw birth/contact/payload. | No full reveal in P2. |
| Idempotency overwrite | Scoped immutable intent/result binding. | Different intent returns conflict. |
| Lock-order deadlock | One global tier order; byte-sort mutexes and type+ID-sort targets. | Timeout is safe failure and liveness incident; no retry with weaker locks. |
| Audit PII leakage | Typed event allowlist and transaction rollback on validation/write failure. | No business commit without safe Audit/Outbox pair. |

## 20. Future physical-schema proposal — no SQL in this phase

### P2A implementation handoff constraint

```text
CURRENT_PHYSICAL_CONVERSION_ACTION_AGGREGATE: NOT ESTABLISHED AS A SEPARATE TABLE BY P1

P2A MUST NOT invent a foreign key to a nonexistent action table.

Exact Request/action binding must use the current canonical Request/action-graph representation actually present at P2A implementation time, with opaque action identity/action-intent digest and version binding as required by the audited P2 contract.

If satisfying exact action binding requires a new canonical action aggregate beyond approved P2A scope:
STOP NEEDS REVIEW.
```

This is an implementation clarification, not a new physical aggregate, schema
change, runtime claim, or expansion of P2A authority.

All proposed tables are dedicated CRM resources: RLS enabled and forced; no
`anon` or `authenticated` table privileges; no Realtime publication; no generic
cloud representation; no direct browser execution. Internal helpers have all
execution revoked. Only separately approved protected typed operations may own
access. Service-role execution is still backend attribution, not final
F23.13D capability authority.

### 20.1 `crm_identity_policy_registry`

- **Purpose:** immutable executable metadata for normalizer, digest epoch,
  identity kind, match policy, and minimum-evidence policy; exact current-version
  source composed with `center_crm_control.identity_policy_version`.
- **Primary key:** opaque `identity_policy_registry_id`.
- **Center binding:** exact FK to center and center CRM root.
- **Versions/status:** positive `normalization_version`, `match_policy_version`,
  `minimum_evidence_policy_version`, `policy_registry_version`; status
  `STAGED | CURRENT | DRAINING | RETIRED`.
- **Timestamps:** server `created_at`, `activated_at`, `drain_started_at`, and
  `retired_at` with state checks.
- **Constraints/indexes:** unique center/kind/version tuple; at most one `CURRENT`
  row per center/kind as an integrity backstop; current lookup and drain indexes.
- **Ownership/retention:** protected policy service only; immutable after
  activation except lifecycle/version edges; retain while any review,
  reservation, Request, Audit, or retention policy references it.

### 20.2 `crm_identity_match_mutex`

- **Purpose:** stable pre-existing/ensure-under-root serialization row for one
  opaque identity mutex key; it stores no raw normalized value.
- **Primary key:** fixed-size `identity_match_mutex_key`.
- **Center binding:** center/root FK plus redundant checked `identity_kind` and
  normalization/policy registry FK to prevent cross-center reinterpretation.
- **Versions/status:** positive `mutex_version`; status `ACTIVE | RETIRED` only.
- **Timestamps:** `created_at`, `last_used_at`, optional `retired_at`, server time.
- **Constraints/indexes:** unique key and unique protected domain tuple as
  integrity backstops; center/kind/current-version lookup and retention indexes.
- **Ownership/retention:** protected identity service only. Never expose row
  existence. Retire only after no nonterminal review/reservation/request can use
  the key; retain tombstone/history per identity retention policy.

### 20.3 `crm_identity_match_review`

- **Purpose:** immutable versioned search/reviewer evidence and exact reuse
  eligibility decision; not approval.
- **Primary key:** opaque `match_review_id`.
- **Center binding/FKs:** center/root, exact Request/action, Contact/Case/candidate
  source when present, policy registry, optional prior review, and an adapter-
  validated opaque target reference. Because target physical stores do not yet
  exist, the target FK is deferred to the approved adapter schema and cannot be
  faked as a current FK.
- **Versions/status:** all bound source/target/Request/action/reviewer-authority
  versions; positive `review_version`; lifecycle exactly `PENDING |
  EXACT_REVIEWED_MATCH | CREATE_NEW_REVIEWED | REJECTED_MATCH | CONFLICT |
  EXPIRED | SUPERSEDED`;
  canonical `match_outcome` from section 3.
- **Protected evidence:** fixed-size evidence-set and mutex-set digests,
  projection snapshot digest, never serialized.
- **Timestamps:** `created_at`, optional `decided_at`, mandatory `expires_at`, and
  terminal timestamp checks, all server time.
- **Constraints/indexes:** immutable terminal trigger; one nonterminal exact
  review intent backstop; exact center/request/action, target-current, expiry,
  and supersession indexes.
- **Ownership/retention:** protected review service; retain terminal decision and
  supersession chain with Request/Audit retention; expiry removes authority, not
  evidence.

### 20.4 `crm_profile_creation_reservation`

- **Purpose:** bind a preallocated target ID to one exact reviewed create-new
  Request/action intent before approval; never create/grant.
- **Primary key:** opaque `reservation_id`.
- **Center binding/FKs:** center/root, exact Request/action, review, policy
  registry, optional superseded reservation, and future adapter namespace. Target
  FK is deferred until the canonical target service exists.
- **Versions/status:** positive Request/action/source/review/reservation versions;
  lifecycle exactly `ACTIVE | CONSUMED | EXPIRED | CANCELLED | SUPERSEDED`.
- **Timestamps:** server `created_at`, `updated_at`, `expires_at`, optional
  terminal timestamp; no client clock authority.
- **Constraints/indexes:** immutable binding; one active exact intent; globally
  non-rebindable `(center, entity kind, preallocated target ID)` backstop; active
  Request/action and expiry indexes.
- **Ownership/retention:** protected reservation service and future P3 executor
  only. Retain terminal records at least as long as conversion/Audit retention;
  expiry never deletes history or frees the target ID for a different intent.

No Guardian, Student, or Guardian–Student table is proposed as current truth in
P2. Their exact physical schemas and FK composition remain explicit adapter/domain
prerequisites.

## 21. Future protected typed operation proposal

All operations derive center from a locked current source/Request, take server
time/correlation, require expected versions, return allowlisted safe fields, and
deny direct browser execution. `p_actor_user_id`-style attribution does not grant
authority; a future caller must pass the separately approved server resolver.

```text
P2_ACTOR_ATTRIBUTION_GRANTS_END_USER_AUTHORITY: NO
P2_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO
```

| Operation | Actor/center and input versions | Idempotency and locks | Safe result/failure | Audit/Outbox | Browser policy |
| --- | --- | --- | --- | --- | --- |
| `crm.identity.search_masked_candidates` | Reviewer attribution; center derived from Request/Case; expected Request, Contact, Case, candidate, Assignment, normalizer/policy/adapter versions. | Persisted snapshot uses scoped key; root → mutexes for authoritative snapshot → Request/source/Assignment → stable targets. | Projection of section 9 plus canonical match outcome; safe stale/unavailable/insufficient outcomes. | If persisted, `crm.identity.search_snapshotted`; ephemeral search has no mutation event. | Direct execute denied; protected backend only. |
| `crm.identity.get_masked_candidate_review_detail` | Exact review-purpose attribution and source versions; same derived center. | Read-only current authorization; no client cache. | One minimal masked candidate or `RESOURCE_NOT_AVAILABLE`; never raw payload. | Read audit only if approved privacy policy requires it; no Outbox for plain read. | Direct execute denied. |
| `crm.identity.create_match_review` | Reviewer attribution plus future resolver evidence; expected search/source/target/policy versions and preallocated review ID. | Scoped idempotency; full order through target then review. | PENDING review ID/version/expiry or typed safe conflict. | `crm.identity.review_created`. | Direct execute denied. |
| `crm.identity.decide_match_review` | Exact current reviewer authority; expected review/source/target/policy versions and canonical decision/safe reason. | Scoped idempotency; root → mutexes → account rows when present → Request/source/Assignment/target → review. | Terminal review safe status; stale/required/unauthorized outcomes. | `crm.identity.review_decided`. | Direct execute denied. |
| `crm.identity.supersede_match_review` | Protected policy/source/reviewer service; expected current review version and reason. | Scoped idempotency; same overlap order; never terminal in-place rewrite. | New review link or terminal supersede snapshot. | `crm.identity.review_superseded`. | Direct execute denied. |
| `crm.identity.expire_match_review` | Protected server-time maintenance under exact center root. | Idempotent transition; mutexes and overlapping Request/source before review. | Exact terminal snapshot or prior result. | `crm.identity.review_expired`. | Direct execute denied. |
| `crm.identity.reserve_create_target` | Current reviewer attribution; exact Request/action, current `CREATE_NEW_REVIEWED` evidence, preallocated target ID, source/policy versions. | Scoped idempotency; full order through target search/recheck, review, then reservation. | Reservation ID/target opaque ID/status/version/expiry only; conflict/stale safe failures. | `crm.identity.creation_reserved`. | Direct execute denied. |
| `crm.identity.cancel_creation_reservation` | Request owner/governance attribution resolved in future; expected Request/reservation versions, safe reason. | Scoped idempotency; root → mutexes → Request/source → review → reservation. | Terminal safe snapshot or exact replay. | `crm.identity.creation_reservation_cancelled`. | Direct execute denied. |
| `crm.identity.expire_creation_reservation` | Protected server-time maintenance. | Idempotent expiry under full overlapping order. | Expired/prior safe snapshot. | `crm.identity.creation_reservation_expired`. | Direct execute denied. |
| `crm.identity.read_creation_reservation_status` | Exact protected Request/action scope; derived center. | Non-mutating; current authorization and non-disclosing lookup. | Opaque IDs, lifecycle/version/expiry only; `RESOURCE_NOT_AVAILABLE` otherwise. | No Outbox; optional safe read audit by policy. | Direct execute denied. |

No operation accepts an arbitrary table, entity type, payload, center authority,
role claim, raw identity digest, client timestamp, client correlation ID, approval,
or `converted/completed` transition.

## 22. Future implementation sequence P2A–P2D

These are internal dependencies, not new roadmap children in this task.

| Phase | Allowed files and implementation expectation | Local QA and audit gate | Still blocked after phase |
| --- | --- | --- | --- |
| P2A — Physical identity/review/mutex/reservation schema foundation | After explicit approval: exactly scoped forward migration, report, semantic smoke, and guarded local DB QA. Create only policy registry, mutex, review, and reservation resources with fail-closed RLS/grants/integrity/lifecycle. No Guardian/Student/Relationship tables or profile runtime. | Clean local reset; catalog, privilege, lifecycle, exact-center FK, immutable terminal, expiry, and lock-order fixture QA; all inherited smokes; external technical audit before closeout. | Normalization execution, candidate search, review RPC, reservation RPC, P3 approval/executor, target profile services, UI, remote rollout. |
| P2B — Versioned normalization and exact-center masked candidate search | After P2A audit/closeout and explicit approval: one forward migration only if schema/RPC support is required, protected normalizer/search service, adapter contracts, report/smoke/local QA. No generic cloud/browser access. | Golden normalization vectors without raw PII, drift/downgrade, adapter outage/completeness, exact-center non-disclosure, masking/no-store, multi-account, fault and concurrency QA; external audit. | Decision/reservation mutation, profile create/reuse execution, approval, real conversion. |
| P2C — Reviewed decision and create-new reservation typed runtime | After P2B audit/closeout and explicit approval: one forward migration if required, protected typed review/reservation operations, Audit/Outbox, report/smoke/local QA. | Full lifecycle/idempotency/version/stale/server-time tests, P2-R1–R16 and P2-N1–N24, Audit/Outbox rollback, multi-connection liveness; external audit. | P3 capability/step-up/approval/executor, actual Guardian/Student/Relationship writes, UI/remote rollout. |
| P2D — Integrated duplicate/concurrency/security/fault QA and P3-entry gate | QA/report/smoke/runner only unless a defect forces `STOP NEEDS REVIEW`; no opportunistic runtime patch. Orchestrate P2A–P2C and P1 inherited checks. | Clean reset; direct API fail-closed, multi-center privacy, normalizer rollout, kill-switch, races, fault injection, replay, final reset; external audit and explicit P3 planning gate. | Production readiness, active/remote rollout, full reveal, browser conversion, P3 approval/execution, P4 end-to-end. |

Every implementation phase must preserve prior migration hashes, use forward-only
changes, stop for architectural/runtime defects outside its approved scope, and
receive separate explicit user approval. No phase may self-close external audit.

## 23. Immutable migration checkpoint inventory

P2 creates no migration. The current 11 checkpoints remain:

| Migration | SHA-256 |
| --- | --- |
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

## 24. Roadmap and execution boundary

Both roadmap files remain unchanged. Before external audit/closeout, their
current status remains exactly P1 DONE backend/local foundation verified; P2
TODO backend/design; P3 TODO backend; P4 TODO public/QA.

```text
F23_3E_P2_SQL_CHANGE: NO
F23_3E_P2_SRC_RUNTIME_CHANGE: NO
F23_3E_P2_SUPABASE_LOCAL_ACTION: NOT RUN
F23_3E_P2_REMOTE_APPLY: NOT RUN
F23_3E_P2_AUTH_CHANGE: NO
F23_3E_P2_EDGE_FUNCTION_CHANGE: NO
F23_3E_P2_DEPLOY: NOT RUN
F23_3E_P2_BROWSER_UI_WIRING: NOT STARTED
F23_3E_P2_REAL_IMPORT: NOT RUN
F23_3E_P2_REAL_DATA_CHANGE: NO
F23_3E_P2_FULL_CONTACT_REVEAL: NOT IMPLEMENTED
F23_3E_P2_CONVERSION_APPROVAL: NOT IMPLEMENTED
F23_3E_P2_PROFILE_CREATION: NOT IMPLEMENTED
F23_3E_P2_RELATIONSHIP_CREATION: NOT IMPLEMENTED
```

P1 active/remote rollout remains blocked; production readiness is not claimed.
The next permitted decision after a successful external audit closeout is only
whether to grant explicit P2A implementation approval.

F23.3E-P2 FINAL CLOSEOUT COMPLETE — EXTERNAL TECHNICAL AUDIT PASS
