# F23.3E-P4A — Canonical Contact Ingress & Lookup Normalization Foundation

## Status, scope và kết luận

```text
F23_3E_P4A_IMPLEMENTATION: IMPLEMENTED
F23_3E_P4A_LOCAL_DOCKER_QA: PASS
F23_3E_P4A_SEMANTIC_SMOKE: PASS
F23_3E_P4A_INHERITED_REGRESSIONS: PASS
F23_3E_P4A_MIGRATION_SHA256: 1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC
F23_3E_P4A_FINAL_TECHNICAL_AUDIT: NOT RUN
F23_3E_P4A_REMOTE_APPLY_DEPLOY: NOT RUN
F23_3E_P4A_PRODUCT_CONTACT_INGRESS: DEFERRED TO P4B SAFE SERVER BRIDGE
F23_3E_P4A_STATUS: DONE backend/local verified — READY FOR F23.3E-P4B
```

P4A sở hữu đúng một forward migration và ba artifact kiểm chứng. Phase này đóng contract normalization/lookup và cung cấp backend service-only foundation. Nó không mở browser RPC, không triển khai Edge bridge, không đổi P3D, không tạo Guardian/Student/Relationship, không apply remote và không nối UI real conversion.

## Repo truth và boundary kế thừa

- `public.crm_contact` đã có ciphertext opaque, `normalized_lookup_digests bytea[]`, `normalization_version`, versioning và exact legacy provenance nhưng P1D cho caller truyền ciphertext/digest; chưa có canonical product ingress.
- P3C0/P3C đã freeze Contact source envelope `IC3CSE01`, KDF slot `iC3Src01`, crypto version `2`, P3C crypto-environment fingerprint và protected unwrap/re-protect. P4A gọi đúng protected helpers này, không thay crypto architecture.
- Guardian search và mutex P3C đọc đúng `crm_contact.normalized_lookup_digests`; vì vậy P4A flat projection là shared lookup contract cho cả matching và mutex, không có digest path thứ hai.
- `guardian_profile.normalized_lookup_digests` và `crm_identity_target_binding.target_version_at_binding` là frozen provenance. P4A không mutate Guardian hoặc binding khi rotate Contact lookup key.
- P3D accepted migration và SHA không đổi. P4A không gọi conversion executor.

## Canonical Contact payload V1

### Input set

- Tối đa 5 phone và 5 email sau dedupe.
- Null/ASCII-space-only item là absent.
- Bất kỳ nonblank item invalid làm fail toàn transaction.
- Phải còn ít nhất một method sau normalization.
- Dedupe rồi sort theo byte UTF-8 tăng dần; thứ tự browser không ảnh hưởng payload.

### Phone normalization V1

V1 chỉ nhận số di động Việt Nam có prefix `3|5|7|8|9`:

```text
0[35789][0-9]{8}
84[35789][0-9]{8}
+84[35789][0-9]{8}
```

Chỉ cho phép digit ASCII và các separator ASCII space, `.`, `-`, `(`, `)`. Separator bị loại bỏ; output luôn `+84[35789][0-9]{8}`. Unicode digit, extension, nhiều dấu `+`, international number ngoài V1, control char và length sai fail `CONTACT_PHONE_INVALID`. V1 không suy đoán country code.

### Email normalization V1

- ASCII only, trim ASCII space ngoài cùng.
- Local part giữ nguyên case; domain lowercase.
- Đúng một `@`, local 1–64 byte, tổng tối đa 254 byte.
- Local dùng conservative dot-atom; cấm dot đầu/cuối/liên tiếp.
- Domain là ASCII labels 1–63, cấm empty label và hyphen đầu/cuối, phải có ít nhất một dot.
- Không Gmail-specific dot/plus folding; không IDNA/Unicode guessing.

Invalid input fail `CONTACT_EMAIL_INVALID`.

### Binary payload serializer

Payload plaintext chỉ tồn tại trong protected SQL scope và được P3C bọc thành Contact source envelope:

```text
ASCII("IC4CPV01")
|| U8(payload_schema_version = 1)
|| U8(phone_normalization_version = 1)
|| U8(email_normalization_version = 1)
|| U8(lookup_digest_contract_version = 1)
|| U16(phone_count)
|| repeated U16(utf8_length) || UTF8(canonical_phone), sorted
|| U16(email_count)
|| repeated U16(utf8_length) || UTF8(canonical_email), sorted
```

