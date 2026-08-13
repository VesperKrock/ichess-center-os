# C5.1 — Authoritative Core Contract + Multi-Account Harness

## Trạng thái

```text
C5_1_IMPLEMENTATION: COMPLETE
C5_1_GUARDED_LOCAL_DOCKER_QA: PASS
C5_1_SEMANTIC_SMOKE: PASS
C5_1_TECHNICAL_RE_REVIEW: PASS
C5_1_LEGACY_ANGEL_WINGS_REMOVED: PASS
C5_1_EXACT_CENTER_ISOLATION: PASS
C5_1_REMOTE_APPLY_DEPLOY: NOT RUN
F23_3E_P4B: FROZEN / NOT DONE
```

C5.1 chỉ đóng nguồn dữ liệu chuẩn cho bốn aggregate upstream: Học viên,
Giáo viên, Lớp học và Buổi lịch. Attendance, Tuition, CRM, Finance và các màn
hình derived chưa được remediation trong phase này.

Migration:

`supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql`

SHA-256:

`2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754`

## Kết luận nguồn dữ liệu

| Aggregate | `entity_type` | Nguồn authoritative | Đồng bộ UI |
|---|---|---|---|
| Học viên | `student` | `public.center_cloud_entities` | Realtime + bootstrap |
| Giáo viên | `teacher` | `public.center_cloud_entities` | Realtime + bootstrap |
| Lớp học | `class_session` | `public.center_cloud_entities` | Reload/bootstrap |
| Buổi lịch | `schedule_session` | `public.center_cloud_entities` | Realtime + bootstrap |

`localStorage` chỉ là cache/projection theo center. Xóa cache hoặc mở browser
context mới không làm mất business truth: bootstrap tải lại snapshot server,
kể cả snapshot rỗng. Lỗi cloud không được tạo thông báo lưu thành công và không
được thay đổi cache.

## Contract ghi authoritative

Mọi ghi bình thường của bốn aggregate đi qua duy nhất:

```sql
public.c5_1_mutate_core_entity(
  p_center_id text,
  p_entity_type text,
  p_local_id text,
  p_expected_version bigint,
  p_payload jsonb,
  p_idempotency_key uuid,
  p_operation text default 'UPSERT'
) returns jsonb
```

RPC là `SECURITY DEFINER`, `search_path=''`. Actor lấy từ `auth.uid()`; browser
không truyền actor hoặc role. `owner`, `qtv`, `center_admin` và alias vật lý
`admin` được ghi. `teacher`, `consultant`, `viewer`, membership inactive,
non-member và center inactive fail closed.

Client gửi lệnh lên server trước. Chỉ khi nhận snapshot `COMMITTED`/`DELETED`
hợp lệ thì `src/main.js` mới gọi `saveStoredStudents`, `saveStoredTeachers`,
`saveStoredClassSessions` hoặc `saveStoredScheduleSessions` để cập nhật cache.

## Version, conflict và idempotency

- `center_cloud_entities.entity_version` bắt đầu ở `1`, tăng đúng `+1` mỗi commit.
- Create yêu cầu `p_expected_version=0`; update/delete yêu cầu exact current
  version.
- Sai version trả `VERSION_CONFLICT`, không last-write-wins.
- `center_core_command_result` giữ immutable result theo
  `(center_id, actor_user_id, idempotency_key)`.
- Exact replay trả lại committed snapshot với `replayed=true` trước khi diễn
  giải lại live entity.
- Cùng key nhưng khác center/type/id/version/operation/payload trả
  `IDEMPOTENCY_CONFLICT`.
- `updatedAt` và metadata `cloud*` của browser không thuộc semantic intent;
  timestamp authoritative do server tạo. Retry sau network uncertainty vì vậy
  vẫn exact dù UI rebuild timestamp.
- Advisory idempotency lock và row `FOR UPDATE` serialize concurrent first
  attempt. Stale writer không ghi đè writer đã commit.

## RLS và surface bảo mật

Các policy permissive cũ kiểu “mọi member được ghi” đã bị xóa. Policy mới:

- SELECT chỉ cho authenticated membership active tại center active tương ứng;
- direct INSERT/UPDATE/DELETE của bốn core type bị chặn;
- direct write non-core còn dùng `public.can_write_center(center_id)` để không
  phá các module ngoài scope đang phụ thuộc foundation cũ;
- table `center_core_command_result` bật và force RLS, không có direct grants;
- RPC chỉ grant cho `authenticated`; PUBLIC, `anon`, `service_role` bị revoke;
- exact-center RLS ngăn center C nhìn hoặc ghi center của A/B;
- `center_cloud_entities` giữ publication Realtime hiện có, không thêm table
  kết quả idempotency vào publication.

