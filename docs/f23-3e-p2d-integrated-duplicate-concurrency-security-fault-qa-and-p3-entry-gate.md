# F23.3E-P2D — Integrated Duplicate, Concurrency, Security, Fault QA and P3-Entry Gate

## Status

```text
F23_3E_P2D_STATUS: QA COMPLETED IN REPO
F23_3E_P2D_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P2D_MIGRATION_CREATED: NO
F23_3E_P2D_RUNTIME_CHANGE: NO
F23_3E_P2D_LOCAL_DB_QA: PASS

F23_3E_P2D_REMOTE_APPLY: NOT RUN
F23_3E_P2D_AUTH_CHANGE: NO
F23_3E_P2D_EDGE_FUNCTION_CHANGE: NO
F23_3E_P2D_DEPLOY: NOT RUN
F23_3E_P2D_BROWSER_UI_WIRING: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO
```

Baseline was clean `main` at
`8c3faeec0c30f883800eb66f65a3f7d5063890fa`. P2D adds no migration,
business runtime, production helper, `src` change, Auth change, Edge Function,
deployment, browser wiring, import, profile write, relationship write, or real
conversion.

## Front-loaded repository truth and P3 prerequisites

Design approval is not counted as runtime availability. The inventory below
was completed before the integrated gate.

| Runtime prerequisite or current boundary | Disposition | Repository evidence and gate effect |
|---|---|---|
| F23.13C fresh server-derived step-up runtime | ABSENT | F23.13 remains design-only; `SERVER_DERIVED_STEP_UP_IMPLEMENTED: NO` and runtime `NOT STARTED`. Blocks P3 approval authority. |
| Single-use approval/authority runtime | ABSENT | P1B explicitly has no approval executor or fresh step-up; P3 has not started. Blocks P3 approval. |
| F23.13D final capability resolver | ABSENT | F23.13D is audited design only; resolver runtime is `NO`. P2C actor attribution remains interim protected-service attribution, not end-user authority. |
| Current Student storage/write paths | PARTIAL | Local Student records and generic `center_cloud_entities` Student upserts exist, but they are not a protected canonical identity writer. |
| Canonical protected Student writer | ABSENT | No typed service binds the server-preallocated reservation target and writes a canonical Student atomically. |
| Student writer identity-mutex participation | ABSENT | No current Student writer uses `crm_identity_match_mutex`; P2B explicitly records participation `NO`. |
| Audited Student reuse authority | ABSENT | P2B's legacy Student adapter is detection-only and always returns `reuse_eligible=false`. |
| Guardian canonical target adapter | ABSENT | P2B returns `MATCH_SEARCH_UNAVAILABLE` for Guardian. CRM Contact is not a Guardian profile. |
| Guardian canonical writer | ABSENT | No protected canonical Guardian table or typed writer exists. |
| Guardian–Student relationship writer | ABSENT | F23.2 remains design-only and no independent canonical relationship aggregate/writer exists. |

Current P2 boundaries are deliberately narrower than P3: P2B search is
AVAILABLE for exact-center Student detection only; P2C protected review and
reservation mutations are AVAILABLE; Guardian search, Student reuse authority,
profile writes, reservation consumption, approval, and conversion execution
are ABSENT.

```text
P3_STEP_UP_AUTHORITY_RUNTIME: BLOCKED_PREREQUISITE
P3_FINAL_CAPABILITY_RUNTIME: BLOCKED_PREREQUISITE

P3_STUDENT_CREATE_TARGET_WRITE: BLOCKED_PREREQUISITE
P3_STUDENT_REUSE: BLOCKED_PREREQUISITE

P3_GUARDIAN_CREATE: BLOCKED_PREREQUISITE
P3_GUARDIAN_REUSE: BLOCKED_PREREQUISITE

P3_GUARDIAN_STUDENT_RELATIONSHIP_WRITE: BLOCKED_PREREQUISITE
```

The blocker count below counts these seven explicit gate dispositions. The
step-up disposition covers both missing fresh verification and missing
single-use approval authority.

```text
P2D_P2_FOUNDATION_READY_FOR_P3_IMPLEMENTATION: YES
P2D_REAL_CONVERSION_EXECUTION_READY: NO
P2D_P3_BLOCKING_PREREQUISITE_COUNT: 7
```