Parser reserialize-compare toàn payload. Raw UTF-8, JSON, unknown magic/version, noncanonical order hoặc trailing bytes đều fail closed.

## Keyed lookup digest contract V1

### Key ownership

- Vault name: `f23_3e_p4a_contact_lookup_epoch_<positive integer>`.
- Secret value phải đúng 64 hex chars, decode thành 32 bytes.
- Migration không chứa key, không tạo secret, không expose key/digest cho app role.
- Lookup-key epoch không phải environment fingerprint thứ tư. Authority, P2B identity-policy và P3C crypto environment domains vẫn độc lập.

### Domains và serializer

Phone domain:

```text
ichess.crm.contact.phone.lookup.v1
```

Email domain:

```text
ichess.crm.contact.email.lookup.v1
```

HMAC-SHA-256 input:

```text
LP32(UTF8(domain))
|| U8(digest_contract_version = 1)
|| U32(normalizer_version = 1)
|| U32(key_epoch)
|| LP32(UTF8(center_id))
|| LP32(UTF8(canonical_value))
```

Center binding làm cùng value ở hai center sinh digest khác. Phone/email dùng domain khác. `crm_contact.normalized_lookup_digests` là sorted-unique union của toàn ACTIVE evidence thuộc supported active epochs.

## Persisted foundation

### `public.crm_contact_lookup_control`

Exactly one row per center, protected RLS/no policies, chứa version V1, current/previous/pending key epoch, rotation state và `control_version`.

Lifecycle hữu hạn:

```text
ACTIVE(N)
→ PREPARING(current N, pending N+1)
→ DUAL_READ(previous N, current N+1)
→ RETIRING(previous N, current N+1)
→ ACTIVE(N+1)
```

Không skip/reuse epoch, không giữ quá current+previous, không mở rotation mới khi lifecycle chưa terminal.

### `public.crm_contact_lookup_evidence`

Persist duy nhất safe metadata/digest:

- exact center + Contact;
- `PHONE|EMAIL`;
- normalizer/digest version `1`;
- key epoch;
- 32-byte lookup digest;
- `ACTIVE → RETIRED` exact +1; no delete/reactivation.

Không có plaintext method. Deferred constraint chứng minh flat Contact digest projection bằng exact sorted ACTIVE evidence và canonical rows dùng Contact crypto version 2.

## Rotation và re-ingestion

1. `BEGIN_ROTATION(N+1)` kiểm Vault key và chuyển `ACTIVE → PREPARING`.
2. Admin re-ingest mọi canonical P4A Contact; PREPARING materializes N và N+1.
3. `ACTIVATE_ROTATION` chỉ PASS khi mọi active P4A Contact có evidence ở cả hai epoch.
4. DUAL_READ ingress/re-ingest giữ N và N+1 để Guardian lookup/mutex tiếp tục match.
5. `BEGIN_RETIREMENT` fail `LOOKUP_EPOCH_DEPENDENCY_ACTIVE` nếu bất kỳ non-archived Guardian nào còn chứa digest epoch N.
6. Khi không còn dependency, RETIRING re-ingest Contact chỉ giữ N+1 và retires N evidence.
7. `COMPLETE_RETIREMENT` khóa lại center root, recheck Guardian dependency và chỉ PASS khi không còn ACTIVE evidence epoch N.

V1 cố ý fail closed thay vì tự mutate Guardian/binding. Nếu Guardian dependency còn tồn tại, rollout key mới có thể ở DUAL_READ an toàn nhưng epoch cũ chưa được retire. Một target-rekey/binding-supersession contract riêng phải được audit trước khi bỏ dependency đó.

## External service surface

Exactly four `SECURITY DEFINER`, `search_path=''`, service-role-only RPC:

1. `f23_3e_p4a_ingress_canonical_contact(text,uuid,text,text,text[],text[])`
2. `f23_3e_p4a_reingest_canonical_contact(text,uuid,uuid,integer)`
3. `f23_3e_p4a_transition_lookup_key_epoch(text,uuid,integer,text,integer)`
4. `f23_3e_p4a_read_contact_ingress_status(text,uuid,uuid)`

All `f23_3e_p4a_internal_%` helpers bị revoke khỏi PUBLIC/anon/authenticated/service_role. Hai table mới forced RLS, zero policy, no Realtime publication và zero direct app-role privileges.

P4B trusted server bridge phải authenticate browser JWT rồi derive actor/center từ server truth trước khi gọi service RPC. P4A không cho phép browser nhận hoặc gọi bằng service-role key.

