F23_3E_P2A_STATUS: IMPLEMENTED IN REPO
F23_3E_P2A_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P2A_MIGRATION_CREATED: YES
F23_3E_P2A_LOCAL_SQL_APPLY: PASS
F23_3E_P2A_LOCAL_DB_QA: PASS

F23_3E_P2A_NEW_BUSINESS_TABLE_COUNT: 4

F23_3E_P2B_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P2C_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED

F23_3E_P2A_REMOTE_APPLY: NOT RUN
F23_3E_P2A_AUTH_CHANGE: NO
F23_3E_P2A_EDGE_FUNCTION_CHANGE: NO
F23_3E_P2A_DEPLOY: NOT RUN
F23_3E_P2A_BROWSER_UI_WIRING: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO

# F23.3E-P2A — Physical identity review, mutex, and reservation schema foundation

## 1. Scope and checkpoint

P2A was implemented from clean `main` at checkpoint `890c4a4`. It is a
forward-only physical foundation and does not execute identity normalization,
candidate search, review decisions, profile creation, conversion approval, or
conversion. The P2 design remains the normative authority boundary.

Exactly one migration was added:

```text
MIGRATION: supabase/migrations/202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql
SHA-256: 55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773
```

The migration creates no real policy row, mutex, review, reservation, identity
decision, or target profile. Local QA uses generated synthetic identifiers and
safe fixed-size digests, then performs a final reset.

External technical audit: PASS. The audit verified the physical schema,
historical P2 and P2A semantic-smoke forward compatibility, guarded local
Docker QA, and clean final reset. This closes P2A only; it grants no P2B/P2C/P3
runtime authority and does not change any rollout boundary.

```text
F23_3E_P2A_EXTERNAL_TECHNICAL_AUDIT_VERDICT: PASS
F23_3E_P2A_EXTERNAL_TECHNICAL_AUDIT_BLOCKERS: NONE
```

## 2. Repository-truth binding

P2A does not invent a conversion-action aggregate. Review and reservation rows
bind the actual P1 representation:

```text
conversion_request_id
request_version
opaque action_id
action_intent_digest
request_action_graph_digest
```

The guards recheck the exact current Request, Request version, action-graph
digest, source Contact, and Consultation Case. Optional candidate evidence uses
the existing `consultation_case_candidate_student` exact-Case representation.
No Guardian, Student, Guardian–Student Relationship, conversion action,
conversion execution, or approval table was created. Target identities remain
opaque adapter namespace + UUID + version bindings because a protected
canonical target store does not yet exist.

```text
P2A_SEPARATE_CONVERSION_ACTION_TABLE_CREATED: NO
P2A_GUARDIAN_TABLE_CREATED: NO
P2A_STUDENT_TABLE_CREATED: NO
P2A_RELATIONSHIP_TABLE_CREATED: NO
P2A_CONVERSION_EXECUTION_TABLE_CREATED: NO
P2A_APPROVAL_TABLE_CREATED: NO
```

## 3. Exact physical inventory

The migration creates exactly these four business tables:

| Table | Physical purpose |
| --- | --- |
| `crm_identity_policy_registry` | Versioned identity policy metadata composed with the existing center control root. |
| `crm_identity_match_mutex` | Stable opaque serialization row for one exact environment/policy/center/kind/normalization epoch. |
| `crm_identity_match_review` | Immutable versioned candidate/reviewer evidence bound to the current Request action graph and exact source. |
| `crm_profile_creation_reservation` | Non-rebindable preallocated opaque target bound to one reviewed create-new intent. |

Four trigger functions enforce the row state machines. Their names are
`f23_3e_p2a_internal_*`; execution is revoked from `PUBLIC`, `anon`,
`authenticated`, and `service_role`. They are internal trigger mechanics, not
application RPCs.

```text
P2A_NEW_BUSINESS_TABLE_COUNT: 4
P2A_P2B_NORMALIZATION_SEARCH_RPC_CREATED: NO
P2A_P2C_REVIEW_RESERVATION_RPC_CREATED: NO
```

## 4. Fail-closed table security

All four tables have RLS enabled and forced, have zero policies, and are absent
from `supabase_realtime`. The migration revokes all direct table privileges from
`PUBLIC`, `anon`, `authenticated`, and `service_role`. P2B/P2C must later add
separately audited protected operations rather than granting generic table
access.

Local catalog inspection and actual `SET ROLE` access attempts proved the
posture for `anon`, `authenticated`, and `service_role`.

```text
P2A_RLS_ENABLED_FORCED_ALL_TABLES: YES
P2A_BROWSER_TABLE_PRIVILEGES: NONE
P2A_SERVICE_ROLE_DIRECT_TABLE_PRIVILEGES: NONE
P2A_REALTIME_PUBLICATION: NO
P2A_BROWSER_DIRECT_ACCESS: NO
P2A_GENERIC_CLOUD_ENTITY_REPRESENTATION: NO
```

## 5. Policy registry lifecycle

