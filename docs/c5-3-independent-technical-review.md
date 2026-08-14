# C5.3 — Independent Technical Review

## Verdict

```text
C5_3_INDEPENDENT_TECHNICAL_REVIEW: PASS
CRITICAL_OPEN: 0
HIGH_OPEN: 0
BLOCKING_MEDIUM_OPEN: 0
CHECKPOINT_DECISION: PASS
REMOTE_SUPABASE_AUTH_EDGE_APP_DEPLOY: NOT RUN
C5_4_IMPLEMENTATION: NOT STARTED
```

Review targeted ngày 2026-08-14, không chạy full historical smoke sweep.

## Findings và remediation

| ID | Mức ban đầu | Finding | Remediation | Trạng thái |
|---|---|---|---|---|
| C5.3-R1 | HIGH | CRM disk cache theo center có thể bị account/role khác trên cùng browser xem trước khi RPC deny | Bỏ disk-cache read/write, purge legacy center cache, memory projection chỉ nhận sau per-session authoritative pull; access deny xóa CRM view/form/derived notification | RESOLVED |
| C5.3-R2 | MEDIUM blocking | Phone/email có thể đi vòng protected boundary qua Contact/Candidate display name | Authenticated wrapper server-side reject protected pattern cho `display_name` và `lead_student_name` | RESOLVED |
| C5.3-R3 | MEDIUM blocking | C5.3 Candidate insert/update chưa có audit/outbox riêng | C5.3-scoped trigger ghi canonical transactional audit/outbox cho Candidate create/update | RESOLVED |

Không còn finding mở ở ngưỡng checkpoint.

## Root-cause closure và authority

Root cause Owner→Admin đã được loại: `parentConsultations` không còn là
browser authority. Owner create gọi authenticated exact-center command; server dùng
P4A Contact ingress, P1D Case service và canonical Candidate/state rows; Admin cùng
center liệt kê lại aggregate từ `c5_3_list_crm_shared_truth`. Server empty
thì view empty, không fallback/union/upload local.

Authority verdict:

| Aggregate | Physical server authority | Verdict |
|---|---|---|
| Contact | P4A `crm_contact` + protected evidence | PASS |
| Consultation Case | P1A/P1D `consultation_case` | PASS |
| Candidate | canonical `consultation_case_candidate_student`, version + audit/outbox | PASS |
| Care Log | P1D `crm_care_log`, immutable actor/server time/order | PASS |
| Appointment | typed `crm_case_appointment`, exact Case/center/version | PASS |
| Assignment | P1D assign/reassign + active consultant membership | PASS |
| Durable enrollment state | versioned `crm_case_shared_state.safe_state` allowlist | PASS |

Ba C5.3 table bổ sung chỉ là one-to-one Case state, typed appointment và
command result ledger. Không có Contact/Case authority thứ hai cạnh P1–P4A.

## Identity và security verdict

- Phone/email chỉ đi vào P4A normalization/encrypted evidence; list và browser
  projection trả phone/email rỗng, `MASKED_PROTECTED`, identity read-only.
- Shared state, summaries, care content, appointment text/technical IDs và review-
  hardened display names đều fail closed khi chứa protected phone/email.
- P4A source identity conflict không silent merge/overwrite. Candidate là exact Case
  evidence, không tạo/link canonical Student.
- RPC tự lấy `auth.uid()`, active center + active exact membership; client không
  khai actor/role. Owner/admin/center_admin/qtv có admin writes; consultant backend
  chỉ read/care/appointment exact active assignment; teacher/viewer/anon/wrong-center
  bị deny.
- New tables `ENABLE` + `FORCE RLS`, không direct policies; table/internal-function
  access bị revoke kể cả authenticated/service_role. Public RPC surface chỉ grant
  authenticated và dùng `SECURITY DEFINER`, `search_path=''`.

Identity/security verdict: PASS.

## Multi-account, center và fresh context

