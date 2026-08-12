# F23.3E-P3C - Canonical Student, Guardian, Binding and Relationship Runtime

F23_3E_P3C_STATUS: IMPLEMENTED IN REPO

F23_3E_P3C_FINAL_TECHNICAL_AUDIT: PASS

F23_3E_P3C_MIGRATION_CREATED: YES

F23_3E_P3C_LOCAL_SQL_APPLY: PASS

F23_3E_P3C_LOCAL_DB_QA: PASS

P3C_STUDENT_CANONICAL_RUNTIME: IMPLEMENTED

P3C_GUARDIAN_CANONICAL_RUNTIME: IMPLEMENTED

P3C_IDENTITY_TARGET_BINDING_RUNTIME: IMPLEMENTED

P3C_GUARDIAN_STUDENT_RELATIONSHIP_RUNTIME: IMPLEMENTED

P3C_CANONICAL_SEARCH_ADAPTERS: IMPLEMENTED

P3C_REVIEW_RESERVATION_CANONICAL_DISPATCH: IMPLEMENTED

P3C_CRYPTO_SOURCE_ENVELOPE_RUNTIME: IMPLEMENTED

P3C_GUARDIAN_REPROTECTION_RUNTIME: IMPLEMENTED

P3C_REVIEWED_ACTION_PLAN_MATERIALIZATION: IMPLEMENTED

P3C_REVIEWED_ACTION_PLAN_FINALIZATION: IMPLEMENTED

P3C_INTERNAL_TARGET_WRITERS: IMPLEMENTED

P3C_PRODUCTION_IDENTITY_BINDING_CREATE_RPC: NONE

P3C_PRODUCT_CANONICAL_CONTACT_INGRESS: DEFERRED

P3C_AUTHORITY_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D

P3C_RESERVATION_CONSUME_RUNTIME: NOT IMPLEMENTED — P3D

P3C_REAL_CONVERSION_EXECUTOR: NOT IMPLEMENTED — P3D

F23_3E_REAL_CONVERSION_IMPLEMENTED: NO

F23_3E_P3C_REMOTE_APPLY: NOT RUN

F23_3E_P3C_AUTH_CHANGE: NO

F23_3E_P3C_EDGE_FUNCTION_CHANGE: NO

F23_3E_P3C_DEPLOY: NOT RUN

F23_3E_P3C_BROWSER_UI_WIRING: NOT STARTED

P3C_CANONICAL_TARGET_FOUNDATION_READY_FOR_P3D: YES

P3C_REAL_CONVERSION_EXECUTION_READY: NO

The implementation evidence below records the final-audited package bytes.
External technical audit closeout on 2026-08-12: PASS.

## Checkpoint and scope

P3C resumes from clean `main` checkpoint
`ffcb0c199d5c144be61e1e842d1d80a3a80c7760`. P3C0 has final technical
audit PASS and is the normative crypto addendum. Its resolution of
`P3C_GUARDIAN_SOURCE_EVIDENCE_CRYPTO_BRIDGE` is closed and overrides any
older, conflicting crypto wording in the original P3C prompt.

This phase owns exactly four artifacts:

1. `supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql`
2. `docs/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime.md`
3. `tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-smoke.js`
4. `tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-local-db-qa.js`

```text
P3C_FORWARD_MIGRATION_COUNT: 1
P3C_BUSINESS_AGGREGATE_COUNT: 4
P3C_EXTERNAL_SERVICE_RPC_COUNT: 2
P3C_CHECKPOINT_MIGRATION_HASH_COUNT: 15
P3C_MIGRATION_SHA256: 70b3fa5416d2b045ebb615032a3708302871149b86df171b633f3429b18b206a
SHA-256: 70b3fa5416d2b045ebb615032a3708302871149b86df171b633f3429b18b206a
```

The 15 inherited migration bytes remain immutable. The P3C smoke locks each
inherited SHA-256 plus the exact P3C migration SHA without freezing the total
future repository migration inventory.

P3C changes no `src/`, Roadmap, Docker configuration, Edge Function, Auth
provider, remote Supabase project, deployment, import, UI, or real data. It
does not create a P3D executor and does not complete a Request or Case.

## Physical inventory and ownership

The one forward migration creates exactly these protected canonical business
aggregates:

| Aggregate | Canonical identity | Purpose | Direct application access |
|---|---|---|---|
| `student_profile` | `(center_id, student_id)` | Canonical Student identity profile, separate from enrollment | None |
| `guardian_profile` | `(center_id, guardian_id)` | Canonical Guardian identity with target-domain protected contact evidence | None |
| `crm_identity_target_binding` | `identity_target_binding_id` plus exact-center typed endpoints | Committed source-to-canonical-target reuse authority | None |
| `guardian_student_relationship` | `(center_id, relationship_id)` with exact-center Guardian and Student endpoints | Canonical M:N business relationship | None |

