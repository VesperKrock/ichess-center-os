F23_3E_P2B_STATUS: IMPLEMENTED IN REPO
F23_3E_P2B_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P2B_MIGRATION_CREATED: YES
F23_3E_P2B_LOCAL_SQL_APPLY: PASS
F23_3E_P2B_LOCAL_DB_QA: PASS

F23_3E_P2B_VERSIONED_NORMALIZATION_RUNTIME: IMPLEMENTED
F23_3E_P2B_MASKED_CANDIDATE_SEARCH_RUNTIME: IMPLEMENTED

F23_3E_P2C_RUNTIME_IMPLEMENTATION: NOT STARTED
F23_3E_P3_RUNTIME_IMPLEMENTATION: NOT STARTED

F23_3E_P2B_REMOTE_APPLY: NOT RUN
F23_3E_P2B_AUTH_CHANGE: NO
F23_3E_P2B_EDGE_FUNCTION_CHANGE: NO
F23_3E_P2B_DEPLOY: NOT RUN
F23_3E_P2B_BROWSER_UI_WIRING: NOT STARTED
F23_3E_REAL_CONVERSION_IMPLEMENTED: NO

P2B_GUARDIAN_TARGET_SEARCH: BLOCKED_ADAPTER_ABSENT
P2B_CURRENT_STUDENT_WRITERS_PARTICIPATE_IN_IDENTITY_MUTEX: NO
P2B_NO_MATCH_IS_PROFILE_CREATE_AUTHORITY: NO
P3_CREATE_NEW_REMAINS_BLOCKED_UNTIL_CANONICAL_TARGET_WRITE_PROTOCOL: YES

P2B_FINAL_F23_13D_CAPABILITY_RESOLVER_IMPLEMENTED: NO
P2B_CALLER_CONTROLS_SEARCH_CENTER: NO
PARTIAL_BIRTH_EVIDENCE_EQUALS_EXACT_BIRTH_MATCH: NO
NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO
NAME_ONLY_MATCH_MAY_AUTHORIZE_CREATE: NO
BIRTH_ONLY_MATCH_MAY_REUSE_PROFILE: NO
NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: NO

P2B_CREATES_MATCH_REVIEW: NO
P2B_DECIDES_MATCH_REVIEW: NO
P2B_CREATES_RESERVATION: NO
P2B_CREATES_PROFILE: NO
P2B_REUSES_PROFILE: NO
P2B_APPROVES_CONVERSION: NO
P2B_COMPLETES_REQUEST: NO

# F23.3E-P2B — Versioned normalization and exact-center masked candidate search

## External technical audit closeout

External technical audit: PASS. The audit verified the existing Vault/HMAC
protected-key facility with no committed or caller-supplied secret; versioned,
Vietnamese-diacritic-preserving Student name/birth normalization; opaque HMAC
evidence and sorted mutex material; exact-center Student detection with Guardian
fail-closed; service-role-only RPCs; the name-plus-birth strong duplicate review
signal; `NO_MATCH` remaining non-authoritative; masked `NO_STORE` projections;
cross-center and multi-account scope; stale policy/normalizer/source handling;
PostgREST access denial; adapter completeness failures; real lock-wait concurrency;
source-update and policy-rollout races; fault injection; and the
clean final reset. No P2B-scope blocker remains.

## 1. Baseline and approved boundary

Implementation started from clean `main` checkpoint `9784c3c`. It adds exactly
one forward migration, this report, one semantic smoke, and one guarded local DB
QA runner. The migration creates functions only. It creates no table, broad
Student endpoint, RLS policy, realtime publication, review, reservation,
Guardian/Student profile, relationship, approval, executor, or browser grant.

Migration:

```text
supabase/migrations/202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql
SHA-256: F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B
```

The frozen P2A SHA-256 remains
`55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773`.
The 11 earlier migration hashes remain unchanged.

## 2. Mandatory preflight disposition

### Protected keyed-digest facility — PASS

Local catalog inspection proved the existing Supabase stack already supplies
`supabase_vault`, `vault.decrypted_secrets`, `pgcrypto`, and
`extensions.hmac(bytea,bytea,text)`. `vault` is not an exposed PostgREST schema;
anon/authenticated have no schema/table read authority. P2B therefore did not
invent a secret table or secret-management architecture.

The migration contains only the deterministic, non-secret label
`f23_3e_p2b_identity_digest_epoch_<epoch>`. The protected helper requires
exactly one 32-byte hex secret at that label and fails
`MATCH_SEARCH_UNAVAILABLE` if it is missing, duplicated, or malformed. The key
is never caller-supplied or returned. Local QA creates a random ephemeral value
with `extensions.gen_random_bytes(32)` and final reset removes it. No production
secret was invented or provisioned and no remote Vault action ran.

### Student protected adapter — PASS, detection-only