- A Owner create Lead/Case → B center_admin pull thấy cùng masked canonical row.
- B edit enrollment, add Care Log, Appointment, Assignment → A pull thấy cùng truth.
- Fresh authenticated context với empty storage reconstruct Lead/Case, Care Log,
  Appointment, Assignment và durable enrollment state.
- Different-center read/write leak `0`; PostgreSQL exact-center checks là boundary.
- Owner A→B→A clear memory projection và pull từng center; không copy,
  merge, backfill, fallback hay union.
- Legacy local CRM bị purge/ignore, không silent upload/merge.

Same-center verdict: PASS. Fresh-context verdict: PASS. Cross-center verdict: PASS.
Owner-switch verdict: PASS.

## Authority order, refresh và failure safety

Durable writes theo thứ tự: UI intent → authenticated server command → commit →
authoritative pull → memory projection → UI success. Không có production path
`saveStoredParentConsultations`; local form helpers chỉ tạo transient intent.

C5.3 không publish CRM Realtime. Module open, reopen, nút `Làm mới` và mỗi
successful mutation đều pull authoritative state. Refresh failure hiển thị error;
authorization/root failure xóa projection thay vì giữ cache vượt ACL.

Network/server failure không thay memory/disk business state và không đóng form
thành công. Nếu commit xong nhưng pull lỗi, UI trả
`COMMITTED_PROJECTION_REFRESH_FAILED`, giữ exact command/key để retry và không
giả local success.

Refresh verdict: PASS. Failure-safety verdict: PASS.

## Version, conflict và idempotency

Case, shared state, Candidate, Appointment và Assignment đều có expected/current
version gate. Stale N sau khi B commit N+1 trả finite conflict, không overwrite.
Command ledger khóa `(center_id, actor_user_id, idempotency_key)` với full intent
digest: exact replay trả committed snapshot; changed intent trả
`IDEMPOTENCY_CONFLICT`. Create còn có stable local-source conflict; Care Log,
Appointment và Assignment có canonical resource/business uniqueness guards.

Conflict/idempotency verdict: PASS.

## Audit / Outbox

P1D typed Case/Care/Assignment transitions giữ transactional audit/outbox. C5.3
Appointment và Case shared-state changes dùng cùng P1D append contract. Review
hardening bổ sung Candidate create/update audit/outbox cùng transaction; không tạo
audit system thứ hai. QA xác nhận không có protected phone/email trong
audit/outbox.

Audit/outbox verdict: PASS.

## Migration identity và inherited integrity

```text
202608140003_c5_3_crm_authoritative_shared_truth.sql
SHA-256: 200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80

202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql
SHA-256: 8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247
```

Migration gốc `140003` không bị sửa trong review. Semantic hash gate xác nhận
22 inherited/frozen migrations P1–P4B/C5.1/C5.2 byte-identical: PASS.

## Targeted evidence

```text
C5.3 semantic smoke: PASS
C5.3 guarded local DB QA after remediation: PASS
C5.3 final local DB reset: PASS
P1A/P1D/P1E/P4A/P4B semantic regressions: PASS
compact C5.1/C5.2 regressions: PASS
production build: PASS
changed JavaScript node --check: PASS
git diff --check: PASS
secret/hygiene scan: PASS
full historical smoke sweep: NOT RUN (by scope)
remote apply/deploy: NOT RUN
```

## Open/deferred

- CRM Realtime không thuộc C5.3; refresh convergence là contract được duyệt.
- Protected Contact identity edit và Assignment unassign cần workflow riêng.
- F23.3E-P4B vẫn `FROZEN / NOT DONE`; conversion UX, step-up, identity decisions
  và atomic conversion semantics không bị sửa hay tuyên bố hoàn tất.

Không mục deferred nào là blocking C5.3 finding.

```text
C5.3 TECHNICAL REVIEW PASS — CHECKPOINT AUTHORIZED
```