Each policy row is exact-bound to `center_crm_control` and snapshots its
`identity_policy_version`. Identity kind is closed to `GUARDIAN` or `STUDENT`;
this is metadata vocabulary and does not assert those profile runtimes exist.
Environment fingerprint and normalization/digest/match/minimum-evidence
versions form immutable bindings.

The only lifecycle is:

```text
STAGED -> CURRENT -> DRAINING -> RETIRED
```

Rows start at version 1 in `STAGED`; each transition is exactly +1. Timestamps
are supplied by database transaction time. Retired rows cannot reopen. Exact
policy tuples cannot duplicate, and a partial unique index permits at most one
`CURRENT` row per center and identity kind. The registry composes with, and
does not modify or replace, the P1 center control root.

## 6. Opaque identity mutex

The mutex primary key is exactly 32 bytes. A composite FK binds it to one
environment fingerprint, exact center, identity kind, policy registry row,
normalization version, and digest-key epoch. A row starts `ACTIVE` at version 1;
it may be touched with +1 or transition once to immutable `RETIRED`.

The lock-order index is `(center_id, identity_kind,
identity_match_mutex_key)`, allowing future protected runtime to lock stable
byte-sorted resources. Neither the table nor its keys store raw or normalized
names, dates of birth, phone numbers, email addresses, or free-form identity
payloads.

```text
P2A_RAW_PII_MUTEX_COLUMN_EXISTS: NO
P2A_RAW_NORMALIZED_IDENTITY_MUTEX_COLUMN_EXISTS: NO
P2A_IDENTITY_UNIQUE_CONSTRAINT_REPLACES_MUTEX_PROTOCOL: NO
```

Unique constraints are integrity backstops only. A future P2B/P2C transaction
must still acquire and recheck mutex rows in the canonical order.

## 7. Match review evidence and duplicate signal

The outcome vocabulary is closed to exactly:

```text
NO_MATCH
POSSIBLE_MATCH
PROBABLE_MATCH
EXACT_REVIEWED_MATCH
CONFLICT
INSUFFICIENT_EVIDENCE
```

The review lifecycle is `PENDING` followed by exactly one terminal state:
`EXACT_REVIEWED_MATCH`, `CREATE_NEW_REVIEWED`, `REJECTED_MATCH`, `CONFLICT`,
`EXPIRED`, or `SUPERSEDED`. The four decision states map physically to exactly
`REUSE_EXISTING`, `PREPARE_CREATE_NEW`, `REJECT_IDENTITY_ACTION`, and
`ESCALATE_IDENTITY_CONFLICT`. A valid transition increments `review_version`
by one and receives a server decision timestamp; terminal rows and all source,
target, policy, evidence, mutex, projection, Request, and action bindings are
immutable. A later decision is a new exact-center superseding row.

Finite `safe_reason_code` values include
`NAME_AND_BIRTH_EXACT_CANDIDATE`. This records only the class of protected
evidence. It stores neither an actual name nor birth value. That signal may be
inserted as review evidence but cannot by itself satisfy the semantic mapping
for reviewed reuse, produce create authority, or create/consume a reservation.

```text
P2A_RAW_PII_REVIEW_COLUMN_EXISTS: NO
P2A_EXACT_NAME_AND_BIRTH_MATCH_AUTO_MERGES: NO
P2A_EXACT_NAME_AND_BIRTH_MATCH_AUTO_CREATES_SECOND_PROFILE: NO
P2A_EXACT_NAME_AND_BIRTH_MATCH_REQUIRES_REVIEW_PATH: YES
```

Only current `EXACT_REVIEWED_MATCH` evidence maps to reuse. `NO_MATCH` alone is
not create authority; a separate terminal `CREATE_NEW_REVIEWED` decision is
required even to prepare a reservation.

## 8. Profile-creation reservation

A reservation starts `ACTIVE` at version 1 and may transition exactly once to
`CONSUMED`, `EXPIRED`, `CANCELLED`, or `SUPERSEDED`, always with +1 version and
server terminal timestamp/reason. Terminal rows cannot reopen. Insert and
future consume checks require a current `CREATE_NEW_REVIEWED` review with
`NO_MATCH` + `PREPARE_CREATE_NEW`, the exact Request/action graph, exact policy,
and matching protected digests.

All intent and evidence bindings are immutable. A partial unique index permits
at most one active reservation for one exact center/entity/Request/action
intent. A non-partial historical unique index permanently binds the opaque
preallocated target to one center/entity/adapter reservation history; expiry,
cancellation, or supersession does not make it reusable by another intent.

All creation/update timestamps are server-controlled. New rows require a
future `expires_at`; an expired reservation cannot be consumed or reused and is
retained as history.

```text
P2A_PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: NO
P2A_PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO
P2A_RESERVATION_CREATES_PROFILE: NO
P2A_RESERVATION_APPROVES_CONVERSION: NO
P2A_RESERVATION_COMPLETES_REQUEST: NO
P2A_REAL_PROFILE_CREATION_IMPLEMENTED: NO
```