Repo truth provides exact `center_id`, deterministic `entity_type='student'`,
opaque `center_cloud_entities.id`, server `updated_at`, `source_version`, and
stable row ordering. P2B adds a narrow internal, read-only adapter over this
source. It validates every live exact-center Student row against
`source_module='localStorage'`, `source_version='c2-online-core-v1'`, opaque
payload ID binding, typed `fullName`, exact ISO `birthDate`, and optional Boolean
deletion state. Unknown/malformed/locked-incomplete input fails the whole scan
as `MATCH_SEARCH_UNAVAILABLE`; it is never skipped into `NO_MATCH`.

Raw generic payload exists only inside the protected function. It is HMAC-bound
into an adapter snapshot before masking and never serialized. The migration
does not change existing generic table privileges. Because current browser/cloud
Student writers do not acquire the P2 mutex, this adapter detects existing
duplicates but cannot prove serialization with those writers and cannot create,
reuse, or reserve a profile.

Guardian remains unavailable. CRM Contact is source evidence and is never
recast as a canonical Guardian target.

## 3. Frozen V1 normalization and digest contract

The current policy tuple is:

```text
normalization_algorithm = p2b.student_identity.nfc_casefold_v1
normalization_version = 1
match_policy_version = 1
minimum_evidence_policy_version = 1
target_adapter_version = 1
candidate_projection_version = 1
digest_schema_version = 1
mutex_schema_version = 1
```

`STUDENT_DISPLAY_NAME` V1 applies Unicode NFC, canonicalizes audited apostrophe
and dash variants, trims outer whitespace, collapses repeated Unicode
whitespace, removes whitespace adjacent to apostrophe/hyphen, and applies the
database Unicode lowercase operation. Vietnamese diacritics remain significant.
Control characters, empty output, normalized length above 240, or excessive
input fail closed.

`STUDENT_BIRTH_DATE` accepts PostgreSQL `date`, preserves exact
`YYYY-MM-DD`, and permits only `1900-01-01` through server `current_date`.
Missing/year-only evidence stays partial and yields
`INSUFFICIENT_IDENTITY_EVIDENCE`; it is never coerced to an exact date.

Every evidence digest is HMAC-SHA-256 over a canonical JSON envelope containing
digest schema, algorithm/version, identity kind, evidence kind, canonical
normalized bytes, and key epoch. Domain separation prevents an equal canonical
string from colliding across evidence kind, identity kind, or version.
Environment fingerprint and mutex keys are independently HMAC-derived. Raw
normalized values, raw evidence digests, mutex keys, and key bytes never enter a
response, Audit/Outbox event, review, or reservation.

## 4. Locking, authorization, and drift

Both externally owned RPCs derive center from the Request and follow:

```text
CENTER_CRM_CONTROL_ROW
→ CURRENT IDENTITY POLICY
→ DEDUPLICATED BYTE-SORTED IDENTITY MUTEX ROWS
→ REQUEST
→ CONTACT / CASE / CANDIDATE SOURCE
→ ASSIGNMENT
→ EXACT-CENTER STUDENT ROWS ORDERED BY UUID
→ MASKED RESULT
```

Mutex rows are ensured/touched against the exact P2A policy binding, sorted by
byte value, locked with `FOR UPDATE`, and rechecked before target scanning. The
center root requires `ACTIVE + ENABLED`. Policy/normalizer/adapter versions,
Request and source versions, policy registry version, target version, and
adapter completeness are checked without silent refresh.

Interim eligibility is server-derived from current repo truth: active Owner or
`center_admin` membership may search the exact center; an active Consultant may
search only the Request's exact active Assignment. Unassigned, inactive, and
foreign-center attribution gets the same `RESOURCE_NOT_AVAILABLE` response.
`p_actor_user_id` is protected-service attribution plus this interim check; it
does not claim the future F23.13D capability resolver.

Finite drift outcomes include `NORMALIZER_STALE`, `MATCH_POLICY_STALE`,
`SOURCE_VERSION_STALE`, `TARGET_VERSION_STALE`, and
`MATCH_SEARCH_UNAVAILABLE`. Root, source, policy, mutex, and adapter lock
timeouts fail closed.

## 5. Protected RPC inventory

Externally owned functions:

```text
public.f23_3e_p2b_search_masked_candidates
public.f23_3e_p2b_get_masked_candidate_review_detail
```

Both are `SECURITY DEFINER` with fixed empty `search_path`. Execute is revoked
from PUBLIC, anon, and authenticated and granted only to `service_role`. Every
normalizer, key, digest, mutex, masking, adapter, and orchestration helper is
named `f23_3e_p2b_internal_*`; direct execute is revoked from PUBLIC, anon,
authenticated, and service_role.

The operations use explicit typed parameters rather than arbitrary identity
JSON: Request/actor/source IDs and expected versions, identity kind, display
name, typed date/year evidence, expected policy versions, and expected adapter
version. Detail additionally requires the opaque candidate UUID and expected
target version.

## 6. Search behavior and projection

Exact same-center normalized full name plus exact protected full birth date
produces:

```text
outcome_code = MATCH_REVIEW_REQUIRED
match_outcome = PROBABLE_MATCH
safe_reason_code = NAME_AND_BIRTH_EXACT_CANDIDATE
```

