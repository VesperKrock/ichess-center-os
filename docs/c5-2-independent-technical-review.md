# C5.2 — Independent Technical Review

Ngày review: 2026-08-14

## Verdict

```text
C5_2_INDEPENDENT_TECHNICAL_REVIEW: PASS
CRITICAL_OPEN: 0
HIGH_OPEN: 0
BLOCKING_MEDIUM_OPEN: 0
CHECKPOINT_AUTHORIZED: YES
REMOTE_SUPABASE_AUTH_EDGE_APP_APPLY_DEPLOY: NOT RUN
C5_3_IMPLEMENTATION: NOT STARTED
```

Baseline được review:

```text
branch: main
HEAD: 528b5bed83e107d3519b30e970d482e41a465e44
origin/main: 528b5bed83e107d3519b30e970d482e41a465e44
```

## Migration identity

Migration authoritative chính giữ nguyên byte:

`supabase/migrations/202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql`

SHA-256:

`3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414`

Review hardening additive, không sửa migration đã nhận diện:

`supabase/migrations/202608140002_c5_2_baseline_singleton_review_hardening.sql`

SHA-256:

`76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7`

20 inherited migration hashes PASS; C5.1 và P1–P4B inherited bytes không đổi.

## Finding đã đóng trong review

### HIGH — Baseline alternate-identity lock bypass — REMEDIATED

RPC chính kiểm tra lock/currentness trên baseline state có trong batch. Trước
hardening, một approved writer dùng `attendance_baseline_state` với `local_id`
khác có thể tạo lifecycle state thứ hai và né canonical locked state.

Migration `202608140002` thêm unique singleton theo `center_id` cho
`attendance_baseline_state`, kể cả tombstone. Regression adversarial đặt mutation
baseline record trước fake lifecycle insert đã chứng minh unique violation rollback
toàn batch: record giữ nguyên version/payload, chỉ còn một lifecycle row.

Finding mở sau remediation: không còn.

## Authority review

| Aggregate | Kết luận | Evidence chính |
|---|---|---|
| Attendance Record | PASS | RPC commit trước projection; versioned upsert/delete |
| Baseline lifecycle/lock | PASS | atomic batch, stale conflict, locked deny, singleton hardening |
| Session Report | PASS | server authoritative; attendance trong report bị ép noncanonical |
| Tuition record/package/payment fields | PASS | RPC authoritative; payment/package/term fields đi cùng entity version |

Payment transaction ledger do form thanh toán tạo vẫn thuộc Finance và nằm ngoài
C5.2 theo scope khóa. C5.2 không tạo authority song song; các field durable nằm
trong `tuition_record_package` đều qua authoritative RPC.

## Runtime invariants

- Thứ tự ghi là server commit → authoritative result → local cache/projection.
- Mỗi nhóm Attendance/Baseline/Report và Tuition chỉ còn ba cache sink: bootstrap,
  committed result và Realtime.
- Server-empty snapshot thay cache rỗng; fresh independent storage bootstrap cùng truth.
- Exact-center RLS/read filter, Realtime physical filter và handler center guard đều có.
- `entity_version` chặn stale/out-of-order event; stale mutation trả finite conflict.
- Owner A→B→A dừng subscription cũ, đổi storage namespace, không copy/merge dữ liệu.
- Network uncertainty giữ exact payload/idempotency key; changed intent cùng key bị
  server từ chối. Failure không advance local projection và UI không báo saved.

## Authorization / ACL

`owner`, `qtv`, `center_admin`/`admin` là server write roles. `teacher`,
`consultant`, `viewer` read-only. Đây là fail-closed đúng vì chưa tồn tại binding
đáng tin cậy:

```text
authenticated teacher account
→ canonical teacher identity
→ assigned session
```

Nếu product cần giáo viên nhập trực tiếp sau này, đó là deferred authorization
capability và phải có contract teacher-to-assignment riêng; không mở quyền trong C5.2.

Command-result table bật và force RLS, không cấp direct access. RPC là
`SECURITY DEFINER`, `search_path=''`, chỉ authenticated có EXECUTE; PUBLIC, anon và
service_role bị revoke. Direct DML bốn entity C5.2 bị RLS chặn.

## Attendance → Tuition

```text
READ-ONLY PREVIEW: PRESERVED
AUTO SESSION DEDUCTION: ABSENT
AUTO CHARGE/PAYMENT/APPLY: ABSENT
```

RPC còn fail closed nếu payload bật bất kỳ auto-link/auto-update flag nào.

## Targeted evidence

```text
C5.2 semantic smoke: PASS
C5.2 guarded local DB QA: PASS
A create → B sees: PASS 4/4
B update → A converges: PASS 4/4
baseline stale/lock atomic deny: PASS
baseline singleton bypass deny + rollback: PASS
fresh empty-storage bootstrap: PASS
cross-center leak: 0
Owner A→B→A isolation: PASS
Realtime exact-center isolation: PASS
cloud failure no false local success: PASS 4/4
wrong role / RLS / RPC ACL: PASS
Attendance→Tuition read-only: PASS
10 current Attendance/Tuition regressions: PASS
2 compact C5.1 regressions: PASS
20 inherited migration hashes: PASS
node --check changed JS: PASS
production build: PASS
git diff --check: PASS
local QA final reset counts: 0
```

Không chạy full historical sweep. Ba smoke stale đã biết được ghi nhận, không sửa:
C5.1C helper-name/local-first cũ, C5.2C soft-delete giữ local cũ, và readonly audit
bám exact source/dirty SQL cũ. Evidence hiện hành không cho thấy chúng bắt regression
C5.2 thực tế.

## Gate

```text
CRITICAL = 0
HIGH = 0
BLOCKING MEDIUM = 0
C5.2 TECHNICAL REVIEW: PASS
CHECKPOINT: AUTHORIZED
```
