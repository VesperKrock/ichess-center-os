# C5.3 — CRM Authoritative Shared Truth

## Trạng thái

```text
C5_3_IMPLEMENTATION: COMPLETE
C5_3_GUARDED_LOCAL_DB_QA: PASS
C5_3_SEMANTIC_SMOKE: PASS
C5_3_TARGETED_REGRESSIONS: PASS
C5_3_BUILD_HYGIENE: PASS
C5_3_INDEPENDENT_REVIEW_HARDENING: PASS
C5_3_REMOTE_APPLY_DEPLOY: NOT RUN
F23_3E_P4B: FROZEN / NOT DONE
```

Migration mới:

`supabase/migrations/202608140003_c5_3_crm_authoritative_shared_truth.sql`

Independent-review hardening:

`supabase/migrations/202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql`

SHA-256:

`200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80`

Hardening SHA-256:

`8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247`

## Physical cause của split-brain

`parentConsultations` trước C5.3 chỉ được lưu trong localStorage theo
center. Generic cloud sync không có entity CRM này. P4B chỉ ingress một
Contact khi người dùng chủ động bắt đầu conversion prepare; nó không publish
lead list. Vì vậy Owner tạo lead chỉ thay đổi storage của browser Owner,
Admin cùng center không có server row để bootstrap và không thể thấy lead.

C5.3 thay đường local-first bằng hai RPC authenticated: mutation commit
canonical aggregate trước; sau commit browser pull lại exact-center projection rồi
mới thay memory projection. Server trả danh sách rỗng thì view trở thành
rỗng, không upload/merge legacy local rows.

## Canonical reuse và physical truth

C5.3 không tạo CRM thứ hai. Aggregate dùng lại:

- P4A `crm_contact` ingress cho Contact, normalization và protected phone/email;
- P1A `consultation_case`, Candidate, Assignment và `crm_care_log`;
- P1D typed create/transition/care/assign/reassign và transactional audit/outbox;
- P1E/P2/P3 identity/security invariants; P4B conversion bytes giữ nguyên.

Ba C5.3 table chỉ bổ sung phần chưa có trong canonical model:

| Table | Vai trò | Khóa authority |
|---|---|---|
| `crm_case_shared_state` | durable list/business/enrollment draft state | exact `(center_id, consultation_case_id)`, versioned |
| `crm_case_appointment` | lịch hẹn typed | exact center + Case, versioned, client/source idempotency |
| `crm_shared_command_result` | command replay ledger | `(center_id, actor_user_id, idempotency_key)` |

Enrollment state authoritative gồm readiness, chương trình, lịch mong muốn,
mục tiêu, level, trial references, ngày dự kiến, note và advisor. Tên Contact
và Candidate nằm trong canonical identity rows. Phone/email và student binding
không bị sao chép vào shared JSON.

## Write/read contract

```sql
public.c5_3_list_crm_shared_truth(p_center_id text) returns jsonb
public.c5_3_mutate_crm_shared_truth(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
) returns jsonb
```

Mutation chỉ nhận sáu operation hữu hạn: `CREATE_LEAD`, `SAVE_CASE`,
`APPEND_CARE_LOG`, `UPSERT_APPOINTMENT`, `ASSIGN_CASE`, `ARCHIVE_CASE`.
`SAVE_CASE` dùng P1D transition service khi status thay đổi; không bypass
canonical state machine hoặc active-assignment guard.

Mọi update yêu cầu current Case/state/Candidate/appointment/assignment version
phù hợp. Exact retry trả immutable committed snapshot; cùng key khác intent
trả `IDEMPOTENCY_CONFLICT`. Browser giữ cùng command và key qua network
uncertainty, kể cả trường hợp commit đã xong nhưng projection refresh lỗi.

