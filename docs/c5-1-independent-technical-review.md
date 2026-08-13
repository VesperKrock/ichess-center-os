# C5.1 — Independent Technical Re-review

## Verdict

```text
C5_1_INDEPENDENT_TECHNICAL_RE_REVIEW: PASS
CRITICAL: 0
HIGH: 0
BLOCKING_MEDIUM: 0
C5_1_CHECKPOINT: READY
C5_2: NOT STARTED
```

Ngày re-review: 2026-08-14.

Review này đọc lại physical runtime, SQL, smoke và guarded Docker QA sau khi
finding `C5.1-H01` bị chặn ở lượt review trước. Marker PASS trong implementation
report không được dùng làm bằng chứng thay cho source/test thực tế.

## Baseline và integrity

- Branch review: `main`.
- Baseline trước checkpoint:
  `HEAD = origin/main = 4e103c70990df912326957a4a5109cc2af26fced`.
- Migration C5.1:
  `supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql`.
- SHA-256:
  `2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754`.
- Migration C5.1 giữ nguyên byte trong remediation; 19 inherited migration hash
  vẫn đúng.
- Không remote apply, Auth production, Edge hay deploy.

## C5.1-H01 — RESOLVED

Physical runtime không còn module
`src/attendance-board-angel-wings-data.js`, không còn control hoặc handler
load/restore/clear Angel Wings và không còn auto-inject dataset vào Student,
Teacher, Class Session hay Schedule Session.

Ba đường local-authoritative từng gây finding đã biến mất khỏi `src/main.js`:

- `restoreAngelWingsLocalDataset`;
- `data-attendance-board-angel-wings-action` load/clear;
- `restore-angel-wings-local`.

Các test/source chỉ phục vụ fixture cũ đã được xóa hoặc thay bằng fixture QA
trung tính dưới `tests/fixtures/`. Vì vậy không còn product-visible path có thể
báo lưu thành công hoặc đổi live core state mà bỏ qua C5.1 server commit.

Browser residue được xử lý bởi `src/legacy-dataset-cleanup.js`. Bộ lọc chỉ chạy
trong storage namespace của exact current center và chỉ xóa row có marker legacy
chính xác `sourceModule`, `sourceTag`, `datasetId` hoặc `importBatchId`. Regression
chứng minh record người dùng thật có cùng tên, kể cả có cờ fixture chung, không
bị xóa; cleanup lặp lại là idempotent. Không center hoặc membership nào bị xóa.

## Authoritative core contract

- Student, Teacher, Class Session và Schedule Session dùng
  `public.center_cloud_entities` làm business truth.
- Ghi bình thường đi qua `public.c5_1_mutate_core_entity`; UI chỉ cập nhật
  projection/cache sau committed result.
- Exact version, immutable idempotency result và stale conflict ngăn
  last-write-wins.
- Cloud/network failure không tạo local success.
- Empty-storage context bootstrap lại từ server; empty authoritative snapshot
  thay cache thay vì hồi sinh row local.
- RLS/RPC role matrix fail closed cho inactive/nonmember/wrong-center/wrong-role.

## Exact-center isolation

Owner center-switch gọi `resetCloudRuntimeStateForOwnerCenterSwitch()` trước khi
đổi storage namespace. Sau đó runtime reload exact-center cache, bootstrap exact
center và mới mở lại Student/Teacher/Schedule subscriptions.

Ba Realtime adapter có filter vật lý
`center_id=eq.${normalizedCenterId}`. Bootstrap/read/write đều nhận center hiện
hành và PostgreSQL vẫn kiểm active exact-center membership. Không có đường
copy/sync/merge/backfill core data giữa hai center.

Guarded QA dùng các context độc lập và chứng minh:

- A/B cùng center: A tạo thì B thấy; B sửa thì A thấy;
- fresh context không storage vẫn nhận cùng authoritative truth;
- C khác center không đọc/ghi được;
- event Realtime center A không đi vào subscription center B;
- Owner có hai membership chuyển A→B→A nhận đúng cache/server snapshot từng
  center, không rò row giữa namespace;
- membership inactive mất quyền read/write ngay;
- final reset đưa Auth/core/result/center fixture về baseline `0`.

## QA đã chạy lại

```text
node --check modified/untracked JS: PASS (81 files)
C5.1 semantic smoke: PASS
Angel Wings removal + center-isolation smoke: PASS
targeted semantic regressions: PASS 19/19
guarded local Docker multi-account QA: PASS
Owner center-switch isolation: PASS
Realtime cross-center isolation: PASS
19 inherited migration hashes: PASS
npm run build: PASS
```

Các historical phase smoke có self-scope assertion dựa trên dirty `git status`
không được dùng làm functional verdict trước checkpoint; current durable
invariants của chúng được cover trong targeted 19/19 và sẽ được chạy lại trên
clean checkpoint trước khi push.

## Re-review conclusion

Không phát hiện CRITICAL, HIGH hoặc blocking MEDIUM còn mở. C5.1 đáp ứng
server-first authority, cache-only projection, same-center convergence,
different-center isolation, Owner switch isolation và fail-closed security.

```text
C5.1 TECHNICAL RE-REVIEW: PASS
C5.1 CHECKPOINT: AUTHORIZED
C5.2: NOT STARTED
REMOTE APPLY / DEPLOY: NOT RUN
```