No fifth business aggregate, generic cloud authority, standalone result table,
plaintext staging table, secret registry, or second idempotency registry is
introduced. Narrow extensions to inherited policy/adapter/result constraints
exist only where the frozen P3C contract requires them.

The migration forward-replaces only the necessary internal P2B/P2C dispatch
and completes the existing P3B typed action target backstops. All external
P1D, P2B, P2C, and P3B signatures and grants remain unchanged.

## `student_profile`

The canonical Student aggregate retains the P3A shape:

| Field group | Frozen fields |
|---|---|
| Identity | `student_id uuid`, `center_id text`, nullable `legacy_local_id text` |
| Display and protected evidence | `display_name text`, `birth_evidence_protected bytea`, `name_lookup_digest bytea`, `birth_lookup_digest bytea`, `identity_evidence_digest bytea` |
| Policy binding | `identity_policy_registry_id uuid`, `normalization_version integer`, `match_policy_version integer`, `minimum_evidence_policy_version integer` |
| Lifecycle | `profile_status`, nullable `learning_lifecycle_status`, `student_version integer`, nullable `archived_at` |
| Provenance | `created_from_case_id`, `created_from_candidate_id`, `created_from_request_id`, `created_from_action_id`, `created_by_user_id`, `created_at`, `updated_at` |

The Student primary key is `student_id`; exact-center references use
`(center_id, student_id)`. A conversion-created Student has exactly:

```text
student_id = reservation.preallocated_target_id
profile_status = ACTIVE
learning_lifecycle_status = NULL
student_version = 1
```

No executor-time UUID is generated. An active identity profile is not an
enrolled learner. P3C does not mutate enrollment, class, schedule, attendance,
tuition, or learning lifecycle state.

`legacy_local_id` remains nullable. P3C does not import or silently re-key
legacy Students. A future reviewed import may populate it under an exact-center
unique backstop, but generic `center_cloud_entities` rows are never promoted by
P3C.

Same normalized name and birth evidence is a duplicate signal, not identity
authority. `student_profile_identity_detection_idx` is non-unique. There is no
unique constraint over name, birth, or their combination.

```text
SAME_NAME_BIRTH_CAN_BE_DIFFERENT_PEOPLE: YES
NAME_BIRTH_UNIQUE_CONSTRAINT: NO
```

Identity, center, creation provenance, and frozen policy binding are immutable.
Allowed semantic updates require exact `student_version + 1`; archive metadata
is server-controlled, and P3C exposes no generic Student update RPC.

## `guardian_profile`

The canonical Guardian aggregate retains the P3A shape:

| Field group | Frozen fields |
|---|---|
| Identity | `guardian_id uuid`, `center_id text`, `display_name text` |
| Protected evidence | `protected_contact_methods_ciphertext bytea`, `contact_methods_crypto_version integer`, `normalized_lookup_digests bytea[]`, `identity_evidence_digest bytea`, `normalization_version integer` |
| Lifecycle | `guardian_status`, `guardian_version integer`, nullable `archived_at` |
| Provenance | `created_from_contact_id`, `created_from_case_id`, `created_from_request_id`, `created_from_action_id`, `created_by_user_id`, `created_at`, `updated_at` |

Guardian is a canonical profile, not a CRM Contact, Auth account, or center
membership:

```text
CRM Contact != Guardian profile
Guardian profile != auth.users
Guardian profile != center_members
```

P3C creates no account, login, password, MFA factor, or membership. Contact
remains source evidence and provenance. Guardian contact evidence is produced
only by authenticated source unwrap followed by Guardian target re-protection;
Contact ciphertext is never copied into `guardian_profile`.

Canonical Guardian search may use protected display-name evidence, normalized
contact lookup digests, and committed source binding. Name, phone, email, any
combination of those fields, or operator confirmation alone is never reuse
authority.

## `crm_identity_target_binding`

The protected binding shape is:

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

Typed endpoint shape is exact:

| Kind | Required source | Required target | Required nulls |
|---|---|---|---|
| `STUDENT` | `source_candidate_student_id` | `student_id` | `source_contact_id`, `guardian_id` |
| `GUARDIAN` | `source_contact_id` | `guardian_id` | `source_candidate_student_id`, `student_id` |

All endpoints are exact-center and are rejected by FK/check backstops if they
cross centers. P3C exposes no application or service RPC that creates the first
production ACTIVE binding. That first committed binding belongs to the future
P3D conversion transaction. P3C QA may seed a synthetic ACTIVE binding only as
local `postgres` to prove adapter behavior.

Canonical reuse requires every one of these current facts:

```text
EXACT_REVIEWED_MATCH
current exact-center canonical target and exact target version
current ACTIVE committed source-target binding
current binding source version
current binding target version
current canonical adapter and policy
required deduplicated byte-sorted identity mutexes locked
```