UI chỉ đóng form/báo success sau mutation và authoritative pull đều
thành công. Cloud failure không ghi local state. Independent review đã bỏ
disk-cache bootstrap/write: mỗi user/role session bắt đầu CRM rỗng, xóa
legacy center-scoped CRM storage và chỉ render memory projection sau RPC thành
công. Vì vậy Admin cache không thể bypass server ACL khi Teacher dùng lại
cùng browser.

## Identity, ACL và center isolation

- RPC tự lấy `auth.uid()` và active exact-center membership; không tin actor
  hoặc center từ payload business.
- Owner/admin/center_admin/qtv được create/save/assign/archive. Consultant chỉ
  có backend read/care/appointment trên exact Case đang active-assigned cho mình.
  Teacher/viewer/anon/wrong-center bị deny.
- Ba table C5.3 `ENABLE` + `FORCE RLS`, không có direct policies, revoke cả
  authenticated/service_role; chỉ hai RPC public surface được grant authenticated.
- Read projection trả phone/email rỗng và identity read-only. Identity update,
  dedupe hay Contact/Student merge không được suy diễn từ form C5.3.
- Review hardening chặn phone/email giả dạng Contact/Candidate display name;
  Candidate insert/update C5.3 có canonical transactional audit/outbox riêng.
- Owner A→B→A chỉ đổi namespace/view và pull exact center; không copy hay
  merge data giữa hai center.

C5.3 không thêm CRM table vào Realtime publication. Module pull khi open,
reopen và khi bấm `Làm mới`; mỗi successful mutation cũng pull projection mới.
Đây là convergence contract của wave này, không ép system-wide refresh UX.

## P4B và capability defer

P4B vẫn `FROZEN / NOT DONE`; C5.3 không sửa migration, không gọi conversion
prepare/execute và không tự link Student. Edit protected Contact identity cũng
được defer tới workflow xác minh riêng; C5.3 không silent overwrite.
Assignment hỗ trợ assign/reassign tới active consultant cùng center; unassign
chưa là capability của wave này.

## Guarded local QA

Runner `tests/c5-3-crm-authoritative-shared-truth-local-db-qa.js` yêu cầu
`ICHESS_C5_3_LOCAL_QA_ALLOW_RESET=YES`, loopback Supabase, exact local Docker DB
và cấm linked project. Final run chứng minh:

- A Owner create → B center_admin read cùng masked canonical lead;
- B edit enrollment, append care log, upsert appointment, assign → A read cùng truth;
- fresh context bootstrap, cross-center leak `0`, Owner A→B→A isolation;
- stale edit/version conflict, exact retry và changed-intent idempotency conflict;
- protected identity không silent merge/overwrite, kể cả display-name alias;
  Candidate audit/outbox đủ và không có PII trong audit/outbox;
- consultant exact-assignment boundary và teacher/wrong-center/root-inactive/direct
  table/service_role fail closed;
- cloud failure không tạo canonical/local success;
- final reset Auth/Vault/grants/fixtures về sạch.

## Acceptance matrix

| Durable CRM state | A→B | B→A | Fresh | Cross-center | Failure safe | Conflict/retry |
|---|---:|---:|---:|---:|---:|---:|
| Lead / Contact / Case | PASS | PASS | PASS | leak 0 | PASS | PASS |
| Care Log | PASS | PASS | PASS | leak 0 | PASS | PASS |
| Appointment | PASS | PASS | PASS | leak 0 | PASS | PASS |
| Assignment | PASS | PASS | PASS | leak 0 | PASS | PASS |
| Durable enrollment state | PASS | PASS | PASS | leak 0 | PASS | PASS |

```text
inherited/frozen migration hashes: PASS (22 files)
P4B conversion UX: FROZEN / NOT RESUMED
remote Supabase/Auth/Edge/app apply/deploy: NOT RUN
checkpoint: GOVERNED BY INDEPENDENT REVIEW ARTIFACT
```

```text
C5.3 CRM AUTHORITATIVE SHARED TRUTH LOCAL QA PASS — READY FOR TECHNICAL REVIEW / CHECKPOINT
```
