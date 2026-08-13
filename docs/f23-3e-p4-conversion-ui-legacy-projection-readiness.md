# F23.3E-P4 — Safe server bridge readiness

F23_3E_P4_STATUS: IN PROGRESS — P4A BACKEND/LOCAL VERIFIED

F23_3E_P4A_LOOKUP_NORMALIZATION_BLOCKER: CLOSED

F23_3E_P4_BRIDGE_BOUNDARY_AUDIT: PASS

F23_3E_P4_BRIDGE_IMPLEMENTATION: NOT STARTED

F23_3E_P4_UI_REAL_CONVERSION: NOT IMPLEMENTED

F23_3E_P4_LEGACY_PROJECTION: NOT IMPLEMENTED

F23_3E_P4A_LOCAL_INTEGRATION_QA: PASS

F23_3E_P4B_SAFE_SERVER_BRIDGE: NOT STARTED

F23_3E_P4_MANUAL_E2E: PENDING

F23_3E_P4_REMOTE_APPLY: NOT RUN

F23_3E_P4_DEPLOY: NOT RUN

F23_3E_P4_P3D_MIGRATION_CHANGED: NO

F23_3E_P4_SERVICE_ROLE_IN_BROWSER: NO

## Kết luận

Boundary server cho P4 đã được map và adversarial-check với source thật. P4A đã đóng canonical
Contact payload `IC4CPV01`, phone/email normalization, keyed lookup digest bind center+epoch,
rotation/re-ingestion và Guardian shared-digest contract; migration P4A cùng guarded local Docker QA
đã PASS. Browser vẫn không được cung cấp ciphertext/digest authoritative.

P4B chưa bắt đầu: JWT, exact-center membership, Supabase Auth AAL2, P2/P3 service RPC và P3D
immutable result là các primitive cho Edge bridge fail-closed, nhưng bridge/product ingress chưa được
deploy hay nối UI trong P4A.

P3D backend/local vẫn `DONE`, technical acceptance `PASS`; P4 chưa PASS và remote apply/deploy
vẫn chưa chạy.

## Physical contract map

### UI và browser hiện tại

- `src/main.js` nạp `parentConsultations` và `students` từ local storage.
- `buildParentConvertPreview(...)` trong `src/parent-consultation-module.js` chỉ tạo gợi ý local.
  Candidate này không phải P2B masked evidence hay P2C reviewed decision.
- CTA `Xác nhận chuyển đổi - chưa mở` vẫn disabled. Không có browser call tới P3D.
- `src/supabase-client.js` chỉ nạp publishable/anon key; service-role secret không có trong
  browser bundle.
- `src/cloud-db-sync.js` từ chối canonical CRM entity trên generic `center_cloud_entities`.
  Generic Student/Guardian không phải canonical projection.

### Auth và capability

- Existing Edge Functions chứng minh pattern `Authorization: Bearer <JWT>` → server `auth.getUser(token)`
  → server-side membership → service-role operation. Chúng chỉ là account-admin bridge, không
  phải conversion contract.
- Supabase Auth SDK hiện có `mfa.challengeAndVerify(...)` và
  `mfa.getAuthenticatorAssuranceLevel(jwt)`. Server có thể yêu cầu `currentLevel = aal2`,
  method `totp`, timestamp còn trong cửa sổ P3B hai phút, và UUID `session_id` của verified JWT.
- Local `supabase/config.toml` hiện tại vẫn tắt TOTP enrollment/verification. Bật local TOTP
  và thêm challenge UI là implementation step được phép sau khi ingress gate đóng;
  nó không chứng minh remote production Auth đã sẵn sàng.
- P3B `f23_3e_p3b_record_verified_conversion_step_up(...)` không tự verify Auth provider.
  Bridge phải derive `actor_user_id`, logical session, assurance, provider namespace,
  verification-reference digest và `server_verified_at`; không nhận boolean/timestamp tin cậy từ browser.
- P3B capability chỉ cho Owner/Center Admin phê duyệt cuối, bắt buộc separation of duties
  với requester/assigned consultant. Bridge không được gom hai actor thành một.

### Canonical ingress

- `crm_contact` yêu cầu `protected_contact_methods_ciphertext`, positive crypto version,
  `normalized_lookup_digests bytea[]` và positive `normalization_version`.
- P1D `f23_3e_p1d_create_crm_contact(...)` nhận sẵn ciphertext, crypto version, lookup digests và
  normalization version; nó chỉ kiểm shape rồi persist caller bytes. Nó không phải trusted product composer.
