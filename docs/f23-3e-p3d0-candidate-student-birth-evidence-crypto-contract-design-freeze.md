# F23.3E-P3D0 - Candidate to Student Birth-Evidence Crypto Contract Design Freeze

```text
F23_3E_P3D0_STATUS: DESIGN COMPLETE IN REPO
P3D0_FINAL_TECHNICAL_AUDIT:
PASS
P3D0_CANDIDATE_BIRTH_CRYPTO_DESIGN: COMPLETE
P3D0_STUDENT_TARGET_BIRTH_CRYPTO_DESIGN: COMPLETE
P3D0_ARTIFACT_COUNT: 2
P3D0_MIGRATION_COUNT: 0
P3D0_LOCAL_DB_QA_RUNNER_COUNT: 0

P3D0_CANDIDATE_SOURCE_ENVELOPE:
FROZEN
P3D0_STUDENT_TARGET_ENVELOPE:
FROZEN
P3D0_PLAINTEXT_PERSISTENCE:
NONE
P3D0_GENERAL_REVEAL_RPC:
NONE
P3D0_P3C_CHECKPOINT_EDIT_REQUIRED:
NO
P3D0_P3D_EXTERNAL_SIGNATURE_CHANGE_REQUIRED:
NO
P3D0_PERSISTED_SCHEMA_EXPANSION_REQUIRED:
NO
P3D0_PRODUCT_INGESTION:
DEFERRED
P3D0_P3D_BACKEND_LOCAL_IMPLEMENTATION:
SAFE_TO_RESUME
P3D0_REAL_PRODUCT_END_TO_END:
NO
```

## Scope and baseline

P3D0 was designed from clean `main` at
`ab60deb9a8603328025787b909a69932cdef1a2a`, aligned with `origin/main`.
The checkpoint subject is `Complete F23.3E P3C canonical target runtime`.
P3B and P3C are final-audited and checkpointed. This phase adds no runtime,
migration, Docker mutation, roadmap state, product ingestion, remote operation,
Auth mutation, Edge function, deployment, commit, or push.

The physical blocker is real but bounded: P1A has a protected Candidate birth
`bytea`, and P3C has a protected Student birth `bytea`, but neither column has
an authenticated Candidate-to-Student birth serialization. P3D needs the
current full date to rederive the frozen P2 identity mutexes and digests, so it
cannot treat an old review result or opaque bytes as current authenticated
evidence.

```text
BLOCKER_CLOSED_BY_THIS_DESIGN:
P3D_CANDIDATE_STUDENT_BIRTH_EVIDENCE_CRYPTO_CONTRACT

P3D_BACKEND_LOCAL_IMPLEMENTATION_GATE:
SAFE_TO_RESUME
```

## Physical inventory

The following checkpoint sources were inspected directly:

- P1A CRM schema/control root.
- P2A identity review, mutex, and reservation foundation.
- P2B versioned normalization and masked candidate search.
- P2C reviewed decision and creation reservation runtime.
- P3B fresh step-up, final capability, and authority runtime.
- P3C canonical target, binding, relationship, and plan runtime.
- P1 planning, final-audited P3A, final-audited P3C0, and final-audited P3C
  reports.

### P1A Candidate source

`public.consultation_case_candidate_student` physically contains:

```text
candidate_student_id uuid
center_id text
consultation_case_id uuid
display_name_evidence text
birth_evidence_protected bytea
candidate_status text
candidate_version integer
```

Its birth constraint permits `NULL` or any nonempty bytes. It has no Candidate
birth crypto version column, envelope registry, magic, epoch, key mapping, AAD,
unwrap operation, or plaintext serializer. The table comment classifies the
row as protected candidate evidence and explicitly not a canonical Student.

```text
P3D0_P1A_CANDIDATE_BIRTH_BYTEA_IS_SELF_DESCRIBING_TODAY:
NO
P3D0_SYNTHETIC_UTF8_BYTEA_IS_PRODUCTION_BIRTH_CRYPTO_CONTRACT:
NO
```

