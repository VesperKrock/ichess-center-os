# F23.3E-P4B — Safe Server Bridge, Auth Step-Up, Conversion UI và Legacy Projection

## Trạng thái

```text
F23_3E_P4B_IMPLEMENTATION: IMPLEMENTED
F23_3E_P4B_LOCAL_DOCKER_QA: PASS
F23_3E_P4B_SEMANTIC_SMOKE: PASS
F23_3E_P4B_INHERITED_REGRESSIONS: PASS
F23_3E_P4B_MIGRATION_SHA256: 677156C5393BA813B6B95E52BC0ECE6F8C79672AF43DD5ED649BF57EA9E9959F
F23_3E_P4B_FINAL_TECHNICAL_AUDIT: NOT RUN
F23_3E_P4B_MANUAL_PRODUCT_E2E: PAUSED / NOT ACCEPTED
F23_3E_P4B_REMOTE_APPLY_DEPLOY: NOT RUN
F23_3E_P4B_STATUS: FROZEN / MANUAL PRODUCT E2E PENDING
```

P4B nối preview CRM F23.3D tới backend canonical đã được chấp nhận, nhưng không biến browser thành trusted runtime. Kết quả local chứng minh bridge, Auth-provider TOTP, P4A ingress, P2 review, P3 plan/authority/executor và projection hoạt động cùng nhau. Manual product E2E đã bị tạm dừng, chưa được chấp nhận; external technical review, remote apply và deploy vẫn chưa chạy.

## Contract thực thi

Luồng tin cậy:

```text
browser JWT + form + lựa chọn người dùng
→ Edge Function crm-conversion-bridge
→ Auth getUser(token)
→ active exact-center membership + role
→ service-only P4B RPC
→ P4A Contact ingress
→ P1 Case/Candidate/Request
→ P2B search + P2C explicit review/reservation
→ P3C materialize/finalize
→ Auth-provider AAL2/TOTP freshness
→ P3B account control/step-up/authority
→ P3D atomic executor
→ protected safe projection
```

Browser không nhận service-role key, Vault secret, lookup digest, ciphertext, mutex, action digest, conversion capability hay conversion authority. Edge bỏ qua hoặc từ chối mọi field cố khai actor/role/reviewed/step-up/digest/ciphertext. Actor và center được derive từ JWT đã `auth.getUser` xác minh và membership hiện tại.

## Server bridge

Edge Function: `supabase/functions/crm-conversion-bridge/index.ts`.

API hữu hạn:

- `prepare`: consultant đúng cơ sở; canonical ingress, source workflow và masked search.
- `review`: đúng consultant đã prepare; explicit Student/Guardian/relationship decision; không auto-merge.
- `approve_execute`: Owner/center_admin khác requester/assigned consultant; JWT phải `aal2`, AMR phải có `totp` trong 120 giây và Auth Admin phải thấy verified TOTP factor.
- `status`: safe immutable status/result; consultant chỉ đọc phiên do chính mình prepare, Owner/Admin đọc trong exact center.

Edge tự derive authority-environment fingerprint, account evidence, verification-reference digest và idempotency digests. Browser chỉ gửi opaque retry token. Thiếu JWT, sai center/role, AAL1, TOTP stale, actor không tách hoặc semantic retry drift đều fail closed bằng mã hữu hạn; raw SQL/stack/secret không trả về UI.

## Forward migration P4B

Migration `202608130002_f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection.sql` tạo đúng một orchestration aggregate `crm_conversion_bridge_session`; không tạo lại Student, Guardian, relationship hoặc P1–P4A aggregate.

Table bridge forced RLS, zero policy, zero Realtime và không có direct privilege cho anon/authenticated/service_role. Mọi helper `f23_3e_p4b_internal_%` bị revoke khỏi toàn bộ app roles.

Exactly four `SECURITY DEFINER`, `search_path=''`, service-role-only RPC:

1. `f23_3e_p4b_prepare_conversion(...)`
2. `f23_3e_p4b_review_conversion(...)`
3. `f23_3e_p4b_approve_execute_conversion(...)`
4. `f23_3e_p4b_read_conversion_status(uuid,uuid)`

Session snapshot giữ masked search, reviewed result và safe projection để replay không reconstruct từ mutable live rows. Same source và same semantic idempotency trả snapshot cũ; cùng key/subject nhưng payload đổi trả `P4B_IDEMPOTENCY_CONFLICT`.

## Prepare và review

`prepare` gọi P4A để normalize/protect Contact, sau đó tạo Case, Assignment, Candidate với protected Candidate birth envelope, Request và P2B searches. Birth plaintext chỉ tồn tại trong protected server call; không đi vào Audit/Outbox/result.

`review` luôn đi qua P2C:

- `CREATE_NEW`: chỉ hợp lệ sau complete `NO_MATCH`, rồi tạo ACTIVE reservation.
- `REUSE_EXISTING`: bắt buộc chọn masked canonical candidate và exact target version; P2C/P3D recheck cross-source reuse authorization.
- `DO_NOT_CREATE`: là explicit reviewed no-target; nếu P2B có candidate thì người dùng phải chỉ rõ candidate đang từ chối.

Relationship decision là explicit. Khi một endpoint no-target, bridge bắt buộc `DO_NOT_CREATE_RELATIONSHIP`. Materialize tạo PROPOSED, finalize chuyển REVIEWED +1 trước khi digest; không approve/execute ở review step.

## Auth-provider step-up và actor separation

Local Auth dùng TOTP thật (`auth.mfa.enroll`, `challengeAndVerify`). Edge kiểm:

- verified token subject;
- JWT `aal=aal2`;
- UUID `session_id`;
- AMR method `totp` không cũ hơn 120 giây, không quá 30 giây tương lai;
- ít nhất một TOTP factor `verified` từ Auth Admin truth.