Without an ACTIVE current binding, `reuse_eligible=false`. Legacy
`center_cloud_entities` candidates always have `reuse_eligible=false`, even
when their masked evidence participates in duplicate review.

## `guardian_student_relationship`

The canonical exact-center M:N relationship shape is:

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

Both endpoint FKs include `center_id`. ACTIVE requires `effective_to IS NULL`;
ENDED and ARCHIVED require a terminal timestamp. No silent terminal-to-ACTIVE
transition is permitted, and every allowed semantic transition increments
`relationship_version` exactly once.

Partial unique backstops enforce:

- no duplicate ACTIVE-equivalent `(center_id, guardian_id, student_id, relationship_type)`;
- at most one ACTIVE primary Guardian per `(center_id, student_id)`.

Relationship roles are business metadata and grant no Auth, membership,
financial-system, or Student-data authorization.

The finite relationship action catalog remains:

```text
CREATE_RELATIONSHIP
REUSE_EXISTING_RELATIONSHIP
UPDATE_APPROVED_RELATIONSHIP_ROLE
REQUIRE_RELATIONSHIP_REVIEW
DO_NOT_CREATE_RELATIONSHIP
```

An omitted relationship action is not consent. `DO_NOT_CREATE_RELATIONSHIP`
requires a reviewed finite `safe_reason_code`, complete Student/Guardian
endpoint decision, and current `relationship_policy_version`. Otherwise the
operation fails closed as `RELATIONSHIP_DECISION_REQUIRED`.

## P3C0 normative crypto contract

P3C implements P3C0 without changing its algorithm, envelope, versions, key
slots, or AAD serialization.

```text
P3C0_ALGORITHM: SUPABASE_VAULT_0_3_1_CRYPTO_AEAD_DET_XCHACHA20
P3C0_AEAD_DERIVED_KEY_BYTES: 32
P3C0_AEAD_NONCE_BYTES: 16
P3C0_AEAD_AUTHENTICATOR_BYTES: 32
P3C0_AEAD_AAD_SUPPORTED: YES
```

The required local physical primitive is exactly `supabase_vault 0.3.1`:

```text
vault._crypto_aead_det_encrypt(
  message bytea,
  additional bytea,
  key_id bigint,
  context bytea DEFAULT '\x7067736f6469756d',
  nonce bytea DEFAULT NULL
) RETURNS bytea

vault._crypto_aead_det_decrypt(
  ciphertext bytea,
  additional bytea,
  key_id bigint,
  context bytea DEFAULT '\x7067736f6469756d',
  nonce bytea DEFAULT NULL
) RETURNS bytea

vault._crypto_aead_det_noncegen() RETURNS bytea
```

P3C does not substitute XChaCha20-Poly1305, generic `pgcrypto` encryption,
browser crypto, or another library. Vault derives a 32-byte subkey from the
server root using exact `key_id`, exact eight-byte context, and a 16-byte nonce.
The sealed bytes are encrypted payload followed by the 32-byte synthetic
authenticator. `additional` is authenticated AAD.

The stock local Docker image keeps these raw primitives under
`supabase_admin`. The guarded QA temporarily grants only the migration-function
owner (`postgres`) access to the three exact primitives, never an application
role, and its final database reset proves that temporary ACL bridge returns to
the extension baseline. This is local test orchestration only. Product
canonical ingress, remote Vault provisioning, and deployment remain deferred;
without an environment-owned bridge the protected runtime fails closed.

### Finite key slots and crypto environment

| Purpose | Logical slot | Epoch | `key_id` | Exact eight-byte context |
|---|---|---:|---:|---|
| Contact source | `F23_3E_P3C_CONTACT_SOURCE_PROTECTION` | 1 | 1 | ASCII `iC3Src01` |
| Guardian target | `F23_3E_P3C_GUARDIAN_TARGET_PROTECTION` | 1 | 1 | ASCII `iC3Gdn01` |
| Crypto environment | `F23_3E_P3C_ENVIRONMENT_FINGERPRINT` | 1 | 1 | ASCII `iC3Env01` |

Equal numeric key IDs do not mean key reuse; distinct KDF contexts produce
distinct derived subkeys. A caller cannot add, select, or receive a mapping.
Unknown, missing, retired, duplicate, or contradictory mapping fails closed.

`f23_3e_p3c_internal_crypto_environment_fingerprint` has no caller environment
argument. It returns exactly the SHA-256 digest of:

```text
vault._crypto_aead_det_encrypt(
  UTF8("ichess.p3c.environment.fingerprint.v1"),
  UTF8("ichess.p3c.environment.fingerprint.aad.v1"),
  key_id = 1,
  context = ASCII("iC3Env01"),
  nonce = 16 zero bytes
)
```