Any local fixture that put UTF-8 `YYYY-MM-DD` directly in this column is only:

```text
LOCAL_SYNTHETIC_FIXTURE_CONVENTION
```

It is not a production protection contract and must fail closed in P3D.

### P2A review and reservation evidence

P2A review rows bind Request/source versions, selected Candidate identity,
aggregate evidence/mutex/projection digests, policy versions, and reviewed
target disposition. P2A reservation rows bind the creation target UUID and the
same currentness families. Neither row persists a raw date or an independently
recoverable authenticated birth payload. Those rows prove an earlier decision;
they cannot supply current birth evidence to the executor.

```text
P3D0_REVIEW_REASON_CODE_REPLACES_CURRENT_BIRTH_EVIDENCE:
NO
P3D0_REVIEW_TIME_TYPED_BIRTH_DATE_IS_EXECUTOR_AUTHORITY:
NO
P3D0_P3D_NEEDS_AUTHENTICATED_SERVER_SIDE_BIRTH_EVIDENCE:
YES
```

### P2B and P2C identity behavior

P2B accepts a PostgreSQL `date`, enforces the current supported date range,
and canonically serializes it as `YYYY-MM-DD`. It derives separate
`STUDENT_DISPLAY_NAME` and `STUDENT_BIRTH_DATE` evidence digests with the
current identity-policy key epoch and derives byte-sorted identity mutex keys
inside the independent P2B identity-environment domain.

P2C likewise accepts typed review-time date evidence and recomputes the current
evidence/mutex binding. Its persisted review and reservation state contains
digests and versions, not recoverable birth plaintext. P3D therefore uses none
of the historical caller input as execution authority; it authenticates the
current Candidate source independently.

### P3B protected execution authority

P3B physically provides the facts needed for a purpose-bound precheck:
account lifecycle and security/session versions, exact-center membership,
single-use step-up assertion, Request/resource/purpose binding, and an ISSUED
conversion authority. The authority environment is a caller-supplied opaque
32-byte P1/P3B binding persisted on the authority. It is not the P3C crypto
environment and is never compared to it.

### P3C Student target and writer

`public.student_profile` physically contains non-null
`birth_evidence_protected bytea`. It has no Student birth crypto-version column
or previously authenticated Student birth envelope contract.

The exact current internal writer signature is:

```text
f23_3e_p3c_internal_create_student_target(
  p_conversion_action_id uuid,
  p_actor_user_id uuid,
  p_display_name_evidence text,
  p_birth_date_evidence date
) -> student_id uuid, student_version integer
```

The writer uses `p_birth_date_evidence` with current policy to derive the
Student birth mutex, `STUDENT_BIRTH_DATE` lookup digest, and combined identity
evidence digest. It then physically stores
`v_candidate.birth_evidence_protected` directly into
`student_profile.birth_evidence_protected`. That copy was safe only as an
unimplemented P3D boundary; it is not a canonical protection bridge.

P3A already requires Student create/reuse to rederive and lock the exact P2B
`STUDENT_DISPLAY_NAME` and `STUDENT_BIRTH_DATE` mutex keys from current source
evidence. P3D must consequently unwrap authenticated current source evidence
inside a protected function scope.

```text
P3D0_EXISTING_CANONICAL_STUDENT_BIRTH_PROTECTION_CONTRACT:
NO
P3D0_CURRENT_P3C_WRITER_DIRECTLY_COPIES_CANDIDATE_BYTES:
YES
P3D0_P3C_WRITER_SIGNATURE_CAN_BE_PRESERVED:
YES
P3C_CHECKPOINT_MIGRATION_EDIT:
NO
```

## Frozen architecture

Both protected envelopes remain within the existing `bytea` columns. Envelope
version, payload schema, epoch, nonce, and sealed length are authenticated and
self-contained. No new business table, column, environment fingerprint,
external system, library, or production secret is required.

```text
SELF_CONTAINED_CANDIDATE_BIRTH_SOURCE_ENVELOPE:
YES
SELF_CONTAINED_STUDENT_BIRTH_TARGET_ENVELOPE:
YES
PERSISTED_SCHEMA_EXPANSION:
NO
CHECKPOINT_MIGRATION_EDIT:
NO
```