## Ingress semantics

- Source namespace V1: `local.parent_consultation.v1` + exact center + opaque local source record ID.
- Active exact-center membership role owner/admin/center_admin/qtv/consultant; center CRM phải ACTIVE/ENABLED.
- Server normalizes, serializes, reads Vault key, derives digests, inserts protected Contact/evidence và Audit+Outbox atomically.
- Same source + same semantic payload returns exact existing Contact (`replayed=true`) without second event/version.
- Same source + changed payload fails `INGRESS_CONFLICT`; update requires explicit future workflow, never silent overwrite.
- Output only safe opaque ID/version/correlation; no normalized plaintext/digest/ciphertext.

Admin-only re-ingestion unwraps only canonical `IC4CPV01` inside protected SQL, re-derives the target epoch set, atomically replaces flat projection and retires obsolete evidence. Exact desired state is a no-op replay.

## Guardian matching/mutex compatibility

P4A does not replace P3C Guardian code. It preserves its physical contract:

- canonical Guardian copies Contact `normalized_lookup_digests` at composition;
- canonical Guardian search uses exact-center GIN overlap;
- `f23_3e_p3c_internal_identity_mutex_keys` derives `GUARDIAN_CONTACT_LOOKUP_DIGEST` from the same Contact array;
- dual-read arrays make matching and mutex use the identical current+previous epoch set;
- no legacy opaque Contact is silently upgraded. Only P4A-ingressed canonical payloads can re-ingest.

## Audit/Outbox and privacy

Mutating operations append matching transactional P1/P3 Audit+Outbox events through `f23_3e_p3b_internal_append_audit_outbox`:

- `crm.contact.canonical_ingressed`
- `crm.contact.lookup_reingested`
- `crm.contact.lookup_epoch_transitioned`

Payload uses only allowlisted resource IDs, versions, status, operation, outcome, safe reason and correlation. Phone/email plaintext, digest, key epoch secret, ciphertext and crypto fingerprint never enter Audit/Outbox/result.

## Adversarial contract audit

| Attack/failure | Frozen outcome |
|---|---|
| Caller supplies digest/ciphertext/key | Không có parameter; server derives |
| Same value cross-center | Different HMAC input/digest |
| Unicode digit/IDNA ambiguity | Fail closed V1 |
| Input order/dedup variance | Same deterministic payload |
| Key missing/duplicate/malformed | `LOOKUP_KEY_UNAVAILABLE`, rollback |
| Unknown Contact payload | `CONTACT_PAYLOAD_UNSUPPORTED`, no upgrade |
| Semantic replay drift | `INGRESS_CONFLICT` |
| Rotation activates before all Contacts re-ingest | `LOOKUP_ROTATION_REINGEST_INCOMPLETE` |
| Retire epoch used by Guardian | `LOOKUP_EPOCH_DEPENDENCY_ACTIVE` |
| Guardian được tạo sau begin-retirement | Completion recheck cùng center root, vẫn fail closed |
| Direct table/helper call by app role | ACL/RLS deny |
| Audit/Outbox fault | Whole ingress/re-ingest/transition rollback |
| P3D/Guardian checkpoint drift | No inherited migration is modified |

## Local QA gate

Guarded runner must prove loopback-only Supabase/Docker before reset. Required coverage:

- fresh reset and exact P4A migration application;
- payload permutation/dedup equality and strict phone/email negative matrix;
- key domains, center separation, epoch separation and deterministic digest;
- ingress first call/replay/conflict/cross-center/inactive-role denial;
- forced RLS/table ACL/internal helper ACL/service RPC ACL and anon PostgREST denial;
- protected envelope V2 and no plaintext persistence/Audit/Outbox leak;
- PREPARING re-ingest, activation, dual-read Guardian search/mutex compatibility;
- Guardian dependency blocks retirement; nondependent rotation completes;
- Audit/Outbox/idempotent event counts and injected rollback;
- final reset: synthetic Auth/Vault/P4A Contact/evidence/temp QA artifacts baseline zero.

Docker local QA is evidence backend/local only. Remote apply, product ingress bridge, deploy và manual product E2E vẫn NOT RUN.

## Phase boundary và next gate

P4A PASS chỉ có nghĩa canonical Contact ingress/lookup foundation backend-local đã verified. P4B tiếp theo phải triển khai trusted Auth/step-up server bridge và product ingress orchestration; nó không được nới grants hoặc đưa service-role vào browser.