`YES` for the P2 foundation means only that P3 implementation may begin on a
stable search/review/reservation base. It does not authorize remote apply,
deploy, browser enablement, real data, production traffic, or real conversion.
Every blocker above is a P3 dependency or design/implementation decision, not
a P2D failure, because current P2 behavior fails closed.

## Frozen checkpoint inventory

```text
P2D_CHECKPOINT_MIGRATION_HASH_COUNT: 14
P2D_OWNED_MIGRATION_COUNT: 0
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

The smoke locks these 14 checkpoint hashes without asserting a fixed total
repository migration count, so later P3/P4 migrations remain compatible.

## Integrated duplicate and create-new chains

Synthetic exact-center Student evidence with the same normalized full name and
same exact full birth date produced all three required signals:

```text
PROBABLE_MATCH
MATCH_REVIEW_REQUIRED
NAME_AND_BIRTH_EXACT_CANDIDATE
```

Two same-center strong candidates remained masked, `reuse_eligible=false`, and
review-only. P2C created one `PENDING` review, while `REUSE_EXISTING`,
`PREPARE_CREATE_NEW`, and reservation creation all failed closed. Name-only,
birth-only, name plus year-only birth, contradictory exact birth, and multiple
candidate controls never selected an automatic winner.

The separate complete-no-match chain executed through the real protected
contracts:

```text
P2B complete NO_MATCH
→ P2C PENDING review
→ PREPARE_CREATE_NEW
→ CREATE_NEW_REVIEWED
→ ACTIVE reservation
```

The target UUID was generated by the server. Every result kept
`profile_created`, `profile_reused`, `conversion_approved`, and
`request_completed` false. No profile, Guardian, Student, or relationship row
was created. No consume RPC exists, no reservation became `CONSUMED`, and no
Request became `APPROVED`, `EXECUTING`, or `COMPLETED`.

## Idempotency and transactional Audit/Outbox

Exact replay was executed for review creation, review decision, reservation
creation, cancellation, and expiry. Each replay returned the same resource ID,
version, target where applicable, and correlation ID with `replayed=true`, and
wrote no second mutation, Audit event, or Outbox event. Concurrent same-key
same-intent replay serialized on real locks. Concurrent same-key changed intent
returned `IDEMPOTENCY_CONFLICT` without overwriting the completed snapshot.

Each non-replay identity mutation has exactly one Audit and one Outbox event,
the same correlation ID, and the matching aggregate version. Global joins found
no orphan event on either side. Safe payload scans found no synthetic name,
birth value, phone, email, normalized evidence, raw digest, mutex key, target
payload, or Vault material. Injected review, reservation, Audit, and Outbox
failures rolled back the business mutation and idempotency state atomically.

## Search failure, exact-center, account, and direct-API security

The integrated outage matrix covered missing ephemeral digest key, Guardian or
unknown adapter, incomplete Student payload, unknown Student source version,
normalizer drift, match/minimum-evidence policy drift, source version drift,
invalid evidence, adapter-row lock timeout, and identity-mutex lock timeout.
P2B search returned `MATCH_SEARCH_UNAVAILABLE` or the exact typed stale or
insufficient result. A P2C mutation attempted while the Vault key was absent
raised the protected-key exception and rolled back without partial state. No
failure became `NO_MATCH`, a reviewed create decision, or a reservation.

Equivalent evidence in Center B was invisible from Center A. Foreign Request,
candidate, actor, review, and reservation references returned indistinguishable
safe failures without candidate count, projection, target ID, or existence
signals. Active exact-center owner, center admin, and assigned consultant paths
were allowed under the documented interim protected-service check; unassigned,
inactive, and foreign-center accounts were denied. This is not a claim that the
final F23.13D resolver exists.

Local PostgREST proved anon and authenticated execution denied for P2B/P2C
protected RPCs, service-role execution allowed, internal helper execution
denied, and direct P2A table reads denied even to service role. No credential or
token was logged or persisted outside the reset-only local environment.

## P2-R1–P2-R16 integrated disposition

| Race | Disposition | P2D evidence |
|---|---|---|
| P2-R1 Guardian same evidence | DEPENDENCY-BLOCKED FAIL-CLOSED | Guardian adapter absent; `MATCH_SEARCH_UNAVAILABLE`, no review/reservation. |
| P2-R2 Student same evidence | EXECUTED PASS | Competing same-identity review transactions serialized; one row, loser `MATCH_REVIEW_CONFLICT`. |
| P2-R3 review vs source update | EXECUTED PASS | Real source-row wait followed by `SOURCE_VERSION_STALE`. |
| P2-R4 review vs target update | EXECUTED PASS | Real adapter-row wait followed by `TARGET_VERSION_STALE`. |
| P2-R5 policy rollout vs mutation | EXECUTED PASS | Root lock wait followed by `MATCH_POLICY_STALE`. |
| P2-R6 two create reservations | EXECUTED PASS | Competing transactions produced one reservation and `RESERVATION_CONFLICT`. |
| P2-R7 reservation expiry vs future P3 use | DEPENDENCY-BLOCKED FAIL-CLOSED | P3 consumer absent; executable expiry-vs-cancel race serialized and expiry won without consumption. |
| P2-R8 Request cancellation vs reservation | EXECUTED PASS | Reservation waited for P1B cancellation, returned `SOURCE_VERSION_STALE`, and wrote no reservation. |
| P2-R9 same key/same intent | EXECUTED PASS | Concurrent exact replay waited and returned the stored result. |
| P2-R10 same key/different intent | EXECUTED PASS | Concurrent changed intent waited and returned `IDEMPOTENCY_CONFLICT`. |
| P2-R11 old review vs target change | EXECUTED PASS | Target-version recheck failed closed after real target-row contention. |
| P2-R12 shared phone/email | DEPENDENCY-BLOCKED FAIL-CLOSED | P2B accepts neither as Student identity/reuse evidence and exposes no such authority path. |
| P2-R13 Guardian create vs editor | DEPENDENCY-BLOCKED FAIL-CLOSED | Guardian adapter and canonical writer are absent. |
| P2-R14 Student create vs editor | DEPENDENCY-BLOCKED FAIL-CLOSED | Canonical Student writer is absent; detection adapter row contention was executed and failed closed. |
| P2-R15 center suspend vs mutation | EXECUTED PASS | Mutation waited on the center root and returned `CRM_RUNTIME_NOT_ACTIVE`. |
| P2-R16 Assignment revoke vs mutation | EXECUTED PASS | Mutation waited on source/assignment state and returned a safe unavailable/stale result. |

Core waits were observed through `pg_stat_activity`, `pg_blocking_pids`, and
`wait_event_type='Lock'` with finite timeouts. No sleep-only inference or
reverse-order deadlock was used. The composed order remained center root,
sorted identity mutexes, idempotency/Request, source evidence, Assignment,
target, review, reservation, Audit/Outbox, commit.

## P2-N1–P2-N24 integrated negative matrix

| Case | P2D result |
|---|---|
| P2-N1 shared phone auto-reuse | NO; no accepted phone identity/reuse evidence. |
| P2-N2 shared email auto-reuse | NO; no accepted email identity/reuse evidence. |
| P2-N3 name-only reuse | NO; `INSUFFICIENT_IDENTITY_EVIDENCE`. |
| P2-N4 birth-only/year-only/strong name-birth auto-reuse | NO; insufficient evidence or review-only probable match. |
| P2-N5 direct `NO_MATCH` create | NO; P2B returns no create authority and direct reservation without reviewed state fails. |
| P2-N6 insufficient evidence becomes `NO_MATCH` | NO; exact insufficient result preserved. |
| P2-N7 outage becomes `NO_MATCH` | NO; outage matrix remained unavailable/stale. |
| P2-N8 foreign candidate/existence leak | NO; exact-center indistinguishable denial. |
| P2-N9 stale review reuse | NO; revalidation failed closed. |
| P2-N10 stale target reuse | NO; `TARGET_VERSION_STALE`. |
| P2-N11 stale normalizer | NO authority; `NORMALIZER_STALE`. |
| P2-N12 stale policy/source | NO authority; exact policy/source stale results. |
| P2-N13 raw PII mutex | NO; mutex keys remain fixed 32-byte protected digests. |
| P2-N14 unsorted mutex acquisition | NO; runtime locks the deduplicated byte-sorted key set. |
| P2-N15 unique constraint replaces mutex | NO; constraints remain backstops after explicit locks. |
| P2-N16 reservation before authoritative recheck | NO; adapter outage after reviewed state produced no reservation. |
| P2-N17 reservation grants profile/conversion authority | NO; all four authority flags remained false. |
| P2-N18 target rebind | NO; immutable binding guard rejected it. |
| P2-N19 Request rebind | NO; immutable/exact-center binding rejected it. |
| P2-N20 expired reservation accepted or consumed | NO; server expiry was terminal and no consume surface exists. |
| P2-N21 terminal review rewrite | NO; immutable lifecycle guard rejected reopening. |
| P2-N22 idempotency overwrite | NO; changed intent returned conflict and retained the prior result. |
| P2-N23 raw candidate data or partial Audit/Outbox | NO; payload scan and injected rollback checks passed. |
| P2-N24 P2 completes Request | NO; no Request reached approved, executing, or completed. |

## Integrated local verification

```text
P2D_QA_LOCAL_SAFETY_GUARD: PASS
P2D_QA_LOCAL_SQL_APPLY: PASS

