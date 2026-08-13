# F23.3E-P4A — Independent Technical Review

## 1. Verdict

```text
F23.3E-P4A TECHNICAL REVIEW: PASS

CRITICAL: 0
HIGH: 0
BLOCKING MEDIUM: 0

P4A BACKEND/LOCAL: PASS
REMOTE SUPABASE APPLY/DEPLOY: NOT RUN
P4B: NOT STARTED
NEXT GATE: P4A CHECKPOINT, THEN F23.3E-P4B
```

The review found no blocking defect in identity correctness, security,
privacy, exact-center isolation, replay, rotation, Guardian compatibility, or
transactional atomicity. This verdict was derived from the physical migration
and applied local database, not from the implementation report's PASS markers.

No P4A implementation file was changed during the review. This report is the
only audit artifact created before the conditional checkpoint step.

## 2. Reviewed baseline and identities

```text
repository: VesperKrock/ichess-center-os
branch: main
pre-review HEAD: d9037c4e72267433b166f351da5cee326eeebd8f
pre-review origin/main: d9037c4e72267433b166f351da5cee326eeebd8f
staged files: 0
tracked modifications: 14/14 expected durable-truth smoke updates
untracked artifacts: 6/6 expected P4/P4A artifacts
P4A migration SHA-256:
1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC
accepted P3D migration SHA-256:
F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3
inherited migration hashes: 17/17 PASS
```

The P4A package owns one forward migration, one implementation report, one
semantic smoke, and one guarded local Docker QA runner. No inherited P1–P3D
migration changed. The accepted P3D bytes remain unchanged.

## 3. Review method

The review inspected the physical P4A SQL, report, smoke, QA runner, the two
P4 readiness artifacts, and the relevant P1D/P1E, P2B/P2C, P3C/P3D contracts.
It also:

- recomputed P4A, P3D, and all inherited migration hashes;
- reset and applied the local migration chain through the guarded runner after
  its loopback/project safety checks passed;
- reran the complete P4A Docker QA rather than citing its previous result;
- queried applied `pg_proc` metadata, effective privileges, RLS, policies, and
  publication membership;
- sent real anonymous PostgREST requests to all four P4A RPCs;
- independently observed a real PostgreSQL wait on the shared
  `center_crm_control` row using two concurrent sessions and
  `pg_blocking_pids`;
- ran `node --check`, the P4A/P4 and inherited semantic regressions, the
  production build, hash checks, `git diff --check`, and hygiene scans;
- reviewed every hunk in the 14 modified inherited smokes for invariant
  weakening.

## 4. Payload and normalization contract

### 4.1 Canonical payload V1

The serializer is binary and unambiguous:

```text
IC4CPV01
|| U8 payload schema version
|| U8 phone normalizer version
|| U8 email normalizer version
|| U8 lookup-digest contract version
|| U16 phone count || repeated U16 length + UTF-8 bytes
|| U16 email count || repeated U16 length + UTF-8 bytes
```

Phone and email collections are normalized, deduplicated, and sorted by their
UTF-8 byte representation before serialization. Counts and element lengths are
explicit. The parser validates magic, every version, framing, ordering, and
trailing bytes, then requires canonical reserialization equivalence. Unknown
versions, raw text, malformed framing, and noncanonical ordering fail closed.

### 4.2 Phone V1

The implementation accepts only the frozen Vietnamese mobile forms beginning
with `0`, `84`, or `+84` and a mobile prefix in `3|5|7|8|9`. Supported ASCII
punctuation is removed and the result is always canonical `+84...`. Invalid
prefixes/lengths, extra plus signs, extensions, control characters, foreign
numbers, and Unicode/full-width digits fail `CONTACT_PHONE_INVALID` rather
than being guessed. Equivalent supported spellings collapse; non-equivalent
numbers do not.

### 4.3 Email V1

The implementation trims only the contract's outer ASCII spaces, preserves
local-part case, lowercases the domain, and validates a conservative ASCII
dot-atom/domain-label shape and byte bounds. It does not strip Gmail dots or
plus tags and does not infer IDNA/provider-specific equivalence. Malformed or
non-ASCII values fail `CONTACT_EMAIL_INVALID`.