- P3C0 freeze `IC3CSE01`/`iC3Src01` và protected helper
  `f23_3e_p3c_internal_protect_contact_source_evidence(...)`, nhưng plaintext v1 cố ý là opaque
  payload. P3C0 yêu cầu future product ingress phải có separately audited composer và payload validation.
- P4A thêm protected normalizer/composer và HMAC lookup contract trong forward migration
  `202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql`.
  P3C Guardian search/mutex tiếp tục so sánh chính `normalized_lookup_digests`; P4A không tạo
  dummy/parallel digest path.
- `consultation_case_candidate_student.birth_evidence_protected` có P3D0/P3D protected path
  `IC3CBE01`/`iC3Bth01`. Candidate ingress có thể thu typed ISO `YYYY-MM-DD` trong authorized
  request, seal ngay trong protected SQL scope và không persist/log plaintext. Phần này không phải blocker.
- Stable source locator khả thi là exact-center `legacy_source_kind` + local Contact ID, với unique
  provenance index hiện có. Nó không thay thế lookup normalization authority.

### P2/P3 orchestration

Sau khi canonical ingress contract được đóng, Edge bridge có thể orchestration đúng
physical sequence mà không nới grant:

1. P1D/P1B tạo Contact, Case, Assignment, Candidate và Request theo exact-center/current versions.
2. P2B `f23_3e_p2b_search_masked_candidates(...)` trả masked evidence; không auto-merge.
3. P2C tạo review, ghi explicit human decision và chỉ reserve target cho
   `CREATE_NEW_REVIEWED`.
4. P3C materialize `PROPOSED`, finalize `REVIEWED`; exact replay dùng immutable result.
5. Owner/Admin khác requester hoàn tất provider step-up; server ghi P3B assertion, issue
   single-use authority, rồi gọi P3D atomic executor.
6. Replay/status đọc immutable idempotency result trước live terminal-state interpretation.

Browser chỉ gửi product form, opaque selection từ masked response, explicit review action và
client idempotency token. Actor, active center/role, source/current versions, policy, target truth,
step-up truth, authority và action set được server derive/recheck.

### Protected legacy projection

Initial safe projection có thể giới hạn cho active exact-center Owner/Admin và chỉ trả:

- immutable conversion outcome;
- canonical Student/Guardian/Relationship IDs và safe display labels được phép;
- navigation/cache key gắn canonical ID;
- `no-store` cho response nhạy cảm.

Nó không trả ciphertext, birth date, lookup/evidence digest, mutex, authority, raw action graph
hay service credential. Legacy UI adapter chỉ là refreshable projection cache; không ghi một
Student/Guardian local độc lập làm source of truth.

## Normative server bridge contract

Khi ingress gate đóng, P4 dùng một Edge Function hẹp, dự kiến
`crm-conversion-bridge`, với finite operations:

| Operation | Human actor | Server responsibility |
|---|---|---|
| `prepare` | Assigned consultant | Verify JWT/membership; idempotent canonical ingress; create/submit Request; return masked P2 search only. |
| `review` | Assigned consultant/reviewer permitted by current P2 contract | Re-read current source; persist explicit create/reuse/no-target decisions and reservations; materialize/finalize reviewed plan. |
| `approve_execute` | Different active Owner/Admin | Verify AAL2 TOTP freshness from provider; record P3B assertion; evaluate/issue authority; call P3D; return safe immutable projection. |
| `status` | Exact-center actor allowed by request/result scope | Read immutable status/projection; never reconstruct from mutable legacy state. |

All operations:

- are POST-only, verified-JWT, exact-center, server-owned and finite-error;
- reject client fields `actor_user_id`, trusted role, trusted center, reviewed flag, authority, action list,
  environment truth, step-up truth, ciphertext, digest, nonce or key;
- derive nested backend idempotency keys from a server domain + operation + exact resource + opaque
  client token; same token with semantic drift returns conflict;
- sanitize SQL/Auth errors and never log contact/birth plaintext;
- leave P2/P3 functions service-role-only and P3C/P3D internal helpers uncallable by app roles.

## P4A closure và next boundary

P4A đã freeze và verify sáu điểm trước đây unresolved: Vietnamese-mobile/email V1, deterministic
multi-value payload, separate phone/email HMAC domains, Vault key epoch, bounded dual-read rotation,
và fail-closed re-ingestion của canonical P4A Contact. P3C0 encryption/AAD và mọi inherited
migration giữ nguyên.

Next gate là P4B safe server bridge + Auth-provider step-up integration. P4B phải dùng bốn RPC P4A
service-only từ trusted server, không nới grant cho browser, sau đó mới nối UI conversion/projection.

```text
F23.3E-P4A DONE backend/local verified — READY FOR F23.3E-P4B
```