It returns only the 32-byte crypto fingerprint, never a root or derived key.

### Three independent environment domains

The physical checkpoint contains three independent domains:

| Semantic name | Provenance | Scope |
|---|---|---|
| `authority_environment_fingerprint` | Caller-supplied opaque 32-byte value accepted and persisted unchanged by the P1/P3B authority/idempotency RPC | Request, idempotency, conversion authority |
| `identity_environment_fingerprint` | P2B identity-key HMAC | Identity policy, evidence digest, mutex |
| `crypto_environment_fingerprint` | P3C deterministic Vault-server-root derivation above | Contact source and Guardian target AEAD |

```text
P3C_CRYPTO_ENVIRONMENT_EQUALS_P3B_AUTHORITY_ENVIRONMENT: NO
P3C_CRYPTO_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT
P3B_AUTHORITY_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT
P3D_COMPARE_P3C_CRYPTO_ENVIRONMENT_TO_P3B_AUTHORITY_ENVIRONMENT: NO
```

No equality comparison is made between any two domains. Coincidentally equal
bytes do not merge their provenance or semantics. P3D must later recheck the
P3B authority environment in the Request/idempotency/authority domain and,
independently, verify P3C crypto environment/AAD. It must never compare the two.

### Exact self-contained envelope V1

Source and target share framing but have distinct magic and cryptographic
domains. All integers are unsigned big-endian:

| Byte range | Length | Field | Exact rule |
|---|---:|---|---|
| `0..7` | 8 | Magic | Source `IC3CSE01`; Guardian target `IC3GTE01` |
| `8` | 1 | Envelope format | `1` |
| `9` | 1 | Payload schema | `1` |
| `10..13` | 4 | Key epoch | Registered positive epoch; current `1` |
| `14..15` | 2 | Nonce length | `16` |
| `16..31` | 16 | Nonce | Exact Vault noncegen output on normal writes |
| `32..35` | 4 | Sealed length `N` | `N >= 32` |
| `36..(35+N)` | `N` | Sealed payload | Vault ciphertext plus 32-byte authenticator |

The parser requires `octet_length(envelope) = 36 + N`. It rejects wrong magic,
wrong format/schema, unregistered epoch, wrong nonce length, short sealed data,
truncation, and trailing bytes. The non-empty opaque source payload is bounded
at 65,536 bytes and is never parsed or returned.

Supported lifecycles are finite:

| Object | Version | Lifecycle |
|---|---:|---|
| Contact source | `2` | current supported read/write canonical envelope |
| Contact source | every value other than `2` | retired/unknown fail closed without decrypt attempt |
| Guardian target | `1` | current supported read/write target envelope |
| Guardian target | every value other than `1` | retired/unknown fail closed |

An integer value alone never establishes canonicality. Exact parsing and
authentication are mandatory.

### Exact LP32 AAD

`U8(n)` is one unsigned byte, `U32(n)` is four unsigned big-endian bytes,
`LP32(b) = U32(octet_length(b)) || b`, and UUID bytes are `uuid_send(uuid)`.

Source AAD V1 is exactly:

```text
LP32(UTF8("ichess.crm.contact.source-evidence.aead.v1"))
|| U8(1)
|| U8(1)
|| U32(2)
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)
|| LP32(UTF8(center_id))
|| LP32(uuid_send(crm_contact_id))
```

Guardian target AAD V1 is exactly:

```text
LP32(UTF8("ichess.guardian.target.contact-evidence.aead.v1"))
|| U8(1)
|| U8(1)
|| U32(1)
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)
|| LP32(UTF8(center_id))
|| LP32(uuid_send(guardian_id))
```

Neither AAD includes P3B authority environment nor P2B identity environment.
Mutable display/status/timestamp/version-counter/lookup metadata is also
excluded. Distinct domain identifiers, magic, contexts, and object IDs prevent
source/target interchange.

### Protected source ingestion and target re-protection

`f23_3e_p3c_internal_protect_contact_source_evidence` is a protected internal
canonical-ingestion primitive. It accepts trusted payload bytes with locked
`center_id` and Contact ID, derives the current crypto environment and source
slot, builds exact AAD, generates a 16-byte nonce, produces `IC3CSE01`, and
writes source crypto version 2 in the same transaction. It is available only to
local PostgreSQL QA and a future separately audited protected composer. P1D
external signatures retain their legacy opaque semantics.

`f23_3e_p3c_internal_protect_target_evidence` performs this exact protected
sequence in the canonical business lock order:

1. Lock and recheck the exact current Contact and source version.
2. Require source version 2 and exact `IC3CSE01` parse.
3. Derive the P3C crypto environment and source slot/epoch.
4. Build source AAD and authenticate/decrypt through Vault.
5. Hold the opaque payload only in a local protected function variable.
6. Build Guardian AAD using the target Guardian ID.
7. Seal with the Guardian target slot/context and build `IC3GTE01` version 1.
8. Return only protected target bytes and safe target version metadata.

