# C5.2 — Attendance + Tuition Authoritative Shared Truth

## Trạng thái

```text
C5_2_IMPLEMENTATION: COMPLETE
C5_2_GUARDED_LOCAL_DB_QA: PASS
C5_2_SEMANTIC_SMOKE: PASS
C5_2_TARGETED_REGRESSIONS: PASS
C5_2_BUILD_HYGIENE: PASS
C5_2_REMOTE_APPLY_DEPLOY: NOT RUN
F23_3E_P4B: FROZEN / NOT DONE
```

Migrations mới:

`supabase/migrations/202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql`

`supabase/migrations/202608140002_c5_2_baseline_singleton_review_hardening.sql`

SHA-256:

`3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414`

Hardening SHA-256:

`76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7`

## Physical truth và authority

| Aggregate | `entity_type` | Server authority | Local |
|---|---|---|---|
| Attendance Record | `attendance_record` | `center_cloud_entities` + RPC C5.2 | cache/projection |
| Attendance Baseline lifecycle | `attendance_baseline_state` + baseline `attendance_record` | batch atomic C5.2 | draft + cache/projection |
| Session Report | `session_report` | RPC C5.2; attendance trong report chỉ là snapshot | cache/projection |
| Tuition record/package/payment fields | `tuition_record_package` | RPC C5.2 | cache/projection |

`payments`, `paidAmount`, `termHistory`, package, session counters và operational
fields vật lý nằm trong `tuition_record_package` đã được server hóa.
Giao dịch Thu chi do payment form tạo vẫn thuộc Finance, nằm ngoài C5.2 theo
scope khóa; C5.2 không sao chép transaction đó vào authority song song.

## Contract ghi

```sql
public.c5_2_mutate_attendance_tuition_entities(
  p_center_id text,
  p_mutations jsonb,
  p_idempotency_key uuid
) returns jsonb
```

RPC authenticated, exact-center, `SECURITY DEFINER`, `search_path=''`. Mỗi
mutation có exact `expected_version`; batch validate toàn bộ currentness trước
khi ghi row đầu tiên. Result immutable theo
`(center_id, actor_user_id, idempotency_key)`: exact replay trả cùng snapshot;
cùng key khác intent trả `IDEMPOTENCY_CONFLICT`.

Runtime giữ exact payload/key sau network uncertainty cho Attendance/Baseline/
Session Report; form Tuition và undo kỳ giữ pending authoritative record/key.
UI chỉ ghi cache sau result server hợp lệ. Cloud failure giữ projection cũ
và hiển thị NOT SAVED.

## Baseline lifecycle

Baseline records phải commit cùng một mutation
`attendance_baseline_state`. Update/clear/undo records và lifecycle state là một
transaction. Khi server state đang `locked`, record edit bị
`BASELINE_LOCKED`; stale state version bị `VERSION_CONFLICT`. Unlock phải là
commit state riêng hợp lệ trước khi sửa.

Independent review hardening thêm unique singleton theo `center_id` cho mọi
`attendance_baseline_state`, kể cả tombstone. Alternate `local_id` vì vậy không
thể tạo lifecycle state thứ hai để né lock/currentness; toàn batch rollback nếu
vi phạm.

## Session Report role

Physical product hiện tại dùng teacher-report gateway trong Admin OS; chưa có
binding authenticated teacher account → exact assigned session đủ chặt. Vì vậy
server cho `owner`, `qtv`, `center_admin`/`admin` ghi; authenticated `teacher`,
`consultant`, `viewer` chỉ đọc và bị deny server-side. Attendance snapshot trong
report luôn bị ép `attendanceIsCanonical=false`; canonical attendance là
`attendance_record`.

## Center isolation, bootstrap và Realtime

- SELECT RLS yêu cầu active membership tại active exact center.
- Direct INSERT/UPDATE/DELETE của bốn entity C5.2 bị chặn; chỉ RPC
  authenticated có EXECUTE.
- Subscription có filter vật lý `center_id=eq.<current-center>` và adapter lọc
  lại `entity_type`.
- Merge dùng `entity_version`; event out-of-order/stale không được ghi đè.
- Bootstrap server rỗng replace cache rỗng; không giữ local fallback và không
  upload legacy local state.
- Owner switch dừng subscription, đổi exact storage namespace, bootstrap center
  mới; không copy/merge A ↔ B.

## Attendance → Tuition

Boundary vẫn read-only preview. UI chỉ so sánh attendance credits với
`tuition.usedSessions`. RPC fail closed nếu payload bật bất kỳ flag auto-link/
auto-update nào; không auto trừ buổi, charge hay payment mutation.

## Guarded local QA

Runner:

`tests/c5-2-attendance-tuition-authoritative-shared-truth-local-db-qa.js`

Guard yêu cầu `ICHESS_C5_2_LOCAL_QA_ALLOW_RESET=YES`, exact local Docker labels,
Supabase API/DB loopback và cấm linked project. Bộ test tạo A owner + B admin
cùng center, C owner center khác, teacher limited và fresh independent storage;
chứng minh:

- A→B và B→A cho cả bốn aggregate;
- exact retry/idempotency, stale conflict và baseline lock atomic;
- alternate baseline identity không thể bypass lock; record-first batch rollback;
- fresh empty-storage bootstrap cùng server truth;
- cross-center leak `0`, exact-center Realtime và Owner A→B→A isolation;
- cloud failure bốn write class không advance local projection;
- wrong role/direct table/anon/service-role RPC fail closed;
- Attendance→Tuition read-only boundary;
- compact C5.1 Student authoritative regression;
- final reset Auth/entity/command-result/center về `0`.

## Targeted regressions

Current semantic tests, Attendance/Tuition read-only regression, guarded local DB QA,
compact C5.1 core regression, build, diff/hygiene và 20 inherited migration hashes
PASS. Không chạy full historical sweep.

Ba historical smoke được ghi nhận stale, không rewrite để làm xanh:

- C5.1C đòi tên helper local-first cũ `writeC51...`;
- C5.2C đòi soft-delete cloud phải giữ local record;
- readonly audit cũ cấm mọi file SQL trong dirty diff và bám exact source string.

Những assertion này bị authoritative contract C5.2 thay thế; invariant hiện
hành được cover trong semantic smoke/guarded QA mới.

## Acceptance

```text
Attendance authoritative: PASS
Baseline authoritative: PASS
Session Report authoritative: PASS
Tuition authoritative: PASS
same-center sharing: PASS
cross-center isolation: PASS
Owner switch isolation: PASS
fresh empty-storage context: PASS
cloud/server failure: PASS
conflict/currentness: PASS
idempotency/retry: PASS
realtime/reload convergence: PASS
Attendance→Tuition: READ-ONLY PRESERVED
inherited migration hashes: PASS
remote apply/deploy: NOT RUN
commit/push: NOT RUN
```

```text
C5.2 ATTENDANCE + TUITION AUTHORITATIVE SHARED TRUTH LOCAL QA PASS — READY FOR TECHNICAL REVIEW / CHECKPOINT
```