P2D_QA_STRONG_DUPLICATE_REVIEW_ONLY: PASS
P2D_QA_NO_MATCH_TO_ACTIVE_RESERVATION_CHAIN: PASS
P2D_QA_P2_NEVER_GRANTS_CONVERSION_AUTHORITY: PASS
P2D_QA_RESERVATION_CONSUME_BLOCKED_UNTIL_P3: PASS

P2D_QA_INTEGRATED_IDEMPOTENCY: PASS
P2D_QA_INTEGRATED_AUDIT_OUTBOX: PASS

P2D_QA_SEARCH_FAILURE_NEVER_BECOMES_NO_MATCH: PASS
P2D_QA_EXACT_CENTER_NON_DISCLOSURE: PASS
P2D_QA_MULTI_ACCOUNT_SCOPE: PASS

P2D_QA_REAL_LOCK_WAIT_OBSERVED: PASS
P2D_QA_CANONICAL_LOCK_ORDER: PASS

P2D_QA_RACE_MATRIX_16: PASS
P2D_QA_NEGATIVE_MATRIX_24: PASS

P2D_QA_FAULT_ROLLBACK: PASS
P2D_QA_DIRECT_API_FAIL_CLOSED: PASS

P2D_QA_FINAL_LOCAL_RESET: PASS
P2D_QA_LEFTOVER_FIXTURE_COUNT: 0
P2D_QA_NONDEFAULT_ROOT_COUNT: 0
P2D_QA_TEMP_HELPER_COUNT: 0
P2D_QA_VAULT_SECRET_COUNT: 0
```

The guarded Node-built-ins-only runner requires
`ICHESS_P2D_LOCAL_QA_ALLOW_RESET=YES`, discovers local endpoints only through
`npx --no-install supabase status -o json`, requires loopback URLs and the exact
`supabase_db_ichess-center-os` container, rejects linked/remote context, uses
only generated synthetic fixtures and an ephemeral local digest key, and
always performs a final reset in `finally`. Final reset verified the five
P1A–P1E migrations plus exactly one P2A, P2B, and P2C migration; zero P2D
fixture, review, reservation, identity Audit, identity Outbox, identity
idempotency, nondefault root, temporary helper, and synthetic Vault-secret
state remained.

External technical audit: PASS. The external review confirmed strong-duplicate
review-only behavior; the complete `NO_MATCH` to review to `ACTIVE`
reservation chain without conversion-authority escalation; integrated
idempotency and transactional Audit/Outbox; search-outage fail-closed behavior;
exact-center non-disclosure and multi-account scope; real PostgreSQL lock
waits; all 16 race and 24 negative dispositions; fault rollback; direct-API
fail-closed behavior; and the clean final reset. No P2A/P2B/P2C runtime defect
or additional hardening was identified. The seven P3 prerequisites remain
real P3 blockers, not P2 failures.