It never copies ciphertext, persists plaintext, uses a plaintext temp table,
emits plaintext in Audit/Outbox/notices/exceptions/logs, or returns plaintext to
an RPC. Legacy version 1, unknown version 999, malformed version 2, unavailable
key/environment, or authentication failure is opaque and fails closed.

```text
P3C_GUARDIAN_SOURCE_CIPHERTEXT_DIRECT_COPY_ALLOWED: NO
P3C_GUARDIAN_TARGET_REPROTECTION_REQUIRED: YES
GUARDIAN_SEARCH_LEGACY_SOURCE_OUTCOME: MATCH_SEARCH_UNAVAILABLE
GUARDIAN_CREATE_LEGACY_SOURCE_OUTCOME: GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE
```

## P2B/P2C canonical forward dispatch

P3C forward-replaces only required internal adapter dispatch. External P2B and
P2C function signatures and grants retain their checkpoint contracts.

Student search combines:

- canonical `student_profile` exact-center candidates eligible for reviewed
  canonical reuse only with a current ACTIVE binding;
- legacy `center_cloud_entities` masked detection candidates that always return
  `reuse_eligible=false`.

Guardian search uses exact-center `guardian_profile` candidates and protected
Guardian evidence. Crypto/key/adapter unavailability returns
`MATCH_SEARCH_UNAVAILABLE`, never `NO_MATCH`. Neither adapter leaks raw names,
contact data, ciphertext, lookup digests, mutex keys, or protected evidence.

P2C dispatch recognizes only the new canonical reservation namespaces:

```text
canonical.student_profile.v1
canonical.guardian_profile.v1
```

The old placeholders `future.student.profile.v1` and
`future.guardian.profile.v1` remain non-executable. They are not upgraded and
their preallocated target UUIDs are not rebound. A new reviewed flow is needed.
P2 remains review/reservation only: it creates no canonical target and consumes
no reservation.

Guardian identity mutex domains are protected fixed-size keyed material:

```text
GUARDIAN_DISPLAY_NAME
GUARDIAN_CONTACT_LOOKUP_DIGEST
GUARDIAN_SOURCE_BINDING
```

`GUARDIAN_SOURCE_BINDING` domain-separates exact identity environment, center,
and Contact ID. It proves source serialization, not person equality. Raw names,
phones, emails, lookup digests, or Contact UUID bytes are not embedded directly
in mutex keys. Each operation derives, deduplicates, byte-sorts, ensures, locks,
and rechecks its mutex set before target currentness/reuse decisions.

## Internal target helpers

The migration implements these protected internal helpers plus only bounded
parser, AAD, key-slot, adapter, serializer, and guard helpers:

```text
f23_3e_p3c_internal_protect_contact_source_evidence
f23_3e_p3c_internal_crypto_environment_fingerprint
f23_3e_p3c_internal_protect_target_evidence
f23_3e_p3c_internal_create_student_target
f23_3e_p3c_internal_resolve_reusable_student
f23_3e_p3c_internal_create_guardian_target
f23_3e_p3c_internal_resolve_reusable_guardian
f23_3e_p3c_internal_upsert_guardian_student_relationship
```

Direct EXECUTE is revoked from `PUBLIC`, `anon`, `authenticated`, and
`service_role`. They have no standalone commit path and are not application
RPCs. P3D may compose them only inside the future atomic conversion executor.

The Student create helper requires current `CREATE_NEW_REVIEWED`, an ACTIVE
`canonical.student_profile.v1` reservation, exact center/source/action/review
and policy versions, and the locked mutex set. It inserts the exact
`reservation.preallocated_target_id`, creates ACTIVE identity with null learning
lifecycle, and does not consume the reservation.

The Guardian create helper requires the equivalent current Guardian review and
`canonical.guardian_profile.v1` reservation, exact Contact and policy evidence,
and Guardian mutex set. It uses the exact preallocated target ID, performs
source unwrap then Guardian re-protection, and creates no Auth or membership.
It does not consume the reservation.

Relationship upsert validates exact-center endpoints, reviewed finite action,
current relationship policy, lifecycle/version, active-equivalent uniqueness,
and the one-active-primary backstop. P3C helper QA may simulate target writes in
guarded local transactions; no helper constitutes a real conversion.

## External RPC boundary

Exactly two P3C functions are external and executable only by `service_role`:

```text
f23_3e_p3c_materialize_reviewed_action_pair
f23_3e_p3c_finalize_reviewed_action_plan
```