### Physical primitive and crypto environment

P3D reuses the exact final-audited P3C0 primitive exposed by Supabase Vault
0.3.1:

```text
vault._crypto_aead_det_encrypt(bytea, bytea, bigint, bytea, bytea)
vault._crypto_aead_det_decrypt(bytea, bytea, bigint, bytea, bytea)
vault._crypto_aead_det_noncegen()
```

The construction is the existing Vault deterministic XChaCha20 AEAD with a
32-byte derived subkey, 16-byte nonce, 32-byte authenticator, and authenticated
additional data. Candidate and Student birth evidence use the already frozen
P3C server-root-derived `crypto_environment_fingerprint` and two new distinct
KDF contexts. They do not create a fourth fingerprint domain.

The three domains remain independent:

| Domain | Provenance | P3D0 use |
|---|---|---|
| `authority_environment_fingerprint` | Caller-supplied opaque P1/P3B authority/idempotency binding | Match only the exact locked authority. |
| `identity_environment_fingerprint` | Server-derived P2B identity digest-key HMAC | Derive current Student evidence digests/mutexes. |
| `crypto_environment_fingerprint` | Server-root-derived P3C crypto environment using `iC3Env01` | Authenticate Candidate and Student birth envelopes. |

```text
P3D0_NEW_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT:
0
P3D0_CANDIDATE_BIRTH_USES_P3C_CRYPTO_ENVIRONMENT:
YES
P3D0_CRYPTO_ENVIRONMENT_EQUALS_AUTHORITY_ENVIRONMENT:
NO_REQUIREMENT
P3D0_CRYPTO_ENVIRONMENT_EQUALS_IDENTITY_ENVIRONMENT:
NO_REQUIREMENT
P3D0_CRYPTO_ENVIRONMENT_USED_AS_IDENTITY_ENVIRONMENT:
NO
P3D0_IDENTITY_ENVIRONMENT_USED_AS_CRYPTO_ENVIRONMENT:
NO
P3D0_AUTHORITY_ENVIRONMENT_USED_AS_CRYPTO_ENVIRONMENT:
NO
```

### Envelope V1 framing

Both domains use the exact P3C0 envelope V1 framing:

| Byte range | Length | Field | Rule |
|---|---:|---|---|
| `0..7` | 8 | magic | Exact domain magic. |
| `8` | 1 | envelope format | Unsigned value `1`. |
| `9` | 1 | payload schema | Unsigned value `1`. |
| `10..13` | 4 | key epoch | Unsigned big-endian; registered epoch `1`. |
| `14..15` | 2 | nonce length | Unsigned big-endian `16`. |
| `16..31` | 16 | nonce | Vault-generated source/target nonce. |
| `32..35` | 4 | sealed length | Unsigned big-endian `N`, with `N >= 32`. |
| `36..` | `N` | sealed payload | Exact bytes; total length must equal `36 + N`. |

The parser rejects unknown magic/epoch/version/schema, wrong nonce length,
sealed payload below the authenticator bound, truncation, overflow, or trailing
bytes before any decrypt attempt.

```text
P3D0_ENVELOPE_FORMAT_VERSION: 1
P3D0_PAYLOAD_SCHEMA_VERSION: 1
```

### Candidate source domain

```text
P3D0_CANDIDATE_BIRTH_SOURCE_MAGIC:
IC3CBE01
P3D0_CANDIDATE_BIRTH_SOURCE_SLOT:
F23_3E_P3D_CANDIDATE_BIRTH_SOURCE_PROTECTION
P3D0_CANDIDATE_BIRTH_SOURCE_KEY_EPOCH: 1
P3D0_CANDIDATE_BIRTH_SOURCE_VAULT_KEY_ID: 1
P3D0_CANDIDATE_BIRTH_SOURCE_KDF_CONTEXT:
iC3Bth01
```