The executable normalization/payload matrix passed for valid equivalence,
invalid and Unicode cases, deterministic ordering, deduplication, malformed
payloads, and version dispatch.

## 5. HMAC, domains, epochs, and key secrecy

Lookup evidence uses HMAC-SHA-256 with distinct constants:

```text
ichess.crm.contact.phone.lookup.v1
ichess.crm.contact.email.lookup.v1
```

The length-prefixed digest input binds the field domain/kind, contract and
normalizer versions, exact center, positive key epoch, and canonical value.
Phone and email evidence is therefore not substitutable, and equal business
values in different centers do not create cross-center authority. No unkeyed
production digest path was found.

Keys are fetched only inside a protected internal helper from the exact Vault
slot `f23_3e_p4a_contact_lookup_epoch_<epoch>`. A value must decode from
exactly 64 hexadecimal characters to 32 bytes. Key bytes, canonical values,
and raw lookup digests are absent from RPC results, Audit/Outbox payloads,
browser code, and logs. The key epoch is persisted with every evidence row;
there is no implicit interpretation using only the current epoch and no new
environment-fingerprint domain.

## 6. Rotation and re-ingestion

The applied lifecycle is bounded and explicit:

```text
ACTIVE -> PREPARING -> DUAL_READ -> RETIRING -> ACTIVE
```

Control writes are versioned and idempotency-bound. New ingest uses the
allowed target epochs for the current lifecycle. Activation cannot proceed
until canonical contacts have the required new-epoch projection. Retirement
cannot begin or complete while the previous epoch is still required by a
current Guardian dependency, and completion additionally rejects remaining
active old-epoch Contact evidence.

Re-ingestion is exact-center, admin-authorized, expected-version guarded,
epoch-aware, and atomic. It unwraps the protected canonical payload inside the
server scope, recreates only contract-valid evidence, and cannot reactivate a
retired row. Exact replay is stable; stale versions and conflicting intent fail
closed. Injected Audit and Outbox failures restore the complete pre-call state.

The late-Guardian test locks the same center control root used by rotation and
P3C identity operations, then proves retirement cannot pass a newly committed
dependency. An additional independent two-session probe observed the real
PostgreSQL waiter blocked by the root holder through `pg_blocking_pids`, after
which the transition completed deterministically when the holder released.

## 7. Guardian, P2, and exact-center compatibility

P4A writes the canonical flat digest projection to
`crm_contact.normalized_lookup_digests`. The accepted P3C Guardian search and
identity-mutex paths consume those exact persisted bytes; no second Guardian
normalizer, unkeyed digest, or reinterpretation path was introduced. Evidence
also binds center, field kind, version, epoch, and Contact identity.

P2/P3 compatibility remains fail closed: P4A does not change inherited search,
review, reservation, locking, or real-conversion semantics. Exact same
canonical values under different centers produce different evidence and do
not cross-authorize matching or reuse.

## 8. Ingress, replay, concurrency, and atomic evidence

All product-level contact inputs enter the service-only canonical ingress. The
server validates and normalizes them, selects current epoch state, derives
HMACs, serializes the payload, protects it with the accepted P3C source
envelope, and persists the projection. The caller cannot supply authoritative
digests, payload bytes, epoch truth, or crypto truth.

Exact semantic replay returns the stable existing Contact identity and
version. Reusing the same source/idempotency binding with changed semantic
input fails `INGRESS_CONFLICT`; it cannot create a second canonical Contact or
partial evidence. Per-center root and control locks serialize ingress,
re-ingestion, rotation, and applicable Guardian dependency changes. The QA
race matrix passed without duplicate or partial state.

Every mutation appends the accepted transactional Audit plus durable Outbox
pair. Fault injection at both event boundaries rolls back Contact, evidence,
control, and idempotency changes. Event and status results contain IDs,
versions, lifecycle state, and safe reason codes only; no phone/email plaintext,
key material, or raw evidence is exposed.