Both are `SECURITY DEFINER` with `SET search_path = ''`. EXECUTE is revoked
from `PUBLIC`, `anon`, and `authenticated`. There is no third P3C product RPC,
crypto RPC, target-create RPC, relationship-write RPC, or binding-create RPC.

### Reviewed action-plan materialization

Materialization accepts typed actor, Request/version, optional Guardian and
Student review/version references, preallocated relationship action ID, finite
relationship decision fields, current relationship policy version, operation
intent digest, idempotency key digest, and idempotency expiry. It accepts no
caller center, caller role, action JSON, target-choice JSON, arbitrary target
ID, or MFA boolean.

Eligibility is resolved from current protected state: an active exact-center
owner or center admin, or an active consultant for the exact current
Assignment. Materialization assembles a pre-approval plan and does not require
or consume P3B final step-up/authority.

Identity actions are derived, never caller-selected:

| Reviewed state | Student action | Guardian action |
|---|---|---|
| Current `CREATE_NEW_REVIEWED` plus ACTIVE canonical reservation | `CREATE_NEW_STUDENT` | `CREATE_NEW_GUARDIAN` |
| Current `EXACT_REVIEWED_MATCH` plus current canonical target and ACTIVE committed binding | `REUSE_REVIEWED_STUDENT` | `REUSE_REVIEWED_GUARDIAN` |
| Explicit reviewed finite no-target reason | `DO_NOT_CREATE_STUDENT` | `DO_NOT_CREATE_GUARDIAN` |

Create target IDs equal the reservation's preallocated target and remain bound
in the immutable opaque target field while the target row is intentionally
absent before P3D composition. Their nullable typed mirrors therefore remain
NULL. Reuse target IDs equal the exact current reviewed canonical target and
populate the matching typed mirror. This preserves the frozen P3B physical
foreign-key/immutability contract; in neither branch can the caller select an
alternative target.

Relationship materialization validates the finite reviewed relationship fields
against both endpoint actions, current policy, any existing relationship, and
exact-center endpoints. `relationship_action_id` is only opaque action identity
and grants no relationship target authority.

Materialization persists only PROPOSED actions, initially version 1. It does not
write REVIEWED directly. Once an action is REVIEWED, APPROVED, or EXECUTED, this
RPC cannot rewrite its meaning.

### Materialization idempotency and events

P3C reuses `crm_idempotency_registry`; there is no second registry or generic
result JSON family. The stored safe result is typed and immutable.

Same key plus same semantic intent returns the same three action IDs, versions,
current PROPOSED digest, correlation ID, and `replayed=true`, with no second
mutation or event. Same key with changed semantic intent returns
`IDEMPOTENCY_CONFLICT` and performs no rewrite.

A successful non-replay mutation appends exactly one transactional Audit/Outbox
pair with event `crm.conversion.action_plan_materialized` and one server
correlation ID. Safe payload includes only Request/action identities and
versions, finite relationship decision, policy versions, and correlation. It
contains no PII, protected evidence, digest material, key, nonce, or secret.

### Reviewed action-plan finalization

Finalization accepts only actor, Request ID/version, expected action count,
operation intent digest, idempotency key digest, and idempotency expiry. It does
not accept an action list.

Before mutation it locks and validates the exact complete PROPOSED action set,
active center root, actor eligibility, READY_FOR_REVIEW Request/version, legacy
Request digest binding, action count and endpoint coverage, explicit
relationship decision, current review/reservation/namespace/expiry/target/
binding/source/Assignment/policy evidence, and sorted mutex bindings. It does
not silently refresh stale evidence.

The mandatory lifecycle order is:

```text
lock complete PROPOSED action set
validate all current evidence
PROPOSED -> REVIEWED
action_version +1 for every action
re-read persisted REVIEWED rows
compute f23_3e_p3b_internal_action_set_digest(Request, 'REVIEWED')
persist and return the finalized REVIEWED digest/version/correlation
```

```text
P3C_FINALIZE_DIGEST_COMPUTED_AFTER_REVIEWED_VERSION_INCREMENT: YES
P3C_LEGACY_REQUEST_DIGEST_EQUALS_CANONICAL_ACTION_SET_DIGEST: NO
```

The inherited Request `action_graph_digest` must equal every action's
`legacy_request_action_graph_digest`; it remains independent from the P3 action
set digest.

Exact replay is resolved from the immutable stored finalization result before
the RPC interprets naturally changed live REVIEWED state. It returns the same
digest, versions, correlation, and `replayed=true`; it performs no second
version increment or event.

```text
P3C_FINALIZATION_EXACT_REPLAY_REINTERPRETS_REVIEWED_STATE: NO
```

Successful non-replay finalization appends exactly one Audit/Outbox pair named
`crm.conversion.action_plan_finalized`. Audit, Outbox, action transitions, and
idempotency completion are one transaction. Any event or completion fault
rolls every action back to PROPOSED; a half-REVIEWED plan cannot persist.