`CONSUMED_BY_FUTURE_EXECUTOR` is a reserved terminal evidence label. P2A does
not provide an operation able to invoke it through application authority; P3
must separately implement and audit any real executor.

## 9. Exact-center and lock-order evidence

Composite foreign keys reject cross-center policy, Request, Contact, Case,
candidate, review, reservation, and supersession bindings. Adapter target IDs
intentionally have no invented FK; their opaque presence cannot grant reuse,
profile, or conversion authority.

The two-session liveness drill acquired resources in this order:

```text
CENTER_CRM_CONTROL_ROW
-> SORTED_IDENTITY_MUTEX_ROWS
-> IDEMPOTENCY/REQUEST
-> CONTACT/CASE/SOURCE_EVIDENCE
-> MATCH_REVIEW_ROWS
-> PROFILE_CREATION_RESERVATION_ROWS
```

Session B was observed waiting through `pg_stat_activity` joined to `pg_locks`
while Session A held the center root. After Session A committed, Session B
completed without deadlock, timeout, or state corruption.

```text
P2A_SCHEMA_GLOBALLY_ENFORCES_RUNTIME_LOCK_ORDER: NO
P2A_PHYSICAL_RESOURCES_SUPPORT_CANONICAL_LOCK_ORDER: YES
```

This is deliberately a liveness result, not a claim that schema alone can make
every future caller acquire locks correctly.

## 10. Local QA evidence

The guarded runner uses Node built-ins only and refuses to reset unless
`ICHESS_P2A_LOCAL_QA_ALLOW_RESET=YES`. It discovers Supabase only through
`npx --no-install supabase status -o json`, requires project
`ichess-center-os`, exact container `supabase_db_ichess-center-os`, loopback
URLs, no linked project, and no explicit database locator. Its only reset/apply
operation is local `npx --no-install supabase db reset`.

Observed runtime results:

```text
P2A_QA_LOCAL_SAFETY_GUARD: PASS
P2A_QA_LOCAL_SQL_APPLY: PASS
P2A_QA_FOUR_TABLES_PRESENT: PASS
P2A_QA_RLS_ENABLED_FORCED: PASS
P2A_QA_DIRECT_TABLE_ACCESS_DENIED: PASS
P2A_QA_NOT_IN_REALTIME: PASS
P2A_QA_POLICY_LIFECYCLE: PASS
P2A_QA_ONE_CURRENT_POLICY: PASS
P2A_QA_MUTEX_EXACT_CENTER: PASS
P2A_QA_MUTEX_NO_RAW_PII: PASS
P2A_QA_REVIEW_EXACT_CENTER: PASS
P2A_QA_REVIEW_TERMINAL_IMMUTABLE: PASS
P2A_QA_REVIEW_VERSION_PLUS_ONE: PASS
P2A_QA_EXACT_NAME_BIRTH_DUPLICATE_REVIEW_SUPPORT: PASS
P2A_QA_RESERVATION_EXACT_CENTER: PASS
P2A_QA_RESERVATION_TERMINAL_IMMUTABLE: PASS
P2A_QA_RESERVATION_NON_REBINDABLE_TARGET: PASS
P2A_QA_RESERVATION_EXPIRY_FAIL_CLOSED: PASS
P2A_QA_ONE_ACTIVE_EXACT_INTENT: PASS
P2A_QA_CANONICAL_LOCK_ORDER_LIVENESS: PASS
P2A_QA_FINAL_LOCAL_RESET: PASS
P2A_QA_LEFTOVER_FIXTURE_COUNT: 0
P2A_QA_NONDEFAULT_ROOT_COUNT: 0
P2A_QA_TEMP_HELPER_COUNT: 0
```

The final reset also proved migration `202608110001` exactly once and the five
P1A–P1E migrations exactly once each.

## 11. Frozen migration inventory

All 11 inherited migrations remain byte-identical:

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

## 12. Deferred authority and production boundary

P2A adds no application mutation RPC and therefore emits no live P2
Audit/Outbox events. P2C must later provide atomic, typed, protected mutations
and P1-compatible safe Audit/Outbox evidence.

```text
P2A_P2_MUTATION_AUDIT_OUTBOX_RUNTIME: NOT IMPLEMENTED — P2C
P2A_MATCHING_NORMALIZER_RUNTIME: NOT IMPLEMENTED — P2B
P2A_MASKED_CANDIDATE_SEARCH_RUNTIME: NOT IMPLEMENTED — P2B
P2A_REVIEW_RESERVATION_TYPED_RUNTIME: NOT IMPLEMENTED — P2C
P2A_CONVERSION_APPROVAL_EXECUTOR: NOT IMPLEMENTED — P3
P2A_REMOTE_PRODUCTION_ROLLOUT: BLOCKED
P2A_PRODUCTION_READINESS: NOT CLAIMED
```

No remote apply, Auth mutation, Edge Function, deployment, UI/browser wiring,
real LocalStorage import, full reveal, real-data mutation, or real conversion
was performed. The roadmap now records P2A as DONE backend/local verified;
P2B–P2D and P3/P4 remain TODO.