Candidate source AAD V1 uses the frozen P3C0 `U8`, `U32`, `LP32`, PostgreSQL
`uuid_send`, and strict UTF-8 encodings:

```text
LP32(UTF8("ichess.crm.candidate.birth-evidence.aead.v1"))
|| U8(1)
|| U8(1)
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)
|| LP32(UTF8(center_id))
|| LP32(uuid_send(consultation_case_id))
|| LP32(uuid_send(candidate_student_id))
```

```text
P3D0_CANDIDATE_BIRTH_AAD_BINDS_CENTER:
YES
P3D0_CANDIDATE_BIRTH_AAD_BINDS_CASE:
YES
P3D0_CANDIDATE_BIRTH_AAD_BINDS_CANDIDATE:
YES
```

It contains neither authority nor identity fingerprint. Moving ciphertext to
another center, Case, Candidate, crypto root, epoch, or KDF context fails AEAD
authentication.

### Student target domain

```text
P3D0_STUDENT_BIRTH_TARGET_MAGIC:
IC3SBE01
P3D0_STUDENT_BIRTH_TARGET_SLOT:
F23_3E_P3D_STUDENT_BIRTH_TARGET_PROTECTION
P3D0_STUDENT_BIRTH_TARGET_KEY_EPOCH: 1
P3D0_STUDENT_BIRTH_TARGET_VAULT_KEY_ID: 1
P3D0_STUDENT_BIRTH_TARGET_KDF_CONTEXT:
iC3Std01
```

Student target AAD V1 is:

```text
LP32(UTF8("ichess.student.target.birth-evidence.aead.v1"))
|| U8(1)
|| U8(1)
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)
|| LP32(UTF8(center_id))
|| LP32(uuid_send(student_id))
```

```text
P3D0_STUDENT_BIRTH_AAD_BINDS_CENTER:
YES
P3D0_STUDENT_BIRTH_AAD_BINDS_STUDENT:
YES
```

The source and target share neither magic, KDF context, AAD domain string, nor
object binding. Candidate-source bytes cannot authenticate as a Student target,
and Student-target bytes cannot authenticate as a Candidate source.

### Strict payload schema

Payload schema V1 is exactly 10 UTF-8 ASCII bytes representing a full date as
`YYYY-MM-DD`. It is not JSON, a timestamp, locale text, a year, nullable text,
or whitespace-tolerant input.

Protected unwrap must perform all of these checks before returning a local SQL
`date`:

1. Plaintext length is exactly 10 bytes.
2. Every byte is ASCII and the lexical shape is exactly `YYYY-MM-DD`.
3. PostgreSQL strict date parsing accepts the calendar date.
4. Serializing the parsed date back as `YYYY-MM-DD` produces byte-for-byte the
   original payload.
5. The date also satisfies the current P2B Student birth policy when identity
   evidence is derived.

```text
P3D0_CANDIDATE_BIRTH_PLAINTEXT_ENCODING:
STRICT_UTF8_ASCII_YYYY_MM_DD
P3D0_CANDIDATE_BIRTH_PLAINTEXT_LENGTH_BYTES: 10
P3D0_CANONICAL_DATE_ROUND_TRIP_REQUIRED:
YES
```

Invalid calendar dates, noncanonical spelling, null bytes, whitespace,
non-ASCII bytes, and partial dates fail closed.

## Purpose-bound source use

P3D cannot derive the birth mutex without the date, but canonical lock order
places sorted identity mutex rows before account-security and authority rows.
The safe closure is a two-stage protocol. It does not authorize mutation ahead
of locks and does not alter the canonical order.

### Stage A: protected pre-lock selector and precheck

Before source unwrap, a protected internal precheck reads only enough current
state to prove the exact purpose. It must verify:

- exact Request, center, Case, Candidate, and source version;
- exact authority belongs to that Request, has purpose
  `crm.real_conversion.execute`, is `ISSUED`, unexpired, and matches both
  expected versions and the supplied authority-environment binding;