Materialize/finalize persist typed plan actions only. They create no Student,
Guardian, binding, or relationship business row and consume neither reservation
nor authority.

### P3B compatibility

All six P3B external RPC signatures/grants remain unchanged. After P3C
finalization, a valid P3B authority issuance observes the complete current
REVIEWED set and independently owns:

```text
REVIEWED -> APPROVED
action_version +1
compute APPROVED action-set digest afterward
issue single-use authority
```

P3C does not change authority status scope, terminal environment binding,
separation of duties, step-up single use, or the absence of authority consume.

## Security and lock ordering

All four P3C tables have RLS ENABLED and FORCED, zero convenience policies,
and all direct privileges revoked from `PUBLIC`, `anon`, `authenticated`, and
`service_role`. None is in Supabase Realtime. Anonymous, authenticated, and
service-role direct PostgREST table access fails closed. Internal functions are
not executable through PostgREST or direct `service_role` SQL.

The canonical lock order is preserved:

```text
CENTER_CRM_CONTROL_ROW
-> SORTED_IDENTITY_MUTEX_ROWS
-> required account/security/membership tiers
-> authority tier only when the operation actually uses authority
-> IDEMPOTENCY_REGISTRY_ROW
-> CONVERSION_REQUEST_ROW
-> CONVERSION_ACTION_ROWS
-> CRM_CONTACT_ROW
-> CONSULTATION_CASE_ROW
-> CANDIDATE_STUDENT_ROWS
-> ASSIGNMENT_ROW
-> EXISTING_TARGET_PROFILE_ROWS
-> MATCH_REVIEW_ROWS
-> PROFILE_CREATION_RESERVATION_ROWS
-> GUARDIAN_STUDENT_RELATIONSHIP_ROWS
-> AUDIT
-> OUTBOX
-> COMMIT
```

P3C plan RPCs do not invent an authority lock because they do not use
authority. Crypto helpers acquire no earlier-tier business lock after a later
tier and perform no network or human wait while database locks are held.

## Guarded local Docker QA matrix

The local runner requires `ICHESS_P3C_LOCAL_QA_ALLOW_RESET=YES`, accepts no
arguments, rejects linked/remote configuration, requires loopback DB/API URLs,
and validates the exact local Docker project/container labels before reset or
mutation. It uses generated synthetic local UUIDs only. No production Auth API,
real account, real Contact payload, real secret, or remote service is used.

The following result cells are draft placeholders and must be replaced with the
captured local result before external audit.

| Gate | Required proof | Result |
|---|---|---|
| Safety | Loopback status, exact Docker project/container, explicit reset consent, no linked mode | `PASS` |
| SQL apply | P3C migration applied exactly once after fresh reset; 15 inherited migrations remain present | `PASS` |
| Vault preflight | `supabase_vault 0.3.1`, exact encrypt/decrypt/nonce signatures, exact three eight-byte KDF contexts | `PASS` |
| Crypto environment | Stable 32-byte server-root-derived P3C fingerprint with no caller input | `PASS` |
| Source envelope | Version 2/`IC3CSE01` opens only under exact environment, center, Contact ID, epoch, context, nonce, AAD, and bytes | `PASS` |
| Source failures | Wrong environment/center/Contact/epoch/context/domain/header/schema/length, tamper, truncation, trailing byte, v1/v999/malformed v2 fail closed | `PASS` |
| Re-protection | Target bytes differ from source; `IC3GTE01` v1 opens only in exact Guardian environment/center/ID/context/AAD | `PASS` |
| Domain separation | Source context cannot open target and Guardian context cannot open source; no cross-fingerprint equality | `PASS` |
| Plaintext privacy | Payload absent from tables, temp tables, RPC results, notices, errors, Audit, Outbox, and captured logs | `PASS` |
| Student schema/create | Exact-center schema, preallocated ID, ACTIVE profile, null learning lifecycle, no reservation consume | `PASS` |
| Student matching | Canonical exact-center search, foreign hidden, legacy detection retained, legacy reuse denied, name+birth non-unique | `PASS` |
| Guardian schema/create | Guardian distinct from Contact/Auth, preallocated ID, authenticated unwrap/re-protect, no account/membership/reservation consume | `PASS` |
| Guardian matching | Exact-center protected search, source-crypto failure unavailable rather than no-match, no raw evidence leakage | `PASS` |
| Binding | Typed exact-center shape; reuse only with exact reviewed match plus current ACTIVE committed binding and versions | `PASS` |
| Relationship | Exact-center M:N, lifecycle/version rules, no active-equivalent duplicate, one active primary, missing decision fail closed | `PASS` |
| Materialize | Create/create/relationship, reuse/reuse/relationship, and explicit reviewed no-target combinations persist PROPOSED only | `PASS` |
| Materialize replay | Same immutable action IDs/versions/digest/correlation, no second mutation/events; changed intent conflicts | `PASS` |
| Materialize stale matrix | Stale Request/review/reservation/target/source/Assignment/policy, expired evidence, bad namespace, absent binding, foreign resource all fail atomically | `PASS` |
| Finalize | Complete PROPOSED set transitions REVIEWED +1 before frozen P3B serializer digest | `PASS` |
| Finalize replay | Immutable result returned before live REVIEWED reinterpretation; no second +1 or events; changed intent conflicts | `PASS` |
| Audit/Outbox | Exactly one safe correlated pair per non-replay mutation; no PII/digest/key/ciphertext/plaintext | `PASS` |
| Fault rollback | Crypto protect/unwrap/reprotect, target/relationship/action insert/finalize, Audit, Outbox, and idempotency completion faults leave no partial state | `PASS` |
| Real concurrency | Independent sessions visibly wait on `wait_event_type='Lock'` with nonempty `pg_blocking_pids` | `PASS` |
| Race matrix | Materialize/materialize, materialize/drift, finalize/finalize, finalize/reservation expiry, finalize/target mutation, search/target mutation, helper/mutex, Guardian/Contact drift | `PASS` |
| API/RLS/grants | Four forced-RLS tables, no policies/publication, direct app-role tables denied, internals denied, exactly two service RPCs | `PASS` |
| P2B/P2C regression | Legacy detection, review-only duplicate, complete NO_MATCH, review/reservation/replay/cross-center, no P2 target/consume | `PASS` |
| P3B regression | Six RPCs unchanged; issuance against finalized REVIEWED plan; APPROVED +1 digest ordering/status/terminal binding unchanged; consume absent | `PASS` |
| Final reset | Auth, Vault, four P3C tables, action/review/reservation/idempotency/Audit/Outbox fixtures, temp helpers, and nondefault roots return to zero | `PASS` |