Sau đó DB vẫn recheck exact-center owner/admin, unique active membership và actor khác requester/assigned consultant trước khi P3B ghi step-up/authority. Browser boolean `step_up=true` không tồn tại trong contract. `supabase/config.toml` chỉ bật TOTP cho local CLI stack; không thay Auth production.

## Atomic execution và projection

P4B không sửa semantics P3D. First execution gọi đúng P3B authority rồi P3D atomic executor; lỗi P4B Audit/Outbox cuối transaction rollback cả target, binding, relationship, terminal state và authority.

Safe projection chỉ chứa:

- conversion status/request version/correlation;
- canonical Student ID/version/display name/status;
- canonical Guardian ID/version/display name/status;
- relationship ID/version/type/role/status;
- marker `read_only=true`.

Không chứa phone, email, birth, digest, ciphertext, mutex, policy internals hoặc step-up evidence. Projection được sessionStorage cache riêng, có canonical ID, refreshable và chỉ đọc. Nó được ghép vào UI Học viên khi render nhưng không bao giờ gọi `saveStoredStudents`; vì vậy không sinh một local Student/Guardian độc lập.

## UI

Preview F23.3D được giữ nguyên. Modal thêm khối canonical:

- ngày sinh đầy đủ và nút prepare;
- masked search + explicit create/reuse/no-target decisions;
- relationship decision;
- Owner/Admin TOTP factor + one-time code;
- loading, finite error, refresh/replay và completed projection.

Double click bị chặn bằng busy state nhưng backend idempotency vẫn là authority. Reload/open lại đọc envelope theo exact center + source ID rồi gọi `status`; nó không blind-execute một conversion mới. Student projection hiển thị trong module Học viên ở chế độ read-only; edit/avatar/delete bị khóa.

## Guarded local QA

Runner: `tests/f23-3e-p4b-safe-server-bridge-auth-step-up-conversion-ui-legacy-projection-local-db-qa.js`.

Safety guard yêu cầu `ICHESS_P4B_LOCAL_QA_ALLOW_RESET=YES`, local status loopback và exact Docker project/container labels. Không có linked/fallback/remote path.

Đã chứng minh trên local Edge + Auth thật:

- missing/invalid JWT, wrong center, wrong role, direct protected RPC và fake browser authority fail closed;
- exact function/table ACL, forced RLS, zero Realtime;
- provider-issued AAL2/TOTP freshness và actor separation;
- genuine create Student + Guardian + relationship;
- genuine independent source B → masked match → explicit reviewed reuse → cùng canonical targets, binding riêng;
- rapid concurrent double execute trả first result + immutable replay, không duplicate;
- explicit no-target cho Student/Guardian/relationship;
- injected P4B Outbox failure rollback toàn P3/P4B transaction;
- safe status replay và no plaintext/protected evidence leak;
- stale step-up bị chặn trước authority mutation;
- final reset đưa Auth, Vault, bridge, Student, Guardian, relationship và temporary QA artifacts về baseline 0.

P4A SHA vẫn `1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC`; P3D SHA vẫn `F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3`. Không checkpoint migration kế thừa nào bị sửa.

## Checklist manual product E2E (PENDING)

1. Đăng nhập consultant đúng cơ sở, mở một khách tư vấn mới và preview.
2. Nhập ngày sinh đầy đủ, chạy “Chuẩn bị trên server”, xác nhận masked search không lộ dữ liệu.
3. Với khách mới, chọn tạo Student/Guardian và tạo quan hệ.
4. Đăng xuất consultant; đăng nhập Owner/Admin khác actor, có TOTP verified.
5. Nhập TOTP mới, execute và xác nhận success projection.
6. Mở module Học viên: canonical Student xuất hiện dạng chỉ đọc; không sửa/xóa được.
7. Reload, mở lại khách và “Tải lại trạng thái”; không có Student/Guardian/relationship thứ hai.
8. Double-click/retry execute; kết quả phải là replay cùng canonical ID.
9. Tạo source B cùng identity; kiểm tra masked candidates, explicit reuse và binding B độc lập.
10. Thử explicit no-target khi có candidate và xác nhận phải chọn candidate bị từ chối.
11. Thử consultant tự approve, AAL1, mã TOTP sai/hết freshness, wrong center và role không đủ.
12. Xác nhận các CRM add/detail/care-log/preview cũ và Student local CRUD không regression.

## Manual product E2E ngày 2026-08-13 — PAUSED / NOT ACCEPTED

P4B được đóng băng để giữ nguyên implementation và automated QA đã PASS, nhưng không được gọi là DONE. Manual QA phát hiện ba vấn đề sản phẩm cần xử lý ở C5 trước khi quay lại:

1. Khách CRM do Owner tạo chưa hiển thị nhất quán cho Admin cùng cơ sở.
2. Nhiều module nghiệp vụ cùng cơ sở vẫn có dấu hiệu dùng trạng thái riêng của từng browser/account thay vì source-of-truth dùng chung.
3. UI conversion còn lộ thuật ngữ kỹ thuật và cần được đơn giản hóa cho người dùng cuối.

Các finding này không phủ định security/atomicity đã chứng minh bằng automated local QA, nhưng chặn manual product acceptance và rollout.

## Boundary và next gate

P4B hiện ở trạng thái `FROZEN / MANUAL PRODUCT E2E PENDING`, không phải DONE. Sau khi C5 hoàn tất phải quay lại P4B trước mọi feature khác, chạy lại manual product E2E rồi mới independent technical review/checkpoint. Không được suy ra external technical audit PASS, production PASS hoặc remote rollout. Remote migration apply, Edge deploy, production Auth config và app deploy đều `NO`.