- actor is derived from the authority, never supplied separately;
- current ACTIVE account lifecycle and exact bound security/session versions;
- current exact-center active owner or center-admin membership and its bound
  version;
- the exact consumed step-up exists, was consumed by this authority, and has
  the same purpose/resource/security/session/assurance binding;
- the approved action binds the same Candidate and source version.

Only then may a protected internal bridge authenticate `IC3CBE01`, validate the
strict payload, and hold the SQL date in a local protected variable. Stage A is
read-only and non-authoritative. It emits no mutation, plaintext, generic
service response, log, or event.

```text
P3D0_PRELOCK_PROTECTED_PURPOSE_PRECHECK:
REQUIRED
P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_AUTHORITY_RECHECK:
NO
P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_SECURITY_RECHECK:
NO
P3D0_PRELOCK_PRECHECK_REPLACES_LOCKED_SOURCE_RECHECK:
NO
```

### Stage B: canonical authoritative locks and recheck

The recovered date and current display name derive the exact existing P2B
`STUDENT_DISPLAY_NAME` and `STUDENT_BIRTH_DATE` mutex keys with the current
normalization version, identity policy registry, digest-key epoch, and identity
environment. The transaction then locks and rechecks in the frozen order:

```text
CENTER_CRM_CONTROL_ROW
-> SORTED_IDENTITY_MUTEX_ROWS
-> ACCOUNT_SECURITY_CONTROL_ROW
-> CONSUMED_STEP_UP_ASSERTION_ROW
-> MEMBERSHIP_AND_CAPABILITY_SUPPORT_ROWS
-> CONVERSION_AUTHORITY_ROW
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
-> AUDIT_ROWS
-> OUTBOX_ROWS
-> COMMIT
```

Every Stage A fact is rechecked under the appropriate canonical lock. The exact
Candidate version and source envelope bytes used for unwrap are compared again
after source lock. Authority, Request, account, membership, step-up, policy, or
source drift fails the whole transaction before any target/binding/reservation/
lifecycle/event mutation. Stage A is never cached authority.

## Source unwrap, identity derivation, and target re-protection

The protected bridge sequence is frozen:

1. Pass Stage A for the exact real-conversion purpose.
2. Derive the current P3C crypto fingerprint internally.
3. Strictly parse the `IC3CBE01` frame and resolve only the registered source
   epoch/slot/context.
4. Build exact Candidate AAD and authenticate/decrypt with Vault.
5. Validate the strict 10-byte date and hold only a local SQL `date`.
6. Re-derive existing P2 Student name/birth mutexes and digests in the identity
   domain; acquire locks and complete Stage B authoritative rechecks.
7. For a create action, protect the same local date afresh as `IC3SBE01` using
   Student slot/context/AAD and a fresh target nonce.
8. Persist only the target envelope in
   `student_profile.birth_evidence_protected`; continue the atomic P3D
   composition.

```text
P3D0_CANDIDATE_BIRTH_CIPHERTEXT_DIRECT_COPY_TO_STUDENT:
NO
P3D0_STUDENT_BIRTH_TARGET_REPROTECTION_REQUIRED:
YES
P3D0_SOURCE_UNWRAP_REDERIVES_P2_STUDENT_MUTEXES:
YES
```

Equal plaintext does not make source and target ciphertext interchangeable.
Direct copy is forbidden both cryptographically and semantically.

## P3C forward-compatible implementation strategy

P3D may use its single future forward migration to add protected internal
Candidate-source parse/seal/unwrap, Student-target seal/validate, finite error,
and orchestration helpers. All such helpers are security-definer functions with
an empty search path and no direct execute grant for `PUBLIC`, `anon`,
`authenticated`, or `service_role`. The local synthetic source sealer exists
only for guarded test orchestration or a future separately audited trusted
ingestion composer; it is not a product RPC.

That same forward migration may replace only the body of
`f23_3e_p3c_internal_create_student_target`, keeping the exact existing
signature. P3D supplies the internally authenticated SQL date; the replacement
must seal `IC3SBE01` for the exact preallocated Student ID instead of copying
Candidate bytes.

