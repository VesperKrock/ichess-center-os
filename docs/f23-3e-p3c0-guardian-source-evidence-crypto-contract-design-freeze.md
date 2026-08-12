# F23.3E-P3C0 - Guardian Source-Evidence Crypto Contract Design Freeze

## Status and decision

```text
F23_3E_P3C0_STATUS: DESIGN COMPLETE IN REPO
F23_3E_P3C0_FINAL_TECHNICAL_AUDIT: PASS
F23_3E_P3C0_MIGRATION_CREATED: NO
F23_3E_P3C0_RUNTIME_CHANGE: NO

P3C0_CURRENT_CONTACT_CRYPTO_CONTRACT:
OPAQUE_CALLER_SUPPLIED_PROTECTED_BYTES

P3C0_LEGACY_SOURCE_CIPHERTEXT:
OPAQUE_FAIL_CLOSED

P3C0_CANONICAL_SOURCE_ENVELOPE:
FROZEN

P3C0_GUARDIAN_TARGET_REPROTECTION:
FROZEN

P3C_GUARDIAN_SOURCE_CIPHERTEXT_DIRECT_COPY_ALLOWED: NO
P3C_GUARDIAN_TARGET_REPROTECTION_REQUIRED: YES

P3C0_CRYPTO_CONTRACT_FREEZE: COMPLETE
P3C0_P3C_BACKEND_LOCAL_IMPLEMENTATION:
SAFE_TO_RESUME
P3C_BACKEND_LOCAL_IMPLEMENTATION: SAFE
P3_PRODUCT_INGESTION_INTEGRATION: DEFERRED

P3C0_P3B_AUTHORITY_ENVIRONMENT_PROVENANCE:
CALLER_SUPPLIED_OPAQUE_32_BYTE_BINDING
P3C0_P2B_IDENTITY_ENVIRONMENT_PROVENANCE:
SERVER_DERIVED_IDENTITY_DIGEST_KEY_HMAC
P3C0_CRYPTO_ENVIRONMENT_FINGERPRINT:
SERVER_ROOT_DERIVED
P3C0_ENVIRONMENT_FINGERPRINT_DOMAIN_COUNT: 3

P3C_CRYPTO_ENVIRONMENT_EQUALS_P3B_AUTHORITY_ENVIRONMENT: NO
P3C_CRYPTO_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT
P3B_AUTHORITY_ENVIRONMENT_EQUALS_P2B_IDENTITY_ENVIRONMENT: NO_REQUIREMENT
P3D_COMPARE_P3C_CRYPTO_ENVIRONMENT_TO_P3B_AUTHORITY_ENVIRONMENT: NO
P3D_AUTHORITY_ENVIRONMENT_RECHECK: INDEPENDENT
P3D_CRYPTO_ENVIRONMENT_RECHECK: INDEPENDENT
P3C0_CRYPTO_ENVIRONMENT_REQUIRES_AUTHORITY_COLUMN: NO

P3C0_REMOTE_APPLY: NOT RUN
P3C0_CANONICAL_CRM_REMOTE_APPLY: NOT RUN
P3C0_REAL_SECRET_PROVISIONING: NOT RUN
P3C0_REMOTE_SECRET_PROVISIONING: NOT RUN
P3C0_REAL_DATA_REENCRYPTION: NOT IMPLEMENTED
P3C0_PRODUCT_REAL_DATA_REENCRYPTION: NOT IMPLEMENTED
```

P3C0 began from clean `main` at
`7f6eb8c4a2ab9dcfcd5fdb8e83d8c48270056834`. It creates this report and its
semantic smoke only. It does not create or alter SQL, runtime code, Auth, Edge,
remote state, deployment state, roadmap state, a secret, a target row, or real
data.

The blocker is resolved without expanding the frozen P3A target schema. The
existing `bytea + integer` source shape can hold an authenticated,
self-contained envelope. This decision does not reinterpret existing rows:
only source crypto version 2 with the exact envelope below is canonical.
Historical version 1, arbitrary positive versions, malformed version-2 bytes,
and envelopes whose exact key epoch is unavailable remain opaque and fail
closed.