Client role gate trong `src/online-access-control.js` dùng cùng ma trận role.
Client gate chỉ phục vụ UX; PostgreSQL RPC/RLS vẫn là enforcement cuối.

## Bootstrap và realtime

`pullCloudBootstrapCoreEntities` tải cả bốn type, cùng `entity_version`, và
project thành `cloudVersion`. `applyCloudBootstrapSnapshotToLocal` thay toàn bộ
bốn cache kể cả server trả mảng rỗng; không hồi sinh local-only row.

Học viên, Giáo viên và Buổi lịch giữ subscription Realtime hiện có. Merge chỉ
nhận version mới hơn, nên event cũ không ghi đè projection mới. Lớp học không có
product promise realtime ở baseline; nó hội tụ bằng reload/bootstrap.

## Multi-account guarded local QA

Runner:

`tests/c5-1-authoritative-core-contract-and-multi-account-harness-local-db-qa.js`

Guard yêu cầu `ICHESS_C5_1_LOCAL_QA_ALLOW_RESET=YES`, exact local project/container
labels và mọi URL DB/API là loopback. Runner không link, push, repair hay dùng
remote project.

Matrix chạy bằng bốn synthetic Auth user và storage context độc lập:

1. A (`owner`) và B (`center_admin`) cùng center; C (`owner`) center khác;
   user thứ tư role `teacher` cùng center.
2. A create đủ Student/Teacher/Class/Schedule qua RPC.
3. B thấy ba aggregate realtime và thấy đủ bốn aggregate qua bootstrap.
4. Exact retry của A với timestamp client mới trả immutable version `1`; thay
   semantic cùng key bị conflict.
5. B edit đủ bốn; A thấy realtime hoặc reload, version thành `2`.
6. A stale edit version `1` fail closed.
7. Context mới với cache rác bootstrap đúng server và xóa projection rác.
8. C không đọc/ghi center A/B; role teacher không ghi; membership B bị inactive
   mất cả read lẫn write ngay lập tức.
9. Direct core table write bị RLS chặn; non-core admin write regression vẫn qua.
10. Anon PostgREST và effective ACL bị deny.
11. Synthetic network failure không đổi local cache.
12. Cuối runner reset local và chứng minh Auth/core/result/center fixture về `0`.

## Remediation Angel Wings và khóa cô lập cơ sở

Dataset/demo Angel Wings cũ đã bị loại khỏi product runtime. Module nguồn, các
control load/restore/clear và các test chỉ tồn tại để duy trì fixture lịch sử đã
được xóa. Product không còn đường nào dùng dataset này để thay thế Student,
Teacher, Class Session hay Schedule Session trong live state.

`src/legacy-dataset-cleanup.js` chỉ dọn residue trong namespace của đúng center
đang active và chỉ nhận dạng bằng các marker legacy chính xác
`sourceModule`/`sourceTag`/`datasetId`/`importBatchId`. Tên người, tên lớp hoặc cờ
fixture chung không bao giờ đủ quyền xóa. Cleanup idempotent và không xóa center,
membership hay foundation multi-center.

Owner center-switch dừng subscription/state của center cũ trước khi đổi storage
namespace, bootstrap center mới rồi mới mở các subscription có filter
`center_id=eq.<current-center>`. Guarded QA chứng minh A/B cùng center hội tụ,
center C bị cô lập, Owner chuyển A→B→A không trộn cache và event Realtime của A
không cập nhật client đang ở B.

## Artifact và code path

- SQL: migration C5.1 nói trên.
- Runtime contract: `src/cloud-authoritative-core.js`.
- Generic cloud read/bootstrap: `src/cloud-db-sync.js`, `src/cloud-bootstrap.js`.
- Realtime: `src/cloud-realtime-students.js`,
  `src/cloud-realtime-teachers.js`,
  `src/cloud-realtime-schedule-sessions.js`.
- UI commit boundary: `src/main.js`.
- Version preservation khi build form: `src/settings-module.js`,
  `src/schedule-module.js`.
- Role gate: `src/online-access-control.js`.
- Semantic smoke và guarded QA dưới `tests/c5-1-*`.

## Không thuộc C5.1

- Không migrate/remediate Attendance, Tuition, CRM, Finance hoặc derived views.
- Không sửa inherited migration.
- Không remote Supabase/Auth/Edge/deploy.
- Không resume hay gọi F23.3E-P4B DONE.
- Không bắt đầu C5.2 trong checkpoint này.

## Acceptance

```text
C5.1 TECHNICAL RE-REVIEW PASS — ANGEL WINGS REMOVED — CENTER ISOLATION VERIFIED
NEXT GATE: CHECKPOINT, THEN C5.2
C5.2: NOT STARTED
```