The replacement preserves every final-audited P3C business invariant:

- action is `CREATE_NEW_STUDENT` and `APPROVED`;
- review is `CREATE_NEW_REVIEWED` / `PREPARE_CREATE_NEW` / `NO_MATCH`;
- canonical `ACTIVE` reservation and exact
  `reservation.preallocated_target_id`;
- exact Request, Case, Candidate, action, review, policy, and source versions;
- exact locked Student identity mutexes;
- `profile_status = ACTIVE`;
- `learning_lifecycle_status = NULL`;
- `student_version = 1`;
- reservation is not consumed by this helper;
- no standalone commit and no browser/service-role direct grant.

Only birth protection changes. The P3C checkpoint bytes and external P3D RPC
remain unchanged.

```text
P3D0_P3C_FORWARD_REPLACEMENT_SCOPE:
PROTECTED_BIRTH_BRIDGE_ONLY
P3D0_P3C_BUSINESS_SEMANTICS_CHANGE:
NO
P3D0_P3C_CHECKPOINT_EDIT_REQUIRED:
NO
```

The frozen executor signature remains:

```text
conversion.execute(
  conversion_request_id uuid,
  conversion_authority_id uuid,
  expected_request_version integer,
  expected_authority_version integer,
  environment_fingerprint bytea,
  operation_intent_digest bytea,
  idempotency_key_digest bytea,
  idempotency_expires_at timestamptz
)
```

It accepts no birth date/year/plaintext/ciphertext, crypto key, crypto context,
center, actor, role, action list, target choice, or step-up truth.

```text
P3D0_P3D_CALLER_SUPPLIES_BIRTH_DATE:
NO
P3D0_P3D_EXTERNAL_SIGNATURE_CHANGE_REQUIRED:
NO
```

## Legacy, unknown, and failure behavior

Any Candidate bytes that are not an authenticated `IC3CBE01` frame are
`LEGACY_OPAQUE`. They are never interpreted as UTF-8, cast to a date,
best-effort parsed, silently upgraded, bulk rewritten, copied into Student, or
treated as sufficient identity evidence.

The executor fails the entire create-Student conversion with the
non-disclosing dependency outcome `CANDIDATE_BIRTH_CRYPTO_UNAVAILABLE`. It must
leave no Student, binding, relationship, reservation consumption, Candidate or
Case transition, Request completion, authority consumption, Audit success, or
Outbox success.

Finite internal classifications are:

```text
CANDIDATE_BIRTH_CRYPTO_VERSION_UNSUPPORTED
CANDIDATE_BIRTH_ENVELOPE_MALFORMED
CANDIDATE_BIRTH_CRYPTO_KEY_UNAVAILABLE
CANDIDATE_BIRTH_AUTHENTICATION_FAILED
CANDIDATE_BIRTH_PAYLOAD_INVALID
STUDENT_BIRTH_TARGET_CRYPTO_KEY_UNAVAILABLE
STUDENT_BIRTH_TARGET_PROTECTION_FAILED
```

Raw Vault errors, ciphertext, keys, AAD, nonce, plaintext, or parsing detail do
not escape. Internal classifications may collapse to the finite public
dependency outcome.

```text
P3D0_LEGACY_CANDIDATE_BIRTH_REINTERPRETATION:
NO
P3D0_LEGACY_CANDIDATE_BIRTH_AUTOMATIC_MIGRATION:
NO
P3D0_LEGACY_CANDIDATE_CREATE_EXECUTION:
FAIL_CLOSED
```

## PII and reveal boundary

The plaintext date exists only in protected PostgreSQL local variables for the
current function/transaction frame. It is not persisted in a table, temporary
table, session GUC, notice, exception, debug output, cache, URL, Audit, Outbox,
idempotency result, executor result, result-status response, or test report.

The unwrap is protected server composition, not a human/browser/service reveal.
It is purpose-bound to exact `crm.real_conversion.execute`, Request, ISSUED
authority, consumed step-up, current actor/security/membership, and Candidate.