## Repository and local primitive inventory

The inventory is based on the checkpoint migrations, the final-audited P3A and
P3B artifacts, a read-only local catalog inspection, and the source of the
installed Vault version.

| Area | Exact observed contract | P3C0 disposition |
|---|---|---|
| P1A `crm_contact` | `protected_contact_methods_ciphertext bytea NOT NULL`, `contact_methods_crypto_version integer NOT NULL`, `normalized_lookup_digests bytea[] NOT NULL`, and `normalization_version integer NOT NULL`. Its checks establish only non-empty ciphertext and a positive integer version. | Physical storage is sufficient, but it proves no algorithm or decryptability. |
| P1D Contact create/update | Both typed service functions receive protected bytes and crypto version as caller arguments, validate structural shape, and assign those arguments directly. There is no registered suite lookup or cryptographic verification. | Existing P1D remains an opaque transport boundary and is not silently redefined. |
| P1E masking | Contact and Case application projections omit ciphertext, crypto version, and lookup digests; there is no inherited application decrypt/reveal RPC. | P3C adds no browser-visible reveal path. |
| P3A Guardian | `guardian_profile` has its own protected ciphertext/version and immutable source provenance. Its internal target helper must unwrap and re-protect; source bytes are not portable to the target context. | Preserved exactly and made implementable by this contract. |
| P3B authority | The physical issue RPC accepts `p_environment_fingerprint bytea`, checks only non-null/exactly 32 bytes, binds that caller value into issuance idempotency, and inserts the same value into `crm_conversion_authority.environment_fingerprint`. | Preserve it as the opaque P1/P3B Request/idempotency/authority binding. It is not P3C crypto evidence. |
| P2B identity environment | `f23_3e_p2b_internal_environment_fingerprint(integer)` performs HMAC-SHA-256 over `f23.3e.p2b/environment-fingerprint/v1` with `f23_3e_p2b_internal_digest_key(epoch)`. | Preserve it as the protected identity-policy/evidence/mutex domain. It is neither the P1/P3B authority binding nor P3C crypto evidence. |
| Local extensions | `pgcrypto 1.3` and `supabase_vault 0.3.1` are installed. No separately installed `pgsodium` extension was observed. | P3C may use the installed protected Vault primitive and `extensions.digest`; it does not depend on a new server or remote Vault. |
| Local Vault state | The read-only inventory found zero rows in `vault.secrets` and no application crypto registry/helper. | Primitive availability is not evidence about legacy envelopes. P3C QA must preserve the Vault-row baseline. |

The exact protected primitive in `supabase_vault 0.3.1` is:

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

Vault 0.3.1 names the construction `crypto_aead_det_xchacha20`. It derives a
32-byte subkey from the server root key using the exact `bigint key_id` and an
exactly 8-byte KDF context. It requires a 16-byte nonce. Encryption returns
`ciphertext || 32-byte synthetic authenticator`; decryption recomputes and
constant-time compares that authenticator and rejects an invalid ciphertext.
`additional` is authenticated AAD. This is the Vault 0.3.1 deterministic,
nonce-misuse-resistant XChaCha20/S2V-style construction, not
XChaCha20-Poly1305 and not a generic interchangeable AEAD label.