Real concurrency proof uses independent `psql` connections, transaction holders,
distinct `application_name` values, and direct observation of both
`wait_event_type = 'Lock'` and `pg_blocking_pids(pid)`. Sleep-only timing is not
accepted as proof.

Fault injection is local-superuser orchestration only. Temporary trigger
functions and triggers raise at the selected transactional boundary, are
dropped immediately, and are verified absent. Exact before/after state vectors
prove atomic rollback.

## Final reset and evidence placeholders

Cleanup always runs in `finally` and performs a fresh local database reset.
After reset the P3C migration remains applied, while the required baseline is:

```text
auth.users = 0
vault.secrets = 0
student_profile = 0
guardian_profile = 0
crm_identity_target_binding = 0
guardian_student_relationship = 0
P3C action fixtures = 0
P3C review/reservation fixtures = 0
P3C idempotency fixtures = 0
P3C Audit/Outbox fixtures = 0
temporary QA helpers/triggers = 0
nondefault synthetic CRM roots = 0
```

```text
P3C_LOCAL_DOCKER_QA_RESULT: PASS
P3C_SEMANTIC_SMOKE_RESULT: PASS
P3C_INHERITED_SEMANTIC_REGRESSIONS_RESULT: PASS (8/8)
P3C_NODE_CHECK_RESULT: PASS (10/10)
P3C_15_INHERITED_HASHES_RESULT: PASS (15/15)
P3C_EXACT_MIGRATION_SHA_RESULT: PASS (70b3fa5416d2b045ebb615032a3708302871149b86df171b633f3429b18b206a)
P3C_GIT_DIFF_CHECK_RESULT: PASS
P3C_HYGIENE_RESULT: PASS
```

## P3D and production boundary

P3C is canonical target foundation and reviewed-plan preparation only. It does
not consume a reservation or conversion authority, execute a real conversion,
create a production source-target binding, mark Request/Case complete, mutate
real Auth, or write enrollment/finance/class/attendance state.

P3D must later atomically recheck current Request, approved actions,
reservation, authority, source, target, binding, policy, and crypto state;
compose the protected target helpers; create the first committed production
binding/relationship as approved; consume reservation and authority; and own
execution completion. The P3B authority environment and P3C crypto environment
remain independently verified and are never compared.

Product canonical Contact ingress remains DEFERRED. P3C backend-local QA proves
only the protected database contract using a synthetic canonical source
envelope. It does not prove product ingestion, historical re-encryption, remote
Vault provisioning, deployment, import, UI integration, or real conversion.

The roadmap remains P3C TODO until this implementation receives external final
technical audit and closeout. The pre-audit package for external technical
audit is exactly:

1. `supabase/migrations/202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql`
2. `docs/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime.md`
3. `tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-smoke.js`
4. `tests/f23-3e-p3c-canonical-student-guardian-binding-relationship-runtime-local-db-qa.js`