```text
P3D0_CANDIDATE_BIRTH_GENERAL_REVEAL_RPC:
NONE
P3D0_CANDIDATE_BIRTH_BROWSER_REVEAL:
NO
P3D0_CANDIDATE_BIRTH_SERVICE_ROLE_DIRECT_REVEAL:
NO
```

## Deferred ingestion boundary

P3D0 deliberately does not define product/UI ingestion of real Candidate birth
evidence. Historical/local opaque rows remain opaque. Guarded future P3D local
QA may construct a synthetic canonical source envelope only through an internal
protected sealing helper and must clean all fixtures to baseline zero.

```text
P3D0_PRODUCT_CANDIDATE_BIRTH_INGESTION:
DEFERRED
P3D0_PRODUCT_INGESTION:
DEFERRED
P3D0_LOCAL_SYNTHETIC_PROTECTED_SEALING:
ALLOWED_FOR_GUARDED_P3D_QA_ONLY
P3D0_PRODUCTION_INGESTION_READY:
NO
```

This deferred product boundary does not block backend-local P3D implementation
or synthetic local verification. It does mean real product end-to-end remains
not ready.

## Required P3D implementation and QA addendum

The resumed P3D implementation must prove all of the following without exposing
birth plaintext:

- canonical `IC3CBE01` source opens only under exact crypto environment,
  center, Case, Candidate, epoch, source context, and source AAD;
- wrong environment/center/Case/Candidate/epoch/context/magic/envelope version/
  payload schema, tamper, truncation, trailing bytes, random bytes, and raw UTF-8
  bytes fail closed;
- strict malformed or impossible dates fail closed;
- source unwrap rederives the exact current P2 Student name/birth mutexes and
  lookup digests internally;
- Student target bytes differ from source and authenticate only as `IC3SBE01`
  under exact Student crypto environment, center, ID, epoch, context, and AAD;
- source cannot decrypt target and target cannot decrypt source;
- raw date persists and appears nowhere;
- Stage A success followed by Candidate/envelope, authority, account security,
  membership, Request, or policy drift is denied under Stage B locks with full
  rollback;
- P3C writer business semantics remain byte-for-byte equivalent except for the
  target birth protection bridge.

No real secret, production data, Auth provider, remote Supabase, or product
ingestion is needed for that guarded local QA.

## Design closure

Physical evidence shows no conflicting canonical Student birth crypto contract,
no schema-shape contradiction, and no need for a fourth environment domain or
new business resource. Existing `bytea` columns can hold the self-contained
frames. The current P3C writer already accepts the needed typed date and can be
boundedly forward-replaced without changing its signature or business
semantics. Therefore none of the genuine STOP conditions applies.

```text
P3D0_EXISTING_BYTEA_SHAPES_SUFFICIENT:
YES
P3D0_EXISTING_STUDENT_PROTECTION_CONTRACT_CONFLICT:
NO
P3D0_NEW_BUSINESS_RESOURCE_REQUIRED:
NO
P3D0_REAL_SECRET_REQUIRED_FOR_BACKEND_LOCAL_QA:
NO
P3D0_CHECKPOINT_MIGRATION_HASH_COUNT: 16

P3D0_FINAL_TECHNICAL_AUDIT:
PASS
P3D0_CANDIDATE_SOURCE_ENVELOPE:
FROZEN
P3D0_STUDENT_TARGET_ENVELOPE:
FROZEN
P3D0_PLAINTEXT_PERSISTENCE:
NONE
P3D0_GENERAL_REVEAL_RPC:
NONE
P3D0_P3C_CHECKPOINT_EDIT_REQUIRED:
NO
P3D0_P3D_EXTERNAL_SIGNATURE_CHANGE_REQUIRED:
NO
P3D0_PERSISTED_SCHEMA_EXPANSION_REQUIRED:
NO
P3D0_PRODUCT_INGESTION:
DEFERRED
P3D0_P3D_BACKEND_LOCAL_IMPLEMENTATION:
SAFE_TO_RESUME
P3D0_REAL_PRODUCT_END_TO_END:
NO
```