Primary-source provenance for the installed tag is the Vault 0.3.1
[`crypto_aead_det_xchacha20` header](https://github.com/supabase/vault/blob/v0.3.1/src/crypto_aead_det_xchacha20.h),
its [encrypt/decrypt implementation](https://github.com/supabase/vault/blob/v0.3.1/src/crypto_aead_det_xchacha20.c),
the [PostgreSQL wrapper and nonce validation](https://github.com/supabase/vault/blob/v0.3.1/src/pgsodium.c),
and the [root-key KDF helper](https://github.com/supabase/vault/blob/v0.3.1/src/pgsodium.h).
The local catalog signatures and extension version, rather than the links
alone, determine checkpoint availability.

The functions' execute privilege is revoked from `PUBLIC` by Vault. P3C calls
them only from owner-controlled internal functions whose own execute privilege
is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
`extensions.digest(bytea, 'sha256')` supplies the 32-byte digest needed by the
environment-binding derivation and does not decrypt data. No SQL function
exposes the server root key or a derived data-protection key.

```text
P3C0_ALGORITHM:
SUPABASE_VAULT_0_3_1_CRYPTO_AEAD_DET_XCHACHA20
P3C0_AEAD_DERIVED_KEY_BYTES: 32
P3C0_AEAD_NONCE_BYTES: 16
P3C0_AEAD_AUTHENTICATOR_BYTES: 32
P3C0_AEAD_AAD_SUPPORTED: YES
P3C0_CRYPTO_PRIMITIVE_AVAILABLE_EQUALS_LEGACY_CONTRACT_KNOWN: NO
```

The proof of a usable primitive establishes only a new contract. It supplies
no missing nonce, AAD, key ID, context, or authenticated layout for historical
P1 bytes.

## Three independent environment fingerprint domains

The physical checkpoint defines three separate provenance and purpose domains:

| Semantic name | Provenance | Purpose | Explicitly not |
|---|---|---|---|
| `authority_environment_fingerprint` | Historical P1/P3B caller-supplied opaque 32-byte binding. P3B validates shape, uses it for issuance idempotency lookup/insert and persists it unchanged on the authority. | Request, idempotency, and conversion-authority scope. | P3C crypto proof, P2B identity-policy proof, Vault-root fingerprint, encryption key, or AAD secret. |
| `identity_environment_fingerprint` | P2B protected HMAC-SHA-256 using the identity digest key selected by its digest-key epoch. | Identity policy, evidence digest, and identity mutex domain. | Authority provenance, Vault-root provenance, or P3C crypto AAD value. |
| `crypto_environment_fingerprint` | P3C protected deterministic Vault-root derivation frozen below. | Contact-source and Guardian-target AEAD environment domain. | Authority/idempotency scope input or P2B identity policy binding. |

There is no cross-domain equality requirement. Coincidentally equal bytes do
not merge provenance or semantics, and no domain substitutes for another. A
transaction may perform P2 identity mutex checks, P3B authority checks, and
P3C cryptography together while still keeping all three bindings independent.
P3C neither changes the P2B helper nor reinterprets the checkpointed P3B value.

Future P3D performs two independent environment checks:

1. It preserves and rechecks `authority_environment_fingerprint` under the
   existing P1/P3B Request, idempotency, and conversion-authority contract. It
   never treats this caller-supplied opaque binding as crypto evidence.
2. Before source unwrap or Guardian protection, the protected P3C helper
   independently derives `crypto_environment_fingerprint` from the current
   server root and authenticates the source/target AAD under that crypto domain.

P3D never compares these fingerprints to each other. It also does not compare
either with `identity_environment_fingerprint`. No new authority column is
needed: the crypto fingerprint is reproducibly server-derived and authenticated
inside the source/target ciphertext AAD.

## Two source classes and finite version registry

### Legacy opaque Contact evidence

A row is legacy opaque when its bytes predate this contract, its crypto version
is not exactly 2, its envelope fails the exact parser/authentication rules, or
its registered epoch is unavailable.

```text
LEGACY_OPAQUE
NOT_DECRYPTABLE_BY_CONTRACT
NOT_GUARDIAN_REPROTECTABLE
NOT_AUTOMATICALLY_UPGRADED
LEGACY_CONTACT_CRYPTO_REMEDIATION:
EXPLICIT_REINGEST_OR_REENCRYPT_REVIEW_REQUIRED
```

P1's acceptance of version 1 or 999 never registers either value as a suite.
There is no best-effort decrypt, key guessing, ciphertext copy, bulk conversion,
or silent version rewrite.

### Canonical protected source evidence

A source is canonical only when `contact_methods_crypto_version = 2` and its
bytes pass the exact format, epoch, environment, AAD, and authentication rules
below.

Version 2 is allocated prospectively by this freeze. The integer by itself does
not upgrade a pre-contract row: a historical/local row carrying 2 but lacking
the exact authenticated envelope remains `LEGACY_OPAQUE`. The read-only local
checkpoint inventory found zero `crm_contact` rows, and canonical CRM has not
been applied remotely. Those rollout facts reduce no compatibility rule; any
future-discovered opaque row still takes the same fail-closed path.

```text
CANONICAL_SOURCE_ENVELOPE
VERSION_REGISTERED
KEY_SLOT_KNOWN
AAD_KNOWN
UNWRAP_CONTRACT_KNOWN
GUARDIAN_REPROTECTION_ALLOWED

P3C_SUPPORTED_CONTACT_SOURCE_CRYPTO_VERSIONS: 2
P3C_CANONICAL_CONTACT_SOURCE_CRYPTO_VERSION: 2
P3C_LEGACY_CONTACT_CRYPTO_VERSION_REINTERPRETED: NO
P3C_GUARDIAN_TARGET_CRYPTO_VERSION: 1
P3C0_ENVELOPE_FORMAT_VERSION: 1
P3C0_PAYLOAD_SCHEMA_VERSION: 1
```

The source version lifecycle registry is finite:

| Object | Version | Lifecycle | Meaning |
|---|---:|---|---|
| Contact source | 2 | `SUPPORTED_WRITE` and `SUPPORTED_READ_ONLY` | Current canonical source envelope. |
| Contact source | every value other than 2 | `RETIRED_FAIL_CLOSED` | Legacy, unknown, or unregistered; no decrypt attempt. |
| Guardian target | 1 | `SUPPORTED_WRITE` and `SUPPORTED_READ_ONLY` | Current Guardian target envelope. |
| Guardian target | every value other than 1 | `RETIRED_FAIL_CLOSED` | Unknown or unregistered target envelope. |

Adding a future supported version or epoch requires an audited forward change;
an arbitrary positive integer can never enter the supported set implicitly.

## Exact self-contained envelope V1

All integer fields use unsigned network byte order (big endian). Parsers require
the exact total length and reject trailing bytes. The source and target use the
same framing but distinct magic bytes and cryptographic domains.

| Byte range | Length | Field | Exact rule |
|---|---:|---|---|
| `0..7` | 8 | magic | Source ASCII `IC3CSE01`; Guardian target ASCII `IC3GTE01`. |
| `8` | 1 | envelope format version | Unsigned value 1. |
| `9` | 1 | payload schema version | Unsigned value 1. |
| `10..13` | 4 | key epoch | Unsigned big-endian value; current epoch is 1. |
| `14..15` | 2 | nonce length | Unsigned big-endian value 16. |
| `16..31` | 16 | nonce | Exact output of `vault._crypto_aead_det_noncegen()` for a normal write. |
| `32..35` | 4 | sealed length | Unsigned big-endian byte length `N`, with `N >= 32`. |
| `36..(35+N)` | `N` | sealed payload | Exact Vault output: encrypted payload followed by its 32-byte synthetic authenticator. |

The parser requires `octet_length(envelope) = 36 + N`, the domain-specific
magic, both version bytes equal to 1, nonce length 16, a registered positive
epoch, and sealed length at least 32. It never accepts truncation, an omitted
nonce, an externally stored tag, a secret-bearing field, or trailing data.
The canonical plaintext is a non-empty opaque contact-method payload of at most
65,536 bytes. P3C neither parses it nor returns it; schema version 1 is bound in
both the header and AAD.

This exact layout fits the existing `bytea` column and requires no persisted
source metadata column. Therefore
`CONTACT_SOURCE_ENVELOPE_REQUIRES_SCHEMA_EXPANSION` does not apply.

## Logical key slots, epochs, and crypto environment

No actual key is stored in this report, a migration, a fixture, or an RPC
argument. The following finite mappings are server-owned constants inside
internal P3C resolver functions:

| Purpose | Logical slot | Epoch | Vault `key_id` | Exact 8-byte KDF context |
|---|---|---:|---:|---|
| Contact source | `F23_3E_P3C_CONTACT_SOURCE_PROTECTION` | 1 | 1 | ASCII `iC3Src01` |
| Guardian target | `F23_3E_P3C_GUARDIAN_TARGET_PROTECTION` | 1 | 1 | ASCII `iC3Gdn01` |
| Environment derivation | `F23_3E_P3C_ENVIRONMENT_FINGERPRINT` | 1 | 1 | ASCII `iC3Env01` |

The equal numeric `key_id` does not reuse a key: Vault KDF contexts are distinct
and derive distinct 32-byte subkeys from the environment's server root key.
There is exactly one mapping per `(logical slot, epoch)`. Missing mapping or
unavailable derived key returns `CRYPTO_KEY_UNAVAILABLE`; duplicate or
contradictory mapping returns `CRYPTO_KEY_CONFIGURATION_INVALID`. A caller
cannot add or select a mapping.

For new writes, the internal resolver selects current epoch 1. Reads select the
exact epoch encoded in the envelope. A later rotation changes the current write
epoch only after a forward registry change; old supported envelopes retain
their epoch. An unknown or retired epoch fails closed. Rotation does not alter
identity evidence and performs no mass rewrite.

The `crypto_environment_fingerprint` is exactly the 32-byte SHA-256 digest of
this deterministic protected derivation:

```text
vault._crypto_aead_det_encrypt(
  UTF8("ichess.p3c.environment.fingerprint.v1"),
  UTF8("ichess.p3c.environment.fingerprint.aad.v1"),
  key_id = 1,
  context = ASCII("iC3Env01"),
  nonce = 16 zero bytes
)
```

The protected helper hashes that returned byte string with SHA-256 and returns
only the 32-byte crypto fingerprint. It takes no caller environment argument.
The derivation is stable within one server-root environment and differs when
the server root differs. The crypto fingerprint is included in both AAD domains. The
environment-owned server root also participates in every source/target key
derivation. A source envelope made under Server Root A moved to Server Root B
therefore encounters a different crypto fingerprint, a different derived key,
a different AAD, and an authentication failure. This property does not depend
on P3B caller-supplied environment bytes.

The caller cannot supply or read a data key; browsers cannot execute the
helpers; a service RPC never returns a key, nonce, plaintext, or envelope; and
no fixed real key or Vault secret is required.

## Exact source and target AAD

Define `U8(n)` as one unsigned byte, `U32(n)` as four unsigned big-endian bytes,
and `LP32(b)` as `U32(octet_length(b)) || b`. UUID bytes are PostgreSQL
`uuid_send(uuid)`. Text is strict UTF-8. Concatenation below is byte
concatenation in the displayed order.

Source AAD V1 is exactly:

```text
LP32(UTF8("ichess.crm.contact.source-evidence.aead.v1"))
|| U8(1)                                      -- envelope format
|| U8(1)                                      -- payload schema
|| U32(2)                                     -- source crypto version
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)       -- exactly 32 bytes
|| LP32(UTF8(center_id))
|| LP32(uuid_send(crm_contact_id))            -- exactly 16 bytes
```

Guardian target AAD V1 is exactly:

```text
LP32(UTF8("ichess.guardian.target.contact-evidence.aead.v1"))
|| U8(1)                                      -- envelope format
|| U8(1)                                      -- payload schema
|| U32(1)                                     -- Guardian target crypto version
|| U32(key_epoch)
|| LP32(crypto_environment_fingerprint)       -- exactly 32 bytes
|| LP32(UTF8(center_id))
|| LP32(uuid_send(guardian_id))                -- exactly 16 bytes
```

Both AAD serializations bind only the P3C
`crypto_environment_fingerprint`; neither imports the P3B
`authority_environment_fingerprint` nor the P2B
`identity_environment_fingerprint`. The different domain identifiers, magic
values, KDF contexts, and object IDs
provide four independent separation checks even though both domains use the
same Vault algorithm. Wrong environment, center, Contact ID, Guardian ID,
version, epoch, or domain causes authentication failure. Mutable display name,
status, timestamps, source version counters, and lookup digests are excluded so
legitimate metadata changes do not make an envelope undecryptable.

Guardian provenance remains in the frozen columns
`created_from_contact_id`, `created_from_case_id`,
`created_from_request_id`, and `created_from_action_id`. Those IDs are
integrity/FK evidence, not keys. Only the Guardian target ID is cryptographic
target identity, so source provenance is intentionally not duplicated into
target AAD.

`normalized_lookup_digests` remain separate protected search evidence. They are
not keys, reversible contact data, plaintext substitutes, or proof of person
identity. Re-protection never reconstructs plaintext from a lookup digest.

## Protected ingestion and P1 compatibility

P3C uses an explicit combination of choices B and C:

- B: add `f23_3e_p3c_internal_protect_contact_source_evidence` as a separate,
  protected canonical-ingestion primitive. It accepts trusted server payload
  bytes plus locked `center_id` and `crm_contact_id`, validates payload length,
  derives the environment and current source slot/epoch, builds exact AAD,
  generates a 16-byte nonce, seals the payload, builds `IC3CSE01`, and writes
  source crypto version 2 in the same protected transaction. It returns no
  plaintext, key, or envelope to an application caller.
- C: retain P1D Contact create/update external signatures and their legacy
  opaque semantics. P3C does not forward-replace P1D merely to label arbitrary
  caller bytes canonical. A structurally accepted P1D row is Guardian-eligible
  only if later exact parsing and authenticated unwrap under version 2 succeed;
  otherwise it is opaque and requires explicit protected re-ingestion review.

The P3C helper has no `service_role` grant and is callable only inside an
owner-controlled protected composer or local-superuser QA transaction. Future
product ingestion requires a separately audited trusted server composer that
performs canonical payload validation before calling it. Browser-supplied
ciphertext, crypto version, environment, epoch, nonce, or secret never becomes
authoritative. Product ingestion integration is deferred; P3C/P3D must not
claim it.

Backend-local P3C remains valid without that product composer: guarded local QA
may use local PostgreSQL/test orchestration to call the internal helper and
create a synthetic canonical source envelope, then exercise the internal
Guardian writer. This is the same already-authorized test-only internal-helper
pattern and adds no permanent bypass or external RPC.

## Guardian unwrap and target-context re-protection

Within the canonical P3 lock order and one transaction, the Guardian create
helper performs exactly:

1. Load and lock the exact current Contact through the already selected center,
   Case, Request/action, identity mutex, and reservation scope. Recheck center,
   Contact version, current source binding, action, reserved Guardian target ID,
   and server-derived P3C crypto environment fingerprint. The P3B authority
   environment is rechecked separately under its own authority/idempotency
   contract and is never compared with the crypto fingerprint.
2. Require source crypto version 2. Parse the source envelope exactly and
   resolve only its registered source epoch. Build source AAD from locked values.
3. Call the protected Vault decrypt primitive. Authentication failure, missing
   key, wrong AAD, malformed bytes, or unsupported version stops the transaction.
4. Keep the opaque canonical payload only in a local protected function
   variable. Do not put it in a table, temporary table, Audit/Outbox payload,
   exception detail, log, or RPC response.
5. Resolve the current Guardian target epoch, build target AAD with the exact
   preallocated `guardian_id`, generate a fresh 16-byte nonce, encrypt under the
   Guardian slot, and build the `IC3GTE01` envelope.
6. Persist only the Guardian envelope and Guardian target crypto version 1 with
   the four frozen provenance IDs. Function scope ends on success; any failure
   rolls back the target and every sibling P3 mutation.

Source and target byte strings must differ. Direct assignment from
`crm_contact.protected_contact_methods_ciphertext` to the Guardian protected
column is prohibited. The Guardian writer must call
`f23_3e_p3c_internal_protect_target_evidence`; that helper composes the exact
source unwrap and target seal and returns only the target protected pair to its
internal caller.

Contact changes after selection are caught by the held row lock and exact
version recheck. A target ID/reservation or center-root drift is caught before
unwrap. The epoch resolver snapshots an exact registered epoch within the
transaction; a registry change is a forward SQL change, not mutable caller
state. Crypto helpers run only after their place in the canonical business lock
order, acquire no earlier-tier business lock, and perform no network or human
wait while locks are held.

## Finite fail-closed behavior

Internal diagnostics use only this finite vocabulary:

```text
CONTACT_SOURCE_CRYPTO_VERSION_UNSUPPORTED
CONTACT_SOURCE_ENVELOPE_MALFORMED
CONTACT_SOURCE_CRYPTO_KEY_UNAVAILABLE
CONTACT_SOURCE_AUTHENTICATION_FAILED
CRYPTO_KEY_CONFIGURATION_INVALID
GUARDIAN_TARGET_CRYPTO_KEY_UNAVAILABLE
GUARDIAN_TARGET_PROTECTION_FAILED
GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE
GUARDIAN_TARGET_CRYPTO_UNAVAILABLE
```

Unauthorized/application callers see only
`GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE` for unsupported source version,
malformed source envelope, unavailable source key, configuration ambiguity, or
source authentication failure. Target key/protection failure collapses to
`GUARDIAN_TARGET_CRYPTO_UNAVAILABLE`. Raw database/Vault exceptions and the
reason a particular row failed are never exposed.

Canonical Guardian search that needs source evidence returns
`MATCH_SEARCH_UNAVAILABLE` when source crypto is unavailable; it never converts
that condition to `NO_MATCH`, `CREATE_NEW_REVIEWED`, or reusable evidence.
Guardian create returns `GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE` and writes nothing.
Existing canonical-target lookup may use its separately protected digests, but
it cannot infer or upgrade a legacy source envelope.

AEAD authentication failure is integrity failure; unsupported version and
malformed framing are contract failures; missing/ambiguous key is protected
configuration failure; wrong center/object/environment/domain becomes
authentication failure. All fail closed before a target, binding, relationship,
Audit event, or Outbox event commits.

Logs may contain opaque resource IDs, a finite version, a key epoch number, a
finite error/result code, and a correlation ID. They must never contain the
plaintext payload, either ciphertext, a Vault/root/derived key, a raw nonce, a
provider secret, raw exception detail, a real email, or a real phone number.

## P3C implementation addendum

The resumed P3C phase must implement this addendum inside its single allowed
forward migration without changing its four frozen business aggregates or two
external plan RPCs.

1. Add protected internal helper
   `f23_3e_p3c_internal_crypto_environment_fingerprint`. Add protected
   internal helpers for strict source/target envelope V1 parsing/encoding,
   finite source/target
   epoch resolution, exact LP32 AAD construction, protected source sealing and
   unwrap, and Guardian target sealing. All are `SECURITY DEFINER` with empty
   search path and explicit revoke from browser and service roles.
2. Implement source version set `{2}`, source magic `IC3CSE01`, source slot
   `F23_3E_P3C_CONTACT_SOURCE_PROTECTION`, epoch 1 / `key_id=1` /
   `iC3Src01`, exact source AAD, and finite legacy failures.
3. Implement Guardian target version set `{1}`, target magic `IC3GTE01`, target
   slot `F23_3E_P3C_GUARDIAN_TARGET_PROTECTION`, epoch 1 / `key_id=1` /
   `iC3Gdn01`, exact target AAD, and
   `f23_3e_p3c_internal_protect_target_evidence` as unwrap-then-re-protect.
4. Keep the P1D external signatures and opaque behavior. Do not make arbitrary
   P1D bytes canonical and do not add a browser/service decryption endpoint.
5. In P2B/P2C forward dispatch, make unavailable/legacy Guardian source crypto
   fail as `MATCH_SEARCH_UNAVAILABLE` or
   `GUARDIAN_SOURCE_CRYPTO_UNAVAILABLE`, never `NO_MATCH` and never an implicit
   create/reuse decision.
6. The Guardian create helper must require the current locked Contact, exact
   version, exact reserved Guardian UUID, exact center, current typed action,
   and server-derived P3C crypto environment before calling the crypto helper.
   It must not compare that value with the P3B authority or P2B identity
   fingerprint. It must not consume reservation/authority or complete
   Request/Case in P3C.
7. Keep Student, binding, relationship, plan lifecycle, Audit/Outbox,
   idempotency, replay, and lock-order semantics from the P3A/P3C prompt
   unchanged. No fifth business aggregate or persisted plaintext store is
   introduced.

The guarded P3C local QA must verify:

- the exact Vault extension version/signatures and all three exact 8-byte KDF
  contexts before creating fixtures;
- a synthetic source envelope opens only with its exact crypto environment, center,
  Contact UUID, version, epoch, source slot, source AAD, and unmodified bytes;
- wrong crypto environment, center, Contact UUID, epoch, domain, nonce, sealed length,
  magic, header version, payload schema, truncation, trailing byte, and payload
  tamper all fail closed with the frozen safe mapping;
- version 1, version 999, malformed version 2, missing epoch, and ambiguous
  epoch mapping never trigger best-effort decryption or a Guardian write;
- Guardian target bytes differ from source bytes and open only with exact target
  crypto environment, center, Guardian UUID, target slot, target AAD, and target
  version 1; source context cannot open target bytes and target context cannot
  open source bytes;
- source payload is held only in protected function scope and is absent from
  tables, temp tables after the transaction, results, notices, exceptions,
  Audit, Outbox, and captured logs;
- Contact/version, target/reservation, center, and epoch race paths roll back;
  helpers add no business lock inversion and no standalone commit;
- protected helpers deny `anon`, `authenticated`, and `service_role`; the only
  external P3C functions remain the two plan materialize/finalize RPCs;
- local derived test-key use and any optional synthetic Vault rows are removed,
  `vault.secrets` returns to its exact baseline of zero rows, all P3C business
  tables return to zero fixture rows, and `auth.users` returns to baseline.

No production key, remote Vault, real Auth provider, real account, real contact
payload, remote project locator, or remote database URL is required. Passing
that future backend-local QA establishes only the P3C protected database
contract. Product ingress, remote secret provisioning, historical re-encryption,
deployment, UI, import, P3D execution, reservation/authority consumption, and
real conversion remain outside this freeze.

## Closure

```text
P3C0_EXISTING_BYTEA_VERSION_SHAPE_SUFFICIENT: YES
P3C0_SOURCE_ENVELOPE_SELF_CONTAINED: YES
P3C0_SCHEMA_EXPANSION_REQUIRED: NO
P3C0_NEW_EXTERNAL_SERVER_REQUIRED: NO
P3C0_P3C_IMPLEMENTATION_APPROVAL: SAFE_TO_RESUME
P3C0_LEGACY_ROWS_AUTOMATICALLY_MIGRATED: NO
P3C0_P3C0_MIGRATION_COUNT: 0
P3C0_ARTIFACT_COUNT: 2
P3C0_CHECKPOINT_MIGRATION_HASH_COUNT: 15
```

P3C can resume its backend-local implementation after external audit of these
two artifacts. P3C remains TODO until that implementation is complete and
audited; P3D, P4, production ingestion, remote application, and real conversion
remain out of scope.