One or several candidates never become `EXACT_REVIEWED_MATCH`; there is no best
candidate auto-selection. Same name with different birth evidence follows the
nonterminal `CONFLICT`/`CONTRADICTORY_EVIDENCE` review path. Name-only,
birth-only, missing date, and year-only evidence are insufficient.

`NO_MATCH` is returned only after an exact-center, version-current, complete
Student adapter scan and mutex/source recheck. The result explicitly contains
`create_authority=false`, `reuse_eligible=false`, and
`REVIEW_STILL_REQUIRED_BEFORE_CREATE`. It creates no P2A review or reservation.

The projection is capped at ten and exposes only opaque row UUIDs, a protected
snapshot-derived positive target version/reference, fixed masked/safe category
codes, evidence/reason codes, policy versions, opaque evidence/mutex/projection
references, server expiry, and `projection_cache_policy=NO_STORE`. It contains
no target name, phone, email, full birth date, Contact ciphertext/digest,
Student payload, normalized value, HMAC digest, mutex key, or secret. The RPC
also sets the local PostgREST `Cache-Control: no-store` response header.

Search snapshots use server time with a fixed five-minute TTL and bind Request,
Contact, Case, source Candidate, Assignment, policy registry, normalizer,
match/minimum-evidence policy, adapter snapshot, evidence set, mutex set,
projection, and expiry. P2C must recheck all bindings; P2B writes no review.

## 7. Local QA evidence

The guarded runner accepts no arguments, requires
`ICHESS_P2B_LOCAL_QA_ALLOW_RESET=YES`, discovers only through
`npx --no-install supabase status -o json`, verifies loopback and the exact local
Docker project/container, and final-resets in `finally`.

It passed real catalog, privilege, normalization golden-vector, keyed-digest
domain separation, exact-center, multiple candidate, contradiction,
insufficient evidence, complete no-match, Guardian outage, multi-account,
foreign-center, stale-version, masked serialization, PostgREST no-store,
adapter drift/timeout, mutex retirement, source-update race, policy-rollout
race, and two-connection lock liveness checks. Lock waits were observed through
`pg_stat_activity` and `pg_blocking_pids`, not inferred from sleep alone.

```text
P2B_QA_LOCAL_SAFETY_GUARD: PASS
P2B_QA_LOCAL_SQL_APPLY: PASS

P2B_QA_PROTECTED_DIGEST_KEY_SOURCE: PASS
P2B_QA_RAW_NORMALIZED_VALUE_NOT_PERSISTED: PASS

P2B_QA_VERSIONED_NAME_NORMALIZATION: PASS
P2B_QA_VERSIONED_BIRTH_NORMALIZATION: PASS
P2B_QA_DIGEST_DOMAIN_SEPARATION: PASS

P2B_QA_SORTED_MUTEX_LOCKING: PASS

P2B_QA_STUDENT_ADAPTER_EXACT_CENTER: PASS
P2B_QA_STUDENT_ADAPTER_MASKED_ONLY: PASS
P2B_QA_ADAPTER_COMPLETENESS_FAIL_CLOSED: PASS

P2B_QA_NAME_BIRTH_STRONG_DUPLICATE_REVIEW: PASS
P2B_QA_NAME_ONLY_NOT_IDENTITY: PASS
P2B_QA_BIRTH_ONLY_NOT_IDENTITY: PASS

P2B_QA_MULTI_CANDIDATE_REVIEW_REQUIRED: PASS
P2B_QA_COMPLETE_NO_MATCH: PASS
P2B_QA_NO_MATCH_NOT_CREATE_AUTHORITY: PASS

P2B_QA_CROSS_CENTER_NON_DISCLOSURE: PASS
P2B_QA_MULTI_ACCOUNT_SCOPE: PASS

P2B_QA_NORMALIZER_STALE: PASS
P2B_QA_POLICY_STALE: PASS
P2B_QA_SOURCE_STALE: PASS

P2B_QA_DIRECT_RPC_ACCESS_FAIL_CLOSED: PASS
P2B_QA_NO_RAW_PII_SERIALIZATION: PASS
P2B_QA_NO_STORE_PROJECTION: PASS

P2B_QA_MUTEX_CONCURRENCY_LIVENESS: PASS
P2B_QA_FAULT_INJECTION_FAIL_CLOSED: PASS

P2B_QA_FINAL_LOCAL_RESET: PASS
P2B_QA_LEFTOVER_FIXTURE_COUNT: 0
P2B_QA_NONDEFAULT_ROOT_COUNT: 0
P2B_QA_TEMP_HELPER_COUNT: 0
```

## 8. Explicit non-claims

No remote apply, Auth mutation, Edge Function, deploy, browser/UI wiring,
LocalStorage import, real-data mutation, network delivery, final capability
enforcement, P2C review/reservation mutation, P3 approval/executor, profile
creation/reuse, relationship creation, or real conversion was run or
implemented. P2B is ready only for external technical audit of the in-repo
backend/local implementation.