## 9. External security surface

Exactly four P4A RPCs are executable by `service_role`:

- `f23_3e_p4a_ingress_canonical_contact(text,uuid,text,text,text[],text[])`;
- `f23_3e_p4a_reingest_canonical_contact(text,uuid,uuid,integer)`;
- `f23_3e_p4a_transition_lookup_key_epoch(text,uuid,integer,text,integer)`;
- `f23_3e_p4a_read_contact_ingress_status(text,uuid,uuid)`.

They are `SECURITY DEFINER` with `search_path=''`. The migration revokes P4A
execution globally and regrants only these four exact signatures. Applied
catalog/effective-privilege checks found zero internal helpers executable by
`PUBLIC`, `anon`, `authenticated`, or `service_role`, and no external RPC
executable by `PUBLIC`, `anon`, or `authenticated`.

Real anonymous PostgREST requests to all four RPCs were denied. The two P4A
tables have forced RLS, no policies, no direct application-role DML/read
privileges, and no Realtime publication membership. No browser service-role or
digest-authority path was found. P4B remains responsible for a trusted bridge
that derives the server-side actor and center from authenticated truth.

## 10. Executed verification

```text
P4A guarded local Docker reset/apply and full QA: PASS
P4A normalization/payload matrix: PASS
P4A HMAC/domain/exact-center matrix: PASS
P4A ingress/replay/security matrix: PASS
P4A rotation/re-ingestion/Guardian compatibility: PASS
P4A fault rollback: PASS
P4A independent real center-root lock wait: PASS
P4A catalog/effective ACL checks: PASS
P4A anonymous PostgREST 4/4 denied: PASS
P4A RLS/policy/Realtime checks: PASS
P4A final reset/cleanup: PASS
node --check, P4/P4A and inherited semantic smokes: PASS
17/17 inherited migration hashes: PASS
P4A exact migration hash: PASS
P3D accepted migration hash unchanged: PASS
npm run build: PASS
git diff --check: PASS
mojibake/control-character/credential/PII hygiene: PASS
```

The build emitted only the existing nonblocking bundle-size warning. Final
reset proved zero synthetic Auth users, Vault secrets, P4A lookup evidence,
P4A-created Contacts, and temporary QA functions/triggers.

## 11. Modified inherited smokes and P4 readiness

Every one of the 14 tracked smoke diffs was inspected. Their changes remove
dependencies on superseded Roadmap/historical current-checkpoint literals and
replace them with durable current technical truth. Runtime migration hashes,
security surfaces, lifecycle semantics, provenance, atomicity, and prior phase
acceptance assertions remain in place. No invariant was replaced by a trivial
assertion.

The two P4 readiness artifacts now correctly treat canonical Contact lookup
normalization as closed by P4A. They leave the safe Auth-aware server bridge,
UI conversion wiring, protected legacy projection, and manual end-to-end QA to
P4B; they do not claim those product gates are complete.

## 12. Final acceptance

```text
PAYLOAD V1: PASS
PHONE NORMALIZATION: PASS
EMAIL NORMALIZATION: PASS
HMAC / DOMAIN SEPARATION: PASS
KEY EPOCH / ROTATION: PASS
RE-INGESTION: PASS
GUARDIAN / P2 COMPATIBILITY: PASS
EXACT-CENTER ISOLATION: PASS
REPLAY / CONCURRENCY: PASS
ACL / POSTGREST / RLS / REALTIME: PASS
AUDIT / OUTBOX / PRIVACY: PASS
LOCAL DOCKER QA: PASS
17 INHERITED HASHES: PASS
14 UPDATED SMOKES: PASS
P3D SHA UNCHANGED: YES

F23.3E-P4A TECHNICAL REVIEW: PASS
READY FOR CONDITIONAL P4A CHECKPOINT: YES
REMOTE APPLY/DEPLOY AUTHORIZATION: NO
P4B IMPLEMENTATION AUTHORIZATION: NO — NOT STARTED IN THIS REVIEW
```
